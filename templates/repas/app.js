// Repas de la semaine et liste de courses QME : planning midi et soir, portions et restes, 100 recettes
// de base, liste de courses par rayon calculée, placard et stock déduits. Données synchronisées par clé de
// licence ou code d'accès. Aucun lien vers un magasin : la liste se copie ou s'imprime.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.RPS;
  const API = '/api/templates';
  const PRODUIT = 'RPS';
  const CLE_CODE = 'qme-rps-code';
  const CLE_CACHE = 'qme-rps-cache';
  const CLE_DEMO = 'qme-rps-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-rps-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, nombre } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dateJour = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const euros = (x) => `${(Math.round(x * 100) / 100).toFixed(2).replace('.', ',')} ${E.reglages.monnaie}`;
  const NOM_RAYON = Object.fromEntries(B.rayons);
  const NOM_CAT = Object.fromEntries(B.categories);
  const NOM_ETIQ = Object.fromEntries(B.etiquettes);
  const NOM_SAISON = Object.fromEntries(B.saisons);
  const minutes = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${String(n % 60).padStart(2, '0')}` : ''}` : `${n} min`);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'semaine';
  let lundiVu = null;
  const filtre = { q: '', cat: '', etiq: '', saison: false };
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);
  const recettes = () => R.recettesDe(E, B);
  const recette = (id) => recettes().find((r) => r.id === id);
  const lundi = () => lundiVu || R.lundiDe(auj());
  const semaine = (l = lundi()) => E.semaines[l] || R.semaineVide();
  const semaineEcrite = (l = lundi()) => { if (!E.semaines[l]) E.semaines[l] = R.semaineVide(); return E.semaines[l]; };
  const creneaux = () => R.JOURS.flatMap((_, j) => R.REPAS.filter(([k]) => E.reglages.repas.includes(k)).map(([k]) => R.cleCase(j, k)));
  const libRepas = (k) => Object.fromEntries(R.REPAS)[R.repasCase(k)];
  const libCase = (l, k) => `${R.JOURS[R.jourCase(k)].toLowerCase()} ${libRepas(k).toLowerCase()}`;
  const infos = (r) => R.infos(r, B);
  const hist = () => R.historique(E);

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
        toast('Un autre appareil a modifié le planning entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (RPS-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Foyer fictif de 4 personnes : dix semaines d'historique tirées avec les vraies règles (graine fixe),
  // la semaine en cours (cantine les midis d'école, restes, sortie, note, recettes perso et modifiée),
  // la semaine suivante entamée ; stock partiel, placard à racheter, articles libres et habituels,
  // articles cochés en magasin, prix fictifs pour une partie des articles. Tout est relatif à aujourd'hui.
  function donneesDemo() {
    const e = etatVide();
    const t = auj();
    const L = R.lundiDe(t);
    e.foyer = 'Famille Exemple';
    e.reglages.personnes = 4;
    const id = (nom) => B.recettes.find((r) => r.nom === nom)?.id;
    e.recettes.push(R.normaliserRecette({ ...B.recettes.find((r) => r.id === id('Pâtes à la carbonara')), ingredients: [...B.recettes.find((r) => r.id === id('Pâtes à la carbonara')).ingredients, { nom: 'champignons de Paris', qte: 150, unite: 'g' }], note: 'Version de la maison, avec des champignons.' }));
    const soupe = R.normaliserRecette({ id: 'r-demo-pois', nom: 'Soupe de pois cassés', categorie: 'perso', personnes: 4, preparation: 15, cuisson: 60, saisons: ['a', 'h'], etiquettes: ['batch', 'eco'],
      ingredients: [{ nom: 'pois cassés', qte: 300, unite: 'g' }, { nom: 'carotte', qte: 2, unite: 'pièce' }, { nom: 'oignon', qte: 1, unite: 'pièce' }, { nom: 'lardons', qte: 100, unite: 'g' }, { nom: 'bouillon de légumes', qte: 1, unite: 'cube' }],
      etapes: ['Rincer les pois cassés.', 'Faire revenir oignon et lardons, ajouter carottes, pois et 1,5 litre de bouillon ; cuire 1 heure.', 'Mixer.'], note: 'La recette de la grand-mère.' });
    e.recettes.push(soupe);
    e.rayonsPerso[R.cleNom('pois cassés')] = 'fe';
    e.masquees = [id('Moules marinières et frites')];
    // Semaine type « école » : cantine et bureau les midis du lundi, mardi, jeudi et vendredi.
    const ecole = {};
    for (const j of [0, 1, 3, 4]) ecole[R.cleCase(j, 'midi')] = { type: 'dehors', texte: 'Cantine et bureau' };
    e.semainesTypes = [{ id: 't-ecole', nom: 'Semaine d\'école', cases: ecole }];
    // Historique : dix semaines tirées au sort avec les règles (graine fixe), quelques restes.
    const alea = R.aleatoire(20261114);
    const tous = R.recettesDe(e, B);
    for (let w = 10; w >= 1; w--) {
      const l = ajout(L, -7 * w);
      let s = R.appliquerType(R.semaineVide(), ecole);
      const vides = R.JOURS.flatMap((_, j) => ['midi', 'soir'].map((k) => R.cleCase(j, k))).filter((k) => !s.cases[k] && k !== '3-soir');
      s = R.remplirSemaine(s, l, tous, B, { cases: vides, nbVegetariens: 3, nbPoisson: 1, soirsRapides: true, personnes: 4, hist: R.historique(e), eviterJours: 21 }, alea).semaine;
      s.cases['2-midi'].personnes = 3;
      s.cases['3-soir'] = { type: 'restes', source: '1-soir', personnes: 4 };
      s.coches = {};
      e.semaines[l] = s;
    }
    // Semaine en cours.
    const c = { ...structuredClone(ecole) };
    const rec = (nom, personnes = 4) => ({ type: 'recette', recette: id(nom) || nom, personnes });
    c['0-soir'] = rec('Soupe de légumes');
    c['1-soir'] = rec('Chili con carne');
    c['2-midi'] = rec('Gratin de pâtes au jambon', 3);
    c['2-soir'] = rec('Pâtes à la carbonara');
    c['3-soir'] = { type: 'restes', source: '1-soir', personnes: 4 };
    c['4-soir'] = { type: 'dehors', texte: 'Chez les grands-parents' };
    c['5-midi'] = rec('Croque-monsieur et salade verte');
    c['5-soir'] = rec('Curry de lentilles corail');
    c['6-midi'] = rec('Poulet rôti et pommes de terre', 6);
    c['6-soir'] = { type: 'note', texte: 'Soupe et tartines' };
    c['4-midi'] = { type: 'dehors', texte: 'Cantine et bureau' };
    e.semaines[L] = {
      cases: c,
      stock: { [R.cleNom('beurre')]: { dim: 'm', val: 100 }, [R.cleNom('pomme de terre')]: { dim: 'm', val: 500 }, [R.cleNom('lait')]: 'tout', [R.cleNom('huile d\'olive')]: 'manque' },
      coches: { [R.cleNom('carotte')]: true, [R.cleNom('oignon')]: true, [R.cleNom('salade verte')]: true },
      libres: [{ id: 'l-1', nom: 'Pommes', qte: 1.5, unite: 'kg', rayon: 'fl' }, { id: 'l-2', nom: 'Liquide vaisselle', qte: 1, unite: 'pièce', rayon: 'mh' }, { id: 'l-3', nom: 'Papier toilette', qte: 1, unite: 'paquet', rayon: 'mh' }],
    };
    e.habituels = [{ id: 'h-1', nom: 'Yaourt nature', qte: 8, unite: 'pièce' }, { id: 'h-2', nom: 'Café moulu', qte: 250, unite: 'g', rayon: 'ep' }, { id: 'h-3', nom: 'Baguette', qte: 3, unite: 'pièce' }];
    // Semaine suivante entamée.
    const n = R.appliquerType(R.semaineVide(), ecole);
    n.cases['0-soir'] = { type: 'recette', recette: soupe.id, personnes: 4 };
    n.cases['2-midi'] = rec('Boulettes de bœuf à la sauce tomate', 3);
    n.cases['5-soir'] = rec('Quiche brocoli et chèvre');
    e.semaines[ajout(L, 7)] = n;
    // Prix fictifs saisis par le foyer (aucun prix n'est intégré au produit).
    const prix = [['bœuf haché', 11.9, 1, 'kg'], ['pomme de terre', 1.6, 1, 'kg'], ['carotte', 0.25, 1, 'pièce'], ['oignon', 0.3, 1, 'pièce'], ['haricots rouges', 1.1, 400, 'g'], ['tomates concassées', 0.95, 400, 'g'],
      ['spaghetti', 1.2, 500, 'g'], ['pâtes courtes', 1.1, 500, 'g'], ['lardons', 2.4, 200, 'g'], ['œufs', 3.2, 12, 'pièce'], ['gruyère râpé', 2.5, 200, 'g'], ['crème fraîche', 1.9, 200, 'g'], ['poulet entier', 9.5, 1, 'pièce'],
      ['lentilles corail', 2.2, 500, 'g'], ['lait de coco', 1.6, 400, 'ml'], ['riz', 1.8, 1, 'kg'], ['pommes', 2.9, 1, 'kg'], ['yaourt nature', 1.8, 8, 'pièce'], ['pain de mie', 1.7, 20, 'tranche']];
    for (const [nom, p, q, u] of prix) e.prix[R.cleNom(nom)] = { prix: p, qte: q, unite: u };
    return R.normaliser(e, B);
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Repas de la semaine et liste de courses · QME';
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
          <p class="surtitre">Repas de la semaine et liste de courses</p>
          <h1>Ce soir, on mange quoi ? C'est déjà prévu.</h1>
          <p>Les repas de la semaine en quelques touches, et la liste de courses qui se calcule seule : rangée par rayon, quantités additionnées, ce que tu as déjà retiré.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton planning de repas</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton planning est enregistré en ligne et te suit sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon planning de repas</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon planning de repas'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, foyer: '', personnes: 4, repas: 'midi-soir', eviter: 21, placard: new Set(B.placard) });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    const choix = (nom, options, valeur, cls = 'deux') => `<div class="choix-statut ${cls}">${options.map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${String(valeur) === String(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On organise les repas de ton foyer.</h1>
        <p class="intro">Tu places des recettes sur la semaine, midi et soir, pour le nombre de personnes du repas : la liste de courses se calcule, rangée par rayon, sans ce que tu as déjà. 100 recettes de base sont prêtes, et tu ajoutes les tiennes.</p>
        <div class="form-accueil">
          <label class="champ">Nom du foyer <small>Facultatif.</small><input id="foyer" value="${esc(a.foyer)}" maxlength="80" placeholder="Ex. : La maison"></label>
          <label class="champ">Combien êtes-vous à table, en général ? <small>Modifiable repas par repas.</small><input id="personnes" type="number" min="1" max="20" value="${a.personnes}" inputmode="numeric"></label>
          <fieldset class="champ"><legend>Repas à prévoir</legend>${choix('repas', [['midi-soir', 'Midi et soir'], ['soir', 'Le soir seulement']], a.repas)}</fieldset>
          <fieldset class="champ"><legend>Éviter de reproposer une recette pendant <small>Pour le tirage des repas.</small></legend>${choix('eviter', [[14, '2 semaines'], [21, '3 semaines'], [28, '4 semaines']], a.eviter, 'trois')}</fieldset>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ton placard</h1>
        <p class="intro">Ce que tu as presque toujours à la maison n'apparaît pas dans les courses, sauf si tu le marques « à racheter » la semaine où il manque. Décoche ce que tu n'as pas d'habitude.</p>
        <div class="placard-choix">${B.placard.map((p) => `<label class="case"><input type="checkbox" data-placard="${esc(p)}" ${a.placard.has(p) ? 'checked' : ''}> ${esc(R.majuscule(p))}</label>`).join('')}</div>
        <p class="aide" style="margin-top:12px;max-width:720px">Tu pourras en ajouter d'autres (Réglages, ou depuis un article de la liste de courses).</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon planning</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#foyer')?.addEventListener('input', (e) => { accueil.foyer = e.target.value; });
    $('#personnes')?.addEventListener('input', (e) => { accueil.personnes = e.target.value; });
    document.querySelectorAll('[name=repas]').forEach((el) => el.addEventListener('change', () => { accueil.repas = el.value; }));
    document.querySelectorAll('[name=eviter]').forEach((el) => el.addEventListener('change', () => { accueil.eviter = Number(el.value); }));
    document.querySelectorAll('[data-placard]').forEach((el) => el.addEventListener('change', () => { if (el.checked) accueil.placard.add(el.dataset.placard); else accueil.placard.delete(el.dataset.placard); }));
  }

  function terminerAccueil() {
    E = etatVide();
    E.foyer = accueil.foyer.trim();
    E.reglages = R.normaliserReglages({ ...E.reglages, personnes: accueil.personnes, repas: accueil.repas === 'soir' ? ['soir'] : ['midi', 'soir'], eviterJours: accueil.eviter }, B.reglages);
    E.placard = B.placard.filter((p) => accueil.placard.has(p));
    accueil = accueilVide();
    vue = 'semaine';
    sauver();
    demarrer();
    toast('Ton planning est prêt. Touche un repas, ou « Proposer des repas ».');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    courses: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    recettes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    historique: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['semaine', 'Semaine'], ['courses', 'Courses'], ['recettes', 'Recettes'], ['historique', 'Historique']];
  const AVERTISSEMENT = '<p class="mention avertissement">Recettes de base rédigées par QME, à adapter à tes goûts. Les allergènes affichés sont indicatifs, déduits d\'ingrédients génériques : la composition dépend du produit acheté, vérifie toujours les étiquettes. Ce n\'est pas un outil de nutrition. Le budget n\'est qu\'une estimation à partir des prix que tu saisis.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/repas/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Repas et<br>courses</span>
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
    document.title = `${titres[vue]} · Repas et courses`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { semaine: vueSemaine, courses: vueCourses, recettes: vueRecettes, historique: vueHistorique }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#filtre-cat')?.addEventListener('change', (e) => { filtre.cat = e.target.value; rendre(); });
    $('#form-libre')?.addEventListener('submit', (e) => { e.preventDefault(); ajouterLibre(new FormData(e.target)); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="0" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="62" r="34" fill="#F5B400"/><path d="M0 96 0 56 A40 40 0 0 1 40 96Z" fill="#D9302A"/></svg>';

  // Navigation entre semaines (commune aux vues Semaine et Courses).
  function navSemaine() {
    const l = lundi();
    const ceLundi = R.lundiDe(auj());
    const fin = ajout(l, 6);
    const lib = l.slice(0, 7) === fin.slice(0, 7) ? `du ${versDate(l).getDate()} au ${fmt(fin, { day: 'numeric', month: 'long' })}` : `du ${dateCourte(l)} au ${dateCourte(fin)}`;
    const ecartS = R.ecart(ceLundi, l) / 7;
    const rel = ecartS === 0 ? 'Cette semaine' : ecartS === 1 ? 'Semaine prochaine' : ecartS === -1 ? 'Semaine dernière' : ecartS > 0 ? `Dans ${ecartS} semaines` : `Il y a ${-ecartS} semaines`;
    return `<div class="nav-semaine"><button class="btn petit" data-action="semaine-pas" data-pas="-1" aria-label="Semaine précédente">‹</button><div class="nav-lib"><b>${rel}</b><span>${lib}</span></div><button class="btn petit" data-action="semaine-pas" data-pas="1" aria-label="Semaine suivante">›</button>${ecartS !== 0 ? '<button class="btn petit lien" data-action="semaine-pas" data-pas="0">Revenir à cette semaine</button>' : ''}</div>`;
  }

  const etiquette = (e) => `<span class="etiquette ${e === 'vegetarien' ? 'vert' : e === 'poisson' ? 'ciel' : e === 'rapide' ? 'jaune' : 'sable'}">${esc(NOM_ETIQ[e] || e)}</span>`;

  // ---------- Semaine ----------
  function contenuCase(l, k, c, p) {
    if (!c) return `<span class="cr-vide">${ICONES.plus}<span>Ajouter</span></span>`;
    if (c.type === 'recette') {
      const r = recette(c.recette);
      if (!r) return `<b class="cr-nom">Recette supprimée</b><span class="cr-meta">${pluriel(c.personnes, 'personne')}</span>`;
      const inf = infos(r);
      const extra = p[k] - c.personnes;
      return `<b class="cr-nom">${esc(r.nom)}</b><span class="cr-meta">${pluriel(c.personnes, 'pers.', 'pers.')}${inf.temps ? ` · ${minutes(inf.temps)}` : ''}</span>${extra > 0 ? `<span class="etiquette ciel">+${extra} pour les restes</span>` : inf.vegetarien ? '<span class="etiquette vert">Végétarien</span>' : ''}`;
    }
    if (c.type === 'restes') {
      const src = semaine(l).cases[c.source];
      const r = src?.type === 'recette' ? recette(src.recette) : null;
      return `<span class="cr-type">Restes</span><b class="cr-nom">${esc(r?.nom || 'Restes')}</b><span class="cr-meta">de ${esc(libCase(l, c.source))} · ${pluriel(c.personnes, 'pers.', 'pers.')}</span>`;
    }
    if (c.type === 'dehors') return `<span class="cr-type">Dehors</span><b class="cr-nom">${esc(c.texte || 'Pas de repas à préparer')}</b>`;
    return `<span class="cr-type">Note</span><b class="cr-nom">${esc(c.texte || 'Note')}</b>`;
  }

  function vueSemaine() {
    const l = lundi();
    const s = semaine(l);
    const t = auj();
    const p = R.portions(s);
    const cr = creneaux();
    const prevus = cr.filter((k) => s.cases[k]).length;
    const liste = R.listeCourses(E, B, l);
    const bud = R.budget(liste.aAcheter, E.prix);
    const restes = Object.values(s.cases).filter((c) => c.type === 'restes').length;
    const tuiles = [
      ['Repas prévus', `${prevus}<small>/${cr.length}</small>`, prevus === cr.length ? 'la semaine est complète' : `${pluriel(cr.length - prevus, 'repas')} à prévoir`, 'var(--bleu)', 'rond'],
      ['Restes', String(restes), restes ? `${pluriel(restes, 'repas')} sans cuisiner` : 'aucun repas de restes', 'var(--jaune)', ''],
      ['À acheter', String(liste.aAcheter.length), `${pluriel(liste.enStock.length, 'article')} déjà à la maison`, 'var(--rouge)', 'rond'],
      ['Budget estimé', bud.avecPrix ? euros(bud.total) : '–', bud.avecPrix ? `sur ${bud.avecPrix} article${bud.avecPrix > 1 ? 's' : ''} sur ${liste.aAcheter.length} (tes prix)` : 'saisis tes prix dans la liste', 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const jours = R.JOURS.map((nom, j) => {
      const d = ajout(l, j);
      const cases = R.REPAS.filter(([k]) => E.reglages.repas.includes(k)).map(([k, lib]) => {
        const cle = R.cleCase(j, k);
        const c = s.cases[cle];
        return `<button class="creneau ${c ? `cr-${c.type}` : 'cr-libre'}" data-action="case" data-cle="${cle}" aria-label="${esc(`${nom} ${lib.toLowerCase()}`)}"><span class="cr-repas">${lib}</span>${contenuCase(l, cle, c, p)}</button>`;
      }).join('');
      return `<section class="jour ${d === t ? 'aujourdhui' : ''} ${d < t ? 'passe' : ''}"><h3 class="jour-tete"><span class="j-long">${nom}</span><span class="j-court">${nom.slice(0, 3)}.</span><b>${versDate(d).getDate()}</b>${d === t ? '<em>Aujourd\'hui</em>' : ''}</h3><div class="jour-cases">${cases}</div></section>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Repas de la semaine</h1><p>${E.foyer ? `${esc(E.foyer)} · ` : ''}${pluriel(E.reglages.personnes, 'personne')} par défaut. Touche un repas pour choisir une recette, des restes ou une sortie.</p></div>
        <div class="actions"><button class="btn" data-action="semaines-types">Semaine type</button><button class="btn primaire" data-action="proposer">${ICONES.plus}Proposer des repas</button></div></div>
      ${navSemaine()}
      <div class="tuiles">${tuiles}</div>
      <div class="grille-semaine">${jours}</div>
      <div class="pied-semaine">
        <button class="btn" data-action="vue" data-vue="courses">Voir la liste de courses</button>
        ${Object.keys(s.cases).length ? '<button class="btn lien" data-action="vider-semaine">Vider la semaine</button>' : ''}
        <button class="btn lien" data-action="imprimer">Imprimer</button>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Choix d'un repas : recette (avec suggestions), restes, sortie ou note.
  function modaleCase(cle) {
    const l = lundi();
    const s = semaine(l);
    const c = s.cases[cle];
    const date = R.dateCase(l, cle);
    const tous = recettes().sort((a, b) => a.nom.localeCompare(b.nom));
    const h = hist();
    const exclure = new Set(Object.entries(s.cases).filter(([k, x]) => k !== cle && x.type === 'recette').map(([, x]) => x.recette));
    const sugg = R.proposer(tous, B, { date, hist: h, eviterJours: E.reglages.eviterJours, exclure }, Math.random, 3);
    const sources = Object.entries(s.cases).filter(([k, x]) => R.ordreCase(k, cle) < 0 && x.type === 'recette' && recette(x.recette)).sort(([a], [b]) => R.ordreCase(a, b));
    const type = c?.type || 'recette';
    const pers = c?.personnes || E.reglages.personnes;
    const ligneRec = (r, groupe = 'recette') => {
      const inf = infos(r);
      const der = R.derniereFois(h, r.id, date);
      return `<label class="choix-rec ${groupe === 'sugg' ? 'sugg' : ''}" data-nom="${esc(R.cleNom(`${r.nom} ${NOM_CAT[r.categorie] || ''} ${inf.etiquettes.map((e) => NOM_ETIQ[e] || e).join(' ')}`))}"><input type="radio" name="${groupe}" value="${r.id}" ${c?.recette === r.id ? 'checked' : ''}><span><b>${esc(r.nom)}</b><small>${inf.temps ? minutes(inf.temps) : 'temps non indiqué'}${inf.vegetarien ? ' · végétarien' : ''}${der ? ` · servie il y a ${pluriel(R.ecart(der, date), 'jour')}` : ''}</small></span></label>`;
    };
    const corps = `
      <fieldset class="champ"><legend>Ce repas</legend><div class="choix-statut quatre">${[['recette', 'Recette'], ['restes', 'Restes'], ['dehors', 'Dehors'], ['note', 'Note']].map(([k, lib]) => `<label><input type="radio" name="type" value="${k}" ${type === k ? 'checked' : ''}><span>${lib}</span></label>`).join('')}</div></fieldset>
      <div data-bloc="recette">
        ${sugg.length ? `<p class="surtitre" style="margin:0 0 6px">Suggestions de saison</p><div class="suggestions">${sugg.map((x) => ligneRec(x.recette, 'sugg')).join('')}</div>` : ''}
        <label class="champ" style="margin-top:12px">Chercher une recette<input type="search" id="cherche-rec" placeholder="Nom, catégorie, végétarien…" autocomplete="off"></label>
        <div class="choix-recettes" id="liste-rec">${tous.map((r) => ligneRec(r)).join('')}</div>
      </div>
      <div data-bloc="restes">${sources.length ? `<label class="champ">Restes de<select name="source">${sources.map(([k, x]) => `<option value="${k}" ${c?.source === k ? 'selected' : ''}>${esc(R.majuscule(libCase(l, k)))} · ${esc(recette(x.recette).nom)}</option>`).join('')}</select></label><p class="aide">La recette d'origine est comptée pour plus de portions sur la liste de courses.</p>` : '<p class="aide">Aucune recette n\'est encore prévue cette semaine : choisis d\'abord le repas qui donnera des restes.</p>'}</div>
      <div data-bloc="dehors"><label class="champ">Précision <small>Facultative : cantine, restaurant, invités ailleurs…</small><input name="texteDehors" maxlength="80" value="${esc(c?.type === 'dehors' ? c.texte : '')}" placeholder="Ex. : Cantine"></label></div>
      <div data-bloc="note"><label class="champ">Note <small>Un repas sans recette, sans ingrédient dans la liste.</small><input name="texteNote" maxlength="80" value="${esc(c?.type === 'note' ? c.texte : '')}" placeholder="Ex. : Soupe et tartines"></label></div>
      <label class="champ" data-bloc-pers>Personnes à ce repas<input type="number" name="personnes" min="1" max="40" value="${pers}" inputmode="numeric"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${c ? '<button class="btn danger gauche" value="vider">Vider</button>' : ''}`;
    ouvrirModale(esc(R.majuscule(`${dateJour(date)} · ${libRepas(cle).toLowerCase()}`)), corps, pied, (fd, action) => {
      if (action === 'vider') { retenir(); E.semaines[l] = R.viderCase(semaineEcrite(l), cle); sauver(); rendre(); toast('Repas vidé.', { libelle: 'Annuler', faire: annuler }); return; }
      const t = fd.get('type');
      const personnes = Number(fd.get('personnes'));
      if (['recette', 'restes'].includes(t) && !(personnes >= 1 && personnes <= 40)) return 'Indique un nombre de personnes entre 1 et 40.';
      let n;
      if (t === 'recette') { if (!recette(fd.get('recette'))) return 'Choisis une recette dans la liste.'; n = { type: 'recette', recette: fd.get('recette'), personnes }; }
      else if (t === 'restes') { if (!fd.get('source')) return 'Choisis le repas qui donne les restes.'; n = { type: 'restes', source: fd.get('source'), personnes }; }
      else if (t === 'dehors') n = { type: 'dehors', texte: String(fd.get('texteDehors') || '').trim() };
      else n = { type: 'note', texte: String(fd.get('texteNote') || '').trim() || 'Note' };
      retenir();
      const sw = semaineEcrite(l);
      if (c?.type === 'recette' && n.type !== 'recette') E.semaines[l] = R.viderCase(sw, cle);
      E.semaines[l].cases[cle] = R.normaliserCase(n);
      sauver(); rendre();
      toast(n.type === 'recette' ? `${recette(n.recette).nom} : ${libCase(l, cle)}.` : 'Repas enregistré.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const t = d.querySelector('[name=type]:checked').value;
      d.querySelectorAll('[data-bloc]').forEach((b) => { b.hidden = b.dataset.bloc !== t; });
      d.querySelector('[data-bloc-pers]').hidden = !['recette', 'restes'].includes(t);
    };
    d.querySelectorAll('[name=type]').forEach((el) => el.addEventListener('change', maj));
    maj();
    // Une suggestion cochée coche la même recette dans la liste (seul champ lu à l'enregistrement), et inversement.
    d.querySelectorAll('[name=sugg]').forEach((el) => el.addEventListener('change', () => { const x = d.querySelector(`[name=recette][value="${el.value}"]`); if (x) x.checked = true; }));
    d.querySelectorAll('[name=recette]').forEach((el) => el.addEventListener('change', () => { d.querySelectorAll('[name=sugg]').forEach((x) => { x.checked = x.value === el.value; }); }));
    d.querySelector('#cherche-rec').addEventListener('input', (e) => {
      const q = R.cleNom(e.target.value);
      d.querySelectorAll('#liste-rec .choix-rec').forEach((x) => { x.hidden = q && !x.dataset.nom.includes(q); });
    });
    const coche = d.querySelector('#liste-rec [name=recette]:checked');
    if (coche) setTimeout(() => coche.closest('label').scrollIntoView({ block: 'nearest' }), 0);
  }

  // Tirage : remplit les repas vides selon la saison, l'historique et les contraintes.
  function modaleProposer() {
    const l = lundi();
    const s = semaine(l);
    const vides = creneaux().filter((k) => !s.cases[k]);
    if (!vides.length) { toast('Tous les repas de la semaine sont déjà prévus.'); return; }
    const corps = `
      <p>${pluriel(vides.length, 'repas vide')} cette semaine. Les recettes sont choisies parmi celles de saison (${NOM_SAISON[R.saisonDe(l)].toLowerCase()}), en évitant celles servies depuis moins de ${pluriel(E.reglages.eviterJours, 'jour')}, et en privilégiant celles qui n'ont pas été au menu depuis longtemps.</p>
      ${E.reglages.repas.length > 1 ? `<fieldset class="champ"><legend>Remplir</legend><div class="cases">${R.REPAS.map(([k, lib]) => `<label class="case"><input type="checkbox" name="repas" value="${k}" checked> Les ${lib.toLowerCase()}s vides</label>`).join('')}</div></fieldset>` : ''}
      <div class="rang-champs">
        <label class="champ">Repas végétariens, au moins<input type="number" name="vege" min="0" max="14" value="${Math.min(3, vides.length)}" inputmode="numeric"></label>
        <label class="champ">Repas avec du poisson, au moins<input type="number" name="poisson" min="0" max="14" value="${Math.min(1, vides.length)}" inputmode="numeric"></label>
      </div>
      <label class="case"><input type="checkbox" name="rapides" checked> Soirs du lundi au vendredi : ${B.tempsRapide} minutes au plus</label>
      <label class="case"><input type="checkbox" name="saison" checked> Seulement des recettes de saison</label>
      <label class="champ">Personnes par repas<input type="number" name="personnes" min="1" max="40" value="${E.reglages.personnes}" inputmode="numeric"></label>
      <details class="champs-aide"><summary>Éviter des allergènes (indicatif)</summary><p class="mention">Déduits d'ingrédients génériques : la composition réelle dépend du produit acheté, vérifie toujours les étiquettes. Ce filtre ne garantit rien.</p><div class="cases">${Object.entries(B.allergenes).map(([k, n]) => `<label class="case"><input type="checkbox" name="allergene" value="${k}"> ${esc(R.majuscule(n))}</label>`).join('')}</div></details>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Proposer des repas', corps, '<button class="btn primaire" value="ok">Proposer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const repas = E.reglages.repas.length > 1 ? fd.getAll('repas') : E.reglages.repas;
      const cases = vides.filter((k) => repas.includes(R.repasCase(k)));
      if (!cases.length) return 'Coche au moins midi ou soir.';
      const personnes = Number(fd.get('personnes'));
      if (!(personnes >= 1 && personnes <= 40)) return 'Indique un nombre de personnes entre 1 et 40.';
      retenir();
      const res = R.remplirSemaine(semaineEcrite(l), l, recettes(), B, { cases, nbVegetariens: Number(fd.get('vege')) || 0, nbPoisson: Number(fd.get('poisson')) || 0, soirsRapides: !!fd.get('rapides'), saison: !!fd.get('saison'), sansAllergenes: fd.getAll('allergene'), personnes, hist: hist(), eviterJours: E.reglages.eviterJours });
      E.semaines[l] = res.semaine;
      sauver(); rendre();
      toast(res.ajoutees.length ? `${pluriel(res.ajoutees.length, 'repas proposé')}. Touche un repas pour le changer.` : 'Aucune recette ne correspond à ces contraintes.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleSemainesTypes() {
    const l = lundi();
    const s = semaine(l);
    const nb = Object.keys(s.cases).length;
    const corps = `
      <p>Une semaine type garde les repas d'une semaine (recettes, restes, cantine, notes) pour les remettre d'un geste : soirs pressés, midis à la cantine, grand repas du dimanche.</p>
      ${E.semainesTypes.length ? `<ul class="mini-liste">${E.semainesTypes.map((ty) => `<li><span><b>${esc(ty.nom)}</b> · ${pluriel(Object.keys(ty.cases).length, 'repas')}</span><button type="button" class="btn petit" data-action="appliquer-type" data-id="${ty.id}">Appliquer</button><button type="button" class="btn-suppr" data-action="suppr-type" data-id="${ty.id}" aria-label="Supprimer la semaine type ${esc(ty.nom)}">×</button></li>`).join('')}</ul>
        <label class="case"><input type="checkbox" id="type-remplacer"> Remplacer aussi les repas déjà prévus (sinon, seuls les repas vides sont remplis)</label>` : '<p class="aide">Aucune semaine type pour l\'instant.</p>'}
      <div class="groupe"><h3>Enregistrer cette semaine</h3>${nb ? `<label class="champ">Nom de la semaine type<input name="nom" maxlength="60" placeholder="Ex. : Semaine d'école"></label>` : '<p class="mention">Prévois d\'abord quelques repas cette semaine.</p>'}</div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Semaines types', corps, nb ? '<button class="btn primaire" value="ok">Enregistrer comme semaine type</button><button class="btn" value="annuler">Fermer</button>' : '<button class="btn primaire" value="annuler">Fermer</button>', (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la semaine type.';
      retenir();
      E.semainesTypes.push({ id: R.nouvelId('t'), nom, cases: R.semaineTypeDepuis(s) });
      sauver(); rendre();
      toast(`Semaine type « ${nom} » enregistrée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Courses ----------
  function ligneArticle(l) {
    const q = R.texteQuantites(l.reste);
    const srcRec = [...new Set(l.sources.filter((x) => x.type === 'recette').map((x) => x.nom))];
    const libre = l.sources.find((x) => x.type === 'libre');
    const habituel = l.sources.some((x) => x.type === 'habituel');
    const cout = R.coutLigne(l.reste, E.prix[l.cle]);
    const detail = [srcRec.length ? srcRec.join(', ') : '', habituel ? 'chaque semaine' : '', libre && !srcRec.length ? 'ajouté à la main' : '', l.raison === 'partiel' ? `déjà ${R.texteQuantites([semaine().stock[l.cle]], 'brut')} à la maison` : '', l.aRacheter ? 'à racheter' : ''].filter(Boolean).join(' · ');
    return `<li class="article ${l.coche ? 'fait' : ''}">
      <label class="art-case"><input type="checkbox" data-action="cocher" data-cle="${esc(l.cle)}" ${l.coche ? 'checked' : ''}><span class="sr-only">Pris : ${esc(l.nom)}</span></label>
      <button class="art-info" data-action="article" data-cle="${esc(l.cle)}"><b>${esc(l.nom)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</button>
      <span class="art-qte">${q ? esc(q) : ''}${cout !== null ? `<small>${euros(cout)}</small>` : ''}</span>
    </li>`;
  }

  function vueCourses() {
    const l = lundi();
    const s = semaine(l);
    const liste = R.listeCourses(E, B, l);
    const bud = R.budget(liste.aAcheter, E.prix);
    const nbRepas = Object.values(s.cases).filter((c) => c.type === 'recette').length;
    const ajout2 = `<form id="form-libre" class="form-libre"><label class="champ"><span class="sr-only">Article à ajouter</span><input name="ligne" maxlength="100" placeholder="Ajouter un article : 2 l lait, liquide vaisselle…" autocomplete="off"></label><label class="champ"><span class="sr-only">Rayon</span><select name="rayon"><option value="">Rayon auto</option>${B.rayons.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select></label><label class="case"><input type="checkbox" name="habituel"> Chaque semaine</label><button class="btn primaire" type="submit">${ICONES.plus}Ajouter</button></form>`;
    return `
      <div class="vue-tete"><div><h1>Liste de courses</h1><p>${pluriel(nbRepas, 'recette')} cette semaine : quantités additionnées selon les portions de chaque repas, rangées par rayon, sans ce qui est déjà à la maison.</p></div>
        <div class="actions"><button class="btn" data-action="imprimer">Imprimer</button><button class="btn primaire" data-action="copier">Copier la liste</button></div></div>
      ${navSemaine()}
      ${ajout2}
      ${liste.aAcheter.length ? `<div class="progression"><span><b>${liste.nbCoches}</b> / ${pluriel(liste.aAcheter.length, 'article')} dans le panier</span>${bud.avecPrix ? `<span>Budget estimé : <b>${euros(bud.total)}</b> <small>(${bud.avecPrix} article${bud.avecPrix > 1 ? 's' : ''} avec ton prix sur ${liste.aAcheter.length})</small></span>` : '<span class="mention">Touche un article pour noter son prix : le budget s\'estime avec tes prix.</span>'}${liste.nbCoches ? '<button class="btn petit lien" data-action="decocher">Tout décocher</button>' : ''}</div>
        <div class="rayons">${liste.rayons.map((g) => `<section class="rayon"><h2>${esc(g.nom)} <span>${g.lignes.length}</span></h2><ul>${g.lignes.map(ligneArticle).join('')}</ul></section>`).join('')}</div>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${liste.enStock.length ? 'Tout est déjà à la maison' : 'Rien à acheter pour l\'instant'}</h3><p>${nbRepas ? 'Les ingrédients des repas prévus sont tous en stock.' : 'Prévois des repas sur la semaine : leurs ingrédients arrivent ici, rangés par rayon.'}</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="semaine">Prévoir les repas</button></div></div></div>`}
      ${liste.enStock.length ? `<section class="deja"><h2 class="titre-section">Déjà à la maison <span>${pluriel(liste.enStock.length, 'article')} retiré${liste.enStock.length > 1 ? 's' : ''} de la liste</span></h2><ul class="deja-liste">${liste.enStock.map((x) => `<li><button class="art-info" data-action="article" data-cle="${esc(x.cle)}"><b>${esc(x.nom)}</b><small>${x.raison === 'placard' ? 'Placard' : 'En stock cette semaine'} · ${esc(R.texteQuantites(x.quantites) || 'sans quantité')}</small></button><button class="btn petit" data-action="${x.raison === 'placard' ? 'racheter' : 'remettre'}" data-cle="${esc(x.cle)}">${x.raison === 'placard' ? 'À racheter' : 'Remettre'}</button></li>`).join('')}</ul></section>` : ''}
      ${AVERTISSEMENT}`;
  }

  function ajouterLibre(fd) {
    const i = R.lireLigneIngredient(fd.get('ligne'));
    if (!i) { toast('Écris un article, par exemple « 2 l lait ».'); return; }
    retenir();
    const art = { id: R.nouvelId('l'), ...i, ...(fd.get('rayon') ? { rayon: fd.get('rayon') } : {}) };
    if (fd.get('habituel')) E.habituels.push(art); else semaineEcrite().libres.push(art);
    sauver(); rendre();
    $('#form-libre [name=ligne]')?.focus();
    toast(`${R.majuscule(i.nom)} ajouté${fd.get('habituel') ? ' à chaque semaine' : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  // Article de la liste : déjà à la maison (tout ou une partie), placard, rayon, prix, origine.
  function modaleArticle(cle) {
    const l = lundi();
    const liste = R.listeCourses(E, B, l);
    const a = liste.lignes.find((x) => x.cle === cle);
    if (!a) return;
    const s = semaine(l);
    const st = s.stock[cle];
    const auPlacard = E.placard.some((p) => R.cleNom(p) === cle);
    const libres = s.libres.filter((x) => R.cleNom(x.nom) === cle);
    const habituels = E.habituels.filter((x) => R.cleNom(x.nom) === cle);
    const dimP = st && typeof st === 'object' ? st.dim : (a.quantites.find((q) => q.dim !== 'sans')?.dim || 'm');
    const unitesDim = R.LISTE_UNITES.filter((u) => R.UNITES[u][0] === dimP);
    const p = E.prix[cle];
    const sources = a.sources.filter((x) => x.type === 'recette');
    const corps = `
      <p class="art-total">Pour la semaine : <b>${esc(R.texteQuantites(a.quantites) || 'sans quantité')}</b></p>
      ${sources.length ? `<ul class="mini-liste">${sources.map((x) => `<li><span>${esc(R.majuscule(libCase(l, x.cle)))} · ${esc(x.nom)}</span></li>`).join('')}</ul>` : ''}
      <fieldset class="champ"><legend>Déjà à la maison cette semaine</legend><div class="choix-statut trois">${[['rien', 'Non'], ['partie', 'Une partie'], ['tout', 'Tout']].map(([k, lib]) => `<label><input type="radio" name="stock" value="${k}" ${(k === 'tout' && st === 'tout') || (k === 'partie' && st && typeof st === 'object') || (k === 'rien' && (!st || st === 'manque')) ? 'checked' : ''}><span>${lib}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs" data-partie><label class="champ">Quantité déjà là<input name="qteStock" inputmode="decimal" value="${st && typeof st === 'object' ? nombre(st.val / R.UNITES[unitesDim[0]][1], 3) : ''}"></label><label class="champ">Unité<select name="uniteStock">${(unitesDim.length ? unitesDim : ['pièce']).map((u) => `<option>${u}</option>`).join('')}</select></label></div>
      <label class="case"><input type="checkbox" name="placard" ${auPlacard ? 'checked' : ''}> Toujours au placard (retiré de la liste chaque semaine${st === 'manque' ? ' ; marqué à racheter cette semaine' : ''})</label>
      <label class="champ">Rayon<select name="rayon">${B.rayons.map(([id, n]) => `<option value="${id}" ${a.rayon === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <fieldset class="champ cadre-champs"><legend>Ton prix <small>Facultatif : sert seulement à estimer le budget. Aucun prix n'est fourni, ils changent d'un magasin et d'un mois à l'autre.</small></legend>
        <div class="rang-champs prix-champs"><label class="champ">Prix (${esc(E.reglages.monnaie)})<input name="prix" inputmode="decimal" value="${p ? nombre(p.prix, 2) : ''}" placeholder="Ex. : 2,40"></label><label class="champ">pour<input name="prixQte" inputmode="decimal" value="${p ? nombre(p.qte, 3) : '1'}"></label><label class="champ">Unité<select name="prixUnite">${R.LISTE_UNITES.map((u) => `<option ${(p?.unite || (dimP === 'm' ? 'kg' : dimP === 'v' ? 'l' : unitesDim[0] || 'pièce')) === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div></fieldset>
      ${libres.length || habituels.length ? `<div class="groupe"><h3>Ajouté à la main</h3><div class="rang">${libres.map((x) => `<button type="button" class="btn petit danger" data-action="suppr-libre" data-id="${x.id}">Retirer « ${esc(R.ecrireLigneIngredient(x))} »</button>`).join('')}${habituels.map((x) => `<button type="button" class="btn petit danger" data-action="suppr-habituel" data-id="${x.id}">Ne plus ajouter chaque semaine</button>`).join('')}</div></div>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(a.nom), corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const choix = fd.get('stock');
      let nouveau = null;
      if (choix === 'tout') nouveau = 'tout';
      if (choix === 'partie') {
        const q = R.lireNombre(fd.get('qteStock'));
        if (!(q > 0)) return 'Indique la quantité déjà là, par exemple 200.';
        nouveau = R.versBase(q, fd.get('uniteStock'));
      }
      let prix = null;
      if (String(fd.get('prix') || '').trim()) {
        const pv = R.lireNombre(fd.get('prix')), pq = R.lireNombre(fd.get('prixQte'));
        if (pv === null || !(pq > 0)) return 'Prix illisible : écris par exemple 2,40 pour 1 kg.';
        prix = { prix: pv, qte: pq, unite: fd.get('prixUnite') };
      }
      retenir();
      const sw = semaineEcrite(l);
      const placard = !!fd.get('placard');
      if (placard && !auPlacard) E.placard.push(a.nom.toLowerCase());
      if (!placard && auPlacard) E.placard = E.placard.filter((x) => R.cleNom(x) !== cle);
      if (nouveau) sw.stock[cle] = nouveau;
      else if (placard && choix === 'rien' && st === 'manque') sw.stock[cle] = 'manque';
      else delete sw.stock[cle];
      if (fd.get('rayon') !== R.rayonDe(a.nom, B, {}, '')) E.rayonsPerso[cle] = fd.get('rayon'); else delete E.rayonsPerso[cle];
      if (prix) E.prix[cle] = prix; else delete E.prix[cle];
      sauver(); rendre();
      toast(`${a.nom} : enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { d.querySelector('[data-partie]').hidden = d.querySelector('[name=stock]:checked')?.value !== 'partie'; };
    d.querySelectorAll('[name=stock]').forEach((el) => el.addEventListener('change', maj));
    maj();
  }

  async function copierListe() {
    const l = lundi();
    const liste = R.listeCourses(E, B, l);
    if (!liste.aAcheter.length) { toast('La liste est vide.'); return; }
    const texte = R.texteListe(liste, { titre: `Courses · semaine du ${dateCourte(l)}`, sansCoches: true });
    try { await navigator.clipboard.writeText(texte); toast('Liste copiée : colle-la dans un message ou une note.'); }
    catch {
      ouvrirModale('Copier la liste', `<p class="aide">Sélectionne le texte puis copie-le.</p><label class="champ"><span class="sr-only">Liste</span><textarea id="texte-liste" rows="14" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="annuler">Fermer</button>');
      const z = $('#texte-liste'); z.focus(); z.select();
    }
  }

  // ---------- Recettes ----------
  function carteRecette(r, h, t) {
    const inf = infos(r);
    const der = R.derniereFois(h, r.id, ajout(t, 1));
    return `<li><button class="carte-rec" data-action="recette" data-id="${r.id}">
      <span class="surtitre">${esc(NOM_CAT[r.categorie] || 'Mes recettes')}${r.modifiee ? ' · modifiée' : ''}</span>
      <b>${esc(r.nom)}</b>
      <span class="cr-meta">${pluriel(r.personnes, 'pers.', 'pers.')}${inf.temps ? ` · ${minutes(inf.temps)}` : ''} · ${r.saisons.length === 4 ? 'toute l\'année' : r.saisons.map((x) => NOM_SAISON[x].toLowerCase()).join(', ')}</span>
      <span class="ligne-etiquettes">${inf.etiquettes.slice(0, 4).map(etiquette).join('')}</span>
      <span class="rec-der">${der ? (der === t ? 'Au menu aujourd\'hui' : der > t ? `Prévue le ${dateCourte(der)}` : `Au menu il y a ${pluriel(R.ecart(der, t), 'jour')}`) : 'Jamais au menu'}</span>
    </button></li>`;
  }

  function vueRecettes() {
    const t = auj();
    const h = hist();
    const sai = R.saisonDe(t);
    const q = R.cleNom(filtre.q);
    const tous = recettes();
    const liste = tous.filter((r) => {
      const inf = infos(r);
      if (filtre.cat && r.categorie !== filtre.cat) return false;
      if (filtre.etiq && !inf.etiquettes.includes(filtre.etiq)) return false;
      if (filtre.saison && !r.saisons.includes(sai)) return false;
      if (q && !R.cleNom(`${r.nom} ${r.ingredients.map((i) => i.nom).join(' ')}`).includes(q)) return false;
      return true;
    }).sort((a, b) => a.nom.localeCompare(b.nom));
    const nbBase = tous.filter((r) => r.base).length;
    return `
      <div class="vue-tete"><div><h1>Recettes</h1><p>${nbBase} recettes de base rédigées par QME et ${pluriel(tous.length - nbBase, 'recette')} à toi. Quantités pour le nombre de personnes indiqué, recalculées pour chaque repas.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-recette">${ICONES.plus}Nouvelle recette</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer">${[['', 'Toutes'], ...B.etiquettes].map(([id, lib]) => `<button class="filtre" data-action="filtre-etiq" data-etiq="${id}" aria-pressed="${filtre.etiq === id}">${esc(lib)}</button>`).join('')}<button class="filtre" data-action="filtre-saison" aria-pressed="${filtre.saison}">De saison · ${esc(NOM_SAISON[sai].toLowerCase())}</button></div>
        <div class="rang-recherche">
          <label class="champ"><span class="sr-only">Catégorie</span><select id="filtre-cat"><option value="">Toutes les catégories</option>${B.categories.map(([id, n]) => `<option value="${id}" ${filtre.cat === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Recette ou ingrédient" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      <p class="resume-liste">${pluriel(liste.length, 'recette')}${E.masquees.length ? ` · ${pluriel(E.masquees.length, 'recette de base masquée', 'recettes de base masquées')} (Réglages pour les rétablir)` : ''}</p>
      ${liste.length ? `<ul class="cartes-recettes">${liste.map((r) => carteRecette(r, h, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune recette ne correspond</h3><p>Change le filtre ou la recherche, ou ajoute ta propre recette.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-recette">${ICONES.plus}Nouvelle recette</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  function modaleRecette(id) {
    const r = recette(id);
    if (!r) return;
    const inf = infos(r);
    const h = hist();
    const der = R.derniereFois(h, r.id, ajout(auj(), 1));
    let portions = E.reglages.personnes;
    const lignes = () => R.echelle(r, portions).map((i) => `<li><span class="ing-qte">${esc(R.texteQuantites([R.versBase(i.qte, i.unite)], 'recette'))}</span><span>${esc(i.nom)}</span></li>`).join('');
    const corps = `
      <p class="rec-meta">${esc(NOM_CAT[r.categorie] || 'Mes recettes')}${inf.temps ? ` · préparation ${minutes(r.preparation)}${r.cuisson ? `, cuisson ${minutes(r.cuisson)}` : ''}` : ''} · ${r.saisons.length === 4 ? 'toute l\'année' : r.saisons.map((x) => NOM_SAISON[x].toLowerCase()).join(', ')}</p>
      ${inf.etiquettes.length ? `<div class="ligne-etiquettes">${inf.etiquettes.map(etiquette).join('')}</div>` : ''}
      <div class="portions"><span>Pour</span><button type="button" class="btn petit" data-pas="-1" aria-label="Une personne de moins">−</button><b id="nb-portions">${pluriel(portions, 'personne')}</b><button type="button" class="btn petit" data-pas="1" aria-label="Une personne de plus">+</button><small>recette de base pour ${r.personnes}</small></div>
      <ul class="ingredients" id="ingredients">${lignes()}</ul>
      ${r.etapes.length ? `<h3 class="titre-etapes">Préparation</h3><ol class="etapes">${r.etapes.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      ${r.note ? `<p class="aide">${esc(r.note)}</p>` : ''}
      <p class="mention">${inf.allergenes.length ? `Allergènes possibles (indicatif) : ${inf.allergenes.map((a) => B.allergenes[a]).join(', ')}.` : 'Aucun des 14 allergènes majeurs repéré dans les ingrédients génériques (indicatif).'}${inf.inconnus ? ` ${pluriel(inf.inconnus, 'ingrédient')} hors de la base, non analysé${inf.inconnus > 1 ? 's' : ''}.` : ''} Vérifie toujours les étiquettes des produits.</p>
      <p class="mention">${der ? `Dernière fois au menu : ${fmt(der)}.` : 'Jamais au menu pour l\'instant.'}${r.base ? ` Recette de base rédigée par QME${r.modifiee ? ', modifiée par toi' : ''}.` : ''}</p>`;
    const pied = `<button class="btn primaire" value="planifier">Prévoir un repas</button><button class="btn" value="modifier">Modifier</button>${r.base ? `<button class="btn gauche" value="masquer">Masquer</button>${r.modifiee ? '<button class="btn" value="retablir">Rétablir l\'originale</button>' : ''}` : '<button class="btn danger gauche" value="supprimer">Supprimer</button>'}<button class="btn" value="dupliquer">Dupliquer</button>`;
    ouvrirModale(esc(r.nom), corps, pied, (_, action) => {
      if (action === 'planifier') { garderOuverte(); setTimeout(() => modalePlanifier(r.id, portions), 0); return; }
      if (action === 'modifier') { garderOuverte(); setTimeout(() => modaleEditionRecette(r.id), 0); return; }
      if (action === 'dupliquer') { garderOuverte(); setTimeout(() => modaleEditionRecette(r.id, { copie: true }), 0); return; }
      retenir();
      if (action === 'masquer') { E.masquees.push(r.id); E.recettes = E.recettes.filter((x) => x.id !== r.id); toast(`« ${r.nom} » masquée. Réglages pour la rétablir.`, { libelle: 'Annuler', faire: annuler }); }
      if (action === 'retablir') { E.recettes = E.recettes.filter((x) => x.id !== r.id); toast('Recette d\'origine rétablie.', { libelle: 'Annuler', faire: annuler }); }
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${r.nom} » ? Les repas déjà prévus avec elle afficheront « recette supprimée ».`)) { annulation = null; garderOuverte(); return; }
        E.recettes = E.recettes.filter((x) => x.id !== r.id); toast('Recette supprimée.', { libelle: 'Annuler', faire: annuler });
      }
      sauver(); rendre();
    });
    const d = modale();
    d.querySelectorAll('.portions [data-pas]').forEach((b) => b.addEventListener('click', () => {
      portions = Math.min(40, Math.max(1, portions + Number(b.dataset.pas)));
      d.querySelector('#nb-portions').textContent = pluriel(portions, 'personne');
      d.querySelector('#ingredients').innerHTML = lignes();
    }));
  }

  function modalePlanifier(id, personnes) {
    const r = recette(id);
    const l = lundi();
    const s = semaine(l);
    const cr = creneaux();
    const premierVide = cr.find((k) => !s.cases[k] && R.dateCase(l, k) >= auj()) || cr.find((k) => !s.cases[k]) || cr[0];
    const corps = `
      <p>Semaine ${R.ecart(R.lundiDe(auj()), l) === 0 ? 'en cours' : `du ${dateCourte(l)}`} (change de semaine depuis l'onglet Semaine).</p>
      <label class="champ">Repas<select name="cle">${cr.map((k) => { const c = s.cases[k]; const occ = c ? (c.type === 'recette' ? recette(c.recette)?.nom || 'recette' : c.type === 'restes' ? 'restes' : c.texte || c.type) : ''; return `<option value="${k}" ${k === premierVide ? 'selected' : ''}>${esc(R.majuscule(libCase(l, k)))} ${fmt(R.dateCase(l, k), { day: 'numeric', month: 'short' })}${occ ? ` · remplace : ${esc(occ)}` : ''}</option>`; }).join('')}</select></label>
      <label class="champ">Personnes<input type="number" name="personnes" min="1" max="40" value="${personnes}" inputmode="numeric"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Prévoir · ${esc(r.nom)}`, corps, '<button class="btn primaire" value="ok">Prévoir</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const n = Number(fd.get('personnes'));
      if (!(n >= 1 && n <= 40)) return 'Indique un nombre de personnes entre 1 et 40.';
      const cle = fd.get('cle');
      retenir();
      const sw = semaineEcrite(l);
      if (sw.cases[cle]?.type === 'recette') E.semaines[l] = R.viderCase(sw, cle);
      E.semaines[l].cases[cle] = { type: 'recette', recette: r.id, personnes: n };
      sauver(); rendre();
      toast(`${r.nom} : ${libCase(l, cle)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEditionRecette(id, { copie = false } = {}) {
    const src = id ? recette(id) : null;
    const v = src ? { ...src, nom: copie ? `${src.nom} (copie)` : src.nom } : { nom: '', categorie: 'perso', personnes: E.reglages.personnes, preparation: 15, cuisson: 20, saisons: ['p', 'e', 'a', 'h'], etiquettes: [], ingredients: [], etapes: [], note: '' };
    const garde = src?.base && !copie;
    const corps = `
      ${garde ? '<p class="aide">Recette de base : ta version la remplace partout. « Rétablir l\'originale » revient à la recette de base.</p>' : ''}
      <label class="champ">Nom<input name="nom" maxlength="100" required value="${esc(v.nom)}"></label>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="categorie">${B.categories.map(([k, n]) => `<option value="${k}" ${v.categorie === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="champ">Pour (personnes)<input type="number" name="personnes" min="1" max="40" value="${v.personnes}" inputmode="numeric"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Préparation (min)<input type="number" name="preparation" min="0" max="1440" value="${v.preparation}" inputmode="numeric"></label>
        <label class="champ">Cuisson (min)<input type="number" name="cuisson" min="0" max="1440" value="${v.cuisson}" inputmode="numeric"></label>
      </div>
      <fieldset class="champ"><legend>Saisons</legend><div class="cases">${B.saisons.map(([k, n]) => `<label class="case"><input type="checkbox" name="saison" value="${k}" ${v.saisons.includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Étiquettes <small>Végétarien, poisson et rapide se déduisent des ingrédients et du temps.</small></legend><div class="cases">${B.etiquettes.slice(3).map(([k, n]) => `<label class="case"><input type="checkbox" name="etiquette" value="${k}" ${v.etiquettes.includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div></fieldset>
      <label class="champ">Ingrédients <small>Un par ligne, quantité d'abord : « 400 g spaghetti », « 2 gousses ail », « 3 œufs », « 1 c. à s. huile d'olive ».</small><textarea name="ingredients" rows="9">${esc(v.ingredients.map(R.ecrireLigneIngredient).join('\n'))}</textarea></label>
      <div id="apercu-ing" class="apercu" aria-live="polite"></div>
      <label class="champ">Préparation <small>Une étape par ligne.</small><textarea name="etapes" rows="5">${esc(v.etapes.join('\n'))}</textarea></label>
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(src && !copie ? `Modifier · ${esc(src.nom)}` : 'Nouvelle recette', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la recette.';
      const ingredients = String(fd.get('ingredients') || '').split('\n').map(R.lireLigneIngredient).filter(Boolean);
      if (!ingredients.length) return 'Ajoute au moins un ingrédient, un par ligne.';
      const n = R.normaliserRecette({ id: garde ? src.id : R.nouvelId('r'), nom, categorie: fd.get('categorie'), personnes: fd.get('personnes'), preparation: fd.get('preparation'), cuisson: fd.get('cuisson'), saisons: fd.getAll('saison'), etiquettes: fd.getAll('etiquette'), ingredients, etapes: String(fd.get('etapes') || '').split('\n'), note: fd.get('note') });
      retenir();
      const i = E.recettes.findIndex((x) => x.id === n.id);
      if (i >= 0) E.recettes[i] = n; else E.recettes.push(n);
      sauver(); rendre();
      toast(`« ${n.nom} » enregistrée.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => {
      const ings = String(d.querySelector('[name=ingredients]').value).split('\n').map(R.lireLigneIngredient).filter(Boolean);
      const hors = ings.filter((x) => R.rayonDe(x.nom, B, E) === 'au');
      d.querySelector('#apercu-ing').innerHTML = ings.length ? `<p>${pluriel(ings.length, 'ingrédient')} lu${ings.length > 1 ? 's' : ''}${hors.length ? ` ; hors de la base, rangé${hors.length > 1 ? 's' : ''} dans « Autres » (change le rayon depuis la liste de courses) : ${hors.map((x) => esc(x.nom)).join(', ')}` : ''}.</p>` : '';
    };
    d.querySelector('[name=ingredients]').addEventListener('input', maj);
    maj();
  }

  // ---------- Historique ----------
  function vueHistorique() {
    const t = auj();
    const L = R.lundiDe(t);
    const depuis4 = ajout(L, -28);
    const semainesPassees = Object.keys(E.semaines).filter((l) => l < L && Object.keys(E.semaines[l].cases).length).sort().reverse();
    let repas = 0, restes = 0, vege = 0;
    const diff = new Set();
    for (const l of semainesPassees.filter((x) => x >= depuis4)) {
      for (const c of Object.values(E.semaines[l].cases)) {
        if (c.type === 'recette') { repas += 1; diff.add(c.recette); const r = recette(c.recette); if (r && infos(r).vegetarien) vege += 1; }
        if (c.type === 'restes') restes += 1;
      }
    }
    const freq = R.frequences(E, ajout(L, -84), ajout(L, -1)).slice(0, 8);
    const h = hist();
    const aRefaire = [...h.entries()].map(([id, d]) => ({ id, der: d.filter((x) => x < L).at(-1) })).filter((x) => x.der && R.ecart(x.der, t) > 42 && recette(x.id)).sort((a, b) => a.der.localeCompare(b.der)).slice(0, 8);
    const tuiles = [
      ['Repas cuisinés', String(repas), '4 dernières semaines', 'var(--bleu)', 'rond'],
      ['Recettes différentes', String(diff.size), '4 dernières semaines', 'var(--jaune)', ''],
      ['Repas de restes', String(restes), 'sans cuisiner', 'var(--rouge)', 'rond'],
      ['Repas végétariens', String(vege), '4 dernières semaines', 'var(--encre)', ''],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const ligneRec = (id, info) => { const r = recette(id); return r ? `<li><button class="lien-ligne" data-action="recette" data-id="${id}"><b>${esc(r.nom)}</b><span>${info}</span></button><button class="btn petit" data-action="planifier" data-id="${id}">Prévoir</button></li>` : ''; };
    return `
      <div class="vue-tete"><div><h1>Historique</h1><p>Ce qui a été au menu, pour varier et retrouver les plats qui plaisent. Le tirage des repas évite les recettes servies depuis moins de ${pluriel(E.reglages.eviterJours, 'jour')}.</p></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Les plus servies <span>12 dernières semaines</span></h2>
          ${freq.length ? `<ul class="prochains">${freq.map((x) => ligneRec(x.id, `${pluriel(x.n, 'fois', 'fois')} · dernière le ${dateCourte(x.derniere)}`)).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Pas encore d\'historique</h3><p>Les semaines passées s\'affichent ici au fil des repas prévus.</p></div></div>'}
        </section>
        <section><h2 class="titre-section">À refaire <span>pas servies depuis plus de 6 semaines</span></h2>
          ${aRefaire.length ? `<ul class="prochains">${aRefaire.map((x) => ligneRec(x.id, `dernière fois le ${fmt(x.der)}`)).join('')}</ul>` : '<p class="aide">Rien pour l\'instant : les recettes déjà servies et oubliées depuis 6 semaines reviendront ici.</p>'}
        </section>
      </div>
      <h2 class="titre-section">Semaines passées <span>${pluriel(semainesPassees.length, 'semaine')}</span></h2>
      ${semainesPassees.length ? `<ul class="semaines-passees">${semainesPassees.slice(0, 8).map((l) => {
        const s = E.semaines[l];
        const recs = Object.entries(s.cases).filter(([, c]) => c.type === 'recette').sort(([a], [b]) => R.ordreCase(a, b)).map(([, c]) => recette(c.recette)?.nom).filter(Boolean);
        return `<li><button class="lien-ligne" data-action="aller-semaine" data-lundi="${l}"><b>Semaine du ${dateCourte(l)}</b><span>${pluriel(recs.length, 'recette')} : ${esc(recs.slice(0, 6).join(', '))}${recs.length > 6 ? '…' : ''}</span></button></li>`;
      }).join('')}</ul>` : '<p class="aide">Aucune semaine passée.</p>'}
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

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const ordre = R.regrouper(B.rayons.map(([id]) => ({ cle: id, rayon: id })), B.rayons, r.ordreRayons).map((g) => g.id);
    const prix = Object.entries(E.prix).sort(([a], [b]) => a.localeCompare(b));
    const corps = `
      <label class="champ">Nom du foyer<input name="foyer" maxlength="80" value="${esc(E.foyer)}"></label>
      <div class="rang-champs">
        <label class="champ">Personnes par défaut<input type="number" name="personnes" min="1" max="20" value="${r.personnes}" inputmode="numeric"></label>
        <label class="champ">Éviter une recette pendant (jours)<input type="number" name="eviter" min="0" max="120" value="${r.eviterJours}" inputmode="numeric"></label>
      </div>
      <fieldset class="champ"><legend>Repas à prévoir</legend><div class="cases">${R.REPAS.map(([k, lib]) => `<label class="case"><input type="checkbox" name="repas" value="${k}" ${r.repas.includes(k) ? 'checked' : ''}> ${lib}</label>`).join('')}</div></fieldset>
      <div class="groupe"><h3>Ordre des rayons</h3><p class="aide">Dans l'ordre de ton magasin : la liste suit cet ordre.</p>
        <ol class="ordre-rayons">${ordre.map((id, i) => `<li data-id="${id}"><span>${esc(NOM_RAYON[id])}</span><button type="button" class="btn-suppr" data-action="rayon-monter" data-id="${id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${esc(NOM_RAYON[id])}">↑</button><button type="button" class="btn-suppr" data-action="rayon-descendre" data-id="${id}" ${i === ordre.length - 1 ? 'disabled' : ''} aria-label="Descendre ${esc(NOM_RAYON[id])}">↓</button></li>`).join('')}</ol></div>
      <div class="groupe"><h3>Placard</h3><p class="aide">Toujours à la maison : retiré de la liste chaque semaine, sauf si tu le marques « à racheter ». Un article par ligne.</p>
        <label class="champ"><span class="sr-only">Articles du placard</span><textarea name="placard" rows="6">${esc(E.placard.join('\n'))}</textarea></label></div>
      <div class="groupe"><h3>Chaque semaine</h3><p class="aide">Ajoutés à toutes les listes (pain, café, yaourts…). Un par ligne, quantité d'abord.</p>
        <label class="champ"><span class="sr-only">Articles de chaque semaine</span><textarea name="habituels" rows="4">${esc(E.habituels.map(R.ecrireLigneIngredient).join('\n'))}</textarea></label></div>
      <div class="groupe"><h3>Mes prix</h3><p class="aide">Aucun prix n'est fourni : ceux que tu notes sur un article servent à estimer le budget de la semaine.</p>
        ${prix.length ? `<ul class="mini-liste">${prix.map(([k, p]) => `<li><span>${esc(R.majuscule(k))} · ${euros(p.prix)} pour ${esc(R.texteQuantite(...Object.values(R.versBase(p.qte, p.unite))) || `${nombre(p.qte)} ${p.unite}`)}</span><button type="button" class="btn-suppr" data-action="suppr-prix" data-id="${esc(k)}" aria-label="Retirer ce prix">×</button></li>`).join('')}</ul>` : '<p class="mention">Aucun prix noté.</p>'}</div>
      ${E.masquees.length ? `<div class="groupe"><h3>Recettes masquées</h3><p class="aide">${pluriel(E.masquees.length, 'recette de base masquée', 'recettes de base masquées')}.</p><div class="rang"><button type="button" class="btn petit" data-action="retablir-masquees">Les rétablir</button></div></div>` : ''}
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">La liste de courses de la semaine affichée en tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter la liste en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, en magasin par exemple.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Ton planning est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. Il ne contient que ce que tu saisis : repas, recettes, articles et prix. Aucune donnée de santé n'est demandée.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${B.recettes.length} recettes de base rédigées par QME (version ${B.version}) : des plats du quotidien, sans reprise d'un site, d'un livre ou d'une marque. Allergènes indicatifs d'après les 14 allergènes à déclaration obligatoire (règlement UE n° 1169/2011) appliqués à des ingrédients génériques : les étiquettes des produits font foi. Aucun lien vers un magasin, aucun prix intégré, aucune donnée envoyée ailleurs.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const repas = fd.getAll('repas');
      if (!repas.length) return 'Coche au moins un repas (midi ou soir).';
      const pers = Number(fd.get('personnes'));
      if (!(pers >= 1 && pers <= 20)) return 'Personnes par défaut : entre 1 et 20.';
      retenir();
      E.foyer = String(fd.get('foyer') || '').trim();
      E.reglages = R.normaliserReglages({ ...r, personnes: pers, repas, eviterJours: fd.get('eviter'), ordreRayons: [...modale().querySelectorAll('.ordre-rayons li')].map((li) => li.dataset.id) }, B.reglages);
      E.placard = [...new Map(String(fd.get('placard') || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => [R.cleNom(x), x])).values()];
      const anciens = new Map(E.habituels.map((h) => [R.ecrireLigneIngredient(h), h]));
      E.habituels = String(fd.get('habituels') || '').split('\n').map((x) => { const t = x.trim(); if (!t) return null; if (anciens.has(t)) return anciens.get(t); const i = R.lireLigneIngredient(t); return i ? { id: R.nouvelId('h'), ...i } : null; }).filter(Boolean);
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const donnees = JSON.parse(await fichier.text());
        if (!donnees || typeof donnees.semaines !== 'object' || !Array.isArray(donnees.recettes)) throw new Error();
        if (!confirm(`Remplacer ton planning actuel par cette copie (${pluriel(Object.keys(donnees.semaines).length, 'semaine')}, ${pluriel(donnees.recettes.length, 'recette perso', 'recettes perso')}) ?`)) return;
        E = normaliser(donnees); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du planning.'); }
    });
  }

  // Ordre des rayons : déplacé dans la fenêtre, enregistré avec les réglages.
  function deplacerRayon(id, pas) {
    const ol = modale().querySelector('.ordre-rayons');
    const li = ol?.querySelector(`li[data-id="${id}"]`);
    if (!li) return;
    if (pas < 0 && li.previousElementSibling) ol.insertBefore(li, li.previousElementSibling);
    if (pas > 0 && li.nextElementSibling) ol.insertBefore(li.nextElementSibling, li);
    const lis = [...ol.children];
    lis.forEach((x, i) => { x.querySelector('[data-action=rayon-monter]').disabled = i === 0; x.querySelector('[data-action=rayon-descendre]').disabled = i === lis.length - 1; });
    const b = li.querySelector(`[data-action=rayon-${pas < 0 ? 'monter' : 'descendre'}]`);
    (b.disabled ? li.querySelector('button:not(:disabled)') : b)?.focus();
  }

  function telecharger(contenu, typeMime, nom) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `repas-courses-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(R.listeCourses(E, B, lundi()), B), 'text/csv;charset=utf-8', `courses-${lundi()}.csv`);

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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); lundiVu = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': { const p = Number(accueil.personnes); if (!(p >= 1 && p <= 20)) { toast('Indique entre 1 et 20 personnes.'); break; } accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break; }
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'semaine-pas': { const p = Number(el.dataset.pas); lundiVu = p ? ajout(lundi(), 7 * p) : null; rendre(); break; }
      case 'aller-semaine': lundiVu = el.dataset.lundi; changerVue('semaine'); break;
      case 'case': modaleCase(el.dataset.cle); break;
      case 'proposer': modaleProposer(); break;
      case 'semaines-types': modaleSemainesTypes(); break;
      case 'appliquer-type': {
        const ty = E.semainesTypes.find((x) => x.id === id);
        if (!ty) break;
        retenir();
        E.semaines[lundi()] = R.appliquerType(semaineEcrite(), ty.cases, !!$('#type-remplacer')?.checked);
        sauver(); rendre(); modale().close();
        toast(`Semaine type « ${ty.nom} » appliquée.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'suppr-type': { const ty = E.semainesTypes.find((x) => x.id === id); if (!ty || !confirm(`Supprimer la semaine type « ${ty.nom} » ?`)) break; retenir(); E.semainesTypes = E.semainesTypes.filter((x) => x.id !== id); sauver(); modaleSemainesTypes(); toast('Semaine type supprimée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'vider-semaine': if (!confirm('Vider tous les repas de cette semaine ? La liste de courses se vide aussi.')) break; retenir(); semaineEcrite().cases = {}; sauver(); rendre(); toast('Semaine vidée.', { libelle: 'Annuler', faire: annuler }); break;
      case 'imprimer': window.print(); break;
      case 'copier': copierListe(); break;
      case 'cocher': { const s = semaineEcrite(); const k = el.dataset.cle; if (el.checked) s.coches[k] = true; else delete s.coches[k]; sauver(); el.closest('.article')?.classList.toggle('fait', el.checked); const n = $('.progression b'); if (n) n.textContent = String(Object.keys(s.coches).filter((x) => R.listeCourses(E, B, lundi()).aAcheter.some((l) => l.cle === x)).length); break; }
      case 'decocher': retenir(); semaineEcrite().coches = {}; sauver(); rendre(); toast('Tout est décoché.', { libelle: 'Annuler', faire: annuler }); break;
      case 'article': modaleArticle(el.dataset.cle); break;
      case 'racheter': retenir(); semaineEcrite().stock[el.dataset.cle] = 'manque'; sauver(); rendre(); toast('Remis dans la liste pour cette semaine.', { libelle: 'Annuler', faire: annuler }); break;
      case 'remettre': retenir(); delete semaineEcrite().stock[el.dataset.cle]; sauver(); rendre(); toast('Remis dans la liste.', { libelle: 'Annuler', faire: annuler }); break;
      case 'suppr-libre': retenir(); semaineEcrite().libres = semaineEcrite().libres.filter((x) => x.id !== id); sauver(); rendre(); modale().close(); toast('Article retiré.', { libelle: 'Annuler', faire: annuler }); break;
      case 'suppr-habituel': retenir(); E.habituels = E.habituels.filter((x) => x.id !== id); sauver(); rendre(); modale().close(); toast('Article retiré des listes de chaque semaine.', { libelle: 'Annuler', faire: annuler }); break;
      case 'suppr-prix': retenir(); delete E.prix[id]; sauver(); el.closest('li')?.remove(); toast('Prix retiré.', { libelle: 'Annuler', faire: annuler }); break;
      case 'retablir-masquees': retenir(); E.masquees = []; sauver(); rendre(); modale().close(); toast('Recettes rétablies.', { libelle: 'Annuler', faire: annuler }); break;
      case 'rayon-monter': deplacerRayon(id, -1); break;
      case 'rayon-descendre': deplacerRayon(id, 1); break;
      case 'recette': modaleRecette(id); break;
      case 'planifier': modalePlanifier(id, E.reglages.personnes); break;
      case 'nouvelle-recette': modaleEditionRecette(null); break;
      case 'filtre-etiq': filtre.etiq = el.dataset.etiq; rendre(); break;
      case 'filtre-saison': filtre.saison = !filtre.saison; rendre(); break;
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
  window.__repas = { etat: () => E, regles: R };
  init();
})();
