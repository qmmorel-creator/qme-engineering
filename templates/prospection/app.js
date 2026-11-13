// Pipeline de prospection B2B QME : étapes, cadences de relance, scripts, conversion.
// Données synchronisées par clé de licence ; l'application n'envoie aucun message elle-même.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.PRS_REGLES;
  const API = '/api/templates';
  const PRODUIT = 'PRS';
  const CLE_CODE = 'qme-prs-code';
  const CLE_CACHE = 'qme-prs-cache';
  const CLE_DEMO = 'qme-prs-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-prs-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };

  // Dates locales AAAA-MM-JJ ; l'arithmétique passe par les règles (UTC).
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const ajout = R.plusJours;
  const ecart = R.ecartJours;
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    return fmt(s, { day: 'numeric', month: 'short', ...(s.slice(0, 4) !== auj().slice(0, 4) ? { year: 'numeric' } : {}) });
  };

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (['jaune', 'orange'].includes(id) ? 'var(--encre)' : '#fff');
  const etape = (id) => B.etapes.find((e) => e.id === id) || B.etapes[0];
  const canal = (id) => B.canaux.find((c) => c.id === id)?.nom || 'Autre';
  const motif = (id) => B.motifsPerte.find((m) => m.id === id)?.nom || '';
  const PIPE = B.etapes.filter((e) => !e.hors);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let annulation = null;
  let colonneTel = 'cible';
  let voirPerdus = false;
  let filtre = 'actifs', recherche = '';
  let apercu = '';
  let periode = '90';

  const reglagesDefaut = () => ({ monPrenom: '', monActivite: '', cadenceDefaut: 'premier', conservationMois: B.rgpd.conservationMois, delaiAction: 7 });
  const etatVide = () => ({ version: 1, reglages: reglagesDefaut(), scripts: copie(B.scripts), cadences: copie(B.cadences), prospects: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) },
      scripts: Array.isArray(d.scripts) ? d.scripts : v.scripts,
      cadences: Array.isArray(d.cadences) && d.cadences.length ? d.cadences : v.cadences,
      prospects: Array.isArray(d.prospects) ? d.prospects.map((p) => ({ historique: [], etapeMax: 0, ...p })) : [] };
  };
  const prospect = (id) => E.prospects.find((p) => p.id === id);
  const script = (id) => E.scripts.find((s) => s.id === id);
  const nomComplet = (p) => [p.prenom, p.nom].filter(Boolean).join(' ') || p.organisation || 'Sans nom';
  const prochaine = (p) => R.prochaineRelance(p, E.cadences, B.etapes);
  const actifs = () => E.prospects.filter((p) => !p.oppose && !R.estFini(p, B.etapes));
  const options = () => ({ cadenceDefaut: E.reglages.cadenceDefaut, delaiAction: E.reglages.delaiAction });
  const valeurs = (p) => ({ prenom: p?.prenom, nom: p?.nom, organisation: p?.organisation, fonction: p?.fonction, monPrenom: E.reglages.monPrenom, monActivite: E.reglages.monActivite });
  function remplacer(p) { const i = E.prospects.findIndex((x) => x.id === p.id); if (i >= 0) E.prospects[i] = p; return p; }

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

  async function appel(chemin, opts = {}) {
    const r = await fetch(API + chemin, { ...opts, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}), ...(opts.headers || {}) } });
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
        toast('Un autre appareil a modifié ton pipeline entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code PRS-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('PRS')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('PRS') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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

  // ---------- Démo : historique simulé avec les vraies règles, dates relatives à aujourd'hui ----------
  function donneesDemo() {
    E = etatVide();
    E.reglages.monPrenom = 'Alex';
    E.reglages.monActivite = 'j’aide les PME industrielles à fiabiliser leur planning de production';
    const t = auj();
    const o = { cadenceDefaut: 'premier', delaiAction: 7 };
    // [prénom, nom, organisation, fonction, canal, source, création (jours), cadence, événements]
    // Événements : ['envoi', j] · ['recu', j] · ['etape', id, j, extra] · ['report', j] · ['oppose', j]
    const liste = [
      ['Claire', 'Fontaine', 'Fonderie des Trois Vallées', 'Responsable de production', 'email', 'Annuaire régional', 0, 'premier', []],
      ['Marc', 'Delorme', 'Usinage Delorme et Fils', 'Dirigeant', 'telephone', 'Salon professionnel', -2, 'premier', []],
      ['Nadia', 'Benali', 'Plasturgie du Lac', 'Directrice des opérations', 'reseau', 'Réseaux professionnels', -3, 'premier', [['envoi', -3]]],
      ['Hugo', 'Marchal', 'Atelier Marchal Découpe', 'Responsable méthodes', 'email', 'Site web de l’entreprise', 0, 'premier', [['envoi', 0]]],
      ['Sophie', 'Garnier', 'Chaudronnerie Garnier', 'Gérante', 'email', 'Annuaire régional', -12, 'premier', [['envoi', -12], ['envoi', -9], ['envoi', -5], ['report', 4]]],
      ['Thomas', 'Leroy', 'Mécanique de Précision Ouest', 'Directeur industriel', 'reseau', 'Réseaux professionnels', -10, 'premier', [['envoi', -10], ['envoi', -7]]],
      ['Julie', 'Perrin', 'Emballages Perrin', 'Responsable supply chain', 'email', 'Annuaire régional', -35, 'premier', [['envoi', -35], ['envoi', -32], ['envoi', -28], ['envoi', -21], ['envoi', -7]]],
      ['Karim', 'Haddad', 'Menuiserie Industrielle du Nord', 'Directeur de site', 'rencontre', 'Rencontre d’affaires locale', -9, 'douce', [['envoi', -6], ['recu', -2]]],
      ['Élodie', 'Roussel', 'Textiles Roussel', 'Directrice générale', 'recommandation', 'Recommandation d’un client', -14, 'douce', [['envoi', -14], ['recu', -11], ['etape', 'rdv', -1, { action: 5 }]]],
      ['Bruno', 'Caron', 'Forges de l’Étang', 'Responsable d’atelier', 'telephone', 'Salon professionnel', -20, 'premier', [['envoi', -20], ['envoi', -17], ['recu', -16], ['etape', 'rdv', -10, { action: -1 }]]],
      ['Inès', 'Moreau', 'Cartonnages Moreau', 'Directrice administrative et financière', 'email', 'Annuaire régional', -24, 'premier', [['envoi', -24], ['envoi', -21], ['recu', -19], ['etape', 'rdv', -12], ['etape', 'proposition', -3]]],
      ['Paul', 'Lemaire', 'Thermoformage Lemaire', 'Dirigeant', 'reseau', 'Réseaux professionnels', -30, 'premier', [['envoi', -30], ['recu', -27], ['etape', 'rdv', -20], ['etape', 'proposition', -10], ['envoi', -7], ['envoi', -3]]],
      ['Laura', 'Vidal', 'Vidal Composants', 'Responsable qualité', 'recommandation', 'Recommandation d’un partenaire', -45, 'douce', [['envoi', -45], ['recu', -40], ['etape', 'rdv', -33], ['etape', 'proposition', -26], ['envoi', -23], ['etape', 'gagne', -15]]],
      ['Antoine', 'Barbier', 'Barbier Robotique', 'Directeur technique', 'reseau', 'Réseaux professionnels', -58, 'premier', [['envoi', -58], ['envoi', -55], ['recu', -54], ['etape', 'rdv', -48], ['etape', 'proposition', -42], ['envoi', -39], ['etape', 'gagne', -36]]],
      ['Sarah', 'Colin', 'Peintures Industrielles Colin', 'Acheteuse', 'email', 'Annuaire régional', -50, 'premier', [['envoi', -50], ['envoi', -47], ['envoi', -43], ['envoi', -36], ['envoi', -22], ['etape', 'perdu', -20, { motif: 'sans-reponse' }]]],
      ['Olivier', 'Petit', 'Petit Mécanique Générale', 'Gérant', 'telephone', 'Salon professionnel', -52, 'premier', [['envoi', -52], ['recu', -51], ['etape', 'rdv', -44], ['etape', 'perdu', -40, { motif: 'pas-moment' }]]],
      ['Lucie', 'Fabre', 'Fabre Électronique', 'Responsable des achats', 'email', 'Annuaire régional', -18, 'premier', [['envoi', -18], ['envoi', -15], ['oppose', -14]]],
      ['Damien', 'Roche', 'Roche Conditionnement', 'Directeur de production', 'telephone', 'Ancien fichier de contacts', -1160, 'premier', [['envoi', -1160], ['envoi', -1157], ['etape', 'perdu', -1120, { motif: 'pas-besoin' }]]],
      ['', '', 'Ateliers Réunis du Centre', 'Direction générale', 'courrier', 'Appel à candidatures public', -6, 'douce', [['envoi', -6]]],
    ];
    for (const [prenom, nom, organisation, fonction, can, source, j, cad, evs] of liste) {
      const creeLe = ajout(t, j);
      let p = { id: uid(), prenom, nom, organisation, fonction, canal: can, source, coordonnee: '', notes: '', etape: 'cible', etapeMax: 0,
        creeLe, cadence: { id: cad, debut: creeLe, pas: 0, dernier: null }, action: null, reporteAu: null, historique: [] };
      for (const [type, a, b, c] of evs) {
        if (type === 'envoi') { const r = R.relanceCourante(p, E.cadences); p = R.enregistrerEnvoi(p, E.cadences, B.etapes, { date: ajout(t, a), canal: r?.canal || p.canal, texte: r ? script(r.script)?.titre : 'Message de suivi' }); }
        else if (type === 'recu') p = R.enregistrerReponse(p, B.etapes, { date: ajout(t, a), texte: 'Réponse reçue' });
        else if (type === 'etape') p = R.changerEtape(p, a, B.etapes, { ...o, date: ajout(t, b), motif: c?.motif, action: c?.action !== undefined ? ajout(t, c.action) : null });
        else if (type === 'report') p.reporteAu = ajout(t, a);
        else if (type === 'oppose') p = R.opposer(p, ajout(t, a));
      }
      E.prospects.push(p);
    }
    E.prospects[1].notes = 'Rencontré sur le stand : intéressé par un diagnostic, rappeler en fin de matinée.';
    E.prospects[1].coordonnee = 'Standard de l’entreprise';
    E.prospects[0].coordonnee = 'adresse professionnelle (exemple)';
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Pipeline de prospection · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="120" height="260" fill="#F0EDE6"/>
          <rect x="150" y="80" width="120" height="200" fill="#1D4E89"/>
          <rect x="290" y="140" width="120" height="140" fill="#F5B400"/>
          <circle cx="490" cy="220" r="60" fill="#D9302A"/>
          <path d="M10 20 A120 120 0 0 1 130 140 H10 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Pipeline de prospection B2B</p>
          <h1>Relancer au bon moment, avec le bon message.</h1>
          <p>Tes prospects par étape, la relance du jour calculée selon ta cadence, le message prêt à copier, et les taux qui disent quel canal te répond.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton pipeline</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes prospects sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon pipeline</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de pipeline ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon pipeline'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { monPrenom: '', monActivite: '', cadence: 'premier' };

  function ecranAccueil() {
    const a = accueil;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>On prépare ton pipeline.</h1>
      <p class="intro">Deux informations servent à remplir tes scripts de messages ({mon prénom}, {mon activité}). Tout reste modifiable dans les réglages.</p>
      <div class="accueil-champs">
        <label class="champ">Ton prénom<small>Signature des messages.</small><input id="acc-prenom" value="${esc(a.monPrenom)}" autocomplete="given-name" maxlength="40"></label>
        <label class="champ">Ton activité en une phrase<small>Ex. : « j’aide les cabinets comptables à automatiser leurs relances ».</small><input id="acc-activite" value="${esc(a.monActivite)}" maxlength="160"></label>
      </div>
      <h2 class="titre-section">Ta cadence de relance par défaut <span>Appliquée aux nouveaux prospects.</span></h2>
      <div class="filieres" role="group" aria-label="Cadence par défaut">
        ${E0.cadences.map((c, i) => `<button type="button" class="filiere" style="--c:${couleur(['bleu', 'jaune', 'rouge'][i % 3])}" data-action="acc-cadence" data-id="${c.id}" aria-pressed="${a.cadence === c.id}"><b>${esc(c.nom)}</b><span>${esc(c.description)}</span><span class="frise">${frise(c)}</span></button>`).join('')}
      </div>
      <p class="aide" style="margin-top:20px">L'application n'envoie aucun message et ne se connecte à aucun réseau : tu copies le message préparé et tu l'envoies toi-même. Données de prospects : n'enregistre que des informations professionnelles utiles (voir les repères RGPD dans l'onglet Prospects).</p>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Créer mon pipeline</button></div>
    </div>`;
    $('#acc-prenom').addEventListener('input', (e) => { accueil.monPrenom = e.target.value; });
    $('#acc-activite').addEventListener('input', (e) => { accueil.monActivite = e.target.value; });
  }
  const E0 = { cadences: B.cadences };

  function terminerAccueil() {
    E = etatVide();
    E.reglages.monPrenom = accueil.monPrenom.trim();
    E.reglages.monActivite = accueil.monActivite.trim();
    E.reglages.cadenceDefaut = accueil.cadence;
    accueil = { monPrenom: '', monActivite: '', cadence: 'premier' };
    sauver();
    demarrer();
    setTimeout(() => modaleProspect(), 250);
  }

  // Frise d'une cadence : J0, J+3, J+7… (cumul des délais).
  function frise(c) {
    let j = 0;
    return c.relances.map((r) => { j += Number(r.delai) || 0; return `J${j ? `+${j}` : '0'} ${canal(r.canal).split(' ')[0].toLowerCase()}`; }).join(' · ');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    pipeline: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="18" fill="currentColor"/><rect x="10" y="3" width="5" height="12" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="7" fill="currentColor"/></svg>',
    prospects: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    scripts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    chiffres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="currentColor"/><rect x="3" y="16" width="7" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['pipeline', 'Pipeline'], ['prospects', 'Prospects'], ['scripts', 'Scripts'], ['chiffres', 'Chiffres']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Pipeline<br>de prospection</span>
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
    document.title = `${titres[vue]} · Pipeline de prospection`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, pipeline: vuePipeline, prospects: vueProspects, scripts: vueScripts, chiffres: vueChiffres }[vue]();
    if (vue === 'pipeline') brancherGlisser();
    if (vue === 'prospects') brancherRecherche();
    if (vue === 'chiffres') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const pastilleEtape = (id) => { const e = etape(id); return `<span class="etiquette" style="background:${couleur(e.couleur)};color:${texteSur(e.couleur)}">${esc(e.nom)}</span>`; };

  // ---------- Aujourd'hui ----------
  function vueAujourdhui() {
    const t = auj();
    const dus = R.aRelancer(E.prospects, E.cadences, B.etapes, t);
    const retards = dus.filter((x) => x.retard > 0).length;
    const envoyes = E.prospects.flatMap((p) => (p.historique || []).filter((h) => h.type === 'envoi' && h.date === t).map((h) => ({ p, h })));
    const total = dus.length + envoyes.length;
    const terminees = E.prospects.filter((p) => R.cadenceTerminee(p, E.cadences, B.etapes));
    const venir = R.aVenir(E.prospects, E.cadences, B.etapes, t, 7);
    const ac = actifs();
    const avances = ac.filter((p) => ['rdv', 'proposition'].includes(p.etape)).length;
    const salut = E.reglages.monPrenom ? `Bonjour ${esc(E.reglages.monPrenom)}. ` : '';
    const titre = !E.prospects.length ? `${salut}Ajoute ton premier prospect.`
      : dus.length ? `${salut}<mark>${pluriel(dus.length, 'relance')}</mark> ${envoyes.length ? 'restantes' : 'aujourd\'hui'}.`
        : envoyes.length ? `${salut}<mark>Tout est envoyé</mark> pour aujourd'hui.` : `${salut}Rien à relancer aujourd'hui.`;
    const vide = !E.prospects.length
      ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Ton pipeline est vide</h3><p>Ajoute les organisations que tu veux contacter : la première relance tombe le jour choisi, les suivantes selon ta cadence.</p><div class="actions"><button class="btn primaire" data-action="prospect-nouveau">${ICONES.plus}Ajouter un prospect</button><button class="btn" data-action="prospect-plusieurs">En ajouter plusieurs</button></div></div></div>`
      : `<div class="vide-etat">${FORME_VIDE}<div><h3>${envoyes.length ? 'Relances du jour faites.' : 'Aucune relance due.'}</h3><p>${venir.length ? `Prochaine relance ${quand(venir[0].date)} : ${esc(nomComplet(venir[0].p))}.` : 'Aucune relance prévue cette semaine : c\'est le moment d\'ajouter de nouveaux prospects.'}</p><div class="actions"><button class="btn" data-action="prospect-nouveau">${ICONES.plus}Prospect</button></div></div></div>`;
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${total ? `<p class="sous">${pluriel(envoyes.length, 'message envoyé', 'messages envoyés')} sur ${total}${retards ? ` · <b style="color:var(--rouge)">${retards} en retard</b>` : ''}</p>
          <div class="progression" aria-hidden="true">${Array.from({ length: Math.min(total, 24) }, (_, i) => `<span class="${i < envoyes.length ? 'fait' : i < envoyes.length + retards ? 'retard' : ''}"></span>`).join('')}</div>` : ''}
          <div class="actions">
            <button class="btn primaire" data-action="prospect-nouveau">${ICONES.plus}Prospect</button>
            <button class="btn" data-action="prospect-plusieurs">En ajouter plusieurs</button>
          </div>
        </div>
        <aside class="resume-carte ${ac.length ? '' : 'vide'}"><p class="surtitre">Pipeline actif</p><div class="compte">${ac.length}<small>${ac.length > 1 ? 'prospects' : 'prospect'}</small></div><p>${avances ? `dont ${pluriel(avances, 'en rendez-vous ou proposition', 'en rendez-vous ou proposition')}` : 'Aucun rendez-vous ni proposition en cours.'}</p><button class="btn petit" data-action="vue" data-vue="pipeline">Voir le pipeline</button></aside>
      </section>
      <h2 class="titre-section">À relancer <span>${dus.length ? 'Prépare le message, envoie-le toi-même, puis note-le : la relance suivante se calcule.' : ''}</span></h2>
      ${dus.length ? `<ul class="cartes">${dus.map(carteRelance).join('')}</ul>` : vide}
      ${terminees.length ? `<h2 class="titre-section">Cadences terminées sans réponse <span>Classe-les ou prévois de les recontacter plus tard.</span></h2>
        <div class="liste-bloc">${terminees.map((p) => `<div class="ligne" style="--c:${couleur(etape(p.etape).couleur)}"><i></i><div><b>${esc(nomComplet(p))}</b><span>${p.organisation !== nomComplet(p) ? `${esc(p.organisation)} · ` : ''}dernier message ${p.cadence?.dernier ? quand(p.cadence.dernier) : '–'}</span></div><div class="ligne-actions"><button class="btn petit" data-action="recontacter" data-id="${p.id}">Recontacter plus tard</button><button class="btn petit" data-action="perdu" data-id="${p.id}">Classer perdu</button></div></div>`).join('')}</div>` : ''}
      ${venir.length ? `<h2 class="titre-section">Les 7 prochains jours</h2><div class="liste-bloc">${venir.map(({ p, date }) => `<button class="ligne ligne-bouton" style="--c:${couleur(etape(p.etape).couleur)}" data-action="fiche" data-id="${p.id}"><i></i><div><b>${esc(nomComplet(p))}</b><span>${esc([p.organisation !== nomComplet(p) ? p.organisation : '', etape(p.etape).nom].filter(Boolean).join(' · '))}${p.reporteAu === date ? ' · reporté' : ''}</span></div><span class="date">${quand(date)}</span></button>`).join('')}</div>` : ''}
      ${envoyes.length ? `<details class="faites"><summary>Envoyés aujourd'hui (${envoyes.length})</summary>${envoyes.map(({ p, h }) => `<div class="ligne-faite" style="--c:${couleur(etape(p.etape).couleur)}"><i></i><span><b>${esc(nomComplet(p))}</b> · ${esc(p.organisation)} · ${esc(canal(h.canal))}${prochaine(p) ? ` · prochaine relance ${quand(prochaine(p))}` : ''}</span></div>`).join('')}</details>` : ''}`;
  }

  function carteRelance({ p, date, retard }) {
    const e = etape(p.etape);
    const r = R.relanceCourante(p, E.cadences);
    const s = r ? script(r.script) : null;
    const quoi = r ? `Relance ${r.index + 1} sur ${r.total} · ${esc(canal(r.canal))}${s ? ` · ${esc(s.titre)}` : ''}` : `Prochaine action · ${esc(canal(p.canal))}`;
    return `
      <li class="carte" style="--c:${couleur(e.couleur)}" data-carte="${p.id}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-matiere">${pastilleEtape(p.etape)}${retard > 0 ? `<span class="etiquette rouge">En retard · ${retard} j</span>` : ''}${p.reporteAu === date ? '<span class="etiquette jaune">Reporté</span>' : ''}</p>
          <h3><button class="lien-fiche" data-action="fiche" data-id="${p.id}">${esc(nomComplet(p))}</button></h3>
          <p class="carte-meta"><span>${esc([p.fonction, p.organisation].filter(Boolean).join(' · '))}</span></p>
          <p class="carte-quoi">${quoi}</p>
        </div>
        <div class="carte-eval" role="group" aria-label="Actions pour ${esc(nomComplet(p))}">
          <button class="ev preparer" data-action="message" data-id="${p.id}">Préparer<small>le message</small></button>
          <button class="ev envoye" data-action="envoye" data-id="${p.id}">Envoyé<small>${r && r.index + 1 < r.total ? `suivante +${r.cadence.relances[r.index + 1].delai} j` : r ? 'dernière' : `+${E.reglages.delaiAction} j`}</small></button>
          <button class="ev repondu" data-action="repondu" data-id="${p.id}">A répondu<small>en échange</small></button>
        </div>
        <div class="carte-plus"><button data-action="reporter" data-id="${p.id}">Reporter à demain</button><button data-action="reporter-date" data-id="${p.id}">Reporter à une date</button><button data-action="fiche" data-id="${p.id}">Fiche</button></div>
      </li>`;
  }

  // ---------- Pipeline ----------
  function vuePipeline() {
    const t = auj();
    const cols = B.etapes.filter((e) => !e.hors || voirPerdus);
    const nbPerdus = E.prospects.filter((p) => p.etape === 'perdu' && !p.oppose).length;
    if (!cols.some((c) => c.id === colonneTel)) colonneTel = 'cible';
    const dans = (id) => E.prospects.filter((p) => p.etape === id && !p.oppose)
      .sort((a, b) => (prochaine(a) || '9999').localeCompare(prochaine(b) || '9999'));
    const colonnes = cols.map((e, i) => {
      const liste = dans(e.id);
      const suivante = PIPE[PIPE.findIndex((x) => x.id === e.id) + 1];
      return `<section class="colonne ${colonneTel === e.id ? 'choisie' : ''}" data-etape="${e.id}" style="--c:${couleur(e.couleur)}" aria-label="${esc(e.nom)}, ${pluriel(liste.length, 'prospect')}">
        <header class="colonne-tete"><h2>${esc(e.nom)}</h2><span class="nb">${liste.length}</span></header>
        <p class="colonne-def">${esc(e.definition)}</p>
        <div class="colonne-corps">${liste.map((p) => {
          const d = prochaine(p);
          const fini = R.cadenceTerminee(p, E.cadences, B.etapes);
          return `<article class="fiche-carte" draggable="true" data-id="${p.id}">
            <button class="fiche-nom" data-action="fiche" data-id="${p.id}"><b>${esc(nomComplet(p))}</b><span>${esc(p.organisation && nomComplet(p) !== p.organisation ? p.organisation : p.fonction || '')}</span></button>
            <p class="fiche-info">${esc(canal(p.canal))}${d ? ` · <span class="${d < t ? 'retard' : d === t ? 'dujour' : ''}">${d < t ? `en retard (${quand(d)})` : `relance ${quand(d)}`}</span>` : fini ? ' · <span class="retard">cadence terminée</span>' : e.id === 'perdu' ? ` · ${esc(motif(p.motif))}` : ''}</p>
            ${suivante && !e.fin ? `<button class="btn petit suivante" data-action="etape-suivante" data-id="${p.id}" aria-label="Passer ${esc(nomComplet(p))} à l'étape ${esc(suivante.nom)}">${esc(suivante.court)} →</button>` : ''}
          </article>`;
        }).join('') || `<p class="colonne-vide">${i === 0 ? 'Ajoute un prospect.' : 'Dépose une carte ici.'}</p>`}</div>
      </section>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Pipeline</h1><p>Glisse une carte d'une colonne à l'autre, ou utilise le bouton d'étape suivante sur chaque carte. Changer d'étape démarre ou arrête la cadence de relance.</p></div>
        <div class="actions"><button class="btn" data-action="voir-perdus" aria-pressed="${voirPerdus}">${voirPerdus ? 'Masquer' : 'Afficher'} les perdus (${nbPerdus})</button><button class="btn primaire" data-action="prospect-nouveau">${ICONES.plus}Prospect</button></div></div>
      <div class="choix-colonne" role="group" aria-label="Étape affichée">${cols.map((e) => `<button type="button" data-action="colonne" data-id="${e.id}" aria-pressed="${colonneTel === e.id}" style="--c:${couleur(e.couleur)}"><i></i>${esc(e.court)} <b>${dans(e.id).length}</b></button>`).join('')}</div>
      <div class="kanban-defile"><div class="kanban" style="--n:${cols.length}">${colonnes}</div></div>`;
  }

  function brancherGlisser() {
    if (!matchMedia('(pointer: fine)').matches) document.querySelectorAll('.fiche-carte').forEach((c) => c.removeAttribute('draggable'));
    let source = null;
    document.querySelectorAll('.fiche-carte[draggable]').forEach((c) => {
      c.addEventListener('dragstart', (e) => { source = c.dataset.id; e.dataTransfer.setData('text/plain', source); e.dataTransfer.effectAllowed = 'move'; c.classList.add('glisse'); });
      c.addEventListener('dragend', () => { c.classList.remove('glisse'); document.querySelectorAll('.colonne').forEach((x) => x.classList.remove('survol')); });
    });
    document.querySelectorAll('.colonne').forEach((col) => {
      col.addEventListener('dragover', (e) => { if (!source) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('survol'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('survol'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain') || source;
        source = null;
        col.classList.remove('survol');
        const p = prospect(id);
        if (p && p.etape !== col.dataset.etape) deplacer(id, col.dataset.etape);
      });
    });
  }

  // Changement d'étape avec annulation ; « Perdu » demande le motif.
  function deplacer(id, cible, extra = {}) {
    const p = prospect(id);
    if (!p) return;
    if (cible === 'perdu' && !extra.motif) { modalePerdu(id); return; }
    annulation = { id, avant: copie(p) };
    const n = remplacer(R.changerEtape(p, cible, B.etapes, { ...options(), date: auj(), ...extra }));
    sauver(); rendre();
    const d = prochaine(n);
    const e = etape(cible);
    toast(`${nomComplet(n)} : ${e.nom}${e.fin ? '' : d ? `, relance ${quand(d)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Prospects ----------
  const FILTRES = [
    ['actifs', 'Actifs', (p) => !p.oppose && !R.estFini(p, B.etapes)],
    ['relancer', 'À relancer', (p) => { const d = prochaine(p); return !!d && d <= auj(); }],
    ['gagnes', 'Gagnés', (p) => p.etape === 'gagne' && !p.oppose],
    ['perdus', 'Perdus', (p) => p.etape === 'perdu' && !p.oppose],
    ['rgpd', 'À revoir (RGPD)', (p) => R.aRevoirRgpd(p, auj(), E.reglages.conservationMois)],
    ['opposes', 'Opposés', (p) => !!p.oppose],
    ['tous', 'Tous', () => true],
  ];

  function vueProspects() {
    const nbRgpd = E.prospects.filter(FILTRES[4][2]).length;
    return `
      <div class="vue-tete"><div><h1>Prospects</h1><p>Toutes tes fiches, avec la prochaine relance. Les opposés restent listés (nom et organisation seulement) pour ne pas les recontacter.</p></div>
        <div class="actions"><button class="btn" data-action="prospect-plusieurs">En ajouter plusieurs</button><button class="btn primaire" data-action="prospect-nouveau">${ICONES.plus}Prospect</button></div></div>
      ${nbRgpd ? `<p class="alerte">${pluriel(nbRgpd, 'prospect')} sans contact venant de ${nbRgpd > 1 ? 'eux' : 'lui'} depuis plus de ${E.reglages.conservationMois} mois : à supprimer ou archiver. <button class="btn petit" data-action="filtre" data-id="rgpd">Voir</button></p>` : ''}
      <div class="outils-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un nom, une organisation, une source…" value="${esc(recherche)}"></label>
        <div class="filtres" role="group" aria-label="Filtre">${FILTRES.map(([id, nom, f]) => `<button type="button" data-action="filtre" data-id="${id}" aria-pressed="${filtre === id}">${nom} <b>${E.prospects.filter(f).length}</b></button>`).join('')}</div>
      </div>
      <div id="liste-prospects">${listeProspects()}</div>
      ${blocRgpd()}`;
  }

  function listeProspects() {
    const f = FILTRES.find((x) => x[0] === filtre)[2];
    const q = recherche.trim().toLowerCase();
    const t = auj();
    const liste = E.prospects.filter(f).filter((p) => !q || [p.prenom, p.nom, p.organisation, p.fonction, p.source].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (prochaine(a) || '9999').localeCompare(prochaine(b) || '9999') || nomComplet(a).localeCompare(nomComplet(b)));
    if (!E.prospects.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun prospect</h3><p>Commence par 10 à 20 organisations bien ciblées plutôt qu'une longue liste.</p><div class="actions"><button class="btn primaire" data-action="prospect-nouveau">${ICONES.plus}Ajouter un prospect</button></div></div></div>`;
    if (!liste.length) return '<p class="liste-vide">Aucun prospect pour ce filtre.</p>';
    return `<div class="liste-bloc">${liste.map((p) => {
      const d = prochaine(p);
      const info = p.oppose ? `Opposition le ${fmt(p.oppose, { day: 'numeric', month: 'long', year: 'numeric' })}` : p.etape === 'perdu' ? `Perdu · ${motif(p.motif)}` : d ? `Relance ${quand(d)}` : R.cadenceTerminee(p, E.cadences, B.etapes) ? 'Cadence terminée' : p.etape === 'gagne' ? 'Premier contrat obtenu' : 'Aucune relance';
      return `<button class="ligne ligne-bouton ligne-prospect" style="--c:${couleur(etape(p.etape).couleur)}" data-action="fiche" data-id="${p.id}"><i></i>
        <div><b>${esc(nomComplet(p))}</b><span>${esc([p.organisation !== nomComplet(p) ? p.organisation : '', p.fonction].filter(Boolean).join(' · '))}</span></div>
        <div class="ligne-droite">${p.oppose ? '<span class="etiquette rouge">Opposé</span>' : pastilleEtape(p.etape)}<span class="${d && d < t ? 'retard' : ''}">${esc(info)}</span></div></button>`;
    }).join('')}</div>`;
  }

  function brancherRecherche() {
    $('#recherche')?.addEventListener('input', (e) => { recherche = e.target.value; $('#liste-prospects').innerHTML = listeProspects(); });
  }

  function blocRgpd() {
    return `<section class="rgpd" id="rgpd">
      <h2>Données de prospects : rappel de bonnes pratiques</h2>
      <p>Ce rappel n'est pas un conseil juridique. Il résume des pages de la CNIL consultées le ${B.rgpd.consulteLe} ; vérifie-les sur cnil.fr pour ta situation.</p>
      <ul>${B.rgpd.reperes.map((r) => `<li><p>${esc(r.texte)}</p><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.source)}</a></li>`).join('')}</ul>
      <p>Dans l'application : note seulement des informations professionnelles utiles ; le bouton « Opposition » d'une fiche arrête toute relance, efface coordonnée, notes et historique, et garde nom, organisation et date pour ne pas recontacter la personne ; le filtre « À revoir » signale les prospects sans contact venant d'eux depuis ${E.reglages.conservationMois} mois (réglable).</p>
    </section>`;
  }

  // ---------- Scripts et cadences ----------
  function surligner(texte) {
    return esc(texte).replace(/\{([^{}]{1,30})\}/g, (t, v) => (B.variables.includes(v) ? `<span class="var">{${v}}</span>` : t)).replace(/\[([^\][]{1,60})\]/g, '<span class="trou">[$1]</span>');
  }

  function vueScripts() {
    const p = apercu ? prospect(apercu) : null;
    const rendu = (texte) => (p ? surligner(R.remplirScript(texte, valeurs(p)).texte) : surligner(texte));
    const choix = E.prospects.filter((x) => !x.oppose);
    const groupes = B.etapes.map((e) => ({ e, liste: E.scripts.filter((s) => s.etape === e.id) })).filter((g) => g.liste.length);
    const autres = E.scripts.filter((s) => !B.etapes.some((e) => e.id === s.etape));
    return `
      <div class="vue-tete"><div><h1>Scripts</h1><p>${pluriel(E.scripts.length, 'modèle')} de messages par étape. Les variables entre accolades se remplissent avec la fiche du prospect ; ce qui est entre crochets est à compléter toi-même.</p></div>
        <div class="actions"><button class="btn" data-action="scripts-origine">Revenir aux scripts d'origine</button><button class="btn primaire" data-action="script-nouveau">${ICONES.plus}Script</button></div></div>
      <div class="apercu-choix"><label class="champ">Aperçu avec<select id="apercu"><option value="">Variables brutes</option>${choix.map((x) => `<option value="${x.id}" ${x.id === apercu ? 'selected' : ''}>${esc(nomComplet(x))}${x.organisation && x.organisation !== nomComplet(x) ? ` · ${esc(x.organisation)}` : ''}</option>`).join('')}</select></label>
        <p class="aide">Variables : ${B.variables.map((v) => `<span class="var">{${v}}</span>`).join(' ')}. Les tiennes (« mon prénom », « mon activité ») se règlent dans les réglages.</p></div>
      ${[...groupes, ...(autres.length ? [{ e: { nom: 'Autres', couleur: 'encre', id: 'autres' }, liste: autres }] : [])].map(({ e, liste }) => `
        <h2 class="titre-section">${esc(e.nom)} <span>${pluriel(liste.length, 'script')}</span></h2>
        <div class="scripts">${liste.map((s) => `
          <article class="script" style="--c:${couleur(e.couleur)};--t:${texteSur(e.couleur)}">
            <div class="script-tete"><h3>${esc(s.titre)}</h3><span>${esc(canal(s.canal))}</span></div>
            ${s.objet ? `<p class="script-objet"><b>Objet :</b> ${rendu(s.objet)}</p>` : ''}
            <div class="script-texte">${rendu(s.texte)}</div>
            <div class="script-pied"><button class="btn petit" data-action="copier-script" data-id="${s.id}">Copier</button><button class="btn petit lien" data-action="script-modifier" data-id="${s.id}">Modifier</button></div>
          </article>`).join('')}</div>`).join('')}
      <h2 class="titre-section">Cadences de relance <span>Délai compté depuis le message précédent.</span></h2>
      <div class="cadences">${E.cadences.map((c) => {
        const n = E.prospects.filter((p) => p.cadence?.id === c.id && !R.estFini(p, B.etapes)).length;
        let j = 0;
        return `<article class="cadence">
          <div class="cadence-tete"><div><h3>${esc(c.nom)}${E.reglages.cadenceDefaut === c.id ? ' <span class="etiquette jaune">Par défaut</span>' : ''}</h3><p>${esc(c.description || '')}</p></div><button class="btn petit" data-action="cadence-modifier" data-id="${c.id}">Modifier</button></div>
          <ol class="frise-cadence">${c.relances.map((r) => { j += Number(r.delai) || 0; return `<li><b>J${j ? `+${j}` : '0'}</b><span>${esc(canal(r.canal))}</span><small>${esc(script(r.script)?.titre || 'Sans script')}</small></li>`; }).join('')}</ol>
          <p class="cadence-pied">${n ? `Suivie par ${pluriel(n, 'prospect')} actif${n > 1 ? 's' : ''}.` : 'Aucun prospect actif sur cette cadence.'}</p>
        </article>`;
      }).join('')}<button class="cadence cadence-ajout" data-action="cadence-nouvelle">${ICONES.plus}Nouvelle cadence</button></div>`;
  }

  // ---------- Chiffres ----------
  const PERIODES = [['30', '30 jours'], ['90', '90 jours'], ['365', '12 mois'], ['tout', 'Tout']];

  function vueChiffres() {
    const t = auj();
    const depuis = periode === 'tout' ? null : ajout(t, -Number(periode) + 1);
    const P = R.dansPeriode(E.prospects, depuis);
    const f = R.entonnoir(P, B.etapes);
    const can = R.parCanal(P, B.etapes, B.canaux);
    const contactes = f[1].atteint;
    const act = R.activite(E.prospects, t, 8);
    const perdus = P.filter((p) => p.etape === 'perdu');
    const motifs = B.motifsPerte.map((m) => ({ ...m, n: perdus.filter((p) => p.motif === m.id).length })).filter((m) => m.n);
    const max = Math.max(1, f[0].atteint);
    const tuiles = [
      ['Prospects', P.length, '', depuis ? `Créés depuis le ${fmt(depuis, { day: 'numeric', month: 'short' })}.` : 'Depuis le début.', 'var(--encre)', 'rond'],
      ['Réponses', contactes ? Math.round((f[2].atteint / contactes) * 100) : '–', contactes ? '%' : '', `Prospects ayant répondu sur ${pluriel(contactes, 'contacté')}.`, 'var(--jaune)', ''],
      ['Rendez-vous', f[3].atteint, '', 'Prospects ayant atteint l\'étape Rendez-vous.', 'var(--bleu)', ''],
      ['Gagnés', f[5].atteint, contactes ? `· ${pct(f[5].atteint / contactes)}` : '', 'Premiers contrats, rapportés aux contactés.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, u, d, c, fo]) => `<div class="tuile ${fo}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    return `
      <div class="vue-tete"><div><h1>Chiffres</h1><p>Conversion par étape et par canal, sur les prospects créés dans la période. Une étape atteinte reste comptée même si le prospect est ensuite perdu.</p></div>
        <div class="periodes" role="group" aria-label="Période">${PERIODES.map(([id, nom]) => `<button type="button" data-action="periode" data-id="${id}" aria-pressed="${periode === id}">${nom}</button>`).join('')}</div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Entonnoir <span>Prospects ayant atteint chaque étape, et taux de passage à l'étape suivante.</span></h2>
      ${P.length ? `<figure class="entonnoir" aria-label="Entonnoir de conversion, détail dans le tableau ci-dessous">
        ${f.map((x, k) => { const e = etape(x.id); return `<div class="barre-ent" style="--c:${couleur(e.couleur)}">
          <span class="ent-nom">${esc(x.nom)}</span>
          <span class="ent-piste"><i style="width:${Math.max(x.atteint ? 1.5 : 0, (x.atteint / max) * 100)}%"></i><b>${x.atteint}</b></span>
          <span class="ent-taux">${k < f.length - 1 ? `${pct(x.passage)} <small>passent</small>` : ''}</span></div>`; }).join('')}
      </figure>
      <div class="defile"><table class="tableau"><caption class="sr-only">Conversion par étape</caption><thead><tr><th>Étape</th><th class="nb">Atteinte</th><th class="nb">Passage à la suivante</th><th class="nb">Depuis « À contacter »</th></tr></thead><tbody>${f.map((x) => `<tr><td><span class="nom-matiere" style="--c:${couleur(etape(x.id).couleur)}"><i></i>${esc(x.nom)}</span></td><td class="nb">${x.atteint}</td><td class="nb">${pct(x.passage)}</td><td class="nb">${pct(x.depuisDebut)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="liste-vide">Aucun prospect créé dans cette période.</p>'}
      <h2 class="titre-section">Par canal <span>Taux rapportés aux prospects contactés par ce canal.</span></h2>
      ${can.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Canal</th><th class="nb">Prospects</th><th class="nb">Contactés</th><th class="nb">Réponse</th><th class="nb">Rendez-vous</th><th class="nb">Gagnés</th></tr></thead><tbody>${can.map((c) => `<tr><td>${esc(c.nom)}</td><td class="nb">${c.total}</td><td class="nb">${c.contactes}</td><td class="nb">${pct(c.tauxReponse)} <small>(${c.reponses})</small></td><td class="nb">${pct(c.tauxRdv)} <small>(${c.rdv})</small></td><td class="nb">${pct(c.tauxGain)} <small>(${c.gagnes})</small></td></tr>`).join('')}</tbody></table></div>
      <p class="note">Sur de petits nombres, un taux varie beaucoup d'un prospect à l'autre : regarde aussi les effectifs entre parenthèses.</p>` : '<p class="liste-vide">Aucun prospect dans cette période.</p>'}
      <h2 class="titre-section">Activité des 8 dernières semaines</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Messages envoyés et réponses reçues</h2><div class="legende">${SERIES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(act)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Activité par semaine</caption><thead><tr><th>Semaine du</th><th>Envoyés</th><th>Réponses</th></tr></thead><tbody>${act.map((s) => `<tr><td>${fmt(s.debut)}</td><td>${s.envois}</td><td>${s.reponses}</td></tr>`).join('')}</tbody></table>
      </figure>
      ${motifs.length ? `<h2 class="titre-section">Motifs de perte <span>${pluriel(perdus.length, 'prospect perdu', 'prospects perdus')} dans la période.</span></h2><div class="motifs">${motifs.map((m) => `<div><b>${m.n}</b><span>${esc(m.nom)}</span></div>`).join('')}</div>` : ''}`;
  }

  const SERIES = [['envois', 'Envoyés', '#1D4E89'], ['reponses', 'Réponses', '#F5B400']];

  function graphique(sem) {
    const L = Math.round(Math.min(760, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 230, g = 28, b = 26, hz = H - b - 10;
    const max = Math.max(4, ...sem.map((s) => Math.max(s.envois, s.reponses)));
    const pas = Math.ceil(max / 4), haut = pas * 4;
    const larg = (L - g) / sem.length;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const w = Math.max(6, Math.min(26, (larg - 14) / 2));
    const cols = sem.map((s, i) => {
      const x0 = g + i * larg + (larg - (w * 2 + 2)) / 2;
      const rects = SERIES.map(([k, , c], j) => (s[k] ? `<rect x="${x0 + j * (w + 2)}" y="${y(s[k])}" width="${w}" height="${Math.max(1, y(0) - y(s[k]))}" fill="${c}" stroke="#141414" stroke-width="1.5"/>` : '')).join('');
      const lab = (sem.length - 1 - i) % (L < 500 ? 2 : 1) === 0 ? `<text class="axe" x="${g + i * larg + larg / 2}" y="${H - 6}" text-anchor="middle">${fmt(s.debut, { day: 'numeric', month: 'short' })}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne-g" data-i="${i}">${rects}</g>${lab}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Messages envoyés et réponses reçues par semaine sur 8 semaines, détail dans le tableau">${grilles}${cols}</svg>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const sem = R.activite(E.prospects, auj(), 8);
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), s = sem[i];
      fig.querySelectorAll('.colonne-g').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      bulle.innerHTML = `<b>Semaine du ${fmt(s.debut, { day: 'numeric', month: 'long' })}</b>${SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${s[k]}</div>`).join('')}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.zone').forEach((z) => { z.addEventListener('pointerenter', () => montrer(z)); z.addEventListener('click', () => montrer(z)); });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne-g').forEach((g) => g.classList.remove('active')); });
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
      if (err !== false) d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
  }

  const optionsCanal = (sel) => B.canaux.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nom)}</option>`).join('');
  const optionsCadence = (sel) => E.cadences.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nom)}</option>`).join('');

  function modaleProspect(id) {
    const p = id ? prospect(id) : null;
    const t = auj();
    const corps = `
      <div class="deux"><label class="champ">Prénom<input name="prenom" maxlength="60" value="${esc(p?.prenom || '')}" autocomplete="off"></label>
      <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(p?.nom || '')}" autocomplete="off"></label></div>
      <label class="champ">Organisation<input name="organisation" maxlength="100" value="${esc(p?.organisation || '')}" autocomplete="off"></label>
      <label class="champ">Fonction<small>Elle doit avoir un rapport avec ce que tu proposes.</small><input name="fonction" maxlength="100" value="${esc(p?.fonction || '')}" autocomplete="off"></label>
      <div class="deux"><label class="champ">Canal principal<select name="canal">${optionsCanal(p?.canal || 'email')}</select></label>
      <label class="champ">Source<input name="source" maxlength="100" value="${esc(p?.source || '')}" placeholder="Salon, annuaire, recommandation…"></label></div>
      <label class="champ">Coordonnée professionnelle<small>Facultative : e-mail professionnel, standard, adresse de profil.</small><input name="coordonnee" maxlength="160" value="${esc(p?.coordonnee || '')}" autocomplete="off"></label>
      <label class="champ">Notes<textarea name="notes" maxlength="1000" placeholder="Contexte utile pour le prochain message">${esc(p?.notes || '')}</textarea></label>
      ${p ? '' : `<div class="deux"><label class="champ">Cadence<select name="cadence">${optionsCadence(E.reglages.cadenceDefaut)}</select></label>
      <label class="champ">Premier message le<input type="date" name="debut" value="${t}"></label></div>`}
      <p class="aide">Données de tiers : n'enregistre que ce qui sert à ta prospection professionnelle.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = p ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier le prospect' : 'Nouveau prospect', corps, pied, (f, action) => {
      if (action === 'supprimer') { supprimer(p.id); return; }
      const v = Object.fromEntries(['prenom', 'nom', 'organisation', 'fonction', 'canal', 'source', 'coordonnee', 'notes'].map((k) => [k, String(f.get(k) || '').trim()]));
      if (!v.prenom && !v.nom && !v.organisation) return 'Indique au moins un nom ou une organisation.';
      if (!p) {
        const op = R.doublonOppose(E.prospects, v);
        if (op) return `Cette personne s'est opposée à la prospection le ${fmt(op.oppose, { day: 'numeric', month: 'long', year: 'numeric' })} : ne la recontacte pas.`;
        const debut = f.get('debut') || t;
        const n = { id: uid(), ...v, etape: 'cible', etapeMax: 0, creeLe: t, cadence: { id: f.get('cadence'), debut, pas: 0, dernier: null }, action: null, reporteAu: null, historique: [] };
        E.prospects.push(n);
        annulation = { id: n.id, avant: null };
        sauver(); rendre();
        toast(`${nomComplet(n)} ajouté. Premier message ${quand(prochaine(n))}.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      Object.assign(p, v);
      sauver(); rendre(); toast('Fiche enregistrée.');
    });
  }

  function modalePlusieurs() {
    const t = auj();
    ouvrirModale('Ajouter plusieurs prospects', `
      <label class="champ">Un prospect par ligne<small>« Prénom Nom ; Organisation ; Fonction ». Les éléments manquants peuvent rester vides.</small><textarea name="lignes" rows="7" placeholder="Camille Durand ; Atelier Exemple ; Gérante&#10;Sam Martin ; Société Fictive ; Directeur commercial"></textarea></label>
      <div class="deux"><label class="champ">Canal<select name="canal">${optionsCanal('email')}</select></label><label class="champ">Source<input name="source" maxlength="100"></label></div>
      <div class="deux"><label class="champ">Cadence<select name="cadence">${optionsCadence(E.reglages.cadenceDefaut)}</select></label><label class="champ">Premier message le<input type="date" name="debut" value="${t}"></label></div>
      <p class="aide">Pour ne pas tout envoyer le même jour, échelonne : ajoute-les par petits groupes avec des dates différentes.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const lignes = R.lireLignes(f.get('lignes'));
      if (!lignes.length) return 'Ajoute au moins une ligne.';
      const ignores = lignes.filter((l) => R.doublonOppose(E.prospects, l));
      const ok = lignes.filter((l) => !ignores.includes(l));
      const debut = f.get('debut') || t;
      ok.forEach((l) => E.prospects.push({ id: uid(), ...l, canal: f.get('canal'), source: String(f.get('source') || '').trim(), coordonnee: '', notes: '', etape: 'cible', etapeMax: 0, creeLe: t, cadence: { id: f.get('cadence'), debut, pas: 0, dernier: null }, action: null, reporteAu: null, historique: [] }));
      sauver(); rendre();
      toast(`${pluriel(ok.length, 'prospect ajouté', 'prospects ajoutés')}${ignores.length ? ` · ${ignores.length} ignoré${ignores.length > 1 ? 's' : ''} (opposition)` : ''}.`);
    });
  }

  // Fiche : étape, relance, actions, historique.
  function modaleFiche(id) {
    const p = prospect(id);
    if (!p) return;
    const d = prochaine(p);
    const r = R.relanceCourante(p, E.cadences);
    const fini = R.cadenceTerminee(p, E.cadences, B.etapes);
    const cad = p.cadence ? E.cadences.find((c) => c.id === p.cadence.id) : null;
    const typeH = { envoi: 'Envoyé', recu: 'Reçu', etape: 'Étape', note: 'Note' };
    const histo = [...(p.historique || [])].reverse().map((h) => `<li><span class="h-date">${fmt(h.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="h-type ${h.type}">${typeH[h.type] || ''}</span><span>${h.type === 'etape' ? `${h.recontact ? 'Recontact : ' : ''}${esc(etape(h.etape).nom)}${h.motif ? ` (${esc(motif(h.motif))})` : ''}` : `${esc(canal(h.canal))}${h.texte ? ` · ${esc(h.texte)}` : ''}`}</span></li>`).join('');
    const statut = p.oppose ? `<p class="alerte">Opposition à la prospection le ${fmt(p.oppose, { day: 'numeric', month: 'long', year: 'numeric' })} : ne pas recontacter. Seuls le nom, l'organisation et la date sont gardés.</p>`
      : `<div class="fiche-statut">
          <div><span class="surtitre">Prochaine relance</span><b class="${d && d < auj() ? 'retard' : ''}">${d ? quand(d) : fini ? 'Cadence terminée' : '–'}</b><small>${r ? `${esc(cad?.nom)} · relance ${r.index + 1} sur ${r.total} · ${esc(canal(r.canal))}` : p.cadence && cad ? `${esc(cad.nom)} terminée` : R.estFini(p, B.etapes) ? (p.etape === 'perdu' ? esc(motif(p.motif)) : 'Premier contrat obtenu') : 'Action datée à la main'}</small></div>
          <label class="champ">Étape<select data-action-change="etape" data-id="${p.id}">${B.etapes.map((e) => `<option value="${e.id}" ${e.id === p.etape ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
        </div>
        <div class="fiche-actions">
          ${R.estFini(p, B.etapes) ? `<button type="button" class="btn petit" data-action="recontacter" data-id="${p.id}">Recontacter plus tard</button>` : `
          <button type="button" class="btn petit jaune" data-action="message" data-id="${p.id}">Préparer le message</button>
          <button type="button" class="btn petit" data-action="envoye" data-id="${p.id}">Envoyé</button>
          <button type="button" class="btn petit" data-action="repondu" data-id="${p.id}">A répondu</button>
          <button type="button" class="btn petit" data-action="reporter-date" data-id="${p.id}">Reporter</button>
          ${fini ? `<button type="button" class="btn petit" data-action="recontacter" data-id="${p.id}">Recontacter plus tard</button>` : ''}`}
          <button type="button" class="btn petit" data-action="note" data-id="${p.id}">Ajouter une note</button>
        </div>`;
    const corps = `
      <div class="fiche-entete"><p>${p.oppose ? '<span class="etiquette rouge">Opposé</span>' : pastilleEtape(p.etape)}</p>
        <p class="fiche-org">${esc([p.fonction, p.organisation].filter(Boolean).join(' · ') || '–')}</p>
        <p class="fiche-meta">${esc(canal(p.canal))}${p.source ? ` · source : ${esc(p.source)}` : ''}${p.creeLe ? ` · ajouté le ${fmt(p.creeLe, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
        ${p.coordonnee ? `<p class="fiche-meta">${esc(p.coordonnee)}</p>` : ''}
        ${p.notes ? `<p class="fiche-notes">${esc(p.notes)}</p>` : ''}</div>
      ${statut}
      ${!p.oppose ? `<h3 class="sous-titre">Historique</h3>${histo ? `<ol class="historique">${histo}</ol>` : '<p class="liste-vide">Aucun échange noté.</p>'}` : ''}`;
    const pied = p.oppose ? '<button class="btn primaire" value="ok">Fermer</button><button class="btn danger gauche" value="supprimer">Supprimer définitivement</button>'
      : '<button class="btn primaire" value="ok">Fermer</button><button class="btn" value="modifier">Modifier la fiche</button><button class="btn danger gauche" value="opposition">Opposition</button>';
    ouvrirModale(esc(nomComplet(p)), corps, pied, (f, action) => {
      if (action === 'modifier') { setTimeout(() => modaleProspect(p.id), 0); return; }
      if (action === 'supprimer') { supprimer(p.id); return; }
      if (action === 'opposition') {
        if (!confirm(`${nomComplet(p)} s'oppose à la prospection ? Toute relance s'arrête ; coordonnée, notes et historique sont effacés.`)) return false;
        annulation = { id: p.id, avant: copie(p) };
        remplacer(R.opposer(p, auj()));
        sauver(); rendre(); toast('Opposition enregistrée : plus aucune relance.', { libelle: 'Annuler', faire: annuler });
      }
    });
    modale().querySelector('[data-action-change="etape"]')?.addEventListener('change', (e) => {
      const cible = e.target.value;
      if (cible === 'perdu') { modalePerdu(p.id); return; }
      modale().close();
      deplacer(p.id, cible);
    });
  }

  function supprimer(id) {
    const p = prospect(id);
    if (!p || !confirm(`Supprimer définitivement ${nomComplet(p)} et son historique ?`)) return;
    const i = E.prospects.indexOf(p);
    annulation = { id, avant: copie(p), index: i, supprime: true };
    E.prospects.splice(i, 1);
    if (apercu === id) apercu = '';
    sauver(); rendre();
    toast(`${nomComplet(p)} supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  // Message préparé : script choisi, variables remplies, copie en un clic.
  function modaleMessage(id) {
    const p = prospect(id);
    if (!p) return;
    const r = R.relanceCourante(p, E.cadences);
    const defaut = (r && script(r.script)?.id) || E.scripts.find((s) => s.etape === p.etape)?.id || E.scripts[0]?.id;
    if (!defaut) { toast('Aucun script : ajoute-en un dans l\'onglet Scripts.'); return; }
    const canalEnvoi = r?.canal || p.canal;
    const corps = `
      <p class="aide">${r ? `Relance ${r.index + 1} sur ${r.total} de la cadence « ${esc(r.cadence.nom)} », par <b>${esc(canal(canalEnvoi))}</b>.` : `Canal : <b>${esc(canal(canalEnvoi))}</b>.`} Relis et personnalise avant d'envoyer.</p>
      <label class="champ">Script<select id="choix-script">${B.etapes.map((e) => { const l = E.scripts.filter((s) => s.etape === e.id); return l.length ? `<optgroup label="${esc(e.nom)}">${l.map((s) => `<option value="${s.id}" ${s.id === defaut ? 'selected' : ''}>${esc(s.titre)} (${esc(canal(s.canal))})</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
      <div id="zone-message"></div>
      <input type="hidden" name="canal" value="${canalEnvoi}">
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Message pour ${esc(nomComplet(p))}`, corps,
      '<button class="btn primaire" value="ok">Marquer comme envoyé</button><button class="btn" value="annuler">Fermer</button>', (f) => {
        const s = script($('#choix-script').value);
        envoye(p.id, f.get('canal'), s?.titre);
      });
    const remplir = () => {
      const s = script($('#choix-script').value);
      const o = R.remplirScript(s.objet || '', valeurs(p));
      const tx = R.remplirScript(s.texte, valeurs(p));
      const manq = [...new Set([...o.manquantes, ...tx.manquantes])];
      $('#zone-message').innerHTML = `
        ${s.objet ? `<label class="champ">Objet<span class="rang-copie"><input id="msg-objet" value="${esc(o.texte)}"><button type="button" class="btn petit" data-action="copier" data-cible="msg-objet">Copier</button></span></label>` : ''}
        <label class="champ">Message<textarea id="msg-texte" rows="10">${esc(tx.texte)}</textarea></label>
        ${manq.length ? `<p class="alerte">À compléter : ${manq.map((m) => `<b>[${esc(m)}]</b>`).join(', ')} est vide dans la fiche ou les réglages.</p>` : ''}
        ${/\[[^\]]+\]/.test(tx.texte.replace(/\[(prénom|nom|organisation|fonction|mon prénom|mon activité)\]/g, '')) ? '<p class="aide">Les passages entre crochets sont à remplacer par tes propres mots.</p>' : ''}
        <button type="button" class="btn jaune" data-action="copier" data-cible="msg-texte" style="width:100%">Copier le message</button>`;
    };
    remplir();
    $('#choix-script').addEventListener('change', remplir);
  }

  async function copierTexte(texte) {
    try { await navigator.clipboard.writeText(texte); return true; } catch {
      const zone = document.createElement('textarea');
      zone.value = texte; zone.setAttribute('readonly', ''); zone.style.position = 'fixed'; zone.style.opacity = '0';
      (modale().open ? modale() : document.body).appendChild(zone);
      zone.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      zone.remove();
      return ok;
    }
  }

  function modaleDate(titre, texte, defaut, bouton, faire) {
    ouvrirModale(titre, `<p>${texte}</p><label class="champ">Date<input type="date" name="date" value="${defaut}" min="${auj()}" required></label><p class="erreur" role="alert"></p>`,
      `<button class="btn primaire" value="ok">${bouton}</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
        const d = f.get('date');
        if (!d) return 'Choisis une date.';
        faire(d);
      });
  }

  function modalePerdu(id) {
    const p = prospect(id);
    ouvrirModale(`Classer ${esc(nomComplet(p))} en perdu`, `<label class="champ">Motif<select name="motif">${B.motifsPerte.map((m) => `<option value="${m.id}" ${R.cadenceTerminee(p, E.cadences, B.etapes) && m.id === 'sans-reponse' ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label><p class="aide">Un prospect perdu garde l'étape la plus avancée qu'il a atteinte dans les chiffres. Tu pourras le recontacter plus tard.</p>`,
      '<button class="btn primaire" value="ok">Classer perdu</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        setTimeout(() => deplacer(id, 'perdu', { motif: f.get('motif') }), 0);
      });
  }

  function modaleRecontacter(id) {
    const p = prospect(id);
    ouvrirModale(`Recontacter ${esc(nomComplet(p))}`, `<p>Une nouvelle cadence démarre à la date choisie ; le prospect revient dans « ${(p.etapeMax ?? 0) >= 1 ? 'Contacté' : 'À contacter'} ».</p>
      <label class="champ">Cadence<select name="cadence">${optionsCadence(E.cadences.some((c) => c.id === 'douce') ? 'douce' : E.reglages.cadenceDefaut)}</select></label>
      <label class="champ">Premier message le<input type="date" name="date" value="${ajout(auj(), 60)}" min="${auj()}"></label><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Programmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = f.get('date') || auj();
      annulation = { id, avant: copie(p) };
      const n = remplacer(R.recontacter(p, B.etapes, f.get('cadence'), date));
      sauver(); rendre(); toast(`${nomComplet(n)} : premier message ${quand(date)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleNote(id) {
    const p = prospect(id);
    ouvrirModale('Ajouter une note', `<label class="champ">Date<input type="date" name="date" value="${auj()}" max="${auj()}"></label><label class="champ">Note<textarea name="texte" maxlength="400" required></textarea></label><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const texte = String(f.get('texte') || '').trim();
        if (!texte) return 'Écris la note.';
        (p.historique ||= []).push({ date: f.get('date') || auj(), type: 'note', canal: p.canal, texte });
        p.historique.sort((a, b) => a.date.localeCompare(b.date));
        sauver(); rendre(); setTimeout(() => modaleFiche(id), 0);
      });
  }

  function modaleScript(id) {
    const s = id ? script(id) : null;
    const corps = `
      <label class="champ">Titre<input name="titre" required maxlength="80" value="${esc(s?.titre || '')}"></label>
      <div class="deux"><label class="champ">Étape<select name="etape">${B.etapes.map((e) => `<option value="${e.id}" ${e.id === (s?.etape || 'cible') ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
      <label class="champ">Canal<select name="canal">${optionsCanal(s?.canal || 'email')}</select></label></div>
      <label class="champ">Objet<small>Pour un e-mail ; laisse vide sinon.</small><input name="objet" maxlength="140" value="${esc(s?.objet || '')}"></label>
      <label class="champ">Texte<small>Variables : ${B.variables.map((v) => `{${v}}`).join(' ')}</small><textarea name="texte" rows="9" maxlength="3000" required>${esc(s?.texte || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const utilise = s && E.cadences.some((c) => c.relances.some((r) => r.script === s.id));
    const pied = s ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? 'Modifier le script' : 'Nouveau script', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (utilise) return 'Ce script est utilisé par une cadence : choisis-en un autre dans la cadence avant de le supprimer.';
        if (!confirm(`Supprimer le script « ${s.titre} » ?`)) return false;
        E.scripts = E.scripts.filter((x) => x.id !== s.id);
        sauver(); rendre(); toast('Script supprimé.');
        return;
      }
      const v = { titre: String(f.get('titre') || '').trim(), etape: f.get('etape'), canal: f.get('canal'), objet: String(f.get('objet') || '').trim(), texte: String(f.get('texte') || '').trim() };
      if (!v.titre || !v.texte) return 'Indique un titre et un texte.';
      if (s) Object.assign(s, v); else E.scripts.push({ id: uid(), ...v });
      sauver(); rendre(); toast(s ? 'Script enregistré.' : 'Script créé.');
    });
  }

  function modaleCadence(id) {
    const c = id ? E.cadences.find((x) => x.id === id) : null;
    const lignes = [...(c?.relances || [{ delai: 0, canal: 'email', script: E.scripts[0]?.id }]), {}, {}];
    const optScripts = (sel) => `<option value="">Sans script</option>${E.scripts.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.titre)}</option>`).join('')}`;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(c?.nom || '')}"></label>
      <label class="champ">Description<input name="description" maxlength="140" value="${esc(c?.description || '')}"></label>
      <p class="aide">Délai en jours depuis le message précédent (le premier : depuis la date de départ, 0 = le jour même). Laisse le délai vide pour retirer une ligne.</p>
      <div class="relances-edition">${lignes.map((r, i) => `<div class="relance-ligne"><span class="num">${i + 1}</span>
        <label class="champ"><span class="sr-only">Délai de la relance ${i + 1}</span><input type="number" name="delai_${i}" min="0" max="365" value="${r.delai ?? ''}" placeholder="jours" inputmode="numeric"></label>
        <label class="champ"><span class="sr-only">Canal</span><select name="canal_${i}">${optionsCanal(r.canal || 'email')}</select></label>
        <label class="champ"><span class="sr-only">Script</span><select name="script_${i}">${optScripts(r.script)}</select></label></div>`).join('')}</div>
      <label class="case"><input type="checkbox" name="defaut" ${E.reglages.cadenceDefaut === c?.id ? 'checked' : ''}> Cadence par défaut des nouveaux prospects</label>
      <p class="erreur" role="alert"></p>`;
    const n = c ? E.prospects.filter((p) => p.cadence?.id === c.id).length : 0;
    const pied = c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier la cadence' : 'Nouvelle cadence', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (n) return `Utilisée par ${pluriel(n, 'prospect')} : impossible de la supprimer.`;
        if (E.cadences.length < 2) return 'Garde au moins une cadence.';
        if (!confirm(`Supprimer la cadence « ${c.nom} » ?`)) return false;
        E.cadences = E.cadences.filter((x) => x.id !== c.id);
        if (E.reglages.cadenceDefaut === c.id) E.reglages.cadenceDefaut = E.cadences[0].id;
        sauver(); rendre(); toast('Cadence supprimée.');
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la cadence.';
      const relances = lignes.map((_, i) => ({ d: String(f.get(`delai_${i}`) ?? '').trim(), canal: f.get(`canal_${i}`), script: f.get(`script_${i}`) || null }))
        .filter((r) => r.d !== '').map((r) => ({ delai: Number(r.d), canal: r.canal, script: r.script }));
      if (!relances.length) return 'Ajoute au moins une relance.';
      if (relances.some((r) => !Number.isInteger(r.delai) || r.delai < 0 || r.delai > 365)) return 'Délais : nombres entiers entre 0 et 365.';
      const v = { nom, description: String(f.get('description') || '').trim(), relances };
      let cible = c;
      if (c) Object.assign(c, v); else { cible = { id: uid(), ...v }; E.cadences.push(cible); }
      if (f.get('defaut')) E.reglages.cadenceDefaut = cible.id;
      // Un prospect au-delà de la nouvelle longueur passe en « cadence terminée ».
      sauver(); rendre(); toast(c ? 'Cadence enregistrée.' : 'Cadence créée.');
    });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="deux"><label class="champ">Ton prénom<small>{mon prénom}</small><input name="monPrenom" maxlength="40" value="${esc(r.monPrenom)}"></label>
      <label class="champ">Cadence par défaut<small>Nouveaux prospects.</small><select name="cadenceDefaut">${optionsCadence(r.cadenceDefaut)}</select></label></div>
      <label class="champ">Ton activité en une phrase<small>{mon activité}</small><input name="monActivite" maxlength="160" value="${esc(r.monActivite)}"></label>
      <div class="deux"><label class="champ">Prochaine action (jours)<small>En échange ou rendez-vous.</small><input type="number" name="delaiAction" min="1" max="90" value="${r.delaiAction}"></label>
      <label class="champ">Revoir après (mois)<small>RGPD, défaut ${B.rgpd.conservationMois}.</small><input type="number" name="conservationMois" min="1" max="120" value="${r.conservationMois}"></label></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <p class="mention">Aucune automatisation : l'application n'envoie aucun message et ne se connecte à aucun réseau. Repères RGPD : onglet Prospects.</p>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const delai = Number(f.get('delaiAction')), mois = Number(f.get('conservationMois'));
      if (!Number.isInteger(delai) || delai < 1 || delai > 90) return 'Prochaine action : entre 1 et 90 jours.';
      if (!Number.isInteger(mois) || mois < 1 || mois > 120) return 'Durée de revue : entre 1 et 120 mois.';
      Object.assign(r, { monPrenom: String(f.get('monPrenom') || '').trim(), monActivite: String(f.get('monActivite') || '').trim(), cadenceDefaut: f.get('cadenceDefaut'), delaiAction: delai, conservationMois: mois });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.prospects)) throw new Error();
        if (!confirm(`Remplacer ton pipeline actuel par cette copie (${pluriel(d.prospects.length, 'prospect')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du pipeline.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pipeline-prospection-${auj()}.json`;
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
  function envoye(id, canalEnvoi, texte) {
    const p = prospect(id);
    if (!p) return;
    const r = R.relanceCourante(p, E.cadences);
    annulation = { id, avant: copie(p) };
    const n = remplacer(R.enregistrerEnvoi(p, E.cadences, B.etapes, { date: auj(), canal: canalEnvoi || r?.canal || p.canal, texte: texte || (r ? script(r.script)?.titre : '') || '', delaiAction: E.reglages.delaiAction }));
    sauver();
    const d = prochaine(n);
    const suite = () => { rendre(); toast(`${nomComplet(n)} : ${d ? `prochaine relance ${quand(d)}` : 'cadence terminée'}.`, { libelle: 'Annuler', faire: annuler }); };
    const carte = document.querySelector(`.carte[data-carte="${id}"]`);
    if (carte && !matchMedia('(prefers-reduced-motion: reduce)').matches) { carte.classList.add('sortie'); setTimeout(suite, 220); } else suite();
  }

  function repondu(id) {
    const p = prospect(id);
    annulation = { id, avant: copie(p) };
    const n = remplacer(R.enregistrerReponse(p, B.etapes, { date: auj(), canal: p.canal, texte: 'Réponse reçue' }));
    sauver(); rendre();
    toast(`${nomComplet(n)} : ${etape(n.etape).nom}, prochaine action ${quand(prochaine(n))}.`, { libelle: 'Annuler', faire: annuler });
  }

  function reporter(id, date) {
    const p = prospect(id);
    annulation = { id, avant: copie(p) };
    p.reporteAu = date;
    if (!p.cadence && (!p.action || p.action < date)) p.action = date;
    sauver(); rendre();
    toast(`${nomComplet(p)} : relance reportée ${quand(prochaine(p))}.`, { libelle: 'Annuler', faire: annuler });
  }

  function annuler() {
    if (!annulation) return;
    const a = annulation;
    annulation = null;
    if (a.supprime) E.prospects.splice(Math.min(a.index, E.prospects.length), 0, a.avant);
    else if (a.avant === null) E.prospects = E.prospects.filter((p) => p.id !== a.id);
    else remplacer(a.avant);
    sauver(); rendre();
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'acc-cadence': accueil.cadence = id; document.querySelectorAll('[data-action="acc-cadence"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'prospect-nouveau': modaleProspect(); break;
      case 'prospect-plusieurs': modalePlusieurs(); break;
      case 'fiche': modaleFiche(id); break;
      case 'message': modaleMessage(id); break;
      case 'envoye': fermer(); envoye(id); break;
      case 'repondu': fermer(); repondu(id); break;
      case 'reporter': reporter(id, ajout(auj(), 1)); break;
      case 'reporter-date': modaleDate('Reporter la relance', `Relance de ${esc(nomComplet(prospect(id)))} décalée à la date choisie, sans compter de message.`, ajout(auj(), 1), 'Reporter', (d) => reporter(id, d)); break;
      case 'perdu': modalePerdu(id); break;
      case 'recontacter': modaleRecontacter(id); break;
      case 'note': modaleNote(id); break;
      case 'etape-suivante': { const p = prospect(id); const s = PIPE[PIPE.findIndex((x) => x.id === p.etape) + 1]; if (s) deplacer(id, s.id); break; }
      case 'colonne': colonneTel = id; rendre(); break;
      case 'voir-perdus': voirPerdus = !voirPerdus; if (!voirPerdus && colonneTel === 'perdu') colonneTel = 'cible'; rendre(); break;
      case 'filtre': filtre = id; if (vue !== 'prospects') changerVue('prospects'); else rendre(); break;
      case 'periode': periode = id; rendre(); break;
      case 'script-nouveau': modaleScript(); break;
      case 'script-modifier': modaleScript(id); break;
      case 'cadence-modifier': modaleCadence(id); break;
      case 'cadence-nouvelle': modaleCadence(); break;
      case 'scripts-origine': {
        if (!confirm('Remettre les scripts d\'origine ? Tes scripts modifiés ou ajoutés seront remplacés.')) break;
        const avant = copie(E.scripts);
        E.scripts = copie(B.scripts);
        // Les cadences personnelles qui visaient un script disparu restent sans script.
        E.cadences.forEach((c) => c.relances.forEach((r) => { if (r.script && !script(r.script)) r.script = null; }));
        sauver(); rendre();
        toast('Scripts d\'origine remis.', { libelle: 'Annuler', faire: () => { E.scripts = avant; sauver(); rendre(); } });
        break;
      }
      case 'copier-script': {
        const s = script(id);
        const p = apercu ? prospect(apercu) : null;
        const tx = p ? R.remplirScript(s.texte, valeurs(p)).texte : s.texte;
        toast(await copierTexte(tx) ? 'Script copié.' : 'Copie impossible : sélectionne le texte à la main.');
        break;
      }
      case 'copier': {
        const champ = document.getElementById(el.dataset.cible);
        if (champ) toast(await copierTexte(champ.value) ? (el.dataset.cible === 'msg-objet' ? 'Objet copié.' : 'Message copié : colle-le dans ta messagerie.') : 'Copie impossible : sélectionne le texte à la main.');
        break;
      }
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'apercu') { apercu = e.target.value; rendre(); }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (vue === 'aujourdhui' && !modale().open) rendre();
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
  window.__prospection = { etat: () => E, regles: R };
  init();
})();
