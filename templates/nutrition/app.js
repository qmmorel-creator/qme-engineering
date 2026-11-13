// Nutrition et dépense énergétique QME : journal des repas, dépense du jour, bilan, menus et courses.
// Données synchronisées par clé de licence ; base aliments Ciqual (Anses) chargée à la demande.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.NTR;
  const API = '/api/templates';
  const PRODUIT = 'NTR';
  const CLE_CODE = 'qme-ntr-code';
  const CLE_CACHE = 'qme-ntr-cache';
  const CLE_DEMO = 'qme-ntr-demo';
  const CODE_DEMO = 'DEMO';
  const VERSION_FICHIERS = '20261113';
  const VERSION_CONSENTEMENT = '2026-11-13b';

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
  const { iso, ajout, ecart } = R;
  const auj = () => iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => R.versDate(s).toLocaleDateString('fr-FR', o);
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === -1) return 'hier';
    if (n === 1) return 'demain';
    return fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const nf = (n, d = 0) => (n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const kcal = (n) => `${nf(Math.round(n))} kcal`;
  const lireNombre = (v) => { const s = String(v ?? '').trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const NOMS_NUTRI = Object.fromEntries(B.nutriments.map((n) => [n.id, n]));
  const nomRepas = (id) => B.repas.find((r) => r.id === id)?.nom || id;
  const activite = (id) => B.activites.find((a) => a.id === id);
  const sportDe = (code) => B.sports.find((s) => s.code === code);

  // ---------- Base aliments (chargée à la demande) ----------
  let promesseBase = null;
  let indexBase = null; // [{ code, nom, cle, l }]
  let parCodeBase = null;
  function chargerBase() {
    if (indexBase) return Promise.resolve();
    if (!promesseBase) {
      promesseBase = new Promise((ok, ko) => {
        const prete = () => {
          const C = window.CIQUAL;
          indexBase = C.aliments.map((l) => ({ code: `c${l[0]}`, nom: l[1], cle: R.sansAccents(l[1]), l }));
          parCodeBase = new Map(indexBase.map((x) => [x.code, x]));
          ok();
        };
        if (window.CIQUAL) return prete();
        const s = document.createElement('script');
        s.src = `aliments.js?v=${VERSION_FICHIERS}`;
        s.onload = prete;
        s.onerror = () => { promesseBase = null; s.remove(); ko(new Error('base')); };
        document.head.appendChild(s);
      });
    }
    return promesseBase;
  }
  // Aliment affichable : instantané de l'utilisateur, sinon ligne de la base.
  function aliment(code) {
    if (E.aliments[code]) return E.aliments[code];
    const x = parCodeBase?.get(code);
    return x ? R.depuisCiqual(x.l, window.CIQUAL.groupes) : null;
  }
  // Garde dans les données une copie des valeurs des aliments utilisés (journal lisible sans la base).
  function retenir(code) {
    if (!E.aliments[code]) { const a = aliment(code); if (a) E.aliments[code] = a; }
  }

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'journal';
  let jourJournal = null;
  let periodeBilan = 7;
  let rechercheAliments = '';
  let annulation = null;
  let apresPortion = null; // rouvre la modale d'origine après la définition d'une portion

  const etatVide = () => ({
    version: 1, consentement: null, prenom: '',
    profil: { sexe: null, annee: null, taille: null, activite: 'sedentaire', facteurPerso: null, depenseManuelle: null, objectif: 'maintien', ecart: 0, cibles: {} },
    pesees: [], journal: [], seances: [], aliments: {}, portions: {}, favoris: [], repasEnr: [], menus: [], semaine: [null, null, null, null, null, null, null], coches: [],
  });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
    const semaine = tab(d.semaine).slice(0, 7);
    while (semaine.length < 7) semaine.push(null);
    return {
      ...v, ...d,
      profil: { ...v.profil, ...obj(d.profil), cibles: { ...obj(d.profil?.cibles) } },
      pesees: tab(d.pesees), journal: tab(d.journal), seances: tab(d.seances), aliments: obj(d.aliments), portions: obj(d.portions),
      favoris: tab(d.favoris), repasEnr: tab(d.repasEnr), menus: tab(d.menus), semaine, coches: tab(d.coches),
    };
  };
  const instantane = () => structuredClone(E);
  function annulable(avant, texte) {
    annulation = avant;
    toast(texte, { libelle: 'Annuler', faire: () => { if (!annulation) return; E = annulation; annulation = null; sauver(); rendre(); } });
  }

  // Calculs du jour à partir de l'état courant.
  const depense = (j) => R.depenseJour({ profil: E.profil, pesees: E.pesees, seances: E.seances, jour: j, activites: B.activites });
  const entreesDu = (j) => E.journal.filter((e) => e.j === j);
  const cibleDu = (j) => { const d = depense(j); return R.cibleKcal(d.total, E.profil.objectif, E.profil.ecart); };

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }

  function sauver() {
    if (!E) return;
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
    if (session.demo || !E || !E.consentement) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!E.consentement) { ecranConsentement('Tes données ont été effacées depuis un autre appareil.'); return; }
        rendre();
        toast('Un autre appareil a modifié tes données entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
        if (!E.consentement) { ecranConsentement('Tes données ont été effacées depuis un autre appareil.'); return; }
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
  // Code NTR-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('NTR')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('NTR') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    if (c && c.code === session.code && c.nonEnvoye && c.etat?.consentement && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    // Premier lancement (ou données effacées) : rien n'est enregistré avant le consentement.
    if (E && E.consentement) { cache(false); demarrer(); } else { E = null; stock.suppr(CLE_CACHE); ecranConsentement(); }
  }

  async function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const enregistre = stock.lire(CLE_DEMO);
    if (enregistre) E = normaliser(enregistre);
    else {
      $('#racine').innerHTML = '<p class="chargement">Préparation de la démo…</p>';
      try { await chargerBase(); } catch { ecranConnexion('La démo n\'a pas pu charger la base aliments. Vérifie ta connexion.'); return; }
      E = donneesDemo();
    }
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    clearTimeout(minuterie);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    $('#toast').hidden = true;
    ecranConnexion(message);
  }

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    const D = etatVide();
    const t = auj();
    D.consentement = { date: new Date().toISOString(), version: VERSION_CONSENTEMENT, demo: true };
    D.prenom = 'Camille';
    D.profil = { sexe: 'f', annee: Number(t.slice(0, 4)) - 34, taille: 168, activite: 'leger', facteurPerso: null, depenseManuelle: null, objectif: 'perte', ecart: 10, cibles: { prot: 90, fib: 25, sel: 6 } };
    // Instantanés des aliments utilisés, tirés de la base Ciqual chargée.
    const codes = [9310, 19041, 13005, 7001, 16414, 31037, 19593, 22010, 36018, 9104, 20304, 17270, 13039, 9811, 26039, 20385, 20587, 20009, 26036, 20021, 7110, 12115, 6253, 15000, 31074, 19644, 18154, 13034, 20030];
    for (const c of codes) { const x = parCodeBase.get(`c${c}`); if (x) D.aliments[`c${c}`] = R.depuisCiqual(x.l, window.CIQUAL.groupes); }
    // Un aliment perso (valeurs saisies par l'utilisatrice fictive, lues sur un emballage imaginaire).
    D.aliments.pbarre = { n: 'Barre de céréales maison', g: '', v: [410, 9, 58, 15, 6, 22, 0.2], perso: true };
    D.portions = { c22010: [{ n: '1 œuf', g: 55 }], c19593: [{ n: '1 yaourt', g: 125 }], c7001: [{ n: '1 tranche', g: 30 }], c19041: [{ n: '1 verre', g: 200 }], c13005: [{ n: '1 fruit', g: 120 }], c13039: [{ n: '1 fruit', g: 150 }], pbarre: [{ n: '1 part', g: 35 }] };
    D.favoris = ['c19593', 'c13039', 'c15000', 'c22010'];
    const pdj = [['c9310', 40], ['c19041', 200], ['c13005', 120]];
    const pdj2 = [['c7001', 60, '1 tranche', 2], ['c16414', 10], ['c31037', 20], ['c19593', 125, '1 yaourt', 1]];
    const dejeuners = [
      [['c36018', 130], ['c9104', 180], ['c20304', 150], ['c17270', 10], ['c13039', 150, '1 fruit', 1]],
      [['c9811', 200], ['c26039', 100], ['c20385', 120], ['c17270', 10], ['c19593', 125, '1 yaourt', 1]],
      [['c20587', 200], ['c20009', 100], ['c22010', 110, '1 œuf', 2], ['c17270', 10], ['c13034', 150]],
    ];
    const diners = [
      [['c26036', 120], ['c20021', 200], ['c7110', 50], ['c19644', 100]],
      [['c6253', 120], ['c20030', 200], ['c9811', 150], ['c12115', 30]],
      [['c22010', 110, '1 œuf', 2], ['c20021', 250], ['c7110', 60], ['c13039', 150, '1 fruit', 1]],
    ];
    const ajoutRepas = (j, r, items) => items.forEach(([c, q, pn, pk]) => D.journal.push({ id: uid(), j, r, c, q, ...(pn ? { p: { n: pn, k: pk } } : {}) }));
    for (let i = 20; i >= 0; i--) {
      const j = ajout(t, -i);
      if (i === 9 || i === 4) continue; // jours non notés : exclus des moyennes
      ajoutRepas(j, 'pdj', i % 2 ? pdj : pdj2);
      if (i === 0) { ajoutRepas(j, 'dej', dejeuners[1]); continue; } // aujourd'hui : dîner pas encore saisi
      ajoutRepas(j, 'dej', dejeuners[i % 3]);
      ajoutRepas(j, 'din', diners[(i + 1) % 3]);
      ajoutRepas(j, 'col', i % 3 === 0 ? [['pbarre', 35, '1 part', 1], ['c18154', 250]] : [['c15000', 25]]);
      if (i === 6 || i === 13) ajoutRepas(j, 'col', [['c31074', 40], ['c7001', 90, '1 tranche', 3], ['c12115', 40]]); // écarts : facteur > 1
    }
    // Pesées : une à deux par semaine, en baisse lente.
    [[-20, 71.8], [-16, 71.5], [-13, 71.6], [-9, 71.1], [-6, 70.9], [-2, 70.6], [0, 70.4]].forEach(([d, kg]) => D.pesees.push({ id: uid(), j: ajout(t, d), kg }));
    // Séances de sport.
    const sp = (d, code, min) => { const s = sportDe(code); D.seances.push({ id: uid(), j: ajout(t, d), code, nom: s.nom, met: s.met, min }); };
    sp(-19, '12020', 40); sp(-17, '02054', 50); sp(-15, '18240', 45); sp(-12, '12020', 45); sp(-10, '02054', 50); sp(-8, '17200', 60);
    sp(-5, '12050', 35); sp(-3, '02054', 50); sp(-1, '15030', 60); sp(0, '17200', 30);
    // Repas enregistrés, menus et semaine.
    D.repasEnr = [
      { id: uid(), nom: 'Mon petit-déjeuner habituel', items: pdj.map(([c, q]) => ({ c, q })) },
      { id: uid(), nom: 'Salade de lentilles', items: dejeuners[2].map(([c, q, pn, pk]) => ({ c, q, ...(pn ? { p: { n: pn, k: pk } } : {}) })) },
    ];
    const menu = (nom, parts) => ({ id: uid(), nom, items: parts.flatMap(([r, its]) => its.map(([c, q]) => ({ r, c, q }))) });
    D.menus = [
      menu('Journée légère', [['pdj', pdj], ['dej', dejeuners[0]], ['din', diners[0]], ['col', [['c15000', 20]]]]),
      menu('Journée sportive', [['pdj', pdj2], ['dej', dejeuners[1]], ['din', diners[1]], ['col', [['pbarre', 35], ['c13005', 120]]]]),
      menu('Journée végétarienne', [['pdj', pdj], ['dej', dejeuners[2]], ['din', diners[2]]]),
    ];
    D.semaine = [D.menus[0].id, D.menus[1].id, D.menus[2].id, D.menus[0].id, D.menus[1].id, null, D.menus[2].id];
    D.coches = ['c17270', 'c9104'];
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.body.classList.remove('app');
    document.title = 'Nutrition et dépense énergétique · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="260" height="260" fill="#F5B400"/>
          <circle cx="140" cy="150" r="96" fill="#141414"/>
          <path d="M140 54 A96 96 0 0 1 236 150 H140 Z" fill="#D9302A"/>
          <circle cx="420" cy="150" r="130" fill="#1D4E89"/>
          <rect x="420" y="150" width="130" height="130" fill="#F0EDE6"/>
          <circle cx="420" cy="150" r="34" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Nutrition · dépense énergétique</p>
          <h1>Ce que tu manges, face à ce que tu dépenses.</h1>
          <p>Un journal des repas avec la table Ciqual de l'Anses, ta dépense du jour calculée (métabolisme, activité, sport) et un facteur calorique simple à suivre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton journal</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon journal</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Réservé aux adultes. Outil d'aide au suivi : il ne remplace pas l'avis d'un médecin ou d'un diététicien. Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon journal'; champ.focus();
      }
    });
  }

  // ---------- Premier lancement : consentement puis profil ----------
  const TEXTE_DONNEES = `
    <ul class="puces">
      <li><b>Quelles données</b> : ton poids, ta taille, ton année de naissance, ton sexe, ton niveau d'activité, tes repas et tes séances de sport. Ce sont des <b>données de santé</b> au sens du RGPD (article 9).</li>
      <li><b>Où</b> : en ligne, chez l'hébergeur Netlify, <b>dans l'Union européenne (Francfort, Allemagne)</b>, rattachées à ta clé de licence, et en copie dans ce navigateur pour fonctionner hors ligne.</li>
      <li><b>À quoi elles servent</b> : uniquement à calculer et afficher ton journal, ta dépense et ton bilan, sur tes appareils. Elles ne sont ni vendues, ni partagées, ni utilisées pour de la publicité.</li>
      <li><b>Comment les effacer</b> : Réglages → « Effacer toutes mes données » vide la version en ligne et celle de cet appareil. Tu peux aussi écrire à <b>quentin.morel@qm-engineering.fr</b> (Quentin Morel Engineering, responsable du traitement).</li>
      <li><b>Le détail</b> : <a href="/confidentialite/" target="_blank" rel="noopener">politique de confidentialité de QME</a>.</li>
    </ul>`;
  const AVERTISSEMENT_SANTE = 'Outil d\'aide au suivi, pas un dispositif médical : il ne remplace pas l\'avis d\'un médecin ou d\'un diététicien. Les calculs sont des estimations. Réservé aux adultes ; déconseillé sans avis médical en cas de grossesse, d\'allaitement, de maladie chronique ou de trouble du comportement alimentaire.';

  let accueil = { etape: 1, profil: {}, poids: '' };

  function ecranConsentement(message = '') {
    document.body.classList.remove('app');
    document.title = 'Avant de commencer · Nutrition';
    accueil = { etape: 1, profil: { activite: 'sedentaire', objectif: 'maintien', ecart: 0 }, poids: '', prenom: '' };
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><div class="etapes-accueil" aria-label="Étape 1 sur 2"><span class="actif"></span><span></span></div></div>
        ${message ? `<p class="aide" role="status" style="margin-bottom:20px">${esc(message)}</p>` : ''}
        <p class="surtitre">Avant de commencer</p>
        <h1>Tes données de santé restent à toi.</h1>
        <p class="intro">Rien n'est enregistré tant que tu n'as pas donné ton accord ci-dessous. Lis ces quatre points.</p>
        <div class="consentement">${TEXTE_DONNEES}</div>
        <p class="aide avertissement-sante" style="margin-top:16px">${AVERTISSEMENT_SANTE}</p>
        <form id="form-consentement" class="consentement-form" novalidate>
          <label class="case haute"><input type="checkbox" id="accord"> <span>J'accepte que mes données de santé (poids, mensurations, repas, activité physique) soient enregistrées en ligne, dans l'Union européenne (Francfort), pour faire fonctionner ce journal. Je pourrai retirer cet accord à tout moment en effaçant mes données.</span></label>
          <label class="case haute"><input type="checkbox" id="majeur"> <span>J'ai 18 ans ou plus. Ce journal n'est pas conçu pour les mineurs.</span></label>
          <div class="accueil-pied">
            <button class="btn primaire" id="accepter" type="submit" disabled>Continuer</button>
            <button class="btn" type="button" data-action="deconnexion">Refuser et me déconnecter</button>
          </div>
        </form>
      </div>`;
    const maj = () => { $('#accepter').disabled = !($('#accord').checked && $('#majeur').checked); };
    $('#accord').addEventListener('change', maj);
    $('#majeur').addEventListener('change', maj);
    $('#form-consentement').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!($('#accord').checked && $('#majeur').checked)) return;
      accueil.consentement = { date: new Date().toISOString(), version: VERSION_CONSENTEMENT };
      accueil.etape = 2;
      ecranProfil();
      window.scrollTo({ top: 0 });
    });
  }

  function champsProfil(p, prenom, poids) {
    const annee = Number(auj().slice(0, 4));
    return `
      <div class="grille-champs">
        <label class="champ">Ton prénom <small>Facultatif.</small><input name="prenom" maxlength="40" value="${esc(prenom)}" autocomplete="given-name"></label>
        ${poids !== undefined ? `<label class="champ">Poids actuel (kg)<input name="poids" inputmode="decimal" required value="${esc(poids)}" placeholder="Ex. : 72,5"></label>` : ''}
        <fieldset class="champ sans-cadre"><legend>Sexe <small>Pour l'équation du métabolisme.</small></legend>
          <div class="segment">${[['f', 'Femme'], ['h', 'Homme'], ['', 'Non précisé']].map(([v, l]) => `<label><input type="radio" name="sexe" value="${v}" ${(p.sexe || '') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        </fieldset>
        <label class="champ">Année de naissance<input name="annee" inputmode="numeric" maxlength="4" value="${esc(p.annee ?? '')}" placeholder="Ex. : ${annee - 35}"></label>
        <label class="champ">Taille (cm)<input name="taille" inputmode="numeric" value="${esc(p.taille ?? '')}" placeholder="Ex. : 170"></label>
      </div>
      <p class="aide">Sans le sexe, l'âge et la taille, la dépense est une estimation dégradée calculée sur le poids seul : ces trois informations l'améliorent nettement.</p>
      <fieldset class="champ sans-cadre"><legend>Ton activité en dehors des séances de sport <small>Les séances s'ajoutent à part, dans l'onglet Activité : ne les compte pas ici. Les facteurs proposés sont des valeurs moyennes d'usage courant : tu pourras régler le tien dans les Réglages (entre 1 et 2,5).</small></legend>
        <div class="choix-activite">${B.activites.map((a) => `<label><input type="radio" name="activite" value="${a.id}" ${p.activite === a.id ? 'checked' : ''}><span><b>${esc(a.nom)}</b><small>${esc(a.detail)} · × ${nf(a.facteur, 3).replace(/0+$/, '').replace(/,$/, '')}</small></span></label>`).join('')}</div>
      </fieldset>
      <fieldset class="champ sans-cadre"><legend>Ton objectif</legend>
        <div class="segment">${[['perte', 'Perdre'], ['maintien', 'Maintenir'], ['prise', 'Prendre']].map(([v, l]) => `<label><input type="radio" name="objectif" value="${v}" ${p.objectif === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      </fieldset>
      <label class="champ" data-ecart>Écart visé par rapport à ta dépense (%)<small>Ex. : 10 % de déficit donne un facteur calorique visé de 0,90. Choisis-le avec un professionnel de santé si tu as un doute.</small><input name="ecart" inputmode="decimal" value="${esc(p.ecart ?? 0)}"></label>`;
  }

  // Lit et contrôle les champs du profil ; renvoie un message d'erreur ou { profil, prenom, poids }.
  function lireProfil(f, avecPoids) {
    const annee = lireNombre(f.get('annee')), taille = lireNombre(f.get('taille')), ecartPct = lireNombre(f.get('ecart')) ?? 0;
    const an = Number(auj().slice(0, 4));
    if (annee !== null && (!Number.isInteger(annee) || annee < an - 110 || annee > an)) return 'Année de naissance : 4 chiffres, par exemple 1990.';
    if (annee !== null && R.estMineur(annee, auj())) return 'Ce journal est réservé aux adultes (18 ans ou plus).';
    if (taille !== null && (Number.isNaN(taille) || taille < 100 || taille > 250)) return 'Taille en centimètres, entre 100 et 250.';
    if (Number.isNaN(ecartPct) || ecartPct < 0 || ecartPct > 50) return 'Écart visé : un pourcentage entre 0 et 50.';
    let poids;
    if (avecPoids) {
      poids = lireNombre(f.get('poids'));
      if (poids === null || Number.isNaN(poids) || poids < 30 || poids > 350) return 'Indique ton poids en kilos (entre 30 et 350).';
    }
    const objectif = f.get('objectif') || 'maintien';
    return {
      prenom: String(f.get('prenom') || '').trim(),
      poids,
      profil: { sexe: f.get('sexe') || null, annee, taille, activite: f.get('activite') || 'sedentaire', objectif, ecart: objectif === 'maintien' ? 0 : ecartPct },
    };
  }

  function ecranProfil() {
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><div class="etapes-accueil" aria-label="Étape 2 sur 2"><span class="actif"></span><span class="actif"></span></div></div>
        <p class="surtitre">Ton profil</p>
        <h1>De quoi calculer ta dépense.</h1>
        <p class="intro">Tout reste modifiable ensuite dans l'onglet Activité.</p>
        <form id="form-profil" novalidate class="form-profil">
          ${champsProfil(accueil.profil, accueil.prenom, accueil.poids)}
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied">
            <button class="btn primaire" type="submit">Ouvrir mon journal</button>
            <button class="btn" type="button" data-action="accueil-retour">Retour</button>
          </div>
        </form>
      </div>`;
    brancherEcart($('#form-profil'));
    $('#form-profil').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = lireProfil(new FormData(e.target), true);
      if (typeof r === 'string') { e.target.querySelector('.erreur').textContent = r; return; }
      E = etatVide();
      E.consentement = accueil.consentement;
      E.prenom = r.prenom;
      Object.assign(E.profil, r.profil);
      E.pesees.push({ id: uid(), j: auj(), kg: r.poids });
      sauver();
      demarrer();
      const c = cibleDu(auj());
      if (R.cibleTresBasse(c, B.seuilTresBasCalories)) setTimeout(() => toast(`Ta cible est sous ${nf(B.seuilTresBasCalories)} kcal par jour : lis l'avertissement dans le journal.`), 300);
    });
  }
  // Le champ « écart » n'a de sens que pour perdre ou prendre.
  function brancherEcart(form) {
    const maj = () => { const o = form.querySelector('input[name=objectif]:checked')?.value; const c = form.querySelector('[data-ecart]'); if (c) c.hidden = o === 'maintien'; };
    form.querySelectorAll('input[name=objectif]').forEach((i) => i.addEventListener('change', maj));
    maj();
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    journal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    activite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    menus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    aliments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21 A18 18 0 0 1 21 3 V21Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    etoile: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2l2.9 6.9L22 9.6l-5.5 4.8L18.2 22 12 18.1 5.8 22l1.7-7.6L2 9.6l7.1-.7Z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['journal', 'Journal'], ['activite', 'Activité'], ['bilan', 'Bilan'], ['menus', 'Menus'], ['aliments', 'Aliments']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    jourJournal = auj();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Nutrition<br>et dépense</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, sources et données" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Nutrition et dépense`;
    $('#vue').innerHTML = { journal: vueJournal, activite: vueActivite, bilan: vueBilan, menus: vueMenus, aliments: vueAliments }[vue]();
    if (vue === 'bilan') brancherGraphiques();
    if (vue === 'activite') brancherGraphiques();
    if (vue === 'aliments') brancherRechercheAliments();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="80" height="80" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const piedSante = () => `<p class="pied-sante">${esc(AVERTISSEMENT_SANTE)} Base aliments : table Ciqual 2025 de l'Anses, Licence Ouverte 2.0. MET : 2024 Adult Compendium of Physical Activities.</p>`;

  function alerteCible(c) {
    if (!R.cibleTresBasse(c, B.seuilTresBasCalories)) return '';
    return `<div class="alerte" role="note"><b>Cible très basse : ${kcal(c)} par jour.</b> La Haute Autorité de santé indique que les régimes à moins de ${nf(B.seuilTresBasCalories)} kcal par jour ne sont pas indiqués sauf cas exceptionnels et doivent être supervisés par un médecin spécialisé en nutrition. Réduis l'écart visé dans ton profil ou parles-en à un médecin. <a href="${esc(B.sources.has.url)}" target="_blank" rel="noopener">Source : HAS, 2011</a></div>`;
  }

  // Journal
  function vueJournal() {
    const j = jourJournal;
    const entrees = entreesDu(j);
    const t = R.totaux(entrees, E.aliments);
    const d = depense(j);
    const cible = R.cibleKcal(d.total, E.profil.objectif, E.profil.ecart);
    const f = entrees.length ? R.facteurCalorique(t.kcal, d.total) : null;
    const vise = R.facteurVise(E.profil.objectif, E.profil.ecart);
    const ok = R.respecte(f, E.profil.objectif, E.profil.ecart);
    const reste = cible != null ? cible - t.kcal : null;
    const salut = E.prenom && j === auj() ? `${esc(E.prenom)}, ` : '';
    const titre = !entrees.length ? `${salut}rien de noté ${quand(j) === 'aujourd\'hui' ? 'pour l\'instant' : 'ce jour-là'}.`
      : `${salut}<mark>${nf(Math.round(t.kcal))} kcal</mark> mangées${d.total ? ` sur ${nf(Math.round(d.total))} dépensées` : ''}.`;
    const hier = ajout(j, -1);
    const nbHier = entreesDu(hier).length;
    const tuiles = [
      ['Mangé', nf(Math.round(t.kcal)), 'kcal', t.incomplet ? 'Valeur absente de la base pour un aliment : comptée 0.' : pluriel(entrees.length, 'aliment'), 'var(--jaune)', 'rond'],
      ['Dépensé', d.total == null ? '–' : nf(Math.round(d.total)), d.total == null ? '' : 'kcal', d.total == null ? 'Indique ton poids dans Activité.' : `Repos ${nf(Math.round(d.repos))} + sport ${nf(Math.round(d.sport))}`, 'var(--bleu)', ''],
      ['Facteur calorique', f == null ? '–' : nf(f, 2), '', `Mangé ÷ dépensé. Visé : ${nf(vise, 2)}${E.profil.objectif === 'perte' ? ' ou moins' : E.profil.objectif === 'prise' ? ' ou plus' : ''}.`, ok === false ? 'var(--rouge)' : 'var(--encre)', 'rond'],
      [reste == null ? 'Cible' : reste >= 0 ? 'Reste à manger' : 'Au-delà de la cible', reste == null ? '–' : nf(Math.abs(Math.round(reste))), reste == null ? '' : 'kcal', cible == null ? 'Cible calculée avec ta dépense.' : `Cible du jour : ${kcal(cible)}.`, 'var(--rouge)', ''],
    ].map(([lib, v, u, det, c, forme]) => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${det}</span></div>`).join('');
    const macros = ['prot', 'gluc', 'lip', 'fib', 'suc', 'sel'].map((k) => {
      const v = t[k], c = E.profil.cibles?.[k];
      const pct = c ? Math.min(100, (v / c) * 100) : null;
      return `<div class="macro"><div class="macro-tete"><span>${NOMS_NUTRI[k].nom}</span><b>${nf(v, k === 'sel' ? 1 : 0)} g${c ? `<small> / ${nf(c, k === 'sel' ? 1 : 0)}</small>` : ''}</b></div>${c ? `<div class="jauge" role="img" aria-label="${Math.round((v / c) * 100)} % de la cible"><i style="width:${pct}%" class="${v > c ? 'depasse' : ''}"></i></div>` : '<div class="jauge vide"></div>'}</div>`;
    }).join('');
    const blocs = B.repas.map((r, i) => {
      const es = entrees.filter((e) => e.r === r.id);
      const tr = R.totaux(es, E.aliments);
      return `
        <section class="repas" style="--c:${B.couleurs[i].hex};--t:${i === 0 ? 'var(--encre)' : '#fff'}">
          <div class="repas-tete"><h2>${r.nom}</h2><span>${es.length ? kcal(tr.kcal) : 'vide'}</span></div>
          ${es.length ? `<ul class="lignes-repas">${es.map((e) => {
            const a = E.aliments[e.c];
            const v = R.valeurs(a, e.q);
            return `<li><button class="ligne-aliment" data-action="entree" data-id="${e.id}"><span><b>${esc(a?.n || 'Aliment inconnu')}</b><small>${e.p ? `${nf(e.p.k, 1).replace(/,0$/, '')} × ${esc(e.p.n)} · ` : ''}${nf(e.q)} g · P ${nf(v.prot)} · G ${nf(v.gluc)} · L ${nf(v.lip)}</small></span><em>${nf(Math.round(v.kcal))}</em></button></li>`;
          }).join('')}</ul>` : ''}
          <div class="repas-pied">
            <button class="btn petit" data-action="ajouter" data-repas="${r.id}">${ICONES.plus}Ajouter</button>
            ${E.repasEnr.length ? `<button class="btn petit lien" data-action="repas-enr" data-repas="${r.id}">Repas enregistré</button>` : ''}
            ${es.length ? `<button class="btn petit lien" data-action="enregistrer-repas" data-repas="${r.id}">Enregistrer ce repas</button>` : ''}
          </div>
        </section>`;
    }).join('');
    return `
      <section class="jour">
        <div class="jour-titre">
          <div class="nav-jour">
            <button class="btn-icone" data-action="jour-prec" aria-label="Jour précédent">‹</button>
            <label class="date-jour"><span class="surtitre">${fmt(j, { weekday: 'long', day: 'numeric', month: 'long' })}</span><input type="date" id="choix-jour" value="${j}" max="${auj()}" aria-label="Choisir le jour"></label>
            <button class="btn-icone" data-action="jour-suiv" aria-label="Jour suivant" ${j >= auj() ? 'disabled' : ''}>›</button>
            ${j !== auj() ? '<button class="btn petit" data-action="jour-auj">Aujourd\'hui</button>' : ''}
          </div>
          <h1>${titre}</h1>
          <div class="actions">
            <button class="btn primaire" data-action="ajouter" data-repas="${repasDuMoment()}">${ICONES.plus}Ajouter un aliment</button>
            ${nbHier ? `<button class="btn" data-action="copier-veille">Copier la veille (${pluriel(nbHier, 'aliment')})</button>` : ''}
          </div>
        </div>
      </section>
      ${alerteCible(cible)}
      ${d.methode === 'poids' ? '<p class="aide note-degradee"><b>Estimation dégradée</b> : dépense calculée sur ton poids seul. Ajoute ton sexe, ton année de naissance et ta taille dans Activité → Profil pour un calcul plus juste.</p>' : ''}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Nutriments du jour <span>${Object.values(E.profil.cibles || {}).some((x) => x) ? 'Barres : part de ta cible.' : 'Ajoute des cibles dans ton profil pour voir les barres.'}</span></h2>
      <div class="macros">${macros}</div>
      <h2 class="titre-section">Repas</h2>
      <div class="repas-grille">${blocs}</div>
      ${piedSante()}`;
  }
  function repasDuMoment() {
    if (jourJournal !== auj()) return 'dej';
    const h = new Date().getHours();
    return h < 11 ? 'pdj' : h < 15 ? 'dej' : h < 18 ? 'col' : 'din';
  }

  // Activité : dépense, profil, poids, séances
  function vueActivite() {
    const t = auj();
    const d = depense(t);
    const p = E.profil;
    const age = R.ageEn(p.annee, t);
    const act = activite(p.activite);
    const methode = d.methode === 'mifflin' ? `Mifflin-St Jeor (${p.sexe === 'h' ? 'homme' : 'femme'}, ${age} ans, ${nf(p.taille)} cm, ${nf(d.poids, 1)} kg)`
      : d.methode === 'poids' ? `Estimation dégradée sur le poids seul (${nf(d.poids, 1)} kg)` : d.methode === 'manuelle' ? 'Dépense de repos saisie à la main' : 'Poids manquant';
    const lignesDep = d.methode === 'manuelle'
      ? `<tr><td>Dépense de repos saisie</td><td class="nb">${kcal(d.repos)}</td></tr>`
      : d.base != null ? `<tr><td>Métabolisme de base<small>${esc(methode)}</small></td><td class="nb">${kcal(d.base)}</td></tr><tr><td>× facteur d'activité hors sport<small>${p.facteurPerso ? 'Facteur personnalisé' : esc(act?.nom || '') + ' (valeur moyenne, réglable)'}</small></td><td class="nb">× ${nf(d.facteur, 3)}</td></tr><tr><td>= dépense de repos et de vie courante</td><td class="nb">${kcal(d.repos)}</td></tr>` : '<tr><td colspan="2">Ajoute ton poids pour calculer ta dépense.</td></tr>';
    const seancesJour = E.seances.filter((s) => s.j === t);
    const cible = R.cibleKcal(d.total, p.objectif, p.ecart);
    const pesees = [...E.pesees].sort((a, b) => b.j.localeCompare(a.j));
    const recentes = [...E.seances].filter((s) => s.j >= ajout(t, -13)).sort((a, b) => b.j.localeCompare(a.j) || 0);
    const objectifTexte = p.objectif === 'perte' ? `Perte : ${nf(p.ecart)} % sous ta dépense` : p.objectif === 'prise' ? `Prise : ${nf(p.ecart)} % au-dessus de ta dépense` : 'Maintien';
    return `
      <div class="vue-tete"><div><h1>Activité</h1><p>Ta dépense du jour, ton poids et tes séances de sport.</p></div>
        <div class="actions"><button class="btn primaire" data-action="seance-nouvelle">${ICONES.plus}Ajouter une séance</button><button class="btn" data-action="pesee-nouvelle">Noter mon poids</button></div></div>
      ${alerteCible(cible)}
      <div class="deux-colonnes">
        <section class="carte-bloc">
          <div class="bloc-tete" style="--c:var(--bleu)"><h2>Dépense d'aujourd'hui</h2><b>${d.total == null ? '–' : kcal(d.total)}</b></div>
          <table class="calcul"><tbody>
            ${lignesDep}
            <tr><td>+ séances de sport du jour<small>${seancesJour.length ? seancesJour.map((s) => `${esc(s.nom)}, ${s.min} min`).join(' · ') : 'Aucune séance aujourd\'hui'}</small></td><td class="nb">${kcal(d.sport)}</td></tr>
            <tr class="total"><td>Dépense totale</td><td class="nb">${d.total == null ? '–' : kcal(d.total)}</td></tr>
            <tr><td>Objectif<small>${objectifTexte}</small></td><td class="nb">${cible == null ? '–' : `cible ${kcal(cible)}`}</td></tr>
          </tbody></table>
          ${d.horsPopulation ? '<p class="aide">L\'équation a été établie sur des adultes de 19 à 78 ans : en dehors, l\'estimation est moins fiable.</p>' : ''}
          <p class="aide">Séance : (MET − 1) × poids × durée en heures. Le « − 1 » retire la dépense de repos, déjà comptée ; le niveau d'activité décrit donc ta vie <b>hors séances</b>.</p>
          <div class="bloc-pied"><button class="btn petit" data-action="profil">Modifier mon profil</button></div>
        </section>
        <section class="carte-bloc">
          <div class="bloc-tete" style="--c:var(--jaune);--t:var(--encre)"><h2>Poids</h2><b>${pesees.length ? `${nf(pesees[0].kg, 1)} kg` : '–'}</b></div>
          ${courbePoids(90)}
          ${pesees.length ? `<ul class="liste-simple">${pesees.slice(0, 6).map((x) => `<li><span>${quand(x.j)}</span><b>${nf(x.kg, 1)} kg</b><button class="btn petit lien" data-action="pesee-suppr" data-id="${x.id}" aria-label="Supprimer la pesée du ${fmt(x.j)}">Supprimer</button></li>`).join('')}</ul>` : '<p class="vide-court">Aucune pesée.</p>'}
          <div class="bloc-pied"><button class="btn petit" data-action="pesee-nouvelle">Noter mon poids</button></div>
        </section>
      </div>
      <h2 class="titre-section">Séances des 14 derniers jours <span>${pluriel(recentes.length, 'séance')}</span></h2>
      ${recentes.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Jour</th><th>Activité</th><th class="nb">Durée</th><th class="nb">MET</th><th class="nb">Dépense</th><th></th></tr></thead><tbody>${recentes.map((s) => `<tr><td>${quand(s.j)}</td><td>${esc(s.nom)}</td><td class="nb">${s.min} min</td><td class="nb">${nf(s.met, 1)}</td><td class="nb">${kcal(R.depenseSport(s.met, R.poidsAu(E.pesees, s.j), s.min))}</td><td class="nb"><button class="btn petit lien" data-action="seance-modifier" data-id="${s.id}">Modifier</button></td></tr>`).join('')}</tbody></table></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune séance récente</h3><p>Ajoute tes séances de sport : leur dépense s'ajoute à celle du jour.</p><div class="actions"><button class="btn primaire" data-action="seance-nouvelle">Ajouter une séance</button></div></div></div>`}
      <p class="source">Valeurs MET : ${esc(B.sources.met.nom)} (${esc(B.sources.met.reference)}), <a href="${B.sources.met.url}" target="_blank" rel="noopener">pacompendium.com</a>. Métabolisme : ${esc(B.sources.mifflin.reference)}. Facteurs d'activité : coefficients d'usage courant, modifiables dans ton profil.</p>`;
  }

  // ---------- Graphiques ----------
  const largeurGraphe = () => Math.max(320, Math.min(1100, ($('#vue')?.clientWidth || 900) - 40));
  function courbePoids(n, large = false) {
    const t = auj();
    const de = ajout(t, -n + 1);
    const pts = E.pesees.filter((p) => p.j >= de).sort((a, b) => a.j.localeCompare(b.j));
    if (pts.length < 2) return '<p class="vide-court">La courbe apparaît à partir de deux pesées sur les 90 derniers jours.</p>';
    const W = large ? largeurGraphe() : Math.min(largeurGraphe(), 560), H = 200, g = 40, dr = 12, h = 18, b = 28;
    const min = Math.floor(Math.min(...pts.map((p) => p.kg)) - 0.5), max = Math.ceil(Math.max(...pts.map((p) => p.kg)) + 0.5);
    const x0 = pts[0].j;
    const span = Math.max(1, R.ecart(x0, t));
    const X = (j) => g + (R.ecart(x0, j) / span) * (W - g - dr);
    const Y = (kg) => h + (1 - (kg - min) / (max - min)) * (H - h - b);
    const visibles = pts.filter((p) => p.j >= x0);
    const pas = Math.max(1, Math.ceil((max - min) / 4));
    const graduations = [];
    for (let v = min; v <= max; v += pas) graduations.push(v);
    const chemin = visibles.map((p, i) => `${i ? 'L' : 'M'}${X(p.j).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ');
    return `<figure class="graphique compact" data-graphe="poids">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de poids">
        ${graduations.map((v) => `<line class="grille" x1="${g}" x2="${W - dr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axe" x="${g - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        <line class="base" x1="${g}" x2="${W - dr}" y1="${H - b}" y2="${H - b}"/>
        <text class="axe" x="${g}" y="${H - 8}">${fmt(x0, { day: 'numeric', month: 'short' })}</text><text class="axe" x="${W - dr}" y="${H - 8}" text-anchor="end">aujourd'hui</text>
        <path d="${chemin}" fill="none" stroke="var(--encre)" stroke-width="2"/>
        ${visibles.map((p) => `<circle cx="${X(p.j)}" cy="${Y(p.kg)}" r="5" fill="var(--jaune)" stroke="var(--encre)" stroke-width="2"><title>${fmt(p.j)} : ${nf(p.kg, 1)} kg</title></circle>`).join('')}
      </svg>
      <table class="sr-only"><caption>Pesées</caption><tbody>${visibles.map((p) => `<tr><td>${fmt(p.j)}</td><td>${nf(p.kg, 1)} kg</td></tr>`).join('')}</tbody></table>
    </figure>`;
  }

  // Mangé (barres) et dépensé (repère horizontal) par jour : même unité, un seul axe.
  function grapheBilan(lignes) {
    const W = largeurGraphe(), tel = W < 560, H = tel ? 230 : 260, g = 44, dr = 8, h = 16, b = 30;
    const max = Math.max(1000, ...lignes.map((l) => Math.max(l.mange || 0, l.depense || 0))) * 1.08;
    const pasY = max > 3500 ? 1000 : 500;
    const n = lignes.length, larg = (W - g - dr) / n;
    const Y = (v) => h + (1 - v / max) * (H - h - b);
    const lb = Math.min(56, Math.max(4, larg - (n > 14 ? 3 : 8)));
    const graduations = [];
    for (let v = 0; v <= max; v += pasY) graduations.push(v);
    const freq = tel ? (n > 14 ? 7 : 3) : (n > 14 ? 5 : 1);
    const barres = lignes.map((l, i) => {
      const x = g + i * larg + (larg - lb) / 2;
      const haut = l.vide ? 0 : Y(0) - Y(l.mange);
      const depasse = !l.vide && l.depense && l.mange > l.depense;
      const etiq = (n - 1 - i) % freq === 0 ? `<text class="axe" x="${x + lb / 2}" y="${H - 10}" text-anchor="middle">${n > 14 ? R.versDate(l.j).getDate() : fmt(l.j, { weekday: 'short' }).replace('.', '')}</text>` : '';
      return `<g class="colonne" data-i="${i}">
        ${l.vide ? `<rect x="${x}" y="${Y(0) - 6}" width="${lb}" height="6" fill="url(#hachures)"/>` : `<rect x="${x}" y="${Y(0) - haut}" width="${lb}" height="${Math.max(0, haut)}" fill="${depasse ? 'var(--rouge)' : 'var(--bleu)'}"/>`}
        ${l.depense ? `<line x1="${x - 2}" x2="${x + lb + 2}" y1="${Y(l.depense)}" y2="${Y(l.depense)}" stroke="var(--encre)" stroke-width="3"/>` : ''}
        ${etiq}
      </g><rect class="zone" x="${g + i * larg}" y="${h}" width="${larg}" height="${H - h - b}" data-i="${i}"/>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories mangées et dépensées par jour">
      <defs><pattern id="hachures" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--discret)" stroke-width="2"/></pattern></defs>
      ${graduations.map((v) => `<line class="grille" x1="${g}" x2="${W - dr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axe" x="${g - 6}" y="${Y(v) + 4}" text-anchor="end">${nf(v)}</text>`).join('')}
      <line class="base" x1="${g}" x2="${W - dr}" y1="${Y(0)}" y2="${Y(0)}"/>
      ${barres}
    </svg>`;
  }

  function brancherGraphiques() {
    const fig = $('#graphique-bilan');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const lignes = R.bilan({ etat: E, jours: R.joursJusqua(auj(), periodeBilan), activites: B.activites }).lignes;
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), l = lignes[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = `<b>${fmt(l.j, { weekday: 'long', day: 'numeric', month: 'long' })}</b>${l.vide ? '<div>Aucun repas noté</div>' : `<div>Mangé : ${kcal(l.mange)}</div>`}<div>Dépensé : ${l.depense == null ? '–' : kcal(l.depense)}</div>${l.facteur != null ? `<div>Facteur : ${nf(l.facteur, 2)}</div>` : ''}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '56px';
    };
    fig.querySelectorAll('.zone').forEach((z) => { z.addEventListener('pointerenter', () => montrer(z)); z.addEventListener('click', () => montrer(z)); });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((g) => g.classList.remove('active')); });
  }

  // Bilan
  function vueBilan() {
    const t = auj();
    const jours = R.joursJusqua(t, periodeBilan);
    const bi = R.bilan({ etat: E, jours, activites: B.activites });
    const vise = R.facteurVise(E.profil.objectif, E.profil.ecart);
    const ok = R.respecte(bi.facteur, E.profil.objectif, E.profil.ecart);
    const vp = R.variationPoids(E.pesees, jours[0], t);
    const tuiles = [
      [`Facteur ${periodeBilan} jours`, bi.facteur == null ? '–' : nf(bi.facteur, 2), '', `Total mangé ÷ total dépensé, sur ${pluriel(bi.joursNotes, 'jour noté', 'jours notés')}. Visé : ${nf(vise, 2)}.`, ok === false ? 'var(--rouge)' : 'var(--encre)', 'rond'],
      ['Mangé par jour', bi.moyenneMange == null ? '–' : nf(Math.round(bi.moyenneMange)), 'kcal', 'Moyenne des jours notés.', 'var(--jaune)', ''],
      ['Dépensé par jour', bi.moyenneDepense == null ? '–' : nf(Math.round(bi.moyenneDepense)), 'kcal', 'Repos, vie courante et sport.', 'var(--bleu)', ''],
      ['Poids', vp ? `${vp.kg > 0 ? '+' : vp.kg < 0 ? '−' : ''}${nf(Math.abs(vp.kg), 1)}` : '–', vp ? 'kg' : '', vp ? `De ${nf(vp.de.kg, 1)} à ${nf(vp.a.kg, 1)} kg sur la période.` : 'Deux pesées sur la période au minimum.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const macros = B.nutriments.map((n) => {
      const m = bi.macros[n.id], c = n.id === 'kcal' ? R.cibleKcal(bi.moyenneDepense, E.profil.objectif, E.profil.ecart) : E.profil.cibles?.[n.id];
      const d = n.id === 'sel' ? 1 : 0;
      return `<tr><td>${n.nom}</td><td class="nb">${m == null ? '–' : `${nf(m, d)} ${n.unite}`}</td><td class="nb">${c ? `${nf(c, d)} ${n.unite}` : '–'}</td><td class="nb">${m != null && c ? `${nf((m / c) * 100)} %` : '–'}</td></tr>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Facteur calorique, moyennes et poids. Les jours sans repas noté sont exclus des moyennes.</p></div>
        <div class="segment petit" role="group" aria-label="Période">${[7, 30].map((n) => `<button class="${periodeBilan === n ? 'actif' : ''}" data-action="periode" data-n="${n}" aria-pressed="${periodeBilan === n}">${n} jours</button>`).join('')}</div></div>
      ${bi.joursNotes ? '' : `<div class="vide-etat" style="margin-bottom:20px">${FORME_VIDE}<div><h3>Pas encore de repas sur la période</h3><p>Note tes repas dans le Journal : le bilan se remplit jour après jour.</p></div></div>`}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Mangé et dépensé par jour</h2>
      <figure class="graphique" id="graphique-bilan">
        <div class="graphique-tete"><h2>Calories par jour</h2><div class="legende"><span><i style="background:var(--bleu)"></i>Mangé</span><span><i style="background:var(--rouge)"></i>Mangé au-delà de la dépense</span><span><i class="trait"></i>Dépensé</span><span><i style="background:repeating-linear-gradient(45deg,var(--surface) 0 2px,var(--discret) 2px 4px)"></i>Non noté</span></div></div>
        ${grapheBilan(bi.lignes)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Calories mangées et dépensées par jour</caption><thead><tr><th>Jour</th><th>Mangé</th><th>Dépensé</th><th>Facteur</th></tr></thead><tbody>${bi.lignes.map((l) => `<tr><td>${fmt(l.j)}</td><td>${l.vide ? 'non noté' : kcal(l.mange)}</td><td>${l.depense == null ? '–' : kcal(l.depense)}</td><td>${l.facteur == null ? '–' : nf(l.facteur, 2)}</td></tr>`).join('')}</tbody></table>
      </figure>
      <h2 class="titre-section">Nutriments, moyenne par jour noté</h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Nutriment</th><th class="nb">Moyenne</th><th class="nb">Cible</th><th class="nb">Part</th></tr></thead><tbody>${macros}</tbody></table></div>
      <h2 class="titre-section">Courbe de poids</h2>
      <div class="carte-bloc">${courbePoids(90, true)}</div>
      ${piedSante()}`;
  }

  // Menus et liste de courses
  const JOURS_SEM = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  function vueMenus() {
    const liste = R.listeCourses(E.menus, E.semaine, E.aliments);
    const parGroupe = new Map();
    liste.forEach((l) => { const k = l.groupe || 'autres'; if (!parGroupe.has(k)) parGroupe.set(k, []); parGroupe.get(k).push(l); });
    const coches = new Set(E.coches);
    const cartes = E.menus.map((m) => {
      const tm = R.totauxMenu(m, E.aliments);
      return `<article class="menu">
        <div class="menu-tete"><h2>${esc(m.nom)}</h2><button data-action="menu-modifier" data-id="${m.id}">Modifier</button></div>
        <div class="menu-chiffres"><div><b>${nf(Math.round(tm.kcal))}</b><span>kcal</span></div><div><b>${nf(tm.prot)}</b><span>g protéines</span></div><div><b>${nf(tm.fib)}</b><span>g fibres</span></div></div>
        ${B.repas.map((r) => { const its = m.items.filter((x) => x.r === r.id); return its.length ? `<div class="menu-repas"><p class="surtitre">${r.nom}</p><p>${its.map((x) => `${esc(E.aliments[x.c]?.n || '?')} <small>${nf(x.q)} g</small>`).join(' · ')}</p></div>` : ''; }).join('')}
        <div class="menu-pied"><button class="btn petit" data-action="menu-appliquer" data-id="${m.id}">Copier dans le journal</button></div>
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Menus types</h1><p>Compose des journées types avec les aliments de la base, place-les sur la semaine : la liste de courses se calcule seule.</p></div>
        <div class="actions"><button class="btn primaire" data-action="menu-nouveau">${ICONES.plus}Nouveau menu</button></div></div>
      ${E.menus.length ? `<div class="menus">${cartes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun menu type</h3><p>Un menu type est une journée de repas que tu réutilises (par exemple « journée légère » ou « jour d'entraînement »).</p><div class="actions"><button class="btn primaire" data-action="menu-nouveau">Créer un menu</button></div></div></div>`}
      <h2 class="titre-section">Semaine <span>Un menu par jour, ou rien.</span></h2>
      <div class="semaine">${JOURS_SEM.map((nom, i) => `<label class="champ"><span>${nom}</span><select data-action="semaine" data-i="${i}"><option value="">—</option>${E.menus.map((m) => `<option value="${m.id}" ${E.semaine[i] === m.id ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>`).join('')}</div>
      <h2 class="titre-section">Liste de courses <span>${liste.length ? `${pluriel(liste.length, 'article')} · ${pluriel(liste.filter((l) => coches.has(l.c)).length, 'coché')}` : ''}</span></h2>
      ${liste.length ? `<div class="courses">${[...parGroupe].map(([g, ls]) => `<section class="rayon"><h3>${esc(g.charAt(0).toUpperCase() + g.slice(1))}</h3>${ls.map((l) => `<label class="case article ${coches.has(l.c) ? 'fait' : ''}"><input type="checkbox" data-action="cocher" value="${l.c}" ${coches.has(l.c) ? 'checked' : ''}><span>${esc(l.nom)}</span><b>${R.quantiteCourses(l.q)}</b></label>`).join('')}</section>`).join('')}</div>
        <div class="rang-actions"><button class="btn petit" data-action="courses-copier">Copier la liste</button><button class="btn petit" data-action="courses-decocher">Tout décocher</button></div>
        <p class="aide">Quantités en grammes d'aliment tel que décrit dans la base (cuit, cru…) : adapte-les au moment des courses.</p>`
        : '<p class="vide-court">Place au moins un menu sur la semaine pour obtenir la liste.</p>'}`;
  }

  // Aliments : recherche dans la base, mes aliments, repas enregistrés
  function vueAliments() {
    const perso = Object.entries(E.aliments).filter(([, a]) => a.perso);
    const favoris = E.favoris.filter((c) => E.aliments[c] || parCodeBase?.get(c));
    return `
      <div class="vue-tete"><div><h1>Aliments</h1><p>Valeurs pour 100 g. Recherche insensible aux accents dans les ${window.CIQUAL ? nf(window.CIQUAL.aliments.length) : 'quelque 3 300'} aliments de la table Ciqual.</p></div>
        <div class="actions"><button class="btn primaire" data-action="perso-nouveau">${ICONES.plus}Créer un aliment</button></div></div>
      <label class="champ recherche-grande">Rechercher un aliment<input id="recherche-aliments" type="search" value="${esc(rechercheAliments)}" placeholder="Ex. : yaourt nature, pomme, riz complet" autocomplete="off"></label>
      <div id="resultats-aliments" class="resultats-table"></div>
      <h2 class="titre-section">Favoris <span>${pluriel(favoris.length, 'aliment')}</span></h2>
      ${favoris.length ? `<div class="puces-aliments">${favoris.map((c) => `<button class="puce" data-action="fiche" data-code="${c}">${esc(aliment(c)?.n)}</button>`).join('')}</div>` : '<p class="vide-court">Marque un aliment d\'une étoile pour le retrouver en tête des recherches.</p>'}
      <h2 class="titre-section">Mes aliments <span>Recettes maison ou produits lus sur l'emballage.</span></h2>
      ${perso.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Aliment</th><th class="nb">kcal</th><th class="nb">Prot.</th><th class="nb">Gluc.</th><th class="nb">Lip.</th><th></th></tr></thead><tbody>${perso.map(([c, a]) => `<tr><td>${esc(a.n)}</td><td class="nb">${nf(a.v[0])}</td><td class="nb">${nf(a.v[1], 1)}</td><td class="nb">${nf(a.v[2], 1)}</td><td class="nb">${nf(a.v[3], 1)}</td><td class="nb"><button class="btn petit lien" data-action="fiche" data-code="${c}">Ouvrir</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="vide-court">Aucun aliment personnel.</p>'}
      <h2 class="titre-section">Repas enregistrés <span>À ajouter d'un geste depuis le Journal.</span></h2>
      ${E.repasEnr.length ? `<ul class="liste-simple large">${E.repasEnr.map((r) => { const tr = R.totaux(r.items, E.aliments); return `<li><span><b>${esc(r.nom)}</b><small>${r.items.map((x) => esc(E.aliments[x.c]?.n || '?')).join(' · ')}</small></span><b>${kcal(tr.kcal)}</b><button class="btn petit lien" data-action="repas-enr-suppr" data-id="${r.id}">Supprimer</button></li>`; }).join('')}</ul>` : '<p class="vide-court">Dans le Journal, « Enregistrer ce repas » garde un repas pour le réutiliser.</p>'}
      <p class="source">Base aliments : ${esc(window.CIQUAL?.source || 'Anses, Table de composition nutritionnelle des aliments Ciqual')} — ${esc(window.CIQUAL?.version || 'Ciqual 2025')}, ${esc(window.CIQUAL?.licence || 'Licence Ouverte 2.0')}, <a href="https://doi.org/10.57745/RDMHWY" target="_blank" rel="noopener">doi.org/10.57745/RDMHWY</a>. Données réduites (énergie, protéines, glucides, lipides, fibres, sucres, sel) ; « traces » et valeurs sous le seuil de quantification comptées 0 ; aliments sans valeur énergétique et aliments infantiles retirés.</p>`;
  }

  function brancherRechercheAliments() {
    const champ = $('#recherche-aliments');
    const zone = $('#resultats-aliments');
    const afficher = () => {
      rechercheAliments = champ.value;
      if (!rechercheAliments.trim()) { zone.innerHTML = ''; return; }
      if (!indexBase) { zone.innerHTML = '<p class="vide-court">Chargement de la base…</p>'; chargerBase().then(afficher).catch(() => { zone.innerHTML = '<p class="erreur">Base indisponible hors ligne tant qu\'elle n\'a pas été chargée une première fois.</p>'; }); return; }
      const res = R.rechercher([...persoIndex(), ...indexBase], rechercheAliments, 40);
      zone.innerHTML = res.length ? `<div class="defile"><table class="tableau cliquable"><thead><tr><th>Aliment</th><th class="nb">kcal</th><th class="nb">Prot.</th><th class="nb">Gluc.</th><th class="nb">Lip.</th></tr></thead><tbody>${res.map((x) => { const a = aliment(x.code); return `<tr data-action="fiche" data-code="${x.code}" tabindex="0"><td>${E.favoris.includes(x.code) ? '★ ' : ''}${esc(a.n)}</td><td class="nb">${nf(a.v[0])}</td><td class="nb">${a.v[1] == null ? '–' : nf(a.v[1], 1)}</td><td class="nb">${a.v[2] == null ? '–' : nf(a.v[2], 1)}</td><td class="nb">${a.v[3] == null ? '–' : nf(a.v[3], 1)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="vide-court">Aucun aliment ne correspond. Essaie un mot plus court, ou crée l\'aliment.</p>';
    };
    champ.addEventListener('input', afficher);
    if (rechercheAliments) afficher();
  }
  const persoIndex = () => Object.entries(E.aliments).filter(([, a]) => a.perso).map(([code, a]) => ({ code, nom: a.n, cle: R.sansAccents(a.n), perso: true }));

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

  // Quantité : grammes ou portions définies pour l'aliment.
  function champsQuantite(code, q = 100, portion = null) {
    const ps = E.portions[code] || [];
    const idx = portion ? ps.findIndex((p) => p.n === portion.n) : -1;
    return `<div class="quantite">
      <label class="champ">Quantité<input name="quantite" inputmode="decimal" value="${idx >= 0 ? nf(portion.k, 2).replace(/,?0+$/, '') : nf(q)}" required></label>
      <label class="champ">Unité<select name="unite"><option value="g">grammes</option>${ps.map((p, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${esc(p.n)} (${nf(p.g)} g)</option>`).join('')}</select></label>
    </div>
    <button type="button" class="btn petit lien" data-action="portion-nouvelle" data-code="${code}">Définir une portion pour cet aliment</button>`;
  }
  function lireQuantite(f, code) {
    const n = lireNombre(f.get('quantite'));
    if (n === null || Number.isNaN(n) || n <= 0 || n > 5000) return 'Quantité : un nombre positif.';
    const u = f.get('unite');
    if (u === 'g' || u == null) return { q: n };
    const p = (E.portions[code] || [])[Number(u)];
    if (!p) return { q: n };
    return { q: n * p.g, p: { n: p.n, k: n } };
  }
  const ligneValeurs = (a) => `<p class="valeurs-100">Pour 100 g : <b>${nf(a.v[0])} kcal</b> · protéines ${a.v[1] == null ? '–' : nf(a.v[1], 1)} g · glucides ${a.v[2] == null ? '–' : nf(a.v[2], 1)} g · lipides ${a.v[3] == null ? '–' : nf(a.v[3], 1)} g · fibres ${a.v[4] == null ? '–' : nf(a.v[4], 1)} g · sucres ${a.v[5] == null ? '–' : nf(a.v[5], 1)} g · sel ${a.v[6] == null ? '–' : nf(a.v[6], 2)} g</p>`;

  // Ajout d'un aliment : au journal (cible.jour) ou à un menu (cible.menu).
  function modaleAjout(cible) {
    let choix = cible.code || null;
    const recents = () => {
      const vus = [];
      for (let i = E.journal.length - 1; i >= 0 && vus.length < 10; i--) { const c = E.journal[i].c; if (!vus.includes(c) && !E.favoris.includes(c) && E.aliments[c]) vus.push(c); }
      return vus;
    };
    const corps = `
      <div class="etape-recherche">
        <label class="champ">Rechercher<input id="recherche-ajout" type="search" autocomplete="off" placeholder="Ex. : pain complet, œuf dur, lait"></label>
        <div id="resultats-ajout" class="resultats" role="listbox" aria-label="Aliments"></div>
      </div>
      <div class="etape-detail" hidden></div>
      <p class="erreur" role="alert"></p>`;
    const titre = cible.menu ? 'Ajouter au menu' : `Ajouter · ${esc(fmt(cible.jour, { day: 'numeric', month: 'short' }))}`;
    ouvrirModale(titre, corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      if (!choix) return 'Choisis un aliment dans la liste.';
      const qt = lireQuantite(f, choix);
      if (typeof qt === 'string') return qt;
      const avant = instantane();
      retenir(choix);
      const r = f.get('repas') || cible.repas;
      if (cible.menu) {
        const m = E.menus.find((x) => x.id === cible.menu);
        m.items.push({ r, c: choix, ...qt });
        sauver(); rendre(); setTimeout(() => modaleMenu(m.id), 0);
        return;
      }
      E.journal.push({ id: uid(), j: cible.jour, r, c: choix, ...qt });
      sauver(); rendre();
      annulable(avant, `${E.aliments[choix].n} ajouté au ${nomRepas(r).toLowerCase()} (${kcal(R.valeurs(E.aliments[choix], qt.q).kcal)}).`);
    });
    const champ = $('#recherche-ajout');
    const zone = $('#resultats-ajout');
    const detail = $('.etape-detail');
    const bouton = (code, etiquette = '') => { const a = aliment(code); return a ? `<button type="button" class="resultat" data-choisir="${code}"><span>${etiquette}${esc(a.n)}</span><small>${nf(a.v[0])} kcal / 100 g</small></button>` : ''; };
    const lister = () => {
      const q = champ.value.trim();
      if (!q) {
        const fav = E.favoris.filter((c) => aliment(c)), rec = recents(), perso = persoIndex().map((x) => x.code).filter((c) => !fav.includes(c) && !rec.includes(c));
        zone.innerHTML = (fav.length ? `<p class="surtitre">Favoris</p>${fav.map((c) => bouton(c, '★ ')).join('')}` : '')
          + (rec.length ? `<p class="surtitre">Récents</p>${rec.map((c) => bouton(c)).join('')}` : '')
          + (perso.length ? `<p class="surtitre">Mes aliments</p>${perso.map((c) => bouton(c)).join('')}` : '')
          || '<p class="vide-court">Tape le nom d\'un aliment.</p>';
        return;
      }
      if (!indexBase) { zone.innerHTML = '<p class="vide-court">Chargement de la base aliments…</p>'; chargerBase().then(lister).catch(() => { zone.innerHTML = '<p class="erreur">Base aliments indisponible : connecte-toi une première fois pour la charger.</p>'; }); return; }
      const res = R.rechercher([...persoIndex(), ...indexBase], q, 30);
      const fav = res.filter((x) => E.favoris.includes(x.code)), autres = res.filter((x) => !E.favoris.includes(x.code));
      zone.innerHTML = res.length ? [...fav, ...autres].map((x) => bouton(x.code, E.favoris.includes(x.code) ? '★ ' : '')).join('') : '<p class="vide-court">Aucun résultat. Essaie un autre mot, ou crée l\'aliment dans l\'onglet Aliments.</p>';
    };
    const montrer = (code, q, portion, repas) => {
      choix = code;
      const a = aliment(code);
      let repasCourant = repas || cible.repas;
      apresPortion = () => modaleAjout({ ...cible, code, repas: repasCourant });
      $('.etape-recherche').hidden = true;
      detail.hidden = false;
      detail.innerHTML = `
        <div class="detail-tete"><div><p class="surtitre">${esc(a.g || (a.perso ? 'Mon aliment' : ''))}</p><h3>${esc(a.n)}</h3></div>
          <button type="button" class="btn-icone etoile ${E.favoris.includes(code) ? 'actif' : ''}" data-action="favori" data-code="${code}" aria-pressed="${E.favoris.includes(code)}" aria-label="Favori">${ICONES.etoile}</button></div>
        ${ligneValeurs(a)}
        ${champsQuantite(code, q ?? 100, portion)}
        <label class="champ">Repas<select name="repas">${B.repas.map((r) => `<option value="${r.id}" ${r.id === (repas || cible.repas) ? 'selected' : ''}>${r.nom}</option>`).join('')}</select></label>
        <p class="apercu" aria-live="polite"></p>
        <button type="button" class="btn petit lien" data-retour>← Choisir un autre aliment</button>`;
      const form = modale().querySelector('form');
      const apercu = () => {
        const qt = lireQuantite(new FormData(form), code);
        const p = detail.querySelector('.apercu');
        if (typeof qt === 'string') { p.textContent = ''; return; }
        const v = R.valeurs(a, qt.q);
        p.innerHTML = `${nf(qt.q)} g : <b>${kcal(v.kcal)}</b> · P ${nf(v.prot, 1)} g · G ${nf(v.gluc, 1)} g · L ${nf(v.lip, 1)} g`;
      };
      detail.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', apercu));
      detail.querySelector('select[name=repas]').addEventListener('change', (ev) => { repasCourant = ev.target.value; });
      apercu();
      detail.querySelector('[data-retour]').addEventListener('click', () => { choix = null; detail.hidden = true; $('.etape-recherche').hidden = false; champ.focus(); });
      detail.querySelector('input[name=quantite]').focus();
      detail.querySelector('input[name=quantite]').select();
    };
    zone.addEventListener('click', (e) => { const b = e.target.closest('[data-choisir]'); if (b) montrer(b.dataset.choisir); });
    champ.addEventListener('input', lister);
    // Entrée dans la recherche : prend le premier résultat au lieu d'envoyer le formulaire.
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = zone.querySelector('[data-choisir]'); if (b) montrer(b.dataset.choisir); } });
    if (choix) montrer(choix, cible.q, cible.p, cible.repas); else lister();
    chargerBase().catch(() => {});
  }

  function modaleEntree(id) {
    const e = E.journal.find((x) => x.id === id);
    if (!e) return;
    const a = E.aliments[e.c];
    apresPortion = () => modaleEntree(id);
    const corps = `<div class="detail-tete"><div><p class="surtitre">${esc(a?.g || '')}</p><h3>${esc(a?.n || 'Aliment inconnu')}</h3></div></div>
      ${a ? ligneValeurs(a) : ''}
      ${champsQuantite(e.c, e.q, e.p)}
      <label class="champ">Repas<select name="repas">${B.repas.map((r) => `<option value="${r.id}" ${r.id === e.r ? 'selected' : ''}>${r.nom}</option>`).join('')}</select></label>
      <label class="champ">Jour<input type="date" name="jour" value="${e.j}" max="${auj()}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Modifier', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (f, action) => {
      const avant = instantane();
      if (action === 'supprimer') {
        E.journal = E.journal.filter((x) => x.id !== id);
        sauver(); rendre(); annulable(avant, `${a?.n || 'Aliment'} retiré du journal.`);
        return;
      }
      const qt = lireQuantite(f, e.c);
      if (typeof qt === 'string') return qt;
      const j = f.get('jour') || e.j;
      if (j > auj()) return 'Le jour ne peut pas être dans le futur.';
      Object.assign(e, { q: qt.q, r: f.get('repas'), j });
      if (qt.p) e.p = qt.p; else delete e.p;
      sauver(); rendre(); toast('Enregistré.');
    });
  }

  function modalePortion(code, retour) {
    const a = aliment(code);
    const ps = E.portions[code] || [];
    const corps = `<p>Portions de <b>${esc(a?.n)}</b>. Le poids se lit sur l'emballage ou se pèse une fois.</p>
      ${ps.length ? `<ul class="liste-simple">${ps.map((p, i) => `<li><span>${esc(p.n)}</span><b>${nf(p.g)} g</b><button type="button" class="btn petit lien" data-suppr-portion="${i}">Supprimer</button></li>`).join('')}</ul>` : ''}
      <div class="quantite">
        <label class="champ">Nom<input name="nom" list="noms-portions" maxlength="40" placeholder="Ex. : 1 tranche"></label>
        <label class="champ">Poids (g)<input name="g" inputmode="decimal" placeholder="Ex. : 30"></label>
      </div>
      <datalist id="noms-portions">${B.nomsPortions.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Portions', corps, '<button class="btn primaire" value="ok">Ajouter la portion</button><button class="btn" value="fini">Terminé</button>', (f, action) => {
      if (action !== 'fini') {
        const nom = String(f.get('nom') || '').trim(), g = lireNombre(f.get('g'));
        if (!nom) return 'Donne un nom à la portion.';
        if (g === null || Number.isNaN(g) || g <= 0 || g > 3000) return 'Poids de la portion en grammes.';
        retenir(code);
        E.portions[code] = [...ps.filter((p) => p.n !== nom), { n: nom, g }];
        sauver();
      }
      setTimeout(() => (retour ? retour() : modalePortion(code)), 0);
    });
    modale().querySelectorAll('[data-suppr-portion]').forEach((b) => b.addEventListener('click', () => {
      E.portions[code] = ps.filter((_, i) => i !== Number(b.dataset.supprPortion));
      if (!E.portions[code].length) delete E.portions[code];
      sauver(); modalePortion(code, retour);
    }));
  }

  // Fiche d'un aliment (onglet Aliments) : valeurs, favori, portions, ajout au journal.
  function modaleFiche(code) {
    const a = aliment(code);
    if (!a) return;
    const ps = E.portions[code] || [];
    const corps = `<div class="detail-tete"><div><p class="surtitre">${esc(a.g || (a.perso ? 'Mon aliment' : ''))}</p><h3>${esc(a.n)}</h3></div>
        <button type="button" class="btn-icone etoile ${E.favoris.includes(code) ? 'actif' : ''}" data-action="favori" data-code="${code}" aria-pressed="${E.favoris.includes(code)}" aria-label="Favori">${ICONES.etoile}</button></div>
      <table class="calcul"><tbody>${B.nutriments.map((n, i) => `<tr><td>${n.nom}</td><td class="nb">${a.v[i] == null ? 'non renseigné' : `${nf(a.v[i], n.id === 'kcal' ? 0 : 2).replace(/,00$/, '')} ${n.unite}`}</td></tr>`).join('')}</tbody></table>
      <p class="aide">${a.perso ? 'Aliment créé par toi.' : 'Valeurs pour 100 g, table Ciqual 2025 (Anses).'}${ps.length ? ` Portions : ${ps.map((p) => `${esc(p.n)} = ${nf(p.g)} g`).join(', ')}.` : ''}</p>`;
    const pied = `<button class="btn primaire" value="journal">Ajouter au journal</button><button class="btn" value="portions">Portions</button>${a.perso ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale('Aliment', corps, pied, (f, action) => {
      if (action === 'portions') { setTimeout(() => modalePortion(code, () => modaleFiche(code)), 0); return; }
      if (action === 'supprimer') {
        const utilise = E.journal.some((e) => e.c === code) || E.menus.some((m) => m.items.some((x) => x.c === code));
        if (utilise) { toast('Cet aliment est utilisé dans ton journal ou un menu : il est gardé.'); return; }
        const avant = instantane();
        delete E.aliments[code]; delete E.portions[code]; E.favoris = E.favoris.filter((c) => c !== code);
        sauver(); rendre(); annulable(avant, `${a.n} supprimé.`);
        return;
      }
      setTimeout(() => modaleAjout({ jour: auj(), repas: repasDuMoment(), code }), 0);
    });
  }

  function modalePerso() {
    const corps = `<label class="champ">Nom<input name="nom" required maxlength="80" placeholder="Ex. : Granola maison"></label>
      <p class="aide">Valeurs pour 100 g, lues sur l'emballage ou calculées pour ta recette.</p>
      <div class="grille-nutri">${B.nutriments.map((n) => `<label class="champ">${n.nom} (${n.unite})<input name="${n.id}" inputmode="decimal" ${n.id === 'kcal' ? 'required' : ''}></label>`).join('')}</div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvel aliment', corps, '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'aliment.';
      const v = B.nutriments.map((n) => lireNombre(f.get(n.id)));
      if (v[0] === null) return 'L\'énergie (kcal pour 100 g) est obligatoire.';
      if (v.some((x) => Number.isNaN(x) || (x !== null && (x < 0 || x > 1000)))) return 'Valeurs : des nombres positifs pour 100 g.';
      if (v.slice(1).some((x) => x !== null && x > 100)) return 'Une valeur en grammes ne peut pas dépasser 100 g pour 100 g.';
      const code = `p${uid()}`;
      E.aliments[code] = { n: nom, g: '', v, perso: true };
      sauver(); rendre(); toast(`${nom} créé.`);
    });
  }

  function modaleSeance(id) {
    const s = id ? E.seances.find((x) => x.id === id) : null;
    const t = auj();
    const corps = `
      <label class="champ">Activité<select name="code" required>${B.categoriesSport.map((c) => `<optgroup label="${esc(c.nom)}">${B.sports.filter((x) => x.cat === c.id).map((x) => `<option value="${x.code}" ${s?.code === x.code ? 'selected' : ''}>${esc(x.nom)} · MET ${nf(x.met, 1)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <div class="quantite">
        <label class="champ">Durée (minutes)<input name="min" inputmode="numeric" required value="${s?.min ?? 45}"></label>
        <label class="champ">Jour<input type="date" name="jour" value="${s?.j || t}" max="${t}" required></label>
      </div>
      <p class="apercu" aria-live="polite"></p>
      <p class="aide">Dépense de la séance : (MET − 1) × poids × durée en heures. Valeurs MET du 2024 Adult Compendium of Physical Activities.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = s ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Modifier la séance' : 'Nouvelle séance', corps, pied, (f, action) => {
      const avant = instantane();
      if (action === 'supprimer') { E.seances = E.seances.filter((x) => x.id !== s.id); sauver(); rendre(); annulable(avant, 'Séance supprimée.'); return; }
      const min = lireNombre(f.get('min')), j = f.get('jour'), sp = sportDe(f.get('code'));
      if (!sp) return 'Choisis une activité.';
      if (min === null || Number.isNaN(min) || min < 1 || min > 720 || !Number.isInteger(min)) return 'Durée en minutes entières, entre 1 et 720.';
      if (!j || j > t) return 'Le jour ne peut pas être dans le futur.';
      const val = { j, code: sp.code, nom: sp.nom, met: sp.met, min };
      if (s) Object.assign(s, val); else E.seances.push({ id: uid(), ...val });
      sauver(); rendre();
      const kc = R.depenseSport(sp.met, R.poidsAu(E.pesees, j), min);
      if (s) toast('Séance enregistrée.'); else annulable(avant, `Séance ajoutée : ${kcal(kc)}.`);
    });
    const form = modale().querySelector('form');
    const apercu = () => {
      const f = new FormData(form);
      const sp = sportDe(f.get('code')), min = lireNombre(f.get('min')), p = R.poidsAu(E.pesees, f.get('jour') || t);
      form.querySelector('.apercu').innerHTML = sp && min > 0 && p ? `(${nf(sp.met, 1)} − 1) × ${nf(p, 1)} kg × ${nf(min / 60, 2)} h = <b>${kcal(R.depenseSport(sp.met, p, min))}</b>` : p ? '' : 'Note ton poids pour calculer la dépense.';
    };
    form.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', apercu));
    apercu();
  }

  function modalePesee() {
    const t = auj();
    const dernier = [...E.pesees].sort((a, b) => b.j.localeCompare(a.j))[0];
    const corps = `<div class="quantite"><label class="champ">Poids (kg)<input name="kg" inputmode="decimal" required value="${dernier ? nf(dernier.kg, 1) : ''}"></label>
      <label class="champ">Jour<input type="date" name="jour" value="${t}" max="${t}" required></label></div>
      <p class="aide">Une pesée par jour au plus : une nouvelle pesée le même jour remplace la précédente.</p><p class="erreur" role="alert"></p>`;
    ouvrirModale('Noter mon poids', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const kg = lireNombre(f.get('kg')), j = f.get('jour');
      if (kg === null || Number.isNaN(kg) || kg < 30 || kg > 350) return 'Poids en kilos, entre 30 et 350.';
      if (!j || j > t) return 'Le jour ne peut pas être dans le futur.';
      const avant = instantane();
      E.pesees = E.pesees.filter((p) => p.j !== j);
      E.pesees.push({ id: uid(), j, kg: Math.round(kg * 10) / 10 });
      sauver(); rendre(); annulable(avant, `Poids noté : ${nf(kg, 1)} kg.`);
    });
  }

  function modaleProfil() {
    const p = E.profil;
    const corps = `<div class="form-profil">${champsProfil(p, E.prenom)}</div>
      <details class="avance"><summary>Réglages avancés</summary>
        <label class="champ">Facteur d'activité personnalisé<small>Les niveaux proposés sont des moyennes (sédentaire 1,2 ; légèrement actif 1,375 ; modérément actif 1,55 ; très actif 1,725 ; extrêmement actif 1,9). Ajuste-le si ta dépense réelle s'en écarte (ex. : 1,45), entre 1 et 2,5. Laisse vide pour garder la moyenne.</small><input name="facteurPerso" inputmode="decimal" value="${p.facteurPerso ? nf(p.facteurPerso, 3) : ''}"></label>
        <label class="champ">Dépense de repos connue (kcal par jour)<small>Mesurée par un professionnel : remplace le calcul du métabolisme × facteur. Laisse vide sinon.</small><input name="depenseManuelle" inputmode="numeric" value="${p.depenseManuelle ?? ''}"></label>
      </details>
      <fieldset class="champ sans-cadre"><legend>Cibles par jour (facultatives) <small>Fixe-les avec un professionnel de santé si besoin.</small></legend>
        <div class="grille-nutri">${B.nutriments.filter((n) => n.id !== 'kcal').map((n) => `<label class="champ">${n.nom} (${n.unite})<input name="cible-${n.id}" inputmode="decimal" value="${p.cibles?.[n.id] != null ? nf(p.cibles[n.id], 1).replace(/,0$/, '') : ''}"></label>`).join('')}</div>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Mon profil', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const r = lireProfil(f, false);
      if (typeof r === 'string') return r;
      const fp = lireNombre(f.get('facteurPerso')), dm = lireNombre(f.get('depenseManuelle'));
      if (fp !== null && (Number.isNaN(fp) || fp < 1 || fp > 2.5)) return 'Facteur d\'activité : entre 1 et 2,5.';
      if (dm !== null && (Number.isNaN(dm) || dm < 800 || dm > 6000)) return 'Dépense de repos : entre 800 et 6 000 kcal.';
      const cibles = {};
      for (const n of B.nutriments.filter((x) => x.id !== 'kcal')) {
        const v = lireNombre(f.get(`cible-${n.id}`));
        if (v !== null && (Number.isNaN(v) || v < 0 || v > 1000)) return `Cible ${n.nom.toLowerCase()} : un nombre positif.`;
        if (v !== null) cibles[n.id] = v;
      }
      E.prenom = r.prenom;
      Object.assign(E.profil, r.profil, { facteurPerso: fp, depenseManuelle: dm, cibles });
      sauver(); rendre();
      const c = cibleDu(auj());
      toast(R.cibleTresBasse(c, B.seuilTresBasCalories) ? `Profil enregistré. Attention : cible sous ${nf(B.seuilTresBasCalories)} kcal par jour.` : 'Profil enregistré.');
    });
    brancherEcart(modale().querySelector('form'));
  }

  function modaleRepasEnr(repas) {
    const corps = `<p>Ajoute un repas enregistré au <b>${nomRepas(repas).toLowerCase()}</b> du ${fmt(jourJournal, { day: 'numeric', month: 'long' })}.</p>
      <div class="resultats">${E.repasEnr.map((r) => `<button type="button" class="resultat" data-repas-enr="${r.id}"><span>${esc(r.nom)}</span><small>${kcal(R.totaux(r.items, E.aliments).kcal)} · ${pluriel(r.items.length, 'aliment')}</small></button>`).join('')}</div>`;
    ouvrirModale('Repas enregistrés', corps, '<button class="btn" value="annuler">Fermer</button>');
    modale().querySelectorAll('[data-repas-enr]').forEach((b) => b.addEventListener('click', () => {
      const r = E.repasEnr.find((x) => x.id === b.dataset.repasEnr);
      const avant = instantane();
      r.items.forEach((it) => E.journal.push({ id: uid(), j: jourJournal, r: repas, c: it.c, q: it.q, ...(it.p ? { p: it.p } : {}) }));
      modale().close(); sauver(); rendre(); annulable(avant, `« ${r.nom} » ajouté.`);
    }));
  }

  function modaleEnregistrerRepas(repas) {
    const items = entreesDu(jourJournal).filter((e) => e.r === repas).map((e) => ({ c: e.c, q: e.q, ...(e.p ? { p: e.p } : {}) }));
    ouvrirModale('Enregistrer ce repas', `<p>${pluriel(items.length, 'aliment')} · ${kcal(R.totaux(items, E.aliments).kcal)}</p><label class="champ">Nom du repas<input name="nom" required maxlength="60" placeholder="Ex. : Mon petit-déjeuner habituel"></label><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const nom = String(f.get('nom') || '').trim();
        if (!nom) return 'Donne un nom au repas.';
        E.repasEnr.push({ id: uid(), nom, items });
        sauver(); rendre(); toast(`« ${nom} » enregistré.`);
      });
  }

  function modaleMenu(id) {
    const m = id ? E.menus.find((x) => x.id === id) : null;
    if (!m) {
      ouvrirModale('Nouveau menu', '<label class="champ">Nom du menu<input name="nom" required maxlength="60" placeholder="Ex. : Jour d\'entraînement"></label><p class="erreur" role="alert"></p>',
        '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
          const nom = String(f.get('nom') || '').trim();
          if (!nom) return 'Donne un nom au menu.';
          const nv = { id: uid(), nom, items: [] };
          E.menus.push(nv);
          sauver(); rendre(); setTimeout(() => modaleMenu(nv.id), 0);
        });
      return;
    }
    const tm = R.totauxMenu(m, E.aliments);
    const corps = `<label class="champ">Nom du menu<input name="nom" required maxlength="60" value="${esc(m.nom)}"></label>
      <p class="apercu"><b>${kcal(tm.kcal)}</b> · protéines ${nf(tm.prot)} g · glucides ${nf(tm.gluc)} g · lipides ${nf(tm.lip)} g · fibres ${nf(tm.fib)} g</p>
      ${B.repas.map((r) => { const its = m.items.map((x, i) => ({ ...x, i })).filter((x) => x.r === r.id); return `<div class="menu-edition"><div class="menu-edition-tete"><p class="surtitre">${r.nom}</p><button type="button" class="btn petit" data-menu-ajout="${r.id}">${ICONES.plus}Ajouter</button></div>${its.map((x) => `<div class="ligne-menu"><span>${esc(E.aliments[x.c]?.n || '?')}</span><small>${nf(x.q)} g · ${kcal(R.valeurs(E.aliments[x.c], x.q).kcal)}</small><button type="button" class="btn petit lien" data-menu-suppr="${x.i}" aria-label="Retirer">Retirer</button></div>`).join('')}</div>`; }).join('')}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Menu type', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer le menu</button>', (f, action) => {
      const avant = instantane();
      if (action === 'supprimer') {
        E.menus = E.menus.filter((x) => x.id !== m.id);
        E.semaine = E.semaine.map((s) => (s === m.id ? null : s));
        sauver(); rendre(); annulable(avant, `Menu « ${m.nom} » supprimé.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au menu.';
      m.nom = nom; sauver(); rendre(); toast('Menu enregistré.');
    });
    const d = modale();
    d.querySelectorAll('[data-menu-ajout]').forEach((b) => b.addEventListener('click', () => { m.nom = d.querySelector('input[name=nom]').value.trim() || m.nom; modaleAjout({ menu: m.id, repas: b.dataset.menuAjout }); }));
    d.querySelectorAll('[data-menu-suppr]').forEach((b) => b.addEventListener('click', () => { m.items.splice(Number(b.dataset.menuSuppr), 1); sauver(); rendre(); modaleMenu(m.id); }));
  }

  function modaleAppliquerMenu(id) {
    const m = E.menus.find((x) => x.id === id);
    const t = auj();
    ouvrirModale('Copier dans le journal', `<p>Les ${pluriel(m.items.length, 'aliment')} de « ${esc(m.nom)} » sont ajoutés au jour choisi, repas par repas.</p><label class="champ">Jour<input type="date" name="jour" value="${t}" max="${t}" required></label><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Copier</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const j = f.get('jour');
        if (!j || j > t) return 'Choisis un jour passé ou aujourd\'hui.';
        const avant = instantane();
        m.items.forEach((it) => E.journal.push({ id: uid(), j, r: it.r, c: it.c, q: it.q }));
        jourJournal = j; sauver(); changerVue('journal'); annulable(avant, `« ${m.nom} » copié ${quand(j) === 'aujourd\'hui' ? 'aujourd\'hui' : `le ${fmt(j)}`}.`);
      });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const C = window.CIQUAL;
    const corps = `
      <div class="groupe premier"><h3>Profil et objectif</h3><p class="aide">Sexe, âge, taille, activité hors sport, objectif et cibles.</p><div class="rang"><button class="btn petit" type="button" data-action="profil">Modifier mon profil</button></div></div>
      <div class="groupe"><h3>Avertissement santé</h3><p class="aide">${esc(AVERTISSEMENT_SANTE)}</p><p class="aide">Selon la ${esc(B.sources.has.nom)} (${esc(B.sources.has.reference)}) : « ${esc(B.sources.has.citation)} » L'application t'avertit donc si ta cible passe sous ${nf(B.seuilTresBasCalories)} kcal par jour.</p></div>
      <div class="groupe"><h3>Tes données</h3>${session.demo ? '<p class="aide">En démo, les données sont fictives et restent dans ce navigateur.</p>' : TEXTE_DONNEES}
        ${E.consentement && !session.demo ? `<p class="aide">Accord donné le ${new Date(E.consentement.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>` : ''}
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <div class="rang"><button class="btn petit danger" type="button" data-action="effacer-tout">Effacer toutes mes données</button></div></div>
      <div class="groupe"><h3>Sources et licences</h3>
        <ul class="sources">
          <li><b>Aliments</b> : ${esc(C?.source || 'Anses, Table de composition nutritionnelle des aliments Ciqual')}, ${esc(C?.version || 'Ciqual 2025')}. ${esc(C?.licence || 'Licence Ouverte / Open Licence 2.0 (Etalab)')}. <a href="https://doi.org/10.57745/RDMHWY" target="_blank" rel="noopener">doi.org/10.57745/RDMHWY</a>. Colonnes retenues : énergie, protéines, glucides, lipides, fibres, sucres, sel.</li>
          <li><b>Activités (MET)</b> : ${esc(B.sources.met.reference)}. ${esc(B.sources.met.conditions)}</li>
          <li><b>Métabolisme de base</b> : ${esc(B.sources.mifflin.reference)}.</li>
          <li><b>Seuil d'alerte</b> : ${esc(B.sources.has.nom)}, ${esc(B.sources.has.reference)}</li>
          <li><b>Facteurs d'activité</b> (1,2 à 1,9) : coefficients d'usage courant, sans valeur officielle ; remplaçables par ton propre facteur.</li>
        </ul></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.journal) || !d.profil) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.journal.length, 'aliment noté', 'aliments notés')}) ?`)) return;
        const consentement = E.consentement;
        E = normaliser(d); delete E.majLe;
        E.consentement = consentement;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du journal.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nutrition-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Efface tout : la version en ligne est remplacée par un espace vide (sans consentement), puis l'appareil est vidé.
  async function effacerTout() {
    if (session.demo) {
      if (!confirm('Effacer les données de démo de ce navigateur ?')) return;
      stock.suppr(CLE_DEMO); stock.suppr(CLE_CODE);
      modale().close();
      deconnecter('Données de démo effacées.');
      return;
    }
    if (!confirm('Effacer toutes tes données (profil, poids, repas, séances, menus), en ligne et sur cet appareil ? C\'est définitif. Télécharge une copie avant si tu veux la garder.')) return;
    clearTimeout(minuterie);
    for (let i = 0; envoiEnCours && i < 50; i++) await new Promise((r) => setTimeout(r, 100));
    const vide = etatVide();
    const bouton = modale().querySelector('[data-action="effacer-tout"]');
    if (bouton) { bouton.disabled = true; bouton.textContent = 'Effacement…'; }
    try {
      let { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: vide, base: session.base }) });
      if (statut === 409) ({ statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: vide, base: corps.donnees.majLe }) }));
      if (statut !== 200) throw new Error(String(statut));
      session.base = corps.majLe;
    } catch {
      if (bouton) { bouton.disabled = false; bouton.textContent = 'Effacer toutes mes données'; }
      toast('Effacement impossible sans connexion : la version en ligne n\'a pas été modifiée. Réessaie une fois en ligne.');
      return;
    }
    E = null;
    stock.suppr(CLE_CACHE);
    modale().close();
    ecranConsentement('Toutes tes données ont été effacées, en ligne et sur cet appareil. Tu peux recommencer ou te déconnecter.');
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); chargerBase().then(() => { E = donneesDemo(); cache(); rendre(); }); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-retour': ecranConsentement(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'profil': modaleProfil(); break;
      case 'exporter': exporter(); break;
      case 'effacer-tout': effacerTout(); break;
      case 'fermer': modale().close(); break;
      case 'jour-prec': jourJournal = ajout(jourJournal, -1); rendre(); break;
      case 'jour-suiv': if (jourJournal < auj()) { jourJournal = ajout(jourJournal, 1); rendre(); } break;
      case 'jour-auj': jourJournal = auj(); rendre(); break;
      case 'ajouter': modaleAjout({ jour: jourJournal, repas: el.dataset.repas }); break;
      case 'entree': modaleEntree(id); break;
      case 'copier-veille': {
        const avant = instantane();
        const copies = R.copierJour(E.journal, ajout(jourJournal, -1), jourJournal, uid);
        E.journal.push(...copies);
        sauver(); rendre(); annulable(avant, `${pluriel(copies.length, 'aliment')} copié${copies.length > 1 ? 's' : ''} depuis la veille.`);
        break;
      }
      case 'repas-enr': modaleRepasEnr(el.dataset.repas); break;
      case 'enregistrer-repas': modaleEnregistrerRepas(el.dataset.repas); break;
      case 'repas-enr-suppr': { const avant = instantane(); const r = E.repasEnr.find((x) => x.id === id); E.repasEnr = E.repasEnr.filter((x) => x.id !== id); sauver(); rendre(); annulable(avant, `« ${r?.nom} » supprimé.`); break; }
      case 'favori': {
        const c = el.dataset.code;
        retenir(c);
        E.favoris = E.favoris.includes(c) ? E.favoris.filter((x) => x !== c) : [...E.favoris, c];
        el.classList.toggle('actif', E.favoris.includes(c));
        el.setAttribute('aria-pressed', String(E.favoris.includes(c)));
        sauver();
        if (!modale().open) rendre();
        break;
      }
      case 'portion-nouvelle': modalePortion(el.dataset.code, apresPortion); break;
      case 'fiche': chargerBase().then(() => modaleFiche(el.dataset.code)).catch(() => toast('Base aliments indisponible.')); break;
      case 'perso-nouveau': modalePerso(); break;
      case 'seance-nouvelle': modaleSeance(); break;
      case 'seance-modifier': modaleSeance(id); break;
      case 'pesee-nouvelle': modalePesee(); break;
      case 'pesee-suppr': { const avant = instantane(); E.pesees = E.pesees.filter((p) => p.id !== id); sauver(); rendre(); annulable(avant, 'Pesée supprimée.'); break; }
      case 'periode': periodeBilan = Number(el.dataset.n); rendre(); break;
      case 'menu-nouveau': modaleMenu(); break;
      case 'menu-modifier': modaleMenu(id); break;
      case 'menu-appliquer': modaleAppliquerMenu(id); break;
      case 'cocher': {
        const c = el.value;
        E.coches = el.checked ? [...new Set([...E.coches, c])] : E.coches.filter((x) => x !== c);
        sauver(); rendre();
        break;
      }
      case 'courses-decocher': E.coches = []; sauver(); rendre(); break;
      case 'courses-copier': {
        const texte = R.listeCourses(E.menus, E.semaine, E.aliments).filter((l) => !E.coches.includes(l.c)).map((l) => `- ${l.nom} : ${R.quantiteCourses(l.q)}`).join('\n');
        navigator.clipboard?.writeText(texte).then(() => toast('Liste copiée (articles non cochés).'), () => toast('Copie impossible dans ce navigateur.'));
        break;
      }
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'choix-jour' && el.value) { jourJournal = el.value > auj() ? auj() : el.value; rendre(); }
    if (el.dataset?.action === 'semaine') { E.semaine[Number(el.dataset.i)] = el.value || null; sauver(); rendre(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('tr[data-action="fiche"]')) e.target.click();
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeurPrecedente = innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(innerWidth - largeurPrecedente) > 80 && (vue === 'bilan' || vue === 'activite') && E && !modale().open) { largeurPrecedente = innerWidth; rendre(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
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
      if (c && c.code === code && c.etat?.consentement && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__nutrition = { etat: () => E, chargerBase };
  init();
})();
