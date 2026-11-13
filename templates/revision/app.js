// Planning de révision QME : répétition espacée, données synchronisées par code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const API = '/api/templates';
  const PRODUIT = 'REV';
  const CLE_CODE = 'qme-rev-code';
  const CLE_CACHE = 'qme-rev-cache';
  const CLE_DEMO = 'qme-rev-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rev-ecran-accueil';

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

  // Dates locales au format AAAA-MM-JJ (comparables comme des chaînes).
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const ajout = (s, n) => { const d = versDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (de, a) => Math.round((versDate(a) - versDate(de)) / 86400000);
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    return fmt(s);
  };

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const methode = (id) => B.methodes.find((m) => m.id === id);

  // ---------- État ----------
  let E = null;
  // code : ce que l'acheteur a saisi (clé Gumroad ou code REV) ; jeton : code interne pour les données.
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let jourChoisi = null;
  let annulation = null;

  const etatVide = () => ({ version: 1, prenom: '', filiere: null, reglages: { intervalles: [...B.intervalles], chargeMax: 8 }, matieres: [], chapitres: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) }, matieres: Array.isArray(d.matieres) ? d.matieres : [], chapitres: Array.isArray(d.chapitres) ? d.chapitres : [] };
  };
  const matiere = (id) => E.matieres.find((m) => m.id === id);
  const chapitre = (id) => E.chapitres.find((c) => c.id === id);
  const examenFutur = (m, depuis = auj()) => (m?.examen && m.examen > depuis ? m.examen : null);

  // ---------- Planification ----------
  // etape = nombre de révisions réussies ; l'intervalle suivant est intervalles[etape].
  // Après la dernière étape, le chapitre est « maîtrisé » ; s'il a un examen, une révision
  // finale est placée 2 jours avant. Aucune révision n'est placée le jour de l'examen ou après.
  function chargeDu(date, sauf) {
    return E.chapitres.reduce((n, c) => n + (c.id !== sauf && c.prochaine === date ? 1 : 0), 0);
  }

  function placer(date, depuis, exam, sauf) {
    // Décale d'un ou deux jours si la journée dépasse la charge maximale.
    let d = date;
    for (let i = 0; i < 2 && chargeDu(d, sauf) >= E.reglages.chargeMax; i++) {
      const suivant = ajout(d, 1);
      if (exam && suivant >= exam) break;
      d = suivant;
    }
    return d;
  }

  function planifier(ch, depuis, etape) {
    const I = E.reglages.intervalles;
    const exam = examenFutur(matiere(ch.matiereId), depuis);
    ch.finale = false;
    if (etape >= I.length) {
      ch.etape = I.length;
      const fin = exam ? ajout(exam, -2) : null;
      if (fin && fin > depuis && !ch.finaleFaite) { ch.prochaine = placer(fin, depuis, exam, ch.id); ch.finale = true; } else ch.prochaine = null;
      return;
    }
    ch.etape = etape;
    let date = ajout(depuis, I[etape]);
    if (exam && date >= exam) date = ajout(exam, -1);
    if (date <= depuis) date = exam && ajout(depuis, 1) >= exam ? null : ajout(depuis, 1);
    ch.prochaine = date ? placer(date, depuis, exam, ch.id) : null;
  }

  const ETAPE_SUIVANTE = { difficile: (e) => Math.max(0, e - 1), moyen: (e) => e + 1, facile: (e) => e + 2 };

  function appliquerEvaluation(ch, ev, date = auj()) {
    ch.historique.push({ date, eval: ev, etape: ch.finale ? 'finale' : ch.etape });
    if (ch.finale) { ch.finaleFaite = true; ch.finale = false; ch.prochaine = null; return; }
    planifier(ch, date, ETAPE_SUIVANTE[ev](ch.etape));
  }

  function apercu(ch, ev) {
    if (ch.finale) return 'terminé';
    const copie = structuredClone(ch);
    appliquerEvaluation(copie, ev);
    if (!copie.prochaine) return copie.etape >= E.reglages.intervalles.length ? 'maîtrisé' : 'avant l\'examen';
    return `dans ${ecart(auj(), copie.prochaine)} j`;
  }

  function nouveauChapitre(matiereId, titre, appris) {
    const ch = { id: uid(), matiereId, titre, appris, etape: 0, prochaine: null, finale: false, finaleFaite: false, historique: [] };
    planifier(ch, appris, 0);
    E.chapitres.push(ch);
    return ch;
  }

  // Replanifie les révisions à venir après un changement d'examen ou de réglages.
  function replanifier(filtre = () => true) {
    const t = auj();
    for (const ch of E.chapitres.filter(filtre)) {
      if (ch.prochaine && ch.prochaine < t) continue; // les retards restent visibles
      const derniere = ch.historique.at(-1)?.date || ch.appris;
      const depuis = derniere > t ? t : derniere;
      planifier(ch, depuis, ch.etape);
      if (ch.prochaine && ch.prochaine < t) ch.prochaine = t;
    }
  }

  const aReviser = () => {
    const t = auj();
    return E.chapitres.filter((c) => c.prochaine && c.prochaine <= t)
      .sort((a, b) => a.prochaine.localeCompare(b.prochaine) || (matiere(a.matiereId)?.nom || '').localeCompare(matiere(b.matiereId)?.nom || ''));
  };
  const faitsAujourdhui = () => {
    const t = auj();
    return E.chapitres.flatMap((c) => c.historique.filter((h) => h.date === t).map((h) => ({ c, h })));
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
        toast('Un autre appareil a modifié ton planning entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
    // Au retour sur l'onglet : récupère la version d'un autre appareil, sauf modification en attente.
    if (session.demo || !session.code || etatSync !== 'ok' || envoiEnCours) return;
    try {
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
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
  // Code REV-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith('REV')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith('REV') && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    // Modifications faites hors ligne sur la version encore à jour du serveur : on les garde.
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

  // Données de démonstration : une Terminale avec un historique simulé.
  function donneesDemo() {
    E = etatVide();
    E.prenom = 'Léa'; E.filiere = 'terminale';
    const t = auj();
    const m = [
      ['Philosophie', 'rouge', 38], ['Mathématiques', 'bleu', 52], ['SES', 'jaune', 52], ['Histoire-géographie', 'encre', 61], ['Anglais', 'vert', null],
    ].map(([nom, c, j]) => { const x = { id: uid(), nom, couleur: c, examen: j ? ajout(t, j) : null }; E.matieres.push(x); return x; });
    const chapitres = [
      [0, 'La conscience', 26], [0, 'L\'inconscient', 19], [0, 'Le devoir', 9], [0, 'La justice', 2],
      [1, 'Suites numériques', 30], [1, 'Limites de fonctions', 21], [1, 'Dérivation et convexité', 12], [1, 'Logarithme népérien', 4],
      [2, 'Croissance économique', 27], [2, 'Commerce international', 16], [2, 'Chômage', 7],
      [3, 'Guerre froide', 24], [3, 'La Ve République', 11], [4, 'Irregular verbs', 18], [4, 'Essay writing', 3],
      [1, 'Fonction exponentielle', 1], [2, 'Inégalités et justice sociale', 1], [3, 'La décolonisation', 6],
    ];
    const evals = ['moyen', 'facile', 'moyen', 'difficile', 'moyen', 'facile'];
    chapitres.forEach(([i, titre, il], k) => {
      const ch = nouveauChapitre(m[i].id, titre, ajout(t, -il));
      let n = 0;
      // Arrête la simulation à des dates différentes : retards, révisions du jour, révisions déjà faites ce matin.
      const limite = [ajout(t, -2), t, ajout(t, 1), t, ajout(t, -1)][k % 5];
      while (ch.prochaine && ch.prochaine < limite && ch.prochaine <= t && n < 8) { appliquerEvaluation(ch, evals[(k + n) % evals.length], ch.prochaine); n++; }
      if (k % 5 === 1 && ch.prochaine) ch.prochaine = t; // à réviser aujourd'hui
      if (k % 5 === 2 && ch.prochaine) appliquerEvaluation(ch, evals[k % evals.length], t); // déjà fait ce matin
    });
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Planning de révision · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="130" cy="150" r="130" fill="#D9302A"/>
          <circle cx="130" cy="150" r="48" fill="#141414"/>
          <rect x="290" y="20" width="260" height="260" fill="#1D4E89"/>
          <path d="M290 280 A260 260 0 0 1 550 20 V280 Z" fill="#F5B400"/>
          <rect x="250" y="262" width="40" height="18" fill="#F0EDE6"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Planning de révision · répétition espacée</p>
          <h1>Réviser au bon moment, pas plus.</h1>
          <p>Chaque chapitre revient à J+1, J+3, J+7, J+14 puis J+30, ajusté selon ta réponse et calé sur la date de l'examen.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton planning</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes révisions sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
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
        <p class="mention">Pas encore de planning ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  let accueil = { etape: 1, prenom: '', filiere: null, choisies: new Set(), libres: [] };

  function ecranAccueil() {
    const a = accueil;
    const f = B.filieres.find((x) => x.id === a.filiere);
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton planning.</h1>
        <p class="intro">Deux questions, puis tu pourras ajouter tes premiers chapitres. Tout reste modifiable ensuite.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Ta formation <span>Les matières sont préremplies selon ton choix.</span></h2>
        <div class="filieres" role="group" aria-label="Formation">
          ${B.filieres.map((x, i) => `<button type="button" class="filiere" style="--c:${couleur(['rouge', 'bleu', 'jaune', 'encre'][i % 4])}" data-action="filiere" data-id="${x.id}" aria-pressed="${a.filiere === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.detail)}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="filiere" data-id="libre" aria-pressed="${a.filiere === 'libre'}"><b>Autre / personnalisé</b><span>Je crée mes matières moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.filiere ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const liste = [...(f ? f.matieres : []), ...a.libres];
      corps = `
        <p class="surtitre">${esc(f ? f.nom : 'Personnalisé')}</p>
        <h1>Quelles matières révises-tu ?</h1>
        <p class="intro">Décoche celles qui ne te concernent pas. Tu ajouteras les dates d'examen depuis l'onglet Matières : les révisions se caleront dessus.</p>
        ${liste.length ? `<div class="choix-matieres">${liste.map((nom) => `<label class="case"><input type="checkbox" data-action="choix-matiere" value="${esc(nom)}" ${a.choisies.has(nom) ? 'checked' : ''}> ${esc(nom)}</label>`).join('')}</div>` : ''}
        <form class="ajout-libre" id="form-libre">
          <label class="champ">Ajouter une matière<input id="libre" maxlength="60" placeholder="Ex. : Économie approfondie"></label>
          <button class="btn" style="align-self:flex-end">Ajouter</button>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin" ${a.choisies.size ? '' : 'disabled'}>Créer mon planning (${pluriel(a.choisies.size, 'matière')})</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#form-libre')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = $('#libre').value.trim();
      if (nom && !accueil.libres.includes(nom)) { accueil.libres.push(nom); accueil.choisies.add(nom); }
      ecranAccueil();
      $('#libre').focus();
    });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    E.filiere = accueil.filiere;
    [...accueil.choisies].forEach((nom, i) => E.matieres.push({ id: uid(), nom, couleur: B.couleurs[i % B.couleurs.length].id, examen: null }));
    accueil = { etape: 1, prenom: '', filiere: null, choisies: new Set(), libres: [] };
    sauver();
    demarrer();
    setTimeout(() => modaleChapitre(), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    matieres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    methodes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['planning', 'Planning'], ['matieres', 'Matières'], ['methodes', 'Méthodes'], ['bilan', 'Bilan']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Planning<br>de révision</span>
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
    const titres = { aujourdhui: 'Aujourd\'hui', planning: 'Planning', matieres: 'Matières', methodes: 'Méthodes', bilan: 'Bilan' };
    document.title = `${titres[vue]} · Planning de révision`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, planning: vuePlanning, matieres: vueMatieres, methodes: vueMethodes, bilan: vueBilan }[vue]();
    if (vue === 'bilan') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const points = (etape) => `<span class="points" aria-label="Étape ${Math.min(etape, E.reglages.intervalles.length)} sur ${E.reglages.intervalles.length}">${E.reglages.intervalles.map((_, i) => `<i class="${i < etape ? 'plein' : ''}"></i>`).join('')}</span>`;

  function prochainExamen() {
    const t = auj();
    return E.matieres.filter((m) => m.examen && m.examen >= t).sort((a, b) => a.examen.localeCompare(b.examen))[0];
  }

  // Aujourd'hui
  function vueAujourdhui() {
    const t = auj();
    const liste = aReviser();
    const faits = faitsAujourdhui();
    const retards = liste.filter((c) => c.prochaine < t).length;
    const total = liste.length + faits.length;
    const ex = prochainExamen();
    const jours = ex ? ecart(t, ex.examen) : null;
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const titre = !E.matieres.length ? `${salut}Commence par tes matières.`
      : liste.length ? `${salut}<mark>${pluriel(liste.length, 'révision')}</mark> ${faits.length ? 'restantes' : 'aujourd\'hui'}.`
        : faits.length ? `${salut}<mark>Tout est fait</mark> pour aujourd'hui.` : `${salut}Rien à réviser aujourd'hui.`;

    const carteExamen = ex
      ? `<aside class="examen-carte ${jours > 30 ? 'calme' : ''}"><p class="surtitre">Prochain examen</p><div class="compte">${jours === 0 ? 'Jour J' : `J-${jours}`}</div><p>${esc(ex.nom)} · ${fmt(ex.examen, { weekday: 'long', day: 'numeric', month: 'long' })}</p></aside>`
      : `<aside class="examen-carte vide"><p class="surtitre">Prochain examen</p><p>Aucune date d'examen. Ajoute-la dans une matière : les révisions se termineront la veille.</p><button class="btn petit" data-action="vue" data-vue="matieres">Ajouter une date</button></aside>`;

    const cartes = liste.map((c) => carteRevision(c, t)).join('');
    const vide = !E.matieres.length
      ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune matière pour l'instant</h3><p>Crée au moins une matière pour y ranger tes chapitres.</p><div class="actions"><button class="btn primaire" data-action="matiere-nouvelle">Créer une matière</button></div></div></div>`
      : !E.chapitres.length
        ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Ajoute ton premier chapitre</h3><p>Dès qu'un chapitre est vu en cours, ajoute-le ici : sa première révision tombera demain, puis à J+3, J+7, J+14 et J+30.</p><div class="actions"><button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}J'ai appris un chapitre</button></div></div></div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${faits.length ? 'Journée terminée.' : 'Journée libre.'}</h3><p>${prochaineRevision()}</p><div class="actions"><button class="btn" data-action="vue" data-vue="planning">Voir le planning</button></div></div></div>`;

    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${total ? `<p class="sous">${pluriel(faits.length, 'faite')} sur ${total}${retards ? ` · <b style="color:var(--rouge)">${retards} en retard</b>` : ''}</p>
          <div class="progression" aria-hidden="true">${Array.from({ length: Math.min(total, 24) }, (_, i) => `<span class="${i < faits.length ? 'fait' : i < faits.length + retards ? 'retard' : ''}"></span>`).join('')}</div>` : ''}
          <div class="actions">
            <button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}J'ai appris un chapitre</button>
          </div>
        </div>
        ${carteExamen}
      </section>
      <h2 class="titre-section">À réviser <span>${liste.length ? 'Révise, puis indique comment ça s\'est passé : la date suivante s\'ajuste.' : ''}</span></h2>
      ${liste.length ? `<ul class="cartes">${cartes}</ul>` : vide}
      ${faits.length ? `<details class="faites"><summary>Faites aujourd'hui (${faits.length})</summary>${faits.map(({ c, h }) => {
        const m = matiere(c.matiereId);
        const lib = { difficile: ['rouge', 'Difficile'], moyen: ['jaune', 'Moyen'], facile: ['bleu', 'Facile'] }[h.eval];
        return `<div class="ligne-faite" style="--c:${couleur(m?.couleur)}"><i></i><span><b>${esc(c.titre)}</b> · ${esc(m?.nom)} · ${c.prochaine ? `prochaine ${quand(c.prochaine)}` : 'maîtrisé'}</span><span class="etiquette ${lib[0]}">${lib[1]}</span></div>`;
      }).join('')}</details>` : ''}`;
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  function prochaineRevision() {
    const t = auj();
    const p = E.chapitres.filter((c) => c.prochaine && c.prochaine > t).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0];
    if (!p) return 'Aucune révision programmée. Ajoute un chapitre dès que tu en termines un en cours.';
    const n = chargeDu(p.prochaine);
    return `Prochaine révision ${quand(p.prochaine)} : ${pluriel(n, 'chapitre')} au programme.`;
  }

  function carteRevision(c, t) {
    const m = matiere(c.matiereId);
    const retard = ecart(c.prochaine, t);
    const meth = methode(c.finale ? 'fiche' : B.methodeParEtape[Math.min(c.etape, B.methodeParEtape.length - 1)]);
    const n = c.historique.length + 1;
    return `
      <li class="carte" style="--c:${couleur(m?.couleur)}" data-carte="${c.id}">
        <div class="carte-bande"></div>
        <div class="carte-corps">
          <p class="carte-matiere">${esc(m?.nom || 'Sans matière')}${retard > 0 ? `<span class="etiquette rouge">En retard · ${retard} j</span>` : ''}${c.finale ? '<span class="etiquette">Révision finale</span>' : ''}</p>
          <h3>${esc(c.titre)}</h3>
          <p class="carte-meta">${points(c.etape)}<span>Révision n° ${n} · appris ${quand(c.appris)}</span></p>
          <button class="methode-puce" data-action="methode" data-id="${meth.id}"><span>Méthode conseillée : <b>${esc(meth.nom)}</b> · ${esc(meth.duree)}</span></button>
        </div>
        <div class="carte-eval" role="group" aria-label="Comment s'est passée la révision de ${esc(c.titre)} ?">
          <button class="ev difficile" data-action="evaluer" data-id="${c.id}" data-eval="difficile">Difficile<small>${apercu(c, 'difficile')}</small></button>
          <button class="ev moyen" data-action="evaluer" data-id="${c.id}" data-eval="moyen">Moyen<small>${apercu(c, 'moyen')}</small></button>
          <button class="ev facile" data-action="evaluer" data-id="${c.id}" data-eval="facile">Facile<small>${apercu(c, 'facile')}</small></button>
        </div>
        <div class="carte-plus"><button data-action="reporter" data-id="${c.id}">Reporter à demain</button><button data-action="chapitre-modifier" data-id="${c.id}">Modifier</button></div>
      </li>`;
  }

  // Planning : 4 semaines à partir du lundi courant
  function vuePlanning() {
    const t = auj();
    const d0 = versDate(t);
    const lundi = ajout(t, -((d0.getDay() + 6) % 7));
    jourChoisi = jourChoisi && jourChoisi >= lundi ? jourChoisi : t;
    const jours = Array.from({ length: 28 }, (_, i) => ajout(lundi, i));
    const max = E.reglages.chargeMax;
    const parJour = (j) => E.chapitres.filter((c) => c.prochaine && (j === t ? c.prochaine <= t : c.prochaine === j));
    const examens = (j) => E.matieres.filter((m) => m.examen === j);
    const cellules = jours.map((j) => {
      const liste = parJour(j);
      const ex = examens(j);
      const passe = j < t;
      const etiquette = `${fmt(j, { weekday: 'long', day: 'numeric', month: 'long' })} : ${pluriel(liste.length, 'révision')}${ex.length ? `, examen de ${ex.map((m) => m.nom).join(', ')}` : ''}`;
      return `<button class="cellule ${j === t ? 'aujourdhui' : ''} ${passe ? 'passe' : ''} ${liste.length >= max ? 'charge' : ''}" data-action="jour" data-jour="${j}" aria-pressed="${j === jourChoisi}" aria-label="${esc(etiquette)}">
        <span class="num">${versDate(j).getDate()}${versDate(j).getDate() === 1 || j === lundi ? ` ${fmt(j, { month: 'short' })}` : ''}</span>
        ${ex.length ? '<span class="exam">Examen</span>' : ''}
        ${!passe && liste.length ? `<span class="nb">${liste.length}<small>rév.</small></span>` : ''}
        ${!passe ? `<span class="carres">${liste.slice(0, 12).map((c) => `<i style="--c:${couleur(matiere(c.matiereId)?.couleur)}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('');
    const detail = parJour(jourChoisi);
    const ex = examens(jourChoisi);
    const passe = jourChoisi < t;
    const faitsCeJour = passe ? E.chapitres.flatMap((c) => c.historique.filter((h) => h.date === jourChoisi).map(() => c)) : [];
    const lignes = passe
      ? (faitsCeJour.length ? faitsCeJour.map((c) => ligneChapitre(c, 'Révisé ce jour-là')).join('') : '<p class="ligne"><span class="vide">Aucune révision faite ce jour-là.</span></p>')
      : detail.length ? detail.map((c) => ligneChapitre(c, `${c.finale ? 'Révision finale' : `Étape ${c.etape + 1} sur ${E.reglages.intervalles.length}`}${c.prochaine < t ? ` · en retard depuis ${quand(c.prochaine)}` : ''}`, true)).join('')
        : '<p class="ligne"><span class="vide">Aucune révision ce jour-là.</span></p>';
    return `
      <div class="vue-tete"><div><h1>Planning</h1><p>Les 4 prochaines semaines. Au-delà de ${max} révisions par jour, les suivantes sont décalées au lendemain (réglable).</p></div>
        <div class="actions"><button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}Chapitre</button></div></div>
      <div class="legende-planning"><span><i style="background:var(--jaune)"></i>Aujourd'hui (retards compris)</span><span><i style="background:var(--rouge)"></i>Examen</span><span>Un carré = une révision, à la couleur de la matière</span></div>
      <div class="calendrier" role="grid" aria-label="Calendrier des révisions">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => `<span class="jsem">${j}</span>`).join('')}${cellules}</div>
      <section class="jour-detail" aria-live="polite">
        <h2>${fmt(jourChoisi, { weekday: 'long', day: 'numeric', month: 'long' })}<span>${passe ? pluriel(faitsCeJour.length, 'révision faite', 'révisions faites') : pluriel(detail.length, 'révision')}${ex.length ? ` · examen : ${esc(ex.map((m) => m.nom).join(', '))}` : ''}</span></h2>
        ${lignes}
      </section>`;
  }

  function ligneChapitre(c, sous, actions = false) {
    const m = matiere(c.matiereId);
    const t = auj();
    return `<div class="ligne" style="--c:${couleur(m?.couleur)}"><i></i><div><b>${esc(c.titre)}</b><span>${esc(m?.nom)} · ${sous}</span></div>
      ${actions ? `<div>${c.prochaine > t ? `<button class="btn petit" data-action="avancer" data-id="${c.id}">Réviser aujourd'hui</button>` : `<button class="btn petit" data-action="reporter" data-id="${c.id}">Reporter</button>`}</div>` : '<span></span>'}</div>`;
  }

  // Matières
  function vueMatieres() {
    const t = auj();
    const I = E.reglages.intervalles.length;
    const cartes = E.matieres.map((m) => {
      const chs = E.chapitres.filter((c) => c.matiereId === m.id).sort((a, b) => a.appris.localeCompare(b.appris));
      const maitrises = chs.filter((c) => c.etape >= I).length;
      const dus = chs.filter((c) => c.prochaine && c.prochaine <= t).length;
      const j = m.examen ? ecart(t, m.examen) : null;
      const examen = m.examen ? (j >= 0 ? `Examen ${fmt(m.examen, { day: 'numeric', month: 'long' })} · ${j === 0 ? 'aujourd\'hui' : `J-${j}`}` : `Examen passé (${fmt(m.examen, { day: 'numeric', month: 'long' })})`) : 'Pas de date d\'examen';
      return `
      <article class="matiere" style="--c:${couleur(m.couleur)};--t:${texteSur(m.couleur)}">
        <div class="matiere-tete"><div><h2>${esc(m.nom)}</h2><p>${examen}</p></div><button data-action="matiere-modifier" data-id="${m.id}">Modifier</button></div>
        <div class="matiere-chiffres"><div><b>${chs.length}</b><span>chapitres</span></div><div><b>${maitrises}</b><span>maîtrisés</span></div><div><b style="${dus ? 'color:var(--rouge)' : ''}">${dus}</b><span>à réviser</span></div></div>
        <div class="maitrise" role="img" aria-label="Maîtrise : ${chs.length ? Math.round((chs.reduce((s, c) => s + Math.min(c.etape, I), 0) / (chs.length * I)) * 100) : 0} %"><i style="width:${chs.length ? (chs.reduce((s, c) => s + Math.min(c.etape, I), 0) / (chs.length * I)) * 100 : 0}%"></i></div>
        <div class="chapitres">${chs.length ? chs.map((c) => `<button class="chapitre" data-action="chapitre-modifier" data-id="${c.id}"><b>${esc(c.titre)}</b>${points(c.etape)}<span class="${c.prochaine && c.prochaine < t ? 'retard' : ''}">${c.prochaine ? `${c.finale ? 'Révision finale' : 'Prochaine révision'} ${quand(c.prochaine)}${c.prochaine < t ? ' (en retard)' : ''}` : c.etape >= I ? 'Maîtrisé' : 'Plus de révision avant l\'examen'}</span></button>`).join('') : '<p class="matiere-vide">Aucun chapitre. Ajoute-le dès qu\'il est vu en cours.</p>'}</div>
        <div class="matiere-pied"><button class="btn petit" data-action="chapitre-nouveau" data-matiere="${m.id}">${ICONES.plus}Chapitre</button></div>
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Matières</h1><p>Indique la date d'examen de chaque matière : aucune révision n'est programmée après, et chaque chapitre maîtrisé a une révision finale deux jours avant.</p></div>
        <div class="actions"><button class="btn" data-action="matiere-nouvelle">${ICONES.plus}Matière</button><button class="btn primaire" data-action="chapitre-nouveau">${ICONES.plus}Chapitre</button></div></div>
      ${E.matieres.length ? `<div class="matieres">${cartes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune matière</h3><p>Crée tes matières une par une, ou choisis-les dans le catalogue de ta formation.</p><div class="actions"><button class="btn primaire" data-action="matiere-nouvelle">Créer une matière</button></div></div></div>`}`;
  }

  // Méthodes
  function vueMethodes() {
    const etapes = {};
    B.methodeParEtape.forEach((id, i) => { (etapes[id] ||= []).push(i + 1); });
    return `
      <div class="vue-tete"><div><h1>Méthodes</h1><p>${B.methodes.length} façons de réviser activement. Le planning en conseille une à chaque révision, de la plus simple (rappel de mémoire) à la plus exigeante (annales chronométrées).</p></div></div>
      <div class="methodes">${B.methodes.map((m) => `
        <article class="methode" id="methode-${m.id}" style="--c:${couleur(m.couleur)};--t:${texteSur(m.couleur)}">
          <div class="methode-tete"><h2>${esc(m.nom)}</h2><span>${esc(m.duree)}</span></div>
          ${etapes[m.id] ? `<div class="conseil">${etapes[m.id].map((e) => `<span class="etiquette">Conseillée à la révision ${e}</span>`).join('')}</div>` : ''}
          <p>${esc(m.principe)}</p>
          <ol>${m.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
        </article>`).join('')}</div>`;
  }

  // Bilan
  function statistiques() {
    const t = auj();
    const histo = E.chapitres.flatMap((c) => c.historique.map((h) => ({ ...h, c })));
    const jours = new Set(histo.map((h) => h.date));
    let serie = 0;
    for (let j = jours.has(t) ? t : ajout(t, -1); jours.has(j); j = ajout(j, -1)) serie++;
    const depuis7 = ajout(t, -6), depuis30 = ajout(t, -29);
    const sur30 = histo.filter((h) => h.date >= depuis30);
    const reussies = sur30.filter((h) => h.eval !== 'difficile').length;
    return {
      serie,
      semaine: histo.filter((h) => h.date >= depuis7).length,
      taux: sur30.length ? Math.round((reussies / sur30.length) * 100) : null,
      maitrises: E.chapitres.filter((c) => c.etape >= E.reglages.intervalles.length).length,
      jours30: Array.from({ length: 30 }, (_, i) => {
        const d = ajout(depuis30, i);
        const h = histo.filter((x) => x.date === d);
        return { d, difficile: h.filter((x) => x.eval === 'difficile').length, moyen: h.filter((x) => x.eval === 'moyen').length, facile: h.filter((x) => x.eval === 'facile').length };
      }),
    };
  }

  const EVALS = [['facile', 'Facile', '#1D4E89'], ['moyen', 'Moyen', '#F5B400'], ['difficile', 'Difficile', '#D9302A']];

  function graphique(jours) {
    const L = Math.round(Math.min(720, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 190 : 220, g = 28, b = 24, hz = H - b - 8;
    const max = Math.max(4, ...jours.map((j) => j.difficile + j.moyen + j.facile));
    const pas = Math.ceil(max / 4);
    const haut = pas * 4;
    const larg = (L - g) / jours.length;
    const y = (v) => 8 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const colonnes = jours.map((j, i) => {
      const x = g + i * larg + 2;
      const w = Math.max(3, larg - (larg > 14 ? 6 : 3));
      let cumul = 0;
      const rects = EVALS.map(([k, , c]) => {
        const v = j[k];
        if (!v) return '';
        const y1 = y(cumul + v), h = y(cumul) - y(cumul + v) - (cumul ? 2 : 0);
        cumul += v;
        return `<rect x="${x}" y="${y1}" width="${w}" height="${Math.max(1, h)}" fill="${c}" stroke="#141414" stroke-width="1.5"/>`;
      }).join('');
      const etiquette = (jours.length - 1 - i) % 7 === 0 ? `<text class="axe" x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${fmt(j.d, { day: 'numeric', month: 'short' })}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne" data-i="${i}">${rects}</g>${etiquette}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Révisions faites par jour sur 30 jours, détail dans le tableau ci-dessous">${grilles}${colonnes}</svg>`;
  }

  function vueBilan() {
    const s = statistiques();
    const t = auj();
    const I = E.reglages.intervalles.length;
    const tuiles = [
      ['Série en cours', s.serie, s.serie > 1 ? 'jours' : 'jour', 'Jours consécutifs avec au moins une révision.', 'var(--rouge)', 'rond'],
      ['Cette semaine', s.semaine, '', 'Révisions faites sur les 7 derniers jours.', 'var(--jaune)', ''],
      ['Bien sues', s.taux === null ? '–' : s.taux, s.taux === null ? '' : '%', 'Révisions « moyen » ou « facile » sur 30 jours.', 'var(--bleu)', ''],
      ['Maîtrisés', s.maitrises, `/ ${E.chapitres.length}`, `Chapitres ayant franchi les ${I} étapes.`, 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const lignes = E.matieres.map((m) => {
      const chs = E.chapitres.filter((c) => c.matiereId === m.id);
      const j = m.examen && m.examen >= t ? ecart(t, m.examen) : null;
      return `<tr style="--c:${couleur(m.couleur)}"><td><span class="nom-matiere"><i></i>${esc(m.nom)}</span></td><td class="nb">${chs.length}</td><td class="nb">${chs.filter((c) => c.etape >= I).length}</td><td class="nb">${chs.filter((c) => c.prochaine && c.prochaine <= t).length}</td><td class="nb">${j === null ? '–' : j === 0 ? 'Aujourd\'hui' : `J-${j}`}</td></tr>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Ta régularité et l'avancement de chaque matière.</p></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">30 derniers jours</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Révisions par jour</h2><div class="legende">${EVALS.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(s.jours30)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Révisions par jour</caption><thead><tr><th>Jour</th><th>Facile</th><th>Moyen</th><th>Difficile</th></tr></thead><tbody>${s.jours30.map((j) => `<tr><td>${fmt(j.d)}</td><td>${j.facile}</td><td>${j.moyen}</td><td>${j.difficile}</td></tr>`).join('')}</tbody></table>
      </figure>
      <h2 class="titre-section">Par matière</h2>
      ${E.matieres.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Matière</th><th class="nb">Chapitres</th><th class="nb">Maîtrisés</th><th class="nb">À réviser</th><th class="nb">Examen</th></tr></thead><tbody>${lignes}</tbody></table></div>` : '<p>Aucune matière.</p>'}`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const jours = statistiques().jours30;
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), j = jours[i];
      fig.querySelectorAll('.colonne').forEach((g) => g.classList.toggle('active', g.dataset.i === String(i)));
      const total = j.facile + j.moyen + j.difficile;
      bulle.innerHTML = `<b>${fmt(j.d, { weekday: 'long', day: 'numeric', month: 'long' })}</b>${total ? EVALS.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${j[k]}</div>`).join('') : 'Aucune révision'}`;
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
    d.querySelector('input:not([type=hidden]):not([type=radio]),select,textarea')?.focus();
  }

  function modaleChapitre(matiereId, id) {
    if (!E.matieres.length) { modaleMatiere(); toast('Crée d\'abord une matière.'); return; }
    const c = id ? chapitre(id) : null;
    const choix = c?.matiereId || matiereId || E.matieres[0].id;
    const t = auj();
    const corps = `
      <label class="champ">Matière<select name="matiere">${E.matieres.map((m) => `<option value="${m.id}" ${m.id === choix ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
      ${c ? `<label class="champ">Titre du chapitre<input name="titre" required maxlength="120" value="${esc(c.titre)}"></label>`
        : '<label class="champ">Titre du chapitre<small>Plusieurs chapitres d\'un coup : un par ligne.</small><textarea name="titre" required maxlength="2000" placeholder="Ex. : Les fonctions exponentielles"></textarea></label>'}
      <label class="champ">Appris le<input type="date" name="appris" value="${c?.appris || t}" max="${t}" required></label>
      ${c ? `<p class="aide">${c.historique.length ? `${pluriel(c.historique.length, 'révision faite')}. ` : ''}${c.prochaine ? `Prochaine révision ${quand(c.prochaine)}.` : 'Aucune révision programmée.'}</p>` : `<p class="aide">Première révision le lendemain de la date indiquée, puis à J+${E.reglages.intervalles.slice(1).join(', J+')}.</p>`}
      <p class="erreur" role="alert"></p>`;
    const pied = c
      ? `<button class="btn primaire" value="ok">Enregistrer</button>${c.etape > 0 || c.historique.length ? '<button class="btn" value="recommencer">Recommencer à zéro</button>' : ''}<button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier le chapitre' : 'Nouveau chapitre', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${c.titre} » et son historique de révisions ?`)) return '';
        E.chapitres = E.chapitres.filter((x) => x.id !== c.id);
        sauver(); rendre(); toast(`« ${c.titre} » supprimé.`);
        return;
      }
      const titres = String(f.get('titre') || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const appris = f.get('appris');
      if (!titres.length) return 'Indique le titre du chapitre.';
      if (!appris || appris > t) return 'La date ne peut pas être dans le futur.';
      if (c) {
        const changeDate = c.appris !== appris;
        c.titre = titres.join(' '); c.matiereId = f.get('matiere'); c.appris = appris;
        if (action === 'recommencer') { c.historique = []; c.finaleFaite = false; planifier(c, t, 0); c.prochaine = ajout(t, E.reglages.intervalles[0]); }
        else if (changeDate && !c.historique.length) { planifier(c, appris, 0); if (c.prochaine < t) c.prochaine = t; }
        sauver(); rendre(); toast('Chapitre enregistré.');
        return;
      }
      const ajoutes = titres.map((ti) => { const ch = nouveauChapitre(f.get('matiere'), ti.slice(0, 120), appris); if (ch.prochaine && ch.prochaine < t) ch.prochaine = t; return ch; });
      sauver(); rendre();
      toast(ajoutes.length > 1 ? `${ajoutes.length} chapitres ajoutés.` : `Ajouté. Première révision ${quand(ajoutes[0].prochaine)}.`);
    });
  }

  function modaleMatiere(id) {
    const m = id ? matiere(id) : null;
    const utilisees = new Set(E.matieres.map((x) => x.couleur));
    const defaut = m?.couleur || (B.couleurs.find((c) => !utilisees.has(c.id)) || B.couleurs[E.matieres.length % B.couleurs.length]).id;
    const f = B.filieres.find((x) => x.id === E.filiere);
    const suggestions = f ? f.matieres.filter((n) => !E.matieres.some((x) => x.nom === n)) : [];
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(m?.nom || '')}" list="suggestions"></label>
      ${suggestions.length && !m ? `<datalist id="suggestions">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>` : ''}
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === defaut ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      <label class="champ">Date de l'examen<small>Facultative. Les révisions s'arrêtent la veille.</small><input type="date" name="examen" value="${m?.examen || ''}"></label>
      <p class="erreur" role="alert"></p>`;
    const nb = m ? E.chapitres.filter((c) => c.matiereId === m.id).length : 0;
    const pied = m ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(m ? 'Modifier la matière' : 'Nouvelle matière', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${m.nom} »${nb ? ` et ses ${pluriel(nb, 'chapitre')}` : ''} ?`)) return '';
        E.matieres = E.matieres.filter((x) => x.id !== m.id);
        E.chapitres = E.chapitres.filter((c) => c.matiereId !== m.id);
        sauver(); rendre(); toast(`« ${m.nom} » supprimée.`);
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la matière.';
      const examen = fd.get('examen') || null;
      if (m) {
        const examenChange = m.examen !== examen;
        Object.assign(m, { nom, couleur: fd.get('couleur'), examen });
        if (examenChange) replanifier((c) => c.matiereId === m.id);
      } else E.matieres.push({ id: uid(), nom, couleur: fd.get('couleur'), examen });
      sauver(); rendre(); toast(m ? 'Matière enregistrée.' : `« ${nom} » créée.`);
    });
  }

  function modaleMethode(id) {
    const m = methode(id);
    ouvrirModale(esc(m.nom), `<p class="surtitre" style="margin:0">Durée : ${esc(m.duree)}</p><p>${esc(m.principe)}</p><div class="methode" style="border:0;background:none"><ol>${m.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol></div>`,
      '<button class="btn primaire" value="ok">Compris</button><button class="btn" type="button" data-action="vue" data-vue="methodes">Toutes les méthodes</button>');
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Intervalles entre les révisions (jours)<small>Séparés par des virgules, croissants. Par défaut : ${B.intervalles.join(', ')}.</small><input name="intervalles" value="${r.intervalles.join(', ')}" inputmode="numeric"></label>
      <label class="champ">Révisions maximum par jour<small>Au-delà, les révisions sont décalées d'un ou deux jours.</small><input type="number" name="chargeMax" min="2" max="40" value="${r.chargeMax}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const I = String(f.get('intervalles')).split(/[,;\s]+/).filter(Boolean).map(Number);
      if (!I.length || I.length > 10 || I.some((n) => !Number.isInteger(n) || n < 1 || n > 365) || I.some((n, i) => i && n <= I[i - 1])) return 'Intervalles : nombres entiers croissants entre 1 et 365, 10 au maximum.';
      const charge = Number(f.get('chargeMax'));
      if (!Number.isInteger(charge) || charge < 2 || charge > 40) return 'Révisions par jour : entre 2 et 40.';
      const changeI = I.join() !== r.intervalles.join();
      E.prenom = String(f.get('prenom') || '').trim();
      r.intervalles = I; r.chargeMax = charge;
      if (changeI) { E.chapitres.forEach((c) => { c.etape = Math.min(c.etape, I.length); }); replanifier(); }
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.matieres) || !Array.isArray(d.chapitres)) throw new Error();
        if (!confirm(`Remplacer ton planning actuel par cette copie (${pluriel(d.matieres.length, 'matière')}, ${pluriel(d.chapitres.length, 'chapitre')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planning.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planning-revision-${auj()}.json`;
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
  function evaluer(id, ev, bouton) {
    const c = chapitre(id);
    if (!c) return;
    const avant = structuredClone(c);
    appliquerEvaluation(c, ev);
    annulation = { id, avant };
    sauver();
    const carte = bouton.closest('.carte');
    const suite = () => {
      rendre();
      const restant = $('.carte .ev');
      if (restant) restant.closest('.carte').querySelector('.ev.moyen').focus({ preventScroll: true });
      toast(c.prochaine ? `« ${c.titre} » : prochaine révision ${quand(c.prochaine)}.` : `« ${c.titre} » maîtrisé.`, { libelle: 'Annuler', faire: annuler });
    };
    if (carte && !matchMedia('(prefers-reduced-motion: reduce)').matches) { carte.classList.add('sortie'); setTimeout(suite, 220); } else suite();
  }

  function annuler() {
    if (!annulation) return;
    const i = E.chapitres.findIndex((c) => c.id === annulation.id);
    if (i >= 0) E.chapitres[i] = annulation.avant;
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
      case 'deconnexion': modale().open && modale().close(); deconnecter(); break;
      case 'filiere': {
        accueil.filiere = id;
        const f = B.filieres.find((x) => x.id === id);
        accueil.choisies = new Set([...(f ? f.matieres : []), ...accueil.libres]);
        ecranAccueil(); break;
      }
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'choix-matiere': el.checked ? accueil.choisies.add(el.value) : accueil.choisies.delete(el.value); {
        const b = $('[data-action="accueil-fin"]');
        b.disabled = !accueil.choisies.size; b.textContent = `Créer mon planning (${pluriel(accueil.choisies.size, 'matière')})`;
      } break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'chapitre-nouveau': modaleChapitre(el.dataset.matiere); break;
      case 'chapitre-modifier': modaleChapitre(null, id); break;
      case 'matiere-nouvelle': modaleMatiere(); break;
      case 'matiere-modifier': modaleMatiere(id); break;
      case 'methode': modaleMethode(id); break;
      case 'evaluer': evaluer(id, el.dataset.eval, el); break;
      case 'reporter': { const c = chapitre(id); annulation = { id, avant: structuredClone(c) }; c.prochaine = ajout(auj(), 1); sauver(); rendre(); toast(`« ${c.titre} » reporté à demain.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'avancer': { const c = chapitre(id); annulation = { id, avant: structuredClone(c) }; c.prochaine = auj(); sauver(); rendre(); toast(`« ${c.titre} » ajouté aux révisions du jour.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'jour': jourChoisi = el.dataset.jour; rendre(); $('.jour-detail')?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); break;
      default: break;
    }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (vue === 'aujourdhui' && !modale().open) rendre(); // changement de jour
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
      // Hors ligne : on reprend la dernière version gardée sur l'appareil.
      const c = stock.lire(CLE_CACHE);
      if (c && c.code === code && c.etat && c.jeton) {
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__revision = { planifier: (...a) => planifier(...a), appliquerEvaluation: (...a) => appliquerEvaluation(...a), etat: () => E };
  init();
})();
