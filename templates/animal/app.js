// Suivi d'un animal de compagnie QME : soins récurrents (dernière date et intervalle saisi d'après le
// vétérinaire → prochaine échéance), courbe de poids, visites et traitements notés, frais par catégorie,
// par mois et par an, carnet imprimable. Données synchronisées par clé de licence ou code d'accès.
// Aucun calendrier vaccinal, aucune posologie, aucun diagnostic, aucune connexion à une application externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ANM;
  const API = '/api/templates';
  const PRODUIT = 'ANM';
  const CLE_CODE = 'qme-anm-code';
  const CLE_CACHE = 'qme-anm-cache';
  const CLE_DEMO = 'qme-anm-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-anm-ecran-accueil';

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
  const { ajout, ajoutMois, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const euros = (n, dec = 2) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec });
  const eurosRond = (n) => euros(n, Math.abs(n) >= 100 ? 0 : 2);
  const kg = (n, d = null) => { const v = Number(n) || 0; const dd = d ?? (v < 10 ? 2 : 1); return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dd })} kg`; };
  const signe = (n, f) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : f(0));
  const vide = (x) => x === null || x === undefined || x === '';
  const quand = (s) => { const n = ecart(s, auj()); return n === 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : n > 0 ? `il y a ${pluriel(n, 'jour')}` : `dans ${pluriel(-n, 'jour')}`; };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  const filtre = { animal: '', periode: '12m', categorie: '', tout: false };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const animal = (id) => E.animaux.find((a) => a.id === id);
  const presents = () => E.animaux.filter((a) => a.actif !== false);
  const nomA = (id) => (id ? (animal(id)?.nom || 'Animal supprimé') : 'Commun');
  const especeNom = (a) => (a.espece === 'autre' && a.especeAutre ? a.especeAutre : B.especes.find((e) => e.code === a.espece)?.nom || 'Animal');
  const categorie = (c) => B.categories.find((x) => x.code === c);
  const synth = (a) => R.syntheseAnimal(E, a, auj());
  // Animal choisi dans le filtre (s'il existe encore), sinon tous.
  const choisi = () => (filtre.animal && (filtre.animal === 'commun' || animal(filtre.animal)) ? filtre.animal : '');
  // Pour les vues centrées sur un animal (poids et visites) : l'animal choisi, sinon le premier présent.
  const unAnimal = () => { const c = choisi(); return (c && c !== 'commun' && animal(c)) || presents()[0] || E.animaux[0] || null; };

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
        toast('Un autre appareil a modifié le suivi entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (ANM-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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

  // ---------- Données de démonstration ----------
  // Foyer fictif : un chien, une chatte et une lapine, noms inventés, identification fictive, aucune marque.
  // Les intervalles des soins sont des EXEMPLES (note « Exemple, à confirmer avec ton vétérinaire »), pas des
  // recommandations. Dates relatives à aujourd'hui, tous les états couverts : antiparasitaire en retard,
  // visite de contrôle en retard, vaccin et vermifuge bientôt, date fixée par le vétérinaire, soin sans
  // intervalle (« à compléter »), soin en pause, pesée à faire, traitement en cours, animal sans visite.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n) => ajoutMois(t, n);
    const EX = 'Exemple, à confirmer avec ton vétérinaire.';
    const a = (x) => { const o = R.normaliserAnimal({ id: uid(), ...x }); e.animaux.push(o); return o; };
    const soin = (an, type, nom, intervalle, unite, extra = {}) => { const s = R.normaliserSoin({ id: uid(), animalId: an.id, type, nom, intervalle, unite, note: intervalle ? EX : '', ...extra }, B); e.soins.push(s); return s; };
    // Soins faits à rebours depuis `dernier`, tous les `pas` jours, n fois.
    const faits = (s, dernier, pas, n, cout, extra = {}) => { for (let k = 0; k < n; k++) { const d = ajout(dernier, -k * pas); if (d <= t) e.faits.push(R.normaliserFait({ id: uid(), soinId: s.id, animalId: s.animalId, date: d, cout, ...(k === 0 ? extra : {}) })); } };
    const pese = (an, date, poids) => date <= t && e.pesees.push(R.normaliserPesee({ id: uid(), animalId: an.id, date, poids }));
    const dep = (an, date, categorie, montant, libelle) => date <= t && e.depenses.push(R.normaliserDepense({ id: uid(), animalId: an ? an.id : '', date, categorie, montant, libelle }, B));
    const vis = (an, date, x) => e.visites.push(R.normaliserVisite({ id: uid(), animalId: an.id, date, veterinaire: 'Clinique du quartier (fictive)', ...x }));
    // Variation déterministe (pas de hasard : la démo est la même à chaque ouverture du jour).
    const vari = (k, amp) => Math.sin(k * 2.17) * amp;

    // 1. Chien adulte.
    const bis = a({ nom: 'Biscuit', espece: 'chien', race: 'Croisé', sexe: 'M', naissance: ajout(m(-51), -9), sterilise: 'oui', identification: 'Puce n° 250 000 000 000 001 (fictive)', veterinaire: 'Clinique du quartier (fictive)', notes: 'Aime les longues balades ; craint l\'orage.' });
    faits(soin(bis, 'VAC', 'Vaccin (rappel)', 1, 'ans'), j(-360), 365, 3, 68, { par: 'Clinique du quartier (fictive)' });
    faits(soin(bis, 'AEX', 'Antiparasitaire externe (puces, tiques)', 1, 'mois'), j(-38), 30, 12, 18);
    faits(soin(bis, 'VER', 'Vermifuge', 3, 'mois'), j(-40), 91, 4, 12);
    faits(soin(bis, 'TOI', 'Toilettage', 2, 'mois'), j(-20), 61, 6, 45, { par: 'Salon de toilettage (fictif)' });
    soin(bis, 'DEN', 'Hygiène dentaire', 0, 'mois');
    for (let k = 0; k < 13; k++) pese(bis, ajout(t, -k * 56 - 4), Math.round((18.3 - k * 0.12 + vari(k, 0.35)) * 10) / 10);
    vis(bis, j(-95), { motif: 'Boiterie de la patte arrière', notes: 'Examen de la patte, rien de cassé d\'après le vétérinaire. Repos conseillé une semaine.', traitement: 'Traitement prescrit : voir l\'ordonnance du vétérinaire (exemple fictif).', finTraitement: j(-88), cout: 55 });
    vis(bis, j(-360), { motif: 'Rappel de vaccin et bilan annuel', notes: 'Bilan sans remarque particulière (exemple fictif).', cout: 0 });
    for (let k = 0; k < 25; k++) { dep(bis, ajout(m(-k), -2), 'ALI', 46.9, 'Croquettes et friandises'); dep(bis, ajout(m(-k), -6), 'ASS', 24, 'Assurance santé, mensualité'); }
    dep(bis, j(-122), 'GAR', 168, 'Pension pendant les vacances (7 nuits)');
    dep(bis, j(-30), 'ACC', 19.5, 'Jouet à mâcher');
    dep(bis, j(-210), 'EDU', 90, 'Séances d\'éducation (3)');

    // 2. Chatte âgée : date fixée par le vétérinaire, traitement en cours, visite de contrôle en retard.
    const mis = a({ nom: 'Mistigri', espece: 'chat', race: 'Européenne', sexe: 'F', naissance: ajout(m(-111), 12), sterilise: 'oui', identification: 'Puce n° 250 000 000 000 002 (fictive)', veterinaire: 'Clinique du quartier (fictive)' });
    faits(soin(mis, 'VAC', 'Vaccin (rappel)', 1, 'ans'), j(-200), 365, 2, 62, { prochaine: j(120), note: 'Date du prochain rappel inscrite par le vétérinaire.' });
    faits(soin(mis, 'VER', 'Vermifuge', 6, 'mois'), j(-172), 182, 2, 11);
    faits(soin(mis, 'AEX', 'Antiparasitaire externe (puces, tiques)', 1, 'mois'), j(-25), 30, 12, 15);
    soin(mis, 'CON', 'Visite de contrôle', 12, 'mois', { depuis: m(-13) });
    soin(mis, 'GRI', 'Coupe des griffes', 6, 'semaines', { actif: false, note: 'Faite à la maison.' });
    for (let k = 0; k < 10; k++) pese(mis, ajout(t, -k * 35 - 6), Math.round((4.08 + k * 0.035 + vari(k + 3, 0.06)) * 100) / 100);
    vis(mis, j(-6), { motif: 'Gencives rouges', notes: 'Examen de la bouche. Contrôle prévu à la fin du traitement.', traitement: 'Soin de la bouche selon l\'ordonnance du vétérinaire (exemple fictif).', finTraitement: j(8), cout: 48 });
    for (let k = 0; k < 25; k++) dep(mis, ajout(m(-k), -3), 'ALI', 29.4, 'Croquettes et pâtée');
    dep(mis, j(-6), 'MED', 21.8, 'Traitement prescrit (exemple fictif)');

    // 3. Lapine : autre espèce, pesée à faire, aucune visite.
    const noi = a({ nom: 'Noisette', espece: 'autre', especeAutre: 'Lapin', race: 'Bélier nain', sexe: 'F', naissance: m(-30), sterilise: 'non', identification: '' });
    faits(soin(noi, 'GRI', 'Coupe des griffes', 2, 'mois'), j(-50), 61, 5, 0);
    soin(noi, 'CON', 'Visite de contrôle', 0, 'mois');
    pese(noi, j(-100), 1.92); pese(noi, j(-190), 1.85); pese(noi, j(-280), 1.71);
    for (let k = 0; k < 25; k++) dep(noi, ajout(m(-k), -9), 'ALI', 21.5, 'Foin et granulés');

    // Dépenses communes.
    for (let k = 0; k < 25; k++) dep(null, ajout(m(-k), -12), 'ACC', 14.9, 'Litière (chat et lapin)');
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT_TEXTE = 'Outil de suivi : il <b>ne remplace pas l\'avis de ton vétérinaire</b>, ne pose aucun diagnostic et ne donne aucune posologie. Aucun calendrier de vaccins ni d\'antiparasitaires n\'est intégré : les intervalles sont ceux que tu saisis d\'après ton vétérinaire. Les frais sont calculés à partir de ta saisie. En cas de doute sur la santé de ton animal, contacte ton vétérinaire.';
  const AVERTISSEMENT = `<p class="mention avertissement" role="note">${AVERTISSEMENT_TEXTE}</p>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi d\'un animal de compagnie · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#2E5A88"/>
          <circle cx="220" cy="80" r="60" fill="#E8B93A"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#FBF7F1" stroke-opacity=".5" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#E58C74"/>
          <circle cx="430" cy="210" r="70" fill="#E8B93A"/>
          <path d="M372 168 L380 70 L432 140 Z" fill="#E8B93A"/>
          <path d="M488 168 L480 70 L428 140 Z" fill="#E8B93A"/>
          <circle cx="405" cy="200" r="9" fill="#24221F"/>
          <circle cx="455" cy="200" r="9" fill="#24221F"/>
          <path d="M420 228 h20 l-10 12 Z" fill="#B84A34"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi d'un animal de compagnie</p>
          <h1>Ses soins, à temps.</h1>
          <p>Les vaccins, antiparasitaires et toilettages aux dates fixées avec ton vétérinaire, sa courbe de poids, ses visites, et ce qu'il te coûte par mois et par an.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre le suivi de ton animal</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton suivi est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/animal/">Voir le suivi d'un animal de compagnie</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', espece: 'chien', especeAutre: '', naissance: '', poids: '', modeles: null });
  let accueil = accueilVide();
  const optionsEspece = (val) => B.especes.map((x) => `<option value="${x.code}" ${x.code === val ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const casesModeles = (espece, coches) => (B.modeles[espece] || B.modeles.autre).map(([, nom], i) => `<label class="case"><input type="checkbox" name="modele" value="${i}" ${!coches || coches.includes(i) ? 'checked' : ''}> ${esc(nom)}</label>`).join('');

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Le suivi de ton animal, en deux minutes.</h1>
        <p class="intro">Tu notes ton animal et ses soins récurrents ; au fil de l'eau, chaque soin fait, chaque pesée, chaque visite et chaque frais. L'outil calcule les prochaines échéances à partir des intervalles que ton vétérinaire t'a indiqués, trace la courbe de poids et totalise les frais.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="aide" style="margin-top:20px">${AVERTISSEMENT_TEXTE}</p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton premier animal</h1>
        <p class="intro">Tu ajouteras d'autres animaux ensuite, dans l'onglet Animaux.</p>
        <div class="form-accueil">
          <div class="rang-champs">
            <label class="champ">Nom<input id="a-nom" value="${esc(a.nom)}" maxlength="40" placeholder="Son nom"></label>
            <label class="champ">Espèce<select id="a-espece">${optionsEspece(a.espece)}</select></label>
            <label class="champ" data-autre ${a.espece === 'autre' ? '' : 'hidden'}>Laquelle ?<input id="a-autre" value="${esc(a.especeAutre)}" maxlength="40" placeholder="Lapin, furet, oiseau…"></label>
          </div>
          <div class="rang-champs">
            <label class="champ">Date de naissance<small>Facultative, même approximative.</small><input id="a-naissance" type="date" value="${a.naissance}" max="${auj()}"></label>
            <label class="champ">Poids aujourd'hui (kg)<small>Facultatif : première pesée de la courbe.</small><input id="a-poids" inputmode="decimal" value="${esc(a.poids)}" placeholder="Ex. : 4,2"></label>
          </div>
          <fieldset class="champ cadre-champs"><legend>Soins à suivre <small>Seulement les noms : l'intervalle de chaque soin se saisit ensuite, d'après ton vétérinaire. Aucune durée n'est proposée par l'outil.</small></legend><div class="cases-ops" id="a-modeles">${casesModeles(a.espece, a.modeles)}</div></fieldset>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-autre', 'especeAutre'); lier('#a-naissance', 'naissance'); lier('#a-poids', 'poids');
    $('#a-espece')?.addEventListener('change', (e) => { accueil.espece = e.target.value; accueil.modeles = null; ecranAccueil(); });
    $('#a-modeles')?.addEventListener('change', () => { accueil.modeles = [...document.querySelectorAll('#a-modeles input:checked')].map((x) => Number(x.value)); });
  }

  function terminerAccueil() {
    const a = accueil;
    if (!a.nom.trim()) return ecranAccueil('Indique le nom de ton animal.');
    if (a.naissance && (!R.estDate(a.naissance) || a.naissance > auj())) return ecranAccueil('Date de naissance illisible ou future.');
    const p = String(a.poids).trim() ? R.lirePoids(a.poids) : '';
    if (p === null) return ecranAccueil('Poids illisible : écris par exemple 4,2 (en kg).');
    const coches = [...document.querySelectorAll('#a-modeles input:checked')].map((x) => Number(x.value));
    E = etatVide();
    const an = R.normaliserAnimal({ id: uid(), nom: a.nom, espece: a.espece, especeAutre: a.especeAutre, naissance: a.naissance || null });
    E.animaux.push(an);
    E.soins.push(...R.soinsModeles(B, an.espece, an.id, coches));
    if (p) E.pesees.push(R.normaliserPesee({ id: uid(), animalId: an.id, date: auj(), poids: p }));
    accueil = accueilVide();
    vue = 'soins';
    sauver();
    demarrer();
    toast('Ton suivi est prêt. Saisis l\'intervalle de chaque soin d\'après ton vétérinaire.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    soins: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    suivi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9 11l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="21" cy="6" r="2.5" fill="currentColor"/></svg>',
    frais: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    animaux: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#E8B93A" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#B84A34" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#2E5A88" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Tableau de bord'], ['soins', 'Soins'], ['suivi', 'Poids et visites'], ['frais', 'Frais'], ['animaux', 'Animaux']];
  const ETATS = { retard: ['rouge', 'En retard'], proche: ['jaune', 'Bientôt'], ok: ['vert', 'À jour'], sans: ['sable', 'À compléter'], pause: ['sable', 'En pause'] };
  const etiquetteEtat = (et) => `<span class="etiquette ${ETATS[et][0]}">${ETATS[et][1]}</span>`;
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#2E5A88"/><circle cx="62" cy="62" r="34" fill="#E8B93A"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#E58C74"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const boutonAjoutAnimal = `<button class="btn primaire" data-action="animal">${ICONES.plus}Ajouter un animal</button>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/animal/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Animaux fictifs, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi de<br>l'animal</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Suivi de l'animal`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bord: vueBord, soins: vueSoins, suivi: vueSuivi, frais: vueFrais, animaux: vueAnimaux }[vue]();
    brancherInfobulles();
    $('#filtre-animal')?.addEventListener('change', (e) => { filtre.animal = e.target.value; filtre.tout = false; rendre(); });
    $('#filtre-periode')?.addEventListener('change', (e) => { filtre.periode = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur d'animal commun aux vues. avecTous : option « Tous » ; avecCommun : « Dépenses communes ».
  function choixAnimal({ avecTous = true, avecCommun = false } = {}) {
    const as = E.animaux;
    if (as.length < 2 && !avecCommun) return '';
    const val = avecTous ? choisi() : unAnimal()?.id;
    return `<label class="champ choix-animal"><span class="sr-only">Animal</span><select id="filtre-animal">${avecTous ? `<option value="">Tous les animaux</option>` : ''}${as.map((a) => `<option value="${a.id}" ${val === a.id ? 'selected' : ''}>${esc(a.nom)}${a.actif === false ? ' (parti)' : ''}</option>`).join('')}${avecCommun ? `<option value="commun" ${val === 'commun' ? 'selected' : ''}>Dépenses communes</option>` : ''}</select></label>`;
  }
  const pastilleEspece = (a) => `<span class="espece">${esc(especeNom(a))}</span>`;
  const texteIntervalle = (s) => R.texteIntervalle(s.intervalle, s.unite);
  function texteEcheance(e) {
    if (e.etat === 'pause') return 'En pause : aucune alerte';
    if (!e.prochaine) return e.dernier ? 'Intervalle à saisir d\'après ton vétérinaire' : 'À compléter : dernière date et intervalle d\'après ton vétérinaire';
    const j = e.jours;
    const rel = j < 0 ? `en retard de ${pluriel(-j, 'jour')}` : j === 0 ? 'aujourd\'hui' : `dans ${pluriel(j, 'jour')}`;
    return `Prochain le ${dateCourte(e.prochaine)} · ${rel}${e.origine === 'veterinaire' ? ' · date fixée par le vétérinaire' : e.origine === 'saisie' ? ' · date notée' : ''}`;
  }
  const couleurEtat = (et) => (et === 'retard' ? 'var(--rouge)' : et === 'proche' ? 'var(--jaune)' : et === 'ok' ? 'var(--vert)' : 'var(--trait)');

  // ---------- Tableau de bord ----------
  function periode12() { const t = auj(); return [ajout(ajoutMois(t, -12), 1), t]; }

  function vueBord() {
    const t = auj();
    const aid = choisi() === 'commun' ? '' : choisi();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>Les soins qui arrivent, les pesées, et ce que ${aid ? 'cet animal' : 'tes animaux'} te coûte${aid ? '' : 'nt'}.</p></div>
        <div class="actions">${choixAnimal()}<button class="btn" data-action="pesee" data-animal="${aid}">Pesée</button><button class="btn primaire" data-action="depense" data-animal="${aid}">${ICONES.plus}Frais</button></div></div>`;
    if (!E.animaux.length) return `${titre}${videEtat('Aucun animal pour l\'instant', 'Ajoute ton animal : son nom et son espèce suffisent pour commencer. Ses soins se notent ensuite.', boutonAjoutAnimal)}${AVERTISSEMENT}`;
    const al = R.alertes(E, t).filter((a) => !aid || a.animalId === aid);
    const [du, au] = periode12();
    const f = R.frais(E, B, aid || null, du, au);
    const retards = al.filter((a) => a.etat === 'retard').length;
    const tuiles = [
      ['En retard', String(retards), retards ? pluriel(retards, 'soin') + ' à faire' : 'rien en retard', 'var(--rouge)', 'rond'],
      ['Bientôt', String(al.length - retards), `dans les ${E.reglages.alerteJours} jours`, 'var(--jaune)', ''],
      ['Coût annuel', eurosRond(f.total), '12 derniers mois', 'var(--bleu)', 'rond'],
      ['Par mois', eurosRond(f.coutMensuel), 'en moyenne sur cette période', 'var(--encre)', ''],
    ].map(([lib, v, d, col, fo]) => `<div class="tuile ${fo}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const as = aid ? [animal(aid)] : presents();
    const traitements = R.traitementsEnCours(E, aid || null, t);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>${pluriel(al.length, 'échéance')}</span></h2>
          ${al.length ? `<ul class="alertes-liste">${al.map(ligneAlerte).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Tout est à jour</h3><p>Les soins apparaissent ici quand leur échéance approche, d\'après les intervalles que tu as saisis.</p></div></div>'}
          ${traitements.length ? `<h2 class="titre-section">Traitements en cours <span>notés lors des visites</span></h2><ul class="alertes-liste">${traitements.map((v) => `<li class="info"><span class="date-pastille"><b>${versDate(v.finTraitement).getDate()}</b>${fmt(v.finTraitement, { month: 'short' }).replace('.', '')}</span><div class="lien-ligne"><b>${esc(nomA(v.animalId))} · jusqu'au ${dateCourte(v.finTraitement)}</b><span>${esc(v.traitement)}</span></div><span class="alerte-droite"><button class="btn petit" data-action="visite" data-id="${v.id}">Voir</button></span></li>`).join('')}</ul>` : ''}
        </section>
        <section>
          <h2 class="titre-section">${aid ? 'L\'animal' : 'Mes animaux'}</h2>
          <ul class="mini-animaux">${as.map(miniAnimal).join('')}</ul>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function ligneAlerte(a) {
    const an = animal(a.animalId);
    const action = a.type === 'soin' ? `data-action="fait" data-soin="${a.refId}"` : `data-action="pesee" data-animal="${a.animalId}"`;
    const bouton = a.type === 'pesee' ? 'Peser' : 'C\'est fait';
    return `<li class="${a.etat}"><span class="date-pastille ${a.etat === 'retard' ? 'alerte' : ''}"><b>${versDate(a.date).getDate()}</b>${fmt(a.date, { month: 'short' }).replace('.', '')}</span>
      <div class="lien-ligne"><b>${esc(an?.nom || '')} · ${esc(a.titre)}</b><span>${esc(a.detail)}</span></div>
      <span class="alerte-droite">${etiquetteEtat(a.etat)}<button class="btn petit" ${action}>${bouton}</button></span></li>`;
  }

  function miniAnimal(a) {
    const s = synth(a);
    const p = s.prochain;
    const po = s.poids;
    return `<li style="--c:${couleurEtat(s.pire)}">
      <button class="lien-ligne" data-action="aller-animal" data-id="${a.id}"><b>${esc(a.nom)} ${pastilleEspece(a)}</b><span>${[s.age ? R.texteAge(s.age) : '', po.dernier ? `${kg(po.dernier.poids)} le ${dateCourte(po.dernier.date)}` : 'pas encore pesé'].filter(Boolean).join(' · ')}</span>
      <span>${p ? `${esc(p.soin.nom)} : ${p.etat === 'retard' ? 'en retard depuis le' : 'le'} ${dateCourte(p.prochaine)}` : 'Aucun soin planifié'}</span>${s.traitements.length ? `<span>Traitement en cours jusqu'au ${dateCourte(s.traitements[0].finTraitement)}</span>` : ''}</button></li>`;
  }

  // Infobulles des graphiques : au survol ou au focus d'un élément [data-info] ; positionnées sur son
  // ancre (.ancre) quand il en a une (zone de survol plus grande que la marque).
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = (el.querySelector('.ancre') || el).getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight - 10;
        if (y < 4) y = re.bottom - rf.top + 10;
        bulle.style.left = `${x}px`;
        bulle.style.top = `${y}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Soins ----------
  function vueSoins() {
    const c = choisi() === 'commun' ? '' : choisi();
    const as = c ? [animal(c)] : presents();
    const titre = `<div class="vue-tete"><div><h1>Soins</h1><p>Vaccins, antiparasitaires, vermifuge, toilettage… Chaque soin a sa dernière date et l'intervalle que ton vétérinaire t'a indiqué : l'outil en déduit la prochaine échéance.</p></div>
        <div class="actions">${choixAnimal()}<button class="btn primaire" data-action="fait" data-animal="${c}">${ICONES.plus}Noter un soin fait</button></div></div>`;
    if (!as.length) return `${titre}${videEtat('Aucun animal', 'Ajoute un animal pour suivre ses soins.', boutonAjoutAnimal)}${AVERTISSEMENT}`;
    const blocs = as.map((a) => {
      const s = synth(a);
      const histo = E.faits.filter((f) => f.animalId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      const nomSoin = (id) => E.soins.find((x) => x.id === id)?.nom || 'Soin';
      return `<section class="groupe-cat">
        <h2 class="titre-cat"><span class="tc-nom">${esc(a.nom)} ${pastilleEspece(a)}</span><span>${s.age ? R.texteAge(s.age) : ''}</span><button class="btn petit" data-action="soin" data-animal="${a.id}">${ICONES.plus}Ajouter un soin</button></h2>
        ${s.soins.length ? `<ul class="plan-liste">${s.soins.map((e) => `<li class="op ${e.etat}"><div class="op-info"><button class="lien-ligne" data-action="soin" data-id="${e.soin.id}"><b>${esc(e.soin.nom)}</b></button><span>${esc(texteEcheance(e))}</span>
            <span class="op-der">${e.dernier ? `${e.dernierFait ? 'Fait' : 'Dernière fois'} le ${dateCourte(e.dernier)}` : 'Jamais noté'}${texteIntervalle(e.soin) ? ` · ${texteIntervalle(e.soin)}` : ''}${e.soin.note ? ` · ${esc(e.soin.note)}` : ''}</span></div>
            <div class="op-droite">${etiquetteEtat(e.etat)}${e.etat === 'pause' ? '' : `<button class="btn petit" data-action="fait" data-soin="${e.soin.id}">C'est fait</button>`}</div></li>`).join('')}</ul>`
          : `<div class="vide-etat petit"><div><h3>Aucun soin suivi</h3><p>Ajoute les soins récurrents de ${esc(a.nom)} (vaccin, antiparasitaire, vermifuge, toilettage…) avec l'intervalle indiqué par ton vétérinaire.</p></div></div>`}
        <details class="plus-tard"${histo.length && histo.length <= 4 ? ' open' : ''}><summary>Soins faits · ${pluriel(histo.length, 'saisie')}</summary>
          ${histo.length ? `<ul class="histo-liste">${histo.slice(0, 40).map((f) => `<li><button class="lien-ligne" data-action="fait" data-id="${f.id}"><b>${dateCourte(f.date)} · ${esc(nomSoin(f.soinId))}</b><span>${[f.par, f.note, f.prochaine ? `prochain fixé au ${dateCourte(f.prochaine)}` : ''].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</span></button><span class="nb">${f.cout ? euros(f.cout) : ''}</span></li>`).join('')}</ul>${histo.length > 40 ? '<p class="aide">Les 40 plus récents sont affichés ; le carnet et l\'export contiennent tout.</p>' : ''}` : '<p class="aide">Aucun soin fait noté pour cet animal.</p>'}
        </details>
      </section>`;
    }).join('');
    return `${titre}${blocs}${AVERTISSEMENT}`;
  }

  // ---------- Poids et visites ----------
  // Pas « rond » d'axe : 1, 2, 2,5 ou 5 × 10^n.
  function pasRond(r) {
    const p = 10 ** Math.floor(Math.log10(r));
    const f = r / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  // Courbe de poids d'un animal (SVG, une seule série) : ligne 2 px, marqueurs cerclés de la couleur du
  // fond, zone de survol par pesée (repère vertical et infobulle), dernière valeur étiquetée, tableau à côté.
  function graphePoids(a, liste) {
    if (!liste.length) return `<div class="vide-etat petit"><div><h3>Aucune pesée</h3><p>Note une première pesée de ${esc(a.nom)} : la courbe apparaît dès la deuxième.</p><div class="actions"><button class="btn primaire" data-action="pesee" data-animal="${a.id}">${ICONES.plus}Noter une pesée</button></div></div></div>`;
    const tel = estTel();
    // viewBox à la largeur réelle du conteneur : le texte garde sa taille (12 px) sur tous les écrans.
    const dispo = ($('#vue')?.clientWidth || 760) - (tel ? 46 : 66);
    const W = Math.round(Math.min(1140, Math.max(300, dispo))), H = tel ? 230 : 290;
    const m = { g: tel ? 42 : 50, d: tel ? 54 : 66, h: 16, b: 30 };
    const d0 = liste[0].date, d1 = liste.at(-1).date;
    const span = Math.max(1, ecart(d0, d1));
    const vals = liste.map((p) => p.poids);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const marge = Math.max((hi - lo) * 0.2, hi * 0.04, 0.05);
    const pas = pasRond((hi - lo + 2 * marge) / 4);
    const y0 = Math.max(0, Math.floor((lo - marge) / pas) * pas), y1 = Math.ceil((hi + marge) / pas) * pas;
    const dec = pas >= 1 ? 0 : pas >= 0.1 && Math.round(pas * 10) === pas * 10 ? 1 : 2;
    const X = (d) => (liste.length === 1 ? (m.g + W - m.d) / 2 : m.g + (W - m.g - m.d) * ecart(d0, d) / span);
    const Y = (v) => m.h + (H - m.h - m.b) * (1 - (v - y0) / (y1 - y0));
    const nb = (v, d = dec) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const grille = [];
    for (let v = y0; v <= y1 + pas / 2; v += pas) grille.push(`<line x1="${m.g}" x2="${W - m.d}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g-grille"/><text x="${m.g - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="g-axe">${nb(v)}</text>`);
    // Étiquettes de date comptées depuis la fin : la dernière, puis vers la gauche tant qu'il y a la place.
    const nbDates = liste.length === 1 ? 1 : tel ? 3 : 5;
    const dates = [];
    for (let k = nbDates - 1; k >= 0; k--) dates.push(nbDates === 1 ? d1 : ajout(d0, Math.round(span * k / (nbDates - 1))));
    const etiq = dates.map((d, i) => `<text x="${X(d).toFixed(1)}" y="${H - 8}" text-anchor="${nbDates > 1 && i === 0 ? 'end' : nbDates > 1 && i === dates.length - 1 ? 'start' : 'middle'}" class="g-axe">${esc(fmt(d, { month: 'short', year: '2-digit' }).replace('.', ''))}</text>`).join('');
    const pts = liste.map((p) => [X(p.date), Y(p.poids)]);
    const ligne = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const aire = liste.length > 1 ? `${ligne} L${pts.at(-1)[0].toFixed(1)} ${Y(y0).toFixed(1)} L${pts[0][0].toFixed(1)} ${Y(y0).toFixed(1)} Z` : '';
    const zones = liste.map((p, i) => {
      const xg = i ? (pts[i - 1][0] + pts[i][0]) / 2 : m.g, xd = i < liste.length - 1 ? (pts[i][0] + pts[i + 1][0]) / 2 : W - m.d;
      const ecartPrec = i ? p.poids - liste[i - 1].poids : null;
      const info = `<b>${esc(dateLongue(p.date))}</b>${kg(p.poids)}${ecartPrec !== null ? ` · ${signe(R.arrondi(ecartPrec, 3), (n) => kg(n, 3))} depuis la pesée précédente` : ''}${p.note ? `<br>${esc(p.note)}` : ''}`;
      return `<g class="g-zone" tabindex="0" data-info="${esc(info)}"><rect x="${xg.toFixed(1)}" y="${m.h}" width="${Math.max(2, xd - xg).toFixed(1)}" height="${H - m.h - m.b}" fill="transparent"/><line class="g-repere" x1="${pts[i][0].toFixed(1)}" x2="${pts[i][0].toFixed(1)}" y1="${m.h}" y2="${H - m.b}"/><circle class="ancre" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="6" fill="transparent"/></g>`;
    }).join('');
    const der = liste.at(-1);
    return `<figure class="graphique graphe-poids"><figcaption class="sr-only">Courbe de poids de ${esc(a.nom)}, ${pluriel(liste.length, 'pesée')} du ${dateLongue(d0)} au ${dateLongue(d1)}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de poids de ${esc(a.nom)} en kilogrammes">${grille.join('')}
        ${aire ? `<path d="${aire}" class="g-aire"/>` : ''}<path d="${ligne}" class="g-ligne"/>
        ${pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="g-point"/>`).join('')}
        <text x="${(pts.at(-1)[0] + 9).toFixed(1)}" y="${(pts.at(-1)[1] + 4).toFixed(1)}" class="g-fin">${nb(der.poids, der.poids < 10 ? 2 : 1)}</text>
        ${etiq}${zones}</svg>
      <div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau des pesées</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th class="nb">Poids</th><th class="nb">Écart</th><th></th></tr></thead><tbody>${liste.slice().reverse().map((p, i, l) => `<tr><td>${dateCourte(p.date)}</td><td class="nb">${kg(p.poids)}</td><td class="nb">${l[i + 1] ? signe(R.arrondi(p.poids - l[i + 1].poids, 3), (n) => kg(n, 3)) : ''}</td><td class="nb"><button class="btn lien" data-action="pesee" data-id="${p.id}">Modifier</button></td></tr>`).join('')}</tbody></table></div></details></figure>`;
  }

  function vueSuivi() {
    const a = unAnimal();
    const titre = `<div class="vue-tete"><div><h1>Poids et visites</h1><p>La courbe de poids, les visites chez le vétérinaire et les traitements notés. L'outil montre l'évolution sans l'interpréter : seul ton vétérinaire dit si un poids convient.</p></div>
        <div class="actions">${E.animaux.length > 1 ? choixAnimal({ avecTous: false }) : ''}${a ? `<button class="btn" data-action="visite" data-animal="${a.id}">Visite</button><button class="btn primaire" data-action="pesee" data-animal="${a.id}">${ICONES.plus}Pesée</button>` : ''}</div></div>`;
    if (!a) return `${titre}${videEtat('Aucun animal', 'Ajoute un animal pour suivre son poids et ses visites.', boutonAjoutAnimal)}${AVERTISSEMENT}`;
    const s = synth(a);
    const po = s.poids;
    const tuiles = [
      ['Dernier poids', po.dernier ? kg(po.dernier.poids) : '–', po.dernier ? `le ${dateCourte(po.dernier.date)}` : 'aucune pesée', 'var(--bleu)', 'rond'],
      ['Depuis la précédente', po.variation === null ? '–' : signe(po.variation, (n) => kg(n, 3)), po.variationPct === null ? 'il faut deux pesées' : `${signe(po.variationPct, (n) => `${n.toLocaleString('fr-FR')} %`)}, pesée du ${dateCourte(po.precedent.date)}`, 'var(--jaune)', ''],
      ['Sur 90 jours', po.sur90 === null ? '–' : signe(po.sur90, (n) => kg(n, 3)), po.sur90 === null ? 'pas de pesée 90 jours avant' : 'écart avec la pesée connue 90 jours plus tôt', 'var(--encre)', ''],
      ['Pesées', String(po.nombre), po.nombre > 1 ? `de ${kg(po.min)} à ${kg(po.max)}` : 'notées', 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const visites = E.visites.filter((v) => v.animalId === a.id).sort((x, y) => y.date.localeCompare(x.date));
    const t = auj();
    const listeVisites = visites.length ? `<ul class="visites">${visites.map((v) => {
      const enCours = v.traitement && R.estDate(v.finTraitement) && v.finTraitement >= t && v.date <= t;
      return `<li class="${enCours ? 'en-cours' : ''}"><button class="lien-ligne" data-action="visite" data-id="${v.id}"><b>${dateCourte(v.date)} · ${esc(v.motif || 'Visite')}</b><span>${esc(v.veterinaire || '')}</span></button>
        ${v.notes ? `<p class="vi-notes">${esc(v.notes)}</p>` : ''}${v.traitement ? `<p class="vi-trait"><span class="etiquette ${enCours ? 'ciel' : 'sable'}">${enCours ? 'Traitement en cours' : 'Traitement'}</span> ${esc(v.traitement)}${R.estDate(v.finTraitement) ? ` <small>jusqu'au ${dateCourte(v.finTraitement)}</small>` : ''}</p>` : ''}${v.cout ? `<span class="nb vi-cout">${euros(v.cout)}</span>` : ''}</li>`;
    }).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucune visite notée</h3><p>Note les visites chez le vétérinaire : motif, ce qu'il a dit, le traitement prescrit tel qu'écrit sur l'ordonnance, le coût.</p></div></div>`;
    return `${titre}
      <h2 class="titre-section">${esc(a.nom)} <span>${esc(especeNom(a))}${s.age ? ` · ${R.texteAge(s.age)}` : ''}</span></h2>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Courbe de poids <span>en kilogrammes</span></h2>
      ${graphePoids(a, s.pesees)}
      <h2 class="titre-section">Visites et traitements <span>${pluriel(visites.length, 'visite')}</span></h2>
      <p class="aide" style="margin-bottom:12px">Recopie le traitement tel qu'il est écrit sur l'ordonnance : l'outil ne propose aucun médicament ni aucune dose.</p>
      ${listeVisites}
      ${AVERTISSEMENT}`;
  }

  // ---------- Frais ----------
  const PERIODES = [['12m', '12 derniers mois'], ['annee', 'Cette année'], ['tout', 'Depuis le début']];
  function bornesPeriode() {
    const t = auj();
    if (filtre.periode === 'annee') return [`${t.slice(0, 4)}-01-01`, t];
    if (filtre.periode === 'tout') return ['1900-01-01', t];
    return periode12();
  }

  function vueFrais() {
    const aid = choisi();
    const [du, au] = bornesPeriode();
    const f = R.frais(E, B, aid || null, du, au);
    const libA = aid === 'commun' ? 'les dépenses communes' : aid ? 'cet animal' : 'tes animaux';
    const titre = `<div class="vue-tete"><div><h1>Frais</h1><p>Vétérinaire, soins, alimentation, toilettage, assurance, garde… ce que ${libA} te coût${aid && aid !== 'commun' ? 'e' : 'ent'}, par catégorie, par mois et par an.</p></div>
        <div class="actions">${choixAnimal({ avecCommun: true })}<label class="champ choix-periode"><span class="sr-only">Période</span><select id="filtre-periode">${PERIODES.map(([k, l]) => `<option value="${k}" ${filtre.periode === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn primaire" data-action="depense" data-animal="${aid === 'commun' ? '' : aid}">${ICONES.plus}Frais</button></div></div>`;
    if (!E.animaux.length) return `${titre}${videEtat('Aucun animal', 'Ajoute un animal pour noter ses frais.', boutonAjoutAnimal)}${AVERTISSEMENT}`;
    const annuel = R.coutAnnuel(E, B, aid || null, auj());
    const tuiles = [
      ['Total', eurosRond(f.total), PERIODES.find((p) => p[0] === filtre.periode)[1].toLowerCase(), 'var(--encre)', ''],
      ['Par mois', eurosRond(f.coutMensuel), `en moyenne sur ${f.mois.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} mois`, 'var(--bleu)', 'rond'],
      ['Coût annuel', eurosRond(annuel), '12 derniers mois', 'var(--rouge)', 'rond'],
      ['Saisies', String(f.lignes.length), 'frais, soins et visites', 'var(--jaune)', ''],
    ].map(([lib, v, d, col, fo]) => `<div class="tuile ${fo}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const cats = B.categories.map((c) => ({ ...c, total: f.parCategorie[c.code] || 0 })).filter((c) => c.total > 0).sort((x, y) => y.total - x.total);
    const maxC = Math.max(1, ...cats.map((c) => c.total));
    const graphCats = cats.length ? `<figure class="graphique"><figcaption class="sr-only">Frais par catégorie</figcaption><div class="barres-cats">${cats.map((c) => `<div class="barre-cat" tabindex="0" data-info="<b>${esc(c.nom)}</b>${euros(c.total)} · ${f.total ? Math.round(c.total / f.total * 100) : 0} % du total"><span class="bc-nom">${esc(c.nom)}</span><span class="bc-piste"><span class="bc-barre" style="width:${c.total / maxC * 100}%"></span></span><span class="bc-val">${eurosRond(c.total)}</span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>` : '<div class="vide-etat petit"><div><h3>Aucun frais sur cette période</h3><p>Note un frais, ou le coût d\'un soin ou d\'une visite.</p></div></div>';
    const mois = R.fraisParMois(E, B, aid || null, au, 12);
    const maxM = Math.max(1, ...mois.map((m) => m.total));
    const iMax = mois.reduce((im, m, i) => (m.total > mois[im].total ? i : im), 0);
    const nomMois = (m) => fmt(`${m}-01`, { month: 'short' }).replace('.', '');
    const graphMois = `<figure class="graphique"><figcaption class="sr-only">Frais par mois, 12 derniers mois</figcaption><div class="projection">${mois.map((m, i) => `<div class="col-proj ${i === mois.length - 1 ? 'actif' : ''} ${i === iMax ? 'max' : ''}" tabindex="0" data-info="<b>${esc(fmt(`${m.mois}-01`, { month: 'long', year: 'numeric' }))}</b>${euros(m.total)}"><span class="cp-val">${m.total ? eurosRond(m.total).replace(/\s?€/, '') : ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${m.total / maxM * 100}%"></span></span><span class="cp-mois">${nomMois(m.mois)}</span></div>`).join('')}</div><div class="infobulle" hidden></div>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Mois</th><th class="nb">Frais</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${esc(fmt(`${m.mois}-01`, { month: 'long', year: 'numeric' }))}</td><td class="nb">${euros(m.total)}</td></tr>`).join('')}</tbody></table></div></details></figure>`;
    const ans = R.fraisParAn(E, B, aid || null, auj());
    const maxA = Math.max(1, ...ans.map((x) => x.total));
    const graphAns = ans.length ? `<figure class="graphique"><figcaption class="sr-only">Frais par année civile</figcaption><div class="barres-cats">${ans.slice().reverse().map((x) => `<div class="barre-cat" tabindex="0" data-info="<b>${x.annee}</b>${euros(x.total)}${String(x.annee) === auj().slice(0, 4) ? ' · année en cours' : ''}"><span class="bc-nom">${x.annee}${String(x.annee) === auj().slice(0, 4) ? ' <small>(en cours)</small>' : ''}</span><span class="bc-piste"><span class="bc-barre" style="width:${x.total / maxA * 100}%"></span></span><span class="bc-val">${eurosRond(x.total)}</span></div>`).join('')}</div><div class="infobulle" hidden></div></figure>` : '';
    const lignes = f.lignes.filter((x) => !filtre.categorie || x.categorie === filtre.categorie);
    const nbC = (c) => f.lignes.filter((x) => !c || x.categorie === c).length;
    const filtresCat = [['', 'Toutes'], ...B.categories.filter((c) => nbC(c.code)).map((c) => [c.code, c.nom.replace(/ \(.*\)$/, '')])];
    const journal = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Filtrer par catégorie">${filtresCat.map(([k, l]) => `<button class="filtre" data-action="filtre-categorie" data-categorie="${k}" aria-pressed="${filtre.categorie === k}">${esc(l)} <small>${nbC(k)}</small></button>`).join('')}</div><button class="btn petit" data-action="csv">Exporter en CSV</button></div>
      ${lignes.length ? `<ul class="journal">${lignes.slice(0, filtre.tout ? 500 : 25).map(ligneJournal).join('')}</ul>${lignes.length > 25 && !filtre.tout ? `<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="journal-tout">Afficher les ${pluriel(lignes.length, 'ligne')}</button></div>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucun frais</h3><p>Rien sur cette période pour ce filtre.</p></div></div>'}`;
    return `${titre}<div class="tuiles">${tuiles}</div>
      ${!aid ? '<p class="aide" style="margin-top:14px">« Tous les animaux » comprend les dépenses communes (litière partagée, matériel…). Le coût de chaque soin fait et de chaque visite est compté automatiquement.</p>' : ''}
      <div class="colonnes-graph"><section><h2 class="titre-section">Par catégorie</h2>${graphCats}</section><section><h2 class="titre-section">Par mois <span>12 derniers mois, en euros</span></h2>${graphMois}</section></div>
      ${ans.length ? `<h2 class="titre-section">Par année <span>année civile</span></h2>${graphAns}` : ''}
      <h2 class="titre-section">Journal <span>${pluriel(lignes.length, 'ligne')}</span></h2>${journal}
      ${AVERTISSEMENT}`;
  }

  function ligneJournal(x) {
    const cat = categorie(x.categorie);
    const action = x.source === 'depense' ? 'depense' : x.source === 'visite' ? 'visite' : 'fait';
    return `<li><button class="lien-ligne" data-action="${action}" data-id="${x.id}"><b>${esc(cat?.nom.replace(/ \(.*\)$/, '') || x.categorie)}${x.libelle ? ` <span class="numero">${esc(x.libelle)}</span>` : ''}</b><span>${dateCourte(x.date)} · ${esc(nomA(x.animalId))}${x.source !== 'depense' ? ` · depuis ${x.source === 'visite' ? 'une visite' : 'un soin fait'}` : ''}</span></button><span class="nb">${euros(x.montant)}</span></li>`;
  }

  // ---------- Animaux ----------
  function vueAnimaux() {
    const liste = [...E.animaux].sort((a, b) => (a.actif === false) - (b.actif === false));
    const la = liste.filter((a) => a.actif !== false), partis = liste.filter((a) => a.actif === false);
    return `<div class="vue-tete"><div><h1>Animaux</h1><p>La fiche de chaque animal et son carnet de suivi, à imprimer ou à copier (pension, garde, nouveau vétérinaire).</p></div>
        <div class="actions">${boutonAjoutAnimal}</div></div>
      ${la.length ? `<ul class="animaux">${la.map(carteAnimal).join('')}</ul>` : videEtat('Aucun animal', 'Ajoute ton animal pour commencer son suivi.', boutonAjoutAnimal)}
      ${partis.length ? `<h2 class="titre-section">Ne font plus partie du foyer <span>gardés pour leur historique</span></h2><ul class="animaux">${partis.map(carteAnimal).join('')}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }

  function carteAnimal(a) {
    const s = synth(a);
    const inactif = a.actif === false;
    const p = s.prochain;
    const annuel = R.coutAnnuel(E, B, a.id, auj());
    const fiche = [a.race, a.sexe === 'F' ? 'Femelle' : a.sexe === 'M' ? 'Mâle' : '', a.sterilise === 'oui' ? 'stérilisé(e)' : a.sterilise === 'non' ? 'non stérilisé(e)' : ''].filter(Boolean).join(' · ');
    return `<li class="animal ${inactif ? 'inactif' : ''}" style="--c:${inactif ? 'var(--trait)' : couleurEtat(s.pire)}">
      <div class="an-tete"><div class="an-nom"><b>${esc(a.nom)}</b><small>${esc(fiche || especeNom(a))}${inactif ? ` · parti${a.departLe ? ` le ${dateCourte(a.departLe)}` : ''}` : ''}</small></div>${pastilleEspece(a)}</div>
      <div class="an-chiffres">
        <div><b>${s.age ? esc(R.texteAge(s.age)) : '–'}</b><span>${a.naissance ? `né(e) le ${dateCourte(a.naissance)}` : 'âge inconnu'}</span></div>
        <div><b>${s.poids.dernier ? kg(s.poids.dernier.poids) : '–'}</b><span>${s.poids.dernier ? `pesé ${quand(s.poids.dernier.date)}` : 'pas encore pesé'}</span></div>
        <div><b>${eurosRond(annuel)}</b><span>sur 12 mois</span></div>
      </div>
      <ul class="an-infos">${a.identification ? `<li><span>Identification</span> ${esc(a.identification)}</li>` : ''}${a.veterinaire ? `<li><span>Vétérinaire</span> ${esc(a.veterinaire)}</li>` : ''}${!inactif ? `<li>${p ? `${etiquetteEtat(p.etat)} ${esc(p.soin.nom)} : ${dateCourte(p.prochaine)}` : 'Aucun soin planifié'}</li>` : ''}</ul>
      ${a.notes ? `<p class="an-notes">${esc(a.notes)}</p>` : ''}
      <div class="rang an-actions">${inactif ? '' : `<button class="btn petit" data-action="pesee" data-animal="${a.id}">Pesée</button>`}<button class="btn petit" data-action="carnet" data-id="${a.id}">Carnet</button><button class="btn petit" data-action="animal" data-id="${a.id}">Modifier</button></div>
    </li>`;
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
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const optionsAnimaux = (val, tous = false) => (tous ? E.animaux : E.animaux.filter((a) => a.actif !== false || a.id === val)).map((a) => `<option value="${a.id}" ${a.id === val ? 'selected' : ''}>${esc(a.nom)}</option>`).join('');
  const animalParDefaut = (val) => (val && animal(val) ? val : (choisi() && choisi() !== 'commun' ? choisi() : '') || presents()[0]?.id || E.animaux[0]?.id);
  const lireMontant = (s) => (String(s ?? '').trim() ? R.lireNombre(String(s).replace(/€/g, '')) : 0);
  const valMontant = (n) => (n ? String(n).replace('.', ',') : '');
  function enregistrer(liste, objet, message) {
    retenir();
    const i = E[liste].findIndex((x) => x.id === objet.id);
    if (i >= 0) E[liste][i] = objet; else E[liste].push(objet);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  function supprimer(liste, id, message) {
    retenir();
    E[liste] = E[liste].filter((x) => x.id !== id);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  const radios = (nom, val, opts) => `<div class="choix-statut ${opts.length === 3 ? 'trois' : 'deux'}">${opts.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${val === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;

  // Animal : identité, naissance, identification libre, vétérinaire, notes ; soins proposés à la création.
  function modaleAnimal(id) {
    const a = id ? animal(id) : null;
    if (id && !a) return;
    const x = a || { nom: '', espece: 'chien', especeAutre: '', race: '', sexe: '', naissance: '', sterilise: '', identification: '', veterinaire: '', notes: '', actif: true, departLe: '' };
    const corps = `
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="40" value="${esc(x.nom)}" required></label>
        <label class="champ">Espèce<select name="espece">${optionsEspece(x.espece)}</select></label></div>
      <div class="rang-champs"><label class="champ" data-autre ${x.espece === 'autre' ? '' : 'hidden'}>Laquelle ?<input name="especeAutre" maxlength="40" value="${esc(x.especeAutre)}" placeholder="Lapin, furet, oiseau…"></label>
        <label class="champ">Race<small>Facultatif.</small><input name="race" maxlength="60" value="${esc(x.race)}"></label></div>
      <div class="rang-champs"><label class="champ">Date de naissance<small>Même approximative.</small><input type="date" name="naissance" value="${x.naissance || ''}" max="${auj()}"></label>
        <label class="champ">Sexe<select name="sexe"><option value="">Non précisé</option><option value="F" ${x.sexe === 'F' ? 'selected' : ''}>Femelle</option><option value="M" ${x.sexe === 'M' ? 'selected' : ''}>Mâle</option></select></label>
        <label class="champ">Stérilisé(e)<select name="sterilise"><option value="">Non précisé</option><option value="oui" ${x.sterilise === 'oui' ? 'selected' : ''}>Oui</option><option value="non" ${x.sterilise === 'non' ? 'selected' : ''}>Non</option></select></label></div>
      <label class="champ">Identification<small>Saisie libre, telle qu'elle figure sur ses papiers (puce, tatouage, autre).</small><input name="identification" maxlength="80" value="${esc(x.identification)}"></label>
      <label class="champ">Vétérinaire habituel<small>Facultatif : nom du cabinet, comme repère.</small><input name="veterinaire" maxlength="120" value="${esc(x.veterinaire)}"></label>
      <label class="champ">Notes<textarea name="notes" maxlength="500">${esc(x.notes)}</textarea></label>
      ${a ? `<div class="cadre-champs"><label class="case"><input type="checkbox" name="parti" ${x.actif === false ? 'checked' : ''}> Ne fait plus partie du foyer (gardé pour son historique, sans alerte)</label><label class="champ">Depuis le<input type="date" name="departLe" value="${x.departLe || ''}"></label></div>`
        : `<fieldset class="champ cadre-champs"><legend>Soins à suivre <small>Noms seulement : l'intervalle se saisit ensuite, d'après ton vétérinaire.</small></legend><div class="cases-ops" data-modeles>${casesModeles(x.espece)}</div></fieldset>`}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a ? 'Modifier l\'animal' : 'Nouvel animal', corps, PIED(!!a), (fd, choix) => {
      if (choix === 'supprimer') {
        const n = ['soins', 'faits', 'pesees', 'visites', 'depenses'].reduce((s, l) => s + E[l].filter((y) => y.animalId === a.id).length, 0);
        if (!confirm(`Supprimer « ${a.nom} »${n ? ` et ses ${pluriel(n, 'saisie')}` : ''} ? Pour garder son historique, coche plutôt « Ne fait plus partie du foyer ».`)) return '';
        retenir(); E = R.supprimerAnimal(E, a.id); sauver(); rendre();
        toast('Animal supprimé.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      if (!String(fd.get('nom')).trim()) return 'Indique son nom.';
      const nais = fd.get('naissance');
      if (nais && nais > auj()) return 'La date de naissance ne peut pas être dans le futur.';
      const n = R.normaliserAnimal({ ...(a || {}), id: a?.id || uid(), nom: fd.get('nom'), espece: fd.get('espece'), especeAutre: fd.get('especeAutre'), race: fd.get('race'), naissance: nais || null, sexe: fd.get('sexe'), sterilise: fd.get('sterilise'), identification: fd.get('identification'), veterinaire: fd.get('veterinaire'), notes: fd.get('notes'),
        actif: a ? !fd.get('parti') : true, departLe: fd.get('parti') ? (fd.get('departLe') || auj()) : null });
      if (a) { enregistrer('animaux', n, 'Fiche enregistrée.'); return undefined; }
      retenir();
      E.animaux.push(n);
      E.soins.push(...R.soinsModeles(B, n.espece, n.id, fd.getAll('modele').map(Number)));
      sauver(); rendre();
      toast(`${n.nom} est ajouté(e). Saisis l'intervalle de ses soins d'après ton vétérinaire.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    const d = modale();
    d.querySelector('[name=espece]').addEventListener('change', (ev) => {
      d.querySelector('[data-autre]').hidden = ev.target.value !== 'autre';
      const m = d.querySelector('[data-modeles]');
      if (m) m.innerHTML = casesModeles(ev.target.value);
    });
  }

  // Soin récurrent : nom, type, intervalle saisi d'après le vétérinaire, dernière fois et prochaine date connues.
  function modaleSoin(id, animalId) {
    if (!E.animaux.length) return toast('Ajoute d\'abord un animal.');
    const s = id ? E.soins.find((x) => x.id === id) : null;
    if (id && !s) return;
    const aid = s?.animalId || animalParDefaut(animalId);
    const x = s || { type: 'VAC', nom: '', intervalle: 0, unite: 'mois', depuis: '', prochaine: '', note: '', actif: true };
    const nbFaits = s ? R.faitsDe(E.faits, s.id).length : 0;
    const corps = `<label class="champ">Animal<select name="animalId" ${s ? 'disabled' : ''}>${optionsAnimaux(aid, !!s)}</select></label>
      <div class="rang-champs"><label class="champ">Type<select name="type">${B.types.map((t) => `<option value="${t.code}" ${x.type === t.code ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        <label class="champ">Nom du soin<input name="nom" maxlength="80" value="${esc(x.nom)}" placeholder="Ex. : rappel de vaccin" required></label></div>
      <fieldset class="champ cadre-champs"><legend>Intervalle <small>Celui que ton vétérinaire t'a indiqué (carnet de santé, ordonnance). L'outil ne propose aucune durée. Laisse vide pour un soin sans rythme fixe.</small></legend>
        <div class="rang-champs"><label class="champ">Tous les<input name="intervalle" inputmode="numeric" value="${x.intervalle || ''}" placeholder="—"></label>
          <label class="champ">Unité<select name="unite">${R.UNITES.map(([u]) => `<option value="${u}" ${x.unite === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div></fieldset>
      <div class="rang-champs"><label class="champ">Dernière fois connue<small>${nbFaits ? 'Remplacée par les soins faits notés.' : 'Avant de tenir ce suivi.'}</small><input type="date" name="depuis" value="${x.depuis || ''}" max="${auj()}"></label>
        <label class="champ">Prochaine date notée<small>Si le vétérinaire l'a fixée (sinon calculée).</small><input type="date" name="prochaine" value="${x.prochaine || ''}"></label></div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(x.note)}"></label>
      ${s ? `<label class="case"><input type="checkbox" name="pause" ${x.actif === false ? 'checked' : ''}> En pause (aucune alerte)</label>` : ''}
      <p class="aide">Aucun calendrier de vaccins ni d'antiparasitaires n'est intégré à l'outil : les rythmes varient selon l'animal, son mode de vie et les produits. Ton vétérinaire est la référence.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Modifier le soin' : 'Nouveau soin', corps, PIED(!!s), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer le soin « ${s.nom} »${nbFaits ? ` et ses ${pluriel(nbFaits, 'saisie')}` : ''} ?`)) return '';
        retenir(); E = R.supprimerSoin(E, s.id); sauver(); rendre();
        toast('Soin supprimé.', { libelle: 'Annuler', faire: annuler });
        return undefined;
      }
      if (!String(fd.get('nom')).trim()) return 'Donne un nom au soin.';
      const iv = String(fd.get('intervalle') || '').trim() ? R.lireNombre(fd.get('intervalle')) : 0;
      if (iv === null || iv > 999 || (iv && iv !== Math.round(iv))) return 'Intervalle illisible : écris un nombre entier (ex. 3 et « mois »).';
      const n = R.normaliserSoin({ ...(s || {}), id: s?.id || uid(), animalId: s ? s.animalId : fd.get('animalId'), type: fd.get('type'), nom: fd.get('nom'), intervalle: iv, unite: fd.get('unite'), depuis: fd.get('depuis') || null, prochaine: fd.get('prochaine') || null, note: fd.get('note'), actif: !fd.get('pause') }, B);
      enregistrer('soins', n, s ? 'Soin enregistré : l\'échéance est recalculée.' : 'Soin ajouté.');
      return undefined;
    });
    const d = modale();
    d.querySelector('[name=type]').addEventListener('change', (ev) => { const nom = d.querySelector('[name=nom]'); if (!s && !nom.value) nom.value = B.types.find((t) => t.code === ev.target.value)?.nom.replace(/ \(.*\)$/, '') || ''; });
  }

  // Soin fait : date, prochaine date indiquée par le vétérinaire (facultative), par qui, coût, note.
  function modaleFait(id, soinId, animalId) {
    if (!E.animaux.length) return toast('Ajoute d\'abord un animal.');
    const f = id ? E.faits.find((x) => x.id === id) : null;
    if (id && !f) return;
    const s0 = E.soins.find((x) => x.id === (f?.soinId || soinId));
    const aid = f?.animalId || s0?.animalId || animalParDefaut(animalId);
    const soinsDe = (a2) => E.soins.filter((x) => x.animalId === a2 && (x.actif !== false || x.id === s0?.id));
    if (!soinsDe(aid).length && !f) { toast(`Ajoute d'abord un soin à suivre pour ${nomA(aid)}.`); return modaleSoin(null, aid); }
    const x = f || { date: auj(), prochaine: '', par: '', cout: 0, note: '' };
    const options = (a2, val) => soinsDe(a2).map((y) => `<option value="${y.id}" ${y.id === val ? 'selected' : ''}>${esc(y.nom)}</option>`).join('');
    const corps = `<div class="rang-champs"><label class="champ">Animal<select name="animalId" ${f ? 'disabled' : ''}>${optionsAnimaux(aid, !!f)}</select></label>
        <label class="champ">Soin<select name="soinId" ${f ? 'disabled' : ''}>${options(aid, s0?.id)}</select></label></div>
      <div class="rang-champs"><label class="champ">Fait le<input type="date" name="date" value="${x.date}" max="${auj()}"></label>
        <label class="champ">Prochaine date fixée<small>Facultatif : si le vétérinaire l'a inscrite. Sinon, calculée avec l'intervalle.</small><input type="date" name="prochaine" value="${x.prochaine || ''}"></label></div>
      <p class="aide" data-apercu></p>
      <div class="rang-champs"><label class="champ">Par<small>Facultatif : clinique, toiletteur, à la maison…</small><input name="par" maxlength="80" value="${esc(x.par)}"></label>
        <label class="champ">Coût (€)<small>Compté dans les frais.</small><input name="cout" inputmode="decimal" value="${valMontant(x.cout)}"></label></div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(x.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(f ? 'Modifier le soin fait' : 'Soin fait', corps, PIED(!!f), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer ce soin fait ?')) return ''; supprimer('faits', f.id, 'Soin fait supprimé : l\'échéance est recalculée.'); return undefined; }
      const date = fd.get('date');
      if (!R.estDate(date) || date > auj()) return 'Date illisible ou future.';
      const pr = fd.get('prochaine');
      if (pr && pr <= date) return 'La prochaine date doit être après la date du soin.';
      const cout = lireMontant(fd.get('cout'));
      if (cout === null) return 'Coût illisible : écris par exemple 45,90.';
      const soinIdF = f ? f.soinId : fd.get('soinId');
      if (!soinIdF) return 'Choisis le soin.';
      const s = E.soins.find((y) => y.id === soinIdF);
      enregistrer('faits', R.normaliserFait({ id: f?.id || uid(), soinId: soinIdF, animalId: s?.animalId || aid, date, prochaine: pr || null, par: fd.get('par'), cout, note: fd.get('note') }), 'Soin noté : la prochaine échéance est recalculée.');
      return undefined;
    });
    const d = modale();
    const maj = () => {
      const s = E.soins.find((y) => y.id === (f ? f.soinId : d.querySelector('[name=soinId]').value));
      const date = d.querySelector('[name=date]').value, pr = d.querySelector('[name=prochaine]').value;
      const calc = s && R.ajoutIntervalle(date, s.intervalle, s.unite);
      d.querySelector('[data-apercu]').textContent = pr ? `Prochaine échéance : ${dateLongue(pr)} (date fixée).` : calc ? `Prochaine échéance calculée : ${dateLongue(calc)} (${texteIntervalle(s)}).` : s ? 'Aucun intervalle saisi pour ce soin : indique la prochaine date, ou complète le soin dans l\'onglet Soins.' : '';
    };
    d.querySelector('[name=animalId]').addEventListener('change', (ev) => { d.querySelector('[name=soinId]').innerHTML = options(ev.target.value, null); maj(); });
    d.querySelectorAll('[name=soinId],[name=date],[name=prochaine]').forEach((el) => el.addEventListener('change', maj));
    maj();
  }

  function modalePesee(id, animalId) {
    if (!E.animaux.length) return toast('Ajoute d\'abord un animal.');
    const p = id ? E.pesees.find((x) => x.id === id) : null;
    if (id && !p) return;
    const aid = p?.animalId || animalParDefaut(animalId);
    const x = p || { date: auj(), poids: '', note: '' };
    const corps = `<label class="champ">Animal<select name="animalId" ${p ? 'disabled' : ''}>${optionsAnimaux(aid, !!p)}</select></label>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${x.date}" max="${auj()}"></label><label class="champ">Poids<small>En kg (ex. 4,25) ou en g (ex. 850 g).</small><input name="poids" inputmode="decimal" value="${x.poids ? String(x.poids).replace('.', ',') : ''}" required></label></div>
      <label class="champ">Note<small>Facultatif : chez le vétérinaire, à la maison…</small><input name="note" maxlength="120" value="${esc(x.note)}"></label>
      <p class="aide" data-dernier></p><p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier la pesée' : 'Pesée', corps, PIED(!!p), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer cette pesée ?')) return ''; supprimer('pesees', p.id, 'Pesée supprimée.'); return undefined; }
      const date = fd.get('date');
      if (!R.estDate(date) || date > auj()) return 'Date illisible ou future.';
      const kgv = R.lirePoids(fd.get('poids'));
      if (kgv === null) return 'Poids illisible : écris par exemple 4,25 (kg) ou 850 g.';
      enregistrer('pesees', R.normaliserPesee({ id: p?.id || uid(), animalId: p ? p.animalId : fd.get('animalId'), date, poids: kgv, note: fd.get('note') }), `Pesée notée : ${kg(kgv)}.`);
      return undefined;
    });
    const maj = () => { const a = animal(modale().querySelector('[name=animalId]').value); const s = a && synth(a); modale().querySelector('[data-dernier]').textContent = s?.poids.dernier ? `Dernière pesée : ${kg(s.poids.dernier.poids)}, le ${dateCourte(s.poids.dernier.date)}.` : 'Première pesée de cet animal.'; };
    modale().querySelector('[name=animalId]').addEventListener('change', maj); maj();
  }

  // Visite : motif, vétérinaire, ce qui a été dit, traitement recopié de l'ordonnance (texte libre), coût.
  function modaleVisite(id, animalId) {
    if (!E.animaux.length) return toast('Ajoute d\'abord un animal.');
    const v = id ? E.visites.find((x) => x.id === id) : null;
    if (id && !v) return;
    const aid = v?.animalId || animalParDefaut(animalId);
    const x = v || { date: auj(), motif: '', veterinaire: animal(aid)?.veterinaire || '', notes: '', traitement: '', finTraitement: '', cout: 0 };
    const corps = `<div class="rang-champs"><label class="champ">Animal<select name="animalId" ${v ? 'disabled' : ''}>${optionsAnimaux(aid, !!v)}</select></label><label class="champ">Date<input type="date" name="date" value="${x.date}"></label></div>
      <label class="champ">Motif<input name="motif" maxlength="120" value="${esc(x.motif)}" placeholder="Ex. : rappel, contrôle, il se gratte…"></label>
      <label class="champ">Vétérinaire<small>Facultatif.</small><input name="veterinaire" maxlength="120" value="${esc(x.veterinaire)}"></label>
      <label class="champ">Ce qu'a dit le vétérinaire<small>Tes notes, pour t'en souvenir.</small><textarea name="notes" maxlength="1000">${esc(x.notes)}</textarea></label>
      <fieldset class="champ cadre-champs"><legend>Traitement prescrit <small>Recopie-le tel qu'il est écrit sur l'ordonnance. L'outil ne propose aucun médicament ni aucune dose, et ne vérifie rien.</small></legend>
        <label class="champ"><span class="sr-only">Traitement</span><textarea name="traitement" maxlength="500">${esc(x.traitement)}</textarea></label>
        <label class="champ">Jusqu'au<small>Facultatif : affiché « en cours » jusqu'à cette date.</small><input type="date" name="finTraitement" value="${x.finTraitement || ''}"></label></fieldset>
      <label class="champ">Coût de la visite (€)<small>Compté dans les frais (catégorie Vétérinaire). Les médicaments achetés à part se notent dans Frais.</small><input name="cout" inputmode="decimal" value="${valMontant(x.cout)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(v ? 'Modifier la visite' : 'Visite chez le vétérinaire', corps, PIED(!!v), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer cette visite ?')) return ''; supprimer('visites', v.id, 'Visite supprimée.'); return undefined; }
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Date illisible.';
      const fin = fd.get('finTraitement');
      if (fin && fin < date) return 'La fin du traitement précède la visite.';
      const cout = lireMontant(fd.get('cout'));
      if (cout === null) return 'Coût illisible : écris par exemple 55 ou 48,50.';
      if (!String(fd.get('motif')).trim() && !String(fd.get('notes')).trim()) return 'Indique au moins le motif de la visite.';
      enregistrer('visites', R.normaliserVisite({ id: v?.id || uid(), animalId: v ? v.animalId : fd.get('animalId'), date, motif: fd.get('motif'), veterinaire: fd.get('veterinaire'), notes: fd.get('notes'), traitement: fd.get('traitement'), finTraitement: fin || null, cout }), 'Visite notée.');
      return undefined;
    });
  }

  // Frais saisi à la main (alimentation, assurance, garde…), pour un animal ou commun.
  function modaleDepense(id, animalId) {
    if (!E.animaux.length) return toast('Ajoute d\'abord un animal.');
    const dp = id ? E.depenses.find((x) => x.id === id) : null;
    if (id && !dp) return;
    const aid = dp ? dp.animalId : (animalId === '' && !choisi() ? animalParDefaut('') : animalParDefaut(animalId));
    const x = dp || { date: auj(), categorie: 'ALI', montant: '', libelle: '' };
    const corps = `<div class="rang-champs"><label class="champ">Pour<select name="animalId">${optionsAnimaux(aid, !!dp)}<option value="" ${dp && !dp.animalId ? 'selected' : ''}>Commun à tous</option></select></label>
        <label class="champ">Date<input type="date" name="date" value="${x.date}" max="${auj()}"></label></div>
      <div class="rang-champs"><label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.code}" ${x.categorie === c.code ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${valMontant(x.montant)}" required></label></div>
      <label class="champ">Libellé<small>Facultatif. Sans nom de marque si tu partages le carnet.</small><input name="libelle" maxlength="120" value="${esc(x.libelle)}"></label>
      <p class="aide">Le coût des soins faits et des visites se note avec eux : il est compté ici automatiquement.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(dp ? 'Modifier le frais' : 'Nouveau frais', corps, PIED(!!dp), (fd, choix) => {
      if (choix === 'supprimer') { if (!confirm('Supprimer ce frais ?')) return ''; supprimer('depenses', dp.id, 'Frais supprimé.'); return undefined; }
      const m = R.lireNombre(String(fd.get('montant') || '').replace(/€/g, ''));
      if (!m) return 'Montant illisible : écris par exemple 46,90.';
      if (!R.estDate(fd.get('date'))) return 'Date illisible.';
      enregistrer('depenses', R.normaliserDepense({ id: dp?.id || uid(), animalId: fd.get('animalId'), date: fd.get('date'), categorie: fd.get('categorie'), montant: m, libelle: fd.get('libelle') }, B), 'Frais noté.');
      return undefined;
    });
  }

  // Carnet de suivi : aperçu, impression et texte à copier.
  function modaleCarnet(id) {
    const a = animal(id);
    if (!a) return;
    let montants = false;
    const corps = `<p>Le carnet de suivi de <b>${esc(a.nom)}</b>, à imprimer ou à copier (pension, garde, nouveau vétérinaire) : fiche, soins et prochaines dates, poids, soins faits et visites.</p>
      <label class="case"><input type="checkbox" name="montants"> Afficher les montants</label>
      <pre class="apercu-histo" data-carnet></pre>`;
    ouvrirModale('Carnet de suivi', corps, '<button class="btn primaire" value="imprimer">Imprimer</button><button class="btn" value="copier">Copier le texte</button><button class="btn" value="annuler">Fermer</button>', (_, choix) => {
      if (choix === 'imprimer') { imprimerCarnet(a, montants); return undefined; }
      if (choix === 'copier') {
        const t = R.texteCarnet(R.carnet(E, B, a, auj(), { montants }), auj());
        navigator.clipboard?.writeText(t).then(() => toast('Carnet copié : colle-le dans un message.'), () => toast('Copie impossible : sélectionne le texte à la main.'));
        modale().dataset.garder = '1';
      }
      return undefined;
    });
    const maj = () => { modale().querySelector('[data-carnet]').textContent = R.texteCarnet(R.carnet(E, B, a, auj(), { montants }), auj()); };
    modale().querySelector('[name=montants]').addEventListener('change', (e) => { montants = e.target.checked; maj(); });
    maj();
  }

  function imprimerCarnet(a, montants) {
    const t = auj();
    const c = R.carnet(E, B, a, t, { montants });
    const el = $('#impression');
    const fiche = [especeNom(a), a.race, a.sexe === 'F' ? 'femelle' : a.sexe === 'M' ? 'mâle' : '', a.sterilise === 'oui' ? 'stérilisé(e)' : '', a.naissance ? `né(e) le ${dateLongue(a.naissance)}${c.age ? ` (${R.texteAge(c.age)})` : ''}` : ''].filter(Boolean);
    el.innerHTML = `<header class="imp-tete"><div><p class="surtitre">Carnet de suivi</p><h1>${esc(a.nom)}</h1><p>${fiche.map(esc).join(' · ')}</p>${a.identification ? `<p>Identification : ${esc(a.identification)}</p>` : ''}${a.veterinaire ? `<p>Vétérinaire : ${esc(a.veterinaire)}</p>` : ''}</div>
      <div class="imp-km"><b>${c.poids.dernier ? kg(c.poids.dernier.poids) : '–'}</b><span>${c.poids.dernier ? `pesé le ${dateLongue(c.poids.dernier.date)}` : 'pas de pesée'}</span></div></header>
      <h2>Soins récurrents</h2>
      <table class="tableau"><thead><tr><th>Soin</th><th>Rythme noté</th><th>Dernier</th><th>Prochain</th></tr></thead><tbody>${c.soins.map((e) => `<tr><td><b>${esc(e.soin.nom)}</b>${e.soin.note ? ` · ${esc(e.soin.note)}` : ''}</td><td>${esc(texteIntervalle(e.soin) || '–')}</td><td>${e.dernier ? dateCourte(e.dernier) : '–'}</td><td>${e.etat === 'pause' ? 'en pause' : e.prochaine ? `${dateCourte(e.prochaine)}${e.etat === 'retard' ? ' (en retard)' : ''}` : '–'}</td></tr>`).join('') || '<tr><td colspan="4">Aucun soin récurrent noté.</td></tr>'}</tbody></table>
      ${c.traitements.length ? `<h2>Traitement en cours</h2>${c.traitements.map((v) => `<p>${esc(v.traitement)} · jusqu'au ${dateLongue(v.finTraitement)}</p>`).join('')}` : ''}
      <h2>Poids</h2>
      ${c.pesees.length ? `<table class="tableau"><thead><tr><th>Date</th><th class="nb">Poids</th></tr></thead><tbody>${c.pesees.slice(0, 12).map((p) => `<tr><td>${dateCourte(p.date)}</td><td class="nb">${kg(p.poids)}</td></tr>`).join('')}</tbody></table>${c.pesees.length > 12 ? `<p class="mention">Les 12 dernières pesées sur ${c.pesees.length}.</p>` : ''}` : '<p>Aucune pesée notée.</p>'}
      <h2>Soins faits et visites</h2>
      <table class="tableau"><thead><tr><th>Date</th><th>Type</th><th>Détail</th><th>Par</th>${montants ? '<th class="nb">Montant</th>' : ''}</tr></thead>
      <tbody>${c.historique.map((l) => `<tr><td>${dateCourte(l.date)}</td><td>${esc(l.type)}</td><td>${esc(l.detail)}</td><td>${esc(l.par)}</td>${montants ? `<td class="nb">${l.montant ? euros(l.montant) : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${montants ? 5 : 4}">Aucun soin ni visite noté.</td></tr>`}</tbody></table>
      <p class="mention">Établi le ${dateLongue(t)} à partir du suivi tenu par le propriétaire. Ne remplace ni le carnet de santé ni l'avis du vétérinaire.</p>`;
    el.hidden = false;
    document.body.classList.add('imprime');
    modale().close();
    const fin = () => { document.body.classList.remove('imprime'); el.hidden = true; window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Alertes</h3><p class="aide">Un soin passe en « Bientôt » quand il reste moins de ces jours. Le rappel de pesée est un simple pense-bête (0 = aucun rappel) : ce n'est pas une fréquence vétérinaire.</p>
        <div class="rang-champs"><label class="champ">Jours avant une échéance<input name="alerteJours" inputmode="numeric" value="${r.alerteJours}"></label><label class="champ">Rappel de pesée (jours)<input name="peseeJours" inputmode="numeric" value="${r.peseeJours}"></label></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tous les frais (saisis, soins faits, visites) ou toutes les pesées, en tableur (CSV). Le carnet de chaque animal s'imprime depuis l'onglet Animaux.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Frais en CSV</button><button class="btn petit" type="button" data-action="csv-poids">Pesées en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton suivi est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le suivi à ton écran d'accueil pour l'ouvrir comme une application, chez le vétérinaire ou au moment de la pesée.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Santé de ton animal</h3><p class="mention">${AVERTISSEMENT_TEXTE}</p></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le suivi est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Il ne contient que ce que tu saisis ; aucune géolocalisation, aucun lien avec un vétérinaire, une assurance ou une autre application.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Types de soins, modèles (noms seulement) et catégories de frais rédigés pour QME (version ${B.version}). Aucun calendrier vaccinal ou antiparasitaire, aucune durée de soin, aucune posologie, aucune marque de produit vétérinaire ou d'aliment.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lire = (nom, maxi) => { const n = R.lireNombre(fd.get(nom)); return n !== null && n <= maxi ? Math.round(n) : null; };
      const vals = { alerteJours: lire('alerteJours', 180), peseeJours: lire('peseeJours', 730) };
      if (Object.values(vals).some((x) => x === null)) return 'Une valeur est illisible ou trop grande : écris un nombre entier.';
      E.reglages = R.normaliserReglages({ ...r, ...vals }, B.reglages);
      sauver(); rendre();
      toast('Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.animaux) || !Array.isArray(donnees.soins)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(donnees.animaux.length, 'animal', 'animaux')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
    });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-animal-${auj()}.json`);
  const exporterCsv = () => telecharger(R.csvFrais(E, B), 'text/csv;charset=utf-8', `frais-animal-${auj()}.csv`);
  const exporterCsvPoids = () => telecharger(R.csvPoids(E), 'text/csv;charset=utf-8', `pesees-animal-${auj()}.csv`);

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
      <p>Enregistre ce suivi sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    const dansModale = !!el.closest('#modale');
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'csv-poids': exporterCsvPoids(); break;
      case 'fermer': modale().close(); break;
      case 'animal': if (dansModale) break; modaleAnimal(id || null); break;
      case 'soin': modaleSoin(id || null, el.dataset.animal); break;
      case 'fait': modaleFait(id || null, el.dataset.soin, el.dataset.animal); break;
      case 'pesee': modalePesee(id || null, el.dataset.animal); break;
      case 'visite': modaleVisite(id || null, el.dataset.animal); break;
      case 'depense': modaleDepense(id || null, el.dataset.animal); break;
      case 'carnet': modaleCarnet(id); break;
      case 'aller-animal': filtre.animal = id; changerVue('soins'); break;
      case 'filtre-categorie': filtre.categorie = el.dataset.categorie; filtre.tout = false; rendre(); break;
      case 'journal-tout': filtre.tout = true; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // La courbe de poids dépend de la largeur (viewBox) : redessinée au passage téléphone / ordinateur.
  MQ_TEL.addEventListener?.('change', () => { if (E && vue === 'suivi' && !modale().open) rendre(); });

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
  window.__animal = { etat: () => E, regles: R };
  init();
})();
