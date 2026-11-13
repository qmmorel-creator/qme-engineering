// Calculateur de TJM freelance QME : objectif, temps, statut, résultat et scénarios, données synchronisées par code d'accès.
// Les règles de calcul sont dans calculs.js (window.TJM_CALCUL), testées par outils/templates/tjm.test.mjs.
(() => {
  'use strict';
  const B = window.BASE;
  const C = window.TJM_CALCUL;
  const API = '/api/templates';
  const PRODUIT = 'TJM';
  const CLE_CODE = 'qme-tjm-code';
  const CLE_CACHE = 'qme-tjm-cache';
  const CLE_DEMO = 'qme-tjm-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-tjm-ecran-accueil';
  const MAX_SCENARIOS = 3;

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
  const anneeCourante = () => new Date().getFullYear();
  const fmtDate = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const NF = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const euros = (n) => `${NF.format(Math.round(n))}\u00a0€`;
  const pct = (n) => `${String(Math.round(Number(n) * 100) / 100).replace('.', ',')}\u00a0%`;
  // Saisie tolérante : espaces, virgule décimale. '' → null.
  const lireNombre = (v) => { const s = String(v ?? '').replace(/[\s  €%]/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const champNombre = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace('.', ','));

  const couleur = (id) => B.couleurs.find((c) => c.id === id) || B.couleurs[0];
  const statutDe = (id) => B.statuts.find((s) => s.id === id) || B.statuts[0];

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'objectif';
  let annulation = null;

  const tauxDefaut = () => structuredClone(B.taux);
  const etatVide = () => ({ version: 1, prenom: '', actif: null, scenarios: [], taux: tauxDefaut() });
  function scenarioVide(nom, couleurId) {
    return { id: uid(), nom, couleur: couleurId, annee: anneeCourante(), objectif: { montant: null, periode: 'mois' }, frais: [], marge: 10,
      conges: 25, nonFacturables: 0, statut: 'bnc', activite: 'commercant', vl: false, tauxSociete: null, tauxFictif: false };
  }
  const normaliserTaux = (t) => {
    const d = tauxDefaut();
    if (!t || typeof t !== 'object') return d;
    return { ...d, ...t, cotisations: { ...d.cotisations, ...(t.cotisations || {}) }, vl: { ...d.vl, ...(t.vl || {}) }, cfp: { ...d.cfp, ...(t.cfp || {}) } };
  };
  const normaliserScenario = (s, i) => {
    const v = scenarioVide(`Scénario ${i + 1}`, B.couleurs[i % B.couleurs.length].id);
    return { ...v, ...s, objectif: { ...v.objectif, ...(s.objectif || {}) }, frais: Array.isArray(s.frais) ? s.frais : [] };
  };
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d, taux: normaliserTaux(d.taux), scenarios: Array.isArray(d.scenarios) ? d.scenarios.slice(0, MAX_SCENARIOS).map(normaliserScenario) : [] };
    if (!n.scenarios.some((s) => s.id === n.actif)) n.actif = n.scenarios[0]?.id ?? null;
    return n;
  };
  const actif = () => E.scenarios.find((s) => s.id === E.actif) || E.scenarios[0];
  const calcul = (sc = actif()) => C.calculer(sc, E.taux);
  const tauxModifies = () => JSON.stringify(normaliserTaux(E.taux)) !== JSON.stringify(tauxDefaut());

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
        toast('Un autre appareil a modifié tes calculs entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.');
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
        if (!document.activeElement?.matches('input,select,textarea')) rendre();
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
  // Code TJM-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  // Un code d'un autre template (3 lettres dont au moins une hors hexadécimal) est accepté à la saisie,
  // pour que le serveur l'identifie et que l'application explique qu'il ouvre un autre template.
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
      if (E.scenarios.length) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.scenarios.length) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && Array.isArray(d.scenarios) && d.scenarios.length ? normaliser(d) : donneesDemo();
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

  // Données de démonstration : année en cours (relative à aujourd'hui), trois scénarios fictifs.
  // Le premier dépasse le seuil majoré de la franchise de TVA ; le troisième utilise un taux de société fictif.
  function donneesDemo() {
    E = etatVide();
    E.prenom = 'Camille';
    const a = anneeCourante();
    const s1 = { ...scenarioVide('Développement web', 'bleu'), annee: a, statut: 'bnc', objectif: { montant: 2500, periode: 'mois' }, marge: 10, conges: 25, nonFacturables: 30,
      frais: [['Logiciels et abonnements', 45, 'mois'], ['Matériel informatique', 600, 'an'], ['Assurance responsabilité civile pro', 280, 'an'], ['Téléphone et internet', 40, 'mois'], ['Formation', 400, 'an']]
        .map(([libelle, montant, periode]) => ({ id: uid(), libelle, montant, periode })) };
    const s2 = { ...scenarioVide('Mi-temps · Cipav', 'rouge'), annee: a, statut: 'cipav', vl: true, objectif: { montant: 1800, periode: 'mois' }, marge: 15, conges: 30, nonFacturables: 90,
      frais: [['Logiciels et abonnements', 30, 'mois'], ['Comptabilité et banque', 240, 'an'], ['Espace de travail (coworking)', 90, 'mois']]
        .map(([libelle, montant, periode]) => ({ id: uid(), libelle, montant, periode })) };
    const s3 = { ...scenarioVide('Passage en SASU', 'jaune'), annee: a, statut: 'societe', tauxSociete: 45, tauxFictif: true, objectif: { montant: 3500, periode: 'mois' }, marge: 10, conges: 25, nonFacturables: 20,
      frais: [['Comptabilité et banque', 2400, 'an'], ['Logiciels et abonnements', 60, 'mois'], ['Assurance responsabilité civile pro', 450, 'an'], ['Déplacements', 1200, 'an']]
        .map(([libelle, montant, periode]) => ({ id: uid(), libelle, montant, periode })) };
    E.scenarios = [s1, s2, s3];
    E.actif = s1.id;
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Calculateur de TJM · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="180" width="70" height="100" fill="#1D4E89"/>
          <rect x="100" y="120" width="70" height="160" fill="#F0EDE6"/>
          <rect x="190" y="50" width="70" height="230" fill="#D9302A"/>
          <circle cx="420" cy="150" r="130" fill="#F5B400"/>
          <path d="M420 150 L420 20 A130 130 0 0 1 550 150 Z" fill="#141414"/>
          <rect x="0" y="278" width="290" height="4" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Calculateur de TJM · freelance</p>
          <h1>Ton tarif, calculé à l'euro près.</h1>
          <p>Le revenu que tu vises, tes frais, tes vrais jours facturables et ton statut : le calculateur en déduit ton TJM minimum et ton TJM conseillé.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton calculateur</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes scénarios sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon calculateur</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de calculateur ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon calculateur'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', montant: '', statut: null, conges: 25, nonFacturables: 0, marge: 10 };

  function ecranAccueil() {
    const a = accueil;
    document.title = 'Bienvenue · Calculateur de TJM';
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On calcule ton premier TJM.</h1>
        <p class="intro">Deux écrans, puis tu verras ton TJM minimum et ton TJM conseillé. Tout reste modifiable ensuite.</p>
        <div class="grille-champs">
          <label class="champ">Ton prénom <small>Facultatif.</small><input id="a-prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40"></label>
          <label class="champ">Revenu net visé par mois <small>Ce qu'il te reste après cotisations et frais.</small><input id="a-montant" value="${esc(a.montant)}" inputmode="decimal" placeholder="Ex. : 2 500"></label>
        </div>
        <h2 class="titre-section">Ton statut <span>Il détermine les cotisations prélevées sur ton chiffre d'affaires.</span></h2>
        <div class="filieres" role="group" aria-label="Statut">
          ${B.statuts.map((x, i) => `<button type="button" class="filiere" style="--c:${['var(--rouge)', 'var(--bleu)', 'var(--jaune)', 'var(--encre)'][i]}" data-action="a-statut" data-id="${x.id}" aria-pressed="${a.statut === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></button>`).join('')}
        </div>
        <p class="erreur" id="a-erreur" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const o = C.joursOuvres(anneeCourante()).ouvres;
      corps = `
        <p class="surtitre">${anneeCourante()} · ${o} jours ouvrés</p>
        <h1>Combien de jours vas-tu facturer ?</h1>
        <p class="intro">Les jours fériés de ${anneeCourante()} sont déjà retirés. Enlève tes congés et les jours sans client : prospection, gestion, formation, intercontrats.</p>
        <div class="grille-champs">
          <label class="champ">Congés (jours ouvrés par an)<input id="a-conges" value="${esc(a.conges)}" inputmode="numeric"></label>
          <label class="champ">Jours non facturables par an<input id="a-nonfact" value="${esc(a.nonFacturables)}" inputmode="numeric"></label>
          <label class="champ">Marge de sécurité (%)<small>Ajoutée au TJM minimum pour obtenir le TJM conseillé.</small><input id="a-marge" value="${esc(a.marge)}" inputmode="decimal"></label>
        </div>
        <p class="erreur" id="a-erreur" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Voir mon TJM</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (id, cle) => $(id)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-prenom', 'prenom'); lier('#a-montant', 'montant'); lier('#a-conges', 'conges'); lier('#a-nonfact', 'nonFacturables'); lier('#a-marge', 'marge');
  }

  function accueilSuivant() {
    const m = lireNombre(accueil.montant);
    if (m === null || m <= 0) { $('#a-erreur').textContent = 'Indique le revenu net que tu vises par mois.'; $('#a-montant').focus(); return; }
    if (!accueil.statut) { $('#a-erreur').textContent = 'Choisis ton statut (tu pourras le changer ensuite).'; return; }
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    const conges = lireNombre(accueil.conges), nf = lireNombre(accueil.nonFacturables), marge = lireNombre(accueil.marge);
    if ([conges, nf, marge].some((n) => n === null || n < 0)) { $('#a-erreur').textContent = 'Indique des nombres positifs (0 si aucun).'; return; }
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    const sc = { ...scenarioVide('Mon scénario', B.couleurs[0].id), statut: accueil.statut, objectif: { montant: lireNombre(accueil.montant), periode: 'mois' }, conges, nonFacturables: nf, marge };
    E.scenarios = [sc]; E.actif = sc.id;
    accueil = { etape: 1, prenom: '', montant: '', statut: null, conges: 25, nonFacturables: 0, marge: 10 };
    vue = 'resultat';
    history.replaceState(null, '', '#resultat');
    sauver();
    demarrer();
    if (sc.statut === 'societe') toast('Saisis ton taux de charges dans l\'onglet Statut pour obtenir ton TJM.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    objectif: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="currentColor"/></svg>',
    temps: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    statut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    resultat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3h2v16h16v2Z" fill="currentColor"/><path d="M3 21 A18 18 0 0 1 21 3 V21Z" fill="currentColor" opacity=".35"/></svg>',
    scenarios: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['objectif', 'Objectif'], ['temps', 'Temps'], ['statut', 'Statut'], ['resultat', 'Résultat'], ['scenarios', 'Scénarios']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Calculateur<br>de TJM</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, taux et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  const VUES = { objectif: () => vueObjectif(), temps: () => vueTemps(), statut: () => vueStatut(), resultat: () => vueResultat(), scenarios: () => vueScenarios() };

  function rendre() {
    if (!E || !$('#vue')) return;
    if (!E.scenarios.length) { const s = scenarioVide('Mon scénario', B.couleurs[0].id); E.scenarios.push(s); E.actif = s.id; }
    // Garde le focus sur le champ en cours après un nouveau rendu (changement de statut, case…).
    const f = document.activeElement;
    const garde = f && f.dataset && f.dataset.champ ? `[data-champ="${f.dataset.champ}"]${f.type === 'radio' ? `[value="${f.value}"]` : ''}` : null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { objectif: 'Objectif', temps: 'Temps', statut: 'Statut', resultat: 'Résultat', scenarios: 'Scénarios' };
    document.title = `${titres[vue]} · Calculateur de TJM`;
    $('#vue').innerHTML = VUES[vue]() + piedApp();
    if (vue === 'scenarios') brancherGraphique();
    if (garde) $(garde)?.focus({ preventScroll: true });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function piedApp() {
    const t = E.taux;
    return `<footer class="pied-app"><p><b>Taux micro-entreprise ${esc(B.taux.enVigueur)}</b>${tauxModifies() ? ' (tu as modifié certains taux)' : ''} · sources : ${B.taux.sources.join(', ')}, consultées le ${esc(B.taux.consulteLe)} · plafond ${euros(t.plafondServices)}, franchise de TVA ${euros(t.tvaBase)} / ${euros(t.tvaMajore)} · <button class="lien-pied" data-action="reglages">voir et modifier les taux</button></p>
      <p>Outil d'aide au calcul : il ne remplace pas un expert-comptable. Les montants sont hors taxes ; le revenu net s'entend avant impôt sur le revenu, sauf avec le versement libératoire.</p></footer>`;
  }

  // Bandeau de choix du scénario en cours (onglets Objectif, Temps, Statut, Résultat).
  function barreScenarios() {
    return `<div class="choix-scenario" role="group" aria-label="Scénario affiché">
      <span class="surtitre">Scénario</span>
      ${E.scenarios.map((s) => `<button class="puce-scenario" style="--c:${couleur(s.couleur).hex}" data-action="activer" data-id="${s.id}" aria-pressed="${s.id === E.actif}"><i class="forme ${couleur(s.couleur).forme}"></i>${esc(s.nom)}</button>`).join('')}
      ${E.scenarios.length < MAX_SCENARIOS ? `<button class="btn petit" data-action="scenario-nouveau">${ICONES.plus}Scénario</button>` : ''}
    </div>`;
  }

  // Encadré de synthèse, recalculé à chaque frappe sans toucher aux champs.
  function synthese() {
    const sc = actif();
    const r = calcul(sc);
    const net = C.netAnnuel(sc.objectif);
    let corps;
    if (!net) corps = '<p class="synthese-vide">Indique le revenu net que tu vises pour obtenir ton TJM.</p>';
    else if (!r.besoin) corps = '<p class="synthese-vide">Saisis le taux de charges de ta société (onglet Statut) pour obtenir ton TJM.</p>';
    else if (!r.tjm) corps = '<p class="synthese-vide">Aucun jour facturable : réduis les congés ou les jours non facturables (onglet Temps).</p>';
    else {
      const al = r.alertesConseille.filter((a) => a.niveau === 'depasse').length;
      corps = `
        <div class="synthese-tjm"><span>TJM minimum</span><b>${euros(r.tjm.minimum)}</b></div>
        <div class="synthese-tjm conseille"><span>TJM conseillé</span><b>${euros(r.tjm.conseille)}</b></div>
        <dl class="synthese-liste">
          <div><dt>CA annuel nécessaire</dt><dd>${euros(r.besoin.ca)}</dd></div>
          <div><dt>Jours facturables</dt><dd>${r.jours}</dd></div>
          <div><dt>Statut</dt><dd>${esc(statutDe(sc.statut).court)}</dd></div>
        </dl>
        ${al ? `<p class="synthese-alerte">${pluriel(al, 'seuil dépassé', 'seuils dépassés')} · <button class="lien-pied" data-action="vue" data-vue="resultat">voir</button></p>` : ''}`;
    }
    return `<p class="surtitre">${esc(sc.nom)} · ${sc.annee}</p>${corps}`;
  }
  const aside = () => `<aside class="synthese" id="synthese" aria-live="polite">${synthese()}</aside>`;

  // Objectif : revenu net, frais, marge.
  function vueObjectif() {
    const sc = actif();
    const totalFrais = C.fraisAnnuels(sc.frais);
    const lignes = sc.frais.map((f) => `
      <div class="frais-ligne">
        <label class="champ"><span class="sr-only">Libellé</span><input data-champ="frais.${f.id}.libelle" value="${esc(f.libelle)}" maxlength="80" list="frais-types" placeholder="Libellé"></label>
        <label class="champ montant"><span class="sr-only">Montant de ${esc(f.libelle)}</span><input data-champ="frais.${f.id}.montant" value="${esc(champNombre(f.montant))}" inputmode="decimal" placeholder="0"></label>
        <label class="champ"><span class="sr-only">Période</span><select data-champ="frais.${f.id}.periode"><option value="mois" ${f.periode === 'mois' ? 'selected' : ''}>€ / mois</option><option value="an" ${f.periode === 'an' ? 'selected' : ''}>€ / an</option></select></label>
        <button class="btn-suppr" data-action="frais-suppr" data-id="${f.id}" aria-label="Supprimer ${esc(f.libelle || 'ce frais')}">×</button>
      </div>`).join('');
    const proposes = B.fraisTypes.filter((t) => !sc.frais.some((f) => f.libelle === t));
    return `
      <div class="vue-tete"><div><h1>Objectif</h1><p>Le revenu que tu veux te verser, les frais de ton activité et une marge pour les imprévus.</p></div></div>
      ${barreScenarios()}
      <div class="edition">
        <div class="formulaire">
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">1</span>Revenu net visé</h2>
            <div class="grille-champs">
              <label class="champ">Montant<small>Ce qui te reste après cotisations et frais.</small><input data-champ="objectif.montant" value="${esc(champNombre(sc.objectif.montant))}" inputmode="decimal" placeholder="Ex. : 2 500"></label>
              <fieldset class="champ segmente"><legend>Période</legend>
                <label><input type="radio" name="periode" data-champ="objectif.periode" value="mois" ${sc.objectif.periode === 'mois' ? 'checked' : ''}><span>Par mois</span></label>
                <label><input type="radio" name="periode" data-champ="objectif.periode" value="an" ${sc.objectif.periode === 'an' ? 'checked' : ''}><span>Par an</span></label>
              </fieldset>
            </div>
            <p class="aide" data-calc="net">${aideNet(sc)}</p>
          </section>
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">2</span>Frais professionnels <span class="bloc-total" data-calc="frais">${euros(totalFrais)} / an</span></h2>
            ${sc.frais.length ? `<div class="frais">${lignes}</div>` : '<p class="vide-court">Aucun frais saisi. Ajoute tes abonnements, ton matériel, ton assurance…</p>'}
            <datalist id="frais-types">${B.fraisTypes.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
            <div class="rang">
              <button class="btn petit" data-action="frais-ajout">${ICONES.plus}Ajouter un frais</button>
              ${proposes.length ? `<label class="champ compact"><span class="sr-only">Ajouter un frais type</span><select data-action-change="frais-type"><option value="">Frais types…</option>${proposes.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>` : ''}
            </div>
          </section>
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">3</span>Marge de sécurité</h2>
            <label class="champ" style="max-width:260px">Marge (%)<small>Ajoutée au TJM minimum : impayés, mois sans mission, négociation.</small><input data-champ="marge" value="${esc(champNombre(sc.marge))}" inputmode="decimal"></label>
          </section>
        </div>
        ${aside()}
      </div>`;
  }
  const aideNet = (sc) => {
    const n = C.netAnnuel(sc.objectif);
    if (!n) return 'Indique un montant.';
    return `Soit <b>${euros(n)} par an</b> (${euros(n / 12)} par mois), ${sc.statut !== 'societe' && sc.vl ? 'impôt sur le revenu déjà payé par le versement libératoire' : 'avant impôt sur le revenu'}.`;
  };

  // Temps : année, fériés calculés, congés, jours non facturables.
  function vueTemps() {
    const sc = actif();
    const a = anneeCourante();
    const annees = [a - 1, a, a + 1, a + 2];
    if (!annees.includes(sc.annee)) annees.push(sc.annee);
    const fer = C.feries(sc.annee);
    return `
      <div class="vue-tete"><div><h1>Temps</h1><p>Les jours ouvrés sont calculés pour l'année choisie, jours fériés retirés (Pâques, Ascension et Pentecôte compris).</p></div></div>
      ${barreScenarios()}
      <div class="edition">
        <div class="formulaire">
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">1</span>Année</h2>
            <label class="champ" style="max-width:200px">Année de calcul<select data-champ="annee">${annees.sort().map((x) => `<option value="${x}" ${x === sc.annee ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            ${sc.annee !== E.taux.annee ? `<p class="aide">Les taux enregistrés sont ceux de ${E.taux.annee}. Vérifie-les pour ${sc.annee} dans les Réglages.</p>` : ''}
            <div data-calc="ouvres">${blocOuvres(sc, fer)}</div>
          </section>
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">2</span>Jours sans facturation</h2>
            <div class="grille-champs">
              <label class="champ">Congés<small>En jours ouvrés par an (5 semaines = 25 jours).</small><input data-champ="conges" value="${esc(champNombre(sc.conges))}" inputmode="numeric"></label>
              <label class="champ">Jours non facturables<small>Par an : prospection, gestion, formation, intercontrats, maladie.</small><input data-champ="nonFacturables" value="${esc(champNombre(sc.nonFacturables))}" inputmode="numeric"></label>
            </div>
            <div data-calc="jours">${blocJours(sc)}</div>
          </section>
          <details class="bloc feries"><summary>Jours fériés ${sc.annee} (${fer.filter((f) => f.ouvre).length} en semaine)</summary>
            <ul>${fer.map((f) => `<li class="${f.ouvre ? '' : 'weekend'}"><b>${esc(f.nom)}</b><span>${fmtDate(f.date, { weekday: 'long', day: 'numeric', month: 'long' })}${f.ouvre ? '' : ' · week-end'}</span></li>`).join('')}</ul>
            <p class="aide">Fériés nationaux uniquement : en Alsace-Moselle, le Vendredi saint et le 26 décembre s'ajoutent ; retire-les dans les jours non facturables.</p>
          </details>
        </div>
        ${aside()}
      </div>`;
  }
  const blocOuvres = (sc) => {
    const o = C.joursOuvres(sc.annee);
    return `<div class="compte-jours"><div><b>${o.semaine}</b><span>jours du lundi au vendredi</span></div><div><b>− ${o.feriesOuvres}</b><span>fériés en semaine</span></div><div class="total"><b>${o.ouvres}</b><span>jours ouvrés</span></div></div>`;
  };
  const blocJours = (sc) => {
    const o = C.joursOuvres(sc.annee).ouvres;
    const j = C.joursFacturables(sc.annee, sc.conges, sc.nonFacturables);
    const parSemaine = j / ((o / 5) || 1);
    return `<div class="compte-jours"><div><b>${o}</b><span>jours ouvrés</span></div><div><b>− ${Math.max(0, Number(sc.conges) || 0) + Math.max(0, Number(sc.nonFacturables) || 0)}</b><span>congés et non facturables</span></div><div class="total jaune"><b>${j}</b><span>jours facturables</span></div></div>
      <p class="aide">${j ? `Environ ${String(Math.round(parSemaine * 10) / 10).replace('.', ',')} jours facturés par semaine travaillée, ${String(Math.round(j / 12 * 10) / 10).replace('.', ',')} par mois en moyenne.` : 'Aucun jour facturable : réduis les congés ou les jours non facturables.'}</p>`;
  };

  // Statut : micro (BIC, BNC, Cipav) ou société.
  function vueStatut() {
    const sc = actif();
    const t = E.taux;
    const micro = sc.statut !== 'societe';
    const tm = micro ? C.tauxMicro(sc.statut, t, { vl: sc.vl, activite: sc.activite }) : null;
    return `
      <div class="vue-tete"><div><h1>Statut</h1><p>En micro-entreprise, les cotisations sont un pourcentage du chiffre d'affaires. En société, le taux dépend de ta rémunération et de tes choix : il se saisit.</p></div></div>
      ${barreScenarios()}
      <div class="edition">
        <div class="formulaire">
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">1</span>Statut</h2>
            <div class="statuts" role="radiogroup" aria-label="Statut">
              ${B.statuts.map((s) => `<label class="statut-choix"><input type="radio" name="statut" data-champ="statut" value="${s.id}" ${sc.statut === s.id ? 'checked' : ''}><span><b>${esc(s.nom)}</b><small>${esc(s.detail)}</small>${s.id !== 'societe' ? `<em>Cotisations ${pct(t.cotisations[s.id])}${t.aReverifier?.includes(`cotisations.${s.id}`) ? ' · à revérifier' : ''}</em>` : '<em>Taux saisi par toi</em>'}</span></label>`).join('')}
            </div>
          </section>
          ${micro ? `
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">2</span>Options de la micro-entreprise</h2>
            ${sc.statut === 'bic' ? `<fieldset class="champ segmente"><legend>Activité (formation professionnelle)</legend>
              <label><input type="radio" name="activite" data-champ="activite" value="commercant" ${sc.activite !== 'artisan' ? 'checked' : ''}><span>Commerçant · ${pct(t.cfp.commercant)}</span></label>
              <label><input type="radio" name="activite" data-champ="activite" value="artisan" ${sc.activite === 'artisan' ? 'checked' : ''}><span>Artisan · ${pct(t.cfp.artisan)}</span></label>
            </fieldset>` : `<p class="aide">Contribution à la formation professionnelle des libéraux : ${pct(t.cfp.liberal)} du chiffre d'affaires.</p>`}
            <label class="case"><input type="checkbox" data-champ="vl" ${sc.vl ? 'checked' : ''}> Versement libératoire de l'impôt sur le revenu (${pct(sc.statut === 'bic' ? t.vl.bic : t.vl.bnc)} du CA)</label>
            <p class="aide">Le versement libératoire est une option soumise à une condition de revenu du foyer fiscal : vérifie ton éligibilité sur autoentrepreneur.urssaf.fr avant de le cocher.</p>
            <table class="tableau taux-detail"><tbody>
              <tr><td>Cotisations sociales</td><td class="nb">${pct(tm.cotisations)}</td></tr>
              <tr><td>Formation professionnelle</td><td class="nb">${pct(tm.cfp)}</td></tr>
              <tr><td>Versement libératoire</td><td class="nb">${tm.vl ? pct(tm.vl) : '–'}</td></tr>
              <tr class="total"><td>Prélevé sur ton chiffre d'affaires</td><td class="nb">${pct(tm.total)}</td></tr>
            </tbody></table>
          </section>` : `
          <section class="bloc">
            <h2 class="bloc-titre"><span class="num">2</span>Taux de charges de ta société</h2>
            <label class="champ" style="max-width:320px">Taux de charges (%)
              <small>Part de ce qui reste après les frais qui part en cotisations, impôt sur les sociétés et impôt sur le revenu. Aucune valeur par défaut : demande-la à ton expert-comptable ou à un simulateur officiel.</small>
              <input data-champ="tauxSociete" value="${esc(champNombre(sc.tauxSociete))}" inputmode="decimal" placeholder="À saisir">
            </label>
            ${sc.tauxFictif ? '<p class="aide alerte-fictif"><b>Valeur fictive de démonstration.</b> Ce taux n\'est pas un conseil : remplace-le par le tien.</p>' : ''}
            <p class="aide">Calcul : revenu net ÷ (1 − taux), puis on ajoute les frais, payés par la société avant les charges.</p>
          </section>`}
        </div>
        ${aside()}
      </div>`;
  }

  // Résultat : TJM, décomposition, alertes.
  const TEXTES_ALERTES = {
    'plafond-depasse': (a, ca) => `Au TJM conseillé, ton chiffre d'affaires (${euros(ca)}) dépasse le plafond de la micro-entreprise pour les prestations de services (${euros(a.seuil)}). Au-delà, le régime micro ne s'applique plus : règles de sortie sur autoentrepreneur.urssaf.fr. Compare avec une société dans un autre scénario.`,
    'plafond-proche': (a, ca) => `Au TJM conseillé, ton chiffre d'affaires (${euros(ca)}) approche le plafond de la micro-entreprise (${euros(a.seuil)}).`,
    'tva-majore-depasse': (a, ca) => `Au TJM conseillé, ton chiffre d'affaires (${euros(ca)}) dépasse le seuil majoré de la franchise de TVA (${euros(a.seuil)}) : tu devras facturer la TVA en plus de ton TJM, qui est hors taxes (règles sur economie.gouv.fr).`,
    'tva-base-depasse': (a, ca) => `Au TJM conseillé, ton chiffre d'affaires (${euros(ca)}) dépasse le seuil de base de la franchise de TVA (${euros(a.seuil)}) : la franchise peut prendre fin, vérifie les règles sur economie.gouv.fr. Ton TJM est hors taxes.`,
    'tva-base-proche': (a, ca) => `Au TJM conseillé, ton chiffre d'affaires (${euros(ca)}) approche le seuil de base de la franchise de TVA (${euros(a.seuil)}).`,
  };
  const alertesHtml = (r) => r.alertesConseille.map((a) => `<div class="alerte ${a.niveau}"><span class="alerte-icone" aria-hidden="true">${a.niveau === 'depasse' ? '!' : 'i'}</span><p><b>${a.niveau === 'depasse' ? 'Seuil dépassé' : 'Seuil proche'}</b> ${esc(TEXTES_ALERTES[`${a.code}-${a.niveau}`](a, r.tjm.caConseille))}</p></div>`).join('');

  function vueResultat() {
    const sc = actif();
    const r = calcul(sc);
    const net = C.netAnnuel(sc.objectif);
    const tete = `<div class="vue-tete"><div><h1>${E.prenom ? `${esc(E.prenom)}, ton TJM` : 'Ton TJM'}</h1><p>${esc(sc.nom)} · ${esc(statutDe(sc.statut).nom)} · ${sc.annee}</p></div>
      <div class="actions"><button class="btn" data-action="vue" data-vue="objectif">Modifier les hypothèses</button></div></div>${barreScenarios()}`;
    const manque = !net ? ['Indique le revenu net que tu vises.', 'objectif', 'Saisir mon objectif']
      : !r.besoin ? ['Saisis le taux de charges de ta société : aucune valeur n\'est intégrée pour les sociétés.', 'statut', 'Saisir le taux']
        : !r.tjm ? ['Aucun jour facturable : réduis les congés ou les jours non facturables.', 'temps', 'Revoir le temps'] : null;
    if (manque) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Il manque une information</h3><p>${manque[0]}</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="${manque[1]}">${manque[2]}</button></div></div></div>`;
    const b = r.besoin;
    const frais = b.frais;
    const parts = sc.statut === 'societe'
      ? [['Revenu net', b.net, 'var(--bleu)'], ['Frais', frais, 'var(--jaune)'], ['Charges (taux saisi)', b.charges, 'var(--rouge)']]
      : [['Revenu net', b.net, 'var(--bleu)'], ['Frais', frais, 'var(--jaune)'], ['Cotisations sociales', b.cotisations, 'var(--rouge)'], ['Formation professionnelle', b.cfp, 'var(--encre)'], ...(b.vl ? [['Versement libératoire', b.vl, '#7A3E6B']] : [])];
    const barre = parts.filter((p) => p[1] > 0).map(([l, v, c]) => `<span style="--c:${c};flex-grow:${v}" title="${esc(l)} : ${euros(v)}"></span>`).join('');
    return `${tete}
      <section class="tjm-hero">
        <div class="tuile-tjm"><p class="surtitre">TJM minimum</p><b>${euros(r.tjm.minimum)}</b><span>Couvre juste ton objectif, sans marge. Hors taxes.</span></div>
        <div class="tuile-tjm conseille"><p class="surtitre">TJM conseillé · marge ${pct(sc.marge || 0)}</p><b>${euros(r.tjm.conseille)}</b><span>Le tarif à annoncer. Hors taxes.</span></div>
        <div class="tuile-tjm petit"><p class="surtitre">Chiffre d'affaires annuel</p><b>${euros(b.ca)}</b><span>Nécessaire au TJM minimum · ${euros(r.tjm.caConseille)} au TJM conseillé</span></div>
        <div class="tuile-tjm petit"><p class="surtitre">Jours facturables</p><b>${r.jours}</b><span>${r.ouvres.ouvres} jours ouvrés − congés et jours non facturables</span></div>
      </section>
      ${r.alertesConseille.length ? `<h2 class="titre-section">Seuils</h2><div class="alertes">${alertesHtml(r)}</div>` : `<div class="alertes"><div class="alerte ok"><span class="alerte-icone" aria-hidden="true">✓</span><p><b>Sous les seuils</b> Au TJM conseillé, ton chiffre d'affaires reste sous le seuil de franchise de TVA${sc.statut !== 'societe' ? ' et sous le plafond de la micro-entreprise' : ''}.</p></div></div>`}
      <h2 class="titre-section">Où va ton chiffre d'affaires <span>Au TJM minimum, sur un an.</span></h2>
      <figure class="repartition">
        <div class="barre-repartition" role="img" aria-label="Répartition du chiffre d'affaires : ${parts.map(([l, v]) => `${l} ${euros(v)}`).join(', ')}">${barre}</div>
        <div class="defile"><table class="tableau"><thead><tr><th>Poste</th><th class="nb">Par an</th><th class="nb">Par mois</th><th class="nb">Part du CA</th></tr></thead><tbody>
          ${parts.map(([l, v, c]) => `<tr><td><span class="nom-poste"><i style="background:${c}"></i>${esc(l)}</span></td><td class="nb">${euros(v)}</td><td class="nb">${euros(v / 12)}</td><td class="nb">${pct(Math.round(v / b.ca * 1000) / 10)}</td></tr>`).join('')}
          <tr class="total"><td>Chiffre d'affaires hors taxes</td><td class="nb">${euros(b.ca)}</td><td class="nb">${euros(b.ca / 12)}</td><td class="nb">100\u00a0%</td></tr>
        </tbody></table></div>
      </figure>
      <h2 class="titre-section">Hypothèses</h2>
      <ul class="hypotheses">
        <li>Revenu net visé : <b>${euros(net)} par an</b>, ${sc.statut !== 'societe' && sc.vl ? 'impôt sur le revenu compris (versement libératoire)' : 'avant impôt sur le revenu'}.</li>
        <li>Frais professionnels : <b>${euros(frais)} par an</b>${sc.statut === 'societe' ? ', payés par la société' : ', non déductibles en micro-entreprise (les cotisations portent sur tout le CA)'}.</li>
        <li>${sc.statut === 'societe' ? `Taux de charges saisi : <b>${pct(sc.tauxSociete)}</b>${sc.tauxFictif ? ' (valeur fictive de démonstration)' : ''}.` : `Prélèvements sur le CA : <b>${pct(b.taux.total)}</b> (cotisations ${pct(b.taux.cotisations)}, formation ${pct(b.taux.cfp)}${b.taux.vl ? `, versement libératoire ${pct(b.taux.vl)}` : ''}).`}</li>
        <li>${r.jours} jours facturables en ${sc.annee}, marge de sécurité de ${pct(sc.marge || 0)}.</li>
      </ul>`;
  }

  // Scénarios : comparaison côte à côte et courbe du TJM selon les jours facturables.
  function vueScenarios() {
    const cartes = E.scenarios.map((s) => {
      const r = calcul(s);
      const co = couleur(s.couleur);
      const depasse = r.alertesConseille.filter((a) => a.niveau === 'depasse');
      return `<article class="scenario" style="--c:${co.hex};--t:${co.id === 'jaune' ? 'var(--encre)' : '#fff'}">
        <div class="scenario-tete"><div><h2><i class="forme ${co.forme}"></i>${esc(s.nom)}</h2><p>${esc(statutDe(s.statut).court)}${s.statut !== 'societe' && s.vl ? ' · VL' : ''} · ${s.annee}</p></div><button data-action="scenario-modifier" data-id="${s.id}">Renommer</button></div>
        <dl class="scenario-chiffres">
          <div class="fort"><dt>TJM minimum</dt><dd>${r.tjm ? euros(r.tjm.minimum) : '–'}</dd></div>
          <div class="fort"><dt>TJM conseillé</dt><dd>${r.tjm ? euros(r.tjm.conseille) : '–'}</dd></div>
          <div><dt>Net visé / mois</dt><dd>${euros(C.netAnnuel(s.objectif) / 12)}</dd></div>
          <div><dt>Frais / an</dt><dd>${euros(C.fraisAnnuels(s.frais))}</dd></div>
          <div><dt>Jours facturables</dt><dd>${r.jours}</dd></div>
          <div><dt>CA nécessaire</dt><dd>${r.besoin ? euros(r.besoin.ca) : '–'}</dd></div>
          <div><dt>Prélèvements</dt><dd>${s.statut === 'societe' ? (r.besoin ? `${pct(s.tauxSociete)}${s.tauxFictif ? ' *' : ''}` : 'à saisir') : pct(C.tauxMicro(s.statut, E.taux, { vl: s.vl, activite: s.activite }).total)}</dd></div>
        </dl>
        <div class="scenario-alertes">${depasse.length ? depasse.map((a) => `<span class="etiquette rouge">${a.code === 'plafond' ? 'Plafond micro dépassé' : 'Seuil de TVA dépassé'}</span>`).join('') : (r.tjm ? '<span class="etiquette bleu">Sous les seuils</span>' : '<span class="etiquette">Incomplet</span>')}</div>
        <div class="scenario-pied"><button class="btn petit primaire" data-action="scenario-ouvrir" data-id="${s.id}">Ouvrir</button><button class="btn petit" data-action="scenario-dupliquer" data-id="${s.id}" ${E.scenarios.length >= MAX_SCENARIOS ? 'disabled title="3 scénarios au maximum"' : ''}>Dupliquer</button></div>
      </article>`;
    }).join('');
    const fictif = E.scenarios.some((s) => s.statut === 'societe' && s.tauxFictif);
    return `
      <div class="vue-tete"><div><h1>Scénarios</h1><p>Jusqu'à ${MAX_SCENARIOS} hypothèses comparées côte à côte : autre statut, autre objectif, moins de jours facturés.</p></div>
        <div class="actions">${E.scenarios.length < MAX_SCENARIOS ? `<button class="btn primaire" data-action="scenario-nouveau">${ICONES.plus}Nouveau scénario</button>` : ''}</div></div>
      <div class="scenarios">${cartes}</div>
      ${fictif ? '<p class="note">* Taux de charges fictif de la démonstration, à remplacer par le tien.</p>' : ''}
      <h2 class="titre-section">TJM minimum selon les jours facturables <span>Le point marque tes jours facturables actuels. Moins de jours facturés, TJM plus élevé.</span></h2>
      ${graphiqueFigure()}`;
  }

  // ---------- Graphique ----------
  const FORMES = {
    rond: (x, y, c) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#141414" stroke-width="2"/>`,
    carre: (x, y, c) => `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="${c}" stroke="#141414" stroke-width="2"/>`,
    triangle: (x, y, c) => `<path d="M${x} ${y - 7}L${x + 7} ${y + 6}H${x - 7}Z" fill="${c}" stroke="#141414" stroke-width="2"/>`,
  };
  const J_MIN = 100, J_MAX = 240, J_PAS = 5;

  function seriesGraphique() {
    return E.scenarios.map((s) => ({ s, co: couleur(s.couleur), pts: C.courbe(s, E.taux, J_MIN, J_MAX, J_PAS), r: calcul(s) })).filter((x) => x.pts.length);
  }

  function graphiqueFigure() {
    const series = seriesGraphique();
    if (!series.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Pas encore de courbe</h3><p>Complète au moins un scénario (objectif et, pour une société, taux de charges).</p></div></div>`;
    const L = Math.round(Math.min(1100, Math.max(300, Math.min(window.innerWidth, 1180) - 72)));
    const petit = L < 560;
    const H = petit ? 240 : 320, g = petit ? 46 : 56, d = petit ? 12 : 120, h = 14, bas = 30;
    const max = Math.max(...series.flatMap((x) => x.pts.map((p) => p.tjm)));
    const min = Math.min(...series.flatMap((x) => x.pts.map((p) => p.tjm)));
    const pasY = [25, 50, 100, 200, 250, 500, 1000].find((p) => (Math.ceil(max / p) - Math.floor(min / p)) <= 6) || 1000;
    const y0 = Math.floor(min / pasY) * pasY, y1 = Math.ceil(max / pasY) * pasY;
    const X = (j) => g + (j - J_MIN) / (J_MAX - J_MIN) * (L - g - d);
    const Y = (v) => h + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - h - bas);
    let grilles = '';
    for (let v = y0; v <= y1 + 1e-6; v += pasY) grilles += `<line class="${v === y0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axe" x="${g - 8}" y="${Y(v) + 4}" text-anchor="end">${NF.format(v)} €</text>`;
    // Étiquettes de l'axe des jours, comptées depuis la fin pour éviter les chevauchements.
    const pasX = petit ? 40 : 20;
    for (let j = J_MAX; j >= J_MIN; j -= pasX) grilles += `<text class="axe" x="${X(j)}" y="${H - 8}" text-anchor="middle">${j} j</text>`;
    const lignes = series.map(({ co, pts }) => {
      const dpts = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.jours).toFixed(1)} ${Y(p.tjm).toFixed(1)}`).join('');
      return `${co.id === 'jaune' ? `<path d="${dpts}" fill="none" stroke="#141414" stroke-width="4.5" stroke-linejoin="round" ${co.tiret ? `stroke-dasharray="${co.tiret}"` : ''}/>` : ''}<path d="${dpts}" fill="none" stroke="${co.hex}" stroke-width="${co.id === 'jaune' ? 2.5 : 2.5}" stroke-linejoin="round" ${co.tiret ? `stroke-dasharray="${co.tiret}"` : ''}/>`;
    }).join('');
    const points = series.map(({ co, r }) => {
      if (!r.tjm || r.jours < J_MIN || r.jours > J_MAX) return '';
      const x = X(r.jours), y = Y(r.besoin.ca / r.jours);
      return `<circle cx="${x}" cy="${y}" r="11" fill="#FBFAF6"/>${FORMES[co.forme](x, y, co.hex)}`;
    }).join('');
    // Libellés directs en bout de courbe (ordinateur), écartés d'au moins 16 px.
    let etiquettes = '';
    if (!petit) {
      const fins = series.map(({ s, pts }) => ({ nom: s.nom.length > 16 ? `${s.nom.slice(0, 15)}…` : s.nom, y: Y(pts.at(-1).tjm) })).sort((a, b) => a.y - b.y);
      fins.forEach((f, i) => { if (i && f.y - fins[i - 1].y < 16) f.y = fins[i - 1].y + 16; });
      etiquettes = fins.map((f) => `<text class="etiquette-courbe" x="${L - d + 8}" y="${f.y + 4}">${esc(f.nom)}</text>`).join('');
    }
    const legende = series.map(({ s, co }) => `<span><svg width="30" height="14" aria-hidden="true"><line x1="0" x2="30" y1="7" y2="7" stroke="${co.id === 'jaune' ? '#141414' : co.hex}" stroke-width="${co.id === 'jaune' ? 4.5 : 2.5}" ${co.tiret ? `stroke-dasharray="${co.tiret}"` : ''}/>${co.id === 'jaune' ? `<line x1="0" x2="30" y1="7" y2="7" stroke="${co.hex}" stroke-width="2.5" stroke-dasharray="${co.tiret}"/>` : ''}</svg>${esc(s.nom)}</span>`).join('');
    const colonnes = series[0].pts.map((p) => p.jours);
    return `<figure class="graphique" id="graphique" data-g="${g}" data-d="${d}" data-l="${L}">
      <div class="graphique-tete"><h2>TJM minimum (€ HT)</h2><div class="legende">${legende}</div></div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Courbes du TJM minimum selon le nombre de jours facturables, de ${J_MIN} à ${J_MAX} jours, une par scénario ; valeurs dans le tableau">
        ${grilles}${lignes}<line class="curseur" x1="0" x2="0" y1="${h}" y2="${H - bas}" hidden/>${points}${etiquettes}
        <rect class="zone-survol" x="${g}" y="0" width="${L - g - d}" height="${H - bas}"/>
      </svg>
      <div class="infobulle" hidden></div>
      <details class="valeurs"><summary>Voir les valeurs</summary><div class="defile"><table class="tableau"><thead><tr><th>Jours facturables</th>${series.map(({ s }) => `<th class="nb">${esc(s.nom)}</th>`).join('')}</tr></thead><tbody>
        ${colonnes.filter((j) => j % 20 === 0).map((j) => `<tr><td>${j}</td>${series.map(({ pts }) => `<td class="nb">${euros(Math.ceil(pts.find((p) => p.jours === j).tjm))}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></details>
    </figure>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const zone = fig.querySelector('.zone-survol'), bulle = fig.querySelector('.infobulle'), curseur = fig.querySelector('.curseur');
    const g = Number(fig.dataset.g), d = Number(fig.dataset.d), L = Number(fig.dataset.l);
    const series = seriesGraphique();
    const montrer = (ev) => {
      const rz = zone.getBoundingClientRect();
      const j = Math.round(J_MIN + (ev.clientX - rz.left) / rz.width * (J_MAX - J_MIN));
      const jours = Math.min(J_MAX, Math.max(J_MIN, j));
      const xs = g + (jours - J_MIN) / (J_MAX - J_MIN) * (L - g - d);
      curseur.setAttribute('x1', xs); curseur.setAttribute('x2', xs); curseur.hidden = false; curseur.removeAttribute('hidden');
      bulle.innerHTML = `<b>${jours} jours facturables</b>${series.map(({ s, co, r }) => `<div><i class="forme ${co.forme}" style="--c:${co.hex}"></i>${esc(s.nom)} : ${euros(Math.ceil(r.besoin.ca / jours))}</div>`).join('')}`;
      bulle.hidden = false;
      const rf = fig.getBoundingClientRect();
      let x = ev.clientX - rf.left + 14;
      if (x + bulle.offsetWidth > rf.width - 8) x = ev.clientX - rf.left - bulle.offsetWidth - 14;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '56px';
    };
    zone.addEventListener('pointermove', montrer);
    zone.addEventListener('click', montrer);
    zone.addEventListener('pointerleave', () => { bulle.hidden = true; curseur.setAttribute('hidden', ''); });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  // ---------- Saisie dans les vues ----------
  function appliquerChamp(el) {
    const sc = actif();
    const champ = el.dataset.champ;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    const [racine, id, cle] = champ.split('.');
    if (racine === 'frais') {
      const f = sc.frais.find((x) => x.id === id);
      if (!f) return false;
      f[cle] = cle === 'montant' ? lireNombre(v) : v;
    } else if (champ === 'objectif.montant') sc.objectif.montant = lireNombre(v);
    else if (champ === 'objectif.periode') sc.objectif.periode = v;
    else if (['marge', 'conges', 'nonFacturables'].includes(champ)) { const n = lireNombre(v); sc[champ] = n === null ? 0 : Math.max(0, n); }
    else if (champ === 'annee') sc.annee = Number(v);
    else if (champ === 'tauxSociete') { const n = lireNombre(v); sc.tauxSociete = n === null ? null : n; sc.tauxFictif = false; }
    else if (champ === 'vl') sc.vl = !!v;
    else if (['statut', 'activite'].includes(champ)) sc[champ] = v;
    else return false;
    return true;
  }

  // Met à jour la synthèse et les blocs calculés sans réécrire les champs (le focus reste en place).
  function majCalculs() {
    const sc = actif();
    const s = $('#synthese'); if (s) s.innerHTML = synthese();
    const blocs = { net: () => aideNet(sc), frais: () => `${euros(C.fraisAnnuels(sc.frais))} / an`, jours: () => blocJours(sc), ouvres: () => blocOuvres(sc) };
    document.querySelectorAll('[data-calc]').forEach((el) => { el.innerHTML = blocs[el.dataset.calc](); });
  }

  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-champ]');
    if (!el || !E || el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    if (appliquerChamp(el)) { sauver(); majCalculs(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset?.actionChange === 'frais-type' && el.value) { ajouterFrais(el.value); return; }
    if (!el.dataset?.champ || !E) return;
    if (el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT') {
      if (appliquerChamp(el)) { sauver(); rendre(); }
    }
  });

  function ajouterFrais(libelle = '') {
    const sc = actif();
    const f = { id: uid(), libelle, montant: null, periode: 'mois' };
    sc.frais.push(f);
    sauver(); rendre();
    $(`[data-champ="frais.${f.id}.${libelle ? 'montant' : 'libelle'}"]`)?.focus();
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

  function modaleScenario(id) {
    const s = id ? E.scenarios.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Nom du scénario<input name="nom" required maxlength="40" value="${esc(s?.nom || `Scénario ${E.scenarios.length + 1}`)}"></label>
      ${s ? '' : `<label class="champ">Point de départ<select name="depart"><option value="">Scénario vide</option>${E.scenarios.map((x) => `<option value="${x.id}" ${x.id === E.actif ? 'selected' : ''}>Copie de « ${esc(x.nom)} »</option>`).join('')}</select></label>
        <p class="aide">Une copie garde l'objectif, les frais et le temps : change seulement ce que tu veux comparer.</p>`}
      <p class="erreur" role="alert"></p>`;
    const pied = s
      ? `<button class="btn primaire" value="ok">Enregistrer</button>${E.scenarios.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Renommer le scénario' : 'Nouveau scénario', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const avant = structuredClone(E.scenarios), actifAvant = E.actif;
        E.scenarios = E.scenarios.filter((x) => x.id !== s.id);
        if (E.actif === s.id) E.actif = E.scenarios[0].id;
        annulation = () => { E.scenarios = avant; E.actif = actifAvant; };
        sauver(); rendre(); toast(`« ${s.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      if (s) { s.nom = nom; sauver(); rendre(); toast('Scénario renommé.'); return; }
      creerScenario(nom, f.get('depart'));
    });
  }

  function creerScenario(nom, depuisId) {
    if (E.scenarios.length >= MAX_SCENARIOS) { toast(`${MAX_SCENARIOS} scénarios au maximum : supprime-en un d'abord.`); return; }
    const pris = new Set(E.scenarios.map((x) => x.couleur));
    const co = (B.couleurs.find((c) => !pris.has(c.id)) || B.couleurs[0]).id;
    const source = E.scenarios.find((x) => x.id === depuisId);
    const sc = source ? { ...structuredClone(source), id: uid(), nom, couleur: co } : scenarioVide(nom, co);
    if (source) sc.frais = sc.frais.map((f) => ({ ...f, id: uid() }));
    E.scenarios.push(sc); E.actif = sc.id;
    sauver();
    changerVue(source ? 'statut' : 'objectif');
    toast(`« ${nom} » créé.`);
  }

  function modaleReglages() {
    const t = E.taux;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const champ = (nom, lib, v, unite = '%') => `<label class="champ compact-l">${lib}<span class="avec-unite"><input name="${nom}" value="${esc(champNombre(v))}" inputmode="decimal"><span>${unite}</span></span></label>`;
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <div class="groupe"><h3>Taux et seuils</h3>
        <p class="aide">Valeurs intégrées : taux de la micro-entreprise ${esc(B.taux.enVigueur)}, relevés sur ${B.taux.sources.join(', ')} le ${esc(B.taux.consulteLe)}. Ils changent chaque année : vérifie-les et corrige-les ici si besoin. Le taux BNC Cipav est à revérifier sur autoentrepreneur.urssaf.fr.</p>
        <div class="grille-taux">
          ${champ('cot-bic', 'Cotisations · prestations BIC', t.cotisations.bic)}
          ${champ('cot-bnc', 'Cotisations · BNC', t.cotisations.bnc)}
          ${champ('cot-cipav', 'Cotisations · BNC Cipav', t.cotisations.cipav)}
          ${champ('vl-bic', 'Versement libératoire · BIC services', t.vl.bic)}
          ${champ('vl-bnc', 'Versement libératoire · BNC', t.vl.bnc)}
          ${champ('cfp-commercant', 'Formation pro · commerçants', t.cfp.commercant)}
          ${champ('cfp-liberal', 'Formation pro · libéraux', t.cfp.liberal)}
          ${champ('cfp-artisan', 'Formation pro · artisans', t.cfp.artisan)}
          ${champ('plafond', 'Plafond micro · services', t.plafondServices, '€')}
          ${champ('tva-base', 'Franchise de TVA · seuil', t.tvaBase, '€')}
          ${champ('tva-majore', 'Franchise de TVA · seuil majoré', t.tvaMajore, '€')}
        </div>
        <div class="rang"><button class="btn petit" type="button" data-action="taux-defaut" ${tauxModifies() ? '' : 'disabled'}>Revenir aux taux intégrés</button></div>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <p class="mention">Outil d'aide au calcul : il ne remplace pas un expert-comptable.</p>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const lire = (n) => lireNombre(f.get(n));
      const taux = { 'cot-bic': lire('cot-bic'), 'cot-bnc': lire('cot-bnc'), 'cot-cipav': lire('cot-cipav'), 'vl-bic': lire('vl-bic'), 'vl-bnc': lire('vl-bnc'),
        'cfp-commercant': lire('cfp-commercant'), 'cfp-liberal': lire('cfp-liberal'), 'cfp-artisan': lire('cfp-artisan') };
      if (Object.values(taux).some((v) => v === null || v < 0 || v >= 60)) return 'Taux : nombres entre 0 et 60 %.';
      const seuils = [lire('plafond'), lire('tva-base'), lire('tva-majore')];
      if (seuils.some((v) => v === null || v <= 0)) return 'Plafond et seuils : montants positifs.';
      if (seuils[2] < seuils[1]) return 'Le seuil majoré de TVA doit être supérieur au seuil de base.';
      E.prenom = String(f.get('prenom') || '').trim();
      Object.assign(E.taux, {
        cotisations: { bic: taux['cot-bic'], bnc: taux['cot-bnc'], cipav: taux['cot-cipav'] }, vl: { bic: taux['vl-bic'], bnc: taux['vl-bnc'] },
        cfp: { commercant: taux['cfp-commercant'], liberal: taux['cfp-liberal'], artisan: taux['cfp-artisan'] },
        plafondServices: seuils[0], tvaBase: seuils[1], tvaMajore: seuils[2],
      });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.scenarios)) throw new Error();
        if (!confirm(`Remplacer tes calculs actuels par cette copie (${pluriel(d.scenarios.length, 'scénario')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du calculateur.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calculateur-tjm-${auj()}.json`;
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
    annulation();
    annulation = null;
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': modale().open && modale().close(); deconnecter(); break;
      case 'a-statut': accueil.statut = id; document.querySelectorAll('[data-action="a-statut"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'taux-defaut': {
        const avant = structuredClone(E.taux);
        E.taux = tauxDefaut();
        annulation = () => { E.taux = avant; };
        modale().close(); sauver(); rendre(); toast('Taux intégrés rétablis.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'fermer': modale().close(); break;
      case 'activer': E.actif = id; sauver(); rendre(); break;
      case 'scenario-nouveau': modaleScenario(); break;
      case 'scenario-modifier': modaleScenario(id); break;
      case 'scenario-ouvrir': E.actif = id; sauver(); changerVue('resultat'); break;
      case 'scenario-dupliquer': { const s = E.scenarios.find((x) => x.id === id); creerScenario(`${s.nom} (copie)`.slice(0, 40), id); break; }
      case 'frais-ajout': ajouterFrais(); break;
      case 'frais-suppr': {
        const sc = actif();
        const i = sc.frais.findIndex((f) => f.id === id);
        if (i < 0) break;
        const [f] = sc.frais.splice(i, 1);
        annulation = () => { sc.frais.splice(i, 0, f); };
        sauver(); rendre();
        toast(`« ${f.libelle || 'Frais'} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  // Entrée dans un champ de vue : valide sans recharger la page.
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset?.champ) { e.preventDefault(); e.target.blur(); } });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && E) rafraichir(); });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (vue === 'scenarios' && Math.abs(window.innerWidth - largeur) > 40) { largeur = window.innerWidth; rendre(); } });

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
        if (E.scenarios.length) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__tjm = { etat: () => E, calcul: () => calcul() };
  init();
})();
