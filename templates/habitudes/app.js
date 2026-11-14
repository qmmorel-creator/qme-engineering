// Suivi d'habitudes et routines QME : cochage du jour, grille mensuelle, séries et taux de réussite,
// données synchronisées par clé de licence. Aucune connexion à une autre application.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.HBT;
  const API = '/api/templates';
  const PRODUIT = 'HBT';
  const CLE_CODE = 'qme-hbt-code';
  const CLE_CACHE = 'qme-hbt-cache';
  const CLE_DEMO = 'qme-hbt-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-hbt-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, jourIndex } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const JOURS_LETTRE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const COULEURS = B.couleurs.map((c) => c.id);

  const teinte = (id) => B.couleurs.find((c) => c.id === id) || B.couleurs[0];
  const theme = (id) => E.themes.find((t) => t.id === id);
  const styleTheme = (id) => { const c = teinte(theme(id)?.couleur); return `--c:${c.hex};--t:${c.texte};--p:${c.teinte}`; };
  const habitude = (id) => E.habitudes.find((h) => h.id === id);
  const AVERTISSEMENT_SANTE = 'Outil d\'aide au suivi, pas un dispositif médical : il ne remplace pas l\'avis d\'un médecin ou d\'un pharmacien. Suis toujours la prescription qui t\'a été donnée.';
  const joursTexte = (j) => (j.length === 7 ? 'tous les jours' : j.length === 5 && j.every((x) => x < 5) ? 'du lundi au vendredi' : j.map((x) => JOURS_COURTS[x].toLowerCase()).join(', '));

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'aujourdhui';
  let jourVu = auj();
  let moisVu = R.premierDuMois(auj());
  let annulation = null;

  const etatVide = () => R.normaliserEtat(null, auj(), COULEURS);
  const normaliser = (d) => R.normaliserEtat(d, auj(), COULEURS);

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
        toast('Un autre appareil a modifié ton suivi entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (HBT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Personne fictive, 9 semaines d'historique simulées avec les vraies règles, relatives à aujourd'hui :
  // séries longues et cassées, jours non applicables (une semaine de congés), valeurs partielles,
  // lieu de travail réparti, habitude archivée, journée du jour à moitié cochée.
  function donneesDemo() {
    const e = etatVide();
    e.prenom = 'Léa';
    const t = auj();
    const debut = ajout(R.lundiDe(t), -56);
    R.ajouterDepuisBase(e, ['eau', 'fruits-legumes', 'cafe', 'sommeil-heures', 'coucher-23h', 'ecran-lit', 'seance', 'pas', 'etirements', 'meditation', 'lecture', 'tache-1', 'bureau', 'teletravail', 'deplacement', 'lit', 'depenses', 'traitement-matin', 'grignotage'], B, debut);
    const h = (m) => e.habitudes.find((x) => x.modele === m);
    h('grignotage').archive = ajout(t, -12);
    // Une habitude personnelle ajoutée plus tard.
    e.habitudes.push(R.normaliserHabitude({ id: R.nouvelId(), theme: 'esprit', nom: 'Pas de téléphone après 22 h', type: 'case', jours: R.TOUS, depuis: ajout(t, -20) }, t));
    // Pseudo-aléatoire déterministe par date et habitude.
    const alea = (d, k) => { let x = 0; for (const ch of d + k) x = (x * 31 + ch.charCodeAt(0)) % 100003; return ((x * 9301 + 49297) % 233280) / 233280; };
    const conges = [ajout(t, -24), ajout(t, -18)];
    const enConges = (d) => d >= conges[0] && d <= conges[1];
    for (let d = debut; d <= t; d = ajout(d, 1)) {
      const recent = R.ecart(d, t);
      for (const x of e.habitudes) {
        if (!R.prevue(x, d) || R.estUnique(e, x)) continue;
        if (d === t && !['lit', 'eau', 'cafe', 'sommeil-heures', 'traitement-matin', 'coucher-23h', 'meditation'].includes(x.modele)) continue;
        const r = alea(d, x.modele || x.nom);
        if (enConges(d) && ['seance', 'tache-1', 'pas'].includes(x.modele)) { R.regler(e, d, x, R.NA); continue; }
        switch (x.modele) {
          case 'eau': R.regler(e, d, x, d === t ? 5 : Math.round(5 + r * 5)); break;
          case 'fruits-legumes': R.regler(e, d, x, Math.round(2 + r * 4)); break;
          case 'cafe': R.regler(e, d, x, d === t ? 2 : Math.round(1 + r * 3.4)); break;
          case 'sommeil-heures': R.regler(e, d, x, Math.round((6 + r * 2.8) * 2) / 2); break;
          case 'pas': R.regler(e, d, x, Math.round((4500 + r * 7000) / 100) * 100); break;
          case 'etirements': if (r > 0.25) R.regler(e, d, x, r > 0.85 ? 5 : 10 + Math.round(r * 2) * 5); break;
          case 'meditation': R.regler(e, d, x, recent <= 22 ? 10 + (r > 0.7 ? 5 : 0) : (r > 0.4 ? 10 : 5)); break;
          case 'lecture': if (recent === 1) R.regler(e, d, x, 4); else if (r > 0.2) R.regler(e, d, x, 10 + Math.round(r * 4) * 5); break;
          case 'traitement-matin': R.regler(e, d, x, recent !== 9); break;
          case 'seance': if (recent > 2 || r > 0.3) R.regler(e, d, x, r > 0.18); break;
          default: if (r > 0.22) R.regler(e, d, x, true); else if (r > 0.12) R.regler(e, d, x, false);
        }
      }
      // Lieu de travail : télétravail lundi et vendredi, bureau sinon, quelques déplacements.
      if (jourIndex(d) < 5 && d < t) {
        const r = alea(d, 'lieu');
        if (enConges(d)) R.regler(e, d, h('bureau'), R.NA);
        else R.regler(e, d, r > 0.88 ? h('deplacement') : [0, 4].includes(jourIndex(d)) ? h('teletravail') : h('bureau'), true);
      }
    }
    if (jourIndex(t) < 5) R.regler(e, t, h(jourIndex(t) === 0 || jourIndex(t) === 4 ? 'teletravail' : 'bureau'), true);
    // Deux journées parfaites récentes : tout ce qui était prévu, réussi.
    for (const d of [ajout(t, -4), ajout(t, -6)]) {
      for (const x of e.habitudes) {
        if (!R.prevue(x, d) || R.estUnique(e, x) || R.valeur(e, d, x) === R.NA) continue;
        if (!R.reussiValeur(x, R.valeur(e, d, x))) R.regler(e, d, x, x.type === 'case' ? true : (x.min ?? x.max ?? 0));
      }
    }
    // Coucher : un oubli d'hier (manqué), lit fait ce matin.
    R.regler(e, ajout(t, -1), h('coucher-23h'), undefined);
    R.regler(e, t, h('lit'), true);
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi d\'habitudes · QME';
    const grille = Array.from({ length: 28 }, (_, i) => {
      const x = 10 + (i % 7) * 38, y = 30 + Math.floor(i / 7) * 38;
      const plein = [0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 14, 15, 17, 18, 19, 20, 22, 23, 24, 25].includes(i);
      return `<rect x="${x}" y="${y}" width="30" height="30" rx="8" ${plein ? `fill="${['#1D4E89', '#D9302A', '#F5B400'][i % 3]}"` : 'fill="none" stroke="#2E5A88" stroke-width="3" stroke-dasharray="6 5"'}/>`;
    }).join('');
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 200" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          ${grille}
          <circle cx="440" cy="100" r="90" fill="#F5B400"/>
          <path d="M440 100 L440 10 A90 90 0 0 1 530 100 Z" fill="#141414"/>
          <path d="M398 104 l28 28 l52 -60" fill="none" stroke="#141414" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi d'habitudes · routines</p>
          <h1>Un geste par jour, une série qui tient.</h1>
          <p>Coche tes habitudes en quelques secondes, compte tes verres d'eau ou tes heures de sommeil, et vois tes séries et ton taux de réussite mois après mois.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton suivi est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de suivi ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, prenom: '', routines: new Set(), choix: new Set() };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-points" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton suivi.</h1>
        <p class="intro">Choisis une ou plusieurs routines types : leurs habitudes seront cochées à l'étape suivante, avec leurs réglages (verres d'eau, heures de sommeil, minutes…). Tout reste modifiable.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Routines types</h2>
        <div class="types" role="group" aria-label="Routines types">
          ${B.routines.map((r) => `<button type="button" class="type" data-action="routine" data-id="${r.id}" aria-pressed="${a.routines.has(r.id)}">
            <span class="pastilles-routine" aria-hidden="true">${r.habitudes.map((id) => `<i style="--c:${teinte(B.themes.find((t) => t.id === B.habitudes.find((x) => x.id === id).theme).couleur).hex}"></i>`).join('')}</span>
            <b>${esc(r.nom)}</b><span>${esc(r.detail)}</span><small>${pluriel(r.habitudes.length, 'habitude')}</small></button>`).join('')}
        </div>
        <div class="accueil-pied"><span class="aide-pied">Aucune routine ne te convient ? Continue : tu choisiras dans les 50 habitudes types.</span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${pluriel(a.choix.size, 'habitude choisie', 'habitudes choisies')}</p>
        <h1>Tes habitudes</h1>
        <p class="intro">Coche ce que tu veux suivre. Mieux vaut commencer par 5 à 8 habitudes que tu tiendras : tu pourras en ajouter à tout moment depuis l'onglet Habitudes.</p>
        <div class="choix-base">${B.themes.map((t) => `
          <fieldset class="choix-theme" style="--c:${teinte(t.couleur).hex}">
            <legend><i></i>${esc(t.nom)}${t.mode === 'unique' ? ' <small>une seule par jour</small>' : ''}</legend>
            ${B.habitudes.filter((h) => h.theme === t.id).map((h) => `<label class="case"><input type="checkbox" data-action="choix" value="${h.id}" ${a.choix.has(h.id) ? 'checked' : ''}><span>${esc(h.nom)}${h.type === 'nombre' ? ` <small>${esc(R.objectifTexte(h))}</small>` : ''}</span></label>`).join('')}
          </fieldset>`).join('')}</div>
        <p class="aide">Les habitudes de soins et traitements servent de pense-bête. ${AVERTISSEMENT_SANTE}</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.prenom = accueil.prenom.trim();
    R.ajouterDepuisBase(E, [...accueil.choix], B, auj());
    accueil = { etape: 1, prenom: '', routines: new Set(), choix: new Set() };
    vue = E.habitudes.length ? 'aujourdhui' : 'habitudes';
    sauver();
    demarrer();
    toast(E.habitudes.length ? 'Ton suivi est prêt. Touche une habitude pour la cocher.' : 'Ton suivi est prêt. Ajoute ta première habitude.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    aujourdhui: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="m7.5 12.2 3 3 6-6.4" fill="none" stroke="var(--papier)" stroke-width="2.4"/></svg>',
    mois: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="5" fill="currentColor"/><rect x="10" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="5" fill="currentColor"/><rect x="3" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="10" width="5" height="5" fill="currentColor"/><rect x="17" y="10" width="4" height="5" fill="currentColor"/><rect x="3" y="17" width="5" height="4" fill="currentColor"/><rect x="10" y="17" width="5" height="4" fill="currentColor"/><rect x="17" y="17" width="4" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    habitudes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    moins: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    points: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['aujourdhui', 'Aujourd\'hui'], ['mois', 'Mois'], ['bilan', 'Bilan'], ['habitudes', 'Habitudes']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi<br>d'habitudes</span>
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
    const titres = { aujourdhui: 'Aujourd\'hui', mois: 'Mois', bilan: 'Bilan', habitudes: 'Habitudes' };
    document.title = `${titres[vue]} · Suivi d'habitudes`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { aujourdhui: vueAujourdhui, mois: vueMois, bilan: vueBilan, habitudes: vueHabitudes }[vue]();
    if (vue === 'mois') requestAnimationFrame(defilerVersAujourdhui);
    if (vue === 'bilan') brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const habitudesTriees = (liste) => E.themes.flatMap((t) => liste.filter((h) => h.theme === t.id)).concat(liste.filter((h) => !theme(h.theme)));
  const aDesSoins = () => E.habitudes.some((h) => !h.archive && R.estSante(h));

  // ---------- Aujourd'hui ----------
  function vueAujourdhui() {
    const t = auj();
    if (jourVu > t) jourVu = t;
    const d = jourVu;
    const actives = R.habitudesDuJour(E, d);
    if (!E.habitudes.some((h) => !h.archive)) {
      return `<div class="vue-tete"><div><h1>Aucune habitude suivie</h1><p>Choisis-en dans la base de 50 habitudes types, ou crée la tienne.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Commence petit</h3><p>Une ou deux habitudes tenues valent mieux que dix abandonnées.</p><div class="actions"><button class="btn primaire" data-action="base">Choisir dans la base</button><button class="btn" data-action="habitude-nouvelle">${ICONES.plus}Créer une habitude</button></div></div></div>`;
    }
    const av = R.avancementJour(E, d, t);
    const salut = E.prenom && d === t ? `Bonjour ${esc(E.prenom)}. ` : '';
    const titre = av.prevues ? `${salut}<mark>${av.faites} sur ${av.prevues}</mark> ${d === t ? 'aujourd\'hui' : 'ce jour-là'}.` : `${salut}Rien de prévu ${d === t ? 'aujourd\'hui' : 'ce jour-là'}.`;
    const prevues = habitudesTriees(actives.filter((h) => R.prevue(h, d)));
    const autres = habitudesTriees(actives.filter((h) => !R.prevue(h, d) && !R.estUnique(E, h)));
    const parTheme = E.themes.map((th) => ({ th, liste: prevues.filter((h) => h.theme === th.id) })).filter((x) => x.liste.length);
    const sections = parTheme.map(({ th, liste }) => {
      const contenu = th.mode === 'unique' ? choixUnique(th, liste, d) : `<ul class="lignes">${liste.map((h) => ligneHabitude(h, d)).join('')}</ul>`;
      return `<section class="theme-jour" style="${styleTheme(th.id)}"><h2 class="theme-titre"><i></i>${esc(th.nom)}${th.mode === 'unique' ? '<small>une seule réponse</small>' : ''}</h2>${contenu}</section>`;
    }).join('');
    return `
      <section class="jour">
        <div class="jour-nav">
          <button class="btn-icone" data-action="jour-prec" aria-label="Jour précédent">${ICONES.gauche}</button>
          <p class="surtitre">${majuscule(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}${d === t ? '' : ` · <button class="btn lien" data-action="jour-auj">revenir à aujourd'hui</button>`}</p>
          <button class="btn-icone" data-action="jour-suiv" aria-label="Jour suivant" ${d >= t ? 'disabled' : ''}>${ICONES.droite}</button>
        </div>
        <h1>${titre}</h1>
        ${av.prevues ? `<div class="jauge" aria-hidden="true"><i style="width:${(av.faites / av.prevues) * 100}%"></i></div>` : ''}
        ${av.parfait ? '<p class="parfait">Journée parfaite : tout ce qui était prévu est fait.</p>' : ''}
      </section>
      ${aDesSoins() ? `<p class="aide sante" role="note"><b>Soins et traitements.</b> ${AVERTISSEMENT_SANTE}</p>` : ''}
      ${sections || `<div class="vide-etat">${FORME_VIDE}<div><h3>Journée libre</h3><p>Aucune habitude n'est prévue ce jour-là.</p></div></div>`}
      ${autres.length ? `<details class="autres"><summary>Pas prévues ce jour-là (${autres.length})</summary><ul class="lignes">${autres.map((h) => ligneHabitude(h, d)).join('')}</ul></details>` : ''}
      <p class="astuce">Touche une case pour la cocher, touche encore pour « pas fait ». Le bouton ··· marque un jour « non applicable » (malade, en congés…) : il ne casse pas la série.</p>`;
  }

  function ligneHabitude(h, d) {
    const t = auj();
    const s = R.statut(E, h, d, t);
    const v = R.valeur(E, d, h);
    const serie = R.serie(E, h, t);
    const sous = [h.type === 'nombre' ? R.objectifTexte(h) : '', serie ? `série ${pluriel(serie, 'jour')}` : '', s === 'na' ? 'non applicable' : '', s === 'bonus' ? 'en plus' : ''].filter(Boolean).join(' · ');
    const nom = `<span class="ligne-nom"><b>${esc(h.nom)}</b>${sous ? `<span>${esc(sous)}</span>` : ''}</span>`;
    const plus = `<button class="btn-icone petit" data-action="saisie" data-id="${h.id}" data-date="${d}" aria-label="Autres choix pour ${esc(h.nom)}">${ICONES.points}</button>`;
    if (h.type === 'nombre') {
      const val = typeof v === 'number' ? R.nombreTexte(v) : s === 'na' ? '–' : '0';
      return `<li class="ligne st-${s}" style="${styleTheme(h.theme)}"><span class="pastille-etat" aria-hidden="true">${s === 'reussi' || s === 'bonus' ? ICONES.coche : ''}</span>${nom}
        <div class="compteur" role="group" aria-label="${esc(h.nom)}">
          <button class="btn-icone petit" data-action="moins" data-id="${h.id}" data-date="${d}" aria-label="Retirer ${R.nombreTexte(h.pas)} ${esc(h.unite)}">${ICONES.moins}</button>
          <button class="valeur" data-action="saisie" data-id="${h.id}" data-date="${d}" aria-label="Saisir la valeur : ${val} ${esc(h.unite)}"><b>${val}</b><small>${esc(h.unite)}</small></button>
          <button class="btn-icone petit" data-action="plus" data-id="${h.id}" data-date="${d}" aria-label="Ajouter ${R.nombreTexte(h.pas)} ${esc(h.unite)}">${ICONES.plus}</button>
        </div>${plus}</li>`;
    }
    const etiquette = { reussi: 'Fait', manque: d === t ? 'Pas fait' : 'Manqué', na: 'Non applicable', attente: 'À faire', bonus: 'Fait', libre: 'À faire' }[s] || '';
    return `<li class="ligne st-${s}" style="${styleTheme(h.theme)}">
      <button class="cocher" data-action="basculer" data-id="${h.id}" data-date="${d}" aria-pressed="${v === true}" aria-label="${esc(h.nom)} : ${etiquette}"><span class="pastille-etat" aria-hidden="true">${v === true ? ICONES.coche : v === false ? '✕' : v === R.NA ? '–' : ''}</span>${nom}<span class="etat-texte">${etiquette}</span></button>${plus}</li>`;
  }

  function choixUnique(th, liste, d) {
    const v = E.journal[d]?.[R.cleTheme(th.id)];
    return `<div class="choix-unique" role="radiogroup" aria-label="${esc(th.nom)}">${liste.map((h) => `<button class="puce" role="radio" aria-checked="${v === h.id}" data-action="choisir" data-id="${h.id}" data-date="${d}">${v === h.id ? ICONES.coche : ''}${esc(h.nom)}</button>`).join('')}
      <button class="puce na" role="radio" aria-checked="${v === R.NA}" data-action="choisir-na" data-id="${liste[0].id}" data-date="${d}">Non applicable</button></div>`;
  }

  // ---------- Saisie ----------
  function appliquer(h, d, valeurVoulue, message) {
    retenir();
    R.regler(E, d, h, valeurVoulue);
    sauver(); rendre();
    if (message) toast(message, { libelle: 'Annuler', faire: annuler });
    if (valeurVoulue !== undefined && R.estSante(h) && !E.rappelSanteVu) {
      E.rappelSanteVu = true; sauver();
      toast(AVERTISSEMENT_SANTE);
    }
  }

  function basculerCase(h, d) {
    retenir();
    const v = R.basculer(E, d, h);
    sauver(); rendre();
    const lib = v === true ? 'fait' : v === false ? 'pas fait' : v === R.NA ? 'non applicable' : 'effacé';
    if (v !== true) toast(`« ${h.nom} » : ${lib}.`, { libelle: 'Annuler', faire: annuler });
    const ligne = document.querySelector(`[data-action="basculer"][data-id="${h.id}"]`);
    ligne?.focus({ preventScroll: true });
  }

  function modaleSaisie(h, d) {
    const v = R.valeur(E, d, h);
    const titre = `${esc(h.nom)}`;
    const jour = majuscule(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }));
    const pied = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="na">Non applicable</button><button class="btn" value="effacer">Effacer</button>';
    const sante = R.estSante(h) ? `<p class="aide">${AVERTISSEMENT_SANTE}</p>` : '';
    if (R.estUnique(E, h)) {
      const options = E.habitudes.filter((x) => x.theme === h.theme && R.active(x, d));
      const choisi = E.journal[d]?.[R.cleTheme(h.theme)];
      ouvrirModale(esc(theme(h.theme)?.nom || ''), `<p>${jour}</p><fieldset class="champ"><legend>Une seule réponse ce jour-là</legend><div class="choix-radio">${options.map((x) => `<label class="case"><input type="radio" name="choix" value="${x.id}" ${choisi === x.id ? 'checked' : ''}> ${esc(x.nom)}</label>`).join('')}</div></fieldset><p class="erreur" role="alert"></p>`, pied, (f, bouton) => {
        if (bouton === 'na') return appliquer(h, d, R.NA, `${theme(h.theme)?.nom} : non applicable.`);
        if (bouton === 'effacer') return appliquer(h, d, undefined, 'Réponse effacée.');
        const id = f.get('choix');
        if (!id) return 'Choisis une réponse, ou « Non applicable ».';
        appliquer(habitude(id), d, true);
      });
      return;
    }
    if (h.type === 'nombre') {
      ouvrirModale(titre, `<p>${jour} · objectif : ${esc(R.objectifTexte(h))}</p>
        <label class="champ">Valeur (${esc(h.unite)})<input name="valeur" inputmode="decimal" value="${typeof v === 'number' ? R.nombreTexte(v) : ''}" placeholder="${h.min ?? 0}" autocomplete="off"></label>
        <p class="erreur" role="alert"></p>${sante}`, pied, (f, bouton) => {
        if (bouton === 'na') return appliquer(h, d, R.NA, `« ${h.nom} » : non applicable ce jour-là.`);
        if (bouton === 'effacer') return appliquer(h, d, undefined, 'Valeur effacée.');
        const n = R.lireNombre(f.get('valeur'));
        if (n === null) return 'Saisis un nombre positif, par exemple 1,5.';
        appliquer(h, d, n);
      });
      return;
    }
    ouvrirModale(titre, `<p>${jour}</p>
      <fieldset class="champ"><legend>Ce jour-là</legend><div class="choix-radio">
        <label class="case"><input type="radio" name="etat" value="oui" ${v === true ? 'checked' : ''}> Fait</label>
        <label class="case"><input type="radio" name="etat" value="non" ${v === false ? 'checked' : ''}> Pas fait</label>
      </div></fieldset>
      <p class="aide">« Non applicable » : malade, en congés, en déplacement… Le jour ne compte pas et ne casse pas la série.</p><p class="erreur" role="alert"></p>${sante}`, pied, (f, bouton) => {
      if (bouton === 'na') return appliquer(h, d, R.NA, `« ${h.nom} » : non applicable ce jour-là.`);
      if (bouton === 'effacer') return appliquer(h, d, undefined, 'Saisie effacée.');
      const e = f.get('etat');
      if (!e) return 'Choisis « Fait » ou « Pas fait ».';
      appliquer(h, d, e === 'oui');
    });
  }

  // ---------- Mois (grille date × habitude) ----------
  const SYMBOLES = { reussi: '✓', bonus: '✓', choisi: '●', manque: '✕', na: '–', partiel: '', attente: '', libre: '', futur: '', autre: '' };
  const LIB_STATUT = { reussi: 'réussi', bonus: 'fait en plus', choisi: 'choisi', manque: 'manqué', na: 'non applicable', partiel: 'objectif non atteint', attente: 'à saisir', libre: 'pas prévu', futur: 'à venir', autre: 'autre choix' };

  function vueMois() {
    const t = auj();
    const jours = R.joursDuMois(moisVu);
    const fin = jours[jours.length - 1];
    const liste = habitudesTriees(E.habitudes.filter((h) => h.depuis <= fin && (!h.archive || h.archive > moisVu)));
    const titre = majuscule(versDate(moisVu).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    const tete = `<tr><th class="col-nom" scope="col">Habitude</th>${jours.map((d) => `<th scope="col" class="${d === t ? 'auj' : ''} ${jourIndex(d) > 4 ? 'we' : ''}" ${d === t ? 'id="col-auj"' : ''}><span>${JOURS_LETTRE[jourIndex(d)]}</span><b>${versDate(d).getDate()}</b></th>`).join('')}<th scope="col" class="col-taux">Taux</th></tr>`;
    const lignes = E.themes.map((th) => {
      const hs = liste.filter((h) => h.theme === th.id);
      if (!hs.length) return '';
      const entete = `<tr class="ligne-theme" style="${styleTheme(th.id)}"><th class="col-nom" scope="rowgroup"><i></i>${esc(th.nom)}${th.mode === 'unique' ? ' <small>une seule</small>' : ''}</th><td colspan="${jours.length + 1}"></td></tr>`;
      return entete + hs.map((h) => {
        const tx = R.taux(E, h, moisVu, fin, t);
        const rep = th.mode === 'unique' ? R.repartition(E, th.id, moisVu, fin, t).options.find((o) => o.id === h.id)?.jours : null;
        const cellules = jours.map((d) => {
          const s = h.depuis > d || (h.archive && d >= h.archive) ? 'hors' : R.statut(E, h, d, t);
          const v = R.valeur(E, d, h);
          const texte = h.type === 'nombre' && typeof v === 'number' ? court(v) : SYMBOLES[s] || '';
          const etiquette = `${h.nom}, ${fmt(d, { weekday: 'long', day: 'numeric' })} : ${s === 'hors' ? 'pas encore suivie' : LIB_STATUT[s]}${typeof v === 'number' ? ` (${R.nombreTexte(v)} ${h.unite})` : ''}`;
          const cliquable = s !== 'futur' && s !== 'hors';
          return `<td class="c st-${s} ${d === t ? 'auj' : ''}">${cliquable ? `<button data-action="cellule" data-id="${h.id}" data-date="${d}" aria-label="${esc(etiquette)}" title="${esc(etiquette)}">${texte}</button>` : `<span title="${esc(etiquette)}">${texte}</span>`}</td>`;
        }).join('');
        const tauxTexte = th.mode === 'unique' ? `${rep ?? 0} j` : tx.taux === null ? '–' : `${tx.taux} %`;
        return `<tr style="${styleTheme(th.id)}"><th class="col-nom" scope="row"><button class="nom-habitude" data-action="habitude" data-id="${h.id}">${esc(h.nom)}${h.archive ? ' <small>archivée</small>' : ''}</button></th>${cellules}<td class="col-taux">${tauxTexte}</td></tr>`;
      }).join('');
    }).join('');
    const parfaits = R.joursParfaits(E, moisVu, fin, t);
    const global = R.tauxGlobal(E, moisVu, fin, t);
    return `
      <div class="vue-tete">
        <div><h1>${esc(titre)}</h1><p>${global.taux === null ? 'Rien à compter pour l\'instant.' : `${global.taux} % de réussite · ${pluriel(parfaits, 'journée parfaite', 'journées parfaites')}`}</p></div>
        <div class="actions">
          <div class="nav-mois">
            <button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent">${ICONES.gauche}</button>
            <button class="btn petit" data-action="mois-auj">Ce mois-ci</button>
            <button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant">${ICONES.droite}</button>
          </div>
          <button class="btn" data-action="imprimer">Imprimer</button>
          <button class="btn" data-action="csv">Export CSV</button>
        </div>
      </div>
      <div class="legende-grille" aria-label="Légende">
        <span><i class="st-reussi">✓</i>Réussi</span><span><i class="st-partiel">5</i>Chiffre sous l'objectif</span><span><i class="st-manque">✕</i>Manqué</span><span><i class="st-na">–</i>Non applicable</span><span><i class="st-libre"></i>Pas prévu</span><span><i class="st-choisi">●</i>Choix du jour</span>
      </div>
      ${liste.length ? `<div class="grille-mois" id="grille-mois"><table class="journal"><thead>${tete}</thead><tbody>${lignes}</tbody></table></div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune habitude ce mois-ci</h3><p>Les habitudes apparaissent à partir du jour où tu commences à les suivre.</p></div></div>`}
      <p class="astuce">Touche une case pour la remplir : une case à cocher passe de « fait » à « pas fait », puis « non applicable ». Un chiffre ou un choix ouvre la saisie.</p>`;
  }

  // Chiffre court pour une case de 30 px : 10 400 → « 10k », 7 500 → « 7,5k ».
  const court = (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${R.nombreTexte(Math.round(v / 100) / 10)}k` : R.nombreTexte(v));

  function defilerVersAujourdhui() {
    const g = $('#grille-mois'), c = $('#col-auj');
    if (!g || !c) return;
    const nom = g.querySelector('.col-nom');
    // Aujourd'hui vers la droite de la zone visible : les jours passés restent sous les yeux.
    const visible = g.clientWidth - (nom?.offsetWidth || 0);
    g.scrollLeft = Math.max(0, c.offsetLeft + c.offsetWidth * 2 - (nom?.offsetWidth || 0) - visible);
  }

  function cellule(h, d) {
    if (h.type === 'case' && !R.estUnique(E, h)) return basculerCase(h, d);
    modaleSaisie(h, d);
  }

  // ---------- Bilan ----------
  function vueBilan() {
    const t = auj();
    const de = ajout(t, -29);
    const independantes = habitudesTriees(E.habitudes.filter((h) => !h.archive && !R.estUnique(E, h)));
    const g = R.tauxGlobal(E, de, t, t);
    const series = independantes.map((h) => ({ h, s: R.serie(E, h, t), m: R.meilleureSerie(E, h, t), tx: R.taux(E, h, de, t, t) }));
    const top = series.reduce((a, x) => (x.s > (a?.s ?? 0) ? x : a), null);
    const parfaits = R.joursParfaits(E, de, t, t);
    const tuiles = [
      ['Taux de réussite', g.taux === null ? '–' : `${g.taux}<small>%</small>`, `${g.reussis} réussis sur ${g.comptes} jours comptés, 30 derniers jours`, 'var(--bleu)', ''],
      ['Meilleure série en cours', top ? `${top.s}<small>j</small>` : '–', top ? top.h.nom : 'Aucune série en cours', 'var(--rouge)', 'rond'],
      ['Journées parfaites', parfaits, 'tout ce qui était prévu, fait (30 jours)', 'var(--jaune)', ''],
      ['Habitudes suivies', independantes.length + E.themes.filter((th) => th.mode === 'unique' && E.habitudes.some((h) => h.theme === th.id && !h.archive)).length, `${pluriel(E.themes.length, 'thème')}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');

    // Tendance : taux global par semaine (une seule série → pas de légende, le titre la nomme).
    const sem = R.tendance(E, R.lundiDe(t), 8, t);
    const colonnes = sem.map((s, i) => {
      const actuelle = i === sem.length - 1;
      const info = `<b>Semaine du ${fmt(s.lundi, { day: 'numeric', month: 'long' })}</b>${s.taux === null ? 'Rien à compter' : `${s.taux} % de réussite<br>${s.reussis} réussis sur ${s.comptes} jours comptés`}`;
      return `<div class="col-tend ${actuelle ? 'active' : ''}" tabindex="0" data-info="${esc(info)}"><div class="ct-zone"><span class="ct-barre" style="height:${s.taux ?? 0}%"></span></div><b>${s.taux === null ? '–' : `${s.taux} %`}</b><span>${fmt(s.lundi, { day: 'numeric', month: 'short' })}</span></div>`;
    }).join('');

    const lignes = series.map(({ h, s, m, tx }) => `
      <tr style="${styleTheme(h.theme)}">
        <td><span class="nom-theme"><i></i><span>${esc(h.nom)}<small>${esc(h.type === 'nombre' ? R.objectifTexte(h) : joursTexte(h.jours))}</small></span></span></td>
        <td class="nb">${s ? `<b>${s} j</b>` : '0'}</td>
        <td class="nb">${m} j</td>
        <td class="col-barre"><span class="barre-taux" role="img" aria-label="${tx.taux === null ? 'pas encore de jour compté' : `${tx.taux} % de réussite`}"><span style="width:${tx.taux ?? 0}%"></span></span></td>
        <td class="nb">${tx.taux === null ? '–' : `${tx.taux} %`}</td>
        <td class="nb discret">${tx.reussis}/${tx.comptes}${tx.na ? ` · ${tx.na} n/a` : ''}</td>
      </tr>`).join('');

    const uniques = E.themes.filter((th) => th.mode === 'unique' && E.habitudes.some((h) => h.theme === th.id && !h.archive));
    const repartitions = uniques.map((th) => {
      const r = R.repartition(E, th.id, de, t, t);
      const total = r.total || 1;
      const c = teinte(th.couleur);
      const tons = [c.hex, 'color-mix(in srgb,' + c.hex + ' 55%,var(--surface))', 'color-mix(in srgb,' + c.hex + ' 25%,var(--surface))', 'var(--trait)'];
      return `<div class="repartition"><h3>${esc(th.nom)} <small>30 derniers jours, ${pluriel(r.total, 'jour renseigné', 'jours renseignés')}</small></h3>
        <div class="pile" role="img" aria-label="${esc(r.options.map((o) => `${o.nom} ${o.jours} jours`).join(', '))}">${r.options.filter((o) => o.jours).map((o) => `<span style="flex:${o.jours};background:${tons[r.options.indexOf(o) % tons.length]}"></span>`).join('')}</div>
        <ul class="legende">${r.options.map((o, i) => `<li><i style="background:${tons[i % tons.length]}"></i>${esc(o.nom)} <b>${o.jours} j</b> <span>${Math.round((o.jours / total) * 100)} %</span></li>`).join('')}${r.na ? `<li><i class="hachure"></i>Non applicable <b>${r.na} j</b></li>` : ''}${r.vides ? `<li><i class="vide"></i>Non renseigné <b>${r.vides} j</b></li>` : ''}</ul></div>`;
    }).join('');

    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Séries et taux de réussite des 30 derniers jours. Les jours « non applicables » et les jours non prévus ne comptent pas.</p></div>
        <div class="actions"><button class="btn" data-action="copier-bilan">Copier le bilan</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="graphique" style="margin-top:24px">
        <div class="graphique-tete"><h2>Taux de réussite par semaine</h2><span class="discret">8 dernières semaines, toutes habitudes</span></div>
        <div class="tendance">${colonnes}</div>
      </div>
      <h2 class="titre-section">Par habitude <span>série en cours, meilleure série, taux sur 30 jours</span></h2>
      ${series.length ? `<div class="defile"><table class="tableau tableau-bilan"><thead><tr><th>Habitude</th><th class="nb">Série</th><th class="nb">Record</th><th class="col-barre"><span class="sr-only">Barre</span></th><th class="nb">Taux</th><th class="nb">Jours</th></tr></thead><tbody>${lignes}</tbody></table></div>` : '<p class="aide">Aucune habitude à cocher ou chiffrée pour l\'instant.</p>'}
      ${repartitions ? `<h2 class="titre-section">Choix du jour <span>répartition des réponses</span></h2><div class="repartitions">${repartitions}</div>` : ''}`;
  }

  function texteBilan() {
    const t = auj();
    const de = ajout(t, -29);
    const g = R.tauxGlobal(E, de, t, t);
    const lignes = habitudesTriees(E.habitudes.filter((h) => !h.archive && !R.estUnique(E, h))).map((h) => {
      const tx = R.taux(E, h, de, t, t);
      return `- ${h.nom} : ${tx.taux === null ? '–' : `${tx.taux} %`}, série ${R.serie(E, h, t)} j, record ${R.meilleureSerie(E, h, t)} j`;
    });
    return `Bilan de mes habitudes, 30 derniers jours (au ${fmt(t, { day: 'numeric', month: 'long', year: 'numeric' })})\nRéussite globale : ${g.taux === null ? '–' : `${g.taux} %`}\n${lignes.join('\n')}`;
  }

  let infobulle = null;
  function brancherInfobulles() {
    const zone = $('.graphique');
    if (!zone) return;
    const montrer = (el) => {
      document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol'));
      el.classList.add('survol');
      if (!infobulle) { infobulle = document.createElement('div'); infobulle.className = 'infobulle'; infobulle.setAttribute('role', 'tooltip'); }
      zone.appendChild(infobulle);
      infobulle.innerHTML = el.dataset.info;
      const rz = zone.getBoundingClientRect(), re = el.getBoundingClientRect();
      const x = Math.min(rz.width - infobulle.offsetWidth - 8, Math.max(8, re.left - rz.left + re.width / 2 - infobulle.offsetWidth / 2));
      infobulle.style.left = `${x}px`;
      infobulle.style.top = `${Math.max(8, re.top - rz.top - infobulle.offsetHeight + 40)}px`;
    };
    const cacher = () => { infobulle?.remove(); document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
    zone.querySelectorAll('[data-info]').forEach((el) => {
      el.addEventListener('pointerenter', () => montrer(el));
      el.addEventListener('focus', () => montrer(el));
      el.addEventListener('pointerleave', cacher);
      el.addEventListener('blur', cacher);
    });
  }

  // ---------- Habitudes et thèmes ----------
  function vueHabitudes() {
    const actives = E.habitudes.filter((h) => !h.archive);
    const archivees = E.habitudes.filter((h) => h.archive);
    const cartes = E.themes.map((th) => {
      const hs = actives.filter((h) => h.theme === th.id);
      return `<section class="carte-theme" style="${styleTheme(th.id)}">
        <div class="carte-theme-tete"><i></i><div><h2>${esc(th.nom)}</h2><span>${th.mode === 'unique' ? 'Une seule habitude par jour' : 'Habitudes indépendantes'} · ${pluriel(hs.length, 'habitude')}</span></div>
          <button class="btn petit" data-action="theme-modifier" data-id="${th.id}">Modifier</button></div>
        <ul>${hs.map((h) => `<li><button class="ligne-gestion" data-action="habitude" data-id="${h.id}"><b>${esc(h.nom)}${R.estSante(h) ? ' <small class="etiquette">santé</small>' : ''}</b><span>${esc([h.type === 'nombre' ? R.objectifTexte(h) : 'à cocher', joursTexte(h.jours)].join(' · '))}</span></button></li>`).join('') || '<li class="discret">Aucune habitude dans ce thème.</li>'}</ul>
        <button class="btn lien" data-action="habitude-nouvelle" data-theme="${th.id}">${ICONES.plus}Ajouter ${th.mode === 'unique' ? 'un choix' : 'une habitude'}</button>
      </section>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Habitudes</h1><p>Range tes habitudes par thèmes colorés. Un thème « une seule par jour » sert aux choix exclusifs, comme le lieu de travail.</p></div>
        <div class="actions"><button class="btn primaire" data-action="habitude-nouvelle">${ICONES.plus}Habitude</button><button class="btn" data-action="base">Base de 50 habitudes</button><button class="btn" data-action="theme-nouveau">${ICONES.plus}Thème</button></div></div>
      ${aDesSoins() ? `<p class="aide sante" role="note">${AVERTISSEMENT_SANTE}</p>` : ''}
      <div class="cartes-themes">${cartes || `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun thème</h3><p>Ajoute des habitudes depuis la base : leurs thèmes sont créés avec elles.</p></div></div>`}</div>
      ${archivees.length ? `<h2 class="titre-section">Archivées <span>leur historique reste dans la grille et le bilan des mois passés</span></h2><ul class="archives">${archivees.map((h) => `<li><span><b>${esc(h.nom)}</b> archivée le ${fmt(h.archive, { day: 'numeric', month: 'long' })}</span><button class="btn petit" data-action="desarchiver" data-id="${h.id}">Reprendre</button></li>`).join('')}</ul>` : ''}`;
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const choixJours = (sel) => `<div class="choix-jours">${JOURS_COURTS.map((j, i) => `<label><input type="checkbox" name="jours" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span>${j}</span></label>`).join('')}</div>`;

  function modaleHabitude(id, defaut = {}) {
    const h = id && E ? habitude(id) : null;
    if (!E.themes.length && !h) {
      E.themes.push({ id: R.nouvelId(), nom: 'Mes habitudes', couleur: COULEURS[0], mode: 'independant' });
    }
    const x = h || { nom: '', theme: defaut.theme || E.themes[0].id, type: 'case', unite: 'fois', min: 1, max: null, pas: 1, jours: R.TOUS, note: '' };
    const nb = (v) => (v === null || v === undefined ? '' : R.nombreTexte(v));
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="60" value="${esc(x.nom)}" required placeholder="Ex. : lire 10 pages"></label>
      <label class="champ">Thème<select name="theme">${E.themes.map((t) => `<option value="${t.id}" ${t.id === x.theme ? 'selected' : ''}>${esc(t.nom)}${t.mode === 'unique' ? ' (une seule par jour)' : ''}</option>`).join('')}</select></label>
      <fieldset class="champ"><legend>Type</legend><div class="choix-radio ligne-radio">
        <label class="case"><input type="radio" name="type" value="case" ${x.type !== 'nombre' ? 'checked' : ''}> À cocher</label>
        <label class="case"><input type="radio" name="type" value="nombre" ${x.type === 'nombre' ? 'checked' : ''}> Chiffrée</label>
      </div></fieldset>
      <div class="champs-nombre" ${x.type === 'nombre' ? '' : 'hidden'}>
        <div class="rang-champs">
          <label class="champ">Unité<input name="unite" list="unites" maxlength="12" value="${esc(x.unite || 'fois')}"></label>
          <label class="champ">Pas du bouton +<input name="pas" inputmode="decimal" value="${nb(x.pas)}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Minimum <small>au moins</small><input name="min" inputmode="decimal" value="${nb(x.min)}" placeholder="aucun"></label>
          <label class="champ">Maximum <small>au plus</small><input name="max" inputmode="decimal" value="${nb(x.max)}" placeholder="aucun"></label>
        </div>
        <p class="aide">Réussi si la valeur du jour respecte le minimum et le maximum fixés. Ex. : eau au moins 8 verres, café au plus 3 tasses, sommeil de 7 à 9 h.</p>
        <datalist id="unites">${B.unites.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
      </div>
      <fieldset class="champ"><legend>Jours prévus</legend>${choixJours(x.jours)}</fieldset>
      <p class="aide">Les autres jours ne comptent pas et ne cassent pas la série.</p>
      ${R.estSante(x) ? `<p class="aide sante">${AVERTISSEMENT_SANTE}</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${h ? '<button class="btn gauche" value="archiver">Archiver</button><button class="btn danger" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(h ? 'Modifier l\'habitude' : 'Nouvelle habitude', corps, pied, (f, bouton) => {
      if (bouton === 'archiver') {
        retenir(); h.archive = auj() > h.depuis ? auj() : ajout(h.depuis, 1);
        sauver(); rendre(); toast(`« ${h.nom} » archivée : elle n'apparaît plus, son historique reste.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      if (bouton === 'supprimer') {
        if (!confirm(`Supprimer « ${h.nom} » et tout son historique ?`)) return '';
        retenir();
        E.habitudes = E.habitudes.filter((y) => y.id !== h.id);
        for (const d of Object.keys(E.journal)) { delete E.journal[d][h.id]; if (E.journal[d][R.cleTheme(h.theme)] === h.id) delete E.journal[d][R.cleTheme(h.theme)]; if (!Object.keys(E.journal[d]).length) delete E.journal[d]; }
        sauver(); rendre(); toast(`« ${h.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const type = f.get('type') === 'nombre' ? 'nombre' : 'case';
      const lire = (k) => { const s = String(f.get(k) || '').trim(); return s === '' ? null : R.lireNombre(s); };
      for (const k of ['min', 'max', 'pas']) if (type === 'nombre' && String(f.get(k) || '').trim() !== '' && lire(k) === null) return `${{ min: 'Minimum', max: 'Maximum', pas: 'Pas' }[k]} : saisis un nombre positif.`;
      const brut = { nom: String(f.get('nom') || '').trim(), theme: f.get('theme'), type, unite: String(f.get('unite') || '').trim() || 'fois', min: lire('min'), max: lire('max'), pas: lire('pas') ?? 1, jours: f.getAll('jours').map(Number) };
      const err = R.verifierHabitude(brut);
      if (err) return err;
      retenir();
      if (h) {
        const avant = h.theme;
        Object.assign(h, R.normaliserHabitude({ ...h, ...brut }, auj()));
        // Changement de thème : les choix « une seule par jour » de l'ancien thème ne la concernent plus.
        if (avant !== h.theme) for (const d of Object.keys(E.journal)) if (E.journal[d][R.cleTheme(avant)] === h.id) delete E.journal[d][R.cleTheme(avant)];
      } else E.habitudes.push(R.normaliserHabitude({ ...brut, id: R.nouvelId(), depuis: auj() }, auj()));
      sauver(); rendre();
      const nouvelle = h || E.habitudes[E.habitudes.length - 1];
      toast(R.estSante(nouvelle) ? `Enregistré. ${AVERTISSEMENT_SANTE}` : 'Habitude enregistrée.');
    });
    const form = modale().querySelector('form');
    form.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', () => { form.querySelector('.champs-nombre').hidden = form.querySelector('input[name=type]:checked').value !== 'nombre'; }));
  }

  function modaleTheme(id) {
    const th = id ? theme(id) : null;
    const prises = new Set(E.themes.filter((t) => t.id !== id).map((t) => t.couleur));
    const libre = COULEURS.find((c) => !prises.has(c));
    if (!th && !libre) { toast(`${COULEURS.length} thèmes au plus, une couleur chacun : regroupe tes habitudes dans un thème existant.`); return; }
    const x = th || { nom: '', couleur: libre, mode: 'independant' };
    const nbHab = th ? E.habitudes.filter((h) => h.theme === th.id).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="40" value="${esc(x.nom)}" required placeholder="Ex. : Matin"></label>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${esc(c.nom)}"><input type="radio" name="couleur" value="${c.id}" ${c.id === x.couleur ? 'checked' : ''} ${prises.has(c.id) ? 'disabled' : ''}><span class="${prises.has(c.id) ? 'prise' : ''}" style="--c:${c.hex}"></span><span class="sr-only">${esc(c.nom)}${prises.has(c.id) ? ' (déjà prise)' : ''}</span></label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Fonctionnement</legend><div class="choix-radio">
        <label class="case"><input type="radio" name="mode" value="independant" ${x.mode !== 'unique' ? 'checked' : ''}> Habitudes indépendantes : chacune se coche seule</label>
        <label class="case"><input type="radio" name="mode" value="unique" ${x.mode === 'unique' ? 'checked' : ''}> Une seule habitude par jour (ex. : bureau, télétravail ou déplacement)</label>
      </div></fieldset>
      ${th && nbHab ? '<p class="aide">Changer le fonctionnement d\'un thème qui a déjà un historique efface les saisies de ses habitudes, pour éviter des doublons.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${th ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(th ? 'Modifier le thème' : 'Nouveau thème', corps, pied, (f, bouton) => {
      if (bouton === 'supprimer') {
        if (nbHab) return `Ce thème contient ${pluriel(nbHab, 'habitude')} (archivées comprises) : déplace-les ou supprime-les d'abord.`;
        retenir(); E.themes = E.themes.filter((t) => t.id !== th.id); sauver(); rendre(); toast('Thème supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au thème.';
      const couleur = f.get('couleur') || libre;
      const mode = f.get('mode') === 'unique' ? 'unique' : 'independant';
      retenir();
      if (th) {
        if (th.mode !== mode && nbHab) {
          const ids = E.habitudes.filter((h) => h.theme === th.id).map((h) => h.id);
          for (const d of Object.keys(E.journal)) { ids.forEach((i) => delete E.journal[d][i]); delete E.journal[d][R.cleTheme(th.id)]; if (!Object.keys(E.journal[d]).length) delete E.journal[d]; }
        }
        Object.assign(th, { nom, couleur, mode });
      } else E.themes.push({ id: R.nouvelId(), nom, couleur, mode });
      sauver(); rendre(); toast('Thème enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleBase() {
    const presentes = new Set(E.habitudes.filter((h) => !h.archive && h.modele).map((h) => h.modele));
    const corps = `
      <p>Coche les habitudes à ajouter : elles arrivent avec leurs réglages types, modifiables ensuite.</p>
      <div class="routines-rapides">${B.routines.map((r) => `<button type="button" class="btn petit" data-action="base-routine" data-id="${r.id}">${esc(r.nom)}</button>`).join('')}</div>
      <div class="choix-base">${B.themes.map((t) => `
        <fieldset class="choix-theme" style="--c:${teinte(t.couleur).hex}"><legend><i></i>${esc(t.nom)}${t.mode === 'unique' ? ' <small>une seule par jour</small>' : ''}</legend>
        ${B.habitudes.filter((h) => h.theme === t.id).map((h) => `<label class="case"><input type="checkbox" name="base" value="${h.id}" ${presentes.has(h.id) ? 'checked disabled' : ''}><span>${esc(h.nom)}${h.type === 'nombre' ? ` <small>${esc(R.objectifTexte(h))}</small>` : ''}${h.source ? ` <small class="source" title="${esc(B.sources[h.source])}">repère</small>` : ''}${presentes.has(h.id) ? ' <small>déjà suivie</small>' : ''}</span></label>`).join('')}
        </fieldset>`).join('')}</div>
      <details class="sources"><summary>D'où viennent les réglages types ?</summary><ul>${Object.values(B.sources).map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p>Relevé en ${esc(B.sourcesDate)}. Valeurs indicatives pour un adulte en bonne santé, à adapter ; elles ne remplacent pas l'avis d'un professionnel de santé.</p></details>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Base de 50 habitudes', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const ids = f.getAll('base');
      if (!ids.length) return 'Coche au moins une habitude.';
      retenir();
      const n = R.ajouterDepuisBase(E, ids, B, auj());
      sauver(); rendre();
      toast(`${pluriel(n, 'habitude ajoutée', 'habitudes ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde et partage</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie (JSON)</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="csv">Journal en CSV</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">Rien n'est coché automatiquement : aucune connexion à une montre, une application de sport ou de santé. Les réglages types sont indicatifs (sources dans la base d'habitudes). ${AVERTISSEMENT_SANTE}</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.prenom = String(f.get('prenom') || '').trim();
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.themes) || !Array.isArray(d.habitudes) || typeof d.journal !== 'object') throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.habitudes.length, 'habitude')}, ${pluriel(Object.keys(d.journal || {}).length, 'jour')} de journal) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi d\'habitudes.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-habitudes-${auj()}.json`);
  function exporterCsv() {
    const t = auj();
    const debut = Object.keys(E.journal).sort()[0] || E.habitudes.map((h) => h.depuis).sort()[0] || t;
    telecharger('﻿' + R.versCsv(E, debut, t, t), 'text/csv;charset=utf-8', `journal-habitudes-${t}.csv`);
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
      <p>Enregistre ton suivi sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 5000);
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const h = id && E ? habitude(id) : null;
    const d = el.dataset.date;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'routine': {
        const r = B.routines.find((x) => x.id === id);
        if (accueil.routines.has(id)) { accueil.routines.delete(id); r.habitudes.forEach((x) => accueil.choix.delete(x)); B.routines.filter((y) => accueil.routines.has(y.id)).forEach((y) => y.habitudes.forEach((x) => accueil.choix.add(x))); } else { accueil.routines.add(id); r.habitudes.forEach((x) => accueil.choix.add(x)); }
        ecranAccueil(); break;
      }
      case 'choix': if (el.checked) accueil.choix.add(el.value); else accueil.choix.delete(el.value); $('.accueil .surtitre').textContent = pluriel(accueil.choix.size, 'habitude choisie', 'habitudes choisies'); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'jour-prec': jourVu = ajout(jourVu, -1); rendre(); break;
      case 'jour-suiv': if (jourVu < auj()) { jourVu = ajout(jourVu, 1); rendre(); } break;
      case 'jour-auj': jourVu = auj(); rendre(); break;
      case 'basculer': if (h) basculerCase(h, d); break;
      case 'plus': case 'moins': if (h) { const v = R.valeur(E, d, h); appliquer(h, d, R.ajuster(h, v === R.NA ? 0 : v, action === 'plus' ? 1 : -1)); document.querySelector(`[data-action="${action}"][data-id="${h.id}"]`)?.focus({ preventScroll: true }); } break;
      case 'saisie': if (h) modaleSaisie(h, d); break;
      case 'choisir': if (h) { const deja = R.valeur(E, d, h) === true; appliquer(h, d, deja ? undefined : true, deja ? 'Réponse effacée.' : null); } break;
      case 'choisir-na': if (h) appliquer(h, d, R.valeur(E, d, h) === R.NA ? undefined : R.NA, `${theme(h.theme)?.nom} : non applicable.`); break;
      case 'cellule': if (h) cellule(h, d); break;
      case 'mois-prec': moisVu = R.moisSuivant(moisVu, -1); rendre(); break;
      case 'mois-suiv': moisVu = R.moisSuivant(moisVu, 1); rendre(); break;
      case 'mois-auj': moisVu = R.premierDuMois(auj()); rendre(); break;
      case 'habitude': if (h) modaleHabitude(h.id); break;
      case 'habitude-nouvelle': modaleHabitude(null, { theme: el.dataset.theme }); break;
      case 'theme-modifier': modaleTheme(id); break;
      case 'theme-nouveau': modaleTheme(); break;
      case 'base': modaleBase(); break;
      case 'base-routine': { const r = B.routines.find((x) => x.id === id); r?.habitudes.forEach((x) => { const c = modale().querySelector(`input[name=base][value="${x}"]`); if (c && !c.disabled) c.checked = true; }); break; }
      case 'desarchiver': if (h) { retenir(); h.archive = null; sauver(); rendre(); toast(`« ${h.nom} » reprise.`, { libelle: 'Annuler', faire: annuler }); } break;
      case 'copier-bilan': {
        const texte = texteBilan();
        (navigator.clipboard?.writeText(texte) || Promise.reject()).then(() => toast('Bilan copié : colle-le où tu veux.'), () => ouvrirModale('Bilan à copier', `<label class="champ">Sélectionne et copie ce texte<textarea rows="10" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>'));
        break;
      }
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  MQ_TEL.addEventListener('change', () => { if (E && $('#vue')) rendre(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // le jour a pu changer
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
  window.__habitudes = { etat: () => E, regles: R };
  init();
})();
