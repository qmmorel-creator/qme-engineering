// Garde-manger et dates de péremption QME : inventaire par lieu (réfrigérateur, congélateur, placard…), DLC et
// DDM distinguées, date d'ouverture, vue « à consommer en priorité », produits consommés ou jetés avec le suivi
// du gaspillage, liste de courses issue des produits épuisés.
// Données synchronisées par clé de licence ou code d'accès. Aucun scan de code-barres, aucune base produit,
// aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.GRD;
  const API = '/api/templates';
  const PRODUIT = 'GRD';
  const CLE_CODE = 'qme-grd-code';
  const CLE_CACHE = 'qme-grd-cache';
  const CLE_DEMO = 'qme-grd-demo';
  const CLE_PREF = 'qme-grd-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-grd-ecran-accueil';

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
  const auj = () => R.iso(new Date());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  // « 4 pots », « 250 g », « 1 paquet » : les unités en toutes lettres prennent un s au-delà de 1.
  const unitePluriel = (u, n) => (n > 1 && u.length > 2 && !/[sxz]$/i.test(u) ? `${u}s` : u);
  const qte = (p) => `${R.nombreFr(p.quantite)}${p.unite ? ` ${unitePluriel(p.unite, p.quantite)}` : ''}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'priorites';
  const pref = stock.lire(CLE_PREF) || {};
  const filtre = { lieu: pref.lieu || '', q: '', periode: ['30', '90', '365', 'tout'].includes(pref.periode) ? pref.periode : '90' };
  let annulation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const etatVide = (codes) => ({ ...R.etatVide(B, codes), tutorielVu: false });
  const normaliser = (d) => R.normaliser(d, B);
  const trouver = (l, id) => (E[l] || []).find((x) => x.id === id);
  const lieu = (id) => R.lieuDe(E, id);
  const categorie = (id) => R.categorieDe(E, id);
  const couleur = (c) => B.couleurs[(c?.couleur || 0) % B.couleurs.length];
  const echeance = (p) => R.echeance(E, p, B);
  const niveau = (p) => R.niveau(E, p, auj(), B);
  const alerte = (p) => R.messageAlerte(E, p, auj(), B);
  const source = (id) => B.sources.find((s) => s.id === id);
  function sauverPref() { stock.ecrire(CLE_PREF, { lieu: filtre.lieu, periode: filtre.periode }); }

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
        const vu = E.tutorielVu;
        E = normaliser(corps.donnees);
        if (vu) E.tutorielVu = true;
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié le garde-manger entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte puis retire l\'historique ancien (Réglages).');
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
  // Code interne (GRD-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Foyer fictif : réfrigérateur, congélateur, placard et corbeille à fruits, une trentaine de produits datés à
  // partir d'aujourd'hui, avec au moins un produit à chaque niveau (DLC dépassée, délai après ouverture dépassé,
  // DDM dépassée, aujourd'hui, sous 3 jours, cette semaine, plus tard, sans échéance), un produit décongelé, des
  // produits congelés avec et sans date fixée ; six mois d'historique (consommés et jetés, avec motifs et valeurs)
  // et une liste de courses dont des produits épuisés.
  function donneesDemo() {
    const a = auj();
    const j = (n) => R.ajout(a, n);
    const e = etatVide(['frigo', 'congel', 'placard', 'corbeille']);
    e.reglages.foyer = 'Foyer Lefèvre (fictif)';
    // Valeur choisie par le foyer fictif pour ses restes (Rangement) : pas une valeur officielle.
    e.categories.find((c) => c.id === 'restes').sansDate = 2;
    const P = (nom, lieuId, cat, quantite, unite, typeDate, date, x = {}) => e.produits.push(R.normaliserProduit({ id: uid(), nom, lieu: lieuId, categorie: cat, quantite, unite, typeDate, date, achat: x.achat || j(-3), ...x }));
    // Réfrigérateur
    P('Blancs de poulet', 'frigo', 'viande', 2, 'pièce', 'DLC', j(-1), { valeur: 6.4, achat: j(-5) });
    P('Pesto au basilic', 'frigo', 'condiments', 1, 'pot', 'DDM', j(85), { ouvertLe: j(-10), joursOuverture: 7, valeur: 2.9, achat: j(-30), note: 'À conserver au frais après ouverture' });
    P('Jambon blanc', 'frigo', 'charcuterie', 4, 'tranche', 'DLC', j(0), { valeur: 3.2 });
    P('Petit pot carottes', 'frigo', 'bebe', 1, 'pot', 'DDM', j(70), { ouvertLe: j(-2), joursOuverture: 2, valeur: 1.1, achat: j(-20) });
    P('Yaourts nature', 'frigo', 'laitier', 4, 'pot', 'DLC', j(2), { valeur: 1.6 });
    P('Lait demi-écrémé', 'frigo', 'laitier', 1, 'bouteille', 'DDM', j(40), { ouvertLe: j(-1), joursOuverture: 3, valeur: 1.15, achat: j(-12) });
    P('Saumon fumé', 'frigo', 'poisson', 2, 'tranche', 'DLC', j(5), { ouvertLe: j(-1), joursOuverture: 2, valeur: 4.5 });
    P('Taboulé (traiteur)', 'frigo', 'traiteur', 1, 'barquette', 'aucune', '', { achat: j(-1), valeur: 3.8 });
    P('Filets de cabillaud', 'frigo', 'poisson', 2, 'pièce', 'aucune', '', { decongeleLe: j(-1), achat: j(-25), valeur: 7.9, note: 'Sortis du congélateur hier' });
    P('Salade en sachet', 'frigo', 'fruits', 1, 'sachet', 'DLC', j(3), { valeur: 1.5 });
    P('Hachis parmentier', 'frigo', 'restes', 3, 'portion', 'aucune', '', { achat: j(-1), note: 'Fait dimanche' });
    P('Mozzarella', 'frigo', 'fromage', 2, 'pièce', 'DLC', j(5), { valeur: 2.2 });
    P('Sauce tomate', 'frigo', 'conserves', 1, 'bocal', 'DDM', j(200), { ouvertLe: j(-2), joursOuverture: 5, valeur: 1.9, achat: j(-40) });
    P('Comté', 'frigo', 'fromage', 250, 'g', 'DLC', j(21), { valeur: 5.6 });
    P('Œufs', 'frigo', 'oeufs', 6, 'pièce', 'DDM', j(12), { valeur: 2.4 });
    P('Crème fraîche', 'frigo', 'laitier', 1, 'pot', 'DLC', j(9), { ouvertLe: j(-1), valeur: 1.7 });
    // Congélateur
    P('Petits pois', 'congel', 'surgeles', 1, 'sachet', 'DDM', j(210), { valeur: 2.1, achat: j(-60) });
    P('Steaks hachés', 'congel', 'viande', 4, 'pièce', 'DLC', j(-30), { congeleLe: j(-38), limiteCongel: j(6), valeur: 6.9, achat: j(-38), note: 'Congelés le jour de l\'achat' });
    P('Pain de mie', 'congel', 'epicerie', 1, 'paquet', 'DDM', j(-60), { congeleLe: j(-110), limiteCongel: j(-5), valeur: 1.8, achat: j(-110) });
    P('Soupe de légumes maison', 'congel', 'restes', 4, 'portion', 'aucune', '', { congeleLe: j(-20), achat: j(-20) });
    P('Glace vanille', 'congel', 'surgeles', 1, 'boîte', 'DDM', j(150), { valeur: 3.5, achat: j(-15) });
    // Placard
    P('Pâtes coquillettes', 'placard', 'feculents', 2, 'paquet', 'DDM', j(320), { valeur: 2.4, achat: j(-30) });
    P('Riz long', 'placard', 'feculents', 1, 'kg', 'DDM', j(410), { valeur: 2.3, achat: j(-45) });
    P('Farine', 'placard', 'epicerie', 1, 'kg', 'DDM', j(-20), { valeur: 1.1, achat: j(-200), ouvertLe: j(-90) });
    P('Thon au naturel', 'placard', 'conserves', 3, 'boîte', 'DDM', j(540), { valeur: 5.1, achat: j(-50) });
    P('Biscuits au beurre', 'placard', 'epicerie', 1, 'paquet', 'DDM', j(6), { valeur: 2, achat: j(-80) });
    P('Céréales', 'placard', 'feculents', 1, 'paquet', 'DDM', j(1), { valeur: 3.2, achat: j(-120), ouvertLe: j(-14) });
    P('Huile d\'olive', 'placard', 'condiments', 1, 'bouteille', 'DDM', j(260), { valeur: 8.5, achat: j(-60), ouvertLe: j(-50) });
    P('Lait infantile 2e âge', 'placard', 'bebe', 1, 'boîte', 'DDM', j(300), { valeur: 17.9, achat: j(-10) });
    // Corbeille
    P('Bananes', 'corbeille', 'fruits', 5, 'pièce', 'aucune', '', { achat: j(-2), valeur: 1.4 });
    P('Pommes', 'corbeille', 'fruits', 1, 'kg', 'aucune', '', { achat: j(-4), valeur: 2.6 });

    // Historique sur six mois : sorties générées de façon reproductible (pseudo-aléatoire à graine fixe),
    // avec un gaspillage en baisse ces derniers mois.
    let graine = 7;
    const hasard = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
    const habituels = [
      ['Yaourts nature', 'laitier', 'frigo', 4, 'pot', 1.6], ['Lait demi-écrémé', 'laitier', 'frigo', 1, 'bouteille', 1.15], ['Jambon blanc', 'charcuterie', 'frigo', 4, 'tranche', 3.2],
      ['Pâtes coquillettes', 'feculents', 'placard', 1, 'paquet', 1.2], ['Salade en sachet', 'fruits', 'frigo', 1, 'sachet', 1.5], ['Poulet rôti', 'viande', 'frigo', 1, 'pièce', 8.5],
      ['Fromage blanc', 'laitier', 'frigo', 1, 'pot', 2.1], ['Tomates', 'fruits', 'corbeille', 1, 'kg', 3.2], ['Pain de mie', 'epicerie', 'placard', 1, 'paquet', 1.8],
      ['Courgettes', 'fruits', 'corbeille', 3, 'pièce', 2.4], ['Steaks hachés', 'viande', 'congel', 4, 'pièce', 6.9], ['Crème dessert', 'laitier', 'frigo', 4, 'pot', 2.3],
    ];
    const jetables = [
      ['Salade en sachet', 'fruits', 'frigo', 1, 'sachet', 1.5, 'perime'], ['Fraises', 'fruits', 'corbeille', 1, 'barquette', 3.5, 'abime'], ['Reste de gratin', 'restes', 'frigo', 2, 'portion', 0, 'oublie'],
      ['Crème fraîche', 'laitier', 'frigo', 1, 'pot', 1.7, 'perime'], ['Pain', 'epicerie', 'placard', 1, 'pièce', 1.1, 'trop'], ['Jambon blanc', 'charcuterie', 'frigo', 2, 'tranche', 1.6, 'perime'],
      ['Courgettes', 'fruits', 'corbeille', 2, 'pièce', 1.6, 'abime'], ['Riz cuisiné', 'restes', 'frigo', 1, 'portion', 0, 'trop'], ['Mousse au chocolat', 'laitier', 'frigo', 2, 'pot', 1.2, 'gout'],
    ];
    const S = (date, type, [produit, cat, lieuId, quantite, unite, valeur, motif]) => e.sorties.push(R.normaliserSortie({ id: uid(), date, type, produit, categorie: cat, lieu: lieuId, quantite, unite, valeur, motif: type === 'jete' ? motif : '' }));
    for (let n = 182; n >= 4; n -= 1) {
      const d = j(-n);
      if (hasard() < 0.55) S(d, 'consomme', habituels[Math.floor(hasard() * habituels.length)]);
      const tauxJete = n > 90 ? 0.16 : n > 45 ? 0.1 : 0.06;
      if (hasard() < tauxJete) S(d, 'jete', jetables[Math.floor(hasard() * jetables.length)]);
    }
    // Épuisés ces derniers jours, ni en stock ni sur la liste : proposés dans les courses.
    S(j(-3), 'consomme', ['Beurre doux', 'laitier', 'frigo', 1, 'plaquette', 2.3]);
    S(j(-2), 'consomme', ['Jus d\'orange', 'boissons', 'placard', 1, 'bouteille', 2.6]);
    S(j(-1), 'consomme', ['Café moulu', 'epicerie', 'placard', 1, 'paquet', 4.2]);
    S(j(-1), 'jete', ['Fraises', 'fruits', 'corbeille', 1, 'barquette', 3.5, 'abime']);
    // Liste de courses
    const C = (nom, cat, fait = false, origine = 'main') => e.courses.push(R.normaliserCourse({ id: uid(), nom, categorie: cat, fait, ajouteLe: j(-1), origine }));
    C('Pain', 'epicerie'); C('Tomates', 'fruits'); C('Fromage blanc', 'laitier', false, 'epuise'); C('Poulet rôti', 'viande', true, 'epuise');
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Garde-manger · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="230" height="200" rx="18" fill="#F0EDE6"/>
          <rect x="40" y="40" width="190" height="60" rx="12" fill="#1D4E89"/>
          <rect x="40" y="118" width="88" height="82" rx="12" fill="#F5B400"/>
          <rect x="142" y="118" width="88" height="82" rx="12" fill="#D9302A"/>
          <circle cx="400" cy="100" r="80" fill="#F5B400"/>
          <rect x="300" y="200" width="100" height="60" rx="14" fill="#1D4E89"/>
          <path d="M430 280 L490 200 L550 280 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Garde-manger et dates de péremption</p>
          <h1>Rien ne se perd au fond du frigo.</h1>
          <p>Ce que tu as, où c'est rangé, et ce qu'il faut manger d'abord : DLC et DDM distinguées, date d'ouverture, liste de courses et suivi du gaspillage.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton garde-manger</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton inventaire est enregistré en ligne et te suit sur tous tes appareils : le téléphone devant le frigo, l'ordinateur pour la liste de courses.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon garde-manger</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/garde-manger/">Voir le garde-manger</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon garde-manger'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, foyer: '', lieux: B.lieux.filter((l) => l.defaut).map((l) => l.code) });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ce qu'il y a chez toi, et ce qu'il faut manger d'abord.</h1>
        <p class="intro">Tu notes chaque produit avec son lieu, sa quantité et la date imprimée sur l'emballage. L'outil distingue la DLC (sécurité) de la DDM (qualité), tient compte de l'ouverture, et te montre chaque jour ce qui est à consommer en priorité.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        ${RAPPEL}
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes lieux de rangement</h1>
        <p class="intro">Coche ceux que tu utilises. Tu pourras les renommer et en ajouter dans l'onglet Rangement.</p>
        <div class="form-accueil">
          <label class="champ">Nom du foyer <small>facultatif</small><input id="a-foyer" value="${esc(a.foyer)}" maxlength="60" placeholder="Ex. : Maison, Appartement"></label>
          <fieldset><legend>Lieux</legend>
            <div class="choix-lieux">${B.lieux.map((l) => `<label class="case"><input type="checkbox" name="a-lieu" value="${l.code}" ${a.lieux.includes(l.code) ? 'checked' : ''}> ${esc(l.nom)} <small>${esc(B.typesLieu[l.type])}</small></label>`).join('')}</div>
          </fieldset>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon garde-manger</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#a-foyer')?.addEventListener('input', (e) => { accueil.foyer = e.target.value; });
    document.querySelectorAll('[name=a-lieu]').forEach((c) => c.addEventListener('change', () => { accueil.lieux = [...document.querySelectorAll('[name=a-lieu]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    const a = accueil;
    if (!a.lieux.length) return ecranAccueil('Coche au moins un lieu.');
    E = etatVide(a.lieux);
    E.reglages.foyer = String(a.foyer || '').trim().slice(0, 60);
    accueil = accueilVide();
    vue = 'stock';
    sauver();
    demarrer();
    toast('Ton garde-manger est prêt : ajoute tes premiers produits.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    priorites: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    stock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="9" width="16" height="2" fill="currentColor"/><rect x="7" y="5" width="2" height="2.5" fill="currentColor"/><rect x="7" y="13" width="2" height="4" fill="currentColor"/></svg>',
    courses: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h3l2.4 11h10.2L21 7H7.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="10" cy="19.5" r="2" fill="currentColor"/><circle cx="17" cy="19.5" r="2" fill="currentColor"/></svg>',
    gaspillage: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor"/><rect x="10" y="8" width="4" height="13" rx="1" fill="currentColor"/><rect x="17" y="3" width="4" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    rangement: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="17" r="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['priorites', 'À consommer'], ['stock', 'Stock'], ['courses', 'Courses'], ['gaspillage', 'Gaspillage'], ['rangement', 'Rangement']];
  const RAPPEL = '<div class="rappel-securite" role="note"><b>La date et l\'aspect du produit priment.</b> DLC (« à consommer jusqu\'au ») dépassée : ne pas consommer. DDM (« de préférence avant ») dépassée : le produit reste consommable si l\'emballage est intact et l\'aspect et l\'odeur normaux. Une fois ouvert, suis le délai indiqué sur l\'emballage. Emballage gonflé, bocal sans « pop », odeur ou couleur anormales : jette-le.</div>';
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la gestion de tes stocks : les alertes sont calculées à partir des dates que tu saisis. Elles ne remplacent ni la date et les consignes de l\'emballage, ni ton examen du produit. Personnes fragiles (femmes enceintes, jeunes enfants, personnes âgées ou immunodéprimées) : respecte strictement les dates. Sources : Anses (voir Rangement).</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" rx="10" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, txt, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${txt}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  // Étiquette de niveau : couleur et libellé.
  const ETIQ = { perime: 'rouge', depasse: 'jaune', aujourdhui: 'rose', trois: 'rose', semaine: 'ciel', ok: 'sable', sans: 'sable' };
  const etiquetteNiveau = (nv) => `<span class="etiquette ${ETIQ[nv]}">${esc(R.LIBELLES_NIVEAU[nv])}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/garde-manger/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Foyer fictif, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Garde-<br>manger</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const c = R.compteNiveaux(E, auj(), B);
    const nb = c.perime + c.aujourdhui;
    const og = $('.onglet[data-vue="priorites"]');
    if (og) og.querySelector('em')?.remove();
    if (og && nb) og.insertAdjacentHTML('beforeend', `<em class="pastille-nb" aria-label="${nb} produits à traiter aujourd'hui">${nb > 99 ? '99+' : nb}</em>`);
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Garde-manger`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { priorites: vuePriorites, stock: vueStock, courses: vueCourses, gaspillage: vueGaspillage, rangement: vueRangement }[vue]();
    brancherVue();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function brancherVue() {
    const r = $('#recherche');
    r?.addEventListener('input', (e) => {
      filtre.q = e.target.value;
      const pos = e.target.selectionStart;
      rendre();
      const r2 = $('#recherche'); r2.focus(); r2.setSelectionRange(pos, pos);
    });
    $('#form-course')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = new FormData(e.target).get('nom');
      const res = R.ajouterCourse(E, nom, { date: auj(), categorie: new FormData(e.target).get('categorie') });
      if (!String(nom || '').trim()) return;
      if (!res.ajoute) { toast('Déjà sur la liste.'); return; }
      E = res.etat; sauver(); rendre();
      $('#course-nom')?.focus();
    });
  }

  // ---------- Lignes de produit ----------
  const pastilleCat = (c) => { const col = couleur(c); return `<span class="pastille-type" style="--f:${col.fond};--t:${col.texte}" aria-hidden="true">${esc((c?.nom || '?').slice(0, 1))}</span>`; };
  function detailProduit(p, avecLieu) {
    const c = categorie(p.categorie);
    const morceaux = [qte(p), c?.nom || 'Sans catégorie'];
    if (avecLieu) morceaux.push(lieu(p.lieu)?.nom || 'Lieu supprimé');
    if (p.ouvertLe) morceaux.push(`ouvert le ${R.dateFr(p.ouvertLe)}${!p.joursOuverture && !(c?.apresOuverture) && R.typeLieu(E, p) !== 'congel' ? ' (délai à saisir)' : ''}`);
    if (p.congeleLe && R.typeLieu(E, p) === 'congel') morceaux.push(`congelé le ${R.dateFr(p.congeleLe)}`);
    return morceaux.map(esc).join(' · ');
  }
  function dateAffichee(p) {
    const e = echeance(p);
    if (!e) return `<span class="ligne-date"><b>—</b><small>${p.typeDate === 'aucune' ? 'sans date' : 'date à saisir'}</small></span>`;
    return `<span class="ligne-date"><b>${R.dateCourte(e.date)}</b><small>${esc(R.NATURES[e.nature].libelle)}${e.indicative ? ' · indicatif' : ''}</small></span>`;
  }
  function ligneProduit(p, { avecLieu = false, rapide = 'fini' } = {}) {
    const a = alerte(p);
    const c = categorie(p.categorie);
    const classe = { perime: 'alerte-depasse', depasse: 'alerte-proche', aujourdhui: 'alerte-due', trois: 'alerte-proche', semaine: '', ok: '', sans: '' }[a.niveau];
    const bouton = rapide === 'jete'
      ? `<button class="btn petit" type="button" data-action="jeter-vite" data-id="${p.id}">Jeté</button>`
      : `<button class="btn petit" type="button" data-action="fini" data-id="${p.id}" title="Consommé en entier">Fini</button>`;
    return `<li class="ligne-abs ${classe}">
      <button type="button" class="ligne-info" data-action="produit" data-id="${p.id}">
        <b>${pastilleCat(c)}${esc(p.nom)}</b>
        <span class="ligne-detail">${detailProduit(p, avecLieu)}</span>
        ${a.texte ? `<span class="ligne-alerte niv-${a.niveau}">${esc(a.texte)}</span>` : ''}
      </button>
      <div class="ligne-droite">${dateAffichee(p)}<div class="rang">${bouton}<button class="btn petit" type="button" data-action="sortie" data-id="${p.id}">Sortie…</button></div></div>
    </li>`;
  }

  // ---------- À consommer en priorité ----------
  function vuePriorites() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(E.reglages.foyer || 'Garde-manger')} · ${esc(R.dateFrLongue(auj()))}</p><h1>À consommer en priorité</h1></div><div class="actions"><button class="btn primaire" data-action="produit">${ICONES.plus}Ajouter un produit</button></div></div>`;
    if (!E.produits.length) return `${tete}${videEtat('Ton garde-manger est vide', 'Ajoute les produits de ton réfrigérateur, de ton congélateur et de tes placards avec leur date : ceux à consommer en premier s\'afficheront ici.', '<button class="btn primaire" data-action="produit">Ajouter un produit</button>')}${RAPPEL}${AVERTISSEMENT}`;
    const g = R.priorites(E, auj(), B);
    const c = R.compteNiveaux(E, auj(), B);
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Ne pas consommer</p><b>${c.perime}</b><span>DLC ou délai dépassé</span></div>
      <div class="tuile rond" style="--c:#E58C74"><p class="surtitre">Aujourd'hui</p><b>${c.aujourdhui}</b><span>à finir ce jour</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Sous 3 jours</p><b>${c.trois}</b><span>${pluriel(c.semaine, 'autre')} cette semaine</span></div>
      <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">DDM dépassée</p><b>${c.depasse}</b><span>à vérifier avant</span></div>
    </div>`;
    const blocs = [
      ['perime', 'Ne pas consommer', 'DLC, délai après ouverture ou après décongélation dépassé : à jeter.', 'jete'],
      ['aujourdhui', 'À consommer aujourd\'hui', '', 'fini'],
      ['trois', 'Sous 3 jours', '', 'fini'],
      ['semaine', 'Cette semaine', '', 'fini'],
      ['depasse', 'Date de qualité dépassée', 'DDM ou date fixée pour le congélateur : encore consommable si l\'emballage est intact et l\'aspect normal.', 'fini'],
    ].filter(([k]) => g[k].length).map(([k, titre, aide, rapide]) => `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">${titre}</span><span>${pluriel(g[k].length, 'produit')}</span></h2>${aide ? `<p class="aide">${aide}</p>` : ''}<ul class="lignes-abs">${g[k].map((p) => ligneProduit(p, { avecLieu: true, rapide })).join('')}</ul></section>`).join('');
    const rien = !blocs ? videEtat('Rien d\'urgent', 'Aucun produit n\'arrive à échéance dans les 7 jours. Les dates les plus proches sont dans l\'onglet Stock.', '<button class="btn" data-action="vue" data-vue="stock">Voir le stock</button>') : '';
    const sans = c.sans ? `<p class="resume-liste">${pluriel(c.sans, 'produit')} sans échéance (sans date, ou congelé sans date fixée) : <button class="btn lien" data-action="vue" data-vue="stock">voir le stock</button></p>` : '';
    return `${tete}${RAPPEL}${tuiles}${blocs}${rien}${sans}${AVERTISSEMENT}`;
  }

  // ---------- Stock par lieu ----------
  function vueStock() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(E.produits.length, 'produit')} en stock</p><h1>Stock</h1></div><div class="actions"><button class="btn primaire" data-action="produit">${ICONES.plus}Ajouter un produit</button></div></div>`;
    if (!E.produits.length) return `${tete}${videEtat('Aucun produit', 'Commence par le réfrigérateur : pour chaque produit, son nom, sa quantité et la date imprimée (DLC ou DDM).', '<button class="btn primaire" data-action="produit">Ajouter un produit</button>')}${AVERTISSEMENT}`;
    if (filtre.lieu && !lieu(filtre.lieu)) filtre.lieu = '';
    const nbLieu = (id) => E.produits.filter((p) => p.lieu === id).length;
    const filtres = `<div class="filtres" role="group" aria-label="Lieu"><button class="filtre" data-action="filtre-lieu" data-f="" aria-pressed="${!filtre.lieu}">Tous <small>${E.produits.length}</small></button>${E.lieux.map((l) => `<button class="filtre" data-action="filtre-lieu" data-f="${l.id}" aria-pressed="${filtre.lieu === l.id}">${esc(l.nom)} <small>${nbLieu(l.id)}</small></button>`).join('')}</div>`;
    const outils = `<div class="outils-liste">${filtres}<label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un produit" value="${esc(filtre.q)}" autocomplete="off"></label></div>`;
    const lieux = (filtre.lieu ? E.lieux.filter((l) => l.id === filtre.lieu) : E.lieux);
    const orphelins = E.produits.filter((p) => !lieu(p.lieu));
    const sections = lieux.map((l) => {
      const ps = R.trierStock(E, R.rechercher(E, E.produits.filter((p) => p.lieu === l.id), filtre.q), B);
      const cpt = R.compteNiveaux(E, auj(), B, (p) => p.lieu === l.id);
      const resume = [cpt.perime ? `<span class="negatif">${cpt.perime} à jeter</span>` : '', cpt.aujourdhui + cpt.trois ? `${cpt.aujourdhui + cpt.trois} sous 3 jours` : ''].filter(Boolean).join(' · ');
      return `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">${esc(l.nom)}</span><span>${pluriel(ps.length, 'produit')}${resume ? ` · ${resume}` : ''}</span></h2>
        ${ps.length ? `<ul class="lignes-abs">${ps.map((p) => ligneProduit(p)).join('')}</ul>` : `<p class="aide">${filtre.q ? 'Aucun produit trouvé ici.' : 'Rien pour l\'instant.'}</p>`}</section>`;
    }).join('') + (orphelins.length && !filtre.lieu ? `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Sans lieu</span></h2><ul class="lignes-abs">${orphelins.map((p) => ligneProduit(p)).join('')}</ul></section>` : '');
    return `${tete}${outils}${sections}${AVERTISSEMENT}`;
  }

  // ---------- Liste de courses ----------
  function vueCourses() {
    const restants = E.courses.filter((c) => !c.fait);
    const faits = E.courses.filter((c) => c.fait);
    const sugg = R.suggestionsCourses(E, auj());
    const tete = `<div class="vue-tete"><div><p class="surtitre">${pluriel(restants.length, 'article')} à acheter</p><h1>Liste de courses</h1></div><div class="actions"><button class="btn" data-action="copier-courses" ${restants.length ? '' : 'disabled'}>Copier la liste</button>${faits.length ? `<button class="btn" data-action="vider-courses">${faits.length > 1 ? `Retirer les ${faits.length} cochés` : 'Retirer le coché'}</button>` : ''}</div></div>`;
    const form = `<form id="form-course" class="form-course"><label class="champ"><span class="sr-only">Article</span><input id="course-nom" name="nom" maxlength="80" placeholder="Ajouter un article (ex. : pain)" autocomplete="off"></label><label class="champ"><span class="sr-only">Catégorie</span><select name="categorie"><option value="">Catégorie…</option>${E.categories.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join('')}</select></label><button class="btn primaire" type="submit">${ICONES.plus}Ajouter</button></form>`;
    const ligne = (c) => `<li class="course ${c.fait ? 'fait' : ''}"><label class="case"><input type="checkbox" data-action="cocher" data-id="${c.id}" ${c.fait ? 'checked' : ''}><span>${esc(c.nom)}${c.origine === 'epuise' ? ' <small class="etiquette sable">épuisé</small>' : ''}</span></label><span class="course-cat">${esc(categorie(c.categorie)?.nom || '')}</span><button class="btn-suppr" type="button" data-action="suppr-course" data-id="${c.id}" aria-label="Retirer ${esc(c.nom)}">×</button></li>`;
    const liste = E.courses.length ? `<ul class="courses">${restants.map(ligne).join('')}${faits.map(ligne).join('')}</ul>` : videEtat('Liste vide', 'Ajoute un article ci-dessus. Quand tu finis un produit (bouton « Fini » ou « Sortie… »), il est proposé ici.');
    const suggestions = sugg.length ? `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Épuisés récemment</span><span>finis ces 30 derniers jours, ni en stock ni sur la liste</span></h2><ul class="mini-liste">${sugg.map((s) => `<li><span>${esc(s.produit || s.nom)} <small class="aide-inline">fini ${esc(R.relatif(s.date, auj()))}</small></span><button class="btn petit" type="button" data-action="suggestion" data-nom="${esc(s.nom)}" data-cat="${esc(s.categorie)}">Ajouter</button></li>`).join('')}</ul></section>` : '';
    return `${tete}${form}${liste}${suggestions}`;
  }

  // ---------- Gaspillage ----------
  const PERIODES = [['30', '30 jours'], ['90', '3 mois'], ['365', '12 mois'], ['tout', 'Tout']];
  function vueGaspillage() {
    const deb = R.debutPeriode(filtre.periode, auj());
    const b = R.bilan(E, deb, auj());
    const tete = `<div class="vue-tete"><div><p class="surtitre">Produits consommés et jetés</p><h1>Gaspillage</h1></div><div class="actions"><div class="filtres" role="group" aria-label="Période">${PERIODES.map(([k, n]) => `<button class="filtre" data-action="periode" data-f="${k}" aria-pressed="${filtre.periode === k}">${n}</button>`).join('')}</div></div></div>`;
    if (!E.sorties.length) return `${tete}${videEtat('Aucune sortie pour l\'instant', 'Quand tu finis ou jettes un produit (boutons « Fini », « Jeté » ou « Sortie… »), il est compté ici : combien de produits jetés, pourquoi, et ce qu\'ils ont coûté si tu as noté leur valeur.')}`;
    const pct = Math.round(b.part * 100);
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Jetés</p><b>${b.jetes}</b><span>produits sur la période</span></div>
      <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Consommés</p><b>${b.consommes}</b><span>produits finis</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Part jetée</p><b>${pct} %</b><span>des produits sortis</span></div>
      <div class="tuile rond" style="--c:#E58C74"><p class="surtitre">Valeur jetée</p><b>${R.euros(b.valeurJetee)}</b><span>${b.jetesSansValeur ? `${pluriel(b.jetesSansValeur, 'produit')} sans valeur` : 'valeurs saisies'}</span></div>
    </div>`;
    const motifs = B.motifsJete.map(([k, n]) => ({ k, n, v: b.parMotif[k] || 0 })).filter((x) => x.v).sort((x, y) => y.v - x.v);
    const maxM = Math.max(1, ...motifs.map((x) => x.v));
    const barres = (l, max, val) => `<div class="barres-cats">${l.map((x) => `<div class="barre-cat"><span class="bc-nom">${esc(x.n)}</span><span class="bc-piste"><span class="bc-barre" style="width:${(x.v / max) * 100}%"></span></span><span class="bc-val">${val(x)}</span></div>`).join('')}</div>`;
    const cats = Object.entries(b.parCategorie).map(([id, x]) => ({ n: categorie(id)?.nom || 'Sans catégorie', v: x.nombre, valeur: x.valeur })).sort((x, y) => y.v - x.v).slice(0, 8);
    const maxC = Math.max(1, ...cats.map((x) => x.v));
    const serie = R.serieMensuelle(E, auj(), 6);
    const maxS = Math.max(1, ...serie.map((m) => m.jetes + m.consommes));
    const mois = (m) => R.MOIS_COURTS[Number(m.slice(5, 7)) - 1];
    const graphMois = `<div class="graphique"><div class="mois-barres" role="img" aria-label="Produits consommés et jetés par mois, six derniers mois">${serie.map((m) => `<div class="mois-col"><span class="mc-val">${m.jetes}</span><span class="mc-zone"><span class="mc-cons" style="height:${(m.consommes / maxS) * 100}%"></span><span class="mc-jete" style="height:${(m.jetes / maxS) * 100}%"></span></span><span class="mc-mois">${mois(m.mois)}</span></div>`).join('')}</div>
      <p class="legende"><span><i class="lg-jete"></i>Jetés (nombre au-dessus)</span><span><i class="lg-cons"></i>Consommés</span></p>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Mois</th><th class="nb">Consommés</th><th class="nb">Jetés</th><th class="nb">Valeur jetée</th></tr></thead><tbody>${serie.map((m) => `<tr><td>${R.MOIS[Number(m.mois.slice(5, 7)) - 1]} ${m.mois.slice(0, 4)}</td><td class="nb">${m.consommes}</td><td class="nb">${m.jetes}</td><td class="nb">${R.euros(m.valeur)}</td></tr>`).join('')}</tbody></table></div></details></div>`;
    const recents = [...E.sorties].filter((s) => s.date >= deb).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 12);
    const nomMotif = Object.fromEntries(B.motifsJete);
    const histo = `<ul class="mini-liste">${recents.map((s) => `<li><span><span class="etiquette ${s.type === 'jete' ? 'rouge' : 'vert'}">${s.type === 'jete' ? 'Jeté' : 'Fini'}</span>${esc(s.produit)} <small class="aide-inline">${esc(R.dateFr(s.date))}${s.motif ? ` · ${esc(nomMotif[s.motif] || s.motif)}` : ''}${s.valeur ? ` · ${R.euros(s.valeur)}` : ''}</small></span><button class="btn-suppr" type="button" data-action="suppr-sortie" data-id="${s.id}" aria-label="Retirer cette sortie de l'historique">×</button></li>`).join('')}</ul>`;
    return `${tete}${tuiles}
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Par mois</h2>${graphMois}</section>
        <section><h2 class="titre-section">Pourquoi c'est jeté</h2>${motifs.length ? `<div class="graphique">${barres(motifs, maxM, (x) => x.v)}</div>` : '<p class="aide">Rien de jeté sur la période.</p>'}
          ${cats.length ? `<h2 class="titre-section">Ce qui est jeté</h2><div class="graphique">${barres(cats, maxC, (x) => `${x.v}${x.valeur ? ` · ${R.euros(x.valeur)}` : ''}`)}</div>` : ''}</section>
      </div>
      <section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Dernières sorties</span><span>× pour corriger une erreur de saisie</span></h2>${recents.length ? histo : '<p class="aide">Aucune sortie sur la période.</p>'}</section>
      <p class="mention avertissement">Nombre de produits sortis (une ligne par sortie, quelle que soit la quantité). La valeur jetée ne compte que les produits dont tu as noté la valeur, au prorata de la quantité jetée.</p>`;
  }

  // ---------- Rangement : lieux, catégories, sources ----------
  function vueRangement() {
    const tete = `<div class="vue-tete"><div><p class="surtitre">Lieux, catégories et durées</p><h1>Rangement</h1></div></div>`;
    const lieux = `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Lieux</span><span>${pluriel(E.lieux.length, 'lieu')}</span><button class="btn petit" data-action="lieu">${ICONES.plus}Ajouter un lieu</button></h2>
      <ul class="mini-liste">${E.lieux.map((l) => `<li><span><b>${esc(l.nom)}</b> <small class="aide-inline">${esc(B.typesLieu[l.type])} · ${pluriel(R.impactLieu(E, l.id), 'produit')}</small></span><button class="btn petit" type="button" data-action="lieu" data-id="${l.id}">Modifier</button></li>`).join('')}</ul></section>`;
    const duree = (n, src) => (n ? `${n} j${src ? ` <small class="etiquette ciel">${esc(source(src)?.organisme || 'source')}</small>` : ' <small class="etiquette sable">ta valeur</small>'}` : '<span class="discret">—</span>');
    const cats = `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Catégories</span><span>type de date habituel et durées utilisées quand l'emballage ne dit rien</span><button class="btn petit" data-action="categorie">${ICONES.plus}Ajouter</button></h2>
      <ul class="cartes-cat">${E.categories.map((c) => `<li class="carte-cat"><button type="button" class="ligne-info" data-action="categorie" data-id="${c.id}"><b>${pastilleCat(c)}${esc(c.nom)}</b><span class="ligne-detail">Date habituelle : ${esc(R.TYPES_DATE[c.typeDate].court)}</span>
        <dl class="durees"><div><dt>Sans date</dt><dd>${duree(c.sansDate, c.sansDate && c.source ? c.source : '')}</dd></div><div><dt>Ouvert</dt><dd>${duree(c.apresOuverture)}</dd></div><div><dt>Congelé</dt><dd>${duree(c.congel)}</dd></div></dl></button></li>`).join('')}</ul>
      <p class="aide">Ces durées ne servent qu'en l'absence d'indication sur l'emballage et sont signalées « indicatif ». Seule la durée « Traiteur, plats non préemballés : 3 jours » vient d'une source officielle (Anses) ; les autres sont vides tant que tu ne les remplis pas, faute de référence officielle vérifiée (<b>à vérifier</b> selon tes produits). Le délai imprimé sur l'emballage l'emporte toujours.</p></section>`;
    const sources = `<section class="groupe-cat"><h2 class="titre-cat"><span class="tc-nom">Sources</span><span>consultées le ${esc(R.dateFr(B.sources[0].consultee))} ${B.sources[0].consultee.slice(0, 4)}</span></h2>
      ${B.sources.map((s) => `<div class="source"><p><b>${esc(s.organisme)}</b> · <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a> <small class="aide-inline">publié le ${esc(R.dateCourte(s.publiee))}, consulté le ${esc(R.dateCourte(s.consultee))}</small></p><ul>${s.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
      <p class="aide">Aucune durée de conservation au congélateur n'est proposée : l'outil n'a pas trouvé de tableau officiel à reprendre. Fixe-la toi-même produit par produit (« à consommer avant ») ou par catégorie.</p></section>`;
    return `${tete}${RAPPEL}${lieux}${cats}${sources}${AVERTISSEMENT}`;
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
      if (typeof err === 'string') { const p = d.querySelector('.modale-corps > .erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const nombre = (v) => { const n = Number(String(v ?? '').trim().replace(',', '.')); return String(v ?? '').trim() === '' ? 0 : Number.isFinite(n) && n >= 0 ? n : null; };

  // Produit : création ou modification, avec aperçu de l'échéance et de l'alerte.
  function modaleProduit(id) {
    const p0 = id ? trouver('produits', id) : null;
    const lieuDefaut = (filtre.lieu && lieu(filtre.lieu)) ? filtre.lieu : E.lieux[0]?.id;
    const catDefaut = E.categories.find((c) => c.lieuType === lieu(lieuDefaut)?.type) || E.categories[0];
    const p = p0 ? { ...p0 } : { nom: '', lieu: lieuDefaut, categorie: catDefaut?.id || '', quantite: 1, unite: '', typeDate: catDefaut?.typeDate || 'DLC', date: '', achat: auj(), ouvertLe: '', joursOuverture: null, congeleLe: '', decongeleLe: '', limiteCongel: '', valeur: 0, note: '' };
    const typeRadio = (v, n, s) => `<label><input type="radio" name="typeDate" value="${v}" ${p.typeDate === v ? 'checked' : ''}><span>${n}<small>${s}</small></span></label>`;
    const corps = `
      <label class="champ">Produit<input name="nom" value="${esc(p.nom)}" maxlength="80" placeholder="Ex. : yaourts nature" required></label>
      <div class="rang-champs">
        <label class="champ">Lieu<select name="lieu" id="m-lieu">${E.lieux.map((l) => `<option value="${l.id}" ${l.id === p.lieu ? 'selected' : ''}>${esc(l.nom)}</option>`).join('')}</select></label>
        <label class="champ">Catégorie<select name="categorie" id="m-cat">${E.categories.map((c) => `<option value="${c.id}" ${c.id === p.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Quantité<input name="quantite" inputmode="decimal" value="${esc(R.nombreFr(p.quantite))}"></label>
        <label class="champ">Unité <small>facultatif</small><input name="unite" value="${esc(p.unite)}" list="unites" maxlength="20" placeholder="pot, g, paquet…"><datalist id="unites">${B.unites.filter(Boolean).map((u) => `<option value="${esc(u)}">`).join('')}</datalist></label>
      </div>
      <fieldset class="champ"><legend>Date sur l'emballage</legend>
        <div class="choix-statut trois choix-date">${typeRadio('DLC', 'À consommer jusqu\'au', 'DLC · sécurité')}${typeRadio('DDM', 'De préférence avant', 'DDM · qualité')}${typeRadio('aucune', 'Pas de date', 'fruits, restes…')}</div>
      </fieldset>
      <div class="rang-champs">
        <label class="champ" id="bloc-date">Date imprimée<input name="date" type="date" value="${p.date}"></label>
        <label class="champ">Acheté ou préparé le<input name="achat" type="date" value="${p.achat}"></label>
      </div>
      <fieldset class="cadre-champs" id="bloc-ouverture"><legend>Ouverture <small>la DLC ne vaut plus une fois le produit ouvert : suis le délai de l'emballage</small></legend>
        <div class="rang-champs">
          <label class="champ">Ouvert le<input name="ouvertLe" type="date" value="${p.ouvertLe}"></label>
          <label class="champ">À consommer sous… <small>jours après ouverture</small><input name="joursOuverture" type="number" min="1" max="3650" inputmode="numeric" value="${p.joursOuverture || ''}" id="m-jours" placeholder="voir l'emballage"></label>
        </div>
      </fieldset>
      <fieldset class="cadre-champs" id="bloc-congel"><legend>Congélateur <small>congeler dès l'achat plutôt qu'en fin de DLC (Anses)</small></legend>
        <div class="rang-champs">
          <label class="champ">Congelé le<input name="congeleLe" type="date" value="${p.congeleLe}"></label>
          <label class="champ">À consommer avant <small>date que tu fixes</small><input name="limiteCongel" type="date" value="${p.limiteCongel}"></label>
        </div>
      </fieldset>
      <fieldset class="cadre-champs" id="bloc-decongele"><legend>Décongélation <small>à consommer sous 3 jours, sans recongeler (Anses)</small></legend>
        <label class="champ">Décongelé le<input name="decongeleLe" type="date" value="${p.decongeleLe}"></label>
      </fieldset>
      <div class="rang-champs">
        <label class="champ">Valeur <small>facultatif, en €, pour chiffrer le gaspillage</small><input name="valeur" inputmode="decimal" value="${p.valeur ? esc(R.nombreFr(p.valeur)) : ''}" placeholder="0,00"></label>
        <label class="champ">Note <small>facultatif</small><input name="note" value="${esc(p.note)}" maxlength="200"></label>
      </div>
      ${p0 ? `<div class="rang actions-rapides"><button class="btn petit" type="button" data-action="ouvrir-auj" data-id="${p0.id}">Ouvert aujourd'hui</button>${R.typeLieu(E, p0) !== 'congel' && E.lieux.some((l) => l.type === 'congel') ? `<button class="btn petit" type="button" data-action="congeler" data-id="${p0.id}">Mettre au congélateur</button>` : ''}${R.typeLieu(E, p0) === 'congel' && E.lieux.some((l) => l.type !== 'congel') ? `<button class="btn petit" type="button" data-action="decongeler" data-id="${p0.id}">Sortir pour décongeler</button>` : ''}</div>` : ''}
      <div class="apercu" id="apercu" aria-live="polite"></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p0 ? 'Modifier le produit' : 'Nouveau produit', corps, PIED(!!p0), (fd, v) => {
      if (v === 'supprimer') {
        if (!confirm(`Supprimer « ${p0.nom} » sans le compter comme consommé ou jeté ?`)) { modale().dataset.garder = '1'; return undefined; }
        retenir(); E.produits = E.produits.filter((x) => x.id !== p0.id); sauver(); rendre();
        toast('Produit supprimé.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      const n = lire(fd);
      const err = R.validerProduit(E, { ...n, nomSaisi: fd.get('nom') });
      if (err) return err;
      if (nombre(fd.get('quantite')) === null) return 'Quantité invalide.';
      if (nombre(fd.get('valeur')) === null) return 'Valeur invalide.';
      retenir();
      const i = E.produits.findIndex((x) => x.id === n.id);
      if (i >= 0) E.produits[i] = n; else E.produits.push(n);
      if (!p0) filtre.q = '';
      sauver(); rendre();
      toast(p0 ? 'Produit modifié.' : `« ${n.nom} » ajouté.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const f = modale().querySelector('form');
    function lire(fd) {
      return R.normaliserProduit({ ...(p0 || {}), id: p0?.id || uid(), nom: fd.get('nom'), lieu: fd.get('lieu'), categorie: fd.get('categorie'), quantite: nombre(fd.get('quantite')) ?? 1, unite: fd.get('unite'), typeDate: fd.get('typeDate'), date: fd.get('typeDate') === 'aucune' ? '' : fd.get('date'), achat: fd.get('achat'), ouvertLe: fd.get('ouvertLe'), joursOuverture: fd.get('joursOuverture'), congeleLe: fd.get('congeleLe'), limiteCongel: fd.get('limiteCongel'), decongeleLe: fd.get('decongeleLe'), valeur: nombre(fd.get('valeur')) ?? 0, note: fd.get('note') });
    }
    const maj = () => {
      const fd = new FormData(f);
      const t = lieu(fd.get('lieu'))?.type;
      $('#bloc-date').hidden = fd.get('typeDate') === 'aucune';
      $('#bloc-congel').hidden = t !== 'congel';
      $('#bloc-ouverture').hidden = t === 'congel';
      $('#bloc-decongele').hidden = t === 'congel' || !(fd.get('decongeleLe') || p0?.congeleLe || p0?.decongeleLe);
      const c = categorie(fd.get('categorie'));
      $('#m-jours').placeholder = c?.apresOuverture ? `${c.apresOuverture} (ta valeur)` : 'voir l\'emballage';
      const n = lire(fd);
      const el = $('#apercu');
      if (!String(fd.get('nom') || '').trim()) { el.innerHTML = ''; return; }
      const e = R.echeance(E, n, B);
      const a = R.messageAlerte(E, n, auj(), B);
      el.innerHTML = e
        ? `<p class="${a.niveau === 'perime' ? 'cd-alerte' : ''}">${etiquetteNiveau(a.niveau)} Échéance retenue : <b>${esc(R.dateFrLongue(e.date))}</b> (${esc(R.NATURES[e.nature].libelle)}${e.indicative ? ', durée indicative de la catégorie' : ''}). ${esc(a.texte)}</p>`
        : `<p>${etiquetteNiveau('sans')} Aucune échéance : ${t === 'congel' ? 'fixe une date « à consommer avant » si tu veux une alerte.' : 'ajoute la date imprimée, ou une durée pour cette catégorie (Rangement).'}</p>`;
    };
    // Changement de catégorie sur un nouveau produit : type de date habituel proposé.
    $('#m-cat').addEventListener('change', (e) => { if (p0) return; const c = categorie(e.target.value); const r = c && f.querySelector(`[name=typeDate][value="${c.typeDate}"]`); if (r) r.checked = true; const l = c && E.lieux.find((x) => x.type === c.lieuType); if (l && !filtre.lieu) $('#m-lieu').value = l.id; maj(); });
    f.addEventListener('input', maj);
    f.addEventListener('change', maj);
    maj();
  }

  // Sortie : consommé ou jeté, en tout ou en partie.
  function modaleSortie(id) {
    const p = trouver('produits', id);
    if (!p) return;
    const nv = niveau(p);
    const jeteParDefaut = nv === 'perime';
    const corps = `
      <p><b>${esc(p.nom)}</b> · ${esc(qte(p))} · ${esc(lieu(p.lieu)?.nom || '')}</p>
      ${alerte(p).texte ? `<p class="ligne-alerte niv-${nv}">${esc(alerte(p).texte)}</p>` : ''}
      <fieldset class="champ"><legend>Que devient-il ?</legend>
        <div class="choix-statut deux"><label><input type="radio" name="type" value="consomme" ${jeteParDefaut ? '' : 'checked'}><span>Consommé</span></label><label><input type="radio" name="type" value="jete" ${jeteParDefaut ? 'checked' : ''}><span>Jeté</span></label></div>
      </fieldset>
      <label class="champ">Quantité sortie <small>sur ${esc(qte(p))} ; laisse tel quel pour tout sortir</small><input name="quantite" inputmode="decimal" value="${esc(R.nombreFr(p.quantite))}"></label>
      <fieldset class="champ" id="bloc-motif"><legend>Pourquoi ?</legend>
        <div class="choix-statut trois">${B.motifsJete.map(([k, n]) => `<label><input type="radio" name="motif" value="${k}" ${(jeteParDefaut ? 'perime' : 'abime') === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      </fieldset>
      <label class="case" id="bloc-courses"><input type="checkbox" name="courses" checked> Ajouter « ${esc(p.nom)} » à la liste de courses s'il est épuisé</label>
      ${p.valeur ? `<p class="aide" id="valeur-sortie"></p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Sortie du stock', corps, '<button class="btn primaire" value="ok">Valider</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const q = nombre(fd.get('quantite'));
      if (q === null || q <= 0) return 'Indique une quantité supérieure à zéro.';
      const type = fd.get('type');
      appliquerSortie(p, { type, quantite: q, motif: type === 'jete' ? fd.get('motif') : '' }, fd.get('courses') === 'on' && type === 'consomme');
      return undefined;
    });
    const f = modale().querySelector('form');
    const maj = () => {
      const fd = new FormData(f);
      const jete = fd.get('type') === 'jete';
      $('#bloc-motif').hidden = !jete;
      $('#bloc-courses').hidden = jete;
      const v = $('#valeur-sortie');
      if (v) { const q = Math.min(nombre(fd.get('quantite')) || 0, p.quantite || 0); v.textContent = `Valeur ${jete ? 'jetée' : 'consommée'} : ${R.euros(p.quantite ? (p.valeur * q) / p.quantite : 0)}.`; }
    };
    f.addEventListener('input', maj); f.addEventListener('change', maj); maj();
  }

  function appliquerSortie(p, { type, quantite, motif }, versCourses) {
    retenir();
    const r = R.sortir(E, p.id, { type, quantite, motif, date: auj(), niveauAuMoment: niveau(p) });
    E = r.etat;
    let ajoutCourse = false;
    if (r.epuise && versCourses) { const c = R.ajouterCourse(E, p.nom, { categorie: p.categorie, date: auj(), origine: 'epuise' }); E = c.etat; ajoutCourse = c.ajoute; }
    sauver(); rendre();
    const quoi = type === 'jete' ? 'jeté' : 'consommé';
    const reste = trouver('produits', p.id);
    toast(r.epuise ? `« ${p.nom} » ${quoi}${ajoutCourse ? ', ajouté aux courses' : ''}.` : `« ${p.nom} » : ${R.nombreFr(r.sortie.quantite)}${p.unite ? ` ${p.unite}` : ''} ${quoi}, il reste ${qte(reste)}.`, { libelle: 'Annuler', faire: annuler });
  }

  function actionRapide(id, action) {
    const p = trouver('produits', id);
    if (!p) return;
    retenir();
    const i = E.produits.findIndex((x) => x.id === id);
    const n = { ...p };
    let msg = '';
    if (action === 'ouvrir-auj') {
      n.ouvertLe = auj();
      msg = n.joursOuverture || categorie(n.categorie)?.apresOuverture ? 'Ouverture notée.' : 'Ouverture notée : indique le délai de l\'emballage (« à consommer sous x jours »).';
    } else if (action === 'congeler') {
      const l = E.lieux.find((x) => x.type === 'congel');
      n.lieu = l.id; n.congeleLe = auj(); n.decongeleLe = '';
      msg = `Rangé dans « ${l.nom} ». Fixe une date « à consommer avant » si tu veux une alerte.`;
    } else if (action === 'decongeler') {
      const l = E.lieux.find((x) => x.type === 'frigo') || E.lieux.find((x) => x.type !== 'congel');
      n.lieu = l.id; n.decongeleLe = auj();
      msg = `Rangé dans « ${l.nom} » : à consommer sous 3 jours, sans recongeler.`;
    }
    E.produits[i] = R.normaliserProduit(n);
    sauver(); rendre();
    if (modale().open) modale().close();
    toast(msg, { libelle: 'Annuler', faire: annuler });
    if (action === 'ouvrir-auj' && !n.joursOuverture && !categorie(n.categorie)?.apresOuverture) modaleProduit(id);
  }

  function modaleLieu(id) {
    const l0 = id ? trouver('lieux', id) : null;
    const l = l0 || { nom: '', type: 'placard' };
    const n = l0 ? R.impactLieu(E, l0.id) : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" value="${esc(l.nom)}" maxlength="60" placeholder="Ex. : Frigo du garage" required></label>
      <fieldset class="champ"><legend>Type <small>le congélateur suit des règles à part (la DLC ne s'y applique plus)</small></legend>
        <div class="choix-statut quatre">${Object.entries(B.typesLieu).map(([k, v]) => `<label><input type="radio" name="type" value="${k}" ${l.type === k ? 'checked' : ''}><span>${esc(v.split(',')[0])}</span></label>`).join('')}</div></fieldset>
      ${l0 && n ? `<p class="aide">${pluriel(n, 'produit')} rangé${n > 1 ? 's' : ''} ici : pour supprimer ce lieu, déplace-les d'abord.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(l0 ? 'Modifier le lieu' : 'Nouveau lieu', corps, PIED(!!l0 && !n && E.lieux.length > 1), (fd, v) => {
      if (v === 'supprimer') { retenir(); E.lieux = E.lieux.filter((x) => x.id !== l0.id); sauver(); rendre(); toast('Lieu supprimé.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      if (!String(fd.get('nom') || '').trim()) return 'Donne un nom au lieu.';
      retenir();
      const nl = R.normaliserLieu({ id: l0?.id || uid(), nom: fd.get('nom'), type: fd.get('type') });
      if (l0) E.lieux[E.lieux.findIndex((x) => x.id === l0.id)] = nl; else E.lieux.push(nl);
      sauver(); rendre(); toast(l0 ? 'Lieu modifié.' : 'Lieu ajouté.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  function modaleCategorie(id) {
    const c0 = id ? trouver('categories', id) : null;
    const c = c0 || { nom: '', typeDate: 'DLC', lieuType: 'frigo', sansDate: null, apresOuverture: null, congel: null, couleur: E.categories.length % B.couleurs.length, source: '' };
    const n = c0 ? R.impactCategorie(E, c0.id) : 0;
    const src = c.source ? source(c.source) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" value="${esc(c.nom)}" maxlength="60" required></label>
      <div class="rang-champs">
        <label class="champ">Date habituelle<select name="typeDate">${Object.entries(R.TYPES_DATE).map(([k, v]) => `<option value="${k}" ${c.typeDate === k ? 'selected' : ''}>${esc(v.court)} · ${esc(v.libelle)}</option>`).join('')}</select></label>
        <label class="champ">Rangement habituel<select name="lieuType">${Object.entries(B.typesLieu).map(([k, v]) => `<option value="${k}" ${c.lieuType === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      </div>
      <fieldset class="cadre-champs"><legend>Durées par défaut, en jours <small>utilisées seulement quand l'emballage ne dit rien ; laisse vide en cas de doute</small></legend>
        <div class="rang-champs">
          <label class="champ">Sans date, après achat<input name="sansDate" type="number" min="1" max="3650" value="${c.sansDate || ''}"></label>
          <label class="champ">Après ouverture<input name="apresOuverture" type="number" min="1" max="3650" value="${c.apresOuverture || ''}"></label>
          <label class="champ">Au congélateur<input name="congel" type="number" min="1" max="3650" value="${c.congel || ''}"></label>
        </div>
        ${src ? `<p class="aide">Durée « sans date » reprise de : ${esc(src.organisme)}, « ${esc(src.titre)} » (publié le ${esc(R.dateCourte(src.publiee))}, consulté le ${esc(R.dateCourte(src.consultee))}). Si tu la changes, elle devient ta valeur.</p>` : '<p class="aide">Valeurs à toi : aucune n\'est officielle.</p>'}
      </fieldset>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((col, i) => `<label><input type="radio" name="couleur" value="${i}" ${c.couleur % B.couleurs.length === i ? 'checked' : ''}><span style="background:${col.fond};border-color:${col.bord}" aria-label="Couleur ${i + 1}"></span></label>`).join('')}</div></fieldset>
      ${c0 && n ? `<p class="aide">${pluriel(n, 'produit')} dans cette catégorie : pour la supprimer, change d'abord leur catégorie.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c0 ? 'Modifier la catégorie' : 'Nouvelle catégorie', corps, PIED(!!c0 && !n), (fd, v) => {
      if (v === 'supprimer') { retenir(); E.categories = E.categories.filter((x) => x.id !== c0.id); sauver(); rendre(); toast('Catégorie supprimée.', { libelle: 'Annuler', faire: annuler }); return undefined; }
      if (!String(fd.get('nom') || '').trim()) return 'Donne un nom à la catégorie.';
      const sansDate = fd.get('sansDate');
      const garderSource = c.source && Number(sansDate) === c.sansDate;
      retenir();
      const nc = R.normaliserCategorie({ id: c0?.id || uid(), nom: fd.get('nom'), typeDate: fd.get('typeDate'), lieuType: fd.get('lieuType'), sansDate, apresOuverture: fd.get('apresOuverture'), congel: fd.get('congel'), couleur: Number(fd.get('couleur')), source: garderSource ? c.source : '' });
      if (c0) E.categories[E.categories.findIndex((x) => x.id === c0.id)] = nc; else E.categories.push(nc);
      sauver(); rendre(); toast(c0 ? 'Catégorie modifiée.' : 'Catégorie ajoutée.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const corps = `
      <label class="champ">Nom du foyer<small>facultatif</small><input name="foyer" value="${esc(E.reglages.foyer)}" maxlength="60"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-stock">Stock actuel</button><button class="btn petit" type="button" data-action="csv-sorties">Historique des sorties</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton garde-manger est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${Math.round(t / 1000)} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte puis retire l\'historique ancien.' : '.'}</p>
        <div class="rang-champs"><label class="champ">Retirer l'historique avant le<input id="purge" type="date"></label><button class="btn petit" type="button" data-action="purger" style="align-self:flex-end">Retirer</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du garde-manger, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le garde-manger à ton écran d'accueil pour l'ouvrir comme une application, devant le frigo ou au supermarché.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Alertes calculées sur cet appareil à partir des dates que tu saisis. DLC et DDM selon l'Anses (« Date limite de consommation (DLC) et date de durabilité minimale (DDM) », publié le 04/01/2021, consulté le 14/11/2026). Seules deux durées chiffrées sont reprises de cette source : 3 jours pour les plats non préemballés sans date, 3 jours après décongélation. Aucun scan de code-barres, aucune base produit, aucune connexion à une autre application.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      E.reglages = R.normaliserReglages({ ...E.reglages, foyer: fd.get('foyer') });
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.produits) || !Array.isArray(donnees.lieux)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.produits.length, 'produit')}) ?`)) return;
        const vu = E.tutorielVu; E = normaliser(donnees); delete E.majLe; if (vu) E.tutorielVu = true;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du garde-manger.'); }
    });
  }
  function purger() {
    const d = $('#purge')?.value;
    if (!R.estDate(d)) { toast('Choisis une date.'); return; }
    const n = E.sorties.filter((s) => s.date < d).length;
    if (!n) { toast('Aucune sortie avant cette date.'); return; }
    if (!confirm(`Retirer ${pluriel(n, 'sortie')} antérieure${n > 1 ? 's' : ''} au ${R.dateFrLongue(d)} ? Pense à exporter l'historique en CSV avant.`)) return;
    retenir();
    E = R.purgerAvant(E, d).etat;
    modale().close(); sauver(); rendre();
    toast(`${pluriel(n, 'sortie retirée', 'sorties retirées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `garde-manger-${auj()}.json`);
  const CSV = 'text/csv;charset=utf-8';

  async function copierCourses() {
    const t = R.texteCourses(E);
    if (!t) return;
    try { await navigator.clipboard.writeText(t); toast('Liste copiée : colle-la dans tes notes ou un message.'); } catch { toast('Copie impossible dans ce navigateur : sélectionne la liste à la main.'); }
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const dec = Number(B.dureeDecongele) || 3;
    const blocs = [
      ['rose', 'Un produit, une date', `Pour chaque produit, note son lieu (réfrigérateur, congélateur, placard…), sa quantité et la date imprimée. La <b>DLC</b>, «&nbsp;à consommer jusqu'au&nbsp;», est une date de sécurité. La <b>DDM</b>, «&nbsp;de préférence avant&nbsp;», est une date de qualité.`],
      ['beurre', 'La date la plus proche compte', `Un produit ouvert prend aussi le délai indiqué sur l'emballage&nbsp;; un produit sans date, la durée de sa catégorie si tu l'as remplie dans <b>Rangement</b>. Décongelé, il est à finir sous ${dec}&nbsp;jours, sans recongeler. Au congélateur, la DLC ne compte plus&nbsp;: fixe une date «&nbsp;à consommer avant&nbsp;» pour être prévenu.`],
      ['ciel', 'À consommer en priorité', `L'onglet <b>À consommer</b> range tes produits du plus urgent au plus lointain&nbsp;: à ne pas consommer, aujourd'hui, sous 3&nbsp;jours, cette semaine, puis les dates de qualité dépassées. DLC ou délai dépassé&nbsp;: à jeter. DDM dépassée&nbsp;: encore consommable si l'emballage est intact, l'aspect et l'odeur normaux.`],
      ['sable', 'Fini ou jeté', `Touche <b>Fini</b> ou <b>Jeté</b>, ou <b>Sortie…</b> pour une partie seulement ou pour noter un motif. Un produit épuisé par <b>Sortie…</b> peut aller tout droit sur la liste de <b>Courses</b>. <b>Gaspillage</b> compte ce qui est jeté, pourquoi, et sa valeur si tu l'as notée.`],
    ];
    const corps = `
      <p>Le garde-manger te dit quoi manger en premier, pour ne plus rien jeter par oubli. Ton rôle&nbsp;: noter chaque produit rangé avec sa date, puis dire quand il est fini ou jeté.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Stock</b> montre tout ce que tu as, lieu par lieu, les dates les plus proches en premier. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.produits.length && E.lieux.length;
    const pied = premier
      ? '<button class="btn primaire" value="produit">Ajouter mon premier produit</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'produit') setTimeout(() => modaleProduit(null), 0); });
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
      <p>Enregistre ton garde-manger sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
  function toast(texteToast, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texteToast)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-stock': telecharger(R.csvStock(E, auj(), B), CSV, `stock-${auj()}.csv`); break;
      case 'csv-sorties': telecharger(R.csvSorties(E, B.motifsJete), CSV, `sorties-${auj()}.csv`); break;
      case 'purger': purger(); break;
      case 'fermer': modale().close(); break;
      case 'produit': if (modale().open) modale().close(); if (!E.lieux.length) { toast('Ajoute d\'abord un lieu (onglet Rangement).'); break; } modaleProduit(id || null); break;
      case 'sortie': modaleSortie(id); break;
      case 'fini': { const p = trouver('produits', id); if (p) appliquerSortie(p, { type: 'consomme', quantite: p.quantite, motif: '' }, false); break; }
      case 'jeter-vite': { const p = trouver('produits', id); if (p) appliquerSortie(p, { type: 'jete', quantite: p.quantite, motif: niveau(p) === 'perime' ? 'perime' : 'autre' }, false); break; }
      case 'ouvrir-auj': case 'congeler': case 'decongeler': actionRapide(id, action); break;
      case 'filtre-lieu': filtre.lieu = el.dataset.f; sauverPref(); rendre(); break;
      case 'periode': filtre.periode = el.dataset.f; sauverPref(); rendre(); break;
      case 'cocher': { const c = trouver('courses', id); if (c) { c.fait = el.checked; sauver(); rendre(); } break; }
      case 'suppr-course': retenir(); E.courses = E.courses.filter((c) => c.id !== id); sauver(); rendre(); toast('Article retiré.', { libelle: 'Annuler', faire: annuler }); break;
      case 'vider-courses': retenir(); E.courses = E.courses.filter((c) => !c.fait); sauver(); rendre(); toast('Articles cochés retirés.', { libelle: 'Annuler', faire: annuler }); break;
      case 'copier-courses': copierCourses(); break;
      case 'suggestion': { const r = R.ajouterCourse(E, el.dataset.nom, { categorie: el.dataset.cat, date: auj(), origine: 'epuise' }); if (r.ajoute) { E = r.etat; sauver(); rendre(); } break; }
      case 'suppr-sortie': if (confirm('Retirer cette sortie de l\'historique ? Le produit ne revient pas en stock.')) { retenir(); E.sorties = E.sorties.filter((s) => s.id !== id); sauver(); rendre(); toast('Sortie retirée.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'lieu': if (modale().open) modale().close(); modaleLieu(id || null); break;
      case 'categorie': if (modale().open) modale().close(); modaleCategorie(id || null); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // le jour a pu changer : alertes recalculées
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
  window.__grd = { etat: () => E, regles: R };
  init();
})();
