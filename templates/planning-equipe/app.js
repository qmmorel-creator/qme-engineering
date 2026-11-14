// Planning d'équipe et staffing QME : qui travaille sur quoi, taux de charge, absences, conflits, trous à
// combler et disponibilités. Données synchronisées par clé de licence ou code d'accès, partagées par les
// managers qui ont la clé ; les saisies faites en même temps sur deux appareils sont fusionnées.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.EQP;
  const API = '/api/templates';
  const PRODUIT = 'EQP';
  const CLE_CODE = 'qme-eqp-code';
  const CLE_CACHE = 'qme-eqp-cache';
  const CLE_DEMO = 'qme-eqp-demo';
  const CLE_AUTEUR = 'qme-eqp-auteur';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-eqp-ecran-accueil';
  const DEFAUTS = { reglages: { ...B.reglages, joursOuverture: [1, 2, 3, 4, 5] }, couleurs: B.couleurs, typesAbsence: B.typesAbsence };

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${typeof n === 'number' ? R.nombre(n) : n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, nombre, lundiDe } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateJour = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  const plage = (a) => (a.debut === a.fin ? dateJour(a.debut) : `${dateCourte(a.debut)} → ${dateCourte(a.fin)}`);
  const sem = (l) => `S${R.numeroSemaine(l)}`;
  const libSemaine = (l) => `${sem(l)} · ${dateCourte(l)} → ${dateCourte(ajout(l, 6))}`;
  const h = (x) => `${nombre(x)} h`;
  const pct = (t) => (Number.isFinite(t) ? `${Math.round(t * 100)} %` : '—');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const JOURS_SEMAINE = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, baseEtat: null, memoriser: true };
  let vue = 'tableau';
  const pl = { mode: 'semaine', groupe: 'personnes', lundi: null, mois: null };
  const ds = { lundi: null, competence: '', role: '', heures: '' };
  const fp = { statut: 'actifs', q: '' };
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  const personne = (id) => E.personnes.find((p) => p.id === id);
  const projet = (id) => E.projets.find((p) => p.id === id);
  const affectation = (id) => E.affectations.find((a) => a.id === id);
  const absence = (id) => E.absences.find((a) => a.id === id);
  const competence = (id) => E.competences.find((c) => c.id === id);
  const nomP = (id) => { const p = personne(id); return p ? `${p.prenom} ${p.nom}`.trim() || 'Sans nom' : 'Personne supprimée'; };
  const prenomP = (id) => { const p = personne(id); return p ? (p.prenom || p.nom || 'Sans nom') : '?'; };
  const nomPr = (id) => projet(id)?.nom || 'Projet supprimé';
  const nomC = (id) => competence(id)?.nom || '';
  const couleur = (pr) => B.couleurs[pr?.couleur ?? 0] || B.couleurs[0];
  const typeAbs = (id) => B.typesAbsence.find((t) => t.id === id) || B.typesAbsence.at(-1);
  const auteur = () => stock.lire(CLE_AUTEUR) || '';
  const tri = (a, b) => (a.role || '').localeCompare(b.role || '') || a.prenom.localeCompare(b.prenom);
  const presents = (l) => E.personnes.filter((p) => R.actifSemaine(p, l)).sort(tri);
  const ETAT_LIB = { surcharge: 'Surcharge', plein: 'Plein', disponible: 'Disponible', absent: 'Absent', inactif: '—' };

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
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, baseEtat: session.baseEtat, nonEnvoye }, !session.memoriser);
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

  // Fusion avec la version d'un autre appareil : ce qui a été ajouté, modifié ou supprimé ici l'emporte.
  function fusionnerAvec(donnees) {
    const serveur = normaliser(donnees);
    E = normaliser(R.fusionner(session.baseEtat || serveur, E, serveur));
    E.majLe = donnees.majLe;
    session.base = donnees.majLe;
    session.baseEtat = serveur;
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        fusionnerAvec(corps.donnees);
        cache(true);
        if (!modale().open) rendre();
        toast('Un autre manager a modifié le planning : ses changements et les tiens sont réunis.');
        aRenvoyer = true;
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        E.majLe = corps.majLe;
        session.baseEtat = structuredClone(E);
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
        session.baseEtat = structuredClone(E);
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
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }

  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    if (c && c.code === session.code && c.nonEnvoye && c.etat) {
      E = normaliser(c.etat);
      session.baseEtat = c.baseEtat ? normaliser(c.baseEtat) : null;
      session.base = c.base ?? null;
      if (donnees && c.base !== donnees.majLe) fusionnerAvec(donnees);
      demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    session.baseEtat = E ? structuredClone(E) : null;
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
    Object.assign(session, { code: null, jeton: null, demo: false, base: null, baseEtat: null });
    E = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Agence fictive de 10 personnes (dont une partie), projets de clients fictifs et deux postes à couvrir.
  // Dates relatives à aujourd'hui, pour montrer tous les états : surcharge cette semaine, plein, disponible,
  // temps partiel, alternance, congés avec une affectation qui tombe dedans, formation qui laisse un trou dans
  // le support, compétence manquante, projet à venir, en pause et terminé.
  function donneesDemo() {
    const e = etatVide();
    const L = lundiDe(auj());
    const j = (n) => ajout(L, n);
    e.entreprise = 'Agence Exemple';
    e.reglages.verifieLe = B.reglages.verifieLe;
    const comp = [['gp', 'Gestion de projet'], ['web', 'Développement web'], ['design', 'Design graphique'], ['ux', 'UX'], ['redac', 'Rédaction'], ['a11y', 'Accessibilité'], ['support', 'Support client'], ['formation', 'Formation']];
    e.competences = comp.map(([id, nom]) => ({ id, nom }));
    const pe = (id, prenom, nom, role, competences, capacite = 35, extra = {}) => e.personnes.push(R.normaliserPersonne({ id, prenom, nom, role, competences, capacite, ...extra }));
    pe('camille', 'Camille', 'Martin', 'Cheffe de projet', ['gp', 'formation']);
    pe('hugo', 'Hugo', 'Bernard', 'Développeur', ['web', 'a11y']);
    pe('ines', 'Inès', 'Petit', 'Développeuse', ['web', 'ux'], 28, { jours: [1, 2, 4, 5] });
    pe('malik', 'Malik', 'Durand', 'Designer', ['design', 'ux']);
    pe('sophie', 'Sophie', 'Leroy', 'Designer', ['design']);
    pe('theo', 'Théo', 'Moreau', 'Développeur en alternance', ['web'], 21, { jours: [1, 2, 3], entree: j(-70) });
    pe('lea', 'Léa', 'Simon', 'Support', ['support', 'formation']);
    pe('nora', 'Nora', 'Laurent', 'Rédactrice', ['redac'], 24, { jours: [1, 2, 3, 4] });
    pe('julien', 'Julien', 'Michel', 'Directeur technique', ['web', 'gp', 'a11y']);
    pe('manon', 'Manon', 'Garcia', 'Support', ['support'], 35, { sortie: j(-17) });
    const pr = (id, nom, client, couleur, debut, fin, besoin, competences, extra = {}) => e.projets.push(R.normaliserProjet({ id, nom, client, couleur, debut, fin, besoin, competences, ...extra }));
    pr('orion', 'Refonte du site', 'Client Orion', 0, j(-28), j(41), 60, ['web', 'design', 'redac', 'gp']);
    pr('vega', 'Application de réservation', 'Client Vega', 1, j(-14), j(83), 50, ['web', 'ux', 'gp']);
    pr('lyra', 'Campagne de printemps', 'Client Lyra', 2, j(14), j(55), 30, ['design', 'redac', 'gp']);
    pr('altair', 'Identité visuelle', 'Client Altaïr', 3, j(-7), j(20), 20, ['design']);
    pr('deneb', 'Audit d\'accessibilité', 'Client Deneb', 4, L, j(13), 14, ['a11y']);
    pr('support', 'Support client', '', 5, null, null, 35, ['support'], { type: 'poste', note: 'Permanence du lundi au vendredi.' });
    pr('maint', 'Maintenance des sites', '', 6, null, null, 14, ['web'], { type: 'poste' });
    pr('agence', 'Nouveau site de l\'agence', 'Interne', 0, j(-40), j(60), 0, ['web'], { statut: 'pause', note: 'Repris quand la refonte Orion sera livrée.' });
    pr('ancien', 'Catalogue en ligne', 'Client Rigel', 2, j(-120), j(-35), 30, ['web'], { statut: 'termine' });
    const af = (personneId, projetId, debut, fin, heures, note = '', par = 'Camille') => e.affectations.push(R.normaliserAffectation({ id: uid(), personne: personneId, projet: projetId, debut, fin, heures, note, par, majLe: j(-3) }));
    af('camille', 'orion', j(-28), j(41), 14); af('camille', 'vega', j(-14), j(83), 14); af('camille', 'lyra', j(14), j(55), 7);
    af('hugo', 'orion', j(-28), j(41), 21); af('hugo', 'vega', j(-14), j(83), 14); af('hugo', 'maint', L, j(6), 7, 'Mise à jour de sécurité urgente', 'Julien');
    af('ines', 'vega', j(-14), j(83), 21); af('ines', 'orion', j(-28), j(41), 7);
    af('malik', 'orion', j(-28), j(41), 14); af('malik', 'altair', j(-7), j(20), 7);
    af('sophie', 'altair', j(-7), j(20), 21); af('sophie', 'lyra', j(14), j(55), 14);
    af('theo', 'deneb', L, j(13), 7, 'À accompagner par Julien', 'Julien'); af('theo', 'maint', j(7), j(83), 7); af('theo', 'vega', j(-14), j(83), 7);
    af('lea', 'support', j(-60), j(120), 35);
    af('nora', 'lyra', j(14), j(55), 12); af('nora', 'orion', j(-28), j(41), 6);
    af('julien', 'vega', j(-14), j(83), 7); af('julien', 'deneb', L, j(13), 7); af('julien', 'orion', j(-28), j(41), 7);
    af('manon', 'support', j(-120), j(-17), 35);
    af('hugo', 'ancien', j(-120), j(-35), 21);
    const ab = (personneId, type, debut, fin, extra = {}) => e.absences.push(R.normaliserAbsence({ id: uid(), personne: personneId, type, debut, fin, par: 'Camille', ...extra }));
    ab('sophie', 'conges', j(7), j(11), { note: 'Vacances' });
    ab('lea', 'formation', j(10), j(11), { note: 'Formation outil de tickets' });
    ab('julien', 'formation', j(9), j(9), { demiFin: true });
    ab('camille', 'conges', j(-10), j(-8));
    ab('hugo', 'conges', j(21), j(25), { note: 'Posé il y a un mois' });
    ab('nora', 'autre', j(15), j(15));
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Planning d\'équipe · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="250" height="56" fill="#1D4E89"/>
          <rect x="290" y="20" width="120" height="56" fill="#F5B400"/>
          <rect x="20" y="96" width="140" height="56" fill="#D9302A"/>
          <rect x="180" y="96" width="230" height="56" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <rect x="20" y="172" width="390" height="56" fill="#141414"/>
          <circle cx="490" cy="150" r="60" fill="#F0EDE6"/>
          <path d="M490 150 L490 90 A60 60 0 0 1 550 150 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Planning d'équipe et staffing</p>
          <h1>Qui fait quoi, et qui peut encore prendre.</h1>
          <p>Les affectations de ton équipe par personne et par projet, la charge de chaque semaine avec les absences et les temps partiels, et les conflits signalés avant qu'ils coincent.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton planning d'équipe</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Le planning est enregistré en ligne : chaque manager qui a la clé le retrouve sur ses appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon planning</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon planning'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, entreprise: '', secteur: 'agence', competences: null, postes: null });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const s = B.secteurs.find((x) => x.id === a.secteur);
    if (a.competences === null) a.competences = s ? [...s.competences] : [];
    if (a.postes === null) a.postes = s ? s.postes.map((p) => p[0]) : [];
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare le planning de ton équipe.</h1>
        <p class="intro">Tu ajoutes tes personnes, tes projets et les postes à tenir, puis tu affectes des heures par semaine : la charge, les conflits et les disponibilités se calculent. Rien n'est envoyé à ton équipe.</p>
        <div class="form-accueil">
          <label class="champ">Ton entreprise <small>Facultatif.</small><input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80"></label>
          <fieldset class="champ"><legend>Ton secteur <small>Pour te proposer des compétences et des postes à couvrir. Tout se modifie ensuite.</small></legend>
            <div class="choix-secteur">${[...B.secteurs, { id: 'vide', nom: 'Partir de zéro' }].map((x) => `<label><input type="radio" name="secteur" value="${x.id}" ${a.secteur === x.id ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div></fieldset>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const comps = s ? s.competences : [];
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Compétences et postes à couvrir</h1>
        <p class="intro">Les compétences servent à trouver qui peut remplacer qui. Un poste à couvrir (accueil, permanence, ligne) a un besoin en heures par semaine : l'outil signale quand il n'est pas tenu. Tu ajouteras tes projets et ton équipe ensuite.</p>
        ${comps.length ? `<fieldset class="groupe-types" style="margin-top:20px;max-width:720px"><legend>Compétences</legend><div class="cases">${comps.map((c, i) => `<label class="case"><input type="checkbox" data-comp="${i}" ${a.competences.includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div></fieldset>` : ''}
        ${s?.postes.length ? `<fieldset class="groupe-types" style="margin-top:14px;max-width:720px"><legend>Postes à couvrir</legend><div class="cases">${s.postes.map(([nom, hh, c], i) => `<label class="case"><input type="checkbox" data-poste="${i}" ${a.postes.includes(nom) ? 'checked' : ''}> ${esc(nom)} <small>${hh} h par semaine · ${esc(c)}</small></label>`).join('')}</div></fieldset>` : '<p class="aide" style="margin-top:16px;max-width:720px">Aucune proposition : tu créeras tes compétences et tes postes dans les onglets Équipe et Projets.</p>'}
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon planning</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    document.querySelectorAll('[name=secteur]').forEach((el) => el.addEventListener('change', () => { accueil.secteur = el.value; accueil.competences = null; accueil.postes = null; }));
    document.querySelectorAll('[data-comp]').forEach((el) => el.addEventListener('change', () => { const c = s.competences[Number(el.dataset.comp)]; accueil.competences = el.checked ? [...accueil.competences, c] : accueil.competences.filter((x) => x !== c); }));
    document.querySelectorAll('[data-poste]').forEach((el) => el.addEventListener('change', () => { const p = s.postes[Number(el.dataset.poste)][0]; accueil.postes = el.checked ? [...accueil.postes, p] : accueil.postes.filter((x) => x !== p); }));
  }

  function terminerAccueil() {
    const s = B.secteurs.find((x) => x.id === accueil.secteur);
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.competences = (accueil.competences || []).map((nom) => ({ id: uid(), nom }));
    const idC = (nom) => E.competences.find((c) => c.nom === nom)?.id;
    E.projets = (s?.postes || []).filter(([nom]) => (accueil.postes || []).includes(nom)).map(([nom, hh, c], i) => R.normaliserProjet({ id: uid(), nom, type: 'poste', besoin: hh, competences: [idC(c)].filter(Boolean), couleur: i + 5 }, i));
    accueil = accueilVide();
    vue = 'equipe';
    sauver();
    demarrer();
    toast('Ton planning est prêt. Ajoute les personnes de ton équipe.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="12" height="4" fill="currentColor"/><rect x="9" y="10" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="16" height="4" fill="currentColor"/></svg>',
    dispos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    projets: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    equipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 21a6 6 0 0 1 12 0Z" fill="currentColor"/><path d="M14 21a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['planning', 'Planning'], ['dispos', 'Disponibles'], ['projets', 'Projets'], ['equipe', 'Équipe']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la planification : la charge est celle que tu planifies, pas le temps de travail effectif, et ce n\'est ni un logiciel de paie ni un conseil juridique. Les alertes de durée sont des paramètres ; la convention collective, les accords et le Code du travail font foi.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/planning-equipe/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Planning<br>d'équipe</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Planning d'équipe`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, planning: vuePlanning, dispos: vueDispos, projets: vueProjets, equipe: vueEquipe }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { fp.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    document.querySelectorAll('[data-filtre-ds]').forEach((el) => el.addEventListener('change', () => { ds[el.dataset.filtreDs] = el.value; rendre(); }));
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const etiquetteEtat = (b) => `<span class="etiquette etat-${b.etat}">${b.etat === 'surcharge' && b.capacite <= 0 ? 'Absent mais affecté' : ETAT_LIB[b.etat]}</span>`;
  const puceProjet = (pr, texte, extra = '') => `<span class="puce-projet" style="--c:${couleur(pr)}" ${extra}>${texte}</span>`;
  const chipsCompetences = (ids, surligne = '') => ids.map((c) => `<span class="puce-comp ${c === surligne ? 'ok' : ''}">${esc(nomC(c))}</span>`).join('');
  const vide = (titre, texte, bouton = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${bouton ? `<div class="actions">${bouton}</div>` : ''}</div></div>`;
  const BTN_PERSONNE = `<button class="btn primaire" data-action="nouvelle-personne">${ICONES.plus}Ajouter une personne</button>`;
  const BTN_AFFECTER = `<button class="btn primaire" data-action="nouvelle-affectation">${ICONES.plus}Affecter</button>`;

  // Barre de charge : jusqu'à 150 %, repère à 100 %.
  function barreCharge(b) {
    const t = Number.isFinite(b.taux) ? b.taux : 1.5;
    return `<span class="jauge etat-${b.etat}" aria-hidden="true"><i style="width:${Math.min(100, (t / 1.5) * 100)}%"></i><em></em></span>`;
  }

  // ---------- Alertes ----------
  function texteAlerte(x) {
    const per = x.semaines > 1 ? `${sem(x.debut)} → ${sem(x.fin)} (${x.semaines} semaines)` : libSemaine(x.debut);
    const r = E.reglages;
    switch (x.type) {
      case 'surcharge': return [`${esc(nomP(x.personne))} en surcharge`, x.valeur === null ? 'affecté une semaine où il ou elle est absent' : `jusqu'à ${x.valeur} % de sa capacité`, per, 'rouge', 'Surcharge'];
      case 'absence': return [`${esc(nomP(x.personne))} affecté pendant une absence`, `jusqu'à ${h(x.valeur)} planifiées sur ses jours d'absence`, per, 'rose', 'Absence'];
      case 'plafond': return [`${esc(nomP(x.personne))} : ${h(x.valeur)} planifiées`, `au-delà de ${h(r.plafondSemaine)} sur une semaine`, per, 'rouge', 'Durée'];
      case 'moyenne': return [`${esc(nomP(x.personne))} : ${h(x.valeur)} en moyenne`, `au-delà de ${h(r.plafondMoyen)} sur 12 semaines`, per, 'rouge', 'Durée'];
      case 'trou': return [`${esc(nomPr(x.projet))} : ${h(x.valeur)} non couvertes`, `besoin de ${h(x.besoin)} dans la semaine`, per, 'jaune', 'À couvrir'];
      case 'competence': return [`${esc(prenomP(x.personne))} sur ${esc(nomPr(x.projet))}`, `sans ${x.manquantes.length > 1 ? 'aucune des compétences' : 'la compétence'} ${x.manquantes.map((c) => `« ${esc(nomC(c))} »`).join(', ')}`, per, 'ciel', 'Compétence'];
      default: return ['', '', per, 'sable', ''];
    }
  }
  function ligneAlerte(x) {
    const [titre, detail, per, coul, lib] = texteAlerte(x);
    const action = x.type === 'competence' ? `data-action="affectation" data-id="${x.affectation}"` : `data-action="aller-semaine" data-lundi="${x.debut}" data-groupe="${x.projet ? 'projets' : 'personnes'}"`;
    return `<li class="alerte-${x.type}"><span class="etiquette ${coul}">${lib}</span><button class="lien-ligne" ${action}><b>${titre}</b><span>${detail} · ${per}</span></button></li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const L = lundiDe(t), N = ajout(L, 7);
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}La charge de l'équipe, ce qui coince dans les 4 prochaines semaines et qui peut prendre · ${libSemaine(L)}</p></div>
        <div class="actions">${BTN_AFFECTER}</div></div>`;
    if (!E.personnes.length) return `${titre}${vide('Aucune personne pour l\'instant', 'Ajoute les personnes de ton équipe (prénom, rôle, compétences, heures par semaine), puis tes projets et postes à couvrir : la charge se calcule ensuite toute seule.', BTN_PERSONNE)}${AVERTISSEMENT}`;
    const eq = R.equipeSemaine(E, L);
    const al = R.alertes(E, L, 4);
    const surcharges = eq.bilans.filter((b) => b.etat === 'surcharge');
    const trous = E.projets.map((pr) => R.couverture(E, pr, L)).filter((c) => c.trou);
    const dispo = R.disponibles(E, N).filter((x) => x.disponible);
    const tuiles = [
      ['Charge de l\'équipe', pct(eq.taux), `${h(eq.charge)} sur ${h(eq.capacite)} cette semaine`, 'var(--bleu)', 'rond'],
      ['En surcharge', String(surcharges.length), surcharges.length ? surcharges.map((b) => esc(prenomP(b.personne))).join(', ') : 'personne cette semaine', 'var(--rouge)', ''],
      ['Besoins non couverts', String(trous.length), trous.length ? `${h(trous.reduce((s, c) => s + c.manque, 0))} manquantes cette semaine` : 'tout est couvert cette semaine', 'var(--jaune)', 'rond'],
      ['Disponibles', String(dispo.length), `la semaine prochaine · ${h(dispo.reduce((s, x) => s + x.bilan.libre, 0))} libres`, 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const barres = eq.bilans.slice().sort((a, b) => (Number.isFinite(b.taux) ? b.taux : 9) - (Number.isFinite(a.taux) ? a.taux : 9)).map((b) => {
      const p = personne(b.personne);
      const info = `<b>${esc(nomP(p.id))}</b>${h(b.charge)} planifiées pour ${h(b.capacite)} de capacité${b.joursAbsents ? ` · ${nombre(b.joursAbsents)} j d'absence` : ''}<br>${Object.entries(b.parProjet).map(([k, v]) => `${esc(nomPr(k))} : ${h(v)}`).join('<br>') || 'Aucune affectation'}`;
      return `<button class="barre-pers" data-action="personne" data-id="${p.id}" data-info="${esc(info)}"><span class="bp-nom"><b>${esc(nomP(p.id))}</b><small>${esc(p.role)}</small></span>${barreCharge(b)}<span class="bp-val"><b>${pct(b.taux)}</b> ${etiquetteEtat(b)}</span></button>`;
    }).join('');
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À régler <span>4 prochaines semaines · ${pluriel(al.length, 'alerte')}</span></h2>
          ${al.length ? `<ul class="alertes-liste">${al.slice(0, 12).map(ligneAlerte).join('')}</ul>${al.length > 12 ? `<p class="aide">Et ${al.length - 12} autre${al.length > 13 ? 's' : ''} alerte${al.length > 13 ? 's' : ''} : voir le planning.</p>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien à régler</h3><p>Ni surcharge, ni affectation pendant une absence, ni besoin non couvert dans les 4 prochaines semaines.</p></div></div>'}
          <h2 class="titre-section">Disponibles la semaine prochaine <span>${libSemaine(N)}</span></h2>
          ${dispo.length ? `<ul class="prochains">${dispo.slice(0, 5).map((x) => `<li><span class="libre-pastille"><b>${nombre(x.bilan.libre)}</b>h</span><button class="lien-ligne" data-action="personne" data-id="${x.personne.id}"><b>${esc(nomP(x.personne.id))}</b><span>${esc(x.personne.role)}${x.personne.competences.length ? ` · ${x.personne.competences.map((c) => esc(nomC(c))).join(', ')}` : ''}</span></button><button class="btn petit" data-action="nouvelle-affectation" data-personne="${x.personne.id}" data-lundi="${N}">Affecter</button></li>`).join('')}</ul>
            <button class="btn lien" data-action="vue" data-vue="dispos">Chercher par compétence</button>` : '<p class="aide">Personne n\'a d\'heures libres la semaine prochaine.</p>'}
        </section>
        <section>
          <h2 class="titre-section">Charge cette semaine <span>100 % = capacité de la semaine</span></h2>
          <figure class="graphique charge-equipe"><div class="barres-pers">${barres}</div><div class="infobulle" hidden></div>
            <figcaption class="legende"><span><i class="cle etat-disponible"></i>Disponible (moins de ${nombre(E.reglages.seuilDisponible)} %)</span><span><i class="cle etat-plein"></i>Plein</span><span><i class="cle etat-surcharge"></i>Surcharge (plus de ${nombre(E.reglages.seuilSurcharge)} %)</span></figcaption></figure>
        </section>
      </div>
      ${AVERTISSEMENT}`;
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
        let x = re.left - rf.left + re.width / 2 - bulle.offsetWidth / 2;
        x = Math.min(Math.max(8, x), rf.width - bulle.offsetWidth - 8);
        let y = re.top - rf.top - bulle.offsetHeight - 8;
        if (y < 4) y = re.bottom - rf.top + 8;
        bulle.style.left = `${x}px`;
        bulle.style.top = `${y}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Planning (semaine et mois) ----------
  function joursAffiches(L) {
    const tous = new Set([...E.reglages.joursOuverture, ...E.personnes.flatMap((p) => R.joursDe(p))]);
    return Array.from({ length: 7 }, (_, i) => ajout(L, i)).filter((d) => tous.has(R.jourSemaine(d)));
  }
  const affectationsDuJour = (pid, prid, d) => E.affectations.filter((a) => a.personne === pid && a.projet === prid && R.couvre(a, d));

  function vuePlanning() {
    const t = auj();
    if (!pl.lundi) pl.lundi = lundiDe(t);
    if (!pl.mois) pl.mois = t.slice(0, 7);
    const semaine = pl.mode === 'semaine';
    const titreNav = semaine ? libSemaine(pl.lundi) : versDate(`${pl.mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
    const estCourant = semaine ? pl.lundi === lundiDe(t) : pl.mois === t.slice(0, 7);
    const bascule = (nom, val, lib) => `<button class="filtre" data-action="pl" data-cle="${nom}" data-val="${val}" aria-pressed="${pl[nom] === val}">${lib}</button>`;
    const outils = `<div class="cal-outils">
        <div class="rang"><button class="btn petit" data-action="pl-pas" data-pas="-1" aria-label="${semaine ? 'Semaine' : 'Mois'} précédent${semaine ? 'e' : ''}">‹</button><h2 class="cal-mois">${titreNav}</h2><button class="btn petit" data-action="pl-pas" data-pas="1" aria-label="${semaine ? 'Semaine' : 'Mois'} suivant${semaine ? 'e' : ''}">›</button>${estCourant ? '' : '<button class="btn petit" data-action="pl-pas" data-pas="0">Aujourd\'hui</button>'}</div>
        <div class="rang"><div class="filtres" role="group" aria-label="Période">${bascule('mode', 'semaine', 'Semaine')}${bascule('mode', 'mois', 'Mois')}</div><div class="filtres" role="group" aria-label="Lignes">${bascule('groupe', 'personnes', 'Par personne')}${bascule('groupe', 'projets', 'Par projet')}</div></div>
      </div>`;
    const tete = `<div class="vue-tete"><div><h1>Planning</h1><p>${semaine ? 'Qui fait quoi chaque jour : heures planifiées par projet, absences et fériés. Touche une case vide pour affecter.' : 'La charge de chaque semaine du mois. Touche une semaine pour l\'ouvrir.'}</p></div>
        <div class="actions"><button class="btn" data-action="imprimer">Imprimer</button>${BTN_AFFECTER}</div></div>`;
    if (!E.personnes.length) return `${tete}${vide('Aucune personne', 'Ajoute ton équipe dans l\'onglet Équipe pour voir le planning.', BTN_PERSONNE)}${AVERTISSEMENT}`;
    const corps = semaine ? (pl.groupe === 'personnes' ? semainePersonnes(pl.lundi, t) : semaineProjets(pl.lundi, t)) : (pl.groupe === 'personnes' ? moisPersonnes(t) : moisProjets(t));
    return `${tete}${outils}${corps}${AVERTISSEMENT}`;
  }

  function enTeteJours(jours, t, premiere, derniere) {
    return `<tr><th class="cal-nom" scope="col">${premiere}</th>${jours.map((d) => { const f = R.ferieChome(d, E.reglages); return `<th scope="col" class="${f ? 'ferie' : ''} ${d === t ? 'auj' : ''}" ${f ? `title="${esc(f.nom)}"` : ''}><small>${JOURS_COURTS[R.jourSemaine(d)]}</small>${Number(d.slice(8))}</th>`; }).join('')}<th scope="col" class="pl-total">${derniere}</th></tr>`;
  }

  function semainePersonnes(L, t) {
    const jours = joursAffiches(L);
    const pers = presents(L);
    let lignes = '';
    for (const p of pers) {
      const b = R.bilanSemaine(E, p, L);
      const cellules = jours.map((d) => {
        const j = b.jours.find((x) => x.date === d);
        if (!j.travail) return `<td class="repos ${j.ferie ? 'ferie' : ''} ${d === t ? 'auj' : ''}">${j.ferie ? '<small class="pl-ferie">Férié</small>' : ''}</td>`;
        const morceaux = [];
        if (j.absence) { const ty = typeAbs(j.absence.type); morceaux.push(`<button class="puce-abs" data-action="absence" data-id="${j.absence.id}">${esc(ty.nom)}${j.part < 1 ? ' ½' : ''}</button>`); }
        for (const [prid, hh] of Object.entries(j.projets)) {
          const pr = projet(prid);
          const a = affectationsDuJour(p.id, prid, d)[0];
          morceaux.push(`<button class="puce-projet ${j.part ? 'en-absence' : ''}" style="--c:${couleur(pr)}" data-action="affectation" data-id="${a?.id || ''}" data-info="${esc(`<b>${esc(nomP(p.id))}</b>${esc(pr?.nom || '')} · ${h(a?.heures || 0)} par semaine<br>${a ? plage(a) : ''}${j.part ? '<br>Pendant une absence' : ''}`)}" aria-label="${esc(`${pr?.nom || ''}, ${h(hh)}, ${dateLongue(d)}`)}"><span>${esc(pr?.nom || '')}</span><small>${nombre(hh)} h</small></button>`);
        }
        const libre = j.capacite - j.charge;
        if (libre > 0.05 && j.part < 1) morceaux.push(`<button class="pl-ajout" data-action="nouvelle-affectation" data-personne="${p.id}" data-lundi="${L}" aria-label="Affecter ${esc(p.prenom)} (${h(libre)} libres le ${dateLongue(d)})">+ ${nombre(libre)} h</button>`);
        return `<td class="${d === t ? 'auj' : ''}"><div class="pl-cellule">${morceaux.join('')}</div></td>`;
      }).join('');
      lignes += `<tr class="pl-${b.etat}"><th scope="row" class="cal-nom"><button class="lien-ligne" data-action="personne" data-id="${p.id}"><b>${esc(p.prenom)} ${esc(p.nom.slice(0, 1))}${p.nom ? '.' : ''}</b><span>${esc(p.role)}${p.capacite !== E.reglages.capaciteDefaut ? ` · ${nombre(p.capacite)} h` : ''}</span></button></th>${cellules}<td class="pl-total"><b>${pct(b.taux)}</b><small>${nombre(b.charge)} / ${nombre(b.capacite)} h</small>${etiquetteEtat(b)}</td></tr>`;
    }
    const eq = R.equipeSemaine(E, L);
    return `<figure class="graphique cal-cadre"><div class="cal-defile" tabindex="0" aria-label="Planning de la semaine, défilement horizontal"><table class="cal planning"><caption class="sr-only">Planning ${libSemaine(L)}</caption><thead>${enTeteJours(jours, t, '<span class="sr-only">Personne</span>', 'Charge')}</thead><tbody>${lignes}</tbody>
      <tfoot><tr><th scope="row" class="cal-nom">Équipe</th><td colspan="${jours.length}"></td><td class="pl-total"><b>${pct(eq.taux)}</b><small>${nombre(eq.charge)} / ${nombre(eq.capacite)} h</small></td></tr></tfoot></table></div><div class="infobulle" hidden></div></figure>
      ${legendeProjets(L)}`;
  }

  function legendeProjets(L) {
    const prs = E.projets.filter((pr) => R.actifProjetSemaine(pr, L) || E.affectations.some((a) => a.projet === pr.id && a.fin >= L && a.debut <= ajout(L, 6) && pr.statut === 'actif'));
    return `<ul class="legende">${prs.map((pr) => `<li>${puceProjet(pr, esc(pr.nom))}</li>`).join('')}<li><span class="puce-abs">Absence</span></li><li><span class="puce-projet en-absence" style="--c:#6E685F">Pendant une absence</span></li></ul>`;
  }

  function semaineProjets(L, t) {
    const jours = joursAffiches(L);
    const prs = E.projets.filter((pr) => pr.statut === 'actif' && (R.actifProjetSemaine(pr, L) || E.affectations.some((a) => a.projet === pr.id && a.fin >= L && a.debut <= ajout(L, 6))));
    if (!prs.length) return vide('Aucun projet cette semaine', 'Crée tes projets et postes à couvrir dans l\'onglet Projets.', `<button class="btn primaire" data-action="nouveau-projet">${ICONES.plus}Nouveau projet ou poste</button>`);
    let lignes = '';
    for (const pr of prs) {
      const c = R.couverture(E, pr, L);
      const cellules = jours.map((d) => {
        const morceaux = [];
        for (const pid of Object.keys(c.personnes)) {
          const p = personne(pid);
          const b = R.bilanSemaine(E, p, L);
          const j = b.jours.find((x) => x.date === d);
          const hh = j?.projets[pr.id] || 0;
          if (!hh) continue;
          const a = affectationsDuJour(pid, pr.id, d)[0];
          morceaux.push(`<button class="puce-projet ${j.part ? 'en-absence' : ''}" style="--c:${couleur(pr)}" data-action="affectation" data-id="${a?.id || ''}" aria-label="${esc(`${nomP(pid)}, ${h(hh)}, ${dateLongue(d)}${j.part ? ', absent' : ''}`)}"><span>${esc(p.prenom)}</span><small>${j.part ? 'absent' : `${nombre(hh)} h`}</small></button>`);
        }
        const f = R.ferieChome(d, E.reglages);
        return `<td class="${f ? 'repos ferie' : ''} ${d === t ? 'auj' : ''}"><div class="pl-cellule">${morceaux.join('')}</div></td>`;
      }).join('');
      lignes += `<tr><th scope="row" class="cal-nom"><button class="lien-ligne" data-action="projet" data-id="${pr.id}"><b>${puceProjet(pr, esc(pr.nom))}</b><span>${pr.type === 'poste' ? 'Poste à couvrir' : esc(pr.client || 'Projet')}</span></button></th>${cellules}<td class="pl-total ${c.trou ? 'manque' : ''}"><b>${nombre(c.couvert)}${c.besoin ? ` / ${nombre(c.besoin)}` : ''} h</b><small>${c.besoin ? (c.trou ? `${h(c.manque)} à couvrir` : 'couvert') : 'sans besoin fixé'}</small></td></tr>`;
    }
    return `<figure class="graphique cal-cadre"><div class="cal-defile" tabindex="0" aria-label="Planning des projets, défilement horizontal"><table class="cal planning"><caption class="sr-only">Projets ${libSemaine(L)}</caption><thead>${enTeteJours(jours, t, '<span class="sr-only">Projet</span>', 'Couvert')}</thead><tbody>${lignes}</tbody></table></div></figure>
      <p class="aide">« Couvert » : heures planifiées hors absences, face au besoin de la semaine (au prorata des jours d'ouverture et des fériés).</p>`;
  }

  function moisPersonnes(t) {
    const semaines = R.semainesDuMois(pl.mois);
    const L0 = lundiDe(t);
    const pers = E.personnes.filter((p) => semaines.some((l) => R.actifSemaine(p, l))).sort(tri);
    const tete = `<tr><th class="cal-nom" scope="col"><span class="sr-only">Personne</span></th>${semaines.map((l) => `<th scope="col" class="${l === L0 ? 'auj' : ''}"><small>${sem(l)}</small>${dateCourte(l)}</th>`).join('')}</tr>`;
    const lignes = pers.map((p) => `<tr><th scope="row" class="cal-nom"><button class="lien-ligne" data-action="personne" data-id="${p.id}"><b>${esc(p.prenom)} ${esc(p.nom.slice(0, 1))}${p.nom ? '.' : ''}</b><span>${esc(p.role)}</span></button></th>${semaines.map((l) => {
      if (!R.actifSemaine(p, l)) return '<td class="hors"></td>';
      const b = R.bilanSemaine(E, p, l);
      const info = `<b>${esc(nomP(p.id))} · ${sem(l)}</b>${h(b.charge)} pour ${h(b.capacite)}${b.joursAbsents ? ` · ${nombre(b.joursAbsents)} j d'absence` : ''}<br>${Object.entries(b.parProjet).map(([k, v]) => `${esc(nomPr(k))} : ${h(v)}`).join('<br>')}`;
      return `<td class="${l === L0 ? 'auj' : ''}"><button class="mois-case etat-${b.etat}" data-action="aller-semaine" data-lundi="${l}" data-info="${esc(info)}" aria-label="${esc(`${nomP(p.id)}, ${sem(l)}, ${pct(b.taux)}, ${ETAT_LIB[b.etat]}`)}"><b>${b.etat === 'absent' || b.capacite <= 0 ? 'Absent' : pct(b.taux)}</b><small>${b.capacite <= 0 && b.charge > 0 ? `${nombre(b.charge)} h affectées` : b.joursAbsents && b.etat !== 'absent' ? `${nombre(b.joursAbsents)} j abs.` : `${nombre(b.charge)} h`}</small></button></td>`;
    }).join('')}</tr>`).join('');
    const totaux = `<tr class="cal-total"><th scope="row" class="cal-nom">Équipe</th>${semaines.map((l) => { const eq = R.equipeSemaine(E, l); return `<td>${pct(eq.taux)}</td>`; }).join('')}</tr>`;
    return `<figure class="graphique cal-cadre"><div class="cal-defile" tabindex="0" aria-label="Charge du mois, défilement horizontal"><table class="cal mois"><caption class="sr-only">Charge par semaine</caption><thead>${tete}</thead><tbody>${lignes}${totaux}</tbody></table></div><div class="infobulle" hidden></div></figure>
      <ul class="legende"><li><span class="mois-cle etat-disponible"></span>Disponible</li><li><span class="mois-cle etat-plein"></span>Plein</li><li><span class="mois-cle etat-surcharge"></span>Surcharge</li><li><span class="mois-cle etat-absent"></span>Absent</li></ul>`;
  }

  function moisProjets(t) {
    const semaines = R.semainesDuMois(pl.mois);
    const L0 = lundiDe(t);
    const prs = E.projets.filter((pr) => pr.statut === 'actif' && semaines.some((l) => R.actifProjetSemaine(pr, l)));
    if (!prs.length) return vide('Aucun projet actif ce mois-ci', 'Crée tes projets et postes à couvrir dans l\'onglet Projets.', '');
    const tete = `<tr><th class="cal-nom" scope="col"><span class="sr-only">Projet</span></th>${semaines.map((l) => `<th scope="col" class="${l === L0 ? 'auj' : ''}"><small>${sem(l)}</small>${dateCourte(l)}</th>`).join('')}</tr>`;
    const lignes = prs.map((pr) => `<tr><th scope="row" class="cal-nom"><button class="lien-ligne" data-action="projet" data-id="${pr.id}"><b>${puceProjet(pr, esc(pr.nom))}</b><span>${pr.type === 'poste' ? 'Poste à couvrir' : esc(pr.client || 'Projet')}</span></button></th>${semaines.map((l) => {
      if (!R.actifProjetSemaine(pr, l)) return '<td class="hors"></td>';
      const c = R.couverture(E, pr, l);
      return `<td class="${l === L0 ? 'auj' : ''}"><button class="mois-case ${c.trou ? 'manque' : c.besoin ? 'couvert' : ''}" data-action="aller-semaine" data-lundi="${l}" data-groupe="projets" aria-label="${esc(`${pr.nom}, ${sem(l)}, ${nombre(c.couvert)} heures sur ${nombre(c.besoin)}`)}"><b>${nombre(c.couvert)}${c.besoin ? `/${nombre(c.besoin)}` : ''} h</b><small>${c.trou ? `−${nombre(c.manque)} h` : c.besoin ? 'couvert' : 'planifié'}</small></button></td>`;
    }).join('')}</tr>`).join('');
    return `<figure class="graphique cal-cadre"><div class="cal-defile" tabindex="0" aria-label="Couverture du mois, défilement horizontal"><table class="cal mois"><caption class="sr-only">Couverture par semaine</caption><thead>${tete}</thead><tbody>${lignes}</tbody></table></div></figure>
      <p class="aide">Heures couvertes (hors absences) sur le besoin de chaque semaine. En jaune : un trou à combler.</p>`;
  }

  // ---------- Qui est disponible ----------
  function vueDispos() {
    const t = auj();
    if (!ds.lundi) ds.lundi = ajout(lundiDe(t), 7);
    const roles = [...new Set(E.personnes.map((p) => p.role).filter(Boolean))].sort();
    const heuresMin = R.lireNombre(ds.heures) || 0;
    const liste = R.disponibles(E, ds.lundi, { competence: ds.competence, role: ds.role, heuresMin });
    const oui = liste.filter((x) => x.disponible), non = liste.filter((x) => !x.disponible);
    const carte = (x) => {
      const p = x.personne, b = x.bilan;
      const abs = b.absences.map((a) => `${typeAbs(a.type).nom} ${plage(a)}`).join(', ');
      return `<li class="carte-dispo etat-${b.etat}">
        <div class="cdp-tete"><span class="libre-pastille"><b>${nombre(b.libre)}</b>h</span><button class="lien-ligne" data-action="personne" data-id="${p.id}"><b>${esc(nomP(p.id))}</b><span>${esc(p.role)} · ${h(b.capacite)} de capacité${b.capacite < b.nominale ? ` sur ${h(b.nominale)}` : ''}</span></button>${etiquetteEtat(b)}</div>
        ${barreCharge(b)}
        <p class="cdp-detail">${Object.entries(b.parProjet).map(([k, v]) => `${esc(nomPr(k))} ${h(v)}`).join(' · ') || 'Aucune affectation cette semaine'}${abs ? ` · <b>${esc(abs)}</b>` : ''}</p>
        ${p.competences.length ? `<div class="ligne-etiquettes">${chipsCompetences(p.competences, ds.competence)}</div>` : ''}
        ${x.disponible ? `<div class="rang"><button class="btn petit primaire" data-action="nouvelle-affectation" data-personne="${p.id}" data-lundi="${ds.lundi}">Affecter ${esc(p.prenom)}</button></div>` : ''}
      </li>`;
    };
    return `
      <div class="vue-tete"><div><h1>Qui est disponible ?</h1><p>Les heures libres de chacun pour la semaine choisie, absences, temps partiels et fériés déduits. Filtre par compétence pour trouver un renfort.</p></div></div>
      <div class="cal-outils">
        <div class="rang"><button class="btn petit" data-action="ds-pas" data-pas="-1" aria-label="Semaine précédente">‹</button><h2 class="cal-mois">${libSemaine(ds.lundi)}</h2><button class="btn petit" data-action="ds-pas" data-pas="1" aria-label="Semaine suivante">›</button>${ds.lundi === ajout(lundiDe(t), 7) ? '' : '<button class="btn petit" data-action="ds-pas" data-pas="0">Semaine prochaine</button>'}</div>
        <div class="rang filtres-dispo">
          <label class="champ"><span class="sr-only">Compétence</span><select data-filtre-ds="competence"><option value="">Toutes les compétences</option>${E.competences.map((c) => `<option value="${c.id}" ${ds.competence === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
          <label class="champ"><span class="sr-only">Rôle</span><select data-filtre-ds="role"><option value="">Tous les rôles</option>${roles.map((r) => `<option ${ds.role === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
          <label class="champ champ-heures">Au moins<input data-filtre-ds="heures" inputmode="decimal" value="${esc(ds.heures)}" placeholder="0"> h libres</label>
        </div>
      </div>
      ${!E.personnes.length ? vide('Aucune personne', 'Ajoute ton équipe dans l\'onglet Équipe.', BTN_PERSONNE)
        : `<h2 class="titre-section">Disponibles <span>${pluriel(oui.length, 'personne')} · ${h(oui.reduce((s, x) => s + x.bilan.libre, 0))} libres</span></h2>
      ${oui.length ? `<ul class="grille-dispo">${oui.map(carte).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Personne ne correspond</h3><p>Change de semaine, de compétence ou le nombre d\'heures libres demandé.</p></div></div>'}
      ${non.length ? `<details class="plus-tard"><summary>Pas disponibles (${non.length})</summary><ul class="grille-dispo">${non.map(carte).join('')}</ul></details>` : ''}`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Projets ----------
  const FILTRES_PR = [['actifs', 'En cours'], ['avenir', 'À venir'], ['postes', 'Postes à couvrir'], ['pause', 'En pause'], ['termine', 'Terminés'], ['tous', 'Tous']];
  function garderProjet(pr, f, t) {
    if (f === 'tous') return true;
    if (f === 'actifs') return pr.statut === 'actif' && (!pr.debut || pr.debut <= t) && (!pr.fin || pr.fin >= t);
    if (f === 'avenir') return pr.statut === 'actif' && pr.debut > t;
    if (f === 'postes') return pr.type === 'poste' && pr.statut !== 'termine';
    return pr.statut === f;
  }
  function vueProjets() {
    const t = auj();
    const L = lundiDe(t), N = ajout(L, 7);
    const q = fp.q.trim().toLowerCase();
    const liste = E.projets.filter((pr) => garderProjet(pr, fp.statut, t) && (!q || `${pr.nom} ${pr.client} ${pr.note}`.toLowerCase().includes(q)))
      .sort((a, b) => (a.type === b.type ? 0 : a.type === 'poste' ? 1 : -1) || (a.debut || '').localeCompare(b.debut || '') || a.nom.localeCompare(b.nom));
    const ligne = (pr) => {
      const c0 = R.couverture(E, pr, L), c1 = R.couverture(E, pr, N);
      const gens = [...new Set(E.affectations.filter((a) => a.projet === pr.id && a.fin >= t).map((a) => a.personne))];
      const couv = (c, lib) => (c.besoin ? `<span class="${c.trou ? 'negatif' : ''}">${lib} : ${nombre(c.couvert)} / ${h(c.besoin)}</span>` : `<span>${lib} : ${h(c.affecte)}</span>`);
      const tags = [];
      if (pr.statut !== 'actif') tags.push(`<span class="etiquette sable">${R.LIB_STATUT[pr.statut]}</span>`);
      if (pr.type === 'poste') tags.push('<span class="etiquette ciel">Poste à couvrir</span>');
      if (c0.trou || c1.trou) tags.push('<span class="etiquette jaune">À couvrir</span>');
      if (c0.competences.length || c1.competences.length) tags.push('<span class="etiquette rose">Compétence manquante</span>');
      return `<li class="ligne-abs ${c0.trou || c1.trou ? 'alerte-trou' : ''} ${pr.statut !== 'actif' ? 'st-annulee' : ''}">
        <button class="ligne-info" data-action="projet" data-id="${pr.id}"><b>${puceProjet(pr, esc(pr.nom))}${pr.client ? ` <span class="numero">${esc(pr.client)}</span>` : ''}</b>
          <span class="ligne-detail">${pr.debut || pr.fin ? `${pr.debut ? dateCourte(pr.debut) : '…'} → ${pr.fin ? fmt(pr.fin) : '…'}` : 'Sans date de fin'}${pr.besoin ? ` · besoin ${h(pr.besoin)} par semaine` : ''}${pr.competences.length ? ` · ${pr.competences.map((c) => esc(nomC(c))).join(', ')}` : ''}</span>
          <span class="ligne-detail">${gens.length ? gens.map((id) => esc(prenomP(id))).join(', ') : 'Personne d\'affecté'}</span>
          <span class="ligne-etiquettes">${tags.join('')}</span></button>
        <div class="ligne-droite"><span class="ligne-proch">${couv(c0, 'Cette semaine')}</span><span class="ligne-proch">${couv(c1, 'Semaine prochaine')}</span>${pr.statut === 'actif' ? `<button class="btn petit" data-action="nouvelle-affectation" data-projet="${pr.id}">Affecter</button>` : ''}</div>
      </li>`;
    };
    const nb = (id) => E.projets.filter((pr) => garderProjet(pr, id, t)).length;
    return `
      <div class="vue-tete"><div><h1>Projets et postes</h1><p>Les projets ont un début et une fin ; les postes à couvrir (accueil, permanence, ligne) durent. Indique un besoin en heures par semaine pour voir ce qui manque.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-projet">${ICONES.plus}Nouveau projet ou poste</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer">${FILTRES_PR.map(([id, lib]) => `<button class="filtre" data-action="filtre-pr" data-statut="${id}" aria-pressed="${fp.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Projet, client, note" value="${esc(fp.q)}"></label>
      </div>
      ${liste.length ? `<ul class="lignes-abs" style="margin-top:12px">${liste.map(ligne).join('')}</ul>` : vide(E.projets.length ? 'Aucun projet ne correspond' : 'Aucun projet ni poste', E.projets.length ? 'Change le filtre ou la recherche.' : 'Crée un projet (avec ses dates) ou un poste à couvrir (avec son besoin hebdomadaire).', `<button class="btn primaire" data-action="nouveau-projet">${ICONES.plus}Nouveau projet ou poste</button>`)}
      ${AVERTISSEMENT}`;
  }

  // ---------- Équipe ----------
  function vueEquipe() {
    const t = auj();
    const L = lundiDe(t);
    const pers = [...E.personnes].sort((a, b) => Number(!!a.sortie && a.sortie < t) - Number(!!b.sortie && b.sortie < t) || tri(a, b));
    const ligne = (p) => {
      const parti = p.sortie && p.sortie < t;
      const b = R.bilanSemaine(E, p, L);
      const prochaine = E.absences.filter((a) => a.personne === p.id && a.fin >= t).sort((x, y) => x.debut.localeCompare(y.debut))[0];
      const jours = R.joursDe(p);
      return `<li class="ligne-abs ${parti || p.efface ? 'st-annulee' : ''}">
        <button class="ligne-info" data-action="personne" data-id="${p.id}"><b>${esc(p.prenom)} ${esc(p.nom)} <span class="numero">${esc(p.role)}</span></b>
          <span class="ligne-detail">${h(p.capacite)} par semaine${jours.length !== 5 || jours.includes(6) || jours.includes(0) ? ` · ${JOURS_SEMAINE.filter(([k]) => jours.includes(k)).map(([, l]) => l).join(', ')}` : ''}${p.entree && p.entree > ajout(t, -90) ? ` · arrivée le ${fmt(p.entree)}` : ''}${p.sortie ? ` · ${parti ? 'partie' : 'départ'} le ${fmt(p.sortie)}` : ''}${prochaine ? ` · ${esc(typeAbs(prochaine.type).nom)} ${plage(prochaine)}` : ''}</span>
          <span class="ligne-etiquettes">${chipsCompetences(p.competences)}${p.efface ? '<span class="etiquette sable">Données effacées</span>' : ''}</span></button>
        <div class="ligne-droite">${parti ? '<span class="ligne-proch">Partie</span>' : `<span class="ligne-cout"><b>${pct(b.taux)}</b><small>cette semaine</small></span>${etiquetteEtat(b)}<span class="rang"><button class="btn petit" data-action="nouvelle-absence" data-personne="${p.id}">Absence</button><button class="btn petit" data-action="nouvelle-affectation" data-personne="${p.id}">Affecter</button></span>`}</div>
      </li>`;
    };
    const absAvenir = E.absences.filter((a) => a.fin >= ajout(t, -7)).sort((x, y) => x.debut.localeCompare(y.debut));
    return `
      <div class="vue-tete"><div><h1>Équipe</h1><p>Les personnes, leur rôle, leurs compétences et leur capacité par semaine (temps partiel compris), leurs absences.</p></div>
        <div class="actions"><button class="btn" data-action="nouvelle-absence">${ICONES.plus}Absence</button>${BTN_PERSONNE}</div></div>
      ${pers.length ? `<ul class="lignes-abs">${pers.map(ligne).join('')}</ul>` : vide('Aucune personne', 'Le minimum : un prénom, un rôle et un nombre d\'heures par semaine (35 h à temps complet par défaut). Ajoute ses compétences pour trouver des renforts.', BTN_PERSONNE)}
      <h2 class="titre-section">Absences <span>en cours et à venir · congés, formation, autre</span></h2>
      ${absAvenir.length ? `<ul class="prochains">${absAvenir.map((a) => `<li><span class="pastille-abs">${esc(typeAbs(a.type).lettre)}</span><button class="lien-ligne" data-action="absence" data-id="${a.id}"><b>${esc(nomP(a.personne))}</b><span>${esc(typeAbs(a.type).nom)} · ${plage(a)}${a.demiDebut ? ' · à partir de l\'après-midi' : ''}${a.demiFin ? ' · jusqu\'à midi' : ''}${a.note ? ` · ${esc(a.note)}` : ''}</span></button>${R.couvre(a, t) ? '<span class="etiquette ciel">En cours</span>' : a.fin < t ? '<span class="etiquette sable">Passée</span>' : `<span class="nb">dans ${pluriel(R.ecart(t, a.debut), 'jour')}</span>`}</li>`).join('')}</ul>` : '<p class="aide">Aucune absence à venir. Saisis les congés et formations validés : la capacité de la semaine baisse d\'autant.</p>'}
      <h2 class="titre-section">Compétences <span>${pluriel(E.competences.length, 'compétence')}</span></h2>
      <div class="ligne-etiquettes comp-liste">${E.competences.map((c) => `<button class="puce-comp" data-action="competence" data-id="${c.id}">${esc(c.nom)} <small>${E.personnes.filter((p) => p.competences.includes(c.id)).length}</small></button>`).join('')}<button class="btn petit" data-action="nouvelle-competence">${ICONES.plus}Compétence</button></div>
      <div class="rgpd"><h2>Données personnelles de ton équipe</h2><p>Garde le minimum : prénom, nom, rôle, compétences, heures par semaine, affectations et absences. <b>Aucune donnée de santé</b> : « Autre absence » suffit, jamais de motif médical. Informe ton équipe que son planning est tenu ici. Ouvre une personne pour <b>exporter ses données</b> (droit d'accès), les <b>effacer</b> (le nom est remplacé, les heures restent pour une charge juste) ou la <b>supprimer avec ses affectations et absences</b>.</p></div>
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
  const optionsPersonnes = (choisi, t) => E.personnes.filter((p) => !p.sortie || p.sortie >= t || p.id === choisi).sort(tri).map((p) => `<option value="${p.id}" ${p.id === choisi ? 'selected' : ''}>${esc(p.prenom)} ${esc(p.nom)}${p.role ? ` · ${esc(p.role)}` : ''}</option>`).join('');

  // Saisie ou modification d'une affectation, avec l'aperçu de la charge semaine par semaine.
  function modaleAffectation(id, { personneId = '', projetId = '', lundi = '' } = {}) {
    const t = auj();
    const a = id ? affectation(id) : null;
    if (id && !a) return;
    if (!E.personnes.length) { toast('Ajoute d\'abord une personne dans l\'onglet Équipe.'); return; }
    const projets = E.projets.filter((pr) => pr.statut === 'actif' || pr.id === a?.projet);
    if (!projets.length) { toast('Crée d\'abord un projet ou un poste dans l\'onglet Projets.'); return; }
    const debut = lundi || (a ? a.debut : lundiDe(t));
    const pr0 = projet(projetId);
    const v = a || { personne: personneId || presents(lundiDe(t))[0]?.id || E.personnes[0].id, projet: projetId || projets[0].id, debut: pr0?.debut && pr0.debut > debut ? pr0.debut : debut, fin: pr0?.fin || ajout(debut, 4 + (lundi ? 0 : 7 * 3)), heures: 7, note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Personne<select name="personne">${optionsPersonnes(v.personne, t)}</select></label>
        <label class="champ">Projet ou poste<select name="projet">${projets.map((pr) => `<option value="${pr.id}" ${pr.id === v.projet ? 'selected' : ''}>${esc(pr.nom)}${pr.client ? ` · ${esc(pr.client)}` : ''}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Du<input type="date" name="debut" required value="${v.debut}"></label>
        <label class="champ">Au (inclus)<input type="date" name="fin" required value="${v.fin}"></label>
      </div>
      <label class="champ">Heures par semaine <small>Réparties sur les jours travaillés de la personne.</small><input name="heures" inputmode="decimal" required value="${nombre(v.heures)}"></label>
      <div class="rang raccourcis" id="raccourcis"></div>
      <div id="apercu-aff" class="apercu" aria-live="polite"></div>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="120" value="${esc(v.note)}"></label>
      ${a?.par ? `<p class="mention">Saisie par ${esc(a.par)}${a.majLe ? ` le ${fmt(a.majLe)}` : ''}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Affecter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier l\'affectation' : 'Nouvelle affectation', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        retenir();
        E.affectations = E.affectations.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast('Affectation supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const brut = lireAffectation(fd, a);
      if (typeof brut === 'string') return brut;
      retenir();
      if (a) Object.assign(a, brut); else E.affectations.push(brut);
      sauver(); rendre();
      toast(`${prenomP(brut.personne)} sur ${nomPr(brut.projet)} : ${h(brut.heures)} par semaine (${plage(brut)})`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majApercu = () => {
      const fd = new FormData(d.querySelector('form'));
      const p = personne(fd.get('personne'));
      const zone = d.querySelector('#apercu-aff');
      d.querySelector('#raccourcis').innerHTML = p ? [0.25, 0.5, 0.75, 1].map((x) => `<button type="button" class="filtre" data-heures="${R.arrondi1(p.capacite * x)}">${x * 100} % · ${nombre(p.capacite * x)} h</button>`).join('') : '';
      d.querySelectorAll('[data-heures]').forEach((b) => b.addEventListener('click', () => { d.querySelector('[name=heures]').value = nombre(Number(b.dataset.heures)); majApercu(); }));
      const brut = lireAffectation(fd, a);
      if (typeof brut === 'string') { zone.innerHTML = ''; return; }
      const ap = R.apercuAffectation(E, brut);
      if (!ap) { zone.innerHTML = ''; return; }
      const pr = projet(brut.projet);
      let html = `<p><b>${esc(p.prenom)}</b>, ${ap.total > 1 ? `${ap.total} semaines` : '1 semaine'} : ${ap.surcharges ? `<b class="negatif">surcharge ${ap.surcharges > 1 ? `${ap.surcharges} semaines` : '1 semaine'}</b>` : 'pas de surcharge'}${ap.total > 12 ? ' (12 premières semaines vérifiées)' : ''}.</p>`;
      html += `<div class="apercu-semaines">${ap.semaines.map((b) => `<span class="mois-case petit etat-${b.etat}" title="${esc(`${libSemaine(b.lundi)} : ${h(b.charge)} pour ${h(b.capacite)}`)}"><small>${sem(b.lundi)}</small><b>${b.etat === 'absent' || b.capacite <= 0 ? 'Abs.' : pct(b.taux)}</b></span>`).join('')}</div>`;
      if (ap.absences.length) html += `<p class="cd-alerte">Absence pendant cette période : ${ap.absences.map((x) => `${esc(typeAbs(x.type).nom)} ${plage(x)}`).join(', ')}. Les heures de ces jours ne seront pas faites.</p>`;
      if (ap.manquantes.length) html += `<p class="cd-alerte">${esc(p.prenom)} n'a ${ap.manquantes.length > 1 ? 'aucune des compétences' : 'pas la compétence'} ${ap.manquantes.map((c) => `« ${esc(nomC(c))} »`).join(', ')} demandée par ${esc(pr?.nom || '')}.</p>`;
      if (ap.horsPeriode) html += `<p>Attention : l'affectation dépasse les dates du projet (${pr.debut ? dateCourte(pr.debut) : '…'} → ${pr.fin ? dateCourte(pr.fin) : '…'}).</p>`;
      zone.innerHTML = html;
    };
    d.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', majApercu));
    d.querySelector('[name=heures]').addEventListener('input', majApercu);
    const de = d.querySelector('[name=debut]'), fi = d.querySelector('[name=fin]');
    de.addEventListener('change', () => { if (R.estDate(de.value) && (!R.estDate(fi.value) || fi.value < de.value)) { fi.value = de.value; majApercu(); } });
    d.querySelector('[name=projet]').addEventListener('change', (e) => {
      if (a) return;
      const pr = projet(e.target.value);
      if (pr?.fin && pr.fin >= de.value) fi.value = pr.fin;
      majApercu();
    });
    majApercu();
  }

  function lireAffectation(fd, a) {
    const debut = fd.get('debut'), fin = fd.get('fin');
    if (!personne(fd.get('personne'))) return 'Choisis une personne.';
    if (!projet(fd.get('projet'))) return 'Choisis un projet ou un poste.';
    if (!R.estDate(debut) || !R.estDate(fin)) return 'Indique les dates de début et de fin.';
    if (fin < debut) return 'La fin ne peut pas précéder le début.';
    if (R.ecart(debut, fin) > 731) return 'Une affectation de plus de deux ans : découpe-la.';
    const heures = R.lireNombre(fd.get('heures'));
    if (heures === null || heures <= 0 || heures > 80) return 'Heures par semaine : un nombre entre 0,5 et 80.';
    return R.normaliserAffectation({ ...(a || {}), id: a?.id || uid(), personne: fd.get('personne'), projet: fd.get('projet'), debut, fin, heures, note: String(fd.get('note') || '').trim(), par: auteur() || a?.par || '', majLe: auj() });
  }

  function modaleAbsence(id, { personneId = '' } = {}) {
    const t = auj();
    const a = id ? absence(id) : null;
    if (id && !a) return;
    if (!E.personnes.length) { toast('Ajoute d\'abord une personne dans l\'onglet Équipe.'); return; }
    const v = a || { personne: personneId || E.personnes[0].id, type: 'conges', debut: ajout(t, 1), fin: ajout(t, 1), demiDebut: false, demiFin: false, note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Personne<select name="personne">${optionsPersonnes(v.personne, t)}</select></label>
        <label class="champ">Type<select name="type">${B.typesAbsence.map((ty) => `<option value="${ty.id}" ${ty.id === v.type ? 'selected' : ''}>${esc(ty.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Du<input type="date" name="debut" required value="${v.debut}"></label>
        <label class="champ">Au (inclus)<input type="date" name="fin" required value="${v.fin}"></label>
      </div>
      <div class="cases"><label class="case"><input type="checkbox" name="demiDebut" ${v.demiDebut ? 'checked' : ''}> Commence l'après-midi</label><label class="case"><input type="checkbox" name="demiFin" ${v.demiFin ? 'checked' : ''}> S'arrête à midi</label></div>
      <label class="champ">Note <small>Facultative. Jamais de motif médical ni d'information de santé.</small><input name="note" maxlength="120" value="${esc(v.note)}"></label>
      <p class="mention">Les congés se valident ailleurs (par exemple dans le Suivi des congés QME) : saisis ici ceux qui sont acquis, pour que la capacité en tienne compte.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = a ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier l\'absence' : 'Nouvelle absence', corps, pied, (fd, action) => {
      if (action === 'supprimer') { retenir(); E.absences = E.absences.filter((x) => x.id !== a.id); sauver(); rendre(); toast('Absence supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      const debut = fd.get('debut'), fin = fd.get('fin');
      if (!personne(fd.get('personne'))) return 'Choisis une personne.';
      if (!R.estDate(debut) || !R.estDate(fin)) return 'Indique les dates de début et de fin.';
      if (fin < debut) return 'La fin ne peut pas précéder le début.';
      if (R.ecart(debut, fin) > 366) return 'Une absence de plus d\'un an : découpe-la, ou indique une date de sortie dans la fiche de la personne.';
      const brut = R.normaliserAbsence({ ...(a || {}), id: a?.id || uid(), personne: fd.get('personne'), type: fd.get('type'), debut, fin, demiDebut: !!fd.get('demiDebut'), demiFin: !!fd.get('demiFin'), note: String(fd.get('note') || '').trim(), par: auteur() || a?.par || '' }, B.typesAbsence.map((x) => x.id));
      const conflit = E.absences.find((x) => x.id !== brut.id && x.personne === brut.personne && R.seChevauchent(x, brut));
      if (conflit) return `${nomP(brut.personne)} a déjà une absence sur ces dates (${plage(conflit)}).`;
      retenir();
      if (a) Object.assign(a, brut); else E.absences.push(brut);
      sauver(); rendre();
      const affs = E.affectations.filter((x) => x.personne === brut.personne && R.seChevauchent(x, brut) && projet(x.projet)?.statut === 'actif');
      toast(`${typeAbs(brut.type).nom} de ${prenomP(brut.personne)} (${plage(brut)}).${affs.length ? ` ${pluriel(affs.length, 'affectation')} à revoir pendant l'absence.` : ''}`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const de = d.querySelector('[name=debut]'), fi = d.querySelector('[name=fin]');
    de.addEventListener('change', () => { if (R.estDate(de.value) && (!R.estDate(fi.value) || fi.value < de.value)) fi.value = de.value; });
  }

  // Fiche d'une personne : identité, capacité, compétences, affectations à venir, données personnelles.
  function modalePersonne(id) {
    const t = auj();
    const p = id ? personne(id) : null;
    const v = p || { prenom: '', nom: '', role: '', competences: [], capacite: E.reglages.capaciteDefaut, jours: [1, 2, 3, 4, 5], entree: '', sortie: '' };
    let detail = '';
    if (p) {
      const L = lundiDe(t);
      const semaines = Array.from({ length: 8 }, (_, k) => R.bilanSemaine(E, p, ajout(L, 7 * k)));
      const affs = E.affectations.filter((a) => a.personne === p.id && a.fin >= t).sort((x, y) => x.debut.localeCompare(y.debut));
      detail = `
      <section class="bloc-detail"><h3>Charge des 8 prochaines semaines</h3>
        <div class="apercu-semaines">${semaines.map((b) => `<button type="button" class="mois-case petit etat-${b.etat}" data-action="aller-semaine" data-lundi="${b.lundi}" title="${esc(`${libSemaine(b.lundi)} : ${h(b.charge)} pour ${h(b.capacite)}`)}"><small>${sem(b.lundi)}</small><b>${b.etat === 'absent' || b.capacite <= 0 ? 'Abs.' : pct(b.taux)}</b></button>`).join('')}</div></section>
      <section class="bloc-detail"><h3>Affectations en cours et à venir <span>${affs.length}</span></h3>
        ${affs.length ? `<ul class="mini-liste">${affs.map((a) => `<li><span>${puceProjet(projet(a.projet), esc(nomPr(a.projet)))} ${h(a.heures)}/sem. · ${plage(a)}</span><button type="button" class="btn petit" data-action="affectation" data-id="${a.id}">Modifier</button></li>`).join('')}</ul>` : '<p class="mention">Aucune affectation à venir.</p>'}
        <div class="rang"><button type="button" class="btn petit" data-action="nouvelle-affectation" data-personne="${p.id}">${ICONES.plus}Affecter</button><button type="button" class="btn petit" data-action="nouvelle-absence" data-personne="${p.id}">${ICONES.plus}Absence</button></div></section>
      <div class="groupe"><h3>Données personnelles</h3><p class="aide">« Exporter » télécharge sa fiche, ses affectations et ses absences (droit d'accès). « Effacer » remplace le prénom et le nom et vide les notes ; les heures restent. « Supprimer » retire la personne, ses affectations et ses absences.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter-personne" data-id="${p.id}">Exporter ses données</button><button class="btn petit" type="button" data-action="effacer-personne" data-id="${p.id}" ${p.efface ? 'disabled' : ''}>Effacer les données</button><button class="btn petit danger" type="button" data-action="supprimer-personne" data-id="${p.id}">Supprimer</button></div></div>`;
    }
    const roles = [...new Set([...E.personnes.map((x) => x.role), ...B.secteurs.flatMap((s) => s.roles)].filter(Boolean))];
    const corps = `
      <div class="rang-champs">
        <label class="champ">Prénom<input name="prenom" maxlength="40" required value="${esc(v.prenom)}" autocomplete="off"></label>
        <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(v.nom)}" autocomplete="off"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Rôle ou poste<input name="role" maxlength="50" value="${esc(v.role)}" list="liste-roles" autocomplete="off"><datalist id="liste-roles">${roles.map((r) => `<option value="${esc(r)}">`).join('')}</datalist></label>
        <label class="champ">Heures par semaine <small>${nombre(E.reglages.capaciteDefaut)} h à temps complet ; moins pour un temps partiel.</small><input name="capacite" inputmode="decimal" value="${nombre(v.capacite)}"></label>
      </div>
      <fieldset class="champ"><legend>Jours travaillés <small>Les heures se répartissent sur ces jours.</small></legend><div class="cases">${JOURS_SEMAINE.map(([k, l]) => `<label class="case"><input type="checkbox" name="jours" value="${k}" ${R.joursDe(v).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Compétences</legend>${E.competences.length ? `<div class="cases">${E.competences.map((c) => `<label class="case"><input type="checkbox" name="competences" value="${c.id}" ${v.competences.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</div>` : '<p class="mention">Aucune compétence : ajoute-les dans l\'onglet Équipe.</p>'}</fieldset>
      <div class="rang-champs">
        <label class="champ">Arrivée <small>Facultative.</small><input type="date" name="entree" value="${v.entree || ''}"></label>
        <label class="champ">Départ <small>Facultatif.</small><input type="date" name="sortie" value="${v.sortie || ''}"></label>
      </div>
      ${detail}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? esc(`${p.prenom} ${p.nom}`) : 'Nouvelle personne', corps, `<button class="btn primaire" value="ok">${p ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>`, (fd) => {
      const prenom = String(fd.get('prenom') || '').trim();
      if (!prenom) return 'Indique au moins un prénom.';
      const cap = R.lireNombre(fd.get('capacite'));
      if (cap === null || cap > 80) return 'Heures par semaine : un nombre entre 0 et 80.';
      const jours = fd.getAll('jours').map(Number);
      if (!jours.length) return 'Coche au moins un jour travaillé.';
      const entree = fd.get('entree'), sortie = fd.get('sortie');
      if (sortie && entree && sortie < entree) return 'Le départ doit suivre l\'arrivée.';
      retenir();
      const n = R.normaliserPersonne({ ...(p || {}), id: p?.id || uid(), prenom, nom: String(fd.get('nom') || '').trim(), role: String(fd.get('role') || '').trim(), capacite: cap, jours, competences: fd.getAll('competences'), entree: entree || null, sortie: sortie || null, efface: p?.efface && prenom === p.prenom });
      if (p) Object.assign(p, n); else E.personnes.push(n);
      sauver(); rendre(); toast(`${prenom} enregistré${p ? '' : ' dans l\'équipe'}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleProjet(id) {
    const t = auj();
    const pr = id ? projet(id) : null;
    const v = pr || { nom: '', type: 'projet', client: '', couleur: E.projets.length % B.couleurs.length, debut: lundiDe(ajout(t, 7)), fin: '', besoin: 0, competences: [], statut: 'actif', note: '' };
    const affs = pr ? E.affectations.filter((a) => a.projet === pr.id && a.fin >= t).sort((x, y) => x.debut.localeCompare(y.debut)) : [];
    const radios = (nom, opts, val, cls = 'deux') => `<div class="choix-statut ${cls}">${opts.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${val === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    const corps = `
      <fieldset class="champ"><legend>Type <small>Un projet a des dates ; un poste à couvrir (accueil, permanence, ligne) dure.</small></legend>${radios('type', [['projet', 'Projet'], ['poste', 'Poste à couvrir']], v.type)}</fieldset>
      <div class="rang-champs">
        <label class="champ">Nom<input name="nom" maxlength="60" required value="${esc(v.nom)}"></label>
        <label class="champ">Client <small>Facultatif.</small><input name="client" maxlength="60" value="${esc(v.client)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Début <small>Facultatif.</small><input type="date" name="debut" value="${v.debut || ''}"></label>
        <label class="champ">Fin <small>Facultative.</small><input type="date" name="fin" value="${v.fin || ''}"></label>
      </div>
      <label class="champ">Besoin en heures par semaine <small>Ce qu'il faut pour tenir le projet ou le poste ; 0 si tu ne veux pas suivre la couverture.</small><input name="besoin" inputmode="decimal" value="${nombre(v.besoin)}"></label>
      <fieldset class="champ"><legend>Compétences demandées <small>Une alerte signale une personne affectée qui n'en a pas une.</small></legend>${E.competences.length ? `<div class="cases">${E.competences.map((c) => `<label class="case"><input type="checkbox" name="competences" value="${c.id}" ${v.competences.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)}</label>`).join('')}</div>` : '<p class="mention">Aucune compétence définie.</p>'}</fieldset>
      <fieldset class="champ"><legend>Statut <small>En pause ou terminé : ses affectations ne comptent plus dans la charge.</small></legend>${radios('statut', R.STATUTS_PROJET.map((s) => [s, R.LIB_STATUT[s]]), v.statut, 'trois')}</fieldset>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${v.couleur === i ? 'checked' : ''}><span style="--c:${c}"></span></label>`).join('')}</div></fieldset>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="200" value="${esc(v.note)}"></label>
      ${pr ? `<section class="bloc-detail"><h3>Affectations en cours et à venir <span>${affs.length}</span></h3>${affs.length ? `<ul class="mini-liste">${affs.map((a) => `<li><span><b>${esc(nomP(a.personne))}</b> ${h(a.heures)}/sem. · ${plage(a)}</span><button type="button" class="btn petit" data-action="affectation" data-id="${a.id}">Modifier</button></li>`).join('')}</ul>` : '<p class="mention">Personne d\'affecté.</p>'}
        <div class="rang"><button type="button" class="btn petit" data-action="nouvelle-affectation" data-projet="${pr.id}">${ICONES.plus}Affecter quelqu'un</button></div></section>` : ''}
      <p class="erreur" role="alert"></p>`;
    const nbAff = pr ? E.affectations.filter((a) => a.projet === pr.id).length : 0;
    ouvrirModale(pr ? 'Projet ou poste' : 'Nouveau projet ou poste', corps, `<button class="btn primaire" value="ok">${pr ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>${pr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${pr.nom} »${nbAff ? ` et ses ${pluriel(nbAff, 'affectation')}` : ''} ? Pour garder l'historique, passe-le plutôt en « Terminé ».`)) { garderOuverte(); return; }
        retenir();
        E.projets = E.projets.filter((x) => x.id !== pr.id);
        E.affectations = E.affectations.filter((a) => a.projet !== pr.id);
        sauver(); rendre(); toast(`« ${pr.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au projet ou au poste.';
      const besoin = R.lireNombre(fd.get('besoin') || '0');
      if (besoin === null) return 'Besoin illisible : écris par exemple 35 ou 17,5.';
      const debut = fd.get('debut') || null, fin = fd.get('fin') || null;
      if (debut && fin && fin < debut) return 'La fin ne peut pas précéder le début.';
      retenir();
      const n = R.normaliserProjet({ ...(pr || {}), id: pr?.id || uid(), nom, type: fd.get('type'), client: String(fd.get('client') || '').trim(), debut, fin, besoin, competences: fd.getAll('competences'), statut: fd.get('statut'), couleur: Number(fd.get('couleur')), note: String(fd.get('note') || '').trim() }, 0, B.couleurs.length);
      if (pr) Object.assign(pr, n); else E.projets.push(n);
      sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCompetence(id) {
    const c = id ? competence(id) : null;
    const n = c ? E.personnes.filter((p) => p.competences.includes(c.id)).length + E.projets.filter((pr) => pr.competences.includes(c.id)).length : 0;
    ouvrirModale(c ? 'Compétence' : 'Nouvelle compétence', `
      <label class="champ">Nom<input name="nom" maxlength="40" required value="${esc(c?.nom || '')}"></label>
      ${c ? `<p class="mention">Utilisée par ${pluriel(n, 'personne ou projet', 'personnes ou projets')}.${n ? ' La supprimer la retire de leurs fiches.' : ''}</p>` : ''}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${c ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${c ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') {
        retenir();
        E.competences = E.competences.filter((x) => x.id !== c.id);
        E.personnes.forEach((p) => { p.competences = p.competences.filter((x) => x !== c.id); });
        E.projets.forEach((p) => { p.competences = p.competences.filter((x) => x !== c.id); });
        if (ds.competence === c.id) ds.competence = '';
        sauver(); rendre(); toast(`Compétence « ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la compétence.';
      if (E.competences.some((x) => x.id !== c?.id && x.nom.toLowerCase() === nom.toLowerCase())) return 'Cette compétence existe déjà.';
      retenir();
      if (c) c.nom = nom; else E.competences.push({ id: uid(), nom });
      sauver(); rendre(); toast(`Compétence « ${nom} » enregistrée.`);
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const an = Number(auj().slice(0, 4));
    const corps = `
      <label class="champ">Ton entreprise<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
      <label class="champ">Ton prénom sur cet appareil <small>Signe tes affectations et absences, pour que les autres managers sachent qui les a saisies. Gardé sur cet appareil.</small><input name="auteur" maxlength="40" value="${esc(auteur())}" autocomplete="given-name"></label>
      <div class="groupe"><h3>Charge</h3>
        <div class="rang-champs">
          <label class="champ">Surcharge au-delà de (%)<input name="seuilSurcharge" inputmode="decimal" value="${nombre(r.seuilSurcharge)}"></label>
          <label class="champ">Disponible en dessous de (%)<input name="seuilDisponible" inputmode="decimal" value="${nombre(r.seuilDisponible)}"></label>
        </div>
        <label class="champ">Heures par semaine d'une nouvelle personne <small>35 h : durée légale à temps complet (art. L3121-27).</small><input name="capaciteDefaut" inputmode="decimal" value="${nombre(r.capaciteDefaut)}"></label>
        <fieldset class="champ"><legend>Jours d'ouverture <small>Servent au besoin hebdomadaire des projets et postes (au prorata, fériés déduits).</small></legend><div class="cases">${JOURS_SEMAINE.map(([k, l]) => `<label class="case"><input type="checkbox" name="ouverture" value="${k}" ${r.joursOuverture.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
      </div>
      <div class="groupe"><h3>Alertes de durée <span class="etiquette jaune">Paramètres datés</span></h3>
        <p class="aide">Relevées le ${dateLongue(r.verifieLe || B.version)}. ${esc(B.sourceRegles)} La charge planifiée n'est pas le temps de travail effectif. 0 pour désactiver.</p>
        <div class="rang-champs">
          <label class="champ">Plafond sur une semaine (h)<small>48 h (art. L3121-20).</small><input name="plafondSemaine" inputmode="decimal" value="${nombre(r.plafondSemaine)}"></label>
          <label class="champ">Moyenne sur 12 semaines (h)<small>44 h (art. L3121-22).</small><input name="plafondMoyen" inputmode="decimal" value="${nombre(r.plafondMoyen)}"></label>
        </div>
        <label class="champ">Règles vérifiées le<input type="date" name="verifieLe" value="${r.verifieLe || ''}"></label>
        <details class="champs-aide"><summary>Repères et sources</summary><ul>${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b> : ${esc(d)}</li>`).join('')}${B.sources.map(([l, u]) => `<li>${esc(l)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details>
      </div>
      <div class="groupe"><h3>Jours fériés chômés</h3><p class="aide">Les 11 fêtes légales (art. L3133-1), dates calculées chaque année. Décoche ceux que l'entreprise travaille ; Alsace-Moselle : coche les deux derniers. Un férié chômé réduit la capacité de la semaine.</p>
        <div class="feries">${R.feries(an).map((f) => `<label class="case"><input type="checkbox" name="ferie" value="${f.id}" ${r.feriesChomes.includes(f.id) ? 'checked' : ''}> ${esc(f.nom)} <small>${dateCourte(f.date)} ${an}</small></label>`).join('')}</div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV) : toutes les affectations, ou la charge et la capacité de chacun sur 12 semaines.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Affectations (CSV)</button><button class="btn petit" type="button" data-action="csv-charge">Charge sur 12 semaines (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Le planning est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="mention">Les managers qui partagent cette clé voient le même planning. Si deux personnes modifient en même temps, leurs changements sont réunis.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le planning est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Tu es responsable des données de ton équipe : garde le minimum, aucune donnée de santé, et efface ou supprime une personne depuis sa fiche quand rien ne t'oblige à conserver ses données.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Modèles d'équipe et repères rédigés pour QME (version ${B.version}). Aucun e-mail envoyé, aucune connexion à un agenda ou à un logiciel de paie. Outil d'aide : la convention collective et le Code du travail font foi.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lire = (nom, mini, maxi) => { const n = R.lireNombre(fd.get(nom)); return n !== null && n >= mini && n <= maxi ? n : null; };
      const v = { seuilSurcharge: lire('seuilSurcharge', 50, 200), seuilDisponible: lire('seuilDisponible', 0, 100), capaciteDefaut: lire('capaciteDefaut', 0, 80), plafondSemaine: lire('plafondSemaine', 0, 80), plafondMoyen: lire('plafondMoyen', 0, 80) };
      if (v.seuilSurcharge === null) return 'Surcharge : un pourcentage entre 50 et 200.';
      if (v.seuilDisponible === null) return 'Disponible : un pourcentage entre 0 et 100.';
      if (Object.values(v).some((x) => x === null)) return 'Une valeur en heures est illisible (entre 0 et 80).';
      const ouverture = fd.getAll('ouverture').map(Number);
      if (!ouverture.length) return 'Coche au moins un jour d\'ouverture.';
      E.entreprise = String(fd.get('entreprise') || '').trim();
      const a = String(fd.get('auteur') || '').trim();
      if (a) stock.ecrire(CLE_AUTEUR, a); else stock.suppr(CLE_AUTEUR);
      E.reglages = R.normaliserReglages({ ...r, ...v, joursOuverture: ouverture, feriesChomes: fd.getAll('ferie'), verifieLe: R.estDate(fd.get('verifieLe')) ? fd.get('verifieLe') : r.verifieLe }, r);
      sauver(); rendre();
      toast('Réglages enregistrés : la charge est recalculée.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.personnes) || !Array.isArray(donnees.affectations)) throw new Error();
        if (!confirm(`Remplacer le planning actuel par cette copie (${pluriel(donnees.personnes.length, 'personne')}, ${pluriel(donnees.affectations.length, 'affectation')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planning.'); }
    });
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function effacerPersonne(id) {
    if (!personne(id) || !confirm(`Effacer les données personnelles de ${nomP(id)} ? Le prénom et le nom sont remplacés, les notes vidées. Les heures restent pour une charge juste.`)) return;
    retenir();
    E = R.effacerPersonne(E, id, E.personnes.filter((x) => x.efface).length + 1);
    sauver(); rendre(); modale().close();
    toast('Données personnelles effacées.', { libelle: 'Annuler', faire: annuler });
  }
  function supprimerPersonne(id) {
    const p = personne(id);
    if (!p) return;
    const n = E.affectations.filter((a) => a.personne === id).length + E.absences.filter((a) => a.personne === id).length;
    if (!confirm(`Supprimer ${nomP(id)}${n ? ` avec ${pluriel(n, 'affectation ou absence', 'affectations et absences')}` : ''} ?`)) return;
    retenir();
    E = R.supprimerPersonne(E, id);
    sauver(); rendre(); modale().close();
    toast(`${p.prenom} supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Ajout à l'écran d'accueil ----------
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
  const fermer = () => { if (modale().open) modale().close(); };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), 'application/json', `planning-equipe-${auj()}.json`); break;
      case 'csv': telecharger(R.affectationsCsv(E), 'text/csv;charset=utf-8', `affectations-${auj()}.csv`); break;
      case 'csv-charge': telecharger(R.chargeCsv(E, lundiDe(auj()), 12), 'text/csv;charset=utf-8', `charge-12-semaines-${auj()}.csv`); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle-affectation': modaleAffectation(null, { personneId: el.dataset.personne, projetId: el.dataset.projet, lundi: el.dataset.lundi }); break;
      case 'affectation': if (id) modaleAffectation(id); break;
      case 'nouvelle-absence': modaleAbsence(null, { personneId: el.dataset.personne }); break;
      case 'absence': modaleAbsence(id); break;
      case 'personne': modalePersonne(id); break;
      case 'nouvelle-personne': fermer(); modalePersonne(null); break;
      case 'projet': modaleProjet(id); break;
      case 'nouveau-projet': fermer(); modaleProjet(null); break;
      case 'competence': modaleCompetence(id); break;
      case 'nouvelle-competence': modaleCompetence(null); break;
      case 'exporter-personne': { const d = R.donneesPersonne(E, id, auj(), B.typesAbsence); if (d) telecharger(JSON.stringify(d, null, 2), 'application/json', `donnees-${slug(nomP(id)) || 'personne'}-${auj()}.json`); break; }
      case 'effacer-personne': effacerPersonne(id); break;
      case 'supprimer-personne': supprimerPersonne(id); break;
      case 'filtre-pr': fp.statut = el.dataset.statut; rendre(); break;
      case 'pl': {
        pl[el.dataset.cle] = el.dataset.val;
        if (el.dataset.cle === 'mode' && pl.mode === 'mois') pl.mois = ajout(pl.lundi || lundiDe(auj()), 3).slice(0, 7);
        if (el.dataset.cle === 'mode' && pl.mode === 'semaine') pl.lundi = pl.mois === auj().slice(0, 7) ? lundiDe(auj()) : lundiDe(ajout(`${pl.mois}-01`, 3));
        rendre(); break;
      }
      case 'pl-pas': { const p = Number(el.dataset.pas); if (pl.mode === 'semaine') pl.lundi = p ? ajout(pl.lundi, 7 * p) : lundiDe(auj()); else pl.mois = p ? R.ajoutMois(`${pl.mois}-01`, p).slice(0, 7) : auj().slice(0, 7); rendre(); break; }
      case 'ds-pas': { const p = Number(el.dataset.pas); ds.lundi = p ? ajout(ds.lundi, 7 * p) : ajout(lundiDe(auj()), 7); rendre(); break; }
      case 'aller-semaine': fermer(); pl.mode = 'semaine'; pl.lundi = el.dataset.lundi; if (el.dataset.groupe) pl.groupe = el.dataset.groupe; changerVue('planning'); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre();
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
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton; session.baseEtat = c.baseEtat ? normaliser(c.baseEtat) : null;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__planningEquipe = { etat: () => E, regles: R };
  init();
})();
