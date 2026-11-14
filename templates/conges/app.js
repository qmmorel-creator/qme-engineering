// Suivi des congés et absences QME : soldes calculés, demandes à valider, calendrier d'équipe,
// chevauchements. Données synchronisées par clé de licence ou code d'accès. Rien n'est envoyé aux salariés.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CNG;
  const API = '/api/templates';
  const PRODUIT = 'CNG';
  const CLE_CODE = 'qme-cng-code';
  const CLE_CACHE = 'qme-cng-cache';
  const CLE_DEMO = 'qme-cng-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cng-ecran-accueil';
  const DEFAUTS = { reglages: B.reglages, types: B.types, couleurs: B.couleurs };

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
  const { ajout, versDate, nombre } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dateJour = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  const plage = (a) => (a.debut === a.fin ? dateJour(a.debut) : `${dateCourte(a.debut)} → ${dateCourte(a.fin)}`);
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const unite = () => (E.reglages.decompte === 'ouvres' ? 'j. ouvrés' : 'j. ouvrables');
  const jours = (n, u = unite()) => `${nombre(n)} ${u}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { statut: 'attente', q: '' };
  let moisCal = null;
  let equipeCal = '';
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  const salarie = (id) => E.salaries.find((s) => s.id === id);
  const absence = (id) => E.absences.find((a) => a.id === id);
  const equipe = (id) => E.equipes.find((e) => e.id === id);
  const type = (id) => R.typeDe(E.types, id);
  const nomSal = (id) => { const s = salarie(id); return s ? `${s.prenom} ${s.nom}`.trim() || 'Sans nom' : 'Salarié supprimé'; };
  const nomEquipe = (id) => equipe(id)?.nom || 'Sans équipe';
  const couleur = (t) => B.couleurs[t?.couleur ?? 6] || B.couleurs[6];
  const pastille = (t) => { const c = couleur(t); return `<span class="pastille-type" style="--f:${c.fond};--t:${c.texte}" aria-hidden="true">${esc(t?.lettre || '?')}</span>`; };
  const nbJours = (a) => R.decompte(a, E.types, E.reglages);
  // Jour de référence des « absents » : aujourd'hui, ou le prochain jour ouvré le week-end et les fériés.
  const jourRef = (t) => { let d = t; for (let i = 0; i < 10 && !R.estOuvre(d, E.reglages); i++) d = ajout(d, 1); return d; };

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
        toast('Un autre appareil a modifié le suivi entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (CNG-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Menuiserie fictive : 3 équipes, 8 salariés (dont une arrivée récente et un départ), absences à des
  // dates relatives à aujourd'hui couvrant tous les états : congés pris, en cours, posés, demandes à
  // traiter (dont une qui dépasse le seuil de l'équipe et une qui rend un solde négatif), refusée,
  // annulée, arrêt maladie en cours (sans détail), RTT, demi-journée, événement familial, sans solde.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    const lundi = (semaines) => { const d = versDate(t); const decal = (d.getDay() + 6) % 7; return ajout(t, -decal + 7 * semaines); };
    const jour = (semaines, k) => ajout(lundi(semaines), k); // k : 0 = lundi … 4 = vendredi
    e.entreprise = 'Menuiserie Exemple';
    e.reglages.debutSuivi = R.periodePrecedente(R.periode(t, e.reglages), e.reglages).debut;
    e.equipes = [
      { id: 'atelier', nom: 'Atelier', maxAbsents: 1 },
      { id: 'pose', nom: 'Pose', maxAbsents: 1 },
      { id: 'bureau', nom: 'Bureau', maxAbsents: 1 },
    ].map(R.normaliserEquipe);
    const sa = (prenom, nom, eq, entree, extra = {}) => { const s = R.normaliserSalarie({ id: uid(), prenom, nom, equipe: eq, entree, ...extra }); e.salaries.push(s); return s.id; };
    const camille = sa('Camille', 'Martin', 'atelier', '2018-03-05', { reliquatCp: 28, rttAnnuel: 6 });
    const lucas = sa('Lucas', 'Bernard', 'atelier', '2021-09-01', { reliquatCp: 30 });
    const ines = sa('Inès', 'Petit', 'atelier', j(-75));
    const lea = sa('Léa', 'Durand', 'pose', '2019-04-01', { reliquatCp: 26 });
    const nathan = sa('Nathan', 'Moreau', 'pose', '2022-01-10', { reliquatCp: 30 });
    const chloe = sa('Chloé', 'Laurent', 'pose', '2020-06-15', { reliquatCp: 24 });
    const sarah = sa('Sarah', 'Simon', 'bureau', '2017-02-01', { rttAnnuel: 10, reliquatRtt: 1, reliquatCp: 30 });
    const thomas = sa('Thomas', 'Michel', 'bureau', '2023-05-02', { rttAnnuel: 10, reliquatCp: 22, ajustements: [{ id: uid(), date: j(-160), compteur: 'cp', jours: 2, motif: 'Jours de fractionnement' }] });
    sa('Manon', 'Lefebvre', 'bureau', '2020-10-01', { sortie: j(-30), reliquatCp: 30 });
    const manon = e.salaries.at(-1).id;
    const ab = (sal, typ, debut, fin, statut = 'validee', extra = {}) => e.absences.push(R.normaliserAbsence({ id: uid(), salarie: sal, type: typ, debut, fin, statut, demandeLe: ajout(debut, -30) < t ? ajout(debut, -30) : j(-3), decideLe: statut === 'demandee' ? null : ajout(debut, -25) < t ? ajout(debut, -25) : j(-1), ...extra }));
    // Été de la période précédente (environ 66 semaines plus tôt) et de la période en cours.
    for (const [s, k] of [[camille, -66], [lucas, -65], [lea, -67], [nathan, -64], [chloe, -63], [sarah, -66], [thomas, -62], [manon, -65]]) ab(s, 'cp', jour(k, 0), jour(k + 2, 4));
    ab(camille, 'cp', jour(-14, 0), jour(-12, 4));
    ab(lucas, 'cp', jour(-15, 0), jour(-13, 4));
    ab(lea, 'cp', jour(-13, 0), jour(-11, 4));
    ab(nathan, 'cp', jour(-16, 0), jour(-14, 4));
    ab(chloe, 'cp', jour(-12, 0), jour(-11, 4));
    ab(sarah, 'cp', jour(-14, 0), jour(-12, 4));
    ab(thomas, 'cp', jour(-3, 0), jour(-3, 4), 'validee', { note: 'Vacances de la Toussaint' });
    ab(manon, 'cp', jour(-6, 0), jour(-6, 4));
    ab(ines, 'cp', jour(-2, 0), jour(-2, 1), 'validee', { note: 'Pris par anticipation' });
    // En cours.
    ab(lucas, 'maladie', j(-6), j(8));
    ab(chloe, 'famille', jour(-2, 3), jour(-2, 4), 'validee', { note: 'Mariage' });
    ab(thomas, 'sansSolde', jour(-9, 0), jour(-9, 4));
    // À venir et à traiter.
    ab(camille, 'cp', jour(3, 0), jour(4, 4), 'validee', { note: 'Vacances de fin d\'année' });
    ab(ines, 'cp', jour(4, 0), jour(4, 4), 'demandee');
    ab(lea, 'cp', jour(5, 0), jour(6, 4));
    ab(nathan, 'cp', jour(6, 0), jour(6, 2), 'demandee');
    ab(chloe, 'cp', jour(5, 0), jour(5, 4), 'refusee', { note: 'Même semaine que Léa : à reporter en janvier.' });
    ab(sarah, 'rtt', jour(1, 4), jour(1, 4));
    ab(sarah, 'cp', jour(2, 2), jour(2, 2), 'demandee', { demiFin: true });
    ab(sarah, 'cp', jour(-5, 0), jour(-5, 1), 'annulee');
    ab(thomas, 'rtt', jour(2, 0), jour(2, 0), 'demandee');
    ab(camille, 'rtt', jour(1, 0), jour(1, 0), 'validee');
    ab(thomas, 'cp', jour(6, 0), jour(6, 3), 'validee', { note: 'Fêtes de fin d\'année' });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi des congés et absences · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="20" width="120" height="120" fill="#1D4E89"/>
          <circle cx="220" cy="80" r="60" fill="#F5B400"/>
          <rect x="20" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <path d="M160 280 L160 160 A120 120 0 0 1 280 280 Z" fill="#D9302A"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <path d="M430 150 L430 20 A130 130 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="410" y="130" width="40" height="40" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi des congés et absences</p>
          <h1>Qui est là, qui part, et combien il reste.</h1>
          <p>Les soldes de congés de ton équipe calculés, les demandes à valider en un geste, et le calendrier qui signale quand trop de monde manque en même temps.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi des congés</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton suivi est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi des congés</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi des congés'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, entreprise: '', decompte: 'ouvrables', moisDebut: 6, debutSuivi: '', equipes: [['Équipe', 1], ['', 1], ['', 1]] });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const regTmp = { ...B.reglages, moisDebut: a.moisDebut };
    if (!a.debutSuivi) a.debutSuivi = R.periode(auj(), regTmp).debut;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    const choix = (nom, options, valeur) => `<div class="choix-statut deux">${options.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${String(valeur) === String(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On pose les règles de ton équipe.</h1>
        <p class="intro">Tu saisis tes salariés et leurs absences : les soldes de congés se calculent, les demandes attendent ta validation, et le calendrier signale les chevauchements. Rien n'est envoyé à tes salariés.</p>
        <div class="form-accueil">
          <label class="champ">Ton entreprise <small>Facultatif.</small><input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80"></label>
          <fieldset class="champ"><legend>Décompte des congés <small>Ta convention ou ton usage : les jours ouvrables (lundi au samedi, 30 par an) ou les jours ouvrés (jours travaillés, 25 par an).</small></legend>${choix('decompte', [['ouvrables', 'Jours ouvrables'], ['ouvres', 'Jours ouvrés']], a.decompte)}</fieldset>
          <fieldset class="champ"><legend>Période de référence <small>Du 1er juin au 31 mai par défaut, ou l'année civile si un accord le prévoit.</small></legend>${choix('moisDebut', [[6, '1er juin → 31 mai'], [1, 'Année civile']], a.moisDebut)}</fieldset>
          <label class="champ">Début du suivi <small>Les congés s'acquièrent dans l'outil à partir de cette date ; avant, tu saisis le solde de chaque salarié (reliquat).</small><input id="debutSuivi" type="date" value="${a.debutSuivi}"></label>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes équipes</h1>
        <p class="intro">Une équipe regroupe les personnes qui se remplacent. Indique combien peuvent être absentes en même temps : au-delà, le calendrier et les demandes affichent une alerte. Tu ajouteras les salariés ensuite.</p>
        <ol class="equipes-accueil">${a.equipes.map(([nom, n], i) => `<li><span class="palier-num">${i + 1}</span><label class="champ">Nom de l'équipe<input data-eq-nom="${i}" value="${esc(nom)}" maxlength="40" placeholder="${['Ex. : Atelier', 'Ex. : Bureau', 'Ex. : Commercial'][i]}"></label><label class="champ">Absents en même temps, au plus<input type="number" min="0" max="99" data-eq-max="${i}" value="${n}"></label></li>`).join('')}</ol>
        <p class="aide" style="margin-top:12px;max-width:720px">Laisse un nom vide pour ne pas créer l'équipe. Tout se modifie ensuite dans l'onglet Équipe.</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (e) => { accueil.entreprise = e.target.value; });
    $('#debutSuivi')?.addEventListener('change', (e) => { accueil.debutSuivi = e.target.value; });
    document.querySelectorAll('[name=decompte]').forEach((el) => el.addEventListener('change', () => { accueil.decompte = el.value; }));
    document.querySelectorAll('[name=moisDebut]').forEach((el) => el.addEventListener('change', () => { accueil.moisDebut = Number(el.value); accueil.debutSuivi = R.periode(auj(), { moisDebut: accueil.moisDebut }).debut; ecranAccueil(); }));
    document.querySelectorAll('[data-eq-nom]').forEach((el) => el.addEventListener('input', () => { accueil.equipes[Number(el.dataset.eqNom)][0] = el.value; }));
    document.querySelectorAll('[data-eq-max]').forEach((el) => el.addEventListener('input', () => { accueil.equipes[Number(el.dataset.eqMax)][1] = el.value; }));
  }

  function terminerAccueil() {
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    E.reglages.decompte = accueil.decompte;
    E.reglages.acquisition = { ...B.acquisitions[accueil.decompte] };
    E.reglages.moisDebut = accueil.moisDebut;
    E.reglages.debutSuivi = R.estDate(accueil.debutSuivi) ? accueil.debutSuivi : R.periode(auj(), E.reglages).debut;
    E.equipes = accueil.equipes.filter(([nom]) => String(nom).trim()).map(([nom, n]) => R.normaliserEquipe({ id: uid(), nom: String(nom).trim(), maxAbsents: n }));
    if (!E.equipes.length) E.equipes = [R.normaliserEquipe({ id: uid(), nom: 'Équipe', maxAbsents: 1 })];
    accueil = accueilVide();
    vue = 'equipe';
    sauver();
    demarrer();
    toast('Ton suivi est prêt. Ajoute tes salariés.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    demandes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    equipe: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['demandes', 'Absences'], ['calendrier', 'Calendrier'], ['equipe', 'Équipe']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide au suivi des congés : ce n\'est ni un logiciel de paie ni un conseil juridique. Les soldes sont calculés à partir de ta saisie et des règles des Réglages ; la convention collective, les accords d\'entreprise et le Code du travail font foi.</p>';
  const COULEUR_STATUT = { demandee: 'jaune', validee: 'vert', refusee: 'rouge', annulee: 'sable' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${R.LIB_STATUT[s]}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/conges/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Congés et<br>absences</span>
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
    document.title = `${titres[vue]} · Congés et absences`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, demandes: vueDemandes, calendrier: vueCalendrier, equipe: vueEquipe }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    const def = $('.cal-defile'), th = def?.querySelector('thead th.auj');
    if (def && th) def.scrollLeft = Math.max(0, th.offsetLeft - (def.querySelector('.cal-nom')?.offsetWidth || 0) - 3 * th.offsetWidth);
    const fe = $('#filtre-equipe');
    if (fe) fe.addEventListener('change', (e) => { equipeCal = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';
  const synth = () => R.synthese(E, auj());
  const soldesDe = (id) => R.soldes(salarie(id), E, auj());
  const compteur = (a) => type(a.type)?.decompte;

  // Ligne « jours décomptés et solde » d'une absence.
  function infoSolde(a) {
    const dec = compteur(a);
    const n = nbJours(a);
    if (dec === 'aucun' || !dec) return type(a.type)?.acquiert === 'maladie' ? 'Sans décompte · acquisition réduite pendant l\'arrêt' : 'Sans décompte de congés';
    const s = soldesDe(a.salarie)[dec];
    const u = dec === 'rtt' ? 'j. ouvrés' : unite();
    const apres = a.statut === 'demandee' ? s.solde - n : s.solde;
    return `${jours(n, u)} ${dec === 'rtt' ? 'de RTT' : 'de congés payés'} · solde ${a.statut === 'demandee' ? 'après validation' : 'à ce jour'} : <b class="${apres < 0 ? 'negatif' : ''}">${jours(apres, u)}</b>`;
  }

  // Carte d'une demande à traiter.
  function carteDemande(a) {
    const t = type(a.type);
    const alertes = R.alertesDemande(E, a);
    const sal = salarie(a.salarie);
    const dec = compteur(a);
    const apres = dec && dec !== 'aucun' ? soldesDe(a.salarie)[dec].solde - nbJours(a) : 0;
    return `<article class="carte-demande ${alertes.length ? 'alerte' : ''}">
      <div class="cd-tete">${pastille(t)}<span class="etiquette sable">${esc(t?.nom || 'Absence')}</span>${alertes.length ? `<span class="etiquette rouge">Chevauchement</span>` : ''}${apres < 0 ? '<span class="etiquette rose">Solde insuffisant</span>' : ''}</div>
      <button class="decision-corps" data-action="absence" data-id="${a.id}"><b>${esc(nomSal(a.salarie))}</b><span class="decision-titre">${plage(a)}${a.demiDebut ? ' · à partir de l\'après-midi' : ''}${a.demiFin ? ' · jusqu\'à midi' : ''}</span><span>${nomEquipe(sal?.equipe)} · ${infoSolde(a)}</span></button>
      ${alertes.length ? `<p class="cd-alerte">${pluriel(alertes.length, 'jour')} au-delà du seuil de l'équipe (${equipe(sal?.equipe)?.maxAbsents} absent${equipe(sal?.equipe)?.maxAbsents > 1 ? 's' : ''} au plus) : ${[...new Set(alertes.flatMap((x) => x.salaries))].map((id) => esc(nomSal(id))).join(', ')} ${alertes.length > 1 ? `du ${dateCourte(alertes[0].date)} au ${dateCourte(alertes.at(-1).date)}` : `le ${dateCourte(alertes[0].date)}`}.</p>`.replace('..</p>', '.</p>') : ''}
      ${a.note ? `<p class="cd-note">« ${esc(a.note)} »</p>` : ''}
      <div class="decision-pied"><span class="montant-mini">Demandée le ${dateCourte(a.demandeLe || auj())}</span><span class="rang"><button class="btn petit" data-action="refuser" data-id="${a.id}">Refuser</button><button class="btn petit primaire" data-action="valider" data-id="${a.id}">Valider</button></span></div>
    </article>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const s = synth();
    const ref = jourRef(t);
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}Les demandes à traiter, les absents et les périodes où trop de monde manque.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Saisir une absence</button></div></div>`;
    if (!E.salaries.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun salarié pour l'instant</h3><p>Ajoute tes salariés (prénom, nom, équipe, date d'entrée) et leur solde de départ : les congés acquis se calculent ensuite chaque jour.</p><div class="actions"><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Ajouter un salarié</button></div></div></div>${AVERTISSEMENT}`;
    }
    const absentsRef = E.absences.filter((a) => a.statut === 'validee' && R.couvre(a, ref) && salarie(a.salarie) && R.actif(salarie(a.salarie), ref));
    const actifs = E.salaries.filter((x) => R.actif(x, t));
    const totalCp = actifs.reduce((n, x) => n + soldesDe(x.id).cp.solde, 0);
    const libRef = ref === t ? 'Absents aujourd\'hui' : `Absents ${fmt(ref, { weekday: 'long' })}`;
    const tuiles = [
      [libRef, String(absentsRef.length), `sur ${pluriel(actifs.length, 'salarié')}${ref === t ? '' : ` · ${dateCourte(ref)}`}`, 'var(--bleu)', 'rond'],
      ['Demandes à traiter', String(s.attente.length), s.attente.length ? `la plus proche le ${dateCourte(s.attente[0].debut)}` : 'rien en attente', 'var(--jaune)', ''],
      ['Chevauche&shy;ments', String(s.plages.length), s.plages.length ? `dans les 60 jours · ${pluriel(s.alertes.length, 'jour')} au-delà du seuil` : 'aucun dans les 60 jours', 'var(--rouge)', 'rond'],
      ['Congés à prendre', nombre(Math.round(totalCp * 10) / 10), `${unite()} restants pour l'équipe`, 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const prochaines = [...absentsRef, ...s.aVenir.filter((a) => !absentsRef.includes(a))].slice(0, 8);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À traiter <span>${pluriel(s.attente.length, 'demande')}</span></h2>
          ${s.attente.length ? `<div class="decisions">${s.attente.slice(0, 4).map(carteDemande).join('')}</div>${s.attente.length > 4 ? `<button class="btn lien" data-action="vue" data-vue="demandes">Voir les ${s.attente.length} demandes</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucune demande en attente</h3><p>Les demandes saisies avec le statut « Demandée » arrivent ici pour être validées ou refusées.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Chevauchements <span>60 prochains jours</span></h2>
          ${s.plages.length ? `<ul class="alertes-liste">${s.plages.map((p) => `<li><span class="date-pastille alerte"><b>${versDate(p.debut).getDate()}</b>${fmt(p.debut, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="aller-mois" data-mois="${p.debut.slice(0, 7)}" data-equipe="${p.equipe}"><b>${esc(nomEquipe(p.equipe))} · ${p.pic} absents pour ${p.max} au plus</b><span>${p.debut === p.fin ? dateJour(p.debut) : `${dateCourte(p.debut)} → ${dateCourte(p.fin)}`} · ${p.salaries.map((id) => esc(nomSal(id))).join(', ')}</span></button>${p.enAttente ? '<span class="etiquette jaune">Demande en attente</span>' : '<span class="etiquette rouge">Déjà validé</span>'}</li>`).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun chevauchement</h3><p>Une alerte apparaît quand une équipe dépasse son nombre d\'absents simultanés, demandes en attente comprises.</p></div></div>'}
          <h2 class="titre-section">Absents et prochaines absences</h2>
          ${prochaines.length ? `<ul class="prochains">${prochaines.map((a) => `<li>${pastille(type(a.type))}<button class="lien-ligne" data-action="absence" data-id="${a.id}"><b>${esc(nomSal(a.salarie))}</b><span>${esc(type(a.type)?.nom || '')} · ${plage(a)}</span></button>${R.couvre(a, ref) ? '<span class="etiquette ciel">Absent</span>' : `<span class="nb">dans ${pluriel(R.ecart(t, a.debut), 'jour')}</span>`}</li>`).join('')}</ul>` : '<p class="aide">Aucune absence validée dans les 60 prochains jours.</p>'}
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

  // ---------- Absences (demandes) ----------
  const FILTRES = [['attente', 'À traiter'], ['avenir', 'À venir'], ['encours', 'En cours'], ['passees', 'Passées'], ['refusee', 'Refusées'], ['annulee', 'Annulées'], ['toutes', 'Toutes']];
  function garderFiltre(a, f, t) {
    if (f === 'toutes') return true;
    if (f === 'attente') return a.statut === 'demandee';
    if (f === 'avenir') return a.statut === 'validee' && a.debut > t;
    if (f === 'encours') return a.statut === 'validee' && R.couvre(a, t);
    if (f === 'passees') return a.statut === 'validee' && a.fin < t;
    return a.statut === f;
  }

  function ligneAbsence(a, t) {
    const ty = type(a.type);
    const sal = salarie(a.salarie);
    const dec = compteur(a);
    const n = nbJours(a);
    const alertes = a.statut === 'demandee' || (a.statut === 'validee' && a.fin >= t) ? R.alertesDemande(E, a) : [];
    const tags = [etiquetteStatut(a.statut)];
    if (alertes.length) tags.push('<span class="etiquette rouge">Chevauchement</span>');
    if (a.statut === 'validee' && R.couvre(a, t)) tags.push('<span class="etiquette ciel">En cours</span>');
    if (a.demiDebut || a.demiFin) tags.push('<span class="etiquette sable">Demi-journée</span>');
    return `<li class="ligne-abs st-${a.statut} ${alertes.length ? 'alerte-due' : ''}">
      <button class="ligne-info" data-action="absence" data-id="${a.id}">
        <b>${pastille(ty)} ${esc(nomSal(a.salarie))} <span class="numero">${esc(ty?.nom || '')}</span></b>
        <span class="ligne-detail">${plage(a)} · ${esc(nomEquipe(sal?.equipe))}${a.note ? ` · ${esc(a.note)}` : ''}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${dec && dec !== 'aucun' ? nombre(n) : '–'}</b><small>${dec === 'cp' ? unite() : dec === 'rtt' ? 'j. de RTT' : 'sans décompte'}</small></span>
        ${a.statut === 'demandee' ? `<span class="rang"><button class="btn petit" data-action="refuser" data-id="${a.id}">Refuser</button><button class="btn petit primaire" data-action="valider" data-id="${a.id}">Valider</button></span>` : ''}
      </div>
    </li>`;
  }

  function vueDemandes() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const liste = E.absences.filter((a) => garderFiltre(a, filtre.statut, t) && (!q || `${nomSal(a.salarie)} ${type(a.type)?.nom || ''} ${a.note} ${nomEquipe(salarie(a.salarie)?.equipe)}`.toLowerCase().includes(q)))
      .sort((x, y) => (filtre.statut === 'passees' || filtre.statut === 'toutes' ? y.debut.localeCompare(x.debut) : x.debut.localeCompare(y.debut)));
    const nb = (id) => E.absences.filter((a) => garderFiltre(a, id, t)).length;
    return `
      <div class="vue-tete"><div><h1>Absences</h1><p>Demandes à valider, congés posés et absences passées. Ouvre une ligne pour la modifier ou changer son statut.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Saisir une absence</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer">${FILTRES.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Salarié, équipe, type, note" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<p class="resume-liste">${pluriel(liste.length, 'absence')}</p><ul class="lignes-abs">${liste.map((a) => ligneAbsence(a, t)).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.absences.length ? 'Aucune absence ne correspond' : 'Aucune absence saisie'}</h3><p>${E.absences.length ? 'Change le filtre ou la recherche.' : 'Saisis une demande de congé ou une absence.'}</p><div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Saisir une absence</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Calendrier d'équipe ----------
  const JOURS_INIT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  function vueCalendrier() {
    const t = auj();
    if (!moisCal) moisCal = t.slice(0, 7);
    const [an, mo] = moisCal.split('-').map(Number);
    const nbj = R.joursDansMois(an, mo);
    const dates = Array.from({ length: nbj }, (_, i) => `${moisCal}-${String(i + 1).padStart(2, '0')}`);
    const reg = E.reglages;
    const libMois = versDate(`${moisCal}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const equipes = E.equipes.filter((eq) => !equipeCal || eq.id === equipeCal);
    const occupe = E.absences.filter((a) => R.OCCUPE.includes(a.statut) && a.fin >= dates[0] && a.debut <= dates.at(-1));
    const tete = `<tr><th class="cal-nom" scope="col"><span class="sr-only">Salarié</span></th>${dates.map((d) => { const f = R.ferieChome(d, reg); const cls = [R.estOuvre(d, reg) ? '' : 'repos', f ? 'ferie' : '', d === t ? 'auj' : ''].join(' '); return `<th scope="col" class="${cls}" ${f ? `title="${esc(f.nom)}"` : ''}><small>${JOURS_INIT[R.jourSemaine(d)]}</small>${Number(d.slice(8))}</th>`; }).join('')}</tr>`;
    let corps = '';
    for (const eq of [...equipes, ...(equipeCal ? [] : [{ id: '', nom: 'Sans équipe', maxAbsents: null }])]) {
      const sals = E.salaries.filter((s) => (s.equipe || '') === eq.id && (!s.entree || s.entree <= dates.at(-1)) && (!s.sortie || s.sortie >= dates[0])).sort((a, b) => a.prenom.localeCompare(b.prenom));
      if (!sals.length && !eq.id) continue;
      corps += `<tr class="cal-equipe"><th scope="rowgroup" colspan="${nbj + 1}">${esc(eq.nom)}${eq.maxAbsents !== null ? ` <span>${eq.maxAbsents} absent${eq.maxAbsents > 1 ? 's' : ''} au plus</span>` : ''}</th></tr>`;
      for (const s of sals) {
        corps += `<tr><th scope="row" class="cal-nom"><button class="lien-ligne" data-action="salarie" data-id="${s.id}"><b>${esc(s.prenom)} ${esc(s.nom.slice(0, 1))}.</b></button></th>${dates.map((d) => {
          const hors = (s.entree && d < s.entree) || (s.sortie && d > s.sortie);
          const a = hors ? null : occupe.find((x) => x.salarie === s.id && R.couvre(x, d));
          const base = [R.estOuvre(d, reg) ? '' : 'repos', R.ferieChome(d, reg) ? 'ferie' : '', d === t ? 'auj' : '', hors ? 'hors' : ''].join(' ');
          if (!a) return `<td class="${base}">${hors || !R.estOuvre(d, reg) ? '' : `<button class="cal-vide" data-action="nouvelle" data-salarie="${s.id}" data-date="${d}" aria-label="Saisir une absence pour ${esc(s.prenom)} le ${dateLongue(d)}" tabindex="-1"></button>`}</td>`;
          const ty = type(a.type), c = couleur(ty);
          const demi = (a.demiDebut && d === a.debut) ? 'demi-apres' : (a.demiFin && d === a.fin) ? 'demi-matin' : '';
          const info = `<b>${esc(nomSal(s.id))}</b>${esc(ty?.nom || '')} · ${R.LIB_STATUT[a.statut]}<br>${plage(a)}${demi ? ' · demi-journée' : ''}`;
          return `<td class="${base}"><button class="cal-abs ${a.statut} ${demi}" style="--f:${c.fond};--t:${c.texte}" data-action="absence" data-id="${a.id}" data-info="${esc(info)}" aria-label="${esc(`${nomSal(s.id)}, ${ty?.nom || ''}, ${R.LIB_STATUT[a.statut]}, ${dateLongue(d)}`)}" ${d === a.debut || d === dates[0] ? '' : 'tabindex="-1"'}>${R.estOuvre(d, reg) ? esc(ty?.lettre || '') : ''}</button></td>`;
        }).join('')}</tr>`;
      }
      if (eq.id) {
        corps += `<tr class="cal-total"><th scope="row" class="cal-nom">Absents</th>${dates.map((d) => {
          if (!R.estOuvre(d, reg)) return `<td class="repos ${R.ferieChome(d, reg) ? 'ferie' : ''}"></td>`;
          const n = new Set(R.absentsLe(E, d, { equipe: eq.id }).map((x) => x.salarie)).size;
          return `<td class="${n > eq.maxAbsents ? 'depasse' : ''} ${d === t ? 'auj' : ''}">${n || ''}${n > eq.maxAbsents ? '<span class="sr-only"> : au-delà du seuil</span>' : ''}</td>`;
        }).join('')}</tr>`;
      }
    }
    const feriesMois = dates.map((d) => R.ferieChome(d, reg)).filter(Boolean);
    const listeMois = occupe.filter((a) => !equipeCal || salarie(a.salarie)?.equipe === equipeCal).sort((x, y) => x.debut.localeCompare(y.debut));
    return `
      <div class="vue-tete"><div><h1>Calendrier</h1><p>Les absences de l'équipe mois par mois. Les demandes en attente sont hachurées ; la ligne « Absents » passe en rouge au-delà du seuil de l'équipe.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Saisir une absence</button></div></div>
      <div class="cal-outils">
        <div class="rang"><button class="btn petit" data-action="mois" data-pas="-1" aria-label="Mois précédent">‹</button><h2 class="cal-mois">${libMois}</h2><button class="btn petit" data-action="mois" data-pas="1" aria-label="Mois suivant">›</button>${moisCal !== t.slice(0, 7) ? '<button class="btn petit" data-action="mois" data-pas="0">Aujourd\'hui</button>' : ''}</div>
        <label class="champ choix-equipe"><span class="sr-only">Équipe</span><select id="filtre-equipe"><option value="">Toutes les équipes</option>${E.equipes.map((eq) => `<option value="${eq.id}" ${eq.id === equipeCal ? 'selected' : ''}>${esc(eq.nom)}</option>`).join('')}</select></label>
      </div>
      ${E.salaries.length ? `<figure class="graphique cal-cadre"><div class="cal-defile" tabindex="0" aria-label="Calendrier de ${esc(libMois)}, défilement horizontal"><table class="cal"><caption class="sr-only">Absences de ${esc(libMois)}</caption><thead>${tete}</thead><tbody>${corps}</tbody></table></div><div class="infobulle" hidden></div></figure>
      <ul class="legende">${E.types.map((ty) => `<li>${pastille(ty)}${esc(ty.nom)}</li>`).join('')}<li><span class="pastille-type hachure" aria-hidden="true"></span>Demande en attente</li><li><span class="pastille-type demi" aria-hidden="true"></span>Demi-journée</li></ul>
      ${feriesMois.length ? `<p class="aide">Férié${feriesMois.length > 1 ? 's' : ''} chômé${feriesMois.length > 1 ? 's' : ''} ce mois-ci : ${feriesMois.map((f) => `${esc(f.nom)} (${dateCourte(f.date)})`).join(', ')}.</p>` : ''}
      <details class="tableau-details"><summary>Voir la liste du mois (${pluriel(listeMois.length, 'absence')})</summary><div class="defile"><table class="tableau"><thead><tr><th>Salarié</th><th>Type</th><th>Dates</th><th>Statut</th><th class="nb">Jours</th></tr></thead><tbody>${listeMois.map((a) => `<tr><td>${esc(nomSal(a.salarie))}</td><td>${esc(type(a.type)?.nom || '')}</td><td>${plage(a)}</td><td>${R.LIB_STATUT[a.statut]}</td><td class="nb">${compteur(a) === 'aucun' ? '–' : nombre(nbJours(a))}</td></tr>`).join('') || '<tr><td colspan="5">Aucune absence ce mois-ci.</td></tr>'}</tbody></table></div></details>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun salarié</h3><p>Ajoute tes salariés dans l'onglet Équipe pour voir le calendrier.</p><div class="actions"><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Ajouter un salarié</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Équipe ----------
  function vueEquipe() {
    const t = auj();
    const ref = jourRef(t);
    const groupes = [...E.equipes, { id: '', nom: 'Sans équipe', maxAbsents: null }].map((eq) => ({ eq, sals: E.salaries.filter((s) => (s.equipe || '') === eq.id).sort((a, b) => Number(!!a.sortie && a.sortie < t) - Number(!!b.sortie && b.sortie < t) || a.prenom.localeCompare(b.prenom)) })).filter((g) => g.eq.id || g.sals.length);
    const ligne = (s) => {
      const so = R.soldes(s, E, t);
      const parti = s.sortie && s.sortie < t;
      const absent = E.absences.find((a) => a.salarie === s.id && a.statut === 'validee' && R.couvre(a, ref));
      const attente = E.absences.filter((a) => a.salarie === s.id && a.statut === 'demandee').length;
      return `<li class="ligne-abs ${parti || s.efface ? 'st-annulee' : ''}">
        <button class="ligne-info" data-action="salarie" data-id="${s.id}"><b>${esc(s.prenom)} ${esc(s.nom)}</b>
          <span class="ligne-detail">${s.entree ? `Entrée le ${fmt(s.entree)}` : 'Date d\'entrée non renseignée'}${s.sortie ? ` · ${parti ? 'sorti' : 'départ prévu'} le ${fmt(s.sortie)}` : ''}${s.rttAnnuel ? ` · ${nombre(s.rttAnnuel)} RTT par an` : ''}</span>
          <span class="ligne-etiquettes">${s.efface ? '<span class="etiquette sable">Données effacées</span>' : ''}${absent ? `<span class="etiquette ciel">${esc(type(absent.type)?.nom || 'Absent')}</span>` : ''}${attente ? `<span class="etiquette jaune">${pluriel(attente, 'demande')} en attente</span>` : ''}${so.cp.solde < 0 ? '<span class="etiquette rose">Solde négatif</span>' : ''}${parti ? '<span class="etiquette sable">Sorti</span>' : ''}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b class="${so.cp.solde < 0 ? 'negatif' : ''}">${nombre(so.cp.solde)}</b><small>${unite()} de CP</small></span>${s.rttAnnuel || so.rtt.solde ? `<span class="ligne-proch">${nombre(so.rtt.solde)} j. de RTT</span>` : ''}${parti ? (so.cp.solde > 0 ? '<span class="ligne-proch">Solde à régler au départ</span>' : '') : `<button class="btn petit" data-action="nouvelle" data-salarie="${s.id}">Absence</button>`}</div>
      </li>`;
    };
    const p = R.periode(t, E.reglages);
    return `
      <div class="vue-tete"><div><h1>Équipe</h1><p>Soldes à ce jour en ${E.reglages.decompte === 'ouvres' ? 'jours ouvrés' : 'jours ouvrables'}, période ${R.libellePeriode(p)} (du ${dateCourte(p.debut)} au ${fmt(p.fin)}). Ouvre un salarié pour le détail de l'acquisition et ses données.</p></div>
        <div class="actions"><button class="btn" data-action="nouvelle-equipe">${ICONES.plus}Équipe</button><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Ajouter un salarié</button></div></div>
      ${E.salaries.length ? groupes.map(({ eq, sals }) => `<section class="groupe-cat">
        <h2 class="titre-cat">${eq.id ? `<button class="lien-ligne" data-action="equipe" data-id="${eq.id}"><b>${esc(eq.nom)}</b></button>` : esc(eq.nom)} <span>${pluriel(sals.length, 'salarié')}${eq.maxAbsents !== null ? ` · ${eq.maxAbsents} absent${eq.maxAbsents > 1 ? 's' : ''} au plus en même temps` : ''}</span>${eq.id ? `<button class="btn petit" data-action="equipe" data-id="${eq.id}">Modifier</button>` : ''}</h2>
        ${sals.length ? `<ul class="lignes-abs">${sals.map(ligne).join('')}</ul>` : '<p class="aide">Aucun salarié dans cette équipe.</p>'}
      </section>`).join('') : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun salarié</h3><p>Le minimum : prénom, nom, équipe et date d'entrée. Ajoute son solde de congés au début du suivi s'il en avait.</p><div class="actions"><button class="btn primaire" data-action="nouveau-salarie">${ICONES.plus}Ajouter un salarié</button></div></div></div>`}
      <div class="rgpd"><h2>Données personnelles de tes salariés</h2><p>Garde le minimum : prénom, nom, équipe, dates d'entrée et de sortie, absences. <b>Aucune donnée de santé</b> : le type « Arrêt maladie » suffit, sans motif ni pièce ; les notes de ces types sont désactivées. Informe tes salariés que leurs absences sont suivies ici. Ouvre un salarié pour <b>exporter ses données</b> (droit d'accès), les <b>effacer</b> (le nom est remplacé, les dates restent pour des soldes justes) ou le <b>supprimer avec ses absences</b>. Les durées de conservation dépendent de tes obligations sociales : à vérifier avec ton gestionnaire de paie.</p></div>
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

  // Saisie ou modification d'une absence.
  function modaleAbsence(id, { salarieId = '', date = '' } = {}) {
    const t = auj();
    const a = id ? absence(id) : null;
    if (id && !a) return;
    const actifs = E.salaries.filter((s) => !s.sortie || s.sortie >= t || s.id === a?.salarie);
    if (!actifs.length) { toast('Ajoute d\'abord un salarié dans l\'onglet Équipe.'); return; }
    const debut = date || ajout(t, 1);
    const v = a || { salarie: salarieId || actifs[0].id, type: E.types[0]?.id, debut, fin: debut, demiDebut: false, demiFin: false, statut: 'demandee', note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Salarié<select name="salarie">${actifs.map((s) => `<option value="${s.id}" ${s.id === v.salarie ? 'selected' : ''}>${esc(s.prenom)} ${esc(s.nom)} · ${esc(nomEquipe(s.equipe))}</option>`).join('')}</select></label>
        <label class="champ">Type<select name="type">${E.types.map((ty) => `<option value="${ty.id}" ${ty.id === v.type ? 'selected' : ''}>${esc(ty.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Du<input type="date" name="debut" required value="${v.debut}"></label>
        <label class="champ">Au (inclus)<input type="date" name="fin" required value="${v.fin}"></label>
      </div>
      <div class="cases"><label class="case"><input type="checkbox" name="demiDebut" ${v.demiDebut ? 'checked' : ''}> Commence l'après-midi</label><label class="case"><input type="checkbox" name="demiFin" ${v.demiFin ? 'checked' : ''}> S'arrête à midi</label></div>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut quatre">${R.STATUTS.map((s) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>
      <div id="apercu-absence" class="apercu" aria-live="polite"></div>
      <label class="champ" id="champ-note">Note <small>Facultative. Jamais de motif médical ni d'information de santé.</small><input name="note" maxlength="160" value="${esc(v.note)}"></label>
      <p class="mention" id="note-sante" hidden>Pas de note pour ce type : aucune information de santé n'est enregistrée, le type suffit.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = a
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(a ? 'Modifier l\'absence' : 'Nouvelle absence', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer cette absence de ${nomSal(a.salarie)} ? Mieux vaut l'annuler si elle a été validée : l'historique reste.`)) { garderOuverte(); return; }
        retenir();
        E.absences = E.absences.filter((x) => x.id !== a.id);
        sauver(); rendre(); toast('Absence supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const brut = lireAbsence(fd, a);
      if (typeof brut === 'string') return brut;
      const conflit = R.conflitPersonnel(E, brut);
      if (conflit && R.OCCUPE.includes(brut.statut)) return `${nomSal(brut.salarie)} a déjà une absence ${R.LIB_STATUT[conflit.statut].toLowerCase()} sur ces dates (${plage(conflit)}).`;
      retenir();
      if (a) Object.assign(a, brut); else E.absences.push(brut);
      sauver(); rendre();
      toast(a ? 'Absence enregistrée.' : `${type(brut.type)?.nom || 'Absence'} de ${nomSal(brut.salarie)} : ${plage(brut)} (${R.LIB_STATUT[brut.statut].toLowerCase()}).`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const majApercu = () => {
      const fd = new FormData(d.querySelector('form'));
      const ty = type(fd.get('type'));
      d.querySelector('#champ-note').hidden = !!ty?.sante;
      d.querySelector('#note-sante').hidden = !ty?.sante;
      const brut = lireAbsence(fd, a);
      const zone = d.querySelector('#apercu-absence');
      if (typeof brut === 'string') { zone.innerHTML = ''; return; }
      const alertes = R.OCCUPE.includes(brut.statut) ? R.alertesDemande(E, brut) : [];
      const conflit = R.conflitPersonnel(E, brut);
      const dec = ty?.decompte;
      let html = '';
      if (dec && dec !== 'aucun') {
        const so = R.soldes(salarie(brut.salarie), { ...E, absences: E.absences.filter((x) => x.id !== brut.id) }, t)[dec];
        const n = R.decompte(brut, E.types, E.reglages);
        const u = dec === 'rtt' ? 'j. ouvrés' : unite();
        const apres = so.solde - n;
        html += `<p><b>${jours(n, u)}</b> décomptés ${dec === 'rtt' ? 'sur les RTT' : 'sur les congés payés'} · solde avant : ${jours(so.solde, u)}, après : <b class="${apres < 0 ? 'negatif' : ''}">${jours(apres, u)}</b>${apres < 0 ? ' (congés pris par anticipation)' : ''}.</p>`;
      } else html += `<p>${ty?.acquiert === 'maladie' ? 'Sans décompte. Pendant l\'arrêt, les congés s\'acquièrent au rythme « maladie » des Réglages.' : ty?.acquiert === 'non' ? 'Sans décompte. Aucun congé ne s\'acquiert pendant cette absence.' : 'Sans décompte de congés ; la période compte pour l\'acquisition.'}</p>`;
      if (conflit) html += `<p class="negatif">Déjà absent sur ces dates : ${esc(type(conflit.type)?.nom || '')}, ${plage(conflit)}.</p>`;
      if (alertes.length) html += `<p class="cd-alerte">Chevauchement dans l'équipe ${esc(nomEquipe(salarie(brut.salarie)?.equipe))} : ${pluriel(alertes.length, 'jour')} au-delà de ${alertes[0].max} absent${alertes[0].max > 1 ? 's' : ''} (${[...new Set(alertes.flatMap((x) => x.salaries))].map((sid) => esc(nomSal(sid))).join(', ')}).</p>`;
      zone.innerHTML = html;
    };
    d.querySelectorAll('input,select').forEach((el) => el.addEventListener('change', majApercu));
    const de = d.querySelector('[name=debut]'), fi = d.querySelector('[name=fin]');
    de.addEventListener('change', () => { if (R.estDate(de.value) && (!R.estDate(fi.value) || fi.value < de.value)) { fi.value = de.value; majApercu(); } });
    d.querySelector('[name=type]').addEventListener('change', (e) => {
      if (a) return;
      const ty = type(e.target.value);
      const radio = d.querySelector(`[name=statut][value=${ty?.demande === false ? 'validee' : 'demandee'}]`);
      if (radio) radio.checked = true;
      majApercu();
    });
    majApercu();
  }

  function lireAbsence(fd, a) {
    const debut = fd.get('debut'), fin = fd.get('fin');
    if (!salarie(fd.get('salarie'))) return 'Choisis un salarié.';
    if (!type(fd.get('type'))) return 'Choisis un type d\'absence.';
    if (!R.estDate(debut) || !R.estDate(fin)) return 'Indique les dates de début et de fin.';
    if (fin < debut) return 'La fin ne peut pas précéder le début.';
    if (R.ecart(debut, fin) > 366) return 'Une absence de plus d\'un an : découpe-la en plusieurs périodes.';
    const statut = R.STATUTS.includes(fd.get('statut')) ? fd.get('statut') : 'demandee';
    const ty = type(fd.get('type'));
    return R.normaliserAbsence({
      ...(a || {}), id: a?.id || uid(), salarie: fd.get('salarie'), type: ty.id, debut, fin,
      demiDebut: !!fd.get('demiDebut'), demiFin: !!fd.get('demiFin'), statut,
      note: ty.sante ? '' : String(fd.get('note') || '').trim(),
      demandeLe: a?.demandeLe || auj(), decideLe: statut === 'demandee' ? null : (a?.statut === statut ? a.decideLe : auj()),
    });
  }

  function changerStatut(id, statut) {
    const a = absence(id);
    if (!a) return;
    const n = R.changerStatut(a, statut, auj());
    if (!n) return;
    if (statut === 'validee') {
      const conflit = R.conflitPersonnel(E, n);
      if (conflit) { toast(`Impossible : ${nomSal(a.salarie)} est déjà absent sur ces dates.`); return; }
      const alertes = R.alertesDemande(E, n);
      if (alertes.length && !confirm(`Valider malgré le chevauchement ? L'équipe ${nomEquipe(salarie(a.salarie)?.equipe)} dépassera son seuil sur ${pluriel(alertes.length, 'jour')}.`)) return;
    }
    retenir();
    Object.assign(a, n);
    sauver(); rendre();
    toast(`${type(a.type)?.nom || 'Absence'} de ${nomSal(a.salarie)} ${{ validee: 'validée', refusee: 'refusée', annulee: 'annulée', demandee: 'remise en attente' }[statut]}.`, { libelle: 'Annuler', faire: annuler });
  }

  // Fiche d'un salarié : identité, soldes détaillés, ajustements, données personnelles.
  function modaleSalarie(id) {
    const t = auj();
    const s = id ? salarie(id) : null;
    const v = s || { prenom: '', nom: '', equipe: E.equipes[0]?.id || '', entree: '', sortie: '', rttAnnuel: 0, reliquatCp: 0, reliquatRtt: 0, ajustements: [] };
    let detail = '';
    if (s) {
      const so = R.soldes(s, E, t);
      const u = unite();
      const lignesAcq = so.cp.acquisitions.map((x) => `<tr><td>${R.libellePeriode(x.periode)}${x.complete ? '' : ' (en cours)'}</td><td class="nb">${x.debut <= x.fin ? `${dateCourte(x.debut)} → ${dateCourte(x.fin)}` : '–'}</td><td class="nb">${nombre(x.normal)}</td><td class="nb">${nombre(x.maladie)}${x.maladiePlafonnee ? ' *' : ''}</td><td class="nb"><b>${nombre(x.acquis)}</b></td></tr>`).join('');
      detail = `
      <section class="bloc-detail"><h3>Congés payés <span class="${so.cp.solde < 0 ? 'negatif' : ''}">${jours(so.cp.solde, u)}</span></h3>
        <p class="ligne-somme"><span>Solde au début du suivi (reliquat)</span><b>${nombre(so.cp.reliquat)}</b></p>
        <p class="ligne-somme"><span>Acquis des périodes closes</span><b>${nombre(so.cp.anterieurs)}</b></p>
        <p class="ligne-somme"><span>Acquis de la période en cours, à ce jour</span><b>${nombre(so.cp.enCours)}</b></p>
        ${so.cp.ajust ? `<p class="ligne-somme"><span>Ajustements</span><b>${nombre(so.cp.ajust)}</b></p>` : ''}
        <p class="ligne-somme"><span>Pris</span><b>−${nombre(so.cp.pris)}</b></p>
        <p class="ligne-somme"><span>Posés à venir (validés)</span><b>−${nombre(so.cp.poses)}</b></p>
        <p class="ligne-somme total"><span>Solde disponible</span><b>${jours(so.cp.solde, u)}</b></p>
        ${so.cp.attente ? `<p class="mention">${jours(so.cp.attente, u)} en attente de validation : ${jours(so.cp.apresDemandes, u)} si tout est validé.</p>` : ''}
        <p class="mention">Fin de la période ${R.libellePeriode(so.cp.periode)} (${fmt(so.cp.periode.fin)}) : ${jours(so.cp.projectionPeriode, u)} acquis sur la période si rien ne change.</p>
        <details class="champs-aide"><summary>Détail de l'acquisition</summary><div class="defile"><table class="tableau petit"><thead><tr><th>Période</th><th class="nb">Dates</th><th class="nb">Travail</th><th class="nb">Maladie</th><th class="nb">Acquis</th></tr></thead><tbody>${lignesAcq}</tbody></table></div><p class="mention">Prorata des jours de chaque mois : ${nombre(E.reglages.acquisition.mois)} par mois travaillé, ${nombre(E.reglages.acquisition.maladieMois)} par mois d'arrêt maladie${so.cp.acquisitions.some((x) => x.maladiePlafonnee) ? ' (* plafond atteint)' : ''}, ${nombre(E.reglages.acquisition.plafond)} au plus${E.reglages.arrondiSup ? ', arrondi supérieur à la clôture' : ''}.</p></details>
      </section>
      <section class="bloc-detail"><h3>RTT <span>${jours(so.rtt.solde, 'j. ouvrés')}</span></h3>
        <p class="mention">${s.rttAnnuel ? `${nombre(s.rttAnnuel)} jours par an, ${E.reglages.rttMode === 'annuel' ? 'crédités au 1er janvier' : 'acquis au fil de l\'année'} : ${nombre(so.rtt.acquis)} acquis depuis le début du suivi ; pris : ${nombre(so.rtt.pris)}, posés à venir : ${nombre(so.rtt.poses)}${so.rtt.reliquat ? `, reliquat ${nombre(so.rtt.reliquat)}` : ''}${so.rtt.ajust ? `, ajustements ${nombre(so.rtt.ajust)}` : ''}.` : 'Aucun RTT prévu pour ce salarié.'}</p>
      </section>
      <section class="bloc-detail"><h3>Ajustements ${s.ajustements.length ? `<span>${pluriel(s.ajustements.length, 'ligne')}</span>` : ''}</h3>
        ${s.ajustements.length ? `<ul class="mini-liste">${[...s.ajustements].sort((x, y) => x.date.localeCompare(y.date)).map((x) => `<li><span>${fmt(x.date)} · ${x.compteur === 'rtt' ? 'RTT' : 'Congés payés'}${x.motif ? ` · ${esc(x.motif)}` : ''}</span><b>${x.jours > 0 ? '+' : ''}${nombre(x.jours)}</b><button type="button" class="btn-suppr" data-action="suppr-ajustement" data-id="${s.id}" data-p="${x.id}" aria-label="Supprimer cet ajustement">×</button></li>`).join('')}</ul>` : '<p class="mention">Jours de fractionnement, congés conventionnels, correction : ajoute-les ici.</p>'}
        <div class="rang"><button type="button" class="btn petit" data-action="ajustement" data-id="${s.id}">${ICONES.plus}Ajouter un ajustement</button></div>
      </section>
      <div class="groupe"><h3>Données personnelles</h3><p class="aide">« Exporter » télécharge sa fiche, ses absences et ses soldes (droit d'accès). « Effacer » remplace le prénom et le nom et vide les notes ; dates et types restent. « Supprimer » retire le salarié et toutes ses absences.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter-salarie" data-id="${s.id}">Exporter ses données</button><button class="btn petit" type="button" data-action="effacer-salarie" data-id="${s.id}" ${s.efface ? 'disabled' : ''}>Effacer les données</button><button class="btn petit danger" type="button" data-action="supprimer-salarie" data-id="${s.id}">Supprimer avec ses absences</button></div></div>`;
    }
    const corps = `
      <div class="rang-champs">
        <label class="champ">Prénom<input name="prenom" maxlength="40" required value="${esc(v.prenom)}" autocomplete="off"></label>
        <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(v.nom)}" autocomplete="off"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Équipe<select name="equipe">${E.equipes.map((eq) => `<option value="${eq.id}" ${eq.id === v.equipe ? 'selected' : ''}>${esc(eq.nom)}</option>`).join('')}<option value="" ${v.equipe ? '' : 'selected'}>Sans équipe</option></select></label>
        <label class="champ">RTT par an <small>0 si aucun.</small><input name="rttAnnuel" inputmode="decimal" value="${nombre(v.rttAnnuel)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Entrée<input type="date" name="entree" value="${v.entree || ''}"></label>
        <label class="champ">Sortie <small>Facultative.</small><input type="date" name="sortie" value="${v.sortie || ''}"></label>
      </div>
      <fieldset class="champ cadre-champs"><legend>Solde au début du suivi (${fmt(E.reglages.debutSuivi || t)}) <small>Ce qui restait à prendre avant l'outil, d'après ton dernier bulletin de paie. Négatif si des congés ont été pris par anticipation.</small></legend>
        <div class="rang-champs">
          <label class="champ">Congés payés (${unite()})<input name="reliquatCp" inputmode="decimal" value="${nombre(v.reliquatCp)}"></label>
          <label class="champ">RTT (j. ouvrés)<input name="reliquatRtt" inputmode="decimal" value="${nombre(v.reliquatRtt)}"></label>
        </div>
      </fieldset>
      ${detail}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? esc(`${s.prenom} ${s.nom}`) : 'Nouveau salarié', corps, `<button class="btn primaire" value="ok">${s ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${s ? `<button class="btn gauche" type="button" data-action="nouvelle" data-salarie="${s.id}">Saisir une absence</button>` : ''}`, (fd) => {
      const prenom = String(fd.get('prenom') || '').trim();
      if (!prenom) return 'Indique au moins un prénom.';
      const entree = fd.get('entree'), sortie = fd.get('sortie');
      if (entree && !R.estDate(entree)) return 'Date d\'entrée illisible.';
      if (sortie && (!R.estDate(sortie) || (entree && sortie < entree))) return 'La sortie doit suivre l\'entrée.';
      const rtt = R.lireNombre(fd.get('rttAnnuel') || '0');
      const rcp = R.lireNombre(fd.get('reliquatCp') || '0', { negatif: true });
      const rrt = R.lireNombre(fd.get('reliquatRtt') || '0', { negatif: true });
      if (rtt === null || rtt > 60) return 'RTT par an : un nombre entre 0 et 60.';
      if (rcp === null || rrt === null) return 'Solde illisible : écris par exemple 12,5.';
      retenir();
      const d = R.normaliserSalarie({ ...(s || {}), id: s?.id || uid(), prenom, nom: String(fd.get('nom') || '').trim(), equipe: fd.get('equipe') || '', entree: entree || null, sortie: sortie || null, rttAnnuel: rtt, reliquatCp: rcp, reliquatRtt: rrt, efface: s?.efface && prenom === s.prenom });
      if (s) Object.assign(s, d); else E.salaries.push(d);
      sauver(); rendre(); toast(`${prenom} enregistré${s ? '' : ' dans l\'équipe'}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleAjustement(id) {
    const s = salarie(id);
    if (!s) return;
    ouvrirModale(`Ajustement · ${esc(s.prenom)}`, `
      <fieldset class="champ"><legend>Compteur</legend><div class="choix-statut deux"><label><input type="radio" name="compteur" value="cp" checked><span>Congés payés</span></label><label><input type="radio" name="compteur" value="rtt"><span>RTT</span></label></div></fieldset>
      <div class="rang-champs">
        <label class="champ">Jours <small>Négatif pour retirer.</small><input name="jours" inputmode="decimal" required placeholder="Ex. : 2 ou -0,5"></label>
        <label class="champ">Date<input type="date" name="date" value="${auj()}" required></label>
      </div>
      <label class="champ">Motif <small>Ex. : jours de fractionnement, congé d'ancienneté, correction.</small><input name="motif" maxlength="120"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const n = R.lireNombre(fd.get('jours'), { negatif: true });
      if (n === null || n === 0 || Math.abs(n) > 100) return 'Nombre de jours illisible : écris par exemple 2 ou -0,5.';
      if (!R.estDate(fd.get('date'))) return 'Indique une date.';
      retenir();
      s.ajustements.push({ id: uid(), date: fd.get('date'), compteur: fd.get('compteur') === 'rtt' ? 'rtt' : 'cp', jours: n, motif: String(fd.get('motif') || '').trim() });
      sauver(); rendre();
      garderOuverte(); modaleSalarie(s.id);
      toast('Ajustement ajouté.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEquipe(id) {
    const eq = id ? equipe(id) : null;
    const n = eq ? E.salaries.filter((s) => s.equipe === eq.id).length : 0;
    const v = eq || { nom: '', maxAbsents: 1 };
    ouvrirModale(eq ? 'Équipe' : 'Nouvelle équipe', `
      <label class="champ">Nom<input name="nom" maxlength="40" required value="${esc(v.nom)}"></label>
      <label class="champ">Absents en même temps, au plus <small>Au-delà, alerte sur les demandes et dans le calendrier (jours ouvrés, demandes en attente comprises).</small><input type="number" name="maxAbsents" min="0" max="99" value="${v.maxAbsents}"></label>
      ${eq ? `<p class="mention">${pluriel(n, 'salarié')} dans cette équipe.${n ? ' Pour la supprimer, déplace d\'abord ses salariés.' : ''}</p>` : ''}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${eq ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${eq && !n ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') { retenir(); E.equipes = E.equipes.filter((x) => x.id !== eq.id); if (equipeCal === eq.id) equipeCal = ''; sauver(); rendre(); toast(`Équipe « ${eq.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return; }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'équipe.';
      const m = Math.round(Number(fd.get('maxAbsents')));
      if (!(m >= 0 && m <= 99)) return 'Le seuil doit être entre 0 et 99.';
      retenir();
      const d = R.normaliserEquipe({ id: eq?.id || uid(), nom, maxAbsents: m });
      if (eq) Object.assign(eq, d); else E.equipes.push(d);
      sauver(); rendre(); toast(`Équipe « ${nom} » enregistrée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleType(id) {
    const ty = id ? type(id) : null;
    const v = ty || { nom: '', lettre: '', decompte: 'aucun', acquiert: 'oui', couleur: E.types.length % B.couleurs.length, demande: true, sante: false };
    const utilise = ty ? E.absences.filter((a) => a.type === ty.id).length : 0;
    const radios = (nom, opts, val) => `<div class="choix-statut trois">${opts.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${val === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    ouvrirModale(ty ? 'Type d\'absence' : 'Nouveau type d\'absence', `
      <div class="rang-champs"><label class="champ">Nom<input name="nom" maxlength="40" required value="${esc(v.nom)}"></label><label class="champ" style="flex:0 1 110px">Lettre<input name="lettre" maxlength="2" value="${esc(v.lettre)}"></label></div>
      <fieldset class="champ"><legend>Décompté sur</legend>${radios('decompte', [['cp', 'Congés payés'], ['rtt', 'RTT'], ['aucun', 'Rien']], v.decompte)}</fieldset>
      <fieldset class="champ"><legend>Pendant cette absence, les congés payés <small>« Comme maladie » : rythme de l'arrêt maladie non professionnel (Réglages).</small></legend>${radios('acquiert', [['oui', 'S\'acquièrent'], ['maladie', 'Comme maladie'], ['non', 'Ne s\'acquièrent pas']], v.acquiert)}</fieldset>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${v.couleur === i ? 'checked' : ''}><span style="--c:${c.fond}"></span></label>`).join('')}</div></fieldset>
      <div class="cases"><label class="case"><input type="checkbox" name="demande" ${v.demande ? 'checked' : ''}> Passe par une demande à valider</label><label class="case"><input type="checkbox" name="sante" ${v.sante ? 'checked' : ''}> Liée à la santé (aucune note)</label></div>
      ${utilise ? `<p class="mention">${pluriel(utilise, 'absence')} de ce type : il ne peut pas être supprimé.</p>` : ''}
      <p class="erreur" role="alert"></p>`,
    `<button class="btn primaire" value="ok">${ty ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${ty && !utilise && E.types.length > 1 ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') { retenir(); E.types = E.types.filter((x) => x.id !== ty.id); sauver(); rendre(); toast(`Type « ${ty.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler }); garderOuverte(); modaleReglages(); return; }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au type.';
      retenir();
      const d = R.normaliserType({ id: ty?.id || uid(), nom, lettre: String(fd.get('lettre') || '').trim().toUpperCase() || nom.slice(0, 1).toUpperCase(), decompte: fd.get('decompte'), acquiert: fd.get('acquiert'), couleur: Number(fd.get('couleur')), demande: !!fd.get('demande'), sante: !!fd.get('sante') }, 0, B.couleurs);
      if (ty) Object.assign(ty, d); else E.types.push(d);
      if (d.sante) E.absences.forEach((a) => { if (a.type === d.id) a.note = ''; });
      sauver(); rendre(); toast(`Type « ${nom} » enregistré.`);
      garderOuverte(); modaleReglages();
    });
  }

  const JOURS_SEMAINE = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Jeu'], [5, 'Ven'], [6, 'Sam'], [0, 'Dim']];
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const ac = r.acquisition;
    const an = Number(auj().slice(0, 4));
    const corps = `
      <label class="champ">Ton entreprise<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
      <fieldset class="champ"><legend>Décompte des congés payés <small>Changer d'unité propose les valeurs d'acquisition de cette unité ci-dessous. Les RTT se comptent toujours en jours ouvrés.</small></legend><div class="choix-statut deux">${[['ouvrables', 'Jours ouvrables'], ['ouvres', 'Jours ouvrés']].map(([k, l]) => `<label><input type="radio" name="decompte" value="${k}" ${r.decompte === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Période de référence<select name="moisDebut">${[[6, '1er juin → 31 mai'], [1, 'Année civile'], [5, '1er mai → 30 avril'], [4, '1er avril → 31 mars']].map(([k, l]) => `<option value="${k}" ${r.moisDebut === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="champ">Début du suivi<input type="date" name="debutSuivi" value="${r.debutSuivi || ''}"></label>
      </div>
      <fieldset class="champ"><legend>Jours travaillés dans l'entreprise <small>Servent au décompte en jours ouvrés et aux chevauchements.</small></legend><div class="cases">${JOURS_SEMAINE.map(([k, l]) => `<label class="case"><input type="checkbox" name="jt" value="${k}" ${r.joursTravailles.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
      <div class="groupe"><h3>Règles d'acquisition <span class="etiquette jaune">Paramètres datés</span></h3>
        <p class="aide">Relevées le ${dateLongue(r.verifieLe || B.version)}. ${esc(B.sourceRegles)} Ta convention collective ou un accord peut prévoir mieux : saisis ici ses valeurs.</p>
        <div class="rang-champs">
          <label class="champ">Jours par mois de travail<small>2,5 ouvrables (art. L3141-3).</small><input name="mois" inputmode="decimal" value="${nombre(ac.mois)}" data-ac="mois"></label>
          <label class="champ">Au plus par période<small>30 ouvrables.</small><input name="plafond" inputmode="decimal" value="${nombre(ac.plafond)}" data-ac="plafond"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Par mois d'arrêt maladie<small>Non professionnel : 2 ouvrables (art. L3141-5-1).</small><input name="maladieMois" inputmode="decimal" value="${nombre(ac.maladieMois)}" data-ac="maladieMois"></label>
          <label class="champ">Au plus par période (maladie)<small>24 ouvrables.</small><input name="maladiePlafond" inputmode="decimal" value="${nombre(ac.maladiePlafond)}" data-ac="maladiePlafond"></label>
        </div>
        <label class="case"><input type="checkbox" name="arrondiSup" ${r.arrondiSup ? 'checked' : ''}> Arrondir au nombre entier supérieur à la clôture de la période (art. L3141-7)</label>
        <fieldset class="champ"><legend>RTT</legend><div class="choix-statut deux"><label><input type="radio" name="rttMode" value="prorata" ${r.rttMode !== 'annuel' ? 'checked' : ''}><span>Acquis au fil de l'année</span></label><label><input type="radio" name="rttMode" value="annuel" ${r.rttMode === 'annuel' ? 'checked' : ''}><span>Crédités au 1er janvier</span></label></div></fieldset>
        <label class="champ">Règles vérifiées le<input type="date" name="verifieLe" value="${r.verifieLe || ''}"></label>
        <details class="champs-aide"><summary>Repères et sources</summary><ul>${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b> : ${esc(d)}</li>`).join('')}${B.sources.map(([l, u]) => `<li>${esc(l)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details>
      </div>
      <div class="groupe"><h3>Jours fériés chômés</h3><p class="aide">Les 11 fêtes légales (art. L3133-1), dates calculées chaque année (Pâques comprise). Seul le 1er mai est chômé de droit : décoche ceux que l'entreprise travaille (journée de solidarité…). Alsace-Moselle : coche les deux derniers.</p>
        <div class="feries">${R.feries(an).map((f) => `<label class="case"><input type="checkbox" name="ferie" value="${f.id}" ${r.feriesChomes.includes(f.id) ? 'checked' : ''}> ${esc(f.nom)} <small>${dateCourte(f.date)} ${an}</small></label>`).join('')}</div></div>
      <div class="groupe"><h3>Types d'absence</h3><p class="aide">Ce que chaque type décompte et son effet sur l'acquisition des congés.</p>
        <ul class="mini-liste">${E.types.map((ty) => `<li><span>${pastille(ty)} <b>${esc(ty.nom)}</b> · ${ty.decompte === 'cp' ? 'congés payés' : ty.decompte === 'rtt' ? 'RTT' : 'sans décompte'} · ${ty.acquiert === 'oui' ? 'acquiert' : ty.acquiert === 'maladie' ? 'acquisition maladie' : 'n\'acquiert pas'}</span><button type="button" class="btn petit" data-action="type" data-id="${ty.id}">Modifier</button></li>`).join('')}</ul>
        <div class="rang"><button class="btn petit" type="button" data-action="nouveau-type">${ICONES.plus}Ajouter un type</button></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les absences en tableur (CSV), par exemple pour ton gestionnaire de paie.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Le suivi est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Tu es responsable des données de tes salariés : garde le minimum, aucune donnée de santé, et efface ou supprime un salarié depuis sa fiche quand rien ne t'oblige à conserver ses données.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Règles et types rédigés pour QME (version ${B.version}). Aucun e-mail envoyé, aucune connexion à un logiciel de paie : tu saisis et valides toi-même. Outil d'aide : la convention collective et le Code du travail font foi.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const lire = (nom, maxi) => { const n = R.lireNombre(fd.get(nom)); return n !== null && n <= maxi ? n : null; };
      const acq = { mois: lire('mois', 5), plafond: lire('plafond', 60), maladieMois: lire('maladieMois', 5), maladiePlafond: lire('maladiePlafond', 60) };
      if (Object.values(acq).some((x) => x === null)) return 'Une règle d\'acquisition est illisible : écris par exemple 2,5.';
      const jt = fd.getAll('jt').map(Number);
      if (!jt.length) return 'Coche au moins un jour travaillé.';
      if (fd.get('debutSuivi') && !R.estDate(fd.get('debutSuivi'))) return 'Date de début du suivi illisible.';
      E.entreprise = String(fd.get('entreprise') || '').trim();
      E.reglages = R.normaliserReglages({ ...r, decompte: fd.get('decompte'), moisDebut: Number(fd.get('moisDebut')), debutSuivi: fd.get('debutSuivi') || r.debutSuivi, joursTravailles: jt, acquisition: acq, arrondiSup: !!fd.get('arrondiSup'), feriesChomes: fd.getAll('ferie'), rttMode: fd.get('rttMode'), verifieLe: R.estDate(fd.get('verifieLe')) ? fd.get('verifieLe') : r.verifieLe }, r);
      sauver(); rendre();
      toast('Réglages enregistrés : les soldes sont recalculés.');
    });
    const d = modale();
    d.querySelectorAll('[name=decompte]').forEach((el) => el.addEventListener('change', () => {
      const v = B.acquisitions[el.value];
      if (!v || !confirm(`Reprendre les valeurs par défaut en ${el.value === 'ouvres' ? 'jours ouvrés' : 'jours ouvrables'} (${nombre(v.mois)} par mois, ${nombre(v.plafond)} au plus) ? Les reliquats saisis ne sont pas convertis.`)) return;
      Object.entries(v).forEach(([k, x]) => { const c = d.querySelector(`[data-ac=${k}]`); if (c) c.value = nombre(x); });
    }));
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!Array.isArray(donnees.salaries) || !Array.isArray(donnees.absences)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(donnees.salaries.length, 'salarié')}, ${pluriel(donnees.absences.length, 'absence')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `conges-absences-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E), 'text/csv;charset=utf-8', `absences-${auj()}.csv`);
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function exporterSalarie(id) {
    const d = R.donneesSalarie(E, id, auj());
    if (d) telecharger(JSON.stringify(d, null, 2), 'application/json', `donnees-${slug(nomSal(id)) || 'salarie'}-${auj()}.json`);
  }

  function effacerSalarie(id) {
    const s = salarie(id);
    if (!s || !confirm(`Effacer les données personnelles de ${nomSal(id)} ? Le prénom et le nom sont remplacés, les notes vidées. Les dates d'absence restent pour des soldes justes.`)) return;
    retenir();
    E = R.effacerSalarie(E, id, E.salaries.filter((x) => x.efface).length + 1);
    sauver(); rendre(); modale().close();
    toast('Données personnelles effacées.', { libelle: 'Annuler', faire: annuler });
  }
  function supprimerSalarie(id) {
    const s = salarie(id);
    if (!s) return;
    const n = E.absences.filter((a) => a.salarie === id).length;
    if (!confirm(`Supprimer ${nomSal(id)}${n ? ` et ses ${pluriel(n, 'absence')}` : ''} ? Pense à garder ailleurs ce que tes obligations imposent.`)) return;
    retenir();
    E = R.supprimerSalarie(E, id);
    sauver(); rendre(); modale().close();
    toast(`${s.prenom} supprimé.`, { libelle: 'Annuler', faire: annuler });
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
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle': modaleAbsence(null, { salarieId: el.dataset.salarie, date: el.dataset.date }); break;
      case 'absence': modaleAbsence(id); break;
      case 'valider': changerStatut(id, 'validee'); break;
      case 'refuser': changerStatut(id, 'refusee'); break;
      case 'salarie': modaleSalarie(id); break;
      case 'nouveau-salarie': if (modale().open) modale().close(); modaleSalarie(null); break;
      case 'ajustement': modaleAjustement(id); break;
      case 'suppr-ajustement': { const s = salarie(id); if (!s) break; retenir(); s.ajustements = s.ajustements.filter((x) => x.id !== el.dataset.p); sauver(); rendre(); modaleSalarie(id); toast('Ajustement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'exporter-salarie': exporterSalarie(id); break;
      case 'effacer-salarie': effacerSalarie(id); break;
      case 'supprimer-salarie': supprimerSalarie(id); break;
      case 'equipe': modaleEquipe(id); break;
      case 'nouvelle-equipe': modaleEquipe(null); break;
      case 'type': modaleType(id); break;
      case 'nouveau-type': modaleType(null); break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      case 'mois': { const p = Number(el.dataset.pas); moisCal = p ? R.ajoutMois(`${moisCal || auj().slice(0, 7)}-01`, p).slice(0, 7) : auj().slice(0, 7); rendre(); break; }
      case 'aller-mois': moisCal = el.dataset.mois; equipeCal = el.dataset.equipe || ''; changerVue('calendrier'); break;
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
  window.__conges = { etat: () => E, regles: R };
  init();
})();
