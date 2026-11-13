// Budget du foyer QME : revenus → enveloppes → dépenses, données synchronisées par clé d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.BDG;
  const API = '/api/templates';
  const PRODUIT = 'BDG';
  const CLE_CODE = 'qme-bdg-code';
  const CLE_CACHE = 'qme-bdg-cache';
  const CLE_DEMO = 'qme-bdg-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-bdg-ecran-accueil';

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
  const moisCourant = () => auj().slice(0, 7);
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const libelleMois = (m, o = { month: 'long', year: 'numeric' }) => maj(versDate(`${m}-01`).toLocaleDateString('fr-FR', o));
  const eur = R.euros, eurR = R.eurosRonds;
  const saisieMontant = (c) => (Number.isInteger(c) && c > 0 ? (c % 100 ? `${Math.floor(c / 100)},${deux(c % 100)}` : String(c / 100)) : '');
  const groupe = (id) => B.groupes.find((g) => g.id === id) || B.groupes[0];
  const AVERTISSEMENT = 'Outil de suivi personnel : il ne remplace pas un conseil financier, bancaire ou fiscal. Les montants sont ceux que tu saisis ; vérifie tes comptes auprès de ta banque.';

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'mois';
  let mois = moisCourant();
  let filtre = { categorie: '', texte: '' };
  let annulation = null;

  const etatVide = () => ({ version: 1, foyer: '', modele: null, debut: moisCourant(), categories: [], sources: [], ajustements: {}, operations: [], fixes: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, categories: tab(d.categories).map((c) => ({ report: false, enveloppe: 0, ...c, sous: tab(c.sous) })),
      sources: tab(d.sources), operations: tab(d.operations), fixes: tab(d.fixes),
      ajustements: d.ajustements && typeof d.ajustements === 'object' ? d.ajustements : {} };
  };
  const categorie = (id) => E.categories.find((c) => c.id === id);
  const source = (id) => E.sources.find((s) => s.id === id);
  const sousCat = (c, id) => c?.sous.find((s) => s.id === id);
  const depuisCatalogue = (id, enveloppe = 0) => {
    const x = B.categories.find((c) => c.id === id);
    return { id: x.id, nom: x.nom, groupe: x.groupe, report: !!x.report, enveloppe, sous: x.sous.map((nom) => ({ id: uid(), nom })) };
  };
  const instantane = () => { annulation = structuredClone(E); };

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
        toast('Un autre appareil a modifié ton budget entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
        rendre();
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
  // Code BDG-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne QME (ce produit ou un autre) : 3 lettres dont au moins une hors hexadécimal.
    if (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3))) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    mois = moisCourant();
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
  // Une famille fictive sur 6 mois, relative à aujourd'hui : enveloppe dépassée, presque vide, hors budget,
  // reports cumulés, un mois en déficit, des opérations fixes pas encore ajoutées.
  function donneesDemo() {
    const D = etatVide();
    const c = moisCourant();
    const jour = Number(auj().slice(8));
    D.foyer = 'Camille et Sami'; D.modele = 'famille'; D.debut = R.ajoutMois(c, -5);
    const env = { logement: 115000, energie: 16000, alimentation: 75000, transports: 32000, sante: 9000, telecoms: 7500, enfants: 25000, assurances: 4500, impots: 18000, animaux: 6000,
      sorties: 22000, loisirs: 12000, abonnements: 4500, shopping: 18000, vacances: 25000, cadeaux: 8000, precaution: 40000, projets: 20000 };
    D.categories = [...B.modeles.find((m) => m.id === 'famille').categories, 'dons'].map((id) => depuisCatalogue(id, env[id] || 0));
    D.sources = [{ id: 's-camille', nom: 'Salaire Camille', prevu: 245000 }, { id: 's-sami', nom: 'Salaire Sami', prevu: 210000 }, { id: 's-alloc', nom: 'Allocations', prevu: 15000 }];
    const sous = (cat, nom) => D.categories.find((x) => x.id === cat)?.sous.find((s) => s.nom === nom)?.id || null;
    const fixe = (libelle, montant, type, cat, sousNom, sourceId, j) => ({ id: uid(), libelle, montant, type, categorieId: cat, sousId: cat ? sous(cat, sousNom) : null, sourceId, jour: j });
    D.fixes = [
      fixe('Salaire Camille', 245000, 'revenu', null, null, 's-camille', 1), fixe('Salaire Sami', 210000, 'revenu', null, null, 's-sami', 1),
      fixe('Allocations familiales', 15000, 'revenu', null, null, 's-alloc', 5),
      fixe('Virement épargne', 40000, 'depense', 'precaution', 'Virement mensuel', null, 2), fixe('Épargne travaux', 20000, 'depense', 'projets', 'Travaux', null, 2),
      fixe('Loyer', 115000, 'depense', 'logement', 'Loyer', null, 5), fixe('Électricité', 9800, 'depense', 'energie', 'Électricité', null, 10),
      fixe('Box internet', 3499, 'depense', 'telecoms', 'Box internet', null, 8), fixe('Forfaits mobiles', 3800, 'depense', 'telecoms', 'Forfaits mobiles', null, 8),
      fixe('Assurance habitation', 2400, 'depense', 'logement', 'Assurance habitation', null, 15), fixe('Complémentaire santé', 6200, 'depense', 'sante', 'Complémentaire santé', null, 15),
      fixe('Crèche', 18000, 'depense', 'enfants', 'Garde', null, 4), fixe('Vidéo à la demande', 1399, 'depense', 'abonnements', 'Vidéo et musique', null, 12),
      fixe('Mensualisation impôt', 16500, 'depense', 'impots', 'Impôt sur le revenu', null, 15), fixe('Frais de tenue de compte', 300, 'depense', 'assurances', 'Frais bancaires', null, 31),
    ];
    let graine = 11;
    const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
    const entre = (a, b) => Math.round((a + alea() * (b - a)) * 100);
    for (let i = -5; i <= 0; i++) {
      const m = R.ajoutMois(c, i);
      const max = i === 0 ? jour : R.joursDansMois(m);
      D.operations.push(...R.genererFixes(D, m).filter((o) => Number(o.date.slice(8)) <= max));
      const dep = (j, montant, cat, sousNom, libelle) => { if (j <= max) D.operations.push({ id: uid(), date: `${m}-${deux(j)}`, type: 'depense', montant, categorieId: cat, sousId: sous(cat, sousNom), sourceId: null, libelle }); };
      [3, 7, 10, 14, 17, 21, 24, 28].forEach((j) => dep(j, entre(62, 98), 'alimentation', 'Courses', 'Courses de la semaine'));
      dep(12, entre(14, 26), 'alimentation', 'Marché et producteurs', 'Marché');
      dep(6, entre(52, 70), 'transports', 'Carburant ou recharge', 'Plein');
      dep(20, entre(50, 68), 'transports', 'Carburant ou recharge', 'Plein');
      dep(16, entre(70, 84), 'transports', 'Transports en commun', 'Abonnement transport');
      dep(9, entre(28, 55), 'sorties', 'Restaurants', 'Restaurant');
      dep(23, entre(30, 60), 'sorties', 'Restaurants', 'Restaurant');
      dep(18, entre(18, 26), 'sorties', 'Cinéma et spectacles', 'Cinéma');
      dep(11, entre(12, 30), 'sante', 'Pharmacie', 'Pharmacie');
      dep(13, entre(25, 40), 'loisirs', 'Sport', 'Piscine');
      dep(19, entre(30, 120), 'shopping', i % 2 ? 'Vêtements' : 'Maison et décoration', i % 2 ? 'Vêtements' : 'Déco');
      dep(8, entre(25, 45), 'enfants', 'Activités', 'Activité du mercredi');
      dep(22, entre(18, 30), 'animaux', 'Alimentation animale', 'Croquettes');
      dep(26, entre(14, 22), 'energie', 'Eau', 'Eau');
      if (i === -4) dep(15, 12000, 'vacances', 'Hébergement', 'Week-end');
      if (i === -2) { dep(4, 98000, 'vacances', 'Transport', 'Billets d\'avion'); dep(5, 86000, 'vacances', 'Hébergement', 'Location d\'été'); }
      if (i === -1) { dep(15, 102000, 'impots', 'Taxe foncière', 'Taxe foncière'); dep(27, 6500, 'cadeaux', 'Anniversaires', 'Cadeau d\'anniversaire'); }
      if (i === -3) dep(14, 15000, 'dons', 'Associations', 'Don');
    }
    // Mois en cours : forcer chaque état visible, à la date du jour.
    const t = auj();
    const ici = (cat) => D.operations.filter((o) => o.categorieId === cat && o.date.startsWith(c)).reduce((s, o) => s + o.montant, 0);
    const forcer = (montant, cat, sousNom, libelle) => { if (montant > 0) D.operations.push({ id: uid(), date: t, type: 'depense', montant, categorieId: cat, sousId: sous(cat, sousNom), sourceId: null, libelle }); };
    forcer(69000 - ici('alimentation'), 'alimentation', 'Courses', 'Courses du mois');
    forcer(24500 - ici('sorties'), 'sorties', 'Restaurants', 'Dîner entre amis');
    forcer(3000, 'dons', 'Associations', 'Collecte de l\'école');
    D.operations.sort((a, b) => a.date.localeCompare(b.date));
    // Mois prévus à l'avance : vacances d'été et taxe foncière (le reste du déficit est reporté puis résorbé).
    D.ajustements[R.ajoutMois(c, -2)] = { vacances: 100000 };
    D.ajustements[R.ajoutMois(c, -1)] = { impots: 120000 };
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Budget du foyer · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="120" height="260" fill="#F0EDE6"/>
          <path d="M130 20 C220 20 220 40 300 40 L300 120 C220 120 220 110 130 110 Z" fill="#1D4E89"/>
          <path d="M130 110 C220 110 220 170 300 170 L300 220 C220 220 220 190 130 190 Z" fill="#F5B400"/>
          <path d="M130 190 C220 190 220 250 300 250 L300 280 C220 280 220 280 130 280 Z" fill="#2E7D4F"/>
          <rect x="300" y="40" width="40" height="80" fill="#1D4E89"/>
          <rect x="300" y="170" width="40" height="50" fill="#F5B400"/>
          <rect x="300" y="250" width="40" height="30" fill="#2E7D4F"/>
          <circle cx="462" cy="96" r="76" fill="#D9302A"/>
          <path d="M386 280 A96 96 0 0 1 482 184 V280 Z" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Budget du foyer · enveloppes et flux</p>
          <h1>Chaque euro a une place.</h1>
          <p>Tes revenus répartis en enveloppes, tes dépenses comparées au prévu, et un diagramme qui montre où part l'argent chaque mois.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton budget</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton budget est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon budget</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de budget ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Aucune connexion à ta banque : tu saisis toi-même tes montants. ${esc(AVERTISSEMENT.split(' : ')[0])}. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon budget'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, foyer: '', modele: null, cats: new Set(), sources: [] });
  let accueil = accueilVide();

  function choisirModele(id) {
    const m = B.modeles.find((x) => x.id === id);
    accueil.modele = id;
    accueil.cats = new Set(m ? m.categories : ['logement', 'alimentation', 'transports', 'precaution']);
    const noms = m ? m.sources : ['Salaire'];
    accueil.sources = noms.map((nom, i) => ({ nom: noms.filter((n) => n === nom).length > 1 ? `${nom} ${i + 1}` : nom, prevu: '' }));
  }

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton budget.</h1>
        <p class="intro">Deux étapes : ton foyer, puis tes revenus. Tu rempliras ensuite tes enveloppes. Tout reste modifiable.</p>
        <label class="champ" style="max-width:360px">Nom du foyer <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="foyer" value="${esc(a.foyer)}" maxlength="40" placeholder="Ex. : Chez nous">
        </label>
        <h2 class="titre-section">Ton foyer <span>Les catégories sont préchoisies selon ton choix, sans aucun montant.</span></h2>
        <div class="filieres" role="group" aria-label="Modèle de foyer">
          ${B.modeles.map((x, i) => `<button type="button" class="filiere" style="--c:${['#1D4E89', '#D9302A', '#F5B400', '#2E7D4F'][i % 4]}" data-action="modele" data-id="${x.id}" aria-pressed="${a.modele === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)} · ${pluriel(x.categories.length, 'catégorie')}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="modele" data-id="libre" aria-pressed="${a.modele === 'libre'}"><b>Personnalisé</b><span>Je choisis mes catégories moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.modele ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${esc(B.modeles.find((m) => m.id === a.modele)?.nom || 'Personnalisé')}</p>
        <h1>Tes revenus et tes catégories</h1>
        <p class="intro">Indique ce qui rentre chaque mois, net. Ce total sert de base pour remplir tes enveloppes et pour le repère 50/30/20.</p>
        <h2 class="titre-section">Revenus mensuels prévus</h2>
        <div class="sources-accueil" id="sources-accueil">
          ${a.sources.map((s, i) => `<div class="rang-source"><label class="champ">Source<input data-source="${i}" data-champ="nom" value="${esc(s.nom)}" maxlength="40" list="liste-sources"></label><label class="champ">Montant net par mois<input data-source="${i}" data-champ="prevu" value="${esc(s.prevu)}" inputmode="decimal" placeholder="0,00 €"></label><button class="btn petit" type="button" data-action="accueil-source-suppr" data-i="${i}" aria-label="Retirer ${esc(s.nom)}">Retirer</button></div>`).join('')}
          <datalist id="liste-sources">${B.sources.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          <button class="btn petit" type="button" data-action="accueil-source-ajout">+ Ajouter une source</button>
        </div>
        <h2 class="titre-section">Catégories <span>Décoche celles qui ne te concernent pas. Le groupe (besoins, envies, épargne) se change ensuite.</span></h2>
        <div class="choix-groupes">${B.groupes.map((g) => `<fieldset class="choix-matieres" style="--c:${g.couleur}"><legend>${esc(g.nom)}</legend>${B.categories.filter((c) => c.groupe === g.id).map((c) => `<label class="case"><input type="checkbox" data-action="accueil-cat" value="${c.id}" ${a.cats.has(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</fieldset>`).join('')}</div>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.cats.size ? '' : 'disabled'}>Créer mon budget (${pluriel(a.cats.size, 'catégorie')})</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#foyer')?.addEventListener('input', (e) => { accueil.foyer = e.target.value; });
    document.querySelectorAll('[data-source]').forEach((el) => el.addEventListener('input', () => { accueil.sources[Number(el.dataset.source)][el.dataset.champ] = el.value; }));
  }

  function terminerAccueil() {
    const sources = accueil.sources.filter((s) => s.nom.trim());
    for (const s of sources) if (s.prevu.trim() && R.versCentimes(s.prevu) === null) { $('#erreur-accueil').textContent = `Montant illisible pour « ${s.nom} » : écris par exemple 1 850,00.`; return; }
    E = etatVide();
    E.foyer = accueil.foyer.trim();
    E.modele = accueil.modele;
    E.categories = B.categories.filter((c) => accueil.cats.has(c.id)).map((c) => depuisCatalogue(c.id));
    E.sources = sources.map((s) => ({ id: uid(), nom: s.nom.trim().slice(0, 40), prevu: R.versCentimes(s.prevu) || 0 }));
    accueil = accueilVide();
    sauver();
    vue = 'enveloppes';
    history.replaceState(null, '', '#enveloppes');
    demarrer();
    toast('Budget créé. Remplis maintenant tes enveloppes : touche une catégorie pour lui donner un montant.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    mois: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    enveloppes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    categories: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['mois', 'Mois'], ['enveloppes', 'Enveloppes'], ['operations', 'Opérations'], ['bilan', 'Bilan'], ['categories', 'Catégories']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Foyer fictif, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Budget<br>du foyer</span>
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
    document.title = `${titres[vue]} · Budget du foyer`;
    $('#vue').innerHTML = { mois: vueMois, enveloppes: vueEnveloppes, operations: vueOperations, bilan: vueBilan, categories: vueCategories }[vue]();
    brancherInfobulles();
    if (vue === 'operations') brancherFiltres();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#2E7D4F"/></svg>';
  const vide = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  function navMois() {
    const c = moisCourant();
    return `<div class="nav-mois" role="group" aria-label="Mois affiché">
      <button class="btn-icone" data-action="mois" data-n="-1" aria-label="Mois précédent">‹</button>
      <b>${libelleMois(mois)}</b>
      <button class="btn-icone" data-action="mois" data-n="1" aria-label="Mois suivant">›</button>
      ${mois !== c ? '<button class="btn petit" data-action="mois-courant">Ce mois-ci</button>' : ''}
    </div>`;
  }

  const ETIQUETTES = { depasse: ['rouge', 'Dépassée'], presque: ['jaune', 'Presque vide'], hors: ['rouge', 'Hors budget'], pile: ['bleu', 'Utilisée'], ok: ['', ''], aucune: ['', ''] };
  const etiquette = (s) => (ETIQUETTES[s][1] ? `<span class="etiquette ${ETIQUETTES[s][0]}">${ETIQUETTES[s][1]}</span>` : '');

  // ----- Mois (tableau de bord) -----
  function vueMois() {
    if (!E.categories.length) return `<div class="vue-tete"><div><h1>${libelleMois(mois)}</h1></div></div>${vide('Aucune catégorie', 'Ajoute tes catégories de dépenses pour commencer.', '<button class="btn primaire" data-action="vue" data-vue="categories">Mes catégories</button>')}`;
    const env = R.etatEnveloppes(E, mois);
    const dep = R.depensesDuMois(E, mois);
    const rev = R.revenusDuMois(E, mois);
    const prevu = R.revenusPrevus(E);
    const dispo = R.parGroupe(env, 'disponible');
    const reel = R.parGroupe(env, 'depense');
    const reste = env.reduce((s, x) => s + (x.disponible > 0 ? x.reste : -x.depense), 0);
    const c = moisCourant();
    const joursRestants = mois === c ? R.joursDansMois(mois) - Number(auj().slice(8)) + 1 : 0;
    const salut = E.foyer ? `${esc(E.foyer)} · ` : '';
    const titre = reste >= 0
      ? `Il reste <mark>${eurR(reste)}</mark> dans tes enveloppes${mois < c ? ' à la fin du mois' : ''}.`
      : `Tes enveloppes sont dépassées de <mark class="rouge">${eurR(-reste)}</mark>.`;
    const sous = mois === c && reste > 0 ? `Soit environ ${eurR(Math.floor(reste / joursRestants))} par jour d'ici la fin du mois (${pluriel(joursRestants, 'jour')}).` : mois > c ? 'Mois à venir : seules les enveloppes et les opérations déjà saisies comptent.' : '';
    const solde = rev.total - dep.total;
    const tuiles = [
      ['Revenus', eurR(rev.total), `sur ${eurR(prevu)} prévus`, 'var(--encre)', 'rond'],
      ['Dépenses', eurR(reel.besoins + reel.envies), `sur ${eurR(Math.max(0, dispo.besoins) + Math.max(0, dispo.envies))} d'enveloppes`, 'var(--bleu)', ''],
      ['Épargne', eurR(reel.epargne), `sur ${eurR(Math.max(0, dispo.epargne))} prévus`, 'var(--vert)', 'rond'],
      ['Solde du mois', `${solde < 0 ? '−' : solde > 0 ? '+' : ''}${eurR(Math.abs(solde))}`, 'Revenus moins dépenses et épargne', solde < 0 ? 'var(--rouge)' : 'var(--jaune)', '', solde < 0],
    ].map(([lib, v, d, col, f, neg]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b${neg ? ' class="moins"' : ''}>${v}</b><span>${d}</span></div>`).join('');
    const alertes = env.filter((x) => ['depasse', 'presque', 'hors'].includes(x.statut)).sort((a, b) => b.taux - a.taux);
    const base503020 = rev.total || prevu;
    const reperes = R.repere503020(reel, base503020);
    return `
      <div class="vue-tete"><div><p class="surtitre">${salut}Tableau de bord</p>${navMois()}</div>
        <div class="actions"><button class="btn" data-action="operation" data-type="revenu">${ICONES.plus}Revenu</button><button class="btn primaire" data-action="operation" data-type="depense">${ICONES.plus}Dépense</button></div></div>
      <section class="entete-mois"><h1>${titre}</h1>${sous ? `<p class="sous">${sous}</p>` : ''}</section>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Où va l'argent <span>Revenus reçus → besoins, envies, épargne → catégories.</span></h2>
      ${blocSankey()}
      <div class="deux-colonnes">
        <section>
          <h2 class="titre-section">${esc(B.repere.titre)} <span>${rev.total ? 'Part de tes revenus du mois.' : 'Aucun revenu saisi : calcul sur les revenus prévus.'}</span></h2>
          ${blocRepere(reperes, base503020)}
        </section>
        <section>
          <h2 class="titre-section">À surveiller <span>${alertes.length ? pluriel(alertes.length, 'enveloppe') : ''}</span></h2>
          ${alertes.length ? `<ul class="liste-alertes">${alertes.map((x) => { const cat = categorie(x.id); return `<li><button data-action="enveloppe" data-id="${x.id}" style="--c:${groupe(x.groupe).couleur}"><i></i><span><b>${esc(cat.nom)}</b><small>${x.statut === 'hors' ? `${eur(x.depense)} sans enveloppe` : x.disponible < 0 ? `déficit reporté de ${eur(-x.disponible)}${x.depense ? `, ${eur(x.depense)} dépensés` : ''}` : `${eur(x.depense)} sur ${eur(x.disponible)}`}</small></span>${etiquette(x.statut)}</button></li>`; }).join('')}</ul>`
            : '<p class="carte-calme">Toutes les enveloppes tiennent. Rien à signaler.</p>'}
        </section>
      </div>
      <p class="avertissement">${esc(AVERTISSEMENT)}</p>`;
  }

  function blocRepere(reperes, base) {
    if (!base) return '<p class="carte-calme">Indique tes revenus prévus (onglet Catégories) pour situer ton budget par rapport au repère.</p>';
    return `<div class="repere">${reperes.map((r) => {
      const g = groupe(r.groupe);
      const part = r.part ?? 0;
      return `<div class="repere-ligne"><div class="repere-tete"><b>${esc(g.nom)}</b><span>${part.toLocaleString('fr-FR')} % · repère ${r.repere} %</span></div>
        <div class="repere-piste" role="img" aria-label="${esc(g.nom)} : ${part} % des revenus, repère ${r.repere} %"><i style="width:${Math.min(100, part)}%;background:${g.couleur}"></i><s style="left:${r.repere}%"></s></div>
        <small>${eur(r.montant)} · repère ${eur(r.cible)}</small></div>`;
    }).join('')}<p class="aide">${esc(B.repere.texte)}</p></div>`;
  }

  // ----- Sankey -----
  const largeurGraphique = () => Math.round(Math.min(1100, Math.max(288, ($('#vue')?.clientWidth || window.innerWidth) - 36)));
  const tronquer = (s, max) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s);
  const nomGroupe = (id) => (id === 'reste' ? 'Non dépensé' : groupe(id).nom);

  function blocSankey() {
    const flux = R.fluxSankey(E, mois);
    if (!flux.revenus && !flux.sorties) return vide('Aucun mouvement ce mois-ci', 'Saisis un revenu ou une dépense : le diagramme montrera le trajet de ton argent.', '<button class="btn primaire" data-action="operation" data-type="depense">Ajouter une dépense</button>');
    const d = R.dispositionSankey(flux, { largeur: largeurGraphique() });
    const fs = d.compact ? 11 : 13;
    const couleurNoeud = (n) => (n.col === 0 ? (n.id === 'manque' ? ['#D9302A', '#fff'] : ['#141414', '#F0EDE6'])
      : n.col === 1 ? (n.id === 'reste' ? ['url(#hachures)', '#141414'] : [groupe(n.id).couleur, groupe(n.id).texte]) : [groupe(n.groupe).couleur, '#141414']);
    const couleurLien = (l) => (l.groupe === 'reste' ? '#B9B2A3' : groupe(l.groupe).couleur);
    const noms = {};
    flux.sources.forEach((s) => { noms[`0:${s.id}`] = s.id === 'manque' ? 'Déficit' : s.nom; });
    flux.groupes.forEach((g) => { noms[`1:${g.id}`] = nomGroupe(g.id); });
    flux.categories.forEach((c) => { noms[`2:${c.id}`] = c.nom; });
    const liens = d.liens.map((l) => {
      const de = l.groupe === l.de ? noms[`1:${l.de}`] : noms[`0:${l.de}`];
      const vers = l.groupe === l.de ? noms[`2:${l.vers}`] : noms[`1:${l.vers}`];
      return `<path class="lien" d="${l.d}" fill="${couleurLien(l)}" data-info="${esc(`${de} → ${vers}|${eur(l.valeur)}`)}"/>`;
    }).join('');
    const xMaxEtiquette = d.noeuds.find((n) => n.col === 1)?.x + d.noeuds.find((n) => n.col === 1)?.w || d.L / 2;
    const noeuds = d.noeuds.map((n) => {
      const [fond, texte] = couleurNoeud(n);
      const nom = noms[`${n.col}:${n.id}`] || n.nom;
      const info = `data-info="${esc(`${nom}|${eur(n.valeur)}`)}"`;
      if (n.col < 2) {
        const max = Math.floor((n.w - 12) / (fs * 0.56));
        // Nom trop long : sur deux lignes si le bloc est assez haut, sinon tronqué.
        let lignes = [tronquer(nom, max)];
        if (nom.length > max && n.slot >= fs * 4) {
          const coupe = nom.lastIndexOf(' ', max);
          if (coupe > 0) lignes = [nom.slice(0, coupe), tronquer(nom.slice(coupe + 1), max)];
        }
        const y0 = n.haut + n.slot / 2 - 3 - (lignes.length - 1) * (fs + 2) / 2;
        return `<g class="noeud" ${info}><rect x="${n.x}" y="${n.haut}" width="${n.w}" height="${n.slot}" fill="${fond}" stroke="#141414" stroke-width="2"/>
          ${lignes.map((l, i) => `<text x="${n.x + 7}" y="${y0 + i * (fs + 2)}" fill="${texte}" font-size="${fs}" font-weight="700">${esc(l)}</text>`).join('')}
          <text x="${n.x + 7}" y="${y0 + (lignes.length - 1) * (fs + 2) + fs + 2}" fill="${texte}" font-size="${fs}">${eurR(n.valeur)}</text></g>`;
      }
      const max = Math.floor((n.x - 8 - xMaxEtiquette - 6) / (fs * 0.56));
      const yc = n.y + n.h / 2;
      return `<g class="noeud" ${info}><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${fond}" stroke="#141414" stroke-width="1.5"/>
        <text class="halo" x="${n.x - 6}" y="${yc - 2}" text-anchor="end" font-size="${fs}" font-weight="700">${esc(tronquer(nom, max))}</text>
        <text class="halo" x="${n.x - 6}" y="${yc + fs}" text-anchor="end" font-size="${fs}" fill="#45413A">${eurR(n.valeur)}</text></g>`;
    }).join('');
    const svg = `<svg viewBox="0 0 ${d.L} ${d.H}" width="${d.L}" height="${d.H}" role="img" aria-label="Diagramme des flux de ${libelleMois(mois)} : ${eur(flux.revenus)} de revenus, ${eur(flux.sorties)} de dépenses et d'épargne. Détail dans le tableau ci-dessous.">
      <defs><pattern id="hachures" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#FBFAF6"/><rect width="3" height="8" fill="#D9D4C8"/></pattern></defs>
      ${liens}${noeuds}</svg>`;
    const lignes = [...flux.liensSG.map((l) => [noms[`0:${l.de}`], noms[`1:${l.vers}`], l.valeur]), ...flux.liensGC.map((l) => [noms[`1:${l.de}`], noms[`2:${l.vers}`], l.valeur])];
    return `<figure class="graphique sankey">
      <div class="graphique-tete"><h2>${libelleMois(mois)}</h2><div class="legende">${B.groupes.map((g) => `<span><i style="background:${g.couleur}"></i>${esc(g.nom)}</span>`).join('')}${flux.groupes.some((g) => g.id === 'reste') ? '<span><i class="hachure"></i>Non dépensé</span>' : ''}${flux.sources.some((s) => s.id === 'manque') ? '<span><i style="background:var(--rouge)"></i>Déficit : sorties supérieures aux revenus</span>' : ''}</div></div>
      <div class="sankey-cadre">${svg}</div>
      <div class="infobulle" hidden></div>
      <details class="tableau-flux"><summary>Voir les flux en tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>De</th><th>Vers</th><th class="nb">Montant</th></tr></thead><tbody>${lignes.map(([a, b, v]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="nb">${eur(v)}</td></tr>`).join('')}</tbody></table></div></details>
    </figure>`;
  }

  // Infobulles des graphiques : tout élément [data-info="titre|valeur"].
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el, e) => {
        const [t, ...v] = el.dataset.info.split('|');
        bulle.innerHTML = `<b>${esc(t)}</b>${v.map((x) => `<div>${esc(x)}</div>`).join('')}`;
        bulle.hidden = false;
        fig.querySelectorAll('.actif').forEach((x) => x.classList.remove('actif'));
        el.classList.add('actif');
        const rf = fig.getBoundingClientRect();
        let x = e.clientX - rf.left + 14, y = e.clientY - rf.top + 14;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, e.clientX - rf.left - bulle.offsetWidth - 14);
        if (y + bulle.offsetHeight > rf.height - 8) y = Math.max(8, e.clientY - rf.top - bulle.offsetHeight - 14);
        bulle.style.left = `${x}px`; bulle.style.top = `${y}px`;
      };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointermove', (e) => montrer(el, e));
        el.addEventListener('click', (e) => montrer(el, e));
      });
      fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.actif').forEach((x) => x.classList.remove('actif')); });
    });
  }

  // ----- Enveloppes -----
  function vueEnveloppes() {
    const env = R.etatEnveloppes(E, mois);
    const parId = Object.fromEntries(env.map((x) => [x.id, x]));
    const dep = R.depensesDuMois(E, mois);
    const rev = R.revenusDuMois(E, mois);
    const prevu = R.revenusPrevus(E);
    const totalEnv = env.reduce((s, x) => s + x.enveloppe, 0);
    const aAffecter = prevu - totalEnv;
    const sources = E.sources.map((s) => `<tr><td>${esc(s.nom)}</td><td class="nb">${eur(s.prevu || 0)}</td><td class="nb">${eur(rev.parSource[s.id] || 0)}</td><td class="nb ${(rev.parSource[s.id] || 0) < (s.prevu || 0) ? 'moins' : ''}">${eur((rev.parSource[s.id] || 0) - (s.prevu || 0), { signe: true })}</td></tr>`).join('');
    const cibles = Object.fromEntries(R.repere503020({}, prevu).map((r) => [r.groupe, r.cible]));
    const groupes = B.groupes.map((g) => {
      const cats = E.categories.filter((c) => c.groupe === g.id);
      if (!cats.length) return '';
      const tEnv = cats.reduce((s, c) => s + parId[c.id].enveloppe, 0);
      const tDep = cats.reduce((s, c) => s + parId[c.id].depense, 0);
      return `<section class="groupe-env" style="--c:${g.couleur};--t:${g.texte}">
        <div class="groupe-tete"><div><h2>${esc(g.nom)}</h2><p>${eur(tDep)} dépensés sur ${eur(tEnv)} prévus</p></div><span>${prevu ? `${Math.round((tEnv * 100) / prevu)} % des revenus · repère ${g.repere} % (${eurR(cibles[g.id])})` : `Repère ${g.repere} %`}</span></div>
        <ul>${cats.map((c) => ligneEnveloppe(c, parId[c.id], dep)).join('')}</ul>
      </section>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Enveloppes</h1>${navMois()}<p>Chaque catégorie reçoit une enveloppe. Avec le report, ce qui reste s'ajoute au mois suivant et un dépassement s'en retire.</p></div>
        <aside class="a-affecter ${aAffecter < 0 ? 'negatif' : aAffecter === 0 ? 'zero' : ''}"><p class="surtitre">Reste à affecter</p><b>${eur(aAffecter)}</b><span>${aAffecter < 0 ? 'Tes enveloppes dépassent tes revenus prévus.' : aAffecter === 0 ? 'Chaque euro prévu a une enveloppe.' : `Revenus prévus ${eurR(prevu)} − enveloppes ${eurR(totalEnv)}`}</span></aside></div>
      <h2 class="titre-section">Revenus <span>Prévu contre reçu ce mois-ci.</span></h2>
      ${E.sources.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Source</th><th class="nb">Prévu</th><th class="nb">Reçu</th><th class="nb">Écart</th></tr></thead><tbody>${sources}</tbody><tfoot><tr><td>Total</td><td class="nb">${eur(prevu)}</td><td class="nb">${eur(rev.total)}</td><td class="nb">${eur(rev.total - prevu, { signe: true })}</td></tr></tfoot></table></div>`
        : vide('Aucune source de revenus', 'Ajoute tes revenus prévus pour savoir combien répartir.', '<button class="btn primaire" data-action="source">Ajouter un revenu prévu</button>')}
      ${E.categories.length ? `<div class="groupes-env">${groupes}</div>` : vide('Aucune catégorie', 'Ajoute des catégories depuis le catalogue.', '<button class="btn primaire" data-action="catalogue">Catalogue</button>')}`;
  }

  function ligneEnveloppe(c, x, dep) {
    const pct = x.disponible > 0 ? Math.min(100, (x.depense / x.disponible) * 100) : (x.depense ? 100 : 0);
    const sous = c.sous.map((s) => [s.nom, dep.parSous[`${c.id}/${s.id}`] || 0]).filter(([, v]) => v);
    const sansSous = dep.parSous[`${c.id}/`] || 0;
    if (sansSous) sous.push(['Sans sous-catégorie', sansSous]);
    const reste = x.disponible > 0 || x.depense ? `<b class="${x.reste < 0 ? 'moins' : ''}">${x.reste < 0 ? `${eur(-x.reste)} de trop` : `${eur(x.reste)} restants`}</b>` : '<b class="discret">Pas d\'enveloppe</b>';
    return `<li class="env ${x.statut}">
      <button class="env-tete" data-action="enveloppe" data-id="${c.id}" aria-label="Modifier l'enveloppe ${esc(c.nom)}">
        <span class="env-nom"><b>${esc(c.nom)}</b>${etiquette(x.statut)}${c.report ? '<span class="etiquette clair">Report</span>' : ''}</span>
        ${reste}
      </button>
      <div class="jauge" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <p class="env-detail">${x.disponible < 0 ? `Déficit reporté des mois précédents : ${eur(-x.disponible)}. ${eur(x.depense)} dépensés` : `${eur(x.depense)} dépensés sur ${eur(x.disponible)}`}${x.report ? ` (enveloppe ${eur(x.enveloppe)} ${x.report > 0 ? '+' : '−'} report ${eur(Math.abs(x.report))})` : ''}</p>
      ${sous.length ? `<details class="env-sous"><summary>Détail par sous-catégorie</summary><ul>${sous.map(([n, v]) => `<li><span>${esc(n)}</span><b>${eur(v)}</b></li>`).join('')}</ul></details>` : ''}
    </li>`;
  }

  // ----- Opérations -----
  function operationsFiltrees() {
    const t = filtre.texte.trim().toLowerCase();
    return E.operations.filter((o) => o.date.startsWith(mois))
      .filter((o) => !filtre.categorie || (filtre.categorie === 'revenus' ? o.type === 'revenu' : o.categorieId === filtre.categorie))
      .filter((o) => !t || `${o.libelle || ''} ${categorie(o.categorieId)?.nom || ''} ${source(o.sourceId)?.nom || ''} ${sousCat(categorie(o.categorieId), o.sousId)?.nom || ''}`.toLowerCase().includes(t))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.type === 'revenu' ? -1 : 1));
  }

  function listeOperations() {
    const ops = operationsFiltrees();
    if (!ops.length) return E.operations.some((o) => o.date.startsWith(mois)) ? '<p class="carte-calme">Aucune opération ne correspond au filtre.</p>'
      : vide('Aucune opération ce mois-ci', 'Ajoute tes dépenses au fil de l\'eau, ou les opérations fixes du mois en un clic.', '<button class="btn primaire" data-action="operation" data-type="depense">Ajouter une dépense</button>');
    const jours = [...new Set(ops.map((o) => o.date))];
    const dep = ops.filter((o) => o.type === 'depense').reduce((s, o) => s + o.montant, 0);
    const rev = ops.filter((o) => o.type === 'revenu').reduce((s, o) => s + o.montant, 0);
    return `<p class="totaux-ops">${pluriel(ops.length, 'opération')} · dépenses <b>${eur(dep)}</b> · revenus <b>${eur(rev)}</b></p>
      ${jours.map((j) => `<section class="jour-ops"><h3>${maj(fmt(j, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>${ops.filter((o) => o.date === j).map(ligneOperation).join('')}</section>`).join('')}`;
  }

  function ligneOperation(o) {
    const c = categorie(o.categorieId);
    const s = o.type === 'revenu' ? source(o.sourceId) : null;
    const couleur = o.type === 'revenu' ? 'var(--encre)' : c ? groupe(c.groupe).couleur : 'var(--trait)';
    const sousNom = sousCat(c, o.sousId)?.nom;
    const titre = o.libelle || sousNom || c?.nom || s?.nom || 'Revenu';
    const detail = o.type === 'revenu' ? (s?.nom || 'Autre revenu') : `${c?.nom || 'Sans catégorie'}${sousNom ? ` › ${sousNom}` : ''}`;
    return `<button class="op ${o.type}" data-action="operation" data-id="${o.id}" style="--c:${couleur}"><i></i><span><b>${esc(titre)}</b><small>${esc(detail)}${o.fixeId ? ' · fixe' : ''}</small></span><em>${o.type === 'revenu' ? '+' : '−'}${eur(o.montant)}</em></button>`;
  }

  function vueOperations() {
    const fixes = R.genererFixes(E, mois);
    const options = `<option value="">Toutes les opérations</option><option value="revenus" ${filtre.categorie === 'revenus' ? 'selected' : ''}>Revenus</option>${B.groupes.map((g) => `<optgroup label="${esc(g.nom)}">${E.categories.filter((c) => c.groupe === g.id).map((c) => `<option value="${c.id}" ${filtre.categorie === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</optgroup>`).join('')}`;
    return `
      <div class="vue-tete"><div><h1>Opérations</h1>${navMois()}</div>
        <div class="actions"><button class="btn" data-action="operation" data-type="revenu">${ICONES.plus}Revenu</button><button class="btn primaire" data-action="operation" data-type="depense">${ICONES.plus}Dépense</button></div></div>
      ${fixes.length ? `<div class="bandeau-fixes"><p><b>${pluriel(fixes.length, 'opération fixe', 'opérations fixes')}</b> pas encore ${fixes.length > 1 ? 'ajoutées' : 'ajoutée'} en ${libelleMois(mois, { month: 'long' }).toLowerCase()} : ${esc(fixes.slice(0, 4).map((f) => f.libelle).join(', '))}${fixes.length > 4 ? '…' : ''}.</p><button class="btn petit primaire" data-action="ajouter-fixes">Les ajouter</button></div>` : ''}
      <div class="filtres"><label class="champ">Catégorie<select id="filtre-cat">${options}</select></label><label class="champ">Rechercher<input id="filtre-texte" type="search" value="${esc(filtre.texte)}" placeholder="Libellé, catégorie…"></label></div>
      <div id="liste-ops">${listeOperations()}</div>`;
  }

  function brancherFiltres() {
    $('#filtre-cat')?.addEventListener('change', (e) => { filtre.categorie = e.target.value; $('#liste-ops').innerHTML = listeOperations(); });
    $('#filtre-texte')?.addEventListener('input', (e) => { filtre.texte = e.target.value; $('#liste-ops').innerHTML = listeOperations(); });
  }

  // ----- Bilan -----
  const ORDRE_PILE = ['besoins', 'envies', 'epargne'];

  function graphiqueBilan(serie) {
    const L = largeurGraphique(), compact = L < 560, H = compact ? 220 : 260, g = compact ? 48 : 64, b = 24, hz = H - b - 10;
    const max = Math.max(1, ...serie.map((m) => Math.max(m.total, m.revenus)));
    const pas = Math.ceil(max / 4 / 50000) * 50000 || 50000;
    const haut = pas * 4;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const larg = (L - g) / serie.length;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 6}" y="${y(i * pas) + 4}" text-anchor="end">${eurR(i * pas)}</text>`).join('');
    const colonnes = serie.map((m, i) => {
      const w = Math.max(6, larg * 0.62), x = g + i * larg + (larg - w) / 2;
      let cumul = 0;
      const rects = ORDRE_PILE.map((k) => {
        const v = m.depenses[k];
        if (!v) return '';
        const y1 = y(cumul + v), h = y(cumul) - y1 - (cumul ? 2 : 0);
        cumul += v;
        return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(1, h)}" fill="${groupe(k).couleur}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const marque = m.revenus ? `<line class="revenu" x1="${x - 4}" x2="${x + w + 4}" y1="${y(m.revenus)}" y2="${y(m.revenus)}"/>` : '';
      const etiquette = (serie.length - 1 - i) % (compact ? 2 : 1) === 0 ? `<text class="axe" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${libelleMois(m.mois, { month: 'short' }).replace('.', '')}</text>` : '';
      const info = `${libelleMois(m.mois)}|Besoins : ${eur(m.depenses.besoins)}|Envies : ${eur(m.depenses.envies)}|Épargne : ${eur(m.depenses.epargne)}|Revenus : ${eur(m.revenus)}|Enveloppes : ${eur(m.enveloppes)}`;
      return `<g class="colonne">${rects}${marque}</g>${etiquette}<rect class="zone" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}" data-info="${esc(info)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" width="${L}" height="${H}" role="img" aria-label="Dépenses et épargne par mois sur 12 mois, avec les revenus ; détail dans le tableau ci-dessous">${grilles}${colonnes}</svg>`;
  }

  function vueBilan() {
    const fin = mois > moisCourant() ? moisCourant() : mois;
    const serie = R.serieMois(E, fin, 12);
    const actifs = serie.filter((m) => m.total || m.revenus);
    const n = actifs.length || 1;
    const moyDep = Math.round(actifs.reduce((s, m) => s + m.depenses.besoins + m.depenses.envies, 0) / n);
    const moyRev = Math.round(actifs.reduce((s, m) => s + m.revenus, 0) / n);
    const totRev = actifs.reduce((s, m) => s + m.revenus, 0);
    const totEp = actifs.reduce((s, m) => s + m.depenses.epargne, 0);
    const dessus = actifs.filter((m) => m.depenses.besoins + m.depenses.envies + m.depenses.epargne > m.enveloppes).length;
    const tuiles = [
      ['Dépenses par mois', eurR(moyDep), 'Moyenne, hors épargne', 'var(--bleu)', ''],
      ['Revenus par mois', eurR(moyRev), 'Moyenne des mois saisis', 'var(--encre)', 'rond'],
      ['Taux d\'épargne', totRev ? `${Math.round((totEp * 100) / totRev)}<small>%</small>` : '–', 'Épargne ÷ revenus', 'var(--vert)', ''],
      ['Mois au-dessus', `${dessus}<small>/ ${actifs.length}</small>`, 'Sorties supérieures aux enveloppes', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const listeMois = serie.map((m) => m.mois).filter((m) => m >= (E.debut || m));
    const ecarts = R.ecartsCategories(E, listeMois).filter((x) => x.budget || x.total).sort((a, b) => b.ecart - a.ecart);
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Les 12 mois jusqu'à ${libelleMois(fin).toLowerCase()} : ce qui est sorti chaque mois, par groupe, face à tes revenus.</p></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">12 derniers mois</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Sorties par mois</h2><div class="legende">${ORDRE_PILE.map((k) => `<span><i style="background:${groupe(k).couleur}"></i>${esc(groupe(k).nom)}</span>`).join('')}<span><i class="trait-revenu"></i>Revenus</span></div></div>
        ${graphiqueBilan(serie)}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Sorties et revenus par mois</caption><thead><tr><th>Mois</th><th>Besoins</th><th>Envies</th><th>Épargne</th><th>Revenus</th><th>Enveloppes</th></tr></thead><tbody>${serie.map((m) => `<tr><td>${libelleMois(m.mois)}</td><td>${eur(m.depenses.besoins)}</td><td>${eur(m.depenses.envies)}</td><td>${eur(m.depenses.epargne)}</td><td>${eur(m.revenus)}</td><td>${eur(m.enveloppes)}</td></tr>`).join('')}</tbody></table></div>
      </figure>
      <h2 class="titre-section">Écart au budget par catégorie <span>Depuis ${libelleMois(listeMois[0] || fin).toLowerCase()}, sans les reports. Positif : dépensé de plus que prévu.</span></h2>
      ${ecarts.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Catégorie</th><th class="nb">Moyenne / mois</th><th class="nb">Dépensé</th><th class="nb">Prévu</th><th class="nb">Écart</th></tr></thead><tbody>${ecarts.map((x) => `<tr style="--c:${groupe(x.groupe).couleur}"><td><span class="nom-matiere"><i></i>${esc(categorie(x.id)?.nom)}</span></td><td class="nb">${eur(x.moyenne)}</td><td class="nb">${eur(x.total)}</td><td class="nb">${eur(x.budget)}</td><td class="nb ${x.ecart > 0 ? 'moins' : ''}">${eur(x.ecart, { signe: true })}</td></tr>`).join('')}</tbody></table></div>` : '<p class="carte-calme">Pas encore assez de données.</p>'}
      <p class="avertissement">${esc(AVERTISSEMENT)}</p>`;
  }

  // ----- Catégories -----
  function vueCategories() {
    const manquantes = B.categories.filter((c) => !categorie(c.id)).length;
    const blocs = B.groupes.map((g) => {
      const cats = E.categories.filter((c) => c.groupe === g.id);
      return `<article class="matiere" style="--c:${g.couleur};--t:${g.texte}">
        <div class="matiere-tete"><div><h2>${esc(g.nom)}</h2><p>${esc(g.detail)}</p></div></div>
        <div class="chapitres">${cats.length ? cats.map((c) => `<button class="chapitre" data-action="categorie" data-id="${c.id}"><b>${esc(c.nom)}</b><span class="nb-env">${c.enveloppe ? eur(c.enveloppe) : '–'}</span><span>${c.sous.length ? esc(c.sous.map((s) => s.nom).join(', ')) : 'Aucune sous-catégorie'}${c.report ? ' · report du reste' : ''}</span></button>`).join('') : '<p class="matiere-vide">Aucune catégorie dans ce groupe.</p>'}</div>
        <div class="matiere-pied"><button class="btn petit" data-action="categorie" data-groupe="${g.id}">${ICONES.plus}Catégorie</button></div>
      </article>`;
    }).join('');
    const typeFixe = (f) => (f.type === 'revenu' ? source(f.sourceId)?.nom || 'Revenu' : `${categorie(f.categorieId)?.nom || 'Sans catégorie'}${sousCat(categorie(f.categorieId), f.sousId) ? ` › ${sousCat(categorie(f.categorieId), f.sousId).nom}` : ''}`);
    return `
      <div class="vue-tete"><div><h1>Catégories</h1><p>Tes sources de revenus, tes catégories rangées en besoins, envies et épargne, et les opérations qui reviennent chaque mois.</p></div>
        <div class="actions">${manquantes ? `<button class="btn" data-action="catalogue">Catalogue (${manquantes})</button>` : ''}<button class="btn primaire" data-action="categorie">${ICONES.plus}Catégorie</button></div></div>
      <h2 class="titre-section">Revenus prévus <span>Total : ${eur(R.revenusPrevus(E))} par mois</span></h2>
      <div class="liste-simple">${E.sources.map((s) => `<button class="ligne-simple" data-action="source" data-id="${s.id}"><b>${esc(s.nom)}</b><span>${eur(s.prevu || 0)} / mois</span></button>`).join('')}<button class="ligne-simple ajout" data-action="source">${ICONES.plus}Ajouter une source de revenus</button></div>
      <h2 class="titre-section">Catégories <span>Le montant affiché est l'enveloppe par défaut de chaque mois.</span></h2>
      <div class="matieres">${blocs}</div>
      <h2 class="titre-section">Opérations fixes <span>Loyer, abonnements, salaire : ajoutées en un clic chaque mois depuis l'onglet Opérations.</span></h2>
      <div class="liste-simple">${E.fixes.slice().sort((a, b) => a.jour - b.jour).map((f) => `<button class="ligne-simple" data-action="fixe" data-id="${f.id}"><b>${esc(f.libelle)}</b><span>${f.type === 'revenu' ? '+' : '−'}${eur(f.montant)} · le ${f.jour} · ${esc(typeFixe(f))}</span></button>`).join('')}<button class="ligne-simple ajout" data-action="fixe">${ICONES.plus}Ajouter une opération fixe</button></div>
      <aside class="encart"><h3>${esc(B.repere.titre)}</h3><p>${esc(B.repere.texte)}</p><p class="source">Source : ${esc(B.repere.source)}</p></aside>`;
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

  const optionsCategories = (choix) => B.groupes.map((g) => `<optgroup label="${esc(g.nom)}">${E.categories.filter((c) => c.groupe === g.id).map((c) => `<option value="${c.id}" ${c.id === choix ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</optgroup>`).join('');
  const optionsSous = (catId, choix) => `<option value="">—</option>${(categorie(catId)?.sous || []).map((s) => `<option value="${s.id}" ${s.id === choix ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}`;
  const optionsSources = (choix) => `${E.sources.map((s) => `<option value="${s.id}" ${s.id === choix ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}<option value="autre" ${choix === 'autre' ? 'selected' : ''}>Autre revenu</option>`;

  // Champs communs aux opérations et aux opérations fixes, avec bascule dépense / revenu.
  function champsOperation(o) {
    return `
      <fieldset class="bascule" role="radiogroup"><legend class="sr-only">Type</legend>
        <label><input type="radio" name="type" value="depense" ${o.type !== 'revenu' ? 'checked' : ''}><span>Dépense</span></label>
        <label><input type="radio" name="type" value="revenu" ${o.type === 'revenu' ? 'checked' : ''}><span>Revenu</span></label>
      </fieldset>
      <label class="champ">Montant<input name="montant" inputmode="decimal" required value="${esc(saisieMontant(o.montant))}" placeholder="0,00 €" autocomplete="off"></label>
      <div class="si-depense"><label class="champ">Catégorie<select name="categorie">${optionsCategories(o.categorieId)}</select></label>
      <label class="champ">Sous-catégorie<select name="sous">${optionsSous(o.categorieId || E.categories[0]?.id, o.sousId)}</select></label></div>
      <div class="si-revenu"><label class="champ">Source<select name="source">${optionsSources(o.sourceId)}</select></label></div>
      <label class="champ">Libellé<small>Facultatif.</small><input name="libelle" maxlength="80" value="${esc(o.libelle || '')}"></label>`;
  }

  function brancherBascule() {
    const d = modale();
    const maj = () => {
      const rev = d.querySelector('input[name=type]:checked')?.value === 'revenu';
      d.querySelector('.si-depense').hidden = rev;
      d.querySelector('.si-revenu').hidden = !rev;
    };
    d.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', maj));
    d.querySelector('select[name=categorie]')?.addEventListener('change', (e) => { d.querySelector('select[name=sous]').innerHTML = optionsSous(e.target.value); });
    maj();
  }

  function lireOperation(f) {
    const montant = R.versCentimes(f.get('montant'));
    if (!montant) return 'Montant illisible : écris par exemple 42,50.';
    const type = f.get('type') === 'revenu' ? 'revenu' : 'depense';
    if (type === 'depense' && !f.get('categorie')) return 'Crée d\'abord une catégorie.';
    return { type, montant, libelle: String(f.get('libelle') || '').trim().slice(0, 80),
      categorieId: type === 'depense' ? f.get('categorie') : null, sousId: type === 'depense' ? (f.get('sous') || null) : null,
      sourceId: type === 'revenu' ? f.get('source') : null };
  }

  function modaleOperation(type, id) {
    if (!E.categories.length && type !== 'revenu' && !id) { toast('Crée d\'abord une catégorie.'); changerVue('categories'); return; }
    const o = id ? E.operations.find((x) => x.id === id) : null;
    const t = auj();
    const dateDefaut = mois === moisCourant() ? t : `${mois}-01`;
    const base = o || { type, categorieId: E.categories[0]?.id, sourceId: E.sources[0]?.id || 'autre' };
    const corps = `${champsOperation(base)}
      <label class="champ">Date<input type="date" name="date" value="${o?.date || dateDefaut}" required></label>
      ${o?.fixeId ? '<p class="aide">Opération créée depuis une opération fixe : la modifier ici ne change pas les autres mois.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = o ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button>';
    ouvrirModale(o ? 'Modifier l\'opération' : (type === 'revenu' ? 'Nouveau revenu' : 'Nouvelle dépense'), corps, pied, (f, action) => {
      if (action === 'supprimer') {
        instantane();
        E.operations = E.operations.filter((x) => x.id !== o.id);
        sauver(); rendre(); toast('Opération supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const lu = lireOperation(f);
      if (typeof lu === 'string') return lu;
      const date = f.get('date');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Indique la date.';
      instantane();
      if (o) Object.assign(o, lu, { date });
      else E.operations.push({ id: uid(), ...lu, date });
      if (date.slice(0, 7) !== mois && !o) mois = date.slice(0, 7);
      sauver(); rendre();
      if (action === 'encore') {
        toast(`${lu.type === 'revenu' ? 'Revenu' : 'Dépense'} de ${eur(lu.montant)} ajouté${lu.type === 'revenu' ? '' : 'e'}.`);
        setTimeout(() => modaleOperation(lu.type), 0);
        return;
      }
      toast(o ? 'Opération enregistrée.' : `${lu.type === 'revenu' ? 'Revenu' : 'Dépense'} de ${eur(lu.montant)} ajouté${lu.type === 'revenu' ? '' : 'e'}.`, { libelle: 'Annuler', faire: annuler });
    });
    brancherBascule();
  }

  function modaleEnveloppe(id) {
    const c = categorie(id);
    if (!c) return;
    const x = R.etatEnveloppes(E, mois).find((y) => y.id === id);
    const propre = Number.isInteger(E.ajustements[mois]?.[id]);
    const corps = `
      <p class="surtitre" style="margin:0">${esc(groupe(c.groupe).nom)} · ${libelleMois(mois)}</p>
      <label class="champ">Montant de l'enveloppe<input name="montant" inputmode="decimal" value="${esc(saisieMontant(x.enveloppe))}" placeholder="0,00 €" autocomplete="off"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">S'applique à</legend>
        <label class="case"><input type="radio" name="portee" value="tous" ${propre ? '' : 'checked'}> ${libelleMois(mois)} et les mois suivants</label>
        <label class="case"><input type="radio" name="portee" value="mois" ${propre ? 'checked' : ''}> ${libelleMois(mois)} seulement</label>
      </fieldset>
      <label class="case"><input type="checkbox" name="report" ${c.report ? 'checked' : ''}> Reporter le reste d'un mois sur l'autre</label>
      <p class="aide">Ce mois-ci : ${eur(x.depense)} dépensés${x.report ? `, report ${eur(x.report, { signe: true })}` : ''}. Les mois passés gardent leur montant.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(c.nom), corps, `<button class="btn primaire" value="ok">Enregistrer</button>${propre ? '<button class="btn" value="retirer">Revenir au montant habituel</button>' : '<button class="btn" value="annuler">Annuler</button>'}`, (f, action) => {
      instantane();
      if (action === 'retirer') { delete E.ajustements[mois][id]; sauver(); rendre(); toast('Montant habituel rétabli.', { libelle: 'Annuler', faire: annuler }); return; }
      const brut = String(f.get('montant') || '').trim();
      const montant = brut ? R.versCentimes(brut) : 0;
      if (montant === null) return 'Montant illisible : écris par exemple 250 ou 249,90.';
      definirEnveloppe(c, montant, f.get('portee'));
      c.report = f.get('report') === 'on';
      sauver(); rendre(); toast(`Enveloppe ${c.nom} : ${eur(montant)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // « Ce mois et les suivants » : fige d'abord l'ancien montant sur les mois passés pour ne pas réécrire l'historique.
  function definirEnveloppe(c, montant, portee) {
    if (portee === 'mois') { (E.ajustements[mois] ||= {})[c.id] = montant; return; }
    const debut = E.debut && E.debut < mois ? E.debut : mois;
    for (let m = debut; m < mois; m = R.ajoutMois(m, 1)) {
      if (!Number.isInteger(E.ajustements[m]?.[c.id])) (E.ajustements[m] ||= {})[c.id] = c.enveloppe || 0;
    }
    for (const m of Object.keys(E.ajustements)) if (m >= mois) delete E.ajustements[m][c.id];
    c.enveloppe = montant;
  }

  function modaleCategorie(id, groupeDefaut) {
    const c = id ? categorie(id) : null;
    const g = c?.groupe || groupeDefaut || 'besoins';
    const nbOps = c ? E.operations.filter((o) => o.categorieId === c.id).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(c?.nom || '')}"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Groupe</legend>
        <div class="bascule trois">${B.groupes.map((x) => `<label><input type="radio" name="groupe" value="${x.id}" ${x.id === g ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Sous-catégories<small>Une par ligne. Facultatives.</small><textarea name="sous" maxlength="1200">${esc((c?.sous || []).map((s) => s.nom).join('\n'))}</textarea></label>
      <label class="case"><input type="checkbox" name="report" ${c?.report ? 'checked' : ''}> Reporter le reste d'un mois sur l'autre</label>
      ${c ? '' : '<label class="champ">Enveloppe mensuelle<small>Facultative, modifiable ensuite.</small><input name="enveloppe" inputmode="decimal" placeholder="0,00 €"></label>'}
      <p class="erreur" role="alert"></p>`;
    const pied = c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier la catégorie' : 'Nouvelle catégorie', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (nbOps && !confirm(`Supprimer « ${c.nom} » ? Ses ${pluriel(nbOps, 'opération')} passeront en « Sans catégorie ».`)) return '';
        instantane();
        E.categories = E.categories.filter((x) => x.id !== c.id);
        sauver(); rendre(); toast(`« ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la catégorie.';
      const noms = String(f.get('sous') || '').split('\n').map((s) => s.trim().slice(0, 40)).filter(Boolean);
      let env = 0;
      if (!c && String(f.get('enveloppe') || '').trim()) { env = R.versCentimes(f.get('enveloppe')); if (env === null) return 'Enveloppe illisible : écris par exemple 120.'; }
      instantane();
      const sous = noms.map((n) => c?.sous.find((s) => s.nom === n) || { id: uid(), nom: n });
      if (c) Object.assign(c, { nom, groupe: f.get('groupe'), sous, report: f.get('report') === 'on' });
      else E.categories.push({ id: uid(), nom, groupe: f.get('groupe'), sous, report: f.get('report') === 'on', enveloppe: env });
      sauver(); rendre(); toast(c ? 'Catégorie enregistrée.' : `« ${nom} » créée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCatalogue() {
    const libres = B.categories.filter((c) => !categorie(c.id));
    const corps = `<p>Catégories du catalogue que tu n'utilises pas encore, avec leurs sous-catégories.</p>
      ${B.groupes.map((g) => { const l = libres.filter((c) => c.groupe === g.id); return l.length ? `<fieldset class="choix-matieres" style="--c:${g.couleur}"><legend>${esc(g.nom)}</legend>${l.map((c) => `<label class="case"><input type="checkbox" name="cat" value="${c.id}"> ${esc(c.nom)}</label>`).join('')}</fieldset>` : ''; }).join('')}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Catalogue', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const ids = f.getAll('cat');
      if (!ids.length) return 'Coche au moins une catégorie.';
      instantane();
      ids.forEach((cid) => E.categories.push(depuisCatalogue(cid)));
      sauver(); rendre(); toast(`${pluriel(ids.length, 'catégorie ajoutée', 'catégories ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleSource(id) {
    const s = id ? source(id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(s?.nom || '')}" list="liste-src"></label>
      <datalist id="liste-src">${B.sources.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="champ">Montant net prévu par mois<input name="prevu" inputmode="decimal" value="${esc(saisieMontant(s?.prevu))}" placeholder="0,00 €"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = s ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Modifier le revenu prévu' : 'Nouveau revenu prévu', corps, pied, (f, action) => {
      instantane();
      if (action === 'supprimer') { E.sources = E.sources.filter((x) => x.id !== s.id); sauver(); rendre(); toast(`« ${s.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return; }
      const nom = String(f.get('nom') || '').trim().slice(0, 40);
      if (!nom) return 'Indique le nom de la source.';
      const brut = String(f.get('prevu') || '').trim();
      const prevu = brut ? R.versCentimes(brut) : 0;
      if (prevu === null) return 'Montant illisible : écris par exemple 1 850.';
      if (s) Object.assign(s, { nom, prevu }); else E.sources.push({ id: uid(), nom, prevu });
      sauver(); rendre(); toast('Revenu prévu enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleFixe(id) {
    if (!E.categories.length && !E.sources.length) { toast('Crée d\'abord une catégorie ou une source de revenus.'); return; }
    const fx = id ? E.fixes.find((x) => x.id === id) : null;
    const base = fx || { type: 'depense', categorieId: E.categories[0]?.id, sourceId: E.sources[0]?.id || 'autre', jour: 1 };
    const corps = `${champsOperation(base)}
      <label class="champ">Jour du mois<small>Ramené au dernier jour pour les mois plus courts.</small><input type="number" name="jour" min="1" max="31" value="${base.jour}" required></label>
      <p class="erreur" role="alert"></p>`;
    const pied = fx ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(fx ? 'Modifier l\'opération fixe' : 'Nouvelle opération fixe', corps, pied, (f, action) => {
      if (action === 'supprimer') { instantane(); E.fixes = E.fixes.filter((x) => x.id !== fx.id); sauver(); rendre(); toast('Opération fixe supprimée. Les opérations déjà créées restent.', { libelle: 'Annuler', faire: annuler }); return; }
      const lu = lireOperation(f);
      if (typeof lu === 'string') return lu;
      if (!lu.libelle) lu.libelle = lu.type === 'revenu' ? (source(lu.sourceId)?.nom || 'Revenu') : (sousCat(categorie(lu.categorieId), lu.sousId)?.nom || categorie(lu.categorieId)?.nom);
      const jour = Number(f.get('jour'));
      if (!Number.isInteger(jour) || jour < 1 || jour > 31) return 'Jour du mois : entre 1 et 31.';
      instantane();
      if (fx) Object.assign(fx, lu, { jour }); else E.fixes.push({ id: uid(), ...lu, jour });
      sauver(); rendre(); toast('Opération fixe enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
    brancherBascule();
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Nom du foyer<input name="foyer" maxlength="40" value="${esc(E.foyer)}"></label>
      <label class="champ">Mois de départ du budget<small>Les reports d'enveloppes se calculent à partir de ce mois.</small><input type="month" name="debut" value="${esc(E.debut)}" required></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton budget est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="aide">Toute personne qui a ta clé voit et modifie ce budget.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">${esc(AVERTISSEMENT)}</p><p class="aide">${esc(B.repere.titre)} : ${esc(B.repere.source)}</p></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const debut = String(f.get('debut') || '');
      if (!/^\d{4}-\d{2}$/.test(debut)) return 'Indique le mois de départ.';
      E.foyer = String(f.get('foyer') || '').trim().slice(0, 40);
      E.debut = debut;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.categories) || !Array.isArray(d.operations)) throw new Error();
        if (!confirm(`Remplacer ton budget actuel par cette copie (${pluriel(d.categories.length, 'catégorie')}, ${pluriel(d.operations.length, 'opération')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du budget.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `budget-foyer-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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

  function annuler() {
    if (!annulation) return;
    E = annulation;
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
      case 'deconnexion': modale().open && modale().close(); deconnecter(); break;
      case 'modele': choisirModele(id); ecranAccueil(); break;
      case 'accueil-suivant': accueil.foyer = $('#foyer')?.value || accueil.foyer; accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-source-ajout': accueil.sources.push({ nom: '', prevu: '' }); ecranAccueil(); document.querySelector(`[data-source="${accueil.sources.length - 1}"]`)?.focus(); break;
      case 'accueil-source-suppr': accueil.sources.splice(Number(el.dataset.i), 1); ecranAccueil(); break;
      case 'accueil-cat': el.checked ? accueil.cats.add(el.value) : accueil.cats.delete(el.value); {
        const b = $('[data-action="accueil-fin"]');
        b.disabled = !accueil.cats.size; b.textContent = `Créer mon budget (${pluriel(accueil.cats.size, 'catégorie')})`;
      } break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'mois': mois = R.ajoutMois(mois, Number(el.dataset.n)); rendre(); break;
      case 'mois-courant': mois = moisCourant(); rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'operation': modaleOperation(el.dataset.type || 'depense', id); break;
      case 'enveloppe': modaleEnveloppe(id); break;
      case 'categorie': modaleCategorie(id, el.dataset.groupe); break;
      case 'catalogue': modaleCatalogue(); break;
      case 'source': modaleSource(id); break;
      case 'fixe': modaleFixe(id); break;
      case 'ajouter-fixes': {
        const n = R.genererFixes(E, mois);
        instantane();
        E.operations.push(...n);
        sauver(); rendre(); toast(`${pluriel(n.length, 'opération fixe ajoutée', 'opérations fixes ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // Les graphiques suivent la largeur de l'écran (rotation du téléphone, fenêtre redimensionnée).
  let largeurPrec = window.innerWidth, minRedim = null;
  window.addEventListener('resize', () => {
    clearTimeout(minRedim);
    minRedim = setTimeout(() => { if (Math.abs(window.innerWidth - largeurPrec) > 40 && E && (vue === 'mois' || vue === 'bilan') && !modale().open) { largeurPrec = window.innerWidth; rendre(); } }, 200);
  });

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
  window.__budget = { etat: () => E, demo: () => donneesDemo() };
  init();
})();
