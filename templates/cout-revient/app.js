// Coût de revient et prix par client QME : charges, capacité, coût horaire, rentabilité par client.
// Données synchronisées par clé de licence ou code d'accès (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const C = window.CALCULS;
  const API = '/api/templates';
  const PRODUIT = 'PRX';
  const CLE_CODE = 'qme-prx-code';
  const CLE_CACHE = 'qme-prx-cache';
  const CLE_DEMO = 'qme-prx-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-prx-ecran-accueil';
  const NOM = 'Coût de revient et prix';

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

  const { iso, versDate, ajout } = C;
  const auj = () => iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);

  // Nombres à la française (espaces fines insécables, virgule décimale).
  const nf = (dec) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec });
  const NF0 = nf(0), NF1 = nf(1), NF2 = nf(2);
  const EUR0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const EUR2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const euros = (n, dec = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '–' : (dec ? EUR2 : EUR0).format(n));
  const signe = (n, dec = 0) => (n === null || !Number.isFinite(n) ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${euros(Math.abs(n), dec)}`);
  const heures = (n) => `${NF1.format(n)} h`;
  const jours = (n) => NF1.format(n);
  const pct = (n) => (n === null || !Number.isFinite(n) ? '–' : `${NF0.format(n * 100)} %`);
  const saisieNombre = (n) => (n === null || n === undefined || n === '' ? '' : NF2.format(Number(n)));

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const categorie = (id) => B.categories.find((c) => c.id === id) || { id: 'divers', nom: 'Divers' };

  // ---------- État ----------
  let E = null;
  // code : ce que l'acheteur a saisi (clé Gumroad ou code PRX) ; jeton : code interne pour les données.
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let annulation = null;

  const capaciteDefaut = () => ({ annee: new Date().getFullYear(), joursSemaine: [1, 2, 3, 4, 5], alsaceMoselle: false, pentecoteTravaillee: false, conges: 25, absences: 5, partNonFacturable: 30, heuresJour: 7, personnes: 1 });
  const etatVide = () => ({
    version: 1, activite: '', structure: null,
    charges: [], remuneration: { montant: 0, periode: 'an' }, cotisations: { mode: 'pourcentage', valeur: 0, periode: 'an' },
    capacite: capaciteDefaut(), margeCible: 20, periode: '12m', clients: [], saisies: [],
  });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return {
      ...v, ...d,
      remuneration: { ...v.remuneration, ...(d.remuneration || {}) },
      cotisations: { ...v.cotisations, ...(d.cotisations || {}) },
      capacite: { ...v.capacite, ...(d.capacite || {}), joursSemaine: Array.isArray(d.capacite?.joursSemaine) ? d.capacite.joursSemaine : v.capacite.joursSemaine },
      charges: Array.isArray(d.charges) ? d.charges : [],
      clients: Array.isArray(d.clients) ? d.clients : [],
      saisies: Array.isArray(d.saisies) ? d.saisies : [],
    };
  };
  const client = (id) => E.clients.find((c) => c.id === id);

  // ---------- Calculs dérivés de l'état ----------
  const PERIODES = [['3m', '3 derniers mois'], ['12m', '12 derniers mois'], ['annee', 'Année du calcul'], ['tout', 'Depuis le début']];
  function periodeCourante() {
    const t = auj();
    switch (E.periode) {
      case '3m': return { du: ajout(t, -91), au: t };
      case 'annee': return { du: `${E.capacite.annee}-01-01`, au: `${E.capacite.annee}-12-31` };
      case 'tout': return {};
      default: return { du: ajout(t, -365), au: t };
    }
  }

  function calcul() {
    const cap = C.capacite(E.capacite);
    const remuneration = C.annuel(E.remuneration.montant, E.remuneration.periode);
    const chargesFixes = C.chargesFixes(E.charges);
    const cotisations = C.cotisations(remuneration, E.cotisations);
    const cout = C.coutRevient({ chargesFixes, remuneration, cotisations, heuresFacturables: cap.heuresFacturables, joursFacturables: cap.joursFacturables });
    const defini = cout.total > 0 && cout.parHeure !== null;
    const heure = C.prix(defini ? cout.parHeure : null, E.margeCible);
    const jour = C.prix(defini ? cout.parJour : null, E.margeCible);
    const periode = periodeCourante();
    const bilans = E.clients.map((c) => ({
      ...c,
      ...C.bilanClient(E.saisies.filter((s) => s.clientId === c.id), { coutHeure: heure.plancher, conseilleHeure: heure.conseille, periode }),
    }));
    return { cap, cout, defini, heure, jour, bilans, periode };
  }

  const STATUTS = {
    rentable: ['Rentable', 'bleu'],
    'sous-conseille': ['Sous le prix conseillé', 'jaune'],
    'sous-plancher': ['Sous le plancher', 'rouge'],
    'non-facture': ['À facturer', ''],
    'sans-temps': ['Sans temps saisi', 'neutre'],
    'sans-cout': ['Coût à définir', 'neutre'],
  };
  const etiquetteStatut = (s) => `<span class="etiquette ${STATUTS[s][1]}">${STATUTS[s][0]}</span>`;
  const COULEUR_STATUT = { rentable: 'var(--bleu)', 'sous-conseille': 'var(--jaune)', 'sous-plancher': 'var(--rouge)' };

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
    // Au retour sur l'onglet : récupère la version d'un autre appareil, sauf modification en attente.
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
  // Code PRX-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('PRX')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('PRX') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    // Modifications faites hors ligne sur la version encore à jour du serveur : on les garde.
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

  // Données de démonstration : un indépendant fictif, saisies réparties sur les 4 derniers mois.
  function donneesDemo() {
    E = etatVide();
    const t = auj();
    E.activite = 'Studio de conception (exemple)';
    E.structure = 'solo';
    const montants = { loyer: [250, 'mois'], ordinateur: [1500, 'an'], telephone: [300, 'an'], logiciels: [90, 'mois'], hebergement: [120, 'an'],
      internet: [35, 'mois'], mobile: [20, 'mois'], 'rc-pro': [540, 'an'], prevoyance: [60, 'mois'], mutuelle: [55, 'mois'], comptable: [1200, 'an'],
      banque: [15, 'mois'], transports: [80, 'mois'], site: [240, 'an'], formation: [600, 'an'], 'impots-locaux': [400, 'an'] };
    E.charges = Object.entries(montants).map(([id, [montant, periode]]) => { const p = B.postes.find((x) => x.id === id); return { id: uid(), poste: id, nom: p.nom, categorie: p.categorie, montant, periode }; });
    E.remuneration = { montant: 3000, periode: 'mois' };
    E.cotisations = { mode: 'montant', valeur: 15000, periode: 'an' }; // montant d'exemple, à remplacer par le sien
    E.capacite = { ...capaciteDefaut() };
    E.margeCible = 20;
    E.periode = '12m';
    const clients = [
      ['Fromagerie du Vieux Pont', 'rouge', 'Identité visuelle et étiquettes'],
      ['Atelier Ardoise, architectes', 'bleu', 'Site internet, forfait signé trop bas'],
      ['Association Vélo Partagé', 'jaune', 'Tarif associatif'],
      ['Studio Orbe', 'encre', 'Missions courtes au forfait'],
      ['Maison Ombelle', 'vert', 'Mission en cours, première facture à émettre'],
      ['Commune de Valfleuri', 'orange', 'Devis envoyé, pas encore commencé'],
    ].map(([nom, c, note]) => { const x = { id: uid(), nom, couleur: c, note }; E.clients.push(x); return x; });
    // Jour ouvré le plus proche avant une date (pas de saisie le week-end).
    const ouvre = (n) => { let d = ajout(t, -n); while ([0, 6].includes(versDate(d).getDay())) d = ajout(d, -1); return d; };
    const temps = (k, n, h, libelle) => E.saisies.push({ id: uid(), clientId: clients[k].id, type: 'temps', date: ouvre(n), valeur: h, libelle });
    const frais = (k, n, v, libelle) => E.saisies.push({ id: uid(), clientId: clients[k].id, type: 'frais', date: ouvre(n), valeur: v, libelle });
    const facture = (k, n, v, libelle) => E.saisies.push({ id: uid(), clientId: clients[k].id, type: 'facture', date: ouvre(n), valeur: v, libelle });
    // Fromagerie : rentable (≈ 84 €/h).
    [[118, 4], [111, 6], [104, 3.5], [90, 5], [76, 4.5], [62, 6], [41, 3], [20, 4], [6, 2]].forEach(([n, h]) => temps(0, n, h, 'Création'));
    frais(0, 70, 120, 'Impression des maquettes');
    facture(0, 100, 1100, 'Acompte'); facture(0, 55, 1100, 'Étape 2'); facture(0, 10, 1100, 'Solde');
    // Ardoise : sous le plancher (forfait trop bas pour le temps passé).
    [[115, 7], [108, 6.5], [101, 7], [94, 5], [87, 7], [73, 6], [66, 7], [52, 5.5], [38, 6], [24, 4], [9, 3]].forEach(([n, h]) => temps(1, n, h, 'Développement'));
    facture(1, 95, 1400, 'Acompte 50 %'); facture(1, 30, 1400, 'Solde');
    // Vélo Partagé : entre le plancher et le prix conseillé.
    [[80, 6], [59, 5], [45, 7], [31, 6]].forEach(([n, h]) => temps(2, n, h, 'Atelier et supports'));
    frais(2, 44, 60, 'Déplacement');
    facture(2, 25, 1500, 'Forfait');
    // Orbe : très rentable.
    [[33, 4], [26, 3], [12, 5]].forEach(([n, h]) => temps(3, n, h, 'Mission courte'));
    facture(3, 25, 750, 'Mission 1'); facture(3, 8, 700, 'Mission 2');
    // Ombelle : du temps, aucune facture encore.
    [[16, 3], [11, 4], [3, 2.5]].forEach(([n, h]) => temps(4, n, h, 'Ateliers de cadrage'));
    // Valfleuri : aucun temps saisi.
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT = 'Outil d\'aide à la décision : les résultats dépendent entièrement de tes saisies et ne remplacent pas un avis professionnel (expert-comptable, conseil).';

  function ecranConnexion(message = '') {
    document.title = `${NOM} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="150" width="70" height="130" fill="#F5B400"/>
          <rect x="100" y="90" width="70" height="190" fill="#1D4E89"/>
          <rect x="190" y="30" width="70" height="250" fill="#D9302A"/>
          <rect x="0" y="122" width="290" height="8" fill="#F0EDE6"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#D9302A"/>
          <circle cx="430" cy="150" r="44" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Coût de revient · prix par client</p>
          <h1>Sais-tu ce que te coûte une heure ?</h1>
          <p>Tes charges, ton temps vraiment facturable, ton prix plancher et, pour chaque client, ce que tu gagnes réellement de l'heure.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton espace</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes chiffres sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon espace</button>
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
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = code.startsWith('PRX') ? 'Code incomplet : il a la forme PRX-XXXX-XXXX-XXXX-XXXX.' : 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon espace'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, activite: '', structure: null, montants: {}, remuneration: '', cotisation: '' };

  function postesStructure(id) {
    const s = B.structures.find((x) => x.id === id);
    return s ? s.postes.map((p) => B.postes.find((x) => x.id === p)) : [];
  }

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton calcul.</h1>
        <p class="intro">Deux étapes : ta structure, puis tes principales charges. Tout reste modifiable ensuite, et rien n'est obligatoire tout de suite.</p>
        <label class="champ" style="max-width:420px">Nom de ton activité <small>Facultatif, pour l'en-tête et les exports.</small>
          <input id="activite" value="${esc(a.activite)}" maxlength="60" autocomplete="organization">
        </label>
        <h2 class="titre-section">Ta structure <span>Elle coche les postes de charges courants et règle la capacité de départ.</span></h2>
        <div class="filieres" role="group" aria-label="Structure">
          ${B.structures.map((x, i) => `<button type="button" class="filiere" style="--c:${couleur(['rouge', 'bleu'][i])}" data-action="structure" data-id="${x.id}" aria-pressed="${a.structure === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)} · ${x.postes.length} postes types</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="structure" data-id="libre" aria-pressed="${a.structure === 'libre'}"><b>Partir de zéro</b><span>J'ajoute mes postes moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.structure ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const postes = postesStructure(a.structure);
      corps = `
        <p class="surtitre">${esc(B.structures.find((x) => x.id === a.structure)?.nom || 'Personnalisé')}</p>
        <h1>Tes charges, en gros.</h1>
        <p class="intro">Indique les montants que tu connais, même arrondis. Laisse vide ce qui ne te concerne pas : les postes vides ne sont pas créés.</p>
        <div class="grille-accueil">
          <div class="bloc">
            <h2>Ce que tu veux te verser</h2>
            <label class="champ">Rémunération visée par an<small>${a.structure === 'agence' ? 'Pour toute l\'équipe, avant cotisations.' : 'Avant cotisations sociales.'}</small><span class="saisie-unite"><input id="acc-remu" inputmode="decimal" value="${esc(a.remuneration)}" placeholder="Ex. : 36 000"><i>€ / an</i></span></label>
            <label class="champ">Cotisations sociales (% de la rémunération)<small>Aucun taux n'est intégré : indique celui de ton statut (estimation de ton expert-comptable ou simulateur officiel). Modifiable ensuite, ou en montant.</small><span class="saisie-unite"><input id="acc-cot" inputmode="decimal" value="${esc(a.cotisation)}" placeholder="Ton taux"><i>%</i></span></label>
          </div>
          ${postes.length ? `<div class="bloc"><h2>Charges fixes</h2><div class="postes-accueil">${postes.map((p) => `<label class="champ ligne-poste">${esc(p.nom)}<span class="saisie-unite"><input data-poste="${p.id}" inputmode="decimal" value="${esc(a.montants[p.id] || '')}" aria-label="${esc(p.nom)}, montant par ${p.periode}"><i>€ / ${p.periode}</i></span></label>`).join('')}</div></div>` : '<div class="bloc"><h2>Charges fixes</h2><p class="aide">Tu ajouteras tes postes depuis l\'onglet Charges : un catalogue de ' + B.postes.length + ' postes types t\'y attend.</p></div>'}
        </div>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon espace</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#activite')?.addEventListener('input', (e) => { accueil.activite = e.target.value; });
    $('#acc-remu')?.addEventListener('input', (e) => { accueil.remuneration = e.target.value; });
    $('#acc-cot')?.addEventListener('input', (e) => { accueil.cotisation = e.target.value; });
    document.querySelectorAll('[data-poste]').forEach((el) => el.addEventListener('input', () => { accueil.montants[el.dataset.poste] = el.value; }));
  }

  function terminerAccueil() {
    const a = accueil;
    const lus = Object.entries(a.montants).filter(([, v]) => String(v).trim()).map(([id, v]) => [id, C.lireMontant(v)]);
    const remu = a.remuneration.trim() ? C.lireMontant(a.remuneration) : 0;
    const cot = a.cotisation.trim() ? C.lireMontant(a.cotisation.replace('%', '')) : 0;
    const err = $('#erreur-accueil');
    if (lus.some(([, v]) => v === null || v < 0) || remu === null || remu < 0) { err.textContent = 'Un montant est illisible : écris-le en chiffres, par exemple 1 200 ou 89,90.'; return; }
    if (cot === null || cot < 0 || cot > 200) { err.textContent = 'Cotisations : un pourcentage entre 0 et 200.'; return; }
    E = etatVide();
    E.activite = a.activite.trim();
    E.structure = a.structure;
    const s = B.structures.find((x) => x.id === a.structure);
    if (s) Object.assign(E.capacite, { personnes: s.personnes, partNonFacturable: s.partNonFacturable, conges: s.conges, absences: s.absences, heuresJour: s.heuresJour });
    E.charges = lus.filter(([, v]) => v > 0).map(([id, montant]) => { const p = B.postes.find((x) => x.id === id); return { id: uid(), poste: id, nom: p.nom, categorie: p.categorie, montant, periode: p.periode }; });
    E.remuneration = { montant: remu, periode: 'an' };
    E.cotisations = { mode: 'pourcentage', valeur: cot, periode: 'an' };
    accueil = { etape: 1, activite: '', structure: null, montants: {}, remuneration: '', cotisation: '' };
    vue = 'bord';
    sauver();
    demarrer();
    setTimeout(() => modaleClient(), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    clients: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    prix: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    capacite: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 12V4A8 8 0 0 1 20 12Z" fill="currentColor"/></svg>',
    charges: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Synthèse'], ['clients', 'Clients'], ['prix', 'Prix'], ['capacite', 'Capacité'], ['charges', 'Charges']];
  const TITRES = { bord: 'Synthèse', clients: 'Clients', prix: 'Coût de revient et prix', capacite: 'Capacité', charges: 'Charges' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Coût de revient<br>et prix</span>
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
    document.title = `${TITRES[vue]} · ${NOM}`;
    const k = calcul();
    $('#vue').innerHTML = { bord: vueBord, clients: vueClients, prix: vuePrix, capacite: vueCapacite, charges: vueCharges }[vue](k);
    if (vue === 'bord') brancherGraphique(k);
  }

  // Après une saisie dans un champ : redessine la vue sans perdre le champ qui reçoit le focus.
  function rendreEnGardantFocus() {
    setTimeout(() => {
      const id = document.activeElement?.id;
      const y = window.scrollY;
      rendre();
      window.scrollTo({ top: y });
      if (id) document.getElementById(id)?.focus({ preventScroll: true });
    }, 0);
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const avertissement = () => `<p class="avertissement"><b>À savoir</b>${AVERTISSEMENT}</p>`;
  const choixPeriode = () => `<label class="champ periode">Période des clients<select id="periode" data-champ="periode">${PERIODES.map(([id, nom]) => `<option value="${id}" ${E.periode === id ? 'selected' : ''}>${nom}</option>`).join('')}</select></label>`;
  const libellePeriode = () => ({ '3m': 'les 3 derniers mois', '12m': 'les 12 derniers mois', annee: `l'année ${E.capacite.annee}`, tout: 'toute la période' }[E.periode] || 'la période');

  function coutManquant(k) {
    if (k.defini) return '';
    const manque = [];
    if (k.cout.total <= 0) manque.push('<button class="btn petit" data-action="vue" data-vue="charges">Saisir mes charges</button>');
    if (k.cap.heuresFacturables <= 0) manque.push('<button class="btn petit" data-action="vue" data-vue="capacite">Régler ma capacité</button>');
    return `<div class="alerte"><b>Coût de revient incomplet.</b><span>Sans charges ni temps facturable, impossible de calculer ton prix plancher : la rentabilité des clients s'affichera ensuite.</span><div class="rang">${manque.join('')}</div></div>`;
  }

  // ----- Synthèse -----
  function vueBord(k) {
    const avecTemps = k.bilans.filter((b) => b.heures > 0);
    const factures = k.bilans.filter((b) => b.facture > 0);
    const marge = k.defini ? factures.reduce((s, b) => s + (b.marge || 0), 0) : null;
    const ca = k.bilans.reduce((s, b) => s + b.facture, 0);
    const sous = k.bilans.filter((b) => b.statut === 'sous-plancher');
    const tuiles = [
      ['Coût de revient', k.defini ? euros(k.heure.plancher, 2) : '–', '/ h', k.defini ? `Soit ${euros(k.jour.plancher)} par jour facturé.` : 'Charges ou capacité à compléter.', 'var(--encre)', 'rond'],
      ['Prix conseillé', k.defini ? euros(k.heure.conseille, 2) : '–', '/ h', k.defini ? `Coût + marge cible de ${NF0.format(E.margeCible)} %, soit ${euros(k.jour.conseille)} par jour.` : 'Calculé dès que le coût est connu.', 'var(--bleu)', ''],
      ['Marge', marge === null ? '–' : signe(marge), '', `Sur ${libellePeriode()}, pour ${euros(ca)} facturés${marge !== null && ca > 0 ? ` (${pct(marge / ca)})` : ''}, hors travaux pas encore facturés.`, 'var(--jaune)', ''],
      ['Sous le plancher', sous.length, sous.length > 1 ? 'clients' : 'client', sous.length ? sous.map((b) => b.nom).join(', ') : 'Aucun client ne te coûte plus qu\'il ne rapporte.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${esc(d)}</span></div>`).join('');

    const classes = C.classer(k.bilans);
    const lignes = classes.map((b) => `<tr style="--c:${couleur(b.couleur)}"><td><span class="nom-matiere"><i></i>${esc(b.nom)}</span></td><td class="nb">${b.heures ? heures(b.heures) : '–'}</td><td class="nb">${b.facture ? euros(b.facture) : '–'}</td><td class="nb">${b.marge === null || !b.facture ? '–' : signe(b.marge)}</td><td class="nb">${b.tauxHoraireReel === null || !b.facture ? '–' : `${euros(b.tauxHoraireReel)} / h`}</td><td class="nb">${b.ecartPlancher === null || !b.facture ? '–' : `${signe(b.ecartPlancher)} / h`}</td><td>${etiquetteStatut(b.statut)}</td></tr>`).join('');

    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.activite || 'Ton activité')}</p><h1>Synthèse</h1><p>Ce que te coûte une heure, et ce que chaque client te rapporte réellement.</p></div>
        <div class="actions">${choixPeriode()}<button class="btn primaire" data-action="saisie-nouvelle">${ICONES.plus}Saisir</button></div></div>
      ${coutManquant(k)}
      <div class="tuiles">${tuiles}</div>
      ${E.clients.length ? `
      <h2 class="titre-section">Taux horaire réel par client <span>Facturé moins frais directs, divisé par les heures passées, sur ${libellePeriode()}.</span></h2>
      ${graphiqueTaux(k)}
      <h2 class="titre-section">Répartition du temps <span>${heures(avecTemps.reduce((s, b) => s + b.heures, 0))} passées chez tes clients sur la période.</span></h2>
      ${graphiqueTemps(k)}
      <h2 class="titre-section">Classement</h2>
      <div class="defile"><table class="tableau"><caption class="sr-only">Rentabilité par client</caption><thead><tr><th>Client</th><th class="nb">Heures</th><th class="nb">Facturé</th><th class="nb">Marge</th><th class="nb">Taux réel</th><th class="nb">Écart au plancher</th><th>Statut</th></tr></thead><tbody>${lignes}</tbody></table></div>`
    : `<div class="vide-etat" style="margin-top:28px">${FORME_VIDE}<div><h3>Aucun client pour l'instant</h3><p>Ajoute un client, puis saisis le temps passé, les frais et les factures : sa rentabilité apparaît ici.</p><div class="actions"><button class="btn primaire" data-action="client-nouveau">${ICONES.plus}Ajouter un client</button></div></div></div>`}
      ${avertissement()}`;
  }

  // Barres horizontales du taux horaire réel, repères du prix plancher et du prix conseillé.
  function graphiqueTaux(k) {
    const avec = C.classer(k.bilans).filter((b) => b.tauxHoraireReel !== null && b.facture > 0);
    const sans = k.bilans.filter((b) => !(b.tauxHoraireReel !== null && b.facture > 0));
    if (!avec.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à comparer pour l'instant</h3><p>Il faut au moins un client avec du temps saisi et une facture sur la période.</p></div></div>`;
    const max = Math.max(...avec.map((b) => b.tauxHoraireReel), k.heure.conseille || 0) * 1.08;
    const x = (v) => `${Math.max(0, (v / max) * 100).toFixed(2)}%`;
    const reperes = k.defini ? `<i class="repere plancher" style="left:${x(k.heure.plancher)}"></i><i class="repere conseille" style="left:${x(k.heure.conseille)}"></i>` : '';
    const rangs = avec.map((b, i) => `
      <div class="barre-rang" data-i="${i}" tabindex="0" role="listitem" aria-label="${esc(b.nom)} : ${euros(b.tauxHoraireReel)} de l'heure, ${STATUTS[b.statut][0].toLowerCase()}">
        <span class="barre-nom"><i style="background:${couleur(b.couleur)}"></i>${esc(b.nom)}</span>
        <span class="barre-piste">${reperes}<span class="barre-valeur" style="width:${x(Math.max(0, b.tauxHoraireReel))};background:${COULEUR_STATUT[b.statut] || 'var(--trait)'}"></span></span>
        <span class="barre-chiffre"><b>${euros(b.tauxHoraireReel)}</b> / h ${etiquetteStatut(b.statut)}</span>
      </div>`).join('');
    return `
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Euros gagnés par heure passée</h2>
          <div class="legende"><span><i style="background:var(--bleu)"></i>Au-dessus du prix conseillé</span><span><i style="background:var(--jaune)"></i>Entre plancher et conseillé</span><span><i style="background:var(--rouge)"></i>Sous le plancher</span>${k.defini ? `<span><i class="trait-repere"></i>Plancher ${euros(k.heure.plancher)}</span><span><i class="trait-repere tirets"></i>Conseillé ${euros(k.heure.conseille)}</span>` : ''}</div></div>
        <div class="barres" role="list">${rangs}</div>
        ${sans.length ? `<p class="graphique-note">Non comparés : ${sans.map((b) => `${esc(b.nom)} (${STATUTS[b.statut][0].toLowerCase()})`).join(', ')}.</p>` : ''}
        <div class="infobulle" hidden></div>
      </figure>`;
  }

  // Barre 100 % : part du temps passé par client, à sa couleur.
  function graphiqueTemps(k) {
    const r = C.repartitionTemps(k.bilans).filter((b) => b.heures > 0).sort((a, b) => b.heures - a.heures);
    if (!r.length) return '<p class="aide">Aucun temps saisi sur la période.</p>';
    return `
      <figure class="graphique repartition">
        <div class="pile" role="img" aria-label="Répartition du temps : ${r.map((b) => `${esc(b.nom)} ${pct(b.part)}`).join(', ')}">
          ${r.map((b) => `<span style="flex-grow:${b.part};background:${couleur(b.couleur)};color:${texteSur(b.couleur)}" title="${esc(b.nom)} : ${heures(b.heures)} (${pct(b.part)})">${b.part >= 0.1 ? pct(b.part) : ''}</span>`).join('')}
        </div>
        <ul class="legende-pile">${r.map((b) => `<li><i style="background:${couleur(b.couleur)}"></i><b>${esc(b.nom)}</b><span>${heures(b.heures)} · ${pct(b.part)}</span></li>`).join('')}</ul>
      </figure>`;
  }

  function brancherGraphique(k) {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const avec = C.classer(k.bilans).filter((b) => b.tauxHoraireReel !== null && b.facture > 0);
    const montrer = (rang) => {
      const b = avec[Number(rang.dataset.i)];
      fig.querySelectorAll('.barre-rang').forEach((r) => r.classList.toggle('active', r === rang));
      bulle.innerHTML = `<b>${esc(b.nom)}</b><div>${heures(b.heures)} · ${euros(b.facture)} facturés</div>${b.frais ? `<div>Frais directs : ${euros(b.frais)}</div>` : ''}<div>Marge : ${signe(b.marge)}${b.tauxMarge !== null ? ` (${pct(b.tauxMarge)})` : ''}</div><div>Écart au plancher : ${signe(b.ecartPlancher)} / h</div>`;
      bulle.hidden = false;
      const rr = rang.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let left = Math.min(rf.width - bulle.offsetWidth - 8, Math.max(8, rr.left - rf.left + rr.width * 0.45));
      bulle.style.left = `${Math.max(8, left)}px`;
      bulle.style.top = `${rr.bottom - rf.top + 6}px`;
    };
    const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.barre-rang').forEach((r) => r.classList.remove('active')); };
    fig.querySelectorAll('.barre-rang').forEach((r) => {
      r.addEventListener('pointerenter', () => montrer(r));
      r.addEventListener('focus', () => montrer(r));
      r.addEventListener('click', () => montrer(r));
      r.addEventListener('blur', cacher);
    });
    fig.addEventListener('pointerleave', cacher);
  }

  // ----- Clients -----
  const TYPES = { temps: ['Temps', 'Temps passé'], frais: ['Frais', 'Frais direct'], facture: ['Facture', 'Montant facturé (HT)'] };
  const valeurSaisie = (s) => (s.type === 'temps' ? heures(s.valeur) : euros(s.valeur, s.valeur % 1 ? 2 : 0));

  function jauge(b, k) {
    if (!k.defini || b.tauxHoraireReel === null || !b.facture) return '';
    const max = Math.max(b.tauxHoraireReel, k.heure.conseille) * 1.15;
    const x = (v) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(2)}%`;
    return `<div class="jauge" aria-hidden="true"><span class="jauge-valeur" style="width:${x(b.tauxHoraireReel)};background:${COULEUR_STATUT[b.statut]}"></span><i class="repere plancher" style="left:${x(k.heure.plancher)}"></i><i class="repere conseille" style="left:${x(k.heure.conseille)}"></i></div>`;
  }

  function vueClients(k) {
    const cartes = k.bilans.map((b) => {
      const liste = E.saisies.filter((s) => s.clientId === b.id && C.dansPeriode(s, k.periode)).sort((x, y) => y.date.localeCompare(x.date));
      const ligne = (s) => `<li class="saisie ${s.type}"><span class="saisie-type">${TYPES[s.type][0]}</span><span class="saisie-texte"><b>${valeurSaisie(s)}</b>${s.libelle ? ` · ${esc(s.libelle)}` : ''}</span><span class="saisie-date">${fmt(s.date)}</span><button type="button" data-action="saisie-modifier" data-id="${s.id}" aria-label="Modifier cette saisie">Modifier</button></li>`;
      const resume = b.statut === 'sans-temps' ? 'Aucun temps saisi sur la période : saisis tes heures pour mesurer sa rentabilité.'
        : b.statut === 'non-facture' ? `${heures(b.heures)} passées, rien de facturé sur la période${k.defini ? ` (coût déjà engagé : ${euros(b.coutTotal)})` : ''}.`
          : b.statut === 'sans-cout' ? 'Complète tes charges et ta capacité pour comparer ce client à ton prix plancher.'
            : `Tu gagnes <b>${euros(b.tauxHoraireReel)}</b> de l'heure chez ce client, soit ${signe(b.ecartPlancher)} par rapport à ton plancher.`;
      return `
      <article class="matiere client" style="--c:${couleur(b.couleur)};--t:${texteSur(b.couleur)}">
        <div class="matiere-tete"><div><h2>${esc(b.nom)}</h2>${b.note ? `<p>${esc(b.note)}</p>` : ''}</div><button data-action="client-modifier" data-id="${b.id}">Modifier</button></div>
        <div class="matiere-chiffres"><div><b>${NF1.format(b.heures)}</b><span>heures</span></div><div><b>${NF0.format(b.facture)} €</b><span>facturés</span></div><div><b class="${b.marge !== null && b.marge < 0 && b.facture ? 'negatif' : ''}">${b.marge === null || !b.facture ? '–' : `${b.marge < 0 ? '−' : ''}${NF0.format(Math.abs(b.marge))} €`}</b><span>marge</span></div></div>
        <div class="client-statut">${etiquetteStatut(b.statut)}<p>${resume}</p>${jauge(b, k)}</div>
        <div class="client-ajouts" role="group" aria-label="Saisir pour ${esc(b.nom)}">
          <button class="btn petit" data-action="saisie-nouvelle" data-client="${b.id}" data-type="temps">${ICONES.plus}Temps</button>
          <button class="btn petit" data-action="saisie-nouvelle" data-client="${b.id}" data-type="frais">${ICONES.plus}Frais</button>
          <button class="btn petit" data-action="saisie-nouvelle" data-client="${b.id}" data-type="facture">${ICONES.plus}Facture</button>
        </div>
        ${liste.length ? `<ul class="saisies">${liste.slice(0, 4).map(ligne).join('')}</ul>${liste.length > 4 ? `<details class="faites"><summary>Toutes les saisies (${liste.length})</summary><ul class="saisies">${liste.slice(4).map(ligne).join('')}</ul></details>` : ''}` : '<p class="matiere-vide">Aucune saisie sur la période.</p>'}
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Clients</h1><p>Pour chaque client ou projet : temps passé, frais directs et factures. La marge compare ce qui est facturé à ton coût de revient${k.defini ? ` (${euros(k.heure.plancher, 2)} de l'heure)` : ''}. Sur chaque jauge, le trait plein marque ton prix plancher, les pointillés ton prix conseillé.</p></div>
        <div class="actions">${choixPeriode()}<button class="btn" data-action="client-nouveau">${ICONES.plus}Client</button><button class="btn primaire" data-action="saisie-nouvelle">${ICONES.plus}Saisir</button></div></div>
      ${coutManquant(k)}
      ${E.clients.length ? `<div class="matieres">${cartes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun client</h3><p>Crée un client (ou un projet), puis saisis au fil de l'eau le temps passé, les frais et les factures.</p><div class="actions"><button class="btn primaire" data-action="client-nouveau">${ICONES.plus}Ajouter un client</button></div></div></div>`}`;
  }

  // ----- Prix -----
  function vuePrix(k) {
    const c = k.cout;
    const mission = Number(E.joursMission) || 5;
    const pm = C.prixMission(mission, k.defini ? c.parJour : null, E.margeCible);
    const lignes = [
      ['Charges fixes', c.chargesFixes, `${pluriel(E.charges.length, 'poste')}`, 'charges'],
      ['Rémunération visée', c.remuneration, E.capacite.personnes > 1 ? 'pour toute l\'équipe' : 'avant cotisations', 'charges'],
      ['Cotisations sociales', c.cotisations, E.cotisations.mode === 'pourcentage' ? `${NF2.format(Number(E.cotisations.valeur) || 0)} % saisis` : 'montant saisi', 'charges'],
    ];
    return `
      <div class="vue-tete"><div><h1>Coût de revient et prix</h1><p>Tout ce que ton activité doit couvrir dans l'année, divisé par le temps que tu peux réellement facturer.</p></div></div>
      ${coutManquant(k)}
      <section class="jour prix-tete">
        <div class="cout-grand">
          <p class="surtitre">Ton coût de revient · ${E.capacite.annee}</p>
          <div class="cout-chiffres">
            <div><b>${k.defini ? euros(c.parHeure, 2) : '–'}</b><span>par heure facturée</span></div>
            <div><b>${k.defini ? euros(c.parJour) : '–'}</b><span>par jour facturé (${NF1.format(E.capacite.heuresJour)} h)</span></div>
          </div>
          <p class="sous">C'est ton <b>prix plancher</b> : en dessous, une mission te coûte plus qu'elle ne te rapporte.</p>
        </div>
        <aside class="examen-carte calme prix-carte">
          <p class="surtitre">Prix conseillé</p>
          <div class="compte">${k.defini ? euros(k.heure.conseille, 2) : '–'}<small>/ h</small></div>
          <p>${k.defini ? `${euros(k.jour.conseille)} par jour · marge de ${NF0.format(E.margeCible)} % du prix` : 'Calculé dès que ton coût est connu.'}</p>
        </aside>
      </section>
      <div class="deux-colonnes">
        <section class="bloc">
          <h2>Le calcul</h2>
          <table class="calcul">
            <tbody>
              ${lignes.map(([lib, v, d]) => `<tr><th>${lib}<small>${esc(d)}</small></th><td>${euros(v)}</td></tr>`).join('')}
              <tr class="total"><th>Total annuel à couvrir</th><td>${euros(c.total)}</td></tr>
              <tr><th>÷ Heures facturables<small>${jours(k.cap.joursFacturables)} jours × ${NF1.format(E.capacite.heuresJour)} h</small></th><td>${heures(k.cap.heuresFacturables)}</td></tr>
              <tr class="total"><th>= Coût par heure</th><td>${k.defini ? euros(c.parHeure, 2) : '–'}</td></tr>
            </tbody>
          </table>
          <div class="rang"><button class="btn petit" data-action="vue" data-vue="charges">Modifier les charges</button><button class="btn petit" data-action="vue" data-vue="capacite">Modifier la capacité</button></div>
        </section>
        <section class="bloc">
          <h2>Ta marge cible</h2>
          <label class="champ">Marge cible (% du prix de vente)<small>Ce qui reste une fois tous les coûts couverts : réserve, investissements, imprévus. Prix conseillé = coût ÷ (1 − marge).</small>
            <span class="saisie-unite"><input id="marge" data-champ="margeCible" type="number" min="0" max="90" step="1" value="${E.margeCible}"><i>%</i></span></label>
          <table class="calcul">
            <thead><tr><th></th><td>Heure</td><td>Jour</td></tr></thead>
            <tbody>
              <tr><th>Prix plancher</th><td>${euros(k.heure.plancher, 2)}</td><td>${euros(k.jour.plancher)}</td></tr>
              <tr class="total"><th>Prix conseillé</th><td>${euros(k.heure.conseille, 2)}</td><td>${euros(k.jour.conseille)}</td></tr>
            </tbody>
          </table>
          <h2 style="margin-top:22px">Prix d'une mission</h2>
          <label class="champ">Durée estimée<span class="saisie-unite"><input id="mission" data-champ="joursMission" type="number" min="0" max="999" step="0.5" value="${mission}"><i>jours</i></span></label>
          <div class="mission"><div><span>Plancher</span><b>${euros(pm.plancher)}</b></div><div class="fort"><span>Conseillé</span><b>${euros(pm.conseille)}</b></div></div>
        </section>
      </div>
      ${avertissement()}`;
  }

  // ----- Capacité -----
  const JOURS_SEMAINE = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
  function vueCapacite(k) {
    const p = E.capacite;
    const c = k.cap;
    const an = new Date().getFullYear();
    const etapes = [
      ['Jours calendaires', c.calendaires, '', 'base'],
      ['Jours non travaillés', -c.nonTravailles, 'week-ends et jours de repos', 'moins'],
      ['Jours fériés chômés', -c.feriesChomes, 'calculés pour l\'année', 'moins'],
      ['Jours ouvrés', c.ouvres, '', 'sous-total'],
      ['Congés', -c.conges, '', 'moins'],
      ['Autres absences', -c.absences, 'formation, maladie…', 'moins'],
      ['Jours travaillés', c.travailles, '', 'sous-total'],
      ['Temps non facturable', -c.nonFacturables, `${NF0.format(c.partNonFacturable)} % : prospection, gestion, devis`, 'moins'],
      ['Jours facturables', c.joursParPersonne, c.personnes > 1 ? 'par personne' : '', 'total'],
    ];
    const cascade = etapes.map(([lib, v, d, cl]) => `<li class="${cl}"><span class="cascade-lib">${lib}${d ? `<small>${esc(d)}</small>` : ''}</span><span class="cascade-barre"><i style="width:${Math.max(0, (Math.abs(v) / c.calendaires) * 100).toFixed(2)}%"></i></span><b>${v < 0 ? '−' : ''}${jours(Math.abs(v))}</b></li>`).join('');
    const champ = (id, lib, aide, val, attrs) => `<label class="champ">${lib}${aide ? `<small>${aide}</small>` : ''}<input id="cap-${id}" data-champ="capacite.${id}" type="number" ${attrs} value="${val}"></label>`;
    return `
      <div class="vue-tete"><div><h1>Capacité</h1><p>Le temps que tu peux vraiment facturer dans l'année. Les week-ends et les jours fériés sont calculés pour l'année choisie, Pâques et les fêtes mobiles comprises.</p></div></div>
      <div class="deux-colonnes">
        <section class="bloc">
          <h2>Tes réglages</h2>
          <label class="champ">Année<select id="cap-annee" data-champ="capacite.annee">${[an - 1, an, an + 1, an + 2].map((a) => `<option ${a === p.annee ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
          <fieldset class="champ jours-semaine"><legend>Jours travaillés dans la semaine</legend><div>${JOURS_SEMAINE.map(([j, n]) => `<label><input type="checkbox" id="cap-j${j}" data-jour="${j}" ${p.joursSemaine.includes(j) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
          <div class="champs-2">
            ${champ('conges', 'Congés', 'jours ouvrés par an', p.conges, 'min="0" max="200" step="1"')}
            ${champ('absences', 'Autres absences', 'jours par an', p.absences, 'min="0" max="200" step="1"')}
            ${champ('heuresJour', 'Heures par jour', 'travaillées', p.heuresJour, 'min="1" max="14" step="0.5"')}
            ${champ('partNonFacturable', 'Part non facturable', '% du temps travaillé', p.partNonFacturable, 'min="0" max="95" step="1"')}
          </div>
          ${champ('personnes', 'Personnes qui facturent', 'Les jours facturables sont multipliés par ce nombre.', p.personnes, 'min="1" max="50" step="1"')}
          <label class="case"><input type="checkbox" id="cap-alsace" data-option="alsaceMoselle" ${p.alsaceMoselle ? 'checked' : ''}> Alsace-Moselle (vendredi saint et 26 décembre)</label>
          <label class="case"><input type="checkbox" id="cap-pentecote" data-option="pentecoteTravaillee" ${p.pentecoteTravaillee ? 'checked' : ''}> Je travaille le lundi de Pentecôte</label>
        </section>
        <section class="bloc">
          <h2>Résultat ${p.annee}</h2>
          <ol class="cascade">${cascade}</ol>
          <div class="resultat-capacite"><div><span>Jours facturables${c.personnes > 1 ? ` (${c.personnes} personnes)` : ''}</span><b>${jours(c.joursFacturables)}</b></div><div class="fort"><span>Heures facturables</span><b>${heures(c.heuresFacturables)}</b></div></div>
        </section>
      </div>
      <h2 class="titre-section">Jours fériés ${p.annee} <span>${pluriel(c.feriesChomes, 'jour chômé', 'jours chômés')} sur tes jours travaillés.</span></h2>
      <ul class="feries">${c.feries.map((f) => `<li class="${f.chome ? '' : 'hors'}"><b>${fmt(f.date, { weekday: 'short', day: 'numeric', month: 'long' })}</b><span>${esc(f.nom)}</span><em>${f.chome ? 'Chômé' : f.travaille ? 'Travaillé' : 'Non travaillé'}</em></li>`).join('')}</ul>`;
  }

  // ----- Charges -----
  function vueCharges(k) {
    const groupes = B.categories.map((cat) => ({ cat, liste: E.charges.filter((c) => (c.categorie || 'divers') === cat.id) })).filter((g) => g.liste.length);
    const total = k.cout.chargesFixes;
    const ligne = (c) => `
      <div class="charge">
        <label class="charge-nom" for="ch-${c.id}">${esc(c.nom)}</label>
        <span class="saisie-unite"><input id="ch-${c.id}" data-charge="${c.id}" data-cle="montant" inputmode="decimal" value="${saisieNombre(c.montant)}" aria-label="${esc(c.nom)} : montant"><i>€</i></span>
        <select id="chp-${c.id}" data-charge="${c.id}" data-cle="periode" aria-label="${esc(c.nom)} : période"><option value="mois" ${c.periode === 'mois' ? 'selected' : ''}>par mois</option><option value="an" ${c.periode === 'an' ? 'selected' : ''}>par an</option></select>
        <span class="charge-an">${euros(C.annuel(c.montant, c.periode))} / an</span>
        <button type="button" class="suppr" data-action="charge-suppr" data-id="${c.id}" aria-label="Supprimer ${esc(c.nom)}">×</button>
      </div>`;
    const r = E.remuneration, co = E.cotisations;
    return `
      <div class="vue-tete"><div><h1>Charges</h1><p>Tout ce que ton activité doit payer dans l'année, plus ce que tu veux te verser. Saisis au mois ou à l'année : tout est ramené à l'année.</p></div>
        <div class="actions"><button class="btn primaire" data-action="poste-ajout">${ICONES.plus}Ajouter des postes</button></div></div>
      <div class="deux-colonnes">
        <section class="bloc">
          <h2>Rémunération visée</h2>
          <div class="champs-2">
            <label class="champ">Montant<small>${E.capacite.personnes > 1 ? 'pour toute l\'équipe, avant cotisations' : 'avant cotisations sociales'}</small><span class="saisie-unite"><input id="remu" data-champ="remuneration.montant" inputmode="decimal" value="${saisieNombre(r.montant)}"><i>€</i></span></label>
            <label class="champ">Période<small>&nbsp;</small><select id="remu-p" data-champ="remuneration.periode"><option value="mois" ${r.periode === 'mois' ? 'selected' : ''}>par mois</option><option value="an" ${r.periode === 'an' ? 'selected' : ''}>par an</option></select></label>
          </div>
          <p class="somme">Soit <b>${euros(k.cout.remuneration)}</b> par an.</p>
        </section>
        <section class="bloc">
          <h2>Cotisations sociales</h2>
          <p class="aide">Aucun taux n'est intégré : il dépend de ton statut et change chaque année. Indique celui que t'a donné ton expert-comptable ou un simulateur officiel.</p>
          <div class="choix-mode" role="radiogroup" aria-label="Mode de saisie des cotisations">
            <label><input type="radio" name="mode-cot" id="cot-pct" data-champ="cotisations.mode" value="pourcentage" ${co.mode === 'pourcentage' ? 'checked' : ''}><span>% de la rémunération</span></label>
            <label><input type="radio" name="mode-cot" id="cot-mt" data-champ="cotisations.mode" value="montant" ${co.mode !== 'pourcentage' ? 'checked' : ''}><span>Montant</span></label>
          </div>
          <div class="champs-2">
            <label class="champ">${co.mode === 'pourcentage' ? 'Taux' : 'Montant'}<span class="saisie-unite"><input id="cot-v" data-champ="cotisations.valeur" inputmode="decimal" value="${saisieNombre(co.valeur)}"><i>${co.mode === 'pourcentage' ? '%' : '€'}</i></span></label>
            ${co.mode === 'pourcentage' ? '<span></span>' : `<label class="champ">Période<select id="cot-p" data-champ="cotisations.periode"><option value="mois" ${co.periode === 'mois' ? 'selected' : ''}>par mois</option><option value="an" ${co.periode !== 'mois' ? 'selected' : ''}>par an</option></select></label>`}
          </div>
          <p class="somme">Soit <b>${euros(k.cout.cotisations)}</b> par an.</p>
        </section>
      </div>
      <h2 class="titre-section">Charges fixes <span>${euros(total)} par an, soit ${euros(total / 12)} par mois.</span></h2>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-charges"><h3>${esc(g.cat.nom)}<span>${euros(C.chargesFixes(g.liste))} / an</span></h3>${g.liste.map(ligne).join('')}</section>`).join('')
    : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune charge fixe</h3><p>Choisis tes postes dans le catalogue de ${B.postes.length} charges types d'un prestataire, puis indique leurs montants.</p><div class="actions"><button class="btn primaire" data-action="poste-ajout">${ICONES.plus}Ajouter des postes</button></div></div></div>`}
      ${avertissement()}`;
  }

  // Champs modifiables directement dans les vues (capacité, charges, prix, période).
  function appliquerChamp(el) {
    const chemin = el.dataset.champ;
    if (!chemin) return false;
    const v = el.value;
    const nombre = (min, max) => { const n = C.lireMontant(v); return n === null ? null : Math.min(max, Math.max(min, n)); };
    switch (chemin) {
      case 'periode': E.periode = v; break;
      case 'margeCible': { const n = nombre(0, 90); if (n === null) return toastErreur(el); E.margeCible = n; break; }
      case 'joursMission': { const n = nombre(0, 999); if (n === null) return toastErreur(el); E.joursMission = n; break; }
      case 'capacite.annee': E.capacite.annee = Number(v); break;
      case 'remuneration.periode': E.remuneration.periode = v; break;
      case 'cotisations.periode': E.cotisations.periode = v; break;
      case 'cotisations.mode': E.cotisations.mode = v; break;
      case 'remuneration.montant': { const n = nombre(0, 1e8); if (n === null) return toastErreur(el); E.remuneration.montant = n; break; }
      case 'cotisations.valeur': { const n = nombre(0, E.cotisations.mode === 'pourcentage' ? 200 : 1e8); if (n === null) return toastErreur(el); E.cotisations.valeur = n; break; }
      default: {
        const [, cle] = chemin.split('.');
        const bornes = { conges: [0, 200], absences: [0, 200], heuresJour: [1, 14], partNonFacturable: [0, 95], personnes: [1, 50] }[cle];
        const n = nombre(...bornes);
        if (n === null) return toastErreur(el);
        E.capacite[cle] = cle === 'personnes' ? Math.round(n) : n;
      }
    }
    return true;
  }
  function toastErreur(el) { toast('Valeur illisible : écris un nombre, par exemple 25 ou 89,90.'); el.focus(); return false; }

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!E || !$('#vue')?.contains(el)) return;
    if (el.dataset.champ) { if (appliquerChamp(el)) { sauver(); rendreEnGardantFocus(); } return; }
    if (el.dataset.jour !== undefined) {
      const j = Number(el.dataset.jour);
      const s = new Set(E.capacite.joursSemaine);
      if (el.checked) s.add(j); else s.delete(j);
      if (!s.size) { el.checked = true; toast('Garde au moins un jour travaillé dans la semaine.'); return; }
      E.capacite.joursSemaine = [...s].sort();
      sauver(); rendreEnGardantFocus(); return;
    }
    if (el.dataset.option) { E.capacite[el.dataset.option] = el.checked; sauver(); rendreEnGardantFocus(); return; }
    if (el.dataset.charge) {
      const c = E.charges.find((x) => x.id === el.dataset.charge);
      if (!c) return;
      if (el.dataset.cle === 'periode') c.periode = el.value;
      else {
        const n = el.value.trim() ? C.lireMontant(el.value) : 0;
        if (n === null || n < 0) { toastErreur(el); return; }
        c.montant = n;
      }
      sauver(); rendreEnGardantFocus();
    }
  });

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

  function modaleClient(id) {
    const c = id ? client(id) : null;
    const utilisees = new Set(E.clients.map((x) => x.couleur));
    const defaut = c?.couleur || (B.couleurs.find((x) => !utilisees.has(x.id)) || B.couleurs[E.clients.length % B.couleurs.length]).id;
    const nb = c ? E.saisies.filter((s) => s.clientId === c.id).length : 0;
    const corps = `
      <label class="champ">Nom du client ou du projet<input name="nom" required maxlength="80" value="${esc(c?.nom || '')}" placeholder="Ex. : Boulangerie du centre"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((x) => `<label title="${x.nom}"><input type="radio" name="couleur" value="${x.id}" ${x.id === defaut ? 'checked' : ''} aria-label="${x.nom}"><span style="--c:${x.hex}"></span></label>`).join('')}</div></fieldset>
      <label class="champ">Note<small>Facultative : type de mission, conditions…</small><input name="note" maxlength="120" value="${esc(c?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier le client' : 'Nouveau client', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${c.nom} »${nb ? ` et ses ${pluriel(nb, 'saisie')}` : ''} ?`)) return '';
        const avant = { clients: structuredClone(E.clients), saisies: structuredClone(E.saisies) };
        E.clients = E.clients.filter((x) => x.id !== c.id);
        E.saisies = E.saisies.filter((s) => s.clientId !== c.id);
        annulation = () => { E.clients = avant.clients; E.saisies = avant.saisies; };
        sauver(); rendre(); toast(`« ${c.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du client.';
      const note = String(f.get('note') || '').trim();
      if (c) Object.assign(c, { nom, couleur: f.get('couleur'), note });
      else E.clients.push({ id: uid(), nom, couleur: f.get('couleur'), note });
      sauver(); rendre(); toast(c ? 'Client enregistré.' : `« ${nom} » ajouté. Saisis maintenant le temps passé.`);
    });
  }

  function modaleSaisie({ clientId, type = 'temps', id } = {}) {
    if (!E.clients.length) { modaleClient(); toast('Crée d\'abord un client.'); return; }
    const s = id ? E.saisies.find((x) => x.id === id) : null;
    const t = s?.type || type;
    const choix = s?.clientId || clientId || E.clients[0].id;
    const corps = `
      <label class="champ">Client<select name="client">${E.clients.map((c) => `<option value="${c.id}" ${c.id === choix ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Type</legend><div class="choix-mode">${Object.entries(TYPES).map(([k, [n]]) => `<label><input type="radio" name="type" value="${k}" ${k === t ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <label class="champ"><span id="lib-valeur">${TYPES[t][1]}</span><small id="aide-valeur">${t === 'temps' ? 'Ex. : 2, 1,5 ou 1h30' : 'En euros hors taxes, ex. : 1 200 ou 89,90'}</small><input name="valeur" inputmode="decimal" required value="${s ? saisieNombre(s.valeur) : ''}" autocomplete="off"></label>
      <label class="champ">Date<input type="date" name="date" value="${s?.date || auj()}" required></label>
      <label class="champ">Libellé<small>Facultatif</small><input name="libelle" maxlength="80" value="${esc(s?.libelle || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = s ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Modifier la saisie' : 'Nouvelle saisie', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const avant = structuredClone(E.saisies);
        E.saisies = E.saisies.filter((x) => x.id !== s.id);
        annulation = () => { E.saisies = avant; };
        sauver(); rendre(); toast('Saisie supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const ty = f.get('type');
      const brut = String(f.get('valeur') || '');
      const valeur = ty === 'temps' ? C.lireDuree(brut) : C.lireMontant(brut);
      if (valeur === null || valeur <= 0) return ty === 'temps' ? 'Durée illisible : écris par exemple 2, 1,5 ou 1h30.' : 'Montant illisible : écris par exemple 1 200 ou 89,90.';
      if (ty === 'temps' && valeur > 24) return 'Une saisie de temps ne dépasse pas 24 h : découpe-la par jour.';
      const date = f.get('date');
      if (!date) return 'Indique la date.';
      const donnees = { clientId: f.get('client'), type: ty, date, valeur: Math.round(valeur * 100) / 100, libelle: String(f.get('libelle') || '').trim() };
      const avant = structuredClone(E.saisies);
      if (s) Object.assign(s, donnees); else E.saisies.push({ id: uid(), ...donnees });
      annulation = () => { E.saisies = avant; };
      sauver(); rendre();
      const nom = client(donnees.clientId)?.nom;
      const montant = euros(donnees.valeur, donnees.valeur % 1 ? 2 : 0);
      const quoi = { temps: `${heures(donnees.valeur)} ajoutées`, frais: `Frais de ${montant} ajoutés`, facture: `Facture de ${montant} ajoutée` }[ty];
      toast(s ? 'Saisie enregistrée.' : `${quoi} · ${nom}.`, { libelle: 'Annuler', faire: annuler });
    });
    // Libellé et aide selon le type choisi.
    modale().querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', () => {
      $('#lib-valeur').textContent = TYPES[r.value][1];
      $('#aide-valeur').textContent = r.value === 'temps' ? 'Ex. : 2, 1,5 ou 1h30' : 'En euros hors taxes, ex. : 1 200 ou 89,90';
    }));
  }

  function modalePostes() {
    const deja = new Set(E.charges.map((c) => c.poste).filter(Boolean));
    const libres = B.postes.filter((p) => !deja.has(p.id));
    const corps = `
      <p class="aide">Coche les postes qui te concernent : ils sont ajoutés vides, tu saisis ensuite leurs montants.</p>
      ${B.categories.map((cat) => { const l = libres.filter((p) => p.categorie === cat.id); return l.length ? `<fieldset class="catalogue"><legend>${esc(cat.nom)}</legend>${l.map((p) => `<label class="case"><input type="checkbox" name="poste" value="${p.id}"> ${esc(p.nom)}</label>`).join('')}</fieldset>` : ''; }).join('')}
      <label class="champ">Autre poste<small>Facultatif : un poste qui n'est pas dans la liste.</small><input name="libre" maxlength="80" placeholder="Ex. : Location de matériel"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Ajouter des postes', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const ids = f.getAll('poste');
      const libre = String(f.get('libre') || '').trim();
      if (!ids.length && !libre) return 'Coche au moins un poste ou écris-en un.';
      ids.forEach((id) => { const p = B.postes.find((x) => x.id === id); E.charges.push({ id: uid(), poste: id, nom: p.nom, categorie: p.categorie, montant: 0, periode: p.periode }); });
      if (libre) E.charges.push({ id: uid(), poste: null, nom: libre, categorie: 'divers', montant: 0, periode: 'mois' });
      sauver(); rendre(); toast(`${pluriel(ids.length + (libre ? 1 : 0), 'poste ajouté', 'postes ajoutés')} : indique les montants.`);
    });
    const premier = modale().querySelector('input[name=poste]');
    if (premier) premier.focus();
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Nom de ton activité<input name="activite" maxlength="60" value="${esc(E.activite)}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="aide">${AVERTISSEMENT} Jours fériés calculés (métropole, option Alsace-Moselle) ; aucun taux de cotisations intégré.</p></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.activite = String(f.get('activite') || '').trim();
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.clients) || !Array.isArray(d.saisies) || !Array.isArray(d.charges)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.clients.length, 'client')}, ${pluriel(d.saisies.length, 'saisie')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cout-revient-${auj()}.json`;
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

  // ---------- Actions ----------
  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    sauver(); rendre();
    toast('Action annulée.');
  }

  function supprimerCharge(id) {
    const c = E.charges.find((x) => x.id === id);
    if (!c) return;
    const avant = structuredClone(E.charges);
    E.charges = E.charges.filter((x) => x.id !== id);
    annulation = () => { E.charges = avant; };
    sauver(); rendre();
    toast(`« ${c.nom} » retiré.`, { libelle: 'Annuler', faire: annuler });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': modale().open && modale().close(); deconnecter(); break;
      case 'structure': accueil.structure = id; ecranAccueil(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'client-nouveau': modaleClient(); break;
      case 'client-modifier': modaleClient(id); break;
      case 'saisie-nouvelle': modaleSaisie({ clientId: el.dataset.client, type: el.dataset.type }); break;
      case 'saisie-modifier': modaleSaisie({ id }); break;
      case 'poste-ajout': modalePostes(); break;
      case 'charge-suppr': supprimerCharge(id); break;
      default: break;
    }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

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
      // Hors ligne : on reprend la dernière version gardée sur l'appareil.
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__coutRevient = { etat: () => E, calcul: () => calcul() };
  init();
})();
