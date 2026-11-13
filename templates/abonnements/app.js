// Suivi des abonnements QME : coût mensuel et annuel, prélèvements, échéances à décider, économies.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion bancaire, aucun lien de résiliation.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ABN;
  const API = '/api/templates';
  const PRODUIT = 'ABN';
  const CLE_CODE = 'qme-abn-code';
  const CLE_CACHE = 'qme-abn-cache';
  const CLE_DEMO = 'qme-abn-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-abn-ecran-accueil';

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
  const { ajout, versDate, euros } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const nomMois = (cle) => { const t = versDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const moisCourt = (cle) => versDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const categorie = (id) => B.categories.find((c) => c.id === id) || B.categories[B.categories.length - 1];
  const nomCat = (id) => categorie(id).nom;
  const periode = (id) => B.periodicites.find((p) => p.id === id) || B.periodicites[1];
  const parPeriode = (a) => `${euros(a.montant)} / ${periode(a.periodicite).court}`;
  const LIB_DECISION = { essai: 'Fin d\'essai', engagement: 'Fin d\'engagement', renouvellement: 'Renouvellement' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  let moisVu = auj().slice(0, 7);
  const filtre = { statut: 'encours', q: '' };
  let annulation = null;

  const etatVide = () => R.etatVide();
  const normaliser = (d) => R.normaliser(d, auj());
  const abonnement = (id) => E.abonnements.find((a) => a.id === id);

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
        toast('Un autre appareil a modifié tes abonnements entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (ABN-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Foyer fictif : 21 abonnements à des dates relatives à aujourd'hui, tous les états représentés
  // (essai qui finit, engagement à décider, préavis dépassé, renouvellement annuel, partagé, à résilier,
  // résiliés, prix à compléter, hebdomadaire, trimestriel, annuels).
  function donneesDemo() {
    const e = etatVide();
    e.prenom = 'Camille';
    const t = auj();
    // Date d'un prélèvement passé : même jour du mois que « dans j jours », n mois plus tôt.
    const passe = (j, n) => R.ajoutMois(ajout(t, j), -n);
    const ajouter = (nom, cat, montant, periodicite, debut, extra = {}) => e.abonnements.push(R.normaliserAbonnement({ id: uid(), nom, cat, montant, periodicite, debut, paiement: 'Carte bancaire', ...extra }, t));
    ajouter('Plateforme de streaming vidéo', 'video', 1349, 'mensuel', passe(2, 14));
    ajouter('Deuxième plateforme de streaming vidéo', 'video', 899, 'mensuel', passe(-6, 5), { statut: 'aResilier', note: 'Regardée deux fois depuis l\'été.' });
    ajouter('Streaming musical, offre famille', 'audio', 1799, 'mensuel', passe(9, 20), { parts: 4, paiement: 'Compte de paiement en ligne', note: 'Partagé avec les parents et ma sœur.' });
    ajouter('Livres audio', 'audio', 999, 'mensuel', passe(-12, 9), { statut: 'resilie', resilieLe: ajout(t, -40) });
    ajouter('Box internet (fibre)', 'internet', 3499, 'mensuel', passe(5, 23), { engagementFin: ajout(t, 20), preavisJours: 10, paiement: 'Prélèvement' });
    ajouter('Forfait mobile', 'mobile', 1099, 'mensuel', passe(1, 30), { paiement: 'Prélèvement' });
    ajouter('Forfait mobile enfant', 'mobile', 599, 'mensuel', passe(1, 7), { paiement: 'Prélèvement' });
    ajouter('Assurance habitation', 'assurance', 21840, 'annuel', passe(45, 36), { preavisJours: 30, paiement: 'Prélèvement' });
    ajouter('Complémentaire santé', 'assurance', 6450, 'mensuel', passe(3, 26), { preavisJours: 60, paiement: 'Prélèvement' });
    ajouter('Salle de sport', 'sport', 2990, 'mensuel', passe(-3, 11), { engagementFin: ajout(t, 12), preavisJours: 30, paiement: 'Prélèvement', note: 'Engagement d\'un an signé à l\'inscription.' });
    ajouter('Application de coaching sportif', 'sport', 1499, 'mensuel', ajout(t, 4), { essaiFin: ajout(t, 4), note: 'Essai gratuit de 14 jours.' });
    ajouter('Club de randonnée (licence)', 'sport', 4200, 'annuel', passe(160, 24), { paiement: 'Chèque' });
    ajouter('Suite bureautique', 'logiciels', 9900, 'annuel', passe(130, 12));
    ajouter('Logiciel de retouche photo', 'logiciels', null, 'mensuel', passe(16, 2), { note: 'Prix à vérifier sur la prochaine facture.' });
    ajouter('Stockage en ligne', 'stockage', 299, 'mensuel', passe(11, 18));
    ajouter('Programme de livraison gratuite', 'livraison', 6990, 'annuel', passe(70, 12), { statut: 'aResilier' });
    ajouter('Panier de légumes', 'livraison', 2200, 'hebdo', ajout(t, -26), { parts: 2, paiement: 'Prélèvement' });
    ajouter('Catalogue de jeux en illimité', 'jeux', 1299, 'mensuel', passe(-20, 8), { statut: 'resilie', resilieLe: ajout(t, -75) });
    ajouter('Transports en commun', 'transport', 8640, 'mensuel', passe(-8, 15), { maPart: 4320, paiement: 'Prélèvement', note: 'L\'employeur rembourse la moitié.' });
    ajouter('Don mensuel à une association', 'dons', 1500, 'mensuel', passe(6, 30), { paiement: 'Prélèvement' });
    ajouter('Magazine de voyage', 'presse', 2400, 'trimestriel', passe(25, 9));
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi des abonnements · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="80" cy="80" r="60" fill="#F5B400"/>
          <rect x="160" y="20" width="120" height="120" fill="#1D4E89"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="410" y="130" width="40" height="40" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi des abonnements</p>
          <h1>Ce que tu paies, chaque mois.</h1>
          <p>Tous tes abonnements au même endroit : le coût réel par mois et par an, les prochains prélèvements, et les dates où il faut décider avant d'être engagé.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes abonnements sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
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
        <p class="mention">Pas encore de suivi ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  let accueil = { etape: 1, prenom: '', choisis: new Set() };
  const cleType = (c, i) => `${c}:${i}`;

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On fait le tour de tes abonnements.</h1>
        <p class="intro">Coche d'abord, dans une liste de ${B.categories.reduce((s, c) => s + c.types.length, 0)} abonnements courants, ceux que tu paies. Tu saisiras ensuite ton prix et la date d'un prélèvement : les suivants, les totaux et les alertes se calculent.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Coche ce que tu paies</h1>
        <p class="intro">Aucun prix n'est imposé : chaque abonnement coché arrive « à compléter », avec ton montant à saisir. Il manque quelque chose ? Tu pourras l'ajouter ensuite.</p>
        <div class="choix-types">${B.categories.map((c) => `<fieldset class="groupe-types"><legend>${esc(c.nom)}</legend>${c.types.map((ty, i) => `<label class="case"><input type="checkbox" data-action="choisir" value="${cleType(c.id, i)}" ${a.choisis.has(cleType(c.id, i)) ? 'checked' : ''}> <span>${esc(ty.nom)}</span></label>`).join('')}</fieldset>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    const t = auj();
    for (const cle of accueil.choisis) {
      const [cat, i] = cle.split(':');
      const ty = categorie(cat).types[Number(i)];
      E.abonnements.push(R.normaliserAbonnement({ id: uid(), nom: ty.nom, cat, montant: null, periodicite: ty.periodicite, debut: t, preavisJours: ty.preavisJours }, t));
    }
    const n = accueil.choisis.size;
    accueil = { etape: 1, prenom: '', choisis: new Set() };
    vue = n ? 'abonnements' : 'apercu';
    sauver();
    demarrer();
    toast(n ? `${pluriel(n, 'abonnement ajouté', 'abonnements ajoutés')} : saisis maintenant leurs prix (bouton « Compléter »).` : 'Ton suivi est prêt. Ajoute ton premier abonnement.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    abonnements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    economies: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['abonnements', 'Abonnements'], ['calendrier', 'Calendrier'], ['economies', 'Économies']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide au suivi de tes dépenses : il ne remplace pas un avis professionnel. Les dates et montants viennent de ta saisie ; ton contrat et tes relevés font foi.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/abonnements/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi des<br>abonnements</span>
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
    const titres = { apercu: 'Aperçu', abonnements: 'Abonnements', calendrier: 'Calendrier', economies: 'Économies' };
    document.title = `${titres[vue]} · Suivi des abonnements`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { apercu: vueApercu, abonnements: vueAbonnements, calendrier: vueCalendrier, economies: vueEconomies }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  // ---------- Décisions (alerte « à décider avant le … ») ----------
  function texteDecision(d) {
    const quand = d.joursRestants === 0 ? 'aujourd\'hui' : d.joursRestants === 1 ? 'demain' : `dans ${d.joursRestants} jours`;
    if (d.type === 'essai') return { titre: `À décider avant le ${dateLongue(d.limite)}`, detail: `L'essai gratuit se termine ${quand} : le premier prélèvement payant tombe ce jour-là.` };
    if (d.niveau === 'depasse') return { titre: 'Préavis dépassé', detail: `${d.type === 'engagement' ? 'La fin d\'engagement' : 'Le renouvellement'} du ${dateLongue(d.date)} arrive, mais la date limite du préavis (${dateLongue(d.limite)}) est passée : vérifie ton contrat, sinon décide pour l'échéance suivante.` };
    const pre = R.ecart(d.limite, d.date);
    const preavis = pre ? `avec ${pluriel(pre, 'jour')} de préavis` : 'sans préavis';
    if (d.type === 'engagement') return { titre: `À décider avant le ${dateLongue(d.limite)}`, detail: `Fin d'engagement le ${dateLongue(d.date)}, ${preavis} : date limite ${quand}.` };
    return { titre: `À décider avant le ${dateLongue(d.limite)}`, detail: `Renouvellement le ${dateLongue(d.date)}, ${preavis} : date limite ${quand}.` };
  }

  function carteDecision(d) {
    const a = abonnement(d.id);
    const tx = texteDecision(d);
    return `<article class="decision niv-${d.niveau}">
      <span class="etiquette ${d.niveau === 'depasse' ? 'rouge' : d.niveau === 'proche' ? 'jaune' : ''}">${LIB_DECISION[d.type]}</span>
      <button class="decision-corps" data-action="ouvrir" data-id="${d.id}"><b>${esc(a.nom)}</b><span class="decision-titre">${tx.titre}</span><span>${tx.detail}</span></button>
      <div class="decision-pied"><span class="montant-mini">${a.montant === null ? 'Prix à compléter' : `${euros(R.coutAnnuel(a))} par an`}</span>${a.statut === 'aResilier' ? '<span class="etiquette rose">À résilier</span>' : `<button class="btn petit" data-action="a-resilier" data-id="${d.id}">À résilier</button>`}</div>
    </article>`;
  }

  // ---------- Aperçu ----------
  function vueApercu() {
    const t = auj();
    const tot = R.totaux(E.abonnements);
    const eco = R.economies(E.abonnements);
    const mois = R.prelevementsMois(E.abonnements, t.slice(0, 7));
    const reste = mois.jours.filter((j) => j.date >= t).reduce((s, j) => s + j.total, 0);
    const decisions = R.aDecider(E.abonnements, t, E.reglages.alerteJours);
    const urgentes = decisions.filter((d) => d.niveau !== 'plus-tard');
    const plusTard = decisions.filter((d) => d.niveau === 'plus-tard');
    const proch = R.prochains(E.abonnements, t, ajout(t, 30));
    if (!E.abonnements.length) {
      return `<div class="vue-tete"><div><h1>${E.prenom ? `Bonjour ${esc(E.prenom)}` : 'Aperçu'}</h1><p>Ton suivi est vide pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute ton premier abonnement</h3><p>Choisis-le dans la liste des abonnements courants, saisis ton prix et la date d'un prélèvement : le reste se calcule.</p><div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter un abonnement</button></div></div></div>`;
    }
    const tuiles = [
      ['Par mois', euros(tot.mensuel), `${pluriel(tot.nb, 'abonnement en cours', 'abonnements en cours')}${tot.aCompleter ? ` · ${tot.aCompleter} à compléter` : ''}`, 'var(--bleu)', ''],
      ['Par an', euros(tot.annuel, { centimes: false }), 'Ma part, toutes périodicités ramenées à l\'année', 'var(--encre)', 'rond'],
      [`Prélevé en ${nomMois(t.slice(0, 7)).split(' ')[0].toLowerCase()}`, euros(mois.total), `dont ${euros(reste)} encore à venir`, 'var(--jaune)', ''],
      ['Économies', euros(eco.total, { centimes: false }), `par an : ${euros(eco.obtenue, { centimes: false })} obtenus, ${euros(eco.potentielle, { centimes: false })} à résilier`, 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    return `
      <div class="vue-tete"><div><h1>${E.prenom ? `Bonjour ${esc(E.prenom)}` : 'Aperçu'}</h1><p>Ce que te coûtent tes abonnements, ce qui va être prélevé et ce qu'il faut décider bientôt.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${tot.aCompleter ? `<p class="aide" style="margin-top:16px">${pluriel(tot.aCompleter, 'abonnement n\'a', 'abonnements n\'ont')} pas encore de prix : ${tot.aCompleter > 1 ? 'ils ne comptent' : 'il ne compte'} pas dans les totaux. <button class="btn lien" data-action="completer">Compléter</button></p>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À décider <span>Alerte ${pluriel(E.reglages.alerteJours, 'jour')} avant la date limite (réglable)</span></h2>
          ${urgentes.length ? `<div class="decisions">${urgentes.map(carteDecision).join('')}</div>` : `<div class="vide-etat petit"><div><h3>Rien à décider dans les ${E.reglages.alerteJours} jours</h3><p>Les fins d'essai, fins d'engagement et renouvellements annuels apparaissent ici à temps.</p></div></div>`}
          ${plusTard.length ? `<details class="plus-tard"><summary>${pluriel(plusTard.length, 'autre échéance', 'autres échéances')} plus tard</summary><ul class="liste-simple">${plusTard.map((d) => `<li><button class="lien-ligne" data-action="ouvrir" data-id="${d.id}"><b>${esc(d.nom)}</b><span>${LIB_DECISION[d.type]} le ${dateLongue(d.date)} · à décider avant le ${dateLongue(d.limite)}</span></button></li>`).join('')}</ul></details>` : ''}
        </section>
        <section>
          <h2 class="titre-section">30 prochains jours <span>${euros(proch.reduce((s, p) => s + (p.montant || 0), 0))}</span></h2>
          ${proch.length ? `<ul class="prochains">${proch.slice(0, 9).map((p) => `<li><span class="date-pastille"><b>${versDate(p.date).getDate()}</b>${moisCourt(p.date.slice(0, 7))}</span><button class="lien-ligne" data-action="ouvrir" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${fmt(p.date, { weekday: 'long' })}</span></button><span class="nb">${p.montant === null ? 'à compléter' : euros(p.montant)}</span></li>`).join('')}</ul>${proch.length > 9 ? `<button class="btn lien" data-action="vue" data-vue="calendrier">Voir les ${proch.length} prélèvements dans le calendrier</button>` : ''}` : '<p class="aide">Aucun prélèvement prévu dans les 30 jours.</p>'}
        </section>
      </div>
      ${graphiqueCategories(tot)}
      ${graphiqueProjection()}
      ${AVERTISSEMENT}`;
  }

  // Coût mensuel par catégorie : barres horizontales, une seule série (bleu), valeur au bout, tableau dessous.
  function graphiqueCategories(tot) {
    if (!tot.parCat.length) return '';
    const max = Math.max(...tot.parCat.map((c) => c.mensuel), 1);
    const barres = tot.parCat.map((c) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(nomCat(c.cat))}</b>${euros(c.mensuel)} par mois<br>${euros(c.annuel)} par an<br>${pluriel(c.nb, 'abonnement')} · ${Math.round((c.annuel / tot.annuel) * 100)} % du total`)}">
        <span class="bc-nom">${esc(nomCat(c.cat))}</span>
        <span class="bc-piste"><span class="bc-barre" style="width:${Math.max(0.5, (c.mensuel / max) * 100)}%"></span></span>
        <span class="bc-val"><b>${euros(c.mensuel)}</b></span>
      </div>`).join('');
    return `
      <h2 class="titre-section">Par catégorie <span>Coût mensuel équivalent, ta part seulement</span></h2>
      <figure class="graphique">
        <div class="barres-cats">${barres}</div>
        <div class="infobulle" hidden></div>
      </figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">Coût par catégorie</caption><thead><tr><th>Catégorie</th><th class="nb">Abonnements</th><th class="nb">Par mois</th><th class="nb">Par an</th></tr></thead>
        <tbody>${tot.parCat.map((c) => `<tr><td>${esc(nomCat(c.cat))}</td><td class="nb">${c.nb}</td><td class="nb">${euros(c.mensuel)}</td><td class="nb">${euros(c.annuel)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${tot.parCat.reduce((s, c) => s + c.nb, 0)}</td><td class="nb">${euros(tot.mensuel)}</td><td class="nb">${euros(tot.annuel)}</td></tr></tfoot></table></div></details>`;
  }

  // Montant réellement prélevé chaque mois sur 12 mois : colonnes, une seule série, pic annoté.
  function graphiqueProjection() {
    const p = R.projection(E.abonnements, auj(), 12);
    const max = Math.max(...p.map((x) => x.total), 1);
    const iMax = p.findIndex((x) => x.total === max);
    const moyenne = Math.round(p.reduce((s, x) => s + x.total, 0) / p.length);
    return `
      <h2 class="titre-section">12 prochains mois <span>Montant réellement prélevé chaque mois : les annuels font des pics. Moyenne ${euros(moyenne)}.</span></h2>
      <figure class="graphique">
        <div class="projection">${p.map((x, i) => `<div class="col-proj ${i === 0 ? 'actif' : ''} ${i === iMax ? 'max' : ''}" tabindex="0" data-info="${esc(`<b>${nomMois(x.mois)}</b>${euros(x.total)} prélevés<br>${pluriel(x.nb, 'prélèvement')}`)}">
          <span class="cp-val">${i === iMax || i === 0 ? euros(x.total, { centimes: false }) : ''}</span>
          <span class="cp-zone"><span class="cp-barre" style="height:${Math.max(1, (x.total / max) * 100)}%"></span></span>
          <span class="cp-mois">${moisCourt(x.mois)}</span></div>`).join('')}</div>
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Prélèvements des 12 prochains mois</caption><thead><tr><th>Mois</th><th>Montant</th><th>Prélèvements</th></tr></thead><tbody>${p.map((x) => `<tr><td>${nomMois(x.mois)}</td><td>${euros(x.total)}</td><td>${x.nb}</td></tr>`).join('')}</tbody></table>
      </figure>`;
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
        let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
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

  // ---------- Abonnements ----------
  function etiquettes(a, t) {
    const l = [];
    if (a.montant === null) l.push('<span class="etiquette jaune">Prix à compléter</span>');
    if (a.statut === 'aResilier') l.push('<span class="etiquette rose">À résilier</span>');
    if (a.statut === 'resilie') l.push(`<span class="etiquette">Résilié${a.resilieLe ? ` le ${dateCourte(a.resilieLe)}` : ''}</span>`);
    if (a.statut !== 'resilie' && a.essaiFin && a.essaiFin >= t) l.push(`<span class="etiquette ciel">Essai jusqu'au ${dateCourte(a.essaiFin)}</span>`);
    if (a.statut !== 'resilie' && a.engagementFin && a.engagementFin >= t) l.push(`<span class="etiquette ciel">Engagé jusqu'au ${dateCourte(a.engagementFin)}</span>`);
    if (R.estPartage(a)) l.push(`<span class="etiquette sable">Partagé${a.parts > 1 ? ` · ${a.parts} parts` : ''}</span>`);
    return l.join('');
  }

  function ligneAbonnement(a, t) {
    const p = R.prochainPrelevement(a, t);
    const part = R.maPart(a);
    const d = R.decisions(a, t, E.reglages.alerteJours).find((x) => x.niveau !== 'plus-tard');
    return `<li class="ligne-abo st-${a.statut} ${d ? `alerte-${d.niveau}` : ''}">
      <button class="ligne-info" data-action="ouvrir" data-id="${a.id}">
        <b>${esc(a.nom)}</b>
        <span class="ligne-detail">${a.montant === null ? `${esc(periode(a.periodicite).nom)}` : `${parPeriode(a)}${R.estPartage(a) ? ` · ma part ${euros(part)}` : ''}`}${a.paiement ? ` · ${esc(a.paiement)}` : ''}</span>
        <span class="ligne-etiquettes">${etiquettes(a, t)}${d ? `<span class="etiquette ${d.niveau === 'depasse' ? 'rouge' : 'jaune'}">${d.niveau === 'depasse' ? 'Préavis dépassé' : `À décider avant le ${dateCourte(d.limite)}`}</span>` : ''}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout">${a.montant === null ? '<button class="btn petit" data-action="ouvrir" data-id="' + a.id + '">Saisir le prix</button>' : `<b>${euros(R.coutMensuel(a))}</b><small>par mois · ${euros(R.coutAnnuel(a), { centimes: false })} par an</small>`}</span>
        <span class="ligne-proch">${p ? `Prochain : ${fmt(p)}` : a.statut === 'resilie' ? 'Plus de prélèvement' : ''}</span>
      </div>
    </li>`;
  }

  function vueAbonnements() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const garde = (a) => (filtre.statut === 'tous' || (filtre.statut === 'encours' && a.statut !== 'resilie') || a.statut === filtre.statut)
      && (!q || `${a.nom} ${nomCat(a.cat)} ${a.paiement} ${a.note}`.toLowerCase().includes(q));
    const liste = E.abonnements.filter(garde);
    const nb = (s) => E.abonnements.filter((a) => s === 'tous' || (s === 'encours' ? a.statut !== 'resilie' : a.statut === s)).length;
    const groupes = B.categories.map((c) => ({ c, abos: liste.filter((a) => a.cat === c.id).sort((x, y) => (R.coutAnnuel(y) ?? -1) - (R.coutAnnuel(x) ?? -1) || x.nom.localeCompare(y.nom)) })).filter((g) => g.abos.length);
    const aCompleter = E.abonnements.filter((a) => a.montant === null && a.statut !== 'resilie').length;
    const filtres = [['encours', 'En cours'], ['aResilier', 'À résilier'], ['resilie', 'Résiliés'], ['tous', 'Tous']];
    return `
      <div class="vue-tete"><div><h1>Abonnements</h1><p>Clique sur un abonnement pour le modifier, le marquer « à résilier » ou « résilié ». Les coûts affichés sont ta part.</p></div>
        <div class="actions">${aCompleter ? `<button class="btn" data-action="completer">Compléter (${aCompleter})</button>` : ''}<button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un abonnement" value="${esc(filtre.q)}"></label>
      </div>
      ${groupes.length ? groupes.map(({ c, abos }) => {
        const enCours = abos.filter(R.compte);
        const m = enCours.reduce((s, a) => s + (R.coutAnnuel(a) || 0), 0);
        return `<section class="groupe-cat"><h2 class="titre-cat">${esc(c.nom)}<span>${pluriel(abos.length, 'abonnement')}${m ? ` · ${euros(Math.round(m / 12))} par mois · ${euros(m, { centimes: false })} par an` : ''}</span></h2><ul class="lignes-abos">${abos.map((a) => ligneAbonnement(a, t)).join('')}</ul></section>`;
      }).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.abonnements.length ? 'Aucun abonnement ne correspond' : 'Aucun abonnement'}</h3><p>${E.abonnements.length ? 'Change le filtre ou la recherche.' : 'Ajoute ton premier abonnement depuis la liste des abonnements courants.'}</p><div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter un abonnement</button></div></div></div>`}`;
  }

  // ---------- Calendrier ----------
  function vueCalendrier() {
    const t = auj();
    const m = R.prelevementsMois(E.abonnements, moisVu);
    const premier = `${moisVu}-01`;
    const decal = (versDate(premier).getDay() + 6) % 7;
    const nbJours = Number(m.fin.slice(8, 10));
    const parJour = new Map(m.jours.map((j) => [j.date, j]));
    const cases = [];
    for (let i = 0; i < decal; i++) cases.push('<div class="cal-case vide" aria-hidden="true"></div>');
    for (let j = 1; j <= nbJours; j++) {
      const d = `${moisVu}-${String(j).padStart(2, '0')}`;
      const x = parJour.get(d);
      cases.push(`<div class="cal-case ${d === t ? 'auj' : ''} ${d < t ? 'passe' : ''} ${x ? 'plein' : ''}"><span class="cal-num">${j}</span>${x ? `<ul>${x.items.map((i) => `<li><button data-action="ouvrir" data-id="${i.id}"><span>${esc(i.nom)}</span><b>${i.montant === null ? '?' : euros(i.montant)}</b></button></li>`).join('')}</ul><span class="cal-total">${euros(x.total, { centimes: x.total % 100 !== 0 })}</span>` : ''}</div>`);
    }
    const estCourant = moisVu === t.slice(0, 7);
    const reste = m.jours.filter((j) => j.date >= t).reduce((s, j) => s + j.total, 0);
    return `
      <div class="vue-tete"><div><h1>${nomMois(moisVu)}</h1><p>${pluriel(m.nb, 'prélèvement')} pour ${euros(m.total)}${estCourant ? `, dont ${euros(reste)} encore à venir` : ''}${m.aCompleter ? ` (${m.aCompleter} sans prix)` : ''}. Les montants sont ta part.</p></div>
        <div class="actions nav-mois">
          <button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent">${ICONES.gauche}</button>
          <button class="btn petit" data-action="mois-auj" ${estCourant ? 'disabled' : ''}>Ce mois-ci</button>
          <button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant">${ICONES.droite}</button>
        </div></div>
      <div class="calendrier" role="grid" aria-label="Prélèvements de ${nomMois(moisVu)}">
        ${JOURS_COURTS.map((j) => `<div class="cal-tete" role="columnheader">${j}</div>`).join('')}
        ${cases.join('')}
      </div>
      <h2 class="titre-section">Jour par jour</h2>
      ${m.jours.length ? `<ul class="jours-liste">${m.jours.map((j) => `<li class="${j.date < t ? 'passe' : ''}"><span class="date-pastille"><b>${versDate(j.date).getDate()}</b>${fmt(j.date, { weekday: 'short' }).replace('.', '')}</span><ul>${j.items.map((i) => `<li><button class="lien-ligne" data-action="ouvrir" data-id="${i.id}"><b>${esc(i.nom)}</b></button><span class="nb">${i.montant === null ? 'à compléter' : euros(i.montant)}</span></li>`).join('')}</ul><span class="nb total-jour">${euros(j.total)}</span></li>`).join('')}</ul>` : '<p class="aide">Aucun prélèvement ce mois-ci.</p>'}
      <p class="mention" style="margin-top:20px">Dates calculées depuis la date de prélèvement saisie et la périodicité ; un prélèvement prévu le 31 tombe le dernier jour des mois plus courts. Ta banque peut décaler un prélèvement d'un ou deux jours ouvrés.</p>`;
  }

  // ---------- Économies ----------
  function vueEconomies() {
    const t = auj();
    const eco = R.economies(E.abonnements);
    const tot = R.totaux(E.abonnements);
    const ligne = (a, resilie) => `<li class="ligne-eco">
      <button class="lien-ligne" data-action="ouvrir" data-id="${a.id}"><b>${esc(a.nom)}</b><span>${esc(nomCat(a.cat))} · ${a.montant === null ? 'prix à compléter' : parPeriode(a)}${resilie ? (a.resilieLe ? ` · plus de prélèvement depuis le ${dateCourte(a.resilieLe)}` : '') : (R.prochainPrelevement(a, t) ? ` · prochain prélèvement ${fmt(R.prochainPrelevement(a, t))}` : '')}</span></button>
      <span class="eco-val"><b>${euros(R.coutAnnuel(a) || 0, { centimes: false })}</b><small>par an</small></span>
      <span class="eco-actions">${resilie ? `<button class="btn petit" data-action="reactiver" data-id="${a.id}">Réactiver</button>` : `<button class="btn petit primaire" data-action="resilie" data-id="${a.id}">C'est résilié</button><button class="btn petit" data-action="garder" data-id="${a.id}">Garder</button>`}</span>
    </li>`;
    // Pistes : plusieurs abonnements en cours dans une catégorie où l'on en garde souvent un seul, essais en cours.
    const pistes = tot.parCat.filter((c) => c.nb > 1 && categorie(c.cat).doublon).map((c) => `Tu as ${c.nb} abonnements « ${esc(nomCat(c.cat))} » en cours, pour ${euros(c.mensuel)} par mois : en garder un seul ?`);
    const jamaisDecide = E.abonnements.filter((a) => a.statut === 'actif' && a.essaiFin && a.essaiFin >= t);
    jamaisDecide.forEach((a) => pistes.push(`L'essai « ${esc(a.nom)} » devient payant le ${dateLongue(a.essaiFin)} : ${euros(R.coutAnnuel(a) || 0, { centimes: false })} par an s'il continue.`));
    return `
      <div class="vue-tete"><div><h1>Économies</h1><p>Marque « à résilier » ce que tu veux arrêter : l'abonnement compte encore dans tes dépenses jusqu'à ce que tu confirmes « c'est résilié ». L'économie est le coût annuel de ta part.</p></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">À résilier</p><b>${euros(eco.potentielle, { centimes: false })}</b><span>par an, ${pluriel(eco.aResilier.length, 'abonnement')} à arrêter</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Déjà obtenu</p><b>${euros(eco.obtenue, { centimes: false })}</b><span>par an, ${pluriel(eco.resilies.length, 'abonnement résilié', 'abonnements résiliés')}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Après résiliation</p><b>${euros(tot.mensuel - Math.round(eco.potentielle / 12))}</b><span>par mois, contre ${euros(tot.mensuel)} aujourd'hui</span></div>
      </div>
      <h2 class="titre-section">À résilier</h2>
      ${eco.aResilier.length ? `<ul class="lignes-eco">${eco.aResilier.map((a) => ligne(a, false)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Rien à résilier pour l'instant</h3><p>Ouvre un abonnement et choisis « À résilier » : il apparaîtra ici avec l'économie annuelle.</p></div></div>`}
      ${pistes.length ? `<h2 class="titre-section">Pistes</h2><ul class="pistes">${pistes.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
      <h2 class="titre-section">Résiliés</h2>
      ${eco.resilies.length ? `<ul class="lignes-eco">${eco.resilies.map((a) => ligne(a, true)).join('')}</ul>` : '<p class="aide">Aucun abonnement résilié pour l\'instant.</p>'}
      <h2 class="titre-section">Repères pour résilier <span>Droit français de la consommation, à vérifier</span></h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <p class="mention" style="margin-top:12px">${esc(B.sourceReperes)} La résiliation se fait auprès de chaque prestataire : ce suivi ne résilie rien à ta place et ne se connecte à aucun compte.</p>
      ${AVERTISSEMENT}`;
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

  const optionsTypes = () => B.categories.map((c) => `<optgroup label="${esc(c.nom)}">${c.types.map((ty, i) => `<option value="${cleType(c.id, i)}">${esc(ty.nom)}</option>`).join('')}</optgroup>`).join('');

  // Nouvel abonnement (id absent) ou abonnement existant. « suite » : enchaîner sur le suivant à compléter.
  function modaleAbonnement(id, { suite = false } = {}) {
    const t = auj();
    const a = id ? abonnement(id) : null;
    if (id && !a) return;
    const v = a || { nom: '', cat: 'video', montant: null, periodicite: 'mensuel', debut: t, essaiFin: null, engagementFin: null, preavisJours: 0, paiement: '', parts: 1, maPart: null, statut: 'actif', resilieLe: null, note: '' };
    const statuts = [['actif', 'Actif'], ['aResilier', 'À résilier'], ['resilie', 'Résilié']];
    const corps = `
      ${a ? '' : `<label class="champ">Choisir dans la liste <small>Remplit le nom, la catégorie, la périodicité et le préavis courant. Aucun prix n'est proposé.</small><select id="type-base"><option value="">Abonnement courant…</option>${optionsTypes()}</select></label><p class="aide" id="aide-type" hidden></p>`}
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(v.nom)}" placeholder="Ex. : Plateforme de streaming vidéo"></label>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="cat">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.cat ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Périodicité<select name="periodicite">${B.periodicites.map((p) => `<option value="${p.id}" ${p.id === v.periodicite ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Montant prélevé<small>Prix total, en euros. Vide si tu ne le connais pas encore.</small><input name="montant" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.montant)}" placeholder="0,00"></label>
        <label class="champ">Date d'un prélèvement<small>Le prochain, ou un passé : les suivants sont calculés.</small><input type="date" name="debut" value="${v.debut}" required></label>
      </div>
      <label class="champ">Moyen de paiement <small>Facultatif.</small><input name="paiement" maxlength="60" list="paiements" value="${esc(v.paiement)}" placeholder="Ex. : Carte bancaire"></label>
      <datalist id="paiements">${B.paiements.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <fieldset class="champ cadre-champs"><legend>Partage <small>Si tu partages cet abonnement, seule ta part compte dans les totaux.</small></legend>
        <div class="rang-champs">
          <label class="champ">Nombre de parts<input type="number" name="parts" min="1" max="20" step="1" value="${v.parts}"></label>
          <label class="champ">Ma part par prélèvement<small>Vide : montant ÷ parts.</small><input name="maPart" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.maPart)}" placeholder="Calculée"></label>
        </div></fieldset>
      <fieldset class="champ cadre-champs"><legend>Dates qui engagent <small>Pour l'alerte « à décider avant le … ».</small></legend>
        <div class="rang-champs">
          <label class="champ">Fin de l'essai gratuit<input type="date" name="essaiFin" value="${v.essaiFin || ''}"></label>
          <label class="champ">Fin d'engagement<input type="date" name="engagementFin" value="${v.engagementFin || ''}"></label>
          <label class="champ">Préavis (jours)<input type="number" name="preavisJours" min="0" max="365" step="1" value="${v.preavisJours}"></label>
        </div></fieldset>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut">${statuts.map(([s, l]) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="champ-resilie" ${v.statut === 'resilie' ? '' : 'hidden'}>Plus de prélèvement à partir du<input type="date" name="resilieLe" value="${v.resilieLe || R.prochainPrelevement({ ...v, statut: 'actif' }, t) || t}"></label>
      <label class="champ">Note<small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? `<button class="btn primaire" value="ok">${suite ? 'Enregistrer et suivant' : 'Enregistrer'}</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? (suite ? 'Compléter' : 'Modifier l\'abonnement') : 'Nouvel abonnement', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${a.nom} » ? Pour garder la trace de l'économie, préfère le statut « Résilié ».`)) { modale().dataset.garder = '1'; return; }
        retenir();
        E.abonnements = E.abonnements.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast(`« ${a.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      const brut = String(f.get('montant') || '').trim();
      const montant = brut ? R.lireMontant(brut) : null;
      if (brut && montant === null) return 'Montant illisible : écris par exemple 12,99.';
      const brutPart = String(f.get('maPart') || '').trim();
      const part = brutPart ? R.lireMontant(brutPart) : null;
      if (brutPart && part === null) return 'Part illisible : écris par exemple 4,50.';
      if (part !== null && montant !== null && part > montant) return 'Ta part ne peut pas dépasser le montant prélevé.';
      if (!f.get('debut')) return 'Indique la date d\'un prélèvement.';
      const statut = f.get('statut') || 'actif';
      const donnees = R.normaliserAbonnement({
        id: a?.id || uid(), nom, cat: f.get('cat'), montant, periodicite: f.get('periodicite'), debut: f.get('debut'),
        essaiFin: f.get('essaiFin') || null, engagementFin: f.get('engagementFin') || null, preavisJours: f.get('preavisJours'),
        paiement: String(f.get('paiement') || '').trim(), parts: f.get('parts'), maPart: part, statut,
        resilieLe: statut === 'resilie' ? (f.get('resilieLe') || t) : null, note: String(f.get('note') || '').trim(),
      }, t);
      retenir();
      if (a) Object.assign(a, donnees); else E.abonnements.push(donnees);
      sauver(); rendre();
      const suivant = suite && E.abonnements.find((x) => x.montant === null && x.statut !== 'resilie' && x.id !== donnees.id);
      if (suivant) { modale().dataset.garder = '1'; modaleAbonnement(suivant.id, { suite: true }); return; }
      toast(a ? `« ${nom} » enregistré.` : `« ${nom} » ajouté${montant === null ? ', prix à compléter' : ` : ${euros(R.coutMensuel(donnees))} par mois`}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', () => { d.querySelector('#champ-resilie').hidden = d.querySelector('[name=statut]:checked').value !== 'resilie'; }));
    d.querySelector('#type-base')?.addEventListener('change', (e) => {
      if (!e.target.value) return;
      const [cat, i] = e.target.value.split(':');
      const ty = categorie(cat).types[Number(i)];
      d.querySelector('[name=nom]').value = ty.nom;
      d.querySelector('[name=cat]').value = cat;
      d.querySelector('[name=periodicite]').value = ty.periodicite;
      d.querySelector('[name=preavisJours]').value = ty.preavisJours;
      const aide = d.querySelector('#aide-type');
      const bouts = [];
      if (ty.engagementMois) bouts.push(`engagement courant de ${ty.engagementMois} mois (indique sa date de fin si tu es engagé)`);
      if (ty.preavisJours) bouts.push(`préavis courant de ${ty.preavisJours} jours`);
      if (ty.essai) bouts.push('souvent proposé avec un essai gratuit');
      aide.textContent = bouts.length ? `Repère : ${bouts.join(', ')}. Ton contrat fait foi.` : 'Saisis ton montant et la date d\'un prélèvement.';
      aide.hidden = false;
      d.querySelector('[name=montant]').focus();
    });
  }

  function modaleResilie(id) {
    const a = abonnement(id);
    if (!a) return;
    const t = auj();
    const p = R.prochainPrelevement({ ...a, statut: 'actif' }, t) || t;
    ouvrirModale('C\'est résilié', `
      <p>« ${esc(a.nom)} » sort de tes dépenses en cours. Économie : <b>${euros(R.coutAnnuel(a) || 0)} par an</b>.</p>
      <label class="champ">Plus de prélèvement à partir du<small>En général la prochaine échéance (${fmt(p, { day: 'numeric', month: 'long' })}), sauf résiliation immédiate.</small><input type="date" name="resilieLe" value="${p}" required></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Confirmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const d = f.get('resilieLe');
      if (!d) return 'Choisis la date.';
      retenir();
      a.statut = 'resilie'; a.resilieLe = d;
      sauver(); rendre();
      toast(`« ${a.nom} » résilié : ${euros(R.coutAnnuel(a) || 0, { centimes: false })} économisés par an.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function changerStatut(id, statut) {
    const a = abonnement(id);
    if (!a) return;
    retenir();
    a.statut = statut;
    if (statut !== 'resilie') a.resilieLe = null;
    sauver(); rendre();
    const msg = { aResilier: `« ${a.nom} » à résilier : ${euros(R.coutAnnuel(a) || 0, { centimes: false })} par an d'économie possible.`, actif: `« ${a.nom} » gardé.` }[statut];
    toast(msg, { libelle: 'Annuler', faire: annuler });
  }

  // Récapitulatif en texte simple, à copier dans un message ou une note.
  function texteRecap() {
    const t = auj();
    const tot = R.totaux(E.abonnements);
    const eco = R.economies(E.abonnements);
    const lignes = [`Mes abonnements au ${dateLongue(t)}`, `Total : ${euros(tot.mensuel)} par mois, ${euros(tot.annuel)} par an (${pluriel(tot.nb, 'abonnement')} en cours).`, ''];
    for (const c of B.categories) {
      const abos = E.abonnements.filter((a) => a.cat === c.id && R.compte(a));
      if (!abos.length) continue;
      lignes.push(`${c.nom}`);
      for (const a of abos) lignes.push(`- ${a.nom} : ${a.montant === null ? 'prix à compléter' : `${parPeriode(a)}${R.estPartage(a) ? ` (ma part ${euros(R.maPart(a))})` : ''}, soit ${euros(R.coutMensuel(a))} par mois`}${a.statut === 'aResilier' ? ' [à résilier]' : ''}`);
      lignes.push('');
    }
    const dec = R.aDecider(E.abonnements, t, E.reglages.alerteJours).filter((d) => d.niveau !== 'plus-tard');
    if (dec.length) { lignes.push('À décider'); dec.forEach((d) => lignes.push(`- ${d.nom} : ${LIB_DECISION[d.type].toLowerCase()} le ${dateLongue(d.date)}, à décider avant le ${dateLongue(d.limite)}`)); lignes.push(''); }
    if (eco.total) lignes.push(`Économies : ${euros(eco.potentielle)} par an à résilier, ${euros(eco.obtenue)} par an déjà obtenus.`);
    return lignes.join('\n').trim();
  }

  function modaleRecap() {
    ouvrirModale('Récapitulatif à copier', `
      <p class="aide">Texte simple à coller dans un message ou une note. Rien n'est envoyé.</p>
      <label class="champ"><span class="sr-only">Récapitulatif</span><textarea id="recap" rows="14" readonly>${esc(texteRecap())}</textarea></label>`,
    '<button class="btn primaire" type="button" data-action="copier">Copier</button><button class="btn" value="annuler">Fermer</button>');
  }

  async function copierRecap() {
    const zone = $('#recap');
    if (!zone) return;
    try { await navigator.clipboard.writeText(zone.value); toast('Récapitulatif copié.'); } catch { zone.select(); toast('Sélectionné : copie-le avec Ctrl+C (ou un appui long).'); }
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Alerte « à décider »<small>Nombre de jours avant la date limite (fin d'essai, fin d'engagement, renouvellement).</small><input type="number" name="alerteJours" min="1" max="120" step="1" value="${E.reglages.alerteJours}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Partager et imprimer</h3><p class="aide">Aucun envoi automatique : copie un récapitulatif, imprime la liste ou exporte-la en tableur.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="recap">Récapitulatif à copier</button><button class="btn petit" type="button" data-action="imprimer">Imprimer</button><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Base intégrée : ${B.categories.length} catégories, ${B.categories.reduce((s, c) => s + c.types.length, 0)} abonnements courants sans marque ni prix (version ${B.version}). ${esc(B.sourceReperes)} Aucune connexion bancaire, aucun lien de résiliation : tu gardes la main.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = Math.round(Number(f.get('alerteJours')));
      if (!(n >= 1 && n <= 120)) return 'L\'alerte doit être entre 1 et 120 jours.';
      E.prenom = String(f.get('prenom') || '').trim();
      E.reglages.alerteJours = n;
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.abonnements)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.abonnements.length, 'abonnement')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `abonnements-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E.abonnements, nomCat, (p) => periode(p).nom, auj()), 'text/csv;charset=utf-8', `abonnements-${auj()}.csv`);

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
      case 'choisir': if (el.checked) accueil.choisis.add(el.value); else accueil.choisis.delete(el.value); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'imprimer': if (modale().open) modale().close(); if (vue !== 'abonnements') { filtre.statut = 'encours'; changerVue('abonnements'); } setTimeout(() => window.print(), 50); break;
      case 'recap': modaleRecap(); break;
      case 'copier': copierRecap(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau': modaleAbonnement(null); break;
      case 'ouvrir': modaleAbonnement(id); break;
      case 'completer': { const a = E.abonnements.find((x) => x.montant === null && x.statut !== 'resilie'); if (a) modaleAbonnement(a.id, { suite: true }); break; }
      case 'a-resilier': changerStatut(id, 'aResilier'); break;
      case 'garder': changerStatut(id, 'actif'); break;
      case 'reactiver': changerStatut(id, 'actif'); break;
      case 'resilie': modaleResilie(id); break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      case 'mois-prec': moisVu = R.ajoutMoisCle(moisVu, -1); rendre(); break;
      case 'mois-suiv': moisVu = R.ajoutMoisCle(moisVu, 1); rendre(); break;
      case 'mois-auj': moisVu = auj().slice(0, 7); rendre(); break;
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
  window.__abonnements = { etat: () => E, regles: R };
  init();
})();
