// Registre du DOE QME : pièces du dossier des ouvrages exécutés par opération, lot et entreprise,
// statuts, relances datées, complétude, bordereau de transmission. Socle commun des templates QME.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'RDE';
  const CLE_CODE = 'qme-rde-code';
  const CLE_CACHE = 'qme-rde-cache';
  const CLE_DEMO = 'qme-rde-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rde-ecran-accueil';
  const TAILLE_MAX = 900000;

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

  const { ajout, ecart, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? R.dateFr(s) : '–');
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return `le ${fmt(s)}`;
  };
  const depuis = (s) => { const n = ecart(s, auj()); return n <= 0 ? 'aujourd\'hui' : n === 1 ? 'hier' : `il y a ${n} j`; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'pieces';
  let annulation = null;
  const filtre = { operationId: '', lotId: '', entrepriseId: '', famille: '', statut: 'a-traiter', texte: '' };
  const docChoix = { type: 'bordereau', operationId: '', entrepriseId: '', lotId: '', avecRecues: false, destinataire: '' };

  const etatVide = () => ({ version: 1, structure: '', tutorielVu: false, reglages: { delaiRemise: B.delaiRemise, delaiReprise: B.delaiReprise, intervalle: B.intervalleRelance, alerte: 7 },
    modeles: {}, operations: [], lots: [], entreprises: [], pieces: [], relances: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) }, modeles: d.modeles && typeof d.modeles === 'object' ? d.modeles : {},
      operations: tab(d.operations).map((o) => ({ moa: '', adresse: '', reception: null, dateLimite: '', diuo: false, ...o })),
      lots: tab(d.lots), entreprises: tab(d.entreprises),
      pieces: tab(d.pieces).map((p) => ({ historique: [], echeance: '', reference: '', format: '', motif: '', recueLe: null, valideeLe: null, ...p })),
      relances: tab(d.relances).map((r) => ({ pieces: [], note: '', mode: 'Courrier', ...r })) };
  };
  const operation = (id) => E.operations.find((o) => o.id === id);
  const lot = (id) => E.lots.find((l) => l.id === id);
  const entreprise = (id) => E.entreprises.find((e) => e.id === id);
  const piece = (id) => E.pieces.find((p) => p.id === id);
  const ordreCode = (code) => { const i = B.lots.findIndex((x) => x.code === code); return i < 0 ? 99 : i; };
  const lotsDe = (opId) => E.lots.filter((l) => l.operationId === opId).sort((a, b) => ordreCode(a.code) - ordreCode(b.code) || a.nom.localeCompare(b.nom));
  const nomLot = (l) => (l ? `${l.code ? `${l.code} · ` : ''}${l.nom}` : 'Sans lot');
  const entrepriseDe = (p) => lot(p.lotId)?.entrepriseId || '';
  const nomEnt = (id) => entreprise(id)?.nom || 'Entreprise à désigner';
  const ordreLot = (p) => ordreCode(lot(p.lotId)?.code) * 1000 + (lot(p.lotId)?.nom || '').charCodeAt(0);
  const famille = (code) => B.familles.find((f) => f.code === code) || B.familles.at(-1);
  const ctx = () => ({ auj: auj(), ops: Object.fromEntries(E.operations.map((o) => [o.id, o])), alerte: E.reglages.alerte });
  const extraRecherche = (p) => `${nomLot(lot(p.lotId))} ${nomEnt(entrepriseDe(p))} ${famille(p.famille).nom} ${operation(p.operationId)?.nom || ''}`;
  const nouvellesPieces = (l) => {
    const op = operation(l.operationId);
    return R.aCreer(l, { modeles: E.modeles, base: B, existantes: E.pieces, diuo: !!op?.diuo }).map((p) => {
      const n = { id: uid(), numero: R.prochainNumero(E.pieces, l.operationId), ...p };
      E.pieces.push(n);
      return n;
    });
  };

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
        toast('Un autre appareil a modifié ton registre entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime une opération terminée.');
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
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne d'un template QME (préfixe de 3 lettres, au moins une hors hexadécimal) ; sinon clé Gumroad.
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    E = etatVide();
    E.structure = 'Atelier de maîtrise d\'œuvre (exemple)';
    const t = auj();
    const ents = {};
    [['go', 'Bâtisseurs Associés (fictive)', 'Conducteur de travaux'], ['ce', 'Toitures du Plateau (fictive)', 'Chargé d\'affaires'], ['me', 'Menuiseries de l\'Estuaire (fictive)', 'Chargée d\'affaires'],
      ['clo', 'Cloisons et Plafonds Modernes (fictive)', 'Chef de chantier'], ['mi', 'Bois et Portes Intérieures (fictive)', 'Gérant'], ['car', 'Sols et Faïences (fictive)', 'Conducteur de travaux'],
      ['pei', 'Couleurs et Finitions (fictive)', 'Chef d\'équipe'], ['flu', 'Fluides Bâtiment Services (fictive)', 'Conductrice de travaux'], ['elec', 'Énergie Courants Forts (fictive)', 'Chargé d\'affaires'],
      ['vrd', 'Terrassements et Réseaux (fictive)', 'Conducteur de travaux'], ['ser', 'Métallerie du Port (fictive)', 'Gérante']]
      .forEach(([k, nom, contact]) => { ents[k] = { id: uid(), nom, contact, email: `doe@${k}-chantier.exemple` }; E.entreprises.push(ents[k]); });
    const op1 = { id: uid(), nom: 'Résidence Les Charmilles · 32 logements', moa: 'SCI Les Charmilles (fictive)', adresse: 'Allée des Charmilles (adresse fictive)', reception: ajout(t, -38), dateLimite: ajout(t, -8), diuo: true };
    const op2 = { id: uid(), nom: 'Extension d\'un atelier · 1 200 m²', moa: 'Société des Ateliers Réunis (fictive)', adresse: 'Zone d\'activités du Moulin (adresse fictive)', reception: ajout(t, 21), dateLimite: ajout(t, 51), diuo: false };
    E.operations.push(op1, op2);
    const creerLots = (op, liste) => Object.fromEntries(liste.map(([code, ent]) => {
      const b = B.lots.find((x) => x.code === code);
      const l = { id: uid(), operationId: op.id, code, nom: b.nom, entrepriseId: ent.id };
      E.lots.push(l);
      nouvellesPieces(l);
      return [code, l];
    }));
    const L1 = creerLots(op1, [['VRD', ents.vrd], ['GO', ents.go], ['CE', ents.ce], ['ME', ents.me], ['CLO', ents.clo], ['MI', ents.mi], ['CAR', ents.car], ['PEI', ents.pei], ['PLB', ents.flu], ['CVC', ents.flu], ['CFO', ents.elec]]);
    const L2 = creerLots(op2, [['GO', ents.go], ['SER', ents.ser], ['CE', ents.ce], ['CVC', ents.flu], ['CFO', ents.elec]]);
    const de = (l) => E.pieces.filter((p) => p.lotId === l.id);
    const pas = (p, vers, j, o = {}) => Object.assign(p, R.transition(p, vers, { date: ajout(t, j), ...o }));
    const valider = (p, jr, jv, ref) => { pas(p, 'recue', jr, { reference: ref || '', format: 'Numérique' }); pas(p, 'validee', jv); };
    const refDe = (l, k) => `${l.code}-DOE-${String(k + 1).padStart(2, '0')}`;
    // Opération 1 : réception passée, date limite du DOE dépassée de 8 jours.
    // [lot, scénario par pièce : v = validée, r = reçue, x = à reprendre, a = attendue]
    const sc1 = { VRD: 'vvxa', GO: 'vvvvvv', CE: 'vvrvvv', ME: 'vvxvvv', CLO: 'vvvv', MI: 'aaaaa', CAR: 'vvrvv', PEI: 'vvvv', PLB: 'vvaavarr', CVC: 'vrrvvvv', CFO: 'aavaaaa' };
    for (const [code, s] of Object.entries(sc1)) {
      de(L1[code]).forEach((p, k) => {
        const c = s[k] || 'a';
        if (c === 'v') valider(p, -30 + (k % 5) * 3, -18 + (k % 4) * 2, refDe(L1[code], k));
        if (c === 'r') pas(p, 'recue', -3 - k % 3, { reference: refDe(L1[code], k), format: 'Numérique' });
        if (c === 'x') { pas(p, 'recue', -16, { reference: refDe(L1[code], k), format: 'Numérique' }); pas(p, 'a-reprendre', -12, { note: k % 2 ? 'Plans d\'exécution transmis, pas mis à jour selon la réalisation.' : 'Classement fourni pour une autre gamme de menuiserie que celle posée.', delai: 10 }); }
      });
    }
    // Une pièce reçue aujourd'hui pendant la réunion de chantier.
    pas(de(L1.PLB)[3], 'recue', 0, { reference: 'PLB-PV-DES-A', format: 'Numérique et papier' });
    // Opération 2 : en cours, réception dans 3 semaines ; fiches techniques demandées avant réception.
    const sc2 = { GO: 'vvaaa', SER: 'raa', CE: 'vaaaa', CVC: 'aaraaa', CFO: 'avaaaa' };
    for (const [code, s] of Object.entries(sc2)) {
      de(L2[code]).forEach((p, k) => {
        const c = s[k] || 'a';
        if (c === 'v') valider(p, -20 + k * 2, -10 + k, refDe(L2[code], k));
        if (c === 'r') pas(p, 'recue', -2, { reference: refDe(L2[code], k), format: 'Numérique' });
        if (p.famille === 'fiche' && p.statut === 'attendue') p.echeance = ajout(t, code === 'SER' ? -2 : 5);
      });
    }
    // Relances datées (opération 1).
    const rel = (op, ent, j, mode, note) => {
      const ps = E.pieces.filter((p) => p.operationId === op.id && entrepriseDe(p) === ent.id && R.aCharge(p)).map((p) => p.id);
      E.relances.push({ id: uid(), operationId: op.id, entrepriseId: ent.id, date: ajout(t, j), mode, note, pieces: ps });
    };
    rel(op1, ents.mi, -6, 'Courrier', 'Relance avec la liste des pièces manquantes.');
    rel(op1, ents.mi, -1, 'Réunion de chantier', 'Engagement oral de remise sous huit jours.');
    rel(op1, ents.flu, -9, 'E-mail', 'Relance groupée plomberie et CVC.');
    rel(op1, ents.elec, -3, 'Compte rendu de chantier', 'Point inscrit au compte rendu n° 31.');
    rel(op1, ents.vrd, -2, 'Téléphone', 'Plans de récolement en cours de mise au propre.');
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Registre du DOE · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="40" width="180" height="240" fill="#1D4E89"/>
          <rect x="60" y="20" width="180" height="240" fill="#F5B400"/>
          <path d="M110 60 h90 M110 100 h90 M110 140 h60" stroke="#141414" stroke-width="12"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <path d="M370 150 l35 35 l70 -80" fill="none" stroke="#F0EDE6" stroke-width="26" stroke-linecap="square"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Registre du DOE · fin d'opération</p>
          <h1>Chaque pièce remise, vérifiée, transmise.</h1>
          <p>Les pièces du dossier des ouvrages exécutés par lot et par entreprise, relances datées, complétude et bordereau de transmission prêt à imprimer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton registre du DOE</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton registre est enregistré en ligne et te suit sur tous tes appareils, du bureau au chantier.</p>
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
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/doe/">Voir le template</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  const choixLots = (compact = false) => `<div class="choix-lots ${compact ? 'compact' : ''}">${B.lots.map((l) => `<label class="case"><input type="checkbox" name="lot" value="${l.code}" ${l.courant ? 'checked' : ''}> <b>${l.code}</b> ${esc(l.nom)}</label>`).join('')}</div>`;

  function ecranAccueil() {
    document.title = 'Bienvenue · Registre du DOE';
    const t = auj();
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ta première opération.</h1>
        <p class="intro">Choisis les lots : chacun reçoit sa liste de pièces types (plans, notices, PV d'essais, fiches techniques, garanties), à ajuster ensuite selon ton marché. Tu attribueras les entreprises dans l'onglet Opérations.</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Nom de l'opération<input name="nom" required maxlength="80" placeholder="Ex. : Résidence du Parc · 18 logements"></label>
            <label class="champ">Ta structure <small>Facultatif : en-tête du bordereau et des courriers.</small><input name="structure" maxlength="80" placeholder="Ex. : Cabinet de maîtrise d'œuvre"></label>
            <label class="champ">Maître d'ouvrage<input name="moa" maxlength="80"></label>
            <label class="champ">Date de réception (prévue ou prononcée)<input type="date" name="reception" id="a-rec" value="${t}"></label>
            <label class="champ">Date limite de remise du DOE <small>Proposée : réception + ${B.delaiRemise} jours. Ton marché fait foi.</small><input type="date" name="dateLimite" id="a-lim" value="${ajout(t, B.delaiRemise)}"></label>
            <label class="case" style="align-self:end"><input type="checkbox" name="diuo"> L'opération comporte un DIUO : ajouter à chaque lot une pièce « Éléments pour le DIUO »</label>
          </div>
          <h2 class="titre-section">Lots de l'opération <span>Les lots courants sont cochés ; tu en ajouteras d'autres dans l'onglet Opérations.</span></h2>
          ${choixLots()}
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer l'opération</button></div>
        </form>
      </div>`;
    $('#a-rec').addEventListener('change', (e) => { if (R.estDate(e.target.value)) $('#a-lim').value = ajout(e.target.value, B.delaiRemise); });
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nom = String(f.get('nom') || '').trim();
      if (!nom) { e.target.querySelector('.erreur').textContent = 'Indique le nom de l\'opération.'; e.target.nom.focus(); return; }
      E = etatVide();
      E.structure = String(f.get('structure') || '').trim();
      const op = { id: uid(), nom, moa: String(f.get('moa') || '').trim(), adresse: '', reception: f.get('reception') || null, dateLimite: f.get('dateLimite') || '', diuo: !!f.get('diuo') };
      E.operations.push(op);
      f.getAll('lot').forEach((code) => { const b = B.lots.find((x) => x.code === code); const l = { id: uid(), operationId: op.id, code, nom: b.nom, entrepriseId: null }; E.lots.push(l); nouvellesPieces(l); });
      sauver();
      vue = 'operations';
      demarrer();
      toast(`${pluriel(E.pieces.length, 'pièce attendue', 'pièces attendues')}. Attribue maintenant une entreprise à chaque lot.`);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    pieces: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    relances: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7" y="6" width="10" height="2" fill="currentColor"/><rect x="7" y="10" width="10" height="2" fill="currentColor"/><rect x="7" y="16" width="5" height="3" fill="currentColor"/></svg>',
    operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['pieces', 'Pièces'], ['bilan', 'Complétude'], ['relances', 'Relances'], ['documents', 'Documents'], ['operations', 'Opérations']];
  const COURTS = { bilan: 'Bilan', operations: 'Opérations' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    if (filtre.operationId && !operation(filtre.operationId)) filtre.operationId = '';
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Registre<br>du DOE</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
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
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Registre du DOE`;
    $('#vue').innerHTML = { pieces: vuePieces, bilan: vueBilan, relances: vueRelances, documents: vueDocuments, operations: vueOperations }[vue]();
    if (vue === 'pieces') brancherFiltres();
    if (vue === 'bilan') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const choixOperation = (id, valeur, tous = true) => `<label class="champ">Opération<select id="${id}">${tous ? '<option value="">Toutes les opérations</option>' : ''}${E.operations.map((o) => `<option value="${o.id}" ${o.id === valeur ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>`;
  const piecesOp = (opId) => (opId ? E.pieces.filter((p) => p.operationId === opId) : E.pieces);

  // ---------- Vue Pièces ----------
  const ETATS = {
    retard: ['rouge', 'En retard'], attendue: ['contour', 'Attendue'], recue: ['jaune', 'Reçue, à vérifier'], 'a-reprendre': ['rose', 'À reprendre'], validee: ['bleu', 'Validée'],
  };
  const COULEUR_ETAT = { retard: 'var(--rouge)', attendue: 'var(--gris)', recue: 'var(--jaune)', 'a-reprendre': '#E58C74', validee: 'var(--bleu)' };

  // Le filtre de lot porte sur l'identifiant (une opération) ou sur « code|nom » (toutes les opérations).
  function filtreEffectif() {
    const f = { ...filtre, lotIds: null };
    if (filtre.lotId) {
      if (filtre.operationId) f.lotIds = new Set([filtre.lotId]);
      else { const [code, nom] = filtre.lotId.split('|'); f.lotIds = new Set(E.lots.filter((l) => l.code === code && l.nom === nom).map((l) => l.id)); }
    }
    return f;
  }
  const listeFiltree = () => R.trier(R.filtrer(E.pieces, filtreEffectif(), ctx(), extraRecherche, entrepriseDe), ctx(), ordreLot);

  function vuePieces() {
    const c = ctx();
    const i = R.indicateurs(piecesOp(filtre.operationId), c);
    const lotsVisibles = filtre.operationId ? lotsDe(filtre.operationId) : E.lots;
    const lotsUniques = [...new Map(lotsVisibles.map((l) => [filtre.operationId ? l.id : `${l.code}|${l.nom}`, l])).values()].sort((a, b) => ordreCode(a.code) - ordreCode(b.code));
    const manquantes = i.attendues + i.aReprendre;
    const titre = !E.pieces.length ? 'Aucune pièce attendue pour l\'instant.'
      : i.retard ? `<mark>${pluriel(i.retard, 'pièce')} en retard</mark> sur ${manquantes} manquante${manquantes > 1 ? 's' : ''}.`
        : manquantes + i.recues ? `DOE complet à ${i.completude} %, <mark>aucun retard</mark>.` : '<mark>DOE complet</mark> : toutes les pièces sont validées.';
    const tuile = (statut, lib, v, d, col, forme = '') => `<button class="tuile ${forme}" style="--c:${col}" data-action="filtre-statut" data-statut="${statut}" aria-pressed="${filtre.statut === statut}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></button>`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(filtre.operationId ? operation(filtre.operationId)?.nom : pluriel(E.operations.length, 'opération'))} · ${fmt(c.auj, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titre}</h1></div>
        <div class="actions"><button class="btn" data-action="csv">Export CSV</button><button class="btn primaire" data-action="piece-nouvelle">${ICONES.plus}Pièce</button></div></div>
      <div class="tuiles">
        ${tuile('retard', 'En retard', i.retard, i.retard ? `Plus ancien : ${pluriel(i.plusAncienRetard, 'jour')}` : 'Aucune date limite dépassée', 'var(--rouge)', 'rond')}
        ${tuile('manquantes', 'Manquantes', manquantes, i.aReprendre ? `dont ${i.aReprendre} à reprendre` : 'Attendues ou à reprendre', 'var(--gris)')}
        ${tuile('recue', 'À vérifier', i.recues, 'Reçues, pas encore validées', 'var(--jaune)')}
        ${tuile('validee', 'Validées', i.validees, i.completude === null ? 'Aucune pièce' : `Complétude ${i.completude} %`, 'var(--bleu)', 'rond')}
      </div>
      <form class="filtres filtres-doe" id="filtres" role="search" onsubmit="return false">
        ${choixOperation('f-op', filtre.operationId)}
        <label class="champ">Lot<select id="f-lot"><option value="">Tous les lots</option>${lotsUniques.map((l) => { const v = filtre.operationId ? l.id : `${l.code}|${l.nom}`; return `<option value="${esc(v)}" ${filtre.lotId === v ? 'selected' : ''}>${esc(nomLot(l))}</option>`; }).join('')}</select></label>
        <label class="champ">Entreprise<select id="f-ent"><option value="">Toutes les entreprises</option>${[...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => `<option value="${e.id}" ${filtre.entrepriseId === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
        <label class="champ">Famille<select id="f-fam"><option value="">Toutes les familles</option>${B.familles.map((f) => `<option value="${f.code}" ${filtre.famille === f.code ? 'selected' : ''}>${esc(f.court)}</option>`).join('')}</select></label>
        <label class="champ">Statut<select id="f-statut">${[['a-traiter', 'À traiter (hors validées)'], ['manquantes', 'Manquantes'], ['retard', 'En retard'], ['attendue', 'Attendues'], ['recue', 'Reçues, à vérifier'], ['a-reprendre', 'À reprendre'], ['validee', 'Validées'], ['tous', 'Toutes']].map(([v, l]) => `<option value="${v}" ${filtre.statut === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="champ recherche">Rechercher<input id="f-texte" type="search" value="${esc(filtre.texte)}" placeholder="Pièce, référence, n°…" autocomplete="off"></label>
      </form>
      <div id="liste">${listeHtml()}</div>`;
  }

  function listeHtml() {
    const c = ctx();
    const liste = listeFiltree();
    if (!E.pieces.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune pièce attendue</h3><p>Ajoute un lot à ton opération : ses pièces types (plans, notices, PV d'essais, fiches techniques, garanties) sont créées d'un coup, à ajuster ensuite.</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="operations">Voir les opérations</button></div></div></div>`;
    if (!liste.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune pièce pour ces filtres</h3><p>${filtre.statut === 'retard' ? 'Aucune date limite dépassée : rien à relancer.' : 'Change de statut ou efface la recherche.'}</p><div class="actions"><button class="btn" data-action="filtres-effacer">Effacer les filtres</button></div></div></div>`;
    const MAX = 200;
    return `<p class="compteur">${pluriel(liste.length, 'pièce')}${liste.length > MAX ? ` · ${MAX} premières affichées, affine les filtres` : ''}</p><ul class="cartes">${liste.slice(0, MAX).map((p) => cartePiece(p, c)).join('')}</ul>`;
  }

  function nbRelances(p) { return E.relances.filter((r) => (r.pieces || []).includes(p.id)).length; }

  function cartePiece(p, c) {
    const et = R.etat(p, c);
    const [cl, lib] = ETATS[et];
    const l = lot(p.lotId), o = operation(p.operationId);
    const ech = R.echeance(p, c);
    const etiquettes = [`<span class="etiquette fam">${esc(famille(p.famille).court)}</span>`];
    if (et === 'retard') etiquettes.push(`<span class="etiquette rouge">En retard · ${R.joursRetard(p, c)} j</span>${p.statut === 'a-reprendre' ? '<span class="etiquette rose">À reprendre</span>' : ''}`);
    else etiquettes.push(`<span class="etiquette ${cl}">${lib}</span>`);
    if (R.proche(p, c)) etiquettes.push(`<span class="etiquette contour">Attendue ${quand(ech)}</span>`);
    const n = nbRelances(p);
    const dates = p.statut === 'validee' ? `Reçue ${fmtCourt(p.recueLe)} · validée ${fmtCourt(p.valideeLe)}`
      : p.statut === 'recue' ? `Reçue ${p.recueLe === c.auj ? 'aujourd\'hui' : fmtCourt(p.recueLe)}` : ech ? `Date limite ${fmtCourt(ech)}` : 'Pas de date limite';
    const actions = R.aCharge(p)
      ? `<button class="act" data-action="recue" data-id="${p.id}">Reçue<small>à vérifier ensuite</small></button>`
      : p.statut === 'recue'
        ? `<button class="act accepter" data-action="valider" data-id="${p.id}">Valider<small>conforme</small></button><button class="act refuser" data-action="reprendre" data-id="${p.id}">À reprendre<small>motif à noter</small></button>`
        : '';
    return `
      <li class="carte res ${p.statut === 'validee' ? 'soldee' : ''}" style="--c:${COULEUR_ETAT[et]}" data-carte="${p.id}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-matiere"><span class="numero">${esc(p.numero)}</span>${!filtre.operationId && E.operations.length > 1 ? `<span>${esc(o?.nom || '')}</span>` : ''}${etiquettes.join('')}</p>
          <h3>${esc(p.intitule)}</h3>
          <p class="carte-meta"><span><b>${esc(nomEnt(entrepriseDe(p)))}</b> · ${esc(nomLot(l))}</span><span>${dates}</span>${p.reference ? `<span>Réf. ${esc(p.reference)}</span>` : ''}${n ? `<span>${pluriel(n, 'relance')}</span>` : ''}</p>
          ${p.statut === 'a-reprendre' && p.motif ? `<p class="motif"><b>À reprendre :</b> ${esc(p.motif)}</p>` : ''}
        </div>
        ${actions ? `<div class="carte-actions ${p.statut === 'recue' ? 'deux' : ''}">${actions}</div>` : ''}
        <div class="carte-plus"><button data-action="piece-modifier" data-id="${p.id}">Modifier ou changer le statut</button>${p.historique.length ? `<span>${pluriel(p.historique.length, 'étape')} dans l'historique</span>` : ''}</div>
      </li>`;
  }

  function brancherFiltres() {
    const maj = () => { $('#liste').innerHTML = listeHtml(); };
    $('#f-op').addEventListener('change', (e) => { filtre.operationId = e.target.value; filtre.lotId = ''; rendre(); });
    $('#f-lot').addEventListener('change', (e) => { filtre.lotId = e.target.value; maj(); });
    $('#f-ent').addEventListener('change', (e) => { filtre.entrepriseId = e.target.value; maj(); });
    $('#f-fam').addEventListener('change', (e) => { filtre.famille = e.target.value; maj(); });
    $('#f-statut').addEventListener('change', (e) => { filtre.statut = e.target.value; rendre(); });
    $('#f-texte').addEventListener('input', (e) => { filtre.texte = e.target.value; maj(); });
  }

  // ---------- Vue Complétude ----------
  const SEGMENTS = [['validees', 'Validées', '#2E5A88'], ['recues', 'Reçues, à vérifier', '#E8B93A'], ['aReprendre', 'À reprendre', '#E58C74'], ['attendues', 'Attendues', '#E4DCCE']];

  function vueBilan() {
    const c = ctx();
    const liste = piecesOp(filtre.operationId);
    const i = R.indicateurs(liste, c);
    const parEnt = R.parCle(liste, entrepriseDe, c);
    const cleLot = (p) => { const l = lot(p.lotId); return l ? (filtre.operationId ? l.id : `${l.code}|${l.nom}`) : ''; };
    const parLot = R.parCle(liste, cleLot, c).sort((a, b) => ordreCode(a.cle.split('|')[0] || lot(a.cle)?.code) - ordreCode(b.cle.split('|')[0] || lot(b.cle)?.code));
    const nomCleLot = (k) => { if (!k) return 'Sans lot'; if (!k.includes('|')) return nomLot(lot(k)); const [code, nom] = k.split('|'); return `${code} · ${nom}`; };
    const parFam = R.parCle(liste, (p) => p.famille, c).sort((a, b) => B.familles.findIndex((f) => f.code === a.cle) - B.familles.findIndex((f) => f.code === b.cle));
    const op = filtre.operationId ? operation(filtre.operationId) : null;
    const tuiles = [
      ['Complétude', i.completude ?? '–', i.completude === null ? '' : '%', `${i.validees} validée${i.validees > 1 ? 's' : ''} sur ${i.total}`, 'var(--bleu)', 'rond'],
      ['Remises', i.remises ?? '–', i.remises === null ? '' : '%', `dont ${i.recues} à vérifier`, 'var(--jaune)', ''],
      ['Manquantes', i.attendues + i.aReprendre, '', `${i.aReprendre} à reprendre`, 'var(--gris)', ''],
      ['En retard', i.retard, '', i.retard ? `plus ancien : ${pluriel(i.plusAncienRetard, 'jour')}` : 'aucune date limite dépassée', 'var(--rouge)', 'rond'],
    ].map(([lib, v, u, d, col, f]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const pct = (x) => (x === null ? '–' : `${x} %`);
    const ligneTab = (nom, x) => `<tr><td>${nom}</td><td class="nb">${x.total}</td><td class="nb">${x.validees}</td><td class="nb">${x.recues}</td><td class="nb">${x.attendues + x.aReprendre}</td><td class="nb ${x.retard ? 'alerte' : ''}">${x.retard}${x.retard ? ` <small>(${x.plusAncienRetard} j)</small>` : ''}</td><td class="nb"><span class="jauge" style="--p:${x.completude ?? 0}%"></span>${pct(x.completude)}</td></tr>`;
    const tete = (premier) => `<thead><tr><th>${premier}</th><th class="nb">Pièces</th><th class="nb">Validées</th><th class="nb">À vérifier</th><th class="nb">Manquantes</th><th class="nb">En retard</th><th class="nb">Complétude</th></tr></thead>`;
    return `
      <div class="vue-tete"><div><h1>Complétude du DOE</h1><p>Complétude = pièces validées sur pièces attendues. ${op ? `Date limite de remise : ${op.dateLimite ? fmtCourt(op.dateLimite) : 'non fixée'}.` : 'Choisis une opération pour son détail.'}</p></div>
        <div class="actions bord-choix">${choixOperation('b-op', filtre.operationId)}</div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Par entreprise <span>Survole ou touche une barre pour le détail.</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Pièces par entreprise et par statut</h2><div class="legende">${SEGMENTS.map(([, l, col]) => `<span><i style="background:${col}"></i>${l}</span>`).join('')}</div></div>
        ${parEnt.length ? `<div class="piles">${parEnt.map((x, k) => pile(x, k, parEnt)).join('')}</div>` : '<p class="vide-graph">Aucune pièce sur cette sélection.</p>'}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Pièces par entreprise et par statut</caption><thead><tr><th>Entreprise</th>${SEGMENTS.map(([, l]) => `<th>${l}</th>`).join('')}<th>Complétude</th></tr></thead><tbody>${parEnt.map((x) => `<tr><td>${esc(nomEnt(x.cle))}</td>${SEGMENTS.map(([k]) => `<td>${x[k]}</td>`).join('')}<td>${pct(x.completude)}</td></tr>`).join('')}</tbody></table></div>
      </figure>
      <h2 class="titre-section">Par lot</h2>
      ${parLot.length ? `<div class="defile"><table class="tableau">${tete('Lot')}<tbody>${parLot.map((x) => ligneTab(esc(nomCleLot(x.cle)), x)).join('')}</tbody></table></div>` : '<p class="note">Aucune pièce.</p>'}
      <h2 class="titre-section">Par entreprise</h2>
      ${parEnt.length ? `<div class="defile"><table class="tableau">${tete('Entreprise')}<tbody>${parEnt.map((x) => ligneTab(esc(nomEnt(x.cle)), x)).join('')}</tbody></table></div>` : '<p class="note">Aucune pièce.</p>'}
      <h2 class="titre-section">Par famille de pièces</h2>
      ${parFam.length ? `<div class="defile"><table class="tableau">${tete('Famille')}<tbody>${parFam.map((x) => ligneTab(esc(famille(x.cle).nom), x)).join('')}</tbody></table></div>` : '<p class="note">Aucune pièce.</p>'}`;
  }

  function pile(x, k, tous) {
    const nom = nomEnt(x.cle);
    const max = Math.max(1, ...tous.map((y) => y.total));
    return `<div class="pile" data-i="${k}" tabindex="0" aria-label="${esc(nom)} : ${SEGMENTS.map(([c, l]) => `${l} ${x[c]}`).join(', ')}, complétude ${x.completude} %">
      <div class="pile-tete"><b>${esc(nom)}</b><span>${x.completude === 100 ? 'complet' : `${x.completude} % validé`}${x.retard ? ` · <em>${x.retard} en retard</em>` : ''}</span></div>
      <div class="pile-barre"><div class="pile-segments" style="width:${(x.total / max) * 100}%">${SEGMENTS.map(([c, , coul]) => (x[c] ? `<i style="flex:${x[c]};background:${coul}"></i>` : '')).join('')}</div><span class="pile-total">${x.total}</span></div>
    </div>`;
  }

  function brancherGraphique() {
    $('#b-op')?.addEventListener('change', (e) => { filtre.operationId = e.target.value; filtre.lotId = ''; rendre(); });
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const parEnt = R.parCle(piecesOp(filtre.operationId), entrepriseDe, ctx());
    const montrer = (el) => {
      const x = parEnt[Number(el.dataset.i)];
      fig.querySelectorAll('.pile').forEach((p) => p.classList.toggle('active', p === el));
      bulle.innerHTML = `<b>${esc(nomEnt(x.cle))}</b>${SEGMENTS.map(([c, l, coul]) => `<div><i style="background:${coul}"></i>${l} : ${x[c]}</div>`).join('')}<div>Complétude : ${x.completude} %</div>${x.retard ? `<div>En retard : ${x.retard}</div>` : ''}`;
      bulle.hidden = false;
      const rp = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      bulle.style.left = `${Math.max(8, Math.min(rf.width - bulle.offsetWidth - 8, rp.left - rf.left + 40))}px`;
      bulle.style.top = `${rp.bottom - rf.top + 4}px`;
    };
    fig.querySelectorAll('.pile').forEach((p) => {
      p.addEventListener('pointerenter', () => montrer(p));
      p.addEventListener('click', () => montrer(p));
      p.addEventListener('focus', () => montrer(p));
    });
    const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.pile').forEach((p) => p.classList.remove('active')); };
    fig.addEventListener('pointerleave', cacher);
    fig.addEventListener('focusout', cacher);
  }

  // ---------- Vue Relances ----------
  function vueRelances() {
    const c = ctx();
    const dues = R.relancesDues(piecesOp(filtre.operationId), E.relances, entrepriseDe, c, E.reglages.intervalle);
    const journal = E.relances.filter((r) => !filtre.operationId || r.operationId === filtre.operationId).sort((a, b) => b.date.localeCompare(a.date));
    const aFaire = dues.filter((d) => d.due).length;
    const carte = (d) => `
      <li class="relance ${d.due ? 'due' : ''}">
        <div class="relance-corps">
          <p class="carte-matiere">${E.operations.length > 1 && !filtre.operationId ? `<span>${esc(operation(d.operationId)?.nom || '')}</span>` : ''}<span class="etiquette ${d.due ? 'rouge' : 'contour'}">${d.due ? 'À relancer' : `Relancée ${depuis(d.derniere)}`}</span></p>
          <h3>${esc(nomEnt(d.entrepriseId))}</h3>
          <p class="carte-meta"><span><b>${pluriel(d.pieces.length, 'pièce')} en retard</b> · plus ancien ${pluriel(d.plusAncien, 'jour')}</span><span>${d.nb ? `${pluriel(d.nb, 'relance')}, dernière le ${fmtCourt(d.derniere)}` : 'Jamais relancée'}</span></p>
          <ul class="relance-pieces">${d.pieces.slice(0, 4).map((p) => `<li><b>${esc(p.numero)}</b> ${esc(p.intitule)}</li>`).join('')}${d.pieces.length > 4 ? `<li>et ${d.pieces.length - 4} autre${d.pieces.length > 5 ? 's' : ''}…</li>` : ''}</ul>
        </div>
        <div class="relance-actions"><button class="btn ${d.due ? 'primaire' : ''} petit" data-action="relancer" data-op="${d.operationId}" data-ent="${d.entrepriseId}">Préparer la relance</button></div>
      </li>`;
    return `
      <div class="vue-tete"><div><h1>${dues.length ? `${aFaire ? `<mark>${pluriel(aFaire, 'entreprise')} à relancer</mark>` : 'Relances à jour'}` : 'Aucune pièce en retard.'}</h1><p>Une entreprise est à relancer quand elle a des pièces en retard et qu'elle n'a pas été relancée depuis ${pluriel(E.reglages.intervalle, 'jour')} (réglable). Le courrier se copie ou s'imprime : rien n'est envoyé par l'outil.</p></div>
        <div class="actions bord-choix">${choixOperation('r-op', filtre.operationId)}</div></div>
      ${dues.length ? `<ul class="relances">${dues.map(carte).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à relancer</h3><p>Aucune pièce attendue n'a dépassé sa date limite${filtre.operationId ? ' sur cette opération' : ''}.</p></div></div>`}
      <h2 class="titre-section">Journal des relances <span>${pluriel(journal.length, 'relance notée', 'relances notées')}.</span></h2>
      ${journal.length ? `<div class="defile"><table class="tableau journal"><thead><tr><th>Date</th><th>Entreprise</th>${E.operations.length > 1 ? '<th>Opération</th>' : ''}<th>Mode</th><th class="nb">Pièces</th><th>Note</th><th><span class="sr-only">Supprimer</span></th></tr></thead><tbody>${journal.map((r) => `<tr><td>${fmtCourt(r.date)}</td><td>${esc(nomEnt(r.entrepriseId))}</td>${E.operations.length > 1 ? `<td>${esc(operation(r.operationId)?.nom || '')}</td>` : ''}<td>${esc(r.mode)}</td><td class="nb">${(r.pieces || []).length}</td><td>${esc(r.note || '')}</td><td><button class="btn lien" data-action="relance-suppr" data-id="${r.id}" aria-label="Supprimer la relance du ${fmtCourt(r.date)}">Supprimer</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Aucune relance notée pour l\'instant.</p>'}`;
  }

  function donneesCourrier(opId, entId, date, nouvelleDate) {
    const c = ctx();
    const op = operation(opId), ent = entreprise(entId) || { nom: 'Entreprise à désigner' };
    const pieces = R.trier(E.pieces.filter((p) => p.operationId === opId && entrepriseDe(p) === (entId || '') && R.aCharge(p)), c, ordreLot);
    const rang = E.relances.filter((r) => r.operationId === opId && r.entrepriseId === entId && r.date <= c.auj).length + 1;
    return { pieces, texte: R.texteRelance({ structure: E.structure, operation: op, entreprise: ent, date, rang, nouvelleDate,
      pieces: pieces.map((p) => ({ numero: p.numero, lot: nomLot(lot(p.lotId)), intitule: p.intitule, statut: p.statut, motif: p.motif, echeance: R.echeance(p, c) })) }) };
  }

  function modaleRelance(opId, entId) {
    const t = auj();
    const nouvelle = ajout(t, E.reglages.delaiReprise);
    const { pieces, texte } = donneesCourrier(opId, entId, t, nouvelle);
    ouvrirModale(`Relance · ${esc(nomEnt(entId))}`, `
      <p class="aide">${esc(operation(opId)?.nom || '')} · ${pluriel(pieces.length, 'pièce manquante', 'pièces manquantes')} (attendues ou à reprendre). Relis et adapte le courrier, puis copie-le ou imprime-le.</p>
      <label class="champ">Courrier de relance<textarea name="texte" id="m-texte" rows="14" class="lettre-saisie">${esc(texte)}</textarea></label>
      <div class="rang"><button class="btn petit" type="button" data-action="copier">Copier le texte</button><button class="btn petit" type="button" data-action="imprimer-lettre">Imprimer ou PDF</button></div>
      <div class="groupe"><h3>Noter la relance</h3>
        <div class="grille-2">
          <label class="champ">Date<input type="date" name="date" value="${t}" max="${t}" required></label>
          <label class="champ">Mode<select name="mode">${B.modesRelance.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
        </div>
        <label class="champ">Note<small>Facultatif : engagement de l'entreprise, référence du courrier…</small><input name="note" maxlength="200"></label>
      </div>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Noter la relance</button><button class="btn" value="annuler">Fermer</button>', (f) => {
      const date = f.get('date');
      if (!R.estDate(date) || date > t) return 'Date de relance invalide (pas dans le futur).';
      const r = { id: uid(), operationId: opId, entrepriseId: entId, date, mode: f.get('mode'), note: String(f.get('note') || '').trim(), pieces: pieces.map((p) => p.id) };
      E.relances.push(r);
      annulation = () => { E.relances = E.relances.filter((x) => x.id !== r.id); };
      sauver(); rendre(); toast(`Relance de ${nomEnt(entId)} notée (${pluriel(r.pieces.length, 'pièce')}).`, { libelle: 'Annuler', faire: annuler });
    });
  }

  async function copier(texte) {
    try { await navigator.clipboard.writeText(texte); toast('Courrier copié : colle-le dans ta messagerie ou ton traitement de texte.'); return; } catch { /* repli */ }
    const zone = $('#m-texte');
    if (zone) { zone.select(); try { document.execCommand('copy'); toast('Courrier copié.'); } catch { toast('Copie impossible : sélectionne le texte à la main.'); } }
  }

  function imprimerLettre(texte) {
    $('#impression').innerHTML = `<div class="lettre">${texte.split('\n').map((l) => (l ? `<p>${esc(l)}</p>` : '<p class="vide">&nbsp;</p>')).join('')}</div>`;
    window.print();
  }

  // ---------- Vue Documents ----------
  function vueDocuments() {
    if (!docChoix.operationId || !operation(docChoix.operationId)) docChoix.operationId = filtre.operationId || E.operations[0]?.id || '';
    const op = operation(docChoix.operationId);
    const ps = E.pieces.filter((p) => p.operationId === docChoix.operationId);
    const ents = E.entreprises.filter((e) => ps.some((p) => entrepriseDe(p) === e.id)).sort((a, b) => a.nom.localeCompare(b.nom));
    if (docChoix.entrepriseId && !ents.some((e) => e.id === docChoix.entrepriseId)) docChoix.entrepriseId = '';
    if (docChoix.type === 'manquantes' && !docChoix.entrepriseId) docChoix.entrepriseId = ents[0]?.id || '';
    const types = [['bordereau', 'Bordereau de transmission'], ['manquantes', 'Pièces manquantes']];
    const c = ctx();
    return `
      <div class="vue-tete"><div><h1>Documents</h1><p>Le bordereau de transmission reprend les pièces validées, lot par lot, pour accompagner la remise du DOE. L'état des pièces manquantes se joint à une relance.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer" ${op ? '' : 'disabled'}>Imprimer ou PDF</button></div></div>
      <div class="filtres doc-choix">
        <label class="champ">Opération<select data-doc="operationId">${E.operations.map((o) => `<option value="${o.id}" ${o.id === docChoix.operationId ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>
        <label class="champ">Entreprise<select data-doc="entrepriseId">${docChoix.type === 'bordereau' ? '<option value="">Toutes les entreprises</option>' : ''}${ents.map((e) => { const n = R.indicateurs(ps.filter((p) => entrepriseDe(p) === e.id), c); return `<option value="${e.id}" ${e.id === docChoix.entrepriseId ? 'selected' : ''}>${esc(e.nom)} (${docChoix.type === 'bordereau' ? `${n.validees} validée${n.validees > 1 ? 's' : ''}` : `${n.attendues + n.aReprendre} manquante${n.attendues + n.aReprendre > 1 ? 's' : ''}`})</option>`; }).join('')}</select></label>
        <fieldset class="champ bascule"><legend>Document</legend><div>${types.map(([v, l]) => `<label><input type="radio" name="doc-type" data-doc="type" value="${v}" ${docChoix.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        ${docChoix.type === 'bordereau' ? `<label class="champ">Destinataire<input data-doc-texte="destinataire" value="${esc(docChoix.destinataire)}" maxlength="80" placeholder="${esc(op?.moa || 'Maître d\'ouvrage')}"></label>
        <label class="case doc-case"><input type="checkbox" data-doc="avecRecues" ${docChoix.avecRecues ? 'checked' : ''}> Inclure les pièces reçues pas encore validées</label>` : ''}
      </div>
      ${op ? `<div class="pv-cadre"><article class="pv-doc" id="pv-doc">${docChoix.type === 'bordereau' ? documentBordereau(op) : documentManquantes(op, entreprise(docChoix.entrepriseId))}</article></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à éditer</h3><p>Crée une opération pour éditer ses documents.</p></div></div>`}`;
  }

  const enteteDoc = (titre, op, lignes) => `
    <header>
      <p class="pv-structure">${esc(E.structure || 'Maîtrise d\'œuvre')}</p>
      <h2>${titre}</h2>
      <dl>
        <div><dt>Opération</dt><dd>${esc(op.nom)}${op.adresse ? `<br>${esc(op.adresse)}` : ''}</dd></div>
        ${op.moa ? `<div><dt>Maître d'ouvrage</dt><dd>${esc(op.moa)}</dd></div>` : ''}
        ${lignes}
        <div><dt>Établi le</dt><dd>${fmtCourt(auj())}</dd></div>
      </dl>
    </header>`;
  const signatures = (roles) => `<div class="signatures">${roles.map((r) => `<div><p>${r}</p><p class="sig-lignes">Nom, qualité, date<br>Signature</p></div>`).join('')}</div>`;
  const piedDoc = '<footer>Document établi à partir d\'un modèle, à adapter aux pièces du marché de l\'opération (CCAP, CCTP).</footer>';

  function documentBordereau(op) {
    const c = ctx();
    let ps = E.pieces.filter((p) => p.operationId === op.id);
    if (docChoix.entrepriseId) ps = ps.filter((p) => entrepriseDe(p) === docChoix.entrepriseId);
    const total = R.indicateurs(ps, c);
    const liste = R.bordereau(ps, { avecRecues: docChoix.avecRecues, ordreLot });
    const groupes = [];
    for (const p of liste) { const k = p.lotId; if (!groupes.length || groupes.at(-1).k !== k) groupes.push({ k, ps: [] }); groupes.at(-1).ps.push(p); }
    const ent = docChoix.entrepriseId ? entreprise(docChoix.entrepriseId) : null;
    const dest = docChoix.destinataire || op.moa || 'Maître d\'ouvrage';
    return `${enteteDoc('Bordereau de transmission du DOE', op, `<div><dt>Destinataire</dt><dd>${esc(dest)}</dd></div>${ent ? `<div><dt>Entreprise</dt><dd>${esc(ent.nom)}</dd></div>` : ''}${op.reception ? `<div><dt>Réception</dt><dd>${fmtCourt(op.reception)}</dd></div>` : ''}`)}
      <p class="pv-synthese">${pluriel(liste.length, 'pièce transmise', 'pièces transmises')} sur ${pluriel(total.total, 'pièce attendue', 'pièces attendues')}${ent ? ' pour cette entreprise' : ''} · complétude ${total.completude ?? 0} %.${total.attendues + total.aReprendre ? ` ${pluriel(total.attendues + total.aReprendre, 'pièce reste', 'pièces restent')} à remettre ou à reprendre.` : ''}</p>
      ${groupes.length ? groupes.map((g) => { const l = lot(g.k); return `<h3>${esc(nomLot(l))} · ${esc(nomEnt(l?.entrepriseId))}</h3><table><thead><tr><th>N°</th><th>Pièce</th><th>Référence</th><th>Format</th><th>Reçue le</th><th>État</th></tr></thead><tbody>${g.ps.map((p) => `<tr><td class="num">${esc(p.numero)}</td><td>${esc(p.intitule)}</td><td class="ref">${esc(p.reference || '–')}</td><td>${esc(p.format || '–')}</td><td class="date">${fmtCourt(p.recueLe)}</td><td class="date">${p.statut === 'validee' ? `Validée le ${fmtCourt(p.valideeLe)}` : '<em>À vérifier</em>'}</td></tr>`).join('')}</tbody></table>`; }).join('')
        : '<p class="pv-vide">Aucune pièce validée à transmettre pour l\'instant.</p>'}
      ${signatures(['Remis par', 'Reçu par'])}
      ${piedDoc}`;
  }

  function documentManquantes(op, ent) {
    if (!ent) return `${enteteDoc('Pièces du DOE manquantes', op, '')}<p class="pv-vide">Aucune entreprise avec des pièces sur cette opération.</p>${piedDoc}`;
    const c = ctx();
    const ps = R.trier(E.pieces.filter((p) => p.operationId === op.id && entrepriseDe(p) === ent.id && R.aCharge(p)), c, ordreLot);
    const recues = E.pieces.filter((p) => p.operationId === op.id && entrepriseDe(p) === ent.id && p.statut === 'recue');
    const lots = lotsDe(op.id).filter((l) => l.entrepriseId === ent.id).map(nomLot);
    const rel = E.relances.filter((r) => r.operationId === op.id && r.entrepriseId === ent.id).sort((a, b) => a.date.localeCompare(b.date));
    return `${enteteDoc('Pièces du DOE manquantes', op, `<div><dt>Entreprise</dt><dd>${esc(ent.nom)}${ent.contact ? `<br>${esc(ent.contact)}` : ''}${ent.email ? `<br>${esc(ent.email)}` : ''}</dd></div><div><dt>Lot${lots.length > 1 ? 's' : ''}</dt><dd>${lots.map(esc).join('<br>') || '–'}</dd></div>${op.dateLimite ? `<div><dt>Date limite du DOE</dt><dd>${fmtCourt(op.dateLimite)}</dd></div>` : ''}${rel.length ? `<div><dt>Relances</dt><dd>${rel.map((r) => `${fmtCourt(r.date)} (${esc(r.mode.toLowerCase())})`).join('<br>')}</dd></div>` : ''}`)}
      <p class="pv-texte">Merci de nous transmettre les pièces ci-dessous, conformes à la réalisation, et de nous signaler chaque envoi.</p>
      <h3>Pièces à remettre ou à reprendre (${ps.length})</h3>
      ${ps.length ? `<table><thead><tr><th>N°</th><th>Lot</th><th>Pièce</th><th>Date limite</th><th>Remise le</th></tr></thead><tbody>${ps.map((p) => `<tr><td class="num">${esc(p.numero)}</td><td>${esc(lot(p.lotId)?.code || '')}</td><td>${esc(p.intitule)}${p.statut === 'a-reprendre' && p.motif ? `<br><em>À reprendre : ${esc(p.motif)}</em>` : ''}</td><td class="date">${fmtCourt(R.echeance(p, c))}${R.enRetard(p, c) ? '<br><b>en retard</b>' : ''}</td><td class="date"></td></tr>`).join('')}</tbody></table>` : '<p class="pv-vide">Aucune pièce manquante : merci.</p>'}
      ${recues.length ? `<h3>Reçues, en cours de vérification (${recues.length})</h3><table><thead><tr><th>N°</th><th>Lot</th><th>Pièce</th><th>Reçue le</th></tr></thead><tbody>${recues.map((p) => `<tr><td class="num">${esc(p.numero)}</td><td>${esc(lot(p.lotId)?.code || '')}</td><td>${esc(p.intitule)}</td><td class="date">${fmtCourt(p.recueLe)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${piedDoc}`;
  }

  function imprimer() {
    const doc = $('#pv-doc');
    if (!doc) return;
    $('#impression').innerHTML = doc.innerHTML;
    window.print();
  }

  // ---------- Vue Opérations (avec pièces types et guide) ----------
  function vueOperations() {
    const c = ctx();
    const ops = E.operations.map((o) => {
      const ps = E.pieces.filter((p) => p.operationId === o.id);
      const i = R.indicateurs(ps, c);
      const lots = lotsDe(o.id);
      return `
        <article class="op">
          <div class="op-tete"><div><h2>${esc(o.nom)}</h2><p>${[o.moa, o.reception && `réception ${fmtCourt(o.reception)}`, `DOE attendu ${o.dateLimite ? `le ${fmtCourt(o.dateLimite)}` : 'sans date limite'}`, o.diuo && 'avec DIUO'].filter(Boolean).map(esc).join(' · ')}</p></div><button data-action="operation-modifier" data-id="${o.id}">Modifier</button></div>
          <div class="matiere-chiffres"><div><b>${i.completude ?? '–'}${i.completude === null ? '' : '<small> %</small>'}</b><span>complétude</span></div><div><b>${i.attendues + i.aReprendre}</b><span>manquantes</span></div><div><b style="${i.retard ? 'color:var(--rouge)' : ''}">${i.retard}</b><span>en retard</span></div></div>
          <div class="maitrise" role="img" aria-label="Complétude : ${i.completude ?? 0} %"><i style="width:${i.completude ?? 0}%"></i></div>
          <div class="op-lots">${lots.length ? lots.map((l) => { const n = R.indicateurs(ps.filter((p) => p.lotId === l.id), c); return `<button class="chapitre" data-action="lot-modifier" data-id="${l.id}"><b>${esc(nomLot(l))}</b><span class="nb-lot ${n.retard ? 'retard' : ''}">${n.total ? `${n.validees} / ${n.total}` : '–'}</span><span>${esc(nomEnt(l.entrepriseId))}${n.retard ? ` · ${n.retard} en retard` : ''}</span></button>`; }).join('') : '<p class="matiere-vide">Aucun lot.</p>'}</div>
          <div class="matiere-pied"><button class="btn petit" data-action="lot-nouveau" data-op="${o.id}">${ICONES.plus}Lot</button><button class="btn petit" data-action="voir-op" data-op="${o.id}">Voir les pièces</button><button class="btn petit" data-action="docs-op" data-op="${o.id}">Bordereau</button></div>
        </article>`;
    }).join('');
    const ents = [...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => {
      const n = R.indicateurs(E.pieces.filter((p) => entrepriseDe(p) === e.id), c);
      const lots = E.lots.filter((l) => l.entrepriseId === e.id);
      return `<button class="ent" data-action="entreprise-modifier" data-id="${e.id}"><b>${esc(e.nom)}</b><span>${lots.length ? esc([...new Set(lots.map((l) => l.code))].join(', ')) : 'Aucun lot attribué'}${e.contact ? ` · ${esc(e.contact)}` : ''}</span><span class="${n.retard ? 'retard' : ''}">${n.total ? `${n.completude} % validé sur ${pluriel(n.total, 'pièce')}${n.retard ? ` · ${n.retard} en retard` : ''}` : 'Aucune pièce'}</span></button>`;
    }).join('');
    const L = B.legal;
    return `
      <div class="vue-tete"><div><h1>Opérations</h1><p>Tes opérations, leurs lots et les entreprises titulaires. Chaque lot ajouté reçoit ses pièces types. Touche un lot pour changer son titulaire ou compléter ses pièces.</p></div>
        <div class="actions"><button class="btn" data-action="entreprise-nouvelle">${ICONES.plus}Entreprise</button><button class="btn primaire" data-action="operation-nouvelle">${ICONES.plus}Opération</button></div></div>
      <div class="ops">${ops}</div>
      <h2 class="titre-section">Entreprises <span>${pluriel(E.entreprises.length, 'entreprise')}, communes à toutes les opérations.</span></h2>
      ${E.entreprises.length ? `<div class="ents">${ents}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune entreprise</h3><p>Ajoute-les ici, puis attribue chaque lot à son titulaire.</p><div class="actions"><button class="btn primaire" data-action="entreprise-nouvelle">${ICONES.plus}Entreprise</button></div></div></div>`}
      <h2 class="titre-section">Pièces types par lot <span>Proposées à chaque nouveau lot. Ajuste-les à tes marchés ; les pièces déjà créées ne changent pas.</span></h2>
      <div class="lots-types">${B.lots.map((l) => { const n = R.piecesTypes(l.code, E.modeles, B).length; const modif = Array.isArray(E.modeles[l.code]); return `<button type="button" data-action="modele" data-code="${l.code}"><b>${l.code}</b><span>${esc(l.nom)}</span><small>${pluriel(n, 'pièce')}${modif ? ' · modifié' : ''}</small></button>`; }).join('')}</div>
      <h2 class="titre-section">Guide</h2>
      <ol class="cycle">${B.cycle.map(([t, d], k) => `<li style="--c:${['var(--gris)', 'var(--jaune)', '#E58C74', 'var(--bleu)'][k]}"><b>${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol>
      <p class="note">Retard : pièce attendue ou à reprendre dont la date limite (la sienne, sinon celle de l'opération) est dépassée. Complétude : pièces validées sur pièces attendues. Les délais proposés (${E.reglages.delaiReprise} jours pour une reprise, relance tous les ${E.reglages.intervalle} jours) sont réglables : ton marché fait foi.</p>
      <div class="methodes guide-grille">
        <article class="methode" style="--c:var(--ciel);--t:var(--encre)"><div class="methode-tete"><h2>Bonnes pratiques</h2></div><ol>${B.conseils.map(([t, d]) => `<li><span><b>${esc(t)}.</b> ${esc(d)}</span></li>`).join('')}</ol></article>
        <article class="methode" style="--c:var(--beurre);--t:var(--encre)"><div class="methode-tete"><h2>Familles de pièces</h2></div><ul class="natures">${B.familles.map((f) => `<li><b>${esc(f.nom)}</b><span>${f.code === 'diuo' ? 'Pièce ajoutée à chaque lot si l\'opération comporte un DIUO (case de l\'opération). Contenu et destinataire selon ton marché.' : `Étiquette « ${esc(f.court)} » dans les listes.`}</span></li>`).join('')}</ul></article>
      </div>
      <h2 class="titre-section">Repère : marchés publics <span>Pas un conseil juridique.</span></h2>
      <div class="legal">
        <p><b>${esc(L.texte)}</b> (${esc(L.version)}, consulté le ${esc(L.consulte)}), en substance :</p>
        <ul>${L.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p><a href="${L.url}" target="_blank" rel="noopener">Voir l'arrêté sur Légifrance</a>. Il ne s'applique qu'aux marchés qui s'y réfèrent ; en marché privé, la liste et les délais viennent de ton contrat. Vérifie toujours les pièces de ton marché.</p>
      </div>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Fichiers</b> : les documents ne sont pas stockés dans l'outil (le service n'enregistre que du texte). Note leur référence (indice, nom du fichier, dossier partagé).</li>
        <li><b>Relances</b> : le courrier se copie ou s'imprime ; aucun e-mail n'est envoyé par l'outil.</li>
        <li><b>Un compte, une clé</b> : mêmes données sur tous tes appareils, sans comptes séparés pour les entreprises.</li>
      </ul>`;
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
      if (err === false) return;
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const optionsLots = (opId, choisi) => lotsDe(opId).map((l) => `<option value="${l.id}" ${l.id === choisi ? 'selected' : ''}>${esc(nomLot(l))} · ${esc(nomEnt(l.entrepriseId))}</option>`).join('');
  const optionsEnts = (choisi) => `<option value="">À désigner</option>${[...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => `<option value="${e.id}" ${e.id === choisi ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}<option value="__nouvelle">+ Nouvelle entreprise…</option>`;
  const optionsFamilles = (choisi) => B.familles.map((f) => `<option value="${f.code}" ${f.code === choisi ? 'selected' : ''}>${esc(f.court)}</option>`).join('');

  function modalePiece(id, opDefaut) {
    if (!E.operations.length) { modaleOperation(); return; }
    const p = id ? piece(id) : null;
    const t = auj();
    const opId = p?.operationId || opDefaut || filtre.operationId || E.operations[0].id;
    if (!p && !lotsDe(opId).length) { toast('Ajoute d\'abord un lot à cette opération.'); modaleLot(null, opId); return; }
    const op = operation(opId);
    const transitions = p ? R.TRANSITIONS[p.statut] : [];
    const libT = { recue: 'Reçue', validee: 'Validée', 'a-reprendre': 'À reprendre', attendue: 'Rouvrir : attendue' };
    const corps = `
      ${!p && E.operations.length > 1 ? `<label class="champ">Opération<select name="operationId" id="m-op">${E.operations.map((o) => `<option value="${o.id}" ${o.id === opId ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>` : `<input type="hidden" name="operationId" value="${opId}">`}
      <label class="champ">Lot<select name="lotId" id="m-lot">${optionsLots(opId, p?.lotId || filtre.lotId)}</select></label>
      <label class="champ">Pièce<input name="intitule" required maxlength="160" value="${esc(p?.intitule || '')}" placeholder="Ex. : PV d'essais d'étanchéité des réseaux"></label>
      <div class="grille-2">
        <label class="champ">Famille<select name="famille">${optionsFamilles(p?.famille || 'autre')}</select></label>
        <label class="champ">Date limite propre<small>Vide : celle de l'opération (${op.dateLimite ? fmtCourt(op.dateLimite) : 'non fixée'}).</small><input type="date" name="echeance" value="${p?.echeance || ''}"></label>
      </div>
      <div class="grille-2">
        <label class="champ">Référence du document<small>Indice, nom du fichier…</small><input name="reference" maxlength="80" value="${esc(p?.reference || '')}"></label>
        <label class="champ">Format de remise<select name="format"><option value="">Non précisé</option>${B.formats.map((f) => `<option ${f === p?.format ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
      </div>
      ${p ? `<div class="groupe"><h3>Statut : ${esc(R.LIBELLES[p.statut])}${R.enRetard(p, ctx()) ? ` · en retard de ${pluriel(R.joursRetard(p, ctx()), 'jour')}` : ''}</h3>
        ${p.historique.length ? `<ol class="historique">${p.historique.map((h) => `<li><b>${fmtCourt(h.date)}</b> ${esc(R.LIBELLES[h.statut])}${h.note ? ` : ${esc(h.note)}` : ''}</li>`).join('')}</ol>` : '<p class="aide">Aucun changement de statut pour l\'instant.</p>'}
        <label class="champ">Changer le statut<select name="vers" id="m-vers"><option value="">Ne pas changer</option>${transitions.map((v) => `<option value="${v}">${libT[v]}</option>`).join('')}</select></label>
        <div class="grille-2" id="m-trans" hidden>
          <label class="champ">Date<input type="date" name="dateT" value="${t}" max="${t}"></label>
          <label class="champ" id="m-ech2">Nouvelle date limite<input type="date" name="echeanceT" value="${ajout(t, E.reglages.delaiReprise)}"></label>
          <label class="champ" style="grid-column:1/-1">Motif ou commentaire<input name="note" maxlength="200"></label>
        </div></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? `Pièce ${esc(p.numero)}` : 'Nouvelle pièce', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer la pièce ${p.numero} « ${p.intitule} » ? Utile quand elle est sans objet pour ce marché.`)) return '';
        const avant = structuredClone(E.pieces);
        E.pieces = E.pieces.filter((x) => x.id !== p.id);
        annulation = () => { E.pieces = avant; };
        sauver(); rendre(); toast(`Pièce ${p.numero} supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const intitule = String(f.get('intitule') || '').trim();
      if (!intitule) return 'Indique l\'intitulé de la pièce.';
      const lotId = f.get('lotId');
      if (!lot(lotId)) return 'Choisis un lot.';
      const echeance = f.get('echeance') || '';
      if (echeance && !R.estDate(echeance)) return 'Date limite invalide.';
      const champs = { lotId, intitule, famille: f.get('famille'), echeance, reference: String(f.get('reference') || '').trim(), format: f.get('format') || '' };
      if (p) {
        let n = { ...p, ...champs };
        const vers = f.get('vers');
        if (vers) {
          try {
            n = R.transition(n, vers, { date: f.get('dateT'), note: f.get('note'), echeance: vers === 'a-reprendre' ? f.get('echeanceT') : undefined, delai: E.reglages.delaiReprise });
          } catch (x) { return x.message; }
        }
        const avant = structuredClone(p);
        Object.assign(p, n);
        annulation = () => { const x = piece(p.id); if (x) { Object.keys(x).forEach((k) => delete x[k]); Object.assign(x, avant); } };
        sauver(); rendre(); toast(vers ? `Pièce ${p.numero} : ${R.LIBELLES[p.statut].toLowerCase()}.` : `Pièce ${p.numero} enregistrée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const operationId = f.get('operationId');
      const n = { id: uid(), operationId, numero: R.prochainNumero(E.pieces, operationId), ...champs, statut: 'attendue', recueLe: null, valideeLe: null, motif: '', historique: [] };
      E.pieces.push(n);
      sauver(); rendre(); toast(`Pièce ${n.numero} ajoutée.`);
    });
    const d = modale();
    $('#m-op', d)?.addEventListener('change', (e) => { $('#m-lot', d).innerHTML = optionsLots(e.target.value, ''); });
    const vers = $('#m-vers', d);
    vers?.addEventListener('change', () => {
      $('#m-trans', d).hidden = !vers.value;
      $('#m-ech2', d).hidden = vers.value !== 'a-reprendre';
    });
  }

  // Reprise depuis la carte : motif obligatoire, nouvelle date limite.
  function modaleReprise(id) {
    const p = piece(id);
    const t = auj();
    ouvrirModale(`À reprendre · ${esc(p.numero)}`, `
      <p class="aide">${esc(p.intitule)} · ${esc(nomEnt(entrepriseDe(p)))}</p>
      <label class="champ">Motif<small>Ce que l'entreprise doit corriger ou compléter ; il figure sur l'état des pièces manquantes et dans la relance.</small><textarea name="note" required maxlength="200"></textarea></label>
      <div class="grille-2"><label class="champ">Vérifiée le<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ">Nouvelle date limite<input type="date" name="echeance" value="${ajout(t, E.reglages.delaiReprise)}"></label></div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Demander la reprise</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      try {
        const n = R.transition(p, 'a-reprendre', { date: f.get('date'), note: f.get('note'), echeance: f.get('echeance') });
        appliquer(p, n, `Pièce ${p.numero} à reprendre : nouvelle date limite ${quand(n.echeance)}.`);
      } catch (x) { return x.message; }
    });
  }

  function modaleOperation(id) {
    const o = id ? operation(id) : null;
    const nb = o ? E.pieces.filter((p) => p.operationId === o.id).length : 0;
    const t = auj();
    const corps = `
      <label class="champ">Nom de l'opération<input name="nom" required maxlength="80" value="${esc(o?.nom || '')}"></label>
      <div class="grille-2">
        <label class="champ">Maître d'ouvrage<input name="moa" maxlength="80" value="${esc(o?.moa || '')}"></label>
        <label class="champ">Adresse<input name="adresse" maxlength="120" value="${esc(o?.adresse || '')}"></label>
        <label class="champ">Date de réception<input type="date" name="reception" id="m-rec" value="${o ? o.reception || '' : t}"></label>
        <label class="champ">Date limite de remise du DOE<small>Pour toutes les pièces sans date propre.</small><input type="date" name="dateLimite" id="m-lim" value="${o ? o.dateLimite || '' : ajout(t, E.reglages.delaiRemise)}"></label>
      </div>
      <label class="case"><input type="checkbox" name="diuo" ${o?.diuo ? 'checked' : ''}> L'opération comporte un DIUO ${o ? '(ajoute la pièce « Éléments pour le DIUO » aux lots qui ne l\'ont pas)' : ': une pièce « Éléments pour le DIUO » par lot'}</label>
      ${o ? '' : `<fieldset class="champ sans-cadre"><legend>Lots (pièces types créées pour chacun)</legend>${choixLots(true)}</fieldset>`}
      <p class="erreur" role="alert"></p>`;
    const pied = o ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(o ? 'Modifier l\'opération' : 'Nouvelle opération', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${o.nom} »${nb ? `, ses ${pluriel(nb, 'pièce')}` : ''}, ses lots et ses relances ? Pense à exporter une copie avant.`)) return '';
        const avant = structuredClone({ operations: E.operations, lots: E.lots, pieces: E.pieces, relances: E.relances });
        E.operations = E.operations.filter((x) => x.id !== o.id);
        E.lots = E.lots.filter((l) => l.operationId !== o.id);
        E.pieces = E.pieces.filter((p) => p.operationId !== o.id);
        E.relances = E.relances.filter((r) => r.operationId !== o.id);
        if (filtre.operationId === o.id) filtre.operationId = '';
        annulation = () => { Object.assign(E, avant); };
        sauver();
        if (!E.operations.length) { ecranAccueil(); return; }
        rendre(); toast(`« ${o.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'opération.';
      const champs = { nom, moa: String(f.get('moa') || '').trim(), adresse: String(f.get('adresse') || '').trim(), reception: f.get('reception') || null, dateLimite: f.get('dateLimite') || '', diuo: !!f.get('diuo') };
      let ajoutes = 0;
      if (o) {
        const devientDiuo = champs.diuo && !o.diuo;
        Object.assign(o, champs);
        if (devientDiuo) for (const l of lotsDe(o.id)) {
          const k = R.plat(B.pieceDiuo.intitule);
          if (!E.pieces.some((p) => p.lotId === l.id && R.plat(p.intitule) === k)) { E.pieces.push({ id: uid(), operationId: o.id, lotId: l.id, numero: R.prochainNumero(E.pieces, o.id), famille: 'diuo', intitule: B.pieceDiuo.intitule, statut: 'attendue', echeance: '', recueLe: null, valideeLe: null, reference: '', format: '', motif: '', historique: [] }); ajoutes++; }
        }
      } else {
        const n = { id: uid(), ...champs };
        E.operations.push(n);
        f.getAll('lot').forEach((code) => { const b = B.lots.find((x) => x.code === code); const l = { id: uid(), operationId: n.id, code, nom: b.nom, entrepriseId: null }; E.lots.push(l); ajoutes += nouvellesPieces(l).length; });
      }
      sauver(); rendre(); toast(o ? `Opération enregistrée${ajoutes ? ` : ${pluriel(ajoutes, 'pièce DIUO ajoutée', 'pièces DIUO ajoutées')}` : ''}.` : `« ${nom} » créée : ${pluriel(ajoutes, 'pièce attendue', 'pièces attendues')}.`);
    });
    const d = modale();
    if (!o) $('#m-rec', d).addEventListener('change', (e) => { if (R.estDate(e.target.value)) $('#m-lim', d).value = ajout(e.target.value, E.reglages.delaiRemise); });
  }

  function modaleLot(id, opId) {
    const l = id ? lot(id) : null;
    const op = operation(l?.operationId || opId);
    const ps = l ? E.pieces.filter((p) => p.lotId === l.id) : [];
    const manquantes = l ? R.aCreer(l, { modeles: E.modeles, base: B, existantes: E.pieces, diuo: !!op.diuo }).length : 0;
    const corps = `
      <p class="aide">${esc(op.nom)}${l ? ` · ${pluriel(ps.length, 'pièce')} sur ce lot, ${ps.filter((p) => p.statut === 'validee').length} validée${ps.filter((p) => p.statut === 'validee').length > 1 ? 's' : ''}` : ''}</p>
      <div class="grille-lot">
        <label class="champ">Code<input name="code" maxlength="6" value="${esc(l?.code || '')}" placeholder="PLB"></label>
        <label class="champ">Intitulé<input name="nom" required maxlength="80" list="dl-lots" value="${esc(l?.nom || '')}"></label>
      </div>
      <datalist id="dl-lots">${B.lots.map((b) => `<option value="${esc(b.nom)}">`).join('')}</datalist>
      <label class="champ">Entreprise titulaire<select name="entrepriseId" id="m-ent">${optionsEnts(l?.entrepriseId || '')}</select></label>
      <label class="champ" id="m-nouvelle" hidden>Nom de la nouvelle entreprise<input name="nouvelle" maxlength="80"></label>
      ${l ? (manquantes ? `<label class="case"><input type="checkbox" name="completer"> Ajouter les ${pluriel(manquantes, 'pièce type absente', 'pièces types absentes')} de ce lot</label>` : '<p class="aide">Toutes les pièces types du lot sont déjà présentes.</p>')
        : '<label class="case"><input type="checkbox" name="completer" checked> Créer les pièces types du lot (selon son code)</label>'}
      ${l ? '<p class="aide">Changer de titulaire réattribue les pièces du lot et leur complétude à la nouvelle entreprise.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = l ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(l ? 'Modifier le lot' : 'Nouveau lot', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer le lot ${nomLot(l)}${ps.length ? ` et ses ${pluriel(ps.length, 'pièce')}` : ''} ?`)) return '';
        const avant = structuredClone({ lots: E.lots, pieces: E.pieces });
        E.lots = E.lots.filter((x) => x.id !== l.id);
        E.pieces = E.pieces.filter((p) => p.lotId !== l.id);
        annulation = () => { Object.assign(E, avant); };
        sauver(); rendre(); toast('Lot supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique l\'intitulé du lot.';
      let code = String(f.get('code') || '').trim().toUpperCase();
      if (!code) code = B.lots.find((b) => b.nom === nom)?.code || '';
      let entrepriseId = f.get('entrepriseId') || null;
      if (entrepriseId === '__nouvelle') {
        const n = String(f.get('nouvelle') || '').trim();
        if (!n) return 'Indique le nom de la nouvelle entreprise.';
        const ex = E.entreprises.find((e) => R.plat(e.nom) === R.plat(n));
        if (ex) entrepriseId = ex.id;
        else { const e = { id: uid(), nom: n, contact: '', email: '' }; E.entreprises.push(e); entrepriseId = e.id; }
      }
      let cible = l;
      if (l) Object.assign(l, { code, nom, entrepriseId });
      else { cible = { id: uid(), operationId: op.id, code, nom, entrepriseId }; E.lots.push(cible); }
      const ajoutes = f.get('completer') ? nouvellesPieces(cible).length : 0;
      sauver(); rendre(); toast(`${l ? 'Lot enregistré' : 'Lot ajouté'}${ajoutes ? ` : ${pluriel(ajoutes, 'pièce attendue', 'pièces attendues')}` : ''}.`);
    });
    const d = modale();
    $('#m-ent', d).addEventListener('change', (e) => { $('#m-nouvelle', d).hidden = e.target.value !== '__nouvelle'; });
    $('[name=nom]', d).addEventListener('change', (e) => { const b = B.lots.find((x) => x.nom === e.target.value); const c = $('[name=code]', d); if (b && !c.value) c.value = b.code; });
  }

  function modaleEntreprise(id) {
    const e = id ? entreprise(id) : null;
    const lots = e ? E.lots.filter((l) => l.entrepriseId === e.id) : [];
    const corps = `
      <label class="champ">Raison sociale<input name="nom" required maxlength="80" value="${esc(e?.nom || '')}"></label>
      <label class="champ">Contact<small>La fonction suffit (ex. : conducteur de travaux).</small><input name="contact" maxlength="80" value="${esc(e?.contact || '')}"></label>
      <label class="champ">E-mail professionnel<small>Préfère une adresse générique de l'entreprise.</small><input type="email" name="email" maxlength="120" value="${esc(e?.email || '')}"></label>
      ${e ? `<p class="aide">${lots.length ? `Titulaire de ${pluriel(lots.length, 'lot')}.` : 'Aucun lot attribué.'} Les lots s'attribuent en touchant un lot dans l'onglet Opérations.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = e ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(e ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (lots.length) return `Titulaire de ${pluriel(lots.length, 'lot')} : attribue-les d'abord à une autre entreprise.`;
        E.entreprises = E.entreprises.filter((x) => x.id !== e.id);
        sauver(); rendre(); toast('Entreprise supprimée.');
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique la raison sociale.';
      const champs = { nom, contact: String(f.get('contact') || '').trim(), email: String(f.get('email') || '').trim() };
      if (e) Object.assign(e, champs); else E.entreprises.push({ id: uid(), ...champs });
      sauver(); rendre(); toast(e ? 'Entreprise enregistrée.' : `« ${nom} » ajoutée.`);
    });
  }

  // Pièces types d'un lot : lignes famille + intitulé, ajout, suppression, retour à la base.
  function modaleModele(code) {
    const b = B.lots.find((l) => l.code === code);
    const ligne = ([fam, txt] = ['autre', '']) => `<div class="ligne-modele"><select name="famille" aria-label="Famille">${optionsFamilles(fam)}</select><input name="intitule" maxlength="160" value="${esc(txt)}" aria-label="Intitulé de la pièce"><button type="button" class="btn-icone" data-action="ligne-suppr" aria-label="Retirer cette pièce">×</button></div>`;
    const lignes = R.piecesTypes(code, E.modeles, B);
    ouvrirModale(`Pièces types · ${esc(code)}`, `
      <p class="aide">${esc(b.nom)}. Proposées à chaque nouveau lot ${esc(code)} et par « Ajouter les pièces types absentes ». Les pièces déjà créées ne changent pas.</p>
      <div id="m-lignes" class="lignes-modele">${lignes.map(ligne).join('')}</div>
      <div class="rang"><button class="btn petit" type="button" id="m-ajout">${ICONES.plus}Pièce</button>${Array.isArray(E.modeles[code]) ? '<button class="btn petit" type="submit" value="base">Revenir à la base</button>' : ''}</div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f, action) => {
      if (action === 'base') { delete E.modeles[code]; sauver(); rendre(); toast(`Pièces types ${code} : base intégrée rétablie.`); return; }
      const fams = f.getAll('famille'), txts = f.getAll('intitule');
      const liste = txts.map((t, k) => [fams[k], String(t).trim()]).filter(([, t]) => t);
      if (new Set(liste.map(([, t]) => R.plat(t))).size !== liste.length) return 'Deux pièces portent le même intitulé.';
      E.modeles[code] = liste;
      sauver(); rendre(); toast(`Pièces types ${code} enregistrées (${pluriel(liste.length, 'pièce')}).`);
    });
    const d = modale();
    $('#m-ajout', d).addEventListener('click', () => { $('#m-lignes', d).insertAdjacentHTML('beforeend', ligne()); $('#m-lignes', d).lastElementChild.querySelector('input').focus(); });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Ta structure<small>En-tête du bordereau, des états et des courriers.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <div class="grille-2">
        <label class="champ">Date limite du DOE (j après réception)<input type="number" name="delaiRemise" min="0" max="365" value="${r.delaiRemise}"></label>
        <label class="champ">Délai de reprise (j)<input type="number" name="delaiReprise" min="1" max="365" value="${r.delaiReprise}"></label>
        <label class="champ">Relancer tous les (j)<input type="number" name="intervalle" min="1" max="90" value="${r.intervalle}"></label>
        <label class="champ">Alerte avant la date limite (j)<input type="number" name="alerte" min="0" max="60" value="${r.alerte}"></label>
      </div>
      <p class="aide">Délais proposés à la saisie, modifiables pièce par pièce. Les pièces et délais de ton marché font foi.</p>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton registre est enregistré en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko (${pluriel(E.pieces.length, 'pièce')}).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-tout">Toutes les pièces (CSV)</button><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi des DOE, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const v = { delaiRemise: n('delaiRemise', 0, 365), delaiReprise: n('delaiReprise', 1, 365), intervalle: n('intervalle', 1, 90), alerte: n('alerte', 0, 60) };
      if (Object.values(v).some((x) => x === null)) return 'Délais : nombres entiers (date limite 0 à 365 j, reprise 1 à 365 j, relance 1 à 90 j, alerte 0 à 60 j).';
      E.structure = String(f.get('structure') || '').trim();
      Object.assign(r, v);
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.operations) || !Array.isArray(d.pieces)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.operations.length, 'opération')}, ${pluriel(d.pieces.length, 'pièce')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe; E.tutorielVu = vu || !!E.tutorielVu;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function telecharger(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exporterCsv(tout) {
    const liste = tout ? E.pieces : listeFiltree();
    telecharger(R.csv(E, auj(), liste, B.familles), `registre-doe-${auj()}.csv`, 'text/csv;charset=utf-8');
    toast(`${pluriel(liste.length, 'pièce')} exportée${liste.length > 1 ? 's' : ''} (CSV, point-virgule).`);
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const r = E.reglages;
    const blocs = [
      ['rose', 'Une liste de pièces par lot', `Chaque lot coché reçoit sa liste de pièces types (plans, notices, PV d'essais, fiches techniques, garanties), numérotées P-001, P-002… Ajuste-la selon ton marché et attribue une entreprise à chaque lot dans <b>Opérations</b>. Une pièce sans date propre suit la date limite de remise du DOE de l'opération.`],
      ['beurre', 'Reçue, puis vérifiée', `Quand une pièce arrive, touche <b>Reçue</b>&nbsp;: elle attend ta vérification. Ensuite, <b>Valider</b> si elle est conforme, ou <b>À reprendre</b> avec le motif&nbsp;: elle a alors une nouvelle date limite, ${pluriel(r.delaiReprise, 'jour')} plus tard par défaut. Chaque changement reste dans l'historique de la pièce.`],
      ['ciel', 'Les retards sautent aux yeux', `Une pièce attendue ou à reprendre passe <b>En retard</b> dès que sa date limite est dépassée. La <b>Complétude</b> compte les pièces validées sur toutes les pièces attendues, par entreprise, par lot et par famille.`],
      ['sable', 'Relance, puis transmets', `Une entreprise est à relancer quand elle a des pièces en retard et qu'elle n'a pas été relancée depuis ${pluriel(r.intervalle, 'jour')}. <b>Préparer la relance</b> rédige un courrier à relire et à envoyer toi-même&nbsp;: l'outil n'envoie rien. <b>Documents</b> imprime le bordereau de transmission des pièces validées.`],
    ];
    const corps = `
      <p>Le registre suit chaque pièce du DOE, de la demande à la validation, et repère celles qui manquent. Ton rôle&nbsp;: noter les pièces reçues, les vérifier, puis relancer les entreprises en retard.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Pièces</b> liste d'abord les retards, puis les pièces reçues à vérifier. Les délais proposés (date limite, reprise, relance) se règlent dans les réglages&nbsp;; ton marché fait foi. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    // Opération créée sans lot ni pièce : le bouton principal propose la première saisie utile.
    const op = E.operations[0];
    const premiere = auto && op && !E.pieces.length ? (E.lots.length ? 'piece' : 'lot') : '';
    const pied = premiere
      ? `<button class="btn primaire" value="${premiere}">${premiere === 'lot' ? 'Ajouter mon premier lot' : 'Ajouter ma première pièce'}</button><button class="btn" value="ok">Fermer</button>`
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => {
      if (choix === 'lot') setTimeout(() => modaleLot(null, op.id), 0);
      if (choix === 'piece') setTimeout(() => modalePiece(null), 0);
    });
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
  function appliquer(p, n, message) {
    const avant = structuredClone(p);
    Object.assign(p, n);
    annulation = () => { const x = piece(p.id); if (x) { Object.keys(x).forEach((k) => delete x[k]); Object.assign(x, avant); } };
    sauver();
    const carte = document.querySelector(`[data-carte="${p.id}"]`);
    const suite = () => { rendre(); toast(message, { libelle: 'Annuler', faire: annuler }); };
    if (carte && !matchMedia('(prefers-reduced-motion: reduce)').matches) { carte.classList.add('sortie'); setTimeout(suite, 200); } else suite();
  }

  function rapide(id, vers) {
    const p = piece(id);
    if (!p) return;
    try {
      const n = R.transition(p, vers, { date: auj() });
      appliquer(p, n, vers === 'recue' ? `Pièce ${p.numero} reçue : à vérifier.` : `Pièce ${p.numero} validée.`);
    } catch (x) { toast(x.message); }
  }

  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    sauver(); rendre();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `registre-doe-${auj()}.json`, 'application/json'); break;
      case 'csv': exporterCsv(false); break;
      case 'csv-tout': exporterCsv(true); break;
      case 'fermer': modale().close(); break;
      case 'piece-nouvelle': modalePiece(null, el.dataset.op); break;
      case 'piece-modifier': modalePiece(id); break;
      case 'recue': rapide(id, 'recue'); break;
      case 'valider': rapide(id, 'validee'); break;
      case 'reprendre': modaleReprise(id); break;
      case 'filtre-statut': filtre.statut = filtre.statut === el.dataset.statut ? 'a-traiter' : el.dataset.statut; rendre(); break;
      case 'filtres-effacer': Object.assign(filtre, { lotId: '', entrepriseId: '', famille: '', statut: 'a-traiter', texte: '' }); rendre(); break;
      case 'voir-op': filtre.operationId = el.dataset.op; filtre.lotId = ''; changerVue('pieces'); break;
      case 'docs-op': docChoix.operationId = el.dataset.op; docChoix.type = 'bordereau'; docChoix.entrepriseId = ''; changerVue('documents'); break;
      case 'relancer': modaleRelance(el.dataset.op, el.dataset.ent); break;
      case 'relance-suppr': {
        const r = E.relances.find((x) => x.id === id);
        if (!r) break;
        const avant = structuredClone(E.relances);
        E.relances = E.relances.filter((x) => x.id !== id);
        annulation = () => { E.relances = avant; };
        sauver(); rendre(); toast(`Relance du ${fmtCourt(r.date)} supprimée.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'copier': copier($('#m-texte')?.value || ''); break;
      case 'imprimer-lettre': imprimerLettre($('#m-texte')?.value || ''); break;
      case 'operation-nouvelle': modaleOperation(); break;
      case 'operation-modifier': modaleOperation(id); break;
      case 'lot-nouveau': modaleLot(null, el.dataset.op); break;
      case 'lot-modifier': modaleLot(id); break;
      case 'entreprise-nouvelle': modaleEntreprise(); break;
      case 'entreprise-modifier': modaleEntreprise(id); break;
      case 'modele': modaleModele(el.dataset.code); break;
      case 'ligne-suppr': el.closest('.ligne-modele')?.remove(); break;
      case 'imprimer': imprimer(); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const k = e.target.dataset?.doc;
    if (k) { docChoix[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (k === 'type' || k === 'operationId') docChoix.entrepriseId = ''; rendre(); return; }
    if (e.target.id === 'r-op') { filtre.operationId = e.target.value; filtre.lotId = ''; rendre(); }
  });
  document.addEventListener('input', (e) => {
    const k = e.target.dataset?.docTexte;
    if (!k) return;
    docChoix[k] = e.target.value;
    const doc = $('#pv-doc');
    const op = operation(docChoix.operationId);
    if (doc && op && docChoix.type === 'bordereau') doc.innerHTML = documentBordereau(op);
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && vue !== 'pieces') rendre();
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
  window.__doe = { etat: () => E };
  init();
})();
