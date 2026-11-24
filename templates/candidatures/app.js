// Suivi de candidatures QME : une fiche par candidature avec ses pièces à fournir, ses dates (saisies : aucun
// calendrier officiel intégré), son statut et sa réponse ; relances proposées avec message à copier ; échéances,
// calendrier, impressions, CSV et .ics. Trois modèles au démarrage, vocabulaire et onglets adaptés :
// - Études et stages : formations, stages, alternance, jobs ; vœux classés ; lettres et entretiens ;
// - Emploi : offres et candidatures spontanées ; préférences ; lettres et entretiens ;
// - Appels d'offres et plateformes : veille et grille go/no-go, dossier pièce par pièce (rétroplanning, responsable,
//   bibliothèque de pièces réutilisables avec validité), dépôt, relances, résultat, temps passé et bilan.
// Fusion du 22/11/2026 des templates CAN et CND (rationalisation F3). Données synchronisées par clé de licence ou
// code d'accès. Aucune plateforme de candidature ni profil d'acheteur connecté ni nommé.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CAN;
  const API = '/api/templates';
  const PRODUIT = 'CAN';
  const CLE_CODE = 'qme-can-code';
  const CLE_CACHE = 'qme-can-cache';
  const CLE_DEMO = 'qme-can-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-can-ecran-accueil';
  const NOM = 'Suivi de candidatures';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const { pluriel, ajout, versDate } = R;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const fmt = (s, o) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' }).replace('.', '');
  const dateJour = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  const moisAn = (s) => { const t = fmt(`${s}-01`, { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
  const euros = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '–' : `${Math.round(Number(n)).toLocaleString('fr-FR')} €`);
  const heures = (h) => (h === null || h === undefined ? '–' : `${String(h).replace('.', ',')} h`);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- Vocabulaire selon le modèle ----------
  const U = () => R.usageDe(B, E?.usage);
  const M = () => U().mots;
  const typeDe = (id) => R.typeDe(B, id) || B.types[0];
  const famille = (c) => typeDe(c.type).famille;
  const estOffre = (c) => famille(c) === 'offres';
  const typesUsage = () => U().types.map(typeDe);
  const nomType = (id) => typeDe(id).nom;
  const nomStatut = (c, court = false) => R.nomStatut(B, c.statut, famille(c), court);
  const statutsFamille = (fam) => R.statutsDe(B, fam).map((id) => ({ id, nom: R.nomStatut(B, id, fam), court: R.nomStatut(B, id, fam, true) }));
  const nomStatutPiece = (id) => (B.statutsPiece.find((s) => s.id === id) || B.statutsPiece[0]).nom;
  const nomCanal = (id) => (B.canaux.find((c) => c.id === id) || B.canaux[0]).nom;
  const nomFormat = (id) => (B.formatsEntretien.find((f) => f.id === id) || B.formatsEntretien[0]).nom;
  const nomMotif = (id) => B.motifsPerte.find((m) => m.id === id)?.nom || '';
  const typePiece = (id) => B.typesPieces.find((t) => t.id === id) || B.typesPieces[B.typesPieces.length - 1];
  const pillType = (id) => `<span class="type type-${esc(typeDe(id).id)}">${esc(nomType(id))}</span>`;
  const pillStatut = (c) => `<span class="statut statut-${esc(c.statut)}">${esc(nomStatut(c))}</span>`;
  const NATURES = { limite: 'Date limite', depot: 'Dépôt visé', piece: 'Pièce à préparer', questions: 'Dernier jour pour les questions', decision: 'Décision go/no-go', entretien: 'Entretien ou épreuve', reponse: 'Réponse attendue', relance: 'Relance', validite: 'Fin de validité de l\'offre' };
  function nomNature(e) {
    if (e.nature === 'relance') return e.raison === 'remerciement' ? 'Remercier après l\'entretien' : e.raison === 'prevue' ? 'Relance prévue' : 'Relance proposée';
    if (e.nature === 'entretien' && estOffre(e.cand)) return 'Audition ou soutenance';
    if (e.nature === 'entretien' && e.cand.type !== 'formation') return 'Entretien';
    if (e.nature === 'piece') return e.pieces && e.pieces.length > 1 ? `${e.pieces.length} pièces à préparer` : `Pièce : ${(e.pieces?.[0] || e.piece).nom}`;
    return NATURES[e.nature];
  }
  const titreCand = (c) => c.organisme || c.intitule || 'Candidature';
  const ctxCsv = () => ({ nomType, nomStatut: (c) => nomStatut(c), offres: E.candidatures.some(estOffre), criteres: E.criteres, nomMotif });
  const cand = (id) => E.candidatures.find((c) => c.id === id) || null;
  const seuils = () => ({ go: E.reglages.seuilGo, discuter: E.reglages.seuilDiscuter });
  const score = (c) => R.scoreGrille(E.criteres, c.grille || {}, seuils());
  const evsDe = (c) => R.evenementsDe(c, auj(), E.reglages, B, E.biblio);
  const tousEvs = (liste, extra = {}) => R.evenements(liste, auj(), E.reglages, { base: B, biblio: E.biblio, ...extra });
  const avertissement = () => (B.avertissements[E.usage] || B.avertissement);
  const piecesGo = (c) => R.piecesDuDossier(E.dossiers, B, c.type, E.profil.prenom);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let sel = null; // candidature ouverte (onglet Candidatures) ou préparée (onglet Préparer)
  let sousVue = 'lettre';
  const filtre = { statut: 'actives', type: 'tous', q: '', nature: 'toutes' };
  let periode = '365';
  let mois = null, jourChoisi = null;
  let annulation = null;

  // tutorielVu (guide « Comment ça marche » déjà vu) : propre à l'application, réinjecté après la normalisation.
  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, B), tutorielVu: !!d?.tutorielVu });

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
        const vu = E.tutorielVu;
        E = normaliser(corps.donnees);
        if (vu) E.tutorielVu = true;
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié tes candidatures entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
        if (!modale().open && !saisieEnCours()) rendre();
      }
    } catch { majSync('horsligne'); }
  }
  const saisieEnCours = () => { const a = document.activeElement; return Boolean(a && a.closest && a.closest('#vue') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };

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
  // Code interne (CAN-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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

  // Démo : un jeu d'exemple par modèle (?demo, ?demo=emploi, ?demo=offres, ou le choix du bandeau).
  function ouvrirDemo(memoriser = true, usage = null) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const gardee = stock.lire(CLE_DEMO);
    E = gardee && (!usage || gardee.usage === usage) ? normaliser(gardee) : donneesDemo(usage || 'etudes');
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
  // Personnes, établissements, entreprises et acheteurs inventés ; dates relatives à aujourd'hui, couvrant tous
  // les états visibles (date limite proche avec pièces manquantes, dépassée, entretien à venir, relance due, liste
  // d'attente, acceptation, refus, désistement ; pour les appels d'offres : veille, grille, rétroplanning en
  // retard, pièce à renouveler, dépôts, résultats sur un an).
  function donneesDemo(usage = 'etudes') {
    if (usage === 'emploi') return demoEmploi();
    if (usage === 'offres') return demoOffres();
    return demoEtudes();
  }
  const P = (ref, statut, x = {}) => R.normaliserPiece({ ref, statut, ...x }, B);
  const Q = (ref, notes = '', prete = false) => R.normaliserQuestion({ ref, notes, prete }, B);

  // Noa, en troisième année de licence, prépare sa rentrée : quatre masters ou écoles, deux stages, deux
  // alternances, un job étudiant.
  function demoEtudes() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    e.usage = 'etudes';
    e.profil = { prenom: 'Noa', signature: 'Noa Lefèvre', campagne: 'Rentrée prochaine' };
    const C = (x) => R.normaliserCandidature({ id: uid(), creeLe: j(-40), ...x }, B);
    e.candidatures = [
      C({ type: 'formation', intitule: 'Master Économie de l\'environnement', organisme: 'Université de Sorvanne', ville: 'Lyon', statut: 'preparer', rang: 1,
        dates: { limite: j(5), reponse: j(60) }, lien: 'https://exemple.org/master-environnement',
        pieces: [P('cv', 'prete'), P('lm', 'encours'), P('releves', 'prete'), P('diplome', 'afaire', { precision: 'Attestation à demander au secrétariat de licence' }), P('reco', 'encours', { precision: 'Demandée à ma directrice d\'études' }), P('langue', 'prete'), P('identite', 'prete'), P('confirmation', 'afaire')],
        lettre: { trame: 'formation', champs: { situation: 'en troisième année de licence d\'économie', declic: 'un cours d\'économie publique consacré au prix du carbone', atout1: 'mes résultats en économétrie et mon mémoire sur les transports en commun', specificite: 'le projet tutoré mené avec une collectivité en deuxième année' } },
        note: 'Journée portes ouvertes en ligne vue : insister sur le projet tutoré.' }),
      C({ type: 'formation', intitule: 'École de commerce, admission sur titre en master', organisme: 'École Halbrane', ville: 'Rennes', statut: 'entretien', rang: 2,
        dates: { limite: j(-25), envoi: j(-27), entretien: j(3), heure: '10:30', reponse: j(24) },
        pieces: [P('formulaire', 'envoyee'), P('cv', 'envoyee'), P('lm', 'envoyee'), P('releves', 'envoyee'), P('reco', 'envoyee'), P('frais', 'envoyee', { precision: 'Payés en ligne' }), P('epreuves', 'envoyee', { precision: 'Test écrit passé' }), P('confirmation', 'afaire')],
        entretien: { format: 'visio', lieu: 'Lien envoyé par e-mail la veille', notes: 'Vingt minutes devant deux personnes. Préparer un exemple de travail en équipe.',
          questions: [Q('pres1', 'Licence d\'économie, mémoire sur les transports, job à la médiathèque. Je cherche une formation tournée vers les entreprises.', true), Q('mot1', 'Les projets avec des entreprises partenaires dès le premier semestre, et le parcours finance durable.', true), Q('par4', 'Projet de groupe sur le budget participatif : j\'ai repris le planning quand le groupe a pris du retard.'), Q('qua2'), Q('pos4')] },
        note: '' }),
      C({ type: 'formation', intitule: 'Master Économie appliquée', organisme: 'Institut Kerval', ville: 'Nantes', statut: 'envoyee', rang: 3,
        dates: { limite: j(-18), envoi: j(-20), reponse: j(40) },
        pieces: [P('cv', 'envoyee'), P('lm', 'envoyee'), P('releves', 'envoyee'), P('diplome', 'envoyee'), P('reco', 'envoyee'), P('confirmation', 'afaire')] }),
      C({ type: 'formation', intitule: 'Master Finance durable', organisme: 'Université de Valmont', ville: 'Lille', statut: 'preparer', rang: 4,
        dates: { limite: j(-2) },
        pieces: [P('cv', 'prete'), P('lm', 'afaire'), P('releves', 'prete'), P('reco', 'afaire')],
        note: 'Date limite passée : écrire au secrétariat pour savoir si une seconde session est prévue.' }),
      C({ type: 'formation', intitule: 'Licence professionnelle gestion de projet', organisme: 'Institut Belcourt', ville: 'Tours', statut: 'retiree',
        dates: { limite: j(-35), envoi: j(-36) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee')], motif: 'Je préfère poursuivre en master.' }),
      C({ type: 'stage', intitule: 'Stage analyste données, 6 mois', organisme: 'Ardelis Conseil', ville: 'Lyon', contact: 'Responsable du recrutement des stagiaires', statut: 'envoyee', rang: 1,
        dates: { envoi: j(-15) },
        pieces: [P('cv', 'envoyee'), P('lm', 'envoyee'), P('releves', 'envoyee'), P('responsabilite', 'afaire'), P('convention', 'afaire')],
        lettre: { trame: 'stage', champs: { situation: 'en troisième année de licence d\'économie', periode: 'de six mois à partir de février', interet: 'vos études pour les collectivités sur la mobilité', competence: 'la préparation de données publiques, menée pour mon mémoire', apprendre: 'la conduite d\'une étude de bout en bout' } } }),
      C({ type: 'stage', intitule: 'Stage chargé d\'études économiques', organisme: 'Novétra Études', ville: 'Paris', statut: 'refusee',
        dates: { envoi: j(-30), recue: j(-9) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee')], motif: 'Profil plus avancé dans ses études retenu.' }),
      C({ type: 'alternance', intitule: 'Chargé de projet RSE en alternance', organisme: 'Maison Galvan', ville: 'Villeurbanne', statut: 'attente', rang: 1,
        dates: { envoi: j(-28), entretien: j(-12), heure: '14:00', recue: j(-3), reponse: j(12) },
        pieces: [P('cv', 'envoyee'), P('lm', 'envoyee'), P('inscription', 'encours', { precision: 'Admission en master en attente' }), P('rythme', 'prete'), P('contrat', 'afaire')],
        relances: [{ date: j(-11), canal: 'email', note: 'Remerciement après l\'entretien' }],
        note: 'Deuxième sur la liste : réponse promise sous deux semaines.' }),
      C({ type: 'alternance', intitule: 'Assistant contrôle de gestion en alternance', organisme: 'Brévol Industrie', ville: 'Grenoble', statut: 'preparer', rang: 2,
        dates: { limite: j(26) },
        pieces: [P('cv', 'prete'), P('lm', 'afaire'), P('inscription', 'afaire'), P('rythme', 'afaire'), P('releves', 'prete'), P('contrat', 'afaire')] }),
      C({ type: 'job', intitule: 'Agent d\'accueil, week-ends', organisme: 'Médiathèque des Tilleuls', ville: 'Lyon', statut: 'acceptee', rang: 1,
        dates: { envoi: j(-21), entretien: j(-10), heure: '17:00', recue: j(-6) },
        pieces: [P('cv', 'envoyee'), P('disponibilites', 'envoyee'), P('references', 'envoyee')],
        note: 'Début le premier samedi du mois prochain.' }),
    ];
    return e;
  }

  // Camille cherche un nouveau poste de chargée de communication : offres et candidatures spontanées.
  function demoEmploi() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    e.usage = 'emploi';
    e.profil = { prenom: 'Camille', signature: 'Camille Durand', campagne: 'Nouveau poste au printemps' };
    const C = (x) => R.normaliserCandidature({ id: uid(), creeLe: j(-30), ...x }, B);
    e.candidatures = [
      C({ type: 'offre', intitule: 'Chargée de communication, CDI', organisme: 'Atelier Norval', ville: 'Lyon', contact: 'Responsable des ressources humaines', statut: 'entretien', rang: 1,
        dates: { envoi: j(-12), entretien: j(2), heure: '14:30' },
        pieces: [P('cv', 'envoyee'), P('lm', 'envoyee'), P('references', 'envoyee'), P('pretentions', 'envoyee', { precision: 'Fourchette indiquée dans le message' })],
        entretien: { format: 'presentiel', lieu: 'Siège, 3e étage', notes: 'Entretien avec la directrice de la communication et la responsable RH. Apporter deux exemples de campagnes.',
          questions: [Q('pres1', 'Quatre ans en agence, refonte de sites, campagnes pour des collectivités. Je cherche à travailler chez l\'annonceur.', true), Q('emp1', 'Envie de suivre une marque dans la durée, plutôt que de passer d\'un client à l\'autre.', true), Q('emp2'), Q('mot2'), Q('pos4')] },
        lettre: { trame: 'offre', champs: { situation: 'chargée de communication depuis quatre ans dans une agence de conseil', annonce: 'votre annonce publiée sur votre site', realisation: 'la refonte du site d\'un client, qui a doublé ses demandes de contact en six mois', interet: 'vos projets auprès des collectivités', apport: 'une méthode de planification des campagnes' } } }),
      C({ type: 'offre', intitule: 'Responsable communication digitale', organisme: 'Groupe Ombrelle', ville: 'Villeurbanne', statut: 'envoyee', rang: 2,
        dates: { envoi: j(-16) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee'), P('references', 'envoyee')] }),
      C({ type: 'offre', intitule: 'Chargée de projets éditoriaux', organisme: 'Éditions du Pertuis', ville: 'Lyon', statut: 'preparer', rang: 3,
        dates: { limite: j(4) }, lien: 'https://exemple.org/offre-projets-editoriaux',
        pieces: [P('cv', 'prete'), P('lm', 'encours'), P('references', 'afaire', { precision: 'Demander l\'accord de mon ancienne responsable' }), P('diplome', 'prete'), P('pretentions', 'afaire')],
        note: 'Offre vue sur le site de l\'éditeur ; poste à pourvoir en mars.' }),
      C({ type: 'spontanee', intitule: 'Chargée de communication', organisme: 'Coopérative des Terres Hautes', ville: 'Clermont-Ferrand', statut: 'envoyee', rang: 1,
        dates: { envoi: j(-5) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee')] }),
      C({ type: 'offre', intitule: 'Chargée de communication institutionnelle', organisme: 'Ville de Brennac', ville: 'Brennac', statut: 'envoyee', rang: 4,
        dates: { envoi: j(-30), reponse: j(-2) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee'), P('diplome', 'envoyee')],
        note: 'Réponse annoncée pour la fin du mois dernier.' }),
      C({ type: 'spontanee', intitule: 'Communication interne', organisme: 'Mutuelle Saint-Clair', ville: 'Lyon', statut: 'preparer',
        pieces: [P('cv', 'prete'), P('lm', 'afaire')], note: 'Rencontré leur responsable communication à un salon : lui écrire directement.' }),
      C({ type: 'offre', intitule: 'Community manager', organisme: 'Studio Hublot', ville: 'Lyon', statut: 'refusee',
        dates: { envoi: j(-24), entretien: j(-14), recue: j(-8) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee')], motif: 'Candidate plus expérimentée sur les réseaux sociaux retenue.' }),
      C({ type: 'offre', intitule: 'Chef de projet événementiel', organisme: 'Agence Comète', ville: 'Annecy', statut: 'retiree',
        dates: { envoi: j(-20) }, pieces: [P('cv', 'envoyee'), P('lm', 'envoyee')], motif: 'Poste trop éloigné finalement.' }),
    ];
    return e;
  }

  // Alex, consultant indépendant en accompagnement du changement : veille, dossiers en cours, dépôts et un an de
  // résultats. Les transitions passent par les vraies règles (go, dépôt, relance, résultat).
  function demoOffres() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    e.usage = 'offres';
    e.profil = { prenom: 'Alex', signature: 'Alex Martin', campagne: '' };
    const bib = [
      ['reference', 'Accompagnement au changement · Ville de Marbelle', 'Dossier Références > marbelle.pdf', -300, null],
      ['reference', 'Formation des managers · Groupe Exemple Distribution', 'Dossier Références > exemple-distribution.pdf', -420, null],
      ['reference', 'Facilitation de séminaire · Association Horizon Formation', 'Dossier Références > horizon.pdf', -60, null],
      ['cv', 'CV Alex · consultant principal', 'Dossier CV > cv-alex.pdf', -40, null],
      ['cv', 'CV Sam · formatrice associée', 'Dossier CV > cv-sam.pdf', -90, null],
      ['assurance', 'Attestation d\'assurance responsabilité civile professionnelle', 'Dossier Administratif > assurance-rc-pro.pdf', -363, 2],
      ['attestation', 'Attestation de situation fiscale', 'Dossier Administratif > attestation-fiscale.pdf', -180, -3],
      ['attestation', 'Attestation de situation sociale', 'Dossier Administratif > attestation-sociale.pdf', -140, 40],
      ['immatriculation', 'Extrait d\'immatriculation', 'Dossier Administratif > extrait-immatriculation.pdf', -65, 25],
      ['certification', 'Certification qualité de l\'activité de formation', 'Dossier Administratif > certificat-qualite.pdf', -400, 330],
      ['presentation', 'Présentation du cabinet (2 pages)', 'Dossier Modèles > presentation-cabinet.docx', -30, null],
      ['methode', 'Note méthodologique type · conduite du changement', 'Dossier Modèles > methode-changement.docx', -75, null],
    ];
    e.biblio = bib.map(([ty, titre, reference, emis, valide], i) => R.normaliserBiblio({ id: `b${i + 1}`, type: ty, titre, reference, emisLe: j(emis), valideJusquau: valide === null ? null : j(valide) }, B));
    const note = (vals) => Object.fromEntries(e.criteres.map((k, i) => [k.id, vals[i]]));
    const base = (o) => R.normaliserCandidature({ id: uid(), type: 'public', source: B.sources[0], statut: 'reperee', ...o, dates: { heureLimite: '12:00', ...(o.dates || {}) } }, B);
    const go = (c, jour) => R.decider(c, 'go', { date: j(jour), pieces: R.piecesDuDossier(e.dossiers, B, c.type, 'Alex') });
    const liste = [];
    // Veille.
    liste.push(base({ intitule: 'Formation des encadrants à la conduite d\'entretiens', organisme: 'Agglomération de Brevenne', reference: 'FOR-118', creeLe: j(-2), dates: { limite: j(16), questions: j(8) }, montantEstime: 18000, grille: note([3, 2, 3, 3, 2, 2, 1, 2]), note: 'Trois sessions par an, deux ans reconductibles. Critères : 60 % valeur technique, 40 % prix.' }));
    liste.push(base({ intitule: 'Diagnostic organisationnel du service courrier', organisme: 'Syndicat des eaux du Lornec', reference: 'DIAG-04', creeLe: j(-1), dates: { limite: j(9) }, montantEstime: 9000, grille: note([2, 2, 1, 1, 2, 1, 1, 1]), note: 'Cahier des charges court, délai serré.' }));
    liste.push(base({ intitule: 'Accompagnement d\'une réorganisation commerciale (3 mois)', organisme: 'PME industrielle (via plateforme)', type: 'plateforme', source: 'Plateforme de freelances', creeLe: t, dates: { limite: j(3), heureLimite: '18:00' }, montantEstime: 21000 }));
    liste.push(base({ intitule: 'Refonte des processus achats', organisme: 'Coopérative agricole du Val Doré', type: 'prive', source: 'Réseau ou recommandation', creeLe: t, dates: { limite: j(30) }, montantEstime: 14000 }));
    liste.push(R.decider(base({ intitule: 'Assistance à maîtrise d\'ouvrage pour un logiciel RH', organisme: 'Centre hospitalier de Saint-Aubrac', reference: 'AMO-SIRH', creeLe: j(-24), dates: { limite: j(-6) }, montantEstime: 45000, grille: note([0, 1, 2, 0, 2, 1, 0, 1]) }), 'nogo', { date: j(-21), motif: 'Hors cœur de métier, aucune référence comparable.' }));
    // En préparation.
    let c = go(base({ intitule: 'Accompagnement au changement des services techniques', organisme: 'Ville de Valmorin', reference: 'STC-07', creeLe: j(-15), dates: { limite: j(4), questions: j(-3) }, montantEstime: 32000, grille: note([3, 3, 2, 3, 2, 2, 2, 2]), temps: 9.5, note: 'Visite facultative faite. Insister sur la co-construction avec les agents.' }), -12);
    const lier = { 'Attestations demandées (situation fiscale, sociale, assurance…)': 'b7', 'Extrait d\'immatriculation': 'b9', 'Références de prestations comparables': 'b1', 'CV des intervenants': 'b4', 'Mémoire technique (compréhension, méthode, planning, moyens)': 'b12' };
    const resp = ['Alex', 'Alex', 'Alex', 'Sam', 'Sam', 'Alex', 'Sam', 'Alex', 'Alex', 'Alex', 'Alex'];
    c.pieces.forEach((p, i) => { p.responsable = resp[i] || ''; p.biblio = lier[p.nom] || null; p.statut = i < 3 ? 'prete' : i === 3 ? 'encours' : i === 7 ? 'encours' : i === 4 || i === 6 ? 'prete' : 'afaire'; });
    c.pieces.push(R.normaliserPiece({ nom: 'Attestation d\'assurance responsabilité civile', delai: 4, type: 'assurance', statut: 'prete', responsable: 'Alex', biblio: 'b6' }, B));
    liste.push(c);
    c = go(base({ intitule: 'Formation au management de proximité (3 sessions)', organisme: 'Groupe hôtelier Exemple', type: 'prive', source: 'Alerte par e-mail', creeLe: j(-6), dates: { limite: j(12) }, montantEstime: 12500, grille: note([3, 2, 3, 2, 2, 2, 1, 1]), temps: 3 }), -4);
    c.pieces.forEach((p, i) => { p.statut = i < 2 ? 'prete' : 'afaire'; p.responsable = i % 3 === 2 ? 'Sam' : 'Alex'; if (p.type === 'reference') p.biblio = 'b2'; if (p.type === 'cv') p.biblio = 'b5'; if (p.type === 'presentation') p.biblio = 'b11'; });
    liste.push(c);
    c = go(base({ intitule: 'Audit des rituels d\'équipe d\'une jeune entreprise (10 jours)', organisme: 'Client via plateforme', type: 'plateforme', source: 'Plateforme de freelances', creeLe: t, dates: { limite: j(1), heureLimite: '20:00' }, montantEstime: 6500, temps: 1 }), 0);
    c.pieces.forEach((p, i) => { p.statut = i === 0 ? 'prete' : 'afaire'; });
    liste.push(c);
    // Déposées.
    const deposee = (o, decision, depot, extra = {}) => R.deposer(go(base(o), decision), { date: j(depot), montantOffre: extra.offre, valable: extra.valable ? j(extra.valable) : null });
    liste.push(deposee({ intitule: 'Animation d\'ateliers participatifs sur le projet de territoire', organisme: 'Communauté de communes du Haut-Lizan', reference: 'PT-02', creeLe: j(-62), dates: { limite: j(-35) }, montantEstime: 26000, temps: 14 }, -55, -36, { offre: 24500, valable: 55 }));
    liste.push(deposee({ intitule: 'Facilitation d\'un séminaire de direction', organisme: 'Client via plateforme', type: 'plateforme', source: 'Plateforme de freelances', creeLe: j(-6), dates: { limite: j(-5) }, montantEstime: 3500, temps: 1.5 }, -6, -5, { offre: 3200 }));
    liste.push(deposee({ intitule: 'Cartographie des compétences d\'une équipe support', organisme: 'Mutuelle Exemple Santé', type: 'prive', source: 'Client existant', creeLe: j(-20), dates: { limite: j(-10) }, montantEstime: 10000, temps: 6 }, -18, -10, { offre: 9800 }));
    // Relance déjà faite sur le dossier en attente le plus ancien ; la suivante, fixée à la main, est en retard.
    liste[8] = R.noterRelance(liste[8], { date: j(-6), note: 'Appel au service de la commande publique : analyse en cours.' });
    liste[8].dates.relancer = j(-2);
    // Résultats connus (historique sur un an).
    const hist = [
      ['Formation à la prévention des risques psychosociaux pour l\'encadrement', 'Département fictif de Valrive', 'public', -150, -120, -80, 'acceptee', { montantObtenu: 21000 }, 16, 23000],
      ['Mission de facilitation agile (20 jours)', 'Client via plateforme', 'plateforme', -75, -70, -60, 'acceptee', { montantObtenu: 6400 }, 2, 6400],
      ['Atelier de cohésion d\'équipe', 'Cabinet d\'architectes Exemple', 'directe', -215, -205, -195, 'acceptee', { montantObtenu: 4800 }, 4, 4800],
      ['Accompagnement d\'une fusion de services', 'Ville de Brecourt-sur-Lane', 'public', -190, -160, -110, 'refusee', { motifPerte: 'prix', place: 2 }, 12, 28000],
      ['Plan de formation des managers', 'Groupe Exemple Logistique', 'prive', -125, -100, -88, 'refusee', { motifPerte: 'references' }, 8, 15000],
      ['Coaching d\'équipe de direction', 'Client via plateforme', 'plateforme', -50, -45, -30, 'refusee', { motifPerte: 'inconnu' }, 1, 5200],
      ['Étude d\'organisation des accueils', 'Syndicat intercommunal de la Vèze', 'public', -230, -200, -150, 'sanssuite', {}, 10, 19000],
      ['Conduite du changement d\'un projet numérique', 'Office public de l\'habitat Exemple', 'public', -330, -290, -250, 'refusee', { motifPerte: 'technique', place: 3 }, 15, 31000],
      ['Parcours de formation des nouveaux managers', 'Clinique des Tilleuls', 'prive', -345, -320, -300, 'acceptee', { montantObtenu: 15600 }, 9, 16200],
    ];
    for (const [intitule, organisme, ty, rep, dep, res, st, r, temps, offre] of hist) {
      let x = go(base({ intitule, organisme, type: ty, source: ty === 'plateforme' ? 'Plateforme de freelances' : B.sources[0], creeLe: j(rep), dates: { limite: j(dep) }, montantEstime: offre, temps }), rep + 2);
      x = R.deposer(x, { date: j(dep), montantOffre: offre });
      const relanceType = typeDe(ty).relance;
      if (res - dep > 25) x = R.noterRelance(x, { date: j(dep + relanceType), note: 'Relance par e-mail : résultat attendu sous trois semaines.' });
      liste.push(R.cloturer(x, st, { date: j(res), ...r }));
    }
    liste.push(R.decider(base({ intitule: 'Développement d\'une application mobile de réservation', organisme: 'Client via plateforme', type: 'plateforme', source: 'Plateforme de freelances', creeLe: j(-100), dates: { limite: j(-95) }, montantEstime: 15000, grille: note([0, 2, 2, 0, 2, 1, 0, 0]) }), 'nogo', { date: j(-99), motif: 'Hors cœur de métier.' }));
    liste.push(R.decider(base({ intitule: 'Schéma directeur de la formation (accord-cadre 4 ans)', organisme: 'Région fictive d\'Ostrevie', creeLe: j(-140), dates: { limite: j(-118) }, montantEstime: 90000, grille: note([2, 0, 1, 1, 2, 1, 0, 2]) }), 'nogo', { date: j(-136), motif: 'Volume trop important pour une structure seule ; à revoir en groupement.' }));
    let ab = go(base({ intitule: 'Diagnostic qualité de vie au travail', organisme: 'Association Exemple Insertion', type: 'prive', creeLe: j(-80), dates: { limite: j(-66) }, montantEstime: 8000, temps: 2 }), -78);
    ab = R.changerStatut(ab, 'retiree', j(-70)); ab.motif = 'Charge trop forte sur la période.';
    liste.push(ab);
    e.candidatures = liste;
    return e;
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
          <rect x="20" y="30" width="150" height="190" fill="#1D4E89"/>
          <rect x="44" y="64" width="100" height="10" fill="#F0EDE6"/>
          <rect x="44" y="92" width="70" height="10" fill="#F0EDE6"/>
          <rect x="190" y="30" width="150" height="190" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M190 280 L190 230 A50 50 0 0 1 240 280 Z" fill="#D9302A"/>
          <rect x="20" y="240" width="150" height="40" fill="#F5B400"/>
          <circle cx="450" cy="140" r="110" fill="#F0EDE6"/>
          <path d="M400 140 l34 34 l68 -68" fill="none" stroke="#141414" stroke-width="22"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi de candidatures</p>
          <h1>Chaque dossier, à temps.</h1>
          <p>Études et stages, emploi, appels d'offres et plateformes : les pièces à fournir, les dates que tu saisis, les réponses, les relances et le résultat.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes candidatures</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes candidatures sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes candidatures</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Exemples : <button type="button" class="btn lien" data-action="demo-modele" data-usage="etudes">études et stages</button> · <button type="button" class="btn lien" data-action="demo-modele" data-usage="emploi">emploi</button> · <button type="button" class="btn lien" data-action="demo-modele" data-usage="offres">appels d'offres</button></p>
        <p class="mention">Pas encore de clé ? <a href="/catalogue/candidatures/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes candidatures'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  // Étape 1 : le modèle (Études et stages, Emploi, Appels d'offres) et le profil ; étape 2 : la première fiche.
  const accueilVide = (usage = 'etudes') => ({ etape: 1, usage, prenom: '', signature: '', campagne: '', marge: 1, type: R.usageDe(B, usage).types[0], modele: R.modeleParDefaut(R.usageDe(B, usage).types[0]), intitule: '', organisme: '', limite: '' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const u = R.usageDe(B, a.usage);
    const offres = a.usage === 'offres';
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes candidatures, sans rien oublier.</h1>
        <p class="intro">Une fiche par candidature : les pièces à fournir, les dates que tu recopies, la réponse. L'application te dit quoi envoyer d'abord et qui relancer. Choisis d'abord ce que tu suis : le vocabulaire et les onglets s'adaptent (tu pourras changer dans les réglages).</p>
        <form id="form-accueil" novalidate>
          <fieldset class="choix-usages"><legend class="sr-only">Modèle</legend>${B.usages.map((x) => `<label class="choix-usage"><input type="radio" name="usage" value="${x.id}" ${x.id === a.usage ? 'checked' : ''}><span><b>${esc(x.nom)}</b><small>${esc(x.description)}</small></span></label>`).join('')}</fieldset>
          <div class="rang-champs" style="max-width:620px;margin-top:20px">
            <label class="champ">Ton prénom<small>${offres ? 'Responsable par défaut des pièces.' : 'Facultatif.'}</small><input name="prenom" maxlength="40" value="${esc(a.prenom)}" placeholder="Ex. : ${offres ? 'Alex' : 'Noa'}"></label>
            <label class="champ">Signature des ${offres ? 'messages' : 'lettres'}<small>Prénom et nom, facultatif.</small><input name="signature" maxlength="80" value="${esc(a.signature)}"></label>
          </div>
          ${offres ? `<label class="champ" style="max-width:420px;margin-top:12px">Marge de dépôt<small>Ton dépôt visé avant la date limite : un dépôt de dernière minute peut échouer (connexion, signature, fichier trop lourd).</small><select name="marge">${[[0, 'Le jour même'], [1, 'La veille (conseillé)'], [2, 'Deux jours avant']].map(([v, n]) => `<option value="${v}" ${v === a.marge ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
            : `<label class="champ" style="max-width:420px;margin-top:12px">Ta campagne<small>Facultatif : « Rentrée prochaine », « Nouveau poste au printemps »…</small><input name="campagne" maxlength="60" value="${esc(a.campagne)}"></label>`}
          <p class="erreur" role="alert"></p>
        </form>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const ty = typeDe(a.type);
      corps = `
        <p class="surtitre">Étape 2 · ${esc(u.nom)}</p>
        <h1>Ta première ${esc(u.mots.une)}</h1>
        <p class="intro">${offres ? 'Note une consultation repérée : la grille go/no-go t\'aidera à décider, puis le dossier se monte pièce par pièce. Tu peux aussi passer cette étape.' : 'Choisis le type et une liste de pièces de départ : tu l\'adapteras à ce que demande vraiment la formation ou le recruteur. Tu peux aussi passer cette étape.'}</p>
        <form id="form-premiere" class="carte-form" novalidate>
          <fieldset class="champ"><legend>Type</legend><div class="choix-statut ${u.types.length === 4 ? 'choix-4' : u.types.length === 2 ? 'choix-2' : ''}">${u.types.map(typeDe).map((t) => `<label><input type="radio" name="type" value="${t.id}" ${t.id === a.type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
          ${offres ? '' : `<label class="champ">Liste de pièces de départ<select name="modele">${optionsModeles(a.type, a.modele)}</select></label>`}
          <div class="rang-champs">
            <label class="champ">${esc(ty.intitule)}<input name="intitule" maxlength="160" value="${esc(a.intitule)}" placeholder="${esc(ty.exemple)}"></label>
            <label class="champ">${esc(ty.organisme)}<input name="organisme" maxlength="120" value="${esc(a.organisme)}"></label>
          </div>
          <label class="champ" style="max-width:280px">Date limite<small>${offres ? 'Celle du règlement ou de l\'annonce.' : 'Celle de l\'établissement ou de l\'offre, si elle existe.'}</small><input type="date" name="limite" value="${esc(a.limite)}"></label>
          <p class="erreur" role="alert"></p>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <span class="rang"><button class="btn" data-action="accueil-passer">Passer</button><button class="btn primaire" data-action="accueil-fin">Créer</button></span>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const f1 = $('#form-accueil');
    if (f1) f1.addEventListener('change', (ev) => { if (ev.target.name === 'usage') { lireAccueil1(); const u2 = R.usageDe(B, accueil.usage); accueil.type = u2.types[0]; accueil.modele = R.modeleParDefaut(accueil.type); ecranAccueil(); } });
    const f = $('#form-premiere');
    if (f) f.addEventListener('change', (ev) => { if (ev.target.name === 'type') { lireAccueil2(); accueil.modele = R.modeleParDefaut(accueil.type); ecranAccueil(); } });
  }
  function lireAccueil1() {
    const f = $('#form-accueil');
    if (!f) return;
    const v = (n) => f.querySelector(`[name=${n}]`);
    Object.assign(accueil, { usage: f.querySelector('[name=usage]:checked')?.value || 'etudes', prenom: v('prenom').value.trim(), signature: v('signature').value.trim(), campagne: v('campagne') ? v('campagne').value.trim() : accueil.campagne, marge: v('marge') ? Number(v('marge').value) : accueil.marge });
  }
  function lireAccueil2() {
    const f = $('#form-premiere');
    if (!f) return;
    Object.assign(accueil, { type: f.querySelector('[name=type]:checked')?.value || accueil.type, modele: f.querySelector('[name=modele]')?.value || accueil.modele, intitule: f.querySelector('[name=intitule]').value.trim(), organisme: f.querySelector('[name=organisme]').value.trim(), limite: f.querySelector('[name=limite]').value });
  }

  function accueilSuivant() {
    lireAccueil1();
    const s = [accueil.prenom, accueil.signature, accueil.campagne].map(R.contientSecret).find(Boolean);
    if (s) { $('#form-accueil .erreur').textContent = R.MESSAGES_SENSIBLES[s]; return; }
    accueil.etape = 2;
    ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil(creer) {
    if (creer) lireAccueil2();
    if (creer && !accueil.intitule && !accueil.organisme) { $('#form-premiere .erreur').textContent = 'Indique au moins l\'intitulé ou l\'organisme, ou passe cette étape.'; return; }
    E = etatVide();
    E.usage = accueil.usage;
    E.profil = { prenom: accueil.prenom, signature: accueil.signature, campagne: accueil.usage === 'offres' ? '' : accueil.campagne };
    E.reglages.marge = accueil.marge;
    let premiere = null;
    if (creer) {
      const offres = R.familleDe(B, accueil.type) === 'offres';
      premiere = R.normaliserCandidature({ id: uid(), type: accueil.type, intitule: accueil.intitule, organisme: accueil.organisme, statut: offres ? 'reperee' : 'preparer', dates: { limite: accueil.limite || null, heureLimite: offres ? '12:00' : '' }, pieces: offres ? [] : R.piecesDuModele(B, accueil.modele), creeLe: auj(), rang: offres ? null : 1 }, B);
      E.candidatures.push(premiere);
    }
    accueil = accueilVide();
    vue = premiere ? 'candidatures' : 'tableau'; sel = premiere?.id || null;
    sauver();
    demarrer();
    toast(premiere ? (premiere.statut === 'reperee' ? 'Consultation notée : remplis la grille go/no-go pour décider.' : 'Ta première candidature est créée : coche les pièces au fur et à mesure.') : 'C\'est prêt : ajoute ta première fiche.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    veille: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14.5 14.5 21 21" stroke="currentColor" stroke-width="3"/></svg>',
    candidatures: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    voeux: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="14" width="5" height="7" fill="currentColor"/><rect x="9.5" y="4" width="5" height="17" fill="currentColor"/><rect x="16" y="9" width="5" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    preparer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    bibliotheque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="18" fill="currentColor"/><rect x="10" y="3" width="5" height="18" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 4.5 21 3.5 23 20.5 19 21.5Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="currentColor"/><rect x="3" y="16" width="7" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    haut: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5 20 15H4Z" fill="currentColor"/></svg>',
    bas: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19 4 9h16Z" fill="currentColor"/></svg>',
  };
  // Onglets du modèle courant : [id, libellé long, libellé court (téléphone)].
  function onglets() {
    const m = M();
    const tous = { tableau: ['Tableau de bord', 'Accueil'], veille: ['Veille', 'Veille'], candidatures: [m.liste, m.court], voeux: [m.voeux, m.voeux], echeances: ['Échéances', 'Échéances'], preparer: ['Lettres et entretiens', 'Préparer'], bibliotheque: ['Pièces réutilisables', 'Pièces'], bilan: ['Bilan', 'Bilan'] };
    // Six onglets (appels d'offres) : libellés courts partout, pour tenir sur une ligne à 1280 px.
    return U().onglets.map((id) => (U().onglets.length > 5 ? [id, tous[id][1], tous[id][1]] : [id, ...tous[id]]));
  }
  const AVERTISSEMENT = () => `<p class="mention avertissement">${esc(avertissement())}</p>`;

  function demarrer() {
    document.body.classList.add('app');
    lireHash();
    const ong = onglets();
    $('#racine').innerHTML = `
      ${session.demo ? `<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d'exemple fictives, gardées sur cet appareil uniquement.</span><span class="demo-modeles" role="group" aria-label="Exemple affiché">Exemple :${B.usages.map((u) => `<button data-action="demo-modele" data-usage="${u.id}" aria-pressed="${u.id === E.usage}" title="${esc(u.nom)}">${esc({ etudes: 'Études', emploi: 'Emploi', offres: 'Appels d\'offres' }[u.id])}</button>`).join('')}</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J'ai un code d'accès</button></div></div>` : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi de<br>candidatures</span>
        <nav class="onglets" aria-label="Sections" style="--n:${ong.length}">${ong.map(([id, nom, court]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${esc(nom)}</span>${court !== nom ? `<span class="court">${esc(court)}</span>` : ''}</button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }
  function lireHash() {
    const [v, id] = location.hash.slice(1).split('/');
    if (onglets().some(([o]) => o === v)) { vue = v; sel = id && E?.candidatures.some((c) => c.id === id) ? id : (v === 'preparer' ? sel : null); }
    if (!onglets().some(([o]) => o === vue)) { vue = 'tableau'; sel = null; }
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    if (sel && !cand(sel)) sel = null;
    if (!onglets().some(([o]) => o === vue)) vue = 'tableau';
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(onglets().map(([id, nom]) => [id, nom]));
    document.title = `${vue === 'candidatures' && sel ? titreCand(cand(sel)) : titres[vue]} · ${NOM}`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, veille: vueVeille, candidatures: () => (sel ? vueFiche(cand(sel)) : vueListe()), voeux: vueVoeux, echeances: vueEcheances, preparer: vuePreparer, bibliotheque: vueBibliotheque, bilan: vueBilan }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    if (vue === 'bilan') brancherGraphique();
  }

  function changerVue(v, id = null) {
    vue = v; sel = id;
    history.replaceState(null, '', `#${v}${id ? `/${id}` : ''}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="72" cy="20" r="16" fill="#D9302A"/></svg>';
  const boutonNouvelle = (lib = null, cls = 'primaire') => `<button class="btn ${cls}" data-action="nouvelle">${ICONES.plus}${esc(lib || M().nouvelle)}</button>`;

  // ---------- Petits composants ----------
  const libJours = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${pluriel(n, 'jour')}` : `il y a ${pluriel(-n, 'jour')}`);
  const CLASSE_NIVEAU = { depasse: 'rouge', urgent: 'rose', proche: 'jaune', loin: 'ciel' };
  function etiquetteEvenement(e, court = false) {
    if (e.nature === 'limite' && e.jours < 0) return `<span class="etiquette rouge">Date limite passée · ${dateCourte(e.date)}</span>`;
    if (e.nature === 'reponse' && e.jours < 0) return `<span class="etiquette rose">Réponse attendue le ${dateCourte(e.date)}</span>`;
    if (e.nature === 'entretien' && e.jours < 0) return `<span class="etiquette sable">${estOffre(e.cand) ? 'Audition' : 'Entretien'} passé${estOffre(e.cand) ? 'e' : ''} · ${dateCourte(e.date)}</span>`;
    if (e.nature === 'piece' && e.jours < 0) return `<span class="etiquette rouge">${pluriel(-e.jours, 'jour')} de retard</span>`;
    if (e.nature === 'depot' && e.jours < 0) return `<span class="etiquette rose">Dépôt visé dépassé · ${dateCourte(e.date)}</span>`;
    if (e.nature === 'relance') return `<span class="etiquette ${e.due ? 'jaune' : 'sable'}">${e.due ? (e.raison === 'remerciement' ? 'Remercier' : 'À relancer') : `Relance le ${dateCourte(e.date)}`}</span>`;
    const quand = e.jours <= 7 ? libJours(e.jours) : `le ${dateCourte(e.date)}`;
    const nom = e.nature === 'entretien' && estOffre(e.cand) ? 'Audition' : e.nature === 'entretien' && e.cand.type !== 'formation' ? 'Entretien' : NATURES[e.nature];
    return `<span class="etiquette ${CLASSE_NIVEAU[e.niveau]}">${court ? quand.charAt(0).toUpperCase() + quand.slice(1) : `${esc(nom)} ${quand}`}${e.heure ? ` · ${esc(e.heure)}` : ''}</span>`;
  }
  const prochainEvenement = (c) => evsDe(c).filter((e) => e.nature !== 'piece').sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;
  function barrePieces(c) {
    const a = R.avancement(c);
    if (!a.total) return c.statut === 'reperee' ? '' : '<span class="mini-pieces">Aucune pièce listée</span>';
    return `<span class="mini-pieces" title="${a.pretes} sur ${a.total} pièces prêtes ou envoyées"><i class="jauge"><i style="width:${a.pct}%"></i></i>${a.pretes}/${a.total} pièces</span>`;
  }
  const RECO = { go: ['Go conseillé', 'vert'], discuter: ['À discuter', 'jaune'], nogo: ['No-go conseillé', 'rose'] };
  const jaugeScore = (s) => `<span class="jauge-score" aria-hidden="true"><i style="width:${s.pct ?? 0}%"></i><b style="left:${E.reglages.seuilDiscuter}%"></b><b style="left:${E.reglages.seuilGo}%"></b></span>`;

  function carteCand(c, { action = '' } = {}) {
    const ev = prochainEvenement(c);
    const t = typeDe(c.type);
    const s = c.statut === 'reperee' ? score(c) : null;
    const offre = estOffre(c);
    return `<li class="carte-cand" style="--t:${esc(t.couleur)}">
      <button class="cc-corps" data-action="voir-cand" data-id="${c.id}">
        <span class="cc-tete">${pillType(c.type)}${pillStatut(c)}${c.rang && R.classable(c) && !offre ? `<span class="rang-badge" title="Rang dans tes ${esc(M().voeux.toLowerCase() || 'vœux')}">n°${c.rang}</span>` : ''}${s && s.recommandation ? `<span class="etiquette ${RECO[s.recommandation][1]}">${RECO[s.recommandation][0]}</span>` : ''}</span>
        <b class="cc-titre">${esc(c.intitule || 'Sans intitulé')}</b>
        <span class="cc-org">${esc(c.organisme || '—')}${c.ville ? ` · ${esc(c.ville)}` : ''}${c.reference ? ` · ${esc(c.reference)}` : ''}</span>
        <span class="cc-pied">${barrePieces(c)}${ev ? etiquetteEvenement(ev) : ''}${offre && c.statut === 'acceptee' ? `<span class="montant-mini">${euros(c.montantObtenu ?? c.montantOffre)}</span>` : ''}${offre && c.statut === 'refusee' && c.motifPerte ? `<span class="montant-mini">${esc(nomMotif(c.motifPerte))}</span>` : ''}</span>
      </button>
      ${action}
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const offres = E.usage === 'offres';
    const m = M();
    const b = R.bilan(E.candidatures, t, E.reglages, B);
    const envois = R.aEnvoyer(E.candidatures, t, E.reglages);
    const evsActifs = tousEvs(E.candidatures.filter(R.estActive), { horizon: 14 });
    const evs = R.regrouperPieces(evsActifs.filter((e) => !['relance', 'limite', 'piece', 'decision'].includes(e.nature)));
    const pieces = R.regrouperPieces(tousEvs(E.candidatures.filter((c) => c.statut === 'preparer'), { horizon: E.reglages.alerte }).filter((e) => e.nature === 'piece'));
    const decisions = evsActifs.filter((e) => e.nature === 'decision' && e.jours <= E.reglages.alerte);
    const relances = tousEvs(E.candidatures).filter((e) => e.nature === 'relance' && e.due);
    const renouveler = R.aRenouveler(E.biblio, t, E.reglages.renouveler);
    let tuiles;
    if (offres) {
      const st = R.statistiques(E.candidatures.filter(estOffre), { depuis: ajout(t, -364) }).global;
      tuiles = [
        ['À décider', b.parStatut.reperee, b.parStatut.reperee ? 'en veille, grille à remplir' : 'rien en veille', 'var(--encre)', 'rond', 'veille', ''],
        ['En préparation', b.parStatut.preparer, b.aEnvoyer ? `dont ${b.aEnvoyer} à déposer sous ${E.reglages.alerte} jours` : 'dossiers en cours', 'var(--jaune)', '', 'candidatures', 'preparer'],
        ['Déposées', b.parStatut.envoyee + b.parStatut.entretien, b.relances ? `${pluriel(b.relances, 'relance')} à faire` : 'en attente de réponse', 'var(--bleu)', '', 'candidatures', 'envoyee'],
        ['Réussite', st.tauxReussite === null ? '–' : `${Math.round(st.tauxReussite * 100)} %`, `${pluriel(st.gagnees, 'gagnée')} sur 12 mois`, 'var(--rouge)', 'rond', 'bilan', ''],
      ];
    } else {
      tuiles = [
        ['En cours', b.actives, `${pluriel(b.total, 'candidature')} en tout`, 'var(--bleu)', '', 'candidatures', ''],
        ['À envoyer', b.aEnvoyer, b.depassees ? `dont ${b.depassees} date${b.depassees > 1 ? 's' : ''} passée${b.depassees > 1 ? 's' : ''}` : `date limite sous ${E.reglages.alerte} jours`, 'var(--rouge)', 'rond', 'echeances', ''],
        ['Entretiens', b.entretiens, b.entretiens ? 'à venir, à préparer' : 'aucun prévu', 'var(--jaune)', '', 'echeances', ''],
        ['Réponses', b.parStatut.acceptee, `acceptée${b.parStatut.acceptee > 1 ? 's' : ''}${b.parStatut.attente ? ` · ${b.parStatut.attente} en attente` : ''}`, 'var(--encre)', 'rond', 'candidatures', 'reponses'],
      ];
    }
    const htmlTuiles = tuiles.map(([lib, v, d, c, f, cible, st]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}" ${st ? `data-statut="${st}"` : ''}><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></button>`).join('');
    const vide = !E.candidatures.length;
    const nom = E.profil.prenom ? `Bonjour ${esc(E.profil.prenom)}` : (offres ? 'Tes consultations' : 'Tes candidatures');
    const sousTitre = offres ? 'ce qu\'il faut déposer d\'abord, les pièces du rétroplanning, les décisions à prendre et qui relancer.' : 'ce qu\'il faut envoyer d\'abord, les entretiens et réponses à venir, et qui relancer.';
    return `
      <div class="vue-tete"><div><h1>${nom}</h1><p>${E.profil.campagne && !offres ? `${esc(E.profil.campagne)} : ${sousTitre}` : sousTitre.charAt(0).toUpperCase() + sousTitre.slice(1)}</p></div>
        <div class="actions">${boutonNouvelle()}</div></div>
      <div class="tuiles">${htmlTuiles}</div>
      ${vide ? `<div class="vide-etat" style="margin-top:24px">${FORME_VIDE}<div><h3>${offres ? 'Aucune consultation pour l\'instant' : 'Aucune candidature pour l\'instant'}</h3><p>${offres ? 'Note une consultation repérée (marché public, appel d\'offres privé, mission sur plateforme) : la grille go/no-go t\'aide à décider, puis le dossier se monte pièce par pièce.' : `Ajoute la première : ${esc(m.exemples)}. Tu choisis une liste de pièces de départ, puis tu recopies les dates données par l'établissement ou le recruteur.`}</p><div class="actions">${boutonNouvelle(offres ? 'Première consultation' : 'Première candidature')}</div></div></div>` : `
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">${esc(m.envoyer)} <span>${envois.length ? `date limite sous ${E.reglages.alerte} jours ou passée` : ''}</span></h2>
          ${envois.length ? `<ul class="envois">${envois.map(({ cand: c, jours, av }) => {
            const manque = R.piecesManquantes(c);
            const depot = estOffre(c) && E.reglages.marge > 0 ? R.depotVise(c, E.reglages.marge) : null;
            return `<li class="envoi niv-${jours < 0 ? 'depasse' : jours <= R.URGENT ? 'urgent' : 'proche'}"><button class="lien-ligne" data-action="voir-cand" data-id="${c.id}"><b>${esc(c.intitule || titreCand(c))}</b><span>${esc(c.organisme)}${depot ? ` · dépôt visé ${depot < t ? 'dépassé' : libJours(R.ecart(t, depot))}` : ''}</span></button>
              <div class="envoi-pied">${etiquetteEvenement({ nature: 'limite', cand: c, date: c.dates.limite, jours, niveau: R.niveau(jours, E.reglages.alerte), heure: c.dates.heureLimite })}${av.total ? `<span class="mini-pieces"><i class="jauge"><i style="width:${av.pct}%"></i></i>${av.pretes}/${av.total} prêtes</span>` : ''}</div>
              ${manque.length ? `<p class="manque">Il manque : ${manque.slice(0, 6).map((x) => `<b>${esc(x.nom)}</b>${x.statut === 'encours' ? ' (en cours)' : ''}`).join(', ')}${manque.length > 6 ? ` et ${manque.length - 6} autre${manque.length > 7 ? 's' : ''}` : ''}</p>` : `<p class="manque ok">Toutes les pièces sont prêtes : il ne reste qu'à ${estOffre(c) ? 'déposer' : 'envoyer'}.</p>`}</li>`;
          }).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Rien d'urgent ${offres ? 'à déposer' : 'à envoyer'}</h3><p>Aucune date limite dans les prochains jours. Pense à saisir celles de tes ${offres ? 'dossiers en préparation' : 'candidatures à préparer'}.</p></div></div>`}
          ${pieces.length ? `<h2 class="titre-section">Pièces à préparer <span>rétroplanning, jusqu'à ${E.reglages.alerte} jours</span></h2><ul class="prochains">${pieces.map((e) => ligneEvenement(e, { bouton: e.pieces.length === 1 ? `<button class="btn petit" data-action="piece-prete" data-id="${e.cand.id}" data-piece="${e.pieces[0].id}">Prête</button>` : '' })).join('')}</ul>` : ''}
          ${decisions.length ? `<h2 class="titre-section">À décider <span>go ou no-go avant de t'y mettre</span></h2><ul class="prochains">${decisions.map((e) => ligneEvenement(e, { bouton: `<button class="btn petit" data-action="grille" data-id="${e.cand.id}">Grille go/no-go</button>` })).join('')}</ul>` : ''}
          <h2 class="titre-section">Relances <span>${relances.length ? 'sans réponse depuis un moment' : ''}</span></h2>
          ${relances.length ? `<ul class="prochains">${relances.map((e) => ligneEvenement(e, { bouton: `<button class="btn petit" data-action="relance-rapide" data-id="${e.cand.id}" data-raison="${e.raison}">${e.raison === 'remerciement' ? 'Remercier' : 'Relancer'}</button>` })).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Personne à relancer</h3><p>Une relance est proposée ${offres ? 'après le délai du type de consultation (marché public, plateforme…), puis' : ''} ${E.reglages.relance} jours après un envoi ou une relance sans nouvelles (réglable), ou quand la date de réponse annoncée est passée.</p></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Les 14 prochains jours <span>${evs.length ? (offres ? 'questions, dépôts, auditions, réponses' : 'entretiens et réponses') : ''}</span></h2>
          ${evs.length ? `<ul class="prochains">${evs.map((e) => ligneEvenement(e)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Rien de prévu</h3><p>Aucun ${offres ? 'dépôt, audition' : 'entretien'} ni réponse attendue dans les 14 prochains jours.</p></div></div>`}
          ${renouveler.length ? `<h2 class="titre-section">À renouveler <span>pièces réutilisables</span></h2><ul class="prochains">${renouveler.map(({ b: x, e }) => `<li class="niv-${e.etat === 'expiree' ? 'depasse' : 'proche'}"><span class="date-pastille"><b>${versDate(x.valideJusquau).getDate()}</b>${fmt(x.valideJusquau, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="biblio-modifier" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${esc(typePiece(x.type).nom)} · ${e.etat === 'expiree' ? 'expirée' : `valable ${libJours(e.jours)}`}</span></button><span class="etiquette ${e.etat === 'expiree' ? 'rouge' : 'jaune'}">${e.etat === 'expiree' ? 'Expirée' : 'Bientôt'}</span></li>`).join('')}</ul>` : ''}
          <h2 class="titre-section">Où tu en es</h2>
          <ul class="compteurs-statuts">${statutsFamille(E.usage).map((s) => `<li><button class="lien-statut" data-action="voir-statut" data-statut="${s.id}"><span class="statut statut-${s.id}">${esc(s.court)}</span><b>${b.parStatut[s.id]}</b></button></li>`).join('')}</ul>
        </section>
      </div>`}
      ${AVERTISSEMENT()}`;
  }

  function ligneEvenement(e, { bouton = '' } = {}) {
    const c = e.cand;
    const detail = e.nature === 'piece' ? `${esc(c.intitule)}${e.pieces?.length > 1 ? ` · ${esc(e.pieces.slice(0, 3).map((p) => p.nom).join(' · '))}${e.pieces.length > 3 ? '…' : ''}` : (e.pieces?.[0] || e.piece)?.responsable ? ` · ${esc((e.pieces?.[0] || e.piece).responsable)}` : ''}`
      : `${esc(c.intitule)}${e.heure ? ` · ${esc(e.heure)}` : ''}${e.nature === 'entretien' ? ` · ${esc(nomFormat(c.entretien.format))}` : ''}`;
    return `<li class="niv-${e.niveau}"><span class="date-pastille"><b>${versDate(e.date).getDate()}</b>${fmt(e.date, { month: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="voir-cand" data-id="${c.id}"><b>${esc(nomNature(e))} · ${esc(titreCand(c))}</b><span>${detail}</span></button>
      ${bouton || etiquetteEvenement(e, true)}</li>`;
  }

  // ---------- Veille (appels d'offres) ----------
  function vueVeille() {
    const t = auj();
    const offres = E.candidatures.filter(estOffre);
    const reperees = offres.filter((c) => c.statut === 'reperee').sort((a, b) => (a.dates.limite || '9999').localeCompare(b.dates.limite || '9999'));
    const ecartees = offres.filter((c) => c.statut === 'nogo').sort((a, b) => (b.decision?.date || '').localeCompare(a.decision?.date || ''));
    const st = R.statistiques(offres, { depuis: ajout(t, -364) }).global;
    const nb = E.criteres.filter((k) => k.poids > 0).length;
    return `
      <div class="vue-tete"><div><h1>Veille</h1><p>Les consultations repérées, à décider avant de passer du temps dessus. La grille note ${nb} critères de 0 à 3, pondérés : à partir de ${E.reglages.seuilGo} %, go conseillé ; sous ${E.reglages.seuilDiscuter} % ou avec un critère éliminatoire à 0, no-go conseillé. C'est toi qui décides.</p></div>
        <div class="actions">${boutonNouvelle('Consultation repérée')}</div></div>
      ${st.decidees ? `<p class="note-veille">Sur 12 mois : ${pluriel(st.decidees, 'décision')}, ${pct(st.tauxGo)} de go${st.tauxReussite !== null ? `, ${pct(st.tauxReussite)} de réussite sur les résultats connus` : ''}.</p>` : ''}
      ${reperees.length ? `<ul class="veille">${reperees.map((c) => {
        const s = score(c);
        const reco = s.recommandation ? RECO[s.recommandation] : null;
        const n = c.dates.limite ? R.ecart(t, c.dates.limite) : null;
        return `<li class="veille-carte" style="--c:${n !== null && n < 0 ? 'var(--rouge)' : esc(typeDe(c.type).couleur)}">
          <div class="veille-corps">
            <p class="cc-tete">${pillType(c.type)}${reco ? `<span class="etiquette ${reco[1]}">${reco[0]}</span>` : ''}${n !== null && n <= 7 ? `<span class="etiquette rose">${n < 0 ? 'Date passée' : `J-${n}`}</span>` : ''}</p>
            <h3><button class="lien-fiche" data-action="voir-cand" data-id="${c.id}">${esc(c.intitule || 'Sans intitulé')}</button></h3>
            <p class="carte-meta"><span>${esc(c.organisme || '–')}</span><span>Date limite : ${c.dates.limite ? `${dateLongue(c.dates.limite)}${c.dates.heureLimite ? ` à ${c.dates.heureLimite.replace(':', ' h ')}` : ''}` : 'à saisir'}</span>${c.montantEstime ? `<span>Estimé ${euros(c.montantEstime)}</span>` : ''}</p>
            <div class="score">${jaugeScore(s)}<span>${s.pct !== null ? `<b>${s.pct} %</b> · ${s.notes}/${s.total} critères notés` : 'Grille non remplie'}${s.eliminatoires.length ? ` · <b class="retard">éliminatoire : ${s.eliminatoires.map((id) => esc(E.criteres.find((x) => x.id === id)?.nom)).join(', ')}</b>` : ''}</span></div>
          </div>
          <div class="veille-actions">
            <button class="btn petit primaire" data-action="grille" data-id="${c.id}">${s.notes ? 'Revoir la grille' : 'Remplir la grille'}</button>
            <button class="btn petit" data-action="go" data-id="${c.id}">Go</button>
            <button class="btn petit" data-action="nogo" data-id="${c.id}">No-go</button>
          </div>
        </li>`;
      }).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune consultation à décider</h3><p>Note ici ce que tu repères : profils d'acheteurs, alertes, plateformes, réseau. Une ligne suffit pour commencer.</p><div class="actions">${boutonNouvelle('Consultation repérée')}</div></div></div>`}
      ${ecartees.length ? `<h2 class="titre-section">Écartées <span>no-go décidés, avec leur motif : utile pour affiner ta veille</span></h2>
        <ul class="prochains">${ecartees.map((c) => `<li><span class="date-pastille">${c.decision?.date ? `<b>${versDate(c.decision.date).getDate()}</b>${fmt(c.decision.date, { month: 'short' }).replace('.', '')}` : '–'}</span><button class="lien-ligne" data-action="voir-cand" data-id="${c.id}"><b>${esc(c.intitule)}</b><span>${esc(c.organisme)}${c.decision?.motif ? ` · ${esc(c.decision.motif)}` : ''}</span></button><span class="etiquette sable">No-go</span></li>`).join('')}</ul>` : ''}`;
  }

  // ---------- Candidatures : liste ----------
  const filtresStatut = () => [['actives', 'En cours'], ...statutsFamille(E.usage).map((s) => [s.id, s.court]), ['reponses', 'Réponses reçues'], ['toutes', 'Toutes']];
  function garder(c) {
    switch (filtre.statut) {
      case 'toutes': return true;
      case 'actives': return R.estActive(c);
      case 'reponses': return ['acceptee', 'refusee', 'attente', 'sanssuite'].includes(c.statut);
      default: return c.statut === filtre.statut;
    }
  }
  function vueListe() {
    const t = auj();
    const m = M();
    const offres = E.usage === 'offres';
    const tete = `<div class="vue-tete"><div><h1>${esc(m.liste)}</h1><p>${offres ? 'Chaque consultation : son statut, ses pièces et sa prochaine date. Après le dépôt : relances, puis résultat. Touche une fiche pour l\'ouvrir.' : `Chaque ${esc(m.exemples)} : son statut, ses pièces et sa prochaine date. Touche une candidature pour l'ouvrir.`}</p></div>
      <div class="actions">${boutonNouvelle()}${E.candidatures.length ? '<button class="btn" data-action="imprimer-recap">Imprimer le récapitulatif</button>' : ''}</div></div>`;
    if (!E.candidatures.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>${offres ? 'Aucun dossier' : 'Aucune candidature'}</h3><p>Ajoute ${offres ? 'une consultation : en la passant en go, son dossier se crée avec les pièces du modèle de son type' : `une ${esc(m.exemples)}`}.</p><div class="actions">${boutonNouvelle()}</div></div></div>`;
    const base = R.rechercher(E.candidatures, filtre.q, { nomType, nomStatut: (c) => nomStatut(c) });
    const deType = (c) => filtre.type === 'tous' || c.type === filtre.type;
    const nbStatut = (s) => { const avant = filtre.statut; filtre.statut = s; const n = base.filter((c) => deType(c) && garder(c)).length; filtre.statut = avant; return n; };
    const liste = R.trier(base.filter((c) => deType(c) && garder(c)), t);
    const types = B.types.filter((ty) => E.candidatures.some((c) => c.type === ty.id));
    return `${tete}
      <div class="outils-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher : ${offres ? 'intitulé, acheteur, référence…' : 'établissement, ville, pièce…'}" value="${esc(filtre.q)}" autocomplete="off"></label>
        ${types.length > 1 ? `<div class="filtres" role="group" aria-label="Filtrer par type">${[['tous', 'Tous les types'], ...types.map((ty) => [ty.id, ty.nom])].map(([id, lib]) => `<button class="filtre" data-action="filtre-type" data-type="${id}" aria-pressed="${filtre.type === id}">${esc(lib)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="filtres filtres-statut" role="group" aria-label="Filtrer par statut">${filtresStatut().map(([id, lib]) => { const n = nbStatut(id); return (n || ['actives', 'toutes'].includes(id) || filtre.statut === id) ? `<button class="filtre" data-action="filtre-statut" data-statut="${id}" aria-pressed="${filtre.statut === id}">${esc(lib)} <small>${n}</small></button>` : ''; }).join('')}</div>
      ${liste.length ? `<ul class="cartes-cand">${liste.map((c) => carteCand(c)).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien ne correspond</h3><p>Change de statut, de type ou de recherche.</p></div></div>'}
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv">Exporter en CSV</button></div>`;
  }

  // ---------- Candidatures : fiche ----------
  function vueFiche(c) {
    const t = auj();
    const ty = typeDe(c.type);
    const offre = estOffre(c);
    const a = R.avancement(c);
    const r = R.relance(c, t, E.reglages.relance, B);
    const evs = evsDe(c).filter((e) => !['relance', 'piece'].includes(e.nature));
    const utiles = c.pieces.filter((x) => !x.apres || c.statut === 'acceptee');
    const apres = c.pieces.filter((x) => x.apres && c.statut !== 'acceptee');
    const lignePiece = (x) => {
      const e = offre ? R.etatPiece(x, c, t, E.biblio) : null;
      const delai = e?.echeance && c.dates.limite && !x.echeance ? R.ecart(e.echeance, c.dates.limite) : null;
      const infos = [x.precision, offre && x.responsable ? x.responsable : '', offre && e.b ? `Bibliothèque : ${e.b.titre}` : ''].filter(Boolean);
      const ech = offre && e.echeance && !['prete', 'envoyee', 'sansobjet'].includes(x.statut) ? `<span class="piece-ech ${e.etat === 'retard' ? 'retard' : ''}">À préparer pour le ${dateCourte(e.echeance)}${delai !== null ? ` (J-${delai})` : ''}${e.retard ? ` · ${e.retard} j de retard` : ''}</span>` : '';
      return `<li class="piece piece-${x.statut}${e ? ` etat-${e.etat}` : ''}">
        <button class="piece-statut" data-action="piece-statut" data-id="${c.id}" data-piece="${x.id}" aria-label="${esc(x.nom)} : ${esc(nomStatutPiece(x.statut))}, toucher pour passer à ${esc(nomStatutPiece(R.pieceSuivante(x.statut)))}"><i aria-hidden="true"></i>${esc(nomStatutPiece(x.statut))}</button>
        <button class="lien-ligne" data-action="piece" data-id="${c.id}" data-piece="${x.id}"><b>${esc(x.nom)}</b>${infos.length ? `<span>${esc(infos.join(' · '))}</span>` : ''}${ech}${e?.alerte ? `<span class="piece-alerte">${e.alerte === 'expiree' ? `Pièce liée expirée le ${dateLongue(e.b.valideJusquau)} : à renouveler.` : `Pièce liée valable jusqu'au ${dateLongue(e.b.valideJusquau)}, avant la date limite.`}</span>` : ''}</button>
      </li>`;
    };
    const ligneDate = (lib, d, extra = '') => `<div class="fd"><dt>${lib}</dt><dd>${d ? `${dateLongue(d)}${extra}` : '<span class="discret">—</span>'}</dd></div>`;
    const s = offre ? score(c) : null;
    const reco = s?.recommandation ? RECO[s.recommandation] : null;
    const histo = offre ? [
      c.creeLe && [c.creeLe, 'Repérée', c.source || ''],
      c.decision && c.decision.date && [c.decision.date, c.decision.choix === 'go' ? 'Go' : 'No-go', c.decision.motif || (s.pct !== null ? `score ${s.pct} %` : '')],
      c.dates.envoi && [c.dates.envoi, 'Déposée', c.montantOffre ? `offre ${euros(c.montantOffre)}` : ''],
      ...c.relances.map((x) => [x.date, 'Relance', x.note || nomCanal(x.canal)]),
      c.dates.recue && !R.estActive(c) && [c.dates.recue, nomStatut(c), [c.montantObtenu ? euros(c.montantObtenu) : '', c.motifPerte ? nomMotif(c.motifPerte) : '', c.place ? `classé ${c.place}e` : ''].filter(Boolean).join(' · ')],
    ].filter(Boolean).sort((x, y) => y[0].localeCompare(x[0])) : [];
    const depot = offre && c.statut === 'preparer' && c.dates.limite ? R.depotVise(c, E.reglages.marge) : null;
    return `
      <div class="fil-retour"><button class="btn lien" data-action="vue" data-vue="candidatures">← ${offre ? 'Tous les dossiers' : 'Toutes les candidatures'}</button></div>
      <div class="fiche-tete" style="--t:${esc(ty.couleur)}">
        <div class="ft-titres">
          <span class="cc-tete">${pillType(c.type)}${c.rang && R.classable(c) && !offre ? `<button class="rang-badge" data-action="vue" data-vue="voeux" title="Voir le classement">n°${c.rang} de tes ${esc((M().voeux || 'vœux').toLowerCase())}</button>` : ''}${reco && c.statut === 'reperee' ? `<span class="etiquette ${reco[1]}">${reco[0]}</span>` : ''}</span>
          <h1>${esc(c.intitule || 'Sans intitulé')}</h1>
          <p>${esc(c.organisme || '—')}${c.ville ? ` · ${esc(c.ville)}` : ''}${c.reference ? ` · réf. ${esc(c.reference)}` : ''}${c.contact ? ` · ${esc(c.contact)}` : ''}${c.lien ? ` · <a href="${esc(c.lien)}" target="_blank" rel="noopener">${offre ? 'dossier de consultation' : 'page de l\'offre'}</a>` : ''}</p>
        </div>
        <div class="actions"><button class="btn" data-action="modifier" data-id="${c.id}">Modifier</button><button class="btn" data-action="imprimer-dossier" data-id="${c.id}">Imprimer</button></div>
      </div>
      <fieldset class="statuts-fiche"><legend>Statut</legend><div class="choix-statuts">${statutsFamille(famille(c)).map((x) => `<button class="choix-st statut-${x.id}" data-action="statut" data-id="${c.id}" data-statut="${x.id}" aria-pressed="${c.statut === x.id}">${esc(x.court)}</button>`).join('')}</div></fieldset>
      ${evs.length ? `<div class="alertes-fiche">${evs.map((e) => etiquetteEvenement(e)).join('')}</div>` : ''}
      ${r && r.due ? `<div class="alerte-doc"><div><b>${r.raison === 'remerciement' ? 'Entretien passé : un message de remerciement fait bonne impression' : r.raison === 'reponse' ? 'La date de réponse annoncée est passée' : r.raison === 'prevue' ? `Relance prévue le ${dateLongue(r.date)}` : `Sans nouvelles depuis ${pluriel(r.jours, 'jour')}`}</b><span>Un message prêt à copier, puis note la relance pour suivre.</span></div><button class="btn petit" data-action="relance-rapide" data-id="${c.id}" data-raison="${r.raison}">${r.raison === 'remerciement' ? 'Remercier' : 'Relancer'}</button></div>` : ''}
      ${offre && c.statut === 'reperee' ? `<div class="alerte-doc"><div><b>${s.pct !== null ? `Grille go/no-go : ${s.pct} %${reco ? ` · ${reco[0]}` : ''}` : 'Décide avant de t\'y mettre'}</b><span>${s.notes}/${s.total} critères notés. Au go, le dossier reçoit les pièces de son modèle, avec leur échéance.</span></div><span class="rang"><button class="btn petit primaire" data-action="grille" data-id="${c.id}">Grille go/no-go</button><button class="btn petit" data-action="go" data-id="${c.id}">Go</button></span></div>` : ''}
      <div class="fiche-grille">
        <section class="bloc">
          <h2 class="titre-bloc">Pièces ${offre ? 'du dossier' : 'à fournir'} <span>${a.total ? `${a.pretes} sur ${a.total} prêtes ou envoyées` : ''}</span></h2>
          ${a.total ? `<p class="jauge-grande" aria-hidden="true"><i style="width:${a.pct}%"></i></p>` : ''}
          ${utiles.length ? `<ul class="pieces">${utiles.map(lignePiece).join('')}</ul>` : `<p class="aide">${c.statut === 'reperee' ? 'Les pièces du modèle de dossier arrivent au go. Tu peux aussi les ajouter dès maintenant.' : `Aucune pièce listée : ajoute celles que demande ${offre ? 'le règlement de la consultation' : 'la formation ou le recruteur'}.`}</p>`}
          ${apres.length ? `<h3 class="sous-titre">Après acceptation <span>pas comptées pour l'instant</span></h3><ul class="pieces">${apres.map(lignePiece).join('')}</ul>` : ''}
          <div class="rang"><button class="btn petit" data-action="ajouter-piece" data-id="${c.id}">${ICONES.plus}Pièce</button></div>
          <p class="mention">Touche le statut pour le faire avancer : à faire, en cours, prête, envoyée.${offre ? ' Échéances à rebours depuis la date limite, avancées au vendredi si elles tombent un week-end.' : ''} La liste exacte est celle ${offre ? 'du règlement' : 'de la candidature'}.</p>
        </section>
        <section class="bloc">
          <h2 class="titre-bloc">Dates <span>saisies par toi</span></h2>
          <dl class="dates-fiche">
            ${offre ? ligneDate('Repérée le', c.creeLe) : ''}
            ${ligneDate('Date limite', c.dates.limite, c.dates.heureLimite ? ` à ${esc(c.dates.heureLimite.replace(':', ' h '))}` : '')}
            ${offre ? ligneDate('Questions jusqu\'au', c.dates.questions) : ''}
            ${depot ? ligneDate('Dépôt visé', depot) : ''}
            ${ligneDate(offre ? 'Déposée le' : 'Envoyée le', c.dates.envoi)}
            ${ligneDate(offre ? 'Audition ou soutenance' : c.type === 'formation' ? 'Entretien ou épreuve' : 'Entretien', c.dates.entretien, `${c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''}${offre ? '' : ` · ${esc(nomFormat(c.entretien.format))}`}`)}
            ${ligneDate(offre ? 'Résultat annoncé' : 'Réponse attendue', c.dates.reponse)}
            ${ligneDate(offre ? 'Résultat reçu' : 'Réponse reçue', c.dates.recue)}
            ${offre ? ligneDate('Offre valable jusqu\'au', c.dates.valable) : ''}
          </dl>
          <div class="rang"><button class="btn petit" data-action="modifier" data-id="${c.id}">Modifier les dates</button></div>
          <h2 class="titre-bloc">Relances <span>${c.relances.length ? pluriel(c.relances.length, 'relance') : ''}</span></h2>
          ${c.relances.length ? `<ul class="relances">${c.relances.map((x) => `<li><button class="lien-ligne" data-action="relance" data-id="${c.id}" data-relance="${x.id}"><b>${dateLongue(x.date)} · ${esc(nomCanal(x.canal))}</b>${x.note ? `<span>${esc(x.note)}</span>` : ''}</button></li>`).join('')}</ul>` : `<p class="aide">${['preparer', 'reperee'].includes(c.statut) ? `Les relances viendront après ${offre ? 'le dépôt' : 'l\'envoi'}.` : 'Aucune relance notée.'}</p>`}
          ${r && !r.due ? `<p class="mention">Prochaine relance proposée le ${dateLongue(r.date)}.</p>` : ''}
          <div class="rang"><button class="btn petit" data-action="relance" data-id="${c.id}">${ICONES.plus}Noter une relance</button>${!['preparer', 'reperee'].includes(c.statut) ? `<button class="btn petit" data-action="relance-rapide" data-id="${c.id}" data-raison="${r?.raison || ''}">Message à copier</button>` : ''}${R.attendReponse(c) ? `<button class="btn petit" data-action="relance-date" data-id="${c.id}">Changer la date de relance</button>` : ''}</div>
        </section>
        ${offre ? `<section class="bloc">
          <h2 class="titre-bloc">Offre et résultat</h2>
          <dl class="dates-fiche">
            <div class="fd"><dt>Montant estimé</dt><dd>${euros(c.montantEstime)}</dd></div>
            <div class="fd"><dt>Montant de l'offre</dt><dd>${euros(c.montantOffre)}</dd></div>
            ${c.statut === 'acceptee' ? `<div class="fd"><dt>Montant obtenu</dt><dd>${euros(c.montantObtenu ?? c.montantOffre)}</dd></div>` : ''}
            ${c.statut === 'refusee' ? `<div class="fd"><dt>Motif de perte</dt><dd>${esc(nomMotif(c.motifPerte) || '—')}${c.place ? ` · classé ${c.place}e` : ''}</dd></div>` : ''}
            <div class="fd"><dt>Source</dt><dd>${esc(c.source || '—')}</dd></div>
          </dl>
          <div class="temps"><span class="surtitre">Temps passé</span><b>${heures(c.temps || 0)}</b><span class="rang"><button type="button" class="btn petit" data-action="temps" data-id="${c.id}" data-delta="-0.5" aria-label="Retirer une demi-heure">−½ h</button><button type="button" class="btn petit" data-action="temps" data-id="${c.id}" data-delta="0.5" aria-label="Ajouter une demi-heure">+½ h</button><button type="button" class="btn petit" data-action="temps" data-id="${c.id}" data-delta="1" aria-label="Ajouter une heure">+1 h</button></span></div>
          ${histo.length ? `<h2 class="titre-bloc">Historique</h2><ol class="historique">${histo.map(([d, tyH, x]) => `<li><span class="h-date">${dateCourte(d)} ${d.slice(0, 4)}</span><span class="h-type">${esc(tyH)}</span><span>${esc(x)}</span></li>`).join('')}</ol>` : ''}
        </section>` : `<section class="bloc">
          <h2 class="titre-bloc">Lettre de motivation <span>trame ${esc(R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c)).nom.toLowerCase())}</span></h2>
          <p>${R.composerLettre(c, R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c)), E.profil).manquants.length ? `${pluriel(R.composerLettre(c, R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c)), E.profil).manquants.length, 'champ')} à compléter.` : 'Tous les champs sont remplis : relis et adapte le texte.'}</p>
          <div class="rang"><button class="btn petit primaire" data-action="voir-preparer" data-id="${c.id}" data-sous="lettre">Écrire la lettre</button></div>
          <h2 class="titre-bloc">Entretien <span>${R.preparation(c).total ? `${R.preparation(c).pretes} sur ${pluriel(R.preparation(c).total, 'question')} préparée${R.preparation(c).pretes > 1 ? 's' : ''}` : ''}</span></h2>
          <p>${c.dates.entretien ? `${dateLongue(c.dates.entretien)}${c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''} · ${esc(nomFormat(c.entretien.format))}${c.entretien.lieu ? ` · ${esc(c.entretien.lieu)}` : ''}` : 'Pas encore de date. Tu peux préparer les questions dès maintenant.'}</p>
          <div class="rang"><button class="btn petit" data-action="voir-preparer" data-id="${c.id}" data-sous="entretien">Préparer l'entretien</button></div>
        </section>`}
        <section class="bloc">
          <h2 class="titre-bloc">Notes</h2>
          ${c.note ? `<p class="note-fiche">${esc(c.note)}</p>` : `<p class="aide">${offre ? 'Critères de choix, visite, allotissement, contacts (fonction), retour de l\'acheteur.' : 'Ce que tu as appris aux portes ouvertes, le nom du service, une idée pour la lettre.'}</p>`}
          ${c.decision?.motif ? `<p class="note-fiche"><b>Décision :</b> ${esc(c.decision.motif)}</p>` : ''}
          ${c.motif ? `<p class="note-fiche"><b>Motif ou suite :</b> ${esc(c.motif)}</p>` : ''}
          <div class="rang"><button class="btn petit" data-action="modifier" data-id="${c.id}">Modifier les notes</button></div>
        </section>
      </div>`;
  }

  // ---------- Vœux ----------
  function vueVoeux() {
    const titre = M().voeux || 'Vœux';
    const groupes = typesUsage().map((ty) => ({ ty, ...R.classement(E.candidatures, ty.id) })).filter((g) => g.classees.length || g.autres.length);
    const ligne = (c, i, n) => `<li class="voeu ${R.estActive(c) ? '' : 'voeu-fin'}">
        <span class="voeu-rang" aria-label="Rang ${i + 1}">${i + 1}</span>
        <button class="lien-ligne" data-action="voir-cand" data-id="${c.id}"><b>${esc(c.intitule || titreCand(c))}</b><span>${esc(c.organisme)}${c.ville ? ` · ${esc(c.ville)}` : ''}</span></button>
        ${pillStatut(c)}
        <span class="voeu-boutons"><button class="btn-icone" data-action="monter" data-id="${c.id}" aria-label="Monter : ${esc(c.intitule)}" ${i === 0 ? 'disabled' : ''}>${ICONES.haut}</button><button class="btn-icone" data-action="descendre" data-id="${c.id}" aria-label="Descendre : ${esc(c.intitule)}" ${i === n - 1 ? 'disabled' : ''}>${ICONES.bas}</button><button class="btn-icone" data-action="declasser" data-id="${c.id}" aria-label="Retirer du classement : ${esc(c.intitule)}" title="Retirer du classement">×</button></span>
      </li>`;
    return `
      <div class="vue-tete"><div><h1>${esc(titre)}</h1><p>Ton ordre de préférence, type par type : ce que tu choisirais si tout était accepté. Il t'aide à décider vite quand une réponse arrive.</p></div>
        <div class="actions">${E.candidatures.length ? '<button class="btn" data-action="imprimer-voeux">Imprimer le classement</button>' : ''}</div></div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-voeux">
          <h2 class="titre-cat">${esc(g.ty.long)}<span>${pluriel(g.classees.length, 'candidature classée', 'candidatures classées')}</span></h2>
          ${g.classees.length ? `<ol class="voeux">${g.classees.map((c, i) => ligne(c, i, g.classees.length)).join('')}</ol>` : '<p class="aide">Rien de classé dans ce type.</p>'}
          ${g.autres.length ? `<h3 class="sous-titre">Pas encore classées</h3><ul class="non-classees">${g.autres.map((c) => `<li><button class="lien-ligne" data-action="voir-cand" data-id="${c.id}"><b>${esc(c.intitule || titreCand(c))}</b><span>${esc(c.organisme)}</span></button><button class="btn petit" data-action="classer" data-id="${c.id}">Classer</button></li>`).join('')}</ul>` : ''}
        </section>`).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à classer</h3><p>Ajoute des candidatures : tu pourras ensuite les ranger par ordre de préférence.</p><div class="actions">${boutonNouvelle()}</div></div></div>`}
      <p class="mention avertissement">Ce classement est le tien, pour t'aider à choisir. Il ne remplace pas celui qu'un établissement ou un service de candidature te demanderait : chacun a ses propres règles et ses propres dates, à lire à la source. Les candidatures refusées ou retirées sortent du classement.</p>`;
  }

  // ---------- Échéances : liste et calendrier ----------
  function vueEcheances() {
    const t = auj();
    const toutes = R.regrouperPieces(tousEvs(E.candidatures));
    const natures = ['limite', 'depot', 'piece', 'questions', 'decision', 'entretien', 'reponse', 'relance', 'validite'].filter((n) => toutes.some((e) => e.nature === n));
    const LIBS = { limite: 'Dates limites', depot: 'Dépôts', piece: 'Pièces', questions: 'Questions', decision: 'Décisions', entretien: E.usage === 'offres' ? 'Auditions' : 'Entretiens', reponse: 'Réponses', relance: 'Relances', validite: 'Validités' };
    if (filtre.nature !== 'toutes' && !natures.includes(filtre.nature)) filtre.nature = 'toutes';
    const liste = toutes.filter((e) => filtre.nature === 'toutes' || e.nature === filtre.nature);
    const retard = liste.filter((e) => e.jours < 0 || (e.nature === 'relance' && e.due));
    const avenir = liste.filter((e) => !retard.includes(e));
    return `
      <div class="vue-tete"><div><h1>Échéances</h1><p>Toutes tes dates au même endroit : dates limites, ${E.usage === 'offres' ? 'dépôts visés, pièces du rétroplanning, questions, décisions, auditions, résultats et relances' : 'entretiens, réponses attendues et relances proposées'}. Rien ne vient d'un calendrier officiel : ce sont les dates que tu as saisies.</p></div>
        <div class="actions">${toutes.length ? '<button class="btn" data-action="ics">Ajouter à mon agenda (.ics)</button><button class="btn" data-action="imprimer-echeances">Imprimer</button>' : ''}</div></div>
      <div class="filtres" role="group" aria-label="Filtrer les échéances">${[['toutes', 'Tout'], ...natures.map((n) => [n, LIBS[n]])].map(([id, lib]) => `<button class="filtre" data-action="filtre-nature" data-nature="${id}" aria-pressed="${filtre.nature === id}">${esc(lib)} <small>${toutes.filter((e) => id === 'toutes' || e.nature === id).length}</small></button>`).join('')}</div>
      ${retard.length ? `<h2 class="titre-section">À traiter <span>dates passées, relances dues</span></h2><ul class="prochains">${retard.map((e) => ligneEvenement(e, { bouton: e.nature === 'relance' ? `<button class="btn petit" data-action="relance-rapide" data-id="${e.cand.id}" data-raison="${e.raison}">${e.raison === 'remerciement' ? 'Remercier' : 'Relancer'}</button>` : '' })).join('')}</ul>` : ''}
      ${avenir.length ? R.parMois(avenir).map((g) => `<h2 class="titre-section">${esc(moisAn(g.mois))} <span>${pluriel(g.liste.length, 'date')}</span></h2><ul class="prochains">${g.liste.map((e) => ligneEvenement(e)).join('')}</ul>`).join('') : ''}
      ${!liste.length ? `<div class="vide-etat" style="margin-top:20px">${FORME_VIDE}<div><h3>${toutes.length ? 'Rien dans ce filtre' : 'Aucune date pour l\'instant'}</h3><p>${toutes.length ? 'Choisis un autre filtre.' : 'Ouvre une fiche et saisis sa date limite, la date de l\'entretien ou la date de réponse annoncée.'}</p></div></div>` : ''}
      ${calendrier()}
      <p class="mention avertissement">Le fichier .ics s'importe dans l'agenda de ton téléphone ou de ton ordinateur ; il n'est pas mis à jour tout seul : exporte-le de nouveau après un changement. ${esc(avertissement())}</p>`;
  }

  // Calendrier mensuel : dates limites, dépôts visés, questions, décisions, entretiens, réponses, relances, validités.
  const NOMS_CAL = { limite: 'Date limite', depot: 'Dépôt visé', questions: 'Questions', decision: 'Décision', entretien: 'Entretien', reponse: 'Réponse', relance: 'Relance', validite: 'Validité' };
  function calendrier() {
    const t = auj();
    if (!mois) mois = t.slice(0, 7);
    const semaines = R.grilleMois(mois);
    const debut = semaines[0][0], fin = semaines.at(-1)[6];
    const ev = tousEvs(E.candidatures).filter((x) => x.nature !== 'piece' && x.date >= debut && x.date <= fin);
    const duMois = ev.filter((x) => x.date.startsWith(mois));
    const titreMois = moisAn(mois);
    const jours = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
    const courant = mois === t.slice(0, 7);
    const liste = jourChoisi ? duMois.filter((x) => x.date === jourChoisi) : courant ? duMois.filter((x) => x.date >= t) : duMois;
    const presentes = Object.keys(NOMS_CAL).filter((n) => ev.some((x) => x.nature === n));
    return `
      <h2 class="titre-section" id="calendrier">Calendrier <span>les dates des fiches en cours, mois par mois</span></h2>
      <div class="cal">
        <div class="cal-tete"><button class="btn petit" data-action="mois" data-id="-1" aria-label="Mois précédent">‹</button><h3>${titreMois}</h3><button class="btn petit" data-action="mois" data-id="1" aria-label="Mois suivant">›</button>${!courant ? '<button class="btn petit lien" data-action="mois" data-id="0">Aujourd\'hui</button>' : ''}</div>
        ${presentes.length ? `<div class="cal-legende">${presentes.map((g) => `<span><i style="background:${B.couleurs[g]}"></i>${NOMS_CAL[g]}</span>`).join('')}</div>` : ''}
        <div class="cal-grille" role="grid" aria-label="Calendrier de ${titreMois}">
          <div class="cal-ligne" role="row">${jours.map((x) => `<span class="cal-jour-nom" role="columnheader">${x}</span>`).join('')}</div>
          ${semaines.map((s) => `<div class="cal-ligne" role="row">${s.map((d) => {
            const du = ev.filter((x) => x.date === d);
            const hors = !d.startsWith(mois);
            return `<button type="button" role="gridcell" class="cal-case${hors ? ' hors' : ''}${d === t ? ' auj' : ''}${d === jourChoisi ? ' choisi' : ''}" data-action="jour" data-id="${d}" aria-label="${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}${du.length ? `, ${pluriel(du.length, 'échéance')}` : ''}">
              <span class="cal-num">${Number(d.slice(8))}</span>
              ${du.slice(0, 3).map((x) => `<span class="cal-ev" style="--c:${B.couleurs[x.nature]}"><i></i><em>${esc(titreCand(x.cand))}</em></span>`).join('')}${du.length > 3 ? `<span class="cal-plus">+${du.length - 3}</span>` : ''}
            </button>`;
          }).join('')}</div>`).join('')}
        </div>
        <div class="cal-liste">
          <h4>${jourChoisi ? `${fmt(jourChoisi, { weekday: 'long', day: 'numeric', month: 'long' })} <button class="btn petit lien" data-action="jour" data-id="">Tout le mois</button>` : courant ? 'À venir ce mois-ci' : 'Ce mois-ci'}</h4>
          ${liste.length ? `<ul class="cal-items">${liste.map((x) => `<li><button class="cal-item" style="--c:${B.couleurs[x.nature]}" data-action="voir-cand" data-id="${x.cand.id}"><i></i><span><b>${esc(x.cand.intitule || titreCand(x.cand))}</b><small>${esc(nomNature(x))}${x.heure ? ` à ${esc(x.heure.replace(':', ' h '))}` : ''} · ${esc(x.cand.organisme)}</small></span><em>${dateJour(x.date)}</em></button></li>`).join('')}</ul>` : '<p class="discret">Aucune échéance.</p>'}
        </div>
      </div>`;
  }

  // ---------- Préparer : lettre et entretien ----------
  function vuePreparer() {
    const actives = R.trier(E.candidatures.filter((c) => !estOffre(c)), auj());
    if (!sel || !cand(sel) || estOffre(cand(sel))) {
      // Par défaut : l'entretien le plus proche (onglet Entretien) ou la prochaine date limite à venir (Lettre).
      const t = auj();
      const parDate = (l, k) => l.slice().sort((x, y) => (x.dates[k] < y.dates[k] ? -1 : 1))[0];
      const choix = sousVue === 'entretien'
        ? parDate(actives.filter((c) => c.statut === 'entretien' && c.dates.entretien >= t), 'entretien')
        : parDate(actives.filter((c) => c.statut === 'preparer' && c.dates.limite >= t), 'limite');
      sel = (choix || actives.find((c) => R.estActive(c)) || actives[0])?.id || null;
    }
    const c = sel ? cand(sel) : null;
    const tete = '<div class="vue-tete"><div><h1>Lettres et entretiens</h1><p>Une lettre de motivation construite sur une trame, et les questions d\'entretien préparées avec tes notes, candidature par candidature.</p></div></div>';
    if (!c) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune candidature</h3><p>Ajoute une candidature pour écrire sa lettre et préparer son entretien.</p><div class="actions">${boutonNouvelle()}</div></div></div>`;
    return `${tete}
      <div class="outils-liste outils-preparer">
        <label class="champ choix-cand">Candidature<select data-action="choisir-cand">${actives.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(`${x.intitule || 'Sans intitulé'} · ${x.organisme || '—'}`)}${R.estActive(x) ? '' : ` (${esc(nomStatut(x, true).toLowerCase())})`}</option>`).join('')}</select></label>
        <div class="filtres" role="tablist" aria-label="Préparer">${[['lettre', 'Lettre de motivation'], ['entretien', 'Entretien']].map(([id, lib]) => `<button class="filtre" role="tab" data-action="sous-vue" data-sous="${id}" aria-selected="${sousVue === id}">${lib}</button>`).join('')}</div>
      </div>
      ${sousVue === 'lettre' ? blocLettre(c) : blocEntretien(c)}`;
  }

  function apercuLettre(c, trame) {
    const l = R.composerLettre(c, trame, E.profil);
    const marquer = (s) => esc(s).replace(/\[à compléter : ([a-z0-9]+)\]/g, (_, k) => `<mark class="trou">${esc((trame.champs.find((ch) => ch.id === k)?.lib) || ({ organisme: 'établissement ou entreprise', intitule: 'intitulé', signature: 'signature' }[k] || k))}</mark>`);
    return `<p class="lettre-objet"><b>Objet :</b> ${marquer(l.objet)}</p><p>Madame, Monsieur,</p>${l.paragraphes.map((p) => `<p>${marquer(p)}</p>`).join('')}<p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p><p class="lettre-signature">${E.profil.signature || E.profil.prenom ? esc(E.profil.signature || E.profil.prenom) : '<mark class="trou">signature (réglages)</mark>'}</p>`;
  }
  const nbManquants = (c, trame) => R.composerLettre(c, trame, E.profil).manquants.length;

  function blocLettre(c) {
    const trame = R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c));
    const libreActive = Boolean(c.lettre.texte);
    const n = nbManquants(c, trame);
    return `
      <div class="lettre-grille">
        <form class="bloc lettre-champs" id="form-lettre" onsubmit="return false" data-id="${c.id}">
          <label class="champ">Trame<small>Textes originaux à adapter : une lettre recopiée se repère.</small><select data-action="choisir-trame">${B.trames.map((t) => `<option value="${t.id}" ${t.id === trame.id ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
          <p class="aide">Repris de la candidature : <b>${esc(c.intitule || '[intitulé]')}</b>, <b>${esc(c.organisme || '[établissement]')}</b>. Signature : <b>${esc(E.profil.signature || E.profil.prenom || 'à saisir dans les réglages')}</b>.</p>
          ${trame.champs.map((ch) => `<label class="champ">${esc(ch.lib)}<small>Exemple : ${esc(ch.exemple)}</small><textarea data-champ="${ch.id}" rows="2" maxlength="400">${esc(c.lettre.champs[ch.id] || '')}</textarea></label>`).join('')}
          <p class="erreur" role="alert"></p>
        </form>
        <section class="bloc lettre-apercu">
          <h2 class="titre-bloc">Aperçu <span id="lettre-manquants">${n ? `${pluriel(n, 'champ')} à compléter` : 'complet'}</span></h2>
          ${libreActive ? `<p class="aide">Tu as modifié le texte à la main : c'est cette version qui est copiée et imprimée. <button class="btn lien" data-action="lettre-trame" data-id="${c.id}">Revenir à la trame</button></p><label class="champ"><span class="sr-only">Texte de la lettre</span><textarea id="lettre-libre" data-id="${c.id}" rows="18" maxlength="6000">${esc(c.lettre.texte)}</textarea></label>` : `<div class="lettre" id="apercu-lettre">${apercuLettre(c, trame)}</div>`}
          <div class="rang">
            <button class="btn petit primaire" data-action="copier-lettre" data-id="${c.id}">Copier le texte</button>
            <button class="btn petit" data-action="imprimer-lettre" data-id="${c.id}">Imprimer</button>
            ${libreActive ? '' : `<button class="btn petit" data-action="lettre-libre" data-id="${c.id}">Retoucher à la main</button>`}
            ${c.pieces.some((x) => x.ref === 'lm' && x.statut !== 'prete' && x.statut !== 'envoyee') ? `<button class="btn petit" data-action="lettre-prete" data-id="${c.id}">Pièce « Lettre » prête</button>` : ''}
          </div>
        </section>
      </div>`;
  }

  function blocEntretien(c) {
    const prep = R.preparation(c);
    const choisies = new Set(c.entretien.questions.map((x) => x.ref).filter(Boolean));
    const banque = R.questionsPour(B, c.type);
    return `
      <div class="bloc entretien-tete">
        <div><h2 class="titre-bloc">${c.dates.entretien ? `${dateLongue(c.dates.entretien)}${c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''}` : 'Date à venir'} <span>${esc(nomFormat(c.entretien.format))}${c.entretien.lieu ? ` · ${esc(c.entretien.lieu)}` : ''}</span></h2>
        <p>${prep.total ? `${prep.pretes} sur ${pluriel(prep.total, 'question')} préparée${prep.pretes > 1 ? 's' : ''}. Une question est comptée prête quand tu la coches ou que tes notes font au moins une phrase.` : 'Choisis quelques questions ci-dessous, puis note tes idées de réponse : des mots-clés et un exemple suffisent.'}</p></div>
        <div class="rang"><button class="btn petit" data-action="modifier" data-id="${c.id}">Date et format</button><button class="btn petit" data-action="imprimer-entretien" data-id="${c.id}">Imprimer la fiche</button></div>
      </div>
      <h2 class="titre-section">Mes questions <span>${pluriel(c.entretien.questions.length, 'question')}</span></h2>
      ${c.entretien.questions.length ? `<ol class="questions">${c.entretien.questions.map((x) => { const ref = x.ref ? R.questionDe(B, x.ref) : null; return `<li class="question ${x.prete || x.notes.trim().length >= 20 ? 'prete' : ''}">
          <div class="q-tete"><b>${esc(x.texte)}</b><span class="q-actions"><label class="case petite"><input type="checkbox" data-action="question-prete" data-id="${c.id}" data-question="${x.id}" ${x.prete ? 'checked' : ''}> Prête</label><button class="btn-icone petit" data-action="retirer-question" data-id="${c.id}" data-question="${x.id}" aria-label="Retirer la question : ${esc(x.texte)}">×</button></span></div>
          ${ref ? `<p class="piste">Piste : ${esc(ref.piste)}</p>` : ''}
          <label class="champ"><span class="sr-only">Mes notes pour : ${esc(x.texte)}</span><textarea data-notes="${x.id}" data-id="${c.id}" rows="3" maxlength="1200" placeholder="Mes idées, un exemple concret, des mots-clés">${esc(x.notes)}</textarea></label>
        </li>`; }).join('')}</ol>` : '<p class="aide">Aucune question choisie pour l\'instant.</p>'}
      <form class="ajout-question" id="form-question" data-id="${c.id}" onsubmit="return false"><label class="champ">Ajouter ta propre question<input name="question" maxlength="200" placeholder="Ex. : Pourquoi ce choix de spécialité ?"></label><button class="btn petit" data-action="ajouter-question" data-id="${c.id}">${ICONES.plus}Ajouter</button></form>
      <h2 class="titre-section">Questions types <span>${esc(nomType(c.type).toLowerCase())}</span></h2>
      <div class="banque">${banque.map((g) => `<details class="theme-questions" ${g.theme.id === 'presentation' ? 'open' : ''}><summary>${esc(g.theme.nom)} <small>${g.questions.length}</small></summary><ul>${g.questions.map((x) => `<li><span><b>${esc(x.texte)}</b><small>${esc(x.piste)}</small></span>${choisies.has(x.id) ? '<span class="etiquette ciel">Choisie</span>' : `<button class="btn petit" data-action="choisir-question" data-id="${c.id}" data-question="${x.id}">${ICONES.plus}Ajouter</button>`}</li>`).join('')}</ul></details>`).join('')}</div>
      <h2 class="titre-section">Notes générales</h2>
      <label class="champ"><span class="sr-only">Notes générales sur l'entretien</span><textarea data-notes-entretien data-id="${c.id}" rows="4" maxlength="2000" placeholder="Durée, nombre de personnes, ce qu'il faut apporter, ce que tu as retenu après l'entretien">${esc(c.entretien.notes)}</textarea></label>`;
  }

  // ---------- Pièces réutilisables (appels d'offres) ----------
  const ETATS_BIB = { valide: ['Valide', 'vert'], bientot: ['Expire bientôt', 'jaune'], expiree: ['Expirée', 'rouge'], sansdate: ['Validité à saisir', 'sable'] };
  function vueBibliotheque() {
    const t = auj();
    const etats = E.biblio.map((b) => ({ b, e: R.etatBiblio(b, t, E.reglages.renouveler) }));
    const nb = etats.filter((x) => ['bientot', 'expiree'].includes(x.e.etat)).length;
    const usages = (id) => E.candidatures.filter((c) => ['preparer', 'envoyee', 'entretien'].includes(c.statut) && c.pieces.some((p) => p.biblio === id)).length;
    const groupes = B.typesPieces.map((ty) => ({ ty, liste: etats.filter((x) => x.b.type === ty.id) })).filter((g) => g.liste.length);
    return `
      <div class="vue-tete"><div><h1>Pièces réutilisables</h1><p>Références, CV, attestations, présentations : où les trouver et jusqu'à quand elles sont valables. L'application garde l'emplacement (dossier, nom de fichier), pas le fichier. Les dates de validité sont celles que tu lis sur chaque pièce.</p></div>
        <div class="actions"><button class="btn primaire" data-action="biblio-nouvelle">${ICONES.plus}Pièce</button></div></div>
      ${nb ? `<div class="alerte-doc"><div><b>${pluriel(nb, 'pièce')} à renouveler</b><span>Expirée${nb > 1 ? 's' : ''} ou valable${nb > 1 ? 's' : ''} moins de ${E.reglages.renouveler} jours.</span></div></div>` : ''}
      ${E.biblio.length ? groupes.map(({ ty, liste }) => `
        <h2 class="titre-section">${esc(ty.nom)} <span>${pluriel(liste.length, 'pièce')}</span></h2>
        <ul class="prochains">${liste.map(({ b, e }) => { const [n, te] = ETATS_BIB[e.etat]; const u = usages(b.id); return `<li class="niv-${e.etat === 'expiree' ? 'depasse' : e.etat === 'bientot' ? 'proche' : 'loin'}"><span class="date-pastille">${b.valideJusquau ? `<b>${versDate(b.valideJusquau).getDate()}</b>${fmt(b.valideJusquau, { month: 'short' }).replace('.', '')}` : '–'}</span>
          <button class="lien-ligne" data-action="biblio-modifier" data-id="${b.id}"><b>${esc(b.titre)}</b><span>${esc(b.reference || 'Emplacement non précisé')}${u ? ` · utilisée dans ${pluriel(u, 'dossier')} en cours` : ''}${b.valideJusquau ? ` · jusqu'au ${dateLongue(b.valideJusquau)}` : b.emisLe ? ` · du ${dateLongue(b.emisLe)}` : ''}</span></button>
          ${e.etat === 'sansdate' && !typePiece(b.type).validite ? '<span></span>' : `<span class="etiquette ${te}">${n}</span>`}</li>`; }).join('')}</ul>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune pièce enregistrée</h3><p>Commence par ce que tu fournis à chaque fois : tes attestations (avec leur date de validité), tes CV, tes trois meilleures références.</p><div class="actions"><button class="btn primaire" data-action="biblio-nouvelle">${ICONES.plus}Ajouter une pièce</button></div></div></div>`}
      <h2 class="titre-section">Modèles de dossiers <span>pièces copiées dans chaque nouveau dossier au go, avec leur délai avant la date limite</span></h2>
      <p class="aide">Ces listes sont des points de départ, sans référence réglementaire : la liste exacte des pièces exigées est celle du règlement de chaque consultation (marchés publics compris). Adapte-les à tes habitudes ; un dossier déjà créé garde ses pièces.</p>
      <div class="modeles">${E.dossiers.map((m) => `<article class="modele">
        <div class="modele-tete"><div><h3>${esc(m.nom)}</h3><p>${esc(m.description || '')}</p></div><button class="btn petit" data-action="modele-modifier" data-id="${m.id}">Modifier</button></div>
        <ol>${m.pieces.map((p) => `<li><b>J-${p.delai}</b><span>${esc(p.libelle)}</span></li>`).join('')}</ol>
      </article>`).join('')}</div>
      ${AVERTISSEMENT()}`;
  }

  // ---------- Bilan (appels d'offres) ----------
  const PERIODES = [['90', '90 jours'], ['365', '12 mois'], ['tout', 'Tout']];
  const SERIES = [['deposees', 'Déposées', '#2E5A88'], ['gagnees', 'Gagnées', '#E8B93A']];
  function vueBilan() {
    const t = auj();
    const depuis = periode === 'tout' ? null : ajout(t, -Number(periode) + 1);
    const offres = E.candidatures.filter(estOffre);
    const s = R.statistiques(offres, { depuis, types: B.types.filter((x) => x.famille === 'offres'), motifs: B.motifsPerte, aujourdhui: t, mois: 12 });
    const g = s.global;
    const tuiles = [
      ['Taux de réussite', g.tauxReussite === null ? '–' : Math.round(g.tauxReussite * 100), g.tauxReussite === null ? '' : '%', `${pluriel(g.gagnees, 'gagnée')} sur ${pluriel(g.gagnees + g.perdues, 'résultat connu', 'résultats connus')}.`, 'var(--rouge)', 'rond'],
      ['Montant gagné', g.montantGagne ? Math.round(g.montantGagne).toLocaleString('fr-FR') : '0', '€', g.montantMoyen ? `${euros(g.montantMoyen)} en moyenne par marché ou mission.` : 'Aucun gain sur la période.', 'var(--jaune)', ''],
      ['Taux de go', g.tauxGo === null ? '–' : Math.round(g.tauxGo * 100), g.tauxGo === null ? '' : '%', `${pluriel(g.go, 'go', 'go')} sur ${pluriel(g.decidees, 'décision')}.`, 'var(--bleu)', ''],
      ['Temps passé', String(g.temps).replace('.', ','), 'h', g.euroParHeure ? `${euros(g.euroParHeure)} gagnés par heure de réponse.` : g.tempsMoyen ? `${heures(g.tempsMoyen)} par dossier en moyenne.` : 'Note le temps dans chaque dossier.', 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, fo]) => `<div class="tuile ${fo}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const etapes = [['Repérées', g.total, '#24221F'], ['Go', g.go, '#E8B93A'], ['Déposées', g.deposees, '#2E5A88'], ['Gagnées', g.gagnees, '#2E7D4F']];
    const max = Math.max(1, g.total);
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Sur les consultations repérées dans la période. Taux de réussite = gagnées ÷ (gagnées + perdues) : les dossiers sans suite et ceux en attente de réponse n'y entrent pas.</p></div>
        <div class="filtres" role="group" aria-label="Période">${PERIODES.map(([id, nom]) => `<button type="button" class="filtre" data-action="periode" data-id="${id}" aria-pressed="${periode === id}">${nom}</button>`).join('')}</div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">De la veille au gain <span>${g.enAttente ? `${pluriel(g.enAttente, 'dossier')} en attente de réponse, ` : ''}${pluriel(g.sansSuite, 'sans suite', 'sans suite')}, ${pluriel(g.abandons, 'abandon')}</span></h2>
      ${g.total ? `<figure class="entonnoir" aria-label="De la veille au gain, détail dans le tableau par type">
        ${etapes.map(([n, v, c], k) => `<div class="barre-ent" style="--c:${c}"><span class="ent-nom">${n}</span><span class="ent-piste"><i style="width:${Math.max(v ? 1.5 : 0, (v / max) * 100)}%"></i><b>${v}</b></span><span class="ent-taux">${k ? `${pct(etapes[k - 1][1] ? v / etapes[k - 1][1] : null)} <small>de l'étape précédente</small>` : ''}</span></div>`).join('')}
      </figure>` : '<p class="discret">Aucune consultation repérée dans cette période.</p>'}
      <h2 class="titre-section">Par type de consultation</h2>
      ${s.parType.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Type</th><th class="nb">Repérées</th><th class="nb">Go</th><th class="nb">Déposées</th><th class="nb">Gagnées</th><th class="nb">Réussite</th><th class="nb">Montant gagné</th><th class="nb">Temps moyen</th></tr></thead><tbody>${s.parType.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.total}</td><td class="nb">${x.go}</td><td class="nb">${x.deposees}</td><td class="nb">${x.gagnees}</td><td class="nb">${pct(x.tauxReussite)} <small>(${x.gagnees}/${x.gagnees + x.perdues})</small></td><td class="nb">${euros(x.montantGagne)}</td><td class="nb">${heures(x.tempsMoyen)}</td></tr>`).join('')}</tbody></table></div>
      <p class="mention">Sur quelques dossiers, un taux varie beaucoup : regarde aussi les effectifs entre parenthèses.</p>` : '<p class="discret">Aucune donnée dans cette période.</p>'}
      <h2 class="titre-section">Dépôts et gains des 12 derniers mois</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h3>Dossiers déposés et gagnés par mois</h3><div class="legende">${SERIES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(s.parMois)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Dépôts et gains par mois</caption><thead><tr><th>Mois</th><th>Déposées</th><th>Gagnées</th><th>Perdues</th></tr></thead><tbody>${s.parMois.map((m) => `<tr><td>${nomMois(m.mois, true)}</td><td>${m.deposees}</td><td>${m.gagnees}</td><td>${m.perdues}</td></tr>`).join('')}</tbody></table>
      </figure>
      ${s.parMotif.length ? `<h2 class="titre-section">Motifs de perte <span>${pluriel(g.perdues, 'dossier perdu', 'dossiers perdus')} dans la période</span></h2><div class="motifs">${s.parMotif.map((m) => `<div><b>${m.n}</b><span>${esc(m.nom)}</span></div>`).join('')}</div>` : ''}`;
  }
  const nomMois = (m, long = false) => versDate(`${m}-01`).toLocaleDateString('fr-FR', long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');
  function graphique(liste) {
    const L = Math.round(Math.min(760, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 230, g = 28, b = 26, hz = H - b - 10;
    const max = Math.max(4, ...liste.map((m) => Math.max(m.deposees, m.gagnees)));
    const pas = Math.ceil(max / 4), haut = pas * 4;
    const larg = (L - g) / liste.length;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const w = Math.max(5, Math.min(22, (larg - 10) / 2));
    const cols = liste.map((m, i) => {
      const x0 = g + i * larg + (larg - (w * 2 + 2)) / 2;
      const rects = SERIES.map(([k, , c], j) => (m[k] ? `<rect x="${x0 + j * (w + 2)}" y="${y(m[k])}" width="${w}" height="${Math.max(1, y(0) - y(m[k]))}" rx="3" fill="${c}" stroke="#24221F" stroke-width="1"/>` : '')).join('');
      const lab = (liste.length - 1 - i) % (L < 500 ? 3 : 1) === 0 ? `<text class="axe" x="${g + i * larg + larg / 2}" y="${H - 6}" text-anchor="middle">${nomMois(m.mois)}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne-g" data-i="${i}">${rects}</g>${lab}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Dossiers déposés et gagnés par mois sur 12 mois, détail dans le tableau">${grilles}${cols}</svg>`;
  }
  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const liste = R.statistiques(E.candidatures.filter(estOffre), { aujourdhui: auj(), mois: 12 }).parMois;
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), m = liste[i];
      fig.querySelectorAll('.colonne-g').forEach((x) => x.classList.toggle('active', x.dataset.i === String(i)));
      bulle.innerHTML = `<b>${nomMois(m.mois, true)}</b>${SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${m[k]}</div>`).join('')}<div>Perdues : ${m.perdues}</div>`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.zone').forEach((z) => { z.addEventListener('pointerenter', () => montrer(z)); z.addEventListener('click', () => montrer(z)); });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne-g').forEach((x) => x.classList.remove('active')); });
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
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (err === false) return;
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel() && !large) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
    else if (large) d.querySelector('.modale-tete button')?.focus();
  }

  const optionsModeles = (type, v) => B.modeles.filter((m) => !m.type || m.type === type).map((m) => `<option value="${m.id}" ${m.id === v ? 'selected' : ''}>${esc(m.nom)}${m.pieces.length ? ` (${m.pieces.length} pièces)` : ''}</option>`).join('');
  const verifierSecrets = (...v) => { const s = v.map(R.contientSecret).find(Boolean); return s ? R.MESSAGES_SENSIBLES[s] : ''; };
  const optionsListe = (liste, v) => liste.map((x) => `<option value="${esc(x.id)}" ${x.id === v ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const montantSaisi = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : R.montant(s) === null ? NaN : R.montant(s); };

  function modaleNouvelle(type = null, brouillon = {}) {
    const ty = typeDe(type && U().types.includes(type) ? type : U().types[0]);
    const offre = ty.famille === 'offres';
    const v = { modele: R.modeleParDefaut(ty.id), intitule: '', organisme: '', ville: '', limite: '', lien: '', depart: 'reperee', ...brouillon };
    ouvrirModale(`Nouvelle ${esc(M().une)}`, `
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut ${U().types.length === 4 ? 'choix-4' : U().types.length === 2 ? 'choix-2' : ''}">${typesUsage().map((t) => `<label><input type="radio" name="type" value="${t.id}" ${t.id === ty.id ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">${esc(ty.intitule)}<input name="intitule" maxlength="160" value="${esc(v.intitule)}" placeholder="${esc(ty.exemple)}"></label>
      <div class="rang-champs">
        <label class="champ">${esc(ty.organisme)}<input name="organisme" maxlength="120" value="${esc(v.organisme)}"></label>
        <label class="champ">${offre ? 'Référence' : 'Ville'}<input name="ville" maxlength="80" value="${esc(v.ville)}"></label>
      </div>
      ${offre ? `<label class="champ">Étape de départ<select name="depart"><option value="reperee" ${v.depart === 'reperee' ? 'selected' : ''}>Repérée : à décider avec la grille go/no-go</option><option value="go" ${v.depart === 'go' ? 'selected' : ''}>Go déjà décidé : créer le dossier et ses pièces</option></select></label>`
        : `<label class="champ">Liste de pièces de départ<small>Pièces souvent demandées : tu ajoutes ou retires ensuite.</small><select name="modele">${optionsModeles(ty.id, v.modele)}</select></label>`}
      <div class="rang-champs">
        <label class="champ">Date limite<small>${offre ? 'Celle du règlement ou de l\'annonce.' : 'Celle de l\'établissement ou de l\'offre.'}</small><input type="date" name="limite" value="${esc(v.limite)}"></label>
        <label class="champ">Lien ${offre ? 'du dossier' : 'de l\'offre'}<small>Facultatif.</small><input type="url" name="lien" maxlength="300" value="${esc(v.lien)}" placeholder="https://…"></label>
      </div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const intitule = String(f.get('intitule') || '').trim();
      const organisme = String(f.get('organisme') || '').trim();
      if (!intitule && !organisme) return 'Indique au moins l\'intitulé ou l\'organisme.';
      const lien = String(f.get('lien') || '').trim();
      if (lien && !/^https?:\/\/\S+$/i.test(lien)) return 'Le lien doit commencer par https://';
      const s = verifierSecrets(intitule, organisme, f.get('ville'));
      if (s) return s;
      retenir();
      const t = f.get('type');
      const offreT = R.familleDe(B, t) === 'offres';
      const ordre = offreT ? null : R.classement(E.candidatures, t).classees.length + 1;
      let c = R.normaliserCandidature({ id: uid(), type: t, intitule, organisme, ville: offreT ? '' : f.get('ville'), reference: offreT ? f.get('ville') : '', lien, statut: offreT ? 'reperee' : 'preparer', source: offreT ? B.sources[0] : '',
        dates: { limite: f.get('limite') || null, heureLimite: offreT ? '12:00' : '' }, pieces: offreT ? [] : R.piecesDuModele(B, f.get('modele')), creeLe: auj(), rang: ordre }, B);
      if (offreT && f.get('depart') === 'go') c = R.decider(c, 'go', { date: auj(), pieces: piecesGo(c) });
      E.candidatures.push(c);
      sauver();
      changerVue('candidatures', c.id);
      toast(c.statut === 'reperee' ? `« ${c.intitule || c.organisme} » ajoutée à la veille : remplis la grille pour décider.` : `« ${c.intitule || c.organisme} » créée avec ${pluriel(c.pieces.length, 'pièce')} à fournir.`, { libelle: 'Annuler', faire: annuler });
      if (c.statut === 'reperee') setTimeout(() => modaleGrille(c.id), 0);
    });
    modale().querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', () => {
      const d = modale();
      const lire = (n) => d.querySelector(`[name=${n}]`)?.value ?? '';
      modaleNouvelle(x.value, { intitule: lire('intitule'), organisme: lire('organisme'), ville: lire('ville'), limite: lire('limite'), lien: lire('lien'), depart: lire('depart') || 'reperee' });
    }));
  }

  function modaleModifier(id) {
    const c = cand(id);
    if (!c) return;
    const ty = typeDe(c.type);
    const offre = estOffre(c);
    const typesFamille = B.types.filter((x) => x.famille === ty.famille);
    ouvrirModale(esc(titreCand(c)), `
      <label class="champ">${esc(ty.intitule)}<input name="intitule" maxlength="160" value="${esc(c.intitule)}"></label>
      <div class="rang-champs">
        <label class="champ">${esc(ty.organisme)}<input name="organisme" maxlength="120" value="${esc(c.organisme)}"></label>
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(c.ville)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Type<select name="type">${optionsListe(typesFamille, c.type)}</select></label>
        <label class="champ">Contact<small>Service ou fonction, facultatif.</small><input name="contact" maxlength="120" value="${esc(c.contact)}" placeholder="${offre ? 'Ex. : Service de la commande publique' : 'Ex. : Service des admissions'}"></label>
      </div>
      ${offre ? `<div class="rang-champs">
        <label class="champ">Référence<small>Numéro donné par l'acheteur.</small><input name="reference" maxlength="80" value="${esc(c.reference)}"></label>
        <label class="champ">Source<select name="source">${B.sources.map((x) => `<option ${x === c.source ? 'selected' : ''}>${esc(x)}</option>`).join('')}${c.source && !B.sources.includes(c.source) ? `<option selected>${esc(c.source)}</option>` : ''}</select></label>
      </div>` : ''}
      <label class="champ">Lien ${offre ? 'du dossier de consultation' : 'de l\'offre'}<input type="url" name="lien" maxlength="300" value="${esc(c.lien)}" placeholder="https://…"></label>
      <fieldset class="champ cadre-champs"><legend>Dates <small>Recopie celles ${offre ? 'du règlement ou de l\'acheteur' : 'de l\'établissement ou du recruteur'}.</small></legend>
        ${offre ? `<div class="rang-champs"><label class="champ">Repérée le<input type="date" name="creeLe" value="${c.creeLe || ''}" max="${auj()}"></label><label class="champ">Questions jusqu'au<input type="date" name="questions" value="${c.dates.questions || ''}"></label></div>` : ''}
        <div class="rang-champs">
          <label class="champ">Date limite<input type="date" name="limite" value="${c.dates.limite || ''}"></label>
          ${offre ? `<label class="champ">Heure limite<input type="time" name="heureLimite" value="${esc(c.dates.heureLimite)}"></label>` : ''}
          <label class="champ">${offre ? 'Déposée le' : 'Envoyée le'}<input type="date" name="envoi" value="${c.dates.envoi || ''}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">${offre ? 'Audition ou soutenance' : c.type === 'formation' ? 'Entretien ou épreuve' : 'Entretien'}<input type="date" name="entretien" value="${c.dates.entretien || ''}"></label>
          <label class="champ">Heure<input type="time" name="heure" value="${esc(c.dates.heure)}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Format<select name="format">${B.formatsEntretien.map((x) => `<option value="${x.id}" ${x.id === c.entretien.format ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
          <label class="champ">Lieu ou lien<input name="lieu" maxlength="120" value="${esc(c.entretien.lieu)}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">${offre ? 'Résultat annoncé le' : 'Réponse attendue'}<input type="date" name="reponse" value="${c.dates.reponse || ''}"></label>
          <label class="champ">${offre ? 'Résultat reçu le' : 'Réponse reçue le'}<input type="date" name="recue" value="${c.dates.recue || ''}"></label>
        </div>
        ${offre ? `<div class="rang-champs"><label class="champ">Offre valable jusqu'au<small>Délai indiqué par l'acheteur.</small><input type="date" name="valable" value="${c.dates.valable || ''}"></label></div>` : ''}
      </fieldset>
      ${offre ? `<div class="rang-champs">
        <label class="champ">Montant estimé (€ HT)<input name="montantEstime" inputmode="decimal" value="${c.montantEstime ?? ''}"></label>
        <label class="champ">Montant de l'offre (€ HT)<input name="montantOffre" inputmode="decimal" value="${c.montantOffre ?? ''}"></label>
      </div>` : ''}
      <label class="champ">Notes<textarea name="note" rows="3" maxlength="2000">${esc(c.note)}</textarea></label>
      <label class="champ">Motif ou suite<small>Après une réponse : ${offre ? 'retour de l\'acheteur, points à améliorer' : 'motif d\'un refus, conditions d\'une acceptation, ta place sur liste d\'attente'}.</small><input name="motif" maxlength="300" value="${esc(c.motif)}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer définitivement « ${titreCand(c)} » ?`)) return false;
        retenir();
        E.candidatures = R.resserrer(E.candidatures.filter((x) => x.id !== c.id));
        sauver(); changerVue('candidatures'); toast(`« ${titreCand(c)} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      if (action === 'dupliquer') {
        retenir();
        const copie = R.normaliserCandidature({ ...structuredClone(c), id: uid(), statut: offre ? 'reperee' : 'preparer', decision: null, rang: null, intitule: `${c.intitule} (copie)`.slice(0, 160), dates: { limite: null, heureLimite: c.dates.heureLimite }, relances: [], motif: '', creeLe: auj(), temps: 0, montantObtenu: null, motifPerte: null, place: null, pieces: c.pieces.map((x) => ({ ...x, id: uid(), statut: x.statut === 'envoyee' ? 'prete' : x.statut, echeance: null })), entretien: { format: c.entretien.format, questions: c.entretien.questions.map((x) => ({ ...x, id: uid() })) } }, B);
        E.candidatures.push(copie);
        sauver(); changerVue('candidatures', copie.id); toast('Fiche dupliquée : mêmes pièces, sans les dates.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const lien = String(f.get('lien') || '').trim();
      if (lien && !/^https?:\/\/\S+$/i.test(lien)) return 'Le lien doit commencer par https://';
      if (!String(f.get('intitule') || '').trim() && !String(f.get('organisme') || '').trim()) return 'Indique au moins l\'intitulé ou l\'organisme.';
      const s = verifierSecrets(f.get('intitule'), f.get('organisme'), f.get('contact'), f.get('note'), f.get('motif'), f.get('lieu'), f.get('reference'));
      if (s) return s;
      const d = (n) => f.get(n) || null;
      if (d('recue') && d('envoi') && d('recue') < d('envoi')) return 'La réponse reçue est avant la date d\'envoi.';
      if (d('questions') && d('limite') && d('questions') > d('limite')) return 'La date des questions doit précéder la date limite.';
      const montants = offre ? { montantEstime: montantSaisi(f.get('montantEstime')), montantOffre: montantSaisi(f.get('montantOffre')) } : {};
      if (Object.values(montants).some((x) => Number.isNaN(x))) return 'Montant : un nombre, en euros.';
      retenir();
      const typeAvant = c.type;
      Object.assign(c, R.normaliserCandidature({ ...c, ...montants, intitule: f.get('intitule'), organisme: f.get('organisme'), ville: f.get('ville'), type: f.get('type'), contact: f.get('contact'), lien, note: f.get('note'), motif: f.get('motif'),
        reference: offre ? f.get('reference') : c.reference, source: offre ? f.get('source') : c.source, creeLe: offre ? d('creeLe') || c.creeLe : c.creeLe,
        rang: f.get('type') === typeAvant ? c.rang : null,
        dates: { ...c.dates, limite: d('limite'), heureLimite: offre ? f.get('heureLimite') || '' : c.dates.heureLimite, envoi: d('envoi'), entretien: d('entretien'), heure: f.get('heure') || '', reponse: d('reponse'), recue: d('recue'), questions: offre ? d('questions') : c.dates.questions, valable: offre ? d('valable') : c.dates.valable },
        entretien: { ...c.entretien, format: f.get('format'), lieu: f.get('lieu') } }, B));
      if (c.type !== typeAvant) E.candidatures = R.resserrer(E.candidatures);
      sauver(); rendre(); toast('Fiche enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Changement de statut depuis la fiche. Pour un appel d'offres : le go crée le dossier, le dépôt et le résultat
  // passent par leur fenêtre (montant, validité, motif), le no-go par la grille.
  function changerStatut(id, statut) {
    const c = cand(id);
    if (!c || c.statut === statut) return;
    if (estOffre(c)) {
      if (statut === 'preparer' && c.statut === 'reperee') return decider(id, 'go');
      if (statut === 'nogo') return modaleGrille(id);
      if (statut === 'envoyee' && !['entretien'].includes(c.statut)) return modaleDepot(id);
      if (['acceptee', 'refusee', 'sanssuite'].includes(statut)) return modaleResultat(id, statut);
      if (statut === 'retiree' && !confirm(`Abandonner « ${titreCand(c)} » ?`)) return;
    }
    const avant = R.avancement(c);
    retenir();
    const n = R.changerStatut(c, statut, auj());
    Object.assign(c, n);
    if (['refusee', 'retiree', 'nogo', 'sanssuite'].includes(statut)) E.candidatures = R.resserrer(E.candidatures);
    sauver(); rendre();
    const offre = estOffre(c);
    const msg = {
      envoyee: avant.manquantes ? `Envoyée. Attention : ${pluriel(avant.manquantes, 'pièce n\'était pas prête', 'pièces n\'étaient pas prêtes')}.` : `Envoyée le ${dateLongue(c.dates.envoi)} : bonne chance !`,
      entretien: offre ? 'Statut « Audition » : note la date dans la fiche.' : 'Statut « Entretien » : note la date et prépare les questions.',
      acceptee: 'Acceptée : bravo ! Pense aux pièces à fournir après acceptation et à répondre dans les délais indiqués.',
      refusee: 'Refusée : la candidature sort de ton classement. Note le motif si tu le connais.',
      attente: 'Liste d\'attente : note ta place dans « Motif ou suite » et la date de réponse annoncée.',
      retiree: offre ? 'Dossier abandonné.' : 'Retirée : la candidature sort de ton classement.',
      preparer: offre ? 'Repassée « En préparation ».' : 'Repassée « À préparer ».',
      reperee: 'Repassée en veille : la décision est effacée.',
    }[statut] || `Statut : ${nomStatut(c)}.`;
    toast(msg, { libelle: 'Annuler', faire: annuler });
    if (statut === 'entretien' && !c.dates.entretien) setTimeout(() => modaleModifier(id), 0);
  }

  // ---------- Appels d'offres : grille, décision, dépôt, résultat ----------
  function modaleGrille(id) {
    const c = cand(id);
    if (!c) return;
    const notes = { ...(c.grille || {}) };
    const criteres = E.criteres.filter((k) => k.poids > 0);
    const corps = `
      <p class="aide">Note chaque critère de 0 (non) à 3 (fort). Les critères marqués « éliminatoire » notés 0 conduisent à un no-go conseillé. Poids et seuils dans les réglages.</p>
      <div class="grille-gonogo">${criteres.map((k) => `<fieldset class="critere"><legend><b>${esc(k.nom)}</b>${k.eliminatoire ? ' <span class="etiquette rose">Éliminatoire</span>' : ''} <small>poids ${k.poids}</small><span>${esc(k.question)}</span></legend>
        <div class="segment-notes">${B.notes.map((n, i) => `<label><input type="radio" name="n-${k.id}" value="${i}" ${notes[k.id] === i ? 'checked' : ''}><span>${i} · ${n}</span></label>`).join('')}</div></fieldset>`).join('')}</div>
      <div class="resultat-grille" id="resultat-grille"></div>
      <label class="champ">Motif de la décision<small>Facultatif ; gardé avec un no-go pour affiner ta veille.</small><input name="motif" maxlength="200" value="${esc(c.decision?.motif || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = c.statut === 'reperee'
      ? '<button class="btn primaire" value="go">Go : créer le dossier</button><button class="btn" value="ok">Enregistrer sans décider</button><button class="btn danger gauche" value="nogo">No-go</button>'
      : '<button class="btn primaire" value="ok">Enregistrer la grille</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(`Go/no-go · ${esc(c.intitule || titreCand(c))}`, corps, pied, (f, action) => {
      const motif = String(f.get('motif') || '').trim();
      const s = verifierSecrets(motif);
      if (s) return s;
      retenir();
      c.grille = notes;
      if (action === 'go' || action === 'nogo') { setTimeout(() => decider(c.id, action, motif, true), 0); return; }
      if (c.decision && motif !== c.decision.motif) c.decision.motif = motif;
      sauver(); rendre(); toast('Grille enregistrée.', { libelle: 'Annuler', faire: annuler });
    }, true);
    const maj = () => {
      const s = R.scoreGrille(E.criteres, notes, seuils());
      const reco = s.recommandation ? RECO[s.recommandation] : null;
      $('#resultat-grille').innerHTML = `<div class="score">${jaugeScore(s)}<span><b>${s.pct ?? 0} %</b> · ${s.notes}/${s.total} critères notés</span></div>
        <p>${reco ? `<span class="etiquette ${reco[1]}">${reco[0]}</span> ` : ''}${s.eliminatoires.length ? `Critère éliminatoire à 0 : ${s.eliminatoires.map((x) => esc(E.criteres.find((k) => k.id === x)?.nom)).join(', ')}.` : s.complet ? `Seuils : go à partir de ${E.reglages.seuilGo} %, à discuter à partir de ${E.reglages.seuilDiscuter} %.` : 'Note tous les critères pour obtenir une recommandation.'}</p>`;
    };
    modale().querySelectorAll('.segment-notes input').forEach((r) => r.addEventListener('change', () => { notes[r.name.slice(2)] = Number(r.value); maj(); }));
    maj();
  }

  function decider(id, choix, motif = '', dejaRetenu = false) {
    const c = cand(id);
    if (!c || c.statut !== 'reperee') return;
    if (!dejaRetenu) retenir();
    Object.assign(c, R.decider(c, choix, { date: auj(), motif, pieces: piecesGo(c) }));
    if (choix === 'nogo') E.candidatures = R.resserrer(E.candidatures);
    sauver(); rendre();
    toast(choix === 'go' ? `Go : dossier créé avec ${pluriel(c.pieces.length, 'pièce')}.${c.dates.limite ? '' : ' Saisis la date limite pour calculer les échéances.'}` : 'No-go enregistré : consultation écartée.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleDepot(id) {
    const c = cand(id);
    if (!c) return;
    const a = R.avancement(c);
    const t = auj();
    ouvrirModale('Dossier déposé', `
      ${a.manquantes ? `<p class="aide">${pluriel(a.manquantes, 'pièce')} pas encore marquée${a.manquantes > 1 ? 's' : ''} prête${a.manquantes > 1 ? 's' : ''}. Toutes les pièces passent « envoyées » au dépôt.</p>` : ''}
      <div class="rang-champs"><label class="champ">Déposée le<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ">Montant de l'offre (€ HT)<input name="montant" inputmode="decimal" value="${c.montantOffre ?? c.montantEstime ?? ''}"></label></div>
      <label class="champ">Offre valable jusqu'au<small>Facultatif, selon l'acheteur.</small><input type="date" name="valable" value="${c.dates.valable || ''}"></label>
      <p class="aide">Une relance sera proposée ${typeDe(c.type).relance ? `${typeDe(c.type).relance} jours après le dépôt (type « ${esc(nomType(c.type))} »)` : `${E.reglages.relance} jours après le dépôt`}, modifiable ensuite dans la fiche. Garde l'accusé de réception du dépôt avec le dossier.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer le dépôt</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const m = montantSaisi(f.get('montant'));
      if (Number.isNaN(m)) return 'Montant : un nombre, en euros.';
      if (!R.estDate(f.get('date'))) return 'Indique la date du dépôt.';
      retenir();
      Object.assign(c, R.deposer(c, { date: f.get('date'), montantOffre: m, valable: f.get('valable') || null }));
      sauver(); rendre();
      const r = R.relance(c, auj(), E.reglages.relance, B);
      toast(`Déposée.${r ? ` Relance proposée le ${dateLongue(r.date)}.` : ''}`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleResultat(id, defaut = 'acceptee') {
    const c = cand(id);
    if (!c) return;
    const t = auj();
    ouvrirModale(`Résultat · ${esc(c.intitule || titreCand(c))}`, `
      <fieldset class="choix-resultat"><legend class="sr-only">Résultat</legend>${[['acceptee', 'Gagnée'], ['refusee', 'Perdue'], ['sanssuite', 'Sans suite']].map(([v, n]) => `<label><input type="radio" name="statut" value="${v}" ${v === defaut ? 'checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>
      <div class="rang-champs"><label class="champ">Date du résultat<input type="date" name="date" value="${c.dates.recue || t}" max="${t}"></label>
      <label class="champ" data-si="acceptee">Montant attribué (€ HT)<input name="montant" inputmode="decimal" value="${c.montantObtenu ?? c.montantOffre ?? ''}"></label></div>
      <div class="rang-champs" data-si="refusee"><label class="champ">Motif<select name="motifPerte">${optionsListe(B.motifsPerte, c.motifPerte || 'inconnu')}</select></label>
      <label class="champ">Classement<small>Si l'acheteur le communique.</small><input type="number" name="place" min="1" max="99" value="${c.place ?? ''}"></label></div>
      <label class="champ">Note<small>Retour de l'acheteur, points à améliorer.</small><input name="motif" maxlength="300" value="${esc(c.motif)}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const st = f.get('statut');
      const m = st === 'acceptee' ? montantSaisi(f.get('montant')) : null;
      if (Number.isNaN(m)) return 'Montant : un nombre, en euros.';
      const s = verifierSecrets(f.get('motif'));
      if (s) return s;
      retenir();
      Object.assign(c, R.cloturer(c, st, { date: f.get('date') || t, montantObtenu: m, motifPerte: st === 'refusee' ? f.get('motifPerte') : null, place: st === 'refusee' ? f.get('place') : null, motif: String(f.get('motif') || '').trim() }));
      if (!c.dates.envoi) c.dates.envoi = c.dates.recue;
      E.candidatures = R.resserrer(E.candidatures);
      sauver(); rendre();
      toast(st === 'acceptee' ? 'Bravo : marché gagné, compté dans le bilan.' : `${nomStatut(c)} : noté dans le bilan.`, { libelle: 'Annuler', faire: annuler });
    });
    const maj = () => { const st = modale().querySelector('[name=statut]:checked').value; modale().querySelectorAll('[data-si]').forEach((el) => { el.hidden = el.dataset.si !== st; }); };
    modale().querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', maj));
    maj();
  }

  // ---------- Pièces d'une fiche ----------
  function modalePiece(id, pid) {
    const c = cand(id);
    if (!c) return;
    const x = pid ? c.pieces.find((y) => y.id === pid) : null;
    if (pid && !x) return;
    const offre = estOffre(c);
    const dispo = offre ? [] : B.pieces.filter((p) => !c.pieces.some((y) => y.ref === p.id));
    const v = x || { ref: '', nom: '', statut: 'afaire', apres: false, precision: '', delai: offre ? 3 : null, echeance: null, responsable: offre ? E.profil.prenom : '', biblio: null, type: null };
    const ref = v.ref ? R.pieceDe(B, v.ref) : null;
    const calc = R.echeancePiece({ ...v, echeance: null }, c.dates.limite);
    const candidates = E.biblio.filter((b) => !v.type || b.type === v.type);
    const autres = E.biblio.filter((b) => v.type && b.type !== v.type);
    const optBib = `<option value="">Aucune pièce liée</option>${candidates.map((b) => `<option value="${b.id}" ${b.id === v.biblio ? 'selected' : ''}>${esc(b.titre)}</option>`).join('')}${autres.length ? `<optgroup label="Autres pièces">${autres.map((b) => `<option value="${b.id}" ${b.id === v.biblio ? 'selected' : ''}>${esc(b.titre)}</option>`).join('')}</optgroup>` : ''}`;
    ouvrirModale(x ? esc(x.nom) : 'Ajouter une pièce', `
      ${x ? (ref ? `<p class="aide">${esc(ref.aide)}</p>` : '') : offre ? '' : `<label class="champ">Pièce type<select name="ref"><option value="">Autre pièce (nom libre)</option>${dispo.map((p) => `<option value="${p.id}">${esc(p.nom)}${p.apres ? ' (après acceptation)' : ''}</option>`).join('')}</select></label>`}
      <label class="champ">Nom<small>${x || offre ? '' : 'Laisse vide pour reprendre le nom de la pièce type.'}</small><input name="nom" maxlength="160" value="${esc(v.nom)}" placeholder="${offre ? 'Ex. : Attestation demandée par le règlement' : 'Ex. : Questionnaire de motivation'}"></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut ${offre ? 'choix-5' : 'choix-4'}">${B.statutsPiece.filter((s) => offre || s.id !== 'sansobjet' || v.statut === 'sansobjet').map((s) => `<label><input type="radio" name="statut" value="${s.id}" ${s.id === v.statut ? 'checked' : ''}><span>${esc(s.nom)}</span></label>`).join('')}</div></fieldset>
      ${offre ? `<div class="rang-champs">
        <label class="champ">Jours avant la date limite<small>Rétroplanning${calc && !v.echeance ? ` : prête le ${dateLongue(calc)}` : ''}.</small><input type="number" name="delai" min="0" max="90" value="${v.delai ?? ''}" inputmode="numeric"></label>
        <label class="champ">Ou prête le<small>Date fixée à la main.</small><input type="date" name="echeance" value="${v.echeance || ''}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Responsable<input name="responsable" maxlength="40" value="${esc(v.responsable)}"></label>
        <label class="champ">Pièce de la bibliothèque<small>Pièce réutilisable qui la couvre.</small><select name="biblio">${optBib}</select></label>
      </div>` : ''}
      <label class="champ">Précision<small>${offre ? 'Format attendu, signataire, article du règlement.' : 'Qui la remplit, à qui tu l\'as demandée, le format attendu.'}</small><input name="precision" maxlength="120" value="${esc(v.precision)}"></label>
      ${offre ? '' : `<label class="case"><input type="checkbox" name="apres" ${v.apres ? 'checked' : ''}> À fournir seulement après acceptation</label>`}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        retenir(); c.pieces = c.pieces.filter((y) => y.id !== x.id);
        sauver(); rendre(); toast(`« ${x.nom} » retirée de la liste.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const refChoisie = x ? x.ref : (f.get('ref') || null);
      const nom = String(f.get('nom') || '').trim() || (refChoisie ? R.pieceDe(B, refChoisie)?.nom : '');
      if (!nom) return 'Donne un nom à la pièce.';
      const s = verifierSecrets(nom, f.get('precision'), f.get('responsable'));
      if (s) return s;
      const delai = offre && String(f.get('delai') ?? '').trim() !== '' ? Number(f.get('delai')) : null;
      if (delai !== null && (!Number.isInteger(delai) || delai < 0 || delai > 90)) return 'Jours avant la date limite : un entier de 0 à 90.';
      retenir();
      const biblio = offre ? f.get('biblio') || null : v.biblio;
      let statut = f.get('statut');
      if (offre && biblio && biblio !== v.biblio && statut === 'afaire' && R.etatBiblio(E.biblio.find((b) => b.id === biblio), auj(), 0)?.etat !== 'expiree') statut = 'prete';
      const n = R.normaliserPiece({ ...v, id: x?.id || uid(), ref: refChoisie, nom, statut, precision: f.get('precision'), apres: offre ? false : Boolean(f.get('apres')),
        delai: offre ? delai : v.delai, echeance: offre ? f.get('echeance') || null : v.echeance, responsable: offre ? f.get('responsable') : v.responsable, biblio }, B);
      if (x) Object.assign(x, n); else c.pieces.push(n);
      sauver(); rendre(); toast(x ? 'Pièce enregistrée.' : `« ${n.nom} » ajoutée.`, { libelle: 'Annuler', faire: annuler });
    });
    const sRef = modale().querySelector('[name=ref]');
    if (sRef) sRef.addEventListener('change', () => { const p = R.pieceDe(B, sRef.value); modale().querySelector('[name=apres]').checked = Boolean(p?.apres); });
  }

  function cyclerPiece(id, pid) {
    const c = cand(id);
    const x = c?.pieces.find((y) => y.id === pid);
    if (!x) return;
    x.statut = R.pieceSuivante(x.statut);
    sauver(); rendre();
    const b = document.querySelector(`[data-action=piece-statut][data-piece="${pid}"]`);
    if (b) b.focus({ preventScroll: true });
  }
  function piecePrete(id, pid) {
    const c = cand(id);
    const x = c?.pieces.find((y) => y.id === pid);
    if (!x) return;
    retenir();
    x.statut = 'prete';
    sauver(); rendre();
    const a = R.avancement(c);
    toast(`${x.nom} : prête (${a.pretes}/${a.total}).`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Relances ----------
  function modaleRelance(id, rid = null, defaut = {}) {
    const c = cand(id);
    if (!c) return;
    const x = rid ? c.relances.find((y) => y.id === rid) : null;
    const v = x || { date: auj(), canal: 'email', note: '', ...defaut };
    ouvrirModale(x ? 'Relance' : 'Noter une relance', `
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" required value="${v.date || ''}"></label>
        <label class="champ">Par<select name="canal">${B.canaux.map((k) => `<option value="${k.id}" ${k.id === v.canal ? 'selected' : ''}>${esc(k.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Note<small>Facultative : ${estOffre(c) ? 'réponse obtenue, interlocuteur (fonction), date annoncée' : 'ce qui a été dit, la réponse promise'}.</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') { retenir(); c.relances = c.relances.filter((y) => y.id !== x.id); sauver(); rendre(); toast('Relance supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      if (!R.estDate(f.get('date'))) return 'Indique la date de la relance.';
      if (f.get('date') > auj()) return 'Une relance se note une fois faite : la date ne peut pas être dans le futur.';
      const s = verifierSecrets(f.get('note'));
      if (s) return s;
      retenir();
      if (x) { Object.assign(x, R.normaliserRelance({ id: x.id, date: f.get('date'), canal: f.get('canal'), note: f.get('note') })); c.relances.sort((a, b) => (a.date < b.date ? -1 : 1)); }
      else Object.assign(c, R.noterRelance(c, { date: f.get('date'), canal: f.get('canal'), note: f.get('note') }));
      sauver(); rendre(); toast('Relance notée : le délai repart de cette date.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleDateRelance(id) {
    const c = cand(id);
    if (!c) return;
    const r = R.relance(c, auj(), E.reglages.relance, B);
    ouvrirModale('Date de relance', `
      <label class="champ">Relancer le<small>${c.dates.relancer ? 'Date fixée à la main.' : r ? `Proposée aujourd'hui pour le ${dateLongue(r.date)}.` : 'Aucune relance proposée pour l\'instant.'}</small><input type="date" name="date" value="${c.dates.relancer || (r && r.date >= auj() ? r.date : auj())}" min="${auj()}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${c.dates.relancer ? '<button class="btn gauche" value="auto">Revenir au délai automatique</button>' : ''}`, (f, action) => {
      retenir();
      if (action === 'auto') { c.dates.relancer = null; sauver(); rendre(); toast('Relance au délai automatique.', { libelle: 'Annuler', faire: annuler }); return; }
      if (!R.estDate(f.get('date'))) return 'Choisis une date.';
      c.dates.relancer = f.get('date');
      sauver(); rendre(); toast(`Relance prévue le ${dateLongue(c.dates.relancer)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleMessage(id, raison) {
    const c = cand(id);
    if (!c) return;
    const r = raison || R.relance(c, auj(), E.reglages.relance, B)?.raison || '';
    const texte = R.messageRelance(B, c, E.profil, dateLongue, r);
    ouvrirModale(r === 'remerciement' ? 'Message de remerciement' : 'Message de relance', `
      <p>Copie ce message, adapte-le, puis envoie-le toi-même${c.contact ? ` (${esc(c.contact)})` : ''}. L'application n'envoie rien.</p>
      <label class="champ"><span class="sr-only">Message</span><textarea id="message-relance" rows="11">${esc(texte)}</textarea></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Copier et noter la relance</button><button class="btn" value="copier">Copier seulement</button><button class="btn" value="annuler">Fermer</button>', (_, action) => {
      const t = $('#message-relance').value;
      copier(t, 'Message copié.');
      if (action === 'ok') {
        retenir();
        Object.assign(c, R.noterRelance(c, { date: auj(), canal: 'email', note: r === 'remerciement' ? 'Remerciement après l\'entretien' : 'Relance' }));
        sauver(); rendre();
        setTimeout(() => toast('Message copié, relance notée aujourd\'hui.', { libelle: 'Annuler', faire: annuler }), 50);
      }
    });
  }

  async function copier(texte, message) {
    try { await navigator.clipboard.writeText(texte); toast(message); return; } catch { /* repli ci-dessous */ }
    const t = document.createElement('textarea');
    t.value = texte; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    toast(ok ? message : 'Copie impossible ici : sélectionne le texte à la main.');
  }

  // ---------- Bibliothèque et modèles de dossiers ----------
  function modaleBiblio(id) {
    const b = id ? E.biblio.find((x) => x.id === id) : null;
    if (id && !b) return;
    ouvrirModale(b ? 'Modifier la pièce' : 'Nouvelle pièce réutilisable', `
      <label class="champ">Intitulé<input name="titre" maxlength="160" value="${esc(b?.titre || '')}" placeholder="Ex. : Référence · client, mission"></label>
      <label class="champ">Type<select name="type">${optionsListe(B.typesPieces, b?.type || 'reference')}</select></label>
      <label class="champ">Où la trouver<small>Dossier et nom du fichier, ou emplacement papier. Le fichier lui-même n'est pas enregistré ici.</small><input name="reference" maxlength="200" value="${esc(b?.reference || '')}"></label>
      <div class="rang-champs"><label class="champ">Émise ou mise à jour le<input type="date" name="emisLe" value="${b?.emisLe || ''}"></label>
      <label class="champ">Valable jusqu'au<small>Date indiquée sur la pièce, si elle en a une.</small><input type="date" name="valideJusquau" value="${b?.valideJusquau || ''}"></label></div>
      <label class="champ">Note<textarea name="note" maxlength="600">${esc(b?.note || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`,
    b ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'supprimer') {
        const n = E.candidatures.filter((c) => c.pieces.some((p) => p.biblio === b.id)).length;
        if (!confirm(`Supprimer « ${b.titre} »${n ? ` ? Elle est liée à ${pluriel(n, 'dossier')} : le lien sera retiré` : ''} ?`)) return false;
        retenir();
        E.biblio = E.biblio.filter((x) => x.id !== b.id);
        E.candidatures.forEach((c) => c.pieces.forEach((p) => { if (p.biblio === b.id) p.biblio = null; }));
        sauver(); rendre(); toast('Pièce supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const v = R.normaliserBiblio({ id: b?.id || uid(), titre: f.get('titre'), type: f.get('type'), reference: f.get('reference'), emisLe: f.get('emisLe'), valideJusquau: f.get('valideJusquau'), note: f.get('note') }, B);
      if (!String(f.get('titre') || '').trim()) return 'Indique l\'intitulé de la pièce.';
      if (v.emisLe && v.valideJusquau && v.valideJusquau < v.emisLe) return 'La fin de validité doit suivre la date d\'émission.';
      const s = verifierSecrets(f.get('titre'), f.get('reference'), f.get('note'));
      if (s) return s;
      retenir();
      if (b) Object.assign(b, v); else E.biblio.push(v);
      sauver(); rendre(); toast(b ? 'Pièce enregistrée.' : 'Pièce ajoutée à la bibliothèque.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleModele(id) {
    const m = E.dossiers.find((x) => x.id === id);
    if (!m) return;
    const texte = m.pieces.map((p) => `${p.delai} ; ${p.libelle}`).join('\n');
    ouvrirModale(`Modèle · ${esc(m.nom)}`, `
      <label class="champ">Description<input name="description" maxlength="200" value="${esc(m.description || '')}"></label>
      <label class="champ">Pièces, une par ligne<small>« jours avant la date limite ; libellé ». Ex. : « 4 ; Attestation d'assurance ».</small><textarea name="pieces" rows="12">${esc(texte)}</textarea></label>
      <p class="aide">Les dossiers déjà créés gardent leurs pièces ; le modèle sert aux prochains go.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" value="origine">Modèle d\'origine</button>', (f, action) => {
      retenir();
      if (action === 'origine') { const o = B.dossiers.find((x) => x.id === m.id); if (o) Object.assign(m, JSON.parse(JSON.stringify(o))); sauver(); rendre(); toast('Modèle d\'origine remis.', { libelle: 'Annuler', faire: annuler }); return; }
      const lignes = String(f.get('pieces') || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const pieces = [];
      for (const l of lignes) {
        const [a, ...reste] = l.split(';');
        const delai = Number(a.trim());
        const libelle = reste.join(';').trim();
        if (!Number.isInteger(delai) || delai < 0 || delai > 90 || !libelle) return `Ligne à corriger : « ${l} » (attendu : nombre de jours ; libellé).`;
        const avant = m.pieces.find((p) => p.libelle === libelle);
        pieces.push({ libelle: libelle.slice(0, 160), delai, ...(avant?.type ? { type: avant.type } : {}) });
      }
      if (!pieces.length) return 'Garde au moins une pièce.';
      m.pieces = pieces; m.description = String(f.get('description') || '').trim().slice(0, 200);
      sauver(); rendre(); toast('Modèle enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Lettre et entretien : saisies sans re-rendu ----------
  function majApercuLettre(c) {
    const trame = R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c));
    const a = $('#apercu-lettre');
    if (a) a.innerHTML = apercuLettre(c, trame);
    const n = nbManquants(c, trame);
    const m = $('#lettre-manquants');
    if (m) m.textContent = n ? `${pluriel(n, 'champ')} à compléter` : 'complet';
  }
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.champ !== undefined) {
      const c = cand(el.closest('form')?.dataset.id);
      if (!c) return;
      const s = R.contientSecret(el.value);
      el.closest('form').querySelector('.erreur').textContent = s ? R.MESSAGES_SENSIBLES[s] : '';
      if (s) return;
      c.lettre.trame = c.lettre.trame || R.trameConseillee(B, c);
      c.lettre.champs[el.dataset.champ] = el.value.slice(0, 400);
      sauver(); majApercuLettre(c);
    } else if (el.id === 'lettre-libre') {
      const c = cand(el.dataset.id); if (!c) return;
      c.lettre.texte = el.value.slice(0, 6000) || ' ';
      sauver();
    } else if (el.dataset.notes !== undefined) {
      const c = cand(el.dataset.id); const x = c?.entretien.questions.find((y) => y.id === el.dataset.notes);
      if (!x || R.contientSecret(el.value)) return;
      x.notes = el.value.slice(0, 1200); sauver();
    } else if (el.dataset.notesEntretien !== undefined) {
      const c = cand(el.dataset.id); if (!c || R.contientSecret(el.value)) return;
      c.entretien.notes = el.value.slice(0, 2000); sauver();
    }
  });

  function choisirQuestion(id, qid) {
    const c = cand(id); const ref = R.questionDe(B, qid);
    if (!c || !ref || c.entretien.questions.some((x) => x.ref === qid)) return;
    c.entretien.questions.push(R.normaliserQuestion({ id: uid(), ref: qid }, B));
    sauver(); rendre();
    toast('Question ajoutée à ta préparation.');
  }
  function ajouterQuestion(id) {
    const c = cand(id); const champ = $('#form-question [name=question]');
    const texte = champ?.value.trim();
    if (!c || !texte) { champ?.focus(); return; }
    if (R.contientSecret(texte)) { toast(R.MESSAGES_SENSIBLES[R.contientSecret(texte)]); return; }
    c.entretien.questions.push(R.normaliserQuestion({ id: uid(), texte }, B));
    sauver(); rendre();
    $('#form-question [name=question]')?.focus();
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
  const enTete = (titre, sous = '') => `<header><p>${esc(E.profil.signature || E.profil.prenom || NOM)}${E.profil.campagne ? ` · ${esc(E.profil.campagne)}` : ''} · au ${dateLongue(auj())}</p><h1>${titre}</h1>${sous ? `<p>${sous}</p>` : ''}</header>`;
  const dateTxt = (d) => (d ? dateCourte(d) + ' ' + d.slice(0, 4) : '');

  function imprimerRecap() {
    const liste = R.trier(E.candidatures, auj());
    imprimer(`${enTete(`Mes ${esc(M().liste.toLowerCase())}`, `${pluriel(liste.length, 'fiche')}, dont ${R.bilan(E.candidatures, auj(), E.reglages, B).actives} en cours`)}
      <table><thead><tr><th>Intitulé</th><th>Type</th><th>Statut</th><th>Date limite</th><th>Envoyée</th><th>Entretien</th><th>Réponse</th><th>Pièces</th></tr></thead><tbody>${liste.map((c) => { const a = R.avancement(c); return `<tr><td><b>${esc(c.intitule)}</b><br>${esc(c.organisme)}${c.ville ? `, ${esc(c.ville)}` : ''}</td><td>${esc(nomType(c.type))}${c.rang && R.classable(c) ? ` · n°${c.rang}` : ''}</td><td>${esc(nomStatut(c))}</td><td>${dateTxt(c.dates.limite)}</td><td>${dateTxt(c.dates.envoi)}</td><td>${dateTxt(c.dates.entretien)}${c.dates.heure ? ` ${esc(c.dates.heure)}` : ''}</td><td>${c.dates.recue ? `reçue ${dateTxt(c.dates.recue)}` : c.dates.reponse ? `attendue ${dateTxt(c.dates.reponse)}` : ''}</td><td>${a.pretes}/${a.total}</td></tr>`; }).join('')}</tbody></table>
      <p class="mention">Dates saisies par l'utilisateur, à vérifier auprès de chaque établissement, recruteur ou acheteur.</p>`, 'impr-liste');
  }

  function imprimerDossier(id) {
    const c = cand(id); if (!c) return;
    const offre = estOffre(c);
    const t = auj();
    imprimer(`${enTete(esc(c.intitule || titreCand(c)), `${esc(nomType(c.type))} · ${esc(c.organisme)}${c.ville ? `, ${esc(c.ville)}` : ''}${c.reference ? ` · réf. ${esc(c.reference)}` : ''} · ${esc(nomStatut(c))}`)}
      <h2>Dates</h2><table><tbody>${[['Date limite', c.dates.limite], [offre ? 'Questions jusqu\'au' : '', c.dates.questions], [offre ? 'Déposée le' : 'Envoyée le', c.dates.envoi], ['Entretien', c.dates.entretien], ['Réponse attendue', c.dates.reponse], ['Réponse reçue', c.dates.recue], [offre ? 'Offre valable jusqu\'au' : '', c.dates.valable]].filter(([l]) => l).map(([l, d]) => `<tr><th style="width:35%">${l}</th><td>${d ? dateLongue(d) : ''}${l === 'Entretien' && c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''}${l === 'Date limite' && c.dates.heureLimite ? ` à ${esc(c.dates.heureLimite)}` : ''}</td></tr>`).join('')}</tbody></table>
      ${offre ? `<h2>Offre</h2><table><tbody><tr><th style="width:35%">Montant estimé</th><td>${euros(c.montantEstime)}</td></tr><tr><th>Montant de l'offre</th><td>${euros(c.montantOffre)}</td></tr>${c.statut === 'acceptee' ? `<tr><th>Montant obtenu</th><td>${euros(c.montantObtenu ?? c.montantOffre)}</td></tr>` : ''}${c.motifPerte ? `<tr><th>Motif de perte</th><td>${esc(nomMotif(c.motifPerte))}</td></tr>` : ''}<tr><th>Temps passé</th><td>${heures(c.temps)}</td></tr></tbody></table>` : ''}
      <h2>Pièces à fournir</h2><table><thead><tr><th style="width:8%">Fait</th><th>Pièce</th><th>Statut</th>${offre ? '<th>Échéance</th><th>Responsable</th>' : ''}<th>Précision</th></tr></thead><tbody>${c.pieces.map((x) => `<tr class="${x.statut === 'sansobjet' ? 'so' : ''}"><td>${x.statut === 'prete' || x.statut === 'envoyee' ? '☑' : '☐'}</td><td><b>${esc(x.nom)}</b>${x.apres ? ' (après acceptation)' : ''}</td><td>${esc(nomStatutPiece(x.statut))}</td>${offre ? `<td>${dateTxt(R.etatPiece(x, c, t, E.biblio).echeance)}</td><td>${esc(x.responsable)}</td>` : ''}<td>${esc(x.precision)}</td></tr>`).join('') || `<tr><td colspan="${offre ? 6 : 4}">Aucune pièce listée</td></tr>`}</tbody></table>
      ${c.relances.length ? `<h2>Relances</h2><table><tbody>${c.relances.map((x) => `<tr><td style="width:30%">${dateLongue(x.date)}</td><td>${esc(nomCanal(x.canal))}</td><td>${esc(x.note)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${c.note || c.motif ? `<h2>Notes</h2>${c.note ? `<p>${esc(c.note)}</p>` : ''}${c.motif ? `<p><b>Motif ou suite :</b> ${esc(c.motif)}</p>` : ''}` : ''}`, 'impr-liste');
  }

  function texteLettre(c) {
    if (c.lettre.texte && c.lettre.texte.trim()) return c.lettre.texte;
    return R.composerLettre(c, R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c)), E.profil).texte;
  }
  function imprimerLettre(id) {
    const c = cand(id); if (!c) return;
    imprimer(`<div class="lettre-impr">${texteLettre(c).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</div>`, 'impr-lettre');
  }
  function imprimerEntretien(id) {
    const c = cand(id); if (!c) return;
    imprimer(`${enTete(`Entretien · ${esc(titreCand(c))}`, `${esc(c.intitule)}${c.dates.entretien ? ` · ${dateLongue(c.dates.entretien)}${c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''}` : ''} · ${esc(nomFormat(c.entretien.format))}${c.entretien.lieu ? ` · ${esc(c.entretien.lieu)}` : ''}`)}
      ${c.entretien.questions.map((x) => `<h2>${esc(x.texte)}</h2><p>${esc(x.notes || '…').replace(/\n/g, '<br>')}</p>`).join('') || '<p>Aucune question préparée.</p>'}
      ${c.entretien.notes ? `<h2>Notes générales</h2><p>${esc(c.entretien.notes).replace(/\n/g, '<br>')}</p>` : ''}`, 'impr-liste');
  }
  function imprimerEcheances() {
    const evs = R.regrouperPieces(tousEvs(E.candidatures));
    imprimer(`${enTete('Mes échéances', pluriel(evs.length, 'date'))}
      <table><thead><tr><th>Date</th><th>Quoi</th><th>Fiche</th><th>Fait</th></tr></thead><tbody>${evs.map((e) => `<tr class="${e.jours < 0 ? 'retard' : ''}"><td>${dateJour(e.date)} ${e.date.slice(0, 4)}${e.heure ? ` · ${esc(e.heure)}` : ''}</td><td>${esc(nomNature(e))}</td><td><b>${esc(e.cand.intitule)}</b> · ${esc(e.cand.organisme)}</td><td>☐</td></tr>`).join('')}</tbody></table>
      <p class="mention">Dates saisies par l'utilisateur, à vérifier auprès de chaque établissement, recruteur ou acheteur.</p>`, 'impr-liste');
  }
  function imprimerVoeux() {
    const groupes = typesUsage().map((ty) => ({ ty, ...R.classement(E.candidatures, ty.id) })).filter((g) => g.classees.length);
    imprimer(`${enTete(`Mes ${esc((M().voeux || 'vœux').toLowerCase())}, par ordre de préférence`)}
      ${groupes.map((g) => `<h2>${esc(g.ty.long)}</h2><table><thead><tr><th style="width:8%">Rang</th><th>Candidature</th><th>Statut</th></tr></thead><tbody>${g.classees.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.intitule)}</b> · ${esc(c.organisme)}</td><td>${esc(nomStatut(c))}</td></tr>`).join('')}</tbody></table>`).join('') || '<p>Rien de classé.</p>'}`, 'impr-liste');
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const offres = E.usage === 'offres';
    const corps = `
      <label class="champ">Modèle<small>Change le vocabulaire, les types proposés et les onglets. Tes fiches restent toutes là.</small><select name="usage">${B.usages.map((u) => `<option value="${u.id}" ${u.id === E.usage ? 'selected' : ''}>${esc(u.nom)}</option>`).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Prénom<small>${offres ? 'Responsable par défaut des pièces.' : ''}</small><input name="prenom" maxlength="40" value="${esc(E.profil.prenom)}"></label>
        <label class="champ">Signature<small>Prénom et nom, pour les lettres et messages.</small><input name="signature" maxlength="80" value="${esc(E.profil.signature)}"></label>
      </div>
      ${offres ? '' : `<label class="champ">Campagne<small>Ex. : « Rentrée prochaine », « Nouveau poste au printemps ».</small><input name="campagne" maxlength="60" value="${esc(E.profil.campagne)}"></label>`}
      <div class="rang-champs">
        <label class="champ">Alerte avant une date limite<select name="alerte">${[3, 5, 7, 10, 14, 21, 30].map((n) => `<option value="${n}" ${n === r.alerte ? 'selected' : ''}>${n} jours</option>`).join('')}</select></label>
        <label class="champ">Relance après un envoi ou une relance sans nouvelles<select name="relance">${[5, 7, 10, 14, 15, 21, 30].map((n) => `<option value="${n}" ${n === r.relance ? 'selected' : ''}>${n} jours</option>`).join('')}</select></label>
      </div>
      <p class="aide">${offres ? 'Après un dépôt, la première relance suit le délai du type de consultation (marché public 30 jours, appel d\'offres privé 21, plateforme 5, consultation directe 10) ; ensuite, ce réglage.' : 'Pour une formation, la relance n\'est proposée qu\'une fois la date de réponse annoncée passée : les établissements donnent en général leur calendrier.'}</p>
      ${offres ? `<div class="groupe"><h3>Appels d'offres</h3>
        <div class="rang-champs"><label class="champ">Marge de dépôt (jours)<small>Dépôt visé avant la date limite.</small><input type="number" name="marge" min="0" max="10" value="${r.marge}"></label>
        <label class="champ">Décider au plus tard (jours)<small>Avant la date limite.</small><input type="number" name="decision" min="0" max="60" value="${r.decision}"></label></div>
        <div class="rang-champs"><label class="champ">Pièce à renouveler (jours)<small>Alerte avant la fin de validité.</small><input type="number" name="renouveler" min="1" max="180" value="${r.renouveler}"></label><span></span></div></div>
      <div class="groupe"><h3>Grille go/no-go</h3>
        <div class="rang-champs"><label class="champ">Go conseillé à partir de (%)<input type="number" name="seuilGo" min="1" max="100" value="${r.seuilGo}"></label>
        <label class="champ">À discuter à partir de (%)<input type="number" name="seuilDiscuter" min="0" max="99" value="${r.seuilDiscuter}"></label></div>
        <div class="poids">${E.criteres.map((k) => `<label class="champ"><span>${esc(k.nom)}${k.eliminatoire ? ' (élim.)' : ''}</span><input type="number" name="poids-${k.id}" min="0" max="5" value="${k.poids}" aria-label="Poids du critère ${esc(k.nom)}"></label>`).join('')}</div>
        <p class="aide">Poids de 0 (critère ignoré) à 5. Les critères éliminatoires notés 0 donnent un no-go conseillé.</p></div>` : ''}
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique : exporte en tableur ou vers ton agenda, ou imprime depuis les onglets.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Fiches en CSV</button><button class="btn petit" type="button" data-action="ics">Échéances (.ics)</button><button class="btn petit" type="button" data-action="imprimer-recap">Imprimer le récapitulatif</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'} « Restaurer une copie » accepte aussi une copie exportée de l'ancien suivi des appels d'offres.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application : pratique pour cocher une pièce ou relire tes notes avant un entretien.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Aucun calendrier officiel n'est intégré et aucune plateforme de candidature ni aucun profil d'acheteur n'est connecté : les dates sont celles que tu saisis, à vérifier à la source. Les listes de pièces (${B.pieces.length} pièces types, ${B.modeles.length - 1} listes de départ, ${B.dossiers.length} modèles de dossiers) sont des points de départ. Questions d'entretien (${B.questions.length}), pistes et trames de lettre (${B.trames.length}) : textes originaux QME, base version ${B.version}. Ne note ici aucun mot de passe ni identifiant de connexion.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const s = verifierSecrets(f.get('prenom'), f.get('signature'), f.get('campagne'));
      if (s) return s;
      const n = (k, min, max, def) => { if (f.get(k) === null) return def; const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const v = { alerte: Number(f.get('alerte')) || R.ALERTE_DEFAUT, relance: Number(f.get('relance')) || R.RELANCE_DEFAUT, marge: n('marge', 0, 10, r.marge), decision: n('decision', 0, 60, r.decision), renouveler: n('renouveler', 1, 180, r.renouveler), seuilGo: n('seuilGo', 1, 100, r.seuilGo), seuilDiscuter: n('seuilDiscuter', 0, 99, r.seuilDiscuter) };
      if (Object.values(v).some((x) => x === null)) return 'Vérifie les nombres : entiers, dans les bornes indiquées.';
      if (v.seuilDiscuter >= v.seuilGo) return 'Le seuil « à discuter » doit être inférieur au seuil « go ».';
      const poids = offres ? E.criteres.map((k) => n(`poids-${k.id}`, 0, 5, k.poids)) : null;
      if (poids && poids.some((x) => x === null)) return 'Poids : entiers de 0 à 5.';
      if (poids && !poids.some(Boolean)) return 'Garde au moins un critère avec un poids.';
      retenir();
      const usageAvant = E.usage;
      E.usage = R.USAGES.includes(f.get('usage')) ? f.get('usage') : E.usage;
      E.profil = { prenom: String(f.get('prenom') || '').trim().slice(0, 40), signature: String(f.get('signature') || '').trim().slice(0, 80), campagne: f.get('campagne') === null ? E.profil.campagne : String(f.get('campagne') || '').trim().slice(0, 60) };
      E.reglages = v;
      if (poids) E.criteres.forEach((k, i) => { k.poids = poids[i]; });
      sauver();
      if (E.usage !== usageAvant) { filtre.statut = 'actives'; filtre.type = 'tous'; filtre.nature = 'toutes'; vue = 'tableau'; sel = null; history.replaceState(null, '', '#tableau'); demarrer(); toast(`Modèle « ${U().nom} » : onglets et vocabulaire adaptés.`, { libelle: 'Annuler', faire: () => { annuler(); demarrer(); } }); return; }
      rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        const nb = Array.isArray(d.candidatures) ? d.candidatures.length : Array.isArray(d.consultations) ? d.consultations.length : null;
        if (nb === null) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(nb, Array.isArray(d.candidatures) ? 'candidature' : 'consultation')}) ?`)) return;
        const vu = E.tutorielVu;
        retenir();
        E = normaliser(d); delete E.majLe;
        E.tutorielVu = vu;
        modale().close(); sauver(); sel = null; vue = 'tableau'; demarrer(); toast(Array.isArray(d.consultations) ? 'Copie du suivi des appels d\'offres restaurée : modèle « Appels d\'offres et plateformes ».' : 'Copie restaurée.', { libelle: 'Annuler', faire: () => { annuler(); demarrer(); } });
      } catch { toast('Ce fichier n\'est pas une copie valide de tes candidatures.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `candidatures-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(R.trier(E.candidatures, auj()), ctxCsv()), 'text/csv;charset=utf-8', `candidatures-${auj()}.csv`);
  function exporterIcs() {
    const evs = tousEvs(E.candidatures).filter((e) => e.nature !== 'piece' && (e.nature !== 'relance' || e.due));
    if (!evs.length) { toast('Aucune date à exporter : saisis d\'abord des dates dans tes fiches.'); return; }
    const h = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    telecharger(R.versIcs(evs, { nomNature }, h), 'text/calendar;charset=utf-8', `candidatures-echeances-${auj()}.ics`);
    toast(`${pluriel(evs.length, 'date')} exportée${evs.length > 1 ? 's' : ''} : ouvre le fichier pour l'ajouter à ton agenda.`);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes, propre au modèle choisi : s'ouvre seul une fois par compte (E.tutorielVu,
  // synchronisé avec les données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const rg = E.reglages;
    let blocs, intro;
    if (E.usage === 'offres') {
      const depot = rg.marge > 0 ? `${pluriel(rg.marge, 'jour')} avant la date limite` : 'le jour de la date limite';
      intro = 'L\'outil calcule ce qu\'il faut faire et quand&nbsp;: décider, préparer chaque pièce, déposer, relancer. Ton rôle&nbsp;: noter les consultations repérées, puis faire avancer chaque dossier. Il ne se connecte à aucune plateforme&nbsp;: tu déposes toi-même.';
      blocs = [
        ['rose', 'Décide avant de t\'y mettre', `Chaque consultation repérée va dans <b>Veille</b>. La grille go/no-go note ${E.criteres.filter((k) => k.poids > 0).length} critères de 0 à 3, pondérés&nbsp;: à partir de ${rg.seuilGo}&nbsp;%, go conseillé&nbsp;; sous ${rg.seuilDiscuter}&nbsp;%, ou avec un critère éliminatoire à 0, no-go conseillé. C'est toi qui décides.`],
        ['beurre', 'Un rétroplanning par dossier', `Au go, le dossier reçoit la liste de pièces de son modèle (onglet <b>Pièces</b>), à adapter au règlement de la consultation. Chaque pièce a une échéance&nbsp;: la date limite moins son délai, avancée au vendredi si elle tombe un week-end. Ton dépôt visé est fixé ${depot}.`],
        ['ciel', 'Le plus urgent d\'abord', `Le <b>Tableau de bord</b> montre les dossiers à déposer dont la date limite tombe dans les ${rg.alerte}&nbsp;jours, les pièces à préparer, les décisions à prendre (${pluriel(rg.decision, 'jour')} avant la date limite) et les relances. <b>Échéances</b> réunit toutes les dates, avec un calendrier.`],
        ['sable', 'Après le dépôt', `Passe le dossier en <b>Déposée</b>&nbsp;: une relance est proposée après le délai du type de consultation, puis ${pluriel(rg.relance, 'jour')} après chaque relance notée. Le résultat (gagnée, perdue avec son motif, sans suite) nourrit le <b>Bilan</b>&nbsp;: taux de go, taux de réussite, temps passé.`],
        ['rose', 'Des pièces réutilisables', `<b>Pièces</b> garde tes références, CV et attestations avec leur date de validité. Une alerte prévient ${pluriel(rg.renouveler, 'jour')} avant l'expiration, ou si une pièce liée à un dossier expire avant sa date limite. L'outil garde l'emplacement, pas le fichier.`],
      ];
    } else {
      const emploi = E.usage === 'emploi';
      intro = 'L\'application te dit quoi envoyer d\'abord, qui relancer et quelles dates arrivent. Ton rôle&nbsp;: créer une fiche par candidature, y recopier les dates qu\'on te donne et tenir son statut à jour.';
      blocs = [
        ['rose', 'Une fiche par candidature', `${emploi ? 'Offre d\'emploi ou candidature spontanée' : 'Formation, stage, alternance ou job étudiant'}&nbsp;: chaque fiche part d'une liste de pièces à adapter, que tu fais passer de <b>À faire</b> à <b>Prête</b> puis <b>Envoyée</b>. Recopie aussi les dates données par ${emploi ? 'le recruteur' : 'l\'établissement ou le recruteur'}&nbsp;: date limite, entretien, réponse annoncée. Aucun calendrier officiel n'est intégré.`],
        ['beurre', 'Envoie d\'abord le plus urgent', `Le <b>Tableau de bord</b> liste dans <b>À envoyer</b> les candidatures à préparer dont la date limite est passée ou tombe dans les ${rg.alerte}&nbsp;jours, la plus proche en premier, avec les pièces qui manquent encore. Il montre aussi les entretiens et les réponses des 14 prochains jours.`],
        ['ciel', 'Tiens le statut à jour', `<b>À préparer</b>, <b>Envoyée</b>, <b>Entretien</b>${emploi ? '' : ', <b>Liste d\'attente</b>'}, puis <b>Acceptée</b>, <b>Refusée</b> ou <b>Retirée</b>. Une relance est proposée quand la date de réponse annoncée est passée et${emploi ? '' : ', hors formation,'} ${rg.relance}&nbsp;jours après le dernier contact sans nouvelles. Après un entretien, c'est un remerciement. Un message prêt à copier t'aide à l'écrire.`],
        ['sable', `Classe tes ${emploi ? 'préférences' : 'vœux'} et prépare-toi`, `Dans <b>${emploi ? 'Préférences' : 'Vœux'}</b>, range tes candidatures par ordre de préférence, type par type&nbsp;: tu sauras quoi choisir quand une réponse arrive. <b>Lettres et entretiens</b> t'aide à écrire une lettre de motivation sur une trame et à préparer les questions types avec tes notes.`],
      ];
    }
    const corps = `
      <p>${intro}</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">${E.usage === 'offres' ? '<b>Dossiers</b> regroupe toutes tes consultations, en cours ou terminées.' : '<b>Échéances</b> réunit toutes tes dates, avec un calendrier, et s\'ajoute à ton agenda (.ics).'} Le modèle (études et stages, emploi, appels d'offres) et les délais se règlent dans les réglages. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premiere = auto && !E.candidatures.length;
    const pied = premiere
      ? `<button class="btn primaire" value="nouvelle">Ajouter ma première ${esc(M().une)}</button><button class="btn" value="ok">Fermer</button>`
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'nouvelle') setTimeout(() => modaleNouvelle(), 0); });
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
  function reordonner(id, fn) {
    retenir();
    E.candidatures = fn(E.candidatures);
    sauver(); rendre();
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox')) return;
    const { action, id } = el.dataset;
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-modele': {
        const u = el.dataset.usage;
        if (!session.demo) { ouvrirDemo(true, u); break; }
        if (E.usage === u) break;
        const vu = E.tutorielVu; E = donneesDemo(u); E.tutorielVu = vu; sel = null; vue = 'tableau'; filtre.statut = 'actives'; filtre.type = 'tous'; filtre.nature = 'toutes';
        history.replaceState(null, '', '#tableau'); cache(); demarrer(); break;
      }
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; const u = E.usage; stock.suppr(CLE_DEMO); E = donneesDemo(u); E.tutorielVu = vu; sel = null; cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': lireAccueil2(); accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(true); break;
      case 'accueil-passer': terminerAccueil(false); break;
      case 'vue':
        fermer();
        if (el.dataset.vue === 'candidatures') { filtre.statut = el.dataset.statut || (el.closest('.tuiles') ? 'actives' : filtre.statut); }
        changerVue(el.dataset.vue); break;
      case 'voir-statut': filtre.statut = el.dataset.statut; filtre.type = 'tous'; filtre.q = ''; changerVue('candidatures'); break;
      case 'voir-cand': fermer(); changerVue('candidatures', id); break;
      case 'voir-preparer': sousVue = el.dataset.sous || 'lettre'; changerVue('preparer', id); break;
      case 'sous-vue': sousVue = el.dataset.sous; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'ics': exporterIcs(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle': modaleNouvelle(filtre.type !== 'tous' ? filtre.type : null); break;
      case 'modifier': modaleModifier(id); break;
      case 'statut': changerStatut(id, el.dataset.statut); break;
      case 'piece-statut': cyclerPiece(id, el.dataset.piece); break;
      case 'piece-prete': piecePrete(id, el.dataset.piece); break;
      case 'piece': modalePiece(id, el.dataset.piece); break;
      case 'ajouter-piece': modalePiece(id, null); break;
      case 'relance': modaleRelance(id, el.dataset.relance || null); break;
      case 'relance-rapide': modaleMessage(id, el.dataset.raison); break;
      case 'relance-date': modaleDateRelance(id); break;
      case 'grille': modaleGrille(id); break;
      case 'go': fermer(); decider(id, 'go'); break;
      case 'nogo': modaleGrille(id); break;
      case 'temps': { const c = cand(id); if (c) { c.temps = R.ajouterTemps(c.temps, Number(el.dataset.delta)); sauver(); rendre(); } break; }
      case 'biblio-nouvelle': modaleBiblio(); break;
      case 'biblio-modifier': modaleBiblio(id); break;
      case 'modele-modifier': modaleModele(id); break;
      case 'filtre-statut': filtre.statut = el.dataset.statut; rendre(); break;
      case 'filtre-type': filtre.type = el.dataset.type; rendre(); break;
      case 'filtre-nature': filtre.nature = el.dataset.nature; rendre(); break;
      case 'periode': periode = id; rendre(); break;
      case 'mois': mois = id === '0' ? auj().slice(0, 7) : R.moisSuivant(mois, Number(id)); jourChoisi = null; rendre(); $('#calendrier')?.scrollIntoView({ block: 'start' }); break;
      case 'jour': jourChoisi = id && id !== jourChoisi ? id : null; if (id && !id.startsWith(mois)) mois = id.slice(0, 7); rendre(); $('.cal-liste')?.scrollIntoView({ block: 'nearest' }); break;
      case 'monter': reordonner(id, (l) => R.deplacer(l, id, -1)); break;
      case 'descendre': reordonner(id, (l) => R.deplacer(l, id, 1)); break;
      case 'classer': reordonner(id, (l) => R.deplacer(l, id, 0)); toast('Ajoutée en dernier : monte-la si tu la préfères.'); break;
      case 'declasser': reordonner(id, (l) => R.retirerDuClassement(l, id)); toast('Retirée du classement.', { libelle: 'Annuler', faire: annuler }); break;
      case 'copier-lettre': { const c = cand(id); if (c) { const tr = R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c)); const n = c.lettre.texte?.trim() ? 0 : nbManquants(c, tr); copier(texteLettre(c), n ? `Lettre copiée. Attention : ${pluriel(n, 'champ')} encore à compléter.` : 'Lettre copiée : colle-la dans ton traitement de texte ou ton e-mail.'); } break; }
      case 'imprimer-lettre': imprimerLettre(id); break;
      case 'lettre-libre': { const c = cand(id); if (c) { retenir(); c.lettre.trame = c.lettre.trame || R.trameConseillee(B, c); c.lettre.texte = R.composerLettre(c, R.trameDe(B, c.lettre.trame), E.profil).texte; sauver(); rendre(); $('#lettre-libre')?.focus(); } break; }
      case 'lettre-trame': { const c = cand(id); if (c && confirm('Revenir au texte composé depuis la trame ? Tes retouches à la main seront perdues.')) { retenir(); c.lettre.texte = ''; sauver(); rendre(); toast('Retour à la trame.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'lettre-prete': { const c = cand(id); const x = c?.pieces.find((y) => y.ref === 'lm'); if (x) { retenir(); x.statut = 'prete'; sauver(); rendre(); toast('Pièce « Lettre de motivation » passée à prête.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'choisir-question': choisirQuestion(id, el.dataset.question); break;
      case 'ajouter-question': ajouterQuestion(id); break;
      case 'retirer-question': { const c = cand(id); if (c) { retenir(); c.entretien.questions = c.entretien.questions.filter((x) => x.id !== el.dataset.question); sauver(); rendre(); toast('Question retirée.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'question-prete': { const c = cand(id); const x = c?.entretien.questions.find((y) => y.id === el.dataset.question); if (x) { x.prete = el.checked; sauver(); rendre(); } break; }
      case 'imprimer-recap': imprimerRecap(); break;
      case 'imprimer-dossier': imprimerDossier(id); break;
      case 'imprimer-entretien': imprimerEntretien(id); break;
      case 'imprimer-echeances': imprimerEcheances(); break;
      case 'imprimer-voeux': imprimerVoeux(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('[data-action=choisir-cand]')) { sel = el.value; history.replaceState(null, '', `#preparer/${sel}`); rendre(); }
    if (el.matches('[data-action=choisir-trame]')) {
      const c = cand($('#form-lettre')?.dataset.id);
      if (c) { c.lettre.trame = el.value; sauver(); rendre(); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('#form-question [name=question]')) { e.preventDefault(); ajouterQuestion($('#form-question').dataset.id); }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !saisieEnCours()) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    const p = new URLSearchParams(location.search);
    const demande = p.has('demo') ? (R.USAGES.includes(p.get('demo')) ? p.get('demo') : null) : undefined;
    if (demande !== undefined) history.replaceState(null, '', location.pathname);
    if (demande !== undefined && (!code || code === CODE_DEMO)) return ouvrirDemo(code === CODE_DEMO, demande);
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
  window.__candidatures = { etat: () => E, regles: R };
  init();
})();
