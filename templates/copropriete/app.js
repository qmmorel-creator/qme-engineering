// Charges et AG de copropriété QME : lots et tantièmes, appels de fonds (provisions, fonds de travaux, travaux votés)
// payés ou à payer, décompte annuel par poste et régularisation, part récupérable sur le locataire (saisie, avec aide),
// évolution des charges sur plusieurs exercices, assemblées générales (convocation, ordre du jour, résolutions, vote
// émis, résultat), travaux votés avec échéancier, documents à conserver (référence de rangement), alertes, exports.
// Aucune règle de majorité intégrée. Rappels sourcés et datés (service-public.gouv.fr), désactivables.
// Données synchronisées par clé de licence ou code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CPR;
  const API = '/api/templates';
  const PRODUIT = 'CPR';
  const CLE_CODE = 'qme-cpr-code';
  const CLE_CACHE = 'qme-cpr-cache';
  const CLE_DEMO = 'qme-cpr-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cpr-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const { pluriel, ajout, ajoutMois, versDate, euros, pct } = R;
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
  const SOURCES = Object.fromEntries(B.sources.map((s) => [s.id, s]));
  const sourceCourte = (id) => { const s = SOURCES[id]; return `${s.editeur}, fiche « ${s.titre} » vérifiée le ${s.verifiePar}, consultée le ${dateLongue(s.consulte)}`; };
  const nomPoste = (id) => B.postes.find((p) => p.id === id)?.nom || id;
  const [COUL_PROV, COUL_CHARGES] = B.couleurs;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let ouvert = { assemblee: null };
  let anneeAppels = null; // null : exercice en cours
  let anneeCharges = null;
  let qDocs = '';
  let annulation = null;

  const etatVide = () => R.etatVide(B.reglages);
  const normaliser = (d) => R.normaliser(d, auj(), B);
  const C = () => E.copros.find((c) => c.id === E.actif) || E.copros[0];
  const ex = (a) => R.libelleExercice(a, C().debutExercice);
  const exCourant = () => R.exercice(auj(), C().debutExercice);
  const travauxDe = (id) => C().travaux.find((t) => t.id === id) || null;
  const assemblee = (id) => C().assemblees.find((a) => a.id === id) || null;

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
        toast('Un autre appareil a modifié ta copropriété entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (CPR-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
      if (E.copros.length) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.copros.length) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    if (!E.copros.length) E = donneesDemo();
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
  // Copropriété fictive. Dates relatives à aujourd'hui : appels payés, un appel en retard, un appel de travaux proche,
  // une échéance de travaux pas encore appelée, quatre exercices de charges en hausse avec une régularisation à
  // traiter, une AG tenue (résolutions adoptées et rejetées), une AG à préparer, des travaux terminés et en cours,
  // des documents rangés et des types sans document.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const debut = 1;
    const Y = R.exercice(t, debut);
    const c = R.normaliserCopro({
      id: 'c-tilleuls', nom: 'Résidence Les Tilleuls (copropriété fictive)', syndic: 'Cabinet Exemple Gestion (syndic fictif)', debutExercice: debut, tantiemesTotal: 10000,
      lots: [
        { id: 'l-appart', nom: 'Appartement B12', type: 'logement', numero: '112', tantiemes: 412, loue: true },
        { id: 'l-cave', nom: 'Cave 7', type: 'cave', numero: '207', tantiemes: 8, loue: true },
        { id: 'l-parking', nom: 'Parking 21', type: 'parking', numero: '321', tantiemes: 35 },
      ],
    }, B, t);
    // Charges réelles par poste (quote-part), quatre exercices clos.
    const base = { 'eau-froide': 255, 'eau-chaude': 300, chauffage: 690, ascenseur: 205, entretien: 285, electricite: 68, exterieurs: 58, contrats: 92, assurance: 136, honoraires: 228, administratif: 34, reparations: 110 };
    const facteurs = [0.9, 1.02, 0.97, 1.05];
    const chauffage = [0.85, 1.22, 1.05, 1.08];
    const provisionsAn = [2280, 2400, 2400, 2520];
    const fondsAn = [96, 100, 100, 126];
    e.copros = [c];
    const exercices = [];
    for (let i = 0; i < 4; i++) {
      const annee = Y - 4 + i;
      const charges = Object.entries(base).map(([poste, m]) => ({ poste, montant: R.arrondi(m * (poste === 'chauffage' ? chauffage[i] : facteurs[i] + i * 0.015)) }));
      if (i === 1) charges.push({ poste: 'autres', montant: 48 });
      const dernier = i === 3;
      exercices.push({ id: `e-${annee}`, annee, budget: provisionsAn[i], charges, approuveLe: dernier ? j(-170) : R.ajoutMois(`${annee + 1}-06-12`, 0), regleLe: dernier ? null : `${annee + 1}-07-05` });
      c.appels.push(...R.appelsTrimestriels(c, annee, { provisions: provisionsAn[i], fondsTravaux: fondsAn[i] }).map((a) => ({ ...a, payeLe: R.ajout(a.echeance, 3) })));
    }
    exercices.push({ id: `e-${Y}`, annee: Y, budget: 2580, charges: [] });
    c.exercices = exercices.map((x) => R.normaliserExercice(x, B, t));
    // Exercice en cours : appels trimestriels ; payés jusqu'à l'avant-dernier échu, le dernier échu en retard.
    const courant = R.appelsTrimestriels(c, Y, { provisions: 2580, fondsTravaux: 130 }).concat(R.appelsTrimestriels(c, Y + 1, { provisions: 2580, fondsTravaux: 130 }).slice(0, 1));
    const echus = courant.filter((a) => a.echeance <= t);
    courant.forEach((a) => { if (a.echeance <= t && a !== echus[echus.length - 1]) a.payeLe = R.ajout(a.echeance, 4); });
    // Si le dernier appel échu date de plus de 60 jours, on le recale pour garder un retard récent.
    if (echus.length) { const der = echus[echus.length - 1]; if (R.ecart(der.echeance, t) > 60) der.echeance = j(-12); }
    c.appels.push(...courant);
    // Recharge récupérable : catégories citées proposées par l'aide.
    c.recup = R.recupPropose(B, { contrats: 50 });
    // Assemblées.
    const agPassee = R.normaliserAssemblee({ id: 'ag-passee', date: j(-170), type: 'ordinaire', lieu: 'Salle de réunion de la résidence', convocationRecue: j(-196), presence: 'present', preparee: true, pvRecu: j(-140), resolutions: [
      { id: 'r1', numero: '1', titre: 'Élection du président de séance', majorite: 'Article 24', vote: 'pour', resultat: 'adoptee' },
      { id: 'r2', numero: '2', titre: `Approbation des comptes de l'exercice ${Y - 1}`, majorite: 'Article 24', vote: 'pour', resultat: 'adoptee' },
      { id: 'r3', numero: '3', titre: `Vote du budget prévisionnel de l'exercice ${Y + 1}`, majorite: 'Article 24', montant: 62000, vote: 'pour', resultat: 'adoptee' },
      { id: 'r4', numero: '4', titre: 'Montant de la cotisation au fonds de travaux', majorite: 'Article 25', montant: 3100, vote: 'pour', resultat: 'adoptee' },
      { id: 'r5', numero: '5', titre: 'Ravalement des façades sur rue et sur cour', majorite: 'Article 24', montant: 180000, vote: 'pour', resultat: 'adoptee', note: 'Entreprise retenue après trois devis présentés par le conseil syndical.' },
      { id: 'r6', numero: '6', titre: 'Installation de bornes de recharge au parking', majorite: 'Article 25', montant: 24000, vote: 'abstention', resultat: 'rejetee' },
      { id: 'r7', numero: '7', titre: 'Désignation des membres du conseil syndical', majorite: 'Article 25', vote: 'pour', resultat: 'adoptee' },
    ], note: 'Questions posées sur le contrat de chauffage : renégociation à l\'étude.' }, t);
    const agProchaine = R.normaliserAssemblee({ id: 'ag-prochaine', date: j(18), type: 'extraordinaire', lieu: 'Visioconférence et salle de la résidence', convocationRecue: j(-5), resolutions: [
      { id: 'p1', numero: '1', titre: 'Élection du président de séance', majorite: 'Article 24' },
      { id: 'p2', numero: '2', titre: 'Remplacement de la chaudière collective', majorite: 'Article 24', montant: 95000, vote: 'pour' },
      { id: 'p3', numero: '3', titre: 'Souscription d\'un emprunt collectif pour la chaudière', majorite: 'Article 26' },
      { id: 'p4', numero: '4', titre: 'Mandat au conseil syndical pour choisir l\'entreprise (dans la limite du budget voté)', majorite: 'Article 25' },
    ] }, t);
    const agAncienne = R.normaliserAssemblee({ id: 'ag-ancienne', date: j(-540), type: 'ordinaire', convocationRecue: j(-565), presence: 'correspondance', preparee: true, pvRecu: j(-510), resolutions: [
      { numero: '1', titre: `Approbation des comptes de l'exercice ${Y - 2}`, majorite: 'Article 24', vote: 'pour', resultat: 'adoptee' },
      { id: 'q2', numero: '2', titre: 'Remplacement de l\'interphone', majorite: 'Article 24', montant: 8400, vote: 'pour', resultat: 'adoptee' },
    ] }, t);
    c.assemblees = [agPassee, agProchaine, agAncienne];
    // Travaux votés.
    const qp = (m) => R.quotePart(c, m);
    const rav = R.normaliserTravaux({ id: 't-ravalement', nom: 'Ravalement des façades', assemblee: 'ag-passee', resolution: 'r5', montantTotal: 180000, quotePart: qp(180000), statut: 'encours', echeancier: [
      { id: 'tr-1', date: j(-100), montant: R.arrondi(qp(180000) * 0.4) }, { id: 'tr-2', date: j(10), montant: R.arrondi(qp(180000) * 0.3) }, { id: 'tr-3', date: j(100), montant: R.arrondi(qp(180000) - R.arrondi(qp(180000) * 0.4) - R.arrondi(qp(180000) * 0.3)) },
    ], note: 'Échafaudage prévu sur cour en premier.' });
    const inter = R.normaliserTravaux({ id: 't-interphone', nom: 'Remplacement de l\'interphone', assemblee: 'ag-ancienne', resolution: 'q2', montantTotal: 8400, quotePart: qp(8400), statut: 'termine', echeancier: [{ id: 'ti-1', date: j(-480), montant: qp(8400) }] });
    c.travaux = [rav, inter];
    c.appels.push(R.normaliserAppel({ id: 'a-rav-1', libelle: 'Appel travaux · ravalement (1/3)', echeance: j(-100), travaux: [{ travaux: 't-ravalement', echeance: 'tr-1', montant: rav.echeancier[0].montant }], payeLe: j(-96) }, debut, t));
    c.appels.push(R.normaliserAppel({ id: 'a-inter', libelle: 'Appel travaux · interphone', echeance: j(-480), travaux: [{ travaux: 't-interphone', echeance: 'ti-1', montant: inter.echeancier[0].montant }], payeLe: j(-475) }, debut, t));
    c.appels.push(R.normaliserAppel({ id: 'a-rav-2', libelle: 'Appel travaux · ravalement (2/3)', echeance: j(9), travaux: [{ travaux: 't-ravalement', echeance: 'tr-2', montant: rav.echeancier[1].montant }] }, debut, t));
    // Documents (référence de rangement, aucun fichier).
    const D = (nom, type, date, rangement, exercice = null) => R.normaliserDocument({ nom, type, date, rangement, exercice }, t);
    c.documents = [
      D('Règlement de copropriété et modificatifs', B.typesDocument[0], `${Y - 12}-03-15`, 'Classeur « Appartement », intercalaire 1'),
      D(`Convocation de l'AG extraordinaire`, B.typesDocument[1], j(-5), 'Dossier numérique « Copro / AG »', Y),
      D(`Procès-verbal de l'AG ordinaire ${Y}`, B.typesDocument[2], j(-140), 'Classeur « Appartement », intercalaire 2', Y),
      D(`Décompte des charges ${Y - 1}`, B.typesDocument[4], j(-190), 'Dossier numérique « Copro / Charges »', Y - 1),
      D(`Budget prévisionnel ${Y + 1}`, B.typesDocument[5], j(-196), 'Dossier numérique « Copro / Charges »', Y + 1),
      D('Contrat de syndic en cours', B.typesDocument[6], j(-170), 'Espace en ligne du syndic'),
      D('Devis retenu pour le ravalement', B.typesDocument[8], j(-200), 'Dossier numérique « Copro / Travaux »', Y),
    ];
    e.actif = c.id;
    return R.normaliser(e, t, B);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Copropriété · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="120" width="250" height="160" fill="#1D4E89"/>
          <path d="M20 120 L145 30 L270 120 Z" fill="#F5B400"/>
          <rect x="60" y="160" width="40" height="40" fill="#F0EDE6"/><rect x="125" y="160" width="40" height="40" fill="#F0EDE6"/><rect x="190" y="160" width="40" height="40" fill="#F0EDE6"/>
          <rect x="310" y="180" width="100" height="100" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="480" cy="110" r="70" fill="#D9302A"/>
          <path d="M480 110 L480 40 A70 70 0 0 1 550 110 Z" fill="#F0EDE6"/>
          <rect x="20" y="20" width="390" height="8" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Charges et AG de copropriété</p>
          <h1>Chaque appel payé à temps, chaque vote préparé.</h1>
          <p>Appels de fonds, charges par poste, régularisation, part récupérable sur le locataire, résolutions votées et travaux : ta copropriété lisible, d'une assemblée à l'autre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta copropriété</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma copropriété</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma copropriété'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>Ta copropriété, appel après appel.</h1>
      <p class="intro">Tu recopies ce que le syndic t'envoie (appels de fonds, décompte annuel, convocations) : l'application te prévient avant chaque échéance, calcule la régularisation et garde la trace des votes.</p>
      <form id="form-accueil" novalidate>
        <div class="rang-champs" style="max-width:680px">
          <label class="champ">Nom de la copropriété<small>Celui que tu utilises : « Résidence… », l'adresse sans numéro…</small><input name="nom" maxlength="100" placeholder="Ex. : Résidence Les Tilleuls"></label>
          <label class="champ">Syndic<small>Facultatif : nom du cabinet ou « syndic bénévole ».</small><input name="syndic" maxlength="100"></label>
        </div>
        <div class="rang-champs" style="max-width:680px">
          <label class="champ">Début de l'exercice<small>Lu sur le budget ou le décompte (souvent janvier).</small><select name="debut">${MOIS.map((m, i) => `<option value="${i + 1}" ${i === 0 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="champ">Tantièmes généraux de l'immeuble<small>Total, souvent 1 000 ou 10 000. Facultatif.</small><input name="total" inputmode="numeric" placeholder="Ex. : 10000"></label>
        </div>
        <div class="rang-champs" style="max-width:680px">
          <label class="champ">Ton premier lot<small>Facultatif : les autres s'ajoutent ensuite.</small><input name="lot" maxlength="60" placeholder="Ex. : Appartement B12"></label>
          <label class="champ">Ses tantièmes généraux<input name="tantiemes" inputmode="numeric" placeholder="Ex. : 412"></label>
        </div>
        <label class="case"><input type="checkbox" name="loue"> Ce lot est loué (calcul de la part récupérable sur le locataire)</label>
        <p class="erreur" role="alert"></p>
      </form>
      <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Commencer</button></div>
    </div>`;
  }

  function terminerAccueil() {
    const f = $('#form-accueil');
    const v = (n) => f.querySelector(`[name=${n}]`).value.trim();
    const total = R.lireNombre(v('total')), tant = R.lireNombre(v('tantiemes'));
    if (Number.isNaN(total) || Number.isNaN(tant)) { f.querySelector('.erreur').textContent = 'Tantièmes : un nombre entier est attendu.'; return; }
    if (total && tant && tant > total) { f.querySelector('.erreur').textContent = 'Les tantièmes du lot dépassent le total de l\'immeuble.'; return; }
    E = E && E.copros ? E : etatVide();
    const c = R.normaliserCopro({ nom: v('nom'), syndic: v('syndic'), debutExercice: v('debut'), tantiemesTotal: total, lots: v('lot') ? [{ nom: v('lot'), tantiemes: tant, loue: f.querySelector('[name=loue]').checked }] : [] }, B, auj());
    E.copros.push(c); E.actif = c.id;
    vue = 'appels';
    sauver();
    demarrer();
    toast('C\'est prêt : recopie le dernier appel de fonds reçu, ou génère les 4 appels de l\'exercice.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    appels: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    charges: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="5" height="9" fill="currentColor"/><rect x="10" y="6" width="5" height="15" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    ag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const COURTS = { tableau: 'Accueil', appels: 'Appels', ag: 'AG', documents: 'Documents' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['appels', 'Appels de fonds'], ['charges', 'Charges'], ['ag', 'AG et travaux'], ['documents', 'Documents']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/copropriete/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit" id="titre-produit">Copropriété</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  const ONGLET_DE = { assemblee: 'ag' };
  function rendre() {
    if (!E || !$('#vue')) return;
    if (!E.copros.length) return ecranAccueil();
    if (!E.copros.some((c) => c.id === E.actif)) E.actif = E.copros[0].id;
    if (vue === 'assemblee' && !assemblee(ouvert.assemblee)) vue = 'ag';
    const actif = ONGLET_DE[vue] || vue;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const tp = $('#titre-produit');
    if (tp) tp.innerHTML = E.copros.length > 1 ? `<label class="choix-copro"><span class="sr-only">Copropriété</span><select data-action="choix-copro">${E.copros.map((c) => `<option value="${c.id}" ${c.id === E.actif ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>` : 'Copropriété';
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${vue === 'assemblee' ? `AG du ${dateCourte(assemblee(ouvert.assemblee).date)}` : titres[vue]} · Copropriété`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, appels: vueAppels, charges: vueCharges, ag: vueAG, assemblee: vueAssemblee, documents: vueDocuments }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { qDocs = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, id = null) {
    if (v === 'assemblee') ouvert.assemblee = id;
    vue = v;
    history.replaceState(null, '', ONGLETS.some(([o]) => o === v) ? `#${v}` : location.pathname + location.search);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 40 L28 12 L56 40 Z" fill="#F5B400"/><circle cx="78" cy="74" r="18" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  const NIVEAU = { retard: ['rouge', 'En retard'], proche: ['jaune', 'Bientôt'], avenir: ['ciel', 'À venir'], paye: ['vert', 'Payé'] };
  const tuile = (lib, v, de, c, forme = '') => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(de || '')}</span></div>`;
  const barre = (v, max, couleur = 'var(--bleu)') => `<span class="jauge" aria-hidden="true"><span style="width:${max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0}%;background:${couleur}"></span></span>`;
  const quand = (d) => (d === auj() ? 'aujourd\'hui' : d < auj() ? `depuis le ${dateCourte(d)}` : `le ${dateCourte(d)}`);
  const detailAppel = (a) => [a.provisions ? `provisions ${euros(a.provisions, { centimes: true })}` : '', a.fondsTravaux ? `fonds de travaux ${euros(a.fondsTravaux, { centimes: true })}` : '', ...a.travaux.map((l) => `${travauxDe(l.travaux)?.nom || 'travaux'} ${euros(l.montant, { centimes: true })}`), a.autres ? `autres ${euros(a.autres, { centimes: true })}` : ''].filter(Boolean).join(' · ');
  const nomAppel = (a) => a.libelle || `Appel du ${dateCourte(a.echeance)}`;

  function libelleAlerte(x) {
    const c = E.copros.find((k) => k.id === x.copro);
    switch (x.type) {
      case 'appel': { const a = c.appels.find((k) => k.id === x.id); return { titre: `${nomAppel(a)} : ${euros(x.montant, { centimes: true })}`, detail: detailAppel(a), actions: [['payer', 'Payé', x.niveau === 'retard']], ouvrir: ['appel', x.id] }; }
      case 'travaux': { const t = c.travaux.find((k) => k.id === x.id); return { titre: `Échéance de travaux : ${t.nom}`, detail: `${euros(x.montant, { centimes: true })} prévus ${quand(x.date)} : pas encore d'appel noté. Recopie l'appel dès qu'il arrive.`, actions: [['appel-travaux', 'Noter l\'appel', false]], ouvrir: ['travaux', x.id], echeance: x.echeance }; }
      case 'ag': { const ag = c.assemblees.find((k) => k.id === x.id); return { titre: `${ag.type === 'extraordinaire' ? 'AG extraordinaire' : 'AG'} à préparer`, detail: `${pluriel(ag.resolutions.length, 'résolution')} à l'ordre du jour${x.sansIntention ? `, ${x.sansIntention} sans ton intention de vote` : ''}${ag.presence ? '' : ' · présence ou pouvoir à décider'}.`, actions: [['preparer', 'Préparer', false]], ouvrir: ['assemblee', x.id] }; }
      case 'resultats': return { titre: 'Résultats de l\'AG à noter', detail: `${pluriel(x.nb, 'résolution')} sans résultat : reprends le procès-verbal.`, actions: [['preparer', 'Noter', false]], ouvrir: ['assemblee', x.id] };
      case 'regularisation': return { titre: `Régularisation ${R.libelleExercice(x.annee, c.debutExercice)} : ${x.montant > 0 ? `${euros(x.montant, { centimes: true })} à payer` : `${euros(-x.montant, { centimes: true })} à recevoir`}`, detail: `Comptes approuvés le ${dateCourte(x.date)}. Charges réelles comparées aux provisions appelées.`, actions: [['regle', 'Réglée', false]], ouvrir: ['charges', x.annee] };
      default: return { titre: '', detail: '', actions: [] };
    }
  }
  function ligneAlerte(x, { avecCopro = false } = {}) {
    const l = libelleAlerte(x);
    const [cl, lib] = ['regularisation', 'resultats'].includes(x.type) ? ['jaune', 'À faire'] : NIVEAU[x.niveau];
    const c = E.copros.find((k) => k.id === x.copro);
    return `<li class="echeance niv-${x.niveau}">
      <button class="ech-corps" data-action="ouvrir-alerte" data-quoi="${l.ouvrir[0]}" data-id="${esc(l.ouvrir[1])}" data-copro="${c.id}">
        <span class="ech-tete"><span class="etiquette ${cl}">${lib}</span><b>${esc(l.titre)}</b>${x.date && x.type !== 'regularisation' ? `<span class="ech-date">${quand(x.date)}</span>` : ''}</span>
        ${avecCopro ? `<span class="ech-dossier">${esc(c.nom)}</span>` : ''}
        <span class="ech-detail">${esc(l.detail)}</span>
      </button>
      <span class="ech-actions">${l.actions.map(([a, lb, prim]) => `<button class="btn petit ${prim ? 'primaire' : ''}" data-action="al-${a}" data-id="${esc(x.id)}" data-copro="${c.id}" ${l.echeance ? `data-echeance="${l.echeance}"` : ''} ${x.annee ? `data-annee="${x.annee}"` : ''}>${lb}</button>`).join('')}</span>
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const c = C();
    const t = auj();
    const exC = exCourant();
    const toutes = R.alertes(E, B, t);
    const ici = toutes.filter((x) => x.copro === c.id);
    const ailleurs = toutes.filter((x) => x.copro !== c.id && x.niveau !== 'avenir');
    const urgentes = ici.filter((x) => x.niveau !== 'avenir');
    const nonPayes = c.appels.filter((a) => !a.payeLe);
    const prochain = R.trierAppels(nonPayes)[0];
    const s = R.syntheseExercice(c, exC, t);
    const dernier = [...c.exercices].filter((e) => e.charges.length).sort((a, b) => b.annee - a.annee)[0];
    const sd = dernier ? R.syntheseExercice(c, dernier.annee, t) : null;
    const ag = R.prochaineAssemblee(c, t);
    const p = R.part(c);
    const tuiles = [
      tuile('À payer', euros(R.somme(nonPayes, R.totalAppel)), prochain ? (prochain.echeance < t ? `dont ${euros(R.somme(nonPayes.filter((a) => a.echeance < t), R.totalAppel))} en retard` : `prochain : ${euros(R.totalAppel(prochain))} ${quand(prochain.echeance)}`) : 'aucun appel en attente', 'var(--rouge)'),
      tuile(`Appelé ${ex(exC)}`, euros(s.appele), `dont ${euros(s.provisions)} de provisions et ${euros(s.fondsTravaux)} de fonds de travaux`, 'var(--bleu)', 'rond'),
      tuile(dernier ? `Charges réelles ${ex(dernier.annee)}` : 'Charges réelles', sd ? euros(sd.charges) : '–', sd ? (sd.regularisation === null || !sd.nbAppels ? 'provisions non saisies' : sd.regularisation > 0 ? `régularisation : ${euros(sd.regularisation)} à payer` : sd.regularisation < 0 ? `régularisation : ${euros(-sd.regularisation)} à recevoir` : 'égales aux provisions') : 'décompte annuel à saisir', 'var(--jaune)'),
      tuile('Récupérable sur le locataire', sd && R.aLoue(c) ? euros(sd.recuperable) : '–', R.aLoue(c) ? (sd ? `${pct(sd.charges ? (sd.recuperable / sd.charges) * 100 : null)} des charges ${ex(dernier.annee)}` : 'après le décompte annuel') : 'aucun lot loué', 'var(--vert)', 'rond'),
    ].join('');
    return `
      <div class="vue-tete"><div><h1>${esc(c.nom)}</h1><p>${c.syndic ? `Syndic : ${esc(c.syndic)} · ` : ''}${pluriel(c.lots.length, 'lot')}${p !== null ? ` · ${R.tantiemesLots(c).toLocaleString('fr-FR')} / ${c.tantiemesTotal.toLocaleString('fr-FR')} tantièmes (${pct(p * 100, 2)})` : ''} · exercice ${ex(exC)}</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvel-appel">${ICONES.plus}Appel de fonds</button><button class="btn" data-action="copro">Copropriété et lots</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À traiter <span>${urgentes.length ? `${pluriel(urgentes.length, 'point')}` : ''}</span></h2>
          ${urgentes.length ? `<ul class="liste-echeances">${urgentes.map((x) => ligneAlerte(x)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Rien d'urgent</h3><p>Aucun appel en retard ni dans les ${E.reglages.alerte} prochains jours, aucune AG à préparer.${prochain ? ` Prochain appel ${quand(prochain.echeance)}.` : ''}</p></div></div>`}
          ${ailleurs.length ? `<p class="aide">Aussi ${pluriel(ailleurs.length, 'point')} dans ${E.copros.length > 2 ? 'tes autres copropriétés' : 'ton autre copropriété'} : <button class="lien-inline" data-action="choix-copro-id" data-id="${ailleurs[0].copro}">voir</button>.</p>` : ''}
        </section>
        <section>
          <h2 class="titre-section">Prochaine assemblée</h2>
          ${ag ? `<button class="carte-ag" data-action="assemblee" data-id="${ag.id}"><span class="surtitre">${esc(B.typesAG.find((x) => x.id === ag.type).nom)}</span><b>${dateLongue(ag.date)}</b><span>${pluriel(ag.resolutions.length, 'résolution')} · ${ag.preparee ? 'préparée' : `${R.sansIntention(ag)} sans intention de vote`}${ag.convocationRecue ? ` · convocation reçue le ${dateCourte(ag.convocationRecue)}` : ''}</span></button>` : `<div class="vide-etat petit"><div><h3>Aucune AG à venir</h3><p>À réception d'une convocation, note la date et l'ordre du jour.</p><div class="actions"><button class="btn petit" data-action="nouvelle-ag">${ICONES.plus}Assemblée</button></div></div></div>`}
          <h2 class="titre-section">Tes lots <span>${p !== null ? `quote-part ${pct(p * 100, 2)}` : 'tantièmes de l\'immeuble à saisir'}</span></h2>
          ${c.lots.length ? `<ul class="liste-lots">${c.lots.map((l) => `<li><span><b>${esc(l.nom)}</b><small>${esc(B.typesLot.find((x) => x.id === l.type)?.nom || '')}${l.numero ? ` · lot n° ${esc(l.numero)}` : ''}${l.loue ? ' · loué' : ''}</small></span><span class="nb">${l.tantiemes.toLocaleString('fr-FR')} tantièmes</span></li>`).join('')}</ul>` : '<p class="aide">Aucun lot saisi.</p>'}
          <div class="rang"><button class="btn petit" data-action="copro">Modifier les lots</button></div>
        </section>
      </div>
      <p class="mention avertissement">Outil d'aide : le règlement de copropriété, les décisions d'assemblée et les documents du syndic font foi. Il ne remplace pas un conseil juridique. Montants saisis par toi, aucune règle de majorité intégrée.</p>`;
  }

  // ---------- Appels de fonds ----------
  function vueAppels() {
    const c = C();
    const t = auj();
    const annees = R.anneesCopro(c, t);
    const annee = anneeAppels === 'tous' ? 'tous' : (anneeAppels && annees.includes(anneeAppels) ? anneeAppels : exCourant());
    const liste = R.trierAppels(c.appels.filter((a) => annee === 'tous' || a.exercice === annee));
    const aPayer = liste.filter((a) => !a.payeLe), payes = liste.filter((a) => a.payeLe).reverse();
    const tete = `<div class="vue-tete"><div><h1>Appels de fonds</h1><p>Chaque appel du syndic : provisions du budget, fonds de travaux, travaux votés. Coche-le payé le jour du virement.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvel-appel">${ICONES.plus}Appel</button><button class="btn" data-action="generer">Appels de l'exercice</button>${c.appels.length ? '<button class="btn" data-action="csv-appels">CSV</button>' : ''}</div></div>`;
    if (!c.appels.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun appel de fonds</h3><p>Recopie le dernier appel reçu du syndic, ou génère d'un coup les 4 appels trimestriels de l'exercice à partir du budget voté (ta quote-part).</p><div class="actions"><button class="btn primaire" data-action="generer">Générer les appels de l'exercice</button><button class="btn" data-action="nouvel-appel">${ICONES.plus}Un appel</button></div></div></div>`;
    const tot = { appele: R.somme(liste, R.totalAppel), paye: R.somme(payes, R.totalAppel), reste: R.somme(aPayer, R.totalAppel), fonds: R.somme(liste, (a) => a.fondsTravaux), travaux: R.somme(liste, R.totalTravauxAppel) };
    const ligne = (a) => {
      const e = R.etatAppel(a, t, E.reglages.alerte);
      const [cl, lib] = NIVEAU[e];
      return `<li class="ligne-appel niv-${e}">
        <button class="la-corps" data-action="appel" data-id="${a.id}">
          <span class="la-date nb">${dateCourte(a.echeance)}</span>
          <span class="la-titre"><b>${esc(nomAppel(a))}</b><small>${esc(detailAppel(a)) || 'Montant à saisir'}</small></span>
          <span class="la-montant nb">${euros(R.totalAppel(a), { centimes: true })}</span>
        </button>
        <span class="la-etat">${a.payeLe ? `<span class="etiquette vert">Payé le ${dateCourte(a.payeLe)}</span>` : `<span class="etiquette ${cl}">${lib}</span><button class="btn petit ${e === 'retard' ? 'primaire' : ''}" data-action="payer" data-id="${a.id}">Payé</button>`}</span>
      </li>`;
    };
    return `${tete}
      <div class="choix-annee" role="group" aria-label="Exercice">${annees.map((a) => `<button class="filtre" data-action="annee-appels" data-annee="${a}" aria-pressed="${a === annee}">${ex(a)}</button>`).join('')}<button class="filtre" data-action="annee-appels" data-annee="tous" aria-pressed="${annee === 'tous'}">Tous</button></div>
      <div class="tuiles">
        ${tuile('Appelé', euros(tot.appele), annee === 'tous' ? pluriel(liste.length, 'appel') : `${pluriel(liste.length, 'appel')} en ${ex(annee)}`, 'var(--bleu)')}
        ${tuile('Payé', euros(tot.paye), tot.appele ? `${pct((tot.paye / tot.appele) * 100)} de l'appelé` : '', 'var(--vert)', 'rond')}
        ${tuile('Reste à payer', euros(tot.reste), aPayer.length ? `${pluriel(aPayer.length, 'appel')} en attente` : 'tout est payé', 'var(--rouge)')}
        ${tuile('Fonds et travaux', euros(tot.fonds + tot.travaux), `fonds de travaux ${euros(tot.fonds)} · travaux votés ${euros(tot.travaux)}`, 'var(--jaune)', 'rond')}
      </div>
      ${aPayer.length ? `<h2 class="titre-section">À payer <span>${euros(tot.reste, { centimes: true })}</span></h2><ul class="liste-appels">${aPayer.map(ligne).join('')}</ul>` : ''}
      ${payes.length ? `<h2 class="titre-section">Payés <span>${pluriel(payes.length, 'appel')}</span></h2><ul class="liste-appels">${payes.map(ligne).join('')}</ul>` : ''}
      ${!liste.length ? `<div class="vide-etat petit"><div><h3>Aucun appel en ${ex(annee)}</h3><p>Choisis un autre exercice ou génère les appels de celui-ci.</p></div></div>` : ''}
      <p class="mention avertissement">Les montants sont ta quote-part, telle qu'écrite sur l'appel du syndic. ${E.reglages.rappels ? `${esc(B.regles.provisions.texte)} Source : ${esc(sourceCourte('F20586'))}.` : ''}</p>`;
  }

  // ---------- Graphiques (charges) ----------
  // Barres horizontales d'une seule série : la répartition d'un exercice par poste, triée, valeurs écrites.
  function grapheRepartition(rep) {
    const max = Math.max(1, ...rep.map((x) => x.montant));
    return `<ul class="barres-postes" role="list">${rep.map((x) => `<li tabindex="0" data-info="${esc(`${x.nom}\n${euros(x.montant, { centimes: true })} · ${pct(x.part, 1)} du total${x.variation !== null ? `\n${x.variation > 0 ? '+' : ''}${pct(x.variation, 1)} sur un an` : ''}${x.recupPct ? `\nrécupérable ${pct(x.recupPct)} : ${euros(x.recuperable, { centimes: true })}` : ''}`)}">
      <span class="bp-nom">${esc(x.nom)}</span>
      <span class="bp-barre"><span style="width:${Math.max(0.5, (Math.max(0, x.montant) / max) * 100)}%;background:${COUL_CHARGES}"></span></span>
      <span class="bp-val nb">${euros(x.montant)} <small>${pct(x.part)}</small></span></li>`).join('')}</ul>`;
  }
  // Colonnes groupées par exercice : provisions appelées et charges réelles (deux séries, même échelle, légende).
  function grapheEvolution(evo) {
    const tel = estTel();
    const dispo = ($('#vue')?.clientWidth || innerWidth) - 40;
    const W = Math.round(Math.max(300, Math.min(760, tel ? dispo : innerWidth > 1020 ? dispo / 2 - 20 : dispo))), H = tel ? 230 : 260, g = 44, d = 8, h = 28, b = 30;
    const max = Math.max(1, ...evo.flatMap((x) => [x.charges || 0, x.provisions || 0]));
    const pas = (() => { const brut = max / 4; const p10 = 10 ** Math.floor(Math.log10(brut)); return [1, 2, 2.5, 5, 10].map((m) => m * p10).find((m) => m >= brut); })();
    const haut = Math.ceil(max / pas) * pas;
    const y = (v) => H - b - ((H - b - h) * v) / haut;
    const larg = (W - g - d) / evo.length;
    const bw = Math.min(28, (larg - 14) / 2);
    const col = (x, v, c) => { if (v === null || v <= 0) return ''; const top = y(v), r = Math.min(4, (y(0) - top) / 2); return `<path d="M${x} ${y(0)} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + bw - r} Q${x + bw} ${top} ${x + bw} ${top + r} V${y(0)} Z" fill="${c}"/>`; };
    const grille = [];
    for (let v = 0; v <= haut + 0.001; v += pas) grille.push(`<line x1="${g}" x2="${W - d}" y1="${y(v)}" y2="${y(v)}" stroke="var(--trait)" stroke-width="1"/><text x="${g - 6}" y="${y(v) + 4}" text-anchor="end" class="axe">${v >= 1000 ? `${(v / 1000).toLocaleString('fr-FR')} k€` : `${v} €`}</text>`);
    const dernier = evo[evo.length - 1];
    const groupes = evo.map((x, i) => {
      const x0 = g + i * larg + (larg - 2 * bw - 2) / 2;
      const info = `Exercice ${ex(x.annee)}\nProvisions appelées : ${euros(x.provisions)}\nCharges réelles : ${x.charges === null ? 'non saisies' : euros(x.charges)}${x.regularisation !== null && x.provisions !== null ? `\nRégularisation : ${x.regularisation > 0 ? '+' : ''}${euros(x.regularisation)}` : ''}`;
      return `<g class="colonne" tabindex="0" data-info="${esc(info)}"><rect x="${g + i * larg}" y="${h}" width="${larg}" height="${H - b - h}" fill="transparent"/>${col(x0, x.provisions, COUL_PROV)}${col(x0 + bw + 2, x.charges, COUL_CHARGES)}
        <text x="${g + i * larg + larg / 2}" y="${H - b + 18}" text-anchor="middle" class="axe">${ex(x.annee)}</text>
        ${x === dernier && x.charges !== null ? `<text x="${x0 + bw * 1.5 + 2}" y="${y(x.charges) - 6}" text-anchor="middle" class="etiq">${euros(x.charges)}</text>` : ''}</g>`;
    }).join('');
    return `<p class="legende" style="margin:0 0 6px"><span><i style="background:${COUL_PROV}"></i>Provisions appelées</span><span><i style="background:${COUL_CHARGES}"></i>Charges réelles</span></p>
      <svg class="graphe-evo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Provisions appelées et charges réelles par exercice : ${evo.map((x) => `${ex(x.annee)} ${euros(x.provisions)} et ${x.charges === null ? 'non saisies' : euros(x.charges)}`).join(' ; ')}">${grille.join('')}${groupes}<line x1="${g}" x2="${W - d}" y1="${y(0)}" y2="${y(0)}" stroke="var(--discret)" stroke-width="1"/></svg>`;
  }

  // ---------- Charges ----------
  function vueCharges() {
    const c = C();
    const t = auj();
    const annees = R.anneesCopro(c, t);
    const avecCharges = c.exercices.filter((e) => e.charges.length).map((e) => e.annee).sort((a, b) => b - a);
    const annee = anneeCharges && annees.includes(anneeCharges) ? anneeCharges : (avecCharges[0] ?? exCourant());
    const s = R.syntheseExercice(c, annee, t);
    const rep = R.repartition(c, annee, B);
    const evo = R.evolution(c, t);
    const mat = R.matricePostes(c, B);
    const loue = R.aLoue(c);
    const e = R.exerciceDe(c, annee);
    const tete = `<div class="vue-tete"><div><h1>Charges</h1><p>Le décompte annuel du syndic, poste par poste : régularisation, part récupérable sur le locataire, évolution d'un exercice à l'autre.</p></div>
      <div class="actions"><button class="btn primaire" data-action="decompte" data-annee="${annee}">Décompte ${ex(annee)}</button><button class="btn" data-action="recup">Part récupérable</button>${s.chargesSaisies ? `<button class="btn" data-action="imprimer-decompte" data-annee="${annee}">Imprimer</button>` : ''}</div></div>`;
    const reg = s.regularisation;
    const tuiles = [
      tuile('Provisions appelées', euros(s.provisions), s.nbAppels ? `${pluriel(s.nbAppels, 'appel')} sur l'exercice ${ex(annee)}` : 'aucun appel saisi', COUL_PROV),
      tuile('Charges réelles', s.chargesSaisies ? euros(s.charges) : '–', s.chargesSaisies ? `${pluriel(rep.length, 'poste')}${e?.approuveLe ? ` · comptes approuvés le ${dateCourte(e.approuveLe)}` : ''}` : 'décompte à saisir', COUL_CHARGES, 'rond'),
      tuile('Régularisation', reg === null || !s.nbAppels ? '–' : euros(Math.abs(reg)), reg === null ? 'après le décompte' : !s.nbAppels ? 'provisions non saisies' : reg > 0 ? `à payer${e?.regleLe ? `, réglée le ${dateCourte(e.regleLe)}` : ''}` : reg < 0 ? `à recevoir${e?.regleLe ? `, réglée le ${dateCourte(e.regleLe)}` : ''}` : 'aucune', 'var(--jaune)'),
      tuile('Récupérable', s.chargesSaisies ? euros(s.recuperable) : '–', loue ? (s.charges ? `${pct((s.recuperable / s.charges) * 100)} des charges · non récupérable ${euros(s.nonRecuperable)}` : '') : 'aucun lot loué : pour information', 'var(--vert)', 'rond'),
    ].join('');
    const fonds = E.reglages.rappels && s.tauxFonds !== null && s.fondsTravaux >= 0;
    return `${tete}
      <div class="choix-annee" role="group" aria-label="Exercice">${annees.map((a) => `<button class="filtre" data-action="annee-charges" data-annee="${a}" aria-pressed="${a === annee}">${ex(a)}</button>`).join('')}</div>
      <div class="tuiles">${tuiles}</div>
      ${s.chargesSaisies && s.nbAppels && reg !== null && reg !== 0 && e ? `<div class="bandeau-regul ${e.regleLe ? 'fait' : ''}"><p><b>${reg > 0 ? `Complément à payer : ${euros(reg, { centimes: true })}` : `Trop-versé à recevoir : ${euros(-reg, { centimes: true })}`}</b><span>Charges réelles ${euros(s.charges, { centimes: true })} − provisions appelées ${euros(s.provisions, { centimes: true })}. Le montant exact figure sur le décompte du syndic (il peut y imputer d'autres sommes).</span></p>${e.regleLe ? `<span class="etiquette vert">Réglée le ${dateCourte(e.regleLe)}</span>` : `<button class="btn petit primaire" data-action="al-regle" data-id="${e.id}" data-copro="${c.id}">Réglée</button>`}</div>` : ''}
      ${s.chargesSaisies ? `
      <div class="colonnes-charges">
        <section>
          <h2 class="titre-section">Répartition par poste <span>${ex(annee)} · ${euros(s.charges)}</span></h2>
          <div class="graphique">${grapheRepartition(rep)}
            <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Poste</th><th class="nb">Montant</th><th class="nb">Part</th><th class="nb">Sur un an</th><th class="nb">Récupérable</th></tr></thead><tbody>${rep.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${euros(x.montant, { centimes: true })}</td><td class="nb">${pct(x.part, 1)}</td><td class="nb">${x.variation === null ? '–' : `${x.variation > 0 ? '+' : ''}${pct(x.variation, 1)}`}</td><td class="nb">${x.recupPct ? `${euros(x.recuperable, { centimes: true })} <small>(${pct(x.recupPct)})</small>` : '–'}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${euros(s.charges, { centimes: true })}</td><td></td><td></td><td class="nb">${euros(s.recuperable, { centimes: true })}</td></tr></tfoot></table></div></details>
          </div>
        </section>
        <section>
          <h2 class="titre-section">Évolution <span>${evo.length > 1 ? `${ex(evo[0].annee)} à ${ex(evo[evo.length - 1].annee)}` : 'un seul exercice saisi'}</span></h2>
          <div class="graphique">${evo.length ? grapheEvolution(evo) : ''}
            ${mat.annees.length ? `<details class="tableau-details"><summary>Voir le tableau par poste</summary><div class="defile"><table class="tableau"><thead><tr><th>Poste</th>${mat.annees.map((a) => `<th class="nb">${ex(a)}</th>`).join('')}</tr></thead><tbody>${mat.lignes.map((l) => `<tr><td>${esc(l.nom)}</td>${l.valeurs.map((v) => `<td class="nb">${v === null ? '–' : euros(v)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td>Charges réelles</td>${mat.totaux.map((v) => `<td class="nb">${euros(v)}</td>`).join('')}</tr><tr><td>Provisions appelées</td>${mat.annees.map((a) => `<td class="nb">${euros(R.syntheseExercice(c, a).provisions)}</td>`).join('')}</tr></tfoot></table></div></details>` : ''}
          </div>
        </section>
      </div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Décompte ${ex(annee)} pas encore saisi</h3><p>À réception du décompte annuel (souvent avec la convocation à l'AG), recopie ta quote-part poste par poste : la régularisation et la part récupérable se calculent.</p><div class="actions"><button class="btn primaire" data-action="decompte" data-annee="${annee}">Saisir le décompte</button></div></div></div>
        ${evo.length > 1 ? `<h2 class="titre-section">Évolution <span>exercices saisis</span></h2><div class="graphique">${grapheEvolution(evo)}</div>` : ''}`}
      ${E.reglages.rappels ? `<section class="rappels"><h2 class="titre-section">Repères <span>indicatifs</span></h2><ul>
        ${fonds ? `<li><b>Fonds de travaux : ${pct(s.tauxFonds, 1)} de tes provisions ${ex(annee)}</b><span>${esc(B.regles.fondsTravaux.texte)} ${s.tauxFonds < B.regles.fondsTravaux.taux ? 'Ton rapport est sous 5 % : vérifie avec le syndic ou le conseil syndical (calcul sur ta quote-part, les clés de répartition peuvent différer).' : 'Calcul sur ta quote-part, à titre indicatif.'}</span><small>Source : ${esc(sourceCourte('F34026'))}.</small></li>` : ''}
        <li><b>Charges récupérables sur le locataire</b><span>${esc(B.regles.recuperables.texte)} Les parts par poste sont celles que tu saisis (« Part récupérable »), l'aide ne fait que proposer.</span><small>Source : ${esc(sourceCourte('F947'))}.</small></li>
      </ul><p class="mention">Outil d'aide, pas un conseil juridique : le règlement de copropriété, le décompte du syndic et le bail font foi. Désactivable dans les Réglages.</p></section>` : ''}`;
  }

  // ---------- AG et travaux ----------
  const ETAT_AG = { apreparer: ['jaune', 'À préparer'], preparee: ['vert', 'Préparée'], avenir: ['ciel', 'À venir'], aujourdhui: ['jaune', 'Aujourd\'hui'], resultats: ['rose', 'Résultats à noter'], tenue: ['sable', 'Tenue'] };
  const CL_RES = { adoptee: 'vert', rejetee: 'rose', ajournee: 'sable', retiree: 'sable', attente: 'jaune', avenir: 'ciel' };
  function vueAG() {
    const c = C();
    const t = auj();
    const ags = R.trierAssemblees(c.assemblees);
    const aVenir = ags.filter((a) => a.date >= t).reverse(), passees = ags.filter((a) => a.date < t);
    const carte = (ag) => {
      const st = R.etatAssemblee(ag, t, E.reglages.alerteAG);
      const [cl, lib] = ETAT_AG[st];
      const ad = ag.resolutions.filter((r) => r.resultat === 'adoptee').length, rej = ag.resolutions.filter((r) => r.resultat === 'rejetee').length;
      return `<li><button class="carte-ag" data-action="assemblee" data-id="${ag.id}"><span class="surtitre">${esc(B.typesAG.find((x) => x.id === ag.type).nom)}</span><b>${dateLongue(ag.date)}</b>
        <span><span class="etiquette ${cl}">${lib}</span> ${pluriel(ag.resolutions.length, 'résolution')}${ad || rej ? ` · ${ad} adoptée${ad > 1 ? 's' : ''}, ${rej} rejetée${rej > 1 ? 's' : ''}` : ''}${ag.presence ? ` · ${esc(B.presences.find((p) => p.id === ag.presence).nom.toLowerCase())}` : ''}</span></button></li>`;
    };
    const tete = `<div class="vue-tete"><div><h1>Assemblées générales et travaux</h1><p>Convocation, ordre du jour, majorité lue dans la convocation, ton vote et le résultat ; puis les travaux votés et leur échéancier.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvelle-ag">${ICONES.plus}Assemblée</button><button class="btn" data-action="nouveaux-travaux">${ICONES.plus}Travaux</button>${ags.length ? '<button class="btn" data-action="csv-resolutions">CSV</button>' : ''}</div></div>`;
    const travaux = [...c.travaux].sort((a, b) => R.STATUTS_TRAVAUX.indexOf(a.statut) - R.STATUTS_TRAVAUX.indexOf(b.statut) || a.nom.localeCompare(b.nom, 'fr'));
    return `${tete}
      ${ags.length ? `${aVenir.length ? `<h2 class="titre-section">À venir</h2><ul class="cartes-ag">${aVenir.map(carte).join('')}</ul>` : ''}${passees.length ? `<h2 class="titre-section">Tenues <span>${pluriel(passees.length, 'assemblée')}</span></h2><ul class="cartes-ag">${passees.map(carte).join('')}</ul>` : ''}`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune assemblée</h3><p>À réception de la convocation, note la date et recopie l'ordre du jour (une résolution par ligne) : tu prépares ton vote, puis tu notes le résultat lu dans le procès-verbal.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-ag">${ICONES.plus}Première assemblée</button></div></div></div>`}
      <h2 class="titre-section">Travaux votés <span>${travaux.length ? `ta quote-part : ${euros(R.somme(travaux.filter((x) => x.statut !== 'abandonne'), (x) => x.quotePart))}` : ''}</span></h2>
      ${travaux.length ? `<div class="cartes-travaux">${travaux.map(carteTravaux).join('')}</div>` : '<div class="vide-etat petit"><div><h3>Aucuns travaux</h3><p>Une résolution de travaux adoptée se transforme en travaux suivis (bouton « Suivre les travaux » sur la résolution), avec ta quote-part et l\'échéancier des appels.</p></div></div>'}
      <p class="mention avertissement">Aucune règle de majorité n'est intégrée : la majorité affichée est celle que tu as lue dans la convocation, le résultat celui du procès-verbal. Le règlement de copropriété et le procès-verbal font foi.</p>`;
  }
  function carteTravaux(tr) {
    const c = C();
    const s = R.suiviTravaux(c, tr);
    const ag = tr.assemblee ? assemblee(tr.assemblee) : null;
    const t = auj();
    return `<section class="carte-travaux st-${tr.statut}">
      <div class="cf-tete"><div><p class="cf-type">${R.LIB_TRAVAUX[tr.statut]}${ag ? ` · voté le ${dateCourte(ag.date)}` : ''}</p><h3>${esc(tr.nom)}</h3>${tr.montantTotal ? `<p>Montant voté ${euros(tr.montantTotal)} pour la copropriété</p>` : ''}</div><button class="btn petit" data-action="travaux" data-id="${tr.id}">Modifier</button></div>
      <p class="cf-chiffres"><span>Ta quote-part <b>${euros(tr.quotePart, { centimes: true })}</b></span><span>appelé <b>${euros(s.appele)}</b></span><span>payé <b>${euros(s.paye)}</b></span></p>
      ${barre(s.paye, tr.quotePart, 'var(--vert)')}
      ${s.echeances.length ? `<ul class="liste-echeancier">${s.echeances.map((e) => `<li><span class="nb">${e.date ? dateCourte(e.date) : 'date à préciser'}</span><b class="nb">${euros(e.montant, { centimes: true })}</b>${e.payeLe ? '<span class="etiquette vert">Payé</span>' : e.appel ? '<span class="etiquette ciel">Appelé</span>' : `<span class="etiquette ${e.date && e.date < t ? 'rose' : 'sable'}">Pas encore appelé</span>`}</li>`).join('')}</ul>` : '<p class="aide">Aucun échéancier : note les dates d\'appel votées (« Modifier »).</p>'}
      ${s.sansEcheancier > 0 && s.echeances.length ? `<p class="aide">${euros(s.sansEcheancier, { centimes: true })} de ta quote-part sans échéance saisie.</p>` : ''}
    </section>`;
  }

  function vueAssemblee() {
    const c = C();
    const ag = assemblee(ouvert.assemblee);
    const t = auj();
    const st = R.etatAssemblee(ag, t, E.reglages.alerteAG);
    const [cl, lib] = ETAT_AG[st];
    const avenir = ag.date > t;
    const lien = (r) => c.travaux.find((x) => x.resolution === r.id);
    return `
      <button class="btn lien retour" data-action="vue" data-vue="ag">← Assemblées et travaux</button>
      <div class="vue-tete"><div><p class="surtitre">${esc(B.typesAG.find((x) => x.id === ag.type).nom)}</p><h1>${dateLongue(ag.date)}</h1><p><span class="etiquette ${cl}">${lib}</span>${ag.lieu ? ` ${esc(ag.lieu)}` : ''}</p></div>
        <div class="actions">${avenir && !ag.preparee ? `<button class="btn primaire" data-action="ag-preparee" data-id="${ag.id}">Marquer préparée</button>` : ''}<button class="btn" data-action="modifier-ag" data-id="${ag.id}">Modifier</button><button class="btn" data-action="nouvelle-resolution" data-id="${ag.id}">${ICONES.plus}Résolution</button><button class="btn" data-action="imprimer-ag" data-id="${ag.id}">Imprimer</button></div></div>
      <ul class="etapes-dossier etapes-ag">
        <li class="${ag.convocationRecue ? 'fait' : ''}"><span>Convocation reçue</span><b>${ag.convocationRecue ? dateCourte(ag.convocationRecue) : '–'}</b></li>
        <li class="${ag.presence ? 'fait' : ''}"><span>Ta participation</span><b>${ag.presence ? esc(B.presences.find((p) => p.id === ag.presence).nom) : 'à décider'}</b></li>
        <li class="${ag.preparee ? 'fait' : ''}"><span>Vote préparé</span><b>${ag.preparee ? 'oui' : `${R.sansIntention(ag)} sans intention`}</b></li>
        <li class="${ag.pvRecu ? 'fait' : ''}"><span>Procès-verbal reçu</span><b>${ag.pvRecu ? dateCourte(ag.pvRecu) : '–'}</b></li>
      </ul>
      <h2 class="titre-section">Ordre du jour <span>${pluriel(ag.resolutions.length, 'résolution')}</span></h2>
      ${ag.resolutions.length ? `<ol class="liste-resolutions">${ag.resolutions.map((r) => {
        const er = R.etatResolution(ag, r, t);
        const tr = lien(r);
        return `<li class="resolution">
          <div class="res-tete"><span class="res-num nb">${esc(r.numero)}</span><div class="res-titre"><button class="lien-ligne" data-action="resolution" data-id="${ag.id}" data-res="${r.id}"><b>${esc(r.titre)}</b></button><small>${r.majorite ? `Majorité : ${esc(r.majorite)} (lue dans la convocation)` : 'Majorité non saisie'}${r.montant ? ` · ${euros(r.montant)} pour la copropriété${R.part(c) !== null ? `, soit environ ${euros(R.quotePart(c, r.montant))} pour toi` : ''}` : ''}</small>${r.note ? `<small>${esc(r.note)}</small>` : ''}</div><span class="etiquette ${CL_RES[er]}">${R.LIB_RESULTAT[er]}</span></div>
          <div class="res-choix">
            <label class="champ champ-filtre"><span>${avenir ? 'Mon intention' : 'Mon vote'}</span><select data-action="vote" data-id="${ag.id}" data-res="${r.id}"><option value="">${avenir ? 'À décider' : 'Non noté'}</option>${R.VOTES.map((v) => `<option value="${v}" ${r.vote === v ? 'selected' : ''}>${R.LIB_VOTE[v]}</option>`).join('')}</select></label>
            <label class="champ champ-filtre"><span>Résultat</span><select data-action="resultat" data-id="${ag.id}" data-res="${r.id}"><option value="">${avenir ? 'Après l\'AG' : 'À noter'}</option>${R.RESULTATS.map((v) => `<option value="${v}" ${r.resultat === v ? 'selected' : ''}>${R.LIB_RESULTAT[v]}</option>`).join('')}</select></label>
            ${tr ? `<button class="btn petit" data-action="travaux" data-id="${tr.id}">Travaux suivis</button>` : r.resultat === 'adoptee' && r.montant ? `<button class="btn petit primaire" data-action="suivre-travaux" data-id="${ag.id}" data-res="${r.id}">Suivre les travaux</button>` : ''}
          </div>
        </li>`;
      }).join('')}</ol>` : '<div class="vide-etat petit"><div><h3>Ordre du jour vide</h3><p>Recopie les résolutions de la convocation (« Modifier » permet d\'en coller plusieurs, une par ligne).</p></div></div>'}
      ${ag.note ? `<h2 class="titre-section">Notes</h2><p class="note-dossier">${esc(ag.note)}</p>` : ''}
      <p class="mention avertissement">Aucune règle de majorité n'est calculée : la majorité vient de la convocation, le résultat du procès-verbal. Ta part estimée suit tes tantièmes généraux ; la clé réelle (charges spéciales, bâtiment…) est celle du syndic.</p>`;
  }

  // ---------- Documents ----------
  function vueDocuments() {
    const c = C();
    const liste = R.rechercherDocuments(c.documents, qDocs);
    const tete = `<div class="vue-tete"><div><h1>Documents à conserver</h1><p>Où se trouve chaque papier de la copropriété : classeur, dossier numérique, espace en ligne du syndic. Aucun fichier n'est stocké ici, seulement la référence.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouveau-document">${ICONES.plus}Document</button></div></div>`;
    const ordre = (d) => { const i = B.typesDocument.indexOf(d.type); return i < 0 ? 99 : i; };
    const groupes = B.typesDocument.concat(['']).map((type) => ({ type, docs: liste.filter((d) => (type ? d.type === type : !B.typesDocument.includes(d.type))).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))) })).filter((g) => g.docs.length);
    const manquants = B.typesDocument.slice(0, -1).filter((type) => !c.documents.some((d) => d.type === type));
    return `${tete}
      ${c.documents.length ? `<form class="cherche-doc" onsubmit="return false" role="search"><label class="champ"><span class="sr-only">Rechercher un document</span><input id="recherche" type="search" placeholder="Rechercher : PV, décompte, classeur…" value="${esc(qDocs)}" autocomplete="off"></label></form>
        ${groupes.length ? groupes.map((g) => `<h2 class="titre-section">${esc(g.type || 'Autres')} <span>${g.docs.length}</span></h2><ul class="liste-docs-copro">${g.docs.map((d) => `<li><button class="lien-ligne" data-action="document" data-id="${d.id}"><b>${esc(d.nom)}</b><span>${d.date ? dateCourte(d.date) : 'sans date'}${d.exercice ? ` · exercice ${ex(d.exercice)}` : ''}${d.rangement ? ` · ${esc(d.rangement)}` : ' · rangement à préciser'}</span></button></li>`).join('')}</ul>`).join('') : '<div class="vide-etat petit"><div><h3>Aucun document ne correspond</h3><p>Change de mot (les accents ne comptent pas).</p></div></div>'}`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun document noté</h3><p>Note où tu ranges le règlement de copropriété, les procès-verbaux, les décomptes et les factures de travaux : utile à la revente, en cas de litige ou pour la déclaration de revenus fonciers.</p></div></div>`}
      ${manquants.length ? `<h2 class="titre-section">Types sans document noté <span>${manquants.length}</span></h2><div class="pastilles-types">${manquants.map((m) => `<button class="filtre" data-action="nouveau-document" data-type="${esc(m)}">${ICONES.plus}${esc(m)}</button>`).join('')}</div>` : ''}
      <p class="mention avertissement">Liste indicative de documents utiles. Aucune durée de conservation n'est imposée par l'outil : renseigne-toi auprès du syndic ou d'un professionnel.</p>`;
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
  const SUPPR = '<button class="btn danger gauche" value="supprimer">Supprimer</button>';
  const nombreOuErreur = (v, lib) => { const n = R.lireNombre(v); if (n === null) return null; if (!Number.isFinite(n) || n < 0) return `${lib.charAt(0).toUpperCase() + lib.slice(1)} : nombre positif attendu.`; return null; };
  const valeurMontant = (n) => (n === null || n === undefined || n === 0 ? '' : String(n).replace('.', ','));
  const champMontant = (nom, lib, v, aide = '') => `<label class="champ">${lib}${aide ? `<small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" value="${valeurMontant(v)}" placeholder="0"></label>`;
  const optionsAnnees = (v) => { const a = exCourant(); const l = [...new Set([...R.anneesCopro(C(), auj()), a + 1, a - 1])].sort((x, y) => y - x); return l.map((x) => `<option value="${x}" ${x === v ? 'selected' : ''}>${ex(x)}</option>`).join(''); };

  // Appel de fonds : provisions, fonds de travaux, échéances de travaux à rattacher, autres sommes.
  function modaleAppel(aid, pre = {}) {
    const c = C();
    const existant = aid ? c.appels.find((a) => a.id === aid) : null;
    if (aid && !existant) return;
    const v = existant || R.normaliserAppel({ echeance: pre.echeance || auj(), exercice: pre.exercice }, c.debutExercice, auj());
    const candidats = R.echeancesAAppeler(c, null, { sauf: existant?.id });
    const pris = (v.travaux || []).map((l) => ({ ...l, nom: travauxDe(l.travaux)?.nom || 'Travaux', date: travauxDe(l.travaux)?.echeancier.find((e) => e.id === l.echeance)?.date || null }));
    const lignes = [...pris.map((l) => ({ ...l, coche: true })), ...candidats.filter((x) => !pris.some((l) => l.echeance === x.echeance)).map((x) => ({ ...x, coche: pre.echeance && x.echeance === pre.echeanceTravaux }))];
    const corps = `
      <div class="rang-champs">
        <label class="champ">Libellé<small>Tel qu'écrit par le syndic.</small><input name="libelle" maxlength="80" value="${esc(v.libelle)}" placeholder="Ex. : Appel du trimestre 2"></label>
        <label class="champ">Date d'exigibilité<input type="date" name="echeance" value="${v.echeance}" required></label>
      </div>
      <div class="rang-champs">
        ${champMontant('provisions', 'Provisions du budget (€)', v.provisions)}
        ${champMontant('fondsTravaux', 'Fonds de travaux (€)', v.fondsTravaux)}
      </div>
      ${lignes.length ? `<fieldset class="champ cadre-champs"><legend>Travaux votés <small>Échéances de ton échéancier : coche celles appelées ici et ajuste le montant si besoin.</small></legend>
        <ul class="lignes-travaux">${lignes.map((l, i) => `<li><label class="case"><input type="checkbox" name="tr-${i}" ${l.coche ? 'checked' : ''}> ${esc(l.nom)}${l.date ? ` · ${dateCourte(l.date)}` : ''}</label><input type="hidden" name="trid-${i}" value="${esc(l.travaux)}|${esc(l.echeance || '')}"><label class="champ montant"><span class="sr-only">Montant</span><input name="trm-${i}" inputmode="decimal" value="${valeurMontant(l.montant)}"></label></li>`).join('')}</ul></fieldset>` : ''}
      <div class="rang-champs">
        ${champMontant('autres', 'Autres sommes (€)', v.autres, 'Avance de trésorerie, frais…')}
        <label class="champ">Exercice<select name="exercice">${optionsAnnees(v.exercice)}</select></label>
      </div>
      <label class="champ">Payé le<small>Vide tant que le virement n'est pas fait.</small><input type="date" name="payeLe" value="${v.payeLe || ''}"></label>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="300">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(existant ? esc(nomAppel(existant)) : 'Nouvel appel de fonds', corps, existant ? PIED('Enregistrer', SUPPR) : PIED('Ajouter l\'appel'), (f, action) => {
      if (action === 'supprimer') {
        retenir(); c.appels = c.appels.filter((a) => a.id !== existant.id);
        sauver(); rendre(); toast('Appel supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      for (const [n, l] of [['provisions', 'les provisions'], ['fondsTravaux', 'le fonds de travaux'], ['autres', 'les autres sommes']]) { const e = nombreOuErreur(f.get(n), l); if (e) return e; }
      if (!R.estDate(String(f.get('echeance')))) return 'Indique la date d\'exigibilité.';
      const travaux = lignes.map((l, i) => (f.get(`tr-${i}`) === 'on' ? { travaux: String(f.get(`trid-${i}`)).split('|')[0], echeance: String(f.get(`trid-${i}`)).split('|')[1] || null, montant: f.get(`trm-${i}`) } : null)).filter(Boolean);
      for (const l of travaux) if (Number.isNaN(R.lireNombre(l.montant))) return 'Montant de travaux : nombre attendu.';
      const n = R.normaliserAppel({ ...(existant || {}), libelle: f.get('libelle'), echeance: f.get('echeance'), exercice: f.get('exercice'), provisions: f.get('provisions'), fondsTravaux: f.get('fondsTravaux'), autres: f.get('autres'), travaux, payeLe: f.get('payeLe') || null, note: f.get('note') }, c.debutExercice, auj());
      if (!R.totalAppel(n)) return 'L\'appel est vide : saisis au moins un montant.';
      retenir();
      if (existant) Object.assign(existant, n); else c.appels.push(n);
      anneeAppels = n.exercice;
      sauver(); rendre(); toast(existant ? 'Appel enregistré.' : `Appel de ${euros(R.totalAppel(n), { centimes: true })} ajouté.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Quatre appels trimestriels d'un exercice, à partir de la quote-part du budget (ou du budget total × tantièmes).
  function modaleGenerer() {
    const c = C();
    const a0 = exCourant();
    const deja = (a) => c.appels.filter((x) => x.exercice === a && x.provisions > 0).length;
    const p = R.part(c);
    const corps = `
      <p>Crée les 4 appels de l'exercice, au 1er jour de chaque trimestre${c.debutExercice !== 1 ? ` (exercice commençant en ${MOIS[c.debutExercice - 1]})` : ''}, chacun pour le quart des montants annuels. Tu ajustes ensuite chaque appel selon ce que le syndic envoie.</p>
      <label class="champ">Exercice<select name="annee">${optionsAnnees(a0)}</select></label>
      <div class="rang-champs">
        ${champMontant('provisions', 'Ta quote-part du budget voté (€ par an)', null, 'Montant annuel figurant sur l\'appel ou le budget.')}
        ${champMontant('fondsTravaux', 'Ta cotisation au fonds de travaux (€ par an)', null)}
      </div>
      ${p !== null ? `<div class="cadre-champs"><p class="aide">Tu n'as que le budget de l'immeuble ? Saisis-le : ta part est estimée avec tes tantièmes (${pct(p * 100, 2)}), si la quote-part ci-dessus est vide.</p><div class="rang-champs">${champMontant('budgetTotal', 'Budget voté de l\'immeuble (€)', null)}${champMontant('fondsTotal', 'Fonds de travaux de l\'immeuble (€)', null)}</div></div>` : ''}
      ${E.reglages.rappels ? `<p class="mention">${esc(B.regles.provisions.texte)} Source : ${esc(sourceCourte('F20586'))}. Si ton AG a fixé une autre périodicité, crée tes appels un par un.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Appels de l\'exercice', corps, PIED('Créer les 4 appels'), (f) => {
      const annee = Number(f.get('annee'));
      for (const n of ['provisions', 'fondsTravaux', 'budgetTotal', 'fondsTotal']) { const e = nombreOuErreur(f.get(n), 'le montant'); if (e) return e; }
      let prov = R.lireNombre(f.get('provisions')), fonds = R.lireNombre(f.get('fondsTravaux'));
      if (prov === null && R.lireNombre(f.get('budgetTotal'))) prov = R.quotePart(c, R.lireNombre(f.get('budgetTotal')));
      if (fonds === null && R.lireNombre(f.get('fondsTotal'))) fonds = R.quotePart(c, R.lireNombre(f.get('fondsTotal')));
      if (!prov && !fonds) return 'Indique ta quote-part du budget ou le budget de l\'immeuble.';
      if (deja(annee) && !confirm(`L'exercice ${ex(annee)} a déjà ${pluriel(deja(annee), 'appel')} de provisions. Ajouter quand même 4 appels ?`)) return 'Rien n\'a été créé.';
      retenir();
      const nouveaux = R.appelsTrimestriels(c, annee, { provisions: prov || 0, fondsTravaux: fonds || 0 });
      c.appels.push(...nouveaux);
      let e = R.exerciceDe(c, annee);
      if (!e) { e = R.normaliserExercice({ annee }, B, auj()); c.exercices.push(e); c.exercices.sort((x, y) => x.annee - y.annee); }
      if (prov) e.budget = R.arrondi(prov);
      anneeAppels = annee;
      sauver(); changerVue('appels'); toast(`4 appels de ${euros(R.totalAppel(nouveaux[0]), { centimes: true })} créés pour ${ex(annee)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Décompte annuel : charges réelles par poste (quote-part), approbation, régularisation.
  function modaleDecompte(annee) {
    const c = C();
    const e = R.exerciceDe(c, annee) || R.normaliserExercice({ annee }, B, auj());
    const val = (id) => e.charges.find((l) => l.poste === id)?.montant;
    const corps = `
      <p>Recopie ta quote-part de chaque poste, lue sur le décompte individuel de l'exercice ${ex(annee)}. Laisse vide un poste absent.</p>
      <ul class="lignes-postes">${B.postes.map((p) => `<li><label class="champ montant"><span>${esc(p.nom)}</span><input name="p-${p.id}" inputmode="decimal" value="${val(p.id) === undefined ? '' : String(val(p.id)).replace('.', ',')}" placeholder="–"></label></li>`).join('')}</ul>
      <p class="aide" id="total-decompte"></p>
      <div class="rang-champs">
        <label class="champ">Comptes approuvés en AG le<input type="date" name="approuveLe" value="${e.approuveLe || ''}"></label>
        <label class="champ">Régularisation réglée le<small>Payée ou reçue.</small><input type="date" name="regleLe" value="${e.regleLe || ''}"></label>
      </div>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="400">${esc(e.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Décompte ${ex(annee)}`, corps, PIED(), (f) => {
      const charges = [];
      for (const p of B.postes) {
        const brut = f.get(`p-${p.id}`);
        const n = R.lireNombre(brut);
        if (Number.isNaN(n)) return `${p.nom} : nombre attendu.`;
        if (n !== null) charges.push({ poste: p.id, montant: n });
      }
      retenir();
      const n = R.normaliserExercice({ ...e, charges, approuveLe: f.get('approuveLe') || null, regleLe: f.get('regleLe') || null, note: f.get('note') }, B, auj());
      const i = c.exercices.findIndex((x) => x.annee === annee);
      if (i >= 0) c.exercices[i] = n; else { c.exercices.push(n); c.exercices.sort((x, y) => x.annee - y.annee); }
      anneeCharges = annee;
      sauver(); rendre(); toast(`Décompte ${ex(annee)} enregistré : ${euros(R.chargesTotal(n), { centimes: true })}.`, { libelle: 'Annuler', faire: annuler });
    });
    const maj = () => { let s = 0; modale().querySelectorAll('.lignes-postes input').forEach((i) => { const n = R.lireNombre(i.value); if (Number.isFinite(n)) s += n; }); $('#total-decompte').textContent = `Total saisi : ${euros(R.arrondi(s), { centimes: true })}`; };
    modale().querySelector('.lignes-postes').addEventListener('input', maj);
    maj();
  }

  // Part récupérable par poste (saisie), avec l'aide de la fiche F947.
  function modaleRecup() {
    const c = C();
    const corps = `
      <p>Pour chaque poste, la part que tu refactures au locataire, en %. Le décompte du syndic indique souvent une colonne « récupérable » : c'est la meilleure source.</p>
      <div class="rang"><button class="btn petit" type="button" data-action="recup-proposer">Proposer selon la liste officielle</button></div>
      <ul class="lignes-postes recup">${B.postes.map((p) => `<li><label class="champ montant"><span>${esc(p.nom)}<small>${esc(p.aide)}</small></span><input name="r-${p.id}" inputmode="decimal" value="${c.recup[p.id] === undefined ? '' : String(c.recup[p.id]).replace('.', ',')}" placeholder="0 %" data-propose="${p.propose ?? ''}"></label></li>`).join('')}</ul>
      <p class="mention">${esc(B.regles.recuperables.texte)} Source : ${esc(sourceCourte('F947'))}. La proposition ne remplit que les postes vides, pour les catégories citées par cette fiche ; tout reste modifiable. Outil d'aide, pas un conseil juridique.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Part récupérable sur le locataire', corps, PIED(), (f) => {
      const recup = {};
      for (const p of B.postes) {
        const n = R.lireNombre(f.get(`r-${p.id}`));
        if (Number.isNaN(n) || (n !== null && (n < 0 || n > 100))) return `${p.nom} : pourcentage entre 0 et 100 attendu.`;
        if (n !== null) recup[p.id] = n;
      }
      retenir(); c.recup = recup;
      sauver(); rendre(); toast('Parts récupérables enregistrées.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleAG(aid) {
    const c = C();
    const existant = aid ? assemblee(aid) : null;
    const v = existant || R.normaliserAssemblee({ date: ajout(auj(), 21) }, auj());
    const corps = `
      <div class="rang-champs">
        <label class="champ">Date de l'assemblée<input type="date" name="date" value="${v.date}" required></label>
        <label class="champ">Type<select name="type">${B.typesAG.map((x) => `<option value="${x.id}" ${x.id === v.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Lieu ou modalités<input name="lieu" maxlength="120" value="${esc(v.lieu)}" placeholder="Ex. : salle de la résidence, visioconférence"></label>
      <div class="rang-champs">
        <label class="champ">Convocation reçue le<input type="date" name="convocationRecue" value="${v.convocationRecue || ''}"></label>
        <label class="champ">Ta participation<select name="presence"><option value="">À décider</option>${B.presences.map((p) => `<option value="${p.id}" ${p.id === v.presence ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Procès-verbal reçu le<input type="date" name="pvRecu" value="${v.pvRecu || ''}"></label>
      ${existant ? '' : '<label class="champ">Ordre du jour<small>Facultatif : colle les résolutions, une par ligne. La majorité et les montants se précisent ensuite.</small><textarea name="odj" rows="5" maxlength="8000" placeholder="Approbation des comptes&#10;Vote du budget prévisionnel&#10;…"></textarea></label>'}
      <label class="case"><input type="checkbox" name="preparee" ${v.preparee ? 'checked' : ''}> Vote préparé (documents lus, intentions notées)</label>
      <label class="champ">Notes<small>Questions à poser, points à vérifier.</small><textarea name="note" rows="3" maxlength="600">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(existant ? `AG du ${dateCourte(existant.date)}` : 'Nouvelle assemblée', corps, existant ? PIED('Enregistrer', SUPPR) : PIED('Créer l\'assemblée'), (f, action) => {
      if (action === 'supprimer') {
        if (!confirm('Supprimer cette assemblée et ses résolutions ? Les travaux suivis restent.')) return 'Assemblée gardée.';
        retenir(); c.assemblees = c.assemblees.filter((a) => a.id !== existant.id);
        c.travaux.forEach((t) => { if (t.assemblee === existant.id) { t.assemblee = null; t.resolution = null; } });
        sauver(); changerVue('ag'); toast('Assemblée supprimée.', { libelle: 'Annuler', faire: annuler }); return;
      }
      if (!R.estDate(String(f.get('date')))) return 'Indique la date de l\'assemblée.';
      const lignes = String(f.get('odj') || '').split(/\r?\n/).map((l) => l.replace(/^\s*(?:n°\s*)?\d+\s*[.)\-–:]?\s*/i, '').trim()).filter(Boolean);
      const n = R.normaliserAssemblee({ ...(existant || {}), date: f.get('date'), type: f.get('type'), lieu: f.get('lieu'), convocationRecue: f.get('convocationRecue') || null, presence: f.get('presence') || null, pvRecu: f.get('pvRecu') || null, preparee: f.get('preparee') === 'on', note: f.get('note'), resolutions: existant ? existant.resolutions : lignes.map((titre, i) => ({ titre, numero: String(i + 1) })) }, auj());
      retenir();
      if (existant) Object.assign(existant, n); else c.assemblees.push(n);
      sauver();
      if (!existant) { changerVue('assemblee', n.id); toast(n.resolutions.length ? `${pluriel(n.resolutions.length, 'résolution')} ajoutée${n.resolutions.length > 1 ? 's' : ''} : note la majorité et ton intention de vote.` : 'Assemblée créée : ajoute les résolutions de l\'ordre du jour.', { libelle: 'Annuler', faire: annuler }); } else { rendre(); toast('Assemblée enregistrée.', { libelle: 'Annuler', faire: annuler }); }
    });
  }

  function modaleResolution(agId, rid) {
    const ag = assemblee(agId);
    const existant = rid ? ag.resolutions.find((r) => r.id === rid) : null;
    const v = existant || R.normaliserResolution({ numero: String(ag.resolutions.length + 1) });
    const corps = `
      <div class="rang-champs">
        <label class="champ" style="max-width:120px">N°<input name="numero" maxlength="8" value="${esc(v.numero)}"></label>
        <label class="champ">Majorité requise<small>Recopiée de la convocation.</small><select name="majorite"><option value="">Non saisie</option>${B.majorites.map((m) => `<option ${m === v.majorite ? 'selected' : ''}>${esc(m)}</option>`).join('')}${v.majorite && !B.majorites.includes(v.majorite) ? `<option selected>${esc(v.majorite)}</option>` : ''}</select></label>
      </div>
      <label class="champ">Intitulé<textarea name="titre" rows="2" maxlength="200" required>${existant ? esc(v.titre) : ''}</textarea></label>
      ${champMontant('montant', 'Montant pour la copropriété (€)', v.montant, 'Budget, devis, travaux : facultatif.')}
      <div class="rang-champs">
        <label class="champ">Mon vote ou intention<select name="vote"><option value="">À décider</option>${R.VOTES.map((x) => `<option value="${x}" ${x === v.vote ? 'selected' : ''}>${R.LIB_VOTE[x]}</option>`).join('')}</select></label>
        <label class="champ">Résultat<small>Lu dans le procès-verbal.</small><select name="resultat"><option value="">Pas encore</option>${R.RESULTATS.map((x) => `<option value="${x}" ${x === v.resultat ? 'selected' : ''}>${R.LIB_RESULTAT[x]}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="400">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(existant ? `Résolution ${esc(existant.numero)}` : 'Nouvelle résolution', corps, existant ? PIED('Enregistrer', SUPPR) : PIED('Ajouter'), (f, action) => {
      if (action === 'supprimer') { retenir(); ag.resolutions = ag.resolutions.filter((r) => r.id !== existant.id); C().travaux.forEach((t) => { if (t.resolution === existant.id) t.resolution = null; }); sauver(); rendre(); toast('Résolution supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      if (!String(f.get('titre') || '').trim()) return 'Indique l\'intitulé de la résolution.';
      const e = nombreOuErreur(f.get('montant'), 'le montant'); if (e) return e;
      const n = R.normaliserResolution({ ...(existant || {}), numero: f.get('numero'), majorite: f.get('majorite'), titre: f.get('titre'), montant: f.get('montant'), vote: f.get('vote') || null, resultat: f.get('resultat') || null, note: f.get('note') });
      retenir();
      if (existant) Object.assign(existant, n); else ag.resolutions.push(n);
      sauver(); rendre(); toast(existant ? 'Résolution enregistrée.' : 'Résolution ajoutée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleTravaux(tid, pre = {}) {
    const c = C();
    const existant = tid ? travauxDe(tid) : null;
    const v = existant || R.normaliserTravaux(pre);
    const p = R.part(c);
    const ligneEch = (e = {}) => `<li class="ligne-ech"><label class="champ"><span class="sr-only">Date</span><input type="date" name="ech-date" value="${e.date || ''}"></label><label class="champ montant"><span class="sr-only">Montant</span><input name="ech-montant" inputmode="decimal" value="${valeurMontant(e.montant)}" placeholder="0 €"></label><input type="hidden" name="ech-id" value="${esc(e.id || '')}"><button type="button" class="btn-icone petit" data-action="retirer-ligne" aria-label="Retirer l'échéance">×</button></li>`;
    const corps = `
      <label class="champ">Travaux<input name="nom" maxlength="120" value="${esc(v.nom === 'Travaux' && !existant ? (pre.nom || '') : v.nom)}" placeholder="Ex. : Ravalement des façades"></label>
      <div class="rang-champs">
        <label class="champ">Votés lors de<select name="assemblee"><option value="">Aucune AG notée</option>${R.trierAssemblees(c.assemblees).map((a) => `<option value="${a.id}" ${a.id === v.assemblee ? 'selected' : ''}>AG du ${dateCourte(a.date)}</option>`).join('')}</select></label>
        <label class="champ">État<select name="statut">${R.STATUTS_TRAVAUX.map((s) => `<option value="${s}" ${s === v.statut ? 'selected' : ''}>${R.LIB_TRAVAUX[s]}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        ${champMontant('montantTotal', 'Montant voté pour la copropriété (€)', v.montantTotal)}
        <label class="champ">Ta quote-part (€)<small>${p !== null ? `Lue sur l'appel, ou estimée avec tes tantièmes (${pct(p * 100, 2)}).` : 'Lue sur l\'appel ou le procès-verbal.'}</small><input name="quotePart" inputmode="decimal" value="${valeurMontant(v.quotePart)}" placeholder="0"></label>
      </div>
      ${p !== null ? '<div class="rang"><button class="btn petit" type="button" data-action="estimer-quote-part">Estimer avec mes tantièmes</button></div>' : ''}
      <fieldset class="champ cadre-champs"><legend>Échéancier <small>Dates et montants des appels votés (ta part).</small></legend>
        <ul class="lignes-ech" id="lignes-ech">${(v.echeancier.length ? v.echeancier : [{}]).map(ligneEch).join('')}</ul>
        <div class="rang"><button class="btn petit" type="button" data-action="ajouter-echeance">${ICONES.plus}Échéance</button><button class="btn petit" type="button" data-action="repartir-echeances">Répartir la quote-part</button></div>
      </fieldset>
      <label class="champ">Note<small>Entreprise retenue, calendrier du chantier…</small><textarea name="note" rows="2" maxlength="400">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(existant ? esc(existant.nom) : 'Travaux votés', corps, existant ? PIED('Enregistrer', SUPPR) : PIED('Suivre ces travaux'), (f, action) => {
      if (action === 'supprimer') {
        const nb = R.suiviTravaux(c, existant).appele;
        if (!confirm(`Supprimer ces travaux${nb ? ' ? Les montants déjà notés dans les appels seront retirés de ces appels' : ' ?'}`)) return 'Travaux gardés.';
        retenir(); c.travaux = c.travaux.filter((t) => t.id !== existant.id);
        c.appels.forEach((a) => { a.travaux = a.travaux.filter((l) => l.travaux !== existant.id); });
        sauver(); rendre(); toast('Travaux supprimés.', { libelle: 'Annuler', faire: annuler }); return;
      }
      if (!String(f.get('nom') || '').trim()) return 'Donne un nom aux travaux.';
      for (const [n, l] of [['montantTotal', 'le montant voté'], ['quotePart', 'la quote-part']]) { const e = nombreOuErreur(f.get(n), l); if (e) return e; }
      const dates = f.getAll('ech-date'), montants = f.getAll('ech-montant'), ids = f.getAll('ech-id');
      const echeancier = [];
      for (let i = 0; i < dates.length; i++) {
        const m = R.lireNombre(montants[i]);
        if (Number.isNaN(m)) return 'Échéancier : montant non lu.';
        if (!dates[i] && m === null) continue;
        echeancier.push({ id: ids[i] || undefined, date: dates[i] || null, montant: m || 0 });
      }
      const agId = f.get('assemblee') || null;
      const n = R.normaliserTravaux({ ...(existant || {}), nom: f.get('nom'), assemblee: agId, resolution: agId === (existant?.assemblee ?? pre.assemblee) ? (existant?.resolution ?? pre.resolution ?? null) : null, statut: f.get('statut'), montantTotal: f.get('montantTotal'), quotePart: f.get('quotePart'), echeancier, note: f.get('note') });
      retenir();
      if (existant) Object.assign(existant, n); else c.travaux.push(n);
      // Lignes d'appel rattachées à une échéance retirée : gardées, sans échéance.
      c.appels.forEach((a) => a.travaux.forEach((l) => { if (l.travaux === n.id && l.echeance && !n.echeancier.some((e) => e.id === l.echeance)) l.echeance = null; }));
      sauver(); rendre(); toast(existant ? 'Travaux enregistrés.' : 'Travaux suivis : chaque échéance proche te sera rappelée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleDocument(did, pre = {}) {
    const c = C();
    const existant = did ? c.documents.find((d) => d.id === did) : null;
    const v = existant || R.normaliserDocument({ type: pre.type || B.typesDocument[0], nom: pre.type || '' }, auj());
    const corps = `
      <label class="champ">Document<input name="nom" maxlength="140" value="${esc(existant ? v.nom : (pre.type || ''))}" placeholder="Ex. : Procès-verbal de l'AG de juin"></label>
      <div class="rang-champs">
        <label class="champ">Type<select name="type">${B.typesDocument.map((t) => `<option ${t === v.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="champ">Date du document<input type="date" name="date" value="${v.date || ''}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Exercice concerné<select name="exercice"><option value="">Aucun</option>${optionsAnnees(v.exercice)}</select></label>
        <label class="champ">Où il est rangé<small>Classeur, dossier numérique, espace en ligne du syndic…</small><input name="rangement" maxlength="140" value="${esc(v.rangement)}"></label>
      </div>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="300">${esc(v.note)}</textarea></label>
      <p class="aide">Aucun fichier n'est envoyé ni stocké : seulement la référence pour retrouver le papier.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(existant ? esc(existant.nom) : 'Nouveau document', corps, existant ? PIED('Enregistrer', SUPPR) : PIED('Ajouter'), (f, action) => {
      if (action === 'supprimer') { retenir(); c.documents = c.documents.filter((d) => d.id !== existant.id); sauver(); rendre(); toast('Document retiré de la liste.', { libelle: 'Annuler', faire: annuler }); return; }
      if (!String(f.get('nom') || '').trim()) return 'Donne un nom au document.';
      const n = R.normaliserDocument({ ...(existant || {}), nom: f.get('nom'), type: f.get('type'), date: f.get('date') || null, exercice: f.get('exercice') || null, rangement: f.get('rangement'), note: f.get('note') }, auj());
      retenir();
      if (existant) Object.assign(existant, n); else c.documents.push(n);
      sauver(); rendre(); toast(existant ? 'Document enregistré.' : 'Document ajouté.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Copropriété et lots (aussi pour en ajouter une nouvelle).
  function modaleCopro(nouvelle = false) {
    const c = nouvelle ? R.normaliserCopro({ nom: '' }, B, auj()) : C();
    const ligneLot = (l = {}) => `<li class="ligne-lot"><label class="champ"><span class="sr-only">Lot</span><input name="lot-nom" maxlength="60" value="${esc(l.nom || '')}" placeholder="Ex. : Appartement B12"></label><label class="champ"><span class="sr-only">Type</span><select name="lot-type">${B.typesLot.map((t) => `<option value="${t.id}" ${t.id === (l.type || 'logement') ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label><label class="champ montant"><span class="sr-only">Tantièmes</span><input name="lot-tantiemes" inputmode="numeric" value="${l.tantiemes || ''}" placeholder="Tantièmes"></label><label class="case"><input type="checkbox" name="lot-loue" value="${l.id || ''}" ${l.loue ? 'checked' : ''}> Loué</label><input type="hidden" name="lot-id" value="${esc(l.id || '')}"><input type="hidden" name="lot-numero" value="${esc(l.numero || '')}"><button type="button" class="btn-icone petit" data-action="retirer-ligne" aria-label="Retirer le lot">×</button></li>`;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom de la copropriété<input name="nom" maxlength="100" value="${esc(nouvelle ? '' : c.nom)}" required></label>
        <label class="champ">Syndic<input name="syndic" maxlength="100" value="${esc(c.syndic)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Début de l'exercice<select name="debut">${MOIS.map((m, i) => `<option value="${i + 1}" ${c.debutExercice === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="champ">Tantièmes généraux de l'immeuble<input name="total" inputmode="numeric" value="${c.tantiemesTotal || ''}" placeholder="Ex. : 10000"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Tes lots <small>Nom, type, tantièmes généraux (lus dans l'état descriptif de division ou sur un appel), loué ou non.</small></legend>
        <ul class="lignes-lots" id="lignes-lots">${(c.lots.length ? c.lots : [{}]).map(ligneLot).join('')}</ul>
        <div class="rang"><button class="btn petit" type="button" data-action="ajouter-lot">${ICONES.plus}Lot</button></div>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    const extra = !nouvelle && E.copros.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer cette copropriété</button>' : '';
    ouvrirModale(nouvelle ? 'Nouvelle copropriété' : 'Copropriété et lots', corps, PIED(nouvelle ? 'Créer' : 'Enregistrer', extra), (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${c.nom} » et toutes ses données (appels, charges, AG, travaux, documents) ?`)) return 'Copropriété gardée.';
        retenir(); E.copros = E.copros.filter((x) => x.id !== c.id); E.actif = E.copros[0].id;
        sauver(); changerVue('tableau'); toast('Copropriété supprimée.', { libelle: 'Annuler', faire: annuler }); return;
      }
      if (!String(f.get('nom') || '').trim()) return 'Donne un nom à la copropriété.';
      const total = R.lireNombre(f.get('total'));
      if (Number.isNaN(total) || (total !== null && total < 0)) return 'Tantièmes de l\'immeuble : nombre entier attendu.';
      const noms = f.getAll('lot-nom'), types = f.getAll('lot-type'), tants = f.getAll('lot-tantiemes'), ids = f.getAll('lot-id'), nums = f.getAll('lot-numero');
      const loues = [...modale().querySelectorAll('[name=lot-loue]')].map((x) => x.checked);
      const lots = [];
      for (let i = 0; i < noms.length; i++) {
        const tn = R.lireNombre(tants[i]);
        if (Number.isNaN(tn)) return 'Tantièmes d\'un lot : nombre entier attendu.';
        if (!noms[i].trim() && tn === null) continue;
        lots.push({ id: ids[i] || undefined, nom: noms[i], type: types[i], tantiemes: tn, loue: loues[i], numero: nums[i] });
      }
      const somme = lots.reduce((s, l) => s + (l.tantiemes || 0), 0);
      if (total && somme > total) return 'Les tantièmes de tes lots dépassent le total de l\'immeuble.';
      retenir();
      const n = R.normaliserCopro({ ...c, nom: f.get('nom'), syndic: f.get('syndic'), debutExercice: f.get('debut'), tantiemesTotal: total, lots }, B, auj());
      if (nouvelle) { E.copros.push(n); E.actif = n.id; sauver(); changerVue('tableau'); toast(`« ${n.nom} » créée.`, { libelle: 'Annuler', faire: annuler }); return; }
      Object.assign(c, n);
      sauver(); rendre(); toast('Copropriété enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Actions courtes ----------
  function payer(cid, aid) {
    const c = E.copros.find((x) => x.id === cid) || C();
    const a = c.appels.find((x) => x.id === aid);
    if (!a) return;
    retenir(); a.payeLe = auj();
    sauver(); rendre(); toast(`${nomAppel(a)} noté payé aujourd'hui.`, { libelle: 'Annuler', faire: annuler });
  }
  function regler(cid, eid) {
    const c = E.copros.find((x) => x.id === cid) || C();
    const e = c.exercices.find((x) => x.id === eid);
    if (!e) return;
    retenir(); e.regleLe = auj();
    sauver(); rendre(); toast(`Régularisation ${R.libelleExercice(e.annee, c.debutExercice)} notée réglée.`, { libelle: 'Annuler', faire: annuler });
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
  const enTete = (titre, sous = '') => `<header><p>${esc(C().nom)} · édité le ${dateLongue(auj())}</p><h1>${esc(titre)}</h1>${sous ? `<p>${sous}</p>` : ''}</header>`;

  // Récapitulatif des charges d'un exercice par nature, avec la part récupérable (aide au décompte du locataire).
  function imprimerDecompte(annee) {
    const c = C();
    const s = R.syntheseExercice(c, annee, auj());
    const rep = R.repartition(c, annee, B);
    imprimer(`${enTete(`Charges de l'exercice ${ex(annee)}`, `${c.lots.map((l) => esc(l.nom)).join(', ')}${c.syndic ? ` · syndic : ${esc(c.syndic)}` : ''}`)}
      <table><thead><tr><th>Nature de la charge</th><th class="nb">Quote-part</th><th class="nb">Part récupérable</th><th class="nb">Récupérable</th></tr></thead><tbody>${rep.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${euros(x.montant, { centimes: true })}</td><td class="nb">${pct(x.recupPct)}</td><td class="nb">${euros(x.recuperable, { centimes: true })}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td class="nb"><b>${euros(s.charges, { centimes: true })}</b></td><td></td><td class="nb"><b>${euros(s.recuperable, { centimes: true })}</b></td></tr></tbody></table>
      <table><tbody><tr><th>Provisions appelées sur l'exercice</th><td class="nb">${euros(s.provisions, { centimes: true })}</td></tr><tr><th>Régularisation (charges − provisions)</th><td class="nb">${s.regularisation === null ? '' : euros(s.regularisation, { centimes: true })}</td></tr>${s.approuveLe ? `<tr><th>Comptes approuvés le</th><td>${dateLongue(s.approuveLe)}</td></tr>` : ''}</tbody></table>
      <p class="mention">Montants saisis d'après le décompte du syndic. Parts récupérables saisies par le propriétaire ; liste des charges récupérables : décret n° 87-713 du 26 août 1987 (${esc(sourceCourte('F947'))}). Document d'aide : le décompte du syndic et le bail font foi.</p>`);
  }
  function imprimerAG(id) {
    const ag = assemblee(id);
    imprimer(`${enTete(`${B.typesAG.find((x) => x.id === ag.type).nom} du ${dateLongue(ag.date)}`, `${ag.lieu ? esc(ag.lieu) : ''}${ag.presence ? ` · ${esc(B.presences.find((p) => p.id === ag.presence).nom)}` : ''}`)}
      <table><thead><tr><th>N°</th><th>Résolution</th><th>Majorité (convocation)</th><th class="nb">Montant</th><th>Mon vote</th><th>Résultat</th></tr></thead><tbody>${ag.resolutions.map((r) => `<tr><td>${esc(r.numero)}</td><td>${esc(r.titre)}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</td><td>${esc(r.majorite)}</td><td class="nb">${r.montant ? euros(r.montant) : ''}</td><td>${r.vote ? R.LIB_VOTE[r.vote] : '☐ Pour ☐ Contre ☐ Abst.'}</td><td>${r.resultat ? R.LIB_RESULTAT[r.resultat] : ''}</td></tr>`).join('')}</tbody></table>
      ${ag.note ? `<h2>Notes</h2><p class="bloc-texte">${esc(ag.note)}</p>` : ''}
      <p class="mention">Fiche personnelle de préparation. Le procès-verbal de l'assemblée fait foi.</p>`);
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const g = E.reglages;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Alerte avant un appel (jours)<input name="alerte" type="number" min="1" max="90" value="${g.alerte}"></label>
        <label class="champ">Préparer une AG (jours avant)<input name="alerteAG" type="number" min="3" max="90" value="${g.alerteAG}"></label>
      </div>
      <label class="case"><input type="checkbox" name="rappels" ${g.rappels ? 'checked' : ''}> Repères sourcés (provisions trimestrielles, fonds de travaux, charges récupérables)</label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Copropriétés</h3><p class="aide">Plusieurs biens dans des immeubles différents : une copropriété par immeuble, même clé.</p>
        <ul class="liste-simple">${E.copros.map((c) => `<li>${esc(c.nom)}${c.id === E.actif ? ' <small>(affichée)</small>' : ''}</li>`).join('')}</ul>
        <div class="rang"><button class="btn petit" type="button" data-action="copro">Modifier l'actuelle</button>${E.copros.length < R.MAX.copros ? `<button class="btn petit" type="button" data-action="nouvelle-copro">${ICONES.plus}Copropriété</button>` : ''}</div></div>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Pour un tableur, ta déclaration de revenus fonciers ou le conseil syndical.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-appels">Appels en CSV</button><button class="btn petit" type="button" data-action="csv-charges">Charges en CSV</button><button class="btn petit" type="button" data-action="csv-resolutions">Résolutions en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span>.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application : pratique pour cocher un appel payé ou noter ton vote pendant l'AG.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Sources et à propos</h3><p class="mention">Outil d'aide : le règlement de copropriété, les décisions d'assemblée et les documents du syndic font foi ; il ne remplace pas un conseil juridique. Aucune règle de majorité n'est intégrée (saisie depuis la convocation). Repères repris de ${B.sources.map((s) => `la fiche « ${esc(s.titre)} » de ${esc(s.editeur)}, vérifiée par l'administration le ${esc(s.verifiePar)}, consultée par QME le ${dateLongue(s.consulte)} : <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace('https://', ''))}</a>`).join(' ; ')}. Postes de charges types et types de documents : listes indicatives. Base intégrée version ${B.version}.</p></div>`;
    ouvrirModale('Réglages', corps, PIED(), (f) => {
      retenir();
      E.reglages = R.reglagesDe({ alerte: f.get('alerte'), alerteAG: f.get('alerteAG'), rappels: f.get('rappels') === 'on' }, E.reglages);
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.copros) || !d.copros.length) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.copros.length, 'copropriété')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de ta copropriété.'); }
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
  const nomFichier = (quoi) => `copropriete-${quoi}-${auj()}.${quoi === 'copie' ? 'json' : 'csv'}`;
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', nomFichier('copie'));

  // ---------- Infobulles des graphiques (survol, toucher, clavier) ----------
  let bulle = null;
  function montrerBulle(el, x, y) {
    if (!bulle) { bulle = document.createElement('div'); bulle.className = 'infobulle'; bulle.setAttribute('role', 'tooltip'); bulle.style.position = 'fixed'; document.body.appendChild(bulle); }
    const [titre, ...lignes] = el.dataset.info.split('\n');
    bulle.innerHTML = `<b>${esc(titre)}</b>${lignes.map((l) => esc(l)).join('<br>')}`;
    bulle.hidden = false;
    const r = bulle.getBoundingClientRect();
    bulle.style.left = `${Math.max(8, Math.min(window.innerWidth - r.width - 8, x + 12))}px`;
    bulle.style.top = `${Math.max(8, y - r.height - 12 < 8 ? y + 16 : y - r.height - 12)}px`;
  }
  const cacherBulle = () => { if (bulle) bulle.hidden = true; };
  document.addEventListener('pointermove', (e) => { const el = e.target.closest?.('[data-info]'); if (el) montrerBulle(el, e.clientX, e.clientY); else cacherBulle(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-info]'); if (el) { const r = el.getBoundingClientRect(); montrerBulle(el, r.left + r.width / 2, r.top); } else cacherBulle(); });
  window.addEventListener('scroll', cacherBulle, { passive: true });

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
  const ferme = () => { if (modale().open) modale().close(); };
  const versCopro = (id) => { if (id && E.copros.some((c) => c.id === id)) E.actif = id; };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': ferme(); deconnecter(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': ferme(); changerVue(el.dataset.vue); break;
      case 'assemblee': ferme(); changerVue('assemblee', id); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-appels': telecharger(R.versCsvAppels(C()), 'text/csv;charset=utf-8', nomFichier('appels')); break;
      case 'csv-charges': telecharger(R.versCsvCharges(C(), B), 'text/csv;charset=utf-8', nomFichier('charges')); break;
      case 'csv-resolutions': telecharger(R.versCsvResolutions(C()), 'text/csv;charset=utf-8', nomFichier('resolutions')); break;
      case 'fermer': ferme(); break;
      case 'choix-copro-id': versCopro(id); sauver(); rendre(); break;
      case 'copro': modaleCopro(false); break;
      case 'nouvelle-copro': modaleCopro(true); break;
      case 'nouvel-appel': modaleAppel(null, { exercice: typeof anneeAppels === 'number' ? anneeAppels : undefined }); break;
      case 'appel': modaleAppel(id); break;
      case 'payer': payer(E.actif, id); break;
      case 'generer': modaleGenerer(); break;
      case 'annee-appels': anneeAppels = el.dataset.annee === 'tous' ? 'tous' : Number(el.dataset.annee); rendre(); break;
      case 'annee-charges': anneeCharges = Number(el.dataset.annee); rendre(); break;
      case 'decompte': modaleDecompte(Number(el.dataset.annee)); break;
      case 'recup': modaleRecup(); break;
      case 'recup-proposer': {
        let n = 0;
        modale().querySelectorAll('[data-propose]').forEach((i) => { if (!i.value.trim() && i.dataset.propose !== '') { i.value = i.dataset.propose; n++; } });
        toast(n ? `${pluriel(n, 'poste')} rempli${n > 1 ? 's' : ''} : vérifie avec le décompte du syndic.` : 'Rien à proposer : les postes cités sont déjà remplis.');
        break;
      }
      case 'imprimer-decompte': imprimerDecompte(Number(el.dataset.annee)); break;
      case 'imprimer-ag': imprimerAG(id); break;
      case 'nouvelle-ag': ferme(); modaleAG(null); break;
      case 'modifier-ag': modaleAG(id); break;
      case 'ag-preparee': { const ag = assemblee(id); retenir(); ag.preparee = true; sauver(); rendre(); toast('AG notée comme préparée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'nouvelle-resolution': modaleResolution(id, null); break;
      case 'resolution': modaleResolution(id, el.dataset.res); break;
      case 'suivre-travaux': {
        const ag = assemblee(id); const r = ag.resolutions.find((x) => x.id === el.dataset.res);
        modaleTravaux(null, { nom: r.titre.slice(0, 120), assemblee: ag.id, resolution: r.id, montantTotal: r.montant, quotePart: R.quotePart(C(), r.montant) ?? 0 });
        break;
      }
      case 'nouveaux-travaux': modaleTravaux(null); break;
      case 'travaux': ferme(); modaleTravaux(id); break;
      case 'estimer-quote-part': {
        const f = modale().querySelector('form');
        const t = R.lireNombre(f.montantTotal.value);
        if (!Number.isFinite(t) || t === null) { toast('Saisis d\'abord le montant voté pour la copropriété.'); break; }
        f.quotePart.value = String(R.quotePart(C(), t)).replace('.', ',');
        break;
      }
      case 'ajouter-echeance': { const ul = $('#lignes-ech'); if (ul.children.length < R.MAX.echeances) { ul.insertAdjacentHTML('beforeend', ul.firstElementChild.outerHTML); const li = ul.lastElementChild; li.querySelectorAll('input').forEach((i) => { i.value = ''; }); li.querySelector('input').focus(); } break; }
      case 'repartir-echeances': {
        const f = modale().querySelector('form');
        const q = R.lireNombre(f.quotePart.value);
        const lignes = [...modale().querySelectorAll('.ligne-ech')];
        if (!Number.isFinite(q) || !q) { toast('Saisis d\'abord ta quote-part.'); break; }
        const n = lignes.length;
        const part = Math.floor((q / n) * 100) / 100;
        lignes.forEach((li, i) => { li.querySelector('[name=ech-montant]').value = String(i === n - 1 ? R.arrondi(q - part * (n - 1)) : part).replace('.', ','); });
        break;
      }
      case 'ajouter-lot': { const ul = $('#lignes-lots'); if (ul.children.length < R.MAX.lots) { ul.insertAdjacentHTML('beforeend', ul.firstElementChild.outerHTML); const li = ul.lastElementChild; li.querySelectorAll('input').forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }); li.querySelector('input').focus(); } break; }
      case 'retirer-ligne': { const ul = el.closest('ul'); if (ul.children.length > 1) el.closest('li').remove(); else el.closest('li').querySelectorAll('input').forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }); break; }
      case 'nouveau-document': modaleDocument(null, { type: el.dataset.type }); break;
      case 'document': modaleDocument(id); break;
      case 'ouvrir-alerte': {
        versCopro(el.dataset.copro);
        const q = el.dataset.quoi;
        if (q === 'appel') { rendre(); modaleAppel(id); } else if (q === 'travaux') { rendre(); modaleTravaux(id); } else if (q === 'assemblee') changerVue('assemblee', id); else if (q === 'charges') { anneeCharges = Number(id); changerVue('charges'); }
        break;
      }
      case 'al-payer': payer(el.dataset.copro, id); break;
      case 'al-regle': regler(el.dataset.copro, id); break;
      case 'al-preparer': versCopro(el.dataset.copro); changerVue('assemblee', id); break;
      case 'al-appel-travaux': {
        versCopro(el.dataset.copro); rendre();
        const t = travauxDe(id); const ech = t?.echeancier.find((x) => x.id === el.dataset.echeance);
        modaleAppel(null, { echeance: ech?.date || auj(), echeanceTravaux: el.dataset.echeance });
        const m = modale(); const lib = m.querySelector('[name=libelle]'); if (lib && t) lib.value = `Appel travaux · ${t.nom}`.slice(0, 80);
        break;
      }
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('select[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    if (action === 'choix-copro') { versCopro(el.value); sauver(); if (vue === 'assemblee') vue = 'tableau'; rendre(); return; }
    if (action === 'vote' || action === 'resultat') {
      const ag = assemblee(id); const r = ag?.resolutions.find((x) => x.id === el.dataset.res);
      if (!r) return;
      retenir(); r[action] = el.value || null;
      sauver(); rendre();
      toast(action === 'vote' ? (r.vote ? `Vote noté : ${R.LIB_VOTE[r.vote].toLowerCase()}.` : 'Vote effacé.') : (r.resultat ? `Résultat noté : ${R.LIB_RESULTAT[r.resultat].toLowerCase()}.` : 'Résultat effacé.'), { libelle: 'Annuler', faire: annuler });
    }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E || !E.copros?.length) return;
    rafraichir();
    if (!modale().open && $('#vue')) rendre(); // la date du jour a pu changer
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
        if (E.copros.length) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__copropriete = { etat: () => E, regles: R };
  init();
})();
