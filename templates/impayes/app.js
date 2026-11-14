// Relance des impayés QME : échéancier, retard en jours, pénalités légales, relances par palier.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi : les messages se copient.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RCV;
  const API = '/api/templates';
  const PRODUIT = 'RCV';
  const CLE_CODE = 'qme-rcv-code';
  const CLE_CACHE = 'qme-rcv-cache';
  const CLE_DEMO = 'qme-rcv-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rcv-ecran-accueil';
  const DEFAUTS = { reglages: B.reglages, paliers: B.paliers };

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
  const { ajout, versDate, euros, pct } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const jours = (n) => pluriel(n, 'jour');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { statut: 'ouvertes', q: '' };
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, auj(), DEFAUTS);
  const facture = (id) => E.factures.find((f) => f.id === id);
  const client = (id) => E.clients.find((c) => c.id === id);
  const nomClient = (id) => client(id)?.nom || 'Client inconnu';
  const typeClient = (id) => client(id)?.type || 'pro';
  const palier = (id) => E.paliers.find((p) => p.id === id);

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
        toast('Un autre appareil a modifié tes factures entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (RCV-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Petite entreprise fictive : 7 clients (dont un sans facture), 12 factures à des dates relatives à
  // aujourd'hui couvrant tous les états : à échoir, échue sans relance, relance due, paiement partiel,
  // particulier mis en demeure, fin de parcours à plus de 90 jours, litige, abandonnée, payée en retard
  // (pénalités et indemnité), payée à temps, petit et gros montants.
  function donneesDemo() {
    const e = etatVide();
    e.entreprise = 'Atelier Exemple';
    e.signature = 'Camille Martin\nAtelier Exemple (entreprise fictive)';
    const t = auj();
    const j = (n) => ajout(t, n);
    const cl = (nom, type, contact = '', note = '') => { const c = R.normaliserClient({ id: uid(), nom, type, contact, note }); e.clients.push(c); return c.id; };
    const square = cl('Boulangerie du Square', 'pro', 'compta@boulangerie-square.exemple', 'Paie souvent avec quelques jours de retard.');
    const horizon = cl('Agence Horizon Conseil', 'pro', 'factures@horizon.exemple');
    const batir = cl('SARL Bâtir Ensemble', 'pro', 'Service comptable, 01 00 00 00 00');
    const julien = cl('Julien Exemple', 'particulier', 'julien@exemple.test');
    const lumiere = cl('Cabinet Lumière Architectes', 'pro');
    const sophie = cl('Sophie Exemple', 'particulier');
    cl('Studio Nord Design', 'pro', '', 'Nouveau client, première facture le mois prochain.');
    const rel = (date, id, canal = 'E-mail', note = '') => { const p = e.paliers.find((x) => x.id === id); return { id: uid(), date, palier: id, nom: p.nom, md: p.md, canal, note }; };
    const fa = (clientId, numero, emission, echeance, montant, extra = {}) => e.factures.push(R.normaliserFacture({ id: uid(), client: clientId, numero, emission, echeance, montant, ...extra }, t));
    fa(square, 'F-2026-051', j(-10), j(20), 45000);
    fa(horizon, 'F-2026-047', j(-35), j(-5), 240000);
    fa(batir, 'F-2026-028', j(-80), j(-50), 1845000, {
      paiements: [{ id: uid(), date: j(-20), montant: 600000, note: 'Virement partiel, solde promis fin de mois.' }],
      relances: [rel(j(-46), 'rappel'), rel(j(-34), 'ferme', 'E-mail', 'Réponse : attend le paiement de son propre client.')],
    });
    fa(julien, 'F-2026-031', j(-100), j(-70), 68000, {
      relances: [rel(j(-66), 'rappel'), rel(j(-54), 'ferme', 'Téléphone'), rel(j(-38), 'demeure', 'Recommandé avec AR')],
    });
    fa(lumiere, 'F-2026-012', j(-150), j(-120), 320000, {
      relances: [rel(j(-116), 'rappel'), rel(j(-104), 'ferme'), rel(j(-90), 'demeure', 'Recommandé avec AR'), rel(j(-75), 'dernier', 'Recommandé avec AR')],
      note: 'Dossier à transmettre pour injonction de payer.',
    });
    fa(horizon, 'F-2026-019', j(-125), j(-95), 125000, { litige: true, relances: [rel(j(-91), 'rappel')], note: 'Conteste une partie des prestations : réunion prévue.' });
    fa(square, 'F-2026-003', j(-230), j(-200), 3500, { abandonnee: true, note: 'Petit montant, abandonné après deux relances.' });
    fa(batir, 'F-2026-034', j(-90), j(-60), 560000, { paiements: [{ id: uid(), date: j(-40), montant: 560000 }], relances: [rel(j(-56), 'rappel'), rel(j(-45), 'ferme')] });
    fa(lumiere, 'F-2026-043', j(-55), j(-25), 96000, { paiements: [{ id: uid(), date: j(-26), montant: 96000 }] });
    fa(sophie, 'F-2026-052', j(-31), j(-1), 24000);
    fa(horizon, 'F-2026-055', t, j(30), 180000);
    fa(square, 'F-2026-045', j(-42), j(-12), 32000, { relances: [rel(j(-9), 'rappel')] });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Relance des impayés · QME';
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
          <p class="surtitre">Relance des impayés</p>
          <h1>Chaque facture payée à temps.</h1>
          <p>Tes factures en retard au même endroit : le retard en jours, les pénalités calculées, et le bon message de relance prêt à copier au bon moment.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi des relances</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes factures sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes relances</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes relances'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, entreprise: '', signature: '', delai: 30, jours: B.paliers.map((p) => p.jours) };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On met tes relances en ordre.</h1>
        <p class="intro">Tu saisis tes factures (client, montant, échéance) et les paiements reçus : le retard, les pénalités et la prochaine relance se calculent. Les messages sont prêts à copier, rien n'est envoyé à ta place.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ton entreprise <small>Facultatif, repris dans les messages.</small><input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80"></label>
          <label class="champ">Ta signature <small>Ex. : prénom, nom, téléphone.</small><input id="signature" value="${esc(a.signature)}" maxlength="300"></label>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes paliers de relance</h1>
        <p class="intro">Quatre paliers, chacun avec son modèle de message. Ajuste le nombre de jours après l'échéance ; tu pourras renommer les paliers et réécrire les messages ensuite.</p>
        <label class="champ" style="max-width:320px;margin-top:16px">Délai de paiement habituel <small>Jours entre l'émission et l'échéance, proposé à la saisie.</small><input id="delai" type="number" min="0" max="120" value="${a.delai}"></label>
        <ol class="paliers-accueil">${B.paliers.map((p, i) => `<li><span class="palier-num">${i + 1}</span><b>${esc(p.nom)}</b><label class="champ">Jours après l'échéance<input type="number" min="0" max="365" data-palier="${i}" value="${a.jours[i]}"></label>${p.md ? '<span class="etiquette rose">Vaut mise en demeure</span>' : ''}</li>`).join('')}</ol>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    $('#signature')?.addEventListener('input', (e) => { accueil.signature = e.target.value; });
    $('#delai')?.addEventListener('input', (e) => { accueil.delai = e.target.value; });
    document.querySelectorAll('[data-palier]').forEach((el) => el.addEventListener('input', () => { accueil.jours[Number(el.dataset.palier)] = el.value; }));
  }

  function terminerAccueil() {
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.signature = accueil.signature.trim();
    E.reglages.delaiPaiement = Math.min(120, Math.max(0, Math.round(Number(accueil.delai)) || 30));
    E.paliers.forEach((p, i) => { const n = Math.round(Number(accueil.jours[i])); if (Number.isFinite(n)) p.jours = Math.min(365, Math.max(0, n)); });
    accueil = { etape: 1, entreprise: '', signature: '', delai: 30, jours: B.paliers.map((p) => p.jours) };
    vue = 'tableau';
    sauver();
    demarrer();
    toast('Ton suivi est prêt. Ajoute ta première facture impayée.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    factures: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    relances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    clients: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['factures', 'Factures'], ['relances', 'Relances'], ['clients', 'Clients']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide au suivi de tes factures : ce n\'est pas un conseil juridique ni un logiciel de comptabilité. Pénalités et indemnités sont des estimations à partir de ta saisie et des taux des Réglages ; tes conditions générales, tes factures et les textes en vigueur font foi.</p>';
  const COULEUR_STATUT = { aEchoir: 'ciel', echue: 'jaune', enRelance: 'rose', payee: 'vert', litige: 'rouge', abandonnee: 'sable' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${R.LIB_STATUT[s]}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/impayes/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Relance des<br>impayés</span>
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
    document.title = `${titres[vue]} · Relance des impayés`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, factures: vueFactures, relances: vueRelances, clients: vueClients }[vue]();
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

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const synth = () => R.synthese(E.factures, E.clients, E.reglages, E.paliers, auj());
  const alerteTaux = (s) => (s.aVerifier ? `<p class="aide alerte-taux">Un taux de référence manque pour une partie de la période (nouveau semestre ou facture ancienne) : le calcul reprend le taux le plus proche. <button class="btn lien" data-action="reglages">Mettre à jour les taux</button></p>` : '');

  // Carte d'une relance à faire ou à venir.
  function carteRelance(x, t) {
    const f = facture(x.facture);
    const retard = R.retardJours(f, t);
    return `<article class="relance-carte ${x.due ? 'due' : ''}">
      <span class="etiquette ${x.due ? (x.palier.md ? 'rouge' : 'jaune') : 'ciel'}">${esc(x.palier.nom)}</span>
      <button class="decision-corps" data-action="ouvrir" data-id="${f.id}"><b>${esc(nomClient(f.client))}</b><span class="decision-titre">${esc(f.numero)} · ${euros(R.restant(f, t))} restant dû</span><span>${retard ? `${jours(retard)} de retard` : `Échéance le ${dateLongue(f.echeance)}`} · ${x.due ? (x.joursDepuis ? `prévue depuis le ${dateCourte(x.date)}` : 'prévue aujourd\'hui') : `prévue le ${dateLongue(x.date)}`}</span></button>
      <div class="decision-pied"><span class="montant-mini">${typeClient(f.client) === 'pro' ? 'Professionnel' : 'Particulier'}</span><button class="btn petit ${x.due ? 'primaire' : ''}" data-action="preparer" data-id="${f.id}">Préparer le message</button></div>
    </article>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const s = synth();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}Ce qui t'est dû, depuis combien de temps, et les relances à faire aujourd'hui.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Ajouter une facture</button></div></div>`;
    if (!E.factures.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune facture suivie pour l'instant</h3><p>Ajoute les factures en attente de paiement : client, numéro, montant TTC et échéance. Le retard, les pénalités et la prochaine relance se calculent.</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Ajouter une facture</button></div></div></div>${AVERTISSEMENT}`;
    }
    const tuiles = [
      ['Encours', euros(s.encours, { centimes: false }), `${pluriel(s.nbOuvertes, 'facture ouverte', 'factures ouvertes')} · ${euros(s.aEchoir, { centimes: false })} à échoir`, 'var(--bleu)', ''],
      ['Échu', euros(s.echu, { centimes: false }), `${pluriel(s.nbEchues, 'facture en retard', 'factures en retard')}${s.litige ? ` · dont ${euros(s.litige, { centimes: false })} en litige` : ''}`, 'var(--rouge)', 'rond'],
      ['Relances à faire', String(s.relancesDues.length), s.aVenir.length ? `${pluriel(s.aVenir.filter((x) => R.ecart(t, x.date) <= 7).length, 'autre')} dans les 7 jours` : 'aucune autre prévue', 'var(--jaune)', ''],
      ['Pénalités et indemnités', euros(s.penalites + s.indemnites, { centimes: false }), `estimées à ce jour : ${euros(s.penalites, { centimes: false })} + ${euros(s.indemnites, { centimes: false })} forfaitaires`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const clientsRetard = s.parClient.filter((c) => c.echu > 0).slice(0, 6);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${alerteTaux(s)}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Relances à faire <span>Selon tes paliers (réglables dans Relances)</span></h2>
          ${s.relancesDues.length ? `<div class="decisions">${s.relancesDues.slice(0, 5).map((x) => carteRelance(x, t)).join('')}</div>${s.relancesDues.length > 5 ? `<button class="btn lien" data-action="vue" data-vue="relances">Voir les ${s.relancesDues.length} relances à faire</button>` : ''}` : `<div class="vide-etat petit"><div><h3>Aucune relance à faire aujourd'hui</h3><p>${s.aVenir.length ? `Prochaine : ${esc(nomClient(facture(s.aVenir[0].facture).client))}, ${esc(s.aVenir[0].palier.nom.toLowerCase())} le ${dateLongue(s.aVenir[0].date)}.` : 'Les relances apparaissent ici le jour prévu par tes paliers.'}</p></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Ancienneté de l'échu <span>Restant dû par retard</span></h2>
          ${graphiqueTranches(s)}
        </section>
      </div>
      <h2 class="titre-section">Clients en retard <span>Échu par client</span></h2>
      ${clientsRetard.length ? `<ul class="prochains">${clientsRetard.map((c) => `<li><span class="date-pastille retard"><b>${c.retardMax}</b>j</span><button class="lien-ligne" data-action="client" data-id="${c.client}"><b>${esc(nomClient(c.client))}</b><span>${pluriel(c.nb, 'facture ouverte', 'factures ouvertes')} · retard maximal ${jours(c.retardMax)}</span></button><span class="nb">${euros(c.echu)}</span></li>`).join('')}</ul>` : '<p class="aide">Aucun client en retard : tout ce qui est ouvert est à échoir.</p>'}
      ${AVERTISSEMENT}`;
  }

  // Échu par tranche d'ancienneté : barres horizontales, une seule série (bleu), valeur au bout, tableau.
  function graphiqueTranches(s) {
    const max = Math.max(...s.tranches.map((x) => x.montant), 1);
    if (!s.echu) return '<div class="vide-etat petit"><div><h3>Rien d\'échu</h3><p>Les factures en retard se rangent ici par ancienneté : 0 à 30, 31 à 60, 61 à 90 et plus de 90 jours.</p></div></div>';
    const barres = s.tranches.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${x.nom} de retard</b>${euros(x.montant)} restant dû<br>${pluriel(x.nb, 'facture')} · ${Math.round((x.montant / s.echu) * 100)} % de l'échu`)}">
        <span class="bc-nom">${x.nom}</span>
        <span class="bc-piste"><span class="bc-barre" style="width:${x.montant ? Math.max(0.5, (x.montant / max) * 100) : 0}%"></span></span>
        <span class="bc-val"><b>${euros(x.montant, { centimes: false })}</b><small>${pluriel(x.nb, 'facture')}</small></span>
      </div>`).join('');
    return `<figure class="graphique">
        <div class="barres-cats">${barres}</div>
        <div class="infobulle" hidden></div>
      </figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">Échu par ancienneté</caption><thead><tr><th>Retard</th><th class="nb">Factures</th><th class="nb">Restant dû</th></tr></thead>
        <tbody>${s.tranches.map((x) => `<tr><td>${x.nom}</td><td class="nb">${x.nb}</td><td class="nb">${euros(x.montant)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total échu</td><td class="nb">${s.nbEchues}</td><td class="nb">${euros(s.echu)}</td></tr></tfoot></table></div></details>`;
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

  // ---------- Factures ----------
  const FILTRES = [['ouvertes', 'Ouvertes'], ['retard', 'En retard'], ['aEchoir', 'À échoir'], ['litige', 'Litige'], ['payee', 'Payées'], ['abandonnee', 'Abandonnées'], ['toutes', 'Toutes']];
  function garderFiltre(s, f) {
    if (f === 'toutes') return true;
    if (f === 'ouvertes') return R.estOuverte(s);
    if (f === 'retard') return s === 'echue' || s === 'enRelance';
    return s === f;
  }

  function ligneFacture(f, t) {
    const s = R.statut(f, t);
    const type = typeClient(f.client);
    const retard = R.retardJours(f, t);
    const pen = R.penalites(f, type, E.reglages, t);
    const ind = R.indemnite(f, type, E.reglages, t);
    const pr = R.prochaineRelance(f, E.paliers, t, E.reglages.ecartMin);
    const du = R.restant(f, t);
    const tags = [etiquetteStatut(s)];
    if (R.estOuverte(s) && retard) tags.push(`<span class="etiquette ${retard > 90 ? 'rouge' : retard > 30 ? 'rose' : 'jaune'}">${jours(retard)} de retard</span>`);
    if (pr && R.estOuverte(s)) tags.push(`<span class="etiquette ${pr.due ? 'beurre-fort' : 'sable'}">${pr.due ? 'À relancer' : 'Relance'} · ${esc(pr.palier.nom)}${pr.due ? '' : ` le ${dateCourte(pr.date)}`}</span>`);
    if (s === 'payee' && retard) tags.push(`<span class="etiquette sable">Payée avec ${jours(retard)} de retard</span>`);
    if (R.paye(f, t) && du) tags.push('<span class="etiquette ciel">Paiement partiel</span>');
    return `<li class="ligne-fac st-${s} ${pr?.due ? 'alerte-due' : ''}">
      <button class="ligne-info" data-action="ouvrir" data-id="${f.id}">
        <b>${esc(nomClient(f.client))} <span class="numero">${esc(f.numero)}</span></b>
        <span class="ligne-detail">Émise le ${dateCourte(f.emission)} · échéance le ${fmt(f.echeance)} · ${type === 'pro' ? 'professionnel' : 'particulier'}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${euros(s === 'payee' ? f.montant : du)}</b><small>${s === 'payee' ? 'payés' : du === f.montant ? 'restant dû' : `restant sur ${euros(f.montant)}`}</small></span>
        <span class="ligne-proch">${pen.montant || ind ? `Pénalités ${euros(pen.montant + ind)}` : ''}</span>
      </div>
    </li>`;
  }

  function vueFactures() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const liste = E.factures.filter((f) => garderFiltre(R.statut(f, t), filtre.statut) && (!q || `${nomClient(f.client)} ${f.numero} ${f.note}`.toLowerCase().includes(q)))
      .sort((x, y) => R.retardJours(y, t) - R.retardJours(x, t) || x.echeance.localeCompare(y.echeance));
    const nb = (id) => E.factures.filter((f) => garderFiltre(R.statut(f, t), id)).length;
    const total = liste.reduce((s, f) => s + R.restant(f, t), 0);
    return `
      <div class="vue-tete"><div><h1>Factures</h1><p>Clique sur une facture pour noter un paiement, voir le détail des pénalités ou préparer une relance. Montants TTC.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Ajouter</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${FILTRES.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Client, numéro, note" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<p class="resume-liste">${pluriel(liste.length, 'facture')} · ${euros(total)} restant dû</p><ul class="lignes-fac">${liste.map((f) => ligneFacture(f, t)).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.factures.length ? 'Aucune facture ne correspond' : 'Aucune facture'}</h3><p>${E.factures.length ? 'Change le filtre ou la recherche.' : 'Ajoute une facture en attente de paiement.'}</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Ajouter une facture</button></div></div></div>`}`;
  }

  // ---------- Relances ----------
  function vueRelances() {
    const t = auj();
    const s = synth();
    const aVenir = s.aVenir.filter((x) => R.ecart(t, x.date) <= 14);
    const journal = E.factures.flatMap((f) => f.relances.map((r) => ({ ...r, f }))).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 15);
    const paliers = R.paliersTries(E.paliers);
    return `
      <div class="vue-tete"><div><h1>Relances</h1><p>Chaque facture en retard suit tes paliers. Prépare le message, copie-le dans ta messagerie, puis note-le comme envoyé : il entre au journal.</p></div></div>
      <h2 class="titre-section">À faire <span>${pluriel(s.relancesDues.length, 'relance')}</span></h2>
      ${s.relancesDues.length ? `<div class="grille-relances">${s.relancesDues.map((x) => carteRelance(x, t)).join('')}</div>` : '<div class="vide-etat petit"><div><h3>Rien à faire aujourd\'hui</h3><p>Les relances arrivent ici le jour prévu par leur palier.</p></div></div>'}
      <h2 class="titre-section">Dans les 14 jours</h2>
      ${aVenir.length ? `<div class="grille-relances">${aVenir.map((x) => carteRelance(x, t)).join('')}</div>` : '<p class="aide">Aucune relance prévue dans les 14 prochains jours.</p>'}
      <h2 class="titre-section">Journal <span>15 dernières relances notées</span></h2>
      ${journal.length ? `<ul class="journal">${journal.map((r) => `<li><span class="date-pastille"><b>${versDate(r.date).getDate()}</b>${fmt(r.date, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="ouvrir" data-id="${r.f.id}"><b>${esc(nomClient(r.f.client))} · ${esc(r.f.numero)}</b><span>${esc(r.nom)}${r.canal ? ` · ${esc(r.canal)}` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</span></button>${r.md ? '<span class="etiquette rose">Mise en demeure</span>' : ''}</li>`).join('')}</ul>` : '<p class="aide">Aucune relance notée pour l\'instant.</p>'}
      <h2 class="titre-section">Paliers et modèles <span>Jours après l'échéance, au moins ${jours(E.reglages.ecartMin)} entre deux relances</span></h2>
      <ol class="paliers">${paliers.map((p, i) => `<li><span class="palier-num">${i + 1}</span><button class="lien-ligne" data-action="palier" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${p.jours ? `${jours(p.jours)} après l'échéance` : 'Le jour de l\'échéance'}${p.md ? ' · vaut mise en demeure' : ''} · objet : ${esc(p.objet || '(vide)')}</span></button><button class="btn petit" data-action="palier" data-id="${p.id}">Modifier</button></li>`).join('')}</ol>
      <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="nouveau-palier">${ICONES.plus}Ajouter un palier</button><button class="btn petit" data-action="paliers-defaut">Revenir aux paliers d'origine</button></div>
      <h2 class="titre-section">Repères <span>Droit français, relevés le ${dateLongue(E.reglages.verifieLe || B.version)} : à vérifier</span></h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      ${AVERTISSEMENT}`;
  }

  // ---------- Clients ----------
  function vueClients() {
    const t = auj();
    const s = synth();
    const parClient = new Map(s.parClient.map((c) => [c.client, c]));
    const liste = [...E.clients].sort((a, b) => (parClient.get(b.id)?.echu || 0) - (parClient.get(a.id)?.echu || 0) || a.nom.localeCompare(b.nom));
    return `
      <div class="vue-tete"><div><h1>Clients</h1><p>Le type de client décide du calcul : entre professionnels, pénalités dès l'échéance et indemnité de 40 € ; pour un particulier, intérêts à partir de la mise en demeure.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-client">${ICONES.plus}Ajouter un client</button></div></div>
      ${liste.length ? `<ul class="lignes-fac">${liste.map((c) => {
        const x = parClient.get(c.id);
        const n = E.factures.filter((f) => f.client === c.id).length;
        return `<li class="ligne-fac ${c.efface ? 'st-abandonnee' : ''}">
          <button class="ligne-info" data-action="client" data-id="${c.id}"><b>${esc(c.nom)}</b>
            <span class="ligne-detail">${c.type === 'pro' ? 'Professionnel' : 'Particulier'}${c.contact ? ` · ${esc(c.contact)}` : ''}</span>
            <span class="ligne-etiquettes">${c.efface ? '<span class="etiquette sable">Données effacées</span>' : ''}${x?.retardMax ? `<span class="etiquette ${x.retardMax > 60 ? 'rouge' : 'jaune'}">Retard maximal ${jours(x.retardMax)}</span>` : ''}${n ? `<span class="etiquette sable">${pluriel(n, 'facture')}</span>` : '<span class="etiquette sable">Aucune facture</span>'}</span></button>
          <div class="ligne-droite"><span class="ligne-cout"><b>${euros(x?.encours || 0)}</b><small>${x?.echu ? `dont ${euros(x.echu)} échus` : 'encours'}</small></span><button class="btn petit" data-action="nouvelle" data-client="${c.id}">Facture</button></div>
        </li>`;
      }).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun client</h3><p>Un client se crée aussi en saisissant sa première facture.</p></div></div>`}
      <div class="rgpd"><h2>Données personnelles de tes débiteurs</h2><p>Tu enregistres ici des informations sur des tiers, parfois des particuliers : garde le minimum utile au recouvrement (nom, un moyen de contact), informe tes clients que leurs données servent au suivi des paiements (conditions générales ou factures), et efface ce qui n'est plus nécessaire. Ouvre un client pour <b>effacer ses données personnelles</b> (montants et dates restent, comme pièces comptables) ou le <b>supprimer avec ses factures</b>. Les durées de conservation dépendent de tes obligations comptables : à vérifier avec ton comptable.</p></div>
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
  const garderOuverte = () => { modale().dataset.garder = '1'; };

  // Nouvelle facture (id absent) ou facture existante.
  function modaleFacture(id, { clientId = '' } = {}) {
    const t = auj();
    const f = id ? facture(id) : null;
    if (id && !f) return;
    const v = f || { client: clientId || E.clients[0]?.id || '', numero: '', emission: t, echeance: ajout(t, E.reglages.delaiPaiement), montant: null, note: '', litige: false, abandonnee: false };
    const corps = `
      <label class="champ">Client<select name="client" id="choix-client">${E.clients.map((c) => `<option value="${c.id}" ${c.id === v.client ? 'selected' : ''}>${esc(c.nom)}${c.type === 'particulier' ? ' (particulier)' : ''}</option>`).join('')}<option value="__nouveau" ${E.clients.length ? '' : 'selected'}>Nouveau client…</option></select></label>
      <fieldset class="champ cadre-champs" id="nouveau-client" ${E.clients.length ? 'hidden' : ''}><legend>Nouveau client <small>Le minimum : un nom, et s'il s'agit d'un professionnel ou d'un particulier.</small></legend>
        <label class="champ">Nom ou raison sociale<input name="nomClient" maxlength="80"></label>
        <div class="choix-statut deux">${[['pro', 'Professionnel'], ['particulier', 'Particulier']].map(([k, l], i) => `<label><input type="radio" name="typeClient" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      </fieldset>
      <div class="rang-champs">
        <label class="champ">Numéro de facture<input name="numero" maxlength="40" required value="${esc(v.numero)}" placeholder="Ex. : F-2026-012"></label>
        <label class="champ">Montant TTC<input name="montant" inputmode="decimal" autocomplete="off" required value="${R.saisieMontant(v.montant)}" placeholder="0,00"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Date d'émission<input type="date" name="emission" required value="${v.emission}"></label>
        <label class="champ">Délai (jours)<small>Remplit l'échéance.</small><input type="number" name="delai" min="0" max="365" value="${R.ecart(v.emission, v.echeance)}"></label>
        <label class="champ">Échéance<input type="date" name="echeance" required value="${v.echeance}"></label>
      </div>
      <label class="champ">Note <small>Facultative. Évite les informations personnelles inutiles.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${f ? `<div class="cases"><label class="case"><input type="checkbox" name="litige" ${f.litige ? 'checked' : ''}> En litige (relances suspendues)</label><label class="case"><input type="checkbox" name="abandonnee" ${f.abandonnee ? 'checked' : ''}> Abandonnée (sortie de l'encours)</label></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = f
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(f ? `Modifier ${esc(f.numero)}` : 'Nouvelle facture', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer la facture ${f.numero} et son journal de relances ?`)) { garderOuverte(); return; }
        retenir();
        E.factures = E.factures.filter((x) => x.id !== f.id);
        sauver(); rendre(); toast(`Facture ${f.numero} supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      let cid = fd.get('client');
      const numero = String(fd.get('numero') || '').trim();
      if (cid === '__nouveau' && !String(fd.get('nomClient') || '').trim()) return 'Indique le nom du nouveau client.';
      if (!numero) return 'Indique le numéro de la facture.';
      const montant = R.lireMontant(fd.get('montant'));
      if (!montant) return 'Montant illisible : écris par exemple 1 250,00.';
      const emission = fd.get('emission'), echeance = fd.get('echeance');
      if (!R.estDate(emission) || !R.estDate(echeance)) return 'Indique la date d\'émission et l\'échéance.';
      if (echeance < emission) return 'L\'échéance ne peut pas précéder l\'émission.';
      if (!f && E.factures.some((x) => x.numero === numero && x.client === cid)) return `La facture ${numero} existe déjà pour ce client.`;
      retenir();
      if (cid === '__nouveau') {
        const c = R.normaliserClient({ id: uid(), nom: String(fd.get('nomClient')).trim(), type: fd.get('typeClient') });
        E.clients.push(c); cid = c.id;
      }
      const donnees = { client: cid, numero, emission, echeance, montant, note: String(fd.get('note') || '').trim(), litige: !!fd.get('litige'), abandonnee: !!fd.get('abandonnee') };
      if (f) Object.assign(f, R.normaliserFacture({ ...f, ...donnees }, t));
      else E.factures.push(R.normaliserFacture({ id: uid(), ...donnees, paiements: [], relances: [] }, t));
      sauver(); rendre();
      toast(f ? `Facture ${numero} enregistrée.` : `Facture ${numero} ajoutée : ${euros(montant)}, échéance le ${dateLongue(echeance)}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const sel = d.querySelector('#choix-client');
    sel.addEventListener('change', () => { d.querySelector('#nouveau-client').hidden = sel.value !== '__nouveau'; });
    const em = d.querySelector('[name=emission]'), de = d.querySelector('[name=delai]'), ec = d.querySelector('[name=echeance]');
    const majEcheance = () => { const n = Math.round(Number(de.value)); if (R.estDate(em.value) && Number.isFinite(n) && n >= 0) ec.value = ajout(em.value, n); };
    de.addEventListener('input', majEcheance);
    em.addEventListener('change', majEcheance);
    ec.addEventListener('change', () => { if (R.estDate(em.value) && R.estDate(ec.value)) de.value = R.ecart(em.value, ec.value); });
  }

  // Détail d'une facture : synthèse, pénalités, paiements, journal des relances.
  function modaleDetail(id) {
    const t = auj();
    const f = facture(id);
    if (!f) return;
    const c = client(f.client);
    const type = c?.type || 'pro';
    const s = R.statut(f, t);
    const pen = R.penalites(f, type, E.reglages, t);
    const ind = R.indemnite(f, type, E.reglages, t);
    const du = R.restant(f, t);
    const retard = R.retardJours(f, t);
    const pr = R.prochaineRelance(f, E.paliers, t, E.reglages.ecartMin);
    const raisons = { 'sans-mise-en-demeure': 'Client particulier : les intérêts au taux légal courent à partir de la mise en demeure. Note une relance « mise en demeure » pour les faire partir.', 'pas-de-retard': 'Pas de retard : aucune pénalité.', abandonnee: 'Facture abandonnée : rien n\'est calculé.', 'pas-encore': 'Les intérêts commencent à courir demain.' };
    const segments = pen.segments.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Période</th><th class="nb">Jours</th><th class="nb">Base</th><th class="nb">Taux</th><th class="nb">Montant</th></tr></thead><tbody>${pen.segments.map((x) => `<tr><td>${dateCourte(x.de)} → ${dateCourte(x.a)}${x.aVerifier ? ' *' : ''}</td><td class="nb">${x.jours}</td><td class="nb">${euros(x.base)}</td><td class="nb">${pct(x.taux)}</td><td class="nb">${euros(x.montant)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const corps = `
      <div class="resume-facture">
        <div><span>Client</span><b><button type="button" class="btn lien" data-action="client" data-id="${f.client}">${esc(nomClient(f.client))}</button></b><small>${type === 'pro' ? 'Professionnel' : 'Particulier'}</small></div>
        <div><span>Statut</span><b>${etiquetteStatut(s)}</b><small>${retard ? `${jours(retard)} de retard${s === 'payee' ? ' au paiement' : ''}` : 'Pas de retard'}</small></div>
        <div><span>Montant TTC</span><b>${euros(f.montant)}</b><small>Émise le ${fmt(f.emission)}</small></div>
        <div><span>Restant dû</span><b>${euros(du)}</b><small>Échéance le ${fmt(f.echeance)}</small></div>
      </div>
      ${f.note ? `<p class="aide">${esc(f.note)}</p>` : ''}
      <section class="bloc-detail"><h3>${type === 'pro' ? 'Pénalités et indemnité' : 'Intérêts de retard'} <span>${euros(pen.montant + ind)}</span></h3>
        ${pen.raison && raisons[pen.raison] ? `<p class="mention">${raisons[pen.raison]}</p>` : `<p class="mention">Intérêts simples sur le restant dû, du ${dateCourte(pen.debut)} au ${dateCourte(pen.fin)}, base ${R.BASE_JOURS} jours. ${type === 'pro' ? `Taux : ${E.reglages.tauxContractuelPro !== null ? 'taux de tes conditions générales' : `BCE du semestre + ${String(E.reglages.majoration).replace('.', ',')} points`}.` : `Taux : ${E.reglages.tauxContractuelPart !== null ? 'taux de ton contrat' : 'intérêt légal du semestre'}.`}</p>`}
        ${segments}
        ${pen.aVerifier ? '<p class="mention">* Taux du semestre non saisi : taux le plus proche repris, à vérifier dans les Réglages.</p>' : ''}
        ${type === 'pro' ? `<p class="ligne-somme"><span>Pénalités de retard</span><b>${euros(pen.montant)}</b></p><p class="ligne-somme"><span>Indemnité forfaitaire de recouvrement</span><b>${euros(ind)}</b></p>` : ''}
        <p class="ligne-somme total"><span>Total réclamable estimé</span><b>${euros(du + pen.montant + ind)}</b></p>
      </section>
      <section class="bloc-detail"><h3>Paiements <span>${euros(R.paye(f, t))} reçus</span></h3>
        ${f.paiements.length ? `<ul class="mini-liste">${[...f.paiements].sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<li><span>${fmt(p.date)}${p.note ? ` · ${esc(p.note)}` : ''}</span><b>${euros(p.montant)}</b><button type="button" class="btn-suppr" data-action="suppr-paiement" data-id="${f.id}" data-p="${p.id}" aria-label="Supprimer ce paiement">×</button></li>`).join('')}</ul>` : '<p class="mention">Aucun paiement reçu.</p>'}
        <div class="rang">${du ? `<button type="button" class="btn petit" data-action="paiement" data-id="${f.id}">${ICONES.plus}Noter un paiement</button><button type="button" class="btn petit" data-action="solder" data-id="${f.id}">Payée aujourd'hui (${euros(du)})</button>` : ''}</div>
      </section>
      <section class="bloc-detail"><h3>Journal des relances <span>${pluriel(f.relances.length, 'relance')}</span></h3>
        ${f.relances.length ? `<ul class="mini-liste">${R.relancesTriees(f).map((r) => `<li><span>${fmt(r.date)} · <b>${esc(r.nom)}</b>${r.canal ? ` · ${esc(r.canal)}` : ''}${r.md ? ' · mise en demeure' : ''}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</span><button type="button" class="btn-suppr" data-action="suppr-relance" data-id="${f.id}" data-p="${r.id}" aria-label="Supprimer cette relance du journal">×</button></li>`).join('')}</ul>` : '<p class="mention">Aucune relance notée.</p>'}
        ${pr ? `<p class="aide">Prochaine relance : <b>${esc(pr.palier.nom)}</b>, ${pr.due ? (pr.joursDepuis ? `prévue depuis le ${dateLongue(pr.date)}` : 'prévue aujourd\'hui') : `le ${dateLongue(pr.date)}`}.</p>` : R.estOuverte(s) && s !== 'litige' && f.relances.length ? '<p class="aide">Tous les paliers ont été envoyés : il reste la procédure de recouvrement (injonction de payer, tiers).</p>' : ''}
        <div class="rang">${R.estOuverte(s) ? `<button type="button" class="btn petit ${pr?.due ? 'primaire' : ''}" data-action="preparer" data-id="${f.id}">Préparer une relance</button>` : ''}</div>
      </section>`;
    ouvrirModale(`Facture ${esc(f.numero)}`, corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier" data-id="${f.id}">Modifier</button>`);
  }

  function modalePaiement(id) {
    const t = auj();
    const f = facture(id);
    if (!f) return;
    const du = R.restant(f, t);
    ouvrirModale(`Paiement · ${esc(f.numero)}`, `
      <p>Restant dû : <b>${euros(du)}</b> sur ${euros(f.montant)}.</p>
      <div class="rang-champs">
        <label class="champ">Montant reçu<input name="montant" inputmode="decimal" required value="${R.saisieMontant(du)}"></label>
        <label class="champ">Date de réception<small>Arrête les intérêts sur la somme payée.</small><input type="date" name="date" required value="${t}"></label>
      </div>
      <label class="champ">Note <small>Facultative (virement, chèque…).</small><input name="note" maxlength="120"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const m = R.lireMontant(fd.get('montant'));
      if (!m) return 'Montant illisible : écris par exemple 250,00.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date de réception.';
      retenir();
      f.paiements.push({ id: uid(), date: fd.get('date'), montant: m, note: String(fd.get('note') || '').trim() });
      sauver(); rendre();
      garderOuverte(); modaleDetail(f.id);
      toast(R.restant(f, t) ? `Paiement de ${euros(m)} noté : reste ${euros(R.restant(f, t))}.` : `Facture ${f.numero} soldée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Préparer le message d'un palier : texte rempli, à copier ; « Noter comme envoyée » l'ajoute au journal.
  function modaleRelance(id, palierId) {
    const t = auj();
    const f = facture(id);
    if (!f) return;
    const c = client(f.client);
    const pr = R.prochaineRelance(f, E.paliers, t, E.reglages.ecartMin);
    const paliers = R.paliersTries(E.paliers);
    const choisi = palier(palierId) || pr?.palier || paliers.at(-1);
    if (!choisi) { toast('Ajoute d\'abord un palier de relance.'); return; }
    const valeurs = R.valeursMessage(f, c, E, t);
    const remplirPalier = (p) => ({ objet: R.remplir(p.objet, valeurs), corps: R.remplir(p.corps, valeurs) });
    const m = remplirPalier(choisi);
    const corps = `
      <p class="mention">${esc(nomClient(f.client))} · ${esc(f.numero)} · ${euros(R.restant(f, t))} restant dû · ${jours(R.retardJours(f, t))} de retard.${c?.contact ? ` Contact : ${esc(c.contact)}.` : ''}</p>
      <label class="champ">Palier<select name="palier" id="choix-palier">${paliers.map((p) => `<option value="${p.id}" ${p.id === choisi.id ? 'selected' : ''}>${esc(p.nom)}${f.relances.some((r) => r.palier === p.id) ? ' (déjà envoyé)' : ''}</option>`).join('')}</select></label>
      <label class="champ">Objet<input name="objet" id="msg-objet" maxlength="200" value="${esc(m.objet)}"></label>
      <label class="champ">Message <small>Modifiable avant de copier. Rien n'est envoyé : colle-le dans ta messagerie ou ton courrier.</small><textarea name="corps" id="msg-corps" rows="12">${esc(m.corps)}</textarea></label>
      <div class="rang"><button class="btn" type="button" data-action="copier-message">Copier le message</button></div>
      <fieldset class="champ cadre-champs"><legend>Une fois envoyé <small>Le journal garde la date, le palier et le canal.</small></legend>
        <div class="rang-champs">
          <label class="champ">Envoyé le<input type="date" name="date" value="${t}" required></label>
          <label class="champ">Canal<select name="canal">${B.canaux.map((x) => `<option ${x === (choisi.md ? 'Recommandé avec AR' : 'E-mail') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        </div>
        <label class="champ">Note <small>Facultative (réponse du client, promesse de paiement…).</small><input name="note" maxlength="200"></label>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Préparer la relance', corps, '<button class="btn primaire" value="ok">Noter comme envoyée</button><button class="btn" value="annuler">Fermer</button>', (fd) => {
      const p = palier(fd.get('palier'));
      if (!p) return 'Choisis un palier.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date d\'envoi.';
      retenir();
      f.relances.push({ id: uid(), date: fd.get('date'), palier: p.id, nom: p.nom, md: p.md, canal: fd.get('canal') || '', note: String(fd.get('note') || '').trim() });
      sauver(); rendre();
      toast(`${p.nom} notée au journal de ${f.numero}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelector('#choix-palier').addEventListener('change', (e) => {
      const p = palier(e.target.value);
      if (!p) return;
      const x = remplirPalier(p);
      d.querySelector('#msg-objet').value = x.objet;
      d.querySelector('#msg-corps').value = x.corps;
      d.querySelector('[name=canal]').value = p.md ? 'Recommandé avec AR' : 'E-mail';
    });
  }

  async function copierMessage() {
    const objet = $('#msg-objet'), corps = $('#msg-corps');
    if (!objet || !corps) return;
    const texte = `Objet : ${objet.value}\n\n${corps.value}`;
    try { await navigator.clipboard.writeText(texte); toast('Message copié : colle-le dans ta messagerie, puis note la relance comme envoyée.'); } catch { corps.select(); toast('Sélectionné : copie-le avec Ctrl+C (ou un appui long).'); }
  }

  function modalePalier(id) {
    const p = id ? palier(id) : null;
    const v = p || { nom: '', jours: (R.paliersTries(E.paliers).at(-1)?.jours || 0) + 15, md: false, objet: 'Facture {numero}', corps: 'Bonjour,\n\n\n\n{signature}' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom du palier<input name="nom" maxlength="60" required value="${esc(v.nom)}" placeholder="Ex. : Appel téléphonique"></label>
        <label class="champ">Jours après l'échéance<input type="number" name="jours" min="0" max="365" required value="${v.jours}"></label>
      </div>
      <label class="case"><input type="checkbox" name="md" ${v.md ? 'checked' : ''}> Ce message vaut mise en demeure (départ des intérêts d'un client particulier)</label>
      <label class="champ">Objet<input name="objet" maxlength="200" value="${esc(v.objet)}"></label>
      <label class="champ">Message<textarea name="corps" rows="12">${esc(v.corps)}</textarea></label>
      <details class="champs-aide"><summary>Champs remplis automatiquement</summary><ul>${B.champs.map(([k, l]) => `<li><code>{${k}}</code> ${esc(l)}</li>`).join('')}</ul></details>
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier le palier' : 'Nouveau palier', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (E.paliers.length <= 1) return 'Garde au moins un palier.';
        if (!confirm(`Supprimer le palier « ${p.nom} » ? Les relances déjà notées restent au journal.`)) { garderOuverte(); return; }
        retenir();
        E.paliers = E.paliers.filter((x) => x.id !== p.id);
        sauver(); rendre(); toast(`Palier « ${p.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au palier.';
      const j = Math.round(Number(fd.get('jours')));
      if (!(j >= 0 && j <= 365)) return 'Le délai doit être entre 0 et 365 jours.';
      retenir();
      const donnees = R.normaliserPalier({ id: p?.id || uid(), nom, jours: j, md: !!fd.get('md'), objet: String(fd.get('objet') || ''), corps: String(fd.get('corps') || '') });
      if (p) Object.assign(p, donnees); else E.paliers.push(donnees);
      sauver(); rendre(); toast(`Palier « ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleClient(id) {
    const c = id ? client(id) : null;
    const n = c ? E.factures.filter((f) => f.client === c.id).length : 0;
    const v = c || { nom: '', type: 'pro', contact: '', note: '' };
    const corps = `
      <label class="champ">Nom ou raison sociale<input name="nom" maxlength="80" required value="${esc(v.nom)}"></label>
      <fieldset class="champ"><legend>Type de client <small>Décide du calcul des pénalités.</small></legend><div class="choix-statut deux">${[['pro', 'Professionnel'], ['particulier', 'Particulier']].map(([k, l]) => `<label><input type="radio" name="type" value="${k}" ${v.type === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Contact <small>Facultatif : un e-mail ou un téléphone professionnel suffit.</small><input name="contact" maxlength="120" value="${esc(v.contact)}"></label>
      <label class="champ">Note <small>Facultative. Uniquement ce qui sert au recouvrement.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${c ? `<div class="groupe"><h3>Données personnelles</h3><p class="aide">${pluriel(n, 'facture')} pour ce client. « Effacer les données » remplace le nom, vide le contact et les notes, et garde montants et dates (pièces comptables). « Supprimer » retire le client et toutes ses factures.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="effacer-client" data-id="${c.id}" ${c.efface ? 'disabled' : ''}>Effacer les données</button><button class="btn petit danger" type="button" data-action="supprimer-client" data-id="${c.id}">Supprimer le client et ses factures</button></div></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? 'Client' : 'Nouveau client', corps, `<button class="btn primaire" value="ok">${c ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${c && n ? `<button class="btn gauche" type="button" data-action="voir-factures" data-id="${c.id}">Voir ses factures</button>` : ''}`, (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      retenir();
      const d = R.normaliserClient({ id: c?.id || uid(), nom, type: fd.get('type'), contact: String(fd.get('contact') || '').trim(), note: String(fd.get('note') || '').trim(), efface: c?.efface && nom === c.nom });
      if (c) Object.assign(c, d); else E.clients.push(d);
      sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function effacerClient(id) {
    const c = client(id);
    if (!c || !confirm(`Effacer les données personnelles de « ${c.nom} » ? Le nom devient « Client effacé », le contact et les notes sont vidés. Montants et dates restent.`)) return;
    retenir();
    E = R.effacerClient(E, id, E.clients.filter((x) => x.efface).length + 1);
    sauver(); rendre(); modale().close();
    toast('Données personnelles effacées.', { libelle: 'Annuler', faire: annuler });
  }
  function supprimerClient(id) {
    const c = client(id);
    if (!c) return;
    const n = E.factures.filter((f) => f.client === id).length;
    if (!confirm(`Supprimer « ${c.nom} »${n ? ` et ses ${pluriel(n, 'facture')}` : ''} ? Pense à garder ailleurs ce que tes obligations comptables imposent.`)) return;
    retenir();
    E = R.supprimerClient(E, id);
    sauver(); rendre(); modale().close();
    toast(`« ${c.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  // Lignes de taux par semestre, éditables (une ligne vide pour ajouter, taux vide pour retirer).
  const lignesTaux = (nom, liste) => `${[...liste, { debut: '', taux: null }].map((x, i) => `<div class="ligne-taux"><label class="champ">Semestre commençant le<input type="date" name="${nom}_debut_${i}" value="${x.debut}"></label><label class="champ">Taux (%)<input name="${nom}_taux_${i}" inputmode="decimal" value="${R.saisieTaux(x.taux)}" placeholder="${x.debut ? '' : 'Nouveau'}"></label></div>`).join('')}`;
  const lireTaux = (fd, nom) => {
    const l = [];
    for (let i = 0; fd.has(`${nom}_debut_${i}`); i++) {
      const debut = fd.get(`${nom}_debut_${i}`), brut = String(fd.get(`${nom}_taux_${i}`) || '').trim();
      if (!debut && !brut) continue;
      const taux = R.lireTaux(brut);
      if (!brut) continue;
      if (!R.estDate(debut) || taux === null) return null;
      l.push({ debut: R.debutSemestre(debut), taux });
    }
    return l.sort((a, b) => a.debut.localeCompare(b.debut));
  };

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const t = auj();
    const plancher = R.plancherPro(r, t);
    const corps = `
      <div class="rang-champs">
        <label class="champ">Ton entreprise<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
        <label class="champ">Délai de paiement habituel (jours)<input type="number" name="delaiPaiement" min="0" max="120" value="${r.delaiPaiement}"></label>
      </div>
      <label class="champ">Signature des messages<textarea name="signature" rows="3" maxlength="300">${esc(E.signature)}</textarea></label>
      <div class="rang-champs">
        <label class="champ">Jours au moins entre deux relances<input type="number" name="ecartMin" min="0" max="60" value="${r.ecartMin}"></label>
        <label class="champ">Délai laissé au client (jours)<small>Champ {delai_reponse} des messages.</small><input type="number" name="delaiReponse" min="1" max="60" value="${r.delaiReponse}"></label>
      </div>
      <div class="groupe"><h3>Taux et indemnité <span class="etiquette jaune">Paramètres datés</span></h3>
        <p class="aide">Relevés le ${dateLongue(r.verifieLe || B.version)}. Nouveaux taux chaque 1er janvier et 1er juillet : saisis-les ici. ${esc(B.sourceTaux)}</p>
        <fieldset class="champ cadre-champs"><legend>Entre professionnels <small>À défaut de taux dans tes conditions générales : taux BCE en vigueur au début du semestre + majoration (art. L441-10).</small></legend>
          <label class="champ">Majoration (points)<input name="majoration" inputmode="decimal" value="${R.saisieTaux(r.majoration)}"></label>
          ${lignesTaux('bce', r.bce)}
          <label class="champ">Taux de tes conditions générales (%) <small>Facultatif : remplace BCE + majoration. Plancher légal : 3 fois le taux légal${plancher !== null ? `, soit ${pct(plancher)} ce semestre` : ''}.</small><input name="tauxContractuelPro" inputmode="decimal" value="${R.saisieTaux(r.tauxContractuelPro)}" placeholder="Non renseigné"></label>
          <label class="champ">Indemnité forfaitaire par facture (€)<small>40 € (art. D441-5).</small><input name="indemnite" inputmode="decimal" value="${R.saisieMontant(r.indemnite)}"></label>
        </fieldset>
        <fieldset class="champ cadre-champs"><legend>Taux de l'intérêt légal <small>Créancier professionnel (« autres cas ») : sert aux clients particuliers et au plancher ci-dessus.</small></legend>
          ${lignesTaux('legal', r.tauxLegal)}
          <label class="champ">Taux prévu dans tes contrats avec des particuliers (%) <small>Facultatif : remplace le taux légal.</small><input name="tauxContractuelPart" inputmode="decimal" value="${R.saisieTaux(r.tauxContractuelPart)}" placeholder="Non renseigné"></label>
          <label class="case"><input type="checkbox" name="depuisEcheancePart" ${r.depuisEcheancePart ? 'checked' : ''}> Ce taux contractuel court dès l'échéance (sinon, à partir de la mise en demeure)</label>
        </fieldset>
        <label class="champ">Taux vérifiés le<input type="date" name="verifieLe" value="${r.verifieLe || ''}"></label>
        <details class="champs-aide"><summary>Sources</summary><ul>${B.sources.map(([l, u]) => `<li>${esc(l)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte tes factures en tableur (CSV) pour ton comptable.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Tes factures et les données de tes clients sont enregistrées en ligne, liées à ta clé, et ne sont ni lues ni partagées par QME. Tu es responsable des données de tes débiteurs : garde le minimum, et efface un client depuis sa fiche quand rien ne t'oblige à conserver ses données.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${E.paliers.length} paliers de relance, modèles de messages rédigés pour QME (version ${B.version}). Aucun e-mail envoyé, aucune connexion à une messagerie ni à une banque : tu copies le message et tu l'envoies toi-même. Outil d'aide, pas un conseil juridique.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Math.round(Number(fd.get(nom))); return n >= min && n <= max ? n : null; };
      const delaiPaiement = ent('delaiPaiement', 0, 120), ecartMin = ent('ecartMin', 0, 60), delaiReponse = ent('delaiReponse', 1, 60);
      if (delaiPaiement === null || ecartMin === null || delaiReponse === null) return 'Vérifie les délais (nombres de jours).';
      const majoration = R.lireTaux(fd.get('majoration'));
      if (majoration === null) return 'Majoration illisible : écris par exemple 10.';
      const bce = lireTaux(fd, 'bce'), legal = lireTaux(fd, 'legal');
      if (!bce || !legal) return 'Une ligne de taux est incomplète : date du semestre et taux, par exemple 2,40.';
      const opt = (nom) => { const b = String(fd.get(nom) || '').trim(); return b ? R.lireTaux(b) : undefined; };
      const tcPro = opt('tauxContractuelPro'), tcPart = opt('tauxContractuelPart');
      if (tcPro === null || tcPart === null) return 'Taux contractuel illisible : écris par exemple 9,5.';
      const indem = R.lireMontant(fd.get('indemnite'));
      if (indem === null) return 'Indemnité illisible : écris 40,00.';
      E.entreprise = String(fd.get('entreprise') || '').trim();
      E.signature = String(fd.get('signature') || '').trim();
      Object.assign(E.reglages, { delaiPaiement, ecartMin, delaiReponse, majoration, bce, tauxLegal: legal, tauxContractuelPro: tcPro ?? null, tauxContractuelPart: tcPart ?? null, depuisEcheancePart: !!fd.get('depuisEcheancePart'), indemnite: indem, verifieLe: R.estDate(fd.get('verifieLe')) ? fd.get('verifieLe') : E.reglages.verifieLe });
      sauver(); rendre();
      const pl = R.plancherPro(E.reglages, auj());
      toast(tcPro !== undefined && pl !== null && tcPro < pl ? `Réglages enregistrés. Attention : ton taux (${pct(tcPro)}) est sous le plancher légal de ${pct(pl)}.` : 'Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.factures)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.factures.length, 'facture')}) ?`)) return;
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `relances-impayes-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E, auj()), 'text/csv;charset=utf-8', `factures-impayes-${auj()}.csv`);

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
    const t = auj();
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
      case 'fermer': modale().close(); break;
      case 'nouvelle': modaleFacture(null, { clientId: el.dataset.client }); break;
      case 'ouvrir': modaleDetail(id); break;
      case 'modifier': modaleFacture(id); break;
      case 'paiement': modalePaiement(id); break;
      case 'solder': { const f = facture(id); if (!f) break; const du = R.restant(f, t); if (!du) break; retenir(); f.paiements.push({ id: uid(), date: t, montant: du, note: '' }); sauver(); rendre(); modaleDetail(id); toast(`Facture ${f.numero} soldée aujourd'hui.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'suppr-paiement': { const f = facture(id); if (!f) break; retenir(); f.paiements = f.paiements.filter((p) => p.id !== el.dataset.p); sauver(); rendre(); modaleDetail(id); toast('Paiement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'suppr-relance': { const f = facture(id); if (!f) break; retenir(); f.relances = f.relances.filter((r) => r.id !== el.dataset.p); sauver(); rendre(); modaleDetail(id); toast('Relance retirée du journal.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'preparer': modaleRelance(id); break;
      case 'copier-message': copierMessage(); break;
      case 'palier': modalePalier(id); break;
      case 'nouveau-palier': modalePalier(null); break;
      case 'paliers-defaut': if (confirm('Remplacer tes paliers et tes modèles par ceux d\'origine ? Le journal des relances reste.')) { retenir(); E.paliers = R.etatVide(DEFAUTS).paliers; sauver(); rendre(); toast('Paliers d\'origine rétablis.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'client': modaleClient(id); break;
      case 'nouveau-client': modaleClient(null); break;
      case 'effacer-client': effacerClient(id); break;
      case 'supprimer-client': supprimerClient(id); break;
      case 'voir-factures': modale().close(); filtre.statut = 'toutes'; filtre.q = nomClient(id); changerVue('factures'); break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
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
  window.__impayes = { etat: () => E, regles: R };
  init();
})();
