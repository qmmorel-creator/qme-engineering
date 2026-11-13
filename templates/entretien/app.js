// Entretien de la maison QME : calendrier d'entretien calculé, historique et coûts, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ENT;
  const API = '/api/templates';
  const PRODUIT = 'ENT';
  const CLE_CODE = 'qme-ent-code';
  const CLE_CACHE = 'qme-ent-cache';
  const CLE_DEMO = 'qme-ent-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ent-ecran-accueil';

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
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => R.versDate(s).toLocaleDateString('fr-FR', o);
  const fmtMois = (ym, o = { month: 'long', year: 'numeric' }) => R.versDate(`${ym}-01`).toLocaleDateString('fr-FR', o);
  const euros = (n, dec = true) => (typeof n === 'number' ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec && n % 1 ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }) : '–');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const telephone = () => matchMedia('(max-width:720px)').matches;

  const zone = (id) => B.zones.find((z) => z.id === id) || B.zones[6];
  const equipement = (id) => B.equipements.find((e) => e.id === id);
  const regle = (t) => (t.regle ? B.regles[t.regle] : null);
  const LIB_QUI = { locataire: 'Plutôt le locataire', proprietaire: 'Plutôt le propriétaire', selon: 'Selon le bail' };
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const FREQUENCES = [1, 2, 3, 4, 6, 12, 18, 24, 36, 48, 60, 84, 120];

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'echeances';
  let anVu = Number(auj().slice(0, 4));
  let annulation = null;

  const normaliser = R.normaliser;
  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
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
        toast('Un autre appareil a modifié ton calendrier entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (ENT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Maison fictive : dernières réalisations étalées à des dates relatives, historique simulé
  // avec les vraies règles (prochaine échéance = dernière + fréquence), tous les états visibles.
  const COUTS_DEMO = {
    'chaudiere-gaz:0': [138, 'Chauffagiste (contrat d\'entretien)'], 'cheminee:0': [72, 'Ramoneur du secteur'], 'cheminee:1': [95, 'Ramoneur du secteur'],
    'clim:0': [165, 'Frigoriste'], 'adoucisseur:1': [89, 'Technicien adoucisseur'], 'toiture:1': [180, 'Couvreur'],
    'jardin:0': [85, 'Jardinier'], 'jardin:2': [45, 'Atelier motoculture'], 'adoucisseur:0': [7.5, 'Moi'], 'hotte:1': [24, 'Moi'],
    'vmc:1': [32, 'Moi'], 'facade:1': [45, 'Moi (location du nettoyeur)'], 'robinets-ext:1': [60, 'Plombier'],
  };
  function donneesDemo() {
    const t = auj();
    const e = R.etatVide();
    e.prenom = 'Claire'; e.logement = 'maison'; e.statut = 'proprietaire';
    R.appliquerEquipements(e, ['chaudiere-gaz', 'radiateurs', 'cheminee', 'clim', 'robinetterie', 'chauffe-eau', 'adoucisseur', 'vmc', 'entrees-air', 'hotte', 'frigo', 'lave-vaisselle', 'four', 'lave-linge', 'detecteur', 'detecteur-co', 'tableau', 'logement', 'toiture', 'facade', 'jardin', 'robinets-ext', 'arbres'], B, uid);
    const fractions = [0.35, 0.7, 0.92, 1.12, 0.5, 0.8, 0.2, 0.97, 0.6, 1.3, 0.45, 0.85];
    e.taches.forEach((x, i) => {
      if (['arbres:0', 'facade:2'].includes(x.base)) return; // dates inconnues : « à planifier »
      const jours = Math.max(3, Math.round(x.frequence * 30.4 * fractions[i % fractions.length]));
      let d = R.ajout(t, -jours);
      // Historique : la dernière réalisation et les précédentes sur deux ans (trois au plus pour les mensuelles).
      const dates = [];
      const [cout, qui] = COUTS_DEMO[x.base] || [null, ''];
      const nbMax = cout === null && x.frequence < 12 ? 1 : x.frequence < 6 ? 2 : 8;
      for (let k = 0; k < nbMax && d >= R.ajout(t, -730); k++) { dates.push(d); d = R.ajusterSaison(R.ajoutMois(d, -x.frequence), x.saison); }
      if (x.frequence >= 36 || !dates.length) { x.depart = dates[0] || R.ajout(t, -jours); return; }
      dates.reverse().forEach((date, k) => {
        const montant = cout === null ? null : Math.round(cout * (1 - (dates.length - 1 - k) * 0.03) * 100) / 100;
        R.marquerFait(e, x.id, { date, cout: montant, intervenant: qui, note: '' }, t, uid);
      });
    });
    // Seules les tâches forcées ci-dessous restent en retard : les autres ont été faites récemment.
    e.taches.forEach((x, i) => {
      if (R.etatTache(e, x, t).statut !== 'retard') return;
      const [cout, qui] = COUTS_DEMO[x.base] || [null, x.regle ? '' : 'Moi'];
      R.marquerFait(e, x.id, { date: R.ajout(t, -(4 + (i * 7) % 40)), cout, intervenant: qui, note: '' }, t, uid);
    });
    const par = (ref) => e.taches.find((x) => x.base === ref);
    const fixer = (ref, jours, cout, qui, note = '') => {
      const x = par(ref); if (!x) return;
      e.historique = e.historique.filter((h) => h.tache !== x.id || h.date < R.ajout(t, -jours - 200));
      x.depart = null;
      R.marquerFait(e, x.id, { date: R.ajout(t, -jours), cout, intervenant: qui, note }, t, uid);
    };
    // États forcés, relatifs à aujourd'hui.
    fixer('cheminee:0', 410, 72, 'Ramoneur du secteur', 'Certificat de ramonage rangé avec l\'assurance.'); // en retard
    fixer('chaudiere-gaz:0', 70, 138, 'Chauffagiste (contrat d\'entretien)', 'Attestation reçue, pression ajustée.'); // faite en septembre
    fixer('clim:0', 700, 165, 'Frigoriste', 'Contrôle d\'étanchéité fait.'); // bientôt
    fixer('toiture:0', 380, null, 'Moi'); // gouttières en retard
    fixer('detecteur:0', 40, null, 'Moi'); // test du détecteur en retard
    fixer('robinetterie:2', 2, null, 'Moi', 'Robinet d\'arrêt un peu dur, à surveiller.'); // fait il y a deux jours
    const reporte = par('logement:0');
    if (reporte) reporte.reporte = R.ajout(t, 24);
    const inactive = par('four:0');
    if (inactive) inactive.actif = false;
    // Une tâche ajoutée par l'utilisatrice.
    const perso = { id: uid(), base: null, titre: 'Nettoyer le puits de lumière de l\'escalier', equip: null, zone: 'interieur', frequence: 12, saison: [4, 5], depart: null, prevue: null, reporte: null, actif: true, note: 'Échelle dans le garage.', regle: null, qui: 'selon', conseil: '' };
    e.taches.push(perso);
    R.marquerFait(e, perso.id, { date: R.ajout(t, -300), cout: null, intervenant: 'Moi', note: '' }, t, uid);
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Entretien de la maison · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <path d="M10 140 L135 30 L260 140 Z" fill="#D9302A"/>
          <rect x="30" y="150" width="210" height="130" fill="#F5B400"/>
          <rect x="110" y="200" width="50" height="80" fill="#141414"/>
          <rect x="180" y="40" width="34" height="60" fill="#1D4E89"/>
          <circle cx="410" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M410 150 L410 20 A130 130 0 0 1 540 150 Z" fill="#1D4E89"/>
          <rect x="402" y="70" width="16" height="88" fill="#141414"/>
          <rect x="402" y="142" width="70" height="16" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Entretien de la maison</p>
          <h1>Rien d'oublié, chaque saison.</h1>
          <p>Coche les équipements de ton logement : chaudière, ramonage, VMC, gouttières… Le calendrier se calcule seul et garde l'historique de chaque intervention.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton calendrier</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton calendrier est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon calendrier</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de calendrier ? <a href="/catalogue/entretien/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon calendrier'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', logement: 'maison', statut: 'proprietaire', equipements: null, dates: {}, etaler: true };

  function choixEquipements(sel, logement) {
    return B.zones.map((z) => {
      const eqs = B.equipements.filter((e) => e.zone === z.id && !(e.maison && logement === 'appartement'));
      if (!eqs.length) return '';
      return `<fieldset class="groupe-equip" style="--z:${z.couleur}"><legend><i></i>${esc(z.nom)}</legend><div class="choix-equip">${eqs.map((e) => `<label class="puce-equip"><input type="checkbox" name="equip" value="${e.id}" ${sel.includes(e.id) ? 'checked' : ''}><span>${esc(e.nom)}<small>${pluriel(e.taches.length, 'tâche')}${e.taches.some((x) => x.regle) ? ' · obligation' : ''}</small></span></label>`).join('')}</div></fieldset>`;
    }).join('');
  }

  function ecranAccueil() {
    const a = accueil;
    if (!a.equipements) a.equipements = R.equipementsParDefaut(B, a.logement);
    const etapes = `<div class="etapes-lancement" aria-label="Étape ${a.etape} sur 3">${[1, 2, 3].map((i) => `<span class="${i <= a.etape ? 'actif' : ''}"></span>`).join('')}</div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      const carte = (nom, val, titre, detail) => `<label class="type"><input type="radio" name="${nom}" value="${val}" ${a[nom] === val ? 'checked' : ''} data-action="accueil-choix"><b>${titre}</b><span>${detail}</span></label>`;
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ton logement, en deux questions.</h1>
        <p class="intro">Elles servent à proposer les bons équipements et, si tu loues, à indiquer qui fait quoi (à titre indicatif).</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small><input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40"></label>
        <h2 class="titre-section">Type de logement</h2>
        <div class="types">${carte('logement', 'maison', 'Maison', 'Toiture, jardin, extérieurs compris')}${carte('logement', 'appartement', 'Appartement', 'Les parties communes restent à la copropriété')}</div>
        <h2 class="titre-section">Tu es</h2>
        <div class="types">${carte('statut', 'proprietaire', 'Propriétaire', 'Tout l\'entretien est pour toi')}${carte('statut', 'locataire', 'Locataire', 'Répartition indicative affichée sur chaque tâche')}</div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else if (a.etape === 2) {
      corps = `
        <p class="surtitre">Étape 2 sur 3</p>
        <h1>Tes équipements</h1>
        <p class="intro">Coche ce qui existe chez toi : chaque équipement apporte ses tâches types, avec une fréquence que tu pourras changer. Une sélection courante est déjà cochée.</p>
        <div id="choix-equipements">${choixEquipements(a.equipements, a.logement)}</div>
        <div class="accueil-pied"><button class="btn" data-action="accueil-retour">Retour</button><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const obligations = B.equipements.filter((e) => a.equipements.includes(e.id)).flatMap((e) => e.taches.map((x, i) => ({ ...x, ref: R.refBase(e.id, i), equip: e }))).filter((x) => x.regle && B.regles[x.regle].frequence);
      corps = `
        <p class="surtitre">Étape 3 sur 3</p>
        <h1>La dernière fois ?</h1>
        <p class="intro">Pour les obligations, indique le mois de la dernière intervention si tu le sais (sur l'attestation ou la facture). Sinon laisse vide : tu pourras le faire plus tard.</p>
        ${obligations.length ? `<div class="dates-depart">${obligations.map((x) => `<label class="champ"><span>${esc(x.titre)} <small>${esc(x.equip.nom)} · ${R.libelleFrequence(x.frequence).toLowerCase()}</small></span><input type="month" data-ref="${x.ref}" value="${esc(a.dates[x.ref] || '')}" max="${auj().slice(0, 7)}"></label>`).join('')}</div>`
          : '<p class="aide">Aucun de tes équipements n\'a de fréquence réglementaire : tu dateras tes tâches au fil de l\'eau.</p>'}
        <label class="case" style="margin-top:16px"><input type="checkbox" id="acc-etaler" ${a.etaler ? 'checked' : ''}> Étaler les autres tâches sur les 12 prochains mois (première date proposée, modifiable)</label>
        <div class="accueil-pied"><button class="btn" data-action="accueil-retour">Retour</button><button class="btn primaire" data-action="accueil-fin">Créer mon calendrier</button></div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#choix-equipements')?.addEventListener('change', () => { accueil.equipements = [...document.querySelectorAll('#choix-equipements [name=equip]:checked')].map((x) => x.value); });
    document.querySelectorAll('.dates-depart input').forEach((x) => x.addEventListener('change', () => { accueil.dates[x.dataset.ref] = x.value; }));
    $('#acc-etaler')?.addEventListener('change', (e) => { accueil.etaler = e.target.checked; });
  }

  function terminerAccueil() {
    const a = accueil;
    E = R.etatVide();
    E.prenom = a.prenom.trim(); E.logement = a.logement; E.statut = a.statut;
    R.appliquerEquipements(E, a.equipements, B, uid);
    const t = auj();
    for (const [ref, m] of Object.entries(a.dates)) {
      if (!/^\d{4}-\d{2}$/.test(m)) continue;
      const x = E.taches.find((y) => y.base === ref);
      const d = `${m}-01`;
      if (x && d <= t) x.depart = d;
    }
    const nb = a.etaler ? R.etaler(E, t) : 0;
    accueil = { etape: 1, prenom: '', logement: 'maison', statut: 'proprietaire', equipements: null, dates: {}, etaler: true };
    vue = 'echeances';
    sauver();
    demarrer();
    toast(nb ? `Ton calendrier est prêt : ${pluriel(E.taches.length, 'tâche')}, premières dates étalées sur l'année.` : `Ton calendrier est prêt : ${pluriel(E.taches.length, 'tâche')}.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><rect x="11" y="6" width="2" height="7" fill="var(--papier)"/><rect x="11" y="11" width="5" height="2" fill="var(--papier)"/></svg>',
    annee: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    equipements: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 22 11H2Z" fill="currentColor"/><rect x="5" y="12" width="14" height="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    historique: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['echeances', 'Échéances'], ['annee', 'Année'], ['equipements', 'Équipements'], ['historique', 'Historique']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/entretien/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Entretien<br>de la maison</span>
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
    document.title = `${titres[vue]} · Entretien de la maison`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { echeances: vueEcheances, annee: vueAnnee, equipements: vueEquipements, historique: vueHistorique }[vue]();
    if (vue === 'historique') brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Éléments communs ----------
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M4 44 48 6 92 44Z" fill="#D9302A"/><rect x="14" y="46" width="68" height="46" fill="#F5B400"/><circle cx="70" cy="70" r="16" fill="#1D4E89"/></svg>';

  const pilleRegle = (t) => {
    const r = regle(t);
    return r ? `<span class="pille ciel" title="${esc(r.titre)}">Obligation${r.verifie ? '' : ' · à vérifier'}</span>` : '';
  };
  const pilleQui = (t) => (E.statut === 'locataire' ? `<span class="pille sable">${LIB_QUI[t.qui] || LIB_QUI.selon}</span>` : '');
  const sousTitre = (t) => [equipement(t.equip)?.nom || 'Ma tâche', R.libelleFrequence(t.frequence).toLowerCase(), R.libelleSaison(t.saison) ? `de préférence ${R.libelleSaison(t.saison)}` : ''].filter(Boolean).join(' · ');

  function libelleEcheance(x) {
    if (!x.prochaine) return 'Date inconnue';
    if (x.statut === 'retard') return `En retard de ${pluriel(-x.jours, 'jour')}`;
    if (x.jours === 0) return 'Aujourd\'hui';
    if (x.jours === 1) return 'Demain';
    return `${x.tache.reporte ? 'Reporté au' : 'Le'} ${fmt(x.prochaine, { day: 'numeric', month: 'long', year: x.prochaine.slice(0, 4) === auj().slice(0, 4) ? undefined : 'numeric' })}`;
  }

  function ligneTache(x, opts = {}) {
    const t = x.tache;
    const z = zone(t.zone);
    const derniere = x.derniere ? `Dernière fois : ${fmt(x.derniere)}` : 'Jamais notée';
    return `<li class="ligne-tache st-${x.statut}" style="--z:${z.couleur}">
      <i class="bande" aria-hidden="true"></i>
      <button class="ligne-info" data-action="tache" data-id="${t.id}">
        <span class="h">${esc(libelleEcheance(x))}</span>
        <b>${esc(t.titre)}</b>
        <span>${esc(sousTitre(t))}</span>
        <span class="pilles"><span class="pille zone">${esc(z.nom)}</span>${pilleRegle(t)}${pilleQui(t)}<span class="discret">${esc(derniere)}</span></span>
      </button>
      <div class="ligne-droite">
        ${opts.inconnue ? `<button class="btn petit" data-action="date-connue" data-id="${t.id}">J'ai la date</button>` : `<button class="btn petit" data-action="reporter" data-id="${t.id}">Reporter</button>`}
        <button class="btn petit primaire" data-action="fait" data-id="${t.id}">Fait</button>
      </div></li>`;
  }

  // ---------- Échéances ----------
  function vueEcheances() {
    const t = auj();
    const g = R.echeances(E, t);
    const an = R.totalCouts(E, R.ajoutMois(R.debutMois(t), -11), t); // mêmes 12 mois que l'historique
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const nbR = g.retard.length, nbM = g.mois.length;
    const titre = nbR ? `${salut}<mark>${pluriel(nbR, 'tâche')} en retard</mark>${nbM ? ` et ${nbM} ce mois-ci.` : '.'}` : nbM ? `${salut}<mark>${pluriel(nbM, 'tâche')}</mark> ce mois-ci.` : `${salut}Rien d'urgent.`;
    const tuile = (lib, v, d, c, f = '') => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`;
    const section = (cle, titreS, aide, opts) => g[cle].length ? `<h2 class="titre-section" id="s-${cle}">${titreS} <span>${aide}</span></h2><ul class="lignes-taches">${g[cle].map((x) => ligneTache(x, opts)).join('')}</ul>` : '';
    const vide = !E.taches.some((x) => x.actif);
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          <p class="sous">${pluriel(E.taches.filter((x) => x.actif).length, 'tâche suivie', 'tâches suivies')} pour ${pluriel(E.equipements.length, 'équipement')}. Les fréquences d'origine réglementaire sont marquées «&nbsp;Obligation&nbsp;» : à vérifier selon ton département et ton bail.</p>
          <div class="actions"><button class="btn primaire" data-action="tache-nouvelle">${ICONES.plus}Tâche</button><button class="btn" data-action="vue" data-vue="annee">Voir l'année</button></div>
        </div>
        <div class="tuiles tuiles-2">
          ${tuile('En retard', nbR, nbR ? 'à faire dès que possible' : 'tout est à jour', 'var(--rouge)', 'rond')}
          ${tuile('Ce mois-ci', nbM, `d'ici le ${fmt(R.finMois(t), { day: 'numeric', month: 'long' })}`, 'var(--jaune)')}
          ${tuile('À venir', g.avenir.length, `dans les ${R.HORIZON_AVENIR} prochains jours`, 'var(--bleu)')}
          ${tuile('Dépensé sur 12 mois', euros(an.total, false), pluriel(an.nb, 'intervention notée', 'interventions notées'), 'var(--encre)', 'rond')}
        </div>
      </section>
      ${vide ? `<div class="vide-etat" style="margin-top:24px">${FORME_VIDE}<div><h3>Aucune tâche suivie</h3><p>Coche les équipements de ton logement pour retrouver leurs tâches types.</p><div class="actions"><button class="btn primaire" data-action="equipements-choisir">Choisir mes équipements</button></div></div></div>` : ''}
      ${section('retard', 'En retard', 'L\'échéance est passée : marque «&nbsp;Fait&nbsp;» avec la date réelle, ou reporte.')}
      ${section('mois', 'Ce mois-ci', fmtMois(t.slice(0, 7)))}
      ${section('avenir', 'À venir', `${R.HORIZON_AVENIR} prochains jours`)}
      ${g.inconnue.length ? `<h2 class="titre-section">À planifier <span>${pluriel(g.inconnue.length, 'tâche')} sans date : indique la dernière fois, ou laisse le calendrier proposer une première date.</span></h2>
        <div class="rang-actions"><button class="btn petit" data-action="etaler">Étaler sur les 12 prochains mois</button></div>
        <ul class="lignes-taches">${g.inconnue.map((x) => ligneTache(x, { inconnue: true })).join('')}</ul>` : ''}
      ${g.plustard.length ? `<p class="aide" style="margin-top:28px">${pluriel(g.plustard.length, 'autre tâche est prévue', 'autres tâches sont prévues')} plus tard. <button class="btn lien" data-action="vue" data-vue="annee">Voir l'année</button></p>` : ''}
      ${!nbR && !nbM && !g.avenir.length && !g.inconnue.length && !vide ? `<div class="vide-etat" style="margin-top:24px">${FORME_VIDE}<div><h3>Tout est à jour</h3><p>Rien à faire dans les ${R.HORIZON_AVENIR} prochains jours.</p></div></div>` : ''}`;
  }

  // ---------- Année ----------
  function vueAnnee() {
    const t = auj();
    const a = R.annee(E, anVu, t);
    const moisCourant = anVu === Number(t.slice(0, 4)) ? R.moisDe(t) : 0;
    const item = (p) => `<li class="it ${p.retard ? 'retard' : ''}" style="--z:${zone(p.tache.zone).couleur}"><span class="case-imp" aria-hidden="true"></span><button class="btn-texte" data-action="tache" data-id="${p.tache.id}"><b>${esc(p.tache.titre)}</b><span>${p.retard ? `en retard depuis le ${fmt(p.date, { day: 'numeric', month: 'short' })}` : fmt(p.date, { day: 'numeric', month: 'short' })}${regle(p.tache) ? ' · obligation' : ''}</span></button></li>`;
    const fait = (f) => `<li class="it fait" style="--z:${zone(f.tache?.zone).couleur}"><span class="case-imp coche" aria-hidden="true">✓</span><button class="btn-texte" data-action="entree" data-id="${f.entree.id}"><b>${esc(f.tache?.titre || 'Tâche supprimée')}</b><span>fait le ${fmt(f.entree.date, { day: 'numeric', month: 'short' })}${typeof f.entree.cout === 'number' && f.entree.cout ? ` · ${euros(f.entree.cout)}` : ''}${f.entree.intervenant ? ` · ${esc(f.entree.intervenant)}` : ''}</span></button></li>`;
    const mois = a.mois.map((m) => {
      const vide = !m.faits.length && !m.prevus.length;
      return `<section class="mois ${m.mois === moisCourant ? 'courant' : ''} ${m.mois < moisCourant ? 'passe' : ''} ${vide ? 'vide' : ''}" aria-label="${R.MOIS[m.mois - 1]} ${anVu}">
        <h3>${R.MOIS[m.mois - 1]}<span>${m.prevus.length ? pluriel(m.prevus.length, 'à faire', 'à faire') : ''}${m.prevus.length && m.faits.length ? ' · ' : ''}${m.faits.length ? pluriel(m.faits.length, 'fait', 'faits') : ''}</span></h3>
        ${vide ? '<p class="mois-vide">Rien de prévu.</p>' : `<ul>${m.prevus.map(item).join('')}${m.faits.map(fait).join('')}</ul>`}
      </section>`;
    }).join('');
    const total = a.mois.reduce((s, m) => s + m.prevus.length, 0);
    return `
      <div class="vue-tete"><div><h1>Année ${anVu}</h1><p>${pluriel(total, 'intervention prévue', 'interventions prévues')}, plus ${pluriel(a.mensuelles.length, 'tâche mensuelle', 'tâches mensuelles')}. Les dates se recalculent à chaque tâche marquée faite.</p></div>
        <div class="actions">
          <div class="nav-semaine">
            <button class="btn-icone" data-action="an-prec" aria-label="Année précédente">${ICONES.gauche}</button>
            <button class="btn petit" data-action="an-auj" ${anVu === Number(t.slice(0, 4)) ? 'disabled' : ''}>Cette année</button>
            <button class="btn-icone" data-action="an-suiv" aria-label="Année suivante">${ICONES.droite}</button>
          </div>
          <button class="btn" data-action="imprimer">Imprimer la liste</button>
        </div></div>
      <div class="entete-impression"><b>Entretien de la maison · ${anVu}</b><span>${E.prenom ? `${esc(E.prenom)} · ` : ''}imprimé le ${fmt(t)} · fréquences indicatives, obligations à vérifier selon ton département et ton bail</span></div>
      ${a.mensuelles.length ? `<section class="mensuelles"><h2>Chaque mois</h2><ul>${a.mensuelles.map((x) => `<li style="--z:${zone(x.zone).couleur}"><span class="case-imp" aria-hidden="true"></span><button class="btn-texte" data-action="tache" data-id="${x.id}">${esc(x.titre)}${R.libelleSaison(x.saison) ? ` <small>(${esc(R.libelleSaison(x.saison))})</small>` : ''}</button></li>`).join('')}</ul></section>` : ''}
      <div class="grille-mois">${mois}</div>
      ${a.inconnues.length ? `<p class="aide" style="margin-top:20px">${pluriel(a.inconnues.length, 'tâche sans date n\'apparaît', 'tâches sans date n\'apparaissent')} pas : ${a.inconnues.map((x) => esc(x.titre)).join(', ')}. <button class="btn lien" data-action="vue" data-vue="echeances">Les planifier</button></p>` : ''}`;
  }

  // ---------- Équipements ----------
  function vueEquipements() {
    const t = auj();
    const parZone = B.zones.map((z) => {
      const taches = E.taches.filter((x) => x.zone === z.id && (x.actif || E.equipements.includes(x.equip) || !x.equip));
      if (!taches.length) return '';
      const groupes = new Map();
      for (const x of taches) { const k = x.equip || ''; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(x); }
      const blocs = [...groupes.entries()].map(([eq, liste]) => `
        <div class="equip"><h3>${esc(equipement(eq)?.nom || 'Mes tâches')}</h3>
          <ul class="taches-equip">${liste.map((x) => {
            const e = R.etatTache(E, x, t);
            return `<li class="${x.actif ? '' : 'inactive'}"><button class="btn-texte" data-action="tache" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${esc(R.libelleFrequence(x.frequence))}${x.actif ? ` · ${e.prochaine ? `prochaine : ${fmt(e.prochaine)}` : 'date inconnue'}` : ' · désactivée'}</span></button>${pilleRegle(x)}${x.actif && e.statut === 'retard' ? '<span class="pille rose">En retard</span>' : ''}</li>`;
          }).join('')}</ul></div>`).join('');
      return `<section class="zone-equip" style="--z:${z.couleur}"><h2 class="titre-zone"><i></i>${esc(z.nom)}</h2><div class="equips">${blocs}</div></section>`;
    }).join('');
    const regles = Object.values(B.regles).map((r) => `<li><b>${esc(r.titre)}</b><span>${esc(r.texte)}</span><small>Source : ${esc(r.source)} ${r.verifie ? `Relu le ${fmt(B.verifieLe)}.` : ''}</small></li>`).join('');
    return `
      <div class="vue-tete"><div><h1>Équipements</h1><p>${pluriel(E.equipements.length, 'équipement')} et ${pluriel(E.taches.filter((x) => x.actif).length, 'tâche active', 'tâches actives')}. Touche une tâche pour changer sa fréquence, sa saison ou la désactiver.</p></div>
        <div class="actions"><button class="btn" data-action="equipements-choisir">Choisir mes équipements</button><button class="btn primaire" data-action="tache-nouvelle">${ICONES.plus}Tâche</button></div></div>
      ${parZone || `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun équipement</h3><p>Coche ceux de ton logement pour retrouver leurs tâches types.</p></div></div>`}
      <h2 class="titre-section" id="sources">Obligations et sources <span>Fréquences paramétrables, jamais certaines : à vérifier selon ton département, ton bail et la notice de chaque appareil.</span></h2>
      <ul class="regles">${regles}</ul>
      <p class="aide" style="margin-top:14px">${esc(B.sourceLocatif)}</p>
      <h2 class="titre-section">Conseils</h2>
      <ol class="conseils">${B.conseils.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ol>
      <p class="mention" style="margin-top:24px">Outil d'aide à l'organisation : il ne remplace pas l'avis d'un professionnel ni les obligations de ton bail, de ton assurance ou de ton règlement de copropriété. Fréquences non réglementaires : bonnes pratiques courantes, la notice du fabricant prime.</p>`;
  }

  // ---------- Historique ----------
  function vueHistorique() {
    const t = auj();
    const douze = R.totalCouts(E, R.ajoutMois(R.debutMois(t), -11), t);
    const an = R.totalCouts(E, `${t.slice(0, 4)}-01-01`, t);
    const tous = R.totalCouts(E, '1900-01-01', t);
    const mois = R.coutsMensuels(E, t, 12);
    const max = Math.max(1, ...mois.map((m) => m.total));
    const iMax = mois.findIndex((m) => m.total === max && max > 1);
    const etiquette = (m) => fmtMois(m.mois, { month: 'short' }).replace('.', '');
    const barres = mois.map((m, i) => `<div class="col-cout" tabindex="0" data-info="${esc(`<b>${fmtMois(m.mois)}</b>${euros(m.total)} · ${pluriel(m.nb, 'intervention')}`)}" aria-label="${esc(`${fmtMois(m.mois)} : ${euros(m.total)}, ${pluriel(m.nb, 'intervention')}`)}">
        <span class="cc-zone">${i === iMax ? `<em>${euros(m.total, false)}</em>` : ''}<span class="cc-barre" style="height:${m.total ? Math.max(2, (m.total / max) * 100) : 0}%"></span></span>
        <span class="cc-mois">${etiquette(m)}</span></div>`).join('');
    const parId = new Map(E.taches.map((x) => [x.id, x]));
    const entrees = [...E.historique].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const parAn = new Map();
    for (const h of entrees) { const k = h.date.slice(0, 4); if (!parAn.has(k)) parAn.set(k, []); parAn.get(k).push(h); }
    const lignes = [...parAn.entries()].map(([k, liste]) => `
      <h3 class="titre-an">${k}<span>${euros(liste.reduce((s, h) => s + (h.cout || 0), 0))} · ${pluriel(liste.length, 'intervention')}</span></h3>
      <ul class="lignes-histo">${liste.map((h) => { const x = parId.get(h.tache); return `<li style="--z:${zone(x?.zone).couleur}"><button class="ligne-histo" data-action="entree" data-id="${h.id}"><span class="d">${fmt(h.date, { day: 'numeric', month: 'short' })}</span><span class="q"><b>${esc(x?.titre || 'Tâche supprimée')}</b><small>${esc([h.intervenant, h.note].filter(Boolean).join(' · ') || equipement(x?.equip)?.nom || '')}</small></span><span class="m">${typeof h.cout === 'number' ? euros(h.cout) : '–'}</span></button></li>`; }).join('')}</ul>`).join('');
    return `
      <div class="vue-tete"><div><h1>Historique</h1><p>Chaque intervention marquée faite, avec son coût et l'intervenant que tu as notés. Aucun prix n'est intégré à l'application.</p></div>
        <div class="actions"><button class="btn" data-action="export-csv">Exporter en CSV</button></div></div>
      <div class="tuiles">
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">12 derniers mois</p><b>${euros(douze.total, false)}</b><span>${pluriel(douze.nb, 'intervention')}${douze.sansCout ? `, dont ${douze.sansCout} sans coût` : ''}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Depuis le 1er janvier</p><b>${euros(an.total, false)}</b><span>${pluriel(an.nb, 'intervention')}</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Depuis le début</p><b>${euros(tous.total, false)}</b><span>${pluriel(tous.nb, 'intervention')}</span></div>
      </div>
      <h2 class="titre-section">Dépenses des 12 derniers mois <span>Montant total par mois, coûts saisis par toi.</span></h2>
      <figure class="graphique" id="graphique-couts">
        <div class="couts">${barres}</div>
        <div class="infobulle" hidden></div>
        <details class="tableau-donnees"><summary>Voir les chiffres</summary><table class="tableau"><caption class="sr-only">Dépenses par mois</caption><thead><tr><th>Mois</th><th class="nb">Dépenses</th><th class="nb">Interventions</th></tr></thead><tbody>${mois.map((m) => `<tr><td>${fmtMois(m.mois)}</td><td class="nb">${euros(m.total)}</td><td class="nb">${m.nb}</td></tr>`).join('')}</tbody></table></details>
      </figure>
      <h2 class="titre-section">Interventions</h2>
      ${entrees.length ? lignes : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien pour l'instant</h3><p>Marque une tâche « Fait » : la date, le coût et l'intervenant s'ajoutent ici.</p></div></div>`}`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.max(8, Math.min(x, rf.width - bulle.offsetWidth - 8));
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(4, re.top - rf.top - bulle.offsetHeight + 8)}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
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
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const tacheDe = (id) => E.taches.find((x) => x.id === id);
  const intervenantsConnus = () => [...new Set(E.historique.map((h) => h.intervenant).filter(Boolean))].slice(0, 30);

  function modaleFait(id) {
    const t = tacheDe(id);
    if (!t) return;
    const d = auj();
    const precedent = [...E.historique].filter((h) => h.tache === id).sort((a, b) => b.date.localeCompare(a.date))[0];
    ouvrirModale('C\'est fait', `
      <p><b>${esc(t.titre)}</b><br><span class="discret">${esc(sousTitre(t))}</span></p>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${d}" max="${d}" required></label>
      <label class="champ">Coût <small>Facultatif, en €</small><input name="cout" inputmode="decimal" placeholder="${precedent && typeof precedent.cout === 'number' ? esc(String(precedent.cout).replace('.', ',')) : 'Ex. : 85'}"></label></div>
      <label class="champ">Intervenant <small>Facultatif : « Moi », un artisan, une entreprise…</small><input name="intervenant" maxlength="80" list="intervenants" value="${esc(precedent?.intervenant || '')}"></label>
      <datalist id="intervenants">${intervenantsConnus().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="champ">Note <small>Facultative : attestation rangée, pièce changée…</small><input name="note" maxlength="300"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      retenir();
      const r = R.marquerFait(E, id, { date: f.get('date'), cout: R.lireMontant(f.get('cout')), intervenant: f.get('intervenant'), note: f.get('note') }, auj(), uid);
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      const p = R.prochaine(E, t);
      toast(`« ${t.titre} » noté. Prochaine fois : ${p ? fmt(p) : '–'}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReporter(id) {
    const t = tacheDe(id);
    if (!t) return;
    const p = R.prochaine(E, t);
    const defaut = R.ajout(p && p > auj() ? p : auj(), 30);
    ouvrirModale('Reporter', `
      <p><b>${esc(t.titre)}</b> · échéance actuelle : ${p ? fmt(p) : 'inconnue'}${t.reporte ? ' (déjà reportée)' : ''}.</p>
      <label class="champ">Nouvelle date<input type="date" name="date" value="${defaut}" min="${auj()}" required></label>
      <p class="aide">Le report vaut jusqu'à ce que la tâche soit marquée faite ; ensuite, la fréquence reprend.${regle(t) ? ' Attention : cette tâche a une fréquence d\'origine réglementaire.' : ''}</p>
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">Reporter</button><button class="btn" value="annuler">Annuler</button>${t.reporte ? '<button class="btn gauche" value="effacer">Annuler le report</button>' : ''}`, (f, action) => {
      if (action !== 'effacer' && !f.get('date')) return 'Choisis une date.';
      retenir();
      const err = R.reporter(E, id, action === 'effacer' ? '' : f.get('date'));
      if (err) { annulation = null; return err; }
      sauver(); rendre();
      toast(action === 'effacer' ? 'Report annulé.' : `« ${t.titre} » reporté au ${fmt(f.get('date'))}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleDateConnue(id) {
    const t = tacheDe(id);
    if (!t) return;
    ouvrirModale('Dernière fois', `
      <p><b>${esc(t.titre)}</b> · ${esc(R.libelleFrequence(t.frequence).toLowerCase())}</p>
      <label class="champ">Date de la dernière fois <small>Approximative si besoin : le 1er du mois suffit.</small><input type="date" name="date" max="${auj()}" required></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const d = f.get('date');
      if (!R.estDate(d)) return 'Choisis une date.';
      if (d > auj()) return 'La date ne peut pas être dans le futur.';
      retenir();
      t.depart = d; t.prevue = null;
      sauver(); rendre();
      const p = R.prochaine(E, t);
      toast(`Prochaine fois : ${p ? fmt(p) : '–'}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  const choixSaison = (sel) => `<fieldset class="champ"><legend>Saison conseillée <small>Aucun mois coché : toute l'année.</small></legend><div class="choix-mois">${R.MOIS.map((m, i) => `<label><input type="checkbox" name="saison" value="${i + 1}" ${sel.includes(i + 1) ? 'checked' : ''}><span>${MOIS_COURTS[i]}</span></label>`).join('')}</div></fieldset>`;

  // Tâche existante (détail et réglages) ou nouvelle tâche.
  function modaleTache(id) {
    const t = id ? tacheDe(id) : null;
    if (id && !t) return;
    const x = t || { titre: '', zone: 'interieur', frequence: 12, saison: [], depart: null, note: '', actif: true, regle: null, qui: 'selon', conseil: '' };
    const r = regle(x);
    const proposee = t ? R.frequenceProposee(t, B) : null;
    const e = t ? R.etatTache(E, t, auj()) : null;
    const freqs = [...new Set([...FREQUENCES, x.frequence])].sort((a, b) => a - b);
    const histo = t ? [...E.historique].filter((h) => h.tache === t.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
    const corps = `
      ${t ? `<div class="resume-tache"><p class="surtitre" style="margin:0">${esc(zone(t.zone).nom)}${t.equip ? ` · ${esc(equipement(t.equip)?.nom || '')}` : ''}</p><p>${t.actif ? `Prochaine échéance : <b>${e.prochaine ? fmt(e.prochaine, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'inconnue'}</b>${e.statut === 'retard' ? ' <span class="pille rose">En retard</span>' : ''}` : '<b>Tâche désactivée</b> : elle n\'apparaît plus dans le calendrier.'}</p>${t.conseil ? `<p class="discret">${esc(t.conseil)}</p>` : ''}</div>` : ''}
      ${r ? `<div class="encart-regle"><p class="surtitre" style="margin:0">Fréquence d'origine réglementaire</p><b>${esc(r.titre)}</b><p>${esc(r.texte)}</p><p class="source">Source : ${esc(r.source)}${r.verifie ? ` Relu le ${fmt(B.verifieLe)}.` : ''}</p><p class="avert">À vérifier selon ton département, ton bail et ta situation : la fréquence reste modifiable ci-dessous.</p></div>` : ''}
      ${t && E.statut === 'locataire' ? `<p class="aide"><b>${LIB_QUI[t.qui] || LIB_QUI.selon}</b> (indicatif). ${esc(B.sourceLocatif)}</p>` : ''}
      <label class="champ">Tâche<input name="titre" required maxlength="100" value="${esc(x.titre)}" placeholder="Ex. : Nettoyer le puits de lumière"></label>
      <div class="rang-champs">
        <label class="champ">Fréquence${proposee ? ` <small>Proposée : ${R.libelleFrequence(proposee).toLowerCase()}</small>` : ''}<select name="frequence">${freqs.map((n) => `<option value="${n}" ${n === x.frequence ? 'selected' : ''}>${R.libelleFrequence(n)}</option>`).join('')}</select></label>
        ${t?.equip ? '' : `<label class="champ">Zone<select name="zone">${B.zones.map((z) => `<option value="${z.id}" ${z.id === x.zone ? 'selected' : ''}>${esc(z.nom)}</option>`).join('')}</select></label>`}
      </div>
      ${choixSaison(x.saison)}
      <label class="champ">Dernière fois <small>${histo.length ? `Sinon, l'historique fait foi (dernière : ${fmt(histo[0].date)}).` : 'Si tu la connais.'}</small><input type="date" name="depart" value="${esc(x.depart || '')}" max="${auj()}"></label>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(x.note || '')}"></label>
      ${t ? `<label class="case"><input type="checkbox" name="actif" ${x.actif ? 'checked' : ''}> Suivre cette tâche</label>` : ''}
      ${histo.length ? `<div class="groupe"><h3>Historique de cette tâche</h3><ul class="mini-histo">${histo.slice(0, 6).map((h) => `<li><span>${fmt(h.date)}</span><span>${esc(h.intervenant || '')}</span><b>${typeof h.cout === 'number' ? euros(h.cout) : ''}</b></li>`).join('')}</ul></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = t
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Fermer</button>${t.base ? '' : '<button class="btn danger gauche" value="supprimer">Supprimer</button>'}`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(t ? 'Tâche' : 'Nouvelle tâche', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${t.titre} » ? Son historique est conservé.`)) return '';
        retenir();
        E.taches = E.taches.filter((y) => y.id !== t.id);
        sauver(); rendre(); toast(`« ${t.titre} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique la tâche.';
      const depart = f.get('depart') || null;
      if (depart && (!R.estDate(depart) || depart > auj())) return 'La dernière fois ne peut pas être dans le futur.';
      retenir();
      const champs = { titre, frequence: Number(f.get('frequence')) || 12, saison: R.saisonValide(f.getAll('saison')), depart, note: String(f.get('note') || '').trim() };
      if (f.get('zone')) champs.zone = f.get('zone');
      if (t) {
        Object.assign(t, champs, { actif: !!f.get('actif') });
        if (depart) t.prevue = null;
        toast('Tâche enregistrée.', { libelle: 'Annuler', faire: annuler });
      } else {
        const n = { id: uid(), base: null, equip: null, zone: 'interieur', prevue: null, reporte: null, actif: true, regle: null, qui: 'selon', conseil: '', ...champs };
        if (!n.depart) R.etaler({ taches: [n], historique: [] }, auj());
        E.taches.push(n);
        toast(`« ${titre} » ajoutée.`, { libelle: 'Annuler', faire: annuler });
      }
      sauver(); rendre();
    });
  }

  function modaleEntree(id) {
    const h = E.historique.find((x) => x.id === id);
    if (!h) return;
    const t = tacheDe(h.tache);
    ouvrirModale('Intervention', `
      <p><b>${esc(t?.titre || 'Tâche supprimée')}</b></p>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${h.date}" max="${auj()}" required></label>
      <label class="champ">Coût <small>En €</small><input name="cout" inputmode="decimal" value="${typeof h.cout === 'number' ? String(h.cout).replace('.', ',') : ''}"></label></div>
      <label class="champ">Intervenant<input name="intervenant" maxlength="80" list="intervenants" value="${esc(h.intervenant)}"></label>
      <datalist id="intervenants">${intervenantsConnus().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="champ">Note<input name="note" maxlength="300" value="${esc(h.note)}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (f, action) => {
      retenir();
      if (action === 'supprimer') { R.supprimerEntree(E, id); sauver(); rendre(); toast('Intervention supprimée : l\'échéance est recalculée.', { libelle: 'Annuler', faire: annuler }); return; }
      const date = f.get('date');
      const cout = R.lireMontant(f.get('cout'));
      if (!R.estDate(date) || date > auj()) { annulation = null; return 'Date invalide ou dans le futur.'; }
      if (Number.isNaN(cout)) { annulation = null; return 'Coût illisible : écris un montant comme 85 ou 85,50.'; }
      Object.assign(h, { date, cout, intervenant: String(f.get('intervenant') || '').trim(), note: String(f.get('note') || '').trim() });
      sauver(); rendre(); toast('Intervention enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEquipements() {
    ouvrirModale('Mes équipements', `
      <p>Coche ce qui existe chez toi. Décocher un équipement désactive ses tâches sans effacer leur historique.</p>
      <div id="choix-equipements">${choixEquipements(E.equipements, E.logement)}</div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      retenir();
      const r = R.appliquerEquipements(E, f.getAll('equip'), B, uid);
      sauver(); rendre();
      toast(`Équipements enregistrés${r.ajoutees ? ` : ${pluriel(r.ajoutees, 'tâche ajoutée', 'tâches ajoutées')} (date à indiquer)` : ''}${r.desactivees ? `, ${pluriel(r.desactivees, 'tâche désactivée', 'tâches désactivées')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <div class="rang-champs">
        <label class="champ">Logement<select name="logement"><option value="maison" ${E.logement === 'maison' ? 'selected' : ''}>Maison</option><option value="appartement" ${E.logement === 'appartement' ? 'selected' : ''}>Appartement</option></select></label>
        <label class="champ">Tu es<select name="statut"><option value="proprietaire" ${E.statut === 'proprietaire' ? 'selected' : ''}>Propriétaire</option><option value="locataire" ${E.statut === 'locataire' ? 'selected' : ''}>Locataire</option></select></label>
      </div>
      <p class="aide">En location, chaque tâche indique qui s'en charge le plus souvent. C'est indicatif : ton bail prime.</p>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde et export</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="export-csv">Historique en CSV</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="aide">Outil d'aide à l'organisation, sans valeur d'attestation : il ne remplace pas l'avis d'un professionnel. Sources réglementaires relues le ${fmt(B.verifieLe)} : voir Équipements, « Obligations et sources ».</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.prenom = String(f.get('prenom') || '').trim();
      E.logement = f.get('logement') === 'appartement' ? 'appartement' : 'maison';
      E.statut = f.get('statut') === 'locataire' ? 'locataire' : 'proprietaire';
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.taches) || !Array.isArray(d.historique)) throw new Error();
        if (!confirm(`Remplacer ton calendrier actuel par cette copie (${pluriel(d.taches.length, 'tâche')}, ${pluriel(d.historique.length, 'intervention')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du calendrier.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `entretien-maison-${auj()}.json`);
  const exporterCsv = () => telecharger(`﻿${R.csvHistorique(E, B)}`, 'text/csv;charset=utf-8', `entretien-historique-${auj()}.csv`);

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
      <p>Enregistre le calendrier d'entretien sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    if (appareil() === 'autre' && !telephone()) return;
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
      case 'accueil-choix': accueil[el.name] = el.value; if (el.name === 'logement') accueil.equipements = null; break;
      case 'accueil-suivant': accueil.etape = Math.min(3, accueil.etape + 1); ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = Math.max(1, accueil.etape - 1); ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'export-csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'tache': modaleTache(id); break;
      case 'tache-nouvelle': modaleTache(null); break;
      case 'fait': modaleFait(id); break;
      case 'reporter': modaleReporter(id); break;
      case 'date-connue': modaleDateConnue(id); break;
      case 'entree': modaleEntree(id); break;
      case 'equipements-choisir': modaleEquipements(); break;
      case 'etaler': { retenir(); const nb = R.etaler(E, auj()); sauver(); rendre(); toast(`${pluriel(nb, 'tâche planifiée', 'tâches planifiées')} sur les 12 prochains mois.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'an-prec': anVu--; rendre(); break;
      case 'an-suiv': anVu++; rendre(); break;
      case 'an-auj': anVu = Number(auj().slice(0, 4)); rendre(); break;
      case 'imprimer': window.print(); break;
      default: break;
    }
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // le jour a pu changer
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
  window.__entretien = { etat: () => E, regles: R };
  init();
})();
