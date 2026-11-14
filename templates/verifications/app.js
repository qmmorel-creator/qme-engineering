// Vérifications réglementaires QME : registre des contrôles par site, périodicités sourcées (INRS ED 828,
// datées) ou saisies, échéances, observations suivies jusqu'à leur levée avec preuve, registre imprimable.
// Données synchronisées par clé de licence ou code d'accès. Outil d'aide : ne remplace ni un organisme
// agréé ni la lecture des textes.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.VRF;
  const API = '/api/templates';
  const PRODUIT = 'VRF';
  const CLE_CODE = 'qme-vrf-code';
  const CLE_CACHE = 'qme-vrf-cache';
  const CLE_DEMO = 'qme-vrf-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-vrf-ecran-accueil';

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
  const lienExterne = (url, texte) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texte)}</a>` : esc(texte));
  const dans = (j) => (j === null ? '' : j === 0 ? 'aujourd\'hui' : j > 0 ? `dans ${pluriel(j, 'jour')}` : `depuis ${pluriel(-j, 'jour')}`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { statut: 'tous', site: '', q: '', obs: 'ouvertes', registre: '' };
  let annulation = null;

  const site = (id) => E.sites.find((s) => s.id === id);
  const equipement = (id) => E.equipements.find((e) => e.id === id);
  const nomSite = (id) => site(id)?.nom || 'Site supprimé';

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
        E = R.normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié le registre entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
        E = R.normaliser(corps.donnees);
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
  // Code interne (VRF-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
      E = R.normaliser(c.etat); session.base = donnees?.majLe ?? null;
      demarrer(); envoyer();
      return;
    }
    E = donnees ? R.normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.sites.length) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? R.normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
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
  // Entreprise fictive de services, trois sites (bureaux avec ascenseur, plateforme logistique, espace
  // recevant du public). Historique simulé avec les vraies règles, à des dates relatives à aujourd'hui.
  // États forcés : échéances en retard (porte automatique, nacelle), proches, date inconnue (chariot neuf),
  // délai de 2 ans appliqué (électricité du siège), périodicité saisie (rayonnages), équipement hors service,
  // rapport défavorable avec observation « danger », observations en retard, levées avec preuve.
  function donneesDemo() {
    const e = R.etatVide();
    e.structure = 'Services Exemple';
    const t = auj();
    const j = (n) => ajout(t, n);
    const m = (n, dj = 0) => ajout(ajoutMois(t, n), dj);
    const ORG = { ctrl: 'Bureau de contrôle Exemple', feu: 'Prévention Incendie Exemple', asc: 'Ascenseurs Exemple', porte: 'Portes Automatiques Exemple', lev: 'Levage Contrôle Exemple', int: 'Service maintenance interne', clim: 'Climatisation Exemple' };
    let seq = 100;
    const rap = (d) => `RAP-${d.slice(0, 4)}-${++seq}`;
    const sites = [
      { id: uid(), nom: 'Siège · bureaux', adresse: '12 rue de l\'Exemple, Ville-Exemple', type: 'travail' },
      { id: uid(), nom: 'Plateforme logistique', adresse: 'Zone d\'activités Exemple, lot 4', type: 'travail' },
      { id: uid(), nom: 'Espace d\'accueil du public', adresse: '3 place Exemple, Ville-Exemple', type: 'erp', categorie: 'Type W, 4e catégorie' },
    ];
    e.sites = sites.map(R.normaliserSite);
    const [s1, s2, s3] = e.sites.map((s) => s.id);
    // spec : [site, nom, type, organisme, dates de vérification (de la plus ancienne à la plus récente), options]
    const specs = [
      [s1, 'Installation électrique du siège', 'ELEC', ORG.ctrl, [m(-25), m(-13, -6)], { localisation: 'TGBT, local technique RDC', allegement: true }],
      [s1, 'Blocs d\'éclairage de sécurité (32)', 'ECL_SECU', ORG.int, [j(-144), j(-114), j(-84), j(-54), j(-24)], { localisation: 'Tous niveaux' }],
      [s1, 'Blocs d\'éclairage de sécurité (32)', 'ECL_AUTO', ORG.int, [m(-10), m(-4)], { localisation: 'Tous niveaux', nom: 'Autonomie des blocs de secours' }],
      [s1, 'Parc d\'extincteurs (24)', 'EXT', ORG.feu, [m(-23, -12), m(-11, -20)], { reference: '24 appareils' }],
      [s1, 'Ascenseur A', 'ASC_ENT', ORG.asc, [j(-104), j(-62), j(-20)], { localisation: 'Hall d\'entrée', nom: 'Ascenseur A · visites d\'entretien' }],
      [s1, 'Ascenseur A', 'ASC_CT', ORG.ctrl, [m(-50)], { localisation: 'Hall d\'entrée', nom: 'Ascenseur A · contrôle technique' }],
      [s1, 'Porte automatique de l\'accueil', 'PORTES', ORG.porte, [m(-19), m(-13), m(-7, -10)], { localisation: 'Entrée principale' }],
      [s1, 'Centrale de traitement d\'air', 'AERATION', ORG.clim, [m(-22), m(-10)], { localisation: 'Toiture terrasse' }],
      [s2, 'Installation électrique de la plateforme', 'ELEC', ORG.ctrl, [m(-13, -10), j(-40)], { localisation: 'TGBT quai nord' }],
      [s2, 'Chariot élévateur n° 1', 'LEV_MOB', ORG.lev, [m(-10, -2), m(-4, -2)], { reference: 'CE-01' }],
      [s2, 'Chariot élévateur n° 2', 'LEV_MOB', '', [], { reference: 'CE-02', note: 'Livré le mois dernier : récupérer le rapport de mise en service.' }],
      [s2, 'Nacelle élévatrice', 'LEV_MOB', ORG.lev, [m(-12, -3), m(-6, -3)], { reference: 'PEMP-01' }],
      [s2, 'Porte de quai sectionnelle n° 3', 'PORTES', ORG.porte, [m(-12, -8), m(-6, -8), j(-5)], { localisation: 'Quai 3' }],
      [s2, 'Élingues et palonnier', 'LEV_ACC', ORG.lev, [m(-23, 30), m(-11, 30)], { localisation: 'Atelier' }],
      [s2, 'Extincteurs et RIA de la plateforme', 'SECOURS', ORG.int, [m(-9), m(-3)], {}],
      [s2, 'Rayonnages de stockage', 'AUTRE', ORG.int, [m(-20), m(-8)], { periodeSaisie: { mois: 12 }, note: 'Périodicité choisie par l\'entreprise d\'après la notice du fabricant (aucune périodicité de la base).' }],
      [s2, 'Compresseur d\'air', 'AUTRE', '', [], { inactif: true, note: 'Retiré du service, en attente d\'enlèvement.' }],
      [s3, 'Installation électrique de l\'espace public', 'ELEC_ERP', ORG.ctrl, [m(-18), m(-6)], { localisation: 'Tableau général' }],
      [s3, 'Extincteurs de l\'espace public (9)', 'EXT_ERP', ORG.feu, [m(-24, 9), m(-12, 9)], {}],
      [s3, 'Système de sécurité incendie', 'SSI', ORG.feu, [m(-21), m(-9)], { reference: 'SSI catégorie E' }],
      [s3, 'Désenfumage de la salle d\'accueil', 'DESENF', ORG.feu, [m(-21), m(-9)], {}],
      [s3, 'Chaufferie gaz', 'GAZ_ERP', ORG.ctrl, [m(-22), m(-10)], { localisation: 'Sous-sol' }],
    ];
    const ids = [];
    for (const [siteId, nom, type, organisme, dates, opt] of specs) {
      const eq = R.normaliserEquipement({ id: uid(), site: siteId, nom: opt.nom || nom, type, organisme, ...opt });
      e.equipements.push(eq);
      ids.push(eq.id);
      for (const d of dates) {
        R.ajouterVerification(e, { equipement: eq.id, date: d, organisme, rapport: organisme === ORG.int ? `Registre interne ${d.slice(0, 7)}` : rap(d), lien: organisme === ORG.int ? '' : `https://example.com/rapports/${eq.reference || 'rapport'}-${d}.pdf`.replace(/\s/g, ''), resultat: 'conforme' }, t, uid);
      }
    }
    const v = (i, k = 0) => R.verifsDe(e, ids[i])[k] || null; // k = 0 : la plus récente
    const obs = (i, verif, liste, resultat = 'observations') => {
      verif.resultat = resultat;
      for (const [texte, gravite, echeance, responsable, levee, preuve] of liste) {
        const o = R.normaliserObservation({ id: uid(), verification: verif.id, equipement: ids[i], texte, gravite, constateLe: verif.date, echeance, responsable, statut: 'ouverte' });
        e.observations.push(o);
        if (levee) R.leverObservation(e, o.id, { date: levee, preuve }, t);
      }
    };
    // Siège : premier rapport électrique avec observations levées à temps → délai de 2 ans possible.
    obs(0, v(0, 1), [['Absence de repérage des circuits du tableau divisionnaire du 2e étage', 'mineure', m(-22), 'Services généraux', m(-23), 'BI-2024-118'], ['Prise de courant détériorée en salle de réunion', 'majeure', m(-24), 'Services généraux', m(-24, 5), 'Facture électricien n° 4471']]);
    obs(5, v(5), [['Éclairage de la cuvette insuffisant', 'mineure', m(-47), 'Ascensoriste', m(-48), 'Rapport d\'intervention ASC-2209']]);
    // Plateforme : rapport électrique récent avec une observation en retard et une levée.
    obs(8, v(8), [['Absence de protection différentielle 30 mA sur la prise du poste de charge 12', 'majeure', j(-10), 'Prestataire électricité'], ['Schéma unifilaire du TGBT à mettre à jour', 'mineure', j(50), 'Responsable maintenance', j(-6), 'Schéma indice C du 08/11']]);
    obs(8, v(8, 1), [['Capot manquant sur la boîte de dérivation du quai 2', 'majeure', m(-12, 20), 'Responsable maintenance', m(-12, 2), 'BI-2025-0412']]);
    // Porte de quai : rapport défavorable, cellule de sécurité HS, porte consignée.
    obs(12, v(12), [['Cellule de sécurité inopérante : porte consignée en attente de réparation', 'danger', j(2), 'Responsable maintenance'], ['Joints de bas de tablier usés', 'mineure', j(60), 'Responsable maintenance']], 'defavorable');
    obs(9, v(9), [['Usure du flexible de levage : à remplacer', 'majeure', m(-3, 26), 'Responsable logistique', m(-3, 12), 'Bon de commande pièces CE-0919']]);
    obs(17, v(17), [['Plan d\'évacuation à mettre à jour après le réaménagement', 'mineure', j(30), 'Services généraux']]);
    obs(19, v(19), [['Déclencheur manuel du couloir masqué par du mobilier', 'majeure', m(-9, 15), 'Services généraux', m(-9, 3), 'Photo et consigne affichée le jour même']]);
    return R.normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Vérifications réglementaires · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="160" width="120" height="120" fill="#2E5A88"/>
          <rect x="20" y="40" width="120" height="100" fill="#E8B93A"/>
          <rect x="160" y="200" width="80" height="80" fill="none" stroke="#24221F" stroke-width="4" stroke-dasharray="10 8"/>
          <rect x="160" y="100" width="80" height="80" fill="#E58C74"/>
          <circle cx="430" cy="150" r="130" fill="#F3EDE3"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#24221F"/>
          <rect x="400" y="160" width="60" height="60" fill="#2E5A88"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Vérifications réglementaires</p>
          <h1>Aucun contrôle oublié.</h1>
          <p>Tes équipements par site, les périodicités sourcées, les échéances, les observations suivies jusqu'à leur levée et le registre prêt à imprimer.</p>
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
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/verifications/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  const nouvelAccueil = () => ({ etape: 1, structure: '', site: '', adresse: '', typeSite: 'travail', types: null });
  let accueil = nouvelAccueil();
  const typesProposes = (typeSite) => B.types.filter((t) => t.pour.includes(typeSite)).map((t) => t.code);

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On tient ton registre.</h1>
        <p class="intro">Tu ranges tes équipements par site, tu notes chaque vérification et ses observations : les échéances, les alertes et le registre imprimable se font seuls. Les périodicités viennent d'une source officielle datée, sinon c'est toi qui les saisis.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Ton entreprise ou ta structure <small>Facultatif, en tête du registre.</small><input id="structure" value="${esc(a.structure)}" autocomplete="organization" maxlength="80"></label>
          <label class="champ">Ton premier site <small>Tu en ajouteras d'autres ensuite.</small><input id="site" value="${esc(a.site)}" maxlength="80" placeholder="Ex. : Siège, Atelier, Magasin du centre"></label>
        </div>
        <label class="champ" style="max-width:720px;margin-top:12px">Adresse du site <small>Facultative, reprise sur le registre.</small><input id="adresse" value="${esc(a.adresse)}" maxlength="160"></label>
        <fieldset class="champ" style="margin-top:20px;border:0;padding:0;max-width:720px"><legend>Ce site est surtout <small>Pour te proposer les bons contrôles ; rien n'est figé.</small></legend>
          <div class="choix-statut deux">${B.typesSite.map((x) => `<label title="${esc(x.detail)}"><input type="radio" name="typeSite" value="${x.id}" ${x.id === a.typeSite ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const coches = new Set(a.types ?? typesProposes(a.typeSite));
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Les contrôles de ${esc(a.site || 'ce site')}</h1>
        <p class="intro">Coche ceux qui existent sur ce site : chacun devient un équipement à compléter (date du dernier rapport, organisme). La périodicité affichée vient de la brochure INRS ED 828 (${esc(B.source.edition)}, consultée le ${esc(B.source.consulte)}).</p>
        <div class="choix-types" style="margin-top:16px">${B.familles.map((f) => {
          const ts = B.types.filter((t) => t.famille === f && t.code !== 'AUTRE');
          if (!ts.length) return '';
          return `<fieldset class="groupe-types"><legend>${esc(f)}</legend>${ts.map((t) => `<label class="case"><input type="checkbox" name="types" value="${t.code}" ${coches.has(t.code) ? 'checked' : ''}><span>${esc(t.nom)}<small class="mention-type">${R.libellePeriode(t.jours ? { jours: t.jours } : { mois: t.mois })} · ${esc(t.champ)}</small></span></label>`).join('')}</fieldset>`;
        }).join('')}</div>
        <p class="aide" style="max-width:720px;margin-top:16px">Un contrôle absent de la liste ? Crée-le ensuite en « Autre contrôle » et saisis sa périodicité. Cette liste aide à ne rien oublier ; elle ne dit pas quels contrôles s'imposent à ton établissement : c'est à vérifier avec les textes et ton organisme.</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon registre</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['structure', 'site', 'adresse']) $(`#${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
    document.querySelectorAll('[name=typeSite]').forEach((el) => el.addEventListener('change', () => { accueil.typeSite = el.value; accueil.types = null; }));
    document.querySelectorAll('[name=types]').forEach((el) => el.addEventListener('change', () => { accueil.types = [...document.querySelectorAll('[name=types]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    const a = accueil;
    E = R.etatVide();
    E.structure = a.structure.trim();
    const s = R.normaliserSite({ id: uid(), nom: a.site.trim() || 'Site principal', adresse: a.adresse, type: a.typeSite });
    E.sites.push(s);
    for (const code of a.types ?? typesProposes(a.typeSite)) E.equipements.push(R.normaliserEquipement({ id: uid(), site: s.id, type: code, nom: R.typeDe(code).nom }));
    const n = E.equipements.length;
    accueil = nouvelAccueil();
    vue = 'equipements';
    sauver();
    demarrer();
    toast(n ? `Registre créé avec ${pluriel(n, 'contrôle')} : renseigne la date du dernier rapport de chacun.` : 'Registre créé : ajoute ton premier équipement.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    equipements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    observations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    registre: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 3h16v18H4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="7" width="8" height="2" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="#B84A34"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#E8B93A" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#B84A34" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#2E5A88" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Bord'], ['equipements', 'Équipements'], ['observations', 'Observations'], ['calendrier', 'Calendrier'], ['registre', 'Registre']];
  const VUES = [...ONGLETS.map(([id]) => id), 'guide'];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation : il ne remplace ni un organisme agréé ou accrédité, ni la lecture des textes applicables à ton établissement. Les périodicités de la base viennent de la brochure INRS ED 828 (édition de septembre 2026, consultée le 14/11/2026) ; vérifie qu\'elles s\'appliquent à ton cas et qu\'elles n\'ont pas changé.</p>';
  const COULEUR_STATUT = { retard: 'rouge', proche: 'jaune', inconnue: 'rose', ok: 'vert', inactif: 'sable' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${R.LIB_STATUT[s]}</span>`;
  const COULEUR_OBS = { retard: 'rouge', proche: 'jaune', ouverte: 'ciel', levee: 'vert' };
  const etiquetteObs = (st) => `<span class="etiquette ${COULEUR_OBS[st]}">${R.LIB_OBS[st]}</span>`;
  const COULEUR_GRAVITE = { danger: 'rouge', majeure: 'rose', mineure: 'sable' };
  const etiquetteGravite = (g) => `<span class="etiquette ${COULEUR_GRAVITE[g]}">${esc(B.gravites.find((x) => x.id === g)?.nom || g)}</span>`;
  const libResultat = (r) => B.resultats.find((x) => x.id === r)?.nom || r;
  const libPeriode = (p) => R.libellePeriode(p);
  function libSource(p, court = false) {
    if (!p) return 'à saisir par toi';
    if (p.origine === 'saisie') return 'saisie par toi';
    const nat = p.type.nature === 'referentiel' ? 'référentiel' : 'réglementaire';
    return court ? `INRS ED 828, p. ${p.type.page}` : `${nat}, INRS ED 828 p. ${p.type.page}${p.origine === 'allegee' ? ', délai de 2 ans (arrêté du 26/12/2011, art. 3)' : ''}`;
  }

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/verifications/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Vérifications<br>réglementaires</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide et sources" title="Guide et sources">${ICONES.guide}</button>
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
    const titres = { ...Object.fromEntries(ONGLETS), tableau: 'Tableau de bord', guide: 'Guide et sources' };
    document.title = `${titres[vue]} · Vérifications réglementaires`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, equipements: vueEquipements, observations: vueObservations, calendrier: vueCalendrier, registre: vueRegistre, guide: vueGuide }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#filtre-site')?.addEventListener('change', (e) => { filtre.site = e.target.value; rendre(); });
    $('#registre-site')?.addEventListener('change', (e) => { filtre.registre = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="40" height="56" fill="#2E5A88"/><rect x="44" y="56" width="40" height="40" fill="#E8B93A"/><circle cx="64" cy="30" r="20" fill="#E58C74"/></svg>';
  const optionsSites = (choisi, tous = true) => `${tous ? `<option value="">Tous les sites</option>` : ''}${E.sites.map((s) => `<option value="${s.id}" ${s.id === choisi ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}`;

  // ---------- Tableau de bord ----------
  function ligneAlerte(a) {
    if (a.genre === 'echeance') {
      const s = a.situation;
      const pastille = s.prochaine ? `<span class="date-pastille ${a.niveau}"><b>${versDate(s.prochaine).getDate()}</b>${fmt(s.prochaine, { month: 'short' })}</span>` : '<span class="date-pastille inconnue"><b>?</b>date</span>';
      const quoi = s.statut === 'retard' ? `Échéance dépassée ${dans(s.jours)}` : s.statut === 'proche' ? `Échéance ${dans(s.jours)}` : (s.sansPeriode ? 'Périodicité à saisir' : 'Date du dernier rapport à renseigner');
      return `<li>${pastille}<button class="lien-ligne" data-action="ouvrir" data-id="${s.eq.id}"><b>${esc(s.eq.nom)}</b><span>${quoi} · ${esc(nomSite(s.eq.site))}${s.eq.organisme ? ` · ${esc(s.eq.organisme)}` : ''}</span></button>
        <button class="btn petit" data-action="${s.statut === 'inconnue' ? 'modifier' : 'verification'}" data-id="${s.eq.id}">${s.statut === 'inconnue' ? 'Compléter' : 'Vérification faite'}</button></li>`;
    }
    const o = a.observation;
    const st = R.statutObservation(o, auj());
    return `<li><span class="date-pastille ${a.niveau} obs"><b>!</b>${o.gravite === 'danger' ? 'danger' : 'obs.'}</span><button class="lien-ligne" data-action="observation" data-id="${o.id}"><b>${esc(o.texte)}</b><span>${esc(a.eq.nom)} · ${esc(nomSite(a.eq.site))} · ${o.echeance ? `à lever ${st === 'retard' ? 'avant le' : 'avant le'} ${dateCourte(o.echeance)}` : 'sans échéance'}</span></button>
      <button class="btn petit" data-action="lever" data-id="${o.id}">Lever</button></li>`;
  }

  function vueTableau() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.structure ? `${esc(E.structure)} · ` : ''}Ce qui est dépassé, ce qui arrive, et les observations à lever.</p></div>
        <div class="actions"><button class="btn primaire" data-action="verification">${ICONES.plus}Vérification faite</button></div></div>`;
    if (!E.equipements.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun équipement pour l'instant</h3><p>Ajoute les installations contrôlées de ton site (électricité, extincteurs, portes automatiques, levage…) avec la date de leur dernier rapport : les échéances se calculent.</p><div class="actions"><button class="btn primaire" data-action="nouvel-equipement">${ICONES.plus}Ajouter un équipement</button></div></div></div>${AVERTISSEMENT}`;
    }
    const s = R.synthese(E, t);
    const al = R.alertes(E, t);
    const tuiles = [
      ['En retard', String(s.retard), `${pluriel(s.retard, 'contrôle')} dont l'échéance est passée`, 'var(--rouge)', 'rond'],
      ['À prévoir', String(s.proche), `dans les ${E.reglages.alerteJours} prochains jours`, 'var(--jaune)', ''],
      ['Observations à lever', String(s.obsOuvertes), `${s.obsRetard} en retard${s.obsDanger ? ` · ${s.obsDanger} danger` : ''}`, 'var(--rose-fort)', ''],
      ['À jour', s.tauxAJour === null ? '–' : `${s.tauxAJour} %`, `des contrôles datés${s.inconnue ? ` · ${s.inconnue} à compléter` : ''}`, 'var(--bleu)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const ps = R.parSite(E, t);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${s.delaiLevee !== null ? `<p class="resume-ventes">Délai moyen de levée des observations sur 12 mois : <b>${pluriel(s.delaiLevee, 'jour')}</b> (${pluriel(s.nbLevees, 'observation levée', 'observations levées')}).</p>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Alertes <span>Échéances dépassées ou proches, dates manquantes, observations en retard ou graves</span></h2>
          ${al.length ? `<ul class="prochains">${al.slice(0, 8).map(ligneAlerte).join('')}</ul>${al.length > 8 ? `<p class="mention">${pluriel(al.length - 8, 'autre alerte')} : voir <button class="btn lien" data-action="vue" data-vue="equipements">les équipements</button> et <button class="btn lien" data-action="vue" data-vue="observations">les observations</button>.</p>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune alerte</h3><p>Tous les contrôles datés sont à jour et aucune observation n\'est en retard.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Par site <span>Contrôles et observations</span></h2>
          <div class="sites-bord">${ps.map((x) => `<button class="site-carte" data-action="voir-site" data-id="${x.site.id}">
            <b>${esc(x.site.nom)}</b>
            <span class="barre-etat" aria-hidden="true">${['retard', 'proche', 'inconnue', 'ok'].map((k) => (x[k] ? `<i class="be-${k}" style="flex:${x[k]}"></i>` : '')).join('')}</span>
            <span class="site-chiffres">${pluriel(x.nb, 'contrôle')} · ${x.retard ? `<em class="txt-retard">${x.retard} en retard</em> · ` : ''}${x.proche ? `${x.proche} à prévoir · ` : ''}${x.inconnue ? `${x.inconnue} à compléter · ` : ''}${pluriel(x.obsOuvertes, 'observation')} à lever</span>
          </button>`).join('')}</div>
          <p class="legende-etat"><i class="be-retard"></i>En retard <i class="be-proche"></i>À prévoir <i class="be-inconnue"></i>À compléter <i class="be-ok"></i>À jour</p>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Équipements ----------
  const FILTRES = [['tous', 'Tous'], ['alerte', 'À traiter'], ['retard', 'En retard'], ['proche', 'À prévoir'], ['inconnue', 'À compléter'], ['ok', 'À jour'], ['inactif', 'Hors service']];
  function garder(s, f) {
    if (f === 'inactif') return s.statut === 'inactif';
    if (s.statut === 'inactif') return false;
    if (f === 'tous') return true;
    if (f === 'alerte') return s.statut !== 'ok';
    return s.statut === f;
  }

  function ligneEquipement(s) {
    const e = s.eq;
    const tags = [etiquetteStatut(s.statut)];
    if (s.obsOuvertes.length) tags.push(`<span class="etiquette ${s.obsRetard.length ? 'rouge' : 'rose'}">${pluriel(s.obsOuvertes.length, 'observation')} à lever</span>`);
    if (s.periode?.origine === 'allegee') tags.push('<span class="etiquette ciel">Délai de 2 ans</span>');
    if (s.periode?.origine === 'saisie') tags.push('<span class="etiquette sable">Périodicité saisie</span>');
    if (e.prochaineFixee) tags.push('<span class="etiquette sable">Date fixée</span>');
    const detail = [s.type.nom !== e.nom ? s.type.nom : '', e.localisation, e.reference].filter(Boolean).map(esc).join(' · ');
    const classe = s.statut === 'retard' ? 'alerte-depasse' : s.statut === 'proche' || s.statut === 'inconnue' ? 'alerte-proche' : s.statut === 'inactif' ? 'st-resilie' : '';
    return `<li class="ligne-fac ${classe}">
      <button class="ligne-info" data-action="ouvrir" data-id="${e.id}">
        <b>${esc(e.nom)}</b>
        <span class="ligne-detail">${detail || esc(s.type.famille)}${e.organisme ? ` · ${esc(e.organisme)}` : ''}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${s.prochaine ? dateCourte(s.prochaine) : (s.sansPeriode ? 'Périodicité ?' : 'Date ?')}</b><small>${s.prochaine ? `${dans(s.jours)} · ${libPeriode(s.periode).toLowerCase()}` : s.derniere ? `dernière le ${dateCourte(s.derniere)}` : 'dernier rapport à renseigner'}</small></span>
        ${e.inactif ? '' : `<button class="btn petit" data-action="${s.statut === 'inconnue' ? 'modifier' : 'verification'}" data-id="${e.id}">${s.statut === 'inconnue' ? 'Compléter' : 'Vérification faite'}</button>`}
      </div>
    </li>`;
  }

  function vueEquipements() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Équipements</h1><p>Chaque installation contrôlée, site par site, avec sa prochaine échéance.</p></div>
      <div class="actions"><button class="btn" data-action="sites">Gérer les sites</button><button class="btn primaire" data-action="nouvel-equipement">${ICONES.plus}Ajouter un équipement</button></div></div>`;
    if (!E.equipements.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun équipement</h3><p>Un équipement par installation contrôlée : « TGBT du bâtiment A », « Parc d'extincteurs », « Porte de quai 3 », « Chariot élévateur 2 »… Choisis son type de contrôle : la périodicité sourcée s'applique.</p><div class="actions"><button class="btn primaire" data-action="nouvel-equipement">${ICONES.plus}Ajouter un équipement</button></div></div></div>`;
    const toutes = R.situations(E, t, filtre.site);
    const q = filtre.q.trim().toLowerCase();
    const cherche = (s) => !q || [s.eq.nom, s.type.nom, s.eq.localisation, s.eq.reference, s.eq.organisme].join(' ').toLowerCase().includes(q);
    const compte = (f) => toutes.filter((s) => garder(s, f) && cherche(s)).length;
    const liste = toutes.filter((s) => garder(s, filtre.statut) && cherche(s));
    const groupes = E.sites.filter((s) => !filtre.site || s.id === filtre.site).map((site) => ({ site, lignes: liste.filter((s) => s.eq.site === site.id) })).filter((g) => g.lignes.length);
    return `${titre}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Statut">${FILTRES.map(([f, l]) => `<button class="filtre" data-action="filtre" data-statut="${f}" aria-pressed="${filtre.statut === f}">${l} <small>${compte(f)}</small></button>`).join('')}</div>
        <div class="rang-recherche">
          ${E.sites.length > 1 ? `<label class="champ"><span class="sr-only">Site</span><select id="filtre-site">${optionsSites(filtre.site)}</select></label>` : ''}
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher…" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-cat"><h2 class="titre-cat">${esc(g.site.nom)} <span>${pluriel(g.lignes.length, 'équipement')}${g.site.adresse ? ` · ${esc(g.site.adresse)}` : ''}</span></h2><ul class="lignes-fac">${g.lignes.map(ligneEquipement).join('')}</ul></section>`).join('') : '<div class="vide-etat petit"><div><h3>Rien ne correspond</h3><p>Change de filtre ou efface la recherche.</p></div></div>'}
      ${AVERTISSEMENT}`;
  }

  // ---------- Observations ----------
  const FILTRES_OBS = [['ouvertes', 'À lever'], ['retard', 'En retard'], ['danger', 'Danger'], ['levees', 'Levées'], ['toutes', 'Toutes']];
  function vueObservations() {
    const t = auj();
    const titre = '<div class="vue-tete"><div><h1>Observations</h1><p>Chaque observation des rapports, suivie jusqu\'à sa levée, avec la preuve.</p></div></div>';
    const toutes = E.observations.map((o) => ({ o, eq: equipement(o.equipement), st: R.statutObservation(o, t) })).filter((x) => x.eq && (!filtre.site || x.eq.site === filtre.site));
    const garde = (x, f) => (f === 'toutes' ? true : f === 'levees' ? x.st === 'levee' : f === 'retard' ? x.st === 'retard' : f === 'danger' ? x.st !== 'levee' && x.o.gravite === 'danger' : x.st !== 'levee');
    const liste = toutes.filter((x) => garde(x, filtre.obs)).sort((a, b) => (a.st === 'levee') - (b.st === 'levee') || (a.st === 'levee' ? (b.o.leveeLe || '').localeCompare(a.o.leveeLe || '') : (a.o.echeance || '9999').localeCompare(b.o.echeance || '9999')));
    const filtres = `<div class="outils-liste"><div class="filtres" role="group" aria-label="Statut">${FILTRES_OBS.map(([f, l]) => `<button class="filtre" data-action="filtre-obs" data-statut="${f}" aria-pressed="${filtre.obs === f}">${l} <small>${toutes.filter((x) => garde(x, f)).length}</small></button>`).join('')}</div>
      ${E.sites.length > 1 ? `<div class="rang-recherche"><label class="champ"><span class="sr-only">Site</span><select id="filtre-site">${optionsSites(filtre.site)}</select></label></div>` : ''}</div>`;
    if (!E.observations.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune observation</h3><p>Quand un rapport de vérification contient des observations, note-les avec la vérification (« Vérification faite », résultat « Avec observations ») : chacune reçoit une échéance de levée selon sa gravité.</p></div></div>`;
    return `${titre}${filtres}
      ${liste.length ? `<ul class="lignes-fac">${liste.map(({ o, eq, st }) => {
        const v = E.verifications.find((x) => x.id === o.verification);
        const classe = st === 'retard' || (o.gravite === 'danger' && st !== 'levee') ? 'alerte-depasse' : st === 'proche' ? 'alerte-proche' : st === 'levee' ? 'st-leve' : '';
        return `<li class="ligne-fac ${classe}">
          <button class="ligne-info" data-action="observation" data-id="${o.id}">
            <b>${esc(o.texte)}</b>
            <span class="ligne-detail">${esc(eq.nom)} · ${esc(nomSite(eq.site))}${v ? ` · rapport du ${dateCourte(v.date)}${v.rapport ? ` (${esc(v.rapport)})` : ''}` : ''}${o.responsable ? ` · ${esc(o.responsable)}` : ''}</span>
            <span class="ligne-etiquettes">${etiquetteGravite(o.gravite)}${etiquetteObs(st)}</span>
          </button>
          <div class="ligne-droite">
            <span class="ligne-cout">${st === 'levee' ? `<b>Levée le ${dateCourte(o.leveeLe)}</b><small>${o.preuve ? `Preuve : ${esc(o.preuve)}` : o.lienPreuve ? 'Preuve en lien' : ''}</small>` : `<b>${o.echeance ? dateCourte(o.echeance) : 'Sans échéance'}</b><small>${o.echeance ? `à lever ${dans(R.ecart(t, o.echeance))}` : ''} · ouverte depuis ${pluriel(Math.max(0, R.ecart(o.constateLe || t, t)), 'jour')}</small>`}</span>
            ${st === 'levee' ? '' : `<button class="btn petit" data-action="lever" data-id="${o.id}">Lever</button>`}
          </div></li>`;
      }).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien dans ce filtre</h3><p>Aucune observation ne correspond.</p></div></div>'}`;
  }

  // ---------- Calendrier ----------
  function vueCalendrier() {
    const t = auj();
    const c = R.calendrier(E, t, 12);
    const ligne = (l) => `<li><span class="cal-date">${fmt(l.date, { weekday: 'short', day: 'numeric' })}</span><button class="lien-ligne" data-action="ouvrir" data-id="${l.situation.eq.id}"><b>${esc(l.situation.eq.nom)}</b><span>${esc(nomSite(l.situation.eq.site))}${l.situation.eq.organisme ? ` · ${esc(l.situation.eq.organisme)}` : ''}${l.premiere ? '' : ' · échéance suivante'}</span></button></li>`;
    return `<div class="vue-tete"><div><h1>Calendrier</h1><p>Les échéances des douze prochains mois, pour prévoir les passages des organismes.</p></div>
        <div class="actions"><button class="btn" data-action="csv-registre">Exporter (CSV)</button></div></div>
      ${c.retards.length ? `<section class="cal-bloc retard"><h2 class="titre-section">En retard <span>À planifier en priorité</span></h2><ul class="cal-liste">${c.retards.map((s) => `<li><span class="cal-date">${dateCourte(s.prochaine)}</span><button class="lien-ligne" data-action="ouvrir" data-id="${s.eq.id}"><b>${esc(s.eq.nom)}</b><span>${esc(nomSite(s.eq.site))} · dépassée ${dans(s.jours)}</span></button></li>`).join('')}</ul></section>` : ''}
      <div class="cal-mois">${c.mois.map((m) => `<section class="cal-bloc"><h2 class="cal-titre">${fmt(`${m.mois}-01`, { month: 'long', year: 'numeric' })} <span>${m.lignes.length ? pluriel(m.lignes.length, 'échéance') : 'rien de prévu'}</span></h2>${m.lignes.length ? `<ul class="cal-liste">${m.lignes.map(ligne).join('')}</ul>` : ''}</section>`).join('')}</div>
      ${c.inconnues.length ? `<section class="cal-bloc"><h2 class="titre-section">Sans date <span>Dernier rapport ou périodicité à renseigner</span></h2><ul class="cal-liste">${c.inconnues.map((s) => `<li><span class="cal-date">?</span><button class="lien-ligne" data-action="modifier" data-id="${s.eq.id}"><b>${esc(s.eq.nom)}</b><span>${esc(nomSite(s.eq.site))} · ${s.sansPeriode ? 'périodicité à saisir' : 'date du dernier rapport à renseigner'}</span></button></li>`).join('')}</ul></section>` : ''}`;
  }

  // ---------- Registre imprimable ----------
  function registreSite(s, t) {
    const sits = R.situations(E, t, s.id);
    const ids = new Set(sits.map((x) => x.eq.id));
    const verifs = E.verifications.filter((v) => ids.has(v.equipement)).sort((a, b) => b.date.localeCompare(a.date));
    const obs = E.observations.filter((o) => ids.has(o.equipement)).sort((a, b) => (a.statut === 'levee') - (b.statut === 'levee') || (b.constateLe || '').localeCompare(a.constateLe || ''));
    const typeSite = B.typesSite.find((x) => x.id === s.type)?.nom || '';
    return `<section class="registre-site">
      <header class="reg-tete"><div><p class="surtitre">Registre des vérifications périodiques</p><h2>${esc(s.nom)}</h2><p>${[E.structure, s.adresse, typeSite, s.categorie].filter(Boolean).map(esc).join(' · ')}</p></div><p class="reg-date">Édité le ${dateLongue(t)}</p></header>
      <h3>Contrôles et échéances</h3>
      <div class="defile"><table class="tableau reg-table"><thead><tr><th>Équipement</th><th>Contrôle</th><th>Périodicité</th><th>Organisme</th><th>Dernière</th><th>Prochaine</th><th>État</th></tr></thead>
      <tbody>${sits.map((x) => `<tr class="${x.statut}"><td><b>${esc(x.eq.nom)}</b>${[x.eq.localisation, x.eq.reference].filter(Boolean).length ? `<br><small>${[x.eq.localisation, x.eq.reference].filter(Boolean).map(esc).join(' · ')}</small>` : ''}</td><td>${esc(x.type.nom)}</td><td>${libPeriode(x.periode)}<br><small>${libSource(x.periode, true)}${x.periode?.origine === 'allegee' ? ' · délai de 2 ans' : ''}</small></td><td>${esc(x.eq.organisme) || '–'}</td><td class="nb">${x.derniere ? dateCourte(x.derniere) : '–'}</td><td class="nb">${x.prochaine ? dateCourte(x.prochaine) : '–'}</td><td>${R.LIB_STATUT[x.statut]}${x.obsOuvertes.length ? `<br><small>${pluriel(x.obsOuvertes.length, 'observation')} à lever</small>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">Aucun équipement.</td></tr>'}</tbody></table></div>
      <h3>Historique des vérifications</h3>
      <div class="defile"><table class="tableau reg-table"><thead><tr><th>Date</th><th>Équipement</th><th>Organisme</th><th>Rapport</th><th>Résultat</th></tr></thead>
      <tbody>${verifs.map((v) => `<tr><td class="nb">${dateCourte(v.date)}</td><td>${esc(equipement(v.equipement)?.nom)}</td><td>${esc(v.organisme) || '–'}${v.intervenant ? `<br><small>${esc(v.intervenant)}</small>` : ''}</td><td>${v.rapport || v.lien ? lienExterne(v.lien, v.rapport || 'Lien') : '–'}</td><td>${libResultat(v.resultat)}${R.obsDe(E, v.id).length ? ` (${R.obsDe(E, v.id).length})` : ''}</td></tr>`).join('') || '<tr><td colspan="5">Aucune vérification enregistrée.</td></tr>'}</tbody></table></div>
      <h3>Observations et levées</h3>
      <div class="defile"><table class="tableau reg-table"><thead><tr><th>Constat</th><th>Équipement</th><th>Observation</th><th>Gravité</th><th>À lever avant</th><th>Levée</th></tr></thead>
      <tbody>${obs.map((o) => `<tr><td class="nb">${dateCourte(o.constateLe)}</td><td>${esc(equipement(o.equipement)?.nom)}</td><td>${esc(o.texte)}${o.responsable ? `<br><small>${esc(o.responsable)}</small>` : ''}</td><td>${esc(B.gravites.find((g) => g.id === o.gravite)?.nom)}</td><td class="nb">${o.echeance ? dateCourte(o.echeance) : '–'}</td><td>${o.statut === 'levee' ? `${dateCourte(o.leveeLe)}<br><small>${o.preuve ? esc(o.preuve) : ''}${o.lienPreuve ? `${o.preuve ? ' · ' : ''}${lienExterne(o.lienPreuve, 'lien')}` : ''}</small>` : '<b>À lever</b>'}</td></tr>`).join('') || '<tr><td colspan="6">Aucune observation.</td></tr>'}</tbody></table></div>
    </section>`;
  }

  function vueRegistre() {
    const t = auj();
    if (!E.sites.length) return '<div class="vue-tete"><div><h1>Registre</h1></div></div><p class="aide">Crée d\'abord un site.</p>';
    if (filtre.registre && !site(filtre.registre)) filtre.registre = '';
    const choisis = filtre.registre ? [site(filtre.registre)] : E.sites;
    return `<div class="vue-tete"><div><h1>Registre</h1><p>Le registre des vérifications, site par site, à imprimer ou à enregistrer en PDF pour un contrôle ou un audit.</p></div>
        <div class="actions"><button class="btn" data-action="csv-registre">Exporter (CSV)</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      ${E.sites.length > 1 ? `<div class="outils-liste"><label class="champ" style="max-width:340px">Site imprimé<select id="registre-site">${optionsSites(filtre.registre).replace('Tous les sites', 'Tous les sites (un registre par site)')}</select></label></div>` : ''}
      <div class="registre">${choisis.map((s) => registreSite(s, t)).join('')}
        <p class="mention reg-pied">Périodicités : brochure INRS ED 828 « Principales vérifications périodiques » (${esc(B.source.edition)}, consultée le ${esc(B.source.consulte)}), page indiquée, sauf mention « saisie par toi ». Les rapports et preuves sont conservés par l'établissement ; ce registre en donne les références. Document de suivi édité avec un outil d'aide : il ne remplace pas les rapports des organismes.</p>
      </div>`;
  }

  // ---------- Guide et sources ----------
  function vueGuide() {
    return `
      <div class="vue-tete"><div><h1>Guide et sources</h1><p>D'où viennent les périodicités, comment l'outil calcule, et ce qu'il ne fait pas.</p></div></div>
      <h2 class="titre-section">Source des périodicités <span>Consultée le ${esc(B.source.consulte)}</span></h2>
      <div class="legal">
        <p>Chaque périodicité de la base vient de la <a href="${esc(B.source.url)}" target="_blank" rel="noopener">${esc(B.source.titre)}</a>, édition de ${esc(B.source.edition)}, qui récapitule les textes applicables. La page de la brochure et les textes cités sont indiqués pour chaque contrôle ; relis-les pour savoir si ton établissement est concerné.</p>
        <p><b>Réglementaire</b> : la périodicité vient d'un texte (Code du travail, Code de la construction et de l'habitation, arrêté). <b>Référentiel</b> : elle vient d'une règle APSAD ou d'une norme citée par l'INRS, souvent exigée par les assureurs, mais ce n'est pas un texte de loi. Un contrôle absent de la base se crée en « Autre contrôle » : tu saisis sa périodicité, affichée « saisie par toi » partout, registre compris.</p>
      </div>
      <div class="defile"><table class="tableau guide-table"><thead><tr><th>Contrôle</th><th>Périodicité</th><th>Nature</th><th>Textes cités par l'INRS</th><th class="nb">Page</th></tr></thead>
        <tbody>${B.familles.map((f) => {
          const ts = B.types.filter((t) => t.famille === f && t.code !== 'AUTRE');
          return ts.length ? `<tr class="ligne-famille"><td colspan="5">${esc(f)}</td></tr>${ts.map((t) => `<tr><td><b>${esc(t.nom)}</b><br><small>${esc(t.champ)} · ${esc(t.qui)}</small><br><small>${esc(t.resume)}</small></td><td>${R.libellePeriode(t.jours ? { jours: t.jours } : { mois: t.mois })}${t.allegeeMois ? '<br><small>ou 2 ans sous conditions</small>' : ''}</td><td>${t.nature === 'referentiel' ? 'Référentiel' : 'Réglementaire'}</td><td><small>${esc(t.textes)}</small></td><td class="nb">${t.page}</td></tr>`).join('')}` : '';
        }).join('')}</tbody></table></div>
      <h2 class="titre-section">Comment l'outil calcule</h2>
      <ul class="limites">
        <li><b>Prochaine échéance</b> = date de la dernière vérification + périodicité (en mois, bornée à la fin du mois ; en jours pour l'ascenseur). Sans rapport enregistré, la « dernière vérification connue » saisie dans la fiche sert de départ. Une <b>date fixée</b> (par le rapport ou une mise en demeure) passe avant le calcul, jusqu'à la vérification suivante.</li>
        <li><b>À prévoir</b> : échéance dans les ${E.reglages.alerteJours} jours (réglable), ramenés au tiers de la périodicité pour les contrôles fréquents.</li>
        <li><b>Installations électriques, délai de 2 ans</b> : seulement si tu le demandes dans la fiche et si le dernier rapport est sans observation, ou si toutes ses observations ont été levées avant l'échéance annuelle (arrêté du 26 décembre 2011, art. 3). Sinon l'outil revient à 1 an. Le chef d'établissement adresse alors les justificatifs à l'inspecteur du travail.</li>
        <li><b>Observations</b> : chacune reçoit une échéance de levée selon sa gravité (danger ${E.reglages.levee.danger} j, majeure ${E.reglages.levee.majeure} j, mineure ${E.reglages.levee.mineure} j, modifiables : ce sont des choix d'organisation, pas des délais légaux). La levée demande une date et une preuve (référence de facture, bon d'intervention, ou lien).</li>
      </ul>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Pas de stockage de fichiers</b> : les rapports et les preuves restent dans ton espace documentaire (serveur, Drive, GED). Note leur référence et colle leur lien : le registre les reprend.</li>
        <li><b>Pas d'envoi d'e-mails</b> : les alertes s'affichent dans l'outil ; exporte le calendrier pour le partager.</li>
        <li><b>La base ne dit pas ce qui s'impose à ton établissement</b> : elle aide à ne rien oublier. Catégorie d'ERP, régime ICPE, équipements sous pression, installations particulières : vérifie avec les textes et ton organisme.</li>
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
  const organismes = () => [...E.equipements.map((e) => e.organisme), ...E.verifications.map((v) => v.organisme)];

  // Sites : liste, ajout, modification.
  function modaleSites() {
    const t = auj();
    const corps = `
      <ul class="liste-sites">${E.sites.map((s) => { const x = R.synthese(E, t, s.id); return `<li><div><b>${esc(s.nom)}</b><span>${[B.typesSite.find((y) => y.id === s.type)?.nom, s.adresse].filter(Boolean).map(esc).join(' · ')} · ${pluriel(x.nb, 'contrôle')}</span></div><button type="button" class="btn petit" data-action="site" data-id="${s.id}">Modifier</button></li>`; }).join('')}</ul>
      <div class="rang"><button type="button" class="btn petit primaire" data-action="site">${ICONES.plus}Ajouter un site</button></div>`;
    ouvrirModale('Sites', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
  }

  function modaleSite(id) {
    const s = id ? site(id) : null;
    const v = s || { nom: '', adresse: '', type: 'travail', categorie: '', note: '' };
    const n = s ? E.equipements.filter((e) => e.site === s.id).length : 0;
    const corps = `
      <label class="champ">Nom du site<input name="nom" required maxlength="80" value="${esc(v.nom)}" placeholder="Ex. : Atelier, Magasin du centre"></label>
      <label class="champ">Adresse <small>Facultative, reprise sur le registre.</small><input name="adresse" maxlength="160" value="${esc(v.adresse)}"></label>
      <fieldset class="champ"><legend>Ce site est surtout</legend><div class="choix-statut deux">${B.typesSite.map((x) => `<label title="${esc(x.detail)}"><input type="radio" name="type" value="${x.id}" ${x.id === v.type ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Type et catégorie d'ERP <small>Facultatif (ex. : type M, 3e catégorie).</small><input name="categorie" maxlength="40" value="${esc(v.categorie)}"></label>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = s
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${E.sites.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`
      : '<button class="btn primaire" value="ok">Créer le site</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(s ? `Modifier ${esc(s.nom)}` : 'Nouveau site', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${s.nom} »${n ? ` et ses ${pluriel(n, 'équipement')} (vérifications et observations comprises)` : ''} ?`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerSite(E, s.id);
        if (filtre.site === s.id) filtre.site = '';
        sauver(); rendre(); toast(`« ${s.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au site.';
      retenir();
      const donnees = R.normaliserSite({ id: s?.id || uid(), nom, adresse: fd.get('adresse'), type: fd.get('type'), categorie: fd.get('categorie'), note: fd.get('note') });
      if (s) Object.assign(s, donnees); else E.sites.push(donnees);
      sauver(); rendre();
      toast(s ? `« ${nom} » enregistré.` : `Site « ${nom} » créé.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function texteSourceType(code) {
    const t = R.typeDe(code);
    if (t.nature === 'saisie') return 'Aucune périodicité dans la base : saisis la tienne ci-dessous, d\'après le texte qui s\'applique ou la préconisation de l\'organisme.';
    return `<b>${R.libellePeriode(t.jours ? { jours: t.jours } : { mois: t.mois })}</b>${t.allegeeMois ? ' (ou 2 ans sous conditions)' : ''} · ${t.nature === 'referentiel' ? 'référentiel, pas un texte de loi' : 'réglementaire'} · ${esc(t.champ)}<br>${esc(t.textes)}. Source : <a href="${esc(B.source.url)}" target="_blank" rel="noopener">INRS ED 828</a>, p. ${t.page}, consultée le ${esc(B.source.consulte)}.`;
  }

  // Nouvel équipement (id absent) ou équipement existant.
  function modaleEquipement(id, siteId) {
    const a = id ? equipement(id) : null;
    if (id && !a) return;
    const v = a || { site: siteId || filtre.site || E.sites[0]?.id, nom: '', type: 'ELEC', localisation: '', reference: '', organisme: '', derniereConnue: null, prochaineFixee: null, periodeSaisie: null, allegement: false, inactif: false, note: '' };
    const ps = v.periodeSaisie;
    const psNombre = ps ? (ps.jours ? (ps.jours % 7 === 0 ? ps.jours / 7 : ps.jours) : ps.mois) : '';
    const psUnite = ps ? (ps.jours ? (ps.jours % 7 === 0 ? 'semaines' : 'jours') : 'mois') : 'mois';
    const corps = `
      <div class="rang-champs">
        <label class="champ">Site<select name="site">${optionsSites(v.site, false)}</select></label>
        <label class="champ">Type de contrôle<select name="type" id="eq-type">${B.familles.map((f) => `<optgroup label="${esc(f)}">${B.types.filter((t) => t.famille === f).map((t) => `<option value="${t.code}" ${t.code === v.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      </div>
      <p class="source-type" id="eq-source"></p>
      <label class="champ">Nom de l'équipement<input name="nom" maxlength="100" value="${esc(v.nom)}" placeholder="Ex. : TGBT du bâtiment A, Porte de quai 3"></label>
      <div class="rang-champs">
        <label class="champ">Localisation <small>Facultative.</small><input name="localisation" maxlength="100" value="${esc(v.localisation)}"></label>
        <label class="champ">Référence <small>N° de série, repère, nombre d'appareils…</small><input name="reference" maxlength="60" value="${esc(v.reference)}"></label>
      </div>
      <label class="champ">Organisme vérificateur habituel <small>Organisme, entreprise ou « service interne ».</small><input name="organisme" list="l-org" maxlength="100" value="${esc(v.organisme)}"></label>
      <div class="rang-champs">
        <label class="champ">Dernière vérification connue <small>Date du dernier rapport, avant l'outil.</small><input type="date" name="derniereConnue" max="${auj()}" value="${v.derniereConnue || ''}"></label>
        <label class="champ">Date fixée <small>Facultative : échéance imposée par le rapport ou une mise en demeure.</small><input type="date" name="prochaineFixee" value="${v.prochaineFixee || ''}"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Périodicité <small id="eq-ps-aide">Laisse vide pour appliquer celle de la base.</small></legend>
        <div class="rang-champs"><label class="champ" style="flex:0 1 120px">Tous les<input name="psNombre" inputmode="numeric" value="${psNombre}" placeholder="–"></label>
        <label class="champ" style="flex:0 1 160px">Unité<select name="psUnite">${['mois', 'semaines', 'jours'].map((u) => `<option ${u === psUnite ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
        <p class="mention">Une périodicité saisie remplace celle de la base et s'affiche « saisie par toi » sur le registre (par exemple une périodicité plus courte décidée par l'entreprise).</p>
      </fieldset>
      <label class="case" id="eq-allegement"><input type="checkbox" name="allegement" ${v.allegement ? 'checked' : ''}> Appliquer le délai de 2 ans quand c'est possible (dernier rapport sans observation, ou observations levées avant l'échéance)</label>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="400" value="${esc(v.note)}"></label>
      ${a ? `<label class="case"><input type="checkbox" name="inactif" ${a.inactif ? 'checked' : ''}> Hors service (retiré : hors alertes, historique gardé)</label>` : ''}
      ${listeDonnees('l-org', organismes())}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter l\'équipement</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? `Modifier ${esc(a.nom)}` : 'Nouvel équipement', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        const n = E.verifications.filter((x) => x.equipement === a.id).length;
        if (!confirm(`Supprimer « ${a.nom} »${n ? ` et ses ${pluriel(n, 'vérification')}` : ''} ? Pour un équipement retiré, coche plutôt « Hors service » : l'historique reste au registre.`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerEquipement(E, a.id);
        sauver(); rendre(); toast(`« ${a.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const type = fd.get('type');
      const ps = R.lirePeriode(fd.get('psNombre'), fd.get('psUnite'));
      if (Number.isNaN(ps)) return 'Périodicité illisible : un nombre entier, par exemple 12 (mois).';
      if (R.typeDe(type).nature === 'saisie' && !ps) return 'Ce contrôle n\'a pas de périodicité dans la base : saisis-la (par exemple 12 mois).';
      const der = fd.get('derniereConnue');
      if (der && der > auj()) return 'La dernière vérification ne peut pas être dans le futur.';
      retenir();
      const donnees = R.normaliserEquipement({ id: a?.id || uid(), site: fd.get('site'), nom: String(fd.get('nom') || '').trim() || R.typeDe(type).nom, type, localisation: fd.get('localisation'), reference: fd.get('reference'), organisme: fd.get('organisme'), derniereConnue: der, prochaineFixee: fd.get('prochaineFixee'), periodeSaisie: ps, allegement: !!fd.get('allegement'), inactif: !!fd.get('inactif'), note: fd.get('note') });
      if (a) Object.assign(a, donnees); else E.equipements.push(donnees);
      sauver(); rendre();
      const s = R.situation(donnees, E, auj());
      toast(`« ${donnees.nom} » ${a ? 'enregistré' : 'ajouté'}${s.prochaine ? ` : prochaine échéance le ${dateCourte(s.prochaine)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const code = d.querySelector('#eq-type').value;
      d.querySelector('#eq-source').innerHTML = texteSourceType(code);
      d.querySelector('#eq-allegement').hidden = !R.typeDe(code).allegeeMois;
      d.querySelector('#eq-ps-aide').textContent = R.typeDe(code).nature === 'saisie' ? 'Obligatoire pour un autre contrôle.' : 'Laisse vide pour appliquer celle de la base.';
    };
    d.querySelector('#eq-type').addEventListener('change', maj);
    maj();
  }

  // Fiche d'un équipement : situation, source, observations à lever, historique.
  function modaleDetail(id) {
    const t = auj();
    const e = equipement(id);
    if (!e) return;
    const s = R.situation(e, E, t);
    const corps = `
      <div class="resume-facture">
        <div><span>Prochaine échéance</span><b>${s.prochaine ? dateCourte(s.prochaine) : '–'}</b><small>${etiquetteStatut(s.statut)} ${s.prochaine ? dans(s.jours) : ''}</small></div>
        <div><span>Dernière vérification</span><b>${s.derniere ? dateCourte(s.derniere) : '–'}</b><small>${s.verifications[0] ? libResultat(s.verifications[0].resultat) : s.derniere ? 'Date saisie à la création' : 'À renseigner'}</small></div>
        <div><span>Périodicité</span><b>${libPeriode(s.periode)}</b><small>${libSource(s.periode)}</small></div>
        <div><span>Organisme</span><b class="petit-b">${esc(e.organisme) || '–'}</b><small>${esc(nomSite(e.site))}</small></div>
      </div>
      <p class="mention">${[esc(s.type.nom), e.localisation && esc(e.localisation), e.reference && esc(e.reference)].filter(Boolean).join(' · ')}</p>
      ${e.prochaineFixee ? `<p class="aide">Date fixée au ${dateLongue(e.prochaineFixee)} (rapport ou mise en demeure) : elle remplace le calcul jusqu'à la prochaine vérification.</p>` : ''}
      ${s.allegement && e.allegement ? `<p class="aide">Délai de 2 ans demandé : ${s.periode?.origine === 'allegee' ? 'appliqué' : 'non appliqué'}. ${esc(s.allegement.raison)}</p>` : ''}
      ${e.note ? `<p class="aide">${esc(e.note)}</p>` : ''}
      ${s.type.nature !== 'saisie' ? `<details class="tableau-details"><summary>Source de la périodicité</summary><p class="mention">${texteSourceType(e.type)}</p><p class="mention">${esc(s.type.resume)}</p></details>` : ''}
      ${e.inactif ? '' : `<div class="rang"><button type="button" class="btn petit primaire" data-action="verification" data-id="${e.id}">Vérification faite</button></div>`}
      <section class="bloc-detail"><h3>Observations à lever <span>${s.obsOuvertes.length}</span></h3>
        ${s.obsOuvertes.length ? `<ul class="mini-obs">${s.obsOuvertes.map((o) => `<li>${etiquetteGravite(o.gravite)}<button type="button" class="lien-ligne" data-action="observation" data-id="${o.id}"><b>${esc(o.texte)}</b><span>${o.echeance ? `à lever avant le ${dateCourte(o.echeance)}` : 'sans échéance'}${o.responsable ? ` · ${esc(o.responsable)}` : ''}</span></button><button type="button" class="btn petit" data-action="lever" data-id="${o.id}">Lever</button></li>`).join('')}</ul>` : '<p class="mention">Aucune observation ouverte.</p>'}
      </section>
      <section class="bloc-detail"><h3>Historique <span>${pluriel(s.verifications.length, 'vérification')}</span></h3>
        ${s.verifications.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th>Organisme</th><th>Rapport</th><th>Résultat</th><th></th></tr></thead>
        <tbody>${s.verifications.map((v) => `<tr><td class="nb">${dateCourte(v.date)}</td><td>${esc(v.organisme) || '–'}</td><td>${v.rapport || v.lien ? lienExterne(v.lien, v.rapport || 'Lien') : '–'}</td><td>${libResultat(v.resultat)}${R.obsDe(E, v.id).length ? ` · ${pluriel(R.obsDe(E, v.id).length, 'obs.', 'obs.')}` : ''}</td><td><button type="button" class="btn-suppr" data-action="suppr-verif" data-id="${v.id}" data-retour="${e.id}" aria-label="Supprimer cette vérification">×</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="mention">Aucune vérification enregistrée dans l\'outil.</p>'}
      </section>`;
    ouvrirModale(esc(e.nom), corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier" data-id="${e.id}">Modifier la fiche</button>`);
  }

  // Saisie d'une vérification (équipement choisi ou à choisir), avec ses observations.
  function modaleVerification(eqId) {
    const actifs = E.equipements.filter((x) => !x.inactif);
    if (!actifs.length) { toast('Ajoute d\'abord un équipement.'); modaleEquipement(null); return; }
    const e0 = equipement(eqId) || actifs[0];
    const corps = `
      <label class="champ">Équipement<select name="equipement" id="v-eq">${E.sites.map((s) => { const eqs = actifs.filter((x) => x.site === s.id); return eqs.length ? `<optgroup label="${esc(s.nom)}">${eqs.map((x) => `<option value="${x.id}" ${x.id === e0.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Date de la vérification<input type="date" name="date" required max="${auj()}" value="${auj()}"></label>
        <label class="champ">Organisme<input name="organisme" id="v-org" list="l-org" maxlength="100"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Référence du rapport <small>N° du rapport, du PV ou de la page du registre.</small><input name="rapport" maxlength="80" placeholder="Ex. : RAP-2026-0412"></label>
        <label class="champ">Lien vers le rapport <small>Facultatif : Drive, serveur, GED…</small><input name="lien" type="url" inputmode="url" maxlength="500" placeholder="https://"></label>
      </div>
      <label class="champ">Intervenant <small>Facultatif.</small><input name="intervenant" maxlength="80"></label>
      <fieldset class="champ"><legend>Résultat</legend><div class="choix-statut trois">${B.resultats.map((r, i) => `<label><input type="radio" name="resultat" value="${r.id}" ${i === 0 ? 'checked' : ''}><span>${esc(r.nom)}</span></label>`).join('')}</div></fieldset>
      <div id="v-obs" hidden>
        <p class="mention">Une ligne par observation du rapport. L'échéance de levée se propose selon la gravité (réglable) ; tu peux la changer.</p>
        <ol class="saisie-obs" id="v-obs-liste"></ol>
        <button type="button" class="btn petit" data-action="ajout-obs">${ICONES.plus}Ajouter une observation</button>
      </div>
      <label class="champ">Date fixée pour la prochaine <small>Facultative : seulement si le rapport impose une autre échéance.</small><input type="date" name="prochaineFixee"></label>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="400"></label>
      <p class="aide" id="v-apres"></p>
      ${listeDonnees('l-org', organismes())}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Vérification faite', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lignes = [...modale().querySelectorAll('.saisie-obs li')].map((li) => ({ texte: li.querySelector('[data-o=texte]').value, gravite: li.querySelector('[data-o=gravite]').value, echeance: li.querySelector('[data-o=echeance]').value, responsable: li.querySelector('[data-o=responsable]').value }));
      const resultat = fd.get('resultat');
      retenir();
      const r = R.ajouterVerification(E, { equipement: fd.get('equipement'), date: fd.get('date'), organisme: fd.get('organisme'), intervenant: fd.get('intervenant'), rapport: fd.get('rapport'), lien: fd.get('lien'), resultat, observations: resultat === 'conforme' ? [] : lignes, prochaineFixee: fd.get('prochaineFixee'), note: fd.get('note') }, auj(), uid);
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      const eq = equipement(r.equipement);
      const s = R.situation(eq, E, auj());
      const nObs = R.obsDe(E, r.id).length;
      toast(`Vérification enregistrée${nObs ? ` avec ${pluriel(nObs, 'observation')}` : ''}. Prochaine : ${s.prochaine ? dateCourte(s.prochaine) : 'à définir'}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const ajoutLigne = () => {
      const li = document.createElement('li');
      li.innerHTML = `<label class="champ">Observation<input data-o="texte" maxlength="400" placeholder="Ex. : Absence de protection 30 mA sur la prise PC 12"></label>
        <div class="rang-champs"><label class="champ">Gravité<select data-o="gravite">${B.gravites.map((g) => `<option value="${g.id}" ${g.id === 'majeure' ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}</select></label>
        <label class="champ">À lever avant<input type="date" data-o="echeance"></label>
        <label class="champ">Responsable <small>Fonction.</small><input data-o="responsable" maxlength="80"></label></div>
        <button type="button" class="btn-suppr" aria-label="Retirer cette observation">×</button>`;
      const majEch = () => { const date = d.querySelector('[name=date]').value; const g = li.querySelector('[data-o=gravite]').value; const ech = li.querySelector('[data-o=echeance]'); if (!ech.dataset.touche && R.estDate(date)) ech.value = ajout(date, E.reglages.levee[g] ?? 30); };
      li.querySelector('[data-o=gravite]').addEventListener('change', majEch);
      li.querySelector('[data-o=echeance]').addEventListener('input', (ev) => { ev.target.dataset.touche = '1'; });
      li.querySelector('.btn-suppr').addEventListener('click', () => li.remove());
      d.querySelector('#v-obs-liste').append(li);
      majEch();
      li.querySelector('[data-o=texte]').focus();
    };
    const maj = () => {
      const eq = equipement(d.querySelector('#v-eq').value);
      const org = d.querySelector('#v-org');
      if (!org.dataset.touche) org.value = eq.organisme || '';
      const res = d.querySelector('[name=resultat]:checked').value;
      const bloc = d.querySelector('#v-obs');
      bloc.hidden = res === 'conforme';
      if (!bloc.hidden && !d.querySelector('.saisie-obs li')) ajoutLigne();
      const date = d.querySelector('[name=date]').value;
      const p = R.periode(eq, E);
      d.querySelector('#v-apres').innerHTML = p && R.estDate(date) ? `Prochaine échéance calculée : <b>${dateLongue(R.avancer(date, p))}</b> (${libPeriode(p).toLowerCase()}, ${libSource(p)}).` : 'Pas de périodicité pour cet équipement : saisis-la dans sa fiche pour calculer la prochaine échéance.';
      d.querySelectorAll('.saisie-obs li').forEach((li) => { const ech = li.querySelector('[data-o=echeance]'); if (!ech.dataset.touche && R.estDate(date)) ech.value = ajout(date, E.reglages.levee[li.querySelector('[data-o=gravite]').value] ?? 30); });
    };
    d.querySelector('#v-org').addEventListener('input', (ev) => { ev.target.dataset.touche = '1'; });
    d.querySelector('#v-eq').addEventListener('change', maj);
    d.querySelector('[name=date]').addEventListener('change', maj);
    d.querySelectorAll('[name=resultat]').forEach((x) => x.addEventListener('change', maj));
    d.querySelector('[data-action=ajout-obs]').addEventListener('click', (ev) => { ev.stopPropagation(); ajoutLigne(); });
    maj();
  }

  // Levée d'une observation, avec sa preuve.
  function modaleLever(id) {
    const o = E.observations.find((x) => x.id === id);
    if (!o) return;
    const eq = equipement(o.equipement);
    const corps = `
      <p class="aide"><b>${esc(o.texte)}</b><br>${esc(eq?.nom)} · constatée le ${dateCourte(o.constateLe)}${o.echeance ? ` · à lever avant le ${dateCourte(o.echeance)}` : ''}</p>
      <label class="champ">Levée le<input type="date" name="date" required max="${auj()}" value="${auj()}"></label>
      <div class="rang-champs">
        <label class="champ">Preuve <small>Référence de la facture, du bon d'intervention, de la photo…</small><input name="preuve" maxlength="120"></label>
        <label class="champ">Lien vers la preuve <small>Facultatif.</small><input name="lien" type="url" inputmode="url" maxlength="500" placeholder="https://"></label>
      </div>
      <label class="champ">Note <small>Facultative : ce qui a été fait.</small><input name="note" maxlength="300"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Lever l\'observation', corps, '<button class="btn primaire" value="ok">Lever</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      retenir();
      const r = R.leverObservation(E, id, { date: fd.get('date'), preuve: fd.get('preuve'), lien: fd.get('lien'), note: fd.get('note') }, auj());
      if (typeof r === 'string') { annulation = null; return r; }
      sauver(); rendre();
      toast('Observation levée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Modifier une observation (texte, gravité, échéance, responsable), la rouvrir ou la supprimer.
  function modaleObservation(id) {
    const o = E.observations.find((x) => x.id === id);
    if (!o) return;
    const eq = equipement(o.equipement);
    const v = E.verifications.find((x) => x.id === o.verification);
    const corps = `
      <p class="mention">${esc(eq?.nom)} · ${esc(nomSite(eq?.site))}${v ? ` · rapport du ${dateCourte(v.date)}${v.rapport ? ` (${v.lien ? lienExterne(v.lien, v.rapport) : esc(v.rapport)})` : ''}` : ''}</p>
      <label class="champ">Observation<textarea name="texte" rows="3" maxlength="400">${esc(o.texte)}</textarea></label>
      <div class="rang-champs">
        <label class="champ">Gravité<select name="gravite">${B.gravites.map((g) => `<option value="${g.id}" ${g.id === o.gravite ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}</select></label>
        <label class="champ">À lever avant<input type="date" name="echeance" value="${o.echeance || ''}"></label>
        <label class="champ">Responsable<input name="responsable" maxlength="80" value="${esc(o.responsable)}"></label>
      </div>
      ${o.statut === 'levee' ? `<p class="aide">Levée le ${dateLongue(o.leveeLe)}${o.preuve ? ` · preuve : ${esc(o.preuve)}` : ''}${o.lienPreuve ? ` · ${lienExterne(o.lienPreuve, 'voir la preuve')}` : ''}${o.noteLevee ? `<br>${esc(o.noteLevee)}` : ''}</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button>${o.statut === 'levee' ? '<button class="btn" value="rouvrir">Rouvrir</button>' : '<button class="btn" type="button" data-action="lever" data-id="' + o.id + '">Lever</button>'}<button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>`;
    ouvrirModale('Observation', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm('Supprimer cette observation ?')) { garderOuverte(); return; }
        retenir();
        E.observations = E.observations.filter((x) => x.id !== id);
        sauver(); rendre(); toast('Observation supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      retenir();
      if (action === 'rouvrir') { R.rouvrirObservation(E, id); sauver(); rendre(); toast('Observation rouverte.', { libelle: 'Annuler', faire: annuler }); return; }
      const texte = String(fd.get('texte') || '').trim();
      if (!texte) { annulation = null; return 'Décris l\'observation.'; }
      Object.assign(o, R.normaliserObservation({ ...o, texte, gravite: fd.get('gravite'), echeance: fd.get('echeance'), responsable: fd.get('responsable') }));
      sauver(); rendre(); toast('Observation enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function supprimerVerification(id, retour) {
    const v = E.verifications.find((x) => x.id === id);
    if (!v) return;
    const n = R.obsDe(E, id).length;
    if (!confirm(`Supprimer la vérification du ${dateLongue(v.date)}${n ? ` et ses ${pluriel(n, 'observation')}` : ''} ?`)) return;
    retenir();
    E = R.supprimerVerification(E, id);
    sauver(); rendre();
    if (retour) modaleDetail(retour);
    toast('Vérification supprimée.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <label class="champ">Ton entreprise ou ta structure<input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <label class="champ">Prévenir avant l'échéance (jours) <small>Les contrôles fréquents utilisent au plus le tiers de leur périodicité.</small><input type="number" name="alerteJours" min="7" max="180" value="${r.alerteJours}"></label>
      <fieldset class="champ cadre-champs"><legend>Délai de levée proposé selon la gravité (jours) <small>Choix d'organisation, pas des délais légaux ; modifiable à chaque observation.</small></legend>
        <div class="rang-champs">${B.gravites.map((g) => `<label class="champ">${esc(g.nom)}<input type="number" name="levee-${g.id}" min="0" max="365" value="${r.levee[g.id]}"></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tableur (CSV, point-virgule) : registre complet avec la source de chaque périodicité, ou toutes les observations.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-registre">Registre (CSV)</button><button class="btn petit" type="button" data-action="csv-observations">Observations (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton registre est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application pendant une visite de site ou le passage d'un organisme.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Périodicités : ${esc(B.source.titre)}, ${esc(B.source.edition)}, consultée le ${esc(B.source.consulte)} ; à revérifier à chaque nouvelle édition. Pas de stockage de fichiers : les rapports et preuves restent dans ton espace documentaire, l'outil en garde la référence et le lien. Outil d'aide : il ne remplace ni un organisme agréé ni la réglementation.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Number(fd.get(nom)); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
      const alerteJours = ent('alerteJours', 7, 180);
      if (alerteJours === null) return 'Prévenir entre 7 et 180 jours avant l\'échéance.';
      const levee = {};
      for (const g of B.gravites) { const n = ent(`levee-${g.id}`, 0, 365); if (n === null) return 'Délais de levée : entre 0 et 365 jours.'; levee[g.id] = n; }
      retenir();
      E.structure = String(fd.get('structure') || '').trim();
      Object.assign(E.reglages, { alerteJours, levee });
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.sites) || !Array.isArray(d.equipements)) throw new Error();
        if (!confirm(`Remplacer ton registre actuel par cette copie (${pluriel(d.sites.length, 'site')}, ${pluriel(d.equipements.length, 'équipement')}) ?`)) return;
        E = R.normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du registre.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `verifications-${auj()}.json`);

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
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'voir-site': filtre.site = id; filtre.statut = 'tous'; changerVue('equipements'); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-registre': telecharger(R.versCsvRegistre(E, auj(), vue === 'registre' ? filtre.registre : ''), 'text/csv;charset=utf-8', `registre-verifications-${auj()}.csv`); break;
      case 'csv-observations': telecharger(R.versCsvObservations(E, auj()), 'text/csv;charset=utf-8', `observations-${auj()}.csv`); break;
      case 'imprimer': setTimeout(() => window.print(), 50); break;
      case 'fermer': modale().close(); break;
      case 'sites': modaleSites(); break;
      case 'site': modaleSite(id); break;
      case 'nouvel-equipement': modaleEquipement(null); break;
      case 'ouvrir': modaleDetail(id); break;
      case 'modifier': modaleEquipement(id); break;
      case 'verification': modaleVerification(id); break;
      case 'lever': modaleLever(id); break;
      case 'observation': modaleObservation(id); break;
      case 'suppr-verif': supprimerVerification(id, el.dataset.retour); break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      case 'filtre-obs': filtre.obs = el.dataset.statut; rendre(); break;
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
        E = R.normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__verifications = { etat: () => E, regles: R };
  init();
})();
