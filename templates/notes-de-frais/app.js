// Notes de frais QME : saisie des frais, justificatifs (référence, sans fichier), statut de remboursement,
// indemnités kilométriques au barème, note mensuelle imprimable et export CSV.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi automatique, aucune application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.NDF;
  const API = '/api/templates';
  const PRODUIT = 'NDF';
  const CLE_CODE = 'qme-ndf-code';
  const CLE_CACHE = 'qme-ndf-cache';
  const CLE_DEMO = 'qme-ndf-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ndf-ecran-accueil';

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
  const { ajout, versDate, euros } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dateNum = (s) => fmt(s, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nomMois = (cle) => { const t = versDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const moisSeul = (cle) => versDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'long' });
  const moisCourt = (cle) => versDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const coef = (n) => String(n).replace('.', ',');

  const categorie = (id) => B.categories.find((c) => c.id === id) || B.categories.find((c) => c.id === 'autres');
  const nomCat = (id) => categorie(id).nom;
  const couleurCat = (id) => B.couleurs[Math.max(0, B.categories.findIndex((c) => c.id === id))] || '#8C8579';
  const LIB_STATUT_NOTE = { vide: 'Vide', brouillon: 'Brouillon', partiel: 'En partie soumise', soumis: 'Soumise', rembourse: 'Remboursée' };
  const CLASSE_STATUT = { brouillon: 'sable', partiel: 'jaune', soumis: 'ciel', rembourse: 'vert', vide: '' };
  const NUM_TRANCHE = ['1re', '2e', '3e'];

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  let moisNote = auj().slice(0, 7);
  let anneeKm = R.anneeDe(auj());
  const filtre = { statut: 'tous', q: '' };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, auj(), B);
  const unFrais = (id) => E.frais.find((x) => x.id === id);
  const unTrajet = (id) => E.trajets.find((x) => x.id === id);
  const vehicule = (id) => E.vehicules.find((x) => x.id === id);
  const vehiculesActifs = () => E.vehicules.filter((v) => !v.archive);
  const nomVehicule = (id) => vehicule(id)?.nom || 'Véhicule supprimé';
  const descVehicule = (v) => `${R.LIB_TYPE[v.type]}${v.type === 'cyclo' ? '' : ` · ${v.cv} CV`}${v.electrique ? ' · électrique' : ''}`;

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
        toast('Un autre appareil a modifié tes notes de frais entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (NDF-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Salariée fictive qui se déplace chez des clients fictifs, à des dates relatives à aujourd'hui :
  // mois anciens remboursés, une note soumise sans réponse depuis plus de 30 jours (retard), le mois dernier
  // encore en brouillon (à soumettre), le mois en cours en saisie avec des justificatifs manquants,
  // une voiture thermique qui passe le seuil de 5 000 km (régularisation à prévoir) et un deux-roues électrique.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    e.prenom = 'Camille'; e.nom = 'Camille Delaunay'; e.structure = 'Bureau d\'études (exemple fictif)'; e.profil = 'salarie';
    const v1 = R.normaliserVehicule({ id: uid(), nom: 'Voiture personnelle', type: 'voiture', cv: 5 });
    const v2 = R.normaliserVehicule({ id: uid(), nom: 'Scooter électrique', type: 'moto', cv: 1, electrique: true, kmEstimes: 900 });
    e.vehicules.push(v1, v2);
    const mc = t.slice(0, 7);
    const ecartMois = (cle) => (Number(mc.slice(0, 4)) - Number(cle.slice(0, 4))) * 12 + Number(mc.slice(5, 7)) - Number(cle.slice(5, 7));
    // Statut d'un élément selon l'ancienneté de son mois : ≥ 3 mois remboursé, 2 mois soumis (en retard), sinon brouillon.
    const statut = (date) => {
      const cle = date.slice(0, 7), n = ecartMois(cle);
      const soumisLe = `${R.ajoutMoisCle(cle, 1)}-03`;
      if (n >= 3) return { statut: 'rembourse', soumisLe, rembourseLe: `${R.ajoutMoisCle(cle, 1)}-${n === 3 ? '24' : '18'}` };
      if (n === 2) return { statut: 'soumis', soumisLe };
      return { statut: 'brouillon' };
    };
    const missions = ['Client Alpha (fictif)', 'Chantier Nord (fictif)', 'Agence Ouest (fictive)', 'Salon professionnel (fictif)'];
    const villes = [['Bureau', 'Client Alpha', 46], ['Bureau', 'Chantier Nord', 62], ['Domicile', 'Agence Ouest', 38], ['Bureau', 'Fournisseur Est', 27], ['Bureau', 'Client Alpha', 46], ['Domicile', 'Chantier Nord', 71]];
    const annee = Number(t.slice(0, 4));
    // Trajets en voiture : environ deux par semaine depuis le 1er janvier jusqu'à aujourd'hui.
    for (let d = `${annee}-01-05`, i = 0; d <= t; d = ajout(d, i % 2 ? 4 : 3), i++) {
      const jour = versDate(d).getDay();
      if (jour === 0 || jour === 6) continue;
      const [depart, arrivee, k] = villes[i % villes.length];
      const m = missions[i % 3];
      e.trajets.push(R.normaliserTrajet({ id: uid(), date: d, vehicule: v1.id, depart, arrivee, km: k + (i % 5) * 3, allerRetour: true, motif: i % 4 === 0 ? 'Réunion de chantier' : 'Rendez-vous client', mission: m, ...statut(d) }, t));
    }
    // Scooter : petits trajets en ville sur les trois derniers mois.
    for (let i = 0; i < 14; i++) {
      const d = ajout(t, -2 - i * 6);
      if (d.slice(0, 4) !== String(annee)) continue;
      e.trajets.push(R.normaliserTrajet({ id: uid(), date: d, vehicule: v2.id, depart: 'Bureau', arrivee: i % 2 ? 'Agence centre' : 'Banque', km: 6 + (i % 3) * 2, allerRetour: true, motif: 'Course en ville', mission: '', ...statut(d) }, t));
    }
    // Frais : un ensemble type par mois sur 10 mois, plus le mois en cours.
    const f = (date, cat, montant, extra = {}) => e.frais.push(R.normaliserFrais({ id: uid(), date, cat, montant, justificatif: 'oui', ...statut(date), ...extra }, t));
    for (let n = 10; n >= 1; n--) {
      const cle = R.ajoutMoisCle(mc, -n);
      const j = (x) => `${cle}-${String(x).padStart(2, '0')}`;
      f(j(4), 'repas', 1650 + (n % 3) * 120, { tva: 150 + (n % 3) * 11, description: 'Déjeuner sur chantier', mission: missions[1], reference: `Enveloppe ${moisSeul(cle)}` });
      f(j(9), 'peage', 1240, { tva: 207, description: 'Péage aller-retour', mission: missions[0], reference: 'Relevé du badge' });
      f(j(9), 'stationnement', 600 + (n % 2) * 250, { description: 'Parking du client', mission: missions[0], reference: `Enveloppe ${moisSeul(cle)}` });
      if (n % 2 === 0) f(j(16), 'train', 8900 + n * 110, { tva: 809 + n * 10, description: 'Train aller-retour pour une réunion', mission: missions[2], reference: 'Billet électronique, dossier « Trains »' });
      if (n % 3 === 0) f(j(17), 'hebergement', 11800, { tva: 1073, description: 'Hôtel, une nuit', mission: missions[2], reference: 'Facture scannée, dossier « Hôtels »' });
      if (n === 4) f(j(21), 'invitation', 14650, { tva: 1332, description: 'Déjeuner avec deux interlocuteurs du client', mission: missions[0], reference: 'Facture, noms au dos' });
      if (n % 4 === 1) f(j(12), 'fournitures', 2390, { tva: 398, description: 'Carnets et marqueurs', reference: 'Ticket de caisse' });
    }
    // Le mois dernier : un justificatif manquant. Valeur extrême : trois nuits d'hôtel pour le salon.
    const dernier = R.ajoutMoisCle(mc, -1);
    f(`${dernier}-22`, 'hebergement', 48600, { tva: 4418, description: 'Hôtel, trois nuits pour le salon', mission: missions[3], reference: 'Facture scannée, dossier « Hôtels »' });
    f(`${dernier}-23`, 'taxi', 3450, { description: 'Taxi gare – salon', mission: missions[3], justificatif: 'non', reference: '' });
    f(`${dernier}-24`, 'location', 12900, { tva: 2150, description: 'Location d\'un utilitaire, une journée', mission: missions[1], reference: 'Contrat de location' });
    f(`${dernier}-24`, 'carburant', 5820, { tva: 970, description: 'Plein de l\'utilitaire de location', mission: missions[1], reference: 'Ticket de la station' });
    // Le mois en cours : saisie en cours, justificatifs pas encore tous rangés.
    const jours = Number(t.slice(8, 10));
    if (jours >= 2) f(`${mc}-02`, 'repas', 1420, { tva: 129, description: 'Déjeuner sur chantier', mission: missions[1], reference: `Enveloppe ${moisSeul(mc)}` });
    f(t, 'stationnement', 450, { description: 'Parking de la gare', justificatif: 'non', reference: '' });
    if (jours >= 3) f(ajout(t, -1), 'documentation', 3900, { tva: 650, description: 'Norme technique (version numérique)', mission: missions[1], justificatif: 'non', reference: 'Facture à télécharger' });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Notes de frais · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="200" height="260" fill="#F0EDE6" stroke="#141414" stroke-width="4"/>
          <rect x="50" y="60" width="140" height="14" fill="#141414"/>
          <rect x="50" y="100" width="100" height="10" fill="#1D4E89"/>
          <rect x="50" y="130" width="120" height="10" fill="#1D4E89"/>
          <rect x="50" y="160" width="80" height="10" fill="#1D4E89"/>
          <rect x="50" y="220" width="140" height="24" fill="#F5B400"/>
          <circle cx="330" cy="200" r="80" fill="#D9302A"/>
          <path d="M260 120 L560 120 L560 20 A100 100 0 0 0 460 20 Z" fill="#141414"/>
          <rect x="430" y="170" width="110" height="110" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Notes de frais</p>
          <h1>Chaque euro avancé, retrouvé.</h1>
          <p>Tes frais et tes kilomètres au même endroit : le justificatif et où il est rangé, le statut de remboursement, l'indemnité kilométrique au barème et la note du mois prête à imprimer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes notes de frais</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes frais sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes notes de frais</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes notes de frais'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', nom: '', structure: '', profil: 'salarie', vehicule: { type: 'voiture', cv: 5, electrique: false, nom: '' }, sansVehicule: false };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ta note de frais.</h1>
        <p class="intro">Ton nom et ta structure s'affichent en tête de chaque note mensuelle imprimée. Tout se modifie ensuite dans les Réglages.</p>
        <div class="rang-champs" style="max-width:720px">
          <label class="champ">Ton prénom <small>Pour l'accueil.</small><input id="a-prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40"></label>
          <label class="champ">Nom sur les notes <small>Facultatif.</small><input id="a-nom" value="${esc(a.nom)}" autocomplete="name" maxlength="80"></label>
        </div>
        <fieldset class="champ" style="margin-top:16px;max-width:720px"><legend>Tu es…</legend><div class="choix-statut deux">
          <label><input type="radio" name="a-profil" value="salarie" ${a.profil === 'salarie' ? 'checked' : ''}><span>Salarié(e), remboursé(e) par l'employeur</span></label>
          <label><input type="radio" name="a-profil" value="independant" ${a.profil === 'independant' ? 'checked' : ''}><span>Indépendant(e) ou dirigeant(e)</span></label>
        </div></fieldset>
        <label class="champ" style="max-width:720px;margin-top:16px">${a.profil === 'salarie' ? 'Employeur' : 'Structure qui rembourse'} <small>Facultatif, affiché sur la note.</small><input id="a-structure" value="${esc(a.structure)}" maxlength="80" autocomplete="organization"></label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const v = a.vehicule;
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tu te déplaces avec ton véhicule ?</h1>
        <p class="intro">Pour les indemnités kilométriques, le barème dépend du type de véhicule et de sa puissance fiscale (case P.6 de la carte grise). Tu pourras en ajouter d'autres.</p>
        <label class="case" style="margin-bottom:12px"><input type="checkbox" id="a-sans" ${a.sansVehicule ? 'checked' : ''}> Pas de véhicule personnel pour l'instant</label>
        <div class="cadre-champs" id="a-vehicule" ${a.sansVehicule ? 'hidden' : ''} style="max-width:720px">
          <div class="rang-champs">
            <label class="champ">Nom <small>Ex. : Voiture personnelle.</small><input id="a-v-nom" value="${esc(v.nom)}" maxlength="60" placeholder="${esc(R.LIB_TYPE[v.type])}"></label>
            <label class="champ">Type<select id="a-v-type">${B.vehicules.map((x) => `<option value="${x.id}" ${x.id === v.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
            <label class="champ" id="a-v-cv-champ" ${v.type === 'cyclo' ? 'hidden' : ''}>Puissance fiscale (CV)<input id="a-v-cv" type="number" min="1" max="50" step="1" value="${v.cv}"></label>
          </div>
          <label class="case"><input type="checkbox" id="a-v-elec" ${v.electrique ? 'checked' : ''}> 100 % électrique (majoration prévue par le barème)</label>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mes notes de frais</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lien = (sel, cle, f = (x) => x.value) => $(sel)?.addEventListener('input', (e) => { cle(f(e.target)); });
    lien('#a-prenom', (v) => { accueil.prenom = v; });
    lien('#a-nom', (v) => { accueil.nom = v; });
    lien('#a-structure', (v) => { accueil.structure = v; });
    document.querySelectorAll('[name=a-profil]').forEach((r) => r.addEventListener('change', () => { accueil.profil = r.value; ecranAccueil(); }));
    lien('#a-v-nom', (v) => { accueil.vehicule.nom = v; });
    lien('#a-v-cv', (v) => { accueil.vehicule.cv = v; });
    $('#a-v-type')?.addEventListener('change', (e) => { accueil.vehicule.type = e.target.value; ecranAccueil(); });
    $('#a-v-elec')?.addEventListener('change', (e) => { accueil.vehicule.electrique = e.target.checked; });
    $('#a-sans')?.addEventListener('change', (e) => { accueil.sansVehicule = e.target.checked; $('#a-vehicule').hidden = e.target.checked; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim(); E.nom = accueil.nom.trim(); E.structure = accueil.structure.trim(); E.profil = accueil.profil;
    if (!accueil.sansVehicule) E.vehicules.push(R.normaliserVehicule({ id: uid(), ...accueil.vehicule, nom: accueil.vehicule.nom.trim() || R.LIB_TYPE[accueil.vehicule.type] }));
    const avecVehicule = E.vehicules.length > 0;
    accueil = { etape: 1, prenom: '', nom: '', structure: '', profil: 'salarie', vehicule: { type: 'voiture', cv: 5, electrique: false, nom: '' }, sansVehicule: false };
    vue = 'frais';
    sauver();
    demarrer();
    toast(avecVehicule ? 'Tes notes de frais sont prêtes. Ajoute un frais ou un trajet.' : 'Tes notes de frais sont prêtes. Ajoute ton premier frais.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    frais: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    trajets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 21H3Z" fill="currentColor"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['frais', 'Frais'], ['trajets', 'Kilomètres'], ['notes', 'Notes du mois']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la préparation de tes notes de frais : il ne remplace pas ton service comptable ni un professionnel. Les montants viennent de ta saisie ; le barème kilométrique et les règles de remboursement de ton employeur ou de ton comptable font foi.</p>';
  const MENTION_JUSTIF = 'Aucun fichier n\'est stocké : ton espace de données en ligne est volontairement léger. Pour chaque frais, indique si le justificatif est fourni et où il est rangé (enveloppe du mois, dossier, numéro de scan).';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/notes-de-frais/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Notes<br>de frais</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
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
    const titres = { apercu: 'Aperçu', frais: 'Frais', trajets: 'Kilomètres', notes: 'Notes du mois' };
    document.title = `${titres[vue]} · Notes de frais`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { apercu: vueApercu, frais: vueFrais, trajets: vueTrajets, notes: vueNotes }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const etiquetteStatut = (s) => `<span class="etiquette ${CLASSE_STATUT[s] || ''}">${R.LIB_STATUT[s]}</span>`;
  const etiquetteNote = (s) => `<span class="etiquette ${CLASSE_STATUT[s] || ''}">${LIB_STATUT_NOTE[s]}</span>`;

  // ---------- Aperçu ----------
  function texteAlerte(a) {
    if (a.type === 'a-soumettre') return { niveau: 'proche', titre: `Note de ${nomMois(a.mois).toLowerCase()} à soumettre`, detail: `${pluriel(a.nb, 'élément')} en brouillon pour ${euros(a.montant)}. Vérifie, imprime la note, puis marque-la « soumise ».`, action: `<button class="btn petit primaire" data-action="voir-note" data-mois="${a.mois}">Ouvrir la note</button>` };
    if (a.type === 'justificatif') return { niveau: 'proche', titre: `${pluriel(a.nb, 'justificatif')} à retrouver`, detail: `${euros(a.montant)} de frais sans justificatif fourni : sans lui, le remboursement peut être refusé.`, action: '<button class="btn petit" data-action="filtre-justif">Voir ces frais</button>' };
    if (a.type === 'retard') return { niveau: 'depasse', titre: `Remboursement de ${nomMois(a.mois).toLowerCase()} en attente`, detail: `Soumise le ${dateLongue(a.soumisLe)}, il y a ${a.jours} jours : ${euros(a.montant)} toujours pas remboursés. Une relance peut être utile.`, action: `<button class="btn petit" data-action="voir-note" data-mois="${a.mois}">Ouvrir la note</button>` };
    return { niveau: 'plus-tard', titre: `Barème kilométrique ${a.annee} pas encore publié`, detail: a.utilise ? `Tes trajets ${a.annee} sont valorisés avec le barème de ${a.utilise}, en attendant. Le barème fiscal d'une année paraît au printemps suivant : à vérifier et à saisir dans les Réglages.` : 'Aucun barème : ajoute-en un dans les Réglages.', action: '<button class="btn petit" data-action="baremes">Voir les barèmes</button>' };
  }

  function vueApercu() {
    const t = auj();
    const annee = R.anneeDe(t);
    const tot = R.totauxAnnee(E, annee);
    const tout = [...E.frais, ...E.trajets];
    const valeurs = R.valeursTrajets(E);
    const montant = (x) => (x.vehicule && x.km !== undefined ? valeurs.get(x.id) || 0 : x.montant);
    const somme = (s) => tout.filter((x) => x.statut === s).reduce((n, x) => n + montant(x), 0);
    const nb = (s) => tout.filter((x) => x.statut === s).length;
    const ikExacte = vehiculesActifs().reduce((s, v) => s + R.bilanVehicule(E, v, annee, t).exacte, 0);
    const al = R.alertes(E, t, E.reglages.delaiRemboursement);
    const titre = E.prenom ? `Bonjour ${esc(E.prenom)}` : 'Aperçu';
    if (!tout.length) {
      return `<div class="vue-tete"><div><h1>${titre}</h1><p>Rien n'est encore saisi.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute ton premier frais</h3><p>Repas, hôtel, train, péage, parking : saisis la date, le montant payé et où est rangé le justificatif. Tes trajets en véhicule personnel se saisissent dans « Kilomètres ».</p><div class="actions"><button class="btn primaire" data-action="nouveau-frais">${ICONES.plus}Ajouter un frais</button><button class="btn" data-action="nouveau-trajet">Ajouter un trajet</button></div></div></div>
        <p class="aide" style="margin-top:16px">${MENTION_JUSTIF}</p>${AVERTISSEMENT}`;
    }
    const tuiles = [
      ['À rembourser', euros(somme('soumis')), `${pluriel(nb('soumis'), 'élément soumis', 'éléments soumis')}, en attente`, 'var(--bleu)', ''],
      ['À soumettre', euros(somme('brouillon')), `${pluriel(nb('brouillon'), 'brouillon')} à vérifier puis envoyer`, 'var(--jaune)', 'rond'],
      [`Remboursé en ${annee}`, euros(tot.parStatut.rembourse, { centimes: false }), `sur ${euros(tot.total, { centimes: false })} de frais et d'indemnités cette année`, 'var(--encre)', ''],
      [`Kilomètres ${annee}`, R.km(Math.round(tot.distance)), `indemnité au barème : ${euros(ikExacte, { centimes: false })}`, 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const derniers = [...E.frais].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6);
    return `
      <div class="vue-tete"><div><h1>${titre}</h1><p>Ce qui t'est dû, ce qu'il reste à soumettre et les justificatifs à retrouver.</p></div>
        <div class="actions"><button class="btn" data-action="nouveau-trajet">${ICONES.plus}Trajet</button><button class="btn primaire" data-action="nouveau-frais">${ICONES.plus}Frais</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>Remboursement attendu sous ${pluriel(E.reglages.delaiRemboursement, 'jour')} (réglable)</span></h2>
          ${al.length ? `<div class="decisions">${al.map((a) => { const x = texteAlerte(a); return `<article class="decision niv-${x.niveau}"><div class="decision-corps"><b>${x.titre}</b><span>${x.detail}</span></div><div class="decision-pied">${x.action}</div></article>`; }).join('')}</div>` : '<div class="vide-etat petit"><div><h3>Rien en attente</h3><p>Les notes à soumettre, les justificatifs manquants et les remboursements en retard apparaissent ici.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Derniers frais <span><button class="btn lien" data-action="vue" data-vue="frais">Tout voir</button></span></h2>
          ${derniers.length ? `<ul class="prochains">${derniers.map((f) => `<li><span class="date-pastille"><b>${versDate(f.date).getDate()}</b>${moisCourt(f.date.slice(0, 7))}</span><button class="lien-ligne" data-action="ouvrir-frais" data-id="${f.id}"><b>${esc(f.description || nomCat(f.cat))}</b><span>${esc(nomCat(f.cat))} · ${R.LIB_STATUT[f.statut].toLowerCase()}${f.justificatif !== 'oui' && f.cat !== 'regularisation' ? ' · justificatif à fournir' : ''}</span></button><span class="nb">${euros(f.montant)}</span></li>`).join('')}</ul>` : '<p class="aide">Aucun frais saisi.</p>'}
        </section>
      </div>
      ${graphiqueMois(tot)}
      ${graphiqueCategories(tot)}
      ${AVERTISSEMENT}`;
  }

  // Frais et indemnités de chaque mois de l'année : colonnes, une seule série (total), détail en infobulle.
  function graphiqueMois(tot) {
    const max = Math.max(...tot.mois.map((x) => x.total), 1);
    const iMax = tot.mois.findIndex((x) => x.total === max);
    const courant = auj().slice(0, 7);
    return `
      <h2 class="titre-section">${tot.annee} mois par mois <span>Frais et indemnités kilométriques (au taux provisoire). Total ${euros(tot.total)}.</span></h2>
      <figure class="graphique">
        <div class="projection">${tot.mois.map((x, i) => `<div class="col-proj ${x.mois === courant ? 'actif' : ''} ${i === iMax ? 'max' : ''}" tabindex="0" data-info="${esc(`<b>${nomMois(x.mois)}</b>${euros(x.total)} au total<br>Frais : ${euros(x.frais)}<br>Kilomètres : ${euros(x.ik)}<br>Note : ${LIB_STATUT_NOTE[x.statut].toLowerCase()}`)}">
          <span class="cp-val">${i === iMax ? euros(x.total, { centimes: false }) : ''}</span>
          <span class="cp-zone"><span class="cp-barre" style="height:${x.total > 0 ? Math.max(1, (x.total / max) * 100) : 0}%"></span></span>
          <span class="cp-mois">${moisCourt(x.mois)}</span></div>`).join('')}</div>
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Frais et indemnités par mois en ${tot.annee}</caption><thead><tr><th>Mois</th><th>Frais</th><th>Kilomètres</th><th>Total</th></tr></thead><tbody>${tot.mois.map((x) => `<tr><td>${nomMois(x.mois)}</td><td>${euros(x.frais)}</td><td>${euros(x.ik)}</td><td>${euros(x.total)}</td></tr>`).join('')}</tbody></table>
      </figure>`;
  }

  // Frais par catégorie sur l'année : barres horizontales, une seule série, valeur au bout, tableau dessous.
  function graphiqueCategories(tot) {
    const cats = tot.parCat.filter((c) => c.cat !== 'regularisation');
    if (!cats.length) return '';
    const max = Math.max(...cats.map((c) => c.montant), 1);
    const total = cats.reduce((s, c) => s + c.montant, 0);
    return `
      <h2 class="titre-section">Par catégorie <span>Frais TTC de ${tot.annee}, hors kilomètres</span></h2>
      <figure class="graphique">
        <div class="barres-cats">${cats.map((c) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(nomCat(c.cat))}</b>${euros(c.montant)} en ${tot.annee}<br>${Math.round((c.montant / total) * 100)} % des frais`)}">
          <span class="bc-nom">${esc(nomCat(c.cat))}</span>
          <span class="bc-piste"><span class="bc-barre" style="width:${Math.max(0.5, (c.montant / max) * 100)}%"></span></span>
          <span class="bc-val"><b>${euros(c.montant)}</b></span></div>`).join('')}</div>
        <div class="infobulle" hidden></div>
      </figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">Frais par catégorie</caption><thead><tr><th>Catégorie</th><th class="nb">Montant TTC</th><th class="nb">Part</th></tr></thead>
        <tbody>${cats.map((c) => `<tr><td>${esc(nomCat(c.cat))}</td><td class="nb">${euros(c.montant)}</td><td class="nb">${Math.round((c.montant / total) * 100)} %</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${euros(total)}</td><td class="nb">100 %</td></tr></tfoot></table></div></details>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Frais ----------
  function ligneFrais(f) {
    const regul = f.cat === 'regularisation';
    const etiq = [etiquetteStatut(f.statut)];
    if (!regul) etiq.push(f.justificatif === 'oui' ? `<span class="etiquette sable">Justificatif${f.reference ? ` · ${esc(f.reference)}` : ' fourni'}</span>` : '<span class="etiquette rose">Justificatif à fournir</span>');
    if (f.mission) etiq.push(`<span class="etiquette ciel">${esc(f.mission)}</span>`);
    return `<li class="ligne-abo st-${f.statut} ${!regul && f.justificatif !== 'oui' && f.statut !== 'rembourse' ? 'alerte-proche' : ''}">
      <button class="ligne-info" data-action="ouvrir-frais" data-id="${f.id}">
        <b><i class="pastille-cat" style="--c:${couleurCat(f.cat)}"></i>${esc(f.description || nomCat(f.cat))}</b>
        <span class="ligne-detail">${fmt(f.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${esc(nomCat(f.cat))}${regul && f.vehicule ? ` · ${esc(nomVehicule(f.vehicule))}, ${f.annee}` : ''}</span>
        <span class="ligne-etiquettes">${etiq.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${euros(f.montant)}</b><small>${f.tva !== null ? `dont TVA saisie ${euros(f.tva)}` : regul ? 'régularisation' : 'TTC · TVA non saisie'}</small></span>
        <span class="ligne-proch">${f.statut === 'rembourse' && f.rembourseLe ? `Remboursé le ${dateCourte(f.rembourseLe)}` : f.statut === 'soumis' && f.soumisLe ? `Soumis le ${dateCourte(f.soumisLe)}` : ''}</span>
      </div>
    </li>`;
  }

  function vueFrais() {
    const q = filtre.q.trim().toLowerCase();
    const garde = (f) => (filtre.statut === 'tous' || (filtre.statut === 'justif' ? f.justificatif !== 'oui' && f.cat !== 'regularisation' && f.statut !== 'rembourse' : f.statut === filtre.statut))
      && (!q || `${f.description} ${nomCat(f.cat)} ${f.mission} ${f.reference}`.toLowerCase().includes(q));
    const liste = E.frais.filter(garde).sort((x, y) => y.date.localeCompare(x.date));
    const nb = (s) => E.frais.filter((f) => s === 'tous' || (s === 'justif' ? f.justificatif !== 'oui' && f.cat !== 'regularisation' && f.statut !== 'rembourse' : f.statut === s)).length;
    const parMois = new Map();
    for (const f of liste) { const c = f.date.slice(0, 7); if (!parMois.has(c)) parMois.set(c, []); parMois.get(c).push(f); }
    const filtres = [['tous', 'Tous'], ['brouillon', 'Brouillons'], ['soumis', 'Soumis'], ['rembourse', 'Remboursés'], ['justif', 'Sans justificatif']];
    return `
      <div class="vue-tete"><div><h1>Frais</h1><p>Chaque dépense avancée, avec son justificatif et son statut. Clique sur un frais pour le modifier.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-frais">${ICONES.plus}Ajouter un frais</button></div></div>
      <div class="outils-liste">
        <div class="filtres cinq" role="group" aria-label="Filtrer">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher (description, mission…)" value="${esc(filtre.q)}"></label>
      </div>
      ${parMois.size ? [...parMois.entries()].map(([cle, l], i) => `<details class="groupe-cat mois-pli" ${i < 3 || q || filtre.statut !== 'tous' ? 'open' : ''}><summary class="titre-cat">${nomMois(cle)}<span>${pluriel(l.length, 'frais', 'frais')} · ${euros(l.reduce((s, f) => s + f.montant, 0))}</span></summary><ul class="lignes-abos">${l.map(ligneFrais).join('')}</ul><button class="btn lien" data-action="voir-note" data-mois="${cle}">Voir la note de ${moisSeul(cle)}</button></details>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.frais.length ? 'Aucun frais ne correspond' : 'Aucun frais'}</h3><p>${E.frais.length ? 'Change le filtre ou la recherche.' : 'Ajoute ta première dépense : date, catégorie, montant payé, et où est rangé le justificatif.'}</p><div class="actions"><button class="btn primaire" data-action="nouveau-frais">${ICONES.plus}Ajouter un frais</button></div></div></div>`}
      <p class="aide" style="margin-top:24px">${MENTION_JUSTIF}</p>`;
  }

  // ---------- Kilomètres ----------
  function texteFormule(bilan, v) {
    const l = R.ligneBareme(bilan.bareme, v);
    if (!l) return '';
    const [a, b] = l.tranches[bilan.tranche];
    return `d × ${coef(a)}${b ? ` + ${R.euros(b * 100, { centimes: false })}` : ''}${bilan.majoration ? `, majoré de ${bilan.majoration} %` : ''}`;
  }

  function carteVehicule(v, annee) {
    const t = auj();
    const b = R.bilanVehicule(E, v, annee, t);
    const seuils = b.bareme?.seuils?.[v.type] || [];
    const fini = annee < R.anneeDe(t);
    const regul = Math.abs(b.regularisation) > Math.max(1, b.trajets); // écarts d'arrondi au centime ignorés
    return `<article class="carte-vehicule">
      <div class="cv-tete"><div><h3>${esc(v.nom)}${v.archive ? ' <span class="etiquette">Archivé</span>' : ''}</h3><p>${esc(descVehicule(v))} · ${pluriel(b.trajets, 'trajet')}</p></div><button class="btn petit" data-action="vehicule" data-id="${v.id}">Modifier</button></div>
      <div class="cv-chiffres">
        <div><span>Distance ${annee}</span><b>${R.km(b.distance)}</b><small>${b.distance ? `${NUM_TRANCHE[b.tranche]} tranche du barème${b.avantSeuil !== null ? ` · ${R.km(b.avantSeuil)} avant la suivante (${R.km(seuils.find((s) => b.distance <= s))})` : ''}` : 'Aucun trajet cette année'}</small></div>
        <div><span>Indemnité au barème</span><b>${euros(b.exacte)}</b><small>${b.distance ? `${texteFormule(b, v)}, avec d = ${R.km(b.distance)}` : '–'}</small></div>
        <div><span>Comptée au fil de l'eau</span><b>${euros(b.provisoire)}</b><small>${coef((b.taux / 100).toFixed(3))} € par km${v.kmEstimes ? `, taux moyen pour ${R.km(v.kmEstimes)} estimés` : ', taux de la 1re tranche'}</small></div>
        <div class="${regul ? (b.regularisation < 0 ? 'neg' : 'pos') : ''}"><span>Régularisation ${fini ? 'à passer' : 'à ce jour'}</span><b>${regul ? euros(b.regularisation, { signe: true }) : '0 €'}</b><small>${!regul ? 'Rien à régulariser' : b.regularisation < 0 ? 'Trop compté : à déduire' : 'Pas assez compté : à ajouter'}${b.dejaRegularise ? ` · ${euros(b.dejaRegularise, { signe: true })} déjà passés` : ''}</small></div>
      </div>
      ${b.projection ? `<p class="aide">Au rythme actuel, l'année finirait vers <b>${R.km(Math.round(b.projection.distance))}</b> (${NUM_TRANCHE[b.projection.tranche]} tranche) pour <b>${euros(b.projection.montant, { centimes: false })}</b> au barème.${v.kmEstimes ? '' : ' Indique tes kilomètres estimés dans le véhicule pour un taux provisoire plus juste.'}</p>` : ''}
      ${regul && b.trajets ? `<div class="rang"><button class="btn petit ${fini ? 'primaire' : ''}" data-action="regulariser" data-id="${v.id}" data-annee="${annee}">Ajouter la régularisation en frais</button></div>` : ''}
    </article>`;
  }

  function vueTrajets() {
    const t = auj();
    const annee = anneeKm;
    const { bareme, exact } = R.baremePour(E.baremes, annee);
    const valeurs = R.valeursTrajets(E);
    const trajets = E.trajets.filter((x) => R.anneeDe(x.date) === annee).sort((x, y) => y.date.localeCompare(x.date));
    const avecTrajets = new Set(trajets.map((x) => x.vehicule));
    const vehicules = E.vehicules.filter((v) => !v.archive || avecTrajets.has(v.id));
    const parMois = new Map();
    for (const x of trajets) { const c = x.date.slice(0, 7); if (!parMois.has(c)) parMois.set(c, []); parMois.get(c).push(x); }
    const estCourante = annee === R.anneeDe(t);
    const info = !bareme ? '<p class="aide">Aucun barème kilométrique : ajoute-en un dans les Réglages.</p>'
      : `<div class="bandeau-bareme ${exact ? '' : 'provisoire'}"><div><b>${exact ? esc(bareme.libelle) : `Barème ${annee} pas encore saisi : celui de ${bareme.annee} est utilisé`}</b><span>${exact ? `${esc(bareme.source)}${bareme.verifie ? '' : ' · à vérifier'}` : `Le barème fiscal d'une année est publié au printemps suivant. Vérifie la nouvelle publication (impots.gouv.fr, service-public.fr) et saisis-la dans les Réglages : tes trajets ${annee} seront revalorisés.`}</span></div><button class="btn petit" data-action="baremes">Barèmes</button></div>`;
    return `
      <div class="vue-tete"><div><h1>Kilomètres ${annee}</h1><p>Tes trajets avec un véhicule personnel. Le barème s'applique au total de l'année, véhicule par véhicule.</p></div>
        <div class="actions nav-mois">
          <button class="btn-icone" data-action="annee-prec" aria-label="Année précédente">${ICONES.gauche}</button>
          <button class="btn petit" data-action="annee-auj" ${estCourante ? 'disabled' : ''}>Cette année</button>
          <button class="btn-icone" data-action="annee-suiv" aria-label="Année suivante">${ICONES.droite}</button>
          <button class="btn primaire" data-action="nouveau-trajet">${ICONES.plus}Trajet</button>
        </div></div>
      ${info}
      <h2 class="titre-section">Véhicules <span><button class="btn lien" data-action="vehicule">Ajouter un véhicule</button></span></h2>
      ${vehicules.length ? `<div class="vehicules">${vehicules.map((v) => carteVehicule(v, annee)).join('')}</div>` : `<div class="vide-etat petit"><div><h3>Aucun véhicule</h3><p>Ajoute le véhicule que tu utilises : type et puissance fiscale (case P.6 de la carte grise).</p><div class="actions"><button class="btn primaire" data-action="vehicule">${ICONES.plus}Ajouter un véhicule</button></div></div></div>`}
      <details class="explication"><summary>Comment l'indemnité est calculée, et pourquoi une régularisation</summary>
        <ol class="conseils">
          <li><b>Un barème annuel</b><span>Le barème fiscal donne une formule par tranche de distance annuelle (pour une voiture : jusqu'à 5 000 km, de 5 001 à 20 000 km, au-delà). La formule de la tranche atteinte s'applique à toute la distance de l'année.</span></li>
          <li><b>L'exact se connaît en fin d'année</b><span>Tant que l'année n'est pas finie, on ne sait pas dans quelle tranche elle tombera. Chaque trajet est donc compté au fil de l'eau à un taux provisoire : celui de la 1re tranche, ou le taux moyen pour tes kilomètres estimés.</span></li>
          <li><b>La régularisation</b><span>En fin d'année, l'indemnité exacte du barème moins ce qui a été compté donne la régularisation : négative si trop compté, positive sinon. Ajoute-la en frais à la note de décembre, si ton employeur ou ton comptable procède ainsi.</span></li>
          <li><b>Ce qui fait foi</b><span>Ton employeur ou ton comptable peut appliquer d'autres règles (barème interne, plafond, taux fixe). Vérifie avec eux : cet outil t'aide à préparer, il ne décide pas.</span></li>
        </ol>
      </details>
      <h2 class="titre-section">Trajets ${annee} <span>${pluriel(trajets.length, 'trajet')} · ${R.km(trajets.reduce((s, x) => s + R.kmTrajet(x), 0))}</span></h2>
      ${parMois.size ? [...parMois.entries()].map(([cle, l], i) => `<details class="groupe-cat mois-pli" ${i < 2 ? 'open' : ''}><summary class="titre-cat">${nomMois(cle)}<span>${pluriel(l.length, 'trajet')} · ${R.km(l.reduce((s, x) => s + R.kmTrajet(x), 0))} · ${euros(l.reduce((s, x) => s + (valeurs.get(x.id) || 0), 0))}</span></summary><ul class="lignes-abos">${l.map((x) => `<li class="ligne-abo st-${x.statut}">
          <button class="ligne-info" data-action="ouvrir-trajet" data-id="${x.id}"><b>${esc(x.depart || 'Départ')} → ${esc(x.arrivee || 'Arrivée')}${x.allerRetour ? ' <small class="ar">aller-retour</small>' : ''}</b>
            <span class="ligne-detail">${fmt(x.date)} · ${esc(nomVehicule(x.vehicule))}${x.motif ? ` · ${esc(x.motif)}` : ''}</span>
            <span class="ligne-etiquettes">${etiquetteStatut(x.statut)}${x.mission ? `<span class="etiquette ciel">${esc(x.mission)}</span>` : ''}</span></button>
          <div class="ligne-droite"><span class="ligne-cout"><b>${R.km(R.kmTrajet(x))}</b><small>${euros(valeurs.get(x.id) || 0)} au taux provisoire</small></span></div>
        </li>`).join('')}</ul></details>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun trajet en ${annee}</h3><p>${E.vehicules.length ? 'Ajoute un trajet : date, départ, arrivée, kilomètres (aller simple) et aller-retour si besoin.' : 'Ajoute d\'abord ton véhicule, puis tes trajets.'}</p><div class="actions"><button class="btn primaire" data-action="${E.vehicules.length ? 'nouveau-trajet' : 'vehicule'}">${ICONES.plus}${E.vehicules.length ? 'Ajouter un trajet' : 'Ajouter un véhicule'}</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Notes du mois ----------
  function documentNote(n) {
    const t = auj();
    const regul = n.frais.filter((f) => f.cat === 'regularisation');
    const frais = n.frais.filter((f) => f.cat !== 'regularisation');
    const baremes = [...new Set(n.trajets.map((x) => R.anneeDe(x.date)))].map((a) => ({ a, ...R.baremePour(E.baremes, a) }));
    const lieu = E.profil === 'salarie' ? 'Employeur' : 'Structure';
    return `<article class="note-doc" aria-label="Note de frais de ${nomMois(n.mois)}">
      <header class="nd-tete">
        <div><p class="surtitre">Note de frais</p><h2>${nomMois(n.mois)}</h2></div>
        <dl><div><dt>Demandeur</dt><dd>${esc(E.nom || E.prenom || '–')}</dd></div>${E.structure ? `<div><dt>${lieu}</dt><dd>${esc(E.structure)}</dd></div>` : ''}<div><dt>Période</dt><dd>du ${dateNum(`${n.mois}-01`)} au ${dateNum(R.ajout(`${R.ajoutMoisCle(n.mois, 1)}-01`, -1))}</dd></div><div><dt>Éditée le</dt><dd>${dateNum(t)}</dd></div><div><dt>Statut</dt><dd>${LIB_STATUT_NOTE[n.statut]}${n.soumisLe ? `, soumise le ${dateNum(n.soumisLe)}` : ''}${n.statut === 'rembourse' && n.rembourseLe ? `, remboursée le ${dateNum(n.rembourseLe)}` : ''}</dd></div></dl>
      </header>
      <h3>Frais <span>${pluriel(frais.length, 'frais', 'frais')}</span></h3>
      ${frais.length ? `<div class="defile"><table class="tableau nd-table"><thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th>Justificatif</th><th class="nb">TVA saisie</th><th class="nb">TTC</th></tr></thead>
        <tbody>${frais.map((f) => `<tr><td class="date">${dateNum(f.date)}</td><td>${esc(nomCat(f.cat))}</td><td>${esc(f.description)}${f.mission ? `<small>${esc(f.mission)}</small>` : ''}</td><td>${f.justificatif === 'oui' ? `Oui${f.reference ? `<small>${esc(f.reference)}</small>` : ''}` : '<b class="manque">À fournir</b>'}</td><td class="nb">${f.tva === null ? '–' : euros(f.tva)}</td><td class="nb">${euros(f.montant)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4">Total des frais</td><td class="nb">${euros(frais.reduce((s, f) => s + (f.tva || 0), 0))}</td><td class="nb">${euros(frais.reduce((s, f) => s + f.montant, 0))}</td></tr></tfoot></table></div>` : '<p class="aide">Aucun frais ce mois-ci.</p>'}
      <h3>Indemnités kilométriques <span>${pluriel(n.trajets.length, 'trajet')} · ${R.km(n.distance)}</span></h3>
      ${n.trajets.length ? `<div class="defile"><table class="tableau nd-table"><thead><tr><th>Date</th><th>Trajet</th><th>Véhicule</th><th class="nb">Km</th><th class="nb">Montant</th></tr></thead>
        <tbody>${n.trajets.map((x) => `<tr><td class="date">${dateNum(x.date)}</td><td>${esc(x.depart)} → ${esc(x.arrivee)}${x.allerRetour ? ' (A/R)' : ''}${x.motif || x.mission ? `<small>${esc([x.motif, x.mission].filter(Boolean).join(' · '))}</small>` : ''}</td><td>${esc(nomVehicule(x.vehicule))}${vehicule(x.vehicule) ? `<small>${esc(descVehicule(vehicule(x.vehicule)))}</small>` : ''}</td><td class="nb">${coef(x.distance)}</td><td class="nb">${euros(x.montant)}</td></tr>`).join('')}
        ${regul.map((f) => `<tr class="regul"><td class="date">${dateNum(f.date)}</td><td colspan="3">${esc(f.description || 'Régularisation annuelle')}</td><td class="nb">${euros(f.montant)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total des indemnités</td><td class="nb">${coef(n.distance)}</td><td class="nb">${euros(n.ik + regul.reduce((s, f) => s + f.montant, 0))}</td></tr></tfoot></table></div>
        <p class="mention">Montants au taux provisoire de chaque véhicule, d'après ${baremes.map((b) => b.bareme ? `${esc(b.bareme.libelle)}${b.exact ? '' : ` (utilisé en attendant le barème ${b.a})`}` : 'aucun barème').join(' ; ')}. L'indemnité exacte dépend de la distance de toute l'année : une régularisation est possible en fin d'année.</p>`
        : regul.length ? `<div class="defile"><table class="tableau nd-table"><tbody>${regul.map((f) => `<tr class="regul"><td class="date">${dateNum(f.date)}</td><td>${esc(f.description || 'Régularisation annuelle')}</td><td class="nb">${euros(f.montant)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="aide">Aucun trajet ce mois-ci.</p>'}
      <div class="nd-total"><span>Total de la note</span><b>${euros(n.total)}</b><small>${n.tva ? `dont ${euros(n.tva)} de TVA saisie d'après les justificatifs` : 'TVA : non saisie'}</small></div>
      ${n.justificatifsManquants ? `<p class="nd-alerte">${pluriel(n.justificatifsManquants, 'justificatif')} à fournir.</p>` : ''}
      <div class="nd-signatures"><div>Signature du demandeur</div><div>Visa et date de validation</div></div>
    </article>`;
  }

  function vueNotes() {
    const n = R.noteMois(E, moisNote);
    const courant = auj().slice(0, 7);
    const historique = R.moisAvecDonnees(E).slice(0, 14);
    const peutSoumettre = [...n.frais, ...n.trajets].some((x) => x.statut === 'brouillon');
    const peutRembourser = [...n.frais, ...n.trajets].some((x) => x.statut === 'soumis');
    const vide = !n.frais.length && !n.trajets.length;
    return `
      <div class="vue-tete"><div><h1>${nomMois(moisNote)} ${n.statut !== 'vide' ? etiquetteNote(n.statut) : ''}</h1><p>La note du mois regroupe tes frais et tes trajets. Imprime-la (ou enregistre-la en PDF), puis suis son remboursement.</p></div>
        <div class="actions nav-mois">
          <button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent">${ICONES.gauche}</button>
          <button class="btn petit" data-action="mois-auj" ${moisNote === courant ? 'disabled' : ''}>Ce mois-ci</button>
          <button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant">${ICONES.droite}</button>
        </div></div>
      <div class="tuiles">
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Total de la note</p><b>${euros(n.total)}</b><span>${pluriel(n.frais.length + n.trajets.length, 'élément')}</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Frais TTC</p><b>${euros(n.ttc)}</b><span>${n.tva ? `dont ${euros(n.tva)} de TVA saisie` : 'TVA non saisie'}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Kilomètres</p><b>${euros(n.ik)}</b><span>${R.km(n.distance)}, taux provisoire</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Remboursé</p><b>${euros(n.parStatut.rembourse)}</b><span>${n.parStatut.soumis ? `${euros(n.parStatut.soumis)} en attente` : n.parStatut.brouillon ? `${euros(n.parStatut.brouillon)} en brouillon` : 'rien en attente'}</span></div>
      </div>
      <div class="actions-note">
        ${peutSoumettre ? '<button class="btn primaire" data-action="soumettre">Marquer soumise</button>' : ''}
        ${peutRembourser ? `<button class="btn ${peutSoumettre ? '' : 'primaire'}" data-action="rembourser">Marquer remboursée</button>` : ''}
        <button class="btn" data-action="imprimer" ${vide ? 'disabled' : ''}>Imprimer ou PDF</button>
        <button class="btn" data-action="csv-mois" ${vide ? 'disabled' : ''}>CSV du mois</button>
        <button class="btn" data-action="recap" ${vide ? 'disabled' : ''}>Texte à copier</button>
      </div>
      ${n.justificatifsManquants ? `<p class="aide">${pluriel(n.justificatifsManquants, 'frais n\'a', 'frais n\'ont')} pas de justificatif fourni. <button class="btn lien" data-action="filtre-justif">Les voir</button></p>` : ''}
      ${vide ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien en ${moisSeul(moisNote)}</h3><p>Aucun frais ni trajet daté de ce mois. Change de mois ou ajoute une dépense.</p><div class="actions"><button class="btn primaire" data-action="nouveau-frais">${ICONES.plus}Ajouter un frais</button></div></div></div>` : documentNote(n)}
      ${historique.length ? `<h2 class="titre-section">Notes précédentes</h2><div class="defile"><table class="tableau historique"><thead><tr><th>Mois</th><th>Statut</th><th class="nb">Total</th><th class="nb">Remboursé</th></tr></thead><tbody>${historique.map((c) => { const h = R.noteMois(E, c); return `<tr class="${c === moisNote ? 'actif' : ''}"><td><button class="btn lien" data-action="voir-note" data-mois="${c}">${nomMois(c)}</button></td><td>${etiquetteNote(h.statut)}</td><td class="nb">${euros(h.total)}</td><td class="nb">${euros(h.parStatut.rembourse)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, { large = false } = {}) {
    const d = modale();
    d.classList.toggle('large', large);
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

  const missionsConnues = () => [...new Set([...E.frais, ...E.trajets].map((x) => x.mission).filter(Boolean))].sort();
  const datalistMissions = () => `<datalist id="missions">${missionsConnues().map((m) => `<option value="${esc(m)}">`).join('')}</datalist>`;

  // Statut et dates (commun aux frais et aux trajets).
  function champsStatut(v) {
    const t = auj();
    return `<fieldset class="champ"><legend>Statut</legend><div class="choix-statut">${R.STATUTS.map((s) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ" id="champ-soumis" ${v.statut === 'brouillon' ? 'hidden' : ''}>Soumis le<input type="date" name="soumisLe" value="${v.soumisLe || t}"></label>
        <label class="champ" id="champ-rembourse" ${v.statut === 'rembourse' ? '' : 'hidden'}>Remboursé le<input type="date" name="rembourseLe" value="${v.rembourseLe || t}"></label>
      </div>`;
  }
  function brancherStatut(d) {
    d.querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', () => {
      const s = d.querySelector('[name=statut]:checked').value;
      d.querySelector('#champ-soumis').hidden = s === 'brouillon';
      d.querySelector('#champ-rembourse').hidden = s !== 'rembourse';
    }));
  }
  function lireStatut(f) {
    const statut = R.STATUTS.includes(f.get('statut')) ? f.get('statut') : 'brouillon';
    const soumisLe = statut === 'brouillon' ? null : f.get('soumisLe') || auj();
    const rembourseLe = statut === 'rembourse' ? f.get('rembourseLe') || auj() : null;
    if (soumisLe && rembourseLe && rembourseLe < soumisLe) return { erreur: 'La date de remboursement ne peut pas précéder la date de soumission.' };
    return { statut, soumisLe, rembourseLe };
  }

  function modaleFrais(id) {
    const t = auj();
    const a = id ? unFrais(id) : null;
    if (id && !a) return;
    const v = a || { date: t, cat: 'repas', montant: null, tva: null, description: '', mission: '', justificatif: 'oui', reference: '', statut: 'brouillon', soumisLe: null, rembourseLe: null };
    const regul = v.cat === 'regularisation';
    const cats = B.categories.filter((c) => !c.interne || c.id === v.cat);
    const corps = `
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${v.date}" required></label>
        <label class="champ">Catégorie<select name="cat" ${regul ? 'disabled' : ''}>${cats.map((c) => `<option value="${c.id}" ${c.id === v.cat ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Montant payé (TTC)<small>${regul ? 'Négatif si trop compté.' : 'En euros, tel qu\'indiqué sur le justificatif.'}</small><input name="montant" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.montant)}" placeholder="0,00" required></label>
        ${regul ? '' : `<label class="champ">TVA <small>Facultatif : recopie le montant de TVA du justificatif. Rien n'est calculé.</small><input name="tva" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.tva)}" placeholder="Non saisie"></label>`}
      </div>
      <label class="champ">Description<input name="description" maxlength="120" value="${esc(v.description)}" placeholder="Ex. : Déjeuner avec le client"></label>
      <label class="champ">Mission ou client <small>Facultatif.</small><input name="mission" maxlength="80" list="missions" value="${esc(v.mission)}" placeholder="Ex. : Chantier Nord"></label>
      ${datalistMissions()}
      ${regul ? '' : `<fieldset class="champ cadre-champs"><legend>Justificatif <small id="aide-justif">${esc(categorie(v.cat).justif)}.</small></legend>
        <div class="choix-statut deux"><label><input type="radio" name="justificatif" value="oui" ${v.justificatif === 'oui' ? 'checked' : ''}><span>Fourni</span></label><label><input type="radio" name="justificatif" value="non" ${v.justificatif !== 'oui' ? 'checked' : ''}><span>À fournir</span></label></div>
        <label class="champ" style="margin-top:12px">Référence ou lieu de rangement<small>Ex. : enveloppe de novembre, dossier « Hôtels », scan n° 12.</small><input name="reference" maxlength="120" value="${esc(v.reference)}"></label>
        <p class="mention" style="margin-top:8px">L'application ne stocke aucun fichier ni photo : garde le justificatif, ici on note seulement où il est.</p>
      </fieldset>`}
      ${champsStatut(v)}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="suivant">Ajouter et un autre</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? (regul ? 'Régularisation kilométrique' : 'Modifier le frais') : 'Nouveau frais', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer ce frais de ${euros(a.montant)} ?`)) { modale().dataset.garder = '1'; return; }
        retenir();
        E.frais = E.frais.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast('Frais supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      if (!f.get('date')) return 'Indique la date de la dépense.';
      const montant = R.lireMontant(f.get('montant'), { negatif: regul });
      if (montant === null) return 'Montant illisible : écris par exemple 18,50.';
      if (!regul && montant === 0) return 'Le montant ne peut pas être nul.';
      const brutTva = String(f.get('tva') || '').trim();
      const tva = brutTva ? R.lireMontant(brutTva) : null;
      if (brutTva && tva === null) return 'TVA illisible : écris par exemple 1,68.';
      if (tva !== null && tva > montant) return 'La TVA ne peut pas dépasser le montant TTC.';
      const st = lireStatut(f);
      if (st.erreur) return st.erreur;
      const donnees = R.normaliserFrais({
        ...(a || {}), id: action === 'dupliquer' ? uid() : a?.id || uid(), date: f.get('date'), cat: regul ? 'regularisation' : f.get('cat'), montant, tva,
        description: String(f.get('description') || '').trim(), mission: String(f.get('mission') || '').trim(),
        justificatif: f.get('justificatif') || 'non', reference: String(f.get('reference') || '').trim(),
        ...(action === 'dupliquer' ? { statut: 'brouillon', soumisLe: null, rembourseLe: null } : st),
      }, t);
      retenir();
      if (a && action !== 'dupliquer') Object.assign(a, donnees); else E.frais.push(donnees);
      sauver(); rendre();
      if (action === 'suivant') { modale().dataset.garder = '1'; modaleFrais(null); toast(`Frais de ${euros(montant)} ajouté.`, { libelle: 'Annuler', faire: annuler }); return; }
      toast(action === 'dupliquer' ? 'Frais dupliqué en brouillon.' : a ? 'Frais enregistré.' : `Frais de ${euros(montant)} ajouté${donnees.justificatif !== 'oui' ? ', justificatif à fournir' : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    brancherStatut(d);
    d.querySelector('[name=cat]')?.addEventListener('change', (e) => { const p = d.querySelector('#aide-justif'); if (p) p.textContent = `${categorie(e.target.value).justif}.`; });
  }

  function modaleTrajet(id) {
    const t = auj();
    const a = id ? unTrajet(id) : null;
    if (id && !a) return;
    if (!E.vehicules.length) { modaleVehicule(null, { ensuite: 'trajet' }); return; }
    const dernier = [...E.trajets].sort((x, y) => y.date.localeCompare(x.date))[0];
    const v = a || { date: t, vehicule: (dernier && vehicule(dernier.vehicule) && !vehicule(dernier.vehicule).archive ? dernier.vehicule : vehiculesActifs()[0]?.id) || E.vehicules[0].id, depart: dernier?.depart || '', arrivee: '', km: '', allerRetour: true, motif: '', mission: '', statut: 'brouillon' };
    const choix = E.vehicules.filter((x) => !x.archive || x.id === v.vehicule);
    const corps = `
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${v.date}" required></label>
        <label class="champ">Véhicule<select name="vehicule">${choix.map((x) => `<option value="${x.id}" ${x.id === v.vehicule ? 'selected' : ''}>${esc(x.nom)} (${esc(descVehicule(x))})</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Départ<input name="depart" maxlength="80" value="${esc(v.depart)}" placeholder="Ex. : Bureau" required></label>
        <label class="champ">Arrivée<input name="arrivee" maxlength="80" value="${esc(v.arrivee)}" placeholder="Ex. : Client Alpha" required></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Distance aller (km)<small>Relève-la sur un itinéraire ou au compteur.</small><input name="km" inputmode="decimal" autocomplete="off" value="${v.km === '' ? '' : String(v.km).replace('.', ',')}" placeholder="0" required></label>
        <label class="case" style="align-self:flex-end"><input type="checkbox" name="allerRetour" ${v.allerRetour ? 'checked' : ''}> Aller-retour (distance doublée)</label>
      </div>
      <p class="aide" id="estim-trajet">Saisis la distance pour voir le montant provisoire.</p>
      <div class="rang-champs">
        <label class="champ">Motif <small>Facultatif.</small><input name="motif" maxlength="120" value="${esc(v.motif)}" placeholder="Ex. : Rendez-vous client"></label>
        <label class="champ">Mission ou client <small>Facultatif.</small><input name="mission" maxlength="80" list="missions" value="${esc(v.mission)}"></label>
      </div>
      ${datalistMissions()}
      ${champsStatut(v)}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="suivant">Ajouter et un autre</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier le trajet' : 'Nouveau trajet', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm('Supprimer ce trajet ?')) { modale().dataset.garder = '1'; return; }
        retenir();
        E.trajets = E.trajets.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast('Trajet supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      if (!f.get('date')) return 'Indique la date du trajet.';
      const depart = String(f.get('depart') || '').trim(), arrivee = String(f.get('arrivee') || '').trim();
      if (!depart || !arrivee) return 'Indique le départ et l\'arrivée.';
      const k = R.lireKm(f.get('km'));
      if (k === null) return 'Distance illisible : écris par exemple 42 ou 42,5 (5 000 km au plus par trajet).';
      const st = lireStatut(f);
      if (st.erreur) return st.erreur;
      const donnees = R.normaliserTrajet({
        id: action === 'dupliquer' ? uid() : a?.id || uid(), date: f.get('date'), vehicule: f.get('vehicule'), depart, arrivee, km: k, allerRetour: f.get('allerRetour') === 'on',
        motif: String(f.get('motif') || '').trim(), mission: String(f.get('mission') || '').trim(),
        ...(action === 'dupliquer' ? { statut: 'brouillon' } : st),
      }, t);
      retenir();
      if (a && action !== 'dupliquer') Object.assign(a, donnees); else E.trajets.push(donnees);
      anneeKm = R.anneeDe(donnees.date);
      sauver(); rendre();
      const montant = R.valeursTrajets(E).get(donnees.id) || 0;
      if (action === 'suivant') { modale().dataset.garder = '1'; modaleTrajet(null); toast(`Trajet de ${R.km(R.kmTrajet(donnees))} ajouté.`, { libelle: 'Annuler', faire: annuler }); return; }
      toast(action === 'dupliquer' ? 'Trajet dupliqué en brouillon.' : `Trajet de ${R.km(R.kmTrajet(donnees))} ${a ? 'enregistré' : 'ajouté'} : ${euros(montant)} au taux provisoire.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    brancherStatut(d);
    const estimer = () => {
      const k = R.lireKm(d.querySelector('[name=km]').value);
      const p = d.querySelector('#estim-trajet');
      const vh = vehicule(d.querySelector('[name=vehicule]').value);
      const date = d.querySelector('[name=date]').value || t;
      if (!k || !vh) { p.textContent = 'Saisis la distance pour voir le montant provisoire.'; return; }
      const dist = R.kmTrajet({ km: k, allerRetour: d.querySelector('[name=allerRetour]').checked });
      const { bareme, exact } = R.baremePour(E.baremes, R.anneeDe(date));
      const taux = bareme ? R.tauxProvisoire(bareme, vh) : 0;
      p.textContent = `${R.km(dist)} : environ ${euros(Math.round(dist * taux))} au taux provisoire de ${coef((taux / 100).toFixed(3))} € par km${exact ? '' : ' (barème de l\'année précédente, en attendant)'}. Le montant exact dépend du total de l'année.`;
    };
    d.querySelectorAll('[name=km],[name=allerRetour],[name=vehicule],[name=date]').forEach((x) => x.addEventListener('input', estimer));
    estimer();
  }

  function modaleVehicule(id, { ensuite = null } = {}) {
    const a = id ? vehicule(id) : null;
    const v = a || { nom: '', type: 'voiture', cv: 5, electrique: false, kmEstimes: 0, archive: false };
    const utilise = a && E.trajets.some((x) => x.vehicule === a.id);
    const { bareme } = R.baremePour(E.baremes, anneeKm);
    const corps = `
      ${ensuite ? '<p class="aide">Ajoute d\'abord le véhicule utilisé pour tes trajets : le barème dépend de son type et de sa puissance fiscale.</p>' : ''}
      <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(v.nom)}" placeholder="Ex. : Voiture personnelle" required></label>
      <div class="rang-champs">
        <label class="champ">Type<select name="type">${B.vehicules.map((x) => `<option value="${x.id}" ${x.id === v.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ" id="champ-cv" ${v.type === 'cyclo' ? 'hidden' : ''}>Puissance fiscale (CV)<small>Case P.6 de la carte grise.</small><input type="number" name="cv" min="1" max="50" step="1" value="${v.cv}"></label>
      </div>
      <label class="case"><input type="checkbox" name="electrique" ${v.electrique ? 'checked' : ''}> Véhicule 100 % électrique</label>
      <p class="mention" style="margin-top:-8px">${bareme?.majorationElectrique ? `Le barème ${bareme.annee} prévoit une majoration de ${bareme.majorationElectrique} % pour les véhicules électriques (à vérifier pour les deux-roues).` : 'Le barème utilisé ne prévoit pas de majoration pour les véhicules électriques.'}</p>
      <label class="champ">Kilomètres professionnels estimés par an <small>Facultatif. Sert au taux provisoire (taux moyen du barème pour cette distance) : plus l'estimation est juste, plus la régularisation de fin d'année est petite. Vide : taux de la 1re tranche.</small><input type="number" name="kmEstimes" min="0" max="200000" step="100" value="${v.kmEstimes || ''}" placeholder="Ex. : 8000"></label>
      ${a ? `<label class="case"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''}> Archivé (plus proposé pour les nouveaux trajets)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${utilise ? '' : '<button class="btn danger gauche" value="supprimer">Supprimer</button>'}`
      : `<button class="btn primaire" value="ok">${ensuite ? 'Ajouter et continuer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>`;
    ouvrirModale(a ? 'Modifier le véhicule' : 'Nouveau véhicule', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        retenir();
        E.vehicules = E.vehicules.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast(`« ${a.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      const cv = Math.round(Number(f.get('cv')));
      if (f.get('type') !== 'cyclo' && !(cv >= 1 && cv <= 50)) return 'La puissance fiscale doit être entre 1 et 50 CV.';
      const donnees = R.normaliserVehicule({ id: a?.id || uid(), nom, type: f.get('type'), cv, electrique: f.get('electrique') === 'on', kmEstimes: f.get('kmEstimes'), archive: f.get('archive') === 'on' });
      retenir();
      if (a) Object.assign(a, donnees); else E.vehicules.push(donnees);
      sauver(); rendre();
      if (ensuite === 'trajet') { modale().dataset.garder = '1'; modaleTrajet(null); return; }
      toast(a ? `« ${nom} » enregistré.` : `« ${nom} » ajouté.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelector('[name=type]').addEventListener('change', (e) => { d.querySelector('#champ-cv').hidden = e.target.value === 'cyclo'; });
  }

  // Soumettre ou marquer remboursée la note du mois affiché, à une date choisie.
  function modaleStatutMois(vers) {
    const n = R.noteMois(E, moisNote);
    const de = vers === 'soumis' ? 'brouillon' : 'soumis';
    const elements = [...n.frais, ...n.trajets].filter((x) => x.statut === de);
    const montant = elements.reduce((s, x) => s + x.montant, 0);
    const t = auj();
    ouvrirModale(vers === 'soumis' ? 'Marquer la note soumise' : 'Marquer la note remboursée', `
      <p>${pluriel(elements.length, 'élément')} de ${nomMois(moisNote).toLowerCase()} pour <b>${euros(montant)}</b> ${vers === 'soumis' ? 'passent de « brouillon » à « soumis »' : 'passent de « soumis » à « remboursé »'}.</p>
      ${vers === 'soumis' && n.justificatifsManquants ? `<p class="aide">${pluriel(n.justificatifsManquants, 'justificatif')} encore à fournir dans cette note.</p>` : ''}
      <label class="champ">${vers === 'soumis' ? 'Soumise le' : 'Remboursement reçu le'}<input type="date" name="date" value="${t}" required></label>
      <p class="mention">Rien n'est envoyé : tu transmets toi-même la note imprimée ou le PDF. Ici, on garde la trace.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Confirmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = f.get('date');
      if (!date) return 'Choisis la date.';
      retenir();
      const nb = R.changerStatutMois(E, moisNote, de, vers, date);
      sauver(); rendre();
      toast(`${pluriel(nb, 'élément')} ${vers === 'soumis' ? 'soumis' : 'remboursé'}${nb > 1 ? 's' : ''} le ${dateCourte(date)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Ajoute la régularisation annuelle d'un véhicule en frais (montant positif ou négatif).
  function modaleRegulariser(id, annee) {
    const v = vehicule(id);
    if (!v) return;
    const t = auj();
    const b = R.bilanVehicule(E, v, annee, t);
    const fini = annee < R.anneeDe(t);
    const date = fini ? `${annee}-12-31` : t;
    ouvrirModale('Régularisation kilométrique', `
      <p>${esc(v.nom)}, ${annee} : <b>${R.km(b.distance)}</b>. Indemnité au barème <b>${euros(b.exacte)}</b>, comptée au fil de l'eau <b>${euros(b.provisoire)}</b>${b.dejaRegularise ? `, déjà régularisé ${euros(b.dejaRegularise, { signe: true })}` : ''}.</p>
      <p>Régularisation : <b>${euros(b.regularisation, { signe: true })}</b>, ajoutée en frais le ${dateLongue(date)} (note de ${nomMois(date.slice(0, 7)).toLowerCase()}).</p>
      ${fini ? '' : '<p class="aide">L\'année n\'est pas terminée : la distance peut encore changer. En général, la régularisation se fait sur la note de décembre.</p>'}
      ${R.baremePour(E.baremes, annee).exact ? '' : `<p class="aide">Le barème ${annee} n'est pas encore saisi : le calcul utilise celui de l'année précédente. Vérifie la publication officielle avant de régulariser.</p>`}`,
    '<button class="btn primaire" value="ok">Ajouter en frais</button><button class="btn" value="annuler">Annuler</button>', () => {
      retenir();
      E.frais.push(R.normaliserFrais({ id: uid(), date, cat: 'regularisation', montant: b.regularisation, description: `Régularisation des indemnités kilométriques ${annee} · ${v.nom}`, vehicule: v.id, annee, justificatif: 'oui' }, t));
      sauver(); rendre();
      toast(`Régularisation de ${euros(b.regularisation, { signe: true })} ajoutée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Texte simple de la note du mois, à coller dans un message.
  function texteNote() {
    const n = R.noteMois(E, moisNote);
    const l = [`Note de frais de ${nomMois(moisNote).toLowerCase()}${E.nom || E.prenom ? ` · ${E.nom || E.prenom}` : ''}`, `Total : ${euros(n.total)} (frais ${euros(n.ttc)}, kilomètres ${euros(n.ik)} pour ${R.km(n.distance)}). Statut : ${LIB_STATUT_NOTE[n.statut].toLowerCase()}.`, ''];
    if (n.frais.length) { l.push('Frais'); n.frais.forEach((f) => l.push(`- ${dateNum(f.date)} · ${nomCat(f.cat)}${f.description ? ` · ${f.description}` : ''} : ${euros(f.montant)}${f.tva !== null ? ` (TVA ${euros(f.tva)})` : ''}${f.cat !== 'regularisation' && f.justificatif !== 'oui' ? ' [justificatif à fournir]' : ''}`)); l.push(''); }
    if (n.trajets.length) { l.push('Trajets'); n.trajets.forEach((x) => l.push(`- ${dateNum(x.date)} · ${x.depart} → ${x.arrivee}${x.allerRetour ? ' (A/R)' : ''} · ${R.km(x.distance)} : ${euros(x.montant)}`)); l.push(''); }
    if (n.justificatifsManquants) l.push(`${pluriel(n.justificatifsManquants, 'justificatif')} à fournir.`);
    return l.join('\n').trim();
  }

  function modaleRecap() {
    ouvrirModale('Texte à copier', `
      <p class="aide">Texte simple à coller dans un message ou une note. Rien n'est envoyé.</p>
      <label class="champ"><span class="sr-only">Récapitulatif</span><textarea id="recap" rows="14" readonly>${esc(texteNote())}</textarea></label>`,
    '<button class="btn primaire" type="button" data-action="copier">Copier</button><button class="btn" value="annuler">Fermer</button>');
  }

  async function copierRecap() {
    const zone = $('#recap');
    if (!zone) return;
    try { await navigator.clipboard.writeText(zone.value); toast('Texte copié.'); } catch { zone.select(); toast('Sélectionné : copie-le avec Ctrl+C (ou un appui long).'); }
  }

  // Barèmes kilométriques : liste, modification complète, nouvelle année.
  function modaleBaremes() {
    const liste = [...E.baremes].sort((x, y) => y.annee - x.annee);
    ouvrirModale('Barèmes kilométriques', `
      <p class="aide">Un barème par année de trajets. Le barème fiscal d'une année est publié au printemps suivant (impots.gouv.fr, service-public.fr) : en attendant, l'année précédente sert de barème provisoire.</p>
      <ul class="liste-baremes">${liste.map((b) => `<li><div><b>Trajets ${b.annee}</b><span>${esc(b.libelle)}${b.verifie ? '' : ' · à vérifier'}</span></div><button class="btn petit" type="button" data-action="bareme" data-id="${b.id}">Modifier</button></li>`).join('')}</ul>
      <div class="rang"><button class="btn petit" type="button" data-action="bareme-nouveau">Nouveau barème (copie du plus récent)</button></div>`,
    '<button class="btn primaire" value="annuler">Fermer</button>');
  }

  function modaleBareme(id) {
    const b = E.baremes.find((x) => x.id === id);
    if (!b) return;
    const ligne = (type, l, i) => `<tr><th scope="row">${esc(B.lignesBareme[type][i] || `${l.cv} CV`)}</th>${l.tranches.map((tr, k) => `<td><input name="${type}-${i}-${k}-a" inputmode="decimal" value="${coef(tr[0])}" aria-label="${esc(B.lignesBareme[type][i])}, tranche ${k + 1}, coefficient par km"></td><td><input name="${type}-${i}-${k}-b" inputmode="decimal" value="${coef(tr[1])}" aria-label="${esc(B.lignesBareme[type][i])}, tranche ${k + 1}, montant fixe"></td>`).join('')}</tr>`;
    const table = (type, titre) => {
      const [s1, s2] = b.seuils[type];
      return `<fieldset class="champ cadre-champs"><legend>${titre}<small>Indemnité = d × a + b, d = distance de l'année.</small></legend>
        <div class="rang-champs"><label class="champ">1er seuil (km)<input type="number" name="${type}-s1" min="1" value="${s1}"></label><label class="champ">2e seuil (km)<input type="number" name="${type}-s2" min="1" value="${s2}"></label></div>
        <div class="defile"><table class="tableau grille-bareme"><thead><tr><th></th><th colspan="2">d ≤ 1er seuil</th><th colspan="2">entre les seuils</th><th colspan="2">d > 2e seuil</th></tr><tr><th></th>${'<th>a</th><th>b (€)</th>'.repeat(3)}</tr></thead><tbody>${b[type].map((l, i) => ligne(type, l, i)).join('')}</tbody></table></div></fieldset>`;
    };
    ouvrirModale(`Barème des trajets ${b.annee}`, `
      <div class="rang-champs">
        <label class="champ">Année des trajets<input type="number" name="annee" min="2000" max="2100" value="${b.annee}" required></label>
        <label class="champ">Majoration électrique (%)<input name="majorationElectrique" inputmode="decimal" value="${coef(b.majorationElectrique)}"></label>
      </div>
      <label class="champ">Libellé<input name="libelle" maxlength="120" value="${esc(b.libelle)}"></label>
      <label class="champ">Source <small>Texte officiel, adresse de la page, date de relevé.</small><textarea name="source" rows="3" maxlength="600">${esc(b.source)}</textarea></label>
      <div class="rang-champs">
        <label class="champ">Publié le<input type="date" name="publieLe" value="${b.publieLe || ''}"></label>
        <label class="case" style="align-self:flex-end"><input type="checkbox" name="verifie" ${b.verifie ? 'checked' : ''}> Vérifié sur la source officielle</label>
      </div>
      ${table('voiture', 'Voitures')}${table('moto', 'Motos et scooters (plus de 50 cm³)')}${table('cyclo', 'Cyclomoteurs (50 cm³ au plus)')}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${E.baremes.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer le barème des trajets ${b.annee} ?`)) { modale().dataset.garder = '1'; return; }
        retenir();
        E.baremes = E.baremes.filter((x) => x.id !== b.id);
        sauver(); rendre(); toast('Barème supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const annee = Math.round(Number(f.get('annee')));
      if (!(annee >= 2000 && annee <= 2100)) return 'Indique l\'année des trajets.';
      if (E.baremes.some((x) => x.id !== b.id && x.annee === annee)) return `Un barème existe déjà pour ${annee}.`;
      const nb = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
      const maj = nb(f.get('majorationElectrique'));
      if (maj === null || maj > 100) return 'Majoration illisible (entre 0 et 100 %).';
      const nouveau = { ...b, annee, majorationElectrique: maj, libelle: String(f.get('libelle') || '').trim() || `Barème des trajets ${annee}`, source: String(f.get('source') || '').trim(), publieLe: f.get('publieLe') || null, verifie: f.get('verifie') === 'on', seuils: {} };
      for (const type of R.TYPES_VEHICULE) {
        const s1 = Math.round(Number(f.get(`${type}-s1`))), s2 = Math.round(Number(f.get(`${type}-s2`)));
        if (!(s1 > 0 && s2 > s1)) return 'Chaque second seuil doit être supérieur au premier.';
        nouveau.seuils[type] = [s1, s2];
        nouveau[type] = [];
        for (let i = 0; i < b[type].length; i++) {
          const tranches = [];
          for (let k = 0; k < 3; k++) {
            const a2 = nb(f.get(`${type}-${i}-${k}-a`)), b2 = nb(f.get(`${type}-${i}-${k}-b`));
            if (a2 === null || b2 === null) return `Coefficient illisible (${B.lignesBareme[type][i]}, tranche ${k + 1}) : écris par exemple 0,636.`;
            tranches.push([a2, b2]);
          }
          nouveau[type].push({ cv: b[type][i].cv, tranches });
        }
      }
      retenir();
      Object.assign(b, R.normaliserBareme(nouveau, b));
      sauver(); rendre(); toast(`Barème des trajets ${annee} enregistré.`, { libelle: 'Annuler', faire: annuler });
    }, { large: true });
  }

  function nouveauBareme() {
    const plus = [...E.baremes].sort((x, y) => y.annee - x.annee)[0];
    const annee = (plus?.annee || R.anneeDe(auj()) - 1) + 1;
    const modele = plus || B.baremes[0];
    retenir();
    const b = R.normaliserBareme({ ...structuredClone(modele), id: uid(), annee, libelle: `Barème des trajets ${annee}`, source: `Copie du barème ${modele.annee}, à remplacer par la publication officielle de ${annee + 1}.`, verifie: false, publieLe: null, releveLe: null }, modele);
    E.baremes.push(b);
    sauver(); rendre();
    modaleBareme(b.id);
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const b = [...E.baremes].sort((x, y) => y.annee - x.annee)[0];
    const corps = `
      <div class="rang-champs">
        <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
        <label class="champ">Nom sur les notes<input name="nom" maxlength="80" value="${esc(E.nom)}"></label>
      </div>
      <fieldset class="champ"><legend>Profil</legend><div class="choix-statut deux">
        <label><input type="radio" name="profil" value="salarie" ${E.profil === 'salarie' ? 'checked' : ''}><span>Salarié(e)</span></label>
        <label><input type="radio" name="profil" value="independant" ${E.profil === 'independant' ? 'checked' : ''}><span>Indépendant(e)</span></label>
      </div></fieldset>
      <label class="champ">Employeur ou structure qui rembourse <small>Affiché en tête des notes.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <label class="champ">Délai de remboursement attendu (jours)<small>Au-delà, une note soumise est signalée « en attente » dans l'aperçu.</small><input type="number" name="delai" min="1" max="180" step="1" value="${E.reglages.delaiRemboursement}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Barèmes kilométriques</h3><p class="aide">Barème le plus récent : trajets ${b ? `${b.annee} (${esc(b.libelle)})` : 'aucun'}. Modifiable entièrement, un barème par année.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="baremes">Voir et modifier les barèmes</button></div></div>
      <div class="groupe"><h3>Imprimer et exporter</h3><p class="aide">Aucun envoi automatique : imprime la note du mois (ou enregistre-la en PDF depuis la fenêtre d'impression) et exporte en tableur.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="imprimer">Imprimer la note du mois</button><button class="btn petit" type="button" data-action="csv">Tout exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Base intégrée : ${B.categories.filter((c) => !c.interne).length} catégories de frais, 3 types de véhicule, barème kilométrique fiscal (version ${B.version}) : ${esc(B.baremes[0].source)} Justificatifs : ${esc(MENTION_JUSTIF)} Outil d'aide : il ne remplace pas ton service comptable ni un professionnel.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = Math.round(Number(f.get('delai')));
      if (!(n >= 1 && n <= 180)) return 'Le délai doit être entre 1 et 180 jours.';
      E.prenom = String(f.get('prenom') || '').trim();
      E.nom = String(f.get('nom') || '').trim();
      E.structure = String(f.get('structure') || '').trim();
      E.profil = f.get('profil') === 'independant' ? 'independant' : 'salarie';
      E.reglages.delaiRemboursement = n;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.frais) || !Array.isArray(d.trajets)) throw new Error();
        if (!confirm(`Remplacer tes notes de frais actuelles par cette copie (${pluriel(d.frais.length, 'frais', 'frais')}, ${pluriel(d.trajets.length, 'trajet')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide des notes de frais.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `notes-de-frais-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E, nomCat), 'text/csv;charset=utf-8', `notes-de-frais-${auj()}.csv`);
  const exporterCsvMois = () => telecharger(R.versCsv(E, nomCat, (x) => x.date.slice(0, 7) === moisNote), 'text/csv;charset=utf-8', `note-de-frais-${moisNote}.csv`);

  function imprimerNote() {
    if (modale().open) modale().close();
    if (vue !== 'notes') changerVue('notes');
    document.body.classList.add('impression-note');
    setTimeout(() => { window.print(); }, 60);
  }
  window.addEventListener('afterprint', () => document.body.classList.remove('impression-note'));

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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'csv-mois': exporterCsvMois(); break;
      case 'imprimer': imprimerNote(); break;
      case 'recap': modaleRecap(); break;
      case 'copier': copierRecap(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-frais': modaleFrais(null); break;
      case 'ouvrir-frais': modaleFrais(id); break;
      case 'nouveau-trajet': modaleTrajet(null); break;
      case 'ouvrir-trajet': modaleTrajet(id); break;
      case 'vehicule': modaleVehicule(id || null); break;
      case 'regulariser': modaleRegulariser(id, Number(el.dataset.annee)); break;
      case 'baremes': modaleBaremes(); break;
      case 'bareme': modaleBareme(id); break;
      case 'bareme-nouveau': nouveauBareme(); break;
      case 'soumettre': modaleStatutMois('soumis'); break;
      case 'rembourser': modaleStatutMois('rembourse'); break;
      case 'voir-note': moisNote = el.dataset.mois; if (vue !== 'notes') changerVue('notes'); else { rendre(); window.scrollTo({ top: 0 }); } break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      case 'filtre-justif': filtre.statut = 'justif'; filtre.q = ''; changerVue('frais'); break;
      case 'mois-prec': moisNote = R.ajoutMoisCle(moisNote, -1); rendre(); break;
      case 'mois-suiv': moisNote = R.ajoutMoisCle(moisNote, 1); rendre(); break;
      case 'mois-auj': moisNote = auj().slice(0, 7); rendre(); break;
      case 'annee-prec': anneeKm--; rendre(); break;
      case 'annee-suiv': anneeKm++; rendre(); break;
      case 'annee-auj': anneeKm = R.anneeDe(auj()); rendre(); break;
      default: break;
    }
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
  window.__notesDeFrais = { etat: () => E, regles: R };
  init();
})();
