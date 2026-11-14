// Préparateur d'appel découverte QME : fiche contexte, questions par phase, plan minuté, mode « en appel »,
// signaux et objections, prochaine étape datée, score de qualification, résumé imprimable et compte rendu.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi automatique, aucun lien externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.APD;
  const API = '/api/templates';
  const PRODUIT = 'APD';
  const CLE_CODE = 'qme-apd-code';
  const CLE_CACHE = 'qme-apd-cache';
  const CLE_DEMO = 'qme-apd-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-apd-ecran-accueil';

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
  const { ajout, versDate, dateLongue, duree } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const moisCourt = (s) => versDate(s).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const phase = (id) => B.phases.find((p) => p.id === id) || B.phases[1];
  const signal = (id) => B.signaux.find((s) => s.id === id);
  const nomCanal = (id) => (B.canaux.find((c) => c.id === id) || B.canaux[0]).nom;
  const nomTaille = (id) => (B.tailles.find((t) => t.id === id) || B.tailles[0]).nom;
  const nomCatObj = (id) => (B.categoriesObjections.find((c) => c.id === id) || { nom: id }).nom;
  const BANQUE = B.phases.flatMap((p) => B.questions[p.id].map((q) => ({ ...q, phase: p.id })));
  const deBanque = (ref) => BANQUE.find((q) => q.id === ref);
  const objectionBase = (ref) => B.objections.find((o) => o.id === ref);
  const LIB_ETAT = { 'a-preparer': 'À préparer', pret: 'Prêt', 'a-cloturer': 'À clôturer', fait: 'Fait', annule: 'Annulé' };
  const COUL_ETAT = { 'a-preparer': 'jaune', pret: 'ciel', 'a-cloturer': 'rose', fait: 'sable', annule: 'sable' };
  const COUL_QUALIF = { qualifie: 'bleu', 'a-creuser': 'jaune', froid: 'sable', 'hors-cible': 'rose' };
  const LIB_NIVEAU = { inconnu: 'Inconnu', non: 'Non', partiel: 'Partiel', oui: 'Oui' };
  const LIB_MANQUE = { objectif: 'objectif', fonction: 'fonction de l\'interlocuteur', questions: 'au moins 3 questions' };
  const LIB_HYP = { 'a-verifier': 'À vérifier', confirmee: 'Confirmée', infirmee: 'Infirmée' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'appels';
  let courantId = null;
  const filtre = { q: '', phaseBanque: 'ouverture', ongletBanque: 'questions', qBanque: '' };
  let annulation = null;

  const etatVide = () => R.etatVide();
  const normaliser = (d) => R.normaliser(d, auj());
  const appel = (id) => E.appels.find((a) => a.id === id);
  const courant = () => (courantId ? appel(courantId) : null);
  const titreAppel = (a) => a.organisation;

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    if (courantId && !appel(courantId)) courantId = null;
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

  async function appelApi(chemin, options = {}) {
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
      const { statut, corps } = await appelApi('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié tes appels entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
      const { statut, corps } = await appelApi('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open && !saisieEnCours()) rendre();
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
  // Code interne (APD-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    const { statut, corps } = await appelApi('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; courantId = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Activité fictive d'une consultante : 12 appels à des dates relatives à aujourd'hui, tous les états
  // représentés (prêt aujourd'hui, à préparer, trop de questions pour la durée, 15 et 90 minutes,
  // passé à clôturer, qualifié, à creuser avec étape en retard, froid, hors cible, étape faite, annulé).
  // Organisations décrites par leur activité, jamais par un nom réel.
  function donneesDemo() {
    const e = etatVide();
    e.prenom = 'Camille';
    const t = auj();
    const Q = (ref, reponse) => { const b = deBanque(ref); return { id: uid(), ref, texte: b.texte, phase: b.phase, posee: reponse !== undefined, reponse: reponse || '' }; };
    const P = (ph, texte, reponse) => ({ id: uid(), ref: null, texte, phase: ph, posee: reponse !== undefined, reponse: reponse || '' });
    const S = (besoin, budget, decideur, echeance, notes = {}) => Object.fromEntries(Object.entries({ besoin, budget, decideur, echeance }).map(([k, niveau]) => [k, { niveau, note: notes[k] || '' }]));
    const H = (texte, resultat = 'a-verifier') => ({ id: uid(), texte, resultat });
    const O = (ref, note = '') => ({ id: uid(), ref, texte: objectionBase(ref).texte, note });
    const ajouter = (x) => e.appels.push(R.normaliserAppel({ id: uid(), ...x }, t));
    const essentielles = (phases) => BANQUE.filter((q) => q.essentielle && phases.includes(q.phase)).map((q) => Q(q.id));

    ajouter({
      organisation: 'Fabricant de pièces plastiques', secteur: 'Industrie', taille: 'me', fonction: 'Direction des opérations', prenom: 'Claire', canal: 'visio', date: t, heure: '14:30', duree: 45,
      objectif: 'Comprendre pourquoi les changements de série prennent autant de temps, et qui pilote le sujet.',
      hypotheses: [H('Les changements de série sont suivis sur un tableur partagé.'), H('La direction générale a fixé un objectif de productivité pour l\'an prochain.'), H('Une autre solution a déjà été essayée sans succès.')],
      questions: [Q('ou-01'), Q('ou-04'), Q('si-01'), Q('si-02'), Q('si-03'), P('situation', 'Combien de changements de série faites-vous par semaine ?'), Q('pb-01'), Q('pb-02'), Q('pb-08'), Q('im-01'), Q('im-03'), Q('de-01'), Q('de-04'), Q('dl-01'), Q('co-01'), Q('co-04'), Q('co-05')],
    });
    ajouter({ organisation: 'Réseau de crèches associatives', secteur: 'Associatif', taille: 'asso', fonction: 'Direction administrative et financière', canal: 'telephone', date: ajout(t, 1), heure: '10:00', duree: 30 });
    ajouter({
      organisation: 'Imprimerie numérique', secteur: 'Industrie', taille: 'tpe', fonction: 'Dirigeant ou dirigeante', canal: 'telephone', date: ajout(t, 2), heure: '11:00', duree: 15,
      objectif: 'Vérifier en un quart d\'heure s\'il y a un vrai sujet sur la gestion des devis.',
      questions: [Q('ou-01'), Q('pb-01'), Q('im-02'), Q('co-04')],
    });
    ajouter({
      organisation: 'Cabinet d\'expertise comptable', secteur: 'Services aux entreprises', taille: 'pe', fonction: 'Associé ou associée', canal: 'visio', date: ajout(t, 5), heure: '09:30', duree: 20,
      objectif: 'Comprendre comment le cabinet collecte les pièces de ses clients chaque mois.',
      hypotheses: [H('La collecte se fait encore par e-mail et par courrier.')],
      questions: [Q('ou-01'), Q('ou-03'), Q('si-01'), Q('si-03'), Q('si-06'), Q('pb-01'), Q('pb-02'), Q('im-02'), Q('de-01'), Q('de-04'), Q('dl-01'), Q('co-04')],
    });
    ajouter({
      organisation: 'Groupement intercommunal pour la collecte et la valorisation des déchets ménagers du territoire', secteur: 'Collectivité ou administration', taille: 'public', fonction: 'Directeur ou directrice des services', canal: 'sur-place', date: ajout(t, 12), heure: '14:00', duree: 90,
      objectif: 'Cartographier le suivi des tournées et des réclamations, identifier les services concernés et le calendrier budgétaire.',
      hypotheses: [H('Le budget de l\'an prochain est voté en décembre.'), H('Les réclamations des usagers arrivent par trois canaux différents.')],
      questions: essentielles(B.phases.map((p) => p.id)),
    });
    ajouter({
      organisation: 'Plateforme logistique régionale', secteur: 'Transport et logistique', taille: 'eti', fonction: 'Direction des opérations', prenom: 'Malik', canal: 'visio', date: ajout(t, -1), heure: '16:00', duree: 60,
      objectif: 'Comprendre la gestion des créneaux de livraison et le rôle de chaque équipe.',
      hypotheses: [H('Les créneaux sont réservés par téléphone.', 'confirmee'), H('Le site a plus de 50 quais.', 'infirmee')],
      questions: [Q('ou-01', 'Oui, une heure.'), Q('ou-04', 'Repartir avec deux ou trois pistes concrètes.'), Q('si-01', 'Les transporteurs appellent l\'accueil, qui note sur un planning papier.'), Q('si-02', 'Accueil, chefs de quai, service client.'), Q('si-03', 'Un planning papier et un tableur le soir.'), Q('pb-01'), Q('pb-02'), Q('im-01'), Q('de-01'), Q('de-04'), Q('dl-01'), Q('co-04')],
      signaux: S('oui', 'inconnu', 'partiel', 'inconnu', { besoin: 'Files d\'attente chaque lundi matin.', decideur: 'Le directeur de site valide, absent de l\'appel.' }),
      notes: 'Appel coupé à 40 minutes : à finir par écrit.',
    });
    ajouter({
      organisation: 'Agence de communication', secteur: 'Services aux entreprises', taille: 'pe', fonction: 'Dirigeant ou dirigeante', prenom: 'Sophie', canal: 'visio', date: ajout(t, -6), heure: '11:00', duree: 30, statut: 'fait',
      objectif: 'Comprendre le suivi des temps passés par projet et ce qui bloque la facturation.',
      hypotheses: [H('Les temps sont saisis en fin de mois, de mémoire.', 'confirmee'), H('Un outil de suivi des temps est déjà en place.', 'infirmee')],
      questions: [Q('ou-01', 'Oui.'), Q('ou-03', 'Deux projets facturés à perte ce trimestre.'), Q('si-01', 'Chacun note ses heures dans un tableur à la fin du mois.'), Q('si-02', 'Douze personnes, la gérante relit.'), Q('pb-01', 'Impossible de savoir en cours de projet si le budget tient.'), Q('pb-02', 'Une refonte de site : 40 % d\'heures en plus, vu après coup.'), Q('im-01', 'Environ deux jours de relance et de saisie chaque mois.'), Q('de-04', 'Oui, une enveloppe prévue pour les outils au premier trimestre.'), Q('de-01', 'La gérante décide, avec la directrice de clientèle.'), Q('dl-01', 'Avant la fin du trimestre prochain.'), Q('co-04', 'Une proposition à présenter aux deux associées.')],
      signaux: S('oui', 'oui', 'oui', 'partiel', { budget: 'Enveloppe outils prévue au T1.', echeance: 'Fin du trimestre prochain, à confirmer.' }),
      objections: [O('ob-02', 'Demandé en fin d\'appel : proposer deux périmètres.')],
      synthese: 'Besoin net et chiffré (deux jours par mois, deux projets à perte). La gérante décide, budget prévu. Proposition attendue avec deux périmètres.',
      prochaine: { texte: 'Présenter la proposition à la gérante et à la directrice de clientèle', date: ajout(t, 3) },
    });
    ajouter({
      organisation: 'Service des sports d\'une commune', secteur: 'Collectivité ou administration', taille: 'public', fonction: 'Responsable de service', canal: 'telephone', date: ajout(t, -12), heure: '15:00', duree: 45, statut: 'fait',
      objectif: 'Comprendre la réservation des équipements par les associations.',
      questions: [Q('ou-01', 'Oui.'), Q('si-01', 'Demandes par formulaire papier, planning tenu par une seule personne.'), Q('pb-01', 'Les doubles réservations du samedi.'), Q('de-01', 'Passage obligatoire en commission, puis validation par le directeur des services.'), Q('de-04', 'Pas de ligne dédiée, à inscrire au budget.'), Q('dl-01', 'Idéalement pour la rentrée de septembre.')],
      signaux: S('oui', 'partiel', 'non', 'partiel', { decideur: 'Le directeur des services n\'a jamais été rencontré.' }),
      objections: [O('ob-19', 'Elle propose d\'en parler en réunion de service.'), O('ob-20', 'Seuil à vérifier avec le service de la commande publique.')],
      synthese: 'Besoin réel, mais décision et budget hors de portée de l\'interlocutrice. Préparer une note d\'une page pour le directeur des services.',
      prochaine: { texte: 'Envoyer la note d\'une page au directeur des services', date: ajout(t, -2) },
    });
    ajouter({
      organisation: 'Commerce de détail (trois boutiques)', secteur: 'Commerce', taille: 'tpe', fonction: 'Dirigeant ou dirigeante', canal: 'sur-place', date: ajout(t, -20), heure: '09:00', duree: 20, statut: 'fait',
      objectif: 'Savoir comment les stocks des trois boutiques sont suivis.',
      questions: [Q('si-01', 'Inventaire à la main chaque trimestre.'), Q('pb-01', 'Rien de grave, quelques ruptures en période de fêtes.'), Q('dl-01', 'Pas avant l\'été.')],
      signaux: S('partiel', 'inconnu', 'inconnu', 'non'),
      objections: [O('ob-06', 'Après les soldes d\'hiver.')],
      synthese: 'Sujet secondaire pour l\'instant. Garder le contact.',
      prochaine: { texte: 'Rappeler après les soldes d\'hiver', date: ajout(t, 40) },
    });
    ajouter({
      organisation: 'Bureau d\'études thermiques', secteur: 'BTP et construction', taille: 'tpe', fonction: 'Dirigeant ou dirigeante', canal: 'telephone', date: ajout(t, -30), heure: '17:00', duree: 30, statut: 'fait',
      objectif: 'Vérifier l\'intérêt pour un suivi des dossiers clients.',
      questions: [Q('si-03', 'Un logiciel métier qui leur convient.'), Q('pb-01', 'Aucune difficulté particulière.')],
      signaux: S('non', 'inconnu', 'oui', 'non'),
      objections: [O('ob-09')],
      synthese: 'Pas de besoin : l\'outil en place convient. Clos proprement.',
    });
    ajouter({
      organisation: 'Entreprise de nettoyage industriel', secteur: 'Services aux entreprises', taille: 'me', fonction: 'Direction des opérations', canal: 'visio', date: ajout(t, -45), heure: '10:30', duree: 45, statut: 'fait',
      objectif: 'Comprendre la planification des équipes sur les sites clients.',
      questions: [Q('pb-01', 'Les remplacements de dernière minute.'), Q('im-01', 'Des pénalités contractuelles deux fois ce semestre.'), Q('de-04', 'Budget validé.'), Q('dl-01', 'Avant la fin de l\'année.')],
      signaux: S('oui', 'oui', 'oui', 'oui'),
      synthese: 'Très qualifié. Atelier de cadrage tenu.',
      prochaine: { texte: 'Atelier de cadrage avec l\'équipe planning', date: ajout(t, -38), faite: true },
    });
    ajouter({ organisation: 'Service d\'aide à domicile', secteur: 'Santé et médico-social', taille: 'pe', fonction: 'Direction générale', canal: 'telephone', date: ajout(t, -3), heure: '14:00', duree: 30, statut: 'annule', objectif: 'Comprendre la gestion des plannings d\'intervention.', notes: 'Annulé par l\'interlocutrice, à reprogrammer en janvier.' });
    e.mesQuestions = [
      { id: uid(), phase: 'situation', texte: 'Combien de changements de série faites-vous par semaine ?' },
      { id: uid(), phase: 'conclusion', texte: 'Qui d\'autre devrait lire le compte rendu de cet échange ?' },
    ];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Préparateur d\'appel découverte · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="80" cy="80" r="60" fill="#F5B400"/>
          <rect x="160" y="20" width="120" height="120" fill="#1D4E89"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="410" y="130" width="40" height="40" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Préparateur d'appel découverte</p>
          <h1>Prépare l'appel. Mène-le. Conclus.</h1>
          <p>Une fiche contexte, les bonnes questions par phase, un plan minuté, les objections sous la main pendant l'appel, puis le score de qualification et la prochaine étape datée.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton préparateur</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes appels sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon préparateur</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de préparateur ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon préparateur'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Chaque appel découverte, préparé en dix minutes.</h1>
        <p class="intro">Une banque de ${BANQUE.length} questions rangées en ${B.phases.length} phases, ${B.objections.length} objections types avec des pistes de réponse, un plan minuté selon la durée de l'appel, puis un score de qualification et un compte rendu prêt à copier.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="aide" style="margin-top:20px">${esc(B.rgpd.texte)}</p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton prochain appel</h1>
        <p class="intro">Quelques mots suffisent pour commencer : tu compléteras la fiche, l'objectif et les questions juste après. Tu peux aussi commencer sans appel.</p>
        <form id="form-premier" class="premier-appel" novalidate>
          ${champsContexte({ organisation: '', fonction: '', date: auj(), heure: '', duree: 30, canal: 'telephone', secteur: '', taille: '', prenom: '' }, true)}
          <p class="erreur" role="alert"></p>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <span class="rang"><button class="btn" data-action="accueil-sans">Commencer sans appel</button><button class="btn primaire" data-action="accueil-fin">Créer et préparer</button></span>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#form-premier')?.addEventListener('submit', (e) => { e.preventDefault(); terminerAccueil(true); });
  }

  function terminerAccueil(avecAppel) {
    let nouvel = null;
    if (avecAppel) {
      const f = new FormData($('#form-premier'));
      const lu = lireContexte(f);
      if (typeof lu === 'string') { $('#form-premier .erreur').textContent = lu; return; }
      nouvel = R.normaliserAppel({ id: uid(), ...lu }, auj());
    }
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    if (nouvel) { E.appels.push(nouvel); E.reglages.dureeDefaut = nouvel.duree; courantId = nouvel.id; vue = 'preparer'; } else vue = 'appels';
    accueil = { etape: 1, prenom: '' };
    sauver();
    demarrer();
    toast(nouvel ? 'Appel créé : écris l\'objectif, puis choisis tes questions dans la banque.' : 'Ton préparateur est prêt. Crée ton premier appel quand tu veux.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    appels: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    preparer: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    appel: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    synthese: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="8" width="4" height="13" fill="currentColor"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    banque: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    haut: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m4 15 8-8 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    bas: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m4 9 8 8 8-8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    croix: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['appels', 'Appels'], ['preparer', 'Préparer'], ['appel', 'En appel'], ['synthese', 'Synthèse'], ['banque', 'Banque']];
  const AVERTISSEMENT = `<p class="mention avertissement">Outil d'aide à la préparation : les questions et les pistes de réponse sont des points de départ, à adapter à chaque échange. ${esc(B.rgpd.texte)}</p>`;

  function demarrer() {
    document.body.classList.add('app');
    lireHash();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/appel-decouverte/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Appel<br>découverte</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function lireHash() {
    const [v, id] = location.hash.slice(1).split('/');
    if (ONGLETS.some(([o]) => o === v)) vue = v;
    if (id && E && appel(id)) courantId = id;
  }
  const ecrireHash = () => history.replaceState(null, '', `#${vue}${courantId && vue !== 'appels' && vue !== 'banque' ? `/${courantId}` : ''}`);

  function rendre() {
    if (!E || !$('#vue')) return;
    if (courantId && !appel(courantId)) courantId = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { appels: 'Appels', preparer: 'Préparer', appel: 'En appel', synthese: 'Synthèse', banque: 'Banque' };
    const a = courant();
    document.title = `${titres[vue]}${a && ['preparer', 'appel', 'synthese'].includes(vue) ? ` · ${a.organisation}` : ''} · Appel découverte`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { appels: vueAppels, preparer: vuePreparer, appel: vueEnAppel, synthese: vueSynthese, banque: vueBanque }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    const qb = $('#recherche-banque');
    if (qb) qb.addEventListener('input', (e) => { filtre.qBanque = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche-banque'); n.focus(); n.setSelectionRange(pos, pos); });
    majChrono();
  }

  function changerVue(v, id) {
    vue = v;
    if (id) courantId = id;
    ecrireHash();
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Une zone de saisie a le focus : ne pas tout redessiner sous les doigts de l'utilisateur.
  const saisieEnCours = () => { const el = document.activeElement; return !!el && el.matches?.('#vue textarea, #vue input[type=text], #vue input:not([type])'); };

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  const quandRelatif = (d, t) => {
    const n = R.ecart(t, d);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
  };
  const etiquetteQualif = (a) => { const q = R.qualification(a.signaux); return `<span class="etiquette ${COUL_QUALIF[q.niveau]}">${B.niveauxQualif[q.niveau].nom} · ${q.total}/8</span>`; };
  const heureTexte = (h) => `${Number(h.slice(0, 2))} h ${h.slice(3)}`;
  const interlocuteur = (a) => [a.prenom, a.fonction].filter(Boolean).join(', ') || 'Interlocuteur à préciser';

  // Choix d'un appel pour les vues qui en demandent un.
  function choixAppel(cible, texte) {
    const t = auj();
    const c = R.classer(E.appels, t);
    const liste = cible === 'synthese' ? [...c.aCloturer, ...c.faits] : [...c.aVenir, ...c.aCloturer];
    return `<div class="vue-tete"><div><h1>${texte}</h1><p>Choisis l'appel concerné, ou crée-en un nouveau.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Nouvel appel</button></div></div>
      ${liste.length ? `<ul class="lignes-appels">${liste.map((a) => ligneAppel(a, t, cible)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun appel ici</h3><p>${cible === 'synthese' ? 'Les appels passés apparaîtront ici pour leur synthèse.' : 'Crée un appel : sa fiche contexte, son objectif et ses questions se préparent ici.'}</p></div></div>`}`;
  }

  // ---------- Vue Appels ----------
  function ligneAppel(a, t, cible) {
    const e = R.etat(a, t);
    const prep = R.preparation(a);
    const dest = cible || ({ 'a-preparer': 'preparer', pret: 'preparer', 'a-cloturer': 'synthese', fait: 'synthese', annule: 'preparer' }[e]);
    const etiquettes = [`<span class="etiquette ${COUL_ETAT[e]}">${LIB_ETAT[e]}</span>`];
    if (e === 'a-preparer') etiquettes.push(`<span class="etiquette-texte">Manque : ${prep.manques.map((m) => LIB_MANQUE[m]).join(', ')}</span>`);
    if (e === 'fait') {
      etiquettes.push(etiquetteQualif(a));
      if (R.etapeEnRetard(a, t)) etiquettes.push('<span class="etiquette rouge">Étape en retard</span>');
      else if (R.sansEtapeDatee(a) && R.qualification(a.signaux).niveau !== 'hors-cible') etiquettes.push('<span class="etiquette-texte">Sans prochaine étape datée</span>');
    }
    const etape = a.statut === 'fait' && a.prochaine.texte ? `<span class="ligne-etape">${a.prochaine.faite ? 'Fait : ' : 'Ensuite : '}${esc(a.prochaine.texte)}${a.prochaine.date ? ` · ${dateCourte(a.prochaine.date)}` : ''}</span>` : '';
    const bouton = e === 'pret' || e === 'a-preparer'
      ? `<button class="btn petit ${e === 'pret' && a.date === t ? 'primaire' : ''}" data-action="aller" data-vue="appel" data-id="${a.id}">En appel</button>`
      : e === 'a-cloturer' ? `<button class="btn petit primaire" data-action="aller" data-vue="synthese" data-id="${a.id}">Clôturer</button>` : '';
    return `<li class="ligne-appel et-${e}">
      <span class="date-pastille ${a.date === t ? 'auj' : ''}"><b>${versDate(a.date).getDate()}</b>${moisCourt(a.date)}</span>
      <button class="ligne-info" data-action="aller" data-vue="${dest}" data-id="${a.id}">
        <b>${esc(titreAppel(a))}</b>
        <span class="ligne-detail">${esc(interlocuteur(a))} · ${fmt(a.date, { weekday: 'short' }).replace('.', '')}${a.heure ? ` ${heureTexte(a.heure)}` : ''} · ${duree(a.duree)} · ${nomCanal(a.canal)}</span>
        <span class="ligne-etiquettes">${etiquettes.join('')}</span>
        ${etape}
      </button>
      ${bouton ? `<div class="ligne-droite">${bouton}</div>` : ''}
    </li>`;
  }

  function vueAppels() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const liste = q ? E.appels.filter((a) => `${a.organisation} ${a.secteur} ${a.fonction} ${a.prenom} ${a.objectif} ${a.prochaine.texte}`.toLowerCase().includes(q)) : E.appels;
    const c = R.classer(liste, t);
    const n = R.compteurs(E.appels, t);
    const bonjour = E.prenom ? `Bonjour ${esc(E.prenom)}` : 'Appels';
    if (!E.appels.length) {
      return `<div class="vue-tete"><div><h1>${bonjour}</h1><p>Aucun appel pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Prépare ton premier appel découverte</h3><p>Une fiche contexte en quelques champs, un objectif, puis les questions choisies dans la banque : le plan minuté se calcule selon la durée.</p><div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Nouvel appel</button></div></div></div>
        ${AVERTISSEMENT}`;
    }
    const tuiles = [
      ['À préparer', n.aPreparer, `${pluriel(n.prets, 'appel prêt', 'appels prêts')}`, 'var(--jaune)', ''],
      ['7 prochains jours', n.semaine, n.semaine > 1 ? 'appels prévus' : 'appel prévu', 'var(--bleu)', 'rond'],
      ['Étapes en retard', n.enRetard, n.aCloturer ? `${pluriel(n.aCloturer, 'appel', 'appels')} à clôturer` : 'prochaines étapes dépassées', 'var(--rouge)', ''],
      ['Qualifiés', n.qualifies, `sur ${pluriel(n.faits, 'appel fait', 'appels faits')}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const carteRetard = (a) => `<article class="decision niv-depasse">
        <span class="etiquette rouge">Prévue ${quandRelatif(a.prochaine.date, t)}</span>
        <button class="decision-corps" data-action="aller" data-vue="synthese" data-id="${a.id}"><b>${esc(a.prochaine.texte)}</b><span>${esc(a.organisation)} · appel du ${dateCourte(a.date)} · ${B.niveauxQualif[R.qualification(a.signaux).niveau].nom.toLowerCase()}</span></button>
        <div class="decision-pied"><button class="btn petit primaire" data-action="etape-faite" data-id="${a.id}">C'est fait</button><button class="btn petit" data-action="etape-reporter" data-id="${a.id}">Reporter d'une semaine</button></div>
      </article>`;
    const section = (titre, sous, items, cible) => (items.length ? `<section><h2 class="titre-section">${titre} <span>${sous}</span></h2><ul class="lignes-appels">${items.map((a) => ligneAppel(a, t, cible)).join('')}</ul></section>` : '');
    const rien = !c.enRetard.length && !c.aVenir.length && !c.aCloturer.length && !c.faits.length && !c.annules.length;
    return `
      <div class="vue-tete"><div><h1>${bonjour}</h1><p>Tes appels à préparer, ceux à clôturer, et les prochaines étapes à ne pas laisser filer.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Nouvel appel</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="outils-liste"><label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher une organisation, une fonction…" value="${esc(filtre.q)}"></label></div>
      ${c.enRetard.length ? `<section><h2 class="titre-section">Prochaines étapes en retard <span>${pluriel(c.enRetard.length, 'étape')} à faire ou à reporter</span></h2><div class="decisions">${c.enRetard.map(carteRetard).join('')}</div></section>` : ''}
      ${section('À venir', 'du plus proche au plus lointain', c.aVenir)}
      ${section('À clôturer', 'appels passés sans synthèse', c.aCloturer)}
      ${section('Faits', 'score de qualification et suite', c.faits)}
      ${c.annules.length ? `<details class="plus-tard"><summary>${pluriel(c.annules.length, 'appel annulé', 'appels annulés')}</summary><ul class="lignes-appels">${c.annules.map((a) => ligneAppel(a, t)).join('')}</ul></details>` : ''}
      ${rien ? `<div class="vide-etat petit"><div><h3>Aucun appel ne correspond</h3><p>Change la recherche.</p></div></div>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Vue Préparer ----------
  const tagSignal = (q) => { const s = q.signal || deBanque(q.ref)?.signal; return s ? `<span class="tag-signal">${signal(s).nom}</span>` : ''; };

  function enTeteAppel(a, sous) {
    const t = auj();
    const e = R.etat(a, t);
    return `<p class="surtitre fil-appel"><button class="btn lien" data-action="vue" data-vue="appels">Appels</button> › ${sous}</p>
      <h1>${esc(a.organisation)}</h1>
      <p>${esc(interlocuteur(a))} · ${dateLongue(a.date)}${a.heure ? ` à ${heureTexte(a.heure)}` : ''} (${quandRelatif(a.date, t)}) · ${duree(a.duree)} · ${nomCanal(a.canal)} <span class="etiquette ${COUL_ETAT[e]}">${LIB_ETAT[e]}</span></p>`;
  }

  function blocPlan(a) {
    const p = R.plan(a.questions, a.duree, B.phases);
    if (!p.phases.length) return `<div class="vide-etat petit"><div><h3>Plan minuté</h3><p>Ajoute des questions : la durée de ${duree(a.duree)} se répartit entre les phases retenues.</p></div></div>`;
    const alerte = p.alerte === 'trop' ? `<p class="aide alerte-plan">${pluriel(p.nb, 'question')} pour ${duree(a.duree)} : compte environ 2 minutes par question, soit ${p.capacite} au plus. Garde les plus utiles, ou allonge l'appel.</p>` : '';
    return `<figure class="graphique plan" aria-label="Plan minuté">
        <div class="plan-tete"><b>Plan minuté · ${duree(a.duree)}</b><span>${pluriel(p.nb, 'question')} · ${p.capacite} conseillées au plus</span></div>
        <ol class="plan-lignes">${p.phases.map((l) => `<li title="${esc(l.nom)} : de ${l.debut} à ${l.fin} min">
          <span class="pl-nom">${esc(l.nom)}<small>${pluriel(l.nb, 'question')}</small></span>
          <span class="pl-piste"><span class="pl-barre" style="left:${(l.debut / p.duree) * 100}%;width:${(l.minutes / p.duree) * 100}%"></span></span>
          <span class="pl-val"><b>${l.minutes} min</b><small>${l.debut}–${l.fin}</small></span>
        </li>`).join('')}</ol>
      </figure>${alerte}`;
  }

  function vuePreparer() {
    const a = courant();
    if (!a) return choixAppel('preparer', 'Préparer un appel');
    const prep = R.preparation(a);
    const groupes = R.parPhase(a.questions, B.phases);
    const ph = filtre.phaseBanque;
    const refs = new Set(a.questions.map((q) => q.ref).filter(Boolean));
    const textes = new Set(a.questions.map((q) => q.texte));
    const banquePhase = B.questions[ph].map((q) => ({ ...q, phase: ph }));
    const miennes = E.mesQuestions.filter((q) => q.phase === ph);
    const essentiellesManquantes = BANQUE.filter((q) => q.essentielle && !refs.has(q.id)).length;
    return `
      <div class="vue-tete"><div>${enTeteAppel(a, 'Préparer')}</div>
        <div class="actions"><button class="btn" data-action="fiche" data-id="${a.id}">Fiche contexte</button><button class="btn" data-action="imprimer-prep">Imprimer</button><button class="btn primaire" data-action="aller" data-vue="appel" data-id="${a.id}">Passer en appel</button></div></div>
      ${prep.pret ? '' : `<p class="aide">Pour que l'appel soit prêt, il manque : ${prep.manques.map((m) => LIB_MANQUE[m]).join(', ')}.</p>`}
      <div class="colonnes-prep">
        <div class="col-prep">
          <section class="carte-bloc">
            <h2 class="titre-bloc">Objectif de l'appel</h2>
            <label class="champ"><span class="sr-only">Objectif</span><textarea data-champ="objectif" rows="3" maxlength="400" placeholder="Ce que tu veux savoir à la fin de l'appel. Ex. : comprendre comment les devis sont suivis et qui décide.">${esc(a.objectif)}</textarea></label>
            <h3 class="titre-bloc petit">Hypothèses à vérifier</h3>
            <ul class="hypotheses">${a.hypotheses.map((h) => `<li><input data-champ="hyp" data-id="${h.id}" maxlength="200" value="${esc(h.texte)}" aria-label="Hypothèse" placeholder="Ce que tu crois savoir"><button class="btn-icone petit" data-action="hyp-suppr" data-id="${h.id}" aria-label="Retirer l'hypothèse">${ICONES.croix}</button></li>`).join('')}</ul>
            <button class="btn petit" data-action="hyp-ajout">${ICONES.plus}Ajouter une hypothèse</button>
          </section>
          ${blocPlan(a)}
          <section>
            <h2 class="titre-section">Questions retenues <span>${pluriel(a.questions.length, 'question')}, dans l'ordre de l'appel</span></h2>
            ${groupes.length ? groupes.map((g) => `<div class="groupe-phase"><h3 class="titre-phase">${esc(g.phase.nom)}</h3><ol class="retenues">${g.questions.map((q, i) => `<li>
                <span class="ret-texte">${esc(q.texte)}${tagSignal(q)}</span>
                <span class="ret-actions"><button class="btn-icone petit" data-action="q-haut" data-id="${q.id}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>${ICONES.haut}</button><button class="btn-icone petit" data-action="q-bas" data-id="${q.id}" aria-label="Descendre" ${i === g.questions.length - 1 ? 'disabled' : ''}>${ICONES.bas}</button><button class="btn-icone petit" data-action="q-suppr" data-id="${q.id}" aria-label="Retirer">${ICONES.croix}</button></span>
              </li>`).join('')}</ol></div>`).join('') : '<div class="vide-etat petit"><div><h3>Aucune question retenue</h3><p>Choisis-les dans la banque, phase par phase, ou ajoute d\'un coup les essentielles.</p></div></div>'}
          </section>
        </div>
        <aside class="col-banque carte-bloc" aria-label="Banque de questions">
          <h2 class="titre-bloc">Banque de questions</h2>
          <div class="puces-phases" role="group" aria-label="Phase">${B.phases.map((p) => `<button class="filtre" data-action="phase-banque" data-phase="${p.id}" aria-pressed="${ph === p.id}">${esc(p.court)} <small>${a.questions.filter((q) => q.phase === p.id).length}</small></button>`).join('')}</div>
          <p class="but-phase">${esc(phase(ph).but)}</p>
          ${essentiellesManquantes ? `<button class="btn petit" data-action="essentielles">${ICONES.plus}Ajouter les ${essentiellesManquantes} essentielles manquantes</button>` : ''}
          <ul class="banque-liste">${banquePhase.map((q) => `<li class="${refs.has(q.id) ? 'retenue' : ''}">
              <span>${esc(q.texte)}${q.essentielle ? '<span class="tag-essentielle">Essentielle</span>' : ''}${tagSignal(q)}</span>
              ${refs.has(q.id) ? '<span class="deja">Retenue</span>' : `<button class="btn petit" data-action="q-ajout" data-ref="${q.id}" aria-label="Ajouter : ${esc(q.texte)}">${ICONES.plus}</button>`}
            </li>`).join('')}
            ${miennes.map((q) => `<li class="mienne ${textes.has(q.texte) ? 'retenue' : ''}"><span>${esc(q.texte)}<span class="tag-signal">Ma question</span></span>${textes.has(q.texte) ? '<span class="deja">Retenue</span>' : `<button class="btn petit" data-action="q-ajout-mienne" data-id="${q.id}" aria-label="Ajouter : ${esc(q.texte)}">${ICONES.plus}</button>`}</li>`).join('')}
          </ul>
          <form class="form-perso" data-form="perso" novalidate>
            <h3 class="titre-bloc petit">Ta propre question</h3>
            <label class="champ"><span class="sr-only">Question</span><textarea name="texte" rows="2" maxlength="300" placeholder="Ex. : Combien de devis envoyez-vous par mois ?"></textarea></label>
            <div class="rang-champs">
              <label class="champ">Phase<select name="phase">${B.phases.map((p) => `<option value="${p.id}" ${p.id === ph ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
            </div>
            <label class="case"><input type="checkbox" name="garder" checked> Garder dans mes questions</label>
            <button class="btn petit primaire" type="submit">${ICONES.plus}Ajouter à cet appel</button>
          </form>
        </aside>
      </div>
      <p class="mention avertissement">${esc(B.rgpd.texte)}</p>`;
  }

  // ---------- Vue En appel ----------
  let minuterieChrono = null;
  const secondesEcoulees = (a) => (a.chronoDebut ? (Date.now() - a.chronoDebut) / 1000 : 0);

  function majChrono() {
    clearInterval(minuterieChrono);
    const a = courant();
    if (vue !== 'appel' || !a) return;
    const maj = () => {
      const el = $('#chrono');
      if (!el) { clearInterval(minuterieChrono); return; }
      const s = secondesEcoulees(a);
      el.textContent = R.chrono(s);
      const p = R.plan(a.questions, a.duree, B.phases);
      const ph = a.chronoDebut ? R.phaseA(p, s / 60) : null;
      const cible = $('#phase-prevue');
      if (cible) cible.innerHTML = !a.chronoDebut ? 'Démarre le chrono au début de l\'appel' : !ph ? 'Aucune question' : ph.depasse ? `<b>Temps prévu dépassé</b> de ${Math.ceil(s / 60 - p.duree)} min` : `Phase prévue : <b>${esc(ph.nom)}</b> jusqu'à ${ph.fin} min`;
      $('.barre-chrono')?.classList.toggle('depasse', !!ph?.depasse);
      document.querySelectorAll('.phase-appel').forEach((sec) => sec.classList.toggle('en-cours', !!ph && !ph.depasse && sec.dataset.phase === ph.phase));
    };
    maj();
    if (a.chronoDebut) minuterieChrono = setInterval(maj, 1000);
  }

  function scoreHtml(a) {
    const q = R.qualification(a.signaux);
    return `<div class="score niv-${q.niveau}"><b>${q.total}<small>/8</small></b><span><strong>${B.niveauxQualif[q.niveau].nom}</strong>${q.inconnus.length ? `${pluriel(q.inconnus.length, 'signal', 'signaux')} encore inconnu${q.inconnus.length > 1 ? 's' : ''} : ${q.inconnus.map((k) => signal(k).nom.toLowerCase()).join(', ')}` : B.niveauxQualif[q.niveau].detail}</span></div>`;
  }

  function blocSignaux(a) {
    return `<div class="signaux">${B.signaux.map((s) => {
      const v = a.signaux[s.id];
      return `<fieldset class="signal"><legend><b>${s.nom}</b><span data-lib-signal="${s.id}">${esc(s.niveaux[v.niveau])}</span></legend>
        <div class="choix-4">${R.NIVEAUX.map((n) => `<label><input type="radio" name="sig-${s.id}" value="${n}" data-signal="${s.id}" ${v.niveau === n ? 'checked' : ''}><span>${LIB_NIVEAU[n]}</span></label>`).join('')}</div>
        <input class="note-signal" data-champ="signal-note" data-k="${s.id}" maxlength="200" value="${esc(v.note)}" placeholder="Ce qui le montre (facultatif)" aria-label="Note sur le signal ${s.nom}">
      </fieldset>`;
    }).join('')}</div>
    <p class="mention">Règle du score : oui = 2 points, partiel = 1, non ou inconnu = 0. Qualifié : 6 points ou plus avec un besoin explicite ; à creuser : 3 à 5 ; froid : moins de 3 ; hors cible : aucun besoin reconnu.</p>`;
  }

  function blocHypotheses(a) {
    if (!a.hypotheses.length) return '';
    return `<ul class="hyp-resultats">${a.hypotheses.map((h) => `<li><span>${esc(h.texte || 'Hypothèse sans texte')}</span><div class="choix-3">${R.RESULTATS.map((r) => `<label><input type="radio" name="hyp-${h.id}" value="${r}" data-hyp-resultat="${h.id}" ${h.resultat === r ? 'checked' : ''}><span>${LIB_HYP[r]}</span></label>`).join('')}</div></li>`).join('')}</ul>`;
  }

  function blocObjectionsEntendues(a) {
    return a.objections.length ? `<ul class="objections-entendues">${a.objections.map((o) => `<li><div><b>${esc(o.texte)}</b><button class="btn-icone petit" data-action="obj-suppr" data-id="${o.id}" aria-label="Retirer l'objection">${ICONES.croix}</button></div><input data-champ="obj-note" data-id="${o.id}" maxlength="500" value="${esc(o.note)}" placeholder="Ce qui a été dit, ta réponse" aria-label="Note sur l'objection"></li>`).join('')}</ul>` : '<p class="aide">Aucune objection notée. Le bouton « Objection ? » ouvre les pistes de réponse.</p>';
  }

  function vueEnAppel() {
    const a = courant();
    if (!a) return choixAppel('appel', 'Mener un appel');
    const av = R.avancement(a.questions);
    const p = R.plan(a.questions, a.duree, B.phases);
    const minutes = new Map(p.phases.map((l) => [l.phase, l]));
    const groupes = R.parPhase(a.questions, B.phases);
    return `
      <div class="barre-chrono">
        <div class="chrono-bloc"><b id="chrono">00:00</b><span id="phase-prevue"></span></div>
        <span class="avancement" id="avancement"><b>${av.posees}/${av.total}</b> posées</span>
        <div class="chrono-actions">
          ${a.chronoDebut ? '<button class="btn petit" data-action="chrono-zero">Chrono à zéro</button>' : '<button class="btn petit primaire" data-action="chrono-go">Démarrer</button>'}
          <button class="btn petit jaune" data-action="objections">Objection ?</button>
          <button class="btn petit" data-action="terminer">Terminer</button>
        </div>
      </div>
      <div class="vue-tete"><div>${enTeteAppel(a, 'En appel')}${a.objectif ? `<p class="objectif-rappel"><b>Objectif :</b> ${esc(a.objectif)}</p>` : ''}</div></div>
      <div class="colonnes-appel">
        <div class="col-questions">
          ${groupes.length ? groupes.map((g) => {
            const l = minutes.get(g.phase.id);
            return `<section class="phase-appel" data-phase="${g.phase.id}"><h2 class="titre-phase">${esc(g.phase.nom)}<span>${l ? `${l.debut}–${l.fin} min` : ''}</span></h2>
              <ol class="questions-appel">${g.questions.map((q) => `<li class="q-carte ${q.posee ? 'posee' : ''}" data-q="${q.id}">
                <label class="q-tete"><input type="checkbox" data-q-posee="${q.id}" ${q.posee ? 'checked' : ''}><span>${esc(q.texte)}${tagSignal(q)}</span></label>
                <textarea data-champ="q-reponse" data-id="${q.id}" rows="2" maxlength="2000" placeholder="Réponse, en quelques mots" aria-label="Réponse à : ${esc(q.texte)}">${esc(q.reponse)}</textarea>
              </li>`).join('')}</ol></section>`;
          }).join('') : `<div class="vide-etat petit"><div><h3>Aucune question préparée</h3><p>Tu peux mener l'appel avec les notes libres, ou <button class="btn lien" data-action="aller" data-vue="preparer" data-id="${a.id}">choisir des questions</button>.</p></div></div>`}
          <form class="form-imprevue" data-form="imprevue" novalidate>
            <label class="champ">Question imprévue<input name="texte" maxlength="300" placeholder="Une question qui te vient pendant l'appel"></label>
            <label class="champ">Phase<select name="phase">${B.phases.map((ph) => `<option value="${ph.id}" ${ph.id === 'situation' ? 'selected' : ''}>${esc(ph.nom)}</option>`).join('')}</select></label>
            <button class="btn petit" type="submit">${ICONES.plus}Ajouter</button>
          </form>
        </div>
        <aside class="col-signaux">
          <section class="carte-bloc"><h2 class="titre-bloc">Signaux</h2><div id="score-live">${scoreHtml(a)}</div>${blocSignaux(a)}</section>
          ${a.hypotheses.length ? `<section class="carte-bloc"><h2 class="titre-bloc">Hypothèses</h2>${blocHypotheses(a)}</section>` : ''}
          <section class="carte-bloc"><h2 class="titre-bloc">Objections entendues</h2><div id="objections-entendues">${blocObjectionsEntendues(a)}</div><button class="btn petit jaune" data-action="objections">Objection ? Voir les pistes</button></section>
          <section class="carte-bloc"><h2 class="titre-bloc">Notes libres</h2><label class="champ"><span class="sr-only">Notes</span><textarea data-champ="notes" rows="5" maxlength="5000" placeholder="Ce qui ne rentre dans aucune question">${esc(a.notes)}</textarea></label></section>
        </aside>
      </div>`;
  }

  // ---------- Vue Synthèse ----------
  function vueSynthese() {
    const a = courant();
    if (!a) return choixAppel('synthese', 'Synthèse d\'un appel');
    const t = auj();
    const av = R.avancement(a.questions);
    const reponses = a.questions.filter((q) => q.posee && q.reponse.trim());
    const retard = R.etapeEnRetard(a, t);
    const raccourcis = [[2, '+2 jours'], [7, '+1 semaine'], [14, '+2 semaines'], [30, '+1 mois']];
    return `
      <div class="vue-tete"><div>${enTeteAppel(a, 'Synthèse')}</div>
        <div class="actions"><button class="btn" data-action="compte-rendu">Compte rendu à copier</button><button class="btn" data-action="imprimer-resume">Imprimer le résumé</button>${a.statut === 'fait' ? '' : `<button class="btn primaire" data-action="marquer-fait" data-id="${a.id}">Marquer l'appel fait</button>`}</div></div>
      ${a.statut === 'prevu' ? `<p class="aide">Appel pas encore marqué « fait » : il reste dans « ${a.date < t ? 'à clôturer' : 'à venir'} » tant que tu ne l'as pas fait.</p>` : ''}
      ${a.statut === 'annule' ? '<p class="aide">Appel annulé. Rouvre-le depuis la fiche contexte pour le reprogrammer.</p>' : ''}
      <div class="colonnes-synthese">
        <div>
          <section class="carte-bloc etape-bloc ${retard ? 'retard' : ''}">
            <h2 class="titre-bloc">Prochaine étape ${retard ? '<span class="etiquette rouge">En retard</span>' : ''}</h2>
            <label class="champ">Quoi<input data-champ="etape-texte" maxlength="200" value="${esc(a.prochaine.texte)}" placeholder="Ex. : envoyer la proposition, deuxième rendez-vous avec la direction"></label>
            <div class="rang-champs">
              <label class="champ">Quand<input type="date" data-champ="etape-date" value="${a.prochaine.date || ''}"></label>
              <label class="case etape-faite"><input type="checkbox" data-etape-faite ${a.prochaine.faite ? 'checked' : ''}> Faite</label>
            </div>
            <div class="raccourcis">${raccourcis.map(([n, l]) => `<button class="btn petit" data-action="etape-dans" data-n="${n}">${l}</button>`).join('')}</div>
            ${!a.prochaine.texte.trim() || !a.prochaine.date ? '<p class="mention">Un appel sans prochaine étape datée se perd : fixe-la avant de quitter l\'appel si tu peux.</p>' : ''}
          </section>
          <section class="carte-bloc">
            <h2 class="titre-bloc">Synthèse</h2>
            <label class="champ"><span class="sr-only">Synthèse</span><textarea data-champ="synthese" rows="5" maxlength="3000" placeholder="En trois phrases : le besoin, qui décide, ce qui a été convenu.">${esc(a.synthese)}</textarea></label>
          </section>
          ${a.hypotheses.length ? `<section class="carte-bloc"><h2 class="titre-bloc">Hypothèses</h2>${blocHypotheses(a)}</section>` : ''}
          <section class="carte-bloc">
            <h2 class="titre-bloc">Ce que tu as appris <span class="titre-sous">${av.posees}/${av.total} questions posées</span></h2>
            ${reponses.length ? `<dl class="apprentissages">${reponses.map((q) => `<div><dt>${esc(q.texte)}</dt><dd>${esc(q.reponse)}</dd></div>`).join('')}</dl>` : '<p class="aide">Aucune réponse notée. Les réponses saisies en mode « En appel » apparaissent ici.</p>'}
            ${a.notes.trim() ? `<h3 class="titre-bloc petit">Notes</h3><p class="notes-affichees">${esc(a.notes)}</p>` : ''}
          </section>
        </div>
        <aside>
          <section class="carte-bloc"><h2 class="titre-bloc">Qualification</h2><div id="score-live">${scoreHtml(a)}</div>${blocSignaux(a)}</section>
          <section class="carte-bloc"><h2 class="titre-bloc">Objections entendues</h2><div id="objections-entendues">${blocObjectionsEntendues(a)}</div></section>
          <section class="carte-bloc"><h2 class="titre-bloc">Données de ce prospect</h2><p class="mention">${esc(B.rgpd.texte)}</p>
            <div class="rang">${a.prenom ? `<button class="btn petit" data-action="effacer-prenom" data-id="${a.id}">Effacer le prénom</button>` : ''}<button class="btn petit danger" data-action="supprimer" data-id="${a.id}">Supprimer l'appel</button></div></section>
        </aside>
      </div>`;
  }

  // ---------- Vue Banque ----------
  function vueBanque() {
    const q = filtre.qBanque.trim().toLowerCase();
    const garde = (s) => !q || s.toLowerCase().includes(q);
    const onglet = filtre.ongletBanque;
    let corps;
    if (onglet === 'questions') {
      corps = B.phases.map((p) => {
        const l = B.questions[p.id].filter((x) => garde(x.texte));
        return l.length ? `<section class="groupe-phase"><h2 class="titre-section">${esc(p.nom)} <span>${esc(p.but)}</span></h2><ul class="banque-liste large">${l.map((x) => `<li><span>${esc(x.texte)}${x.essentielle ? '<span class="tag-essentielle">Essentielle</span>' : ''}${x.signal ? `<span class="tag-signal">${signal(x.signal).nom}</span>` : ''}</span></li>`).join('')}</ul></section>` : '';
      }).join('') || '<p class="aide">Aucune question ne correspond.</p>';
    } else if (onglet === 'objections') {
      corps = B.categoriesObjections.map((c) => {
        const l = B.objections.filter((o) => o.cat === c.id && garde(`${o.texte} ${o.piste} ${o.relance}`));
        return l.length ? `<section><h2 class="titre-section">${esc(c.nom)}</h2><div class="objections-grille">${l.map(carteObjection).join('')}</div></section>` : '';
      }).join('') || '<p class="aide">Aucune objection ne correspond.</p>';
    } else {
      const l = E.mesQuestions.filter((x) => garde(x.texte));
      corps = l.length ? `<ul class="banque-liste large">${l.map((x) => `<li><span>${esc(x.texte)}<span class="tag-signal">${esc(phase(x.phase).nom)}</span></span><button class="btn-icone petit" data-action="mienne-suppr" data-id="${x.id}" aria-label="Supprimer de mes questions">${ICONES.croix}</button></li>`).join('')}</ul>`
        : `<div class="vide-etat petit"><div><h3>${E.mesQuestions.length ? 'Aucune question ne correspond' : 'Aucune question personnelle'}</h3><p>Dans « Préparer », écris ta propre question et coche « Garder dans mes questions » : tu la retrouveras pour tes prochains appels.</p></div></div>`;
    }
    const onglets = [['questions', `Questions (${BANQUE.length})`], ['objections', `Objections (${B.objections.length})`], ['miennes', `Mes questions (${E.mesQuestions.length})`]];
    return `
      <div class="vue-tete"><div><h1>Banque</h1><p>Les questions par phase et les objections types, avec des pistes de réponse et une question de relance. Des points de départ, à dire avec tes mots.</p></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Contenu">${onglets.map(([id, l]) => `<button class="filtre" data-action="onglet-banque" data-onglet="${id}" aria-pressed="${onglet === id}">${l}</button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-banque" type="search" placeholder="Rechercher" value="${esc(filtre.qBanque)}"></label>
      </div>
      ${corps}`;
  }

  function carteObjection(o, avecNoter = false) {
    return `<article class="objection" data-cat="${o.cat}" data-texte="${esc(`${o.texte} ${o.piste} ${o.relance}`.toLowerCase())}">
      <span class="etiquette sable">${esc(nomCatObj(o.cat))}</span>
      <h3>« ${esc(o.texte)} »</h3>
      <p><b>Piste</b> ${esc(o.piste)}</p>
      <p class="relance"><b>Relance</b> ${esc(o.relance)}</p>
      ${avecNoter ? `<button class="btn petit" type="button" data-action="obj-noter" data-ref="${o.id}">Noter qu'elle est survenue</button>` : ''}
    </article>`;
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
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  // Champs de la fiche contexte (aussi utilisés au premier lancement, en version courte).
  function champsContexte(v, court = false) {
    const opts = (l, sel) => l.map((x) => `<option value="${x.id ?? x}" ${String(x.id ?? x) === String(sel) ? 'selected' : ''}>${esc(x.nom ?? duree(x))}</option>`).join('');
    return `
      <label class="champ">Organisation<small>Son nom, ou simplement son activité.</small><input name="organisation" required maxlength="120" value="${esc(v.organisation)}" placeholder="Ex. : fabricant de meubles"></label>
      <div class="rang-champs">
        <label class="champ">Fonction de l'interlocuteur<input name="fonction" maxlength="80" list="fonctions" value="${esc(v.fonction)}" placeholder="Ex. : direction des opérations"></label>
        ${court ? '' : `<label class="champ">Prénom <small>Facultatif.</small><input name="prenom" maxlength="40" autocomplete="off" value="${esc(v.prenom)}"></label>`}
      </div>
      <datalist id="fonctions">${B.fonctions.map((f) => `<option value="${esc(f)}">`).join('')}</datalist>
      ${court ? '' : `<div class="rang-champs">
        <label class="champ">Secteur<input name="secteur" maxlength="60" list="secteurs" value="${esc(v.secteur)}"></label>
        <label class="champ">Taille<select name="taille">${opts(B.tailles, v.taille)}</select></label>
      </div>
      <datalist id="secteurs">${B.secteurs.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`}
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" required value="${v.date}"></label>
        <label class="champ">Heure <small>Facultative.</small><input type="time" name="heure" value="${v.heure}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Durée prévue<select name="duree">${opts(B.durees, v.duree)}${B.durees.includes(v.duree) ? '' : `<option value="${v.duree}" selected>${duree(v.duree)}</option>`}</select></label>
        <label class="champ">Format<select name="canal">${opts(B.canaux, v.canal)}</select></label>
      </div>
      ${court ? '' : `<label class="champ">Objectif de l'appel<textarea name="objectif" rows="2" maxlength="400" placeholder="Ce que tu veux savoir à la fin de l'appel">${esc(v.objectif)}</textarea></label>`}
      <p class="mention rgpd">${esc(B.rgpd.texte)}</p>`;
  }

  function lireContexte(f, avant = {}) {
    const organisation = String(f.get('organisation') || '').trim();
    if (!organisation) return 'Indique l\'organisation (son nom ou son activité).';
    if (!R.estDate(String(f.get('date') || ''))) return 'Indique la date de l\'appel.';
    const champ = (k) => (f.has(k) ? String(f.get(k) || '').trim() : avant[k]);
    return {
      organisation, fonction: champ('fonction'), prenom: champ('prenom'), secteur: champ('secteur'), taille: champ('taille'),
      date: f.get('date'), heure: String(f.get('heure') || ''), duree: Number(f.get('duree')), canal: f.get('canal'), objectif: champ('objectif'),
    };
  }

  function modaleFiche(id) {
    const a = id ? appel(id) : null;
    const v = a || { organisation: '', fonction: '', prenom: '', secteur: '', taille: '', date: auj(), heure: '', duree: E.reglages.dureeDefaut, canal: 'telephone', objectif: '' };
    const pied = a
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${a.statut === 'annule' ? '<button class="btn gauche" value="reprendre">Reprogrammer</button>' : '<button class="btn gauche" value="annule">Annuler l\'appel</button>'}`
      : '<button class="btn primaire" value="ok">Créer et préparer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Fiche contexte' : 'Nouvel appel', `${champsContexte(v)}<p class="erreur" role="alert"></p>`, pied, (f, action) => {
      const lu = lireContexte(f, a || {});
      if (typeof lu === 'string') return lu;
      retenir();
      if (a) {
        Object.assign(a, R.normaliserAppel({ ...a, ...lu }, auj()));
        if (action === 'annule') a.statut = 'annule';
        if (action === 'reprendre') a.statut = 'prevu';
        sauver(); rendre();
        toast(action === 'annule' ? `Appel « ${a.organisation} » annulé.` : action === 'reprendre' ? `Appel « ${a.organisation} » reprogrammé le ${dateCourte(a.date)}.` : 'Fiche enregistrée.', { libelle: 'Annuler', faire: annuler });
      } else {
        const n = R.normaliserAppel({ id: uid(), ...lu }, auj());
        E.appels.push(n);
        E.reglages.dureeDefaut = n.duree;
        sauver();
        changerVue('preparer', n.id);
        toast('Appel créé : choisis tes questions dans la banque.', { libelle: 'Annuler', faire: annuler });
      }
    });
  }

  function modaleObjections() {
    const a = courant();
    ouvrirModale('Objections types', `
      <p class="aide">Une piste et une question de relance pour chaque objection : écoute d'abord, reformule, puis relance. « Noter » l'ajoute aux objections entendues de cet appel.</p>
      <label class="champ"><span class="sr-only">Rechercher une objection</span><input id="recherche-objection" type="search" placeholder="Ex. : cher, direction, moment…" autocomplete="off"></label>
      <div class="puces-phases" role="group" aria-label="Catégorie"><button type="button" class="filtre" data-cat-obj="" aria-pressed="true">Toutes</button>${B.categoriesObjections.map((c) => `<button type="button" class="filtre" data-cat-obj="${c.id}" aria-pressed="false">${esc(c.nom)}</button>`).join('')}</div>
      <div class="objections-liste">${B.objections.map((o) => carteObjection(o, !!a)).join('')}</div>`,
    '<button class="btn primaire" value="ok">Fermer</button>', null, 'large');
    const d = modale();
    let cat = '';
    const filtrer = () => {
      const q = d.querySelector('#recherche-objection').value.trim().toLowerCase();
      d.querySelectorAll('.objection').forEach((el) => { el.hidden = (cat && el.dataset.cat !== cat) || (q && !el.dataset.texte.includes(q)); });
    };
    d.querySelector('#recherche-objection').addEventListener('input', filtrer);
    d.querySelectorAll('[data-cat-obj]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.catObj; d.querySelectorAll('[data-cat-obj]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); filtrer(); }));
  }

  function modaleTerminer(a) {
    const av = R.avancement(a.questions);
    const q = R.qualification(a.signaux);
    ouvrirModale('Terminer l\'appel', `
      <p>${av.posees}/${av.total} questions posées. Qualification : <b>${q.total}/8, ${B.niveauxQualif[q.niveau].nom.toLowerCase()}</b>${q.inconnus.length ? ` (${pluriel(q.inconnus.length, 'signal inconnu', 'signaux inconnus')})` : ''}.</p>
      <label class="champ">Prochaine étape<input name="texte" maxlength="200" value="${esc(a.prochaine.texte)}" placeholder="Ex. : envoyer la proposition"></label>
      <label class="champ">Date<input type="date" name="date" value="${a.prochaine.date || ajout(auj(), 7)}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Terminer et faire la synthèse</button><button class="btn" value="annuler">Continuer l\'appel</button>', (f) => {
      retenir();
      a.statut = 'fait';
      a.chronoDebut = null;
      const texte = String(f.get('texte') || '').trim();
      if (texte) a.prochaine = { texte, date: R.estDate(String(f.get('date'))) ? f.get('date') : null, faite: false };
      sauver();
      changerVue('synthese', a.id);
      toast('Appel terminé : complète la synthèse, puis copie le compte rendu.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCompteRendu(a) {
    ouvrirModale('Compte rendu à copier', `
      <p class="aide">Texte simple à coller dans un e-mail, une note ou ton outil habituel. Rien n'est envoyé.</p>
      <label class="champ"><span class="sr-only">Compte rendu</span><textarea id="recap" rows="16" readonly>${esc(R.compteRendu(a, B))}</textarea></label>`,
    '<button class="btn primaire" type="button" data-action="copier">Copier</button><button class="btn" value="annuler">Fermer</button>');
  }

  async function copierRecap() {
    const zone = $('#recap');
    if (!zone) return;
    try { await navigator.clipboard.writeText(zone.value); toast('Compte rendu copié dans le presse-papiers.'); } catch { zone.select(); toast('Sélectionné : copie-le avec Ctrl+C (ou un appui long).'); }
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const anciens = R.aEffacer(E.appels, auj(), B.rgpd.conservationMois);
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Durée proposée pour un nouvel appel<select name="dureeDefaut">${B.durees.map((d) => `<option value="${d}" ${d === E.reglages.dureeDefaut ? 'selected' : ''}>${duree(d)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Données des prospects</h3><p class="aide">${esc(B.rgpd.texte)}</p><p class="mention">${esc(B.rgpd.source)}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="purger" ${anciens.length ? '' : 'disabled'}>${anciens.length ? `Effacer ${pluriel(anciens.length, 'appel clos', 'appels clos')} depuis plus de 3 ans` : 'Aucun appel clos depuis plus de 3 ans'}</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes appels sont enregistrés en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, juste avant un appel.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Base intégrée (version ${B.version}) : ${B.phases.length} phases, ${BANQUE.length} questions, ${B.objections.length} objections types avec pistes de réponse, rédigées pour QME. Aucun envoi automatique, aucun lien vers un service externe : compte rendu à copier et résumé à imprimer.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.prenom = String(f.get('prenom') || '').trim();
      E.reglages.dureeDefaut = Number(f.get('dureeDefaut')) || 30;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.appels)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.appels.length, 'appel')}) ?`)) return;
        E = normaliser(d); delete E.majLe; courantId = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du préparateur.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `appels-decouverte-${auj()}.json`);

  // ---------- Impression (résumé et préparation, impression → PDF) ----------
  function imprimer(html) {
    $('#impression').innerHTML = html;
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  const enTeteImpression = (a, titre) => `<header class="imp-tete"><p>${titre} · QME</p><h1>${esc(a.organisation)}</h1>
    <p>${esc(interlocuteur(a))}${a.secteur ? ` · ${esc(a.secteur)}` : ''}${a.taille ? ` · ${esc(nomTaille(a.taille))}` : ''}</p>
    <p>${dateLongue(a.date)}${a.heure ? ` à ${heureTexte(a.heure)}` : ''} · ${duree(a.duree)} · ${nomCanal(a.canal)}</p>
    ${a.objectif ? `<p><b>Objectif :</b> ${esc(a.objectif)}</p>` : ''}</header>`;

  function htmlResume(a) {
    const q = R.qualification(a.signaux);
    const rep = a.questions.filter((x) => x.posee && x.reponse.trim());
    return `${enTeteImpression(a, 'Résumé d\'appel découverte')}
      <section><h2>Qualification : ${q.total}/8, ${B.niveauxQualif[q.niveau].nom.toLowerCase()}</h2>
        <table><tbody>${B.signaux.map((s) => `<tr><th>${s.nom}</th><td>${esc(s.niveaux[q.niveaux[s.id]])}</td><td>${esc(a.signaux[s.id].note)}</td></tr>`).join('')}</tbody></table></section>
      ${a.synthese.trim() ? `<section><h2>Synthèse</h2><p>${esc(a.synthese)}</p></section>` : ''}
      <section><h2>Prochaine étape</h2><p>${a.prochaine.texte.trim() ? `${esc(a.prochaine.texte)}${a.prochaine.date ? `, le ${dateLongue(a.prochaine.date)}` : ', date à fixer'}${a.prochaine.faite ? ' (faite)' : ''}` : 'À définir'}</p></section>
      ${rep.length ? `<section><h2>Ce que nous avons appris</h2>${R.parPhase(rep, B.phases).map((g) => `<h3>${esc(g.phase.nom)}</h3><dl>${g.questions.map((x) => `<dt>${esc(x.texte)}</dt><dd>${esc(x.reponse)}</dd>`).join('')}</dl>`).join('')}</section>` : ''}
      ${a.hypotheses.length ? `<section><h2>Hypothèses</h2><ul>${a.hypotheses.map((h) => `<li>${esc(h.texte)} : ${LIB_HYP[h.resultat].toLowerCase()}</li>`).join('')}</ul></section>` : ''}
      ${a.objections.length ? `<section><h2>Objections entendues</h2><ul>${a.objections.map((o) => `<li>${esc(o.texte)}${o.note ? ` ${esc(o.note)}` : ''}</li>`).join('')}</ul></section>` : ''}
      ${a.notes.trim() ? `<section><h2>Notes</h2><p>${esc(a.notes)}</p></section>` : ''}
      <p class="imp-pied">Préparateur d'appel découverte QME · données minimales, à effacer quand elles ne sont plus utiles.</p>`;
  }

  function htmlPreparation(a) {
    const p = R.plan(a.questions, a.duree, B.phases);
    const lignes = new Map(p.phases.map((l) => [l.phase, l]));
    return `${enTeteImpression(a, 'Préparation d\'appel découverte')}
      ${a.hypotheses.length ? `<section><h2>Hypothèses à vérifier</h2><ul class="imp-cases">${a.hypotheses.map((h) => `<li>${esc(h.texte)}</li>`).join('')}</ul></section>` : ''}
      <section><h2>Plan minuté · ${duree(a.duree)}</h2>${p.phases.length ? `<table><tbody>${p.phases.map((l) => `<tr><th>${esc(l.nom)}</th><td>${l.debut}–${l.fin} min</td><td>${pluriel(l.nb, 'question')}</td></tr>`).join('')}</tbody></table>` : '<p>Aucune question retenue.</p>'}</section>
      ${R.parPhase(a.questions, B.phases).map((g) => `<section><h2>${esc(g.phase.nom)} <small>${lignes.get(g.phase.id) ? `${lignes.get(g.phase.id).debut}–${lignes.get(g.phase.id).fin} min` : ''}</small></h2><ol class="imp-questions">${g.questions.map((x) => `<li><span>${esc(x.texte)}</span><i></i></li>`).join('')}</ol></section>`).join('')}
      <section><h2>Signaux</h2><table><tbody>${B.signaux.map((s) => `<tr><th>${s.nom}</th><td>□ Non  □ Partiel  □ Oui</td><td class="imp-ligne"></td></tr>`).join('')}</tbody></table></section>
      <section><h2>Prochaine étape</h2><p class="imp-ligne">Quoi :</p><p class="imp-ligne">Quand :</p></section>`;
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
  function ajouterQuestions(a, liste) {
    let n = 0;
    for (const q of liste) {
      const avant = a.questions.length;
      a.questions = R.ajouterQuestion(a.questions, q, uid());
      n += a.questions.length - avant;
    }
    return n;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const a = id ? appel(id) : courant();
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); courantId = null; cache(); changerVue('appels'); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(true); break;
      case 'accueil-sans': terminerAccueil(false); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'aller': if (modale().open) modale().close(); changerVue(el.dataset.vue, id); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'copier': copierRecap(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau': modaleFiche(null); break;
      case 'fiche': modaleFiche(id); break;
      case 'phase-banque': filtre.phaseBanque = el.dataset.phase; rendre(); break;
      case 'onglet-banque': filtre.ongletBanque = el.dataset.onglet; rendre(); break;
      case 'q-ajout': { if (!a) break; const b = deBanque(el.dataset.ref); retenir(); ajouterQuestions(a, [{ ref: b.id, texte: b.texte, phase: b.phase }]); sauver(); rendre(); break; }
      case 'q-ajout-mienne': { if (!courant()) break; const m = E.mesQuestions.find((x) => x.id === id); if (!m) break; const c = courant(); retenir(); ajouterQuestions(c, [{ texte: m.texte, phase: m.phase }]); sauver(); rendre(); break; }
      case 'essentielles': { if (!a) break; retenir(); const n = ajouterQuestions(a, BANQUE.filter((q) => q.essentielle).map((q) => ({ ref: q.id, texte: q.texte, phase: q.phase }))); sauver(); rendre(); toast(`${pluriel(n, 'question essentielle ajoutée', 'questions essentielles ajoutées')} : retire celles qui ne servent pas.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'q-haut': case 'q-bas': { const c = courant(); if (!c) break; c.questions = R.deplacer(c.questions, id, action === 'q-haut' ? -1 : 1); sauver(); rendre(); break; }
      case 'q-suppr': { const c = courant(); if (!c) break; const q = c.questions.find((x) => x.id === id); retenir(); c.questions = c.questions.filter((x) => x.id !== id); sauver(); rendre(); toast(`Question retirée${q?.reponse ? ' (avec sa réponse)' : ''}.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'hyp-ajout': { const c = courant(); if (!c) break; c.hypotheses.push({ id: uid(), texte: '', resultat: 'a-verifier' }); sauver(); rendre(); const champs = document.querySelectorAll('[data-champ=hyp]'); champs[champs.length - 1]?.focus(); break; }
      case 'hyp-suppr': { const c = courant(); if (!c) break; retenir(); c.hypotheses = c.hypotheses.filter((h) => h.id !== id); sauver(); rendre(); toast('Hypothèse retirée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'mienne-suppr': retenir(); E.mesQuestions = E.mesQuestions.filter((x) => x.id !== id); sauver(); rendre(); toast('Question retirée de tes questions (les appels qui l\'utilisent la gardent).', { libelle: 'Annuler', faire: annuler }); break;
      case 'chrono-go': { const c = courant(); if (!c) break; c.chronoDebut = Date.now(); sauver(); rendre(); break; }
      case 'chrono-zero': { const c = courant(); if (!c) break; c.chronoDebut = null; sauver(); rendre(); break; }
      case 'objections': modaleObjections(); break;
      case 'obj-noter': { const c = courant(); const o = objectionBase(el.dataset.ref); if (!c || !o) break; if (!c.objections.some((x) => x.ref === o.id)) c.objections.push({ id: uid(), ref: o.id, texte: o.texte, note: '' }); sauver(); el.textContent = 'Notée'; el.disabled = true; const z = $('#objections-entendues'); if (z) z.innerHTML = blocObjectionsEntendues(c); break; }
      case 'obj-suppr': { const c = courant(); if (!c) break; retenir(); c.objections = c.objections.filter((x) => x.id !== id); sauver(); const z = $('#objections-entendues'); if (z) z.innerHTML = blocObjectionsEntendues(c); toast('Objection retirée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'terminer': { const c = courant(); if (c) modaleTerminer(c); break; }
      case 'marquer-fait': if (a) { retenir(); a.statut = 'fait'; a.chronoDebut = null; sauver(); rendre(); toast('Appel marqué fait.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'etape-faite': if (a) { retenir(); a.prochaine.faite = true; sauver(); rendre(); toast(`Étape faite : « ${a.prochaine.texte} ». Pense à fixer la suivante.`, { libelle: 'Annuler', faire: annuler }); } break;
      case 'etape-reporter': if (a) { retenir(); a.prochaine.date = ajout(auj(), 7); sauver(); rendre(); toast(`Étape reportée au ${dateLongue(a.prochaine.date, { annee: false })}.`, { libelle: 'Annuler', faire: annuler }); } break;
      case 'etape-dans': { const c = courant(); if (!c) break; c.prochaine.date = ajout(auj(), Number(el.dataset.n)); sauver(); rendre(); break; }
      case 'compte-rendu': { const c = courant(); if (c) modaleCompteRendu(c); break; }
      case 'imprimer-resume': { const c = courant(); if (c) imprimer(htmlResume(c)); break; }
      case 'imprimer-prep': { const c = courant(); if (c) imprimer(htmlPreparation(c)); break; }
      case 'effacer-prenom': if (a) { retenir(); a.prenom = ''; sauver(); rendre(); toast('Prénom effacé.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'supprimer': if (a && confirm(`Supprimer l'appel « ${a.organisation} » et toutes ses notes ?`)) { retenir(); E.appels = E.appels.filter((x) => x.id !== a.id); courantId = null; sauver(); changerVue('appels'); toast('Appel supprimé.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'purger': {
        const anciens = R.aEffacer(E.appels, auj(), B.rgpd.conservationMois);
        if (!anciens.length || !confirm(`Effacer définitivement ${pluriel(anciens.length, 'appel clos', 'appels clos')} depuis plus de 3 ans ?`)) break;
        retenir();
        const ids = new Set(anciens.map((x) => x.id));
        E.appels = E.appels.filter((x) => !ids.has(x.id));
        modale().close(); sauver(); rendre(); toast(`${pluriel(anciens.length, 'appel effacé', 'appels effacés')}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      default: break;
    }
  });

  // Saisie libre : enregistrée au fil de la frappe, sans redessiner la vue (le focus reste en place).
  document.addEventListener('input', (e) => {
    const el = e.target;
    const champ = el.dataset?.champ;
    if (!champ || !E) return;
    const a = courant();
    if (!a) return;
    const v = el.value;
    if (champ === 'objectif') a.objectif = v.slice(0, 400);
    else if (champ === 'notes') a.notes = v.slice(0, 5000);
    else if (champ === 'synthese') a.synthese = v.slice(0, 3000);
    else if (champ === 'q-reponse') { const q = a.questions.find((x) => x.id === el.dataset.id); if (!q) return; q.reponse = v.slice(0, 2000); if (v.trim() && !q.posee) { q.posee = true; const c = document.querySelector(`[data-q-posee="${q.id}"]`); if (c) c.checked = true; el.closest('.q-carte')?.classList.add('posee'); majAvancement(a); } }
    else if (champ === 'hyp') { const h = a.hypotheses.find((x) => x.id === el.dataset.id); if (h) h.texte = v.slice(0, 200); }
    else if (champ === 'signal-note') a.signaux[el.dataset.k].note = v.slice(0, 200);
    else if (champ === 'obj-note') { const o = a.objections.find((x) => x.id === el.dataset.id); if (o) o.note = v.slice(0, 500); }
    else if (champ === 'etape-texte') a.prochaine.texte = v.slice(0, 200);
    else if (champ === 'etape-date') { a.prochaine.date = R.estDate(v) ? v : null; }
    else return;
    sauver();
  });

  const majAvancement = (a) => { const av = R.avancement(a.questions); const el = $('#avancement'); if (el) el.innerHTML = `<b>${av.posees}/${av.total}</b> posées`; };

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!E) return;
    const a = courant();
    if (!a) return;
    if (el.dataset.qPosee) {
      const q = a.questions.find((x) => x.id === el.dataset.qPosee);
      if (!q) return;
      q.posee = el.checked;
      el.closest('.q-carte')?.classList.toggle('posee', el.checked);
      majAvancement(a); sauver();
    } else if (el.dataset.signal) {
      a.signaux[el.dataset.signal].niveau = el.value;
      const lib = document.querySelector(`[data-lib-signal="${el.dataset.signal}"]`);
      if (lib) lib.textContent = signal(el.dataset.signal).niveaux[el.value];
      const s = $('#score-live'); if (s) s.innerHTML = scoreHtml(a);
      sauver();
    } else if (el.dataset.hypResultat) {
      const h = a.hypotheses.find((x) => x.id === el.dataset.hypResultat);
      if (h) { h.resultat = el.value; sauver(); }
    } else if (el.hasAttribute('data-etape-faite')) {
      a.prochaine.faite = el.checked; sauver(); rendre();
    } else if (el.dataset.champ === 'etape-date') {
      rendre();
    }
  });

  // Formulaires intégrés aux vues : question personnelle (Préparer) et question imprévue (En appel).
  document.addEventListener('submit', (e) => {
    const f = e.target;
    const type = f.dataset?.form;
    if (!type) return;
    e.preventDefault();
    const a = courant();
    if (!a) return;
    const d = new FormData(f);
    const texte = String(d.get('texte') || '').trim();
    if (!texte) { f.querySelector('[name=texte]').focus(); toast('Écris la question d\'abord.'); return; }
    const ph = B.phases.some((p) => p.id === d.get('phase')) ? d.get('phase') : 'situation';
    retenir();
    ajouterQuestions(a, [{ texte, phase: ph }]);
    if (type === 'imprevue') { const q = a.questions[a.questions.length - 1]; q.posee = true; }
    if (type === 'perso' && d.get('garder') && !E.mesQuestions.some((m) => m.texte === texte)) E.mesQuestions.push({ id: uid(), texte, phase: ph });
    if (type === 'perso') filtre.phaseBanque = ph;
    sauver(); rendre();
    toast(type === 'perso' ? `Question ajoutée en « ${phase(ph).nom} »${d.get('garder') ? ' et gardée dans tes questions' : ''}.` : 'Question ajoutée et cochée : note la réponse.', { libelle: 'Annuler', faire: annuler });
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !saisieEnCours()) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  window.addEventListener('afterprint', () => { $('#impression').innerHTML = ''; });

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
      const { statut, corps } = await appelApi('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
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
  window.__appel = { etat: () => E, regles: R };
  init();
})();
