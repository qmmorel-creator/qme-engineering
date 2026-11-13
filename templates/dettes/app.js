// Remboursement de dettes QME : plan boule de neige / avalanche, échéancier, pointage, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.DTT;
  const API = '/api/templates';
  const PRODUIT = 'DTT';
  const CLE_CODE = 'qme-dtt-code';
  const CLE_CACHE = 'qme-dtt-cache';
  const CLE_DEMO = 'qme-dtt-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-dtt-ecran-accueil';

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
  const eur = R.euros;
  const eurR = R.eurosRonds;
  const moisCourant = () => R.moisDe(new Date());
  const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const lm = (m, court = false) => { if (!m) return '–'; const [a, n] = m.split('-').map(Number); return `${(court ? MOIS_COURTS : NOMS_MOIS)[n - 1]} ${a}`; };
  const lmMaj = (m) => { const t = lm(m); return t.charAt(0).toUpperCase() + t.slice(1); };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const typeDe = (id) => B.types.find((t) => t.id === id) || B.types[B.types.length - 1];
  const methodeDe = (id) => B.methodes.find((m) => m.id === id) || (id === 'minimums' ? B.minimums : B.methodes[0]);
  const FORMES = {
    carre: '<rect x="3" y="3" width="18" height="18" rx="3"/>',
    rond: '<circle cx="12" cy="12" r="9"/>',
    quart: '<path d="M3 21V3a18 18 0 0 1 18 18Z"/>',
    triangle: '<path d="M12 3 22 21H2Z"/>',
  };
  const iconeType = (id) => `<svg class="ic-type" viewBox="0 0 24 24" aria-hidden="true">${FORMES[typeDe(id).forme] || FORMES.rond}</svg>`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'plan';
  let moisPointage = moisCourant();
  let annulation = null;
  let essai = { montant: '', mois: '' };

  const etatVide = R.etatVide;
  const normaliser = R.normaliser;

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    toast('Modification annulée.');
  }

  // Plan courant (recalculé à chaque rendu : quelques centaines de mois au plus).
  const optsPlan = (e = E, methode = e.methode) => ({ budget: e.budget, methode, ordre: e.ordre, versements: e.versements, debut: e.debut });
  const plan = () => R.simuler(E.dettes, optsPlan());

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
        toast('Un autre appareil a modifié ton plan entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (DTT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && E.debut) { cache(false); demarrer(); } else ecranAccueil();
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
  // Foyer fictif : six dettes depuis 4 mois, paiements pointés avec les vraies règles (un mois en retard,
  // un mois à finir de pointer, le mois en cours commencé), un versement passé et un à venir.
  function donneesDemo() {
    const e = etatVide();
    const t = moisCourant();
    e.prenom = 'Camille';
    e.debut = R.ajoutMois(t, -4);
    e.budget = 65000;
    e.methode = 'boule';
    const dette = (id, type, nom, capital, taux, mensualite, note = '') => ({ id, type, nom, capital, taux, mensualite, note });
    e.dettes = [
      dette('auto', 'auto', 'Prêt voiture', 780000, 4.9, 21000, 'Prélevé le 5 du mois.'),
      dette('cuisine', 'conso', 'Crédit cuisine', 310000, 7.5, 11500),
      dette('reserve', 'renouvelable', 'Réserve d\'argent', 234000, 19.9, 6000, 'Réserve à fermer une fois soldée.'),
      dette('magasin', 'carte', 'Carte du magasin', 145000, 21.9, 2500, 'Échéance minimale du dernier relevé.'),
      dette('mamie', 'familial', 'Prêt de Mamie', 120000, 0, 5000, 'Accord écrit : 50 € par mois.'),
      dette('decouvert', 'decouvert', 'Découvert du compte courant', 38000, 16, 4000),
    ];
    e.ordre = ['decouvert', 'magasin', 'mamie', 'reserve', 'cuisine', 'auto'];
    e.versements = [
      { id: 'v1', mois: R.ajoutMois(t, -2), montant: 30000, detteId: null, note: 'Vente d\'un vélo' },
      { id: 'v2', mois: R.ajoutMois(t, 1), montant: 60000, detteId: 'magasin', note: 'Prime de fin d\'année' },
    ];
    const sim = R.simuler(e.dettes, optsPlan(e));
    let k = 0;
    const pointer = (mois, filtre = () => true, ajuste = {}) => {
      for (const [id, v] of Object.entries(R.prevuDuMois(sim, mois))) {
        if (!v || !filtre(id)) continue;
        e.paiements.push({ id: `p${k++}`, mois, detteId: id, montant: ajuste[id] ?? v });
      }
    };
    pointer(R.ajoutMois(t, -4));
    pointer(R.ajoutMois(t, -3), undefined, { reserve: 4000 }); // 20 € de moins que prévu sur la réserve
    pointer(R.ajoutMois(t, -2));
    pointer(R.ajoutMois(t, -1), (id) => id === 'auto' || id === 'cuisine'); // mois à finir de pointer
    pointer(t, (id) => id === 'mamie'); // mois en cours commencé
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Remboursement de dettes · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="250" height="56" fill="#1D4E89"/>
          <rect x="10" y="86" width="190" height="56" fill="#D9302A"/>
          <rect x="10" y="152" width="120" height="56" fill="#F5B400"/>
          <rect x="10" y="218" width="50" height="56" fill="#141414"/>
          <circle cx="410" cy="150" r="130" fill="#F5B400"/>
          <path d="M410 150 L410 20 A130 130 0 0 1 540 150 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Remboursement de dettes</p>
          <h1>Une date de fin, enfin.</h1>
          <p>Toutes tes dettes, un budget par mois, et le plan qui les solde une à une : boule de neige, avalanche ou ton ordre à toi.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton plan</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton plan est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon plan</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de plan ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon plan'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', dettes: [], budget: '', methode: 'boule' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="points-etapes" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>D'abord, la liste complète.</h1>
        <p class="intro">Ajoute chacune de tes dettes avec ce qu'il reste à rembourser, son taux et ta mensualité minimale. Même les petites, même celles sans intérêts : un plan ne tient que si rien n'est oublié.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Tes dettes <span>${a.dettes.length ? pluriel(a.dettes.length, 'dette') : 'Choisis un type pour commencer'}</span></h2>
        ${a.dettes.length ? `<ul class="liste-accueil">${a.dettes.map((d) => `<li>${iconeType(d.type)}<span><b>${esc(d.nom)}</b><small>${eur(d.capital)} · ${R.tauxTexte(d.taux)} · ${eur(d.mensualite)} par mois</small></span><button class="btn lien" data-action="accueil-dette" data-id="${d.id}">Modifier</button></li>`).join('')}</ul>` : ''}
        <p class="sous-titre-types">${a.dettes.length ? 'Ajouter une autre dette :' : 'Quel type de dette ?'}</p>
        <div class="types-dettes" role="group" aria-label="Ajouter une dette par type">
          ${B.types.map((t) => `<button type="button" class="type-dette" data-action="accueil-ajout" data-type="${t.id}">${iconeType(t.id)}<span>${esc(t.nom)}</span></button>`).join('')}
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.dettes.length ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const min = R.totalMinimums(a.dettes);
      const budget = R.versCentimes(a.budget);
      corps = `
        <p class="surtitre">Ton budget</p>
        <h1>Combien peux-tu y consacrer chaque mois ?</h1>
        <p class="intro">Le budget couvre toutes les mensualités minimales (${eur(min)} aujourd'hui). Ce que tu ajoutes au-delà accélère le plan, et chaque mensualité libérée par une dette soldée passe à la suivante.</p>
        <div class="rang-champs">
          <label class="champ">Budget mensuel pour les remboursements<input id="acc-budget" inputmode="decimal" value="${esc(a.budget || R.versSaisie(min))}" placeholder="${R.versSaisie(min)}"></label>
        </div>
        <p class="erreur" id="acc-erreur" role="alert">${budget !== null && budget < min ? `Il manque ${eur(min - budget)} pour couvrir les minimums.` : ''}</p>
        <h2 class="titre-section">Ta méthode <span>Modifiable à tout moment, et comparée dans l'onglet Comparer.</span></h2>
        <div class="choix-methodes" role="radiogroup" aria-label="Méthode">
          ${B.methodes.map((m) => `<label class="choix-methode" style="--c:${m.couleur}"><input type="radio" name="acc-methode" value="${m.id}" ${a.methode === m.id ? 'checked' : ''}><span><b>${esc(m.nom)}</b><em>${esc(m.regle)}</em><small>${esc(m.detail)}</small></span></label>`).join('')}
        </div>
        <p class="avertissement">${esc(B.avertissement)}</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Calculer mon plan</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#acc-budget')?.addEventListener('input', (e) => { accueil.budget = e.target.value; });
    document.querySelectorAll('[name=acc-methode]').forEach((r) => r.addEventListener('change', () => { accueil.methode = r.value; }));
  }

  function terminerAccueil() {
    const min = R.totalMinimums(accueil.dettes);
    const budget = R.versCentimes(accueil.budget || R.versSaisie(min));
    if (budget === null) { $('#acc-erreur').textContent = 'Saisis un montant, par exemple 450 ou 450,50.'; return; }
    if (budget < min) { $('#acc-erreur').textContent = `Il manque ${eur(min - budget)} pour couvrir les minimums (${eur(min)}). Augmente le budget, ou revois une mensualité avec ton prêteur.`; return; }
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    E.debut = moisCourant();
    E.budget = budget;
    E.methode = accueil.methode;
    E.dettes = accueil.dettes;
    E.ordre = R.ordrePriorite(E.dettes, 'boule');
    accueil = { etape: 1, prenom: '', dettes: [], budget: '', methode: 'boule' };
    vue = 'plan';
    sauver();
    demarrer();
    toast('Ton plan est prêt. Chaque mois, pointe tes paiements dans l\'onglet Pointage.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    echeancier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    dettes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="8" height="4" fill="currentColor"/></svg>',
    comparer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    pointage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13l6 6L21 5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    haut: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 15 7-7 7 7" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    bas: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    alerte: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2 23 21H1Z" fill="currentColor"/><path d="M11 9h2v6h-2zM11 16.5h2v2h-2z" fill="#fff"/></svg>',
  };
  const ONGLETS = [['plan', 'Plan'], ['echeancier', 'Échéancier'], ['dettes', 'Dettes'], ['comparer', 'Comparer'], ['pointage', 'Pointage']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/dettes/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Remboursement<br>de dettes</span>
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
    document.title = `${titres[vue]} · Remboursement de dettes`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { plan: vuePlan, echeancier: vueEcheancier, dettes: vueDettes, comparer: vueComparer, pointage: vuePointage }[vue]();
    brancherGraphiques();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Alertes communes ----------
  function alertes(sim) {
    const t = moisCourant();
    const liste = [];
    if (!sim.ok && sim.erreur === 'budget') liste.push(['rouge', 'Budget insuffisant', `Ton budget (${eur(E.budget)}) ne couvre pas les mensualités minimales : il manque <b>${eur(sim.manque)}</b> par mois. Augmente le budget, ou revois une mensualité avec ton prêteur.`, '<button class="btn petit" data-action="budget">Modifier le budget</button>']);
    if (sim.ok && sim.nonTermine) liste.push(['rouge', 'Plan sans fin', `Avec ce budget, les intérêts mangent tout : le total dû ne baisse pas assez pour finir en ${R.dureeTexte(R.MAX_MOIS)}. Augmente le budget ou parles-en à un conseiller.`, '<button class="btn petit" data-action="budget">Modifier le budget</button>']);
    for (const d of E.dettes) {
      if (d.capital <= 0) continue;
      const c = R.couvreInterets(d);
      if (!c.ok) liste.push(['jaune', 'Mensualité trop faible', `<b>${esc(d.nom)}</b> : la mensualité minimale (${eur(d.mensualite)}) ne couvre pas les intérêts du mois (${eur(c.interet)}). Seule, cette dette ne baisserait jamais ; il faut au moins ${eur(c.manque)} de plus par mois.${sim.ok && !sim.nonTermine ? ' Ton plan la rembourse grâce au surplus.' : ''}`, `<button class="btn petit" data-action="dette" data-id="${d.id}">Voir la dette</button>`]);
    }
    if (sim.ok) {
      const aPointer = R.moisAPointer(sim, E.paiements, t);
      if (aPointer.length) liste.push(['bleu', 'À pointer', `${aPointer.length > 1 ? `${aPointer.length} mois passés ont` : `${lmMaj(aPointer[0].mois)} a`} encore des paiements prévus non pointés.`, `<button class="btn petit" data-action="pointer-mois" data-mois="${aPointer[0].mois}">Pointer ${lm(aPointer[0].mois)}</button>`]);
      const dernier = R.dernierMoisPointe(sim, E.paiements);
      if (dernier) {
        const ec = R.ecartPlan(E.dettes, sim, E.paiements, dernier).at(-1);
        if (ec && Math.abs(ec.avance) >= 1000) liste.push([ec.avance < 0 ? 'jaune' : 'bleu', ec.avance < 0 ? 'En retard sur le plan' : 'En avance sur le plan', `Fin ${lm(dernier)}, il restait ${eur(ec.soldeReel)} à rembourser contre ${eur(ec.soldePrevu)} prévus (${eur(Math.abs(ec.avance))} ${ec.avance < 0 ? 'de retard' : 'd\'avance'}). Recale le plan pour repartir de tes soldes réels.`, `<button class="btn petit" data-action="recaler" data-mois="${dernier}">Recaler le plan</button>`]);
      }
    }
    return liste;
  }
  const htmlAlertes = (liste) => (liste.length ? `<ul class="alertes">${liste.map(([cl, t, txt, b]) => `<li class="alerte ${cl}"><span class="etiquette ${cl}">${t}</span><p>${txt}</p>${b || ''}</li>`).join('')}</ul>` : '');

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const avertissement = () => `<p class="avertissement">${esc(B.avertissement)}</p>`;

  function choixMethode() {
    return `<div class="segment" role="radiogroup" aria-label="Méthode de remboursement">${B.methodes.map((m) => `<button type="button" role="radio" aria-checked="${E.methode === m.id}" data-action="methode" data-id="${m.id}" style="--c:${m.couleur}"><i></i>${esc(m.nom)}</button>`).join('')}</div>`;
  }

  // Soldes réels (pointage) jusqu'au dernier mois entièrement ou partiellement pointé avant le mois courant.
  function serieReelle(sim) {
    if (!sim.ok || !E.paiements.length) return [];
    const dernier = R.dernierMoisPointe(sim, E.paiements);
    if (!dernier) return [];
    return R.suiviReel(E.dettes, E.paiements, E.debut, dernier < moisCourant() ? dernier : R.ajoutMois(moisCourant(), -1));
  }

  // ---------- Plan ----------
  function vuePlan() {
    if (!E.dettes.length) return videDettes();
    const sim = plan();
    const t = moisCourant();
    const m = methodeDe(E.methode);
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const capitalDepart = E.dettes.reduce((s, d) => s + d.capital, 0);
    let titre, sous;
    if (!sim.ok) { titre = `${salut}Ton budget ne couvre pas les minimums.`; sous = 'Le plan se calcule dès que le budget atteint le total des mensualités minimales.'; }
    else if (sim.nonTermine) { titre = `${salut}Pas de date de fin avec ce budget.`; sous = 'Les intérêts du mois dépassent ce que le budget rembourse : augmente le budget.'; }
    else if (!sim.mois.length) { titre = `${salut}Toutes tes dettes sont soldées.`; sous = 'Bravo. Garde ce budget pour ton épargne.'; }
    else {
      const reste = Math.max(0, R.ecartMois(t, sim.fin) + 1);
      titre = `${salut}Libre de dettes en <mark>${lm(sim.fin)}</mark>.`;
      sous = `${sim.fin < t ? 'Plan terminé' : `Dans ${R.dureeTexte(reste)}`} · ${eurR(sim.totalInterets)} d'intérêts sur tout le plan · ${eur(E.budget)} par mois`;
    }
    const reel = serieReelle(sim);
    const dernierReel = reel.at(-1);
    const resteDu = dernierReel ? dernierReel.total : capitalDepart;
    const dejaPaye = E.paiements.filter((p) => p.mois >= E.debut).reduce((s, p) => s + p.montant, 0);
    const soldeesN = sim.ok ? Object.values(sim.soldees).filter((x) => x === null || x < t).length : 0;
    const interetsRestants = sim.ok ? sim.mois.filter((x) => x.mois >= t).reduce((s, x) => s + x.interets, 0) : 0;
    const tuiles = [
      ['Reste à rembourser', eurR(resteDu), dernierReel ? `fin ${lm(dernierReel.mois)}, d'après ton pointage` : `au départ du plan (${lm(E.debut)})`, 'var(--rouge)', ''],
      ['Déjà remboursé', eurR(dejaPaye), `depuis ${lm(E.debut)}`, 'var(--bleu)', 'rond'],
      ['Intérêts à venir', sim.ok && !sim.nonTermine ? eurR(interetsRestants) : '–', `d'ici la fin, méthode ${m.nom.toLowerCase()}`, 'var(--jaune)', ''],
      ['Dettes soldées', `${soldeesN}<small>/ ${E.dettes.length}</small>`, soldeesN ? 'bravo, continue' : 'la première arrive vite', 'var(--encre)', 'rond'],
    ].map(([l, v, s, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${l}</p><b>${v}</b><span>${s}</span></div>`).join('');
    return `
      <section class="plan-tete">
        <div>
          <p class="surtitre">Plan · ${esc(m.nom)}</p>
          <h1>${titre}</h1>
          <p class="sous">${sous}</p>
          ${choixMethode()}
          <p class="regle">${esc(m.regle)} ${esc(m.detail)}</p>
        </div>
        ${sim.ok ? carteMois(sim, t) : ''}
      </section>
      ${htmlAlertes(alertes(sim))}
      <div class="tuiles">${tuiles}</div>
      ${sim.ok && sim.mois.length ? `
      <h2 class="titre-section">Solde restant <span>Total de toutes tes dettes, mois par mois</span></h2>
      ${graphiquePlan(sim, reel)}
      <h2 class="titre-section">Ordre de remboursement <span>Chaque dette et le mois où elle sera soldée</span></h2>
      ${ordreRemboursement(sim, reel)}` : ''}
      <p class="lien-calcul"><button class="btn lien" data-action="calcul">Comment c'est calculé ?</button></p>
      ${avertissement()}`;
  }

  function videDettes() {
    return `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune dette saisie</h3><p>Ajoute ta première dette avec ce qu'il reste à rembourser, son taux et sa mensualité minimale.</p><div class="actions"><button class="btn primaire" data-action="dette-nouvelle">${ICONES.plus}Ajouter une dette</button></div></div></div>`;
  }

  // Ce qu'il faut payer ce mois-ci, dette par dette (premier mois du plan si le plan commence plus tard).
  function carteMois(sim, t) {
    const mois = sim.mois.find((x) => x.mois >= t)?.mois;
    if (!mois) return '';
    const ligne = sim.mois.find((x) => x.mois === mois);
    const cible = sim.ordre.find((id) => ligne.lignes[id] && ligne.lignes[id].paye > (E.dettes.find((d) => d.id === id)?.mensualite || 0));
    const lignes = Object.entries(ligne.lignes).filter(([, l]) => l.paye > 0).map(([id, l]) => {
      const d = E.dettes.find((x) => x.id === id);
      const fait = R.estPointe(E.paiements, mois, id);
      return `<li class="${fait ? 'fait' : ''}">${iconeType(d?.type)}<span><b>${esc(d?.nom || id)}</b>${id === cible ? '<em class="etiquette jaune">priorité</em>' : ''}${l.extra ? `<em class="etiquette bleu">+ ${eurR(l.extra)} versement</em>` : ''}${l.solde === 0 ? '<em class="etiquette vert">soldée ce mois</em>' : ''}</span><b class="montant">${eur(l.paye)}</b>${fait ? '<span class="coche" aria-label="pointé">✓</span>' : ''}</li>`;
    }).join('');
    return `<aside class="carte-mois">
      <p class="surtitre">${mois === t ? 'Ce mois-ci' : `Premier mois · ${lm(mois)}`}</p>
      <ul>${lignes}</ul>
      <div class="carte-mois-pied"><span>Total <b>${eur(ligne.paye)}</b></span><button class="btn petit primaire" data-action="pointer-mois" data-mois="${mois}">Pointer</button></div>
    </aside>`;
  }

  function ordreRemboursement(sim, reel) {
    const dernier = reel.at(-1);
    const rang = sim.ordre;
    const dettes = [...E.dettes].sort((a, b) => {
      const fa = sim.soldees[a.id], fb = sim.soldees[b.id];
      if (fa === null) return -1; if (fb === null) return 1;
      return String(fa).localeCompare(String(fb)) || rang.indexOf(a.id) - rang.indexOf(b.id);
    });
    const t = moisCourant();
    return `<ol class="ordre">${dettes.map((d, i) => {
      const fin = sim.soldees[d.id];
      const restant = dernier ? dernier.soldes[d.id] : d.capital;
      const depart = d.capital || 1;
      const part = Math.max(0, Math.min(100, Math.round((1 - restant / depart) * 100)));
      const soldee = fin === null || (fin && fin < t) || restant === 0;
      return `<li class="${soldee ? 'soldee' : ''}">
        <span class="rang">${i + 1}</span>
        <div class="ordre-info"><b>${iconeType(d.type)}${esc(d.nom)}</b><span>${esc(typeDe(d.type).court)} · ${R.tauxTexte(d.taux)} · ${eur(d.mensualite)} par mois</span>
          <div class="progression" role="img" aria-label="${part} % remboursé"><i style="width:${part}%"></i></div></div>
        <div class="ordre-fin"><b>${fin === null ? 'Soldée' : soldee ? 'Soldée' : lmMaj(fin)}</b><span>${fin === null ? 'avant le plan' : `${eurR(sim.interetsParDette[d.id])} d'intérêts`}</span></div>
      </li>`;
    }).join('')}</ol>`;
  }

  // ---------- Graphiques (SVG, une seule échelle, survol et clavier) ----------
  function pasRond(etendue) {
    const brut = etendue / 4;
    const p = 10 ** Math.floor(Math.log10(Math.max(brut, 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= brut) || p * 10;
  }
  const kEur = (c) => { const e = c / 100; return Math.abs(e) >= 10000 ? `${String(Math.round(e / 100) / 10).replace('.', ',')} k€` : eurR(c); };
  const graphes = new Map();

  // series : [{ id, nom, couleur, valeurs: Map(mois → centimes), style: 'ligne' | 'points', aire, finLabel }]
  function graphique(id, mois, series, { titreAria, note = '' } = {}) {
    const L = Math.round(Math.min(1148, Math.max(300, document.documentElement.clientWidth - (estTel() ? 44 : 100))));
    const petit = L < 560;
    const H = petit ? 240 : 320, g = petit ? 56 : 68, d = petit ? 18 : 64, h = 18, b = 30;
    const n = mois.length;
    const toutes = series.flatMap((s) => mois.map((m) => s.valeurs.get(m)).filter((v) => v !== undefined));
    const max = Math.max(1, ...toutes);
    const pas = pasRond(max);
    const haut = Math.ceil(max / pas) * pas;
    const hz = H - h - b;
    const y = (v) => h + hz - (v / haut) * hz;
    const x = (i) => (n <= 1 ? g : g + ((L - g - d) * i) / (n - 1));
    const grilles = [];
    for (let v = 0; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${kEur(v)}</text>`);
    // Étiquettes de l'axe des mois : comptées depuis la fin, espacées selon la place.
    const place = petit ? 64 : 84;
    const tous = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((L - g - d) / place))));
    const axeX = mois.map((m, i) => ((n - 1 - i) % tous === 0 ? `<text class="axe" x="${x(i)}" y="${H - 8}" text-anchor="middle">${MOIS_COURTS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}</text>` : '')).join('');
    const traces = series.map((s) => {
      const pts = mois.map((m, i) => (s.valeurs.has(m) ? [x(i), y(s.valeurs.get(m))] : null));
      const segments = [];
      let cur = [];
      for (const p of pts) { if (p) cur.push(p); else if (cur.length) { segments.push(cur); cur = []; } }
      if (cur.length) segments.push(cur);
      if (s.style === 'points') return pts.filter(Boolean).map(([px, py]) => `<circle class="pt" cx="${px}" cy="${py}" r="4.5" fill="${s.couleur}"/>`).join('');
      return segments.map((seg) => `${s.aire ? `<path class="aire" fill="${s.couleur}" d="M${seg[0][0]},${y(0)}L${seg.map((p) => p.join(',')).join('L')}L${seg.at(-1)[0]},${y(0)}Z"/>` : ''}<path class="ligne" stroke="${s.couleur}" d="M${seg.map((p) => p.join(',')).join('L')}"/>`).join('');
    }).join('');
    // Étiquettes directes en bout de ligne, seulement si elles ne se chevauchent pas.
    const posees = [];
    const etiquettes = series.filter((s) => s.finLabel).map((s) => {
      const i = mois.findIndex((m) => m === s.finMois);
      if (i < 0) return '';
      const px = x(i), py = y(s.valeurs.get(s.finMois) ?? 0);
      if (posees.some(([a, c]) => Math.abs(a - px) < 90 && Math.abs(c - py) < 30)) return `<circle class="pt" cx="${px}" cy="${py}" r="4.5" fill="${s.couleur}"/>`;
      posees.push([px, py]);
      const ancre = px > L - d - 70 ? 'end' : 'middle';
      return `<circle class="pt" cx="${px}" cy="${py}" r="4.5" fill="${s.couleur}"/><text class="valeur" x="${px}" y="${py - 12}" text-anchor="${ancre}">${esc(s.finLabel)}</text>`;
    }).join('');
    graphes.set(id, { mois, series, x, y, L, H, h, b });
    const legende = series.length > 1 ? `<div class="legende">${series.map((s) => `<span><i class="${s.style === 'points' ? 'cle-point' : 'cle-ligne'}" style="--c:${s.couleur}"></i>${esc(s.nom)}</span>`).join('')}</div>` : '';
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">${esc(titreAria)}</caption><thead><tr><th scope="col">Mois</th>${series.map((s) => `<th scope="col" class="nb">${esc(s.nom)}</th>`).join('')}</tr></thead><tbody>${mois.map((m) => `<tr><th scope="row">${lmMaj(m)}</th>${series.map((s) => `<td class="nb">${s.valeurs.has(m) ? eur(s.valeurs.get(m)) : '–'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    return `<figure class="graphique" id="${id}" tabindex="0" aria-label="${esc(titreAria)} : flèches gauche et droite pour lire chaque mois">
      ${legende}
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(titreAria)} ; détail dans le tableau">${grilles.join('')}${traces}${etiquettes}${axeX}<line class="repere" x1="0" x2="0" y1="${h}" y2="${H - b}" visibility="hidden"/><g class="reperes-pts"></g><rect class="zone-survol" x="${g}" y="0" width="${L - g - d}" height="${H - b}"/></svg>
      <div class="infobulle" hidden></div>
      ${note ? `<figcaption class="note">${note}</figcaption>` : ''}
      ${table}
    </figure>`;
  }

  function brancherGraphiques() {
    for (const [id, G] of graphes) {
      const fig = document.getElementById(id);
      if (!fig) { graphes.delete(id); continue; }
      const svg = fig.querySelector('svg');
      const bulle = fig.querySelector('.infobulle');
      const repere = fig.querySelector('.repere');
      const pts = fig.querySelector('.reperes-pts');
      let courant = -1;
      const montrer = (i) => {
        i = Math.max(0, Math.min(G.mois.length - 1, i));
        courant = i;
        const m = G.mois[i];
        const px = G.x(i);
        repere.setAttribute('x1', px); repere.setAttribute('x2', px); repere.setAttribute('visibility', 'visible');
        pts.innerHTML = G.series.filter((s) => s.valeurs.has(m)).map((s) => `<circle class="pt actif" cx="${px}" cy="${G.y(s.valeurs.get(m))}" r="5" fill="${s.couleur}"/>`).join('');
        bulle.textContent = '';
        const t = document.createElement('b'); t.textContent = lmMaj(m); bulle.appendChild(t);
        for (const s of G.series) {
          if (!s.valeurs.has(m)) continue;
          const l = document.createElement('div'); l.className = 'ligne-bulle';
          const k = document.createElement('i'); k.style.background = s.couleur; l.appendChild(k);
          const v = document.createElement('strong'); v.textContent = eur(s.valeurs.get(m)); l.appendChild(v);
          const nm = document.createElement('span'); nm.textContent = s.nom; l.appendChild(nm);
          bulle.appendChild(l);
        }
        bulle.hidden = false;
        const rs = svg.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        const ech = rs.width / G.L;
        let gx = rs.left - rf.left + px * ech + 14;
        if (gx + bulle.offsetWidth > rf.width - 8) gx = rs.left - rf.left + px * ech - bulle.offsetWidth - 14;
        bulle.style.left = `${Math.max(8, gx)}px`;
        bulle.style.top = `${rs.top - rf.top + 8}px`;
      };
      const cacher = () => { bulle.hidden = true; repere.setAttribute('visibility', 'hidden'); pts.innerHTML = ''; courant = -1; };
      const versIndex = (e) => {
        const rs = svg.getBoundingClientRect();
        const vx = ((e.clientX - rs.left) / rs.width) * G.L;
        let best = 0, dist = Infinity;
        G.mois.forEach((_, i) => { const dd = Math.abs(G.x(i) - vx); if (dd < dist) { dist = dd; best = i; } });
        return best;
      };
      const zone = fig.querySelector('.zone-survol');
      zone.addEventListener('pointermove', (e) => montrer(versIndex(e)));
      zone.addEventListener('pointerdown', (e) => montrer(versIndex(e)));
      fig.addEventListener('pointerleave', cacher);
      fig.addEventListener('blur', cacher);
      fig.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); montrer(courant < 0 ? (e.key === 'ArrowRight' ? 0 : G.mois.length - 1) : courant + (e.key === 'ArrowRight' ? 1 : -1)); }
        if (e.key === 'Escape') cacher();
      });
    }
  }

  const serieDe = (sim) => new Map([[R.ajoutMois(sim.debut, -1), sim.mois.length ? sim.mois[0].totalSolde + sim.mois[0].paye - sim.mois[0].interets : 0], ...sim.mois.map((m) => [m.mois, m.totalSolde])]);

  function graphiquePlan(sim, reel) {
    const m = methodeDe(E.methode);
    const min = R.simuler(E.dettes, optsPlan(E, 'minimums'));
    const depart = R.ajoutMois(E.debut, -1);
    const finPlan = sim.fin;
    // Domaine : jusqu'à la fin du plan, prolongé pour montrer le repère « minimums » sans l'écraser.
    const finMin = min.nonTermine ? min.mois.at(-1).mois : min.fin;
    const finDomaine = [finPlan, finMin, R.ajoutMois(depart, Math.max(12, Math.round((R.ecartMois(depart, finPlan) + 1) * 1.6)))].sort()[1];
    const mois = Array.from({ length: R.ecartMois(depart, finDomaine) + 1 }, (_, i) => R.ajoutMois(depart, i));
    const coupe = (mp) => new Map([...mp].filter(([k]) => k <= finDomaine));
    const vMin = coupe(serieDe(min));
    const series = [
      { id: 'plan', nom: `Plan · ${m.nom}`, couleur: m.couleur, valeurs: serieDe(sim), aire: true, finMois: finPlan, finLabel: `Fin ${lm(finPlan, true)}` },
      { id: 'min', nom: 'Minimums seuls', couleur: B.minimums.couleur, valeurs: vMin },
    ];
    if (reel.length) series.push({ id: 'reel', nom: 'Réel pointé', couleur: '#24221F', style: 'points', valeurs: new Map([[depart, series[0].valeurs.get(depart)], ...reel.map((r) => [r.mois, r.total])]) });
    const bloquees = E.dettes.filter((d) => d.capital > 0 && !R.couvreInterets(d).ok).map((d) => d.nom);
    const note = `Point de départ : ${eur(series[0].valeurs.get(depart))} début ${lm(E.debut)}. Avec les minimums seuls, ${min.nonTermine ? `la fin n'arrive jamais${bloquees.length ? ` (${bloquees.join(', ')} ne baisse jamais)` : ''}` : `fin ${lm(min.fin)}${finMin > finDomaine ? ' (hors du graphique)' : ''} et ${eurR(min.totalInterets)} d'intérêts`}.${reel.length ? ` Points noirs : soldes réels d'après ton pointage, jusqu'à ${lm(reel.at(-1).mois)}.` : ''}`;
    return graphique('g-plan', mois, series, { titreAria: 'Solde restant de toutes les dettes, plan face aux minimums seuls et au réel pointé', note });
  }

  // ---------- Échéancier ----------
  let detailOuvert = new Set();
  function vueEcheancier() {
    if (!E.dettes.length) return videDettes();
    const sim = plan();
    const m = methodeDe(E.methode);
    if (!sim.ok || sim.nonTermine) return `<div class="vue-tete"><div><h1>Échéancier</h1></div></div>${htmlAlertes(alertes(sim))}`;
    const t = moisCourant();
    const nom = (id) => E.dettes.find((d) => d.id === id)?.nom || id;
    const evenements = (x) => {
      const ev = [];
      for (const [id, l] of Object.entries(x.lignes)) if (l.solde === 0) ev.push(`<span class="etiquette vert">${esc(nom(id))} soldée</span>`);
      if (x.extra) ev.push(`<span class="etiquette bleu">Versement ${eurR(x.extra)}</span>`);
      return ev.join('');
    };
    const lignes = sim.mois.map((x) => {
      const ouvert = detailOuvert.has(x.mois);
      const detail = ouvert ? `<tr class="detail"><td colspan="6"><table class="sous-tableau"><thead><tr><th>Dette</th><th class="nb">Début</th><th class="nb">Intérêts</th><th class="nb">Paiement</th><th class="nb">Capital</th><th class="nb">Fin</th></tr></thead><tbody>${Object.entries(x.lignes).map(([id, l]) => `<tr><td>${esc(nom(id))}${l.extra ? ` <small>dont ${eur(l.extra)} versement</small>` : ''}</td><td class="nb">${eur(l.avant)}</td><td class="nb">${eur(l.interet)}</td><td class="nb">${eur(l.paye)}</td><td class="nb">${eur(l.capital)}</td><td class="nb">${eur(l.solde)}</td></tr>`).join('')}</tbody></table></td></tr>` : '';
      return `<tr class="${x.mois === t ? 'courant' : ''} ${x.mois < t ? 'passe' : ''}"><th scope="row"><button class="deplier" data-action="deplier" data-mois="${x.mois}" aria-expanded="${ouvert}">${ouvert ? '−' : '+'}</button>${lmMaj(x.mois)}${x.mois === t ? ' <small>ce mois-ci</small>' : ''}</th><td class="nb">${eur(x.paye)}</td><td class="nb">${eur(x.interets)}</td><td class="nb">${eur(x.paye - x.interets)}</td><td class="nb"><b>${eur(x.totalSolde)}</b></td><td class="col-evts"><div class="evts">${evenements(x)}</div></td></tr>${detail}`;
    }).join('');
    return `
      <div class="vue-tete">
        <div><h1>Échéancier</h1><p>${pluriel(sim.duree, 'mois', 'mois')} de ${lm(sim.debut)} à ${lm(sim.fin)} · méthode ${esc(m.nom.toLowerCase())} · ${eur(sim.totalPaye)} payés dont ${eur(sim.totalInterets)} d'intérêts.</p></div>
        <div class="actions"><button class="btn" data-action="copier">Copier le résumé</button><button class="btn" data-action="csv">Exporter (CSV)</button><button class="btn" data-action="imprimer">Imprimer</button></div>
      </div>
      <div class="defile"><table class="tableau echeancier">
        <thead><tr><th scope="col">Mois</th><th scope="col" class="nb">Paiement</th><th scope="col" class="nb">Intérêts</th><th scope="col" class="nb">Capital remboursé</th><th scope="col" class="nb">Reste dû</th><th scope="col">Événements</th></tr></thead>
        <tbody>${lignes}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${eur(sim.totalPaye)}</td><td class="nb">${eur(sim.totalInterets)}</td><td class="nb">${eur(sim.totalPaye - sim.totalInterets)}</td><td></td><td></td></tr></tfoot>
      </table></div>
      <p class="astuce">Touche « + » pour le détail de chaque dette. ${sim.inutilise ? `Le dernier mois, ${eur(sim.inutilise)} du budget restent libres.` : ''}</p>
      ${blocCalcul()}
      ${avertissement()}`;
  }

  const blocCalcul = () => `<details class="calcul"><summary>Comment c'est calculé</summary><ol>${B.calcul.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></details>`;

  function resumeTexte() {
    const sim = plan();
    const m = methodeDe(E.methode);
    if (!sim.ok || sim.nonTermine) return 'Plan non calculable avec ce budget.';
    const nom = (id) => E.dettes.find((d) => d.id === id)?.nom || id;
    return [
      `Plan de remboursement · ${m.nom}`,
      `Budget : ${eur(E.budget)} par mois, à partir de ${lm(E.debut)}`,
      `Fin prévue : ${lm(sim.fin)} (${R.dureeTexte(sim.duree)})`,
      `Intérêts sur tout le plan : ${eur(sim.totalInterets)}`,
      '',
      'Ordre de remboursement :',
      ...sim.ordre.map((id, i) => `${i + 1}. ${nom(id)} : soldée en ${lm(sim.soldees[id])}`),
      '',
      'Estimation au calcul mensuel simple (taux annuel ÷ 12) ; ne remplace pas un conseil professionnel.',
    ].join('\n');
  }

  // ---------- Dettes ----------
  function vueDettes() {
    const sim = plan();
    const min = R.totalMinimums(E.dettes);
    const total = E.dettes.reduce((s, d) => s + d.capital, 0);
    const surplus = E.budget - min;
    const ordrePerso = R.ordrePriorite(E.dettes, 'perso', E.ordre);
    const cartes = E.dettes.map((d) => {
      const c = R.couvreInterets(d);
      const fin = sim.ok ? sim.soldees[d.id] : undefined;
      return `<li class="carte-dette">
        <button class="carte-dette-corps" data-action="dette" data-id="${d.id}">
          <span class="type-ligne">${iconeType(d.type)}${esc(typeDe(d.type).nom)}</span>
          <b>${esc(d.nom)}</b>
          <span class="chiffres"><span><small>Reste dû</small>${eur(d.capital)}</span><span><small>Taux</small>${R.tauxTexte(d.taux)}</span><span><small>Minimum</small>${eur(d.mensualite)}</span></span>
          <span class="pied">${d.capital === 0 ? 'Soldée' : `Intérêts du 1er mois : ${eur(c.interet)}${fin ? ` · soldée en ${lm(fin)}` : ''}`}</span>
        </button>
        ${!c.ok && d.capital > 0 ? `<p class="manque">${ICONES.alerte}<span>La mensualité ne couvre pas les intérêts : il manque au moins ${eur(c.manque)} par mois.</span></p>` : ''}
      </li>`;
    }).join('');
    return `
      <div class="vue-tete">
        <div><h1>Tes dettes</h1><p>${pluriel(E.dettes.length, 'dette')} · ${eur(total)} au départ du plan (${lm(E.debut)}) · minimums ${eur(min)} par mois.</p></div>
        <div class="actions"><button class="btn primaire" data-action="dette-nouvelle">${ICONES.plus}Dette</button></div>
      </div>
      <section class="budget-carte">
        <div><p class="surtitre">Budget mensuel</p><b>${eur(E.budget)}</b><span>${surplus >= 0 ? `${eur(min)} de minimums + <b>${eur(surplus)}</b> de surplus qui accélère le plan` : `<b class="negatif">Il manque ${eur(-surplus)}</b> pour couvrir les minimums`}</span></div>
        <div class="jauge-budget" role="img" aria-label="Minimums ${eur(min)}, surplus ${eur(Math.max(0, surplus))}"><i style="width:${E.budget ? Math.min(100, (min / Math.max(E.budget, min)) * 100) : 100}%"></i></div>
        <button class="btn" data-action="budget">Modifier le budget</button>
      </section>
      ${E.dettes.length ? `<ul class="cartes-dettes">${cartes}</ul>` : videDettes()}
      ${E.dettes.length > 1 ? `
      <h2 class="titre-section">Ordre personnalisé <span>Utilisé par la méthode « Ordre personnalisé » : le surplus va à la première dette non soldée.</span></h2>
      <ol class="ordre-perso">${ordrePerso.map((id, i) => { const d = E.dettes.find((x) => x.id === id); return `<li><span class="rang">${i + 1}</span><b>${esc(d.nom)}</b><span class="discret">${R.tauxTexte(d.taux)} · ${eur(d.capital)}</span><span class="fleches"><button class="btn-icone" data-action="monter" data-id="${id}" aria-label="Monter ${esc(d.nom)}" ${i === 0 ? 'disabled' : ''}>${ICONES.haut}</button><button class="btn-icone" data-action="descendre" data-id="${id}" aria-label="Descendre ${esc(d.nom)}" ${i === ordrePerso.length - 1 ? 'disabled' : ''}>${ICONES.bas}</button></span></li>`; }).join('')}</ol>
      <div class="rang-boutons"><button class="btn petit" data-action="ordre-depuis" data-id="boule">Partir de la boule de neige</button><button class="btn petit" data-action="ordre-depuis" data-id="avalanche">Partir de l'avalanche</button>${E.methode !== 'perso' ? '<button class="btn petit" data-action="methode" data-id="perso">Utiliser cet ordre</button>' : ''}</div>` : ''}
      <h2 class="titre-section">Où trouver les chiffres</h2>
      <ul class="aides-types">${[...new Set(E.dettes.map((d) => d.type))].map((id) => { const t = typeDe(id); return `<li>${iconeType(id)}<div><b>${esc(t.nom)}</b><p>${esc(t.ou)}</p><p class="discret">${esc(t.attention)}</p></div></li>`; }).join('')}</ul>
      ${avertissement()}`;
  }

  // ---------- Comparer ----------
  function vueComparer() {
    if (!E.dettes.length) return videDettes();
    const c = R.comparer(E.dettes, optsPlan());
    const ok = c.boule.ok;
    const t = moisCourant();
    const finOu = (s) => (s.nonTermine ? 'jamais' : lm(s.fin));
    const premiere = (s) => { const v = Object.values(s.soldees).filter(Boolean).sort()[0]; return v ? lm(v) : '–'; };
    const ref = c.minimums;
    const lignes = [...B.methodes.map((m) => [m, c[m.id]]), [B.minimums, ref]].map(([m, s]) => {
      const gain = m.id === 'minimums' ? 'repère' : s.nonTermine ? '–' : ref.nonTermine ? 'finit, quand les minimums seuls ne finissent jamais' : `${R.dureeTexte(ref.duree - s.duree)} plus tôt, ${eurR(ref.totalInterets - s.totalInterets)} d'intérêts en moins`;
      return `<tr class="${E.methode === m.id ? 'choisie' : ''}"><th scope="row"><span class="nom-methode"><i style="--c:${m.couleur}" class="${m.id === 'minimums' ? 'cle-ligne' : 'cle-ligne'}"></i>${esc(m.nom)}</span></th><td>${finOu(s)}</td><td class="nb">${s.nonTermine ? '–' : R.dureeTexte(s.duree)}</td><td class="nb">${s.nonTermine ? '–' : eur(s.totalInterets)}</td><td>${premiere(s)}</td><td class="gain">${gain}</td><td>${m.id === 'minimums' ? '' : E.methode === m.id ? '<span class="etiquette">Ton plan</span>' : `<button class="btn petit" data-action="methode" data-id="${m.id}">Choisir</button>`}</td></tr>`;
    }).join('');
    let graph = '';
    if (ok) {
      const depart = R.ajoutMois(E.debut, -1);
      const fins = B.methodes.map((m) => c[m.id]).filter((s) => !s.nonTermine).map((s) => s.fin);
      const finRef = ref.nonTermine ? null : ref.fin;
      const maxPlan = fins.sort().at(-1) || R.ajoutMois(depart, 24);
      const finDomaine = finRef && finRef < R.ajoutMois(depart, Math.round((R.ecartMois(depart, maxPlan) + 1) * 1.6)) ? finRef : R.ajoutMois(depart, Math.max(12, Math.round((R.ecartMois(depart, maxPlan) + 1) * 1.6)));
      const mois = Array.from({ length: R.ecartMois(depart, finDomaine) + 1 }, (_, i) => R.ajoutMois(depart, i));
      const coupe = (mp) => new Map([...mp].filter(([k]) => k <= finDomaine));
      const series = [...B.methodes.map((m) => ({ id: m.id, nom: m.nom, couleur: m.couleur, valeurs: coupe(serieDe(c[m.id])), finMois: c[m.id].fin, finLabel: c[m.id].fin ? lm(c[m.id].fin, true) : '' })),
        { id: 'minimums', nom: B.minimums.nom, couleur: B.minimums.couleur, valeurs: coupe(serieDe(ref)) }];
      graph = graphique('g-comparer', mois, series, { titreAria: 'Solde restant selon la méthode', note: `Même budget (${eur(E.budget)} par mois) et mêmes versements pour les trois méthodes.${!finRef || finRef > finDomaine ? ` Minimums seuls : fin ${finRef ? lm(finRef) : 'jamais atteinte'}, hors du graphique.` : ''}` });
    }
    const effet = R.effetVersements(E.dettes, optsPlan());
    const nom = (id) => E.dettes.find((d) => d.id === id)?.nom;
    const versements = [...E.versements].sort((a, b) => a.mois.localeCompare(b.mois));
    // Simulation d'un versement en plus, sans l'enregistrer.
    const mEssai = R.estMois(essai.mois) ? essai.mois : R.ajoutMois(t, 1);
    const montantEssai = R.versCentimes(essai.montant);
    let resultatEssai = '<p class="discret">Saisis un montant pour voir l\'effet.</p>';
    if (montantEssai && ok) {
      const opts = optsPlan();
      const avec = R.simuler(E.dettes, { ...opts, versements: [...E.versements, { id: 'essai', mois: mEssai, montant: montantEssai, detteId: null }] });
      const base = R.simuler(E.dettes, opts);
      if (!avec.nonTermine && !base.nonTermine) {
        const gm = base.duree - avec.duree;
        resultatEssai = `<p class="resultat-essai"><b>${eurR(base.totalInterets - avec.totalInterets)}</b> d'intérêts en moins et une fin ${gm > 0 ? `<b>${R.dureeTexte(gm)} plus tôt</b> (${lm(avec.fin)})` : `au même mois (${lm(avec.fin)})`}.</p><button class="btn petit" data-action="essai-ajouter">Ajouter ce versement au plan</button>`;
      }
    }
    return `
      <div class="vue-tete"><div><h1>Comparer les méthodes</h1><p>Même budget, mêmes dettes : seule change la dette qui reçoit le surplus. Ton plan suit la méthode choisie.</p></div></div>
      ${ok ? '' : htmlAlertes(alertes(c.boule))}
      ${graph}
      <div class="defile"><table class="tableau comparaison">
        <thead><tr><th scope="col">Méthode</th><th scope="col">Fin</th><th scope="col" class="nb">Durée</th><th scope="col" class="nb">Intérêts</th><th scope="col">1re dette soldée</th><th scope="col">Face aux minimums seuls</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
        <tbody>${lignes}</tbody></table></div>
      <h2 class="titre-section">Versements exceptionnels <span>Prime, remboursement, vente : une somme en plus, un mois donné.</span></h2>
      <div class="deux-colonnes">
        <section class="bloc">
          ${versements.length ? `<ul class="versements">${versements.map((v) => `<li class="${v.mois < E.debut ? 'hors' : ''}"><button class="ligne-info" data-action="versement" data-id="${v.id}"><span class="h">${lmMaj(v.mois)}${v.mois < t ? ' · passé' : ''}</span><b>${eur(v.montant)}${v.note ? ` · ${esc(v.note)}` : ''}</b><span>${v.detteId ? `sur ${esc(nom(v.detteId) || 'une dette supprimée')}` : 'sur la dette prioritaire'}${v.mois < E.debut ? ' · avant le départ du plan, ignoré' : ''}</span></button></li>`).join('')}</ul>` : '<p class="discret">Aucun versement exceptionnel prévu.</p>'}
          <div class="rang-boutons"><button class="btn primaire petit" data-action="versement-nouveau">${ICONES.plus}Versement</button></div>
          ${effet && effet.total ? `<p class="effet">Effet de tes versements (${eur(effet.total)}) : <b>${eurR(effet.interetsEconomises)}</b> d'intérêts en moins${effet.moisGagnes ? ` et une fin <b>${R.dureeTexte(effet.moisGagnes)} plus tôt</b>` : ''}.</p>` : ''}
        </section>
        <section class="bloc essai">
          <h3>Et si je versais…</h3>
          <div class="rang-champs"><label class="champ">Montant<input id="essai-montant" inputmode="decimal" placeholder="500" value="${esc(essai.montant)}"></label><label class="champ">En<input id="essai-mois" type="month" value="${mEssai}" min="${E.debut}"></label></div>
          <div id="essai-resultat">${resultatEssai}</div>
        </section>
      </div>
      <h2 class="titre-section">Les méthodes en bref</h2>
      <ul class="methodes">${[...B.methodes, B.minimums].map((m) => `<li style="--c:${m.couleur}"><i></i><div><b>${esc(m.nom)}</b><p>${esc(m.detail)}</p></div></li>`).join('')}</ul>
      <h2 class="titre-section">Conseils</h2>
      <ol class="conseils">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>
      <h2 class="titre-section">Petit glossaire</h2>
      <dl class="glossaire">${B.glossaire.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      ${blocCalcul()}
      ${avertissement()}`;
  }

  // ---------- Pointage ----------
  function vuePointage() {
    if (!E.dettes.length) return videDettes();
    const sim = plan();
    if (!sim.ok || sim.nonTermine) return `<div class="vue-tete"><div><h1>Pointage</h1></div></div>${htmlAlertes(alertes(sim))}`;
    const t = moisCourant();
    const M = moisPointage < E.debut ? E.debut : moisPointage;
    const prevu = R.prevuDuMois(sim, M);
    const lignes = E.dettes.map((d) => {
      const p = E.paiements.filter((x) => x.mois === M && x.detteId === d.id);
      const paye = p.reduce((s, x) => s + x.montant, 0);
      const pv = prevu[d.id] || 0;
      if (!pv && !p.length) return '';
      let droite;
      if (p.length) {
        const ec = paye - pv;
        droite = `<span class="etiquette ${paye === 0 ? 'rouge' : ec < 0 ? 'jaune' : 'bleu'}">${paye === 0 ? 'Pas payé' : ec === 0 ? 'Comme prévu' : ec < 0 ? `${eur(-ec)} de moins` : `${eur(ec)} de plus`}</span><b class="montant">${eur(paye)}</b><button class="btn lien" data-action="paiement-modifier" data-id="${d.id}" data-mois="${M}">Changer</button>`;
      } else if (M > t) {
        droite = '<span class="a-venir">À venir</span>';
      } else {
        droite = `<div class="marques" role="group" aria-label="Pointer ${esc(d.nom)}"><button class="mq mq-fait" data-action="payer" data-id="${d.id}" data-mois="${M}">Payé ${eur(pv)}</button><button class="mq" data-action="paiement-modifier" data-id="${d.id}" data-mois="${M}">Autre montant</button><button class="mq mq-pasfait" data-action="pas-paye" data-id="${d.id}" data-mois="${M}">Pas payé</button></div>`;
      }
      return `<li class="ligne-pointage ${p.length ? 'pointee' : ''}"><div class="ligne-info"><span class="h">${iconeType(d.type)}${esc(typeDe(d.type).court)}</span><b>${esc(d.nom)}</b><span>Prévu ${eur(pv)}</span></div><div class="ligne-droite">${droite}</div></li>`;
    }).join('');
    const totalPrevu = Object.values(prevu).reduce((a, b) => a + b, 0);
    const duMois = E.paiements.filter((x) => x.mois === M);
    const totalPaye = duMois.reduce((s, x) => s + x.montant, 0);
    const prevuPointe = [...new Set(duMois.map((x) => x.detteId))].reduce((s, id) => s + (prevu[id] || 0), 0);
    const restePointer = Object.entries(prevu).filter(([id, v]) => v > 0 && !R.estPointe(E.paiements, M, id)).length;
    const dernier = R.dernierMoisPointe(sim, E.paiements);
    const historique = dernier ? R.ecartPlan(E.dettes, sim, E.paiements, dernier) : [];
    const incomplets = R.moisAPointer(sim, E.paiements, R.ajoutMois(t, 1)).filter((x) => !dernier || x.mois > dernier)
      .filter((x) => E.paiements.some((p) => p.mois === x.mois));
    const avant = E.paiements.filter((p) => p.mois < E.debut);
    return `
      <div class="vue-tete">
        <div><h1>Pointage · ${lm(M)}</h1><p>Note ce que tu as vraiment payé : l'écart au plan apparaît tout de suite.</p></div>
        <div class="actions"><div class="nav-mois">
          <button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent" ${M <= E.debut ? 'disabled' : ''}>${ICONES.gauche}</button>
          <button class="btn petit" data-action="mois-auj">Ce mois-ci</button>
          <button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant">${ICONES.droite}</button>
        </div>${restePointer && M <= t ? `<button class="btn primaire" data-action="tout-payer" data-mois="${M}">Tout payé comme prévu</button>` : ''}</div>
      </div>
      <div class="resume-mois"><span>Prévu <b>${eur(totalPrevu)}</b></span><span>Payé <b>${eur(totalPaye)}</b></span><span>Écart sur les paiements pointés <b class="${totalPaye - prevuPointe < 0 ? 'negatif' : ''}">${eur(totalPaye - prevuPointe, { signe: true })}</b></span><span>${restePointer ? `${pluriel(restePointer, 'paiement')} à pointer` : 'Tout est pointé'}</span></div>
      ${lignes ? `<ul class="lignes-pointage">${lignes}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien de prévu en ${lm(M)}</h3><p>${M > (sim.fin || M) ? 'Ton plan est terminé à cette date.' : 'Aucun paiement prévu ce mois-là.'}</p></div></div>`}
      ${historique.length ? `
      <h2 class="titre-section">Écart au plan <span>Mois entièrement pointés depuis ${lm(E.debut)}</span></h2>
      <div class="defile"><table class="tableau historique">
        <thead><tr><th scope="col">Mois</th><th scope="col" class="nb">Prévu</th><th scope="col" class="nb">Payé</th><th scope="col" class="nb">Écart</th><th scope="col" class="nb">Écart cumulé</th><th scope="col" class="nb">Reste dû prévu</th><th scope="col" class="nb">Reste dû réel</th></tr></thead>
        <tbody>${historique.map((h) => `<tr><th scope="row"><button class="btn lien" data-action="pointer-mois" data-mois="${h.mois}">${lmMaj(h.mois)}</button></th><td class="nb">${eur(h.prevu)}</td><td class="nb">${eur(h.paye)}</td><td class="nb ${h.ecart < 0 ? 'negatif' : ''}">${eur(h.ecart, { signe: true })}</td><td class="nb ${h.cumulEcart < 0 ? 'negatif' : ''}">${eur(h.cumulEcart, { signe: true })}</td><td class="nb">${eur(h.soldePrevu)}</td><td class="nb"><b>${eur(h.soldeReel)}</b></td></tr>`).join('')}</tbody>
      </table></div>
      ${incomplets.length ? `<p class="astuce">Pointage incomplet : ${incomplets.map((x) => `<button class="btn lien" data-action="pointer-mois" data-mois="${x.mois}">${lm(x.mois)}</button> (${pluriel(x.dettes.length, 'paiement')} à pointer)`).join(', ')}. Ces mois entrent dans l'écart une fois tout pointé.</p>` : ''}
      <div class="rang-boutons"><button class="btn" data-action="recaler" data-mois="${historique.at(-1).mois}">Recaler le plan sur le réel</button></div>
      <p class="astuce">Recaler fait repartir le plan du mois suivant le dernier mois pointé, avec tes soldes réels comme nouveau point de départ.</p>` : ''}
      ${avant.length ? `<p class="astuce">${pluriel(avant.length, 'paiement pointé', 'paiements pointés')} avant le départ actuel du plan (${lm(E.debut)}) ${avant.length > 1 ? 'sont gardés' : 'est gardé'} en historique.</p>` : ''}`;
  }

  function pointer(detteId, mois, montant) {
    E.paiements = E.paiements.filter((p) => !(p.mois === mois && p.detteId === detteId));
    E.paiements.push({ id: uid(), mois, detteId, montant });
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
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  // Dette : création ou modification. `dansAccueil` : la dette va dans la liste du premier lancement.
  function modaleDette(id, { type = 'conso', dansAccueil = false } = {}) {
    const liste = dansAccueil ? accueil.dettes : E.dettes;
    const d = liste.find((x) => x.id === id);
    const ty = typeDe(d?.type || type);
    const corps = `
      <fieldset class="champ"><legend>Type</legend><select name="type" id="choix-type">${B.types.map((t) => `<option value="${t.id}" ${t.id === ty.id ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></fieldset>
      <p class="aide" id="aide-type"><b>Où trouver les chiffres :</b> ${esc(ty.ou)}<br>${esc(ty.attention)}</p>
      <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(d?.nom || '')}" placeholder="${esc(ty.nom)}" required></label>
      <div class="rang-champs">
        <label class="champ">Reste à rembourser<small>Capital restant dû, en €</small><input name="capital" inputmode="decimal" value="${esc(R.versSaisie(d?.capital))}" placeholder="2 500" required></label>
        <label class="champ">Taux annuel<small>Taux débiteur, en %</small><input name="taux" inputmode="decimal" value="${d ? String(d.taux).replace('.', ',') : ty.tauxZero ? '0' : ''}" placeholder="7,5" required></label>
        <label class="champ">Mensualité minimale<small>Ce que tu dois payer par mois</small><input name="mensualite" inputmode="decimal" value="${esc(R.versSaisie(d?.mensualite))}" placeholder="120" required></label>
      </div>
      <p class="apercu-interets" id="apercu-interets" aria-live="polite"></p>
      <label class="champ">Note<textarea name="note" maxlength="300" rows="2">${esc(d?.note || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${d ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${d ? '<button class="btn danger gauche" value="suppr" formnovalidate>Supprimer</button>' : ''}`;
    ouvrirModale(d ? 'Modifier la dette' : 'Nouvelle dette', corps, pied, (f, choix) => {
      if (choix === 'suppr') {
        if (dansAccueil) { accueil.dettes = accueil.dettes.filter((x) => x.id !== id); ecranAccueil(); return; }
        retenir();
        E.dettes = E.dettes.filter((x) => x.id !== id);
        E.ordre = E.ordre.filter((x) => x !== id);
        sauver(); rendre();
        toast(`« ${d.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const capital = R.versCentimes(f.get('capital'));
      const taux = R.lireTaux(f.get('taux'));
      const mensualite = R.versCentimes(f.get('mensualite'));
      if (capital === null) return 'Reste à rembourser : saisis un montant, par exemple 2500 ou 2 500,50.';
      if (taux === null) return 'Taux : saisis un pourcentage entre 0 et 100, par exemple 7,5 (0 si sans intérêts).';
      if (mensualite === null || (mensualite === 0 && capital > 0)) return 'Mensualité minimale : saisis le montant à payer chaque mois (au moins 1 €).';
      const v = { type: f.get('type'), nom: String(f.get('nom') || '').trim() || typeDe(f.get('type')).nom, capital, taux, mensualite, note: String(f.get('note') || '').trim() };
      if (dansAccueil) {
        if (d) Object.assign(d, v); else accueil.dettes.push({ id: uid(), ...v });
        ecranAccueil();
        return;
      }
      retenir();
      if (d) Object.assign(d, v);
      else { const n = { id: uid(), ...v }; E.dettes.push(n); E.ordre = [...R.ordrePriorite(E.dettes.filter((x) => x.id !== n.id), 'perso', E.ordre), n.id]; }
      sauver(); rendre();
      const c = R.couvreInterets(v);
      toast(c.ok ? `« ${v.nom} » ${d ? 'enregistrée' : 'ajoutée au plan'}.` : `« ${v.nom} » : attention, la mensualité ne couvre pas les intérêts du mois (${eur(c.interet)}).`, { libelle: 'Annuler', faire: annuler });
    });
    const maj = () => {
      const f = new FormData(modale().querySelector('form'));
      const capital = R.versCentimes(f.get('capital')), taux = R.lireTaux(f.get('taux')), m = R.versCentimes(f.get('mensualite'));
      const el = $('#apercu-interets');
      if (capital === null || taux === null) { el.textContent = ''; el.className = 'apercu-interets'; return; }
      const it = R.interetsMois(capital, taux);
      const ok = m !== null && m > it;
      el.className = `apercu-interets ${m !== null && !ok && capital > 0 ? 'ko' : ''}`;
      el.textContent = `Intérêts du premier mois : ${eur(it)} (${eur(capital)} × ${R.tauxTexte(taux)} ÷ 12).${m !== null && capital > 0 ? (ok ? ` Ta mensualité rembourse ${eur(m - it)} de capital.` : ' La mensualité ne couvre pas ces intérêts : seule, la dette ne baisserait jamais.') : ''}`;
    };
    modale().querySelectorAll('input').forEach((i) => i.addEventListener('input', maj));
    $('#choix-type').addEventListener('change', (e) => {
      const t = typeDe(e.target.value);
      $('#aide-type').innerHTML = `<b>Où trouver les chiffres :</b> ${esc(t.ou)}<br>${esc(t.attention)}`;
      modale().querySelector('[name=nom]').placeholder = t.nom;
      const tx = modale().querySelector('[name=taux]');
      if (t.tauxZero && !tx.value) tx.value = '0';
      maj();
    });
    maj();
  }

  function modaleBudget() {
    const min = R.totalMinimums(E.dettes);
    ouvrirModale('Budget mensuel', `
      <p>Le budget couvre toutes les mensualités minimales (<b>${eur(min)}</b>) ; le reste accélère le plan.</p>
      <label class="champ">Budget pour les remboursements, par mois<input name="budget" inputmode="decimal" value="${esc(R.versSaisie(E.budget))}" required></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const b = R.versCentimes(f.get('budget'));
      if (b === null) return 'Saisis un montant, par exemple 650.';
      if (b < min) return `Il manque ${eur(min - b)} pour couvrir les minimums (${eur(min)}).`;
      retenir();
      E.budget = b;
      sauver(); rendre();
      const s = plan();
      toast(s.ok && !s.nonTermine ? `Budget ${eur(b)} : fin prévue en ${lm(s.fin)}.` : 'Budget enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleVersement(id) {
    const v = E.versements.find((x) => x.id === id);
    const t = moisCourant();
    ouvrirModale(v ? 'Versement exceptionnel' : 'Nouveau versement exceptionnel', `
      <div class="rang-champs"><label class="champ">Montant<input name="montant" inputmode="decimal" value="${esc(R.versSaisie(v?.montant))}" placeholder="500" required></label>
      <label class="champ">Mois<input name="mois" type="month" value="${v?.mois || R.ajoutMois(t, 1)}" min="${E.debut}" required></label></div>
      <label class="champ">Sur quelle dette ?<select name="dette"><option value="">La dette prioritaire de la méthode</option>${E.dettes.filter((d) => d.capital > 0).map((d) => `<option value="${d.id}" ${v?.detteId === d.id ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}</select></label>
      <label class="champ">D'où vient-il ?<small>Facultatif : prime, remboursement, vente…</small><input name="note" maxlength="60" value="${esc(v?.note || '')}"></label>
      <p class="aide">Un remboursement anticipé peut entraîner des indemnités selon ton contrat : vérifie-le avant de verser.</p>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${v ? '<button class="btn danger gauche" value="suppr" formnovalidate>Supprimer</button>' : ''}`, (f, choix) => {
      retenir();
      if (choix === 'suppr') { E.versements = E.versements.filter((x) => x.id !== id); sauver(); rendre(); toast('Versement supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const montant = R.versCentimes(f.get('montant'));
      const mois = f.get('mois');
      if (!montant) { annulation = null; return 'Saisis un montant, par exemple 500.'; }
      if (!R.estMois(mois)) { annulation = null; return 'Choisis le mois du versement.'; }
      const n = { montant, mois, detteId: f.get('dette') || null, note: String(f.get('note') || '').trim() };
      if (v) Object.assign(v, n); else E.versements.push({ id: uid(), ...n });
      sauver(); rendre();
      toast(`Versement de ${eur(montant)} en ${lm(mois)} ${v ? 'enregistré' : 'ajouté au plan'}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePaiement(detteId, mois) {
    const d = E.dettes.find((x) => x.id === detteId);
    const sim = plan();
    const pv = R.prevuDuMois(sim, mois)[detteId] || 0;
    const p = E.paiements.filter((x) => x.mois === mois && x.detteId === detteId);
    ouvrirModale('Paiement réel', `
      <p><b>${esc(d.nom)}</b> · ${lm(mois)} · prévu ${eur(pv)}</p>
      <label class="champ">Montant réellement payé<input name="montant" inputmode="decimal" value="${esc(R.versSaisie(p.length ? p.reduce((s, x) => s + x.montant, 0) : pv))}" required></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${p.length ? '<button class="btn danger gauche" value="suppr" formnovalidate>Effacer le pointage</button>' : ''}`, (f, choix) => {
      retenir();
      if (choix === 'suppr') { E.paiements = E.paiements.filter((x) => !(x.mois === mois && x.detteId === detteId)); sauver(); rendre(); toast('Pointage effacé.', { libelle: 'Annuler', faire: annuler }); return; }
      const m = R.versCentimes(f.get('montant'));
      if (m === null) { annulation = null; return 'Saisis un montant, par exemple 120 (0 si rien n\'a été payé).'; }
      pointer(detteId, mois, m);
      sauver(); rendre();
      toast(`${d.nom} : ${eur(m)} pointés en ${lm(mois)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCalcul() {
    ouvrirModale('Comment c\'est calculé', `<ol class="liste-calcul">${B.calcul.map((c) => `<li>${esc(c)}</li>`).join('')}</ol><p class="aide">${esc(B.avertissement)}</p>`, '<button class="btn primaire" value="ok">Fermer</button>');
  }

  function recalerPlan(jusqua) {
    const n = R.recaler(E, jusqua);
    if (!confirm(`Recaler le plan ? Il repartira en ${lm(n.debut)} avec tes soldes réels (${eur(n.dettes.reduce((s, d) => s + d.capital, 0))} au total). Les paiements déjà pointés restent en historique.`)) return;
    retenir();
    E = n;
    moisPointage = moisCourant();
    sauver(); rendre();
    toast(`Plan recalé : départ en ${lm(E.debut)}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Départ du plan<small>Mois où commencent les soldes saisis dans l'onglet Dettes.</small><input name="debut" type="month" value="${E.debut}" required></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde et partage</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="csv">Échéancier (CSV)</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">${esc(B.avertissement)}</p><p class="discret">${esc(B.sources)}</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const debut = f.get('debut');
      if (!R.estMois(debut)) return 'Choisis le mois de départ du plan.';
      E.prenom = String(f.get('prenom') || '').trim();
      E.debut = debut;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.dettes) || !Array.isArray(d.paiements) || !R.estMois(d.debut)) throw new Error();
        if (!confirm(`Remplacer ton plan actuel par cette copie (${pluriel(d.dettes.length, 'dette')}, ${pluriel(d.paiements.length, 'paiement pointé', 'paiements pointés')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du plan de remboursement.'); }
    });
  }

  function telecharger(nom, contenu, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(`remboursement-dettes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(E, null, 2), 'application/json');
  function exporterCsv() {
    const sim = plan();
    if (!sim.ok || sim.nonTermine) { toast('Le plan n\'est pas calculable avec ce budget.'); return; }
    telecharger(`echeancier-dettes-${sim.debut}.csv`, '﻿' + R.csvEcheancier(sim, E.dettes), 'text/csv;charset=utf-8');
  }
  async function copierResume() {
    const texte = resumeTexte();
    try { await navigator.clipboard.writeText(texte); toast('Résumé copié : colle-le où tu veux.'); } catch {
      ouvrirModale('Résumé du plan', `<label class="champ">Sélectionne et copie ce texte<textarea rows="12" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>');
    }
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
    if (!el || el.disabled) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-ajout': accueil.prenom = $('#prenom')?.value ?? accueil.prenom; modaleDette(null, { type: el.dataset.type, dansAccueil: true }); break;
      case 'accueil-dette': accueil.prenom = $('#prenom')?.value ?? accueil.prenom; modaleDette(id, { dansAccueil: true }); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'copier': copierResume(); break;
      case 'imprimer': window.print(); break;
      case 'calcul': modaleCalcul(); break;
      case 'fermer': modale().close(); break;
      case 'methode': {
        if (E.methode === id) break;
        retenir(); E.methode = id; sauver(); rendre();
        const s = plan();
        toast(`Méthode ${methodeDe(id).nom.toLowerCase()}${s.ok && !s.nonTermine ? ` : fin en ${lm(s.fin)}, ${eurR(s.totalInterets)} d'intérêts` : ''}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'budget': modaleBudget(); break;
      case 'dette': if (vue !== 'dettes') changerVue('dettes'); modaleDette(id); break;
      case 'dette-nouvelle': modaleDette(null); break;
      case 'monter': case 'descendre': {
        const o = R.ordrePriorite(E.dettes, 'perso', E.ordre);
        const i = o.indexOf(id), j = i + (action === 'monter' ? -1 : 1);
        if (i < 0 || j < 0 || j >= o.length) break;
        [o[i], o[j]] = [o[j], o[i]];
        E.ordre = o; sauver(); rendre();
        document.querySelector(`[data-action="${action}"][data-id="${id}"]`)?.focus();
        break;
      }
      case 'ordre-depuis': retenir(); E.ordre = R.ordrePriorite(E.dettes, id); sauver(); rendre(); toast('Ordre personnalisé remplacé.', { libelle: 'Annuler', faire: annuler }); break;
      case 'deplier': if (detailOuvert.has(el.dataset.mois)) detailOuvert.delete(el.dataset.mois); else detailOuvert.add(el.dataset.mois); rendre(); document.querySelector(`[data-action="deplier"][data-mois="${el.dataset.mois}"]`)?.focus(); break;
      case 'versement': modaleVersement(id); break;
      case 'versement-nouveau': modaleVersement(null); break;
      case 'essai-ajouter': {
        const m = R.versCentimes(essai.montant);
        if (!m) break;
        retenir();
        E.versements.push({ id: uid(), mois: R.estMois(essai.mois) ? essai.mois : R.ajoutMois(moisCourant(), 1), montant: m, detteId: null, note: '' });
        essai = { montant: '', mois: '' };
        sauver(); rendre(); toast('Versement ajouté au plan.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'pointer-mois': moisPointage = el.dataset.mois; if (modale().open) modale().close(); changerVue('pointage'); break;
      case 'mois-prec': moisPointage = R.ajoutMois(moisPointage < E.debut ? E.debut : moisPointage, -1); rendre(); break;
      case 'mois-suiv': moisPointage = R.ajoutMois(moisPointage < E.debut ? E.debut : moisPointage, 1); rendre(); break;
      case 'mois-auj': moisPointage = moisCourant(); rendre(); break;
      case 'payer': {
        retenir();
        const pv = R.prevuDuMois(plan(), el.dataset.mois)[id] || 0;
        pointer(id, el.dataset.mois, pv);
        sauver(); rendre();
        toast(`${E.dettes.find((d) => d.id === id)?.nom} : ${eur(pv)} pointés.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'pas-paye': retenir(); pointer(id, el.dataset.mois, 0); sauver(); rendre(); toast('Noté : pas payé ce mois-ci. L\'écart apparaît dans l\'historique.', { libelle: 'Annuler', faire: annuler }); break;
      case 'tout-payer': {
        retenir();
        const M = el.dataset.mois;
        let n = 0;
        for (const [did, v] of Object.entries(R.prevuDuMois(plan(), M))) if (v > 0 && !R.estPointe(E.paiements, M, did)) { pointer(did, M, v); n++; }
        sauver(); rendre();
        toast(`${pluriel(n, 'paiement pointé', 'paiements pointés')} comme prévu.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'paiement-modifier': modalePaiement(id, el.dataset.mois); break;
      case 'recaler': recalerPlan(el.dataset.mois); break;
      default: break;
    }
  });

  // Simulation « Et si je versais… » : recalcul à la saisie, sans enregistrer.
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'essai-montant' && e.target.id !== 'essai-mois') return;
    essai = { montant: $('#essai-montant').value, mois: $('#essai-mois').value };
    const pos = e.target.selectionStart;
    const cible = e.target.id;
    rendre();
    const champ = document.getElementById(cible);
    champ.focus();
    if (cible === 'essai-montant') try { champ.setSelectionRange(pos, pos); } catch { /* type month */ }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  let largeurPrecedente = window.innerWidth;
  window.addEventListener('resize', () => { if (E && $('#vue') && Math.abs(window.innerWidth - largeurPrecedente) > 40 && !modale().open) { largeurPrecedente = window.innerWidth; rendre(); } });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && $('#vue')) rendre(); // le mois a pu changer
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
  window.__dettes = { etat: () => E, regles: R };
  init();
})();
