// Planning Gantt rapide QME : saisie en une ligne, mini-plannings en sections, tableau et Gantt SVG synchronisés,
// dépendances, chemin critique, avancement, données synchronisées par code d'accès.
// Règles métier pures dans regles.js (window.REGLES), base intégrée dans donnees.js (window.BASE).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'GNT';
  const CLE_CODE = 'qme-gnt-code';
  const CLE_CACHE = 'qme-gnt-cache';
  const CLE_DEMO = 'qme-gnt-demo';
  const CLE_AFFICHAGE = 'qme-gnt-affichage';
  const CLE_ACCUEIL = 'qme-gnt-ecran-accueil';
  const CODE_DEMO = 'DEMO';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${Math.abs(n) > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, ecart, versDate } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtCourt = (s) => { const d = versDate(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const fmtTable = (s) => { const d = versDate(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; };
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[0]).hex;
  const texteSur = (id) => (id === 'jaune' ? '#141414' : '#fff');
  const telephone = () => matchMedia('(max-width:720px)').matches;
  const sourisFine = () => matchMedia('(pointer:fine)').matches;
  const UNITE = (p) => (p.ouvres ? 'jours ouvrés' : 'jours calendaires');
  const j = (n, p) => `${n} ${p?.ouvres ? 'j ouvr.' : 'j'}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'gantt';
  let planningCritique = null;
  const historique = [];

  const etatVide = () => ({ version: 1, plannings: [], taches: [], reperes: [], periodes: [], planningActif: null, enchainer: true });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d };
    n.plannings = (Array.isArray(d.plannings) ? d.plannings : []).filter((p) => p && p.id).map((p) => ({
      nom: 'Planning', couleur: 'bleu', debut: auj(), ouvres: true, alsace: false, masque: false, ...p,
      sections: (Array.isArray(p.sections) ? p.sections : []).filter((s) => s && s.id).map((s) => ({ nom: 'Section', replie: false, masque: false, ...s })),
    }));
    const ids = new Set(n.plannings.map((p) => p.id));
    n.taches = (Array.isArray(d.taches) ? d.taches : []).filter((t) => t && t.id && ids.has(t.planningId)).map((t) => ({
      nom: 'Tâche', sectionId: null, debut: null, duree: 1, avancement: 0, plage: null, reference: null, note: '', ...t,
      deps: (Array.isArray(t.deps) ? t.deps : []).filter((x) => x && x.id && R.TYPES.includes(x.type)).map((x) => ({ id: x.id, type: x.type, decalage: Number(x.decalage) || 0 })),
    }));
    n.reperes = Array.isArray(d.reperes) ? d.reperes.filter((x) => x && R.estIso(x.date)) : [];
    n.periodes = Array.isArray(d.periodes) ? d.periodes.filter((x) => x && R.estIso(x.debut) && R.estIso(x.fin)) : [];
    if (!ids.has(n.planningActif)) n.planningActif = n.plannings[0]?.id || null;
    return n;
  };
  const planning = (id) => E.plannings.find((p) => p.id === id);
  const tache = (id) => E.taches.find((t) => t.id === id);

  // Préférences d'affichage propres à l'appareil (zoom, calques, colonnes).
  const AFFICHAGE_DEFAUT = { zoom: 14, colonnes: true, calques: { liens: true, critique: true, reference: true, reperes: true, periodes: true, feries: true, weekends: true } };
  let A = (() => { const a = stock.lire(CLE_AFFICHAGE) || {}; return { ...AFFICHAGE_DEFAUT, ...a, calques: { ...AFFICHAGE_DEFAUT.calques, ...(a.calques || {}) } }; })();
  const sauverAffichage = () => stock.ecrire(CLE_AFFICHAGE, A);

  // ---------- Calculs (ordonnancement de chaque planning) ----------
  let C = null;
  function calculs() {
    if (C) return C;
    const t = auj();
    C = new Map();
    for (const p of E.plannings) {
      const cal = R.calendrier({ ouvres: p.ouvres, alsace: p.alsace });
      const liste = R.ordreAffichage(p, E.taches);
      const o = R.ordonnancer(liste, cal, p.debut);
      const num = new Map(liste.map((x, i) => [x.id, i + 1]));
      C.set(p.id, { p, cal, liste, o, num, aujIdx: cal.idx(t) });
    }
    return C;
  }
  const res = (t) => calculs().get(t.planningId).o.taches.get(t.id);
  const statutDe = (t) => { const c = calculs().get(t.planningId); return R.statut(c.o.taches.get(t.id), t.avancement, c.aujIdx); };
  const finPlanning = (c) => [...c.o.taches.values()].reduce((m, r) => (r.fin > m ? r.fin : m), c.liste.length ? '0000-00-00' : c.p.debut);
  const debutPlanning = (c) => [...c.o.taches.values()].reduce((m, r) => (r.debut < m ? r.debut : m), c.liste.length ? '9999-12-31' : c.p.debut);
  const depsTexte = (t, c) => t.deps.map((d) => R.ecrireDep(c.num.get(d.id) ?? '?', d.type, d.decalage)).join(', ');

  // ---------- Annuler ----------
  function memo() {
    historique.push(JSON.stringify(E));
    if (historique.length > 40) historique.shift();
  }
  function annuler() {
    if (!historique.length) { toast('Rien à annuler.'); return; }
    const majLe = E.majLe;
    E = normaliser(JSON.parse(historique.pop()));
    if (majLe) E.majLe = majLe;
    sauver(); rendre(); toast('Dernière modification annulée.');
  }

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye }, !session.memoriser);
  }

  function sauver() {
    C = null;
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
        C = null; cache(false); rendre();
        toast('Un autre appareil a modifié tes plannings entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
        C = null; cache(false); rendre();
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
  // Code GNT-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  const estCodeInterne = (n) => /^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3));
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne QME (3 lettres dont une hors hexadécimal) : un code d'un autre template est mis en forme
    // lui aussi, pour que le serveur le reconnaisse et qu'on le refuse clairement.
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
      C = null; demarrer(); envoyer();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    C = null;
    if (E && E.plannings.length) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d ? normaliser(d) : donneesDemo();
    C = null; historique.length = 0;
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; C = null;
    historique.length = 0;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Plannings : création ----------
  function creerPlanning({ nom, debut, ouvres, modele, couleurId }) {
    const p = { id: uid(), nom, couleur: couleurId || B.couleurs[E.plannings.length % B.couleurs.length].id, debut, ouvres, alsace: false, masque: false, sections: [] };
    if (modele) {
      const { sections, taches } = R.instancierModele(modele, debut, uid);
      p.sections = sections.map((s) => ({ ...s, masque: false }));
      E.taches.push(...taches.map((t) => ({ ...t, planningId: p.id })));
    }
    E.plannings.push(p);
    E.planningActif = p.id;
    return p;
  }

  // Données de démonstration : trois plannings visibles et un masqué, dates relatives à aujourd'hui.
  function donneesDemo() {
    E = etatVide();
    const t = auj();
    const modele = (id) => B.modeles.find((m) => m.id === id);
    const avancer = (p, ajuste = {}) => {
      C = null;
      const c = calculs().get(p.id);
      for (const x of c.liste) {
        const r = c.o.taches.get(x.id);
        x.avancement = Math.round((R.attendu(r, c.aujIdx) * 100) / 10) * 10;
        if (ajuste[x.nom] !== undefined) x.avancement = ajuste[x.nom];
      }
    };
    const parNom = (p, nom) => E.taches.find((x) => x.planningId === p.id && x.nom === nom);

    // 1. Cuisine : démarrée il y a cinq semaines, référence figée au départ puis plomberie rallongée.
    const cuisine = creerPlanning({ nom: 'Rénovation de cuisine', debut: ajout(t, -36), ouvres: true, modele: modele('cuisine'), couleurId: 'orange' });
    C = null;
    { const c = calculs().get(cuisine.id); for (const x of c.liste) { const r = c.o.taches.get(x.id); x.reference = { debut: r.debut, fin: r.fin }; } }
    parNom(cuisine, 'Plomberie (arrivées, évacuations)').duree = 5;
    parNom(cuisine, 'Plomberie (arrivées, évacuations)').note = 'Reprise d\'une évacuation imprévue : 2 jours de plus.';
    avancer(cuisine, { 'Plâtrerie et reprise des murs': 40, 'Dépose de l\'ancienne cuisine': 100 });

    // 2. Site web : en cours, intégration en retard, mise en ligne hors de sa plage.
    const site = creerPlanning({ nom: 'Lancement du site web', debut: ajout(t, -26), ouvres: true, modele: modele('site'), couleurId: 'bleu' });
    avancer(site, { 'Intégration et développement': 20, 'Rédaction des contenus': 60 });
    const miseEnLigne = parNom(site, 'Mise en ligne');
    miseEnLigne.plage = { debut: ajout(t, 5), fin: ajout(t, 15) };
    parNom(site, 'Arborescence et contenus attendus').note = 'Validée en atelier.';
    E.reperes.push({ id: uid(), planningId: site.id, date: ajout(t, 9), nom: 'Comité de pilotage' });
    E.periodes.push({ id: uid(), planningId: site.id, debut: ajout(t, 18), fin: ajout(t, 22), nom: 'Congés de l\'équipe' });

    // 3. Salon : à venir, une section repliée.
    const salon = creerPlanning({ nom: 'Salon professionnel', debut: ajout(t, 12), ouvres: true, modele: modele('salon'), couleurId: 'vert' });
    salon.sections[3].replie = true;

    // 4. Déménagement : masqué (panneau Affichage).
    const dem = creerPlanning({ nom: 'Déménagement du bureau', debut: ajout(t, 40), ouvres: false, modele: modele('demenagement'), couleurId: 'prune' });
    dem.masque = true;

    // Repère et période communs.
    E.reperes.push({ id: uid(), planningId: null, date: ajout(t, 3), nom: 'Point d\'étape' });
    const an = Number(t.slice(0, 4));
    const noel = t > `${an}-12-20` ? an + 1 : an;
    E.periodes.push({ id: uid(), planningId: null, debut: `${noel}-12-24`, fin: `${noel + 1}-01-01`, nom: 'Fermeture de fin d\'année' });
    E.planningActif = cuisine.id;
    C = null;
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Planning Gantt · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="0" y="30" width="250" height="44" fill="#F5B400"/>
          <rect x="120" y="98" width="300" height="44" fill="#1D4E89"/>
          <rect x="300" y="166" width="220" height="44" fill="#D9302A"/>
          <path d="M520 234 L548 262 L520 290 L492 262 Z" fill="#F0EDE6"/>
          <path d="M250 52 H270 V120 H290" fill="none" stroke="#F0EDE6" stroke-width="6"/>
          <path d="M420 120 H440 V188 H460" fill="none" stroke="#F0EDE6" stroke-width="6"/>
          <circle cx="60" cy="230" r="56" fill="#F0EDE6"/>
          <circle cx="60" cy="230" r="20" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Planning Gantt · chemin critique</p>
          <h1>Ton planning en une ligne par tâche.</h1>
          <p>Tape « Maquette 12/11 5j après 2 » : la barre, le lien et les dates suivent. Jours fériés, jours ouvrés et chemin critique sont calculés pour toi.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes plannings</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes plannings sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes plannings</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const fin = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (fin) champ.setSelectionRange(champ.value.length, champ.value.length);
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes plannings'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { modele: null, nom: '', debut: null, ouvres: true };

  function ecranAccueil() {
    const a = accueil;
    a.debut ||= auj();
    document.title = 'Premier planning · Planning Gantt';
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>On crée ton premier planning.</h1>
        <p class="intro">Pars d'un des ${B.modeles.length} modèles (tâches, durées indicatives et liens déjà posés) ou d'un planning vide. Tout reste modifiable ensuite, et tu pourras ajouter d'autres plannings.</p>
        <div class="modeles" role="group" aria-label="Modèle de départ">
          <button type="button" class="modele" data-action="accueil-modele" data-id="" aria-pressed="${a.modele === ''}" style="--c:var(--trait)"><b>Planning vide</b><span>Je saisis mes tâches moi-même.</span></button>
          ${B.modeles.map((m, i) => `<button type="button" class="modele" data-action="accueil-modele" data-id="${m.id}" aria-pressed="${a.modele === m.id}" style="--c:${couleur(B.couleurs[i % 5].id)}"><small>${esc(m.categorie)} · ${pluriel(m.taches.length, 'tâche')}</small><b>${esc(m.nom)}</b><span>${esc(m.description)}</span></button>`).join('')}
        </div>
        <form id="form-accueil" class="accueil-form">
          <label class="champ">Nom du planning<input id="accueil-nom" name="nom" required maxlength="80" value="${esc(a.nom)}" placeholder="Ex. : Rénovation de la cuisine"></label>
          <label class="champ">Date de début<input type="date" id="accueil-debut" name="debut" required value="${a.debut}"></label>
          <label class="case"><input type="checkbox" id="accueil-ouvres" ${a.ouvres ? 'checked' : ''}> Compter en jours ouvrés (sans week-ends ni jours fériés)</label>
          <p class="erreur" id="erreur-accueil" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit" ${a.modele === null ? 'disabled' : ''}>Créer mon planning</button></div>
        </form>
      </div>`;
    $('#accueil-nom').addEventListener('input', (e) => { accueil.nom = e.target.value; });
    $('#accueil-debut').addEventListener('change', (e) => { accueil.debut = e.target.value; });
    $('#accueil-ouvres').addEventListener('change', (e) => { accueil.ouvres = e.target.checked; });
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = accueil.nom.trim();
      if (!nom) { $('#erreur-accueil').textContent = 'Donne un nom à ton planning.'; $('#accueil-nom').focus(); return; }
      if (!R.estIso(accueil.debut)) { $('#erreur-accueil').textContent = 'Indique une date de début.'; return; }
      E = etatVide();
      creerPlanning({ nom, debut: accueil.debut, ouvres: accueil.ouvres, modele: B.modeles.find((m) => m.id === accueil.modele) });
      accueil = { modele: null, nom: '', debut: null, ouvres: true };
      sauver();
      vue = 'gantt';
      demarrer();
      setTimeout(() => $('#saisie')?.focus(), 200);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    gantt: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="10" height="4" fill="currentColor"/><rect x="7" y="10" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="16" width="9" height="4" fill="currentColor"/></svg>',
    plannings: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    critique: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    suivi: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4 A8 8 0 0 1 20 12 H12Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    chevron: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 2 9 6 3 10Z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['gantt', 'Gantt'], ['plannings', 'Plannings'], ['critique', 'Chemin critique'], ['suivi', 'Suivi']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Planning<br>Gantt</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    premierAffichage = true;
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    C = null;
    $$('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { gantt: 'Gantt', plannings: 'Plannings', critique: 'Chemin critique', suivi: 'Suivi' };
    document.title = `${titres[vue]} · Planning Gantt`;
    document.body.dataset.vue = vue;
    $('#vue').innerHTML = { gantt: vueGantt, plannings: vuePlannings, critique: vueCritique, suivi: vueSuivi }[vue]();
    if (vue === 'gantt') dessinerGantt();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    if (v === 'gantt') premierAffichage = true;
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="12" width="60" height="18" fill="#1D4E89"/><rect x="24" y="40" width="60" height="18" fill="#F5B400"/><rect x="40" y="68" width="56" height="18" fill="#D9302A"/></svg>';

  // ============ Vue Gantt ============
  let premierAffichage = true;
  let sectionSaisie = {}; // section courante de la saisie rapide, par planning

  function vueGantt() {
    const visibles = E.plannings.filter((p) => !p.masque);
    const actif = planning(E.planningActif) || E.plannings[0];
    const masques = E.plannings.length - visibles.length;
    const sec = actif ? actif.sections.find((s) => s.id === sectionCourante(actif)) : null;
    return `
      <div class="vue-tete"><div><h1>Gantt</h1><p>Une ligne par tâche : nom, date, durée, avancement et liens. Le tableau et les barres restent synchronisés.</p></div>
        <div class="actions"><button class="btn" data-action="affichage">Affichage${masques ? ` <span class="pastille">${masques} masqué${masques > 1 ? 's' : ''}</span>` : ''}</button><button class="btn" data-action="imprimer">Imprimer / PNG</button><button class="btn primaire" data-action="planning-nouveau">${ICONES.plus}Planning</button></div></div>
      ${E.plannings.length ? `
      <form class="saisie" id="form-saisie" autocomplete="off">
        <div class="saisie-ligne">
          ${E.plannings.length > 1 ? `<label class="sr-only" for="saisie-planning">Planning</label><select id="saisie-planning" class="saisie-planning" style="--c:${couleur(actif.couleur)}">${E.plannings.map((p) => `<option value="${p.id}" ${p.id === actif.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select>` : ''}
          <label class="sr-only" for="saisie">Saisie rapide</label>
          <input id="saisie" class="saisie-champ" placeholder="Ex. : Maquette accueil ${fmtCourt(ajout(auj(), 1))} 5j 40% après 2" enterkeyhint="done" spellcheck="false">
          <button class="btn primaire" type="submit">Ajouter</button>
        </div>
        <div class="saisie-aide">
          <label class="case petite"><input type="checkbox" id="enchainer" ${E.enchainer ? 'checked' : ''}> Enchaîner : une tâche sans date suit la précédente</label>
          <span>${sec ? `Section : <b>${esc(sec.nom)}</b> <button type="button" class="lien-mini" data-action="section-saisie-fin">hors section</button>` : 'Section : <b>aucune</b>'} · <button type="button" class="lien-mini" data-action="aide-saisie">Syntaxe</button></span>
        </div>
      </form>
      <div class="outils-gantt">
        <div class="zoom" role="group" aria-label="Zoom">
          <button class="btn petit" data-action="zoom-moins" aria-label="Dézoomer">−</button>
          <input type="range" id="zoom" min="0" max="1000" value="${zoomVersCurseur(A.zoom)}" aria-label="Zoom">
          <button class="btn petit" data-action="zoom-plus" aria-label="Zoomer">+</button>
          <span class="zoom-niveau" id="zoom-niveau">${{ jour: 'Jours', semaine: 'Semaines', mois: 'Mois', trimestre: 'Trimestres', annee: 'Années' }[R.niveauEchelle(A.zoom)]}</span>
        </div>
        <button class="btn petit" data-action="aujourdhui">Aujourd'hui</button>
        <button class="btn petit" data-action="ajuster">Ajuster</button>
        <button class="btn petit" data-action="annuler" ${historique.length ? '' : 'disabled'}>Annuler</button>
        <button class="btn petit masque-tel" data-action="colonnes">${A.colonnes ? 'Masquer les colonnes' : 'Afficher les colonnes'}</button>
        <button class="btn petit masque-tel" data-action="repere-nouveau">Repère</button>
        <button class="btn petit masque-tel" data-action="periode-nouvelle">Période</button>
      </div>
      <div class="gantt-zone"><div class="gcadre" id="gcadre"></div><div class="infobulle" hidden></div></div>
      <div class="legende-gantt" aria-label="Légende">
        <span><i class="lg-barre"></i>Tâche (partie pleine = avancement)</span>
        <span><i class="lg-critique"></i>Chemin critique</span>
        <span><i class="lg-jalon"></i>Jalon</span>
        <span><i class="lg-plage"></i>Plage du jalon</span>
        <span><i class="lg-ref"></i>Référence</span>
        <span><i class="lg-hachure"></i>Férié ou période</span>
        <span><i class="lg-auj"></i>Aujourd'hui</span>
      </div>
      <p class="note-pied">${sourisFine() ? 'Glisse une barre pour la déplacer, son bord droit pour changer sa durée, le rond au bout pour créer un lien. Ctrl + molette pour zoomer.' : 'Touche une tâche pour la modifier. Pince l\'écran pour zoomer.'}</p>`
      : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun planning</h3><p>Crée un planning vide ou à partir d'un modèle.</p><div class="actions"><button class="btn primaire" data-action="planning-nouveau">${ICONES.plus}Créer un planning</button></div></div></div>`}`;
  }

  // Zoom continu : curseur logarithmique.
  const zoomVersCurseur = (z) => Math.round((Math.log(z / R.ZOOM_MIN) / Math.log(R.ZOOM_MAX / R.ZOOM_MIN)) * 1000);
  const curseurVersZoom = (v) => R.ZOOM_MIN * (R.ZOOM_MAX / R.ZOOM_MIN) ** (v / 1000);

  // Lignes affichées (plannings visibles, sections non masquées, sections repliées).
  function lignesGantt(filtre = null, toutDeplier = false) {
    const L = [];
    for (const p of E.plannings) {
      if (filtre ? !filtre.includes(p.id) : p.masque) continue;
      const c = calculs().get(p.id);
      L.push({ type: 'planning', p, c });
      const ids = new Set(p.sections.map((s) => s.id));
      c.liste.filter((x) => !x.sectionId || !ids.has(x.sectionId)).forEach((t) => L.push({ type: 'tache', t, p, c }));
      for (const s of p.sections) {
        if (s.masque && !toutDeplier) continue;
        const ts = c.liste.filter((x) => x.sectionId === s.id);
        L.push({ type: 'section', s, p, c, ts });
        if (!s.replie || toutDeplier) ts.forEach((t) => L.push({ type: 'tache', t, p, c }));
      }
    }
    return L;
  }

  function etendue(L) {
    let de = auj(), a = auj();
    const voir = (d) => { if (d < de) de = d; if (d > a) a = d; };
    for (const l of L) {
      if (l.type === 'planning') { voir(l.p.debut); continue; }
      if (l.type !== 'tache') continue;
      const r = l.c.o.taches.get(l.t.id);
      voir(r.debut); voir(r.fin);
      if (l.t.plage) { voir(l.t.plage.debut); voir(l.t.plage.fin); }
      if (l.t.reference) { voir(l.t.reference.debut); voir(l.t.reference.fin); }
    }
    return { de, a };
  }

  const PALETTE = { encre: '#141414', papier: '#F0EDE6', surface: '#FBFAF6', trait: '#D9D4C8', discret: '#5E5A52', texte2: '#45413A', rouge: '#D9302A', jaune: '#F5B400', bleu: '#1D4E89', weekend: '#ECE8DF', ref: '#8C877C' };
  const POLICE = 'Outfit, system-ui, sans-serif';
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS_INIT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  // Débuts des unités de temps entre de et a.
  function bornes(unite, de, a) {
    const l = [];
    const d0 = versDate(de);
    let d;
    if (unite === 'jour') d = new Date(d0);
    else if (unite === 'semaine') { d = new Date(d0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); }
    else if (unite === 'mois') d = new Date(d0.getFullYear(), d0.getMonth(), 1);
    else if (unite === 'trimestre') d = new Date(d0.getFullYear(), Math.floor(d0.getMonth() / 3) * 3, 1);
    else d = new Date(d0.getFullYear(), 0, 1);
    const fin = versDate(a);
    while (d <= fin) {
      l.push(R.iso(d));
      if (unite === 'jour') d.setDate(d.getDate() + 1);
      else if (unite === 'semaine') d.setDate(d.getDate() + 7);
      else if (unite === 'mois') d.setMonth(d.getMonth() + 1);
      else if (unite === 'trimestre') d.setMonth(d.getMonth() + 3);
      else d.setFullYear(d.getFullYear() + 1);
    }
    return l;
  }

  // Échelle de temps (deux bandeaux) : G = { de, a, Z, largeur, H }.
  function svgEchelle(G) {
    const x = (d) => ecart(G.de, d) * G.Z;
    const niveau = R.niveauEchelle(G.Z);
    const haut = { jour: 'mois', semaine: 'mois', mois: 'annee', trimestre: 'annee', annee: null }[niveau];
    const h1 = G.H / 2;
    let s = `<rect x="0" y="0" width="${G.largeur}" height="${G.H}" fill="${PALETTE.surface}"/>`;
    if (haut) {
      for (const d of bornes(haut, G.de, G.a)) {
        const x0 = Math.max(0, x(d));
        const dt = versDate(d);
        const suiv = haut === 'mois' ? R.iso(new Date(dt.getFullYear(), dt.getMonth() + 1, 1)) : `${dt.getFullYear() + 1}-01-01`;
        const larg = Math.min(G.largeur, x(suiv)) - x0;
        const lib = haut === 'annee' ? String(dt.getFullYear()) : larg > 120 ? `${MOIS_LONGS[dt.getMonth()]} ${dt.getFullYear()}` : larg > 52 ? `${MOIS_COURTS[dt.getMonth()]} ${String(dt.getFullYear()).slice(2)}` : larg > 22 ? MOIS_COURTS[dt.getMonth()].slice(0, 3) : '';
        s += `<line x1="${x(d)}" x2="${x(d)}" y1="0" y2="${G.H}" stroke="${PALETTE.encre}" stroke-width="1"/>`;
        if (lib && larg > 0) s += `<text class="etiq-haut" data-x0="${x(d)}" data-x1="${x(suiv)}" x="${x0 + 6}" y="${h1 - 7}" font-size="12" font-weight="700" fill="${PALETTE.encre}" font-family="${POLICE}">${lib}</text>`;
      }
    }
    s += `<line x1="0" x2="${G.largeur}" y1="${h1}" y2="${h1}" stroke="${PALETTE.trait}"/>`;
    const pas = { jour: 1, semaine: 7, mois: 30.4, trimestre: 91, annee: 365 }[niveau] * G.Z;
    for (const d of bornes(niveau, G.de, G.a)) {
      const dt = versDate(d);
      let lib = '';
      if (niveau === 'jour') lib = G.Z >= 28 ? `${JOURS_INIT[dt.getDay()]} ${dt.getDate()}` : String(dt.getDate());
      else if (niveau === 'semaine') lib = pas >= 44 ? `S${R.semaineIso(d)} · ${dt.getDate()}` : pas >= 26 ? `S${R.semaineIso(d)}` : '';
      else if (niveau === 'mois') lib = pas >= 34 ? MOIS_COURTS[dt.getMonth()] : MOIS_COURTS[dt.getMonth()][0].toUpperCase();
      else if (niveau === 'trimestre') lib = `T${Math.floor(dt.getMonth() / 3) + 1}`;
      else lib = String(dt.getFullYear());
      const we = niveau === 'jour' && (dt.getDay() === 0 || dt.getDay() === 6);
      if (we) s += `<rect x="${x(d)}" y="${h1}" width="${G.Z}" height="${h1}" fill="${PALETTE.weekend}"/>`;
      s += `<line x1="${x(d)}" x2="${x(d)}" y1="${h1}" y2="${G.H}" stroke="${PALETTE.trait}"/>`;
      if (lib && x(d) >= -pas) s += `<text x="${niveau === 'jour' ? x(d) + G.Z / 2 : x(d) + 4}" y="${G.H - 7}" font-size="11" ${niveau === 'jour' ? 'text-anchor="middle"' : ''} fill="${PALETTE.texte2}" font-family="${POLICE}" font-weight="600">${lib}</text>`;
    }
    const t = auj();
    if (t >= G.de && t <= G.a) s += `<rect x="${x(t)}" y="${h1}" width="${Math.max(2, G.Z)}" height="${h1}" fill="${PALETTE.jaune}" opacity="${G.Z >= 6 ? 1 : 0}"/><line x1="${x(t) + G.Z / 2}" x2="${x(t) + G.Z / 2}" y1="${h1}" y2="${G.H}" stroke="${PALETTE.rouge}" stroke-width="2"/>`;
    s += `<line x1="0" x2="${G.largeur}" y1="${G.H - 1}" y2="${G.H - 1}" stroke="${PALETTE.encre}" stroke-width="2"/>`;
    return s;
  }

  const defs = (p) => `<defs>
    <pattern id="${p}h" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="7" height="7" fill="${PALETTE.surface}" fill-opacity="0"/><rect width="2.2" height="7" fill="#B9B3A6"/></pattern>
    <pattern id="${p}hr" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(135)"><rect width="2" height="7" fill="#C9C2B4"/></pattern>
    <marker id="${p}f" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 8,4 0,8Z" fill="${PALETTE.encre}"/></marker>
    <marker id="${p}fr" viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 8,4 0,8Z" fill="${PALETTE.rouge}"/></marker>
  </defs>`;

  // Corps du Gantt : G = { de, a, Z, largeur, ROW, interactif, prefixe }.
  function svgCorps(L, G) {
    const x = (d) => ecart(G.de, d) * G.Z;
    const ROW = G.ROW, H = Math.max(L.length * ROW, ROW);
    const cq = G.calques || A.calques;
    let fond = '', avant = '', liens = '', barres = '', dessus = '';
    // Week-ends.
    if (cq.weekends && G.Z >= 3.5) {
      for (const d of bornes('semaine', ajout(G.de, -7), G.a)) { const sam = ajout(d, 5); fond += `<rect x="${x(sam)}" y="0" width="${2 * G.Z}" height="${H}" fill="${PALETTE.weekend}"/>`; }
    }
    // Grille verticale.
    const niveau = R.niveauEchelle(G.Z);
    for (const d of bornes(niveau, G.de, G.a)) fond += `<line x1="${x(d)}" x2="${x(d)}" y1="0" y2="${H}" stroke="#E4DFD4" stroke-width="1"/>`;
    // Rangées : bandes des plannings.
    const bloc = new Map();
    L.forEach((l, i) => { const b = bloc.get(l.p.id) || { de: i, a: i }; b.a = i; bloc.set(l.p.id, b); });
    // Fériés (période hachurée sur toute la hauteur ; Alsace-Moselle : sur les plannings concernés).
    if (cq.feries && G.Z >= 0.9) {
      for (const f of R.feriesEntre(G.de, G.a)) fond += `<rect x="${x(f.date)}" y="0" width="${Math.max(1.5, G.Z)}" height="${H}" fill="url(#${G.prefixe}h)"><title>${esc(f.nom)} (férié)</title></rect>`;
      for (const p of E.plannings.filter((q) => q.alsace && bloc.has(q.id))) {
        const b = bloc.get(p.id);
        for (const f of R.feriesEntre(G.de, G.a, true).filter((y) => /Alsace/.test(y.nom))) fond += `<rect x="${x(f.date)}" y="${b.de * ROW}" width="${Math.max(1.5, G.Z)}" height="${(b.a - b.de + 1) * ROW}" fill="url(#${G.prefixe}h)"><title>${esc(f.nom)}</title></rect>`;
      }
    }
    // Périodes hachurées (communes ou propres à un planning).
    if (cq.periodes) {
      for (const pe of E.periodes) {
        if (pe.fin < G.de || pe.debut > G.a) continue;
        const b = pe.planningId ? bloc.get(pe.planningId) : { de: 0, a: L.length - 1 };
        if (!b) continue;
        const x0 = x(pe.debut), w = x(pe.fin) + G.Z - x0, y0 = b.de * ROW, h = (b.a - b.de + 1) * ROW;
        fond += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="url(#${G.prefixe}hr)" opacity=".9"/><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="none" stroke="#B9B3A6" stroke-dasharray="4 3"/>`;
        if (w > 30) avant += `<text x="${x0 + 4}" y="${y0 + 12}" font-size="10" font-weight="700" fill="${PALETTE.texte2}" font-family="${POLICE}">${esc(pe.nom)}</text>`;
      }
    }
    // Lignes horizontales.
    L.forEach((l, i) => {
      if (l.type === 'planning') fond += `<rect x="0" y="${i * ROW}" width="${G.largeur}" height="${ROW}" fill="${PALETTE.papier}" opacity=".7"/><line x1="0" x2="${G.largeur}" y1="${i * ROW}" y2="${i * ROW}" stroke="${PALETTE.encre}" stroke-width="${i ? 2 : 0}"/>`;
      fond += `<line x1="0" x2="${G.largeur}" y1="${(i + 1) * ROW}" y2="${(i + 1) * ROW}" stroke="#E9E5DB"/>`;
    });
    // Barres.
    const pos = new Map();
    const bh = Math.round(ROW * 0.46), by = Math.round((ROW - bh) / 2) - (cq.reference ? 2 : 0);
    L.forEach((l, i) => {
      const y = i * ROW;
      if (l.type === 'planning') {
        if (!l.c.liste.length) return;
        const x0 = x(debutPlanning(l.c)), x1 = x(finPlanning(l.c)) + G.Z;
        barres += `<rect x="${x0}" y="${y + ROW / 2 - 4}" width="${Math.max(2, x1 - x0)}" height="8" fill="${couleur(l.p.couleur)}" stroke="${PALETTE.encre}" stroke-width="1.5"/>`;
        return;
      }
      if (l.type === 'section') {
        if (!l.ts.length) return;
        const rs = l.ts.map((t) => l.c.o.taches.get(t.id));
        const x0 = x(rs.reduce((m, r) => (r.debut < m ? r.debut : m), rs[0].debut));
        const x1 = x(rs.reduce((m, r) => (r.fin > m ? r.fin : m), rs[0].fin)) + G.Z;
        const ym = y + ROW / 2;
        barres += `<path d="M${x0} ${ym - 3} H${x1} V${ym + 6} L${x1 - 5} ${ym + 2} H${x0 + 5} L${x0} ${ym + 6} Z" fill="${PALETTE.encre}"/>`;
        return;
      }
      const t = l.t, r = l.c.o.taches.get(t.id);
      const st = R.statut(r, t.avancement, l.c.aujIdx);
      const crit = cq.critique && r.critique;
      const col = couleur(l.p.couleur);
      const ym = y + by + bh / 2;
      // Référence.
      if (cq.reference && t.reference) {
        const rx0 = x(t.reference.debut), rx1 = r.dur ? x(t.reference.fin) + G.Z : rx0 + G.Z / 2;
        avant += `<rect x="${rx0}" y="${y + by + bh + 3}" width="${Math.max(3, rx1 - rx0)}" height="4" fill="${PALETTE.ref}"/>`;
      }
      let finX;
      const action = G.interactif ? ` data-tache="${t.id}" data-action="tache-modifier" data-id="${t.id}"` : '';
      if (r.dur === 0) {
        const cx = x(r.debut) + G.Z / 2, dm = Math.min(bh / 2 + 3, 10);
        if (t.plage) {
          const ep = R.etatPlage(r.debut, t.plage);
          const pc = ep.code === 'depasse' ? PALETTE.rouge : PALETTE.encre;
          const px0 = x(t.plage.debut), px1 = x(t.plage.fin) + G.Z;
          barres += `<path d="M${px0} ${ym - 7} V${ym + 7} M${px0} ${ym} H${px1} M${px1} ${ym - 7} V${ym + 7}" stroke="${pc}" stroke-width="2" fill="none" ${ep.code === 'depasse' ? '' : 'stroke-dasharray="5 3"'}/>`;
          finX = Math.max(px1, cx + dm);
        }
        barres += `<g class="gbarre"${action}><path d="M${cx} ${ym - dm} L${cx + dm} ${ym} L${cx} ${ym + dm} L${cx - dm} ${ym} Z" fill="${t.avancement >= 100 ? PALETTE.encre : crit ? PALETTE.rouge : col}" stroke="${crit ? PALETTE.rouge : PALETTE.encre}" stroke-width="2"><title>${esc(t.nom)}</title></path>${G.interactif ? `<circle class="poignee" data-role="poignee" cx="${cx + dm + 5}" cy="${ym}" r="5" fill="${PALETTE.papier}" stroke="${PALETTE.encre}" stroke-width="2"/>` : ''}</g>`;
        pos.set(t.id, { d: cx - dm, f: cx + dm, y: ym });
        finX = Math.max(finX || 0, cx + dm);
      } else {
        const x0 = x(r.debut), x1 = x(r.fin) + G.Z, w = Math.max(2, x1 - x0);
        const av = Math.min(100, Math.max(0, t.avancement || 0));
        barres += `<g class="gbarre"${action}>
          <rect data-role="barre" x="${x0}" y="${y + by}" width="${w}" height="${bh}" fill="${col}" fill-opacity=".3" stroke="none"/>
          ${av ? `<rect data-role="barre" x="${x0}" y="${y + by}" width="${(w * av) / 100}" height="${bh}" fill="${col}"/>` : ''}
          <rect data-role="barre" x="${x0}" y="${y + by}" width="${w}" height="${bh}" fill="none" stroke="${crit ? PALETTE.rouge : PALETTE.encre}" stroke-width="${crit ? 3 : 1.5}"><title>${esc(t.nom)}</title></rect>
          ${G.interactif ? `<rect class="bord" data-role="bord" x="${x1 - 5}" y="${y + by}" width="8" height="${bh}" fill="transparent"/><circle class="poignee" data-role="poignee" cx="${x1 + 8}" cy="${ym}" r="5" fill="${PALETTE.papier}" stroke="${PALETTE.encre}" stroke-width="2"/>` : ''}
        </g>`;
        pos.set(t.id, { d: x0, f: x1, y: ym });
        finX = x1;
      }
      // Étiquette à droite de la barre.
      const lib = `${esc(t.nom)}${t.avancement > 0 && t.avancement < 100 ? ` · ${t.avancement} %` : ''}`;
      const alerte = st.code === 'retard' ? ` · retard ${st.retard} j` : '';
      const fait = st.code === 'termine' ? ' ✓' : '';
      const ep = t.plage ? R.etatPlage(r.debut, t.plage) : null;
      const alertePlage = ep?.code === 'depasse' ? ` · hors plage (+${ep.jours} j)` : '';
      if (G.etiquettes !== false) barres += `<text x="${finX + (G.interactif ? 18 : 6)}" y="${ym + 4}" font-size="${G.police || 12}" fill="${PALETTE.texte2}" font-family="${POLICE}">${lib}<tspan fill="${PALETTE.encre}" font-weight="700">${fait}</tspan><tspan fill="${PALETTE.rouge}" font-weight="700">${alerte}${alertePlage}</tspan></text>`;
    });
    // Liens à angle droit.
    if (cq.liens) {
      L.forEach((l) => {
        if (l.type !== 'tache') return;
        const ps = pos.get(l.t.id);
        if (!ps) return;
        for (const d of l.t.deps) {
          const pp = pos.get(d.id);
          if (!pp) continue;
          const rP = l.c.o.taches.get(d.id), rS = l.c.o.taches.get(l.t.id);
          const crit = cq.critique && rP?.critique && rS?.critique;
          const sortieFin = d.type === 'FD' || d.type === 'FF';
          const entreeDebut = d.type === 'FD' || d.type === 'DD';
          const sx = sortieFin ? pp.f : pp.d, sy = pp.y;
          const tx = entreeDebut ? ps.d : ps.f, ty = ps.y;
          const p1 = sx + (sortieFin ? 8 : -8);
          const simple = entreeDebut ? p1 <= tx - 4 : p1 >= tx + 4;
          const p3 = tx + (entreeDebut ? -8 : 8);
          const yb = sy + (ty > sy ? ROW / 2 : -ROW / 2);
          const dch = simple ? `M${sx} ${sy} H${p1} V${ty} H${tx}` : `M${sx} ${sy} H${p1} V${yb} H${p3} V${ty} H${tx}`;
          liens += `<path d="${dch}" fill="none" stroke="${crit ? PALETTE.rouge : PALETTE.encre}" stroke-width="${crit ? 2 : 1.3}" marker-end="url(#${G.prefixe}${crit ? 'fr' : 'f'})"/>`;
        }
      });
    }
    // Repères et aujourd'hui.
    if (cq.reperes) {
      for (const rp of E.reperes) {
        if (rp.date < G.de || rp.date > G.a) continue;
        const b = rp.planningId ? bloc.get(rp.planningId) : { de: 0, a: L.length - 1 };
        if (!b) continue;
        const xm = x(rp.date) + G.Z / 2;
        avant += `<line x1="${xm}" x2="${xm}" y1="${b.de * ROW}" y2="${(b.a + 1) * ROW}" stroke="${PALETTE.bleu}" stroke-width="2" stroke-dasharray="6 4"/>`;
        const lw = Math.min(180, rp.nom.length * 6.2 + 12);
        dessus += `<g${G.interactif ? ` data-action="repere-modifier" data-id="${rp.id}" style="cursor:pointer"` : ''}><rect x="${xm}" y="${b.de * ROW + 2}" width="${lw}" height="16" fill="${PALETTE.bleu}"/><text x="${xm + 5}" y="${b.de * ROW + 14}" font-size="10.5" font-weight="700" fill="#fff" font-family="${POLICE}">${esc(rp.nom)}</text></g>`;
      }
    }
    const t = auj();
    if (t >= G.de && t <= G.a) avant += `<line x1="${x(t) + G.Z / 2}" x2="${x(t) + G.Z / 2}" y1="0" y2="${H}" stroke="${PALETTE.rouge}" stroke-width="2"/>`;
    return { svg: `${defs(G.prefixe)}<g>${fond}</g><g>${avant}</g><g>${liens}</g><g>${barres}</g><g>${dessus}</g>`, H };
  }

  // Vue Gantt : tableau + barres dans un même cadre défilant (colonne de gauche et échelle collantes).
  let G = null;
  let lignesCourantes = [];

  function dessinerGantt() {
    const cadre = $('#gcadre');
    if (!cadre) return;
    const tel = telephone();
    const colonnes = A.colonnes && !tel;
    const ROW = tel ? 40 : 34;
    const TAB = tel ? 136 : colonnes ? 600 : 260;
    const L = lignesGantt();
    lignesCourantes = L;
    const { de, a } = etendue(L);
    const visible = Math.max(200, cadre.clientWidth - TAB);
    const Z = Math.min(R.ZOOM_MAX, Math.max(R.ZOOM_MIN, A.zoom));
    const deV = ajout(de, -Math.max(14, Math.ceil(60 / Z)));
    let aV = ajout(a, Math.max(30, Math.ceil(120 / Z)));
    const minJours = Math.ceil(visible / Z) + 2;
    if (ecart(deV, aV) < minJours) aV = ajout(deV, minJours);
    const largeur = Math.round((ecart(deV, aV) + 1) * Z);
    G = { de: deV, a: aV, Z, largeur, ROW, TAB, interactif: true, prefixe: 'g', H: 44 };
    const scrollAvant = { x: cadre.scrollLeft, y: cadre.scrollTop };
    const corps = svgCorps(L, G);
    const entete = colonnes
      ? '<div class="gcol gcol-tete"><span class="c-num">n°</span><span class="c-nom">Tâche</span><span class="c-debut">Début</span><span class="c-duree">Durée</span><span class="c-fin">Fin</span><span class="c-av">%</span><span class="c-dep">Liens</span></div>'
      : '<div class="gcol gcol-tete compacte"><span class="c-num">n°</span><span class="c-nom">Tâche</span></div>';
    cadre.style.setProperty('--row', `${ROW}px`);
    cadre.style.setProperty('--tab', `${TAB}px`);
    cadre.innerHTML = `
      <div class="ggrille" style="grid-template-columns:${TAB}px ${largeur}px">
        <div class="gcoin">${entete}</div>
        <div class="gechelle"><svg width="${largeur}" height="44" viewBox="0 0 ${largeur} 44" aria-hidden="true">${svgEchelle(G)}</svg></div>
        <div class="gtable" role="table" aria-label="Tâches">${L.map((l) => ligneTable(l, colonnes)).join('') || '<p class="gvide">Aucun planning affiché.</p>'}</div>
        <div class="gcorps"><svg width="${largeur}" height="${corps.H}" viewBox="0 0 ${largeur} ${corps.H}" role="img" aria-label="Diagramme de Gantt, détail dans le tableau">${corps.svg}</svg></div>
      </div>`;
    if (premierAffichage) {
      premierAffichage = false;
      cadre.scrollLeft = Math.max(0, ecart(deV, auj()) * Z - Math.min(visible / 3, 21 * Z));
    } else { cadre.scrollLeft = scrollAvant.x; cadre.scrollTop = scrollAvant.y; }
    const niv = $('#zoom-niveau');
    if (niv) niv.textContent = { jour: 'Jours', semaine: 'Semaines', mois: 'Mois', trimestre: 'Trimestres', annee: 'Années' }[R.niveauEchelle(Z)];
    caler(cadre);
    cadre.onscroll = () => caler(cadre);
    brancherGantt(cadre);
  }

  // Étiquettes du bandeau supérieur (mois, années) gardées visibles au défilement horizontal.
  function caler(cadre) {
    const gauche = cadre.scrollLeft;
    for (const t of cadre.querySelectorAll('.etiq-haut')) {
      const x0 = Number(t.dataset.x0), x1 = Number(t.dataset.x1);
      const w = t.getComputedTextLength ? t.getComputedTextLength() : 60;
      t.setAttribute('x', Math.max(x0 + 6, Math.min(gauche + 6, x1 - w - 6)));
    }
  }

  function ligneTable(l, colonnes) {
    if (l.type === 'planning') {
      const c = l.c;
      return `<div class="gl gl-planning" role="row" style="--c:${couleur(l.p.couleur)};--t:${texteSur(l.p.couleur)}"><button data-action="planning-modifier" data-id="${l.p.id}" title="Modifier le planning"><i></i><b>${esc(l.p.nom)}</b><span>${c.liste.length ? `${fmtCourt(debutPlanning(c))} → ${fmtCourt(finPlanning(c))}` : 'vide'}${l.p.ouvres ? ' · ouvrés' : ''}</span></button></div>`;
    }
    if (l.type === 'section') {
      return `<div class="gl gl-section" role="row"><button data-action="section-replier" data-id="${l.s.id}" data-planning="${l.p.id}" aria-expanded="${!l.s.replie}"><span class="chevron ${l.s.replie ? '' : 'ouvert'}">${ICONES.chevron}</span><b>${esc(l.s.nom)}</b><span>${pluriel(l.ts.length, 'tâche')}</span></button><button class="gl-plus" data-action="section-saisie" data-id="${l.s.id}" data-planning="${l.p.id}" title="Saisir dans cette section" aria-label="Saisir dans la section ${esc(l.s.nom)}">${ICONES.plus}</button></div>`;
    }
    const t = l.t, c = l.c, r = c.o.taches.get(t.id);
    const st = R.statut(r, t.avancement, c.aujIdx);
    const classes = `gl gl-tache${r.critique && A.calques.critique ? ' critique' : ''}${st.code === 'retard' ? ' retard' : ''}${st.code === 'termine' ? ' termine' : ''}`;
    const n = c.num.get(t.id);
    if (!colonnes) return `<div class="${classes}" role="row"><span class="c-num">${n}</span><button class="c-nom nom-bouton" data-action="tache-modifier" data-id="${t.id}">${r.dur === 0 ? '◆ ' : ''}${esc(t.nom)}</button></div>`;
    return `<div class="${classes}" role="row" data-ligne="${t.id}">
      <span class="c-num">${n}</span>
      <span class="c-nom"><input data-champ="nom" data-id="${t.id}" value="${esc(t.nom)}" aria-label="Nom de la tâche ${n}" maxlength="120"><button class="ouvrir" data-action="tache-modifier" data-id="${t.id}" aria-label="Détails de ${esc(t.nom)}" title="Détails">⋯</button></span>
      <span class="c-debut"><input data-champ="debut" data-id="${t.id}" value="${fmtTable(r.debut)}" inputmode="numeric" placeholder="jj/mm/aa" class="${t.debut ? '' : 'auto'}" aria-label="Début de la tâche ${n}" title="${t.debut ? 'Début imposé (pas avant cette date). Vide : suit les liens.' : 'Calculé à partir des liens ou du début du planning'}"></span>
      <span class="c-duree"><input type="number" data-champ="duree" data-id="${t.id}" value="${r.dur}" min="0" max="3650" aria-label="Durée de la tâche ${n} en ${UNITE(l.p)}"></span>
      <span class="c-fin" title="${fmtLong(r.fin)}">${fmtTable(r.fin)}</span>
      <span class="c-av"><input type="number" data-champ="avancement" data-id="${t.id}" value="${t.avancement}" min="0" max="100" step="5" aria-label="Avancement de la tâche ${n} en %"></span>
      <span class="c-dep"><input data-champ="deps" data-id="${t.id}" value="${esc(depsTexte(t, c))}" aria-label="Prédécesseurs de la tâche ${n}" placeholder="—" spellcheck="false"></span>
    </div>`;
  }

  // Interactions du Gantt : glisser, redimensionner, lier, zoom molette et pincement, infobulle.
  let glisse = null, clicBloque = false;
  function brancherGantt(cadre) {
    const svg = cadre.querySelector('.gcorps svg');
    if (!svg) return;
    const bulle = $('.gantt-zone .infobulle');
    svg.addEventListener('pointermove', (e) => {
      if (glisse) return;
      const g = e.target.closest('[data-tache]');
      if (!g) { bulle.hidden = true; return; }
      const t = tache(g.dataset.tache);
      if (!t) return;
      bulle.innerHTML = infobulle(t);
      bulle.hidden = false;
      const zone = $('.gantt-zone').getBoundingClientRect();
      let xb = e.clientX - zone.left + 14, yb = e.clientY - zone.top + 14;
      if (xb + bulle.offsetWidth > zone.width - 8) xb = e.clientX - zone.left - bulle.offsetWidth - 14;
      if (yb + bulle.offsetHeight > zone.height) yb = e.clientY - zone.top - bulle.offsetHeight - 10;
      bulle.style.left = `${Math.max(4, xb)}px`; bulle.style.top = `${Math.max(4, yb)}px`;
    });
    svg.addEventListener('pointerleave', () => { bulle.hidden = true; });
    svg.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      const g = e.target.closest('[data-tache]');
      if (!g) return;
      const t = tache(g.dataset.tache);
      if (!t) return;
      const role = e.target.dataset.role || 'barre';
      glisse = { t, role, g, x0: e.clientX, y0: e.clientY, bouge: false, r: res(t) };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!glisse) return;
      const dx = e.clientX - glisse.x0;
      if (!glisse.bouge && Math.abs(dx) < 4 && Math.abs(e.clientY - glisse.y0) < 4) return;
      glisse.bouge = true;
      bulle.hidden = true;
      if (glisse.role === 'poignee') {
        const box = svg.getBoundingClientRect();
        const c = glisse.g.querySelector('.poignee');
        let l = svg.querySelector('#lien-temp');
        if (!l) { l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.id = 'lien-temp'; l.setAttribute('stroke', PALETTE.bleu); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-dasharray', '5 3'); svg.appendChild(l); }
        l.setAttribute('x1', c.getAttribute('cx')); l.setAttribute('y1', c.getAttribute('cy'));
        l.setAttribute('x2', e.clientX - box.left); l.setAttribute('y2', e.clientY - box.top);
      } else {
        const jours = Math.round(dx / G.Z);
        if (glisse.role === 'bord' && glisse.r.dur > 0) {
          const rects = [...glisse.g.querySelectorAll('rect[data-role="barre"]')];
          const w = Math.max(G.Z, (ecart(glisse.r.debut, glisse.r.fin) + 1 + jours) * G.Z);
          rects.forEach((rc, i) => rc.setAttribute('width', rects.length === 3 && i === 1 ? (w * glisse.t.avancement) / 100 : w));
        } else glisse.g.setAttribute('transform', `translate(${jours * G.Z} 0)`);
      }
    });
    const fin = (e) => {
      if (!glisse) return;
      const g = glisse;
      glisse = null;
      svg.querySelector('#lien-temp')?.remove();
      if (!g.bouge) return;
      clicBloque = true; setTimeout(() => { clicBloque = false; }, 50);
      const c = calculs().get(g.t.planningId);
      const jours = Math.round((e.clientX - g.x0) / G.Z);
      if (g.role === 'poignee') {
        const cible = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-tache]');
        const s = cible && tache(cible.dataset.tache);
        if (!s || s.id === g.t.id) { dessinerGantt(); return; }
        if (s.planningId !== g.t.planningId) { toast('Les liens se font entre tâches d\'un même planning.'); dessinerGantt(); return; }
        if (s.deps.some((d) => d.id === g.t.id)) { toast('Ce lien existe déjà.'); dessinerGantt(); return; }
        if (R.creeBoucle(E.taches.filter((x) => x.planningId === s.planningId), g.t.id, s.id)) { toast('Lien refusé : il créerait une boucle.'); dessinerGantt(); return; }
        memo();
        s.deps.push({ id: g.t.id, type: 'FD', decalage: 0 });
        sauver(); rendre();
        toast(`Lien ajouté : ${c.num.get(g.t.id)} → ${c.num.get(s.id)} (fin → début).`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      if (!jours) { dessinerGantt(); return; }
      memo();
      if (g.role === 'bord' && g.r.dur > 0) {
        let nf = ajout(g.r.fin, jours);
        while (!c.cal.estOuvre(nf)) nf = ajout(nf, -1);
        g.t.duree = Math.max(1, c.cal.idx(nf) - g.r.es + 1);
        sauver(); rendre();
        toast(`« ${g.t.nom} » : ${j(g.t.duree, g.p || c.p)}.`, { libelle: 'Annuler', faire: annuler });
      } else {
        const nd = c.cal.date(c.cal.idx(ajout(g.r.debut, jours)));
        g.t.debut = nd;
        sauver(); rendre();
        const r2 = res(g.t);
        toast(r2.debut !== nd ? `« ${g.t.nom} » ne peut pas commencer avant ses prédécesseurs : début le ${fmt(r2.debut)}.` : `« ${g.t.nom} » commence le ${fmt(nd)}. Les successeurs suivent.`, { libelle: 'Annuler', faire: annuler });
      }
    };
    svg.addEventListener('pointerup', fin);
    svg.addEventListener('pointercancel', () => { glisse = null; dessinerGantt(); });

    // Ctrl + molette : zoom autour du pointeur.
    cadre.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomer(A.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX);
    }, { passive: false });
    // Pincement (deux doigts).
    const doigts = new Map();
    let pince = null;
    cadre.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      doigts.set(e.pointerId, e.clientX);
      if (doigts.size === 2) { const [a, b] = [...doigts.values()]; pince = { d: Math.abs(a - b) || 1, z: A.zoom }; }
    });
    cadre.addEventListener('pointermove', (e) => {
      if (!doigts.has(e.pointerId)) return;
      doigts.set(e.pointerId, e.clientX);
      if (pince && doigts.size === 2) { const [a, b] = [...doigts.values()]; zoomer(pince.z * ((Math.abs(a - b) || 1) / pince.d), (a + b) / 2); }
    });
    const lacher = (e) => { doigts.delete(e.pointerId); if (doigts.size < 2) pince = null; };
    cadre.addEventListener('pointerup', lacher);
    cadre.addEventListener('pointercancel', lacher);
  }

  let zoomEnAttente = null;
  function zoomer(z, clientX) {
    const cadre = $('#gcadre');
    if (!cadre || !G) return;
    const nz = Math.min(R.ZOOM_MAX, Math.max(R.ZOOM_MIN, z));
    const box = cadre.getBoundingClientRect();
    const dx = (clientX ?? box.left + G.TAB + (box.width - G.TAB) / 2) - box.left - G.TAB;
    const jour = (cadre.scrollLeft + dx) / G.Z;
    const dateAncre = ajout(G.de, Math.floor(jour));
    const fraction = jour - Math.floor(jour);
    A.zoom = nz;
    if (zoomEnAttente) cancelAnimationFrame(zoomEnAttente);
    zoomEnAttente = requestAnimationFrame(() => {
      zoomEnAttente = null;
      dessinerGantt();
      cadre.scrollLeft = (ecart(G.de, dateAncre) + fraction) * G.Z - dx;
      const c = $('#zoom'); if (c) c.value = zoomVersCurseur(A.zoom);
      sauverAffichage();
    });
  }

  function infobulle(t) {
    const c = calculs().get(t.planningId), r = c.o.taches.get(t.id);
    const st = R.statut(r, t.avancement, c.aujIdx);
    const ep = t.plage ? R.etatPlage(r.debut, t.plage) : null;
    const lib = { termine: 'Terminée', retard: `En retard de ${st.retard} j`, encours: 'En cours', avenir: 'À venir' }[st.code];
    return `<b>${c.num.get(t.id)}. ${esc(t.nom)}</b>
      <div>${r.dur ? `${fmt(r.debut)} → ${fmt(r.fin)} · ${j(r.dur, c.p)}` : `Jalon · ${fmt(r.debut, { weekday: 'short', day: 'numeric', month: 'short' })}`}</div>
      ${ep ? `<div>Plage ${fmt(t.plage.debut)} → ${fmt(t.plage.fin)} : ${ep.code === 'dans' ? 'dans la plage' : ep.code === 'avance' ? `en avance de ${ep.jours} j` : `<span class="rouge">dépassée de ${ep.jours} j</span>`}</div>` : ''}
      <div>Avancement ${t.avancement} % (attendu ${Math.round(st.attendu * 100)} %) · ${lib}</div>
      <div>${r.critique ? '<span class="rouge">Critique</span>' : `Marge totale ${j(r.margeTotale, c.p)} · libre ${j(r.margeLibre, c.p)}`}</div>
      ${t.reference ? `<div>Référence : fin ${fmt(t.reference.fin)} (${ecartTexte(R.ecartReference(r, t.reference, c.cal), c.p)})</div>` : ''}`;
  }
  const ecartTexte = (n, p) => (n === null ? '—' : n === 0 ? 'à l\'heure' : n > 0 ? `+${j(n, p)}` : `−${j(-n, p)}`);

  // ---------- Saisie rapide ----------
  // Section de saisie : celle choisie, sinon la dernière du planning (« hors section » = choix explicite).
  function sectionCourante(p) {
    const v = sectionSaisie[p.id];
    if (v === null) return null;
    if (v && p.sections.some((x) => x.id === v)) return v;
    return p.sections.at(-1)?.id || null;
  }
  function saisir(texte) {
    const p = planning(E.planningActif) || E.plannings[0];
    if (!p) return;
    const lignes = String(texte).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!lignes.length) return;
    memo();
    let ajoutees = 0;
    const erreurs = [];
    for (const ligne of lignes) {
      const s = R.lireSaisie(ligne, { aujourdhui: auj(), ouvres: p.ouvres });
      if (s.vide) continue;
      if (s.section) {
        let sec = p.sections.find((x) => x.nom.toLowerCase() === s.section.toLowerCase());
        if (!sec) { sec = { id: uid(), nom: s.section, replie: false, masque: false }; p.sections.push(sec); }
        sectionSaisie[p.id] = sec.id;
        continue;
      }
      if (!s.nom) { erreurs.push(`« ${ligne} » : nom manquant`); continue; }
      C = null;
      const c = calculs().get(p.id);
      const parNum = (n) => c.liste[n - 1];
      const deps = [];
      for (const d of s.deps) {
        const pr = parNum(d.num);
        if (!pr) erreurs.push(`« ${s.nom} » : la tâche ${d.num} n'existe pas`);
        else deps.push({ id: pr.id, type: d.type, decalage: d.decalage });
      }
      const sectionId = sectionCourante(p);
      const t = { id: uid(), planningId: p.id, sectionId, nom: s.nom.slice(0, 120), debut: s.debut, duree: s.duree ?? (s.jalon ? 0 : 1), avancement: s.avancement ?? 0, deps, plage: s.plage, reference: null, note: '' };
      // Enchaîner : sans date ni lien, la tâche suit la précédente de sa section (ou la dernière hors section).
      if (E.enchainer && !t.debut && !deps.length) {
        const memes = c.liste.filter((x) => (x.sectionId || null) === sectionId);
        const prec = memes.at(-1) || (sectionId ? c.liste.filter((x) => { const i = p.sections.findIndex((y) => y.id === x.sectionId); return i >= 0 && i < p.sections.findIndex((y) => y.id === sectionId); }).at(-1) : null) || null;
        if (prec) t.deps.push({ id: prec.id, type: 'FD', decalage: 0 });
      }
      E.taches.push(t);
      ajoutees++;
    }
    sauver(); rendre();
    const champ = $('#saisie');
    if (champ) champ.focus();
    if (erreurs.length) toast(erreurs.slice(0, 2).join(' · '));
    else if (ajoutees) toast(ajoutees > 1 ? `${ajoutees} tâches ajoutées.` : 'Tâche ajoutée.', { libelle: 'Annuler', faire: annuler });
  }

  // Modification d'une cellule du tableau.
  function modifierCellule(input) {
    const t = tache(input.dataset.id);
    if (!t) return;
    const c = calculs().get(t.planningId);
    const champ = input.dataset.champ;
    const v = input.value;
    memo();
    if (champ === 'nom') { if (!v.trim()) { historique.pop(); input.value = t.nom; return; } t.nom = v.trim().slice(0, 120); }
    else if (champ === 'debut') {
      // Vide : la tâche suit ses liens. Sinon jj/mm, jj/mm/aa ou jj/mm/aaaa.
      if (!v.trim()) t.debut = null;
      else { const d = R.lireDate(v.trim(), auj()); if (!d) { historique.pop(); toast('Date non comprise : écris-la jj/mm/aa (ou vide pour suivre les liens).'); rendre(); return; } t.debut = d; }
    }
    else if (champ === 'duree') { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < 0) { historique.pop(); rendre(); return; } t.duree = Math.min(3650, n); }
    else if (champ === 'avancement') { const n = Math.round(Number(v)); t.avancement = Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0)); }
    else if (champ === 'deps') {
      const err = appliquerDeps(t, v, c);
      if (err) { historique.pop(); toast(err); rendre(); return; }
    }
    sauver(); rendre();
    // Garde le focus sur la cellule suivante après Entrée ou tabulation.
    const suivant = document.querySelector(`[data-ligne="${t.id}"] [data-champ="${champ}"]`);
    if (suivant && document.activeElement === document.body) suivant.focus();
  }

  function appliquerDeps(t, texte, c) {
    const { deps, erreurs } = R.lireDeps(texte);
    if (erreurs.length) return `Liens non compris : ${erreurs.join(', ')}. Exemple : 3, 5DD+2, 7FF-1.`;
    const nouveaux = [];
    for (const d of deps) {
      const p = c.liste[d.num - 1];
      if (!p) return `La tâche ${d.num} n'existe pas dans ce planning.`;
      if (p.id === t.id) return 'Une tâche ne peut pas dépendre d\'elle-même.';
      nouveaux.push({ id: p.id, type: d.type, decalage: d.decalage });
    }
    const essai = E.taches.filter((x) => x.planningId === t.planningId).map((x) => (x.id === t.id ? { ...x, deps: [] } : x));
    for (const d of nouveaux) {
      if (R.creeBoucle(essai, d.id, t.id)) return `Lien refusé : la tâche ${c.num.get(d.id)} dépend déjà de celle-ci (boucle).`;
      essai.find((x) => x.id === t.id).deps.push(d);
    }
    t.deps = nouveaux;
    return null;
  }

  // ============ Vue Plannings ============
  function vuePlannings() {
    const cartes = E.plannings.map((p) => {
      const c = calculs().get(p.id);
      const crit = c.liste.filter((t) => c.o.taches.get(t.id).critique).length;
      const av = R.avancementGlobal(c.liste.map((t) => ({ dur: c.o.taches.get(t.id).dur, avancement: t.avancement })));
      const retards = c.liste.filter((t) => R.statut(c.o.taches.get(t.id), t.avancement, c.aujIdx).code === 'retard').length;
      return `
      <article class="pcarte" style="--c:${couleur(p.couleur)};--t:${texteSur(p.couleur)}">
        <div class="pcarte-tete"><div><h2>${esc(p.nom)}</h2><p>${c.liste.length ? `${fmt(debutPlanning(c), { day: 'numeric', month: 'short', year: 'numeric' })} → ${fmt(finPlanning(c), { day: 'numeric', month: 'short', year: 'numeric' })}` : `Début ${fmt(p.debut, { day: 'numeric', month: 'short', year: 'numeric' })}`}</p></div><button data-action="planning-modifier" data-id="${p.id}">Modifier</button></div>
        <div class="pchiffres"><div><b>${c.liste.length}</b><span>tâches</span></div><div><b>${av}<small>%</small></b><span>avancement</span></div><div><b style="${retards ? 'color:var(--rouge)' : ''}">${retards}</b><span>en retard</span></div><div><b>${crit}</b><span>critiques</span></div></div>
        <div class="avance" role="img" aria-label="Avancement ${av} %"><i style="width:${av}%"></i></div>
        <div class="pcarte-pied">
          <label class="case petite"><input type="checkbox" data-action="planning-visible" data-id="${p.id}" ${p.masque ? '' : 'checked'}> Affiché dans le Gantt</label>
          <span class="etiquette">${p.ouvres ? 'Jours ouvrés' : 'Jours calendaires'}${p.alsace ? ' · Alsace-Moselle' : ''}</span>
          ${p.sections.length ? `<span class="etiquette clair">${pluriel(p.sections.length, 'section')}</span>` : ''}
          ${c.liste.some((t) => t.reference) ? '<span class="etiquette bleu">Référence figée</span>' : ''}
        </div>
        <div class="pcarte-actions"><button class="btn petit" data-action="ouvrir-gantt" data-id="${p.id}">Voir le Gantt</button><button class="btn petit" data-action="planning-dupliquer" data-id="${p.id}">Dupliquer</button><button class="btn petit" data-action="voir-critique" data-id="${p.id}">Chemin critique</button></div>
      </article>`;
    }).join('');
    const nomPortee = (id) => (id ? esc(planning(id)?.nom || '?') : 'Tous les plannings');
    return `
      <div class="vue-tete"><div><h1>Plannings</h1><p>Tes mini-plannings, chacun avec ses sections, son calendrier (jours ouvrés ou calendaires) et sa couleur. Pars d'un modèle pour gagner du temps.</p></div>
        <div class="actions"><button class="btn primaire" data-action="planning-nouveau">${ICONES.plus}Planning</button></div></div>
      ${E.plannings.length ? `<div class="pcartes">${cartes}</div>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun planning</h3><p>Crée-en un vide ou à partir d'un modèle ci-dessous.</p></div></div>`}
      <h2 class="titre-section">Modèles <span>${B.modeles.length} plannings types fictifs, durées indicatives à adapter.</span></h2>
      <div class="modeles">${B.modeles.map((m, i) => `<button type="button" class="modele" data-action="planning-nouveau" data-modele="${m.id}" style="--c:${couleur(B.couleurs[i % 5].id)}"><small>${esc(m.categorie)} · ${pluriel(m.taches.length, 'tâche')} · ${m.ouvres ? 'jours ouvrés' : 'jours calendaires'}</small><b>${esc(m.nom)}</b><span>${esc(m.description)}</span></button>`).join('')}</div>
      <h2 class="titre-section">Repères et périodes <span>Lignes verticales et zones hachurées, communes ou propres à un planning (vacances, fermetures, comités…).</span></h2>
      <div class="rp-grille">
        <section class="liste-bloc"><h3>Repères <button class="btn petit" data-action="repere-nouveau">${ICONES.plus}Repère</button></h3>
          ${E.reperes.length ? [...E.reperes].sort((a, b) => a.date.localeCompare(b.date)).map((r) => `<button class="liste-ligne" data-action="repere-modifier" data-id="${r.id}"><i class="rp-repere"></i><span><b>${esc(r.nom)}</b><small>${fmt(r.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${nomPortee(r.planningId)}</small></span></button>`).join('') : '<p class="liste-vide">Aucun repère.</p>'}</section>
        <section class="liste-bloc"><h3>Périodes <button class="btn petit" data-action="periode-nouvelle">${ICONES.plus}Période</button></h3>
          ${E.periodes.length ? [...E.periodes].sort((a, b) => a.debut.localeCompare(b.debut)).map((r) => `<button class="liste-ligne" data-action="periode-modifier" data-id="${r.id}"><i class="rp-periode"></i><span><b>${esc(r.nom)}</b><small>${fmt(r.debut)} → ${fmt(r.fin, { day: 'numeric', month: 'short', year: 'numeric' })} · ${nomPortee(r.planningId)}</small></span></button>`).join('') : '<p class="liste-vide">Aucune période.</p>'}</section>
      </div>
      <p class="source">${esc(B.sources.feries.texte)} Source : <a href="${B.sources.feries.lien}" target="_blank" rel="noopener">service-public.gouv.fr</a>, consulté le ${B.sources.feries.consulteLe}. Les vacances scolaires ne sont pas intégrées (dates officielles publiées chaque année) : ajoute-les en période.</p>`;
  }

  // ============ Vue Chemin critique ============
  function choixPlanning(courant, action) {
    return `<div class="choix-planning" role="group" aria-label="Planning">${E.plannings.map((p) => `<button class="puce" data-action="${action}" data-id="${p.id}" aria-pressed="${p.id === courant}" style="--c:${couleur(p.couleur)}"><i></i>${esc(p.nom)}</button>`).join('')}</div>`;
  }

  function vueCritique() {
    if (!E.plannings.length) return `<div class="vue-tete"><div><h1>Chemin critique</h1></div></div><div class="vide-etat">${FORME_VIDE}<div><h3>Aucun planning</h3><p>Crée un planning pour calculer son chemin critique.</p></div></div>`;
    if (!planning(planningCritique)) planningCritique = (planning(E.planningActif) || E.plannings[0]).id;
    const c = calculs().get(planningCritique);
    const p = c.p;
    const lignes = c.liste.map((t) => ({ t, r: c.o.taches.get(t.id) }));
    const crit = lignes.filter((x) => x.r.critique);
    const duree = c.liste.length ? c.o.fin - c.o.debut : 0;
    const margeMin = lignes.filter((x) => !x.r.critique).reduce((m, x) => Math.min(m, x.r.margeTotale), Infinity);
    const chaine = crit.map((x) => `${c.num.get(x.t.id)}`).join(' → ');
    return `
      <div class="vue-tete"><div><h1>Chemin critique</h1><p>La suite de tâches sans marge : un jour de retard sur l'une d'elles décale la fin du planning. Calcul des dates au plus tôt et au plus tard (méthode du chemin critique) sur ${UNITE(p)}.</p></div></div>
      ${choixPlanning(planningCritique, 'critique-planning')}
      <div class="tuiles">
        <div class="tuile" style="--c:var(--encre)"><p class="surtitre">Fin du planning</p><b class="tuile-date">${c.liste.length ? fmt(finPlanning(c), { day: 'numeric', month: 'short' }) : '–'}</b><span>${c.liste.length ? `${fmt(finPlanning(c), { weekday: 'long' })} ${finPlanning(c).slice(0, 4)}` : 'Aucune tâche'}</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Durée</p><b>${duree}<small>${p.ouvres ? 'j ouvr.' : 'j'}</small></b><span>Du premier début à la dernière fin.</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Tâches critiques</p><b>${crit.length}<small>/ ${lignes.length}</small></b><span>${chaine ? `Chaîne : ${esc(chaine.length > 60 ? `${chaine.slice(0, 58)}…` : chaine)}` : 'Aucune.'}</span></div>
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Plus petite marge</p><b>${Number.isFinite(margeMin) ? margeMin : '–'}<small>${Number.isFinite(margeMin) ? (p.ouvres ? 'j ouvr.' : 'j') : ''}</small></b><span>Hors chemin critique : la tâche la plus exposée.</span></div>
      </div>
      ${c.o.boucles.length ? `<p class="alerte">Des liens forment une boucle (tâches ${c.o.boucles.map((id) => c.num.get(id)).join(', ')}) : ils sont ignorés dans le calcul. Corrige-les dans le tableau.</p>` : ''}
      <h2 class="titre-section">Dates au plus tôt et au plus tard <span>Marge totale : retard possible sans décaler la fin du planning. Marge libre : sans décaler aucun successeur.</span></h2>
      ${lignes.length ? `<div class="defile"><table class="tableau tableau-cpm">
        <thead><tr><th class="nb">n°</th><th>Tâche</th><th class="nb">Durée</th><th>Début au plus tôt</th><th>Fin au plus tôt</th><th>Début au plus tard</th><th>Fin au plus tard</th><th class="nb">Marge totale</th><th class="nb">Marge libre</th><th>Liens</th></tr></thead>
        <tbody>${lignes.map(({ t, r }) => `<tr class="${r.critique ? 'critique' : ''}"><td class="nb">${c.num.get(t.id)}</td><td><button class="lien-tache" data-action="tache-modifier" data-id="${t.id}">${r.dur === 0 ? '◆ ' : ''}${esc(t.nom)}</button>${r.critique ? ' <span class="etiquette rouge">Critique</span>' : ''}</td><td class="nb">${r.dur}</td><td>${fmtTable(r.debut)}</td><td>${fmtTable(r.fin)}</td><td>${fmtTable(r.debutTard)}</td><td>${fmtTable(r.finTard)}</td><td class="nb">${r.margeTotale}</td><td class="nb">${r.margeLibre}</td><td>${esc(depsTexte(t, c)) || '—'}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p>Aucune tâche dans ce planning.</p>'}
      <details class="explication"><summary>Comment c'est calculé</summary>
        <p><b>Aller</b> : chaque tâche commence au plus tôt après ses prédécesseurs (fin → début, début → début, fin → fin, début → fin, avec leur décalage), ou à sa date imposée si elle est plus tardive. <b>Retour</b> : depuis la fin du planning, on remonte pour trouver la date la plus tardive où chaque tâche peut finir sans retarder la fin. La différence est la <b>marge totale</b> ; à zéro, la tâche est <b>critique</b>. La <b>marge libre</b> ne consomme la marge d'aucun successeur.</p>
        <p>Les durées et marges sont comptées en ${UNITE(p)}${p.ouvres ? ' : week-ends et jours fériés (calculés chaque année) sont sautés' : ''}.</p>
      </details>`;
  }

  // ============ Vue Suivi ============
  function vueSuivi() {
    if (!E.plannings.length) return `<div class="vue-tete"><div><h1>Suivi</h1></div></div><div class="vide-etat">${FORME_VIDE}<div><h3>Aucun planning</h3><p>Crée un planning pour suivre son avancement.</p></div></div>`;
    const blocs = E.plannings.filter((p) => !p.masque).map((p) => {
      const c = calculs().get(p.id);
      const l = c.liste.map((t) => ({ t, r: c.o.taches.get(t.id), st: R.statut(c.o.taches.get(t.id), t.avancement, c.aujIdx) }));
      const av = R.avancementGlobal(l.map((x) => ({ dur: x.r.dur, avancement: x.t.avancement })));
      const att = R.avancementGlobal(l.map((x) => ({ dur: x.r.dur, avancement: Math.round(x.st.attendu * 100) })));
      const retards = l.filter((x) => x.st.code === 'retard');
      const avecRef = l.filter((x) => x.t.reference);
      const finRef = avecRef.length ? avecRef.reduce((m, x) => (x.t.reference.fin > m ? x.t.reference.fin : m), avecRef[0].t.reference.fin) : null;
      const ecartFin = finRef && l.length ? c.cal.idx(finPlanning(c)) - c.cal.idx(finRef) : null;
      const jalons = l.filter((x) => x.r.dur === 0);
      const horsPlage = jalons.filter((x) => x.t.plage && R.etatPlage(x.r.debut, x.t.plage).code === 'depasse');
      const lib = { termine: ['', 'Terminée'], retard: ['rouge', 'En retard'], encours: ['bleu', 'En cours'], avenir: ['clair', 'À venir'] };
      return `
      <section class="suivi" style="--c:${couleur(p.couleur)};--t:${texteSur(p.couleur)}">
        <div class="suivi-tete"><h2>${esc(p.nom)}</h2><span>${l.length ? `${fmt(debutPlanning(c))} → ${fmt(finPlanning(c), { day: 'numeric', month: 'short', year: 'numeric' })}` : 'vide'}</span></div>
        <div class="pchiffres quatre">
          <div><b>${av}<small>%</small></b><span>avancement (attendu ${att} %)</span></div>
          <div><b style="${retards.length ? 'color:var(--rouge)' : ''}">${retards.length}</b><span>tâche${retards.length > 1 ? 's' : ''} en retard</span></div>
          <div><b style="${ecartFin > 0 ? 'color:var(--rouge)' : ''}">${ecartFin === null ? '–' : ecartFin > 0 ? `+${ecartFin}` : ecartFin}</b><span>${ecartFin === null ? 'pas de référence figée' : `${p.ouvres ? 'j ouvr.' : 'j'} sur la fin (vs référence)`}</span></div>
          <div><b style="${horsPlage.length ? 'color:var(--rouge)' : ''}">${horsPlage.length}</b><span>jalon${horsPlage.length > 1 ? 's' : ''} hors plage</span></div>
        </div>
        <div class="barre-avance" role="img" aria-label="Avancement ${av} %, attendu ${att} %"><i style="width:${av}%"></i><b style="left:${att}%" title="Attendu aujourd'hui"></b></div>
        ${l.length ? `<div class="defile"><table class="tableau tableau-suivi"><thead><tr><th class="nb">n°</th><th>Tâche</th><th>Fin</th><th class="nb">Réel</th><th class="nb">Attendu</th><th>Statut</th><th class="nb">Écart réf.</th></tr></thead>
        <tbody>${l.map(({ t, r, st }) => {
          const ep = t.plage ? R.etatPlage(r.debut, t.plage) : null;
          const er = R.ecartReference(r, t.reference, c.cal);
          return `<tr><td class="nb">${c.num.get(t.id)}</td><td><button class="lien-tache" data-action="tache-modifier" data-id="${t.id}">${r.dur === 0 ? '◆ ' : ''}${esc(t.nom)}</button>${ep ? ` <span class="etiquette ${ep.code === 'depasse' ? 'rouge' : ep.code === 'dans' ? 'clair' : 'bleu'}">${ep.code === 'depasse' ? `Hors plage +${ep.jours} j` : ep.code === 'dans' ? 'Dans la plage' : 'Avant la plage'}</span>` : ''}</td><td>${fmtTable(r.fin)}</td><td class="nb">${t.avancement} %</td><td class="nb">${Math.round(st.attendu * 100)} %</td><td><span class="etiquette ${lib[st.code][0]}">${lib[st.code][1]}${st.code === 'retard' ? ` · ${st.retard} j` : ''}</span></td><td class="nb" style="${er > 0 ? 'color:var(--rouge);font-weight:700' : ''}">${er === null ? '—' : er > 0 ? `+${er}` : er}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<p class="liste-vide">Aucune tâche.</p>'}
        <div class="suivi-pied"><button class="btn petit" data-action="reference-figer" data-id="${p.id}">${avecRef.length ? 'Refiger la référence' : 'Figer la référence'}</button>${avecRef.length ? `<button class="btn petit" data-action="reference-effacer" data-id="${p.id}">Effacer la référence</button>` : ''}</div>
      </section>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Suivi</h1><p>Avancement réel face à l'avancement attendu aujourd'hui, retards, jalons à plage et écart avec le planning de référence (les dates figées au lancement).</p></div></div>
      ${blocs || '<p>Tous les plannings sont masqués.</p>'}`;
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
    if (!telephone()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const optionsPortee = (sel) => `<option value="">Tous les plannings</option>${E.plannings.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}`;

  function modaleTache(id) {
    const t = tache(id);
    if (!t) return;
    const c = calculs().get(t.planningId), r = c.o.taches.get(t.id), p = c.p;
    const st = R.statut(r, t.avancement, c.aujIdx);
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="120" value="${esc(t.nom)}"></label>
      <div class="deux">
        <label class="champ">Planning<select name="planning">${E.plannings.map((q) => `<option value="${q.id}" ${q.id === t.planningId ? 'selected' : ''}>${esc(q.nom)}</option>`).join('')}</select></label>
        <label class="champ">Section<select name="section"><option value="">Aucune</option>${p.sections.map((s) => `<option value="${s.id}" ${s.id === t.sectionId ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
      </div>
      <div class="deux">
        <label class="champ">Début imposé<small>Vide : suit ses liens ou le début du planning.</small><input type="date" name="debut" value="${t.debut || ''}"></label>
        <label class="champ">Durée (${UNITE(p)})<small>0 = jalon.</small><input type="number" name="duree" min="0" max="3650" value="${t.duree}"></label>
      </div>
      <fieldset class="groupe-plage" ${t.duree === 0 ? '' : 'hidden'}><legend>Jalon à plage <small>Facultatif : la fenêtre dans laquelle le jalon doit tomber.</small></legend>
        <div class="deux"><label class="champ">Plage du<input type="date" name="plageDebut" value="${t.plage?.debut || ''}"></label><label class="champ">au<input type="date" name="plageFin" value="${t.plage?.fin || ''}"></label></div>
      </fieldset>
      <label class="champ">Avancement : <output id="sortie-av">${t.avancement}</output> %<input type="range" name="avancement" min="0" max="100" step="5" value="${t.avancement}" oninput="this.form.querySelector('#sortie-av').textContent=this.value"></label>
      <label class="champ">Prédécesseurs<small>N° de ligne, type et décalage : 3, 5DD+2, 7FF-1 (FD fin → début par défaut, DD, FF, DF).</small><input name="deps" value="${esc(depsTexte(t, c))}" spellcheck="false" autocomplete="off"></label>
      <label class="champ">Note<textarea name="note" maxlength="1000" rows="2">${esc(t.note || '')}</textarea></label>
      <p class="aide">Calculé : ${r.dur ? `${fmtLong(r.debut)} → ${fmtLong(r.fin)}` : `jalon le ${fmtLong(r.debut)}`}. ${r.critique ? '<b style="color:var(--rouge)">Tâche critique.</b>' : `Marge totale ${j(r.margeTotale, p)}, libre ${j(r.margeLibre, p)}.`} ${st.code === 'retard' ? `<b style="color:var(--rouge)">En retard de ${st.retard} j</b> (attendu ${Math.round(st.attendu * 100)} %).` : ''}${t.reference ? ` Référence : fin ${fmt(t.reference.fin)} (${ecartTexte(R.ecartReference(r, t.reference, c.cal), p)}).` : ''}</p>
      <div class="rang"><button class="btn petit" type="button" data-action="tache-monter" data-id="${t.id}">Monter</button><button class="btn petit" type="button" data-action="tache-descendre" data-id="${t.id}">Descendre</button></div>
      <p class="erreur" role="alert"></p>`;
    const pied = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>';
    ouvrirModale('Tâche', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        memo();
        E.taches = E.taches.filter((x) => x.id !== t.id);
        E.taches.forEach((x) => { x.deps = x.deps.filter((d) => d.id !== t.id); });
        sauver(); rendre();
        toast(`« ${t.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la tâche.';
      const duree = Math.round(Number(f.get('duree')));
      if (!Number.isFinite(duree) || duree < 0 || duree > 3650) return 'Durée : un nombre de jours entre 0 et 3650.';
      const pd = f.get('plageDebut'), pf = f.get('plageFin');
      if (duree === 0 && (pd || pf) && !(R.estIso(pd) && R.estIso(pf) && pd <= pf)) return 'Plage : indique les deux dates, la première avant la seconde.';
      memo();
      const avantNom = t.nom;
      const planningId = f.get('planning');
      if (planningId !== t.planningId) {
        // Changement de planning : les liens ne traversent pas les plannings.
        E.taches.forEach((x) => { x.deps = x.deps.filter((d) => d.id !== t.id); });
        t.deps = []; t.planningId = planningId; t.sectionId = null;
      } else {
        const err = appliquerDeps(t, f.get('deps'), c);
        if (err) { historique.pop(); return err; }
        t.sectionId = f.get('section') || null;
      }
      Object.assign(t, { nom: nom.slice(0, 120), debut: R.estIso(f.get('debut')) ? f.get('debut') : null, duree, avancement: Number(f.get('avancement')) || 0, note: String(f.get('note') || '').slice(0, 1000), plage: duree === 0 && pd && pf ? { debut: pd, fin: pf } : null });
      if (action === 'dupliquer') {
        const copie = { ...structuredClone(t), id: uid(), nom: `${t.nom} (copie)`, reference: null };
        E.taches.splice(E.taches.indexOf(t) + 1, 0, copie);
        sauver(); rendre(); toast(`« ${avantNom} » dupliquée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      sauver(); rendre(); toast('Tâche enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
    const duree = modale().querySelector('[name=duree]');
    duree.addEventListener('input', () => { modale().querySelector('.groupe-plage').hidden = Number(duree.value) !== 0; });
  }

  function deplacerTache(id, sens) {
    const t = tache(id);
    if (!t) return;
    const memes = E.taches.filter((x) => x.planningId === t.planningId && (x.sectionId || null) === (t.sectionId || null));
    const i = memes.indexOf(t), k = i + sens;
    if (k < 0 || k >= memes.length) { toast(sens < 0 ? 'Déjà en tête de sa section.' : 'Déjà en fin de sa section.'); return; }
    memo();
    const a = E.taches.indexOf(t), b = E.taches.indexOf(memes[k]);
    [E.taches[a], E.taches[b]] = [E.taches[b], E.taches[a]];
    sauver(); rendre();
    toast('Ordre modifié (les numéros de ligne suivent).');
  }

  function modalePlanning(id, modeleId) {
    const p = id ? planning(id) : null;
    const m = modeleId ? B.modeles.find((x) => x.id === modeleId) : null;
    const utilisees = new Set(E.plannings.map((x) => x.couleur));
    const defaut = p?.couleur || (B.couleurs.find((x) => !utilisees.has(x.id)) || B.couleurs[E.plannings.length % B.couleurs.length]).id;
    const corps = `
      ${m ? `<p class="aide"><b>Modèle : ${esc(m.nom)}</b> · ${pluriel(m.taches.length, 'tâche')}, ${pluriel(m.sections.length, 'section')}. ${esc(m.description)} Durées indicatives, fictives : remplace-les par les tiennes.</p>` : ''}
      ${!p && !m ? `<label class="champ">Modèle<select name="modele"><option value="">Planning vide</option>${B.modeles.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></label>` : ''}
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(p?.nom || m?.nom || '')}"></label>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === defaut ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>
      <label class="champ">Date de début<small>Les tâches sans date ni lien commencent ce jour-là.</small><input type="date" name="debut" required value="${p?.debut || auj()}"></label>
      <label class="case"><input type="checkbox" name="ouvres" ${(p ? p.ouvres : m ? m.ouvres : true) ? 'checked' : ''}> Jours ouvrés (durées hors week-ends et jours fériés)</label>
      <label class="case"><input type="checkbox" name="alsace" ${p?.alsace ? 'checked' : ''}> Fériés d'Alsace-Moselle (Vendredi saint, 26 décembre)</label>
      ${p ? `<div class="groupe"><h3>Sections</h3><p class="aide">Renomme, vide un nom pour supprimer la section (ses tâches passent hors section). Saisie rapide : une ligne « _Nom_de_section » crée une section.</p>
        ${p.sections.map((s) => `<label class="champ ligne-section"><span class="sr-only">Section</span><input name="section-${s.id}" value="${esc(s.nom)}" maxlength="60"></label>`).join('')}
        <label class="champ">Nouvelle section<input name="section-nouvelle" maxlength="60" placeholder="Ex. : Lot 2 · Électricité"></label></div>
        <div class="groupe"><h3>Référence</h3><p class="aide">Fige les dates actuelles comme planning de référence : les écarts s'afficheront ensuite dans le Gantt et le Suivi.</p><div class="rang"><button class="btn petit" type="button" data-action="reference-figer" data-id="${p.id}">Figer la référence</button>${E.taches.some((t) => t.planningId === p.id && t.reference) ? `<button class="btn petit" type="button" data-action="reference-effacer" data-id="${p.id}">Effacer</button>` : ''}</div></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="dupliquer">Dupliquer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? 'Modifier le planning' : 'Nouveau planning', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const n = E.taches.filter((t) => t.planningId === p.id).length;
        if (!confirm(`Supprimer « ${p.nom} »${n ? ` et ses ${pluriel(n, 'tâche')}` : ''} ?`)) return '';
        memo();
        E.plannings = E.plannings.filter((x) => x.id !== p.id);
        E.taches = E.taches.filter((t) => t.planningId !== p.id);
        E.reperes = E.reperes.filter((x) => x.planningId !== p.id);
        E.periodes = E.periodes.filter((x) => x.planningId !== p.id);
        if (E.planningActif === p.id) E.planningActif = E.plannings[0]?.id || null;
        sauver(); rendre(); toast(`« ${p.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du planning.';
      const debut = f.get('debut');
      if (!R.estIso(debut)) return 'Indique la date de début.';
      memo();
      if (p) {
        Object.assign(p, { nom, couleur: f.get('couleur'), debut, ouvres: f.get('ouvres') === 'on', alsace: f.get('alsace') === 'on' });
        for (const s of [...p.sections]) {
          const v = String(f.get(`section-${s.id}`) ?? s.nom).trim();
          if (v) s.nom = v.slice(0, 60);
          else { p.sections = p.sections.filter((x) => x.id !== s.id); E.taches.forEach((t) => { if (t.sectionId === s.id) t.sectionId = null; }); }
        }
        const nouvelle = String(f.get('section-nouvelle') || '').trim();
        if (nouvelle) p.sections.push({ id: uid(), nom: nouvelle.slice(0, 60), replie: false, masque: false });
        if (action === 'dupliquer') { dupliquerPlanning(p.id); return; }
        sauver(); rendre(); toast('Planning enregistré.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const mod = m || B.modeles.find((x) => x.id === f.get('modele'));
      creerPlanning({ nom: nom.slice(0, 80), debut, ouvres: f.get('ouvres') === 'on', modele: mod, couleurId: f.get('couleur') });
      planning(E.planningActif).alsace = f.get('alsace') === 'on';
      sauver();
      vue = 'gantt'; history.replaceState(null, '', '#gantt'); premierAffichage = true;
      rendre(); toast(mod ? `« ${nom} » créé à partir du modèle.` : `« ${nom} » créé. Saisis ta première tâche.`);
      if (!mod) setTimeout(() => $('#saisie')?.focus(), 100);
    });
  }

  function dupliquerPlanning(id) {
    const p = planning(id);
    if (!p) return;
    memo();
    const correspondance = new Map();
    const sections = new Map();
    const q = { ...structuredClone(p), id: uid(), nom: `${p.nom} (copie)`, masque: false };
    q.sections = p.sections.map((s) => { const n = { ...s, id: uid() }; sections.set(s.id, n.id); return n; });
    const taches = E.taches.filter((t) => t.planningId === p.id);
    taches.forEach((t) => correspondance.set(t.id, uid()));
    E.taches.push(...taches.map((t) => ({ ...structuredClone(t), id: correspondance.get(t.id), planningId: q.id, sectionId: sections.get(t.sectionId) || null, deps: t.deps.filter((d) => correspondance.has(d.id)).map((d) => ({ ...d, id: correspondance.get(d.id) })) })));
    E.plannings.push(q);
    sauver(); rendre(); toast(`« ${q.nom} » créé.`, { libelle: 'Annuler', faire: annuler });
  }

  function figerReference(id) {
    const c = calculs().get(id);
    if (!c || !c.liste.length) { toast('Aucune tâche à figer.'); return; }
    memo();
    for (const t of c.liste) { const r = c.o.taches.get(t.id); t.reference = { debut: r.debut, fin: r.fin }; }
    sauver(); if (modale().open) modale().close(); rendre();
    toast(`Référence figée (${pluriel(c.liste.length, 'tâche')}).`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleRepere(id) {
    const r = id ? E.reperes.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(r?.nom || '')}" placeholder="Ex. : Comité de pilotage"></label>
      <label class="champ">Date<input type="date" name="date" required value="${r?.date || auj()}"></label>
      <label class="champ">Portée<select name="portee">${optionsPortee(r ? r.planningId : null)}</select></label>
      <p class="erreur" role="alert"></p>`;
    const pied = r ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(r ? 'Repère' : 'Nouveau repère', corps, pied, (f, action) => {
      memo();
      if (action === 'supprimer') { E.reperes = E.reperes.filter((x) => x.id !== r.id); sauver(); rendre(); toast('Repère supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const nom = String(f.get('nom') || '').trim();
      if (!nom || !R.estIso(f.get('date'))) { historique.pop(); return 'Indique un nom et une date.'; }
      const v = { nom, date: f.get('date'), planningId: f.get('portee') || null };
      if (r) Object.assign(r, v); else E.reperes.push({ id: uid(), ...v });
      sauver(); rendre(); toast(r ? 'Repère enregistré.' : 'Repère ajouté.');
    });
  }

  function modalePeriode(id) {
    const r = id ? E.periodes.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="40" value="${esc(r?.nom || '')}" placeholder="Ex. : Vacances scolaires, fermeture"></label>
      <div class="deux"><label class="champ">Du<input type="date" name="debut" required value="${r?.debut || auj()}"></label><label class="champ">Au<input type="date" name="fin" required value="${r?.fin || ajout(auj(), 6)}"></label></div>
      <label class="champ">Portée<select name="portee">${optionsPortee(r ? r.planningId : null)}</select></label>
      <p class="aide">Une période est hachurée dans le Gantt pour la repérer ; elle ne change pas le calcul des durées (seuls les week-ends et fériés le font en jours ouvrés).</p>
      <p class="erreur" role="alert"></p>`;
    const pied = r ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(r ? 'Période' : 'Nouvelle période', corps, pied, (f, action) => {
      memo();
      if (action === 'supprimer') { E.periodes = E.periodes.filter((x) => x.id !== r.id); sauver(); rendre(); toast('Période supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      const nom = String(f.get('nom') || '').trim();
      const de = f.get('debut'), a = f.get('fin');
      if (!nom || !R.estIso(de) || !R.estIso(a) || a < de) { historique.pop(); return 'Indique un nom et deux dates dans l\'ordre.'; }
      const v = { nom, debut: de, fin: a, planningId: f.get('portee') || null };
      if (r) Object.assign(r, v); else E.periodes.push({ id: uid(), ...v });
      sauver(); rendre(); toast(r ? 'Période enregistrée.' : 'Période ajoutée.');
    });
  }

  // Panneau « Affichage » : plannings, sections et calques à montrer ou masquer.
  function modaleAffichage() {
    const calques = [['liens', 'Liens entre tâches'], ['critique', 'Chemin critique en rouge'], ['reference', 'Barres de référence'], ['reperes', 'Repères'], ['periodes', 'Périodes hachurées'], ['feries', 'Jours fériés'], ['weekends', 'Week-ends grisés']];
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Plannings et sections</h3>
        <ul class="dossiers">${E.plannings.map((p) => `<li><label class="case"><input type="checkbox" data-aff="planning" data-id="${p.id}" ${p.masque ? '' : 'checked'}><i class="carre" style="background:${couleur(p.couleur)}"></i><b>${esc(p.nom)}</b></label>
          ${p.sections.length ? `<ul>${p.sections.map((s) => `<li><label class="case petite"><input type="checkbox" data-aff="section" data-planning="${p.id}" data-id="${s.id}" ${s.masque ? '' : 'checked'}> ${esc(s.nom)}</label></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul></div>
      <div class="groupe"><h3>Calques</h3><div class="calques">${calques.map(([k, l]) => `<label class="case petite"><input type="checkbox" data-aff="calque" data-id="${k}" ${A.calques[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>`;
    ouvrirModale('Affichage', corps, '<button class="btn primaire" value="ok">Fermer</button>', () => {});
    modale().querySelectorAll('[data-aff]').forEach((el) => el.addEventListener('change', () => {
      const { aff, id } = el.dataset;
      if (aff === 'calque') { A.calques[id] = el.checked; sauverAffichage(); rendre(); return; }
      if (aff === 'planning') { const p = planning(id); if (p) p.masque = !el.checked; }
      if (aff === 'section') { const s = planning(el.dataset.planning)?.sections.find((x) => x.id === id); if (s) s.masque = !el.checked; }
      sauver(); rendre();
    }));
  }

  function modaleAideSaisie() {
    const ex = [
      ['Maquette accueil 12/11 5j 40% après 2', 'Tâche commençant le 12/11, 5 jours, avancée à 40 %, après la ligne 2.'],
      ['Commande 0j', 'Jalon (durée 0). « jalon » marche aussi.'],
      ['Livraison jalon plage 10/12-18/12 après 3', 'Jalon à plage : il doit tomber entre le 10 et le 18/12.'],
      ['Pose 2 sem après 4FF-1', '2 semaines (10 j ouvrés ou 14 j), finit 1 jour avant la fin de la 4.'],
      ['Électricité 3j après 3, 5DD+2', 'Plusieurs liens : après la 3, et 2 jours après le début de la 5.'],
      ['_Lot_2', 'Crée la section « Lot 2 » (ou la reprend) : les lignes suivantes y vont.'],
    ];
    ouvrirModale('Saisie rapide', `<p>Tape une tâche par ligne, dans n'importe quel ordre. Tu peux coller plusieurs lignes d'un coup.</p>
      <dl class="syntaxe">${ex.map(([a, b]) => `<dt><code>${esc(a)}</code></dt><dd>${esc(b)}</dd>`).join('')}</dl>
      <p class="aide">Liens : <b>FD</b> fin → début (par défaut), <b>DD</b> début → début, <b>FF</b> fin → fin, <b>DF</b> début → fin, suivis d'un décalage en jours (+2, −1). Les numéros sont ceux de la colonne n°. Une date sans année prend l'année la plus proche d'aujourd'hui.</p>`,
    '<button class="btn primaire" value="ok">Compris</button>', () => {});
  }

  // ---------- Impression et PNG ----------
  function svgComplet({ ids, format }) {
    const L = lignesGantt(ids, true);
    const { de, a } = etendue(L.filter((l) => l.type !== 'planning' || l.c.liste.length));
    // Marge à droite pour les étiquettes des dernières barres.
    const deV = ajout(de, -3), aV = ajout(a, 4 + Math.ceil(ecart(de, a) * 0.14));
    const NOMS = format === 'A3' ? 330 : 270;
    const largeurTotale = format === 'A3' ? 1540 : 1080;
    const ROW = format === 'A3' ? 22 : 20;
    const Z = (largeurTotale - NOMS) / (ecart(deV, aV) + 1);
    const g = { de: deV, a: aV, Z, largeur: largeurTotale - NOMS, ROW, interactif: false, prefixe: 'p', H: 40, police: 10, calques: { ...A.calques, weekends: A.calques.weekends && Z >= 3.5 } };
    const corps = svgCorps(L, g);
    const H = 40 + corps.H;
    let noms = `<rect x="0" y="0" width="${NOMS}" height="${H}" fill="${PALETTE.surface}"/>`;
    L.forEach((l, i) => {
      const y = 40 + i * ROW;
      if (l.type === 'planning') noms += `<rect x="0" y="${y}" width="${NOMS}" height="${ROW}" fill="${couleur(l.p.couleur)}"/><text x="6" y="${y + ROW - 6}" font-size="11" font-weight="800" fill="${texteSur(l.p.couleur)}" font-family="${POLICE}">${esc(l.p.nom)}</text>`;
      else if (l.type === 'section') noms += `<text x="6" y="${y + ROW - 6}" font-size="10.5" font-weight="700" fill="${PALETTE.encre}" font-family="${POLICE}">${esc(l.s.nom)}</text>`;
      else {
        const r = l.c.o.taches.get(l.t.id);
        const nom = l.t.nom.length > (format === 'A3' ? 42 : 34) ? `${l.t.nom.slice(0, format === 'A3' ? 41 : 33)}…` : l.t.nom;
        noms += `<text x="6" y="${y + ROW - 6}" font-size="10" fill="${r.critique && A.calques.critique ? PALETTE.rouge : PALETTE.encre}" font-family="${POLICE}">${l.c.num.get(l.t.id)}. ${esc(nom)}</text><text x="${NOMS - 6}" y="${y + ROW - 6}" font-size="9" text-anchor="end" fill="${PALETTE.discret}" font-family="${POLICE}">${fmtCourt(r.debut)}${r.dur ? ` → ${fmtCourt(r.fin)}` : ''}</text>`;
      }
      noms += `<line x1="0" x2="${NOMS}" y1="${y + ROW}" y2="${y + ROW}" stroke="#E9E5DB"/>`;
    });
    noms += `<line x1="${NOMS}" x2="${NOMS}" y1="0" y2="${H}" stroke="${PALETTE.encre}" stroke-width="2"/><text x="6" y="26" font-size="12" font-weight="800" fill="${PALETTE.encre}" font-family="${POLICE}">Tâches</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeurTotale}" height="${H}" viewBox="0 0 ${largeurTotale} ${H}" font-family="${POLICE}"><rect width="100%" height="100%" fill="#fff"/><g transform="translate(${NOMS} 0)">${svgEchelle(g)}<g transform="translate(0 40)">${corps.svg}</g></g>${noms}<rect x="1" y="1" width="${largeurTotale - 2}" height="${H - 2}" fill="none" stroke="${PALETTE.encre}" stroke-width="2"/></svg>`;
    return { svg, largeur: largeurTotale, H, de: deV, a: aV };
  }

  function modaleImpression() {
    const corps = `
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Format (paysage)</legend>
        <div class="rang"><label class="case"><input type="radio" name="format" value="A4" checked> A4</label><label class="case"><input type="radio" name="format" value="A3"> A3</label></div></fieldset>
      <fieldset class="champ" style="border:0;padding:0;margin:0"><legend style="padding:0;margin-bottom:6px">Plannings</legend>
        ${E.plannings.map((p) => `<label class="case petite"><input type="checkbox" name="planning" value="${p.id}" ${p.masque ? '' : 'checked'}> ${esc(p.nom)}</label>`).join('')}</fieldset>
      <p class="aide">Toute la durée des plannings choisis tient dans la largeur de la page ; les sections sont dépliées. Les calques suivent le panneau Affichage. Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour un PDF.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Imprimer ou exporter', corps, '<button class="btn primaire" value="imprimer">Imprimer</button><button class="btn" value="png">Télécharger en PNG</button>', (f, action) => {
      const ids = f.getAll('planning');
      if (!ids.length) return 'Choisis au moins un planning.';
      const format = f.get('format');
      if (action === 'png') { exporterPng(ids, format); return; }
      imprimer(ids, format);
    });
  }

  function imprimer(ids, format) {
    const s = svgComplet({ ids, format });
    const noms = ids.map((id) => planning(id)?.nom).filter(Boolean).join(' · ');
    $('#impression').innerHTML = `<div class="imp-tete"><b>${esc(noms)}</b><span>Imprimé le ${fmtLong(auj())} · ${fmt(s.de, { day: 'numeric', month: 'short', year: 'numeric' })} → ${fmt(s.a, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>${s.svg}<p class="imp-pied">Rouge : chemin critique · losange : jalon · crochets : plage du jalon · gris sous la barre : référence · hachures : fériés et périodes.</p>`;
    $('#style-page').textContent = `@page{size:${format} landscape;margin:10mm}`;
    setTimeout(() => window.print(), 50);
  }

  function exporterPng(ids, format) {
    const s = svgComplet({ ids, format });
    const img = new Image();
    const url = URL.createObjectURL(new Blob([s.svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const k = 2;
      const cv = document.createElement('canvas');
      cv.width = s.largeur * k; cv.height = s.H * k;
      const ctx = cv.getContext('2d');
      ctx.scale(k, k);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `planning-gantt-${auj()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Image PNG téléchargée.');
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Export impossible dans ce navigateur : utilise l\'impression en PDF.'); };
    img.src = url;
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Jours fériés</h3><p class="aide">${esc(B.sources.feries.texte)} Source : <a href="${B.sources.feries.lien}" target="_blank" rel="noopener">service-public.gouv.fr</a> (consulté le ${B.sources.feries.consulteLe}). Le calendrier (jours ouvrés, Alsace-Moselle) se règle dans chaque planning. Ponts et fermetures propres à ton entreprise : ajoute-les en période.</p></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute le planning à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes plannings sont enregistrés en ligne avec ton code. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Fermer</button>', () => {});
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.plannings) || !Array.isArray(d.taches)) throw new Error();
        if (!confirm(`Remplacer tes plannings actuels par cette copie (${pluriel(d.plannings.length, 'planning')}, ${pluriel(d.taches.length, 'tâche')}) ?`)) return;
        memo();
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide des plannings.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planning-gantt-${auj()}.json`;
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
      <p>Enregistre le planning sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    if (appareil() === 'autre' && !telephone()) return;
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
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4500);
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (clicBloque && el.closest('.gcorps')) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); historique.length = 0; cache(); premierAffichage = true; rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-modele': accueil.modele = id; if (id && !accueil.nom) accueil.nom = B.modeles.find((m) => m.id === id)?.nom || ''; if (id) accueil.ouvres = B.modeles.find((m) => m.id === id).ouvres; ecranAccueil(); $('#form-accueil').scrollIntoView({ block: 'nearest' }); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'affichage': modaleAffichage(); break;
      case 'imprimer': modaleImpression(); break;
      case 'aide-saisie': modaleAideSaisie(); break;
      case 'planning-nouveau': modalePlanning(null, el.dataset.modele); break;
      case 'planning-modifier': modalePlanning(id); break;
      case 'planning-dupliquer': dupliquerPlanning(id); break;
      case 'planning-visible': { const p = planning(id); p.masque = !el.checked; sauver(); rendre(); break; }
      case 'ouvrir-gantt': { const p = planning(id); p.masque = false; E.planningActif = id; sauver(); changerVue('gantt'); break; }
      case 'voir-critique': planningCritique = id; changerVue('critique'); break;
      case 'critique-planning': planningCritique = id; rendre(); break;
      case 'tache-modifier': modaleTache(id); break;
      case 'tache-monter': deplacerTache(id, -1); if (modale().open) modale().close(); break;
      case 'tache-descendre': deplacerTache(id, 1); if (modale().open) modale().close(); break;
      case 'section-replier': { const s = planning(el.dataset.planning)?.sections.find((x) => x.id === id); if (s) { s.replie = !s.replie; sauver(); dessinerGantt(); } break; }
      case 'section-saisie': E.planningActif = el.dataset.planning; sectionSaisie[el.dataset.planning] = id; rendre(); $('#saisie')?.focus(); break;
      case 'section-saisie-fin': sectionSaisie[E.planningActif] = null; rendre(); $('#saisie')?.focus(); break;
      case 'repere-nouveau': modaleRepere(); break;
      case 'repere-modifier': modaleRepere(id); break;
      case 'periode-nouvelle': modalePeriode(); break;
      case 'periode-modifier': modalePeriode(id); break;
      case 'reference-figer': figerReference(id); break;
      case 'reference-effacer': memo(); E.taches.forEach((t) => { if (t.planningId === id) t.reference = null; }); sauver(); if (modale().open) modale().close(); rendre(); toast('Référence effacée.', { libelle: 'Annuler', faire: annuler }); break;
      case 'zoom-plus': zoomer(A.zoom * 1.5); break;
      case 'zoom-moins': zoomer(A.zoom / 1.5); break;
      case 'aujourdhui': { const c = $('#gcadre'); if (c && G) c.scrollTo({ left: Math.max(0, ecart(G.de, auj()) * G.Z - (c.clientWidth - G.TAB) / 3), behavior: 'smooth' }); break; }
      case 'ajuster': {
        const c = $('#gcadre');
        if (!c || !G) break;
        const { de, a } = etendue(lignesCourantes);
        A.zoom = R.zoomPourAjuster(de, a, c.clientWidth - G.TAB - 40);
        sauverAffichage(); dessinerGantt();
        const z = $('#zoom'); if (z) z.value = zoomVersCurseur(A.zoom);
        c.scrollLeft = Math.max(0, ecart(G.de, de) * G.Z - 16);
        break;
      }
      case 'annuler': annuler(); break;
      case 'colonnes': A.colonnes = !A.colonnes; sauverAffichage(); rendre(); break;
      default: break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'form-saisie') return;
    e.preventDefault();
    const champ = $('#saisie');
    const v = champ.value;
    if (!v.trim()) { champ.focus(); return; }
    saisir(v);
    const ch = $('#saisie'); if (ch) ch.value = '';
  });
  document.addEventListener('paste', (e) => {
    if (e.target.id !== 'saisie') return;
    const texte = e.clipboardData?.getData('text') || '';
    if (!/\n/.test(texte.trim())) return;
    e.preventDefault();
    saisir(texte);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.matches('.gtable input[data-champ]')) { modifierCellule(el); return; }
    if (el.id === 'saisie-planning') { E.planningActif = el.value; sauver(); rendre(); $('#saisie')?.focus(); return; }
    if (el.id === 'enchainer') { E.enchainer = el.checked; sauver(); return; }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'zoom') {
      const cadre = $('#gcadre');
      zoomer(curseurVersZoom(Number(e.target.value)), cadre ? cadre.getBoundingClientRect().left + (G?.TAB || 0) + (cadre.clientWidth - (G?.TAB || 0)) / 2 : undefined);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches?.('.gtable input[data-champ]') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && E && !modale().open && !e.target.matches?.('input,textarea')) { e.preventDefault(); annuler(); }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  let largeurPrecedente = window.innerWidth;
  window.addEventListener('resize', () => {
    if (vue !== 'gantt' || !E) return;
    if (Math.abs(window.innerWidth - largeurPrecedente) < 40) return;
    largeurPrecedente = window.innerWidth;
    rendre();
  });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
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
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton; C = null;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__gantt = { etat: () => E, calculs: () => calculs(), saisir: (t) => saisir(t), zoom: () => A.zoom };
  init();
})();
