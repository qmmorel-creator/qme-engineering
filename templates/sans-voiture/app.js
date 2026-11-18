// Vivre sans voiture QME : coût complet de la voiture, coût sans elle, gain annuel coût de sortie
// compris, urgences et parades. Données synchronisées par clé de licence ou code d'accès.
// Simulation : pas un conseil financier. Aucune donnée de marché intégrée.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.SVT;
  const API = '/api/templates';
  const PRODUIT = 'SVT';
  const CLE_CODE = 'qme-svt-code';
  const CLE_CACHE = 'qme-svt-cache';
  const CLE_DEMO = 'qme-svt-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-svt-ecran-accueil';

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
  const eur = (c, o) => R.euros(c, o);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const couleur = (s) => R.COULEURS[s.couleur] || R.COULEURS[0];
  const TIRETS = ['', '7 4', '2 4', '10 3 2 3', '1 3'];
  const aujIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const isoDans = (jours) => { const d = new Date(); d.setDate(d.getDate() + jours); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dateCourte = (iso) => { if (!iso) return ''; const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); };
  // Valeur lue dans un objet par un chemin « a.b ».
  const lireChemin = (o, ch) => ch.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  const ecrireChemin = (o, ch, v) => { const k = ch.split('.'); const fin = k.pop(); const cible = k.reduce((x, y) => (x[y] ??= {}), o); cible[fin] = v; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bilan';
  let annulation = null;

  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
  const normaliser = (d) => ({ tutorielVu: false, ...R.normaliser(d, B.defauts) });
  const S = () => E.scenarios.find((s) => s.id === E.actif) || E.scenarios[0];
  const scenario = (id) => E.scenarios.find((s) => s.id === id);
  const foyerCalc = () => ({ ...E.foyer, contrat: E.scenarios.some((s) => s.voiture.detention !== 'achat') });
  const commun = () => R.commun(E);
  const calc = (s) => R.calculer(s, commun());

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
        E.tutorielVu = vu || E.tutorielVu;
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié ta simulation entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (SVT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    E = d && normaliser(d).scenarios.length ? normaliser(d) : donneesDemo();
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
  // Foyer fictif : deux adultes, un enfant de 4 ans, un vélo électrique avec siège enfant, une citadine
  // en LOA depuis 7 mois (barème de rachat fictif). Trois scénarios : racheter et revendre au premier
  // rachat possible, attendre la fin du contrat, et la même voiture si elle était achetée. Aucun
  // montant, lieu ou contrat réel : tous les chiffres sont inventés et ronds.
  function donneesDemo() {
    const e = etatVide();
    e.foyer = R.normaliserFoyer({ adultes: 2, conducteurs: 2, enfants: [4], velo: 'electrique', veloQuotidien: true, equipementVelo: { siege: true, sacoches: true }, transports: true, teletravail: 1, dureeTrajet: 25, urgencesNuit: '15 minutes en taxi', vacances: 1, weekends: 4, grosAchats: 3 });
    e.reponses = { travail: 'oui', ecole: 'oui', arret: 'oui', recours: 'non', medecin: 'oui', location: 'oui', localVelo: 'oui', horaires: 'oui', teletravail: 'oui', famille: 'oui', accord: 'oui' };
    e.questionnaireFait = true;
    const voitureLoa = {
      detention: 'loa', valeur: 1650000, depreciation: 14, loyer: 25900, servicesMois: 0,
      assurance: 55000, entretien: 30000, controle: 0, carburantMode: 'km', kmAn: 9000, conso: 5.5, energie: 'l', prixEnergie: 175,
      stationnement: 48000, peages: 8000, divers: 8000,
      loa: { duree: 48, loyersPayes: 7, premierLoyer: 300000, option: 900000, premierRachat: 12, prixVehicule: 2000000, unite: 'montant', bareme: [{ loyer: 12, valeur: 1550000 }, { loyer: 18, valeur: 1430000 }, { loyer: 24, valeur: 1310000 }, { loyer: 30, valeur: 1190000 }, { loyer: 36, valeur: 1070000 }, { loyer: 42, valeur: 980000 }, { loyer: 48, valeur: 900000 }] },
    };
    const remplacement = {
      transports: { abonnes: 1, prixAbonnement: 4000, partEmployeur: 50, enfants: 0, tickets: 6000, deja: 0 },
      velo: { achat: 0, aides: 0, dureeAns: 0, entretien: 15000, assurance: 9000, deja: 15000 },
      joursLocation: 10, prixJour: 5500, semainesLocation: 1, prixSemaine: 32000, franchiseJour: 1200, kmLocation: 2500, prixKmLocation: 12,
      autopartage: { abonnement: 0, heures: 0, prixHeure: 0, km: 0, prixKm: 0 },
      taxis: 6, prixTaxi: 2200, train: 30000, livraisons: 12, prixLivraison: 600,
      autres: [], equipement: [{ libelle: 'Rehausseur pliable homologué', montant: 4000 }, { libelle: 'Cape de pluie pour le siège enfant', montant: 3000 }],
    };
    const sortieBase = { remise: 5, frais: 15000, canal: 'particulier', ecartParticulier: 3, ecartPro: 12 };
    const s1 = R.normaliserScenario({ nom: 'Racheter et revendre', voiture: voitureLoa, sortie: { ...sortieBase, mode: 'rachat-revente', loyerSortie: 12 }, remplacement, note: 'Premier rachat possible après le loyer 12.' }, 0, [], B.defauts);
    const s2 = R.normaliserScenario({ nom: 'Attendre la fin du contrat', voiture: voitureLoa, sortie: { ...sortieBase, mode: 'restitution', remiseEnEtat: 40000 }, remplacement }, 1, [s1.couleur], B.defauts);
    const s3 = R.normaliserScenario({ nom: 'Si elle était achetée', voiture: { ...voitureLoa, detention: 'achat' }, sortie: { ...sortieBase, mode: 'vente', delai: 0 }, remplacement }, 2, [s1.couleur, s2.couleur], B.defauts);
    e.scenarios = [s1, s2, s3];
    e.actif = s1.id;
    e.urgences = { nuit: { statut: 'couvert', cout: 4000, note: 'Numéro de taxi enregistré, rehausseur à l\'entrée.' }, siege: { statut: 'couvert', cout: 0, note: '' }, velo: { statut: 'couvert', cout: 0, note: '' }, meteo: { statut: 'couvert', cout: 0, note: '' }, malade: { statut: 'a-prevoir', cout: 2000, note: 'Trouver une personne de recours.' } };
    e.equipementOk = { rehausseur: 'a-acheter', 'siege-velo': 'en-place', 'casque-enfant': 'en-place', antivols: 'en-place', sacoches: 'en-place', cape: 'a-acheter' };
    e.comptes = { loueur1: true, transports: true, train: true };
    e.quotidien = { 0: true, 1: true, 2: true, 5: true, 7: true };
    e.test = { debut: isoDans(-20), duree: 2, journal: [
      { date: isoDans(-16), type: 'location', montant: 6800, note: 'Journée de location, courses lourdes' },
      { date: isoDans(-9), type: 'taxi', montant: 2400, note: 'Retour de soirée' },
      { date: isoDans(-3), type: 'train', montant: 4600, note: 'Visite à la famille' },
    ] };
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Vivre sans voiture · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="90" cy="200" r="70" fill="none" stroke="#5C8FD1" stroke-width="16"/>
          <circle cx="290" cy="200" r="70" fill="none" stroke="#5C8FD1" stroke-width="16"/>
          <path d="M90 200 L150 90 L240 90 L290 200 M150 90 L190 200 L240 90" fill="none" stroke="#F0EDE6" stroke-width="12" stroke-linejoin="round"/>
          <circle cx="470" cy="80" r="60" fill="#F5B400"/>
          <path d="M400 300 L400 180 A120 120 0 0 1 520 300 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Vivre sans voiture</p>
          <h1>Et sans elle, tu gagnes combien&nbsp;?</h1>
          <p>Le coût complet de ta voiture, celui des solutions de remplacement, le gain par an coût de sortie compris, et un plan pour chaque urgence.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton simulateur</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta simulation est enregistrée en ligne et te suit sur tous tes appareils.</p>
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
  // Deux étapes : le foyer (ce qui ouvre les champs utiles), puis la voiture (mode de détention).
  const accueilVide = () => ({ etape: 1, adultes: '2', enfants: '', velo: 'aucun', transports: false, detention: 'achat', valeur: '', kmAn: String(B.defauts.voiture.kmAn) });
  let accueil = accueilVide();
  const radios = (nom, options, val) => `<div class="choix-statut ${options.length === 2 ? 'deux' : ''}" role="radiogroup">${options.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${String(val) === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Peux-tu te passer de ta voiture&nbsp;?</h1>
        <p class="intro">Quelques questions sur ton foyer pour n'ouvrir que les champs utiles. Tout reste modifiable ensuite, dans l'onglet Questionnaire.</p>
        <form id="form-accueil" class="form-accueil" novalidate>
          <div class="rang-champs">
            <label class="champ">Adultes dans le foyer<input name="adultes" type="number" min="1" max="10" value="${esc(a.adultes)}"></label>
            <label class="champ">Âge des enfants <small>Séparés par des virgules, ex. : « 4, 8 ». Vide si aucun.</small><input name="enfants" inputmode="numeric" value="${esc(a.enfants)}" placeholder="Aucun"></label>
          </div>
          <fieldset class="champ"><legend>Un vélo dans le foyer&nbsp;?</legend>${radios('velo', [['electrique', 'Électrique'], ['classique', 'Classique'], ['aucun', 'Aucun']], a.velo)}</fieldset>
          <label class="case"><input type="checkbox" name="transports" ${a.transports ? 'checked' : ''}> Des transports en commun sont utilisables près de chez nous</label>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </form>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta voiture aujourd'hui</h1>
        <p class="intro">Le reste des coûts (assurance, entretien, carburant…) part de valeurs d'exemple, signalées comme telles, à remplacer par les tiennes.</p>
        <form id="form-accueil" class="form-accueil" novalidate>
          <fieldset class="champ"><legend>Comment est-elle détenue&nbsp;?</legend><div class="choix-statut" style="grid-template-columns:repeat(2,minmax(0,1fr))">${R.DETENTIONS.map((k) => `<label><input type="radio" name="detention" value="${k}" ${a.detention === k ? 'checked' : ''}><span>${esc({ achat: 'Achetée, payée', credit: 'Achetée à crédit', loa: 'En LOA', lld: 'En LLD' }[k])}</span></label>`).join('')}</div></fieldset>
          <div class="rang-champs">
            <label class="champ">Valeur de revente estimée (€) <small>Ce que tu en tirerais aujourd'hui. Vide : exemple de ${eur(B.defauts.voiture.valeur)}.</small><input name="valeur" inputmode="decimal" value="${esc(a.valeur)}" placeholder="Ex. : 8 000"></label>
            <label class="champ">Kilomètres par an<input name="kmAn" inputmode="numeric" value="${esc(a.kmAn)}"></label>
          </div>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </form>
        <div class="accueil-pied"><button class="btn" data-action="accueil-retour">Retour</button><button class="btn primaire" data-action="accueil-fin">Créer ma simulation</button></div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const f = $('#form-accueil');
    const lireForm = () => {
      const fd = new FormData(f);
      if (a.etape === 1) { a.adultes = String(fd.get('adultes') ?? ''); a.enfants = String(fd.get('enfants') ?? ''); a.velo = fd.get('velo') || 'aucun'; a.transports = !!fd.get('transports'); }
      else { a.detention = fd.get('detention') || 'achat'; a.valeur = String(fd.get('valeur') ?? ''); a.kmAn = String(fd.get('kmAn') ?? ''); }
    };
    f.addEventListener('input', lireForm);
    f.addEventListener('change', lireForm);
    f.addEventListener('submit', (e) => e.preventDefault());
  }
  const lireEnfants = (txt) => {
    const t = String(txt || '').trim();
    if (!t) return [];
    const l = t.split(/[,;\s]+/).filter(Boolean).map((x) => R.lireEntier(x, 0, 25));
    return l.includes(null) ? null : l.slice(0, 8);
  };
  function accueilSuivant() {
    const adultes = R.lireEntier(accueil.adultes, 1, 10);
    if (adultes === null) return ecranAccueil('Nombre d\'adultes : de 1 à 10.');
    if (lireEnfants(accueil.enfants) === null) return ecranAccueil('Âges illisibles : écris par exemple « 4, 8 ».');
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }
  function terminerAccueil() {
    const valeur = String(accueil.valeur).trim() ? R.lireMontant(accueil.valeur) : B.defauts.voiture.valeur;
    if (valeur === null) return ecranAccueil('Valeur illisible : écris par exemple 8 000.');
    const kmAn = R.lireEntier(accueil.kmAn, 0, 200000);
    if (kmAn === null) return ecranAccueil('Kilométrage illisible : écris par exemple 10 000.');
    E = etatVide();
    E.foyer = R.normaliserFoyer({ adultes: R.lireEntier(accueil.adultes, 1, 10), conducteurs: 1, enfants: lireEnfants(accueil.enfants), velo: accueil.velo, transports: accueil.transports });
    const s = R.normaliserScenario({ nom: accueil.detention === 'achat' || accueil.detention === 'credit' ? 'Vendre maintenant' : 'Sortir du contrat', voiture: { detention: accueil.detention, valeur, kmAn } }, 0, [], B.defauts);
    E.scenarios.push(s); E.actif = s.id;
    accueil = accueilVide();
    vue = 'questionnaire';
    sauver();
    demarrer();
    toast('Ta simulation est prête. Réponds au questionnaire, puis remplace les valeurs d\'exemple par les tiennes.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    questionnaire: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    voiture: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    sans: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 16 9.5 8h5L18 16M9.5 8l2.5 8 2.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    urgences: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bilan', 'Bilan'], ['questionnaire', 'Questionnaire'], ['voiture', 'Ma voiture'], ['sans', 'Sans voiture'], ['urgences', 'Urgences']];
  const AVERTISSEMENT = '<p class="mention avertissement">Simulation à partir de ta saisie : valeur de revente, perte de valeur, prix de location et tous les montants sont ceux que tu choisis. Ce n\'est pas un conseil financier ; le contrat et le financeur font foi. Les repères d\'urgence sont des pistes d\'organisation, pas un avis médical : en cas d\'urgence vitale, appelle le 15 ou le 112.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#2E5A88"/><circle cx="62" cy="62" r="34" fill="#E8B93A"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#E58C74"/></svg>';
  const pastille = (s) => `<i class="pastille-sc" style="--c:${couleur(s)}" aria-hidden="true"></i>`;
  const GRAVITE = { bloquant: ['rose', 'Peut bloquer'], anticiper: ['jaune', 'À anticiper'], favorable: ['ciel', 'Se règle facilement'] };
  const exemple = (v, d) => (v === d && d ? ' <span class="etiquette jaune">exemple</span>' : '');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/sans-voiture/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Vivre sans<br>voiture</span>
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
    if (!E.scenarios.length) { const s = R.normaliserScenario({ nom: 'Vendre maintenant' }, 0, [], B.defauts); E.scenarios.push(s); E.actif = s.id; }
    if (!E.scenarios.some((s) => s.id === E.actif)) E.actif = E.scenarios[0].id;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Vivre sans voiture`;
    $('#vue').className = `vue vue-${vue}`;
    graphes.clear();
    $('#vue').innerHTML = { bilan: vueBilan, questionnaire: vueQuestionnaire, voiture: vueVoiture, sans: vueSans, urgences: vueUrgences }[vue]();
    brancherGraphiques();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur de scénario (onglets Bilan, Ma voiture, Sans voiture).
  function selecteurScenarios() {
    return `<div class="projets" role="group" aria-label="Scénarios">${E.scenarios.map((s) => `<button class="filtre" data-action="scenario-actif" data-id="${s.id}" aria-pressed="${s.id === E.actif}">${pastille(s)}${esc(s.nom)}</button>`).join('')}${E.scenarios.length < R.MAX_SCENARIOS ? `<button class="filtre ajout" data-action="dupliquer-scenario" data-id="${S().id}">${ICONES.plus}Nouveau scénario</button>` : ''}<button class="filtre" data-action="gerer-scenario" data-id="${S().id}">Renommer ou supprimer</button></div>`;
  }

  // ---------- Bilan ----------
  function vueBilan() {
    const s = S();
    const x = calc(s);
    const titre = `<div class="vue-tete"><div><h1>Bilan</h1><p>Scénario « ${esc(s.nom)} » sur ${pluriel(E.horizon, 'an')}. Gain = coût de la voiture − coût sans voiture${E.temps.valeurHeure > 0 && E.temps.minutes ? ' − temps' : ''}${E.placement > 0 ? ' + placement de la vente' : ''}.</p></div>
      <div class="actions"><button class="btn" data-action="hypotheses">Horizon et hypothèses</button><button class="btn" data-action="csv">Exporter</button></div></div>`;
    if (!x.complet) return `${selecteurScenarios()}${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Il manque des informations</h3><p>Pour calculer ce scénario, saisis ${esc(x.manque.join(', '))} dans Ma voiture.</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="voiture">Compléter Ma voiture</button></div></div></div>${AVERTISSEMENT}`;
    const gagne = x.gainAn > 0;
    const so = x.sortie;
    const verdict = `<div class="verdict" style="background:var(--${gagne ? 'ciel' : 'rose'})"><div><p class="surtitre">${esc(R.libelleSortie(s.voiture, s.sortie, so))}</p>
      <h2>${gagne ? `Sans voiture, tu gagnes <span class="nowrap">${eur(x.gainAn)} par an</span>` : x.gainAn === 0 ? 'Avec ou sans voiture, le coût est le même' : `Garder la voiture coûte moins cher&nbsp;: <span class="nowrap">${eur(-x.gainAn)} par an</span>`}</h2>
      <p>Soit ${eur(Math.abs(x.gainMois))} par mois${gagne ? ' de gagnés' : ' de plus sans voiture'}. Sur ${pluriel(E.horizon, 'an')}, coût de sortie${x.equipement ? ' et équipement' : ''} compris&nbsp;: <b class="nowrap">${eur(x.cumulFin, { signe: true })}</b>.${!so.possible ? ` <b>Sortie impossible à calculer&nbsp;: ${esc(so.raison)}</b>` : ''}</p></div></div>`;
    const tuiles = `<div class="tuiles-sc">
      <div class="tuile-sc"><span class="tuile-tete"><b>Gain mensuel</b></span><span class="tuile-val">${eur(x.gainMois, { signe: true })}</span><span class="tuile-detail">à partir de la sortie</span></div>
      <div class="tuile-sc"><span class="tuile-tete"><b>Sortie de la voiture</b></span><span class="tuile-val">${so.mois ? `dans ${esc(R.duree(so.mois))}` : 'maintenant'}</span><span class="tuile-detail">coût de sortie ${eur(so.cout)}${x.equipement ? ` · équipement ${eur(x.equipement)}` : ''}</span></div>
      <div class="tuile-sc"><span class="tuile-tete"><b>Amorti en</b></span><span class="tuile-val">${x.amorti === null ? 'jamais' : esc(R.duree(x.amorti))}</span><span class="tuile-detail">${x.amorti === null ? 'le gain mensuel est nul ou négatif' : 'sortie et achats compris, depuis aujourd\'hui'}</span></div>
      ${tuileFaisabilite()}
    </div>`;
    return `${selecteurScenarios()}${titre}${verdict}${tuiles}
      ${blocUrgencesBilan()}
      <h2 class="titre-section">Coût par an <span>Avec la voiture et sans elle, poste par poste</span></h2>
      ${barresCouts(x)}
      <h2 class="titre-section">Gain cumulé <span>Depuis aujourd'hui, coût de sortie compris, sur ${pluriel(E.horizon, 'an')}</span></h2>
      ${graphiqueCumul()}
      <h2 class="titre-section">Et si… <span>Sensibilité du scénario « ${esc(s.nom)} »</span></h2>
      ${blocSensibilite(s)}
      ${E.scenarios.length > 1 ? `<h2 class="titre-section">Scénarios côte à côte</h2>${tableauScenarios()}` : ''}
      <p class="mention hors-calcul">${esc(B.horsCalcul)}</p>
      ${AVERTISSEMENT}`;
  }

  function tuileFaisabilite() {
    const f = R.faisabilite(B.faisabilite, E.reponses, foyerCalc());
    const lib = { bloquant: 'Bloquant', favorable: 'Favorable', 'a-preparer': 'À préparer', difficile: 'Difficile', inconnu: 'À évaluer' }[f.verdict];
    const detail = f.verdict === 'bloquant' ? `${esc(f.bloquants.map((q) => q.q).join(' ; '))} : non` : f.score === null ? 'réponds au questionnaire' : `${f.score}/100${f.sansReponse ? ` · ${pluriel(f.sansReponse, 'question')} sans réponse` : ''}`;
    return `<button class="tuile-sc" data-action="vue" data-vue="questionnaire"><span class="tuile-tete"><b>Faisabilité</b></span><span class="tuile-val">${lib}</span><span class="tuile-detail">${detail}</span>${f.aRegler.length && f.verdict !== 'bloquant' ? `<span class="tuile-rang"><span class="etiquette rose">À régler : ${esc(f.aRegler.map((q) => q.id === 'travail' ? 'travail' : 'école').join(', '))}</span></span>` : ''}</button>`;
  }

  function blocUrgencesBilan() {
    const ouvertes = R.urgencesOuvertes(B.urgences, E.urgences, foyerCalc());
    if (!ouvertes.length) return '<div class="a-completer" style="background:var(--ciel);color:var(--ciel-texte)"><b>Toutes les situations d\'urgence ont une parade.</b><span>Revois-les une fois par an, dans l\'onglet Urgences.</span></div>';
    return `<section class="urgences-bilan"><h2 class="titre-section">Urgences sans parade <span>${pluriel(ouvertes.length, 'situation')} à prévoir ; les plus graves d'abord</span></h2>
      <ul class="urgences-liste">${ouvertes.slice(0, 3).map((u) => carteUrgence(u, true)).join('')}</ul>
      <button class="btn" data-action="vue" data-vue="urgences">Voir toutes les urgences et parades</button></section>`;
  }

  // Barres horizontales sur une même échelle : totaux, puis postes de chaque côté.
  function barresCouts(x) {
    const voit = x.voiture.postes.filter((p) => p[2]);
    const sans = x.sans.postes.filter((p) => p[2]);
    const totalSans = x.sans.total + x.temps - x.placement;
    const max = Math.max(1, x.voiture.total, totalSans, ...voit.map((p) => p[2]), ...sans.map((p) => p[2]));
    const barre = (lib, val, coul, fort = false) => `<li class="${fort ? 'total' : ''}"><span class="bc-nom">${esc(lib)}</span><span class="bc-piste"><i style="width:${Math.max(0.5, (Math.max(0, val) / max) * 100)}%;background:${coul}"></i></span><span class="bc-val">${eur(val)}</span></li>`;
    return `<div class="couts-comp">
      <div class="legende"><span><i class="cle-carre" style="background:${R.COULEUR_VOITURE}"></i>Avec la voiture</span><span><i class="cle-carre" style="background:${R.COULEUR_SANS}"></i>Sans voiture</span></div>
      <ul class="barres-couts totaux">${barre('Avec la voiture', x.voiture.total, R.COULEUR_VOITURE, true)}${barre(`Sans voiture${x.temps ? ', temps compris' : ''}${x.placement ? ', placement déduit' : ''}`, totalSans, R.COULEUR_SANS, true)}</ul>
      <div class="colonnes-apercu">
        <section><h3 class="sous-titre">Avec la voiture</h3><ul class="barres-couts">${voit.map((p) => barre(p[1], p[2], R.COULEUR_VOITURE)).join('')}</ul></section>
        <section><h3 class="sous-titre">Sans voiture</h3><ul class="barres-couts">${sans.map((p) => barre(p[1], p[2], R.COULEUR_SANS)).join('')}${x.temps ? barre('Temps perdu, valorisé', x.temps, R.COULEUR_SANS) : ''}${x.placement ? barre('Placement de la vente (déduit)', -x.placement, R.COULEUR_SANS) : ''}</ul></section>
      </div></div>`;
  }

  function blocSensibilite(s) {
    const z = R.sensibilite(s, commun());
    const best = R.meilleureSortie(s, commun());
    const m = best.meilleure;
    const actuel = calc(s);
    return `<ul class="hyp">
      <li><span><b>Si la location coûte 30&nbsp;% plus cher</b><small>Jours et semaines de location, franchise comprise ; carburant inchangé.</small></span><strong>${eur(z.gainAnPlus30, { signe: true })} par an</strong></li>
      <li><span><b>Jours de location en plus possibles</b><small>Avant que l'option sans voiture coûte plus cher, à ${eur(z.coutJour)} le jour (prix, franchise, carburant moyen).</small></span><strong>${z.joursEnPlus ? `${z.joursEnPlus} jours par an` : 'aucun'}</strong></li>
      ${m ? `<li><span><b>Meilleur moment de sortie</b><small>Parmi ${pluriel(best.essais.length, 'sortie possible', 'sorties possibles')}, celle qui laisse le plus à ${pluriel(E.horizon, 'an')}.</small></span><strong>${esc(m.lib)} · ${eur(m.cumulFin, { signe: true })}${m.cumulFin > actuel.cumulFin ? ` <span class="etiquette vert">+ ${eur(m.cumulFin - actuel.cumulFin)} vs ton choix</span>` : ' <span class="etiquette sable">ton choix</span>'}</strong></li>` : ''}
    </ul>`;
  }

  function tableauScenarios() {
    const lignes = E.scenarios.map((s) => ({ s, x: calc(s) }));
    return `<div class="defile"><table class="tableau"><caption class="sr-only">Comparaison des scénarios</caption>
      <thead><tr><th scope="col">Scénario</th><th scope="col">Sortie</th><th scope="col" class="nb">Gain par an</th><th scope="col" class="nb">Coût de sortie</th><th scope="col" class="nb">Cumul ${E.horizon} ans</th></tr></thead>
      <tbody>${lignes.map(({ s, x }) => `<tr><th scope="row"><span class="th-sc">${pastille(s)}${esc(s.nom)}</span></th>${x.complet ? `<td>${esc(R.libelleSortie(s.voiture, s.sortie, x.sortie))}</td><td class="nb">${eur(x.gainAn, { signe: true })}</td><td class="nb">${eur(x.sortie.cout)}</td><td class="nb"><b>${eur(x.cumulFin, { signe: true })}</b></td>` : `<td colspan="4">À compléter : ${esc(x.manque.join(', '))}</td>`}</tr>`).join('')}</tbody></table></div>`;
  }

  // ---------- Graphique : gain cumulé ----------
  function pasRond(etendue) {
    const brut = etendue / 4;
    const p = 10 ** Math.floor(Math.log10(Math.max(brut, 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= brut) || p * 10;
  }
  const kEur = (c) => { const e = c / 100; return Math.abs(e) >= 10000 ? `${e < 0 ? '−' : ''}${String(Math.round(Math.abs(e) / 100) / 10).replace('.', ',')} k€` : eur(c); };
  const libMois = (i) => (i === 0 ? 'Aujourd\'hui' : i % 12 === 0 ? `${i / 12} an${i > 12 ? 's' : ''}` : `${i} mois`);
  const graphes = new Map();

  function graphiqueCumul() {
    const series = E.scenarios.map((s, i) => ({ s, x: calc(s), i })).filter(({ x }) => x.complet).map(({ s, x }) => ({ id: s.id, nom: s.nom, couleur: couleur(s), tirets: TIRETS[s.couleur] || '', valeurs: x.cumul, sortie: x.sortie.mois }));
    if (!series.length) return '';
    const N = E.horizon * 12;
    const L = Math.round(Math.min(1148, Math.max(300, document.documentElement.clientWidth - (estTel() ? 44 : 100))));
    const petit = L < 560;
    const H = petit ? 240 : 320, g = petit ? 56 : 72, d = petit ? 14 : 170, h = 18, b = 30;
    const tout = series.flatMap((s) => s.valeurs);
    const vmax = Math.max(0, ...tout), vmin = Math.min(0, ...tout);
    const pas = pasRond(Math.max(1, vmax - vmin));
    const haut = Math.ceil(vmax / pas) * pas, bas = Math.floor(vmin / pas) * pas;
    const hz = H - h - b;
    const y = (v) => h + hz - ((v - bas) / Math.max(1, haut - bas)) * hz;
    const x = (i) => g + ((L - g - d) * i) / N;
    const grilles = [];
    for (let v = bas; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${kEur(v)}</text>`);
    const ticks = [0];
    const pasAn = N > 96 ? 24 : 12;
    for (let i = pasAn; i < N; i += pasAn) ticks.push(i);
    ticks.push(N);
    const place = petit ? 50 : 64;
    const axeX = [];
    let dernier = Infinity;
    for (const i of ticks.slice().reverse()) { if (dernier - x(i) < place) continue; axeX.push(`<text class="axe" x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${libMois(i)}</text>`); dernier = x(i); }
    const traces = series.map((s) => `<path class="ligne" stroke="${s.couleur}" ${s.tirets ? `stroke-dasharray="${s.tirets}"` : ''} d="M${s.valeurs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L')}"/>`).join('');
    let etiquettes = '';
    if (!petit) {
      const pos = series.map((s) => ({ s, py: y(s.valeurs[N]) })).sort((a, z) => a.py - z.py);
      for (let i = 1; i < pos.length; i++) if (pos[i].py - pos[i - 1].py < 18) pos[i].py = pos[i - 1].py + 18;
      etiquettes = pos.map(({ s, py }) => `<circle class="pt" cx="${x(N)}" cy="${y(s.valeurs[N])}" r="4.5" fill="${s.couleur}"/><text class="valeur" x="${x(N) + 12}" y="${py + 4}">${esc(s.nom.length > 22 ? `${s.nom.slice(0, 21)}…` : s.nom)}</text>`).join('');
    } else etiquettes = series.map((s) => `<circle class="pt" cx="${x(N)}" cy="${y(s.valeurs[N])}" r="4" fill="${s.couleur}"/>`).join('');
    const sorties = series.filter((s) => s.sortie > 0 && s.sortie <= N).map((s) => `<circle class="pt" cx="${x(s.sortie)}" cy="${y(s.valeurs[s.sortie])}" r="4" fill="var(--surface)" stroke="${s.couleur}" stroke-width="2"/>`).join('');
    graphes.set('g-cumul', { N, series, x, y, L });
    const cle = (s) => `<svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="${s.couleur}" stroke-width="3" ${s.tirets ? `stroke-dasharray="${s.tirets.split(' ').map((n) => Math.max(2, n / 1.6)).join(' ')}"` : ''} stroke-linecap="round"/></svg>`;
    const legende = `<div class="legende">${series.map((s) => `<span>${cle(s)}${esc(s.nom)}</span>`).join('')}</div>`;
    const lignesTable = [];
    for (let i = 0; i <= N; i += 6) lignesTable.push(i);
    if (lignesTable[lignesTable.length - 1] !== N) lignesTable.push(N);
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">Gain cumulé par scénario, tous les six mois</caption><thead><tr><th scope="col">Mois</th>${series.map((s) => `<th scope="col" class="nb">${esc(s.nom)}</th>`).join('')}</tr></thead><tbody>${lignesTable.map((i) => `<tr><th scope="row">${libMois(i)}</th>${series.map((s) => `<td class="nb">${eur(s.valeurs[i], { signe: true })}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    return `<figure class="graphique" id="g-cumul" tabindex="0" aria-label="Gain cumulé de chaque scénario sur ${pluriel(E.horizon, 'an')} : flèches gauche et droite pour lire chaque mois">
      ${legende}
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Gain cumulé par scénario ; détail dans le tableau">${grilles.join('')}${traces}${sorties}${etiquettes}${axeX.join('')}<line class="repere" x1="0" x2="0" y1="${h}" y2="${H - b}" visibility="hidden"/><g class="reperes-pts"></g><rect class="zone-survol" x="${g}" y="0" width="${L - g - d}" height="${H - b}"/></svg>
      <div class="infobulle" hidden></div>
      <figcaption class="note">À plat tant que la voiture est là ; le cercle vide marque la sortie (coût de sortie et équipement), puis le gain mensuel s'ajoute. Au bout de ${pluriel(E.horizon, 'an')} : ${series.map((s) => `${esc(s.nom)} ${eur(s.valeurs[N], { signe: true })}`).join(' · ')}.</figcaption>
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
        const t = document.createElement('b'); t.textContent = i === 0 ? 'Aujourd\'hui' : `Dans ${R.duree(i)}`; bulle.appendChild(t);
        for (const s of [...G.series].sort((a, z) => z.valeurs[i] - a.valeurs[i])) {
          const l = document.createElement('div'); l.className = 'ligne-bulle';
          const k = document.createElement('i'); k.style.background = s.couleur; l.appendChild(k);
          const v = document.createElement('strong'); v.textContent = eur(s.valeurs[i], { signe: true }); l.appendChild(v);
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

  // ---------- Questionnaire ----------
  // Enregistré au fil de la saisie (aucune fenêtre) : chaque réponse ouvre ou ferme des champs.
  function vueQuestionnaire() {
    const f = E.foyer;
    const fa = R.faisabilite(B.faisabilite, E.reponses, foyerCalc());
    const enfants = f.enfants.length > 0;
    const pill3 = (q) => {
      const applicable = !q.condition || (q.condition === 'enfants' && enfants) || (q.condition === 'velo' && f.velo !== 'aucun');
      if (!applicable) return '';
      return `<li class="q-fais"><div><b>${esc(q.q)}</b>${q.bloquant ? ' <span class="etiquette rose">décisif</span>' : ''}<small>${esc(q.aide)}</small></div>
        <div class="choix-statut" role="radiogroup" aria-label="${esc(q.q)}">${[['oui', 'Oui'], ['non', 'Non'], ['so', 'Sans objet']].map(([k, l]) => `<label><input type="radio" name="rep-${q.id}" data-rep="${q.id}" value="${k}" ${E.reponses[q.id] === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></li>`;
    };
    const eq = f.equipementVelo;
    return `<div class="vue-tete"><div><h1>Questionnaire</h1><p>Tes réponses ouvrent les bons champs dans « Sans voiture », règlent les urgences qui te concernent et calculent le score de faisabilité. Tout s'enregistre au fil de la saisie.</p></div></div>
      <form id="form-q" class="form-q" novalidate>
        <section class="groupe-q"><h2 class="titre-section">Le foyer</h2>
          <div class="rang-champs">
            <label class="champ">Adultes<input name="adultes" type="number" min="1" max="10" value="${f.adultes}"></label>
            <label class="champ">Adultes qui conduisent<input name="conducteurs" type="number" min="0" max="10" value="${f.conducteurs}"></label>
            <label class="champ">Âge des enfants <small>« 4, 8 » ; vide si aucun.</small><input name="enfants" inputmode="numeric" value="${esc(f.enfants.join(', '))}" placeholder="Aucun"></label>
          </div>
        </section>
        <section class="groupe-q"><h2 class="titre-section">Le vélo</h2>
          <fieldset class="champ"><legend>As-tu un vélo&nbsp;?</legend>${radios('velo', [['electrique', 'Électrique'], ['classique', 'Classique'], ['aucun', 'Aucun']], f.velo)}</fieldset>
          ${f.velo !== 'aucun' ? `<label class="case"><input type="checkbox" name="veloQuotidien" ${f.veloQuotidien ? 'checked' : ''}> Je l'utilise déjà au quotidien</label>
          <fieldset class="champ"><legend>Équipement déjà présent</legend><div class="cases">${[['siege', 'Siège enfant homologué'], ['sacoches', 'Sacoches'], ['panier', 'Panier'], ['remorque', 'Remorque'], ['cargo', 'Vélo cargo']].map(([k, l]) => `<label class="case"><input type="checkbox" name="eq-${k}" ${eq[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>` : '<p class="aide">Sans vélo, son poste reste masqué dans « Sans voiture » ; tu peux y prévoir l\'achat d\'un vélo en choisissant un type ici.</p>'}
        </section>
        <section class="groupe-q"><h2 class="titre-section">Transports, travail, école</h2>
          <label class="case"><input type="checkbox" name="transports" ${f.transports ? 'checked' : ''}> Bus, tram, métro ou train régional utilisables près de chez moi</label>
          <div class="rang-champs">
            <label class="champ">Trajet domicile-travail sans voiture (minutes, porte à porte)<input name="dureeTrajet" type="number" min="0" max="600" value="${f.dureeTrajet || ''}" placeholder="Ex. : 30"></label>
            <label class="champ">Jours de télétravail par semaine<input name="teletravail" type="number" min="0" max="7" value="${f.teletravail}"></label>
          </div>
          <label class="champ">Service d'urgences de nuit <small>Distance ou temps de trajet, à ta façon (aucune adresse n'est demandée).</small><input name="urgencesNuit" maxlength="80" value="${esc(f.urgencesNuit)}" placeholder="Ex. : 15 minutes en taxi"></label>
        </section>
        <section class="groupe-q"><h2 class="titre-section">Tes usages de la voiture aujourd'hui <span>Servent à suggérer les jours de location</span></h2>
          <div class="rang-champs">
            <label class="champ">Départs en vacances par an<input name="vacances" type="number" min="0" max="52" value="${f.vacances}"></label>
            <label class="champ">Week-ends hors de la ville par an<input name="weekends" type="number" min="0" max="104" value="${f.weekends}"></label>
            <label class="champ">Gros achats, déchetterie par an<input name="grosAchats" type="number" min="0" max="365" value="${f.grosAchats}"></label>
          </div>
        </section>
        <section class="groupe-q"><h2 class="titre-section">Faisabilité <span>${fa.score === null ? 'Réponds pour obtenir un score' : `Score ${fa.score}/100`}${fa.verdict === 'bloquant' ? ' · bloquant' : ''}</span></h2>
          <p class="aide">Une réponse « non » à une question décisive bloque le verdict : règle-la avant de vendre (télétravail, autre trajet, autre école…).</p>
          <ul class="liste-fais">${B.faisabilite.map(pill3).join('')}</ul>
        </section>
      </form>
      <div class="rang" style="margin-top:20px"><button class="btn primaire" data-action="vue" data-vue="voiture">Continuer : ma voiture</button></div>
      ${AVERTISSEMENT}`;
  }

  function enregistrerQuestionnaire(el) {
    const f = E.foyer;
    if (el.dataset.rep) { E.reponses[el.dataset.rep] = el.value; E.questionnaireFait = true; sauver(); const t = $('.groupe-q:last-of-type .titre-section span'); const fa = R.faisabilite(B.faisabilite, E.reponses, foyerCalc()); if (t) t.textContent = `${fa.score === null ? 'Réponds pour obtenir un score' : `Score ${fa.score}/100`}${fa.verdict === 'bloquant' ? ' · bloquant' : ''}`; return; }
    const n = el.name;
    const nombres = { adultes: [1, 10], conducteurs: [0, 10], dureeTrajet: [0, 600], teletravail: [0, 7], vacances: [0, 52], weekends: [0, 104], grosAchats: [0, 365] };
    let rerendre = false;
    if (nombres[n]) { const v = R.lireEntier(el.value || '0', ...nombres[n]); if (v === null) return; f[n] = v; }
    else if (n === 'enfants') { const l = lireEnfants(el.value); if (l === null) return; rerendre = (l.length > 0) !== (f.enfants.length > 0); f.enfants = l; }
    else if (n === 'velo') { f.velo = el.value; rerendre = true; }
    else if (n === 'veloQuotidien' || n === 'transports') f[n] = el.checked;
    else if (n.startsWith('eq-')) f.equipementVelo[n.slice(3)] = el.checked;
    else if (n === 'urgencesNuit') f.urgencesNuit = el.value.slice(0, 80);
    else return;
    E.questionnaireFait = true;
    sauver();
    if (rerendre) { const y = window.scrollY; rendre(); window.scrollTo({ top: y }); }
  }

  // ---------- Champs génériques des fenêtres ----------
  // spec : [chemin, type, libellé, aide, options] ; types : e (euros), u (prix unitaire à 3 décimales),
  // d (décimal), t (taux %), n (entier), x (texte).
  function champ(spec, obj, defauts) {
    const [ch, type, lib, aide = '', o = {}] = spec;
    const v = lireChemin(obj, ch);
    const val = type === 'e' ? R.saisieMontant(v) : type === 'u' ? R.saisieUnitaire(v) : type === 'd' || type === 't' ? R.saisieDecimal(v) : v ?? '';
    const d = defauts ? lireChemin(defauts, ch) : undefined;
    const ex = d !== undefined && d === v && d ? ' <span class="etiquette jaune">exemple</span>' : '';
    const mode = type === 'n' ? 'numeric' : type === 'x' ? 'text' : 'decimal';
    return `<label class="champ">${lib}${ex}${aide ? ` <small>${aide}</small>` : ''}<input name="${ch}" inputmode="${mode}" autocomplete="off" value="${esc(val)}" placeholder="${esc(o.ph ?? (type === 'x' ? '' : '0'))}" ${type === 'x' ? 'maxlength="60"' : ''}></label>`;
  }
  const rang = (...h) => `<div class="rang-champs">${h.join('')}</div>`;
  function lireChamps(specs, fd, cible) {
    for (const [ch, type, lib, , o = {}] of specs) {
      if (!fd.has(ch)) continue;
      const brut = String(fd.get(ch) ?? '').trim();
      let v;
      if (type === 'x') v = brut.slice(0, 60);
      else if (!brut) v = 0;
      else if (type === 'e') v = R.lireMontant(brut);
      else if (type === 'u') v = R.lirePrixUnitaire(brut);
      else if (type === 'd') v = R.lireDecimal(brut, o.max ?? 100);
      else if (type === 't') v = R.lireTaux(brut);
      else if (type === 'n') v = R.lireEntier(brut, o.min ?? 0, o.max ?? 1e6);
      if (v === null) return `${lib.replace(/ \(.*\)$/, '')} : valeur illisible.`;
      ecrireChemin(cible, ch, v);
    }
    return null;
  }

  // ---------- Ma voiture ----------
  const SPEC_VOITURE_COMMUN = [
    ['assurance', 'e', 'Assurance (€ par an)'], ['entretien', 'e', 'Entretien et pneus (€ par an)'], ['controle', 'e', 'Contrôle technique lissé (€ par an)', 'Prix du contrôle divisé par le nombre d\'années entre deux.'],
    ['stationnement', 'e', 'Stationnement, garage (€ par an)'], ['peages', 'e', 'Péages (€ par an)'], ['divers', 'e', 'Lavage, amendes, divers (€ par an)'],
    ['carburantAn', 'e', 'Carburant ou recharge (€ par an)'], ['kmAn', 'n', 'Kilomètres par an', '', { max: 200000 }], ['conso', 'd', 'Consommation (aux 100 km)', 'Litres ou kWh.'], ['prixEnergie', 'u', 'Prix du litre ou du kWh (€)', 'Ex. : 1,85'],
  ];
  const SPEC_DETENTION = {
    achat: [['valeur', 'e', 'Valeur de revente estimée (€)', 'Ce que tu en tirerais aujourd\'hui.'], ['depreciation', 't', 'Perte de valeur (% par an)', 'Hypothèse, pas une cote.']],
    credit: [['valeur', 'e', 'Valeur de revente estimée (€)'], ['depreciation', 't', 'Perte de valeur (% par an)'], ['mensualite', 'e', 'Mensualité du crédit (€)'], ['moisRestants', 'n', 'Mensualités restantes', '', { max: 120 }], ['capitalRestant', 'e', 'Capital restant dû (€)', 'Sur ton tableau d\'amortissement ou ton espace en ligne.']],
    loa: [['loyer', 'e', 'Loyer mensuel (€)'], ['servicesMois', 'e', 'Services facultatifs (€ par mois)', 'Entretien, assistance… s\'ils sont en plus du loyer.'], ['loa.duree', 'n', 'Durée du contrat (mois)', '', { max: 120 }], ['loa.loyersPayes', 'n', 'Loyers déjà payés', 'Le premier loyer compte pour 1.', { max: 120 }], ['loa.option', 'e', 'Option d\'achat finale (€)'], ['loa.premierRachat', 'n', 'Premier rachat anticipé possible (après le loyer n°)', '', { max: 120 }], ['loa.prixVehicule', 'e', 'Prix du véhicule au contrat (€)', 'Pour un barème en % et le taux implicite.'], ['loa.premierLoyer', 'e', 'Premier loyer payé (€)', 'Déjà payé : n\'entre pas dans le gain, sert au taux implicite.'], ['valeur', 'e', 'Valeur de revente estimée aujourd\'hui (€)', 'Pour une revente après rachat.'], ['depreciation', 't', 'Perte de valeur (% par an)']],
    lld: [['loyer', 'e', 'Loyer mensuel (€)'], ['servicesMois', 'e', 'Services facultatifs (€ par mois)'], ['lld.duree', 'n', 'Durée du contrat (mois)', '', { max: 120 }], ['lld.loyersPayes', 'n', 'Loyers déjà payés', '', { max: 120 }]],
  };

  function vueVoiture() {
    const s = S(), v = s.voiture;
    const cv = R.coutVoiture(v);
    const x = calc(s);
    const dv = B.defauts.voiture;
    const lignesDet = [];
    if (v.detention === 'achat' || v.detention === 'credit' || v.detention === 'loa') lignesDet.push(['Valeur de revente estimée', `${v.valeur ? eur(v.valeur) : 'à saisir'}${exemple(v.valeur, dv.valeur)}`], ['Perte de valeur', `${R.pct(v.depreciation)} par an${exemple(v.depreciation, dv.depreciation)}`]);
    if (v.detention === 'credit') {
      const t = R.tauxImplicite(v.capitalRestant, v.mensualite, v.moisRestants);
      lignesDet.push(['Crédit', v.mensualite ? `${eur(v.mensualite, { centimes: true })} × ${v.moisRestants} mois` : 'à saisir'], ['Capital restant dû', eur(v.capitalRestant)], ['Taux implicite', t === null ? (v.mensualite ? 'incohérent : vérifie les montants' : '–') : `${R.pct(t)} par an`]);
    }
    if (v.detention === 'loa' || v.detention === 'lld') {
      const c = v[v.detention];
      lignesDet.push(['Loyer', v.loyer ? `${eur(v.loyer, { centimes: true })} par mois` : 'à saisir'], ['Contrat', c.duree ? `${c.loyersPayes} loyers payés sur ${c.duree}, ${pluriel(Math.max(0, c.duree - c.loyersPayes), 'mois restant', 'mois restants')}` : 'durée à saisir']);
      if (v.detention === 'loa') lignesDet.push(['Option finale', c.option ? eur(c.option) : '–'], ['Premier rachat possible', c.premierRachat ? `après le loyer ${c.premierRachat}` : 'non précisé']);
    }
    const postes = cv.postes.filter((p) => p[2] || ['assurance', 'carburant'].includes(p[0]));
    return `${selecteurScenarios()}
      <div class="vue-tete"><div><h1>Ma voiture</h1><p>Ce qu'elle coûte vraiment chaque année, et ce que coûte d'en sortir. Les montants marqués <span class="etiquette jaune">exemple</span> sont à remplacer par les tiens.</p></div>
        <div class="actions"><button class="btn primaire" data-action="modale-voiture">Modifier ma voiture</button><button class="btn" data-action="modale-sortie">Sortie de la voiture</button></div></div>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Détention <span>${esc(R.LIB_DETENTION[v.detention])}</span></h2>
          <dl class="cles">${lignesDet.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${val}</dd></div>`).join('')}</dl>
          ${v.detention === 'credit' ? '<p class="mention">Crédit : seuls les intérêts sont un coût ; la part de capital remboursée reste dans la valeur de la voiture, dont la baisse est déjà comptée.</p>' : ''}
          ${v.detention === 'loa' || v.detention === 'lld' ? '<p class="mention">Garder la voiture revient ici à continuer avec un contrat équivalent (mêmes loyers). Un paiement déjà fait (apport, premier loyer) n\'entre pas dans le calcul : il est le même quelle que soit la décision.</p>' : ''}
        </section>
        <section><h2 class="titre-section">Coût par an <span>${eur(cv.total)}</span></h2>
          <div class="bloc-detail">${postes.map(([k, lib, val]) => `<p class="ligne-somme"><span>${esc(lib)}${k === 'assurance' ? exemple(v.assurance, dv.assurance) : k === 'carburant' && v.carburantMode === 'km' ? exemple(v.prixEnergie, dv.prixEnergie) : ''}</span><b>${eur(val)}</b></p>`).join('')}
          <p class="ligne-somme total"><span>Total par an</span><b>${eur(cv.total)}</b></p><p class="ligne-somme"><span>Soit par mois</span><b>${eur(cv.total / 12)}</b></p></div>
        </section>
      </div>
      ${v.detention === 'loa' ? blocBareme(v) : ''}
      <h2 class="titre-section">Sortie de la voiture <span>${esc(R.LIB_SORTIE[s.sortie.mode])}</span></h2>
      ${blocSortie(s, x)}
      ${AVERTISSEMENT}`;
  }

  function blocBareme(v) {
    const L = v.loa;
    const am = R.amortissementLoa({ ...L, loyer: v.loyer });
    const tab = L.bareme.length ? `<div class="defile"><table class="tableau"><caption class="sr-only">Barème de rachat anticipé</caption><thead><tr><th scope="col">Après le loyer</th><th scope="col" class="nb">Rachat</th><th scope="col" class="nb">Valeur estimée alors</th></tr></thead><tbody>${L.bareme.map((l) => { const r = R.rachatAuBareme(L, l.loyer); const val = R.valeurFuture(v.valeur, v.depreciation, Math.max(0, l.loyer - L.loyersPayes)); return `<tr><td>${l.loyer}</td><td class="nb">${r === null ? '–' : eur(r)}</td><td class="nb">${eur(val)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="aide">Aucun barème saisi : reporte celui de ton contrat (montant de rachat après chaque loyer), pour calculer un rachat anticipé.</p>';
    return `<h2 class="titre-section">Barème de rachat anticipé <span>Saisi depuis ton contrat ; entre deux lignes, valeur interpolée</span></h2>
      ${tab}<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="modale-bareme">Saisir le barème</button></div>
      ${am ? `<div class="bloc-detail" style="margin-top:14px"><h3>Ce que cache la LOA <span>${am.taux === null ? 'taux non calculable' : `≈ ${R.pct(am.taux)} par an`}</span></h3>
        <p class="ligne-somme"><span>Premier loyer + loyers + option</span><b>${eur(am.total)}</b></p>
        <p class="ligne-somme"><span>Prix du véhicule au contrat</span><b>${eur(L.prixVehicule)}</b></p>
        <p class="ligne-somme total"><span>Surcoût par rapport au comptant</span><b>${eur(am.surcout)}</b></p>
        <p class="mention">Taux implicite : en assimilant la LOA à un prêt du prix (moins le premier loyer), remboursé par les loyers puis par l'option. Approximation : le contrat ne donne pas toujours ce taux, et les services sont exclus.</p></div>` : ''}`;
  }

  function blocSortie(s, x) {
    if (!x.complet) return `<p class="aide">À compléter : ${esc(x.manque.join(', '))}.</p>`;
    const so = x.sortie;
    const best = R.meilleureSortie(s, commun());
    return `<div class="colonnes-apercu">
      <section class="bloc-detail"><h3>${esc(R.libelleSortie(s.voiture, s.sortie, so))} <span>${eur(so.cout)}</span></h3>
        ${so.possible ? so.lignes.map(([lib, val]) => `<p class="ligne-somme"><span>${esc(lib)}</span><b>${eur(val)}</b></p>`).join('') : `<p class="alerte-sc alerte">${esc(so.raison)}</p>`}
        <p class="ligne-somme total"><span>Coût de sortie${so.cout < 0 ? ' (la sortie rapporte)' : ''}</span><b>${eur(so.cout)}</b></p>
        <p class="mention">${so.mois ? `Tant que la voiture reste (${esc(R.duree(so.mois))}), le gain ne commence pas.` : 'Sortie dès maintenant.'} Demande le montant exact au financeur avant de décider.</p></section>
      <section><h3 class="sous-titre">Comparer les moments de sortie</h3>
        <ul class="prochains">${best.essais.slice(0, 5).map((e, i) => `<li><span class="date-pastille"><b>${i + 1}</b>${i ? 'e' : 'er'}</span><span><b>${esc(e.lib)}</b><small class="discret"> · sortie ${eur(e.so.cout)}</small></span><span class="nb">${eur(e.cumulFin, { signe: true })}</span></li>`).join('') || '<li><span></span><span>Complète la voiture et la sortie.</span><span></span></li>'}</ul>
        <p class="mention">Gain cumulé à ${pluriel(E.horizon, 'an')} pour chaque sortie possible.</p></section></div>`;
  }

  function modaleVoiture() {
    const s = S(), v = s.voiture;
    const dv = B.defauts.voiture;
    const corps = `
      <fieldset class="champ"><legend>Mode de détention</legend><div class="choix-statut" style="grid-template-columns:repeat(4,minmax(0,1fr))">${R.DETENTIONS.map((k) => `<label><input type="radio" name="detention" value="${k}" ${v.detention === k ? 'checked' : ''}><span>${esc(R.LIB_DETENTION[k])}</span></label>`).join('')}</div></fieldset>
      ${R.DETENTIONS.map((k) => `<div class="champs-det" data-det="${k}" ${v.detention === k ? '' : 'hidden'}>${rang(...SPEC_DETENTION[k].map((sp) => champ(sp, v, dv)))}</div>`).join('')}
      <fieldset class="champ cadre-champs"><legend>Carburant ou recharge</legend>
        ${radios('carburantMode', [['km', 'Kilomètres × consommation × prix'], ['euros', 'Montant par an']], v.carburantMode)}
        <div class="champs-carb" data-carb="km" ${v.carburantMode === 'km' ? '' : 'hidden'}>${rang(champ(SPEC_VOITURE_COMMUN[7], v, dv), champ(SPEC_VOITURE_COMMUN[8], v, dv), champ(SPEC_VOITURE_COMMUN[9], v, dv))}</div>
        <div class="champs-carb" data-carb="euros" ${v.carburantMode === 'euros' ? '' : 'hidden'}>${champ(SPEC_VOITURE_COMMUN[6], v, dv)}</div>
      </fieldset>
      ${rang(...SPEC_VOITURE_COMMUN.slice(0, 3).map((sp) => champ(sp, v, dv)))}
      ${rang(...SPEC_VOITURE_COMMUN.slice(3, 6).map((sp) => champ(sp, v, dv)))}
      ${E.scenarios.length > 1 ? '<label class="case"><input type="checkbox" name="tous"> Appliquer ces coûts courants (assurance, entretien, carburant…) à tous les scénarios</label>' : ''}
      <p class="apercu" id="apercu" aria-live="polite"></p><p class="erreur" role="alert"></p>`;
    ouvrirModale('Ma voiture', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const r = lireVoiture(fd, v);
      if (typeof r === 'string') return r;
      retenir();
      const avant = s.voiture.detention;
      s.voiture = r;
      if (avant !== r.detention) s.sortie = R.normaliserSortie(s.sortie, r.detention, B.defauts.sortie);
      if (fd.get('tous')) for (const autre of E.scenarios) if (autre !== s) for (const k of ['assurance', 'entretien', 'controle', 'stationnement', 'peages', 'divers', 'carburantMode', 'carburantAn', 'kmAn', 'conso', 'prixEnergie']) autre.voiture[k] = r[k];
      sauver(); rendre();
      toast(`Voiture enregistrée : ${eur(R.coutVoiture(r).total)} par an.`, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const maj = () => {
      const det = f.querySelector('[name=detention]:checked')?.value;
      f.querySelectorAll('.champs-det').forEach((d) => { d.hidden = d.dataset.det !== det; });
      const cm = f.querySelector('[name=carburantMode]:checked')?.value;
      f.querySelectorAll('.champs-carb').forEach((d) => { d.hidden = d.dataset.carb !== cm; });
      const r = lireVoiture(new FormData(f), v);
      $('#apercu').innerHTML = typeof r === 'string' ? '' : `Coût par an : <b>${eur(R.coutVoiture(r).total)}</b> · carburant ${eur(R.carburantAn(r))}`;
    };
    f.addEventListener('input', maj); f.addEventListener('change', maj); maj();
  }
  function lireVoiture(fd, v) {
    const c = structuredClone(v);
    c.detention = fd.get('detention') || v.detention;
    c.carburantMode = fd.get('carburantMode') || v.carburantMode;
    // Seuls les champs visibles du mode choisi sont lus (les autres gardent leur valeur).
    const specs = [...SPEC_DETENTION[c.detention], ...SPEC_VOITURE_COMMUN];
    const visibles = new FormData();
    for (const [k, val] of fd.entries()) visibles.append(k, val);
    for (const [k, l] of Object.entries(SPEC_DETENTION)) if (k !== c.detention) for (const [ch] of l) if (!SPEC_DETENTION[c.detention].some((x) => x[0] === ch)) visibles.delete(ch);
    const err = lireChamps(specs, visibles, c);
    if (err) return err;
    return R.normaliserVoiture(c, {});
  }

  function modaleBareme() {
    const s = S(), L = s.voiture.loa;
    const lignes = L.bareme.length ? L.bareme : [{ loyer: Math.max(L.premierRachat || 12, 1), valeur: 0 }];
    const ligneHtml = (l) => `<div class="rang-champs ligne-bareme"><label class="champ">Après le loyer n°<input name="b-loyer" inputmode="numeric" value="${l.loyer || ''}"></label><label class="champ">Rachat<input name="b-valeur" inputmode="decimal" value="${l.valeur ? (L.unite === 'pct' ? R.saisieDecimal(l.valeur) : R.saisieMontant(l.valeur)) : ''}" placeholder="${L.unite === 'pct' ? '% du prix' : '€'}"></label></div>`;
    const corps = `<p class="mention">Recopie le tableau de rachat anticipé de ton contrat : le montant (ou le % du prix du véhicule) après certains loyers. Entre deux lignes, le simulateur interpole.</p>
      <fieldset class="champ"><legend>Unité</legend>${radios('unite', [['montant', 'Montant en €'], ['pct', '% du prix du véhicule']], L.unite)}</fieldset>
      <div id="lignes-bareme">${lignes.map(ligneHtml).join('')}</div>
      <div class="rang"><button class="btn petit" type="button" data-action="ligne-bareme">${ICONES.plus}Ajouter une ligne</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Barème de rachat', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const unite = fd.get('unite') === 'pct' ? 'pct' : 'montant';
      const ls = fd.getAll('b-loyer'), vs = fd.getAll('b-valeur');
      const bareme = [];
      for (let i = 0; i < ls.length; i++) {
        if (!String(ls[i]).trim() && !String(vs[i]).trim()) continue;
        const n = R.lireEntier(ls[i], 0, 120);
        const val = unite === 'pct' ? R.lireDecimal(vs[i], 100) : R.lireMontant(vs[i]);
        if (n === null || val === null || !val) return `Ligne ${i + 1} : numéro de loyer ou montant illisible.`;
        bareme.push({ loyer: n, valeur: val });
      }
      if (unite === 'pct' && bareme.length && !(L.prixVehicule > 0)) return 'Un barème en % a besoin du prix du véhicule au contrat (Modifier ma voiture).';
      retenir();
      L.unite = unite; L.bareme = bareme.sort((a, b) => a.loyer - b.loyer);
      sauver(); rendre(); toast(`Barème enregistré : ${pluriel(bareme.length, 'ligne')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleSortie() {
    const s = S(), v = s.voiture, so = s.sortie;
    const modes = R.SORTIES[v.detention];
    const ds = B.defauts.sortie;
    const bloc = (mode, html) => `<div class="champs-sortie" data-mode="${mode}" ${so.mode === mode ? '' : 'hidden'}>${html}</div>`;
    const revente = `${radios('canal', [['particulier', 'À un particulier'], ['professionnel', 'À un professionnel']], so.canal)}${rang(champ(['ecartParticulier', 't', 'Écart de prix, particulier (%)', 'Par rapport à la valeur estimée.'], so, ds), champ(['ecartPro', 't', 'Écart de prix, professionnel (%)', 'Reprise souvent plus basse.'], so, ds))}${champ(['frais', 'e', 'Frais de vente (€)', 'Annonce, contrôle technique, petites réparations.'], so, ds)}`;
    const corps = `
      ${modes.length > 1 ? `<fieldset class="champ"><legend>Façon de sortir</legend><div class="choix-statut" style="grid-template-columns:1fr">${modes.map((k) => `<label><input type="radio" name="mode" value="${k}" ${so.mode === k ? 'checked' : ''}><span>${esc(R.LIB_SORTIE[k])}</span></label>`).join('')}</div></fieldset>` : `<input type="hidden" name="mode" value="${modes[0]}">`}
      ${bloc('vente', `${rang(champ(['delai', 'n', 'Vendre dans (mois)', '0 : maintenant.', { max: 120 }], so), champ(['remise', 't', 'Remise de négociation (%)', 'Sur la valeur estimée.'], so, ds))}${champ(['frais', 'e', 'Frais de vente (€)'], so, ds)}`)}
      ${bloc('rachat-revente', `${champ(['loyerSortie', 'n', 'Racheter après le loyer n°', `Au plus tôt le loyer ${Math.max(v.loa.loyersPayes, v.loa.premierRachat || 0)}.`, { max: 120 }], so)}${revente}`)}
      ${bloc('option-finale', revente)}
      ${bloc('restitution', `${rang(champ(['remiseEnEtat', 'e', 'Frais de remise en état (€)'], so), champ(['kmSup', 'n', 'Kilomètres au-delà du forfait', 'Sur tout le contrat.', { max: 500000 }], so), champ(['prixKmSup', 'u', 'Prix du km en plus (€)'], so))}`)}
      ${bloc('restitution-anticipee', `${champ(['delai', 'n', 'Rendre dans (mois)', '0 : maintenant.', { max: 120 }], so)}${radios('indemniteMode', [['pct', '% des loyers restants'], ['montant', 'Montant saisi']], so.indemniteMode)}${rang(champ(['indemnitePct', 't', 'Indemnité (% des loyers restants)', 'Selon ton contrat.'], so, ds), champ(['indemnite', 'e', 'Indemnité (€)'], so))}${champ(['remiseEnEtat', 'e', 'Frais de remise en état (€)'], so)}`)}
      ${bloc('fin-contrat', `${rang(champ(['remiseEnEtat', 'e', 'Frais de remise en état (€)'], so), champ(['kmSup', 'n', 'Kilomètres au-delà du forfait', '', { max: 500000 }], so), champ(['prixKmSup', 'u', 'Prix du km en plus (€)'], so))}`)}
      <p class="mention">Un paiement déjà fait (apport, premier loyer) n'entre pas dans le calcul : il est le même quelle que soit la décision. Le contrat et le financeur font foi.</p>
      <p class="apercu" id="apercu" aria-live="polite"></p><p class="erreur" role="alert"></p>`;
    ouvrirModale('Sortie de la voiture', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const r = lireSortie(fd, s);
      if (typeof r === 'string') return r;
      retenir(); s.sortie = r; sauver(); rendre();
      const so2 = R.sortie(s.voiture, r);
      toast(so2.possible ? `Sortie : ${R.libelleSortie(s.voiture, r, so2)}, coût ${eur(so2.cout)}.` : so2.raison, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const maj = () => {
      const m = f.querySelector('[name=mode]:checked, [name=mode][type=hidden]')?.value;
      f.querySelectorAll('.champs-sortie').forEach((d) => { d.hidden = d.dataset.mode !== m; d.querySelectorAll('input').forEach((i) => { i.disabled = d.hidden; }); });
      const r = lireSortie(new FormData(f), s);
      if (typeof r === 'string') { $('#apercu').textContent = ''; return; }
      const so2 = R.sortie(s.voiture, r);
      $('#apercu').innerHTML = so2.possible ? `${esc(R.libelleSortie(s.voiture, r, so2))} : coût de sortie <b>${eur(so2.cout)}</b>` : esc(so2.raison);
    };
    f.addEventListener('input', maj); f.addEventListener('change', maj); maj();
  }
  function lireSortie(fd, s) {
    const c = structuredClone(s.sortie);
    c.mode = fd.get('mode') || c.mode;
    if (fd.get('canal')) c.canal = fd.get('canal');
    if (fd.get('indemniteMode')) c.indemniteMode = fd.get('indemniteMode');
    const specs = [['delai', 'n', 'Délai', '', { max: 120 }], ['remise', 't', 'Remise'], ['frais', 'e', 'Frais de vente'], ['loyerSortie', 'n', 'Loyer de rachat', '', { max: 120 }], ['ecartParticulier', 't', 'Écart particulier'], ['ecartPro', 't', 'Écart professionnel'], ['remiseEnEtat', 'e', 'Remise en état'], ['kmSup', 'n', 'Kilomètres en plus', '', { max: 500000 }], ['prixKmSup', 'u', 'Prix du km'], ['indemnitePct', 't', 'Indemnité'], ['indemnite', 'e', 'Indemnité']];
    const err = lireChamps(specs, fd, c);
    if (err) return err;
    return R.normaliserSortie(c, s.voiture.detention, {});
  }

  // ---------- Sans voiture ----------
  // Groupes de postes ; « visible » dépend du questionnaire, sauf si un montant est déjà saisi.
  const GROUPES = [
    { id: 'transports', titre: 'Transports en commun', poste: ['transports'], visible: (f) => f.transports, specs: [['transports.abonnes', 'n', 'Adultes abonnés', '', { max: 10 }], ['transports.prixAbonnement', 'e', 'Abonnement mensuel par adulte (€)'], ['transports.partEmployeur', 't', 'Part remboursée par l\'employeur (%)'], ['transports.enfants', 'e', 'Enfants (€ par an)'], ['transports.tickets', 'e', 'Tickets occasionnels (€ par an)'], ['transports.deja', 'e', 'Déjà payé aujourd\'hui (€ par an)', 'Dépense que tu as déjà avec la voiture : déduite.']] },
    { id: 'velo', titre: 'Vélo', poste: ['velo'], visible: (f) => f.velo !== 'aucun', specs: [['velo.achat', 'e', 'Achat d\'un vélo (€)', '0 si tu en as déjà un.'], ['velo.aides', 'e', 'Aides déduites (€)', 'Celles auxquelles tu as droit, saisies par toi.'], ['velo.dureeAns', 'n', 'Durée d\'amortissement (ans)', '', { max: 30 }], ['velo.entretien', 'e', 'Entretien (€ par an)'], ['velo.assurance', 'e', 'Assurance vol (€ par an)'], ['velo.deja', 'e', 'Déjà payé aujourd\'hui (€ par an)', 'Entretien ou assurance que tu paies déjà : déduit.']] },
    { id: 'location', titre: 'Location de voiture', poste: ['location', 'carburantLocation'], visible: () => true, specs: [['joursLocation', 'n', 'Jours isolés par an', '', { max: 366 }], ['prixJour', 'e', 'Prix par jour (€)'], ['semainesLocation', 'n', 'Semaines par an', '', { max: 52 }], ['prixSemaine', 'e', 'Prix par semaine (€)'], ['franchiseJour', 'e', 'Rachat de franchise (€ par jour loué)'], ['kmLocation', 'n', 'Kilomètres faits en location par an', '', { max: 200000 }], ['prixKmLocation', 'u', 'Carburant ou recharge par km (€)', 'Ex. : 0,12']] },
    { id: 'autopartage', titre: 'Autopartage', poste: ['autopartage'], visible: () => true, specs: [['autopartage.abonnement', 'e', 'Abonnement (€ par an)'], ['autopartage.heures', 'n', 'Heures par an', '', { max: 8760 }], ['autopartage.prixHeure', 'e', 'Prix de l\'heure (€)'], ['autopartage.km', 'n', 'Kilomètres par an', '', { max: 100000 }], ['autopartage.prixKm', 'u', 'Prix du km (€)']] },
    { id: 'divers', titre: 'Taxis, train, livraisons', poste: ['taxis', 'train', 'livraisons'], visible: () => true, specs: [['taxis', 'n', 'Taxis ou VTC par an', '', { max: 1000 }], ['prixTaxi', 'e', 'Prix moyen d\'une course (€)'], ['train', 'e', 'Surcoût de train (€ par an)', 'Trajets faits avant en voiture.'], ['livraisons', 'n', 'Livraisons de courses par an', '', { max: 1000 }], ['prixLivraison', 'e', 'Prix d\'une livraison (€)']] },
  ];

  function vueSans() {
    const s = S(), r = s.remplacement;
    const cs = R.coutSansVoiture(r, { urgences: R.coutUrgences(E.urgences) });
    const f = E.foyer;
    const dr = B.defauts.remplacement;
    const valPoste = (k) => cs.postes.filter((p) => k.includes(p[0])).reduce((t, p) => t + p[2], 0);
    const visibles = GROUPES.filter((g) => g.visible(f) || valPoste(g.poste) > 0);
    const masques = GROUPES.filter((g) => !visibles.includes(g));
    const sugJours = f.weekends * 2 + Math.ceil(f.grosAchats / 2), sugSem = f.vacances;
    const carte = (g) => {
      const total = valPoste(g.poste);
      const lignes = g.specs.filter(([ch]) => lireChemin(r, ch)).map(([ch, type, lib]) => {
        const v = lireChemin(r, ch), d = lireChemin(dr, ch);
        return `<div><dt>${esc(lib.replace(/ \(.*\)$/, ''))}</dt><dd>${type === 'e' ? eur(v) : type === 'u' ? `${R.saisieUnitaire(v)} €` : type === 't' ? R.pct(v) : esc(R.milliers(v))}${exemple(v, d)}</dd></div>`;
      }).join('');
      const sug = g.id === 'location' && E.questionnaireFait && (sugJours !== r.joursLocation || sugSem !== r.semainesLocation) && (sugJours || sugSem) ? `<p class="alerte-sc info">D'après le questionnaire : environ ${sugJours} jours isolés (2 par week-end, 1 pour 2 gros achats) et ${pluriel(sugSem, 'semaine')}. <button class="btn lien" data-action="suggestion-location">Appliquer</button></p>` : '';
      return `<article class="carte-sc" style="--c:${R.COULEUR_SANS}"><div class="carte-tete"><div><b>${esc(g.titre)}</b><small>${eur(total)} par an</small></div></div>
        ${lignes ? `<dl class="cles">${lignes}</dl>` : '<p class="aide">Rien de saisi.</p>'}${sug}
        <div class="carte-pied"><span class="net"><b>${eur(total)}</b><small>par an</small></span><span class="rang">${g.id === 'location' ? `<button class="btn petit" data-action="profil-location">Profil</button>` : ''}<button class="btn petit" data-action="groupe" data-id="${g.id}">Modifier</button></span></div></article>`;
    };
    const lignesLibres = (cle, titre, aide) => `<article class="carte-sc" style="--c:${R.COULEUR_SANS}"><div class="carte-tete"><div><b>${titre}</b><small>${aide}</small></div></div>
      ${r[cle].length ? `<dl class="cles">${r[cle].map((x) => `<div><dt>${esc(x.libelle || 'Sans nom')}</dt><dd>${eur(x.montant)}</dd></div>`).join('')}</dl>` : '<p class="aide">Aucune ligne.</p>'}
      <div class="carte-pied"><span class="net"><b>${eur(r[cle].reduce((t, x) => t + x.montant, 0))}</b><small>${cle === 'equipement' ? 'une fois' : 'par an'}</small></span><span class="rang"><button class="btn petit" data-action="lignes" data-id="${cle}">Modifier</button></span></div></article>`;
    const urg = R.coutUrgences(E.urgences);
    return `${selecteurScenarios()}
      <div class="vue-tete"><div><h1>Sans voiture</h1><p>Ce que coûtent les solutions de remplacement, par an. Seules les dépenses nouvelles comptent : ce que tu paies déjà aujourd'hui se déduit. Montants <span class="etiquette jaune">exemple</span> à remplacer.</p></div></div>
      <div class="resume-facture" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:18px">
        <div><span>Sans voiture</span><b>${eur(cs.total)}</b><small>par an, soit ${eur(cs.total / 12)} par mois</small></div>
        <div><span>Jours de location</span><b>${cs.joursLoues}</b><small>par an, semaines comprises</small></div>
        <div><span>Équipement</span><b>${eur(R.equipementUnique(r))}</b><small>acheté une fois, à la sortie</small></div>
      </div>
      <div class="grille-sc">${visibles.map(carte).join('')}${lignesLibres('autres', 'Autres dépenses', 'Par an : ce qui manque ailleurs')}${lignesLibres('equipement', 'Équipement acheté une fois', 'Rehausseur pliable, cape, antivols…')}</div>
      ${urg ? `<p class="mention" style="margin-top:12px">Les coûts saisis pour les parades d'urgence (${eur(urg)} par an) s'ajoutent, onglet Urgences.</p>` : ''}
      ${masques.length ? `<p class="aide" style="margin-top:14px">Masqués par le questionnaire : ${masques.map((g) => `<button class="btn lien" data-action="groupe" data-id="${g.id}">${esc(g.titre)}</button>`).join(', ')}.</p>` : ''}
      <h2 class="titre-section">Temps <span>Facultatif : ${E.temps.valeurHeure > 0 && E.temps.minutes ? `${E.temps.minutes} minutes par jour ouvré, ${eur(R.coutTemps(E.temps))} par an` : 'non compté'}</span></h2>
      <div class="rang"><button class="btn" data-action="hypotheses">Régler le temps et l'horizon</button></div>
      ${AVERTISSEMENT}`;
  }

  function modaleGroupe(id) {
    const g = GROUPES.find((x) => x.id === id);
    if (!g) return;
    const s = S(), r = s.remplacement;
    const corps = `${rang(...g.specs.map((sp) => champ(sp, r, B.defauts.remplacement)))}
      ${E.scenarios.length > 1 ? '<label class="case"><input type="checkbox" name="tous"> Appliquer à tous les scénarios</label>' : ''}
      <p class="apercu" id="apercu" aria-live="polite"></p><p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(g.titre), corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const c = structuredClone(r);
      const err = lireChamps(g.specs, fd, c);
      if (err) return err;
      retenir();
      const cibles = fd.get('tous') ? E.scenarios : [s];
      for (const sc of cibles) { for (const [ch] of g.specs) ecrireChemin(sc.remplacement, ch, lireChemin(c, ch)); sc.remplacement = R.normaliserRemplacement(sc.remplacement, {}); }
      sauver(); rendre(); toast(`${g.titre} : enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const maj = () => { const c = structuredClone(r); if (lireChamps(g.specs, new FormData(f), c)) return; const cs = R.coutSansVoiture(R.normaliserRemplacement(c, {})); $('#apercu').innerHTML = `${esc(g.titre)} : <b>${eur(cs.postes.filter((p) => g.poste.includes(p[0])).reduce((t, p) => t + p[2], 0))}</b> par an`; };
    f.addEventListener('input', maj); maj();
  }

  function modaleLignes(cle) {
    const s = S(), l = s.remplacement[cle];
    const ligne = (x = {}) => `<div class="rang-champs ligne-libre"><label class="champ">Libellé<input name="l-lib" maxlength="60" value="${esc(x.libelle || '')}"></label><label class="champ">Montant (€${cle === 'equipement' ? '' : ' par an'})<input name="l-mt" inputmode="decimal" value="${esc(R.saisieMontant(x.montant || 0) === '0' ? '' : R.saisieMontant(x.montant))}"></label></div>`;
    const sug = cle === 'equipement' ? `<p class="mention">Idées : ${B.equipement.map((e) => esc(e[1])).join(', ')}.</p>` : '<p class="mention">Par exemple une petite voiture d\'occasion gardée en plus, une carte de réduction, un parking vélo.</p>';
    ouvrirModale(cle === 'equipement' ? 'Équipement acheté une fois' : 'Autres dépenses par an', `${sug}<div id="lignes-libres">${(l.length ? l : [{}]).map(ligne).join('')}</div><div class="rang"><button class="btn petit" type="button" data-action="ligne-libre">${ICONES.plus}Ajouter une ligne</button></div><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
        const libs = fd.getAll('l-lib'), mts = fd.getAll('l-mt');
        const res = [];
        for (let i = 0; i < libs.length; i++) {
          if (!String(libs[i]).trim() && !String(mts[i]).trim()) continue;
          const m = String(mts[i]).trim() ? R.lireMontant(mts[i]) : 0;
          if (m === null) return `Ligne ${i + 1} : montant illisible.`;
          res.push({ id: uid(), libelle: String(libs[i]).trim().slice(0, 60), montant: m });
        }
        retenir(); s.remplacement[cle] = res; sauver(); rendre(); toast('Lignes enregistrées.', { libelle: 'Annuler', faire: annuler });
      });
  }

  function modaleProfilLocation() {
    ouvrirModale('Profil de location', `<p>Remplit les jours et semaines de location ; les prix restent les tiens.</p><div class="types-choix">${B.profilsLocation.map(([id, nom, phrase, v]) => `<button type="button" class="type-carte bouton" data-action="appliquer-profil" data-id="${id}"><span><b>${esc(nom)} · ${v.joursLocation} jours, ${pluriel(v.semainesLocation, 'semaine')}</b><small>${esc(phrase)}</small></span></button>`).join('')}</div>`, '<button class="btn primaire" value="annuler">Annuler</button>');
  }
  function appliquerLocation(jours, semaines) {
    retenir();
    Object.assign(S().remplacement, { joursLocation: jours, semainesLocation: semaines });
    if (modale().open) modale().close();
    sauver(); rendre(); toast(`Location : ${jours} jours et ${pluriel(semaines, 'semaine')} par an.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Urgences et organisation ----------
  function carteUrgence(u, court = false) {
    const st = E.urgences[u.id] || { statut: 'a-prevoir', cout: 0, note: '' };
    const [teinte, lib] = GRAVITE[u.gravite];
    const couvert = st.statut === 'couvert';
    return `<li class="carte-urgence ${couvert ? 'couverte' : ''}" data-gravite="${u.gravite}">
      <div class="urg-tete"><b>${esc(u.titre)}</b><span class="etiquette ${teinte}">${lib}</span>${couvert ? '<span class="etiquette vert">Couvert</span>' : ''}</div>
      <p><b>Parade :</b> ${esc(u.solution)}</p>
      ${court ? '' : `<p><b>Plan B :</b> ${esc(u.planB)}</p>${u.enfant && E.foyer.enfants.length ? `<p class="mention">${esc(u.enfant)}</p>` : ''}`}
      ${st.note ? `<p class="mention">Ma note : ${esc(st.note)}</p>` : ''}
      <div class="carte-pied"><span class="net"><small>${st.cout ? `${eur(st.cout)} par an prévus` : 'aucun coût saisi'}</small></span><span class="rang"><button class="btn petit ${couvert ? '' : 'primaire'}" data-action="couvrir" data-id="${u.id}">${couvert ? 'Remettre à prévoir' : 'Marquer couvert'}</button>${court ? '' : `<button class="btn petit" data-action="urgence" data-id="${u.id}">Coût et note</button>`}</span></div></li>`;
  }

  function vueUrgences() {
    const fo = foyerCalc();
    const applicable = (cond) => !cond || (cond === 'enfants' && fo.enfants.length > 0) || (cond === 'velo' && fo.velo !== 'aucun') || (cond === 'contrat' && fo.contrat);
    const urg = B.urgences.filter((u) => applicable(u.condition));
    const ouvertes = R.urgencesOuvertes(B.urgences, E.urgences, fo);
    const triees = [...ouvertes, ...urg.filter((u) => !ouvertes.includes(u))];
    const eq = B.equipement.filter(([, , c]) => applicable(c));
    const test = R.bilanTest(E.test, calc(S()).complet ? calc(S()).sans.total : null);
    const etatEq = (id) => E.equipementOk[id] || '';
    const semaine = E.semaine || B.semaine;
    return `<div class="vue-tete"><div><h1>Urgences et organisation</h1><p>Pour chaque situation où la voiture manquerait : une parade et un plan B. Coche « couvert » quand la parade est en place. ${pluriel(ouvertes.length, 'situation')} encore à prévoir.</p></div></div>
      <div class="a-completer" style="background:var(--rose);color:var(--rose-texte)"><b>Urgence vitale : 15 (Samu) ou 112 (numéro d'urgence européen, joignable depuis un portable).</b><span>17 police, 18 pompiers, 114 pour les personnes sourdes ou malentendantes ; médecin de garde : 116 117 ou 15 selon la région. Source : service-public.gouv.fr. Ces repères ne sont pas un avis médical.</span>${E.foyer.urgencesNuit ? `<span>Service d'urgences de nuit : ${esc(E.foyer.urgencesNuit)}.</span>` : ''}</div>
      <h2 class="titre-section">Cas d'urgence et parades <span>Les plus graves d'abord</span></h2>
      <ul class="urgences-liste">${triees.map((u) => carteUrgence(u)).join('')}</ul>
      <h2 class="titre-section">Cas du quotidien <span>${B.quotidien.filter((_, i) => E.quotidien[i]).length} sur ${B.quotidien.length} réglés</span></h2>
      <ul class="questions">${B.quotidien.map(([t, d], i) => `<li><label class="case-q"><input type="checkbox" data-coche="quotidien" data-id="${i}" ${E.quotidien[i] ? 'checked' : ''}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label></li>`).join('')}</ul>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Équipement</h2>
          <ul class="prochains">${eq.map(([id, lib]) => `<li><span></span><span>${esc(lib)}</span><span class="choix-mini">${[['en-place', 'En place'], ['a-acheter', 'À acheter']].map(([k, l]) => `<button class="btn petit ${etatEq(id) === k ? 'primaire' : ''}" data-action="equipement" data-id="${id}" data-etat="${k}" aria-pressed="${etatEq(id) === k}">${l}</button>`).join('')}</span></li>`).join('')}</ul>
          <p class="mention">Les prix se saisissent dans Sans voiture, « Équipement acheté une fois ».</p></section>
        <section><h2 class="titre-section">Avant de vendre</h2>
          <ul class="questions">${B.comptes.map(([id, lib]) => `<li><label class="case-q"><input type="checkbox" data-coche="comptes" data-id="${id}" ${E.comptes[id] ? 'checked' : ''}><span><b>${esc(lib)}</b></span></label></li>`).join('')}</ul>
          <h2 class="titre-section">Calendrier des réservations</h2>
          <ul class="questions">${B.calendrier.map(([id, quand, quoi]) => `<li><label class="case-q"><input type="checkbox" data-coche="calendrier" data-id="${id}" ${E.calendrier[id] ? 'checked' : ''}><span><b>${esc(quand)}</b><small>${esc(quoi)}</small></span></label></li>`).join('')}</ul></section>
      </div>
      <h2 class="titre-section">Semaine type <span>Qui va où, et comment</span></h2>
      <ol class="conseils">${semaine.map((j) => `<li><span>${esc(j)}</span></li>`).join('')}</ol>
      <div class="rang" style="margin-top:10px"><button class="btn petit" data-action="semaine">Modifier la semaine type</button></div>
      <h2 class="titre-section">Phase de test <span>Vivre sans la voiture avant de la vendre</span></h2>
      <ol class="conseils">${B.etapesTest.map((t) => `<li><span>${esc(t)}</span></li>`).join('')}</ol>
      ${blocTest(test)}
      ${AVERTISSEMENT}`;
  }

  function blocTest(b) {
    const t = E.test;
    if (!t.debut) return '<div class="rang" style="margin-top:12px"><button class="btn primaire" data-action="test-debut">Commencer la phase de test aujourd\'hui</button></div>';
    const prevu = calc(S()).complet ? calc(S()).sans.total : null;
    return `<div class="resume-facture" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-top:14px">
        <div><span>Depuis</span><b>${esc(dateCourte(t.debut))}</b><small>${pluriel(b.jours, 'jour')} · ${b.termine ? 'durée prévue atteinte : décide' : `fin prévue le ${esc(b.finPrevue.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}`}</small></div>
        <div><span>Dépensé</span><b>${eur(b.depenses)}</b><small>${pluriel(b.nb, 'dépense notée', 'dépenses notées')}</small></div>
        <div><span>Ramené à l'année</span><b>${eur(b.parAn)}</b><small>${prevu === null ? '' : `prévu ${eur(prevu)} · ${b.ecart > 0 ? `${eur(b.ecart)} de plus` : `${eur(-b.ecart)} de moins`}`}</small></div>
      </div>
      <p class="mention">Les transports et le vélo payés chaque mois ne sont pas à noter s'ils sont déjà dans le coût prévu ; sur peu de jours, l'extrapolation à l'année est fragile.</p>
      <div class="rang" style="margin-top:10px"><button class="btn primaire petit" data-action="depense-test">${ICONES.plus}Noter une dépense</button><button class="btn petit" data-action="test-reglages">Dates de la phase</button></div>
      ${t.journal.length ? `<div class="defile" style="margin-top:12px"><table class="tableau"><caption class="sr-only">Dépenses de la phase de test</caption><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Note</th><th scope="col" class="nb">Montant</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${t.journal.slice().sort((a, z) => z.date.localeCompare(a.date)).map((j) => `<tr><td>${esc(dateCourte(j.date))}</td><td>${esc(B.typesTest[j.type])}</td><td>${esc(j.note)}</td><td class="nb">${eur(j.montant, { centimes: true })}</td><td><button class="btn lien" data-action="suppr-depense" data-id="${j.id}">Retirer</button></td></tr>`).join('')}</tbody></table></div>` : ''}`;
  }

  function modaleUrgence(id) {
    const u = B.urgences.find((x) => x.id === id);
    if (!u) return;
    const st = E.urgences[id] || { statut: 'a-prevoir', cout: 0, note: '' };
    ouvrirModale(esc(u.titre), `<p><b>Parade :</b> ${esc(u.solution)}</p><p><b>Plan B :</b> ${esc(u.planB)}</p>
      <fieldset class="champ"><legend>Statut</legend>${radios('statut', [['couvert', 'Couvert'], ['a-prevoir', 'À prévoir']], st.statut)}</fieldset>
      <label class="champ">Coût indicatif (€ par an) <small>Ex. : deux taxis de nuit. Ajouté au coût sans voiture.</small><input name="cout" inputmode="decimal" value="${esc(st.cout ? R.saisieMontant(st.cout) : '')}" placeholder="0"></label>
      <label class="champ">Note <small>Ta parade concrète : numéro, personne, matériel.</small><input name="note" maxlength="200" value="${esc(st.note)}"></label><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const cout = String(fd.get('cout') || '').trim() ? R.lireMontant(fd.get('cout')) : 0;
      if (cout === null) return 'Coût illisible : écris par exemple 40.';
      retenir();
      E.urgences[id] = { statut: fd.get('statut') === 'couvert' ? 'couvert' : 'a-prevoir', cout, note: String(fd.get('note') || '').trim().slice(0, 200) };
      sauver(); rendre(); toast('Urgence enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }
  function couvrir(id) {
    retenir();
    const st = E.urgences[id] || { statut: 'a-prevoir', cout: 0, note: '' };
    st.statut = st.statut === 'couvert' ? 'a-prevoir' : 'couvert';
    E.urgences[id] = st;
    sauver(); const y = window.scrollY; rendre(); window.scrollTo({ top: y });
    toast(st.statut === 'couvert' ? 'Parade en place : situation couverte.' : 'Situation remise à prévoir.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleSemaine() {
    const sem = E.semaine || B.semaine;
    ouvrirModale('Semaine type', `${sem.map((j, i) => `<label class="champ">${['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i]}<input name="j${i}" maxlength="160" value="${esc(j)}"></label>`).join('')}`,
      '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" value="defaut">Revenir à l\'exemple</button>', (fd, action) => {
        retenir();
        E.semaine = action === 'defaut' ? null : sem.map((_, i) => String(fd.get(`j${i}`) || '').trim().slice(0, 160));
        sauver(); rendre(); toast('Semaine type enregistrée.', { libelle: 'Annuler', faire: annuler });
      });
  }
  function modaleDepense() {
    ouvrirModale('Noter une dépense', `${rang(`<label class="champ">Date<input name="date" type="date" value="${aujIso()}"></label>`, `<label class="champ">Type<select name="type">${Object.entries(B.typesTest).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>`)}
      ${rang('<label class="champ">Montant (€)<input name="montant" inputmode="decimal" placeholder="Ex. : 45"></label>', '<label class="champ">Note <small>Facultative.</small><input name="note" maxlength="120"></label>')}<p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const m = R.lireMontant(fd.get('montant'));
      if (!m) return 'Montant illisible : écris par exemple 45.';
      const date = String(fd.get('date') || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date illisible.';
      retenir();
      E.test.journal.push({ id: uid(), date, type: fd.get('type'), montant: m, note: String(fd.get('note') || '').trim().slice(0, 120) });
      sauver(); rendre(); toast(`Dépense notée : ${eur(m, { centimes: true })}.`, { libelle: 'Annuler', faire: annuler });
    });
  }
  function modaleTestReglages() {
    ouvrirModale('Phase de test', `${rang(`<label class="champ">Début<input name="debut" type="date" value="${esc(E.test.debut)}"></label>`, `<label class="champ">Durée (mois)<input name="duree" type="number" min="1" max="24" value="${E.test.duree}"></label>`)}<p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="arreter">Arrêter et effacer</button>', (fd, action) => {
        if (action === 'arreter') { if (!confirm('Effacer la phase de test et ses dépenses ?')) { garderOuverte(); return; } retenir(); E.test = { debut: '', duree: 2, journal: [] }; sauver(); rendre(); toast('Phase de test effacée.', { libelle: 'Annuler', faire: annuler }); return; }
        const debut = String(fd.get('debut') || ''), duree = R.lireEntier(fd.get('duree'), 1, 24);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(debut) || duree === null) return 'Date ou durée illisible.';
        retenir(); Object.assign(E.test, { debut, duree }); sauver(); rendre();
      });
  }

  // ---------- Scénarios ----------
  function dupliquerScenario(id) {
    const s = scenario(id);
    if (!s) return;
    if (E.scenarios.length >= R.MAX_SCENARIOS) { toast(`${R.MAX_SCENARIOS} scénarios au plus.`); return; }
    retenir();
    const copie = R.normaliserScenario({ ...structuredClone(s), id: uid(), couleur: null, nom: `${s.nom} (variante)`.slice(0, 60) }, E.scenarios.length, E.scenarios.map((x) => x.couleur), B.defauts);
    E.scenarios.splice(E.scenarios.indexOf(s) + 1, 0, copie);
    E.actif = copie.id;
    sauver(); rendre();
    modaleGererScenario(copie.id, true);
  }
  function modaleGererScenario(id, nouveau = false) {
    const s = scenario(id);
    if (!s) return;
    ouvrirModale(nouveau ? 'Nouveau scénario' : 'Scénario', `${nouveau ? '<p class="mention">Copie du scénario actif : renomme-le, puis change ce qui diffère (sortie, mode de détention, location…).</p>' : ''}
      <label class="champ">Nom <small>Ex. : « Vendre maintenant », « Attendre la fin du contrat », « Garder une petite occasion ».</small><input name="nom" maxlength="60" value="${esc(s.nom)}" required></label>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(s.note)}"></label><p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${E.scenarios.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer le scénario « ${s.nom} » ?`)) { garderOuverte(); return; }
        retenir(); E.scenarios = E.scenarios.filter((x) => x.id !== id); E.actif = E.scenarios[0].id;
        sauver(); rendre(); toast(`« ${s.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au scénario.';
      s.nom = nom.slice(0, 60); s.note = String(fd.get('note') || '').trim().slice(0, 300);
      sauver(); rendre();
    });
  }

  function modaleHypotheses() {
    ouvrirModale('Horizon et hypothèses', `
      <label class="champ">Horizon (années) <small>Durée sur laquelle le gain cumulé est calculé, de ${R.HORIZON_MIN} à ${R.HORIZON_MAX} ans.</small><input name="horizon" type="number" min="${R.HORIZON_MIN}" max="${R.HORIZON_MAX}" value="${E.horizon}"></label>
      <fieldset class="champ cadre-champs"><legend>Temps <small>Facultatif : 0 pour l'ignorer. Négatif si tu gagnes du temps.</small></legend>
        ${rang(`<label class="champ">Minutes de plus par jour ouvré<input name="minutes" inputmode="numeric" value="${E.temps.minutes}"></label>`, `<label class="champ">Valeur d'une heure (€)<input name="valeurHeure" inputmode="decimal" value="${esc(R.saisieMontant(E.temps.valeurHeure))}"></label>`, `<label class="champ">Jours ouvrés par an<input name="jours" type="number" min="0" max="366" value="${E.temps.jours}"></label>`)}</fieldset>
      <label class="champ">Placement de l'argent de la vente (% par an) <small>0 pour l'ignorer. Ce que rapporterait le produit net de la vente, placé.</small><input name="placement" inputmode="decimal" value="${esc(R.saisieDecimal(E.placement))}"></label>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const horizon = R.lireEntier(fd.get('horizon'), R.HORIZON_MIN, R.HORIZON_MAX);
      const minutes = R.lireEntier(fd.get('minutes') || '0', -240, 240);
      const valeurHeure = String(fd.get('valeurHeure') || '').trim() ? R.lireMontant(fd.get('valeurHeure')) : 0;
      const jours = R.lireEntier(fd.get('jours') || '0', 0, 366);
      const placement = String(fd.get('placement') || '').trim() ? R.lireDecimal(fd.get('placement'), 20) : 0;
      if (horizon === null) return `Horizon : de ${R.HORIZON_MIN} à ${R.HORIZON_MAX} ans.`;
      if (minutes === null || valeurHeure === null || jours === null) return 'Temps illisible : minutes de −240 à 240, valeur en euros.';
      if (placement === null) return 'Placement : de 0 à 20 %.';
      retenir();
      Object.assign(E, { horizon, placement, temps: { minutes, valeurHeure, jours } });
      sauver(); rendre(); toast('Hypothèses enregistrées : le bilan est recalculé.', { libelle: 'Annuler', faire: annuler });
    });
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

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe"><h3>Exporter</h3><p class="aide">Le bilan de tous les scénarios en tableur (CSV) : coûts par an, sortie, gain, détail des postes.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ta simulation est enregistrée en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du simulateur, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données</h3><p class="mention">Ta simulation est enregistrée en ligne, liée à ta clé, et n'est ni lue ni partagée par QME. Aucune connexion à une banque, un loueur ou un financeur : tu saisis toi-même tous les montants.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Simulateur rédigé pour QME (version ${esc(B.version)}). Aucune donnée de marché intégrée : prix, tarifs, valeur et perte de valeur sont ceux que tu saisis ; les valeurs proposées au départ sont des exemples. Numéros d'urgence : service-public.gouv.fr (fiche « Numéros d'urgence et d'écoute ») ; siège enfant : code de la route, article R412-2. Simulation, pas un conseil financier ; les repères d'urgence ne sont pas un avis médical.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.scenarios)) throw new Error();
        if (!confirm(`Remplacer ta simulation actuelle par cette copie (${pluriel(d.scenarios.length, 'scénario')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe; E.tutorielVu = vu || E.tutorielVu === true;
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `vivre-sans-voiture-${aujIso()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E), 'text/csv;charset=utf-8', `vivre-sans-voiture-bilan-${aujIso()}.csv`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const blocs = [
      ['rose', 'Le questionnaire ouvre les bons champs', 'Ton foyer, ton vélo, les transports, le travail et l\'école&nbsp;: tes réponses n\'affichent que les postes qui te concernent, règlent les urgences à prévoir et calculent un score de faisabilité. Un «&nbsp;non&nbsp;» au trajet du travail ou de l\'école bloque le verdict.'],
      ['beurre', 'Ta voiture, au coût complet', 'Dans <b>Ma voiture</b>, chaque poste par an&nbsp;: perte de valeur ou loyers, intérêts d\'un crédit, assurance, entretien, carburant, stationnement… Puis la <b>sortie</b>&nbsp;: vente, rachat de LOA au barème de ton contrat, restitution, indemnité de LLD. Les montants marqués «&nbsp;exemple&nbsp;» sont à remplacer.'],
      ['ciel', 'Sans voiture, poste par poste', 'Dans <b>Sans voiture</b>&nbsp;: transports, vélo, location, autopartage, taxis, train, livraisons, et l\'équipement acheté une fois. Seules les dépenses nouvelles comptent&nbsp;: ce que tu paies déjà se déduit.'],
      ['sable', 'Le gain, coût de sortie compris', `<b>Bilan</b> donne le gain par an (ou la perte), par mois, et cumulé sur ${pluriel(E.horizon, 'an')}&nbsp;: il reste à zéro tant que la voiture est là, puis le coût de sortie se paie et le gain s'ajoute chaque mois. Plusieurs scénarios (${R.MAX_SCENARIOS} au plus) se comparent, avec le meilleur moment de sortie.`],
      ['rose', 'Une parade pour chaque urgence', '<b>Urgences</b> liste les situations où la voiture manquerait (urgence de nuit, enfant malade, vacances…), avec une parade et un plan B. Marque-les «&nbsp;couvert&nbsp;» une fois prêtes, puis teste quelques mois sans la voiture avant de la vendre.'],
    ];
    const corps = `
      <p>Le simulateur calcule ce que ta voiture te coûte vraiment, ce que coûterait de t'en passer, et ce que tu gagnes (ou perds) chaque année. Ton rôle&nbsp;: remplacer les valeurs d'exemple par tes chiffres, et préparer une parade pour chaque urgence.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">Simulation, pas un conseil financier&nbsp;; ton contrat et ton financeur font foi. En cas d'urgence vitale, appelle le 15 ou le 112. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ta simulation est enregistrée en ligne avec ta clé&nbsp;: tu la retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    ouvrirModale('Comment ça marche', corps, `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`);
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'scenario-actif': if (E.actif !== id) { E.actif = id; sauver(); } rendre(); break;
      case 'dupliquer-scenario': dupliquerScenario(id); break;
      case 'gerer-scenario': modaleGererScenario(id); break;
      case 'hypotheses': modaleHypotheses(); break;
      case 'modale-voiture': modaleVoiture(); break;
      case 'modale-sortie': modaleSortie(); break;
      case 'modale-bareme': modaleBareme(); break;
      case 'ligne-bareme': { const z = $('#lignes-bareme'); const l = z.lastElementChild.cloneNode(true); l.querySelectorAll('input').forEach((i) => { i.value = ''; }); z.appendChild(l); l.querySelector('input').focus(); break; }
      case 'ligne-libre': { const z = $('#lignes-libres'); const l = z.lastElementChild.cloneNode(true); l.querySelectorAll('input').forEach((i) => { i.value = ''; }); z.appendChild(l); l.querySelector('input').focus(); break; }
      case 'groupe': modaleGroupe(id); break;
      case 'lignes': modaleLignes(id); break;
      case 'profil-location': modaleProfilLocation(); break;
      case 'appliquer-profil': { const p = B.profilsLocation.find((x) => x[0] === id); if (p) appliquerLocation(p[3].joursLocation, p[3].semainesLocation); break; }
      case 'suggestion-location': appliquerLocation(E.foyer.weekends * 2 + Math.ceil(E.foyer.grosAchats / 2), E.foyer.vacances); break;
      case 'couvrir': couvrir(id); break;
      case 'urgence': modaleUrgence(id); break;
      case 'equipement': { retenir(); E.equipementOk[id] = E.equipementOk[id] === el.dataset.etat ? '' : el.dataset.etat; if (!E.equipementOk[id]) delete E.equipementOk[id]; sauver(); const y = window.scrollY; rendre(); window.scrollTo({ top: y }); break; }
      case 'semaine': modaleSemaine(); break;
      case 'test-debut': retenir(); E.test = { debut: aujIso(), duree: 2, journal: [] }; sauver(); { const y = window.scrollY; rendre(); window.scrollTo({ top: y }); } toast('Phase de test commencée : note chaque dépense de remplacement.', { libelle: 'Annuler', faire: annuler }); break;
      case 'depense-test': modaleDepense(); break;
      case 'test-reglages': modaleTestReglages(); break;
      case 'suppr-depense': { retenir(); E.test.journal = E.test.journal.filter((j) => j.id !== id); sauver(); const y = window.scrollY; rendre(); window.scrollTo({ top: y }); toast('Dépense retirée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      default: break;
    }
  });
  // Questionnaire et cases à cocher : enregistrés sans fenêtre.
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.closest('#form-q')) { enregistrerQuestionnaire(el); return; }
    if (el.dataset.coche) {
      const groupe = E[el.dataset.coche];
      if (el.checked) groupe[el.dataset.id] = true; else delete groupe[el.dataset.id];
      sauver();
      if (el.dataset.coche === 'quotidien') { const t = [...document.querySelectorAll('.titre-section')].find((h) => h.textContent.startsWith('Cas du quotidien')); if (t) t.querySelector('span').textContent = `${B.quotidien.filter((_, i) => E.quotidien[i]).length} sur ${B.quotidien.length} réglés`; }
    }
  });
  document.addEventListener('input', (e) => { const el = e.target; if (el.closest('#form-q') && el.type !== 'radio' && el.type !== 'checkbox' && el.name !== 'enfants') enregistrerQuestionnaire(el); });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeur) > 40 && E && $('#vue') && vue === 'bilan' && !modale().open) { largeur = window.innerWidth; rendre(); } });
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
        if (E.scenarios.length) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__sansVoiture = { etat: () => E, regles: R };
  init();
})();
