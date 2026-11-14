// Stocks et inventaire QME : articles, mouvements datés, seuils d'alerte, liste à commander,
// valorisation (CMUP ou dernier prix), rotation, inventaire tournant ou complet avec écarts.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à une caisse ni à une boutique.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.STK;
  const API = '/api/templates';
  const PRODUIT = 'STK';
  const CLE_CODE = 'qme-stk-code';
  const CLE_CACHE = 'qme-stk-cache';
  const CLE_DEMO = 'qme-stk-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-stk-ecran-accueil';
  const DEFAUTS = { reglages: B.reglages, categories: B.activites[0].categories };

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
  const { ajout, versDate, euros, nombre, pct } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  // Unité accordée : « 2 pièces », « 3 rouleaux », mais « 2,5 kg ».
  const SYMBOLES = /^(kg|g|L|mL|cL|m|m²|m³|cm|mm|t)$/;
  const unite = (q, u) => {
    if (!u || SYMBOLES.test(u) || Math.abs(q) < 2) return u || '';
    const [m, ...r] = u.split(' ');
    return [/[sxz]$/.test(m) ? m : /(eau|au|eu)$/.test(m) ? `${m}x` : `${m}s`, ...r].join(' ');
  };
  const qte = (q, u) => `${nombre(q)} ${esc(unite(q, u))}`.trim();
  const qteSigne = (q, u) => `${q > 0 ? '+' : ''}${qte(q, u)}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { statut: 'actifs', categorie: '', q: '', type: 'tous', qm: '' };
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  const article = (id) => E.articles.find((a) => a.id === id);
  const nomArticle = (id) => article(id)?.nom || 'Article supprimé';
  const methode = () => E.reglages.methode;
  const libMethode = () => (methode() === 'dernier' ? 'au dernier prix d\'achat' : 'au coût moyen pondéré (CMUP)');
  const enCours = () => E.inventaires.find((i) => i.statut === 'enCours');

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    if (modale().open) modale().close();
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
        toast('Un autre appareil a modifié ton stock entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (STK-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Atelier fictif de bougies avec boutique et vente en ligne : 17 articles et 6 mois de mouvements
  // simulés avec les vraies règles, à des dates relatives à aujourd'hui. États forcés : rupture (mèches),
  // sous le seuil (pots), dormant (mugs), jamais en stock (coffret), archivé, hausse de prix (cire : CMUP ≠
  // dernier prix), petit prix unitaire (0,065 €), quantités décimales (kg, L), pertes, retours client et
  // fournisseur, inventaire complet validé il y a 60 jours, inventaire tournant en cours avec écarts.
  function donneesDemo() {
    const e = etatVide();
    e.entreprise = 'Atelier Exemple';
    e.categories = ['Matières premières', 'Emballages', 'Produits finis', 'Revente', 'Consommables'];
    const t = auj();
    const j = (n) => ajout(t, n);
    let graine = 20261114;
    const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let x = Math.imul(graine ^ (graine >>> 15), 1 | graine); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const CIRE = 'Cires et mèches Exemple', VERRE = 'Verrerie Exemple', CARTON = 'Cartonnages Exemple', IMPR = 'Imprimerie Exemple', DECO = 'Grossiste déco Exemple', ATELIER = 'Fabrication atelier';
    const specs = [
      { ref: 'CIR-SOJ', nom: 'Cire de soja', categorie: 'Matières premières', unite: 'kg', emplacement: 'Atelier', fournisseur: CIRE, prixAchat: 850, seuil: 10, reappro: 25, hebdo: 6, dec: 1, prix: (d) => (d < -70 ? 850 : 920), ecartInv: -0.6 },
      { ref: 'MEC-04', nom: 'Mèche coton n° 4', categorie: 'Matières premières', unite: 'pièce', emplacement: 'Atelier', fournisseur: CIRE, prixAchat: 6, seuil: 200, reappro: 500, hebdo: 70, prix: (d) => (d < -50 ? 6 : 6.5), cible: 0, cibleJour: -6, noteCible: 'Production de la série de Noël', ecartInv: -40 },
      { ref: 'PAR-FIG', nom: 'Parfum figue', categorie: 'Matières premières', unite: 'L', emplacement: 'Atelier', fournisseur: CIRE, prixAchat: 3400, seuil: 1, reappro: 2, hebdo: 0.35, dec: 2 },
      { ref: 'POT-200', nom: 'Pot en verre 200 ml', categorie: 'Emballages', unite: 'pièce', emplacement: 'Réserve', fournisseur: VERRE, prixAchat: 95, seuil: 60, reappro: 120, hebdo: 40, prix: (d) => (d < -40 ? 95 : 102), cible: 38, cibleJour: -2, noteCible: 'Coulage série de Noël', pertes: [[-33, 4, 'Casse']], ecartInv: -3 },
      { ref: 'COU-200', nom: 'Couvercle métal 200 ml', categorie: 'Emballages', unite: 'pièce', emplacement: 'Réserve', fournisseur: VERRE, prixAchat: 22, seuil: 60, reappro: 150, hebdo: 38 },
      { ref: 'BTE-S', nom: 'Boîte d\'expédition S', categorie: 'Emballages', unite: 'pièce', emplacement: 'Réserve', fournisseur: CARTON, prixAchat: 48, seuil: 30, reappro: 100, hebdo: 18 },
      { ref: 'ETQ-RL', nom: 'Étiquettes, rouleau de 500', categorie: 'Emballages', unite: 'rouleau', emplacement: 'Bureau', fournisseur: IMPR, prixAchat: 1800, seuil: 1, reappro: 3, hebdo: 0.15, dec: 0, retours: [[-20, 1, 'retourFournisseur', 'Défaut d\'impression']] },
      { ref: 'BOU-FIG', nom: 'Bougie figue 200 g', categorie: 'Produits finis', unite: 'pièce', emplacement: 'Boutique', fournisseur: ATELIER, prixAchat: 420, prixVente: 1650, seuil: 15, reappro: 24, hebdo: 14, prix: (d) => (d < -20 ? 420 : 445), retours: [[-9, 1, 'retourClient', 'Retour vente en ligne, intacte']], ecartInv: -1 },
      { ref: 'BOU-CED', nom: 'Bougie bois de cèdre 200 g', categorie: 'Produits finis', unite: 'pièce', emplacement: 'Boutique', fournisseur: ATELIER, prixAchat: 430, prixVente: 1650, seuil: 15, reappro: 24, hebdo: 16, prix: (d) => (d < -20 ? 430 : 455), pertes: [[-15, 2, 'Défaut']] },
      { ref: 'DIF-LAV', nom: 'Diffuseur lavande 100 ml', categorie: 'Produits finis', unite: 'pièce', emplacement: 'Boutique', fournisseur: ATELIER, prixAchat: 650, prixVente: 1900, seuil: 8, reappro: 12, hebdo: 5, prix: (d) => (d < -30 ? 650 : 690) },
      { ref: 'FON-CIT', nom: 'Fondants parfumés citron', categorie: 'Produits finis', unite: 'lot', emplacement: 'Boutique', fournisseur: ATELIER, prixAchat: 280, prixVente: 790, seuil: 10, reappro: 20, hebdo: 6, pertes: [[-26, 1, 'Échantillon offert']] },
      { ref: 'COF-3', nom: 'Coffret découverte 3 bougies', categorie: 'Produits finis', unite: 'pièce', emplacement: 'Boutique', fournisseur: ATELIER, prixAchat: 1450, prixVente: 3900, seuil: 0, reappro: 0, vide: true, note: 'Nouveauté de Noël : premier lot prévu la semaine prochaine.' },
      { ref: 'MUG-GRE', nom: 'Mug en grès', categorie: 'Revente', unite: 'pièce', emplacement: 'Boutique', fournisseur: DECO, prixAchat: 780, prixVente: 1800, seuil: 3, reappro: 6, hebdo: 1.4, initial: 20, finVentes: -150 },
      { ref: 'CPO-ILL', nom: 'Carte postale illustrée', categorie: 'Revente', unite: 'pièce', emplacement: 'Boutique', fournisseur: IMPR, prixAchat: 35, prixVente: 125, seuil: 30, reappro: 100, hebdo: 22, prix: (d) => (d < -50 ? 35 : 38), ecartInv: 2 },
      { ref: 'GAN-NIT', nom: 'Gants nitrile, boîte de 100', categorie: 'Consommables', unite: 'boîte', emplacement: 'Atelier', fournisseur: DECO, prixAchat: 690, seuil: 1, reappro: 2, hebdo: 0.3, dec: 0 },
      { ref: 'PAP-SOI', nom: 'Papier de soie, paquet de 240', categorie: 'Consommables', unite: 'lot', emplacement: 'Réserve', fournisseur: CARTON, prixAchat: 450, seuil: 1, reappro: 3, hebdo: 0.4, dec: 0 },
      { ref: 'BOU-PDE', nom: 'Bougie pain d\'épices (édition 2025)', categorie: 'Produits finis', unite: 'pièce', emplacement: 'Réserve', fournisseur: ATELIER, prixAchat: 410, prixVente: 1500, seuil: 0, reappro: 0, inactif: true, initial: 3, hebdo: 0, note: 'Fin de série, retirée de la vente.' },
    ];
    const comptes = new Map();
    const JOUR_INV = -60;
    for (const s of specs) {
      const a = R.normaliserArticle({ id: uid(), ...s });
      e.articles.push(a);
      if (s.vide) continue;
      const mv = (d, type, q, extra = {}) => e.mouvements.push(R.normaliserMouvement({ id: uid(), article: a.id, date: j(d), type, quantite: q, ...extra }));
      const pu = (d) => (s.prix ? s.prix(d) : s.prixAchat);
      const fab = s.fournisseur === ATELIER;
      let st = s.initial ?? (s.seuil + s.reappro);
      mv(-180, 'entree', st, { prix: pu(-180), note: 'Stock de départ' });
      let commande = null; // { jour, q }
      const arr = (q) => (s.dec === undefined ? Math.round(q) : Math.round(q * 10 ** s.dec) / 10 ** s.dec);
      for (let d = -179; d <= -1; d++) {
        if (s.cibleJour !== undefined && d > s.cibleJour) break;
        if (commande && d >= commande.jour) { mv(d, 'entree', commande.q, { prix: pu(d), note: fab ? 'Production atelier' : 'Réception commande' }); st = R.arrondiQ(st + commande.q); commande = null; }
        const jourSemaine = versDate(j(d)).getDay();
        const vend = s.hebdo > 0 && jourSemaine !== 0 && (s.finVentes === undefined || d <= s.finVentes);
        if (vend && alea() < 0.6) {
          // Petits volumes entiers : une unité de temps en temps (même moyenne hebdomadaire).
          const parJour = s.hebdo / 3.6;
          const brut = (s.dec === undefined || s.dec === 0) && parJour < 1.5 ? (alea() < parJour ? 1 : 0) : arr(parJour * (0.5 + alea()));
          const q = Math.min(st, brut);
          if (q > 0) { mv(d, 'sortie', q); st = R.arrondiQ(st - q); }
        }
        for (const [jp, q, note] of s.pertes || []) if (jp === d) { mv(d, 'perte', q, { note }); st = R.arrondiQ(st - q); }
        for (const [jr, q, type, note] of s.retours || []) if (jr === d) { mv(d, type, q, { note }); st = R.arrondiQ(st + (type === 'retourClient' ? q : -q)); }
        if (!commande && !s.inactif && s.seuil > 0 && st <= s.seuil && s.finVentes === undefined) {
          commande = { jour: d + (fab ? 3 : 5), q: R.quantiteACommander(st, s.seuil, s.reappro) };
        }
        if (d === JOUR_INV) { comptes.set(a.id, R.arrondiQ(st + (s.ecartInv || 0))); st = R.arrondiQ(st + (s.ecartInv || 0)); }
        if (d === s.cibleJour && st !== s.cible) {
          if (st > s.cible) mv(d, 'sortie', R.arrondiQ(st - s.cible), { note: s.noteCible });
          else mv(d, 'entree', R.arrondiQ(s.cible - st), { prix: pu(d) });
          st = s.cible;
        }
      }
    }
    // Inventaire complet validé il y a 60 jours (ajustements générés par la validation).
    const inv0 = R.creerInventaire(e, { id: uid(), nom: `Inventaire complet du ${dateCourte(j(JOUR_INV))}`, date: j(JOUR_INV), type: 'complet' });
    inv0.lignes.forEach((l) => { l.compte = comptes.has(l.article) ? comptes.get(l.article) : 0; });
    e.inventaires.push(inv0);
    const v = R.validerInventaire(e, inv0.id, j(JOUR_INV + 1), uid);
    // Inventaire tournant en cours (emballages), compté hier, une ligne pas encore comptée.
    const inv1 = R.creerInventaire(v, { id: uid(), nom: 'Tournant · emballages', date: j(-1), type: 'tournant', critere: { categorie: 'Emballages' } });
    const ecarts = { 'POT-200': -2, 'COU-200': 0, 'BTE-S': 5 };
    for (const l of inv1.lignes) {
      const a = v.articles.find((x) => x.id === l.article);
      if (ecarts[a.ref] === undefined) continue;
      l.compte = Math.max(0, R.stockA(a, v.mouvements, j(-1)) + ecarts[a.ref]);
    }
    v.inventaires.push(inv1);
    return v;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Stocks et inventaire · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="160" width="120" height="120" fill="#1D4E89"/>
          <rect x="20" y="40" width="120" height="100" fill="#F5B400"/>
          <rect x="160" y="200" width="80" height="80" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <rect x="160" y="100" width="80" height="80" fill="#D9302A"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="400" y="160" width="60" height="60" fill="#1D4E89"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Stocks et inventaire</p>
          <h1>Le bon stock, au bon moment.</h1>
          <p>Tes articles, tes entrées et sorties datées, les alertes de seuil, la liste à commander et la valeur de ton stock, sans tableur.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton stock</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton stock est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon stock</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/stocks/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon stock'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, entreprise: '', activite: 'boutique', categories: B.activites[0].categories.join('\n'), methode: 'cmup' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On range ton stock.</h1>
        <p class="intro">Tu crées tes articles, puis tu notes chaque entrée, vente, perte ou retour : le stock, les alertes, la liste à commander et la valeur se calculent. Rien n'est relié à une caisse ni à une boutique en ligne.</p>
        <label class="champ" style="max-width:420px;margin-top:20px">Ton entreprise <small>Facultatif, repris dans les commandes à copier.</small><input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80"></label>
        <fieldset class="champ" style="margin-top:20px;border:0;padding:0"><legend>Ton activité <small>Pour te proposer des catégories, modifiables ensuite.</small></legend>
          <div class="choix-activite">${B.activites.map((x) => `<label><input type="radio" name="activite" value="${x.id}" ${x.id === a.activite ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes catégories et ta valorisation</h1>
        <p class="intro">Une catégorie par ligne. Tu pourras en ajouter depuis une fiche article ou dans les Réglages.</p>
        <label class="champ" style="max-width:420px;margin-top:16px">Catégories<textarea id="categories" rows="7">${esc(a.categories)}</textarea></label>
        <fieldset class="champ" style="margin-top:20px;border:0;padding:0;max-width:720px"><legend>Valeur du stock affichée <small>Les deux sont toujours calculées ; tu changes d'avis dans les Réglages.</small></legend>
          <div class="choix-statut deux">${Object.entries(R.METHODES).map(([k, l]) => `<label><input type="radio" name="methode" value="${k}" ${a.methode === k ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
        </fieldset>
        <p class="aide" style="max-width:720px;margin-top:16px">Le coût moyen pondéré (CMUP) se recalcule à chaque entrée ; le dernier prix d'achat est plus simple mais s'écarte du coût réel quand les prix bougent. Ni l'un ni l'autre ne remplace la valorisation de clôture validée par ton expert-comptable.</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon stock</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    $('#categories')?.addEventListener('input', (e) => { accueil.categories = e.target.value; });
    document.querySelectorAll('[name=activite]').forEach((el) => el.addEventListener('change', () => { accueil.activite = el.value; accueil.categories = B.activites.find((x) => x.id === el.value).categories.join('\n'); }));
    document.querySelectorAll('[name=methode]').forEach((el) => el.addEventListener('change', () => { accueil.methode = el.value; }));
  }

  const lireCategories = (txt) => [...new Set(String(txt || '').split('\n').map((x) => x.trim().slice(0, 60)).filter(Boolean))];

  function terminerAccueil() {
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.categories = lireCategories(accueil.categories);
    E.reglages.methode = accueil.methode === 'dernier' ? 'dernier' : 'cmup';
    accueil = { etape: 1, entreprise: '', activite: 'boutique', categories: B.activites[0].categories.join('\n'), methode: 'cmup' };
    vue = 'articles';
    sauver();
    demarrer();
    toast('Ton stock est prêt. Crée ton premier article.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    articles: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    mouvements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    commandes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    inventaire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['articles', 'Articles'], ['mouvements', 'Mouvements'], ['commandes', 'À commander'], ['inventaire', 'Inventaire']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil de gestion de stock : ce n\'est pas un logiciel comptable. Les valeurs sont calculées à partir de ta saisie (prix hors taxes, méthode choisie dans les Réglages) ; la valorisation comptable du stock à la clôture relève de ton expert-comptable.</p>';
  const COULEUR_STATUT = { rupture: 'rouge', sousSeuil: 'jaune', dormant: 'ciel', ok: 'vert', nouveau: 'sable', inactif: 'sable' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${R.LIB_STATUT[s]}</span>`;
  const COULEUR_TYPE = { entree: 'vert', sortie: 'ciel', perte: 'rose', retourClient: 'beurre-fort', retourFournisseur: 'sable', ajustement: 'jaune' };
  const etiquetteType = (t) => `<span class="etiquette ${COULEUR_TYPE[t]}">${R.TYPES[t].nom}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/stocks/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Stocks et<br>inventaire</span>
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
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Stocks et inventaire`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, articles: vueArticles, mouvements: vueMouvements, commandes: vueCommandes, inventaire: vueInventaire }[vue]();
    brancherInfobulles();
    for (const [sel, cle] of [['#recherche', 'q'], ['#recherche-m', 'qm']]) {
      const q = $(sel);
      if (q) q.addEventListener('input', (e) => { filtre[cle] = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $(sel); n.focus(); n.setSelectionRange(pos, pos); });
    }
    $('#filtre-cat')?.addEventListener('change', (e) => { filtre.categorie = e.target.value; rendre(); });
    brancherComptage();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="40" height="56" fill="#1D4E89"/><rect x="44" y="56" width="40" height="40" fill="#F5B400"/><rect x="44" y="12" width="40" height="40" fill="#D9302A"/></svg>';
  const synth = () => R.synthese(E, auj());

  // ---------- Tableau de bord ----------
  function ligneAlerte(s) {
    const a = s.article;
    return `<li><span class="date-pastille ${s.statut === 'rupture' ? 'retard' : 'alerte'}"><b>${nombre(Math.max(0, s.stock))}</b>${esc(a.unite).slice(0, 6)}</span>
      <button class="lien-ligne" data-action="ouvrir" data-id="${a.id}"><b>${esc(a.nom)}</b><span>${s.statut === 'rupture' ? 'Rupture' : `Sous le seuil de ${qte(a.seuil, a.unite)}`}${s.aCommander ? ` · commander ${qte(s.aCommander, a.unite)}` : ''}${a.fournisseur ? ` · ${esc(a.fournisseur)}` : ''}</span></button>
      <button class="btn petit" data-action="mouvement" data-id="${a.id}" data-type="entree" data-q="${s.aCommander}">Réception</button></li>`;
  }

  function vueTableau() {
    const s = synth();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}Ce qui manque, ce qui dort, et ce que vaut ton stock aujourd'hui.</p></div>
        <div class="actions"><button class="btn primaire" data-action="mouvement">${ICONES.plus}Nouveau mouvement</button></div></div>`;
    if (!E.articles.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun article pour l'instant</h3><p>Crée tes articles (référence, nom, unité, prix d'achat HT, seuil d'alerte) avec leur stock de départ. Ensuite, chaque entrée et chaque vente mettent le stock à jour.</p><div class="actions"><button class="btn primaire" data-action="nouvel-article">${ICONES.plus}Créer un article</button></div></div></div>${AVERTISSEMENT}`;
    }
    const alertes = [...s.ruptures, ...s.sousSeuil];
    const autreMethode = methode() === 'dernier' ? `${euros(s.valeurCmup, { centimes: false })} au CMUP` : `${euros(s.valeurDernier, { centimes: false })} au dernier prix`;
    const tuiles = [
      ['Valeur du stock', euros(s.valeur, { centimes: false }), `${methode() === 'dernier' ? 'au dernier prix d\'achat' : 'au CMUP'} · ${autreMethode}`, 'var(--bleu)', ''],
      ['Alertes', String(alertes.length), `${pluriel(s.ruptures.length, 'rupture')} · ${s.sousSeuil.length} sous le seuil`, 'var(--rouge)', 'rond'],
      ['À commander', euros(s.coutCommande, { centimes: false }), `${pluriel(s.aCommander.length, 'article')} · au dernier prix d'achat`, 'var(--jaune)', ''],
      ['Stock dormant', euros(s.valeurDormante, { centimes: false }), `${pluriel(s.dormants.length, 'article')} sans vente depuis ${E.reglages.joursDormant} jours`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const inv = enCours();
    const r = inv ? R.ecartsInventaire(inv, E) : null;
    const derniers = R.mouvementsTries(E.mouvements).slice(-6).reverse();
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <p class="resume-ventes"><b>Ventes théoriques des ${E.reglages.joursVentes} derniers jours</b> : ${euros(s.ventes.ca, { centimes: false })} HT au prix de vente des fiches, marge théorique ${euros(s.ventes.marge, { centimes: false })}${s.ventes.ca > 0 ? ` (${pct((s.ventes.marge / s.ventes.ca) * 100)})` : ''}. Valeur de vente du stock : ${euros(s.valeurVente, { centimes: false })} HT.</p>
      ${s.negatifs.length ? `<p class="aide alerte-taux">${pluriel(s.negatifs.length, 'article')} en stock négatif (${s.negatifs.map((x) => esc(x.article.nom)).join(', ')}) : une entrée manque sans doute. Vérifie l'historique ou fais un comptage.</p>` : ''}
      ${inv ? `<button class="bandeau-inventaire" data-action="vue" data-vue="inventaire"><span class="etiquette jaune">Inventaire en cours</span><b>${esc(inv.nom)}</b><span>${r.comptees} sur ${pluriel(r.nb, 'article')} comptés · ${pluriel(r.avecEcart, 'écart')} · ${euros(r.valeurNette)} au coût moyen</span></button>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Alertes <span>Rupture ou stock au seuil d'alerte</span></h2>
          ${alertes.length ? `<ul class="prochains">${alertes.slice(0, 6).map(ligneAlerte).join('')}</ul>${alertes.length > 6 ? `<button class="btn lien" data-action="vue" data-vue="commandes">Voir les ${alertes.length} alertes</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune alerte</h3><p>Tous les articles suivis sont au-dessus de leur seuil.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Valeur par catégorie <span>${libMethode()}</span></h2>
          ${graphiqueCategories(s)}
        </section>
      </div>
      ${s.dormants.length ? `<h2 class="titre-section">Stock dormant <span>En stock, sans vente depuis plus de ${E.reglages.joursDormant} jours</span></h2>
      <ul class="prochains">${s.dormants.map((x) => `<li><span class="date-pastille"><b>${x.derniereSortie ? R.ecart(x.derniereSortie, auj()) : '–'}</b>jours</span><button class="lien-ligne" data-action="ouvrir" data-id="${x.article.id}"><b>${esc(x.article.nom)}</b><span>${qte(x.stock, x.article.unite)} · ${x.derniereSortie ? `dernière vente le ${dateLongue(x.derniereSortie)}` : 'jamais vendu'}</span></button><span class="nb">${euros(x.valeur)}</span></li>`).join('')}</ul>` : ''}
      <h2 class="titre-section">Derniers mouvements <span><button class="btn lien" data-action="vue" data-vue="mouvements">Tout le journal</button></span></h2>
      ${derniers.length ? `<ul class="journal">${derniers.map(ligneMouvement).join('')}</ul>` : '<p class="aide">Aucun mouvement noté.</p>'}
      ${AVERTISSEMENT}`;
  }

  // Valeur par catégorie : barres horizontales, une seule série (bleu), valeur au bout, tableau accessible.
  function graphiqueCategories(s) {
    const cats = s.parCategorie;
    const max = Math.max(...cats.map((x) => x.valeur), 1);
    if (!s.valeur) return '<div class="vide-etat petit"><div><h3>Stock sans valeur</h3><p>La valeur apparaît dès qu\'un article en stock a un prix d\'achat.</p></div></div>';
    const barres = cats.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(x.nom)}</b>${euros(x.valeur)} ${libMethode()}<br>${pluriel(x.nb, 'article')} · ${Math.round((x.valeur / s.valeur) * 100)} % du stock`)}">
        <span class="bc-nom">${esc(x.nom)}</span>
        <span class="bc-piste"><span class="bc-barre" style="width:${x.valeur ? Math.max(0.5, (x.valeur / max) * 100) : 0}%"></span></span>
        <span class="bc-val"><b>${euros(x.valeur, { centimes: false })}</b><small>${pluriel(x.nb, 'article')}</small></span>
      </div>`).join('');
    return `<figure class="graphique">
        <div class="barres-cats">${barres}</div>
        <div class="infobulle" hidden></div>
      </figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">Valeur du stock par catégorie</caption><thead><tr><th>Catégorie</th><th class="nb">Articles</th><th class="nb">Valeur</th></tr></thead>
        <tbody>${cats.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.nb}</td><td class="nb">${euros(x.valeur)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${s.nbActifs}</td><td class="nb">${euros(s.valeur)}</td></tr></tfoot></table></div></details>`;
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

  // ---------- Articles ----------
  const FILTRES = [['actifs', 'Tous'], ['alerte', 'À surveiller'], ['rupture', 'Rupture'], ['sousSeuil', 'Sous le seuil'], ['dormant', 'Dormants'], ['inactif', 'Archivés']];
  function garderFiltre(s, f) {
    if (f === 'inactif') return s.statut === 'inactif';
    if (s.statut === 'inactif') return false;
    if (f === 'actifs') return true;
    if (f === 'alerte') return s.statut === 'rupture' || s.statut === 'sousSeuil';
    if (f === 'dormant') return s.dormant;
    return s.statut === f;
  }

  function ligneArticle(s) {
    const a = s.article;
    const tags = [etiquetteStatut(s.statut)];
    if (s.dormant && s.statut !== 'dormant') tags.push('<span class="etiquette ciel">Dormant</span>');
    if (s.negatif) tags.push('<span class="etiquette rouge">Stock négatif</span>');
    if (s.aCommander) tags.push(`<span class="etiquette beurre-fort">Commander ${qte(s.aCommander, a.unite)}</span>`);
    if (s.marge.tauxMarque !== null) tags.push(`<span class="etiquette sable">Marque ${pct(s.marge.tauxMarque)}</span>`);
    const detail = [a.categorie, a.emplacement, a.fournisseur].filter(Boolean).map(esc).join(' · ');
    const classe = s.statut === 'rupture' ? 'alerte-depasse' : s.statut === 'sousSeuil' ? 'alerte-proche' : s.statut === 'inactif' ? 'st-resilie' : '';
    return `<li class="ligne-fac ${classe}">
      <button class="ligne-info" data-action="ouvrir" data-id="${a.id}">
        <b>${esc(a.nom)}${a.ref ? ` <span class="numero">${esc(a.ref)}</span>` : ''}</b>
        <span class="ligne-detail">${detail || 'Sans catégorie'}${a.seuil ? ` · seuil ${qte(a.seuil, a.unite)}` : ''}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${qte(s.stock, a.unite)}</b><small>${s.valeur ? `${euros(s.valeur)} · ${euros(s.cout, { unitaire: true })} l'unité` : 'sans valeur'}</small></span>
        ${a.inactif ? '' : `<button class="btn petit" data-action="mouvement" data-id="${a.id}">Mouvement</button>`}
      </div>
    </li>`;
  }

  function vueArticles() {
    const rangCat = (c) => { const i = E.categories.indexOf(c); return i < 0 ? 999 : i; };
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const toutes = E.articles.map((a) => R.situation(a, E, t));
    const liste = toutes.filter((s) => garderFiltre(s, filtre.statut) && (!filtre.categorie || s.article.categorie === filtre.categorie) && (!q || `${s.article.ref} ${s.article.nom} ${s.article.categorie} ${s.article.emplacement} ${s.article.fournisseur}`.toLowerCase().includes(q)))
      .sort((x, y) => rangCat(x.article.categorie) - rangCat(y.article.categorie) || (x.article.categorie || '').localeCompare(y.article.categorie || '') || x.article.nom.localeCompare(y.article.nom));
    const nb = (id) => toutes.filter((s) => garderFiltre(s, id)).length;
    const cats = [...new Set([...E.categories, ...E.articles.map((a) => a.categorie).filter(Boolean)])];
    const total = liste.reduce((s, x) => s + x.valeur, 0);
    return `
      <div class="vue-tete"><div><h1>Articles</h1><p>Le stock de chaque article se calcule à partir de ses mouvements. Ouvre un article pour son historique, son coût moyen, sa marge et sa rotation. Prix hors taxes.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvel-article">${ICONES.plus}Nouvel article</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par état">${FILTRES.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <div class="rang-recherche">
          <label class="champ"><span class="sr-only">Catégorie</span><select id="filtre-cat"><option value="">Toutes les catégories</option>${cats.map((c) => `<option ${c === filtre.categorie ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Référence, nom, fournisseur" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      ${liste.length ? `<p class="resume-liste">${pluriel(liste.length, 'article')} · ${euros(total)} ${libMethode()}</p><ul class="lignes-fac">${liste.map(ligneArticle).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.articles.length ? 'Aucun article ne correspond' : 'Aucun article'}</h3><p>${E.articles.length ? 'Change le filtre ou la recherche.' : 'Crée ton premier article avec son stock de départ.'}</p><div class="actions"><button class="btn primaire" data-action="nouvel-article">${ICONES.plus}Nouvel article</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Mouvements ----------
  function ligneMouvement(m) {
    const a = article(m.article);
    const d = R.delta(m);
    return `<li><span class="date-pastille"><b>${versDate(m.date).getDate()}</b>${fmt(m.date, { month: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="ouvrir" data-id="${m.article}"><b>${esc(nomArticle(m.article))}</b><span>${R.TYPES[m.type].nom}${m.type === 'entree' && Number.isFinite(m.prix) ? ` à ${euros(m.prix, { unitaire: true })} HT` : ''}${m.note ? ` · ${esc(m.note)}` : ''}</span></button>
      <span class="mvt-q ${d < 0 ? 'neg' : 'pos'}">${qteSigne(d, a?.unite)}</span></li>`;
  }

  const FILTRES_TYPE = [['tous', 'Tous'], ...Object.entries(R.TYPES).map(([k, v]) => [k, v.nom])];
  function vueMouvements() {
    const q = filtre.qm.trim().toLowerCase();
    const tous = R.mouvementsTries(E.mouvements).reverse();
    const liste = tous.filter((m) => (filtre.type === 'tous' || m.type === filtre.type) && (!q || `${nomArticle(m.article)} ${article(m.article)?.ref || ''} ${m.note}`.toLowerCase().includes(q)));
    const montres = liste.slice(0, 150);
    return `
      <div class="vue-tete"><div><h1>Mouvements</h1><p>Le journal de tout ce qui entre et sort, du plus récent au plus ancien. Une saisie datée dans le passé se range à sa date et recalcule le stock et le coût moyen.</p></div>
        <div class="actions"><button class="btn primaire" data-action="mouvement">${ICONES.plus}Nouveau mouvement</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par type">${FILTRES_TYPE.map(([id, lib]) => `<button class="filtre" data-action="filtre-type" data-type="${id}" aria-pressed="${filtre.type === id}">${lib} <small>${id === 'tous' ? tous.length : tous.filter((m) => m.type === id).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-m" type="search" placeholder="Article, référence, note" value="${esc(filtre.qm)}"></label>
      </div>
      ${montres.length ? `<p class="resume-liste">${pluriel(liste.length, 'mouvement')}${liste.length > 150 ? ' · 150 plus récents affichés (export CSV complet dans les Réglages)' : ''}</p>
      <ul class="journal journal-mvt">${montres.map((m) => `${ligneMouvement(m).replace('</li>', '')}<button type="button" class="btn-suppr" data-action="suppr-mvt" data-id="${m.id}" aria-label="Supprimer ce mouvement">×</button></li>`).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.mouvements.length ? 'Aucun mouvement ne correspond' : 'Aucun mouvement'}</h3><p>${E.mouvements.length ? 'Change le filtre ou la recherche.' : 'Note une entrée, une vente ou une perte : le stock se met à jour.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- À commander ----------
  function vueCommandes() {
    const s = synth();
    const groupes = R.commandesParFournisseur(s.aCommander);
    return `
      <div class="vue-tete"><div><h1>À commander</h1><p>Articles à leur seuil d'alerte ou dessous, regroupés par fournisseur. Quantité proposée : le plus petit multiple de la quantité de réapprovisionnement qui repasse au-dessus du seuil (à défaut, de quoi revenir au double du seuil). Coût estimé au dernier prix d'achat HT.</p></div></div>
      ${groupes.length ? `<p class="resume-liste">${pluriel(s.aCommander.length, 'article')} · ${euros(s.coutCommande)} HT estimés</p>
      <div class="grille-commandes">${groupes.map((g, i) => `<section class="commande">
        <div class="commande-tete"><h2>${esc(g.fournisseur)}</h2><b>${euros(g.total)}</b></div>
        <ul class="mini-liste">${g.lignes.map((x) => `<li><span><button type="button" class="btn lien" data-action="ouvrir" data-id="${x.article.id}">${esc(x.article.nom)}</button><br><small>${x.statut === 'rupture' ? 'Rupture' : 'Stock'} ${qte(x.stock, x.article.unite)} · seuil ${qte(x.article.seuil, x.article.unite)}${x.article.reappro ? ` · par ${qte(x.article.reappro, x.article.unite)}` : ''}</small></span><b>${qte(x.aCommander, x.article.unite)}</b><button type="button" class="btn petit" data-action="mouvement" data-id="${x.article.id}" data-type="entree" data-q="${x.aCommander}">Réception</button></li>`).join('')}</ul>
        <div class="rang"><button type="button" class="btn petit" data-action="copier-commande" data-i="${i}">Copier la commande</button></div>
      </section>`).join('')}</div>
      <p class="aide" style="margin-top:20px">« Copier la commande » prépare un texte à coller dans ta messagerie : rien n'est envoyé au fournisseur. À la livraison, « Réception » enregistre l'entrée avec son prix, qui met à jour le coût moyen.</p>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à commander</h3><p>${E.articles.some((a) => a.seuil > 0) ? 'Tous les articles sont au-dessus de leur seuil d\'alerte.' : 'Renseigne un seuil d\'alerte sur tes articles : ils apparaîtront ici quand le stock l\'atteint.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  async function copier(texte, message) {
    try { await navigator.clipboard.writeText(texte); toast(message); } catch { toast('Copie impossible ici : sélectionne le texte à la main.'); }
  }

  // ---------- Inventaire ----------
  function vueInventaire() {
    const inv = enCours();
    const valides = E.inventaires.filter((i) => i.statut === 'valide').sort((a, b) => b.date.localeCompare(a.date));
    const jamais = E.articles.filter((a) => !a.inactif && !R.dernierComptage(a.id, E.inventaires)).length;
    let bloc;
    if (inv) {
      const r = R.ecartsInventaire(inv, E);
      bloc = `<section class="inventaire-encours">
        <div class="inv-tete"><div><span class="etiquette jaune">En cours</span><h2>${esc(inv.nom)}</h2><p>${inv.type === 'complet' ? 'Inventaire complet' : 'Inventaire tournant'} · comptage du ${dateLongue(inv.date)} · stock théorique en fin de journée</p></div>
          <div class="rang"><button class="btn primaire" data-action="valider-inventaire">Valider l'inventaire</button><button class="btn" data-action="abandonner-inventaire">Abandonner</button></div></div>
        <div class="inv-stats" id="inv-stats">${statsInventaire(r)}</div>
        <ul class="lignes-comptage">${r.lignes.map((l) => `<li data-ligne="${l.article.id}">
          <span class="cpt-nom"><b>${esc(l.article.nom)}</b><small>${[l.article.ref, l.article.emplacement].filter(Boolean).map(esc).join(' · ')}</small></span>
          <span class="cpt-theo"><small>Théorique</small><b>${qte(l.theorique, l.article.unite)}</b></span>
          <label class="champ cpt-saisie"><span>Compté</span><input data-compte="${l.article.id}" inputmode="decimal" autocomplete="off" value="${R.saisieQuantite(l.compte)}" placeholder="–" aria-label="Quantité comptée : ${esc(l.article.nom)}"></label>
          <span class="cpt-ecart" data-ecart>${celluleEcart(l)}</span>
        </li>`).join('')}</ul>
        <p class="aide">Saisis ce que tu comptes réellement. À la validation, chaque écart devient un ajustement daté du jour du comptage ; une ligne laissée vide ne change rien.</p>
      </section>`;
    } else {
      bloc = `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun inventaire en cours</h3><p>Complet : tous les articles. Tournant : une catégorie, un emplacement, ou les articles comptés le moins récemment${jamais ? ` (${pluriel(jamais, 'article')} jamais compté${jamais > 1 ? 's' : ''})` : ''}.</p><div class="actions"><button class="btn primaire" data-action="nouvel-inventaire">${ICONES.plus}Commencer un inventaire</button></div></div></div>`;
    }
    return `
      <div class="vue-tete"><div><h1>Inventaire</h1><p>Compte, compare au stock théorique, valide : les écarts deviennent des ajustements. Le comptage annuel reste à faire valider par ton expert-comptable pour la clôture.</p></div>
        ${inv ? '' : `<div class="actions"><button class="btn primaire" data-action="nouvel-inventaire">${ICONES.plus}Nouvel inventaire</button></div>`}</div>
      ${bloc}
      <h2 class="titre-section">Inventaires validés <span>${pluriel(valides.length, 'inventaire')}</span></h2>
      ${valides.length ? `<ul class="journal">${valides.map((i) => { const r = R.ecartsInventaire(i, E); return `<li><span class="date-pastille"><b>${versDate(i.date).getDate()}</b>${fmt(i.date, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="voir-inventaire" data-id="${i.id}"><b>${esc(i.nom)}</b><span>${i.type === 'complet' ? 'Complet' : 'Tournant'} · ${pluriel(r.comptees, 'article')} comptés · ${pluriel(r.avecEcart, 'écart')} · exactitude ${pct(r.exactitude)}</span></button><span class="nb ${r.valeurNette < 0 ? 'neg' : ''}">${euros(r.valeurNette)}</span></li>`; }).join('')}</ul>` : '<p class="aide">Aucun inventaire validé pour l\'instant.</p>'}
      <h2 class="titre-section">Repères</h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      ${AVERTISSEMENT}`;
  }

  function statsInventaire(r) {
    return `<div><span>Comptés</span><b>${r.comptees} / ${r.nb}</b></div><div><span>Avec écart</span><b>${r.avecEcart}</b></div><div><span>Exactitude</span><b>${pct(r.exactitude)}</b></div><div><span>Écart net</span><b class="${r.valeurNette < 0 ? 'neg' : ''}">${euros(r.valeurNette)}</b></div>`;
  }
  function celluleEcart(l) {
    if (l.compte === null) return '<small>À compter</small>';
    if (l.ecart === 0) return '<span class="etiquette vert">Juste</span>';
    return `<b class="${l.ecart < 0 ? 'neg' : 'pos'}">${qteSigne(l.ecart, l.article.unite)}</b><small>${euros(l.valeurEcart)}</small>`;
  }

  // Saisie du comptage : met à jour l'écart de la ligne et les totaux sans tout redessiner.
  function brancherComptage() {
    document.querySelectorAll('[data-compte]').forEach((champ) => {
      champ.addEventListener('input', () => {
        const inv = enCours();
        if (!inv) return;
        const ligne = inv.lignes.find((x) => x.article === champ.dataset.compte);
        const brut = champ.value.trim();
        const v = brut === '' ? null : R.lireQuantite(brut);
        champ.classList.toggle('invalide', brut !== '' && v === null);
        if (brut !== '' && v === null) return;
        ligne.compte = v;
        sauver();
        const r = R.ecartsInventaire(inv, E);
        const l = r.lignes.find((x) => x.article.id === ligne.article);
        champ.closest('li').querySelector('[data-ecart]').innerHTML = celluleEcart(l);
        $('#inv-stats').innerHTML = statsInventaire(r);
      });
    });
  }

  function modaleNouvelInventaire() {
    const cats = [...new Set(E.articles.filter((a) => !a.inactif && a.categorie).map((a) => a.categorie))];
    const emps = [...new Set(E.articles.filter((a) => !a.inactif && a.emplacement).map((a) => a.emplacement))];
    const corps = `
      <fieldset class="champ"><legend>Type</legend><div class="choix-statut deux">${[['tournant', 'Tournant'], ['complet', 'Complet']].map(([k, l], i) => `<label><input type="radio" name="type" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-critere">Articles à compter<select name="critere">
        <optgroup label="Les moins récemment comptés">${[5, 10, 20].map((n) => `<option value="anciens:${n}">Les ${n} articles comptés le moins récemment</option>`).join('')}</optgroup>
        ${cats.length ? `<optgroup label="Une catégorie">${cats.map((c) => `<option value="categorie:${esc(c)}">${esc(c)}</option>`).join('')}</optgroup>` : ''}
        ${emps.length ? `<optgroup label="Un emplacement">${emps.map((c) => `<option value="emplacement:${esc(c)}">${esc(c)}</option>`).join('')}</optgroup>` : ''}
      </select></label>
      <div class="rang-champs">
        <label class="champ">Nom<input name="nom" maxlength="80" placeholder="Ex. : Tournant réserve"></label>
        <label class="champ">Date du comptage<input type="date" name="date" required value="${auj()}"></label>
      </div>
      <p class="aide">Le stock théorique est celui de la fin de la journée du comptage. Une vente notée après cette date ne fausse pas l'écart.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvel inventaire', corps, '<button class="btn primaire" value="ok">Commencer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const type = fd.get('type');
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Indique la date du comptage.';
      let critere = {};
      if (type === 'tournant') {
        const [k, ...v] = String(fd.get('critere') || '').split(':');
        const val = v.join(':');
        critere = k === 'anciens' ? { anciens: Number(val) } : { [k]: val };
      }
      const inv = R.creerInventaire(E, { id: uid(), nom: String(fd.get('nom') || '').trim(), date, type, critere });
      if (!inv.lignes.length) return 'Aucun article à compter avec ce choix.';
      if (!inv.nom || inv.nom === 'Inventaire tournant' || inv.nom === 'Inventaire complet') {
        const lib = type === 'complet' ? 'Inventaire complet' : critere.categorie ? `Tournant · ${critere.categorie}` : critere.emplacement ? `Tournant · ${critere.emplacement}` : `Tournant · ${inv.lignes.length} articles`;
        inv.nom = `${lib} du ${dateCourte(date)}`;
      }
      retenir();
      E.inventaires.push(inv);
      sauver(); changerVue('inventaire');
      toast(`${pluriel(inv.lignes.length, 'article')} à compter.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { d.querySelector('#champ-critere').hidden = d.querySelector('[name=type]:checked').value !== 'tournant'; };
    d.querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', maj));
  }

  function validerInventaire() {
    const inv = enCours();
    if (!inv) return;
    const r = R.ecartsInventaire(inv, E);
    if (!r.comptees) { toast('Aucune ligne comptée : saisis au moins une quantité.'); return; }
    if (!confirm(`Valider « ${inv.nom} » ? ${pluriel(r.avecEcart, 'écart')} ${r.avecEcart > 1 ? 'deviendront des ajustements' : 'deviendra un ajustement'} (${euros(r.valeurNette)} au coût moyen).${r.restantes ? ` ${pluriel(r.restantes, 'ligne')} non comptée${r.restantes > 1 ? 's' : ''} ne change${r.restantes > 1 ? 'nt' : ''} rien.` : ''}`)) return;
    retenir();
    E = R.validerInventaire(E, inv.id, auj(), uid);
    sauver(); rendre();
    toast(`Inventaire validé : ${pluriel(r.avecEcart, 'ajustement')} enregistré${r.avecEcart > 1 ? 's' : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleVoirInventaire(id) {
    const inv = E.inventaires.find((i) => i.id === id);
    if (!inv) return;
    const r = R.ecartsInventaire(inv, E);
    const lignes = r.lignes.filter((l) => l.compte !== null).sort((a, b) => Math.abs(b.valeurEcart) - Math.abs(a.valeurEcart));
    const corps = `
      <p class="mention">${inv.type === 'complet' ? 'Inventaire complet' : 'Inventaire tournant'} · comptage du ${dateLongue(inv.date)} · validé le ${inv.valideLe ? dateLongue(inv.valideLe) : '–'}.</p>
      <div class="inv-stats">${statsInventaire(r)}</div>
      <div class="defile"><table class="tableau petit"><thead><tr><th>Article</th><th class="nb">Théorique</th><th class="nb">Compté</th><th class="nb">Écart</th><th class="nb">Valeur</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr><td>${esc(l.article.nom)}</td><td class="nb">${nombre(l.theorique)}</td><td class="nb">${nombre(l.compte)}</td><td class="nb">${l.ecart ? qteSigne(l.ecart, '') : '0'}</td><td class="nb">${euros(l.valeurEcart)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Écart net (${euros(r.valeurPlus)} en plus, ${euros(r.valeurMoins)} en moins)</td><td class="nb">${euros(r.valeurNette)}</td></tr></tfoot></table></div>
      ${r.restantes ? `<p class="mention">${pluriel(r.restantes, 'ligne')} non comptée${r.restantes > 1 ? 's' : ''}, sans ajustement.</p>` : ''}`;
    ouvrirModale(esc(inv.nom), corps, '<button class="btn primaire" value="annuler">Fermer</button>');
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
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const listeDonnees = (id, valeurs) => `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;

  // Nouvel article (id absent) ou article existant.
  function modaleArticle(id) {
    const a = id ? article(id) : null;
    if (id && !a) return;
    const v = a || { ref: '', nom: '', categorie: filtre.categorie || E.categories[0] || '', unite: 'pièce', emplacement: '', fournisseur: '', prixAchat: null, prixVente: null, seuil: 0, reappro: 0, note: '', inactif: false };
    const cats = [...new Set([...E.categories, ...E.articles.map((x) => x.categorie)])];
    const corps = `
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 150px">Référence<input name="ref" maxlength="30" value="${esc(v.ref)}" placeholder="Ex. : POT-200" autocapitalize="characters"></label>
        <label class="champ">Nom<input name="nom" maxlength="100" required value="${esc(v.nom)}" placeholder="Ex. : Pot en verre 200 ml"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Catégorie<input name="categorie" list="l-cats" maxlength="60" value="${esc(v.categorie)}"></label>
        <label class="champ" style="flex:0 1 140px">Unité<input name="unite" list="l-unites" maxlength="20" value="${esc(v.unite)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Emplacement <small>Rayon, réserve, étagère…</small><input name="emplacement" list="l-emps" maxlength="60" value="${esc(v.emplacement)}"></label>
        <label class="champ">Fournisseur <small>Texte libre.</small><input name="fournisseur" list="l-fourn" maxlength="80" value="${esc(v.fournisseur)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Prix d'achat HT <small>Unitaire ; repris à chaque entrée.</small><input name="prixAchat" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.prixAchat)}" placeholder="0,00"></label>
        <label class="champ">Prix de vente HT <small>Facultatif : marge théorique.</small><input name="prixVente" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.prixVente)}" placeholder="Non vendu"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Seuil d'alerte <small>Alerte quand le stock l'atteint (0 : aucune).</small><input name="seuil" inputmode="decimal" value="${R.saisieQuantite(v.seuil)}"></label>
        <label class="champ">Réapprovisionnement <small>Quantité commandée d'habitude.</small><input name="reappro" inputmode="decimal" value="${R.saisieQuantite(v.reappro)}"></label>
      </div>
      ${a ? '' : `<fieldset class="champ cadre-champs"><legend>Stock de départ <small>Facultatif : enregistré comme une entrée datée, au prix d'achat.</small></legend>
        <div class="rang-champs"><label class="champ">Quantité en stock<input name="initial" inputmode="decimal" placeholder="0"></label><label class="champ">Au<input type="date" name="dateInitial" value="${auj()}"></label></div></fieldset>`}
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${a ? `<label class="case"><input type="checkbox" name="inactif" ${a.inactif ? 'checked' : ''}> Archivé (fin de série : hors alertes, hors valeur, historique gardé)</label>` : ''}
      ${listeDonnees('l-cats', cats)}${listeDonnees('l-unites', [...B.unites, ...E.articles.map((x) => x.unite)])}${listeDonnees('l-emps', E.articles.map((x) => x.emplacement))}${listeDonnees('l-fourn', E.articles.map((x) => x.fournisseur))}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer l\'article</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? `Modifier ${esc(a.nom)}` : 'Nouvel article', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        const n = E.mouvements.filter((m) => m.article === a.id).length;
        if (!confirm(`Supprimer « ${a.nom} »${n ? ` et ses ${pluriel(n, 'mouvement')}` : ''} ? Pour une fin de série, archive-le plutôt : l'historique reste.`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerArticle(E, a.id);
        sauver(); rendre(); toast(`« ${a.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'article.';
      const ref = String(fd.get('ref') || '').trim();
      if (ref && E.articles.some((x) => x.ref.toLowerCase() === ref.toLowerCase() && x.id !== a?.id)) return `La référence ${ref} est déjà utilisée.`;
      const montant = (k) => { const b = String(fd.get(k) || '').trim(); return b ? R.lireMontant(b) : undefined; };
      const pa = montant('prixAchat'), pv = montant('prixVente');
      if (pa === null || pv === null) return 'Prix illisible : écris par exemple 12,50 (hors taxes).';
      const quantite = (k) => { const b = String(fd.get(k) || '').trim(); return b ? R.lireQuantite(b) : 0; };
      const seuil = quantite('seuil'), reappro = quantite('reappro');
      if (seuil === null || reappro === null) return 'Seuil ou quantité de réapprovisionnement illisible.';
      let initial = 0;
      if (!a) {
        initial = quantite('initial');
        if (initial === null) return 'Stock de départ illisible : écris par exemple 12 ou 2,5.';
        if (initial > 0 && !R.estDate(fd.get('dateInitial'))) return 'Indique la date du stock de départ.';
      }
      const categorie = String(fd.get('categorie') || '').trim();
      retenir();
      const donnees = R.normaliserArticle({ id: a?.id || uid(), ref, nom, categorie, unite: fd.get('unite'), emplacement: fd.get('emplacement'), fournisseur: fd.get('fournisseur'), prixAchat: pa ?? null, prixVente: pv ?? null, seuil, reappro, note: fd.get('note'), inactif: !!fd.get('inactif') });
      if (categorie && !E.categories.includes(categorie)) E.categories.push(categorie);
      if (a) Object.assign(a, donnees);
      else {
        E.articles.push(donnees);
        if (initial > 0) E.mouvements.push(R.normaliserMouvement({ id: uid(), article: donnees.id, date: fd.get('dateInitial'), type: 'entree', quantite: initial, prix: donnees.prixAchat, note: 'Stock de départ' }));
      }
      sauver(); rendre();
      toast(a ? `« ${nom} » enregistré.` : `« ${nom} » créé${initial > 0 ? ` avec ${qte(initial, donnees.unite)} en stock` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Fiche d'un article : situation, coûts, marge, rotation, historique.
  function modaleDetail(id) {
    const t = auj();
    const a = article(id);
    if (!a) return;
    const s = R.situation(a, E, t);
    const rot = R.rotation(a, E.mouvements, t, E.reglages.joursRotation);
    const compte = R.dernierComptage(a.id, E.inventaires);
    const lignes = [...s.historique.lignes].reverse().slice(0, 40);
    const corps = `
      <div class="resume-facture">
        <div><span>Stock</span><b>${qte(s.stock, a.unite)}</b><small>${etiquetteStatut(s.statut)}${a.seuil ? ` seuil ${qte(a.seuil, a.unite)}` : ''}</small></div>
        <div><span>Valeur</span><b>${euros(s.valeur)}</b><small>${libMethode()}</small></div>
        <div><span>Coût moyen (CMUP)</span><b>${euros(s.cmup, { unitaire: true })}</b><small>Dernier prix d'achat : ${euros(s.dernierPrix, { unitaire: true })}</small></div>
        <div><span>Prix de vente HT</span><b>${euros(a.prixVente, { unitaire: true })}</b><small>${s.marge.unitaire === null ? 'Pas de prix de vente' : `Marge ${euros(s.marge.unitaire, { unitaire: true })} · marque ${pct(s.marge.tauxMarque)}${s.marge.coefficient ? ` · coef. ${String(s.marge.coefficient).replace('.', ',')}` : ''}`}</small></div>
        <div><span>Rotation ${E.reglages.joursRotation} j</span><b>${rot.rotation === null ? '–' : String(rot.rotation).replace('.', ',')}</b><small>Ventes : ${qte(rot.sorties, a.unite)} · ${rot.couverture === null ? 'couverture –' : `${pluriel(rot.couverture, 'jour')} de stock`}</small></div>
        <div><span>Dernière vente</span><b>${s.derniereSortie ? dateCourte(s.derniereSortie) : 'Jamais'}</b><small>${s.dormant ? 'Dormant' : ''}${s.dormant && compte ? ' · ' : ''}${compte ? `compté le ${dateCourte(compte)}` : (s.dormant ? '' : 'Jamais compté')}</small></div>
      </div>
      ${[a.ref && `Réf. ${esc(a.ref)}`, a.categorie, a.emplacement, a.fournisseur].filter(Boolean).length ? `<p class="mention">${[a.ref && `Réf. ${esc(a.ref)}`, esc(a.categorie), esc(a.emplacement), a.fournisseur && `Fournisseur : ${esc(a.fournisseur)}`].filter(Boolean).join(' · ')}</p>` : ''}
      ${a.note ? `<p class="aide">${esc(a.note)}</p>` : ''}
      ${s.aCommander ? `<p class="aide">À commander : <b>${qte(s.aCommander, a.unite)}</b>${s.coutCommande ? `, environ ${euros(s.coutCommande)} HT au dernier prix` : ''}.</p>` : ''}
      ${a.inactif ? '' : `<div class="rang">${Object.keys(R.TYPES).map((k) => `<button type="button" class="btn petit ${k === 'entree' ? 'primaire' : ''}" data-action="mouvement" data-id="${a.id}" data-type="${k}">${R.TYPES[k].nom}</button>`).join('')}</div>`}
      <section class="bloc-detail"><h3>Historique <span>${pluriel(s.historique.lignes.length, 'mouvement')}</span></h3>
        ${lignes.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th>Mouvement</th><th class="nb">Quantité</th><th class="nb">Stock</th><th class="nb">CMUP</th><th></th></tr></thead>
        <tbody>${lignes.map((l) => `<tr><td>${dateCourte(l.m.date)}</td><td>${R.TYPES[l.m.type].nom}${l.m.type === 'entree' && Number.isFinite(l.m.prix) ? ` à ${euros(l.m.prix, { unitaire: true })}` : ''}${l.m.note ? `<br><small>${esc(l.m.note)}</small>` : ''}</td><td class="nb">${qteSigne(l.delta, '')}</td><td class="nb">${nombre(l.stock)}</td><td class="nb">${euros(l.cmup, { unitaire: true })}</td><td><button type="button" class="btn-suppr" data-action="suppr-mvt" data-id="${l.m.id}" data-retour="${a.id}" aria-label="Supprimer ce mouvement">×</button></td></tr>`).join('')}</tbody></table></div>${s.historique.lignes.length > 40 ? '<p class="mention">40 derniers mouvements affichés.</p>' : ''}` : '<p class="mention">Aucun mouvement : note une entrée pour mettre l\'article en stock.</p>'}
      </section>`;
    ouvrirModale(esc(a.nom), corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier" data-id="${a.id}">Modifier la fiche</button>`);
  }

  // Saisie d'un mouvement (article choisi ou à choisir).
  function modaleMouvement(articleId, type = 'sortie', quantite = '') {
    const actifs = E.articles.filter((x) => !x.inactif).sort((x, y) => x.nom.localeCompare(y.nom));
    if (!actifs.length) { toast('Crée d\'abord un article.'); modaleArticle(null); return; }
    const a0 = article(articleId) || actifs[0];
    const corps = `
      <label class="champ">Article<select name="article" id="mvt-article">${actifs.map((x) => `<option value="${x.id}" ${x.id === a0.id ? 'selected' : ''}>${esc(x.nom)}${x.ref ? ` (${esc(x.ref)})` : ''}</option>`).join('')}</select></label>
      <fieldset class="champ"><legend>Mouvement</legend><div class="choix-statut trois">${B.mouvements.map((m) => `<label title="${esc(m.detail)}"><input type="radio" name="type" value="${m.id}" ${m.id === type ? 'checked' : ''}><span>${esc(m.nom)}</span></label>`).join('')}</div></fieldset>
      <p class="mention" id="mvt-detail"></p>
      <div class="rang-champs">
        <label class="champ"><span id="lib-q">Quantité</span><input name="quantite" id="mvt-q" inputmode="decimal" autocomplete="off" required value="${R.saisieQuantite(quantite === '' ? null : Number(quantite))}" placeholder="0"></label>
        <label class="champ">Date<input type="date" name="date" required value="${auj()}"></label>
      </div>
      <label class="champ" id="champ-prix">Prix d'achat unitaire HT <small>Met à jour le coût moyen pondéré.</small><input name="prix" id="mvt-prix" inputmode="decimal" autocomplete="off"></label>
      <label class="champ" id="champ-motif">Motif<select name="motif">${B.motifsPerte.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
      <label class="champ">Note <small>Facultative (n° de bon, client, commande…).</small><input name="note" maxlength="200"></label>
      <p class="aide" id="mvt-apres"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouveau mouvement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const a = article(fd.get('article'));
      if (!a) return 'Choisis un article.';
      const ty = fd.get('type');
      const q = R.lireQuantite(fd.get('quantite'), { signe: ty === 'ajustement' });
      if (q === null || q === 0) return ty === 'ajustement' ? 'Quantité illisible : écris par exemple -3 ou +2.' : 'Quantité illisible : écris par exemple 12 ou 2,5.';
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Indique la date du mouvement.';
      let prix = null;
      if (ty === 'entree') {
        const b = String(fd.get('prix') || '').trim();
        prix = b ? R.lireMontant(b) : a.prixAchat;
        if (b && prix === null) return 'Prix illisible : écris par exemple 0,95 (hors taxes).';
      }
      const note = [ty === 'perte' ? fd.get('motif') : '', String(fd.get('note') || '').trim()].filter(Boolean).join(' · ');
      retenir();
      E.mouvements.push(R.normaliserMouvement({ id: uid(), article: a.id, date, type: ty, quantite: q, prix, note }));
      sauver(); rendre();
      const st = R.stockA(a, E.mouvements, auj());
      toast(`${R.TYPES[ty].nom} de ${qte(Math.abs(q), a.unite)} : ${a.nom} à ${qte(st, a.unite)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const a = article(d.querySelector('#mvt-article').value);
      const ty = d.querySelector('[name=type]:checked').value;
      const def = B.mouvements.find((m) => m.id === ty);
      const h = R.historique(a, E.mouvements, auj());
      d.querySelector('#champ-prix').hidden = ty !== 'entree';
      d.querySelector('#champ-motif').hidden = ty !== 'perte';
      d.querySelector('#lib-q').textContent = ty === 'ajustement' ? `Correction (+ ou −, en ${a.unite})` : `Quantité (${a.unite})`;
      d.querySelector('#mvt-detail').textContent = `${def.detail}.${ty === 'retourFournisseur' ? ' Sortie au coût moyen du moment (simplification).' : ''}`;
      const prix = d.querySelector('#mvt-prix');
      if (!prix.dataset.touche) prix.value = R.saisieMontant(h.dernierPrix);
      const q = R.lireQuantite(d.querySelector('#mvt-q').value, { signe: ty === 'ajustement' });
      const dq = q === null ? 0 : R.delta({ type: ty, quantite: q });
      d.querySelector('#mvt-apres').innerHTML = `Stock actuel : <b>${qte(h.stock, a.unite)}</b>${q ? ` → après : <b>${qte(R.arrondiQ(h.stock + dq), a.unite)}</b>` : ''}${h.stock + dq < 0 ? ' · le stock deviendrait négatif : vérifie la quantité.' : ''}`;
    };
    d.querySelector('#mvt-prix').addEventListener('input', (e) => { e.target.dataset.touche = '1'; });
    d.querySelector('#mvt-article').addEventListener('change', () => { delete d.querySelector('#mvt-prix').dataset.touche; maj(); });
    d.querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', maj));
    d.querySelector('#mvt-q').addEventListener('input', maj);
    maj();
  }

  function supprimerMouvement(id, retour) {
    const m = E.mouvements.find((x) => x.id === id);
    if (!m) return;
    if (m.inventaire && !confirm('Ce mouvement vient de la validation d\'un inventaire. Le supprimer quand même ?')) return;
    retenir();
    E.mouvements = E.mouvements.filter((x) => x.id !== id);
    sauver(); rendre();
    if (retour) modaleDetail(retour);
    toast(`${R.TYPES[m.type].nom} supprimée : ${nomArticle(m.article)}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <label class="champ">Ton entreprise<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
      <fieldset class="champ"><legend>Valeur du stock affichée <small>Les deux restent calculées (tableau de bord, export CSV).</small></legend>
        <div class="choix-statut deux">${Object.entries(R.METHODES).map(([k, l]) => `<label><input type="radio" name="methode" value="${k}" ${r.methode === k ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Dormant après (jours sans vente)<input type="number" name="joursDormant" min="7" max="730" value="${r.joursDormant}"></label>
        <label class="champ">Période de rotation (jours)<input type="number" name="joursRotation" min="7" max="730" value="${r.joursRotation}"></label>
        <label class="champ">Ventes du tableau de bord (jours)<input type="number" name="joursVentes" min="1" max="365" value="${r.joursVentes}"></label>
      </div>
      <label class="champ">Catégories <small>Une par ligne. Retirer une catégorie ne change pas les articles qui la portent.</small><textarea name="categories" rows="5">${esc(E.categories.join('\n'))}</textarea></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte en tableur (CSV, point-virgule) l'état du stock avec les deux valorisations, ou le journal complet des mouvements.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-articles">État du stock (CSV)</button><button class="btn petit" type="button" data-action="csv-mouvements">Mouvements (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton stock est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, en réserve ou en boutique.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucune connexion à une caisse, une boutique en ligne ou un logiciel comptable : chaque mouvement se saisit ici. Outil de gestion, pas un logiciel comptable ; la valorisation du stock à la clôture relève de ton expert-comptable. Méthodes : coût moyen pondéré recalculé à chaque entrée, ou dernier prix d'achat ; la méthode PEPS n'est pas calculée.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Math.round(Number(fd.get(nom))); return n >= min && n <= max ? n : null; };
      const joursDormant = ent('joursDormant', 7, 730), joursRotation = ent('joursRotation', 7, 730), joursVentes = ent('joursVentes', 1, 365);
      if (joursDormant === null || joursRotation === null || joursVentes === null) return 'Vérifie les durées (nombres de jours).';
      retenir();
      E.entreprise = String(fd.get('entreprise') || '').trim();
      E.categories = lireCategories(fd.get('categories'));
      Object.assign(E.reglages, { methode: fd.get('methode') === 'dernier' ? 'dernier' : 'cmup', joursDormant, joursRotation, joursVentes });
      sauver(); rendre();
      toast(`Réglages enregistrés : valeur affichée ${libMethode()}.`, { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.articles) || !Array.isArray(d.mouvements)) throw new Error();
        if (!confirm(`Remplacer ton stock actuel par cette copie (${pluriel(d.articles.length, 'article')}, ${pluriel(d.mouvements.length, 'mouvement')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du stock.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `stocks-${auj()}.json`);

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
      case 'accueil-fin': accueil.categories = $('#categories')?.value ?? accueil.categories; terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-articles': telecharger(R.versCsvArticles(E, auj()), 'text/csv;charset=utf-8', `stock-${auj()}.csv`); break;
      case 'csv-mouvements': telecharger(R.versCsvMouvements(E), 'text/csv;charset=utf-8', `mouvements-stock-${auj()}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'nouvel-article': modaleArticle(null); break;
      case 'ouvrir': modaleDetail(id); break;
      case 'modifier': modaleArticle(id); break;
      case 'mouvement': modaleMouvement(id, el.dataset.type || (id ? 'sortie' : 'sortie'), el.dataset.q || ''); break;
      case 'suppr-mvt': supprimerMouvement(id, el.dataset.retour); break;
      case 'copier-commande': { const g = R.commandesParFournisseur(synth().aCommander)[Number(el.dataset.i)]; if (g) copier(R.texteCommande(g, E.entreprise), `Commande ${g.fournisseur} copiée : colle-la dans ta messagerie.`); break; }
      case 'nouvel-inventaire': if (enCours()) changerVue('inventaire'); else modaleNouvelInventaire(); break;
      case 'valider-inventaire': validerInventaire(); break;
      case 'abandonner-inventaire': { const inv = enCours(); if (inv && confirm(`Abandonner « ${inv.nom} » ? Les quantités comptées seront perdues, le stock ne change pas.`)) { retenir(); E.inventaires = E.inventaires.filter((x) => x.id !== inv.id); sauver(); rendre(); toast('Inventaire abandonné.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'voir-inventaire': modaleVoirInventaire(id); break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      case 'filtre-type': filtre.type = el.dataset.type; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !document.activeElement?.matches?.('[data-compte]')) rendre(); // la date du jour a pu changer
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
  window.__stocks = { etat: () => E, regles: R };
  init();
})();
