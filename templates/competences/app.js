// Matrice compétences et formations QME : personnes × compétences, niveaux, écarts au niveau requis par le poste,
// compétences critiques peu couvertes, plan de formation avec budget, historique des évaluations.
// Données synchronisées par clé de licence ou code d'accès. Aucune intégration à un logiciel RH, aucun lien externe.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.FRM;
  const API = '/api/templates';
  const PRODUIT = 'FRM';
  const CLE_CODE = 'qme-frm-code';
  const CLE_CACHE = 'qme-frm-cache';
  const CLE_DEMO = 'qme-frm-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-frm-ecran-accueil';

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
  const { ajout, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o).replace('.', '');
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  const euros = (n) => `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: n % 1 ? 2 : 0 })} €`;
  const heures = (n) => `${String(n).replace('.', ',')} h`;
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const quand = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let fiche = null; // personne ouverte dans l'onglet Personnes
  const filtre = { equipe: 'toutes', domaine: 'tous', portee: 'requises', mode: 'niveaux', q: '', annee: null, statut: 'tous', ref: 'competences', poste: null };
  let annulation = null;
  let ordre = 0; // départage des évaluations saisies le même jour

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, B), tutorielVu: Boolean(d?.tutorielVu) });
  const personne = (id) => E.personnes.find((p) => p.id === id);
  const competence = (id) => E.competences.find((c) => c.id === id);
  const poste = (id) => E.postes.find((p) => p.id === id);
  const domaine = (id) => E.domaines.find((d) => d.id === id);
  const formation = (id) => E.formations.find((f) => f.id === id);
  const maxNiv = () => E.reglages.echelle.length - 1;
  const nomNiv = (n) => E.reglages.echelle[n]?.nom || `Niveau ${n}`;
  const equipes = () => [...new Set(E.personnes.map((p) => p.equipe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const prochainOrdre = () => { ordre = Math.max(ordre, ...E.evaluations.map((e) => e.ordre || 0)) + 1; return ordre; };

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
        toast('Un autre appareil a modifié la matrice entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (FRM-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; fiche = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // PME fictive de 12 personnes en 6 équipes. Deux campagnes d'entretiens (il y a 14 mois et il y a 2 mois, une
  // personne non réévaluée), une arrivée récente jamais évaluée, des compétences critiques tenues par une seule
  // personne ou par personne, et un plan de formation qui couvre tous les statuts (réalisée avec niveau après,
  // validée à venir, à confirmer, envisagée sans date, annulée, tutorat sans coût), budget de l'année et de la suivante.
  function donneesDemo() {
    const e = etatVide();
    e.entreprise = 'Ateliers Brunet (fictif)';
    const t = auj();
    const an = Number(t.slice(0, 4));
    e.reglages.budgets = { [an]: 9000, [an + 1]: 12000 };
    let graine = 7;
    const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
    const gens = [
      ['Camille R.', 'assistant', 'Administration', -1300], ['Nadia K.', 'assistant', 'Administration', -21],
      ['Inès M.', 'clientele', 'Service client', -900], ['Hugo T.', 'clientele', 'Service client', -600],
      ['Yanis B.', 'technicien', 'Atelier', -2400], ['Marc V.', 'technicien', 'Atelier', -700],
      ['Léa F.', 'logistique', 'Atelier', -500], ['Sophie D.', 'chef-equipe', 'Atelier', -3100],
      ['Thomas L.', 'commercial', 'Commercial', -800], ['Julie P.', 'manager', 'Commercial', -1600],
      ['Karim A.', 'qualite', 'Qualité', -1100], ['Élise G.', 'chef-projet', 'Direction', -1000],
    ];
    for (const [nom, posteId, equipe, entree] of gens) e.personnes.push(R.normaliserPersonne({ id: uid(), nom, posteId, equipe, entree: ajout(t, entree) }, e.postes));
    const p = (nom) => e.personnes.find((x) => x.nom === nom);
    let o = 0;
    const evaluer = (x, cid, niveau, date, source = 'entretien', note = '') => e.evaluations.push(R.normaliserEvaluation({ id: uid(), personneId: x.id, competenceId: cid, niveau, date, source, note, ordre: ++o }, 4));
    const campagne1 = ajout(t, -425), campagne2 = ajout(t, -62);
    // Campagnes : niveau = requis + décalage tiré, un peu plus bas à la première.
    for (const x of e.personnes) {
      if (x.nom === 'Nadia K.') continue; // arrivée récente : rien d'évalué
      const req = e.postes.find((q) => q.id === x.posteId).requis;
      for (const [cid, n] of Object.entries(req)) {
        const d = [-2, -1, 0, 0, 0, 0, 0, 1, 1][Math.floor(alea() * 9)];
        const v2 = Math.max(0, Math.min(4, n + d));
        evaluer(x, cid, Math.max(0, v2 - (alea() < 0.45 ? 1 : 0)), campagne1);
        if (x.nom !== 'Marc V.') evaluer(x, cid, v2, campagne2);
      }
    }
    // Valeurs imposées pour la démonstration (dernière évaluation de la cellule).
    const fixer = (nom, cid, niveau, date = campagne2, source = 'entretien', note = '') => evaluer(p(nom), cid, niveau, date, source, note);
    fixer('Yanis B.', 'tec-diagnostic', 4); fixer('Yanis B.', 'sec-electrique', 2); fixer('Yanis B.', 'sec-risques', 3); fixer('Yanis B.', 'sec-secours', 1);
    fixer('Marc V.', 'sec-electrique', 1, campagne1); fixer('Marc V.', 'sec-risques', 2, campagne1);
    fixer('Sophie D.', 'org-tutorat', 3); fixer('Sophie D.', 'sec-risques', 3); fixer('Sophie D.', 'sec-secours', 2);
    fixer('Léa F.', 'tec-conduite', 1); fixer('Léa F.', 'sec-gestes', 3);
    fixer('Inès M.', 'rel-reclamation', 4); fixer('Inès M.', 'rel-accueil', 4); fixer('Inès M.', 'rel-anglais', 3, campagne2, 'auto', 'Séjour professionnel à l\'étranger');
    fixer('Hugo T.', 'rel-reclamation', 1); fixer('Hugo T.', 'bur-cyber', 1);
    fixer('Thomas L.', 'rel-negociation', 2); fixer('Thomas L.', 'rel-anglais', 1);
    fixer('Julie P.', 'man-entretiens', 1); fixer('Julie P.', 'man-tensions', 2);
    fixer('Karim A.', 'qua-audit', 2); fixer('Karim A.', 'org-tutorat', 2, campagne2, 'observation');
    fixer('Élise G.', 'pro-risques', 2); fixer('Élise G.', 'bur-cyber', 3, campagne2, 'manager');
    fixer('Camille R.', 'bur-cyber', 2); fixer('Nadia K.', 'bur-texte', 2, ajout(t, -9), 'auto', 'Auto-évaluation à l\'arrivée');
    // Plan de formation.
    const F = (x) => e.formations.push(R.normaliserFormation({ id: uid(), ...x, personneId: p(x.personneId).id }, 4));
    const realisee = (x, date) => {
      F({ ...x, statut: 'realisee', date });
      const f = e.formations[e.formations.length - 1];
      e.evaluations.push(R.normaliserEvaluation(R.evaluationApres(f, ajout(date, 7), ++o), 4));
    };
    realisee({ intitule: 'Diagnostic des pannes électriques et automatismes', personneId: 'Marc V.', competenceId: 'tec-diagnostic', modalite: 'externe', organisme: 'Organisme de formation régional', duree: 14, cout: 980, niveauVise: 3, niveauApres: 2 }, ajout(t, -150));
    realisee({ intitule: 'Tableur : tableaux croisés et graphiques', personneId: 'Camille R.', competenceId: 'bur-tableur', modalite: 'distance', organisme: 'Formation en ligne', duree: 7, cout: 290, niveauVise: 3, niveauApres: 3 }, ajout(t, -95));
    realisee({ intitule: 'Devenir tuteur d\'un nouvel arrivant', personneId: 'Karim A.', competenceId: 'org-tutorat', modalite: 'interne', organisme: 'Animée par la cheffe d\'équipe atelier', duree: 3.5, cout: 0, niveauVise: 3, niveauApres: 3 }, ajout(t, -30));
    F({ intitule: 'Binôme diagnostic avec un technicien confirmé', personneId: 'Marc V.', competenceId: 'tec-diagnostic', modalite: 'tutorat', organisme: 'En interne', duree: 21, cout: 0, statut: 'validee', date: ajout(t, 9), niveauVise: 3 });
    F({ intitule: 'Conduite d\'équipements de manutention', personneId: 'Léa F.', competenceId: 'tec-conduite', modalite: 'externe', organisme: 'Centre de formation à la conduite', duree: 21, cout: 1150, statut: 'validee', date: ajout(t, 18), niveauVise: 2 });
    F({ intitule: 'Gestes de premiers secours', personneId: 'Yanis B.', competenceId: 'sec-secours', modalite: 'externe', organisme: 'Organisme agréé à choisir', duree: 14, cout: 420, statut: 'validee', date: ajout(t, 40), niveauVise: 2 });
    F({ intitule: 'Négociation : traiter les objections', personneId: 'Thomas L.', competenceId: 'rel-negociation', modalite: 'externe', organisme: 'Cabinet de formation commerciale', duree: 14, cout: 1290, statut: 'validee', date: ajout(t, -6), niveauVise: 3, note: 'Présence à confirmer auprès de l\'organisme.' });
    F({ intitule: 'Gérer les réclamations difficiles', personneId: 'Hugo T.', competenceId: 'rel-reclamation', modalite: 'externe', duree: 7, cout: 540, statut: 'envisagee', date: ajout(t, 26), niveauVise: 3 });
    F({ intitule: 'Conduire ses entretiens annuels', personneId: 'Julie P.', competenceId: 'man-entretiens', modalite: 'externe', duree: 7, cout: 650, statut: 'envisagee', date: ajout(t, 75), niveauVise: 3 });
    F({ intitule: 'Anglais professionnel, parcours à distance', personneId: 'Thomas L.', competenceId: 'rel-anglais', modalite: 'distance', duree: 30, cout: 900, statut: 'envisagee', niveauVise: 2 });
    F({ intitule: 'Audit interne : méthode et restitution', personneId: 'Karim A.', competenceId: 'qua-audit', modalite: 'externe', duree: 14, cout: 1100, statut: 'annulee', date: ajout(t, -35), niveauVise: 3, note: 'Session annulée par l\'organisme, à reprogrammer.' });
    F({ intitule: 'Accueil d\'un poste administratif', personneId: 'Nadia K.', competenceId: 'bur-fichiers', modalite: 'tutorat', organisme: 'Avec une collègue de l\'équipe', duree: 7, cout: 0, statut: 'validee', date: ajout(t, 3), niveauVise: 3 });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Matrice compétences et formations · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="76" height="76" fill="#1D4E89"/><rect x="104" y="20" width="76" height="76" fill="#1D4E89" opacity=".55"/><rect x="188" y="20" width="76" height="76" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <rect x="20" y="104" width="76" height="76" fill="#1D4E89" opacity=".55"/><rect x="104" y="104" width="76" height="76" fill="#1D4E89"/><rect x="188" y="104" width="76" height="76" fill="#1D4E89" opacity=".3"/>
          <circle cx="80" cy="240" r="48" fill="#F5B400"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L300 150 A130 130 0 0 1 430 20 Z" fill="#D9302A"/>
          <rect x="430" y="150" width="60" height="60" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Matrice compétences et formations</p>
          <h1>Qui sait faire quoi.</h1>
          <p>Les compétences de ton équipe face à ce que chaque poste demande : les écarts se voient, les compétences tenues par une seule personne aussi, et le plan de formation part de là.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta matrice</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ta matrice est enregistrée en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma matrice</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de matrice ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma matrice'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, entreprise: '', domaines: new Set(B.domaines.map((d) => d.id)), postes: new Set(B.postes.map((p) => p.id)) });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    const nbComp = B.domaines.reduce((s, d) => s + d.competences.length, 0);
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Les compétences de ton équipe, d'un coup d'œil.</h1>
        <p class="intro">Tu pars d'un référentiel prêt : ${nbComp} compétences transverses en ${B.domaines.length} domaines, et ${B.postes.length} modèles de postes avec le niveau que chacun demande. Tu l'adaptes ensuite à ton entreprise.</p>
        <label class="champ" style="max-width:360px">Nom de l'entreprise ou du service <small>Facultatif, affiché sur le tableau de bord et à l'impression.</small>
          <input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="60">
        </label>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Garde ce qui te sert</h1>
        <p class="intro">Décoche les domaines et les postes qui ne concernent pas ton entreprise. Tout reste modifiable ensuite dans l'onglet Référentiel : compétences, niveaux requis, échelle.</p>
        <h2 class="titre-section" style="margin-top:0">Domaines de compétences</h2>
        <div class="choix-types">${B.domaines.map((d) => `<label class="groupe-types profil-choix"><span class="case"><input type="checkbox" data-action="choisir-domaine" value="${d.id}" ${a.domaines.has(d.id) ? 'checked' : ''}> <b>${esc(d.nom)}</b></span><span class="profil-desc">${esc(d.competences.slice(0, 3).map((c) => c.nom).join(', '))}…</span><span class="profil-nb">${pluriel(d.competences.length, 'compétence')}${d.competences.some((c) => c.critique) ? `, dont ${d.competences.filter((c) => c.critique).length} critique${d.competences.filter((c) => c.critique).length > 1 ? 's' : ''}` : ''}</span></label>`).join('')}</div>
        <h2 class="titre-section">Modèles de postes</h2>
        <div class="choix-types">${B.postes.map((p) => `<label class="groupe-types profil-choix"><span class="case"><input type="checkbox" data-action="choisir-poste" value="${p.id}" ${a.postes.has(p.id) ? 'checked' : ''}> <b>${esc(p.nom)}</b></span><span class="profil-nb">${pluriel(Object.keys(p.requis).length, 'compétence requise', 'compétences requises')}</span></label>`).join('')}</div>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma matrice</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
  }

  function terminerAccueil() {
    if (!accueil.domaines.size) { $('#erreur-accueil').textContent = 'Garde au moins un domaine (tu pourras le renommer et le vider ensuite).'; return; }
    E = { ...R.etatVide(B, { domaines: [...accueil.domaines], postes: [...accueil.postes] }), tutorielVu: false };
    E.entreprise = accueil.entreprise.trim();
    accueil = accueilVide();
    vue = 'personnes'; fiche = null;
    sauver();
    demarrer();
    toast('Ta matrice est prête. Ajoute les personnes de ton équipe avec leur poste.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    matrice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    personnes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    referentiel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const COURTS = { tableau: 'Tableau', plan: 'Formations', referentiel: 'Référentiel' };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['matrice', 'Matrice'], ['personnes', 'Personnes'], ['plan', 'Plan de formation'], ['referentiel', 'Référentiel']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation des compétences et de la formation : il ne remplace ni un conseil RH ou juridique, ni les obligations de ton entreprise (entretiens professionnels, formations obligatoires, autorisations et habilitations), qui se vérifient auprès des textes et de ta convention collective. Données minimales : prénom et initiale, poste, équipe, niveaux. Une évaluation de compétence n\'est jamais une sanction.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/competences/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Compétences<br>formations</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    if (fiche && !personne(fiche)) fiche = null;
    if (filtre.equipe !== 'toutes' && !equipes().includes(filtre.equipe)) filtre.equipe = 'toutes';
    if (filtre.domaine !== 'tous' && !domaine(filtre.domaine)) filtre.domaine = 'tous';
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${vue === 'personnes' && fiche ? personne(fiche).nom : titres[vue]} · Compétences et formations`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, matrice: vueMatrice, personnes: () => (fiche ? vueFiche(personne(fiche)) : vuePersonnes()), plan: vuePlan, referentiel: vueReferentiel }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, id = null) {
    vue = v; fiche = id;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="34" r="34" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  const rampe = () => B.rampes[maxNiv()] || B.rampes[4];
  const couleurNiv = (n) => (n > 0 ? rampe()[Math.min(n, maxNiv()) - 1] : null);
  // Texte foncé sur les deux tons clairs, blanc sur les plus foncés (contraste ≥ 4,5:1).
  const texteClair = (n) => n > 0 && n - 1 >= Math.ceil(maxNiv() / 2);
  function pastilleNiveau(n, { requis = 0 } = {}) {
    if (n === null || n === undefined) return '<span class="niv niv-vide" title="Non évalué">–</span>';
    const c = couleurNiv(n);
    return `<span class="niv ${texteClair(n) ? 'clair' : ''} ${n === 0 ? 'niv-zero' : ''}" style="${c ? `--n:${c}` : ''}" title="${esc(`${n} · ${nomNiv(n)}`)}">${n}</span>${requis ? `<span class="niv-req" title="Niveau requis">/${requis}</span>` : ''}`;
  }
  // Points de 1 à max, remplis jusqu'au niveau actuel, cerclés jusqu'au niveau requis.
  function jauge(actuel, requis) {
    const m = maxNiv();
    return `<span class="jauge" role="img" aria-label="Niveau ${actuel ?? 'non évalué'} sur ${m}${requis ? `, requis ${requis}` : ''}">${Array.from({ length: m }, (_, i) => {
      const n = i + 1;
      return `<i class="${actuel !== null && actuel >= n ? 'plein' : ''} ${requis >= n ? 'requis' : ''}" style="${actuel !== null && actuel >= n ? `--n:${couleurNiv(actuel)}` : ''}"></i>`;
    }).join('')}</span>`;
  }
  function etiquetteCellule(x) {
    if (x.statut === 'ok') return `<span class="etiquette ciel">${x.surplus ? `Au-delà (+${x.surplus})` : 'Atteint'}</span>`;
    if (x.statut === 'ecart') return `<span class="etiquette ${x.ecart >= 2 ? 'rouge' : 'jaune'}">Écart −${x.ecart}</span>`;
    if (x.statut === 'nonEvalue') return '<span class="etiquette sable">Non évalué</span>';
    return '<span class="etiquette">Non requis</span>';
  }
  const ETIQ_F = { realisee: ['ciel', 'Réalisée'], annulee: ['sable', 'Annulée'], aDater: ['', 'À dater'], aConfirmer: ['rouge', 'À confirmer'], aVenir: ['jaune', 'À venir'] };
  function etiquetteFormation(f, t) {
    const s = R.statutFormation(f, t);
    const [cl, lib] = ETIQ_F[s];
    return `<span class="etiquette ${cl}">${lib}${s === 'aVenir' && f.statut === 'envisagee' ? ' · envisagée' : s === 'aVenir' ? ' · validée' : s === 'aDater' && f.statut === 'validee' ? ' · validée' : ''}</span>`;
  }
  function barre(pct) {
    return `<span class="progres" role="img" aria-label="${pct ?? 0} %"><span style="width:${pct ?? 0}%"></span></span>`;
  }
  function tuile(lib, v, d, c, forme = '', cible = null) {
    const tag = cible ? 'button' : 'div';
    return `<${tag} class="tuile ${forme}" style="--c:${c}" ${cible ? `data-action="vue" data-vue="${cible}"` : ''}><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></${tag}>`;
  }
  const libCouverture = (x) => (x.nb === 0 ? `Personne au niveau ${x.reference}` : x.nb === 1 ? `Une seule personne au niveau ${x.reference} : ${x.titulaires[0].nom}` : `${x.nb} personnes au niveau ${x.reference}`);

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    if (!E.personnes.length) {
      return `<div class="vue-tete"><div><h1>${E.entreprise ? esc(E.entreprise) : 'Tableau de bord'}</h1><p>Aucune personne pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute ton équipe</h3><p>Prénom et initiale, poste, équipe : les compétences requises par le poste apparaissent aussitôt dans la matrice, prêtes à être évaluées.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-personne">${ICONES.plus}Une personne</button><button class="btn" data-action="vue" data-vue="referentiel">Voir le référentiel</button></div></div></div>${AVERTISSEMENT}`;
    }
    const idx = R.indexDernieres(E.evaluations);
    const ind = R.indicateurs(E, t);
    const fr = R.fragiles(E, {}, idx);
    const sans = R.ecartsSansAction(E, t, idx);
    const reev = R.aReevaluer(E, t, idx);
    const prochaines = E.formations.filter((f) => ['aConfirmer', 'aVenir'].includes(R.statutFormation(f, t))).sort((a, b) => a.date.localeCompare(b.date));
    const c = ind.conformite;
    const bu = ind.budget;
    const tuiles = [
      tuile('Exigences atteintes', c.pct === null ? '—' : `${c.pct} %`, `${c.ok} sur ${c.total} niveaux requis`, 'var(--bleu)', '', 'matrice'),
      tuile('Écarts à combler', c.ecarts, c.ecarts ? `${sans.length} sans formation prévue${c.nonEvalues ? ` · ${c.nonEvalues} non évalués` : ''}` : 'tous les niveaux requis sont atteints', 'var(--jaune)', '', 'plan'),
      tuile('Compétences fragiles', ind.fragiles, ind.fragiles ? `critiques tenues par moins de ${pluriel(E.reglages.seuilCouverture, 'personne')}` : 'chaque compétence critique est partagée', 'var(--rouge)', 'rond', 'matrice'),
      tuile(`Budget ${bu.annee}`, bu.budget ? euros(bu.engage) : euros(bu.prevu), bu.budget ? `engagés sur ${euros(bu.budget)}${bu.restant < 0 ? ' · dépassé' : ` · reste ${euros(bu.restant)}`}` : 'prévus · aucun budget fixé', 'var(--encre)', 'rond', 'plan'),
    ].join('');
    const parEquipe = [...new Set(E.personnes.map((p) => p.equipe || 'Sans équipe'))].sort((a, b) => a.localeCompare(b, 'fr')).map((eq) => {
      const pers = E.personnes.filter((p) => (p.equipe || 'Sans équipe') === eq);
      return { eq, n: pers.length, ...R.conformite(E, pers, t, idx) };
    });
    return `
      <div class="vue-tete"><div><h1>${E.entreprise ? esc(E.entreprise) : 'Tableau de bord'}</h1><p>${pluriel(ind.personnes, 'personne')}${ind.equipes ? ` en ${pluriel(ind.equipes, 'équipe')}` : ''} : ce qui manque par rapport aux postes, les compétences qui ne tiennent qu'à une personne et les formations à venir.</p></div>
        <div class="actions"><button class="btn primaire" data-action="vue" data-vue="matrice">Ouvrir la matrice</button><button class="btn" data-action="nouvelle-formation">${ICONES.plus}Formation</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Compétences fragiles <span>Critiques, moins de ${pluriel(E.reglages.seuilCouverture, 'personne')} au niveau</span></h2>
          ${fr.length ? `<ul class="liste-lignes">${fr.slice(0, 8).map((x) => `<li class="ligne fragile ${x.nb === 0 ? 'zero' : ''}"><button class="lien-ligne" data-action="couverture" data-c="${x.competence.id}"><b>${esc(x.competence.nom)}</b><span>${esc(domaine(x.competence.domaineId)?.nom || '')} · ${esc(libCouverture(x))}</span></button><span class="etiquette ${x.nb === 0 ? 'rouge' : 'jaune'}">${x.nb === 0 ? 'Personne' : x.nb === 1 ? '1 seule' : `${x.nb} seulement`}</span></li>`).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien de fragile</h3><p>Chaque compétence marquée critique est tenue par assez de personnes au niveau requis.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Formations à venir <span>${ind.aConfirmer ? `${ind.aConfirmer} à confirmer` : 'Les plus proches d\'abord'}</span></h2>
          ${prochaines.length ? `<ul class="liste-lignes">${prochaines.slice(0, 6).map((f) => ligneFormation(f, t, true)).join('')}</ul>${prochaines.length > 6 ? `<button class="btn lien" data-action="vue" data-vue="plan">Voir les ${prochaines.length} formations</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune formation datée</h3><p>Planifie une formation depuis un écart : elle apparaît ici avec sa date.</p></div></div>'}
        </section>
      </div>
      <h2 class="titre-section">Écarts sans formation prévue <span>${sans.length ? 'Compétences critiques et gros écarts d\'abord' : ''}</span></h2>
      ${sans.length ? `<ul class="liste-lignes">${sans.slice(0, 8).map((x) => ligneEcart(x)).join('')}</ul>${sans.length > 8 ? `<button class="btn lien" data-action="vue" data-vue="plan">Voir les ${sans.length} écarts</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Chaque écart a son action</h3><p>Les niveaux requis non atteints sans formation envisagée ou validée apparaissent ici.</p></div></div>'}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Par équipe <span>Part des niveaux requis atteints</span></h2>
          <div class="defile"><table class="tableau barres-equipes"><thead><tr><th>Équipe</th><th class="nb">Personnes</th><th>Exigences atteintes</th></tr></thead><tbody>${parEquipe.map((g) => `<tr><td><button class="btn lien" data-action="filtre-equipe-matrice" data-equipe="${esc(g.eq)}">${esc(g.eq)}</button></td><td class="nb">${g.n}</td><td><span class="barre-pct">${barre(g.pct)}<b class="nb">${g.pct === null ? '—' : `${g.pct} %`}</b></span></td></tr>`).join('')}</tbody></table></div>
        </section>
        <section>
          <h2 class="titre-section">À réévaluer <span>Dernière évaluation de plus de ${pluriel(E.reglages.reevaluationMois, 'mois', 'mois')}</span></h2>
          ${reev.length ? `<ul class="liste-lignes">${[...new Map(reev.map((x) => [x.personne.id, x])).values()].slice(0, 6).map((x) => { const n = reev.filter((y) => y.personne.id === x.personne.id).length; return `<li class="ligne"><button class="lien-ligne" data-action="fiche" data-id="${x.personne.id}"><b>${esc(x.personne.nom)}</b><span>${pluriel(n, 'compétence')} · évaluée${n > 1 ? 's' : ''} le ${dateCourte(x.date)}</span></button><button class="btn petit" data-action="evaluer-personne" data-id="${x.personne.id}">Évaluer</button></li>`; }).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Évaluations à jour</h3><p>Les personnes dont une compétence requise n\'a pas été revue depuis longtemps apparaissent ici.</p></div></div>'}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function ligneEcart(x) {
    return `<li class="ligne st-${x.statut}"><button class="lien-ligne" data-action="cellule" data-p="${x.personne.id}" data-c="${x.competence.id}"><b>${esc(x.competence.nom)}${x.competence.critique ? ' <span class="critique" title="Compétence critique">critique</span>' : ''}</b><span>${esc(x.personne.nom)} · ${x.actuel === null ? 'non évaluée' : `niveau ${x.actuel}`} pour ${x.requis} requis</span></button><span class="lt-droite">${etiquetteCellule(x)}<button class="btn petit" data-action="nouvelle-formation" data-p="${x.personne.id}" data-c="${x.competence.id}">Planifier</button></span></li>`;
  }

  function ligneFormation(f, t, court = false) {
    const p = personne(f.personneId);
    const c = competence(f.competenceId);
    const s = R.statutFormation(f, t);
    const action = s === 'aConfirmer' || (f.statut === 'validee' && s !== 'realisee') ? `<button class="btn petit primaire" data-action="realiser" data-f="${f.id}">Réalisée</button>` : f.statut === 'envisagee' ? `<button class="btn petit" data-action="valider" data-f="${f.id}">Valider</button>` : '';
    return `<li class="ligne formation f-${s}">
      ${f.date ? `<span class="date-pastille"><b>${versDate(f.date).getDate()}</b>${fmt(f.date, { month: 'short' }).replace('.', '')}${f.date.slice(0, 4) !== t.slice(0, 4) ? `<small>${f.date.slice(0, 4)}</small>` : ''}</span>` : '<span class="date-pastille vide">?</span>'}
      <button class="lien-ligne" data-action="formation" data-f="${f.id}"><b>${esc(f.intitule)}</b><span>${esc(p?.nom || '')}${c ? ` · ${esc(c.nom)}` : ''}${court ? '' : ` · ${esc(R.LIB_MODALITE[f.modalite])}${f.duree ? ` · ${heures(f.duree)}` : ''}`}${s === 'aConfirmer' ? ` · prévue ${quand(R.ecartJours(t, f.date))}` : ''}</span></button>
      <span class="lt-droite">${court ? '' : `<span class="montant-mini">${f.cout ? euros(f.cout) : 'sans coût'}</span>`}${etiquetteFormation(f, t)}${court ? '' : action}</span>
    </li>`;
  }

  // ---------- Matrice ----------
  function personnesFiltrees() {
    return E.personnes.filter((p) => filtre.equipe === 'toutes' || (p.equipe || 'Sans équipe') === filtre.equipe)
      .sort((a, b) => (a.equipe || '~').localeCompare(b.equipe || '~', 'fr') || a.nom.localeCompare(b.nom, 'fr'));
  }
  function competencesMatrice(pers, idx) {
    const requises = new Set(pers.flatMap((p) => Object.keys(poste(p.posteId)?.requis || {})));
    const evaluees = new Set(pers.flatMap((p) => Object.keys(idx[p.id] || {})));
    return E.domaines.filter((d) => filtre.domaine === 'tous' || d.id === filtre.domaine)
      .map((d) => ({ d, comps: E.competences.filter((c) => c.domaineId === d.id && (filtre.portee === 'toutes' || requises.has(c.id) || evaluees.has(c.id))) }))
      .filter((g) => g.comps.length);
  }

  function vueMatrice() {
    const t = auj();
    const idx = R.indexDernieres(E.evaluations);
    const pers = personnesFiltrees();
    const groupes = competencesMatrice(pers, idx);
    const eqs = [...new Set(E.personnes.map((p) => p.equipe || 'Sans équipe'))].sort((a, b) => a.localeCompare(b, 'fr'));
    const comps = groupes.flatMap((g) => g.comps);
    const outils = `
      <div class="barre-filtres">
        <div class="filtres" role="group" aria-label="Équipe">${[['toutes', 'Toutes les équipes'], ...eqs.map((x) => [x, x])].map(([id, lib]) => `<button class="filtre" data-action="filtre-equipe" data-equipe="${esc(id)}" aria-pressed="${filtre.equipe === id}">${esc(lib)}</button>`).join('')}</div>
        <div class="rang-filtres">
          <label class="champ champ-inline"><span class="sr-only">Domaine</span><select data-change="filtre-domaine"><option value="tous">Tous les domaines</option>${E.domaines.map((d) => `<option value="${d.id}" ${filtre.domaine === d.id ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}</select></label>
          <div class="choix-statut choix-2 bascule" role="group" aria-label="Compétences affichées">${[['requises', 'Requises ou évaluées'], ['toutes', 'Toutes']].map(([id, l]) => `<button type="button" data-action="portee" data-portee="${id}" aria-pressed="${filtre.portee === id}"><span>${l}</span></button>`).join('')}</div>
          <div class="choix-statut choix-2 bascule" role="group" aria-label="Affichage">${[['niveaux', 'Niveaux'], ['ecarts', 'Écarts']].map(([id, l]) => `<button type="button" data-action="mode" data-mode="${id}" aria-pressed="${filtre.mode === id}"><span>${l}</span></button>`).join('')}</div>
        </div>
      </div>`;
    const tete = `<div class="vue-tete"><div><h1>Matrice</h1><p>Une ligne par personne, une colonne par compétence. ${filtre.mode === 'niveaux' ? 'Le chiffre est le niveau actuel ; un liseré rouge signale un niveau inférieur à celui que demande le poste.' : 'Chaque case montre l\'écart au niveau requis par le poste.'} Touche une case pour évaluer.</p></div>
      <div class="actions"><button class="btn" data-action="imprimer-matrice">Imprimer</button><button class="btn" data-action="csv-matrice">CSV</button></div></div>`;
    if (!E.personnes.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune personne</h3><p>Ajoute les personnes de ton équipe : leurs compétences requises s'affichent ici.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-personne">${ICONES.plus}Une personne</button></div></div></div>`;
    if (!comps.length) return `${tete}${outils}<div class="vide-etat petit"><div><h3>Aucune compétence à afficher</h3><p>Choisis « Toutes » ou un autre domaine, ou donne un poste aux personnes.</p></div></div>`;
    const legende = filtre.mode === 'niveaux'
      ? `<div class="legende" aria-label="Légende">${E.reglages.echelle.map((l) => `<span>${pastilleNiveau(l.n)}${esc(l.nom)}</span>`).join('')}<span><span class="niv niv-vide">–</span>Non évalué</span><span><span class="niv ecart-ex">2</span>Sous le niveau requis</span><span><span class="crit-ex">▲</span>Critique</span></div>`
      : '<div class="legende" aria-label="Légende"><span><span class="cel-ex ok">✓</span>Atteint</span><span><span class="cel-ex e1">−1</span>Écart de 1</span><span><span class="cel-ex e2">−2</span>Écart de 2 ou plus</span><span><span class="cel-ex ne">?</span>Requis, non évalué</span><span><span class="cel-ex">·</span>Non requis</span></div>';
    const cov = new Map(comps.map((c) => [c.id, R.couverture(E, c.id, idx)]));
    const corps = pers.map((p) => {
      const cells = comps.map((c) => {
        const x = R.cellule(E, p, c.id, t, idx);
        const lib = `${p.nom} · ${c.nom} : ${x.actuel === null ? 'non évalué' : `niveau ${x.actuel} (${nomNiv(x.actuel)})`}${x.requis ? `, requis ${x.requis}${x.ecart ? `, écart ${x.ecart}` : ''}` : ', non requis par le poste'}${x.ancienne ? ', à réévaluer' : ''}`;
        let contenu, classe, style = '';
        if (filtre.mode === 'niveaux') {
          contenu = x.actuel === null ? (x.requis ? '?' : '') : String(x.actuel);
          classe = `cel n${x.actuel ?? 'x'} ${x.statut} ${x.actuel !== null && texteClair(x.actuel) ? 'clair' : ''} ${x.ancienne ? 'ancienne' : ''}`;
          if (x.actuel > 0) style = `--n:${couleurNiv(x.actuel)}`;
        } else {
          contenu = x.statut === 'ok' ? '✓' : x.statut === 'ecart' ? `−${x.ecart}` : x.statut === 'nonEvalue' ? '?' : '·';
          classe = `cel mode-ecart ${x.statut} ${x.statut === 'ecart' ? (x.ecart >= 2 ? 'e2' : 'e1') : ''}`;
        }
        return `<td><button class="${classe}" style="${style}" data-action="cellule" data-p="${p.id}" data-c="${c.id}" aria-label="${esc(lib)}" title="${esc(lib)}">${contenu}</button></td>`;
      }).join('');
      const b = R.bilanPersonne(E, p, t, idx);
      return `<tr><th scope="row"><button class="lien-ligne" data-action="fiche" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${esc(poste(p.posteId)?.nom || 'Sans poste')}${b.pct !== null ? ` · ${b.pct} %` : ''}</span></button></th>${cells}</tr>`;
    }).join('');
    const pied = comps.map((c) => {
      const x = cov.get(c.id);
      const fragile = c.critique && x.nb < E.reglages.seuilCouverture;
      return `<td><button class="cel-cov ${fragile ? 'fragile' : ''} ${x.nb === 0 ? 'zero' : ''}" data-action="couverture" data-c="${c.id}" title="${esc(`${c.nom} : ${libCouverture(x)}`)}" aria-label="${esc(`${c.nom} : ${libCouverture(x)}`)}">${x.nb}</button></td>`;
    }).join('');
    return `${tete}${outils}${legende}
      <div class="matrice-defile" tabindex="0" role="region" aria-label="Matrice personnes et compétences">
        <table class="matrice ${filtre.mode === 'ecarts' ? 'en-ecarts' : ''}">
          <thead>
            <tr class="ligne-domaines"><th class="coin" rowspan="2" scope="col"><span>${pluriel(pers.length, 'personne')}<br>${pluriel(comps.length, 'compétence')}</span></th>${groupes.map((g) => `<th colspan="${g.comps.length}" scope="colgroup" class="dom" title="${esc(g.d.nom)}"><span>${esc(g.d.nom)}</span></th>`).join('')}</tr>
            <tr class="ligne-competences">${groupes.map((g) => g.comps.map((c, i) => `<th scope="col" class="${i === 0 ? 'debut' : ''}"><button class="tete-comp" data-action="couverture" data-c="${c.id}" title="${esc(c.nom)}"><span>${esc(c.nom)}</span>${c.critique ? '<i class="crit" aria-label="critique">▲</i>' : ''}</button></th>`).join('')).join('')}</tr>
          </thead>
          <tbody>${corps}</tbody>
          <tfoot><tr><th scope="row"><b>Couverture</b><span>personnes au niveau de référence</span></th>${pied}</tr></tfoot>
        </table>
      </div>
      <p class="mention" style="margin-top:12px">Couverture : nombre de personnes dont le niveau atteint le plus haut niveau requis par un poste (ou le niveau ${E.reglages.niveauReference} si aucun poste ne la demande). En rouge : compétence critique tenue par moins de ${pluriel(E.reglages.seuilCouverture, 'personne')}.${filtre.mode === 'niveaux' ? ' Case pâle : évaluation de plus de ' + pluriel(E.reglages.reevaluationMois, 'mois', 'mois') + '.' : ''}</p>`;
  }

  // ---------- Personnes ----------
  function vuePersonnes() {
    const t = auj();
    const idx = R.indexDernieres(E.evaluations);
    const q = filtre.q.trim().toLowerCase();
    const eqs = [...new Set(E.personnes.map((p) => p.equipe || 'Sans équipe'))].sort((a, b) => a.localeCompare(b, 'fr'));
    const liste = personnesFiltrees().filter((p) => !q || `${p.nom} ${poste(p.posteId)?.nom || ''} ${p.equipe}`.toLowerCase().includes(q));
    const prevues = (p) => E.formations.filter((f) => f.personneId === p.id && ['aVenir', 'aConfirmer', 'aDater'].includes(R.statutFormation(f, t))).length;
    return `
      <div class="vue-tete"><div><h1>Personnes</h1><p>Une fiche par personne : ses compétences face à celles de son poste, son historique d'évaluations et ses formations.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-personne">${ICONES.plus}Personne</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Équipe">${[['toutes', 'Toutes'], ...eqs.map((x) => [x, x])].map(([id, lib]) => `<button class="filtre" data-action="filtre-equipe" data-equipe="${esc(id)}" aria-pressed="${filtre.equipe === id}">${esc(lib)} <small>${id === 'toutes' ? E.personnes.length : E.personnes.filter((p) => (p.equipe || 'Sans équipe') === id).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un prénom, un poste" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<ul class="cartes-personnes">${liste.map((p) => {
        const b = R.bilanPersonne(E, p, t, idx);
        const n = prevues(p);
        return `<li class="carte-personne"><button class="cp-corps" data-action="fiche" data-id="${p.id}">
          <span class="cp-tete"><span class="etiquette ciel">${esc(p.equipe || 'Sans équipe')}</span><span class="cp-pos">${b.pct === null ? '—' : `${b.pct} %`}</span></span>
          <b>${esc(p.nom)}</b>
          <span class="cp-detail">${esc(poste(p.posteId)?.nom || 'Poste à préciser')}</span>
          <span class="cp-progres">${barre(b.pct)}<span class="nb">${b.ok}/${b.total}</span></span>
          <span class="cp-etiquettes">${b.ecarts - b.nonEvalues ? `<span class="etiquette jaune">${pluriel(b.ecarts - b.nonEvalues, 'écart')}</span>` : ''}${b.nonEvalues ? `<span class="etiquette sable">${b.nonEvalues} non évaluée${b.nonEvalues > 1 ? 's' : ''}</span>` : ''}${n ? `<span class="etiquette ciel">${pluriel(n, 'formation prévue', 'formations prévues')}</span>` : ''}${b.total && !b.ecarts ? '<span class="etiquette ciel">Poste couvert</span>' : ''}</span>
        </button></li>`;
      }).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.personnes.length ? 'Aucune personne ne correspond' : 'Aucune personne'}</h3><p>${E.personnes.length ? 'Change le filtre ou la recherche.' : 'Ajoute les personnes de ton équipe avec leur poste.'}</p><div class="actions"><button class="btn primaire" data-action="nouvelle-personne">${ICONES.plus}Une personne</button></div></div></div>`}
      <p class="mention" style="margin-top:20px">Données minimales : prénom et initiale du nom, poste, équipe. Ne saisis ni santé, ni salaire, ni appréciation disciplinaire.</p>`;
  }

  function vueFiche(p) {
    const t = auj();
    const idx = R.indexDernieres(E.evaluations);
    const ex = R.exigences(E, p, t, idx);
    const b = R.bilanPersonne(E, p, t, idx);
    const requisIds = new Set(ex.map((x) => x.competence.id));
    const autres = Object.keys(idx[p.id] || {}).filter((cid) => !requisIds.has(cid) && competence(cid)).map((cid) => ({ competence: competence(cid), ...R.cellule(E, p, cid, t, idx) })).sort((a, b2) => (b2.actuel || 0) - (a.actuel || 0));
    const forms = E.formations.filter((f) => f.personneId === p.id).sort((a, b2) => (b2.date || '9999').localeCompare(a.date || '9999'));
    const hist = R.historique(E.evaluations, p.id);
    const ligne = (x) => `<li class="ligne-comp st-${x.statut}">
        <button class="lien-ligne" data-action="cellule" data-p="${p.id}" data-c="${x.competence.id}"><b>${esc(x.competence.nom)}${x.competence.critique ? ' <span class="critique">critique</span>' : ''}</b><span>${esc(domaine(x.competence.domaineId)?.nom || '')}${x.date ? ` · évaluée le ${dateCourte(x.date)}${x.ancienne ? ' (à réévaluer)' : ''}` : ''}</span></button>
        <span class="lc-niveau">${jauge(x.actuel, x.requis)}<span class="lc-chiffre">${x.actuel === null ? '–' : x.actuel}${x.requis ? `<small>/${x.requis}</small>` : ''}</span></span>
        ${etiquetteCellule(x)}
      </li>`;
    return `
      <button class="btn lien retour" data-action="vue" data-vue="personnes">${ICONES.gauche}Toutes les personnes</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${esc(p.equipe || 'Sans équipe')}</p>
          <h1>${esc(p.nom)}</h1>
          <p>${esc(poste(p.posteId)?.nom || 'Poste à préciser')}${p.entree ? ` · dans l'entreprise depuis le ${dateLongue(p.entree)}` : ''}</p>
          ${p.note ? `<p class="note-fiche">${esc(p.note)}</p>` : ''}
        </div>
        <div class="actions">
          <button class="btn primaire" data-action="evaluer-personne" data-id="${p.id}">Évaluer</button>
          <button class="btn" data-action="nouvelle-formation" data-p="${p.id}">${ICONES.plus}Formation</button>
          <button class="btn" data-action="modifier-personne" data-id="${p.id}">Modifier</button>
          <button class="btn" data-action="imprimer-fiche" data-id="${p.id}">Imprimer</button>
        </div></div>
      <div class="bilan-fiche">
        <div class="bf-progres"><b>${b.pct === null ? '—' : `${b.pct} %`}</b>${barre(b.pct)}<span>${b.total ? `${b.ok} niveaux requis atteints sur ${b.total}` : 'Aucune compétence requise : donne un poste à cette personne'}</span></div>
        <div class="bf-compteurs">${b.ecarts - b.nonEvalues ? `<span class="etiquette jaune">${pluriel(b.ecarts - b.nonEvalues, 'écart')} · ${pluriel(b.points, 'niveau')} à gagner</span>` : ''}${b.nonEvalues ? `<span class="etiquette sable">${b.nonEvalues} à évaluer</span>` : ''}${b.total && !b.ecarts ? '<span class="etiquette ciel">Poste couvert</span>' : ''}</div>
      </div>
      <h2 class="titre-section">Exigences du poste <span>${ex.length ? 'Les plus gros écarts d\'abord' : ''}</span></h2>
      ${ex.length ? `<ul class="liste-comp">${ex.map(ligne).join('')}</ul>` : '<p class="aide">Le poste de cette personne ne demande aucune compétence, ou aucun poste n\'est choisi. Les niveaux requis se règlent dans Référentiel, Postes.</p>'}
      ${autres.length ? `<h2 class="titre-section">Autres compétences évaluées <span>Hors exigences du poste</span></h2><ul class="liste-comp">${autres.map(ligne).join('')}</ul>` : ''}
      <div class="titre-section titre-avec-action"><h2>Formations <span>${forms.length ? pluriel(forms.length, 'formation') : ''}</span></h2><button class="btn petit" data-action="nouvelle-formation" data-p="${p.id}">${ICONES.plus}Ajouter</button></div>
      ${forms.length ? `<ul class="liste-lignes">${forms.map((f) => ligneFormation(f, t)).join('')}</ul>` : '<p class="aide">Aucune formation : planifie-en une depuis un écart, ou ajoute une formation passée pour garder l\'historique.</p>'}
      <details class="plus-tard"><summary>Historique des évaluations <small>${hist.length}</small></summary>
        ${hist.length ? `<ul class="historique">${hist.map((e) => `<li><span class="h-date">${dateCourte(e.date)}</span><span class="h-corps"><b>${esc(competence(e.competenceId)?.nom || '')}</b><span>${esc(R.LIB_SOURCE[e.source])}${e.note ? ` · ${esc(e.note)}` : ''}</span></span>${pastilleNiveau(e.niveau)}<button class="btn-icone petit" data-action="suppr-eval" data-e="${e.id}" aria-label="Retirer l'évaluation du ${dateCourte(e.date)}">×</button></li>`).join('')}</ul>` : '<p class="aide">Aucune évaluation.</p>'}
      </details>
      <div class="pied-fiche"><button class="btn danger" data-action="effacer-personne" data-id="${p.id}">Effacer cette fiche</button><p class="mention">Au départ d'une personne, efface sa fiche : ses évaluations et ses formations sont effacées avec elle. Les attestations de formation et les dossiers obligatoires se tiennent ailleurs.</p></div>`;
  }

  // ---------- Plan de formation ----------
  function vuePlan() {
    const t = auj();
    const an = Number(t.slice(0, 4));
    const annees = [...new Set([an, an + 1, ...E.formations.map(R.anneeDe).filter(Boolean)])].sort();
    if (filtre.annee === null) filtre.annee = an;
    const choix = filtre.annee;
    const dansPeriode = (f) => choix === 'toutes' || R.anneeDe(f) === choix || (!f.date && choix === an);
    const statuts = [['tous', 'Tous'], ['aConfirmer', 'À confirmer'], ['aVenir', 'À venir'], ['aDater', 'À dater'], ['realisee', 'Réalisées'], ['annulee', 'Annulées']];
    const base = E.formations.filter(dansPeriode);
    const liste = base.filter((f) => filtre.statut === 'tous' || R.statutFormation(f, t) === filtre.statut)
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.intitule.localeCompare(b.intitule, 'fr'));
    const sans = R.ecartsSansAction(E, t);
    let bloc = '';
    if (choix !== 'toutes') {
      const bu = R.budget(E, choix);
      const pct = bu.budget ? Math.min(100, Math.round((bu.engage / bu.budget) * 100)) : 0;
      bloc = `<div class="tuiles">
          ${tuile(`Budget ${choix}`, bu.budget ? euros(bu.budget) : '—', bu.budget ? 'fixé pour l\'année' : 'pas encore fixé', 'var(--encre)', 'rond')}
          ${tuile('Prévu', euros(bu.prevu), `${pluriel(bu.nb, 'formation')}${bu.sansCout ? `, dont ${bu.sansCout} sans coût` : ''}`, 'var(--jaune)')}
          ${tuile('Engagé', euros(bu.engage), 'validé ou réalisé', 'var(--bleu)')}
          ${tuile('Réalisé', euros(bu.realise), `${heures(bu.heures)} de formation`, 'var(--rouge)', 'rond')}
        </div>
        <div class="budget-ligne">${bu.budget ? `<span class="progres ${bu.restant < 0 ? 'depasse' : ''}" role="img" aria-label="${pct} % du budget engagé"><span style="width:${pct}%"></span></span><span>${bu.restant >= 0 ? `Reste ${euros(bu.restant)} à engager` : `Budget dépassé de ${euros(-bu.restant)}`}${bu.depasse && bu.restant >= 0 ? ` · le prévu dépasse le budget de ${euros(bu.prevu - bu.budget)}` : ''}</span>` : '<span>Fixe un budget pour suivre ce qui reste à engager.</span>'}<button class="btn petit" data-action="budget" data-annee="${choix}">${bu.budget ? 'Modifier le budget' : 'Fixer le budget'}</button></div>`;
    }
    return `
      <div class="vue-tete"><div><h1>Plan de formation</h1><p>Chaque formation est rattachée à une personne et à la compétence visée. Une formation réalisée enregistre le niveau atteint ensuite, qui met la matrice à jour.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-formation">${ICONES.plus}Formation</button><button class="btn" data-action="csv-plan">CSV</button></div></div>
      <div class="filtres" role="group" aria-label="Année">${[...annees.map((a) => [a, String(a)]), ['toutes', 'Toutes']].map(([id, lib]) => `<button class="filtre" data-action="filtre-annee" data-annee="${id}" aria-pressed="${filtre.annee === id}">${lib}</button>`).join('')}</div>
      ${bloc}
      <div class="filtres" role="group" aria-label="Statut" style="margin-top:20px">${statuts.map(([id, lib]) => `<button class="filtre" data-action="filtre-statut" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${id === 'tous' ? base.length : base.filter((f) => R.statutFormation(f, t) === id).length}</small></button>`).join('')}</div>
      ${liste.length ? `<ul class="liste-lignes">${liste.map((f) => ligneFormation(f, t)).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucune formation${filtre.statut !== 'tous' ? ' dans ce statut' : ''}</h3><p>${E.formations.length ? 'Change l\'année ou le statut.' : 'Planifie une formation depuis un écart ci-dessous, ou ajoute-la directement.'}</p></div></div>`}
      ${choix !== 'toutes' && choix === an && base.some((f) => !f.date) ? '<p class="mention" style="margin-top:8px">Les formations sans date sont listées avec l\'année en cours, hors budget tant qu\'elles ne sont pas datées.</p>' : ''}
      <h2 class="titre-section">Écarts sans formation prévue <span>${pluriel(sans.length, 'écart')}</span></h2>
      ${sans.length ? `<ul class="liste-lignes">${sans.slice(0, 10).map((x) => ligneEcart(x)).join('')}</ul>${sans.length > 10 ? `<details class="plus-tard"><summary>Voir les ${sans.length - 10} autres écarts</summary><ul class="liste-lignes">${sans.slice(10).map((x) => ligneEcart(x)).join('')}</ul></details>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien à planifier</h3><p>Chaque niveau requis non atteint a une formation envisagée ou validée.</p></div></div>'}`;
  }

  // ---------- Référentiel ----------
  function vueReferentiel() {
    const sous = [['competences', `Compétences (${E.competences.length})`], ['postes', `Postes (${E.postes.length})`], ['echelle', `Échelle (0 à ${maxNiv()})`]];
    const tete = `<div class="vue-tete"><div><h1>Référentiel</h1><p>Les compétences par domaine, le niveau que chaque poste demande et l'échelle des niveaux. Tout est modifiable ; une compétence critique est surveillée dans le tableau de bord.</p></div></div>
      <div class="filtres" role="group" aria-label="Partie du référentiel">${sous.map(([id, lib]) => `<button class="filtre" data-action="ref" data-ref="${id}" aria-pressed="${filtre.ref === id}">${lib}</button>`).join('')}</div>`;
    return tete + { competences: refCompetences, postes: refPostes, echelle: refEchelle }[filtre.ref]();
  }

  function refCompetences() {
    const idx = R.indexDernieres(E.evaluations);
    return `<div class="rang" style="margin:16px 0"><button class="btn primaire petit" data-action="nouvelle-competence">${ICONES.plus}Compétence</button><button class="btn petit" data-action="nouveau-domaine">${ICONES.plus}Domaine</button></div>
      ${E.domaines.map((d) => {
        const comps = E.competences.filter((c) => c.domaineId === d.id);
        return `<section class="groupe-ref"><div class="titre-avec-action"><h2>${esc(d.nom)} <span>${pluriel(comps.length, 'compétence')}</span></h2><span class="rang"><button class="btn petit" data-action="nouvelle-competence" data-d="${d.id}">${ICONES.plus}Ajouter</button><button class="btn petit" data-action="domaine" data-d="${d.id}">Renommer</button></span></div>
          ${comps.length ? `<ul class="liste-lignes">${comps.map((c) => { const x = R.couverture(E, c.id, idx); const nbPostes = E.postes.filter((q) => q.requis[c.id]).length; return `<li class="ligne"><button class="lien-ligne" data-action="competence" data-c="${c.id}"><b>${esc(c.nom)}</b><span>${esc(c.desc || 'Sans description')}</span></button><span class="lt-droite">${c.critique ? '<span class="etiquette rose">Critique</span>' : ''}<span class="etiquette">${pluriel(nbPostes, 'poste')}</span><button class="etiquette bouton-etiq ${c.critique && x.nb < E.reglages.seuilCouverture ? 'alerte' : ''}" data-action="couverture" data-c="${c.id}" title="Personnes au niveau ${x.reference} ou plus">${x.nb} au niveau ${x.reference}</button></span></li>`; }).join('')}</ul>` : '<p class="aide">Aucune compétence dans ce domaine.</p>'}
        </section>`;
      }).join('')}
      <p class="mention" style="margin-top:16px">Référentiel générique rédigé pour QME (version ${esc(B.version)}), sans source externe : à adapter à ton activité et à tes métiers.</p>`;
  }

  function refPostes() {
    if (!E.postes.length) return `<div class="vide-etat" style="margin-top:16px">${FORME_VIDE}<div><h3>Aucun poste</h3><p>Un poste dit quel niveau il demande pour chaque compétence : c'est ce qui permet de calculer les écarts.</p><div class="actions"><button class="btn primaire" data-action="nouveau-poste">${ICONES.plus}Un poste</button></div></div></div>`;
    const q = poste(filtre.poste) || E.postes[0];
    filtre.poste = q.id;
    const nb = E.personnes.filter((p) => p.posteId === q.id).length;
    const req = Object.entries(q.requis).map(([cid, n]) => ({ c: competence(cid), n })).filter((x) => x.c);
    const parDom = E.domaines.map((d) => ({ d, l: req.filter((x) => x.c.domaineId === d.id).sort((a, b) => b.n - a.n || a.c.nom.localeCompare(b.c.nom, 'fr')) })).filter((g) => g.l.length);
    return `
      <div class="filtres" role="group" aria-label="Postes" style="margin-top:12px">${E.postes.map((x) => `<button class="filtre" data-action="choisir-poste-ref" data-poste="${x.id}" aria-pressed="${x.id === q.id}">${esc(x.nom)} <small>${Object.keys(x.requis).length}</small></button>`).join('')}<button class="filtre" data-action="nouveau-poste">${ICONES.plus}Nouveau poste</button></div>
      <section class="carte-modele">
        <div class="cm-tete"><div><h2>${esc(q.nom)}</h2><p>${pluriel(nb, 'personne')} à ce poste · ${pluriel(req.length, 'compétence requise', 'compétences requises')}</p></div>
          <div class="actions"><button class="btn petit" data-action="poste" data-poste="${q.id}">Renommer</button><button class="btn petit" data-action="copier-poste" data-poste="${q.id}">Dupliquer</button><button class="btn petit danger" data-action="supprimer-poste" data-poste="${q.id}">Supprimer</button></div></div>
        ${parDom.length ? parDom.map((g) => `<h3 class="titre-phase">${esc(g.d.nom)}</h3><ul class="liste-exigences">${g.l.map((x) => `<li><span class="ex-nom">${x.c.critique ? '<i class="crit" aria-label="critique">▲</i> ' : ''}${esc(x.c.nom)}</span><label class="champ champ-inline"><span class="sr-only">Niveau requis pour ${esc(x.c.nom)}</span><select data-change="niveau-requis" data-poste="${q.id}" data-c="${x.c.id}">${E.reglages.echelle.slice(1).map((l) => `<option value="${l.n}" ${l.n === x.n ? 'selected' : ''}>${l.n} · ${esc(l.nom)}</option>`).join('')}</select></label><button class="btn-icone petit" data-action="retirer-exigence" data-poste="${q.id}" data-c="${x.c.id}" aria-label="Retirer : ${esc(x.c.nom)}">×</button></li>`).join('')}</ul>`).join('') : '<p class="aide">Aucune compétence requise pour ce poste.</p>'}
        <div class="rang"><button class="btn primaire petit" data-action="nouvelle-exigence" data-poste="${q.id}">${ICONES.plus}Ajouter une compétence requise</button></div>
      </section>`;
  }

  function refEchelle() {
    return `<section class="carte-modele">
        <div class="cm-tete"><div><h2>Échelle des niveaux</h2><p>${E.reglages.echelle.length} niveaux, de 0 à ${maxNiv()}. Le niveau 0 signifie « pas encore acquis ».</p></div><div class="actions"><button class="btn petit primaire" data-action="echelle">Modifier l'échelle</button></div></div>
        <ul class="liste-echelle">${E.reglages.echelle.map((l) => `<li>${pastilleNiveau(l.n)}<span><b>${esc(l.nom)}</b><span>${esc(l.desc)}</span></span></li>`).join('')}</ul>
      </section>
      <p class="mention" style="margin-top:12px">Évalue sur des faits observés au travail ou discutés en entretien. Un niveau décrit une compétence professionnelle, jamais un comportement à sanctionner.</p>`;
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const optionsNiveaux = (v, { vide = false, min = 0 } = {}) => `${vide ? '<option value="">—</option>' : ''}${E.reglages.echelle.slice(min).map((l) => `<option value="${l.n}" ${v === l.n ? 'selected' : ''}>${l.n} · ${esc(l.nom)}</option>`).join('')}`;
  const optionsCompetences = (v, { vide = false, exclure = new Set() } = {}) => `${vide ? '<option value="">— Aucune —</option>' : ''}${E.domaines.map((d) => { const l = E.competences.filter((c) => c.domaineId === d.id && !exclure.has(c.id)); return l.length ? `<optgroup label="${esc(d.nom)}">${l.map((c) => `<option value="${c.id}" ${v === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</optgroup>` : ''; }).join('')}`;
  const optionsSources = (v) => R.SOURCES.filter((s) => s !== 'formation' || v === 'formation').map((s) => `<option value="${s}" ${s === v ? 'selected' : ''}>${esc(R.LIB_SOURCE[s])}</option>`).join('');
  const choixNiveau = (nom, v) => `<div class="choix-niveaux" role="radiogroup">${E.reglages.echelle.map((l) => `<label><input type="radio" name="${nom}" value="${l.n}" ${v === l.n ? 'checked' : ''}><span style="${l.n ? `--n:${couleurNiv(l.n)}` : ''}" class="${texteClair(l.n) ? 'clair' : ''} ${l.n === 0 ? 'zero' : ''}"><b>${l.n}</b>${esc(l.nom)}</span></label>`).join('')}</div>`;

  function modalePersonne(id) {
    const p = id ? personne(id) : null;
    if (id && !p) return;
    const v = p || { nom: '', posteId: E.postes[0]?.id || null, equipe: filtre.equipe !== 'toutes' ? filtre.equipe : '', entree: null, note: '' };
    const corps = `
      <label class="champ">Prénom et initiale du nom<small>Données minimales : « Camille D. ». Un nom complet est raccourci automatiquement.</small><input name="nom" required maxlength="60" value="${esc(v.nom)}" placeholder="Ex. : Camille D." autocomplete="off"></label>
      <p class="aide" id="apercu-nom" hidden></p>
      <div class="rang-champs">
        <label class="champ">Poste<select name="posteId"><option value="">— Sans poste —</option>${E.postes.map((q) => `<option value="${q.id}" ${q.id === v.posteId ? 'selected' : ''}>${esc(q.nom)}</option>`).join('')}</select></label>
        <label class="champ">Équipe ou service<input name="equipe" maxlength="50" list="equipes" value="${esc(v.equipe)}" placeholder="Ex. : Atelier"></label>
      </div>
      <datalist id="equipes">${equipes().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="champ">Arrivée dans l'entreprise<small>Facultative.</small><input type="date" name="entree" value="${v.entree || ''}"></label>
      <label class="champ">Note<small>Facultative. Aucune donnée sensible (santé, salaire, vie privée, sanction).</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier la fiche' : 'Nouvelle personne', corps, `<button class="btn primaire" value="ok">${p ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
      const nom = R.nomMinimal(f.get('nom'));
      if (!nom) return 'Indique au moins un prénom.';
      const champs = { nom, posteId: f.get('posteId') || null, equipe: String(f.get('equipe') || '').trim(), entree: f.get('entree') || null, note: String(f.get('note') || '').trim() };
      retenir();
      if (p) { Object.assign(p, R.normaliserPersonne({ ...p, ...champs }, E.postes)); sauver(); rendre(); toast(`Fiche de ${nom} enregistrée.`, { libelle: 'Annuler', faire: annuler }); return; }
      const np = R.normaliserPersonne({ id: uid(), ...champs }, E.postes);
      E.personnes.push(np);
      sauver(); changerVue('personnes', np.id);
      const n = Object.keys(poste(np.posteId)?.requis || {}).length;
      toast(`${nom} ajouté(e)${n ? ` : ${pluriel(n, 'compétence')} à évaluer` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const champ = d.querySelector('[name=nom]');
    champ.addEventListener('input', () => {
      const n = R.nomMinimal(champ.value);
      const a = d.querySelector('#apercu-nom');
      a.hidden = !n || n === champ.value.trim();
      a.textContent = `Sera enregistré : « ${n} ».`;
    });
  }

  // Évaluer une compétence d'une personne (case de la matrice).
  function modaleCellule(pid, cid) {
    const p = personne(pid), c = competence(cid);
    if (!p || !c) return;
    const t = auj();
    const x = R.cellule(E, p, cid, t);
    const hist = R.historique(E.evaluations, pid, cid);
    const forms = E.formations.filter((f) => f.personneId === pid && f.competenceId === cid);
    const corps = `
      <p class="aide"><b>${esc(c.nom)}</b>${c.desc ? ` : ${esc(c.desc)}` : ''}<br>${x.requis ? `Niveau requis par le poste « ${esc(poste(p.posteId)?.nom || '')} » : <b>${x.requis} · ${esc(nomNiv(x.requis))}</b>.` : 'Compétence non requise par le poste de cette personne.'} ${x.actuel === null ? 'Jamais évaluée.' : `Actuel : ${x.actuel} · ${esc(nomNiv(x.actuel))} (${dateCourte(x.date)}).`}</p>
      <fieldset class="champ"><legend>Nouveau niveau</legend>${choixNiveau('niveau', x.actuel ?? null)}</fieldset>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${t}" required></label>
        <label class="champ">Source<select name="source">${optionsSources('manager')}</select></label>
      </div>
      <label class="champ">Note<small>Facultative : un fait observé, jamais une appréciation sur la personne.</small><input name="note" maxlength="160"></label>
      ${hist.length ? `<details class="plus-tard"><summary>Historique <small>${hist.length}</small></summary><ul class="historique">${hist.map((e) => `<li><span class="h-date">${dateCourte(e.date)}</span><span class="h-corps"><b>${esc(nomNiv(e.niveau))}</b><span>${esc(R.LIB_SOURCE[e.source])}${e.note ? ` · ${esc(e.note)}` : ''}</span></span>${pastilleNiveau(e.niveau)}</li>`).join('')}</ul></details>` : ''}
      ${forms.length ? `<p class="mention">Formations liées : ${forms.map((f) => `${esc(f.intitule)} (${esc(R.LIB_STATUT[R.statutFormation(f, t)].toLowerCase())})`).join(' ; ')}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`${esc(p.nom)} · évaluer`, corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${x.ecart || x.statut === 'nonEvalue' ? '<button class="btn gauche" value="former">Planifier une formation</button>' : ''}`, (f, action) => {
      if (action === 'former') { setTimeout(() => modaleFormation(null, { pid, cid }), 0); return; }
      if (f.get('niveau') === null) return 'Choisis un niveau.';
      if (!f.get('date')) return 'Indique la date.';
      retenir();
      E.evaluations.push(R.normaliserEvaluation({ id: uid(), personneId: pid, competenceId: cid, niveau: Number(f.get('niveau')), date: f.get('date'), source: f.get('source'), note: f.get('note'), ordre: prochainOrdre() }, maxNiv()));
      sauver(); rendre();
      const y = R.cellule(E, p, cid, auj());
      toast(`${p.nom} · ${c.nom} : niveau ${y.actuel}${y.requis ? (y.ecart ? `, écart ${y.ecart}` : ', niveau requis atteint') : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Évaluation de toutes les compétences d'une personne (entretien) : seules les lignes modifiées sont enregistrées.
  function modaleEvaluerPersonne(pid) {
    const p = personne(pid);
    if (!p) return;
    const t = auj();
    const idx = R.indexDernieres(E.evaluations);
    const ex = R.exigences(E, p, t, idx);
    const ids = new Set(ex.map((x) => x.competence.id));
    const autres = Object.keys(idx[p.id] || {}).filter((cid) => !ids.has(cid) && competence(cid)).map((cid) => ({ competence: competence(cid), ...R.cellule(E, p, cid, t, idx) }));
    const lignes = [...ex, ...autres];
    const corps = `
      <p class="aide">Change le niveau des compétences revues ; les autres restent telles quelles. ${lignes.length ? '' : 'Aucune compétence requise : ajoute-en une ci-dessous.'}</p>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${t}" required></label>
        <label class="champ">Source<select name="source">${optionsSources('entretien')}</select></label>
      </div>
      <ul class="liste-eval">${lignes.map((x) => `<li><span><b>${esc(x.competence.nom)}</b><small>${x.requis ? `requis ${x.requis}` : 'non requis'}${x.actuel !== null ? ` · actuel ${x.actuel}` : ' · jamais évaluée'}</small></span><select name="n-${x.competence.id}" aria-label="Niveau : ${esc(x.competence.nom)}">${x.actuel === null ? '<option value="" selected>—</option>' : ''}${optionsNiveaux(x.actuel)}</select></li>`).join('')}</ul>
      <div class="rang-champs">
        <label class="champ">Autre compétence<small>Facultatif.</small><select name="autreC">${optionsCompetences('', { vide: true, exclure: new Set(lignes.map((x) => x.competence.id)) })}</select></label>
        <label class="champ">Niveau<select name="autreN">${optionsNiveaux(null, { vide: true })}</select></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Évaluer · ${esc(p.nom)}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      if (!f.get('date')) return 'Indique la date.';
      const nouvelles = [];
      for (const x of lignes) {
        const v = f.get(`n-${x.competence.id}`);
        if (v === '' || v === null || Number(v) === x.actuel) continue;
        nouvelles.push([x.competence.id, Number(v)]);
      }
      if (f.get('autreC') && f.get('autreN') !== '') nouvelles.push([f.get('autreC'), Number(f.get('autreN'))]);
      if (!nouvelles.length) return 'Aucun niveau modifié.';
      retenir();
      for (const [cid, n] of nouvelles) E.evaluations.push(R.normaliserEvaluation({ id: uid(), personneId: pid, competenceId: cid, niveau: n, date: f.get('date'), source: f.get('source'), ordre: prochainOrdre() }, maxNiv()));
      sauver(); rendre();
      const b = R.bilanPersonne(E, p, auj());
      toast(`${pluriel(nouvelles.length, 'niveau enregistré', 'niveaux enregistrés')} pour ${p.nom}${b.pct !== null ? ` : ${b.pct} % du poste couvert` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleFormation(fid, { pid = null, cid = null } = {}) {
    const f0 = fid ? formation(fid) : null;
    if (fid && !f0) return;
    if (!E.personnes.length) { toast('Ajoute d\'abord une personne.'); return; }
    const p0 = personne(pid);
    const c0 = competence(cid);
    const req = p0 && c0 ? R.requis(E, p0, cid) : 0;
    const v = f0 || { intitule: c0 ? c0.nom : '', personneId: pid || E.personnes[0].id, competenceId: cid, modalite: 'externe', organisme: '', date: ajout(auj(), 30), duree: 7, cout: 0, statut: 'envisagee', niveauVise: req || null, niveauApres: null, note: '' };
    const corps = `
      <label class="champ">Intitulé<input name="intitule" required maxlength="120" value="${esc(v.intitule)}" placeholder="Ex. : Conduire ses entretiens annuels"></label>
      <div class="rang-champs">
        <label class="champ">Personne<select name="personneId">${[...E.personnes].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((p) => `<option value="${p.id}" ${p.id === v.personneId ? 'selected' : ''}>${esc(p.nom)}${p.equipe ? ` · ${esc(p.equipe)}` : ''}</option>`).join('')}</select></label>
        <label class="champ">Compétence visée<select name="competenceId">${optionsCompetences(v.competenceId, { vide: true })}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Modalité<select name="modalite">${R.MODALITES.map((m) => `<option value="${m}" ${m === v.modalite ? 'selected' : ''}>${esc(R.LIB_MODALITE[m])}</option>`).join('')}</select></label>
        <label class="champ">Organisme ou formateur<small>Facultatif, texte libre.</small><input name="organisme" maxlength="80" value="${esc(v.organisme)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Date<small>Vide : à dater.</small><input type="date" name="date" value="${v.date || ''}"></label>
        <label class="champ">Durée (heures)<input name="duree" inputmode="decimal" value="${v.duree ? String(v.duree).replace('.', ',') : ''}"></label>
        <label class="champ">Coût (€)<small>Frais pédagogiques et annexes.</small><input name="cout" inputmode="decimal" value="${v.cout ? String(v.cout).replace('.', ',') : ''}"></label>
      </div>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut choix-4">${R.STATUTS_FORMATION.map((s) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${esc(R.LIB_STATUT[s])}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Niveau visé<select name="niveauVise">${optionsNiveaux(v.niveauVise, { vide: true, min: 1 })}</select></label>
        <label class="champ" id="champ-apres" ${v.statut === 'realisee' ? '' : 'hidden'}>Niveau atteint après<small>Enregistré dans l'historique.</small><select name="niveauApres">${optionsNiveaux(v.niveauApres, { vide: true })}</select></label>
      </div>
      <label class="champ">Note<small>Facultative.</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = f0
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter au plan</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(f0 ? 'Formation' : 'Nouvelle formation', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${f0.intitule} » du plan ? L'évaluation enregistrée après la formation, s'il y en a une, est gardée.`)) { modale().dataset.garder = '1'; return; }
        retenir(); E.formations = E.formations.filter((x) => x.id !== f0.id);
        sauver(); rendre(); toast('Formation supprimée.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const intitule = String(fd.get('intitule') || '').trim();
      if (!intitule) return 'Indique l\'intitulé.';
      if (fd.get('cout') && !R.montant(fd.get('cout')) && String(fd.get('cout')).trim() !== '0') return 'Coût illisible : écris un nombre, par exemple 650 ou 89,50.';
      const n = R.normaliserFormation({ id: f0?.id || uid(), intitule, personneId: fd.get('personneId'), competenceId: fd.get('competenceId') || null, modalite: fd.get('modalite'), organisme: fd.get('organisme'), date: fd.get('date') || null, duree: fd.get('duree'), cout: fd.get('cout'), statut: fd.get('statut'), niveauVise: fd.get('niveauVise'), niveauApres: fd.get('niveauApres'), note: fd.get('note') }, maxNiv());
      if (n.statut === 'realisee' && !n.date) return 'Indique la date de la formation réalisée.';
      retenir();
      const devientRealisee = n.statut === 'realisee' && f0?.statut !== 'realisee';
      if (f0) Object.assign(f0, n); else E.formations.push(n);
      let ev = null;
      if (devientRealisee && !E.evaluations.some((e) => e.formationId === n.id)) {
        ev = R.evaluationApres(n, n.date, prochainOrdre());
        if (ev) E.evaluations.push(R.normaliserEvaluation(ev, maxNiv()));
      }
      sauver(); rendre();
      toast(ev ? `Formation réalisée : niveau ${ev.niveau} enregistré pour ${personne(n.personneId).nom}.` : f0 ? 'Formation enregistrée.' : `Formation ajoutée au plan${n.date ? ` pour le ${dateLongue(n.date)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', () => { d.querySelector('#champ-apres').hidden = d.querySelector('[name=statut]:checked').value !== 'realisee'; }));
  }

  // Formation réalisée en un geste : date, niveau atteint, coût réel.
  function modaleRealiser(fid) {
    const f = formation(fid);
    if (!f) return;
    const p = personne(f.personneId);
    const actuel = f.competenceId ? R.derniere(E.evaluations, f.personneId, f.competenceId)?.niveau ?? null : null;
    const proposition = f.niveauVise ?? actuel;
    ouvrirModale(`Réalisée · ${esc(f.intitule)}`, `
      <p class="aide">${esc(p?.nom || '')}${f.competenceId ? ` · ${esc(competence(f.competenceId)?.nom || '')} (actuel ${actuel ?? '–'}${f.niveauVise ? `, visé ${f.niveauVise}` : ''})` : ''}</p>
      <div class="rang-champs">
        <label class="champ">Réalisée le<input type="date" name="date" value="${f.date && f.date <= auj() ? f.date : auj()}" required></label>
        <label class="champ">Coût réel (€)<input name="cout" inputmode="decimal" value="${f.cout ? String(f.cout).replace('.', ',') : ''}"></label>
      </div>
      ${f.competenceId ? `<fieldset class="champ"><legend>Niveau atteint après la formation <small>Évalué sur le terrain, il met la matrice à jour. Laisse vide pour évaluer plus tard.</small></legend>${choixNiveau('niveauApres', proposition)}</fieldset>` : ''}
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Confirmer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      if (!fd.get('date')) return 'Choisis la date.';
      retenir();
      f.statut = 'realisee'; f.date = fd.get('date'); f.cout = R.montant(fd.get('cout'));
      f.niveauApres = fd.get('niveauApres') === null ? null : R.borner(fd.get('niveauApres'), maxNiv());
      let ev = null;
      if (!E.evaluations.some((e) => e.formationId === f.id)) { ev = R.evaluationApres(f, f.date, prochainOrdre()); if (ev) E.evaluations.push(R.normaliserEvaluation(ev, maxNiv())); }
      sauver(); rendre();
      toast(ev ? `Réalisée : ${p?.nom} passe au niveau ${ev.niveau}.` : 'Formation marquée réalisée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCouverture(cid) {
    const c = competence(cid);
    if (!c) return;
    const idx = R.indexDernieres(E.evaluations);
    const x = R.couverture(E, cid, idx);
    const lignes = E.personnes.map((p) => ({ p, ev: idx[p.id]?.[cid] || null, req: R.requis(E, p, cid) })).filter((l) => l.ev || l.req).sort((a, b) => (b.ev?.niveau ?? -1) - (a.ev?.niveau ?? -1) || a.p.nom.localeCompare(b.p.nom, 'fr'));
    const postes = E.postes.filter((q) => q.requis[cid]);
    ouvrirModale(esc(c.nom), `
      <p class="aide">${esc(domaine(c.domaineId)?.nom || '')}${c.critique ? ' · <b>compétence critique</b>' : ''}<br>${esc(libCouverture(x))}. Niveau de référence ${x.reference} : ${postes.length ? `le plus haut niveau demandé par ${postes.map((q) => `${esc(q.nom)} (${q.requis[cid]})`).join(', ')}` : 'réglage par défaut, aucun poste ne la demande'}.</p>
      ${c.critique && x.nb < E.reglages.seuilCouverture ? `<p class="alerte-rgpd"><span><b>Compétence fragile</b><span>Moins de ${pluriel(E.reglages.seuilCouverture, 'personne')} au niveau ${x.reference} : en cas d'absence, personne ne prend le relais. Forme une deuxième personne ou organise un binôme.</span></span></p>` : ''}
      ${lignes.length ? `<ul class="historique">${lignes.map((l) => `<li><span class="h-corps"><b>${esc(l.p.nom)}</b><span>${esc(poste(l.p.posteId)?.nom || 'Sans poste')}${l.req ? ` · requis ${l.req}` : ''}${l.ev ? ` · ${dateCourte(l.ev.date)}` : ' · jamais évaluée'}</span></span>${pastilleNiveau(l.ev ? l.ev.niveau : null)}<button class="btn petit" type="button" data-action="cellule" data-p="${l.p.id}" data-c="${cid}">Évaluer</button></li>`).join('')}</ul>` : '<p class="aide">Personne n\'est évalué sur cette compétence et aucun poste ne la demande.</p>'}`,
    '<button class="btn primaire" value="ok">Fermer</button><button class="btn" type="button" data-action="competence" data-c="' + cid + '">Modifier la compétence</button>');
  }

  function modaleCompetence(cid, did = null) {
    const c = cid ? competence(cid) : null;
    if (cid && !c) return;
    if (!E.domaines.length) { toast('Crée d\'abord un domaine.'); return; }
    const v = c || { nom: '', domaineId: did || (filtre.domaine !== 'tous' ? filtre.domaine : E.domaines[0].id), desc: '', critique: false };
    const nbEval = c ? E.evaluations.filter((e) => e.competenceId === c.id).length : 0;
    ouvrirModale(c ? 'Compétence' : 'Nouvelle compétence', `
      <label class="champ">Nom<input name="nom" required maxlength="90" value="${esc(v.nom)}" placeholder="Ex. : Soudure semi-automatique"></label>
      <label class="champ">Domaine<select name="domaineId">${E.domaines.map((d) => `<option value="${d.id}" ${d.id === v.domaineId ? 'selected' : ''}>${esc(d.nom)}</option>`).join('')}</select></label>
      <label class="champ">Description<small>Facultative : ce que recouvre la compétence, pour évaluer tous de la même façon.</small><input name="desc" maxlength="200" value="${esc(v.desc)}"></label>
      <label class="case"><input type="checkbox" name="critique" ${v.critique ? 'checked' : ''}> Compétence critique <small>(surveillée : alerte si moins de ${pluriel(E.reglages.seuilCouverture, 'personne')} au niveau)</small></label>
      ${c ? `<p class="mention">${pluriel(nbEval, 'évaluation')} · requise par ${pluriel(E.postes.filter((q) => q.requis[c.id]).length, 'poste')}.</p>` : ''}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${c ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${c ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${c.nom} » ? Elle est retirée des postes et ses ${pluriel(nbEval, 'évaluation')} sont effacées.`)) { modale().dataset.garder = '1'; return; }
        retenir(); R.retirerCompetence(E, c.id); sauver(); rendre(); toast(`« ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom.';
      retenir();
      const n = R.normaliserCompetence({ id: c?.id || uid(), nom, domaineId: f.get('domaineId'), desc: f.get('desc'), critique: f.get('critique') === 'on' }, E.domaines);
      if (c) Object.assign(c, n); else E.competences.push(n);
      sauver(); rendre(); toast(c ? 'Compétence enregistrée.' : `« ${nom} » ajoutée au référentiel.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleDomaine(did) {
    const d = did ? domaine(did) : null;
    const nb = d ? E.competences.filter((c) => c.domaineId === d.id).length : 0;
    ouvrirModale(d ? 'Domaine' : 'Nouveau domaine', `<label class="champ">Nom du domaine<input name="nom" required maxlength="60" value="${esc(d?.nom || '')}" placeholder="Ex. : Production"></label>${d ? `<p class="mention">${pluriel(nb, 'compétence')}. Un domaine ne peut être supprimé que vide.</p>` : ''}<p class="erreur" role="alert"></p>`,
      `<button class="btn primaire" value="ok">${d ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>${d && !nb ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
        if (action === 'supprimer') { retenir(); E.domaines = E.domaines.filter((x) => x.id !== d.id); sauver(); rendre(); toast('Domaine supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
        const nom = String(f.get('nom') || '').trim();
        if (!nom) return 'Indique un nom.';
        retenir();
        if (d) d.nom = nom; else E.domaines.push(R.normaliserDomaine({ id: uid(), nom }));
        sauver(); rendre(); toast(d ? 'Domaine renommé.' : `Domaine « ${nom} » créé.`, { libelle: 'Annuler', faire: annuler });
      });
  }

  function modalePoste(qid, copie = false) {
    const q = qid ? poste(qid) : null;
    ouvrirModale(copie ? 'Dupliquer le poste' : q ? 'Renommer le poste' : 'Nouveau poste', `<label class="champ">Nom du poste<input name="nom" required maxlength="70" value="${esc(copie ? `${q.nom} (copie)` : q?.nom || '')}" placeholder="Ex. : Opérateur(trice) de production"></label>
      ${!q ? `<label class="champ">Partir de<select name="copie"><option value="">Un poste vide</option>${E.postes.map((x) => `<option value="${x.id}">Une copie de « ${esc(x.nom)} »</option>`).join('')}</select></label>` : ''}<p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${q && !copie ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>`, (f) => {
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique un nom.';
      retenir();
      if (q && !copie) q.nom = nom;
      else {
        const src = copie ? q : poste(f.get('copie'));
        const nv = R.normaliserPoste({ id: uid(), nom, requis: src ? { ...src.requis } : {} }, E.competences, maxNiv());
        E.postes.push(nv); filtre.poste = nv.id;
      }
      sauver(); rendre(); toast(q && !copie ? 'Poste renommé.' : `Poste « ${nom} » créé.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleExigence(qid) {
    const q = poste(qid);
    if (!q) return;
    const deja = new Set(Object.keys(q.requis));
    if (deja.size >= E.competences.length) { toast('Toutes les compétences sont déjà requises pour ce poste.'); return; }
    ouvrirModale(`Compétence requise · ${esc(q.nom)}`, `
      <label class="champ">Compétence<select name="c" required>${optionsCompetences(null, { exclure: deja })}</select></label>
      <label class="champ">Niveau requis<select name="n">${optionsNiveaux(Math.min(2, maxNiv()), { min: 1 })}</select></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      if (!f.get('c')) return 'Choisis une compétence.';
      retenir(); q.requis[f.get('c')] = R.borner(f.get('n'), maxNiv());
      sauver(); rendre(); toast(`« ${competence(f.get('c')).nom} » requise au niveau ${q.requis[f.get('c')]}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEchelle() {
    const m = maxNiv();
    const lignes = (max) => Array.from({ length: 6 }, (_, n) => { const l = E.reglages.echelle[n] || { nom: B.echelle[n]?.nom || `Niveau ${n}`, desc: B.echelle[n]?.desc || '' }; return `<li data-n="${n}" ${n > max ? 'hidden' : ''}><span class="niv-num">${n}</span><input name="nom-${n}" maxlength="30" value="${esc(l.nom)}" aria-label="Libellé du niveau ${n}"><input name="desc-${n}" maxlength="120" value="${esc(l.desc)}" aria-label="Description du niveau ${n}" placeholder="Description"></li>`; }).join('');
    ouvrirModale('Échelle des niveaux', `
      <fieldset class="champ"><legend>Nombre de niveaux <small>Réduire l'échelle ramène les niveaux trop hauts au nouveau maximum.</small></legend><div class="choix-statut">${R.MAX_POSSIBLES.map((x) => `<label><input type="radio" name="max" value="${x}" ${x === m ? 'checked' : ''}><span>0 à ${x}</span></label>`).join('')}</div></fieldset>
      <ul class="liste-niveaux">${lignes(m)}</ul>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const max = Number(f.get('max'));
      const libelles = Array.from({ length: max + 1 }, (_, n) => ({ nom: String(f.get(`nom-${n}`) || '').trim() || `Niveau ${n}`, desc: String(f.get(`desc-${n}`) || '') }));
      if (max < m && !confirm(`Passer à une échelle de 0 à ${max} ? Les niveaux supérieurs à ${max} (évaluations, exigences) sont ramenés à ${max}.`)) { modale().dataset.garder = '1'; return; }
      retenir(); R.appliquerEchelle(E, max, libelles, B.echelle);
      sauver(); rendre(); toast('Échelle enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    d.querySelectorAll('[name=max]').forEach((r) => r.addEventListener('change', () => { const x = Number(d.querySelector('[name=max]:checked').value); d.querySelectorAll('.liste-niveaux li').forEach((li) => { li.hidden = Number(li.dataset.n) > x; }); }));
  }

  function modaleBudget(annee) {
    ouvrirModale(`Budget formation ${annee}`, `<label class="champ">Montant (€)<small>Ce que l'entreprise prévoit de consacrer à la formation cette année. Vide : pas de budget.</small><input name="budget" inputmode="decimal" value="${E.reglages.budgets[annee] ? String(E.reglages.budgets[annee]).replace('.', ',') : ''}"></label><p class="erreur" role="alert"></p>`,
      '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const v = String(f.get('budget') || '').trim();
        const n = R.montant(v);
        if (v && !n) return 'Montant illisible : écris par exemple 8000 ou 8 000.';
        retenir();
        if (n) E.reglages.budgets[annee] = n; else delete E.reglages.budgets[annee];
        sauver(); rendre(); toast(n ? `Budget ${annee} : ${euros(n)}.` : `Budget ${annee} retiré.`, { libelle: 'Annuler', faire: annuler });
      });
  }

  function supprimerEvaluation(eid) {
    const e = E.evaluations.find((x) => x.id === eid);
    if (!e) return;
    retenir();
    E.evaluations = E.evaluations.filter((x) => x.id !== eid);
    sauver(); rendre(); toast(`Évaluation du ${dateCourte(e.date)} retirée.`, { libelle: 'Annuler', faire: annuler });
  }

  function effacerPersonne(pid) {
    const p = personne(pid);
    if (!p) return;
    const nE = E.evaluations.filter((e) => e.personneId === pid).length, nF = E.formations.filter((f) => f.personneId === pid).length;
    if (!confirm(`Effacer la fiche de ${p.nom} ? ${pluriel(nE, 'évaluation')} et ${pluriel(nF, 'formation')} sont effacées avec elle.`)) return;
    retenir();
    R.retirerPersonne(E, pid);
    sauver(); changerVue('personnes');
    toast(`Fiche de ${p.nom} effacée.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Impression ----------
  function imprimerFiche(pid) {
    const p = personne(pid);
    if (!p) return;
    const t = auj();
    const idx = R.indexDernieres(E.evaluations);
    const ex = R.exigences(E, p, t, idx);
    const b = R.bilanPersonne(E, p, t, idx);
    const forms = E.formations.filter((f) => f.personneId === p.id).sort((a, b2) => (a.date || '9999').localeCompare(b2.date || '9999'));
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    el.innerHTML = `
      <header><p>${esc(E.entreprise || 'Matrice compétences et formations')} · au ${dateLongue(t)}</p><h1>${esc(p.nom)}</h1>
      <p>${esc(poste(p.posteId)?.nom || 'Sans poste')}${p.equipe ? ` · ${esc(p.equipe)}` : ''}${b.pct !== null ? ` · ${b.ok} niveaux requis atteints sur ${b.total} (${b.pct} %)` : ''}</p></header>
      <h2>Compétences du poste</h2>
      <table><thead><tr><th>Compétence</th><th>Domaine</th><th>Requis</th><th>Actuel</th><th>Écart</th><th>Évalué le</th></tr></thead><tbody>${ex.map((x) => `<tr class="${x.statut}"><td>${esc(x.competence.nom)}${x.competence.critique ? ' (critique)' : ''}</td><td>${esc(domaine(x.competence.domaineId)?.nom || '')}</td><td>${x.requis} · ${esc(nomNiv(x.requis))}</td><td>${x.actuel === null ? 'Non évalué' : `${x.actuel} · ${esc(nomNiv(x.actuel))}`}</td><td>${x.ecart || ''}</td><td>${x.date ? dateCourte(x.date) : ''}</td></tr>`).join('')}</tbody></table>
      ${forms.length ? `<h2>Formations</h2><table><thead><tr><th>Date</th><th>Intitulé</th><th>Compétence</th><th>Durée</th><th>Statut</th></tr></thead><tbody>${forms.map((f) => `<tr><td>${f.date ? dateCourte(f.date) : 'À dater'}</td><td>${esc(f.intitule)}</td><td>${esc(competence(f.competenceId)?.nom || '')}</td><td>${f.duree ? heures(f.duree) : ''}</td><td>${esc(R.LIB_STATUT[R.statutFormation(f, t)])}${f.niveauApres !== null ? ` (niveau ${f.niveauApres})` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      <p class="signatures"><span>Visa du manager</span><span>Visa de la personne</span></p>
      <p class="mention">Document interne, données minimales : ne pas le laisser circuler hors des personnes concernées. Échelle : ${E.reglages.echelle.map((l) => `${l.n} ${esc(l.nom)}`).join(', ')}.</p>`;
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  function imprimerMatrice() {
    document.body.classList.add('impr-matrice');
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche', 'impr-matrice'); });

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <label class="champ">Entreprise ou service<small>Facultatif, affiché sur le tableau de bord et à l'impression.</small><input name="entreprise" maxlength="60" value="${esc(E.entreprise)}"></label>
      <div class="rang-champs">
        <label class="champ">Couverture minimale<small>Personnes au niveau pour qu'une compétence critique ne soit pas fragile (1 à 20).</small><input type="number" name="seuilCouverture" min="1" max="20" step="1" value="${r.seuilCouverture}"></label>
        <label class="champ">Réévaluer après<small>Mois depuis la dernière évaluation (1 à 60).</small><input type="number" name="reevaluationMois" min="1" max="60" step="1" value="${r.reevaluationMois}"></label>
      </div>
      <label class="champ">Niveau de référence par défaut<small>Pour la couverture d'une compétence qu'aucun poste ne demande.</small><select name="niveauReference">${optionsNiveaux(r.niveauReference, { min: 1 })}</select></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter et imprimer</h3><p class="aide">Aucun envoi automatique ni lien vers un logiciel RH : exporte en tableur, ou imprime la matrice et la fiche d'une personne (impression ou PDF).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-matrice">Matrice en CSV</button><button class="btn petit" type="button" data-action="csv-plan">Plan de formation en CSV</button><button class="btn petit" type="button" data-action="csv-historique">Historique en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes de la matrice, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Les niveaux de compétence de tes salariés sont des données personnelles : tu en es responsable. Cet outil est conçu pour le minimum : prénom et initiale, poste, équipe, niveaux, formations. N'y mets ni santé, ni salaire, ni vie privée, ni sanction ou appréciation disciplinaire : une évaluation décrit une compétence professionnelle, sur des faits. Informe les personnes de ce suivi et de leur droit d'accès selon tes règles internes, et efface la fiche d'une personne qui quitte l'entreprise. Repère général à vérifier auprès de la CNIL (référentiel « Gestion des ressources humaines »).</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Référentiel : ${pluriel(E.competences.length, 'compétence')} en ${pluriel(E.domaines.length, 'domaine')}, ${pluriel(E.postes.length, 'poste')} (base intégrée version ${esc(B.version)}, rédigée pour QME sans source externe, générique : à adapter). Ce n'est pas un outil de conformité : formations obligatoires, autorisations de conduite, habilitations et entretiens professionnels relèvent des textes et de ta convention collective. Aucune intégration à un logiciel RH, aucun envoi d'e-mail.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const s = Math.round(Number(f.get('seuilCouverture'))), m = Math.round(Number(f.get('reevaluationMois')));
      if (!(s >= 1 && s <= 20)) return 'La couverture minimale doit être entre 1 et 20.';
      if (!(m >= 1 && m <= 60)) return 'Le délai de réévaluation doit être entre 1 et 60 mois.';
      retenir();
      E.entreprise = String(f.get('entreprise') || '').trim().slice(0, 60);
      Object.assign(E.reglages, { seuilCouverture: s, reevaluationMois: m, niveauReference: R.borner(f.get('niveauReference'), maxNiv()) || 1 });
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.personnes) || !Array.isArray(d.competences)) throw new Error();
        if (!confirm(`Remplacer ta matrice actuelle par cette copie (${pluriel(d.personnes.length, 'personne')}) ?`)) return;
        const vu = E.tutorielVu; E = normaliser(d); delete E.majLe; E.tutorielVu = Boolean(E.tutorielVu || vu); fiche = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de la matrice.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `competences-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const g = E.reglages;
    const blocs = [
      ['rose', 'Chaque poste fixe ses exigences', `Un poste demande un niveau pour chacune de ses compétences, sur une échelle de 0 à ${g.echelle.length - 1}. Ajoute chaque personne avec son poste&nbsp;: ses exigences apparaissent aussitôt dans la <b>Matrice</b>. Prénom et initiale suffisent.`],
      ['beurre', 'Évalue, l\'écart se calcule', `Le niveau actuel d'une personne, c'est sa dernière évaluation. S'il est sous le niveau requis, l'écart est signalé&nbsp;; une exigence jamais évaluée compte comme non atteinte. Une évaluation vieille de ${pluriel(g.reevaluationMois, 'mois', 'mois')} ou plus est à refaire.`],
      ['ciel', 'Les compétences fragiles', `Une compétence marquée critique est fragile quand moins de ${pluriel(g.seuilCouverture, 'personne')} ont le niveau de référence&nbsp;: un départ ou une absence, et plus personne ne sait faire. Le <b>Tableau de bord</b> les liste, les moins partagées d'abord.`],
      ['sable', 'Former pour combler les écarts', `Pour chaque écart, prévois une formation&nbsp;: envisagée, validée, puis réalisée. Le budget de l'année compte ce qui est prévu et engagé. Marquée réalisée, une formation peut enregistrer le niveau atteint après coup.`],
    ];
    const corps = `
      <p>La matrice compare le niveau de chaque personne à celui que demande son poste, et repère les compétences que trop peu de personnes maîtrisent. Ton rôle&nbsp;: évaluer ton équipe, puis prévoir les formations qui comblent les écarts.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Personnes</b> réunit les fiches et leur historique, <b>Référentiel</b> les domaines, compétences et postes, à adapter à ton entreprise. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.personnes.length;
    const pied = premier
      ? '<button class="btn primaire" value="personne">Ajouter ma première personne</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'personne') setTimeout(() => modalePersonne(null), 0); });
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
  const fermerPuis = (f) => { if (modale().open) modale().close(); f(); };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; fiche = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'choisir-domaine': if (el.checked) accueil.domaines.add(el.value); else accueil.domaines.delete(el.value); break;
      case 'choisir-poste': if (el.checked) accueil.postes.add(el.value); else accueil.postes.delete(el.value); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'fiche': fermerPuis(() => changerVue('personnes', id)); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-matrice': telecharger(R.versCsvMatrice(E, auj()), 'text/csv;charset=utf-8', `competences-matrice-${auj()}.csv`); break;
      case 'csv-plan': telecharger(R.versCsvPlan(E, auj()), 'text/csv;charset=utf-8', `competences-plan-formation-${auj()}.csv`); break;
      case 'csv-historique': telecharger(R.versCsvHistorique(E), 'text/csv;charset=utf-8', `competences-historique-${auj()}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle-personne': modalePersonne(null); break;
      case 'modifier-personne': modalePersonne(id); break;
      case 'evaluer-personne': modaleEvaluerPersonne(id); break;
      case 'imprimer-fiche': imprimerFiche(id); break;
      case 'imprimer-matrice': imprimerMatrice(); break;
      case 'effacer-personne': effacerPersonne(id); break;
      case 'suppr-eval': supprimerEvaluation(el.dataset.e); break;
      case 'cellule': fermerPuis(() => modaleCellule(el.dataset.p, el.dataset.c)); break;
      case 'couverture': modaleCouverture(el.dataset.c); break;
      case 'competence': fermerPuis(() => modaleCompetence(el.dataset.c)); break;
      case 'nouvelle-competence': modaleCompetence(null, el.dataset.d || null); break;
      case 'domaine': modaleDomaine(el.dataset.d); break;
      case 'nouveau-domaine': modaleDomaine(null); break;
      case 'nouvelle-formation': modaleFormation(null, { pid: el.dataset.p || (vue === 'personnes' ? fiche : null), cid: el.dataset.c || null }); break;
      case 'formation': modaleFormation(el.dataset.f); break;
      case 'realiser': modaleRealiser(el.dataset.f); break;
      case 'valider': { const f = formation(el.dataset.f); if (f) { retenir(); f.statut = 'validee'; sauver(); rendre(); toast(`« ${f.intitule} » validée : son coût passe dans l'engagé.`, { libelle: 'Annuler', faire: annuler }); } break; }
      case 'budget': modaleBudget(el.dataset.annee); break;
      case 'filtre-equipe': filtre.equipe = el.dataset.equipe; rendre(); break;
      case 'filtre-equipe-matrice': filtre.equipe = el.dataset.equipe; changerVue('matrice'); break;
      case 'portee': filtre.portee = el.dataset.portee; rendre(); break;
      case 'mode': filtre.mode = el.dataset.mode; rendre(); break;
      case 'filtre-annee': filtre.annee = el.dataset.annee === 'toutes' ? 'toutes' : Number(el.dataset.annee); rendre(); break;
      case 'filtre-statut': filtre.statut = el.dataset.statut; rendre(); break;
      case 'ref': filtre.ref = el.dataset.ref; rendre(); break;
      case 'choisir-poste-ref': filtre.poste = el.dataset.poste; rendre(); break;
      case 'nouveau-poste': modalePoste(null); break;
      case 'poste': modalePoste(el.dataset.poste); break;
      case 'copier-poste': modalePoste(el.dataset.poste, true); break;
      case 'supprimer-poste': { const q = poste(el.dataset.poste); if (!q) break; const n = E.personnes.filter((p) => p.posteId === q.id).length; if (confirm(`Supprimer le poste « ${q.nom} » ?${n ? ` ${pluriel(n, 'personne')} n'aura plus de poste (leurs évaluations sont gardées).` : ''}`)) { retenir(); E.postes = E.postes.filter((x) => x.id !== q.id); E.personnes.forEach((p) => { if (p.posteId === q.id) p.posteId = null; }); filtre.poste = null; sauver(); rendre(); toast(`Poste « ${q.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); } break; }
      case 'nouvelle-exigence': modaleExigence(el.dataset.poste); break;
      case 'retirer-exigence': { const q = poste(el.dataset.poste); if (q) { retenir(); delete q.requis[el.dataset.c]; sauver(); rendre(); toast('Compétence retirée des exigences du poste.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'echelle': modaleEchelle(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'filtre-domaine') { filtre.domaine = el.value; rendre(); }
    if (el.dataset.change === 'niveau-requis') { const q = poste(el.dataset.poste); if (q) { retenir(); q.requis[el.dataset.c] = R.borner(el.value, maxNiv()); sauver(); rendre(); toast('Niveau requis enregistré.', { libelle: 'Annuler', faire: annuler }); } }
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
  window.__competences = { etat: () => E, regles: R };
  init();
})();
