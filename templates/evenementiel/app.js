// Pilote événementiel QME : plusieurs événements, rétroplanning calculé, budget et contrats, invités et badges,
// conducteur du jour J. Données synchronisées par clé de licence (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.EVT;
  const API = '/api/templates';
  const PRODUIT = 'EVT';
  const CLE_CODE = 'qme-evt-code';
  const CLE_CACHE = 'qme-evt-cache';
  const CLE_DEMO = 'qme-evt-demo';
  const CLE_UI = 'qme-evt-ui';
  const CODE_DEMO = 'DEMO';
  const NOM = 'Pilote événementiel';

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
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return fmt(s);
  };
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const typeEvt = (id) => B.types.find((t) => t.id === id) || B.types[3];
  const categorie = (id) => B.categories.find((c) => c.id === id) || { id, nom: id || 'Sans catégorie', couleur: 'gris' };
  const phase = (id) => B.phases.find((p) => p.id === id) || { id, nom: 'Autre' };
  const statutContrat = (id) => B.statutsContrat.find((s) => s.id === id) || B.statutsContrat[0];

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let annulation = null;
  const ui = Object.assign({ evtId: null, retroTout: false, resp: '', cat: '', rep: '', q: '', jour: 1 }, stock.lire(CLE_UI) || {});
  const memoUi = () => stock.ecrire(CLE_UI, { evtId: ui.evtId, retroTout: ui.retroTout });

  const etatVide = () => ({ version: 1, structure: '', reglages: { convention: 'TTC' },
    evenements: [], taches: [], postes: [], prestataires: [], contrats: [], invites: [], conducteur: [], checklist: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) },
      evenements: tab(d.evenements).map((e) => ({ type: 'autre', heure: '', lieu: '', client: '', nbJours: 1, budgetCible: 0, notes: '', ...e })),
      taches: tab(d.taches).map((t) => ({ phase: 'cadrage', avant: 0, dateFixe: null, responsable: '', faite: null, note: '', ...t })),
      postes: tab(d.postes), prestataires: tab(d.prestataires),
      contrats: tab(d.contrats).map((c) => ({ statut: 'consulte', montant: 0, objet: '', documents: '', posteId: null, ...c, echeances: tab(c.echeances) })),
      invites: tab(d.invites).map((i) => ({ prenom: '', societe: '', fonction: '', email: '', categorie: 'client', reponse: 'attente', regime: '', accessibilite: '', note: '', present: false, ...i })),
      conducteur: tab(d.conducteur).map((x) => ({ jour: 1, duree: 0, lieu: '', responsable: '', notes: '', ...x })),
      checklist: tab(d.checklist) };
  };
  const evt = (id) => E.evenements.find((x) => x.id === id);
  const presta = (id) => E.prestataires.find((x) => x.id === id);
  const evenementsTries = () => [...E.evenements].sort((a, b) => a.date.localeCompare(b.date));
  const aVenir = () => evenementsTries().filter((e) => !R.evenementPasse(e, auj()));
  function evtCourant() {
    let e = evt(ui.evtId);
    if (!e) { e = aVenir()[0] || evenementsTries().at(-1) || null; ui.evtId = e?.id || null; }
    return e;
  }
  const deEvt = (liste, id) => liste.filter((x) => x.evtId === id);

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
        toast('Les données dépassent la taille autorisée : supprime des événements terminés.');
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

  // ---------- Création d'un événement (premier lancement, bouton, démo) ----------
  // options : { retro, postes, conducteur, checklist, passees }
  function creerEvenement(d, options = {}) {
    const e = { id: uid(), nom: d.nom, type: d.type || 'autre', date: d.date, heure: d.heure || '', nbJours: d.nbJours || 1, lieu: d.lieu || '', client: d.client || '', budgetCible: d.budgetCible || 0, notes: d.notes || '' };
    E.evenements.push(e);
    const t = auj();
    if (options.retro && B.retroplannings[e.type]) E.taches.push(...R.tachesDepuisModele(B.retroplannings[e.type], e, t, options.passees || 'aujourdhui', E.taches, uid).taches);
    if (options.postes) ajouterPostesTypes(e, B.postesParType[e.type].map((i) => B.postes[i]));
    if (options.conducteur && B.conducteurs[e.type]) ajouterConducteurType(e);
    if (options.checklist) ajouterChecklistType(e);
    return e;
  }
  function ajouterPostesTypes(e, noms) {
    const deja = new Set(deEvt(E.postes, e.id).map((p) => p.nom.toLowerCase()));
    let n = 0;
    for (const nom of noms) if (!deja.has(nom.toLowerCase())) { E.postes.push({ id: uid(), evtId: e.id, nom, prevu: 0 }); n++; }
    return n;
  }
  function ajouterConducteurType(e) {
    const modele = B.conducteurs[e.type] || B.conducteurs.seminaire;
    modele.forEach(([heure, duree, titre, lieu]) => E.conducteur.push({ id: uid(), evtId: e.id, jour: 1, heure, duree, titre, lieu, responsable: '', notes: '' }));
    return modele.length;
  }
  function ajouterChecklistType(e) {
    const deja = new Set(deEvt(E.checklist, e.id).map((c) => c.libelle.toLowerCase()));
    let n = 0;
    B.checklist.forEach(([libelle, heure]) => { if (!deja.has(libelle.toLowerCase())) { E.checklist.push({ id: uid(), evtId: e.id, libelle, heure, responsable: '', fait: false }); n++; } });
    return n;
  }

  // ---------- Données de démonstration (relatives à aujourd'hui) ----------
  function donneesDemo() {
    E = etatVide();
    E.structure = 'Agence Horizon (exemple)';
    const t = auj();
    const equipe = ['Inès', 'Marc', 'Sofia', 'Théo'];
    const opts = { retro: true, postes: true, conducteur: true, checklist: true, passees: 'garder' };
    const lancement = creerEvenement({ nom: 'Lancement de la gamme Aube', type: 'lancement', date: ajout(t, 6), heure: '18:30', lieu: 'Halle Méridienne, Lyon', client: 'Orme & Cie (fictif)', budgetCible: 5000000 }, opts);
    const seminaire = creerEvenement({ nom: 'Séminaire de direction', type: 'seminaire', date: ajout(t, 24), heure: '09:00', nbJours: 2, lieu: 'Domaine des Cèdres', client: 'Groupe Tilleul (fictif)', budgetCible: 6000000 }, opts);
    const salon = creerEvenement({ nom: 'Salon des achats industriels', type: 'salon', date: ajout(t, 68), heure: '09:30', nbJours: 3, lieu: 'Parc des expositions', client: 'Atelier Cobalt (fictif)' }, opts);
    const matinale = creerEvenement({ nom: 'Matinale clients', type: 'autre', date: t, heure: '08:00', lieu: 'Bureaux de l\'agence', client: 'Interne' }, { checklist: true });
    const passe = creerEvenement({ nom: 'Convention partenaires', type: 'seminaire', date: ajout(t, -35), heure: '09:00', lieu: 'Centre de congrès', client: 'Bureau Lavande (fictif)' }, { retro: true, postes: true, passees: 'garder' });

    // Avancement simulé : tâches faites sauf quelques retards ; responsables en rotation.
    const retards = { [lancement.id]: 2, [seminaire.id]: 3, [salon.id]: 1, [passe.id]: 0 };
    for (const e of [lancement, seminaire, salon, passe]) {
      let laisses = 0;
      deEvt(E.taches, e.id).forEach((x, i) => {
        x.responsable = equipe[i % equipe.length];
        const ech = R.echeance(x, e);
        if (ech < t) {
          if (laisses < retards[e.id] && ech >= ajout(t, -21)) { laisses++; return; }
          x.faite = ajout(ech, -(i % 3));
        } else if (ech === t || (i % 7 === 0 && ech < ajout(t, 20))) x.faite = i % 2 ? t : null;
      });
    }
    E.taches.push({ id: uid(), evtId: lancement.id, titre: 'Valider la maquette du kakémono avec le client', phase: 'communication', avant: 0, dateFixe: ajout(t, 1), responsable: 'Sofia', faite: null, note: 'BAT attendu demain matin.' });

    // Prestataires (carnet commun, noms fictifs).
    const P = (nom, metier, contact, tel, email) => { const p = { id: uid(), nom, metier, contact, tel, email, notes: '' }; E.prestataires.push(p); return p; };
    const halle = P('Halle Méridienne', 'Lieu', 'Responsable commercial', '04 00 00 00 01', 'contact@exemple.fr');
    const traiteur = P('Traiteur Les Quatre Saisons', 'Traiteur', 'Chef de projet', '04 00 00 00 02', 'devis@exemple.fr');
    const regie = P('Régie Volta', 'Technique', 'Régisseur', '06 00 00 00 03', 'regie@exemple.fr');
    const decor = P('Atelier Décor Brun', 'Animation', 'Chargée de projet', '06 00 00 00 04', '');
    const photo = P('Studio Ardoise', 'Photo et vidéo', 'Photographe', '06 00 00 00 05', 'studio@exemple.fr');
    const domaine = P('Domaine des Cèdres', 'Lieu', 'Service séminaires', '04 00 00 00 06', 'seminaires@exemple.fr');
    const navettes = P('Navettes Azur', 'Transport', 'Exploitation', '04 00 00 00 07', '');
    const stand = P('Stand Concept', 'Standiste', 'Chef de projet', '06 00 00 00 08', '');

    // Budgets prévus (montants d'exemple, fictifs).
    const prevus = (e, m) => deEvt(E.postes, e.id).forEach((p) => { p.prevu = (m[p.nom] || 0) * 100; });
    prevus(lancement, { 'Lieu et location de salles': 11000, Restauration: 15000, Boissons: 3500, 'Technique son et lumière': 7000, 'Scénographie et décoration': 8000, 'Signalétique et impressions': 1500, 'Cadeaux et goodies': 2500, 'Photo et vidéo': 2000, 'Personnel d\'accueil': 1800, Imprévus: 2000 });
    prevus(seminaire, { 'Lieu et location de salles': 18000, Restauration: 14000, Hébergement: 16000, Transports: 4000, 'Technique son et lumière': 3500, Imprévus: 3000 });
    prevus(salon, { Stand: 22000, 'Frais d\'exposant': 9500, Hébergement: 4200, Transports: 1800, 'Signalétique et impressions': 1200 });
    prevus(passe, { 'Lieu et location de salles': 9000, Restauration: 7500, Imprévus: 1000 });
    const poste = (e, nom) => deEvt(E.postes, e.id).find((p) => p.nom === nom)?.id || null;
    const C = (e, p, posteNom, objet, montant, statut, documents, echeances) => E.contrats.push({ id: uid(), evtId: e.id, prestaId: p.id, posteId: poste(e, posteNom), objet, montant: montant * 100, statut, documents,
      echeances: echeances.map(([libelle, m, date, payeLe]) => ({ id: uid(), libelle, montant: m * 100, date, payeLe })) });
    C(lancement, halle, 'Lieu et location de salles', 'Privatisation de la halle, 18 h – 23 h', 12000, 'signe', 'Contrat n° HM-112 signé (dossier client / contrats)', [['Acompte', 3600, ajout(t, -48), ajout(t, -47)], ['Solde', 8400, ajout(t, 6), null]]);
    C(lancement, traiteur, 'Restauration', 'Cocktail dînatoire 180 personnes', 14500, 'signe', 'Devis D-2611 accepté, conditions d\'annulation p. 2', [['Acompte', 4350, ajout(t, -30), ajout(t, -29)], ['Solde', 10150, ajout(t, 20), null]]);
    C(lancement, regie, 'Technique son et lumière', 'Son, lumière, écran LED, régisseur', 6800, 'signe', 'Bon de commande BC-48', [['Acompte', 2040, ajout(t, -3), null], ['Solde', 4760, ajout(t, 30), null]]);
    C(lancement, decor, 'Scénographie et décoration', 'Scénographie d\'entrée et mur photo', 7500, 'signe', 'Devis signé le ' + R.dateFr(ajout(t, -25)), [['Acompte', 2500, ajout(t, -25), ajout(t, -24)], ['Deuxième versement', 2500, ajout(t, 4), null]]);
    C(lancement, photo, 'Photo et vidéo', 'Reportage photo et film de 2 minutes', 1900, 'devis', 'Devis reçu par e-mail, à valider par le client', []);
    C(lancement, navettes, null, 'Navettes retour invités', 900, 'consulte', '', []);
    C(seminaire, domaine, 'Lieu et location de salles', 'Salles plénière et ateliers, 2 jours', 17200, 'signe', 'Contrat DC-2027-04', [['Acompte', 5160, ajout(t, -20), ajout(t, -18)], ['Solde', 12040, ajout(t, 10), null]]);
    C(seminaire, domaine, 'Hébergement', '60 chambres, 1 nuit', 15600, 'signe', 'Même contrat, annexe 2', [['Acompte', 4680, ajout(t, -20), ajout(t, -18)], ['Solde', 10920, ajout(t, 24), null]]);
    C(seminaire, navettes, 'Transports', 'Navettes gare – domaine', 3900, 'devis', '', []);
    C(seminaire, traiteur, 'Restauration', 'Dîner de gala', 9800, 'annule', 'Remplacé par la restauration du domaine', [['Acompte', 1000, ajout(t, -40), ajout(t, -40)]]);
    C(salon, stand, 'Stand', 'Conception et montage stand 36 m²', 21000, 'signe', 'Contrat SC-77, plans v3', [['Acompte', 6300, ajout(t, -10), ajout(t, -9)], ['Deuxième versement', 6300, ajout(t, 40), null]]);
    C(passe, halle, 'Lieu et location de salles', 'Location salle plénière', 8600, 'signe', 'Contrat HM-098', [['Acompte', 2580, ajout(t, -90), ajout(t, -90)], ['Solde', 6020, ajout(t, -30), ajout(t, -28)]]);

    // Invités du lancement (personnes fictives).
    const prenoms = ['Léa', 'Hugo', 'Chloé', 'Nathan', 'Camille', 'Louis', 'Manon', 'Jules', 'Sarah', 'Adam', 'Inès', 'Paul', 'Emma', 'Noah', 'Jade', 'Arthur', 'Alice', 'Lucas', 'Rose', 'Victor', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Anna', 'Tom', 'Julia', 'Maël', 'Eva', 'Sacha', 'Nina', 'Hélène', 'Yanis', 'Clara', 'Malo', 'Lou'];
    const noms = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller'];
    const societes = ['Orme & Cie', 'Atelier Cobalt', 'Groupe Tilleul', 'Maison Pivert', 'Bureau Lavande', 'Studio Ardoise', 'Rédaction Le Fil', 'Saule Conseil'];
    const fonctions = ['Directrice commerciale', 'Acheteur', 'Responsable marketing', 'Directeur général', 'Chargée de communication'];
    const cats = ['client', 'client', 'prospect', 'partenaire', 'presse', 'client', 'vip', 'prospect', 'collaborateur', 'intervenant'];
    prenoms.forEach((p, i) => {
      const rep = i % 9 === 4 ? 'non' : i % 5 === 3 ? 'attente' : 'oui';
      E.invites.push({ id: uid(), evtId: lancement.id, prenom: p, nom: noms[i], societe: cats[i % 10] === 'collaborateur' ? 'Orme & Cie' : cats[i % 10] === 'presse' ? 'Rédaction Le Fil' : societes[i % 7], fonction: cats[i % 10] === 'presse' ? 'Journaliste' : cats[i % 10] === 'intervenant' ? 'Conférencière' : fonctions[i % fonctions.length], email: '',
        categorie: cats[i % 10], reponse: rep, regime: i % 8 === 2 ? 'Végétarien' : i % 13 === 5 ? 'Sans alcool' : i === 17 ? 'Végétalien' : '', accessibilite: i === 11 ? 'Accès en fauteuil roulant' : '', note: '', present: false });
    });
    // Matinale du jour : présences pointées.
    ['Durand', 'Petit', 'Roux', 'Faure', 'Blanc', 'Moreau', 'Lambert', 'Girard'].forEach((nom, i) => E.invites.push({ id: uid(), evtId: matinale.id, prenom: prenoms[i + 3], nom, societe: societes[i % societes.length], fonction: '', email: '', categorie: i % 3 ? 'client' : 'prospect', reponse: i === 7 ? 'non' : 'oui', regime: '', accessibilite: '', note: '', present: i < 4 }));
    // Conducteur de la matinale (aujourd'hui) avec un chevauchement volontaire.
    [['07:30', 30, 'Installation de la salle', 'Salle 1', 'Théo'], ['08:00', 30, 'Accueil café', 'Hall', 'Inès'], ['08:30', 45, 'Présentation des nouveautés', 'Salle 1', 'Marc'], ['09:00', 20, 'Témoignage client', 'Salle 1', 'Sofia'], ['09:20', 40, 'Échanges libres', 'Hall', 'Inès'], ['10:00', 30, 'Rangement', 'Salle 1', 'Théo']]
      .forEach(([heure, duree, titre, lieu, responsable]) => E.conducteur.push({ id: uid(), evtId: matinale.id, jour: 1, heure, duree, titre, lieu, responsable, notes: '' }));
    deEvt(E.checklist, matinale.id).forEach((c, i) => { c.fait = i < 9; if (i < 4) c.responsable = equipe[i]; });
    deEvt(E.conducteur, lancement.id).forEach((c, i) => { c.responsable = equipe[i % equipe.length]; });
    deEvt(E.conducteur, lancement.id)[4].notes = 'Micro HF n° 1, pupitre côté jardin';
    ui.evtId = lancement.id; memoUi();
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
          <rect x="10" y="20" width="260" height="260" fill="#F5B400"/>
          <circle cx="140" cy="150" r="80" fill="#141414"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <path d="M290 280 A130 130 0 0 1 420 150 V280 Z" fill="#1D4E89"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Pilote événementiel · agences et communication</p>
          <h1>Tous tes événements, un seul tableau de bord.</h1>
          <p>Rétroplanning calculé depuis la date, budget prévu, engagé et payé, contrats et acomptes, invités et badges, conducteur du jour J.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton pilote</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes événements sont enregistrés en ligne et suivent ton équipe sur tous ses appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon pilote</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a>.</p>
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
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : une clé de licence compte 4 blocs de 8 caractères, un code d\'accès EVT 5 blocs (copie-la depuis l\'e-mail reçu).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon pilote'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, structure: '', convention: 'TTC' };
  function champsEvenement(e = {}, creation = true) {
    const t = auj();
    return `
      <label class="champ">Nom de l'événement<input name="nom" required maxlength="80" value="${esc(e.nom || '')}" placeholder="Ex. : Séminaire annuel des ventes"></label>
      <div class="deux">
        <label class="champ">Type<select name="type">${B.types.map((x) => `<option value="${x.id}" ${x.id === (e.type || 'seminaire') ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Date (premier jour)<input type="date" name="date" required value="${esc(e.date || ajout(t, 60))}"></label>
      </div>
      <div class="deux">
        <label class="champ">Heure de début<small>Facultative</small><input type="time" name="heure" value="${esc(e.heure || '')}"></label>
        <label class="champ">Nombre de jours<input type="number" name="nbJours" min="1" max="15" value="${e.nbJours || 1}"></label>
      </div>
      <div class="deux">
        <label class="champ">Lieu<small>Facultatif</small><input name="lieu" maxlength="80" value="${esc(e.lieu || '')}"></label>
        <label class="champ">Client ou commanditaire<small>Facultatif</small><input name="client" maxlength="80" value="${esc(e.client || '')}"></label>
      </div>
      <label class="champ">Budget cible (${esc(E?.reglages.convention || accueil.convention)})<small>Facultatif : comparé au total engagé.</small><input name="budgetCible" inputmode="decimal" value="${R.champMontant(e.budgetCible || null)}" placeholder="Ex. : 45 000"></label>
      ${creation ? `<fieldset class="choix-base"><legend>Partir de la base intégrée <small>Selon le type choisi ; tout reste modifiable.</small></legend>
        <label class="case"><input type="checkbox" name="retro" checked> Rétroplanning type (échéances relatives à la date)</label>
        <label class="case"><input type="checkbox" name="postes" checked> Postes de budget types (sans montant)</label>
        <label class="case"><input type="checkbox" name="conducteur" checked> Conducteur type (horaires à adapter)</label>
        <label class="case"><input type="checkbox" name="checklist" checked> Checklist du jour J</label>
      </fieldset>` : ''}
      <p class="erreur" role="alert"></p>`;
  }
  function lireEvenement(f) {
    const nom = String(f.get('nom') || '').trim();
    const date = f.get('date');
    if (!nom) return 'Indique le nom de l\'événement.';
    if (!R.estDate(date)) return 'Indique une date valide.';
    const nbJours = Number(f.get('nbJours')) || 1;
    if (!Number.isInteger(nbJours) || nbJours < 1 || nbJours > 15) return 'Nombre de jours : entre 1 et 15.';
    const budgetCible = R.lireMontant(f.get('budgetCible'));
    if (budgetCible === null || budgetCible < 0) return 'Budget cible illisible (ex. : 45 000 ou 45000,50).';
    return { nom, date, nbJours, budgetCible, type: f.get('type'), heure: f.get('heure') || '', lieu: String(f.get('lieu') || '').trim(), client: String(f.get('client') || '').trim() };
  }

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton pilote événementiel.</h1>
        <p class="intro">Deux réglages, puis ton premier événement. Tout reste modifiable ensuite dans les réglages.</p>
        <form id="form-accueil" class="pile" style="max-width:520px">
          <label class="champ">Nom de ta structure<small>Facultatif : agence, service, association… Il s'affiche sur le tableau de bord.</small><input id="structure" maxlength="60" value="${esc(a.structure)}" autocomplete="organization"></label>
          <fieldset class="choix-base"><legend>Tu saisis tes montants… <small>Simple libellé : garde la même convention partout.</small></legend>
            <label class="case"><input type="radio" name="convention" value="HT" ${a.convention === 'HT' ? 'checked' : ''}> Hors taxes (HT)</label>
            <label class="case"><input type="radio" name="convention" value="TTC" ${a.convention === 'TTC' ? 'checked' : ''}> Toutes taxes comprises (TTC)</label>
          </fieldset>
        </form>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Premier événement</p>
        <h1>Quel est ton prochain événement ?</h1>
        <p class="intro">Le rétroplanning type se cale sur sa date : changer la date décale toutes les échéances. Les tâches dont l'échéance est déjà passée sont ramenées à aujourd'hui.</p>
        <form id="form-premier" class="pile" style="max-width:640px" novalidate>${champsEvenement()}
          <div class="accueil-pied">
            <button class="btn" type="button" data-action="accueil-retour">Retour</button>
            <span class="rang"><button class="btn" type="button" data-action="accueil-vide">Partir de zéro</button><button class="btn primaire" type="submit">Créer l'événement</button></span>
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
      const d = lireEvenement(f);
      if (typeof d === 'string') { E = null; $('#form-premier .erreur').textContent = d; return; }
      E.structure = accueil.structure.trim();
      const ev = creerEvenement(d, { retro: f.has('retro'), postes: f.has('postes'), conducteur: f.has('conducteur'), checklist: f.has('checklist'), passees: 'aujourdhui' });
      ui.evtId = ev.id; memoUi();
      accueil = { etape: 1, structure: '', convention: 'TTC' };
      sauver(); vue = 'bord'; demarrer();
      toast(`« ${ev.nom} » créé : ${pluriel(deEvt(E.taches, ev.id).length, 'tâche')} au rétroplanning.`);
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
    retro: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="10" height="4" fill="currentColor"/><rect x="7" y="10" width="10" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="11" y="16" width="10" height="4" fill="currentColor"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    invites: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    jourj: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['retro', 'Rétroplanning'], ['budget', 'Budget'], ['invites', 'Invités'], ['jourj', 'Jour J']];
  const COURTS = { bord: 'Bord', retro: 'Rétro', budget: 'Budget', invites: 'Invités', jourj: 'Jour J' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Pilote<br>événementiel</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span data-court="${COURTS[id]}">${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>
      <div id="impression" aria-hidden="true"></div>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · ${NOM}`;
    const e = evtCourant();
    if (vue !== 'bord' && !e) { $('#vue').innerHTML = vueSansEvenement(); return; }
    $('#vue').innerHTML = { bord: vueBord, retro: vueRetro, budget: vueBudget, invites: vueInvites, jourj: vueJourJ }[vue](e);
    if (vue === 'budget') brancherGraphique();
    if (vue === 'invites') brancherRecherche();
  }
  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  const vueSansEvenement = () => `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun événement</h3><p>Crée ton premier événement : le rétroplanning, le budget, les invités et le conducteur s'y rattachent.</p><div class="actions"><button class="btn primaire" data-action="evt-nouveau">${ICONES.plus}Nouvel événement</button></div></div></div>`;

  // Sélecteur d'événement en tête des vues 2 à 5.
  function enteteEvenement(e, titre, actions = '') {
    const t = auj();
    const ty = typeEvt(e.type);
    const jours = e.nbJours > 1 ? ` au ${fmt(R.finEvenement(e), { day: 'numeric', month: 'long' })}` : '';
    return `
      <div class="evt-bandeau" style="--c:${couleur(ty.couleur)};--t:${texteSur(ty.couleur)}">
        <label class="evt-choix"><span class="sr-only">Événement</span><select data-action="choisir-evt" aria-label="Événement affiché">${evenementsTries().map((x) => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nom)} · ${R.dateFr(x.date)}${R.evenementPasse(x, t) ? ' (terminé)' : ''}</option>`).join('')}</select></label>
        <span class="evt-info"><b class="rebours">${R.compteRebours(e, t)}</b><span>${fmtLong(e.date)}${jours}${e.heure ? ` · ${e.heure.replace(':', ' h ')}` : ''}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</span></span>
        <button class="btn petit" data-action="evt-modifier" data-id="${e.id}">Modifier</button>
      </div>
      <div class="vue-tete"><div><h1>${titre}</h1></div><div class="actions">${actions}</div></div>`;
  }

  // ----- Tableau de bord -----
  function vueBord() {
    const t = auj();
    const venir = aVenir();
    const passes = evenementsTries().filter((e) => R.evenementPasse(e, t)).reverse();
    const al = R.alertes(E, t);
    const nbRetard = venir.reduce((s, e) => s + R.resumeEvenement(E, e, t).retard, 0);
    const ech = R.echeancier(E, t).filter((x) => x.etat !== 'avenir');
    const totEch = ech.reduce((s, x) => s + x.echeance.montant, 0);
    const invOui = venir.reduce((s, e) => s + R.statsInvites(deEvt(E.invites, e.id)).oui, 0);
    const tuiles = [
      ['Événements à venir', venir.length, '', venir[0] ? `Prochain : ${esc(venir[0].nom)} (${R.compteRebours(venir[0], t)})` : 'Aucun événement programmé.', 'var(--bleu)', 'rond'],
      ['Tâches en retard', nbRetard, '', 'Tous événements à venir confondus.', 'var(--rouge)', ''],
      ['Paiements à suivre', ech.length, '', ech.length ? `${eur(totEch)} en retard ou sous 14 jours.` : 'Rien d\'urgent sous 14 jours.', 'var(--jaune)', ''],
      ['Invités confirmés', invOui, '', 'Réponses « oui » des événements à venir.', 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const cartes = venir.map((e) => carteEvenement(e, t)).join('');
    const charge = R.chargeResponsables(E, t).filter((r) => venir.length);
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.structure || 'Tableau de bord')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${venir.length ? `${pluriel(venir.length, 'événement')} en cours de préparation.` : 'Aucun événement à venir.'}</h1></div>
        <div class="actions"><button class="btn primaire" data-action="evt-nouveau">${ICONES.plus}Nouvel événement</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Événements à venir <span>Du plus proche au plus lointain.</span></h2>
      ${venir.length ? `<div class="evts">${cartes}</div>` : vueSansEvenement()}
      <div class="bord-bas">
        <section><h2 class="titre-section">Alertes <span>${al.length ? 'Les plus urgentes d\'abord.' : ''}</span></h2>${al.length ? `<ul class="alertes">${al.slice(0, 12).map(ligneAlerte).join('')}</ul>${al.length > 12 ? `<p class="aide">Et ${pluriel(al.length - 12, 'autre alerte')}.</p>` : ''}` : '<p class="ligne-vide">Aucune alerte : tout est à jour.</p>'}</section>
        <section><h2 class="titre-section">Charge par responsable <span>Tâches ouvertes</span></h2>${charge.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Responsable</th><th class="nb">Ouvertes</th><th class="nb">Cette semaine</th><th class="nb">En retard</th></tr></thead><tbody>${charge.map((r) => `<tr><td>${esc(r.nom)}</td><td class="nb">${r.ouvertes}</td><td class="nb">${r.semaine}</td><td class="nb ${r.retard ? 'rouge-t' : ''}">${r.retard}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ligne-vide">Aucune tâche ouverte.</p>'}</section>
      </div>
      ${passes.length ? `<details class="faites"><summary>Événements terminés (${passes.length})</summary>${passes.map((e) => { const r = R.resumeEvenement(E, e, t); return `<div class="ligne-faite" style="--c:${couleur(typeEvt(e.type).couleur)}"><i></i><span><b>${esc(e.nom)}</b> · ${R.dateFr(e.date)} · ${r.faites}/${r.taches} tâches · payé ${eur(r.budget.paye)} sur ${eur(r.budget.engage)} engagés</span><button class="btn petit" data-action="ouvrir-evt" data-id="${e.id}" data-vue="budget">Ouvrir</button></div>`; }).join('')}</details>` : ''}`;
  }

  function carteEvenement(e, t) {
    const r = R.resumeEvenement(E, e, t);
    const ty = typeEvt(e.type);
    const ref = r.budgetCible || r.budget.prevu;
    const pctEng = ref ? Math.min(100, Math.round((r.budget.engage / ref) * 100)) : 0;
    const pctPaye = ref ? Math.min(100, Math.round((r.budget.paye / ref) * 100)) : 0;
    return `
      <article class="evt" style="--c:${couleur(ty.couleur)};--t:${texteSur(ty.couleur)}">
        <div class="evt-tete"><div><p class="evt-type">${esc(ty.nom)}</p><h3>${esc(e.nom)}</h3><p>${fmt(e.date, { weekday: 'short', day: 'numeric', month: 'long' })}${e.nbJours > 1 ? ` · ${e.nbJours} jours` : ''}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p></div><b class="rebours">${r.rebours}</b></div>
        <div class="evt-corps">
          <div class="evt-ligne"><span>Rétroplanning</span><b>${r.faites}/${r.taches} faites${r.retard ? ` · <em class="rouge-t">${r.retard} en retard</em>` : ''}</b></div>
          <div class="jauge" role="img" aria-label="Avancement ${r.avancement} %"><i style="width:${r.avancement}%"></i></div>
          <div class="evt-ligne"><span>Budget engagé</span><b>${eur(r.budget.engage)} / ${ref ? eur(ref) : 'non chiffré'}${r.depassements ? ` · <em class="rouge-t">${pluriel(r.depassements, 'dépassement')}</em>` : ''}</b></div>
          <div class="jauge double" role="img" aria-label="Payé ${pctPaye} %, engagé ${pctEng} % du ${r.budgetCible ? 'budget cible' : 'prévu'}"><i class="eng" style="width:${pctEng}%"></i><i style="width:${pctPaye}%"></i></div>
          <div class="evt-ligne"><span>Invités</span><b>${r.invites.oui} oui · ${r.invites.attente} en attente · ${r.invites.non} non</b></div>
          <div class="evt-ligne"><span>Prochain paiement</span><b>${r.prochaineEcheance ? `${eur(r.prochaineEcheance.echeance.montant)} ${r.prochaineEcheance.etat === 'retard' ? `<em class="rouge-t">en retard (${quand(r.prochaineEcheance.echeance.date)})</em>` : quand(r.prochaineEcheance.echeance.date)}` : 'aucun'}</b></div>
        </div>
        <div class="evt-pied">${[['retro', 'Rétroplanning'], ['budget', 'Budget'], ['invites', 'Invités'], ['jourj', 'Jour J']].map(([v, l]) => `<button class="btn petit" data-action="ouvrir-evt" data-id="${e.id}" data-vue="${v}">${l}</button>`).join('')}</div>
      </article>`;
  }

  function ligneAlerte(a) {
    const nom = esc(a.evt.nom);
    const txt = {
      taches: () => `${pluriel(a.n, 'tâche')} en retard (depuis ${quand(a.date)})`,
      paiement: () => `${a.jours < 0 ? 'Paiement en retard' : 'Paiement'} : ${esc(a.echeance.libelle || 'échéance')} ${eur(a.echeance.montant)} à ${esc(presta(a.contrat.prestaId)?.nom || 'prestataire')}, ${a.jours < 0 ? `dû ${quand(a.date)}` : quand(a.date)}`,
      budget: () => `Dépassement de ${eur(a.ecart)} sur « ${esc(a.poste.nom)} »`,
      cible: () => `Engagé au-delà du budget cible de ${eur(a.ecart)}`,
      planifier: () => `${eur(a.ecart)} restent à planifier dans l'échéancier de ${esc(presta(a.contrat.prestaId)?.nom || 'un contrat')}`,
    }[a.type]();
    const vueCible = a.type === 'taches' ? 'retro' : 'budget';
    return `<li class="alerte ${a.gravite ? '' : 'grave'}"><i></i><span><b>${nom}</b> · ${txt}</span><button class="btn petit" data-action="ouvrir-evt" data-id="${a.evt.id}" data-vue="${vueCible}">Voir</button></li>`;
  }

  // ----- Rétroplanning -----
  function vueRetro(e) {
    const t = auj();
    const toutes = deEvt(E.taches, e.id);
    const resps = [...new Set(toutes.map((x) => (x.responsable || '').trim()).filter(Boolean))].sort();
    let liste = toutes;
    if (!ui.retroTout) liste = liste.filter((x) => !x.faite);
    if (ui.resp) liste = liste.filter((x) => (ui.resp === '-' ? !(x.responsable || '').trim() : x.responsable === ui.resp));
    const groupes = B.periodes.map(() => []);
    liste.forEach((x) => groupes[R.periode(x, e, B.periodes)].push(x));
    groupes.forEach((g) => g.sort((a, b) => R.echeance(a, e).localeCompare(R.echeance(b, e)) || a.titre.localeCompare(b.titre)));
    const r = R.resumeEvenement(E, e, t);
    const contenu = groupes.map((g, i) => (g.length ? `<h2 class="titre-section">${B.periodes[i].nom} <span>${pluriel(g.length, 'tâche')}</span></h2><ul class="taches">${g.map((x) => ligneTache(x, e, t)).join('')}</ul>` : '')).join('');
    return `
      ${enteteEvenement(e, 'Rétroplanning', `<button class="btn" data-action="modele">Appliquer un rétroplanning type</button><button class="btn primaire" data-action="tache-nouvelle">${ICONES.plus}Tâche</button>`)}
      <div class="resume-retro"><p><b>${r.faites}/${r.taches}</b> tâches faites${r.retard ? ` · <b class="rouge-t">${r.retard} en retard</b>` : ''}${r.semaine ? ` · ${r.semaine} cette semaine` : ''}</p><div class="jauge" role="img" aria-label="Avancement ${r.avancement} %"><i style="width:${r.avancement}%"></i></div></div>
      <div class="filtres">
        <div class="segment" role="group" aria-label="Tâches affichées"><button data-action="retro-tout" data-v="0" aria-pressed="${!ui.retroTout}">À faire</button><button data-action="retro-tout" data-v="1" aria-pressed="${ui.retroTout}">Toutes</button></div>
        <label class="champ compact">Responsable<select data-action="filtre-resp"><option value="">Tous</option>${resps.map((n) => `<option ${ui.resp === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="-" ${ui.resp === '-' ? 'selected' : ''}>Sans responsable</option></select></label>
      </div>
      <p class="aide">Les échéances sont calculées depuis la date de l'événement (J-45 = 45 jours avant) : modifier la date de l'événement décale tout le rétroplanning. Délais des modèles indicatifs, à adapter.</p>
      ${contenu || `<div class="vide-etat">${FORME_VIDE}<div><h3>${toutes.length ? 'Rien à afficher avec ces filtres.' : 'Aucune tâche'}</h3><p>${toutes.length ? 'Toutes les tâches filtrées sont faites.' : 'Applique un rétroplanning type (séminaire, salon, soirée de lancement) ou ajoute tes tâches une à une.'}</p><div class="actions">${toutes.length ? '<button class="btn" data-action="retro-tout" data-v="1">Afficher toutes les tâches</button>' : '<button class="btn primaire" data-action="modele">Appliquer un rétroplanning type</button>'}</div></div></div>`}`;
  }
  function ligneTache(x, e, t) {
    const s = R.statutTache(x, e, t);
    const ech = R.echeance(x, e);
    const rel = x.dateFixe ? 'date fixe' : R.libelleRelatif(x.avant);
    const etiq = s.statut === 'faite' ? `<span class="etiquette">Faite ${quand(x.faite)}</span>` : s.statut === 'retard' ? `<span class="etiquette rouge">En retard · ${s.retard} j</span>` : s.statut === 'semaine' ? '<span class="etiquette jaune">Cette semaine</span>' : '';
    return `<li class="tache ${s.statut}">
      <button class="coche" data-action="cocher" data-id="${x.id}" aria-pressed="${Boolean(x.faite)}" aria-label="${x.faite ? 'Marquer à faire' : 'Marquer faite'} : ${esc(x.titre)}">${x.faite ? ICONES.coche : ''}</button>
      <button class="tache-corps" data-action="tache-modifier" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${fmt(ech)} · ${rel} · ${esc(phase(x.phase).nom)}${x.responsable ? ` · <strong>${esc(x.responsable)}</strong>` : ''}${x.note ? ` · ${esc(x.note)}` : ''}</span></button>
      <span class="tache-etat">${etiq}</span></li>`;
  }

  // ----- Budget -----
  function vueBudget(e) {
    const t = auj();
    const b = R.budget(E, e.id);
    const conv = E.reglages.convention;
    const contrats = deEvt(E.contrats, e.id);
    const ech = R.echeancier(E, t, e.id);
    const payees = contrats.flatMap((c) => c.echeances.filter((x) => x.payeLe).map((x) => ({ c, x }))).sort((a, z) => z.x.payeLe.localeCompare(a.x.payeLe));
    const cible = e.budgetCible ? `<p class="aide">Budget cible : <b>${eur(e.budgetCible)}</b> · engagé ${eur(b.total.engage)} (${Math.round((b.total.engage / e.budgetCible) * 100)} %) · prévu ${eur(b.total.prevu)}${b.total.prevu > e.budgetCible ? ` · <b class="rouge-t">le prévu dépasse la cible de ${eur(b.total.prevu - e.budgetCible)}</b>` : ''}.</p>` : '';
    const tuiles = [
      ['Prévu', b.total.prevu, 'Somme des postes.', 'var(--jaune)', ''],
      ['Engagé', b.total.engage, `Contrats signés · écart ${b.total.ecart > 0 ? '+' : ''}${eur(b.total.ecart)}`, 'var(--bleu)', 'rond'],
      ['Payé', b.total.paye, 'Échéances réglées.', 'var(--encre)', ''],
      ['Reste à payer', b.total.reste, ech.some((x) => x.etat === 'retard') ? 'Dont des échéances en retard.' : 'Sur les contrats signés.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib} (${conv})</p><b class="montant">${eur(v)}</b><span>${d}</span></div>`).join('');
    const lignes = [...b.lignes, ...(b.nonAffecte ? [b.nonAffecte] : [])];
    return `
      ${enteteEvenement(e, 'Budget et prestataires', `<button class="btn" data-action="poste-nouveau">${ICONES.plus}Poste</button><button class="btn primaire" data-action="contrat-nouveau">${ICONES.plus}Contrat</button>`)}
      <div class="tuiles">${tuiles}</div>
      ${cible}
      <h2 class="titre-section">Par poste <span>Engagé = contrats signés ; payé = échéances réglées.</span></h2>
      ${lignes.length ? `<figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Payé, engagé et prévu par poste</h2><div class="legende"><span><i style="background:var(--encre)"></i>Payé</span><span><i style="background:var(--bleu)"></i>Engagé non payé</span><span><i class="repere"></i>Prévu</span></div></div>
        ${barresBudget(lignes)}
        <div class="infobulle" hidden></div>
      </figure>
      <div class="defile"><table class="tableau budget-table"><caption class="sr-only">Budget par poste</caption><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Engagé</th><th class="nb">Payé</th><th class="nb">Reste à payer</th><th class="nb">Écart</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${lignes.map((l) => `<tr class="${l.depassement ? 'depasse' : ''}"><td>${l.poste ? esc(l.poste.nom) : '<em>Non affecté</em>'}</td><td class="nb">${l.poste ? eur(l.prevu) : '–'}</td><td class="nb">${eur(l.engage)}</td><td class="nb">${eur(l.paye)}</td><td class="nb">${eur(l.reste)}</td><td class="nb ${l.depassement ? 'rouge-t' : ''}">${l.poste && l.prevu ? `${l.ecart > 0 ? '+' : ''}${eur(l.ecart)}` : '–'}</td><td>${l.poste ? `<button class="btn lien" data-action="poste-modifier" data-id="${l.poste.id}">Modifier</button>` : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><th>Total</th><th class="nb">${eur(b.total.prevu)}</th><th class="nb">${eur(b.total.engage)}</th><th class="nb">${eur(b.total.paye)}</th><th class="nb">${eur(b.total.reste)}</th><th class="nb">${b.total.ecart > 0 ? '+' : ''}${eur(b.total.ecart)}</th><th></th></tr></tfoot></table></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun poste</h3><p>Ajoute les postes types (sans montant) puis saisis ton prévu.</p><div class="actions"><button class="btn primaire" data-action="postes-types">Ajouter les postes types</button></div></div></div>`}
      ${lignes.length ? '<p class="rang-actions"><button class="btn petit" data-action="postes-types">Ajouter des postes types</button></p>' : ''}
      <h2 class="titre-section">Contrats <span>${pluriel(contrats.length, 'contrat')} · documents référencés en texte</span></h2>
      ${contrats.length ? `<div class="contrats">${[...contrats].sort((a, z) => ORDRE_CONTRAT.indexOf(a.statut) - ORDRE_CONTRAT.indexOf(z.statut)).map((c) => carteContrat(c, t)).join('')}</div>` : '<p class="ligne-vide">Aucun contrat. Ajoute un prestataire consulté, son devis puis le contrat signé et son échéancier d\'acomptes.</p>'}
      <h2 class="titre-section">Échéancier <span>Paiements à venir de cet événement</span></h2>
      ${ech.length ? `<ul class="alertes">${ech.map((x) => `<li class="alerte ${x.etat === 'retard' ? 'grave' : x.etat === 'proche' ? 'proche' : 'calme'}"><i></i><span><b>${fmt(x.echeance.date)}</b> · ${esc(presta(x.contrat.prestaId)?.nom || 'Prestataire')} · ${esc(x.echeance.libelle || 'Échéance')} · <b>${eur(x.echeance.montant)}</b>${x.etat === 'retard' ? ` · <em class="rouge-t">en retard de ${pluriel(-x.jours, 'jour')}</em>` : ''}</span><button class="btn petit" data-action="payer" data-contrat="${x.contrat.id}" data-id="${x.echeance.id}">Payée</button></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun paiement à venir.</p>'}
      ${payees.length ? `<details class="faites"><summary>Paiements effectués (${payees.length})</summary>${payees.map(({ c, x }) => `<div class="ligne-faite" style="--c:var(--encre)"><i></i><span>${R.dateFr(x.payeLe)} · ${esc(presta(c.prestaId)?.nom || '')} · ${esc(x.libelle)} · <b>${eur(x.montant)}</b>${c.statut === 'annule' ? ' (contrat annulé)' : ''}</span><button class="btn petit" data-action="depayer" data-contrat="${c.id}" data-id="${x.id}">Annuler le paiement</button></div>`).join('')}</details>` : ''}
      <h2 class="titre-section">Carnet des prestataires <span>Commun à tous les événements</span></h2>
      ${E.prestataires.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Prestataire</th><th>Métier</th><th>Contact</th><th>Téléphone</th><th>E-mail</th><th class="nb">Contrats</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${[...E.prestataires].sort((a, z) => a.nom.localeCompare(z.nom)).map((p) => `<tr><td><b>${esc(p.nom)}</b></td><td>${esc(p.metier)}</td><td>${esc(p.contact)}</td><td>${p.tel ? `<a href="tel:${esc(p.tel.replace(/\s/g, ''))}">${esc(p.tel)}</a>` : ''}</td><td>${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}</td><td class="nb">${E.contrats.filter((c) => c.prestaId === p.id).length}</td><td><button class="btn lien" data-action="presta-modifier" data-id="${p.id}">Modifier</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      <p class="rang-actions"><button class="btn petit" data-action="presta-nouveau">${ICONES.plus}Prestataire</button></p>
      <p class="aide">Outil de suivi : les montants sont ceux que tu saisis (${conv}) ; les contrats et factures font foi.</p>`;
  }
  const ORDRE_CONTRAT = ['signe', 'devis', 'consulte', 'annule'];
  function carteContrat(c, t) {
    const p = presta(c.prestaId);
    const info = R.infoContrat(c);
    const st = statutContrat(c.statut);
    const cl = { consulte: '', devis: 'jaune', signe: 'bleu', annule: 'rouge' }[c.statut];
    const poste = E.postes.find((x) => x.id === c.posteId);
    return `<article class="contrat ${c.statut}">
      <div class="contrat-tete"><div><h3>${esc(p?.nom || 'Prestataire supprimé')}</h3><p>${esc(c.objet || 'Sans objet')}${poste ? ` · ${esc(poste.nom)}` : ' · non affecté'}</p></div><span class="etiquette ${cl}">${st.nom}</span></div>
      <div class="contrat-corps">
        <p class="contrat-montant"><b>${eur(c.montant)}</b>${info.paye ? ` · payé ${eur(info.paye)}` : ''}</p>
        ${c.documents ? `<p class="doc">Documents : ${esc(c.documents)}</p>` : ''}
        ${info.aPlanifier ? `<p class="avert">${eur(info.aPlanifier)} ${info.aPlanifier > 0 ? 'restent à planifier dans l\'échéancier' : 'planifiés en trop par rapport au montant'}.</p>` : ''}
        ${c.echeances.length ? `<ul class="echeances">${[...c.echeances].sort((a, z) => (a.date || '').localeCompare(z.date || '')).map((x) => `<li class="${x.payeLe ? 'payee' : x.date && x.date < t ? 'retard' : ''}"><span>${esc(x.libelle || 'Échéance')}</span><span>${x.date ? R.dateFr(x.date) : 'sans date'}</span><b>${eur(x.montant)}</b><span>${x.payeLe ? `payée le ${R.dateFr(x.payeLe)}` : x.date && x.date < t ? 'en retard' : 'à payer'}</span></li>`).join('')}</ul>` : ''}
      </div>
      <div class="contrat-pied"><button class="btn petit" data-action="contrat-modifier" data-id="${c.id}">Modifier et échéancier</button></div>
    </article>`;
  }
  // Barres horizontales (HTML) : payé, engagé non payé, repère du prévu ; valeurs écrites.
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
    const e = evtCourant();
    const b = R.budget(E, e.id);
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

  // ----- Invités -----
  function vueInvites(e) {
    const tous = deEvt(E.invites, e.id);
    const s = R.statsInvites(tous, B.regimes);
    const q = ui.q.trim().toLowerCase();
    const liste = R.trierInvites(tous.filter((i) => (!ui.cat || i.categorie === ui.cat) && (!ui.rep || i.reponse === ui.rep)
      && (!q || `${i.prenom} ${i.nom} ${i.societe} ${i.fonction}`.toLowerCase().includes(q))));
    const jourJ = ecart(auj(), e.date) <= 0 && !R.evenementPasse(e, auj());
    const tuiles = [
      ['Invités', s.total, `${s.couverts} couverts à prévoir (oui + en attente).`, 'var(--encre)', ''],
      ['Oui', s.oui, `${s.tauxPresence === null ? 'Aucun présent pointé.' : `${s.presents} présents pointés (${s.tauxPresence} %).`}`, 'var(--bleu)', 'rond'],
      ['En attente', s.attente, 'À relancer.', 'var(--jaune)', ''],
      ['Non', s.non, 'Ont décliné.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const regimes = Object.entries(s.regimes).sort((a, z) => z[1] - a[1]);
    const cats = B.categories.filter((c) => s.parCategorie[c.id]);
    return `
      ${enteteEvenement(e, 'Invités et inscriptions', `<button class="btn" data-action="invites-rapide">Saisie rapide</button><button class="btn primaire" data-action="invite-nouveau">${ICONES.plus}Invité</button>`)}
      <div class="rgpd"><b>Données personnelles</b> Régimes alimentaires, allergies et besoins d'accessibilité sont des <strong>données sensibles</strong> (santé, convictions) : ne les note qu'avec l'accord explicite de l'invité et seulement s'ils sont utiles à l'organisation. Partage la clé avec l'équipe d'organisation uniquement, efface ces données après l'événement (Réglages). <a href="${B.rgpd.url}" target="_blank" rel="noopener">Définition CNIL</a>.</div>
      <div class="tuiles">${tuiles}</div>
      <div class="invites-synthese">
        <section class="bloc"><h3>Pour le traiteur</h3>${regimes.length ? `<ul class="compteurs">${regimes.map(([r, n]) => `<li><span>${esc(r)}</span><b>${n}</b></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun couvert.</p>'}<p class="note">Sur ${pluriel(s.couverts, 'couvert')} (oui + en attente).</p></section>
        <section class="bloc"><h3>Accessibilité</h3>${s.accessibilite.length ? `<ul class="compteurs">${s.accessibilite.map((i) => `<li><span>${esc(i.prenom)} ${esc(i.nom)}</span><b class="petit">${esc(i.accessibilite)}</b></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun besoin signalé.</p>'}<p class="note">À transmettre au lieu.</p></section>
        <section class="bloc"><h3>Par catégorie</h3>${cats.length ? `<ul class="compteurs">${cats.map((c) => `<li><span class="pastille-cat" style="--c:${couleur(c.couleur)}"><i></i>${esc(c.nom)}</span><b>${s.parCategorie[c.id].oui}/${s.parCategorie[c.id].total}</b></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun invité.</p>'}<p class="note">Oui / invités.</p></section>
      </div>
      <div class="filtres">
        <label class="champ compact grand">Rechercher<input type="search" id="recherche" value="${esc(ui.q)}" placeholder="Nom, société…"></label>
        <label class="champ compact">Catégorie<select data-action="filtre-cat"><option value="">Toutes</option>${B.categories.map((c) => `<option value="${c.id}" ${ui.cat === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ compact">Réponse<select data-action="filtre-rep"><option value="">Toutes</option><option value="oui" ${ui.rep === 'oui' ? 'selected' : ''}>Oui</option><option value="attente" ${ui.rep === 'attente' ? 'selected' : ''}>En attente</option><option value="non" ${ui.rep === 'non' ? 'selected' : ''}>Non</option></select></label>
        <span class="rang"><button class="btn petit" data-action="badges" ${s.oui ? '' : 'disabled'}>Imprimer les badges (${s.oui})</button><button class="btn petit" data-action="csv" ${tous.length ? '' : 'disabled'}>Exporter la liste (CSV)</button></span>
      </div>
      <p class="compte-liste" id="compte-liste">${pluriel(liste.length, 'invité affiché', 'invités affichés')}${jourJ ? ' · jour J : pointe les arrivées' : ''}</p>
      ${tous.length ? `<ul class="invites" id="liste-invites">${liste.map((i) => ligneInvite(i, jourJ)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun invité</h3><p>Colle ta liste d'un coup (un invité par ligne : « Prénom Nom ; Société ; Fonction ») ou ajoute-les un par un.</p><div class="actions"><button class="btn primaire" data-action="invites-rapide">Saisie rapide</button></div></div></div>`}`;
  }
  function ligneInvite(i, jourJ) {
    const c = categorie(i.categorie);
    const sensible = i.regime || i.accessibilite;
    return `<li class="invite" data-texte="${esc(`${i.prenom} ${i.nom} ${i.societe} ${i.fonction}`.toLowerCase())}">
      <span class="cat-bande" style="--c:${couleur(c.couleur)}"></span>
      <button class="invite-corps" data-action="invite-modifier" data-id="${i.id}"><b>${esc(i.prenom)} ${esc(i.nom)}</b><span>${[i.fonction, i.societe].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</span><span class="cat-nom">${esc(c.nom)}${sensible ? ' · <em>informations sensibles</em>' : ''}</span></button>
      <div class="reponse" role="group" aria-label="Réponse de ${esc(i.prenom)} ${esc(i.nom)}">${[['oui', 'Oui'], ['attente', '?'], ['non', 'Non']].map(([v, l]) => `<button data-action="repondre" data-id="${i.id}" data-v="${v}" class="r-${v}" aria-pressed="${i.reponse === v}" ${v === 'attente' ? 'aria-label="En attente"' : ''}>${l}</button>`).join('')}</div>
      ${i.reponse === 'oui' || jourJ ? `<button class="present ${i.present ? 'oui' : ''}" data-action="present" data-id="${i.id}" aria-pressed="${i.present}">${i.present ? `${ICONES.coche}Présent` : 'Arrivé ?'}</button>` : '<span></span>'}
    </li>`;
  }
  function brancherRecherche() {
    const champ = $('#recherche');
    if (!champ) return;
    champ.addEventListener('input', () => {
      ui.q = champ.value;
      const q = ui.q.trim().toLowerCase();
      let n = 0;
      document.querySelectorAll('#liste-invites .invite').forEach((li) => { const ok = !q || li.dataset.texte.includes(q); li.hidden = !ok; if (ok) n++; });
      $('#compte-liste').textContent = pluriel(n, 'invité affiché', 'invités affichés');
    });
  }

  // ----- Jour J -----
  function vueJourJ(e) {
    const t = auj();
    const nb = Math.max(1, e.nbJours || 1);
    if (ui.jour > nb) ui.jour = 1;
    const items = deEvt(E.conducteur, e.id);
    const c = R.conducteur(items).filter((x) => x.jour === ui.jour);
    const jourDate = ajout(e.date, ui.jour - 1);
    const estAujourdhui = jourDate === t;
    const ec = estAujourdhui ? R.enCours(items, ui.jour, maintenant()) : null;
    const chk = deEvt(E.checklist, e.id).sort((a, z) => (a.heure || '99').localeCompare(z.heure || '99'));
    const faits = chk.filter((x) => x.fait).length;
    const chev = c.filter((x) => x.chevauche).length;
    const direct = estAujourdhui ? `<div class="direct">
        <div class="direct-bloc rouge"><p class="surtitre">En cours · ${R.hm(maintenant())}</p>${ec.courante ? `<h3>${esc(ec.courante.titre)}</h3><p>${R.hm(ec.courante.debut)} – ${R.hm(ec.courante.fin)}${ec.courante.lieu ? ` · ${esc(ec.courante.lieu)}` : ''}${ec.courante.responsable ? ` · ${esc(ec.courante.responsable)}` : ''}</p>` : '<h3>Aucune séquence</h3><p>Rien au conducteur à cette heure.</p>'}</div>
        <div class="direct-bloc"><p class="surtitre">Ensuite</p>${ec.suivante ? `<h3>${esc(ec.suivante.titre)}</h3><p>à ${R.hm(ec.suivante.debut)} (dans ${ec.suivante.debut - maintenant()} min)${ec.suivante.lieu ? ` · ${esc(ec.suivante.lieu)}` : ''}</p>` : '<h3>Fin du conducteur</h3><p>Plus de séquence aujourd\'hui.</p>'}</div>
      </div>` : '';
    return `
      ${enteteEvenement(e, 'Jour J', `<button class="btn" data-action="imprimer-conducteur" ${c.length ? '' : 'disabled'}>Imprimer le conducteur</button><button class="btn primaire" data-action="sequence-nouvelle">${ICONES.plus}Séquence</button>`)}
      ${direct}
      ${nb > 1 ? `<div class="segment jours" role="group" aria-label="Jour">${Array.from({ length: nb }, (_, i) => `<button data-action="jour" data-v="${i + 1}" aria-pressed="${ui.jour === i + 1}">Jour ${i + 1} · ${fmt(ajout(e.date, i), { day: 'numeric', month: 'short' })}</button>`).join('')}</div>` : ''}
      <div class="jourj">
        <section>
          <h2 class="titre-section">Conducteur <span>${fmt(jourDate, { weekday: 'long', day: 'numeric', month: 'long' })} · ${pluriel(c.length, 'séquence')}${chev ? ` · <b class="rouge-t">${pluriel(chev, 'chevauchement')}</b>` : ''}</span></h2>
          ${c.length ? `<ol class="conducteur">${c.map((x) => {
            const passe = estAujourdhui && x.fin <= maintenant();
            const actif = estAujourdhui && ec.courante?.id === x.id;
            return `<li class="${x.chevauche ? 'chevauche' : ''} ${passe ? 'passe' : ''} ${actif ? 'actif' : ''}">
              <span class="heure"><b>${R.hm(x.debut)}</b><small>${R.hm(x.fin)}</small></span>
              <button class="seq-corps" data-action="sequence-modifier" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${x.duree} min${x.lieu ? ` · ${esc(x.lieu)}` : ''}${x.responsable ? ` · <strong>${esc(x.responsable)}</strong>` : ''}</span>${x.notes ? `<span class="notes">${esc(x.notes)}</span>` : ''}${x.chevauche ? `<span class="etiquette rouge">Chevauche « ${esc(c.find((y) => y.id === x.chevauche)?.titre || '')} »</span>` : ''}</button>
              <button class="btn petit" data-action="decaler" data-id="${x.id}" aria-label="Décaler ${esc(x.titre)} et les suivantes">Décaler</button>
            </li>`;
          }).join('')}</ol>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Conducteur vide</h3><p>Ajoute les séquences minute par minute, ou pars du conducteur type de cet événement.</p><div class="actions"><button class="btn primaire" data-action="conducteur-type">Ajouter le conducteur type</button></div></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Checklist <span>${faits}/${chk.length} faits</span></h2>
          ${chk.length ? `<div class="jauge" role="img" aria-label="${faits} sur ${chk.length}"><i style="width:${chk.length ? (faits / chk.length) * 100 : 0}%"></i></div><ul class="checklist">${chk.map((x) => `<li class="${x.fait ? 'fait' : ''}"><button class="coche" data-action="check" data-id="${x.id}" aria-pressed="${x.fait}" aria-label="${esc(x.libelle)}">${x.fait ? ICONES.coche : ''}</button><button class="check-corps" data-action="check-modifier" data-id="${x.id}"><b>${esc(x.libelle)}</b>${x.heure || x.responsable ? `<span>${x.heure ? esc(x.heure) : ''}${x.heure && x.responsable ? ' · ' : ''}${esc(x.responsable)}</span>` : ''}</button></li>`).join('')}</ul>` : '<p class="ligne-vide">Checklist vide.</p>'}
          <p class="rang-actions"><button class="btn petit" data-action="check-nouveau">${ICONES.plus}Point</button>${chk.length < B.checklist.length ? '<button class="btn petit" data-action="checklist-type">Ajouter la checklist type</button>' : ''}${chk.some((x) => x.fait) ? '<button class="btn petit" data-action="checklist-raz">Tout décocher</button>' : ''}</p>
        </section>
      </div>`;
  }

  // ---------- Impression (badges, conducteur) ----------
  function imprimer(html, classe) {
    const zone = $('#impression');
    zone.innerHTML = html;
    document.body.classList.add('impression', classe);
    const fin = () => { document.body.classList.remove('impression', classe); zone.innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 1000); }, 50);
  }
  function imprimerBadges(e) {
    const pages = R.pagesBadges(deEvt(E.invites, e.id));
    imprimer(pages.map((p) => `<section class="page-badges">${p.map((i) => { const c = categorie(i.categorie); return `<div class="badge" style="--c:${couleur(c.couleur)};--t:${texteSur(c.couleur)}"><p class="badge-evt">${esc(e.nom)}</p><p class="badge-nom"><span>${esc(i.prenom)}</span> ${esc(i.nom)}</p><p class="badge-soc">${esc(i.societe)}</p><p class="badge-cat">${esc(c.nom)}</p></div>`; }).join('')}</section>`).join(''), 'imp-badges');
  }
  function imprimerConducteur(e) {
    const c = R.conducteur(deEvt(E.conducteur, e.id)).filter((x) => x.jour === ui.jour);
    imprimer(`<h1>${esc(e.nom)} · conducteur</h1><p>${fmtLong(ajout(e.date, ui.jour - 1))}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p><table><thead><tr><th>Début</th><th>Fin</th><th>Séquence</th><th>Lieu</th><th>Responsable</th><th>Notes</th></tr></thead><tbody>${c.map((x) => `<tr><td>${R.hm(x.debut)}</td><td>${R.hm(x.fin)}</td><td>${esc(x.titre)}${x.chevauche ? ' (chevauchement)' : ''}</td><td>${esc(x.lieu)}</td><td>${esc(x.responsable)}</td><td>${esc(x.notes)}</td></tr>`).join('')}</tbody></table>`, 'imp-conducteur');
  }
  function exporterCsv(e, avecSensibles) {
    const csv = R.csvInvites(deEvt(E.invites, e.id), (id) => categorie(id).nom, avecSensibles);
    telecharger(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `invites-${e.nom.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`);
  }
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
  // Mémorise l'état pour « Annuler » dans le toast.
  const memo = () => { annulation = structuredClone(E); };
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre(); toast('Action annulée.');
  }
  const fait = (message, avecAnnuler = true) => { sauver(); rendre(); toast(message, avecAnnuler ? { libelle: 'Annuler', faire: annuler } : null); };

  function modaleEvenement(id) {
    const e = id ? evt(id) : null;
    const nbLie = e ? deEvt(E.taches, e.id).length + deEvt(E.invites, e.id).length + deEvt(E.contrats, e.id).length : 0;
    ouvrirModale(e ? 'Modifier l\'événement' : 'Nouvel événement', `${champsEvenement(e || {}, !e)}${e ? `<label class="champ">Notes<textarea name="notes" maxlength="2000">${esc(e.notes)}</textarea></label><p class="aide">Changer la date décale toutes les échéances relatives (J-n) du rétroplanning ; les dates fixes ne bougent pas.</p>` : ''}`,
      e ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>` : piedSimple(null, 'Créer'),
      (f, action) => {
        if (action === 'supprimer') {
          if (!confirm(`Supprimer « ${e.nom} » et tout ce qui s'y rattache (${pluriel(nbLie, 'élément')}) ?`)) return '';
          memo();
          E.evenements = E.evenements.filter((x) => x.id !== e.id);
          for (const k of ['taches', 'postes', 'contrats', 'invites', 'conducteur', 'checklist']) E[k] = E[k].filter((x) => x.evtId !== e.id);
          ui.evtId = null; memoUi();
          fait(`« ${e.nom} » supprimé.`);
          return;
        }
        const d = lireEvenement(f);
        if (typeof d === 'string') return d;
        if (e && action === 'dupliquer') {
          memo();
          const copie = { ...e, ...d, id: uid(), nom: `${d.nom} (copie)` };
          E.evenements.push(copie);
          for (const k of ['taches', 'postes', 'conducteur', 'checklist']) E[k].push(...deEvt(E[k], e.id).map((x) => ({ ...structuredClone(x), id: uid(), evtId: copie.id, ...(k === 'taches' ? { faite: null, dateFixe: null } : {}), ...(k === 'checklist' ? { fait: false } : {}) })));
          ui.evtId = copie.id; memoUi();
          fait(`Copie créée (rétroplanning, postes, conducteur et checklist ; ni contrats ni invités). Pense à changer sa date.`);
          return;
        }
        if (e) {
          const decale = d.date !== e.date ? ecart(e.date, d.date) : 0;
          memo();
          Object.assign(e, d, { notes: String(f.get('notes') || '') });
          fait(decale ? `Date modifiée : le rétroplanning est décalé de ${pluriel(Math.abs(decale), 'jour')} ${decale > 0 ? 'plus tard' : 'plus tôt'}.` : 'Événement enregistré.');
          return;
        }
        memo();
        const ev = creerEvenement(d, { retro: f.has('retro'), postes: f.has('postes'), conducteur: f.has('conducteur'), checklist: f.has('checklist'), passees: 'aujourdhui' });
        ui.evtId = ev.id; memoUi();
        fait(`« ${ev.nom} » créé : ${pluriel(deEvt(E.taches, ev.id).length, 'tâche')} au rétroplanning.`);
      });
  }

  function modaleTache(id) {
    const e = evtCourant();
    const x = id ? E.taches.find((y) => y.id === id) : null;
    const resps = [...new Set(E.taches.map((y) => (y.responsable || '').trim()).filter(Boolean))].sort();
    const corps = `
      <label class="champ">Tâche<input name="titre" required maxlength="140" value="${esc(x?.titre || '')}"></label>
      <div class="deux">
        <label class="champ">Phase<select name="phase">${B.phases.map((p) => `<option value="${p.id}" ${p.id === (x?.phase || 'cadrage') ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">Responsable<input name="responsable" maxlength="40" list="liste-resp" value="${esc(x?.responsable || '')}"><datalist id="liste-resp">${resps.map((r) => `<option value="${esc(r)}">`).join('')}</datalist></label>
      </div>
      <fieldset class="choix-base"><legend>Échéance</legend>
        <label class="case"><input type="radio" name="mode" value="relatif" ${x?.dateFixe ? '' : 'checked'}> Relative à l'événement :</label>
        <label class="champ inline">Jours avant le ${R.dateFr(e.date)}<small>0 = jour J ; négatif = après l'événement</small><input type="number" name="avant" min="-365" max="730" value="${x ? x.avant : 30}"></label>
        <label class="case"><input type="radio" name="mode" value="fixe" ${x?.dateFixe ? 'checked' : ''}> Date fixe :</label>
        <label class="champ inline">Date<input type="date" name="dateFixe" value="${esc(x?.dateFixe || '')}"></label>
      </fieldset>
      <label class="champ">Note<textarea name="note" maxlength="1000">${esc(x?.note || '')}</textarea></label>
      ${x?.faite ? `<p class="aide">Faite le ${R.dateFr(x.faite)}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier la tâche' : 'Nouvelle tâche', corps, piedSimple(x ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.taches = E.taches.filter((y) => y.id !== x.id); fait(`« ${x.titre} » supprimée.`); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique la tâche.';
      const fixe = f.get('mode') === 'fixe';
      const avant = Number(f.get('avant'));
      if (!fixe && (!Number.isInteger(avant) || avant < -365 || avant > 730)) return 'Jours avant : nombre entier entre -365 et 730.';
      if (fixe && !R.estDate(f.get('dateFixe'))) return 'Indique la date fixe.';
      memo();
      const v = { titre, phase: f.get('phase'), responsable: String(f.get('responsable') || '').trim(), avant: fixe ? (x?.avant ?? ecart(f.get('dateFixe'), e.date)) : avant, dateFixe: fixe ? f.get('dateFixe') : null, note: String(f.get('note') || '').trim() };
      if (x) Object.assign(x, v); else E.taches.push({ id: uid(), evtId: e.id, faite: null, ...v });
      fait(x ? 'Tâche enregistrée.' : `Tâche ajoutée, échéance ${quand(R.echeance(v, e))}.`);
    });
  }

  function modaleModele() {
    const e = evtCourant();
    const t = auj();
    const choix = B.retroplannings[e.type] ? e.type : 'seminaire';
    const corps = `
      <label class="champ">Rétroplanning type<select name="modele">${['seminaire', 'salon', 'lancement'].map((k) => `<option value="${k}" ${k === choix ? 'selected' : ''}>${esc(typeEvt(k).nom)} (${B.retroplannings[k].length} tâches, de ${R.libelleRelatif(B.retroplannings[k][0][2])} à ${R.libelleRelatif(B.retroplannings[k].at(-1)[2])})</option>`).join('')}</select></label>
      <fieldset class="choix-base"><legend>Tâches dont l'échéance est déjà passée <small>L'événement est ${R.compteRebours(e, t)}.</small></legend>
        <label class="case"><input type="radio" name="passees" value="aujourdhui" checked> Les ramener à aujourd'hui</label>
        <label class="case"><input type="radio" name="passees" value="garder"> Les garder (elles apparaîtront en retard)</label>
        <label class="case"><input type="radio" name="passees" value="ignorer"> Ne pas les ajouter</label>
      </fieldset>
      <p class="aide">Les tâches déjà présentes avec le même intitulé ne sont pas dupliquées. Délais indicatifs, rédigés pour le template : adapte-les à ton contexte.</p>`;
    ouvrirModale('Appliquer un rétroplanning type', corps, '<button class="btn primaire" value="ok">Appliquer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      memo();
      const r = R.tachesDepuisModele(B.retroplannings[f.get('modele')], e, t, f.get('passees'), E.taches, uid);
      E.taches.push(...r.taches);
      fait(`${pluriel(r.taches.length, 'tâche ajoutée', 'tâches ajoutées')}${r.passees ? ` (${r.passees} à l'échéance déjà passée)` : ''}.`);
    });
  }

  function modalePoste(id) {
    const e = evtCourant();
    const p = id ? E.postes.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Poste<input name="nom" required maxlength="60" list="postes-types" value="${esc(p?.nom || '')}"><datalist id="postes-types">${B.postes.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <label class="champ">Montant prévu (${E.reglages.convention})<small>Ton estimation pour cet événement.</small><input name="prevu" inputmode="decimal" value="${R.champMontant(p?.prevu ?? null)}" placeholder="Ex. : 12 000"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le poste' : 'Nouveau poste', corps, piedSimple(p ? true : false), (f, action) => {
      if (action === 'supprimer') {
        const n = E.contrats.filter((c) => c.posteId === p.id).length;
        if (n && !confirm(`${pluriel(n, 'contrat')} rattaché(s) à ce poste passera(ont) en « Non affecté ». Continuer ?`)) return '';
        memo(); E.postes = E.postes.filter((x) => x.id !== p.id); E.contrats.forEach((c) => { if (c.posteId === p.id) c.posteId = null; });
        fait(`Poste « ${p.nom} » supprimé.`); return;
      }
      const nom = String(f.get('nom') || '').trim();
      const prevu = R.lireMontant(f.get('prevu'));
      if (!nom) return 'Indique le nom du poste.';
      if (prevu === null || prevu < 0) return 'Montant illisible (ex. : 12 000 ou 12000,50).';
      memo();
      if (p) Object.assign(p, { nom, prevu }); else E.postes.push({ id: uid(), evtId: e.id, nom, prevu });
      fait(p ? 'Poste enregistré.' : `Poste « ${nom} » ajouté.`);
    });
  }
  function modalePostesTypes() {
    const e = evtCourant();
    const deja = new Set(deEvt(E.postes, e.id).map((p) => p.nom.toLowerCase()));
    const suggeres = new Set(B.postesParType[e.type].map((i) => B.postes[i]));
    const dispo = B.postes.filter((n) => !deja.has(n.toLowerCase()));
    if (!dispo.length) { toast('Tous les postes types sont déjà présents.'); return; }
    ouvrirModale('Ajouter des postes types', `<p class="aide">Postes sans montant : saisis ensuite ton prévu, poste par poste.</p><div class="choix-postes">${dispo.map((n) => `<label class="case"><input type="checkbox" name="p" value="${esc(n)}" ${suggeres.has(n) || !deja.size ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`,
      '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const noms = f.getAll('p');
        if (!noms.length) return;
        memo();
        fait(`${pluriel(ajouterPostesTypes(e, noms), 'poste ajouté', 'postes ajoutés')}.`);
      });
  }

  function modalePresta(id, apres) {
    const p = id ? presta(id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(p?.nom || '')}"></label>
      <div class="deux">
        <label class="champ">Métier<select name="metier">${B.metiers.map((m) => `<option ${m === (p?.metier || 'Autre') ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="champ">Contact<small>Fonction ou nom</small><input name="contact" maxlength="60" value="${esc(p?.contact || '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Téléphone<input name="tel" type="tel" maxlength="30" value="${esc(p?.tel || '')}"></label>
        <label class="champ">E-mail<input name="email" type="email" maxlength="80" value="${esc(p?.email || '')}"></label>
      </div>
      <label class="champ">Notes<textarea name="notes" maxlength="1000">${esc(p?.notes || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le prestataire' : 'Nouveau prestataire', corps, piedSimple(p ? true : false), (f, action) => {
      if (action === 'supprimer') {
        const n = E.contrats.filter((c) => c.prestaId === p.id).length;
        if (n) return `Ce prestataire a ${pluriel(n, 'contrat')} : supprime-les d'abord.`;
        memo(); E.prestataires = E.prestataires.filter((x) => x.id !== p.id); fait(`« ${p.nom} » supprimé.`); return;
      }
      const v = { nom: String(f.get('nom') || '').trim(), metier: f.get('metier'), contact: String(f.get('contact') || '').trim(), tel: String(f.get('tel') || '').trim(), email: String(f.get('email') || '').trim(), notes: String(f.get('notes') || '').trim() };
      if (!v.nom) return 'Indique le nom du prestataire.';
      memo();
      let cible = p;
      if (p) Object.assign(p, v); else { cible = { id: uid(), ...v }; E.prestataires.push(cible); }
      sauver(); rendre();
      if (apres) setTimeout(() => apres(cible.id), 50); else toast(p ? 'Prestataire enregistré.' : `« ${v.nom} » ajouté au carnet.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function ligneEcheance(x = {}, i) {
    return `<div class="ech-ligne" data-i="${i}">
      <label class="champ">Libellé<input name="ech-libelle" maxlength="40" value="${esc(x.libelle || '')}" placeholder="Acompte, solde…"></label>
      <label class="champ">Montant<input name="ech-montant" inputmode="decimal" value="${R.champMontant(x.montant ?? null)}"></label>
      <button type="button" class="btn-icone petit" data-action="ech-suppr" aria-label="Retirer cette échéance">×</button>
      <label class="champ">Échéance<input type="date" name="ech-date" value="${esc(x.date || '')}"></label>
      <label class="champ">Payée le<small>Vide si pas encore payée</small><input type="date" name="ech-paye" value="${esc(x.payeLe || '')}"></label>
      <input type="hidden" name="ech-id" value="${esc(x.id || '')}">
    </div>`;
  }
  function modaleContrat(id, prestaChoisi) {
    const e = evtCourant();
    const c = id ? E.contrats.find((x) => x.id === id) : null;
    if (!E.prestataires.length && !c) { modalePresta(null, (pid) => modaleContrat(null, pid)); toast('Ajoute d\'abord le prestataire au carnet.'); return; }
    const postes = deEvt(E.postes, e.id);
    const choixP = c?.prestaId || prestaChoisi || '';
    const corps = `
      <div class="deux">
        <label class="champ">Prestataire<select name="presta" required>${[...E.prestataires].sort((a, z) => a.nom.localeCompare(z.nom)).map((p) => `<option value="${p.id}" ${p.id === choixP ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">Poste<select name="poste"><option value="">Non affecté</option>${postes.map((p) => `<option value="${p.id}" ${p.id === c?.posteId ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
      </div>
      <p class="rang-actions"><button type="button" class="btn lien" data-action="presta-depuis-contrat">Nouveau prestataire…</button></p>
      <label class="champ">Objet<input name="objet" maxlength="120" value="${esc(c?.objet || '')}" placeholder="Ex. : cocktail dînatoire 150 personnes"></label>
      <div class="deux">
        <label class="champ">Montant (${E.reglages.convention})<input name="montant" inputmode="decimal" value="${R.champMontant(c?.montant ?? null)}"></label>
        <label class="champ">Statut<select name="statut">${B.statutsContrat.map((s) => `<option value="${s.id}" ${s.id === (c?.statut || 'devis') ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Documents<small>Références en texte : n° de devis, contrat, emplacement du fichier.</small><textarea name="documents" maxlength="1000">${esc(c?.documents || '')}</textarea></label>
      <fieldset class="choix-base"><legend>Échéancier <small>Acomptes et solde ; seules les échéances payées comptent dans « payé ».</small></legend>
        <div id="echeances">${(c?.echeances || []).map(ligneEcheance).join('')}</div>
        <p class="rang-actions"><button type="button" class="btn petit" data-action="ech-ajout">${ICONES.plus}Échéance</button></p>
        <div class="decoupe">
          <label class="champ">Acompte (%)<input name="pct" type="number" min="1" max="99" placeholder="Selon le contrat"></label>
          <label class="champ">Date de l'acompte<input type="date" name="d1"></label>
          <label class="champ">Date du solde<input type="date" name="d2" value="${esc(e.date)}"></label>
          <button type="button" class="btn petit" data-action="ech-decouper">Générer acompte + solde</button>
        </div>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? 'Modifier le contrat' : 'Nouveau contrat', corps, piedSimple(c ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.contrats = E.contrats.filter((x) => x.id !== c.id); fait('Contrat supprimé.'); return; }
      const montant = R.lireMontant(f.get('montant'));
      if (montant === null || montant < 0) return 'Montant illisible (ex. : 4 500 ou 4500,50).';
      const libs = f.getAll('ech-libelle'), mts = f.getAll('ech-montant'), dates = f.getAll('ech-date'), payes = f.getAll('ech-paye'), ids = f.getAll('ech-id');
      const echeances = [];
      for (let i = 0; i < libs.length; i++) {
        const m = R.lireMontant(mts[i]);
        if (!libs[i].trim() && !mts[i].trim() && !dates[i]) continue;
        if (m === null || m <= 0) return `Échéance ${i + 1} : montant illisible.`;
        echeances.push({ id: ids[i] || uid(), libelle: libs[i].trim() || 'Échéance', montant: m, date: dates[i] || null, payeLe: payes[i] || null });
      }
      memo();
      const v = { prestaId: f.get('presta'), posteId: f.get('poste') || null, objet: String(f.get('objet') || '').trim(), montant, statut: f.get('statut'), documents: String(f.get('documents') || '').trim(), echeances };
      if (c) Object.assign(c, v); else E.contrats.push({ id: uid(), evtId: e.id, ...v });
      const info = R.infoContrat(v);
      fait(info.aPlanifier > 0 ? `Contrat enregistré : ${eur(info.aPlanifier)} restent à planifier.` : 'Contrat enregistré.');
    });
  }

  function modaleInvite(id) {
    const e = evtCourant();
    const i = id ? E.invites.find((x) => x.id === id) : null;
    const corps = `
      <div class="deux">
        <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(i?.prenom || '')}"></label>
        <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(i?.nom || '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Société<input name="societe" maxlength="80" value="${esc(i?.societe || '')}"></label>
        <label class="champ">Fonction<input name="fonction" maxlength="60" value="${esc(i?.fonction || '')}"></label>
      </div>
      <label class="champ">E-mail professionnel<small>Facultatif</small><input name="email" type="email" maxlength="80" value="${esc(i?.email || '')}"></label>
      <div class="deux">
        <label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === (i?.categorie || 'client') ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Réponse<select name="reponse">${[['attente', 'En attente'], ['oui', 'Oui'], ['non', 'Non']].map(([v, l]) => `<option value="${v}" ${v === (i?.reponse || 'attente') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="sensible">
        <p><b>Données sensibles</b> · uniquement avec l'accord explicite de l'invité, si c'est utile à l'organisation.</p>
        <label class="champ">Régime alimentaire<select name="regime"><option value="">Non renseigné</option>${B.regimes.map((r) => `<option ${r === i?.regime ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label class="champ">Besoin d'accessibilité<small>Ex. : accès en fauteuil, place réservée. Pas de diagnostic.</small><input name="accessibilite" maxlength="120" value="${esc(i?.accessibilite || '')}"></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(i?.note || '')}"></label>
      <label class="case"><input type="checkbox" name="present" ${i?.present ? 'checked' : ''}> Présent le jour J</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(i ? 'Modifier l\'invité' : 'Nouvel invité', corps, piedSimple(i ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.invites = E.invites.filter((x) => x.id !== i.id); fait(`${i.prenom} ${i.nom} retiré de la liste.`); return; }
      const v = { prenom: String(f.get('prenom') || '').trim(), nom: String(f.get('nom') || '').trim(), societe: String(f.get('societe') || '').trim(), fonction: String(f.get('fonction') || '').trim(), email: String(f.get('email') || '').trim(),
        categorie: f.get('categorie'), reponse: f.get('reponse'), regime: f.get('regime') || '', accessibilite: String(f.get('accessibilite') || '').trim(), note: String(f.get('note') || '').trim(), present: f.has('present') };
      if (!v.nom) return 'Indique au moins le nom.';
      memo();
      if (i) Object.assign(i, v); else E.invites.push({ id: uid(), evtId: e.id, ...v });
      fait(i ? 'Invité enregistré.' : `${v.prenom} ${v.nom} ajouté.`);
    });
  }
  function modaleInvitesRapides() {
    const e = evtCourant();
    ouvrirModale('Saisie rapide d\'invités', `
      <label class="champ">Un invité par ligne<small>« Prénom Nom ; Société ; Fonction » (société et fonction facultatives). Copier-coller depuis un tableur accepté (tabulations).</small><textarea name="liste" rows="8" required placeholder="Léa Martin ; Orme &amp; Cie ; Directrice achats&#10;Hugo Bernard ; Atelier Cobalt"></textarea></label>
      <div class="deux">
        <label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Réponse<select name="reponse"><option value="attente">En attente</option><option value="oui">Oui</option><option value="non">Non</option></select></label>
      </div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const l = R.lireInvitesRapides(f.get('liste'));
      if (!l.length) return 'Aucun nom reconnu.';
      memo();
      l.forEach((x) => E.invites.push({ id: uid(), evtId: e.id, ...x, email: '', categorie: f.get('categorie'), reponse: f.get('reponse'), regime: '', accessibilite: '', note: '', present: false }));
      fait(`${pluriel(l.length, 'invité ajouté', 'invités ajoutés')}.`);
    });
  }
  function modaleCsv() {
    const e = evtCourant();
    ouvrirModale('Exporter la liste d\'invités', `<p>Fichier CSV (point-virgule, UTF-8) à ouvrir dans un tableur : liste d'accueil, envoi au lieu.</p>
      <label class="case"><input type="checkbox" name="sensibles"> Inclure régimes et accessibilité (données sensibles)</label>
      <p class="aide">Le fichier sort de l'application : range-le dans un dossier protégé, transmets-le seulement aux personnes qui en ont besoin (traiteur, lieu) et supprime-le après l'événement.</p>`,
    '<button class="btn primaire" value="ok">Télécharger</button><button class="btn" value="annuler">Annuler</button>', (f) => { exporterCsv(e, f.has('sensibles')); });
  }

  function modaleSequence(id) {
    const e = evtCourant();
    const x = id ? E.conducteur.find((y) => y.id === id) : null;
    const nb = Math.max(1, e.nbJours || 1);
    const derniere = R.conducteur(deEvt(E.conducteur, e.id)).filter((y) => y.jour === ui.jour).at(-1);
    const corps = `
      <label class="champ">Séquence<input name="titre" required maxlength="100" value="${esc(x?.titre || '')}" placeholder="Ex. : Mot d'accueil du directeur"></label>
      <div class="deux">
        <label class="champ">Début<input type="time" name="heure" required value="${esc(x?.heure || (derniere ? R.hm(Math.min(derniere.fin, 23 * 60 + 59)) : e.heure || '09:00'))}"></label>
        <label class="champ">Durée (minutes)<input type="number" name="duree" min="0" max="1440" value="${x ? x.duree : 15}"></label>
      </div>
      <div class="deux">
        <label class="champ">Lieu ou espace<small>Les chevauchements sont signalés par lieu.</small><input name="lieu" maxlength="60" value="${esc(x?.lieu || '')}"></label>
        <label class="champ">Responsable<input name="responsable" maxlength="40" value="${esc(x?.responsable || '')}"></label>
      </div>
      ${nb > 1 ? `<label class="champ">Jour<select name="jour">${Array.from({ length: nb }, (_, i) => `<option value="${i + 1}" ${(x?.jour || ui.jour) === i + 1 ? 'selected' : ''}>Jour ${i + 1}</option>`).join('')}</select></label>` : ''}
      <label class="champ">Notes<small>Technique, micro, support à lancer…</small><input name="notes" maxlength="200" value="${esc(x?.notes || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier la séquence' : 'Nouvelle séquence', corps, piedSimple(x ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.conducteur = E.conducteur.filter((y) => y.id !== x.id); fait('Séquence supprimée.'); return; }
      const titre = String(f.get('titre') || '').trim();
      const debut = R.minutes(f.get('heure'));
      const duree = Number(f.get('duree'));
      if (!titre) return 'Indique la séquence.';
      if (debut === null) return 'Heure de début invalide.';
      if (!Number.isInteger(duree) || duree < 0 || debut + duree > 1440) return 'Durée : minutes entières, sans dépasser minuit.';
      memo();
      const v = { titre, heure: R.hm(debut), duree, lieu: String(f.get('lieu') || '').trim(), responsable: String(f.get('responsable') || '').trim(), notes: String(f.get('notes') || '').trim(), jour: Number(f.get('jour') || x?.jour || ui.jour) };
      if (x) Object.assign(x, v); else E.conducteur.push({ id: uid(), evtId: e.id, ...v });
      fait(x ? 'Séquence enregistrée.' : 'Séquence ajoutée.');
    });
  }
  function modaleDecaler(id) {
    const e = evtCourant();
    const x = E.conducteur.find((y) => y.id === id);
    const n = deEvt(E.conducteur, e.id).filter((y) => y.jour === x.jour && R.minutes(y.heure) >= R.minutes(x.heure)).length;
    ouvrirModale('Décaler le conducteur', `<p>« ${esc(x.titre)} » (${esc(x.heure)}) et les séquences suivantes du même jour : <b>${pluriel(n, 'séquence')}</b>.</p>
      <label class="champ">Décalage (minutes)<small>Négatif pour avancer.</small><input type="number" name="n" value="15" min="-600" max="600" required></label>
      <div class="rang">${[-15, -5, 5, 10, 15, 30].map((v) => `<button type="button" class="btn petit" data-action="choisir-decalage" data-v="${v}">${v > 0 ? '+' : ''}${v} min</button>`).join('')}</div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Décaler</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const r = R.decaler(deEvt(E.conducteur, e.id), id, Number(f.get('n')));
      if (typeof r === 'string') return r;
      memo();
      E.conducteur.forEach((y) => { if (r[y.id]) y.heure = r[y.id]; });
      fait(`${pluriel(Object.keys(r).length, 'séquence décalée', 'séquences décalées')}.`);
    });
  }
  function modaleCheck(id) {
    const e = evtCourant();
    const x = id ? E.checklist.find((y) => y.id === id) : null;
    ouvrirModale(x ? 'Modifier le point' : 'Nouveau point de checklist', `
      <label class="champ">Point à vérifier<input name="libelle" required maxlength="140" value="${esc(x?.libelle || '')}"></label>
      <div class="deux"><label class="champ">Heure<small>Facultative</small><input type="time" name="heure" value="${esc(x?.heure || '')}"></label><label class="champ">Responsable<input name="responsable" maxlength="40" value="${esc(x?.responsable || '')}"></label></div>
      <p class="erreur" role="alert"></p>`, piedSimple(x ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.checklist = E.checklist.filter((y) => y.id !== x.id); fait('Point supprimé.'); return; }
      const libelle = String(f.get('libelle') || '').trim();
      if (!libelle) return 'Indique le point à vérifier.';
      memo();
      const v = { libelle, heure: f.get('heure') || '', responsable: String(f.get('responsable') || '').trim() };
      if (x) Object.assign(x, v); else E.checklist.push({ id: uid(), evtId: e.id, fait: false, ...v });
      fait(x ? 'Point enregistré.' : 'Point ajouté.');
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const e = evtCourant();
    const nbSens = e ? deEvt(E.invites, e.id).filter((i) => i.regime || i.accessibilite).length : 0;
    const corps = `
      <label class="champ">Nom de ta structure<input name="structure" maxlength="60" value="${esc(E.structure)}"></label>
      <fieldset class="choix-base"><legend>Montants saisis <small>Simple libellé affiché à côté des montants.</small></legend>
        <label class="case"><input type="radio" name="convention" value="HT" ${E.reglages.convention === 'HT' ? 'checked' : ''}> Hors taxes (HT)</label>
        <label class="case"><input type="radio" name="convention" value="TTC" ${E.reglages.convention === 'TTC' ? 'checked' : ''}> Toutes taxes comprises (TTC)</label>
      </fieldset>
      <div class="groupe"><h3>Données personnelles des invités</h3>
        <p class="aide">Régimes, allergies et besoins d'accessibilité sont des données sensibles : efface-les dès que l'événement est passé. ${esc(B.rgpd.source)} Outil d'aide, pas un conseil juridique.</p>
        ${e ? `<div class="rang"><button class="btn petit danger" type="button" data-action="effacer-sensibles" ${nbSens ? '' : 'disabled'}>Effacer régimes et accessibilité de « ${esc(e.nom)} » (${nbSens})</button></div>` : ''}</div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé ; toute personne qui a la clé les voit. Tu peux aussi garder une copie.'} Taille actuelle : ${Math.ceil(R.taille(E) / 1024)} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Base intégrée</h3><p class="aide">Rétroplannings, conducteurs, checklist et postes rédigés pour ce template : délais et horaires indicatifs, aucun prix de référence.</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.structure = String(f.get('structure') || '').trim();
      E.reglages.convention = f.get('convention') === 'HT' ? 'HT' : 'TTC';
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (ev) => {
      const fichier = ev.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.evenements) || !Array.isArray(d.taches)) throw new Error();
        if (!confirm(`Remplacer toutes tes données par cette copie (${pluriel(d.evenements.length, 'événement')}) ?`)) return;
        memo();
        E = normaliser(d); delete E.majLe;
        modale().close(); fait('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du pilote événementiel.'); }
    });
  }
  function exporter() {
    telecharger(new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' }), `pilote-evenementiel-${auj()}.json`);
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
  function trouverEch(contratId, id) {
    const c = E.contrats.find((x) => x.id === contratId);
    return { c, x: c?.echeances.find((y) => y.id === id) };
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-vide': terminerAccueilVide(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'ouvrir-evt': ui.evtId = id; ui.jour = 1; memoUi(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'evt-nouveau': modaleEvenement(); break;
      case 'evt-modifier': modaleEvenement(id); break;
      case 'tache-nouvelle': modaleTache(); break;
      case 'tache-modifier': modaleTache(id); break;
      case 'modele': modaleModele(); break;
      case 'cocher': {
        const x = E.taches.find((y) => y.id === id);
        memo(); x.faite = x.faite ? null : auj();
        fait(x.faite ? `« ${x.titre} » faite.` : `« ${x.titre} » à refaire.`);
        break;
      }
      case 'retro-tout': ui.retroTout = el.dataset.v === '1'; memoUi(); rendre(); break;
      case 'poste-nouveau': modalePoste(); break;
      case 'poste-modifier': modalePoste(id); break;
      case 'postes-types': modalePostesTypes(); break;
      case 'presta-nouveau': modalePresta(); break;
      case 'presta-modifier': modalePresta(id); break;
      case 'presta-depuis-contrat': modale().close(); modalePresta(null, (pid) => modaleContrat(null, pid)); break;
      case 'contrat-nouveau': modaleContrat(); break;
      case 'contrat-modifier': modaleContrat(id); break;
      case 'ech-ajout': { const z = $('#echeances'); z.insertAdjacentHTML('beforeend', ligneEcheance({}, z.children.length)); z.lastElementChild.querySelector('input').focus(); break; }
      case 'ech-suppr': el.closest('.ech-ligne').remove(); break;
      case 'ech-decouper': {
        const f = el.closest('form');
        const montant = R.lireMontant(f.montant.value);
        const parts = R.decouper(montant || 0, Number(f.pct.value));
        const err = f.querySelector('.erreur');
        if (!montant || !parts) { err.textContent = 'Saisis le montant du contrat et le pourcentage d\'acompte prévu au contrat (entre 1 et 99).'; break; }
        err.textContent = '';
        $('#echeances').innerHTML = ligneEcheance({ libelle: `Acompte ${f.pct.value} %`, montant: parts[0], date: f.d1.value || null }, 0) + ligneEcheance({ libelle: 'Solde', montant: parts[1], date: f.d2.value || null }, 1);
        break;
      }
      case 'payer': case 'depayer': {
        const { c, x } = trouverEch(el.dataset.contrat, id);
        if (!x) break;
        memo(); x.payeLe = action === 'payer' ? auj() : null;
        fait(action === 'payer' ? `${eur(x.montant)} marqués payés à ${presta(c.prestaId)?.nom || 'ce prestataire'}.` : 'Paiement annulé.');
        break;
      }
      case 'invite-nouveau': modaleInvite(); break;
      case 'invite-modifier': modaleInvite(id); break;
      case 'invites-rapide': modaleInvitesRapides(); break;
      case 'repondre': { const i = E.invites.find((y) => y.id === id); if (i.reponse === el.dataset.v) break; memo(); i.reponse = el.dataset.v; if (i.reponse !== 'oui') i.present = false; fait(`${i.prenom} ${i.nom} : ${{ oui: 'oui', non: 'non', attente: 'en attente' }[i.reponse]}.`); break; }
      case 'present': { const i = E.invites.find((y) => y.id === id); memo(); i.present = !i.present; if (i.present) i.reponse = 'oui'; fait(i.present ? `${i.prenom} ${i.nom} est arrivé.` : `${i.prenom} ${i.nom} : arrivée annulée.`); break; }
      case 'badges': imprimerBadges(evtCourant()); break;
      case 'csv': modaleCsv(); break;
      case 'sequence-nouvelle': modaleSequence(); break;
      case 'sequence-modifier': modaleSequence(id); break;
      case 'decaler': modaleDecaler(id); break;
      case 'choisir-decalage': el.closest('form').n.value = el.dataset.v; break;
      case 'conducteur-type': memo(); fait(`${pluriel(ajouterConducteurType(evtCourant()), 'séquence ajoutée', 'séquences ajoutées')} (horaires d'exemple à adapter).`); break;
      case 'imprimer-conducteur': imprimerConducteur(evtCourant()); break;
      case 'jour': ui.jour = Number(el.dataset.v); rendre(); break;
      case 'check': { const x = E.checklist.find((y) => y.id === id); memo(); x.fait = !x.fait; sauver(); rendre(); break; }
      case 'check-nouveau': modaleCheck(); break;
      case 'check-modifier': modaleCheck(id); break;
      case 'checklist-type': memo(); fait(`${pluriel(ajouterChecklistType(evtCourant()), 'point ajouté', 'points ajoutés')}.`); break;
      case 'checklist-raz': if (confirm('Décocher tous les points de la checklist ?')) { memo(); deEvt(E.checklist, evtCourant().id).forEach((x) => { x.fait = false; }); fait('Checklist remise à zéro.'); } break;
      case 'effacer-sensibles': {
        const e = evtCourant();
        if (!confirm(`Effacer définitivement régimes et besoins d'accessibilité des invités de « ${e.nom} » ?`)) break;
        const n = R.effacerSensibles(E.invites, e.id);
        modale().close(); sauver(); rendre(); toast(`Données sensibles effacées pour ${pluriel(n, 'invité')}.`);
        break;
      }
      default: break;
    }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('select[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'choisir-evt') { ui.evtId = el.value; ui.jour = 1; ui.resp = ''; memoUi(); rendre(); }
    if (a === 'filtre-resp') { ui.resp = el.value; rendre(); }
    if (a === 'filtre-cat') { ui.cat = el.value; rendre(); }
    if (a === 'filtre-rep') { ui.rep = el.value; rendre(); }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // Le jour J, la séquence en cours se met à jour chaque minute.
  setInterval(() => { if (E && vue === 'jourj' && !modale().open && document.visibilityState === 'visible') rendre(); }, 60000);

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
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__evenementiel = { etat: () => E, regles: R };
  init();
})();
