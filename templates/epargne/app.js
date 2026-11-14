// Objectif d'épargne et fonds d'urgence QME : objectifs chiffrés, plan de versements, date d'atteinte,
// scénarios d'intérêts composés (taux saisi), jalons et historique, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.EPG;
  const API = '/api/templates';
  const PRODUIT = 'EPG';
  const CLE_CODE = 'qme-epg-code';
  const CLE_CACHE = 'qme-epg-cache';
  const CLE_DEMO = 'qme-epg-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-epg-ecran-accueil';

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
  const aujourdhui = () => R.jourDe(new Date());
  const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const lm = (m, court = false) => { if (!m) return '–'; const [a, n] = m.split('-').map(Number); return `${(court ? MOIS_COURTS : NOMS_MOIS)[n - 1]} ${a}`; };
  const lmMaj = (m) => { const t = lm(m); return t.charAt(0).toUpperCase() + t.slice(1); };
  const ld = (d) => { if (!d) return '–'; const [a, m, j] = d.split('-').map(Number); return `${j} ${MOIS_COURTS[m - 1]} ${a}`; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const typeDe = (id) => B.types.find((t) => t.id === id) || B.types[B.types.length - 1];
  const FORMES = {
    carre: '<rect x="3" y="3" width="18" height="18" rx="3"/>',
    rond: '<circle cx="12" cy="12" r="9"/>',
    quart: '<path d="M3 21V3a18 18 0 0 1 18 18Z"/>',
    triangle: '<path d="M12 3 22 21H2Z"/>',
  };
  const iconeType = (id, couleur) => `<svg class="ic-type" viewBox="0 0 24 24" aria-hidden="true"${couleur ? ` style="color:${couleur}"` : ''}>${FORMES[typeDe(id).forme] || FORMES.rond}</svg>`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let selection = null; // objectif ouvert dans l'onglet Objectifs
  let scenId = null; // objectif comparé dans l'onglet Scénarios
  let filtreHisto = '';
  let annulation = null;

  const etatVide = R.etatVide;
  const normaliser = R.normaliser;
  const objDe = (id) => E.objectifs.find((o) => o.id === id);
  const actifs = () => E.objectifs.filter((o) => !o.archive);
  // Couleur fixe de l'objectif (attribuée à la création, jamais selon son rang).
  const couleurDe = (o) => B.couleurs[((Number.isInteger(o?.couleur) ? o.couleur : E.objectifs.indexOf(o)) % B.couleurs.length + B.couleurs.length) % B.couleurs.length];
  function couleurLibre(liste) {
    const prises = liste.map((o) => o.couleur);
    for (let i = 0; i < B.couleurs.length; i++) if (!prises.includes(i)) return i;
    return liste.length % B.couleurs.length;
  }

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
    toast('Modification annulée.');
  }

  const statutDe = (o) => R.statutObjectif(o, E.mouvements, E.prevus, moisCourant());

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
        toast('Un autre appareil a modifié ton épargne entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (EPG-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && E.objectifs.length) { cache(false); demarrer(); } else ecranAccueil();
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
  // Foyer fictif, dates relatives à aujourd'hui : un fonds d'urgence entamé par un retrait puis reconstitué
  // (un mois oublié, intérêts notés en fin d'année), un apport en retard sur sa date, un voyage dans les
  // temps avec une prime prévue, une voiture atteinte, un ordinateur en pause. Versement du mois à faire.
  function donneesDemo() {
    const e = etatVide();
    const t = moisCourant();
    const jour = (m, j = 2) => `${m}-${String(j).padStart(2, '0')}`;
    e.prenom = 'Camille';
    e.capacite = 140000;
    const ligne = (nom, montant) => ({ id: uid() + Math.random().toString(36).slice(2, 5), nom, montant });
    const o = (id, type, nom, couleur, extra) => ({ id, type, nom, couleur, note: '', support: '', archive: false, cible: 0, soldeInitial: 0, versement: 0, taux: 0, capitalisation: 'mensuelle', dateCible: null, postes: [], urgence: null, scenarios: [], ...extra });
    const dep = B.depensesEssentielles;
    e.objectifs = [
      o('urgence', 'urgence', 'Fonds d\'urgence', 0, {
        debut: R.ajoutMois(t, -13), soldeInitial: 60000, versement: 30000, taux: 2.4, capitalisation: 'annuelle', support: 'Épargne disponible de la banque',
        urgence: { mois: 6, reponses: { situation: 'variable', facteurs: ['charge'] }, depenses: [ligne(dep[0], 72000), ligne(dep[1], 11000), ligne(dep[2], 38000), ligne(dep[3], 12000), ligne(dep[4], 9000), ligne(dep[5], 4500), ligne(dep[6], 2500), ligne(dep[9], 6000)] },
        note: 'Taux saisi pour l\'exemple : mets celui de ton propre placement.',
      }),
      o('apport', 'apport', 'Apport pour l\'appartement', 1, {
        debut: R.ajoutMois(t, -14), soldeInitial: 600000, versement: 60000, taux: 3, dateCible: R.ajoutMois(t, 40),
        postes: [ligne('Apport personnel visé', 2200000), ligne('Frais de notaire (estimation du notaire)', 1600000), ligne('Frais de garantie du prêt', 300000), ligne('Frais de dossier bancaire', 100000), ligne('Déménagement', 120000), ligne('Premiers travaux et équipement', 500000), ligne('Marge pour imprévus', 300000)],
      }),
      o('voyage', 'voyage', 'Road-trip de l\'été', 2, {
        debut: R.ajoutMois(t, -3), soldeInitial: 20000, versement: 25000, dateCible: R.ajoutMois(t, 8),
        postes: [ligne('Transport aller-retour', 60000), ligne('Hébergement', 90000), ligne('Repas', 40000), ligne('Activités et visites', 30000), ligne('Marge pour imprévus', 20000)],
      }),
      o('voiture', 'voiture', 'Changer de voiture', 3, { debut: R.ajoutMois(t, -20), soldeInitial: 760000, versement: 20000, cible: 800000, dateCible: R.ajoutMois(t, 2) }),
      o('ordi', 'autre', 'Ordinateur portable', 4, { debut: R.ajoutMois(t, -2), soldeInitial: 30000, versement: 0, cible: 120000, dateCible: R.ajoutMois(t, 5), note: 'En pause le temps de finir le voyage.' }),
    ];
    let k = 0;
    const mv = (objectifId, date, montant, type = 'versement', note = '') => e.mouvements.push({ id: `m${k++}`, objectifId, date, montant, type, note });
    for (let i = -13; i <= -1; i++) {
      const m = R.ajoutMois(t, i);
      if (i !== -6) mv('urgence', jour(m), 30000);
      if (i === -4) mv('urgence', jour(m, 17), -65000, 'retrait', 'Réparation de la voiture');
      if (m.endsWith('-12')) mv('urgence', `${m}-31`, 6800, 'interets', 'Intérêts de l\'année crédités');
    }
    for (let i = -14; i <= 0; i++) { const m = R.ajoutMois(t, i); if (i !== -9) mv('apport', jour(m, 3), 60000); if (m.endsWith('-12')) mv('apport', `${m}-31`, 3400, 'interets', 'Intérêts notés à la fin de l\'année'); }
    for (let i = -3; i <= -1; i++) mv('voyage', jour(R.ajoutMois(t, i), 5), i === -2 ? 15000 : 25000);
    mv('voiture', jour(R.ajoutMois(t, -1), 4), 20000);
    mv('voiture', jour(R.ajoutMois(t, -1), 20), 20000, 'versement', 'Vente du vélo');
    e.prevus = [{ id: 'p1', objectifId: 'voyage', mois: R.ajoutMois(t, 2), montant: 50000, note: 'Prime de fin d\'année' }];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Objectif d\'épargne · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="218" width="56" height="56" fill="#141414"/>
          <rect x="76" y="168" width="56" height="106" fill="#D9302A"/>
          <rect x="142" y="108" width="56" height="166" fill="#F5B400"/>
          <rect x="208" y="38" width="56" height="236" fill="#1D4E89"/>
          <circle cx="420" cy="150" r="126" fill="#F5B400"/>
          <path d="M420 150 L420 24 A126 126 0 0 1 546 150 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Objectif d'épargne et fonds d'urgence</p>
          <h1>Chaque euro a un but.</h1>
          <p>Tes objectifs chiffrés, ce qu'il faut verser chaque mois, et la date où tu y arrives : fonds d'urgence, apport, voiture, voyage.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton épargne</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes objectifs sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon épargne</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore l'outil ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon épargne'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', capacite: '', objectifs: [] };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="points-etapes" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Combien peux-tu mettre de côté ?</h1>
        <p class="intro">Ce que tu peux épargner chaque mois, une fois les dépenses courantes payées. C'est facultatif : il sert à vérifier que tes versements prévus tiennent dans ton budget.</p>
        <div class="rang-champs">
          <label class="champ">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small><input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40"></label>
          <label class="champ">Capacité d'épargne par mois <small>Facultatif, en €</small><input id="acc-capacite" inputmode="decimal" value="${esc(a.capacite)}" placeholder="300"></label>
        </div>
        <p class="erreur" id="acc-erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const aUrgence = a.objectifs.some((o) => o.urgence);
      corps = `
        <p class="surtitre">Tes objectifs</p>
        <h1>Un montant, une date, un versement.</h1>
        <p class="intro">Choisis un objectif type : il arrive avec ses postes de budget à chiffrer. ${aUrgence ? '' : 'On conseille de commencer par le <b>fonds d\'urgence</b> : quelques mois de dépenses essentielles, disponibles tout de suite.'}</p>
        ${a.objectifs.length ? `<ul class="liste-accueil">${a.objectifs.map((o) => `<li>${iconeType(o.type, B.couleurs[o.couleur])}<span><b>${esc(o.nom)}</b><small>${eur(R.cibleObjectif(o))} visés · ${eur(o.soldeInitial)} déjà de côté · ${eur(o.versement)} par mois</small></span><button class="btn lien" data-action="accueil-objectif" data-id="${o.id}">Modifier</button></li>`).join('')}</ul>` : ''}
        <p class="sous-titre-types">${a.objectifs.length ? 'Ajouter un autre objectif :' : 'Quel objectif ?'}</p>
        <div class="types-dettes" role="group" aria-label="Ajouter un objectif par type">
          ${B.types.map((t) => `<button type="button" class="type-dette ${t.urgence ? 'conseille' : ''}" data-action="accueil-ajout" data-type="${t.id}">${iconeType(t.id)}<span>${esc(t.nom)}${t.urgence && !aUrgence ? '<small>Conseillé en premier</small>' : ''}</span></button>`).join('')}
        </div>
        <p class="avertissement">${esc(B.avertissement)}</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.objectifs.length ? '' : 'disabled'}>Voir mon plan</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#acc-capacite')?.addEventListener('input', (e) => { accueil.capacite = e.target.value; });
  }

  function suivantAccueil() {
    const c = accueil.capacite.trim() ? R.versCentimes(accueil.capacite) : 0;
    if (c === null) { $('#acc-erreur').textContent = 'Saisis un montant, par exemple 300 ou 300,50, ou laisse vide.'; return; }
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    E.capacite = accueil.capacite.trim() ? R.versCentimes(accueil.capacite) || 0 : 0;
    E.objectifs = accueil.objectifs;
    accueil = { etape: 1, prenom: '', capacite: '', objectifs: [] };
    vue = 'tableau';
    sauver();
    demarrer();
    toast('Ton plan est prêt. Chaque mois, note tes versements depuis le tableau de bord.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    objectifs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    scenarios: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="14" width="4" height="7" fill="currentColor"/><rect x="10" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    historique: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="8" height="4" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    alerte: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2 23 21H1Z" fill="currentColor"/><path d="M11 9h2v6h-2zM11 16.5h2v2h-2z" fill="#fff"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau'], ['objectifs', 'Objectifs'], ['scenarios', 'Scénarios'], ['historique', 'Historique'], ['guide', 'Guide']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/epargne/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Objectif<br>d'épargne</span>
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
    if (selection && !objDe(selection)) selection = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Objectif d'épargne`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, objectifs: () => (selection ? vueDetail(objDe(selection)) : vueObjectifs()), scenarios: vueScenarios, historique: vueHistorique, guide: vueGuide }[vue]();
    brancherGraphiques();
  }

  function changerVue(v) {
    vue = v;
    if (v !== 'objectifs') selection = null;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Éléments communs ----------
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const avertissement = () => `<p class="avertissement">${esc(B.avertissement)}</p>`;
  const blocCalcul = () => `<details class="calcul"><summary>Comment c'est calculé</summary><ol>${B.calcul.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></details>`;
  const htmlAlertes = (liste) => (liste.length ? `<ul class="alertes">${liste.map(([cl, t, txt, b]) => `<li class="alerte ${cl}"><span class="etiquette ${cl}">${t}</span><p>${txt}</p>${b || ''}</li>`).join('')}</ul>` : '');
  const STATUTS = {
    atteint: ['vert', 'Atteint'], 'dans-les-temps': ['bleu', 'Dans les temps'], 'en-retard': ['jaune', 'En retard'],
    'sans-date': ['', 'Sans date'], pause: ['jaune', 'En pause'], jamais: ['rouge', 'Hors d\'atteinte'], 'sans-cible': ['', 'Sans montant'],
  };
  const etiquetteStatut = (s) => `<span class="etiquette ${STATUTS[s.statut][0]}">${STATUTS[s.statut][1]}</span>`;
  function phraseStatut(o, s) {
    const t = moisCourant();
    const dans = (m) => R.dureeTexte(R.ecartMois(t, m) + 1);
    switch (s.statut) {
      case 'atteint': return `Objectif atteint : ${eur(s.solde)} de côté pour ${eur(s.cible)} visés.`;
      case 'dans-les-temps': return `Atteint en <b>${lm(s.atteint)}</b>, ${s.avance ? `${R.dureeTexte(s.avance)} avant` : 'pile à'} la date visée (${lm(o.dateCible)}).`;
      case 'en-retard': return `À ce rythme : <b>${lm(s.atteint)}</b>, ${R.dureeTexte(s.retard)} après la date visée. Pour ${lm(o.dateCible)}, il faut <b>${eur(s.necessaire)} par mois</b>.`;
      case 'sans-date': return `À ce rythme : atteint en <b>${lm(s.atteint)}</b>, dans ${dans(s.atteint)}.`;
      case 'pause': return `Aucun versement prévu.${s.necessaire ? ` Pour ${lm(o.dateCible)}, il faudrait <b>${eur(s.necessaire)} par mois</b>.` : ''}`;
      case 'jamais': return `Avec ${eur(o.versement)} par mois, la cible n'est pas atteinte en ${R.dureeTexte(R.MAX_MOIS)}.${s.necessaire ? ` Pour ${lm(o.dateCible)} : <b>${eur(s.necessaire)} par mois</b>.` : ''}`;
      default: return 'Indique un montant visé ou chiffre les postes du budget.';
    }
  }
  const barre = (part, couleur) => `<div class="progression" role="img" aria-label="${Math.round(part * 100)} % de l'objectif"><i style="width:${Math.max(0, Math.min(100, part * 100)).toFixed(1)}%;background:${couleur}"></i></div>`;
  function videObjectifs() {
    return `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun objectif pour l'instant</h3><p>Commence par un fonds d'urgence, puis ajoute tes projets : apport, voiture, voyage…</p><div class="actions"><button class="btn primaire" data-action="objectif-nouveau" data-type="urgence">${ICONES.plus}Fonds d'urgence</button><button class="btn" data-action="objectif-nouveau">Autre objectif</button></div></div></div>`;
  }

  // ---------- Tableau ----------
  function alertes() {
    const liste = [];
    const minuscule = (s) => s.charAt(0).toLowerCase() + s.slice(1);
    const t = moisCourant();
    const total = R.totalVersements(E.objectifs, E.mouvements);
    if (E.capacite > 0 && total > E.capacite) liste.push(['rouge', 'Budget dépassé', `Tes versements prévus (${eur(total)} par mois) dépassent ta capacité d'épargne (${eur(E.capacite)}) de <b>${eur(total - E.capacite)}</b>. Réduis un versement ou repousse une date.`, '<button class="btn petit" data-action="vue" data-vue="objectifs">Voir les objectifs</button>']);
    if (!actifs().some((o) => o.urgence)) liste.push(['bleu', 'Conseil', 'Pas encore de fonds d\'urgence : quelques mois de dépenses essentielles mis de côté évitent de toucher à tes projets au premier imprévu.', '<button class="btn petit" data-action="objectif-nouveau" data-type="urgence">Créer mon fonds d\'urgence</button>']);
    for (const o of actifs()) {
      const s = statutDe(o);
      if (s.statut === 'en-retard') liste.push(['jaune', 'En retard', `<b>${esc(o.nom)}</b> : ${minuscule(phraseStatut(o, s))}`, `<button class="btn petit" data-action="appliquer-necessaire" data-id="${o.id}">Passer à ${eurR(s.necessaire)} par mois</button>`]);
      if (s.statut === 'jamais') liste.push(['rouge', 'Hors d\'atteinte', `<b>${esc(o.nom)}</b> : ${phraseStatut(o, s)}`, `<button class="btn petit" data-action="objectif" data-id="${o.id}">Revoir</button>`]);
      const r = R.rythme(o, E.mouvements, t, 3);
      if (r && s.statut !== 'atteint' && r.ecart < -(o.versement / 2)) liste.push(['jaune', 'Rythme', `<b>${esc(o.nom)}</b> : ${eur(r.verse)} versés sur les ${r.mois} derniers mois, contre ${eur(r.prevu)} prévus.`, '']);
    }
    return liste;
  }

  function vueTableau() {
    if (!E.objectifs.length) return videObjectifs();
    const t = moisCourant();
    const liste = actifs();
    const stats = liste.map((o) => ({ o, s: statutDe(o), m: R.etatDuMois(o, E.mouvements, E.prevus, t) }));
    const total = stats.reduce((a, x) => a + x.s.solde, 0);
    const vise = stats.reduce((a, x) => a + Math.max(x.s.cible, x.s.solde), 0);
    const prevuMois = stats.reduce((a, x) => a + x.m.prevu, 0);
    const verseMois = stats.reduce((a, x) => a + Math.min(x.m.verse, x.m.prevu || x.m.verse), 0);
    const atteints = stats.filter((x) => x.s.statut === 'atteint').length;
    const u = stats.find((x) => x.o.urgence);
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const tuiles = [
      ['Épargne totale', eurR(total), `${Math.round((vise ? total / vise : 0) * 100)} % des ${eurR(vise)} visés`, 'var(--bleu)', ''],
      ['Ce mois-ci', `${eurR(verseMois)}<small>/ ${eurR(prevuMois)}</small>`, prevuMois && verseMois >= prevuMois ? 'tous les versements sont faits' : 'versés sur ce qui est prévu', 'var(--jaune)', 'rond'],
      u ? ['Fonds d\'urgence', `${String(R.moisCouverts(u.s.solde, R.depensesMensuelles(u.o))).replace('.', ',')}<small> mois</small>`, `de dépenses couverts, sur ${u.o.urgence.mois} visés`, 'var(--rouge)', ''] : ['Fonds d\'urgence', '–', 'pas encore créé', 'var(--rouge)', ''],
      ['Objectifs atteints', `${atteints}<small>/ ${liste.length}</small>`, atteints ? 'bravo, continue' : 'le premier jalon arrive', 'var(--encre)', 'rond'],
    ].map(([l, v, s, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${l}</p><b>${v}</b><span>${s}</span></div>`).join('');
    const prochain = stats.filter((x) => x.s.statut !== 'atteint' && x.s.atteint).sort((a, b) => a.s.atteint.localeCompare(b.s.atteint))[0];
    const titre = prochain ? `${salut}Prochain objectif atteint en <mark>${lm(prochain.s.atteint)}</mark>.` : atteints === liste.length ? `${salut}Tous tes objectifs sont atteints.` : `${salut}Ton épargne, objectif par objectif.`;
    const sous = prochain ? `${esc(prochain.o.nom)} · ${eur(prochain.s.cible)} visés · ${E.capacite ? `${eur(R.totalVersements(E.objectifs, E.mouvements))} versés chaque mois sur ${eur(E.capacite)} possibles` : `${eur(R.totalVersements(E.objectifs, E.mouvements))} versés chaque mois`}` : 'Ajoute un objectif ou un versement pour relancer le plan.';
    const jal = stats.flatMap(({ o, s }) => R.etatJalons(o, E.mouvements, s.proj).filter((j) => !j.atteintLe && j.prevuLe).slice(0, 1).map((j) => ({ o, j }))).sort((a, b) => a.j.prevuLe.localeCompare(b.j.prevuLe)).slice(0, 4);
    return `
      <section class="plan-tete">
        <div>
          <p class="surtitre">Tableau de bord · ${lm(t)}</p>
          <h1>${titre}</h1>
          <p class="sous">${sous}</p>
        </div>
        ${carteMois(stats, t)}
      </section>
      ${htmlAlertes(alertes())}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Tes objectifs <span>Avancement et date d'atteinte au rythme actuel</span></h2>
      <ul class="objectifs-mini">${stats.map(({ o, s }) => `<li><button class="ligne-objectif" data-action="objectif" data-id="${o.id}" style="--c:${couleurDe(o)}">
        <span class="lo-nom">${iconeType(o.type, couleurDe(o))}<b>${esc(o.nom)}</b>${etiquetteStatut(s)}</span>
        <span class="lo-chiffres"><b>${eurR(s.solde)}</b> / ${eurR(s.cible)}</span>
        ${barre(s.part, couleurDe(o))}
        <span class="lo-fin">${s.statut === 'atteint' ? 'Atteint' : s.atteint ? `Atteint en ${lm(s.atteint)}` : s.statut === 'pause' ? 'En pause' : '–'}${o.dateCible && s.statut !== 'atteint' ? ` · visé ${lm(o.dateCible)}` : ''}</span>
      </button></li>`).join('')}</ul>
      ${jal.length ? `<h2 class="titre-section">Prochains jalons <span>Au rythme actuel des versements</span></h2>
      <ul class="jalons-prochains">${jal.map(({ o, j }) => `<li style="--c:${couleurDe(o)}"><i></i><span><b>${esc(j.libelle)}</b> · ${esc(o.nom)}</span><span class="discret">${eurR(j.montant)} · ${lm(j.prevuLe)}</span></li>`).join('')}</ul>` : ''}
      <h2 class="titre-section">Épargne totale <span>Réel jusqu'à aujourd'hui, puis projection au rythme prévu</span></h2>
      ${graphiqueTotal()}
      ${avertissement()}`;
  }

  // Versements du mois en cours, objectif par objectif, avec « Fait » en un geste.
  function carteMois(stats, t) {
    const lignes = stats.filter((x) => x.m.prevu > 0 || x.m.verse > 0).map(({ o, m }) => `<li class="${m.statut === 'fait' ? 'fait' : ''}">${iconeType(o.type, couleurDe(o))}<span><b>${esc(o.nom)}</b>${m.statut === 'partiel' ? `<em class="etiquette jaune">reste ${eur(m.reste)}</em>` : ''}</span><b class="montant">${eur(m.prevu || m.verse)}</b>${m.statut === 'fait' ? '<span class="coche" aria-label="fait">✓</span>' : `<button class="btn petit" data-action="fait" data-id="${o.id}" aria-label="Versement fait pour ${esc(o.nom)}">Fait</button>`}</li>`).join('');
    return `<aside class="carte-mois">
      <p class="surtitre">Versements de ${lm(t)}</p>
      ${lignes ? `<ul>${lignes}</ul>` : '<p class="discret">Aucun versement prévu ce mois-ci.</p>'}
      <div class="carte-mois-pied"><button class="btn petit" data-action="mouvement-nouveau">${ICONES.plus}Autre mouvement</button></div>
    </aside>`;
  }

  // ---------- Objectifs ----------
  function vueObjectifs() {
    if (!E.objectifs.length) return videObjectifs();
    const t = moisCourant();
    const liste = actifs();
    const archives = E.objectifs.filter((o) => o.archive);
    const total = R.totalVersements(E.objectifs, E.mouvements);
    const plan = R.planVersements(E.objectifs, E.mouvements, E.prevus, t, 12);
    const cartes = liste.map((o) => {
      const s = statutDe(o);
      const ty = typeDe(o.type);
      return `<li class="carte-dette carte-objectif" style="--c:${couleurDe(o)}"><button class="carte-dette-corps" data-action="objectif" data-id="${o.id}">
        <span class="type-ligne">${iconeType(o.type, couleurDe(o))}${esc(ty.nom)}${etiquetteStatut(s)}</span>
        <b>${esc(o.nom)}</b>
        <span class="lo-chiffres"><b>${eurR(s.solde)}</b> / ${eurR(s.cible)}</span>
        ${barre(s.part, couleurDe(o))}
        <span class="chiffres"><span><small>Par mois</small>${eur(o.versement)}</span><span><small>Taux saisi</small>${R.tauxTexte(o.taux)}</span><span><small>${o.dateCible ? 'Visé' : 'Atteint'}</small>${o.dateCible ? lmMaj(o.dateCible) : s.atteint ? lmMaj(s.atteint) : '–'}</span></span>
        <span class="pied">${phraseStatut(o, s)}</span>
      </button></li>`;
    }).join('');
    return `
      <div class="vue-tete">
        <div><h1>Tes objectifs</h1><p>${pluriel(liste.length, 'objectif')} · ${eur(total)} versés chaque mois${E.capacite ? ` sur ${eur(E.capacite)} de capacité d'épargne` : ''}.</p></div>
        <div class="actions"><button class="btn" data-action="capacite">Capacité d'épargne</button><button class="btn primaire" data-action="objectif-nouveau">${ICONES.plus}Objectif</button></div>
      </div>
      ${E.capacite ? `<section class="budget-carte"><div><p class="surtitre">Capacité d'épargne</p><b>${eur(E.capacite)}</b><span>${total <= E.capacite ? `${eur(total)} prévus · <b>${eur(E.capacite - total)}</b> encore libres chaque mois` : `<b class="negatif">${eur(total - E.capacite)} de trop</b> : les versements prévus dépassent ta capacité`}</span></div><div class="jauge-budget" role="img" aria-label="Versements prévus ${eur(total)} sur ${eur(E.capacite)}"><i style="width:${Math.min(100, (total / E.capacite) * 100)}%"></i></div></section>` : ''}
      <ul class="cartes-dettes cartes-objectifs">${cartes}</ul>
      <h2 class="titre-section">Plan de versements <span>Les 12 prochains mois ; chaque versement s'arrête quand sa cible est atteinte</span></h2>
      <div class="defile"><table class="tableau plan-versements">
        <thead><tr><th scope="col">Mois</th>${liste.map((o) => `<th scope="col" class="nb"><span class="nom-methode"><i class="cle-ligne" style="--c:${couleurDe(o)}"></i>${esc(o.nom)}</span></th>`).join('')}<th scope="col" class="nb">Total</th></tr></thead>
        <tbody>${plan.map((m) => `<tr class="${m.mois === t ? 'courant' : ''}"><th scope="row">${lmMaj(m.mois)}</th>${liste.map((o) => { const l = m.lignes.find((x) => x.id === o.id); return `<td class="nb">${l ? `${l.montant ? eur(l.montant) : ''}${l.atteint ? ' <span class="etiquette vert">atteint</span>' : ''}` : '<span class="discret">–</span>'}</td>`; }).join('')}<td class="nb"><b>${eur(m.total)}</b></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="astuce">Le mois en cours ne compte que ce qui reste à verser. Les versements ponctuels prévus (prime, remboursement) sont inclus.</p>
      ${archives.length ? `<h2 class="titre-section">Archivés <span>Objectifs terminés ou abandonnés, gardés en historique</span></h2><ul class="archives">${archives.map((o) => `<li><button class="btn lien" data-action="objectif" data-id="${o.id}">${esc(o.nom)}</button><span class="discret">${eur(R.soldeReel(o, E.mouvements))}</span></li>`).join('')}</ul>` : ''}
      ${avertissement()}`;
  }

  function vueDetail(o) {
    const s = statutDe(o);
    const ty = typeDe(o.type);
    const t = moisCourant();
    const c = couleurDe(o);
    const mv = E.mouvements.filter((m) => m.objectifId === o.id).sort((a, b) => b.date.localeCompare(a.date));
    const prevus = E.prevus.filter((p) => p.objectifId === o.id).sort((a, b) => a.mois.localeCompare(b.mois));
    const jal = R.etatJalons(o, E.mouvements, s.proj);
    const m = R.etatDuMois(o, E.mouvements, E.prevus, t);
    const tuiles = [
      ['De côté', eurR(s.solde), `${Math.round(s.part * 100)} % de ${eurR(s.cible)}`, c, ''],
      ['Reste à réunir', eurR(s.reste), s.reste ? `à ${eur(o.versement)} par mois` : 'rien, c\'est fait', 'var(--jaune)', 'rond'],
      ['Intérêts d\'ici l\'objectif', s.statut === 'atteint' || !s.atteint ? '–' : eurR(s.proj.interetsAuTerme), o.taux ? `au taux saisi de ${R.tauxTexte(o.taux)}` : 'taux à 0 % : aucun intérêt compté', 'var(--bleu)', ''],
      o.urgence ? ['Mois couverts', `${String(R.moisCouverts(s.solde, R.depensesMensuelles(o))).replace('.', ',')}<small>/ ${o.urgence.mois}</small>`, `${eur(R.depensesMensuelles(o))} de dépenses par mois`, 'var(--rouge)', 'rond'] : ['Ce mois-ci', m.prevu ? `${eurR(m.verse)}<small>/ ${eurR(m.prevu)}</small>` : '–', m.statut === 'fait' ? 'versement fait' : m.prevu ? 'à verser' : 'rien de prévu', 'var(--rouge)', 'rond'],
    ].map(([l, v, ss, cc, f]) => `<div class="tuile ${f}" style="--c:${cc}"><p class="surtitre">${l}</p><b>${v}</b><span>${ss}</span></div>`).join('');
    const nomMvt = { versement: 'Versement', retrait: 'Retrait', interets: 'Intérêts reçus' };
    return `
      <p class="retour"><button class="btn lien" data-action="retour-objectifs">${ICONES.gauche}Tous les objectifs</button></p>
      <div class="vue-tete">
        <div><p class="surtitre">${iconeType(o.type, c)} ${esc(ty.nom)}${o.archive ? ' · archivé' : ''}</p><h1>${esc(o.nom)} ${etiquetteStatut(s)}</h1><p>${phraseStatut(o, s)}</p></div>
        <div class="actions"><button class="btn" data-action="objectif-modifier" data-id="${o.id}">Modifier</button><button class="btn" data-action="scenarios-de" data-id="${o.id}">Scénarios</button><button class="btn primaire" data-action="mouvement-nouveau" data-id="${o.id}">${ICONES.plus}Versement</button></div>
      </div>
      ${barre(s.part, c)}
      <div class="tuiles">${tuiles}</div>
      ${s.statut === 'en-retard' || (s.statut === 'pause' && s.necessaire) ? `<div class="rang-boutons"><button class="btn primaire petit" data-action="appliquer-necessaire" data-id="${o.id}">Passer à ${eurR(s.necessaire)} par mois</button></div>` : ''}
      <h2 class="titre-section">Trajectoire <span>Solde réel, puis projection jusqu'à la cible</span></h2>
      ${graphiqueObjectif(o, s)}
      ${o.urgence ? blocUrgence(o, s) : blocPostes(o, s)}
      <h2 class="titre-section">Jalons <span>Date réelle de franchissement, ou mois prévu</span></h2>
      <ol class="jalons">${jal.map((j) => `<li class="${j.atteintLe ? 'fait' : ''}" style="--c:${c}"><i aria-hidden="true">${j.atteintLe ? '✓' : ''}</i><b>${esc(j.libelle)}</b><span>${eurR(j.montant)}</span><span class="discret">${j.atteintLe ? (j.depart ? 'dès le départ' : `atteint le ${ld(j.atteintLe)}`) : j.prevuLe ? `prévu en ${lm(j.prevuLe)}` : 'pas encore prévu'}</span></li>`).join('')}</ol>
      <h2 class="titre-section">Versements ponctuels prévus <span>Prime, remboursement, vente, ou retrait prévu : pris en compte dans la date d'atteinte</span></h2>
      ${prevus.length ? `<ul class="versements">${prevus.map((p) => `<li class="${p.mois < t ? 'hors' : ''}"><button class="ligne-info" data-action="prevu" data-id="${p.id}"><span class="h">${lmMaj(p.mois)}${p.mois < t ? ' · passé, non compté' : ''}</span><b>${eur(p.montant, { signe: true })}${p.note ? ` · ${esc(p.note)}` : ''}</b><span>${p.montant < 0 ? 'retrait prévu' : 'versement prévu'}</span></button></li>`).join('')}</ul>` : '<p class="discret">Aucun versement ponctuel prévu.</p>'}
      <div class="rang-boutons"><button class="btn petit" data-action="prevu-nouveau" data-id="${o.id}">${ICONES.plus}Prévoir un versement ou un retrait</button></div>
      <h2 class="titre-section">Historique <span>${pluriel(mv.length, 'mouvement')} depuis ${lm(o.debut)} · départ ${eur(o.soldeInitial)}</span></h2>
      <div class="rang-boutons"><button class="btn petit" data-action="mouvement-nouveau" data-id="${o.id}" data-type="retrait">Noter un retrait</button><button class="btn petit" data-action="mouvement-nouveau" data-id="${o.id}" data-type="interets">Noter des intérêts reçus</button></div>
      ${mv.length ? `<ul class="mouvements">${mv.slice(0, 12).map((x) => `<li><button class="ligne-mvt" data-action="mouvement" data-id="${x.id}"><span class="h">${ld(x.date)}</span><span>${nomMvt[x.type]}${x.note ? ` · ${esc(x.note)}` : ''}</span><b class="${x.montant < 0 ? 'negatif' : ''}">${eur(x.montant, { signe: true })}</b></button></li>`).join('')}</ul>${mv.length > 12 ? `<p class="astuce"><button class="btn lien" data-action="historique-de" data-id="${o.id}">Tout l'historique (${mv.length})</button></p>` : ''}` : '<p class="discret">Aucun mouvement noté pour l\'instant.</p>'}
      <h2 class="titre-section">Où ranger cette épargne</h2>
      <ul class="aides-types"><li>${iconeType(o.type, c)}<div><b>${esc(o.support || 'Support à préciser')}</b><p>${esc(ty.support)}</p><p class="discret">${esc(ty.attention)}</p>${o.note ? `<p class="discret">Note : ${esc(o.note)}</p>` : ''}</div></li></ul>
      <div class="rang-boutons"><button class="btn petit" data-action="archiver" data-id="${o.id}">${o.archive ? 'Réactiver l\'objectif' : 'Archiver l\'objectif'}</button></div>
      ${blocCalcul()}
      ${avertissement()}`;
  }

  function blocPostes(o, s) {
    if (!o.postes.length) return `<h2 class="titre-section">Budget de l'objectif <span>Montant visé saisi en une fois</span></h2><p class="discret">${eur(s.cible)} visés. ${typeDe(o.type).postes.length ? 'Chiffre-le poste par poste pour ne rien oublier : ' : ''}<button class="btn lien" data-action="objectif-modifier" data-id="${o.id}">Détailler le budget</button></p>`;
    return `<h2 class="titre-section">Budget de l'objectif <span>${pluriel(o.postes.length, 'poste')} · ${eur(s.cible)} au total</span></h2>
      <ul class="postes">${o.postes.map((p) => `<li><span>${esc(p.nom)}</span><b>${eur(p.montant)}</b><span class="part"><i style="width:${s.cible ? (p.montant / s.cible) * 100 : 0}%;background:${couleurDe(o)}"></i></span></li>`).join('')}</ul>`;
  }

  function blocUrgence(o, s) {
    const dep = R.depensesMensuelles(o);
    const Q = B.questions;
    const rep = o.urgence.reponses || { situation: '', facteurs: [] };
    const conseil = R.moisConseilles(rep, Q);
    return `<h2 class="titre-section">Taille du fonds <span>${eur(dep)} de dépenses essentielles × ${o.urgence.mois} mois = ${eur(s.cible)}</span></h2>
      <div class="deux-colonnes">
        <section class="bloc">
          <h3>Dépenses essentielles d'un mois</h3>
          <ul class="postes">${o.urgence.depenses.map((p) => `<li><span>${esc(p.nom)}</span><b>${eur(p.montant)}</b><span class="part"><i style="width:${dep ? (p.montant / dep) * 100 : 0}%;background:${couleurDe(o)}"></i></span></li>`).join('') || '<li class="discret">Aucune dépense saisie.</li>'}</ul>
          <div class="rang-boutons"><button class="btn petit" data-action="objectif-modifier" data-id="${o.id}">Modifier les dépenses</button></div>
        </section>
        <section class="bloc questionnaire">
          <h3>Combien de mois viser ?</h3>
          <p class="aide">Repère courant : 3 à 6 mois de dépenses, davantage si tes revenus sont incertains. Réponds pour un ordre de grandeur adapté à ta situation (pas une règle).</p>
          <div class="choix-texte" role="radiogroup" aria-label="Situation">${Q.situations.map((x) => `<label><input type="radio" name="q-situation" value="${x.id}" data-action="q-situation" data-id="${o.id}" ${rep.situation === x.id ? 'checked' : ''}><span title="${esc(x.detail)}">${esc(x.nom)}</span></label>`).join('')}</div>
          <ul class="facteurs">${Q.facteurs.map((f) => `<li><label class="case"><input type="checkbox" data-action="q-facteur" data-id="${o.id}" value="${f.id}" ${rep.facteurs.includes(f.id) ? 'checked' : ''}> ${esc(f.nom)}</label></li>`).join('')}</ul>
          <p class="resultat-essai">Repère pour ta situation : <b>${conseil} mois</b>, soit ${eur(dep * conseil)}.</p>
          ${conseil !== o.urgence.mois ? `<button class="btn petit primaire" data-action="appliquer-mois" data-id="${o.id}" data-mois="${conseil}">Viser ${conseil} mois</button>` : '<p class="discret">C\'est ce que tu vises déjà.</p>'}
        </section>
      </div>`;
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
      return segments.map((seg) => `${s.aire ? `<path class="aire" fill="${s.couleur}" d="M${seg[0][0]},${y(0)}L${seg.map((p) => p.join(',')).join('L')}L${seg.at(-1)[0]},${y(0)}Z"/>` : ''}<path class="ligne${s.style === 'tirets' ? ' tirets' : ''}" stroke="${s.couleur}" d="M${seg.map((p) => p.join(',')).join('L')}"/>`).join('');
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
    const legende = series.length > 1 ? `<div class="legende">${series.map((s) => `<span><i class="${s.style === 'points' ? 'cle-point' : s.style === 'tirets' ? 'cle-ligne cle-tirets' : 'cle-ligne'}" style="--c:${s.couleur}"></i>${esc(s.nom)}</span>`).join('')}</div>` : '';
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

  function moisEntre(de, a) { return Array.from({ length: Math.max(0, R.ecartMois(de, a)) + 1 }, (_, i) => R.ajoutMois(de, i)); }

  function graphiqueObjectif(o, s) {
    const t = moisCourant();
    const de = R.ajoutMois(t, -12) > o.debut ? R.ajoutMois(t, -12) : o.debut;
    const fin0 = s.atteint && s.statut !== 'atteint' ? s.atteint : R.ajoutMois(t, 12);
    const fin = [fin0, o.dateCible || fin0].sort().at(-1);
    const finD = R.ecartMois(t, fin) > 120 ? R.ajoutMois(t, 120) : R.ajoutMois(fin, 1);
    const mois = moisEntre(de, finD);
    const proj = R.projectionObjectif(o, E.mouvements, E.prevus, t, { horizon: R.ecartMois(t, finD) + 1 });
    const reel = new Map(R.soldesMensuels(o, E.mouvements, de, t).map((x) => [x.mois, x.solde]));
    const prj = new Map([[t, reel.get(t)], ...proj.mois.filter((x) => x.mois > t && x.mois <= finD).map((x) => [x.mois, x.solde])]);
    const series = [
      { id: 'reel', nom: 'Solde réel', couleur: '#24221F', valeurs: reel },
      { id: 'proj', nom: 'Projection', couleur: couleurDe(o), valeurs: prj, aire: true, finMois: s.atteint && s.statut !== 'atteint' && s.atteint <= finD ? s.atteint : null, finLabel: s.atteint && s.statut !== 'atteint' ? `Atteint ${lm(s.atteint, true)}` : '' },
      { id: 'cible', nom: 'Cible', couleur: '#8C857A', valeurs: new Map(mois.map((m) => [m, s.cible])), style: 'tirets' },
    ];
    const note = `${o.taux ? `Intérêts au taux saisi de ${R.tauxTexte(o.taux)}, capitalisation ${o.capitalisation}.` : 'Sans intérêts (taux à 0 %).'}${o.dateCible ? ` Date visée : ${lm(o.dateCible)}.` : ''}${R.ecartMois(t, fin) > 120 ? ' Projection coupée à 10 ans.' : ''}`;
    return graphique('g-objectif', mois, series, { titreAria: `Trajectoire de l'objectif ${o.nom}`, note });
  }

  function graphiqueTotal() {
    const t = moisCourant();
    const liste = actifs();
    const debut = liste.map((o) => o.debut).sort()[0];
    const de = R.ajoutMois(t, -12) > debut ? R.ajoutMois(t, -12) : debut;
    const finD = R.ajoutMois(t, 24);
    const mois = moisEntre(de, finD);
    const reel = new Map(moisEntre(de, t).map((m) => [m, liste.reduce((a, o) => a + (m >= o.debut ? R.soldeReel(o, E.mouvements, `${m}-31`) : 0), 0)]));
    const projs = liste.map((o) => R.projectionObjectif(o, E.mouvements, E.prevus, t, { horizon: 25 }));
    const prj = new Map([[t, reel.get(t)], ...moisEntre(R.ajoutMois(t, 1), finD).map((m) => [m, projs.reduce((a, p) => a + R.soldeAu(p, m), 0)])]);
    const vise = liste.reduce((a, o) => a + Math.max(R.cibleObjectif(o), R.soldeReel(o, E.mouvements)), 0);
    return graphique('g-total', mois, [
      { id: 'reel', nom: 'Épargne réelle', couleur: '#24221F', valeurs: reel },
      { id: 'proj', nom: 'Projection', couleur: B.couleurs[0], valeurs: prj, aire: true, finMois: finD, finLabel: eurR(prj.get(finD)) },
      { id: 'vise', nom: 'Total visé', couleur: '#8C857A', valeurs: new Map(mois.map((m) => [m, vise])), style: 'tirets' },
    ], { titreAria: 'Épargne totale, réelle puis projetée sur deux ans', note: 'La projection arrête chaque versement quand sa cible est atteinte ; les intérêts suivent le taux saisi pour chaque objectif.' });
  }

  // ---------- Scénarios ----------
  function scenariosDe(o) {
    if (o.scenarios && o.scenarios.length === 3) return o.scenarios;
    const plus = Math.max(1000, Math.ceil((o.versement * 1.25) / 1000) * 1000);
    return [
      { nom: 'Plan actuel', versement: o.versement, taux: o.taux, apport: 0 },
      { nom: 'Un peu plus chaque mois', versement: plus, taux: o.taux, apport: 0 },
      { nom: 'Sans intérêts', versement: o.versement, taux: 0, apport: 0 },
    ];
  }
  let essaiDate = '';

  function vueScenarios() {
    const liste = actifs().filter((o) => R.cibleObjectif(o) > 0);
    if (!liste.length) return videObjectifs();
    if (!scenId || !liste.some((o) => o.id === scenId)) scenId = (liste.find((o) => statutDe(o).statut !== 'atteint') || liste[0]).id;
    const o = objDe(scenId);
    const t = moisCourant();
    const solde = R.soldeReel(o, E.mouvements);
    const cible = R.cibleObjectif(o);
    const sc = scenariosDe(o);
    const res = R.comparerScenarios({ solde, cible, debut: t, capitalisation: o.capitalisation, extras: R.extrasDe(o, E.prevus), dateCible: o.dateCible }, sc);
    const coul = [B.couleurs[0], B.couleurs[1], B.couleurs[2]];
    const meilleur = res.filter((r) => r.atteint).sort((a, b) => a.duree - b.duree)[0];
    const editeurs = sc.map((x, i) => `<section class="bloc scenario" style="--c:${coul[i]}">
      <h3><i aria-hidden="true"></i><input class="nom-scenario" id="sc-nom-${i}" data-sc="${i}" data-champ="nom" value="${esc(x.nom)}" maxlength="30" aria-label="Nom du scénario ${'ABC'[i]}"></h3>
      <div class="rang-champs">
        <label class="champ">Par mois<input id="sc-versement-${i}" data-sc="${i}" data-champ="versement" inputmode="decimal" value="${esc(R.versSaisie(x.versement))}"></label>
        <label class="champ">Taux annuel<input id="sc-taux-${i}" data-sc="${i}" data-champ="taux" inputmode="decimal" value="${String(x.taux).replace('.', ',')}"></label>
        <label class="champ">Versé tout de suite<input id="sc-apport-${i}" data-sc="${i}" data-champ="apport" inputmode="decimal" value="${esc(R.versSaisie(x.apport))}"></label>
      </div>
      <p class="resultat-scenario">${res[i].dejaAtteint ? '<b>Déjà atteint</b>' : res[i].jamais ? '<b>Jamais atteint</b> en 50 ans' : `Atteint en <b>${lm(res[i].atteint)}</b> · ${R.dureeTexte(res[i].duree)}`}</p>
      <div class="rang-boutons"><button class="btn petit" data-action="appliquer-scenario" data-sc="${i}" ${x.versement === o.versement && x.taux === o.taux && !x.apport ? 'disabled' : ''}>Appliquer à l'objectif</button></div>
    </section>`).join('');
    const horizon = res[0].horizon;
    const mois = moisEntre(R.ajoutMois(t, -1), R.ajoutMois(t, horizon - 1));
    const series = res.map((r, i) => ({ id: `s${i}`, nom: sc[i].nom, couleur: coul[i], valeurs: new Map([[R.ajoutMois(t, -1), solde], ...r.longue.mois.map((m) => [m.mois, m.solde])]), finMois: r.atteint && !r.dejaAtteint ? r.atteint : null, finLabel: r.atteint && !r.dejaAtteint ? lm(r.atteint, true) : '' }));
    series.push({ id: 'cible', nom: 'Cible', couleur: '#8C857A', valeurs: new Map(mois.map((m) => [m, cible])), style: 'tirets' });
    const mDate = R.estMois(essaiDate) ? essaiDate : (o.dateCible || R.ajoutMois(t, 12));
    const pour = (taux) => R.versementPour({ solde, cible, taux, capitalisation: o.capitalisation, debut: t, extras: R.extrasDe(o, E.prevus) }, mDate);
    const tauxVus = [...new Set(sc.map((x) => x.taux))];
    return `
      <div class="vue-tete">
        <div><h1>Scénarios</h1><p>Même point de départ (${eur(solde)} de côté, ${eur(cible)} visés) : change le versement, le taux ou un apport, et compare la date d'atteinte et les intérêts gagnés. Le taux est le tien : aucun n'est proposé par l'outil.</p></div>
      </div>
      <div class="segment choix-objectif" role="radiogroup" aria-label="Objectif comparé">${liste.map((x) => `<button type="button" role="radio" aria-checked="${x.id === o.id}" data-action="scen-objectif" data-id="${x.id}" style="--c:${couleurDe(x)}"><i></i>${esc(x.nom)}</button>`).join('')}</div>
      <div class="scenarios">${editeurs}</div>
      ${graphique('g-scenarios', mois, series, { titreAria: `Scénarios pour ${o.nom}`, note: `Intérêts composés ${o.capitalisation === 'annuelle' ? 'crédités chaque décembre' : 'chaque mois'}, au taux saisi dans chaque scénario. Les courbes continuent après l'atteinte avec les mêmes versements.` })}
      <div class="defile"><table class="tableau comparaison">
        <thead><tr><th scope="col">Scénario</th><th scope="col">Atteint en</th><th scope="col" class="nb">Durée</th><th scope="col" class="nb">Total versé</th><th scope="col" class="nb">Intérêts gagnés</th>${o.dateCible ? `<th scope="col" class="nb">Solde en ${lm(o.dateCible, true)}</th>` : ''}</tr></thead>
        <tbody>${res.map((r, i) => `<tr class="${meilleur === r ? 'choisie' : ''}"><th scope="row"><span class="nom-methode"><i class="cle-ligne" style="--c:${coul[i]}"></i>${esc(sc[i].nom)}</span></th><td>${r.dejaAtteint ? 'déjà atteint' : r.jamais ? 'jamais' : lm(r.atteint)}</td><td class="nb">${r.jamais || r.dejaAtteint ? '–' : R.dureeTexte(r.duree)}</td><td class="nb">${r.jamais ? '–' : eur(r.totalVerse)}</td><td class="nb">${r.jamais ? '–' : eur(r.interets)}</td>${o.dateCible ? `<td class="nb">${eur(r.aDate)}</td>` : ''}</tr>`).join('')}</tbody>
      </table></div>
      <section class="bloc essai">
        <h3>Combien verser pour y arriver en…</h3>
        <div class="rang-champs"><label class="champ">Mois visé<input id="essai-date" type="month" value="${mDate}" min="${t}"></label></div>
        <ul class="pour-date">${tauxVus.map((tx) => { const v = pour(tx); return `<li>Au taux de <b>${R.tauxTexte(tx)}</b> : ${v === null ? 'choisis un mois à venir' : v === 0 ? 'rien de plus, c\'est déjà atteint' : `<b>${eur(v)} par mois</b>`}</li>`; }).join('')}</ul>
      </section>
      ${blocCalcul()}
      ${avertissement()}`;
  }

  // ---------- Historique ----------
  function vueHistorique() {
    if (!E.objectifs.length) return videObjectifs();
    const liste = E.mouvements.filter((m) => !filtreHisto || m.objectifId === filtreHisto).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
    const parMois = new Map();
    for (const m of liste) { const k = m.date.slice(0, 7); if (!parMois.has(k)) parMois.set(k, []); parMois.get(k).push(m); }
    const nomMvt = { versement: 'Versement', retrait: 'Retrait', interets: 'Intérêts reçus' };
    const somme = (l, ty) => l.filter((m) => m.type === ty).reduce((s, m) => s + m.montant, 0);
    const total = { versement: somme(liste, 'versement'), retrait: somme(liste, 'retrait'), interets: somme(liste, 'interets') };
    return `
      <div class="vue-tete">
        <div><h1>Historique</h1><p>Chaque versement, retrait ou intérêt reçu : c'est ce qui fait le solde réel de tes objectifs.</p></div>
        <div class="actions"><button class="btn" data-action="csv">Exporter (CSV)</button><button class="btn primaire" data-action="mouvement-nouveau" ${filtreHisto ? `data-id="${filtreHisto}"` : ''}>${ICONES.plus}Mouvement</button></div>
      </div>
      <label class="champ filtre">Objectif<select id="filtre-histo"><option value="">Tous les objectifs</option>${E.objectifs.map((o) => `<option value="${o.id}" ${filtreHisto === o.id ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>
      <div class="resume-mois"><span>Versé <b>${eur(total.versement)}</b></span><span>Retiré <b class="${total.retrait ? 'negatif' : ''}">${eur(total.retrait)}</b></span><span>Intérêts notés <b>${eur(total.interets)}</b></span><span>${pluriel(liste.length, 'mouvement')}</span></div>
      ${liste.length ? [...parMois].map(([k, l]) => `<section class="mois-histo"><h2 class="titre-section">${lmMaj(k)} <span>${eur(l.reduce((s, m) => s + m.montant, 0), { signe: true })}</span></h2>
        <ul class="mouvements">${l.map((x) => { const o = objDe(x.objectifId); return `<li><button class="ligne-mvt" data-action="mouvement" data-id="${x.id}"><span class="h">${ld(x.date)}</span><span><i class="pastille" style="background:${o ? couleurDe(o) : '#8C857A'}"></i>${esc(o?.nom || 'Objectif supprimé')} · ${nomMvt[x.type]}${x.note ? ` · ${esc(x.note)}` : ''}</span><b class="${x.montant < 0 ? 'negatif' : ''}">${eur(x.montant, { signe: true })}</b></button></li>`; }).join('')}</ul></section>`).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun mouvement</h3><p>Note ton premier versement : le solde réel et les jalons se mettent à jour.</p></div></div>`}`;
  }

  // ---------- Guide ----------
  function vueGuide() {
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Les objectifs types et leurs postes de budget, les conseils et la façon dont tout est calculé.</p></div></div>
      <h2 class="titre-section">Objectifs types <span>Touchez pour créer l'objectif avec ses postes à chiffrer</span></h2>
      <ul class="guide-types">${B.types.map((t) => `<li><button class="ligne-info" data-action="objectif-nouveau" data-type="${t.id}"><span class="h">${iconeType(t.id)}${t.urgence ? 'En mois de dépenses' : `${pluriel(t.postes.length, 'poste')} · horizon indicatif ${R.dureeTexte(t.horizon)}`}</span><b>${esc(t.nom)}</b><span>${esc(t.urgence ? t.promesse : t.postes.join(' · ') || t.attention)}</span></button></li>`).join('')}</ul>
      <h2 class="titre-section">Conseils</h2>
      <ol class="conseils">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>
      <h2 class="titre-section">Petit glossaire</h2>
      <dl class="glossaire">${B.glossaire.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <h2 class="titre-section">Comment c'est calculé</h2>
      <ol class="liste-calcul">${B.calcul.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
      <p class="discret">${esc(B.sources)}</p>
      ${avertissement()}`;
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

  const ligneEditeur = (p = { nom: '', montant: null }) => `<li class="ligne-poste"><input name="ln" maxlength="60" value="${esc(p.nom)}" aria-label="Poste" placeholder="Poste"><input name="lm" inputmode="decimal" value="${esc(p.montant ? R.versSaisie(p.montant) : '')}" aria-label="Montant de ${esc(p.nom || 'ce poste')}" placeholder="0"><button type="button" class="btn-icone" data-action="ligne-suppr" aria-label="Retirer ce poste">×</button></li>`;
  function lireLignes(f) {
    const noms = f.getAll('ln'), montants = f.getAll('lm');
    const out = [];
    for (let i = 0; i < noms.length; i++) {
      const nom = String(noms[i] || '').trim();
      const m = String(montants[i] || '').trim() ? R.versCentimes(montants[i]) : 0;
      if (m === null) return { erreur: `Montant illisible pour « ${nom || 'un poste'} » : saisis par exemple 450 ou 450,50.` };
      if (!nom && !m) continue;
      out.push({ id: uid() + i, nom: nom || 'Poste', montant: m });
    }
    return { lignes: out };
  }

  // Objectif : création ou modification. `dansAccueil` : l'objectif va dans la liste du premier lancement.
  function modaleObjectif(id, { type = 'autre', dansAccueil = false } = {}) {
    const liste = dansAccueil ? accueil.objectifs : E.objectifs;
    const o = liste.find((x) => x.id === id);
    const ty = typeDe(o?.type || type);
    const t = moisCourant();
    const urgence = Boolean(o ? o.urgence : ty.urgence);
    const lignes = urgence
      ? (o?.urgence?.depenses?.length ? o.urgence.depenses : B.depensesEssentielles.map((n) => ({ nom: n, montant: null })))
      : (o ? o.postes : ty.postes.map((n) => ({ nom: n, montant: null })));
    const corps = `
      <p class="aide"><b>${esc(ty.nom)}.</b> ${esc(ty.attention)}</p>
      <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(o?.nom || '')}" placeholder="${esc(ty.nom)}"></label>
      ${urgence ? `
      <fieldset class="champ"><legend>Dépenses essentielles d'un mois <small>Ce que tu dois payer quoi qu'il arrive. Laisse vide ce qui ne te concerne pas.</small></legend>
        <ul class="editeur-lignes">${lignes.map(ligneEditeur).join('')}</ul>
        <button type="button" class="btn petit" data-action="ligne-ajout">${ICONES.plus}Poste</button></fieldset>
      <label class="champ">Nombre de mois à couvrir<small>Repère courant : 3 à 6 mois ; affine ensuite avec le questionnaire de l'objectif.</small><input name="mois" type="number" min="1" max="24" step="1" value="${o?.urgence?.mois || 6}"></label>`
    : `
      <label class="champ">Montant visé<small>Ou chiffre les postes ci-dessous : leur total remplace ce montant.</small><input name="cible" inputmode="decimal" value="${esc(o && !o.postes.length ? R.versSaisie(o.cible) : '')}" placeholder="3 000"></label>
      <details class="postes-detail" ${lignes.some((p) => p.montant) ? 'open' : ''}><summary>Chiffrer poste par poste</summary>
        <ul class="editeur-lignes">${lignes.map(ligneEditeur).join('')}</ul>
        <button type="button" class="btn petit" data-action="ligne-ajout">${ICONES.plus}Poste</button></details>`}
      <div class="rang-champs">
        <label class="champ">Déjà de côté<small>Solde ${o ? `de départ, en ${lm(o.debut)}` : 'actuel'}</small><input name="solde" inputmode="decimal" value="${esc(o ? R.versSaisie(o.soldeInitial) : '')}" placeholder="0"></label>
        <label class="champ">Versement par mois<small>Ce que tu prévois d'y mettre</small><input name="versement" inputmode="decimal" value="${esc(o ? R.versSaisie(o.versement) : '')}" placeholder="150"></label>
        <label class="champ">Date visée<small>Facultative</small><input name="date" type="month" min="${t}" value="${o?.dateCible || (o ? '' : R.ajoutMois(t, ty.horizon))}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Taux annuel de ton placement<small>En %, celui de ta banque (net si tu le connais) ; 0 si l'argent ne rapporte rien.</small><input name="taux" inputmode="decimal" value="${o ? String(o.taux).replace('.', ',') : '0'}"></label>
        <label class="champ">Intérêts ajoutés<select name="capitalisation"><option value="mensuelle" ${o?.capitalisation !== 'annuelle' ? 'selected' : ''}>Chaque mois</option><option value="annuelle" ${o?.capitalisation === 'annuelle' ? 'selected' : ''}>Une fois par an (décembre)</option></select></label>
      </div>
      <label class="champ">Où est rangée cette épargne ?<small>Facultatif. ${esc(ty.support)}</small><input name="support" maxlength="60" value="${esc(o?.support || '')}"></label>
      <label class="champ">Note<textarea name="note" maxlength="300" rows="2">${esc(o?.note || '')}</textarea></label>
      <p class="apercu-interets" id="apercu" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${o ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${o ? '<button class="btn danger gauche" value="suppr" formnovalidate>Supprimer</button>' : ''}`;
    const lire = (f) => {
      const ls = lireLignes(f);
      if (ls.erreur) return ls;
      const cible = urgence ? 0 : (String(f.get('cible') || '').trim() ? R.versCentimes(f.get('cible')) : 0);
      const solde = String(f.get('solde') || '').trim() ? R.versCentimes(f.get('solde')) : 0;
      const versement = String(f.get('versement') || '').trim() ? R.versCentimes(f.get('versement')) : 0;
      const taux = R.lireTaux(f.get('taux'));
      const mois = Number(f.get('mois'));
      if (cible === null) return { erreur: 'Montant visé : saisis un montant, par exemple 3000.' };
      if (solde === null) return { erreur: 'Déjà de côté : saisis un montant, par exemple 500 (0 si rien).' };
      if (versement === null) return { erreur: 'Versement : saisis un montant par mois, par exemple 150.' };
      if (taux === null) return { erreur: 'Taux : saisis un pourcentage entre 0 et 30, par exemple 2,5 (0 si aucun).' };
      if (urgence && !(mois >= 1 && mois <= 24)) return { erreur: 'Nombre de mois : entre 1 et 24.' };
      const postes = urgence ? [] : ls.lignes.filter((p) => p.montant > 0);
      const v = { nom: String(f.get('nom') || '').trim() || ty.nom, cible, soldeInitial: solde, versement, taux, capitalisation: f.get('capitalisation') === 'annuelle' ? 'annuelle' : 'mensuelle', dateCible: R.estMois(f.get('date')) ? f.get('date') : null, support: String(f.get('support') || '').trim(), note: String(f.get('note') || '').trim(), postes };
      if (urgence) v.urgence = { mois: Math.round(mois), depenses: ls.lignes.filter((p) => p.montant > 0), reponses: o?.urgence?.reponses || { situation: '', facteurs: [] } };
      else v.urgence = null;
      if (R.cibleObjectif(v) <= 0) return { erreur: urgence ? 'Saisis au moins une dépense essentielle.' : 'Indique un montant visé, ou chiffre au moins un poste.' };
      return { v };
    };
    ouvrirModale(o ? 'Modifier l\'objectif' : `Nouvel objectif · ${esc(ty.court)}`, corps, pied, (f, choix) => {
      if (choix === 'suppr') {
        if (dansAccueil) { accueil.objectifs = accueil.objectifs.filter((x) => x.id !== id); ecranAccueil(); return; }
        const n = E.mouvements.filter((m) => m.objectifId === id).length;
        if (n && !confirm(`Supprimer « ${o.nom} » et ses ${pluriel(n, 'mouvement')} ? Pour garder l'historique, archive-le plutôt.`)) return '';
        retenir();
        E.objectifs = E.objectifs.filter((x) => x.id !== id);
        E.mouvements = E.mouvements.filter((m) => m.objectifId !== id);
        E.prevus = E.prevus.filter((m) => m.objectifId !== id);
        selection = null;
        sauver(); rendre();
        toast(`« ${o.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const r = lire(f);
      if (r.erreur) return r.erreur;
      const v = r.v;
      if (dansAccueil) {
        if (o) Object.assign(o, v); else accueil.objectifs.push({ id: uid(), type: ty.id, debut: t, couleur: couleurLibre(accueil.objectifs), archive: false, scenarios: [], ...v });
        ecranAccueil();
        return;
      }
      retenir();
      if (o) Object.assign(o, v, { scenarios: [] });
      else { const n = { id: uid(), type: ty.id, debut: t, couleur: couleurLibre(E.objectifs), archive: false, scenarios: [], ...v }; E.objectifs.push(n); selection = n.id; if (vue !== 'objectifs') { vue = 'objectifs'; history.replaceState(null, '', '#objectifs'); } }
      sauver(); rendre();
      const s = statutDe(o || objDe(selection));
      toast(`« ${v.nom} » ${o ? 'enregistré' : 'ajouté'}${s.atteint && s.statut !== 'atteint' ? ` : atteint en ${lm(s.atteint)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const form = modale().querySelector('form');
    const maj = () => {
      const r = lire(new FormData(form));
      const el = $('#apercu');
      if (r.erreur) { el.textContent = ''; return; }
      const v = r.v;
      const cible = R.cibleObjectif(v);
      const p = R.projeter({ solde: v.soldeInitial, versement: v.versement, taux: v.taux, capitalisation: v.capitalisation, cible, debut: t });
      const nec = v.dateCible ? R.versementPour({ solde: v.soldeInitial, taux: v.taux, capitalisation: v.capitalisation, cible, debut: t }, v.dateCible) : null;
      el.className = `apercu-interets ${v.dateCible && p.atteint && p.atteint > v.dateCible ? 'ko' : ''}`;
      el.textContent = `Cible : ${eur(cible)}${urgence ? ` (${eur(R.depensesMensuelles(v))} × ${v.urgence.mois} mois)` : ''}. ${p.dejaAtteint ? 'Déjà atteinte.' : p.jamais ? 'Avec ce versement, la cible n\'est jamais atteinte.' : `Atteinte en ${lm(p.atteint)} (${R.dureeTexte(p.duree)})${p.interetsAuTerme ? `, dont ${eur(p.interetsAuTerme)} d'intérêts` : ''}.`}${nec ? ` Pour ${lm(v.dateCible)} : ${eur(nec)} par mois.` : ''}`;
    };
    form.addEventListener('input', maj);
    form.addEventListener('change', maj);
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action="ligne-ajout"], [data-action="ligne-suppr"]');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.action === 'ligne-ajout') { const ul = b.parentElement.querySelector('.editeur-lignes'); ul.insertAdjacentHTML('beforeend', ligneEditeur()); ul.lastElementChild.querySelector('input').focus(); }
      else b.closest('li').remove();
      maj();
    });
    maj();
  }

  function modaleMouvement(id, { objectifId = null, type = 'versement' } = {}) {
    const m = E.mouvements.find((x) => x.id === id);
    const oid = m?.objectifId || objectifId || selection || actifs()[0]?.id;
    const ty = m?.type || type;
    ouvrirModale(m ? 'Modifier le mouvement' : 'Nouveau mouvement', `
      <label class="champ">Objectif<select name="objectif">${E.objectifs.map((o) => `<option value="${o.id}" ${o.id === oid ? 'selected' : ''}>${esc(o.nom)}${o.archive ? ' (archivé)' : ''}</option>`).join('')}</select></label>
      <div class="choix-texte" role="radiogroup" aria-label="Type de mouvement">${Object.entries(R.TYPES_MVT).map(([k, n]) => `<label><input type="radio" name="type" value="${k}" ${ty === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      <div class="rang-champs"><label class="champ">Montant<input name="montant" inputmode="decimal" value="${esc(m ? R.versSaisie(Math.abs(m.montant)) : '')}" placeholder="150" required></label>
      <label class="champ">Date<input name="date" type="date" value="${m?.date || aujourdhui()}" required></label></div>
      <label class="champ">Note<small>Facultatif : prime, réparation, intérêts de l'année…</small><input name="note" maxlength="80" value="${esc(m?.note || '')}"></label>
      <p class="aide">Un retrait du fonds d'urgence est normal en cas d'imprévu : le plan montre ensuite quand il sera reconstitué.</p>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${m ? '<button class="btn danger gauche" value="suppr" formnovalidate>Supprimer</button>' : ''}`, (f, choix) => {
      if (choix === 'suppr') { retenir(); E.mouvements = E.mouvements.filter((x) => x.id !== id); sauver(); rendre(); toast('Mouvement supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const montant = R.versCentimes(f.get('montant'));
      const date = f.get('date');
      const type2 = R.TYPES_MVT[f.get('type')] ? f.get('type') : 'versement';
      if (!montant) return 'Saisis un montant, par exemple 150.';
      if (!R.estDate(date)) return 'Choisis la date du mouvement.';
      const o = objDe(f.get('objectif'));
      if (!o) return 'Choisis un objectif.';
      if (type2 === 'retrait' && montant > R.soldeReel(o, E.mouvements.filter((x) => x.id !== id), date)) return `Le retrait dépasse ce qu'il y avait sur « ${o.nom} » à cette date (${eur(R.soldeReel(o, E.mouvements.filter((x) => x.id !== id), date))}).`;
      retenir();
      const avant = statutDe(o);
      const n = { objectifId: o.id, type: type2, montant: type2 === 'retrait' ? -montant : montant, date, note: String(f.get('note') || '').trim() };
      if (m) Object.assign(m, n); else E.mouvements.push({ id: uid(), ...n });
      sauver(); rendre();
      const apres = statutDe(o);
      toast(apres.statut === 'atteint' && avant.statut !== 'atteint' ? `Bravo : « ${o.nom} » est atteint !` : `${R.TYPES_MVT[type2]} de ${eur(montant)} noté sur « ${o.nom} ».`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePrevu(id, objectifId) {
    const p = E.prevus.find((x) => x.id === id);
    const oid = p?.objectifId || objectifId;
    const t = moisCourant();
    ouvrirModale(p ? 'Versement ponctuel prévu' : 'Prévoir un versement ou un retrait', `
      <div class="choix-texte" role="radiogroup" aria-label="Sens"><label><input type="radio" name="sens" value="plus" ${!p || p.montant > 0 ? 'checked' : ''}><span>Versement en plus</span></label><label><input type="radio" name="sens" value="moins" ${p && p.montant < 0 ? 'checked' : ''}><span>Retrait prévu</span></label></div>
      <div class="rang-champs"><label class="champ">Montant<input name="montant" inputmode="decimal" value="${esc(p ? R.versSaisie(Math.abs(p.montant)) : '')}" placeholder="500" required></label>
      <label class="champ">Mois<input name="mois" type="month" value="${p?.mois || R.ajoutMois(t, 1)}" min="${t}" required></label></div>
      <label class="champ">D'où vient-il ou à quoi sert-il ?<small>Facultatif : prime, remboursement, acompte…</small><input name="note" maxlength="60" value="${esc(p?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${p ? '<button class="btn danger gauche" value="suppr" formnovalidate>Supprimer</button>' : ''}`, (f, choix) => {
      if (choix === 'suppr') { retenir(); E.prevus = E.prevus.filter((x) => x.id !== id); sauver(); rendre(); toast('Versement prévu supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const montant = R.versCentimes(f.get('montant'));
      const mois = f.get('mois');
      if (!montant) return 'Saisis un montant, par exemple 500.';
      if (!R.estMois(mois)) return 'Choisis le mois.';
      retenir();
      const n = { objectifId: oid, mois, montant: f.get('sens') === 'moins' ? -montant : montant, note: String(f.get('note') || '').trim() };
      if (p) Object.assign(p, n); else E.prevus.push({ id: uid(), ...n });
      sauver(); rendre();
      const s = statutDe(objDe(oid));
      toast(`${f.get('sens') === 'moins' ? 'Retrait' : 'Versement'} prévu en ${lm(mois)}${s.atteint && s.statut !== 'atteint' ? ` : objectif atteint en ${lm(s.atteint)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCapacite() {
    const total = R.totalVersements(E.objectifs, E.mouvements);
    ouvrirModale('Capacité d\'épargne', `
      <p>Ce que tu peux mettre de côté chaque mois, une fois les dépenses courantes payées. Tes versements prévus font aujourd'hui <b>${eur(total)}</b>.</p>
      <label class="champ">Capacité par mois<small>0 ou vide pour ne pas la suivre</small><input name="capacite" inputmode="decimal" value="${esc(E.capacite ? R.versSaisie(E.capacite) : '')}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const c = String(f.get('capacite') || '').trim() ? R.versCentimes(f.get('capacite')) : 0;
      if (c === null) return 'Saisis un montant, par exemple 300.';
      retenir(); E.capacite = c; sauver(); rendre();
      toast(c ? `Capacité d'épargne : ${eur(c)} par mois.` : 'Capacité d\'épargne non suivie.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="rang-champs"><label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Capacité d'épargne par mois<small>Facultatif</small><input name="capacite" inputmode="decimal" value="${esc(E.capacite ? R.versSaisie(E.capacite) : '')}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde et partage</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="csv">Historique (CSV)</button><button class="btn petit" type="button" data-action="copier">Copier le résumé</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">${esc(B.avertissement)}</p><p class="discret">${esc(B.sources)}</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const c = String(f.get('capacite') || '').trim() ? R.versCentimes(f.get('capacite')) : 0;
      if (c === null) return 'Capacité : saisis un montant, par exemple 300.';
      E.prenom = String(f.get('prenom') || '').trim();
      E.capacite = c;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.objectifs) || !Array.isArray(d.mouvements)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.objectifs.length, 'objectif')}, ${pluriel(d.mouvements.length, 'mouvement')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de ton épargne.'); }
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
  const exporter = () => telecharger(`objectifs-epargne-${aujourdhui()}.json`, JSON.stringify(E, null, 2), 'application/json');
  const exporterCsv = () => telecharger(`historique-epargne-${aujourdhui()}.csv`, '﻿' + R.csvMouvements(E.objectifs, E.mouvements), 'text/csv;charset=utf-8');
  function resumeTexte() {
    const lignes = actifs().map((o) => { const s = statutDe(o); return `- ${o.nom} : ${eur(s.solde)} sur ${eur(s.cible)} (${Math.round(s.part * 100)} %), ${eur(o.versement)} par mois, ${s.statut === 'atteint' ? 'atteint' : s.atteint ? `atteint en ${lm(s.atteint)}` : 'pas de date d\'atteinte'}${o.dateCible ? ` · visé ${lm(o.dateCible)}` : ''}`; });
    return [`Mes objectifs d'épargne · ${lm(moisCourant())}`, ...lignes, '', 'Estimation à partir des taux saisis ; ne remplace pas un conseil financier.'].join('\n');
  }
  async function copierResume() {
    const texte = resumeTexte();
    try { await navigator.clipboard.writeText(texte); toast('Résumé copié : colle-le où tu veux.'); } catch {
      ouvrirModale('Résumé', `<label class="champ">Sélectionne et copie ce texte<textarea rows="10" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>');
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
  function ouvrirObjectif(id) {
    if (modale().open) modale().close();
    selection = id; vue = 'objectifs';
    history.replaceState(null, '', '#objectifs');
    rendre(); window.scrollTo({ top: 0 }); $('#vue').focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); selection = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': suivantAccueil(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-ajout': modaleObjectif(null, { type: el.dataset.type, dansAccueil: true }); break;
      case 'accueil-objectif': modaleObjectif(id, { dansAccueil: true }); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'copier': copierResume(); break;
      case 'fermer': modale().close(); break;
      case 'capacite': modaleCapacite(); break;
      case 'objectif': ouvrirObjectif(id); break;
      case 'retour-objectifs': selection = null; rendre(); window.scrollTo({ top: 0 }); break;
      case 'objectif-nouveau': modaleObjectif(null, { type: el.dataset.type || 'autre' }); break;
      case 'objectif-modifier': modaleObjectif(id); break;
      case 'archiver': { const o = objDe(id); retenir(); o.archive = !o.archive; sauver(); rendre(); toast(o.archive ? `« ${o.nom} » archivé : il ne compte plus dans le plan.` : `« ${o.nom} » réactivé.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'scenarios-de': scenId = id; changerVue('scenarios'); break;
      case 'scen-objectif': scenId = id; essaiDate = ''; rendre(); document.querySelector(`[data-action="scen-objectif"][data-id="${id}"]`)?.focus(); break;
      case 'historique-de': filtreHisto = id; changerVue('historique'); break;
      case 'mouvement-nouveau': modaleMouvement(null, { objectifId: id, type: el.dataset.type || 'versement' }); break;
      case 'mouvement': modaleMouvement(id); break;
      case 'prevu': modalePrevu(id); break;
      case 'prevu-nouveau': modalePrevu(null, id); break;
      case 'fait': {
        const o = objDe(id);
        const m = R.etatDuMois(o, E.mouvements, E.prevus, moisCourant());
        if (!m.reste) break;
        retenir();
        const avant = statutDe(o).statut;
        E.mouvements.push({ id: uid(), objectifId: id, date: aujourdhui(), montant: m.reste, type: 'versement', note: '' });
        sauver(); rendre();
        toast(statutDe(o).statut === 'atteint' && avant !== 'atteint' ? `Bravo : « ${o.nom} » est atteint !` : `${eur(m.reste)} versés sur « ${o.nom} ».`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'appliquer-necessaire': {
        const o = objDe(id); const s = statutDe(o);
        if (!s.necessaire) break;
        retenir(); o.versement = s.necessaire; o.scenarios = []; sauver(); rendre();
        toast(`« ${o.nom} » : ${eur(s.necessaire)} par mois, atteint pour ${lm(o.dateCible)}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'appliquer-mois': { const o = objDe(id); retenir(); o.urgence.mois = Number(el.dataset.mois); sauver(); rendre(); toast(`Fonds d'urgence : ${o.urgence.mois} mois de dépenses visés (${eur(R.cibleObjectif(o))}).`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'q-situation': case 'q-facteur': {
        const o = objDe(id);
        const rep = o.urgence.reponses || { situation: '', facteurs: [] };
        if (action === 'q-situation') rep.situation = el.value;
        else rep.facteurs = el.checked ? [...new Set([...rep.facteurs, el.value])] : rep.facteurs.filter((x) => x !== el.value);
        o.urgence.reponses = rep;
        sauver(); rendre();
        document.querySelector(action === 'q-situation' ? `[name="q-situation"][value="${el.value}"]` : `[data-action="q-facteur"][value="${el.value}"]`)?.focus();
        break;
      }
      case 'appliquer-scenario': {
        const o = objDe(scenId); const x = scenariosDe(o)[Number(el.dataset.sc)];
        retenir();
        if (x.apport) E.mouvements.push({ id: uid(), objectifId: o.id, date: aujourdhui(), montant: x.apport, type: 'versement', note: `Apport du scénario « ${x.nom} »` });
        o.versement = x.versement; o.taux = x.taux;
        o.scenarios = scenariosDe(o).map((y) => ({ ...y, apport: y === x ? 0 : y.apport }));
        sauver(); rendre();
        toast(`Scénario « ${x.nom} » appliqué à « ${o.nom} ».`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      default: break;
    }
  });

  // Saisie en direct : scénarios, mois visé, filtre de l'historique.
  document.addEventListener('input', (e) => {
    const cible = e.target;
    if (cible.closest('#modale')) return;
    if (cible.dataset.sc !== undefined && cible.dataset.champ) {
      const o = objDe(scenId);
      const sc = scenariosDe(o).map((x) => ({ ...x }));
      const i = Number(cible.dataset.sc);
      const ch = cible.dataset.champ;
      if (ch === 'nom') sc[i].nom = cible.value.slice(0, 30) || `Scénario ${'ABC'[i]}`;
      else if (ch === 'taux') { const v = R.lireTaux(cible.value); if (v === null) return; sc[i].taux = v; }
      else { const v = cible.value.trim() ? R.versCentimes(cible.value) : 0; if (v === null) return; sc[i][ch] = v; }
      o.scenarios = sc;
      sauver();
      const pos = cible.selectionStart;
      const idc = cible.id;
      rendre();
      const c2 = document.getElementById(idc);
      if (c2) { c2.focus(); try { c2.setSelectionRange(pos, pos); } catch { /* sans curseur */ } }
      return;
    }
    if (cible.id === 'essai-date') { essaiDate = cible.value; rendre(); document.getElementById('essai-date')?.focus(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'filtre-histo') { filtreHisto = e.target.value; rendre(); document.getElementById('filtre-histo')?.focus(); }
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
  window.__epargne = { etat: () => E, regles: R };
  init();
})();
