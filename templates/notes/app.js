// Notes et moyennes QME : années, semestres ou trimestres, unités d'enseignement et matières avec coefficients ou
// crédits ECTS, notes avec barème et coefficient propres (contrôles, partiels, oraux), moyennes par matière, UE,
// période et année, validation et crédits selon les règles du diplôme saisies par l'utilisateur (seuil,
// compensation, note éliminatoire, rattrapage, mentions), simulateur de la note nécessaire aux épreuves à venir,
// évolution de la moyenne, relevé imprimable et export CSV.
// Données synchronisées par clé de licence ou code d'accès. Aucun barème officiel d'examen intégré, aucune connexion
// à un espace numérique de travail ou à un logiciel de scolarité : tout se saisit à la main.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.NTS;
  const API = '/api/templates';
  const PRODUIT = 'NTS';
  const CLE_CODE = 'qme-nts-code';
  const CLE_CACHE = 'qme-nts-cache';
  const CLE_DEMO = 'qme-nts-demo';
  const CLE_PREF = 'qme-nts-pref';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-nts-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const N = R.nombreTexte;
  const pluriel = (n, s, p) => `${N(n, 2)} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const auj = () => R.iso(new Date());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateMoy = (d) => (d ? `${R.versDate(d).getDate()} ${MOIS_C[R.versDate(d).getMonth()]}${d.slice(0, 4) !== auj().slice(0, 4) ? ` ${d.slice(0, 4)}` : ''}` : 'sans date');
  const dateCourte = (d) => R.versDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const NOMS_TYPES = Object.fromEntries(B.types.map((t) => [t.code, t.nom]));
  const MAJ = (s) => String(s).replace(/^./, (c) => c.toUpperCase());

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bilan';
  const pref = stock.lire(CLE_PREF) || {};
  const sel = { periode: pref.periode || '', annee: '', evo: pref.evo === 'annee' ? 'annee' : 'periode' };
  const sim = { cible: '', objectif: '', coches: null };
  let annulation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const etatVide = () => ({ ...R.etatVide(B), tutorielVu: false });
  const normaliser = (d) => R.normaliser(d, B);
  const periode = (id) => E.periodes.find((p) => p.id === id);
  const annee = (id) => E.annees.find((a) => a.id === id);
  const matiere = (id) => E.matieres.find((m) => m.id === id);
  const ue = (id) => E.ues.find((u) => u.id === id);
  const sysDe = (p) => R.systeme(E, p, B);
  const couleur = (m) => B.couleurs[(m?.couleur ?? 5) % B.couleurs.length];
  function sauverPref() { stock.ecrire(CLE_PREF, { periode: sel.periode, evo: sel.evo }); }
  // Période affichée : celle choisie si elle existe encore, sinon celle du moment.
  function periodeActive() {
    if (!E.periodes.length) return null;
    if (!periode(sel.periode)) sel.periode = R.periodeCourante(E, auj()) || '';
    return periode(sel.periode);
  }

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
        toast('Un autre appareil a modifié tes notes entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Les données dépassent la taille permise : exporte une copie, puis supprime les années anciennes (Réglages).');
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
  // Code interne (NTS-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Étudiante fictive en licence d'économie-gestion (établissement inventé), deux années à des dates relatives à
  // aujourd'hui : L1 terminée (S1 sous le seuil, rattrapé par la compensation annuelle, une note de rattrapage),
  // L2 avec le S3 terminé et le S4 en cours (notes sur 20, sur 10 et sur 40, un oral, une absence neutralisée,
  // partiels à venir pour le simulateur, une matière sous le seuil). Règles saisies : compensation entre toutes
  // les matières, note éliminatoire 6, rattrapage « meilleure note », crédits ECTS.
  function donneesDemo() {
    const t = auj();
    let graine = 11;
    const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
    const e = etatVide();
    e.reglages = R.normaliserReglages({ identite: { nom: 'Camille Exemple', formation: 'Licence Économie-gestion (exemple)', etablissement: 'Université de démonstration' } }, B);
    const an = (d) => Number(d.slice(0, 4));
    const libelle = (d) => { const a = an(d), m = Number(d.slice(5, 7)); const debut = m >= 8 ? a : a - 1; return `${debut}-${debut + 1}`; };
    const L1 = R.normaliserAnnee({ id: uid(), nom: `L1 · ${libelle(R.ajout(t, -365))}`, ordre: 0, compensation: 'periodes' });
    const L2 = R.normaliserAnnee({ id: uid(), nom: `L2 · ${libelle(t)}`, ordre: 1, compensation: 'periodes' });
    e.annees.push(L1, L2);
    const regles = { systeme: 'sur20', poids: 'credits', mode: 'totale', seuil: 10, objectif: 12, eliminatoire: 6, rattrapage: 'meilleure' };
    const P = (a, nom, ordre, extra = {}) => { const p = R.normaliserPeriode({ id: uid(), annee: a.id, nom, ordre, ...regles, ...extra }, B); e.periodes.push(p); return p; };
    let ordreM = 0, coul = 0;
    const U = (p, nom, credits) => { const u = R.normaliserUe({ id: uid(), periode: p.id, nom, credits: 0, ordre: e.ues.length }); e.ues.push(u); return u; };
    // Matière : épreuves [type, jours depuis aujourd'hui, coef, sur, note sur 20 visée ou null (prévue), intitulé].
    const M = (p, u, nom, credits, epreuves, coef = 1) => {
      const m = R.normaliserMatiere({ id: uid(), periode: p.id, ue: u?.id || '', nom, credits, coef, ordre: ordreM++, couleur: coul++ % 8 });
      e.matieres.push(m);
      for (const [type, j, c, sur, v20, intitule, extra] of epreuves) {
        const n = { id: uid(), matiere: m.id, type, date: R.ajout(t, j), coef: c, sur, intitule: intitule || '' };
        if (v20 === null) n.prevue = true;
        else n.valeur = Math.min(sur, Math.max(0, Math.round((v20 + (alea() - 0.5) * 1.5) * sur / 20 * 2) / 2));
        e.notes.push(R.normaliserNote({ ...n, ...extra }));
      }
      return m;
    };
    // L1 · S1 (moyenne sous 10) et S2 (au-dessus) : la compensation annuelle valide l'année.
    const s1 = P(L1, 'Semestre 1', 0);
    const u11 = U(s1, 'UE1 Économie');
    M(s1, u11, 'Introduction à l\'économie', 6, [['cc', -440, 1, 20, 9.5], ['partiel', -395, 2, 20, 8.5]]);
    M(s1, u11, 'Histoire des faits économiques', 6, [['cc', -430, 1, 20, 11], ['partiel', -393, 2, 20, 10]]);
    const u12 = U(s1, 'UE2 Outils');
    M(s1, u12, 'Mathématiques', 6, [['cc', -435, 1, 20, 7], ['partiel', -394, 2, 20, 6.5], ['rattrapage', -360, 1, 20, 10.5, 'Seconde session']]);
    M(s1, u12, 'Statistiques descriptives', 6, [['cc', -425, 1, 20, 8.5], ['partiel', -392, 2, 20, 9]]);
    const u13 = U(s1, 'UE3 Ouverture');
    M(s1, u13, 'Anglais', 3, [['oral', -420, 1, 20, 13], ['cc', -398, 1, 20, 12]]);
    M(s1, u13, 'Méthodologie universitaire', 3, [['projet', -400, 1, 20, 12.5]]);
    const s2 = P(L1, 'Semestre 2', 1);
    const u21 = U(s2, 'UE1 Économie');
    M(s2, u21, 'Microéconomie 1', 6, [['cc', -320, 1, 20, 12], ['partiel', -245, 2, 20, 11.5]]);
    M(s2, u21, 'Macroéconomie 1', 6, [['cc', -315, 1, 20, 11], ['partiel', -243, 2, 20, 12]]);
    const u22 = U(s2, 'UE2 Outils');
    M(s2, u22, 'Analyse', 6, [['cc', -310, 1, 20, 10.5], ['partiel', -244, 2, 20, 11]]);
    M(s2, u22, 'Comptabilité générale', 6, [['tp', -300, 1, 20, 13.5], ['partiel', -242, 2, 20, 12.5]]);
    const u23 = U(s2, 'UE3 Ouverture');
    M(s2, u23, 'Anglais', 3, [['oral', -290, 1, 20, 14], ['cc', -250, 1, 20, 13]]);
    M(s2, u23, 'Projet personnel', 3, [['projet', -255, 1, 20, 14.5]]);
    // L2 · S3 terminé.
    const s3 = P(L2, 'Semestre 3', 0);
    const u31 = U(s3, 'UE1 Économie');
    M(s3, u31, 'Microéconomie 2', 6, [['cc', -150, 1, 20, 12.5], ['cc', -120, 1, 10, 13], ['partiel', -82, 2, 20, 12]]);
    M(s3, u31, 'Macroéconomie 2', 6, [['cc', -145, 1, 20, 11], ['partiel', -80, 2, 20, 12.5]]);
    const u32 = U(s3, 'UE2 Méthodes quantitatives');
    M(s3, u32, 'Statistiques inférentielles', 5, [['cc', -140, 1, 20, 10], ['partiel', -81, 2, 20, 10.5]]);
    M(s3, u32, 'Mathématiques financières', 4, [['cc', -130, 1, 40, 13], ['partiel', -79, 2, 20, 12]]);
    const u33 = U(s3, 'UE3 Gestion');
    M(s3, u33, 'Comptabilité de gestion', 3, [['tp', -125, 1, 20, 15], ['partiel', -78, 1, 20, 13.5]]);
    M(s3, u33, 'Droit des affaires', 3, [['partiel', -77, 1, 20, 11.5]]);
    const u34 = U(s3, 'UE4 Langues');
    M(s3, u34, 'Anglais', 3, [['oral', -110, 1, 20, 15], ['cc', -85, 1, 20, 14]]);
    // L2 · S4 en cours : notes obtenues, absence neutralisée, partiels à venir.
    const s4 = P(L2, 'Semestre 4', 1);
    const u41 = U(s4, 'UE1 Économie');
    M(s4, u41, 'Économie internationale', 6, [['cc', -38, 1, 20, 11, 'Dossier commerce'], ['cc', -12, 1, 20, 10.5, 'Contrôle 2'], ['partiel', 13, 2, 20, null, 'Partiel']]);
    M(s4, u41, 'Économie monétaire', 6, [['cc', -33, 1, 20, 9, 'Contrôle 1'], ['cc', -9, 1, 20, 8.5, 'Contrôle 2'], ['partiel', 14, 2, 20, null, 'Partiel']]);
    const u42 = U(s4, 'UE2 Méthodes quantitatives');
    M(s4, u42, 'Économétrie', 5, [['tp', -30, 1, 10, 13, 'TP 1'], ['tp', -16, 1, 10, 12, 'TP 2', { valeur: 0, neutre: true }], ['tp', -5, 1, 10, 14, 'TP 3'], ['partiel', 15, 2, 20, null, 'Partiel']]);
    M(s4, u42, 'Probabilités', 4, [['cc', -27, 1, 20, 10, 'Contrôle'], ['partiel', 16, 2, 20, null, 'Partiel']]);
    const u43 = U(s4, 'UE3 Gestion');
    M(s4, u43, 'Contrôle de gestion', 3, [['cc', -24, 1, 20, 12.5, 'Étude de cas'], ['partiel', 20, 1, 20, null, 'Examen']]);
    M(s4, u43, 'Marketing', 3, [['projet', -20, 1, 20, 13, 'Projet de groupe'], ['oral', 6, 1, 20, null, 'Soutenance']]);
    const u44 = U(s4, 'UE4 Langues et projet');
    M(s4, u44, 'Anglais', 2, [['oral', -26, 1, 20, 14, 'Présentation'], ['cc', -7, 1, 20, 13, 'Compréhension']]);
    M(s4, u44, 'Projet professionnel', 1, [['projet', 27, 1, 20, null, 'Rapport']]);
    return normaliser(e);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Notes et moyennes · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="180" width="44" height="80" rx="10" fill="#1D4E89"/>
          <rect x="72" y="130" width="44" height="130" rx="10" fill="#F5B400"/>
          <rect x="124" y="150" width="44" height="110" rx="10" fill="#F0EDE6"/>
          <rect x="176" y="90" width="44" height="170" rx="10" fill="#D9302A"/>
          <rect x="228" y="60" width="44" height="200" rx="10" fill="#1D4E89"/>
          <path d="M20 110 H272" stroke="#141414" stroke-width="6" stroke-dasharray="14 10" stroke-linecap="round"/>
          <rect x="20" y="268" width="252" height="14" rx="7" fill="#141414"/>
          <circle cx="420" cy="110" r="80" fill="#D9302A"/>
          <path d="M330 282 L420 200 L510 282 Z" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Notes et moyennes</p>
          <h1>Ta moyenne, au centième près.</h1>
          <p>Tes matières avec leurs coefficients ou leurs crédits, tes notes, tes moyennes par matière, UE et semestre, les règles de ton diplôme, et la note qu'il te faut au prochain partiel pour atteindre ton objectif.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes notes</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes notes sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes notes</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/notes/">Voir Notes et moyennes</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes notes'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const anneeScolaire = () => { const t = auj(); const a = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)); const d = m >= 8 ? a : a - 1; return `${d}-${d + 1}`; };
  const accueilVide = () => ({ etape: 1, modele: 'licence', nom: anneeScolaire(), systeme: 'sur20', objectif: '' });
  let accueil = accueilVide();

  function ecranAccueil(erreur = '') {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Tes notes, tes moyennes, ton objectif.</h1>
        <p class="intro">Tu recopies ta maquette (semestres, UE, matières, coefficients ou crédits) et tu notes chaque résultat. Les moyennes, les crédits acquis et la note qu'il te faut au prochain partiel se calculent seuls, selon les règles de ton diplôme que tu saisis toi-même.</p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const sys = B.systemes.find((s) => s.code === a.systeme);
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton année en cours</h1>
        <p class="intro">Choisis la forme la plus proche : tout se modifie ensuite (noms, coefficients, crédits, règles).</p>
        <div class="form-accueil">
          <fieldset class="cadre-champs"><legend>Ta formation</legend>
            <div class="choix-modeles">${B.modeles.map((m) => `<label><input type="radio" name="a-modele" value="${m.code}" ${m.code === a.modele ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.aide)}</small></span></label>`).join('')}</div>
          </fieldset>
          <div class="rang-champs">
            <label class="champ">Nom de l'année<input id="a-nom" value="${esc(a.nom)}" maxlength="60" placeholder="par exemple L2 · ${anneeScolaire()}"></label>
            <label class="champ">Notation<select id="a-systeme">${B.systemes.map((s) => `<option value="${s.code}" ${s.code === a.systeme ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
            <label class="champ">Moyenne visée <small>sur ${N(sys.max)}</small><input id="a-objectif" inputmode="decimal" value="${esc(a.objectif)}" placeholder="${N(sys.objectif)}" maxlength="6"></label>
          </div>
          <p class="aide">Seuil de validation proposé : ${N(sys.seuil)} sur ${N(sys.max)}. Compensation, note éliminatoire, rattrapage et mentions se règlent ensuite par période (Notes &gt; Règles), d'après ton règlement des études.</p>
          <p class="erreur" role="alert">${esc(erreur)}</p>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Commencer</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#a-nom')?.addEventListener('input', (e) => { accueil.nom = e.target.value; });
    $('#a-objectif')?.addEventListener('input', (e) => { accueil.objectif = e.target.value; });
    $('#a-systeme')?.addEventListener('change', (e) => { accueil.systeme = e.target.value; ecranAccueil(); });
    document.querySelectorAll('[name=a-modele]').forEach((r) => r.addEventListener('change', (e) => { accueil.modele = e.target.value; }));
  }

  const lireNombre = (v) => { const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'); return s === '' ? '' : /^\d+(\.\d+)?$/.test(s) ? Number(s) : null; };

  // Crée une année et ses périodes d'après un modèle.
  function creerAnnee(e, nom, modele, systeme, objectif) {
    const m = B.modeles.find((x) => x.code === modele) || B.modeles[0];
    const a = R.normaliserAnnee({ id: uid(), nom, ordre: Math.max(-1, ...e.annees.map((x) => x.ordre)) + 1, compensation: 'aucune' });
    const periodes = m.periodes.map((n, i) => R.normaliserPeriode({ id: uid(), annee: a.id, nom: n, ordre: i, systeme, poids: m.poids, mode: m.mode, objectif: objectif === '' ? undefined : objectif }, B));
    return { etat: { ...e, annees: e.annees.concat([a]), periodes: e.periodes.concat(periodes) }, annee: a, periodes };
  }

  function terminerAccueil() {
    const a = accueil;
    const sys = B.systemes.find((s) => s.code === a.systeme);
    const obj = lireNombre(a.objectif);
    if (obj === null || (obj !== '' && obj > sys.max)) return ecranAccueil(`La moyenne visée est un nombre entre 0 et ${N(sys.max)}.`);
    const r = creerAnnee(etatVide(), a.nom.trim() || anneeScolaire(), a.modele, a.systeme, obj);
    E = r.etat;
    sel.periode = r.periodes[0].id;
    accueil = accueilVide();
    vue = 'notes';
    sauver();
    demarrer();
    toast('Ton année est prête : ajoute tes matières (et tes UE) avec leurs coefficients ou crédits.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="currentColor"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor"/></svg>',
    simulateur: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    evolution: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9 11l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21" cy="6" r="2.5" fill="currentColor"/></svg>',
    releve: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2h10l4 4v16H5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="8" y="10" width="8" height="2" fill="currentColor"/><rect x="8" y="14" width="8" height="2" fill="currentColor"/><path d="M5 2h6v6H5Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bilan', 'Bilan'], ['notes', 'Notes'], ['simulateur', 'Objectifs'], ['evolution', 'Évolution'], ['releve', 'Relevé']];
  const AVERTISSEMENT = '<p class="mention avertissement">Moyennes, crédits et résultats calculés sur cet appareil à partir de ce que tu saisis : coefficients, crédits et règles (seuil, compensation, note éliminatoire, rattrapage, mentions) sont ceux que tu as entrés, pas un barème officiel. Seul le relevé de ton établissement fait foi.</p>';
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="52" width="20" height="36" rx="6" fill="#1D4E89"/><rect x="26" y="32" width="20" height="56" rx="6" fill="#F5B400"/><circle cx="72" cy="36" r="22" fill="#D9302A"/><rect x="0" y="88" width="96" height="8" rx="4" fill="#141414"/></svg>';
  const videEtat = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${petit ? '' : FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ST_ETIQ = { acquise: ['vert', 'Acquise'], compensee: ['ciel', 'Compensée'], non: ['rose', 'Non acquise'], attente: ['sable', 'En attente'], validee: ['vert', 'Validée'] };
  const etiquette = (statut, prov = false) => { const [c, t] = ST_ETIQ[statut] || ['sable', '–']; return `<span class="etiquette ${c}">${statut === 'non' && prov ? 'Pas encore' : t}${prov && statut !== 'attente' && statut !== 'non' ? ' (provisoire)' : ''}</span>`; };
  const pastilleMat = (m) => { const c = couleur(m); return `<span class="pastille-genre" style="--f:${c.fond};--b:${c.bord};--t:${c.texte}">${esc(m.nom)}</span>`; };
  const noteBrute = (n) => (n.prevue ? 'prévue' : n.lettre ? n.lettre : `${N(n.valeur, 2)}/${N(n.sur, 2)}`);
  const poidsTexte = (p, x) => [x.coef ? `coef. ${N(x.coef, 2)}` : '', x.credits ? `${N(x.credits, 1)} ECTS` : ''].filter(Boolean).join(' · ') || (p.poids === 'credits' ? 'sans crédits' : 'sans coefficient');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/notes/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Étudiante fictive, notes inventées, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Notes<br>et moyennes</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Notes et moyennes`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { bilan: vueBilan, notes: vueNotes, simulateur: vueSimulateur, evolution: vueEvolution, releve: vueReleve }[vue]();
    brancherVue();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  function brancherVue() {
    $('#choix-periode')?.addEventListener('change', (e) => { sel.periode = e.target.value; sim.cible = ''; sim.objectif = ''; sim.coches = null; sauverPref(); rendre(); });
    $('#choix-annee')?.addEventListener('change', (e) => { sel.annee = e.target.value; rendre(); });
    $('#choix-evo')?.addEventListener('change', (e) => { sel.evo = e.target.value; sauverPref(); rendre(); });
    $('#sim-cible')?.addEventListener('change', (e) => { sim.cible = e.target.value; sim.objectif = ''; sim.coches = null; rendre(); });
    $('#sim-objectif')?.addEventListener('input', (e) => { sim.objectif = e.target.value; majSimulation(); });
    document.querySelectorAll('[name=sim-coche]').forEach((c) => c.addEventListener('change', () => { sim.coches = [...document.querySelectorAll('[name=sim-coche]:checked')].map((x) => x.value); majSimulation(); }));
    brancherInfobulles();
  }

  // Sélecteur de période, groupé par année.
  function choixPeriode() {
    const p = periodeActive();
    return `<label class="champ choix-annee"><span class="sr-only">Période</span><select id="choix-periode">${R.anneesTriees(E).map((a) => `<optgroup label="${esc(a.nom)}">${R.periodesDe(E, a.id).map((x) => `<option value="${x.id}" ${x.id === p?.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  }
  const sansPeriode = (titre) => `<div class="vue-tete"><div><p class="surtitre">Notes et moyennes</p><h1>${titre}</h1></div></div>${videEtat('Aucune année', 'Crée ton année en cours avec ses semestres ou trimestres, puis ajoute tes matières.', '<button class="btn primaire" data-action="annee">Créer une année</button>')}${AVERTISSEMENT}`;

  // ---------- Graphiques ----------
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
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, re.left - rf.left - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
        const reperes = fig.querySelector('.reperes-x');
        if (reperes && el.dataset.x) { reperes.setAttribute('x1', el.dataset.x); reperes.setAttribute('x2', el.dataset.x); reperes.style.visibility = 'visible'; }
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); const r = fig.querySelector('.reperes-x'); if (r) r.style.visibility = 'hidden'; };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // Courbe de la moyenne (une série, bleu) dans le temps, avec deux repères horizontaux nommés directement :
  // l'objectif (tirets rouges) et le seuil de validation (tirets gris). Infobulle et ligne verticale au survol,
  // au toucher ou au clavier ; tableau pour les lecteurs d'écran. Le viewBox suit la largeur de l'écran.
  function courbe(points, { sys, objectif, seuil, titre }) {
    const tel = estTel();
    const W = tel ? 360 : 820, H = tel ? 240 : 280, G = tel ? 30 : 42, D = tel ? 22 : 30, Hh = 22, Bb = 28;
    const vals = points.map((p) => R.valeur(p.moy, sys));
    const bas = Math.max(0, Math.floor(Math.min(...vals, seuil, objectif ?? seuil) - 1));
    const haut = Math.min(sys.max, Math.ceil(Math.max(...vals, objectif ?? 0, seuil) + 1));
    const t0 = R.versDate(points[0].date).getTime(), t1 = R.versDate(points.at(-1).date).getTime();
    const X = (d) => (t1 === t0 ? (G + W - D) / 2 : G + (R.versDate(d).getTime() - t0) / (t1 - t0) * (W - D - G));
    const Y = (v) => Hh + (haut - v) / (haut - bas || 1) * (H - Hh - Bb);
    const pas = (haut - bas) > 8 ? 2 : 1;
    const graduations = [];
    for (let v = Math.ceil(bas / pas) * pas; v <= haut; v += pas) graduations.push(v);
    const chemin = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(vals[i]).toFixed(1)}`).join(' ');
    // Étiquettes de dates : premier, dernier, et quelques intermédiaires sans chevauchement (comptées depuis la fin).
    const etiquettes = [];
    let dernierX = Infinity;
    for (let i = points.length - 1; i >= 0; i--) { const x = X(points[i].date); if (dernierX - x >= (tel ? 64 : 90) || i === points.length - 1) { etiquettes.push(i); dernierX = x; } }
    const repere = (v, cls, texte) => (v === null || v === undefined || v < bas || v > haut ? '' : `<line class="${cls}" x1="${G}" x2="${W - D}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><title>${texte}</title>`);
    const derniere = points.length - 1;
    // Valeur finale au-dessus du dernier point, ou en dessous si un repère passe juste là.
    const yHaut = Y(vals[derniere]) - 12;
    const gene = [objectif, seuil].some((v) => v !== null && v !== undefined && Math.abs(Y(v) - (yHaut - 4)) < 12);
    const yFin = gene ? Y(vals[derniere]) + 22 : yHaut;
    const largeurZone = (i) => { const g = i ? (X(points[i].date) - X(points[i - 1].date)) / 2 : 12; const d = i < derniere ? (X(points[i + 1].date) - X(points[i].date)) / 2 : 12; return [X(points[i].date) - g, g + d]; };
    const info = (p, i) => `<b>${noteTexte(p.moy, sys)}</b>Moyenne au ${esc(dateMoy(p.date))}<br>${p.notes.map((n) => `${esc(matiere(n.matiere)?.nom || '')} : ${esc(noteBrute(n))}`).slice(0, 4).join('<br>')}${p.notes.length > 4 ? `<br>et ${p.notes.length - 4} autre${p.notes.length > 5 ? 's' : ''}` : ''}`;
    return `<figure class="graphique courbe">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titre)}">
        ${graduations.map((v) => `<line class="grille" x1="${G}" x2="${W - D}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="axe" x="${G - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${N(v)}</text>`).join('')}
        ${repere(seuil, 'rep-seuil', `Seuil ${N(seuil, 2)}`)}
        ${repere(objectif, 'rep-objectif', `Objectif ${N(objectif, 2)}`)}
        <line class="reperes-x" x1="0" x2="0" y1="${Hh}" y2="${H - Bb}" style="visibility:hidden"/>
        <path class="trace" d="${chemin}"/>
        ${points.map((p, i) => `<circle class="point" cx="${X(p.date).toFixed(1)}" cy="${Y(vals[i]).toFixed(1)}" r="${i === derniere ? 5 : 4}"/>`).join('')}
        <text class="val-fin" x="${(X(points[derniere].date) + 6).toFixed(1)}" y="${yFin.toFixed(1)}" text-anchor="end">${noteTexte(points[derniere].moy, sys)}</text>
        ${etiquettes.map((i) => `<text class="axe" x="${X(points[i].date).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(dateMoy(points[i].date).replace(/ \d{4}$/, ''))}</text>`).join('')}
        ${points.map((p, i) => { const [x, l] = largeurZone(i); return `<rect class="zone" x="${x.toFixed(1)}" y="${Hh}" width="${Math.max(10, l).toFixed(1)}" height="${H - Hh - Bb}" tabindex="0" data-x="${X(p.date).toFixed(1)}" data-info="${esc(info(p, i))}"><title>${esc(dateMoy(p.date))}</title></rect>`; }).join('')}
      </svg>
      <p class="legende"><span class="lg-ligne"></span>Moyenne <span class="lg-objectif"></span>Objectif ${N(objectif, 2)} <span class="lg-seuil"></span>Seuil ${N(seuil, 2)}</p>
      <div class="infobulle" hidden></div>
      <div class="sr-only"><table><caption>${esc(titre)}</caption><thead><tr><th>Date</th><th>Moyenne</th></tr></thead><tbody>${points.map((p) => `<tr><th>${esc(dateMoy(p.date))}</th><td>${noteTexte(p.moy, sys)}</td></tr>`).join('')}</tbody></table></div>
    </figure>`;
  }
  const noteTexte = (f, sys) => R.noteTexte(f, sys);

  // Barres des moyennes par matière (une série), repère du seuil, valeur et statut écrits à droite.
  function barresMatieres(b, avecStatut = true) {
    const lignes = b.ues.flatMap((u) => u.matieres).concat(b.libres);
    if (!lignes.length) return '';
    const max = b.sys.max;
    const pSeuil = b.p.seuil / max * 100;
    return `<figure class="graphique"><div class="barres-cats barres-moy">${lignes.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${noteTexte(x.moy, b.sys)}</b>${esc(x.m.nom)} · ${esc(poidsTexte(b.p, x.m))}${x.prevues ? `<br>${pluriel(x.prevues, 'épreuve prévue', 'épreuves prévues')}` : ''}${x.eliminatoire ? '<br>Sous la note éliminatoire' : ''}`)}">
        <span class="bc-nom">${pastilleMat(x.m)}</span>
        <span class="bc-piste"><span class="bc-barre ${x.moy !== null && !x.ok ? 'sous' : ''}" style="width:${x.moy === null ? 0 : Math.max(1, x.moy * 100)}%"></span><span class="bc-seuil" style="left:${pSeuil}%"></span></span>
        <span class="bc-val"><b>${noteTexte(x.moy, b.sys)}</b>${avecStatut ? etiquette(x.statut, x.prevues > 0) : ''}</span></div>`).join('')}</div>
      <p class="legende"><span class="lg-barre"></span>Moyenne de la matière <span class="lg-trait"></span>Seuil ${N(b.p.seuil, 2)}</p>
      <div class="infobulle" hidden></div>
      <div class="sr-only"><table><caption>Moyennes par matière, ${esc(b.p.nom)}</caption><tbody>${lignes.map((x) => `<tr><th>${esc(x.m.nom)}</th><td>${noteTexte(x.moy, b.sys)}</td><td>${ST_ETIQ[x.statut]?.[1] || ''}</td></tr>`).join('')}</tbody></table></div></figure>`;
  }

  // ---------- Bilan ----------
  const ecartTexte = (moy, objectif, sys) => {
    if (moy === null || objectif === null) return '';
    const d = R.arrondi(R.valeur(moy, sys) - objectif);
    return d >= 0 ? `${N(d, 2, true)} au-dessus de l'objectif` : `il manque ${N(-d, 2, true)}`;
  };
  function resultatTexte(r, sys, notes, objectif, nomCible) {
    if (r.statut === 'aucune') return `<p>Aucune épreuve prévue : ajoute tes prochains partiels sans note pour savoir ce qu'il te faut.</p>`;
    if (r.statut === 'acquis') return `<p class="resultat ok"><b>Objectif assuré</b> : même avec 0 ${notes.length > 1 ? 'à chaque épreuve' : 'à cette épreuve'}, ${nomCible} resterait à ${noteTexte(r.min, sys)}.</p>`;
    if (r.statut === 'impossible') return `<p class="resultat ko"><b>Hors de portée</b> : avec la note maximale ${notes.length > 1 ? 'à chaque épreuve' : 'à cette épreuve'}, ${nomCible} monterait au mieux à ${noteTexte(r.max, sys)} (objectif ${N(objectif, 2)}).</p>`;
    const surs = [...new Set(notes.map((n) => n.sur))];
    const lettres = sys.code === 'lettres';
    const valeurTxt = lettres ? `${N(R.noteAViser(r.frac, sys.max), 2, true)} points (${R.lettreDe(R.noteAViser(r.frac, sys.max), sys.lettres)})` : surs.map((s) => `<b>${N(R.noteAViser(r.frac, s), 2, true)}</b>/${N(s, 2)}`).join(' ou ');
    return `<p class="resultat"><span class="gros">${lettres ? `<b>${valeurTxt}</b>` : valeurTxt}</span> ${notes.length > 1 ? `à chaque épreuve cochée (${N(notes.length)})` : 'à cette épreuve'}, pour atteindre ${N(objectif, 2)} de moyenne.</p>`;
  }

  function vueBilan() {
    const p = periodeActive();
    if (!p) return sansPeriode('Bilan');
    const a = annee(p.annee);
    const b = R.bilanPeriode(E, p, B);
    const sys = b.sys;
    const t = auj();
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(a.nom)}</p><h1>${esc(p.nom)}</h1></div><div class="actions">${choixPeriode()}<button class="btn primaire" data-action="note">${ICONES.plus}Note</button></div></div>`;
    if (!R.matieresDe(E, p.id).length) return `${tete}${videEtat('Aucune matière dans cette période', 'Recopie ta maquette : tes UE, puis tes matières avec leurs coefficients ou leurs crédits ECTS. Les moyennes se calculent dès la première note.', '<button class="btn primaire" data-action="matiere">Ajouter une matière</button><button class="btn" data-action="ue">Ajouter une UE</button>')}${AVERTISSEMENT}`;
    const prevues = R.prevuesCible(E, { type: 'periode', id: p.id });
    const r = R.noteNecessaire(E, { type: 'periode', id: p.id }, prevues.map((n) => n.id), p.objectif, sys);
    const prochaine = prevues.find((n) => n.date && n.date >= t);
    const ba = R.bilanAnnee(E, a, B);
    const bp = ba.periodes.find((x) => x.p.id === p.id) || b;
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Moyenne${b.provisoire ? ' provisoire' : ''}</p><b>${noteTexte(b.moy, sys)}<small>/${N(sys.max)}</small></b><span>${bp.statut === 'validee' ? `${b.provisoire ? 'Au-dessus du seuil pour l\'instant' : 'Période validée'}${bp.mention ? ` · mention ${esc(bp.mention)}` : ''}` : bp.statut === 'compensee' ? 'Validée par compensation annuelle' : bp.statut === 'non' ? (b.provisoire ? `Sous le seuil de ${N(p.seuil, 2)} pour l'instant` : 'Non validée') : 'Pas encore de note'}</span></div>
      <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Objectif</p><b>${N(p.objectif, 2)}</b><span>${b.moy === null ? 'à atteindre' : ecartTexte(b.moy, p.objectif, sys)}</span></div>
      <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Crédits</p><b>${bp.creditsTotal ? `${N(bp.creditsAcquis, 1)} / ${N(bp.creditsTotal, 1)}` : '–'}</b><span>${bp.creditsTotal ? `ECTS acquis${b.provisoire ? ' à ce stade' : ''}` : 'aucun crédit saisi'}</span></div>
      <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Prochaine épreuve</p><b>${prochaine ? esc(dateMoy(prochaine.date)) : '–'}</b><span>${prochaine ? `${esc(matiere(prochaine.matiere)?.nom || '')} · ${esc(prochaine.intitule || NOMS_TYPES[prochaine.type])}` : 'aucune épreuve prévue datée'}</span></div>
    </div>`;
    const objectifBloc = `<section class="bloc-objectif bloc-simu">
      <div class="bo-tete"><h2>Pour ${N(p.objectif, 2)} de moyenne au ${esc(p.nom.toLowerCase())}</h2>${prevues.length ? `<span class="etiquette sable">${pluriel(prevues.length, 'épreuve prévue', 'épreuves prévues')}</span>` : ''}</div>
      ${resultatTexte(r, sys, prevues, p.objectif, 'la moyenne')}
      <div class="rang"><button class="btn petit" data-action="vue" data-vue="simulateur">Simuler en détail</button><button class="btn petit" data-action="note" data-prevue="1">${ICONES.plus}Épreuve prévue</button></div>
    </section>`;
    const toutes = b.ues.flatMap((u) => u.matieres).concat(b.libres);
    const alertes = [
      ...toutes.filter((x) => x.eliminatoire).map((x) => `<li class="alerte-rouge">${pastilleMat(x.m)} <span><b>${noteTexte(x.moy, sys)}</b> : sous la note éliminatoire (${N(p.eliminatoire, 2)}), elle bloque la compensation.</span></li>`),
      ...toutes.filter((x) => !x.eliminatoire && x.moy !== null && !x.ok).map((x) => `<li>${pastilleMat(x.m)} <span><b>${noteTexte(x.moy, sys)}</b> : sous le seuil de ${N(p.seuil, 2)}${x.statut === 'compensee' ? ', compensée par les autres matières' : x.prevues ? `, ${pluriel(x.prevues, 'épreuve')} encore à venir` : ''}.</span></li>`),
      ...toutes.filter((x) => x.moy === null).map((x) => `<li>${pastilleMat(x.m)} <span>Pas encore de note${x.prevues ? ` (${pluriel(x.prevues, 'épreuve prévue', 'épreuves prévues')})` : ''}.</span></li>`),
    ];
    const blocAlertes = alertes.length ? `<h2 class="titre-section">À surveiller <span>${pluriel(alertes.length, 'matière')}</span></h2><ul class="alertes-matieres">${alertes.join('')}</ul>` : '';
    const ues = b.ues.length ? `<h2 class="titre-section">Unités d'enseignement</h2><div class="defile"><table class="tableau"><thead><tr><th>UE</th><th class="nb tel-masque">Poids</th><th class="nb">Moyenne</th><th>Résultat</th><th class="nb">Crédits</th></tr></thead><tbody>${bp.ues.map((u) => `<tr><td>${esc(u.u.nom)}</td><td class="nb tel-masque">${N(R.poidsUe(E, p, u.u), 2)}${p.poids === 'credits' ? ' ECTS' : ''}</td><td class="nb"><b>${noteTexte(u.moy, sys)}</b></td><td>${etiquette(u.statut, b.provisoire)}</td><td class="nb">${N(u.acquis, 1)} / ${N(u.credits, 1)}</td></tr>`).join('')}</tbody></table></div>` : '';
    return `${tete}${tuiles}${objectifBloc}${blocAlertes}
      <h2 class="titre-section">Moyennes par matière <span>${pluriel(toutes.length, 'matière')}</span></h2>${barresMatieres(bp)}${ues}${AVERTISSEMENT}`;
  }

  // ---------- Notes ----------
  function carteMatiere(p, x, sys) {
    const m = x.m;
    const ns = R.notesDe(E, m.id);
    return `<article class="carte-matiere" style="--b:${couleur(m).bord}">
      <div class="cm-tete"><button type="button" class="lien-ligne" data-action="matiere" data-id="${m.id}"><b>${esc(m.nom)}</b><span>${esc(poidsTexte(p, m))}</span></button>
        <span class="cm-moy"><b>${noteTexte(x.moy, sys)}</b>${etiquette(x.statut, x.prevues > 0)}</span></div>
      ${ns.length ? `<ul class="puces-notes">${ns.map((n) => `<li><button type="button" class="puce-note ${n.prevue ? 'prevue' : ''} ${n.neutre ? 'neutre' : ''}" data-action="note-modif" data-id="${n.id}" title="${esc([n.intitule || NOMS_TYPES[n.type], n.date ? dateMoy(n.date) : '', `coef. ${N(n.coef, 2)}`].filter(Boolean).join(' · '))}"><b>${esc(noteBrute(n))}</b><span>${esc(n.intitule || NOMS_TYPES[n.type])}${n.coef !== 1 ? ` · ×${N(n.coef, 2)}` : ''}</span><small>${n.neutre ? 'neutralisée' : esc(dateMoy(n.date))}</small></button></li>`).join('')}</ul>` : '<p class="mention">Aucune note : ajoute la première, ou une épreuve prévue.</p>'}
      <div class="rang"><button class="btn petit primaire" data-action="note" data-matiere="${m.id}">${ICONES.plus}Note</button><button class="btn petit" data-action="note" data-matiere="${m.id}" data-prevue="1">${ICONES.plus}Prévue</button></div>
    </article>`;
  }
  function vueNotes() {
    const p = periodeActive();
    if (!p) return sansPeriode('Notes');
    const a = annee(p.annee);
    const b = R.bilanPeriode(E, p, B);
    const sys = b.sys;
    const regle = B.modes.find((x) => x.code === p.mode);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(a.nom)} · ${esc(sys.nom)}</p><h1>Notes · ${esc(p.nom)}</h1></div><div class="actions">${choixPeriode()}<button class="btn" data-action="periode" data-id="${p.id}">Règles</button><button class="btn" data-action="ue">${ICONES.plus}UE</button><button class="btn primaire" data-action="matiere">${ICONES.plus}Matière</button></div></div>`;
    const resume = `<p class="resume-liste">Moyenne <b>${noteTexte(b.moy, sys)}</b> · seuil ${N(p.seuil, 2)} · ${esc(regle?.nom || '')}${p.eliminatoire !== null ? ` · éliminatoire sous ${N(p.eliminatoire, 2)}` : ''} · pondération par ${p.poids === 'credits' ? 'crédits' : 'coefficients'}.</p>`;
    if (!R.matieresDe(E, p.id).length) return `${tete}${resume}${videEtat('Aucune matière', 'Ajoute tes UE (facultatives : un lycée n\'en a pas), puis tes matières avec leur coefficient ou leurs crédits. Ensuite, chaque note se saisit en deux secondes.', '<button class="btn primaire" data-action="matiere">Ajouter une matière</button><button class="btn" data-action="ue">Ajouter une UE</button><button class="btn" data-action="copier">Reprendre une autre période</button>')}${AVERTISSEMENT}`;
    const groupes = b.ues.map((u) => `<section class="groupe-cat"><h2 class="titre-cat"><button type="button" class="lien-ligne" data-action="ue" data-id="${u.u.id}"><b>${esc(u.u.nom)}</b></button> <span>${N(R.poidsUe(E, p, u.u), 2)} ${p.poids === 'credits' ? 'ECTS' : 'de coef.'} · moyenne ${noteTexte(u.moy, sys)}</span> ${etiquette(u.statut, b.provisoire)}<button class="btn petit" data-action="matiere" data-ue="${u.u.id}">${ICONES.plus}Matière</button></h2>
      ${u.matieres.length ? `<div class="cartes-matieres">${u.matieres.map((x) => carteMatiere(p, x, sys)).join('')}</div>` : '<p class="mention">Aucune matière dans cette UE.</p>'}</section>`).join('');
    const libres = b.libres.length ? `<section class="groupe-cat">${b.ues.length ? '<h2 class="titre-cat">Hors UE</h2>' : ''}<div class="cartes-matieres">${b.libres.map((x) => carteMatiere(p, x, sys)).join('')}</div></section>` : '';
    return `${tete}${resume}${groupes}${libres}<p style="margin-top:18px" class="rang"><button class="btn" data-action="csv-notes">Exporter les notes (CSV)</button><button class="btn" data-action="annee">Nouvelle année</button></p>${AVERTISSEMENT}`;
  }

  // ---------- Simulateur (Objectifs) ----------
  function ciblesPossibles(p) {
    const a = annee(p.annee);
    const l = [[`periode:${p.id}`, `${p.nom} (moyenne de la période)`], [`annee:${a.id}`, `${a.nom} (moyenne de l'année)`]];
    for (const u of R.uesDe(E, p.id)) l.push([`ue:${u.id}`, `UE · ${u.nom}`]);
    for (const m of R.matieresDe(E, p.id)) l.push([`matiere:${m.id}`, `Matière · ${m.nom}`]);
    return l;
  }
  const lireCible = (v) => { const [type, id] = String(v).split(':'); return { type, id }; };
  function etatSimulation() {
    const p = periodeActive();
    const possibles = ciblesPossibles(p);
    if (!possibles.some(([v]) => v === sim.cible)) sim.cible = possibles[0][0];
    const cible = lireCible(sim.cible);
    const sys = cible.type === 'annee' ? sysDe(R.periodesDe(E, cible.id)[0] || p) : sysDe(p);
    const defaut = cible.type === 'annee' ? (R.periodesDe(E, cible.id)[0] || p).objectif : p.objectif;
    const o = lireNombre(sim.objectif);
    const objectif = o === '' || o === null ? defaut : Math.min(sys.max, o);
    const prevues = R.prevuesCible(E, cible);
    const ids = sim.coches ? prevues.filter((n) => sim.coches.includes(n.id)).map((n) => n.id) : prevues.map((n) => n.id);
    return { p, cible, sys, objectif, defaut, prevues, ids, possibles, nom: possibles.find(([v]) => v === sim.cible)[1] };
  }
  function blocResultat(s) {
    const actuelle = R.moyenneCible(E, s.cible);
    const r = R.noteNecessaire(E, s.cible, s.ids, s.objectif, s.sys);
    const notes = s.prevues.filter((n) => s.ids.includes(n.id));
    const nomCible = s.cible.type === 'matiere' ? 'la moyenne de la matière' : s.cible.type === 'ue' ? 'la moyenne de l\'UE' : s.cible.type === 'annee' ? 'la moyenne de l\'année' : 'la moyenne';
    // Scénarios : même note à chaque épreuve cochée.
    const pas = [0.4, 0.5, 0.6, 0.7, 0.8];
    const scen = s.ids.length ? `<h3 class="titre-cat">Et si tu avais… <span>la même note à chaque épreuve cochée</span></h3><div class="defile"><table class="tableau petit"><thead><tr><th>Note obtenue</th>${pas.map((f) => `<th class="nb">${s.sys.code === 'lettres' ? R.lettreDe(f * s.sys.max, s.sys.lettres) : N(f * s.sys.max, 2)}</th>`).join('')}</tr></thead><tbody><tr><th>${esc(MAJ(nomCible))}</th>${pas.map((f) => { const v = R.simuler(E, s.cible, s.ids, f); return `<td class="nb ${v !== null && R.valeur(v, s.sys) + 1e-9 >= s.objectif ? 'ok' : ''}">${noteTexte(v, s.sys)}</td>`; }).join('')}</tr></tbody></table></div>` : '';
    return `<p class="mention">Aujourd'hui : ${esc(nomCible)} est à <b>${noteTexte(actuelle, s.sys)}</b>${actuelle !== null ? ` (${ecartTexte(actuelle, s.objectif, s.sys)})` : ''}.</p>${resultatTexte(r, s.sys, notes, s.objectif, nomCible)}${scen}`;
  }
  function majSimulation() { const s = etatSimulation(); const el = $('#sim-resultat'); if (el) el.innerHTML = blocResultat(s); }

  function vueSimulateur() {
    const p = periodeActive();
    if (!p) return sansPeriode('Objectifs');
    const s = etatSimulation();
    const tete = `<div class="vue-tete"><div><p class="surtitre">Simulateur</p><h1>Quelle note te faut-il ?</h1></div><div class="actions">${choixPeriode()}</div></div>`;
    if (!R.matieresDe(E, p.id).length) return `${tete}${videEtat('Aucune matière', 'Ajoute tes matières et tes épreuves à venir pour simuler.', '<button class="btn primaire" data-action="matiere">Ajouter une matière</button>')}${AVERTISSEMENT}`;
    const form = `<section class="bloc-objectif bloc-simu">
      <div class="rang-champs">
        <label class="champ">Ce que tu vises<select id="sim-cible">${s.possibles.map(([v, n]) => `<option value="${v}" ${v === sim.cible ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="champ">Moyenne visée <small>sur ${N(s.sys.max)}</small><input id="sim-objectif" inputmode="decimal" value="${esc(sim.objectif)}" placeholder="${N(s.defaut, 2)}" maxlength="6"></label>
      </div>
      <fieldset class="champ"><legend>Épreuves à venir prises en compte</legend>
        ${s.prevues.length ? `<ul class="cases-epreuves">${s.prevues.map((n) => { const m = matiere(n.matiere); return `<li><label class="case"><input type="checkbox" name="sim-coche" value="${n.id}" ${s.ids.includes(n.id) ? 'checked' : ''}> <span>${pastilleMat(m)} <b>${esc(n.intitule || NOMS_TYPES[n.type])}</b> <span class="mention">${esc(dateMoy(n.date))} · sur ${N(n.sur, 2)} · coef. ${N(n.coef, 2)}</span></span></label></li>`; }).join('')}</ul>` : '<p class="mention">Aucune épreuve prévue ici.</p>'}
        <p style="margin-top:8px"><button type="button" class="btn petit" data-action="note" data-prevue="1" ${s.cible.type === 'matiere' ? `data-matiere="${s.cible.id}"` : ''}>${ICONES.plus}Ajouter une épreuve prévue</button></p>
      </fieldset>
      <div id="sim-resultat" aria-live="polite">${blocResultat(s)}</div>
    </section>`;
    // Par matière : note à viser aux épreuves prévues de chaque matière pour qu'elle atteigne l'objectif de la période.
    const lignes = R.matieresDe(E, p.id).map((m) => {
      const pr = R.prevuesCible(E, { type: 'matiere', id: m.id });
      if (!pr.length) return '';
      const r = R.noteNecessaire(E, { type: 'matiere', id: m.id }, pr.map((n) => n.id), p.objectif, s.sys);
      const moy = R.moyenneMatiere(E, m);
      const txt = r.statut === 'acquis' ? '<span class="etiquette vert">Assuré</span>' : r.statut === 'impossible' ? `<span class="etiquette rose">Hors de portée</span> <small>au mieux ${noteTexte(r.max, s.sys)}</small>` : s.sys.code === 'lettres' ? `<b>${R.lettreDe(R.noteAViser(r.frac, s.sys.max), s.sys.lettres)}</b>` : [...new Set(pr.map((n) => n.sur))].map((x) => `<b>${N(R.noteAViser(r.frac, x), 2, true)}</b>/${N(x, 2)}`).join(' ou ');
      return `<tr><td>${pastilleMat(m)}</td><td class="nb">${noteTexte(moy, s.sys)}</td><td class="nb">${N(pr.length)}</td><td class="nb">${txt}</td></tr>`;
    }).filter(Boolean);
    const parMatiere = lignes.length ? `<h2 class="titre-section">Par matière <span>la note à viser à ses épreuves prévues pour qu'elle atteigne ${N(p.objectif, 2)}</span></h2><div class="defile"><table class="tableau"><thead><tr><th>Matière</th><th class="nb">Moyenne</th><th class="nb">Épreuves</th><th class="nb">À viser</th></tr></thead><tbody>${lignes.join('')}</tbody></table></div>` : '';
    return `${tete}${form}${parMatiere}<p class="mention" style="margin-top:12px">Le simulateur cherche la plus petite note, la même à chaque épreuve cochée, qui donne la moyenne visée avec tes coefficients, tes crédits et ta règle de rattrapage. Il ne connaît que les épreuves saisies : ajoute celles qui manquent.</p>${AVERTISSEMENT}`;
  }

  // ---------- Évolution ----------
  function vueEvolution() {
    const p = periodeActive();
    if (!p) return sansPeriode('Évolution');
    const a = annee(p.annee);
    const cible = sel.evo === 'annee' ? { type: 'annee', id: a.id } : { type: 'periode', id: p.id };
    const sys = sel.evo === 'annee' ? sysDe(R.periodesDe(E, a.id)[0] || p) : sysDe(p);
    const ev = R.evolution(E, cible);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${esc(a.nom)}</p><h1>Évolution</h1></div><div class="actions">${choixPeriode()}<label class="champ choix-annee"><span class="sr-only">Moyenne suivie</span><select id="choix-evo"><option value="periode" ${sel.evo === 'periode' ? 'selected' : ''}>Période</option><option value="annee" ${sel.evo === 'annee' ? 'selected' : ''}>Année entière</option></select></label></div></div>`;
    if (!ev.length) return `${tete}${videEtat('Pas encore de note datée', 'La courbe montre ta moyenne après chaque note : elle apparaît dès la première.', '<button class="btn primaire" data-action="note">Ajouter une note</button>')}${AVERTISSEMENT}`;
    const nom = sel.evo === 'annee' ? a.nom : p.nom;
    const graph = courbe(ev, { sys, objectif: p.objectif, seuil: p.seuil, titre: `Moyenne de ${nom} après chaque note` });
    const premier = ev[0], dernier = ev.at(-1);
    const d = R.arrondi(R.valeur(dernier.moy, sys) - R.valeur(premier.moy, sys));
    const meilleur = ev.reduce((x, y) => (y.moy > x.moy ? y : x));
    const faits = [
      `Depuis le ${esc(dateMoy(premier.date))} : <b>${d >= 0 ? '+' : '−'}${N(Math.abs(d), 2, true)}</b>`,
      `Plus haut : <b>${noteTexte(meilleur.moy, sys)}</b> le ${esc(dateMoy(meilleur.date))}`,
      `<b>${N(ev.reduce((t, x) => t + x.notes.length, 0))}</b> notes datées`,
    ];
    const b = R.bilanPeriode(E, p, B);
    const notes = E.notes.filter((n) => !n.prevue && R.matieresDe(E, p.id).some((m) => m.id === n.matiere)).sort((x, y) => (y.date || '').localeCompare(x.date || '')).slice(0, 30);
    const tableau = `<div class="defile"><table class="tableau"><thead><tr><th>Date</th><th>Matière</th><th class="tel-masque">Épreuve</th><th class="nb">Note</th><th class="nb tel-masque">Coef.</th><th class="nb">Sur ${N(sys.max)}</th></tr></thead><tbody>${notes.map((n) => { const f = R.fracNote(E, n); return `<tr><td class="nb" style="text-align:left">${esc(dateMoy(n.date))}</td><td>${esc(matiere(n.matiere)?.nom || '')}</td><td class="tel-masque">${esc(n.intitule || NOMS_TYPES[n.type])}</td><td class="nb">${esc(noteBrute(n))}</td><td class="nb tel-masque">${N(n.coef, 2)}</td><td class="nb">${n.neutre ? 'neutralisée' : noteTexte(f, sys)}</td></tr>`; }).join('')}</tbody></table></div>`;
    return `${tete}<h2 class="titre-section">Moyenne après chaque note <span>${esc(nom)} · objectif et seuil en pointillés</span></h2>${graph}<ul class="faits">${faits.map((x) => `<li>${x}</li>`).join('')}</ul>
      <h2 class="titre-section">Moyennes par matière <span>${esc(p.nom)}</span></h2>${barresMatieres(b, false)}<h2 class="titre-section">Dernières notes <span>${esc(p.nom)}, 30 au plus</span></h2>${tableau}${AVERTISSEMENT}`;
  }

  // ---------- Relevé ----------
  function vueReleve() {
    const p = periodeActive();
    if (!p) return sansPeriode('Relevé');
    if (!annee(sel.annee)) sel.annee = p.annee;
    const a = annee(sel.annee);
    const ba = R.bilanAnnee(E, a, B);
    const id = E.reglages.identite;
    const tete = `<div class="vue-tete"><div><p class="surtitre">Relevé de notes</p><h1>${esc(a.nom)}</h1></div><div class="actions"><label class="champ choix-annee"><span class="sr-only">Année</span><select id="choix-annee">${R.anneesTriees(E).map((x) => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label><button class="btn" data-action="csv-releve">Exporter (CSV)</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>`;
    const resultat = (st, periode = false) => ({ validee: 'Validée', compensee: periode ? 'Validée par compensation' : 'Compensée', acquise: 'Acquise', non: periode ? 'Non validée' : 'Non acquise', attente: 'En attente' }[st] || '');
    const periodes = ba.periodes.map((bp) => {
      const v = (f) => noteTexte(f, bp.sys);
      const lignes = bp.ues.flatMap((u) => [
        `<tr class="ligne-ue"><th>${esc(u.u.nom)}</th><td class="nb">${N(R.poidsUe(E, bp.p, u.u), 2)}</td><td class="nb">${N(u.credits, 1)}</td><td class="nb"><b>${v(u.moy)}</b></td><td>${resultat(u.statut)}</td><td class="nb">${N(u.acquis, 1)}</td></tr>`,
        ...u.matieres.map((x) => `<tr><td class="retrait">${esc(x.m.nom)}</td><td class="nb">${N(R.poidsMatiere(bp.p, x.m), 2)}</td><td class="nb">${N(x.m.credits, 1)}</td><td class="nb">${v(x.moy)}</td><td>${resultat(x.statut)}</td><td class="nb"></td></tr>`),
      ]).concat(bp.libres.map((x) => `<tr><td>${esc(x.m.nom)}</td><td class="nb">${N(R.poidsMatiere(bp.p, x.m), 2)}</td><td class="nb">${N(x.m.credits, 1)}</td><td class="nb"><b>${v(x.moy)}</b></td><td>${resultat(x.statut)}</td><td class="nb">${x.statut === 'acquise' || x.statut === 'compensee' ? N(x.credits, 1) : '0'}</td></tr>`));
      return `<section class="releve-periode"><h2 class="titre-cat">${esc(bp.p.nom)} <span>${esc(bp.sys.nom)} · ${esc(B.modes.find((m) => m.code === bp.p.mode)?.nom || '')}</span></h2>
        <div class="defile"><table class="tableau releve"><thead><tr><th>Enseignement</th><th class="nb">${bp.p.poids === 'credits' ? 'Poids' : 'Coef.'}</th><th class="nb">Crédits</th><th class="nb">Moyenne</th><th>Résultat</th><th class="nb">Acquis</th></tr></thead>
        <tbody>${lignes.join('') || '<tr><td colspan="6">Aucune matière.</td></tr>'}</tbody>
        <tfoot><tr><td>Moyenne de la période${bp.provisoire ? ' (provisoire)' : ''}</td><td></td><td class="nb">${N(bp.creditsTotal, 1)}</td><td class="nb"><b>${v(bp.moy)}</b></td><td>${resultat(bp.statut, true)}${bp.mention ? ` · ${esc(bp.mention)}` : ''}${bp.provisoire && bp.moy !== null ? ' (à ce stade)' : ''}</td><td class="nb">${N(bp.creditsAcquis, 1)}</td></tr></tfoot></table></div></section>`;
    }).join('');
    return `${tete}<div class="releve-feuille">
      <div class="releve-tete"><div><b>${esc(id.nom || 'Relevé personnel')}</b><span>${esc([id.formation, id.etablissement].filter(Boolean).join(' · ') || 'Renseigne ta formation dans les Réglages')}</span></div><div class="releve-annee"><span>${esc(a.nom)}</span><b>${noteTexte(ba.moy, ba.sys)}<small>/${N(ba.sys.max)}</small></b><span>${ba.ok ? `${ba.provisoire ? 'Année validée à ce stade' : 'Année validée'}${ba.compensee ? ' (compensation entre périodes)' : ''}${ba.mention ? ` · ${esc(ba.mention)}` : ''}` : ba.statut === 'attente' ? 'En attente de notes' : ba.provisoire ? 'En cours, sous le seuil pour l\'instant' : 'Non validée'} · ${N(ba.creditsAcquis, 1)} / ${N(ba.creditsTotal, 1)} ECTS</span></div></div>
      ${periodes || '<p class="mention">Aucune période.</p>'}
      <p class="mention">Relevé personnel établi le ${esc(R.dateFrLongue(auj()))} à partir de mes propres saisies, sans valeur officielle. Règles appliquées : celles saisies pour chaque période (seuil, compensation, note éliminatoire, rattrapage) et la compensation entre périodes ${a.compensation === 'periodes' ? 'activée' : 'désactivée'} pour l'année.</p>
    </div>${AVERTISSEMENT}`;
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
      if (typeof err === 'string') { const p = d.querySelector('.modale-corps > .erreur'); if (p) p.textContent = err; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const d2 = (f) => setTimeout(f, 30);

  function modifier(fn, message) {
    retenir();
    E = fn(E);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  const remplacer = (liste, x) => { const i = liste.findIndex((y) => y.id === x.id); const l = liste.slice(); if (i >= 0) l[i] = x; else l.push(x); return l; };

  // Note obtenue ou épreuve prévue.
  function modaleNote(id, { matiere: mid, prevue } = {}) {
    const n0 = id ? E.notes.find((x) => x.id === id) : null;
    const p = n0 ? R.periodeDe(E, matiere(n0.matiere)) : periodeActive();
    if (!p) { modaleAnnee(); return; }
    const mats = R.matieresDe(E, p.id);
    if (!mats.length) { toast('Ajoute d\'abord une matière.'); modaleMatiere(null); return; }
    const sys = sysDe(p);
    const lettres = sys.code === 'lettres';
    const n = n0 || R.normaliserNote({ matiere: mid || mats[0].id, date: auj(), sur: sys.max, coef: 1, type: prevue ? 'partiel' : 'controle', prevue: !!prevue });
    const groupes = R.uesDe(E, p.id).map((u) => { const l = R.matieresUe(E, u.id); return l.length ? `<optgroup label="${esc(u.nom)}">${l.map((m) => `<option value="${m.id}" ${m.id === n.matiere ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</optgroup>` : ''; }).join('')
      + R.matieresLibres(E, p.id).map((m) => `<option value="${m.id}" ${m.id === n.matiere ? 'selected' : ''}>${esc(m.nom)}</option>`).join('');
    const estPrevue = n0 ? n0.prevue : !!prevue;
    const valeurInit = n.prevue ? '' : n.lettre ? n.lettre : N(n.valeur, 2).replace(/\s/g, '');
    const corps = `
      <label class="champ">Matière<select name="matiere">${groupes}</select></label>
      <fieldset class="champ"><legend>Cette note</legend><div class="choix-statut deux"><label><input type="radio" name="etat" value="obtenue" ${estPrevue ? '' : 'checked'}><span>Obtenue</span></label><label><input type="radio" name="etat" value="prevue" ${estPrevue ? 'checked' : ''}><span>Prévue (à venir)</span></label></div></fieldset>
      <div class="rang-champs">
        <label class="champ" data-si="obtenue">Note <small>${lettres ? 'lettre de ta table, ou 14/20' : 'par exemple 14,5 ou 7/10'}</small><input name="valeur" inputmode="${lettres ? 'text' : 'decimal'}" value="${esc(valeurInit)}" maxlength="10" autocomplete="off"></label>
        ${lettres ? '' : `<label class="champ">Sur<input name="sur" inputmode="decimal" value="${N(n.sur, 2).replace(/\s/g, '')}" maxlength="6"></label>`}
        <label class="champ">Coefficient <small>dans la matière</small><input name="coef" inputmode="decimal" value="${N(n.coef, 2).replace(/\s/g, '')}" maxlength="6"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Type<select name="type">${B.types.map((t) => `<option value="${t.code}" ${t.code === n.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        <label class="champ">Date<input type="date" name="date" value="${n.date}"></label>
      </div>
      <label class="champ">Intitulé <small>facultatif</small><input name="intitule" value="${esc(n.intitule)}" maxlength="80" placeholder="par exemple Partiel, TP 2, exposé"></label>
      <label class="case" data-si="obtenue"><input type="checkbox" name="neutre" ${n.neutre ? 'checked' : ''}> Neutralisée (absence justifiée, note hors moyenne)</label>
      <p class="apercu-session" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(n0 ? (n0.prevue ? 'Modifier l\'épreuve prévue' : 'Modifier la note') : prevue ? 'Nouvelle épreuve prévue' : 'Nouvelle note', corps, PIED(!!n0), (fd, choix) => {
      if (choix === 'supprimer') { modifier((e) => ({ ...e, notes: e.notes.filter((x) => x.id !== n.id) }), 'Note supprimée.'); return undefined; }
      const r = lire(fd);
      if (typeof r === 'string') return r;
      const nouvelle = r.note;
      modifier((e) => ({ ...e, notes: remplacer(e.notes, nouvelle) }), n0 ? 'Note modifiée.' : nouvelle.prevue ? 'Épreuve prévue ajoutée : le simulateur en tient compte.' : `Note ajoutée en ${matiere(nouvelle.matiere).nom}.`);
      return undefined;
    });
    const d = modale();
    function lire(fd) {
      const etat = fd.get('etat');
      const coef = lireNombre(fd.get('coef'));
      if (coef === null || coef === '') return 'Le coefficient est un nombre (0 pour ne pas compter la note).';
      const surSaisi = lettres ? sys.max : lireNombre(fd.get('sur'));
      if (!surSaisi) return 'Le barème (sur combien) est un nombre supérieur à 0.';
      const date = String(fd.get('date') || '');
      const base = { ...n, matiere: fd.get('matiere'), coef, type: fd.get('type'), date, intitule: fd.get('intitule'), sur: surSaisi, neutre: etat === 'obtenue' && fd.get('neutre') === 'on' };
      delete base.valeur; delete base.lettre;
      if (etat === 'prevue') return { note: R.normaliserNote({ ...base, prevue: true, neutre: false }) };
      const l = R.lireNote(fd.get('valeur'), sys, surSaisi);
      if (l.vide) return 'Indique la note, ou choisis « Prévue ».';
      if (l.erreur) return l.erreur;
      if (!date) return 'Indique la date de la note.';
      return { note: R.normaliserNote({ ...base, prevue: false, ...(l.lettre ? { lettre: l.lettre } : { valeur: l.valeur, sur: l.sur }) }) };
    }
    const maj = () => {
      const etat = d.querySelector('[name=etat]:checked').value;
      d.querySelectorAll('[data-si]').forEach((x) => { x.hidden = x.dataset.si !== etat; });
      const ap = d.querySelector('.apercu-session');
      const m = matiere(d.querySelector('[name=matiere]').value);
      const avant = R.moyenneMatiere(E, m);
      const r = lire(new FormData(d.querySelector('form')));
      if (typeof r === 'string' || r.note.prevue) { ap.innerHTML = `${esc(m.nom)} : moyenne actuelle <b>${noteTexte(avant, sys)}</b>${etat === 'prevue' ? '. L\'épreuve comptera dans le simulateur.' : ''}`; return; }
      const e2 = { ...E, notes: remplacer(E.notes, r.note) };
      const apres = R.moyenneMatiere(e2, m);
      const moyP = R.moyennePeriode(E, p), moyP2 = R.moyennePeriode(e2, p);
      ap.innerHTML = `${esc(m.nom)} : <b>${noteTexte(avant, sys)}</b> → <b>${noteTexte(apres, sys)}</b> · ${esc(p.nom)} : ${noteTexte(moyP, sys)} → <b>${noteTexte(moyP2, sys)}</b>`;
    };
    d.querySelectorAll('input,select').forEach((x) => { x.addEventListener('input', maj); x.addEventListener('change', maj); });
    maj();
    if (!estTel()) d.querySelector(estPrevue ? '[name=coef]' : '[name=valeur]')?.focus();
  }

  function modaleMatiere(id, { ue: ueId } = {}) {
    const m0 = id ? matiere(id) : null;
    const p = m0 ? R.periodeDe(E, m0) : periodeActive();
    if (!p) { modaleAnnee(); return; }
    const m = m0 || R.normaliserMatiere({ periode: p.id, ue: ueId || '', coef: 1, credits: 0, couleur: R.matieresDe(E, p.id).length % 8 });
    const ues = R.uesDe(E, p.id);
    const n = m0 ? R.notesDe(E, m0.id).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" value="${m0 ? esc(m.nom) : ''}" maxlength="80" list="matieres-connues" required></label>
      <datalist id="matieres-connues">${[...new Set(B.matieres.concat(E.matieres.map((x) => x.nom)))].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      ${ues.length ? `<label class="champ">Unité d'enseignement<select name="ue"><option value="">Hors UE</option>${ues.map((u) => `<option value="${u.id}" ${u.id === m.ue ? 'selected' : ''}>${esc(u.nom)}</option>`).join('')}</select></label>` : ''}
      <div class="rang-champs">
        <label class="champ">Coefficient<input name="coef" inputmode="decimal" value="${N(m.coef, 2).replace(/\s/g, '')}" maxlength="6"></label>
        <label class="champ">Crédits ECTS <small>facultatif</small><input name="credits" inputmode="decimal" value="${m.credits ? N(m.credits, 1).replace(/\s/g, '') : ''}" maxlength="5"></label>
      </div>
      <p class="aide">Cette période pondère les matières par leurs ${p.poids === 'credits' ? '<b>crédits</b> (le coefficient sert alors de repère)' : '<b>coefficients</b> (les crédits servent au total des ECTS acquis)'} : réglage dans « Règles ».</p>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${i === m.couleur ? 'checked' : ''}><span style="background:${c.fond};border-color:${c.bord}"><span class="sr-only">Couleur ${i + 1}</span></span></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m0 ? 'Modifier la matière' : 'Nouvelle matière', corps, PIED(!!m0), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer « ${m.nom} »${n ? ` et ses ${pluriel(n, 'note')}` : ''} ?`)) return '';
        modifier((e) => R.supprimerMatiere(e, m.id), 'Matière supprimée.');
        return undefined;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la matière.';
      const coef = lireNombre(fd.get('coef')), credits = lireNombre(fd.get('credits'));
      if (coef === null || coef === '' || credits === null) return 'Coefficient et crédits sont des nombres.';
      const x = R.normaliserMatiere({ ...m, nom, ue: fd.get('ue') || '', coef, credits: credits || 0, couleur: fd.get('couleur'), ordre: m0 ? m.ordre : Math.max(-1, ...E.matieres.map((y) => y.ordre)) + 1 });
      modifier((e) => ({ ...e, matieres: remplacer(e.matieres, x) }), m0 ? 'Matière modifiée.' : `« ${x.nom} » ajoutée.`);
      return undefined;
    });
  }

  function modaleUe(id) {
    const u0 = id ? ue(id) : null;
    const p = u0 ? periode(u0.periode) : periodeActive();
    if (!p) { modaleAnnee(); return; }
    const u = u0 || R.normaliserUe({ periode: p.id });
    const corps = `
      <label class="champ">Nom<input name="nom" value="${u0 ? esc(u.nom) : ''}" maxlength="80" placeholder="par exemple UE1 Économie" required></label>
      <div class="rang-champs">
        <label class="champ">Coefficient <small>vide : somme des matières</small><input name="coef" inputmode="decimal" value="${u.coef ? N(u.coef, 2).replace(/\s/g, '') : ''}" maxlength="6"></label>
        <label class="champ">Crédits ECTS <small>vide : somme des matières</small><input name="credits" inputmode="decimal" value="${u.credits ? N(u.credits, 1).replace(/\s/g, '') : ''}" maxlength="5"></label>
      </div>
      <p class="aide">La moyenne de l'UE est celle de ses matières, pondérées comme la période. Son poids dans la période : ${p.poids === 'credits' ? 'ses crédits' : 'son coefficient'}.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(u0 ? 'Modifier l\'UE' : 'Nouvelle unité d\'enseignement', corps, PIED(!!u0), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer l'UE « ${u.nom} » ? Ses matières et leurs notes restent, hors UE.`)) return '';
        modifier((e) => R.supprimerUe(e, u.id), 'UE supprimée.');
        return undefined;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'UE.';
      const coef = lireNombre(fd.get('coef')), credits = lireNombre(fd.get('credits'));
      if (coef === null || credits === null) return 'Coefficient et crédits sont des nombres.';
      const x = R.normaliserUe({ ...u, nom, coef: coef || 0, credits: credits || 0, ordre: u0 ? u.ordre : Math.max(-1, ...E.ues.map((y) => y.ordre)) + 1 });
      modifier((e) => ({ ...e, ues: remplacer(e.ues, x) }), u0 ? 'UE modifiée.' : `« ${x.nom} » ajoutée.`);
      return undefined;
    });
  }

  // Période : nom, notation et règles du diplôme (saisies).
  function modalePeriode(id, anneeId) {
    const p0 = id ? periode(id) : null;
    const a = annee(p0?.annee || anneeId || periodeActive()?.annee);
    if (!a) { modaleAnnee(); return; }
    const p = p0 || R.normaliserPeriode({ ...(R.periodesDe(E, a.id).at(-1) || {}), id: undefined, annee: a.id, nom: `Période ${R.periodesDe(E, a.id).length + 1}`, ordre: R.periodesDe(E, a.id).length }, B);
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom<input name="nom" value="${esc(p.nom)}" maxlength="60" required></label>
        <label class="champ">Année<select name="annee">${R.anneesTriees(E).map((x) => `<option value="${x.id}" ${x.id === p.annee ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Notation<select name="systeme">${B.systemes.map((s) => `<option value="${s.code}" ${s.code === p.systeme ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
        <label class="champ">Pondération des matières et UE<select name="poids"><option value="coef" ${p.poids === 'coef' ? 'selected' : ''}>Coefficients</option><option value="credits" ${p.poids === 'credits' ? 'selected' : ''}>Crédits ECTS</option></select></label>
      </div>
      <fieldset class="champ"><legend>Règle de validation <small>celle de ton règlement des études</small></legend>
        <div class="choix-regles">${B.modes.map((m) => `<label><input type="radio" name="mode" value="${m.code}" ${m.code === p.mode ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.aide)}</small></span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Seuil de validation<input name="seuil" inputmode="decimal" value="${N(p.seuil, 2).replace(/\s/g, '')}" maxlength="6"></label>
        <label class="champ">Note éliminatoire <small>vide : aucune</small><input name="eliminatoire" inputmode="decimal" value="${p.eliminatoire === null ? '' : N(p.eliminatoire, 2).replace(/\s/g, '')}" maxlength="6"></label>
        <label class="champ">Moyenne visée<input name="objectif" inputmode="decimal" value="${N(p.objectif, 2).replace(/\s/g, '')}" maxlength="6"></label>
      </div>
      <label class="champ">Rattrapage (2e session)<select name="rattrapage"><option value="remplace" ${p.rattrapage === 'remplace' ? 'selected' : ''}>La note de rattrapage remplace la moyenne de la matière</option><option value="meilleure" ${p.rattrapage === 'meilleure' ? 'selected' : ''}>On garde la meilleure des deux</option></select></label>
      <p class="aide">Les valeurs sont dans l'échelle choisie (sur 20, sur 10, sur 100 ou en points de lettres). Une moyenne est comparée au seuil une fois arrondie au centième.</p>
      ${p0 ? '<div class="groupe"><h3>Structure</h3><div class="rang"><button type="button" class="btn petit" data-action="copier">Reprendre les UE et matières d\'une autre période</button></div></div>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p0 ? `Règles · ${esc(p.nom)}` : 'Nouvelle période', corps, PIED(!!p0), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer « ${p.nom} », ses matières et toutes leurs notes ? Pense à exporter une copie avant.`)) return '';
        modifier((e) => R.supprimerPeriode(e, p.id), 'Période supprimée.');
        return undefined;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la période.';
      const sys = R.systeme(E, { systeme: fd.get('systeme') }, B);
      const [seuil, elim, obj] = ['seuil', 'eliminatoire', 'objectif'].map((k) => lireNombre(fd.get(k)));
      if ([seuil, elim, obj].includes(null) || seuil === '' || obj === '') return 'Seuil, note éliminatoire et moyenne visée sont des nombres.';
      if (seuil > sys.max || obj > sys.max || (elim !== '' && elim > sys.max)) return `Les valeurs ne dépassent pas ${N(sys.max)} dans cette notation.`;
      if (elim !== '' && elim > seuil) return 'La note éliminatoire est au plus égale au seuil.';
      const x = R.normaliserPeriode({ ...p, nom, annee: fd.get('annee'), systeme: fd.get('systeme'), poids: fd.get('poids'), mode: fd.get('mode'), seuil, eliminatoire: elim === '' ? null : elim, objectif: obj, rattrapage: fd.get('rattrapage') }, B);
      modifier((e) => ({ ...e, periodes: remplacer(e.periodes, x) }), p0 ? 'Règles enregistrées.' : `« ${x.nom} » ajoutée.`);
      sel.periode = x.id; sauverPref(); rendre();
      return undefined;
    });
    // Changement de notation : propose le seuil et l'objectif de cette échelle.
    const d = modale();
    d.querySelector('[name=systeme]').addEventListener('change', (e) => {
      const s = B.systemes.find((x) => x.code === e.target.value);
      d.querySelector('[name=seuil]').value = String(s.seuil).replace('.', ',');
      d.querySelector('[name=objectif]').value = String(s.objectif).replace('.', ',');
      d.querySelector('[name=eliminatoire]').value = '';
    });
  }

  // Reprend la structure (UE et matières, sans les notes) d'une autre période dans la période active.
  function modaleCopier() {
    const p = periodeActive();
    const autres = R.periodesTriees(E).filter((x) => x.id !== p.id && R.matieresDe(E, x.id).length);
    if (!autres.length) { toast('Aucune autre période avec des matières.'); return; }
    const corps = `<p>Les UE et matières de la période choisie (noms, coefficients, crédits, couleurs) sont ajoutées à <b>${esc(p.nom)}</b>, sans les notes.</p>
      <label class="champ">Reprendre<select name="source">${autres.map((x) => `<option value="${x.id}">${esc(annee(x.annee)?.nom)} · ${esc(x.nom)} (${pluriel(R.matieresDe(E, x.id).length, 'matière')})</option>`).join('')}</select></label><p class="erreur" role="alert"></p>`;
    ouvrirModale('Reprendre une structure', corps, '<button class="btn primaire" value="ok">Reprendre</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      modifier((e) => R.copierStructure(e, fd.get('source'), p.id), 'Structure reprise : ajuste les coefficients si besoin.');
      return undefined;
    });
  }

  // Année : nom, compensation entre périodes ; création avec un modèle de périodes.
  function modaleAnnee(id) {
    const a0 = id ? annee(id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" value="${a0 ? esc(a0.nom) : esc(anneeScolaire())}" maxlength="60" placeholder="par exemple L3 · ${anneeScolaire()}" required></label>
      ${a0 ? '' : `<fieldset class="champ"><legend>Périodes</legend><div class="choix-modeles">${B.modeles.map((m, i) => `<label><input type="radio" name="modele" value="${m.code}" ${i === 2 ? 'checked' : ''}><span><b>${esc(m.nom)}</b><small>${esc(m.aide)}</small></span></label>`).join('')}</div></fieldset>
        <label class="champ">Notation<select name="systeme">${B.systemes.map((s) => `<option value="${s.code}">${esc(s.nom)}</option>`).join('')}</select></label>
        ${E.periodes.length ? '<label class="case"><input type="checkbox" name="reprendre" checked> Reprendre les UE et matières de l\'année précédente (sans les notes)</label>' : ''}`}
      <label class="case"><input type="checkbox" name="compensation" ${a0?.compensation === 'periodes' ? 'checked' : ''}> Compensation entre les périodes de l'année (par exemple semestres 1 et 2 d'une licence, si ton règlement le prévoit)</label>
      ${a0 ? `<div class="groupe"><h3>Périodes</h3><ul class="mini-liste">${R.periodesDe(E, a0.id).map((p) => `<li><span>${esc(p.nom)}</span><button type="button" class="btn petit" data-action="periode" data-id="${p.id}">Règles</button></li>`).join('')}</ul><div class="rang"><button type="button" class="btn petit" data-action="periode-nouvelle" data-annee="${a0.id}">${ICONES.plus}Période</button></div></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a0 ? 'Modifier l\'année' : 'Nouvelle année', corps, PIED(!!a0), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer « ${a0.nom} », ses périodes, matières et notes ? Pense à exporter une copie avant.`)) return '';
        modifier((e) => R.supprimerAnnee(e, a0.id), 'Année supprimée.');
        return undefined;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de l\'année.';
      const compensation = fd.get('compensation') === 'on' ? 'periodes' : 'aucune';
      if (a0) { modifier((e) => ({ ...e, annees: remplacer(e.annees, { ...a0, nom, compensation }) }), 'Année modifiée.'); return undefined; }
      const precedente = R.anneesTriees(E).at(-1);
      retenir();
      const r = creerAnnee(E, nom, fd.get('modele'), fd.get('systeme'), '');
      let e = { ...r.etat, annees: r.etat.annees.map((x) => (x.id === r.annee.id ? { ...x, compensation } : x)) };
      if (fd.get('reprendre') === 'on' && precedente) R.periodesDe(E, precedente.id).forEach((src, i) => { if (r.periodes[i]) e = R.copierStructure(e, src.id, r.periodes[i].id); });
      E = normaliser(e);
      sel.periode = r.periodes[0].id; sauverPref();
      sauver(); rendre();
      toast(`« ${nom} » créée.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const t = R.taille(E), pct = Math.round((t / 900000) * 100);
    const r = E.reglages;
    const corps = `
      <div class="groupe"><h3>Pour le relevé</h3><div class="rang-champs"><label class="champ">Ton nom <small>facultatif</small><input name="id-nom" value="${esc(r.identite.nom)}" maxlength="80"></label><label class="champ">Formation<input name="id-formation" value="${esc(r.identite.formation)}" maxlength="100"></label></div>
        <label class="champ">Établissement<input name="id-etablissement" value="${esc(r.identite.etablissement)}" maxlength="100"></label></div>
      <div class="groupe"><h3>Années</h3><ul class="mini-liste">${R.anneesTriees(E).map((a) => `<li><span>${esc(a.nom)} <span class="mention">${pluriel(R.periodesDe(E, a.id).length, 'période')}</span></span><button type="button" class="btn petit" data-action="annee" data-id="${a.id}">Modifier</button></li>`).join('')}</ul>
        <div class="rang"><button type="button" class="btn petit" data-action="annee">${ICONES.plus}Année</button></div></div>
      <div class="groupe"><h3>Mentions</h3><p class="aide">Seuils sur 20 (convertis pour les autres échelles), attribuées quand la période ou l'année est validée. Remplace-les par celles de ton diplôme ; vide un nom pour retirer une mention.</p>
        <ul class="mini-liste liste-genres">${r.mentions.concat([{ nom: '', seuil: '' }]).map((m, i) => `<li class="ligne-deux"><label class="champ"><span class="sr-only">Mention ${i + 1}</span><input name="mention-nom-${i}" value="${esc(m.nom)}" maxlength="40" placeholder="Nouvelle mention"></label><label class="champ"><span class="sr-only">Seuil</span><input name="mention-seuil-${i}" inputmode="decimal" value="${m.seuil === '' ? '' : N(m.seuil, 2)}" maxlength="5" placeholder="seuil"></label></li>`).join('')}</ul></div>
      <div class="groupe"><h3>Table des lettres</h3><p class="aide">Pour la notation « Lettres » : les points de chaque lettre (le plus grand donne la note maximale). Elle dépend de ton établissement ; la notation ECTS en lettres repose sur un classement, pas sur une conversion : saisis la table de ton règlement.</p>
        <ul class="mini-liste liste-genres">${r.lettres.concat([{ lettre: '', points: '' }]).map((l, i) => `<li class="ligne-deux"><label class="champ"><span class="sr-only">Lettre ${i + 1}</span><input name="lettre-${i}" value="${esc(l.lettre)}" maxlength="3" placeholder="Lettre"></label><label class="champ"><span class="sr-only">Points</span><input name="points-${i}" inputmode="decimal" value="${l.points === '' ? '' : N(l.points, 2)}" maxlength="5" placeholder="points"></label></li>`).join('')}</ul></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">En tableur (CSV, séparateur point-virgule) : toutes les notes, ou le relevé (moyennes, résultats, crédits).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-notes">Notes</button><button class="btn petit" type="button" data-action="csv-releve">Relevé</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes notes sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div>
        <p class="mention">Taille : ${N(Math.round(t / 1000))} Ko sur 900 Ko permis (${pct} %)${pct >= 70 ? ' : exporte une copie, puis supprime les années anciennes.' : '.'}</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du calcul des moyennes, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute tes notes à ton écran d'accueil pour saisir une note à la sortie du partiel et voir tout de suite ta moyenne.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Tes notes sont enregistrées en ligne, liées à ta clé, et ne sont ni lues ni partagées par QME. Aucun lien avec ton établissement, ton espace numérique de travail ou un logiciel de scolarité.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucun barème officiel d'examen ni règle d'un diplôme intégrés : systèmes de notation, seuils, objectifs, mentions et table des lettres sont des propositions modifiables. Calculs : moyennes pondérées (coefficients des notes, puis coefficients ou crédits des matières et des UE), comparées aux seuils une fois arrondies au centième ; note nécessaire cherchée par dichotomie, la même à chaque épreuve choisie.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const mentions = [];
      for (let i = 0; fd.has(`mention-nom-${i}`); i++) {
        const nom = String(fd.get(`mention-nom-${i}`)).trim();
        if (!nom) continue;
        const s = lireNombre(fd.get(`mention-seuil-${i}`));
        if (s === null || s === '' || s > 20) return `Seuil de la mention « ${nom} » : un nombre entre 0 et 20.`;
        mentions.push({ nom, seuil: s });
      }
      const lettres = [];
      for (let i = 0; fd.has(`lettre-${i}`); i++) {
        const l = String(fd.get(`lettre-${i}`)).trim().toUpperCase();
        if (!l) continue;
        const pts = lireNombre(fd.get(`points-${i}`));
        if (pts === null || pts === '') return `Points de la lettre « ${l} » : un nombre.`;
        if (lettres.some((x) => x.lettre === l)) return `La lettre « ${l} » apparaît deux fois.`;
        lettres.push({ lettre: l, points: pts });
      }
      if (!lettres.length) return 'Garde au moins une lettre dans la table.';
      const identite = { nom: fd.get('id-nom'), formation: fd.get('id-formation'), etablissement: fd.get('id-etablissement') };
      modifier((e) => normaliser({ ...e, reglages: R.normaliserReglages({ mentions, lettres, identite }, B) }), 'Réglages enregistrés.');
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.matieres) || !Array.isArray(donnees.notes)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(donnees.matieres.length, 'matière')}, ${pluriel(donnees.notes.length, 'note')}) ?`)) return;
        const vu = E.tutorielVu; E = normaliser(donnees); delete E.majLe; E.tutorielVu = Boolean(E.tutorielVu || vu);
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de Notes et moyennes.'); }
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
  const CSV = 'text/csv;charset=utf-8';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `notes-moyennes-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const blocs = [
      ['rose', 'Recopie ta maquette', `Chaque période (semestre, trimestre…) regroupe ses UE et ses matières, avec leurs coefficients ou leurs crédits ECTS. Les règles viennent de ton règlement des études&nbsp;: seuil de validation, compensation, note éliminatoire, rattrapage. Elles se règlent par période, avec le bouton <b>Règles</b> de l'onglet <b>Notes</b>.`],
      ['beurre', 'Note chaque résultat', `Saisis une note comme sur ta copie («&nbsp;14,5&nbsp;», «&nbsp;7/10&nbsp;», «&nbsp;85&nbsp;%&nbsp;»), avec son coefficient. Une épreuve pas encore passée s'ajoute comme <b>prévue</b>&nbsp;: elle ne compte pas encore dans la moyenne. Une absence justifiée peut être neutralisée.`],
      ['ciel', 'Les moyennes en cascade', `Une matière fait la moyenne de ses notes, pondérées par leur coefficient. Puis viennent l'UE, la période et l'année, pondérées par les coefficients ou les crédits. Une note de rattrapage remplace la première moyenne, ou ne compte que si elle est meilleure, selon la règle de la période.`],
      ['sable', 'Quelle note te faut-il&nbsp;?', `L'onglet <b>Objectifs</b> cherche la plus petite note, la même à chaque épreuve prévue cochée, qui donne la moyenne que tu vises. Il te dit aussi quand l'objectif est déjà assuré, ou hors de portée.`],
    ];
    const corps = `
      <p>L'outil calcule tes moyennes, tes crédits acquis et la note qu'il te faut aux prochaines épreuves, selon les règles que tu saisis. Ton rôle&nbsp;: recopier ta maquette, puis noter chaque résultat.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Bilan</b> montre la période choisie (moyennes, statuts, crédits acquis), <b>Évolution</b> ta moyenne au fil des notes, <b>Relevé</b> un relevé personnel à imprimer, sans valeur officielle. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && E.periodes.length && !E.matieres.length;
    const pied = premier
      ? '<button class="btn primaire" value="matiere">Ajouter ma première matière</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'matiere') setTimeout(() => modaleMatiere(null, {}), 0); });
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
      <p>Enregistre tes notes sur ton écran d'accueil : elles s'ouvrent ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    const fermerPuis = (f) => { if (modale().open) { modale().close(); d2(f); } else f(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; sel.periode = ''; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': fermerPuis(() => modaleEcranAccueil()); break;
      case 'tutoriel': fermerPuis(() => modaleTutoriel()); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-notes': telecharger(R.csvNotes(E, B, NOMS_TYPES), CSV, `notes-${auj()}.csv`); break;
      case 'csv-releve': telecharger(R.csvReleve(E, B), CSV, `releve-${auj()}.csv`); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'note': fermerPuis(() => modaleNote(null, { matiere: el.dataset.matiere, prevue: el.dataset.prevue === '1' })); break;
      case 'note-modif': modaleNote(id); break;
      case 'matiere': fermerPuis(() => modaleMatiere(id || null, { ue: el.dataset.ue })); break;
      case 'ue': modaleUe(id || null); break;
      case 'periode': fermerPuis(() => modalePeriode(id)); break;
      case 'periode-nouvelle': fermerPuis(() => modalePeriode(null, el.dataset.annee)); break;
      case 'annee': fermerPuis(() => modaleAnnee(id || null)); break;
      case 'copier': fermerPuis(() => modaleCopier()); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  // Passage ordinateur ↔ téléphone : le graphique change de taille.
  MQ_TEL.addEventListener('change', () => { if (E && !modale().open) rendre(); });

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
  window.__nts = { etat: () => E, regles: R };
  init();
})();
