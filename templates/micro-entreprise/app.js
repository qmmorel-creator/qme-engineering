// Livre recettes-dépenses micro-entreprise QME : livre des recettes, achats, dépenses, déclarations,
// seuils et export ; données synchronisées par clé de licence ou code d'accès.
// Outil d'aide : pas un logiciel comptable certifié ni un conseil fiscal ou social.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.MCE_REGLES;
  const API = '/api/templates';
  const PRODUIT = 'MCE';
  const CLE_CODE = 'qme-mce-code';
  const CLE_CACHE = 'qme-mce-cache';
  const CLE_DEMO = 'qme-mce-demo';
  const CODE_DEMO = 'DEMO';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };

  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const fmtCourt = (s) => versDate(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const nf0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur = (n) => nf.format(n || 0);
  const eur0 = (n) => nf0.format(Math.round(n || 0));
  const pct = (n) => `${String(n).replace('.', ',')} %`;
  const nombre = (s) => { const n = Number(String(s ?? '').replace(/[\s  €]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const cat = (id) => B.categories.find((c) => c.id === id) || B.categories[1];
  const couleurCat = (id) => couleur(cat(id).couleur);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'recettes';
  let annee = new Date().getFullYear();
  let sousVue = 'depenses';
  const filtre = { categorie: '', mois: '' };
  let annulation = null;

  const profilVide = () => ({
    nom: '', debut: null, activites: [], caisseBnc: 'ssi', statutFormation: 'commercant', versementLiberatoire: false, periodicite: 'trimestrielle',
    acre: { fin: '', taux: { vente: null, bic: null, bnc: null } },
  });
  const etatVide = () => ({ version: 1, profil: profilVide(), taux: structuredClone(B.taux), tauxMillesime: B.millesime, recettes: [], achats: [], depenses: [], declarees: {} });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const p = { ...v.profil, ...(d.profil || {}) };
    p.acre = { ...v.profil.acre, ...(d.profil?.acre || {}), taux: { ...v.profil.acre.taux, ...(d.profil?.acre?.taux || {}) } };
    p.activites = Array.isArray(p.activites) ? p.activites.filter((a) => R.CATEGORIES.includes(a)) : [];
    const t = d.taux || {};
    const taux = {
      cotisations: { ...v.taux.cotisations, ...(t.cotisations || {}) },
      versementLiberatoire: { ...v.taux.versementLiberatoire, ...(t.versementLiberatoire || {}) },
      formation: { ...v.taux.formation, ...(t.formation || {}) },
      plafonds: { ...v.taux.plafonds, ...(t.plafonds || {}) },
      tva: { vente: { ...v.taux.tva.vente, ...(t.tva?.vente || {}) }, services: { ...v.taux.tva.services, ...(t.tva?.services || {}) } },
    };
    const liste = (x) => (Array.isArray(x) ? x.filter((e) => e && typeof e.date === 'string') : []);
    return { ...v, ...d, profil: p, taux, recettes: liste(d.recettes), achats: liste(d.achats), depenses: liste(d.depenses), declarees: d.declarees && typeof d.declarees === 'object' ? d.declarees : {} };
  };
  const LISTES = { recettes: 'recettes', achats: 'achats', depenses: 'depenses' };
  const activites = () => (E.profil.activites.length ? E.profil.activites : ['bic']);
  const aVente = () => E.profil.activites.includes('vente');
  const tauxModifies = () => JSON.stringify(E.taux) !== JSON.stringify(B.taux);

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
        toast('Un autre appareil a modifié ton livre entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes saisies sont gardées sur cet appareil et seront envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
  // Code MCE-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('MCE')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('MCE') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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

  // ---------- Données de démonstration (relatives à aujourd'hui) ----------
  // Atelier de céramique fictif : vente de pièces + cours (services BIC), début l'an dernier.
  // États couverts : seuil de TVA des services proche, un mois sans recette, trimestre à déclarer,
  // trimestres déclarés, année précédente, achats et dépenses.
  function donneesDemo() {
    const d = etatVide();
    const t = auj();
    const a = Number(t.slice(0, 4));
    const mCourant = Number(t.slice(5, 7)) - 1;
    let graine = 7;
    const hasard = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
    const choisir = (l) => l[Math.floor(hasard() * l.length)];
    Object.assign(d.profil, { nom: 'Atelier de céramique (exemple)', debut: `${a - 1}-04-15`, activites: ['vente', 'bic'], statutFormation: 'artisan', versementLiberatoire: true, periodicite: 'trimestrielle' });
    const clients = ['Camille R.', 'Julien M.', 'Sophie D.', 'Nadia B.', 'Thomas L.', 'Inès P.', 'Hugo F.', 'Léa G.', 'Comité d\'entreprise (exemple)', 'Café du port (exemple)'];
    const ventes = [['Bols et tasses', 'Carte bancaire'], ['Service de table sur commande', 'Virement'], ['Vente au marché de créateurs', 'Espèces'], ['Vase grès émaillé', 'Carte bancaire'], ['Commande de mugs personnalisés', 'Virement']];
    const cours = [['Atelier tournage (4 séances)', 'Virement'], ['Stage modelage du week-end', 'Carte bancaire'], ['Cours particulier', 'Chèque'], ['Atelier team building', 'Virement']];
    // Mois vide : trois mois avant le mois courant.
    const vide = mCourant >= 3 ? { a, m: mCourant - 3 } : { a: a - 1, m: mCourant + 9 };
    const numeros = {};
    const ajouterRecette = (date, categorie, nature, mode, montant, client) => {
      const y = date.slice(0, 4);
      numeros[y] = (numeros[y] || 0) + 1;
      d.recettes.push({ id: uid(), date, client, nature, categorie, montant: R.arrondi(montant), mode, piece: `F-${y}-${String(numeros[y]).padStart(3, '0')}` });
    };
    const moisListe = [];
    for (let m = 3; m < 12; m++) moisListe.push({ a: a - 1, m });
    for (let m = 0; m <= mCourant; m++) moisListe.push({ a, m });
    const actifs = moisListe.filter((x) => !(x.a === vide.a && x.m === vide.m));
    const enCours = actifs.filter((x) => x.a === a).length || 1;
    const cibleServices = 0.885 * B.taux.tva.services.base; // proche du seuil de franchise des services
    const cibleVentes = 21500;
    // Saisonnalité : un poids par mois de l'année en cours, normalisé (somme = nombre de mois actifs).
    const poids = new Map(actifs.map((x) => [`${x.a}-${x.m}`, 0.7 + hasard() * 0.6]));
    const sommePoids = actifs.filter((x) => x.a === a).reduce((s, x) => s + poids.get(`${x.a}-${x.m}`), 0) || 1;
    for (const { a: y, m } of actifs) {
      const premier = y === a - 1 && m === 3 ? 15 : 1;
      const dernier = y === a && m === mCourant ? Number(t.slice(8, 10)) : new Date(y, m + 1, 0).getDate();
      const jour = () => `${y}-${deux(m + 1)}-${deux(premier + Math.floor(hasard() * (dernier - premier + 1)))}`;
      const facteur = (y === a ? 1 : 0.6) * poids.get(`${y}-${m}`) * enCours / sommePoids;
      const lignesS = [];
      const lignesV = [];
      for (let i = 0; i < 3; i++) lignesS.push([jour(), ...choisir(cours), 0.6 + hasard()]);
      for (let i = 0; i < 3; i++) lignesV.push([jour(), ...choisir(ventes), 0.6 + hasard()]);
      const sS = lignesS.reduce((s, l) => s + l[3], 0), sV = lignesV.reduce((s, l) => s + l[3], 0);
      for (const [date, nature, mode, p] of lignesS) ajouterRecette(date, 'bic', nature, mode, (cibleServices / enCours) * facteur * (p / sS), choisir(clients));
      for (const [date, nature, mode, p] of lignesV) ajouterRecette(date, 'vente', nature, mode, (cibleVentes / enCours) * facteur * (p / sV), choisir(clients));
    }
    // Une recette encaissée aujourd'hui.
    ajouterRecette(t, 'vente', 'Coupelles (lot de 6)', 'Carte bancaire', 72, 'Inès P.');
    d.recettes.sort((x, y) => x.date.localeCompare(y.date));
    // Renumérote les pièces dans l'ordre chronologique.
    const n2 = {};
    for (const r of d.recettes) { const y = r.date.slice(0, 4); n2[y] = (n2[y] || 0) + 1; r.piece = `F-${y}-${String(n2[y]).padStart(3, '0')}`; }
    // Achats de marchandises et dépenses.
    for (const { a: y, m } of moisListe) {
      const j = (n) => `${y}-${deux(m + 1)}-${deux(Math.min(n, new Date(y, m + 1, 0).getDate()))}`;
      if (y === a && m === mCourant && Number(t.slice(8, 10)) < 5) continue;
      d.depenses.push({ id: uid(), date: j(5), fournisseur: 'Bailleur de l\'atelier (exemple)', nature: 'Loyer de l\'atelier', categorie: 'Loyer et charges', montant: 420, mode: 'Prélèvement', piece: `Quittance ${deux(m + 1)}/${y}` });
      d.depenses.push({ id: uid(), date: j(10), fournisseur: 'Opérateur (exemple)', nature: 'Forfait téléphone et internet', categorie: 'Téléphone et internet', montant: 34.99, mode: 'Prélèvement', piece: '' });
      if (m % 2 === 0) d.achats.push({ id: uid(), date: j(8), fournisseur: 'Fournisseur de terre (exemple)', nature: 'Argile et émaux', montant: R.arrondi(180 + hasard() * 260), mode: 'Virement', piece: `A-${y}-${deux(m + 1)}` });
      if (m % 3 === 1) d.achats.push({ id: uid(), date: j(18), fournisseur: 'Emballages (exemple)', nature: 'Boîtes et papier de soie', montant: R.arrondi(60 + hasard() * 60), mode: 'Carte bancaire', piece: `A-${y}-${deux(m + 1)}b` });
      if (m % 4 === 2) d.depenses.push({ id: uid(), date: j(21), fournisseur: 'Marché de créateurs (exemple)', nature: 'Emplacement au marché', categorie: 'Publicité et communication', montant: 90, mode: 'Carte bancaire', piece: '' });
      if (m === 0 || (y === a - 1 && m === 3)) d.depenses.push({ id: uid(), date: j(12), fournisseur: 'Assureur (exemple)', nature: 'Responsabilité civile professionnelle', categorie: 'Assurances', montant: 236, mode: 'Prélèvement', piece: '' });
      if (m === 6) d.depenses.push({ id: uid(), date: j(3), fournisseur: 'Revendeur (exemple)', nature: 'Tour de potier d\'occasion', categorie: 'Matériel et outillage', montant: 650, mode: 'Virement', piece: 'Facture 2207' });
    }
    // Rien dans le futur.
    d.achats = d.achats.filter((x) => x.date <= t);
    d.depenses = d.depenses.filter((x) => x.date <= t);
    // Déclarations faites : toute l'année précédente, et les trimestres échus de l'année sauf le dernier.
    for (const p of R.periodes(a - 1, 'trimestrielle')) d.declarees[p.id] = true;
    const echus = R.periodes(a, 'trimestrielle').filter((p) => p.fin < t);
    echus.slice(0, -1).forEach((p) => { d.declarees[p.id] = true; });
    return d;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Livre recettes-dépenses · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="260" height="260" fill="#F5B400"/>
          <rect x="40" y="70" width="200" height="14" fill="#141414"/>
          <rect x="40" y="120" width="160" height="14" fill="#141414"/>
          <rect x="40" y="170" width="180" height="14" fill="#141414"/>
          <rect x="40" y="220" width="120" height="14" fill="#141414"/>
          <circle cx="420" cy="150" r="130" fill="#1D4E89"/>
          <path d="M420 20 A130 130 0 0 1 550 150 H420 Z" fill="#D9302A"/>
          <circle cx="420" cy="150" r="40" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Livre recettes-dépenses · micro-entreprise</p>
          <h1>Ton livre des recettes, tenu sans y penser.</h1>
          <p>Recettes, achats et dépenses au même endroit, cotisations estimées à chaque déclaration et alerte avant les seuils.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton livre</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes écritures sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon livre</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de livre ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a>.</p>
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
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = code.startsWith('MCE') ? 'Code incomplet : il compte MCE suivi de 4 blocs de 4 caractères.' : 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon livre'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = null;
  const accueilVide = () => ({ etape: 1, ...profilVide(), debut: auj() });

  function choixCartes(nom, options, choisis, multiple) {
    return `<div class="choix-cartes" role="group">${options.map(([id, titre, detail, c]) => `<button type="button" class="filiere" style="--c:${c || 'var(--encre)'}" data-action="accueil-choix" data-champ="${nom}" data-id="${id}" data-multiple="${multiple ? 1 : 0}" aria-pressed="${multiple ? choisis.includes(id) : choisis === id}"><b>${esc(titre)}</b>${detail ? `<span>${esc(detail)}</span>` : ''}</button>`).join('')}</div>`;
  }

  function ecranAccueil() {
    accueil ||= accueilVide();
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton livre.</h1>
        <p class="intro">Deux écrans pour décrire ton activité : les cotisations et les seuils seront calculés selon tes réponses. Tout reste modifiable dans les réglages.</p>
        <div class="rang-champs">
          <label class="champ">Nom de ton activité <small>Facultatif, figure en tête des impressions.</small><input id="acc-nom" value="${esc(a.nom)}" maxlength="80" placeholder="Ex. : Studio de graphisme"></label>
          <label class="champ">Début d'activité <small>Sert à proratiser les plafonds la première année.</small><input id="acc-debut" type="date" value="${esc(a.debut || '')}"></label>
        </div>
        <h2 class="titre-section">Ton activité <span>Plusieurs choix possibles si ton activité est mixte.</span></h2>
        ${choixCartes('activites', B.categories.map((c) => [c.id, c.nom, { vente: 'Marchandises, objets, denrées, fournitures de logement', bic: 'Artisans, commerçants : réparation, cours, prestations', bnc: 'Professions libérales : conseil, création, formation' }[c.id], couleur(c.couleur)]), a.activites, true)}
        <p class="aide" style="margin-top:16px">Exemples indicatifs : en cas de doute sur ta catégorie, vérifie-la sur ton espace autoentrepreneur.urssaf.fr.</p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.activites.length ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${esc(a.activites.map((x) => cat(x).court).join(' + '))}</p>
        <h1>Tes options de déclaration.</h1>
        <p class="intro">Elles servent à estimer ce que tu paieras à chaque déclaration. Recopie-les depuis ton espace URSSAF si tu ne les connais pas par cœur.</p>
        <h2 class="titre-section">Contribution à la formation professionnelle</h2>
        ${choixCartes('statutFormation', B.statutsFormation.map((s) => [s.id, s.nom, `${pct(B.taux.formation[s.id])} du chiffre d'affaires`]), a.statutFormation, false)}
        ${a.activites.includes('bnc') ? `<h2 class="titre-section">Caisse de retraite (BNC)</h2>${choixCartes('caisseBnc', [['ssi', 'Sécurité sociale des indépendants', `Cotisations ${pct(B.taux.cotisations.bnc)}`], ['cipav', 'Cipav', `Cotisations ${pct(B.taux.cotisations.cipav)}`]], a.caisseBnc, false)}` : ''}
        <h2 class="titre-section">Versement libératoire de l'impôt sur le revenu</h2>
        ${choixCartes('versementLiberatoire', [['non', 'Non', 'Impôt calculé avec ta déclaration de revenus'], ['oui', 'Oui, j\'ai opté', a.activites.map((x) => `${cat(x).court} ${pct(B.taux.versementLiberatoire[x])}`).join(' · ')]], a.versementLiberatoire ? 'oui' : 'non', false)}
        <h2 class="titre-section">Déclaration du chiffre d'affaires</h2>
        ${choixCartes('periodicite', [['mensuelle', 'Mensuelle', 'Chaque mois'], ['trimestrielle', 'Trimestrielle', 'Chaque trimestre']], a.periodicite, false)}
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon livre</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#acc-nom')?.addEventListener('input', (e) => { accueil.nom = e.target.value; });
    $('#acc-debut')?.addEventListener('input', (e) => { accueil.debut = e.target.value || null; });
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    Object.assign(E.profil, { nom: a.nom.trim(), debut: a.debut || null, activites: R.CATEGORIES.filter((c) => a.activites.includes(c)), caisseBnc: a.caisseBnc, statutFormation: a.statutFormation, versementLiberatoire: a.versementLiberatoire, periodicite: a.periodicite });
    accueil = null;
    sauver();
    demarrer();
    setTimeout(() => modaleEcriture('recettes'), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    recettes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    depenses: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    declarations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    seuils: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    export: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['recettes', 'Recettes'], ['depenses', 'Dépenses'], ['declarations', 'Déclarations'], ['seuils', 'Seuils'], ['export', 'Export']];
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    sousVue = aVente() ? sousVue : 'depenses';
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Livre<br>recettes-dépenses</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>
      <footer class="pied-app"><p><b>Outil d'aide</b> à la tenue de ton livre des recettes : ce n'est pas un logiciel comptable certifié ni un conseil fiscal ou social. Les montants à payer sont des estimations ; seule ta déclaration sur autoentrepreneur.urssaf.fr fait foi.</p></footer>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { recettes: 'Recettes', depenses: 'Achats et dépenses', declarations: 'Déclarations', seuils: 'Seuils', export: 'Export' };
    document.title = `${titres[vue]} · Livre recettes-dépenses`;
    $('#vue').innerHTML = { recettes: vueRecettes, depenses: vueDepenses, declarations: vueDeclarations, seuils: vueSeuils, export: vueExport }[vue]();
    if (vue === 'seuils') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Années disponibles : celles des écritures, l'année en cours et celle du début d'activité.
  function annees() {
    const s = new Set([new Date().getFullYear(), annee]);
    for (const l of [E.recettes, E.achats, E.depenses]) for (const x of l) s.add(Number(x.date.slice(0, 4)));
    return [...s].filter(Boolean).sort((a, b) => b - a);
  }
  const choixAnnee = () => `<div class="annees" role="group" aria-label="Année">${annees().map((a) => `<button class="puce" data-action="annee" data-annee="${a}" aria-pressed="${a === annee}">${a}</button>`).join('')}</div>`;

  const tuile = (lib, v, d, c, forme = '') => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`;
  const etiquetteCat = (id) => `<span class="etiquette cat" style="--c:${couleurCat(id)};--t:${cat(id).couleur === 'jaune' ? 'var(--encre)' : '#fff'}">${esc(cat(id).court)}</span>`;

  function ligneEcriture(x, type) {
    const tiers = type === 'recettes' ? x.client : x.fournisseur;
    const etiquette = type === 'recettes' ? etiquetteCat(x.categorie) : type === 'depenses' ? `<span class="etiquette clair">${esc(x.categorie)}</span>` : '<span class="etiquette clair">Achat</span>';
    return `<li><button class="ecriture" data-action="ecriture-modifier" data-type="${type}" data-id="${x.id}">
      <span class="e-date">${fmtCourt(x.date)}</span>
      <span class="e-tiers"><b>${esc(tiers || 'Sans nom')}</b><span>${esc(x.nature || '')}</span></span>
      <span class="e-cat">${etiquette}</span>
      <span class="e-mode">${esc(x.mode || '')}</span>
      <span class="e-piece">${x.piece ? esc(x.piece) : '<i>sans pièce</i>'}</span>
      <span class="e-montant">${eur(x.montant)}</span>
    </button></li>`;
  }
  const enteteLivre = (type) => `<div class="livre-tete" aria-hidden="true"><span>Date</span><span>${type === 'recettes' ? 'Client · nature' : 'Fournisseur · nature'}</span><span>${type === 'recettes' ? 'Catégorie' : type === 'depenses' ? 'Catégorie' : ''}</span><span>Règlement</span><span>Pièce</span><span class="nb">Montant</span></div>`;

  // Recettes
  function vueRecettes() {
    const t = auj();
    const toutes = R.dansAnnee(E.recettes, annee);
    const liste = toutes.filter((r) => (!filtre.categorie || r.categorie === filtre.categorie) && (filtre.mois === '' || Number(r.date.slice(5, 7)) - 1 === Number(filtre.mois)))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.piece).localeCompare(String(a.piece)));
    const ca = R.sommeParActivite(toutes);
    const ceMois = R.total(toutes.filter((r) => r.date.slice(0, 7) === t.slice(0, 7)));
    const est = R.estimerPeriode(E.recettes, `${annee}-01-01`, `${annee}-12-31`, E.profil, E.taux);
    const s = R.seuils(E.recettes, annee, E.profil, E.taux);
    const alerte = [...s.tva, ...s.plafonds].some((l) => l.etat !== 'ok');
    const cats = [...new Set([...activites(), ...toutes.map((r) => r.categorie)])];
    const tuiles = [
      tuile(`Chiffre d'affaires ${annee}`, eur0(ca.total), cats.length > 1 ? cats.map((c) => `${cat(c).court} ${eur0(ca[c])}`).join(' · ') : 'Encaissé depuis le 1er janvier', 'var(--encre)', 'rond'),
      tuile(annee === Number(t.slice(0, 4)) ? 'Ce mois-ci' : 'Encaissements', annee === Number(t.slice(0, 4)) ? eur0(ceMois) : String(toutes.length), annee === Number(t.slice(0, 4)) ? `${MOIS[Number(t.slice(5, 7)) - 1]} ${annee}` : `écritures en ${annee}`, 'var(--jaune)'),
      tuile('À payer (estimation)', eur0(est.totalAPayer), `Cotisations${E.profil.versementLiberatoire ? ', impôt' : ''} et formation sur ${annee}`, 'var(--bleu)'),
      tuile('Seuils', alerte ? 'À surveiller' : 'Sous les seuils', alerte ? 'Un seuil est proche ou dépassé' : 'Plafonds et franchise de TVA', alerte ? 'var(--rouge)' : 'var(--encre)', 'rond'),
    ].join('');
    const vide = !toutes.length
      ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune recette en ${annee}</h3><p>Note chaque encaissement le jour où tu le reçois : date, client, nature, montant, mode de règlement et référence de la facture ou du ticket.</p><div class="actions"><button class="btn primaire" data-action="ecriture-nouvelle" data-type="recettes">${ICONES.plus}Ajouter une recette</button></div></div></div>`
      : `<p class="vide-filtre">Aucune recette pour ce filtre.</p>`;
    return `
      <div class="vue-tete"><div><h1>Livre des recettes</h1><p>${E.profil.nom ? `${esc(E.profil.nom)} · ` : ''}Encaissements dans l'ordre chronologique, avec la pièce justificative de chacun.</p></div>
        <div class="actions"><button class="btn primaire" data-action="ecriture-nouvelle" data-type="recettes">${ICONES.plus}Recette</button></div></div>
      ${choixAnnee()}
      <div class="tuiles">${tuiles}</div>
      ${alerte ? `<button class="alerte-lien" data-action="vue" data-vue="seuils"><b>Seuil à surveiller.</b> ${esc(messageSeuilPrincipal(s))} <u>Voir les seuils</u></button>` : ''}
      <div class="filtres">
        <label class="champ petit">Catégorie<select data-action="filtre" data-champ="categorie"><option value="">Toutes</option>${cats.map((c) => `<option value="${c}" ${filtre.categorie === c ? 'selected' : ''}>${esc(cat(c).nom)}</option>`).join('')}</select></label>
        <label class="champ petit">Mois<select data-action="filtre" data-champ="mois"><option value="">Toute l'année</option>${MOIS.map((m, i) => `<option value="${i}" ${String(filtre.mois) === String(i) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <p class="total-filtre">${pluriel(liste.length, 'recette')} · <b>${eur(R.total(liste))}</b></p>
      </div>
      ${liste.length ? `<div class="livre">${enteteLivre('recettes')}<ul>${liste.map((r) => ligneEcriture(r, 'recettes')).join('')}</ul></div>` : vide}`;
  }

  function messageSeuilPrincipal(s) {
    const l = [...s.plafonds, ...s.tva].sort((a, b) => b.ratio - a.ratio)[0];
    if (!l) return '';
    const type = s.plafonds.includes(l) ? 'du plafond du régime' : 'du seuil de franchise de TVA';
    return `${l.libelle} : ${Math.round(l.ratio * 100)} % ${type}.`;
  }

  // Achats et dépenses
  function vueDepenses() {
    const type = aVente() ? sousVue : 'depenses';
    const listeTout = R.dansAnnee(E[type], annee);
    const liste = [...listeTout].sort((a, b) => b.date.localeCompare(a.date));
    const totA = R.total(R.dansAnnee(E.achats, annee));
    const totD = R.total(R.dansAnnee(E.depenses, annee));
    const ca = R.total(R.dansAnnee(E.recettes, annee));
    const parCat = R.totauxParCategorie(E.depenses, annee);
    const maxCat = Math.max(1, ...parCat.map((x) => x.total));
    const bascule = aVente() ? `<div class="bascule" role="group" aria-label="Registre affiché"><button data-action="sous-vue" data-id="achats" aria-pressed="${type === 'achats'}">Registre des achats</button><button data-action="sous-vue" data-id="depenses" aria-pressed="${type === 'depenses'}">Dépenses</button></div>` : '';
    const vide = `<div class="vide-etat">${FORME_VIDE}<div><h3>${type === 'achats' ? 'Aucun achat' : 'Aucune dépense'} en ${annee}</h3><p>${type === 'achats' ? 'Le registre des achats liste les marchandises, matières et fournitures achetées pour la revente : date, fournisseur, nature, montant, mode de règlement et pièce.' : 'Note tes frais (loyer, logiciels, matériel, déplacements…) pour connaître ce qui te reste vraiment.'}</p><div class="actions"><button class="btn primaire" data-action="ecriture-nouvelle" data-type="${type}">${ICONES.plus}${type === 'achats' ? 'Ajouter un achat' : 'Ajouter une dépense'}</button></div></div></div>`;
    return `
      <div class="vue-tete"><div><h1>${aVente() ? 'Achats et dépenses' : 'Dépenses'}</h1><p>${aVente() ? 'Le registre des achats est tenu pour les activités de vente. ' : ''}Les dépenses sont suivies pour ta gestion.</p></div>
        <div class="actions"><button class="btn primaire" data-action="ecriture-nouvelle" data-type="${type}">${ICONES.plus}${type === 'achats' ? 'Achat' : 'Dépense'}</button></div></div>
      <p class="avertissement"><b>À savoir :</b> en micro-entreprise, les dépenses ne sont pas déductibles. Cotisations et impôt sont calculés sur le chiffre d'affaires encaissé, après un abattement forfaitaire pour l'impôt. Ce suivi sert à piloter ta marge, pas à réduire ce que tu déclares.</p>
      ${choixAnnee()}
      <div class="tuiles trois">
        ${aVente() ? tuile(`Achats ${annee}`, eur0(totA), 'Marchandises et matières', 'var(--bleu)') : ''}
        ${tuile(`Dépenses ${annee}`, eur0(totD), 'Frais de l\'activité', 'var(--jaune)')}
        ${tuile('Reste indicatif', eur0(ca - totA - totD), `Recettes ${eur0(ca)} moins achats et dépenses, avant cotisations`, 'var(--encre)', 'rond')}
      </div>
      ${bascule}
      ${liste.length ? `<div class="livre">${enteteLivre(type)}<ul>${liste.map((x) => ligneEcriture(x, type)).join('')}</ul></div><p class="total-filtre bas">${pluriel(liste.length, type === 'achats' ? 'achat' : 'dépense')} · <b>${eur(R.total(liste))}</b></p>` : vide}
      ${type === 'depenses' && parCat.length ? `<h2 class="titre-section">Dépenses par catégorie <span>${annee}</span></h2>
        <ul class="barres">${parCat.map((x) => `<li><span class="b-nom">${esc(x.categorie)}</span><span class="b-barre"><i style="width:${(x.total / maxCat) * 100}%"></i></span><span class="b-val">${eur0(x.total)}</span></li>`).join('')}</ul>` : ''}`;
  }

  // Déclarations
  function etatPeriode(p, t) {
    if (E.declarees[p.id]) return ['Déclarée', 'bleu'];
    if (p.fin < t) return ['À déclarer', 'rouge'];
    if (p.debut <= t) return ['En cours', 'jaune'];
    return ['À venir', 'clair'];
  }

  function vueDeclarations() {
    const t = auj();
    const per = R.periodes(annee, E.profil.periodicite);
    const acts = [...new Set([...activites(), ...R.dansAnnee(E.recettes, annee).map((r) => r.categorie)])].filter((c) => R.CATEGORIES.includes(c));
    const ests = per.map((p) => ({ p, e: R.estimerPeriode(E.recettes, p.debut, p.fin, E.profil, E.taux) }));
    const an = R.estimerPeriode(E.recettes, `${annee}-01-01`, `${annee}-12-31`, E.profil, E.taux);
    const aDeclarer = ests.filter(({ p }) => p.fin < t && !E.declarees[p.id]);
    const cartes = ests.map(({ p, e }) => {
      const [lib, c] = etatPeriode(p, t);
      const futur = p.debut > t;
      const lignes = acts.map((a) => `<tr><td>${etiquetteCat(a)}</td><td class="nb">${eur(e.ca[a])}</td><td class="nb">${pct(R.tauxCotisation(a, p.fin, E.profil, E.taux))}</td><td class="nb">${eur(e.cotisations[a])}</td></tr>`).join('');
      return `<article class="periode ${futur ? 'futur' : ''} ${lib === 'À déclarer' ? 'urgent' : ''}">
        <div class="periode-tete"><h2>${esc(p.libelle)}</h2><span class="etiquette ${c}">${lib}</span></div>
        ${futur ? '<p class="periode-vide">Période à venir.</p>' : `
        <div class="periode-ca"><span>Chiffre d'affaires à déclarer</span><b>${eur(e.ca.total)}</b>${e.nombre ? '' : '<small>Aucune recette sur la période : déclare quand même un chiffre d\'affaires nul.</small>'}</div>
        <div class="defile"><table class="mini"><thead><tr><th>Activité</th><th class="nb">CA</th><th class="nb">Taux</th><th class="nb">Cotisations</th></tr></thead><tbody>${lignes}</tbody></table></div>
        <dl class="periode-totaux">
          <div><dt>Formation professionnelle (${pct(e.tauxFormation)})</dt><dd>${eur(e.formation)}</dd></div>
          ${E.profil.versementLiberatoire ? `<div><dt>Versement libératoire</dt><dd>${eur(e.totalVL)}</dd></div>` : ''}
          <div class="total"><dt>Total estimé</dt><dd>${eur(e.totalAPayer)}</dd></div>
        </dl>
        <div class="periode-pied">${E.declarees[p.id] ? `<button class="btn petit" data-action="declarer" data-id="${p.id}">Annuler « déclarée »</button>` : p.debut <= t ? `<button class="btn petit ${p.fin < t ? 'primaire' : ''}" data-action="declarer" data-id="${p.id}">Marquer déclarée</button>` : ''}</div>`}
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Déclarations</h1><p>Le chiffre d'affaires à reporter sur ta déclaration ${E.profil.periodicite === 'mensuelle' ? 'mensuelle' : 'trimestrielle'} et une estimation de ce que tu paieras.</p></div>
        <div class="bascule" role="group" aria-label="Périodicité"><button data-action="periodicite" data-id="mensuelle" aria-pressed="${E.profil.periodicite === 'mensuelle'}">Mensuelle</button><button data-action="periodicite" data-id="trimestrielle" aria-pressed="${E.profil.periodicite === 'trimestrielle'}">Trimestrielle</button></div></div>
      ${choixAnnee()}
      <div class="tuiles">
        ${tuile(`CA déclaré ${annee}`, eur0(an.ca.total), 'Toutes les périodes de l\'année', 'var(--encre)', 'rond')}
        ${tuile('Cotisations', eur0(an.totalCotisations), 'Estimation sur l\'année', 'var(--bleu)')}
        ${tuile(E.profil.versementLiberatoire ? 'Impôt et formation' : 'Formation', eur0(an.totalVL + an.formation), E.profil.versementLiberatoire ? 'Versement libératoire et formation professionnelle' : 'Contribution à la formation professionnelle', 'var(--jaune)')}
        ${tuile('À déclarer', String(aDeclarer.length), aDeclarer.length ? `Période${aDeclarer.length > 1 ? 's' : ''} échue${aDeclarer.length > 1 ? 's' : ''} non marquée${aDeclarer.length > 1 ? 's' : ''}` : 'Tout est à jour', aDeclarer.length ? 'var(--rouge)' : 'var(--encre)', 'rond')}
      </div>
      <p class="aide">Aucune date limite n'est indiquée ici : vérifie le calendrier de tes déclarations sur autoentrepreneur.urssaf.fr. ${E.profil.acre?.fin ? `ACRE : taux réduits saisis appliqués jusqu'au ${fmt(E.profil.acre.fin)}.` : ''}</p>
      <div class="periodes">${cartes}</div>
      ${noteTaux()}`;
  }

  function noteTaux() {
    return `<aside class="note-taux"><div><p class="surtitre">Taux et seuils ${B.millesime}${tauxModifies() ? ' · modifiés par toi' : ''}</p>
      <p>Cotisations : vente ${pct(E.taux.cotisations.vente)}, services BIC ${pct(E.taux.cotisations.bic)}, BNC ${pct(E.taux.cotisations.bnc)} (Cipav ${pct(E.taux.cotisations.cipav)}). Versement libératoire : ${pct(E.taux.versementLiberatoire.vente)}, ${pct(E.taux.versementLiberatoire.bic)}, ${pct(E.taux.versementLiberatoire.bnc)}. Formation professionnelle : ${pct(E.taux.formation.commercant)} (commerçant), ${pct(E.taux.formation.liberal)} (libéral), ${pct(E.taux.formation.artisan)} (artisan).</p>
      <p>Sources : ${B.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.nom}</a>`).join(', ')}, consultées le ${fmt(B.consulteLe, { day: 'numeric', month: 'long', year: 'numeric' })}. ${annee !== B.millesime ? `Pour ${annee}, vérifie et ajuste les valeurs.` : 'Vérifie-les une fois par an.'}</p></div>
      <button class="btn petit" data-action="taux">Voir ou modifier</button></aside>`;
  }

  // Seuils
  const LIB_ETAT = { ok: ['Sous le seuil', 'bleu'], proche: ['Proche', 'jaune'], base: ['Seuil de base dépassé', 'rouge'], majore: ['Seuil majoré dépassé', 'rouge'], depasse: ['Plafond dépassé', 'rouge'] };

  function jauge(l, avecMajore) {
    const max = Math.max(avecMajore ? l.majore : l.base, l.valeur) * 1.04;
    const x = (v) => `${Math.min(100, (v / max) * 100)}%`;
    const [lib, c] = LIB_ETAT[l.etat];
    return `<div class="jauge-bloc">
      <div class="jauge-tete"><b>${esc(l.libelle)}</b><span class="etiquette ${c}">${lib}</span></div>
      <div class="jauge-val"><b>${eur0(l.valeur)}</b><span>${Math.round(l.ratio * 100)} % ${avecMajore ? 'du seuil de base' : 'du plafond'}</span></div>
      <div class="jauge" role="img" aria-label="${esc(`${l.libelle} : ${eur0(l.valeur)} sur ${eur0(l.base)}${avecMajore ? `, seuil majoré ${eur0(l.majore)}` : ''}`)}">
        <i class="rempli ${l.etat}" style="width:${x(l.valeur)}"></i>
        <span class="repere" style="left:${x(l.base)}"></span>
        ${avecMajore ? `<span class="repere majore" style="left:${x(l.majore)}"></span>` : ''}
      </div>
      <div class="jauge-legende"><span>${avecMajore ? 'Base' : 'Plafond'} ${eur0(l.base)}</span>${avecMajore ? `<span>Majoré ${eur0(l.majore)}</span>` : ''}<span>Reste ${eur0(Math.max(0, l.base - l.valeur))}</span></div>
    </div>`;
  }

  function alertesSeuils(s) {
    const a = [];
    for (const l of s.tva) {
      if (l.etat === 'proche') a.push(['jaune', `Franchise de TVA · ${l.libelle} : ${Math.round(l.ratio * 100)} % du seuil de base (${eur0(l.base)}). Il reste ${eur0(l.base - l.valeur)} avant le seuil.`]);
      if (l.etat === 'base') a.push(['rouge', `Franchise de TVA · ${l.libelle} : seuil de base (${eur0(l.base)}) dépassé, seuil majoré (${eur0(l.majore)}) non atteint. Vérifie ce que cela change pour toi sur economie.gouv.fr ou auprès de ton service des impôts des entreprises.`]);
      if (l.etat === 'majore') a.push(['rouge', `Franchise de TVA · ${l.libelle} : seuil majoré (${eur0(l.majore)}) dépassé. Vérifie sans attendre ta situation au regard de la TVA auprès de ton service des impôts des entreprises.`]);
    }
    for (const l of s.plafonds) {
      if (l.etat === 'proche') a.push(['jaune', `Plafond du régime · ${l.libelle} : ${Math.round(l.ratio * 100)} % du plafond (${eur0(l.base)}).`]);
      if (l.etat === 'depasse') a.push(['rouge', `Plafond du régime · ${l.libelle} : plafond de ${eur0(l.base)} dépassé sur ${annee}. Vérifie les conséquences sur autoentrepreneur.urssaf.fr.`]);
    }
    return a;
  }

  const SERIES = () => B.categories.map((c) => [c.id, c.court, couleur(c.couleur)]);

  function graphique(mois) {
    const L = Math.round(Math.min(760, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 240, g = L < 500 ? 44 : 56, b = 24, hz = H - b - 10;
    const max = Math.max(1000, ...mois.map((m) => m.total));
    const pasBrut = max / 4;
    const p10 = 10 ** Math.floor(Math.log10(pasBrut));
    const pas = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((v) => v >= pasBrut);
    const haut = pas * 4;
    const larg = (L - g) / 12;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const kEur = (v) => (v >= 1000 ? `${String(Math.round(v / 100) / 10).replace('.', ',')} k€` : `${v} €`);
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${kEur(i * pas)}</text>`).join('');
    const colonnes = mois.map((m, i) => {
      const w = Math.max(6, larg * 0.62);
      const x = g + i * larg + (larg - w) / 2;
      let cumul = 0;
      const rects = SERIES().map(([k, , c]) => {
        const v = m[k];
        if (!v) return '';
        const y1 = y(cumul + v), h = y(cumul) - y(cumul + v) - (cumul ? 2 : 0);
        cumul += v;
        return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(1, h)}" fill="${c}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const etiquette = L >= 500 || i % 2 === 0 ? `<text class="axe" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${MOIS_COURT[i]}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne" data-i="${i}">${rects}</g>${etiquette}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Chiffre d'affaires encaissé par mois en ${annee}, détail dans le tableau">${grilles}${colonnes}</svg>`;
  }

  function vueSeuils() {
    const s = R.seuils(E.recettes, annee, E.profil, E.taux);
    const alertes = alertesSeuils(s);
    const mois = R.totauxParMois(E.recettes, annee);
    const series = SERIES().filter(([k]) => activites().includes(k) || mois.some((m) => m[k]));
    const p = s.prorata;
    return `
      <div class="vue-tete"><div><h1>Seuils</h1><p>Où en est ton chiffre d'affaires ${annee} par rapport aux plafonds du régime et à la franchise de TVA. Alerte à partir de 80 % d'un seuil.</p></div></div>
      ${choixAnnee()}
      ${alertes.length ? `<ul class="alertes">${alertes.map(([c, m]) => `<li class="${c}"><b>${c === 'rouge' ? '!' : '•'}</b><span>${esc(m)}</span></li>`).join('')}</ul>` : '<p class="ok-seuils"><b>Tout va bien.</b> Ton chiffre d\'affaires est sous 80 % de chaque seuil.</p>'}
      <div class="seuils">
        <section class="carte-seuil"><h2>Franchise de TVA</h2><p class="sous">Seuil de base et seuil majoré sur l'année civile.</p>${s.tva.map((l) => jauge(l, true)).join('')}</section>
        <section class="carte-seuil"><h2>Plafonds du régime</h2><p class="sous">${p.premiere ? `Première année : plafonds proratisés sur ${p.jours} jours d'activité sur ${p.joursAnnee} (début le ${fmt(E.profil.debut, { day: 'numeric', month: 'long' })}).` : 'Chiffre d\'affaires annuel maximal du régime micro.'}</p>${s.plafonds.map((l) => jauge(l, false)).join('')}</section>
      </div>
      <h2 class="titre-section">Chiffre d'affaires par mois <span>${annee}</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Encaissements</h2><div class="legende">${series.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(mois)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Chiffre d'affaires par mois</caption><thead><tr><th>Mois</th>${series.map(([, l]) => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${MOIS[m.mois]}</td>${series.map(([k]) => `<td>${eur(m[k])}</td>`).join('')}<td>${eur(m.total)}</td></tr>`).join('')}</tbody></table>
      </figure>
      ${noteTaux()}`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const mois = R.totauxParMois(E.recettes, annee);
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), m = mois[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = `<b>${MOIS[i]} ${annee}</b>${m.total ? `${SERIES().filter(([k]) => m[k]).map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${eur(m[k])}</div>`).join('')}<div>Total : ${eur(m.total)}</div>` : 'Aucune recette'}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.zone').forEach((z) => {
      z.addEventListener('pointerenter', () => montrer(z));
      z.addEventListener('click', () => montrer(z));
    });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((g) => g.classList.remove('active')); });
  }

  // Export
  function vueExport() {
    const mois = R.totauxParMois(E.recettes, annee);
    const tot = R.sommeParActivite(R.dansAnnee(E.recettes, annee));
    const acts = SERIES().filter(([k]) => activites().includes(k) || tot[k]);
    const nb = (l) => R.dansAnnee(E[l], annee).length;
    const carte = (titre, texte, boutons, c) => `<article class="export-carte" style="--c:${c}"><div><h2>${titre}</h2><p>${texte}</p></div><div class="rang">${boutons}</div></article>`;
    return `
      <div class="vue-tete"><div><h1>Export</h1><p>Fichiers CSV pour ton tableur ou ton comptable (séparateur point-virgule, accents conservés) et impression propre du livre des recettes.</p></div></div>
      ${choixAnnee()}
      <div class="exports">
        ${carte(`Livre des recettes ${annee}`, `${pluriel(nb('recettes'), 'recette')} : date d'encaissement, client, nature, catégorie, mode de règlement, pièce justificative, montant.`, `<button class="btn petit primaire" data-action="csv" data-id="recettes">CSV</button><button class="btn petit" data-action="imprimer" data-id="recettes">Imprimer</button>`, 'var(--rouge)')}
        ${aVente() || nb('achats') ? carte(`Registre des achats ${annee}`, `${pluriel(nb('achats'), 'achat')} : date, fournisseur, nature, mode de règlement, pièce, montant.`, `<button class="btn petit primaire" data-action="csv" data-id="achats">CSV</button><button class="btn petit" data-action="imprimer" data-id="achats">Imprimer</button>`, 'var(--bleu)') : ''}
        ${carte(`Dépenses ${annee}`, `${pluriel(nb('depenses'), 'dépense')} avec leur catégorie.`, `<button class="btn petit primaire" data-action="csv" data-id="depenses">CSV</button>`, 'var(--jaune)')}
        ${carte(`Année ${annee} complète`, 'Recettes, achats et dépenses dans un seul fichier, une ligne par écriture avec son type.', `<button class="btn petit primaire" data-action="csv" data-id="annuel">CSV annuel</button><button class="btn petit" data-action="imprimer" data-id="recap">Imprimer le récapitulatif</button>`, 'var(--encre)')}
      </div>
      <h2 class="titre-section">Récapitulatif ${annee} <span>Chiffre d'affaires encaissé par mois et par activité</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Mois</th>${acts.map(([, l]) => `<th class="nb">${l}</th>`).join('')}<th class="nb">Total</th></tr></thead>
        <tbody>${mois.map((m) => `<tr class="${m.total ? '' : 'nul'}"><td>${MOIS[m.mois]}</td>${acts.map(([k]) => `<td class="nb">${eur(m[k])}</td>`).join('')}<td class="nb"><b>${eur(m.total)}</b></td></tr>`).join('')}</tbody>
        <tfoot><tr><th>Total ${annee}</th>${acts.map(([k]) => `<th class="nb">${eur(tot[k])}</th>`).join('')}<th class="nb">${eur(tot.total)}</th></tr></tfoot></table></div>
      <p class="aide" style="margin-top:16px">Garde aussi tes factures et justificatifs : le livre renvoie à chacun par sa référence. Une copie complète de tes données (JSON) se télécharge depuis les réglages.</p>`;
  }

  function telecharger(nom, contenu, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exporterCsv(id) {
    const f = { recettes: () => R.csvRecettes(E.recettes, annee), achats: () => R.csvAchats(E.achats, annee), depenses: () => R.csvDepenses(E.depenses, annee), annuel: () => R.csvAnnuel(E, annee) }[id];
    const noms = { recettes: 'livre-recettes', achats: 'registre-achats', depenses: 'depenses', annuel: 'recettes-depenses' };
    telecharger(`${noms[id]}-${annee}.csv`, f(), 'text/csv;charset=utf-8');
    toast('Fichier CSV téléchargé.');
  }

  function imprimer(id) {
    const zone = $('#impression');
    const chrono = (l) => R.dansAnnee(l, annee).sort((a, b) => a.date.localeCompare(b.date));
    const entete = (titre) => `<header><h1>${titre}</h1><p>${E.profil.nom ? `${esc(E.profil.nom)} · ` : ''}Année ${annee} · édité le ${fmt(auj(), { day: 'numeric', month: 'long', year: 'numeric' })}</p></header>`;
    const pied = '<footer>Document établi avec le livre recettes-dépenses QME, outil d\'aide non certifié. Montants en euros, encaissements de l\'année civile.</footer>';
    let html;
    if (id === 'recettes') {
      const l = chrono(E.recettes);
      html = `${entete('Livre des recettes')}<table><thead><tr><th>Date d'encaissement</th><th>Client</th><th>Nature</th><th>Catégorie</th><th>Règlement</th><th>Pièce</th><th class="nb">Montant</th></tr></thead><tbody>${l.map((r) => `<tr><td>${fmtCourt(r.date)}</td><td>${esc(r.client)}</td><td>${esc(r.nature)}</td><td>${esc(cat(r.categorie).court)}</td><td>${esc(r.mode)}</td><td class="nw">${esc(r.piece)}</td><td class="nb">${eur(r.montant)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="6">Total ${annee}</th><th class="nb">${eur(R.total(l))}</th></tr></tfoot></table>`;
    } else if (id === 'achats') {
      const l = chrono(E.achats);
      html = `${entete('Registre des achats')}<table><thead><tr><th>Date</th><th>Fournisseur</th><th>Nature</th><th>Règlement</th><th>Pièce</th><th class="nb">Montant</th></tr></thead><tbody>${l.map((r) => `<tr><td>${fmtCourt(r.date)}</td><td>${esc(r.fournisseur)}</td><td>${esc(r.nature)}</td><td>${esc(r.mode)}</td><td class="nw">${esc(r.piece)}</td><td class="nb">${eur(r.montant)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="5">Total ${annee}</th><th class="nb">${eur(R.total(l))}</th></tr></tfoot></table>`;
    } else {
      const mois = R.totauxParMois(E.recettes, annee);
      const tot = R.sommeParActivite(R.dansAnnee(E.recettes, annee));
      const acts = SERIES().filter(([k]) => activites().includes(k) || tot[k]);
      html = `${entete('Récapitulatif du chiffre d\'affaires')}<table><thead><tr><th>Mois</th>${acts.map(([, l]) => `<th class="nb">${l}</th>`).join('')}<th class="nb">Total</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${MOIS[m.mois]}</td>${acts.map(([k]) => `<td class="nb">${eur(m[k])}</td>`).join('')}<td class="nb">${eur(m.total)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th>${acts.map(([k]) => `<th class="nb">${eur(tot[k])}</th>`).join('')}<th class="nb">${eur(tot.total)}</th></tr></tfoot></table><p>Achats ${annee} : ${eur(R.total(R.dansAnnee(E.achats, annee)))} · Dépenses ${annee} : ${eur(R.total(R.dansAnnee(E.depenses, annee)))} (non déductibles en micro-entreprise).</p>`;
    }
    zone.innerHTML = html + pied;
    document.body.classList.add('impression');
    const fin = () => { document.body.classList.remove('impression'); zone.innerHTML = ''; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
    setTimeout(() => { if (!matchMedia('print').matches) fin(); }, 1500);
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
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  function pieceSuivante(type) {
    if (type !== 'recettes') return '';
    const a = String(new Date().getFullYear());
    const l = E.recettes.filter((r) => r.date.startsWith(a) && /\d+$/.test(r.piece || '')).sort((x, y) => x.date.localeCompare(y.date) || String(x.piece).localeCompare(String(y.piece)));
    const der = l.at(-1)?.piece;
    if (!der) return `F-${a}-001`;
    return der.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, '0'));
  }

  function modaleEcriture(type, id) {
    const x = id ? E[type].find((e) => e.id === id) : null;
    const t = auj();
    const recette = type === 'recettes';
    const tiers = recette ? 'client' : 'fournisseur';
    const deja = [...new Set(E[type].map((e) => e[tiers]).filter(Boolean))].slice(-60);
    const cats = [...new Set([...activites(), ...(x && recette ? [x.categorie] : [])])];
    const champCat = recette
      ? (cats.length > 1 ? `<label class="champ">Catégorie d'activité<select name="categorie">${cats.map((c) => `<option value="${c}" ${(x?.categorie || cats[0]) === c ? 'selected' : ''}>${esc(cat(c).nom)}</option>`).join('')}</select></label>` : `<input type="hidden" name="categorie" value="${cats[0]}">`)
      : type === 'depenses' ? `<label class="champ">Catégorie<select name="categorie">${B.categoriesDepenses.map((c) => `<option ${(x?.categorie || B.categoriesDepenses[0]) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : '';
    const corps = `
      <div class="rang-champs">
        <label class="champ">${recette ? 'Date d\'encaissement' : 'Date de paiement'}<input type="date" name="date" value="${x?.date || t}" required></label>
        <label class="champ">Montant${recette ? ' encaissé' : ''} (€)<input name="montant" inputmode="decimal" required value="${x ? String(x.montant).replace('.', ',') : ''}" placeholder="0,00" autocomplete="off"></label>
      </div>
      <label class="champ">${recette ? 'Client' : 'Fournisseur'}<small>${recette ? 'Nom, ou « Client particulier » pour une vente au comptoir.' : ''}</small><input name="tiers" maxlength="80" value="${esc(x?.[tiers] || '')}" list="liste-tiers" autocomplete="off"></label>
      <datalist id="liste-tiers">${deja.map((d) => `<option value="${esc(d)}">`).join('')}</datalist>
      <label class="champ">${recette ? 'Nature de la vente ou de la prestation' : type === 'achats' ? 'Nature de l\'achat' : 'Nature de la dépense'}<input name="nature" maxlength="120" value="${esc(x?.nature || '')}" required></label>
      ${champCat}
      <div class="rang-champs">
        <label class="champ">Mode de règlement<select name="mode">${B.modesReglement.map((m) => `<option ${(x?.mode || (recette ? 'Virement' : 'Carte bancaire')) === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="champ">Pièce justificative<small>N° de facture, ticket…</small><input name="piece" maxlength="60" value="${esc(x ? x.piece || '' : pieceSuivante(type))}" autocomplete="off"></label>
      </div>
      ${type === 'depenses' && !x ? '<p class="aide">Pour ton suivi seulement : en micro-entreprise, les dépenses ne réduisent ni tes cotisations ni ton impôt.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = x
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button>';
    const titre = { recettes: ['Nouvelle recette', 'Modifier la recette'], achats: ['Nouvel achat', 'Modifier l\'achat'], depenses: ['Nouvelle dépense', 'Modifier la dépense'] }[type][x ? 1 : 0];
    ouvrirModale(titre, corps, pied, (f, action) => {
      if (action === 'supprimer') {
        instantane();
        E[type] = E[type].filter((e) => e.id !== x.id);
        sauver(); rendre();
        toast({ recettes: 'Recette supprimée.', achats: 'Achat supprimé.', depenses: 'Dépense supprimée.' }[type], { libelle: 'Annuler', faire: annuler });
        return;
      }
      const date = f.get('date');
      const m = nombre(f.get('montant'));
      const nature = String(f.get('nature') || '').trim();
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Indique la date.';
      if (recette && date > t) return 'Une recette s\'inscrit à la date où elle est encaissée : pas de date future.';
      if (!Number.isFinite(m) || m <= 0) return 'Indique un montant positif, par exemple 120,50.';
      if (m >= 1e8) return 'Montant trop élevé.';
      if (!nature) return 'Indique la nature de l\'opération.';
      const donnees = { date, montant: R.arrondi(m), nature, [tiers]: String(f.get('tiers') || '').trim(), mode: f.get('mode'), piece: String(f.get('piece') || '').trim() };
      if (recette || type === 'depenses') donnees.categorie = f.get('categorie');
      instantane();
      if (x && action !== 'dupliquer') Object.assign(x, donnees);
      else E[type].push({ id: uid(), ...donnees, ...(action === 'dupliquer' ? { piece: recette ? pieceSuivante(type) : donnees.piece } : {}) });
      const an = Number(date.slice(0, 4));
      if (an !== annee) annee = an;
      sauver(); rendre();
      const texte = x && action !== 'dupliquer' ? 'Écriture enregistrée.' : `${eur(donnees.montant)} ajouté${recette ? ' au livre des recettes' : type === 'achats' ? ' au registre des achats' : ' aux dépenses'}.`;
      toast(texte, { libelle: 'Annuler', faire: annuler });
      if (action === 'encore') setTimeout(() => modaleEcriture(type), 50);
    });
  }

  function modaleReglages() {
    const p = E.profil;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const ac = p.acre || { fin: '', taux: {} };
    const corps = `
      <label class="champ">Nom de l'activité<input name="nom" maxlength="80" value="${esc(p.nom)}"></label>
      <label class="champ">Début d'activité<small>Plafonds proratisés la première année.</small><input type="date" name="debut" value="${esc(p.debut || '')}"></label>
      <fieldset class="champ ensemble"><legend>Activités</legend>${B.categories.map((c) => `<label class="case"><input type="checkbox" name="activites" value="${c.id}" ${p.activites.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</fieldset>
      <div class="rang-champs">
        <label class="champ">Formation professionnelle<select name="statutFormation">${B.statutsFormation.map((s) => `<option value="${s.id}" ${p.statutFormation === s.id ? 'selected' : ''}>${esc(s.nom)} (${pct(E.taux.formation[s.id])})</option>`).join('')}</select></label>
        <label class="champ">Caisse BNC<select name="caisseBnc"><option value="ssi" ${p.caisseBnc !== 'cipav' ? 'selected' : ''}>SSI (${pct(E.taux.cotisations.bnc)})</option><option value="cipav" ${p.caisseBnc === 'cipav' ? 'selected' : ''}>Cipav (${pct(E.taux.cotisations.cipav)})</option></select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Déclaration<select name="periodicite"><option value="mensuelle" ${p.periodicite === 'mensuelle' ? 'selected' : ''}>Mensuelle</option><option value="trimestrielle" ${p.periodicite !== 'mensuelle' ? 'selected' : ''}>Trimestrielle</option></select></label>
        <label class="case" style="align-self:flex-end"><input type="checkbox" name="vl" ${p.versementLiberatoire ? 'checked' : ''}> Versement libératoire</label>
      </div>
      <div class="groupe"><h3>ACRE</h3><p class="aide">Les règles de l'ACRE ont changé au 1er juillet 2026 : aucun taux n'est intégré. Si tu en bénéficies, recopie les taux réduits indiqués par l'URSSAF et la date de fin. Laisse vide sinon.</p>
        <label class="champ">Fin de l'ACRE (incluse)<input type="date" name="acreFin" value="${esc(ac.fin || '')}"></label>
        <div class="rang-champs trois">${B.categories.map((c) => `<label class="champ">${esc(c.court)} (%)<input name="acre-${c.id}" inputmode="decimal" value="${ac.taux?.[c.id] ?? ''}" placeholder="—"></label>`).join('')}</div>
      </div>
      <div class="groupe"><h3>Taux et seuils</h3><p class="aide">Valeurs ${B.millesime}${tauxModifies() ? ', modifiées par toi' : ''}, avec leurs sources.</p><div class="rang"><button class="btn petit" type="button" data-action="taux">Voir ou modifier les taux</button></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const acts = f.getAll('activites');
      if (!acts.length) return 'Choisis au moins une activité.';
      const tauxAcre = {};
      for (const c of R.CATEGORIES) {
        const v = String(f.get(`acre-${c}`) || '').trim();
        if (!v) { tauxAcre[c] = null; continue; }
        const n = nombre(v);
        if (!Number.isFinite(n) || n < 0 || n > 100) return `ACRE : taux ${cat(c).court} entre 0 et 100.`;
        tauxAcre[c] = n;
      }
      instantane();
      Object.assign(p, { nom: String(f.get('nom') || '').trim(), debut: f.get('debut') || null, activites: R.CATEGORIES.filter((c) => acts.includes(c)), statutFormation: f.get('statutFormation'), caisseBnc: f.get('caisseBnc'), periodicite: f.get('periodicite'), versementLiberatoire: f.get('vl') === 'on', acre: { fin: f.get('acreFin') || '', taux: tauxAcre } });
      if (!aVente()) sousVue = 'depenses';
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.recettes) || !d.profil) throw new Error();
        if (!confirm(`Remplacer ton livre actuel par cette copie (${pluriel(d.recettes.length, 'recette')}) ?`)) return;
        instantane();
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide du livre.'); }
    });
  }

  function modaleTaux() {
    const T = E.taux;
    const champ = (nom, lib, v, suffixe = '%') => `<label class="champ">${lib} (${suffixe})<input name="${nom}" inputmode="decimal" value="${String(v).replace('.', ',')}" required></label>`;
    const corps = `
      <p class="aide">Valeurs ${B.millesime} intégrées, sources : ${B.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.nom}</a>`).join(', ')} (consultées le ${fmt(B.consulteLe, { day: 'numeric', month: 'long', year: 'numeric' })}). Si un taux change, corrige-le ici : les estimations se recalculent.</p>
      <div class="groupe"><h3>Cotisations sociales</h3><div class="rang-champs">${champ('c-vente', 'Vente', T.cotisations.vente)}${champ('c-bic', 'Services BIC', T.cotisations.bic)}</div><div class="rang-champs">${champ('c-bnc', 'BNC (SSI)', T.cotisations.bnc)}${champ('c-cipav', 'BNC (Cipav)', T.cotisations.cipav)}</div></div>
      <div class="groupe"><h3>Versement libératoire</h3><div class="rang-champs trois">${champ('vl-vente', 'Vente', T.versementLiberatoire.vente)}${champ('vl-bic', 'Services BIC', T.versementLiberatoire.bic)}${champ('vl-bnc', 'BNC', T.versementLiberatoire.bnc)}</div></div>
      <div class="groupe"><h3>Formation professionnelle</h3><div class="rang-champs trois">${champ('f-commercant', 'Commerçant', T.formation.commercant)}${champ('f-artisan', 'Artisan', T.formation.artisan)}${champ('f-liberal', 'Libéral', T.formation.liberal)}</div></div>
      <div class="groupe"><h3>Plafonds du régime</h3><div class="rang-champs">${champ('p-vente', 'Vente', T.plafonds.vente, '€')}${champ('p-services', 'Services', T.plafonds.services, '€')}</div></div>
      <div class="groupe"><h3>Franchise de TVA</h3><div class="rang-champs">${champ('tv-base', 'Vente · base', T.tva.vente.base, '€')}${champ('tv-majore', 'Vente · majoré', T.tva.vente.majore, '€')}</div><div class="rang-champs">${champ('ts-base', 'Services · base', T.tva.services.base, '€')}${champ('ts-majore', 'Services · majoré', T.tva.services.majore, '€')}</div></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Taux et seuils', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" value="defaut">Valeurs ${B.millesime}</button>`, (f, action) => {
      instantane();
      if (action === 'defaut') { E.taux = structuredClone(B.taux); sauver(); rendre(); toast(`Taux ${B.millesime} rétablis.`, { libelle: 'Annuler', faire: annuler }); return; }
      const v = {};
      for (const [k, val] of f.entries()) {
        const n = nombre(val);
        if (!Number.isFinite(n) || n < 0) return 'Chaque valeur doit être un nombre positif.';
        if (!/^(p-|tv-|ts-)/.test(k) && n > 100) return 'Un taux ne peut pas dépasser 100 %.';
        v[k] = n;
      }
      if (v['tv-majore'] < v['tv-base'] || v['ts-majore'] < v['ts-base']) return 'Le seuil majoré doit être supérieur ou égal au seuil de base.';
      E.taux = {
        cotisations: { vente: v['c-vente'], bic: v['c-bic'], bnc: v['c-bnc'], cipav: v['c-cipav'] },
        versementLiberatoire: { vente: v['vl-vente'], bic: v['vl-bic'], bnc: v['vl-bnc'] },
        formation: { commercant: v['f-commercant'], liberal: v['f-liberal'], artisan: v['f-artisan'] },
        plafonds: { vente: v['p-vente'], services: v['p-services'] },
        tva: { vente: { base: v['tv-base'], majore: v['tv-majore'] }, services: { base: v['ts-base'], majore: v['ts-majore'] } },
      };
      sauver(); rendre(); toast('Taux enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function exporterJson() {
    telecharger(`livre-recettes-depenses-${auj()}.json`, JSON.stringify(E, null, 2), 'application/json');
  }

  // ---------- Toast et annulation ----------
  let minuterieToast = null;
  function toast(texte, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }
  // Instantané de l'état avant une modification, pour le bouton « Annuler » du toast.
  function instantane() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    const majLe = E.majLe;
    E = annulation; if (majLe) E.majLe = majLe;
    annulation = null;
    sauver(); rendre();
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
      case 'accueil-choix': {
        const champ = el.dataset.champ;
        if (el.dataset.multiple === '1') { const l = accueil[champ]; accueil[champ] = l.includes(id) ? l.filter((x) => x !== id) : [...l, id]; if (champ === 'activites') accueil.statutFormation = accueil.activites.includes('bnc') && !accueil.activites.includes('vente') ? 'liberal' : 'commercant'; }
        else if (champ === 'versementLiberatoire') accueil.versementLiberatoire = id === 'oui';
        else accueil[champ] = id;
        const y = window.scrollY; ecranAccueil(); window.scrollTo(0, y); break;
      }
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'annee': annee = Number(el.dataset.annee); filtre.mois = ''; rendre(); break;
      case 'sous-vue': sousVue = id; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'taux': modaleTaux(); break;
      case 'exporter': exporterJson(); break;
      case 'fermer': modale().close(); break;
      case 'ecriture-nouvelle': modaleEcriture(el.dataset.type); break;
      case 'ecriture-modifier': modaleEcriture(el.dataset.type, id); break;
      case 'periodicite': if (E.profil.periodicite !== id) { instantane(); E.profil.periodicite = id; sauver(); rendre(); } break;
      case 'declarer': {
        instantane();
        const fait = !E.declarees[id];
        if (fait) E.declarees[id] = true; else delete E.declarees[id];
        sauver(); rendre();
        toast(fait ? 'Période marquée comme déclarée.' : 'Période remise à déclarer.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'csv': exporterCsv(id); break;
      case 'imprimer': imprimer(id); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="filtre"]');
    if (!el) return;
    filtre[el.dataset.champ] = el.value;
    rendre();
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (vue === 'seuils' && Math.abs(window.innerWidth - largeur) > 80) { largeur = window.innerWidth; rendre(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    // Lien ?demo : n'écrase jamais le code d'un acheteur, et n'est pas mémorisé.
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname + location.hash); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname + location.hash);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    session.code = code;
    try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
    try {
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
  window.__mce = { etat: () => E, demo: () => donneesDemo(), regles: R };
  init();
})();
