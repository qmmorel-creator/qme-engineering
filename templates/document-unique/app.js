// Document unique d'évaluation des risques QME : unités de travail, risques cotés (gravité × probabilité,
// grille paramétrable), risque résiduel, plan d'actions, versions archivées et datées, document imprimable,
// alertes de mise à jour selon l'effectif (obligations sourcées et datées). Données synchronisées par clé de
// licence ou code d'accès. Outil d'aide : ne remplace ni un préventeur ni un conseil juridique.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.DRP;
  const API = '/api/templates';
  const PRODUIT = 'DRP';
  const CLE_CODE = 'qme-drp-code';
  const CLE_CACHE = 'qme-drp-cache';
  const CLE_DEMO = 'qme-drp-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-drp-ecran-accueil';

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
  const { ajout, ajoutMois, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const dans = (j) => (j === null ? '' : j === 0 ? 'aujourd\'hui' : j > 0 ? `dans ${pluriel(j, 'jour')}` : `depuis ${pluriel(-j, 'jour')}`);
  const euros = R.euros;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { unite: '', prio: 'toutes', q: '', act: 'ouvertes', qa: '', version: '', annee: null };
  let annulation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  // Ajouté ici : la normalisation des règles ne connaît pas ce champ et le supprimerait.
  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d), tutorielVu: Boolean(d?.tutorielVu) });

  const unite = (id) => E.unites.find((u) => u.id === id);
  const risque = (id) => E.risques.find((r) => r.id === id);
  const action = (id) => E.actions.find((a) => a.id === id);
  const nomUnite = (id) => unite(id)?.nom || 'Unité supprimée';

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
        toast('Un autre appareil a modifié le document unique entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (DRP-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && E.unites.length) { cache(false); demarrer(); } else ecranAccueil();
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
  // Menuiserie fictive de 14 salariés (mise à jour annuelle obligatoire). Historique simulé avec les vraies
  // règles, à des dates relatives à aujourd'hui : V1 il y a deux ans, V2 il y a un peu moins d'un an (mise
  // à jour annuelle proche), événement survenu après V2 (mise à jour à faire), modifications non archivées,
  // actions faites, en cours, en retard, abandonnée, risque de priorité 1 sans action, risque à coter,
  // unité de travail sans risque évalué, risque résiduel réduit après une action.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n, dj = 0) => ajout(ajoutMois(t, n), dj);
    e.entreprise = R.normaliserEntreprise({
      nom: 'Menuiserie Exemple', activite: 'Fabrication et pose de menuiseries bois sur mesure', secteur: 'batiment', effectif: 14,
      adresse: '8 rue de l\'Exemple, Ville-Exemple', responsable: 'Gérant (rédacteur du document)',
      participants: 'Gérant, chef d\'atelier, chef d\'équipe pose, un menuisier d\'atelier, un poseur ; avis du SPST',
      acces: 'Le document unique est consultable au bureau, dans le classeur « Santé et sécurité », aux heures d\'ouverture, sur simple demande auprès du gérant. Une copie est envoyée au service de prévention et de santé au travail à chaque mise à jour.',
      annexe: 'Exposition aux facteurs de risques professionnels (art. L4161-1) : bruit des machines d\'atelier pour 4 salariés sur 14, à faire mesurer ; pas d\'exposition identifiée au-delà des seuils à ce jour pour les autres facteurs. Chiffres fictifs de démonstration.',
    });
    const U = {};
    const unites = [
      ['atelier', 'Atelier de fabrication', 'lieu', 'Débit, usinage et assemblage du bois', 5],
      ['finition', 'Cabine de finition', 'lieu', 'Ponçage, vernis et lasures', 2],
      ['pose', 'Pose sur chantier', 'poste', 'Pose de fenêtres, portes et agencements chez les clients', 5],
      ['route', 'Livraisons et trajets', 'activite', 'Utilitaires entre l\'atelier et les chantiers', 7],
      ['bureau', 'Bureau et accueil', 'lieu', 'Devis, commandes, accueil des clients', 2],
    ];
    for (const [k, nom, type, description, effectif] of unites) { const u = R.normaliserUnite({ id: uid(), nom, type, description, effectif }); e.unites.push(u); U[k] = u.id; }
    const RQ = {};
    const risques = [
      // [clé, unité, famille, situation, conséquences, exposés, g, p, mesures en place, gr, pr]
      ['scie', 'atelier', 'MACHINES', 'Scie circulaire à format : contact avec la lame lors des coupes étroites', 'Coupure grave, amputation', 3, 4, 3, 'Protecteur de lame en place, poussoirs à disposition, formation à l\'embauche', 4, 2],
      ['toupie', 'atelier', 'MACHINES', 'Toupie sans entraîneur pour les petites séries', 'Happement, coupure grave', 2, 4, 3, 'Usage réservé au chef d\'atelier', null, null],
      ['bruit', 'atelier', 'BRUIT', 'Machines bruyantes, plusieurs heures par jour', 'Perte d\'audition', 5, 3, 4, 'Bouchons d\'oreille à disposition', 3, 3],
      ['poussiere', 'atelier', 'CHIMIQUE', 'Poussières de bois lors du ponçage et du débit', 'Irritations, atteintes respiratoires', 5, 3, 3, 'Aspiration centralisée sur les machines fixes', 3, 2],
      ['manut', 'atelier', 'PHYSIQUE', 'Port de panneaux et de menuiseries finies', 'Mal de dos, troubles musculo-squelettiques', 5, 2, 4, 'Chariot de manutention pour les panneaux', 2, 3],
      ['vernis', 'finition', 'CHIMIQUE', 'Vernis et lasures en solvant appliqués au pistolet', 'Intoxication, irritations', 2, 3, 3, 'Cabine ventilée, masques à cartouche', 3, 2],
      ['incendie', 'finition', 'INCENDIE', 'Solvants et poussières près des machines', 'Incendie, brûlures', 7, 4, 2, 'Extincteurs vérifiés, stockage des solvants en armoire', 4, 1],
      ['echelle', 'pose', 'HAUTEUR', 'Pose de fenêtres en étage depuis un escabeau', 'Chute, fractures', 5, 4, 3, 'Escabeaux en bon état', 4, 3],
      ['pose-manut', 'pose', 'PHYSIQUE', 'Port de fenêtres et de portes dans les escaliers des clients', 'Lombalgies', 5, 2, 3, '', null, null],
      ['outils', 'pose', 'VIBRATIONS', 'Perforateur et visseuse à chocs', 'Troubles des mains et des bras', 5, 2, 2, 'Outils récents à faibles vibrations', 2, 1],
      ['route', 'route', 'ROUTE', 'Utilitaire chargé, chantiers éloignés, appels pendant la conduite', 'Accident de la route', 7, 4, 2, 'Utilitaires entretenus, cloison de séparation', 4, 2],
      ['arrimage', 'route', 'EFFONDREMENT', 'Menuiseries mal arrimées dans l\'utilitaire', 'Chute de charge au déchargement', 5, 3, 2, 'Sangles dans chaque véhicule', null, null],
      ['ecran', 'bureau', 'PHYSIQUE', 'Devis et plans sur écran une grande partie de la journée', 'Fatigue visuelle, douleurs cervicales', 2, 2, 3, 'Écrans réglables, sièges ajustables', 1, 3],
      ['client', 'bureau', 'PSYCHOSOCIAUX', 'Clients mécontents des délais, pics de commandes au printemps', 'Stress, conflits', 2, 2, 2, '', null, null],
    ];
    for (const [k, uk, famille, danger, consequences, exposes, g, p, mesures, gr, pr] of risques) {
      const r = R.normaliserRisque({ id: uid(), unite: U[uk], famille, danger, consequences, exposes, g, p, mesures, gr, pr, evalueLe: m(-24) }, e.grille);
      e.risques.push(r); RQ[k] = r.id;
    }
    const A = {};
    const act = (k, rk, intitule, type, responsable, echeance, cout, statut, extra = {}) => {
      const a = R.normaliserAction({ id: uid(), risque: RQ[rk], intitule, type, responsable, echeance, cout, statut, creeLe: m(-24), ...extra });
      e.actions.push(a); A[k] = a.id; return a;
    };
    act('pirl', 'echelle', 'Acheter deux plateformes individuelles roulantes pour la pose en étage', 'collective', 'Gérant', m(-20), 180000, 'a-faire', { indicateur: 'Plus aucune pose en étage depuis un escabeau' });
    act('former-scie', 'scie', 'Recyclage de l\'équipe d\'atelier à l\'usage de la scie à format', 'formation', 'Chef d\'atelier', m(-18), 60000, 'a-faire', { indicateur: '5 menuisiers formés' });
    act('aspi', 'poussiere', 'Raccorder la ponceuse portative à l\'aspiration', 'collective', 'Chef d\'atelier', m(-21), 45000, 'a-faire');
    act('armoire', 'incendie', 'Armoire de stockage ventilée pour les solvants', 'collective', 'Gérant', m(-22), 120000, 'a-faire');
    act('casques', 'bruit', 'Protections auditives moulées sur mesure', 'individuelle', 'Gérant', m(-2, -5), 90000, 'a-faire');
    act('telephone', 'route', 'Note interne : pas d\'appel au volant, pause toutes les deux heures', 'organisation', 'Gérant', m(-23), 0, 'a-faire');
    R.archiver(e, { date: m(-24), motif: 'creation', participants: e.entreprise.participants }, t, uid);

    // Entre V1 et V2 : actions réalisées, risques résiduels réduits, nouvelle évaluation.
    R.terminerAction(e, A.pirl, m(-19, 4), t); Object.assign(R.risque(e, RQ.echelle), { gr: 4, pr: 1 });
    R.terminerAction(e, A.aspi, m(-20), t); Object.assign(R.risque(e, RQ.poussiere), { gr: 2, pr: 2 });
    R.terminerAction(e, A.armoire, m(-21), t);
    R.terminerAction(e, A.telephone, m(-23), t);
    R.terminerAction(e, A['former-scie'], m(-17), t);
    e.evenements.push(R.normaliserEvenement({ id: uid(), date: m(-14), type: 'accident', texte: 'Coupure à la main sur la scie à format, sans arrêt de travail' }));
    act('poussoir', 'scie', 'Chariot à tenonner et guide parallèle pour les coupes étroites', 'collective', 'Chef d\'atelier', m(-1, -10), 85000, 'faite', { faiteLe: m(-1, -12), indicateur: 'Aucune coupe étroite à la main' });
    Object.assign(R.risque(e, RQ.scie), { gr: 4, pr: 1 });
    act('masques', 'vernis', 'Remplacer les vernis solvantés par des vernis en phase aqueuse quand c\'est possible', 'remplacer', 'Chef d\'atelier', m(-10), 30000, 'abandonnee', { note: 'Rendu jugé insuffisant par les clients pour les menuiseries extérieures : à réexaminer.' });
    R.archiver(e, { date: m(-11, -20), motif: 'annuelle', participants: e.entreprise.participants }, t, uid);

    // Depuis V2 : nouvelles actions, une en retard, un événement (nouveau bâtiment de stockage).
    act('chariot', 'pose-manut', 'Diable monte-escalier pour les menuiseries lourdes', 'collective', 'Chef d\'équipe pose', j(-12), 140000, 'en-cours', { indicateur: 'Utilisé sur tous les chantiers en étage' });
    act('formation-gestes', 'manut', 'Formation gestes et postures pour l\'atelier et la pose', 'formation', 'Gérant', j(18), 150000, 'a-faire', { indicateur: '10 salariés formés' });
    act('mesure-bruit', 'bruit', 'Faire mesurer l\'exposition au bruit par le SPST', 'organisation', 'Gérant', j(45), 0, 'a-faire');
    act('arrimage', 'arrimage', 'Rails d\'arrimage dans les deux utilitaires', 'collective', 'Chef d\'équipe pose', j(75), 70000, 'a-faire');
    act('entretien-annuel', 'client', 'Point charge de travail à chaque entretien annuel', 'organisation', 'Gérant', j(120), null, 'a-faire');
    e.evenements.push(R.normaliserEvenement({ id: uid(), date: j(-20), type: 'amenagement', texte: 'Mise en service du nouveau bâtiment de stockage du bois' }));
    e.risques.push(R.normaliserRisque({ id: uid(), unite: U.atelier, famille: 'ELECTRIQUE', danger: 'Rallonges utilisées pour les machines portatives près de l\'établi', consequences: 'Électrisation', exposes: 5, evalueLe: j(-5) }, e.grille));
    e.unites.push(R.normaliserUnite({ id: uid(), nom: 'Stockage du bois', type: 'lieu', description: 'Racks de panneaux et de bois massif (nouveau bâtiment)', effectif: 3 }));
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Document unique d\'évaluation des risques · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="70" height="70" fill="#2E5A88"/><rect x="100" y="40" width="70" height="70" fill="#E8B93A"/><rect x="180" y="40" width="70" height="70" fill="#E58C74"/>
          <rect x="20" y="120" width="70" height="70" fill="#F3EDE3"/><rect x="100" y="120" width="70" height="70" fill="#2E5A88"/><rect x="180" y="120" width="70" height="70" fill="#E8B93A"/>
          <rect x="20" y="200" width="70" height="70" fill="#F3EDE3"/><rect x="100" y="200" width="70" height="70" fill="#F3EDE3"/><rect x="180" y="200" width="70" height="70" fill="#2E5A88"/>
          <circle cx="430" cy="150" r="130" fill="#F3EDE3"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#24221F"/>
          <path d="M380 210 L430 120 L480 210 Z" fill="#E58C74"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Document unique d'évaluation des risques</p>
          <h1>Tes risques évalués, ton document à jour.</h1>
          <p>Unités de travail, risques cotés, plan d'actions, versions datées et document prêt à imprimer, avec les obligations selon ton effectif.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton document unique</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton document est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon document unique</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/document-unique/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon document unique'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const nouvelAccueil = () => ({ etape: 1, nom: '', effectif: '', secteur: 'bureaux', unites: null });
  let accueil = nouvelAccueil();
  const secteur = (id) => B.secteurs.find((s) => s.id === id) || B.secteurs[B.secteurs.length - 1];

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On construit ton document unique.</h1>
        <p class="intro">Tu découpes l'entreprise en unités de travail, tu notes les risques de chacune, tu les cotes et tu prévois les actions : le document, le plan d'actions et les rappels de mise à jour se font seuls.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ton entreprise <small>Nom repris en tête du document.</small><input id="nom" value="${esc(a.nom)}" autocomplete="organization" maxlength="100"></label>
          <label class="champ">Effectif salarié <small>Il fixe les obligations (11 et 50 salariés).</small><input id="effectif" inputmode="numeric" value="${esc(a.effectif)}" maxlength="5" placeholder="Ex. : 8"></label>
        </div>
        <fieldset style="margin-top:20px;border:0;padding:0"><legend>Ton activité <small>Pour te proposer des unités de travail et des risques à examiner ; rien n'est figé.</small></legend>
          <div class="choix-activite">${B.secteurs.map((s) => `<label><input type="radio" name="secteur" value="${s.id}" ${s.id === a.secteur ? 'checked' : ''}><span>${esc(s.nom)}</span></label>`).join('')}</div>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const s = secteur(a.secteur);
      const coches = new Set(a.unites ?? s.unites.map((u) => u.nom));
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes unités de travail</h1>
        <p class="intro">Coche celles qui existent chez toi. Chacune arrive avec des risques à examiner (non cotés) : tu les gardes, les modifies ou les supprimes. Tu ajouteras ensuite tes propres unités et risques.</p>
        <div class="choix-types" style="margin-top:16px">${s.unites.map((u) => `<fieldset class="groupe-types"><legend>${esc(B.typesUnite.find((x) => x.id === u.type)?.nom)}</legend><label class="case"><input type="checkbox" name="unites" value="${esc(u.nom)}" ${coches.has(u.nom) ? 'checked' : ''}><span>${esc(u.nom)}<small class="mention-type">${u.risques.length ? u.risques.map(([f]) => esc(R.famille(f).nom)).join(' · ') : 'Risques à ajouter toi-même'}</small></span></label></fieldset>`).join('')}</div>
        <p class="aide" style="max-width:720px;margin-top:16px">Ces propositions aident à démarrer ; elles ne disent pas quels risques existent dans ton entreprise. Observe le travail réel et demande l'avis des salariés concernés.</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon document unique</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['nom', 'effectif']) $(`#${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
    document.querySelectorAll('[name=secteur]').forEach((el) => el.addEventListener('change', () => { accueil.secteur = el.value; accueil.unites = null; }));
    document.querySelectorAll('[name=unites]').forEach((el) => el.addEventListener('change', () => { accueil.unites = [...document.querySelectorAll('[name=unites]:checked')].map((x) => x.value); }));
  }

  function lireEffectif(v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    return /^\d{1,5}$/.test(s) ? Number(s) : NaN;
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    const eff = lireEffectif(a.effectif);
    E.entreprise = R.normaliserEntreprise({ nom: a.nom, effectif: Number.isNaN(eff) ? null : eff, secteur: a.secteur });
    const n = R.creerDepuisSecteur(E, a.secteur, a.unites ?? secteur(a.secteur).unites.map((u) => u.nom), uid);
    if (!E.unites.length) E.unites.push(R.normaliserUnite({ id: uid(), nom: 'Activité principale', type: 'activite' }));
    accueil = nouvelAccueil();
    vue = 'evaluation';
    sauver();
    demarrer();
    toast(n ? `Document créé avec ${pluriel(E.unites.length, 'unité')} et ${pluriel(n, 'risque')} à examiner : cote-les un par un.` : 'Document créé : ajoute tes risques.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    evaluation: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    actions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="8" height="4" fill="currentColor"/></svg>',
    document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2h10l4 4v16H5z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="10" width="8" height="2" fill="currentColor"/><rect x="8" y="14" width="8" height="2" fill="currentColor"/></svg>',
    versions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 3h16v18H4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="7" width="8" height="2" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="#B84A34"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#E8B93A" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#B84A34" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#2E5A88" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Bord'], ['evaluation', 'Évaluation'], ['actions', 'Actions'], ['document', 'Document'], ['versions', 'Versions']];
  const VUES = [...ONGLETS.map(([id]) => id), 'guide'];
  const sp = B.sources.sp, inrs = B.sources.inrs, ed = B.sources.ed840;
  const AVERTISSEMENT = `<p class="mention avertissement">Outil d'aide à l'évaluation : il ne remplace ni un préventeur (SPST, Carsat, intervenant en prévention) ni un conseil juridique. Obligations résumées d'après ${esc(sp.court)} (${esc(sp.maj)}) et l'INRS (${esc(inrs.maj)}), consultés le ${esc(sp.consulte)} : vérifie qu'elles n'ont pas changé et qu'elles s'appliquent à ton cas.</p>`;
  const COUL_PRIO = { 1: 'rouge', 2: 'jaune', 3: 'ciel' };
  const etiquettePrio = (c) => (c.aCoter ? '<span class="etiquette rose">À coter</span>' : `<span class="etiquette ${COUL_PRIO[c.priorite]}">Priorité ${c.priorite}</span>`);
  const COUL_ACTION = { retard: 'rouge', proche: 'jaune', 'en-cours': 'ciel', 'a-faire': 'sable', faite: 'vert', abandonnee: 'sable' };
  const etiquetteAction = (st) => `<span class="etiquette ${COUL_ACTION[st]}">${R.LIB_ACTION[st]}</span>`;
  const libType = (id) => B.typesMesure.find((t) => t.id === id)?.nom || '';
  const libMotif = (id) => B.motifs.find((m) => m.id === id)?.nom || '';
  const libTypeUnite = (id) => B.typesUnite.find((t) => t.id === id)?.nom || '';
  const libTranche = (eff) => (eff === null ? 'effectif à renseigner' : `${pluriel(eff, 'salarié')}`);
  const cot = (g, p) => (g && p ? `${g} × ${p} = <b>${g * p}</b>` : '–');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Document<br>unique</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Obligations et sources" title="Obligations et sources">${ICONES.guide}</button>
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
    const titres = { ...Object.fromEntries(ONGLETS), tableau: 'Tableau de bord', evaluation: 'Évaluation des risques', actions: 'Plan d\'actions', guide: 'Obligations et sources' };
    document.title = `${titres[vue]} · Document unique`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, evaluation: vueEvaluation, actions: vueActions, document: vueDocument, versions: vueVersions, guide: vueGuide }[vue]();
    for (const [sel, cle] of [['#recherche', 'q'], ['#recherche-act', 'qa']]) {
      const q = $(sel);
      if (q) q.addEventListener('input', (e) => { filtre[cle] = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $(sel); n.focus(); n.setSelectionRange(pos, pos); });
    }
    $('#filtre-unite')?.addEventListener('change', (e) => { filtre.unite = e.target.value; rendre(); });
    $('#doc-version')?.addEventListener('change', (e) => { filtre.version = e.target.value; rendre(); });
    $('#prog-annee')?.addEventListener('change', (e) => { filtre.annee = Number(e.target.value); rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="40" height="56" fill="#2E5A88"/><rect x="44" y="56" width="40" height="40" fill="#E8B93A"/><path d="M44 50 L64 14 L84 50 Z" fill="#E58C74"/></svg>';
  const optionsUnites = (choisi, tous = true) => `${tous ? '<option value="">Toutes les unités</option>' : ''}${E.unites.map((u) => `<option value="${u.id}" ${u.id === choisi ? 'selected' : ''}>${esc(u.nom)}</option>`).join('')}`;

  // ---------- Matrice gravité × probabilité ----------
  // Lignes : gravité (la plus forte en haut) ; colonnes : probabilité. Chaque case affiche le nombre de
  // risques (cotation résiduelle) et sa priorité écrite (la couleur ne porte pas seule le sens).
  function vueMatrice(grille, m, titre = 'Risques par cotation résiduelle') {
    const G = grille.gravite.length, P = grille.probabilite.length;
    const lignes = [];
    for (let g = G; g >= 1; g--) {
      lignes.push(`<tr><th scope="row" title="${esc(grille.gravite[g - 1])}">G${g}</th>${Array.from({ length: P }, (_, i) => {
        const p = i + 1; const pr = R.priorite(g * p, grille); const n = m[g - 1][p - 1];
        return `<td class="mx-p${pr}${n ? '' : ' vide'}" title="Gravité ${g} × probabilité ${p} = ${g * p} · priorité ${pr} · ${pluriel(n, 'risque')}"><b>${n || ''}</b><small>P${pr}</small></td>`;
      }).join('')}</tr>`);
    }
    return `<table class="matrice"><caption class="sr-only">${esc(titre)} : gravité en lignes, probabilité en colonnes</caption><tbody>${lignes.join('')}</tbody><tfoot><tr><td></td>${Array.from({ length: P }, (_, i) => `<th scope="col" title="${esc(grille.probabilite[i])}">P${i + 1}</th>`).join('')}</tr></tfoot></table>
      <p class="legende-etat"><i class="mx-p1"></i>Priorité 1 <i class="mx-p2"></i>Priorité 2 <i class="mx-p3"></i>Priorité 3 · G = gravité, P = probabilité (en colonnes)</p>`;
  }

  // ---------- Tableau de bord ----------
  function ligneAlerte(a) {
    const pastille = a.date ? `<b>${versDate(a.date).getDate()}</b>${fmt(a.date, { month: 'short' })}` : `<b>${{ retard: '!', proche: '!', info: 'i' }[a.niveau]}</b>`;
    const bouton = {
      maj: '<button class="btn petit" data-action="archiver">Archiver une version</button>',
      version: '<button class="btn petit" data-action="archiver">Archiver</button>',
      evenement: '<button class="btn petit" data-action="archiver">Mettre à jour</button>',
      'non-archive': '<button class="btn petit" data-action="archiver">Archiver</button>',
      action: `<button class="btn petit" data-action="faite" data-id="${a.id}">Faite</button>`,
      'sans-action': `<button class="btn petit" data-action="nouvelle-action" data-id="${a.id}">Ajouter une action</button>`,
      coter: '<button class="btn petit" data-action="filtre-prio" data-prio="coter">Voir</button>',
      unite: `<button class="btn petit" data-action="nouveau-risque" data-unite="${a.id}">Ajouter un risque</button>`,
      effectif: '<button class="btn petit" data-action="entreprise">Renseigner</button>',
      programme: '<button class="btn petit" data-action="vue" data-vue="actions">Voir</button>',
    }[a.genre] || '';
    const ouvrir = a.genre === 'action' ? `data-action="action" data-id="${a.id}"` : a.genre === 'sans-action' ? `data-action="ouvrir-risque" data-id="${a.id}"` : a.genre === 'evenement' ? 'data-action="vue" data-vue="versions"' : '';
    return `<li class="alerte-${a.niveau}"><span class="date-pastille ${a.niveau}">${pastille}</span>${ouvrir ? `<button class="lien-ligne" ${ouvrir}><b>${esc(a.titre)}</b><span>${esc(a.detail)}</span></button>` : `<div class="lien-ligne"><b>${esc(a.titre)}</b><span>${esc(a.detail)}</span></div>`}${bouton}</li>`;
  }

  function vueTableau() {
    const t = auj();
    const ent = E.entreprise;
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${ent.nom ? `${esc(ent.nom)} · ` : ''}${libTranche(ent.effectif)}. Les risques prioritaires, les actions à mener et la prochaine mise à jour.</p></div>
        <div class="actions"><button class="btn" data-action="nouveau-risque">${ICONES.plus}Ajouter un risque</button><button class="btn primaire" data-action="archiver">Archiver une version</button></div></div>`;
    const s = R.synthese(E, t);
    const pm = R.prochaineMaj(E, t);
    const al = R.alertes(E, t);
    const tuiles = [
      ['Priorité 1', String(s.parPrio[1]), s.parPrio[1] ? `${s.sansAction ? `${s.sansAction} sans action · ` : ''}${pluriel(s.parPrio[2], 'risque')} en priorité 2` : `${pluriel(s.parPrio[2], 'risque')} en priorité 2`, 'var(--rouge)', 'rond'],
      ['Actions en retard', String(s.enRetard), `${pluriel(s.ouvertes, 'action ouverte', 'actions ouvertes')} · ${euros(s.coutPrevu)} prévus`, 'var(--jaune)', ''],
      ['Prochaine mise à jour', pm.date ? dateCourte(pm.date) : 'À archiver', pm.date ? `${pm.obligatoire ? 'obligatoire' : 'conseillée'} · ${dans(pm.jours)}` : 'aucune version datée', 'var(--rose-fort)', ''],
      ['Actions réalisées', s.tauxFaites === null ? '–' : `${s.tauxFaites} %`, `${pluriel(s.faites, 'action')} · ${pluriel(s.reduits, 'risque réduit', 'risques réduits')}`, 'var(--bleu)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const pu = R.parUnite(E, t);
    const obl = R.obligations(ent.effectif).filter((o) => ['maj-annuelle', 'programme', 'liste-actions', 'spst-cse'].includes(o.id));
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Alertes <span>Mise à jour, actions, risques à traiter</span></h2>
          ${al.length ? `<ul class="prochains alertes">${al.slice(0, 9).map(ligneAlerte).join('')}</ul>${al.length > 9 ? `<p class="mention">${pluriel(al.length - 9, 'autre alerte')} : voir <button class="btn lien" data-action="vue" data-vue="actions">le plan d'actions</button>.</p>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune alerte</h3><p>Le document est à jour, les actions sont dans les temps et chaque risque élevé a son action.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Matrice des risques <span>${pluriel(s.risques, 'risque')} · ${s.aCoter} à coter</span></h2>
          <div class="graphique">${vueMatrice(E.grille, R.matrice(E))}</div>
          <h2 class="titre-section">Par unité de travail</h2>
          <div class="sites-bord">${pu.map((x) => `<button class="site-carte" data-action="voir-unite" data-id="${x.unite.id}">
            <b>${esc(x.unite.nom)}</b>
            <span class="barre-etat" aria-hidden="true">${[['1', 'p1'], ['2', 'p2'], ['3', 'p3'], ['coter', 'coter']].map(([k, c]) => (x.n[k] ? `<i class="be-${c}" style="flex:${x.n[k]}"></i>` : '')).join('')}</span>
            <span class="site-chiffres">${x.nb ? `${pluriel(x.nb, 'risque')} · ${x.n[1] ? `<em class="txt-retard">${x.n[1]} en priorité 1</em> · ` : ''}${x.n.coter ? `${x.n.coter} à coter · ` : ''}${pluriel(x.ouvertes, 'action ouverte', 'actions ouvertes')}${x.retard ? ` dont ${x.retard} en retard` : ''}` : 'Aucun risque évalué'}</span>
          </button>`).join('')}</div>
          <p class="legende-etat"><i class="be-p1"></i>Priorité 1 <i class="be-p2"></i>Priorité 2 <i class="be-p3"></i>Priorité 3 <i class="be-coter"></i>À coter</p>
        </section>
      </div>
      <h2 class="titre-section">Avec ${libTranche(ent.effectif)} <span>Obligations clés, ${esc(sp.court)} (${esc(sp.maj)})</span></h2>
      <ul class="obligations-courtes">${(ent.effectif === null ? [{ titre: 'Renseigne l\'effectif', texte: 'Mise à jour annuelle dès 11 salariés, programme annuel de prévention dès 50.' }] : obl).map((o) => `<li><b>${esc(o.titre)}</b><span>${esc(o.texte)}</span></li>`).join('')}</ul>
      <p class="mention"><button class="btn lien" data-action="vue" data-vue="guide">Toutes les obligations et leurs sources</button></p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Évaluation ----------
  const FILTRES_PRIO = [['toutes', 'Tous'], ['1', 'Priorité 1'], ['2', 'Priorité 2'], ['3', 'Priorité 3'], ['coter', 'À coter'], ['sans', 'P1 sans action']];
  function gardeRisque(x, f) {
    if (f === 'toutes') return true;
    if (f === 'coter') return x.c.aCoter;
    if (f === 'sans') return x.c.priorite === 1 && !R.actionsDe(E, x.r.id).some(R.ouverte);
    return String(x.c.priorite) === f;
  }
  function ligneRisque(x) {
    const { r, c } = x;
    const acts = R.actionsDe(E, r.id);
    const ouvertes = acts.filter(R.ouverte);
    const t = auj();
    const retard = ouvertes.filter((a) => R.statutAction(a, t, E.reglages.alerteJours) === 'retard').length;
    const tags = [etiquettePrio(c)];
    if (ouvertes.length) tags.push(`<span class="etiquette ${retard ? 'rouge' : 'ciel'}">${pluriel(ouvertes.length, 'action')}${retard ? ` · ${retard} en retard` : ''}</span>`);
    else if (c.priorite === 1) tags.push('<span class="etiquette rose">Sans action</span>');
    if (c.resSaisi && c.reduction > 0) tags.push(`<span class="etiquette vert">Réduit de ${c.reduction}</span>`);
    const classe = c.priorite === 1 ? 'alerte-depasse' : c.aCoter || c.priorite === 2 ? 'alerte-proche' : '';
    return `<li class="ligne-fac ${classe}">
      <button class="ligne-info" data-action="ouvrir-risque" data-id="${r.id}">
        <b>${esc(R.nomRisque(r))}</b>
        <span class="ligne-detail">${esc(R.famille(r.famille).nom)}${r.exposes ? ` · ${pluriel(r.exposes, 'personne exposée', 'personnes exposées')}` : ''}${r.mesures ? ` · En place : ${esc(r.mesures.length > 90 ? `${r.mesures.slice(0, 88)}…` : r.mesures)}` : ''}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout">${c.aCoter ? '<b>À coter</b><small>gravité × probabilité</small>' : `<b>${c.residuel}</b><small>${c.resSaisi ? `initial ${c.initial} → résiduel ${c.residuel}` : (r.mesures ? `résiduel non recoté (score ${c.initial})` : `score ${c.initial}, sans mesure notée`)}</small>`}</span>
        <button class="btn petit" data-action="${c.aCoter ? 'risque' : 'nouvelle-action'}" data-id="${r.id}">${c.aCoter ? 'Coter' : 'Action'}</button>
      </div>
    </li>`;
  }

  function vueEvaluation() {
    const titre = `<div class="vue-tete"><div><h1>Évaluation des risques</h1><p>Les risques de chaque unité de travail, cotés gravité × probabilité, avant et après les mesures en place.</p></div>
      <div class="actions"><button class="btn" data-action="unites">Unités de travail</button><button class="btn primaire" data-action="nouveau-risque">${ICONES.plus}Ajouter un risque</button></div></div>`;
    if (!E.unites.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune unité de travail</h3><p>Une unité regroupe des salariés exposés aux mêmes risques : un poste (« Menuisier d'atelier »), un lieu (« Entrepôt ») ou une activité (« Livraisons »).</p><div class="actions"><button class="btn primaire" data-action="unite">${ICONES.plus}Ajouter une unité</button></div></div></div>`;
    if (filtre.unite && !unite(filtre.unite)) filtre.unite = '';
    const tous = R.risquesCotes(E).filter((x) => !filtre.unite || x.r.unite === filtre.unite);
    const q = filtre.q.trim().toLowerCase();
    const cherche = (x) => !q || [x.r.danger, x.r.consequences, x.r.mesures, R.famille(x.r.famille).nom].join(' ').toLowerCase().includes(q);
    const liste = tous.filter((x) => gardeRisque(x, filtre.prio) && cherche(x)).sort(R.ordreRisques);
    const groupes = E.unites.filter((u) => !filtre.unite || u.id === filtre.unite).map((u) => ({ u, lignes: liste.filter((x) => x.r.unite === u.id), total: tous.filter((x) => x.r.unite === u.id).length }));
    const montrer = groupes.filter((g) => g.lignes.length || (filtre.prio === 'toutes' && !q));
    return `${titre}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Priorité">${FILTRES_PRIO.map(([f, l]) => `<button class="filtre" data-action="filtre-prio" data-prio="${f}" aria-pressed="${filtre.prio === f}">${l} <small>${tous.filter((x) => gardeRisque(x, f) && cherche(x)).length}</small></button>`).join('')}</div>
        <div class="rang-recherche">
          ${E.unites.length > 1 ? `<label class="champ"><span class="sr-only">Unité de travail</span><select id="filtre-unite">${optionsUnites(filtre.unite)}</select></label>` : ''}
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher…" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      ${montrer.length ? montrer.map((g) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(g.u.nom)} <span>${esc(libTypeUnite(g.u.type))}${g.u.effectif !== null ? ` · ${pluriel(g.u.effectif, 'personne')}` : ''} · ${pluriel(g.total, 'risque')}</span><button class="btn petit" data-action="unite" data-id="${g.u.id}">Modifier</button><button class="btn petit" data-action="nouveau-risque" data-unite="${g.u.id}">${ICONES.plus}Risque</button></h2>
        ${g.lignes.length ? `<ul class="lignes-fac">${g.lignes.map(ligneRisque).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucun risque évalué</h3><p>Observe le travail dans cette unité et ajoute ses risques. Pistes : ${esc(suggestions(g.u).slice(0, 5).map((f) => R.famille(f).nom).join(', '))}.</p></div></div>`}</section>`).join('') : '<div class="vide-etat petit"><div><h3>Rien ne correspond</h3><p>Change de filtre ou efface la recherche.</p></div></div>'}
      ${AVERTISSEMENT}`;
  }
  // Familles à examiner pour une unité : celles du secteur pour une unité de même nom, puis les plus courantes.
  function suggestions(u) {
    const s = secteur(E.entreprise.secteur);
    const proche = s.unites.find((x) => x.nom === u.nom);
    const deja = new Set(E.risques.filter((r) => r.unite === u.id).map((r) => r.famille));
    const l = [...(proche ? proche.risques.map(([f]) => f) : []), 'PLAINPIED', 'PHYSIQUE', 'PSYCHOSOCIAUX', 'ELECTRIQUE', 'INCENDIE', 'ROUTE'];
    return [...new Set(l)].filter((f) => !deja.has(f));
  }

  // ---------- Plan d'actions ----------
  const FILTRES_ACT = [['ouvertes', 'À mener'], ['retard', 'En retard'], ['faites', 'Faites'], ['abandonnees', 'Abandonnées'], ['toutes', 'Toutes']];
  const gardeAction = (x, f) => (f === 'toutes' ? true : f === 'faites' ? x.st === 'faite' : f === 'abandonnees' ? x.st === 'abandonnee' : f === 'retard' ? x.st === 'retard' : x.st !== 'faite' && x.st !== 'abandonnee');
  function ligneAction(x) {
    const { a, st, r, u, c } = x;
    const classe = st === 'retard' ? 'alerte-depasse' : st === 'proche' ? 'alerte-proche' : st === 'faite' ? 'st-leve' : st === 'abandonnee' ? 'st-resilie' : '';
    return `<li class="ligne-fac ${classe}">
      <button class="ligne-info" data-action="action" data-id="${a.id}">
        <b>${esc(a.intitule)}</b>
        <span class="ligne-detail">${r ? esc(R.nomRisque(r)) : ''}${u ? ` · ${esc(u.nom)}` : ''}${a.responsable ? ` · ${esc(a.responsable)}` : ''}</span>
        <span class="ligne-etiquettes">${etiquetteAction(st)}${c && !c.aCoter ? etiquettePrio(c) : ''}<span class="etiquette sable">${esc(libType(a.type))}</span></span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout">${st === 'faite' ? `<b>Faite le ${dateCourte(a.faiteLe)}</b><small>${a.cout !== null ? euros(a.cout) : ''}</small>` : `<b>${a.echeance ? dateCourte(a.echeance) : 'Sans échéance'}</b><small>${a.echeance && st !== 'abandonnee' ? `${dans(R.ecart(auj(), a.echeance))}` : ''}${a.cout !== null ? ` · ${euros(a.cout)}` : ''}</small>`}</span>
        ${st === 'faite' || st === 'abandonnee' ? '' : `<button class="btn petit" data-action="faite" data-id="${a.id}">Faite</button>`}
      </div></li>`;
  }

  function vueActions() {
    const t = auj();
    const prog = R.programmeObligatoire(E.entreprise.effectif);
    const titre = `<div class="vue-tete"><div><h1>${prog ? 'Programme annuel de prévention' : 'Plan d\'actions'}</h1><p>${prog ? 'Dès 50 salariés : chaque mesure de l\'année avec son responsable, son échéance, son coût estimé et son indicateur de résultat.' : 'Les actions de prévention et de protection, avec responsable, échéance, coût et statut.'}</p></div>
      <div class="actions"><button class="btn" data-action="csv-actions">Exporter (CSV)</button><button class="btn primaire" data-action="nouvelle-action">${ICONES.plus}Ajouter une action</button></div></div>`;
    if (!E.risques.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun risque pour l'instant</h3><p>Chaque action se rattache à un risque évalué : commence par l'évaluation.</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="evaluation">Aller à l'évaluation</button></div></div></div>`;
    if (filtre.unite && !unite(filtre.unite)) filtre.unite = '';
    const tous = R.planActions(E, t).filter((x) => !filtre.unite || x.u?.id === filtre.unite);
    const q = filtre.qa.trim().toLowerCase();
    const cherche = (x) => !q || [x.a.intitule, x.a.responsable, x.a.indicateur, x.r?.danger].join(' ').toLowerCase().includes(q);
    const liste = tous.filter((x) => gardeAction(x, filtre.act) && cherche(x));
    const s = R.synthese(E, t);
    const annees = [...new Set(E.actions.filter((a) => a.echeance).map((a) => Number(a.echeance.slice(0, 4))))].sort();
    const annee = filtre.annee || Number(t.slice(0, 4));
    if (!annees.includes(annee)) annees.push(annee);
    const pg = R.programme(E, annee);
    return `${titre}
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">À mener</p><b>${s.ouvertes}</b><span>${s.enRetard} en retard</span></div>
        <div class="tuile rond" style="--c:var(--rose-fort)"><p class="surtitre">Coût prévu</p><b>${euros(s.coutPrevu)}</b><span>actions ouvertes, estimations saisies</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Réalisé</p><b>${euros(s.coutRealise)}</b><span>${pluriel(s.faites, 'action faite', 'actions faites')}</span></div>
      </div>
      <div class="bandeau-inventaire programme-annee"><b>Année ${annee}</b><span>${pluriel(pg.actions.length, 'action')} à échéance dans l'année · ${euros(pg.cout)} estimés${pg.sansCout ? ` · ${pg.sansCout} sans coût` : ''}${prog && pg.sansIndicateur ? ` · ${pg.sansIndicateur} sans indicateur` : ''}</span>
        <label class="champ"><span class="sr-only">Année</span><select id="prog-annee">${annees.sort().map((a) => `<option ${a === annee ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
      <div class="outils-liste" style="margin-top:16px">
        <div class="filtres" role="group" aria-label="Statut">${FILTRES_ACT.map(([f, l]) => `<button class="filtre" data-action="filtre-act" data-statut="${f}" aria-pressed="${filtre.act === f}">${l} <small>${tous.filter((x) => gardeAction(x, f) && cherche(x)).length}</small></button>`).join('')}</div>
        <div class="rang-recherche">
          ${E.unites.length > 1 ? `<label class="champ"><span class="sr-only">Unité de travail</span><select id="filtre-unite">${optionsUnites(filtre.unite)}</select></label>` : ''}
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-act" type="search" placeholder="Rechercher…" value="${esc(filtre.qa)}"></label>
        </div>
      </div>
      ${liste.length ? `<ul class="lignes-fac">${liste.map(ligneAction).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>${E.actions.length ? 'Rien dans ce filtre' : 'Aucune action'}</h3><p>${E.actions.length ? 'Change de filtre ou efface la recherche.' : 'Ajoute une action à chaque risque de priorité 1, puis aux autres : supprimer le danger, protéger collectivement, organiser, protéger individuellement, former.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Document imprimable ----------
  // Construit à partir de l'état courant (version de travail) ou de l'instantané d'une version archivée.
  function documentHtml(src, v, t) {
    const S = { ...src, reglages: E.reglages, evenements: [], versions: [] };
    const ent = src.entreprise;
    const prog = R.programmeObligatoire(ent.effectif);
    const versions = E.versions.filter((x) => !v || x.numero <= v.numero).sort((a, b) => b.numero - a.numero);
    const dateRef = v ? v.date : t;
    const rc = R.risquesCotes(S);
    const plan = R.planActions(S, dateRef).filter((x) => x.st !== 'abandonnee');
    const g = src.grille;
    const titres = ['Cadre de l\'évaluation', 'Méthode et grille de cotation', 'Inventaire des risques par unité de travail', prog ? 'Programme annuel de prévention' : 'Plan d\'actions de prévention', 'Historique des mises à jour', 'Accès au document et conservation', 'Annexe : exposition aux facteurs de risques professionnels'];
    const totalCout = plan.filter((x) => x.st !== 'faite').reduce((s, x) => s + (x.a.cout || 0), 0);
    return `<article class="du">
      <header class="du-garde">
        <p class="surtitre">Document unique d'évaluation des risques professionnels</p>
        <h2>${esc(ent.nom) || 'Entreprise'}</h2>
        <p>${[ent.activite, ent.adresse].filter(Boolean).map(esc).join(' · ')}</p>
        <dl class="du-meta">
          <div><dt>Version</dt><dd>${v ? `n° ${v.numero} du ${dateLongue(v.date)}` : `de travail, éditée le ${dateLongue(t)} (non archivée)`}</dd></div>
          <div><dt>Effectif</dt><dd>${ent.effectif === null ? 'À renseigner' : pluriel(ent.effectif, 'salarié')}</dd></div>
          <div><dt>Responsable</dt><dd>${esc(ent.responsable) || '–'}</dd></div>
          <div><dt>Contenu</dt><dd>${pluriel(src.unites.length, 'unité')} de travail · ${pluriel(rc.length, 'risque')} · ${pluriel(plan.length, 'action')}</dd></div>
        </dl>
        <nav class="du-sommaire" aria-label="Sommaire"><p class="surtitre">Sommaire</p><ol>${titres.map((x, i) => `<li><a href="#du-${i + 1}">${esc(x)}</a></li>`).join('')}</ol></nav>
      </header>

      <section id="du-1" class="du-section"><h3>1. ${titres[0]}</h3>
        <p>${esc(ent.nom) || 'L\'entreprise'}${ent.activite ? ` (${esc(ent.activite)})` : ''} emploie ${ent.effectif === null ? 'un effectif à préciser' : pluriel(ent.effectif, 'salarié')}. L'évaluation a été menée par unité de travail${ent.participants ? `, avec : ${esc(ent.participants)}` : ''}.</p>
        <div class="defile"><table class="tableau du-table"><thead><tr><th>Unité de travail</th><th>Type</th><th>Description</th><th class="nb">Personnes</th><th class="nb">Risques</th></tr></thead>
        <tbody>${src.unites.map((u) => `<tr><td><b>${esc(u.nom)}</b></td><td>${esc(libTypeUnite(u.type))}</td><td>${esc(u.description) || '–'}</td><td class="nb">${u.effectif ?? '–'}</td><td class="nb">${rc.filter((x) => x.r.unite === u.id).length}</td></tr>`).join('') || '<tr><td colspan="5">Aucune unité de travail.</td></tr>'}</tbody></table></div>
      </section>

      <section id="du-2" class="du-section"><h3>2. ${titres[1]}</h3>
        <p>Chaque risque est coté par sa gravité (G) et sa probabilité (P), de 1 à ${g.gravite.length} et de 1 à ${g.probabilite.length}. Le score G × P est calculé deux fois : <b>initial</b>, sans tenir compte des mesures, puis <b>résiduel</b>, avec les mesures déjà en place. La priorité vient du score résiduel : priorité 1 à partir de ${g.seuils.p1}, priorité 2 à partir de ${g.seuils.p2}, priorité 3 en dessous. Grille choisie par l'entreprise.</p>
        <div class="du-grilles">
          <table class="tableau du-table"><thead><tr><th class="nb">G</th><th>Gravité</th></tr></thead><tbody>${g.gravite.map((x, i) => `<tr><td class="nb">${i + 1}</td><td>${esc(x)}</td></tr>`).join('')}</tbody></table>
          <table class="tableau du-table"><thead><tr><th class="nb">P</th><th>Probabilité</th></tr></thead><tbody>${g.probabilite.map((x, i) => `<tr><td class="nb">${i + 1}</td><td>${esc(x)}</td></tr>`).join('')}</tbody></table>
          <div>${vueMatrice(g, R.matrice(S))}</div>
        </div>
      </section>

      <section id="du-3" class="du-section"><h3>3. ${titres[2]}</h3>
        ${src.unites.map((u) => { const l = rc.filter((x) => x.r.unite === u.id).sort(R.ordreRisques); return `<h4>${esc(u.nom)}${u.effectif !== null ? ` <small>${pluriel(u.effectif, 'personne')}</small>` : ''}</h4>
        <div class="defile"><table class="tableau du-table du-risques"><thead><tr><th>Famille</th><th>Situation dangereuse et conséquences</th><th class="nb">Exposés</th><th class="nb">Initial</th><th>Mesures en place</th><th class="nb">Résiduel</th><th>Priorité</th><th>Actions prévues</th></tr></thead>
        <tbody>${l.map(({ r, c }) => `<tr class="prio-${c.priorite || 'coter'}"><td>${esc(R.famille(r.famille).nom)}</td><td><b>${esc(r.danger) || '–'}</b>${r.consequences ? `<br><small>${esc(r.consequences)}</small>` : ''}</td><td class="nb">${r.exposes ?? '–'}</td><td class="nb">${cot(r.g, r.p)}</td><td>${esc(r.mesures) || '–'}</td><td class="nb">${c.resSaisi ? cot(r.gr, r.pr) : c.initial ? `${c.initial}` : '–'}</td><td>${c.aCoter ? 'À coter' : `Priorité ${c.priorite}`}</td><td>${R.actionsDe(S, r.id).filter((a) => a.statut !== 'abandonnee').map((a) => `${esc(a.intitule)} <small>(${a.statut === 'faite' ? `faite le ${dateCourte(a.faiteLe)}` : a.echeance ? `avant le ${dateCourte(a.echeance)}` : 'à dater'})</small>`).join('<br>') || '–'}</td></tr>`).join('') || '<tr><td colspan="8">Aucun risque évalué dans cette unité.</td></tr>'}</tbody></table></div>`; }).join('')}
      </section>

      <section id="du-4" class="du-section"><h3>4. ${titres[3]}</h3>
        ${prog ? '<p>Mesures de l\'année avec leurs conditions d\'exécution, indicateurs de résultat, coût estimé et calendrier ; programme présenté au CSE.</p>' : '<p>Liste des actions de prévention et de protection décidées à la suite de l\'évaluation.</p>'}
        <div class="defile"><table class="tableau du-table"><thead><tr><th>Action</th><th>Risque · unité</th><th>Type de mesure</th><th>Responsable</th><th class="nb">Échéance</th><th class="nb">Coût estimé</th>${prog ? '<th>Indicateur de résultat</th>' : ''}<th>Statut</th></tr></thead>
        <tbody>${plan.map(({ a, st, r, u }) => `<tr><td><b>${esc(a.intitule)}</b></td><td>${r ? esc(R.nomRisque(r)) : ''}${u ? `<br><small>${esc(u.nom)}</small>` : ''}</td><td>${esc(libType(a.type))}</td><td>${esc(a.responsable) || '–'}</td><td class="nb">${a.echeance ? dateCourte(a.echeance) : '–'}</td><td class="nb">${a.cout === null ? '–' : euros(a.cout)}</td>${prog ? `<td>${esc(a.indicateur) || '–'}</td>` : ''}<td>${st === 'faite' ? `Faite le ${dateCourte(a.faiteLe)}` : R.LIB_ACTION[st]}</td></tr>`).join('') || `<tr><td colspan="${prog ? 8 : 7}">Aucune action.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="5">Coût estimé des actions restant à mener</td><td class="nb">${euros(totalCout)}</td><td colspan="${prog ? 2 : 1}"></td></tr></tfoot></table></div>
      </section>

      <section id="du-5" class="du-section"><h3>5. ${titres[4]}</h3>
        <div class="defile"><table class="tableau du-table"><thead><tr><th class="nb">Version</th><th class="nb">Date</th><th>Motif</th><th>Modifications</th><th>Participants</th></tr></thead>
        <tbody>${versions.map((x) => `<tr><td class="nb">${x.numero}</td><td class="nb">${dateCourte(x.date)}</td><td>${esc(libMotif(x.motif))}</td><td>${esc(x.resume)}</td><td>${esc(x.participants) || '–'}</td></tr>`).join('') || '<tr><td colspan="5">Aucune version archivée.</td></tr>'}</tbody></table></div>
      </section>

      <section id="du-6" class="du-section"><h3>6. ${titres[5]}</h3>
        <p>${esc(ent.acces) || 'À compléter : où et comment les salariés, anciens salariés, le CSE, le service de prévention et de santé au travail, l\'inspection du travail et la Carsat peuvent consulter ce document. Ces modalités sont affichées sur les lieux de travail.'}</p>
        <p>Chaque version est conservée 40 ans à compter de son élaboration${v ? ` : celle-ci jusqu'au ${dateLongue(R.conservationJusquau(v.date))}` : ''}.</p>
      </section>

      <section id="du-7" class="du-section"><h3>7. ${titres[6]}</h3>
        <p>${esc(ent.annexe) || 'À compléter : données collectives utiles à l\'évaluation des expositions aux facteurs de risques professionnels (Code du travail, art. L4161-1) et proportion de salariés exposés au-delà des seuils.'}</p>
      </section>
      <p class="mention du-pied">Document établi par l'employeur avec un outil d'aide (QME). Familles de risques inspirées de la brochure ${esc(ed.court)} (${esc(ed.maj)}). Obligations : ${esc(sp.court)} (${esc(sp.maj)}) et ${esc(inrs.court)} (${esc(inrs.maj)}), consultés le ${esc(sp.consulte)}. Ne remplace ni un préventeur ni un conseil juridique.</p>
    </article>`;
  }

  function vueDocument() {
    const t = auj();
    if (filtre.version && !E.versions.some((x) => x.id === filtre.version)) filtre.version = '';
    const v = filtre.version ? E.versions.find((x) => x.id === filtre.version) : null;
    const src = v?.contenu ? R.normaliser(v.contenu) : E;
    const nv = R.derniereVersion(E) ? R.modificationsNonArchivees(E) : null;
    return `<div class="vue-tete"><div><h1>Document</h1><p>Le document unique complet : sommaire, cadre et méthode, inventaire par unité, plan d'actions, historique. À imprimer ou à enregistrer en PDF.</p></div>
        <div class="actions"><button class="btn" data-action="entreprise">Informations</button><button class="btn" data-action="csv-risques">Risques (CSV)</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <div class="outils-liste">
        <label class="champ" style="max-width:420px;width:100%">Version affichée<select id="doc-version"><option value="">Version de travail (aujourd'hui)</option>${E.versions.slice().reverse().map((x) => `<option value="${x.id}" ${x.id === filtre.version ? 'selected' : ''}>Version ${x.numero} du ${dateCourte(x.date)} · ${esc(libMotif(x.motif))}</option>`).join('')}</select></label>
        ${!v && nv && nv.total ? `<p class="aide">${pluriel(nv.total, 'modification')} depuis la version ${R.derniereVersion(E).numero}. <button class="btn lien" data-action="archiver">Archiver une nouvelle version</button></p>` : ''}
        ${v ? '<p class="aide">Version archivée : figée, en lecture seule. Imprime-la ou enregistre-la en PDF pour la conserver.</p>' : ''}
      </div>
      ${documentHtml(src, v, t)}`;
  }

  // ---------- Versions et mises à jour ----------
  function vueVersions() {
    const t = auj();
    const pm = R.prochaineMaj(E, t);
    const der = R.derniereVersion(E);
    const nv = R.modificationsNonArchivees(E);
    const att = R.evenementsEnAttente(E);
    const evts = E.evenements.slice().sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="vue-tete"><div><h1>Versions et mises à jour</h1><p>Chaque mise à jour devient une version datée et figée, à conserver 40 ans. Les événements notés rappellent qu'une mise à jour est due.</p></div>
        <div class="actions"><button class="btn" data-action="evenement">${ICONES.plus}Noter un événement</button><button class="btn primaire" data-action="archiver">Archiver une version</button></div></div>
      <div class="tuiles tuiles-3">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Version en vigueur</p><b>${der ? `n° ${der.numero}` : '–'}</b><span>${der ? `du ${dateCourte(der.date)}` : 'aucune version archivée'}</span></div>
        <div class="tuile rond" style="--c:${pm.obligatoire && pm.jours !== null && pm.jours < 0 ? 'var(--rouge)' : 'var(--jaune)'}"><p class="surtitre">Prochaine mise à jour</p><b>${pm.date ? dateCourte(pm.date) : '–'}</b><span>${pm.date ? `${pm.obligatoire ? 'obligatoire (11 salariés et plus)' : `revue conseillée tous les ${E.reglages.revueMois} mois`} · ${dans(pm.jours)}` : 'archive la première version'}</span></div>
        <div class="tuile" style="--c:var(--rose-fort)"><p class="surtitre">Non archivé</p><b>${der ? nv.total : '–'}</b><span>${der ? (nv.total ? 'modifications depuis la dernière version' : 'tout est archivé') : 'tout le document'}</span></div>
      </div>
      ${att.length ? `<div class="aide alerte-maj"><b>Mise à jour à faire</b> : ${att.map((e) => `${esc(B.evenements.find((x) => x.id === e.type)?.nom)} le ${dateCourte(e.date)}${e.texte ? ` (${esc(e.texte)})` : ''}`).join(' ; ')}. Revois les risques concernés, puis archive une version.</div>` : ''}
      <h2 class="titre-section">Versions archivées <span>${pluriel(E.versions.length, 'version')}</span></h2>
      ${E.versions.length ? `<ul class="lignes-fac">${E.versions.slice().reverse().map((x) => `<li class="ligne-fac">
        <button class="ligne-info" data-action="voir-version" data-id="${x.id}"><b>Version ${x.numero} · ${dateLongue(x.date)}</b><span class="ligne-detail">${esc(libMotif(x.motif))} · ${esc(x.resume)}</span><span class="ligne-etiquettes"><span class="etiquette sable">À conserver jusqu'au ${dateCourte(R.conservationJusquau(x.date))}</span>${x === der ? '<span class="etiquette vert">En vigueur</span>' : ''}</span></button>
        <div class="ligne-droite"><button class="btn petit" data-action="voir-version" data-id="${x.id}">Voir, imprimer</button>${x === der ? `<button class="btn petit lien" data-action="suppr-version" data-id="${x.id}">Supprimer</button>` : ''}</div></li>`).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune version archivée</h3><p>Quand l'évaluation est faite, archive la première version : elle est datée, figée et reprise dans l'historique du document.</p><div class="actions"><button class="btn primaire" data-action="archiver">Archiver la première version</button></div></div></div>`}
      <h2 class="titre-section">Événements <span>Ce qui appelle une mise à jour</span></h2>
      ${evts.length ? `<ul class="journal">${evts.map((e) => `<li><span class="date-pastille ${att.includes(e) ? 'retard' : ''}"><b>${versDate(e.date).getDate()}</b>${fmt(e.date, { month: 'short' })}</span><button class="lien-ligne" data-action="evenement" data-id="${e.id}"><b>${esc(B.evenements.find((x) => x.id === e.type)?.nom)}</b><span>${esc(e.texte) || 'Sans détail'} · ${fmt(e.date, { year: 'numeric' })}${att.includes(e) ? ' · mise à jour à faire' : ' · pris en compte'}</span></button><span></span></li>`).join('')}</ul>` : '<p class="mention">Aucun événement noté. Note ici un accident, un aménagement important ou une information nouvelle sur un risque : l\'outil rappelle la mise à jour jusqu\'à la prochaine version.</p>'}
      <p class="aide" style="margin-top:20px">Conservation : l'outil garde toutes les versions avec tes données, mais il n'est pas un archivage légal. Imprime ou enregistre chaque version en PDF et range-la avec tes documents de l'entreprise.</p>
      ${AVERTISSEMENT}`;
  }

  // ---------- Guide : obligations et sources ----------
  function vueGuide() {
    const eff = E.entreprise.effectif;
    const src = (ids) => ids.map((id) => `<a href="${esc(B.sources[id].url)}" target="_blank" rel="noopener">${esc(B.sources[id].court)}</a>`).join(', ');
    const pour = (o) => (o.min && o.max ? `${o.min} à ${o.max}` : o.min ? `${o.min} et plus` : o.max ? `moins de ${o.max + 1}` : 'Toutes');
    const applicable = (o) => eff === null || ((o.min === undefined || eff >= o.min) && (o.max === undefined || eff <= o.max));
    return `
      <div class="vue-tete"><div><h1>Obligations et sources</h1><p>Ce que demande le Code du travail selon l'effectif, d'où viennent ces informations, et ce que l'outil ne fait pas.</p></div></div>
      <h2 class="titre-section">Sources <span>Consultées le ${esc(sp.consulte)}</span></h2>
      <ul class="limites">${Object.values(B.sources).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.titre)}</a>, ${esc(s.maj)}, consultée le ${esc(s.consulte)}.</li>`).join('')}</ul>
      <p class="mention" style="margin-top:8px">Les articles du Code du travail sont ceux cités par ces pages ; lis-les sur Légifrance pour le texte en vigueur. À revérifier au moins une fois par an.</p>
      <h2 class="titre-section">Obligations <span>${eff === null ? 'Renseigne l\'effectif pour voir celles qui te concernent' : `En surbrillance : celles qui s'appliquent à ${pluriel(eff, 'salarié')}`}</span></h2>
      <div class="defile"><table class="tableau guide-table"><thead><tr><th>Obligation</th><th>Effectif</th><th>Textes cités</th><th>Source</th></tr></thead>
        <tbody>${B.obligations.map((o) => `<tr class="${applicable(o) && eff !== null ? 'applicable' : ''}"><td><b>${esc(o.titre)}</b><br><small>${esc(o.texte)}</small></td><td>${pour(o)}</td><td><small>${esc(o.articles)}</small></td><td><small>${src(o.sources)}</small></td></tr>`).join('')}</tbody></table></div>
      <h2 class="titre-section">Comment l'outil calcule</h2>
      <ul class="limites">
        <li><b>Cotation</b> : gravité × probabilité selon ta grille (réglable dans Réglages : 3 à 5 niveaux par axe, libellés et seuils de priorité). Le mode d'appréciation est choisi par l'entreprise, idéalement avec les salariés (INRS ED 840).</li>
        <li><b>Risque résiduel</b> : la cotation avec les mesures en place ; sans saisie, il est égal au risque initial. La priorité se calcule sur le résiduel. Quand tu marques une action faite, l'outil te propose de recoter le résiduel.</li>
        <li><b>Mise à jour</b> : dès ${B.seuils.annuel} salariés, un an après la dernière version (obligation) ; en dessous, une revue conseillée tous les ${E.reglages.revueMois} mois (réglage, pas une obligation). Tout événement noté après la dernière version appelle une mise à jour.</li>
        <li><b>Programme annuel</b> : dès ${B.seuils.programme} salariés, la vue Actions devient « Programme annuel de prévention » et signale les actions sans échéance, coût ou indicateur.</li>
      </ul>
      <h2 class="titre-section">Familles de risques <span>Inspirées de ${esc(ed.court)} (${esc(ed.maj)}), reformulées</span></h2>
      <div class="defile"><table class="tableau guide-table"><thead><tr><th>Famille</th><th>Exemples de situations</th><th>Exemples de mesures</th></tr></thead>
        <tbody>${B.familles.filter((f) => f.code !== 'AUTRE').map((f) => `<tr><td><b>${esc(f.nom)}</b><br><small>${esc(f.detail)}</small></td><td><small>${f.situations.map(esc).join(' ; ')}</small></td><td><small>${f.mesures.map(esc).join(' ; ')}</small></td></tr>`).join('')}</tbody></table></div>
      <h2 class="titre-section">Limites</h2>
      <ul class="limites">
        <li><b>Pas un préventeur</b> : l'outil structure la démarche ; il ne dit pas quels risques existent chez toi. Le service de prévention et de santé au travail et la Carsat peuvent t'accompagner.</li>
        <li><b>Pas d'archivage légal</b> : garde une copie imprimée ou PDF de chaque version.</li>
        <li><b>Pas de calcul des expositions</b> aux facteurs de risques professionnels : l'annexe se remplit à la main.</li>
        <li><b>Pas d'envoi</b> : la transmission au SPST et la consultation du CSE se font hors de l'outil.</li>
      </ul>
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
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const listeDonnees = (id, valeurs) => `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const selectNiveau = (nom, libs, val, vide = 'Non coté') => `<select name="${nom}"><option value="">${vide}</option>${libs.map((l, i) => `<option value="${i + 1}" ${val === i + 1 ? 'selected' : ''}>${i + 1} · ${esc(l)}</option>`).join('')}</select>`;
  const entier = (v) => (v === null || v === '' ? null : Number(v));

  // Unités de travail : liste et fiche.
  function modaleUnites() {
    const corps = `
      <ul class="liste-sites">${E.unites.map((u) => `<li><div><b>${esc(u.nom)}</b><span>${esc(libTypeUnite(u.type))}${u.effectif !== null ? ` · ${pluriel(u.effectif, 'personne')}` : ''} · ${pluriel(E.risques.filter((r) => r.unite === u.id).length, 'risque')}</span></div><button type="button" class="btn petit" data-action="unite" data-id="${u.id}">Modifier</button></li>`).join('')}</ul>
      <div class="rang"><button type="button" class="btn petit primaire" data-action="unite">${ICONES.plus}Ajouter une unité</button></div>
      <p class="aide">Une unité de travail regroupe des personnes exposées aux mêmes risques : un poste ou un métier, un lieu, ou une activité. Le découpage est libre (INRS ED 840).</p>`;
    ouvrirModale('Unités de travail', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
  }

  function modaleUnite(id) {
    const u = id ? unite(id) : null;
    const v = u || { nom: '', type: 'poste', description: '', effectif: null };
    const n = u ? E.risques.filter((r) => r.unite === u.id).length : 0;
    const corps = `
      <label class="champ">Nom de l'unité<input name="nom" required maxlength="100" value="${esc(v.nom)}" placeholder="Ex. : Atelier, Vendeurs, Livraisons"></label>
      <fieldset class="champ"><legend>C'est surtout</legend><div class="choix-statut trois">${B.typesUnite.map((x) => `<label><input type="radio" name="type" value="${x.id}" ${x.id === v.type ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Description <small>Tâches, lieux, horaires particuliers.</small><textarea name="description" rows="2" maxlength="400">${esc(v.description)}</textarea></label>
      <label class="champ">Personnes concernées <small>Facultatif.</small><input name="effectif" inputmode="numeric" maxlength="5" value="${v.effectif ?? ''}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = u
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer l\'unité</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(u ? `Modifier ${esc(u.nom)}` : 'Nouvelle unité de travail', corps, pied, (fd, act) => {
      if (act === 'supprimer') {
        if (!confirm(`Supprimer « ${u.nom} »${n ? ` et ses ${pluriel(n, 'risque')} (actions comprises)` : ''} ? Les versions archivées ne changent pas.`)) { garderOuverte(); return; }
        retenir(); E = R.supprimerUnite(E, u.id);
        sauver(); rendre(); toast(`« ${u.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'unité.';
      const eff = lireEffectif(fd.get('effectif'));
      if (Number.isNaN(eff)) return 'Personnes concernées : un nombre entier.';
      retenir();
      const d = R.normaliserUnite({ id: u?.id || uid(), nom, type: fd.get('type'), description: fd.get('description'), effectif: eff });
      if (u) Object.assign(u, d); else E.unites.push(d);
      sauver(); rendre();
      toast(u ? `« ${nom} » enregistrée.` : `Unité « ${nom} » créée : ajoute ses risques.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function texteFamille(code) {
    const f = R.famille(code);
    if (f.code === 'AUTRE') return 'Risque hors des familles proposées : décris la situation dangereuse.';
    return `<b>${esc(f.nom)}</b> · ${esc(f.detail)}<br><span class="mention-type">Exemples de mesures : ${f.mesures.map(esc).join(' ; ')}. D'après ${esc(ed.court)}, reformulé.</span>`;
  }

  // Risque : création ou modification, avec cotation initiale et résiduelle.
  function modaleRisque(id, uniteId) {
    const r = id ? risque(id) : null;
    if (id && !r) return;
    if (!E.unites.length) { modaleUnite(null); return; }
    const g = E.grille;
    const u0 = unite(uniteId || filtre.unite) || E.unites[0];
    const v = r || { unite: u0.id, famille: suggestions(u0)[0] || 'AUTRE', danger: '', consequences: '', mesures: '', g: null, p: null, gr: null, pr: null, exposes: null, evalueLe: auj(), note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Unité de travail<select name="unite">${optionsUnites(v.unite, false)}</select></label>
        <label class="champ">Famille de risque<select name="famille" id="r-famille">${B.familles.map((f) => `<option value="${f.code}" ${f.code === v.famille ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}</select></label>
      </div>
      <p class="source-type" id="r-source"></p>
      <label class="champ">Situation dangereuse <small>Ce qui peut arriver, dans le travail réel.</small><input name="danger" id="r-danger" list="l-situations" maxlength="300" value="${esc(v.danger)}"></label>
      <div class="rang-champs">
        <label class="champ">Conséquences possibles<input name="consequences" maxlength="300" value="${esc(v.consequences)}" placeholder="Ex. : coupure, lombalgie, brûlure"></label>
        <label class="champ" style="flex:0 1 150px">Personnes exposées<input name="exposes" inputmode="numeric" maxlength="5" value="${v.exposes ?? ''}"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Risque initial <small>Sans tenir compte des mesures en place.</small></legend>
        <div class="rang-champs"><label class="champ">Gravité${selectNiveau('g', g.gravite, v.g)}</label><label class="champ">Probabilité${selectNiveau('p', g.probabilite, v.p)}</label></div>
        <p class="score" id="r-score-i"></p></fieldset>
      <label class="champ">Mesures déjà en place <small>Protections, consignes, formations existantes.</small><textarea name="mesures" rows="2" maxlength="600">${esc(v.mesures)}</textarea></label>
      <fieldset class="champ cadre-champs"><legend>Risque résiduel <small>Avec les mesures en place. Laisse vide s'il n'y en a pas : il reprend l'initial.</small></legend>
        <div class="rang-champs"><label class="champ">Gravité${selectNiveau('gr', g.gravite, v.gr, 'Comme l\'initial')}</label><label class="champ">Probabilité${selectNiveau('pr', g.probabilite, v.pr, 'Comme l\'initial')}</label></div>
        <p class="score" id="r-score-r"></p></fieldset>
      <div class="rang-champs">
        <label class="champ">Évalué le<input type="date" name="evalueLe" max="${auj()}" value="${v.evalueLe || auj()}"></label>
        <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="400" value="${esc(v.note)}"></label>
      </div>
      <datalist id="l-situations"></datalist>
      <p class="erreur" role="alert"></p>`;
    const pied = r
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter le risque</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(r ? 'Modifier le risque' : 'Nouveau risque', corps, pied, (fd, act) => {
      if (act === 'supprimer') {
        const n = R.actionsDe(E, r.id).length;
        if (!confirm(`Supprimer ce risque${n ? ` et ses ${pluriel(n, 'action')}` : ''} ? Les versions archivées ne changent pas.`)) { garderOuverte(); return; }
        retenir(); E = R.supprimerRisque(E, r.id);
        sauver(); rendre(); toast('Risque supprimé.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const ex = lireEffectif(fd.get('exposes'));
      if (Number.isNaN(ex)) return 'Personnes exposées : un nombre entier.';
      const famille = fd.get('famille');
      if (!String(fd.get('danger') || '').trim() && famille === 'AUTRE') return 'Décris la situation dangereuse.';
      const [gr, pr] = [entier(fd.get('gr')), entier(fd.get('pr'))];
      if ((gr && !pr) || (!gr && pr)) return 'Risque résiduel : renseigne la gravité et la probabilité, ou aucune des deux.';
      retenir();
      const d = R.normaliserRisque({ id: r?.id || uid(), unite: fd.get('unite'), famille, danger: fd.get('danger'), consequences: fd.get('consequences'), exposes: ex, g: entier(fd.get('g')), p: entier(fd.get('p')), mesures: fd.get('mesures'), gr, pr, evalueLe: fd.get('evalueLe'), note: fd.get('note') }, E.grille);
      if (r) Object.assign(r, d); else E.risques.push(d);
      sauver(); rendre();
      const c = R.cotation(d, E.grille);
      const sansAction = c.priorite === 1 && !R.actionsDe(E, d.id).some(R.ouverte);
      toast(`Risque ${r ? 'enregistré' : 'ajouté'}${c.aCoter ? ', à coter' : ` : priorité ${c.priorite}`}.${sansAction ? ' Ajoute-lui une action.' : ''}`, sansAction ? { libelle: 'Ajouter une action', faire: () => modaleAction(null, d.id) } : { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const code = d.querySelector('#r-famille').value;
      d.querySelector('#r-source').innerHTML = texteFamille(code);
      d.querySelector('#l-situations').innerHTML = R.famille(code).situations.map((x) => `<option value="${esc(x)}">`).join('');
      const val = (n) => entier(d.querySelector(`[name=${n}]`).value);
      const ci = R.score(val('g'), val('p'));
      const cr = R.score(val('gr'), val('pr')) || ci;
      d.querySelector('#r-score-i').innerHTML = ci ? `Score <b>${ci}</b> · priorité ${R.priorite(ci, E.grille)}` : 'Non coté';
      d.querySelector('#r-score-r').innerHTML = cr ? `Score <b>${cr}</b> · <b>priorité ${R.priorite(cr, E.grille)}</b>${ci && cr < ci ? ` · réduit de ${ci - cr}` : ''}` : 'Non coté';
    };
    d.querySelector('#r-famille').addEventListener('change', maj);
    d.querySelectorAll('select[name=g],select[name=p],select[name=gr],select[name=pr]').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  // Fiche d'un risque : cotations, mesures, actions.
  function modaleDetailRisque(id) {
    const r = risque(id);
    if (!r) return;
    const c = R.cotation(r, E.grille);
    const t = auj();
    const acts = R.actionsDe(E, r.id);
    const corps = `
      <div class="resume-facture">
        <div><span>Priorité</span><b>${c.aCoter ? 'À coter' : `Priorité ${c.priorite}`}</b><small>${c.aCoter ? 'gravité et probabilité à renseigner' : esc(B.priorites[c.priorite - 1].detail)}</small></div>
        <div><span>Unité de travail</span><b class="petit-b">${esc(nomUnite(r.unite))}</b><small>${r.exposes ? pluriel(r.exposes, 'personne exposée', 'personnes exposées') : 'exposés non précisés'}</small></div>
        <div><span>Risque initial</span><b>${c.initial ?? '–'}</b><small>${r.g ? `G${r.g} × P${r.p}` : 'non coté'}</small></div>
        <div><span>Risque résiduel</span><b>${c.residuel ?? '–'}</b><small>${c.resSaisi ? `G${r.gr} × P${r.pr}${c.reduction > 0 ? ` · réduit de ${c.reduction}` : ''}` : 'comme l\'initial'}</small></div>
      </div>
      <p class="mention">${esc(R.famille(r.famille).nom)}${r.evalueLe ? ` · évalué le ${dateCourte(r.evalueLe)}` : ''}</p>
      ${r.consequences ? `<p class="aide"><b>Conséquences possibles</b> : ${esc(r.consequences)}</p>` : ''}
      <p class="aide"><b>Mesures en place</b> : ${esc(r.mesures) || 'aucune notée'}</p>
      ${r.note ? `<p class="mention">${esc(r.note)}</p>` : ''}
      <section class="bloc-detail"><h3>Actions <span>${acts.length}</span></h3>
        ${acts.length ? `<ul class="mini-obs">${acts.map((a) => { const st = R.statutAction(a, t, E.reglages.alerteJours); return `<li>${etiquetteAction(st)}<button type="button" class="lien-ligne" data-action="action" data-id="${a.id}"><b>${esc(a.intitule)}</b><span>${st === 'faite' ? `faite le ${dateCourte(a.faiteLe)}` : a.echeance ? `avant le ${dateCourte(a.echeance)}` : 'sans échéance'}${a.responsable ? ` · ${esc(a.responsable)}` : ''}</span></button>${R.ouverte(a) ? `<button type="button" class="btn petit" data-action="faite" data-id="${a.id}">Faite</button>` : '<span></span>'}</li>`; }).join('')}</ul>` : '<p class="mention">Aucune action pour ce risque.</p>'}
        <div class="rang"><button type="button" class="btn petit primaire" data-action="nouvelle-action" data-id="${r.id}">${ICONES.plus}Ajouter une action</button></div>
      </section>
      <details class="tableau-details"><summary>Repères pour cette famille</summary><p class="mention">${texteFamille(r.famille)}</p></details>`;
    ouvrirModale(esc(R.nomRisque(r)), corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="risque" data-id="${r.id}">Modifier ou recoter</button>`);
  }

  // Action : création (rattachée à un risque) ou modification.
  function modaleAction(id, risqueId) {
    const a = id ? action(id) : null;
    if (id && !a) return;
    if (!E.risques.length) { toast('Ajoute d\'abord un risque.'); return; }
    const v = a || { risque: risque(risqueId) ? risqueId : E.risques[0].id, intitule: '', type: 'collective', responsable: '', echeance: ajoutMois(auj(), 3), cout: null, statut: 'a-faire', indicateur: '', note: '' };
    const prog = R.programmeObligatoire(E.entreprise.effectif);
    const corps = `
      <label class="champ">Risque traité<select name="risque" id="a-risque">${E.unites.map((u) => { const rs = E.risques.filter((r) => r.unite === u.id); return rs.length ? `<optgroup label="${esc(u.nom)}">${rs.map((r) => `<option value="${r.id}" ${r.id === v.risque ? 'selected' : ''}>${esc(R.nomRisque(r))}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
      <label class="champ">Action <small>Ce qui sera fait, concrètement.</small><input name="intitule" id="a-intitule" list="l-mesures" maxlength="300" required value="${esc(v.intitule)}"></label>
      <div class="rang-champs">
        <label class="champ">Type de mesure<select name="type">${B.typesMesure.map((x) => `<option value="${x.id}" ${x.id === v.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Responsable <small>Fonction.</small><input name="responsable" list="l-resp" maxlength="80" value="${esc(v.responsable)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Échéance<input type="date" name="echeance" value="${v.echeance || ''}"></label>
        <label class="champ">Coût estimé (€) <small>Facultatif.</small><input name="cout" inputmode="decimal" maxlength="14" value="${v.cout === null ? '' : String(v.cout / 100).replace('.', ',')}"></label>
      </div>
      <label class="champ">Indicateur de résultat <small>${prog ? 'Attendu dans le programme annuel (50 salariés et plus).' : 'Facultatif : comment savoir que c\'est réussi.'}</small><input name="indicateur" maxlength="200" value="${esc(v.indicateur)}"></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut quatre">${B.statutsAction.map((x) => `<label><input type="radio" name="statut" value="${x.id}" ${x.id === v.statut ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="400" value="${esc(v.note)}"></label>
      <datalist id="l-mesures"></datalist>
      ${listeDonnees('l-resp', E.actions.map((x) => x.responsable))}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter l\'action</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier l\'action' : 'Nouvelle action', corps, pied, (fd, act) => {
      if (act === 'supprimer') {
        if (!confirm('Supprimer cette action ? Pour une action qui ne sera pas menée, choisis plutôt « Abandonnée » : elle reste dans l\'historique.')) { garderOuverte(); return; }
        retenir(); E.actions = E.actions.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast('Action supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const intitule = String(fd.get('intitule') || '').trim();
      if (!intitule) return 'Décris l\'action.';
      const cout = R.lireMontant(fd.get('cout'));
      if (Number.isNaN(cout)) return 'Coût illisible : par exemple 1 200 ou 350,50.';
      const statut = fd.get('statut');
      const etaitFaite = a?.statut === 'faite';
      retenir();
      const d = R.normaliserAction({ id: a?.id || uid(), risque: fd.get('risque'), intitule, type: fd.get('type'), responsable: fd.get('responsable'), echeance: fd.get('echeance'), cout, statut, faiteLe: statut === 'faite' ? (a?.faiteLe || auj()) : null, indicateur: fd.get('indicateur'), note: fd.get('note'), creeLe: a?.creeLe || auj() });
      if (a) Object.assign(a, d); else E.actions.push(d);
      sauver(); rendre();
      if (statut === 'faite' && !etaitFaite) { garderOuverte(); modaleRecoter(d.risque, d.intitule); return; }
      toast(a ? 'Action enregistrée.' : 'Action ajoutée au plan.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { const r = risque(d.querySelector('#a-risque').value); d.querySelector('#l-mesures').innerHTML = R.famille(r?.famille).mesures.map((x) => `<option value="${esc(x)}">`).join(''); };
    d.querySelector('#a-risque').addEventListener('change', maj);
    maj();
  }

  // Action faite : date, puis proposition de recoter le risque résiduel.
  function modaleFaite(id) {
    const a = action(id);
    if (!a) return;
    const corps = `<p class="aide"><b>${esc(a.intitule)}</b><br>${esc(risque(a.risque) ? R.nomRisque(risque(a.risque)) : '')}</p>
      <label class="champ">Réalisée le<input type="date" name="date" required max="${auj()}" value="${auj()}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Action faite', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      const r = R.terminerAction(E, id, fd.get('date'), auj());
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      garderOuverte();
      modaleRecoter(a.risque, a.intitule);
    });
  }

  function modaleRecoter(risqueId, intitule) {
    const r = risque(risqueId);
    if (!r) { if (modale().open) modale().close(); return; }
    const g = E.grille;
    const c = R.cotation(r, g);
    const corps = `<p class="aide">« ${esc(intitule)} » est faite. Le risque <b>${esc(R.nomRisque(r))}</b> a-t-il baissé ? Recote-le avec cette mesure en place.</p>
      <p class="mention">Actuellement : initial ${c.initial ?? '–'}, résiduel ${c.residuel ?? '–'}${c.priorite ? ` (priorité ${c.priorite})` : ''}.</p>
      <div class="rang-champs"><label class="champ">Gravité résiduelle${selectNiveau('gr', g.gravite, r.gr || r.g, 'Non coté')}</label><label class="champ">Probabilité résiduelle${selectNiveau('pr', g.probabilite, r.pr || r.p, 'Non coté')}</label></div>
      <p class="score" id="rc-score"></p>
      <label class="case"><input type="checkbox" name="ajouterMesure" checked> Ajouter l'action aux mesures en place</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Recoter le risque résiduel', corps, '<button class="btn primaire" value="ok">Mettre à jour la cotation</button><button class="btn" value="annuler">Plus tard</button>', (fd) => {
      const gr = entier(fd.get('gr')), pr = entier(fd.get('pr'));
      if (!gr || !pr) return 'Choisis la gravité et la probabilité.';
      retenir();
      Object.assign(r, { gr, pr, evalueLe: auj() });
      if (fd.get('ajouterMesure') && !r.mesures.includes(intitule)) r.mesures = `${r.mesures ? `${r.mesures} ; ` : ''}${intitule}`.slice(0, 600);
      sauver(); rendre();
      const n = R.cotation(r, g);
      toast(`Cotation mise à jour : résiduel ${n.residuel}, priorité ${n.priorite}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { const s = R.score(entier(d.querySelector('[name=gr]').value), entier(d.querySelector('[name=pr]').value)); d.querySelector('#rc-score').innerHTML = s ? `Score <b>${s}</b> · priorité ${R.priorite(s, g)}${c.initial && s < c.initial ? ` · réduit de ${c.initial - s} par rapport à l'initial` : ''}` : ''; };
    d.querySelectorAll('select').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  // Nouvelle version archivée.
  function modaleArchiver() {
    if (!E.unites.length) { toast('Ajoute d\'abord une unité de travail.'); return; }
    const der = R.derniereVersion(E);
    const nv = R.modificationsNonArchivees(E);
    const att = R.evenementsEnAttente(E);
    const dernierEvt = att[att.length - 1];
    const motif = dernierEvt ? ({ accident: 'accident', information: 'information' }[dernierEvt.type] || 'amenagement') : der ? 'annuelle' : 'creation';
    const aCoter = E.risques.filter((r) => !r.g || !r.p).length;
    const corps = `
      <p class="aide">${der ? `Version ${der.numero + 1}` : 'Première version'} : un instantané figé du document tel qu'il est aujourd'hui (unités, risques, cotations, actions), daté et ajouté à l'historique.${aCoter ? ` <b>${pluriel(aCoter, 'risque')} encore à coter.</b>` : ''}</p>
      <div class="rang-champs">
        <label class="champ">Date de la mise à jour<input type="date" name="date" required max="${auj()}" ${der ? `min="${der.date}"` : ''} value="${auj()}"></label>
        <label class="champ">Motif<select name="motif">${B.motifs.map((m) => `<option value="${m.id}" ${m.id === motif ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Ce qui a changé <small>Proposé d'après les modifications ; modifiable.</small><textarea name="resume" rows="3" maxlength="800">${esc(R.resumeDifferences(nv))}</textarea></label>
      <label class="champ">Participants <small>Groupe de travail, salariés consultés, SPST, CSE.</small><input name="participants" maxlength="400" value="${esc(E.entreprise.participants)}"></label>
      <p class="mention">Pense ensuite à imprimer ou enregistrer la version en PDF${R.annuelleObligatoire(E.entreprise.effectif) ? ', à la transmettre au SPST et à consulter le CSE s\'il existe' : ''}.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Archiver une version', corps, '<button class="btn primaire" value="ok">Archiver</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      const v = R.archiver(E, { date: fd.get('date'), motif: fd.get('motif'), resume: fd.get('resume'), participants: fd.get('participants') }, auj(), uid);
      if (typeof v === 'string') { annulation = null; return v; }
      sauver(); rendre();
      toast(`Version ${v.numero} archivée le ${dateCourte(v.date)}.`, { libelle: 'Voir le document', faire: () => { filtre.version = v.id; changerVue('document'); } });
    });
  }

  function modaleEvenement(id) {
    const e = id ? E.evenements.find((x) => x.id === id) : null;
    const v = e || { date: auj(), type: 'amenagement', texte: '' };
    const corps = `
      <p class="aide">Un événement noté après la dernière version déclenche une alerte « mise à jour à faire » jusqu'à la version suivante.</p>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" required max="${auj()}" value="${v.date}"></label>
        <label class="champ">Type<select name="type">${B.evenements.map((x) => `<option value="${x.id}" ${x.id === v.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Détail <small>Sans nom de personne.</small><input name="texte" maxlength="300" value="${esc(v.texte)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = e ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Noter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(e ? 'Événement' : 'Noter un événement', corps, pied, (fd, act) => {
      if (act === 'supprimer') { retenir(); E.evenements = E.evenements.filter((x) => x.id !== e.id); sauver(); rendre(); toast('Événement supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const date = fd.get('date');
      if (!R.estDate(date) || date > auj()) return 'Date illisible ou dans le futur.';
      retenir();
      const d = R.normaliserEvenement({ id: e?.id || uid(), date, type: fd.get('type'), texte: fd.get('texte') });
      if (e) Object.assign(e, d); else E.evenements.push(d);
      sauver(); rendre();
      const attente = R.evenementsEnAttente(E).some((x) => x.id === d.id);
      toast(attente ? 'Événement noté : une mise à jour du document est à faire.' : 'Événement enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function supprimerVersion(id) {
    const v = E.versions.find((x) => x.id === id);
    if (!v || v !== R.derniereVersion(E)) return;
    if (!confirm(`Supprimer la version ${v.numero} du ${dateLongue(v.date)} ? À réserver à une erreur : chaque version doit être conservée 40 ans.`)) return;
    retenir();
    E.versions = E.versions.filter((x) => x.id !== id);
    if (filtre.version === id) filtre.version = '';
    sauver(); rendre();
    toast('Version supprimée.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleEntreprise() {
    const e = E.entreprise;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Entreprise<input name="nom" maxlength="100" value="${esc(e.nom)}" autocomplete="organization"></label>
        <label class="champ" style="flex:0 1 150px">Effectif salarié <small>Fixe les obligations.</small><input name="effectif" inputmode="numeric" maxlength="5" value="${e.effectif ?? ''}"></label>
      </div>
      <label class="champ">Activité<input name="activite" maxlength="160" value="${esc(e.activite)}"></label>
      <div class="rang-champs">
        <label class="champ">Secteur <small>Pour les suggestions.</small><select name="secteur">${B.secteurs.map((s) => `<option value="${s.id}" ${s.id === e.secteur ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
        <label class="champ">Responsable du document <small>Fonction.</small><input name="responsable" maxlength="100" value="${esc(e.responsable)}"></label>
      </div>
      <label class="champ">Adresse<input name="adresse" maxlength="200" value="${esc(e.adresse)}"></label>
      <label class="champ">Participants à l'évaluation <small>Fonctions, pas de noms nécessaires.</small><input name="participants" maxlength="400" value="${esc(e.participants)}"></label>
      <label class="champ">Modalités d'accès au document <small>Texte repris dans le document, à afficher sur les lieux de travail.</small><textarea name="acces" rows="3" maxlength="600" placeholder="Ex. : consultable au bureau, sur demande auprès de la direction, aux heures d'ouverture.">${esc(e.acces)}</textarea></label>
      <label class="champ">Annexe : exposition aux facteurs de risques professionnels <small>Données collectives et proportion de salariés exposés au-delà des seuils (art. L4161-1).</small><textarea name="annexe" rows="3" maxlength="1500">${esc(e.annexe)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Informations de l\'entreprise', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const eff = lireEffectif(fd.get('effectif'));
      if (Number.isNaN(eff)) return 'Effectif : un nombre entier de salariés.';
      retenir();
      const avant = E.entreprise.effectif;
      E.entreprise = R.normaliserEntreprise({ nom: fd.get('nom'), effectif: eff, activite: fd.get('activite'), secteur: fd.get('secteur'), responsable: fd.get('responsable'), adresse: fd.get('adresse'), participants: fd.get('participants'), acces: fd.get('acces'), annexe: fd.get('annexe') });
      sauver(); rendre();
      const chg = R.tranche(avant) !== R.tranche(eff) && eff !== null;
      toast(chg ? `Enregistré. Avec ${pluriel(eff, 'salarié')}, les obligations changent : voir Obligations et sources.` : 'Informations enregistrées.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleGrille() {
    const g = E.grille;
    const corps = `
      <p class="aide">Le mode d'appréciation est choisi par l'entreprise, idéalement avec les salariés (INRS ED 840). De 3 à 5 niveaux par axe, un par ligne, du plus faible au plus fort.</p>
      <label class="champ">Niveaux de gravité<textarea name="gravite" rows="5" maxlength="700">${esc(g.gravite.join('\n'))}</textarea></label>
      <label class="champ">Niveaux de probabilité<textarea name="probabilite" rows="5" maxlength="700">${esc(g.probabilite.join('\n'))}</textarea></label>
      <fieldset class="champ cadre-champs"><legend>Seuils de priorité <small>Sur le score gravité × probabilité.</small></legend>
        <div class="rang-champs"><label class="champ">Priorité 1 à partir de<input name="p1" inputmode="numeric" value="${g.seuils.p1}"></label><label class="champ">Priorité 2 à partir de<input name="p2" inputmode="numeric" value="${g.seuils.p2}"></label></div></fieldset>
      <div id="g-apercu" class="graphique"></div>
      <p class="erreur" role="alert"></p>
      <div class="rang"><button type="button" class="btn petit" id="g-defaut">Revenir à la grille proposée</button></div>`;
    const lire = (fd) => ({ gravite: String(fd.get('gravite') || '').split('\n').map((x) => x.trim()).filter(Boolean), probabilite: String(fd.get('probabilite') || '').split('\n').map((x) => x.trim()).filter(Boolean), seuils: { p1: Number(fd.get('p1')), p2: Number(fd.get('p2')) } });
    ouvrirModale('Grille de cotation', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const x = lire(fd);
      if (x.gravite.length < 3 || x.gravite.length > 5 || x.probabilite.length < 3 || x.probabilite.length > 5) return 'De 3 à 5 niveaux par axe, un par ligne.';
      const max = x.gravite.length * x.probabilite.length;
      if (!Number.isInteger(x.seuils.p1) || !Number.isInteger(x.seuils.p2) || x.seuils.p2 < 2 || x.seuils.p1 <= x.seuils.p2 || x.seuils.p1 > max) return `Seuils : priorité 2 à partir de 2 au moins, priorité 1 au-dessus, jusqu'à ${max}.`;
      retenir();
      const n = R.changerGrille(E, x);
      sauver(); rendre();
      toast(n ? `Grille enregistrée ; ${pluriel(n, 'cotation')} ramenée${n > 1 ? 's' : ''} au nouveau maximum : vérifie-les.` : 'Grille enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { const x = R.normaliserGrille(lire(new FormData(d.querySelector('form')))); d.querySelector('#g-apercu').innerHTML = vueMatrice(x, R.matrice({ ...E, grille: x }), 'Aperçu de la grille'); };
    d.querySelectorAll('textarea,input').forEach((x) => x.addEventListener('input', maj));
    d.querySelector('#g-defaut').addEventListener('click', () => { d.querySelector('[name=gravite]').value = B.grille.gravite.join('\n'); d.querySelector('[name=probabilite]').value = B.grille.probabilite.join('\n'); d.querySelector('[name=p1]').value = B.grille.seuils.p1; d.querySelector('[name=p2]').value = B.grille.seuils.p2; maj(); });
    maj();
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <div class="rang"><button type="button" class="btn petit" data-action="entreprise">Informations de l'entreprise</button><button type="button" class="btn petit" data-action="grille">Grille de cotation</button><button type="button" class="btn petit" data-action="unites">Unités de travail</button></div>
      <div class="rang-champs">
        <label class="champ">Prévenir avant une échéance (jours)<input type="number" name="alerteJours" min="7" max="120" value="${r.alerteJours}"></label>
        <label class="champ">Revue conseillée (mois) <small>Sous 11 salariés : choix de l'entreprise, pas une obligation.</small><input type="number" name="revueMois" min="3" max="36" value="${r.revueMois}"></label>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tableur (CSV, point-virgule) : inventaire des risques ou plan d'actions.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-risques">Risques (CSV)</button><button class="btn petit" type="button" data-action="csv-actions">Actions (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton document est enregistré en ligne avec ta clé, versions comprises. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du document unique, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application pendant la visite des postes de travail.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Obligations : ${esc(sp.court)} (${esc(sp.maj)}) et ${esc(inrs.court)} (${esc(inrs.maj)}), consultés le ${esc(sp.consulte)} ; à revérifier chaque année. Familles de risques inspirées de ${esc(ed.court)} (${esc(ed.maj)}), reformulées. Outil d'aide : il ne remplace ni un préventeur ni un conseil juridique.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Number(fd.get(nom)); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
      const alerteJours = ent('alerteJours', 7, 120);
      const revueMois = ent('revueMois', 3, 36);
      if (alerteJours === null) return 'Prévenir entre 7 et 120 jours avant.';
      if (revueMois === null) return 'Revue conseillée : entre 3 et 36 mois.';
      retenir();
      Object.assign(E.reglages, { alerteJours, revueMois });
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.unites) || !Array.isArray(d.risques)) throw new Error();
        if (!confirm(`Remplacer ton document actuel par cette copie (${pluriel(d.unites.length, 'unité')}, ${pluriel(d.risques.length, 'risque')}, ${pluriel((d.versions || []).length, 'version')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du document unique.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `document-unique-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const g = E.grille, rg = E.reglages;
    const blocs = [
      ['rose', 'Découpe en unités de travail', `Une unité regroupe les personnes exposées aux mêmes risques&nbsp;: un poste, un lieu ou une activité. Pour chacune, note les situations dangereuses observées dans le travail réel, leurs conséquences et les mesures déjà en place. Les risques proposés au départ ne sont que des pistes&nbsp;: garde-les, modifie-les ou supprime-les.`],
      ['beurre', 'Cote chaque risque', `Gravité × probabilité, de 1 à ${g.gravite.length} et de 1 à ${g.probabilite.length}. Le score initial ne tient pas compte des mesures, le résiduel les prend en compte (sans saisie, il reprend l'initial). La priorité vient du résiduel&nbsp;: <b>priorité 1</b> à partir de ${g.seuils.p1}, <b>priorité 2</b> à partir de ${g.seuils.p2}, priorité 3 en dessous. La grille se règle dans les réglages.`],
      ['ciel', 'Planifie les actions', `Chaque action se rattache à un risque, avec un responsable, une échéance et un coût estimé. Elle est signalée ${pluriel(rg.alerteJours, 'jour')} avant son échéance, puis <b>en retard</b> une fois l'échéance passée. Un risque de priorité 1 sans action à mener est signalé aussi. Quand tu marques une action faite, l'outil te propose de recoter le risque résiduel.`],
      ['sable', 'Archive chaque mise à jour', `Archiver crée une version datée et figée du document, à conserver 40 ans. Dès ${B.seuils.annuel} salariés, la mise à jour est due un an après la dernière version&nbsp;; en dessous, une revue est conseillée tous les ${rg.revueMois} mois. Un événement noté après la dernière version (accident, aménagement important, information nouvelle sur un risque…) appelle aussi une mise à jour.`],
    ];
    const corps = `
      <p>L'outil calcule pour toi les priorités, tient le plan d'actions et te rappelle quand mettre le document à jour. Ton rôle&nbsp;: décrire les risques réels de chaque unité de travail, les coter, décider des actions et archiver une version à chaque mise à jour.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Bord</b> rassemble les alertes, <b>Document</b> met en page le document complet à imprimer, et <b>Obligations et sources</b> (en haut de l'écran) résume ce que demande le Code du travail selon ton effectif. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton document est enregistré en ligne avec ta clé&nbsp;: tu le retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const pied = `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied);
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
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action: act, id } = el.dataset;
    switch (act) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': {
        if (Number.isNaN(lireEffectif(accueil.effectif))) { $('#erreur-accueil').textContent = 'Effectif : un nombre entier de salariés (ou laisse vide).'; return; }
        accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      }
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'voir-unite': filtre.unite = id; filtre.prio = 'toutes'; changerVue('evaluation'); break;
      case 'voir-version': filtre.version = id; changerVue('document'); break;
      case 'suppr-version': supprimerVersion(id); break;
      case 'reglages': modaleReglages(); break;
      case 'entreprise': modaleEntreprise(); break;
      case 'grille': modaleGrille(); break;
      case 'unites': modaleUnites(); break;
      case 'unite': modaleUnite(id); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-risques': telecharger(R.versCsvRisques(E), 'text/csv;charset=utf-8', `document-unique-risques-${auj()}.csv`); break;
      case 'csv-actions': telecharger(R.versCsvActions(E, auj()), 'text/csv;charset=utf-8', `document-unique-actions-${auj()}.csv`); break;
      case 'imprimer': setTimeout(() => window.print(), 50); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-risque': modaleRisque(null, el.dataset.unite); break;
      case 'risque': modaleRisque(id); break;
      case 'ouvrir-risque': modaleDetailRisque(id); break;
      case 'nouvelle-action': modaleAction(null, id); break;
      case 'action': modaleAction(id); break;
      case 'faite': modaleFaite(id); break;
      case 'archiver': if (modale().open) modale().close(); modaleArchiver(); break;
      case 'evenement': modaleEvenement(id); break;
      case 'filtre-prio': filtre.prio = el.dataset.prio; if (vue !== 'evaluation') changerVue('evaluation'); else rendre(); break;
      case 'filtre-act': filtre.act = el.dataset.statut; rendre(); break;
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
  window.__documentUnique = { etat: () => E, regles: R };
  init();
})();
