// Capacité d'emprunt et comparateur de prêts QME : capacité, budget du projet, offres comparées,
// tableau d'amortissement et remboursement anticipé. Données synchronisées par clé de licence ou code
// d'accès. Simulation : ne remplace pas le conseil d'un professionnel du crédit.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CPT;
  const API = '/api/templates';
  const PRODUIT = 'CPT';
  const CLE_CODE = 'qme-cpt-code';
  const CLE_CACHE = 'qme-cpt-cache';
  const CLE_DEMO = 'qme-cpt-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cpt-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const eur = (c) => R.euros(c, { centimes: false });
  const eurC = (c) => R.euros(c);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const couleur = (o) => R.COULEURS[o.couleur] || R.COULEURS[0];
  // Séries du graphique d'amortissement (palette validée : bleu, rouge brique, ocre).
  const SERIES = { capital: '#2F6DB5', interets: '#C2502F', assurance: '#C9A000' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'capacite';
  let annulation = null;
  let detailMensuel = false;

  const normaliser = (d) => R.normaliser(d, B);
  const offre = (id) => E.offres.find((o) => o.id === id);

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
  // Code interne (CPT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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

  const estPret = (e) => !!(e && e.profil && e.projet);
  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && (!donnees || c.base === donnees.majLe)) {
      E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
      if (estPret(E)) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (estPret(E)) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && estPret(normaliser(d)) ? normaliser(d) : donneesDemo();
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
  // Couple fictif de primo-accédants, appartement ancien, 4 offres dont une à compléter.
  // Tous les montants et taux sont inventés : ce ne sont pas des taux du marché.
  function donneesDemo() {
    const d = {
      profil: {
        emprunteurs: [{ nom: 'Camille', revenus: 265000, autres: 0 }, { nom: 'Sam', revenus: 215000, autres: 0 }],
        loyers: 0, ponderationLoyers: 70,
        credits: [{ nom: 'Crédit auto', mensualite: 18900 }],
        autresCharges: 0, personnes: 3, resteAVivreMin: 80000,
        tauxEffortMax: B.hcsf.tauxEffort, dureeMaxAns: B.hcsf.dureeAns,
        tauxSimulation: 3.4, dureeSimulation: 300, assuranceSimulation: 0.3, quotite: 100,
      },
      projet: { nom: 'Appartement T3', usage: 'residence', type: 'ancien', prix: 26500000, notaireMode: 'estime', notairePct: B.notaire.ancien, travaux: 1500000, autresFrais: 300000, apport: 4000000 },
      offres: [
        { nom: 'Banque du quartier', montant: 26420000, taux: 3.45, dureeMois: 300, tauxAssurance: 0.34, assuranceMode: 'initial', quotite: 100, fraisDossier: 100000, garantieType: 'caution', garantie: 280000, note: 'Domiciliation des salaires demandée (exemple fictif).' },
        { nom: 'Banque en ligne', montant: 26420000, taux: 3.3, dureeMois: 300, tauxAssurance: 0.36, assuranceMode: 'crd', quotite: 100, fraisDossier: 0, garantieType: 'hypotheque', garantie: 410000 },
        { nom: 'Via courtier, 22 ans', montant: 26420000, taux: 3.25, dureeMois: 264, tauxAssurance: 0.22, assuranceMode: 'crd', quotite: 100, fraisDossier: 50000, garantieType: 'caution', garantie: 260000, courtage: 180000, note: 'Assurance externe (délégation), garanties à comparer.' },
        { nom: 'Banque mutualiste', montant: 26420000, dureeMois: 300, tauxAssurance: 0.3, assuranceMode: 'initial', note: 'En attente de la proposition écrite.' },
      ],
      anticipe: { mois: 84, montant: 2000000, mode: 'duree', ira: { mode: 'plafond', moisInterets: B.ira.moisInterets, pctCrd: B.ira.pctCrd } },
      questions: { taux: true, assurance: true },
    };
    return normaliser(d);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Capacité d\'emprunt et comparateur de prêts · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="160" width="60" height="120" fill="#1D4E89"/>
          <rect x="100" y="110" width="60" height="170" fill="#1D4E89"/>
          <rect x="180" y="60" width="60" height="220" fill="#F5B400"/>
          <path d="M260 280 L260 160 A120 120 0 0 1 380 280 Z" fill="#D9302A"/>
          <circle cx="450" cy="120" r="100" fill="#F0EDE6"/>
          <path d="M450 120 L450 20 A100 100 0 0 1 550 120 Z" fill="#141414"/>
          <rect x="430" y="100" width="40" height="40" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Capacité d'emprunt et comparateur de prêts</p>
          <h1>Ton crédit, au vrai coût.</h1>
          <p>Ce que tu peux emprunter, le budget complet du projet, et l'offre de prêt qui coûte le moins, tableau d'amortissement compris.</p>
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
  const accueilVide = () => ({ nb: '1', rev1: '', rev2: '', credits: '', prix: '', apport: '', type: 'ancien' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>Combien peux-tu emprunter, et à quel coût ?</h1>
      <p class="intro">Quelques chiffres pour commencer : tu affineras ensuite ton profil, le budget du projet et les offres reçues des banques. Aucun taux du marché n'est intégré : tu saisis ceux de tes offres.</p>
      <form id="form-accueil" class="form-accueil" novalidate>
        <fieldset class="champ"><legend>Tu empruntes</legend><div class="choix-statut deux">${[['1', 'Seul(e)'], ['2', 'À deux']].map(([k, l]) => `<label><input type="radio" name="nb" value="${k}" ${a.nb === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <div class="rang-champs">
          <label class="champ">Revenus nets mensuels (€) <small>Avant impôt sur le revenu, primes lissées sur 12 mois.</small><input name="rev1" inputmode="decimal" value="${esc(a.rev1)}" placeholder="Ex. : 2 400"></label>
          <label class="champ" ${a.nb === '2' ? '' : 'hidden'} id="champ-rev2">Revenus du co-emprunteur (€) <small>Nets mensuels.</small><input name="rev2" inputmode="decimal" value="${esc(a.rev2)}" placeholder="Ex. : 2 100"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Crédits en cours (€ par mois) <small>Total des mensualités qui continueront après l'achat ; 0 si aucun.</small><input name="credits" inputmode="decimal" value="${esc(a.credits)}" placeholder="0"></label>
          <label class="champ">Type de bien<select name="type">${Object.entries(B.typesBien).map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Prix du bien (€) <small>Facultatif à ce stade.</small><input name="prix" inputmode="decimal" value="${esc(a.prix)}" placeholder="Ex. : 220 000"></label>
          <label class="champ">Apport (€) <small>Épargne que tu mets dans le projet.</small><input name="apport" inputmode="decimal" value="${esc(a.apport)}" placeholder="Ex. : 25 000"></label>
        </div>
        <p class="erreur" role="alert">${esc(erreur)}</p>
      </form>
      <ol class="conseils" style="margin-top:28px">${B.reperes.slice(0, 3).map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Créer ma simulation</button></div>
    </div>`;
    const f = $('#form-accueil');
    f.addEventListener('input', () => {
      const fd = new FormData(f);
      for (const k of Object.keys(accueilVide())) a[k] = String(fd.get(k) ?? a[k] ?? '');
      $('#champ-rev2').hidden = a.nb !== '2';
    });
    f.addEventListener('submit', (e) => { e.preventDefault(); terminerAccueil(); });
  }

  function terminerAccueil() {
    const a = accueil;
    const lire = (v, lib, oblig = false) => { const s = String(v || '').trim(); if (!s) { if (oblig) throw new Error(`Indique ${lib}.`); return 0; } const m = R.lireMontant(s); if (m === null) throw new Error(`${lib[0].toUpperCase()}${lib.slice(1)} illisible : écris par exemple 2 400.`); return m; };
    try {
      const rev1 = lire(a.rev1, 'tes revenus nets mensuels', true);
      const rev2 = a.nb === '2' ? lire(a.rev2, 'les revenus du co-emprunteur', true) : 0;
      const credits = lire(a.credits, 'le montant des crédits en cours');
      const prix = lire(a.prix, 'le prix');
      const apport = lire(a.apport, 'l\'apport');
      const emprunteurs = [{ nom: a.nb === '2' ? 'Emprunteur 1' : 'Moi', revenus: rev1 }];
      if (a.nb === '2') emprunteurs.push({ nom: 'Emprunteur 2', revenus: rev2 });
      E = normaliser({
        profil: { emprunteurs, credits: credits ? [{ nom: 'Crédits en cours', mensualite: credits }] : [], personnes: emprunteurs.length, tauxEffortMax: B.hcsf.tauxEffort, dureeMaxAns: B.hcsf.dureeAns, dureeSimulation: B.defauts.dureeAns * 12 },
        projet: { type: a.type, prix, apport, notairePct: B.notaire[a.type === 'neuf' ? 'neuf' : 'ancien'] },
        offres: [],
      });
      const u = [];
      for (let i = 0; i < R.MIN_OFFRES; i++) { const o = R.offreDefaut(E, u); E.offres.push(o); u.push(o.couleur); }
      E.anticipe = R.normaliserAnticipe(null, E.offres);
    } catch (x) { return ecranAccueil(x.message); }
    accueil = accueilVide();
    vue = 'capacite';
    sauver();
    demarrer();
    toast('Ta simulation est prête. Saisis un taux pour voir ce que tu peux emprunter.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    capacite: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    projet: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    offres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="8" height="4" fill="currentColor"/></svg>',
    amortissement: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['capacite', 'Capacité'], ['projet', 'Projet'], ['offres', 'Offres'], ['amortissement', 'Amortissement']];
  const AVERTISSEMENT = '<p class="mention avertissement">Simulation à partir de ta saisie : elle ne remplace pas le conseil d\'un professionnel du crédit (banque, courtier, conseiller). Aucun taux du marché n\'est intégré ; l\'offre de prêt écrite, son TAEG et son tableau d\'amortissement font foi. Les seuils (taux d\'effort, durée) sont ceux que tu saisis.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const pastille = (o) => `<i class="pastille-sc" style="--c:${couleur(o)}" aria-hidden="true"></i>`;
  const sourceHcsf = () => `<a href="${esc(B.hcsf.url)}" target="_blank" rel="noopener">${esc(B.hcsf.source)}</a>, vérifié le ${esc(B.hcsf.verifie)}`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/emprunt/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Capacité<br>d'emprunt</span>
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
    if (!E.anticipe || !E.offres.some((o) => o.id === E.anticipe.offreId)) E.anticipe = R.normaliserAnticipe(E.anticipe, E.offres);
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Capacité d'emprunt`;
    $('#vue').className = `vue vue-${vue}`;
    graphes.clear();
    $('#vue').innerHTML = { capacite: vueCapacite, projet: vueProjet, offres: vueOffres, amortissement: vueAmortissement }[vue]();
    brancherGraphiques();
    brancherAnticipe();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Capacité ----------
  function vueCapacite() {
    const p = E.profil;
    const c = R.capacite(p);
    const b = R.budget(E.projet);
    const tete = `<div class="vue-tete"><div><h1>Capacité d'emprunt</h1><p>Ce que tes revenus permettent d'emprunter, au taux d'effort et aux conditions que tu saisis.</p></div>
      <div class="actions"><button class="btn" data-action="profil">Mon profil</button><button class="btn primaire" data-action="conditions">Taux et durée</button></div></div>`;
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Revenus retenus</p><b>${eur(c.revenus)}</b><span>par mois${p.loyers ? `, dont loyers à ${p.ponderationLoyers} %` : ''}</span></div>
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Mensualité maximale</p><b>${eur(c.mensualiteMax)}</b><span>assurance comprise, à ${esc(R.pct(c.tauxEffortMax, 1))} de taux d'effort</span></div>
      <div class="tuile" style="--c:#E58C74"><p class="surtitre">Montant empruntable</p><b>${c.complet ? eur(c.capital) : 'à calculer'}</b><span>${c.complet ? `sur ${esc(R.duree(p.dureeSimulation))} à ${esc(R.pct(p.tauxSimulation))}` : 'saisis un taux de simulation'}</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Taux d'effort actuel</p><b>${c.effortActuel === null ? '–' : esc(R.pct(c.effortActuel, 1))}</b><span>${eur(c.charges)} de charges retenues</span></div>
    </div>`;
    if (!c.revenus) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Indique tes revenus</h3><p>Revenus nets mensuels de chaque emprunteur, crédits en cours : c'est la base du calcul.</p><div class="actions"><button class="btn primaire" data-action="profil">Compléter mon profil</button></div></div></div>${AVERTISSEMENT}`;
    const verdict = c.complet
      ? `<div class="verdict"><div><p class="surtitre">Avec ${esc(R.pct(c.tauxEffortMax, 1))} de taux d'effort, sur ${esc(R.duree(p.dureeSimulation))}</p>
        <h2>Tu peux emprunter environ <span class="nowrap">${eur(c.capital)}</span></h2>
        <p>Mensualité de ${eurC(c.mensualiteHorsAss)} hors assurance, plus ${eurC(c.assurance)} d'assurance (${esc(R.pct(p.assuranceSimulation, 2))} du capital, quotité ${p.quotite} %), au taux de ${esc(R.pct(p.tauxSimulation))} que tu as saisi. ${b.besoin ? (c.capital >= b.besoin ? `Ton besoin de financement (${eur(b.besoin)}) tient dans cette capacité, avec ${eur(c.capital - b.besoin)} de marge.` : `Il manque ${eur(b.besoin - c.capital)} pour financer le projet (${eur(b.besoin)} à emprunter) : voir l'onglet Projet.`) : ''}</p></div></div>`
      : `<div class="a-completer"><b>Saisis un taux de simulation</b><span>Le taux d'une offre reçue ou d'une simulation de ta banque : aucun taux du marché n'est intégré.</span><div><button class="btn petit primaire" data-action="conditions">Taux et durée</button></div></div>`;
    const alertes = [];
    if (c.depasseDejaMax) alertes.push(`Tes charges actuelles atteignent déjà ${R.pct(c.effortActuel, 1)} de tes revenus, au-delà du seuil de ${R.pct(c.tauxEffortMax, 0)} : aucune mensualité nouvelle n'y tient.`);
    if (p.dureeSimulation > p.dureeMaxAns * 12) alertes.push(`Durée simulée (${R.duree(p.dureeSimulation)}) au-delà de ton seuil de ${p.dureeMaxAns} ans.`);
    if (c.sousSeuil) alertes.push(`Reste à vivre de ${eur(c.resteParPersonne)} par personne, sous ton seuil de ${eur(p.resteAVivreMin)}.`);
    const annees = [...new Set([10, 15, 20, 25, p.dureeMaxAns].filter((a) => a > 0))].sort((x, y) => x - y);
    const parDuree = c.complet ? R.capaciteParDuree(p, annees) : [];
    const tableDuree = parDuree.length ? `<div class="defile"><table class="tableau"><caption class="sr-only">Montant empruntable selon la durée</caption><thead><tr><th scope="col">Durée</th><th scope="col" class="nb">Empruntable</th><th scope="col" class="nb">Intérêts</th></tr></thead><tbody>${parDuree.map((x) => { const int = x.capital ? R.mensualite(x.capital, p.tauxSimulation, x.ans * 12) * x.ans * 12 - x.capital : 0; return `<tr class="${x.ans * 12 === p.dureeSimulation ? 'actif' : ''}"><td class="duree-cel">${x.ans} ans${x.ans > p.dureeMaxAns ? ' <span class="etiquette rose">au-delà du seuil</span>' : ''}</td><td class="nb">${eur(x.capital)}</td><td class="nb">${eur(int)}</td></tr>`; }).join('')}</tbody></table></div><p class="mention">Même taux (${esc(R.pct(p.tauxSimulation))}) pour toutes les durées : en pratique, une durée plus longue se négocie souvent à un taux plus élevé. Change le taux pour le vérifier.</p>` : '';
    const lignesRev = [
      ...p.emprunteurs.map((x) => [x.nom, x.revenus + x.autres]),
      ...(p.loyers ? [[`Loyers perçus (${eur(p.loyers)} retenus à ${p.ponderationLoyers} %)`, Math.round(p.loyers * p.ponderationLoyers / 100)]] : []),
    ];
    const lignesCh = [...p.credits.map((x) => [x.nom, x.mensualite]), ...(p.autresCharges ? [['Autres charges retenues', p.autresCharges]] : [])];
    return `${tete}${tuiles}
      ${alertes.map((t) => `<p class="alerte-sc alerte">${esc(t)}</p>`).join('')}
      ${verdict}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Le calcul <span>Revenus et charges retenus</span></h2>
          <div class="bloc-detail carte-calcul">
            ${lignesRev.map(([l, v]) => `<p class="ligne-somme"><span>${esc(l)}</span><b>${eur(v)}</b></p>`).join('')}
            <p class="ligne-somme total"><span>Revenus retenus</span><b>${eur(c.revenus)}</b></p>
            <p class="ligne-somme"><span>× taux d'effort maximal</span><b>${esc(R.pct(c.tauxEffortMax, 1))}</b></p>
            ${lignesCh.map(([l, v]) => `<p class="ligne-somme"><span>− ${esc(l)}</span><b>${eur(v)}</b></p>`).join('')}
            <p class="ligne-somme total"><span>Mensualité maximale du nouveau crédit</span><b>${eur(c.mensualiteMax)}</b></p>
            <p class="ligne-somme"><span>Reste à vivre (revenus − charges − mensualité)</span><b>${eur(c.resteAVivre)}</b></p>
            <p class="ligne-somme"><span>soit par personne (${pluriel(c.personnes, 'personne')})</span><b>${eur(c.resteParPersonne)}</b></p>
          </div>
        </section>
        <section>
          <h2 class="titre-section">Selon la durée <span>Au même taux</span></h2>
          ${tableDuree || '<p class="aide">Saisis un taux de simulation pour comparer les durées.</p>'}
        </section>
      </div>
      <div class="encadre-fiscal" id="hcsf"><h2>Les seuils utilisés : ${esc(R.pct(p.tauxEffortMax, 1))} et ${p.dureeMaxAns} ans</h2><p>${esc(B.hcsf.texte)} Source : ${sourceHcsf()}. Les règles peuvent changer : vérifie-les, et modifie les seuils dans ton profil si besoin (ta banque peut aussi appliquer ses propres critères).</p></div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Projet ----------
  function vueProjet() {
    const pr = E.projet;
    const b = R.budget(pr);
    const c = R.capacite(E.profil);
    const tete = `<div class="vue-tete"><div><h1>${esc(pr.nom)}</h1><p>${esc(B.typesBien[pr.type])}${pr.usage === 'locatif' ? ', investissement locatif' : ', résidence principale'}. Le budget complet et ce qu'il reste à emprunter.</p></div>
      <div class="actions"><button class="btn primaire" data-action="projet-modifier">Modifier le projet</button></div></div>`;
    const max = Math.max(b.total, 1);
    const couleursPostes = { prix: SERIES.capital, notaire: SERIES.interets, travaux: SERIES.assurance, autres: '#7A4FB8' };
    const segs = b.postes.filter((x) => x[2] > 0);
    const barre = `<div class="barre-budget" role="img" aria-label="${esc(segs.map(([, l, v]) => `${l} : ${eur(v)}`).join(' ; '))}">${segs.map(([k, l, v]) => `<span style="--c:${couleursPostes[k]};width:${(v / max) * 100}%" title="${esc(`${l} : ${eur(v)}`)}"></span>`).join('')}</div>
      <div class="legende">${segs.map(([k, l]) => `<span><i class="cle-carre" style="--c:${couleursPostes[k]}"></i>${esc(l.replace(/ \(.*\)$/, ''))}</span>`).join('')}</div>`;
    const comparaison = c.complet && b.besoin
      ? (c.capital >= b.besoin
        ? `<p class="alerte-sc">Ta capacité (${eur(c.capital)} sur ${esc(R.duree(E.profil.dureeSimulation))}) couvre le besoin de financement, avec ${eur(c.capital - b.besoin)} de marge.</p>`
        : `<p class="alerte-sc alerte">Il manque ${eur(b.besoin - c.capital)} : ta capacité est de ${eur(c.capital)} sur ${esc(R.duree(E.profil.dureeSimulation))}. Pistes : plus d'apport, un prix plus bas, une durée plus longue dans tes seuils, un autre taux.</p>`)
      : (!c.complet ? '<p class="aide">Saisis un taux de simulation (onglet Capacité) pour comparer ton besoin à ta capacité.</p>' : '');
    const prixMax = c.complet ? Math.max(0, Math.floor((c.capital + b.apport - pr.travaux - pr.autresFrais) / (1 + (pr.notaireMode === 'saisi' ? 0 : (pr.notairePct || 0) / 100)) / 100) * 100) : null;
    return `${tete}
      <div class="tuiles">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Budget total</p><b>${eur(b.total)}</b><span>prix, frais et travaux</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Apport</p><b>${eur(b.apport)}</b><span>${esc(R.pct(b.partApport, 1))} du budget</span></div>
        <div class="tuile" style="--c:#E58C74"><p class="surtitre">À emprunter</p><b>${eur(b.besoin)}</b><span>budget − apport</span></div>
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Prix maximal</p><b>${prixMax === null ? '–' : eur(prixMax)}</b><span>avec ta capacité et cet apport</span></div>
      </div>
      ${comparaison}
      <h2 class="titre-section">Le budget <span>Poste par poste</span></h2>
      <div class="bloc-budget">${barre}
        <div class="bloc-detail">
          ${b.postes.map(([k, l, v]) => `<p class="ligne-somme"><span>${esc(l)}</span><b>${eur(v)}</b></p>`).join('')}
          <p class="ligne-somme total"><span>Budget total du projet</span><b>${eur(b.total)}</b></p>
          <p class="ligne-somme"><span>− Apport</span><b>${eur(b.apport)}</b></p>
          <p class="ligne-somme total"><span>Besoin de financement</span><b>${eur(b.besoin)}</b></p>
        </div>
      </div>
      ${b.excedentApport ? `<p class="alerte-sc">L'apport dépasse le budget de ${eur(b.excedentApport)} : aucun crédit n'est nécessaire.</p>` : ''}
      ${!b.apportCouvreFrais && b.total ? `<p class="alerte-sc">L'apport ne couvre pas les frais de notaire et autres frais (${eur(b.notaire + pr.autresFrais)}) : beaucoup de banques demandent qu'il les couvre. À vérifier avec la tienne.</p>` : ''}
      ${pr.notaireMode === 'estime' ? `<div class="encadre-fiscal"><h2>Frais de notaire estimés à ${esc(R.pct(pr.notairePct || 0, 1))} du prix</h2><p>${esc(B.notaire.texte)} Saisis le montant du notaire dès que tu l'as (Modifier le projet).</p></div>` : ''}
      <p class="mention hors-calcul">Frais de dossier, de garantie et de courtage : comptés dans chaque offre de prêt (onglet Offres), pas dans ce budget. Les frais d'agence se saisissent dans « autres frais » s'ils ne sont pas inclus dans le prix.</p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Offres ----------
  function vueOffres() {
    const c = R.comparer(E.offres, E.profil);
    const tete = `<div class="vue-tete"><div><h1>Offres de prêt</h1><p>De ${R.MIN_OFFRES} à ${R.MAX_OFFRES} offres comparées sur leur coût total : intérêts, assurance, frais de dossier, garantie et courtage. ${pluriel(E.offres.length, 'offre')} saisie${E.offres.length > 1 ? 's' : ''}.</p></div>
      <div class="actions"><button class="btn" data-action="imprimer">Imprimer</button><button class="btn primaire" data-action="offre-nouvelle" ${E.offres.length >= R.MAX_OFFRES ? 'disabled' : ''}>${ICONES.plus}Ajouter une offre</button></div></div>`;
    const incomplets = c.incomplets.length ? `<div class="a-completer"><b>${pluriel(c.incomplets.length, 'offre')} à compléter</b>${c.incomplets.map((x) => { const o = offre(x.id); return `<button class="lien-ligne" data-action="offre" data-id="${o.id}">${pastille(o)}<span><b>${esc(o.nom)}</b> : manque ${esc(x.manque.join(', '))}</span></button>`; }).join('')}</div>` : '';
    if (!c.complets.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune offre complète</h3><p>Reporte le montant, le taux, la durée et l'assurance de chaque proposition reçue.</p><div class="actions"><button class="btn primaire" data-action="${E.offres.length ? 'offre' : 'offre-nouvelle'}" data-id="${E.offres[0]?.id || ''}">Compléter une offre</button></div></div></div>${incomplets}${AVERTISSEMENT}`;
    const m = c.moinsCher, om = offre(m.id), second = c.complets[1];
    const verdict = `<div class="verdict">${pastille(om)}<div><p class="surtitre">La moins chère en coût total du crédit</p>
      <h2>${esc(om.nom)}&nbsp;: <span class="nowrap">${eur(m.coutTotal)}</span></h2>
      <p>Mensualité de ${eurC(m.mensualiteTotale)} assurance comprise sur ${esc(R.duree(m.dureeMois))}, TAEG approché ${esc(R.pct(m.taeg))}${second ? `, ${eur(second.ecart)} de moins que ${esc(offre(second.id).nom)}` : ''}.${c.memesConditions ? '' : ' <b>Attention : montants ou durées différents</b>, une offre plus courte coûte moins cher mais demande une mensualité plus forte.'}</p></div></div>`;
    const tuiles = E.offres.map((o) => {
      const x = c.tous.find((y) => y.id === o.id);
      if (!x.complet) return `<button class="tuile-sc incomplete" data-action="offre" data-id="${o.id}" style="--c:${couleur(o)}"><span class="tuile-tete">${pastille(o)}<b>${esc(o.nom)}</b></span><span class="tuile-val">À compléter</span><span class="tuile-detail">Manque ${esc(x.manque.join(', '))}</span></button>`;
      const al = R.alertes(o, x, E.profil).filter((a) => a.niveau === 'alerte');
      return `<button class="tuile-sc ${x.rang === 1 ? 'premier' : ''}" data-action="offre" data-id="${o.id}" style="--c:${couleur(o)}"><span class="tuile-tete">${pastille(o)}<b>${esc(o.nom)}</b></span>
        <span class="tuile-val">${eur(x.coutTotal)}</span>
        <span class="tuile-detail">${eurC(x.mensualiteTotale)} par mois · ${esc(R.duree(x.dureeMois))}</span>
        <span class="tuile-rang">${x.rang === 1 ? '<span class="etiquette vert">La moins chère</span>' : `<span class="etiquette sable">${x.rang}<sup>e</sup> · + ${eur(x.ecart)}</span>`}${al.length ? '<span class="etiquette rose">Au-delà d\'un seuil</span>' : ''}</span></button>`;
    }).join('');
    return `${tete}${verdict}<div class="tuiles-sc">${tuiles}</div>${incomplets}
      <h2 class="titre-section">Ce que coûte chaque offre <span>Intérêts, assurance et frais</span></h2>
      ${graphiqueCouts(c)}
      <h2 class="titre-section">Côte à côte <span>Tous les montants des offres</span></h2>
      ${tableauCote(c)}
      <h2 class="titre-section">Questions à poser à la banque <span>Coche celles qui ont reçu une réponse écrite</span></h2>
      <ul class="questions">${B.questions.map(([id, q, pourquoi]) => `<li><label class="case-q"><input type="checkbox" data-action="question" data-id="${id}" ${E.questions[id] ? 'checked' : ''}><span><b>${esc(q)}</b><small>${esc(pourquoi)}</small></span></label></li>`).join('')}</ul>
      <h2 class="titre-section">Repères <span>Comment tout est compté</span></h2>
      <ol class="conseils">${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      ${AVERTISSEMENT}`;
  }

  function tableauCote(c) {
    const cols = E.offres.map((o) => ({ o, x: c.tous.find((y) => y.id === o.id) }));
    const L = [
      ['Montant emprunté', (x) => eur(x.montant)],
      ['Taux nominal', (x, o) => R.pct(o.taux)],
      ['Durée', (x) => R.duree(x.dureeMois)],
      ['Mensualité hors assurance', (x) => eurC(x.mensualiteHors)],
      ['Assurance (1er mois)', (x, o) => `${eurC(x.assurance1)}<small>${esc(R.pct(o.tauxAssurance))} sur ${o.assuranceMode === 'crd' ? 'capital restant dû' : 'capital initial'}</small>`],
      ['Mensualité assurance comprise', (x) => `<b>${eurC(x.mensualiteTotale)}</b>`],
      ['Intérêts', (x) => eur(x.interets)],
      ['Assurance sur la durée', (x) => eur(x.assurance)],
      ['Frais de dossier', (x) => eur(x.fraisDossier)],
      ['Garantie', (x, o) => `${eur(x.garantie)}<small>${esc(B.garanties[o.garantieType])}</small>`],
      ['Courtage', (x) => eur(x.courtage)],
    ];
    const cell = (f, x, o) => (x.complet ? `<td class="nb">${f(x, o)}</td>` : '<td class="nb discret">–</td>');
    return `<div class="defile cote"><table class="tableau"><caption class="sr-only">Montants de chaque offre de prêt, coût total et TAEG approché</caption>
      <thead><tr><th scope="col">Poste</th>${cols.map(({ o }) => `<th scope="col" class="nb"><span class="th-sc">${pastille(o)}${esc(o.nom)}</span></th>`).join('')}</tr></thead>
      <tbody>${L.map(([lib, f]) => `<tr><th scope="row">${lib}</th>${cols.map(({ o, x }) => cell(f, x, o)).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">Coût total du crédit</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? eur(x.coutTotal) : 'à compléter'}</td>`).join('')}</tr>
      <tr><th scope="row">TAEG approché (estimation)</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? esc(R.pct(x.taeg)) : ''}</td>`).join('')}</tr>
      <tr><th scope="row">Taux d'effort avec cette offre</th>${cols.map(({ o, x }) => `<td class="nb ${x.complet && x.effort > E.profil.tauxEffortMax ? 'depasse' : ''}">${x.complet && x.effort !== null ? esc(R.pct(x.effort, 1)) : ''}</td>`).join('')}</tr>
      <tr><th scope="row">Total remboursé</th>${cols.map(({ x }) => `<td class="nb">${x.complet ? eur(x.totalRembourse) : ''}</td>`).join('')}</tr></tfoot></table></div>
      <p class="mention">TAEG approché : taux actuariel calculé sur le montant reçu (capital moins frais de dossier, garantie et courtage) et les mensualités assurance comprise. C'est une estimation ; seul le TAEG de l'offre de prêt fait foi. Une caution partiellement restituée en fin de prêt n'est pas déduite.</p>`;
  }

  // ---------- Graphiques ----------
  const graphes = new Map();
  function pasRond(etendue, nb = 4) {
    const brut = etendue / nb;
    const p = 10 ** Math.floor(Math.log10(Math.max(brut, 1)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= brut) || p * 10;
  }
  const kEur = (c) => { const e = c / 100; return Math.abs(e) >= 10000 ? `${String(Math.round(e / 100) / 10).replace('.', ',')} k€` : eur(c); };
  const largeurGraphe = () => Math.round(Math.min(1148, Math.max(300, document.documentElement.clientWidth - (estTel() ? 44 : 100))));
  const cleCarre = (c) => `<i class="cle-carre" style="--c:${c}"></i>`;

  // Barres horizontales empilées : coût total de chaque offre (intérêts, assurance, frais).
  function graphiqueCouts(c) {
    const L = largeurGraphe();
    const petit = L < 560;
    const lignes = c.complets.slice().sort((a, b) => offre(a.id).couleur - offre(b.id).couleur);
    const gN = petit ? 0 : 200, d = petit ? 70 : 90, hBar = 22, pasY = petit ? 58 : 44, h0 = 8;
    const H = h0 + lignes.length * pasY + 26;
    const max = Math.max(1, ...lignes.map((x) => x.coutTotal));
    const pas = pasRond(max);
    const haut = Math.ceil(max / pas) * pas;
    const xs = (v) => gN + ((L - gN - d) * v) / haut;
    const grilles = [];
    for (let v = 0; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${xs(v)}" x2="${xs(v)}" y1="${h0 - 4}" y2="${H - 22}"/><text class="axe" x="${xs(v)}" y="${H - 6}" text-anchor="${v === 0 ? 'start' : 'middle'}">${kEur(v)}</text>`);
    const parts = [['interets', 'Intérêts', SERIES.interets], ['assurance', 'Assurance', SERIES.assurance], ['frais', 'Frais (dossier, garantie, courtage)', '#7A4FB8']];
    const barres = lignes.map((x, i) => {
      const o = offre(x.id);
      const yb = h0 + i * pasY + (petit ? 20 : 0);
      let acc = 0;
      const segs = parts.map(([k, , col]) => { const v = x[k]; if (!v) return ''; const x0 = xs(acc), x1 = xs(acc + v); acc += v; return `<rect x="${x0.toFixed(1)}" y="${yb}" width="${Math.max(0, x1 - x0 - 2).toFixed(1)}" height="${hBar}" rx="3" fill="${col}"/>`; }).join('');
      const nom = petit ? `<text class="valeur" x="0" y="${yb - 6}">${esc(o.nom)}</text>` : `<text class="valeur" x="${gN - 12}" y="${yb + 15}" text-anchor="end">${esc(o.nom.length > 26 ? `${o.nom.slice(0, 25)}…` : o.nom)}</text>`;
      return `<g class="barre-offre" data-i="${i}">${nom}${segs}<text class="valeur" x="${xs(x.coutTotal) + 6}" y="${yb + 15}">${kEur(x.coutTotal)}</text><rect class="zone" x="0" y="${yb - (petit ? 20 : 10)}" width="${L}" height="${pasY}" fill="transparent"/></g>`;
    }).join('');
    graphes.set('g-couts', { type: 'barres', lignes, parts });
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">Coût total de chaque offre par poste</caption><thead><tr><th scope="col">Offre</th>${parts.map(([, l]) => `<th scope="col" class="nb">${esc(l)}</th>`).join('')}<th scope="col" class="nb">Total</th></tr></thead><tbody>${lignes.map((x) => `<tr><th scope="row">${esc(offre(x.id).nom)}</th>${parts.map(([k]) => `<td class="nb">${eur(x[k])}</td>`).join('')}<td class="nb">${eur(x.coutTotal)}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `<figure class="graphique" id="g-couts" tabindex="0" aria-label="Coût total du crédit de chaque offre, décomposé en intérêts, assurance et frais : flèches haut et bas pour lire chaque offre">
      <div class="legende">${parts.map(([, l, col]) => `<span>${cleCarre(col)}${esc(l)}</span>`).join('')}</div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Coût total du crédit par offre ; détail dans le tableau">${grilles.join('')}${barres}</svg>
      <div class="infobulle" hidden></div>
      ${table}
    </figure>`;
  }

  // Colonnes empilées par année : capital amorti, intérêts, assurance (axe unique en euros).
  function graphiqueAmortissement(annees, titre) {
    const L = largeurGraphe();
    const petit = L < 560;
    const H = petit ? 230 : 300, g = petit ? 52 : 68, d = 12, h = 14, b = 28;
    const parts = [['capital', 'Capital remboursé', SERIES.capital], ['interets', 'Intérêts', SERIES.interets], ['assurance', 'Assurance', SERIES.assurance]];
    const tot = (a) => a.capital + a.interets + a.assurance;
    const max = Math.max(1, ...annees.map(tot));
    const pas = pasRond(max);
    const haut = Math.ceil(max / pas) * pas;
    const hz = H - h - b;
    const y = (v) => h + hz - (v / haut) * hz;
    const N = annees.length;
    const slot = (L - g - d) / Math.max(1, N);
    const lb = Math.max(3, Math.min(24, slot - 2));
    const grilles = [];
    for (let v = 0; v <= haut + 1; v += pas) grilles.push(`<line class="${v === 0 ? 'base' : 'grille'}" x1="${g}" x2="${L - d}" y1="${y(v)}" y2="${y(v)}"/><text class="axe" x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${kEur(v)}</text>`);
    const cols = annees.map((a, i) => {
      const cx = g + slot * i + (slot - lb) / 2;
      let acc = 0;
      const segs = parts.map(([k, , col]) => { const v = a[k]; if (!v) return ''; const y0 = y(acc), y1 = y(acc + v); acc += v; return `<rect x="${cx.toFixed(1)}" y="${(y1 + 1).toFixed(1)}" width="${lb.toFixed(1)}" height="${Math.max(0, y0 - y1 - 2).toFixed(1)}" rx="${lb > 8 ? 2 : 1}" fill="${col}"/>`; }).join('');
      return `<g>${segs}${a.anticipe ? `<circle cx="${(cx + lb / 2).toFixed(1)}" cy="${y(acc) - 10}" r="4.5" class="pt" fill="var(--encre)"/>` : ''}</g>`;
    }).join('');
    const place = petit ? 34 : 40;
    const axeX = [];
    let dernier = -Infinity;
    annees.forEach((a, i) => { const cx = g + slot * i + slot / 2; if ((a.annee === 1 || a.annee % 5 === 0 || i === N - 1) && cx - dernier >= place) { axeX.push(`<text class="axe" x="${cx}" y="${H - 8}" text-anchor="middle">${a.annee === 1 ? 'An 1' : a.annee}</text>`); dernier = cx; } });
    graphes.set('g-amort', { type: 'colonnes', annees, parts, g, slot, L });
    const table = `<details class="donnees-graphique"><summary>Voir les données du graphique</summary><div class="defile"><table class="tableau"><caption class="sr-only">Capital, intérêts et assurance payés chaque année</caption><thead><tr><th scope="col">Année</th>${parts.map(([, l]) => `<th scope="col" class="nb">${esc(l)}</th>`).join('')}<th scope="col" class="nb">Capital restant dû</th></tr></thead><tbody>${annees.map((a) => `<tr><th scope="row">${a.annee}</th>${parts.map(([k]) => `<td class="nb">${eur(a[k])}</td>`).join('')}<td class="nb">${eur(a.crd)}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `<figure class="graphique" id="g-amort" tabindex="0" aria-label="${esc(titre)} : flèches gauche et droite pour lire chaque année">
      <div class="legende">${parts.map(([, l, col]) => `<span>${cleCarre(col)}${esc(l)}</span>`).join('')}${annees.some((a) => a.anticipe) ? '<span><i class="cle-rond"></i>Remboursement anticipé</span>' : ''}</div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(titre)} ; détail dans le tableau">${grilles.join('')}${cols}${axeX.join('')}<rect class="zone-survol" x="${g}" y="0" width="${L - g - d}" height="${H - b}"/></svg>
      <div class="infobulle" hidden></div>
      <figcaption class="note">Au début du prêt, les intérêts pèsent lourd ; ils baissent à mesure que le capital est remboursé.</figcaption>
      ${table}
    </figure>`;
  }

  function brancherGraphiques() {
    for (const [id, G] of graphes) {
      const fig = document.getElementById(id);
      if (!fig) continue;
      const svg = fig.querySelector('svg[role=img]');
      const bulle = fig.querySelector('.infobulle');
      let courant = -1;
      const placer = (px, py) => {
        const rs = svg.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let gx = px - rf.left + 14;
        if (gx + bulle.offsetWidth > rf.width - 8) gx = px - rf.left - bulle.offsetWidth - 14;
        bulle.style.left = `${Math.max(8, gx)}px`;
        bulle.style.top = `${Math.max(8, Math.min(rs.bottom - rf.top - bulle.offsetHeight, py - rf.top - 20))}px`;
      };
      const ligne = (col, val, nom) => { const l = document.createElement('div'); l.className = 'ligne-bulle'; const k = document.createElement('i'); k.style.background = col; l.appendChild(k); const v = document.createElement('strong'); v.textContent = val; l.appendChild(v); const n = document.createElement('span'); n.textContent = nom; l.appendChild(n); bulle.appendChild(l); };
      const cacher = () => { bulle.hidden = true; courant = -1; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      if (G.type === 'barres') {
        const montrer = (i, ev) => {
          i = Math.max(0, Math.min(G.lignes.length - 1, i)); courant = i;
          const x = G.lignes[i];
          fig.querySelectorAll('.barre-offre').forEach((el) => el.classList.toggle('survol', Number(el.dataset.i) === i));
          bulle.textContent = '';
          const t = document.createElement('b'); t.textContent = offre(x.id).nom; bulle.appendChild(t);
          for (const [k, l, col] of G.parts) ligne(col, eur(x[k]), l);
          const tt = document.createElement('div'); tt.className = 'ligne-bulle'; tt.textContent = `Total : ${eur(x.coutTotal)}`; bulle.appendChild(tt);
          bulle.hidden = false;
          const el = fig.querySelector(`.barre-offre[data-i="${i}"] .zone`).getBoundingClientRect();
          placer(ev?.clientX ?? (svg.getBoundingClientRect().left + svg.getBoundingClientRect().width / 2), el.top + el.height / 2);
        };
        fig.querySelectorAll('.barre-offre').forEach((el) => { el.addEventListener('pointermove', (e) => montrer(Number(el.dataset.i), e)); el.addEventListener('pointerdown', (e) => montrer(Number(el.dataset.i), e)); });
        fig.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); montrer(courant < 0 ? 0 : courant + (e.key === 'ArrowDown' ? 1 : -1)); }
          if (e.key === 'Escape') cacher();
        });
      } else {
        const versIndex = (e) => { const rs = svg.getBoundingClientRect(); const vx = ((e.clientX - rs.left) / rs.width) * G.L; return Math.max(0, Math.min(G.annees.length - 1, Math.floor((vx - G.g) / G.slot))); };
        const montrer = (i, ev) => {
          i = Math.max(0, Math.min(G.annees.length - 1, i)); courant = i;
          const a = G.annees[i];
          bulle.textContent = '';
          const t = document.createElement('b'); t.textContent = `Année ${a.annee}`; bulle.appendChild(t);
          for (const [k, l, col] of G.parts) ligne(col, eur(a[k]), l);
          if (a.anticipe) { const x = document.createElement('div'); x.className = 'ligne-bulle'; x.textContent = `Remboursement anticipé : ${eur(a.anticipe)}`; bulle.appendChild(x); }
          const x2 = document.createElement('div'); x2.className = 'ligne-bulle'; x2.textContent = `Reste dû en fin d'année : ${eur(a.crd)}`; bulle.appendChild(x2);
          bulle.hidden = false;
          const rs = svg.getBoundingClientRect();
          const px = rs.left + ((G.g + G.slot * (i + 0.5)) / G.L) * rs.width;
          placer(ev?.clientX ?? px, rs.top + 30);
        };
        const zone = fig.querySelector('.zone-survol');
        zone.addEventListener('pointermove', (e) => montrer(versIndex(e), e));
        zone.addEventListener('pointerdown', (e) => montrer(versIndex(e), e));
        fig.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); montrer(courant < 0 ? 0 : courant + (e.key === 'ArrowRight' ? 1 : -1)); }
          if (e.key === 'Escape') cacher();
        });
      }
      fig.addEventListener('pointerleave', cacher);
      fig.addEventListener('blur', cacher);
    }
  }

  // ---------- Amortissement et remboursement anticipé ----------
  function vueAmortissement() {
    const a = E.anticipe;
    const completes = E.offres.filter((o) => !R.manques(o).length);
    const tete = `<div class="vue-tete"><div><h1>Tableau d'amortissement</h1><p>Mois par mois : intérêts, capital remboursé, assurance et capital restant dû. Puis l'effet d'un remboursement anticipé.</p></div>
      <div class="actions"><button class="btn" data-action="csv">Exporter en CSV</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>`;
    if (!completes.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune offre complète</h3><p>Complète au moins une offre (montant, taux, durée, assurance) pour voir son tableau d'amortissement.</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="offres">Aller aux offres</button></div></div></div>${AVERTISSEMENT}`;
    if (!completes.some((o) => o.id === a.offreId)) a.offreId = completes[0].id;
    const o = offre(a.offreId);
    const x = R.calculerOffre(o, E.profil);
    const e = R.echeancier(o);
    const annees = R.parAnnee(e.lignes);
    const choix = `<div class="projets" role="group" aria-label="Offre affichée">${completes.map((y) => `<button class="filtre" data-action="choisir-offre" data-id="${y.id}" aria-pressed="${y.id === o.id}">${pastille(y)} ${esc(y.nom)}</button>`).join('')}</div>`;
    const resume = `<div class="resume-facture quatre">
      <div><span>Mensualité</span><b>${eurC(x.mensualiteTotale)}</b><small>dont ${eurC(x.assurance1)} d'assurance</small></div>
      <div><span>Intérêts</span><b>${eur(x.interets)}</b><small>sur ${esc(R.duree(o.dureeMois))}</small></div>
      <div><span>Assurance</span><b>${eur(x.assurance)}</b><small>${esc(R.pct(o.tauxAssurance))} sur ${o.assuranceMode === 'crd' ? 'capital restant dû' : 'capital initial'}</small></div>
      <div><span>Coût total</span><b>${eur(x.coutTotal)}</b><small>frais compris · TAEG ≈ ${esc(R.pct(x.taeg))}</small></div>
    </div>`;
    const lignesTable = detailMensuel
      ? e.lignes.map((l) => `<tr><th scope="row">${l.mois}</th><td class="nb">${eurC(l.interets)}</td><td class="nb">${eurC(l.capital)}</td><td class="nb">${eurC(l.assurance)}</td><td class="nb">${eurC(l.total)}</td><td class="nb">${eurC(l.crd)}</td></tr>`).join('')
      : annees.map((y) => `<tr><th scope="row">Année ${y.annee}</th><td class="nb">${eur(y.interets)}</td><td class="nb">${eur(y.capital)}</td><td class="nb">${eur(y.assurance)}</td><td class="nb">${eur(y.interets + y.capital + y.assurance)}</td><td class="nb">${eur(y.crd)}</td></tr>`).join('');
    const table = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Détail du tableau"><button class="filtre" data-action="detail-tableau" data-mode="an" aria-pressed="${!detailMensuel}">Par année</button><button class="filtre" data-action="detail-tableau" data-mode="mois" aria-pressed="${detailMensuel}">Par mois</button></div></div>
      <div class="defile tableau-amort"><table class="tableau"><caption class="sr-only">Tableau d'amortissement de l'offre ${esc(o.nom)}</caption><thead><tr><th scope="col">${detailMensuel ? 'Mois' : 'Période'}</th><th scope="col" class="nb">Intérêts</th><th scope="col" class="nb">Capital</th><th scope="col" class="nb">Assurance</th><th scope="col" class="nb">Total payé</th><th scope="col" class="nb">Restant dû</th></tr></thead><tbody>${lignesTable}</tbody>
      <tfoot><tr><th scope="row">Total</th><td class="nb">${eur(e.totaux.interets)}</td><td class="nb">${eur(e.totaux.capital)}</td><td class="nb">${eur(e.totaux.assurance)}</td><td class="nb">${eur(e.totaux.interets + e.totaux.capital + e.totaux.assurance)}</td><td class="nb"></td></tr></tfoot></table></div>`;
    return `${tete}${choix}<h2 class="titre-section imprime-seul">${esc(o.nom)} <span>${eur(o.montant)} à ${esc(R.pct(o.taux))} sur ${esc(R.duree(o.dureeMois))}</span></h2>${resume}
      <h2 class="titre-section">Capital et intérêts, année par année <span>${esc(o.nom)}</span></h2>
      ${graphiqueAmortissement(annees, `Capital, intérêts et assurance payés chaque année pour ${o.nom}`)}
      <h2 class="titre-section">Le tableau <span>${detailMensuel ? `${e.lignes.length} mensualités` : `${annees.length} années`}</span></h2>
      ${table}
      <section class="bloc-anticipe" id="anticipe">${blocAnticipe(o)}</section>
      ${AVERTISSEMENT}`;
  }

  function blocAnticipe(o) {
    const a = E.anticipe;
    const ira = a.ira;
    const r = R.remboursementAnticipe(o, a);
    const res = !r || !r.valide
      ? `<p class="aide">Choisis un mois entre 1 et ${o.dureeMois - 1} et un montant.</p>`
      : `<div class="resume-facture quatre">
          <div><span>Économie d'intérêts</span><b>${eur(r.ecoInterets)}</b><small>${r.ecoAssurance ? `+ ${eur(r.ecoAssurance)} d'assurance` : 'assurance inchangée'}</small></div>
          <div><span>Indemnités</span><b>${eur(r.ira)}</b><small>${ira.mode === 'plafond' ? 'au plafond légal' : ira.mode === 'aucune' ? 'aucune' : 'montant saisi'}</small></div>
          <div><span>Gain net</span><b class="${r.gainNet >= 0 ? 'positif' : 'depasse'}">${eur(r.gainNet)}</b><small>économies − indemnités</small></div>
          <div><span>${r.solde ? 'Prêt soldé' : a.mode === 'duree' ? 'Durée gagnée' : 'Nouvelle mensualité'}</span><b>${r.solde ? `au mois ${a.mois}` : a.mode === 'duree' ? esc(R.duree(r.moisGagnes)) : eurC(r.nouvelleMensualite)}</b><small>${r.solde ? 'capital restant dû versé' : a.mode === 'duree' ? `fin après ${esc(R.duree(r.apres.dureeMois))}` : `au lieu de ${eurC(r.ancienneMensualite)} hors assurance`}</small></div>
        </div>
        <p class="mention">Capital restant dû avant le versement : ${eur(r.crdAvant)}. ${o.assuranceMode === 'initial' ? 'Assurance sur le capital initial : la cotisation reste en général la même ; elle n\'est comptée ici que jusqu\'à la fin du prêt raccourci.' : 'Assurance sur le capital restant dû : elle baisse avec le capital.'}</p>`;
    return `<h2 class="titre-section">Remboursement anticipé <span>Effet d'un versement exceptionnel sur ${esc(o.nom)}</span></h2>
      <form class="form-anticipe" id="form-anticipe" novalidate>
        <div class="rang-champs">
          <label class="champ">Après le mois n° <small>De 1 à ${o.dureeMois - 1} (année ${Math.ceil(a.mois / 12)}).</small><input name="mois" inputmode="numeric" value="${a.mois}"></label>
          <label class="champ">Montant versé (€)<input name="montant" inputmode="decimal" value="${esc(R.saisieMontant(a.montant))}"></label>
        </div>
        <fieldset class="champ"><legend>Ensuite</legend><div class="choix-statut deux">${[['duree', 'Même mensualité, durée plus courte'], ['mensualite', 'Même durée, mensualité plus basse']].map(([k, l]) => `<label><input type="radio" name="mode" value="${k}" ${a.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <fieldset class="champ"><legend>Indemnités de remboursement anticipé</legend><div class="choix-statut">${[['plafond', 'Plafond légal'], ['saisi', 'Montant de l\'offre'], ['aucune', 'Aucune']].map(([k, l]) => `<label><input type="radio" name="iraMode" value="${k}" ${ira.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <div class="rang-champs" ${ira.mode === 'plafond' ? '' : 'hidden'} data-ira="plafond">
          <label class="champ">Mois d'intérêts au plus<input name="moisInterets" inputmode="numeric" value="${ira.moisInterets}"></label>
          <label class="champ">% du capital restant dû au plus<input name="pctCrd" inputmode="decimal" value="${esc(R.saisieTaux(ira.pctCrd))}"></label>
        </div>
        <div class="rang-champs" ${ira.mode === 'saisi' ? '' : 'hidden'} data-ira="saisi"><label class="champ">Indemnités prévues (€)<input name="iraMontant" inputmode="decimal" value="${esc(R.saisieMontant(ira.montant))}"></label></div>
        <p class="erreur" role="alert"></p>
      </form>
      <div id="resultat-anticipe" aria-live="polite">${res}</div>
      <p class="mention">Plafond légal : ${esc(B.ira.texte)} Source : <a href="${esc(B.ira.url)}" target="_blank" rel="noopener">${esc(B.ira.source)}</a>, lu le ${esc(B.ira.verifie)} ; valeurs modifiables ci-dessus.</p>`;
  }

  function brancherAnticipe() {
    const f = $('#form-anticipe');
    if (!f) return;
    let attente = null;
    f.addEventListener('submit', (e) => e.preventDefault());
    f.addEventListener('input', () => {
      const fd = new FormData(f);
      const a = E.anticipe;
      const err = f.querySelector('.erreur');
      const o = offre(a.offreId);
      const mois = R.lireEntier(fd.get('mois'), 1, Math.max(1, o.dureeMois - 1));
      const montant = R.lireMontant(fd.get('montant'));
      const iraMode = fd.get('iraMode');
      f.querySelector('[data-ira="plafond"]').hidden = iraMode !== 'plafond';
      f.querySelector('[data-ira="saisi"]').hidden = iraMode !== 'saisi';
      if (mois === null) { err.textContent = `Mois : de 1 à ${o.dureeMois - 1}.`; return; }
      if (!(montant > 0)) { err.textContent = 'Montant illisible : écris par exemple 10 000.'; return; }
      const moisInterets = R.lireEntier(fd.get('moisInterets'), 0, 24);
      const pctCrd = R.lireTaux(fd.get('pctCrd'));
      const iraMontant = String(fd.get('iraMontant') || '').trim() ? R.lireMontant(fd.get('iraMontant')) : 0;
      if (moisInterets === null || pctCrd === null || iraMontant === null) { err.textContent = 'Indemnités illisibles.'; return; }
      err.textContent = '';
      Object.assign(a, { mois, montant, mode: fd.get('mode') === 'mensualite' ? 'mensualite' : 'duree' });
      Object.assign(a.ira, { mode: iraMode, moisInterets, pctCrd, montant: iraMontant });
      const tmp = document.createElement('div');
      tmp.innerHTML = blocAnticipe(o);
      $('#resultat-anticipe').innerHTML = tmp.querySelector('#resultat-anticipe').innerHTML;
      clearTimeout(attente);
      attente = setTimeout(sauver, 400);
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
  const champE = (nom, lib, v, aide = '', ph = '0') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" autocomplete="off" value="${esc(R.saisieMontant(v))}" placeholder="${esc(ph)}"></label>`;
  const champT = (nom, lib, v, aide = '', ph = '') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input name="${nom}" inputmode="decimal" autocomplete="off" value="${esc(R.saisieTaux(v))}" placeholder="${esc(ph)}"></label>`;
  // Lecteurs de formulaire : lèvent une erreur au message clair.
  const montantDe = (fd, nom, lib) => { const v = String(fd.get(nom) ?? '').trim(); if (!v) return 0; const m = R.lireMontant(v); if (m === null) throw new Error(`${lib} illisible : écris par exemple 1 250 ou 299,90.`); return m; };
  const tauxDe = (fd, nom, lib, vide = null) => { const v = String(fd.get(nom) ?? '').trim(); if (!v) return vide; const t = R.lireTaux(v); if (t === null) throw new Error(`${lib} illisible : écris par exemple 3,45.`); return t; };

  function modaleProfil() {
    const p = E.profil;
    const emp = [...p.emprunteurs];
    if (emp.length < 2) emp.push({ nom: 'Emprunteur 2', revenus: 0, autres: 0, absent: true });
    const credits = [...p.credits, { nom: '', mensualite: 0, vide: true }, ...(p.credits.length ? [] : [{ nom: '', mensualite: 0, vide: true }])];
    const corps = `
      <fieldset class="champ"><legend>Emprunteurs</legend><div class="choix-statut deux">${[['1', 'Seul(e)'], ['2', 'À deux']].map(([k, l]) => `<label><input type="radio" name="nb" value="${k}" ${String(p.emprunteurs.length) === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      ${emp.map((x, i) => `<fieldset class="champ cadre-champs" data-emp="${i}" ${i === 1 && p.emprunteurs.length < 2 ? 'hidden' : ''}><legend>${i === 0 ? 'Premier emprunteur' : 'Co-emprunteur'} <small>Revenus nets mensuels avant impôt, primes lissées sur 12 mois.</small></legend>
        <label class="champ">Prénom ou libellé<input name="nom${i}" maxlength="40" value="${esc(x.nom)}"></label>
        <div class="rang-champs">${champE(`rev${i}`, 'Salaire ou revenu net (€)', x.revenus)}${champE(`aut${i}`, 'Autres revenus réguliers (€)', x.autres, 'Pension reçue, allocations retenues par ta banque…')}</div></fieldset>`).join('')}
      <fieldset class="champ cadre-champs"><legend>Investissement locatif <small>Loyers déjà perçus ou attendus ; les banques n'en retiennent souvent qu'une partie.</small></legend>
        <div class="rang-champs">${champE('loyers', 'Loyers mensuels (€)', p.loyers)}<label class="champ">Part retenue (%) <small>Hypothèse : à demander à ta banque.</small><input name="ponderation" inputmode="numeric" value="${p.ponderationLoyers}"></label></div></fieldset>
      <fieldset class="champ cadre-champs"><legend>Crédits en cours <small>Ceux qui continueront après l'achat (auto, consommation, autre immobilier).</small></legend>
        ${credits.map((c, i) => `<div class="rang-champs"><label class="champ">Crédit<input name="cnom${i}" maxlength="60" value="${esc(c.nom)}" placeholder="Ex. : crédit auto"></label>${champE(`cmen${i}`, 'Mensualité (€)', c.mensualite || null)}</div>`).join('')}
        ${champE('autresCharges', 'Autres charges retenues (€ par mois)', p.autresCharges, 'Pension versée, loyer conservé… comptées dans le taux d\'effort.')}</fieldset>
      <fieldset class="champ cadre-champs"><legend>Seuils <small>Valeurs de départ : norme du HCSF (${esc(R.pct(B.hcsf.tauxEffort, 0))}, ${B.hcsf.dureeAns} ans), source : ${sourceHcsf()}. Modifie-les si ta banque applique d'autres critères.</small></legend>
        <div class="rang-champs">${champT('tauxEffortMax', 'Taux d\'effort maximal (%)', p.tauxEffortMax)}<label class="champ">Durée maximale (ans)<input name="dureeMaxAns" inputmode="numeric" value="${p.dureeMaxAns}"></label></div>
        <div class="rang-champs"><label class="champ">Personnes au foyer<input name="personnes" inputmode="numeric" value="${p.personnes}"></label>${champE('resteAVivreMin', 'Reste à vivre minimal par personne (€)', p.resteAVivreMin || null, 'Facultatif : ton propre repère.')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Mon profil', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      try {
        const nb = fd.get('nb') === '2' ? 2 : 1;
        const emprunteurs = [];
        for (let i = 0; i < nb; i++) emprunteurs.push({ nom: String(fd.get(`nom${i}`) || '').trim(), revenus: montantDe(fd, `rev${i}`, 'Revenu'), autres: montantDe(fd, `aut${i}`, 'Autres revenus') });
        const cr = [];
        for (let i = 0; i < credits.length; i++) { const m = montantDe(fd, `cmen${i}`, 'Mensualité'); const n = String(fd.get(`cnom${i}`) || '').trim(); if (m > 0) cr.push({ nom: n || 'Crédit en cours', mensualite: m }); }
        const pond = R.lireEntier(fd.get('ponderation'), 0, 100); if (pond === null) throw new Error('Part retenue des loyers : de 0 à 100 %.');
        const tem = tauxDe(fd, 'tauxEffortMax', 'Taux d\'effort'); if (!(tem > 0)) throw new Error('Indique un taux d\'effort maximal, par exemple 35.');
        const dma = R.lireEntier(fd.get('dureeMaxAns'), 1, R.DUREE_MAX_ANS); if (dma === null) throw new Error(`Durée maximale : de 1 à ${R.DUREE_MAX_ANS} ans.`);
        const pers = R.lireEntier(fd.get('personnes'), 1, 12); if (pers === null) throw new Error('Personnes au foyer : de 1 à 12.');
        retenir();
        E.profil = R.normaliserProfil({ ...p, emprunteurs, credits: cr, loyers: montantDe(fd, 'loyers', 'Loyers'), ponderationLoyers: pond, autresCharges: montantDe(fd, 'autresCharges', 'Autres charges'), tauxEffortMax: tem, dureeMaxAns: dma, personnes: pers, resteAVivreMin: montantDe(fd, 'resteAVivreMin', 'Reste à vivre') }, B.hcsf);
        sauver(); rendre(); toast('Profil enregistré : ta capacité est recalculée.', { libelle: 'Annuler', faire: annuler });
      } catch (x) { return x.message; }
    });
    modale().querySelectorAll('input[name=nb]').forEach((r) => r.addEventListener('change', () => { modale().querySelector('[data-emp="1"]').hidden = modale().querySelector('input[name=nb]:checked').value !== '2'; }));
  }

  function modaleConditions() {
    const p = E.profil;
    const corps = `<p class="mention">Les conditions d'une simulation de ta banque, ou d'une offre reçue : aucun taux du marché n'est intégré.</p>
      <div class="rang-champs">${champT('taux', 'Taux nominal annuel (%)', p.tauxSimulation, 'Hors assurance.', 'Ex. : 3,4')}<label class="champ">Durée (ans) <small>Ton seuil : ${p.dureeMaxAns} ans.</small><input name="ans" inputmode="numeric" value="${Math.round(p.dureeSimulation / 12)}"></label></div>
      <div class="rang-champs">${champT('assurance', 'Taux d\'assurance annuel (%)', p.assuranceSimulation, 'Du capital emprunté, par an ; 0 si inconnu.', 'Ex. : 0,30')}<label class="champ">Quotité totale (%) <small>100 seul, 100 à 200 à deux.</small><input name="quotite" inputmode="numeric" value="${p.quotite}"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Taux et durée', corps, '<button class="btn primaire" value="ok">Calculer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      try {
        const taux = tauxDe(fd, 'taux', 'Taux');
        const ans = R.lireEntier(fd.get('ans'), 1, R.DUREE_MAX_ANS); if (ans === null) throw new Error(`Durée : de 1 à ${R.DUREE_MAX_ANS} ans.`);
        const ass = tauxDe(fd, 'assurance', 'Taux d\'assurance', 0);
        const q = R.lireEntier(fd.get('quotite'), 0, 200); if (q === null) throw new Error('Quotité : de 0 à 200 %.');
        retenir();
        Object.assign(E.profil, { tauxSimulation: taux, dureeSimulation: ans * 12, assuranceSimulation: ass, quotite: q });
        sauver(); rendre(); toast('Conditions enregistrées.', { libelle: 'Annuler', faire: annuler });
      } catch (x) { return x.message; }
    });
  }

  function modaleProjet() {
    const pr = E.projet;
    const corps = `
      <div class="rang-champs"><label class="champ">Nom du projet<input name="nom" maxlength="60" value="${esc(pr.nom)}"></label>
        <label class="champ">Usage<select name="usage"><option value="residence" ${pr.usage === 'residence' ? 'selected' : ''}>Résidence principale</option><option value="locatif" ${pr.usage === 'locatif' ? 'selected' : ''}>Investissement locatif</option></select></label></div>
      <div class="rang-champs"><label class="champ">Type de bien<select name="type">${Object.entries(B.typesBien).map(([k, l]) => `<option value="${k}" ${pr.type === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>${champE('prix', 'Prix du bien (€)', pr.prix, 'Frais d\'agence inclus s\'ils sont à ta charge et dans l\'annonce.')}</div>
      <fieldset class="champ cadre-champs"><legend>Frais de notaire</legend>
        <div class="choix-statut deux">${[['estime', 'Estimés (hypothèse)'], ['saisi', 'Montant du notaire']].map(([k, l]) => `<label><input type="radio" name="notaireMode" value="${k}" ${pr.notaireMode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <div class="rang-champs">${champT('notairePct', '% du prix (hypothèse)', pr.notairePct, `Proposé : ${B.notaire.ancien} % ancien, ${B.notaire.neuf} % neuf.`)}${champE('notaireMontant', 'Montant saisi (€)', pr.notaireMontant || null)}</div>
        <p class="mention">${esc(B.notaire.texte)}</p></fieldset>
      <div class="rang-champs">${champE('travaux', 'Travaux (€)', pr.travaux)}${champE('autresFrais', 'Autres frais (€)', pr.autresFrais, 'Agence si en plus, mobilier, déménagement…')}</div>
      ${champE('apport', 'Apport personnel (€)', pr.apport, 'Épargne mise dans le projet.')}
      <label class="case"><input type="checkbox" name="majOffres"> Mettre le nouveau besoin de financement comme montant de toutes les offres</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Le projet', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      try {
        const type = String(fd.get('type'));
        const notaireMode = fd.get('notaireMode') === 'saisi' ? 'saisi' : 'estime';
        const notairePct = tauxDe(fd, 'notairePct', 'Pourcentage', null);
        if (notaireMode === 'estime' && notairePct === null) throw new Error('Indique le pourcentage estimé des frais de notaire, par exemple 8.');
        const nouveau = R.normaliserProjet({ nom: String(fd.get('nom') || '').trim(), usage: fd.get('usage'), type, prix: montantDe(fd, 'prix', 'Prix'), notaireMode, notairePct, notaireMontant: montantDe(fd, 'notaireMontant', 'Frais de notaire'), travaux: montantDe(fd, 'travaux', 'Travaux'), autresFrais: montantDe(fd, 'autresFrais', 'Autres frais'), apport: montantDe(fd, 'apport', 'Apport') }, B.notaire);
        if (notaireMode === 'saisi' && !nouveau.notaireMontant) throw new Error('Saisis le montant donné par le notaire, ou choisis « Estimés ».');
        retenir();
        E.projet = nouveau;
        if (fd.get('majOffres')) { const bs = R.budget(nouveau).besoin; E.offres.forEach((o) => { o.montant = bs || null; }); }
        sauver(); rendre(); toast(`Projet enregistré : ${eur(R.budget(nouveau).besoin)} à emprunter.`, { libelle: 'Annuler', faire: annuler });
      } catch (x) { return x.message; }
    });
  }

  function corpsOffre(o) {
    const besoin = R.budget(E.projet).besoin;
    return `
      <label class="champ">Nom de l'offre <small>Ex. : « Banque du quartier », « Via courtier ».</small><input name="nom" maxlength="60" value="${esc(o.nom)}" required></label>
      <div class="rang-champs">${champE('montant', 'Montant emprunté (€)', o.montant, besoin ? `Ton besoin : ${eur(besoin)}.` : '', besoin ? R.saisieMontant(besoin) : '')}<label class="champ">Durée (ans)<input name="ans" inputmode="numeric" value="${o.dureeMois ? Math.round(o.dureeMois / 12) : ''}" placeholder="Ex. : 25"></label></div>
      <div class="rang-champs">${champT('taux', 'Taux nominal (%)', o.taux, 'Taux du crédit, hors assurance.', 'Ex. : 3,45')}${champT('tauxAssurance', 'Taux d\'assurance (%)', o.tauxAssurance, 'Annuel ; 0 si aucune.', 'Ex. : 0,30')}</div>
      <fieldset class="champ"><legend>L'assurance est calculée sur</legend><div class="choix-statut deux">${[['initial', 'Le capital initial'], ['crd', 'Le capital restant dû']].map(([k, l]) => `<label><input type="radio" name="assuranceMode" value="${k}" ${o.assuranceMode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs"><label class="champ">Quotité totale (%) <small>100 seul ; à deux, de 100 à 200.</small><input name="quotite" inputmode="numeric" value="${o.quotite}"></label>${champE('fraisDossier', 'Frais de dossier (€)', o.fraisDossier)}</div>
      <div class="rang-champs"><label class="champ">Garantie<select name="garantieType">${Object.entries(B.garanties).map(([k, l]) => `<option value="${k}" ${o.garantieType === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>${champE('garantie', 'Coût de la garantie (€)', o.garantie, 'Montant indiqué dans l\'offre.')}</div>
      ${champE('courtage', 'Frais de courtage (€)', o.courtage, 'Si tu passes par un courtier.')}
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(o.note)}"></label>
      <p class="apercu" id="apercu" aria-live="polite"></p><p class="erreur" role="alert"></p>`;
  }
  function lireOffre(fd, base) {
    try {
      const ans = String(fd.get('ans') || '').trim();
      const dureeMois = ans ? R.lireEntier(ans, 1, R.DUREE_MAX_ANS) : 0;
      if (dureeMois === null) throw new Error(`Durée : de 1 à ${R.DUREE_MAX_ANS} ans.`);
      const quotite = R.lireEntier(fd.get('quotite'), 0, 200);
      if (quotite === null) throw new Error('Quotité : de 0 à 200 %.');
      const o = { ...base, nom: String(fd.get('nom') || '').trim() || base.nom, montant: String(fd.get('montant') || '').trim() ? montantDe(fd, 'montant', 'Montant') : null, dureeMois: dureeMois * 12, taux: tauxDe(fd, 'taux', 'Taux'), tauxAssurance: tauxDe(fd, 'tauxAssurance', 'Taux d\'assurance'), assuranceMode: fd.get('assuranceMode'), quotite, fraisDossier: montantDe(fd, 'fraisDossier', 'Frais de dossier'), garantieType: fd.get('garantieType'), garantie: montantDe(fd, 'garantie', 'Garantie'), courtage: montantDe(fd, 'courtage', 'Courtage'), note: String(fd.get('note') || '').trim() };
      return { o: R.normaliserOffre(o, 0, []) };
    } catch (x) { return x.message; }
  }

  function modaleOffre(id) {
    const existant = id ? offre(id) : null;
    if (id && !existant) return;
    if (!existant && E.offres.length >= R.MAX_OFFRES) { toast(`${R.MAX_OFFRES} offres au plus : retire celle qui ne tient plus.`); return; }
    const o = existant || R.offreDefaut(E, E.offres.map((x) => x.couleur));
    const pied = existant
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" type="button" data-action="offre-dupliquer" data-id="${o.id}">Dupliquer</button><button class="btn danger" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(existant ? esc(o.nom) : 'Nouvelle offre de prêt', corpsOffre(o), pied, (fd, action) => {
      if (action === 'supprimer') {
        if (E.offres.length <= R.MIN_OFFRES) { toast(`Garde au moins ${R.MIN_OFFRES} offres : modifie plutôt celle-ci.`); garderOuverte(); return; }
        if (!confirm(`Supprimer l'offre « ${o.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        E.offres = E.offres.filter((x) => x.id !== o.id);
        sauver(); rendre(); toast(`Offre « ${o.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const r = lireOffre(fd, o);
      if (typeof r === 'string') return r;
      retenir();
      if (existant) Object.assign(existant, r.o); else E.offres.push(r.o);
      sauver(); rendre();
      const x = R.calculerOffre(r.o, E.profil);
      toast(x.complet ? `« ${r.o.nom} » : ${eur(x.coutTotal)} de coût total, ${eurC(x.mensualiteTotale)} par mois.` : `« ${r.o.nom} » enregistrée, à compléter : ${x.manque.join(', ')}.`, { libelle: 'Annuler', faire: annuler });
    });
    const f = modale().querySelector('form');
    const apercu = () => {
      const r = lireOffre(new FormData(f), o);
      const el = $('#apercu');
      if (!el) return;
      if (typeof r === 'string') { el.textContent = ''; return; }
      const x = R.calculerOffre(r.o, E.profil);
      el.innerHTML = x.complet
        ? `Mensualité <b>${eurC(x.mensualiteTotale)}</b> assurance comprise · coût total <b>${eur(x.coutTotal)}</b> · TAEG ≈ ${esc(R.pct(x.taeg))}${x.effort !== null ? ` · taux d'effort ${esc(R.pct(x.effort, 1))}` : ''}`
        : `À compléter : ${esc(x.manque.join(', '))}.`;
    };
    f.addEventListener('input', apercu);
    apercu();
  }

  function dupliquerOffre(id) {
    const o = offre(id);
    if (!o) return;
    if (E.offres.length >= R.MAX_OFFRES) { toast(`${R.MAX_OFFRES} offres au plus.`); return; }
    retenir();
    const copie = R.normaliserOffre({ ...structuredClone(o), id: R.nouvelId(), couleur: null, nom: `${o.nom} (copie)`.slice(0, 60) }, E.offres.length, E.offres.map((x) => x.couleur));
    E.offres.splice(E.offres.indexOf(o) + 1, 0, copie);
    sauver(); rendre();
    modaleOffre(copie.id);
    toast('Offre dupliquée : change ce qui diffère (durée, assurance…).', { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Le comparatif des offres et le tableau d'amortissement de l'offre affichée, en tableur (CSV), ou la page en cours à l'impression (ou en PDF depuis le navigateur).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-offres">Comparatif en CSV</button><button class="btn petit" type="button" data-action="csv">Amortissement en CSV</button><button class="btn petit" type="button" data-action="imprimer">Imprimer</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ta simulation est enregistrée en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button><button class="btn petit danger" type="button" data-action="tout-effacer">Recommencer à zéro</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données</h3><p class="mention">Ta simulation est enregistrée en ligne, liée à ta clé, et n'est ni lue ni partagée par QME. Aucune connexion à une banque ni à un courtier : tu saisis toi-même revenus, charges et offres.</p></div>
      <div class="groupe"><h3>Sources et version</h3><p class="mention">Version ${esc(B.version)}. Seuils de départ : ${esc(B.hcsf.texte)} (${sourceHcsf()}). Indemnités de remboursement anticipé : ${esc(B.ira.source)}, lu le ${esc(B.ira.verifie)}. Frais de notaire : hypothèse modifiable. Aucun taux de crédit ni d'assurance intégré. Ne remplace pas le conseil d'un professionnel du crédit.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!d.profil || !d.projet) throw new Error();
        if (!confirm('Remplacer ta simulation actuelle par cette copie ?')) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du simulateur.'); }
    });
  }

  function toutEffacer() {
    if (!confirm('Effacer profil, projet et offres, et recommencer ?')) return;
    if (modale().open) modale().close();
    E = R.etatVide();
    if (session.demo) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); return; }
    sauver();
    ecranAccueil();
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
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'offre';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `capacite-emprunt-${aujIso()}.json`);
  function exporterCsv() {
    const o = offre(E.anticipe?.offreId) || E.offres.find((x) => !R.manques(x).length);
    if (!o || R.manques(o).length) { toast('Complète d\'abord une offre.'); return; }
    telecharger(R.csvEcheancier(o, R.echeancier(o)), 'text/csv;charset=utf-8', `amortissement-${slug(o.nom)}-${aujIso()}.csv`);
  }
  const exporterCsvOffres = () => telecharger(R.csvComparaison(E.offres, E.profil), 'text/csv;charset=utf-8', `comparatif-prets-${aujIso()}.csv`);

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
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'profil': modaleProfil(); break;
      case 'conditions': modaleConditions(); break;
      case 'projet-modifier': modaleProjet(); break;
      case 'offre-nouvelle': modaleOffre(null); break;
      case 'offre': modaleOffre(id); break;
      case 'offre-dupliquer': dupliquerOffre(id); break;
      case 'choisir-offre': E.anticipe.offreId = id; sauver(); rendre(); break;
      case 'detail-tableau': detailMensuel = el.dataset.mode === 'mois'; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'csv-offres': exporterCsvOffres(); break;
      case 'imprimer': if (modale().open) modale().close(); setTimeout(() => window.print(), 50); break;
      case 'tout-effacer': toutEffacer(); break;
      case 'fermer': modale().close(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="question"]');
    if (!el) return;
    if (el.checked) E.questions[el.dataset.id] = true; else delete E.questions[el.dataset.id];
    sauver();
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  let largeur = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - largeur) > 40 && E && $('#vue') && (vue === 'offres' || vue === 'amortissement') && !modale().open) { largeur = window.innerWidth; rendre(); } });
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
        if (estPret(E)) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__emprunt = { etat: () => E, regles: R };
  init();
})();
