// Candidatures études, stages, alternance QME : une fiche par candidature (formation, stage, alternance, job
// étudiant) avec ses pièces à fournir, ses dates (saisies : aucun calendrier officiel intégré), son statut et sa
// réponse ; classement des vœux par type ; relances proposées avec message à copier ; préparation d'entretien
// (questions types, notes) ; lettres de motivation sur trame originale ; échéances, impressions, CSV et calendrier.
// Données synchronisées par clé de licence ou code d'accès. Aucune plateforme de candidature connectée ni nommée.
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
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const typeDe = (id) => B.types.find((t) => t.id === id) || B.types[0];
  const nomType = (id) => typeDe(id).nom;
  const statutDe = (id) => B.statuts.find((s) => s.id === id) || B.statuts[0];
  const nomStatut = (id) => statutDe(id).nom;
  const nomStatutPiece = (id) => (B.statutsPiece.find((s) => s.id === id) || B.statutsPiece[0]).nom;
  const nomCanal = (id) => (B.canaux.find((c) => c.id === id) || B.canaux[0]).nom;
  const nomFormat = (id) => (B.formatsEntretien.find((f) => f.id === id) || B.formatsEntretien[0]).nom;
  const pillType = (id) => `<span class="type type-${esc(typeDe(id).id)}">${esc(nomType(id))}</span>`;
  const pillStatut = (id) => `<span class="statut statut-${esc(id)}">${esc(nomStatut(id))}</span>`;
  const NATURES = { limite: 'Date limite', entretien: 'Entretien ou épreuve', reponse: 'Réponse attendue', relance: 'Relance' };
  const nomNature = (e) => (e.nature === 'relance' ? (e.raison === 'remerciement' ? 'Remercier après l\'entretien' : 'Relance proposée') : NATURES[e.nature]);
  const titreCand = (c) => c.organisme || c.intitule || 'Candidature';
  const ctxCsv = { nomType, nomStatut };
  const cand = (id) => E.candidatures.find((c) => c.id === id) || null;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let sel = null; // candidature ouverte (onglet Candidatures) ou préparée (onglet Préparer)
  let sousVue = 'lettre';
  const filtre = { statut: 'actives', type: 'tous', q: '', nature: 'toutes' };
  let annulation = null;

  // tutorielVu (guide « Comment ça marche » déjà vu) : propre à l'application, réinjecté après la normalisation.
  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
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

  // ---------- Données de démonstration ----------
  // Noa (fictif), en troisième année de licence, prépare sa rentrée : quatre masters ou écoles, deux stages,
  // deux alternances, un job étudiant. Dates relatives à aujourd'hui : une date limite dans 5 jours avec des
  // pièces manquantes, une dépassée, un entretien dans 3 jours, une relance due, une liste d'attente, une
  // acceptation, un refus, un désistement, une candidature lointaine. Établissements et entreprises inventés.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    e.profil = { prenom: 'Noa', signature: 'Noa Lefèvre', campagne: 'Rentrée prochaine' };
    const P = (ref, statut, x = {}) => R.normaliserPiece({ ref, statut, ...x }, B);
    const C = (x) => R.normaliserCandidature({ id: uid(), creeLe: j(-40), ...x }, B);
    const Q = (ref, notes = '', prete = false) => R.normaliserQuestion({ ref, notes, prete }, B);
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

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Candidatures · QME';
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
          <p class="surtitre">Candidatures études, stages, alternance</p>
          <h1>Chaque dossier, à temps.</h1>
          <p>Formations, stages, alternance, jobs : les pièces à fournir, les dates que tu saisis, les réponses, tes vœux classés, les relances et la préparation des entretiens.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes candidatures'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, prenom: '', signature: '', campagne: '', type: 'formation', modele: 'master', intitule: '', organisme: '', limite: '' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes candidatures, sans rien oublier.</h1>
        <p class="intro">Une fiche par formation, stage, alternance ou job : les pièces à fournir, les dates que tu recopies depuis chaque établissement ou recruteur, la réponse. L'application te dit quoi envoyer d'abord, qui relancer, et t'aide pour les lettres et les entretiens.</p>
        <form id="form-accueil" novalidate>
          <div class="rang-champs" style="max-width:620px">
            <label class="champ">Ton prénom<small>Facultatif.</small><input name="prenom" maxlength="40" value="${esc(a.prenom)}" placeholder="Ex. : Noa"></label>
            <label class="champ">Signature des lettres<small>Prénom et nom, facultatif.</small><input name="signature" maxlength="80" value="${esc(a.signature)}" placeholder="Ex. : Noa Lefèvre"></label>
          </div>
          <label class="champ" style="max-width:420px;margin-top:12px">Ta campagne<small>Facultatif : « Rentrée prochaine », « Stage de fin d'études »…</small><input name="campagne" maxlength="60" value="${esc(a.campagne)}"></label>
          <p class="erreur" role="alert"></p>
        </form>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta première candidature</h1>
        <p class="intro">Choisis le type et une liste de pièces de départ : tu l'adapteras à ce que demande vraiment la formation ou le recruteur. Tu peux aussi passer cette étape.</p>
        <form id="form-premiere" class="carte-form" novalidate>
          <fieldset class="champ"><legend>Type</legend><div class="choix-statut choix-4">${B.types.map((t) => `<label><input type="radio" name="type" value="${t.id}" ${t.id === a.type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
          <label class="champ">Liste de pièces de départ<select name="modele">${optionsModeles(a.type, a.modele)}</select></label>
          <div class="rang-champs">
            <label class="champ">${esc(typeDe(a.type).intitule)}<input name="intitule" maxlength="120" value="${esc(a.intitule)}" placeholder="${esc(typeDe(a.type).exemple)}"></label>
            <label class="champ">${esc(typeDe(a.type).organisme)}<input name="organisme" maxlength="120" value="${esc(a.organisme)}"></label>
          </div>
          <label class="champ" style="max-width:280px">Date limite<small>Celle de l'établissement ou de l'offre, si elle existe.</small><input type="date" name="limite" value="${esc(a.limite)}"></label>
          <p class="erreur" role="alert"></p>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <span class="rang"><button class="btn" data-action="accueil-passer">Passer</button><button class="btn primaire" data-action="accueil-fin">Créer</button></span>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const f = $('#form-premiere');
    if (f) f.addEventListener('change', (ev) => { if (ev.target.name === 'type') { lireAccueil2(); accueil.modele = R.modeleParDefaut(accueil.type); ecranAccueil(); } });
  }
  function lireAccueil2() {
    const f = $('#form-premiere');
    if (!f) return;
    Object.assign(accueil, { type: f.querySelector('[name=type]:checked')?.value || 'formation', modele: f.querySelector('[name=modele]').value, intitule: f.querySelector('[name=intitule]').value.trim(), organisme: f.querySelector('[name=organisme]').value.trim(), limite: f.querySelector('[name=limite]').value });
  }

  function accueilSuivant() {
    const f = $('#form-accueil');
    Object.assign(accueil, { prenom: f.querySelector('[name=prenom]').value.trim(), signature: f.querySelector('[name=signature]').value.trim(), campagne: f.querySelector('[name=campagne]').value.trim() });
    const s = [accueil.prenom, accueil.signature, accueil.campagne].map(R.contientSecret).find(Boolean);
    if (s) { f.querySelector('.erreur').textContent = R.MESSAGES_SENSIBLES[s]; return; }
    accueil.etape = 2;
    ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil(creer) {
    if (creer) lireAccueil2();
    if (creer && !accueil.intitule && !accueil.organisme) { $('#form-premiere .erreur').textContent = 'Indique au moins la formation ou l\'établissement, ou passe cette étape.'; return; }
    E = etatVide();
    E.profil = { prenom: accueil.prenom, signature: accueil.signature, campagne: accueil.campagne };
    let premiere = null;
    if (creer) {
      premiere = R.normaliserCandidature({ id: uid(), type: accueil.type, intitule: accueil.intitule, organisme: accueil.organisme, dates: { limite: accueil.limite || null }, pieces: R.piecesDuModele(B, accueil.modele), creeLe: auj(), rang: 1 }, B);
      E.candidatures.push(premiere);
    }
    accueil = accueilVide();
    vue = premiere ? 'candidatures' : 'tableau'; sel = premiere?.id || null;
    sauver();
    demarrer();
    toast(premiere ? 'Ta première candidature est créée : coche les pièces au fur et à mesure.' : 'C\'est prêt : ajoute ta première candidature.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    candidatures: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    voeux: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="14" width="5" height="7" fill="currentColor"/><rect x="9.5" y="4" width="5" height="17" fill="currentColor"/><rect x="16" y="9" width="5" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    preparer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    haut: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5 20 15H4Z" fill="currentColor"/></svg>',
    bas: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19 4 9h16Z" fill="currentColor"/></svg>',
  };
  const COURTS = { tableau: 'Accueil', candidatures: 'Dossiers', preparer: 'Préparer' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['candidatures', 'Candidatures'], ['voeux', 'Vœux'], ['echeances', 'Échéances'], ['preparer', 'Lettres et entretiens']];
  const AVERTISSEMENT = () => `<p class="mention avertissement">${esc(B.avertissement)}</p>`;

  function demarrer() {
    document.body.classList.add('app');
    lireHash();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Candidatures</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    if (ONGLETS.some(([o]) => o === v)) { vue = v; sel = id && E?.candidatures.some((c) => c.id === id) ? id : (v === 'preparer' ? sel : null); }
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    if (sel && !cand(sel)) sel = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${vue === 'candidatures' && sel ? titreCand(cand(sel)) : titres[vue]} · Candidatures`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, candidatures: () => (sel ? vueFiche(cand(sel)) : vueListe()), voeux: vueVoeux, echeances: vueEcheances, preparer: vuePreparer }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, id = null) {
    vue = v; sel = id;
    history.replaceState(null, '', `#${v}${id ? `/${id}` : ''}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="72" cy="20" r="16" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  const libJours = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${pluriel(n, 'jour')}` : `il y a ${pluriel(-n, 'jour')}`);
  const CLASSE_NIVEAU = { depasse: 'rouge', urgent: 'rose', proche: 'jaune', loin: 'ciel' };
  function etiquetteEvenement(e, court = false) {
    if (e.nature === 'limite' && e.jours < 0) return `<span class="etiquette rouge">Date limite passée · ${dateCourte(e.date)}</span>`;
    if (e.nature === 'reponse' && e.jours < 0) return `<span class="etiquette rose">Réponse attendue le ${dateCourte(e.date)}</span>`;
    if (e.nature === 'entretien' && e.jours < 0) return `<span class="etiquette sable">Entretien passé · ${dateCourte(e.date)}</span>`;
    if (e.nature === 'relance') return `<span class="etiquette ${e.due ? 'jaune' : 'sable'}">${e.due ? (e.raison === 'remerciement' ? 'Remercier' : 'À relancer') : `Relance le ${dateCourte(e.date)}`}</span>`;
    const quand = e.jours <= 7 ? libJours(e.jours) : `le ${dateCourte(e.date)}`;
    return `<span class="etiquette ${CLASSE_NIVEAU[e.niveau]}">${court ? quand.charAt(0).toUpperCase() + quand.slice(1) : `${esc(NATURES[e.nature])} ${quand}`}${e.heure ? ` · ${esc(e.heure)}` : ''}</span>`;
  }
  const prochainEvenement = (c) => R.evenementsDe(c, auj(), E.reglages).sort((a, b) => (a.date < b.date ? -1 : 1))[0] || null;
  function barrePieces(c) {
    const a = R.avancement(c);
    if (!a.total) return '<span class="mini-pieces">Aucune pièce listée</span>';
    return `<span class="mini-pieces" title="${a.pretes} sur ${a.total} pièces prêtes ou envoyées"><i class="jauge"><i style="width:${a.pct}%"></i></i>${a.pretes}/${a.total} pièces</span>`;
  }

  function carteCand(c, { action = '' } = {}) {
    const ev = prochainEvenement(c);
    const t = typeDe(c.type);
    return `<li class="carte-cand" style="--t:${esc(t.couleur)}">
      <button class="cc-corps" data-action="ouvrir" data-id="${c.id}">
        <span class="cc-tete">${pillType(c.type)}${pillStatut(c.statut)}${c.rang && R.classable(c) ? `<span class="rang-badge" title="Rang dans tes vœux">n°${c.rang}</span>` : ''}</span>
        <b class="cc-titre">${esc(c.intitule || 'Sans intitulé')}</b>
        <span class="cc-org">${esc(c.organisme || '—')}${c.ville ? ` · ${esc(c.ville)}` : ''}</span>
        <span class="cc-pied">${barrePieces(c)}${ev ? etiquetteEvenement(ev) : ''}</span>
      </button>
      ${action}
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const b = R.bilan(E.candidatures, t, E.reglages);
    const envois = R.aEnvoyer(E.candidatures, t, E.reglages);
    const evs = R.evenements(E.candidatures.filter(R.estActive), t, E.reglages, { horizon: 14 }).filter((e) => e.nature !== 'relance' && !(e.nature === 'limite'));
    const relances = R.evenements(E.candidatures, t, E.reglages).filter((e) => e.nature === 'relance' && e.due);
    const tuiles = [
      ['En cours', b.actives, `${pluriel(b.total, 'candidature')} en tout`, 'var(--bleu)', '', 'candidatures', ''],
      ['À envoyer', b.aEnvoyer, b.depassees ? `dont ${b.depassees} date${b.depassees > 1 ? 's' : ''} passée${b.depassees > 1 ? 's' : ''}` : `date limite sous ${E.reglages.alerte} jours`, 'var(--rouge)', 'rond', 'echeances', ''],
      ['Entretiens', b.entretiens, b.entretiens ? 'à venir, à préparer' : 'aucun prévu', 'var(--jaune)', '', 'echeances', ''],
      ['Réponses', b.parStatut.acceptee, `acceptée${b.parStatut.acceptee > 1 ? 's' : ''}${b.parStatut.attente ? ` · ${b.parStatut.attente} en attente` : ''}`, 'var(--encre)', 'rond', 'candidatures', 'reponses'],
    ].map(([lib, v, d, c, f, cible, st]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}" ${st ? `data-statut="${st}"` : ''}><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></button>`).join('');
    const vide = !E.candidatures.length;
    const nom = E.profil.prenom ? `Bonjour ${esc(E.profil.prenom)}` : 'Tes candidatures';
    return `
      <div class="vue-tete"><div><h1>${nom}</h1><p>${E.profil.campagne ? `${esc(E.profil.campagne)} : ` : ''}ce qu'il faut envoyer d'abord, les entretiens et réponses à venir, et qui relancer.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Candidature</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${vide ? `<div class="vide-etat" style="margin-top:24px">${FORME_VIDE}<div><h3>Aucune candidature pour l'instant</h3><p>Ajoute la première : formation, stage, alternance ou job étudiant. Tu choisis une liste de pièces de départ, puis tu recopies les dates données par l'établissement ou le recruteur.</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Première candidature</button></div></div></div>` : `
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À envoyer <span>${envois.length ? `date limite sous ${E.reglages.alerte} jours ou passée` : ''}</span></h2>
          ${envois.length ? `<ul class="envois">${envois.map(({ cand: c, jours, av }) => {
            const manque = R.piecesManquantes(c);
            return `<li class="envoi niv-${jours < 0 ? 'depasse' : jours <= R.URGENT ? 'urgent' : 'proche'}"><button class="lien-ligne" data-action="ouvrir" data-id="${c.id}"><b>${esc(c.intitule || titreCand(c))}</b><span>${esc(c.organisme)}</span></button>
              <div class="envoi-pied">${etiquetteEvenement({ nature: 'limite', date: c.dates.limite, jours, niveau: R.niveau(jours, E.reglages.alerte) })}${av.total ? `<span class="mini-pieces"><i class="jauge"><i style="width:${av.pct}%"></i></i>${av.pretes}/${av.total} prêtes</span>` : ''}</div>
              ${manque.length ? `<p class="manque">Il manque : ${manque.map((x) => `<b>${esc(x.nom)}</b>${x.statut === 'encours' ? ' (en cours)' : ''}`).join(', ')}</p>` : '<p class="manque ok">Toutes les pièces sont prêtes : il ne reste qu\'à envoyer.</p>'}</li>`;
          }).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien d\'urgent à envoyer</h3><p>Aucune date limite dans les prochains jours. Pense à saisir celles de tes candidatures à préparer.</p></div></div>'}
          <h2 class="titre-section">Relances <span>${relances.length ? 'sans réponse depuis un moment' : ''}</span></h2>
          ${relances.length ? `<ul class="prochains">${relances.map((e) => ligneEvenement(e, { bouton: `<button class="btn petit" data-action="relance-rapide" data-id="${e.cand.id}" data-raison="${e.raison}">${e.raison === 'remerciement' ? 'Remercier' : 'Relancer'}</button>` })).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Personne à relancer</h3><p>Une relance est proposée ${E.reglages.relance} jours après un envoi sans nouvelles (réglable), ou quand la date de réponse annoncée est passée.</p></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Les 14 prochains jours <span>${evs.length ? 'entretiens et réponses' : ''}</span></h2>
          ${evs.length ? `<ul class="prochains">${evs.map((e) => ligneEvenement(e)).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien de prévu</h3><p>Aucun entretien ni réponse attendue dans les 14 prochains jours.</p></div></div>'}
          <h2 class="titre-section">Où tu en es</h2>
          <ul class="compteurs-statuts">${B.statuts.map((s) => `<li><button class="lien-statut" data-action="voir-statut" data-statut="${s.id}"><span class="statut statut-${s.id}">${esc(s.court)}</span><b>${b.parStatut[s.id]}</b></button></li>`).join('')}</ul>
        </section>
      </div>`}
      ${AVERTISSEMENT()}`;
  }

  function ligneEvenement(e, { bouton = '' } = {}) {
    const c = e.cand;
    return `<li class="niv-${e.niveau}"><span class="date-pastille"><b>${versDate(e.date).getDate()}</b>${fmt(e.date, { month: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="ouvrir" data-id="${c.id}"><b>${esc(nomNature(e))} · ${esc(titreCand(c))}</b><span>${esc(c.intitule)}${e.heure ? ` · ${esc(e.heure)}` : ''}${e.nature === 'entretien' ? ` · ${esc(nomFormat(c.entretien.format))}` : ''}</span></button>
      ${bouton || etiquetteEvenement(e, true)}</li>`;
  }

  // ---------- Candidatures : liste ----------
  const FILTRES_STATUT = [['actives', 'En cours'], ...B.statuts.map((s) => [s.id, s.court]), ['reponses', 'Réponses reçues'], ['toutes', 'Toutes']];
  function garder(c) {
    switch (filtre.statut) {
      case 'toutes': return true;
      case 'actives': return R.estActive(c);
      case 'reponses': return ['acceptee', 'refusee', 'attente'].includes(c.statut);
      default: return c.statut === filtre.statut;
    }
  }
  function vueListe() {
    const t = auj();
    const tete = `<div class="vue-tete"><div><h1>Candidatures</h1><p>Chaque formation, stage, alternance ou job : son statut, ses pièces et sa prochaine date. Touche une candidature pour l'ouvrir.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Candidature</button>${E.candidatures.length ? '<button class="btn" data-action="imprimer-recap">Imprimer le récapitulatif</button>' : ''}</div></div>`;
    if (!E.candidatures.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune candidature</h3><p>Ajoute une formation, un stage, une alternance ou un job étudiant.</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Première candidature</button></div></div></div>`;
    const base = R.rechercher(E.candidatures, filtre.q, { nomType, nomStatut });
    const deType = (c) => filtre.type === 'tous' || c.type === filtre.type;
    const nbStatut = (s) => { const avant = filtre.statut; filtre.statut = s; const n = base.filter((c) => deType(c) && garder(c)).length; filtre.statut = avant; return n; };
    const liste = R.trier(base.filter((c) => deType(c) && garder(c)), t);
    const types = B.types.filter((ty) => E.candidatures.some((c) => c.type === ty.id));
    return `${tete}
      <div class="outils-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher : établissement, ville, pièce…" value="${esc(filtre.q)}" autocomplete="off"></label>
        ${types.length > 1 ? `<div class="filtres" role="group" aria-label="Filtrer par type">${[['tous', 'Tous les types'], ...types.map((ty) => [ty.id, ty.nom])].map(([id, lib]) => `<button class="filtre" data-action="filtre-type" data-type="${id}" aria-pressed="${filtre.type === id}">${esc(lib)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="filtres filtres-statut" role="group" aria-label="Filtrer par statut">${FILTRES_STATUT.map(([id, lib]) => { const n = nbStatut(id); return (n || ['actives', 'toutes'].includes(id) || filtre.statut === id) ? `<button class="filtre" data-action="filtre-statut" data-statut="${id}" aria-pressed="${filtre.statut === id}">${esc(lib)} <small>${n}</small></button>` : ''; }).join('')}</div>
      ${liste.length ? `<ul class="cartes-cand">${liste.map((c) => carteCand(c)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucune candidature ne correspond</h3><p>Change de statut, de type ou de recherche.</p></div></div>`}
      <div class="rang" style="margin-top:20px"><button class="btn petit" data-action="csv">Exporter en CSV</button></div>`;
  }

  // ---------- Candidatures : fiche ----------
  function vueFiche(c) {
    const t = auj();
    const ty = typeDe(c.type);
    const a = R.avancement(c);
    const r = R.relance(c, t, E.reglages.relance);
    const evs = R.evenementsDe(c, t, E.reglages).filter((e) => e.nature !== 'relance');
    const trame = R.trameDe(B, c.lettre.trame || R.trameConseillee(B, c));
    const lettre = R.composerLettre(c, trame, E.profil);
    const prep = R.preparation(c);
    const utiles = c.pieces.filter((x) => !x.apres || c.statut === 'acceptee');
    const apres = c.pieces.filter((x) => x.apres && c.statut !== 'acceptee');
    const lignePiece = (x) => `<li class="piece piece-${x.statut}">
        <button class="piece-statut" data-action="piece-statut" data-id="${c.id}" data-piece="${x.id}" aria-label="${esc(x.nom)} : ${esc(nomStatutPiece(x.statut))}, toucher pour passer à ${esc(nomStatutPiece(R.pieceSuivante(x.statut)))}"><i aria-hidden="true"></i>${esc(nomStatutPiece(x.statut))}</button>
        <button class="lien-ligne" data-action="piece" data-id="${c.id}" data-piece="${x.id}"><b>${esc(x.nom)}</b>${x.precision ? `<span>${esc(x.precision)}</span>` : ''}</button>
      </li>`;
    const ligneDate = (lib, d, extra = '') => `<div class="fd"><dt>${lib}</dt><dd>${d ? `${dateLongue(d)}${extra}` : '<span class="discret">—</span>'}</dd></div>`;
    return `
      <div class="fil-retour"><button class="btn lien" data-action="vue" data-vue="candidatures">← Toutes les candidatures</button></div>
      <div class="fiche-tete" style="--t:${esc(ty.couleur)}">
        <div class="ft-titres">
          <span class="cc-tete">${pillType(c.type)}${c.rang && R.classable(c) ? `<button class="rang-badge" data-action="vue" data-vue="voeux" title="Voir le classement">n°${c.rang} de tes vœux</button>` : ''}</span>
          <h1>${esc(c.intitule || 'Sans intitulé')}</h1>
          <p>${esc(c.organisme || '—')}${c.ville ? ` · ${esc(c.ville)}` : ''}${c.contact ? ` · ${esc(c.contact)}` : ''}${c.lien ? ` · <a href="${esc(c.lien)}" target="_blank" rel="noopener">page de l'offre</a>` : ''}</p>
        </div>
        <div class="actions"><button class="btn" data-action="modifier" data-id="${c.id}">Modifier</button><button class="btn" data-action="imprimer-dossier" data-id="${c.id}">Imprimer</button></div>
      </div>
      <fieldset class="statuts-fiche"><legend>Statut</legend><div class="choix-statuts">${B.statuts.map((s) => `<button class="choix-st statut-${s.id}" data-action="statut" data-id="${c.id}" data-statut="${s.id}" aria-pressed="${c.statut === s.id}">${esc(s.court)}</button>`).join('')}</div></fieldset>
      ${evs.length ? `<div class="alertes-fiche">${evs.map((e) => etiquetteEvenement(e)).join('')}</div>` : ''}
      ${r && r.due ? `<div class="alerte-doc"><div><b>${r.raison === 'remerciement' ? 'Entretien passé : un message de remerciement fait bonne impression' : r.raison === 'reponse' ? 'La date de réponse annoncée est passée' : `Sans nouvelles depuis ${pluriel(r.jours, 'jour')}`}</b><span>Un message prêt à copier, puis note la relance pour suivre.</span></div><button class="btn petit" data-action="relance-rapide" data-id="${c.id}" data-raison="${r.raison}">${r.raison === 'remerciement' ? 'Remercier' : 'Relancer'}</button></div>` : ''}
      <div class="fiche-grille">
        <section class="bloc">
          <h2 class="titre-bloc">Pièces à fournir <span>${a.total ? `${a.pretes} sur ${a.total} prêtes ou envoyées` : ''}</span></h2>
          ${a.total ? `<p class="jauge-grande" aria-hidden="true"><i style="width:${a.pct}%"></i></p>` : ''}
          ${utiles.length ? `<ul class="pieces">${utiles.map(lignePiece).join('')}</ul>` : '<p class="aide">Aucune pièce listée : ajoute celles que demande la formation ou le recruteur.</p>'}
          ${apres.length ? `<h3 class="sous-titre">Après acceptation <span>pas comptées pour l'instant</span></h3><ul class="pieces">${apres.map(lignePiece).join('')}</ul>` : ''}
          <div class="rang"><button class="btn petit" data-action="ajouter-piece" data-id="${c.id}">${ICONES.plus}Pièce</button></div>
          <p class="mention">Touche le statut pour le faire avancer : à faire, en cours, prête, envoyée. La liste exacte est celle de la candidature.</p>
        </section>
        <section class="bloc">
          <h2 class="titre-bloc">Dates <span>saisies par toi</span></h2>
          <dl class="dates-fiche">
            ${ligneDate('Date limite', c.dates.limite)}
            ${ligneDate('Envoyée le', c.dates.envoi)}
            ${ligneDate(c.type === 'formation' ? 'Entretien ou épreuve' : 'Entretien', c.dates.entretien, `${c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''} · ${esc(nomFormat(c.entretien.format))}`)}
            ${ligneDate('Réponse attendue', c.dates.reponse)}
            ${ligneDate('Réponse reçue', c.dates.recue)}
          </dl>
          <div class="rang"><button class="btn petit" data-action="modifier" data-id="${c.id}">Modifier les dates</button></div>
          <h2 class="titre-bloc">Relances <span>${c.relances.length ? pluriel(c.relances.length, 'relance') : ''}</span></h2>
          ${c.relances.length ? `<ul class="relances">${c.relances.map((x) => `<li><button class="lien-ligne" data-action="relance" data-id="${c.id}" data-relance="${x.id}"><b>${dateLongue(x.date)} · ${esc(nomCanal(x.canal))}</b>${x.note ? `<span>${esc(x.note)}</span>` : ''}</button></li>`).join('')}</ul>` : `<p class="aide">${c.statut === 'preparer' ? 'Les relances viendront après l\'envoi.' : 'Aucune relance notée.'}</p>`}
          <div class="rang"><button class="btn petit" data-action="relance" data-id="${c.id}">${ICONES.plus}Noter une relance</button>${c.statut !== 'preparer' ? `<button class="btn petit" data-action="relance-rapide" data-id="${c.id}" data-raison="${r?.raison || ''}">Message à copier</button>` : ''}</div>
        </section>
        <section class="bloc">
          <h2 class="titre-bloc">Lettre de motivation <span>trame ${esc(trame.nom.toLowerCase())}</span></h2>
          <p>${lettre.manquants.length ? `${pluriel(lettre.manquants.length, 'champ')} à compléter.` : 'Tous les champs sont remplis : relis et adapte le texte.'}</p>
          <div class="rang"><button class="btn petit primaire" data-action="preparer" data-id="${c.id}" data-sous="lettre">Écrire la lettre</button></div>
          <h2 class="titre-bloc">Entretien <span>${prep.total ? `${prep.pretes} sur ${pluriel(prep.total, 'question')} préparée${prep.pretes > 1 ? 's' : ''}` : ''}</span></h2>
          <p>${c.dates.entretien ? `${dateLongue(c.dates.entretien)}${c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''} · ${esc(nomFormat(c.entretien.format))}${c.entretien.lieu ? ` · ${esc(c.entretien.lieu)}` : ''}` : 'Pas encore de date. Tu peux préparer les questions dès maintenant.'}</p>
          <div class="rang"><button class="btn petit" data-action="preparer" data-id="${c.id}" data-sous="entretien">Préparer l'entretien</button></div>
        </section>
        <section class="bloc">
          <h2 class="titre-bloc">Notes</h2>
          ${c.note ? `<p class="note-fiche">${esc(c.note)}</p>` : '<p class="aide">Ce que tu as appris aux portes ouvertes, le nom du service, une idée pour la lettre.</p>'}
          ${c.motif ? `<p class="note-fiche"><b>Motif ou suite :</b> ${esc(c.motif)}</p>` : ''}
          <div class="rang"><button class="btn petit" data-action="modifier" data-id="${c.id}">Modifier les notes</button></div>
        </section>
      </div>`;
  }

  // ---------- Vœux ----------
  function vueVoeux() {
    const groupes = B.types.map((ty) => ({ ty, ...R.classement(E.candidatures, ty.id) })).filter((g) => g.classees.length || g.autres.length);
    const ligne = (c, i, n) => `<li class="voeu ${R.estActive(c) ? '' : 'voeu-fin'}">
        <span class="voeu-rang" aria-label="Rang ${i + 1}">${i + 1}</span>
        <button class="lien-ligne" data-action="ouvrir" data-id="${c.id}"><b>${esc(c.intitule || titreCand(c))}</b><span>${esc(c.organisme)}${c.ville ? ` · ${esc(c.ville)}` : ''}</span></button>
        ${pillStatut(c.statut)}
        <span class="voeu-boutons"><button class="btn-icone" data-action="monter" data-id="${c.id}" aria-label="Monter : ${esc(c.intitule)}" ${i === 0 ? 'disabled' : ''}>${ICONES.haut}</button><button class="btn-icone" data-action="descendre" data-id="${c.id}" aria-label="Descendre : ${esc(c.intitule)}" ${i === n - 1 ? 'disabled' : ''}>${ICONES.bas}</button><button class="btn-icone" data-action="declasser" data-id="${c.id}" aria-label="Retirer du classement : ${esc(c.intitule)}" title="Retirer du classement">×</button></span>
      </li>`;
    return `
      <div class="vue-tete"><div><h1>Vœux</h1><p>Ton ordre de préférence, type par type : ce que tu choisirais si tout était accepté. Il t'aide à décider vite quand une réponse arrive.</p></div>
        <div class="actions">${E.candidatures.length ? '<button class="btn" data-action="imprimer-voeux">Imprimer le classement</button>' : ''}</div></div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-voeux">
          <h2 class="titre-cat">${esc(g.ty.long)}<span>${pluriel(g.classees.length, 'vœu classé', 'vœux classés')}</span></h2>
          ${g.classees.length ? `<ol class="voeux">${g.classees.map((c, i) => ligne(c, i, g.classees.length)).join('')}</ol>` : '<p class="aide">Aucun vœu classé dans ce type.</p>'}
          ${g.autres.length ? `<h3 class="sous-titre">Pas encore classées</h3><ul class="non-classees">${g.autres.map((c) => `<li><button class="lien-ligne" data-action="ouvrir" data-id="${c.id}"><b>${esc(c.intitule || titreCand(c))}</b><span>${esc(c.organisme)}</span></button><button class="btn petit" data-action="classer" data-id="${c.id}">Classer</button></li>`).join('')}</ul>` : ''}
        </section>`).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à classer</h3><p>Ajoute des candidatures : tu pourras ensuite les ranger par ordre de préférence.</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Candidature</button></div></div></div>`}
      <p class="mention avertissement">Ce classement est le tien, pour t'aider à choisir. Il ne remplace pas celui qu'un établissement ou un service de candidature te demanderait : chacun a ses propres règles et ses propres dates, à lire à la source. Les candidatures refusées ou retirées sortent du classement.</p>`;
  }

  // ---------- Échéances ----------
  const FILTRES_NATURE = [['toutes', 'Tout'], ['limite', 'Dates limites'], ['entretien', 'Entretiens'], ['reponse', 'Réponses'], ['relance', 'Relances']];
  function vueEcheances() {
    const t = auj();
    const toutes = R.evenements(E.candidatures, t, E.reglages);
    const liste = toutes.filter((e) => filtre.nature === 'toutes' || e.nature === filtre.nature);
    const retard = liste.filter((e) => e.jours < 0 || (e.nature === 'relance' && e.due));
    const avenir = liste.filter((e) => !retard.includes(e));
    return `
      <div class="vue-tete"><div><h1>Échéances</h1><p>Toutes tes dates au même endroit : dates limites des candidatures à préparer, entretiens, réponses attendues et relances proposées. Rien ne vient d'un calendrier officiel : ce sont les dates que tu as saisies.</p></div>
        <div class="actions">${toutes.length ? '<button class="btn" data-action="ics">Ajouter à mon agenda (.ics)</button><button class="btn" data-action="imprimer-echeances">Imprimer</button>' : ''}</div></div>
      <div class="filtres" role="group" aria-label="Filtrer les échéances">${FILTRES_NATURE.map(([id, lib]) => `<button class="filtre" data-action="filtre-nature" data-nature="${id}" aria-pressed="${filtre.nature === id}">${esc(lib)} <small>${toutes.filter((e) => id === 'toutes' || e.nature === id).length}</small></button>`).join('')}</div>
      ${retard.length ? `<h2 class="titre-section">À traiter <span>dates passées, relances dues</span></h2><ul class="prochains">${retard.map((e) => ligneEvenement(e, { bouton: e.nature === 'relance' ? `<button class="btn petit" data-action="relance-rapide" data-id="${e.cand.id}" data-raison="${e.raison}">${e.raison === 'remerciement' ? 'Remercier' : 'Relancer'}</button>` : '' })).join('')}</ul>` : ''}
      ${avenir.length ? R.parMois(avenir).map((g) => `<h2 class="titre-section">${esc(moisAn(g.mois))} <span>${pluriel(g.liste.length, 'date')}</span></h2><ul class="prochains">${g.liste.map((e) => ligneEvenement(e)).join('')}</ul>`).join('') : ''}
      ${!liste.length ? `<div class="vide-etat" style="margin-top:20px">${FORME_VIDE}<div><h3>${toutes.length ? 'Rien dans ce filtre' : 'Aucune date pour l\'instant'}</h3><p>${toutes.length ? 'Choisis un autre filtre.' : 'Ouvre une candidature et saisis sa date limite, la date de l\'entretien ou la date de réponse annoncée.'}</p></div></div>` : ''}
      <p class="mention avertissement">Le fichier .ics s'importe dans l'agenda de ton téléphone ou de ton ordinateur ; il n'est pas mis à jour tout seul : exporte-le de nouveau après un changement. ${esc(B.avertissement)}</p>`;
  }

  // ---------- Préparer : lettre et entretien ----------
  function vuePreparer() {
    const actives = R.trier(E.candidatures, auj());
    if (!sel || !cand(sel)) {
      // Par défaut : l'entretien le plus proche (onglet Entretien) ou la prochaine date limite à venir (Lettre).
      const t = auj();
      const parDate = (l, k) => l.slice().sort((x, y) => (x.dates[k] < y.dates[k] ? -1 : 1))[0];
      const choix = sousVue === 'entretien'
        ? parDate(actives.filter((c) => c.statut === 'entretien' && c.dates.entretien >= t), 'entretien')
        : parDate(actives.filter((c) => c.statut === 'preparer' && c.dates.limite >= t), 'limite');
      sel = (choix || actives.find((c) => R.estActive(c)) || actives[0])?.id || null;
    }
    const c = sel ? cand(sel) : null;
    const tete = `<div class="vue-tete"><div><h1>Lettres et entretiens</h1><p>Une lettre de motivation construite sur une trame, et les questions d'entretien préparées avec tes notes, candidature par candidature.</p></div></div>`;
    if (!c) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune candidature</h3><p>Ajoute une candidature pour écrire sa lettre et préparer son entretien.</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Candidature</button></div></div></div>`;
    return `${tete}
      <div class="outils-liste outils-preparer">
        <label class="champ choix-cand">Candidature<select data-action="choisir-cand">${actives.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(`${x.intitule || 'Sans intitulé'} · ${x.organisme || '—'}`)}${R.estActive(x) ? '' : ` (${esc(statutDe(x.statut).court.toLowerCase())})`}</option>`).join('')}</select></label>
        <div class="filtres" role="tablist" aria-label="Préparer">${[['lettre', 'Lettre de motivation'], ['entretien', 'Entretien']].map(([id, lib]) => `<button class="filtre" role="tab" data-action="sous-vue" data-sous="${id}" aria-selected="${sousVue === id}" aria-pressed="${sousVue === id}">${lib}</button>`).join('')}</div>
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

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider) {
    const d = modale();
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const optionsModeles = (type, v) => B.modeles.filter((m) => !m.type || m.type === type).map((m) => `<option value="${m.id}" ${m.id === v ? 'selected' : ''}>${esc(m.nom)}${m.pieces.length ? ` (${m.pieces.length} pièces)` : ''}</option>`).join('');
  const verifierSecrets = (...v) => { const s = v.map(R.contientSecret).find(Boolean); return s ? R.MESSAGES_SENSIBLES[s] : ''; };

  function modaleNouvelle(type = 'formation', brouillon = {}) {
    const ty = typeDe(type);
    const v = { modele: R.modeleParDefaut(type), intitule: '', organisme: '', ville: '', limite: '', lien: '', ...brouillon };
    ouvrirModale('Nouvelle candidature', `
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut choix-4">${B.types.map((t) => `<label><input type="radio" name="type" value="${t.id}" ${t.id === type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">${esc(ty.intitule)}<input name="intitule" maxlength="120" value="${esc(v.intitule)}" placeholder="${esc(ty.exemple)}"></label>
      <div class="rang-champs">
        <label class="champ">${esc(ty.organisme)}<input name="organisme" maxlength="120" value="${esc(v.organisme)}"></label>
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(v.ville)}"></label>
      </div>
      <label class="champ">Liste de pièces de départ<small>Pièces souvent demandées : tu ajoutes ou retires ensuite.</small><select name="modele">${optionsModeles(type, v.modele)}</select></label>
      <div class="rang-champs">
        <label class="champ">Date limite<small>Celle de l'établissement ou de l'offre.</small><input type="date" name="limite" value="${esc(v.limite)}"></label>
        <label class="champ">Lien de l'offre<small>Facultatif.</small><input type="url" name="lien" maxlength="300" value="${esc(v.lien)}" placeholder="https://…"></label>
      </div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const intitule = String(f.get('intitule') || '').trim();
      const organisme = String(f.get('organisme') || '').trim();
      if (!intitule && !organisme) return 'Indique au moins l\'intitulé ou l\'établissement.';
      const lien = String(f.get('lien') || '').trim();
      if (lien && !/^https?:\/\/\S+$/i.test(lien)) return 'Le lien doit commencer par https://';
      const s = verifierSecrets(intitule, organisme, f.get('ville'));
      if (s) return s;
      retenir();
      const t = f.get('type');
      const ordre = R.classement(E.candidatures, t).classees.length + 1;
      const c = R.normaliserCandidature({ id: uid(), type: t, intitule, organisme, ville: f.get('ville'), lien, dates: { limite: f.get('limite') || null }, pieces: R.piecesDuModele(B, f.get('modele')), creeLe: auj(), rang: ordre }, B);
      E.candidatures.push(c);
      sauver();
      changerVue('candidatures', c.id);
      toast(`« ${c.intitule || c.organisme} » créée avec ${pluriel(c.pieces.length, 'pièce')} à fournir.`, { libelle: 'Annuler', faire: annuler });
    });
    modale().querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', () => {
      const d = modale();
      const lire = (n) => d.querySelector(`[name=${n}]`).value;
      modaleNouvelle(x.value, { intitule: lire('intitule'), organisme: lire('organisme'), ville: lire('ville'), limite: lire('limite'), lien: lire('lien') });
    }));
  }

  function modaleModifier(id) {
    const c = cand(id);
    if (!c) return;
    const ty = typeDe(c.type);
    ouvrirModale(esc(titreCand(c)), `
      <label class="champ">${esc(ty.intitule)}<input name="intitule" maxlength="120" value="${esc(c.intitule)}"></label>
      <div class="rang-champs">
        <label class="champ">${esc(ty.organisme)}<input name="organisme" maxlength="120" value="${esc(c.organisme)}"></label>
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(c.ville)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Type<select name="type">${B.types.map((t) => `<option value="${t.id}" ${t.id === c.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        <label class="champ">Contact<small>Service ou fonction, facultatif.</small><input name="contact" maxlength="120" value="${esc(c.contact)}" placeholder="Ex. : Service des admissions"></label>
      </div>
      <label class="champ">Lien de l'offre<input type="url" name="lien" maxlength="300" value="${esc(c.lien)}" placeholder="https://…"></label>
      <fieldset class="champ cadre-champs"><legend>Dates <small>Recopie celles de l'établissement ou du recruteur.</small></legend>
        <div class="rang-champs">
          <label class="champ">Date limite<input type="date" name="limite" value="${c.dates.limite || ''}"></label>
          <label class="champ">Envoyée le<input type="date" name="envoi" value="${c.dates.envoi || ''}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">${c.type === 'formation' ? 'Entretien ou épreuve' : 'Entretien'}<input type="date" name="entretien" value="${c.dates.entretien || ''}"></label>
          <label class="champ">Heure<input type="time" name="heure" value="${esc(c.dates.heure)}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Format<select name="format">${B.formatsEntretien.map((x) => `<option value="${x.id}" ${x.id === c.entretien.format ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
          <label class="champ">Lieu ou lien<input name="lieu" maxlength="120" value="${esc(c.entretien.lieu)}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Réponse attendue<input type="date" name="reponse" value="${c.dates.reponse || ''}"></label>
          <label class="champ">Réponse reçue le<input type="date" name="recue" value="${c.dates.recue || ''}"></label>
        </div>
      </fieldset>
      <label class="champ">Notes<textarea name="note" rows="3" maxlength="600">${esc(c.note)}</textarea></label>
      <label class="champ">Motif ou suite<small>Après une réponse : motif d'un refus, conditions d'une acceptation, ta place sur liste d'attente.</small><input name="motif" maxlength="200" value="${esc(c.motif)}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (f, action) => {
      if (action === 'supprimer') {
        retenir();
        E.candidatures = R.resserrer(E.candidatures.filter((x) => x.id !== c.id));
        sauver(); changerVue('candidatures'); toast(`« ${titreCand(c)} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      if (action === 'dupliquer') {
        retenir();
        const copie = R.normaliserCandidature({ ...structuredClone(c), id: uid(), statut: 'preparer', rang: null, intitule: `${c.intitule} (copie)`.slice(0, 120), dates: { limite: null }, relances: [], motif: '', creeLe: auj(), pieces: c.pieces.map((x) => ({ ...x, id: uid(), statut: x.statut === 'envoyee' ? 'prete' : x.statut })), entretien: { format: c.entretien.format, questions: c.entretien.questions.map((x) => ({ ...x, id: uid() })) } }, B);
        E.candidatures.push(copie);
        sauver(); changerVue('candidatures', copie.id); toast('Candidature dupliquée : mêmes pièces et lettre, sans les dates.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const lien = String(f.get('lien') || '').trim();
      if (lien && !/^https?:\/\/\S+$/i.test(lien)) return 'Le lien doit commencer par https://';
      if (!String(f.get('intitule') || '').trim() && !String(f.get('organisme') || '').trim()) return 'Indique au moins l\'intitulé ou l\'établissement.';
      const s = verifierSecrets(f.get('intitule'), f.get('organisme'), f.get('contact'), f.get('note'), f.get('motif'), f.get('lieu'));
      if (s) return s;
      const d = (n) => f.get(n) || null;
      if (d('recue') && d('envoi') && d('recue') < d('envoi')) return 'La réponse reçue est avant la date d\'envoi.';
      retenir();
      const typeAvant = c.type;
      Object.assign(c, R.normaliserCandidature({ ...c, intitule: f.get('intitule'), organisme: f.get('organisme'), ville: f.get('ville'), type: f.get('type'), contact: f.get('contact'), lien, note: f.get('note'), motif: f.get('motif'),
        rang: f.get('type') === typeAvant ? c.rang : null,
        dates: { limite: d('limite'), envoi: d('envoi'), entretien: d('entretien'), heure: f.get('heure') || '', reponse: d('reponse'), recue: d('recue') },
        entretien: { ...c.entretien, format: f.get('format'), lieu: f.get('lieu') } }, B));
      if (c.type !== typeAvant) E.candidatures = R.resserrer(E.candidatures);
      sauver(); rendre(); toast('Candidature enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function changerStatut(id, statut) {
    const c = cand(id);
    if (!c || c.statut === statut) return;
    const avant = R.avancement(c);
    retenir();
    const n = R.changerStatut(c, statut, auj());
    Object.assign(c, n);
    if (['refusee', 'retiree'].includes(statut)) E.candidatures = R.resserrer(E.candidatures);
    sauver(); rendre();
    const msg = {
      envoyee: avant.manquantes ? `Envoyée. Attention : ${pluriel(avant.manquantes, 'pièce n\'était pas prête', 'pièces n\'étaient pas prêtes')}.` : `Envoyée le ${dateLongue(c.dates.envoi)} : bonne chance !`,
      entretien: 'Statut « Entretien » : note la date et prépare les questions.',
      acceptee: 'Acceptée : bravo ! Pense aux pièces à fournir après acceptation et à répondre dans les délais indiqués.',
      refusee: 'Refusée : la candidature sort de ton classement. Note le motif si tu le connais.',
      attente: 'Liste d\'attente : note ta place dans « Motif ou suite » et la date de réponse annoncée.',
      retiree: 'Retirée : la candidature sort de ton classement.',
      preparer: 'Repassée « À préparer ».',
    }[statut];
    toast(msg, { libelle: 'Annuler', faire: annuler });
    if (statut === 'entretien' && !c.dates.entretien) setTimeout(() => modaleModifier(id), 0);
  }

  function modalePiece(id, pid) {
    const c = cand(id);
    if (!c) return;
    const x = pid ? c.pieces.find((y) => y.id === pid) : null;
    if (pid && !x) return;
    const dispo = B.pieces.filter((p) => !c.pieces.some((y) => y.ref === p.id));
    const v = x || { ref: '', nom: '', statut: 'afaire', apres: false, precision: '' };
    const ref = v.ref ? R.pieceDe(B, v.ref) : null;
    ouvrirModale(x ? esc(x.nom) : 'Ajouter une pièce', `
      ${x ? (ref ? `<p class="aide">${esc(ref.aide)}</p>` : '') : `<label class="champ">Pièce type<select name="ref"><option value="">Autre pièce (nom libre)</option>${dispo.map((p) => `<option value="${p.id}">${esc(p.nom)}${p.apres ? ' (après acceptation)' : ''}</option>`).join('')}</select></label>`}
      <label class="champ">Nom<small>${x ? '' : 'Laisse vide pour reprendre le nom de la pièce type.'}</small><input name="nom" maxlength="80" value="${esc(v.nom)}" placeholder="Ex. : Questionnaire de motivation"></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut choix-4">${B.statutsPiece.map((s) => `<label><input type="radio" name="statut" value="${s.id}" ${s.id === v.statut ? 'checked' : ''}><span>${esc(s.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Précision<small>Qui la remplit, à qui tu l'as demandée, le format attendu.</small><input name="precision" maxlength="120" value="${esc(v.precision)}"></label>
      <label class="case"><input type="checkbox" name="apres" ${v.apres ? 'checked' : ''}> À fournir seulement après acceptation</label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        retenir(); c.pieces = c.pieces.filter((y) => y.id !== x.id);
        sauver(); rendre(); toast(`« ${x.nom} » retirée de la liste.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const refChoisie = x ? x.ref : (f.get('ref') || null);
      const nom = String(f.get('nom') || '').trim() || (refChoisie ? R.pieceDe(B, refChoisie)?.nom : '');
      if (!nom) return 'Donne un nom à la pièce.';
      const s = verifierSecrets(nom, f.get('precision'));
      if (s) return s;
      retenir();
      const n = R.normaliserPiece({ id: x?.id || uid(), ref: refChoisie, nom, statut: f.get('statut'), precision: f.get('precision'), apres: Boolean(f.get('apres')) }, B);
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
      <label class="champ">Note<small>Facultative : ce qui a été dit, la réponse promise.</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') { retenir(); c.relances = c.relances.filter((y) => y.id !== x.id); sauver(); rendre(); toast('Relance supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      if (!R.estDate(f.get('date'))) return 'Indique la date de la relance.';
      if (f.get('date') > auj()) return 'Une relance se note une fois faite : la date ne peut pas être dans le futur.';
      const s = verifierSecrets(f.get('note'));
      if (s) return s;
      retenir();
      const n = R.normaliserRelance({ id: x?.id || uid(), date: f.get('date'), canal: f.get('canal'), note: f.get('note') });
      if (x) Object.assign(x, n); else c.relances.push(n);
      c.relances.sort((a, b) => (a.date < b.date ? -1 : 1));
      sauver(); rendre(); toast('Relance notée : le délai repart de cette date.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleMessage(id, raison) {
    const c = cand(id);
    if (!c) return;
    const r = raison || R.relance(c, auj(), E.reglages.relance)?.raison || '';
    const texte = R.messageRelance(B, c, E.profil, dateLongue, r);
    ouvrirModale(r === 'remerciement' ? 'Message de remerciement' : 'Message de relance', `
      <p>Copie ce message, adapte-le, puis envoie-le toi-même${c.contact ? ` (${esc(c.contact)})` : ''}. L'application n'envoie rien.</p>
      <label class="champ"><span class="sr-only">Message</span><textarea id="message-relance" rows="11">${esc(texte)}</textarea></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Copier et noter la relance</button><button class="btn" value="copier">Copier seulement</button><button class="btn" value="annuler">Fermer</button>', (_, action) => {
      const t = $('#message-relance').value;
      copier(t, action === 'copier' ? 'Message copié.' : 'Message copié.');
      if (action === 'ok') {
        retenir();
        c.relances.push(R.normaliserRelance({ id: uid(), date: auj(), canal: 'email', note: r === 'remerciement' ? 'Remerciement après l\'entretien' : 'Relance' }));
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
  const enTete = (titre, sous = '') => `<header><p>${esc(E.profil.signature || E.profil.prenom || 'Candidatures')}${E.profil.campagne ? ` · ${esc(E.profil.campagne)}` : ''} · au ${dateLongue(auj())}</p><h1>${titre}</h1>${sous ? `<p>${sous}</p>` : ''}</header>`;
  const dateTxt = (d) => (d ? dateCourte(d) + ' ' + d.slice(0, 4) : '');

  function imprimerRecap() {
    const liste = R.trier(E.candidatures, auj());
    imprimer(`${enTete('Mes candidatures', `${pluriel(liste.length, 'candidature')}, dont ${R.bilan(E.candidatures, auj(), E.reglages).actives} en cours`)}
      <table><thead><tr><th>Candidature</th><th>Type</th><th>Statut</th><th>Date limite</th><th>Envoyée</th><th>Entretien</th><th>Réponse</th><th>Pièces</th></tr></thead><tbody>${liste.map((c) => { const a = R.avancement(c); return `<tr><td><b>${esc(c.intitule)}</b><br>${esc(c.organisme)}${c.ville ? `, ${esc(c.ville)}` : ''}</td><td>${esc(nomType(c.type))}${c.rang && R.classable(c) ? ` · n°${c.rang}` : ''}</td><td>${esc(nomStatut(c.statut))}</td><td>${dateTxt(c.dates.limite)}</td><td>${dateTxt(c.dates.envoi)}</td><td>${dateTxt(c.dates.entretien)}${c.dates.heure ? ` ${esc(c.dates.heure)}` : ''}</td><td>${c.dates.recue ? `reçue ${dateTxt(c.dates.recue)}` : c.dates.reponse ? `attendue ${dateTxt(c.dates.reponse)}` : ''}</td><td>${a.pretes}/${a.total}</td></tr>`; }).join('')}</tbody></table>
      <p class="mention">Dates saisies par l'utilisateur, à vérifier auprès de chaque établissement ou recruteur.</p>`, 'impr-liste');
  }

  function imprimerDossier(id) {
    const c = cand(id); if (!c) return;
    imprimer(`${enTete(esc(c.intitule || titreCand(c)), `${esc(nomType(c.type))} · ${esc(c.organisme)}${c.ville ? `, ${esc(c.ville)}` : ''} · ${esc(nomStatut(c.statut))}`)}
      <h2>Dates</h2><table><tbody>${[['Date limite', c.dates.limite], ['Envoyée le', c.dates.envoi], ['Entretien', c.dates.entretien], ['Réponse attendue', c.dates.reponse], ['Réponse reçue', c.dates.recue]].map(([l, d]) => `<tr><th style="width:35%">${l}</th><td>${d ? dateLongue(d) : ''}${l === 'Entretien' && c.dates.heure ? ` à ${esc(c.dates.heure)}` : ''}</td></tr>`).join('')}</tbody></table>
      <h2>Pièces à fournir</h2><table><thead><tr><th style="width:8%">Fait</th><th>Pièce</th><th>Statut</th><th>Précision</th></tr></thead><tbody>${c.pieces.map((x) => `<tr><td>${x.statut === 'prete' || x.statut === 'envoyee' ? '☑' : '☐'}</td><td><b>${esc(x.nom)}</b>${x.apres ? ' (après acceptation)' : ''}</td><td>${esc(nomStatutPiece(x.statut))}</td><td>${esc(x.precision)}</td></tr>`).join('') || '<tr><td colspan="4">Aucune pièce listée</td></tr>'}</tbody></table>
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
    const evs = R.evenements(E.candidatures, auj(), E.reglages);
    imprimer(`${enTete('Mes échéances', pluriel(evs.length, 'date'))}
      <table><thead><tr><th>Date</th><th>Quoi</th><th>Candidature</th><th>Fait</th></tr></thead><tbody>${evs.map((e) => `<tr class="${e.jours < 0 ? 'retard' : ''}"><td>${dateJour(e.date)} ${e.date.slice(0, 4)}${e.heure ? ` · ${esc(e.heure)}` : ''}</td><td>${esc(nomNature(e))}</td><td><b>${esc(e.cand.intitule)}</b> · ${esc(e.cand.organisme)}</td><td>☐</td></tr>`).join('')}</tbody></table>
      <p class="mention">Dates saisies par l'utilisateur, à vérifier auprès de chaque établissement ou recruteur.</p>`, 'impr-liste');
  }
  function imprimerVoeux() {
    const groupes = B.types.map((ty) => ({ ty, ...R.classement(E.candidatures, ty.id) })).filter((g) => g.classees.length);
    imprimer(`${enTete('Mes vœux, par ordre de préférence')}
      ${groupes.map((g) => `<h2>${esc(g.ty.long)}</h2><table><thead><tr><th style="width:8%">Rang</th><th>Candidature</th><th>Statut</th></tr></thead><tbody>${g.classees.map((c, i) => `<tr><td>${i + 1}</td><td><b>${esc(c.intitule)}</b> · ${esc(c.organisme)}</td><td>${esc(nomStatut(c.statut))}</td></tr>`).join('')}</tbody></table>`).join('') || '<p>Aucun vœu classé.</p>'}`, 'impr-liste');
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="rang-champs">
        <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.profil.prenom)}"></label>
        <label class="champ">Signature<small>Prénom et nom, pour les lettres et messages.</small><input name="signature" maxlength="80" value="${esc(E.profil.signature)}"></label>
      </div>
      <label class="champ">Campagne<small>Ex. : « Rentrée prochaine », « Stage de fin d'études ».</small><input name="campagne" maxlength="60" value="${esc(E.profil.campagne)}"></label>
      <div class="rang-champs">
        <label class="champ">Alerte avant une date limite<select name="alerte">${[3, 5, 7, 10, 14, 21, 30].map((n) => `<option value="${n}" ${n === E.reglages.alerte ? 'selected' : ''}>${n} jours</option>`).join('')}</select></label>
        <label class="champ">Relance après un envoi sans nouvelles<select name="relance">${[5, 7, 10, 14, 21, 30].map((n) => `<option value="${n}" ${n === E.reglages.relance ? 'selected' : ''}>${n} jours</option>`).join('')}</select></label>
      </div>
      <p class="aide">Pour une formation, la relance n'est proposée qu'une fois la date de réponse annoncée passée : les établissements donnent en général leur calendrier.</p>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique : exporte en tableur ou vers ton agenda, ou imprime depuis les onglets.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Candidatures en CSV</button><button class="btn petit" type="button" data-action="ics">Échéances (.ics)</button><button class="btn petit" type="button" data-action="imprimer-recap">Imprimer le récapitulatif</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi des candidatures, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application : pratique pour cocher une pièce ou relire tes notes avant un entretien.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Aucun calendrier officiel n'est intégré et aucune plateforme de candidature n'est connectée : les dates sont celles que tu saisis, à vérifier sur le site de chaque établissement ou auprès de chaque recruteur. Les listes de pièces (${B.pieces.length} pièces types, ${B.modeles.length - 1} listes de départ) sont des points de départ. Questions d'entretien (${B.questions.length}), pistes et trames de lettre (${B.trames.length}) : textes originaux QME, base version ${B.version}. Ne note ici aucun mot de passe ni identifiant de connexion.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const s = verifierSecrets(f.get('prenom'), f.get('signature'), f.get('campagne'));
      if (s) return s;
      retenir();
      E.profil = { prenom: String(f.get('prenom') || '').trim().slice(0, 40), signature: String(f.get('signature') || '').trim().slice(0, 80), campagne: String(f.get('campagne') || '').trim().slice(0, 60) };
      E.reglages = { alerte: Number(f.get('alerte')) || R.ALERTE_DEFAUT, relance: Number(f.get('relance')) || R.RELANCE_DEFAUT };
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.candidatures)) throw new Error();
        if (!confirm(`Remplacer tes candidatures actuelles par cette copie (${pluriel(d.candidatures.length, 'candidature')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe;
        E.tutorielVu = vu;
        modale().close(); sauver(); sel = null; rendre(); toast('Copie restaurée.');
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
  const exporterCsv = () => telecharger(R.versCsv(R.trier(E.candidatures, auj()), ctxCsv), 'text/csv;charset=utf-8', `candidatures-${auj()}.csv`);
  function exporterIcs() {
    const evs = R.evenements(E.candidatures, auj(), E.reglages).filter((e) => e.nature !== 'relance' || e.due);
    if (!evs.length) { toast('Aucune date à exporter : saisis d\'abord des dates dans tes candidatures.'); return; }
    const h = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    telecharger(R.versIcs(evs, { nomNature }, h), 'text/calendar;charset=utf-8', `candidatures-echeances-${auj()}.ics`);
    toast(`${pluriel(evs.length, 'date')} exportée${evs.length > 1 ? 's' : ''} : ouvre le fichier pour l'ajouter à ton agenda.`);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const rg = E.reglages;
    const blocs = [
      ['rose', 'Une fiche par candidature', `Formation, stage, alternance ou job étudiant&nbsp;: chaque fiche part d'une liste de pièces à adapter, que tu fais passer de <b>À faire</b> à <b>Prête</b> puis <b>Envoyée</b>. Recopie aussi les dates données par l'établissement ou le recruteur&nbsp;: date limite, entretien, réponse annoncée. Aucun calendrier officiel n'est intégré.`],
      ['beurre', 'Envoie d\'abord le plus urgent', `Le <b>Tableau de bord</b> liste dans <b>À envoyer</b> les candidatures à préparer dont la date limite est passée ou tombe dans les ${rg.alerte}&nbsp;jours, la plus proche en premier, avec les pièces qui manquent encore. Il montre aussi les entretiens et les réponses des 14 prochains jours.`],
      ['ciel', 'Tiens le statut à jour', `<b>À préparer</b>, <b>Envoyée</b>, <b>Entretien</b>, <b>Liste d'attente</b>, puis <b>Acceptée</b>, <b>Refusée</b> ou <b>Retirée</b>. Une relance est proposée quand la date de réponse annoncée est passée et, hors formation, ${rg.relance}&nbsp;jours après le dernier contact sans nouvelles. Après un entretien, c'est un remerciement. Un message prêt à copier t'aide à l'écrire.`],
      ['sable', 'Classe tes vœux et prépare-toi', `Dans <b>Vœux</b>, range tes candidatures par ordre de préférence, type par type&nbsp;: tu sauras quoi choisir quand une réponse arrive. <b>Lettres et entretiens</b> t'aide à écrire une lettre de motivation sur une trame et à préparer les questions types avec tes notes.`],
    ];
    const corps = `
      <p>L'application te dit quoi envoyer d'abord, qui relancer et quelles dates arrivent. Ton rôle&nbsp;: créer une fiche par candidature, y recopier les dates qu'on te donne et tenir son statut à jour.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Échéances</b> réunit toutes tes dates et s'ajoute à ton agenda (.ics). Les délais d'alerte et de relance se règlent dans les réglages. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes candidatures sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premiere = auto && !E.candidatures.length;
    const pied = premiere
      ? '<button class="btn primaire" value="nouvelle">Ajouter ma première candidature</button><button class="btn" value="ok">Fermer</button>'
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
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; stock.suppr(CLE_DEMO); E = donneesDemo(); E.tutorielVu = vu; sel = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': lireAccueil2(); accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(true); break;
      case 'accueil-passer': terminerAccueil(false); break;
      case 'vue':
        if (modale().open) modale().close();
        if (el.dataset.vue === 'candidatures') { filtre.statut = el.dataset.statut || (el.closest('.tuiles') ? 'actives' : filtre.statut); }
        changerVue(el.dataset.vue); break;
      case 'voir-statut': filtre.statut = el.dataset.statut; filtre.type = 'tous'; filtre.q = ''; changerVue('candidatures'); break;
      case 'ouvrir': if (modale().open) modale().close(); changerVue('candidatures', id); break;
      case 'preparer': sousVue = el.dataset.sous || 'lettre'; changerVue('preparer', id); break;
      case 'sous-vue': sousVue = el.dataset.sous; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'ics': exporterIcs(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle': modaleNouvelle(filtre.type !== 'tous' ? filtre.type : 'formation'); break;
      case 'modifier': modaleModifier(id); break;
      case 'statut': changerStatut(id, el.dataset.statut); break;
      case 'piece-statut': cyclerPiece(id, el.dataset.piece); break;
      case 'piece': modalePiece(id, el.dataset.piece); break;
      case 'ajouter-piece': modalePiece(id, null); break;
      case 'relance': modaleRelance(id, el.dataset.relance || null); break;
      case 'relance-rapide': modaleMessage(id, el.dataset.raison); break;
      case 'filtre-statut': filtre.statut = el.dataset.statut; rendre(); break;
      case 'filtre-type': filtre.type = el.dataset.type; rendre(); break;
      case 'filtre-nature': filtre.nature = el.dataset.nature; rendre(); break;
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
    if (new URLSearchParams(location.search).has('demo') && code !== CODE_DEMO && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname);
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
