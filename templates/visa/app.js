// Circuit de visa des documents QME : registre, avis, délais et relances, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'VSA';
  const CLE_CODE = 'qme-vsa-code';
  const CLE_CACHE = 'qme-vsa-cache';
  const CLE_DEMO = 'qme-vsa-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-vsa-ecran-accueil';

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
  const { versDate, ajout, ecart, dateFr } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const quand = (s) => {
    if (!s) return '–';
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return fmt(s);
  };
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const AVIS = Object.fromEntries(B.avis.map((a) => [a.code, a]));
  const pastille = (code) => (code ? `<span class="code-avis c-${code}" title="${esc(AVIS[code].nom)}">${code}</span>` : '');
  const nomType = (code) => B.types.find((t) => t.code === code)?.nom || code || '';

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'pilotage';
  let annulation = null;
  const filtres = { lot: '', statut: 'ouverts', texte: '' };

  const etatVide = () => ({ version: 1, reglages: { ...B.reglages }, operationActive: null, operations: [], documents: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const ops = Array.isArray(d.operations) ? d.operations.map((o) => ({ lots: [], viseurs: [], ...o, lots: Array.isArray(o.lots) ? o.lots : [], viseurs: Array.isArray(o.viseurs) ? o.viseurs : [] })) : [];
    const docs = Array.isArray(d.documents) ? d.documents.map((x) => ({ viseurIds: [], indices: [], relances: [], ...x })) : [];
    const n = { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) }, operations: ops, documents: docs };
    if (!n.operations.some((o) => o.id === n.operationActive)) n.operationActive = n.operations[0]?.id || null;
    return n;
  };
  const op = () => E.operations.find((o) => o.id === E.operationActive) || null;
  const regl = () => R.reglagesOperation(E.reglages, op());
  const docsOp = () => (op() ? E.documents.filter((d) => d.operationId === op().id) : []);
  const lot = (id) => op()?.lots.find((l) => l.id === id);
  const viseur = (id) => op()?.viseurs.find((v) => v.id === id);
  const documentPar = (id) => E.documents.find((d) => d.id === id);
  const etatDe = (d) => R.etatDocument(d, regl(), auj());
  const lotsTries = () => [...(op()?.lots || [])].sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }));

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
        toast('Un autre appareil a modifié le registre entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code VSA-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('VSA')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('VSA') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
      if (E.operations.length) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.operations.length) { cache(false); demarrer(); } else ecranAccueil();
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

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    const D = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const lotDe = (code, numero, entreprise, c) => { const b = B.lots.find((l) => l.code === code); return { id: uid(), code, numero, nom: b.nom, entreprise, couleur: c }; };
    const creerOp = (nom, type, moa, lots, viseurs, extra = {}) => {
      const o = { id: uid(), nom, type, moa, delaiVisa: null, delaiResoumission: null, lots, viseurs: viseurs.map(([n, role]) => ({ id: uid(), nom: n, role })), ...extra };
      D.operations.push(o);
      return o;
    };
    // doc(opération, n° de lot, type, titre, viseurs (rangs), prévu (j), cycles [[reçu j, [[viseur, code, j, obs]]]], relances [[j, cible, indice]])
    const doc = (o, li, type, titre, vis, prevu, cycles = [], relances = []) => {
      const l = o.lots[li];
      const numero = R.numeroSuivant(D.documents.filter((x) => x.operationId === o.id).map((x) => x.numero), `${l.code}-${type}`);
      let indice = '';
      const d = { id: uid(), operationId: o.id, lotId: l.id, numero, titre, type, viseurIds: vis.map((k) => o.viseurs[k].id), prevuLe: prevu === null ? null : j(prevu), indices: [], relances: [] };
      cycles.forEach(([recu, avis]) => {
        indice = R.indiceSuivant(indice);
        d.indices.push({ id: uid(), indice, recuLe: j(recu), avis: avis.map(([k, code, date, observations = '']) => ({ viseurId: o.viseurs[k].id, code, date: j(date), observations })) });
      });
      d.relances = relances.map(([date, cible, ind]) => ({ date: j(date), cible, indice: ind }));
      D.documents.push(d);
      return d;
    };

    const o1 = creerOp('Immeuble de bureaux Quai Nord', 'tertiaire', 'Maître d\'ouvrage fictif A', [
      lotDe('GO', '03', 'Entreprise Alpha', 'encre'), lotDe('FAC', '06', 'Entreprise Bravo', 'rouge'), lotDe('MEX', '07', 'Entreprise Charlie', 'bleu'),
      lotDe('CLO', '09', 'Entreprise Delta', 'prune'), lotDe('PLB', '13', 'Entreprise Echo', 'ciel'), lotDe('CVC', '14', 'Entreprise Echo', 'vert'), lotDe('CFO', '15', 'Entreprise Foxtrot', 'jaune'),
    ], [['Atelier d\'architecture fictif', 'Architecte'], ['BET Structure fictif', 'BET structure'], ['BET Fluides fictif', 'BET fluides'], ['Contrôleur technique fictif', 'Contrôleur technique']]);
    // Gros œuvre
    doc(o1, 0, 'PEX', 'Plans de fondations', [0, 1], -80, [[-78, [[1, 'REF', -66, 'Semelles S4 à S7 sous-dimensionnées au regard de la note de calcul.'], [0, 'VAO', -70]]], [-55, [[1, 'VSO', -47], [0, 'VSO', -49]]]]);
    doc(o1, 0, 'NDC', 'Note de calcul de structure', [1, 3], -82, [[-81, [[1, 'VAO', -69, 'Préciser les hypothèses de charges en toiture terrasse.'], [3, 'VSO', -70]]], [-50, [[1, 'VSO', -40], [3, 'VSO', -38]]]]);
    doc(o1, 0, 'PEX', 'Plans de coffrage R+1', [0, 1], -45, [[-44, [[1, 'VSO', -33], [0, 'VAO', -31, 'Trémie escalier B à recaler sur le plan architecte indice C.']]]]);
    doc(o1, 0, 'PEX', 'Plans de coffrage R+2', [0, 1], -20, [[-19, [[0, 'VSO', -9]]]], [[-1, 'viseurs', 'A']]); // avis partiel, en retard, relancé hier
    doc(o1, 0, 'RES', 'Plans de réservations', [0, 1, 2], -30, [[-29, [[2, 'REF', -16, 'Réservations CVC non reportées au niveau R+1.'], [0, 'VAO', -18], [1, 'VAO', -17]]]], [[-9, 'emetteur', '>A']]);
    // Façades
    doc(o1, 1, 'CAL', 'Calepinage des façades', [0], -60, [[-58, [[0, 'VAO', -45, 'Aligner les joints verticaux sur la trame des menuiseries.']]], [-30, [[0, 'VSO', -24]]]]);
    doc(o1, 1, 'DET', 'Carnet de détails de façade', [0, 3], -10, [[-12, []]]); // échéance dans 3 j : alerte
    doc(o1, 1, 'ECH', 'Échantillon de parement', [0], 5);
    // Menuiseries extérieures
    doc(o1, 2, 'PEX', 'Plans et coupes des menuiseries', [0, 3], -52, [[-50, [[0, 'REF', -38, 'Seuils non conformes au plan d\'accessibilité.'], [3, 'VAO', -39]]]], [[-22, 'emetteur', '>A'], [-14, 'emetteur', '>A']]);
    doc(o1, 2, 'FT', 'Fiches techniques des vitrages', [0, 3], -35, [[-34, [[0, 'VSO', -27], [3, 'VSO', -25]]]]);
    doc(o1, 2, 'NDC', 'Note de calcul des menuiseries', [1], -6); // attendu, en retard
    // Cloisons
    doc(o1, 3, 'PEX', 'Plans de cloisonnement', [0], -25, [[-26, [[0, 'VAO', -15, 'Indice B à transmettre avec les cloisons coupe-feu repérées.']]], [-4, []]]);
    doc(o1, 3, 'FT', 'Fiches techniques des cloisons', [0, 3], 12);
    // Plomberie
    doc(o1, 4, 'SCH', 'Schéma de principe de production d\'eau chaude', [2], -40, [[-40, [[2, 'VSO', -30]]]]);
    doc(o1, 4, 'PEX', 'Plans des réseaux de plomberie', [2, 0], -16, [[-15, [[0, 'VSO', -6]]]]);
    // CVC
    doc(o1, 5, 'NDC', 'Note de dimensionnement', [2, 3], -70, [[-68, [[2, 'REF', -55, 'Débits d\'air neuf à justifier par local.'], [3, 'VAO', -57]]], [-40, [[2, 'VAO', -28, 'Compléter le bilan des puissances.'], [3, 'VSO', -30]]], [-11, [[2, 'VSO', -3], [3, 'VSO', -2]]]]);
    doc(o1, 5, 'PEX', 'Plans des réseaux aérauliques', [2, 0], -14, [[-13, []]], [[-9, 'viseurs', 'A']]); // échéance dans 2 j
    doc(o1, 5, 'FT', 'Fiches techniques des équipements', [2], -24, [[-23, [[2, 'REF', -18, 'Matériel différent de la note de dimensionnement.']]]]);
    doc(o1, 5, 'RES', 'Plans de réservations', [2, 1], -2, [[-1, []]]);
    // Électricité
    doc(o1, 6, 'SCH', 'Schémas des tableaux électriques', [2, 3], -36, [[-37, [[2, 'VAO', -24, 'Sélectivité à justifier.'], [3, 'VAO', -26]]], [-8, [[3, 'VSO', -3]]]]);
    doc(o1, 6, 'PEX', 'Plans d\'éclairage', [0, 2], -18, [[-17, [[0, 'VSO', -8], [2, 'VSO', -7]]]]);
    doc(o1, 6, 'FT', 'Fiches techniques des luminaires', [0], 9);

    const o2 = creerOp('Résidence Les Aulnes · 42 logements', 'logement', 'Bailleur fictif B', [
      lotDe('GO', '02', 'Entreprise Golf', 'encre'), lotDe('MEX', '05', 'Entreprise Hôtel', 'bleu'), lotDe('PLB', '11', 'Entreprise India', 'ciel'),
    ], [['Atelier d\'architecture fictif', 'Architecte'], ['BET TCE fictif', 'BET fluides']], { delaiVisa: 10 });
    doc(o2, 0, 'PEX', 'Plans de fondations', [0, 1], -30, [[-28, [[0, 'VSO', -20], [1, 'VSO', -19]]]]);
    doc(o2, 0, 'NDC', 'Note de calcul de structure', [1], -12, [[-14, []]]);
    doc(o2, 1, 'PEX', 'Plans et coupes des menuiseries', [0], -3);
    doc(o2, 2, 'PEX', 'Plans des réseaux de plomberie', [1], 10);

    creerOp('Groupe scolaire des Coteaux', 'equipement', 'Collectivité fictive C', [lotDe('GO', '02', 'Entreprise Juliett', 'encre'), lotDe('CH', '04', 'Entreprise Kilo', 'orange')],
      [['Atelier d\'architecture fictif', 'Architecte']]);
    D.operationActive = o1.id;
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Circuit de visa des documents · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="200" height="260" fill="#F0EDE6"/>
          <rect x="40" y="60" width="140" height="16" fill="#141414"/><rect x="40" y="100" width="100" height="16" fill="#141414"/><rect x="40" y="140" width="120" height="16" fill="#141414"/>
          <circle cx="210" cy="230" r="70" fill="#1D4E89"/>
          <rect x="300" y="20" width="250" height="125" fill="#F5B400"/>
          <path d="M300 280 A125 125 0 0 1 425 155 H550 V280 Z" fill="#D9302A"/>
          <circle cx="425" cy="82" r="36" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Circuit de visa · registre des documents</p>
          <h1>Chaque document visé dans les délais.</h1>
          <p>Indices, avis VSO, VAO ou REF de chaque viseur, échéances calculées et relances prêtes à envoyer, lot par lot.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton registre</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton registre est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon registre</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon registre'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const LOTS_PAR_TYPE = {
    tertiaire: ['GO', 'FAC', 'MEX', 'CLO', 'SOL', 'PLB', 'CVC', 'CFO', 'CFA', 'ASC'],
    logement: ['GO', 'COU', 'MEX', 'SER', 'CLO', 'MIN', 'SOL', 'PEI', 'PLB', 'CVC', 'CFO'],
    equipement: ['VRD', 'GO', 'CH', 'COU', 'MEX', 'CLO', 'SOL', 'PLB', 'CVC', 'CFO', 'CFA', 'ESV'],
    autre: ['GO', 'MEX', 'CLO', 'PLB', 'CVC', 'CFO'],
  };
  const ROLES_DEFAUT = ['Architecte', 'BET structure', 'BET fluides'];
  let accueil = { etape: 1, nom: '', moa: '', type: null, lots: new Set(), roles: new Set(ROLES_DEFAUT) };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Ta première opération.</h1>
        <p class="intro">Le registre est rangé par opération, puis par lot. Tu pourras en créer d'autres ensuite et tout modifier.</p>
        <div class="grille-champs">
          <label class="champ">Nom de l'opération<input id="op-nom" value="${esc(a.nom)}" maxlength="80" placeholder="Ex. : Bureaux rue des Écoles"></label>
          <label class="champ">Maître d'ouvrage <small>Facultatif.</small><input id="op-moa" value="${esc(a.moa)}" maxlength="80"></label>
        </div>
        <h2 class="titre-section">Type d'opération <span>Les lots usuels sont proposés selon ton choix.</span></h2>
        <div class="filieres" role="group" aria-label="Type d'opération">
          ${B.typesOperation.map((x, i) => `<button type="button" class="filiere" style="--c:${couleur(['rouge', 'bleu', 'jaune', 'encre'][i % 4])}" data-action="type-op" data-id="${x.id}" aria-pressed="${a.type === x.id}"><b>${esc(x.nom)}</b><span>${pluriel(LOTS_PAR_TYPE[x.id].length, 'lot proposé', 'lots proposés')}</span></button>`).join('')}
        </div>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.type ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${esc(a.nom)}</p>
        <h1>Lots et viseurs du circuit.</h1>
        <p class="intro">Coche les lots du marché et les intervenants qui visent les documents. Numéros, entreprises et noms se complètent ensuite dans l'onglet Lots.</p>
        <h2 class="titre-section">Lots <span id="nb-lots">${pluriel(a.lots.size, 'lot coché', 'lots cochés')}</span></h2>
        <div class="choix-matieres">${B.lots.map((l) => `<label class="case"><input type="checkbox" data-action="choix-lot" value="${l.code}" ${a.lots.has(l.code) ? 'checked' : ''}> ${esc(l.nom)}</label>`).join('')}</div>
        <h2 class="titre-section">Viseurs <span>Un viseur par rôle ; renomme-les ensuite.</span></h2>
        <div class="choix-matieres">${B.roles.filter((x) => x !== 'Autre').map((r) => `<label class="case"><input type="checkbox" data-action="choix-role" value="${esc(r)}" ${a.roles.has(r) ? 'checked' : ''}> ${esc(r)}</label>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.lots.size ? '' : 'disabled'}>Créer le registre</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#op-nom')?.addEventListener('input', (e) => { accueil.nom = e.target.value; });
    $('#op-moa')?.addEventListener('input', (e) => { accueil.moa = e.target.value; });
  }

  // Lot créé depuis la base : numéro dans l'ordre de la base.
  const nouveauLot = (code, i) => { const b = B.lots.find((l) => l.code === code); return { id: uid(), code, numero: String(B.lots.indexOf(b) + 1).padStart(2, '0'), nom: b.nom, entreprise: '', couleur: B.couleurs[i % B.couleurs.length].id }; };

  function terminerAccueil() {
    const premier = !E;
    if (!E) E = etatVide();
    const o = { id: uid(), nom: accueil.nom.trim() || 'Mon opération', moa: accueil.moa.trim(), type: accueil.type, delaiVisa: null, delaiResoumission: null,
      lots: B.lots.filter((l) => accueil.lots.has(l.code)).map((l, i) => nouveauLot(l.code, i)),
      viseurs: [...accueil.roles].map((r) => ({ id: uid(), nom: r, role: r })) };
    E.operations.push(o);
    E.operationActive = o.id;
    accueil = { etape: 1, nom: '', moa: '', type: null, lots: new Set(), roles: new Set(ROLES_DEFAUT) };
    sauver();
    vue = premier ? 'lots' : vue;
    demarrer();
    toast(premier ? 'Registre créé. Indique les entreprises des lots, puis ajoute tes documents.' : `Opération « ${o.nom} » créée.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    pilotage: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    registre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    lots: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['pilotage', 'Pilotage'], ['registre', 'Registre'], ['lots', 'Lots'], ['bord', 'Tableau de bord']];
  const TITRES = { pilotage: 'Pilotage', registre: 'Registre', lots: 'Lots et viseurs', bord: 'Tableau de bord' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Circuit<br>de visa</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div>
      <div class="barre-op"><div><span>Opération</span><button data-action="operations" id="choix-op"></button></div></div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${TITRES[vue]} · Circuit de visa`;
    const o = op();
    $('#choix-op').innerHTML = `<b>${esc(o?.nom || 'Aucune opération')}</b><svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M0 0h12L6 8z" fill="currentColor"/></svg>`;
    $('#choix-op').setAttribute('aria-label', `Opération active : ${o?.nom || 'aucune'}. Changer d'opération`);
    $('#vue').innerHTML = { pilotage: vuePilotage, registre: vueRegistre, lots: vueLots, bord: vueBord }[vue]();
    if (vue === 'bord') brancherGraphique();
    if (vue === 'registre') brancherFiltres();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  // Étiquette d'état lisible (texte + couleur, jamais la couleur seule).
  function etiquetteEtat(e) {
    const s = R.STATUTS[e.statut];
    if (e.retard > 0) return `<span class="etiquette rouge">${s.court} · ${e.retard} j de retard</span>`;
    if (e.alerte) return `<span class="etiquette jaune">${s.court} · ${e.restants === 0 ? 'échéance aujourd\'hui' : `J-${e.restants}`}</span>`;
    if (e.statut === 'vso') return '<span class="etiquette bleu">Bon pour exécution</span>';
    if (e.statut === 'vao') return '<span class="etiquette">Visé avec observations</span>';
    return `<span class="etiquette clair">${s.court}${e.restants !== null ? ` · J-${e.restants}` : ''}</span>`;
  }
  const libCible = (x) => {
    if (x.cible === 'viseurs') return x.etat.manquants.map((id) => viseur(id)?.nom).filter(Boolean).join(', ') || 'Viseurs';
    const l = lot(x.doc.lotId);
    return l?.entreprise || `Entreprise du lot ${l?.numero || ''}`;
  };
  const motif = (x) => ({
    attendu: 'Document attendu, non remis',
    visa: x.etat.manquants.length < (x.doc.viseurIds.length || 1) ? `Avis manquant${x.etat.manquants.length > 1 ? 's' : ''} (${x.etat.avisPartiel ? `partiel : ${x.etat.avisPartiel}` : 'partiel'})` : 'Avis attendu',
    resoumettre: `Indice ${R.indiceSuivant(x.etat.indice)} attendu après ${x.etat.code}`,
  }[x.etat.statut] || '');

  // ---------- Pilotage (vue chef de projet) ----------
  function vuePilotage() {
    const o = op();
    if (!o) return vide('Aucune opération', 'Crée une opération pour commencer ton registre.', '<button class="btn primaire" data-action="op-nouvelle">Créer une opération</button>');
    const t = auj();
    const docs = docsOp();
    const r = regl();
    const relances = R.relancesAFaire(docs, r, t);
    const dues = relances.filter((x) => x.due);
    const attente = relances.filter((x) => !x.due);
    const alertes = docs.map((d) => ({ d, e: etatDe(d) })).filter((x) => x.e.alerte).sort((a, b) => a.e.echeance.localeCompare(b.e.echeance));
    const recus = docs.filter((d) => d.indices.some((i) => ecart(i.recuLe, t) <= 7 && i.recuLe <= t)).length;
    const titre = !docs.length ? 'Ajoute tes premiers documents.'
      : dues.length ? `<mark>${pluriel(dues.length, 'relance')}</mark> à faire aujourd'hui.`
        : relances.length ? 'Relances à jour. <mark>Rien à envoyer</mark> aujourd\'hui.' : '<mark>Aucun retard</mark> sur cette opération.';

    // Qui relancer : retards regroupés par destinataire.
    const groupes = new Map();
    relances.forEach((x) => {
      const noms = x.cible === 'viseurs' ? x.etat.manquants.map((id) => viseur(id)?.nom || 'Viseur') : [libCible(x)];
      noms.forEach((n) => { const g = groupes.get(n) || { nom: n, n: 0, max: 0, viseur: x.cible === 'viseurs' }; g.n++; g.max = Math.max(g.max, x.etat.retard); groupes.set(n, g); });
    });
    const parQui = [...groupes.values()].sort((a, b) => b.max - a.max);

    const carte = (x) => {
      const l = lot(x.doc.lotId);
      return `<li class="carte" style="--c:${couleur(l?.couleur)}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-matiere">Lot ${esc(l?.numero)} · ${esc(l?.nom)}${etiquetteEtat(x.etat)}</p>
          <h3><button class="lien-doc" data-action="doc" data-id="${x.doc.id}">${esc(x.doc.numero)}${x.etat.indice ? ` <small>ind. ${esc(x.etat.indice)}</small>` : ''} · ${esc(x.doc.titre)}</button></h3>
          <p class="carte-meta"><span><b>${esc(motif(x))}</b> · à relancer : ${esc(libCible(x))}</span><span>Échéance ${fmt(x.etat.echeance, { day: 'numeric', month: 'short' })}${x.derniere ? ` · dernière relance ${quand(x.derniere)}` : ' · jamais relancé'}</span></p>
        </div>
        <div class="carte-action">${x.due ? `<button class="btn primaire petit" data-action="relancer" data-id="${x.doc.id}">Relancer</button>` : `<span class="prochaine">Prochaine relance ${quand(x.prochaine)}</span><button class="btn petit" data-action="relancer" data-id="${x.doc.id}">Relancer</button>`}</div>
      </li>`;
    };

    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })} · ${esc(o.nom)}</p>
          <h1>${titre}</h1>
          <p class="sous">${pluriel(relances.length, 'document')} en retard · ${pluriel(alertes.length, 'échéance')} sous ${r.alerte} j · ${pluriel(recus, 'document reçu', 'documents reçus')} cette semaine</p>
          <div class="actions">
            <button class="btn primaire" data-action="indice-rapide">${ICONES.plus}Document reçu</button>
            <button class="btn" data-action="avis-rapide">Saisir un avis</button>
          </div>
        </div>
        <aside class="examen-carte ${relances.length ? '' : 'calme'}"><p class="surtitre">Délai de visa</p><div class="compte">${r.delaiVisa}<small>j ${r.ouvres ? 'ouvrés' : ''}</small></div><p>Nouvel indice sous ${r.delaiResoumission} j · relance tous les ${r.frequenceRelance} j${o.delaiVisa ? ' · délai propre à l\'opération' : ''}</p></aside>
      </section>
      <h2 class="titre-section">Relances à faire <span>${dues.length ? 'Le texte est prêt : copie-le ou ouvre-le dans ta messagerie, puis marque la relance comme faite.' : ''}</span></h2>
      ${dues.length ? `<ul class="cartes">${dues.map(carte).join('')}</ul>` : vide(docs.length ? 'Aucune relance due' : 'Registre vide', docs.length ? 'Les documents en retard déjà relancés reviennent ici à la date de la relance suivante.' : 'Ajoute les documents attendus et ceux déjà reçus : les échéances se calculent seules.', docs.length ? '' : `<button class="btn primaire" data-action="doc-nouveau">${ICONES.plus}Document</button>`)}
      ${alertes.length ? `<h2 class="titre-section">Échéances proches <span>Dans les ${r.alerte} prochains jours.</span></h2><div class="liste">${alertes.map(({ d, e }) => ligneDoc(d, e)).join('')}</div>` : ''}
      ${parQui.length ? `<h2 class="titre-section">Qui relancer <span>Retards regroupés par destinataire.</span></h2>
        <div class="defile"><table class="tableau"><thead><tr><th>Destinataire</th><th>Rôle</th><th class="nb">Documents en retard</th><th class="nb">Plus grand retard</th></tr></thead><tbody>${parQui.map((g) => `<tr><td><b>${esc(g.nom)}</b></td><td>${g.viseur ? 'Viseur (avis)' : 'Entreprise (document)'}</td><td class="nb">${g.n}</td><td class="nb">${g.max} j</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${attente.length ? `<details class="faites"><summary>Relancés, en attente de réponse (${attente.length})</summary>${attente.map((x) => ligneDoc(x.doc, x.etat, `Relancé ${quand(x.derniere)} · prochaine relance ${quand(x.prochaine)}`)).join('')}</details>` : ''}`;
  }

  function ligneDoc(d, e, sous) {
    const l = lot(d.lotId);
    return `<button class="ligne" style="--c:${couleur(l?.couleur)}" data-action="doc" data-id="${d.id}"><i></i><div><b>${esc(d.numero)}${e.indice ? ` · ind. ${esc(e.indice)}` : ''} · ${esc(d.titre)}</b><span>Lot ${esc(l?.numero)} ${esc(l?.nom)} · ${sous || `échéance ${quand(e.echeance)}`}</span></div>${etiquetteEtat(e)}</button>`;
  }

  // ---------- Registre ----------
  const FILTRES_STATUT = [['ouverts', 'En cours (non clos)'], ['retard', 'En retard'], ['attendu', 'Attendus'], ['visa', 'En cours de visa'], ['resoumettre', 'Nouvel indice attendu'], ['clos', 'Clos (VSO, VAO)'], ['tous', 'Tous']];
  function documentsFiltres() {
    const txt = filtres.texte.trim().toLowerCase();
    return R.trierDocuments(docsOp(), op().lots).map((d) => ({ d, e: etatDe(d) })).filter(({ d, e }) => {
      if (filtres.lot && d.lotId !== filtres.lot) return false;
      const s = filtres.statut;
      if (s === 'ouverts' && e.clos) return false;
      if (s === 'retard' && !(e.retard > 0)) return false;
      if (s === 'clos' && !e.clos) return false;
      if (['attendu', 'visa', 'resoumettre'].includes(s) && e.statut !== s) return false;
      if (txt && !`${d.numero} ${d.titre} ${nomType(d.type)} ${lot(d.lotId)?.entreprise || ''}`.toLowerCase().includes(txt)) return false;
      return true;
    });
  }

  function vueRegistre() {
    const o = op();
    if (!o) return vide('Aucune opération', 'Crée une opération pour commencer.', '<button class="btn primaire" data-action="op-nouvelle">Créer une opération</button>');
    if (filtres.lot && !lot(filtres.lot)) filtres.lot = '';
    const liste = documentsFiltres();
    const t = auj();
    const lignes = liste.map(({ d, e }) => {
      const l = lot(d.lotId);
      const der = d.indices.at(-1);
      return `<tr style="--c:${couleur(l?.couleur)}" data-action="doc" data-id="${d.id}" tabindex="0">
        <td class="c-lot" data-titre="Lot"><span class="nom-matiere"><i></i>${esc(l?.numero)}</span></td>
        <td class="c-num" data-titre="Numéro"><b>${esc(d.numero)}</b></td>
        <td class="c-titre" data-titre="Titre">${esc(d.titre)}<small>${esc(nomType(d.type))}${l?.entreprise ? ` · ${esc(l.entreprise)}` : ''}</small></td>
        <td class="nb c-ind" data-titre="Indice">${esc(e.indice || '–')}</td>
        <td class="c-date" data-titre="Reçu le">${der ? fmt(der.recuLe, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–'}</td>
        <td class="c-date" data-titre="Échéance">${e.echeance ? fmt(e.echeance, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–'}</td>
        <td class="c-avis" data-titre="Avis">${e.code ? pastille(e.code) : e.avisPartiel ? `<span class="partiel">${pastille(e.avisPartiel)} partiel</span>` : '–'}</td>
        <td class="c-etat" data-titre="Statut">${etiquetteEtat(e)}</td>
      </tr>`;
    }).join('');
    const nomLot = filtres.lot ? lot(filtres.lot) : null;
    return `
      <div class="vue-tete"><div><h1>Registre</h1><p>Tous les documents soumis au visa, par lot. Clique une ligne pour ouvrir la fiche : indices, avis de chaque viseur, relances.</p></div>
        <div class="actions"><button class="btn" data-action="csv">Export CSV</button><button class="btn" data-action="imprimer">Imprimer</button><button class="btn primaire" data-action="doc-nouveau">${ICONES.plus}Document</button></div></div>
      <div class="filtres" role="search">
        <label class="champ">Lot<select id="f-lot"><option value="">Tous les lots</option>${lotsTries().map((l) => `<option value="${l.id}" ${filtres.lot === l.id ? 'selected' : ''}>${esc(l.numero)} · ${esc(l.nom)}</option>`).join('')}</select></label>
        <label class="champ">Statut<select id="f-statut">${FILTRES_STATUT.map(([id, n]) => `<option value="${id}" ${filtres.statut === id ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="champ">Rechercher<input id="f-texte" type="search" value="${esc(filtres.texte)}" placeholder="Numéro, titre, entreprise"></label>
      </div>
      <div class="impression-tete"><b>Registre des visas · ${esc(o.nom)}</b><span>${esc(o.moa || '')} · ${nomLot ? `Lot ${esc(nomLot.numero)} ${esc(nomLot.nom)} · ` : ''}${FILTRES_STATUT.find(([id]) => id === filtres.statut)[1]} · édité le ${dateFr(t)}</span></div>
      <p class="compte-liste">${pluriel(liste.length, 'document')}${liste.length !== docsOp().length ? ` sur ${docsOp().length}` : ''}</p>
      ${liste.length ? `<div class="defile"><table class="tableau registre"><thead><tr><th>Lot</th><th>Numéro</th><th>Titre</th><th class="nb">Ind.</th><th>Reçu le</th><th>Échéance</th><th>Avis</th><th>Statut</th></tr></thead><tbody>${lignes}</tbody></table></div>`
        : vide(docsOp().length ? 'Aucun document pour ce filtre' : 'Registre vide', docsOp().length ? 'Change le lot ou le statut, ou efface la recherche.' : 'Ajoute un document attendu (avec sa date de remise prévue) ou un document déjà reçu.', `<button class="btn primaire" data-action="doc-nouveau">${ICONES.plus}Document</button>`)}`;
  }

  function brancherFiltres() {
    $('#f-lot')?.addEventListener('change', (e) => { filtres.lot = e.target.value; rendre(); });
    $('#f-statut')?.addEventListener('change', (e) => { filtres.statut = e.target.value; rendre(); });
    $('#f-texte')?.addEventListener('input', (e) => {
      filtres.texte = e.target.value;
      const pos = e.target.selectionStart;
      rendre();
      const c = $('#f-texte'); c.focus(); c.setSelectionRange(pos, pos);
    });
  }

  // ---------- Lots et viseurs ----------
  function vueLots() {
    const o = op();
    if (!o) return vide('Aucune opération', 'Crée une opération pour commencer.', '<button class="btn primaire" data-action="op-nouvelle">Créer une opération</button>');
    const docs = docsOp();
    const cartes = lotsTries().map((l) => {
      const ds = docs.filter((d) => d.lotId === l.id).map((d) => ({ d, e: etatDe(d) }));
      const clos = ds.filter((x) => x.e.clos).length;
      const retards = ds.filter((x) => x.e.retard > 0).length;
      const enCours = ds.length - clos;
      return `
      <article class="matiere" style="--c:${couleur(l.couleur)};--t:${texteSur(l.couleur)}">
        <div class="matiere-tete"><div><h2>${esc(l.numero)} · ${esc(l.nom)}</h2><p>${l.entreprise ? esc(l.entreprise) : 'Entreprise à renseigner'}</p></div><button data-action="lot-modifier" data-id="${l.id}">Modifier</button></div>
        <div class="matiere-chiffres"><div><b>${ds.length}</b><span>documents</span></div><div><b>${enCours}</b><span>en cours</span></div><div><b style="${retards ? 'color:var(--rouge)' : ''}">${retards}</b><span>en retard</span></div></div>
        <div class="maitrise" role="img" aria-label="Documents clos : ${ds.length ? Math.round((clos / ds.length) * 100) : 0} %"><i style="width:${ds.length ? (clos / ds.length) * 100 : 0}%"></i></div>
        <div class="chapitres">${ds.length ? ds.slice(0, 6).map(({ d, e }) => `<button class="chapitre" data-action="doc" data-id="${d.id}"><b>${esc(d.numero)} · ${esc(d.titre)}</b>${e.code ? pastille(e.code) : ''}<span class="${e.retard > 0 ? 'retard' : ''}">${R.STATUTS[e.statut].nom}${e.indice ? ` · indice ${esc(e.indice)}` : ''}${e.retard > 0 ? ` · ${e.retard} j de retard` : ''}</span></button>`).join('') + (ds.length > 6 ? `<button class="chapitre plus" data-action="voir-lot" data-id="${l.id}"><b>Voir les ${ds.length} documents du lot</b></button>` : '') : '<p class="matiere-vide">Aucun document.</p>'}</div>
        <div class="matiere-pied"><button class="btn petit" data-action="doc-nouveau" data-lot="${l.id}">${ICONES.plus}Document</button></div>
      </article>`;
    }).join('');
    const enAttente = (v) => docs.filter((d) => { const e = etatDe(d); return e.statut === 'visa' && e.manquants.includes(v.id); }).length;
    const viseurs = o.viseurs.map((v) => `<button class="ligne" data-action="viseur-modifier" data-id="${v.id}" style="--c:var(--encre)"><i></i><div><b>${esc(v.nom)}</b><span>${esc(v.role)} · ${pluriel(docs.filter((d) => d.viseurIds.includes(v.id)).length, 'document')} dans son circuit</span></div><span class="etiquette ${enAttente(v) ? 'jaune' : 'clair'}">${pluriel(enAttente(v), 'avis attendu', 'avis attendus')}</span></button>`).join('');
    return `
      <div class="vue-tete"><div><h1>Lots et viseurs</h1><p>${esc(o.nom)}${o.moa ? ` · ${esc(o.moa)}` : ''} · ${esc(B.typesOperation.find((x) => x.id === o.type)?.nom || '')}</p></div>
        <div class="actions"><button class="btn" data-action="op-modifier">Modifier l'opération</button><button class="btn" data-action="viseur-nouveau">${ICONES.plus}Viseur</button><button class="btn primaire" data-action="lot-nouveau">${ICONES.plus}Lot</button></div></div>
      ${o.lots.length ? `<div class="matieres">${cartes}</div>` : vide('Aucun lot', 'Ajoute les lots du marché : choisis dans la liste des lots types ou saisis le tien.', `<button class="btn primaire" data-action="lot-nouveau">${ICONES.plus}Lot</button>`)}
      <h2 class="titre-section">Viseurs du circuit <span>Ceux qui rendent un avis sur les documents. L'avis de synthèse retient le plus sévère.</span></h2>
      ${o.viseurs.length ? `<div class="liste">${viseurs}</div>` : vide('Aucun viseur', 'Sans viseur désigné, un seul avis suffit pour clore chaque indice.', `<button class="btn primaire" data-action="viseur-nouveau">${ICONES.plus}Viseur</button>`)}
      <h2 class="titre-section">Codes de visa <span>Usage courant de la profession, non normalisé : vérifie ceux de ton marché.</span></h2>
      <div class="methodes">${B.avis.map((a) => `<article class="methode" style="--c:${a.couleur};--t:${a.texte}"><div class="methode-tete"><h2>${a.code} · ${esc(a.nom)}</h2></div><p>${esc(a.sens)}</p><p class="suite"><b>Suite :</b> ${esc(a.suite)}</p></article>`).join('')}</div>`;
  }

  // ---------- Tableau de bord ----------
  const SERIES = [['VSO', 'VSO', '#1D4E89'], ['VAO', 'VAO', '#F5B400'], ['REF', 'REF', '#D9302A']];

  function graphique(semaines) {
    const L = Math.round(Math.min(720, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 190 : 220, g = 28, b = 24, hz = H - b - 8;
    const max = Math.max(4, ...semaines.map((s) => s.VSO + s.VAO + s.REF));
    const pas = Math.ceil(max / 4);
    const haut = pas * 4;
    const larg = (L - g) / semaines.length;
    const y = (v) => 8 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const pasEtiquette = L < 500 ? 3 : 2;
    const colonnes = semaines.map((s, i) => {
      const x = g + i * larg + 4;
      const w = Math.max(6, larg - 8);
      let cumul = 0;
      const rects = SERIES.map(([k, , c]) => {
        const v = s[k];
        if (!v) return '';
        const y1 = y(cumul + v), h = y(cumul) - y(cumul + v) - (cumul ? 2 : 0);
        cumul += v;
        return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(1, h)}" fill="${c}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const etiquette = (semaines.length - 1 - i) % pasEtiquette === 0 ? `<text class="axe" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${fmt(s.debut, { day: 'numeric', month: 'short' })}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne" data-i="${i}">${rects}</g>${etiquette}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Avis de synthèse rendus par semaine sur 12 semaines, détail dans le tableau">${grilles}${colonnes}</svg>`;
  }

  function vueBord() {
    const o = op();
    if (!o) return vide('Aucune opération', 'Crée une opération pour commencer.', '<button class="btn primaire" data-action="op-nouvelle">Créer une opération</button>');
    const r = regl();
    const docs = docsOp();
    const s = R.statistiques(docs, r, auj());
    const unite = r.ouvres ? 'j ouvrés' : 'j';
    const tuiles = [
      ['Documents', s.total, '', `${s.clos} clos · ${s.attendus} attendus`, 'var(--encre)', ''],
      ['En cours de visa', s.enVisa, '', `${s.aResoumettre} nouvel${s.aResoumettre > 1 ? 's' : ''} indice${s.aResoumettre > 1 ? 's' : ''} attendu${s.aResoumettre > 1 ? 's' : ''}`, 'var(--jaune)', 'rond'],
      ['En retard', s.retards, '', `${s.alertes} échéance${s.alertes > 1 ? 's' : ''} sous ${r.alerte} j`, 'var(--rouge)', ''],
      ['VSO au 1er indice', s.tauxVSO1 === null ? '–' : s.tauxVSO1, s.tauxVSO1 === null ? '' : '%', 'Documents visés sans observation dès l\'indice A.', 'var(--bleu)', 'rond'],
      ['Délai moyen de visa', s.delaiMoyen === null ? '–' : String(s.delaiMoyen).replace('.', ','), s.delaiMoyen === null ? '' : unite, `Contractuel : ${r.delaiVisa} ${unite} · ${s.horsDelai} hors délai sur ${s.cycles}`, s.delaiMoyen !== null && s.delaiMoyen > r.delaiVisa ? 'var(--rouge)' : 'var(--bleu)', ''],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const lignes = lotsTries().map((l) => {
      const ds = docs.filter((d) => d.lotId === l.id);
      const es = ds.map(etatDe);
      const codes = (c) => ds.flatMap((d) => R.cycles(d, r)).filter((x) => x.code === c).length;
      const clos = es.filter((e) => e.clos).length;
      return `<tr style="--c:${couleur(l.couleur)}"><td><span class="nom-matiere"><i></i>${esc(l.numero)} · ${esc(l.nom)}</span></td><td class="nb">${ds.length}</td><td class="nb">${es.filter((e) => !e.clos).length}</td><td class="nb" style="${es.some((e) => e.retard > 0) ? 'color:var(--rouge);font-weight:700' : ''}">${es.filter((e) => e.retard > 0).length}</td><td class="nb">${codes('VSO')}</td><td class="nb">${codes('VAO')}</td><td class="nb">${codes('REF')}</td><td class="nb">${ds.length ? Math.round((clos / ds.length) * 100) : 0} %</td></tr>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Tableau de bord</h1><p>${esc(o.nom)} : avancement du circuit et respect des délais.</p></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">12 dernières semaines</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Avis de synthèse rendus par semaine</h2><div class="legende">${SERIES.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} · ${esc(AVIS[k].nom)}</span>`).join('')}</div></div>
        ${graphique(s.parSemaine)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Avis par semaine</caption><thead><tr><th>Semaine du</th><th>VSO</th><th>VAO</th><th>REF</th></tr></thead><tbody>${s.parSemaine.map((w) => `<tr><td>${fmt(w.debut)}</td><td>${w.VSO}</td><td>${w.VAO}</td><td>${w.REF}</td></tr>`).join('')}</tbody></table>
      </figure>
      <h2 class="titre-section">Par lot <span>Avis comptés par indice (un document refusé puis visé compte un REF et un VSO).</span></h2>
      ${o.lots.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Lot</th><th class="nb">Documents</th><th class="nb">En cours</th><th class="nb">En retard</th><th class="nb">VSO</th><th class="nb">VAO</th><th class="nb">REF</th><th class="nb">Clos</th></tr></thead><tbody>${lignes}</tbody></table></div>` : '<p>Aucun lot.</p>'}`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const semaines = R.statistiques(docsOp(), regl(), auj()).parSemaine;
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), w = semaines[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      const total = w.VSO + w.VAO + w.REF;
      bulle.innerHTML = `<b>Semaine du ${fmt(w.debut, { day: 'numeric', month: 'long' })}</b>${total ? SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${w[k]}</div>`).join('') : 'Aucun avis rendu'}`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.zone').forEach((z) => {
      z.addEventListener('pointerenter', () => montrer(z));
      z.addEventListener('click', () => montrer(z));
    });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne').forEach((g) => g.classList.remove('active')); });
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
    d.scrollTop = 0;
    d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
  }
  const GARDER = ''; // renvoyé par auValider quand une autre modale prend le relais

  function memoriserAnnulation() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    sauver(); rendre();
  }
  const fait = (texte) => { sauver(); rendre(); toast(texte, { libelle: 'Annuler', faire: annuler }); };

  // Fiche d'un document : historique des indices, avis, relances.
  function modaleFiche(id) {
    const d = documentPar(id);
    if (!d) return;
    const l = lot(d.lotId);
    const r = regl();
    const e = etatDe(d);
    const cycles = R.cycles(d, r);
    const circuit = d.viseurIds.map((v) => viseur(v)?.nom).filter(Boolean);
    const indices = [...d.indices].reverse().map((ind) => {
      const s = R.synthese(ind, d.viseurIds);
      const c = cycles.find((x) => x.indice === ind.indice && x.recuLe === ind.recuLe);
      const avis = ind.avis.map((a) => `<li><span class="qui">${esc(viseur(a.viseurId)?.nom || 'Avis de synthèse')}</span>${pastille(a.code)}<span class="quand">${fmt(a.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>${a.observations ? `<p>${esc(a.observations)}</p>` : ''}</li>`).join('');
      const manquants = s.manquants.map((v) => `<li class="attente"><span class="qui">${esc(viseur(v)?.nom || 'Viseur')}</span><span class="etiquette clair">Avis attendu</span></li>`).join('');
      return `<section class="indice">
        <h3><span class="ind">${esc(ind.indice)}</span>Reçu le ${fmt(ind.recuLe, { day: 'numeric', month: 'long', year: 'numeric' })}${s.complet ? ` · synthèse ${pastille(s.code)} le ${fmt(s.date)}${c ? ` · ${c.delai} ${r.ouvres ? 'j ouvrés' : 'j'}${c.horsDelai ? ' <b class="rouge">hors délai</b>' : ''}` : ''}` : ''}</h3>
        <ul class="avis">${avis}${manquants}</ul></section>`;
    }).join('');
    const relances = d.relances.length ? `<div class="groupe"><h3>Relances</h3><ul class="relances">${[...d.relances].sort((a, b) => b.date.localeCompare(a.date)).map((x) => `<li>${fmt(x.date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${x.cible === 'viseurs' ? 'viseurs' : 'entreprise'}${x.indice ? ` · ${x.indice.startsWith('>') ? `indice suivant ${esc(x.indice.slice(1))}` : `indice ${esc(x.indice)}`}` : ''}</li>`).join('')}</ul></div>` : '';
    const corps = `
      <div class="fiche-tete" style="--c:${couleur(l?.couleur)}"><i></i><div><p class="surtitre">Lot ${esc(l?.numero)} · ${esc(l?.nom)}${l?.entreprise ? ` · ${esc(l.entreprise)}` : ''}</p><p class="fiche-titre">${esc(d.titre)}</p><p>${esc(nomType(d.type))}${d.prevuLe ? ` · remise prévue le ${fmt(d.prevuLe, { day: 'numeric', month: 'long' })}` : ''}</p></div></div>
      <p class="fiche-etat">${etiquetteEtat(e)}<span>${R.STATUTS[e.statut].nom}${e.echeance ? ` · échéance ${fmt(e.echeance, { weekday: 'short', day: 'numeric', month: 'long' })}` : ''}</span></p>
      <p class="aide">Circuit : ${circuit.length ? esc(circuit.join(', ')) : 'aucun viseur désigné (un avis suffit)'}.</p>
      ${indices || '<p class="aide">Aucun indice reçu pour l\'instant.</p>'}
      ${relances}
      <p class="erreur" role="alert"></p>`;
    const principal = e.statut === 'visa' ? '<button class="btn primaire" value="avis">Saisir un avis</button>' : '<button class="btn primaire" value="indice">Indice reçu</button>';
    const pied = `${principal}${e.cible && !e.clos ? '<button class="btn" value="relancer">Relancer</button>' : ''}${e.statut === 'visa' ? '<button class="btn" value="indice">Indice reçu</button>' : ''}<button class="btn" value="modifier">Modifier</button>`;
    ouvrirModale(esc(d.numero), corps, pied, (f, action) => {
      if (action === 'avis') { modaleAvis(id); return GARDER; }
      if (action === 'indice') { modaleIndice(id); return GARDER; }
      if (action === 'relancer') { modaleRelance(id); return GARDER; }
      if (action === 'modifier') { modaleDocument(id); return GARDER; }
    });
  }

  function modaleDocument(id, lotId) {
    const o = op();
    if (!o.lots.length) { modaleLot(); toast('Crée d\'abord un lot.'); return; }
    const d = id ? documentPar(id) : null;
    const lotChoisi = d?.lotId || lotId || filtres.lot || lotsTries()[0].id;
    const typeChoisi = d?.type || 'PEX';
    const t = auj();
    const suggestions = (lid) => (B.lots.find((x) => x.code === lot(lid)?.code)?.docs || []);
    const prefixe = (lid, type) => `${lot(lid)?.code || 'DOC'}-${type}`;
    const numeroPropose = (lid, type) => R.numeroSuivant(docsOp().filter((x) => x.id !== id).map((x) => x.numero), prefixe(lid, type));
    const corps = `
      <div class="grille-champs">
        <label class="champ">Lot<select name="lot" id="d-lot">${lotsTries().map((x) => `<option value="${x.id}" ${x.id === lotChoisi ? 'selected' : ''}>${esc(x.numero)} · ${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Type<select name="type" id="d-type">${B.types.map((x) => `<option value="${x.code}" ${x.code === typeChoisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Titre<small>Suggestions selon le lot ; un titre usuel choisit aussi le type.</small><input name="titre" id="d-titre" required maxlength="140" value="${esc(d?.titre || '')}" list="d-suggestions" autocomplete="off"></label>
      <datalist id="d-suggestions">${suggestions(lotChoisi).map(([ti]) => `<option value="${esc(ti)}">`).join('')}</datalist>
      <div class="grille-champs">
        <label class="champ">Numéro<small>Proposé : code du lot, du type et rang.</small><input name="numero" id="d-numero" required maxlength="40" value="${esc(d?.numero || numeroPropose(lotChoisi, typeChoisi))}" data-auto="${d ? '0' : '1'}"></label>
        <label class="champ">Remise prévue le<small>Facultatif : relance si dépassée.</small><input type="date" name="prevu" value="${d?.prevuLe || ''}"></label>
      </div>
      <fieldset class="champ cases"><legend>Viseurs du circuit</legend>${o.viseurs.length ? o.viseurs.map((v) => `<label class="case"><input type="checkbox" name="viseurs" value="${v.id}" ${(d ? d.viseurIds.includes(v.id) : true) ? 'checked' : ''}> ${esc(v.nom)} <small>${esc(v.role)}</small></label>`).join('') : '<p class="aide">Aucun viseur défini : un seul avis clôt chaque indice. Ajoute des viseurs dans l\'onglet Lots.</p>'}</fieldset>
      ${d ? '' : `<label class="champ">Indice A déjà reçu le<small>Laisse vide si le document est seulement attendu.</small><input type="date" name="recu" max="${t}"></label>`}
      <p class="erreur" role="alert"></p>`;
    const pied = d ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="retour">Retour</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(d ? 'Modifier le document' : 'Nouveau document', corps, pied, (f, action) => {
      if (action === 'retour') { modaleFiche(id); return GARDER; }
      if (action === 'supprimer') {
        if (!confirm(`Supprimer ${d.numero} « ${d.titre} » et son historique ?`)) return GARDER;
        memoriserAnnulation();
        E.documents = E.documents.filter((x) => x.id !== d.id);
        fait(`${d.numero} supprimé.`);
        return;
      }
      const titre = String(f.get('titre') || '').trim();
      const numero = String(f.get('numero') || '').trim().toUpperCase();
      if (!titre) return 'Indique le titre du document.';
      if (!numero) return 'Indique le numéro du document.';
      if (docsOp().some((x) => x.id !== id && x.numero.toUpperCase() === numero)) return `Le numéro ${numero} existe déjà dans cette opération.`;
      const recu = f.get('recu') || null;
      if (recu && recu > t) return 'La date de réception ne peut pas être dans le futur.';
      memoriserAnnulation();
      const champs = { lotId: f.get('lot'), type: f.get('type'), titre, numero, prevuLe: f.get('prevu') || null, viseurIds: f.getAll('viseurs') };
      if (d) { Object.assign(d, champs); fait(`${numero} enregistré.`); modaleFiche(id); return GARDER; }
      const nd = { id: uid(), operationId: o.id, ...champs, indices: recu ? [{ id: uid(), indice: 'A', recuLe: recu, avis: [] }] : [], relances: [] };
      E.documents.push(nd);
      const e = etatDe(nd);
      fait(recu ? `${numero} indice A enregistré. Avis attendu pour le ${fmt(e.echeance, { day: 'numeric', month: 'long' })}.` : `${numero} ajouté aux documents attendus.`);
    });
    const champLot = $('#d-lot'), champType = $('#d-type'), champNum = $('#d-numero'), champTitre = $('#d-titre');
    const majNumero = () => { if (champNum.dataset.auto === '1') champNum.value = numeroPropose(champLot.value, champType.value); };
    champNum.addEventListener('input', () => { champNum.dataset.auto = '0'; });
    champLot.addEventListener('change', () => { $('#d-suggestions').innerHTML = suggestions(champLot.value).map(([ti]) => `<option value="${esc(ti)}">`).join(''); majNumero(); });
    champType.addEventListener('change', majNumero);
    champTitre.addEventListener('change', () => {
      const s = suggestions(champLot.value).find(([ti]) => ti === champTitre.value);
      if (s && champType.value !== s[1]) { champType.value = s[1]; majNumero(); }
    });
  }

  function modaleIndice(id) {
    const d = documentPar(id);
    const der = d.indices.at(-1);
    const t = auj();
    const e = etatDe(d);
    const corps = `
      <p class="aide">${esc(d.numero)} · ${esc(d.titre)}${der ? `<br>Dernier indice : ${esc(der.indice)}${e.code ? ` (${e.code})` : ' (avis en cours : il sera clos sans synthèse)'}` : ''}</p>
      <div class="grille-champs">
        <label class="champ">Indice<input name="indice" required maxlength="6" value="${esc(R.indiceSuivant(der?.indice))}" autocapitalize="characters"></label>
        <label class="champ">Reçu le<input type="date" name="recu" value="${t}" max="${t}" required></label>
      </div>
      <p class="aide">Échéance de l'avis : ${regl().delaiVisa} ${regl().ouvres ? 'jours ouvrés' : 'jours'} après la réception.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Indice reçu', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="retour">Retour</button>', (f, action) => {
      if (action === 'retour') { modaleFiche(id); return GARDER; }
      const indice = String(f.get('indice') || '').trim().toUpperCase();
      const recu = f.get('recu');
      if (!indice) return 'Indique l\'indice.';
      if (d.indices.some((x) => x.indice === indice)) return `L'indice ${indice} est déjà enregistré.`;
      if (!recu || recu > t) return 'La date de réception ne peut pas être dans le futur.';
      if (der && recu < der.recuLe) return `L'indice précédent a été reçu le ${dateFr(der.recuLe)}.`;
      memoriserAnnulation();
      d.indices.push({ id: uid(), indice, recuLe: recu, avis: [] });
      const ne = etatDe(d);
      fait(`${d.numero} indice ${indice} reçu. Avis attendu ${ne.echeance ? `pour le ${fmt(ne.echeance, { day: 'numeric', month: 'long' })}` : ''}.`);
    });
  }

  function modaleAvis(id, viseurId) {
    const d = documentPar(id);
    const ind = d.indices.at(-1);
    if (!ind) { toast('Aucun indice reçu : enregistre d\'abord la réception.'); modaleIndice(id); return; }
    const s = R.synthese(ind, d.viseurIds);
    const t = auj();
    const choix = d.viseurIds.length ? d.viseurIds : [''];
    const defaut = viseurId ?? (s.manquants[0] || choix[0]);
    const existant = (v) => ind.avis.find((a) => (a.viseurId || '') === v);
    const corps = `
      <p class="aide">${esc(d.numero)} indice ${esc(ind.indice)} · ${esc(d.titre)} · reçu le ${fmt(ind.recuLe, { day: 'numeric', month: 'long' })}</p>
      <label class="champ">Avis de<select name="viseur" id="a-viseur">${choix.map((v) => `<option value="${v}" ${v === defaut ? 'selected' : ''}>${v ? esc(viseur(v)?.nom || 'Viseur') : 'Avis de synthèse (maîtrise d\'œuvre)'}${existant(v) ? ` · déjà ${existant(v).code}` : ''}</option>`).join('')}</select></label>
      <fieldset class="champ codes"><legend>Code</legend><div class="choix-codes">${B.avis.map((a) => `<label style="--c:${a.couleur};--t:${a.texte}"><input type="radio" name="code" value="${a.code}" ${existant(defaut)?.code === a.code ? 'checked' : ''}><span><b>${a.code}</b>${esc(a.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Date de l'avis<input type="date" name="date" value="${existant(defaut)?.date || t}" min="${ind.recuLe}" max="${t}" required></label>
      <label class="champ">Observations<small>Reprises dans la fiche et dans la relance de l'indice suivant.</small><textarea name="observations" maxlength="2000">${esc(existant(defaut)?.observations || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Saisir un avis', corps, '<button class="btn primaire" value="ok">Enregistrer l\'avis</button><button class="btn" value="retour">Retour</button>', (f, action) => {
      if (action === 'retour') { modaleFiche(id); return GARDER; }
      const code = f.get('code');
      const date = f.get('date');
      if (!code) return 'Choisis VSO, VAO ou REF.';
      if (!date || date > t) return 'La date de l\'avis ne peut pas être dans le futur.';
      if (date < ind.recuLe) return 'L\'avis ne peut pas précéder la réception de l\'indice.';
      memoriserAnnulation();
      const v = f.get('viseur') || null;
      ind.avis = ind.avis.filter((a) => (a.viseurId || '') !== (v || ''));
      ind.avis.push({ viseurId: v, code, date, observations: String(f.get('observations') || '').trim() });
      const ns = R.synthese(ind, d.viseurIds);
      const reste = ns.manquants.length;
      fait(ns.complet ? `${d.numero} indice ${ind.indice} : synthèse ${ns.code}.` : `Avis ${code} enregistré. ${pluriel(reste, 'avis encore attendu', 'avis encore attendus')}.`);
      if (!ns.complet) { modaleAvis(id); return GARDER; }
    });
    $('#a-viseur').addEventListener('change', (e) => modaleAvis(id, e.target.value));
  }

  function modaleRelance(id) {
    const d = documentPar(id);
    const e = etatDe(d);
    const l = lot(d.lotId);
    const { objet, corps: texte } = R.texteRelance({ operation: op(), lot: l, doc: d, etat: e, viseurs: op().viseurs, auj: auj() });
    const derniere = R.derniereRelance(d, e.cible, R.indiceRelance(e));
    const dest = e.cible === 'viseurs' ? e.manquants.map((v) => viseur(v)?.nom).filter(Boolean).join(', ') : (l?.entreprise || 'Entreprise du lot');
    const corps = `
      <p class="aide">À : <b>${esc(dest)}</b>${derniere ? ` · dernière relance ${quand(derniere)}` : ' · première relance'}</p>
      <label class="champ">Objet<input name="objet" id="r-objet" value="${esc(objet)}"></label>
      <label class="champ">Message<textarea name="texte" id="r-texte" rows="9">${esc(texte)}</textarea></label>
      <div class="rang"><button class="btn petit" type="button" data-action="copier-relance">Copier le texte</button></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Relancer', corps, '<button class="btn primaire" value="ok">Marquer comme relancé</button><button class="btn" value="retour">Retour</button>', (f, action) => {
      if (action === 'retour') { modaleFiche(id); return GARDER; }
      memoriserAnnulation();
      d.relances.push({ date: auj(), cible: e.cible, indice: R.indiceRelance(e) });
      fait(`Relance de ${d.numero} enregistrée. Prochaine dans ${regl().frequenceRelance} j si rien ne bouge.`);
    });
  }

  // Choix rapide d'un document depuis le pilotage.
  function modaleChoixDocument(mode) {
    const docs = R.trierDocuments(docsOp(), op().lots).map((d) => ({ d, e: etatDe(d) }))
      .filter(({ e }) => (mode === 'avis' ? e.statut === 'visa' : e.statut !== 'vso'));
    if (!docs.length) {
      if (mode === 'avis') { toast('Aucun document en cours de visa.'); return; }
      modaleDocument(); return;
    }
    const corps = `
      <label class="champ">Document<select name="doc">${docs.map(({ d, e }) => `<option value="${d.id}">${esc(d.numero)} · ${esc(d.titre)}${e.indice ? ` (ind. ${esc(e.indice)})` : ''}</option>`).join('')}</select></label>
      ${mode === 'indice' ? '<p class="aide">Nouveau document, pas encore au registre ? <button class="btn lien" type="button" data-action="doc-nouveau">Créer le document</button></p>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(mode === 'avis' ? 'Saisir un avis' : 'Document reçu', corps, '<button class="btn primaire" value="ok">Continuer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const id = f.get('doc');
      if (mode === 'avis') modaleAvis(id); else modaleIndice(id);
      return GARDER;
    });
  }

  function modaleLot(id) {
    const l = id ? lot(id) : null;
    const o = op();
    const utilisees = new Set(o.lots.map((x) => x.couleur));
    const defaut = l?.couleur || (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[o.lots.length % B.couleurs.length]).id;
    const nb = l ? docsOp().filter((d) => d.lotId === l.id).length : 0;
    const corps = `
      <div class="grille-champs">
        <label class="champ">Numéro<input name="numero" required maxlength="8" value="${esc(l?.numero || String(o.lots.length + 1).padStart(2, '0'))}"></label>
        <label class="champ">Code court<small>Pour numéroter les documents.</small><input name="code" id="l-code" required maxlength="6" value="${esc(l?.code || '')}" autocapitalize="characters"></label>
      </div>
      <label class="champ">Intitulé<input name="nom" id="l-nom" required maxlength="80" value="${esc(l?.nom || '')}" list="l-types" autocomplete="off"></label>
      <datalist id="l-types">${B.lots.map((x) => `<option value="${esc(x.nom)}">`).join('')}</datalist>
      <label class="champ">Entreprise titulaire<small>Destinataire des relances de documents.</small><input name="entreprise" maxlength="80" value="${esc(l?.entreprise || '')}"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === defaut ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    const pied = l ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(l ? 'Modifier le lot' : 'Nouveau lot', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer le lot ${l.numero} « ${l.nom} »${nb ? ` et ses ${pluriel(nb, 'document')}` : ''} ?`)) return GARDER;
        memoriserAnnulation();
        o.lots = o.lots.filter((x) => x.id !== l.id);
        E.documents = E.documents.filter((d) => d.lotId !== l.id);
        fait(`Lot ${l.numero} supprimé.`);
        return;
      }
      const champs = { numero: String(f.get('numero') || '').trim(), code: String(f.get('code') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), nom: String(f.get('nom') || '').trim(), entreprise: String(f.get('entreprise') || '').trim(), couleur: f.get('couleur') };
      if (!champs.numero || !champs.nom) return 'Indique le numéro et l\'intitulé du lot.';
      if (!champs.code) return 'Indique un code court (lettres), par exemple GO.';
      memoriserAnnulation();
      if (l) Object.assign(l, champs); else o.lots.push({ id: uid(), ...champs });
      fait(l ? 'Lot enregistré.' : `Lot ${champs.numero} créé.`);
    });
    $('#l-nom').addEventListener('change', (e) => {
      const b = B.lots.find((x) => x.nom === e.target.value);
      if (b && !$('#l-code').value) $('#l-code').value = b.code;
    });
  }

  function modaleViseur(id) {
    const o = op();
    const v = id ? viseur(id) : null;
    const corps = `
      <label class="champ">Nom<small>Organisme ou personne.</small><input name="nom" required maxlength="80" value="${esc(v?.nom || '')}"></label>
      <label class="champ">Rôle<select name="role">${B.roles.map((r) => `<option ${r === (v?.role || 'Architecte') ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      ${v ? '' : '<label class="case"><input type="checkbox" name="partout" value="1"> L\'ajouter au circuit des documents encore en cours</label>'}
      <p class="aide">Noms de personnes : limite-toi aux données professionnelles nécessaires au suivi (RGPD).</p>
      <p class="erreur" role="alert"></p>`;
    const pied = v ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(v ? 'Modifier le viseur' : 'Nouveau viseur', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Retirer « ${v.nom} » du circuit ? Ses avis déjà rendus restent dans l'historique.`)) return GARDER;
        memoriserAnnulation();
        o.viseurs = o.viseurs.filter((x) => x.id !== v.id);
        docsOp().forEach((d) => { d.viseurIds = d.viseurIds.filter((x) => x !== v.id); });
        fait(`« ${v.nom} » retiré du circuit.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du viseur.';
      memoriserAnnulation();
      if (v) Object.assign(v, { nom, role: f.get('role') });
      else {
        const nv = { id: uid(), nom, role: f.get('role') };
        o.viseurs.push(nv);
        if (f.get('partout')) docsOp().forEach((d) => { if (!etatDe(d).clos && d.indices.length === 0) d.viseurIds.push(nv.id); });
      }
      fait(v ? 'Viseur enregistré.' : `« ${nom} » ajouté.`);
    });
  }

  function modaleOperation(id) {
    const o = id ? E.operations.find((x) => x.id === id) : null;
    const r = E.reglages;
    const corps = `
      <label class="champ">Nom de l'opération<input name="nom" required maxlength="80" value="${esc(o?.nom || '')}"></label>
      <label class="champ">Maître d'ouvrage<input name="moa" maxlength="80" value="${esc(o?.moa || '')}"></label>
      <label class="champ">Type<select name="type">${B.typesOperation.map((x) => `<option value="${x.id}" ${x.id === (o?.type || 'tertiaire') ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      <div class="grille-champs">
        <label class="champ">Délai de visa propre<small>Vide : ${r.delaiVisa} j (réglages).</small><input type="number" name="delaiVisa" min="1" max="120" value="${o?.delaiVisa ?? ''}"></label>
        <label class="champ">Délai de resoumission propre<small>Vide : ${r.delaiResoumission} j.</small><input type="number" name="delaiResoumission" min="1" max="120" value="${o?.delaiResoumission ?? ''}"></label>
      </div>
      <p class="aide">Reporte les délais prévus par le marché de cette opération (CCAP, convention de maîtrise d'œuvre).</p>
      <p class="erreur" role="alert"></p>`;
    const pied = o ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(o ? 'Modifier l\'opération' : 'Nouvelle opération', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const nb = E.documents.filter((d) => d.operationId === o.id).length;
        if (!confirm(`Supprimer l'opération « ${o.nom} »${nb ? ` et ses ${pluriel(nb, 'document')}` : ''} ?`)) return GARDER;
        memoriserAnnulation();
        E.operations = E.operations.filter((x) => x.id !== o.id);
        E.documents = E.documents.filter((d) => d.operationId !== o.id);
        E.operationActive = E.operations[0]?.id || null;
        fait(`Opération « ${o.nom} » supprimée.`);
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'opération.';
      const delai = (k) => { const n = Number(f.get(k)); return f.get(k) === '' ? null : Number.isInteger(n) && n >= 1 && n <= 120 ? n : NaN; };
      const dv = delai('delaiVisa'), dr = delai('delaiResoumission');
      if (Number.isNaN(dv) || Number.isNaN(dr)) return 'Délais : nombres entiers de 1 à 120 jours, ou vide.';
      memoriserAnnulation();
      const champs = { nom, moa: String(f.get('moa') || '').trim(), type: f.get('type'), delaiVisa: dv, delaiResoumission: dr };
      if (o) Object.assign(o, champs);
      else { const n = { id: uid(), ...champs, lots: (LOTS_PAR_TYPE[champs.type] || []).map((c, i) => nouveauLot(c, i)), viseurs: ROLES_DEFAUT.map((x) => ({ id: uid(), nom: x, role: x })) }; E.operations.push(n); E.operationActive = n.id; filtres.lot = ''; }
      fait(o ? 'Opération enregistrée.' : `Opération « ${nom} » créée avec ses lots usuels.`);
    });
  }

  function modaleOperations() {
    const corps = `
      <div class="choix-ops">${E.operations.map((o) => {
        const n = E.documents.filter((d) => d.operationId === o.id).length;
        return `<label class="case op"><input type="radio" name="op" value="${o.id}" ${o.id === E.operationActive ? 'checked' : ''}><span><b>${esc(o.nom)}</b><small>${esc(B.typesOperation.find((x) => x.id === o.type)?.nom || '')} · ${pluriel(n, 'document')}</small></span></label>`;
      }).join('')}</div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Opérations', corps, '<button class="btn primaire" value="ok">Ouvrir</button><button class="btn" value="nouvelle">Nouvelle opération</button>', (f, action) => {
      if (action === 'nouvelle') { modaleOperation(); return GARDER; }
      const id = f.get('op');
      if (id && id !== E.operationActive) { E.operationActive = id; filtres.lot = ''; sauver(); rendre(); }
    });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <p class="aide">Aucun délai n'est imposé par l'application : reporte ceux de ton marché. Les valeurs de départ (15 jours) ne sont pas des délais réglementaires. Une opération peut avoir ses propres délais.</p>
      <div class="grille-champs">
        <label class="champ">Délai de visa (jours)<small>De la réception de l'indice à l'avis de synthèse.</small><input type="number" name="delaiVisa" min="1" max="120" value="${r.delaiVisa}"></label>
        <label class="champ">Délai de resoumission (jours)<small>De l'avis REF ou VAO au nouvel indice.</small><input type="number" name="delaiResoumission" min="1" max="120" value="${r.delaiResoumission}"></label>
        <label class="champ">Relancer tous les (jours)<input type="number" name="frequenceRelance" min="1" max="60" value="${r.frequenceRelance}"></label>
        <label class="champ">Alerte avant échéance (jours)<input type="number" name="alerte" min="0" max="30" value="${r.alerte}"></label>
      </div>
      <label class="case"><input type="checkbox" name="ouvres" value="1" ${r.ouvres ? 'checked' : ''}> Décompter en jours ouvrés (lundi à vendredi, hors jours fériés de métropole)</label>
      <label class="case"><input type="checkbox" name="vao" value="1" ${r.vaoNouvelIndice ? 'checked' : ''}> Après un VAO, attendre un nouvel indice</label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton registre est enregistré en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="mention">Outil d'aide au suivi : il ne remplace ni les pièces du marché ni le visa lui-même, et ne vaut pas conseil juridique. Codes VSO, VAO, REF : usage courant de la profession. Jours fériés de métropole uniquement (Alsace-Moselle et outre-mer non gérés).</p>
        <ul class="sources">${B.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.texte)}</a>, Légifrance, consulté le ${s.date}.</li>`).join('')}</ul></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const v = { delaiVisa: n('delaiVisa', 1, 120), delaiResoumission: n('delaiResoumission', 1, 120), frequenceRelance: n('frequenceRelance', 1, 60), alerte: n('alerte', 0, 30) };
      if (Object.values(v).some((x) => x === null)) return 'Délais : nombres entiers (visa et resoumission de 1 à 120 j, relance de 1 à 60 j, alerte de 0 à 30 j).';
      Object.assign(r, v, { ouvres: !!f.get('ouvres'), vaoNouvelIndice: !!f.get('vao') });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.operations) || !Array.isArray(d.documents)) throw new Error();
        if (!confirm(`Remplacer ton registre actuel par cette copie (${pluriel(d.operations.length, 'opération')}, ${pluriel(d.documents.length, 'document')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du registre.'); }
    });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const slug = (s) => String(s || 'operation').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  function exporterCSV() {
    const o = op();
    const docs = documentsFiltres().map((x) => x.d);
    const csv = R.registreCSV({ docs, lots: o.lots, viseurs: o.viseurs, r: regl(), auj: auj() });
    telecharger(csv, 'text/csv;charset=utf-8', `registre-visas-${slug(o.nom)}-${auj()}.csv`);
    toast(`${pluriel(docs.length, 'document exporté', 'documents exportés')} (filtres appliqués).`);
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'type-op': accueil.type = id; accueil.lots = new Set(LOTS_PAR_TYPE[id]); ecranAccueil(); break;
      case 'accueil-suivant':
        if (!accueil.nom.trim()) { $('#erreur-accueil').textContent = 'Indique le nom de l\'opération.'; $('#op-nom').focus(); break; }
        accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'choix-lot': el.checked ? accueil.lots.add(el.value) : accueil.lots.delete(el.value); $('[data-action="accueil-fin"]').disabled = !accueil.lots.size; $('#nb-lots').textContent = pluriel(accueil.lots.size, 'lot coché', 'lots cochés'); break;
      case 'choix-role': el.checked ? accueil.roles.add(el.value) : accueil.roles.delete(el.value); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), 'application/json', `circuit-visa-${auj()}.json`); break;
      case 'fermer': modale().close(); break;
      case 'operations': modaleOperations(); break;
      case 'op-nouvelle': modaleOperation(); break;
      case 'op-modifier': modaleOperation(E.operationActive); break;
      case 'doc': modaleFiche(id); break;
      case 'doc-nouveau': modaleDocument(null, el.dataset.lot); break;
      case 'lot-nouveau': modaleLot(); break;
      case 'lot-modifier': modaleLot(id); break;
      case 'voir-lot': filtres.lot = id; filtres.statut = 'tous'; changerVue('registre'); break;
      case 'viseur-nouveau': modaleViseur(); break;
      case 'viseur-modifier': modaleViseur(id); break;
      case 'relancer': modaleRelance(id); break;
      case 'indice-rapide': modaleChoixDocument('indice'); break;
      case 'avis-rapide': modaleChoixDocument('avis'); break;
      case 'csv': exporterCSV(); break;
      case 'imprimer': window.print(); break;
      case 'copier-relance': {
        const texte = `${$('#r-objet').value}\n\n${$('#r-texte').value}`;
        (navigator.clipboard?.writeText(texte) || Promise.reject()).then(() => toast('Texte copié.')).catch(() => { $('#r-texte').select(); toast('Sélectionne le texte et copie-le.'); });
        break;
      }
      default: break;
    }
  });
  // Ligne du registre au clavier.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('tr[data-action="doc"]')) modaleFiche(e.target.dataset.id);
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && $('#vue')) rendre(); // changement de jour
  });
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
  window.__visa = { etat: () => E };
  init();
})();
