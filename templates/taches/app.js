// Gestionnaire de tâches QME : boîte de réception, triage, focus du jour, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.TCH;
  const API = '/api/templates';
  const PRODUIT = 'TCH';
  const CLE_CODE = 'qme-tch-code';
  const CLE_CACHE = 'qme-tch-cache';
  const CLE_DEMO = 'qme-tch-demo';
  const CLE_ACCUEIL = 'qme-tch-ecran-accueil';
  const CODE_DEMO = 'DEMO';
  const NOM = 'Gestionnaire de tâches';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, ecart, versDate, iso } = R;
  const auj = () => iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    return fmt(s);
  };
  const heureTexte = (h) => (h ? h.replace(':', 'h').replace(/h00$/, 'h') : '');
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let mode = 'liste'; // vue Tâches : liste, kanban, matrice, archive
  const filtres = { q: '', projet: '', criticite: '', quadrant: '', type: '', faites: false };
  let decalageSemaine = 0;

  const jeu = (id) => B.jeux.find((j) => j.id === id) || B.jeux[1];
  const typesDe = (j) => j.types.map((nom) => ({ id: R.sansAccent(nom).replace(/[^a-z0-9]+/g, ''), nom }));
  const etatVide = (jeuId = 'kanban') => {
    const j = jeu(jeuId);
    return { version: 1, prenom: '', jeu: j.id, statuts: structuredClone(j.statuts), types: typesDe(j), dossiers: [], projets: [], taches: [], journal: {},
      reglages: { focusMax: 5, capacite: 360, feries: true, alsace: false } };
  };
  const normaliser = (d) => {
    const v = etatVide(d?.jeu);
    if (!d || typeof d !== 'object') return v;
    const x = { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) } };
    for (const k of ['statuts', 'types', 'dossiers', 'projets', 'taches']) if (!Array.isArray(x[k])) x[k] = v[k];
    if (!x.statuts.length) x.statuts = v.statuts;
    if (!x.journal || typeof x.journal !== 'object') x.journal = {};
    x.taches = x.taches.filter((t) => t && t.id).map((t) => ({ sousTaches: [], apres: [], criticite: 'normale', ...t }));
    return x;
  };
  const cal = () => ({ feries: E.reglages.feries !== false, alsace: !!E.reglages.alsace });
  const tache = (id) => E.taches.find((t) => t.id === id);
  const projet = (id) => E.projets.find((p) => p.id === id);
  const dossier = (id) => E.dossiers.find((d) => d.id === id);
  const statutFini = () => E.statuts.find((s) => s.fini) || E.statuts[E.statuts.length - 1];
  const statutDepart = () => E.statuts.find((s) => !s.fini) || E.statuts[0];
  const statut = (id) => E.statuts.find((s) => s.id === id) || statutDepart();
  const actives = () => E.taches.filter((t) => R.estActive(t));
  const triees = () => actives().filter((t) => !t.inbox);
  const boite = () => E.taches.filter((t) => t.inbox && !t.archiveLe && !t.faitLe).sort((a, b) => (a.creeLe || '').localeCompare(b.creeLe || ''));
  const journalDu = (d) => (E.journal[d] ||= {});

  function nouvelleTache(champs = {}) {
    const t = { id: uid(), titre: '', note: '', projetId: null, statut: statutDepart().id, type: E.types[0]?.id || null, criticite: 'normale',
      urgent: null, important: null, echeance: null, heure: null, duree: null, sousTaches: [], recurrence: null, apres: [], focus: null,
      inbox: false, creeLe: auj(), faitLe: null, archiveLe: null, ...champs };
    E.taches.push(t);
    return t;
  }
  // Projet par nom (insensible à la casse et aux accents) ; créé s'il n'existe pas.
  function projetParNom(nom, creer = true) {
    if (!nom) return null;
    const n = R.sansAccent(nom);
    let p = E.projets.find((x) => R.sansAccent(x.nom) === n && !x.archive);
    if (!p && creer) {
      const utilisees = new Set(E.projets.map((x) => x.couleur));
      p = { id: uid(), nom: nom.charAt(0).toUpperCase() + nom.slice(1), couleur: (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[E.projets.length % B.couleurs.length]).id, dossierId: null, archive: false };
      E.projets.push(p);
    }
    return p;
  }

  // ---------- Actions métier ----------
  let annulation = null;
  function memoriserAnnulation() { annulation = { taches: structuredClone(E.taches), projets: structuredClone(E.projets), journal: structuredClone(E.journal) }; }
  function annuler() {
    if (!annulation) return;
    Object.assign(E, annulation);
    annulation = null;
    sauver(); rendre();
  }

  function terminer(t, { silencieux = false } = {}) {
    if (!t || t.faitLe) return null;
    memoriserAnnulation();
    const j = auj();
    t.faitLe = j; t.statut = statutFini().id; t.inbox = false;
    let suite = null;
    if (t.recurrence) {
      suite = R.prochaineInstance(t, j, cal(), uid());
      if (suite) { suite.statut = statutDepart().id; E.taches.push(suite); }
    }
    sauver();
    if (!silencieux) toast(suite ? `Fait. Prochaine fois : ${quand(suite.echeance)}.` : `« ${t.titre} » fait.`, { libelle: 'Annuler', faire: annuler });
    return suite;
  }
  function rouvrir(t) {
    memoriserAnnulation();
    // Une tâche récurrente rouverte reprend sa place : l'occurrence créée à sa fin est retirée si elle est intacte.
    if (t.recurrence) {
      const suite = E.taches.find((x) => x.serie === (t.serie || t.id) && x.id !== t.id && !x.faitLe && !x.archiveLe && x.creeLe === t.faitLe);
      if (suite) E.taches = E.taches.filter((x) => x !== suite);
    }
    t.faitLe = null; t.statut = statutDepart().id;
    sauver();
  }
  function archiver(t) {
    memoriserAnnulation();
    t.archiveLe = auj(); t.focus = null;
    sauver();
    toast(`« ${t.titre} » archivée.`, { libelle: 'Annuler', faire: annuler });
  }
  function basculerFocus(t) {
    const j = auj();
    if (t.focus === j) { t.focus = null; sauver(); rendre(); return; }
    const n = actives().filter((x) => x.focus === j).length;
    t.focus = j; t.inbox = false;
    sauver(); rendre();
    toast(n + 1 > E.reglages.focusMax ? `Ajoutée au focus. Tu dépasses ${E.reglages.focusMax} tâches : le focus perd de sa force.` : 'Ajoutée au focus du jour.');
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
      const { statut: st, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (st === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié tes tâches entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (st === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (st !== 200) {
        throw new Error(String(st));
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
      const { statut: st, corps } = await appel('/donnees');
      if (st === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
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
    // Code interne d'un template QME (préfixe de 3 lettres hors hexadécimal) : TCH-…, ou celui d'un autre template, refusé ensuite.
    if (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3))) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut: st, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
    if (st === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (st !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
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

  // ---------- Données de démonstration (relatives à aujourd'hui) ----------
  function donneesDemo() {
    E = etatVide('kanban');
    E.prenom = 'Camille';
    const t = auj();
    const c = cal();
    const dTravail = { id: uid(), nom: 'Travail' }, dPerso = { id: uid(), nom: 'Personnel' };
    E.dossiers.push(dTravail, dPerso);
    const P = {};
    [['clients', 'Clients', 'rouge', dTravail], ['prospection', 'Prospection', 'jaune', dTravail], ['admin', 'Administratif pro', 'bleu', dTravail],
      ['maison', 'Maison', 'vert', dPerso], ['papiers', 'Papiers et démarches', 'ciel', dPerso], ['formation', 'Formation tableur', 'prune', null]]
      .forEach(([k, nom, coul, d]) => { P[k] = { id: uid(), nom, couleur: coul, dossierId: d?.id || null, archive: false }; E.projets.push(P[k]); });
    E.projets.push({ id: uid(), nom: 'Déménagement', couleur: 'orange', dossierId: dPerso.id, archive: true });
    const ty = (nom) => E.types.find((x) => x.nom === nom)?.id || E.types[0].id;
    const n = (x) => nouvelleTache({ creeLe: ajout(t, -5), ...x });

    // Focus du jour
    const prop = n({ titre: 'Finaliser la proposition commerciale du client Martin', projetId: P.clients.id, statut: 'encours', type: ty('Livrable'), criticite: 'critique',
      urgent: true, important: true, echeance: t, heure: '10:00', duree: 90, focus: t,
      note: 'Reprendre le chiffrage de la phase 2 et joindre les références.',
      sousTaches: [{ id: uid(), titre: 'Relire le cahier des charges', fait: true }, { id: uid(), titre: 'Chiffrer la phase 2', fait: true },
        { id: uid(), titre: 'Rédiger le planning', fait: false }, { id: uid(), titre: 'Mise en page et envoi', fait: false }] });
    n({ titre: 'Préparer le point hebdomadaire avec l\'associé', projetId: P.admin.id, type: ty('Réunion'), criticite: 'haute', urgent: true, important: true,
      echeance: t, heure: '14:30', duree: 30, focus: t });
    n({ titre: 'Relancer les factures échues', projetId: P.admin.id, type: ty('Relance'), criticite: 'haute', urgent: true, important: false, echeance: t, duree: 20, focus: t,
      recurrence: { type: 'ouvre', n: 1 } });
    n({ titre: 'Payer la cantine du mois', projetId: P.papiers.id, type: ty('Administratif'), criticite: 'normale', urgent: true, important: true, echeance: t, duree: 10,
      focus: t, faitLe: t, statut: 'fait' });
    n({ titre: 'Réviser le chapitre sur les tableaux croisés', projetId: P.formation.id, criticite: 'normale', important: true, urgent: false, duree: 45, focus: t });

    // Retards et aujourd'hui
    n({ titre: 'Envoyer l\'attestation d\'assurance au bailleur', projetId: P.papiers.id, type: ty('Administratif'), criticite: 'haute', urgent: true, important: true, echeance: ajout(t, -2), duree: 15 });
    n({ titre: 'Répondre au syndic pour la date de l\'assemblée', projetId: P.maison.id, criticite: 'normale', urgent: true, important: false, echeance: ajout(t, -1), duree: 10 });
    n({ titre: 'Arroser les plantes', projetId: P.maison.id, criticite: 'basse', urgent: false, important: false, echeance: t, duree: 10, recurrence: { type: 'jour', n: 3 } });

    // À venir (charge de la semaine)
    n({ titre: 'Rendez-vous chez le dentiste', projetId: P.papiers.id, type: ty('Réunion'), criticite: 'normale', important: true, urgent: false, echeance: ajout(t, 1), heure: '09:30', duree: 60 });
    const devis = n({ titre: 'Envoyer le devis signé et le planning', projetId: P.clients.id, type: ty('Livrable'), criticite: 'haute', urgent: true, important: true, echeance: ajout(t, 1), duree: 20 });
    devis.apres = [prop.id];
    n({ titre: 'Atelier de cadrage avec le client Bernard', projetId: P.clients.id, type: ty('Réunion'), statut: 'afaire', criticite: 'haute', important: true, urgent: false, echeance: ajout(t, 2), heure: '09:00', duree: 180 });
    n({ titre: 'Rédiger le compte rendu de l\'atelier', projetId: P.clients.id, type: ty('Livrable'), criticite: 'normale', important: true, urgent: false, echeance: ajout(t, 2), duree: 120 });
    n({ titre: 'Mettre à jour le tableau des devis en cours', projetId: P.prospection.id, criticite: 'normale', important: true, urgent: false, echeance: ajout(t, 2), duree: 90 });
    n({ titre: 'Préparer le support de présentation', projetId: P.prospection.id, type: ty('Livrable'), statut: 'encours', criticite: 'normale', important: true, urgent: false, echeance: ajout(t, 3), duree: 120,
      sousTaches: [{ id: uid(), titre: 'Plan', fait: true }, { id: uid(), titre: 'Visuels', fait: false }, { id: uid(), titre: 'Relecture', fait: false }] });
    n({ titre: 'Attendre la réponse de la banque sur le prêt', projetId: P.papiers.id, statut: 'attente', criticite: 'normale', important: true, urgent: false, echeance: ajout(t, 4) });
    n({ titre: 'Contacter 3 prospects', projetId: P.prospection.id, type: ty('Relance'), criticite: 'haute', important: true, urgent: false, duree: 60,
      recurrence: { type: 'semaine', n: 1, jours: [1] }, echeance: R.premiereOccurrence({ type: 'semaine', n: 1, jours: [1] }, ajout(t, 1), c) });
    const fact = { type: 'mois', n: 1, mode: 'ouvre', rang: -1 };
    n({ titre: 'Émettre les factures du mois', projetId: P.admin.id, type: ty('Administratif'), criticite: 'critique', important: true, urgent: false, duree: 45, recurrence: fact, echeance: R.premiereOccurrence(fact, t, c) });
    const fin = { type: 'mois', n: 1, mode: 'fin' };
    n({ titre: 'Classer les papiers du mois', projetId: P.papiers.id, criticite: 'basse', important: false, urgent: false, duree: 20, recurrence: fin, echeance: R.premiereOccurrence(fin, t, c) });
    n({ titre: 'Renouveler la carte d\'identité', projetId: P.papiers.id, type: ty('Administratif'), criticite: 'normale', important: true, urgent: false, echeance: ajout(t, 24), duree: 45 });
    n({ titre: 'Purger les radiateurs', projetId: P.maison.id, criticite: 'basse', important: false, urgent: false, echeance: ajout(t, 9), duree: 45 });

    // Sans date
    n({ titre: 'Apprendre les raccourcis du tableur', projetId: P.formation.id, criticite: 'basse', important: true, urgent: false, duree: 30 });
    n({ titre: 'Trier le garage', projetId: P.maison.id, criticite: 'basse', important: false, urgent: false, duree: 180 });
    n({ titre: 'Refaire la page « références » du site', projetId: P.prospection.id, statut: 'attente', criticite: 'normale', duree: 90 });

    // Boîte de réception (saisies rapides pas encore triées)
    [['Rappeler le plombier pour le devis demain 10h', -1], ['Idée : une lettre d\'information trimestrielle aux clients', 0],
      ['Acheter un cadeau pour Léo samedi #Maison', 0], ['Lire l\'article sur la méthode GTD 20min', 0]].forEach(([s, j]) => {
      const a = R.analyserSaisie(s, t, { cal: c });
      n({ titre: a.titre, echeance: a.echeance, heure: a.heure, duree: a.duree, criticite: a.criticite || 'normale', projetId: projetParNom(a.projet, false)?.id || null, inbox: true, creeLe: ajout(t, j) });
    });

    // Historique : tâches faites les jours précédents, archives, journal des rituels
    [[-1, 'Envoyer la facture de septembre', P.admin.id, 30], [-1, 'Commander les cartouches d\'encre', P.admin.id, 10], [-2, 'Appeler l\'assurance', P.papiers.id, 20],
      [-3, 'Monter l\'étagère du bureau', P.maison.id, 60], [-3, 'Relire le contrat de sous-traitance', P.clients.id, 45]]
      .forEach(([j, titre, p, d]) => n({ titre, projetId: p, criticite: 'normale', echeance: ajout(t, j), duree: d, faitLe: ajout(t, j), statut: 'fait', focus: ajout(t, j) }));
    [[-8, 'Faire les cartons du salon'], [-12, 'Résilier l\'ancienne box internet'], [-20, 'Réserver le camion de déménagement']]
      .forEach(([j, titre]) => n({ titre, criticite: 'normale', faitLe: ajout(t, j), archiveLe: ajout(t, j + 1), statut: 'fait' }));
    n({ titre: 'Comparer trois logiciels de facturation', criticite: 'basse', archiveLe: ajout(t, -4) });
    for (let i = 1; i <= 4; i++) E.journal[ajout(t, -i)] = { matin: true, soir: { faites: 3 + (i % 3) } };
    E.journal[t] = { matin: true };
    return E;
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
          <rect x="10" y="20" width="260" height="260" fill="#1D4E89"/>
          <rect x="40" y="60" width="200" height="34" fill="#F0EDE6"/>
          <rect x="40" y="120" width="140" height="34" fill="#F5B400"/>
          <rect x="40" y="180" width="170" height="34" fill="#F0EDE6"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <path d="M290 280 A130 130 0 0 1 420 150 V280 Z" fill="#F5B400"/>
          <circle cx="420" cy="150" r="44" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestionnaire de tâches · boîte de réception et focus</p>
          <h1>Tout noter vite. Ne faire que l'essentiel.</h1>
          <p>Saisie rapide en français, triage urgent / important, focus de 3 à 5 tâches le matin et clôture du soir. Sans abonnement.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes tâches</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes tâches sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes tâches</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes tâches'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', jeu: 'kanban', modeles: new Set() };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton espace.</h1>
        <p class="intro">Deux questions, puis tu pourras vider ta tête dans la boîte de réception. Tout reste modifiable dans les réglages.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Tes statuts <span>Comment suis-tu l'avancement d'une tâche ?</span></h2>
        <div class="filieres" role="group" aria-label="Jeu de statuts">
          ${B.jeux.map((j, i) => `<button type="button" class="filiere" style="--c:${couleur(['jaune', 'rouge', 'bleu'][i])}" data-action="accueil-jeu" data-id="${j.id}" aria-pressed="${a.jeu === j.id}"><b>${esc(j.nom)}</b><span>${esc(j.statuts.map((s) => s.nom).join(' · '))}</span><span>${esc(j.detail)}</span></button>`).join('')}
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Projets de départ</p>
        <h1>Partir d'un modèle ?</h1>
        <p class="intro">Facultatif. Chaque modèle crée un projet avec ses tâches et ses routines (factures en fin de mois, relances du vendredi…). Tu peux aussi commencer vide.</p>
        <div class="choix-modeles">${B.modeles.map((m) => `<label class="modele-choix" style="--c:${couleur(m.couleur)}"><input type="checkbox" data-action="accueil-modele" value="${m.id}" ${a.modeles.has(m.id) ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.detail)} ${pluriel(m.taches.length, 'tâche')}.</small></span></label>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Commencer${a.modeles.size ? ` (${pluriel(a.modeles.size, 'projet')})` : ''}</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide(accueil.jeu);
    E.prenom = accueil.prenom.trim();
    for (const id of accueil.modeles) creerDepuisModele(B.modeles.find((m) => m.id === id), auj());
    accueil = { etape: 1, prenom: '', jeu: 'kanban', modeles: new Set() };
    sauver();
    vue = 'boite';
    demarrer();
    setTimeout(() => $('#saisie-boite')?.focus(), 200);
  }

  function creerDepuisModele(m, depart, nom = m.nom, dossierNom = m.dossier) {
    const t = auj();
    let d = dossierNom ? E.dossiers.find((x) => R.sansAccent(x.nom) === R.sansAccent(dossierNom)) : null;
    if (dossierNom && !d) { d = { id: uid(), nom: dossierNom }; E.dossiers.push(d); }
    const p = { id: uid(), nom, couleur: m.couleur, dossierId: d?.id || null, archive: false };
    E.projets.push(p);
    const crees = m.taches.map((x) => {
      const ech = x.j != null ? ajout(depart, x.j) : x.rec ? R.premiereOccurrence(x.rec, depart > t ? depart : t, cal()) : null;
      return nouvelleTache({ titre: x.t, projetId: p.id, criticite: x.c || 'normale', duree: x.d || null, recurrence: x.rec ? structuredClone(x.rec) : null, echeance: ech });
    });
    m.taches.forEach((x, i) => { if (x.apres != null && crees[x.apres]) crees[i].apres = [crees[x.apres].id]; });
    return p;
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    boite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 13h5l1.5 3h5L16 13h5v7H3z" fill="currentColor"/></svg>',
    taches: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    projets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    rec: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    focus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['boite', 'Boîte'], ['taches', 'Tâches'], ['semaine', 'Semaine'], ['projets', 'Projets']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestionnaire<br>de tâches</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span>${id === 'boite' ? '<em class="compteur" hidden></em>' : ''}</button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone ajout" data-action="saisie-rapide" aria-label="Saisie rapide" title="Saisie rapide (touche N)">${ICONES.plus}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    $$('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const nb = boite().length;
    const cpt = $('.onglet .compteur');
    if (cpt) { cpt.hidden = !nb; cpt.textContent = nb; }
    const titres = { aujourdhui: 'Aujourd\'hui', boite: 'Boîte de réception', taches: 'Tâches', semaine: 'Semaine', projets: 'Projets' };
    document.title = `${titres[vue]} · ${NOM}`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, boite: vueBoite, taches: vueTaches, semaine: vueSemaine, projets: vueProjets }[vue]();
    brancherVue();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  // Ligne de tâche commune à toutes les vues.
  function ligneTache(x, { compacte = false, focusBouton = true } = {}) {
    const t = auj();
    const p = projet(x.projetId);
    const bloq = R.bloquantes(x, E.taches);
    const q = R.quadrant(x);
    const retard = !x.faitLe && x.echeance && x.echeance < t;
    const st = x.sousTaches || [];
    const meta = [
      p ? `<span class="projet-puce" style="--c:${couleur(p.couleur)}"><i></i>${esc(p.nom)}</span>` : '',
      x.echeance ? `<span class="${retard ? 'retard' : ''}">${retard ? 'En retard · ' : ''}${quand(x.echeance)}${x.heure ? ` ${heureTexte(x.heure)}` : ''}</span>` : '',
      x.duree ? `<span>${R.dureeTexte(x.duree)}</span>` : '',
      st.length ? `<span>${st.filter((s) => s.fait).length}/${st.length}</span>` : '',
      x.recurrence ? `<span class="rec" title="${esc(R.decrireRecurrence(x.recurrence))}">${ICONES.rec}<span class="sr-only">Récurrente</span></span>` : '',
    ].filter(Boolean).join('');
    const etiquettes = [
      ['haute', 'critique'].includes(x.criticite) ? `<span class="etiquette ${x.criticite === 'critique' ? 'rouge' : 'jaune'}">${x.criticite}</span>` : '',
      !compacte && q && !x.faitLe ? `<span class="etiquette q-${q}">${R.QUADRANTS[q].nom}</span>` : '',
      bloq.length && !x.faitLe ? `<span class="etiquette bloque" title="Après : ${esc(bloq.map((b) => b.titre).join(', '))}">Bloquée</span>` : '',
      !compacte && E.statuts.length > 2 && !x.faitLe && x.statut !== statutDepart().id ? `<span class="etiquette statut">${esc(statut(x.statut).nom)}</span>` : '',
    ].join('');
    return `<li class="tache ${x.faitLe ? 'faite' : ''} ${compacte ? 'compacte' : ''}" style="--c:${couleur(p?.couleur || 'encre')}" data-tache="${x.id}">
      <button class="coche" data-action="cocher" data-id="${x.id}" aria-pressed="${!!x.faitLe}" aria-label="${x.faitLe ? 'Rouvrir' : 'Marquer comme faite'} : ${esc(x.titre)}"></button>
      <button class="tache-corps" data-action="tache-modifier" data-id="${x.id}">
        <b>${esc(x.titre)}</b>${etiquettes ? `<span class="etiquettes">${etiquettes}</span>` : ''}
        ${meta ? `<span class="tache-meta">${meta}</span>` : ''}
      </button>
      ${focusBouton && !x.faitLe ? `<button class="focus-bouton" data-action="focus" data-id="${x.id}" aria-pressed="${x.focus === t}" title="${x.focus === t ? 'Retirer du focus du jour' : 'Ajouter au focus du jour'}" aria-label="${x.focus === t ? 'Retirer du focus' : 'Ajouter au focus'} : ${esc(x.titre)}">${ICONES.focus}</button>` : ''}
    </li>`;
  }

  // ---------- Aujourd'hui ----------
  function vueAujourdhui() {
    const t = auj();
    const j = E.journal[t] || {};
    const focus = R.trier(E.taches.filter((x) => x.focus === t && !x.archiveLe), t);
    const focusActif = focus.filter((x) => !x.faitLe);
    const aussi = R.trier(triees().filter((x) => x.focus !== t && x.echeance && x.echeance <= t), t);
    const faites = E.taches.filter((x) => x.faitLe === t && x.focus !== t);
    const nbBoite = boite().length;
    const prevu = R.charge(focusActif) + R.charge(aussi);
    const cap = E.reglages.capacite;
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const ferie = R.nomFerie(t, cal());
    const titre = !E.taches.length ? `${salut}Commence par vider ta tête.`
      : !focus.length ? `${salut}${j.matin ? 'Aucun focus choisi.' : 'Choisis ton focus du jour.'}`
        : focusActif.length ? `${salut}<mark>${pluriel(focusActif.length, 'tâche')}</mark> au focus.` : `${salut}<mark>Focus terminé</mark>.`;
    const heure = new Date().getHours();
    let carte;
    if (!j.matin) carte = `<aside class="rituel-carte matin"><p class="surtitre">Rituel du matin · 2 min</p><h2>Choisis les 3 à ${E.reglages.focusMax} tâches qui comptent.</h2><p>Retards, échéances du jour, triage : on regarde tout, on garde l'essentiel.</p><button class="btn jaune" data-action="rituel-matin">Commencer</button></aside>`;
    else if (!j.soir) carte = `<aside class="rituel-carte soir ${heure >= 16 ? '' : 'calme'}"><p class="surtitre">Clôture du soir</p><h2>${focus.filter((x) => x.faitLe).length} / ${focus.length} au focus</h2><p>Reporter ce qui reste, archiver ce qui est fait, noter le bilan. La journée est close.</p><button class="btn jaune" data-action="rituel-soir">Clore la journée</button></aside>`;
    else carte = `<aside class="rituel-carte close"><p class="surtitre">Journée close</p><h2>${pluriel(j.soir.faites ?? 0, 'tâche faite', 'tâches faites')}</h2><p>${R.serieClotures(E.journal, t) > 1 ? `${R.serieClotures(E.journal, t)} journées closes d'affilée.` : 'Bonne soirée.'}</p><button class="btn petit" data-action="rituel-soir">Revoir le bilan</button></aside>`;

    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}${ferie ? ` · ${esc(ferie)} (férié)` : ''}</p>
          <h1>${titre}</h1>
          ${focus.length ? `<p class="sous">${pluriel(focus.filter((x) => x.faitLe).length, 'faite')} sur ${focus.length}${prevu ? ` · ${R.dureeTexte(prevu)} prévues${cap ? ` pour ${R.dureeTexte(cap)} disponibles` : ''}` : ''}</p>
          <div class="progression" aria-hidden="true">${[...focus].sort((a, b) => (b.faitLe ? 1 : 0) - (a.faitLe ? 1 : 0)).map((x) => `<span class="${x.faitLe ? 'fait' : ''}"></span>`).join('')}</div>
          ${cap && prevu > cap ? `<p class="alerte">Plus de travail prévu que de temps disponible : reporte ou retire une tâche du focus.</p>` : ''}` : ''}
          <div class="actions">
            <button class="btn primaire" data-action="saisie-rapide">${ICONES.plus}Saisie rapide</button>
            ${nbBoite ? `<button class="btn" data-action="trier">Trier la boîte (${nbBoite})</button>` : ''}
          </div>
        </div>
        ${carte}
      </section>
      <h2 class="titre-section">Focus du jour <span>${focus.length ? 'Ce qui compte aujourd\'hui, dans l\'ordre de priorité.' : ''}</span></h2>
      ${focus.length ? `<ul class="taches">${focus.map((x) => ligneTache(x)).join('')}</ul>`
        : !E.taches.length ? videEtat('Rien encore', 'Note tout ce qui te passe par la tête dans la boîte de réception, puis trie : chaque idée trouve sa place.', `<button class="btn primaire" data-action="vue" data-vue="boite">Ouvrir la boîte</button><button class="btn" data-action="projet-modele">Partir d'un modèle</button>`)
          : videEtat('Pas encore de focus', `Le rituel du matin te propose les tâches les plus pressantes ; tu en gardes ${E.reglages.focusMax} au plus. Tu peux aussi cliquer sur le rond d'une tâche.`, '<button class="btn primaire" data-action="rituel-matin">Choisir mon focus</button>')}
      ${aussi.length ? `<h2 class="titre-section">Aussi prévu <span>Échéances du jour et retards hors focus.</span></h2><ul class="taches">${aussi.map((x) => ligneTache(x)).join('')}</ul>` : ''}
      ${faites.length ? `<details class="faites"><summary>Faites aujourd'hui hors focus (${faites.length})</summary><ul class="taches">${faites.map((x) => ligneTache(x, { compacte: true })).join('')}</ul></details>` : ''}`;
  }

  // ---------- Boîte de réception ----------
  function vueBoite() {
    const liste = boite();
    return `
      <div class="vue-tete"><div><h1>Boîte de réception</h1><p>Tout ce qui est saisi vite arrive ici. Ensuite, on trie : urgent ou pas, important ou pas, quel projet, quand.</p></div>
        ${liste.length ? `<div class="actions"><button class="btn primaire" data-action="trier">Trier (${liste.length})</button></div>` : ''}</div>
      ${formSaisie('boite')}
      <h2 class="titre-section">À trier <span>${liste.length ? pluriel(liste.length, 'élément') : ''}</span></h2>
      ${liste.length ? `<ul class="taches">${liste.map((x) => `<li class="tache boite-el" style="--c:var(--trait)" data-tache="${x.id}">
          <button class="coche" data-action="cocher" data-id="${x.id}" aria-pressed="false" aria-label="Faite tout de suite : ${esc(x.titre)}"></button>
          <button class="tache-corps" data-action="trier" data-id="${x.id}"><b>${esc(x.titre)}</b><span class="tache-meta">${[x.projetId ? `<span>#${esc(projet(x.projetId)?.nom)}</span>` : '', x.echeance ? `<span>${quand(x.echeance)}${x.heure ? ` ${heureTexte(x.heure)}` : ''}</span>` : '', x.duree ? `<span>${R.dureeTexte(x.duree)}</span>` : '', `<span>saisie ${quand(x.creeLe)}</span>`].join('')}</span></button>
          <button class="btn petit" data-action="trier" data-id="${x.id}">Trier</button>
        </li>`).join('')}</ul>`
        : videEtat('Boîte vide', 'Tout est trié. Tape une idée ci-dessus dès qu\'elle arrive : tu la classeras plus tard.')}`;
  }

  function formSaisie(contexte) {
    return `<form class="saisie" id="form-saisie-${contexte}" data-contexte="${contexte}" autocomplete="off">
      <label class="sr-only" for="saisie-${contexte}">Nouvelle tâche</label>
      <div class="saisie-ligne"><input id="saisie-${contexte}" class="saisie-champ" maxlength="300" placeholder="Ex. : Appeler la banque demain 14h !haute #Perso 30min" enterkeyhint="done">
      <button class="btn primaire" type="submit">Ajouter</button></div>
      <div class="puces" aria-live="polite"></div>
      <details class="aide-saisie"><summary>Ce que la saisie rapide comprend</summary>
        <ul>
          <li><b>Date</b> : aujourd'hui, demain, après-demain, lundi, jeudi en huit, dans 3 jours, dans 2 semaines, le 15, 24/12, 3 mars, fin du mois, fin de semaine</li>
          <li><b>Heure</b> : 14h, 9h30, 16:45, à 8h</li>
          <li><b>Durée</b> : 30min, 45 mn, 1h30, ~3h (au-delà de 5 h, mets ~ devant)</li>
          <li><b>Criticité</b> : !basse, !normale, !haute, !critique (ou !! et !!!)</li>
          <li><b>Projet</b> : #Perso, #Maison_et_jardin ou #"Maison et jardin" (créé s'il n'existe pas)</li>
          <li><b>Répétition</b> : tous les jours, chaque jour ouvré, chaque lundi, toutes les 2 semaines, tous les mois le 5, chaque fin de mois, tous les ans</li>
        </ul></details>
    </form>`;
  }

  function puces(a) {
    return a.reconnu.map((r) => `<span class="puce">${esc(r)}</span>`).join('') + (a.titre ? '' : '');
  }

  // Crée une tâche depuis une saisie rapide ; dans la boîte sauf si « ranger » est demandé.
  function ajouterSaisie(texte, ranger = false) {
    const a = R.analyserSaisie(texte, auj(), { cal: cal() });
    if (!a.titre) return null;
    const p = projetParNom(a.projet, true);
    return nouvelleTache({ titre: a.titre.slice(0, 200), echeance: a.echeance, heure: a.heure, duree: a.duree, criticite: a.criticite || 'normale',
      projetId: p?.id || null, recurrence: a.recurrence, inbox: !ranger });
  }

  // ---------- Tâches (liste, kanban, matrice, archive) ----------
  function filtrer(liste) {
    return liste.filter((x) => (!filtres.projet || (filtres.projet === '-' ? !x.projetId : x.projetId === filtres.projet))
      && (!filtres.criticite || x.criticite === filtres.criticite)
      && (!filtres.quadrant || (filtres.quadrant === '-' ? !R.quadrant(x) : R.quadrant(x) === filtres.quadrant))
      && (!filtres.type || x.type === filtres.type)
      && R.correspond(x, filtres.q, projet(x.projetId)?.nom));
  }

  function vueTaches() {
    const modes = [['liste', 'Liste'], ['kanban', 'Kanban'], ['matrice', 'Matrice'], ['archive', 'Archive']];
    const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
    const nbFiltres = ['projet', 'criticite', 'quadrant', 'type'].filter((k) => filtres[k]).length;
    return `
      <div class="vue-tete"><div><h1>Tâches</h1><p>Toutes les tâches triées. Clique sur une tâche pour la modifier ; le rond l'ajoute au focus du jour.</p></div>
        <div class="actions"><button class="btn primaire" data-action="tache-nouvelle">${ICONES.plus}Tâche</button></div></div>
      <div class="segments" role="tablist" aria-label="Affichage">${modes.map(([id, l]) => `<button role="tab" data-action="mode" data-mode="${id}" aria-selected="${mode === id}">${l}${id === 'archive' ? ` (${E.taches.filter((x) => x.archiveLe).length})` : ''}</button>`).join('')}</div>
      <div class="outils">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input type="search" id="recherche" value="${esc(filtres.q)}" placeholder="Rechercher…"></label>
        <details class="filtres" ${nbFiltres ? 'open' : ''}><summary>Filtres${nbFiltres ? ` (${nbFiltres})` : ''}</summary><div class="filtres-corps">
          <label class="champ">Projet<select data-filtre="projet">${opt('', 'Tous', filtres.projet)}${opt('-', 'Sans projet', filtres.projet)}${E.projets.filter((p) => !p.archive).map((p) => opt(p.id, p.nom, filtres.projet)).join('')}</select></label>
          <label class="champ">Criticité<select data-filtre="criticite">${opt('', 'Toutes', filtres.criticite)}${B.criticites.map((c) => opt(c.id, c.nom, filtres.criticite)).join('')}</select></label>
          <label class="champ">Triage<select data-filtre="quadrant">${opt('', 'Tous', filtres.quadrant)}${Object.entries(R.QUADRANTS).map(([k, q]) => opt(k, q.nom, filtres.quadrant)).join('')}${opt('-', 'Non trié', filtres.quadrant)}</select></label>
          <label class="champ">Type<select data-filtre="type">${opt('', 'Tous', filtres.type)}${E.types.map((y) => opt(y.id, y.nom, filtres.type)).join('')}</select></label>
          ${mode === 'liste' ? `<label class="case"><input type="checkbox" data-filtre="faites" ${filtres.faites ? 'checked' : ''}> Afficher les terminées</label>` : ''}
          ${nbFiltres ? '<button class="btn petit" type="button" data-action="filtres-raz">Effacer les filtres</button>' : ''}
        </div></details>
      </div>
      <div id="resultats">${resultats()}</div>`;
  }

  function resultats() {
    const t = auj();
    if (mode === 'archive') {
      const liste = filtrer(E.taches.filter((x) => x.archiveLe)).sort((a, b) => b.archiveLe.localeCompare(a.archiveLe));
      if (!liste.length) return videEtat('Archive vide', 'Une tâche supprimée ou rangée à la clôture du soir arrive ici. Tu peux la restaurer à tout moment.');
      return `<ul class="taches archive">${liste.map((x) => `<li class="tache faite" style="--c:${couleur(projet(x.projetId)?.couleur || 'encre')}"><span class="coche-vide"></span><div class="tache-corps"><b>${esc(x.titre)}</b><span class="tache-meta"><span>${x.faitLe ? `Faite ${quand(x.faitLe)}` : 'Non faite'}</span><span>archivée ${quand(x.archiveLe)}</span>${projet(x.projetId) ? `<span>${esc(projet(x.projetId).nom)}</span>` : ''}</span></div>
        <div class="rang"><button class="btn petit" data-action="restaurer" data-id="${x.id}">Restaurer</button><button class="btn petit danger" data-action="supprimer-def" data-id="${x.id}">Supprimer</button></div></li>`).join('')}</ul>`;
    }
    if (mode === 'kanban') {
      const base = filtrer(E.taches.filter((x) => !x.archiveLe && !x.inbox));
      return `<div class="kanban" style="--n:${E.statuts.length}">${E.statuts.map((s, i) => {
        const col = R.trier(base.filter((x) => (s.fini ? x.faitLe : !x.faitLe && statut(x.statut).id === s.id)), t);
        return `<section class="colonne" data-statut="${s.id}" style="--c:${couleur(s.couleur)};--t:${texteSur(s.couleur)}" aria-label="${esc(s.nom)}">
          <h2>${esc(s.nom)}<span>${col.length}</span></h2>
          <ul>${col.map((x) => `<li class="kcarte" draggable="true" data-tache="${x.id}" style="--p:${couleur(projet(x.projetId)?.couleur || 'trait')}">
            <button class="kcarte-corps" data-action="tache-modifier" data-id="${x.id}"><b>${esc(x.titre)}</b><span class="tache-meta">${projet(x.projetId) ? `<span>${esc(projet(x.projetId).nom)}</span>` : ''}${x.echeance ? `<span class="${!x.faitLe && x.echeance < t ? 'retard' : ''}">${quand(x.echeance)}</span>` : ''}${x.duree ? `<span>${R.dureeTexte(x.duree)}</span>` : ''}${R.estBloquee(x, E.taches) && !x.faitLe ? '<span class="retard">Bloquée</span>' : ''}</span></button>
            <div class="kcarte-pied">${i > 0 ? `<button data-action="deplacer" data-id="${x.id}" data-vers="${E.statuts[i - 1].id}" aria-label="Vers ${esc(E.statuts[i - 1].nom)}">◀</button>` : '<span></span>'}${i < E.statuts.length - 1 ? `<button data-action="deplacer" data-id="${x.id}" data-vers="${E.statuts[i + 1].id}" aria-label="Vers ${esc(E.statuts[i + 1].nom)}">▶</button>` : ''}</div>
          </li>`).join('') || '<li class="kvide">Glisse une tâche ici.</li>'}</ul>
        </section>`;
      }).join('')}</div>`;
    }
    if (mode === 'matrice') {
      const base = filtrer(triees());
      const sans = base.filter((x) => !R.quadrant(x));
      return `<div class="matrice">
        <span class="axe-h"><b>Urgent</b><b>Pas urgent</b></span><span class="axe-v"><b>Important</b><b>Peu important</b></span>
        ${['faire', 'planifier', 'expedier', 'abandonner'].map((k) => {
          const l = R.trier(base.filter((x) => R.quadrant(x) === k), t);
          return `<section class="quadrant q-${k}"><h2>${R.QUADRANTS[k].nom}<span>${l.length}</span></h2><p>${R.QUADRANTS[k].detail}</p><ul class="taches">${l.map((x) => ligneTache(x, { compacte: true })).join('') || '<li class="kvide">Rien ici.</li>'}</ul></section>`;
        }).join('')}
      </div>
      ${sans.length ? `<h2 class="titre-section">Pas encore triées <span>Indique urgent / important dans la tâche pour la placer.</span></h2><ul class="taches">${R.trier(sans, t).map((x) => ligneTache(x)).join('')}</ul>` : ''}`;
    }
    // Liste par échéance
    const base = filtrer(E.taches.filter((x) => !x.archiveLe && !x.inbox && (filtres.faites || !x.faitLe)));
    if (!base.length) {
      return E.taches.some((x) => !x.archiveLe && !x.inbox)
        ? videEtat('Aucune tâche ne correspond', 'Change la recherche ou les filtres.', '<button class="btn" data-action="filtres-raz">Effacer les filtres</button>')
        : videEtat('Aucune tâche triée', 'Ajoute une tâche, trie ta boîte de réception ou pars d\'un modèle de projet.', `<button class="btn primaire" data-action="tache-nouvelle">Nouvelle tâche</button><button class="btn" data-action="projet-modele">Modèles de projets</button>`);
    }
    const actifs = base.filter((x) => !x.faitLe);
    const groupes = R.TRANCHES.map(([k, nom]) => [k, nom, R.trier(actifs.filter((x) => R.tranche(x, t) === k), t)]).filter(([, , l]) => l.length);
    const finies = base.filter((x) => x.faitLe).sort((a, b) => b.faitLe.localeCompare(a.faitLe));
    return groupes.map(([k, nom, l]) => `<h2 class="titre-section ${k === 'retard' ? 'rouge' : ''}">${nom} <span>${pluriel(l.length, 'tâche')}${R.charge(l) ? ` · ${R.dureeTexte(R.charge(l))}` : ''}</span></h2><ul class="taches">${l.map((x) => ligneTache(x)).join('')}</ul>`).join('')
      + (finies.length ? `<h2 class="titre-section">Terminées <span>${finies.length}</span></h2><ul class="taches">${finies.map((x) => ligneTache(x, { compacte: true })).join('')}</ul>` : '');
  }

  // ---------- Semaine ----------
  function vueSemaine() {
    const t = auj();
    const lundi = ajout(R.lundiDe(t), 7 * decalageSemaine);
    const jours = Array.from({ length: 7 }, (_, i) => ajout(lundi, i));
    const cap = E.reglages.capacite;
    const colonnes = jours.map((d) => {
      const liste = R.trier(E.taches.filter((x) => !x.archiveLe && !x.inbox && (x.faitLe ? x.faitLe === d && (x.echeance === d || x.focus === d) : d < t ? false : (d === t ? x.echeance && x.echeance <= t : x.echeance === d))), d)
        .sort((a, b) => (a.heure || '99').localeCompare(b.heure || '99'));
      const restant = liste.filter((x) => !x.faitLe);
      const ch = R.charge(restant);
      const ferie = R.nomFerie(d, cal());
      const ratio = cap ? Math.min(1, ch / cap) : 0;
      return `<section class="sjour ${d === t ? 'aujourdhui' : ''} ${d < t ? 'passe' : ''} ${R.jourSem(d) > 5 ? 'weekend' : ''}" aria-label="${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}">
        <h2><span>${fmt(d, { weekday: 'short' }).replace('.', '')}</span><b>${versDate(d).getDate()}</b>${ferie ? `<em title="${esc(ferie)}">Férié</em>` : ''}</h2>
        <div class="charge ${cap && ch > cap ? 'depasse' : ''}" title="${R.dureeTexte(ch) || '0 min'} prévues"><i style="width:${Math.round(ratio * 100)}%"></i></div>
        <p class="charge-texte">${ch ? `${R.dureeTexte(ch)}${cap && ch > cap ? ' · trop chargé' : ''}` : d < t ? '' : 'Libre'}</p>
        <ul class="taches">${liste.map((x) => ligneTache(x, { compacte: true, focusBouton: false })).join('')}</ul>
        ${d >= t ? `<button class="sjour-ajout" data-action="tache-nouvelle" data-date="${d}" aria-label="Ajouter une tâche le ${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}">${ICONES.plus}</button>` : ''}
      </section>`;
    }).join('');
    const sansDate = triees().filter((x) => !x.echeance).length;
    return `
      <div class="vue-tete"><div><h1>Semaine du ${fmt(lundi, { day: 'numeric', month: 'long' })}</h1><p>Les échéances jour par jour, et la charge prévue face à ${R.dureeTexte(cap) || 'ta disponibilité'} par jour (réglable). Les retards s'affichent aujourd'hui.</p></div>
        <div class="actions"><button class="btn petit" data-action="semaine" data-pas="-1" aria-label="Semaine précédente">◀</button><button class="btn petit" data-action="semaine" data-pas="0">Cette semaine</button><button class="btn petit" data-action="semaine" data-pas="1" aria-label="Semaine suivante">▶</button></div></div>
      <div class="semaine">${colonnes}</div>
      ${sansDate ? `<p class="note-bas">${pluriel(sansDate, 'tâche')} sans date : <button class="btn lien" data-action="vue-liste-sansdate">les voir dans la liste</button>.</p>` : ''}`;
  }

  // ---------- Projets ----------
  function carteProjet(p) {
    const t = auj();
    const ts = E.taches.filter((x) => x.projetId === p.id && !x.archiveLe);
    const act = ts.filter((x) => !x.faitLe && !x.inbox);
    const faites = ts.filter((x) => x.faitLe).length;
    const retard = act.filter((x) => x.echeance && x.echeance < t).length;
    const proch = act.filter((x) => x.echeance && x.echeance >= t).sort((a, b) => a.echeance.localeCompare(b.echeance))[0];
    const pct = ts.length ? Math.round((faites / ts.length) * 100) : 0;
    return `<article class="projet" style="--c:${couleur(p.couleur)};--t:${texteSur(p.couleur)}">
      <div class="projet-tete"><div><h2>${esc(p.nom)}</h2><p>${proch ? `Prochaine échéance ${quand(proch.echeance)}` : act.length ? 'Pas d\'échéance à venir' : 'Rien en cours'}</p></div><button data-action="projet-modifier" data-id="${p.id}">Modifier</button></div>
      <div class="matiere-chiffres"><div><b>${act.length}</b><span>en cours</span></div><div><b style="${retard ? 'color:var(--rouge)' : ''}">${retard}</b><span>en retard</span></div><div><b>${faites}</b><span>faites</span></div></div>
      <div class="maitrise" role="img" aria-label="Avancement : ${pct} %"><i style="width:${pct}%"></i></div>
      <ul class="taches projet-liste">${R.trier(act, t).slice(0, 4).map((x) => ligneTache(x, { compacte: true, focusBouton: false })).join('') || '<li class="kvide">Aucune tâche en cours.</li>'}</ul>
      <div class="matiere-pied"><button class="btn petit" data-action="tache-nouvelle" data-projet="${p.id}">${ICONES.plus}Tâche</button>${act.length > 4 ? `<button class="btn petit" data-action="voir-projet" data-id="${p.id}">Voir les ${act.length}</button>` : ''}</div>
    </article>`;
  }

  function vueProjets() {
    const ouverts = E.projets.filter((p) => !p.archive);
    const archives = E.projets.filter((p) => p.archive);
    const groupes = [...E.dossiers.map((d) => [d, ouverts.filter((p) => p.dossierId === d.id)]), [null, ouverts.filter((p) => !p.dossierId || !dossier(p.dossierId))]]
      .filter(([d, l]) => l.length || d);
    return `
      <div class="vue-tete"><div><h1>Projets</h1><p>Rangés en dossiers. Un modèle crée un projet complet avec ses tâches et ses routines.</p></div>
        <div class="actions"><button class="btn" data-action="projet-modele">Depuis un modèle</button><button class="btn primaire" data-action="projet-nouveau">${ICONES.plus}Projet</button></div></div>
      ${ouverts.length || E.dossiers.length ? groupes.map(([d, l]) => `<section class="dossier"><h2 class="titre-section">${d ? esc(d.nom) : 'Sans dossier'} <span>${pluriel(l.length, 'projet')}</span>${d ? `<button class="btn lien" data-action="dossier-modifier" data-id="${d.id}">Renommer</button>` : ''}</h2>
          ${l.length ? `<div class="projets">${l.map(carteProjet).join('')}</div>` : '<p class="note-bas">Dossier vide.</p>'}</section>`).join('')
        : videEtat('Aucun projet', 'Un projet regroupe les tâches d\'un même sujet. Crée-le ici, ou tape #NomDuProjet dans la saisie rapide.', '<button class="btn primaire" data-action="projet-nouveau">Créer un projet</button><button class="btn" data-action="projet-modele">Partir d\'un modèle</button>')}
      ${archives.length ? `<details class="faites"><summary>Projets archivés (${archives.length})</summary>${archives.map((p) => `<div class="ligne-faite" style="--c:${couleur(p.couleur)}"><i></i><span><b>${esc(p.nom)}</b></span><button class="btn petit" data-action="projet-modifier" data-id="${p.id}">Rouvrir</button></div>`).join('')}</details>` : ''}`;
  }

  // ---------- Branchements propres à chaque vue ----------
  function brancherVue() {
    // Saisie rapide en ligne
    $$('#vue form.saisie').forEach((f) => brancherSaisie(f, () => {}));
    const rech = $('#recherche');
    if (rech) {
      rech.addEventListener('input', () => { filtres.q = rech.value; $('#resultats').innerHTML = resultats(); brancherKanban(); });
    }
    $$('#vue [data-filtre]').forEach((el) => el.addEventListener('change', () => {
      filtres[el.dataset.filtre] = el.type === 'checkbox' ? el.checked : el.value;
      rendre();
    }));
    brancherKanban();
  }

  function brancherSaisie(form, apres) {
    const champ = form.querySelector('.saisie-champ');
    const zone = form.querySelector('.puces');
    const maj = () => {
      const a = R.analyserSaisie(champ.value, auj(), { cal: cal() });
      zone.innerHTML = champ.value.trim() ? `${a.titre ? `<span class="puce titre">${esc(a.titre)}</span>` : ''}${puces(a)}` : '';
    };
    champ.addEventListener('input', maj);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const ranger = form.querySelector('[name=ranger]')?.checked;
      const x = ajouterSaisie(champ.value, ranger);
      if (!x) { champ.focus(); return; }
      sauver();
      champ.value = ''; maj();
      apres(x);
      if (form.dataset.contexte === 'boite') { rendre(); $('#saisie-boite')?.focus(); }
      toast(ranger ? `« ${x.titre} » ajoutée${x.echeance ? ` pour ${quand(x.echeance)}` : ''}.` : `« ${x.titre} » dans la boîte de réception.`, { libelle: 'Annuler', faire: () => { E.taches = E.taches.filter((y) => y !== x); sauver(); rendre(); } });
    });
  }

  let glisse = null;
  function brancherKanban() {
    $$('.kcarte').forEach((c) => {
      c.addEventListener('dragstart', (e) => { glisse = c.dataset.tache; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', glisse); c.classList.add('glisse'); });
      c.addEventListener('dragend', () => c.classList.remove('glisse'));
    });
    $$('.colonne').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('survol'); });
      col.addEventListener('dragleave', () => col.classList.remove('survol'));
      col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('survol'); const id = e.dataTransfer.getData('text/plain') || glisse; if (id) deplacer(tache(id), col.dataset.statut); });
    });
  }

  function deplacer(x, versId) {
    if (!x) return;
    const s = E.statuts.find((y) => y.id === versId);
    if (!s) return;
    if (s.fini) { terminer(x); rendre(); return; }
    if (x.faitLe) rouvrir(x); else memoriserAnnulation();
    x.statut = s.id;
    sauver(); rendre();
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, classe = '') {
    const d = modale();
    d.className = `modale ${classe}`;
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!matchMedia('(max-width:720px)').matches || classe.includes('saisie-modale')) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
    else d.querySelector('.modale-tete button')?.focus();
  }

  function modaleSaisie() {
    // Pas de formulaire englobant ici : la saisie est elle-même un formulaire (Entrée = ajouter, la modale reste ouverte).
    const d = modale();
    d.className = 'modale saisie-modale';
    d.innerHTML = `<div class="modale-tete"><h2 id="modale-titre">Saisie rapide</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div>
      <div class="modale-corps">${formSaisie('modale').replace('</form>', '<label class="case"><input type="checkbox" name="ranger"> Ranger directement (sans passer par la boîte)</label></form>')}</div>
      <div class="modale-pied"><button class="btn" type="button" data-action="fermer">Fermer</button></div>`;
    if (!d.open) d.showModal();
    const f = $('#form-saisie-modale');
    brancherSaisie(f, () => { if (vue !== 'boite') rendre(); });
    f.querySelector('.saisie-champ').focus();
  }

  // Champ de criticité en boutons radio.
  const champCriticite = (val) => `<fieldset class="champ seg-champ"><legend>Criticité</legend><div class="seg">${B.criticites.map((c) => `<label><input type="radio" name="criticite" value="${c.id}" ${val === c.id ? 'checked' : ''}><span class="crit-${c.id}">${c.nom}</span></label>`).join('')}</div></fieldset>`;
  const optionsProjet = (val, avecNouveau = true) => `<option value="">Sans projet</option>${E.projets.filter((p) => !p.archive || p.id === val).map((p) => `<option value="${p.id}" ${p.id === val ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}${avecNouveau ? '<option value="+">Nouveau projet…</option>' : ''}`;
  const DUREES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480];
  const champDuree = (val) => `<label class="champ">Durée estimée<select name="duree"><option value="">Non estimée</option>${[...new Set([...DUREES, ...(val ? [Number(val)] : [])])].sort((a, b) => a - b).map((m) => `<option value="${m}" ${Number(val) === m ? 'selected' : ''}>${R.dureeTexte(m)}</option>`).join('')}</select></label>`;
  const champNouveauProjet = '<label class="champ nouveau-projet" hidden>Nom du nouveau projet<input name="projetNom" maxlength="60"></label>';
  function brancherProjetNouveau() {
    const sel = modale().querySelector('select[name=projet]');
    const zone = modale().querySelector('.nouveau-projet');
    sel?.addEventListener('change', () => { zone.hidden = sel.value !== '+'; if (!zone.hidden) zone.querySelector('input').focus(); });
  }
  function lireProjet(f) {
    const v = f.get('projet');
    if (v === '+') { const nom = String(f.get('projetNom') || '').trim(); return nom ? projetParNom(nom, true).id : null; }
    return v || null;
  }

  // Bloc récurrence du formulaire de tâche.
  function champRecurrence(rec, echeance) {
    const r = rec || {};
    const typ = r.type || '';
    const n = r.n || 1;
    const jours = new Set(r.jours || [echeance ? R.jourSem(echeance) : R.jourSem(auj())]);
    const jourMois = r.jour || Number((echeance || auj()).slice(8));
    const sel = (nom, opts, v) => `<select name="${nom}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    return `<fieldset class="champ recurrence"><legend>Répétition</legend>
      ${sel('rec-type', [['', 'Ne se répète pas'], ['jour', 'Tous les … jours'], ['ouvre', 'Chaque jour ouvré'], ['semaine', 'Chaque semaine'], ['mois', 'Chaque mois'], ['annee', 'Chaque année']], typ)}
      <div class="rec-detail" data-pour="jour semaine mois annee"><label class="inline">Tous les <input type="number" name="rec-n" min="1" max="99" value="${n}" inputmode="numeric"> <span data-unite></span></label></div>
      <label class="case rec-detail" data-pour="jour"><input type="checkbox" name="rec-fait" ${r.depuis === 'fait' ? 'checked' : ''}> Compter à partir du jour où c'est fait</label>
      <div class="rec-detail jours-sem" data-pour="semaine">${R.JOURS.map((j, i) => `<label><input type="checkbox" name="rec-jours" value="${i + 1}" ${jours.has(i + 1) ? 'checked' : ''}><span>${j.slice(0, 3)}</span></label>`).join('')}</div>
      <div class="rec-detail" data-pour="mois">${sel('rec-mode', [['date', 'Le même jour du mois'], ['fin', 'Le dernier jour du mois'], ['ouvre', 'Un jour ouvré précis'], ['jourSem', 'Un jour de semaine précis']], r.mode || 'date')}</div>
      <div class="rec-detail" data-pour="mois:date"><label class="inline">Le <input type="number" name="rec-jour" min="1" max="31" value="${jourMois}" inputmode="numeric"> du mois <small>(31 = dernier jour des mois plus courts)</small></label></div>
      <div class="rec-detail inline" data-pour="mois:ouvre mois:jourSem">Le ${sel('rec-rang', [[1, '1er'], [2, '2e'], [3, '3e'], [4, '4e'], [-1, 'dernier']], r.rang || 1)} <span class="rec-detail" data-pour="mois:ouvre">jour ouvré</span><span class="rec-detail" data-pour="mois:jourSem">${sel('rec-jsem', R.JOURS.map((j, i) => [i + 1, j]), r.jourSem || 1)}</span></div>
      <div class="rec-detail" data-pour="mois:date mois:fin annee"><label class="inline">Si ce jour n'est pas ouvré : ${sel('rec-ajuster', [['', 'garder la date'], ['precedent', 'jour ouvré précédent'], ['suivant', 'jour ouvré suivant']], r.ajuster || '')}</label></div>
      <div class="rec-detail" data-pour="jour ouvre semaine mois annee"><label class="inline">Jusqu'au <input type="date" name="rec-fin" value="${r.fin || ''}"> <small>(facultatif)</small></label></div>
      <p class="aide rec-apercu" aria-live="polite"></p>
    </fieldset>`;
  }
  function lireRecurrence(f) {
    const type = f.get('rec-type');
    if (!type) return null;
    const rec = { type, n: Math.max(1, Math.min(99, Number(f.get('rec-n')) || 1)) };
    if (type === 'ouvre') rec.n = 1;
    if (type === 'jour' && f.get('rec-fait')) rec.depuis = 'fait';
    if (type === 'semaine') rec.jours = f.getAll('rec-jours').map(Number);
    if (type === 'mois') {
      rec.mode = f.get('rec-mode');
      if (rec.mode === 'date') rec.jour = Math.max(1, Math.min(31, Number(f.get('rec-jour')) || 1));
      if (rec.mode === 'ouvre' || rec.mode === 'jourSem') rec.rang = Number(f.get('rec-rang'));
      if (rec.mode === 'jourSem') rec.jourSem = Number(f.get('rec-jsem'));
    }
    if (type === 'annee') {
      const d = f.get('echeance') || auj();
      rec.jour = Number(d.slice(8)); rec.mois = Number(d.slice(5, 7));
    }
    if ((type === 'mois' && ['date', 'fin'].includes(rec.mode)) || type === 'annee') rec.ajuster = f.get('rec-ajuster') || null;
    if (f.get('rec-fin')) rec.fin = f.get('rec-fin');
    return rec;
  }
  function brancherRecurrence() {
    const form = modale().querySelector('form');
    const maj = () => {
      const fd = new FormData(form);
      const type = fd.get('rec-type');
      const cle = type === 'mois' ? `mois:${fd.get('rec-mode')}` : type;
      $$('.rec-detail', form).forEach((el) => { el.hidden = !type || !el.dataset.pour.split(' ').some((p) => p === type || p === cle); });
      const unite = form.querySelector('[data-unite]');
      if (unite) unite.textContent = { jour: 'jours', semaine: 'semaines', mois: 'mois', annee: 'ans' }[type] || '';
      const rec = lireRecurrence(fd);
      const ap = form.querySelector('.rec-apercu');
      if (!rec) { ap.hidden = true; return; }
      ap.hidden = false;
      const prem = R.premiereOccurrence(rec, fd.get('echeance') || auj(), cal());
      const sec = prem ? R.occurrenceSuivante(rec, prem, cal()) : null;
      const suite = sec ? R.occurrenceSuivante(rec, sec, cal()) : null;
      ap.innerHTML = `${esc(R.decrireRecurrence(rec))}.${prem && rec.depuis !== 'fait' ? ` Dates : ${[prem, sec, suite].filter(Boolean).map((d) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short', year: d.slice(0, 4) !== auj().slice(0, 4) ? 'numeric' : undefined })).join(', ')}…` : ''}`;
    };
    form.addEventListener('change', maj);
    form.addEventListener('input', (e) => { if (e.target.name?.startsWith('rec-') || e.target.name === 'echeance') maj(); });
    maj();
  }

  function modaleTache(id, defauts = {}) {
    const x = id ? tache(id) : null;
    const v = x || { titre: '', note: '', projetId: defauts.projet || filtres.projet && filtres.projet !== '-' ? defauts.projet || filtres.projet : null, statut: statutDepart().id, type: E.types[0]?.id,
      criticite: 'normale', urgent: null, important: null, echeance: defauts.date || null, heure: null, duree: null, sousTaches: [], recurrence: null, apres: [] };
    const t = auj();
    const autres = E.taches.filter((y) => y.id !== v.id && !y.archiveLe && !y.faitLe && !y.inbox && (!x || !R.creeBoucle(x.id, y.id, E.taches)))
      .sort((a, b) => (a.projetId === v.projetId ? 0 : 1) - (b.projetId === v.projetId ? 0 : 1) || a.titre.localeCompare(b.titre, 'fr'));
    const apres = new Set(v.apres || []);
    const corps = `
      <label class="champ">Titre<input name="titre" required maxlength="200" value="${esc(v.titre)}"></label>
      <div class="grille-2">
        <label class="champ">Projet<select name="projet">${optionsProjet(v.projetId)}</select></label>
        <label class="champ">Statut<select name="statut">${E.statuts.map((s) => `<option value="${s.id}" ${(x?.faitLe ? s.fini : s.id === v.statut) ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
      </div>
      ${champNouveauProjet}
      ${champCriticite(v.criticite || 'normale')}
      <fieldset class="champ"><legend>Triage</legend><div class="rang">
        <label class="case"><input type="checkbox" name="urgent" ${v.urgent ? 'checked' : ''}> Urgent</label>
        <label class="case"><input type="checkbox" name="important" ${v.important ? 'checked' : ''}> Important</label>
      </div></fieldset>
      <div class="grille-3">
        <label class="champ">Échéance<input type="date" name="echeance" value="${v.echeance || ''}"></label>
        <label class="champ">Heure<input type="time" name="heure" value="${v.heure || ''}"></label>
        ${champDuree(v.duree)}
      </div>
      <label class="champ">Type<select name="type">${E.types.map((y) => `<option value="${y.id}" ${y.id === v.type ? 'selected' : ''}>${esc(y.nom)}</option>`).join('')}</select></label>
      ${champRecurrence(v.recurrence, v.echeance)}
      <fieldset class="champ"><legend>Sous-tâches</legend>
        <ul class="sous-taches">${(v.sousTaches || []).map((s) => ligneSousTache(s)).join('')}</ul>
        <button class="btn petit" type="button" data-action="st-ajout">${ICONES.plus}Sous-tâche</button>
      </fieldset>
      <label class="champ">Description<textarea name="note" maxlength="4000" rows="3">${esc(v.note || '')}</textarea></label>
      ${autres.length ? `<details class="champ dependances" ${apres.size ? 'open' : ''}><summary>À faire après… ${apres.size ? `(${apres.size})` : ''}</summary><p class="aide">La tâche reste « bloquée » tant que celles cochées ne sont pas faites.</p><div class="liste-cases">${autres.map((y) => `<label class="case"><input type="checkbox" name="apres" value="${y.id}" ${apres.has(y.id) ? 'checked' : ''}> ${esc(y.titre)}</label>`).join('')}</div></details>` : ''}
      <label class="case"><input type="checkbox" name="focus" ${v.focus === t ? 'checked' : ''}> Au focus aujourd'hui</label>
      ${x ? `<p class="aide">Créée ${quand(x.creeLe || t)}${x.faitLe ? ` · faite ${quand(x.faitLe)}` : ''}${x.serie ? ' · fait partie d\'une série récurrente' : ''}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = x
      ? `<button class="btn primaire" value="ok">Enregistrer</button>${x.faitLe ? '<button class="btn" value="rouvrir">Rouvrir</button>' : '<button class="btn" value="fait">C\'est fait</button>'}<button class="btn danger gauche" value="archiver">Archiver</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(x ? 'Modifier la tâche' : 'Nouvelle tâche', corps, pied, (f, action) => {
      if (x && action === 'archiver') { archiver(x); rendre(); return; }
      if (x && action === 'rouvrir') { rouvrir(x); rendre(); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique le titre de la tâche.';
      const rec = lireRecurrence(f);
      if (rec?.type === 'semaine' && !rec.jours.length) return 'Choisis au moins un jour de la semaine.';
      if (rec?.fin && f.get('echeance') && rec.fin < f.get('echeance')) return 'La fin de la répétition est avant l\'échéance.';
      if (!x) memoriserAnnulation(); else memoriserAnnulation();
      const cible = x || nouvelleTache();
      let echeance = f.get('echeance') || null;
      if (rec && !echeance) echeance = R.premiereOccurrence(rec, t, cal());
      Object.assign(cible, {
        titre: titre.slice(0, 200), projetId: lireProjet(f), criticite: f.get('criticite') || 'normale', type: f.get('type') || null,
        urgent: f.get('urgent') ? true : (x?.urgent == null && !f.get('important') ? null : false), important: f.get('important') ? true : (x?.important == null && !f.get('urgent') ? null : false),
        echeance, heure: f.get('heure') || null, duree: Number(f.get('duree')) || null, note: String(f.get('note') || '').trim(), recurrence: rec,
        apres: f.getAll('apres'), focus: f.get('focus') ? t : (cible.focus === t ? null : cible.focus), inbox: false,
        sousTaches: $$('.sous-taches li', modale()).map((li) => ({ id: li.dataset.id || uid(), titre: li.querySelector('input[type=text]').value.trim(), fait: li.querySelector('input[type=checkbox]').checked })).filter((s) => s.titre),
      });
      const st = E.statuts.find((s) => s.id === f.get('statut'));
      if (st && !st.fini) { if (cible.faitLe) { cible.faitLe = null; } cible.statut = st.id; }
      sauver();
      if ((st?.fini || action === 'fait') && !cible.faitLe) { annulation = null; terminer(cible); rendre(); return; }
      rendre();
      toast(x ? 'Tâche enregistrée.' : `« ${cible.titre} » ajoutée${cible.echeance ? ` pour ${quand(cible.echeance)}` : ''}.`, x ? null : { libelle: 'Annuler', faire: annuler });
    });
    brancherProjetNouveau();
    brancherRecurrence();
  }
  const ligneSousTache = (s) => `<li data-id="${esc(s.id || '')}"><input type="checkbox" ${s.fait ? 'checked' : ''} aria-label="Sous-tâche faite"><input type="text" value="${esc(s.titre)}" maxlength="200" aria-label="Sous-tâche" placeholder="Sous-tâche"><button type="button" data-action="st-suppr" aria-label="Retirer la sous-tâche">×</button></li>`;

  // Triage d'un élément de la boîte de réception. Les éléments « plus tard » sont sautés jusqu'à la fin du tour.
  const triagePasses = new Set();
  function modaleTriage(id) {
    const liste = boite();
    if (!liste.length) { if (modale().open) modale().close(); toast('Boîte de réception vide : tout est trié.'); rendre(); return; }
    const x = (id && tache(id)?.inbox && !tache(id).archiveLe && !tache(id).faitLe) ? tache(id) : liste[0];
    const rang = liste.indexOf(x) + 1;
    const t = auj();
    const urgentDefaut = x.urgent ?? R.urgenceSuggeree(x, t);
    const importantDefaut = x.important ?? ['haute', 'critique'].includes(x.criticite);
    const qDefaut = R.quadrant({ urgent: urgentDefaut, important: importantDefaut });
    const corps = `
      <p class="surtitre" style="margin:0">Élément ${rang} sur ${liste.length} · saisi ${quand(x.creeLe || t)}</p>
      <label class="champ">Tâche<input name="titre" required maxlength="200" value="${esc(x.titre)}"></label>
      <fieldset class="champ"><legend>Urgent ? Important ?</legend>
        <div class="eisenhower">${[['faire', true, true], ['planifier', false, true], ['expedier', true, false], ['abandonner', false, false]].map(([k, u, i]) => `<label class="q-${k}"><input type="radio" name="quadrant" value="${k}" ${qDefaut === k ? 'checked' : ''}><span><b>${R.QUADRANTS[k].nom}</b><small>${u ? 'Urgent' : 'Pas urgent'} · ${i ? 'important' : 'peu important'}</small></span></label>`).join('')}</div>
        ${R.urgenceSuggeree(x, t) && x.urgent == null ? '<small>Échéance dans moins de 3 jours : « urgent » est présélectionné.</small>' : ''}
      </fieldset>
      <div class="grille-2">
        <label class="champ">Projet<select name="projet">${optionsProjet(x.projetId)}</select></label>
        ${champDuree(x.duree)}
      </div>
      ${champNouveauProjet}
      <div class="grille-2">
        <label class="champ">Échéance<input type="date" name="echeance" value="${x.echeance || ''}"></label>
        <label class="champ">Heure<input type="time" name="heure" value="${x.heure || ''}"></label>
      </div>
      ${champCriticite(x.criticite || 'normale')}
      <label class="case"><input type="checkbox" name="focus" ${x.focus === t ? 'checked' : ''}> Au focus aujourd'hui</label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="classer">Classer</button><button class="btn" value="fait">Fait (moins de 2 min)</button><button class="btn" value="passer">Plus tard</button><button class="btn danger gauche" value="archiver">Archiver</button>`;
    ouvrirModale('Trier la boîte', corps, pied, (f, action) => {
      const suivant = () => {
        if (action === 'passer') triagePasses.add(x.id);
        const n = boite().find((y) => !triagePasses.has(y.id) && y.id !== x.id) || (action !== 'passer' ? boite().find((y) => !triagePasses.has(y.id)) : null);
        if (n) { modaleTriage(n.id); return ''; }
        rendre();
        toast(boite().length ? `Triage terminé. ${pluriel(boite().length, 'élément reste', 'éléments restent')} dans la boîte.` : 'Boîte de réception vide : tout est trié.');
        return undefined;
      };
      if (action === 'passer') return suivant();
      memoriserAnnulation();
      x.titre = String(f.get('titre') || x.titre).trim() || x.titre;
      if (action === 'archiver') { x.archiveLe = t; x.inbox = false; sauver(); rendre(); return suivant(); }
      if (action === 'fait') { x.inbox = false; annulation = null; terminer(x, { silencieux: true }); rendre(); return suivant(); }
      const q = f.get('quadrant');
      Object.assign(x, {
        urgent: q ? q === 'faire' || q === 'expedier' : null, important: q ? q === 'faire' || q === 'planifier' : null,
        projetId: lireProjet(f), duree: Number(f.get('duree')) || null, echeance: f.get('echeance') || null, heure: f.get('heure') || null,
        criticite: f.get('criticite') || 'normale', focus: f.get('focus') ? t : x.focus, inbox: false,
      });
      sauver(); rendre();
      return suivant();
    });
    brancherProjetNouveau();
  }

  // ---------- Rituel du matin ----------
  let rituel = null;
  function rituelMatin(etape = 1) {
    const t = auj();
    if (etape === 1 || !rituel) rituel = { choix: null };
    const retards = R.trier(triees().filter((x) => x.echeance && x.echeance < t), t);
    if (etape === 1 && !retards.length) etape = 2;
    const nbBoite = boite().length;
    if (etape === 1) {
      const corps = `<p class="etapes-rituel"><b>1</b> Retards <span>2</span> Focus</p>
        <p>${pluriel(retards.length, 'tâche')} en retard. Pour chacune : aujourd'hui, plus tard, ou on l'abandonne.</p>
        <ul class="taches rituel-liste">${retards.map((x) => `<li class="tache compacte" style="--c:${couleur(projet(x.projetId)?.couleur || 'encre')}"><span class="coche-vide"></span><div class="tache-corps"><b>${esc(x.titre)}</b><span class="tache-meta"><span class="retard">prévue ${quand(x.echeance)}</span>${x.duree ? `<span>${R.dureeTexte(x.duree)}</span>` : ''}</span></div>
          <div class="rang"><button type="button" class="btn petit" data-action="retard" data-id="${x.id}" data-quoi="auj">Aujourd'hui</button><button type="button" class="btn petit" data-action="retard" data-id="${x.id}" data-quoi="demain">Demain</button><button type="button" class="btn petit" data-action="retard" data-id="${x.id}" data-quoi="sansdate">Sans date</button><button type="button" class="btn petit danger" data-action="retard" data-id="${x.id}" data-quoi="archiver">Archiver</button></div></li>`).join('')}</ul>`;
      ouvrirModale('Rituel du matin', corps, '<button class="btn primaire" value="suivant">Choisir mon focus</button>', () => { rituelMatin(2); return ''; }, 'rituel');
      return;
    }
    const cands = R.suggestionsFocus(E.taches, t, 30);
    const deja = triees().filter((x) => x.focus === t && !cands.includes(x));
    const autres = R.trier(triees().filter((x) => !cands.includes(x) && !deja.includes(x) && !R.estBloquee(x, E.taches)), t).slice(0, 12);
    const max = E.reglages.focusMax;
    if (!rituel.choix) {
      const actuels = triees().filter((x) => x.focus === t).map((x) => x.id);
      rituel.choix = new Set(actuels.length ? actuels : cands.slice(0, Math.min(max, 3)).map((x) => x.id));
    }
    const ligne = (x) => `<label class="choix-focus" style="--c:${couleur(projet(x.projetId)?.couleur || 'encre')}"><input type="checkbox" name="focus" value="${x.id}" ${rituel.choix.has(x.id) ? 'checked' : ''}><span><b>${esc(x.titre)}</b><small>${[projet(x.projetId)?.nom, x.echeance ? (x.echeance < t ? `en retard (${quand(x.echeance)})` : quand(x.echeance)) : '', x.duree ? R.dureeTexte(x.duree) : '', x.criticite !== 'normale' ? x.criticite : '', R.quadrant(x) ? R.QUADRANTS[R.quadrant(x)].nom.toLowerCase() : ''].filter(Boolean).map(esc).join(' · ')}</small></span></label>`;
    const corps = `<p class="etapes-rituel"><span>1</span> Retards <b>2</b> Focus</p>
      <p>Garde ${max === 3 ? '3' : `3 à ${max}`} tâches : celles qui feront de la journée une bonne journée. Les suggestions viennent des échéances, de la criticité et du triage.</p>
      ${nbBoite ? `<p class="aide">${pluriel(nbBoite, 'élément')} dans la boîte de réception. <button type="button" class="btn lien" data-action="trier">Trier d'abord</button></p>` : ''}
      <div class="focus-total" aria-live="polite"></div>
      ${cands.length + deja.length ? `<h3 class="sous-titre">Suggestions</h3><div class="liste-focus">${[...deja, ...cands].map(ligne).join('')}</div>` : '<p>Aucune tâche pressante. Choisis dans la liste ci-dessous.</p>'}
      ${autres.length ? `<details class="faites"><summary>Autres tâches (${autres.length})</summary><div class="liste-focus">${autres.map(ligne).join('')}</div></details>` : ''}`;
    ouvrirModale('Rituel du matin', corps, '<button class="btn primaire" value="ok">Valider mon focus</button><button class="btn" value="retour">Retour</button>', (f, action) => {
      if (action === 'retour') { rituelMatin(1); return ''; }
      const ids = new Set(f.getAll('focus'));
      memoriserAnnulation();
      for (const x of E.taches) {
        if (ids.has(x.id)) x.focus = t;
        else if (x.focus === t && !x.faitLe) x.focus = null;
      }
      journalDu(t).matin = true;
      sauver(); vue = 'aujourdhui'; history.replaceState(null, '', '#aujourdhui'); rendre();
      toast(`Focus du jour : ${pluriel(ids.size, 'tâche')}. Bonne journée.`, { libelle: 'Annuler', faire: annuler });
    }, 'rituel');
    const total = () => {
      const ids = $$('input[name=focus]:checked', modale()).map((i) => i.value);
      rituel.choix = new Set(ids);
      const ch = R.charge(ids.map(tache).filter(Boolean));
      const cap = E.reglages.capacite;
      const el = $('.focus-total', modale());
      el.className = `focus-total ${ids.length > max || (cap && ch > cap) ? 'trop' : ''}`;
      el.innerHTML = `<b>${ids.length}</b> / ${max} tâches · <b>${R.dureeTexte(ch) || '0 min'}</b>${cap ? ` sur ${R.dureeTexte(cap)} disponibles` : ''}${ids.length > max ? ' · c\'est beaucoup pour un focus' : cap && ch > cap ? ' · plus que ton temps disponible' : ''}`;
    };
    modale().querySelector('form').addEventListener('change', total);
    total();
  }

  function traiterRetard(id, quoi) {
    const x = tache(id);
    if (!x) return;
    const t = auj();
    if (quoi === 'archiver') { x.archiveLe = t; x.focus = null; }
    else x.echeance = quoi === 'auj' ? t : quoi === 'demain' ? ajout(t, 1) : null;
    if (quoi === 'auj') x.focus = t;
    sauver(); rendre();
    rituelMatin(1);
  }

  // ---------- Clôture du soir ----------
  function clotureSoir() {
    const t = auj();
    const b = R.bilanJour(E.taches, t);
    const terminees = E.taches.filter((x) => x.faitLe && !x.archiveLe);
    const restantes = R.trier(triees().filter((x) => (x.focus === t) || (x.echeance && x.echeance <= t)), t);
    const j = E.journal[t] || {};
    const corps = `
      <div class="bilan-soir">
        <div><b>${b.faites}</b><span>${b.faites > 1 ? 'tâches faites' : 'tâche faite'}</span></div>
        <div><b>${b.focusFaits}/${b.focusTotal}</b><span>du focus</span></div>
        <div><b>${R.dureeTexte(b.minutes) || '0 min'}</b><span>de travail estimé</span></div>
      </div>
      ${restantes.length ? `<h3 class="sous-titre">Reste à faire (${restantes.length})</h3><p>Choisis pour chacune : demain, plus tard ou archive. Ce que tu ne touches pas reste tel quel.</p>
        <ul class="taches rituel-liste">${restantes.map((x) => `<li class="tache compacte" style="--c:${couleur(projet(x.projetId)?.couleur || 'encre')}"><span class="coche-vide"></span><div class="tache-corps"><b>${esc(x.titre)}</b><span class="tache-meta">${x.echeance ? `<span class="${x.echeance < t ? 'retard' : ''}">${quand(x.echeance)}</span>` : ''}${x.focus === t ? '<span>focus</span>' : ''}</span></div>
          <div class="rang"><button type="button" class="btn petit" data-action="reporter" data-id="${x.id}" data-quoi="demain">Demain</button><button type="button" class="btn petit" data-action="reporter" data-id="${x.id}" data-quoi="semaine">Lundi</button><button type="button" class="btn petit" data-action="reporter" data-id="${x.id}" data-quoi="sansdate">Sans date</button><button type="button" class="btn petit danger" data-action="reporter" data-id="${x.id}" data-quoi="archiver">Archiver</button></div></li>`).join('')}</ul>`
        : '<p class="aide">Rien ne reste en suspens pour aujourd\'hui.</p>'}
      ${terminees.length ? `<label class="case"><input type="checkbox" name="archiver" checked> Archiver les ${pluriel(terminees.length, 'tâche terminée', 'tâches terminées')} (restaurables)</label>` : ''}
      <label class="champ">Une note sur la journée <small>Facultatif : ce qui a marché, ce qui a bloqué.</small><textarea name="note" rows="2" maxlength="1000">${esc(j.note || '')}</textarea></label>`;
    ouvrirModale('Clôture du soir', corps, '<button class="btn primaire" value="ok">Clore la journée</button><button class="btn" value="annuler">Plus tard</button>', (f) => {
      memoriserAnnulation();
      if (f.get('archiver')) for (const x of E.taches) if (x.faitLe && !x.archiveLe) x.archiveLe = t;
      const jj = journalDu(t);
      jj.soir = { faites: b.faites, focus: `${b.focusFaits}/${b.focusTotal}`, minutes: b.minutes };
      jj.note = String(f.get('note') || '').trim();
      sauver(); rendre();
      toast('Journée close. À demain.', { libelle: 'Annuler', faire: annuler });
    }, 'rituel');
  }
  function reporter(id, quoi) {
    const x = tache(id);
    if (!x) return;
    const t = auj();
    if (quoi === 'archiver') x.archiveLe = t;
    else x.echeance = quoi === 'demain' ? ajout(t, 1) : quoi === 'semaine' ? ajout(R.lundiDe(t), 7) : null;
    if (x.focus === t) x.focus = null;
    sauver(); rendre();
    clotureSoir();
  }

  // ---------- Projets : modales ----------
  function modaleProjet(id) {
    const p = id ? projet(id) : null;
    const utilisees = new Set(E.projets.map((x) => x.couleur));
    const defaut = p?.couleur || (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[E.projets.length % B.couleurs.length]).id;
    const nb = p ? E.taches.filter((x) => x.projetId === p.id && !x.archiveLe).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(p?.nom || '')}"></label>
      <label class="champ">Dossier<select name="dossier"><option value="">Sans dossier</option>${E.dossiers.map((d) => `<option value="${d.id}" ${p?.dossierId === d.id ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}<option value="+">Nouveau dossier…</option></select></label>
      <label class="champ nouveau-dossier" hidden>Nom du dossier<input name="dossierNom" maxlength="60"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === defaut ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      ${p ? `<label class="case"><input type="checkbox" name="archive" ${p.archive ? 'checked' : ''}> Projet archivé (masqué, tâches conservées)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier le projet' : 'Nouveau projet', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer le projet « ${p.nom} » ?${nb ? ` Ses ${pluriel(nb, 'tâche')} restent, sans projet.` : ''}`)) return '';
        E.projets = E.projets.filter((x) => x.id !== p.id);
        E.taches.forEach((x) => { if (x.projetId === p.id) x.projetId = null; });
        sauver(); rendre(); toast(`Projet « ${p.nom} » supprimé.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du projet.';
      let dossierId = f.get('dossier') || null;
      if (dossierId === '+') {
        const dn = String(f.get('dossierNom') || '').trim();
        if (!dn) return 'Indique le nom du nouveau dossier.';
        const d = { id: uid(), nom: dn }; E.dossiers.push(d); dossierId = d.id;
      }
      if (p) Object.assign(p, { nom, couleur: f.get('couleur'), dossierId, archive: !!f.get('archive') });
      else E.projets.push({ id: uid(), nom, couleur: f.get('couleur'), dossierId, archive: false });
      sauver(); rendre(); toast(p ? 'Projet enregistré.' : `Projet « ${nom} » créé.`);
    });
    const sel = modale().querySelector('select[name=dossier]');
    sel.addEventListener('change', () => { const z = modale().querySelector('.nouveau-dossier'); z.hidden = sel.value !== '+'; if (!z.hidden) z.querySelector('input').focus(); });
  }

  function modaleDossier(id) {
    const d = dossier(id);
    if (!d) return;
    ouvrirModale('Dossier', `<label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(d.nom)}"></label><p class="aide">Supprimer le dossier garde ses projets, sans dossier.</p><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (f, action) => {
        if (action === 'supprimer') { E.dossiers = E.dossiers.filter((x) => x !== d); E.projets.forEach((p) => { if (p.dossierId === d.id) p.dossierId = null; }); sauver(); rendre(); return; }
        const nom = String(f.get('nom') || '').trim();
        if (!nom) return 'Indique le nom du dossier.';
        d.nom = nom; sauver(); rendre();
      });
  }

  function modaleModele() {
    const corps = `
      <p>Chaque modèle crée un projet et ses tâches. Les démarches dont la date change chaque année restent sans date : vérifie-la sur le site officiel concerné, puis renseigne-la.</p>
      <div class="choix-modeles un">${B.modeles.map((m, i) => `<label class="modele-choix" style="--c:${couleur(m.couleur)}"><input type="radio" name="modele" value="${m.id}" ${i === 0 ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.detail)} ${pluriel(m.taches.length, 'tâche')}${m.taches.some((x) => x.rec) ? ', dont des routines' : ''}.</small></span></label>`).join('')}</div>
      <label class="champ">Date de départ <small>Sert aux tâches datées du modèle (ex. : jour de la rentrée, début du semestre).</small><input type="date" name="depart" value="${auj()}" required></label>
      <label class="champ">Nom du projet <small>Facultatif : le nom du modèle sinon.</small><input name="nom" maxlength="60"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Projet depuis un modèle', corps, '<button class="btn primaire" value="ok">Créer le projet</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const m = B.modeles.find((x) => x.id === f.get('modele'));
      if (!m) return 'Choisis un modèle.';
      const depart = f.get('depart') || auj();
      memoriserAnnulation();
      const p = creerDepuisModele(m, depart, String(f.get('nom') || '').trim() || m.nom);
      sauver(); changerVue('projets');
      toast(`Projet « ${p.nom} » créé avec ${pluriel(m.taches.length, 'tâche')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const an = Number(auj().slice(0, 4));
    const prochains = [...R.feries(an, !!r.alsace).entries(), ...R.feries(an + 1, !!r.alsace).entries()].filter(([d]) => d >= auj()).slice(0, 3);
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <div class="grille-2">
        <label class="champ">Tâches au focus (maximum)<input type="number" name="focusMax" min="1" max="10" value="${r.focusMax}"></label>
        <label class="champ">Temps disponible par jour (heures)<input type="number" name="capacite" min="0" max="16" step="0.5" value="${r.capacite / 60}"></label>
      </div>
      <div class="groupe"><h3>Statuts et types</h3>
        <label class="champ">Jeu de départ<select name="jeu">${B.jeux.map((j) => `<option value="${j.id}" ${E.jeu === j.id ? 'selected' : ''}>${esc(j.nom)} : ${esc(j.statuts.map((s) => s.nom).join(', '))}</option>`).join('')}</select><small>Changer de jeu remplace statuts et types ; les tâches non faites reprennent le premier statut.</small></label>
        <label class="champ">Statuts <small>Un par ligne. Le dernier marque une tâche terminée.</small><textarea name="statuts" rows="4">${esc(E.statuts.map((s) => s.nom).join('\n'))}</textarea></label>
        <label class="champ">Types de tâche <small>Un par ligne.</small><textarea name="types" rows="4">${esc(E.types.map((y) => y.nom).join('\n'))}</textarea></label>
      </div>
      <div class="groupe"><h3>Jours ouvrés</h3>
        <p class="aide">Du lundi au vendredi. Les répétitions « jour ouvré » sautent aussi les jours fériés si l'option est cochée.</p>
        <label class="case"><input type="checkbox" name="feries" ${r.feries !== false ? 'checked' : ''}> Tenir compte des jours fériés (France)</label>
        <label class="case"><input type="checkbox" name="alsace" ${r.alsace ? 'checked' : ''}> Alsace-Moselle (vendredi saint et 26 décembre en plus)</label>
        <p class="source">Fêtes légales du Code du travail (art. L3133-1), liste de service-public.gouv.fr (fiche « Jours fériés et ponts dans le secteur privé », vérifiée le 12 novembre 2026). Les dates mobiles (Pâques, Ascension, Pentecôte) sont calculées. Non gérés : jours fériés propres aux départements et régions d'outre-mer. Prochains : ${prochains.map(([d, nom]) => `${esc(nom)} ${fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })}`).join(', ')}.</p>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le gestionnaire de tâches à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const focusMax = Number(f.get('focusMax'));
      if (!Number.isInteger(focusMax) || focusMax < 1 || focusMax > 10) return 'Focus : entre 1 et 10 tâches.';
      const capH = Number(String(f.get('capacite')).replace(',', '.'));
      if (!Number.isFinite(capH) || capH < 0 || capH > 16) return 'Temps disponible : entre 0 et 16 heures.';
      const lignes = (k) => String(f.get(k) || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12);
      let statuts = lignes('statuts');
      if (statuts.length < 2) return 'Il faut au moins deux statuts : un en cours, un terminé.';
      const types = lignes('types');
      if (!types.length) return 'Indique au moins un type de tâche.';
      memoriserAnnulation();
      E.prenom = String(f.get('prenom') || '').trim();
      Object.assign(E.reglages, { focusMax, capacite: Math.round(capH * 60), feries: !!f.get('feries'), alsace: !!f.get('alsace') });
      const nouveauJeu = f.get('jeu');
      if (nouveauJeu !== E.jeu) {
        const j = jeu(nouveauJeu);
        E.jeu = j.id; E.statuts = structuredClone(j.statuts); E.types = typesDe(j);
      } else {
        // Renommage, ajout ou retrait : on garde l'identifiant des statuts dont le nom ne change pas, ou à la même place.
        const anciens = E.statuts;
        E.statuts = statuts.map((nom, i) => {
          const fini = i === statuts.length - 1;
          const meme = anciens.find((s) => s.nom === nom) || (fini ? anciens.find((s) => s.fini) : anciens[i] && !anciens[i].fini ? anciens[i] : null);
          return { id: meme?.id || uid(), nom, couleur: meme?.couleur || (fini ? 'bleu' : B.couleurs[i % B.couleurs.length].id), ...(fini ? { fini: true } : {}) };
        });
        const anciensTypes = E.types;
        E.types = types.map((nom, i) => ({ id: anciensTypes.find((y) => y.nom === nom)?.id || anciensTypes[i]?.id && !types.includes(anciensTypes[i].nom) && anciensTypes[i].id || uid(), nom }));
      }
      R.appliquerStatuts(E.taches, E.statuts);
      const typesIds = new Set(E.types.map((y) => y.id));
      E.taches.forEach((x) => { if (x.type && !typesIds.has(x.type)) x.type = E.types[0].id; });
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.taches) || !Array.isArray(d.projets)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.taches.length, 'tâche')}, ${pluriel(d.projets.length, 'projet')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du gestionnaire de tâches.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `taches-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
      <p>Enregistre le gestionnaire de tâches sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  function cocher(id, bouton) {
    const x = tache(id);
    if (!x) return;
    if (x.faitLe) { rouvrir(x); rendre(); toast(`« ${x.titre} » rouverte.`, { libelle: 'Annuler', faire: annuler }); return; }
    const li = bouton.closest('.tache');
    const fin = () => { terminer(x); rendre(); };
    if (li && !matchMedia('(prefers-reduced-motion: reduce)').matches) { li.classList.add('sortie'); bouton.setAttribute('aria-pressed', 'true'); setTimeout(fin, 220); } else fin();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-jeu': accueil.jeu = id; ecranAccueil(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-modele': {
        if (el.checked) accueil.modeles.add(el.value); else accueil.modeles.delete(el.value);
        const b = $('[data-action="accueil-fin"]');
        b.textContent = `Commencer${accueil.modeles.size ? ` (${pluriel(accueil.modeles.size, 'projet')})` : ''}`;
        break;
      }
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'mode': mode = el.dataset.mode; rendre(); break;
      case 'filtres-raz': Object.assign(filtres, { q: '', projet: '', criticite: '', quadrant: '', type: '', faites: false }); rendre(); break;
      case 'vue-liste-sansdate': mode = 'liste'; changerVue('taches'); $('.titre-section:last-of-type')?.scrollIntoView(); break;
      case 'voir-projet': Object.assign(filtres, { projet: id }); mode = 'liste'; changerVue('taches'); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'saisie-rapide': modaleSaisie(); break;
      case 'trier': if (!modale().open || !modale().querySelector('.eisenhower')) triagePasses.clear(); modaleTriage(id); break;
      case 'cocher': cocher(id, el); break;
      case 'focus': basculerFocus(tache(id)); break;
      case 'tache-nouvelle': modaleTache(null, { date: el.dataset.date, projet: el.dataset.projet }); break;
      case 'tache-modifier': modaleTache(id); break;
      case 'deplacer': deplacer(tache(id), el.dataset.vers); break;
      case 'restaurer': { const x = tache(id); memoriserAnnulation(); x.archiveLe = null; sauver(); rendre(); toast(`« ${x.titre} » restaurée.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'supprimer-def': {
        const x = tache(id);
        if (!confirm(`Supprimer définitivement « ${x.titre} » ?`)) break;
        memoriserAnnulation();
        E.taches = E.taches.filter((y) => y.id !== id);
        E.taches.forEach((y) => { if (y.apres?.includes(id)) y.apres = y.apres.filter((a) => a !== id); });
        sauver(); rendre(); toast('Tâche supprimée.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'semaine': decalageSemaine = el.dataset.pas === '0' ? 0 : decalageSemaine + Number(el.dataset.pas); rendre(); break;
      case 'projet-nouveau': modaleProjet(); break;
      case 'projet-modifier': modaleProjet(id); break;
      case 'projet-modele': modaleModele(); break;
      case 'dossier-modifier': modaleDossier(id); break;
      case 'rituel-matin': rituelMatin(1); break;
      case 'rituel-soir': clotureSoir(); break;
      case 'retard': traiterRetard(id, el.dataset.quoi); break;
      case 'reporter': reporter(id, el.dataset.quoi); break;
      case 'st-ajout': { const ul = $('.sous-taches', modale()); ul.insertAdjacentHTML('beforeend', ligneSousTache({ titre: '', fait: false })); ul.lastElementChild.querySelector('input[type=text]').focus(); break; }
      case 'st-suppr': el.closest('li').remove(); break;
      default: break;
    }
  });

  // Entrée dans une sous-tâche : nouvelle ligne plutôt que validation du formulaire.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('.sous-taches input[type=text]')) {
      e.preventDefault();
      $('[data-action="st-ajout"]', modale())?.click();
    }
    // Touche N : saisie rapide (hors champ de saisie)
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && E && document.body.classList.contains('app') && !modale().open && !e.target.matches?.('input,textarea,select,[contenteditable]')) {
      e.preventDefault();
      modaleSaisie();
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (vue === 'aujourdhui' && !modale().open) rendre(); // changement de jour
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
      const { statut: st, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
      if (st === 401 || st === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
      if (st !== 200) throw new Error();
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
  window.__taches = { etat: () => E, regles: R };
  init();
})();
