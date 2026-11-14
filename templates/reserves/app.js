// Levée de réserves QME : réserves par opération, lot et entreprise, retards, PV imprimables.
// Données synchronisées par clé de licence (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'RSV';
  const CLE_CODE = 'qme-rsv-code';
  const CLE_CACHE = 'qme-rsv-cache';
  const CLE_DEMO = 'qme-rsv-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rsv-ecran-accueil';
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
  const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtCourt = (s) => (s ? R.dateFr(s) : '–');
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return fmt(s);
  };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'reserves';
  let annulation = null;
  const filtre = { operationId: '', lotId: '', entrepriseId: '', statut: 'en-cours', texte: '' };
  const pvChoix = { operationId: '', entrepriseId: '', type: 'liste' };

  const etatVide = () => ({ version: 1, structure: '', reglages: { delai: B.delaiDefaut, alerte: B.alerteDefaut, delaiRefus: B.delaiRefus }, operations: [], lots: [], entreprises: [], reserves: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) }, operations: tab(d.operations), lots: tab(d.lots), entreprises: tab(d.entreprises),
      reserves: tab(d.reserves).map((r) => ({ historique: [], photo: '', motifRefus: '', leveeLe: null, controleLe: null, ...r })) };
  };
  const operation = (id) => E.operations.find((o) => o.id === id);
  const lot = (id) => E.lots.find((l) => l.id === id);
  const entreprise = (id) => E.entreprises.find((e) => e.id === id);
  const reserve = (id) => E.reserves.find((r) => r.id === id);
  const lotsDe = (opId) => E.lots.filter((l) => l.operationId === opId).sort((a, b) => ordreLot(a) - ordreLot(b) || a.nom.localeCompare(b.nom));
  const ordreLot = (l) => { const i = B.lots.findIndex((x) => x.code === l.code); return i < 0 ? 99 : i; };
  const nomLot = (l) => (l ? `${l.code ? `${l.code} · ` : ''}${l.nom}` : 'Sans lot');
  const localisation = (r) => [r.batiment && `Bât. ${r.batiment}`, r.niveau, r.local].filter(Boolean).join(' · ') || 'Localisation non précisée';
  const nomsRecherche = (r) => `${nomLot(lot(r.lotId))} ${entreprise(r.entrepriseId)?.nom || ''} ${operation(r.operationId)?.nom || ''}`;
  const alerte = () => E.reglages.alerte;

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
        toast('Un autre appareil a modifié tes réserves entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
    E.structure = 'Atelier d\'architecture (exemple)';
    const t = auj();
    const ents = [
      ['Maçonnerie Vasseur', 'Conducteur de travaux'], ['Plâtrerie Lemaire', 'Chef de chantier'], ['Menuiseries Arnaud', 'Chargé d\'affaires'],
      ['Carrelages Benoît', 'Gérant'], ['Peintures Roussel', 'Chef d\'équipe'], ['Plomberie Garnier', 'Conducteur de travaux'],
      ['Élec Morvan', 'Chargé d\'affaires'], ['Serrurerie Fabre', 'Gérant'],
    ].map(([nom, contact]) => { const e = { id: uid(), nom, contact, email: `chantier@${R.plat(nom.split(' ').at(-1))}.exemple` }; E.entreprises.push(e); return e; });
    const [vas, lem, arn, ben, rou, gar, mor, fab] = ents;
    const op1 = { id: uid(), nom: 'Résidence Les Tilleuls · 24 logements', moa: 'SCI Les Tilleuls (fictive)', adresse: 'Rue des Tilleuls (adresse fictive)', reception: ajout(t, -26), batiments: 'A, B' };
    const op2 = { id: uid(), nom: 'Plateau de bureaux · 3e étage', moa: 'Foncière Horizon (fictive)', adresse: 'Quartier de la gare (adresse fictive)', reception: ajout(t, -9), batiments: 'Principal' };
    E.operations.push(op1, op2);
    const lotsOp = (op, liste) => Object.fromEntries(liste.map(([code, ent]) => {
      const b = B.lots.find((x) => x.code === code);
      const l = { id: uid(), operationId: op.id, code, nom: b.nom, entrepriseId: ent?.id || null };
      E.lots.push(l);
      return [code, l];
    }));
    const L1 = lotsOp(op1, [['GO', vas], ['ME', arn], ['SER', fab], ['CLO', lem], ['MI', arn], ['CAR', ben], ['PEI', rou], ['PLB', gar], ['CFO', mor], ['VRD', null]]);
    const L2 = lotsOp(op2, [['CLO', lem], ['MI', arn], ['SS', null], ['PEI', rou], ['CVC', gar], ['CFO', mor], ['CFA', mor]]);
    // [opération, lots, code lot, bâtiment, niveau, local, nature, description, constat (j), délai (j), scénario, photo]
    const d1 = -26, d2 = -9;
    const liste = [
      [op1, L1, 'PEI', 'A', 'R+1', 'Logement A12 · séjour', 0, 'Reprise d\'enduit visible sous la fenêtre, à poncer et repeindre', d1, 15, 'retard', 'IMG_0412'],
      [op1, L1, 'CAR', 'A', 'R+1', 'Logement A12 · salle d\'eau', 1, 'Carreau de sol fêlé devant la douche, à remplacer', d1, 15, 'refusee-retard', 'IMG_0415'],
      [op1, L1, 'MI', 'A', 'R+2', 'Logement A21 · entrée', 3, 'Porte palière qui frotte en partie haute, à régler', d1, 30, 'levee', ''],
      [op1, L1, 'PLB', 'A', 'R+2', 'Logement A22 · cuisine', 5, 'Fuite au raccord du siphon d\'évier', d1, 15, 'retard', 'IMG_0431'],
      [op1, L1, 'CFO', 'A', 'RDC', 'Hall', 7, 'Bloc d\'éclairage de secours éteint au-dessus de la porte du local vélos', d1, 15, 'controlee', ''],
      [op1, L1, 'CLO', 'A', 'R+3', 'Logement A31 · chambre 2', 0, 'Fissure de 30 cm à la jonction plafond et cloison, mur nord', d1, 30, 'ouverte', 'IMG_0440'],
      [op1, L1, 'ME', 'A', 'R+3', 'Logement A32 · séjour', 3, 'Fenêtre oscillo-battante : poignée dure, réglage des compas', d1, 30, 'cycle', ''],
      [op1, L1, 'PEI', 'B', 'RDC', 'Circulation commune', 1, 'Plinthe peinte rayée sur 2 m, à reprendre', d1, 30, 'controlee', ''],
      [op1, L1, 'GO', 'B', 'Sous-sol', 'Parking · place 14', 5, 'Trace d\'humidité en sous-face de la dalle, à rechercher et traiter', d1, 30, 'ouverte', 'IMG_0452'],
      [op1, L1, 'CAR', 'B', 'R+1', 'Logement B11 · cuisine', 0, 'Joints de faïence irréguliers derrière l\'évier', d1, 30, 'levee', ''],
      [op1, L1, 'MI', 'B', 'R+1', 'Logement B12 · placard', 2, 'Butée de porte de placard manquante', d1, 30, 'controlee', ''],
      [op1, L1, 'PLB', 'B', 'R+2', 'Logement B21 · WC', 3, 'Mécanisme de chasse d\'eau qui coule en continu', d1, 30, 'controlee', ''],
      [op1, L1, 'CFO', 'B', 'R+2', 'Logement B22 · chambre 1', 2, 'Cache de prise de courant manquant à côté de la porte', d1, 30, 'ouverte', ''],
      [op1, L1, 'VRD', '', 'Extérieurs', 'Allée piétonne', 1, 'Bordure épaufrée à l\'entrée du bâtiment B', d1, 30, 'ouverte', 'IMG_0460'],
      [op1, L1, 'CLO', 'B', 'R+3', 'Logement B31 · séjour', 6, 'Trappe de visite du faux plafond non posée', d1, 30, 'cycle', ''],
      [op1, L1, 'PEI', 'B', 'R+3', 'Logement B32 · chambre 1', 6, 'Traces de peinture sur le vitrage, à nettoyer', d1, 15, 'levee-ancienne', ''],
      [op1, L1, 'ME', 'A', 'RDC', 'Local vélos', 1, 'Porte d\'accès rayée sur toute la hauteur', d1, 30, 'controlee', ''],
      [op1, L1, 'GO', 'A', 'Toiture', 'Acrotère nord', 5, 'Fissure d\'enduit sur l\'acrotère, à reprendre avant l\'hiver', d1, 15, 'refusee', 'IMG_0471'],
      [op2, L2, 'CLO', 'Principal', 'R+3', 'Open space nord', 0, 'Bande à joint visible au plafond le long de la façade', d2, 21, 'ouverte', 'IMG_1102'],
      [op2, L2, 'MI', 'Principal', 'R+3', 'Salle de réunion 3.02', 3, 'Ferme-porte mal réglé : la porte claque', d2, 21, 'levee', ''],
      [op2, L2, 'SS', 'Principal', 'R+3', 'Accueil', 1, 'Lé de sol souple décollé au seuil de l\'ascenseur', d2, 14, 'ouverte', 'IMG_1110'],
      [op2, L2, 'CVC', 'Principal', 'R+3', 'Bureau 3.07', 3, 'Ventilo-convecteur bruyant en petite vitesse', d2, 21, 'ouverte', ''],
      [op2, L2, 'CFA', 'Principal', 'R+3', 'Local technique', 9, 'Repérage des prises réseau absent dans la baie de brassage', d2, 21, 'controlee', ''],
      [op2, L2, 'PEI', 'Principal', 'R+3', 'Circulation', 1, 'Impacts sur les murs de la circulation, à reboucher et repeindre', d2, 21, 'levee', ''],
      [op2, L2, 'CFO', 'Principal', 'R+3', 'Kitchenette', 8, 'Prise du plan de travail sans circuit dédié, contraire au descriptif', d2, 7, 'proche', ''],
      [op2, L2, 'CVC', 'Principal', 'R+3', 'Toutes zones', 9, 'Notices et procès-verbaux d\'essais de la climatisation non remis', d2, 21, 'ouverte', ''],
    ];
    for (const [op, L, code, bat, niv, loc, nat, desc, dc, delai, sc, photo] of liste) {
      const constat = ajout(t, dc);
      let r = { id: uid(), operationId: op.id, numero: R.prochainNumero(E.reserves, op.id), lotId: L[code].id, entrepriseId: L[code].entrepriseId, batiment: bat, niveau: niv, local: loc,
        nature: B.natures[nat].nom, description: desc, constat, echeance: R.echeanceDefaut(constat, delai), statut: 'ouverte', leveeLe: null, controleLe: null, motifRefus: '', photo, historique: [] };
      const pas = (vers, j, o = {}) => { r = R.transition(r, vers, { date: ajout(t, j), ...o }); };
      if (sc === 'levee') pas('levee', -2);
      if (sc === 'levee-ancienne') pas('levee', -12);
      if (sc === 'controlee') { pas('levee', Math.min(-1, dc + 6)); pas('controlee', Math.min(0, dc + 9)); }
      if (sc === 'refusee') { pas('levee', -8); pas('refusee', -5, { note: 'Reprise localisée seulement : toute la longueur fissurée est à traiter.', delai: 15 }); }
      if (sc === 'refusee-retard') { pas('levee', -14); pas('refusee', -12, { note: 'Le carreau remplacé n\'est pas de la même série (teinte différente).', delai: 8 }); }
      if (sc === 'cycle') { pas('levee', -15); pas('refusee', -13, { note: 'Réglage insuffisant.', delai: 7 }); pas('levee', -7); pas('controlee', -3); }
      if (sc === 'proche') r.echeance = ajout(t, 2);
      E.reserves.push(r);
    }
    // Une réserve signalée aujourd'hui pendant la visite.
    const l = L2.PEI;
    E.reserves.push({ id: uid(), operationId: op2.id, numero: R.prochainNumero(E.reserves, op2.id), lotId: l.id, entrepriseId: l.entrepriseId, batiment: 'Principal', niveau: 'R+3', local: 'Bureau 3.04',
      nature: B.natures[1].nom, description: 'Angle de cloison épaufré derrière la porte', constat: t, echeance: R.echeanceDefaut(t, E.reglages.delai), statut: 'ouverte', leveeLe: null, controleLe: null, motifRefus: '', photo: 'IMG_1131', historique: [] });
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Levée de réserves · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="260" height="260" fill="#F5B400"/>
          <path d="M10 280 L270 20 L270 280 Z" fill="#1D4E89"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <path d="M370 150 l35 35 l70 -80" fill="none" stroke="#F0EDE6" stroke-width="26" stroke-linecap="square"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Levée de réserves · OPR et réception</p>
          <h1>Chaque réserve levée, contrôlée, signée.</h1>
          <p>Réserves par opération, lot et entreprise, retards calculés, tableau de bord et procès-verbal de levée prêt à imprimer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta liste de réserves</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes réserves sont enregistrées en ligne et te suivent sur tous tes appareils, du bureau au chantier.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes réserves</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes réserves'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    document.title = 'Bienvenue · Levée de réserves';
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ta première opération.</h1>
        <p class="intro">Une opération = un chantier réceptionné (ou en cours de réception). Tu ajouteras les entreprises en saisissant tes réserves ; tout reste modifiable ensuite.</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Nom de l'opération<input name="nom" required maxlength="80" placeholder="Ex. : Résidence du Parc · 18 logements"></label>
            <label class="champ">Ta structure <small>Facultatif : en-tête des procès-verbaux.</small><input name="structure" maxlength="80" placeholder="Ex. : Cabinet de maîtrise d'œuvre"></label>
            <label class="champ">Maître d'ouvrage<input name="moa" maxlength="80"></label>
            <label class="champ">Date des OPR ou de la réception<input type="date" name="reception" value="${auj()}"></label>
            <label class="champ">Bâtiments <small>Séparés par des virgules, facultatif.</small><input name="batiments" maxlength="120" placeholder="Ex. : A, B"></label>
          </div>
          <h2 class="titre-section">Lots de l'opération <span>Les lots courants sont cochés ; tu en ajouteras d'autres dans l'onglet Opérations.</span></h2>
          <div class="choix-lots">${B.lots.map((l) => `<label class="case"><input type="checkbox" name="lot" value="${l.code}" ${l.courant ? 'checked' : ''}> <b>${l.code}</b> ${esc(l.nom)}</label>`).join('')}</div>
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer l'opération</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nom = String(f.get('nom') || '').trim();
      if (!nom) { e.target.querySelector('.erreur').textContent = 'Indique le nom de l\'opération.'; e.target.nom.focus(); return; }
      E = etatVide();
      E.structure = String(f.get('structure') || '').trim();
      const op = { id: uid(), nom, moa: String(f.get('moa') || '').trim(), adresse: '', reception: f.get('reception') || null, batiments: String(f.get('batiments') || '').trim() };
      E.operations.push(op);
      f.getAll('lot').forEach((code) => { const b = B.lots.find((x) => x.code === code); E.lots.push({ id: uid(), operationId: op.id, code, nom: b.nom, entrepriseId: null }); });
      sauver();
      demarrer();
      setTimeout(() => modaleReserve(), 250);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    reserves: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    pv: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" fill="none" stroke="currentColor" stroke-width="2"/><rect x="7" y="6" width="10" height="2" fill="currentColor"/><rect x="7" y="10" width="10" height="2" fill="currentColor"/><rect x="7" y="16" width="5" height="3" fill="currentColor"/></svg>',
    operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['reserves', 'Réserves'], ['bord', 'Tableau de bord'], ['pv', 'PV'], ['operations', 'Opérations'], ['guide', 'Guide']];
  const COURTS = { bord: 'Bilan' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    if (filtre.operationId && !operation(filtre.operationId)) filtre.operationId = '';
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Levée<br>de réserves</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
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
    document.title = `${titres[vue]} · Levée de réserves`;
    $('#vue').innerHTML = { reserves: vueReserves, bord: vueBord, pv: vuePV, operations: vueOperations, guide: vueGuide }[vue]();
    if (vue === 'reserves') brancherFiltres();
    if (vue === 'bord') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const choixOperation = (id, valeur, tous = true) => `<label class="champ">Opération<select id="${id}">${tous ? `<option value="">Toutes les opérations</option>` : ''}${E.operations.map((o) => `<option value="${o.id}" ${o.id === valeur ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>`;

  // ---------- Vue Réserves ----------
  const ETATS = {
    retard: ['rouge', 'En retard'], refusee: ['rouge', 'Refusée'], ouverte: ['jaune', 'Ouverte'], levee: ['bleu', 'À contrôler'], controlee: ['gris', 'Contrôlée'],
  };
  const COULEUR_ETAT = { retard: 'var(--rouge)', refusee: 'var(--rouge)', ouverte: 'var(--jaune)', levee: 'var(--bleu)', controlee: 'var(--gris)' };

  function listeFiltree() {
    return R.trier(R.filtrer(E.reserves, filtre, auj(), nomsRecherche), auj(), alerte());
  }

  function vueReserves() {
    const t = auj();
    const ops = filtre.operationId ? E.reserves.filter((r) => r.operationId === filtre.operationId) : E.reserves;
    const i = R.indicateurs(ops, t);
    const lotsVisibles = filtre.operationId ? lotsDe(filtre.operationId) : E.lots;
    const codesLots = [...new Map(lotsVisibles.map((l) => [filtre.operationId ? l.id : `${l.code}|${l.nom}`, l])).values()];
    const titre = !E.reserves.length ? 'Aucune réserve pour l\'instant.'
      : i.retard ? `<mark>${pluriel(i.retard, 'réserve')} en retard</mark> sur ${i.restantes + i.aControler} en cours.`
        : i.restantes + i.aControler ? `${pluriel(i.restantes + i.aControler, 'réserve')} en cours, <mark>aucun retard</mark>.` : '<mark>Toutes les réserves sont levées</mark> et contrôlées.';
    const tuile = (statut, lib, v, d, c, forme = '') => `<button class="tuile ${forme}" style="--c:${c}" data-action="filtre-statut" data-statut="${statut}" aria-pressed="${filtre.statut === statut}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></button>`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(filtre.operationId ? operation(filtre.operationId)?.nom : `${pluriel(E.operations.length, 'opération')}`)} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titre}</h1></div>
        <div class="actions"><button class="btn" data-action="csv">Export CSV</button><button class="btn primaire" data-action="reserve-nouvelle">${ICONES.plus}Nouvelle réserve</button></div></div>
      <div class="tuiles">
        ${tuile('retard', 'En retard', i.retard, i.retard ? `Plus ancien : ${pluriel(i.plusAncienRetard, 'jour')}` : 'Aucune échéance dépassée', 'var(--rouge)', 'rond')}
        ${tuile('a-lever', 'À lever', i.restantes, `${i.refusees ? `dont ${pluriel(i.refusees, 'refusée')}` : 'Ouvertes ou refusées'}`, 'var(--jaune)')}
        ${tuile('levee', 'À contrôler', i.aControler, 'Levées par l\'entreprise', 'var(--bleu)')}
        ${tuile('controlee', 'Contrôlées', i.controlees, i.taux === null ? 'Aucune réserve' : `${i.taux} % des réserves`, 'var(--gris)', 'rond')}
      </div>
      <form class="filtres" id="filtres" role="search" onsubmit="return false">
        ${choixOperation('f-op', filtre.operationId)}
        <label class="champ">Lot<select id="f-lot"><option value="">Tous les lots</option>${codesLots.map((l) => { const v = filtre.operationId ? l.id : `${l.code}|${l.nom}`; return `<option value="${esc(v)}" ${filtre.lotId === v ? 'selected' : ''}>${esc(nomLot(l))}</option>`; }).join('')}</select></label>
        <label class="champ">Entreprise<select id="f-ent"><option value="">Toutes les entreprises</option>${[...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => `<option value="${e.id}" ${filtre.entrepriseId === e.id ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}</select></label>
        <label class="champ">Statut<select id="f-statut">${[['en-cours', 'En cours'], ['a-lever', 'À lever'], ['retard', 'En retard'], ['refusee', 'Refusées'], ['levee', 'À contrôler'], ['controlee', 'Contrôlées'], ['tous', 'Toutes']].map(([v, l]) => `<option value="${v}" ${filtre.statut === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="champ recherche">Rechercher<input id="f-texte" type="search" value="${esc(filtre.texte)}" placeholder="Local, description, n°…" autocomplete="off"></label>
      </form>
      <div id="liste">${listeHtml()}</div>`;
  }

  // Le filtre de lot porte sur l'identifiant (une opération) ou sur « code|nom » (toutes les opérations).
  function filtreEffectif() {
    if (!filtre.lotId || filtre.operationId) return filtre;
    const [code, nom] = filtre.lotId.split('|');
    const ids = new Set(E.lots.filter((l) => l.code === code && l.nom === nom).map((l) => l.id));
    return { ...filtre, lotId: '', lots: ids };
  }

  function listeHtml() {
    const t = auj();
    const f = filtreEffectif();
    let liste = R.filtrer(E.reserves, f, t, nomsRecherche);
    if (f.lots) liste = liste.filter((r) => f.lots.has(r.lotId));
    liste = R.trier(liste, t, alerte());
    if (!E.reserves.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Saisis ta première réserve</h3><p>Pendant la visite, une réserve par défaut : localisation, lot, entreprise, description. L'échéance se calcule toute seule (${E.reglages.delai} jours, réglable).</p><div class="actions"><button class="btn primaire" data-action="reserve-nouvelle">${ICONES.plus}Nouvelle réserve</button></div></div></div>`;
    if (!liste.length) return `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune réserve pour ces filtres</h3><p>${filtre.statut === 'retard' ? 'Aucune échéance dépassée : rien à relancer.' : 'Change de statut ou efface la recherche.'}</p><div class="actions"><button class="btn" data-action="filtres-effacer">Effacer les filtres</button></div></div></div>`;
    const MAX = 150;
    return `<p class="compteur">${pluriel(liste.length, 'réserve')}${liste.length > MAX ? ` · ${MAX} premières affichées, affine les filtres` : ''}</p><ul class="cartes">${liste.slice(0, MAX).map((r) => carteReserve(r, t)).join('')}</ul>`;
  }

  function carteReserve(r, t) {
    const et = R.etat(r, t);
    const [cl, lib] = ETATS[et];
    const l = lot(r.lotId), e = entreprise(r.entrepriseId), o = operation(r.operationId);
    const etiquettes = [];
    if (et === 'retard') etiquettes.push(`<span class="etiquette rouge">En retard · ${R.joursRetard(r, t)} j</span>${r.statut === 'refusee' ? '<span class="etiquette">Refusée</span>' : ''}`);
    else etiquettes.push(`<span class="etiquette ${cl}">${lib}</span>`);
    if (R.proche(r, t, alerte())) etiquettes.push(`<span class="etiquette contour">Échéance ${quand(r.echeance)}</span>`);
    if (r.statut === 'levee') { const n = R.attenteControle(r, t); etiquettes.push(`<span class="etiquette contour">Levée ${n ? `il y a ${pluriel(n, 'jour')}` : 'aujourd\'hui'}</span>`); }
    const dates = r.statut === 'controlee' ? `Constat ${fmtCourt(r.constat)} · contrôlée ${fmtCourt(r.controleLe)}`
      : r.statut === 'levee' ? `Constat ${fmtCourt(r.constat)} · levée ${fmtCourt(r.leveeLe)}` : `Constat ${fmtCourt(r.constat)} · échéance ${fmtCourt(r.echeance)}`;
    const actions = R.aCharge(r)
      ? `<button class="act" data-action="lever" data-id="${r.id}">Levée par l'entreprise<small>${r.statut === 'refusee' ? 'reprise faite' : 'à contrôler ensuite'}</small></button>`
      : r.statut === 'levee'
        ? `<button class="act accepter" data-action="accepter" data-id="${r.id}">Accepter<small>contrôle conforme</small></button><button class="act refuser" data-action="refuser" data-id="${r.id}">Refuser<small>à reprendre</small></button>`
        : '';
    return `
      <li class="carte res ${r.statut === 'controlee' ? 'soldee' : ''}" style="--c:${COULEUR_ETAT[et]}" data-carte="${r.id}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-matiere"><span class="numero">${esc(r.numero)}</span>${!filtre.operationId && E.operations.length > 1 ? `<span>${esc(o?.nom || '')}</span>` : ''}${etiquettes.join('')}</p>
          <h3>${esc(r.description)}</h3>
          <p class="res-loc">${esc(localisation(r))}</p>
          <p class="carte-meta"><span><b>${esc(e?.nom || 'Entreprise à désigner')}</b> · ${esc(nomLot(l))}</span><span>${dates}</span>${r.photo ? `<span>Photo : ${esc(r.photo)}</span>` : ''}</p>
          ${r.statut === 'refusee' && r.motifRefus ? `<p class="motif"><b>Motif du refus :</b> ${esc(r.motifRefus)}</p>` : ''}
        </div>
        ${actions ? `<div class="carte-actions ${r.statut === 'levee' ? 'deux' : ''}">${actions}</div>` : ''}
        <div class="carte-plus"><button data-action="reserve-modifier" data-id="${r.id}">Modifier ou changer le statut</button>${r.historique.length ? `<span>${pluriel(r.historique.length, 'étape')} dans l'historique</span>` : ''}</div>
      </li>`;
  }

  function brancherFiltres() {
    const maj = () => { $('#liste').innerHTML = listeHtml(); };
    $('#f-op').addEventListener('change', (e) => { filtre.operationId = e.target.value; filtre.lotId = ''; rendre(); });
    $('#f-lot').addEventListener('change', (e) => { filtre.lotId = e.target.value; maj(); });
    $('#f-ent').addEventListener('change', (e) => { filtre.entrepriseId = e.target.value; maj(); });
    $('#f-statut').addEventListener('change', (e) => { filtre.statut = e.target.value; rendre(); });
    $('#f-texte').addEventListener('input', (e) => { filtre.texte = e.target.value; maj(); });
  }

  // ---------- Vue Tableau de bord ----------
  const SEGMENTS = [['refusees', 'Refusées', '#D9302A'], ['ouvertes', 'Ouvertes', '#F5B400'], ['aControler', 'À contrôler', '#1D4E89'], ['controlees', 'Contrôlées', '#A8A398']];

  function vueBord() {
    const t = auj();
    const liste = filtre.operationId ? E.reserves.filter((r) => r.operationId === filtre.operationId) : E.reserves;
    const i = R.indicateurs(liste, t);
    const parEnt = R.parCle(liste, 'entrepriseId', t);
    // Par lot : regroupé par code et intitulé quand plusieurs opérations sont mélangées.
    const cleLot = (r) => { const l = lot(r.lotId); return l ? `${l.code}|${l.nom}` : ''; };
    const parLot = R.parCle(liste.map((r) => ({ ...r, cleLot: cleLot(r) })), 'cleLot', t);
    const nomCleLot = (k) => { if (!k) return 'Sans lot'; const [code, nom] = k.split('|'); return `${code} · ${nom}`; };
    const sansReserve = E.entreprises.filter((e) => !liste.some((r) => r.entrepriseId === e.id));
    const retards = liste.filter((r) => R.enRetard(r, t)).sort((a, b) => a.echeance.localeCompare(b.echeance)).slice(0, 8);
    const tuiles = [
      ['Réserves', i.total, '', `${pluriel(E.operations.length > 1 && !filtre.operationId ? E.operations.length : 1, 'opération')}`, 'var(--encre)', 'rond'],
      ['Restant à lever', i.restantes, '', `+ ${i.aControler} à contrôler`, 'var(--jaune)', ''],
      ['En retard', i.retard, '', i.retard ? `plus ancien : ${pluriel(i.plusAncienRetard, 'jour')}` : 'aucune échéance dépassée', 'var(--rouge)', ''],
      ['Taux de levée', i.taux === null ? '–' : i.taux, i.taux === null ? '' : '%', 'Réserves contrôlées et soldées.', 'var(--bleu)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const ligneTab = (nom, x) => `<tr><td>${nom}</td><td class="nb">${x.total}</td><td class="nb">${x.restantes}</td><td class="nb">${x.aControler}</td><td class="nb ${x.retard ? 'alerte' : ''}">${x.retard}${x.retard ? ` <small>(${x.plusAncienRetard} j)</small>` : ''}</td><td class="nb">${x.taux === null ? '–' : `${x.taux} %`}</td></tr>`;
    const tete = (premier) => `<thead><tr><th>${premier}</th><th class="nb">Total</th><th class="nb">À lever</th><th class="nb">À contrôler</th><th class="nb">En retard</th><th class="nb">Levée</th></tr></thead>`;
    return `
      <div class="vue-tete"><div><h1>Tableau de bord</h1><p>Où en est chaque entreprise et chaque lot. Retard = échéance dépassée pour une réserve ouverte ou refusée.</p></div>
        <div class="actions bord-choix">${choixOperation('b-op', filtre.operationId)}</div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Par entreprise <span>Survole ou touche une barre pour le détail.</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>État des réserves par entreprise</h2><div class="legende">${SEGMENTS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${parEnt.length ? `<div class="piles">${parEnt.map((x, k) => pile(x, k)).join('')}</div>` : '<p class="vide-graph">Aucune réserve sur cette sélection.</p>'}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Réserves par entreprise et par statut</caption><thead><tr><th>Entreprise</th>${SEGMENTS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${parEnt.map((x) => `<tr><td>${esc(entreprise(x.cle)?.nom || 'Entreprise à désigner')}</td>${SEGMENTS.map(([k]) => `<td>${x[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      </figure>
      ${sansReserve.length ? `<p class="note">Sans réserve sur cette sélection : ${sansReserve.map((e) => esc(e.nom)).join(', ')}.</p>` : ''}
      <h2 class="titre-section">Retards les plus anciens <span>À relancer en priorité.</span></h2>
      ${retards.length ? `<div class="bloc-liste">${retards.map((r) => `<button class="ligne-retard" data-action="reserve-modifier" data-id="${r.id}"><span class="etiquette rouge">${R.joursRetard(r, t)} j</span><span><b>${esc(r.numero)} · ${esc(r.description)}</b><small>${esc(entreprise(r.entrepriseId)?.nom || 'Entreprise à désigner')} · ${esc(localisation(r))}</small></span></button>`).join('')}</div>` : `<div class="vide-etat petit">${FORME_VIDE}<div><h3>Aucun retard</h3><p>Toutes les réserves ouvertes sont dans les délais.</p></div></div>`}
      <h2 class="titre-section">Par entreprise</h2>
      ${parEnt.length ? `<div class="defile"><table class="tableau">${tete('Entreprise')}<tbody>${parEnt.map((x) => ligneTab(esc(entreprise(x.cle)?.nom || 'Entreprise à désigner'), x)).join('')}</tbody></table></div>` : '<p class="note">Aucune réserve.</p>'}
      <h2 class="titre-section">Par lot</h2>
      ${parLot.length ? `<div class="defile"><table class="tableau">${tete('Lot')}<tbody>${parLot.map((x) => ligneTab(esc(nomCleLot(x.cle)), x)).join('')}</tbody></table></div>` : '<p class="note">Aucune réserve.</p>'}`;
  }

  function pile(x, k) {
    const nom = entreprise(x.cle)?.nom || 'Entreprise à désigner';
    const max = Math.max(1, ...R.parCle(filtre.operationId ? E.reserves.filter((r) => r.operationId === filtre.operationId) : E.reserves, 'entrepriseId', auj()).map((y) => y.total));
    return `<div class="pile" data-i="${k}" tabindex="0" aria-label="${esc(nom)} : ${SEGMENTS.map(([c, l]) => `${l} ${x[c]}`).join(', ')}">
      <div class="pile-tete"><b>${esc(nom)}</b><span>${x.restantes + x.aControler ? `${x.restantes + x.aControler} en cours` : 'tout soldé'}${x.retard ? ` · <em>${x.retard} en retard</em>` : ''}</span></div>
      <div class="pile-barre"><div class="pile-segments" style="width:${(x.total / max) * 100}%">${SEGMENTS.map(([c, , coul]) => (x[c] ? `<i style="flex:${x[c]};background:${coul}"></i>` : '')).join('')}</div><span class="pile-total">${x.total}</span></div>
    </div>`;
  }

  function brancherGraphique() {
    $('#b-op')?.addEventListener('change', (e) => { filtre.operationId = e.target.value; filtre.lotId = ''; rendre(); });
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const liste = filtre.operationId ? E.reserves.filter((r) => r.operationId === filtre.operationId) : E.reserves;
    const parEnt = R.parCle(liste, 'entrepriseId', auj());
    const montrer = (el) => {
      const x = parEnt[Number(el.dataset.i)];
      fig.querySelectorAll('.pile').forEach((p) => p.classList.toggle('active', p === el));
      bulle.innerHTML = `<b>${esc(entreprise(x.cle)?.nom || 'Entreprise à désigner')}</b>${SEGMENTS.map(([c, l, coul]) => `<div><i style="background:${coul}"></i>${l} : ${x[c]}</div>`).join('')}${x.retard ? `<div>En retard : ${x.retard}</div>` : ''}`;
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

  // ---------- Vue PV ----------
  function vuePV() {
    if (!pvChoix.operationId || !operation(pvChoix.operationId)) pvChoix.operationId = filtre.operationId || E.operations[0]?.id || '';
    const op = operation(pvChoix.operationId);
    const res = E.reserves.filter((r) => r.operationId === pvChoix.operationId);
    const ents = E.entreprises.filter((e) => res.some((r) => r.entrepriseId === e.id)).sort((a, b) => a.nom.localeCompare(b.nom));
    if (!ents.some((e) => e.id === pvChoix.entrepriseId)) pvChoix.entrepriseId = ents[0]?.id || '';
    const types = [['liste', 'Liste des réserves à lever'], ['pv', 'Procès-verbal de levée']];
    return `
      <div class="vue-tete"><div><h1>Procès-verbaux</h1><p>Un document par entreprise : la liste des réserves à lever (à lui transmettre) ou le procès-verbal de levée (réserves contrôlées et réserves restantes, à signer).</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer" ${pvChoix.entrepriseId ? '' : 'disabled'}>Imprimer ou PDF</button></div></div>
      <div class="filtres pv-choix">
        <label class="champ">Opération<select data-pv="operationId">${E.operations.map((o) => `<option value="${o.id}" ${o.id === pvChoix.operationId ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>
        <label class="champ">Entreprise<select data-pv="entrepriseId" ${ents.length ? '' : 'disabled'}>${ents.length ? ents.map((e) => { const n = R.indicateurs(res.filter((r) => r.entrepriseId === e.id), auj()); return `<option value="${e.id}" ${e.id === pvChoix.entrepriseId ? 'selected' : ''}>${esc(e.nom)} (${n.restantes + n.aControler} en cours)</option>`; }).join('') : '<option>Aucune entreprise avec réserve</option>'}</select></label>
        <fieldset class="champ bascule"><legend>Document</legend><div>${types.map(([v, l]) => `<label><input type="radio" name="pv-type" data-pv="type" value="${v}" ${pvChoix.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      </div>
      ${op && pvChoix.entrepriseId ? `<div class="pv-cadre"><article class="pv-doc" id="pv-doc">${documentPV(op, entreprise(pvChoix.entrepriseId), pvChoix.type)}</article></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à éditer</h3><p>Aucune réserve sur cette opération pour l'instant.</p><div class="actions"><button class="btn primaire" data-action="reserve-nouvelle">${ICONES.plus}Nouvelle réserve</button></div></div></div>`}`;
  }

  function documentPV(op, ent, type) {
    const t = auj();
    const res = E.reserves.filter((r) => r.operationId === op.id && r.entrepriseId === ent.id).sort((a, b) => String(a.numero).localeCompare(String(b.numero)));
    const lots = [...new Set(res.map((r) => nomLot(lot(r.lotId))))];
    const restantes = res.filter((r) => R.aCharge(r));
    const aControler = res.filter((r) => r.statut === 'levee');
    const controlees = res.filter((r) => r.statut === 'controlee');
    const tab = (liste, cols) => `<table><thead><tr><th>N°</th><th>Localisation</th><th>Réserve</th>${cols.map(([l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${liste.map((r) => `<tr><td class="num">${esc(r.numero)}</td><td>${esc(localisation(r))}</td><td>${esc(r.description)}${r.statut === 'refusee' && r.motifRefus ? `<br><em>Refus : ${esc(r.motifRefus)}</em>` : ''}${r.photo ? `<br><small>Photo : ${esc(r.photo)}</small>` : ''}</td>${cols.map(([, f]) => `<td class="date">${f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const echeance = (r) => `${fmtCourt(r.echeance)}${R.enRetard(r, t) ? '<br><b>en retard</b>' : ''}`;
    const entete = `
      <header>
        <p class="pv-structure">${esc(E.structure || 'Maîtrise d\'œuvre')}</p>
        <h2>${type === 'pv' ? 'Procès-verbal de levée des réserves' : 'Liste des réserves à lever'}</h2>
        <dl>
          <div><dt>Opération</dt><dd>${esc(op.nom)}${op.adresse ? `<br>${esc(op.adresse)}` : ''}</dd></div>
          ${op.moa ? `<div><dt>Maître d'ouvrage</dt><dd>${esc(op.moa)}</dd></div>` : ''}
          <div><dt>Entreprise</dt><dd>${esc(ent.nom)}${ent.contact ? `<br>${esc(ent.contact)}` : ''}${ent.email ? `<br>${esc(ent.email)}` : ''}</dd></div>
          <div><dt>Lot${lots.length > 1 ? 's' : ''}</dt><dd>${lots.map(esc).join('<br>')}</dd></div>
          ${op.reception ? `<div><dt>OPR ou réception</dt><dd>${fmtCourt(op.reception)}</dd></div>` : ''}
          <div><dt>Établi le</dt><dd>${fmtCourt(t)}</dd></div>
        </dl>
      </header>`;
    const signatures = (roles) => `<div class="signatures">${roles.map((r) => `<div><p>${r}</p><p class="sig-lignes">Nom, qualité, date<br>Signature</p></div>`).join('')}</div>`;
    const pied = '<footer>Document établi à partir d\'un modèle, à adapter au marché de l\'opération ; il ne constitue pas un conseil juridique.</footer>';
    if (type === 'pv') {
      return `${entete}
        <p class="pv-synthese">${pluriel(res.length, 'réserve')} au nom de l'entreprise : <b>${pluriel(controlees.length, 'levée et contrôlée', 'levées et contrôlées')}</b>, ${pluriel(aControler.length, 'levée en attente de contrôle', 'levées en attente de contrôle')}, ${pluriel(restantes.length, 'restant à lever', 'restant à lever')}.</p>
        <h3>1. Réserves levées et contrôlées</h3>
        ${controlees.length ? tab(controlees, [['Levée le', (r) => fmtCourt(r.leveeLe)], ['Contrôlée le', (r) => fmtCourt(r.controleLe)]]) : '<p class="pv-vide">Aucune réserve contrôlée à ce jour.</p>'}
        <p class="pv-texte">Les parties constatent que les réserves de la partie 1 sont levées.</p>
        <h3>2. Réserves restant dues</h3>
        ${restantes.length || aControler.length ? tab([...restantes, ...aControler], [['État', (r) => (r.statut === 'levee' ? `Levée le ${fmtCourt(r.leveeLe)}, à contrôler` : R.LIBELLES[r.statut])], ['Échéance', echeance]]) : '<p class="pv-vide">Aucune : toutes les réserves sont levées.</p>'}
        ${signatures(['Pour l\'entreprise', 'Pour la maîtrise d\'œuvre', 'Pour le maître d\'ouvrage'])}
        ${pied}`;
    }
    return `${entete}
      <p class="pv-texte">Merci de lever les réserves ci-dessous avant les échéances indiquées et de nous signaler chaque levée pour contrôle.</p>
      <h3>Réserves à lever (${restantes.length})</h3>
      ${restantes.length ? tab(R.trier(restantes, t, alerte()), [['Constat', (r) => fmtCourt(r.constat)], ['Échéance', echeance], ['Levée le', () => '']]) : '<p class="pv-vide">Aucune réserve à lever.</p>'}
      ${aControler.length ? `<h3>Levées, en attente de contrôle (${aControler.length})</h3>${tab(aControler, [['Levée le', (r) => fmtCourt(r.leveeLe)]])}` : ''}
      ${signatures(['Pour l\'entreprise', 'Pour la maîtrise d\'œuvre'])}
      ${pied}`;
  }

  function imprimer() {
    const doc = $('#pv-doc');
    if (!doc) return;
    $('#impression').innerHTML = doc.innerHTML;
    window.print();
  }

  // ---------- Vue Opérations ----------
  function vueOperations() {
    const t = auj();
    const ops = E.operations.map((o) => {
      const res = E.reserves.filter((r) => r.operationId === o.id);
      const i = R.indicateurs(res, t);
      const lots = lotsDe(o.id);
      return `
        <article class="op">
          <div class="op-tete"><div><h2>${esc(o.nom)}</h2><p>${[o.moa, o.adresse, o.reception && `OPR ou réception le ${fmtCourt(o.reception)}`, o.batiments && `Bâtiments : ${o.batiments}`].filter(Boolean).map(esc).join(' · ') || 'Aucun détail'}</p></div><button data-action="operation-modifier" data-id="${o.id}">Modifier</button></div>
          <div class="matiere-chiffres"><div><b>${i.total}</b><span>réserves</span></div><div><b>${i.restantes + i.aControler}</b><span>en cours</span></div><div><b style="${i.retard ? 'color:var(--rouge)' : ''}">${i.retard}</b><span>en retard</span></div></div>
          <div class="maitrise" role="img" aria-label="Taux de levée : ${i.taux ?? 0} %"><i style="width:${i.taux ?? 0}%"></i></div>
          <div class="op-lots">${lots.length ? lots.map((l) => { const n = R.indicateurs(res.filter((r) => r.lotId === l.id), t); return `<button class="chapitre" data-action="lot-modifier" data-id="${l.id}"><b>${esc(nomLot(l))}</b><span class="nb-lot ${n.retard ? 'retard' : ''}">${n.total ? `${n.restantes + n.aControler} / ${n.total}` : '–'}</span><span>${esc(entreprise(l.entrepriseId)?.nom || 'Entreprise à désigner')}${n.retard ? ` · ${n.retard} en retard` : ''}</span></button>`; }).join('') : '<p class="matiere-vide">Aucun lot.</p>'}</div>
          <div class="matiere-pied"><button class="btn petit" data-action="lot-nouveau" data-op="${o.id}">${ICONES.plus}Lot</button><button class="btn petit" data-action="reserve-nouvelle" data-op="${o.id}">${ICONES.plus}Réserve</button><button class="btn petit" data-action="voir-op" data-op="${o.id}">Voir les réserves</button></div>
        </article>`;
    }).join('');
    const ents = [...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => {
      const n = R.indicateurs(E.reserves.filter((r) => r.entrepriseId === e.id), t);
      const lots = E.lots.filter((l) => l.entrepriseId === e.id);
      return `<button class="ent" data-action="entreprise-modifier" data-id="${e.id}"><b>${esc(e.nom)}</b><span>${lots.length ? esc([...new Set(lots.map((l) => l.code))].join(', ')) : 'Aucun lot attribué'}${e.contact ? ` · ${esc(e.contact)}` : ''}</span><span class="${n.retard ? 'retard' : ''}">${n.total ? `${n.restantes + n.aControler} en cours sur ${n.total}${n.retard ? ` · ${n.retard} en retard` : ''}` : 'Aucune réserve'}</span></button>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Opérations</h1><p>Tes chantiers, leurs lots et les entreprises titulaires. L'entreprise d'un lot est proposée automatiquement à la saisie d'une réserve.</p></div>
        <div class="actions"><button class="btn" data-action="entreprise-nouvelle">${ICONES.plus}Entreprise</button><button class="btn primaire" data-action="operation-nouvelle">${ICONES.plus}Opération</button></div></div>
      <div class="ops">${ops}</div>
      <h2 class="titre-section">Entreprises <span>${pluriel(E.entreprises.length, 'entreprise')}, communes à toutes les opérations.</span></h2>
      ${E.entreprises.length ? `<div class="ents">${ents}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune entreprise</h3><p>Ajoute-les ici ou directement en saisissant une réserve.</p><div class="actions"><button class="btn primaire" data-action="entreprise-nouvelle">${ICONES.plus}Entreprise</button></div></div></div>`}`;
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const L = B.legal;
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Le cycle d'une réserve, les règles d'une réserve bien rédigée et la base intégrée.</p></div></div>
      <h2 class="titre-section">Cycle d'une réserve</h2>
      <ol class="cycle">${B.cycle.map(([t, d], k) => `<li style="--c:${['var(--jaune)', 'var(--bleu)', 'var(--gris)', 'var(--rouge)'][k]}"><b>${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol>
      <p class="note">Retard : réserve ouverte ou refusée dont l'échéance est dépassée. Délai par défaut : ${E.reglages.delai} jours après le constat, ${E.reglages.delaiRefus} jours après un refus (réglables). Ce sont des propositions : le contrat de l'opération fait foi.</p>
      <div class="methodes guide-grille">
        <article class="methode" style="--c:var(--encre)"><div class="methode-tete"><h2>Bien rédiger une réserve</h2></div><ol>${B.redaction.map(([t, d]) => `<li><span><b>${esc(t)}.</b> ${esc(d)}</span></li>`).join('')}</ol></article>
        <article class="methode" style="--c:var(--bleu)"><div class="methode-tete"><h2>Natures de réserve</h2></div><ul class="natures">${B.natures.map((n) => `<li><b>${esc(n.nom)}</b><span>${esc(n.exemple)}</span></li>`).join('')}</ul></article>
      </div>
      <h2 class="titre-section">Ce que dit le Code civil <span>Repère, pas un conseil juridique.</span></h2>
      <div class="legal">
        <p><b>${esc(L.texte)}</b> (${esc(L.version)}, consulté sur Légifrance le ${esc(L.consulte)}), en substance :</p>
        <ul>${L.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p><a href="${L.url}" target="_blank" rel="noopener">Lire l'article sur Légifrance</a>. Les délais, les pénalités et la forme des procès-verbaux dépendent de ton marché : vérifie toujours ton contrat. En cas de doute, demande l'avis d'un juriste.</p>
      </div>
      <h2 class="titre-section">Lots types <span>Proposés à la création d'une opération ; intitulés modifiables.</span></h2>
      <div class="lots-types">${B.lots.map((l) => `<span><b>${l.code}</b>${esc(l.nom)}</span>`).join('')}</div>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Photos</b> : elles ne sont pas stockées dans l'outil (le service n'enregistre que du texte). Note la référence du cliché ou du dossier partagé dans le champ « Référence photo ».</li>
        <li><b>Un compte, une clé</b> : tes données sont les mêmes sur tous tes appareils ; pas de comptes séparés pour les entreprises.</li>
        <li><b>Signature</b> : le procès-verbal s'imprime (ou s'enregistre en PDF) et se signe à la main.</li>
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

  const optionsLots = (opId, choisi) => `<option value="">Sans lot</option>${lotsDe(opId).map((l) => `<option value="${l.id}" ${l.id === choisi ? 'selected' : ''}>${esc(nomLot(l))}</option>`).join('')}`;
  const optionsEnts = (choisi) => `<option value="">À désigner</option>${[...E.entreprises].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => `<option value="${e.id}" ${e.id === choisi ? 'selected' : ''}>${esc(e.nom)}</option>`).join('')}<option value="__nouvelle">+ Nouvelle entreprise…</option>`;
  const listeValeurs = (cle, opId) => [...new Set(E.reserves.filter((r) => !opId || r.operationId === opId).map((r) => r[cle]).filter(Boolean))].sort();
  let garder = null; // localisation gardée pour enchaîner les saisies

  function modaleReserve(id, opDefaut) {
    if (!E.operations.length) { modaleOperation(); return; }
    const r = id ? reserve(id) : null;
    const t = auj();
    const opId = r?.operationId || opDefaut || garder?.operationId || filtre.operationId || E.operations[0].id;
    const op = operation(opId);
    const g = !r && garder?.operationId === opId ? garder : null;
    const lotId = r?.lotId || g?.lotId || '';
    const entId = r ? r.entrepriseId : (g?.entrepriseId || lot(lotId)?.entrepriseId || '');
    const bats = [...new Set([...(op.batiments || '').split(',').map((s) => s.trim()).filter(Boolean), ...listeValeurs('batiment', opId)])];
    const transitions = r ? R.TRANSITIONS[r.statut] : [];
    const libT = { levee: 'Levée par l\'entreprise', controlee: 'Contrôlée (acceptée)', refusee: 'Refusée au contrôle', ouverte: 'Rouvrir' };
    const corps = `
      ${E.operations.length > 1 ? `<label class="champ">Opération<select name="operationId" id="m-op">${E.operations.map((o) => `<option value="${o.id}" ${o.id === opId ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select></label>` : `<input type="hidden" name="operationId" value="${opId}">`}
      <div class="grille-3">
        <label class="champ">Bâtiment<input name="batiment" list="dl-bat" maxlength="30" value="${esc(r?.batiment ?? g?.batiment ?? (bats.length === 1 ? bats[0] : ''))}"></label>
        <label class="champ">Niveau<input name="niveau" list="dl-niv" maxlength="30" value="${esc(r?.niveau ?? g?.niveau ?? '')}"></label>
        <label class="champ">Local<input name="local" list="dl-loc" maxlength="60" value="${esc(r?.local ?? g?.local ?? '')}" placeholder="Ex. : Logement A12 · séjour"></label>
      </div>
      <datalist id="dl-bat">${bats.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
      <datalist id="dl-niv">${[...new Set([...B.niveaux, ...listeValeurs('niveau', opId)])].map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
      <datalist id="dl-loc">${listeValeurs('local', opId).map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
      <div class="grille-2">
        <label class="champ">Lot<select name="lotId" id="m-lot">${optionsLots(opId, lotId)}</select></label>
        <label class="champ">Entreprise<select name="entrepriseId" id="m-ent">${optionsEnts(entId)}</select></label>
      </div>
      <label class="champ" id="m-nouvelle" hidden>Nom de la nouvelle entreprise<input name="nouvelle" maxlength="80"></label>
      <label class="champ">Description<small>Un défaut, un fait constaté, ce qui est attendu.</small><textarea name="description" required maxlength="500" placeholder="Ex. : Fissure de 30 cm sous l'allège, mur nord : reboucher et repeindre">${esc(r?.description || '')}</textarea></label>
      <div class="grille-2">
        <label class="champ">Nature<select name="nature">${B.natures.map((n) => `<option ${n.nom === (r?.nature || g?.nature) ? 'selected' : ''}>${esc(n.nom)}</option>`).join('')}</select></label>
        <label class="champ">Référence photo<small>Les photos ne sont pas stockées ici.</small><input name="photo" maxlength="120" value="${esc(r?.photo || '')}" placeholder="Ex. : IMG_0412, dossier OPR"></label>
      </div>
      <div class="grille-2">
        <label class="champ">Constatée le<input type="date" name="constat" id="m-constat" value="${r?.constat || t}" max="${t}" required></label>
        <label class="champ">Échéance<small id="m-ech-aide">${r ? '' : `Constat + ${E.reglages.delai} jours.`}</small><input type="date" name="echeance" id="m-ech" value="${r?.echeance || R.echeanceDefaut(t, E.reglages.delai)}" required></label>
      </div>
      ${r ? `<div class="groupe"><h3>Statut : ${esc(R.LIBELLES[r.statut])}${R.enRetard(r, t) ? ` · en retard de ${pluriel(R.joursRetard(r, t), 'jour')}` : ''}</h3>
        ${r.historique.length ? `<ol class="historique">${r.historique.map((h) => `<li><b>${fmtCourt(h.date)}</b> ${esc(R.LIBELLES[h.statut])}${h.note ? ` : ${esc(h.note)}` : ''}</li>`).join('')}</ol>` : '<p class="aide">Aucun changement de statut depuis le constat.</p>'}
        <label class="champ">Changer le statut<select name="vers" id="m-vers"><option value="">Ne pas changer</option>${transitions.map((v) => `<option value="${v}">${libT[v]}</option>`).join('')}</select></label>
        <div class="grille-2" id="m-trans" hidden>
          <label class="champ">Date<input type="date" name="dateT" value="${t}" max="${t}"></label>
          <label class="champ" id="m-ech2">Nouvelle échéance<input type="date" name="echeanceT" value="${R.echeanceDefaut(t, E.reglages.delaiRefus)}"></label>
          <label class="champ" style="grid-column:1/-1">Motif ou commentaire<input name="note" maxlength="200"></label>
        </div></div>` : '<label class="case"><input type="checkbox" name="enchainer" checked> Enchaîner : garder la localisation pour la réserve suivante</label>'}
      <p class="erreur" role="alert"></p>`;
    const pied = r
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Fermer</button>';
    ouvrirModale(r ? `Réserve ${esc(r.numero)}` : `Nouvelle réserve · ${esc(R.prochainNumero(E.reserves, opId))}`, corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer la réserve ${r.numero} ?`)) return '';
        const avant = structuredClone(E.reserves);
        E.reserves = E.reserves.filter((x) => x.id !== r.id);
        annulation = () => { E.reserves = avant; };
        sauver(); rendre(); toast(`Réserve ${r.numero} supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const description = String(f.get('description') || '').trim();
      if (!description) return 'Décris la réserve.';
      const constat = f.get('constat'), echeance = f.get('echeance');
      if (!R.estDate(constat) || constat > t) return 'La date de constat ne peut pas être dans le futur.';
      if (!R.estDate(echeance) || echeance < constat) return 'L\'échéance doit suivre la date de constat.';
      let entrepriseId = f.get('entrepriseId') || null;
      const nouvelle = String(f.get('nouvelle') || '').trim();
      if (entrepriseId === '__nouvelle') {
        if (!nouvelle) return 'Indique le nom de la nouvelle entreprise.';
        const ex = E.entreprises.find((e) => R.plat(e.nom) === R.plat(nouvelle));
        if (ex) entrepriseId = ex.id;
        else { const e = { id: uid(), nom: nouvelle, contact: '', email: '' }; E.entreprises.push(e); entrepriseId = e.id; }
      }
      const operationId = f.get('operationId');
      const lotId = f.get('lotId') || null;
      const l = lot(lotId);
      if (l && !l.entrepriseId && entrepriseId) l.entrepriseId = entrepriseId; // le lot hérite de son titulaire
      const champs = { operationId, lotId, entrepriseId, batiment: String(f.get('batiment') || '').trim(), niveau: String(f.get('niveau') || '').trim(), local: String(f.get('local') || '').trim(),
        nature: f.get('nature'), description, constat, echeance, photo: String(f.get('photo') || '').trim() };
      if (r) {
        let n = { ...r, ...champs };
        if (r.operationId !== operationId) n.numero = R.prochainNumero(E.reserves, operationId);
        const vers = f.get('vers');
        if (vers) {
          try {
            n = R.transition(n, vers, { date: f.get('dateT'), note: f.get('note'), echeance: vers === 'refusee' || vers === 'ouverte' ? f.get('echeanceT') : undefined, delai: E.reglages.delaiRefus });
          } catch (x) { return x.message; }
        }
        const avant = structuredClone(r);
        Object.assign(r, n);
        annulation = () => { Object.assign(reserve(r.id) || {}, avant); };
        sauver(); rendre(); toast(vers ? `Réserve ${r.numero} : ${R.LIBELLES[r.statut].toLowerCase()}.` : `Réserve ${r.numero} enregistrée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const n = { id: uid(), numero: R.prochainNumero(E.reserves, operationId), ...champs, statut: 'ouverte', leveeLe: null, controleLe: null, motifRefus: '', historique: [] };
      E.reserves.push(n);
      sauver(); rendre();
      if (f.get('enchainer')) {
        garder = { operationId, lotId, entrepriseId, batiment: champs.batiment, niveau: champs.niveau, local: champs.local, nature: champs.nature };
        toast(`Réserve ${n.numero} ajoutée. Saisis la suivante.`);
        setTimeout(() => modaleReserve(), 10);
        return false;
      }
      garder = null;
      toast(`Réserve ${n.numero} ajoutée, échéance ${quand(n.echeance)}.`);
    });
    // Comportements du formulaire.
    const d = modale();
    const selEnt = $('#m-ent', d), selLot = $('#m-lot', d), champNouv = $('#m-nouvelle', d);
    const majNouv = () => { champNouv.hidden = selEnt.value !== '__nouvelle'; if (!champNouv.hidden) champNouv.querySelector('input').focus(); };
    selEnt.addEventListener('change', majNouv);
    selLot.addEventListener('change', () => { const l = lot(selLot.value); if (l?.entrepriseId) { selEnt.value = l.entrepriseId; majNouv(); } });
    $('#m-op', d)?.addEventListener('change', (e) => { selLot.innerHTML = optionsLots(e.target.value, ''); });
    let echManuelle = !!r;
    $('#m-ech', d).addEventListener('input', () => { echManuelle = true; });
    $('#m-constat', d).addEventListener('change', (e) => { if (!echManuelle && R.estDate(e.target.value)) $('#m-ech', d).value = R.echeanceDefaut(e.target.value, E.reglages.delai); });
    const vers = $('#m-vers', d);
    vers?.addEventListener('change', () => {
      $('#m-trans', d).hidden = !vers.value;
      $('#m-ech2', d).hidden = !['refusee', 'ouverte'].includes(vers.value);
    });
    if (!r) d.querySelector('textarea').focus();
  }

  // Refus rapide depuis la carte : motif obligatoire, nouvelle échéance.
  function modaleRefus(id) {
    const r = reserve(id);
    const t = auj();
    ouvrirModale(`Refuser la levée · ${esc(r.numero)}`, `
      <p class="aide">${esc(r.description)} · ${esc(localisation(r))}</p>
      <label class="champ">Motif du refus<small>Ce que l'entreprise doit reprendre ; il figure sur la liste des réserves à lever.</small><textarea name="note" required maxlength="200"></textarea></label>
      <div class="grille-2"><label class="champ">Contrôlée le<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ">Nouvelle échéance<input type="date" name="echeance" value="${R.echeanceDefaut(t, E.reglages.delaiRefus)}"></label></div>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Refuser la levée</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      try {
        const n = R.transition(r, 'refusee', { date: f.get('date'), note: f.get('note'), echeance: f.get('echeance') });
        appliquer(r, n, `Réserve ${r.numero} refusée : nouvelle échéance ${quand(n.echeance)}.`);
      } catch (x) { return x.message; }
    });
  }

  function modaleOperation(id) {
    const o = id ? operation(id) : null;
    const nb = o ? E.reserves.filter((r) => r.operationId === o.id).length : 0;
    const corps = `
      <label class="champ">Nom de l'opération<input name="nom" required maxlength="80" value="${esc(o?.nom || '')}"></label>
      <div class="grille-2">
        <label class="champ">Maître d'ouvrage<input name="moa" maxlength="80" value="${esc(o?.moa || '')}"></label>
        <label class="champ">Date des OPR ou de la réception<input type="date" name="reception" value="${o?.reception || ''}"></label>
      </div>
      <label class="champ">Adresse<input name="adresse" maxlength="120" value="${esc(o?.adresse || '')}"></label>
      <label class="champ">Bâtiments<small>Séparés par des virgules.</small><input name="batiments" maxlength="120" value="${esc(o?.batiments || '')}"></label>
      ${o ? '' : `<fieldset class="champ sans-cadre"><legend>Lots</legend><div class="choix-lots compact">${B.lots.map((l) => `<label class="case"><input type="checkbox" name="lot" value="${l.code}" ${l.courant ? 'checked' : ''}> <b>${l.code}</b> ${esc(l.nom)}</label>`).join('')}</div></fieldset>`}
      <p class="erreur" role="alert"></p>`;
    const pied = o ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(o ? 'Modifier l\'opération' : 'Nouvelle opération', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${o.nom} »${nb ? `, ses ${pluriel(nb, 'réserve')}` : ''} et ses lots ? Pense à exporter une copie avant.`)) return '';
        const avant = structuredClone({ operations: E.operations, lots: E.lots, reserves: E.reserves });
        E.operations = E.operations.filter((x) => x.id !== o.id);
        E.lots = E.lots.filter((l) => l.operationId !== o.id);
        E.reserves = E.reserves.filter((r) => r.operationId !== o.id);
        if (filtre.operationId === o.id) filtre.operationId = '';
        annulation = () => { Object.assign(E, avant); };
        sauver();
        if (!E.operations.length) { ecranAccueil(); return; }
        rendre(); toast(`« ${o.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'opération.';
      const champs = { nom, moa: String(f.get('moa') || '').trim(), reception: f.get('reception') || null, adresse: String(f.get('adresse') || '').trim(), batiments: String(f.get('batiments') || '').trim() };
      if (o) Object.assign(o, champs);
      else {
        const n = { id: uid(), ...champs };
        E.operations.push(n);
        f.getAll('lot').forEach((code) => { const b = B.lots.find((x) => x.code === code); E.lots.push({ id: uid(), operationId: n.id, code, nom: b.nom, entrepriseId: null }); });
      }
      sauver(); rendre(); toast(o ? 'Opération enregistrée.' : `« ${nom} » créée.`);
    });
  }

  function modaleLot(id, opId) {
    const l = id ? lot(id) : null;
    const op = operation(l?.operationId || opId);
    const nb = l ? E.reserves.filter((r) => r.lotId === l.id).length : 0;
    const corps = `
      <p class="aide">${esc(op.nom)}</p>
      <div class="grille-lot">
        <label class="champ">Code<input name="code" maxlength="6" value="${esc(l?.code || '')}" placeholder="PEI"></label>
        <label class="champ">Intitulé<input name="nom" required maxlength="80" list="dl-lots" value="${esc(l?.nom || '')}"></label>
      </div>
      <datalist id="dl-lots">${B.lots.map((b) => `<option value="${esc(b.nom)}">`).join('')}</datalist>
      <label class="champ">Entreprise titulaire<select name="entrepriseId" id="m-ent">${optionsEnts(l?.entrepriseId || '')}</select></label>
      <label class="champ" id="m-nouvelle" hidden>Nom de la nouvelle entreprise<input name="nouvelle" maxlength="80"></label>
      ${l && nb ? `<p class="aide">${pluriel(nb, 'réserve')} sur ce lot. Changer de titulaire ne modifie pas les réserves déjà saisies.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = l ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(l ? 'Modifier le lot' : 'Nouveau lot', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (nb) return `Ce lot porte ${pluriel(nb, 'réserve')} : déplace-les ou supprime-les d'abord.`;
        E.lots = E.lots.filter((x) => x.id !== l.id);
        sauver(); rendre(); toast('Lot supprimé.');
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
        const e = { id: uid(), nom: n, contact: '', email: '' }; E.entreprises.push(e); entrepriseId = e.id;
      }
      if (l) Object.assign(l, { code, nom, entrepriseId });
      else E.lots.push({ id: uid(), operationId: op.id, code, nom, entrepriseId });
      sauver(); rendre(); toast(l ? 'Lot enregistré.' : 'Lot ajouté.');
    });
    const d = modale();
    $('#m-ent', d).addEventListener('change', (e) => { $('#m-nouvelle', d).hidden = e.target.value !== '__nouvelle'; });
    $('[name=nom]', d).addEventListener('change', (e) => { const b = B.lots.find((x) => x.nom === e.target.value); const c = $('[name=code]', d); if (b && !c.value) c.value = b.code; });
  }

  function modaleEntreprise(id) {
    const e = id ? entreprise(id) : null;
    const nb = e ? E.reserves.filter((r) => r.entrepriseId === e.id).length : 0;
    const corps = `
      <label class="champ">Raison sociale<input name="nom" required maxlength="80" value="${esc(e?.nom || '')}"></label>
      <label class="champ">Contact<small>La fonction suffit (ex. : conducteur de travaux).</small><input name="contact" maxlength="80" value="${esc(e?.contact || '')}"></label>
      <label class="champ">E-mail professionnel<small>Préfère une adresse générique de l'entreprise.</small><input type="email" name="email" maxlength="120" value="${esc(e?.email || '')}"></label>
      ${e ? `<p class="aide">${nb ? `${pluriel(nb, 'réserve')} au nom de cette entreprise.` : 'Aucune réserve au nom de cette entreprise.'} Les lots s'attribuent depuis l'onglet Opérations.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = e ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(e ? 'Modifier l\'entreprise' : 'Nouvelle entreprise', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (nb) return `${pluriel(nb, 'réserve')} au nom de cette entreprise : réattribue-les d'abord.`;
        E.entreprises = E.entreprises.filter((x) => x.id !== e.id);
        E.lots.forEach((l) => { if (l.entrepriseId === e.id) l.entrepriseId = null; });
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

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Ta structure<small>En-tête des procès-verbaux.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <div class="grille-3">
        <label class="champ">Délai de levée (j)<input type="number" name="delai" min="1" max="365" value="${r.delai}"></label>
        <label class="champ">Après un refus (j)<input type="number" name="delaiRefus" min="1" max="365" value="${r.delaiRefus}"></label>
        <label class="champ">Alerte avant (j)<input type="number" name="alerte" min="0" max="60" value="${r.alerte}"></label>
      </div>
      <p class="aide">Délais proposés à la saisie, modifiables réserve par réserve. Le contrat de l'opération fait foi.</p>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes réserves sont enregistrées en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko (${pluriel(E.reserves.length, 'réserve')}).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-tout">Toutes les réserves (CSV)</button><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const delai = n('delai', 1, 365), delaiRefus = n('delaiRefus', 1, 365), al = n('alerte', 0, 60);
      if (delai === null || delaiRefus === null) return 'Délais : nombres entiers entre 1 et 365 jours.';
      if (al === null) return 'Alerte : entre 0 et 60 jours.';
      E.structure = String(f.get('structure') || '').trim();
      Object.assign(r, { delai, delaiRefus, alerte: al });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.operations) || !Array.isArray(d.reserves)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.operations.length, 'opération')}, ${pluriel(d.reserves.length, 'réserve')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
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
    let liste = E.reserves;
    if (!tout) { const f = filtreEffectif(); liste = R.filtrer(E.reserves, f, auj(), nomsRecherche); if (f.lots) liste = liste.filter((r) => f.lots.has(r.lotId)); }
    telecharger(R.csv(E, auj(), liste), `reserves-${auj()}.csv`, 'text/csv;charset=utf-8');
    toast(`${pluriel(liste.length, 'réserve')} exportée${liste.length > 1 ? 's' : ''} (CSV, point-virgule).`);
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
  function appliquer(r, n, message) {
    const avant = structuredClone(r);
    Object.assign(r, n);
    annulation = () => { const x = reserve(r.id); if (x) { Object.keys(x).forEach((k) => delete x[k]); Object.assign(x, avant); } };
    sauver();
    const carte = document.querySelector(`[data-carte="${r.id}"]`);
    const suite = () => { rendre(); toast(message, { libelle: 'Annuler', faire: annuler }); };
    if (carte && !matchMedia('(prefers-reduced-motion: reduce)').matches) { carte.classList.add('sortie'); setTimeout(suite, 200); } else suite();
  }

  function rapide(id, vers) {
    const r = reserve(id);
    if (!r) return;
    try {
      const n = R.transition(r, vers, { date: auj() });
      appliquer(r, n, vers === 'levee' ? `Réserve ${r.numero} levée : à contrôler sur place.` : `Réserve ${r.numero} contrôlée et soldée.`);
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `levee-reserves-${auj()}.json`, 'application/json'); break;
      case 'csv': exporterCsv(false); break;
      case 'csv-tout': exporterCsv(true); break;
      case 'fermer': modale().close(); break;
      case 'reserve-nouvelle': garder = null; modaleReserve(null, el.dataset.op); break;
      case 'reserve-modifier': modaleReserve(id); break;
      case 'lever': rapide(id, 'levee'); break;
      case 'accepter': rapide(id, 'controlee'); break;
      case 'refuser': modaleRefus(id); break;
      case 'filtre-statut': filtre.statut = filtre.statut === el.dataset.statut ? 'en-cours' : el.dataset.statut; rendre(); break;
      case 'filtres-effacer': Object.assign(filtre, { lotId: '', entrepriseId: '', statut: 'en-cours', texte: '' }); rendre(); break;
      case 'voir-op': filtre.operationId = el.dataset.op; filtre.lotId = ''; changerVue('reserves'); break;
      case 'operation-nouvelle': modaleOperation(); break;
      case 'operation-modifier': modaleOperation(id); break;
      case 'lot-nouveau': modaleLot(null, el.dataset.op); break;
      case 'lot-modifier': modaleLot(id); break;
      case 'entreprise-nouvelle': modaleEntreprise(); break;
      case 'entreprise-modifier': modaleEntreprise(id); break;
      case 'imprimer': imprimer(); break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const k = e.target.dataset?.pv;
    if (!k) return;
    pvChoix[k] = e.target.value;
    rendre();
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && vue !== 'reserves') rendre();
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
  window.__reserves = { etat: () => E };
  init();
})();
