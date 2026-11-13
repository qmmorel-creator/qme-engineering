// Trésorerie prévisionnelle QME : plan de trésorerie sur 12 mois glissants, données synchronisées par code d'accès.
// Les règles de calcul sont dans regles.js (window.TRS), testées par outils/templates/tresorerie.test.mjs.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.TRS;
  const API = '/api/templates';
  const PRODUIT = 'TRS';
  const CLE_CODE = 'qme-trs-code';
  const CLE_CACHE = 'qme-trs-cache';
  const CLE_DEMO = 'qme-trs-demo';
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
  const auj = () => iso(new Date());
  const moisCourant = () => auj().slice(0, 7);
  const lm = (m, o) => R.libelleMois(m, o);
  const eur = (c, o) => R.euros(c, o);
  const eurR = (c, o) => R.eurosRonds(c, o);
  // Montant pour un champ de saisie : 1234,5 → « 1234,50 ».
  const pourChamp = (c) => (Number.isInteger(c) ? R.eurosCsv(c) : '');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'synthese';
  let moisPointage = null;
  let montrerPasses = false;
  let annulation = null;

  const etatVide = () => ({
    version: 1, nom: '', debut: moisCourant(), soldeDepart: 0, seuil: 0, ecarts: { ...B.ecartsParDefaut }, scenario: 'central',
    categoriesPerso: [], lignes: [], ajustements: {}, realise: {},
  });
  const objet = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d, ecarts: { ...v.ecarts, ...objet(d.ecarts) } };
    if (!R.moisValide(n.debut)) n.debut = v.debut;
    if (!Number.isInteger(n.soldeDepart)) n.soldeDepart = 0;
    if (!Number.isInteger(n.seuil)) n.seuil = 0;
    if (!R.SCENARIOS.includes(n.scenario)) n.scenario = 'central';
    n.categoriesPerso = Array.isArray(d.categoriesPerso) ? d.categoriesPerso : [];
    n.lignes = Array.isArray(d.lignes) ? d.lignes.filter((l) => l && l.id && R.moisValide(l.mois)) : [];
    n.ajustements = objet(d.ajustements);
    n.realise = objet(d.realise);
    return n;
  };
  const categories = () => [...B.categories, ...(E?.categoriesPerso || [])];
  const categorie = (id) => categories().find((c) => c.id === id) || { id, nom: 'Sans catégorie', type: 'dec', famille: 'exploitation' };
  const ligne = (id) => E.lignes.find((l) => l.id === id);
  const famille = (id) => B.familles.find((f) => f.id === id) || { id, nom: 'Personnelle' };
  const recurrence = (id) => B.recurrences.find((r) => r.id === id) || B.recurrences[0];
  const scenarioNom = (id) => B.scenarios.find((s) => s.id === id)?.nom || id;
  const calc = (scenario = E.scenario) => R.calculer(E, { scenario, moisCourant: moisCourant() });
  const calcTous = () => R.calculerTous(E, { moisCourant: moisCourant() });

  // Instantané pour « Annuler ».
  function memoriser() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    const majLe = E.majLe;
    E = annulation; if (majLe) E.majLe = majLe;
    annulation = null;
    sauver(); rendre();
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
  // Code TRS-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (/^[A-Z]{3}/.test(n) && !/^[0-9A-F]{3}/.test(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (/^[A-Z]{3}/.test(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memo) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    // Clé d'un autre template : ne jamais écrire nos données dans son espace.
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memo;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memo);
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

  function ouvrirDemo(memo = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memo) stock.ecrire(CLE_CODE, CODE_DEMO);
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

  // Données de démonstration : un atelier de menuiserie fictif, 3 mois passés pointés et 12 mois à venir.
  function donneesDemo() {
    const M = moisCourant();
    const m = (n) => R.ajoutMois(M, n);
    const d = etatVide();
    d.nom = 'Atelier Exemple';
    d.debut = m(-3);
    d.soldeDepart = 1450000;
    d.seuil = 600000;
    d.ecarts = { prudent: -10, optimiste: 10 };
    const L = (type, categorie, libelle, montant, rec, debut, fin = null) => {
      const l = { id: uid(), type, categorie, libelle, montant, recurrence: rec, mois: m(debut), fin: fin === null ? null : m(fin) };
      d.lignes.push(l); return l;
    };
    const fact = L('enc', 'prestations', 'Factures de chantiers', 1650000, 'mensuel', -3);
    const acpt = L('enc', 'acomptes', 'Acomptes à la commande', 300000, 'trimestriel', -2);
    L('enc', 'prestations', 'Solde du chantier de l\'école', 1400000, 'ponctuel', 2);
    L('enc', 'cession', 'Vente de l\'ancienne scie', 150000, 'ponctuel', 1);
    const aide = L('enc', 'aides', 'Aide à l\'embauche d\'un apprenti', 100000, 'mensuel', -1, 6);
    const mat = L('dec', 'achats', 'Bois et quincaillerie', 380000, 'mensuel', -3);
    const loyer = L('dec', 'loyer', 'Loyer de l\'atelier', 165000, 'mensuel', -3);
    const sal = L('dec', 'salaires', 'Salaires nets', 420000, 'mensuel', -3);
    const soc = L('dec', 'charges-sociales', 'Charges sociales (selon avis)', 190000, 'mensuel', -3);
    const tva = L('dec', 'tva', 'TVA à reverser (selon déclarations)', 260000, 'trimestriel', -1);
    L('dec', 'assurances', 'Assurance décennale', 310000, 'annuel', 3);
    const veh = L('dec', 'emprunt', 'Crédit du fourgon', 62000, 'mensuel', -3, 8);
    const remu = L('dec', 'remuneration', 'Ma rémunération', 250000, 'mensuel', -3);
    const compta = L('dec', 'honoraires', 'Expert-comptable', 48000, 'mensuel', -3);
    const log = L('dec', 'logiciels', 'Logiciels de devis et de dessin', 9000, 'mensuel', -3);
    const carb = L('dec', 'deplacements', 'Carburant', 45000, 'mensuel', -3);
    L('dec', 'materiel', 'Nouvelle machine à commande numérique', 3200000, 'ponctuel', 4);
    L('dec', 'impots', 'Impôts et taxes (selon avis)', 120000, 'annuel', 10);
    const rep = L('dec', 'entretien', 'Réparation du fourgon (imprévu)', 0, 'ponctuel', -2);
    // Réalisé des mois passés : écarts au prévu, une échéance sautée, deux à pointer le mois dernier.
    const r = (l, n, v) => { (d.realise[l.id] ||= {})[m(n)] = v; };
    for (const n of [-3, -2]) { [mat, loyer, sal, soc, veh, remu, compta, log, carb].forEach((l) => r(l, n, l.montant)); }
    r(fact, -3, 1580000); r(fact, -2, 1810000); r(mat, -2, 452000); r(carb, -3, 51200); r(acpt, -2, 300000); r(rep, -2, 85000);
    [fact, mat, loyer, sal, soc, veh, remu, log, aide].forEach((l) => r(l, -1, l.montant));
    r(fact, -1, 1395000); r(tva, -1, 248000); r(carb, -1, 0);
    // Mois en cours : loyer et crédit déjà passés.
    r(loyer, 0, 165000); r(veh, 0, 62000);
    // Un client en retard : le prévu du mois prochain est ajusté.
    d.ajustements[fact.id] = { [m(1)]: 1100000 };
    void compta;
    return d;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Trésorerie prévisionnelle · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="0" y="170" width="70" height="110" fill="#1D4E89"/>
          <rect x="90" y="110" width="70" height="170" fill="#F0EDE6"/>
          <rect x="180" y="200" width="70" height="80" fill="#D9302A"/>
          <rect x="270" y="60" width="70" height="220" fill="#F5B400"/>
          <circle cx="455" cy="140" r="95" fill="#1D4E89"/>
          <path d="M455 45 A95 95 0 0 1 550 140 H455 Z" fill="#F5B400"/>
          <rect x="0" y="238" width="560" height="6" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Trésorerie prévisionnelle · 12 mois</p>
          <h1>Voir le creux avant qu'il arrive.</h1>
          <p>Tes encaissements et décaissements prévus, le réalisé en regard, trois scénarios et une alerte dès que le solde passe sous ton seuil.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton plan de trésorerie</h2>
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
        <p class="mention">Outil d'aide à la prévision, pas un logiciel comptable ni certifié. Pas encore de plan ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <a href="mailto:quentin.morel@qm-engineering.fr">quentin.morel@qm-engineering.fr</a>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon plan'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, nom: '', solde: '', seuil: '', profil: null, montants: {} };

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const p = B.profils.find((x) => x.id === a.profil);
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton plan de trésorerie.</h1>
        <p class="intro">Trois chiffres pour commencer, puis tes encaissements et décaissements habituels. Tout reste modifiable ensuite.</p>
        <form id="form-accueil" class="grille-accueil" novalidate>
          <label class="champ">Nom de l'activité <small>Facultatif.</small><input id="a-nom" value="${esc(a.nom)}" maxlength="60" autocomplete="organization"></label>
          <label class="champ">Solde du compte au 1er ${esc(lm(moisCourant()))} <small>Ton solde bancaire en début de mois (signe moins si découvert).</small><input id="a-solde" value="${esc(a.solde)}" inputmode="decimal" placeholder="Ex. : 12 500" required></label>
          <label class="champ">Seuil d'alerte <small>Le solde en dessous duquel tu veux être prévenu.</small><input id="a-seuil" value="${esc(a.seuil)}" inputmode="decimal" placeholder="Ex. : 3 000"></label>
          <p class="erreur" role="alert">${esc(erreur)}</p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Continuer</button></div>
        </form>`;
    } else {
      corps = `
        <p class="surtitre">Encaissements et décaissements habituels</p>
        <h1>Quelle est ton activité ?</h1>
        <p class="intro">Le profil propose des lignes types, sans montant. Saisis le montant mensuel, trimestriel ou annuel de celles qui te concernent : les lignes vides sont ignorées. Tu ajouteras les ponctuelles ensuite.</p>
        <div class="filieres" role="group" aria-label="Profil">
          ${B.profils.map((x, i) => `<button type="button" class="filiere" style="--c:${['var(--bleu)', 'var(--rouge)', 'var(--jaune)', 'var(--encre)'][i % 4]}" data-action="profil" data-id="${x.id}" aria-pressed="${a.profil === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></button>`).join('')}
        </div>
        ${p ? `<div class="lignes-profil">${p.lignes.map(([cat, lib, rec], i) => {
          const c = categorie(cat);
          return `<label class="ligne-profil ${c.type}"><span><b>${esc(lib)}</b><small>${c.type === 'enc' ? 'Encaissement' : 'Décaissement'} · ${esc(recurrence(rec).nom.toLowerCase())}${c.famille === 'fiscal' ? ' · selon tes avis' : ''}</small></span><input data-montant="${i}" value="${esc(a.montants[i] || '')}" inputmode="decimal" placeholder="Montant" aria-label="Montant : ${esc(lib)}"></label>`;
        }).join('')}</div>` : ''}
        <p class="erreur" role="alert">${esc(erreur)}</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <span class="rang"><button class="btn" data-action="accueil-vide">Partir d'un plan vide</button><button class="btn primaire" data-action="accueil-fin" ${p ? '' : 'disabled'}>Créer mon plan</button></span>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#form-accueil')?.addEventListener('submit', (e) => {
      e.preventDefault();
      a.nom = $('#a-nom').value; a.solde = $('#a-solde').value; a.seuil = $('#a-seuil').value;
      if (R.versCentimes(a.solde, { negatif: true }) === null) return ecranAccueil('Indique le solde du compte (ex. : 12 500 ou -800).');
      if (a.seuil.trim() && R.versCentimes(a.seuil, { negatif: true }) === null) return ecranAccueil('Seuil illisible (ex. : 3 000).');
      a.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
    });
    document.querySelectorAll('[data-montant]').forEach((el) => el.addEventListener('input', () => { a.montants[el.dataset.montant] = el.value; }));
  }

  function terminerAccueil(vide) {
    const a = accueil;
    const p = B.profils.find((x) => x.id === a.profil);
    const lignes = [];
    if (!vide && p) {
      for (const [i, [cat, lib, rec]] of p.lignes.entries()) {
        const s = String(a.montants[i] || '').trim();
        if (!s) continue;
        const c = R.versCentimes(s);
        if (c === null) return ecranAccueil(`Montant illisible pour « ${lib} ».`);
        lignes.push({ id: uid(), type: categorie(cat).type, categorie: cat, libelle: lib, montant: c, recurrence: rec, mois: moisCourant(), fin: null });
      }
    }
    E = etatVide();
    E.nom = a.nom.trim();
    E.soldeDepart = R.versCentimes(a.solde, { negatif: true }) ?? 0;
    E.seuil = R.versCentimes(a.seuil, { negatif: true }) ?? 0;
    E.lignes = lignes;
    accueil = { etape: 1, nom: '', solde: '', seuil: '', profil: null, montants: {} };
    vue = lignes.length ? 'synthese' : 'previsions';
    sauver();
    demarrer();
    if (!lignes.length) setTimeout(() => modaleLigne(), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    synthese: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    pointage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13l6 6L21 5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square"/></svg>',
    previsions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    hypotheses: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['synthese', 'Synthèse'], ['tableau', 'Tableau'], ['pointage', 'Pointage'], ['previsions', 'Prévisions'], ['hypotheses', 'Hypothèses']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Trésorerie<br>prévisionnelle</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Trésorerie prévisionnelle`;
    $('#vue').innerHTML = { synthese: vueSynthese, tableau: vueTableau, pointage: vuePointage, previsions: vuePrevisions, hypotheses: vueHypotheses }[vue]();
    if (vue === 'synthese') brancherGraphique();
    if (vue === 'pointage') brancherPointage();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const scenarios = () => `<div class="scenarios" role="group" aria-label="Scénario">${B.scenarios.map((s) => {
    const pct = R.ecartScenario(E, s.id);
    return `<button type="button" data-action="scenario" data-id="${s.id}" aria-pressed="${E.scenario === s.id}"><b>${s.nom}</b><small>${s.id === 'central' ? 'tel que prévu' : `encaissements ${pct > 0 ? '+' : ''}${pct} %`}</small></button>`;
  }).join('')}</div>`;

  // ---------- Synthèse ----------
  function vueSynthese() {
    const tous = calcTous();
    const c = tous[E.scenario];
    const M = moisCourant();
    const courant = c.mois.find((x) => x.mois === M) || c.vus[0];
    const vide = !E.lignes.length;
    const nom = E.nom ? `${esc(E.nom)} · ` : '';
    const titre = vide ? 'Ajoute tes premières prévisions.'
      : c.premierDecouvert ? `<mark class="rouge">Découvert</mark> prévu en ${lm(c.premierDecouvert, { annee: false })}.`
        : c.premierSousSeuil ? `<mark>Sous ton seuil</mark> en ${lm(c.premierSousSeuil, { annee: false })}.`
          : 'Ton compte reste <mark class="bleu">au-dessus du seuil</mark> sur 12 mois.';
    const sous = vide ? 'Saisis tes encaissements et décaissements récurrents ou ponctuels : le solde de chaque mois se calcule tout seul.'
      : `Scénario ${scenarioNom(E.scenario).toLowerCase()} · seuil d'alerte ${eurR(E.seuil)} · ${c.moisSousSeuil ? `${pluriel(c.moisSousSeuil, 'mois', 'mois')} sous le seuil` : 'aucun mois sous le seuil'}.`;
    const tuiles = [
      [`Fin ${lm(courant.mois, { annee: false })}`, eurR(courant.solde), `Solde prévu en fin de mois en cours (début : ${eurR(courant.soldeDebut)}).`, courant.decouvert ? 'var(--rouge)' : courant.sousSeuil ? 'var(--jaune)' : 'var(--bleu)', 'rond'],
      ['Point bas', c.pointBas ? eurR(c.pointBas.solde) : '–', c.pointBas ? `Fin ${lm(c.pointBas.mois)}, le solde le plus bas des 12 mois.` : '', c.pointBas && c.pointBas.solde < 0 ? 'var(--rouge)' : c.pointBas && c.pointBas.solde < c.seuil ? 'var(--jaune)' : 'var(--encre)', ''],
      ['Encaissements', eurR(c.totalEnc), `Sur 12 mois, de ${lm(c.fenetre, { court: true })} à ${lm(c.fin, { court: true })}.`, 'var(--bleu)', ''],
      ['Décaissements', eurR(c.totalDec), `Flux net : ${eurR(c.totalEnc - c.totalDec, { signe: true })}.`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');

    const alertes = [];
    if (c.aPointer) {
      const m = c.mois.filter((x) => x.aPointer).map((x) => x.mois);
      alertes.push(['jaune', 'À pointer', `${pluriel(c.aPointer, 'échéance passée', 'échéances passées')} sans réalisé (${m.map((x) => lm(x, { annee: false })).join(', ')}) : le prévu est retenu à la place.`, `<button class="btn petit" data-action="pointer" data-mois="${m[0]}">Pointer</button>`]);
    }
    for (const x of c.vus.filter((v) => v.sousSeuil)) {
      alertes.push([x.decouvert ? 'rouge' : 'jaune', x.decouvert ? 'Découvert' : 'Sous le seuil', `Fin ${lm(x.mois)} : ${eurR(x.solde)}${x.decouvert ? '' : ` (seuil ${eurR(c.seuil)})`}. Plus gros décaissement du mois : ${plusGros(x.mois)}.`, `<button class="btn petit" data-action="pointer" data-mois="${x.mois}">Détail</button>`]);
    }
    const autres = R.SCENARIOS.filter((s) => s !== E.scenario).map((s) => {
      const t = tous[s];
      return `<li><b>${scenarioNom(s)}</b> : point bas ${t.pointBas ? `${eurR(t.pointBas.solde)} en ${lm(t.pointBas.mois, { annee: false })}` : '–'}${t.premierDecouvert ? ` · découvert en ${lm(t.premierDecouvert, { annee: false })}` : t.premierSousSeuil ? ` · sous le seuil en ${lm(t.premierSousSeuil, { annee: false })}` : ' · jamais sous le seuil'}</li>`;
    }).join('');

    return `
      <section class="entete">
        <div class="entete-titre">
          <p class="surtitre">${nom}${lm(M)}</p>
          <h1>${titre}</h1>
          <p class="sous">${sous}</p>
          <div class="actions"><button class="btn primaire" data-action="ligne-nouvelle">${ICONES.plus}Prévision</button><button class="btn" data-action="pointer" data-mois="${M}">Pointer ce mois</button></div>
        </div>
        ${scenarios()}
      </section>
      ${vide ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune prévision pour l'instant</h3><p>Commence par ce qui revient tous les mois (chiffre d'affaires, loyer, salaires), puis les gros ponctuels (achat de matériel, échéance annuelle).</p><div class="actions"><button class="btn primaire" data-action="ligne-nouvelle">${ICONES.plus}Ajouter une prévision</button></div></div></div>` : `
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Solde de fin de mois <span>12 mois glissants · la fourchette va du scénario prudent à l'optimiste</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>${scenarioNom(E.scenario)}</h2><div class="legende"><span><i class="trait" style="background:var(--bleu)"></i>Solde de fin de mois</span><span><i style="background:rgba(29,78,137,.16)"></i>Prudent ↔ optimiste</span><span><i class="trait" style="background:var(--rouge)"></i>Seuil d'alerte</span></div></div>
        ${graphique(tous)}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Solde de fin de mois par scénario</caption><thead><tr><th>Mois</th><th>Prudent</th><th>Central</th><th>Optimiste</th></tr></thead><tbody>${c.vus.map((x, i) => `<tr><td>${lm(x.mois)}</td><td>${eur(tous.prudent.vus[i].solde)}</td><td>${eur(tous.central.vus[i].solde)}</td><td>${eur(tous.optimiste.vus[i].solde)}</td></tr>`).join('')}</tbody></table></div>
        <figcaption class="note">Soldes de fin de mois : en cours de mois, le solde peut descendre plus bas selon les dates de paiement.</figcaption>
      </figure>
      <div class="deux-colonnes">
        <section><h2 class="titre-section">Alertes</h2>
          ${alertes.length ? `<ul class="alertes">${alertes.map(([cl, t, txt, b]) => `<li class="alerte ${cl}"><span class="etiquette ${cl}">${t}</span><p>${txt}</p>${b}</li>`).join('')}</ul>` : '<p class="calme">Aucune alerte : solde au-dessus du seuil sur les 12 mois et tout est pointé.</p>'}
        </section>
        <section><h2 class="titre-section">Les autres scénarios</h2><ul class="autres">${autres}</ul>
          <p class="aide">Les scénarios ne font varier que les encaissements pas encore réalisés. Règle leurs écarts dans <button class="lien-texte" data-action="vue" data-vue="hypotheses">Hypothèses</button>.</p>
        </section>
      </div>`}
      <p class="avertissement">${esc(B.avertissement)}</p>`;
  }

  function plusGros(mois) {
    const e = R.echeancesDuMois(E, mois, E.scenario).filter((x) => x.ligne.type === 'dec').sort((a, b) => b.retenu - a.retenu)[0];
    return e ? `${esc(e.ligne.libelle)} (${eurR(e.retenu)})` : 'aucun';
  }

  // Graduation « ronde » de l'axe des soldes.
  function pasRond(etendue) {
    const brut = etendue / 4;
    const p = 10 ** Math.floor(Math.log10(Math.max(brut, 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= brut) || p * 10;
  }
  const kEur = (c) => {
    const e = c / 100;
    if (Math.abs(e) >= 10000) return `${e < 0 ? '−' : ''}${String(Math.abs(e) / 1000).replace('.', ',')} k€`;
    return eurR(c);
  };

  let geometrie = null;
  function graphique(tous) {
    const c = tous[E.scenario];
    const n = c.vus.length;
    const L = Math.round(Math.min(1140, Math.max(300, window.innerWidth - (window.innerWidth < 720 ? 58 : 100))));
    const petit = L < 520;
    const H = petit ? 230 : 300, g = petit ? 50 : 62, d = 14, h = 14, b = 28;
    const tousSoldes = R.SCENARIOS.flatMap((s) => tous[s].vus.map((x) => x.solde));
    let min = Math.min(...tousSoldes, c.seuil), max = Math.max(...tousSoldes, c.seuil);
    if (min > 0 && min < max * 0.35) min = 0;
    if (max === min) { max += 100000; min -= 100000; }
    const pas = pasRond(max - min);
    const bas = Math.floor(min / pas) * pas, haut = Math.ceil(max / pas) * pas;
    const hz = H - h - b;
    const y = (v) => h + hz - ((v - bas) / (haut - bas)) * hz;
    const larg = (L - g - d) / n;
    const x = (i) => g + larg * (i + 0.5);
    geometrie = { n, larg, g };
    const grilles = [];
    for (let v = bas; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${kEur(v)}</text>`);
    const P = tous.prudent.vus, O = tous.optimiste.vus;
    const bande = `<path class="bande" d="M${O.map((v, i) => `${x(i)},${y(Math.max(v.solde, P[i].solde))}`).join('L')}L${P.map((v, i) => `${x(i)},${y(Math.min(v.solde, O[i].solde))}`).reverse().join('L')}Z"/>`;
    const trait = `<path class="trait-solde" d="M${c.vus.map((v, i) => `${x(i)},${y(v.solde)}`).join('L')}"/>`;
    const ys = y(c.seuil);
    const seuil = `<line class="seuil" x1="${g}" x2="${L - d}" y1="${ys}" y2="${ys}"/><text class="etiquette-seuil" x="${g + 6}" y="${ys - 6}" text-anchor="start">Seuil ${eurR(c.seuil)}</text>`;
    const pas2 = petit ? 2 : 1;
    const points = c.vus.map((v, i) => `<rect class="zone" data-i="${i}" x="${g + larg * i}" y="0" width="${larg}" height="${H - b}"/><circle class="point ${v.decouvert ? 'neg' : v.sousSeuil ? 'bas' : ''}" data-i="${i}" cx="${x(i)}" cy="${y(v.solde)}" r="${v.sousSeuil ? 5.5 : 4.5}"/>${(n - 1 - i) % pas2 === 0 ? `<text class="axe" x="${x(i)}" y="${H - 8}" text-anchor="middle">${lm(v.mois, { court: true, annee: v.mois.endsWith('-01') || i === 0 })}</text>` : ''}`).join('');
    const fin = c.vus[n - 1];
    const etiquetteFin = `<text class="valeur" x="${x(n - 1)}" y="${y(fin.solde) - 12}" text-anchor="end">${eurR(fin.solde)}</text>`;
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Solde de fin de mois sur 12 mois, scénario ${scenarioNom(E.scenario).toLowerCase()}, avec le seuil d'alerte ; détail dans le tableau">${grilles.join('')}${bande}${seuil}${trait}${points}${etiquetteFin}<line class="repere" x1="0" x2="0" y1="${h}" y2="${H - b}" visibility="hidden"/></svg>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const tous = calcTous();
    const montrer = (zone) => {
      const i = Number(zone.dataset.i);
      const v = tous[E.scenario].vus[i];
      fig.querySelectorAll('.point').forEach((p) => p.classList.toggle('actif', p.dataset.i === String(i)));
      bulle.innerHTML = `<b>Fin ${lm(v.mois)}</b><div>Encaissements : ${eurR(v.enc)}</div><div>Décaissements : ${eurR(v.dec)}</div><div class="sep">Solde ${scenarioNom(E.scenario).toLowerCase()} : <b>${eurR(v.solde)}</b></div>${R.SCENARIOS.filter((s) => s !== E.scenario).map((s) => `<div>${scenarioNom(s)} : ${eurR(tous[s].vus[i].solde)}</div>`).join('')}${v.decouvert ? '<div class="alerte-bulle">Découvert</div>' : v.sousSeuil ? '<div class="alerte-bulle">Sous le seuil</div>' : ''}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left + rz.width / 2 - bulle.offsetWidth - 12;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '56px';
    };
    fig.querySelectorAll('.zone').forEach((z) => {
      z.addEventListener('pointerenter', () => montrer(z));
      z.addEventListener('click', () => montrer(z));
    });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.point').forEach((p) => p.classList.remove('actif')); });
  }

  // ---------- Tableau ----------
  function vueTableau() {
    const c = calc();
    const passes = c.mois.filter((x) => x.passe && !x.dansFenetre);
    const mois = montrerPasses ? c.mois : c.vus;
    const ids = (type) => {
      const pris = new Set(E.lignes.filter((l) => l.type === type).map((l) => l.categorie));
      return categories().filter((k) => pris.has(k.id)).map((k) => k.id);
    };
    const td = (v, cl = '') => `<td class="nb ${cl}">${v ? eurR(v) : '<span class="zero">–</span>'}</td>`;
    const tete = `<tr><th scope="col" class="fixe">Poste</th>${mois.map((x) => `<th scope="col" class="nb ${x.courant ? 'courant' : ''}">${lm(x.mois, { court: true })}${x.passe ? '<small>réalisé</small>' : x.courant ? '<small>en cours</small>' : ''}</th>`).join('')}</tr>`;
    const ligneCat = (id) => `<tr><th scope="row" class="fixe">${esc(categorie(id).nom)}</th>${mois.map((x) => td(x.parCategorie[id] || 0)).join('')}</tr>`;
    const corps = `
      <tr class="solde"><th scope="row" class="fixe">Solde de début</th>${mois.map((x) => `<td class="nb">${eurR(x.soldeDebut)}</td>`).join('')}</tr>
      <tr class="intertitre enc"><th scope="row" class="fixe" colspan="1">Encaissements</th>${mois.map(() => '<td></td>').join('')}</tr>
      ${ids('enc').map(ligneCat).join('')}
      <tr class="total"><th scope="row" class="fixe">Total encaissements</th>${mois.map((x) => td(x.enc)).join('')}</tr>
      <tr class="intertitre dec"><th scope="row" class="fixe">Décaissements</th>${mois.map(() => '<td></td>').join('')}</tr>
      ${ids('dec').map(ligneCat).join('')}
      <tr class="total"><th scope="row" class="fixe">Total décaissements</th>${mois.map((x) => td(x.dec)).join('')}</tr>
      <tr class="net"><th scope="row" class="fixe">Flux net</th>${mois.map((x) => `<td class="nb ${x.net < 0 ? 'negatif' : ''}">${eurR(x.net, { signe: true })}</td>`).join('')}</tr>
      <tr class="solde fin"><th scope="row" class="fixe">Solde de fin</th>${mois.map((x) => `<td class="nb ${x.decouvert ? 'decouvert' : x.sousSeuil ? 'sous-seuil' : ''}">${eurR(x.solde)}</td>`).join('')}</tr>`;
    return `
      <div class="vue-tete"><div><h1>Tableau</h1><p>Le plan de trésorerie mois par mois, scénario ${scenarioNom(E.scenario).toLowerCase()}. Mois passés : réalisé quand il est pointé, sinon prévu.</p></div>
        <div class="actions"><button class="btn primaire" data-action="csv">Exporter en CSV</button></div></div>
      <div class="barre-outils">${scenarios()}
        ${passes.length ? `<label class="case"><input type="checkbox" data-action="passes" ${montrerPasses ? 'checked' : ''}> Afficher les ${pluriel(passes.length, 'mois passé', 'mois passés')}</label>` : ''}
        <div class="legende"><span><i style="background:var(--jaune)"></i>Sous le seuil (${eurR(E.seuil)})</span><span><i style="background:var(--rouge)"></i>Découvert</span></div></div>
      ${E.lignes.length ? `<div class="defile cadre-tableau"><table class="tableau plan">${`<thead>${tete}</thead><tbody>${corps}</tbody>`}</table></div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Tableau vide</h3><p>Ajoute des prévisions pour remplir le plan.</p><div class="actions"><button class="btn primaire" data-action="ligne-nouvelle">${ICONES.plus}Prévision</button></div></div></div>`}
      <p class="avertissement">Montants arrondis à l'euro (calculs au centime). Le CSV s'ouvre dans un tableur (séparateur point-virgule). ${esc(B.avertissement)}</p>`;
  }

  function exporterCsv() {
    const c = calc();
    const texte = R.csv(E, montrerPasses ? { ...c, vus: c.mois } : c, categories());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' }));
    a.download = `tresorerie-${E.scenario}-${auj()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Plan exporté en CSV.');
  }

  // ---------- Pointage ----------
  function vuePointage() {
    const c = calc();
    const M = moisCourant();
    const liste = c.mois.map((x) => x.mois);
    if (!moisPointage || !liste.includes(moisPointage)) moisPointage = liste.includes(M) ? M : liste[0];
    const x = c.mois.find((v) => v.mois === moisPointage);
    const ech = R.echeancesDuMois(E, moisPointage, E.scenario).sort((a, b) => (a.ligne.type === b.ligne.type ? b.prevu - a.prevu : a.ligne.type === 'enc' ? -1 : 1));
    const i = liste.indexOf(moisPointage);
    const puces = c.mois.map((v) => `<button class="puce-mois ${v.courant ? 'courant' : ''} ${v.decouvert ? 'neg' : v.sousSeuil ? 'bas' : ''}" data-action="pointer" data-mois="${v.mois}" aria-pressed="${v.mois === moisPointage}">${lm(v.mois, { court: true })}${v.aPointer ? `<i title="${v.aPointer} à pointer">${v.aPointer}</i>` : ''}</button>`).join('');
    const lignes = ech.map((e) => {
      const l = e.ligne;
      const etat = e.realise !== null ? (e.realise === e.prevu ? 'conforme' : 'ecart') : moisPointage < M ? 'apointer' : 'prevu';
      const lib = { conforme: ['bleu', 'Conforme'], ecart: ['jaune', 'Écart'], apointer: ['rouge', 'À pointer'], prevu: ['', 'Prévu'] }[etat];
      const ecart = e.realise !== null ? e.realise - e.prevu : null;
      return `
        <li class="echeance ${l.type}" data-ligne="${l.id}">
          <div class="echeance-tete">
            <span class="sens" aria-hidden="true">${l.type === 'enc' ? '+' : '−'}</span>
            <div class="echeance-nom"><b>${esc(l.libelle)}</b><span>${esc(categorie(l.categorie).nom)} · ${esc(recurrence(l.recurrence).nom.toLowerCase())}</span></div>
            <span class="etiquette ${lib[0]}">${lib[1]}</span>
          </div>
          <div class="echeance-chiffres">
            <div><span class="petit-titre">Prévu${e.ajuste ? ' (ajusté)' : ''}</span><b>${eur(e.prevu)}</b>${l.type === 'enc' && e.realise === null && R.ecartScenario(E, E.scenario) ? `<small>retenu ${eur(e.retenu)}</small>` : ''}</div>
            <label><span class="petit-titre">Réalisé</span><input data-realise="${l.id}" value="${e.realise !== null ? pourChamp(e.realise) : ''}" inputmode="decimal" placeholder="—" aria-label="Réalisé : ${esc(l.libelle)}"></label>
            <div><span class="petit-titre">Écart</span><b class="${ecart === null || ecart === 0 ? '' : (l.type === 'enc') === (ecart > 0) ? 'favorable' : 'defavorable'}">${ecart === null ? '–' : eur(ecart, { signe: true })}</b></div>
          </div>
          <div class="echeance-actions">
            <button data-action="conforme" data-id="${l.id}">Conforme</button>
            <button data-action="pas-eu-lieu" data-id="${l.id}">Pas eu lieu</button>
            ${e.realise !== null ? `<button data-action="effacer-realise" data-id="${l.id}">Effacer le réalisé</button>` : ''}
            <button data-action="ajuster" data-id="${l.id}">Modifier le prévu de ce mois</button>
            <button data-action="ligne-modifier" data-id="${l.id}">Modifier la ligne</button>
          </div>
        </li>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Pointage</h1><p>Saisis ce qui est réellement passé sur le compte, en regard du prévu. Le réalisé remplace le prévu dans le calcul du solde.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprevu">${ICONES.plus}Opération imprévue</button></div></div>
      <div class="puces-mois" role="group" aria-label="Mois">${puces}</div>
      <section class="mois-detail">
        <div class="mois-tete">
          <button class="btn-icone" data-action="pointer" data-mois="${liste[i - 1] || ''}" ${i > 0 ? '' : 'disabled'} aria-label="Mois précédent">‹</button>
          <h2>${lm(moisPointage)}<span>${x.passe ? 'mois passé' : x.courant ? 'mois en cours' : 'à venir'}</span></h2>
          <button class="btn-icone" data-action="pointer" data-mois="${liste[i + 1] || ''}" ${i < liste.length - 1 ? '' : 'disabled'} aria-label="Mois suivant">›</button>
        </div>
        <div class="mois-chiffres">
          <div><span>Début</span><b>${eurR(x.soldeDebut)}</b></div>
          <div><span>Encaissements</span><b>${eurR(x.enc, { signe: true })}</b></div>
          <div><span>Décaissements</span><b>${eurR(-x.dec)}</b></div>
          <div class="${x.decouvert ? 'neg' : x.sousSeuil ? 'bas' : ''}"><span>Fin</span><b>${eurR(x.solde)}</b></div>
        </div>
        ${x.pointees ? `<p class="aide">${pluriel(x.pointees, 'échéance pointée', 'échéances pointées')} · écart cumulé sur la trésorerie : <b>${eur(x.ecartRealise, { signe: true })}</b>${x.aPointer ? ` · ${x.aPointer} à pointer` : ''}</p>` : x.aPointer ? `<p class="aide">${pluriel(x.aPointer, 'échéance', 'échéances')} à pointer : sans réalisé, le prévu est retenu.</p>` : ''}
        ${ech.length ? `<ul class="echeances">${lignes}</ul>` : '<p class="vide-mois">Aucune échéance ce mois-ci.</p>'}
      </section>`;
  }

  function brancherPointage() {
    document.querySelectorAll('[data-realise]').forEach((el) => {
      el.addEventListener('change', () => {
        const s = el.value.trim();
        const id = el.dataset.realise;
        if (!s) return poserRealise(id, null);
        const c = R.versCentimes(s);
        if (c === null) { el.setCustomValidity('Montant illisible'); el.reportValidity(); toast('Montant illisible (ex. : 1 250,50).'); return; }
        poserRealise(id, c);
      });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    });
  }

  function poserRealise(id, valeur, message) {
    const l = ligne(id);
    if (!l) return;
    memoriser();
    const r = (E.realise[id] ||= {});
    if (valeur === null) delete r[moisPointage]; else r[moisPointage] = valeur;
    if (!Object.keys(r).length) delete E.realise[id];
    sauver(); rendre();
    toast(message || (valeur === null ? `Réalisé effacé : « ${l.libelle} ».` : `« ${l.libelle} » : ${eur(valeur)} réalisé.`), { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Prévisions ----------
  function vuePrevisions() {
    const bloc = (type) => {
      const ls = E.lignes.filter((l) => l.type === type);
      const parCat = categories().filter((c) => ls.some((l) => l.categorie === c.id));
      const total = (rec) => ls.filter((l) => l.recurrence === rec && (!l.fin || l.fin >= moisCourant())).reduce((s, l) => s + l.montant, 0);
      return `
        <section class="bloc-prev ${type}">
          <div class="bloc-tete"><h2>${type === 'enc' ? 'Encaissements' : 'Décaissements'}</h2><span>${pluriel(ls.length, 'ligne')}${total('mensuel') ? ` · ${eurR(total('mensuel'))} par mois` : ''}</span><button class="btn petit" data-action="ligne-nouvelle" data-type="${type}">${ICONES.plus}Ajouter</button></div>
          ${parCat.length ? parCat.map((c) => `
            <div class="groupe-cat"><h3>${esc(c.nom)}${c.famille === 'fiscal' ? '<span class="etiquette jaune">selon tes avis</span>' : ''}</h3>
              ${ls.filter((l) => l.categorie === c.id).sort((a, b) => a.mois.localeCompare(b.mois)).map((l) => `
                <button class="ligne-prev" data-action="ligne-modifier" data-id="${l.id}">
                  <span><b>${esc(l.libelle)}</b><small>${esc(recurrence(l.recurrence).nom)} · ${l.recurrence === 'ponctuel' ? lm(l.mois) : `dès ${lm(l.mois)}${l.fin ? ` jusqu'à ${lm(l.fin)}` : ''}`}${l.fin && l.fin < moisCourant() ? ' · terminée' : ''}</small></span>
                  <b class="montant">${eur(l.montant)}</b>
                </button>`).join('')}
            </div>`).join('') : '<p class="vide-mois">Aucune ligne.</p>'}
        </section>`;
    };
    return `
      <div class="vue-tete"><div><h1>Prévisions</h1><p>Chaque ligne est un encaissement ou un décaissement prévu, ponctuel ou récurrent (mensuel, trimestriel, annuel). Montants TTC, au mois où l'argent bouge réellement.</p></div>
        <div class="actions"><button class="btn primaire" data-action="ligne-nouvelle">${ICONES.plus}Prévision</button></div></div>
      <div class="deux-colonnes">${bloc('enc')}${bloc('dec')}</div>
      <p class="avertissement">Aucune échéance fiscale ou sociale n'est fournie : TVA, charges sociales, cotisations et impôts sont à saisir d'après tes propres avis et déclarations.</p>`;
  }

  // ---------- Hypothèses ----------
  function vueHypotheses() {
    const M = moisCourant();
    const perso = E.categoriesPerso;
    return `
      <div class="vue-tete"><div><h1>Hypothèses</h1><p>Le point de départ du calcul, ton seuil d'alerte et l'écart des scénarios.</p></div></div>
      <div class="hypotheses">
        <article class="hyp" style="--c:var(--bleu);--t:#fff">
          <div class="hyp-tete"><h2>Solde de départ</h2><button data-action="solde">Modifier</button></div>
          <p class="hyp-valeur">${eur(E.soldeDepart)}</p>
          <p>Au début de ${lm(E.debut)}. Le solde de chaque mois en découle, réalisé et prévu compris.</p>
          ${E.debut < M ? `<button class="btn petit" data-action="recaler">Recaler sur mon solde bancaire de ${lm(M, { annee: false })}</button>` : ''}
        </article>
        <article class="hyp" style="--c:var(--jaune);--t:var(--encre)">
          <div class="hyp-tete"><h2>Seuil d'alerte</h2><button data-action="seuil">Modifier</button></div>
          <p class="hyp-valeur">${eur(E.seuil)}</p>
          <p>Tout mois dont le solde de fin passe en dessous est signalé. Mets un montant négatif si tu as une autorisation de découvert.</p>
        </article>
        <article class="hyp" style="--c:var(--encre);--t:var(--papier)">
          <div class="hyp-tete"><h2>Scénarios</h2><button data-action="ecarts">Modifier</button></div>
          <ul class="liste-scen">${B.scenarios.map((s) => `<li><b>${s.nom}</b><span>${s.id === 'central' ? 'encaissements tels que prévus' : `encaissements ${R.ecartScenario(E, s.id) > 0 ? '+' : ''}${R.ecartScenario(E, s.id)} %`}</span></li>`).join('')}</ul>
          <p>Appliqué aux encaissements pas encore réalisés ; les décaissements restent au prévu. Valeurs de départ arbitraires : adapte-les à ton activité.</p>
        </article>
      </div>
      <h2 class="titre-section">Catégories <span>${B.categories.length} catégories types d'une TPE, en 4 familles${perso.length ? `, plus ${pluriel(perso.length, 'personnelle')}` : ''}</span></h2>
      <div class="familles">${[...B.familles, { id: 'perso', nom: 'Personnelles', detail: 'Tes propres catégories.' }].map((f) => {
        const cs = categories().filter((c) => c.famille === f.id);
        if (f.id === 'perso' && !cs.length) return '';
        return `<section class="famille"><h3>${esc(f.nom)}</h3><p>${esc(f.detail)}</p><ul>${cs.map((c) => `<li><span class="sens ${c.type}" aria-label="${c.type === 'enc' ? 'Encaissement' : 'Décaissement'}">${c.type === 'enc' ? '+' : '−'}</span>${esc(c.nom)}${f.id === 'perso' ? ` <button class="lien-texte" data-action="cat-suppr" data-id="${c.id}">retirer</button>` : ''}</li>`).join('')}</ul></section>`;
      }).join('')}</div>
      <div class="actions" style="margin-top:14px"><button class="btn" data-action="cat-nouvelle">${ICONES.plus}Catégorie personnelle</button></div>
      <h2 class="titre-section">À savoir</h2>
      <div class="a-savoir">
        <p><b>Outil d'aide, pas un logiciel comptable.</b> ${esc(B.avertissement)}</p>
        <p><b>Flux de trésorerie.</b> Saisis les montants TTC au mois où ils passent réellement sur le compte (date de paiement, pas date de facture).</p>
        <p><b>Données.</b> Ton plan est enregistré en ligne avec ta clé : partager la clé donne accès au plan. Aucune connexion à ta banque.</p>
        <p><b>Base intégrée.</b> Catégories, profils et écarts de scénario rédigés pour ce template (novembre 2026) : aucune donnée réglementaire, rien qui se périme.</p>
      </div>`;
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

  const optionsCategories = (type, choix) => [...B.familles, { id: 'perso', nom: 'Personnelles' }].map((f) => {
    const cs = categories().filter((c) => c.famille === f.id && c.type === type);
    return cs.length ? `<optgroup label="${esc(f.nom)}">${cs.map((c) => `<option value="${c.id}" ${c.id === choix ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</optgroup>` : '';
  }).join('');

  function modaleLigne(id, preset = {}) {
    const l = id ? ligne(id) : null;
    const type = l?.type || preset.type || 'enc';
    const v = l || { type, categorie: type === 'enc' ? 'prestations' : 'achats', libelle: '', montant: null, recurrence: preset.recurrence || 'mensuel', mois: preset.mois || moisCourant(), fin: null };
    const imprevu = !!preset.imprevu;
    const corps = `
      <fieldset class="bascule" ${l ? 'disabled' : ''}><legend class="sr-only">Sens</legend>
        <label><input type="radio" name="type" value="enc" ${type === 'enc' ? 'checked' : ''}><span>+ Encaissement</span></label>
        <label><input type="radio" name="type" value="dec" ${type === 'dec' ? 'checked' : ''}><span>− Décaissement</span></label>
      </fieldset>
      <label class="champ">Catégorie<select name="categorie" id="ligne-cat">${optionsCategories(type, v.categorie)}</select></label>
      <p class="aide" id="aide-fiscal" ${categorie(v.categorie).famille === 'fiscal' ? '' : 'hidden'}>Aucune échéance fiscale ou sociale n'est fournie : reprends le montant et le mois de ton avis ou de ta déclaration.</p>
      <label class="champ">Libellé<input name="libelle" required maxlength="80" value="${esc(v.libelle)}" placeholder="Ex. : Loyer de l'atelier"></label>
      <div class="rang-champs">
        <label class="champ">${imprevu ? 'Montant réalisé (TTC)' : 'Montant prévu (TTC)'}<input name="montant" required inputmode="decimal" value="${pourChamp(v.montant)}" placeholder="Ex. : 1 250"></label>
        <label class="champ">Récurrence<select name="recurrence" id="ligne-rec">${B.recurrences.map((r) => `<option value="${r.id}" ${r.id === v.recurrence ? 'selected' : ''}>${r.nom} (${r.detail})</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ"><span id="lib-mois">${v.recurrence === 'ponctuel' ? 'Mois' : 'Premier mois'}</span><input type="month" name="mois" required value="${v.mois}"></label>
        <label class="champ" id="champ-fin" ${v.recurrence === 'ponctuel' ? 'hidden' : ''}>Dernier mois <small>Facultatif.</small><input type="month" name="fin" value="${v.fin || ''}"></label>
      </div>
      ${l ? `<p class="aide">${Object.keys(E.realise[l.id] || {}).length ? `${pluriel(Object.keys(E.realise[l.id]).length, 'échéance pointée', 'échéances pointées')} : le réalisé est gardé. ` : ''}Changer le montant modifie toutes les échéances non ajustées ; pour un seul mois, passe par Pointage.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = l
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : `<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>`;
    ouvrirModale(l ? 'Modifier la prévision' : imprevu ? `Opération imprévue · ${lm(v.mois)}` : 'Nouvelle prévision', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        memoriser();
        E.lignes = E.lignes.filter((x) => x.id !== l.id);
        delete E.realise[l.id]; delete E.ajustements[l.id];
        sauver(); rendre(); toast(`« ${l.libelle} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const libelle = String(f.get('libelle') || '').trim();
      const montant = R.versCentimes(f.get('montant'));
      const rec = f.get('recurrence');
      const mois = f.get('mois');
      const fin = rec === 'ponctuel' ? null : (f.get('fin') || null);
      if (!libelle) return 'Indique un libellé.';
      if (montant === null) return 'Montant illisible (ex. : 1 250,50).';
      if (!R.moisValide(mois)) return 'Choisis le mois.';
      if (fin && (!R.moisValide(fin) || fin < mois)) return 'Le dernier mois doit suivre le premier.';
      const valeurs = { type: l?.type || f.get('type'), categorie: f.get('categorie'), libelle, montant, recurrence: rec, mois, fin };
      memoriser();
      if (l && action === 'dupliquer') {
        E.lignes.push({ ...valeurs, id: uid(), libelle: `${libelle} (copie)` });
        sauver(); rendre(); toast('Prévision dupliquée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      if (l) Object.assign(l, valeurs);
      else {
        const n = { id: uid(), ...valeurs };
        if (imprevu) { n.montant = 0; n.recurrence = 'ponctuel'; n.fin = null; E.realise[n.id] = { [mois]: montant }; }
        E.lignes.push(n);
      }
      sauver(); rendre();
      toast(l ? 'Prévision enregistrée.' : imprevu ? 'Opération imprévue ajoutée au réalisé.' : `« ${libelle} » ajoutée.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', () => { $('#ligne-cat').innerHTML = optionsCategories(r.value, r.value === 'enc' ? 'prestations' : 'achats'); $('#aide-fiscal').hidden = true; }));
    $('#ligne-cat').addEventListener('change', (e) => { $('#aide-fiscal').hidden = categorie(e.target.value).famille !== 'fiscal'; });
    $('#ligne-rec').addEventListener('change', (e) => { const p = e.target.value === 'ponctuel'; $('#champ-fin').hidden = p; $('#lib-mois').textContent = p ? 'Mois' : 'Premier mois'; });
    if (imprevu) { $('#ligne-rec').value = 'ponctuel'; $('#ligne-rec').closest('label').hidden = true; $('#champ-fin').hidden = true; }
  }

  function modaleAjuster(id) {
    const l = ligne(id);
    const a = E.ajustements[id]?.[moisPointage];
    const corps = `
      <p>« ${esc(l.libelle)} » en ${lm(moisPointage)}. Montant habituel : <b>${eur(l.montant)}</b>.</p>
      <label class="champ">Prévu pour ce mois seulement<input name="montant" inputmode="decimal" value="${pourChamp(Number.isInteger(a) ? a : l.montant)}"></label>
      <p class="aide">Utile pour un client en retard, une facture plus grosse, une échéance décalée (mets 0 ici et ajoute-la au bon mois).</p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button>${Number.isInteger(a) ? '<button class="btn" value="retour">Revenir au montant habituel</button>' : '<button class="btn" value="annuler">Annuler</button>'}`;
    ouvrirModale('Prévu de ce mois', corps, pied, (f, action) => {
      memoriser();
      const aj = (E.ajustements[id] ||= {});
      if (action === 'retour') delete aj[moisPointage];
      else {
        const c = R.versCentimes(f.get('montant'));
        if (c === null) { annulation = null; return 'Montant illisible.'; }
        if (c === l.montant) delete aj[moisPointage]; else aj[moisPointage] = c;
      }
      if (!Object.keys(aj).length) delete E.ajustements[id];
      sauver(); rendre(); toast('Prévu du mois enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleMontant(titre, texte, valeur, appliquer, avecMois = false) {
    const corps = `
      <p>${texte}</p>
      <label class="champ">Montant<input name="montant" inputmode="decimal" value="${pourChamp(valeur)}"></label>
      ${avecMois ? `<label class="champ">Au début du mois<input type="month" name="mois" value="${E.debut}"></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(titre, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const c = R.versCentimes(f.get('montant'), { negatif: true });
      if (c === null) return 'Montant illisible (ex. : 12 500 ou -800).';
      if (avecMois && !R.moisValide(f.get('mois'))) return 'Choisis le mois.';
      memoriser();
      appliquer(c, f.get('mois'));
      sauver(); rendre(); toast('Hypothèse enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEcarts() {
    const corps = `
      <p>Écart appliqué aux encaissements pas encore réalisés, en % du prévu.</p>
      <div class="rang-champs">
        <label class="champ">Prudent (%)<input name="prudent" type="number" min="-100" max="100" step="1" value="${E.ecarts.prudent}"></label>
        <label class="champ">Optimiste (%)<input name="optimiste" type="number" min="-100" max="100" step="1" value="${E.ecarts.optimiste}"></label>
      </div>
      <p class="aide">Par défaut : prudent ${B.ecartsParDefaut.prudent} %, optimiste +${B.ecartsParDefaut.optimiste} %. Ce sont des valeurs de départ, pas une norme : un client unique ou une activité saisonnière justifient un écart plus large.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Scénarios', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const p = Number(f.get('prudent')), o = Number(f.get('optimiste'));
      if (![p, o].every((n) => Number.isInteger(n) && n >= -100 && n <= 100)) return 'Écarts : nombres entiers entre -100 et 100.';
      memoriser();
      E.ecarts = { prudent: p, optimiste: o };
      sauver(); rendre(); toast('Scénarios enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCategorie() {
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" placeholder="Ex. : Location de matériel"></label>
      <fieldset class="bascule"><legend class="sr-only">Sens</legend>
        <label><input type="radio" name="type" value="enc"><span>+ Encaissement</span></label>
        <label><input type="radio" name="type" value="dec" checked><span>− Décaissement</span></label>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Catégorie personnelle', corps, '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      if (categories().some((c) => c.nom.toLowerCase() === nom.toLowerCase())) return 'Cette catégorie existe déjà.';
      memoriser();
      E.categoriesPerso.push({ id: `p-${uid()}`, nom, type: f.get('type'), famille: 'perso' });
      sauver(); rendre(); toast(`Catégorie « ${nom} » créée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Nom de l'activité<input name="nom" maxlength="60" value="${esc(E.nom)}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton plan est enregistré en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <p class="aide">${esc(B.avertissement)}</p>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.nom = String(f.get('nom') || '').trim();
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.lignes) || !R.moisValide(d.debut)) throw new Error();
        if (!confirm(`Remplacer ton plan actuel par cette copie (${pluriel(d.lignes.length, 'prévision')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du plan de trésorerie.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tresorerie-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
      case 'profil': accueil.profil = id; accueil.montants = {}; ecranAccueil(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(false); break;
      case 'accueil-vide': terminerAccueil(true); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'scenario': E.scenario = id; sauver(); rendre(); break;
      case 'passes': montrerPasses = el.checked; rendre(); break;
      case 'pointer': if (!el.dataset.mois) break; moisPointage = el.dataset.mois; if (vue !== 'pointage') changerVue('pointage'); else { rendre(); $('.puce-mois[aria-pressed=true]')?.scrollIntoView({ block: 'nearest', inline: 'center' }); } break;
      case 'ligne-nouvelle': modaleLigne(null, { type: el.dataset.type }); break;
      case 'ligne-modifier': modaleLigne(id); break;
      case 'imprevu': modaleLigne(null, { imprevu: true, recurrence: 'ponctuel', mois: moisPointage, type: 'dec' }); break;
      case 'conforme': { const ec = R.echeancesDuMois(E, moisPointage).find((x) => x.ligne.id === id); if (ec) poserRealise(id, ec.prevu, `« ${ec.ligne.libelle} » conforme au prévu.`); break; }
      case 'pas-eu-lieu': poserRealise(id, 0, `« ${ligne(id)?.libelle} » : rien passé ce mois-ci.`); break;
      case 'effacer-realise': poserRealise(id, null); break;
      case 'ajuster': modaleAjuster(id); break;
      case 'solde': modaleMontant('Solde de départ', 'Solde du compte au début du mois choisi (signe moins si découvert). Les mois précédents ne sont plus calculés.', E.soldeDepart, (c, m) => { E.soldeDepart = c; E.debut = m; }, true); break;
      case 'recaler': modaleMontant(`Recaler au 1er ${lm(moisCourant())}`, `Saisis le solde bancaire constaté au début de ${lm(moisCourant())}. Il devient le nouveau point de départ ; les mois passés ne sont plus recalculés (ton réalisé reste enregistré). Solde calculé jusqu'ici : <b>${eur(calc().mois.find((x) => x.mois === moisCourant())?.soldeDebut ?? E.soldeDepart)}</b>.`, calc().mois.find((x) => x.mois === moisCourant())?.soldeDebut ?? E.soldeDepart, (c) => { E.soldeDepart = c; E.debut = moisCourant(); }); break;
      case 'seuil': modaleMontant('Seuil d\'alerte', 'Solde de fin de mois en dessous duquel le mois est signalé.', E.seuil, (c) => { E.seuil = c; }); break;
      case 'ecarts': modaleEcarts(); break;
      case 'cat-nouvelle': modaleCategorie(); break;
      case 'cat-suppr': {
        const c = categorie(id);
        if (E.lignes.some((l) => l.categorie === id)) { toast(`« ${c.nom} » est utilisée par des prévisions : change d'abord leur catégorie.`); break; }
        memoriser();
        E.categoriesPerso = E.categoriesPerso.filter((x) => x.id !== id);
        sauver(); rendre(); toast(`Catégorie « ${c.nom} » retirée.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  let largeurPrecedente = window.innerWidth, minuterieTaille = null;
  window.addEventListener('resize', () => {
    clearTimeout(minuterieTaille);
    minuterieTaille = setTimeout(() => { if (Math.abs(window.innerWidth - largeurPrecedente) > 40 && vue === 'synthese' && E) { largeurPrecedente = window.innerWidth; rendre(); } }, 200);
  });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
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
  window.__tresorerie = { etat: () => E, calcul: () => (E ? calc() : null), demo: () => donneesDemo() };
  init();
})();
