// Tableau de bord de pilotage PME QME : indicateurs mensuels par domaine, objectifs annuels répartis,
// écarts, tendances et alertes calculés, saisie mensuelle rapide, revue mensuelle imprimable.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à une banque, une comptabilité
// ou un autre logiciel : chaque chiffre se saisit ici.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.TDB;
  const API = '/api/templates';
  const PRODUIT = 'TDB';
  const CLE_CODE = 'qme-tdb-code';
  const CLE_CACHE = 'qme-tdb-cache';
  const CLE_DEMO = 'qme-tdb-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-tdb-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajoutMois, libMois, format, formatEcart, fini } = R;
  const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const aujIso = () => isoJour(new Date());
  const moisCourant = () => R.moisDeDate(new Date());
  const dateCourte = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const domaine = (id) => B.domaines.find((d) => d.id === id) || { id, nom: id, couleur: '#6E685F', forme: 'rond' };
  const nomIndic = (id) => R.indicateur(E, id)?.nom || B.indicateurs.find((k) => k.id === id)?.nom || 'Indicateur supprimé';
  const pctTexte = (v) => (fini(v) ? `${v > 0 ? '+' : ''}${R.nombre(v, Math.abs(v) < 10 ? 1 : 0)}\u00A0%` : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let mois = null;            // mois affiché (tableau de bord, saisie, revue, fiche)
  let exerciceVu = null;      // exercice affiché dans Objectifs
  let detail = null;          // indicateur ouvert dans l'onglet Indicateurs
  let sousVue = 'suivis';     // 'suivis' ou 'bibliotheque'
  const filtre = { domaine: '', q: '' };
  let annulation = null;

  const normaliser = (d) => R.normaliser(d);
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
        toast('Un autre appareil a modifié ton tableau de bord entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
        if (!modale().open && !saisieEnCours()) rendre();
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
  // Code interne (TDB-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && E.indicateurs.length) { cache(false); demarrer(); } else { E = null; ecranAccueil(); }
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
  // PME fictive de maintenance technique (« Exemple Services », 14 ETP), exercice civil. L'exercice
  // précédent est complet, l'exercice en cours saisi jusqu'au mois dernier. États forcés : taux de marge
  // en alerte ces derniers mois, délai de paiement qui dérive, trésorerie sous son plancher il y a deux mois,
  // satisfaction pas encore saisie ce mois-ci, autonomie sans objectif, un accident du travail, des actions
  // faites et ouvertes dans les revues. Dates relatives à aujourd'hui.
  function donneesDemo() {
    const e = R.etatVide();
    e.entreprise = 'Exemple Services';
    e.profil = 'services';
    const ids = [...B.profils.find((p) => p.id === 'services').indicateurs, 'autonomie', 'retards', 'absenteisme', 'formation', 'accidents', 'reclamations'];
    for (const id of ids) R.ajouterModele(e, B, id);
    const k = (id) => R.indicateur(e, id);
    k('tresorerie').plancher = 80000;
    k('retards').plafond = 60000;
    k('ca').responsable = 'Direction';
    k('pipe').responsable = 'Responsable commercial';
    k('tresorerie').responsable = 'Direction';
    k('taux-charge').responsable = 'Responsable technique';
    const L = ajoutMois(moisCourant(), -1);              // dernier mois saisi
    const an = R.exerciceDe(L, 1);
    const debut = R.cle(an - 1, 1);
    let graine = 20261114;
    const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let x = Math.imul(graine ^ (graine >>> 15), 1 | graine); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const bruit = (a) => 1 + (alea() * 2 - 1) * a;
    const SAISON = [0.92, 0.97, 1.05, 1.0, 1.02, 1.06, 0.95, 0.6, 1.08, 1.1, 1.05, 0.98];
    const r0 = (v) => Math.round(v), r1 = (v) => Math.round(v * 10) / 10;
    let effectif = 13.5;
    const n = R.ecartMois(debut, L) + 1;
    for (let i = 0; i < n; i++) {
      const m = ajoutMois(debut, i);
      const depuisFin = R.ecartMois(m, L);                // 0 = mois dernier
      const cal = Number(m.slice(5)) - 1;
      const croissance = i >= 12 ? 1.05 : 1;
      if (i === 5 || i === 15) effectif = r1(effectif + 0.5);
      const ca = r0(118000 * SAISON[cal] * croissance * bruit(0.05));
      const tauxAchats = depuisFin <= 2 ? 0.335 + alea() * 0.01 : 0.27 + alea() * 0.03;
      const achats = r0(ca * tauxAchats);
      const cf = r0((66000 + (effectif - 13.5) * 4200) * bruit(0.02) + (cal === 11 ? 11000 : 0));
      const treso = r0((depuisFin === 2 ? 72000 : depuisFin === 1 ? 104000 : 128000 + (i >= 12 ? 14000 : 0) + (cal === 4 ? -22000 : cal === 6 ? 16000 : 0)) * bruit(depuisFin <= 2 ? 0.02 : 0.08));
      const delai = depuisFin <= 3 ? 1.38 + (3 - depuisFin) * 0.06 : 1.12 + alea() * 0.12;
      const creances = r0(ca * delai);
      const dispo = r0(effectif * 0.78 * 151.67 * (cal === 7 ? 0.55 : cal === 11 ? 0.85 : 1) * bruit(0.02));
      const factu = r0(dispo * (0.74 + alea() * 0.07) * (depuisFin <= 1 ? 1.03 : 1));
      const theo = r0(effectif * 151.67 * (cal === 7 ? 0.55 : cal === 11 ? 0.85 : 1));
      const emis = r0(20 * SAISON[cal] * bruit(0.2));
      const s = {
        ca, achats, 'charges-fixes': cf, tresorerie: treso, creances, retards: r0(creances * (0.2 + alea() * 0.08)),
        pipe: r0((depuisFin <= 4 ? 330000 : 395000) * bruit(0.06)),
        'devis-emis': emis, 'devis-signes': Math.max(1, r0(emis * (0.3 + alea() * 0.12))),
        effectif, 'heures-disponibles': dispo, 'heures-facturees': factu,
        'heures-theoriques': theo, 'heures-absence': r0(theo * (0.022 + alea() * 0.018 + (cal === 1 || cal === 0 ? 0.012 : 0))),
        formation: [2, 5, 9, 10].includes(cal) ? r0(14 + alea() * 24) : 0,
        accidents: depuisFin === 7 ? 1 : 0,
        reclamations: r0(1 + alea() * 3),
        satisfaction: r1(8.1 + alea() * 0.6 - (depuisFin <= 2 ? 0.25 : 0)),
      };
      if (depuisFin === 0) delete s.satisfaction;   // questionnaires pas encore dépouillés
      e.saisies[m] = s;
    }
    // Objectifs de l'exercice en cours, fixés à partir de l'exercice précédent.
    const total = (id) => R.moisExercice(an - 1, 1).reduce((t, m) => t + (R.valeur(e, id, m) || 0), 0);
    const arr = (v, p) => Math.round(v / p) * p;
    e.objectifs[String(an)] = {
      ca: { annuel: arr(total('ca') * 1.08, 1000), repartition: 'saisonniere' },
      'marge-brute': { annuel: arr(total('marge-brute') * 1.06, 1000), repartition: 'saisonniere' },
      'taux-marge': { annuel: 72, repartition: 'egale' },
      'charges-fixes': { annuel: arr(total('charges-fixes') * 1.04, 1000), repartition: 'saisonniere' },
      'resultat-gestion': { annuel: 150000, repartition: 'egale' },
      tresorerie: { annuel: 140000, repartition: 'egale' },
      dso: { annuel: 36, repartition: 'egale' },
      pipe: { annuel: 360000, repartition: 'egale' },
      'devis-emis': { annuel: 240, repartition: 'saisonniere' },
      'devis-signes': { annuel: 84, repartition: 'saisonniere' },
      'taux-transformation': { annuel: 35, repartition: 'egale' },
      effectif: { annuel: 14, repartition: 'egale' },
      'heures-facturees': { annuel: arr(total('heures-facturees') * 1.07, 10), repartition: 'saisonniere' },
      'taux-charge': { annuel: 80, repartition: 'egale' },
      absenteisme: { annuel: 3.5, repartition: 'egale' },
      formation: { repartition: 'manuelle', mensuels: [0, 0, 40, 0, 0, 40, 0, 0, 0, 40, 40, 0] },
      accidents: { annuel: 0, repartition: 'egale' },
      reclamations: { annuel: 36, repartition: 'egale' },
      satisfaction: { annuel: 8.5, repartition: 'egale' },
    };
    // Revues des trois derniers mois.
    const jour = (mm, j) => `${mm}-${String(j).padStart(2, '0')}`;
    const m1 = ajoutMois(L, -2), m2 = ajoutMois(L, -1);
    e.revues[m1] = { faits: 'Trésorerie passée sous le plancher : paiement de la TVA et d\'un fournisseur de pièces le même mois, deux gros clients en retard.', actions: [
      { id: R.nouvelId(), texte: 'Relancer les deux clients en retard de plus de 30 jours', responsable: 'Direction', echeance: jour(m2, 10), statut: 'faite', indicateur: 'retards' },
      { id: R.nouvelId(), texte: 'Négocier un paiement en deux fois avec le fournisseur de pièces', responsable: 'Direction', echeance: jour(m2, 15), statut: 'ouverte', indicateur: 'tresorerie' },
    ] };
    e.revues[m2] = { faits: 'Hausse du prix des pièces détachées répercutée sur les contrats neufs seulement. Recrutement d\'un technicien en cours.', actions: [
      { id: R.nouvelId(), texte: 'Revoir la grille de prix des contrats de maintenance existants', responsable: 'Direction', echeance: jour(L, 28), statut: 'ouverte', indicateur: 'taux-marge' },
    ] };
    e.revues[L] = { faits: 'Bon mois de facturation. La marge reste sous l\'objectif : prix des pièces.', actions: [
      { id: R.nouvelId(), texte: 'Comparer deux fournisseurs de pièces avant la prochaine commande', responsable: 'Responsable technique', echeance: jour(moisCourant(), 20), statut: 'ouverte', indicateur: 'achats' },
    ] };
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Tableau de bord de pilotage PME · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="200" width="60" height="80" fill="#1D4E89"/>
          <rect x="96" y="140" width="60" height="140" fill="#F5B400"/>
          <rect x="172" y="70" width="60" height="210" fill="#D9302A"/>
          <rect x="248" y="110" width="60" height="170" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="440" cy="150" r="120" fill="#F0EDE6"/>
          <path d="M440 150 L440 30 A120 120 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="410" y="160" width="60" height="60" fill="#1D4E89"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Tableau de bord de pilotage PME</p>
          <h1>Tes chiffres, face à tes objectifs.</h1>
          <p>Chiffre d'affaires, marge, trésorerie, charge, qualité : dix minutes de saisie par mois, les écarts, les tendances et la revue mensuelle se calculent.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton tableau de bord</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes chiffres sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon tableau de bord</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/pilotage-pme/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon tableau de bord'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, entreprise: '', debutMois: 1, profil: 'services', choisis: new Set(B.profils[0].indicateurs) });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On construit ton tableau de bord.</h1>
        <p class="intro">Tu choisis tes indicateurs dans une bibliothèque de ${B.indicateurs.length}, tu fixes tes objectifs de l'année, puis tu saisis tes chiffres une fois par mois : écarts, tendances, alertes et revue mensuelle se calculent. Rien n'est relié à ta banque ni à ta comptabilité.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ton entreprise <small>Facultatif, en tête de la revue mensuelle.</small><input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80"></label>
          <label class="champ">Début de l'exercice <small>Premier mois de ton année comptable.</small><select id="debut">${R.MOIS.map((nm, i) => `<option value="${i + 1}" ${a.debutMois === i + 1 ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>
        </div>
        <fieldset class="champ" style="margin-top:20px;border:0;padding:0"><legend>Ton activité <small>Pour cocher un jeu d'indicateurs de départ, modifiable à l'étape suivante.</small></legend>
          <div class="choix-activite">${B.profils.map((x) => `<label><input type="radio" name="profil" value="${x.id}" ${x.id === a.profil ? 'checked' : ''}><span><b>${esc(x.nom)}</b><small>${esc(x.detail)} · ${x.indicateurs.length} indicateurs</small></span></label>`).join('')}</div>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Choisir mes indicateurs</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes indicateurs</h1>
        <p class="intro">Coche ceux que tu veux suivre. Un indicateur calculé (repéré « calculé ») ajoute aussi ceux dont il a besoin. Tu pourras en ajouter ou en retirer à tout moment depuis la bibliothèque.</p>
        <p class="resume-liste" id="nb-choisis">${pluriel(a.choisis.size, 'indicateur coché', 'indicateurs cochés')}</p>
        <div class="choix-types">${B.domaines.map((d) => `<fieldset class="groupe-types" style="--c:${d.couleur}"><legend>${formeDomaine(d)} ${esc(d.nom)}</legend>
          ${B.indicateurs.filter((k) => k.domaine === d.id).map((k) => `<label class="case"><input type="checkbox" name="choix" value="${k.id}" ${a.choisis.has(k.id) ? 'checked' : ''}><span>${esc(k.nom)}${k.calcul ? ' <small class="etiquette sable">calculé</small>' : ''}</span></label>`).join('')}</fieldset>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon tableau de bord</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    $('#debut')?.addEventListener('change', (e) => { accueil.debutMois = Number(e.target.value); });
    document.querySelectorAll('[name=profil]').forEach((el) => el.addEventListener('change', () => { accueil.profil = el.value; accueil.choisis = new Set(B.profils.find((p) => p.id === el.value).indicateurs); }));
    document.querySelectorAll('[name=choix]').forEach((el) => el.addEventListener('change', () => {
      if (el.checked) accueil.choisis.add(el.value); else accueil.choisis.delete(el.value);
      $('#nb-choisis').textContent = pluriel(accueil.choisis.size, 'indicateur coché', 'indicateurs cochés');
    }));
  }

  function terminerAccueil() {
    if (!accueil.choisis.size) { toast('Coche au moins un indicateur.'); return; }
    E = R.etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.debutMois = accueil.debutMois;
    E.profil = accueil.profil;
    for (const k of B.indicateurs) if (accueil.choisis.has(k.id)) R.ajouterModele(E, B, k.id);
    accueil = accueilVide();
    vue = 'saisie';
    mois = ajoutMois(moisCourant(), -1);
    sauver();
    demarrer();
    toast('Ton tableau de bord est prêt. Saisis les chiffres du mois dernier, puis fixe tes objectifs.');
  }

  // ---------- Icônes, formes, statuts ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    saisie: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    indicateurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="5" height="8" fill="currentColor"/><rect x="10" y="8" width="5" height="13" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="5" height="18" fill="currentColor"/></svg>',
    objectifs: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    revue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    imprimer: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="3" width="12" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="9" width="18" height="8" fill="currentColor"/><rect x="7" y="14" width="10" height="7" fill="#fff" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['saisie', 'Saisie'], ['indicateurs', 'Indicateurs'], ['objectifs', 'Objectifs'], ['revue', 'Revue']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil de pilotage, pas un logiciel comptable : les valeurs sont celles que tu saisis (hors taxes sauf mention contraire) et les indicateurs calculés sont des estimations de gestion. Le résultat comptable et les déclarations relèvent de ton expert-comptable. Aucun ratio de référence n\'est imposé : les objectifs sont les tiens.</p>';

  function formeDomaine(d, taille = 14) {
    const c = d.couleur;
    const f = {
      rond: `<circle cx="7" cy="7" r="7" fill="${c}"/>`,
      carre: `<rect width="14" height="14" fill="${c}"/>`,
      quart: `<path d="M0 14V0a14 14 0 0 1 14 14Z" fill="${c}"/>`,
      triangle: `<path d="M7 0 14 14H0Z" fill="${c}"/>`,
      barres: `<rect x="0" y="6" width="4" height="8" fill="${c}"/><rect x="5" y="3" width="4" height="11" fill="${c}"/><rect x="10" y="0" width="4" height="14" fill="${c}"/>`,
      losange: `<path d="M7 0 14 7 7 14 0 7Z" fill="${c}"/>`,
    }[d.forme] || '';
    return `<svg class="forme-dom" viewBox="0 0 14 14" width="${taille}" height="${taille}" aria-hidden="true">${f}</svg>`;
  }
  const ICONE_STATUT = {
    atteint: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.5 8.2 7 10.6l4.6-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    vigilance: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1 15.5 15H.5Z" fill="currentColor"/><rect x="7.1" y="5.5" width="1.8" height="5" fill="#fff"/><rect x="7.1" y="11.6" width="1.8" height="1.8" fill="#fff"/></svg>',
    alerte: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect width="16" height="16" rx="3" fill="currentColor"/><path d="M5 5l6 6M11 5l-6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
    neutre: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4.5" y="7" width="7" height="2" fill="currentColor"/></svg>',
    vide: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.4"/></svg>',
  };
  const etiquetteStatut = (s, lib = R.LIB_STATUT[s]) => `<span class="statut st-${s}">${ICONE_STATUT[s]}<span>${esc(lib)}</span></span>`;
  function flecheTendance(k, t) {
    if (!t) return '<span class="tendance">Tendance : pas assez de mois</span>';
    const fl = { hausse: '↗', baisse: '↘', stable: '→' }[t.direction];
    const lib = { hausse: 'en hausse', baisse: 'en baisse', stable: 'stable' }[t.direction];
    const cls = t.favorable === true ? 'fav' : t.favorable === false ? 'defav' : '';
    const juge = t.favorable === true ? ', favorable' : t.favorable === false ? ', défavorable' : '';
    const v = k.unite === '%' ? formatEcart(k, t.delta) : pctTexte(t.variation);
    return `<span class="tendance ${cls}" title="Moyenne des 3 derniers mois face aux 3 précédents"><b aria-hidden="true">${fl}</b> ${lib}${t.direction === 'stable' ? '' : ` (${v})`}${juge}</span>`;
  }

  // ---------- Application ----------
  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    if (!mois) mois = R.moisParDefaut(E, moisCourant());
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/pilotage-pme/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Pilotage<br>PME</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span><span class="court">${id === 'tableau' ? 'Bord' : nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  const saisieEnCours = () => document.activeElement?.matches?.('[data-saisie],[data-obj],textarea');

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Pilotage PME`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, saisie: vueSaisie, indicateurs: vueIndicateurs, objectifs: vueObjectifs, revue: vueRevue }[vue]();
    brancherInfobulles();
    brancherVue();
  }

  function changerVue(v, { haut = true } = {}) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    if (haut) window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="56" width="24" height="40" fill="#1D4E89"/><rect x="32" y="32" width="24" height="64" fill="#F5B400"/><rect x="64" y="8" width="24" height="88" fill="#D9302A"/></svg>';

  // Sélecteur de mois : de 36 mois avant le premier mois saisi (ou avant aujourd'hui) au mois courant.
  function choixMois(id = 'choix-mois') {
    const courant = moisCourant();
    const saisisMois = Object.keys(E.saisies).sort();
    const premier = saisisMois.length && saisisMois[0] < ajoutMois(courant, -24) ? saisisMois[0] : ajoutMois(courant, -24);
    const liste = [];
    for (let m = courant; m >= premier; m = ajoutMois(m, -1)) liste.push(m);
    if (!liste.includes(mois)) liste.unshift(mois);
    return `<div class="choix-mois" role="group" aria-label="Mois affiché">
      <button type="button" class="btn-icone" data-action="mois" data-d="-1" aria-label="Mois précédent">‹</button>
      <label><span class="sr-only">Mois</span><select id="${id}" data-choix-mois>${liste.map((m) => `<option value="${m}" ${m === mois ? 'selected' : ''}>${libMois(m)}</option>`).join('')}</select></label>
      <button type="button" class="btn-icone" data-action="mois" data-d="1" aria-label="Mois suivant" ${mois >= courant ? 'disabled' : ''}>›</button>
    </div>`;
  }

  function filtresDomaines(liste) {
    const nb = (id) => liste.filter((k) => k.domaine === id).length;
    return `<div class="filtres" role="group" aria-label="Filtrer par domaine">
      <button class="filtre" data-action="filtre-dom" data-dom="" aria-pressed="${!filtre.domaine}">Tous <small>${liste.length}</small></button>
      ${B.domaines.filter((d) => nb(d.id)).map((d) => `<button class="filtre" data-action="filtre-dom" data-dom="${d.id}" aria-pressed="${filtre.domaine === d.id}">${formeDomaine(d, 12)} ${esc(d.nom)} <small>${nb(d.id)}</small></button>`).join('')}
    </div>`;
  }

  // Mini-courbe des 12 derniers mois (teinte discrète, mois affiché en bleu).
  function sparkline(id) {
    const s = R.serie(E, id, mois, 12);
    const v = s.map((x) => x.reel);
    const ok = v.filter((x) => x !== null);
    if (ok.length < 2) return '<span class="spark vide" aria-hidden="true"></span>';
    const W = 120, H = 32, min = Math.min(...ok), max = Math.max(...ok), e = max - min || Math.abs(max) || 1;
    const x = (i) => 3 + (i * (W - 6)) / 11, y = (val) => H - 4 - ((val - min) / e) * (H - 8);
    let d = '', prec = false;
    v.forEach((val, i) => { if (val === null) { prec = false; return; } d += `${prec ? 'L' : 'M'}${x(i).toFixed(1)} ${y(val).toFixed(1)}`; prec = true; });
    const fin = v[11] !== null ? `<circle cx="${x(11).toFixed(1)}" cy="${y(v[11]).toFixed(1)}" r="3.5" fill="#2F64A8" stroke="#fff" stroke-width="1.5"/>` : '';
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="#8C857A" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>${fin}</svg>`;
  }

  function ligneObjectif(f) {
    const k = f.k;
    if (f.reel === null) return 'Pas encore saisi pour ce mois';
    if (f.objectif === null) return k.sens === 'neutre' ? 'Suivi sans objectif' : 'Aucun objectif fixé';
    return `Objectif ${format(k, f.objectif, { compact: true })} · écart ${formatEcart(k, f.ecart.abs, { compact: true })}${k.unite !== '%' && fini(f.ecart.pct) ? ` (${pctTexte(f.ecart.pct)})` : ''}`;
  }
  function ligneCumul(f) {
    const k = f.k, c = f.cumul;
    if (c.reel === null || !c.saisis) return '';
    const lib = R.estFlux(k) ? 'Cumul' : k.cumul === 'dernier' ? 'Dernier connu' : 'Exercice';
    if (k.cumul === 'dernier') return '';
    return `${lib} ${R.libExercice(c.exercice, E.debutMois)} : ${format(k, c.reel, { compact: true })}${c.objectif !== null ? ` / ${format(k, c.objectif, { compact: true })}` : ''}`;
  }

  function tuileIndic(f) {
    const k = f.k;
    const d = domaine(k.domaine);
    const cum = ligneCumul(f);
    return `<li class="tuile-kpi st-${f.statut}" style="--c:${d.couleur}">
      <button class="tk-corps" data-action="fiche" data-id="${k.id}" aria-label="${esc(k.nom)} : ${esc(format(k, f.reel))}, ${esc(R.LIB_STATUT[f.statut])}. Ouvrir la fiche">
        <span class="tk-tete">${formeDomaine(d, 12)}<b>${esc(k.nom)}</b></span>
        <span class="tk-valeur">${format(k, f.reel, { compact: true })}</span>
        <span class="tk-obj">${ligneObjectif(f)}</span>
        ${cum ? `<span class="tk-cumul">${cum}</span>` : ''}
        <span class="tk-pied">${etiquetteStatut(f.statut)}${sparkline(k.id)}</span>
        ${flecheTendance(k, f.tendance)}
      </button>
    </li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const titre = (sous) => `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}${sous}</p></div>
        <div class="actions">${choixMois()}<button class="btn primaire" data-action="vue" data-vue="saisie">Saisir ${esc(libMois(mois, { annee: false }))}</button></div></div>`;
    const ks = R.actifs(E);
    if (!ks.length) return `${titre('Aucun indicateur suivi.')}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun indicateur</h3><p>Ajoute des indicateurs depuis la bibliothèque : chiffre d'affaires, marge, trésorerie, charge, qualité…</p><div class="actions"><button class="btn primaire" data-action="bibliotheque">Ouvrir la bibliothèque</button></div></div></div>${AVERTISSEMENT}`;
    const s = R.synthese(E, mois);
    const c = s.completude;
    const visibles = s.lignes.filter((f) => !filtre.domaine || f.k.domaine === filtre.domaine);
    const compte = ['alerte', 'vigilance', 'atteint', 'neutre'].map((st) => `<div class="compte-statut st-${st}"><span class="cs-icone">${ICONE_STATUT[st]}</span><b>${s.parStatut[st]}</b><span>${R.LIB_STATUT[st]}</span></div>`).join('');
    const points = [...s.alertes, ...s.vigilances.slice(0, Math.max(0, 6 - s.alertes.length))];
    const autres = s.alertes.length + s.vigilances.length - points.length;
    const groupes = B.domaines.map((d) => [d, visibles.filter((f) => f.k.domaine === d.id)]).filter(([, l]) => l.length);
    return `${titre(`Tes indicateurs de ${esc(libMois(mois))} face à leurs objectifs.`)}
      ${c.remplis < c.total ? `<p class="aide aide-saisie">${c.remplis ? `${pluriel(c.total - c.remplis, 'indicateur')} sur ${c.total} pas encore ${c.total - c.remplis > 1 ? 'saisis' : 'saisi'} pour ${esc(libMois(mois))}` : `Rien n'est saisi pour ${esc(libMois(mois))}`}. <button class="btn lien" data-action="vue" data-vue="saisie">Compléter la saisie</button></p>` : ''}
      <div class="comptes-statuts">${compte}</div>
      ${points.length ? `<section><h2 class="titre-section">Points d'attention <span>${pluriel(s.alertes.length, 'alerte')} · ${s.vigilances.length} à surveiller</span></h2>
        <ul class="points">${points.map((f) => `<li class="st-${f.statut}"><button class="lien-ligne" data-action="fiche" data-id="${f.k.id}"><b>${esc(f.k.nom)}</b><span>${format(f.k, f.reel)} · ${esc(ligneObjectif(f))}${f.statut === 'alerte' && fini(f.k.plancher) && f.reel < f.k.plancher ? ` · sous le plancher de ${format(f.k, f.k.plancher)}` : ''}${f.statut === 'alerte' && fini(f.k.plafond) && f.reel > f.k.plafond ? ` · au-dessus du plafond de ${format(f.k, f.k.plafond)}` : ''}</span></button>${etiquetteStatut(f.statut)}</li>`).join('')}</ul>${autres ? `<p class="mention" style="margin-top:8px">Et ${pluriel(autres, 'autre indicateur', 'autres indicateurs')} à surveiller, repérés dans les tuiles ci-dessous.</p>` : ''}</section>` : ''}
      <div class="outils-liste">${filtresDomaines(ks)}</div>
      ${groupes.map(([d, l]) => `<section class="groupe-dom"><h2 class="titre-section">${formeDomaine(d, 16)} ${esc(d.nom)} <span>${pluriel(l.length, 'indicateur')}</span></h2><ul class="grille-kpi">${l.map(tuileIndic).join('')}</ul></section>`).join('')}
      ${AVERTISSEMENT}`;
  }

  // ---------- Saisie ----------
  function vueSaisie() {
    const ks = R.actifs(E);
    const c = R.completude(E, mois);
    const prec = ajoutMois(mois, -1), an1 = ajoutMois(mois, -12);
    const tete = `<div class="vue-tete"><div><h1>Saisie du mois</h1><p>Un chiffre par indicateur, hors taxes sauf mention contraire. Entrée passe au champ suivant ; chaque valeur s'enregistre dès que tu quittes le champ. Les indicateurs calculés se mettent à jour seuls.</p></div>
      <div class="actions">${choixMois()}</div></div>`;
    if (!ks.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun indicateur à saisir</h3><p>Ajoute d'abord tes indicateurs depuis la bibliothèque.</p><div class="actions"><button class="btn primaire" data-action="bibliotheque">Ouvrir la bibliothèque</button></div></div></div>`;
    const groupes = B.domaines.map((d) => [d, ks.filter((k) => k.domaine === d.id)]).filter(([, l]) => l.length);
    const ligne = (k) => {
      const v = R.valeur(E, k.id, mois), vp = R.valeur(E, k.id, prec), va = R.valeur(E, k.id, an1), o = R.objectifMois(E, k.id, mois);
      const rappels = [vp !== null && `${libMois(prec, { court: true, annee: false })} : ${format(k, vp)}`, va !== null && `${libMois(an1, { court: true })} : ${format(k, va)}`, o !== null && `objectif : ${format(k, o)}`].filter(Boolean).join(' · ');
      if (k.calcul) {
        return `<li class="ligne-saisie calcule"><div class="ls-nom"><b>${esc(k.nom)}</b><small>Calculé : ${esc(k.formule || '')}</small></div>
          <div class="ls-valeur" data-calc="${k.id}">${format(k, v)}</div><div class="ls-rappel">${rappels}</div></li>`;
      }
      return `<li class="ligne-saisie"><label class="ls-nom" for="s-${k.id}"><b>${esc(k.nom)}</b><small>${esc(k.source || '')}</small></label>
        <div class="ls-champ"><input id="s-${k.id}" data-saisie="${k.id}" inputmode="decimal" autocomplete="off" value="${esc(R.saisie(v))}" placeholder="${vp !== null ? esc(R.saisie(R.arrondi(vp, k.decimales))) : ''}" aria-describedby="r-${k.id}"><span class="ls-unite">${esc(k.unite === 'nb' ? '' : k.unite === 'note' ? '/10' : k.unite)}</span></div>
        <div class="ls-rappel" id="r-${k.id}">${rappels || 'Aucun historique'}</div></li>`;
    };
    return `${tete}
      <p class="resume-liste" id="completude">${c.remplis} sur ${pluriel(c.total, 'indicateur')} ${c.total > 1 ? 'saisis' : 'saisi'} pour ${esc(libMois(mois))}${c.remplis === c.total ? ' · mois complet' : ''}</p>
      <p class="erreur" id="erreur-saisie" role="alert"></p>
      ${groupes.map(([d, l]) => `<section class="bloc-saisie"><h2 class="titre-section">${formeDomaine(d, 16)} ${esc(d.nom)}</h2><ul class="lignes-saisie">${l.map(ligne).join('')}</ul></section>`).join('')}
      <div class="rang" style="margin-top:24px"><button class="btn primaire" data-action="vue" data-vue="tableau">Voir le tableau de bord</button><button class="btn" data-action="vue" data-vue="revue">Préparer la revue</button></div>
      <p class="mention" style="margin-top:16px">Le champ vide en gris rappelle la valeur du mois précédent : il n'est pas enregistré tant que tu ne saisis rien.</p>`;
  }

  function enregistrerSaisie(input) {
    const id = input.dataset.saisie;
    const k = R.indicateur(E, id);
    const brut = input.value.trim();
    const err = $('#erreur-saisie');
    if (brut === '') {
      if (E.saisies[mois] && id in E.saisies[mois]) { delete E.saisies[mois][id]; if (!Object.keys(E.saisies[mois]).length) delete E.saisies[mois]; sauver(); }
      input.classList.remove('invalide'); majCalcules(); return true;
    }
    const v = R.lireNombre(brut);
    if (v === null) { input.classList.add('invalide'); if (err) err.textContent = `« ${brut} » n'est pas un nombre (${k.nom}).`; return false; }
    input.classList.remove('invalide'); if (err) err.textContent = '';
    if (E.saisies[mois]?.[id] !== v) { (E.saisies[mois] ||= {})[id] = v; sauver(); }
    input.value = R.saisie(v);
    majCalcules();
    return true;
  }
  function majCalcules() {
    document.querySelectorAll('[data-calc]').forEach((el) => { const k = R.indicateur(E, el.dataset.calc); el.textContent = format(k, R.valeur(E, k.id, mois)); });
    const c = R.completude(E, mois);
    const p = $('#completude');
    if (p) p.textContent = `${c.remplis} sur ${pluriel(c.total, 'indicateur')} ${c.total > 1 ? 'saisis' : 'saisi'} pour ${libMois(mois)}${c.remplis === c.total ? ' · mois complet' : ''}`;
  }

  // ---------- Indicateurs : liste, fiche, bibliothèque ----------
  function vueIndicateurs() {
    if (detail && R.indicateur(E, detail)) return vueFiche(detail);
    detail = null;
    const ks = R.actifs(E);
    const onglets = `<div class="sous-onglets" role="group" aria-label="Affichage"><button class="filtre" data-action="sous-vue" data-sv="suivis" aria-pressed="${sousVue === 'suivis'}">Mes indicateurs <small>${ks.length}</small></button><button class="filtre" data-action="sous-vue" data-sv="bibliotheque" aria-pressed="${sousVue === 'bibliotheque'}">Bibliothèque <small>${B.indicateurs.length}</small></button></div>`;
    const tete = `<div class="vue-tete"><div><h1>Indicateurs</h1><p>${sousVue === 'suivis' ? 'Ceux que tu suis. Ouvre-en un pour sa courbe sur 12 mois, son cumul, sa projection et sa définition.' : 'Indicateurs types par domaine, avec leur définition, leur formule et leur sens de lecture. Aucun ratio de référence : tu fixes tes propres objectifs.'}</p></div>
      <div class="actions"><button class="btn" data-action="nouvel-indic">${ICONES.plus}Indicateur personnalisé</button></div></div>`;
    if (sousVue === 'bibliotheque') return `${tete}${onglets}${vueBibliotheque()}`;
    const groupes = B.domaines.map((d) => [d, ks.filter((k) => k.domaine === d.id)]).filter(([, l]) => l.length);
    const exo = R.exerciceDe(mois, E.debutMois);
    const ligne = (k) => {
      const f = R.fiche(E, k.id, mois);
      const oa = R.objectifAnnuel(E, k.id, exo);
      return `<li class="ligne-indic"><button class="lien-ligne" data-action="fiche" data-id="${k.id}"><b>${esc(k.nom)}</b><span>${esc(R.SENS[k.sens])} · ${k.calcul ? `calculé : ${esc(k.formule || descCalcul(k))}` : 'saisi'}${k.responsable ? ` · ${esc(k.responsable)}` : ''}</span></button>
        <span class="li-obj"><small>Objectif ${R.libExercice(exo, E.debutMois)}</small><b>${oa === null ? '–' : format(k, oa, { compact: true })}</b></span>
        <span class="li-mois"><small>${esc(libMois(mois, { court: true }))}</small><b>${format(k, f.reel, { compact: true })}</b></span>
        ${etiquetteStatut(f.statut)}
        <button class="btn petit" data-action="modifier-indic" data-id="${k.id}">Modifier</button></li>`;
    };
    return `${tete}${onglets}
      ${ks.length ? groupes.map(([d, l]) => `<section><h2 class="titre-section">${formeDomaine(d, 16)} ${esc(d.nom)} <span>${pluriel(l.length, 'indicateur')}</span></h2><ul class="lignes-indic">${l.map(ligne).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun indicateur suivi</h3><p>Choisis-les dans la bibliothèque.</p><div class="actions"><button class="btn primaire" data-action="sous-vue" data-sv="bibliotheque">Ouvrir la bibliothèque</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  const descCalcul = (k) => (k.calcul ? (k.calcul.type === 'ratio' ? `${nomIndic(k.calcul.a)} ÷ ${nomIndic(k.calcul.b)}${k.calcul.facteur !== 1 ? ` × ${k.calcul.facteur}` : ''}` : `${nomIndic(k.calcul.a)} − ${nomIndic(k.calcul.b)}`) : '');

  function vueBibliotheque() {
    const q = filtre.q.trim().toLowerCase();
    const liste = B.indicateurs.filter((m) => (!filtre.domaine || m.domaine === filtre.domaine) && (!q || `${m.nom} ${m.definition} ${m.formule}`.toLowerCase().includes(q)));
    const carte = (m) => {
      const suivi = R.indicateur(E, m.id)?.actif !== false && !!R.indicateur(E, m.id);
      const deps = m.calcul ? R.dependancesModele(B, m.id).filter((x) => x !== m.id && !R.indicateur(E, x)) : [];
      return `<li class="carte-biblio">
        <div class="cb-tete"><b>${esc(m.nom)}</b><span class="etiquette sable">${esc(B.unites.find(([u]) => u === m.unite)?.[1] || m.unite)}</span>${m.calcul ? '<span class="etiquette ciel">Calculé</span>' : ''}</div>
        <p>${esc(m.definition)}</p>
        <p class="cb-formule"><span>Formule</span>${esc(m.formule)}</p>
        <p class="cb-sens"><span>Sens de lecture</span>${m.lecture.startsWith(R.SENS[m.sens]) ? "" : `${esc(R.SENS[m.sens])}. `}${esc(m.lecture)}</p>
        <details><summary>Où trouver le chiffre, conseil</summary><p><b>Source :</b> ${esc(m.source)}</p><p><b>Conseil :</b> ${esc(m.conseil)}</p><p class="mention">Cumul sur l'exercice : ${esc(R.CUMULS[m.cumul].toLowerCase())} · tolérance proposée ${m.tolerance} % de l'objectif.</p></details>
        <div class="cb-pied">${suivi ? '<span class="statut st-atteint">' + ICONE_STATUT.atteint + '<span>Suivi</span></span>' : `<button class="btn petit primaire" data-action="ajouter-modele" data-id="${m.id}">${ICONES.plus}Ajouter${deps.length ? ` (+${deps.length})` : ''}</button>`}${deps.length && !suivi ? `<small>Ajoute aussi : ${deps.map((x) => esc(B.indicateurs.find((y) => y.id === x).nom)).join(', ')}</small>` : ''}</div>
      </li>`;
    };
    const groupes = B.domaines.map((d) => [d, liste.filter((m) => m.domaine === d.id)]).filter(([, l]) => l.length);
    return `<div class="outils-liste">${filtresDomaines(B.indicateurs)}<label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un indicateur" value="${esc(filtre.q)}"></label></div>
      ${groupes.length ? groupes.map(([d, l]) => `<section><h2 class="titre-section">${formeDomaine(d, 16)} ${esc(d.nom)} <span>${pluriel(l.length, 'indicateur')}</span></h2><ul class="grille-biblio">${l.map(carte).join('')}</ul></section>`).join('') : '<p class="aide">Aucun indicateur ne correspond à ta recherche.</p>'}
      ${AVERTISSEMENT}`;
  }

  function vueFiche(id) {
    const f = R.fiche(E, id, mois);
    const k = f.k, d = domaine(k.domaine), c = f.cumul, p = f.projection;
    const bloc = (lib, val, sous = '') => `<div><span>${lib}</span><b>${val}</b>${sous ? `<small>${sous}</small>` : ''}</div>`;
    const exo = R.libExercice(c.exercice, E.debutMois);
    const resume = [
      bloc(esc(libMois(mois)), format(k, f.reel), etiquetteStatut(f.statut)),
      bloc('Objectif du mois', format(k, f.objectif), f.ecart ? `Écart ${formatEcart(k, f.ecart.abs)}${k.unite !== '%' && fini(f.ecart.pct) ? ` (${pctTexte(f.ecart.pct)})` : ''}` : (k.sens === 'neutre' ? 'Suivi sans objectif' : 'Aucun objectif')),
      k.cumul === 'dernier' ? '' : bloc(`${R.estFlux(k) ? 'Cumul' : 'Sur l\'exercice'} ${exo}`, format(k, c.reel), c.objectif !== null ? `Objectif ${format(k, c.objectif)} · ${etiquetteStatut(c.statut)}` : `${pluriel(c.saisis, 'mois saisi', 'mois saisis')}`),
      p ? bloc('Projection fin d\'exercice', format(k, p.valeur), p.base === 'objectif' ? `Au rythme actuel, objectif annuel ${format(k, p.objectif)}${p.ecart && fini(p.ecart.pct) ? ` (${pctTexte(p.ecart.pct)})` : ''}` : 'Rythme mensuel moyen × 12') : '',
      bloc('Tendance 3 mois', f.tendance ? { hausse: 'En hausse', baisse: 'En baisse', stable: 'Stable' }[f.tendance.direction] : '–', flecheTendance(k, f.tendance)),
      bloc('Il y a un an', f.an ? format(k, f.an.valeur) : '–', f.an ? (k.unite === '%' ? formatEcart(k, f.an.delta) : pctTexte(f.an.pct)) + ' sur un an' : 'Pas de valeur'),
    ].join('');
    const seuils = [fini(k.plancher) && `plancher ${format(k, k.plancher)}`, fini(k.plafond) && `plafond ${format(k, k.plafond)}`, k.sens !== 'neutre' && `tolérance ${R.nombre(k.tolerance, 0)} % de l'objectif`].filter(Boolean).join(' · ');
    const utilise = R.utilisePar(E, id);
    return `<nav class="fil-fiche"><button class="btn lien" data-action="fermer-fiche">‹ Tous les indicateurs</button></nav>
      <div class="vue-tete"><div><p class="surtitre">${formeDomaine(d, 12)} ${esc(d.nom)}</p><h1>${esc(k.nom)}</h1><p>${esc(k.definition)}</p></div>
        <div class="actions">${choixMois()}<button class="btn" data-action="modifier-indic" data-id="${k.id}">Modifier</button></div></div>
      <div class="resume-fiche">${resume}</div>
      ${graphiqueFiche(k)}
      <div class="colonnes-fiche">
        <section class="bloc-detail"><h3>Comment le lire</h3>
          <dl class="def">
            <dt>Formule</dt><dd>${esc(k.formule || descCalcul(k) || '–')}${k.calcul && k.formule ? `<br><small>Avec tes indicateurs : ${esc(descCalcul(k))}</small>` : ''}</dd>
            <dt>Sens de lecture</dt><dd>${k.lecture.startsWith(R.SENS[k.sens]) ? esc(k.lecture) : `<b>${esc(R.SENS[k.sens])}.</b> ${esc(k.lecture)}`}</dd>
            <dt>Où trouver le chiffre</dt><dd>${esc(k.source || '–')}</dd>
            ${k.conseil ? `<dt>Conseil</dt><dd>${esc(k.conseil)}</dd>` : ''}
            <dt>Cumul et seuils</dt><dd>${esc(R.CUMULS[k.cumul])}${seuils ? ` · ${seuils}` : ''}${k.responsable ? ` · responsable : ${esc(k.responsable)}` : ''}</dd>
            ${utilise.length ? `<dt>Utilisé par</dt><dd>${utilise.map((x) => `<button class="btn lien" data-action="fiche" data-id="${x.id}">${esc(x.nom)}</button>`).join(', ')}</dd>` : ''}
          </dl>
        </section>
        <section class="bloc-detail"><h3>Mois par mois <span>12 derniers mois</span></h3>
          <div class="defile"><table class="tableau petit"><caption class="sr-only">${esc(k.nom)} : réel, objectif et année précédente sur 12 mois</caption><thead><tr><th>Mois</th><th class="nb">Réel</th><th class="nb">Objectif</th><th class="nb">Écart</th><th>Statut</th><th class="nb">An dernier</th></tr></thead>
          <tbody>${R.serie(E, id, mois, 12).reverse().map((x) => { const st = R.statut(k, x.reel, x.objectif); const e = R.ecart(x.reel, x.objectif); return `<tr><td>${esc(libMois(x.mois, { court: true }))}</td><td class="nb">${format(k, x.reel)}</td><td class="nb">${format(k, x.objectif)}</td><td class="nb">${e ? formatEcart(k, e.abs) : '–'}</td><td>${etiquetteStatut(st)}</td><td class="nb">${format(k, x.an1)}</td></tr>`; }).join('')}</tbody></table></div>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Courbe 12 mois : réel (bleu, points), objectif (trait fin pointillé, c'est un seuil), an dernier (ocre).
  // Un seul axe, une seule unité. Survol ou focus d'un mois : infobulle ; tableau accessible en dessous.
  const COUL = { reel: '#2F64A8', an1: '#B8741A', objectif: '#24221F' };
  function graduations(min, max, n = 4) {
    if (min === max) { max = min + (Math.abs(min) || 1); }
    const brut = (max - min) / n;
    const p = 10 ** Math.floor(Math.log10(brut));
    const pas = [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= brut) || 10 * p;
    const debut = Math.floor(min / pas) * pas, fin = Math.ceil(max / pas) * pas;
    const t = [];
    for (let v = debut; v <= fin + pas / 2; v += pas) t.push(Math.round(v * 1e6) / 1e6);
    return t;
  }
  function graphiqueFiche(k) {
    const s = R.serie(E, k.id, mois, 12);
    const vals = s.flatMap((x) => [x.reel, x.objectif, x.an1]).filter((v) => v !== null);
    if (!vals.length) return '<div class="vide-etat petit"><div><h3>Pas encore de valeurs</h3><p>La courbe apparaît dès les premiers mois saisis.</p></div></div>';
    const tel = estTel();
    const W = tel ? 360 : 820, H = tel ? 230 : 280, g = tel ? 44 : 64, dr = 14, h = 16, b = 30;
    const min0 = Math.min(...vals), max0 = Math.max(...vals);
    const ticks = graduations(min0 > 0 && min0 / max0 > 0.6 ? min0 - (max0 - min0) * 0.25 : Math.min(0, min0), max0);
    const ymin = ticks[0], ymax = ticks[ticks.length - 1];
    const pw = W - g - dr, ph = H - h - b;
    const x = (i) => g + (i + 0.5) * (pw / 12), y = (v) => h + ph - ((v - ymin) / (ymax - ymin)) * ph;
    const chemin = (cle) => { let d = '', prec = false; s.forEach((p, i) => { if (p[cle] === null) { prec = false; return; } d += `${prec ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[cle]).toFixed(1)}`; prec = true; }); return d; };
    const pasLib = tel ? 2 : 1;
    const axeX = s.map((p, i) => ((11 - i) % pasLib === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(libMois(p.mois, { court: true, annee: false }))}</text>` : '')).join('');
    const axeY = ticks.map((t) => `<line x1="${g}" x2="${W - dr}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="grille${t === 0 ? ' zero' : ''}"/><text x="${g - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(format(k, t, { compact: true }))}</text>`).join('');
    const points = s.map((p, i) => (p.reel === null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(p.reel).toFixed(1)}" r="${i === 11 ? 5.5 : 4}" fill="${COUL.reel}" stroke="#fff" stroke-width="2"/>`)).join('');
    const finLib = s[11].reel !== null ? `<text x="${Math.min(x(11), W - dr - 4).toFixed(1)}" y="${(y(s[11].reel) - 12).toFixed(1)}" text-anchor="end" class="etiq-fin">${esc(format(k, s[11].reel, { compact: true }))}</text>` : '';
    const cibles = s.map((p, i) => {
      const st = R.statut(k, p.reel, p.objectif), e = R.ecart(p.reel, p.objectif);
      const info = `<b>${esc(libMois(p.mois))}</b>Réel : ${esc(format(k, p.reel))}<br>Objectif : ${esc(format(k, p.objectif))}${e ? `<br>Écart : ${esc(formatEcart(k, e.abs))}` : ''}<br>An dernier : ${esc(format(k, p.an1))}<br>${esc(R.LIB_STATUT[st])}`;
      return `<rect class="cible-mois" x="${(g + i * (pw / 12)).toFixed(1)}" y="${h}" width="${(pw / 12).toFixed(1)}" height="${ph}" tabindex="0" data-info="${esc(info)}" data-x="${x(i).toFixed(1)}" aria-label="${esc(libMois(p.mois))} : ${esc(format(k, p.reel))}"/>`;
    }).join('');
    const legende = [['reel', 'Réel', ''], ['objectif', 'Objectif', 'tirets'], ['an1', 'Année précédente', '']].filter(([c]) => s.some((p) => p[c] !== null))
      .map(([c, l, t]) => `<span class="cle-legende"><svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="${COUL[c]}" stroke-width="${c === 'objectif' ? 1.5 : 2}" ${t ? 'stroke-dasharray="5 4"' : ''} stroke-linecap="round"/>${c === 'reel' ? `<circle cx="11" cy="5" r="3.5" fill="${COUL.reel}"/>` : ''}</svg>${l}</span>`).join('');
    return `<figure class="graphique graphique-fiche" data-largeur="${W}">
      <figcaption class="legende">${legende}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" class="courbe" role="img" aria-label="${esc(k.nom)} sur 12 mois : réel, objectif et année précédente (détail dans le tableau Mois par mois)">
        <g class="axe">${axeY}${axeX}</g>
        <line class="reticule" x1="0" x2="0" y1="${h}" y2="${h + ph}" hidden/>
        <path d="${chemin('an1')}" fill="none" stroke="${COUL.an1}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${chemin('objectif')}" fill="none" stroke="${COUL.objectif}" stroke-width="1.5" stroke-dasharray="6 5" stroke-linecap="round"/>
        <path d="${chemin('reel')}" fill="none" stroke="${COUL.reel}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${points}${finLib}
        <g class="cibles">${cibles}</g>
      </svg>
      <div class="infobulle" hidden></div>
    </figure>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique-fiche').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle'), svg = fig.querySelector('svg.courbe'), ret = fig.querySelector('.reticule');
      const W = Number(fig.dataset.largeur);
      const montrer = (el) => {
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        ret.setAttribute('x1', el.dataset.x); ret.setAttribute('x2', el.dataset.x); ret.hidden = false;
        const rf = fig.getBoundingClientRect(), rs = svg.getBoundingClientRect();
        const px = rs.left - rf.left + (Number(el.dataset.x) / W) * rs.width;
        let gx = px + 14;
        if (gx + bulle.offsetWidth > rf.width - 8) gx = Math.max(8, px - bulle.offsetWidth - 14);
        bulle.style.left = `${gx}px`;
        bulle.style.top = `${rs.top - rf.top + 18}px`;
      };
      const cacher = () => { bulle.hidden = true; ret.hidden = true; };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Objectifs ----------
  function vueObjectifs() {
    if (exerciceVu === null) exerciceVu = R.exerciceDe(mois, E.debutMois);
    const an = exerciceVu;
    const ks = R.actifs(E).filter((k) => k.sens !== 'neutre');
    const tete = `<div class="vue-tete"><div><h1>Objectifs ${esc(R.libExercice(an, E.debutMois))}</h1><p>Un objectif par indicateur pour l'exercice. Les flux (chiffre d'affaires, heures…) se répartissent sur 12 mois ; pour un taux, un niveau ou un effectif, l'objectif est la cible de chaque mois. Les seuils règlent quand un indicateur passe « à surveiller » ou « en alerte ».</p></div>
      <div class="actions"><div class="choix-mois" role="group" aria-label="Exercice"><button type="button" class="btn-icone" data-action="exercice" data-d="-1" aria-label="Exercice précédent">‹</button><b class="exo-lib">${esc(R.libExercice(an, E.debutMois))}</b><button type="button" class="btn-icone" data-action="exercice" data-d="1" aria-label="Exercice suivant">›</button></div>
      <button class="btn" data-action="copier-objectifs">Reprendre ${esc(R.libExercice(an - 1, E.debutMois))}</button></div></div>`;
    if (!ks.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun indicateur à objectif</h3><p>Ajoute des indicateurs depuis la bibliothèque.</p></div></div>`;
    const groupes = B.domaines.map((d) => [d, ks.filter((k) => k.domaine === d.id)]).filter(([, l]) => l.length);
    const ligne = (k) => {
      const o = R.objectifBrut(E, k.id, an);
      const flux = R.estFlux(k);
      const prec = R.valeurPeriode(E, k.id, R.moisExercice(an - 1, E.debutMois));
      const total = R.objectifAnnuel(E, k.id, an);
      const rep = o?.repartition || 'egale';
      const seuils = [`tolérance ${R.nombre(k.tolerance, 0)} %`, fini(k.plancher) && `plancher ${format(k, k.plancher, { compact: true })}`, fini(k.plafond) && `plafond ${format(k, k.plafond, { compact: true })}`].filter(Boolean).join(' · ');
      const saisonManque = rep === 'saisonniere' && !R.poidsSaisonniers(E, k.id, an);
      return `<li class="ligne-obj">
        <div class="lo-nom"><b>${esc(k.nom)}</b><small>${esc(R.SENS[k.sens])} · ${flux ? 'total de l\'exercice' : 'cible mensuelle'}${prec !== null ? ` · ${R.libExercice(an - 1, E.debutMois)} : ${format(k, prec, { compact: true })}` : ''}</small></div>
        <label class="champ lo-champ"><span class="sr-only">Objectif ${esc(k.nom)}</span>
          ${rep === 'manuelle' ? `<span class="lo-total">${format(k, total)}<small>somme des mois</small></span>` : `<span class="ls-champ"><input data-obj="${k.id}" inputmode="decimal" autocomplete="off" value="${esc(R.saisie(o?.annuel ?? null))}" placeholder="${flux ? 'Total annuel' : 'Cible'}"><span class="ls-unite">${esc(k.unite === 'nb' ? '' : k.unite === 'note' ? '/10' : k.unite)}</span></span>`}</label>
        ${flux ? `<label class="champ lo-rep"><span class="sr-only">Répartition</span><select data-rep="${k.id}">${Object.entries(R.REPARTITIONS).map(([v, l]) => `<option value="${v}" ${rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${saisonManque ? '<small class="lo-note">Exercice précédent incomplet : répartition égale appliquée.</small>' : ''}</label>` : `<span class="lo-rep"><small class="lo-note">Même cible chaque mois</small></span>`}
        <div class="lo-actions"><button class="btn petit" data-action="mois-par-mois" data-id="${k.id}">Mois par mois</button><button class="btn petit" data-action="seuils" data-id="${k.id}" title="${esc(seuils)}">Seuils</button></div>
      </li>`;
    };
    return `${tete}
      ${groupes.map(([d, l]) => `<section><h2 class="titre-section">${formeDomaine(d, 16)} ${esc(d.nom)}</h2><ul class="lignes-obj">${l.map(ligne).join('')}</ul></section>`).join('')}
      <p class="aide" style="margin-top:24px">Aucun objectif n'est proposé d'office : fixe-les à partir de ton exercice précédent, de ton budget ou de ton prévisionnel. Les indicateurs « suivis sans jugement » (heures disponibles, livraisons…) n'ont pas d'objectif.</p>
      ${AVERTISSEMENT}`;
  }

  function enregistrerObjectif(input) {
    const id = input.dataset.obj, an = String(exerciceVu);
    const brut = input.value.trim();
    const v = brut === '' ? null : R.lireNombre(brut);
    if (brut !== '' && v === null) { input.classList.add('invalide'); toast(`« ${brut} » n'est pas un nombre.`); return; }
    input.classList.remove('invalide');
    const o = E.objectifs[an]?.[id];
    if ((o?.annuel ?? null) === v) return;
    retenir();
    const objs = (E.objectifs[an] ||= {});
    if (v === null && (!o || o.repartition !== 'manuelle')) delete objs[id];
    else objs[id] = { annuel: v, repartition: o?.repartition || 'egale', mensuels: o?.mensuels || Array(12).fill(null) };
    if (!Object.keys(objs).length) delete E.objectifs[an];
    sauver();
    input.value = R.saisie(v);
  }

  function modaleMoisParMois(id) {
    const k = R.indicateur(E, id), an = exerciceVu;
    const liste = R.moisExercice(an, E.debutMois);
    const actuels = R.objectifsMensuels(E, id, an);
    const corps = `<p class="aide">Saisis l'objectif de chaque mois${R.estFlux(k) ? ' ; le total annuel devient leur somme' : ''}. Laisse vide un mois sans objectif. La répartition passe en « mois par mois ».</p>
      <div class="grille-mois">${liste.map((m, i) => `<label class="champ">${esc(libMois(m, { court: true }))}<input name="m${i}" inputmode="decimal" value="${esc(R.saisie(actuels[i] === null ? null : R.arrondi(actuels[i], k.decimales)))}"></label>`).join('')}</div>
      <p class="resume-liste" id="total-mois"></p><p class="erreur" role="alert"></p>`;
    ouvrirModale(`${esc(k.nom)} · ${esc(R.libExercice(an, E.debutMois))}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const vals = liste.map((_, i) => { const s = String(fd.get(`m${i}`) || '').trim(); return s === '' ? null : R.lireNombre(s); });
      if (liste.some((_, i) => String(fd.get(`m${i}`) || '').trim() !== '' && vals[i] === null)) return 'Un des mois n\'est pas un nombre.';
      retenir();
      const objs = (E.objectifs[String(an)] ||= {});
      if (vals.every((v) => v === null)) delete objs[id];
      else objs[id] = { annuel: R.estFlux(k) ? vals.reduce((s, v) => s + (v || 0), 0) : null, repartition: 'manuelle', mensuels: vals };
      sauver(); rendre();
      toast(`Objectifs mensuels enregistrés : ${k.nom}.`, { libelle: 'Annuler', faire: annuler });
    });
    const maj = () => {
      const vals = [...modale().querySelectorAll('.grille-mois input')].map((x) => R.lireNombre(x.value)).filter(fini);
      $('#total-mois').textContent = R.estFlux(k) ? `Total : ${format(k, vals.reduce((s, v) => s + v, 0))}` : `${pluriel(vals.length, 'mois avec objectif', 'mois avec objectif')}`;
    };
    modale().querySelectorAll('.grille-mois input').forEach((x) => x.addEventListener('input', maj));
    maj();
  }

  function copierObjectifs() {
    const an = exerciceVu, prec = E.objectifs[String(an - 1)];
    if (!prec) { toast(`Aucun objectif pour ${R.libExercice(an - 1, E.debutMois)}.`); return; }
    const deja = E.objectifs[String(an)] && Object.keys(E.objectifs[String(an)]).length;
    if (deja && !confirm(`Remplacer les objectifs de ${R.libExercice(an, E.debutMois)} par ceux de ${R.libExercice(an - 1, E.debutMois)} ?`)) return;
    retenir();
    E.objectifs[String(an)] = structuredClone(prec);
    sauver(); rendre();
    toast('Objectifs repris : ajuste-les pour le nouvel exercice.', { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Revue mensuelle ----------
  function vueRevue() {
    const s = R.synthese(E, mois);
    const rev = E.revues[mois] || { faits: '', actions: [] };
    const reprises = R.actionsReprises(E, mois);
    const cumulTxt = (f) => (f.k.cumul === 'dernier' || f.cumul.reel === null ? '–' : format(f.k, f.cumul.reel, { compact: true }));
    const tableau = B.domaines.map((d) => [d, s.lignes.filter((f) => f.k.domaine === d.id)]).filter(([, l]) => l.length).map(([d, l]) => `
      <tbody><tr class="ligne-dom"><th colspan="8" scope="colgroup">${formeDomaine(d, 12)} ${esc(d.nom)}</th></tr>
      ${l.map((f) => `<tr><th scope="row">${esc(f.k.nom)}</th><td class="nb">${format(f.k, f.reel, { compact: true })}</td><td class="nb">${format(f.k, f.objectif, { compact: true })}</td><td class="nb">${f.ecart ? formatEcart(f.k, f.ecart.abs, { compact: true }) : '–'}</td><td>${etiquetteStatut(f.statut)}</td><td class="nb">${cumulTxt(f)}${f.k.cumul !== 'dernier' && f.cumul.objectif !== null ? `<small> / ${format(f.k, f.cumul.objectif, { compact: true })}</small>` : ''}</td><td>${f.k.cumul === 'dernier' || f.cumul.reel === null ? '–' : etiquetteStatut(f.cumul.statut)}</td><td>${f.tendance ? `${{ hausse: '↗', baisse: '↘', stable: '→' }[f.tendance.direction]}<span class="sr-only"> ${f.tendance.direction}</span>${f.tendance.favorable === false ? ' <small>défav.</small>' : ''}` : '–'}</td></tr>`).join('')}</tbody>`).join('');
    const ligneAction = (a, repris) => `<li class="action ${a.statut === 'faite' ? 'faite' : ''}">
      <label class="case"><input type="checkbox" data-action-faite="${a.id}" data-mois="${repris ? a.mois : mois}" ${a.statut === 'faite' ? 'checked' : ''}><span class="sr-only">Faite</span></label>
      <div><b>${esc(a.texte)}</b><small>${[a.responsable && esc(a.responsable), a.echeance && `échéance ${dateCourte(a.echeance)}${a.statut !== 'faite' && a.echeance < aujIso() ? ' · en retard' : ''}`, a.indicateur && R.indicateur(E, a.indicateur) && esc(nomIndic(a.indicateur)), repris && `décidée en ${esc(libMois(a.mois, { court: true }))}`].filter(Boolean).join(' · ')}</small></div>
      ${repris ? '' : `<button type="button" class="btn-suppr" data-action="suppr-action" data-id="${a.id}" aria-label="Supprimer l'action">×</button>`}</li>`;
    const c = s.completude;
    return `<div class="vue-tete ecran-seul"><div><h1>Revue mensuelle</h1><p>Le point du mois, prêt à imprimer ou à enregistrer en PDF : indicateurs face aux objectifs, faits marquants, décisions et actions.</p></div>
        <div class="actions">${choixMois()}<button class="btn primaire" data-action="imprimer">${ICONES.imprimer}Imprimer</button><button class="btn" data-action="csv-revue">CSV</button></div></div>
      <article class="feuille-revue">
        <header class="fr-tete"><div><p class="surtitre">Revue mensuelle</p><h2>${esc(libMois(mois).replace(/^./, (x) => x.toUpperCase()))}</h2><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}exercice ${esc(R.libExercice(R.exerciceDe(mois, E.debutMois), E.debutMois))} · établie le ${esc(dateCourte(aujIso()))}</p></div>
          <div class="fr-comptes">${['alerte', 'vigilance', 'atteint', 'neutre'].map((st) => `<span class="st-${st}">${ICONE_STATUT[st]}<b>${s.parStatut[st]}</b> ${R.LIB_STATUT[st].toLowerCase()}</span>`).join('')}${s.parStatut.vide ? `<span class="st-vide">${ICONE_STATUT.vide}<b>${s.parStatut.vide}</b> non saisi${s.parStatut.vide > 1 ? 's' : ''}</span>` : ''}</div></header>
        ${c.remplis < c.total ? `<p class="aide ecran-seul">Saisie incomplète : ${pluriel(c.total - c.remplis, 'indicateur')} sans valeur pour ce mois.</p>` : ''}
        <div class="defile"><table class="tableau petit tableau-revue"><caption class="sr-only">Indicateurs de ${esc(libMois(mois))}</caption>
          <thead><tr><th>Indicateur</th><th class="nb">Mois</th><th class="nb">Objectif</th><th class="nb">Écart</th><th>Statut</th><th class="nb">Cumul / obj.</th><th>Cumul</th><th>Tend.</th></tr></thead>
          ${tableau}</table></div>
        ${s.alertes.length ? `<section class="fr-bloc"><h3>Points d'attention</h3><ul class="fr-points">${s.alertes.map((f) => `<li><b>${esc(f.k.nom)}</b> : ${esc(format(f.k, f.reel))}, ${esc(ligneObjectif(f).replace(/^./, (x) => x.toLowerCase()))}. <span>${esc(f.k.lecture)}</span></li>`).join('')}</ul></section>` : ''}
        <section class="fr-bloc"><h3>Faits marquants</h3>
          <label class="ecran-seul champ"><span class="sr-only">Faits marquants du mois</span><textarea id="faits" rows="4" maxlength="4000" placeholder="Ce qui explique les chiffres du mois : gros contrat, départ, hausse de prix, retard client…">${esc(rev.faits)}</textarea></label>
          <p class="impression-seul fr-faits">${esc(rev.faits) || '—'}</p></section>
        <section class="fr-bloc"><h3>Décisions et actions du mois</h3>
          ${rev.actions.length ? `<ul class="actions-revue">${rev.actions.map((a) => ligneAction(a, false)).join('')}</ul>` : '<p class="mention">Aucune action décidée ce mois-ci.</p>'}
          <form class="ajout-action ecran-seul" id="ajout-action" novalidate>
            <label class="champ aa-texte">Action<input name="texte" maxlength="300" placeholder="Ex. : relancer les factures de plus de 30 jours" required></label>
            <label class="champ">Responsable<input name="responsable" maxlength="60"></label>
            <label class="champ">Échéance<input name="echeance" type="date"></label>
            <label class="champ">Indicateur<select name="indicateur"><option value="">—</option>${R.actifs(E).map((k) => `<option value="${k.id}">${esc(k.nom)}</option>`).join('')}</select></label>
            <button class="btn primaire" type="submit">${ICONES.plus}Ajouter</button>
          </form></section>
        ${reprises.length ? `<section class="fr-bloc"><h3>Actions ouvertes des mois précédents <span>${reprises.length}</span></h3><ul class="actions-revue">${reprises.map((a) => ligneAction(a, true)).join('')}</ul></section>` : ''}
        <p class="mention fr-pied">Chiffres saisis par l'entreprise, hors taxes sauf mention contraire ; indicateurs calculés : estimations de gestion, pas des comptes. Tableau de bord de pilotage PME · QME.</p>
      </article>`;
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

  // Création (id absent) ou modification d'un indicateur. seulementSeuils : fenêtre courte depuis Objectifs.
  function modaleIndicateur(id, { seulementSeuils = false } = {}) {
    const k = id ? R.indicateur(E, id) : null;
    if (id && !k) return;
    const v = k || R.normaliserIndicateur({ id: `perso-${R.nouvelId()}`, nom: '', domaine: filtre.domaine || 'commercial', unite: '€', sens: 'haut', cumul: 'somme', tolerance: 10 });
    const nouveau = !k;
    const autres = R.actifs(E).filter((x) => x.id !== v.id);
    const optionsIndic = (sel) => autres.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
    const seuilsHtml = `
      <div class="rang-champs">
        <label class="champ">Tolérance <small>% de l'objectif avant l'alerte</small><input name="tolerance" inputmode="decimal" value="${esc(R.saisie(v.tolerance))}"></label>
        <label class="champ">Plancher <small>Alerte en dessous (facultatif)</small><input name="plancher" inputmode="decimal" value="${esc(R.saisie(v.plancher))}"></label>
        <label class="champ">Plafond <small>Alerte au-dessus (facultatif)</small><input name="plafond" inputmode="decimal" value="${esc(R.saisie(v.plafond))}"></label>
      </div>
      <p class="aide">Atteint : objectif tenu dans le bon sens. À surveiller : écart défavorable dans la tolérance. En alerte : au-delà, ou plancher ou plafond franchi (même sans objectif).</p>`;
    const corps = seulementSeuils ? `${seuilsHtml}<label class="champ">Responsable<input name="responsable" maxlength="60" value="${esc(v.responsable)}"></label><p class="erreur" role="alert"></p>` : `
      <label class="champ">Nom<input name="nom" maxlength="80" required value="${esc(v.nom)}" placeholder="Ex. : Contrats de maintenance actifs"></label>
      <div class="rang-champs">
        <label class="champ">Domaine<select name="domaine">${B.domaines.map((d) => `<option value="${d.id}" ${d.id === v.domaine ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}</select></label>
        <label class="champ">Unité<select name="unite">${B.unites.map(([u, l]) => `<option value="${esc(u)}" ${u === v.unite ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="champ" style="flex:0 1 110px">Décimales<input name="decimales" type="number" min="0" max="3" value="${v.decimales}"></label>
      </div>
      <fieldset class="champ"><legend>Sens de lecture</legend><div class="choix-statut deux">${Object.entries(R.SENS).map(([s, l]) => `<label><input type="radio" name="sens" value="${s}" ${v.sens === s ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>
      ${nouveau ? `<fieldset class="champ"><legend>Valeur <small>Saisie chaque mois, ou calculée à partir de deux indicateurs suivis.</small></legend><div class="choix-statut trois">${[['saisi', 'Saisie'], ['ratio', 'Rapport a ÷ b'], ['difference', 'Différence a − b']].map(([t, l]) => `<label><input type="radio" name="type" value="${t}" ${t === 'saisi' ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <div class="rang-champs" id="champs-calcul" hidden>
          <label class="champ">a<select name="a">${optionsIndic(autres[0]?.id)}</select></label>
          <label class="champ">b<select name="b">${optionsIndic(autres[1]?.id)}</select></label>
          <label class="champ" style="flex:0 1 110px">× facteur<input name="facteur" inputmode="decimal" value="100"></label>
        </div>` : (v.calcul ? `<p class="aide">Calcul : ${esc(descCalcul(v))}.</p>` : '')}
      <label class="champ">Cumul sur l'exercice<select name="cumul">${Object.entries(R.CUMULS).filter(([c]) => c !== 'recalcul' || v.calcul || nouveau).map(([c, l]) => `<option value="${c}" ${v.cumul === c ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><small>Somme pour un flux (CA, heures), dernier mois pour un niveau (trésorerie, effectif), recalcul pour un taux calculé.</small></label>
      ${seuilsHtml}
      <label class="champ">Responsable<input name="responsable" maxlength="60" value="${esc(v.responsable)}" placeholder="Fonction, pas de nom nécessaire"></label>
      <details ${nouveau ? 'open' : ''}><summary>Définition, formule, lecture</summary>
        <label class="champ">Définition<textarea name="definition" rows="2" maxlength="400">${esc(v.definition)}</textarea></label>
        <label class="champ">Formule<input name="formule" maxlength="200" value="${esc(v.formule)}"></label>
        <label class="champ">Comment le lire<textarea name="lecture" rows="2" maxlength="400">${esc(v.lecture)}</textarea></label>
        <label class="champ">Où trouver le chiffre<input name="source" maxlength="200" value="${esc(v.source)}"></label>
      </details>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${!nouveau && !seulementSeuils ? `<button class="btn danger gauche" type="button" data-action="retirer-indic" data-id="${v.id}">${v.modele ? 'Retirer du suivi' : 'Supprimer'}</button>` : ''}`;
    ouvrirModale(seulementSeuils ? `Seuils · ${esc(v.nom)}` : nouveau ? 'Indicateur personnalisé' : esc(v.nom), corps, pied, (fd) => {
      const num = (n) => { const s = String(fd.get(n) ?? '').trim(); return s === '' ? null : R.lireNombre(s); };
      const tol = num('tolerance');
      if (tol === null || tol < 0 || tol > 100) return 'La tolérance est un pourcentage entre 0 et 100.';
      for (const n of ['plancher', 'plafond']) if (String(fd.get(n) ?? '').trim() !== '' && num(n) === null) return `Le ${n} n'est pas un nombre.`;
      if (fini(num('plancher')) && fini(num('plafond')) && num('plancher') > num('plafond')) return 'Le plancher dépasse le plafond.';
      const maj = { tolerance: tol, plancher: num('plancher'), plafond: num('plafond'), responsable: String(fd.get('responsable') || '') };
      if (!seulementSeuils) {
        const nom = String(fd.get('nom') || '').trim();
        if (!nom) return 'Donne un nom à l\'indicateur.';
        Object.assign(maj, { nom, domaine: fd.get('domaine'), unite: fd.get('unite'), decimales: Number(fd.get('decimales')) || 0, sens: fd.get('sens'), cumul: fd.get('cumul'), definition: fd.get('definition'), formule: fd.get('formule'), lecture: fd.get('lecture'), source: fd.get('source') });
        if (nouveau && fd.get('type') !== 'saisi') {
          const calcul = { type: fd.get('type'), a: fd.get('a'), b: fd.get('b'), facteur: num('facteur') ?? 1 };
          if (!calcul.a || !calcul.b) return 'Choisis les deux indicateurs du calcul.';
          if (R.creeBoucle(E, v.id, calcul)) return 'Ce calcul se cite lui-même.';
          maj.calcul = calcul;
          if (!R.CUMULS[maj.cumul] || (maj.cumul === 'somme' && calcul.type === 'ratio')) maj.cumul = 'recalcul';
        } else if (nouveau && maj.cumul === 'recalcul') maj.cumul = 'somme';
      }
      retenir();
      const n = R.normaliserIndicateur({ ...v, ...maj });
      if (nouveau) E.indicateurs.push(n); else E.indicateurs[E.indicateurs.findIndex((x) => x.id === v.id)] = n;
      sauver(); rendre();
      toast(nouveau ? `Indicateur ajouté : ${n.nom}.` : `Indicateur enregistré : ${n.nom}.`, { libelle: 'Annuler', faire: annuler });
    });
    modale().querySelectorAll('[name=type]').forEach((el) => el.addEventListener('change', () => { $('#champs-calcul').hidden = modale().querySelector('[name=type]:checked').value === 'saisi'; }));
  }

  function retirerIndicateur(id) {
    const k = R.indicateur(E, id);
    if (!k) return;
    const util = R.utilisePar(E, id);
    if (util.length) { toast(`Impossible : ${util.map((x) => x.nom).join(', ')} ${util.length > 1 ? 'utilisent' : 'utilise'} cet indicateur. Retire-${util.length > 1 ? 'les' : 'le'} d'abord.`); return; }
    retenir();
    if (k.modele) k.actif = false; else E.indicateurs = E.indicateurs.filter((x) => x.id !== id);
    if (detail === id) detail = null;
    if (modale().open) modale().close();
    sauver(); rendre();
    toast(k.modele ? `${k.nom} retiré du suivi (ses valeurs sont gardées).` : `${k.nom} supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Ton entreprise<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
      <label class="champ">Début de l'exercice <small>Change le découpage des cumuls et des objectifs (rangés par exercice).</small><select name="debutMois">${R.MOIS.map((nm, i) => `<option value="${i + 1}" ${E.debutMois === i + 1 ? 'selected' : ''}>${nm}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte en tableur (CSV, point-virgule) toutes tes saisies mois par mois, ou la revue du mois depuis l'onglet Revue.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-saisies">Saisies (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton tableau de bord est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application et consulter tes chiffres en déplacement.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Bibliothèque de ${B.indicateurs.length} indicateurs rédigée pour QME à partir de définitions de gestion courantes ; aucun ratio sectoriel de référence. Aucune connexion à une banque, une comptabilité ou un CRM : chaque chiffre se saisit ici. Outil de pilotage, pas un logiciel comptable ; le résultat comptable relève de ton expert-comptable.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      E.entreprise = String(fd.get('entreprise') || '').trim().slice(0, 80);
      const dm = Number(fd.get('debutMois'));
      const change = dm !== E.debutMois;
      E.debutMois = dm >= 1 && dm <= 12 ? dm : 1;
      if (change) exerciceVu = null;
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.indicateurs) || typeof d.saisies !== 'object') throw new Error();
        if (!confirm(`Remplacer ton tableau de bord actuel par cette copie (${pluriel(d.indicateurs.length, 'indicateur')}, ${pluriel(Object.keys(d.saisies || {}).length, 'mois saisi', 'mois saisis')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du tableau de bord.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `pilotage-pme-${aujIso()}.json`);

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

  // ---------- Écouteurs propres à chaque vue ----------
  function brancherVue() {
    $('[data-choix-mois]')?.addEventListener('change', (e) => { mois = e.target.value; rendre(); });
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    const champs = [...document.querySelectorAll('[data-saisie]')];
    champs.forEach((el, i) => {
      el.addEventListener('change', () => enregistrerSaisie(el));
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (enregistrerSaisie(el)) (champs[i + 1] || el).focus();
        if (!champs[i + 1]) { el.blur(); toast(`Saisie de ${libMois(mois)} enregistrée.`); }
      });
    });
    const objs = [...document.querySelectorAll('[data-obj]')];
    objs.forEach((el, i) => {
      el.addEventListener('change', () => { enregistrerObjectif(el); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); enregistrerObjectif(el); (objs[i + 1] || el).focus(); } });
    });
    document.querySelectorAll('[data-rep]').forEach((el) => el.addEventListener('change', () => {
      const id = el.dataset.rep, an = String(exerciceVu);
      const o = E.objectifs[an]?.[id];
      if (el.value === 'manuelle') { rendre(); modaleMoisParMois(id); return; }
      retenir();
      (E.objectifs[an] ||= {})[id] = { annuel: o?.repartition === 'manuelle' ? R.objectifAnnuel(E, id, exerciceVu) : (o?.annuel ?? null), repartition: el.value, mensuels: o?.mensuels || Array(12).fill(null) };
      sauver(); rendre();
      toast(`Répartition : ${R.REPARTITIONS[el.value].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
    }));
    $('#faits')?.addEventListener('change', (e) => { const r = (E.revues[mois] ||= { faits: '', actions: [] }); r.faits = e.target.value.slice(0, 4000); sauver(); const p = $('.fr-faits'); if (p) p.textContent = r.faits || '—'; });
    $('#ajout-action')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const texte = String(fd.get('texte') || '').trim();
      if (!texte) { e.target.querySelector('[name=texte]').focus(); toast('Décris l\'action.'); return; }
      retenir();
      const r = (E.revues[mois] ||= { faits: '', actions: [] });
      r.actions.push({ id: R.nouvelId(), texte: texte.slice(0, 300), responsable: String(fd.get('responsable') || '').trim().slice(0, 60), echeance: String(fd.get('echeance') || ''), statut: 'ouverte', indicateur: String(fd.get('indicateur') || '') });
      sauver(); rendre();
      $('#ajout-action [name=texte]')?.focus();
      toast('Action ajoutée à la revue.', { libelle: 'Annuler', faire: annuler });
    });
    document.querySelectorAll('[data-action-faite]').forEach((el) => el.addEventListener('change', () => {
      const a = E.revues[el.dataset.mois]?.actions.find((x) => x.id === el.dataset.actionFaite);
      if (!a) return;
      retenir();
      a.statut = el.checked ? 'faite' : 'ouverte';
      sauver(); rendre();
    }));
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); mois = R.moisParDefaut(E, moisCourant()); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.entreprise = $('#entreprise')?.value ?? accueil.entreprise; accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); if (el.dataset.vue === 'indicateurs') detail = null; changerVue(el.dataset.vue); break;
      case 'mois': { const n = ajoutMois(mois, Number(el.dataset.d)); if (n <= moisCourant()) { mois = n; rendre(); } break; }
      case 'exercice': exerciceVu += Number(el.dataset.d); rendre(); break;
      case 'filtre-dom': filtre.domaine = el.dataset.dom; rendre(); break;
      case 'sous-vue': sousVue = el.dataset.sv; detail = null; if (vue !== 'indicateurs') changerVue('indicateurs'); else rendre(); break;
      case 'bibliotheque': sousVue = 'bibliotheque'; detail = null; changerVue('indicateurs'); break;
      case 'fiche': if (modale().open) modale().close(); detail = id; changerVue('indicateurs'); break;
      case 'fermer-fiche': detail = null; rendre(); window.scrollTo({ top: 0 }); break;
      case 'ajouter-modele': { retenir(); const aj = R.ajouterModele(E, B, id); sauver(); rendre(); toast(aj.length > 1 ? `Ajoutés : ${aj.map(nomIndic).join(', ')}.` : `Ajouté : ${nomIndic(id)}.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'nouvel-indic': modaleIndicateur(null); break;
      case 'modifier-indic': modaleIndicateur(id); break;
      case 'seuils': modaleIndicateur(id, { seulementSeuils: true }); break;
      case 'retirer-indic': retirerIndicateur(id); break;
      case 'mois-par-mois': modaleMoisParMois(id); break;
      case 'copier-objectifs': copierObjectifs(); break;
      case 'suppr-action': { const r = E.revues[mois]; if (!r) break; retenir(); r.actions = r.actions.filter((a) => a.id !== id); sauver(); rendre(); toast('Action supprimée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'imprimer': window.print(); break;
      case 'csv-revue': telecharger(R.versCsvRevue(E, mois, B.domaines), 'text/csv;charset=utf-8', `revue-${mois}.csv`); break;
      case 'csv-saisies': telecharger(R.versCsvSaisies(E), 'text/csv;charset=utf-8', `saisies-pilotage-${aujIso()}.csv`); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
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
  // La courbe se redessine au passage téléphone / ordinateur (viewBox adapté à la largeur).
  MQ_TEL.addEventListener?.('change', () => { if (E && vue === 'indicateurs' && detail && !modale().open) rendre(); });

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
  window.__pilotage = { etat: () => E, regles: R };
  init();
})();
