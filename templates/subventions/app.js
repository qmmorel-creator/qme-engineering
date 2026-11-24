// Subventions QME : dossiers de subvention par projet et par financeur (commune, département, région, État,
// fondations, mécénat), pièces à fournir, échéances saisies (dépôt, réponse, versements, bilan) avec alertes,
// montants demandés, accordés, versés et reste à percevoir, budget prévisionnel du projet avec la part de chaque
// financeur, dépenses justificatives, trame du bilan, tableau de bord annuel, export CSV et impression.
// Aucun calendrier de financeur intégré. Rappels réglementaires des subventions publiques sourcés et datés
// (service-public.gouv.fr), désactivables. Données synchronisées par clé de licence ou code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.SBV;
  const API = '/api/templates';
  const PRODUIT = 'SBV';
  const CLE_CODE = 'qme-sbv-code';
  const CLE_CACHE = 'qme-sbv-cache';
  const CLE_DEMO = 'qme-sbv-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-sbv-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const { pluriel, ajout, ajoutMois, versDate, ecart, euros, pct } = R;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const fmt = (s, o) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const typeF = (id) => B.typesFinanceur.find((t) => t.id === id) || B.typesFinanceur[B.typesFinanceur.length - 1];
  const couleurType = (id) => B.couleurs[typeF(id).couleur % B.couleurs.length];
  const financeur = (id) => E.financeurs.find((f) => f.id === id) || null;
  const projet = (id) => E.projets.find((p) => p.id === id) || null;
  const dossier = (id) => E.dossiers.find((d) => d.id === id) || null;
  const nomFinanceur = (id) => financeur(id)?.nom || 'Financeur à préciser';
  const nomProjet = (id) => projet(id)?.nom || 'Sans projet (fonctionnement)';
  const pastilleType = (type) => `<i class="pastille-type" style="--p:${couleurType(type)}" aria-hidden="true"></i>`;
  const public_ = (d) => R.estPublic(B, financeur(d.financeur));
  const titreDossier = (d) => d.intitule || `${nomFinanceur(d.financeur)} · ${d.annee}`;
  const ex = (a) => R.libelleExercice(a, E.reglages.debutExercice);
  const SOURCES = Object.fromEntries(B.sources.map((s) => [s.id, s]));
  const sourceCourte = (id) => { const s = SOURCES[id]; return `${s.editeur}, fiche « ${s.titre} » vérifiée le ${s.verifiePar}, consultée le ${dateLongue(s.consulte)}`; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let ouvert = { dossier: null, projet: null };
  const filtre = { statut: 'ouverts', annee: 'toutes', q: '', projet: '' };
  let anneeVue = Number(auj().slice(0, 4));
  let annulation = null;

  // R.normaliser ne garde que les champs connus : tutorielVu (guide « Comment ça marche » déjà vu) est réinjecté ici.
  const etatVide = () => ({ ...R.etatVide(B.reglages), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, auj(), B), tutorielVu: !!d?.tutorielVu });

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
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié tes dossiers entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (SBV-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Association fictive. Dates relatives à aujourd'hui, tous les états : dépôt proche avec pièces manquantes, dépôt
  // plus lointain, réponse en retard à relancer, accord partiel avec un versement en retard, accord au-delà de
  // 23 000 € sans convention, refus, abandon, fonctionnement soldé sans bilan, bilan de l'an dernier en retard,
  // dossier clos ; dépenses avec et sans justificatif, imputées ou non.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const Y = Number(t.slice(0, 4));
    const j = (n) => ajout(t, n);
    e.structure = 'Les Ateliers du Quartier (association fictive)';
    const F = (id, nom, type, contact = '') => R.normaliserFinanceur({ id, nom, type, contact }, B.typesFinanceur);
    e.financeurs = [
      F('f-commune', 'Commune · service vie associative', 'commune', 'Chargé(e) de mission vie associative'),
      F('f-dep', 'Département · culture et lien social', 'departement', 'Service culture'),
      F('f-region', 'Région · mobilités et transition', 'region', 'Direction des mobilités'),
      F('f-etat', 'État · politique de la ville', 'etat', 'Délégué(e) du préfet'),
      F('f-fondation', 'Fondation Exemple pour l\'enfance', 'fondation', 'Responsable des programmes'),
      F('f-mecene', 'Imprimerie du coin (mécène fictif)', 'mecenat', 'Gérant(e)'),
    ];
    const L = (poste, libelle, montant) => ({ poste, libelle, montant });
    const P = B.postes;
    e.projets = [
      R.normaliserProjet({ id: 'p-fete', nom: `Fête de quartier ${Y}`, annee: Y, description: 'Une journée de spectacles, d\'ateliers et de repas partagé sur la place, préparée avec les habitants.', charges: [
        L(P[1], 'Compagnies et intervenants', 6200), L(P[2], 'Scène, sonorisation, barnums', 2800), L(P[0], 'Matériel des ateliers', 1400),
        L(P[5], 'Affiches et flyers', 900), L(P[6], 'Assurance de la manifestation', 350), L(P[7], 'Coordination', 1350)],
      ressources: [{ poste: B.ressources[2], libelle: 'Buvette', montant: 1200 }, { poste: B.ressources[0], libelle: '', montant: 800 }] }, t),
      R.normaliserProjet({ id: 'p-velo', nom: 'Atelier vélo solidaire', annee: Y, description: 'Un atelier d\'autoréparation ouvert deux soirs par semaine, avec un animateur salarié à mi-temps.', charges: [
        L(P[3], 'Animateur à mi-temps', 21000), L(P[0], 'Outillage et pièces', 6500), L(P[2], 'Local', 4800), L(P[5], 'Communication', 700)],
      ressources: [{ poste: B.ressources[1], libelle: 'Adhésions à l\'atelier', montant: 2400 }] }, t),
      R.normaliserProjet({ id: 'p-fete-av', nom: `Fête de quartier ${Y - 1}`, annee: Y - 1, description: 'Édition précédente.', charges: [
        L(P[1], 'Compagnies', 5400), L(P[2], 'Scène et son', 2600), L(P[5], 'Affiches', 700)], ressources: [{ poste: B.ressources[2], libelle: 'Buvette', montant: 1000 }] }, t),
    ];
    const pieces = (type, pretes, envoyees = []) => R.piecesDepart(B, type).map((p) => ({ ...p, statut: envoyees.includes(p.base) ? 'joint' : pretes.includes(p.base) ? 'pret' : 'afaire' }));
    const tout = (type) => R.piecesDepart(B, type).map((p) => ({ ...p, statut: 'joint' }));
    const V = (montant, prevuLe, recuLe = null) => ({ montant, prevuLe, recuLe });
    const D = (x) => R.normaliserDossier({ creeLe: j(-150), ...x }, t);
    e.dossiers = [
      D({ id: 'd-fete-commune', projet: 'p-fete', financeur: 'f-commune', annee: Y, intitule: 'Fête de quartier · commune', dispositif: 'Subvention aux projets associatifs', demande: 5000, accorde: 4000, statut: 'accorde',
        limiteDepot: j(-190), depot: j(-195), reponse: j(-130), versements: [V(2400, j(-115), j(-112)), V(1600, j(-12))], pieces: tout('commune'), piecesBilan: R.piecesBilanDepart(B),
        bilan: { realise: 'La fête a eu lieu sur la place, de 11 h à 22 h : quatre spectacles, six ateliers, un repas partagé.', public: 'Environ 900 visiteurs, 40 bénévoles.', resultats: '', ecarts: '', suites: '' } }),
      D({ id: 'd-fete-dep', projet: 'p-fete', financeur: 'f-dep', annee: Y, intitule: 'Fête de quartier · département', dispositif: 'Appel à projets culture de proximité', demande: 3000, statut: 'depose',
        limiteDepot: j(-60), depot: j(-62), reponseAttendue: j(-6), pieces: tout('departement'), note: 'Instruction annoncée en commission d\'automne.' }),
      D({ id: 'd-fete-fondation', projet: 'p-fete', financeur: 'f-fondation', annee: Y, intitule: 'Fête de quartier · ateliers enfants', dispositif: 'Appel à projets annuel', demande: 1500, statut: 'preparation',
        limiteDepot: j(9), pieces: pieces('fondation', ['presentation', 'statuts', 'rib', 'comptes']) }),
      D({ id: 'd-fete-mecene', projet: 'p-fete', financeur: 'f-mecene', annee: Y, intitule: 'Impression des affiches', demande: 600, statut: 'refuse', depot: j(-120), reponse: j(-95), pieces: tout('mecenat'), note: 'Budget mécénat déjà engagé cette année : à reproposer plus tôt.' }),
      D({ id: 'd-velo-region', projet: 'p-velo', financeur: 'f-region', annee: Y, intitule: 'Atelier vélo · région', dispositif: 'Soutien aux initiatives de mobilité', demande: 28000, accorde: 25000, statut: 'accorde', nature: 'projet',
        limiteDepot: j(-210), depot: j(-215), reponse: j(-160), versements: [V(15000, j(-140), j(-135)), V(10000, j(60))], pieces: tout('region'), piecesBilan: R.piecesBilanDepart(B) }),
      D({ id: 'd-velo-etat', projet: 'p-velo', financeur: 'f-etat', annee: Y + 1, intitule: 'Atelier vélo · politique de la ville', dispositif: 'Appel à projets annuel', demande: 6000, statut: 'preparation',
        limiteDepot: j(40), pieces: pieces('etat', ['statuts', 'dirigeants', 'identifiants', 'rib', 'comptes', 'rapport']) }),
      D({ id: 'd-fonct', projet: null, financeur: 'f-commune', annee: Y, intitule: 'Fonctionnement · commune', nature: 'fonctionnement', demande: 2000, accorde: 2000, statut: 'accorde', sansBilan: true,
        depot: j(-280), reponse: j(-230), versements: [V(2000, j(-200), j(-198))], pieces: tout('commune') }),
      D({ id: 'd-av-commune', projet: 'p-fete-av', financeur: 'f-commune', annee: Y - 1, intitule: `Fête de quartier ${Y - 1} · commune`, demande: 4000, accorde: 3500, statut: 'accorde',
        depot: j(-560), reponse: j(-500), versements: [V(3500, j(-480), j(-476))], bilanRendu: j(-170), pieces: tout('commune'), piecesBilan: R.piecesBilanDepart(B).map((p) => ({ ...p, statut: 'joint' })),
        bilan: { realise: 'Fête organisée comme prévu.', public: 'Environ 700 visiteurs.', resultats: 'Objectif de fréquentation atteint.', ecarts: 'Sonorisation plus chère que prévu.', suites: 'Reconduite.' } }),
      D({ id: 'd-av-dep', projet: 'p-fete-av', financeur: 'f-dep', annee: Y - 1, intitule: `Fête de quartier ${Y - 1} · département`, demande: 2500, accorde: 2000, statut: 'accorde',
        depot: j(-540), reponse: j(-470), versements: [V(2000, j(-450), j(-447))], pieces: tout('departement'), piecesBilan: R.piecesBilanDepart(B) }),
      D({ id: 'd-av-fondation', projet: 'p-fete-av', financeur: 'f-fondation', annee: Y - 1, intitule: `Fête de quartier ${Y - 1} · fondation`, demande: 1200, statut: 'abandonne', note: 'Dossier non déposé : critères d\'éligibilité changés.' }),
    ];
    const X = (projet, date, poste, libelle, montant, fournisseur, piece, justificatif, dossier = null) => R.normaliserDepense({ projet, date, poste, libelle, montant, fournisseur, piece, justificatif, dossier }, t);
    e.depenses = [
      X('p-fete', j(-60), P[1], 'Compagnie de théâtre de rue', 2400, 'Compagnie fictive', 'F-0412', true, 'd-fete-commune'),
      X('p-fete', j(-58), P[1], 'Atelier percussions', 950, 'Intervenant', 'F-0413', true, 'd-fete-commune'),
      X('p-fete', j(-57), P[2], 'Location de la scène et du son', 3150, 'Loueur', 'F-0420', true, 'd-fete-commune'),
      X('p-fete', j(-75), P[5], 'Affiches et flyers', 820, 'Imprimerie', 'F-0398', true),
      X('p-fete', j(-55), P[0], 'Fournitures des ateliers', 610, 'Magasin de loisirs créatifs', '', false),
      X('p-fete', j(-90), P[6], 'Assurance de la manifestation', 350, 'Assureur', 'A-2026', true),
      X('p-velo', j(-30), P[3], 'Salaire de l\'animateur (3 mois)', 5250, '', 'Paie', true, 'd-velo-region'),
      X('p-velo', j(-100), P[0], 'Établis et outillage', 3900, 'Fournisseur d\'outillage', 'F-0377', true, 'd-velo-region'),
      X('p-velo', j(-20), P[2], 'Loyer du local (trimestre)', 1200, 'Bailleur', '', false, 'd-velo-region'),
      X('p-fete-av', j(-500), P[1], 'Compagnies', 5600, '', 'F-2231', true, 'd-av-commune'),
      X('p-fete-av', j(-500), P[2], 'Scène et son', 3050, '', 'F-2232', true, 'd-av-commune'),
    ];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Subventions · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="110" height="240" fill="#1D4E89"/>
          <rect x="150" y="120" width="110" height="160" fill="#F5B400"/>
          <rect x="280" y="200" width="110" height="80" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="470" cy="100" r="70" fill="#D9302A"/>
          <path d="M470 100 L470 30 A70 70 0 0 1 540 100 Z" fill="#F0EDE6"/>
          <rect x="20" y="20" width="370" height="8" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Subventions</p>
          <h1>Chaque dossier déposé à temps, chaque euro justifié.</h1>
          <p>Financeurs, pièces à fournir, dates limites, versements et bilans : tous les dossiers de l'association au même endroit, avec les alertes avant l'échéance.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes dossiers</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes dossiers sont enregistrés en ligne et te suivent sur tous tes appareils : partage la clé avec le trésorier ou la présidente.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes dossiers</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes dossiers'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    const Y = Number(auj().slice(0, 4));
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>Tes subventions, dossier par dossier.</h1>
      <p class="intro">Un dossier par financeur sollicité, rattaché à un projet. Tu notes les dates lues dans l'appel à projets, l'application te prévient avant chaque échéance et prépare le bilan avec tes dépenses.</p>
      <form id="form-accueil" novalidate>
        <div class="rang-champs" style="max-width:680px">
          <label class="champ">Nom de l'association<small>Il figure en tête des impressions.</small><input name="structure" maxlength="100" placeholder="Ex. : Les Ateliers du Quartier"></label>
          <label class="champ">Début de l'exercice comptable<small>Sert au calcul du compte rendu financier.</small><select name="debut">${MOIS.map((m, i) => `<option value="${i + 1}" ${i === 0 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        </div>
        <div class="rang-champs" style="max-width:680px">
          <label class="champ">Premier projet à financer<small>Facultatif : tu pourras en ajouter d'autres.</small><input name="projet" maxlength="100" placeholder="Ex. : Fête de quartier ${Y}"></label>
          <label class="champ">Année du projet<input name="annee" type="number" min="2000" max="2100" value="${Y}"></label>
        </div>
        <p class="erreur" role="alert"></p>
      </form>
      <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Commencer</button></div>
    </div>`;
  }

  function terminerAccueil() {
    const f = $('#form-accueil');
    const v = (n) => f.querySelector(`[name=${n}]`).value.trim();
    E = etatVide();
    E.structure = v('structure').slice(0, 100);
    E.reglages.debutExercice = Number(v('debut')) || 1;
    if (v('projet')) E.projets.push(R.normaliserProjet({ nom: v('projet'), annee: v('annee') }, auj()));
    vue = 'dossiers';
    sauver();
    demarrer();
    toast(E.projets.length ? `« ${E.projets[0].nom} » créé : ajoute un premier dossier de subvention.` : 'C\'est prêt : ajoute un premier dossier de subvention.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    dossiers: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    projets: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="5" height="9" fill="currentColor"/><rect x="10" y="6" width="5" height="15" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    financeurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const COURTS = { tableau: 'Accueil', financeurs: 'Financeurs' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['dossiers', 'Dossiers'], ['echeances', 'Échéances'], ['projets', 'Projets'], ['financeurs', 'Financeurs']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Subventions</span>
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

  const ONGLET_DE = { dossier: 'dossiers', projet: 'projets' };
  function rendre() {
    if (!E || !$('#vue')) return;
    if (vue === 'dossier' && !dossier(ouvert.dossier)) vue = 'dossiers';
    if (vue === 'projet' && !projet(ouvert.projet)) vue = 'projets';
    const actif = ONGLET_DE[vue] || vue;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${vue === 'dossier' ? titreDossier(dossier(ouvert.dossier)) : vue === 'projet' ? projet(ouvert.projet).nom : titres[vue]} · Subventions`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, dossiers: vueDossiers, echeances: vueEcheances, projets: vueProjets, financeurs: vueFinanceurs, dossier: vueDossier, projet: vueProjet }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, id = null) {
    if (v === 'dossier') ouvert.dossier = id;
    if (v === 'projet') ouvert.projet = id;
    vue = v;
    history.replaceState(null, '', ONGLETS.some(([o]) => o === v) ? `#${v}` : location.pathname + location.search);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="36" width="28" height="60" fill="#1D4E89"/><rect x="34" y="14" width="28" height="82" fill="#F5B400"/><circle cx="78" cy="68" r="18" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  const CLASSE_STATUT = { preparation: 'jaune', depose: 'ciel', accorde: 'vert', refuse: 'rose', abandonne: 'sable', clos: 'sable' };
  const etiquetteStatut = (d) => { const s = R.etatDossier(d); return `<span class="etiquette ${CLASSE_STATUT[s]}">${R.LIB_STATUT[s]}</span>`; };
  const NIVEAU = { retard: ['rouge', 'En retard'], proche: ['jaune', 'Bientôt'], avenir: ['ciel', 'À venir'] };
  function libelleEcheance(x) {
    const d = dossier(x.dossier);
    switch (x.type) {
      case 'depot': return { titre: 'Date limite de dépôt', detail: x.manquantes ? `${pluriel(x.manquantes, 'pièce')} encore à préparer` : 'Toutes les pièces sont prêtes', action: ['depose', 'Déposé'] };
      case 'reponse': return { titre: x.niveau === 'retard' ? 'Réponse attendue : à relancer' : 'Réponse attendue', detail: `Demandé ${euros(d.demande)}${x.estimee ? ` · relance proposée ${E.reglages.relanceReponse} jours après le dépôt` : ''}`, action: ['reponse', 'Réponse reçue'], second: x.niveau === 'retard' ? ['relance', 'Relancé'] : null };
      case 'versement': return { titre: `Versement attendu : ${euros(x.montant)}`, detail: `Reste à percevoir ${euros(R.resteAPercevoir(d))}`, action: ['recu', 'Reçu'], versement: x.versement };
      case 'bilan': return { titre: 'Bilan à rendre', detail: x.origine === 'regle' ? `Compte rendu financier : 6 mois après la fin de l'exercice ${ex(d.annee)} (date calculée)` : 'Date saisie', action: ['bilan', 'Préparer'] };
      case 'convention': return { titre: 'Convention attendue', detail: `Accord de ${euros(R.accordeDe(d))}, au-delà de ${euros(B.regles.convention.seuil)}`, action: ['convention', 'Convention reçue'] };
      default: return { titre: '', detail: '' };
    }
  }
  function ligneEcheance(x, { compacte = false } = {}) {
    const d = dossier(x.dossier);
    const l = libelleEcheance(x);
    const [cl, lib] = NIVEAU[x.niveau];
    const quand = x.date ? (x.date === auj() ? 'aujourd\'hui' : x.date < auj() ? `depuis le ${dateCourte(x.date)}` : `le ${dateCourte(x.date)}`) : '';
    return `<li class="echeance niv-${x.niveau}">
      <button class="ech-corps" data-action="dossier" data-id="${d.id}">
        <span class="ech-tete"><span class="etiquette ${cl}">${lib}</span><b>${esc(l.titre)}</b>${quand ? `<span class="ech-date">${quand}</span>` : ''}</span>
        <span class="ech-dossier">${pastilleType(financeur(d.financeur)?.type)}${esc(titreDossier(d))}${compacte ? '' : ` · ${esc(nomFinanceur(d.financeur))}`}</span>
        <span class="ech-detail">${esc(l.detail)}</span>
      </button>
      <span class="ech-actions">${l.second ? `<button class="btn petit" data-action="ech-${l.second[0]}" data-id="${d.id}">${l.second[1]}</button>` : ''}<button class="btn petit ${x.niveau === 'retard' ? 'primaire' : ''}" data-action="ech-${l.action[0]}" data-id="${d.id}" ${l.versement ? `data-versement="${l.versement}"` : ''}>${l.action[1]}</button></span>
    </li>`;
  }
  const barre = (v, max, couleur = 'var(--bleu)') => `<span class="jauge" aria-hidden="true"><span style="width:${max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0}%;background:${couleur}"></span></span>`;

  function ligneDossier(d) {
    const f = financeur(d.financeur);
    const a = R.avancementPieces(d.pieces);
    const acc = d.statut === 'accorde';
    const montants = acc ? `${euros(R.accordeDe(d))} accordés${d.accorde !== null && d.accorde < d.demande ? ` sur ${euros(d.demande)}` : ''} · ${R.resteAPercevoir(d) ? `${euros(R.resteAPercevoir(d))} à percevoir` : 'tout versé'}` : `${euros(d.demande)} demandés`;
    const date = d.statut === 'preparation' && d.limiteDepot ? `Dépôt avant le ${dateCourte(d.limiteDepot)}` : d.statut === 'depose' && d.depot ? `Déposé le ${dateCourte(d.depot)}` : '';
    return `<li class="ligne-dossier">
      <button class="ld-corps" data-action="dossier" data-id="${d.id}">
        <span class="ld-titre"><b>${esc(titreDossier(d))}</b>${etiquetteStatut(d)}</span>
        <span class="ld-ou">${pastilleType(f?.type)}${esc(nomFinanceur(d.financeur))} · ${esc(nomProjet(d.projet))} · ${ex(d.annee)}</span>
        <span class="ld-montants">${montants}${date ? ` · ${date}` : ''}${d.statut === 'preparation' && a.total ? ` · pièces ${a.pretes}/${a.total}` : ''}</span>
      </button>
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const s = R.syntheseAnnee(E, B, anneeVue);
    const ech = R.echeances(E, B, t);
    const urgentes = ech.filter((x) => x.niveau !== 'avenir');
    const seuil = R.seuilComptesAnnuels(E, B, R.exercice(t, E.reglages.debutExercice));
    const annees = R.annees(E, t);
    const tuiles = [
      ['Demandé', euros(s.demande), `${pluriel(s.nb, 'dossier')} en ${ex(anneeVue)}`, 'var(--jaune)', ''],
      ['Accordé', euros(s.accorde), s.tauxAcceptation === null ? 'aucune réponse encore' : `${pct(s.tauxAcceptation)} des réponses positives`, 'var(--vert)', 'rond'],
      ['Versé', euros(s.verse), s.accorde ? `${pct((s.verse / s.accorde) * 100)} de l'accordé` : 'rien d\'accordé', 'var(--bleu)', ''],
      ['Reste à percevoir', euros(s.reste), s.enAttente ? `et ${euros(s.enAttente)} en attente de réponse` : 'sur les dossiers accordés', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');
    const vide = !E.dossiers.length;
    const maxType = Math.max(1, ...s.parType.map((x) => Math.max(x.demande, x.accorde)));
    return `
      <div class="vue-tete"><div><h1>${esc(E.structure || 'Subventions')}</h1><p>Ce qui a été demandé, accordé et versé, et les prochaines échéances. Les dates viennent de tes dossiers.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-dossier">${ICONES.plus}Dossier</button>${E.dossiers.length ? '<button class="btn" data-action="imprimer-annee">Imprimer le bilan annuel</button>' : ''}</div></div>
      <div class="choix-annee" role="group" aria-label="Année">${annees.map((a) => `<button class="filtre" data-action="annee" data-annee="${a}" aria-pressed="${a === anneeVue}">${ex(a)}</button>`).join('')}</div>
      <div class="tuiles">${tuiles}</div>
      ${vide ? `<div class="vide-etat" style="margin-top:20px">${FORME_VIDE}<div><h3>Aucun dossier pour l'instant</h3><p>Crée un dossier par financeur sollicité : commune, département, région, État, fondation ou mécène. Note la date limite lue dans l'appel à projets.</p><div class="actions"><button class="btn primaire" data-action="nouveau-dossier">${ICONES.plus}Premier dossier</button></div></div></div>` : `
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À traiter <span>${urgentes.length ? `${pluriel(urgentes.length, 'échéance')} en retard ou dans les ${E.reglages.alerte} jours` : ''}</span></h2>
          ${urgentes.length ? `<ul class="liste-echeances">${urgentes.slice(0, 5).map((x) => ligneEcheance(x, { compacte: true })).join('')}</ul>${urgentes.length > 5 ? `<button class="btn lien" data-action="vue" data-vue="echeances">Voir les ${urgentes.length} échéances</button>` : ''}` : `<div class="vide-etat petit"><div><h3>Rien d'urgent</h3><p>Aucune échéance en retard ni dans les ${E.reglages.alerte} prochains jours.${ech.length ? ` Prochaine : ${esc(libelleEcheance(ech[0]).titre.toLowerCase())}${ech[0].date ? ` le ${dateCourte(ech[0].date)}` : ''}.` : ''}</p></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Par type de financeur <span>${ex(anneeVue)}</span></h2>
          ${s.parType.length ? `<div class="graphique"><ul class="barres-types">${s.parType.map((x) => `<li><span class="bt-nom">${pastilleType(x.type)}${esc(x.nom)}</span><span class="bt-barres">${barre(x.demande, maxType, 'var(--beurre-fort)')}${barre(x.accorde, maxType, couleurType(x.type))}</span><span class="bt-val nb">${euros(x.accorde)} <small>/ ${euros(x.demande)}</small></span></li>`).join('')}</ul>
            <p class="legende"><span><i style="background:var(--beurre-fort)"></i>Demandé</span><span><i class="multi"></i>Accordé</span></p>
            <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Type</th><th class="nb">Dossiers</th><th class="nb">Demandé</th><th class="nb">Accordé</th><th class="nb">Versé</th></tr></thead><tbody>${s.parType.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.nb}</td><td class="nb">${euros(x.demande)}</td><td class="nb">${euros(x.accorde)}</td><td class="nb">${euros(x.verse)}</td></tr>`).join('')}</tbody></table></div></details></div>` : `<div class="vide-etat petit"><div><h3>Aucun dossier en ${ex(anneeVue)}</h3><p>Choisis une autre année ou crée un dossier.</p></div></div>`}
          <ul class="compteurs">${[['preparation', 'en préparation'], ['depose', 'déposés'], ['accorde', 'accordés'], ['clos', 'clos'], ['refuse', 'refusés']].map(([k, l]) => `<li><b>${s.parStatut[k]}</b><span>${l}</span></li>`).join('')}</ul>
        </section>
      </div>
      ${E.reglages.rappels && (seuil.depasse || seuil.proche) ? `<div class="alerte-doc"><div><b>Subventions publiques reçues sur l'exercice ${ex(R.exercice(t, E.reglages.debutExercice))} : ${euros(seuil.total)}</b><span>${seuil.depasse ? 'Au-delà' : 'Proche'} du seuil de ${euros(seuil.seuil)} : ${esc(B.regles.comptesAnnuels.texte)} Source : ${esc(sourceCourte('F3180'))}. Total indicatif (versements saisis), à vérifier avec ton expert-comptable.</span></div></div>` : ''}
      ${E.reglages.rappels ? `<p class="mention avertissement">Subventions publiques reçues sur l'exercice en cours : ${euros(seuil.total)} (seuil des comptes annuels : ${euros(seuil.seuil)}). Rappels réglementaires indicatifs, repris de ${esc(sourceCourte('F3180'))} ; ils ne remplacent ni la convention du financeur ni un conseil. Aucun calendrier de financeur n'est intégré : les dates sont celles que tu saisis.</p>` : '<p class="mention avertissement">Aucun calendrier de financeur n\'est intégré : les dates sont celles que tu saisis.</p>'}`}`;
  }

  // ---------- Dossiers ----------
  const STATUTS_FILTRE = [['ouverts', 'En cours'], ['preparation', 'En préparation'], ['depose', 'Déposés'], ['accorde', 'Accordés'], ['clos', 'Clos'], ['refuse', 'Refusés'], ['abandonne', 'Abandonnés'], ['tous', 'Tous']];
  const garderStatut = (d, st = filtre.statut) => { const s = R.etatDossier(d); return st === 'tous' || (st === 'ouverts' ? ['preparation', 'depose', 'accorde'].includes(s) : s === st); };
  function vueDossiers() {
    const q = filtre.q.trim();
    const tete = `<div class="vue-tete"><div><h1>Dossiers</h1><p>Un dossier par financeur et par projet : montants, dates, pièces et versements. Touche un dossier pour l'ouvrir.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau-dossier">${ICONES.plus}Dossier</button>${E.dossiers.length ? '<button class="btn" data-action="csv">Exporter en CSV</button>' : ''}</div></div>`;
    if (!E.dossiers.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun dossier</h3><p>Choisis le financeur, le projet et le montant demandé : la liste des pièces habituelles est proposée, à ajuster selon le règlement du financeur.</p><div class="actions"><button class="btn primaire" data-action="nouveau-dossier">${ICONES.plus}Premier dossier</button></div></div></div>`;
    const deAnnee = (d) => filtre.annee === 'toutes' || d.annee === Number(filtre.annee);
    const deProjet = (d) => !filtre.projet || (filtre.projet === 'aucun' ? !d.projet : d.projet === filtre.projet);
    const base = R.rechercher(E, E.dossiers, q).filter(deAnnee).filter(deProjet);
    const liste = R.trierDossiers(base.filter((d) => garderStatut(d)));
    const total = { demande: R.somme(liste.filter((d) => d.statut !== 'abandonne'), (d) => d.demande), accorde: R.somme(liste, R.accordeDe), reste: R.somme(liste, R.resteAPercevoir) };
    return `${tete}
      <form class="cherche-doc" onsubmit="return false" role="search"><label class="champ"><span class="sr-only">Rechercher un dossier</span><input id="recherche" type="search" placeholder="Rechercher : financeur, projet, dispositif…" value="${esc(filtre.q)}" autocomplete="off"></label></form>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${STATUTS_FILTRE.map(([id, lib]) => `<button class="filtre" data-action="filtre-statut" data-statut="${id}" aria-pressed="${filtre.statut === id}">${esc(lib)} <small>${base.filter((d) => garderStatut(d, id)).length}</small></button>`).join('')}</div>
        <div class="selecteurs">
          <label class="champ champ-filtre"><span class="sr-only">Année</span><select data-action="filtre-annee"><option value="toutes">Toutes les années</option>${R.annees(E, auj()).map((a) => `<option value="${a}" ${String(a) === String(filtre.annee) ? 'selected' : ''}>${ex(a)}</option>`).join('')}</select></label>
          <label class="champ champ-filtre"><span class="sr-only">Projet</span><select data-action="filtre-projet"><option value="">Tous les projets</option>${E.projets.map((p) => `<option value="${p.id}" ${filtre.projet === p.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}<option value="aucun" ${filtre.projet === 'aucun' ? 'selected' : ''}>Sans projet</option></select></label>
        </div>
      </div>
      ${liste.length ? `<p class="aide resume-liste">${pluriel(liste.length, 'dossier')} · demandé ${euros(total.demande)} · accordé ${euros(total.accorde)} · reste à percevoir ${euros(total.reste)}</p><ul class="liste-dossiers">${liste.map(ligneDossier).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucun dossier ne correspond</h3><p>Change de filtre${q ? ' ou de mot (les accents ne comptent pas)' : ''}.</p></div></div>`}`;
  }

  // ---------- Fiche d'un dossier ----------
  const ETAPES = (d) => {
    const lb = R.limiteBilan(E, B, d);
    return [
      ['Date limite de dépôt', d.limiteDepot, d.statut === 'preparation' ? 'limite' : ''],
      ['Déposé le', d.depot, ''],
      ['Réponse attendue', d.reponseAttendue, d.statut === 'depose' ? 'limite' : ''],
      [d.statut === 'refuse' ? 'Refusé le' : 'Réponse le', d.reponse, ''],
      [d.sansBilan ? 'Aucun bilan demandé' : `Bilan à rendre${lb.origine === 'regle' ? ' (calculé)' : ''}`, d.sansBilan ? null : lb.date, d.statut === 'accorde' && !d.bilanRendu ? 'limite' : ''],
      ['Bilan rendu le', d.bilanRendu, ''],
    ];
  };
  function vueDossier() {
    const d = dossier(ouvert.dossier);
    const f = financeur(d.financeur);
    const p = projet(d.projet);
    const t = auj();
    const acc = d.statut === 'accorde';
    const a = R.avancementPieces(d.pieces);
    const ech = R.echeances(E, B, t).filter((x) => x.dossier === d.id);
    const pub = public_(d);
    const boutons = {
      preparation: `<button class="btn primaire" data-action="ech-depose" data-id="${d.id}">Noter le dépôt</button>`,
      depose: `<button class="btn primaire" data-action="ech-reponse" data-id="${d.id}">Réponse reçue</button><button class="btn" data-action="ech-relance" data-id="${d.id}">Relancé</button>`,
      accorde: d.bilanRendu ? '' : (d.sansBilan ? '' : `<button class="btn primaire" data-action="bilan-rendu" data-id="${d.id}">Bilan rendu</button>`),
    }[d.statut] || '';
    const tuiles = [
      ['Demandé', euros(d.demande), d.dispositif || B.natures.find((n) => n.id === d.nature)?.nom, 'var(--jaune)', ''],
      ['Accordé', acc ? euros(R.accordeDe(d)) : '–', acc ? (d.demande ? `${pct((R.accordeDe(d) / d.demande) * 100)} de la demande` : '') : R.LIB_STATUT[d.statut], 'var(--vert)', 'rond'],
      ['Versé', euros(R.verse(d)), `${pluriel((d.versements || []).filter((v) => v.recuLe).length, 'versement reçu', 'versements reçus')}`, 'var(--bleu)', ''],
      ['Reste à percevoir', acc ? euros(R.resteAPercevoir(d)) : '–', acc && R.versementsPrevus(d) < R.accordeDe(d) ? `${euros(R.accordeDe(d) - R.versementsPrevus(d))} sans échéance saisie` : acc ? 'échéancier complet' : '', 'var(--rouge)', 'rond'],
    ].map(([lib, v, de, c, fo]) => `<div class="tuile ${fo}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(de || '')}</span></div>`).join('');
    return `
      <button class="btn lien retour" data-action="vue" data-vue="dossiers">← Tous les dossiers</button>
      <div class="vue-tete"><div><p class="surtitre">${pastilleType(f?.type)}${esc(nomFinanceur(d.financeur))}${f && !R.sansAccents(f.nom).startsWith(R.sansAccents(typeF(f.type).nom.split(' ')[0])) ? ` · ${esc(typeF(f.type).nom)}` : ''}</p><h1>${esc(titreDossier(d))}</h1><p>${etiquetteStatut(d)} ${p ? `<button class="lien-inline" data-action="projet" data-id="${p.id}">${esc(p.nom)}</button>` : 'Sans projet (fonctionnement)'} · ${ex(d.annee)}</p></div>
        <div class="actions">${boutons}<button class="btn" data-action="modifier-dossier" data-id="${d.id}">Modifier</button><button class="btn" data-action="imprimer-dossier" data-id="${d.id}">Imprimer</button></div></div>
      ${ech.length ? `<ul class="liste-echeances">${ech.map((x) => ligneEcheance(x, { compacte: true })).join('')}</ul>` : ''}
      <div class="tuiles" style="margin-top:16px">${tuiles}</div>
      <div class="colonnes-dossier">
        <section>
          <h2 class="titre-section">Dates</h2>
          <ul class="etapes-dossier">${ETAPES(d).map(([lib, date, cl]) => `<li class="${date ? 'fait' : ''} ${cl && date && date < t ? 'retard' : ''}"><span>${esc(lib)}</span><b>${date ? dateCourte(date) : '–'}</b></li>`).join('')}</ul>
          <h2 class="titre-section">Versements <span>${acc ? `${euros(R.verse(d))} reçus sur ${euros(R.accordeDe(d))}` : 'après l\'accord'}</span></h2>
          ${acc ? `${barre(R.verse(d), R.accordeDe(d), 'var(--bleu)')}
            ${(d.versements || []).length ? `<ul class="liste-versements">${[...d.versements].sort((x, y) => String(x.prevuLe || x.recuLe).localeCompare(String(y.prevuLe || y.recuLe))).map((v, i) => `<li><span><b class="nb">${euros(v.montant, { centimes: true })}</b><small>${v.recuLe ? `reçu le ${dateCourte(v.recuLe)}` : v.prevuLe ? `attendu le ${dateCourte(v.prevuLe)}${v.prevuLe < t ? ' · en retard' : ''}` : 'date à préciser'}</small></span><span class="rang">${v.recuLe ? '<span class="etiquette vert">Reçu</span>' : `<button class="btn petit primaire" data-action="ech-recu" data-id="${d.id}" data-versement="${v.id}">Reçu</button>`}<button class="btn petit" data-action="versement" data-id="${d.id}" data-versement="${v.id}" aria-label="Modifier le versement ${i + 1}">Modifier</button></span></li>`).join('')}</ul>` : '<p class="aide">Aucun versement saisi : note l\'échéancier annoncé dans la notification ou la convention (avance, solde).</p>'}
            <div class="rang"><button class="btn petit" data-action="versement" data-id="${d.id}">${ICONES.plus}Versement</button></div>` : '<p class="aide">Les versements se notent une fois la subvention accordée.</p>'}
        </section>
        <section>
          <h2 class="titre-section">Pièces du dossier <span>${a.total ? `${a.pretes}/${a.total} prêtes` : ''}</span></h2>
          ${listePieces(d, 'pieces')}
          <div class="rang"><button class="btn petit" data-action="ajouter-piece" data-id="${d.id}" data-liste="pieces">${ICONES.plus}Pièce</button></div>
          <p class="mention">Pièces souvent demandées, à ajuster selon le règlement ou l'appel à projets du financeur. Touche une pièce pour changer son état.</p>
        </section>
      </div>
      ${pub && E.reglages.rappels ? blocRappels(d) : ''}
      ${acc || d.bilanRendu ? blocBilan(d) : ''}
      ${d.note ? `<h2 class="titre-section">Note</h2><p class="note-dossier">${esc(d.note)}</p>` : ''}`;
  }

  const CYCLE = { afaire: 'pret', pret: 'joint', joint: 'sansobjet', sansobjet: 'afaire' };
  const CLASSE_PIECE = { afaire: 'rose', pret: 'jaune', joint: 'vert', sansobjet: 'sable' };
  function listePieces(d, liste) {
    const l = d[liste] || [];
    if (!l.length) return '<p class="aide">Aucune pièce pour l\'instant.</p>';
    return `<ul class="liste-pieces">${l.map((p) => `<li class="piece st-${p.statut}"><button class="piece-corps" data-action="cycle-piece" data-id="${d.id}" data-liste="${liste}" data-piece="${p.id}" aria-label="${esc(p.nom)} : ${R.LIB_PIECE[p.statut]}. Changer l'état"><i class="coche" aria-hidden="true"></i><span>${esc(p.nom)}</span></button><span class="etiquette ${CLASSE_PIECE[p.statut]}">${R.LIB_PIECE[p.statut]}</span><button class="btn-icone petit" data-action="retirer-piece" data-id="${d.id}" data-liste="${liste}" data-piece="${p.id}" aria-label="Retirer : ${esc(p.nom)}">×</button></li>`).join('')}</ul>`;
  }

  function blocRappels(d) {
    const r = B.regles;
    const lb = R.limiteBilan(E, B, d);
    const items = [];
    if (d.nature !== 'fonctionnement') items.push(`<li><b>Compte rendu financier</b><span>${esc(r.compteRendu.texte)}${lb.origine === 'regle' ? ` Pour ce dossier (exercice ${ex(d.annee)}) : avant le ${dateLongue(lb.date)}, sauf date différente fixée par le financeur (à saisir dans « Modifier »).` : ''}</span><small>Source : ${esc(sourceCourte('R46623'))}.</small></li>`);
    const m = d.statut === 'accorde' ? R.accordeDe(d) : d.demande;
    if (m > r.convention.seuil) items.push(`<li><b>Convention${d.convention ? ' reçue' : ''}</b><span>${esc(r.convention.texte)}</span><small>Source : ${esc(sourceCourte('F3180'))}.</small></li>`);
    if (!items.length) return '';
    return `<section class="rappels"><h2 class="titre-section">Rappels réglementaires <span>financeur public</span></h2><ul>${items.join('')}</ul><p class="mention">Indicatif, pas un conseil juridique : la convention ou l'arrêté d'attribution du financeur prévaut. Désactivable dans les Réglages.</p></section>`;
  }

  function blocBilan(d) {
    const b = R.bilanDossier(E, d);
    const a = R.avancementPieces(d.piecesBilan);
    const bud = b.budget;
    return `<section class="bloc-bilan" id="bilan">
      <div class="vue-tete petite"><div><h2>Bilan d'utilisation</h2><p>${d.bilanRendu ? `Rendu le ${dateLongue(d.bilanRendu)}.` : 'La trame à remplir au fil du projet ; les chiffres viennent du budget et des dépenses.'}</p></div>
        <div class="actions"><button class="btn" data-action="imprimer-bilan" data-id="${d.id}">Imprimer le bilan</button></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">À justifier</p><b>${euros(b.aJustifier)}</b><span>${b.part === null ? 'rattache un projet pour la part du financeur' : `${pct(b.part)} du budget prévu`}</span></div>
        <div class="tuile rond" style="--c:var(--vert)"><p class="surtitre">${b.imputees ? 'Justifié' : 'Estimation'}</p><b>${euros(b.imputees ? b.justifie : b.estimation)}</b><span>${b.imputees ? `${pluriel(b.imputees, 'dépense imputée', 'dépenses imputées')}${b.sansJustificatif ? `, ${b.sansJustificatif} sans justificatif` : ''}` : 'dépenses du projet × part du financeur'}</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Réalisé du projet</p><b>${bud ? euros(bud.realise) : '–'}</b><span>${bud ? `${pct(bud.tauxRealisation)} du budget prévu (${euros(bud.charges)})` : 'sans projet rattaché'}</span></div>
      </div>
      ${bud && bud.postes.length ? `<div class="defile" style="margin-top:14px"><table class="tableau"><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Réalisé</th><th class="nb">Écart</th></tr></thead><tbody>${bud.postes.map((x) => `<tr><td>${esc(x.poste || 'Sans poste')}</td><td class="nb">${euros(x.prevu)}</td><td class="nb">${euros(x.reel)}</td><td class="nb ${x.ecartPct !== null && Math.abs(x.ecartPct) > 20 ? 'fort' : ''}">${x.ecart > 0 ? '+' : ''}${euros(x.ecart)}${x.ecartPct === null ? '' : ` (${x.ecart > 0 ? '+' : ''}${pct(x.ecartPct)})`}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${euros(bud.charges)}</td><td class="nb">${euros(bud.realise)}</td><td class="nb">${euros(bud.realise - bud.charges)}</td></tr></tfoot></table></div><p class="aide">Écarts de plus de 20 % en gras : à expliquer dans la rubrique « Écarts ».</p>` : ''}
      <form id="form-bilan" class="trame" onsubmit="return false">
        ${B.trameBilan.map((r) => `<label class="champ">${esc(r.titre)}<small>${esc(r.aide)}</small><textarea name="${r.id}" rows="3" maxlength="2000">${esc(d.bilan[r.id])}</textarea></label>`).join('')}
        <div class="rang"><button class="btn petit primaire" data-action="enregistrer-bilan" data-id="${d.id}">Enregistrer la trame</button></div>
      </form>
      <h3 class="titre-section">Pièces du bilan <span>${a.total ? `${a.pretes}/${a.total} prêtes` : ''}</span></h3>
      ${listePieces(d, 'piecesBilan')}
      <div class="rang"><button class="btn petit" data-action="ajouter-piece" data-id="${d.id}" data-liste="piecesBilan">${ICONES.plus}Pièce</button>${!d.piecesBilan.length ? `<button class="btn petit" data-action="pieces-bilan-types" data-id="${d.id}">Pièces types du bilan</button>` : ''}</div>
      ${public_(d) ? `<p class="mention">Financeur public : le compte rendu financier se fait sur le formulaire Cerfa n° 15059*02 ou celui du financeur. Cette trame aide à le remplir, elle ne le remplace pas. Source : ${esc(sourceCourte('R46623'))}.</p>` : ''}
    </section>`;
  }

  // ---------- Échéances ----------
  function vueEcheances() {
    const ech = R.echeances(E, B, auj());
    const groupes = [['retard', 'En retard'], ['proche', `Dans les ${E.reglages.alerte} jours`], ['avenir', 'Plus tard']];
    return `
      <div class="vue-tete"><div><h1>Échéances</h1><p>Dépôts, réponses, versements, bilans et conventions, d'après les dates de tes dossiers. Aucun calendrier de financeur n'est intégré : une date manque, ajoute-la dans le dossier.</p></div></div>
      ${ech.length ? groupes.map(([n, lib]) => { const l = ech.filter((x) => x.niveau === n); return l.length ? `<h2 class="titre-section">${lib} <span>${pluriel(l.length, 'échéance')}</span></h2><ul class="liste-echeances">${l.map((x) => ligneEcheance(x)).join('')}</ul>` : ''; }).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune échéance</h3><p>Note la date limite de dépôt de tes dossiers en préparation, la date de réponse annoncée, l'échéancier des versements et la date du bilan.</p></div></div>`}
      <p class="mention avertissement">Alerte ${E.reglages.alerte} jours avant une date (45 jours pour un bilan) ; relance proposée ${E.reglages.relanceReponse} jours après un dépôt sans date de réponse : réglable dans les Réglages.${E.reglages.rappels ? ` Date du bilan calculée pour les financeurs publics quand tu n'en saisis pas : 6 mois après la fin de l'exercice (${esc(sourceCourte('R46623'))}).` : ''}</p>`;
  }

  // ---------- Projets ----------
  function vueProjets() {
    const tete = `<div class="vue-tete"><div><h1>Projets</h1><p>Le budget prévisionnel de chaque projet, la part de chaque financeur et les dépenses réalisées, justificatif par justificatif.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau-projet">${ICONES.plus}Projet</button>${E.depenses.length ? '<button class="btn" data-action="csv-depenses">Dépenses en CSV</button>' : ''}</div></div>`;
    if (!E.projets.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun projet</h3><p>Un projet, c'est une action à financer : un festival, un atelier, un séjour, un achat de matériel. Ses dépenses prévues forment le budget que tu joins aux demandes.</p><div class="actions"><button class="btn primaire" data-action="nouveau-projet">${ICONES.plus}Premier projet</button></div></div></div>`;
    const liste = [...E.projets].sort((a, b) => Number(a.archive) - Number(b.archive) || b.annee - a.annee || a.nom.localeCompare(b.nom, 'fr'));
    return `${tete}<div class="cartes-projets">${liste.map((p) => {
      const b = R.budgetProjet(E, p.id);
      return `<section class="carte-projet ${p.archive ? 'archive' : ''}">
        <button class="cp-corps" data-action="projet" data-id="${p.id}"><span class="surtitre">${ex(p.annee)}${p.archive ? ' · archivé' : ''}</span><b>${esc(p.nom)}</b><span>Budget ${euros(b.charges)} · ${pluriel(b.subventions.length, 'financeur')} · subventions ${pct(b.partSubventions)}</span></button>
        ${financement(b, { petit: true })}
        <p class="cp-pied"><span>Réalisé ${euros(b.realise)} (${pct(b.tauxRealisation)})</span>${b.sansJustificatif ? `<span class="etiquette rose">${pluriel(b.sansJustificatif, 'justificatif')} à ranger</span>` : ''}${b.equilibre < 0 ? `<span class="etiquette jaune">Manque ${euros(-b.equilibre)}</span>` : ''}</p>
      </section>`;
    }).join('')}</div>`;
  }

  // Barre empilée : part de chaque financeur (accordé plein, demandé hachuré) et des autres ressources, sur le budget.
  function financement(b, { petit = false } = {}) {
    const total = Math.max(b.charges, b.ressources, 1);
    const seg = [
      ...b.subventions.map((s) => ({ nom: nomFinanceur(s.financeur), m: s.montant, c: couleurType(financeur(s.financeur)?.type), acquis: s.acquis })),
      ...(b.autres ? [{ nom: 'Autres ressources', m: b.autres, c: '#B8B0A2', acquis: true }] : []),
    ].filter((s) => s.m > 0);
    return `<div class="financement ${petit ? 'petit' : ''}">
      <div class="fin-barre" role="img" aria-label="Financement : ${seg.map((s) => `${s.nom} ${euros(s.m)}${s.acquis ? '' : ' demandés'}`).join(', ')} pour un budget de ${euros(b.charges)}">${seg.map((s) => `<span class="${s.acquis ? '' : 'attendu'}" style="width:${(s.m / total) * 100}%;--c:${s.c}" title="${esc(s.nom)} : ${euros(s.m)}${s.acquis ? '' : ' (demandé)'}"></span>`).join('')}${b.equilibre < 0 ? `<span class="manque" style="width:${(-b.equilibre / total) * 100}%" title="Non financé : ${euros(-b.equilibre)}"></span>` : ''}</div>
      ${petit ? '' : `<ul class="legende-fin">${seg.map((s) => `<li><i style="--c:${s.c}" class="${s.acquis ? '' : 'attendu'}"></i>${esc(s.nom)} <b class="nb">${euros(s.m)}</b>${b.charges ? ` <small>${pct((s.m / b.charges) * 100)}</small>` : ''}${s.acquis ? '' : ' <small>(demandé)</small>'}</li>`).join('')}${b.equilibre < 0 ? `<li><i class="manque"></i>Non financé <b class="nb">${euros(-b.equilibre)}</b></li>` : ''}</ul>`}
    </div>`;
  }

  function vueProjet() {
    const p = projet(ouvert.projet);
    const b = R.budgetProjet(E, p.id);
    const deps = E.depenses.filter((x) => x.projet === p.id).sort((x, y) => y.date.localeCompare(x.date));
    const dossiers = R.trierDossiers(E.dossiers.filter((d) => d.projet === p.id));
    return `
      <button class="btn lien retour" data-action="vue" data-vue="projets">← Tous les projets</button>
      <div class="vue-tete"><div><p class="surtitre">${ex(p.annee)}${p.archive ? ' · archivé' : ''}</p><h1>${esc(p.nom)}</h1>${p.description ? `<p>${esc(p.description)}</p>` : ''}</div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-depense" data-projet="${p.id}">${ICONES.plus}Dépense</button><button class="btn" data-action="modifier-projet" data-id="${p.id}">Budget et projet</button><button class="btn" data-action="imprimer-budget" data-id="${p.id}">Imprimer le budget</button></div></div>
      <div class="tuiles">
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Budget prévu</p><b>${euros(b.charges)}</b><span>${pluriel(p.charges.length, 'ligne')} de charges</span></div>
        <div class="tuile rond" style="--c:var(--vert)"><p class="surtitre">Subventions</p><b>${euros(b.totalSub)}</b><span>dont ${euros(b.acquises)} accordés · ${pct(b.partSubventions)} du budget</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Réalisé</p><b>${euros(b.realise)}</b><span>${pct(b.tauxRealisation)} du budget · ${pluriel(b.nbDepenses, 'dépense')}</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">${b.equilibre < 0 ? 'Non financé' : 'Équilibre'}</p><b>${euros(Math.abs(b.equilibre))}</b><span>${b.equilibre < 0 ? 'ressources inférieures au budget' : b.equilibre > 0 ? 'ressources supérieures au budget' : 'budget équilibré'}</span></div>
      </div>
      <h2 class="titre-section">Financement <span>part de chaque financeur dans le budget</span></h2>
      <div class="graphique">${b.charges ? financement(b) : '<p class="aide">Saisis les charges prévues (« Budget et projet ») pour voir la part de chaque financeur.</p>'}</div>
      <div class="colonnes-dossier">
        <section>
          <h2 class="titre-section">Dossiers <span>${pluriel(dossiers.length, 'dossier')}</span></h2>
          ${dossiers.length ? `<ul class="liste-dossiers une-colonne">${dossiers.map(ligneDossier).join('')}</ul>` : '<p class="aide">Aucun dossier pour ce projet.</p>'}
          <div class="rang"><button class="btn petit" data-action="nouveau-dossier" data-projet="${p.id}">${ICONES.plus}Dossier pour ce projet</button></div>
        </section>
        <section>
          <h2 class="titre-section">Prévu et réalisé <span>par poste</span></h2>
          ${b.postes.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Réalisé</th></tr></thead><tbody>${b.postes.map((x) => `<tr><td>${esc(x.poste || 'Sans poste')}</td><td class="nb">${euros(x.prevu)}</td><td class="nb ${x.ecartPct !== null && x.ecartPct > 20 ? 'fort' : ''}">${euros(x.reel)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="aide">Aucun poste.</p>'}
        </section>
      </div>
      <h2 class="titre-section">Dépenses justificatives <span>${deps.length ? `${euros(b.realise)}${b.sansJustificatif ? ` · ${b.sansJustificatif} sans justificatif` : ''}` : ''}</span></h2>
      ${deps.length ? `<div class="defile"><table class="tableau depenses"><thead><tr><th>Date</th><th>Dépense</th><th>Poste</th><th>Imputée à</th><th class="nb">Montant</th><th>Justificatif</th></tr></thead><tbody>${deps.map((x) => `<tr><td class="nb">${dateCourte(x.date)}</td><td><button class="lien-inline" data-action="depense" data-id="${x.id}">${esc(x.libelle)}</button>${x.fournisseur ? `<small>${esc(x.fournisseur)}</small>` : ''}</td><td>${esc(x.poste)}</td><td>${x.dossier ? esc(nomFinanceur(dossier(x.dossier)?.financeur)) : '<small>Projet</small>'}</td><td class="nb">${euros(x.montant, { centimes: true })}</td><td>${x.justificatif ? `<span class="etiquette vert">${esc(x.piece || 'Rangé')}</span>` : `<button class="btn petit" data-action="justifier" data-id="${x.id}">Rangé</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vide-etat petit"><div><h3>Aucune dépense</h3><p>Note chaque facture payée pour le projet et coche « justificatif rangé » : le bilan se remplit avec.</p></div></div>'}`;
  }

  // ---------- Financeurs ----------
  function vueFinanceurs() {
    const tete = `<div class="vue-tete"><div><h1>Financeurs</h1><p>Communes, département, région, État, fondations, mécènes : l'historique de ce que chacun a reçu comme demandes et accordé.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau-financeur">${ICONES.plus}Financeur</button></div></div>`;
    if (!E.financeurs.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun financeur</h3><p>Ajoute les financeurs que tu sollicites. Le type (public ou privé) sert à proposer les pièces habituelles et les rappels réglementaires.</p><div class="actions"><button class="btn primaire" data-action="nouveau-financeur">${ICONES.plus}Premier financeur</button></div></div></div>`;
    const ordre = B.typesFinanceur.map((t) => t.id);
    const liste = [...E.financeurs].sort((a, b) => ordre.indexOf(a.type) - ordre.indexOf(b.type) || a.nom.localeCompare(b.nom, 'fr'));
    return `${tete}<div class="cartes-financeurs">${liste.map((f) => {
      const ds = E.dossiers.filter((d) => d.financeur === f.id);
      const acc = ds.filter((d) => d.statut === 'accorde');
      return `<section class="carte-financeur" style="--p:${couleurType(f.type)}">
        <div class="cf-tete"><div><p class="cf-type">${pastilleType(f.type)}${esc(typeF(f.type).nom)} · ${typeF(f.type).public ? 'public' : 'privé'}</p><h3>${esc(f.nom)}</h3>${f.contact ? `<p>${esc(f.contact)}</p>` : ''}</div><button class="btn petit" data-action="financeur" data-id="${f.id}">Modifier</button></div>
        <p class="cf-chiffres"><span><b>${ds.length}</b> dossier${ds.length > 1 ? 's' : ''}</span><span><b>${euros(R.somme(ds.filter((d) => d.statut !== 'abandonne'), (d) => d.demande))}</b> demandés</span><span><b>${euros(R.somme(acc, R.accordeDe))}</b> accordés</span></p>
        ${ds.length ? `<ul class="liste-docs compacte">${R.trierDossiers(ds).slice(0, 4).map((d) => `<li><button class="lien-ligne" data-action="dossier" data-id="${d.id}"><b>${esc(titreDossier(d))}</b><span>${ex(d.annee)} · ${R.LIB_STATUT[R.etatDossier(d)]}</span></button></li>`).join('')}</ul>` : ''}
        ${f.note ? `<p class="aide">${esc(f.note)}</p>` : ''}
        <div class="rang"><button class="btn petit" data-action="nouveau-dossier" data-financeur="${f.id}">${ICONES.plus}Dossier</button></div>
      </section>`;
    }).join('')}</div>
      <p class="mention avertissement">Note ici le service ou la fonction à contacter, pas de coordonnées personnelles. Les dates et règles de chaque financeur (appels à projets, commissions) ne sont pas intégrées : elles changent chaque année.</p>`;
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
  const PIED = (ok = 'Enregistrer', extra = '') => `<button class="btn primaire" value="ok">${ok}</button><button class="btn" value="annuler">Annuler</button>${extra}`;
  const nombreOuErreur = (v, lib, { requis = false } = {}) => { const n = R.lireNombre(v); if (n === null) return requis ? `Indique ${lib}.` : null; if (!Number.isFinite(n) || n < 0) return `${lib.charAt(0).toUpperCase() + lib.slice(1)} : nombre positif attendu.`; return null; };
  const optionsFinanceurs = (v) => `${E.financeurs.map((f) => `<option value="${f.id}" ${f.id === v ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}<option value="__nouveau">+ Nouveau financeur…</option>`;
  const optionsProjets = (v) => `<option value="">Sans projet (fonctionnement)</option>${E.projets.filter((p) => !p.archive || p.id === v).map((p) => `<option value="${p.id}" ${p.id === v ? 'selected' : ''}>${esc(p.nom)} · ${ex(p.annee)}</option>`).join('')}`;
  const valeurMontant = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

  function modaleDossier(did, pre = {}) {
    const existant = did ? dossier(did) : null;
    if (did && !existant) return;
    const p0 = pre.projet ? projet(pre.projet) : null;
    const v = existant || R.normaliserDossier({ projet: pre.projet || null, financeur: pre.financeur || E.financeurs[0]?.id || null, annee: p0?.annee }, auj());
    const sansFinanceur = !E.financeurs.length;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Financeur${sansFinanceur ? '<small>Crée-le ici : nom et type.</small>' : ''}${sansFinanceur ? '<input name="nfNom" maxlength="80" placeholder="Ex. : Commune · vie associative">' : `<select name="financeur" data-role="financeur">${optionsFinanceurs(v.financeur)}</select>`}</label>
        ${sansFinanceur ? `<label class="champ">Type<select name="nfType">${B.typesFinanceur.map((t) => `<option value="${t.id}">${esc(t.nom)}</option>`).join('')}</select></label>` : ''}
      </div>
      <div id="nouveau-financeur" class="cadre-champs" hidden><div class="rang-champs"><label class="champ">Nom du nouveau financeur<input name="nfNom2" maxlength="80"></label><label class="champ">Type<select name="nfType2">${B.typesFinanceur.map((t) => `<option value="${t.id}">${esc(t.nom)}</option>`).join('')}</select></label></div></div>
      <div class="rang-champs">
        <label class="champ">Projet<select name="projet">${optionsProjets(v.projet)}</select></label>
        <label class="champ">Année de l'action<small>Celle de l'exercice subventionné.</small><input name="annee" type="number" min="2000" max="2100" value="${v.annee}"></label>
      </div>
      <label class="champ">Intitulé<small>Facultatif : sinon « financeur · année ».</small><input name="intitule" maxlength="120" value="${esc(v.intitule)}" placeholder="Ex. : Fête de quartier · commune"></label>
      <div class="rang-champs">
        <label class="champ">Dispositif ou appel à projets<small>Tel qu'il est nommé par le financeur.</small><input name="dispositif" maxlength="120" value="${esc(v.dispositif)}"></label>
        <label class="champ">Nature de l'aide<select name="nature">${B.natures.map((n) => `<option value="${n.id}" ${n.id === v.nature ? 'selected' : ''}>${esc(n.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Montant demandé (€)<input name="demande" inputmode="decimal" value="${valeurMontant(v.demande || '')}" placeholder="0"></label>
        ${existant && existant.statut === 'accorde' ? `<label class="champ">Montant accordé (€)<input name="accorde" inputmode="decimal" value="${valeurMontant(v.accorde)}"></label>` : ''}
      </div>
      <fieldset class="champ cadre-champs"><legend>Dates <small>Lues dans l'appel à projets, le règlement ou les courriers du financeur. Toutes facultatives.</small></legend>
        <div class="rang-champs">
          <label class="champ">Date limite de dépôt<input type="date" name="limiteDepot" value="${v.limiteDepot || ''}"></label>
          <label class="champ">Déposé le<input type="date" name="depot" value="${v.depot || ''}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Réponse attendue vers le<input type="date" name="reponseAttendue" value="${v.reponseAttendue || ''}"></label>
          <label class="champ">Réponse reçue le<input type="date" name="reponse" value="${v.reponse || ''}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Bilan à rendre avant le<small>Vide : calculée pour un financeur public (Réglages).</small><input type="date" name="bilanLimite" value="${v.bilanLimite || ''}"></label>
          <label class="champ">Bilan rendu le<input type="date" name="bilanRendu" value="${v.bilanRendu || ''}"></label>
        </div>
      </fieldset>
      ${existant ? `<fieldset class="champ"><legend>Statut</legend><div class="choix-statut choix-5">${R.STATUTS.map((s) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>` : ''}
      <label class="case"><input type="checkbox" name="convention" ${v.convention ? 'checked' : ''}> Convention signée avec le financeur</label>
      <label class="case"><input type="checkbox" name="sansBilan" ${v.sansBilan ? 'checked' : ''}> Aucun bilan demandé par le financeur</label>
      <label class="champ">Note<small>Facultative : contact du service (fonction), remarques de l'instruction.</small><textarea name="note" rows="2" maxlength="600">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const pied = existant ? PIED('Enregistrer', '<button class="btn" value="dupliquer">Dupliquer pour l\'an prochain</button><button class="btn danger gauche" value="supprimer">Supprimer</button>') : PIED('Créer le dossier');
    ouvrirModale(existant ? esc(titreDossier(existant)) : 'Nouveau dossier', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const nb = E.depenses.filter((x) => x.dossier === existant.id).length;
        if (!confirm(`Supprimer ce dossier${nb ? ` ? ${pluriel(nb, 'dépense imputée')} restera${nb > 1 ? 'nt' : ''} dans le projet` : ' ?'}`)) return 'Dossier gardé.';
        retenir();
        E.dossiers = E.dossiers.filter((x) => x.id !== existant.id);
        E.depenses.forEach((x) => { if (x.dossier === existant.id) x.dossier = null; });
        sauver(); changerVue('dossiers'); toast('Dossier supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      if (action === 'dupliquer') {
        retenir();
        const n = R.normaliserDossier({ projet: null, financeur: existant.financeur, annee: existant.annee + 1, intitule: existant.intitule.replace(String(existant.annee), String(existant.annee + 1)), dispositif: existant.dispositif, nature: existant.nature, demande: existant.demande, pieces: existant.pieces.map((p) => ({ nom: p.nom, base: p.base, statut: ['statuts', 'rib', 'identifiants'].includes(p.base) && p.statut !== 'sansobjet' ? 'pret' : 'afaire' })), note: '' }, auj());
        E.dossiers.push(n);
        sauver(); changerVue('dossier', n.id); toast(`Dossier ${existant.annee + 1} créé : rattache-le au projet et note la nouvelle date limite.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const err = nombreOuErreur(f.get('demande'), 'le montant demandé') || nombreOuErreur(f.get('accorde'), 'le montant accordé');
      if (err) return err;
      let fid = f.get('financeur');
      let nouveauF = null;
      const nomNf = String(sansFinanceur ? f.get('nfNom') : f.get('nfNom2') || '').trim();
      if (sansFinanceur || fid === '__nouveau') {
        if (!nomNf) return 'Donne un nom au financeur.';
        nouveauF = R.normaliserFinanceur({ nom: nomNf, type: sansFinanceur ? f.get('nfType') : f.get('nfType2') }, B.typesFinanceur);
        fid = nouveauF.id;
      }
      const g = (n) => f.get(n) || null;
      if (g('depot') && g('reponse') && g('reponse') < g('depot')) return 'La réponse est datée avant le dépôt.';
      retenir();
      if (nouveauF) E.financeurs.push(nouveauF);
      const statut = existant ? f.get('statut') : (g('depot') ? 'depose' : 'preparation');
      const donnees = {
        ...(existant || {}), financeur: fid, projet: g('projet'), annee: f.get('annee'), intitule: f.get('intitule'), dispositif: f.get('dispositif'), nature: f.get('nature'),
        demande: f.get('demande'), accorde: existant && existant.statut === 'accorde' ? f.get('accorde') : existant?.accorde ?? null, statut,
        limiteDepot: g('limiteDepot'), depot: g('depot'), reponseAttendue: g('reponseAttendue'), reponse: g('reponse'), bilanLimite: g('bilanLimite'), bilanRendu: g('bilanRendu'),
        convention: f.get('convention') === 'on', sansBilan: f.get('sansBilan') === 'on', note: f.get('note'),
      };
      if (!existant) donnees.pieces = R.piecesDepart(B, (nouveauF || financeur(fid))?.type);
      const n = R.normaliserDossier(donnees, auj());
      if (n.statut === 'accorde' && !n.piecesBilan.length && !n.sansBilan) n.piecesBilan = R.piecesBilanDepart(B);
      if (existant) Object.assign(existant, n); else E.dossiers.push(n);
      sauver();
      if (!existant) { changerVue('dossier', n.id); toast(`Dossier créé avec ${pluriel(n.pieces.length, 'pièce')} type${n.pieces.length > 1 ? 's' : ''} à préparer.`, { libelle: 'Annuler', faire: annuler }); } else { rendre(); toast('Dossier enregistré.', { libelle: 'Annuler', faire: annuler }); }
    });
    const sel = modale().querySelector('[data-role=financeur]');
    if (sel) sel.addEventListener('change', () => { modale().querySelector('#nouveau-financeur').hidden = sel.value !== '__nouveau'; });
  }

  function modaleDepot(id) {
    const d = dossier(id);
    ouvrirModale('Dossier déposé', `
      <p>${esc(titreDossier(d))}${R.piecesManquantes(d) ? ` : <b>${pluriel(R.piecesManquantes(d), 'pièce')} encore « à préparer »</b>. Elles passeront « envoyées » si tu les as jointes.` : '.'}</p>
      <div class="rang-champs"><label class="champ">Déposé le<input type="date" name="depot" value="${auj()}"></label><label class="champ">Réponse attendue vers le<small>Facultatif : sinon relance proposée à ${E.reglages.relanceReponse} jours.</small><input type="date" name="reponseAttendue" value="${d.reponseAttendue || ''}"></label></div>
      ${R.piecesManquantes(d) ? '<label class="case"><input type="checkbox" name="toutes" checked> Marquer toutes les pièces comme envoyées</label>' : ''}
      <p class="erreur" role="alert"></p>`, PIED(), (f) => {
      if (!R.estDate(f.get('depot'))) return 'Indique la date du dépôt.';
      retenir();
      d.depot = f.get('depot'); d.statut = 'depose'; d.reponseAttendue = R.estDate(f.get('reponseAttendue')) ? f.get('reponseAttendue') : null;
      d.pieces.forEach((p) => { if (p.statut === 'pret' || (f.get('toutes') === 'on' && p.statut === 'afaire')) p.statut = 'joint'; });
      sauver(); rendre(); toast('Dossier noté comme déposé.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReponse(id) {
    const d = dossier(id);
    ouvrirModale('Réponse du financeur', `
      <fieldset class="champ"><legend>Réponse</legend><div class="choix-statut"><label><input type="radio" name="sens" value="accorde" checked><span>Accordé</span></label><label><input type="radio" name="sens" value="refuse"><span>Refusé</span></label></div></fieldset>
      <div class="rang-champs"><label class="champ">Montant accordé (€)<small>Demandé : ${euros(d.demande)}.</small><input name="accorde" inputmode="decimal" value="${valeurMontant(d.accorde ?? d.demande)}"></label><label class="champ">Réponse reçue le<input type="date" name="reponse" value="${auj()}"></label></div>
      <label class="case"><input type="checkbox" name="echeancier" checked> Créer un versement attendu du montant accordé (à ajuster : avance, solde)</label>
      <label class="champ">Note<small>Facultative : motif du refus, conditions de l'accord.</small><input name="note" maxlength="300"></label>
      <p class="erreur" role="alert"></p>`, PIED(), (f) => {
      const sens = f.get('sens');
      if (sens === 'accorde') { const e2 = nombreOuErreur(f.get('accorde'), 'le montant accordé', { requis: true }); if (e2) return e2; }
      retenir();
      d.statut = sens; d.reponse = R.estDate(f.get('reponse')) ? f.get('reponse') : auj();
      if (!d.depot) d.depot = d.reponse;
      const note = String(f.get('note') || '').trim();
      if (note) d.note = [d.note, note].filter(Boolean).join(' · ').slice(0, 600);
      if (sens === 'accorde') {
        d.accorde = R.montantOuNull(f.get('accorde'));
        if (f.get('echeancier') === 'on' && !d.versements.length && d.accorde) d.versements.push(R.normaliserVersement({ montant: d.accorde, prevuLe: ajoutMois(d.reponse, 1) }));
        if (!d.piecesBilan.length && !d.sansBilan) d.piecesBilan = R.piecesBilanDepart(B);
      }
      sauver(); rendre();
      toast(sens === 'accorde' ? `${euros(d.accorde)} accordés : note l'échéancier des versements.` : 'Refus noté. Le dossier reste dans l\'historique.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleVersement(id, vid) {
    const d = dossier(id);
    const v = vid ? d.versements.find((x) => x.id === vid) : null;
    const reste = Math.max(0, R.accordeDe(d) - R.versementsPrevus(d));
    ouvrirModale(v ? 'Versement' : 'Nouveau versement', `
      <div class="rang-champs"><label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${valeurMontant(v ? v.montant : reste || '')}"></label><label class="champ">Attendu le<input type="date" name="prevuLe" value="${v?.prevuLe || ''}"></label></div>
      <label class="champ">Reçu le<small>Vide tant que le virement n'est pas arrivé.</small><input type="date" name="recuLe" value="${v?.recuLe || ''}"></label>
      <p class="erreur" role="alert"></p>`, PIED(v ? 'Enregistrer' : 'Ajouter', v ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''), (f, action) => {
      if (action === 'supprimer') { retenir(); d.versements = d.versements.filter((x) => x.id !== v.id); sauver(); rendre(); toast('Versement supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const e2 = nombreOuErreur(f.get('montant'), 'le montant', { requis: true }); if (e2) return e2;
      if (!R.estDate(f.get('prevuLe')) && !R.estDate(f.get('recuLe'))) return 'Indique la date attendue ou la date de réception.';
      retenir();
      const n = R.normaliserVersement({ id: v?.id, montant: f.get('montant'), prevuLe: f.get('prevuLe'), recuLe: f.get('recuLe') });
      if (v) Object.assign(v, n); else d.versements.push(n);
      sauver(); rendre(); toast(v ? 'Versement enregistré.' : 'Versement ajouté.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function recevoir(id, vid) {
    const d = dossier(id);
    const v = d?.versements.find((x) => x.id === vid);
    if (!v) return;
    ouvrirModale('Versement reçu', `
      <div class="rang-champs"><label class="champ">Montant reçu (€)<input name="montant" inputmode="decimal" value="${valeurMontant(v.montant)}"></label><label class="champ">Reçu le<input type="date" name="recuLe" value="${auj()}"></label></div>
      <p class="erreur" role="alert"></p>`, PIED(), (f) => {
      const e2 = nombreOuErreur(f.get('montant'), 'le montant', { requis: true }); if (e2) return e2;
      if (!R.estDate(f.get('recuLe'))) return 'Indique la date de réception.';
      retenir();
      v.montant = R.montantOuNull(f.get('montant')); v.recuLe = f.get('recuLe');
      sauver(); rendre();
      const reste = R.resteAPercevoir(d);
      toast(reste ? `Reçu. Reste à percevoir : ${euros(reste)}.` : 'Reçu : tout est versé.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePiece(id, liste) {
    const d = dossier(id);
    const types = liste === 'pieces' ? B.pieces.filter((p) => !d.pieces.some((x) => x.base === p.id)) : [];
    ouvrirModale('Ajouter une pièce', `
      ${types.length ? `<label class="champ">Pièce type<select name="type"><option value="">Autre pièce (à nommer)</option>${types.map((p) => `<option value="${p.id}">${esc(p.nom)}</option>`).join('')}</select></label>` : ''}
      <label class="champ">Nom de la pièce<small>${types.length ? 'Seulement pour une autre pièce.' : 'Telle que le financeur la nomme.'}</small><input name="nom" maxlength="140"></label>
      <p class="erreur" role="alert"></p>`, PIED('Ajouter'), (f) => {
      const t = B.pieces.find((p) => p.id === f.get('type'));
      const nom = t ? t.nom : String(f.get('nom') || '').trim();
      if (!nom) return 'Choisis une pièce type ou donne un nom.';
      if (d[liste].length >= R.MAX.pieces) return 'Liste pleine.';
      retenir();
      d[liste].push(R.normaliserPiece({ nom, base: t?.id || null }));
      sauver(); rendre(); toast('Pièce ajoutée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleFinanceur(fid) {
    const f0 = fid ? financeur(fid) : null;
    const v = f0 || { nom: '', type: 'commune', contact: '', note: '' };
    const nb = f0 ? E.dossiers.filter((d) => d.financeur === f0.id).length : 0;
    ouvrirModale(f0 ? esc(f0.nom) : 'Nouveau financeur', `
      <label class="champ">Nom<small>Collectivité et service, fondation, entreprise mécène.</small><input name="nom" required maxlength="80" value="${esc(v.nom)}"></label>
      <label class="champ">Type<small>Public ou privé : pièces proposées et rappels réglementaires.</small><select name="type">${B.typesFinanceur.map((t) => `<option value="${t.id}" ${t.id === v.type ? 'selected' : ''}>${esc(t.nom)} (${t.public ? 'public' : 'privé'})</option>`).join('')}</select></label>
      <label class="champ">Service ou fonction à contacter<small>Pas de nom ni de coordonnées personnelles.</small><input name="contact" maxlength="120" value="${esc(v.contact)}"></label>
      <label class="champ">Note<small>Périodes habituelles de dépôt, critères, remarques.</small><textarea name="note" rows="2" maxlength="400">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`, PIED(f0 ? 'Enregistrer' : 'Ajouter', f0 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''), (f, action) => {
      if (action === 'supprimer') {
        if (nb) return `${pluriel(nb, 'dossier')} le concerne${nb > 1 ? 'nt' : ''} : supprime ou réattribue d'abord ${nb > 1 ? 'ces dossiers' : 'ce dossier'}.`;
        retenir(); E.financeurs = E.financeurs.filter((x) => x.id !== f0.id);
        sauver(); rendre(); toast('Financeur supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      if (!String(f.get('nom') || '').trim()) return 'Donne un nom au financeur.';
      retenir();
      const n = R.normaliserFinanceur({ id: f0?.id, nom: f.get('nom'), type: f.get('type'), contact: f.get('contact'), note: f.get('note') }, B.typesFinanceur);
      if (f0) Object.assign(f0, n); else E.financeurs.push(n);
      sauver(); rendre(); toast(f0 ? 'Financeur enregistré.' : `« ${n.nom} » ajouté.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Lignes de budget éditables (charges ou ressources) : poste, libellé, montant.
  const ligneEdit = (type, l, postes) => `<li class="ligne-budget" data-type="${type}"><label class="champ"><span class="sr-only">Poste</span><select name="${type}-poste">${postes.map((p) => `<option ${p === l.poste ? 'selected' : ''}>${esc(p)}</option>`).join('')}${l.poste && !postes.includes(l.poste) ? `<option selected>${esc(l.poste)}</option>` : ''}</select></label><label class="champ"><span class="sr-only">Précision</span><input name="${type}-libelle" maxlength="120" value="${esc(l.libelle)}" placeholder="Précision"></label><label class="champ montant"><span class="sr-only">Montant</span><input name="${type}-montant" inputmode="decimal" value="${valeurMontant(l.montant || '')}" placeholder="0 €"></label><button type="button" class="btn-icone petit" data-action="retirer-ligne" aria-label="Retirer la ligne">×</button></li>`;
  function modaleProjet(pid) {
    const p0 = pid ? projet(pid) : null;
    const v = p0 || R.normaliserProjet({ annee: anneeVue }, auj());
    const charges = v.charges.length ? v.charges : B.postes.slice(0, 3).map((poste) => ({ poste, libelle: '', montant: 0 }));
    const nbDos = p0 ? E.dossiers.filter((d) => d.projet === p0.id).length : 0;
    ouvrirModale(p0 ? esc(p0.nom) : 'Nouveau projet', `
      <div class="rang-champs"><label class="champ">Nom du projet<input name="nom" required maxlength="100" value="${esc(v.nom === 'Projet' && !p0 ? '' : v.nom)}" placeholder="Ex. : Fête de quartier"></label><label class="champ">Année<input name="annee" type="number" min="2000" max="2100" value="${v.annee}"></label></div>
      <label class="champ">Description<small>Objectifs, public, calendrier : reprise sur le budget imprimé.</small><textarea name="description" rows="2" maxlength="600">${esc(v.description)}</textarea></label>
      <fieldset class="champ cadre-champs"><legend>Charges prévues <small>Le budget du projet, poste par poste.</small></legend><ul class="lignes-budget" id="lignes-charges">${charges.map((l) => ligneEdit('charges', l, B.postes)).join('')}</ul><button type="button" class="btn petit" data-action="ajouter-ligne" data-type="charges">${ICONES.plus}Ligne</button><p class="aide" id="total-charges"></p></fieldset>
      <fieldset class="champ cadre-champs"><legend>Autres ressources <small>Hors subventions (elles viennent des dossiers) : fonds propres, participations, recettes.</small></legend><ul class="lignes-budget" id="lignes-ressources">${v.ressources.map((l) => ligneEdit('ressources', l, B.ressources)).join('')}</ul><button type="button" class="btn petit" data-action="ajouter-ligne" data-type="ressources">${ICONES.plus}Ligne</button></fieldset>
      ${p0 ? `<label class="case"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''}> Projet terminé (archivé, gardé dans l'historique)</label>` : ''}
      <p class="erreur" role="alert"></p>`, PIED(p0 ? 'Enregistrer' : 'Créer le projet', p0 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''), (f, action) => {
      if (action === 'supprimer') {
        const nbDep = E.depenses.filter((x) => x.projet === p0.id).length;
        if (!confirm(`Supprimer le projet ?${nbDos ? ` ${pluriel(nbDos, 'dossier')} passera${nbDos > 1 ? 'ont' : ''} « sans projet ».` : ''}${nbDep ? ` ${pluriel(nbDep, 'dépense')} ser${nbDep > 1 ? 'ont' : 'a'} supprimée${nbDep > 1 ? 's' : ''}.` : ''}`)) return 'Projet gardé.';
        retenir();
        E.projets = E.projets.filter((x) => x.id !== p0.id);
        E.dossiers.forEach((d) => { if (d.projet === p0.id) d.projet = null; });
        E.depenses = E.depenses.filter((x) => x.projet !== p0.id);
        sauver(); changerVue('projets'); toast('Projet supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au projet.';
      const lire = (type) => { const P = f.getAll(`${type}-poste`), Lb = f.getAll(`${type}-libelle`), M = f.getAll(`${type}-montant`); return P.map((poste, i) => ({ poste, libelle: Lb[i], montant: M[i] })).filter((l) => R.lireNombre(l.montant) || String(l.libelle).trim()); };
      const lignes = [...lire('charges'), ...lire('ressources')];
      const bad = lignes.find((l) => { const n = R.lireNombre(l.montant); return n !== null && (!Number.isFinite(n) || n < 0); });
      if (bad) return `Montant illisible : « ${bad.montant} ».`;
      retenir();
      const n = R.normaliserProjet({ id: p0?.id, nom, annee: f.get('annee'), description: f.get('description'), charges: lire('charges'), ressources: lire('ressources'), archive: f.get('archive') === 'on' }, auj());
      if (p0) Object.assign(p0, n); else E.projets.push(n);
      sauver();
      if (p0) { rendre(); toast('Projet enregistré.', { libelle: 'Annuler', faire: annuler }); } else { changerVue('projet', n.id); toast(`« ${n.nom} » créé : ajoute les dossiers des financeurs sollicités.`, { libelle: 'Annuler', faire: annuler }); }
    });
    majTotalCharges();
    modale().addEventListener('input', majTotalCharges);
  }
  function majTotalCharges() {
    const el = $('#total-charges');
    if (!el) return;
    const total = R.somme([...modale().querySelectorAll('[name=charges-montant]')], (x) => R.montantOuNull(x.value) || 0);
    el.textContent = `Total des charges : ${euros(total, { centimes: true })}`;
  }

  function modaleDepense(xid, pre = {}) {
    const x0 = xid ? E.depenses.find((x) => x.id === xid) : null;
    const v = x0 || R.normaliserDepense({ projet: pre.projet || E.projets[0]?.id || null, poste: (projet(pre.projet)?.charges[0]?.poste) || B.postes[0] }, auj());
    if (!E.projets.length) { toast('Crée d\'abord un projet : chaque dépense lui est rattachée.'); return; }
    const dossiersDe = (pid) => E.dossiers.filter((d) => d.projet === pid && !['refuse', 'abandonne'].includes(d.statut));
    const optDossiers = (pid, val) => `<option value="">Le projet, sans financeur précis</option>${dossiersDe(pid).map((d) => `<option value="${d.id}" ${d.id === val ? 'selected' : ''}>${esc(nomFinanceur(d.financeur))}</option>`).join('')}`;
    const postes = [...new Set([...(projet(v.projet)?.charges.map((l) => l.poste) || []), ...B.postes])];
    ouvrirModale(x0 ? 'Dépense' : 'Nouvelle dépense', `
      <div class="rang-champs"><label class="champ">Projet<select name="projet" data-role="projet">${E.projets.map((p) => `<option value="${p.id}" ${p.id === v.projet ? 'selected' : ''}>${esc(p.nom)} · ${ex(p.annee)}</option>`).join('')}</select></label><label class="champ">Date<input type="date" name="date" value="${v.date}"></label></div>
      <label class="champ">Dépense<input name="libelle" required maxlength="140" value="${esc(x0 ? v.libelle : '')}" placeholder="Ex. : Location de la sonorisation"></label>
      <div class="rang-champs"><label class="champ">Poste<select name="poste">${postes.map((p) => `<option ${p === v.poste ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${valeurMontant(x0 ? v.montant : '')}"></label></div>
      <div class="rang-champs"><label class="champ">Fournisseur<small>Facultatif.</small><input name="fournisseur" maxlength="80" value="${esc(v.fournisseur)}"></label><label class="champ">Référence du justificatif<small>N° de facture ou de pièce comptable.</small><input name="piece" maxlength="60" value="${esc(v.piece)}"></label></div>
      <label class="champ">Imputée au dossier<small>Pour justifier la subvention d'un financeur précis.</small><select name="dossier" data-role="dossier">${optDossiers(v.projet, v.dossier)}</select></label>
      <label class="case"><input type="checkbox" name="justificatif" ${v.justificatif ? 'checked' : ''}> Justificatif rangé (facture, ticket, bulletin)</label>
      <p class="erreur" role="alert"></p>`, PIED(x0 ? 'Enregistrer' : 'Ajouter', x0 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn" value="encore">Ajouter et continuer</button>'), (f, action) => {
      if (action === 'supprimer') { retenir(); E.depenses = E.depenses.filter((x) => x.id !== x0.id); sauver(); rendre(); toast('Dépense supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      if (!String(f.get('libelle') || '').trim()) return 'Décris la dépense.';
      const e2 = nombreOuErreur(f.get('montant'), 'le montant', { requis: true }); if (e2) return e2;
      retenir();
      const n = R.normaliserDepense({ id: x0?.id, projet: f.get('projet'), date: f.get('date'), libelle: f.get('libelle'), poste: f.get('poste'), montant: f.get('montant'), fournisseur: f.get('fournisseur'), piece: f.get('piece'), dossier: f.get('dossier') || null, justificatif: f.get('justificatif') === 'on' }, auj());
      if (x0) Object.assign(x0, n); else E.depenses.push(n);
      sauver(); rendre();
      if (action === 'encore') { modale().dataset.garder = '1'; toast(`« ${n.libelle} » ajoutée.`, { libelle: 'Annuler', faire: annuler }); setTimeout(() => modaleDepense(null, { projet: n.projet }), 0); return; }
      toast(x0 ? 'Dépense enregistrée.' : `« ${n.libelle} » ajoutée${n.justificatif ? '' : ' : pense à ranger le justificatif'}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelector('[data-role=projet]').addEventListener('change', (e) => { d.querySelector('[data-role=dossier]').innerHTML = optDossiers(e.target.value, null); });
  }

  // ---------- Actions courtes ----------
  function cyclePiece(id, liste, pid) {
    const d = dossier(id);
    const p = d?.[liste].find((x) => x.id === pid);
    if (!p) return;
    retenir();
    p.statut = CYCLE[p.statut];
    sauver(); rendre();
    const el = document.querySelector(`[data-piece="${pid}"].piece-corps`);
    if (el) el.focus();
  }
  function relancer(id) {
    const d = dossier(id);
    retenir();
    d.reponseAttendue = ajout(auj(), 15);
    d.note = [d.note, `Relancé le ${dateCourte(auj())}`].filter(Boolean).join(' · ').slice(0, 600);
    sauver(); rendre(); toast('Relance notée : nouvelle échéance de réponse dans 15 jours.', { libelle: 'Annuler', faire: annuler });
  }
  function bilanRendu(id) {
    const d = dossier(id);
    ouvrirModale('Bilan rendu', `<p>${esc(titreDossier(d))}</p><label class="champ">Rendu le<input type="date" name="date" value="${auj()}"></label><label class="case"><input type="checkbox" name="toutes" checked> Marquer les pièces du bilan comme envoyées</label><p class="erreur" role="alert"></p>`, PIED(), (f) => {
      if (!R.estDate(f.get('date'))) return 'Indique la date.';
      retenir();
      d.bilanRendu = f.get('date');
      if (f.get('toutes') === 'on') d.piecesBilan.forEach((p) => { if (p.statut !== 'sansobjet') p.statut = 'joint'; });
      sauver(); rendre(); toast(R.etatDossier(d) === 'clos' ? 'Bilan rendu : dossier clos.' : `Bilan rendu. Reste à percevoir : ${euros(R.resteAPercevoir(d))}.`, { libelle: 'Annuler', faire: annuler });
    });
  }
  function enregistrerBilan(id) {
    const d = dossier(id);
    const f = $('#form-bilan');
    retenir();
    for (const r of B.trameBilan) d.bilan[r.id] = f.querySelector(`[name=${r.id}]`).value.slice(0, 2000);
    sauver(); toast('Trame du bilan enregistrée.', { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Impressions ----------
  function imprimer(html) {
    const el = $('#impression');
    el.className = 'impr-liste';
    el.innerHTML = html;
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche'); });
  const enTete = (titre, sous = '') => `<header><p>${esc(E.structure || 'Association')} · édité le ${dateLongue(auj())}</p><h1>${esc(titre)}</h1>${sous ? `<p>${sous}</p>` : ''}</header>`;
  const tableBudget = (p, b) => `<table><thead><tr><th>Charges prévues</th><th>Précision</th><th class="nb">Montant</th></tr></thead><tbody>${p.charges.map((l) => `<tr><td>${esc(l.poste)}</td><td>${esc(l.libelle)}</td><td class="nb">${euros(l.montant, { centimes: true })}</td></tr>`).join('')}<tr><td colspan="2"><b>Total des charges</b></td><td class="nb"><b>${euros(b.charges, { centimes: true })}</b></td></tr></tbody></table>
    <table><thead><tr><th>Ressources prévues</th><th>État</th><th class="nb">Montant</th><th class="nb">Part</th></tr></thead><tbody>${b.subventions.map((s) => `<tr><td>${esc(nomFinanceur(s.financeur))}</td><td>${s.acquis ? 'Accordé' : R.LIB_STATUT[s.statut]}</td><td class="nb">${euros(s.montant, { centimes: true })}</td><td class="nb">${pct(s.part)}</td></tr>`).join('')}${p.ressources.map((l) => `<tr><td>${esc(l.poste)}${l.libelle ? ` · ${esc(l.libelle)}` : ''}</td><td></td><td class="nb">${euros(l.montant, { centimes: true })}</td><td class="nb">${b.charges ? pct((l.montant / b.charges) * 100) : ''}</td></tr>`).join('')}<tr><td colspan="2"><b>Total des ressources</b></td><td class="nb"><b>${euros(b.ressources, { centimes: true })}</b></td><td></td></tr></tbody></table>`;

  function imprimerBudget(pid) {
    const p = projet(pid); const b = R.budgetProjet(E, pid);
    imprimer(`${enTete(`Budget prévisionnel · ${p.nom}`, `Projet ${ex(p.annee)}${p.description ? ` · ${esc(p.description)}` : ''}`)}${tableBudget(p, b)}
      <p class="mention">${b.equilibre === 0 ? 'Budget équilibré.' : b.equilibre < 0 ? `Non financé : ${euros(-b.equilibre)}.` : `Excédent de ressources : ${euros(b.equilibre)}.`} Subventions demandées non encore accordées comptées au montant demandé.</p>`);
  }

  function imprimerDossier(id) {
    const d = dossier(id); const f = financeur(d.financeur);
    imprimer(`${enTete(titreDossier(d), `${esc(nomFinanceur(d.financeur))} (${esc(typeF(f?.type).nom)}) · ${esc(nomProjet(d.projet))} · ${ex(d.annee)} · ${R.LIB_STATUT[R.etatDossier(d)]}`)}
      <table><tbody><tr><th>Dispositif</th><td>${esc(d.dispositif)}</td></tr><tr><th>Demandé</th><td>${euros(d.demande, { centimes: true })}</td></tr>${d.statut === 'accorde' ? `<tr><th>Accordé</th><td>${euros(R.accordeDe(d), { centimes: true })}</td></tr><tr><th>Versé</th><td>${euros(R.verse(d), { centimes: true })}</td></tr><tr><th>Reste à percevoir</th><td>${euros(R.resteAPercevoir(d), { centimes: true })}</td></tr>` : ''}${ETAPES(d).map(([l, date]) => `<tr><th>${esc(l)}</th><td>${date ? dateLongue(date) : ''}</td></tr>`).join('')}</tbody></table>
      <h2>Pièces du dossier</h2><table><thead><tr><th>Pièce</th><th>État</th><th>☐</th></tr></thead><tbody>${d.pieces.map((p) => `<tr class="${p.statut === 'sansobjet' ? 'so' : ''}"><td>${esc(p.nom)}</td><td>${R.LIB_PIECE[p.statut]}</td><td>${p.statut === 'joint' ? '☑' : '☐'}</td></tr>`).join('')}</tbody></table>
      ${d.versements.length ? `<h2>Versements</h2><table><thead><tr><th>Montant</th><th>Attendu le</th><th>Reçu le</th></tr></thead><tbody>${d.versements.map((v) => `<tr><td>${euros(v.montant, { centimes: true })}</td><td>${v.prevuLe ? dateCourte(v.prevuLe) : ''}</td><td>${v.recuLe ? dateCourte(v.recuLe) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      ${d.note ? `<p><b>Note :</b> ${esc(d.note)}</p>` : ''}`);
  }

  function imprimerBilan(id) {
    const d = dossier(id); const b = R.bilanDossier(E, d); const p = projet(d.projet);
    const deps = E.depenses.filter((x) => (b.imputees ? x.dossier === d.id : x.projet === d.projet)).sort((x, y) => x.date.localeCompare(y.date));
    imprimer(`${enTete(`Bilan d'utilisation · ${titreDossier(d)}`, `${esc(nomFinanceur(d.financeur))} · ${esc(nomProjet(d.projet))} · exercice ${ex(d.annee)} · subvention ${d.statut === 'accorde' ? `accordée : ${euros(R.accordeDe(d), { centimes: true })}` : `demandée : ${euros(d.demande, { centimes: true })}`}`)}
      ${B.trameBilan.map((r) => `<h2>${esc(r.titre)}</h2><p class="bloc-texte">${esc(d.bilan[r.id]) || '<span class="a-remplir">À compléter.</span>'}</p>`).join('')}
      ${b.budget ? `<h2>Budget prévu et réalisé</h2><table><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Réalisé</th><th class="nb">Écart</th></tr></thead><tbody>${b.budget.postes.map((x) => `<tr><td>${esc(x.poste || 'Sans poste')}</td><td class="nb">${euros(x.prevu, { centimes: true })}</td><td class="nb">${euros(x.reel, { centimes: true })}</td><td class="nb">${euros(x.ecart, { centimes: true })}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="nb"><b>${euros(b.budget.charges, { centimes: true })}</b></td><td class="nb"><b>${euros(b.budget.realise, { centimes: true })}</b></td><td class="nb">${euros(b.budget.realise - b.budget.charges, { centimes: true })}</td></tr></tbody></table>` : ''}
      ${deps.length ? `<h2>${b.imputees ? 'Dépenses imputées à cette subvention' : `Dépenses du projet${p ? ` ${esc(p.nom)}` : ''}`}</h2><table><thead><tr><th>Date</th><th>Dépense</th><th>Fournisseur</th><th>Justificatif</th><th class="nb">Montant</th></tr></thead><tbody>${deps.map((x) => `<tr class="${x.justificatif ? '' : 'retard'}"><td>${dateCourte(x.date)}</td><td>${esc(x.libelle)}</td><td>${esc(x.fournisseur)}</td><td>${x.justificatif ? esc(x.piece || 'Oui') : 'Manquant'}</td><td class="nb">${euros(x.montant, { centimes: true })}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="mention">${b.imputees ? `Justifié : ${euros(b.justifie, { centimes: true })} sur ${euros(b.aJustifier, { centimes: true })}.` : b.estimation !== null ? `Part estimée du financeur dans les dépenses réalisées : ${euros(b.estimation, { centimes: true })}.` : ''} ${public_(d) ? `Pour un financeur public, ce document prépare le compte rendu financier (Cerfa n° 15059*02 ou formulaire du financeur) sans le remplacer. Source : ${esc(sourceCourte('R46623'))}.` : ''}</p>
      <div class="signatures"><span>Le ou la présidente</span><span>Le ou la trésorière</span></div>`);
  }

  function imprimerAnnee() {
    const s = R.syntheseAnnee(E, B, anneeVue);
    const liste = R.trierDossiers(E.dossiers.filter((d) => d.annee === anneeVue));
    imprimer(`${enTete(`Subventions ${ex(anneeVue)}`, `${pluriel(s.nb, 'dossier')} · demandé ${euros(s.demande)} · accordé ${euros(s.accorde)} · versé ${euros(s.verse)} · reste à percevoir ${euros(s.reste)}`)}
      <table><thead><tr><th>Dossier</th><th>Financeur</th><th>Projet</th><th>Statut</th><th class="nb">Demandé</th><th class="nb">Accordé</th><th class="nb">Versé</th><th>Bilan</th></tr></thead><tbody>${liste.map((d) => `<tr><td>${esc(titreDossier(d))}</td><td>${esc(nomFinanceur(d.financeur))}</td><td>${esc(nomProjet(d.projet))}</td><td>${R.LIB_STATUT[R.etatDossier(d)]}</td><td class="nb">${euros(d.demande)}</td><td class="nb">${d.statut === 'accorde' ? euros(R.accordeDe(d)) : ''}</td><td class="nb">${euros(R.verse(d))}</td><td>${d.bilanRendu ? `rendu ${dateCourte(d.bilanRendu)}` : d.sansBilan ? 'non demandé' : R.limiteBilan(E, B, d).date && d.statut === 'accorde' ? `avant ${dateCourte(R.limiteBilan(E, B, d).date)}` : ''}</td></tr>`).join('')}</tbody></table>
      <h2>Par type de financeur</h2><table><thead><tr><th>Type</th><th class="nb">Dossiers</th><th class="nb">Demandé</th><th class="nb">Accordé</th><th class="nb">Versé</th></tr></thead><tbody>${s.parType.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.nb}</td><td class="nb">${euros(x.demande)}</td><td class="nb">${euros(x.accorde)}</td><td class="nb">${euros(x.verse)}</td></tr>`).join('')}</tbody></table>
      <p class="mention">Taux de réponses positives : ${pct(s.tauxAcceptation)}. Montants saisis par l'association.</p>`);
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const g = E.reglages;
    const corps = `
      <label class="champ">Nom de l'association<input name="structure" maxlength="100" value="${esc(E.structure)}"></label>
      <div class="rang-champs">
        <label class="champ">Début de l'exercice<select name="debutExercice">${MOIS.map((m, i) => `<option value="${i + 1}" ${g.debutExercice === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="champ">Alerte avant une date (jours)<input name="alerte" type="number" min="1" max="120" value="${g.alerte}"></label>
        <label class="champ">Relance après un dépôt (jours)<input name="relanceReponse" type="number" min="7" max="365" value="${g.relanceReponse}"></label>
      </div>
      <label class="case"><input type="checkbox" name="rappels" ${g.rappels ? 'checked' : ''}> Rappels réglementaires des subventions publiques (convention au-delà de ${euros(B.regles.convention.seuil)}, compte rendu financier à 6 mois, comptes annuels au-delà de ${euros(B.regles.comptesAnnuels.seuil)})</label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Rien n'est envoyé aux financeurs : exporte en tableur ou imprime depuis le tableau de bord, un dossier ou un projet.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Dossiers en CSV</button><button class="btn petit" type="button" data-action="csv-depenses">Dépenses en CSV</button><button class="btn petit" type="button" data-action="imprimer-annee">Bilan annuel</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span>. Partage-la avec les membres du bureau qui suivent les dossiers.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi des subventions, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application : pratique pour noter un versement ou vérifier une pièce en réunion.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Sources et à propos</h3><p class="mention">Rappels réglementaires : ${B.sources.map((s) => `fiche « ${esc(s.titre)} » de ${esc(s.editeur)}, vérifiée par l'administration le ${esc(s.verifiePar)}, consultée par QME le ${dateLongue(s.consulte)} : <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace('https://', ''))}</a>`).join(' ; ')}. Indicatifs, pas un conseil juridique : la convention ou l'arrêté d'attribution prévaut. Aucun calendrier de financeur, aucun montant de dispositif ni aucun appel à projets n'est intégré : ils changent chaque année et se saisissent dossier par dossier. Pièces types : liste de pièces souvent demandées, à ajuster selon chaque financeur. Base intégrée version ${B.version}.</p></div>`;
    ouvrirModale('Réglages', corps, PIED(), (f) => {
      retenir();
      E.structure = String(f.get('structure') || '').trim().slice(0, 100);
      E.reglages = R.reglagesDe({ debutExercice: f.get('debutExercice'), alerte: f.get('alerte'), relanceReponse: f.get('relanceReponse'), rappels: f.get('rappels') === 'on' }, E.reglages);
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.dossiers) || !Array.isArray(d.financeurs)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.dossiers.length, 'dossier')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe; E.tutorielVu = E.tutorielVu || vu;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de tes subventions.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `subventions-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E, B, auj()), 'text/csv;charset=utf-8', `subventions-dossiers-${auj()}.csv`);
  const exporterCsvDepenses = () => telecharger(R.versCsvDepenses(E), 'text/csv;charset=utf-8', `subventions-depenses-${auj()}.csv`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const g = E.reglages, rg = B.regles;
    const rappels = g.rappels
      ? `Pour un financeur public, l'application rappelle la convention attendue au-delà de ${euros(rg.convention.seuil)} accordés et, pour une aide affectée à une action, le compte rendu financier à rendre dans les ${rg.compteRendu.mois}&nbsp;mois suivant la fin de l'exercice. Le tableau de bord signale aussi quand les subventions publiques reçues sur l'exercice approchent ${euros(rg.comptesAnnuels.seuil)} (comptes annuels obligatoires au-delà).`
      : 'Les rappels réglementaires des subventions publiques (convention, compte rendu financier, comptes annuels) sont désactivés&nbsp;: tu peux les rétablir dans les réglages.';
    const blocs = [
      ['rose', 'Un dossier par financeur', `Chaque dossier relie un projet et un financeur, avec le montant demandé et la date limite de dépôt lue dans l'appel à projets. Il reçoit une liste de pièces, selon que le financeur est public ou privé&nbsp;: coche-les au fur et à mesure.`],
      ['beurre', 'Il avance d\'étape en étape', `En préparation, déposé, puis accordé ou refusé. Sans date de réponse saisie, une relance est proposée ${pluriel(g.relanceReponse, 'jour')} après le dépôt. Une fois accordé, note les versements prévus et coche-les à réception&nbsp;: le reste à percevoir se calcule.`],
      ['ciel', 'Les échéances d\'abord', `<b>Échéances</b> réunit dépôts, réponses, versements, bilans et conventions&nbsp;: les retards en premier, puis ce qui arrive dans les ${pluriel(g.alerte, 'jour')} (un bilan est signalé au moins 45&nbsp;jours avant). Les dates viennent de tes dossiers.`],
      ['sable', 'Les rappels réglementaires', rappels],
      ['rose', 'Le bilan se prépare', `Note les dépenses de chaque projet et coche leur justificatif quand il est rangé. Le bilan d'un dossier additionne les dépenses qui lui sont imputées&nbsp;; sans imputation, il estime la part du financeur d'après le budget prévu du projet. Un dossier accordé, versé et dont le bilan est rendu passe en «&nbsp;Clos&nbsp;».`],
    ];
    const corps = `
      <p>L'application te prévient avant chaque échéance de tes demandes de subvention et prépare le bilan à partir de tes dépenses. Ton rôle&nbsp;: créer un dossier par financeur sollicité et y noter les dates et les montants. Rien n'est envoyé aux financeurs.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Projets</b> porte le budget prévu et les dépenses de chaque action, <b>Financeurs</b> tes interlocuteurs. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: les membres du bureau qui la saisissent suivent les mêmes dossiers.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.dossiers.length;
    const pied = premier
      ? '<button class="btn primaire" value="dossier">Ajouter mon premier dossier</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'dossier') setTimeout(() => modaleDossier(null, { projet: E.projets[0]?.id }), 0); });
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { const vu = E.tutorielVu; stock.suppr(CLE_DEMO); E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'dossier': if (modale().open) modale().close(); changerVue('dossier', id); break;
      case 'projet': if (modale().open) modale().close(); changerVue('projet', id); break;
      case 'annee': anneeVue = Number(el.dataset.annee); rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'csv-depenses': exporterCsvDepenses(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-dossier': modaleDossier(null, { projet: el.dataset.projet, financeur: el.dataset.financeur }); break;
      case 'modifier-dossier': modaleDossier(id); break;
      case 'filtre-statut': filtre.statut = el.dataset.statut; rendre(); break;
      case 'ech-depose': modaleDepot(id); break;
      case 'ech-reponse': modaleReponse(id); break;
      case 'ech-relance': relancer(id); break;
      case 'ech-recu': recevoir(id, el.dataset.versement); break;
      case 'ech-bilan': changerVue('dossier', id); setTimeout(() => $('#bilan')?.scrollIntoView({ block: 'start' }), 30); break;
      case 'ech-convention': { const d = dossier(id); retenir(); d.convention = true; sauver(); rendre(); toast('Convention notée comme reçue.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'versement': modaleVersement(id, el.dataset.versement); break;
      case 'bilan-rendu': bilanRendu(id); break;
      case 'enregistrer-bilan': enregistrerBilan(id); break;
      case 'cycle-piece': cyclePiece(id, el.dataset.liste, el.dataset.piece); break;
      case 'retirer-piece': { const d = dossier(id); retenir(); d[el.dataset.liste] = d[el.dataset.liste].filter((p) => p.id !== el.dataset.piece); sauver(); rendre(); toast('Pièce retirée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'ajouter-piece': modalePiece(id, el.dataset.liste); break;
      case 'pieces-bilan-types': { const d = dossier(id); retenir(); d.piecesBilan = R.piecesBilanDepart(B); sauver(); rendre(); break; }
      case 'nouveau-financeur': modaleFinanceur(null); break;
      case 'financeur': modaleFinanceur(id); break;
      case 'nouveau-projet': modaleProjet(null); break;
      case 'modifier-projet': modaleProjet(id); break;
      case 'ajouter-ligne': { const type = el.dataset.type; const ul = $(`#lignes-${type}`); if (ul.children.length < R.MAX.lignes) { ul.insertAdjacentHTML('beforeend', ligneEdit(type, { poste: '', libelle: '', montant: 0 }, type === 'charges' ? B.postes : B.ressources)); ul.lastElementChild.querySelector('input').focus(); } break; }
      case 'retirer-ligne': el.closest('li').remove(); majTotalCharges(); break;
      case 'nouvelle-depense': modaleDepense(null, { projet: el.dataset.projet }); break;
      case 'depense': modaleDepense(id); break;
      case 'justifier': { const x = E.depenses.find((y) => y.id === id); retenir(); x.justificatif = true; sauver(); rendre(); toast('Justificatif noté comme rangé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'imprimer-annee': imprimerAnnee(); break;
      case 'imprimer-dossier': imprimerDossier(id); break;
      case 'imprimer-bilan': imprimerBilan(id); break;
      case 'imprimer-budget': imprimerBudget(id); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action=filtre-annee],[data-action=filtre-projet]');
    if (!el) return;
    if (el.dataset.action === 'filtre-annee') filtre.annee = el.value; else filtre.projet = el.value;
    rendre();
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
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
  window.__subventions = { etat: () => E, regles: R };
  init();
})();
