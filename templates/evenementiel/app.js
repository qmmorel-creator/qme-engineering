// Organisateur d'événement QME : mariage, séminaire ou offsite, événement d'entreprise ou d'association, fête de famille.
// Plusieurs événements de front ; rétroplanning calculé, budget et contrats, invités et réponses, plan de table,
// transports et chambres, badges, conducteur du jour J. Les fonctions propres à un type apparaissent quand elles servent.
// Fusion du 22/11/2026 (rationalisation F1) : pilote événementiel, organisateur de mariage, séminaire / offsite.
// Données synchronisées par clé de licence (socle commun des templates QME).
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
  const CLE_ACCUEIL = 'qme-evt-ecran-accueil';
  const NOM = 'Organisateur d\'événement';
  const VARIANTES = ['tout', 'mariage', 'seminaire', 'entreprise', 'fete'];

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
    return fmt(s);
  };
  const heureFr = (h) => (h ? h.replace(':', ' h ') : '');
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const typeEvt = (id) => B.types.find((t) => t.id === id) || B.types[2];
  const formatEvt = (e) => (typeEvt(e.type).formats || []).find((f) => f.id === e.format);
  const libelleType = (e) => formatEvt(e)?.nom || typeEvt(e.type).nom;
  const mots = (e) => typeEvt(e?.type || 'entreprise').mots;
  const phase = (id) => B.phases.find((p) => p.id === id) || { id, nom: 'Autre' };
  const statutContrat = (id) => B.statutsContrat.find((s) => s.id === id) || B.statutsContrat[0];
  const typeSeq = (id) => B.sequences.find((t) => t.id === (id || '')) || B.sequences[0];
  const modeTrajet = (id) => B.modes.find((m) => m.id === id) || B.modes.at(-1);
  const typeChambre = (id) => B.chambres.find((c) => c.id === id) || B.chambres[0];
  const REP = { oui: 'Oui', attente: 'En attente', non: 'Non' };
  const mod = (e, m) => R.aModule(e, m);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let annulation = null;
  const ui = Object.assign({ evtId: null, retroTout: false, resp: '', grp: '', rep: '', q: '', jour: 1, volet: 'liste' }, stock.lire(CLE_UI) || {});
  const memoUi = () => stock.ecrire(CLE_UI, { evtId: ui.evtId, retroTout: ui.retroTout, volet: ui.volet });

  const normaliser = (d) => R.normaliser(d);
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
  const trajet = (id) => E.trajets.find((t) => t.id === id);
  const chambre = (id) => E.chambres.find((c) => c.id === id);
  const table = (id) => E.tables.find((t) => t.id === id);
  const nomTrajet = (t) => (t ? (t.libelle || `${modeTrajet(t.mode).nom} ${t.depart || '?'} → ${t.arrivee || '?'}`) : '');
  const libTransport = (v) => (v === 'perso' ? 'Par ses propres moyens' : trajet(v) ? `${nomTrajet(trajet(v))}${trajet(v).heureDepart ? ` (${heureFr(trajet(v).heureDepart)})` : ''}` : '');
  const nomChambre = (c) => (c ? `${c.nom}${c.hebergement ? ` · ${c.hebergement}` : ''}` : '');
  // Couleur d'un groupe d'invités : rang du groupe dans l'événement, couleurs fixes dans l'ordre de la charte.
  const ORDRE_GROUPES = ['bleu', 'rouge', 'jaune', 'vert', 'encre', 'gris'];
  function couleurGroupe(e, nom) {
    const g = (nom || '').trim();
    if (!g) return 'gris';
    const i = R.groupesDe(deEvt(E.invites, e.id)).indexOf(g);
    return ORDRE_GROUPES[(i < 0 ? 0 : i) % ORDRE_GROUPES.length];
  }
  const suggestionsGroupes = (e) => {
    const n1 = e?.noms?.[0] || 'Mariée ou marié 1', n2 = e?.noms?.[1] || 'Mariée ou marié 2';
    return (B.groupes[e?.type] || []).map((x) => x.replace('{1}', n1).replace('{2}', n2));
  };

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
  // Démo : un jeu d'exemple par type (?demo, ?demo=mariage, ?demo=seminaire, ?demo=entreprise, ?demo=fete).
  function ouvrirDemo(memoriser = true, variante) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const garde = stock.lire(CLE_DEMO);
    const voulue = VARIANTES.includes(variante) ? variante : undefined;
    if (garde && (!voulue || garde.demoVariante === voulue)) E = normaliser(garde);
    else { E = donneesDemo(voulue || 'tout'); ui.volet = 'liste'; ui.jour = 1; }
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
    const e = { id: uid(), nom: d.nom, type: d.type || 'entreprise', format: d.format || '', date: d.date, heure: d.heure || '', nbJours: d.nbJours || 1, lieu: d.lieu || '', client: d.client || '',
      depart: d.depart || '', limite: d.limite || '', budgetCible: d.budgetCible || 0, notes: d.notes || '', noms: d.noms || ['', ''], modules: d.modules || R.modulesParDefaut(d.type, d.format, d.nbJours) };
    E.evenements.push(e);
    const t = auj();
    const cle = R.cleModele(e);
    if (options.retro && B.retroplannings[cle]) E.taches.push(...R.tachesDepuisModele(B.retroplannings[cle], e, t, options.passees || 'aujourdhui', E.taches, uid).taches);
    if (options.postes) ajouterPostesTypes(e, B.postes[cle] || []);
    if (options.conducteur) ajouterConducteurType(e);
    if (options.checklist) ajouterChecklistType(e);
    return e;
  }
  function ajouterPostesTypes(e, noms) {
    const deja = new Set(deEvt(E.postes, e.id).map((p) => p.nom.toLowerCase()));
    let n = 0;
    for (const nom of noms) if (!deja.has(nom.toLowerCase())) { E.postes.push({ id: uid(), evtId: e.id, nom, prevu: 0 }); n++; }
    return n;
  }
  function ajouterConducteurType(e, cle = R.cleConducteur(e)) {
    const nb = Math.max(1, e.nbJours || 1);
    const lignes = (B.conducteurs[cle] || B.conducteurs.conference).filter(([jour]) => jour <= nb);
    lignes.forEach(([jour, heure, duree, titre, type, lieu]) => E.conducteur.push({ id: uid(), evtId: e.id, jour, heure, duree, titre, type, lieu, responsable: '', notes: '' }));
    return lignes.length;
  }
  const cleChecklist = (e) => (e.type === 'mariage' || e.type === 'fete' ? e.type : 'pro');
  function ajouterChecklistType(e) {
    const deja = new Set(deEvt(E.checklist, e.id).map((c) => c.libelle.toLowerCase()));
    let n = 0;
    B.checklists[cleChecklist(e)].forEach(([libelle, heure]) => { if (!deja.has(libelle.toLowerCase())) { E.checklist.push({ id: uid(), evtId: e.id, libelle, heure, responsable: '', fait: false }); n++; } });
    return n;
  }

  // ---------- Données de démonstration (relatives à aujourd'hui, entièrement fictives) ----------
  const nouvelInvite = (e, o) => ({ id: uid(), evtId: e.id, prenom: '', nom: '', groupe: '', societe: '', fonction: '', email: '', enfant: false, reponse: 'oui', regime: '', allergie: false, allergieDetail: '', acces: false, accesDetail: '',
    note: '', present: false, tableId: null, allerId: '', retourId: '', chambreId: '', hebergement: true, ...o });
  const prestaDemo = (nom, metier, contact = '', tel = '', email = '') => {
    const deja = E.prestataires.find((p) => p.nom === nom);
    if (deja) return deja;
    const p = { id: uid(), nom, metier, contact, tel, email, notes: '' };
    E.prestataires.push(p);
    return p;
  };
  const posteDe = (e, nom) => deEvt(E.postes, e.id).find((p) => p.nom === nom)?.id || null;
  const prevusDemo = (e, m) => deEvt(E.postes, e.id).forEach((p) => { p.prevu = (m[p.nom] || 0) * 100; });
  const contratDemo = (e, p, posteNom, objet, montant, statut, documents, echeances) => E.contrats.push({ id: uid(), evtId: e.id, prestaId: p.id, posteId: posteDe(e, posteNom), objet, montant: montant * 100, statut, documents,
    echeances: echeances.map(([libelle, m, date, payeLe]) => ({ id: uid(), libelle, montant: m * 100, date, payeLe })) });
  // Avancement simulé du rétroplanning : tâches faites sauf quelques retards récents ; responsables en rotation.
  function avancerTaches(e, retards, equipe) {
    const t = auj();
    let laisses = 0;
    deEvt(E.taches, e.id).forEach((x, i) => {
      if (equipe) x.responsable = equipe[i % equipe.length];
      const ech = R.echeance(x, e);
      if (ech < t) {
        if (laisses < retards && ech >= ajout(t, -21)) { laisses++; return; }
        x.faite = ajout(ech, -(i % 3));
      } else if (ech === t || (i % 7 === 0 && ech < ajout(t, 20))) x.faite = i % 2 ? t : null;
    });
  }

  function demoEntreprise(complet) {
    const t = auj();
    const equipe = ['Inès', 'Marc', 'Sofia', 'Théo'];
    const opts = { retro: true, postes: true, conducteur: true, checklist: true, passees: 'garder' };
    const lancement = creerEvenement({ nom: 'Lancement de la gamme Aube', type: 'entreprise', format: 'soiree', date: ajout(t, 6), heure: '18:30', lieu: 'Halle Méridienne, Lyon', client: 'Orme & Cie (fictif)', limite: ajout(t, 3), budgetCible: 5000000 }, opts);
    const matinale = creerEvenement({ nom: 'Matinale clients', type: 'entreprise', format: 'conference', date: t, heure: '08:00', lieu: 'Bureaux de l\'agence', client: 'Interne' }, { checklist: true });
    avancerTaches(lancement, 2, equipe);
    E.taches.push({ id: uid(), evtId: lancement.id, titre: 'Valider la maquette du kakémono avec le client', phase: 'communication', avant: 0, dateFixe: ajout(t, 1), responsable: 'Sofia', faite: null, note: 'BAT attendu demain matin.' });
    const halle = prestaDemo('Halle Méridienne', 'Lieu', 'Responsable commercial', '04 00 00 00 01', 'contact@exemple.fr');
    const traiteur = prestaDemo('Traiteur Les Quatre Saisons', 'Traiteur', 'Chef de projet', '04 00 00 00 02', 'devis@exemple.fr');
    const regie = prestaDemo('Régie Volta', 'Technique', 'Régisseur', '06 00 00 00 03', 'regie@exemple.fr');
    const decor = prestaDemo('Atelier Décor Brun', 'Fleurs et décoration', 'Chargée de projet', '06 00 00 00 04');
    const photo = prestaDemo('Studio Ardoise', 'Photo et vidéo', 'Photographe', '06 00 00 00 05', 'studio@exemple.fr');
    const navettes = prestaDemo('Navettes Azur', 'Transport', 'Exploitation', '04 00 00 00 07');
    prevusDemo(lancement, { 'Lieu et location de salles': 11000, Restauration: 15000, Boissons: 3500, 'Technique son et lumière': 7000, 'Scénographie et décoration': 8000, 'Signalétique et impressions': 1500, 'Cadeaux et goodies': 2500, 'Photo et vidéo': 2000, 'Personnel d\'accueil': 1800, Imprévus: 2000 });
    contratDemo(lancement, halle, 'Lieu et location de salles', 'Privatisation de la halle, 18 h – 23 h', 12000, 'signe', 'Contrat n° HM-112 signé (dossier client / contrats)', [['Acompte', 3600, ajout(t, -48), ajout(t, -47)], ['Solde', 8400, ajout(t, 6), null]]);
    contratDemo(lancement, traiteur, 'Restauration', 'Cocktail dînatoire 180 personnes', 14500, 'signe', 'Devis D-2611 accepté, conditions d\'annulation p. 2', [['Acompte', 4350, ajout(t, -30), ajout(t, -29)], ['Solde', 10150, ajout(t, 20), null]]);
    contratDemo(lancement, regie, 'Technique son et lumière', 'Son, lumière, écran LED, régisseur', 6800, 'signe', 'Bon de commande BC-48', [['Acompte', 2040, ajout(t, -3), null], ['Solde', 4760, ajout(t, 30), null]]);
    contratDemo(lancement, decor, 'Scénographie et décoration', 'Scénographie d\'entrée et mur photo', 7500, 'signe', 'Devis signé le ' + R.dateFr(ajout(t, -25)), [['Acompte', 2500, ajout(t, -25), ajout(t, -24)], ['Deuxième versement', 2500, ajout(t, 4), null]]);
    contratDemo(lancement, photo, 'Photo et vidéo', 'Reportage photo et film de 2 minutes', 1900, 'devis', 'Devis reçu par e-mail, à valider par le client', []);
    contratDemo(lancement, navettes, null, 'Navettes retour invités', 900, 'consulte', '', []);
    // Invités du lancement (personnes fictives).
    const prenoms = ['Léa', 'Hugo', 'Chloé', 'Nathan', 'Camille', 'Louis', 'Manon', 'Jules', 'Sarah', 'Adam', 'Inès', 'Paul', 'Emma', 'Noah', 'Jade', 'Arthur', 'Alice', 'Lucas', 'Rose', 'Victor', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Anna', 'Tom', 'Julia', 'Maël', 'Eva', 'Sacha', 'Nina', 'Hélène', 'Yanis', 'Clara', 'Malo', 'Lou'];
    const noms = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller'];
    const societes = ['Orme & Cie', 'Atelier Cobalt', 'Groupe Tilleul', 'Maison Pivert', 'Bureau Lavande', 'Studio Ardoise', 'Rédaction Le Fil', 'Saule Conseil'];
    const fonctions = ['Directrice commerciale', 'Acheteur', 'Responsable marketing', 'Directeur général', 'Chargée de communication'];
    const cats = ['Client', 'Client', 'Prospect', 'Partenaire', 'Presse', 'Client', 'VIP', 'Prospect', 'Collaborateur', 'Intervenant'];
    prenoms.forEach((p, i) => {
      const c = cats[i % 10];
      E.invites.push(nouvelInvite(lancement, { prenom: p, nom: noms[i], groupe: c, societe: c === 'Collaborateur' ? 'Orme & Cie' : c === 'Presse' ? 'Rédaction Le Fil' : societes[i % 7], fonction: c === 'Presse' ? 'Journaliste' : c === 'Intervenant' ? 'Conférencière' : fonctions[i % fonctions.length],
        reponse: i % 9 === 4 ? 'non' : i % 5 === 3 ? 'attente' : 'oui', regime: i % 8 === 2 ? 'Végétarien' : i % 13 === 5 ? 'Sans alcool' : i === 17 ? 'Végétalien' : '', acces: i === 11, accesDetail: i === 11 ? 'Accès en fauteuil roulant' : '' }));
    });
    // Matinale du jour : présences pointées et chevauchement volontaire dans la salle 1.
    ['Durand', 'Petit', 'Roux', 'Faure', 'Blanc', 'Moreau', 'Lambert', 'Girard'].forEach((nom, i) => E.invites.push(nouvelInvite(matinale, { prenom: prenoms[i + 3], nom, groupe: i % 3 ? 'Client' : 'Prospect', societe: societes[i % societes.length], reponse: i === 7 ? 'non' : 'oui', present: i < 4 })));
    [['07:30', 30, 'Installation de la salle', 'transfert', 'Salle 1', 'Théo'], ['08:00', 30, 'Accueil café', 'pause', 'Hall', 'Inès'], ['08:30', 45, 'Présentation des nouveautés', 'pleniere', 'Salle 1', 'Marc'], ['09:00', 20, 'Témoignage client', 'pleniere', 'Salle 1', 'Sofia'], ['09:20', 40, 'Échanges libres', 'repas', 'Hall', 'Inès'], ['10:00', 30, 'Rangement', 'transfert', 'Salle 1', 'Théo']]
      .forEach(([heure, duree, titre, type, lieu, responsable]) => E.conducteur.push({ id: uid(), evtId: matinale.id, jour: 1, heure, duree, titre, type, lieu, responsable, notes: '' }));
    deEvt(E.checklist, matinale.id).forEach((c, i) => { c.fait = i < 9; if (i < 4) c.responsable = equipe[i]; });
    deEvt(E.conducteur, lancement.id).forEach((c, i) => { c.responsable = equipe[i % equipe.length]; });
    deEvt(E.conducteur, lancement.id)[4].notes = 'Micro HF n° 1, pupitre côté jardin';
    if (complet) {
      const salon = creerEvenement({ nom: 'Salon des achats industriels', type: 'entreprise', format: 'salon', date: ajout(t, 68), heure: '09:30', nbJours: 3, lieu: 'Parc des expositions', client: 'Atelier Cobalt (fictif)' }, opts);
      const passe = creerEvenement({ nom: 'Convention partenaires', type: 'entreprise', format: 'conference', date: ajout(t, -35), heure: '09:00', lieu: 'Centre de congrès', client: 'Bureau Lavande (fictif)' }, { retro: true, postes: true, passees: 'garder' });
      avancerTaches(salon, 1, equipe); avancerTaches(passe, 0, equipe);
      const stand = prestaDemo('Stand Concept', 'Standiste', 'Chef de projet', '06 00 00 00 08');
      prevusDemo(salon, { Stand: 22000, 'Frais d\'exposant': 9500, Hébergement: 4200, Transports: 1800, 'Signalétique et impressions': 1200 });
      prevusDemo(passe, { 'Lieu et location de salles': 9000, Restauration: 7500, Imprévus: 1000 });
      contratDemo(salon, stand, 'Stand', 'Conception et montage stand 36 m²', 21000, 'signe', 'Contrat SC-77, plans v3', [['Acompte', 6300, ajout(t, -10), ajout(t, -9)], ['Deuxième versement', 6300, ajout(t, 40), null]]);
      contratDemo(passe, halle, 'Lieu et location de salles', 'Location salle plénière', 8600, 'signe', 'Contrat HM-098', [['Acompte', 2580, ajout(t, -90), ajout(t, -90)], ['Solde', 6020, ajout(t, -30), ajout(t, -28)]]);
    }
    return lancement;
  }

  function demoSeminaire(complet) {
    const t = auj();
    const opts = { retro: true, postes: true, conducteur: true, checklist: true, passees: 'garder' };
    const annuel = creerEvenement({ nom: 'Séminaire annuel des managers', type: 'seminaire', date: ajout(t, 26), heure: '09:30', nbJours: 2, lieu: 'Domaine des Grands Chênes', client: 'Maison Tilleul (fictif)', depart: 'Paris', limite: ajout(t, -2), budgetCible: 4200000 }, opts);
    avancerTaches(annuel, 2, ['Claire', 'Yanis', 'Odile']);
    const prenoms = ['Léa', 'Hugo', 'Chloé', 'Nathan', 'Camille', 'Louis', 'Manon', 'Jules', 'Sarah', 'Adam', 'Inès', 'Paul', 'Emma', 'Noah', 'Jade', 'Arthur', 'Alice', 'Lucas', 'Rose', 'Victor', 'Zoé', 'Gabriel', 'Lina', 'Raphaël', 'Anna', 'Tom', 'Julia', 'Maël', 'Eva', 'Sacha', 'Nina', 'Hélène', 'Yanis', 'Clara', 'Malo', 'Lou', 'Théo', 'Margaux'];
    const noms = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller', 'Henry', 'Roussel'];
    const services = ['Direction', 'Ventes', 'Ventes', 'Marketing', 'Finance', 'Ressources humaines', 'Produit', 'Produit', 'Service client', 'Ventes'];
    const T = (o) => { const x = { id: uid(), evtId: annuel.id, libelle: '', reference: '', places: 0, ...o }; E.trajets.push(x); return x; };
    const C = (o) => { const x = { id: uid(), evtId: annuel.id, note: '', ...o }; E.chambres.push(x); return x; };
    const j1 = annuel.date, j2 = ajout(annuel.date, 1);
    const trainA = T({ sens: 'aller', mode: 'train', libelle: 'Train du matin', depart: 'Paris', arrivee: 'Gare de Valmont', date: j1, heureDepart: '07:12', heureArrivee: '09:05', places: 20, reference: 'Réservation de groupe GR-4471' });
    const trainB = T({ sens: 'aller', mode: 'train', libelle: 'Train de 8 h 46', depart: 'Paris', arrivee: 'Gare de Valmont', date: j1, heureDepart: '08:46', heureArrivee: '10:38', places: 8, reference: 'Billets individuels' });
    const car = T({ sens: 'aller', mode: 'car', libelle: 'Car depuis l\'agence de Lyon', depart: 'Lyon', arrivee: 'Domaine des Grands Chênes', date: j1, heureDepart: '07:30', heureArrivee: '09:40', places: 8, reference: 'Devis autocariste n° 58' });
    const retA = T({ sens: 'retour', mode: 'train', libelle: 'Train de l\'après-midi', depart: 'Gare de Valmont', arrivee: 'Paris', date: j2, heureDepart: '14:52', heureArrivee: '16:45', places: 22, reference: 'Réservation de groupe GR-4472' });
    const retB = T({ sens: 'retour', mode: 'train', libelle: 'Train de 13 h 05', depart: 'Gare de Valmont', arrivee: 'Paris', date: j2, heureDepart: '13:05', heureArrivee: '14:58', places: 6, reference: 'Billets individuels' });
    const retCar = T({ sens: 'retour', mode: 'car', libelle: 'Car vers l\'agence de Lyon', depart: 'Domaine des Grands Chênes', arrivee: 'Lyon', date: j2, heureDepart: '14:20', heureArrivee: '16:30', places: 10, reference: 'Devis autocariste n° 58' });
    const chambres = [];
    for (let i = 1; i <= 14; i++) chambres.push(C({ hebergement: 'Domaine des Grands Chênes', nom: `Chambre ${100 + i}`, type: 'twin', capacite: 2 }));
    for (let i = 1; i <= 6; i++) chambres.push(C({ hebergement: 'Domaine des Grands Chênes', nom: `Chambre ${200 + i}`, type: 'individuelle', capacite: 1 }));
    chambres.push(C({ hebergement: 'Domaine des Grands Chênes', nom: 'Chambre 001', type: 'individuelle', capacite: 1, note: 'Rez-de-chaussée, accès de plain-pied' }));
    chambres.push(C({ hebergement: 'Domaine des Grands Chênes', nom: 'Suite 300', type: 'double', capacite: 2 }));
    const regimes = { 2: 'Végétarien', 9: 'Végétarien', 14: 'Végétalien', 17: 'Sans porc', 21: 'Végétarien', 25: 'Sans alcool', 30: 'Végétarien', 33: 'Sans porc' };
    const reponses = { 6: 'attente', 13: 'attente', 27: 'attente', 34: 'attente', 11: 'non', 23: 'non', 36: 'non' };
    const lyon = new Set([4, 8, 15, 19, 26, 29, 31, 35, 37]);
    const tardifs = new Set([3, 12, 20, 32]);
    prenoms.forEach((prenom, i) => {
      const reponse = reponses[i] || 'oui';
      const p = nouvelInvite(annuel, { prenom, nom: noms[i], groupe: services[i % services.length], reponse, fonction: i === 0 ? 'Organisation' : i === 5 ? 'Intervenant' : '', societe: 'Maison Tilleul',
        regime: regimes[i] || '', allergie: i === 7 || i === 22, acces: i === 16, hebergement: i !== 10 });
      E.invites.push(p);
      if (reponse === 'non') return;
      if (lyon.has(i)) { p.allerId = car.id; p.retourId = retCar.id; }
      else if (tardifs.has(i)) { p.allerId = trainB.id; p.retourId = i === 32 ? retA.id : retB.id; }
      else { p.allerId = trainA.id; p.retourId = retA.id; }
      if (i === 1 || i === 24) { p.allerId = 'perso'; p.retourId = 'perso'; }
      if (i === 6 || i === 27) { p.allerId = ''; p.retourId = ''; } // pas encore réservés
      if (i === 13) p.retourId = '';
    });
    E.invites.find((p) => p.evtId === annuel.id && p.acces).chambreId = chambres[20].id;
    const rep = R.repartir(annuel, deEvt(E.invites, annuel.id), deEvt(E.chambres, annuel.id));
    Object.entries(rep.affectations).forEach(([pid, cid]) => { E.invites.find((p) => p.id === pid).chambreId = cid; });
    deEvt(E.invites, annuel.id).filter((p) => p.reponse === 'oui' && p.chambreId).slice(-2).forEach((p) => { p.chambreId = ''; }); // deux confirmations tardives à loger
    E.invites.push(nouvelInvite(annuel, { prenom: 'Basile', nom: 'Perrin', groupe: 'Ventes', societe: 'Maison Tilleul', allerId: car.id, retourId: retCar.id })); // car de Lyon : une place de trop
    const S = deEvt(E.conducteur, annuel.id);
    const anim = { 'Ouverture par la direction': 'Léa Martin', 'Intervention invitée': 'Camille Robert', 'Ateliers (groupe A)': 'Manon Petit', 'Ateliers (groupe B)': 'Hugo Bernard', 'Ateliers (groupe C)': 'Sarah Leroy', 'Activité de cohésion': 'Prestataire d\'activités' };
    S.forEach((x) => { x.responsable = anim[x.titre] || ''; });
    S.find((x) => x.titre === 'Intervention invitée').titre = 'Intervention invitée : travailler en mode projet';
    S.find((x) => x.titre === 'Activité de cohésion').titre = 'Activité de cohésion : course d\'orientation';
    E.conducteur.push({ id: uid(), evtId: annuel.id, jour: 1, heure: '15:00', duree: 30, titre: 'Visio avec l\'équipe du siège', type: 'pleniere', lieu: 'Salle 1', responsable: 'Louis Richard', notes: 'À déplacer : la salle 1 est prise par l\'atelier A.' });
    prevusDemo(annuel, { 'Lieu et salles': 10000, Hébergement: 7600, Restauration: 9000, Boissons: 1200, Transports: 5200, 'Activités et cohésion': 2000, 'Intervenants et animation': 2000, 'Technique (son, vidéo)': 900, 'Kits et cadeaux participants': 1100, Imprévus: 1500 });
    const domaine = prestaDemo('Domaine des Grands Chênes', 'Lieu', 'Service séminaires', '04 00 00 00 06', 'seminaires@exemple.fr');
    const agence = prestaDemo('Agence de voyages Boréal', 'Transport', 'Groupes', '01 00 00 00 09');
    const autocar = prestaDemo('Autocars du Val', 'Transport', 'Exploitation', '04 00 00 00 10');
    const activites = prestaDemo('Plein Air Organisation', 'Animation', 'Chef de projet');
    const intervenante = prestaDemo('Intervenante indépendante', 'Animation', 'Camille Robert');
    contratDemo(annuel, domaine, 'Lieu et salles', 'Plénière, 3 salles d\'atelier, 2 jours', 9800, 'signe', 'Contrat DGC-2027-04', [['Acompte 30 %', 2940, ajout(t, -20), ajout(t, -18)], ['Solde', 6860, ajout(t, 12), null]]);
    contratDemo(annuel, domaine, 'Hébergement', '22 chambres, 1 nuit', 7260, 'signe', 'Même contrat, annexe 2', [['Acompte 30 %', 2178, ajout(t, -20), ajout(t, -18)], ['Solde', 5082, ajout(t, 12), null]]);
    contratDemo(annuel, domaine, 'Restauration', 'Déjeuners, dîner, petit déjeuner', 8640, 'signe', 'Même contrat, annexe 3', [['Solde', 8640, ajout(t, 26), null]]);
    contratDemo(annuel, agence, 'Transports', 'Billets de train de groupe aller et retour', 3120, 'signe', 'Dossier GR-4471 / GR-4472', [['Paiement', 3120, ajout(t, -15), ajout(t, -15)]]);
    contratDemo(annuel, autocar, 'Transports', 'Car Lyon aller et retour', 1480, 'devis', 'Devis n° 58', []);
    contratDemo(annuel, activites, 'Activités et cohésion', 'Course d\'orientation encadrée', 2450, 'signe', '', [['Facture', 2450, ajout(t, -3), null]]);
    contratDemo(annuel, intervenante, 'Intervenants et animation', 'Intervention et support', 1800, 'signe', '', [['Facture', 1800, ajout(t, 5), null]]);
    if (complet) {
      const integration = creerEvenement({ nom: 'Journée d\'intégration des nouveaux', type: 'seminaire', date: ajout(t, 61), nbJours: 1, lieu: 'Tiers-lieu Les Ateliers', depart: 'Paris', limite: ajout(t, 40), modules: { tables: false, transports: false, hebergement: false, badges: true, enfants: false } }, { retro: true, postes: true, conducteur: true, passees: 'aujourdhui' });
      ['Ambre Colin', 'Bilal Noël', 'Céline Royer', 'Damien Lucas', 'Élise Brun', 'Félix Caron', 'Gaëlle Picard', 'Ilan Marchand', 'Jeanne Aubert', 'Kevin Renard', 'Laura Gauthier', 'Mehdi Perrot'].forEach((n, i) => {
        const [prenom, nom] = n.split(' ');
        E.invites.push(nouvelInvite(integration, { prenom, nom, groupe: services[(i + 3) % services.length], reponse: i < 5 ? 'oui' : 'attente', hebergement: false, allerId: 'perso', retourId: 'perso' }));
      });
      prevusDemo(integration, { 'Lieu et salles': 1500, Restauration: 1400, 'Activités et cohésion': 900, Imprévus: 200 });
    }
    return annuel;
  }
  // Séminaire passé : données sensibles encore présentes (alerte d'effacement).
  function demoOffsitePasse() {
    const t = auj();
    const offsite = creerEvenement({ nom: 'Offsite de l\'équipe Produit', type: 'seminaire', date: ajout(t, -40), nbJours: 2, lieu: 'Gîte du Val Clair', depart: 'Lyon', limite: ajout(t, -60), modules: { tables: false, transports: false, hebergement: false, badges: false, enfants: false } }, {});
    ['Olivia Fabre', 'Pierre Masson', 'Quentin Lemoine', 'Romane Dumas', 'Simon Barbier', 'Tess Hubert', 'Ugo Leclerc', 'Valentin Rey'].forEach((n, i) => {
      const [prenom, nom] = n.split(' ');
      E.invites.push(nouvelInvite(offsite, { prenom, nom, groupe: 'Produit', reponse: i === 7 ? 'non' : 'oui', allerId: 'perso', retourId: 'perso', regime: i === 2 ? 'Végétarien' : '', allergie: i === 4 }));
    });
    return offsite;
  }

  function demoMariage() {
    const t = auj();
    const mariage = creerEvenement({ nom: 'Mariage de Léa et Malik', type: 'mariage', date: ajout(t, 140), heure: '15:00', lieu: 'Domaine des Tilleuls (exemple)', client: 'Léa et Malik', noms: ['Léa', 'Malik'], limite: ajout(t, 50), budgetCible: 3500000 },
      { retro: true, postes: true, conducteur: true, checklist: true, passees: 'garder' });
    const retard = ['Contacter la mairie : rendez-vous, liste des pièces et délais du dossier de mariage', 'Choisir et commander les faire-part'];
    deEvt(E.taches, mariage.id).forEach((x, i) => {
      const e = R.echeance(x, mariage);
      x.responsable = i % 3 === 0 ? 'Malik' : 'Léa';
      if (e < t && !retard.includes(x.titre)) x.faite = ajout(e, -(i % 4)) < t ? ajout(e, -(i % 4)) : t;
    });
    deEvt(E.taches, mariage.id).find((x) => x.titre.startsWith('Réserver coiffure')).faite = t;
    E.taches.push({ id: uid(), evtId: mariage.id, titre: 'Dégustation chez le traiteur', phase: 'reception', avant: 0, dateFixe: ajout(t, 4), responsable: 'Léa', faite: null, note: 'Apporter la liste des régimes.' });
    prevusDemo(mariage, { 'Lieu de réception': 6500, 'Traiteur et boissons': 9000, 'Pâtisserie et gâteau': 900, 'Tenues et accessoires': 2500, Alliances: 1200, 'Coiffure et maquillage': 600, 'Photo et vidéo': 2200,
      'Musique et animation': 1400, 'Fleurs et décoration': 1300, 'Faire-part et papeterie': 500, Cérémonie: 300, Transport: 600, 'Cadeaux des invités': 400, 'Voyage de noces': 4000, Imprévus: 1500 });
    const P = (nom, metier) => prestaDemo(nom, metier);
    contratDemo(mariage, P('Domaine des Tilleuls', 'Lieu'), 'Lieu de réception', 'Salle, jardin et parking, fin de soirée à 4 h', 6200, 'signe', 'Contrat signé, visite faite', [['Acompte', 1860, ajout(t, -200), ajout(t, -200)], ['Deuxième acompte', 1860, ajout(t, 20), null], ['Solde', 2480, ajout(t, 126), null]]);
    contratDemo(mariage, P('Traiteur Saveurs de saison', 'Traiteur'), 'Traiteur et boissons', 'Devis pour 100 couverts, vin compris', 9800, 'signe', 'Dégustation prévue', [['Acompte', 2940, ajout(t, -60), ajout(t, -58)], ['Deuxième acompte', 2940, ajout(t, -5), null], ['Solde', 3920, ajout(t, 133), null]]);
    contratDemo(mariage, P('Traiteur du Marché', 'Traiteur'), 'Traiteur et boissons', 'Devis gardé en option', 8700, 'devis', 'Devis par e-mail', []);
    contratDemo(mariage, P('Photographe Lumière d\'été', 'Photo et vidéo'), 'Photo et vidéo', 'Reportage de la journée', 2100, 'signe', '', [['Acompte', 630, ajout(t, -150), ajout(t, -150)], ['Solde', 1470, ajout(t, 140), null]]);
    contratDemo(mariage, P('DJ Nuit blanche', 'Musique'), 'Musique et animation', 'Soirée dansante', 1450, 'devis', 'À rappeler', []);
    contratDemo(mariage, P('Fleuriste des Halles', 'Fleurs et décoration'), 'Fleurs et décoration', 'Bouquet et centres de table', 0, 'consulte', '', []);
    contratDemo(mariage, P('Boutique Mariée en ville', 'Tenues'), 'Tenues et accessoires', 'Robe et retouches', 1650, 'signe', '', [['Acompte', 500, ajout(t, -90), ajout(t, -90)], ['Solde', 1150, ajout(t, 30), null]]);
    contratDemo(mariage, P('Bijouterie du Centre', 'Autre'), 'Alliances', 'Deux alliances', 1120, 'signe', '', [['Paiement', 1120, ajout(t, -20), ajout(t, -20)]]);
    contratDemo(mariage, P('Coiffure à domicile', 'Beauté'), 'Coiffure et maquillage', 'Coiffure et maquillage, essai compris', 520, 'signe', '', [['Acompte', 150, t, t], ['Solde', 370, ajout(t, 140), null]]);
    contratDemo(mariage, P('Voitures de collection', 'Transport'), 'Transport', 'Voiture ancienne avec chauffeur', 750, 'annule', 'Écarté : trop cher', []);
    const groupes = suggestionsGroupes(mariage);
    const prenoms = [
      ['Hélène', 'Bernard', 'Sophie', 'Jean', 'Camille', 'Théo', 'Inès', 'Paul', 'Margaux', 'Lucien', 'Rose*', 'Arthur*', 'Odile', 'Gérard'],
      ['Nadia', 'Karim', 'Samia', 'Yanis', 'Leïla', 'Mehdi', 'Sarah', 'Adam*', 'Lina*', 'Rachid', 'Fatima', 'Omar'],
      ['Julie', 'Thomas', 'Emma', 'Hugo', 'Chloé', 'Louis', 'Manon', 'Nathan', 'Clara', 'Antoine', 'Zoé*'],
      ['Pauline', 'Marion', 'Anaïs', 'Laura', 'Élodie', 'Justine', 'Mathilde', 'Céline'],
      ['Sofiane', 'Bilal', 'Kevin', 'Romain', 'Maxime', 'Julien', 'Nicolas'],
      ['Valérie', 'Stéphane', 'Aurélie', 'Damien', 'Isabelle', 'Fabrice', 'Sandrine'],
    ];
    const initiales = 'BDFGHKLMNPRSTV';
    let k = 0;
    prenoms.forEach((liste, gi) => liste.forEach((p) => {
      const enfant = p.endsWith('*');
      const r = k % 9;
      E.invites.push(nouvelInvite(mariage, { prenom: p.replace('*', ''), nom: `${initiales[(k * 5 + gi) % initiales.length]}.`, groupe: groupes[gi], enfant, reponse: gi === 5 && k % 2 ? 'attente' : r === 4 ? 'non' : r === 2 || r === 7 ? 'attente' : 'oui',
        regime: enfant ? 'Menu enfant' : k % 11 === 3 ? 'Végétarien' : k % 17 === 6 ? 'Sans porc' : k === 20 ? 'Végétalien' : '', allergie: k === 15 || k === 33, allergieDetail: k === 15 ? 'Fruits à coque' : k === 33 ? 'Crustacés' : '' }));
      k += 1;
    }));
    const tables = [{ id: uid(), evtId: mariage.id, nom: 'Table d\'honneur', places: 8 }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: uid(), evtId: mariage.id, nom: `Table ${n}`, places: 10 }))];
    E.tables.push(...tables);
    const I = deEvt(E.invites, mariage.id);
    let ti = 1, n = 0;
    const venus = I.filter((i) => i.reponse !== 'non');
    venus.forEach((i, idx) => {
      if (idx >= venus.length - 3) return; // derniers : à placer
      if (n >= tables[ti].places) { ti = Math.min(ti + 1, tables.length - 1); n = 0; }
      i.tableId = tables[ti].id; n += 1;
    });
    [0, 1, 14, 15, 26, 27].forEach((x) => { if (I[x].reponse !== 'non') I[x].tableId = tables[0].id; });
    I.filter((i) => i.reponse === 'oui').slice(-2).forEach((i) => { i.tableId = null; });
    const t2 = tables[2];
    let n2 = I.filter((i) => i.tableId === t2.id && i.reponse !== 'non').length;
    for (const i of I.filter((x) => x.reponse !== 'non' && x.tableId && x.tableId !== t2.id && x.tableId !== tables[0].id)) { if (n2 > t2.places) break; i.tableId = t2.id; n2 += 1; }
    I.find((i) => i.reponse === 'non').tableId = tables[4].id;
    const qui = { 'Coiffure et maquillage': 'Samia', 'Départ vers la cérémonie': 'Thomas', 'Photos de groupe': 'Julie', 'Vin d\'honneur': 'Hugo' };
    deEvt(E.conducteur, mariage.id).forEach((x) => { x.responsable = qui[x.titre] || ''; });
    const quiCheck = { 'Alliances confiées à un témoin': 'Nadia', 'Enveloppes des paiements du jour remises': 'Thomas', 'Plan de table affiché à l\'entrée': 'Julie', 'Discours et musiques transmis à l\'animateur': 'Hugo' };
    deEvt(E.checklist, mariage.id).forEach((x, i) => { x.responsable = quiCheck[x.libelle] || ''; x.fait = i === 0; });
    return mariage;
  }

  function demoFete() {
    const t = auj();
    const fete = creerEvenement({ nom: 'Les 60 ans de Martine', type: 'fete', format: 'anniversaire', date: ajout(t, 45), heure: '12:00', lieu: 'Salle des fêtes de Saint-Aubin (exemple)', client: 'Surprise pour Martine', limite: ajout(t, 10), budgetCible: 250000 },
      { retro: true, postes: true, conducteur: true, checklist: true, passees: 'garder' });
    avancerTaches(fete, 1, ['Claire', 'Paul']);
    prevusDemo(fete, { 'Lieu ou salle': 350, 'Traiteur ou repas': 1200, Boissons: 250, Gâteau: 120, Décoration: 150, 'Animation et musique': 200, Invitations: 40, 'Location de matériel': 100, Imprévus: 100 });
    contratDemo(fete, prestaDemo('Mairie de Saint-Aubin (salle des fêtes)', 'Lieu'), 'Lieu ou salle', 'Location de la salle, samedi et dimanche matin', 320, 'signe', 'Convention de location', [['Caution et location', 320, ajout(t, -12), ajout(t, -12)]]);
    contratDemo(fete, prestaDemo('Traiteur Chez Gaby', 'Traiteur'), 'Traiteur ou repas', 'Buffet pour 45 personnes', 1350, 'signe', 'Devis accepté', [['Acompte 30 %', 405, ajout(t, -5), ajout(t, -5)], ['Solde', 945, ajout(t, 45), null]]);
    contratDemo(fete, prestaDemo('Pâtisserie Fleur de sucre', 'Pâtisserie'), 'Gâteau', 'Gâteau 45 parts', 180, 'devis', '', []);
    const tables = ['Table de Martine', 'Table des cousins', 'Table des amis', 'Table des enfants', 'Table des voisins'].map((nom, i) => ({ id: uid(), evtId: fete.id, nom, places: i === 3 ? 10 : 8 }));
    E.tables.push(...tables);
    const liste = [['Martine', 'Famille'], ['Gérard', 'Famille'], ['Claire', 'Famille'], ['Paul', 'Famille'], ['Lucie', 'Famille'], ['Romain', 'Famille'], ['Nina*', 'Famille'], ['Lou*', 'Famille'], ['Sacha*', 'Famille'], ['Odette', 'Famille'],
      ['Bernard', 'Famille'], ['Mireille', 'Famille'], ['Hugo*', 'Famille'], ['Inès*', 'Famille'], ['Sylvie', 'Amis'], ['Alain', 'Amis'], ['Françoise', 'Amis'], ['Michel', 'Amis'], ['Catherine', 'Amis'], ['Patrick', 'Amis'],
      ['Nadine', 'Amis'], ['Jacques', 'Amis'], ['Monique', 'Voisins'], ['Daniel', 'Voisins'], ['Josiane', 'Voisins'], ['René', 'Voisins'], ['Agnès', 'Collègues'], ['Thierry', 'Collègues'], ['Brigitte', 'Collègues'], ['Éric', 'Collègues']];
    liste.forEach(([p, g], i) => {
      const enfant = p.endsWith('*');
      const reponse = i % 11 === 7 ? 'non' : i % 6 === 5 ? 'attente' : 'oui';
      E.invites.push(nouvelInvite(fete, { prenom: p.replace('*', ''), nom: `${'BCDFGLMPRT'[i % 10]}.`, groupe: g, enfant, reponse, regime: enfant ? 'Menu enfant' : i === 16 ? 'Végétarien' : '', allergie: i === 20, allergieDetail: i === 20 ? 'Gluten' : '',
        tableId: reponse === 'non' ? null : i < 6 ? tables[0].id : enfant ? tables[3].id : g === 'Famille' ? tables[1].id : g === 'Amis' ? tables[2].id : i > 25 ? null : tables[4].id }));
    });
    deEvt(E.conducteur, fete.id).forEach((x, i) => { x.responsable = ['Claire', 'Paul', 'Traiteur', 'Claire', 'Lucie', 'Tous'][i] || ''; });
    return fete;
  }

  function donneesDemo(variante = 'tout') {
    E = R.etatVide();
    E.demoVariante = variante;
    let courant;
    if (variante === 'mariage') { E.structure = 'Léa et Malik (exemple)'; courant = demoMariage(); }
    else if (variante === 'seminaire') { E.structure = 'Maison Tilleul (exemple)'; E.reglages.convention = 'HT'; courant = demoSeminaire(true); demoOffsitePasse(); }
    else if (variante === 'entreprise') { E.structure = 'Agence Horizon (exemple)'; E.reglages.convention = 'HT'; courant = demoEntreprise(true); }
    else if (variante === 'fete') { E.structure = 'Famille Martin (exemple)'; courant = demoFete(); }
    else { E.structure = 'Exemples de chaque type'; courant = demoEntreprise(false); demoSeminaire(false); demoFete(); demoMariage(); demoOffsitePasse(); }
    ui.evtId = courant.id; memoUi();
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const FORME_VIDE = '<svg class="forme-vide" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true"><rect x="8" y="40" width="48" height="48" fill="#1D4E89"/><circle cx="58" cy="34" r="26" fill="#D9302A"/><path d="M40 88 A48 48 0 0 1 88 40 V88 Z" fill="#F5B400"/></svg>';
  const vide = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

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
          <p class="surtitre">Organisateur d'événement · mariage, séminaire, entreprise, fête</p>
          <h1>Tous tes événements, un seul tableau de bord.</h1>
          <p>Rétroplanning calé sur la date, budget et prestataires, invités et réponses, plan de table, transports et chambres, conducteur du jour J.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton organisateur</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes événements sont enregistrés en ligne et te suivent, toi et ceux qui organisent avec toi, sur tous vos appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon organisateur</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Exemples : ${[['mariage', 'mariage'], ['seminaire', 'séminaire'], ['entreprise', 'entreprise'], ['fete', 'fête de famille']].map(([v, l]) => `<button type="button" class="btn lien" data-action="demo-modele" data-v="${v}">${l}</button>`).join(' · ')}</p>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/evenementiel/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon organisateur'; champ.focus();
      }
    });
  }

  // ---------- Formulaire d'événement (premier lancement et fenêtre) ----------
  let accueil = { etape: 1, structure: '', convention: 'TTC', type: 'mariage' };
  function champsEvenement(e = {}, creation = true) {
    const t = auj();
    const type = e.type || accueil.type || 'mariage';
    const ty = typeEvt(type);
    const modules = e.modules || R.modulesParDefaut(type, e.format, e.nbJours || (type === 'seminaire' ? 2 : 1));
    const m = ty.mots;
    return `
      <label class="champ">Nom de l'événement<input name="nom" required maxlength="80" value="${esc(e.nom || '')}" placeholder="${esc({ mariage: 'Ex. : Mariage de Léa et Malik', seminaire: 'Ex. : Séminaire annuel des managers', entreprise: 'Ex. : Soirée de lancement', fete: 'Ex. : Les 60 ans de Martine' }[type])}"></label>
      <div class="deux">
        <label class="champ">Type<select name="type" data-type-evt>${B.types.map((x) => `<option value="${x.id}" ${x.id === type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ" data-si-format ${ty.formats ? '' : 'hidden'}>Format<select name="format">${(ty.formats || []).map((f) => `<option value="${f.id}" ${f.id === e.format ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="deux" data-si-noms ${type === 'mariage' ? '' : 'hidden'}>
        <label class="champ">Premier prénom<small>Facultatif : nomme les groupes d'invités.</small><input name="n1" maxlength="30" value="${esc(e.noms?.[0] || '')}" autocomplete="off"></label>
        <label class="champ">Second prénom<small>Facultatif.</small><input name="n2" maxlength="30" value="${esc(e.noms?.[1] || '')}" autocomplete="off"></label>
      </div>
      <div class="deux">
        <label class="champ">Date (premier jour)<input type="date" name="date" required value="${esc(e.date || ajout(t, type === 'mariage' ? 300 : 60))}"></label>
        <label class="champ">Nombre de jours<small>2 jours = 1 nuit sur place</small><input type="number" name="nbJours" min="1" max="15" value="${e.nbJours || (type === 'seminaire' ? 2 : 1)}"></label>
      </div>
      <div class="deux">
        <label class="champ">Heure de début<small>Facultative</small><input type="time" name="heure" value="${esc(e.heure || '')}"></label>
        <label class="champ">Date limite de réponse<small>Facultative : relance signalée</small><input type="date" name="limite" value="${esc(e.limite || '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Lieu<small>Facultatif</small><input name="lieu" maxlength="80" value="${esc(e.lieu || '')}"></label>
        <label class="champ"><span data-libelle-client>${esc(m.client)}</span><small>Facultatif</small><input name="client" maxlength="80" value="${esc(e.client || '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Budget cible (${esc(E?.reglages.convention || accueil.convention)})<small>Facultatif : comparé au total engagé.</small><input name="budgetCible" inputmode="decimal" value="${R.champMontant(e.budgetCible || null)}" placeholder="Ex. : 15 000"></label>
        <label class="champ" data-si-depart ${modules.transports ? '' : 'hidden'}>Ville de départ<small>Facultative : proposée pour les trajets</small><input name="depart" maxlength="60" value="${esc(e.depart || '')}" placeholder="Ex. : Paris"></label>
      </div>
      <fieldset class="choix-base"><legend>Fonctions de cet événement <small>Proposées selon le type ; tout se change ensuite.</small></legend>
        <div class="choix-modules">${B.modules.map((x) => `<label class="case"><input type="checkbox" name="m-${x.id}" ${modules[x.id] ? 'checked' : ''}> <span><b>${esc(x.nom)}</b> <small>${esc(x.aide)}</small></span></label>`).join('')}</div>
      </fieldset>
      ${creation ? `<fieldset class="choix-base"><legend>Partir de la base intégrée <small>Selon le type choisi ; tout reste modifiable.</small></legend>
        <label class="case"><input type="checkbox" name="retro" checked> Rétroplanning type (échéances relatives à la date)</label>
        <label class="case"><input type="checkbox" name="postes" checked> Postes de budget types (sans montant)</label>
        <label class="case"><input type="checkbox" name="conducteur" checked> Déroulé type du jour J (horaires à adapter)</label>
        <label class="case"><input type="checkbox" name="checklist" checked> Checklist du jour J</label>
      </fieldset>` : ''}
      <p class="erreur" role="alert"></p>`;
  }
  // Le formulaire s'adapte au type choisi : formats, prénoms des mariés, libellés et fonctions proposées (création).
  function brancherFormEvenement(zone, creation) {
    const sel = zone.querySelector('[data-type-evt]');
    if (!sel) return;
    const majDepart = () => { zone.querySelector('[data-si-depart]').hidden = !zone.querySelector('[name="m-transports"]').checked; };
    sel.addEventListener('change', () => {
      const ty = typeEvt(sel.value);
      const f = zone.querySelector('[data-si-format]');
      f.hidden = !ty.formats;
      f.querySelector('select').innerHTML = (ty.formats || []).map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('');
      zone.querySelector('[data-si-noms]').hidden = sel.value !== 'mariage';
      zone.querySelector('[data-libelle-client]').textContent = ty.mots.client;
      if (creation) {
        // Durée par défaut du type (séminaire : 2 jours, soit une nuit sur place), puis ses fonctions.
        const nb = zone.querySelector('[name=nbJours]');
        if (sel.value === 'seminaire' && Number(nb.value) === 1) nb.value = 2;
        else if (sel.value !== 'seminaire' && Number(nb.value) === 2) nb.value = 1;
        const m = R.modulesParDefaut(sel.value, ty.formats?.[0]?.id, Number(nb.value) || 1);
        B.modules.forEach((x) => { zone.querySelector(`[name="m-${x.id}"]`).checked = m[x.id]; });
      }
      majDepart();
    });
    zone.querySelector('[name="m-transports"]').addEventListener('change', majDepart);
    zone.querySelector('[name=format]')?.addEventListener('change', (ev) => { if (creation && sel.value === 'entreprise') zone.querySelector('[name="m-tables"]').checked = ev.target.value === 'gala'; });
    zone.querySelector('[name=nbJours]').addEventListener('change', (ev) => { if (creation && sel.value === 'seminaire') zone.querySelector('[name="m-hebergement"]').checked = Number(ev.target.value) > 1; });
  }
  function lireEvenement(f) {
    const nom = String(f.get('nom') || '').trim();
    const date = f.get('date');
    if (!nom) return 'Indique le nom de l\'événement.';
    if (!R.estDate(date)) return 'Indique une date valide.';
    const nbJours = Number(f.get('nbJours')) || 1;
    if (!Number.isInteger(nbJours) || nbJours < 1 || nbJours > 15) return 'Nombre de jours : entre 1 et 15.';
    const limite = f.get('limite') || '';
    if (limite && !R.estDate(limite)) return 'Date limite invalide.';
    const budgetCible = R.lireMontant(f.get('budgetCible'));
    if (budgetCible === null || budgetCible < 0) return 'Budget cible illisible (ex. : 15 000 ou 15000,50).';
    const type = R.TYPES.includes(f.get('type')) ? f.get('type') : 'entreprise';
    const formats = typeEvt(type).formats || [];
    const format = formats.some((x) => x.id === f.get('format')) ? f.get('format') : (formats[0]?.id || '');
    const modules = Object.fromEntries(R.MODULES.map((m) => [m, f.has(`m-${m}`)]));
    return { nom, date, nbJours, limite, budgetCible, type, format, modules, heure: f.get('heure') || '', lieu: String(f.get('lieu') || '').trim(), client: String(f.get('client') || '').trim(),
      depart: String(f.get('depart') || '').trim(), noms: [String(f.get('n1') || '').trim(), String(f.get('n2') || '').trim()] };
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-lancement" aria-label="Étape ${a.etape} sur 3">${[1, 2, 3].map((n) => `<span class="${a.etape >= n ? 'actif' : ''}"></span>`).join('')}</div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton organisateur d'événement.</h1>
        <p class="intro">Deux réglages, puis ton premier événement. Tout reste modifiable ensuite dans les réglages.</p>
        <form id="form-accueil" class="pile" style="max-width:520px">
          <label class="champ">Nom affiché<small>Facultatif : ta structure, ton service, ton association ou ta famille. Il s'affiche sur le tableau de bord.</small><input id="structure" maxlength="60" value="${esc(a.structure)}" autocomplete="organization"></label>
          <fieldset class="choix-base"><legend>Tu saisis tes montants… <small>Simple libellé : garde la même convention partout.</small></legend>
            <label class="case"><input type="radio" name="convention" value="TTC" ${a.convention === 'TTC' ? 'checked' : ''}> Toutes taxes comprises (TTC), le plus courant pour un particulier</label>
            <label class="case"><input type="radio" name="convention" value="HT" ${a.convention === 'HT' ? 'checked' : ''}> Hors taxes (HT)</label>
          </fieldset>
        </form>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else if (a.etape === 2) {
      corps = `
        <p class="surtitre">Premier événement</p>
        <h1>Que prépares-tu ?</h1>
        <p class="intro">Choisis un modèle : il propose son rétroplanning, ses postes de budget, son déroulé et les fonctions utiles. Tu pourras suivre ensuite plusieurs événements de types différents.</p>
        <div class="modeles">${B.types.map((x) => `<button type="button" class="modele" data-action="accueil-type" data-v="${x.id}" style="--c:${couleur(x.couleur)}"><i></i><b>${esc(x.nom)}</b><span>${esc(x.phrase)}</span></button>`).join('')}</div>
        <div class="accueil-pied"><button class="btn" type="button" data-action="accueil-retour">Retour</button><button class="btn" type="button" data-action="accueil-vide">Partir de zéro</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${esc(typeEvt(a.type).nom)}</p>
        <h1>Quel est ton prochain événement ?</h1>
        <p class="intro">Le rétroplanning type se cale sur sa date : changer la date décale toutes les échéances. Les tâches dont l'échéance est déjà passée sont ramenées à aujourd'hui.</p>
        <form id="form-premier" class="pile" style="max-width:680px" novalidate>${champsEvenement({ type: a.type })}
          <div class="accueil-pied">
            <button class="btn" type="button" data-action="accueil-retour">Retour</button>
            <button class="btn primaire" type="submit">Créer l'événement</button>
          </div>
        </form>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#structure')?.addEventListener('input', (e) => { accueil.structure = e.target.value; });
    document.querySelectorAll('[name=convention]').forEach((r) => r.addEventListener('change', () => { accueil.convention = r.value; }));
    const form = $('#form-premier');
    if (form) brancherFormEvenement(form, true);
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      E = R.etatVide();
      E.reglages.convention = accueil.convention;
      const d = lireEvenement(f);
      if (typeof d === 'string') { E = null; $('#form-premier .erreur').textContent = d; return; }
      E.structure = accueil.structure.trim();
      const ev = creerEvenement(d, { retro: f.has('retro'), postes: f.has('postes'), conducteur: f.has('conducteur'), checklist: f.has('checklist'), passees: 'aujourdhui' });
      ui.evtId = ev.id; memoUi();
      accueil = { etape: 1, structure: '', convention: 'TTC', type: 'mariage' };
      sauver(); vue = 'bord'; demarrer();
      toast(`« ${ev.nom} » créé : ${pluriel(deEvt(E.taches, ev.id).length, 'tâche')} au rétroplanning.`);
    });
  }
  function terminerAccueilVide() {
    E = R.etatVide();
    E.structure = accueil.structure.trim();
    E.reglages.convention = accueil.convention;
    accueil = { etape: 1, structure: '', convention: 'TTC', type: 'mariage' };
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
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  // Onglets : le libellé des invités et du jour J suit le type de l'événement affiché.
  const onglets = (e) => [['bord', 'Tableau de bord', 'Bord'], ['retro', 'Rétroplanning', 'Rétro'], ['budget', 'Budget', 'Budget'], ['invites', mots(e).invites, mots(e).court], ['jourj', mots(e).jourj, mots(e).jourj]];
  const VUES = ['bord', 'retro', 'budget', 'invites', 'jourj'];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    const variantes = [['tout', 'Tout'], ['mariage', 'Mariage'], ['seminaire', 'Séminaire'], ['entreprise', 'Entreprise'], ['fete', 'Fête']];
    $('#racine').innerHTML = `
      ${session.demo ? `<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d'exemple fictives, gardées sur cet appareil uniquement.</span><span class="demo-modeles" role="group" aria-label="Exemple affiché">Exemple :${variantes.map(([v, l]) => `<button data-action="demo-modele" data-v="${v}" aria-pressed="${(E.demoVariante || 'tout') === v}">${l}</button>`).join('')}</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J'ai un code d'accès</button></div></div>` : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Organisateur<br>d'événement</span>
        <nav class="onglets" aria-label="Sections">${onglets(null).map(([id, nom, court]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span data-court="${esc(court)}">${esc(nom)}</span></button>`).join('')}</nav>
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
    const e = evtCourant();
    const ong = onglets(e);
    document.querySelectorAll('.onglet').forEach((b) => {
      const o = ong.find(([id]) => id === b.dataset.vue);
      const sp = b.querySelector('span');
      if (sp.textContent !== o[1]) { sp.textContent = o[1]; sp.dataset.court = o[2]; }
      if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.title = `${ong.find(([id]) => id === vue)[1]} · ${NOM}`;
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
  const vueSansEvenement = () => vide('Aucun événement', 'Crée ton premier événement : mariage, séminaire, événement d\'entreprise ou fête. Le rétroplanning, le budget, les invités et le déroulé du jour J s\'y rattachent.', `<button class="btn primaire" data-action="evt-nouveau">${ICONES.plus}Nouvel événement</button>`);

  // Bandeau de l'événement choisi, en tête des vues 2 à 5.
  function enteteEvenement(e, titre, actions = '') {
    const t = auj();
    const ty = typeEvt(e.type);
    const jours = e.nbJours > 1 ? ` au ${fmt(R.finEvenement(e), { day: 'numeric', month: 'long' })}` : '';
    return `
      <div class="evt-bandeau" style="--c:${couleur(ty.couleur)};--t:${texteSur(ty.couleur)}">
        <label class="evt-choix"><span class="sr-only">Événement</span><select data-action="filtre-evt" aria-label="Événement affiché">${evenementsTries().map((x) => `<option value="${x.id}" ${x.id === e.id ? 'selected' : ''}>${esc(x.nom)} · ${R.dateFr(x.date)}${R.evenementPasse(x, t) ? ' (terminé)' : ''}</option>`).join('')}</select></label>
        <span class="evt-info"><b class="rebours">${R.compteRebours(e, t)}</b><span>${esc(libelleType(e))} · ${fmtLong(e.date)}${jours}${e.heure ? ` · ${heureFr(e.heure)}` : ''}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</span></span>
        <span class="rang"><button class="btn petit" data-action="evt-modifier" data-id="${e.id}">Modifier</button><button class="btn petit" data-action="evt-nouveau" aria-label="Nouvel événement">${ICONES.plus}<span class="masque-tel">Événement</span></button></span>
      </div>
      <div class="vue-tete"><div><h1>${titre}</h1></div><div class="actions">${actions}</div></div>`;
  }

  // ----- Tableau de bord -----
  function vueBord() {
    const t = auj();
    const venir = aVenir();
    const passes = evenementsTries().filter((e) => R.evenementPasse(e, t)).reverse();
    const al = R.alertes(E, t, B.regimes);
    const nbRetard = venir.reduce((s, e) => s + R.resumeEvenement(E, e, t, B.regimes).retard, 0);
    const ech = R.echeancier(E, t).filter((x) => x.etat !== 'avenir');
    const totEch = ech.reduce((s, x) => s + x.echeance.montant, 0);
    const invOui = venir.reduce((s, e) => s + R.statsInvites(deEvt(E.invites, e.id), B.regimes).oui, 0);
    const tuiles = [
      ['Événements à venir', venir.length, venir[0] ? `Prochain : ${esc(venir[0].nom)} (${R.compteRebours(venir[0], t)})` : 'Aucun événement programmé.', 'var(--bleu)', 'rond'],
      ['Tâches en retard', nbRetard, 'Tous événements à venir confondus.', 'var(--rouge)', ''],
      ['Paiements à suivre', ech.length, ech.length ? `${eur(totEch)} en retard ou sous 14 jours.` : 'Rien d\'urgent sous 14 jours.', 'var(--jaune)', ''],
      ['Confirmés', invOui, 'Réponses « oui » des événements à venir.', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const charge = venir.length ? R.chargeResponsables(E, t, venir.map((e) => e.id)) : [];
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.structure || 'Tableau de bord')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${venir.length ? `${pluriel(venir.length, 'événement')} en préparation.` : 'Aucun événement à venir.'}</h1></div>
        <div class="actions"><button class="btn primaire" data-action="evt-nouveau">${ICONES.plus}Nouvel événement</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Événements à venir <span>Du plus proche au plus lointain.</span></h2>
      ${venir.length ? `<div class="evts">${venir.map((e) => carteEvenement(e, t)).join('')}</div>` : vueSansEvenement()}
      <div class="bord-bas">
        <section><h2 class="titre-section">Alertes <span>${al.length ? 'Les plus urgentes d\'abord.' : ''}</span></h2>${al.length ? `<ul class="alertes">${al.slice(0, 14).map(ligneAlerte).join('')}</ul>${al.length > 14 ? `<p class="aide">Et ${pluriel(al.length - 14, 'autre alerte')}, à retrouver dans chaque événement.</p>` : ''}` : '<p class="ligne-vide">Aucune alerte : tout est à jour.</p>'}</section>
        <section><h2 class="titre-section">Charge par responsable <span>Tâches ouvertes</span></h2>${charge.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Responsable</th><th class="nb">Ouvertes</th><th class="nb">Cette semaine</th><th class="nb">En retard</th></tr></thead><tbody>${charge.map((r) => `<tr><td>${esc(r.nom)}</td><td class="nb">${r.ouvertes}</td><td class="nb">${r.semaine}</td><td class="nb ${r.retard ? 'rouge-t' : ''}">${r.retard}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ligne-vide">Aucune tâche ouverte.</p>'}</section>
      </div>
      ${passes.length ? `<details class="faites"><summary>Événements terminés (${passes.length})</summary>${passes.map((e) => { const r = R.resumeEvenement(E, e, t, B.regimes); return `<div class="ligne-faite" style="--c:${couleur(typeEvt(e.type).couleur)}"><i></i><span><b>${esc(e.nom)}</b> · ${esc(typeEvt(e.type).court)} · ${R.dateFr(e.date)} · ${r.faites}/${r.taches} tâches · payé ${eur(r.budget.paye)} sur ${eur(r.budget.engage)} engagés</span><button class="btn petit" data-action="voir-evt" data-id="${e.id}" data-vue="budget">Ouvrir</button></div>`; }).join('')}</details>` : ''}`;
  }

  function carteEvenement(e, t) {
    const r = R.resumeEvenement(E, e, t, B.regimes);
    const ty = typeEvt(e.type);
    const m = mots(e);
    const ref = r.budgetCible || r.budget.prevu;
    const pctEng = ref ? Math.min(100, Math.round((r.budget.engage / ref) * 100)) : 0;
    const pctPaye = ref ? Math.min(100, Math.round((r.budget.paye / ref) * 100)) : 0;
    const I = deEvt(E.invites, e.id);
    const extras = [];
    if (mod(e, 'tables')) { const p = R.planDeTable(deEvt(E.tables, e.id), I); extras.push(['Plan de table', `${p.occupees} placés / ${p.places} places${p.nonPlaces.length ? ` · <em class="rouge-t">${p.nonPlaces.length} sans table</em>` : ''}`]); }
    if (mod(e, 'transports')) { const s = R.sansTransport(I, deEvt(E.trajets, e.id)); const n = new Set([...s.aller, ...s.retour].map((p) => p.id)).size; extras.push(['Transports', n ? `<em class="rouge-t">${n} sans trajet</em>` : 'tout le monde a son trajet']); }
    if (mod(e, 'hebergement')) { const n = R.aLoger(e, I, deEvt(E.chambres, e.id)).length; extras.push(['Hébergement', n ? `<em class="rouge-t">${n} à loger</em>` : 'tout le monde a sa chambre']); }
    return `
      <article class="evt" style="--c:${couleur(ty.couleur)};--t:${texteSur(ty.couleur)}">
        <div class="evt-tete"><div><p class="evt-type">${esc(libelleType(e))}</p><h3>${esc(e.nom)}</h3><p>${fmt(e.date, { weekday: 'short', day: 'numeric', month: 'long' })}${e.nbJours > 1 ? ` · ${e.nbJours} jours` : ''}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p></div><b class="rebours">${r.rebours}</b></div>
        <div class="evt-corps">
          <div class="evt-ligne"><span>Rétroplanning</span><b>${r.faites}/${r.taches} faites${r.retard ? ` · <em class="rouge-t">${r.retard} en retard</em>` : ''}</b></div>
          <div class="jauge" role="img" aria-label="Avancement ${r.avancement} %"><i style="width:${r.avancement}%"></i></div>
          <div class="evt-ligne"><span>Budget engagé</span><b>${eur(r.budget.engage)} / ${ref ? eur(ref) : 'non chiffré'}${r.depassements ? ` · <em class="rouge-t">${pluriel(r.depassements, 'dépassement')}</em>` : ''}</b></div>
          <div class="jauge double" role="img" aria-label="Payé ${pctPaye} %, engagé ${pctEng} % du ${r.budgetCible ? 'budget cible' : 'prévu'}"><i class="eng" style="width:${pctEng}%"></i><i style="width:${pctPaye}%"></i></div>
          <div class="evt-ligne"><span>${esc(m.invites)}</span><b>${r.invites.oui} oui · ${r.invites.attente} en attente · ${r.invites.non} non</b></div>
          ${extras.map(([a, b]) => `<div class="evt-ligne"><span>${a}</span><b>${b}</b></div>`).join('')}
          <div class="evt-ligne"><span>Prochain paiement</span><b>${r.prochaineEcheance ? `${eur(r.prochaineEcheance.echeance.montant)} ${r.prochaineEcheance.etat === 'retard' ? `<em class="rouge-t">en retard (${quand(r.prochaineEcheance.echeance.date)})</em>` : quand(r.prochaineEcheance.echeance.date)}` : 'aucun'}</b></div>
        </div>
        <div class="evt-pied">${[['retro', 'Rétroplanning'], ['budget', 'Budget'], ['invites', m.invites], ['jourj', m.jourj]].map(([v, l]) => `<button class="btn petit" data-action="voir-evt" data-id="${e.id}" data-vue="${v}">${esc(l)}</button>`).join('')}</div>
      </article>`;
  }

  function ligneAlerte(a) {
    const nom = esc(a.evt.nom);
    const m = mots(a.evt);
    const txt = {
      taches: () => `${pluriel(a.n, 'tâche')} en retard (depuis ${quand(a.date)})`,
      paiement: () => `${a.jours < 0 ? 'Paiement en retard' : 'Paiement'} : ${esc(a.echeance.libelle || 'échéance')} ${eur(a.echeance.montant)} à ${esc(presta(a.contrat.prestaId)?.nom || 'prestataire')}, ${a.jours < 0 ? `dû ${quand(a.date)}` : quand(a.date)}`,
      budget: () => `Dépassement de ${eur(a.ecart)} sur « ${esc(a.poste.nom)} »`,
      cible: () => `Engagé au-delà du budget cible de ${eur(a.ecart)}`,
      planifier: () => `${eur(a.ecart)} restent à planifier dans l'échéancier de ${esc(presta(a.contrat.prestaId)?.nom || 'un contrat')}`,
      relance: () => `${pluriel(a.n, 'réponse')} en attente : la date limite (${fmt(a.evt.limite, { day: 'numeric', month: 'long' })}) est passée, relance`,
      'relance-proche': () => `${pluriel(a.n, 'réponse')} en attente, date limite ${quand(a.evt.limite)}`,
      'sans-aller': () => `${pluriel(a.n, m.invite)} sans trajet aller`,
      'sans-retour': () => `${pluriel(a.n, m.invite)} sans trajet retour`,
      trajet: () => `${esc(nomTrajet(a.o.trajet))} : ${a.o.n} passagers pour ${a.o.places} places`,
      horaire: () => (a.h.type === 'arrivee' ? `${esc(nomTrajet(a.h.trajet))} arrive ${a.h.minutes} min après le début (jour ${a.h.jour}, ${heureFr(a.h.heure)})` : `${esc(nomTrajet(a.h.trajet))} part avant la fin du programme (${heureFr(a.h.heure)})`),
      'a-loger': () => `${pluriel(a.n, m.invite)} à loger${a.manque ? ` : il manque ${pluriel(a.manque, 'place')}` : ', des places sont libres'}`,
      chambre: () => `${esc(a.o.chambre.nom)} : ${a.o.occupants.length} occupants pour ${pluriel(a.o.capacite, 'place')}`,
      table: () => esc(a.texte),
      chevauchement: () => `${pluriel(a.n, `${m.seq} chevauche`, `${m.seq}s chevauchent`)} une autre au même endroit`,
      sensibles: () => `Terminé depuis ${pluriel(a.jours, 'jour')} : ${pluriel(a.n, `${m.invite} a`, `${m.invite}s ont`)} encore un régime, une allergie ou un besoin d'accessibilité enregistré. Efface-les`,
    }[a.type]();
    const bouton = a.type === 'sensibles'
      ? `<button class="btn petit danger" data-action="effacer-sensibles" data-id="${a.evt.id}">Effacer</button>`
      : `<button class="btn petit" data-action="voir-evt" data-id="${a.evt.id}" data-vue="${a.vue}"${a.volet ? ` data-volet="${a.volet}"` : ''}>Voir</button>`;
    return `<li class="alerte ${a.gravite ? '' : 'grave'}"><i></i><span><b>${nom}</b> · ${txt}${txt.endsWith('.') ? '' : '.'}</span>${bouton}</li>`;
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
    const r = R.resumeEvenement(E, e, t, B.regimes);
    const contenu = groupes.map((g, i) => (g.length ? `<h2 class="titre-section">${B.periodes[i].nom} <span>${pluriel(g.length, 'tâche')}</span></h2><ul class="taches">${g.map((x) => ligneTache(x, e, t)).join('')}</ul>` : '')).join('');
    return `
      ${enteteEvenement(e, 'Rétroplanning', `<button class="btn" data-action="modele">Appliquer un rétroplanning type</button><button class="btn primaire" data-action="tache-nouvelle">${ICONES.plus}Tâche</button>`)}
      <div class="resume-retro"><p><b>${r.faites}/${r.taches}</b> tâches faites${r.retard ? ` · <b class="rouge-t">${r.retard} en retard</b>` : ''}${r.semaine ? ` · ${r.semaine} cette semaine` : ''}</p><div class="jauge" role="img" aria-label="Avancement ${r.avancement} %"><i style="width:${r.avancement}%"></i></div></div>
      <div class="filtres">
        <div class="segment" role="group" aria-label="Tâches affichées"><button data-action="filtre-retro" data-v="0" aria-pressed="${!ui.retroTout}">À faire</button><button data-action="filtre-retro" data-v="1" aria-pressed="${ui.retroTout}">Toutes</button></div>
        <label class="champ compact">Responsable<select data-action="filtre-resp"><option value="">Tous</option>${resps.map((n) => `<option ${ui.resp === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="-" ${ui.resp === '-' ? 'selected' : ''}>Sans responsable</option></select></label>
      </div>
      <p class="aide">Les échéances sont calculées depuis la date de l'événement (J-45 = 45 jours avant) : modifier la date de l'événement décale tout le rétroplanning. Délais des modèles indicatifs, à adapter.</p>
      ${contenu || vide(toutes.length ? 'Rien à afficher avec ces filtres.' : 'Aucune tâche', toutes.length ? 'Toutes les tâches filtrées sont faites.' : `Applique le rétroplanning type (${esc(typeEvt(e.type).court.toLowerCase())}) ou ajoute tes tâches une à une.`, toutes.length ? '<button class="btn" data-action="filtre-retro" data-v="1">Afficher toutes les tâches</button>' : '<button class="btn primaire" data-action="modele">Appliquer un rétroplanning type</button>')}
      ${e.type === 'mariage' ? encartDemarches() : ''}`;
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
  function encartDemarches() {
    const s = B.demarches;
    return `<aside class="encart"><h3>${esc(s.titre)}</h3><p>${esc(s.texte)}</p><p class="source">Source : <a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.source)}</a></p></aside>`;
  }

  // ----- Budget -----
  function vueBudget(e) {
    const t = auj();
    const b = R.budget(E, e.id);
    const conv = E.reglages.convention;
    const contrats = deEvt(E.contrats, e.id);
    const ech = R.echeancier(E, t, e.id);
    const st = R.statsInvites(deEvt(E.invites, e.id), B.regimes);
    const cout = R.coutParInvite(b.total, st.oui);
    const m = mots(e);
    const payees = contrats.flatMap((c) => c.echeances.filter((x) => x.payeLe).map((x) => ({ c, x }))).sort((a, z) => z.x.payeLe.localeCompare(a.x.payeLe));
    const cible = e.budgetCible ? `<p class="aide">Budget cible : <b>${eur(e.budgetCible)}</b> · engagé ${eur(b.total.engage)} (${Math.round((b.total.engage / e.budgetCible) * 100)} %) · prévu ${eur(b.total.prevu)}${b.total.prevu > e.budgetCible ? ` · <b class="rouge-t">le prévu dépasse la cible de ${eur(b.total.prevu - e.budgetCible)}</b>` : ''}.</p>` : '';
    const tuiles = [
      ['Prévu', b.total.prevu, cout ? `Soit ${eur(cout.prevu, 0)} par confirmé.` : 'Somme des postes.', 'var(--jaune)', ''],
      ['Engagé', b.total.engage, cout ? `Soit ${eur(cout.engage, 0)} par confirmé · écart ${b.total.ecart > 0 ? '+' : ''}${eur(b.total.ecart)}` : `Contrats signés · écart ${b.total.ecart > 0 ? '+' : ''}${eur(b.total.ecart)}`, 'var(--bleu)', 'rond'],
      ['Payé', b.total.paye, 'Échéances réglées.', 'var(--encre)', ''],
      ['Reste à payer', b.total.reste, ech.some((x) => x.etat === 'retard') ? 'Dont des échéances en retard.' : 'Sur les contrats signés.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib} (${conv})</p><b class="montant">${eur(v)}</b><span>${d}</span></div>`).join('');
    const lignes = [...b.lignes, ...(b.nonAffecte ? [b.nonAffecte] : [])];
    return `
      ${enteteEvenement(e, 'Budget et prestataires', `<button class="btn" data-action="poste-nouveau">${ICONES.plus}Poste</button><button class="btn primaire" data-action="contrat-nouveau">${ICONES.plus}Contrat</button>`)}
      <div class="tuiles">${tuiles}</div>
      ${st.total ? `<p class="aide">Coût par ${esc(m.invite)} = total divisé par les ${pluriel(st.oui, 'confirmé')} (réponse « oui »)${st.attente && b.total.engage ? ` ; avec les ${st.attente} en attente, il passerait à ${eur(Math.round(b.total.engage / Math.max(1, st.oui + st.attente)), 0)} engagés par personne` : ''}.</p>` : ''}
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
        : vide('Aucun poste', 'Ajoute les postes types de ce type d\'événement (sans montant) puis saisis ton prévu.', '<button class="btn primaire" data-action="postes-types">Ajouter les postes types</button>')}
      ${lignes.length ? '<p class="rang-actions"><button class="btn petit" data-action="postes-types">Ajouter des postes types</button></p>' : ''}
      <h2 class="titre-section">Contrats <span>${pluriel(contrats.length, 'contrat')} · documents référencés en texte</span></h2>
      ${contrats.length ? `<div class="contrats">${[...contrats].sort((a, z) => ORDRE_CONTRAT.indexOf(a.statut) - ORDRE_CONTRAT.indexOf(z.statut)).map((c) => carteContrat(c, t)).join('')}</div>` : '<p class="ligne-vide">Aucun contrat. Ajoute un prestataire consulté, son devis, puis le contrat signé et son échéancier d\'acomptes.</p>'}
      <h2 class="titre-section">Échéancier <span>Paiements à venir de cet événement</span></h2>
      ${ech.length ? `<ul class="alertes">${ech.map((x) => `<li class="alerte ${x.etat === 'retard' ? 'grave' : x.etat === 'proche' ? 'proche' : 'calme'}"><i></i><span><b>${fmt(x.echeance.date)}</b> · ${esc(presta(x.contrat.prestaId)?.nom || 'Prestataire')} · ${esc(x.echeance.libelle || 'Échéance')} · <b>${eur(x.echeance.montant)}</b>${x.etat === 'retard' ? ` · <em class="rouge-t">en retard de ${pluriel(-x.jours, 'jour')}</em>` : ''}</span><button class="btn petit" data-action="payer" data-contrat="${x.contrat.id}" data-id="${x.echeance.id}">Payée</button></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun paiement à venir.</p>'}
      ${payees.length ? `<details class="faites"><summary>Paiements effectués (${payees.length})</summary>${payees.map(({ c, x }) => `<div class="ligne-faite" style="--c:var(--encre)"><i></i><span>${R.dateFr(x.payeLe)} · ${esc(presta(c.prestaId)?.nom || '')} · ${esc(x.libelle)} · <b>${eur(x.montant)}</b>${c.statut === 'annule' ? ' (contrat annulé)' : ''}</span><button class="btn petit" data-action="depayer" data-contrat="${c.id}" data-id="${x.id}">Annuler le paiement</button></div>`).join('')}</details>` : ''}
      <h2 class="titre-section">Carnet des prestataires <span>Commun à tous les événements</span></h2>
      ${E.prestataires.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Prestataire</th><th>Métier</th><th>Contact</th><th>Téléphone</th><th>E-mail</th><th class="nb">Contrats</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${[...E.prestataires].sort((a, z) => a.nom.localeCompare(z.nom)).map((p) => `<tr><td><b>${esc(p.nom)}</b></td><td>${esc(p.metier)}</td><td>${esc(p.contact)}</td><td>${esc(p.tel)}</td><td>${esc(p.email)}</td><td class="nb">${E.contrats.filter((c) => c.prestaId === p.id).length}</td><td><button class="btn lien" data-action="presta-modifier" data-id="${p.id}">Modifier</button></td></tr>`).join('')}</tbody></table></div>` : ''}
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
        ${info.aPlanifier ? `<p class="avert">${eur(Math.abs(info.aPlanifier))} ${info.aPlanifier > 0 ? 'restent à planifier dans l\'échéancier' : 'planifiés en trop par rapport au montant'}.</p>` : ''}
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
    const b = R.budget(E, evtCourant().id);
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

  // ----- Invités : liste, plan de table, transports, hébergement -----
  const voletsDe = (e) => [['liste', 'Liste'], ...(mod(e, 'tables') ? [['tables', 'Plan de table']] : []), ...(mod(e, 'transports') ? [['transports', 'Transports']] : []), ...(mod(e, 'hebergement') ? [['chambres', 'Hébergement']] : [])];
  function vueInvites(e) {
    const volets = voletsDe(e);
    if (!volets.some(([v]) => v === ui.volet)) ui.volet = 'liste';
    const m = mots(e);
    const seg = volets.length > 1 ? `<div class="segment volets" role="group" aria-label="Volet">${volets.map(([v, l]) => `<button data-action="sous-vue" data-v="${v}" aria-pressed="${ui.volet === v}">${l}</button>`).join('')}</div>` : '';
    const actions = {
      liste: `<button class="btn" data-action="invites-rapide">Saisie rapide</button><button class="btn primaire" data-action="invite-nouveau">${ICONES.plus}${esc(m.invite[0].toUpperCase() + m.invite.slice(1))}</button>`,
      tables: `<button class="btn primaire" data-action="table-nouvelle">${ICONES.plus}Table</button>`,
      transports: `<button class="btn primaire" data-action="trajet-nouveau">${ICONES.plus}Trajet</button>`,
      chambres: `<button class="btn" data-action="repartir">Répartir automatiquement</button><button class="btn primaire" data-action="chambres-nouvelles">${ICONES.plus}Chambres</button>`,
    }[ui.volet];
    const titre = { liste: m.invites, tables: 'Plan de table', transports: 'Transports', chambres: 'Hébergement' }[ui.volet];
    const corps = { liste: voletListe, tables: voletTables, transports: voletTransports, chambres: voletChambres }[ui.volet](e);
    return `${enteteEvenement(e, titre, actions)}${seg}${corps}`;
  }
  function rappelRgpd(e) {
    return `<div class="rgpd"><b>Données sensibles</b> Régimes alimentaires, allergies et besoins d'accessibilité sont des <strong>données sensibles</strong> (santé, convictions) : saisie facultative, seulement avec l'accord explicite de la personne et si c'est utile au repas ou à l'accès. Le régime se choisit dans une liste fermée, allergie et accessibilité se cochent ; la précision reste facultative et sans diagnostic. Pour le traiteur, la fiche ne donne que des nombres. Partage la clé avec l'équipe d'organisation uniquement et efface ces données après l'événement (Réglages). <a href="${B.rgpd.url}" target="_blank" rel="noopener">Définition CNIL</a>.</div>`;
  }
  const texteRecherche = (i) => `${i.prenom} ${i.nom} ${i.groupe} ${i.societe} ${i.fonction} ${i.email}`.toLowerCase();
  function voletListe(e) {
    const tous = deEvt(E.invites, e.id);
    const s = R.statsInvites(tous, B.regimes);
    const m = mots(e);
    const q = ui.q.trim().toLowerCase();
    const groupes = R.groupesDe(tous);
    if (ui.grp && ui.grp !== '-' && !groupes.includes(ui.grp)) ui.grp = '';
    const liste = R.trierInvites(tous.filter((i) => (!ui.grp || (ui.grp === '-' ? !(i.groupe || '').trim() : (i.groupe || '').trim() === ui.grp)) && (!ui.rep || i.reponse === ui.rep)));
    const jourJ = ecart(auj(), e.date) <= 0 && !R.evenementPasse(e, auj());
    const enf = mod(e, 'enfants');
    const tuiles = [
      [m.invites, s.total, `${s.couverts} à prévoir (oui + en attente)${enf ? `, dont ${pluriel(s.couvertsEnfants, 'enfant')}` : ''}.`, 'var(--encre)', ''],
      ['Oui', s.oui, s.tauxPresence !== null && s.presents ? `${s.presents} présents pointés (${s.tauxPresence} %).` : s.tauxReponse === null ? '' : `${s.tauxReponse} % de réponses reçues.`, 'var(--bleu)', 'rond'],
      ['En attente', s.attente, e.limite ? `Date limite : ${fmt(e.limite, { day: 'numeric', month: 'long' })}.` : 'À relancer.', 'var(--jaune)', ''],
      ['Non', s.non, (() => { const l = [mod(e, 'tables') && 'place', mod(e, 'transports') && 'trajets', mod(e, 'hebergement') && 'chambre'].filter(Boolean); return l.length ? `Libérés : ${l.join(', ')}.` : 'Ont décliné.'; })(), 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${esc(lib)}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const regimes = Object.entries(s.regimes).filter(([, n]) => n).sort((a, z) => z[1] - a[1]);
    const grps = Object.entries(s.parGroupe).sort((a, z) => z[1].total - a[1].total);
    const precisions = tous.filter((i) => R.concerne(i) && ((i.allergie && i.allergieDetail) || (i.acces && i.accesDetail)));
    return `
      ${rappelRgpd(e)}
      <div class="tuiles">${tuiles}</div>
      <div class="invites-synthese">
        <section class="bloc"><h3>Pour le traiteur</h3>${regimes.length ? `<ul class="compteurs">${regimes.map(([r, n]) => `<li><span>${esc(r)}</span><b>${n}</b></li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun couvert.</p>'}<p class="note">Sur ${pluriel(s.couverts, 'couvert')} (oui + en attente) ; non renseigné compté « sans restriction ».</p></section>
        <section class="bloc"><h3>À signaler</h3><ul class="compteurs"><li><span>Allergie ou intolérance</span><b>${s.allergies}</b></li><li><span>Besoin d'accessibilité</span><b>${s.acces}</b></li></ul>
          ${precisions.length ? `<details class="precisions"><summary>Précisions notées (${precisions.length})</summary><ul class="compteurs">${precisions.map((i) => `<li><span>${esc(R.nomComplet(i))}</span><b class="petit">${esc([i.allergie && i.allergieDetail, i.acces && i.accesDetail].filter(Boolean).join(' · '))}</b></li>`).join('')}</ul></details>` : ''}
          <p class="note">Nombres seuls dans la fiche traiteur : le détail se règle avec le traiteur et le lieu.</p></section>
        <section class="bloc"><h3>Par ${esc(m.groupe.toLowerCase())}</h3>${grps.length ? `<ul class="compteurs">${grps.map(([n, v]) => `<li><span class="pastille-cat" style="--c:${couleur(n === 'Sans groupe' ? 'gris' : couleurGroupe(e, n))}"><i></i>${esc(n)}</span><b>${v.oui}/${v.total}</b></li>`).join('')}</ul>` : `<p class="ligne-vide">Aucun ${esc(m.invite)}.</p>`}<p class="note">Oui / ${esc(m.invites.toLowerCase())}.</p></section>
      </div>
      <div class="filtres">
        <label class="champ compact grand">Rechercher<input type="search" id="recherche" value="${esc(ui.q)}" placeholder="Nom, ${esc(m.groupe.toLowerCase())}…"></label>
        <label class="champ compact">${esc(m.groupe)}<select data-action="filtre-grp"><option value="">Tous</option>${groupes.map((g) => `<option ${ui.grp === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}<option value="-" ${ui.grp === '-' ? 'selected' : ''}>Sans ${esc(m.groupe.toLowerCase())}</option></select></label>
        <label class="champ compact">Réponse<select data-action="filtre-rep"><option value="">Toutes</option>${['oui', 'attente', 'non'].map((v) => `<option value="${v}" ${ui.rep === v ? 'selected' : ''}>${REP[v]}</option>`).join('')}</select></label>
        <span class="rang"><button class="btn petit" data-action="voir-traiteur" ${s.couverts ? '' : 'disabled'}>Fiche traiteur</button>${mod(e, 'badges') ? `<button class="btn petit" data-action="imprimer-badges" ${s.oui ? '' : 'disabled'}>Badges (${s.oui})</button>` : ''}<button class="btn petit" data-action="csv" ${tous.length ? '' : 'disabled'}>Exporter (CSV)</button>${groupes.length ? `<button class="btn petit" data-action="groupes">${esc(m.groupe)}s</button>` : ''}</span>
      </div>
      <p class="compte-liste" id="compte-liste">${pluriel(liste.filter((i) => !q || texteRecherche(i).includes(q)).length, `${m.invite} affiché`, `${m.invite}s affichés`)}${jourJ ? ' · jour J : pointe les arrivées' : ''}</p>
      ${tous.length ? `<ul class="invites" id="liste-invites">${liste.map((i) => ligneInvite(e, i, jourJ, q)).join('')}</ul>` : vide(`Aucun ${esc(m.invite)}`, `Colle ta liste d'un coup (une personne par ligne : « Prénom Nom ; ${e.type === 'seminaire' ? 'Service' : mod(e, 'badges') ? 'Société' : 'Groupe'} ; e-mail ») ou ajoute-les une par une.`, '<button class="btn primaire" data-action="invites-rapide">Saisie rapide</button>')}`;
  }
  function ligneInvite(e, i, jourJ, q) {
    const sensible = R.estSensible(i);
    const logi = [];
    if (mod(e, 'tables') && i.reponse !== 'non') logi.push(table(i.tableId) ? `Table : ${esc(table(i.tableId).nom)}` : '<em>sans table</em>');
    if (mod(e, 'transports') && i.reponse !== 'non') {
      logi.push(i.allerId === 'perso' ? 'Aller : propres moyens' : trajet(i.allerId) ? `Aller : ${esc(nomTrajet(trajet(i.allerId)))}` : '<em>sans aller</em>');
      logi.push(i.retourId === 'perso' ? 'Retour : propres moyens' : trajet(i.retourId) ? `Retour : ${esc(nomTrajet(trajet(i.retourId)))}` : '<em>sans retour</em>');
    }
    if (mod(e, 'hebergement') && i.reponse !== 'non') logi.push(i.hebergement === false ? 'pas de chambre' : chambre(i.chambreId) ? `Chambre : ${esc(chambre(i.chambreId).nom)}` : '<em>à loger</em>');
    const infos = [mod(e, 'badges') ? [i.fonction, i.societe].filter(Boolean).map(esc).join(' · ') : esc(i.fonction), i.enfant && mod(e, 'enfants') ? 'Enfant' : ''].filter(Boolean).join(' · ');
    const c = couleurGroupe(e, i.groupe);
    return `<li class="invite" data-texte="${esc(texteRecherche(i))}" ${q && !texteRecherche(i).includes(q) ? 'hidden' : ''}>
      <span class="cat-bande" style="--c:${couleur(c)}"></span>
      <button class="invite-corps" data-action="invite-modifier" data-id="${i.id}"><b>${esc(R.nomComplet(i))}</b>${infos ? `<span>${infos}</span>` : ''}<span class="cat-nom">${esc(i.groupe || `Sans ${mots(e).groupe.toLowerCase()}`)}${sensible ? ' · <span class="marque-sensible">infos repas ou accès</span>' : ''}</span>${logi.length ? `<span class="logi">${logi.join(' · ')}</span>` : ''}</button>
      <div class="reponse" role="group" aria-label="Réponse de ${esc(R.nomComplet(i))}">${[['oui', 'Oui'], ['attente', '?'], ['non', 'Non']].map(([v, l]) => `<button data-action="repondre" data-id="${i.id}" data-v="${v}" class="r-${v}" aria-pressed="${i.reponse === v}" ${v === 'attente' ? 'aria-label="En attente"' : ''}>${l}</button>`).join('')}</div>
      ${i.reponse === 'oui' || jourJ ? `<button class="present ${i.present ? 'oui' : ''}" data-action="present" data-id="${i.id}" aria-pressed="${i.present}">${i.present ? `${ICONES.coche}Présent` : 'Arrivé ?'}</button>` : '<span></span>'}
    </li>`;
  }
  function brancherRecherche() {
    const champ = $('#recherche');
    if (!champ) return;
    const m = mots(evtCourant());
    champ.addEventListener('input', () => {
      ui.q = champ.value;
      const q = ui.q.trim().toLowerCase();
      let n = 0;
      document.querySelectorAll('#liste-invites .invite').forEach((li) => { const ok = !q || li.dataset.texte.includes(q); li.hidden = !ok; if (ok) n++; });
      $('#compte-liste').textContent = pluriel(n, `${m.invite} affiché`, `${m.invite}s affichés`);
    });
  }

  // Plan de table : glisser-déposer à la souris, liste déroulante au téléphone et au clavier.
  const optionsTables = (e, choix) => `<option value="">— Pas de table</option>${deEvt(E.tables, e.id).map((t) => `<option value="${t.id}" ${t.id === choix ? 'selected' : ''}>${esc(t.nom)} (${t.places} pl.)</option>`).join('')}`;
  function voletTables(e) {
    const I = deEvt(E.invites, e.id);
    const p = R.planDeTable(deEvt(E.tables, e.id), I);
    const intro = `<p class="aide">${p.occupees} placés sur ${p.places} places. Glisse une personne sur une table, ou choisis sa table dans la liste. Seuls les oui et les en attente sont à placer.</p>`;
    if (!p.tables.length) return intro + vide('Aucune table', 'Crée tes tables avec leur nombre de places, puis place tes invités.', '<button class="btn primaire" data-action="table-nouvelle">Créer une table</button>');
    const alertes = p.alertes.length ? `<ul class="alertes">${p.alertes.map((a) => `<li class="alerte ${a.type === 'nonPlaces' ? '' : 'grave'}"><i></i><span><b>${esc(a.texte)}</b>${a.type === 'declines' ? ` · ${p.declinesPlaces.map((i) => esc(R.nomComplet(i))).join(', ')}` : ''}</span>${a.type === 'declines' ? '<button class="btn petit" data-action="retirer-declines">Les retirer</button>' : ''}</li>`).join('')}</ul>` : '<p class="ligne-vide">Aucune alerte : chaque personne confirmée a sa place.</p>';
    const jeton = (i, tableId) => `<li class="jeton ${i.reponse}" draggable="true" data-invite="${i.id}"><span><b>${esc(R.nomComplet(i))}</b><small>${i.reponse === 'non' ? 'A décliné' : i.reponse === 'attente' ? 'En attente' : 'Confirmé'}${i.enfant && mod(e, 'enfants') ? ' · enfant' : ''}${!tableId && i.groupe ? ` · ${esc(i.groupe)}` : ''}</small></span>
      <label class="sr-only" for="t-${i.id}">Table de ${esc(R.nomComplet(i))}</label><select id="t-${i.id}" data-choix-table="${i.id}">${optionsTables(e, tableId)}</select></li>`;
    const aPlacer = `<section class="a-placer zone-depot" data-table="" aria-label="Personnes à placer"><h2>À placer <span>${p.aPlacer.length}</span></h2>
      ${p.aPlacer.length ? `<ul>${p.aPlacer.map((i) => jeton(i, null)).join('')}</ul>` : '<p class="table-vide">Tout le monde est placé.</p>'}</section>`;
    const tables = p.tables.map((t) => {
      const assis = R.trierInvites(I.filter((i) => i.tableId === t.id));
      const taux = Math.min(100, Math.round((t.occupees / Math.max(1, t.places)) * 100));
      return `<section class="table-carte zone-depot${t.surcapacite ? ' plein' : ''}" data-table="${t.id}">
        <div class="table-tete"><button data-action="table-modifier" data-id="${t.id}"><b>${esc(t.nom)}</b><span>${t.occupees} / ${t.places} places</span></button>${t.surcapacite ? `<span class="etiquette rouge">+${t.occupees - t.places}</span>` : t.libres === 0 ? '<span class="etiquette bleu">Complète</span>' : ''}</div>
        <div class="jauge-table" role="img" aria-label="${t.occupees} sur ${t.places} places"><i style="width:${taux}%"></i></div>
        ${assis.length ? `<ul>${assis.map((i) => jeton(i, t.id)).join('')}</ul>` : '<p class="table-vide">Dépose une personne ici.</p>'}
      </section>`;
    }).join('');
    return `${intro}${alertes}<div class="plan">${aPlacer}<div class="tables-grille">${tables}</div></div>
      <p class="rang-actions"><button class="btn petit" data-action="imprimer-tables">Imprimer le plan de table</button></p>`;
  }
  function placerInvite(inviteId, tableId) {
    const i = E.invites.find((x) => x.id === inviteId);
    if (!i || (i.tableId || null) === (tableId || null)) return;
    memo();
    E.invites = R.placer(E.invites, inviteId, tableId);
    sauver(); rendre();
    const t = table(tableId);
    if (t) {
      const occ = R.planDeTable(deEvt(E.tables, t.evtId), deEvt(E.invites, t.evtId)).tables.find((x) => x.id === tableId);
      toast(occ.surcapacite ? `${R.nomComplet(i)} placé à ${t.nom} : ${occ.occupees} pour ${occ.places} places.` : `${R.nomComplet(i)} placé à ${t.nom}.`, { libelle: 'Annuler', faire: annuler });
    } else toast(`${R.nomComplet(i)} retiré de sa table.`, { libelle: 'Annuler', faire: annuler });
  }
  document.addEventListener('dragstart', (e) => {
    const j = e.target.closest?.('[data-invite]');
    if (!j) return;
    e.dataTransfer.setData('text/plain', j.dataset.invite);
    e.dataTransfer.effectAllowed = 'move';
    j.classList.add('glisse');
  });
  document.addEventListener('dragend', (e) => { e.target.closest?.('[data-invite]')?.classList.remove('glisse'); document.querySelectorAll('.survol').forEach((z) => z.classList.remove('survol')); });
  document.addEventListener('dragover', (e) => {
    const z = e.target.closest?.('.zone-depot');
    if (!z) return;
    e.preventDefault();
    document.querySelectorAll('.survol').forEach((x) => { if (x !== z) x.classList.remove('survol'); });
    z.classList.add('survol');
  });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest?.('.zone-depot');
    if (!z) return;
    e.preventDefault();
    z.classList.remove('survol');
    placerInvite(e.dataTransfer.getData('text/plain'), z.dataset.table || null);
  });

  function voletTransports(e) {
    const I = deEvt(E.invites, e.id), T = deEvt(E.trajets, e.id);
    const m = mots(e);
    const occ = R.occupationTrajets(T, I);
    const sans = R.sansTransport(I, T);
    const hor = R.horairesTrajets(e, T, deEvt(E.conducteur, e.id));
    const perso = I.filter((p) => R.concerne(p) && (p.allerId === 'perso' || p.retourId === 'perso')).length;
    const carte = (o) => {
      const t = o.trajet;
      const h = hor.find((x) => x.trajet.id === t.id);
      const pct = o.places ? Math.min(100, (o.n / o.places) * 100) : 0;
      return `<article class="log ${o.surcharge ? 'surcharge' : ''}">
        <div class="log-tete"><div><p class="log-type">${esc(modeTrajet(t.mode).nom)} · ${t.sens === 'retour' ? 'Retour' : 'Aller'}</p><h3>${esc(nomTrajet(t))}</h3><p>${fmt(t.date)}${t.heureDepart ? ` · ${heureFr(t.heureDepart)}` : ''}${t.heureArrivee ? ` → ${heureFr(t.heureArrivee)}` : ''}${t.depart || t.arrivee ? ` · ${esc(t.depart)} → ${esc(t.arrivee)}` : ''}</p></div><b class="occ">${o.n}${o.places ? `<small>/${o.places}</small>` : ''}</b></div>
        <div class="log-corps">
          ${o.places ? `<div class="jauge-table ${o.surcharge ? 'pleine' : ''}" role="img" aria-label="${o.n} passagers sur ${o.places} places"><i style="width:${pct}%"></i></div><p class="note">${o.surcharge ? `<b class="rouge-t">${pluriel(o.n - o.places, 'passager')} de trop</b>` : pluriel(o.libres, 'place libre', 'places libres')}</p>` : '<p class="note">Places non précisées.</p>'}
          ${h ? `<p class="avert">${h.type === 'arrivee' ? `Arrive ${h.minutes} min après le début du programme (${heureFr(h.heure)}).` : `Part avant la fin du programme (${heureFr(h.heure)}).`}</p>` : ''}
          ${o.passagers.length ? `<ul class="noms">${o.passagers.map((p) => `<li class="${p.reponse === 'attente' ? 'attente' : ''}" title="${p.reponse === 'attente' ? 'En attente de réponse' : ''}">${esc(R.nomComplet(p))}</li>`).join('')}</ul>` : '<p class="ligne-vide">Aucun passager.</p>'}
          ${t.reference ? `<p class="doc">Référence : ${esc(t.reference)}</p>` : ''}
        </div>
        <div class="log-pied"><button class="btn petit primaire" data-action="passagers" data-id="${t.id}">Passagers</button><button class="btn petit" data-action="trajet-modifier" data-id="${t.id}">Modifier</button></div>
      </article>`;
    };
    const groupe = (sens, titre) => {
      const l = occ.filter((o) => (o.trajet.sens === 'retour') === (sens === 'retour')).sort((a, z) => `${a.trajet.date}${a.trajet.heureDepart}`.localeCompare(`${z.trajet.date}${z.trajet.heureDepart}`));
      return `<h2 class="titre-section">${titre} <span>${pluriel(l.length, 'trajet')} · ${l.reduce((n, o) => n + o.n, 0)} passagers</span></h2>${l.length ? `<div class="cartes-log">${l.map(carte).join('')}</div>` : `<p class="ligne-vide">Aucun trajet ${sens}.</p>`}`;
    };
    const listeSans = (l, lib) => `<section class="bloc"><h3>${lib}${l.length ? ` <span class="compte">${l.length}</span>` : ''}</h3>${l.length ? `<ul class="noms">${l.map((p) => `<li class="${p.reponse === 'attente' ? 'attente' : ''}"><button class="lien-nom" data-action="invite-modifier" data-id="${p.id}">${esc(R.nomComplet(p))}</button></li>`).join('')}</ul>` : '<p class="ligne-vide">Personne.</p>'}</section>`;
    return `
      <p class="aide">Pour chaque trajet, « Passagers » coche qui voyage ensemble. Les « non » sont retirés ; les « en attente » restent comptés (en pointillé). ${perso ? `${pluriel(perso, `${m.invite} vient`, `${m.invite}s viennent`)} par ${perso > 1 ? 'leurs' : 'ses'} propres moyens sur au moins un trajet.` : ''}</p>
      ${T.length ? groupe('aller', 'Aller') + groupe('retour', 'Retour') : vide('Aucun trajet', 'Ajoute le train, l\'avion, le car ou la navette de l\'aller puis du retour, avec les places réservées.', `<button class="btn primaire" data-action="trajet-nouveau">${ICONES.plus}Trajet</button>`)}
      <h2 class="titre-section">Sans trajet <span>Confirmés ou en attente</span></h2>
      <div class="invites-synthese deux-col">${listeSans(sans.aller, 'Sans aller')}${listeSans(sans.retour, 'Sans retour')}</div>`;
  }
  function voletChambres(e) {
    const I = deEvt(E.invites, e.id), C = deEvt(E.chambres, e.id);
    const occ = R.occupationChambres(C, I);
    const loger = R.aLoger(e, I, C);
    const places = occ.reduce((n, o) => n + o.capacite, 0);
    const occupees = occ.reduce((n, o) => n + o.occupants.length, 0);
    const libres = occ.reduce((n, o) => n + Math.max(0, o.libres), 0);
    const nuitsTxt = R.nuits(e) ? pluriel(R.nuits(e), 'nuit') : 'la nuit de l\'événement';
    const tuiles = [
      ['Places', places, `${pluriel(C.length, 'chambre')} · ${nuitsTxt}`, 'var(--encre)', ''],
      ['Occupées', occupees, occ.some((o) => o.surcharge) ? 'Dont des chambres en surcharge.' : 'Confirmés et en attente.', 'var(--bleu)', 'rond'],
      ['Libres', libres, '', 'var(--jaune)', ''],
      ['À loger', loger.length, loger.length > libres ? `Il manque ${pluriel(loger.length - libres, 'place')}.` : loger.length ? 'Assez de places libres.' : 'Tout le monde a sa chambre.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const parHeb = new Map();
    occ.forEach((o) => { const k = o.chambre.hebergement || 'Hébergement'; if (!parHeb.has(k)) parHeb.set(k, []); parHeb.get(k).push(o); });
    const carte = (o) => `<button class="chambre ${o.surcharge ? 'surcharge' : o.libres === 0 ? 'pleine' : o.occupants.length ? 'partielle' : 'vide'}" data-action="occupants" data-id="${o.chambre.id}">
        <span class="ch-tete"><b>${esc(o.chambre.nom)}</b><small>${esc(typeChambre(o.chambre.type).nom)} · ${o.occupants.length}/${o.capacite}</small></span>
        <span class="ch-lits">${Array.from({ length: Math.max(o.capacite, o.occupants.length) }, (_, i) => `<i class="${i >= o.capacite ? 'trop' : i < o.occupants.length ? 'pris' : ''}"></i>`).join('')}</span>
        <span class="ch-noms">${o.occupants.length ? o.occupants.map((p) => esc(R.nomComplet(p))).join('<br>') : '<em>Libre</em>'}</span>
        ${o.chambre.note ? `<span class="ch-note">${esc(o.chambre.note)}</span>` : ''}
      </button>`;
    return `
      <div class="tuiles">${tuiles}</div>
      ${loger.length ? `<h2 class="titre-section">À loger <span>Sans chambre : touche un nom pour l'affecter, ou « Répartir automatiquement » (confirmés seulement, par ${esc(mots(e).groupe.toLowerCase())})</span></h2><ul class="noms grand">${loger.map((p) => `<li class="${p.reponse === 'attente' ? 'attente' : ''}"><button class="lien-nom" data-action="invite-modifier" data-id="${p.id}">${esc(R.nomComplet(p))}${p.groupe ? ` <small>${esc(p.groupe)}</small>` : ''}</button></li>`).join('')}</ul>` : ''}
      ${C.length ? [...parHeb.entries()].map(([heb, l]) => `<h2 class="titre-section">${esc(heb)} <span>${pluriel(l.length, 'chambre')} · touche une chambre pour choisir ses occupants</span></h2><div class="chambres">${l.map(carte).join('')}</div>`).join('')
        : vide('Aucune chambre', 'Ajoute les chambres réservées d\'un coup (par exemple 14 twins numérotées à partir de 101), puis répartis les personnes.', `<button class="btn primaire" data-action="chambres-nouvelles">${ICONES.plus}Chambres</button>`)}
      ${C.length ? '<p class="rang-actions"><button class="btn petit" data-action="imprimer-chambres">Imprimer la liste pour l\'hébergement</button></p>' : ''}`;
  }

  // ----- Jour J (conducteur ou programme en salles parallèles, checklist) -----
  function vueJourJ(e) {
    const t = auj();
    const m = mots(e);
    const nb = Math.max(1, e.nbJours || 1);
    if (ui.jour > nb) ui.jour = 1;
    const items = deEvt(E.conducteur, e.id);
    const c = R.programme(items).filter((x) => x.jour === ui.jour);
    const jourDate = ajout(e.date, ui.jour - 1);
    const estAujourdhui = jourDate === t;
    const ec = estAujourdhui ? R.enCours(items, ui.jour, maintenant()) : null;
    const chk = deEvt(E.checklist, e.id).sort((a, z) => (a.heure || '99').localeCompare(z.heure || '99'));
    const faits = chk.filter((x) => x.fait).length;
    const chev = c.filter((x) => x.chevauche).length;
    const lieux = new Set(c.map((x) => (x.lieu || '').trim()).filter(Boolean)).size;
    const types = B.sequences.filter((ty) => ty.id && c.some((x) => x.type === ty.id));
    const direct = estAujourdhui ? `<div class="direct">
        <div class="direct-bloc rouge"><p class="surtitre">En cours · ${R.hm(maintenant())}</p>${ec.courantes.length ? ec.courantes.map((x) => `<h3>${esc(x.titre)}</h3><p>${R.hm(x.debut)} – ${R.hm(x.fin)}${x.lieu ? ` · ${esc(x.lieu)}` : ''}${x.responsable ? ` · ${esc(x.responsable)}` : ''}</p>`).join('') : `<h3>Aucune ${esc(m.seq)}</h3><p>Rien au déroulé à cette heure.</p>`}</div>
        <div class="direct-bloc"><p class="surtitre">Ensuite</p>${ec.suivante ? `<h3>${esc(ec.suivante.titre)}</h3><p>à ${R.hm(ec.suivante.debut)} (dans ${ec.suivante.debut - maintenant()} min)${ec.suivante.lieu ? ` · ${esc(ec.suivante.lieu)}` : ''}</p>` : '<h3>Fin du déroulé</h3><p>Plus rien aujourd\'hui.</p>'}</div>
      </div>` : '';
    return `
      ${enteteEvenement(e, m.jourj, `<button class="btn" data-action="voir-traiteur">Fiche traiteur</button><button class="btn" data-action="imprimer-conducteur" ${c.length ? '' : 'disabled'}>Imprimer</button><button class="btn primaire" data-action="sequence-nouvelle">${ICONES.plus}${esc(m.seq[0].toUpperCase() + m.seq.slice(1))}</button>`)}
      ${direct}
      ${nb > 1 ? `<div class="segment jours" role="group" aria-label="Jour">${Array.from({ length: nb }, (_, i) => `<button data-action="jour" data-v="${i + 1}" aria-pressed="${ui.jour === i + 1}">Jour ${i + 1} · ${fmt(ajout(e.date, i), { day: 'numeric', month: 'short' })}</button>`).join('')}</div>` : ''}
      <div class="jourj">
        <section>
          <h2 class="titre-section">Déroulé <span>${fmt(jourDate, { weekday: 'long', day: 'numeric', month: 'long' })} · ${pluriel(c.length, m.seq)}${lieux > 1 ? ` · ${pluriel(lieux, 'lieu')}` : ''}${chev ? ` · <b class="rouge-t">${pluriel(chev, 'chevauchement')}</b>` : ''}</span></h2>
          ${types.length ? `<ul class="legende-types">${types.map((ty) => `<li><i style="background:${couleur(ty.couleur)}"></i>${esc(ty.nom)}</li>`).join('')}</ul>` : ''}
          ${c.length ? `<ol class="conducteur">${c.map((x) => {
            const passe = estAujourdhui && x.fin <= maintenant();
            const actif = estAujourdhui && ec.courantes.some((y) => y.id === x.id);
            const ty = typeSeq(x.type);
            const paralleles = c.filter((y) => y.id !== x.id && y.debut < x.fin && x.debut < y.fin && (y.lieu || '').trim().toLowerCase() !== (x.lieu || '').trim().toLowerCase()).length;
            return `<li class="${x.chevauche ? 'chevauche' : ''} ${passe ? 'passe' : ''} ${actif ? 'actif' : ''}" style="--c:${couleur(ty.couleur)};--tc:${texteSur(ty.couleur)}">
              <span class="heure"><b>${R.hm(x.debut)}</b><small>${R.hm(x.fin)}</small></span>
              <button class="seq-corps" data-action="sequence-modifier" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${x.type ? `<span class="type-session">${esc(ty.nom)}</span> · ` : ''}${x.duree} min${x.lieu ? ` · ${esc(x.lieu)}` : ''}${x.responsable ? ` · <strong>${esc(x.responsable)}</strong>` : ''}${paralleles ? ` · en parallèle de ${pluriel(paralleles, 'autre')}` : ''}</span>${x.notes ? `<span class="notes">${esc(x.notes)}</span>` : ''}${x.chevauche ? `<span class="etiquette rouge">Même lieu que « ${esc(c.find((y) => y.id === x.chevauche)?.titre || '')} »</span>` : ''}</button>
              <button class="btn petit" data-action="decaler" data-id="${x.id}" aria-label="Décaler ${esc(x.titre)} et les suivantes">Décaler</button>
            </li>`;
          }).join('')}</ol>` : vide('Déroulé vide pour ce jour', `Ajoute les ${m.seq}s minute par minute, ou pars du déroulé type de ce type d'événement.`, '<button class="btn primaire" data-action="conducteur-type">Ajouter le déroulé type</button>')}
          ${c.length ? '<p class="rang-actions"><button class="btn petit" data-action="conducteur-type">Ajouter le déroulé type</button></p>' : ''}
          <p class="aide">Deux ${m.seq}s simultanées dans des lieux différents sont en parallèle : c'est normal. Deux ${m.seq}s qui se recouvrent au même lieu (ou toutes deux sans lieu) sont signalées. « Décaler » repousse la ${m.seq} et toutes les suivantes du jour. Les repas alimentent la fiche traiteur.</p>
        </section>
        <section>
          <h2 class="titre-section">Checklist <span>${faits}/${chk.length} faits</span></h2>
          ${chk.length ? `<div class="jauge" role="img" aria-label="${faits} sur ${chk.length}"><i style="width:${chk.length ? (faits / chk.length) * 100 : 0}%"></i></div><ul class="checklist">${chk.map((x) => `<li class="${x.fait ? 'fait' : ''}"><button class="coche" data-action="check" data-id="${x.id}" aria-pressed="${x.fait}" aria-label="${esc(x.libelle)}">${x.fait ? ICONES.coche : ''}</button><button class="check-corps" data-action="check-modifier" data-id="${x.id}"><b>${esc(x.libelle)}</b>${x.heure || x.responsable ? `<span>${x.heure ? esc(x.heure) : ''}${x.heure && x.responsable ? ' · ' : ''}${esc(x.responsable)}</span>` : ''}</button></li>`).join('')}</ul>` : '<p class="ligne-vide">Checklist vide.</p>'}
          <p class="rang-actions"><button class="btn petit" data-action="check-nouveau">${ICONES.plus}Point</button>${chk.length < B.checklists[cleChecklist(e)].length ? '<button class="btn petit" data-action="checklist-type">Ajouter la checklist type</button>' : ''}${chk.some((x) => x.fait) ? '<button class="btn petit" data-action="checklist-raz">Tout décocher</button>' : ''}</p>
        </section>
      </div>`;
  }

  // ---------- Impression et exports ----------
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
    imprimer(pages.map((p) => `<section class="page-badges">${p.map((i) => { const c = couleurGroupe(e, i.groupe); return `<div class="badge" style="--c:${couleur(c)};--t:${texteSur(c)}"><p class="badge-evt">${esc(e.nom)}</p><p class="badge-nom"><span>${esc(i.prenom)}</span> ${esc(i.nom)}</p><p class="badge-soc">${esc(i.societe || i.fonction)}</p><p class="badge-cat">${esc(i.groupe)}</p></div>`; }).join('')}</section>`).join(''), 'imp-badges');
  }
  function imprimerConducteur(e) {
    const c = R.programme(deEvt(E.conducteur, e.id)).filter((x) => x.jour === ui.jour);
    imprimer(`<h1>${esc(e.nom)} · déroulé</h1><p>${fmtLong(ajout(e.date, ui.jour - 1))}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p><table><thead><tr><th>Début</th><th>Fin</th><th>${esc(mots(e).seq[0].toUpperCase() + mots(e).seq.slice(1))}</th><th>Lieu</th><th>Responsable</th><th>Notes</th></tr></thead><tbody>${c.map((x) => `<tr><td>${R.hm(x.debut)}</td><td>${R.hm(x.fin)}</td><td>${esc(x.titre)}${x.chevauche ? ' (chevauchement)' : ''}</td><td>${esc(x.lieu)}</td><td>${esc(x.responsable)}</td><td>${esc(x.notes)}</td></tr>`).join('')}</tbody></table>`, 'imp-liste');
  }
  function imprimerChambres(e) {
    const occ = R.occupationChambres(deEvt(E.chambres, e.id), deEvt(E.invites, e.id));
    imprimer(`<h1>${esc(e.nom)} · chambres</h1><p>${fmtLong(e.date)}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p><table><thead><tr><th>Hébergement</th><th>Chambre</th><th>Type</th><th>Occupants</th></tr></thead><tbody>${occ.map((o) => `<tr><td>${esc(o.chambre.hebergement)}</td><td>${esc(o.chambre.nom)}</td><td>${esc(typeChambre(o.chambre.type).nom)}</td><td>${o.occupants.map((p) => esc(R.nomComplet(p))).join(', ')}</td></tr>`).join('')}</tbody></table><p>Liste nominative sans aucune donnée de santé. Les besoins particuliers se règlent directement entre la personne et l'hébergement.</p>`, 'imp-liste');
  }
  function imprimerTables(e) {
    const I = deEvt(E.invites, e.id);
    const p = R.planDeTable(deEvt(E.tables, e.id), I);
    imprimer(`<h1>${esc(e.nom)} · plan de table</h1><p>${fmtLong(e.date)}${e.lieu ? ` · ${esc(e.lieu)}` : ''}</p>${p.tables.map((t) => `<h2>${esc(t.nom)} <small>(${t.occupees} / ${t.places})</small></h2><p>${R.trierInvites(I.filter((i) => t.invites.includes(i.id))).map((i) => esc(R.nomComplet(i))).join(', ') || '—'}</p>`).join('')}`, 'imp-liste');
  }
  const fichier = (e) => e.nom.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
  const LIES = ['taches', 'postes', 'contrats', 'invites', 'tables', 'trajets', 'chambres', 'conducteur', 'checklist'];

  function modaleEvenement(id) {
    const e = id ? evt(id) : null;
    const nbLie = e ? LIES.reduce((n, k) => n + deEvt(E[k], e.id).length, 0) : 0;
    ouvrirModale(e ? 'Modifier l\'événement' : 'Nouvel événement', `${champsEvenement(e || { type: evtCourant()?.type || 'mariage' }, !e)}${e ? `<label class="champ">Notes<textarea name="notes" maxlength="2000">${esc(e.notes)}</textarea></label><p class="aide">Changer la date décale toutes les échéances relatives (J-n) du rétroplanning ; les dates fixes et les dates des trajets ne bougent pas. Désactiver une fonction la masque sans effacer ses données.</p>` : ''}`,
      e ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : piedSimple(null, 'Créer'),
      (f, action) => {
        if (action === 'supprimer') {
          if (!confirm(`Supprimer « ${e.nom} » et tout ce qui s'y rattache (${pluriel(nbLie, 'élément')}) ?`)) return '';
          memo();
          E.evenements = E.evenements.filter((x) => x.id !== e.id);
          for (const k of LIES) E[k] = E[k].filter((x) => x.evtId !== e.id);
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
          for (const k of ['taches', 'postes', 'conducteur', 'checklist', 'tables', 'chambres']) E[k].push(...deEvt(E[k], e.id).map((x) => ({ ...structuredClone(x), id: uid(), evtId: copie.id, ...(k === 'taches' ? { faite: null, dateFixe: null } : {}), ...(k === 'checklist' ? { fait: false } : {}) })));
          ui.evtId = copie.id; memoUi();
          fait('Copie créée (rétroplanning, postes, déroulé, checklist, tables et chambres ; ni contrats, ni invités, ni trajets). Pense à changer sa date.');
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
        ui.evtId = ev.id; ui.volet = 'liste'; memoUi();
        fait(`« ${ev.nom} » créé : ${pluriel(deEvt(E.taches, ev.id).length, 'tâche')} au rétroplanning.`);
      });
    brancherFormEvenement(modale(), !e);
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
        <div class="raccourcis" role="group" aria-label="Raccourcis">${[[360, '12 mois'], [180, '6 mois'], [90, '3 mois'], [30, '1 mois'], [14, '2 sem.'], [7, '1 sem.']].map(([j, l]) => `<button type="button" class="btn petit" data-action="raccourci" data-j="${j}">${l}</button>`).join('')}</div>
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

  const NOMS_MODELES = { mariage: 'Mariage', seminaire: 'Séminaire ou offsite', salon: 'Salon professionnel (exposant)', soiree: 'Soirée, lancement ou gala', conference: 'Conférence, assemblée ou matinale', fete: 'Fête de famille' };
  function modaleModele() {
    const e = evtCourant();
    const t = auj();
    const choix = R.cleModele(e);
    const corps = `
      <label class="champ">Rétroplanning type<select name="modele">${Object.keys(B.retroplannings).map((k) => `<option value="${k}" ${k === choix ? 'selected' : ''}>${esc(NOMS_MODELES[k])} (${B.retroplannings[k].length} tâches, de ${R.libelleRelatif(B.retroplannings[k][0][2])} à ${R.libelleRelatif(B.retroplannings[k].at(-1)[2])})</option>`).join('')}</select></label>
      <fieldset class="choix-base"><legend>Tâches dont l'échéance est déjà passée <small>L'événement est ${R.compteRebours(e, t)}.</small></legend>
        <label class="case"><input type="radio" name="passees" value="aujourdhui" checked> Les ramener à aujourd'hui</label>
        <label class="case"><input type="radio" name="passees" value="garder"> Les garder (elles apparaîtront en retard)</label>
        <label class="case"><input type="radio" name="passees" value="ignorer"> Ne pas les ajouter</label>
      </fieldset>
      <p class="aide">Les tâches déjà présentes avec le même intitulé ne sont pas dupliquées. Délais indicatifs, rédigés pour le template : adapte-les à ton contexte.</p>`;
    ouvrirModale('Appliquer un rétroplanning type', corps, '<button class="btn primaire" value="ok">Appliquer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      memo();
      const r = R.tachesDepuisModele(B.retroplannings[f.get('modele')] || [], e, t, f.get('passees'), E.taches, uid);
      E.taches.push(...r.taches);
      fait(`${pluriel(r.taches.length, 'tâche ajoutée', 'tâches ajoutées')}${r.passees ? ` (${r.passees} à l'échéance déjà passée)` : ''}.`);
    });
  }

  function modalePoste(id) {
    const e = evtCourant();
    const p = id ? E.postes.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Poste<input name="nom" required maxlength="60" list="postes-types" value="${esc(p?.nom || '')}"><datalist id="postes-types">${(B.postes[R.cleModele(e)] || []).map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <label class="champ">Montant prévu (${E.reglages.convention})<small>Ton estimation pour cet événement.</small><input name="prevu" inputmode="decimal" value="${R.champMontant(p?.prevu ?? null)}" placeholder="Ex. : 1 200"></label>
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
      if (prevu === null || prevu < 0) return 'Montant illisible (ex. : 1 200 ou 1200,50).';
      memo();
      if (p) Object.assign(p, { nom, prevu }); else E.postes.push({ id: uid(), evtId: e.id, nom, prevu });
      fait(p ? 'Poste enregistré.' : `Poste « ${nom} » ajouté.`);
    });
  }
  function modalePostesTypes() {
    const e = evtCourant();
    const deja = new Set(deEvt(E.postes, e.id).map((p) => p.nom.toLowerCase()));
    const suggeres = new Set(B.postes[R.cleModele(e)] || []);
    const tous = [...new Set([...suggeres, ...Object.values(B.postes).flat()])];
    const dispo = tous.filter((n) => !deja.has(n.toLowerCase()));
    if (!dispo.length) { toast('Tous les postes types sont déjà présents.'); return; }
    ouvrirModale('Ajouter des postes types', `<p class="aide">Postes sans montant : saisis ensuite ton prévu, poste par poste. Ceux de ce type d'événement sont cochés.</p><div class="choix-postes">${dispo.map((n) => `<label class="case"><input type="checkbox" name="p" value="${esc(n)}" ${suggeres.has(n) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`,
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
        <label class="champ">Statut<small>Signé ou réservé = compté dans l'engagé</small><select name="statut">${B.statutsContrat.map((s) => `<option value="${s.id}" ${s.id === (c?.statut || 'devis') ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
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

  // Options de trajet d'une personne.
  const optionsTrajet = (e, sens, val) => `<option value="">Non affecté</option><option value="perso" ${val === 'perso' ? 'selected' : ''}>Par ses propres moyens</option>${deEvt(E.trajets, e.id).filter((t) => (t.sens === 'retour') === (sens === 'retour')).map((t) => `<option value="${t.id}" ${t.id === val ? 'selected' : ''}>${esc(nomTrajet(t))}${t.heureDepart ? ` · ${t.heureDepart}` : ''}</option>`).join('')}`;
  function modaleInvite(id) {
    const e = evtCourant();
    const i = id ? E.invites.find((x) => x.id === id) : null;
    const m = mots(e);
    const groupes = [...new Set([...suggestionsGroupes(e), ...R.groupesDe(deEvt(E.invites, e.id))])];
    const occ = R.occupationChambres(deEvt(E.chambres, e.id), deEvt(E.invites, e.id));
    const corps = `
      <div class="deux">
        <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(i?.prenom || '')}" autocomplete="off"></label>
        <label class="champ">Nom<small>${e.type === 'mariage' || e.type === 'fete' ? 'Ou une initiale, un surnom.' : ''}</small><input name="nom" required maxlength="60" value="${esc(i?.nom || '')}" autocomplete="off"></label>
      </div>
      <div class="deux">
        <label class="champ">${esc(m.groupe)}<input name="groupe" maxlength="60" list="liste-groupes" value="${esc(i ? i.groupe : (ui.grp && ui.grp !== '-' ? ui.grp : ''))}"><datalist id="liste-groupes">${groupes.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
        <label class="champ">Réponse<select name="reponse">${['attente', 'oui', 'non'].map((v) => `<option value="${v}" ${v === (i?.reponse || 'attente') ? 'selected' : ''}>${REP[v]}</option>`).join('')}</select></label>
      </div>
      ${mod(e, 'badges') ? `<div class="deux"><label class="champ">Société<input name="societe" maxlength="80" value="${esc(i?.societe || '')}"></label><label class="champ">Fonction<input name="fonction" maxlength="60" value="${esc(i?.fonction || '')}"></label></div>` : `<input type="hidden" name="societe" value="${esc(i?.societe || '')}"><input type="hidden" name="fonction" value="${esc(i?.fonction || '')}">`}
      <div class="deux">
        <label class="champ">E-mail<small>Facultatif</small><input name="email" type="email" maxlength="80" value="${esc(i?.email || '')}"></label>
        ${mod(e, 'enfants') ? `<label class="champ">Âge<select name="enfant"><option value="">Adulte</option><option value="1" ${i?.enfant ? 'selected' : ''}>Enfant</option></select></label>` : '<span></span>'}
      </div>
      ${mod(e, 'tables') || mod(e, 'transports') || mod(e, 'hebergement') ? `<fieldset class="choix-base"><legend>Organisation <small>Un « non » libère sa place, son trajet et sa chambre.</small></legend>
        ${mod(e, 'tables') ? `<label class="champ">Table<select name="tableId">${optionsTables(e, i?.tableId)}</select></label>` : ''}
        ${mod(e, 'transports') ? `<div class="deux"><label class="champ">Aller<select name="allerId">${optionsTrajet(e, 'aller', i?.allerId || '')}</select></label><label class="champ">Retour<select name="retourId">${optionsTrajet(e, 'retour', i?.retourId || '')}</select></label></div>` : ''}
        ${mod(e, 'hebergement') ? `<label class="case"><input type="checkbox" name="hebergement" ${i?.hebergement === false ? '' : 'checked'}> A besoin d'une chambre</label>
        <label class="champ">Chambre<select name="chambreId"><option value="">À loger</option>${occ.map((o) => `<option value="${o.chambre.id}" ${o.chambre.id === i?.chambreId ? 'selected' : ''} ${o.libres <= 0 && o.chambre.id !== i?.chambreId ? 'disabled' : ''}>${esc(o.chambre.nom)} · ${o.occupants.length}/${o.capacite}${o.libres <= 0 && o.chambre.id !== i?.chambreId ? ' (pleine)' : ''}</option>`).join('')}</select></label>` : ''}
      </fieldset>` : ''}
      <div class="sensible">
        <p><b>Données sensibles, facultatives</b> · seulement avec l'accord explicite de la personne, si c'est utile au repas ou à l'accès. Aucun diagnostic.</p>
        <label class="champ">Régime alimentaire<select name="regime"><option value="">Non renseigné</option>${B.regimes.map((r) => `<option ${r === i?.regime ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label class="case"><input type="checkbox" name="allergie" ${i?.allergie ? 'checked' : ''}> Allergie ou intolérance à signaler au traiteur</label>
        <label class="champ">Précision<small>Facultative, ex. : fruits à coque. Sinon, la personne la donne elle-même au traiteur.</small><input name="allergieDetail" maxlength="80" value="${esc(i?.allergieDetail || '')}"></label>
        <label class="case"><input type="checkbox" name="acces" ${i?.acces ? 'checked' : ''}> Besoin d'accessibilité (accès, chambre, place)</label>
        <label class="champ">Précision<small>Facultative, ex. : accès en fauteuil. Pas de diagnostic.</small><input name="accesDetail" maxlength="120" value="${esc(i?.accesDetail || '')}"></label>
      </div>
      <label class="champ">Note<small>Logistique uniquement (pas de santé).</small><input name="note" maxlength="200" value="${esc(i?.note || '')}"></label>
      <label class="case"><input type="checkbox" name="present" ${i?.present ? 'checked' : ''}> Présent le jour J</label>
      <p class="erreur" role="alert"></p>`;
    const pied = i ? piedSimple(true) : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(i ? `Modifier : ${esc(R.nomComplet(i))}` : `Nouvel ${m.invite === 'participant' ? 'participant' : 'invité'}`, corps, pied, (f, action) => {
      if (action === 'supprimer') { memo(); E.invites = E.invites.filter((x) => x.id !== i.id); fait(`${R.nomComplet(i)} retiré de la liste.`); return; }
      const v = { prenom: String(f.get('prenom') || '').trim(), nom: String(f.get('nom') || '').trim(), groupe: String(f.get('groupe') || '').trim(), societe: String(f.get('societe') || '').trim(), fonction: String(f.get('fonction') || '').trim(),
        email: String(f.get('email') || '').trim(), reponse: f.get('reponse'), regime: B.regimes.includes(f.get('regime')) ? f.get('regime') : '', allergie: f.has('allergie'), allergieDetail: String(f.get('allergieDetail') || '').trim(),
        acces: f.has('acces'), accesDetail: String(f.get('accesDetail') || '').trim(), note: String(f.get('note') || '').trim(), present: f.has('present') };
      if (mod(e, 'enfants')) v.enfant = Boolean(f.get('enfant'));
      if (mod(e, 'tables')) v.tableId = f.get('tableId') || null;
      if (mod(e, 'transports')) Object.assign(v, { allerId: f.get('allerId') || '', retourId: f.get('retourId') || '' });
      if (mod(e, 'hebergement')) Object.assign(v, { hebergement: f.has('hebergement'), chambreId: f.has('hebergement') ? (f.get('chambreId') || '') : '' });
      if (!v.nom) return 'Indique au moins le nom.';
      if (v.allergieDetail) v.allergie = true;
      if (v.accesDetail) v.acces = true;
      if (v.reponse === 'non') Object.assign(v, { tableId: null, allerId: '', retourId: '', chambreId: '', present: false });
      if (v.present) v.reponse = 'oui';
      memo();
      if (i) Object.assign(i, v); else E.invites.push(nouvelInvite(e, v));
      if (action === 'encore') { sauver(); rendre(); toast(`${R.nomComplet(v)} ajouté.`); setTimeout(() => modaleInvite(), 0); return; }
      fait(i ? 'Enregistré.' : `${R.nomComplet(v)} ajouté.`);
    });
  }
  function modaleInvitesRapides() {
    const e = evtCourant();
    const m = mots(e);
    const groupes = [...new Set([...suggestionsGroupes(e), ...R.groupesDe(deEvt(E.invites, e.id))])];
    const deuxieme = e.type === 'seminaire' ? 'Service' : mod(e, 'badges') ? 'Société' : 'Groupe';
    ouvrirModale(`Saisie rapide de ${m.invites.toLowerCase()}`, `
      <label class="champ">Une personne par ligne<small>« Prénom Nom ; ${deuxieme} ; e-mail » (sauf le nom, tout est facultatif ; un seul mot suffit). Copier-coller depuis un tableur accepté (tabulations). Les doublons sont ignorés.</small><textarea name="liste" rows="8" required placeholder="Léa Martin ; ${esc(deuxieme === 'Service' ? 'Ventes' : deuxieme === 'Société' ? 'Orme & Cie' : 'Amis')} ; lea.martin@exemple.fr&#10;Hugo Bernard"></textarea></label>
      <div class="deux">
        <label class="champ">${esc(m.groupe)} de toutes<small>Si la ligne n'en donne pas</small><input name="groupe" maxlength="60" list="liste-groupes-r"><datalist id="liste-groupes-r">${groupes.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></label>
        <label class="champ">Réponse<select name="reponse"><option value="attente">En attente</option><option value="oui">Oui</option><option value="non">Non</option></select></label>
      </div>
      ${mod(e, 'enfants') ? '<label class="case"><input type="checkbox" name="enfant"> Ce sont des enfants</label>' : ''}
      <p class="aide">Aucune donnée sensible n'est importée : régimes et cases se renseignent un par un, avec l'accord de chacun.</p>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const l = R.lireInvitesRapides(f.get('liste'));
      if (!l.length) return 'Aucun nom reconnu.';
      const deja = new Set(deEvt(E.invites, e.id).map((i) => R.nomComplet(i).toLowerCase()));
      const nouveaux = l.filter((x) => !deja.has(`${x.prenom} ${x.nom}`.trim().toLowerCase()));
      memo();
      const groupe = String(f.get('groupe') || '').trim();
      nouveaux.forEach((x) => {
        const parSociete = deuxieme === 'Société';
        E.invites.push(nouvelInvite(e, { prenom: x.prenom, nom: x.nom, email: x.email, groupe: parSociete ? groupe : (x.champ2 || groupe), societe: parSociete ? x.champ2 : '', fonction: parSociete ? x.champ3 : '', reponse: f.get('reponse'), enfant: f.has('enfant') }));
      });
      fait(`${pluriel(nouveaux.length, 'personne ajoutée', 'personnes ajoutées')}${l.length > nouveaux.length ? ` (${l.length - nouveaux.length} déjà dans la liste)` : ''}.`);
    });
  }
  // Renommer, fusionner ou retirer un groupe (famille, service, catégorie) dans l'événement courant.
  function modaleGroupes() {
    const e = evtCourant();
    const m = mots(e);
    const groupes = R.groupesDe(deEvt(E.invites, e.id));
    ouvrirModale(`${m.groupe}s de l'événement`, `<p class="aide">Renomme un ${m.groupe.toLowerCase()} (même nom qu'un autre = fusion) ou vide son nom pour le retirer : ses membres passent « sans ${m.groupe.toLowerCase()} ».</p>
      ${groupes.map((g, k) => `<label class="champ"><span class="sr-only">${esc(m.groupe)}</span><input name="g-${k}" maxlength="60" value="${esc(g)}"></label>`).join('')}`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      memo();
      let n = 0;
      groupes.forEach((g, k) => {
        const nv = String(f.get(`g-${k}`) ?? g).trim();
        if (nv === g) return;
        deEvt(E.invites, e.id).forEach((i) => { if ((i.groupe || '').trim() === g) { i.groupe = nv; n++; } });
      });
      ui.grp = '';
      fait(n ? `${pluriel(n, 'personne mise à jour', 'personnes mises à jour')}.` : 'Aucun changement.');
    });
  }
  function modaleCsv() {
    const e = evtCourant();
    ouvrirModale('Exporter la liste', `<p>Fichier CSV (point-virgule, UTF-8) à ouvrir dans un tableur : liste d'accueil, envoi au lieu.</p>
      <label class="case"><input type="checkbox" name="sensibles"> Inclure régimes, allergies et accessibilité (données sensibles)</label>
      <p class="aide">Le fichier sort de l'application : range-le dans un dossier protégé, transmets-le seulement aux personnes qui en ont besoin et supprime-le après l'événement. Pour le traiteur, préfère la fiche traiteur (nombres seulement).</p>`,
    '<button class="btn primaire" value="ok">Télécharger</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const csv = R.csvInvites(deEvt(E.invites, e.id), { groupe: mots(e).groupe, modules: e.modules, avecSensibles: f.has('sensibles'), table: (id) => table(id)?.nom || '', trajet: libTransport, chambre: (id) => nomChambre(chambre(id)) });
      telecharger(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `invites-${fichier(e)}.csv`);
    });
  }
  function blocTraiteur(tr) {
    return `<div class="bloc">
      <ul class="compteurs">${tr.regimes.length ? tr.regimes.map(([nom, n]) => `<li><span>${esc(nom)}</span><b>${n}</b></li>`).join('') : '<li><span>Aucun couvert</span><b>0</b></li>'}
        <li><span>Allergie ou intolérance à signaler</span><b>${tr.allergies}</b></li></ul>
      <p class="note">Sur ${pluriel(tr.couverts, 'couvert')} (oui + en attente${tr.attente ? `, dont ${tr.attente} en attente` : ''}${tr.enfants ? `, dont ${pluriel(tr.enfants, 'enfant')}` : ''}). Les personnes concernées par une allergie précisent elles-mêmes au traiteur : aucun nom ici.</p>
    </div>`;
  }
  function modaleTraiteur() {
    const e = evtCourant();
    const tr = R.traiteur(e, deEvt(E.invites, e.id), deEvt(E.conducteur, e.id), B.regimes);
    ouvrirModale('Fiche traiteur', `
      <p>À transmettre au traiteur ou au lieu : <b>nombres seulement</b>, aucun nom, aucun détail de santé.</p>
      ${blocTraiteur(tr)}
      ${tr.repas.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Repas</th><th>Jour</th><th class="nb">Couverts</th></tr></thead><tbody>${tr.repas.map((r) => `<tr><td>${esc(r.titre)}<br><small>${heureFr(r.heure)}${r.lieu ? ` · ${esc(r.lieu)}` : ''}</small></td><td>${fmt(r.date)}</td><td class="nb">${r.couverts}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ligne-vide">Aucun repas au déroulé : donne le type « Repas » aux séquences concernées.</p>'}
      <p class="aide">Tout le monde est compté sur toute la durée. Mets à jour la fiche après les dernières réponses.</p>`,
    '<button class="btn primaire" value="ok">Télécharger (CSV)</button><button class="btn" value="annuler">Fermer</button>', () => {
      telecharger(new Blob([R.csvTraiteur(e, tr)], { type: 'text/csv;charset=utf-8' }), `traiteur-${fichier(e)}.csv`);
    });
  }

  function modaleTable(id) {
    const e = evtCourant();
    const t = id ? table(id) : null;
    const n = t ? E.invites.filter((i) => i.tableId === t.id).length : 0;
    const corps = `
      <div class="deux"><label class="champ">Nom<input name="nom" maxlength="40" required value="${esc(t?.nom || `Table ${deEvt(E.tables, e.id).length + 1}`)}"></label>
      <label class="champ">Places<input name="places" type="number" inputmode="numeric" min="1" max="60" required value="${t?.places || 8}"></label></div>
      ${n ? `<p class="aide">${pluriel(n, 'personne')} à cette table : en cas de suppression, ${n > 1 ? 'elles reviennent' : 'elle revient'} dans « À placer ».</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(t ? 'Modifier la table' : 'Nouvelle table', corps, piedSimple(t ? true : false), (f, action) => {
      if (action === 'supprimer') {
        memo();
        E.tables = E.tables.filter((x) => x.id !== t.id);
        E.invites.forEach((i) => { if (i.tableId === t.id) i.tableId = null; });
        fait('Table supprimée.'); return;
      }
      const nom = String(f.get('nom') || '').trim().slice(0, 40);
      const places = Math.round(Number(f.get('places')));
      if (!nom) return 'Donne un nom à la table.';
      if (!(places >= 1 && places <= 60)) return 'Indique un nombre de places entre 1 et 60.';
      memo();
      if (t) Object.assign(t, { nom, places }); else E.tables.push({ id: uid(), evtId: e.id, nom, places });
      fait('Table enregistrée.');
    });
  }

  function modaleTrajet(id) {
    const e = evtCourant();
    const t = id ? trajet(id) : null;
    const sens = t?.sens || 'aller';
    const corps = `
      <div class="deux">
        <label class="champ">Sens<select name="sens"><option value="aller" ${sens === 'aller' ? 'selected' : ''}>Aller</option><option value="retour" ${sens === 'retour' ? 'selected' : ''}>Retour</option></select></label>
        <label class="champ">Mode<select name="mode">${B.modes.map((m) => `<option value="${m.id}" ${m.id === (t?.mode || 'train') ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Libellé<small>Facultatif, ex. : « Train du matin », « Navette 2 »</small><input name="libelle" maxlength="60" value="${esc(t?.libelle || '')}"></label>
      <div class="deux">
        <label class="champ">Départ<input name="depart" maxlength="60" value="${esc(t?.depart ?? (sens === 'aller' ? e.depart : e.lieu) ?? '')}"></label>
        <label class="champ">Arrivée<input name="arrivee" maxlength="60" value="${esc(t?.arrivee ?? (sens === 'aller' ? e.lieu : e.depart) ?? '')}"></label>
      </div>
      <div class="deux">
        <label class="champ">Date<input type="date" name="date" required value="${esc(t?.date || (sens === 'retour' ? R.finEvenement(e) : e.date))}"></label>
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
        E.invites.forEach((p) => { if (p.allerId === t.id) p.allerId = ''; if (p.retourId === t.id) p.retourId = ''; });
        fait('Trajet supprimé : ses passagers repassent « sans trajet ».');
        return;
      }
      const v = { sens: f.get('sens') === 'retour' ? 'retour' : 'aller', mode: f.get('mode'), libelle: String(f.get('libelle') || '').trim(), depart: String(f.get('depart') || '').trim(), arrivee: String(f.get('arrivee') || '').trim(),
        date: f.get('date'), places: Number(f.get('places')) || 0, heureDepart: f.get('heureDepart') || '', heureArrivee: f.get('heureArrivee') || '', reference: String(f.get('reference') || '').trim() };
      if (!R.estDate(v.date)) return 'Indique la date du trajet.';
      if (!Number.isInteger(v.places) || v.places < 0) return 'Places : nombre entier.';
      memo();
      if (t) {
        if (t.sens !== v.sens) E.invites.forEach((p) => { if (p.allerId === t.id) p.allerId = ''; if (p.retourId === t.id) p.retourId = ''; });
        Object.assign(t, v);
      } else E.trajets.push({ id: uid(), evtId: e.id, ...v });
      fait(t ? 'Trajet enregistré.' : 'Trajet ajouté : coche ses passagers.');
    });
  }
  // Coche les personnes d'un trajet (passagers) ou d'une chambre (occupants).
  function modaleAffectation(type, id) {
    const e = evtCourant();
    const cible = type === 'trajet' ? trajet(id) : chambre(id);
    if (!cible) return;
    const cle = type === 'trajet' ? (cible.sens === 'retour' ? 'retourId' : 'allerId') : 'chambreId';
    const liste = R.trierInvites(deEvt(E.invites, e.id).filter((p) => R.concerne(p) && (type === 'trajet' || p.hebergement !== false)));
    const limite = type === 'trajet' ? Number(cible.places) || 0 : Math.max(1, Number(cible.capacite) || 1);
    const ailleurs = (p) => (p[cle] && p[cle] !== id ? (type === 'trajet' ? (p[cle] === 'perso' ? 'propres moyens' : nomTrajet(trajet(p[cle]))) : nomChambre(chambre(p[cle]))) : '');
    const corps = `
      <p>${type === 'trajet' ? `${esc(nomTrajet(cible))} · ${limite ? pluriel(limite, 'place') : 'places non précisées'}` : `${esc(cible.nom)} · ${esc(typeChambre(cible.type).nom)} · ${pluriel(limite, 'place')}`}. <span id="compte-coches"></span></p>
      ${type === 'chambre' ? `<p class="rang-actions"><button type="button" class="btn lien" data-action="chambre-modifier" data-id="${cible.id}">Modifier la chambre (nom, type, places, note)</button></p>` : ''}
      ${liste.length ? `<label class="champ compact">Filtrer<input type="search" id="filtre-coches" placeholder="Nom, ${esc(mots(e).groupe.toLowerCase())}…"></label><div class="choix-postes coches">${liste.map((p) => `<label class="case" data-texte="${esc(texteRecherche(p))}"><input type="checkbox" name="p" value="${p.id}" ${p[cle] === id ? 'checked' : ''}> <span>${esc(R.nomComplet(p))}${p.reponse === 'attente' ? ' <small>(en attente)</small>' : ''}${ailleurs(p) ? ` <small>· actuellement : ${esc(ailleurs(p))}</small>` : ''}${p.groupe ? ` <small>· ${esc(p.groupe)}</small>` : ''}</span></label>`).join('')}</div>` : '<p class="ligne-vide">Personne de confirmé ou en attente.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(type === 'trajet' ? 'Passagers du trajet' : 'Occupants de la chambre', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${type === 'chambre' ? '<button class="btn danger gauche" value="supprimer">Supprimer la chambre</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        memo();
        E.chambres = E.chambres.filter((x) => x.id !== id);
        E.invites.forEach((p) => { if (p.chambreId === id) p.chambreId = ''; });
        fait(`${cible.nom} supprimée : ses occupants sont à loger.`);
        return;
      }
      const coches = new Set(f.getAll('p'));
      memo();
      liste.forEach((p) => { if (coches.has(p.id)) p[cle] = id; else if (p[cle] === id) p[cle] = ''; });
      const total = liste.filter((p) => p[cle] === id).length;
      fait(`${type === 'trajet' ? nomTrajet(cible) : cible.nom} : ${total}${limite ? `/${limite}` : ''}${limite && total > limite ? ' (au-delà des places)' : ''}.`);
    });
    const maj = () => { const n = modale().querySelectorAll('input[name=p]:checked').length; const el = $('#compte-coches'); if (el) { el.textContent = `${n} coché${n > 1 ? 's' : ''}${limite ? ` sur ${limite}` : ''}.`; el.className = limite && n > limite ? 'rouge-t' : ''; } };
    modale().querySelectorAll('input[name=p]').forEach((c) => c.addEventListener('change', maj));
    $('#filtre-coches')?.addEventListener('input', (ev) => { const q = ev.target.value.trim().toLowerCase(); modale().querySelectorAll('.coches .case').forEach((l) => { l.hidden = Boolean(q) && !l.dataset.texte.includes(q); }); });
    maj();
  }
  function modaleChambres() {
    const e = evtCourant();
    const heb = deEvt(E.chambres, e.id).at(-1)?.hebergement || e.lieu || '';
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
      const debut = f.get('debut') === '' ? deEvt(E.chambres, e.id).length + 1 : Number(f.get('debut'));
      memo();
      for (let i = 0; i < n; i++) E.chambres.push({ id: uid(), evtId: e.id, hebergement: String(f.get('hebergement') || '').trim(), nom: `Chambre ${debut + i}`, type: f.get('type'), capacite, note: '' });
      fait(`${pluriel(n, 'chambre ajoutée', 'chambres ajoutées')} (${pluriel(n * capacite, 'place')}).`);
    });
    const typeSel = modale().querySelector('[name=type]');
    typeSel.addEventListener('change', () => { modale().querySelector('[name=capacite]').value = typeChambre(typeSel.value).capacite; });
  }
  function modaleChambre(id) {
    const c = chambre(id);
    ouvrirModale('Modifier la chambre', `
      <div class="deux"><label class="champ">Nom ou numéro<input name="nom" required maxlength="40" value="${esc(c.nom)}"></label><label class="champ">Hébergement<input name="hebergement" maxlength="80" value="${esc(c.hebergement)}"></label></div>
      <div class="deux"><label class="champ">Type<select name="type">${B.chambres.map((t) => `<option value="${t.id}" ${t.id === c.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ">Places<input type="number" name="capacite" min="1" max="6" value="${c.capacite}"></label></div>
      <label class="champ">Note<small>Étage, vue, accès de plain-pied… (aucune donnée de santé)</small><input name="note" maxlength="120" value="${esc(c.note)}"></label>
      <p class="erreur" role="alert"></p>`, piedSimple(true), (f, action) => {
      if (action === 'supprimer') { memo(); E.chambres = E.chambres.filter((x) => x.id !== id); E.invites.forEach((p) => { if (p.chambreId === id) p.chambreId = ''; }); fait(`${c.nom} supprimée.`); return; }
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
    const e = evtCourant();
    const r = R.repartir(e, deEvt(E.invites, e.id), deEvt(E.chambres, e.id));
    const n = Object.keys(r.affectations).length;
    if (!n) { toast(r.restants.length ? `Aucune place libre pour ${pluriel(r.restants.length, 'confirmé')} à loger : ajoute des chambres.` : 'Aucun confirmé à loger.'); return; }
    memo();
    Object.entries(r.affectations).forEach(([pid, cid]) => { E.invites.find((p) => p.id === pid).chambreId = cid; });
    fait(`${pluriel(n, 'personne placée', 'personnes placées')}${r.restants.length ? ` ; ${r.restants.length} sans place` : ''}. Vérifie et ajuste chambre par chambre.`);
  }

  function modaleSequence(id) {
    const e = evtCourant();
    const m = mots(e);
    const x = id ? E.conducteur.find((y) => y.id === id) : null;
    const nb = Math.max(1, e.nbJours || 1);
    const derniere = R.programme(deEvt(E.conducteur, e.id)).filter((y) => y.jour === ui.jour).at(-1);
    const lieux = [...new Set(deEvt(E.conducteur, e.id).map((y) => (y.lieu || '').trim()).filter(Boolean))].sort();
    const Seq = m.seq[0].toUpperCase() + m.seq.slice(1);
    const corps = `
      <label class="champ">${Seq}<input name="titre" required maxlength="100" value="${esc(x?.titre || '')}" placeholder="Ex. : Mot d'accueil"></label>
      <div class="deux">
        <label class="champ">Type<small>« Repas » alimente la fiche traiteur</small><select name="type">${B.sequences.map((t) => `<option value="${t.id}" ${t.id === (x?.type || '') ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        ${nb > 1 ? `<label class="champ">Jour<select name="jour">${Array.from({ length: nb }, (_, i) => `<option value="${i + 1}" ${(x?.jour || ui.jour) === i + 1 ? 'selected' : ''}>Jour ${i + 1} · ${fmt(ajout(e.date, i))}</option>`).join('')}</select></label>` : '<span></span>'}
      </div>
      <div class="deux">
        <label class="champ">Début<input type="time" name="heure" required value="${esc(x?.heure || (derniere ? R.hm(Math.min(derniere.fin, 23 * 60 + 59)) : e.heure || '09:00'))}"></label>
        <label class="champ">Durée (minutes)<input type="number" name="duree" min="0" max="1440" value="${x ? x.duree : 30}"></label>
      </div>
      <div class="deux">
        <label class="champ">${esc(m.lieu)}<small>Les chevauchements sont signalés par lieu ; plusieurs lieux = en parallèle.</small><input name="lieu" maxlength="60" list="liste-lieux" value="${esc(x?.lieu || '')}"><datalist id="liste-lieux">${lieux.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
        <label class="champ">Responsable ou animation<input name="responsable" maxlength="60" value="${esc(x?.responsable || '')}"></label>
      </div>
      <label class="champ">Notes<small>Technique, micro, support à lancer…</small><input name="notes" maxlength="200" value="${esc(x?.notes || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? `Modifier la ${m.seq}` : `Nouvelle ${m.seq}`, corps, piedSimple(x ? true : false), (f, action) => {
      if (action === 'supprimer') { memo(); E.conducteur = E.conducteur.filter((y) => y.id !== x.id); fait(`${Seq} supprimée.`); return; }
      const titre = String(f.get('titre') || '').trim();
      const debut = R.minutes(f.get('heure'));
      const duree = Number(f.get('duree'));
      if (!titre) return `Indique la ${m.seq}.`;
      if (debut === null) return 'Heure de début invalide.';
      if (!Number.isInteger(duree) || duree < 0 || debut + duree > 1440) return 'Durée : minutes entières, sans dépasser minuit.';
      memo();
      const v = { titre, type: f.get('type') || '', heure: R.hm(debut), duree, lieu: String(f.get('lieu') || '').trim(), responsable: String(f.get('responsable') || '').trim(), notes: String(f.get('notes') || '').trim(), jour: Number(f.get('jour') || x?.jour || ui.jour) };
      if (x) Object.assign(x, v); else E.conducteur.push({ id: uid(), evtId: e.id, ...v });
      ui.jour = v.jour;
      fait(x ? `${Seq} enregistrée.` : `${Seq} ajoutée.`);
    });
  }
  function modaleDecaler(id) {
    const e = evtCourant();
    const x = E.conducteur.find((y) => y.id === id);
    const m = mots(e);
    const n = deEvt(E.conducteur, e.id).filter((y) => y.jour === x.jour && R.minutes(y.heure) >= R.minutes(x.heure)).length;
    ouvrirModale('Décaler le déroulé', `<p>« ${esc(x.titre)} » (${esc(x.heure)}) et les ${m.seq}s suivantes du même jour : <b>${pluriel(n, m.seq)}</b>.</p>
      <label class="champ">Décalage (minutes)<small>Négatif pour avancer.</small><input type="number" name="n" value="15" min="-600" max="600" required></label>
      <div class="rang">${[-15, -5, 5, 10, 15, 30].map((v) => `<button type="button" class="btn petit" data-action="choisir-decalage" data-v="${v}">${v > 0 ? '+' : ''}${v} min</button>`).join('')}</div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Décaler</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const r = R.decaler(deEvt(E.conducteur, e.id), id, Number(f.get('n')));
      if (typeof r === 'string') return r;
      memo();
      E.conducteur.forEach((y) => { if (r[y.id]) y.heure = r[y.id]; });
      fait(`${pluriel(Object.keys(r).length, `${m.seq} décalée`, `${m.seq}s décalées`)}.`);
    });
  }
  const NOMS_CONDUCTEURS = { mariage: 'Mariage', journee: 'Séminaire d\'une journée', deuxjours: 'Séminaire de deux jours avec nuitée', salon: 'Salon (journée d\'exposant)', soiree: 'Soirée ou lancement', conference: 'Conférence ou matinale', fete: 'Fête de famille' };
  function modaleConducteurType() {
    const e = evtCourant();
    const nb = Math.max(1, e.nbJours || 1);
    ouvrirModale('Ajouter un déroulé type', `
      <fieldset class="choix-base"><legend>Déroulé <small>Horaires d'exemple, rédigés pour le template : adapte-les.</small></legend>
        ${Object.keys(B.conducteurs).map((k) => `<label class="case"><input type="radio" name="modele" value="${k}" ${k === R.cleConducteur(e) ? 'checked' : ''}> ${esc(NOMS_CONDUCTEURS[k])} (${pluriel(B.conducteurs[k].filter(([j]) => j <= nb).length, 'séquence')})</label>`).join('')}
      </fieldset>
      <p class="aide">Les séquences s'ajoutent à celles qui existent déjà.</p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      memo();
      fait(`${pluriel(ajouterConducteurType(e, f.get('modele')), 'séquence ajoutée', 'séquences ajoutées')} (horaires d'exemple à adapter).`);
    });
  }
  function modaleCheck(id) {
    const e = evtCourant();
    const x = id ? E.checklist.find((y) => y.id === id) : null;
    ouvrirModale(x ? 'Modifier le point' : 'Nouveau point de checklist', `
      <label class="champ">Point à vérifier<input name="libelle" required maxlength="140" value="${esc(x?.libelle || '')}"></label>
      <div class="deux"><label class="champ">Heure<small>Facultative</small><input type="time" name="heure" value="${esc(x?.heure || '')}"></label><label class="champ">Qui s'en charge<input name="responsable" maxlength="40" value="${esc(x?.responsable || '')}"></label></div>
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
    const nbSens = e ? R.aSensibles(E.invites, e.id) : 0;
    const corps = `
      <label class="champ">Nom affiché<small>Structure, service, association ou famille</small><input name="structure" maxlength="60" value="${esc(E.structure)}"></label>
      <fieldset class="choix-base"><legend>Montants saisis <small>Simple libellé affiché à côté des montants.</small></legend>
        <label class="case"><input type="radio" name="convention" value="TTC" ${E.reglages.convention === 'TTC' ? 'checked' : ''}> Toutes taxes comprises (TTC)</label>
        <label class="case"><input type="radio" name="convention" value="HT" ${E.reglages.convention === 'HT' ? 'checked' : ''}> Hors taxes (HT)</label>
      </fieldset>
      <div class="groupe"><h3>Données sensibles des invités</h3>
        <p class="aide">Régimes, allergies et besoins d'accessibilité sont des données sensibles : saisie facultative, avec l'accord explicite de chacun, comptage agrégé pour le traiteur. Efface-les dès que l'événement est passé : le tableau de bord te le rappelle. ${esc(B.rgpd.source)} Outil d'aide, pas un conseil juridique.</p>
        ${e ? `<div class="rang"><button class="btn petit danger" type="button" data-action="effacer-sensibles" data-id="${e.id}" ${nbSens ? '' : 'disabled'}>Effacer régimes, allergies et accessibilité de « ${esc(e.nom)} » (${nbSens})</button></div>` : ''}</div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé ; toute personne qui a la clé les voit.'} La copie complète (JSON) répond aussi à une demande d'accès d'un invité. « Restaurer une copie » accepte aussi une copie exportée de l'ancien Organisateur de mariage ou du template Séminaire / offsite : chacune s'ajoute comme un événement de son type. Taille actuelle : ${Math.ceil(R.taille(E) / 1024)} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Base intégrée</h3><p class="aide">Rétroplannings, déroulés, checklists et postes rédigés pour ce template, par type d'événement : délais et horaires indicatifs, aucun prix de référence, aucun horaire de transporteur. Mariage civil : ${esc(B.demarches.source)}</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes de l'organisateur, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.structure = String(f.get('structure') || '').trim();
      E.reglages.convention = f.get('convention') === 'HT' ? 'HT' : 'TTC';
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      try { restaurer(JSON.parse(await f.text())); } catch { toast('Ce fichier n\'est pas une copie valide de l\'organisateur d\'événement.'); }
    });
  }
  // Copie de ce template : remplace tout. Copie de l'organisateur de mariage ou du séminaire : ajoute ses événements.
  function restaurer(d) {
    const nature = R.natureCopie(d);
    if (!nature) throw new Error('copie inconnue');
    const vu = E.tutorielVu;
    if (nature === 'evenement') {
      if (!confirm(`Remplacer toutes tes données par cette copie (${pluriel(d.evenements.length, 'événement')}) ?`)) return;
      memo();
      E = normaliser(d); delete E.majLe; E.tutorielVu = Boolean(E.tutorielVu || vu);
      modale().close(); fait('Copie restaurée.');
      return;
    }
    const imp = nature === 'mariage' ? R.depuisMariage(d, uid, auj(), [...E.prestataires]) : R.depuisSeminaire(d, uid, auj(), [...E.prestataires]);
    if (!imp.evenements.length) throw new Error('vide');
    const quoi = nature === 'mariage' ? 'copie de l\'organisateur de mariage' : 'copie du template séminaire';
    if (!confirm(`Ajouter ${pluriel(imp.evenements.length, 'événement')} de cette ${quoi} à tes données (${imp.evenements.map((x) => x.nom).join(', ')}) ?`)) return;
    memo();
    R.ajouterImport(E, imp);
    ui.evtId = imp.evenements[0].id; ui.volet = 'liste'; memoUi();
    modale().close(); fait(`${pluriel(imp.evenements.length, 'événement ajouté', 'événements ajoutés')} depuis la ${quoi}.`);
  }
  function exporter() {
    telecharger(new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' }), `organisateur-evenement-${auj()}.json`);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const conv = E.reglages.convention;
    const blocs = [
      ['rose', 'Un modèle par événement', `Chaque événement a son type&nbsp;: mariage, séminaire ou offsite, événement d'entreprise ou d'association, fête de famille. Le type propose son rétroplanning, ses postes de budget, son déroulé et ses fonctions (plan de table, transports, hébergement, badges, adultes et enfants), à activer ou non dans <b>Modifier</b>. Le menu en haut de chaque onglet passe d'un événement à l'autre.`],
      ['beurre', 'Un rétroplanning calé sur la date', `Chaque tâche a une échéance relative à l'événement (J-45&nbsp;= 45 jours avant) ou une date fixe. Changer la date décale toutes les échéances relatives. À 7&nbsp;jours ou moins de son échéance, une tâche passe <b>Cette semaine</b>&nbsp;; une fois l'échéance dépassée, <b>En retard</b>.`],
      ['ciel', 'Prévu, engagé, payé', `Saisis ton prévu par poste. Seuls les contrats <b>Signés ou réservés</b> comptent dans l'engagé, et seules les échéances marquées payées dans le payé (montants en ${conv}). Une échéance non payée remonte dans les alertes 14&nbsp;jours avant sa date, puis passe en retard&nbsp;; un poste dépassé et la part d'un contrat «&nbsp;à planifier&nbsp;» sont signalés. Le coût par personne divise le total par les confirmés.`],
      ['sable', 'Invités et organisation', `Note les réponses&nbsp;: les couverts à prévoir comptent les oui et les en attente. Avec une date limite, les réponses en attente sont signalées 7&nbsp;jours avant, puis en urgence une fois la date passée. Selon les fonctions activées, l'onglet place chacun à table, dans un trajet ou une chambre, et signale ce qui manque ou déborde. Régimes, allergies et accessibilité sont comptés sans nom pour le traiteur&nbsp;; efface-les après l'événement.`],
      ['rose', 'Le jour J', `Le déroulé place chaque séquence à son heure et dans son lieu&nbsp;: plusieurs lieux en même temps, c'est en parallèle&nbsp;; deux séquences qui se recouvrent au même lieu sont signalées. Le jour même, la séquence en cours s'affiche et tu pointes les arrivées. Le déroulé, les badges, le plan de table et la liste des chambres s'impriment&nbsp;; la fiche traiteur se télécharge.`],
    ];
    const corps = `
      <p>L'organisateur calcule pour toi les échéances, le budget engagé, les paiements à venir et ce qui manque à chaque événement. Ton rôle&nbsp;: cocher les tâches faites, saisir tes contrats et leurs échéances, tenir la liste des invités et leurs réponses.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">Le <b>Tableau de bord</b> réunit tous tes événements et les alertes, les plus urgentes d'abord. Le carnet des prestataires, dans <b>Budget</b>, est commun à tous les événements. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils, comme toute personne qui a la clé.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.evenements.length;
    const pied = premier
      ? '<button class="btn primaire" value="evenement">Créer mon premier événement</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'evenement') setTimeout(() => modaleEvenement(), 0); });
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
  function trouverEch(contratId, id) {
    const c = E.contrats.find((x) => x.id === contratId);
    return { c, x: c?.echeances.find((y) => y.id === id) };
  }
  function effacerSensibles(id) {
    const e = evt(id) || evtCourant();
    if (!e || !confirm(`Effacer définitivement régimes, allergies et besoins d'accessibilité de « ${e.nom} » ?`)) return;
    const n = R.effacerSensibles(E.invites, e.id);
    if (modale().open) modale().close();
    sauver(); rendre(); toast(`Données sensibles effacées pour ${pluriel(n, 'personne')}.`);
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-modele': {
        if (!session.demo) { ouvrirDemo(true, el.dataset.v); break; }
        if ((E.demoVariante || 'tout') === el.dataset.v) break;
        const vu = E.tutorielVu;
        E = donneesDemo(el.dataset.v); E.tutorielVu = vu; ui.volet = 'liste'; ui.jour = 1; ui.grp = ''; ui.rep = ''; ui.q = ''; ui.resp = '';
        cache(); vue = 'bord'; history.replaceState(null, '', '#bord'); demarrer();
        break;
      }
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; const v = E.demoVariante || 'tout'; stock.suppr(CLE_DEMO); E = donneesDemo(v); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-type': accueil.type = el.dataset.v; accueil.etape = 3; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape -= 1; ecranAccueil(); break;
      case 'accueil-vide': terminerAccueilVide(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'voir-evt': if (modale().open) modale().close(); ui.evtId = id; ui.jour = 1; if (el.dataset.volet) ui.volet = el.dataset.volet; else if (el.dataset.vue === 'invites') ui.volet = 'liste'; memoUi(); if (el.dataset.vue === 'reglages') modaleReglages(); else changerVue(el.dataset.vue); break;
      case 'sous-vue': ui.volet = el.dataset.v; memoUi(); rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'evt-nouveau': modaleEvenement(); break;
      case 'evt-modifier': modaleEvenement(id); break;
      case 'tache-nouvelle': modaleTache(); break;
      case 'tache-modifier': modaleTache(id); break;
      case 'raccourci': { const f = el.closest('form'); f.avant.value = el.dataset.j; f.querySelector('[name=mode][value=relatif]').checked = true; break; }
      case 'modele': modaleModele(); break;
      case 'cocher': {
        const x = E.taches.find((y) => y.id === id);
        memo(); x.faite = x.faite ? null : auj();
        fait(x.faite ? `« ${x.titre} » faite.` : `« ${x.titre} » à refaire.`);
        break;
      }
      case 'filtre-retro': ui.retroTout = el.dataset.v === '1'; memoUi(); rendre(); break;
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
      case 'groupes': modaleGroupes(); break;
      case 'repondre': {
        const i = E.invites.find((y) => y.id === id);
        if (i.reponse === el.dataset.v) break;
        memo(); i.reponse = el.dataset.v;
        const libere = i.reponse === 'non' && (i.tableId || i.allerId || i.retourId || i.chambreId);
        if (i.reponse !== 'oui') i.present = false;
        if (i.reponse === 'non') Object.assign(i, { tableId: null, allerId: '', retourId: '', chambreId: '' });
        fait(`${R.nomComplet(i)} : ${REP[i.reponse].toLowerCase()}${libere ? ' (place, trajets et chambre libérés)' : ''}.`);
        break;
      }
      case 'present': { const i = E.invites.find((y) => y.id === id); memo(); i.present = !i.present; if (i.present) i.reponse = 'oui'; fait(i.present ? `${R.nomComplet(i)} est arrivé.` : `${R.nomComplet(i)} : arrivée annulée.`); break; }
      case 'imprimer-badges': imprimerBadges(evtCourant()); break;
      case 'imprimer-tables': imprimerTables(evtCourant()); break;
      case 'csv': modaleCsv(); break;
      case 'voir-traiteur': modaleTraiteur(); break;
      case 'table-nouvelle': modaleTable(); break;
      case 'table-modifier': modaleTable(id); break;
      case 'retirer-declines': {
        memo();
        deEvt(E.invites, evtCourant().id).forEach((i) => { if (i.reponse === 'non') i.tableId = null; });
        fait('Personnes ayant décliné retirées des tables.');
        break;
      }
      case 'trajet-nouveau': modaleTrajet(); break;
      case 'trajet-modifier': modaleTrajet(id); break;
      case 'passagers': modaleAffectation('trajet', id); break;
      case 'occupants': modaleAffectation('chambre', id); break;
      case 'chambre-modifier': modaleChambre(id); break;
      case 'chambres-nouvelles': modaleChambres(); break;
      case 'repartir': repartirAuto(); break;
      case 'imprimer-chambres': imprimerChambres(evtCourant()); break;
      case 'sequence-nouvelle': modaleSequence(); break;
      case 'sequence-modifier': modaleSequence(id); break;
      case 'decaler': modaleDecaler(id); break;
      case 'choisir-decalage': el.closest('form').n.value = el.dataset.v; break;
      case 'conducteur-type': modaleConducteurType(); break;
      case 'imprimer-conducteur': imprimerConducteur(evtCourant()); break;
      case 'jour': ui.jour = Number(el.dataset.v); rendre(); break;
      case 'check': { const x = E.checklist.find((y) => y.id === id); memo(); x.fait = !x.fait; sauver(); rendre(); break; }
      case 'check-nouveau': modaleCheck(); break;
      case 'check-modifier': modaleCheck(id); break;
      case 'checklist-type': memo(); fait(`${pluriel(ajouterChecklistType(evtCourant()), 'point ajouté', 'points ajoutés')}.`); break;
      case 'checklist-raz': if (confirm('Décocher tous les points de la checklist ?')) { memo(); deEvt(E.checklist, evtCourant().id).forEach((x) => { x.fait = false; }); fait('Checklist remise à zéro.'); } break;
      case 'effacer-sensibles': effacerSensibles(id); break;
      default: break;
    }
  });
  document.addEventListener('change', (ev) => {
    const choix = ev.target.closest?.('[data-choix-table]');
    if (choix) { placerInvite(choix.dataset.choixTable, choix.value || null); return; }
    const el = ev.target.closest('select[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'filtre-evt') { ui.evtId = el.value; ui.jour = 1; ui.resp = ''; ui.grp = ''; memoUi(); rendre(); }
    if (a === 'filtre-resp') { ui.resp = el.value; rendre(); }
    if (a === 'filtre-grp') { ui.grp = el.value; rendre(); }
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
    const p = new URLSearchParams(location.search);
    const demande = p.has('demo') ? (VARIANTES.includes(p.get('demo')) ? p.get('demo') : 'tout') : null;
    if (demande) history.replaceState(null, '', location.pathname + location.hash);
    // Lien ?demo : jamais au-dessus du code d'un acheteur ; une démo déjà ouverte change d'exemple si on le demande.
    if (demande && (!code || code === CODE_DEMO)) return ouvrirDemo(code === CODE_DEMO, demande);
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
  window.__evenementiel = { etat: () => E, regles: R, demo: (v) => donneesDemo(v) };
  init();
})();
