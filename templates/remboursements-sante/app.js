// Remboursements santé QME : soins payés, remboursements de la Sécurité sociale et de la mutuelle, reste à charge,
// retards et relances à copier, bilan annuel par personne et par type de soin.
// Données de santé : consentement explicite au premier lancement, rien n'est enregistré en ligne avant.
// Données synchronisées par clé de licence ou code d'accès. Aucune connexion à un compte, aucun envoi.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RBS;
  const TYPES = R.indexTypes(B);
  const API = '/api/templates';
  const PRODUIT = 'RBS';
  const CLE_CODE = 'qme-rbs-code';
  const CLE_CACHE = 'qme-rbs-cache';
  const CLE_DEMO = 'qme-rbs-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rbs-ecran-accueil';
  const VERSION_CONSENTEMENT = '2026-11-14';

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
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const nomMois = (cle) => { const t = versDate(`${cle}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  const nomType = (id) => TYPES[id]?.nom || 'Autre soin';
  const famille = (id) => B.familles.find((f) => f.id === id) || B.familles[B.familles.length - 1];
  const ORG = B.organismes;
  const nomOrg = (k) => (k === 'mut' ? (E?.reglages.nomMutuelle || 'Mutuelle') : ORG.ss.nom);
  const courtOrg = (k) => (k === 'mut' ? (E?.reglages.nomMutuelle || 'Mutuelle') : 'Sécu');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  const filtre = { etat: 'tous', membre: '', q: '' };
  let anneeVue = auj().slice(0, 4);
  let annulation = null;

  // tutorielVu (guide « Comment ça marche » déjà vu) : réinjecté, la normalisation de regles.js ne le garde pas.
  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, auj()), tutorielVu: !!d?.tutorielVu });
  const soin = (id) => E.soins.find((s) => s.id === id);
  const membre = (id) => E.membres.find((m) => m.id === id);
  const nomMembre = (id) => membre(id)?.prenom || '—';
  const couleurMembre = (id) => B.couleurs[Math.max(0, E.membres.findIndex((m) => m.id === id)) % B.couleurs.length];
  const puceMembre = (id) => `<span class="membre"><i style="background:${couleurMembre(id)}"></i>${esc(nomMembre(id))}</span>`;

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
    // Données de santé : rien ne part en ligne sans consentement.
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
        if (!E.consentement) { E = null; stock.suppr(CLE_CACHE); ecranConsentement('Tes données ont été effacées depuis un autre appareil.'); return; }
        rendre();
        toast('Un autre appareil a modifié tes soins entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
    if (session.demo || !session.code || !E || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!E.consentement) { E = null; stock.suppr(CLE_CACHE); ecranConsentement('Tes données ont été effacées depuis un autre appareil.'); return; }
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
  // Code interne (RBS-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    clearTimeout(minuterie);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    $('#toast').hidden = true;
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Foyer fictif de quatre personnes, soins à des dates relatives à aujourd'hui, tous les états représentés :
  // retards (Sécurité sociale et mutuelle), relance déjà faite, attente récente, montant à préciser, tiers payant,
  // pas de prise en charge, reçu avec écart, soins de l'année précédente pour le bilan.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    e.consentement = { date: new Date().toISOString(), version: VERSION_CONSENTEMENT, demo: true };
    e.prenom = 'Camille';
    e.reglages.nomMutuelle = 'Ma mutuelle';
    const m = ['Camille', 'Julien', 'Léa', 'Tom'].map((prenom) => ({ id: uid(), prenom }));
    e.membres = m;
    const [cam, jul, lea, tom] = m.map((x) => x.id);
    const j = (n) => ajout(t, n);
    const at = (attendu, extra = {}) => ({ mode: 'attendu', attendu, ...extra });
    const tiers = (attendu) => ({ mode: 'tiers', attendu });
    const aucun = { mode: 'aucun' };
    const ajouter = (membre, type, date, montant, ss, mut, extra = {}) => e.soins.push(R.normaliserSoin({ id: uid(), membre, type, date, montant, ss, mut, ...extra }, t));
    ajouter(cam, 'generaliste', j(-3), 3000, at(1900), at(900));
    ajouter(lea, 'specialiste', j(-12), 6000, at(null), at(null), { praticien: 'Cabinet du spécialiste' });
    ajouter(cam, 'psychologue', j(-9), 6000, aucun, aucun);
    ajouter(tom, 'pharmacie', j(-19), 1840, tiers(1210), tiers(630));
    ajouter(jul, 'osteopathe', j(-30), 6000, aucun, at(4000, { transmisLe: j(-28), recuLe: j(-21), recu: 4000 }));
    ajouter(cam, 'kine', j(-44), 16000, at(6970, { transmisLe: j(-42) }), at(4800), { praticien: 'Cabinet de kiné du quartier', reference: 'Feuille de soins papier' });
    ajouter(jul, 'lunettes', j(-52), 42000, at(900, { recuLe: j(-45), recu: 900 }), at(25000, { transmisLe: j(-44), relances: [j(-12)] }), { praticien: 'Opticien', reference: 'Facture 2611-08' });
    ajouter(lea, 'orthodontie', j(-78), 20000, at(13500, { recuLe: j(-66), recu: 13500 }), at(5000, { transmisLe: j(-64) }), { praticien: 'Orthodontiste' });
    ajouter(tom, 'laboratoire', j(-95), 3500, tiers(2100), at(1400, { recuLe: j(-81), recu: 1400 }));
    ajouter(cam, 'dentiste', j(-118), 2300, at(1610, { recuLe: j(-112), recu: 1610 }), at(690, { recuLe: j(-104), recu: 590 }));
    ajouter(jul, 'prothese-dentaire', j(-160), 80000, at(8400, { recuLe: j(-150), recu: 8400 }), at(45000, { transmisLe: j(-150), recuLe: j(-131), recu: 45000 }), { praticien: 'Cabinet dentaire' });
    ajouter(tom, 'generaliste', j(-205), 3000, at(2100, { recuLe: j(-200), recu: 2100 }), at(900, { recuLe: j(-196), recu: 900 }));
    ajouter(cam, 'pharmacie', j(-240), 2760, tiers(1520), tiers(1240));
    ajouter(lea, 'vaccin', j(-270), 3200, tiers(2100), at(1100, { recuLe: j(-255), recu: 1100 }));
    ajouter(jul, 'radiologie', j(-300), 5600, at(3920, { recuLe: j(-292), recu: 3920 }), at(1680, { recuLe: j(-285), recu: 1680 }));
    ajouter(lea, 'lunettes', j(-410), 18000, at(600, { recuLe: j(-400), recu: 600 }), at(10000, { recuLe: j(-390), recu: 10000 }), { praticien: 'Opticien' });
    ajouter(cam, 'generaliste', j(-440), 3000, at(1900, { recuLe: j(-434), recu: 1900 }), at(900, { recuLe: j(-430), recu: 900 }));
    e.cotisations[t.slice(0, 4)] = 102000;
    e.cotisations[String(Number(t.slice(0, 4)) - 1)] = 96000;
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Remboursements santé · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <path d="M20 280 L20 160 A120 120 0 0 1 140 280 Z" fill="#D9302A"/>
          <rect x="160" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <rect x="410" y="60" width="40" height="180" fill="#D9302A"/>
          <rect x="340" y="130" width="180" height="40" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Remboursements santé</p>
          <h1>Ce qu'on te doit encore.</h1>
          <p>Chaque soin payé, ce que la Sécurité sociale et ta mutuelle t'ont rendu, ce qui tarde, et le message de relance prêt à copier.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes soins sont enregistrés en ligne, dans l'Union européenne, et te suivent sur tous tes appareils.</p>
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

  // ---------- Premier lancement : consentement puis foyer ----------
  const TEXTE_DONNEES = `
    <ul class="puces">
      <li><b>Quelles données</b> : pour chaque soin, la personne du foyer, le <b>type de soin</b>, la date, le praticien si tu le notes, les montants payés et remboursés. <b>Aucun diagnostic, aucun motif, aucun numéro de sécurité sociale</b> n'est demandé. Le type de soin reste une <b>donnée de santé</b> au sens du RGPD (article 9).</li>
      <li><b>Où</b> : en ligne, chez l'hébergeur Netlify, <b>dans l'Union européenne (Francfort, Allemagne)</b>, rattachées à ta clé de licence, et en copie dans ce navigateur pour fonctionner hors ligne.</li>
      <li><b>À quoi elles servent</b> : uniquement à calculer tes remboursements, tes retards et ton bilan, sur tes appareils. Elles ne sont ni vendues, ni partagées, ni utilisées pour de la publicité.</li>
      <li><b>Comment les effacer</b> : Réglages → « Effacer toutes mes données » vide la version en ligne et celle de cet appareil. Tu peux aussi écrire à <b>quentin.morel@qm-engineering.fr</b> (Quentin Morel Engineering, responsable du traitement).</li>
      <li><b>Le détail</b> : <a href="/confidentialite/" target="_blank" rel="noopener">politique de confidentialité de QME</a>.</li>
    </ul>`;
  const AVERTISSEMENT_TEXTE = 'Outil d\'aide au suivi de tes remboursements : il ne remplace ni un avis professionnel (médical, administratif ou financier) ni les relevés officiels. Les décomptes de l\'Assurance Maladie et de ta complémentaire santé font foi. Aucun taux de remboursement n\'est intégré : les montants attendus viennent de ta saisie.';
  const AVERTISSEMENT = `<p class="mention avertissement">${AVERTISSEMENT_TEXTE}</p>`;

  let accueil = { consentement: null, prenom: '', autres: ['', '', '', ''] };

  function ecranConsentement(message = '') {
    document.body.classList.remove('app');
    document.title = 'Avant de commencer · Remboursements santé';
    accueil = { consentement: null, prenom: '', autres: ['', '', '', ''] };
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><div class="etapes-accueil" aria-label="Étape 1 sur 2"><span class="actif"></span><span></span></div></div>
        ${message ? `<p class="aide" role="status" style="margin-bottom:20px">${esc(message)}</p>` : ''}
        <p class="surtitre">Avant de commencer</p>
        <h1>Tes données de santé restent à toi.</h1>
        <p class="intro">Rien n'est enregistré tant que tu n'as pas donné ton accord ci-dessous. Lis ces cinq points.</p>
        <div class="consentement">${TEXTE_DONNEES}</div>
        <p class="aide avertissement-sante" style="margin-top:16px">${AVERTISSEMENT_TEXTE}</p>
        <form id="form-consentement" class="consentement-form" novalidate>
          <label class="case haute"><input type="checkbox" id="accord"> <span>J'accepte que ces données de santé (type de soin, date, praticien, montants) soient enregistrées en ligne, dans l'Union européenne (Francfort), pour faire fonctionner ce suivi. Je pourrai retirer cet accord à tout moment en effaçant mes données.</span></label>
          <label class="case haute"><input type="checkbox" id="foyer"> <span>J'ai 18 ans ou plus. Pour les autres membres de mon foyer, je saisis leurs soins avec leur accord, ou en tant que parent ou représentant légal.</span></label>
          <div class="accueil-pied">
            <button class="btn primaire" id="accepter" type="submit" disabled>Continuer</button>
            <button class="btn" type="button" data-action="deconnexion">Refuser et me déconnecter</button>
          </div>
        </form>
      </div>`;
    const maj = () => { $('#accepter').disabled = !($('#accord').checked && $('#foyer').checked); };
    $('#accord').addEventListener('change', maj);
    $('#foyer').addEventListener('change', maj);
    $('#form-consentement').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!($('#accord').checked && $('#foyer').checked)) return;
      accueil.consentement = { date: new Date().toISOString(), version: VERSION_CONSENTEMENT };
      ecranFoyer();
      window.scrollTo({ top: 0 });
    });
  }

  function ecranFoyer() {
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><div class="etapes-accueil" aria-label="Étape 2 sur 2"><span class="actif"></span><span class="actif"></span></div></div>
        <p class="surtitre">Ton foyer</p>
        <h1>Pour qui suis-tu les soins ?</h1>
        <p class="intro">Un prénom ou un surnom par personne suffit. Tu pourras en ajouter ou en renommer dans les Réglages.</p>
        <form id="form-foyer" novalidate>
          <label class="champ" style="max-width:360px">Ton prénom <small>Il signe aussi tes messages de relance.</small><input name="prenom" maxlength="30" autocomplete="given-name" value="${esc(accueil.prenom)}" placeholder="Ex. : Camille"></label>
          <fieldset class="champ sans-cadre"><legend>Autres membres du foyer <small>Facultatif : conjoint, enfants…</small></legend>
            <div class="grille-membres">${accueil.autres.map((v, i) => `<input name="autre${i}" maxlength="30" value="${esc(v)}" aria-label="Membre ${i + 2}" placeholder="Prénom">`).join('')}</div>
          </fieldset>
          <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
          <div class="accueil-pied">
            <button class="btn primaire" type="submit">Ouvrir mon suivi</button>
            <button class="btn" type="button" data-action="accueil-retour">Retour</button>
          </div>
        </form>
      </div>`;
    $('#form-foyer').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const prenom = String(f.get('prenom') || '').trim().slice(0, 30);
      E = etatVide();
      E.consentement = accueil.consentement;
      E.prenom = prenom;
      E.membres = [{ id: uid(), prenom: prenom || 'Moi' }];
      for (let i = 0; i < 4; i++) { const p = String(f.get(`autre${i}`) || '').trim().slice(0, 30); if (p) E.membres.push({ id: uid(), prenom: p }); }
      vue = 'apercu';
      sauver();
      demarrer();
      toast('Ton suivi est prêt. Ajoute ton premier soin.');
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    soins: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="18" fill="currentColor"/><rect x="3" y="9" width="18" height="6" fill="currentColor"/></svg>',
    relances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="5" height="9" fill="currentColor"/><rect x="10" y="6" width="5" height="15" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['soins', 'Soins'], ['relances', 'Relances'], ['bilan', 'Bilan']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Foyer fictif, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Remboursements<br>santé</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span><b class="compteur" data-compteur="${id}" hidden></b></button>`).join('')}</nav>
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
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const nbRetards = R.attentes(E.soins, auj(), E.reglages).filter((a) => a.etat === 'retard').length;
    const c = $('[data-compteur="relances"]');
    if (c) { c.hidden = !nbRetards; c.textContent = nbRetards; c.setAttribute('aria-label', `${pluriel(nbRetards, 'remboursement')} en retard`); }
    const titres = { apercu: 'Aperçu', soins: 'Soins', relances: 'Relances', bilan: 'Bilan' };
    document.title = `${titres[vue]} · Remboursements santé`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { apercu: vueApercu, soins: vueSoins, relances: vueRelances, bilan: vueBilan }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    const sel = $('#filtre-membre');
    if (sel) sel.addEventListener('change', (e) => { filtre.membre = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const piedVue = () => AVERTISSEMENT;

  // ---------- États d'un organisme ----------
  function pastilleOrg(s, k, t) {
    const e = R.etatOrg(s, k, t, E.reglages);
    const o = s[k];
    const nom = courtOrg(k);
    if (e.etat === 'aucun') return `<span class="etiquette sable" title="${esc(nomOrg(k))} : pas de prise en charge">${esc(nom)} · non pris en charge</span>`;
    if (e.etat === 'tiers') return `<span class="etiquette ciel" title="Tiers payant : payé directement au praticien">${esc(nom)} · tiers payant ${o.attendu ? euros(o.attendu) : ''}</span>`;
    if (e.etat === 'recu') return `<span class="etiquette bleu-clair">${esc(nom)} · reçu ${euros(e.montant)}${e.ecart ? ` <b>(${euros(e.ecart, { signe: true })})</b>` : ''}</span>`;
    if (e.etat === 'retard') return `<span class="etiquette rouge">${esc(nom)} · en retard${o.attendu !== null ? ` ${euros(o.attendu)}` : ''}</span>`;
    return `<span class="etiquette jaune">${esc(nom)} · attendu ${o.attendu === null ? 'à préciser' : euros(o.attendu)}</span>`;
  }

  // Phrase « en attente depuis … » d'un remboursement attendu.
  function texteAttente(a) {
    const base = a.soin[a.org].transmisLe ? `transmis le ${dateCourte(a.depuis)}` : `soin du ${dateCourte(a.depuis)}`;
    const rel = a.relance ? ` · relancé le ${dateCourte(a.relance)}` : '';
    return `${pluriel(a.jours, 'jour')} d'attente (${base})${rel}`;
  }

  function carteAttente(a) {
    const s = a.soin;
    const retard = a.etat === 'retard';
    return `<article class="decision ${retard ? 'niv-depasse' : ''}">
      <span class="etiquette ${retard ? 'rouge' : 'jaune'}">${esc(nomOrg(a.org))} · ${retard ? 'en retard' : 'en attente'}</span>
      <button class="decision-corps" data-action="ouvrir" data-id="${s.id}"><b>${esc(nomType(s.type))}</b><span class="decision-titre">${puceMembre(s.membre)} · soin du ${dateLongue(s.date)}</span><span>${texteAttente(a)}${retard ? '' : ` · à relancer à partir du ${dateCourte(ajout(a.echeance, 1))}`}</span></button>
      <div class="decision-pied"><span class="montant-mini">${a.attendu === null ? 'Montant attendu à préciser' : `${euros(a.attendu)} attendus`}</span><span class="rang-boutons">${retard ? `<button class="btn petit" data-action="relance" data-id="${s.id}" data-org="${a.org}">Relancer</button>` : ''}<button class="btn petit primaire" data-action="recu" data-id="${s.id}" data-org="${a.org}">Reçu</button></span></div>
    </article>`;
  }

  // Ligne compacte d'un remboursement en attente (pas encore en retard).
  function ligneAttente(a) {
    const s = a.soin;
    return `<li class="ligne-attente"><button class="lien-ligne" data-action="ouvrir" data-id="${s.id}"><b>${esc(nomType(s.type))} · ${esc(courtOrg(a.org))}</b><span>${esc(nomMembre(s.membre))}, soin du ${dateCourte(s.date)} · relance possible à partir du ${dateCourte(ajout(a.echeance, 1))}</span></button><span class="nb">${a.attendu === null ? 'à préciser' : euros(a.attendu)}</span><button class="btn petit" data-action="recu" data-id="${s.id}" data-org="${a.org}">Reçu</button></li>`;
  }

  // ---------- Aperçu ----------
  function vueApercu() {
    const t = auj();
    const an = t.slice(0, 4);
    const bonjour = E.prenom ? `Bonjour ${esc(E.prenom)}` : 'Aperçu';
    if (!E.soins.length) {
      return `<div class="vue-tete"><div><h1>${bonjour}</h1><p>Ton suivi est vide pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Note ton premier soin</h3><p>La personne, le type de soin, la date et ce que tu as payé suffisent. Ajoute ensuite ce que la Sécurité sociale et ta mutuelle doivent te rembourser : les retards apparaîtront seuls.</p><div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter un soin</button></div></div></div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>${piedVue()}`;
    }
    const tot = R.totaux(E.soins, an, TYPES);
    const att = R.attentes(E.soins, t, E.reglages);
    const retards = att.filter((a) => a.etat === 'retard');
    const attente = att.filter((a) => a.etat === 'attente');
    const total = (l) => l.reduce((s, a) => s + (a.attendu || 0), 0);
    const tuiles = [
      [`Payé en ${an}`, euros(tot.paye), `${pluriel(tot.nb, 'soin')} · ${euros(tot.avance)} avancés de ta poche`, 'var(--encre)', ''],
      ['Pris en charge', euros(tot.ss + tot.mut), `${R.partPriseEnCharge(tot)} % : Sécu ${euros(tot.ss, { centimes: false })}, mutuelle ${euros(tot.mut, { centimes: false })}`, 'var(--bleu)', 'rond'],
      ['En attente', euros(total(att)), `${pluriel(att.length, 'remboursement')}${retards.length ? `, dont ${retards.length} en retard` : ''}`, 'var(--jaune)', ''],
      ['Reste à charge', euros(tot.rac), `${euros(tot.racPrevu)} une fois tout remboursé`, 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const derniers = [...E.soins].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5);
    return `
      <div class="vue-tete"><div><h1>${bonjour}</h1><p>Ce que tu as payé cette année, ce qui t'a été rendu et ce qu'on te doit encore.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter un soin</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À relancer <span>Sans remboursement après ${pluriel(E.reglages.delaiSS, 'jour')} (Sécu) et ${pluriel(E.reglages.delaiMut, 'jour')} (mutuelle), réglables</span></h2>
          ${retards.length ? `<div class="decisions">${retards.map(carteAttente).join('')}</div>` : '<div class="vide-etat petit"><div><h3>Aucun retard</h3><p>Un remboursement attendu qui n\'arrive pas dans le délai choisi apparaît ici, avec son message de relance.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">En attente <span>${euros(total(attente))}</span></h2>
          ${attente.length ? `<ul class="lignes-attente">${attente.map(ligneAttente).join('')}</ul>` : '<p class="aide">Rien en attente dans les délais.</p>'}
        </section>
      </div>
      <h2 class="titre-section">Derniers soins <span><button class="btn lien" data-action="vue" data-vue="soins">Voir tous les soins</button></span></h2>
      <ul class="lignes-soins">${derniers.map((s) => ligneSoin(s, t)).join('')}</ul>
      ${piedVue()}`;
  }

  // ---------- Soins ----------
  function ligneSoin(s, t) {
    const e = R.etatSoin(s, t, E.reglages);
    const rac = R.resteACharge(s), racPrevu = R.resteAChargePrevu(s);
    return `<li class="ligne-abo ligne-soin ${e === 'retard' ? 'alerte-depasse' : e === 'attente' ? 'alerte-proche' : ''}">
      <button class="ligne-info" data-action="ouvrir" data-id="${s.id}">
        <b>${esc(nomType(s.type))}</b>
        <span class="ligne-detail">${puceMembre(s.membre)} · ${fmt(s.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${s.praticien ? ` · ${esc(s.praticien)}` : ''}</span>
        <span class="ligne-etiquettes">${pastilleOrg(s, 'ss', t)}${pastilleOrg(s, 'mut', t)}${R.incoherent(s) ? '<span class="etiquette rouge">Remboursements supérieurs au montant payé</span>' : ''}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${euros(s.montant)}</b><small>payé</small></span>
        <span class="ligne-proch">Reste à charge ${euros(rac)}${racPrevu !== rac ? ` <small>(${euros(racPrevu)} prévu)</small>` : ''}</span>
      </div>
    </li>`;
  }

  function vueSoins() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const etatDe = new Map(E.soins.map((s) => [s.id, R.etatSoin(s, t, E.reglages)]));
    const passeEtat = (s, f) => f === 'tous' || etatDe.get(s.id) === f || (f === 'attente' && etatDe.get(s.id) === 'retard');
    const garde = (s) => passeEtat(s, filtre.etat) && (!filtre.membre || s.membre === filtre.membre)
      && (!q || `${nomType(s.type)} ${TYPES[s.type]?.nomFamille || ''} ${s.praticien} ${s.reference} ${nomMembre(s.membre)}`.toLowerCase().includes(q));
    const liste = E.soins.filter(garde).sort((x, y) => y.date.localeCompare(x.date));
    const nb = (f) => E.soins.filter((s) => passeEtat(s, f) && (!filtre.membre || s.membre === filtre.membre)).length;
    const parMois = new Map();
    for (const s of liste) { const k = s.date.slice(0, 7); if (!parMois.has(k)) parMois.set(k, []); parMois.get(k).push(s); }
    const filtres = [['tous', 'Tous'], ['attente', 'En attente'], ['retard', 'En retard'], ['solde', 'Soldés']];
    return `
      <div class="vue-tete"><div><h1>Soins</h1><p>Touche un soin pour le modifier ou noter un remboursement reçu. Le reste à charge se calcule avec ce qui est déjà remboursé ; le montant « prévu » compte aussi ce qui est encore attendu.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter un soin</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par état">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-etat="${id}" aria-pressed="${filtre.etat === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ choix-membre"><span class="sr-only">Personne</span><select id="filtre-membre"><option value="">Tout le foyer</option>${E.membres.map((m) => `<option value="${m.id}" ${filtre.membre === m.id ? 'selected' : ''}>${esc(m.prenom)}</option>`).join('')}</select></label>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un soin" value="${esc(filtre.q)}"></label>
      </div>
      ${parMois.size ? [...parMois.entries()].map(([k, l]) => `<section class="groupe-cat"><h2 class="titre-cat">${nomMois(k)}<span>${pluriel(l.length, 'soin')} · ${euros(l.reduce((x, s) => x + s.montant, 0))} payés · reste à charge ${euros(l.reduce((x, s) => x + R.resteACharge(s), 0))}</span></h2><ul class="lignes-soins">${l.map((s) => ligneSoin(s, t)).join('')}</ul></section>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.soins.length ? 'Aucun soin ne correspond' : 'Aucun soin'}</h3><p>${E.soins.length ? 'Change le filtre, la personne ou la recherche.' : 'Ajoute ton premier soin : personne, type, date et montant payé.'}</p><div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Ajouter un soin</button></div></div></div>`}
      ${piedVue()}`;
  }

  // ---------- Relances ----------
  function vueRelances() {
    const t = auj();
    const att = R.attentes(E.soins, t, E.reglages);
    const retards = att.filter((a) => a.etat === 'retard');
    const relances = att.filter((a) => a.etat === 'attente' && a.nbRelances);
    const historique = E.soins.flatMap((s) => R.ORGANISMES.flatMap((k) => s[k].relances.map((d) => ({ d, s, k })))).sort((x, y) => y.d.localeCompare(x.d)).slice(0, 12);
    const carte = (a) => `<article class="relance ${a.etat === 'retard' ? 'retard' : ''}">
        <div class="relance-tete"><span class="etiquette ${a.etat === 'retard' ? 'rouge' : 'jaune'}">${esc(nomOrg(a.org))}</span><b>${esc(nomType(a.soin.type))}</b><span>${puceMembre(a.soin.membre)} · ${dateLongue(a.soin.date)} · ${euros(a.soin.montant)} payés</span></div>
        <p>${texteAttente(a)} · ${a.attendu === null ? 'Montant attendu à préciser.' : `${euros(a.attendu)} attendus.`}${a.etat === 'attente' ? ` Nouvelle relance possible à partir du ${dateLongue(ajout(a.echeance, 1))}.` : ''}</p>
        <div class="rang-boutons"><button class="btn petit ${a.etat === 'retard' ? 'primaire' : ''}" data-action="relance" data-id="${a.id}" data-org="${a.org}">Voir le message</button><button class="btn petit" data-action="recu" data-id="${a.id}" data-org="${a.org}">Reçu</button></div>
      </article>`;
    return `
      <div class="vue-tete"><div><h1>Relances</h1><p>Un remboursement attendu passe ici quand il n'est pas arrivé dans le délai que tu as choisi. Le message est prêt à copier : envoie-le depuis la messagerie de ton compte en ligne, par courrier ou au guichet. Rien n'est envoyé par l'outil.</p></div>
        <div class="actions"><button class="btn" data-action="reglages">Régler les délais</button></div></div>
      <h2 class="titre-section">À relancer maintenant <span>${pluriel(retards.length, 'remboursement')}</span></h2>
      ${retards.length ? `<div class="relances">${retards.map(carte).join('')}</div>` : `<div class="vide-etat petit"><div><h3>Rien à relancer</h3><p>Délais actuels : ${pluriel(E.reglages.delaiSS, 'jour')} pour la Sécurité sociale, ${pluriel(E.reglages.delaiMut, 'jour')} pour la mutuelle, ${pluriel(E.reglages.delaiRelance, 'jour')} après une relance.</p></div></div>`}
      ${relances.length ? `<h2 class="titre-section">Déjà relancés, en attente de réponse</h2><div class="relances">${relances.map(carte).join('')}</div>` : ''}
      <h2 class="titre-section">Relances notées</h2>
      ${historique.length ? `<ul class="liste-simple historique">${historique.map(({ d, s, k }) => `<li><span class="date-pastille"><b>${versDate(d).getDate()}</b>${fmt(d, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="ouvrir" data-id="${s.id}"><b>${esc(nomOrg(k))} · ${esc(nomType(s.type))}</b><span>${esc(nomMembre(s.membre))}, soin du ${dateCourte(s.date)}${s[k].recuLe ? ` · reçu le ${dateCourte(s[k].recuLe)}` : ' · toujours en attente'}</span></button></li>`).join('')}</ul>` : '<p class="aide">Aucune relance notée pour l\'instant. Après avoir envoyé un message, touche « J\'ai relancé aujourd\'hui » : le délai repart de cette date.</p>'}
      <p class="mention" style="margin-top:20px">Un remboursement plus faible que prévu peut venir d'une participation forfaitaire ou d'une franchise déduite, ou d'un dépassement non remboursé : vérifie le détail sur ton relevé avant de relancer.</p>
      ${piedVue()}`;
  }

  // ---------- Bilan ----------
  const COULEURS_PART = { ss: 'var(--bleu)', mut: 'var(--jaune)', rac: 'var(--rouge)' };
  function legende() {
    return `<ul class="legende" aria-hidden="true"><li><i class="part-ss"></i>Sécurité sociale</li><li><i class="part-mut"></i>${esc(nomOrg('mut'))}</li><li><i class="part-rac"></i>Reste à charge</li></ul>`;
  }
  // Barres empilées : Sécurité sociale, mutuelle, reste à charge ; longueur = montant payé (échelle commune).
  function barresEmpilees(lignes, libelle) {
    const max = Math.max(...lignes.map((l) => l.paye), 1);
    return lignes.map((l) => {
      const rac = Math.max(0, l.paye - l.ss - l.mut);
      const pc = (v) => (v / max) * 100;
      const info = `<b>${esc(libelle(l))}</b>Payé ${euros(l.paye)}<br>Sécurité sociale ${euros(l.ss)}<br>${esc(nomOrg('mut'))} ${euros(l.mut)}<br>Reste à charge ${euros(l.rac)}${l.attente ? `<br>En attente ${euros(l.attente)}` : ''}`;
      return `<div class="barre-cat barre-empilee" tabindex="0" data-info="${esc(info)}">
        <span class="bc-nom">${esc(libelle(l))}</span>
        <span class="bc-piste">${[['ss', l.ss], ['mut', l.mut], ['rac', rac]].filter(([, v]) => v > 0).map(([k, v]) => `<span class="seg part-${k}" style="width:${pc(v)}%"></span>`).join('')}</span>
        <span class="bc-val"><b>${euros(l.paye, { centimes: false })}</b><small>${R.partPriseEnCharge(l)} % pris en charge</small></span>
      </div>`;
    }).join('');
  }

  function vueBilan() {
    const t = auj();
    const ans = R.annees(E.soins, t);
    if (!ans.includes(anneeVue)) anneeVue = ans[0];
    const tot = R.totaux(E.soins, anneeVue, TYPES);
    const cotis = E.cotisations[anneeVue] || null;
    const bm = R.bilanMutuelle(tot, cotis);
    const tableau = (lignes, libelle, titre) => `<details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">${titre}</caption><thead><tr><th>${titre}</th><th class="nb">Soins</th><th class="nb">Payé</th><th class="nb">Sécu</th><th class="nb">Mutuelle</th><th class="nb">Reste à charge</th><th class="nb">En attente</th></tr></thead>
      <tbody>${lignes.map((l) => `<tr><td>${esc(libelle(l))}</td><td class="nb">${l.nb}</td><td class="nb">${euros(l.paye)}</td><td class="nb">${euros(l.ss)}</td><td class="nb">${euros(l.mut)}</td><td class="nb">${euros(l.rac)}</td><td class="nb">${euros(l.attente)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="nb">${tot.nb}</td><td class="nb">${euros(tot.paye)}</td><td class="nb">${euros(tot.ss)}</td><td class="nb">${euros(tot.mut)}</td><td class="nb">${euros(tot.rac)}</td><td class="nb">${euros(tot.attente)}</td></tr></tfoot></table></div></details>`;
    const libMembre = (l) => nomMembre(l.membre);
    const libFamille = (l) => famille(l.famille).nom;
    return `
      <div class="vue-tete"><div><h1>Bilan ${anneeVue}</h1><p>Totaux de l'année par personne et par type de soin, selon la date du soin. « Pris en charge » compte aussi le tiers payant ; les montants encore attendus sont à part.</p></div>
        <div class="actions"><button class="btn" data-action="csv">Exporter en CSV</button><button class="btn" data-action="imprimer">Imprimer</button></div></div>
      <div class="filtres annees" role="group" aria-label="Année">${ans.map((a) => `<button class="filtre" data-action="annee" data-annee="${a}" aria-pressed="${a === anneeVue}">${a}</button>`).join('')}</div>
      ${tot.nb ? `
      <div class="tuiles">
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Payé</p><b>${euros(tot.paye)}</b><span>${pluriel(tot.nb, 'soin')}</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Sécurité sociale</p><b>${euros(tot.ss)}</b><span>reçu ou payé en tiers payant</span></div>
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">${esc(nomOrg('mut'))}</p><b>${euros(tot.mut)}</b><span>reçu ou payé en tiers payant</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Reste à charge</p><b>${euros(tot.rac)}</b><span>${R.partPriseEnCharge(tot)} % pris en charge${tot.attente ? ` · ${euros(tot.attente)} encore attendus` : ''}</span></div>
      </div>
      <h2 class="titre-section">Par personne <span>Longueur : montant payé</span></h2>
      ${legende()}
      <figure class="graphique">${'<div class="barres-cats">' + barresEmpilees(tot.parMembre, libMembre) + '</div>'}<div class="infobulle" hidden></div></figure>
      ${tableau(tot.parMembre, libMembre, 'Personne')}
      <h2 class="titre-section">Par type de soin <span>Utile pour comparer les garanties de ta mutuelle</span></h2>
      ${legende()}
      <figure class="graphique">${'<div class="barres-cats">' + barresEmpilees(tot.parFamille, libFamille) + '</div>'}<div class="infobulle" hidden></div></figure>
      ${tableau(tot.parFamille, libFamille, 'Type de soin')}` : `<div class="vide-etat petit" style="margin-top:20px"><div><h3>Aucun soin en ${anneeVue}</h3><p>Les totaux apparaissent dès le premier soin noté pour cette année.</p></div></div>`}
      <h2 class="titre-section">${esc(nomOrg('mut'))} : ce qu'elle te coûte et te rend</h2>
      <div class="comparaison">
        ${bm ? `<p>En ${anneeVue}, tu as cotisé <b>${euros(bm.cotisation)}</b> et ta mutuelle a pris en charge <b>${euros(bm.rembourse)}</b> (tiers payant compris), soit <b>${bm.ratio} %</b> de tes cotisations. ${bm.solde < 0 ? `Écart : ${euros(-bm.solde)} de plus cotisés que remboursés.` : `Elle t'a rendu ${euros(bm.solde)} de plus que tes cotisations.`}</p>
          <p class="aide">Une mutuelle couvre aussi des risques qui ne se sont pas produits (hospitalisation…) : compare ce bilan avec les garanties de ton contrat, pas seulement avec ce chiffre.</p>`
        : `<p class="aide">Saisis le total de tes cotisations ${anneeVue} (repris de ton échéancier ou de tes relevés) pour les comparer aux remboursements de ta mutuelle.</p>`}
        <div class="rang-boutons"><button class="btn petit" data-action="cotisation">${bm ? 'Modifier les cotisations' : 'Saisir les cotisations'} ${anneeVue}</button></div>
      </div>
      ${piedVue()}`;
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

  const optionsTypes = (sel) => B.familles.map((f) => `<optgroup label="${esc(f.nom)}">${f.types.map(([id, nom]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(nom)}</option>`).join('')}</optgroup>`).join('');

  // Bloc d'un organisme dans le formulaire du soin.
  function blocOrganisme(k, o) {
    const p = `${k}-`;
    return `<fieldset class="champ cadre-champs bloc-org" data-org="${k}"><legend>${esc(nomOrg(k))} <small>${k === 'ss' ? 'Assurance Maladie.' : 'Ta complémentaire santé.'} Montant attendu : repris du décompte ou du devis, ou laissé vide.</small></legend>
      <div class="choix-statut">${B.modes.map((m) => `<label title="${esc(m.aide)}"><input type="radio" name="${p}mode" value="${m.id}" ${o.mode === m.id ? 'checked' : ''}><span>${esc(m.nom)}</span></label>`).join('')}</div>
      <div class="rang-champs" data-si="attendu tiers">
        <label class="champ"><span>Montant <span data-si="attendu">attendu</span><span data-si="tiers">payé en tiers payant</span></span><input name="${p}attendu" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(o.mode === 'aucun' ? null : o.attendu)}" placeholder="À préciser"></label>
        <label class="champ" data-si="attendu">Transmis le <small>Facultatif.</small><input type="date" name="${p}transmisLe" value="${o.transmisLe || ''}"></label>
      </div>
      <div class="rang-champs" data-si="attendu">
        <label class="champ">Reçu le <small>Vide tant que rien n'est arrivé.</small><input type="date" name="${p}recuLe" value="${o.recuLe || ''}"></label>
        <label class="champ">Montant reçu <small>Vide : le montant attendu.</small><input name="${p}recu" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(o.recuLe ? o.recu : null)}" placeholder="Comme attendu"></label>
      </div>
    </fieldset>`;
  }

  function lireOrganisme(f, k, ancien) {
    const p = `${k}-`;
    const mode = f.get(`${p}mode`) || 'attendu';
    const brut = String(f.get(`${p}attendu`) || '').trim();
    const attendu = brut ? R.lireMontant(brut) : null;
    if (brut && attendu === null) return `${nomOrg(k)} : montant illisible, écris par exemple 16,50.`;
    if (mode === 'tiers' && attendu === null) return `${nomOrg(k)} : indique le montant payé en tiers payant.`;
    const brutRecu = String(f.get(`${p}recu`) || '').trim();
    const recu = brutRecu ? R.lireMontant(brutRecu) : null;
    if (brutRecu && recu === null) return `${nomOrg(k)} : montant reçu illisible.`;
    const recuLe = f.get(`${p}recuLe`) || null;
    if (mode === 'attendu' && recuLe && recu === null && attendu === null) return `${nomOrg(k)} : indique le montant reçu.`;
    return R.normaliserOrganisme({ mode, attendu, transmisLe: f.get(`${p}transmisLe`) || null, recuLe, recu: recuLe ? (recu ?? attendu) : null, relances: ancien?.relances || [] });
  }

  function modaleSoin(id) {
    const t = auj();
    const s = id ? soin(id) : null;
    if (id && !s) return;
    const v = s || { membre: filtre.membre || E.membres[0]?.id, type: 'generaliste', date: t, praticien: '', reference: '', montant: null, ss: { mode: 'attendu', attendu: null }, mut: { mode: 'attendu', attendu: null } };
    const corps = `
      <fieldset class="champ"><legend>Pour qui</legend><div class="choix-membres">${E.membres.map((m) => `<label><input type="radio" name="membre" value="${m.id}" ${m.id === v.membre ? 'checked' : ''}><span><i class="point" style="background:${couleurMembre(m.id)}"></i>${esc(m.prenom)}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Type de soin<select name="type">${optionsTypes(v.type)}</select></label>
        <label class="champ">Date du soin<input type="date" name="date" value="${v.date}" required></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Montant payé<small>Total du soin, en euros.</small><input name="montant" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.montant)}" placeholder="0,00" required></label>
        <label class="champ">Praticien ou lieu <small>Facultatif. Pas de diagnostic.</small><input name="praticien" maxlength="60" value="${esc(v.praticien)}" placeholder="Ex. : cabinet de kiné"></label>
      </div>
      ${blocOrganisme('ss', v.ss)}
      ${blocOrganisme('mut', v.mut)}
      <label class="champ">Référence <small>Facultative : numéro de facture ou de décompte. Pas de diagnostic.</small><input name="reference" maxlength="40" value="${esc(v.reference)}"></label>
      <p class="resume-soin" id="resume-soin" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    const pied = s
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Modifier le soin' : 'Nouveau soin', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer ce soin (${nomType(s.type)} du ${dateLongue(s.date)}) ?`)) { modale().dataset.garder = '1'; return; }
        retenir();
        E.soins = E.soins.filter((x) => x.id !== s.id);
        sauver(); rendre(); toast('Soin supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const lu = lireSoin(f, s);
      if (typeof lu === 'string') return lu;
      retenir();
      if (s) Object.assign(s, lu); else E.soins.push(lu);
      sauver(); rendre();
      const att = R.ORGANISMES.filter((k) => R.enAttente(lu[k])).length;
      toast(s ? 'Soin enregistré.' : `${nomType(lu.type)} ajouté : ${euros(lu.montant)} payés${att ? `, ${pluriel(att, 'remboursement')} attendu${att > 1 ? 's' : ''}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majForm = () => {
      d.querySelectorAll('.bloc-org').forEach((b) => {
        const mode = b.querySelector('input[type=radio]:checked')?.value || 'attendu';
        b.querySelectorAll('[data-si]').forEach((el) => { el.hidden = !el.dataset.si.split(' ').includes(mode); });
      });
      const lu = lireSoin(new FormData(d.querySelector('form')), s);
      $('#resume-soin').textContent = typeof lu === 'string' ? '' : `Avancé de ta poche : ${euros(R.avance(lu))} · reste à charge ${euros(R.resteACharge(lu))}${R.resteAChargePrevu(lu) !== R.resteACharge(lu) ? ` (${euros(R.resteAChargePrevu(lu))} une fois les remboursements attendus reçus)` : ''}.${R.incoherent(lu) ? ' Attention : les remboursements dépassent le montant payé.' : ''}`;
    };
    d.querySelector('form').addEventListener('input', majForm);
    d.querySelector('form').addEventListener('change', majForm);
    majForm();
  }

  function lireSoin(f, ancien) {
    const montant = R.lireMontant(f.get('montant'));
    if (montant === null) return 'Indique le montant payé, par exemple 30 ou 16,50.';
    if (!f.get('date')) return 'Indique la date du soin.';
    const ss = lireOrganisme(f, 'ss', ancien?.ss);
    if (typeof ss === 'string') return ss;
    const mut = lireOrganisme(f, 'mut', ancien?.mut);
    if (typeof mut === 'string') return mut;
    return R.normaliserSoin({ id: ancien?.id || uid(), membre: f.get('membre') || E.membres[0]?.id, type: f.get('type'), date: f.get('date'), praticien: f.get('praticien'), reference: f.get('reference'), montant, ss, mut }, auj());
  }

  // Remboursement reçu : montant (le montant attendu par défaut) et date.
  function modaleRecu(id, org) {
    const s = soin(id);
    if (!s) return;
    const o = s[org];
    ouvrirModale(`Reçu de ${esc(nomOrg(org))}`, `
      <p>${esc(nomType(s.type))} · ${esc(nomMembre(s.membre))} · soin du ${dateLongue(s.date)} · ${euros(s.montant)} payés.</p>
      <div class="rang-champs">
        <label class="champ">Montant reçu<small>${o.attendu === null ? 'Repris de ton relevé.' : `${euros(o.attendu)} attendus.`}</small><input name="recu" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(o.attendu)}" placeholder="0,00"></label>
        <label class="champ">Reçu le<input type="date" name="recuLe" value="${auj()}" required></label>
      </div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Confirmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const recu = R.lireMontant(f.get('recu'));
      if (recu === null) return 'Indique le montant reçu, par exemple 16,50.';
      if (!f.get('recuLe')) return 'Choisis la date.';
      retenir();
      o.recu = recu; o.recuLe = f.get('recuLe');
      if (o.attendu === null) o.attendu = recu;
      sauver(); rendre();
      const ecartMontant = recu - (o.attendu ?? recu);
      toast(`${euros(recu)} reçus de ${nomOrg(org)}${ecartMontant ? ` (${euros(ecartMontant, { signe: true })} par rapport à l'attendu)` : ''}. Reste à charge : ${euros(R.resteACharge(s))}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Message de relance rempli, à copier ; « J'ai relancé aujourd'hui » note la date.
  function texteRelance(s, org) {
    const o = s[org];
    return R.remplir(B.relances[org], {
      organisme: E.reglages.nomMutuelle || 'ma mutuelle',
      soin: nomType(s.type).toLowerCase(),
      date: dateLongue(s.date),
      personne: nomMembre(s.membre),
      montant: euros(s.montant),
      attendu: o.attendu === null ? 'à préciser' : euros(o.attendu),
      transmis: o.transmisLe ? `- transmis le ${dateLongue(o.transmisLe)}\n` : '',
      reference: s.reference ? `- référence : ${s.reference}\n` : '',
      prenom: E.prenom || nomMembre(E.membres[0]?.id),
    });
  }

  function modaleRelance(id, org) {
    const s = soin(id);
    if (!s) return;
    const o = s[org];
    ouvrirModale(`Relance · ${esc(nomOrg(org))}`, `
      <p class="aide">Copie ce message et envoie-le depuis la messagerie de ton compte en ligne, par courrier ou au guichet. Complète la dernière ligne au moment d'envoyer : l'outil n'enregistre aucun numéro. Rien n'est envoyé.</p>
      <label class="champ"><span class="sr-only">Message de relance</span><textarea id="recap" rows="15" readonly>${esc(texteRelance(s, org))}</textarea></label>
      ${o.relances.length ? `<p class="aide">Déjà relancé : ${o.relances.map(dateCourte).join(', ')}.</p>` : ''}`,
    '<button class="btn primaire" value="ok">J\'ai relancé aujourd\'hui</button><button class="btn" type="button" data-action="copier">Copier</button><button class="btn" value="annuler">Fermer</button>', () => {
      retenir();
      const t = auj();
      if (!o.relances.includes(t)) o.relances.push(t);
      sauver(); rendre();
      toast(`Relance notée : nouvelle alerte dans ${pluriel(E.reglages.delaiRelance, 'jour')} sans remboursement.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  async function copierTexte() {
    const zone = $('#recap');
    if (!zone) return;
    try { await navigator.clipboard.writeText(zone.value); toast('Message copié.'); } catch { zone.select(); toast('Sélectionné : copie-le avec Ctrl+C (ou un appui long).'); }
  }

  function modaleCotisation() {
    const c = E.cotisations[anneeVue] || null;
    ouvrirModale(`Cotisations ${anneeVue}`, `
      <label class="champ">Total des cotisations de l'année<small>Ta part, reprise de ton échéancier ou de tes relevés (par exemple 12 × la mensualité). Vide pour retirer.</small><input name="cotisation" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(c)}" placeholder="0,00"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const brut = String(f.get('cotisation') || '').trim();
      const v = brut ? R.lireMontant(brut) : null;
      if (brut && !v) return 'Montant illisible : écris par exemple 1 020.';
      retenir();
      if (v) E.cotisations[anneeVue] = v; else delete E.cotisations[anneeVue];
      sauver(); rendre(); toast('Cotisations enregistrées.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Membres du foyer : renommer, ajouter, retirer (seulement sans soin).
  function modaleMembres() {
    const nbSoins = (id) => E.soins.filter((s) => s.membre === id).length;
    ouvrirModale('Membres du foyer', `
      <p class="aide">Un prénom ou un surnom suffit. Un membre qui a des soins ne peut pas être retiré : déplace ou supprime d'abord ses soins.</p>
      <ul class="liste-membres">${E.membres.map((m) => `<li><i class="point" style="background:${couleurMembre(m.id)}"></i><input name="m-${m.id}" maxlength="30" value="${esc(m.prenom)}" aria-label="Prénom"><small>${pluriel(nbSoins(m.id), 'soin')}</small>${E.membres.length > 1 && !nbSoins(m.id) ? `<button class="btn petit" type="button" data-action="membre-suppr" data-id="${m.id}">Retirer</button>` : ''}</li>`).join('')}</ul>
      ${E.membres.length < 12 ? '<label class="champ">Ajouter une personne<input name="nouveau" maxlength="30" placeholder="Prénom"></label>' : ''}
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      retenir();
      for (const m of E.membres) { const p = String(f.get(`m-${m.id}`) || '').trim().slice(0, 30); if (p) m.prenom = p; }
      const n = String(f.get('nouveau') || '').trim().slice(0, 30);
      if (n) E.membres.push({ id: uid(), prenom: n });
      sauver(); rendre(); toast('Foyer enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }
  function retirerMembre(id) {
    if (E.soins.some((s) => s.membre === id) || E.membres.length < 2) return;
    retenir();
    E.membres = E.membres.filter((m) => m.id !== id);
    if (filtre.membre === id) filtre.membre = '';
    sauver(); modaleMembres(); rendre();
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="rang-champs">
        <label class="champ">Ton prénom<small>Signe tes relances.</small><input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
        <label class="champ">Nom de ta mutuelle<small>Facultatif, repris dans les relances.</small><input name="nomMutuelle" maxlength="40" value="${esc(E.reglages.nomMutuelle)}" placeholder="Mutuelle"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Délais avant relance <small>Valeurs de départ choisies pour l'outil (30, 30 et 15 jours), sans valeur officielle : règle-les selon ton expérience.</small></legend>
        <div class="rang-champs">
          <label class="champ">Sécurité sociale (jours)<input type="number" name="delaiSS" min="1" max="180" step="1" value="${E.reglages.delaiSS}"></label>
          <label class="champ">Mutuelle (jours)<input type="number" name="delaiMut" min="1" max="180" step="1" value="${E.reglages.delaiMut}"></label>
          <label class="champ">Après une relance (jours)<input type="number" name="delaiRelance" min="1" max="180" step="1" value="${E.reglages.delaiRelance}"></label>
        </div></fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe premier"><h3>Foyer</h3><p class="aide">${E.membres.map((m) => esc(m.prenom)).join(', ')}.</p><div class="rang"><button class="btn petit" type="button" data-action="membres">Gérer les membres</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tableur (CSV, tous les soins), impression du bilan, ou copie complète (JSON).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button><button class="btn petit" type="button" data-action="imprimer">Imprimer le bilan</button><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Tes données</h3>${session.demo ? '<p class="aide">En démo, les données sont fictives et restent dans ce navigateur.</p>' : TEXTE_DONNEES}
        ${E.consentement && !session.demo ? `<p class="aide">Accord donné le ${new Date(E.consentement.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>` : ''}
        <div class="rang"><button class="btn petit danger" type="button" data-action="effacer-tout">Effacer toutes mes données</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${AVERTISSEMENT_TEXTE} Base intégrée : ${B.familles.length} familles et ${Object.keys(TYPES).length} types de soins, sans tarif ni taux (version ${B.version}). Aucune connexion à un compte de l'Assurance Maladie ou d'une mutuelle.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k) => Math.round(Number(f.get(k)));
      for (const k of ['delaiSS', 'delaiMut', 'delaiRelance']) if (!(n(k) >= 1 && n(k) <= 180)) return 'Chaque délai doit être entre 1 et 180 jours.';
      E.prenom = String(f.get('prenom') || '').trim().slice(0, 40);
      E.reglages.nomMutuelle = String(f.get('nomMutuelle') || '').trim().slice(0, 40);
      E.reglages.delaiSS = n('delaiSS'); E.reglages.delaiMut = n('delaiMut'); E.reglages.delaiRelance = n('delaiRelance');
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.soins) || !Array.isArray(d.membres)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.soins.length, 'soin')}) ?`)) return;
        const consentement = E.consentement;
        E = normaliser(d); delete E.majLe;
        E.consentement = consentement;
        if (!E.membres.length) E.membres = [{ id: uid(), prenom: E.prenom || 'Moi' }];
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `remboursements-sante-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E.soins, nomMembre, TYPES, auj(), E.reglages), 'text/csv;charset=utf-8', `remboursements-sante-${auj()}.csv`);

  // Efface tout : la version en ligne est remplacée par un espace vide (sans consentement), puis l'appareil est vidé.
  async function effacerTout() {
    if (session.demo) {
      if (!confirm('Effacer les données de démo de ce navigateur ?')) return;
      stock.suppr(CLE_DEMO); stock.suppr(CLE_CODE);
      modale().close();
      deconnecter('Données de démo effacées.');
      return;
    }
    if (!confirm('Effacer toutes tes données (foyer, soins, remboursements, relances), en ligne et sur cet appareil ? C\'est définitif. Exporte une copie avant si tu veux la garder.')) return;
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

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const blocs = [
      ['rose', 'Note chaque soin', `La personne du foyer, le type de soin, la date et ce que tu as payé. Puis, pour la Sécurité sociale et pour la mutuelle&nbsp;: un remboursement <b>attendu</b>, le <b>tiers payant</b> ou <b>pas de prise en charge</b>. Aucun taux n'est calculé&nbsp;: le montant attendu vient de ton décompte, d'un devis ou de ton estimation.`],
      ['beurre', 'Note ce que tu reçois', `Quand un remboursement arrive, note son montant et sa date&nbsp;: l'écart avec l'attendu s'affiche. Le reste à charge, c'est ce que tu as payé moins ce qui est déjà remboursé (tiers payant compris)&nbsp;; le reste à charge <b>prévu</b> compte aussi ce qui est encore attendu.`],
      ['ciel', 'Les retards sont repérés', `Un remboursement attendu qui n'arrive pas ${r.delaiSS}&nbsp;jours après la transmission (ou la date du soin) pour la Sécurité sociale, ${r.delaiMut}&nbsp;jours pour la mutuelle, passe dans <b>Relances</b>, avec un message prêt à copier. Une fois la relance notée, une nouvelle alerte arrive ${r.delaiRelance}&nbsp;jours après. L'outil n'envoie rien.`],
      ['sable', 'Le bilan de l\'année', `L'onglet <b>Bilan</b> totalise l'année par personne et par type de soin, selon la date du soin. Saisis tes cotisations de mutuelle pour les comparer à ce qu'elle t'a remboursé.`],
    ];
    const corps = `
      <p>Le suivi te montre ce que tu as avancé, ce qui t'a été rendu et ce qu'on te doit encore, et repère les remboursements en retard. Ton rôle&nbsp;: noter chaque soin, puis chaque remboursement reçu.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">L'<b>Aperçu</b> résume l'année et ce qui est à relancer. Les délais se règlent dans les réglages. Aucun diagnostic ni numéro de sécurité sociale n'est demandé. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne, dans l\'Union européenne, avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.soins.length;
    const pied = premier
      ? '<button class="btn primaire" value="soin">Ajouter mon premier soin</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'soin') setTimeout(() => modaleSoin(null), 0); });
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
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications. Pratique pour noter un soin en sortant de chez le médecin.</p>
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
    const { action, id, org } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-retour': ecranConsentement(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'membres': modaleMembres(); break;
      case 'membre-suppr': retirerMembre(id); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'effacer-tout': effacerTout(); break;
      case 'imprimer': if (modale().open) modale().close(); if (vue !== 'bilan') changerVue('bilan'); setTimeout(() => window.print(), 50); break;
      case 'copier': copierTexte(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau': modaleSoin(null); break;
      case 'ouvrir': modaleSoin(id); break;
      case 'recu': modaleRecu(id, org); break;
      case 'relance': modaleRelance(id, org); break;
      case 'cotisation': modaleCotisation(); break;
      case 'annee': anneeVue = el.dataset.annee; rendre(); break;
      case 'filtre': filtre.etat = el.dataset.etat; rendre(); break;
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
      if (c && c.code === code && c.etat?.consentement && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__remboursements = { etat: () => E, regles: R };
  init();
})();
