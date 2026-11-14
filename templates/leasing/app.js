// Simulateur leasing ou achat QME : comptant, crédit, LOA et LLD comparés côte à côte.
// Données synchronisées par clé de licence ou code d'accès. Simulation : pas un conseil financier.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.VTR;
  const API = '/api/templates';
  const PRODUIT = 'VTR';
  const CLE_CODE = 'qme-vtr-code';
  const CLE_CACHE = 'qme-vtr-cache';
  const CLE_DEMO = 'qme-vtr-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-vtr-ecran-accueil';

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
  const eur = (c) => R.euros(c, { centimes: false });
  const eurC = (c) => R.euros(c);
  const parKm = (x) => (x.parKm === null ? '–' : `${(x.parKm / 100).toFixed(2).replace('.', ',')}\u00a0€/km`);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const couleur = (s) => R.COULEURS[s.couleur] || R.COULEURS[0];
  const TIRETS = { comptant: '', credit: '', loa: '7 4', lld: '2 4' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'comparaison';
  let annulation = null;

  const etatVide = () => R.etatVide();
  const normaliser = (d) => R.normaliser(d, B.defauts);
  const P = () => E.projets.find((p) => p.id === E.actif) || E.projets[0];
  const scenario = (id) => P().scenarios.find((s) => s.id === id);

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
        toast('Un autre appareil a modifié tes comparaisons entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (VTR-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
      if (E.projets.length) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.projets.length) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && normaliser(d).projets.length ? normaliser(d) : donneesDemo();
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
  // Deux comparaisons fictives, sans marque ni modèle réel :
  // « SUV hybride » (4 offres : comptant avec remise et placement de l'apport, crédit plus long que la
  // détention, LOA avec option levée, LLD entretien inclus avec dépassement kilométrique) ;
  // « Citadine essence » (crédit soldé avant la fin, LOA rendue avec frais de restitution, LLD à compléter).
  function donneesDemo() {
    const e = etatVide();
    const suv = R.normaliserProjet({
      nom: 'SUV hybride', prix: 3800000, duree: 48, kmAn: 18000, decote1: 20, decote2: 12, kmNormal: 15000, perteKm: 5,
      entretienAn: 60000, assuranceMois: 7000, placement: 3,
      note: 'Offres reçues en concession (exemple fictif).',
      scenarios: [
        { type: 'comptant', nom: 'Comptant avec remise', prix: 3650000, assuranceMois: 7000, note: 'Remise de 1 500 € pour un paiement comptant.' },
        { type: 'credit', nom: 'Crédit sur 60 mois', apport: 600000, taux: 5.9, dureeCredit: 60, fraisDossier: 30000, assuranceMois: 7000 },
        { type: 'loa', nom: 'LOA, option levée', premierLoyer: 400000, loyer: 38900, optionAchat: 1750000, leverOption: true, kmForfait: 15000, prixKmSup: 8, assuranceMois: 7000, fraisRestitution: 50000 },
        { type: 'lld', nom: 'LLD entretien inclus', premierLoyer: 300000, loyer: 37900, kmForfait: 15000, prixKmSup: 12, entretienInclus: true, assuranceMois: 7000, fraisRestitution: 40000, note: 'Forfait de 15 000 km/an : dépassement à prévoir.' },
      ],
      questions: { 'prix-remise': true, taeg: true, 'lld-km': true },
    }, B.defauts);
    const citadine = R.normaliserProjet({
      nom: 'Citadine essence', prix: 1950000, duree: 37, kmAn: 9000, decote1: 22, decote2: 14, kmNormal: 12000, perteKm: 4,
      entretienAn: 40000, assuranceMois: 4500, placement: null,
      scenarios: [
        { type: 'credit', nom: 'Crédit sur 36 mois', apport: 200000, taux: 4.5, dureeCredit: 36, fraisDossier: 15000, assuranceMois: 4500 },
        { type: 'loa', nom: 'LOA, voiture rendue', premierLoyer: 250000, loyer: 19900, optionAchat: 980000, leverOption: false, kmForfait: 10000, prixKmSup: 7, assuranceMois: 4500, fraisRestitution: 25000 },
        { type: 'lld', nom: 'LLD à demander', kmForfait: 10000, entretienInclus: true, assuranceMois: 4500, note: 'En attente du devis.' },
      ],
    }, B.defauts);
    e.projets = [suv, citadine];
    e.actif = suv.id;
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Simulateur leasing ou achat · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="410" y="130" width="40" height="40" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Simulateur leasing ou achat</p>
          <h1>Ta voiture, au vrai prix.</h1>
          <p>Comptant, crédit, LOA ou LLD : le coût total net de chaque offre côte à côte, revente et kilomètres compris.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton simulateur</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes comparaisons sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon simulateur</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon simulateur'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', prix: '', duree: String(B.defauts.duree), kmAn: String(B.defauts.kmAn), types: [...R.TYPES] });
  let accueil = accueilVide();

  // Champs communs au premier lancement et à « Nouvelle comparaison ».
  const champsProjetBase = (v) => `
    <div class="rang-champs">
      <label class="champ">Véhicule <small>Un nom pour t'y retrouver, ex. : « SUV hybride ».</small><input name="nom" maxlength="60" value="${esc(v.nom)}" placeholder="Ma prochaine voiture"></label>
      <label class="champ">Prix du véhicule (€) <small>Prix affiché, options comprises.</small><input name="prix" inputmode="decimal" autocomplete="off" value="${esc(v.prix)}" placeholder="Ex. : 25 000"></label>
    </div>
    <div class="rang-champs">
      <label class="champ">Durée de détention (mois) <small>Aussi la durée des contrats LOA et LLD.</small><input name="duree" type="number" min="${R.DUREE_MIN}" max="${R.DUREE_MAX}" value="${esc(v.duree)}"></label>
      <label class="champ">Kilomètres par an <small>Ton usage réel.</small><input name="kmAn" inputmode="numeric" value="${esc(v.kmAn)}"></label>
    </div>`;
  const choixTypes = (types) => `<fieldset class="champ types-choix"><legend>Les offres à comparer <small>Tu pourras en ajouter, en dupliquer ou en retirer ensuite (6 au plus).</small></legend>
    ${R.TYPES.map((t) => `<label class="type-carte"><input type="checkbox" name="types" value="${t}" ${types.includes(t) ? 'checked' : ''}><span><b>${esc(B.types[t].nom)}</b><small>${esc(B.types[t].phrase)}</small></span></label>`).join('')}</fieldset>`;

  function lireProjetBase(fd) {
    const prix = String(fd.get('prix') || '').trim() ? R.lireMontant(fd.get('prix')) : null;
    if (String(fd.get('prix') || '').trim() && prix === null) return 'Prix illisible : écris par exemple 25 000.';
    const duree = R.lireEntier(fd.get('duree'), R.DUREE_MIN, R.DUREE_MAX);
    if (duree === null) return `La durée doit être entre ${R.DUREE_MIN} et ${R.DUREE_MAX} mois.`;
    const kmAn = R.lireEntier(fd.get('kmAn'), 0, R.KM_MAX);
    if (kmAn === null) return 'Kilométrage illisible : écris par exemple 15 000.';
    const types = fd.getAll('types');
    if (!types.length) return 'Choisis au moins une offre à comparer.';
    return { nom: String(fd.get('nom') || '').trim() || 'Ma voiture', prix, duree, kmAn, types };
  }
  function creerProjet({ nom, prix, duree, kmAn, types }) {
    const p = R.normaliserProjet({ ...B.defauts, nom, prix, duree, kmAn }, B.defauts);
    for (const t of R.TYPES.filter((x) => types.includes(x))) p.scenarios.push(R.scenarioDefaut(p, t, p.scenarios.map((s) => s.couleur)));
    return p;
  }

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Combien te coûtera vraiment cette voiture ?</h1>
        <p class="intro">Tu reportes les offres reçues (comptant, crédit, LOA, LLD) : le coût total net sur la période se calcule pour chacune, revente estimée, kilomètres et frais compris, avec le coût par mois et par kilomètre.</p>
        <form id="form-accueil" class="form-accueil" novalidate>${champsProjetBase(a)}<p class="erreur" role="alert">${esc(erreur)}</p></form>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Quelles offres compares-tu ?</h1>
        <p class="intro">Chaque offre est à compléter avec les montants de ton devis. Tant qu'il manque un montant, l'offre reste « à compléter » et n'entre pas dans la comparaison.</p>
        <form id="form-accueil" class="form-accueil" novalidate>${choixTypes(a.types)}<p class="erreur" role="alert">${esc(erreur)}</p></form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma comparaison</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const f = $('#form-accueil');
    f.addEventListener('input', () => {
      const fd = new FormData(f);
      if (a.etape === 1) for (const k of ['nom', 'prix', 'duree', 'kmAn']) a[k] = String(fd.get(k) ?? '');
      else a.types = fd.getAll('types');
    });
    f.addEventListener('submit', (e) => e.preventDefault());
  }

  function accueilSuivant() {
    const fd = new FormData($('#form-accueil'));
    fd.append('types', 'comptant');
    const r = lireProjetBase(fd);
    if (typeof r === 'string') return ecranAccueil(r);
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    const fd = new FormData();
    for (const k of ['nom', 'prix', 'duree', 'kmAn']) fd.append(k, accueil[k]);
    for (const t of accueil.types) fd.append('types', t);
    const r = lireProjetBase(fd);
    if (typeof r === 'string') return ecranAccueil(r);
    E = etatVide();
    const p = creerProjet(r);
    E.projets.push(p); E.actif = p.id;
    accueil = accueilVide();
    vue = 'scenarios';
    sauver();
    demarrer();
    toast('Ta comparaison est prête. Complète chaque offre avec les montants de ton devis.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    comparaison: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    scenarios: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    hypotheses: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    questions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['comparaison', 'Comparaison'], ['scenarios', 'Offres'], ['hypotheses', 'Hypothèses'], ['questions', 'Questions']];
  const AVERTISSEMENT = '<p class="mention avertissement">Simulation à partir de ta saisie et d\'hypothèses que tu choisis (décote, entretien, placement) : ce n\'est pas un conseil financier. Les offres écrites et les contrats font foi. La fiscalité des indépendants (déductibilité, TVA, amortissement) n\'est pas calculée.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const pastille = (s) => `<i class="pastille-sc" style="--c:${couleur(s)}" aria-hidden="true"></i>`;
  const etiquetteType = (t) => `<span class="etiquette type-${t}">${esc(B.types[t].court)}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/leasing/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Leasing<br>ou achat</span>
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
    if (!E.projets.length) { E.projets.push(creerProjet({ nom: 'Ma voiture', prix: null, duree: B.defauts.duree, kmAn: B.defauts.kmAn, types: [...R.TYPES] })); E.actif = E.projets[0].id; }
    if (!E.projets.some((p) => p.id === E.actif)) E.actif = E.projets[0].id;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Leasing ou achat`;
    $('#vue').className = `vue vue-${vue}`;
    graphes.clear();
    $('#vue').innerHTML = { comparaison: vueComparaison, scenarios: vueScenarios, hypotheses: vueHypotheses, questions: vueQuestions }[vue]();
    brancherGraphiques();
    brancherEssaiKm();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur de comparaison (un véhicule = une comparaison).
  function selecteurProjets() {
    return `<div class="projets" role="group" aria-label="Comparaisons">${E.projets.map((p) => `<button class="filtre" data-action="projet" data-id="${p.id}" aria-pressed="${p.id === E.actif}">${esc(p.nom)} <small>${p.scenarios.length}</small></button>`).join('')}<button class="filtre ajout" data-action="nouveau-projet">${ICONES.plus}Nouvelle comparaison</button></div>`;
  }
  const resumeHyp = (p) => `${p.prix ? `${eur(p.prix)} · ` : ''}${R.duree(p.duree)} · ${R.km(p.kmAn)} par an${p.placement > 0 ? ` · apport placé à ${R.pct(p.placement)}` : ''}`;

  // ---------- Comparaison ----------
  function vueComparaison() {
    const p = P();
    const c = R.comparer(p);
    const titre = `<div class="vue-tete"><div><h1>${esc(p.nom)}</h1><p>${esc(resumeHyp(p))}. Coût total net de chaque offre sur la période, revente estimée déduite.</p></div>
        <div class="actions"><button class="btn" data-action="hypotheses">Hypothèses</button><button class="btn primaire" data-action="nouveau-scenario">${ICONES.plus}Ajouter une offre</button></div></div>`;
    const incomplets = c.incomplets.length ? `<div class="a-completer"><b>${pluriel(c.incomplets.length, 'offre')} à compléter</b>${c.incomplets.map((x) => { const s = scenario(x.id); return `<button class="lien-ligne" data-action="scenario" data-id="${s.id}">${pastille(s)}<span><b>${esc(s.nom)}</b> manque ${esc(x.manque.join(', '))}</span></button>`; }).join('')}</div>` : '';
    if (!c.complets.length) {
      return `${selecteurProjets()}${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune offre complète pour l'instant</h3><p>Reporte les montants de tes devis dans l'onglet Offres : prix, apport et taux pour un crédit, loyers et forfait kilométrique pour une LOA ou une LLD.</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="scenarios">Compléter les offres</button></div></div></div>${incomplets}${AVERTISSEMENT}`;
    }
    const m = c.moinsCher, sm = scenario(m.id);
    const second = c.complets[1];
    const verdict = `<div class="verdict">${pastille(sm)}<div><p class="surtitre">Le moins cher sur ${esc(R.duree(p.duree))}, à ${esc(R.km(p.kmAn))} par an</p>
      <h2>${esc(sm.nom)}&nbsp;: <span class="nowrap">${eur(m.net)} net</span></h2>
      <p>Soit ${eur(m.mensuel)} par mois et ${parKm(m)}${second ? `, ${eur(second.ecart)} de moins que ${esc(scenario(second.id).nom)}` : ''}. Hypothèses de revente et de kilométrage : à tester dans Hypothèses.</p></div></div>`;
    const tuiles = p.scenarios.map((s) => {
      const x = c.tous.find((y) => y.id === s.id);
      if (!x.complet) return `<button class="tuile-sc incomplete" data-action="scenario" data-id="${s.id}" style="--c:${couleur(s)}"><span class="tuile-tete">${pastille(s)}<b>${esc(s.nom)}</b>${etiquetteType(s.type)}</span><span class="tuile-val">À compléter</span><span class="tuile-detail">Manque ${esc(x.manque.join(', '))}</span></button>`;
      return `<button class="tuile-sc ${x.rang === 1 ? 'premier' : ''}" data-action="detail" data-id="${s.id}" style="--c:${couleur(s)}"><span class="tuile-tete">${pastille(s)}<b>${esc(s.nom)}</b>${etiquetteType(s.type)}</span>
        <span class="tuile-val">${eur(x.net)}</span>
        <span class="tuile-detail">${eur(x.mensuel)} par mois · ${parKm(x)}</span>
        <span class="tuile-rang">${x.rang === 1 ? '<span class="etiquette vert">Le moins cher</span>' : `<span class="etiquette sable">${x.rang}<sup>e</sup> · + ${eur(x.ecart)}</span>`}${x.kmSup ? `<span class="etiquette rose">+ ${esc(R.km(x.kmSup))}</span>` : ''}</span></button>`;
    }).join('');
    return `${selecteurProjets()}${titre}
      ${verdict}
      <div class="tuiles-sc">${tuiles}</div>
      ${incomplets}
      <h2 class="titre-section">Coût cumulé dans le temps <span>Ce que tu auras versé, mois après mois ; la revente se déduit à la fin</span></h2>
      ${graphiqueCumul(p, c)}
      <h2 class="titre-section">Côte à côte <span>Postes de coût sur ${esc(R.duree(p.duree))}</span></h2>
      ${tableauCote(p, c)}
      <h2 class="titre-section">Selon ton kilométrage <span>L'offre la moins chère, toutes hypothèses égales par ailleurs</span></h2>
      ${blocKm(p, c)}
      <div class="encadre-fiscal"><h2>Indépendant ou société ?</h2><p>Déductibilité des loyers ou de l'amortissement, TVA récupérable, plafonds selon les émissions, avantage en nature : <b>non calculés ici</b>. Ils dépendent de ton statut et des règles de l'année. Compare d'abord le coût réel, puis demande l'effet fiscal à ton expert-comptable.</p></div>
      <p class="mention hors-calcul">${esc(B.horsCalcul)}</p>
      ${AVERTISSEMENT}`;
  }

  // Tableau des postes, une colonne par offre (les incomplètes en « à compléter »).
  function tableauCote(p, c) {
    const cols = p.scenarios.map((s) => ({ s, x: c.tous.find((y) => y.id === s.id) }));
    const lignes = [['depart', 'Versé au départ'], ['frais', 'Frais de dossier et annexes'], ['paiements', 'Mensualités ou loyers'], ['assurance', 'Assurance'], ['entretien', 'Entretien'], ['option', 'Option d\'achat'], ['restantDu', 'Capital restant dû'], ['kmSup', 'Kilomètres en plus'], ['restitution', 'Remise en état'], ['opportunite', 'Coût d\'opportunité'], ['valeur', 'Revente estimée']];
    const val = (x, k) => x.postes.find((y) => y[0] === k)[2];
    const utiles = lignes.filter(([k]) => cols.some(({ x }) => x.complet && val(x, k)));
    const cell = (x, k) => { if (!x.complet) return '<td class="nb discret">–</td>'; const v = val(x, k); return `<td class="nb ${v < 0 ? 'negatif' : ''}">${v ? eur(v) : '<span class="discret">0 €</span>'}</td>`; };
    return `<div class="defile cote"><table class="tableau"><caption class="sr-only">Postes de coût de chaque offre, coût net, coût mensuel et au kilomètre</caption>
      <thead><tr><th scope="col">Poste</th>${cols.map(({ s }) => `<th scope="col" class="nb"><span class="th-sc">${pastille(s)}${esc(s.nom)}</span></th>`).join('')}</tr></thead>
      <tbody>${utiles.map(([k, lib]) => `<tr><th scope="row">${lib}</th>${cols.map(({ x }) => cell(x, k)).join('')}</tr>`).join('')}
      ${cols.some(({ x }) => x.complet && x.interets) ? `<tr class="info"><th scope="row">dont intérêts du crédit (sur toute sa durée)</th>${cols.map(({ x }) => `<td class="nb">${x.complet && x.interets ? eur(x.interets) : ''}</td>`).join('')}</tr>` : ''}</tbody>
      <tfoot><tr><th scope="row">Coût total net</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? eur(x.net) : 'à compléter'}</td>`).join('')}</tr>
      <tr><th scope="row">Par mois</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? eur(x.mensuel) : ''}</td>`).join('')}</tr>
      <tr><th scope="row">Par km</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? parKm(x) : ''}</td>`).join('')}</tr></tfoot></table></div>`;
  }

  // Plages de kilométrage (barre segmentée) + phrases de seuil + essai d'un autre kilométrage.
  function blocKm(p, c) {
    if (c.complets.length < 2) return '<p class="aide">Complète au moins deux offres pour voir à partir de quel kilométrage l\'une devient moins chère que l\'autre.</p>';
    const max = 60000;
    const plages = R.plagesKm(p, { max });
    const seg = plages.map((x) => { const s = scenario(x.id); return `<span class="plage" style="--c:${couleur(s)};width:${((x.a - x.de + 1) / (max + 1)) * 100}%" title="${esc(`${s.nom} : de ${R.km(x.de)} à ${R.km(x.a)} par an`)}"></span>`; }).join('');
    const pos = Math.min(100, (p.kmAn / max) * 100);
    const seuils = R.seuilsDuMoinsCher(p);
    const sm = scenario(c.moinsCher.id);
    const phrases = seuils.map((x) => {
      const s = scenario(x.id);
      return x.km === null
        ? `<li>${pastille(s)}<span><b>${esc(s.nom)}</b> ne passe pas devant ${esc(sm.nom)} entre 0 et 60 000 km par an.</span></li>`
        : `<li>${pastille(s)}<span><b>${esc(s.nom)}</b> devient moins chère que ${esc(sm.nom)} ${x.sens === 'au-dessus' ? 'au-delà de' : 'en dessous de'} <b>${esc(R.km(x.km))}</b> par an.</span></li>`;
    }).join('');
    return `<div class="bloc-km">
      <div class="plages" role="img" aria-label="${esc(plages.map((x) => `${scenario(x.id).nom} de ${R.km(x.de)} à ${R.km(x.a)} par an`).join(' ; '))}">${seg}<span class="repere-km" style="left:${pos}%"><b>${esc(R.km(p.kmAn))}</b></span></div>
      <div class="graduations"><span>0</span><span>20 000</span><span>40 000</span><span>60 000 km/an</span></div>
      <ul class="liste-plages">${plages.map((x) => { const s = scenario(x.id); return `<li>${pastille(s)}<span>De ${esc(R.milliers(x.de))} à ${esc(R.km(x.a))} par an${x.a === max ? ' et plus' : ''} : <b>${esc(s.nom)}</b></span></li>`; }).join('')}</ul>
      <ul class="liste-seuils">${phrases}</ul>
      <div class="essai-km"><label class="champ">Et si tu roulais… <output id="essai-sortie">${esc(R.km(p.kmAn))} par an</output><input type="range" id="essai-km" min="0" max="${max}" step="500" value="${Math.min(max, p.kmAn)}"></label><ol class="classement" id="essai-classement">${classementKm(p, p.kmAn)}</ol><p class="mention">Essai seulement : ton kilométrage se change dans Hypothèses.</p></div>
    </div>`;
  }
  function classementKm(p, k) {
    return R.comparer(p, { kmAn: k }).complets.map((x) => { const s = scenario(x.id); return `<li>${pastille(s)}<span>${esc(s.nom)}</span><b>${eur(x.net)}</b></li>`; }).join('');
  }
  function brancherEssaiKm() {
    const r = $('#essai-km');
    if (!r) return;
    r.addEventListener('input', () => {
      const k = Number(r.value);
      $('#essai-sortie').textContent = `${R.km(k)} par an`;
      $('#essai-classement').innerHTML = classementKm(P(), k);
    });
  }

  // ---------- Graphique : coût cumulé ----------
  function pasRond(etendue) {
    const brut = etendue / 4;
    const p = 10 ** Math.floor(Math.log10(Math.max(brut, 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= brut) || p * 10;
  }
  const kEur = (c) => { const e = c / 100; return Math.abs(e) >= 10000 ? `${String(Math.round(e / 100) / 10).replace('.', ',')} k€` : eur(c); };
  const libMois = (i) => (i === 0 ? 'Départ' : i % 12 === 0 ? `${i / 12} an${i > 12 ? 's' : ''}` : `${i} mois`);
  const graphes = new Map();

  function graphiqueCumul(p, c) {
    const series = c.complets.slice().sort((a, b) => scenario(a.id).couleur - scenario(b.id).couleur).map((x) => { const s = scenario(x.id); return { id: s.id, nom: s.nom, couleur: couleur(s), tirets: TIRETS[s.type], valeurs: x.cumul, net: x.net }; });
    const N = p.duree;
    const L = Math.round(Math.min(1148, Math.max(300, document.documentElement.clientWidth - (estTel() ? 44 : 100))));
    const petit = L < 560;
    const H = petit ? 240 : 320, g = petit ? 52 : 68, d = petit ? 14 : 170, h = 18, b = 30;
    const max = Math.max(1, ...series.flatMap((s) => s.valeurs));
    const pas = pasRond(max);
    const haut = Math.ceil(max / pas) * pas;
    const hz = H - h - b;
    const y = (v) => h + hz - (v / haut) * hz;
    const x = (i) => g + ((L - g - d) * i) / N;
    const grilles = [];
    for (let v = 0; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${kEur(v)}</text>`);
    // Graduations : départ, chaque année, et la fin si elle tombe entre deux années ; sans chevauchement.
    const ticks = [0];
    for (let i = 12; i < N; i += 12) ticks.push(i);
    ticks.push(N);
    const place = petit ? 46 : 60;
    const axeX = [];
    let dernier = Infinity;
    for (const i of ticks.slice().reverse()) { if (dernier - x(i) < place) continue; axeX.push(`<text class="axe" x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${libMois(i)}</text>`); dernier = x(i); }
    const traces = series.map((s) => `<path class="ligne" stroke="${s.couleur}" ${s.tirets ? `stroke-dasharray="${s.tirets}"` : ''} d="M${s.valeurs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L')}"/>`).join('');
    // Étiquettes directes en bout de ligne (ordinateur), écartées pour ne pas se chevaucher.
    let etiquettes = '';
    if (!petit) {
      const pos = series.map((s) => ({ s, py: y(s.valeurs[N]) })).sort((a, z) => a.py - z.py);
      for (let i = 1; i < pos.length; i++) if (pos[i].py - pos[i - 1].py < 18) pos[i].py = pos[i - 1].py + 18;
      etiquettes = pos.map(({ s, py }) => `<circle class="pt" cx="${x(N)}" cy="${y(s.valeurs[N])}" r="4.5" fill="${s.couleur}"/><text class="valeur" x="${x(N) + 12}" y="${py + 4}">${esc(s.nom.length > 22 ? `${s.nom.slice(0, 21)}…` : s.nom)}</text>`).join('');
    } else etiquettes = series.map((s) => `<circle class="pt" cx="${x(N)}" cy="${y(s.valeurs[N])}" r="4" fill="${s.couleur}"/>`).join('');
    graphes.set('g-cumul', { N, series, x, y, L });
    const cle = (s) => `<svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="${s.couleur}" stroke-width="3" ${s.tirets ? `stroke-dasharray="${s.tirets.split(' ').map((n) => Math.max(2, n / 1.6)).join(' ')}"` : ''} stroke-linecap="round"/></svg>`;
    const legende = `<div class="legende">${series.map((s) => `<span>${cle(s)}${esc(s.nom)}</span>`).join('')}</div>`;
    const lignesTable = [];
    for (let i = 0; i <= N; i++) if (i % 3 === 0 || i === N) lignesTable.push(i);
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">Décaissements cumulés par offre, tous les trois mois</caption><thead><tr><th scope="col">Mois</th>${series.map((s) => `<th scope="col" class="nb">${esc(s.nom)}</th>`).join('')}</tr></thead><tbody>${lignesTable.map((i) => `<tr><th scope="row">${libMois(i)}</th>${series.map((s) => `<td class="nb">${eur(s.valeurs[i])}</td>`).join('')}</tr>`).join('')}<tr class="info"><th scope="row">Coût net (revente déduite)</th>${series.map((s) => `<td class="nb">${eur(s.net)}</td>`).join('')}</tr></tbody></table></div></details>`;
    return `<figure class="graphique" id="g-cumul" tabindex="0" aria-label="Décaissements cumulés de chaque offre sur ${esc(R.duree(N))} : flèches gauche et droite pour lire chaque mois">
      ${legende}
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Décaissements cumulés par offre ; détail dans le tableau">${grilles.join('')}${traces}${etiquettes}${axeX.join('')}<line class="repere" x1="0" x2="0" y1="${h}" y2="${H - b}" visibility="hidden"/><g class="reperes-pts"></g><rect class="zone-survol" x="${g}" y="0" width="${L - g - d}" height="${H - b}"/></svg>
      <div class="infobulle" hidden></div>
      <figcaption class="note">Le saut final correspond aux paiements de fin de contrat (option d'achat, kilomètres en plus, remise en état, capital restant dû). Coût net à la fin, revente estimée déduite : ${series.map((s) => `${esc(s.nom)} ${eur(s.net)}`).join(' · ')}.</figcaption>
      ${table}
    </figure>`;
  }

  function brancherGraphiques() {
    for (const [id, G] of graphes) {
      const fig = document.getElementById(id);
      if (!fig) continue;
      const svg = fig.querySelector('svg[role=img]');
      const bulle = fig.querySelector('.infobulle');
      const repere = fig.querySelector('.repere');
      const pts = fig.querySelector('.reperes-pts');
      let courant = -1;
      const montrer = (i) => {
        i = Math.max(0, Math.min(G.N, i));
        courant = i;
        const px = G.x(i);
        repere.setAttribute('x1', px); repere.setAttribute('x2', px); repere.setAttribute('visibility', 'visible');
        pts.innerHTML = G.series.map((s) => `<circle class="pt actif" cx="${px}" cy="${G.y(s.valeurs[i])}" r="5" fill="${s.couleur}"/>`).join('');
        bulle.textContent = '';
        const t = document.createElement('b'); t.textContent = i === 0 ? 'Au départ' : `Après ${R.duree(i)}`; bulle.appendChild(t);
        for (const s of [...G.series].sort((a, z) => z.valeurs[i] - a.valeurs[i])) {
          const l = document.createElement('div'); l.className = 'ligne-bulle';
          const k = document.createElement('i'); k.style.background = s.couleur; l.appendChild(k);
          const v = document.createElement('strong'); v.textContent = eur(s.valeurs[i]); l.appendChild(v);
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
        for (let i = 0; i <= G.N; i++) { const dd = Math.abs(G.x(i) - vx); if (dd < dist) { dist = dd; best = i; } }
        return best;
      };
      const zone = fig.querySelector('.zone-survol');
      zone.addEventListener('pointermove', (e) => montrer(versIndex(e)));
      zone.addEventListener('pointerdown', (e) => montrer(versIndex(e)));
      fig.addEventListener('pointerleave', cacher);
      fig.addEventListener('blur', cacher);
      fig.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); montrer(courant < 0 ? (e.key === 'ArrowRight' ? 0 : G.N) : courant + (e.key === 'ArrowRight' ? 1 : -1)); }
        if (e.key === 'Escape') cacher();
      });
    }
  }

  // ---------- Offres (scénarios) ----------
  function lignesCles(p, s) {
    const l = [];
    const prix = R.prixDe(p, s);
    if (s.type === 'comptant') l.push(['Prix payé', prix ? eur(prix) : 'à saisir']);
    if (s.type === 'credit') {
      l.push(['Prix', prix ? eur(prix) : 'à saisir'], ['Apport', eur(s.apport)], ['Taux', s.taux === null ? 'à saisir' : R.pct(s.taux)], ['Durée du crédit', s.dureeCredit ? R.duree(s.dureeCredit) : 'à saisir']);
      if (prix && s.taux !== null && s.dureeCredit) l.push(['Mensualité', eurC(R.mensualite(Math.max(0, prix - s.apport), s.taux, s.dureeCredit))]);
    }
    if (s.type === 'loa' || s.type === 'lld') {
      l.push(['Premier loyer', eur(s.premierLoyer)], ['Loyer', s.loyer ? `${eurC(s.loyer)} × ${Math.max(0, p.duree - 1)}` : 'à saisir']);
      if (s.type === 'loa') l.push(['Option d\'achat', s.optionAchat ? eur(s.optionAchat) : '–'], ['À la fin', s.leverOption ? 'Je lève l\'option' : 'Je rends la voiture']);
      l.push(['Forfait', s.kmForfait ? `${R.km(s.kmForfait)} par an` : 'non saisi'], ['Km en plus', s.prixKmSup ? R.eurosKm(s.prixKmSup) : '–'], ['Entretien', s.entretienInclus ? 'inclus' : 'en plus']);
    }
    if (s.fraisDossier) l.push(['Frais de dossier', eur(s.fraisDossier)]);
    l.push(['Assurance', `${eurC(s.assuranceMois)} par mois`]);
    return l;
  }

  function vueScenarios() {
    const p = P();
    const c = R.comparer(p);
    const cartes = p.scenarios.map((s) => {
      const x = c.tous.find((y) => y.id === s.id);
      const al = R.alertes(p, s);
      return `<article class="carte-sc" style="--c:${couleur(s)}">
        <div class="carte-tete">${pastille(s)}<div><b>${esc(s.nom)}</b><small>${esc(B.types[s.type].nom)}</small></div>${etiquetteType(s.type)}</div>
        <dl class="cles">${lignesCles(p, s).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${al.map((a) => `<p class="alerte-sc ${a.niveau}">${esc(a.texte)}</p>`).join('')}
        ${s.note ? `<p class="mention">${esc(s.note)}</p>` : ''}
        <div class="carte-pied">${x.complet ? `<span class="net"><b>${eur(x.net)}</b><small>net · ${eur(x.mensuel)} par mois</small></span>` : `<span class="net incomplet"><b>À compléter</b><small>Manque ${esc(x.manque.join(', '))}</small></span>`}
          <span class="rang">${x.complet ? `<button class="btn petit" data-action="detail" data-id="${s.id}">Détail</button>` : ''}<button class="btn petit ${x.complet ? '' : 'primaire'}" data-action="scenario" data-id="${s.id}">${x.complet ? 'Modifier' : 'Compléter'}</button></span></div>
      </article>`;
    }).join('');
    return `${selecteurProjets()}
      <div class="vue-tete"><div><h1>Offres</h1><p>Reporte les montants de chaque offre reçue. Une offre incomplète reste hors de la comparaison. ${pluriel(p.scenarios.length, 'offre')} sur ${R.MAX_SCENARIOS} au plus.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-scenario" ${p.scenarios.length >= R.MAX_SCENARIOS ? 'disabled' : ''}>${ICONES.plus}Ajouter une offre</button></div></div>
      ${p.scenarios.length ? `<div class="grille-sc">${cartes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune offre</h3><p>Ajoute une première offre : comptant, crédit, LOA ou LLD.</p><div class="actions"><button class="btn primaire" data-action="nouveau-scenario">${ICONES.plus}Ajouter une offre</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Hypothèses ----------
  function vueHypotheses() {
    const p = P();
    const annees = [];
    for (let m = 12; m <= p.duree; m += 12) annees.push(m);
    if (p.duree % 12) annees.push(p.duree);
    const optKm = { kmAn: p.kmAn, kmNormal: p.kmNormal, perteKm: p.perteKm };
    const locations = p.scenarios.filter((s) => s.type === 'loa' || s.type === 'lld');
    const hyp = [
      ['Prix du véhicule', p.prix ? eur(p.prix) : 'à saisir', 'Sert à la valeur de revente, et de prix par défaut pour le comptant et le crédit.'],
      ['Durée de détention', R.duree(p.duree), 'Période de comparaison et durée des contrats LOA et LLD.'],
      ['Kilomètres par an', R.km(p.kmAn), 'Ton usage réel : décide des dépassements de forfait.'],
      ['Décote', `${R.pct(p.decote1)} la première année, puis ${R.pct(p.decote2)} par an`, 'Hypothèse de perte de valeur, pas une cote du marché.'],
      ['Effet du kilométrage sur la valeur', p.perteKm ? `${R.eurosKm(p.perteKm)} au-delà de ${R.km(p.kmNormal)} par an, regagnés en deçà` : 'non compté', 'Une voiture qui roule plus se revend moins cher.'],
      ['Entretien', `${eur(p.entretienAn)} par an`, 'Compté pour les offres où il n\'est pas inclus.'],
      ['Assurance proposée', `${eurC(p.assuranceMois)} par mois`, 'Valeur proposée pour une nouvelle offre ; chaque offre a la sienne.'],
      ['Coût d\'opportunité', p.placement > 0 ? `apport placé à ${R.pct(p.placement)} par an` : 'désactivé', 'Ce que l\'argent versé au départ aurait rapporté s\'il était resté placé.'],
    ];
    return `${selecteurProjets()}
      <div class="vue-tete"><div><h1>Hypothèses</h1><p>Communes à toutes les offres de « ${esc(p.nom)} ». Change-les pour voir si le classement tient.</p></div>
        <div class="actions"><button class="btn primaire" data-action="hypotheses">Modifier les hypothèses</button></div></div>
      <ul class="hyp">${hyp.map(([k, v, a]) => `<li><span><b>${esc(k)}</b><small>${esc(a)}</small></span><strong>${esc(v)}</strong></li>`).join('')}</ul>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Valeur de revente estimée <span>Hypothèse, à ${esc(R.km(p.kmAn))} par an</span></h2>
          ${p.prix ? `<div class="defile"><table class="tableau"><caption class="sr-only">Valeur estimée du véhicule à la fin de chaque année</caption><thead><tr><th scope="col">Après</th><th scope="col" class="nb">Valeur</th><th scope="col" class="nb">Perte</th></tr></thead><tbody>${annees.map((m) => { const v = R.valeurEstimee(p.prix, m, p.decote1, p.decote2, optKm); return `<tr><td>${esc(R.duree(m))}</td><td class="nb">${eur(v)}</td><td class="nb">${Math.round((1 - v / p.prix) * 100)} %</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="aide">Saisis le prix du véhicule pour estimer sa valeur.</p>'}
        </section>
        <section>
          <h2 class="titre-section">Kilométrage et forfaits <span>Réel ${esc(R.km(p.kmAn))} par an</span></h2>
          ${locations.length ? `<ul class="prochains">${locations.map((s) => { const d = R.kmDepasses(p.kmAn, s.kmForfait, p.duree); const leve = s.type === 'loa' && s.leverOption; return `<li>${pastille(s)}<button class="lien-ligne" data-action="scenario" data-id="${s.id}"><b>${esc(s.nom)}</b><span>Forfait ${s.kmForfait ? `${esc(R.km(s.kmForfait))} par an` : 'non saisi'} · ${s.prixKmSup ? esc(R.eurosKm(s.prixKmSup)) : 'prix du km non saisi'}${leve ? ' · option levée : pas de pénalité comptée' : ''}</span></button><span class="nb ${d && !leve ? 'depasse' : ''}">${d ? (leve ? `${esc(R.km(d))} au-delà, sans pénalité` : `+ ${esc(R.km(d))} · ${eur(Math.round(d * s.prixKmSup))}`) : 'Dans le forfait'}</span></li>`; }).join('')}</ul>` : '<p class="aide">Aucune LOA ni LLD dans cette comparaison.</p>'}
        </section>
      </div>
      <h2 class="titre-section">Mes comparaisons <span>Un véhicule par comparaison</span></h2>
      <ul class="prochains">${E.projets.map((x) => `<li><span class="date-pastille"><b>${x.scenarios.length}</b>offres</span><button class="lien-ligne" data-action="projet" data-id="${x.id}"><b>${esc(x.nom)}</b><span>${esc(resumeHyp(x))}</span></button><span class="rang"><button class="btn petit" data-action="dupliquer-projet" data-id="${x.id}">Dupliquer</button><button class="btn petit danger" data-action="supprimer-projet" data-id="${x.id}">Supprimer</button></span></li>`).join('')}</ul>
      <h2 class="titre-section">Repères <span>Comment chaque offre est comptée</span></h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <p class="mention hors-calcul">${esc(B.horsCalcul)}</p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Questions au vendeur ----------
  function questionsDe(p) {
    const types = [...new Set(p.scenarios.map((s) => s.type))];
    const groupes = [['commun', 'Pour toutes les offres']];
    for (const t of ['credit', 'loa', 'lld']) if (types.includes(t)) groupes.push([t, B.types[t].nom]);
    return groupes.map(([cle, nom]) => ({ cle, nom, questions: B.questions[cle] }));
  }
  function vueQuestions() {
    const p = P();
    const g = questionsDe(p);
    const toutes = g.flatMap((x) => x.questions);
    const faites = toutes.filter(([id]) => p.questions[id]).length;
    return `${selecteurProjets()}
      <div class="vue-tete"><div><h1>Ce qu'il faut demander au vendeur</h1><p>Les questions à poser avant de signer, selon les offres de « ${esc(p.nom)} ». Coche celles qui ont reçu une réponse écrite.</p></div>
        <div class="actions"><button class="btn" data-action="copier-questions">Copier les questions restantes</button></div></div>
      <p class="resume-liste">${faites} sur ${pluriel(toutes.length, 'question')} avec une réponse</p>
      ${g.map((x) => `<section class="groupe-q"><h2 class="titre-section">${esc(x.nom)}</h2><ul class="questions">${x.questions.map(([id, q, pourquoi]) => `<li><label class="case-q"><input type="checkbox" data-action="question" data-id="${id}" ${p.questions[id] ? 'checked' : ''}><span><b>${esc(q)}</b><small>${esc(pourquoi)}</small></span></label></li>`).join('')}</ul></section>`).join('')}
      ${AVERTISSEMENT}`;
  }
  async function copierQuestions() {
    const p = P();
    const lignes = [`Questions à poser · ${p.nom}`];
    for (const x of questionsDe(p)) {
      const reste = x.questions.filter(([id]) => !p.questions[id]);
      if (reste.length) lignes.push('', x.nom, ...reste.map(([, q]) => `- ${q}`));
    }
    const texte = lignes.join('\n');
    try { await navigator.clipboard.writeText(texte); toast('Questions copiées : colle-les dans un message ou une note.'); } catch { toast('Copie impossible dans ce navigateur.'); }
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
  const garderOuverte = () => { modale().dataset.garder = '1'; };

  // Choix du type d'une nouvelle offre.
  function modaleNouveauScenario() {
    const p = P();
    if (p.scenarios.length >= R.MAX_SCENARIOS) { toast(`${R.MAX_SCENARIOS} offres au plus par comparaison : retire ou duplique une offre existante.`); return; }
    ouvrirModale('Nouvelle offre', `<p>Quel type d'offre as-tu reçu ?</p><div class="types-choix">${R.TYPES.map((t) => `<button type="button" class="type-carte bouton" data-action="creer-scenario" data-type="${t}"><span><b>${esc(B.types[t].nom)}</b><small>${esc(B.types[t].phrase)}</small></span></button>`).join('')}</div>`, '<button class="btn primaire" value="annuler">Annuler</button>');
  }

  // Champ montant (euros) d'un formulaire d'offre.
  const champE = (nom, lib, v, aide = '', ph = '0') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" autocomplete="off" value="${esc(R.saisieMontant(v))}" placeholder="${esc(ph)}"></label>`;

  function corpsScenario(p, s) {
    const t = s.type;
    const parts = [`<label class="champ">Nom de l'offre <small>Ex. : « LOA concession », « Crédit banque ».</small><input name="nom" maxlength="60" value="${esc(s.nom)}" required></label>`];
    if (t === 'comptant' || t === 'credit') parts.push(`<div class="rang-champs">${champE('prix', 'Prix de l\'offre (€)', s.prix, `Vide : prix de la comparaison${p.prix ? ` (${eur(p.prix)})` : ''}.`, p.prix ? R.saisieMontant(p.prix) : '0')}${t === 'credit' ? champE('apport', 'Apport (€)', s.apport) : champE('fraisDossier', 'Frais annexes (€)', s.fraisDossier, 'Carte grise, livraison…')}</div>`);
    if (t === 'credit') parts.push(`<div class="rang-champs">
        <label class="champ">Taux annuel (%) <small>Taux débiteur de l'offre (à défaut le TAEG, un peu plus élevé).</small><input name="taux" inputmode="decimal" value="${esc(R.saisieTaux(s.taux))}" placeholder="Ex. : 5,9"></label>
        <label class="champ">Durée du crédit (mois)<input name="dureeCredit" type="number" min="1" max="120" value="${s.dureeCredit || ''}"></label>
      </div>${champE('fraisDossier', 'Frais de dossier et annexes (€)', s.fraisDossier, 'Avec le taux débiteur, ajoute ici les frais de dossier.')}`);
    if (t === 'loa' || t === 'lld') {
      parts.push(`<div class="rang-champs">${champE('premierLoyer', 'Premier loyer (€)', s.premierLoyer, 'Apport ou premier loyer majoré.')}${champE('loyer', 'Loyer mensuel (€)', s.loyer, `${Math.max(0, p.duree - 1)} loyers après le premier, sur ${esc(R.duree(p.duree))}.`, 'Ex. : 299')}</div>`);
      if (t === 'loa') parts.push(`${champE('optionAchat', 'Option d\'achat finale (€)', s.optionAchat, 'Prix de rachat en fin de contrat.')}
        <fieldset class="champ"><legend>À la fin du contrat</legend><div class="choix-statut deux">${[['oui', 'Je lève l\'option'], ['non', 'Je rends la voiture']].map(([k, l]) => `<label><input type="radio" name="lever" value="${k}" ${(s.leverOption ? 'oui' : 'non') === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>`);
      parts.push(`<div class="rang-champs">
        <label class="champ">Forfait (km par an)<input name="kmForfait" inputmode="numeric" value="${s.kmForfait || ''}" placeholder="Ex. : 15 000"></label>
        <label class="champ">Prix du km en plus (€)<small>Ex. : 0,08</small><input name="prixKmSup" inputmode="decimal" value="${esc(R.saisiePrixKm(s.prixKmSup))}" placeholder="0,08"></label>
      </div>
      <label class="case"><input type="checkbox" name="entretienInclus" ${s.entretienInclus ? 'checked' : ''}> Entretien inclus dans le loyer (écrit au contrat)</label>
      <div class="rang-champs">${champE('fraisRestitution', 'Remise en état à la restitution (€)', s.fraisRestitution, t === 'loa' ? 'Estimation, comptée si tu rends la voiture.' : 'Estimation.')}${champE('fraisDossier', 'Frais de dossier (€)', s.fraisDossier)}</div>`);
    }
    parts.push(champE('assuranceMois', 'Assurance (€ par mois)', s.assuranceMois, 'Assurance du véhicule (et assurance emprunteur facultative).'));
    parts.push(`<label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(s.note)}"></label>`);
    parts.push('<p class="apercu" id="apercu" aria-live="polite"></p><p class="erreur" role="alert"></p>');
    return parts.join('');
  }

  // Lit le formulaire d'une offre : { s } ou un message d'erreur.
  function lireScenario(fd, base) {
    const montant = (nom, lib) => { const v = String(fd.get(nom) ?? '').trim(); if (!v) return 0; const m = R.lireMontant(v); if (m === null) throw new Error(`${lib} illisible : écris par exemple 1 250 ou 299,90.`); return m; };
    try {
      const s = { ...base, nom: String(fd.get('nom') || '').trim() || R.LIB_TYPE[base.type], note: String(fd.get('note') || '').trim() };
      if (fd.has('prix')) s.prix = String(fd.get('prix') || '').trim() ? montant('prix', 'Prix') : null;
      if (fd.has('apport')) s.apport = montant('apport', 'Apport');
      if (fd.has('fraisDossier')) s.fraisDossier = montant('fraisDossier', 'Frais de dossier');
      if (fd.has('taux')) { const v = String(fd.get('taux') || '').trim(); s.taux = v ? R.lireTaux(v) : null; if (v && s.taux === null) throw new Error('Taux illisible : écris par exemple 5,9.'); }
      if (fd.has('dureeCredit')) { const v = String(fd.get('dureeCredit') || '').trim(); s.dureeCredit = v ? R.lireEntier(v, 1, 120) : 0; if (s.dureeCredit === null) throw new Error('Durée du crédit : de 1 à 120 mois.'); }
      if (fd.has('premierLoyer')) s.premierLoyer = montant('premierLoyer', 'Premier loyer');
      if (fd.has('loyer')) s.loyer = montant('loyer', 'Loyer');
      if (fd.has('optionAchat')) s.optionAchat = montant('optionAchat', 'Option d\'achat');
      if (base.type === 'loa') s.leverOption = fd.get('lever') === 'oui';
      if (fd.has('kmForfait')) { const v = String(fd.get('kmForfait') || '').trim(); s.kmForfait = v ? R.lireEntier(v, 0, R.KM_MAX) : 0; if (s.kmForfait === null) throw new Error('Forfait illisible : écris par exemple 15 000.'); }
      if (fd.has('prixKmSup')) { const v = String(fd.get('prixKmSup') || '').trim(); s.prixKmSup = v ? R.lirePrixKm(v) : 0; if (s.prixKmSup === null) throw new Error('Prix du km illisible : écris par exemple 0,08.'); }
      if (base.type === 'loa' || base.type === 'lld') s.entretienInclus = !!fd.get('entretienInclus');
      if (fd.has('fraisRestitution')) s.fraisRestitution = montant('fraisRestitution', 'Frais de remise en état');
      s.assuranceMois = montant('assuranceMois', 'Assurance');
      return { s: R.normaliserScenario(s, 0, []) };
    } catch (x) { return x.message; }
  }

  function modaleScenario(id, { type } = {}) {
    const p = P();
    const existant = id ? scenario(id) : null;
    if (id && !existant) return;
    const s = existant || R.scenarioDefaut(p, type, p.scenarios.map((x) => x.couleur));
    const pied = existant
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" type="button" data-action="dupliquer-scenario" data-id="' + s.id + '">Dupliquer</button><button class="btn danger" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(existant ? esc(s.nom) : `Nouvelle offre · ${esc(B.types[s.type].nom)}`, corpsScenario(p, s), pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer l'offre « ${s.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        p.scenarios = p.scenarios.filter((x) => x.id !== s.id);
        sauver(); rendre(); toast(`Offre « ${s.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const r = lireScenario(fd, s);
      if (typeof r === 'string') return r;
      retenir();
      if (existant) Object.assign(existant, r.s); else p.scenarios.push(r.s);
      sauver(); rendre();
      const x = R.calculer(p, r.s);
      toast(x.complet ? `« ${r.s.nom} » : ${eur(x.net)} net sur ${R.duree(p.duree)}.` : `« ${r.s.nom} » enregistrée, à compléter : ${x.manque.join(', ')}.`, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const apercu = () => {
      const r = lireScenario(new FormData(f), s);
      const el = $('#apercu');
      if (!el) return;
      if (typeof r === 'string') { el.textContent = ''; return; }
      const x = R.calculer(p, r.s);
      el.innerHTML = x.complet
        ? `Coût net sur ${esc(R.duree(p.duree))} : <b>${eur(x.net)}</b> · ${eur(x.mensuel)} par mois${x.type === 'credit' ? ` · mensualité ${eurC(x.mensualite)}, intérêts ${eur(x.interets)}` : ''}${x.kmSup ? ` · ${esc(R.km(x.kmSup))} en plus (${eur(x.coutKmSup)})` : ''}`
        : `À compléter : ${esc(x.manque.join(', '))}.`;
    };
    f.addEventListener('input', apercu);
    apercu();
  }

  function dupliquerScenario(id) {
    const p = P();
    const s = scenario(id);
    if (!s) return;
    if (p.scenarios.length >= R.MAX_SCENARIOS) { toast(`${R.MAX_SCENARIOS} offres au plus par comparaison.`); return; }
    retenir();
    const copie = R.normaliserScenario({ ...structuredClone(s), id: uid(), couleur: null, nom: `${s.nom} (copie)`.slice(0, 60) }, p.scenarios.length, p.scenarios.map((x) => x.couleur));
    p.scenarios.splice(p.scenarios.indexOf(s) + 1, 0, copie);
    sauver(); rendre();
    modaleScenario(copie.id);
    toast('Offre dupliquée : change ce qui diffère (durée du crédit, forfait…).', { libelle: 'Annuler', faire: annuler });
  }

  // Détail du calcul d'une offre.
  function modaleDetail(id) {
    const p = P();
    const s = scenario(id);
    if (!s) return;
    const x = R.calculer(p, s);
    if (!x.complet) return modaleScenario(id);
    const al = R.alertes(p, s);
    const postes = x.postes.filter(([k, , v]) => v || k === 'valeur');
    const corps = `
      <div class="resume-facture">
        <div><span>Coût total net</span><b>${eur(x.net)}</b><small>sur ${esc(R.duree(p.duree))}</small></div>
        <div><span>Par mois</span><b>${eur(x.mensuel)}</b><small>coût mensuel équivalent</small></div>
        <div><span>Par kilomètre</span><b>${parKm(x)}</b><small>à ${esc(R.km(p.kmAn))} par an</small></div>
        <div><span>Versé en tout</span><b>${eur(x.decaissements)}</b><small>avant revente</small></div>
      </div>
      ${al.map((a) => `<p class="alerte-sc ${a.niveau}">${esc(a.texte)}</p>`).join('')}
      <section class="bloc-detail"><h3>Calcul <span>${eur(x.net)}</span></h3>
        ${postes.map(([k, lib, v]) => `<p class="ligne-somme ${k === 'valeur' ? 'deduit' : ''}"><span>${esc(lib)}</span><b>${eur(v)}</b></p>`).join('')}
        <p class="ligne-somme total"><span>Coût total net</span><b>${eur(x.net)}</b></p>
      </section>
      ${s.type === 'credit' ? `<section class="bloc-detail"><h3>Crédit <span>${eurC(x.mensualite)} par mois</span></h3>
        <p class="ligne-somme"><span>Capital emprunté (prix − apport)</span><b>${eur(x.capital)}</b></p>
        <p class="ligne-somme"><span>Taux et durée</span><b>${esc(R.pct(s.taux))} · ${esc(R.duree(s.dureeCredit))}</b></p>
        <p class="ligne-somme"><span>Coût des intérêts sur toute la durée</span><b>${eur(x.interets)}</b></p>
        ${x.restantDu ? `<p class="ligne-somme"><span>Intérêts payés pendant la détention</span><b>${eur(x.interetsPeriode)}</b></p>` : ''}
        <p class="mention">Mensualité par la formule d'annuité : capital × t / (1 − (1 + t)<sup>−n</sup>), t = taux annuel / 12, n = nombre de mois. L'offre de crédit et son tableau d'amortissement font foi.</p></section>` : ''}
      ${x.proprietaire ? `<p class="mention">Valeur de revente : hypothèse de décote (${esc(R.pct(p.decote1))} puis ${esc(R.pct(p.decote2))} par an${p.perteKm ? `, ajustée au kilométrage` : ''}), modifiable dans Hypothèses.</p>` : ''}
      ${p.placement > 0 && x.opportunite ? `<p class="mention">Coût d'opportunité : ${eur(x.depart)} versés au départ, placés à ${esc(R.pct(p.placement))} par an pendant ${esc(R.duree(p.duree))}, auraient rapporté ${eur(x.opportunite)}.</p>` : ''}`;
    ouvrirModale(`${esc(s.nom)}`, corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="scenario" data-id="${s.id}">Modifier</button>`);
  }

  // Hypothèses de la comparaison active.
  function modaleHypotheses() {
    const p = P();
    const corps = `
      ${champsProjetBase({ nom: p.nom, prix: R.saisieMontant(p.prix), duree: String(p.duree), kmAn: String(p.kmAn) })}
      <fieldset class="champ cadre-champs"><legend>Valeur de revente <small>Hypothèse : la valeur réelle dépend de l'état et du marché.</small></legend>
        <div class="rang-champs">
          <label class="champ">Décote la 1re année (%)<input name="decote1" inputmode="decimal" value="${esc(R.saisieTaux(p.decote1))}"></label>
          <label class="champ">Puis par an (%)<input name="decote2" inputmode="decimal" value="${esc(R.saisieTaux(p.decote2))}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Kilométrage « normal » (km par an)<input name="kmNormal" inputmode="numeric" value="${p.kmNormal}"></label>
          <label class="champ">Valeur perdue par km au-delà (€)<small>0 pour ignorer.</small><input name="perteKm" inputmode="decimal" value="${esc(R.saisiePrixKm(p.perteKm))}"></label>
        </div>
      </fieldset>
      <div class="rang-champs">
        <label class="champ">Entretien par an (€) <small>Hors énergie.</small><input name="entretienAn" inputmode="decimal" value="${esc(R.saisieMontant(p.entretienAn))}"></label>
        <label class="champ">Assurance par mois (€) <small>Proposée aux nouvelles offres.</small><input name="assuranceMois" inputmode="decimal" value="${esc(R.saisieMontant(p.assuranceMois))}"></label>
      </div>
      <label class="case"><input type="checkbox" name="assuranceToutes"> Appliquer cette assurance à toutes les offres de la comparaison</label>
      <fieldset class="champ cadre-champs"><legend>Coût d'opportunité <small>Ce que l'argent versé au départ aurait rapporté s'il était resté placé.</small></legend>
        <label class="case"><input type="checkbox" name="placementActif" ${p.placement > 0 ? 'checked' : ''}> Compter le coût d'opportunité</label>
        <label class="champ">Taux de placement (% par an)<input name="placement" inputmode="decimal" value="${esc(R.saisieTaux(p.placement))}" placeholder="Ex. : 3"></label>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Hypothèses', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      fd.append('types', 'comptant');
      const b = lireProjetBase(fd);
      if (typeof b === 'string') return b;
      const d1 = R.lireTaux(fd.get('decote1')), d2 = R.lireTaux(fd.get('decote2'));
      if (d1 === null || d2 === null) return 'Décote illisible : écris par exemple 20.';
      const kmNormal = R.lireEntier(fd.get('kmNormal'), 0, R.KM_MAX);
      if (kmNormal === null) return 'Kilométrage normal illisible.';
      const perteKm = String(fd.get('perteKm') || '').trim() ? R.lirePrixKm(fd.get('perteKm')) : 0;
      if (perteKm === null) return 'Valeur perdue par km illisible : écris par exemple 0,05.';
      const entretienAn = String(fd.get('entretienAn') || '').trim() ? R.lireMontant(fd.get('entretienAn')) : 0;
      const assuranceMois = String(fd.get('assuranceMois') || '').trim() ? R.lireMontant(fd.get('assuranceMois')) : 0;
      if (entretienAn === null || assuranceMois === null) return 'Montant illisible : écris par exemple 600.';
      let placement = null;
      if (fd.get('placementActif')) { placement = R.lireTaux(fd.get('placement')); if (!(placement > 0)) return 'Indique un taux de placement, par exemple 3.'; }
      retenir();
      Object.assign(p, { nom: b.nom, prix: b.prix, duree: b.duree, kmAn: b.kmAn, decote1: d1, decote2: d2, kmNormal, perteKm, entretienAn, assuranceMois, placement });
      if (fd.get('assuranceToutes')) p.scenarios.forEach((s) => { s.assuranceMois = assuranceMois; });
      sauver(); rendre(); toast('Hypothèses enregistrées : le classement est recalculé.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleNouveauProjet() {
    const v = { nom: '', prix: '', duree: String(P()?.duree || B.defauts.duree), kmAn: String(P()?.kmAn || B.defauts.kmAn) };
    ouvrirModale('Nouvelle comparaison', `<p class="mention">Un autre véhicule, ou les mêmes offres avec une autre durée : chaque comparaison a ses hypothèses et ses offres.</p>${champsProjetBase(v)}${choixTypes(R.TYPES)}<p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
        if (E.projets.length >= 20) return '20 comparaisons au plus : supprime celles qui ne servent plus.';
        const r = lireProjetBase(fd);
        if (typeof r === 'string') return r;
        retenir();
        const p = creerProjet(r);
        E.projets.push(p); E.actif = p.id;
        sauver(); vue = 'scenarios'; history.replaceState(null, '', '#scenarios'); rendre();
        toast(`Comparaison « ${p.nom} » créée : complète ses offres.`, { libelle: 'Annuler', faire: annuler });
      });
  }

  function dupliquerProjet(id) {
    const p = E.projets.find((x) => x.id === id);
    if (!p || E.projets.length >= 20) return;
    retenir();
    const copie = R.normaliserProjet({ ...structuredClone(p), id: uid(), nom: `${p.nom} (copie)`.slice(0, 60), scenarios: p.scenarios.map((s) => ({ ...s, id: uid() })) }, B.defauts);
    E.projets.splice(E.projets.indexOf(p) + 1, 0, copie);
    E.actif = copie.id;
    sauver(); rendre();
    toast(`« ${copie.nom} » créée : change une hypothèse pour comparer.`, { libelle: 'Annuler', faire: annuler });
  }
  function supprimerProjet(id) {
    const p = E.projets.find((x) => x.id === id);
    if (!p) return;
    if (E.projets.length <= 1) { toast('Garde au moins une comparaison : change plutôt ses hypothèses.'); return; }
    if (!confirm(`Supprimer la comparaison « ${p.nom} » et ses ${pluriel(p.scenarios.length, 'offre')} ?`)) return;
    retenir();
    E.projets = E.projets.filter((x) => x.id !== id);
    if (E.actif === id) E.actif = E.projets[0].id;
    sauver(); rendre();
    toast(`« ${p.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe"><h3>Exporter</h3><p class="aide">La comparaison affichée (« ${esc(P().nom)} ») en tableur (CSV) : postes côte à côte et hypothèses.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes comparaisons sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données</h3><p class="mention">Tes comparaisons sont enregistrées en ligne, liées à ta clé, et ne sont ni lues ni partagées par QME. Aucune connexion à une banque, un vendeur ou un loueur : tu saisis toi-même les montants de tes offres.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Simulateur rédigé pour QME (version ${esc(B.version)}). Aucune donnée de marché intégrée : prix, taux, loyers et décote sont ceux que tu saisis. Simulation, pas un conseil financier ; les offres écrites et les contrats font foi ; la fiscalité des indépendants n'est pas calculée.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.projets)) throw new Error();
        if (!confirm(`Remplacer tes comparaisons actuelles par cette copie (${pluriel(d.projets.length, 'comparaison')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du simulateur.'); }
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
  const aujIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `leasing-ou-achat-${aujIso()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(P()), 'text/csv;charset=utf-8', `comparaison-${P().nom.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voiture'}-${aujIso()}.csv`);

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
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'projet': if (modale().open) modale().close(); if (E.actif !== id) { E.actif = id; sauver(); } rendre(); break;
      case 'nouveau-projet': modaleNouveauProjet(); break;
      case 'dupliquer-projet': dupliquerProjet(id); break;
      case 'supprimer-projet': supprimerProjet(id); break;
      case 'hypotheses': modaleHypotheses(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-scenario': modaleNouveauScenario(); break;
      case 'creer-scenario': modaleScenario(null, { type: el.dataset.type }); break;
      case 'scenario': modaleScenario(id); break;
      case 'dupliquer-scenario': dupliquerScenario(id); break;
      case 'detail': modaleDetail(id); break;
      case 'copier-questions': copierQuestions(); break;
      default: break;
    }
  });
  // Questions cochées : enregistrées sans rerendre toute la vue.
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="question"]');
    if (!el) return;
    const p = P();
    if (el.checked) p.questions[el.dataset.id] = true; else delete p.questions[el.dataset.id];
    sauver();
    const g = questionsDe(p).flatMap((x) => x.questions);
    const r = $('.resume-liste');
    if (r) r.textContent = `${g.filter(([q]) => p.questions[q]).length} sur ${pluriel(g.length, 'question')} avec une réponse`;
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeur) > 40 && E && $('#vue') && vue === 'comparaison' && !modale().open) { largeur = window.innerWidth; rendre(); } });
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
        if (E.projets.length) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__leasing = { etat: () => E, regles: R };
  init();
})();
