// Inventaire valorisé QME : combien valent réellement les objets que tu possèdes.
// Règles de valorisation dans calculs.js (window.PTM_CALCUL), testées par outils/templates/patrimoine.test.mjs.
// Trois accès : clé de licence (application complète, données synchronisées), démo (données fictives, tout ouvert),
// découverte gratuite (tes propres objets, 10 au plus, sur cet appareil seulement).
(() => {
  'use strict';
  const B = window.BASE;
  const C = window.PTM_CALCUL;
  const API = '/api/templates';
  const PRODUIT = 'PTM';
  const CLE_CODE = 'qme-ptm-code';
  const CLE_CACHE = 'qme-ptm-cache';
  const CLE_DEMO = 'qme-ptm-demo';
  const CLE_DECOUVERTE = 'qme-ptm-decouverte';
  const CLE_ACCUEIL = 'qme-ptm-ecran-accueil';
  const CODE_DEMO = 'DEMO';
  const CODE_DECOUVERTE = 'DECOUVERTE';
  const PAGE_OFFRE = '/catalogue/patrimoine/';
  const PRIX = '19 €';
  const MAX_SIMULATIONS = 5;

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${NF.format(n)} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const auj = () => iso(new Date());
  const decaler = (mois) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + mois); return d; };
  const moisIso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}`;
  const fmtDate = (s) => { const [a, m, j] = String(s).split('-').map(Number); return new Date(a, (m || 1) - 1, j || 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); };
  const fmtMois = (s) => { const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(String(s || '')); if (!m) return ''; return m[2] ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : m[1]; };
  const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const euros = (n) => `${NF.format(Math.round(Number(n) || 0))} €`;
  const pct = (x) => `${NF.format(Math.round((Number(x) || 0) * 100))} %`;
  const lireNombre = (v) => { const s = String(v ?? '').replace(/[\s  €%]/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const champNombre = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace('.', ','));
  const telecharger = (nom, contenu, type) => {
    const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nom; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const categorie = (id) => B.categories.find((c) => c.id === id) || B.categories.at(-1);
  const sousCat = (cid, sid) => categorie(cid).sous.find((s) => s.id === sid) || null;
  const etatNom = (id) => E.coefs.etats.find((e) => e.id === id)?.nom || '—';
  const usageNom = (id) => B.usages.find((u) => u.id === id)?.nom || '—';
  const familleNom = (id) => E.coefs.familles.find((f) => f.id === id)?.nom || id;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, decouverte: false, base: null, memoriser: true };
  let vue = 'bilan';
  let annulation = null;
  let filtre = { texte: '', categorie: '' };
  const complet = () => !session.decouverte;

  const coefsDefaut = () => ({ familles: structuredClone(B.familles), etats: structuredClone(B.etats), tranchesPrix: structuredClone(B.tranchesPrix), reventeFacile: structuredClone(B.reventeFacile) });
  const simulationVide = (nom) => ({ id: uid(), nom, perimetre: 'tous', cible: null, ...structuredClone(B.simulationDefaut) });
  const etatVide = () => ({ version: 1, categoriesPossedees: [], objets: [], coefs: coefsDefaut(), seuilValeur: B.seuilValeur, simulations: [], simActive: null, historique: [], partage: { montants: true, repartition: true, nombre: true, revente: true } });

  const fusionParId = (defaut, saisi) => defaut.map((d) => ({ ...d, ...((Array.isArray(saisi) ? saisi : []).find((s) => s && s.id === d.id) || {}) }));
  function normaliserCoefs(c) {
    const d = coefsDefaut();
    if (!c || typeof c !== 'object') return d;
    const tranches = Array.isArray(c.tranchesPrix) && c.tranchesPrix.length === d.tranchesPrix.length ? d.tranchesPrix.map((t, i) => ({ ...t, mult: Number.isFinite(Number(c.tranchesPrix[i]?.mult)) ? Number(c.tranchesPrix[i].mult) : t.mult })) : d.tranchesPrix;
    return { familles: fusionParId(d.familles, c.familles), etats: fusionParId(d.etats, c.etats), tranchesPrix: tranches, reventeFacile: { ...d.reventeFacile, ...(c.reventeFacile || {}) } };
  }
  const normaliserObjet = (o) => ({ id: o.id || uid(), nom: String(o.nom || 'Objet'), categorie: B.categories.some((c) => c.id === o.categorie) ? o.categorie : 'autres', sousCategorie: o.sousCategorie || null,
    marque: o.marque || '', description: o.description || '', quantite: Math.max(1, Math.round(Number(o.quantite) || 1)), dateAchat: o.dateAchat || '', ageAchat: Number(o.ageAchat) || 0,
    prixAchat: o.prixAchat ?? null, etat: o.etat || 'bon', usage: o.usage || 'mensuel', valeurManuelle: o.valeurManuelle ?? null, reventeManuelle: o.reventeManuelle ?? null,
    famille: o.famille || null, commentaires: o.commentaires || '', creeLe: o.creeLe || auj() });
  function normaliser(d) {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d, coefs: normaliserCoefs(d.coefs), objets: Array.isArray(d.objets) ? d.objets.map(normaliserObjet) : [],
      categoriesPossedees: Array.isArray(d.categoriesPossedees) ? d.categoriesPossedees.filter((id) => B.categories.some((c) => c.id === id)) : [],
      simulations: Array.isArray(d.simulations) ? d.simulations.slice(0, MAX_SIMULATIONS).map((s) => ({ ...simulationVide('Scénario'), ...s })) : [],
      historique: Array.isArray(d.historique) ? d.historique : [], partage: { ...v.partage, ...(d.partage || {}) } };
    if (!n.simulations.some((s) => s.id === n.simActive)) n.simActive = n.simulations[0]?.id ?? null;
    return n;
  }
  const bilan = (ref = auj()) => C.bilan(E.objets, E.coefs, B, ref, E.seuilValeur);
  const valoriser = (o) => C.valoriser(o, E.coefs, B, auj());
  const coefsModifies = () => JSON.stringify(normaliserCoefs(E.coefs)) !== JSON.stringify(coefsDefaut());

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';
  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    if (session.decouverte) { stock.ecrire(CLE_DECOUVERTE, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }
  function sauver() {
    cache(true);
    if (session.demo || session.decouverte) return;
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
    if (session.demo || session.decouverte) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees); session.base = corps.donnees.majLe; cache(false); rendre();
        toast('Un autre appareil a modifié ton inventaire entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.');
      } else if (statut === 401) { deconnecter('Ce code d\'accès n\'est plus valide.'); return; }
      else if (statut !== 200) throw new Error(String(statut));
      else { session.base = corps.majLe; cache(false); }
      majSync('ok');
    } catch { majSync('horsligne'); } finally {
      envoiEnCours = false;
      if (aRenvoyer) { aRenvoyer = false; envoyer(); }
    }
  }
  async function rafraichir() {
    if (session.demo || session.decouverte || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees); session.base = corps.donnees.majLe; cache(false);
        if (!document.activeElement?.matches('input,select,textarea') && !modale().open) rendre();
      }
    } catch { majSync('horsligne'); }
  }
  function majSync(etat) {
    etatSync = etat;
    const el = $('.sync');
    if (!el) return;
    const libelles = { ok: 'Enregistré', attente: 'Modifié', envoi: 'Enregistrement…', horsligne: 'Hors ligne', demo: 'Démo locale', decouverte: 'Sur cet appareil' };
    el.dataset.etat = etat;
    el.querySelector('b').textContent = libelles[etat];
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes modifications sont gardées sur cet appareil et seront envoyées au retour du réseau.'
      : etat === 'decouverte' ? 'Découverte gratuite : tes objets restent dans ce navigateur, rien n\'est envoyé.' : libelles[etat];
  }

  // ---------- Connexion ----------
  const estCodeInterne = (n) => /^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3));
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (estCodeInterne(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCodeInterne(n) && n.length === 19) || /^[0-9A-F]{32}$/.test(n); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (statut === 403) throw new Error(corps?.erreur || 'Cette clé n\'est plus valide (achat remboursé ou contesté).');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.decouverte = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }
  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      if (aCommence()) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && aCommence()) { cache(false); demarrer(); } else ecranAccueil();
  }
  const aCommence = () => E && (E.objets.length > 0 || E.categoriesPossedees.length > 0);

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.decouverte = false; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && Array.isArray(d.objets) && d.objets.length ? normaliser(d) : donneesDemo();
    cache();
    demarrer();
  }
  function ouvrirDecouverte() {
    session.decouverte = true; session.demo = false; session.code = null; session.jeton = null;
    stock.ecrire(CLE_CODE, CODE_DECOUVERTE);
    const d = stock.lire(CLE_DECOUVERTE);
    E = d ? normaliser(d) : null;
    if (E && aCommence()) demarrer(); else ecranAccueil();
  }
  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo && !session.decouverte) stock.suppr(CLE_CACHE);
    Object.assign(session, { code: null, jeton: null, demo: false, decouverte: false, base: null });
    E = null;
    document.body.classList.remove('app');
    if (modale().open) modale().close();
    ecranConnexion(message);
  }

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    const e = etatVide();
    const ilYa = (mois) => moisIso(decaler(-mois));
    const o = (nom, cat, sous, prix, mois, etat, usage, extra = {}) => normaliserObjet({ id: uid(), nom, categorie: cat, sousCategorie: sous, prixAchat: prix, dateAchat: ilYa(mois), etat, usage, quantite: 1, ...extra });
    e.categoriesPossedees = ['informatique', 'telephonie', 'electromenager', 'mobilier', 'vetements', 'sports', 'musique', 'outillage', 'livres', 'jeux', 'bijoux', 'jardin'];
    e.objets = [
      o('Ordinateur portable', 'informatique', 'portables', 1450, 20, 'tres-bon', 'quotidien', { marque: 'Marque fictive A' }),
      o('Écran 27 pouces', 'informatique', 'ecrans', 320, 32, 'bon', 'quotidien'),
      o('Tablette', 'informatique', 'tablettes', 680, 44, 'bon', 'rare', { commentaires: 'Ne sert presque plus depuis l\'achat de l\'ordinateur.' }),
      o('Téléviseur 55 pouces', 'informatique', 'tv', 899, 38, 'tres-bon', 'quotidien'),
      o('Appareil photo hybride', 'informatique', 'photo', 1190, 54, 'tres-bon', 'rare'),
      o('Objectif 50 mm', 'informatique', 'photo', 420, 54, 'tres-bon', 'jamais'),
      o('Imprimante', 'informatique', 'ecrans', 129, 70, 'hs', 'jamais', { commentaires: 'Tête d\'impression bloquée.' }),
      o('Smartphone', 'telephonie', 'smartphones', 1029, 9, 'comme-neuf', 'quotidien'),
      o('Montre connectée', 'telephonie', 'montres', 399, 26, 'bon', 'hebdo'),
      o('Écouteurs sans fil', 'telephonie', 'ecouteurs', 249, 15, 'tres-bon', 'quotidien'),
      o('Lave-linge', 'electromenager', 'gros', 549, 48, 'bon', 'hebdo'),
      o('Réfrigérateur', 'electromenager', 'gros', 790, 62, 'bon', 'quotidien'),
      o('Robot pâtissier', 'electromenager', 'cuisine', 579, 30, 'comme-neuf', 'jamais', { commentaires: 'Cadeau, utilisé deux fois.' }),
      o('Machine à café', 'electromenager', 'cuisine', 349, 18, 'tres-bon', 'quotidien'),
      o('Aspirateur balai', 'electromenager', 'entretien', 399, 22, 'bon', 'hebdo'),
      o('Canapé trois places', 'mobilier', 'salon', 1290, 40, 'bon', 'quotidien'),
      o('Table et six chaises', 'mobilier', 'repas', 980, 75, 'correct', 'quotidien'),
      o('Bureau assis-debout', 'mobilier', 'bureau', 520, 28, 'tres-bon', 'quotidien'),
      o('Lit et matelas', 'mobilier', 'chambre', 1150, 50, 'bon', 'quotidien'),
      o('Manteau d\'hiver', 'vetements', 'manteaux', 260, 25, 'bon', 'mensuel'),
      o('Baskets', 'vetements', 'chaussures', 120, 6, 'tres-bon', 'hebdo', { quantite: 3 }),
      o('Costume', 'vetements', 'tenues', 380, 60, 'tres-bon', 'jamais'),
      o('Vélo de route', 'sports', 'velos', 1890, 36, 'tres-bon', 'rare', { commentaires: 'Sorti trois fois l\'été dernier.' }),
      o('Tapis de course', 'sports', 'fitness', 990, 34, 'bon', 'jamais'),
      o('Skis et chaussures', 'sports', 'hiver', 640, 80, 'correct', 'rare'),
      o('Guitare électrique', 'musique', 'cordes', 750, 96, 'bon', 'rare'),
      o('Piano numérique', 'musique', 'claviers', 1100, 58, 'tres-bon', 'mensuel'),
      o('Perceuse-visseuse', 'outillage', 'electroportatif', 189, 42, 'bon', 'mensuel'),
      o('Scie circulaire', 'outillage', 'electroportatif', 239, 42, 'tres-bon', 'rare'),
      o('Collection de BD', 'livres', 'bd', 1200, 120, 'tres-bon', 'rare', { valeurManuelle: 900, reventeManuelle: 650, commentaires: 'Valeur saisie à la main d\'après des annonces comparables (exemple fictif).' }),
      o('Collection de vinyles', 'livres', 'disques', 800, 150, 'bon', 'mensuel', { valeurManuelle: 950 }),
      o('Console de salon', 'jeux', 'consoles', 499, 24, 'tres-bon', 'hebdo'),
      o('Jeux de société', 'jeux', 'societe', 45, 30, 'bon', 'mensuel', { quantite: 12 }),
      o('Montre automatique', 'bijoux', 'montres-classiques', 1600, 84, 'tres-bon', 'rare'),
      o('Tondeuse robot', 'jardin', 'motoculture', 899, 30, 'bon', 'hebdo'),
      o('Salon de jardin', 'jardin', 'mobilier-jardin', 690, 46, 'correct', 'rare', { ageAchat: 2, description: 'Acheté d\'occasion, âgé de deux ans à l\'achat.' }),
    ];
    // Historique : valorisations passées calculées avec les vraies règles, objets possédés à chaque date.
    const passe = [18, 12, 6, 3];
    e.historique = passe.map((m) => {
      const d = decaler(-m); const ref = iso(d);
      const possedes = e.objets.filter((x) => x.dateAchat <= moisIso(d));
      return C.instantane(C.bilan(possedes, e.coefs, B, ref, e.seuilValeur), ref, uid());
    });
    e.historique.push({ ...C.instantane(C.bilan(e.objets, e.coefs, B, auj(), e.seuilValeur), auj(), uid()), auto: true });
    const s1 = { ...simulationVide('Tout revendre'), perimetre: 'tous' };
    const s2 = { ...simulationVide('Objets peu utilisés'), perimetre: 'inutilises', commission: 0, expedition: 9, partExpediee: 40 };
    const s3 = { ...simulationVide('Plus de 300 €'), perimetre: 'seuil', cible: 300, negociation: 12, commission: 5, partExpediee: 20 };
    e.simulations = [s1, s2, s3]; e.simActive = s2.id;
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Inventaire valorisé · QME';
    document.body.classList.remove('app');
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="120" width="120" height="160" rx="10" fill="#1D4E89"/>
          <rect x="150" y="190" width="90" height="90" rx="10" fill="#F5B400"/>
          <circle cx="400" cy="150" r="130" fill="#D9302A"/>
          <path d="M400 150 L400 20 A130 130 0 0 1 530 150 Z" fill="#141414"/>
          <rect x="0" y="278" width="290" height="4" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Inventaire valorisé · patrimoine matériel</p>
          <h1>Combien valent vraiment tes affaires ?</h1>
          <p>Si tu revendais tout ce que tu possèdes aujourd'hui, combien pourrais-tu récupérer ? Inventorie tes objets en quelques secondes : l'outil estime leur valeur actuelle, leur prix de revente et ce qui dort au fond des placards.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div><p class="surtitre">Accès acheteur</p><h2>Ouvre ton inventaire</h2></div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Aucun nom ni adresse n'est demandé : ton inventaire est enregistré en ligne sous ta clé et te suit sur tous tes appareils.</p>
        <form id="form-code" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon inventaire</button>
        </form>
        <div class="separateur">ou</div>
        <div class="choix-essai">
          <button class="btn" type="button" data-action="decouverte"><b>Essayer gratuitement</b></button>
          <button class="btn" type="button" data-action="demo">Voir un exemple complet</button>
        </div>
        <p class="mention">Découverte gratuite : jusqu'à ${B.decouverte.maxObjets} de tes objets, gardés dans ce navigateur, rien n'est envoyé. L'exemple complet utilise des données fictives. Application complète : ${PRIX}, achat unique, sans abonnement (<a href="${PAGE_OFFRE}">voir l'offre</a>). Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const fin = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (fin) champ.setSelectionRange(champ.value.length, champ.value.length);
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon inventaire'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement (choix des catégories possédées) ----------
  let choixAccueil = new Set();
  function ecranAccueil() {
    document.title = 'Bienvenue · Inventaire valorisé';
    document.body.classList.remove('app');
    const essai = stock.lire(CLE_DECOUVERTE);
    const reprise = !session.decouverte && !session.demo && essai && Array.isArray(essai.objets) && essai.objets.length;
    const cats = B.categories.map((c) => {
      const ferme = session.decouverte && !c.decouverte;
      return `<button type="button" class="filiere" data-action="a-cat" data-id="${c.id}" aria-pressed="${choixAccueil.has(c.id)}" ${ferme ? 'disabled' : ''}>
        <b>${esc(c.nom)}</b><span>${ferme ? 'Application complète' : esc(c.sous.slice(0, 3).map((s) => s.nom).join(', '))}</span></button>`;
    }).join('');
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span>${session.decouverte ? '<span class="etiquette beurre">Découverte gratuite</span>' : ''}</div>
      <p class="surtitre">Bienvenue</p>
      <h1>Que possèdes-tu ?</h1>
      <p class="intro">Coche les grandes familles d'objets que tu as chez toi. Chacune arrive avec ses sous-catégories et des exemples d'objets : un toucher suffit pour en ajouter un.</p>
      ${reprise ? `<div class="aide reprise"><b>${pluriel(essai.objets.length, 'objet')} saisis en découverte gratuite sur cet appareil.</b> <button class="btn petit" data-action="reprendre-essai">Les reprendre dans mon inventaire</button></div>` : ''}
      <div class="filieres" role="group" aria-label="Catégories possédées">${cats}</div>
      <p class="erreur" id="a-erreur" role="alert"></p>
      <div class="accueil-pied">
        <button class="btn" data-action="${session.decouverte ? 'deconnexion' : 'a-tout'}">${session.decouverte ? 'Retour' : 'Tout cocher'}</button>
        <button class="btn primaire" data-action="accueil-fin">Commencer mon inventaire</button>
      </div>
      ${session.decouverte ? `<p class="mention">Découverte gratuite : ${B.decouverte.maxObjets} objets au plus, six catégories, gardés dans ce navigateur. L'application complète (${PRIX}, achat unique) ouvre l'inventaire illimité et toutes les analyses.</p>` : ''}
    </div>`;
  }
  function terminerAccueil() {
    if (!choixAccueil.size) { $('#a-erreur').textContent = 'Coche au moins une catégorie (tu pourras en ajouter ensuite).'; return; }
    if (!E) E = etatVide();
    E.categoriesPossedees = B.categories.filter((c) => choixAccueil.has(c.id)).map((c) => c.id);
    choixAccueil = new Set();
    vue = 'inventaire';
    history.replaceState(null, '', '#inventaire');
    sauver();
    demarrer();
  }
  function reprendreEssai() {
    const essai = normaliser(stock.lire(CLE_DECOUVERTE));
    if (!E) E = etatVide();
    E.objets = essai.objets.map((o) => ({ ...o, id: uid() }));
    E.categoriesPossedees = [...new Set([...essai.categoriesPossedees, ...essai.objets.map((o) => o.categorie)])];
    stock.suppr(CLE_DECOUVERTE);
    vue = 'bilan';
    history.replaceState(null, '', '#bilan');
    sauver(); demarrer();
    toast(`${pluriel(E.objets.length, 'objet')} repris dans ton inventaire. La copie de découverte a été effacée de cet appareil.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="currentColor"/></svg>',
    inventaire: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
    revente: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10 17 18.5H7Z" fill="currentColor"/></svg>',
    analyse: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor"/><rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor"/><rect x="17" y="2" width="4" height="19" rx="1" fill="currentColor"/></svg>',
    methode: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 21V12a9 9 0 0 1 9 9Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" rx="1" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" rx="1" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" rx="1" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" rx="1" fill="#F5B400" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="9" width="4" height="6.5" rx="1" fill="#D9302A" stroke="currentColor" stroke-width="1.5"/><rect x="8" y="15" width="4" height="6.5" rx="1" fill="#1D4E89" stroke="currentColor" stroke-width="1.5"/></svg>',
    cadenas: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['bilan', 'Bilan'], ['inventaire', 'Inventaire'], ['revente', 'Revente'], ['analyse', 'Analyse'], ['methode', 'Méthode']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    const bandeau = session.demo
      ? '<div class="bandeau-demo"><div><b>Exemple complet</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer l\'exemple</button><button data-action="deconnexion">J\'ai une clé</button></div></div>'
      : session.decouverte ? `<div class="bandeau-demo"><div><b>Découverte gratuite</b><span>${pluriel(B.decouverte.maxObjets, 'objet')} au plus, sur cet appareil.</span><a href="${PAGE_OFFRE}">Application complète · ${PRIX}</a><button data-action="deconnexion">J'ai une clé</button></div></div>` : '';
    $('#racine').innerHTML = `${bandeau}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Inventaire<br>valorisé</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, export et confidentialité" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : session.decouverte ? 'decouverte' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    valorisationAuto();
    rendre();
    proposerEcranAccueil();
  }

  // Valorisation automatique du mois (application complète) : créée à la première ouverture du mois, puis tenue
  // à jour à chaque ouverture et à chaque passage sur l'analyse. Les valorisations enregistrées à la main restent figées.
  function valorisationAuto() {
    if (!complet() || !E.objets.length) return;
    const mois = auj().slice(0, 7);
    const h = { ...C.instantane(bilan(), auj(), uid()), auto: true };
    const i = E.historique.findIndex((x) => x.auto && String(x.date).slice(0, 7) === mois);
    if (i >= 0) {
      const a = E.historique[i];
      if (a.actuelle === h.actuelle && a.achat === h.achat && a.nb === h.nb) return;
      E.historique[i] = { ...h, id: a.id };
    } else if (!C.instantaneDu(E.historique, auj())) E.historique.push(h);
    else return;
    sauver();
  }

  const VUES = { bilan: () => vueBilan(), inventaire: () => vueInventaire(), revente: () => vueRevente(), analyse: () => vueAnalyse(), methode: () => vueMethode() };
  const TITRES = { bilan: 'Bilan', inventaire: 'Inventaire', revente: 'Revente', analyse: 'Analyse', methode: 'Méthode' };

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${TITRES[vue]} · Inventaire valorisé`;
    $('#vue').innerHTML = VUES[vue]() + piedApp();
  }
  function changerVue(v) {
    vue = v;
    if (v === 'analyse') valorisationAuto();
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  function piedApp() {
    return `<footer class="pied-app"><p><b>Estimations indicatives.</b> Les valeurs sont calculées par des règles de décote paramétrables (<button class="lien-pied" data-action="vue" data-vue="methode">voir la méthode</button>)${coefsModifies() ? ', que tu as modifiées' : ''}. Ce ne sont ni une expertise, ni une valeur d'assurance, ni une valeur comptable, ni une garantie de prix de revente : le prix réellement obtenu dépend de l'acheteur, du moment et de l'annonce.</p>
      <p>Base intégrée QME (catégories, exemples, coefficients) version ${esc(B.version)} · aucun prix de marché n'est récupéré ni intégré · tes données ne sont jamais partagées automatiquement.</p></footer>`;
  }
  const verrou = (titre, texte) => `<div class="verrou"><div class="verrou-forme" aria-hidden="true">${ICONES.cadenas}</div><div><p class="surtitre">Application complète · ${PRIX}, achat unique</p><h2>${titre}</h2><p>${texte}</p>
    <div class="rang"><a class="btn primaire" href="${PAGE_OFFRE}">Découvrir l'application complète</a><button class="btn" data-action="demo-voir">Voir dans l'exemple</button></div></div></div>`;
  const vide = (titre, texte, action) => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${action ? `<div class="actions">${action}</div>` : ''}</div></div>`;
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" rx="8" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  // ---------- Graphiques (barres HTML, courbes SVG) ----------
  // Une seule série : barres horizontales bleues, étiquettes directes, pas de légende.
  function barres(items, { max, format = euros, libelle = '' } = {}) {
    const m = max ?? Math.max(1, ...items.map((i) => i.valeur));
    return `<ul class="barres" aria-label="${esc(libelle)}">${items.map((i) => `<li><span class="barres-nom">${esc(i.nom)}</span>
      <span class="barres-piste"><span class="barres-val" style="width:${Math.max(0.5, i.valeur / m * 100).toFixed(1)}%"></span></span>
      <span class="barres-txt">${i.texte ?? format(i.valeur)}</span></li>`).join('')}</ul>`;
  }
  // Deux séries : prix d'achat (gris, référence) et valeur actuelle (bleu), par catégorie.
  function barresDoubles(cats) {
    const m = Math.max(1, ...cats.map((c) => c.achat));
    return `<div class="legende"><span><i class="cle gris"></i>Prix d'achat</span><span><i class="cle bleu"></i>Valeur actuelle estimée</span></div>
      <ul class="barres doubles">${cats.map((c) => `<li><span class="barres-nom">${esc(categorie(c.id).nom)}</span>
        <span class="barres-piste"><span class="barres-val gris" style="width:${(c.achat / m * 100).toFixed(1)}%" title="Prix d'achat : ${euros(c.achat)}"></span><span class="barres-val" style="width:${Math.max(0.5, c.actuelle / m * 100).toFixed(1)}%" title="Valeur actuelle : ${euros(c.actuelle)}"></span></span>
        <span class="barres-txt">${euros(c.actuelle)}<small>sur ${euros(c.achat)} · −${pct(c.achat ? c.perte / c.achat : 0)}</small></span></li>`).join('')}</ul>`;
  }
  // Courbe(s) dans le temps : séries = [{nom, couleur, points:[{x (libellé), y}]}]. viewBox adapté à l'écran.
  function courbe(series, titre) {
    const petit = window.innerWidth < 640;
    const L = petit ? 360 : 760, H = petit ? 230 : 260, g = petit ? 58 : 72, d = 16, h = 16, bas = 30;
    const tous = series.flatMap((s) => s.points.map((p) => p.y));
    const max = Math.max(1, ...tous);
    const pas = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].find((p) => max / p <= 5) || 200000;
    const y1 = Math.ceil(max / pas) * pas;
    const n = series[0].points.length;
    // Abscisse proportionnelle au temps quand les points sont datés (t en millisecondes), sinon régulière.
    const ts = series[0].points.map((p) => p.t);
    const date = ts.every((t) => Number.isFinite(t)) && ts.at(-1) > ts[0];
    const X = (i) => g + (n === 1 ? 0.5 : date ? (ts[i] - ts[0]) / (ts.at(-1) - ts[0]) : i / (n - 1)) * (L - g - d);
    const Y = (v) => h + (1 - v / y1) * (H - h - bas);
    let grille = '';
    for (let v = 0; v <= y1 + 1e-6; v += pas) grille += `<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axe" x="${g - 8}" y="${Y(v) + 4}" text-anchor="end">${NF.format(v)} €</text>`;
    // Étiquettes de l'axe comptées depuis la fin pour éviter les chevauchements.
    const saut = Math.max(1, Math.ceil(n / (petit ? 4 : 7)));
    let dernierX = Infinity;
    for (let i = n - 1; i >= 0; i -= date ? 1 : saut) {
      if (dernierX - X(i) < (petit ? 64 : 70)) continue;
      dernierX = X(i);
      grille += `<text class="axe" x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(series[0].points[i].x)}</text>`;
    }
    const traces = series.map((s) => `<path d="${s.points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('')}" fill="none" stroke="${s.couleur}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${s.points.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="5" fill="${s.couleur}" stroke="#fff" stroke-width="2"><title>${esc(p.x)} · ${esc(s.nom)} : ${euros(p.y)}</title></circle>`).join('')}`).join('');
    const legende = series.length > 1 ? `<div class="legende">${series.map((s) => `<span><i class="cle" style="background:${s.couleur}"></i>${esc(s.nom)}</span>`).join('')}</div>` : '';
    return `<figure class="graphique"><div class="graphique-tete"><h3>${esc(titre)}</h3>${legende}</div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(titre)} ; valeurs dans le tableau">${grille}${traces}</svg>
      <details class="valeurs"><summary>Voir les valeurs</summary><div class="defile"><table class="tableau"><thead><tr><th>Date</th>${series.map((s) => `<th class="nb">${esc(s.nom)}</th>`).join('')}</tr></thead>
      <tbody>${series[0].points.map((p, i) => `<tr><td>${esc(p.x)}</td>${series.map((s) => `<td class="nb">${euros(s.points[i].y)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></figure>`;
  }
  const BLEU = '#2F64A6', ROUGE = '#C0503A';

  // ---------- Vue : bilan ----------
  function vueBilan() {
    if (!E.objets.length) {
      return `<div class="vue-tete"><div><h1>Bilan</h1><p>Ajoute tes premiers objets : la valeur de tes possessions s'affiche ici.</p></div></div>
        ${vide('Ton inventaire est vide', 'Commence par les objets qui ont coûté le plus cher : électronique, mobilier, vélo, instruments. Quelques secondes par objet.', '<button class="btn primaire" data-action="vue" data-vue="inventaire">Ajouter des objets</button>')}`;
    }
    const b = bilan();
    const tuiles = `<div class="hero">
      <div class="tuile-chiffre fort"><p class="surtitre">Valeur actuelle estimée</p><b>${euros(b.total.actuelle)}</b><span>${pct(b.total.achat ? b.total.actuelle / b.total.achat : 0)} du prix d'achat</span></div>
      <div class="tuile-chiffre jaune"><p class="surtitre">Revente potentielle</p><b>${euros(b.total.revente)}</b><span>avant frais de vente</span></div>
      <div class="tuile-chiffre"><p class="surtitre">Prix d'achat total</p><b>${euros(b.total.achat)}</b><span>${pluriel(b.nbObjets, 'objet')} · ${euros(b.moyenne)} en moyenne</span></div>
      <div class="tuile-chiffre"><p class="surtitre">Perte de valeur estimée</p><b>−${euros(b.total.perte)}</b><span>${pct(b.tauxDepreciation)} du prix d'achat</span></div>
    </div>`;
    const reps = b.categories.map((c) => ({ nom: categorie(c.id).nom, valeur: c.actuelle, texte: `${euros(c.actuelle)} <small>${pct(c.part)}</small>` }));
    const alertes = [];
    if (b.aCompleter) alertes.push(`<p class="aide">${pluriel(b.aCompleter, 'objet')} sans prix d'achat ni valeur saisie : ${b.aCompleter > 1 ? 'ils comptent' : 'il compte'} pour 0 €. <button class="lien-pied" data-action="vue" data-vue="inventaire">Compléter</button></p>`);
    const top = complet() ? `<h2 class="titre-section">Top 10 des objets les plus valorisés <span>valeur actuelle estimée</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Objet</th><th>Catégorie</th><th class="nb">Achat</th><th class="nb">Valeur actuelle</th><th class="nb">Revente</th></tr></thead><tbody>
      ${b.top10.map(({ objet: o, v }) => `<tr><td><button class="lien-objet" data-action="objet" data-id="${o.id}">${esc(o.nom)}</button>${v.quantite > 1 ? ` <small>× ${v.quantite}</small>` : ''}${v.source === 'manuelle' ? ' <span class="etiquette ciel">saisie</span>' : ''}</td><td>${esc(categorie(o.categorie).nom)}</td><td class="nb">${euros(v.achat)}</td><td class="nb"><b>${euros(v.actuelle)}</b></td><td class="nb">${euros(v.revente)}</td></tr>`).join('')}
      </tbody></table></div>
      <h2 class="titre-section">Objets peu utilisés de valeur <span>utilisés quelques fois par an ou jamais, valeur ≥ ${euros(E.seuilValeur)}</span></h2>
      ${b.peuUtilisesDeValeur.length ? `<div class="cartes-objets">${b.peuUtilisesDeValeur.slice(0, 6).map(carteObjetCourte).join('')}</div>
        <p class="note">Ensemble : ${euros(b.peuUtilisesDeValeur.reduce((s, l) => s + l.v.actuelle, 0))} de valeur actuelle, ${euros(b.peuUtilisesDeValeur.reduce((s, l) => s + l.v.revente, 0))} de revente potentielle. <button class="lien-pied" data-action="vue" data-vue="revente">Simuler leur revente</button></p>`
        : '<p class="vide-court">Aucun objet peu utilisé au-dessus de ce seuil.</p>'}`
      : `<div class="hero-sec">${verrou('Top 10, objets dormants, simulateur', 'L\'application complète classe tes objets les plus valorisés, repère ceux qui dorment sans servir, simule leur revente et garde l\'historique de tes valorisations.')}</div>`;
    return `<div class="vue-tete"><div><p class="surtitre">${fmtDate(auj())}</p><h1>Si tu revendais tout aujourd'hui…</h1><p>…tu pourrais récupérer environ <mark>${euros(b.total.revente)}</mark> avant frais, pour des objets achetés ${euros(b.total.achat)}.</p></div>
      <div class="actions"><button class="btn" data-action="partager">Partager le résultat</button><button class="btn primaire" data-action="ajouter">Ajouter un objet</button></div></div>
      ${tuiles}${alertes.join('')}
      <h2 class="titre-section">Répartition par catégorie <span>part de la valeur actuelle estimée</span></h2>
      ${barres(reps, { libelle: 'Valeur actuelle par catégorie' })}
      ${top}`;
  }
  const carteObjetCourte = ({ objet: o, v }) => `<button class="carte-objet" data-action="objet" data-id="${o.id}"><b>${esc(o.nom)}</b><span>${esc(usageNom(o.usage))} · ${esc(etatNom(o.etat))}</span><em>${euros(v.actuelle)}</em></button>`;

  // ---------- Vue : inventaire ----------
  function vueInventaire() {
    const b = bilan();
    const parId = new Map(b.lignes.map((l) => [l.objet.id, l.v]));
    const t = filtre.texte.trim().toLowerCase();
    const garde = (o) => (!filtre.categorie || o.categorie === filtre.categorie) && (!t || `${o.nom} ${o.marque} ${o.description}`.toLowerCase().includes(t));
    const possedees = new Set([...E.categoriesPossedees, ...E.objets.map((o) => o.categorie)]);
    const ordre = B.categories.filter((c) => possedees.has(c.id));
    const autres = B.categories.filter((c) => !possedees.has(c.id));
    const limite = session.decouverte ? `<p class="aide">Découverte gratuite : ${E.objets.length} / ${B.decouverte.maxObjets} objets. <a href="${PAGE_OFFRE}">Inventaire illimité avec l'application complète</a>.</p>` : '';
    const sections = ordre.map((c) => {
      const objets = E.objets.filter((o) => o.categorie === c.id && garde(o));
      if ((filtre.categorie && filtre.categorie !== c.id) || (t && !objets.length)) return '';
      const total = objets.reduce((s, o) => s + parId.get(o.id).actuelle, 0);
      const ferme = session.decouverte && !c.decouverte;
      return `<section class="cat" id="cat-${c.id}">
        <div class="cat-tete"><h2>${esc(c.nom)}</h2><span>${pluriel(objets.reduce((s, o) => s + o.quantite, 0), 'objet')} · ${euros(total)}</span></div>
        ${objets.length ? `<ul class="objets">${objets.map((o) => ligneObjet(o, parId.get(o.id))).join('')}</ul>` : ''}
        ${ferme ? '<p class="vide-court">Catégorie ouverte dans l\'application complète.</p>' : `<details class="exemples" ${objets.length ? '' : 'open'}><summary>Ajouter depuis les exemples</summary>
          ${c.sous.map((s) => `<div class="sous"><b>${esc(s.nom)}</b><div class="puces">${s.exemples.map((x) => `<button class="puce" data-action="ajouter" data-cat="${c.id}" data-sous="${s.id}" data-nom="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div></div>`).join('')}
          <div class="rang"><button class="btn petit" data-action="ajouter" data-cat="${c.id}">Autre objet de cette catégorie</button></div></details>`}
      </section>`;
    }).join('');
    const suggestions = B.categories.filter((c) => !session.decouverte || c.decouverte).flatMap((c) => c.sous.flatMap((s) => s.exemples.map((x) => `<option value="${esc(x)}">${esc(c.nom)} · ${esc(s.nom)}</option>`))).join('');
    return `<div class="vue-tete"><div><h1>Inventaire</h1><p>${E.objets.length ? `${pluriel(b.nbObjets, 'objet')} · valeur actuelle estimée ${euros(b.total.actuelle)}` : 'Touche un exemple pour l\'ajouter, ou écris son nom ci-dessous.'}</p></div>
      <div class="actions"><button class="btn primaire" data-action="ajouter">Ajouter un objet</button></div></div>
      ${limite}
      <form class="ajout-rapide" id="ajout-rapide" autocomplete="off">
        <label class="champ">Ajout rapide<input id="ar-nom" list="ar-liste" placeholder="Ex. : Lave-linge" maxlength="80" required></label>
        <datalist id="ar-liste">${suggestions}</datalist>
        <label class="champ">Prix d'achat<span class="avec-unite"><input id="ar-prix" inputmode="decimal" placeholder="0"><span>€</span></span></label>
        <label class="champ">Acheté en<input id="ar-date" type="month" max="${moisIso(new Date())}"></label>
        <button class="btn primaire" type="submit">Ajouter</button>
      </form>
      <div class="filtres">
        <label class="champ compact"><span class="sr-only">Rechercher</span><input type="search" data-filtre="texte" placeholder="Rechercher un objet" value="${esc(filtre.texte)}"></label>
        <label class="champ compact"><span class="sr-only">Catégorie</span><select data-filtre="categorie"><option value="">Toutes les catégories</option>${ordre.map((c) => `<option value="${c.id}" ${filtre.categorie === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </div>
      ${sections || vide('Aucun objet ne correspond', 'Change la recherche ou la catégorie.', '<button class="btn" data-action="filtre-raz">Tout afficher</button>')}
      ${autres.length ? `<details class="autres-cat"><summary>Ajouter une autre catégorie (${autres.length})</summary><div class="puces">${autres.map((c) => `<button class="puce" data-action="cat-ajout" data-id="${c.id}" ${session.decouverte && !c.decouverte ? 'disabled title="Application complète"' : ''}>+ ${esc(c.nom)}</button>`).join('')}</div></details>` : ''}`;
  }
  function ligneObjet(o, v) {
    const sc = sousCat(o.categorie, o.sousCategorie);
    return `<li class="objet"><button class="objet-corps" data-action="objet" data-id="${o.id}">
        <span class="objet-nom"><b>${esc(o.nom)}</b>${o.quantite > 1 ? ` <small>× ${o.quantite}</small>` : ''}${o.marque ? ` <small>${esc(o.marque)}</small>` : ''}</span>
        <span class="objet-meta">${esc(sc?.nom || 'Sans sous-catégorie')} · ${esc(etatNom(o.etat))} · ${esc(usageNom(o.usage))}${o.dateAchat ? ` · ${esc(fmtMois(o.dateAchat))}` : ''}</span>
        <span class="objet-chiffres"><span><small>Achat</small>${o.prixAchat ? euros(v.achat) : '<em>à compléter</em>'}</span><span><small>Actuelle${v.source === 'manuelle' ? ' · saisie' : ''}</small><b>${euros(v.actuelle)}</b></span><span><small>Revente</small>${euros(v.revente)}</span></span>
      </button><button class="btn-suppr" data-action="supprimer" data-id="${o.id}" aria-label="Supprimer ${esc(o.nom)}" title="Supprimer">×</button></li>`;
  }

  // ---------- Fiche d'un objet ----------
  const peutAjouter = () => !session.decouverte || E.objets.length < B.decouverte.maxObjets;
  function limiteAtteinte() {
    ouvrirModale('Limite de la découverte', `<p>La découverte gratuite garde <b>${B.decouverte.maxObjets} objets</b> au plus. Ton inventaire te donne déjà une première idée : <b>${euros(bilan().total.actuelle)}</b> de valeur actuelle estimée.</p>
      <p>L'application complète (${PRIX}, achat unique, sans abonnement) ouvre l'inventaire illimité, toutes les catégories, le simulateur de revente, l'analyse détaillée, l'historique et les exports. Tes ${B.decouverte.maxObjets} objets pourront y être repris.</p>`,
      `<a class="btn primaire" href="${PAGE_OFFRE}">Voir l'application complète</a><button class="btn" value="annuler">Fermer</button>`);
  }
  function ajoutRapide() {
    const nom = $('#ar-nom').value.trim();
    if (!nom) { $('#ar-nom').focus(); return; }
    if (!peutAjouter()) return limiteAtteinte();
    const trouve = trouverExemple(nom);
    const o = normaliserObjet({ id: uid(), nom, categorie: trouve?.cat || filtre.categorie || E.categoriesPossedees[0] || 'autres', sousCategorie: trouve?.sous || null, prixAchat: lireNombre($('#ar-prix').value), dateAchat: $('#ar-date').value || '', etat: 'bon', usage: 'mensuel' });
    if (session.decouverte && !categorie(o.categorie).decouverte) o.categorie = 'informatique';
    E.objets.push(o);
    if (!E.categoriesPossedees.includes(o.categorie)) E.categoriesPossedees.push(o.categorie);
    annulation = () => { E.objets = E.objets.filter((x) => x.id !== o.id); };
    sauver(); rendre();
    $('#ar-nom')?.focus();
    toast(`« ${o.nom} » ajouté : ${euros(valoriser(o).actuelle)} estimés (état « bon », à préciser dans sa fiche).`, { libelle: 'Annuler', faire: annuler });
  }
  function trouverExemple(nom) {
    const n = nom.toLowerCase();
    for (const c of B.categories) for (const s of c.sous) if (s.exemples.some((x) => x.toLowerCase() === n)) return { cat: c.id, sous: s.id };
    for (const c of B.categories) for (const s of c.sous) if (s.exemples.some((x) => n.includes(x.toLowerCase()) || x.toLowerCase().includes(n))) return { cat: c.id, sous: s.id };
    return null;
  }

  function optionsSous(cid, choix) {
    return `<option value="">—</option>${categorie(cid).sous.map((s) => `<option value="${s.id}" ${s.id === choix ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}`;
  }
  function modaleObjet(id, pre = {}) {
    const o = id ? E.objets.find((x) => x.id === id) : null;
    if (!o && !peutAjouter()) return limiteAtteinte();
    const d = o || normaliserObjet({ id: '', nom: pre.nom || '', categorie: pre.cat || filtre.categorie || E.categoriesPossedees[0] || 'informatique', sousCategorie: pre.sous || null, etat: 'bon', usage: 'mensuel' });
    const cats = B.categories.filter((c) => !session.decouverte || c.decouverte || c.id === d.categorie);
    const opt = (liste, choix) => liste.map((x) => `<option value="${x.id}" ${x.id === choix ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(d.nom)}" placeholder="Ex. : Canapé d'angle"></label>
      <div class="grille-2">
        <label class="champ">Catégorie<select name="categorie">${opt(cats, d.categorie)}</select></label>
        <label class="champ">Sous-catégorie<select name="sousCategorie">${optionsSous(d.categorie, d.sousCategorie)}</select></label>
        <label class="champ">Prix d'achat unitaire<span class="avec-unite"><input name="prixAchat" inputmode="decimal" value="${esc(champNombre(d.prixAchat))}" placeholder="Ce que tu as payé"><span>€</span></span></label>
        <label class="champ">Date d'achat approximative<input name="dateAchat" type="month" max="${moisIso(new Date())}" value="${esc(/^\d{4}-\d{2}$/.test(d.dateAchat) ? d.dateAchat : '')}"></label>
        <label class="champ">État actuel<select name="etat">${opt(E.coefs.etats, d.etat)}</select></label>
        <label class="champ">Utilisation<select name="usage">${opt(B.usages, d.usage)}</select></label>
        <label class="champ">Quantité<input name="quantite" inputmode="numeric" value="${d.quantite}"></label>
        <label class="champ">Marque <small>Facultatif.</small><input name="marque" maxlength="60" value="${esc(d.marque)}"></label>
      </div>
      <div class="apercu" id="apercu" aria-live="polite"></div>
      <details class="details-fiche" ${o && (o.valeurManuelle !== null || o.reventeManuelle !== null || o.description || o.commentaires || o.ageAchat) ? 'open' : ''}><summary>Valeur connue, occasion, notes</summary>
        <div class="grille-2">
          <label class="champ">Valeur actuelle connue <small>Remplace l'estimation (unitaire).</small><span class="avec-unite"><input name="valeurManuelle" inputmode="decimal" value="${esc(champNombre(d.valeurManuelle))}"><span>€</span></span></label>
          <label class="champ">Prix de revente connu <small>Remplace l'estimation (unitaire).</small><span class="avec-unite"><input name="reventeManuelle" inputmode="decimal" value="${esc(champNombre(d.reventeManuelle))}"><span>€</span></span></label>
          <label class="champ">Âge à l'achat (années) <small>Pour un objet acheté d'occasion.</small><input name="ageAchat" inputmode="decimal" value="${esc(champNombre(d.ageAchat || ''))}"></label>
          <label class="champ">Règle de décote<select name="famille"><option value="">Selon la sous-catégorie</option>${opt(E.coefs.familles, d.famille)}</select></label>
        </div>
        <label class="champ">Description <small>Facultatif.</small><textarea name="description" maxlength="400">${esc(d.description)}</textarea></label>
        <label class="champ">Commentaires<textarea name="commentaires" maxlength="600">${esc(d.commentaires)}</textarea></label>
      </details>
      <p class="erreur" role="alert"></p>`;
    const pied = o ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(o ? 'Fiche de l\'objet' : 'Ajouter un objet', corps, pied, (f, action) => {
      if (action === 'supprimer') { supprimerObjet(o.id); return; }
      const v = lireFiche(f);
      if (!v.nom) return 'Indique le nom de l\'objet.';
      if (v.prixAchat !== null && v.prixAchat < 0) return 'Le prix d\'achat doit être positif.';
      if (v.prixAchat === null && v.valeurManuelle === null) return 'Indique le prix d\'achat (même approximatif) ou une valeur connue.';
      if (o) { Object.assign(o, v); sauver(); rendre(); toast('Objet enregistré.'); return; }
      const n = normaliserObjet({ ...v, id: uid(), creeLe: auj() });
      E.objets.push(n);
      if (!E.categoriesPossedees.includes(n.categorie)) E.categoriesPossedees.push(n.categorie);
      annulation = () => { E.objets = E.objets.filter((x) => x.id !== n.id); };
      sauver(); rendre();
      toast(`« ${n.nom} » ajouté : ${euros(valoriser(n).actuelle)} estimés.`, { libelle: 'Annuler', faire: annuler });
    });
    const form = modale().querySelector('form');
    const apercu = () => {
      const v = lireFiche(new FormData(form));
      const r = valoriser(normaliserObjet({ ...v, id: 'apercu' }));
      $('#apercu').innerHTML = `<div><small>Prix d'achat</small><b>${euros(r.achat)}</b></div><div><small>Valeur actuelle ${r.source === 'manuelle' ? 'saisie' : 'estimée'}</small><b>${euros(r.actuelle)}</b></div><div><small>Revente potentielle</small><b>${euros(r.revente)}</b></div>
        <p>${r.source === 'manuelle' ? 'Valeur saisie par toi.' : `Règle « ${esc(familleNom(r.famille))} » · ${r.age ? `${String(Math.round(r.age * 10) / 10).replace('.', ',')} an(s)` : 'neuf'} · état × ${String(r.coefEtat).replace('.', ',')}${r.multiplicateur !== 1 ? ` · décote × ${String(r.multiplicateur).replace('.', ',')} (prix)` : ''}`}</p>`;
    };
    form.addEventListener('input', apercu);
    form.elements.categorie.addEventListener('change', (e) => { form.elements.sousCategorie.innerHTML = optionsSous(e.target.value, null); apercu(); });
    apercu();
  }
  function lireFiche(f) {
    const n = (k) => lireNombre(f.get(k));
    return { nom: String(f.get('nom') || '').trim(), categorie: f.get('categorie'), sousCategorie: f.get('sousCategorie') || null, prixAchat: n('prixAchat'), dateAchat: f.get('dateAchat') || '',
      etat: f.get('etat'), usage: f.get('usage'), quantite: Math.max(1, Math.round(n('quantite') || 1)), marque: String(f.get('marque') || '').trim(),
      valeurManuelle: n('valeurManuelle'), reventeManuelle: n('reventeManuelle'), ageAchat: Math.max(0, n('ageAchat') || 0), famille: f.get('famille') || null,
      description: String(f.get('description') || '').trim(), commentaires: String(f.get('commentaires') || '').trim() };
  }
  function supprimerObjet(id) {
    const i = E.objets.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [o] = E.objets.splice(i, 1);
    annulation = () => { E.objets.splice(i, 0, o); };
    if (modale().open) modale().close();
    sauver(); rendre();
    toast(`« ${o.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Vue : simulateur de revente ----------
  const PERIMETRES = [['tous', 'Tous mes biens'], ['categorie', 'Une catégorie'], ['inutilises', 'Objets peu utilisés'], ['jamais', 'Objets jamais utilisés'], ['seuil', 'Au-dessus d\'un prix'], ['nombre', 'Un nombre d\'objets']];
  const simActive = () => E.simulations.find((s) => s.id === E.simActive) || E.simulations[0];
  function vueRevente() {
    if (!complet()) return `<div class="vue-tete"><div><h1>Simulateur de revente</h1><p>Combien tu récupérerais vraiment, frais déduits.</p></div></div>
      ${verrou('Simule la revente de tes biens', 'Tout revendre, une catégorie, les objets qui ne servent pas ou ceux au-dessus d\'un prix : le simulateur déduit la décote, la négociation, les commissions et l\'expédition, et montre le montant théorique récupérable.')}`;
    if (!E.objets.length) return `<div class="vue-tete"><div><h1>Simulateur de revente</h1></div></div>${vide('Rien à revendre pour l\'instant', 'Ajoute des objets à ton inventaire pour simuler leur revente.', '<button class="btn primaire" data-action="vue" data-vue="inventaire">Aller à l\'inventaire</button>')}`;
    if (!E.simulations.length) { const s = simulationVide('Tout revendre'); E.simulations.push(s); E.simActive = s.id; }
    const s = simActive();
    const cats = bilan().categories;
    const p = (nom, lib, v, unite, aide = '') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<span class="avec-unite"><input data-sim="${nom}" inputmode="decimal" value="${esc(champNombre(v))}"><span>${unite}</span></span></label>`;
    return `<div class="vue-tete"><div><h1>Simulateur de revente</h1><p>Montant théorique récupérable, frais déduits, selon tes hypothèses. Aucune plateforme n'est consultée : tout est calculé ici.</p></div></div>
      <div class="choix-scenario" role="group" aria-label="Scénario affiché"><span class="surtitre">Scénario</span>
        ${E.simulations.map((x) => `<button class="puce-scenario" data-action="sim-activer" data-id="${x.id}" aria-pressed="${x.id === s.id}">${esc(x.nom)}</button>`).join('')}
        ${E.simulations.length < MAX_SIMULATIONS ? '<button class="btn petit" data-action="sim-nouveau">+ Scénario</button>' : ''}</div>
      <div class="edition">
        <div class="formulaire">
          <div class="bloc"><div class="bloc-titre"><span class="num">1</span>Ce que tu revends</div>
            <label class="champ">Nom du scénario<input data-sim="nom" maxlength="40" value="${esc(s.nom)}"></label>
            <fieldset class="segmente champ"><legend>Périmètre</legend>${PERIMETRES.map(([id, nom]) => `<label><input type="radio" name="perimetre" data-sim="perimetre" value="${id}" ${s.perimetre === id ? 'checked' : ''}><span>${nom}</span></label>`).join('')}</fieldset>
            ${s.perimetre === 'categorie' ? `<label class="champ">Catégorie<select data-sim="cible">${cats.map((c) => `<option value="${c.id}" ${s.cible === c.id ? 'selected' : ''}>${esc(categorie(c.id).nom)}</option>`).join('')}</select></label>` : ''}
            ${s.perimetre === 'seuil' ? p('cible', 'Revente unitaire d\'au moins', s.cible ?? 300, '€') : ''}
            ${s.perimetre === 'nombre' ? p('cible', 'Nombre d\'objets (les mieux revendables)', s.cible ?? 5, 'objets') : ''}
          </div>
          <div class="bloc"><div class="bloc-titre"><span class="num">2</span>Tes hypothèses de vente</div>
            <div class="grille-champs">
              ${p('decote', 'Décote supplémentaire', s.decote, '%', 'Vente pressée, saison creuse.')}
              ${p('negociation', 'Marge de négociation', s.negociation, '%', 'Rabais accordé à l\'acheteur.')}
              ${p('commission', 'Frais de vente', s.commission, '%', 'Commission éventuelle d\'un site ou d\'un dépôt-vente.')}
              ${p('fraisFixes', 'Frais fixes par objet', s.fraisFixes, '€', 'Annonce, nettoyage, déplacement.')}
              ${p('expedition', 'Expédition par colis', s.expedition, '€')}
              ${p('partExpediee', 'Objets expédiés', s.partExpediee, '%', 'Les autres sont remis en main propre.')}
            </div>
            <div class="rang"><button class="btn petit" data-action="sim-dupliquer">Dupliquer ce scénario</button>${E.simulations.length > 1 ? '<button class="btn petit danger" data-action="sim-suppr">Supprimer ce scénario</button>' : ''}</div>
          </div>
        </div>
        <aside class="synthese" id="sim-resultat">${resultatSimulation(s)}</aside>
      </div>
      <h2 class="titre-section">Comparer les scénarios</h2><div id="sim-comparaison">${comparaisonSimulations()}</div>`;
  }
  function resultatSimulation(s) {
    const r = C.simuler(bilan().lignes, s, B);
    if (!r.nbObjets) return '<p class="surtitre">Résultat</p><p class="synthese-vide">Aucun objet dans ce périmètre.</p>';
    const ligne = (lib, v, signe = '−') => `<div><dt>${lib}</dt><dd>${v ? `${signe}${euros(v)}` : '0 €'}</dd></div>`;
    return `<p class="surtitre">${esc(s.nom)}</p>
      <div class="synthese-tjm conseille"><span>Montant net récupérable</span><b>${euros(r.net)}</b></div>
      <dl class="synthese-liste">
        <div><dt>Revente estimée (${pluriel(r.nbVendus, 'objet')})</dt><dd>${euros(r.reventeBrute)}</dd></div>
        ${ligne('Décote supplémentaire', r.decote)}${ligne('Négociation', r.negociation)}${ligne('Frais de vente', r.commission)}${ligne('Frais fixes', r.fraisFixes)}${ligne('Expédition', r.expedition)}
      </dl>
      ${r.nbNonRentables ? `<p class="synthese-alerte">${pluriel(r.nbNonRentables, 'objet')} ne ${r.nbNonRentables > 1 ? 'rapporteraient' : 'rapporterait'} rien une fois les frais payés : ${r.nbNonRentables > 1 ? 'ils sont exclus' : 'il est exclu'} du total.</p>` : ''}
      <p class="note">Montant théorique, pas une garantie : le prix obtenu dépend de l'acheteur et de l'annonce.</p>
      ${r.details.filter((x) => x.rentable).length ? `<details class="valeurs"><summary>Détail par objet</summary><ul class="detail-sim">${r.details.filter((x) => x.rentable).slice(0, 30).map((x) => `<li><span>${esc(x.nom)}${x.quantite > 1 ? ` × ${x.quantite}` : ''}</span><b>${euros(x.net)}</b></li>`).join('')}</ul></details>` : ''}`;
  }
  function comparaisonSimulations() {
    const lignes = bilan().lignes;
    const res = E.simulations.map((s) => ({ s, r: C.simuler(lignes, s, B) }));
    const desc = (s) => { const nomP = PERIMETRES.find(([id]) => id === s.perimetre)?.[1] || ''; return s.perimetre === 'categorie' ? `${nomP} : ${categorie(s.cible).nom}` : s.perimetre === 'seuil' ? `Revente ≥ ${euros(s.cible || 0)}` : s.perimetre === 'nombre' ? `${s.cible || 0} objets` : nomP; };
    return `<div class="defile"><table class="tableau"><thead><tr><th>Scénario</th><th>Périmètre</th><th class="nb">Objets vendus</th><th class="nb">Revente estimée</th><th class="nb">Frais et rabais</th><th class="nb">Net récupérable</th></tr></thead><tbody>
      ${res.map(({ s, r }) => `<tr ${s.id === E.simActive ? 'class="actif"' : ''}><td><button class="lien-objet" data-action="sim-activer" data-id="${s.id}">${esc(s.nom)}</button></td><td>${esc(desc(s))}</td><td class="nb">${r.nbVendus}</td><td class="nb">${euros(r.reventeBrute)}</td><td class="nb">−${euros(r.reventeBrute - r.net)}</td><td class="nb"><b>${euros(r.net)}</b></td></tr>`).join('')}
    </tbody></table></div>`;
  }
  function appliquerSim(el) {
    const s = simActive();
    const cle = el.dataset.sim;
    if (cle === 'nom') s.nom = el.value.slice(0, 40) || 'Scénario';
    else if (cle === 'perimetre') { s.perimetre = el.value; s.cible = el.value === 'categorie' ? bilan().categories[0]?.id : el.value === 'seuil' ? 300 : el.value === 'nombre' ? 5 : null; return 'rendre'; }
    else if (cle === 'cible') s.cible = s.perimetre === 'categorie' ? el.value : Math.max(0, lireNombre(el.value) ?? 0);
    else { const n = lireNombre(el.value); s[cle] = n === null ? 0 : Math.max(0, cle === 'fraisFixes' || cle === 'expedition' ? n : Math.min(100, n)); }
    return 'maj';
  }

  // ---------- Vue : analyse ----------
  function vueAnalyse() {
    if (!complet()) return `<div class="vue-tete"><div><h1>Analyse</h1><p>Ce que coûte vraiment ce que tu possèdes.</p></div></div>
      ${verrou('Analyse de possession et historique', 'Argent immobilisé, valeur des objets qui ne servent pas, catégories les plus coûteuses, plus fortes pertes de valeur, part facilement revendable, projection sur cinq ans, historique des valorisations et comparaison entre deux dates. Exports CSV, JSON et rapport imprimable.')}`;
    if (!E.objets.length) return `<div class="vue-tete"><div><h1>Analyse</h1></div></div>${vide('Pas encore d\'analyse', 'Ajoute des objets à ton inventaire pour voir où dort ton argent.', '<button class="btn primaire" data-action="vue" data-vue="inventaire">Aller à l\'inventaire</button>')}`;
    const b = bilan();
    const proj = C.projection(E.objets, E.coefs, B, auj(), 5);
    const hist = [...E.historique].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    const tuile = (lib, v, txt, cls = '') => `<div class="tuile-chiffre ${cls}"><p class="surtitre">${lib}</p><b>${v}</b><span>${txt}</span></div>`;
    return `<div class="vue-tete"><div><h1>Analyse de possession</h1><p>Où dort ton argent, ce qui se déprécie le plus vite et ce que tu pourrais libérer facilement.</p></div>
      <div class="actions"><button class="btn" data-action="csv">CSV</button><button class="btn" data-action="exporter">JSON</button><button class="btn primaire" data-action="imprimer">Rapport imprimable</button></div></div>
      <div class="hero">
        ${tuile('Argent dépensé', euros(b.total.achat), `pour ${pluriel(b.nbObjets, 'objet')}`)}
        ${tuile('Encore immobilisé', euros(b.total.actuelle), 'valeur actuelle estimée', 'fort')}
        ${tuile('Objets peu utilisés', euros(b.valeurPeuUtilises), `dont ${euros(b.valeurJamais)} jamais utilisés (${pluriel(b.nbJamais, 'objet')})`, 'jaune')}
        ${tuile('Facilement revendable', pct(b.partFacile), `${euros(b.reventeFacile)} de la revente potentielle`)}
      </div>
      <h2 class="titre-section">Valeur qui dort <span>objets utilisés quelques fois par an ou jamais, valeur ≥ <label class="seuil-inline"><span class="sr-only">Seuil</span><input data-reglage="seuilValeur" inputmode="numeric" value="${E.seuilValeur}"></label> €</span></h2>
      ${b.peuUtilisesDeValeur.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Objet</th><th>Utilisation</th><th class="nb">Valeur actuelle</th><th class="nb">Revente</th></tr></thead><tbody>
        ${b.peuUtilisesDeValeur.map(({ objet: o, v }) => `<tr><td><button class="lien-objet" data-action="objet" data-id="${o.id}">${esc(o.nom)}</button></td><td>${esc(usageNom(o.usage))}</td><td class="nb">${euros(v.actuelle)}</td><td class="nb">${euros(v.revente)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="vide-court">Aucun objet peu utilisé au-dessus de ce seuil.</p>'}
      <h2 class="titre-section">Dépréciation par catégorie <span>prix d'achat et valeur actuelle estimée · ${pct(b.tauxDepreciation)} de perte au total</span></h2>
      ${barresDoubles(b.categoriesCouteuses)}
      <div class="deux-colonnes">
        <div><h2 class="titre-section">Plus fortes pertes de valeur</h2>
          ${b.pertesTop.length ? barres(b.pertesTop.map(({ objet: o, v }) => ({ nom: o.nom, valeur: v.perte, texte: `−${euros(v.perte)} <small>${v.possession >= 1 ? `${euros(v.perteParAn)}/an` : 'moins d\'un an'}</small>` })), { libelle: 'Perte de valeur par objet' }) : '<p class="vide-court">Aucune perte estimée.</p>'}</div>
        <div><h2 class="titre-section">Catégories les plus coûteuses <span>prix d'achat</span></h2>
          ${barres(b.categoriesCouteuses.slice(0, 10).map((c) => ({ nom: categorie(c.id).nom, valeur: c.achat, texte: `${euros(c.achat)} <small>−${euros(c.perte)}</small>` })), { libelle: 'Prix d\'achat par catégorie' })}</div>
      </div>
      <h2 class="titre-section">Projection sur cinq ans <span>à état et inventaire constants</span></h2>
      ${courbe([{ nom: 'Valeur actuelle estimée', couleur: BLEU, points: proj.map((p) => ({ x: String(p.annee), y: p.actuelle })) }, { nom: 'Revente potentielle', couleur: ROUGE, points: proj.map((p) => ({ x: String(p.annee), y: p.revente })) }], 'Valeur de ton inventaire dans le temps')}
      <h2 class="titre-section">Historique des valorisations <span>une valorisation est enregistrée chaque mois à l'ouverture</span></h2>
      <div class="rang"><button class="btn petit" data-action="instantane">Enregistrer la valorisation du jour</button></div>
      ${hist.length >= 2 ? courbe([{ nom: 'Valeur actuelle estimée', couleur: BLEU, points: hist.map((h) => ({ x: fmtMoisCourt(h.date), t: tDate(h.date), y: h.actuelle })) }, { nom: 'Revente potentielle', couleur: ROUGE, points: hist.map((h) => ({ x: fmtMoisCourt(h.date), t: tDate(h.date), y: h.revente })) }], 'Valorisations enregistrées') : ''}
      ${hist.length ? `<ul class="historique">${[...hist].reverse().map((h) => `<li><span>${fmtDate(h.date)}</span><span>${pluriel(h.nb, 'objet')}</span><span>achat ${euros(h.achat)}</span><b>${euros(h.actuelle)}</b><button class="btn-suppr" data-action="instantane-suppr" data-id="${h.id}" aria-label="Supprimer la valorisation du ${fmtDate(h.date)}">×</button></li>`).join('')}</ul>` : '<p class="vide-court">Aucune valorisation enregistrée.</p>'}
      ${hist.length >= 2 ? blocComparaison(hist) : ''}`;
  }
  const tDate = (s) => { const [a, m, j] = String(s).split('-').map(Number); return new Date(a, m - 1, j || 1).getTime(); };
  const fmtMoisCourt = (s) => { const [a, m] = String(s).split('-').map(Number); return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }); };
  let comparaison = { a: null, b: null };
  function blocComparaison(hist) {
    const a = hist.find((h) => h.id === comparaison.a) || hist[0];
    const z = hist.find((h) => h.id === comparaison.b) || hist.at(-1);
    const c = C.comparer(a, z);
    const opt = (choix) => hist.map((h) => `<option value="${h.id}" ${h.id === choix.id ? 'selected' : ''}>${fmtDate(h.date)}</option>`).join('');
    const ec = (x) => `${x.ecart >= 0 ? '+' : '−'}${euros(Math.abs(x.ecart))}`;
    return `<h2 class="titre-section">Comparer deux dates</h2>
      <div class="rang comparer"><label class="champ compact">Du<select data-comparer="a">${opt(a)}</select></label><label class="champ compact">au<select data-comparer="b">${opt(z)}</select></label></div>
      <div class="defile"><table class="tableau"><thead><tr><th></th><th class="nb">${fmtDate(a.date)}</th><th class="nb">${fmtDate(z.date)}</th><th class="nb">Écart</th></tr></thead><tbody>
        <tr><td>Nombre d'objets</td><td class="nb">${a.nb}</td><td class="nb">${z.nb}</td><td class="nb">${c.nb.ecart >= 0 ? '+' : ''}${c.nb.ecart}</td></tr>
        <tr><td>Prix d'achat total</td><td class="nb">${euros(a.achat)}</td><td class="nb">${euros(z.achat)}</td><td class="nb">${ec(c.achat)}</td></tr>
        <tr class="total"><td>Valeur actuelle estimée</td><td class="nb">${euros(a.actuelle)}</td><td class="nb">${euros(z.actuelle)}</td><td class="nb">${ec(c.actuelle)}</td></tr>
        <tr><td>Revente potentielle</td><td class="nb">${euros(a.revente)}</td><td class="nb">${euros(z.revente)}</td><td class="nb">${ec(c.revente)}</td></tr>
        ${c.categories.filter((x) => x.actuelle.ecart).map((x) => `<tr><td>· ${esc(categorie(x.id).nom)}</td><td class="nb">${euros(x.actuelle.avant)}</td><td class="nb">${euros(x.actuelle.apres)}</td><td class="nb">${ec(x.actuelle)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note">Un écart combine les achats, les objets retirés et la décote du temps qui passe.</p>`;
  }

  // ---------- Vue : méthode et coefficients ----------
  function vueMethode() {
    const c = E.coefs;
    const num = (cle, v, unite = '%') => `<span class="avec-unite"><input data-coef="${cle}" inputmode="decimal" value="${esc(champNombre(v))}" aria-label="${cle}"><span>${unite}</span></span>`;
    const liq = { forte: 'Forte', moyenne: 'Moyenne', faible: 'Faible' };
    return `<div class="vue-tete"><div><h1>Méthode de valorisation</h1><p>Toutes les règles sont visibles et modifiables. Elles donnent des ordres de grandeur, pas des cotes : quand tu connais la valeur d'un objet, saisis-la dans sa fiche.</p></div>
      <div class="actions"><button class="btn" data-action="coefs-defaut" ${coefsModifies() ? '' : 'disabled'}>Revenir aux coefficients intégrés</button></div></div>
      <div class="trois-valeurs">
        <div><span class="etiquette sable">1</span><h3>Prix d'achat historique</h3><p>Ce que tu as payé, tel que tu le saisis. Il ne change jamais.</p></div>
        <div><span class="etiquette ciel">2</span><h3>Valeur actuelle estimée</h3><p>Ce que vaut l'objet aujourd'hui dans son état, d'après la décote de sa famille, son âge, son état et son prix. Ce n'est ni une valeur d'assurance (souvent à neuf ou selon un barème de vétusté du contrat) ni une valeur comptable.</p></div>
        <div><span class="etiquette beurre">3</span><h3>Valeur de revente potentielle</h3><p>Ce qu'une vente rapide entre particuliers pourrait rapporter, avant frais. Le simulateur déduit ensuite négociation, commissions et expédition.</p></div>
      </div>
      <div class="hypotheses"><p><b>Calcul.</b> Valeur actuelle = prix d'achat × part conservée selon l'âge × coefficient d'état. La part conservée baisse de façon linéaire pendant la première année (perte « 1<sup>re</sup> année »), puis de la perte annuelle chaque année sur ce qui reste, sans descendre sous le plancher. L'âge = durée de possession depuis la date d'achat + âge à l'achat pour un objet d'occasion (la décote déjà subie avant ton achat n'est pas recomptée). Le prix d'achat accélère ou ralentit la décote (multiplicateur par tranche).</p>
        <p><b>Revente</b> = valeur actuelle × (1 − écart de revente de la famille). <b>Facilement revendable</b> : famille à liquidité forte en bon état au moins, ou moyenne en très bon état au moins.</p>
        <p><b>Origine des coefficients.</b> Hypothèses QME, fixées comme ordres de grandeur prudents de la dépréciation par famille d'objets. Elles ne proviennent d'aucune cotation, d'aucun site de vente et d'aucun barème d'assureur, et aucun prix n'est récupéré en ligne.</p></div>
      <h2 class="titre-section">Familles de décote</h2>
      <div class="defile"><table class="tableau coefs"><thead><tr><th>Famille</th><th class="nb">Perte 1<sup>re</sup> année</th><th class="nb">Perte annuelle ensuite</th><th class="nb">Plancher</th><th class="nb">Écart de revente</th><th>Liquidité</th></tr></thead><tbody>
        ${c.familles.map((f) => `<tr><td><b>${esc(f.nom)}</b><small class="bloc-note">${esc(f.note || '')}</small></td><td class="nb">${num(`fam.${f.id}.an1`, f.an1)}</td><td class="nb">${num(`fam.${f.id}.annuel`, f.annuel)}</td><td class="nb">${num(`fam.${f.id}.plancher`, f.plancher)}</td><td class="nb">${num(`fam.${f.id}.revente`, f.revente)}</td>
          <td><select data-coef="fam.${f.id}.liquidite" aria-label="Liquidité ${esc(f.nom)}">${Object.entries(liq).map(([k, n]) => `<option value="${k}" ${f.liquidite === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>
      <div class="deux-colonnes">
        <div><h2 class="titre-section">Coefficients d'état</h2><div class="defile"><table class="tableau"><thead><tr><th>État</th><th class="nb">Coefficient</th></tr></thead><tbody>
          ${c.etats.map((e) => `<tr><td><b>${esc(e.nom)}</b><small class="bloc-note">${esc(e.aide)}</small></td><td class="nb">${num(`etat.${e.id}`, e.coef, '×')}</td></tr>`).join('')}</tbody></table></div></div>
        <div><h2 class="titre-section">Prix d'achat et vitesse de décote</h2><div class="defile"><table class="tableau"><thead><tr><th>Prix unitaire</th><th class="nb">Multiplicateur</th></tr></thead><tbody>
          ${c.tranchesPrix.map((t, i) => `<tr><td>${esc(t.nom)}</td><td class="nb">${num(`tranche.${i}`, t.mult, '×')}</td></tr>`).join('')}</tbody></table></div>
          <p class="note">Au-dessus de 1, la décote est plus rapide ; en dessous, plus lente.</p>
          <h2 class="titre-section">Exemple</h2>${exempleCalcul()}</div>
      </div>`;
  }
  function exempleCalcul() {
    const ex = normaliserObjet({ id: 'ex', nom: 'Ordinateur portable', categorie: 'informatique', sousCategorie: 'portables', prixAchat: 1000, dateAchat: moisIso(decaler(-24)), etat: 'bon' });
    const v = valoriser(ex);
    return `<p class="aide">Exemple fictif : un ordinateur portable payé 1 000 € il y a deux ans, en bon état, vaut environ <b>${euros(v.actuelle)}</b> selon tes coefficients, et se revendrait autour de <b>${euros(v.revente)}</b> avant frais.</p>`;
  }
  function appliquerCoef(el) {
    const [type, id, cle] = el.dataset.coef.split('.');
    if (type === 'fam') {
      const f = E.coefs.familles.find((x) => x.id === id);
      if (cle === 'liquidite') { f.liquidite = el.value; return true; }
      const n = lireNombre(el.value);
      if (n === null || n < 0 || n > 100) { toast('Indique un pourcentage entre 0 et 100.'); return false; }
      f[cle] = n; return true;
    }
    const n = lireNombre(el.value);
    if (n === null || n < 0 || n > 3) { toast('Indique un coefficient entre 0 et 3.'); return false; }
    if (type === 'etat') E.coefs.etats.find((x) => x.id === id).coef = n;
    if (type === 'tranche') E.coefs.tranchesPrix[Number(id)].mult = n;
    return true;
  }

  // ---------- Partage (texte et image, choix des informations) ----------
  function textePartage(b, p) {
    const lignes = [];
    if (p.montants) lignes.push(`Si je revendais tout ce que je possède aujourd'hui, je pourrais récupérer environ ${euros(b.total.revente)}${p.revente ? '' : ''} (valeur actuelle estimée : ${euros(b.total.actuelle)}${p.nombre ? ` pour ${pluriel(b.nbObjets, 'objet')}` : ''}).`);
    else lignes.push(`Si je revendais tout ce que je possède aujourd'hui, je récupérerais environ ${pct(b.total.achat ? b.total.revente / b.total.achat : 0)} de ce que mes objets m'ont coûté${p.nombre ? ` (${pluriel(b.nbObjets, 'objet')} inventoriés)` : ''}.`);
    if (p.repartition) lignes.push(`Là où est la valeur : ${b.categories.slice(0, 4).map((c) => `${categorie(c.id).nom} ${pct(c.part)}`).join(', ')}.`);
    if (p.revente && complet()) lignes.push(`Objets peu utilisés : ${p.montants ? euros(b.valeurPeuUtilises) : pct(b.total.actuelle ? b.valeurPeuUtilises / b.total.actuelle : 0)} de valeur qui dort.`);
    lignes.push('Estimation indicative (pas une expertise), calculée avec l\'inventaire valorisé QME.');
    return lignes.join('\n');
  }
  function modalePartage() {
    if (!E.objets.length) return toast('Ajoute d\'abord quelques objets.');
    const p = E.partage;
    const ca = (cle, lib) => `<label class="case"><input type="checkbox" name="${cle}" ${p[cle] ? 'checked' : ''}> ${lib}</label>`;
    ouvrirModale('Partager le résultat', `<p>Rien n'est publié automatiquement : tu choisis ce qui apparaît, puis tu copies le texte ou télécharges l'image pour la partager toi-même.</p>
      <div class="cases">${ca('montants', 'Afficher les montants en euros')}${ca('nombre', 'Afficher le nombre d\'objets')}${ca('repartition', 'Afficher la répartition par catégorie')}${complet() ? ca('revente', 'Afficher la valeur des objets peu utilisés') : ''}</div>
      <textarea class="apercu-texte" id="partage-texte" readonly rows="5"></textarea>
      <div class="rang"><button class="btn" type="button" data-action="copier">Copier le texte</button><button class="btn primaire" type="button" data-action="image">Télécharger l'image</button></div>`,
    '<button class="btn" value="annuler">Fermer</button>');
    const form = modale().querySelector('form');
    const maj = () => { for (const k of Object.keys(p)) if (form.elements[k]) p[k] = form.elements[k].checked; $('#partage-texte').value = textePartage(bilan(), p); };
    form.addEventListener('change', () => { maj(); sauver(); });
    maj();
  }
  async function copierTexte() {
    const t = $('#partage-texte')?.value || '';
    try { await navigator.clipboard.writeText(t); toast('Texte copié.'); } catch { $('#partage-texte').select(); toast('Sélectionne le texte et copie-le.'); }
  }
  async function imagePartage() {
    const b = bilan(), p = E.partage;
    const L = 1080, cv = document.createElement('canvas');
    cv.width = L; cv.height = L;
    const x = cv.getContext('2d');
    try { await document.fonts.ready; } catch { /* police système */ }
    const police = (taille, poids = 700) => `${poids} ${taille}px Outfit, system-ui, sans-serif`;
    x.fillStyle = '#FBF7F1'; x.fillRect(0, 0, L, L);
    x.fillStyle = '#D8E4F0'; x.beginPath(); x.arc(L - 120, 140, 230, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#E8B93A'; x.fillRect(80, 80, 64, 64);
    x.fillStyle = '#24221F'; x.font = police(30, 600); x.fillText('Si je revendais tout aujourd\'hui…', 80, 210);
    x.font = police(120, 800); x.fillText(p.montants ? euros(b.total.revente) : pct(b.total.achat ? b.total.revente / b.total.achat : 0), 80, 340);
    x.font = police(30, 500); x.fillStyle = '#514C44';
    x.fillText(p.montants ? `récupérables · valeur actuelle estimée ${euros(b.total.actuelle)}` : 'de ce que mes objets m\'ont coûté', 80, 395);
    if (p.nombre) x.fillText(`${pluriel(b.nbObjets, 'objet')} inventoriés`, 80, 440);
    if (p.repartition) {
      x.fillStyle = '#24221F'; x.font = police(34, 700); x.fillText('Là où est la valeur', 80, 540);
      const cats = b.categories.slice(0, 5);
      cats.forEach((c, i) => {
        const y = 590 + i * 72;
        x.fillStyle = '#E4DCCE'; x.beginPath(); x.roundRect(80, y, 600, 30, 15); x.fill();
        x.fillStyle = BLEU; x.beginPath(); x.roundRect(80, y, Math.max(30, 600 * c.part), 30, 15); x.fill();
        x.fillStyle = '#24221F'; x.font = police(26, 600); x.fillText(`${categorie(c.id).nom.slice(0, 26)} · ${pct(c.part)}`, 700, y + 24);
      });
    }
    x.fillStyle = '#6E685F'; x.font = police(22, 500);
    x.fillText('Estimation indicative, pas une expertise ni une garantie de revente.', 80, L - 90);
    x.fillStyle = '#24221F'; x.font = police(24, 700); x.fillText('Inventaire valorisé · QME', 80, L - 50);
    cv.toBlob((blob) => { telecharger(`mon-inventaire-${auj()}.png`, blob); toast('Image téléchargée.'); }, 'image/png');
  }

  // ---------- Rapport imprimable ----------
  function imprimer() {
    const b = bilan();
    let zone = $('#impression');
    if (!zone) { zone = document.createElement('div'); zone.id = 'impression'; document.body.append(zone); }
    zone.innerHTML = `<h1>Inventaire valorisé · rapport du ${fmtDate(auj())}</h1>
      <p>${pluriel(b.nbObjets, 'objet')} · prix d'achat ${euros(b.total.achat)} · valeur actuelle estimée ${euros(b.total.actuelle)} · revente potentielle ${euros(b.total.revente)} · perte estimée ${euros(b.total.perte)} (${pct(b.tauxDepreciation)}).</p>
      <p>Objets peu utilisés : ${euros(b.valeurPeuUtilises)} · jamais utilisés : ${euros(b.valeurJamais)} · part facilement revendable : ${pct(b.partFacile)}.</p>
      <h2>Par catégorie</h2><table><thead><tr><th>Catégorie</th><th>Objets</th><th>Achat</th><th>Actuelle</th><th>Revente</th><th>Part</th></tr></thead><tbody>
      ${b.categories.map((c) => `<tr><td>${esc(categorie(c.id).nom)}</td><td>${c.nb}</td><td>${euros(c.achat)}</td><td>${euros(c.actuelle)}</td><td>${euros(c.revente)}</td><td>${pct(c.part)}</td></tr>`).join('')}</tbody></table>
      <h2>Scénarios de revente</h2><table><thead><tr><th>Scénario</th><th>Objets vendus</th><th>Revente</th><th>Net récupérable</th></tr></thead><tbody>
      ${E.simulations.map((s) => { const r = C.simuler(b.lignes, s, B); return `<tr><td>${esc(s.nom)}</td><td>${r.nbVendus}</td><td>${euros(r.reventeBrute)}</td><td>${euros(r.net)}</td></tr>`; }).join('') || '<tr><td colspan="4">Aucun scénario.</td></tr>'}</tbody></table>
      <h2>Inventaire détaillé</h2><table><thead><tr><th>Objet</th><th>Catégorie</th><th>Achat</th><th>État</th><th>Utilisation</th><th>Prix d'achat</th><th>Actuelle</th><th>Revente</th></tr></thead><tbody>
      ${[...b.lignes].sort((p, q) => q.v.actuelle - p.v.actuelle).map(({ objet: o, v }) => `<tr><td>${esc(o.nom)}${v.quantite > 1 ? ` × ${v.quantite}` : ''}${o.marque ? ` (${esc(o.marque)})` : ''}</td><td>${esc(categorie(o.categorie).nom)}</td><td>${esc(fmtMois(o.dateAchat))}</td><td>${esc(etatNom(o.etat))}</td><td>${esc(usageNom(o.usage))}</td><td>${euros(v.achat)}</td><td>${euros(v.actuelle)}${v.source === 'manuelle' ? ' *' : ''}</td><td>${euros(v.revente)}</td></tr>`).join('')}</tbody></table>
      <p>* valeur saisie par l'utilisateur. Autres valeurs : estimations algorithmiques d'après les coefficients de la méthode${coefsModifies() ? ' (modifiés par l\'utilisateur)' : ' intégrés'}. Ce rapport n'est ni une expertise, ni une valeur d'assurance, ni une valeur comptable, ni une garantie de prix de revente.</p>`;
    window.print();
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const lieu = session.demo ? 'En exemple, les données fictives restent dans ce navigateur.' : session.decouverte ? 'En découverte, tes objets restent dans ce navigateur et ne sont jamais envoyés.' : 'Ton inventaire est enregistré en ligne sous ta clé (connexion chiffrée), sans nom ni adresse, avec une copie sur cet appareil pour le hors ligne.';
    const corps = `
      <div class="groupe"><h3>Export complet</h3><p class="aide">${lieu}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Copie complète (JSON)</button>${complet() ? '<button class="btn petit" type="button" data-action="csv">Inventaire (CSV)</button><button class="btn petit" type="button" data-action="imprimer">Rapport imprimable</button>' : ''}
        <label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Confidentialité</h3>
        <p class="aide">Ton inventaire révèle une partie de ton patrimoine : il n'est jamais partagé automatiquement, ni avec QME, ni avec un site de vente. Le partage du bilan est volontaire et tu choisis ce qui y figure. Sur un appareil partagé, décoche « Rester connecté » à la connexion : la copie locale disparaît à la fermeture du navigateur.</p>
        <div class="rang"><button class="btn petit danger" type="button" data-action="tout-effacer">Effacer toutes mes données</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Exemple complet (données fictives).</p>' : session.decouverte ? `<p>Découverte gratuite. <a href="${PAGE_OFFRE}">Application complète · ${PRIX}</a></p>` : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter l\'exemple' : session.decouverte ? 'Quitter la découverte' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <p class="mention">Estimations indicatives : ni expertise, ni valeur d'assurance, ni garantie de revente.</p>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.objets)) throw new Error();
        if (session.decouverte && d.objets.length > B.decouverte.maxObjets) { toast(`La découverte garde ${B.decouverte.maxObjets} objets au plus : cette copie en contient ${d.objets.length}.`); return; }
        if (!confirm(`Remplacer ton inventaire actuel par cette copie (${pluriel(d.objets.length, 'objet')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de l\'inventaire.'); }
    });
  }
  function toutEffacer() {
    if (!confirm(session.decouverte || session.demo ? 'Effacer toutes les données de ce navigateur ?' : 'Effacer tout ton inventaire, en ligne et sur cet appareil ? Pense à télécharger une copie avant : cette action est définitive.')) return;
    if (session.demo) { stock.suppr(CLE_DEMO); modale().close(); deconnecter(); return; }
    if (session.decouverte) { stock.suppr(CLE_DECOUVERTE); modale().close(); deconnecter(); return; }
    E = etatVide();
    modale().close();
    sauver();
    toast('Toutes tes données ont été effacées.');
    ecranAccueil();
  }
  function exporter() { telecharger(`inventaire-valorise-${auj()}.json`, JSON.stringify(E, null, 2), 'application/json'); toast('Copie téléchargée.'); }
  function exporterCSV() { telecharger(`inventaire-valorise-${auj()}.csv`, C.csv(bilan(), B, E.coefs), 'text/csv;charset=utf-8'); toast('Fichier CSV téléchargé (séparateur point-virgule).'); }

  // ---------- Ajout à l'écran d'accueil ----------
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
    const blocs = a === 'ios' ? ETAPES_IOS : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
    const pied = auto ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>' : '<button class="btn primaire" value="ok">Fermer</button>';
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
  function annuler() {
    if (!annulation) return;
    annulation(); annulation = null;
    sauver(); rendre();
    toast('Modification annulée.');
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-voir': if (confirm('Ouvrir l\'exemple complet ? Tes objets de découverte restent enregistrés dans ce navigateur.')) ouvrirDemo(); break;
      case 'decouverte': ouvrirDecouverte(); break;
      case 'demo-reinit': if (confirm('Effacer les données de l\'exemple et repartir de zéro ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': deconnecter(); break;
      case 'a-cat': if (choixAccueil.has(id)) choixAccueil.delete(id); else choixAccueil.add(id); el.setAttribute('aria-pressed', String(choixAccueil.has(id))); break;
      case 'a-tout': B.categories.forEach((c) => choixAccueil.add(c.id)); document.querySelectorAll('[data-action="a-cat"]').forEach((b) => b.setAttribute('aria-pressed', 'true')); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'reprendre-essai': reprendreEssai(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': if (complet()) exporterCSV(); break;
      case 'imprimer': if (complet()) { if (modale().open) modale().close(); imprimer(); } break;
      case 'tout-effacer': toutEffacer(); break;
      case 'fermer': modale().close(); break;
      case 'ajouter': modaleObjet(null, { cat: el.dataset.cat, sous: el.dataset.sous, nom: el.dataset.nom }); break;
      case 'objet': modaleObjet(id); break;
      case 'supprimer': supprimerObjet(id); break;
      case 'cat-ajout': if (!E.categoriesPossedees.includes(id)) E.categoriesPossedees.push(id); sauver(); rendre(); $(`#cat-${id}`)?.scrollIntoView({ block: 'start' }); break;
      case 'filtre-raz': filtre = { texte: '', categorie: '' }; rendre(); break;
      case 'partager': modalePartage(); break;
      case 'copier': copierTexte(); break;
      case 'image': imagePartage(); break;
      case 'sim-activer': E.simActive = id; sauver(); if (vue !== 'revente') changerVue('revente'); else rendre(); break;
      case 'sim-nouveau': case 'sim-dupliquer': {
        if (E.simulations.length >= MAX_SIMULATIONS) { toast(`${MAX_SIMULATIONS} scénarios au maximum.`); break; }
        const base = action === 'sim-dupliquer' ? { ...structuredClone(simActive()), id: uid(), nom: `${simActive().nom} (copie)`.slice(0, 40) } : simulationVide(`Scénario ${E.simulations.length + 1}`);
        E.simulations.push(base); E.simActive = base.id; sauver(); rendre(); break;
      }
      case 'sim-suppr': {
        const s = simActive(); const i = E.simulations.indexOf(s);
        E.simulations.splice(i, 1); E.simActive = E.simulations[0]?.id;
        annulation = () => { E.simulations.splice(i, 0, s); E.simActive = s.id; };
        sauver(); rendre(); toast(`« ${s.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'instantane': {
        const h = C.instantane(bilan(), auj(), uid());
        E.historique = E.historique.filter((x) => x.date !== h.date && !(x.auto && String(x.date).slice(0, 7) === h.date.slice(0, 7)));
        E.historique.push(h); sauver(); rendre(); toast(`Valorisation du jour enregistrée : ${euros(h.actuelle)}.`); break;
      }
      case 'instantane-suppr': {
        const i = E.historique.findIndex((x) => x.id === id); if (i < 0) break;
        const [h] = E.historique.splice(i, 1);
        annulation = () => { E.historique.splice(i, 0, h); };
        sauver(); rendre(); toast('Valorisation supprimée.', { libelle: 'Annuler', faire: annuler }); break;
      }
      case 'coefs-defaut': {
        const avant = structuredClone(E.coefs);
        E.coefs = coefsDefaut();
        annulation = () => { E.coefs = avant; };
        sauver(); rendre(); toast('Coefficients intégrés rétablis.', { libelle: 'Annuler', faire: annuler }); break;
      }
      default: break;
    }
  });
  document.addEventListener('submit', (e) => { if (e.target.id === 'ajout-rapide') { e.preventDefault(); ajoutRapide(); } });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!E) return;
    if (el.dataset.filtre === 'texte') { filtre.texte = el.value; const pos = el.selectionStart; rendre(); const n = $('[data-filtre="texte"]'); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (el.dataset.sim && el.type !== 'radio' && el.tagName !== 'SELECT') {
      if (appliquerSim(el) === 'maj') { sauver(); $('#sim-resultat').innerHTML = resultatSimulation(simActive()); $('#sim-comparaison').innerHTML = comparaisonSimulations(); document.querySelectorAll('[data-action="sim-activer"].puce-scenario').forEach((b) => { if (b.dataset.id === E.simActive) b.textContent = simActive().nom; }); }
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!E) return;
    if (el.dataset.filtre === 'categorie') { filtre.categorie = el.value; rendre(); return; }
    if (el.dataset.sim && (el.type === 'radio' || el.tagName === 'SELECT')) { appliquerSim(el); sauver(); rendre(); return; }
    if (el.dataset.coef) { if (appliquerCoef(el)) { sauver(); rendre(); } else rendre(); return; }
    if (el.dataset.reglage === 'seuilValeur') { const n = lireNombre(el.value); E.seuilValeur = n === null ? B.seuilValeur : Math.max(0, n); sauver(); rendre(); return; }
    if (el.dataset.comparer) { comparaison[el.dataset.comparer] = el.value; rendre(); }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.target.dataset?.sim || e.target.dataset?.coef || e.target.dataset?.reglage)) { e.preventDefault(); e.target.blur(); } });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && E) rafraichir(); });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (vue === 'analyse' && Math.abs(window.innerWidth - largeur) > 40 && !modale().open) { largeur = window.innerWidth; rendre(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    const demoUrl = new URLSearchParams(location.search).has('demo');
    if (demoUrl) history.replaceState(null, '', location.pathname + location.hash);
    // Lien ?demo : n'écrase jamais la clé d'un acheteur enregistrée, et n'est pas mémorisé.
    if (demoUrl && !code) return ouvrirDemo(false);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    if (code === CODE_DECOUVERTE) return ouvrirDecouverte();
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
        if (aCommence()) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement.
  window.__ptm = { etat: () => E, bilan: () => bilan(), session: () => ({ ...session }) };
  init();
})();
