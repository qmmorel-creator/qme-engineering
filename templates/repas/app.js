// Repas de la semaine QME : planning midi et soir, liste de courses agrégée par rayon et cochée au magasin,
// recettes de la base et recettes perso, « avec ce qu'il me reste ». Données synchronisées par clé de licence
// ou code d'accès. Aucun magasin, aucun drive ni aucun service externe connecté.
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
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const jourCourt = (s) => fmt(s, { weekday: 'short', day: 'numeric' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const minutes = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${String(n % 60).padStart(2, '0')}` : ''}` : `${n} min`);
  function titreSemaine(l) {
    const fin = ajout(l, 6);
    const memeMois = l.slice(5, 7) === fin.slice(5, 7);
    const debut = versDate(l).toLocaleDateString('fr-FR', memeMois ? { day: 'numeric' } : { day: 'numeric', month: 'long' });
    return `Semaine du ${debut} au ${versDate(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
  }

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'semaine';
  let semaine = R.lundi(auj());
  const filtreR = { q: '', cat: 'toutes', vegetarien: false, sansPorc: false, rapide: false, saison: false, favoris: false, perso: false };
  const filtreC = { masquerPris: false };
  let maxManque = 2;
  let annulation = null;

  const etatVide = () => R.etatVide(B);
  const normaliser = (d) => R.normaliser(d, B);

  // Catalogue d'ingrédients (base + perso) et recettes (base + perso), recalculés à la demande.
  const catalogue = () => R.indexer([...B.ingredients, ...E.ingredients]);
  const toutesRecettes = () => [...B.recettes, ...E.recettes];
  const recettesParId = () => R.indexer(toutesRecettes());
  const nomRayon = (id) => (B.rayons.find((r) => r.id === id) || { nom: 'Autres' }).nom;
  const nomCat = (id) => (B.categories.find((c) => c.id === id) || { court: id }).court;
  const saison = () => R.saisonDe(auj());
  const nomSaison = (id) => (B.saisons.find((s) => s.id === id) || { nom: '' }).nom;

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
    E.courses = R.purgerCourses(E.courses, auj());
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
        toast('Un autre appareil a modifié tes repas entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Foyer fictif de quatre personnes. Semaine passée complète (pour « copier »), semaine en cours remplie avec
  // des cantines et des restes, deux créneaux vides, un repas pour six ; courses à moitié cochées, deux articles
  // déjà à la maison, articles ajoutés à la main et habituels ; deux recettes perso ; frigo de fin de semaine.
  function donneesDemo() {
    const e = etatVide();
    const l = R.lundi(auj());
    const prec = ajout(l, -7);
    const suiv = ajout(l, 7);
    e.personnes = 4;
    e.favoris = ['poulet-curry-coco', 'gratin-courgettes', 'crepes', 'soupe-potiron', 'quiche-poireaux'];
    e.ingredients = [{ id: 'perso-sauce-tomate-maison', nom: 'Sauce tomate maison (bocal)', rayon: 'co', unite: 'pc', perso: true }];
    e.recettes = [
      R.normaliserRecette({ id: 'p-poelee-wok', nom: 'Poêlée de légumes au wok et riz', cat: 'plat', prep: 15, cuisson: 15, saisons: '', portions: 4,
        ingredients: [['riz', 300], ['brocoli', 1], ['carotte', 3], ['poivron', 1], ['oignon', 1], ['sauce-soja', 45], ['huile', 30], ['gingembre', 10]],
        etapes: ['Cuis le riz.', 'Coupe les légumes en petits morceaux et fais-les sauter 8 minutes à feu vif dans l\'huile.', 'Ajoute le gingembre râpé et la sauce soja, mélange 1 minute.'], note: 'Le préféré du mercredi.' }, ['plat']),
      R.normaliserRecette({ id: 'p-pates-sauce-maison', nom: 'Pâtes à la sauce tomate maison', cat: 'plat', prep: 5, cuisson: 12, saisons: '', portions: 4,
        ingredients: [['pates', 400], ['perso-sauce-tomate-maison', 1], ['parmesan', 40]],
        etapes: ['Cuis les pâtes.', 'Fais chauffer la sauce et mélange.'], origine: null }, ['plat']),
    ];
    const P = (date, moment, recette, personnes = 4) => R.normaliserRepas({ id: uid(), date, moment, recette, personnes });
    const T = (date, moment, texte) => R.normaliserRepas({ id: uid(), date, moment, texte, personnes: 4 });
    const j = (base, k) => ajout(base, k);
    e.repas = [
      // Semaine passée
      T(j(prec, 0), 'midi', 'Cantine'), P(j(prec, 0), 'soir', 'soupe-poireaux'),
      T(j(prec, 1), 'midi', 'Cantine'), P(j(prec, 1), 'soir', 'pates-epinards'),
      T(j(prec, 2), 'midi', 'Restes'), P(j(prec, 2), 'soir', 'p-poelee-wok'),
      T(j(prec, 3), 'midi', 'Cantine'), P(j(prec, 3), 'soir', 'quiche-poireaux'),
      T(j(prec, 4), 'midi', 'Cantine'), P(j(prec, 4), 'soir', 'pizza-legumes'),
      P(j(prec, 5), 'midi', 'poulet-roti-pdt'), P(j(prec, 5), 'soir', 'soupe-potiron'),
      P(j(prec, 6), 'midi', 'boeuf-carottes', 6), P(j(prec, 6), 'soir', 'croque-monsieur'),
      // Semaine en cours
      T(j(l, 0), 'midi', 'Cantine'), P(j(l, 0), 'soir', 'soupe-hiver'),
      T(j(l, 1), 'midi', 'Cantine'), P(j(l, 1), 'soir', 'poulet-curry-coco'),
      T(j(l, 2), 'midi', 'Restes'), P(j(l, 2), 'soir', 'p-poelee-wok'),
      T(j(l, 3), 'midi', 'Cantine'), P(j(l, 3), 'soir', 'gratin-courgettes'),
      T(j(l, 4), 'midi', 'Cantine'), P(j(l, 4), 'soir', 'quiche-poireaux'),
      P(j(l, 5), 'midi', 'hachis-parmentier', 6), P(j(l, 5), 'midi', 'compote-pommes', 6),
      P(j(l, 6), 'midi', 'saucisses-lentilles'), P(j(l, 6), 'soir', 'crepes'),
      // Semaine suivante, à peine commencée
      P(j(suiv, 0), 'soir', 'soupe-lentilles'), P(j(suiv, 2), 'soir', 'p-pates-sauce-maison'),
    ];
    // Samedi soir reste vide : la démo montre un créneau à remplir.
    const cat = R.indexer([...B.ingredients, ...e.ingredients]);
    const lignes = R.lignesDepuisRepas(R.repasSemaine(e.repas, l), R.indexer([...B.recettes, ...e.recettes]));
    const articles = R.listeCourses(lignes, cat, { ordreRayons: e.ordreRayons }).filter((a) => !a.placard);
    const cles = articles.map((a) => a.cle);
    const prendre = (ids) => cles.filter((c) => ids.some((id) => c.startsWith(`${id}|`)));
    e.habituels = [{ id: 'h1', nom: 'Fruits de la semaine', rayon: 'fl' }, { id: 'h2', nom: 'Pain', rayon: 'bl' }, { id: 'h3', nom: 'Papier toilette', rayon: 'mh' }];
    e.courses[l] = {
      coches: [...prendre(['poireau', 'carotte', 'navet', 'courgette', 'oignon', 'filet-poulet', 'lait-coco']), 'h:h1'],
      maison: prendre(['riz', 'lentilles']),
      extras: [{ id: 'x1', nom: 'Liquide vaisselle', qte: '', rayon: 'mh' }, { id: 'x2', nom: 'Jus de pomme', qte: '2 bouteilles', rayon: 'bs' }, { id: 'x3', nom: 'Goûters de la semaine', qte: '', rayon: 'su' }],
      placard: ['farine|masse'],
    };
    e.frigo = ['oeuf', 'pomme-de-terre', 'courgette', 'gruyere', 'oignon', 'creme-liquide'];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Repas de la semaine · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="80" cy="80" r="60" fill="#F5B400"/>
          <rect x="160" y="20" width="120" height="120" fill="#1D4E89"/>
          <path d="M20 280 L20 160 A120 120 0 0 1 140 280 Z" fill="#D9302A"/>
          <rect x="160" y="160" width="120" height="120" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="430" cy="150" r="130" fill="#F0EDE6"/>
          <circle cx="430" cy="150" r="86" fill="#141414"/>
          <circle cx="430" cy="150" r="30" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Repas de la semaine</p>
          <h1>Le menu fait, la liste aussi.</h1>
          <p>Tu choisis les repas du midi et du soir, la liste de courses se calcule toute seule, rangée par rayon, et se coche au magasin sur ton téléphone.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes repas</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes repas et ta liste sont enregistrés en ligne et te suivent sur tous tes appareils, téléphone compris au magasin.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes repas</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore de clé ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes repas'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const caseRegimes = (choisis) => B.regimes.map((g) => `<label class="choix-ligne"><input type="checkbox" name="regime" value="${g.id}" ${choisis.includes(g.id) ? 'checked' : ''}><span><b>${esc(g.nom)}</b> <small>${esc(g.aide)}</small></span></label>`).join('');

  function ecranAccueil() {
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>Tes repas de la semaine, et la liste qui va avec.</h1>
      <p class="intro">${B.recettes.length} recettes familiales simples sont prêtes à l'emploi, et tu peux ajouter les tiennes. Deux réglages pour commencer, modifiables ensuite.</p>
      <form id="form-accueil" novalidate>
        <label class="champ" style="max-width:280px">Combien êtes-vous à table, d'habitude ?<small>Les quantités se calculent pour ce nombre ; chaque repas peut en avoir un autre.</small><input type="number" name="personnes" min="1" max="30" step="1" inputmode="numeric" value="4" required></label>
        <fieldset class="champ cadre-champs" style="max-width:620px;margin-top:16px"><legend>Régimes du foyer <small>Les propositions de repas les respectent. Rien à cocher si tout le monde mange de tout.</small></legend><div class="choix-liste">${caseRegimes([])}</div></fieldset>
        <label class="case" style="margin-top:12px"><input type="checkbox" name="proposer" checked> Me proposer des repas pour cette semaine (les soirs et le week-end)</label>
        <p class="erreur" role="alert"></p>
      </form>
      <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Commencer</button></div>
    </div>`;
  }

  function terminerAccueil() {
    const f = $('#form-accueil');
    const personnes = Math.round(Number(f.querySelector('[name=personnes]').value));
    if (!(personnes >= 1 && personnes <= 30)) { f.querySelector('.erreur').textContent = 'Indique un nombre de personnes entre 1 et 30.'; return; }
    E = etatVide();
    E.personnes = personnes;
    E.regimes = [...f.querySelectorAll('[name=regime]:checked')].map((x) => x.value);
    let n = 0;
    if (f.querySelector('[name=proposer]').checked) {
      const l = R.lundi(auj());
      const creneaux = R.creneauxVides(E.repas, l).filter((c) => c.date >= auj() && (c.moment === 'soir' || R.indiceJour(c.date) >= 5));
      const props = R.proposer(toutesRecettes(), creneaux, catalogue(), { saison: saison(), regimes: E.regimes, graine: l });
      E.repas = props.map((p) => R.normaliserRepas({ ...p, id: uid(), personnes }));
      n = props.length;
    }
    vue = 'semaine'; semaine = R.lundi(auj());
    sauver();
    demarrer();
    toast(n ? `${pluriel(n, 'repas proposé', 'repas proposés')} : touche un repas pour le changer, la liste de courses suit.` : 'Ajoute un premier repas avec « + » : la liste de courses suit.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    semaine: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    courses: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    recettes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    restes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    etoile: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/></svg>',
  };
  const COURTS = { restes: 'Restes' };
  const ONGLETS = [['semaine', 'Semaine'], ['courses', 'Courses'], ['recettes', 'Recettes'], ['restes', 'Avec ce qu\'il reste']];
  const AVERTISSEMENT = `<p class="mention avertissement">${esc(B.avertissement)}</p>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/repas/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Repas de la semaine</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span>${COURTS[id] ? `<span class="court">${COURTS[id]}</span>` : ''}</button>`).join('')}</nav>
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
    document.title = `${titres[vue]} · Repas de la semaine`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { semaine: vueSemaine, courses: vueCourses, recettes: vueRecettes, restes: vueRestes }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtreR.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="30" cy="30" r="28" fill="#F5B400"/><rect x="40" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="72" cy="20" r="14" fill="#D9302A"/></svg>';

  // ---------- Petits composants ----------
  function etiquettesRecette(r, P, { saisonActuelle = saison() } = {}) {
    const g = R.regimes(r, P);
    return [
      g.vegetarien ? '<span class="etiquette ciel">Végé</span>' : '',
      !g.vegetarien && g.sansPorc ? '<span class="etiquette sable">Sans porc</span>' : '',
      g.poisson ? '<span class="etiquette ciel">Poisson</span>' : '',
      R.estRapide(r) ? '<span class="etiquette jaune">Rapide</span>' : '',
      String(r.saisons || '').trim() && R.deSaison(r, saisonActuelle) ? '<span class="etiquette rose">De saison</span>' : '',
      r.perso ? '<span class="etiquette">Ma recette</span>' : '',
    ].join('');
  }

  const navSemaine = () => {
    const actuelle = R.lundi(auj());
    return `<div class="nav-semaine" role="group" aria-label="Changer de semaine">
      <button class="btn-icone" data-action="semaine-prec" aria-label="Semaine précédente">${ICONES.gauche}</button>
      <span class="nav-semaine-titre"><b>${titreSemaine(semaine)}</b>${semaine === actuelle ? '<small>Cette semaine</small>' : semaine === ajout(actuelle, 7) ? '<small>Semaine prochaine</small>' : semaine === ajout(actuelle, -7) ? '<small>Semaine dernière</small>' : ''}</span>
      <button class="btn-icone" data-action="semaine-suiv" aria-label="Semaine suivante">${ICONES.droite}</button>
      ${semaine !== actuelle ? '<button class="btn petit" data-action="semaine-actuelle">Cette semaine</button>' : ''}
    </div>`;
  };

  // Articles de la liste de la semaine affichée : repas planifiés + articles habituels + ajoutés à la main.
  function etatCourses(l = semaine) {
    if (!E.courses[l]) E.courses[l] = R.normaliserCourses({});
    if (!E.courses[l].placard) E.courses[l].placard = [];
    return E.courses[l];
  }
  function articlesSemaine(l = semaine) {
    const P = catalogue();
    const repas = R.repasSemaine(E.repas, l);
    const st = E.courses[l] || { extras: [], placard: [] };
    const base = R.listeCourses(R.lignesDepuisRepas(repas, recettesParId()), P, { ordreRayons: E.ordreRayons, rayonsPerso: E.rayonsPerso });
    const habituels = E.habituels.map((h) => ({ cle: `h:${h.id}`, id: h.id, nom: h.nom, rayon: E.rayonsPerso[`h:${h.id}`] || h.rayon, texte: '', sources: ['Chaque semaine'], habituel: true }));
    const extras = (st.extras || []).map((x) => ({ cle: `x:${x.id}`, id: x.id, nom: x.nom, rayon: x.rayon, texte: x.qte, sources: [], extra: true }));
    return { recettes: base, habituels, extras, repas };
  }

  // ---------- Semaine ----------
  function ligneRepas(x, P, RP) {
    const r = x.recette ? RP.get(x.recette) : null;
    if (!r) return `<li><button class="plat libre" data-action="repas" data-id="${x.id}"><b>${esc(x.texte || 'Recette supprimée')}</b>${x.texte ? '<span>sans courses</span>' : ''}</button></li>`;
    const g = R.regimes(r, P);
    const diff = x.personnes !== E.personnes;
    return `<li><button class="plat cat-${r.cat}" data-action="repas" data-id="${x.id}"><b>${esc(r.nom)}</b><span>${diff ? `<em>${x.personnes} pers.</em> · ` : ''}${minutes(R.tempsTotal(r))}${g.vegetarien ? ' · végé' : ''}</span></button></li>`;
  }

  function vueSemaine() {
    const t = auj();
    const P = catalogue(); const RP = recettesParId();
    const jours = R.joursSemaine(semaine);
    const repas = R.repasSemaine(E.repas, semaine);
    const avecRecette = repas.filter((x) => x.recette && RP.get(x.recette));
    const vides = R.creneauxVides(E.repas, semaine).length;
    const vege = avecRecette.filter((x) => RP.get(x.recette).cat !== 'dessert' && R.regimes(RP.get(x.recette), P).vegetarien).length;
    const nbArticles = (() => { const a = articlesSemaine(); return a.recettes.filter((x) => !x.placard).length + a.habituels.length + a.extras.length; })();
    const precRepas = R.repasSemaine(E.repas, ajout(semaine, -7)).length;
    const grille = jours.map((d, k) => `
      <section class="jour ${d === t ? 'aujourdhui' : ''} ${d < t ? 'passe' : ''}" aria-label="${esc(dateLongue(d))}">
        <h2 class="jour-titre"><span>${R.JOURS[k]}</span><b>${versDate(d).getDate()}</b>${d === t ? '<em>Aujourd\'hui</em>' : ''}</h2>
        ${R.MOMENTS.map((m) => {
          const liste = R.repasDuJour(repas, d, m);
          return `<div class="creneau"><p class="creneau-titre">${R.LIB_MOMENT[m]}</p>${liste.length ? `<ul class="plats">${liste.map((x) => ligneRepas(x, P, RP)).join('')}</ul>` : ''}<button class="ajout-repas ${liste.length ? 'discret' : ''}" data-action="ajouter-repas" data-date="${d}" data-moment="${m}" aria-label="Ajouter un repas : ${esc(R.JOURS[k])} ${R.LIB_MOMENT[m].toLowerCase()}">${ICONES.plus}<span>${liste.length ? 'Ajouter' : 'Choisir'}</span></button></div>`;
        }).join('')}
      </section>`).join('');
    return `
      <div class="vue-tete"><div><h1>Semaine</h1><p>Midi et soir, une recette, plusieurs plats ou un simple « restes ». Chaque repas a son nombre de personnes ; la liste de courses suit toute seule.</p></div>
        <div class="actions"><button class="btn primaire" data-action="proposer">Proposer des repas</button>${precRepas && !repas.length ? '<button class="btn" data-action="copier-semaine">Reprendre la semaine dernière</button>' : ''}<button class="btn" data-action="vue" data-vue="courses">Liste de courses <span class="pastille-nb">${nbArticles}</span></button></div></div>
      ${navSemaine()}
      <p class="resume-semaine"><span><b>${avecRecette.length}</b> ${avecRecette.length > 1 ? 'plats planifiés' : 'plat planifié'}</span><span><b>${vege}</b> végé</span><span><b>${vides}</b> ${vides > 1 ? 'créneaux vides' : 'créneau vide'}</span><span><b>${E.personnes}</b> à table d'habitude</span></p>
      <div class="planning">${grille}</div>
      ${!repas.length ? `<div class="vide-etat" style="margin-top:20px">${FORME_VIDE}<div><h3>Semaine vide</h3><p>Choisis un repas avec « Choisir », fais-toi proposer des repas de saison, ${precRepas ? 'ou reprends la semaine dernière.' : 'ou pars de tes recettes favorites.'}</p><div class="actions"><button class="btn primaire" data-action="proposer">Proposer des repas</button>${precRepas ? '<button class="btn" data-action="copier-semaine">Reprendre la semaine dernière</button>' : ''}</div></div></div>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Courses ----------
  function ligneArticle(a, st) {
    const pris = st.coches.includes(a.cle);
    const detail = [a.achat ? a.achat.texte : '', a.sources.length && !a.habituel ? `pour ${a.sources.slice(0, 3).join(', ')}${a.sources.length > 3 ? '…' : ''}` : a.habituel ? 'chaque semaine' : ''].filter(Boolean).join(' · ');
    return `<li class="article ${pris ? 'pris' : ''}">
      <label class="article-case"><input type="checkbox" data-action="cocher" data-cle="${esc(a.cle)}" ${pris ? 'checked' : ''}><span class="coche" aria-hidden="true">${ICONES.coche}</span><span class="article-texte"><b>${esc(a.nom)}</b>${a.texte ? `<strong>${esc(a.texte)}</strong>` : ''}${detail ? `<small>${esc(detail)}</small>` : ''}</span></label>
      <button class="btn-icone petit" data-action="article" data-cle="${esc(a.cle)}" aria-label="Options : ${esc(a.nom)}">⋯</button>
    </li>`;
  }

  function vueCourses() {
    const st = E.courses[semaine] ? etatCourses() : { coches: [], maison: [], extras: [], placard: [] };
    const { recettes, habituels, extras, repas } = articlesSemaine();
    const placard = recettes.filter((a) => a.placard);
    const aPrendre = [...recettes.filter((a) => !a.placard || st.placard.includes(a.cle)), ...habituels, ...extras];
    const maison = aPrendre.filter((a) => st.maison.includes(a.cle));
    const liste = aPrendre.filter((a) => !st.maison.includes(a.cle));
    const av = R.avancement(aPrendre, st);
    const visibles = filtreC.masquerPris ? liste.filter((a) => !st.coches.includes(a.cle)) : liste;
    const groupes = R.parRayon(visibles, E.ordreRayons);
    const nbRepas = repas.filter((x) => x.recette).length;
    const tete = `<div class="vue-tete"><div><h1>Courses</h1><p>${nbRepas ? `Les ingrédients de ${pluriel(nbRepas, 'plat planifié', 'plats planifiés')}, additionnés pour le bon nombre de personnes et rangés dans l'ordre de ton magasin.` : 'Planifie des repas : leurs ingrédients s\'ajoutent ici, additionnés et rangés par rayon.'}</p></div>
      <div class="actions"><button class="btn" data-action="partager">Partager la liste</button><button class="btn" data-action="ordre-rayons">Ordre des rayons</button></div></div>${navSemaine()}`;
    const formAjout = `<form class="ajout-article" id="form-article" autocomplete="off"><label class="champ"><span class="sr-only">Ajouter un article</span><input id="nouvel-article" placeholder="Ajouter un article : 2 baguettes, lessive…" maxlength="60" list="liste-courants"></label><button class="btn primaire" type="submit">${ICONES.plus}<span>Ajouter</span></button></form>
      <datalist id="liste-courants">${B.courants.map(([n]) => `<option value="${esc(n)}">`).join('')}</datalist>`;
    if (!aPrendre.length && !placard.length) return `${tete}${formAjout}<div class="vide-etat">${FORME_VIDE}<div><h3>Liste vide</h3><p>Planifie des repas pour cette semaine, ou ajoute des articles à la main ci-dessus.</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="semaine">Planifier la semaine</button></div></div></div>`;
    return `${tete}
      <div class="bilan-courses">
        <div class="bc-progres"><b>${av.pris}<small>/${av.total}</small></b><span class="progres" role="img" aria-label="${av.pct} % dans le chariot"><span style="width:${av.pct}%"></span></span><span>${av.reste ? `${pluriel(av.reste, 'article')} à prendre` : av.total ? 'Tout est dans le chariot' : ''}${maison.length ? ` · ${maison.length} déjà à la maison` : ''}</span></div>
        <div class="bc-actions"><label class="case bascule"><input type="checkbox" data-action="masquer-pris" ${filtreC.masquerPris ? 'checked' : ''}> Masquer ce qui est pris</label>${st.coches.length ? '<button class="btn petit" data-action="tout-decocher">Tout décocher</button>' : ''}</div>
      </div>
      ${formAjout}
      ${groupes.length ? groupes.map((g) => `<section class="rayon"><h2 class="titre-rayon">${esc(nomRayon(g.rayon))}<span>${g.articles.filter((a) => !st.coches.includes(a.cle)).length || '✓'}</span></h2><ul class="articles">${g.articles.map((a) => ligneArticle(a, st)).join('')}</ul></section>`).join('') : `<div class="vide-etat petit"><div><h3>${liste.length ? 'Tout est pris' : 'Rien à acheter'}</h3><p>${liste.length ? 'Décoche « Masquer ce qui est pris » pour revoir la liste.' : 'Tout est déjà à la maison.'}</p></div></div>`}
      ${placard.length ? `<details class="plus-tard placard"><summary>À vérifier dans le placard <small>${pluriel(placard.length, 'ingrédient')} · coche ce qui manque</small></summary><ul class="articles">${placard.map((a) => `<li class="article"><label class="article-case"><input type="checkbox" data-action="placard" data-cle="${esc(a.cle)}" ${st.placard.includes(a.cle) ? 'checked' : ''}><span class="coche" aria-hidden="true">${ICONES.coche}</span><span class="article-texte"><b>${esc(a.nom)}</b>${a.texte ? `<strong>${esc(a.texte)}</strong>` : ''}<small>${st.placard.includes(a.cle) ? 'ajouté à la liste' : 'pour ' + esc(a.sources.slice(0, 2).join(', '))}</small></span></label></li>`).join('')}</ul></details>` : ''}
      ${maison.length ? `<details class="plus-tard"><summary>Déjà à la maison <small>${pluriel(maison.length, 'article')}</small></summary><ul class="articles">${maison.map((a) => `<li class="article maison"><span class="article-texte"><b>${esc(a.nom)}</b>${a.texte ? `<strong>${esc(a.texte)}</strong>` : ''}</span><button class="btn petit" data-action="remettre" data-cle="${esc(a.cle)}">Remettre</button></li>`).join('')}</ul></details>` : ''}
      <p class="mention" style="margin-top:16px">Quantités arrondies à l'achat (pièces entières, grammes au-dessus) ; conditionnements indicatifs. La liste se recalcule à chaque repas ajouté ; les articles déjà cochés le restent.</p>`;
  }

  // ---------- Recettes ----------
  function carteRecette(r, P, RP) {
    const fav = E.favoris.includes(r.id);
    return `<li class="carte-recette cat-${r.cat}">
      <button class="cr-corps" data-action="recette" data-id="${esc(r.id)}"><span class="cr-cat">${esc(nomCat(r.cat))} · ${minutes(R.tempsTotal(r))}</span><b>${esc(r.nom)}</b><span class="cr-etiquettes">${etiquettesRecette(r, P)}</span></button>
      <div class="cr-pied"><button class="btn-icone petit fav ${fav ? 'actif' : ''}" data-action="favori" data-id="${esc(r.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${esc(r.nom)}">${ICONES.etoile}</button><button class="btn petit" data-action="planifier" data-id="${esc(r.id)}">${ICONES.plus}Planifier</button></div>
    </li>`;
  }

  function vueRecettes() {
    const P = catalogue(); const RP = recettesParId();
    const toutes = toutesRecettes();
    const f = { ...filtreR, saison: filtreR.saison ? saison() : null };
    const liste = R.filtrerRecettes(toutes, f, P, { favoris: E.favoris });
    const bascules = [['vegetarien', 'Végétarien'], ['sansPorc', 'Sans porc'], ['rapide', '30 min max'], ['saison', `De saison (${nomSaison(saison()).toLowerCase()})`], ['favoris', 'Favoris'], ['perso', 'Mes recettes']];
    return `
      <div class="vue-tete"><div><h1>Recettes</h1><p>${B.recettes.length} recettes familiales simples, rédigées pour ce template, et les tiennes. Les quantités se recalculent pour le nombre de personnes choisi.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-recette">${ICONES.plus}Ma recette</button></div></div>
      <form class="cherche" role="search" onsubmit="return false"><label class="champ"><span class="sr-only">Chercher une recette ou un ingrédient</span><input id="recherche" type="search" placeholder="Chercher : poireaux, gratin, lentilles…" value="${esc(filtreR.q)}" autocomplete="off"></label></form>
      <div class="filtres" role="group" aria-label="Catégorie">${[['toutes', 'Toutes'], ...B.categories.map((c) => [c.id, c.nom])].map(([id, lib]) => `<button class="filtre" data-action="filtre-cat" data-cat="${id}" aria-pressed="${filtreR.cat === id}">${esc(lib)} <small>${id === 'toutes' ? toutes.length : toutes.filter((r) => r.cat === id).length}</small></button>`).join('')}</div>
      <div class="filtres filtres-bascules" role="group" aria-label="Filtres">${bascules.map(([id, lib]) => `<button class="filtre" data-action="filtre-bascule" data-filtre="${id}" aria-pressed="${Boolean(filtreR[id])}">${esc(lib)}</button>`).join('')}</div>
      <h2 class="titre-section">${liste.length ? pluriel(liste.length, 'recette') : 'Aucune recette'} <span>${filtreR.q ? `« ${esc(filtreR.q)} »` : ''}</span></h2>
      ${liste.length ? `<ul class="grille-recettes">${liste.map((r) => carteRecette(r, P, RP)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Rien ne correspond</h3><p>${filtreR.perso && !E.recettes.length ? 'Tu n\'as pas encore de recette à toi : ajoute-la, ou crée ta version d\'une recette de la base.' : 'Retire un filtre, ou cherche un autre mot (un ingrédient marche aussi).'}</p><div class="actions"><button class="btn primaire" data-action="nouvelle-recette">${ICONES.plus}Ma recette</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Avec ce qu'il me reste ----------
  const RESTES_COURANTS = ['oeuf', 'pomme-de-terre', 'oignon', 'carotte', 'courgette', 'tomate', 'poireau', 'riz', 'pates', 'jambon', 'gruyere', 'creme-liquide', 'lait', 'filet-poulet', 'lardons', 'champignon', 'epinard', 'lentilles', 'pois-chiches', 'feta', 'chevre', 'pain-mie'];

  function vueRestes() {
    const P = catalogue();
    const res = R.avecCeQuiReste(toutesRecettes(), E.frigo, P, { maxManque });
    const nom = (id) => P.get(id)?.nom || id;
    const suggestions = RESTES_COURANTS.filter((id) => !E.frigo.includes(id) && P.get(id));
    return `
      <div class="vue-tete"><div><h1>Avec ce qu'il me reste</h1><p>Note ce qu'il reste au frigo et dans les placards : les recettes qui l'utilisent remontent, avec ce qu'il manque. Sel, huile et épices ne comptent pas.</p></div>
        ${E.frigo.length ? '<div class="actions"><button class="btn" data-action="vider-frigo">Tout retirer</button></div>' : ''}</div>
      <form class="ajout-article" id="form-frigo" autocomplete="off"><label class="champ"><span class="sr-only">Ingrédient qu'il te reste</span><input id="nouvel-ingredient" placeholder="Un ingrédient : œufs, courgette, riz…" maxlength="60" list="liste-ingredients"></label><button class="btn primaire" type="submit">${ICONES.plus}<span>Ajouter</span></button></form>
      <datalist id="liste-ingredients">${[...P.values()].filter((i) => !i.placard).map((i) => `<option value="${esc(i.nom)}">`).join('')}</datalist>
      ${E.frigo.length ? `<ul class="puces-frigo" aria-label="Ce qu'il te reste">${E.frigo.map((id) => `<li><span>${esc(nom(id))}</span><button data-action="retirer-frigo" data-id="${esc(id)}" aria-label="Retirer : ${esc(nom(id))}">×</button></li>`).join('')}</ul>` : ''}
      ${suggestions.length ? `<div class="suggestions-frigo"><p class="surtitre">En un geste</p><div class="filtres">${suggestions.slice(0, 14).map((id) => `<button class="filtre" data-action="ajout-frigo" data-id="${esc(id)}">+ ${esc(nom(id))}</button>`).join('')}</div></div>` : ''}
      <div class="outils-liste"><h2 class="titre-section" style="margin:24px 0 0">${E.frigo.length ? (res.length ? pluriel(res.length, 'recette') : 'Aucune recette') : 'Tes recettes possibles'}</h2>
        <div class="filtres" role="group" aria-label="Ingrédients manquants au plus">${[0, 1, 2, 3].map((n) => `<button class="filtre" data-action="max-manque" data-n="${n}" aria-pressed="${maxManque === n}">${n === 0 ? 'Rien à acheter' : `${n} manquant${n > 1 ? 's' : ''} max`}</button>`).join('')}</div></div>
      ${!E.frigo.length ? `<div class="vide-etat">${FORME_VIDE}<div><h3>Qu'y a-t-il dans le frigo ?</h3><p>Ajoute deux ou trois ingrédients à finir : les recettes qui les utilisent s'affichent ici, les plus faciles d'abord.</p></div></div>`
        : res.length ? `<ul class="resultats-restes">${res.slice(0, 30).map((x) => `<li class="reste-carte">
          <button class="lien-ligne" data-action="recette" data-id="${esc(x.recette.id)}"><b>${esc(x.recette.nom)}</b><span>${esc(nomCat(x.recette.cat))} · ${minutes(R.tempsTotal(x.recette))}</span></button>
          <span class="progres" role="img" aria-label="${x.pct} % des ingrédients déjà là"><span style="width:${x.pct}%"></span></span>
          <p class="reste-ont"><b>Tu as</b> ${x.ont.map((id) => esc(nom(id))).join(', ')}</p>
          <p class="reste-manque">${x.manque.length ? `<b>Il manque</b> ${x.manque.map((id) => esc(nom(id))).join(', ')}` : '<b>Rien ne manque</b>'}</p>
          <div class="rang"><button class="btn petit primaire" data-action="planifier" data-id="${esc(x.recette.id)}">${ICONES.plus}Planifier</button></div>
        </li>`).join('')}</ul>`
        : `<div class="vide-etat petit"><div><h3>Rien avec si peu de manquants</h3><p>Autorise un ingrédient manquant de plus, ou ajoute ce qu'il te reste d'autre.</p></div></div>`}
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

  const stepper = (nom, v, lib) => `<div class="stepper-champ"><span>${lib}</span><span class="stepper"><button type="button" class="btn-icone petit" data-action="pas" data-cible="${nom}" data-pas="-1" aria-label="Une personne de moins">−</button><input type="number" name="${nom}" min="1" max="30" step="1" inputmode="numeric" value="${v}" aria-label="${esc(lib)}"><button type="button" class="btn-icone petit" data-action="pas" data-cible="${nom}" data-pas="1" aria-label="Une personne de plus">+</button></span></div>`;

  // Choisir un repas pour un créneau (ou changer celui d'un repas existant).
  function modaleChoix(date, moment, remplace = null) {
    const P = catalogue();
    const ancien = remplace ? E.repas.find((x) => x.id === remplace) : null;
    const etat = { q: '', fav: false, vege: E.regimes.includes('vegetarien'), saison: false };
    const liste = () => {
      const f = { q: etat.q, favoris: etat.fav, vegetarien: etat.vege, sansPorc: E.regimes.includes('sans-porc'), saison: etat.saison ? saison() : null };
      const r = R.filtrerRecettes(toutesRecettes(), f, P, { favoris: E.favoris });
      const tri = [...r].sort((a, b) => Number(E.favoris.includes(b.id)) - Number(E.favoris.includes(a.id)));
      return tri.length ? tri.map((x) => `<li><button type="button" class="choix-recette" data-action="choisir-recette" data-id="${esc(x.id)}"><b>${E.favoris.includes(x.id) ? '<span class="etoile" aria-label="favori">★</span> ' : ''}${esc(x.nom)}</b><span>${esc(nomCat(x.cat))} · ${minutes(R.tempsTotal(x))}${R.regimes(x, P).vegetarien ? ' · végé' : ''}</span></button></li>`).join('') : '<li class="aide">Aucune recette ne correspond.</li>';
    };
    const corps = `
      <p class="aide">${esc(dateLongue(date))}, ${R.LIB_MOMENT[moment].toLowerCase()}.${ancien ? ' Le repas actuel sera remplacé.' : ''}</p>
      ${stepper('personnes', ancien?.personnes || E.personnes, 'Personnes à table')}
      <label class="champ"><span class="sr-only">Chercher une recette</span><input type="search" id="cherche-choix" placeholder="Chercher une recette ou un ingrédient" autocomplete="off"></label>
      <div class="filtres" role="group" aria-label="Filtres">${[['fav', 'Favoris'], ['saison', 'De saison'], ['vege', 'Végé']].map(([k, l]) => `<button type="button" class="filtre" data-action="choix-filtre" data-k="${k}" aria-pressed="${etat[k]}">${l}</button>`).join('')}</div>
      <ul class="liste-choix" id="liste-choix">${liste()}</ul>
      <fieldset class="champ"><legend>Ou sans recette <small>Aucune course pour ce repas.</small></legend><div class="puces-libres">${B.libres.map((t) => `<button type="button" class="filtre" data-action="choisir-libre" data-texte="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <div class="rang-champs"><label class="champ"><span class="sr-only">Texte libre</span><input name="texte" maxlength="60" placeholder="Autre : chez les grands-parents…"></label><button type="button" class="btn" data-action="choisir-libre">Ajouter</button></div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(ancien ? 'Changer le repas' : 'Ajouter un repas', corps, '<button class="btn" value="annuler">Fermer</button>');
    const d = modale();
    d.dataset.date = date; d.dataset.moment = moment; d.dataset.remplace = remplace || '';
    d._etatChoix = etat; d._listeChoix = liste;
    if (!estTel()) $('#cherche-choix', d).focus();
    $('#cherche-choix', d).addEventListener('input', (e) => { etat.q = e.target.value; $('#liste-choix', d).innerHTML = liste(); });
  }

  function choisir({ recette = null, texte = '' }) {
    const d = modale();
    const date = d.dataset.date; const moment = d.dataset.moment; const remplace = d.dataset.remplace;
    const personnes = Math.max(1, Math.min(30, Math.round(Number(d.querySelector('[name=personnes]')?.value)) || E.personnes));
    if (!recette && !texte.trim()) { d.querySelector('.erreur').textContent = 'Écris un texte, par exemple « Restes ».'; return; }
    retenir();
    const x = R.normaliserRepas({ id: remplace || uid(), date, moment, recette, texte: recette ? '' : texte, personnes });
    if (remplace) E.repas = E.repas.map((y) => (y.id === remplace ? x : y)); else E.repas.push(x);
    d.close();
    if (R.lundi(date) !== semaine && vue === 'semaine') semaine = R.lundi(date);
    sauver(); rendre();
    const nom = recette ? recettesParId().get(recette)?.nom : texte;
    toast(`${nom} : ${dateLongue(date)}, ${R.LIB_MOMENT[moment].toLowerCase()}${recette ? `, pour ${personnes}` : ''}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleRepas(id) {
    const x = E.repas.find((y) => y.id === id);
    if (!x) return;
    const r = x.recette ? recettesParId().get(x.recette) : null;
    const jours = R.joursSemaine(R.lundi(x.date));
    const corps = `
      ${r ? `<p class="aide"><b>${esc(r.nom)}</b> · ${esc(nomCat(r.cat))} · ${minutes(R.tempsTotal(r))} <button type="button" class="btn lien" data-action="recette" data-id="${esc(r.id)}">Voir la recette</button></p>` : `<label class="champ">Texte<input name="texte" maxlength="60" value="${esc(x.texte)}"></label>`}
      <div class="rang-champs">
        <label class="champ">Jour<select name="date">${jours.map((d, k) => `<option value="${d}" ${d === x.date ? 'selected' : ''}>${R.JOURS[k]} ${versDate(d).getDate()}</option>`).join('')}</select></label>
        <label class="champ">Moment<select name="moment">${R.MOMENTS.map((m) => `<option value="${m}" ${m === x.moment ? 'selected' : ''}>${R.LIB_MOMENT[m]}</option>`).join('')}</select></label>
      </div>
      ${r ? stepper('personnes', x.personnes, 'Personnes à table') : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Repas' : 'Repas sans recette', corps,
      `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="remplacer">Remplacer</button><button class="btn danger gauche" value="supprimer">Retirer</button>`, (f, action) => {
        if (action === 'supprimer') { retenir(); E.repas = E.repas.filter((y) => y.id !== id); sauver(); rendre(); toast('Repas retiré : la liste de courses suit.', { libelle: 'Annuler', faire: annuler }); return; }
        if (action === 'remplacer') { modale().dataset.garder = '1'; setTimeout(() => modaleChoix(x.date, x.moment, id), 0); return; }
        if (!r && !String(f.get('texte') || '').trim()) return 'Écris un texte, ou retire le repas.';
        retenir();
        Object.assign(x, R.normaliserRepas({ ...x, date: f.get('date'), moment: f.get('moment'), personnes: r ? f.get('personnes') : x.personnes, texte: r ? '' : f.get('texte') }));
        sauver(); rendre(); toast('Repas enregistré.', { libelle: 'Annuler', faire: annuler });
      });
  }

  function modaleProposer() {
    const vides = R.creneauxVides(E.repas, semaine);
    const corps = `
      <p>Des recettes de saison pour les créneaux vides de la ${titreSemaine(semaine).toLowerCase()}, jamais deux fois la même, en évitant celles des deux dernières semaines. Les soirs du lundi au vendredi, 40 minutes au plus.${E.regimes.length ? ` Régimes respectés : ${E.regimes.map((g) => B.regimes.find((x) => x.id === g).nom.toLowerCase()).join(', ')}.` : ''}</p>
      <fieldset class="champ"><legend>Quels repas ?</legend><div class="choix-liste">
        <label class="choix-ligne"><input type="checkbox" name="moment" value="soir" checked><span>Les soirs</span></label>
        <label class="choix-ligne"><input type="checkbox" name="moment" value="midi"><span>Les midis</span></label>
      </div></fieldset>
      <fieldset class="champ"><legend>Quels jours ?</legend><div class="choix-statut">${[['tous', 'Tous'], ['semaine', 'Lun. → ven.'], ['weekend', 'Week-end']].map(([v, l], k) => `<label><input type="radio" name="jours" value="${v}" ${k === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <label class="case"><input type="checkbox" name="futurs" checked> Seulement à partir d'aujourd'hui</label>
      <p class="aide">${pluriel(vides.length, 'créneau vide', 'créneaux vides')} cette semaine. Les repas déjà choisis ne bougent pas.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Proposer des repas', corps, '<button class="btn primaire" value="ok">Proposer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const moments = f.getAll('moment');
      if (!moments.length) return 'Coche les soirs, les midis, ou les deux.';
      const jours = { tous: [0, 1, 2, 3, 4, 5, 6], semaine: [0, 1, 2, 3, 4], weekend: [5, 6] }[f.get('jours')];
      let creneaux = R.creneauxVides(E.repas, semaine, R.MOMENTS.filter((m) => moments.includes(m)), jours);
      if (f.get('futurs') === 'on') creneaux = creneaux.filter((c) => c.date >= auj());
      if (!creneaux.length) return 'Aucun créneau vide avec ces choix.';
      const recentes = E.repas.filter((x) => x.recette && x.date >= ajout(semaine, -14) && x.date <= ajout(semaine, 6)).map((x) => x.recette);
      const props = R.proposer(toutesRecettes(), creneaux, catalogue(), { saison: R.saisonDe(semaine), regimes: E.regimes, recentes, favoris: E.favoris, graine: `${semaine}-${Date.now()}` });
      retenir();
      for (const p of props) E.repas.push(R.normaliserRepas({ ...p, id: uid(), personnes: E.personnes }));
      sauver(); rendre();
      toast(`${pluriel(props.length, 'repas proposé', 'repas proposés')}. Touche un repas pour le changer.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function copierSemaine() {
    const ajoutes = R.copierSemaine(E.repas, ajout(semaine, -7), semaine);
    if (!ajoutes.length) { toast('Rien à reprendre : la semaine dernière est vide ou les créneaux sont déjà pris.'); return; }
    retenir();
    E.repas.push(...ajoutes);
    sauver(); rendre();
    toast(`${pluriel(ajoutes.length, 'repas repris', 'repas repris')} de la semaine dernière.`, { libelle: 'Annuler', faire: annuler });
  }

  // Fiche d'une recette, avec les quantités pour n personnes.
  function modaleRecette(id, personnes = E.personnes) {
    const RP = recettesParId(); const P = catalogue();
    const r = RP.get(id);
    if (!r) return;
    const fav = E.favoris.includes(r.id);
    const ingredients = () => {
      const n = Math.max(1, Math.min(30, Math.round(Number(modale().querySelector('[name=personnes]')?.value)) || personnes));
      return R.quantitesPour(r, n, P).map((q) => `<li><span>${esc(q.ing.nom)}</span><b>${esc(q.texte)}</b></li>`).join('');
    };
    const saisons = String(r.saisons || '').trim() ? r.saisons.split(' ').map(nomSaison).join(', ') : 'Toute l\'année';
    const corps = `
      <p class="fiche-meta"><span>${esc(nomCat(r.cat))}</span><span>Préparation ${minutes(r.prep)}</span>${r.cuisson ? `<span>Cuisson ${minutes(r.cuisson)}</span>` : ''}<span>${esc(saisons)}</span></p>
      <p class="cr-etiquettes">${etiquettesRecette(r, P)}</p>
      ${stepper('personnes', personnes, 'Pour')}
      <h3 class="titre-fiche">Ingrédients</h3>
      <ul class="liste-ingredients" id="fiche-ingredients"></ul>
      <h3 class="titre-fiche">Étapes</h3>
      ${r.etapes.length ? `<ol class="etapes-recette">${r.etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>` : '<p class="aide">Aucune étape notée.</p>'}
      ${r.note ? `<p class="aide">${esc(r.note)}</p>` : ''}
      ${r.origine && RP.get(r.origine) ? `<p class="mention">Ta version de « ${esc(RP.get(r.origine).nom)} ».</p>` : ''}`;
    ouvrirModale(esc(r.nom), corps,
      `<button class="btn primaire" value="planifier">Planifier</button><button class="btn" value="favori">${fav ? 'Retirer des favoris' : 'Favori'}</button><button class="btn gauche" value="modifier">${r.perso ? 'Modifier' : 'Créer ma version'}</button>`, (f, action) => {
        const n = Math.max(1, Math.min(30, Math.round(Number(f.get('personnes'))) || E.personnes));
        if (action === 'favori') { modale().dataset.garder = '1'; basculerFavori(r.id); return; }
        if (action === 'modifier') { modale().dataset.garder = '1'; setTimeout(() => modaleEditionRecette(r.perso ? r.id : null, r.perso ? null : r), 0); return; }
        if (action === 'planifier') { modale().dataset.garder = '1'; setTimeout(() => modalePlanifier(r.id, n), 0); }
      });
    const d = modale();
    d.dataset.recette = r.id;
    const maj = () => { $('#fiche-ingredients', d).innerHTML = ingredients(); };
    maj();
    d.querySelector('[name=personnes]').addEventListener('input', maj);
    d._majFiche = maj;
  }

  // Choisir le créneau d'une recette (depuis la bibliothèque ou « avec ce qu'il me reste »).
  function modalePlanifier(id, personnes = E.personnes) {
    const r = recettesParId().get(id);
    if (!r) return;
    const t = auj();
    const debut = semaine >= R.lundi(t) ? semaine : R.lundi(t);
    const dates = [...R.joursSemaine(debut), ...R.joursSemaine(ajout(debut, 7))].filter((d) => d >= t);
    const premierVide = dates.flatMap((d) => R.MOMENTS.map((m) => ({ d, m }))).find(({ d, m }) => !R.repasDuJour(E.repas, d, m).length && (m === 'soir' || R.indiceJour(d) >= 5));
    const corps = `
      <p class="aide"><b>${esc(r.nom)}</b></p>
      <div class="rang-champs">
        <label class="champ">Jour<select name="date">${dates.map((d) => `<option value="${d}" ${d === premierVide?.d ? 'selected' : ''}>${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'short' }))}${R.repasDuJour(E.repas, d, 'midi').length && R.repasDuJour(E.repas, d, 'soir').length ? ' · complet' : ''}</option>`).join('')}</select></label>
        <label class="champ">Moment<select name="moment">${R.MOMENTS.map((m) => `<option value="${m}" ${m === (premierVide?.m || 'soir') ? 'selected' : ''}>${R.LIB_MOMENT[m]}</option>`).join('')}</select></label>
      </div>
      ${stepper('personnes', personnes, 'Personnes à table')}
      <p class="aide">Si le créneau a déjà un repas, celui-ci s'y ajoute (plat et dessert, par exemple).</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Planifier', corps, '<button class="btn primaire" value="ok">Planifier</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = f.get('date'); const moment = f.get('moment');
      if (!R.estDate(date)) return 'Choisis un jour.';
      retenir();
      E.repas.push(R.normaliserRepas({ id: uid(), date, moment, recette: id, personnes: f.get('personnes') }));
      sauver(); rendre();
      toast(`${r.nom} : ${dateLongue(date)}, ${R.LIB_MOMENT[moment].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function basculerFavori(id) {
    const r = recettesParId().get(id);
    if (!r) return;
    retenir();
    const fav = E.favoris.includes(id);
    E.favoris = fav ? E.favoris.filter((x) => x !== id) : [...E.favoris, id];
    sauver(); rendre();
    if (modale().open && modale().dataset.recette === id) { const b = modale().querySelector('button[value=favori]'); if (b) b.textContent = fav ? 'Favori' : 'Retirer des favoris'; }
    toast(fav ? `« ${r.nom} » retiré des favoris.` : `« ${r.nom} » ajouté aux favoris.`, { libelle: 'Annuler', faire: annuler });
  }

  // Création ou modification d'une recette perso. modele : recette de la base dont on crée sa version.
  function modaleEditionRecette(id, modele = null) {
    const P = catalogue();
    const r = id ? E.recettes.find((x) => x.id === id) : null;
    const v = r || (modele ? { ...modele, nom: `${modele.nom} (ma version)`, origine: modele.id } : { nom: '', cat: 'plat', prep: 15, cuisson: 20, saisons: '', portions: E.personnes, ingredients: [], etapes: [], note: '' });
    const texteIngr = v.ingredients.map((l) => R.ligneEnTexte(l, P)).join('\n');
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(v.nom)}" placeholder="Ex. : Gratin du dimanche"></label>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="cat">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.cat ? 'selected' : ''}>${esc(c.court)}</option>`).join('')}</select></label>
        <label class="champ">Pour (personnes)<input type="number" name="portions" min="1" max="30" step="1" inputmode="numeric" value="${v.portions || 4}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Préparation (min)<input type="number" name="prep" min="0" max="600" step="5" inputmode="numeric" value="${v.prep || 0}"></label>
        <label class="champ">Cuisson (min)<input type="number" name="cuisson" min="0" max="600" step="5" inputmode="numeric" value="${v.cuisson || 0}"></label>
      </div>
      <fieldset class="champ"><legend>Saisons <small>Aucune cochée : toute l'année.</small></legend><div class="cases-ligne">${B.saisons.map((s) => `<label class="case"><input type="checkbox" name="saisons" value="${s.id}" ${String(v.saisons || '').split(' ').includes(s.id) ? 'checked' : ''}> ${esc(s.nom)}</label>`).join('')}</div></fieldset>
      <label class="champ">Ingrédients<small>Un par ligne, quantité d'abord : « 200 g de farine », « 2 oignons », « 3 c. à soupe d'huile d'olive », « sel ».</small><textarea name="ingredients" rows="8" spellcheck="false">${esc(texteIngr)}</textarea></label>
      <ul class="apercu-ingredients" id="apercu-ingredients" aria-live="polite"></ul>
      <label class="champ">Étapes<small>Une par ligne.</small><textarea name="etapes" rows="5">${esc(v.etapes.join('\n'))}</textarea></label>
      <label class="champ">Note<small>Facultative.</small><input name="note" maxlength="300" value="${esc(v.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Modifier ma recette' : modele ? 'Ma version' : 'Nouvelle recette', corps,
      `<button class="btn primaire" value="ok">${r ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${r ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, action) => {
        if (action === 'supprimer') {
          const n = E.repas.filter((x) => x.recette === r.id).length;
          if (n && !confirm(`« ${r.nom} » est planifiée ${n} fois. Les repas restent, sans courses. Supprimer ?`)) return 'Recette gardée.';
          retenir();
          E.recettes = E.recettes.filter((x) => x.id !== r.id);
          E.repas.forEach((x) => { if (x.recette === r.id) { x.recette = null; x.texte = r.nom; } });
          E.favoris = E.favoris.filter((x) => x !== r.id);
          sauver(); rendre(); toast(`« ${r.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler }); return;
        }
        const nom = String(f.get('nom') || '').trim();
        if (!nom) return 'Indique le nom de la recette.';
        const lues = lireIngredients(String(f.get('ingredients') || ''));
        if (!lues.lignes.length) return 'Ajoute au moins un ingrédient, un par ligne.';
        retenir();
        for (const n of lues.nouveaux) if (!E.ingredients.some((x) => x.id === n.id) && !B.ingredients.some((x) => x.id === n.id)) E.ingredients.push(R.normaliserIngredient(n, B.rayons.map((x) => x.id)));
        const donnees = R.normaliserRecette({ id: r?.id || `p-${uid()}`, nom, cat: f.get('cat'), portions: f.get('portions'), prep: f.get('prep'), cuisson: f.get('cuisson'), saisons: f.getAll('saisons').join(' '), ingredients: lues.lignes, etapes: String(f.get('etapes') || '').split('\n'), note: f.get('note'), origine: r?.origine || v.origine || null }, B.categories.map((c) => c.id));
        if (r) Object.assign(r, donnees); else E.recettes.push(donnees);
        sauver(); rendre();
        toast(r ? 'Recette enregistrée.' : `« ${nom} » ajoutée à tes recettes${lues.nouveaux.length ? ` (${pluriel(lues.nouveaux.length, 'nouvel ingrédient', 'nouveaux ingrédients')}, rayon « Autres » : change-le depuis la liste de courses)` : ''}.`, { libelle: 'Annuler', faire: annuler });
      });
    const d = modale();
    const zone = d.querySelector('[name=ingredients]');
    const apercu = () => {
      const lues = lireIngredients(zone.value);
      $('#apercu-ingredients', d).innerHTML = lues.details.map((x) => `<li class="${x.nouveau ? 'nouveau' : ''}"><span>${esc(x.texte)}</span><b>${x.nouveau ? 'nouvel ingrédient' : esc(x.nom)}</b></li>`).join('');
    };
    zone.addEventListener('input', apercu);
    apercu();
  }

  function lireIngredients(texte) {
    const P = catalogue();
    const cat = [...P.values()];
    const lignes = []; const nouveaux = []; const details = [];
    for (const brut of texte.split('\n')) {
      const lu = R.lireLigne(brut);
      if (!lu) continue;
      const res = R.ligneRecette(lu, [...cat, ...nouveaux]);
      if (!res) continue;
      if (res.nouveau) { nouveaux.push(res.nouveau); }
      lignes.push(res.ligne);
      const ing = P.get(res.ligne[0]) || nouveaux.find((n) => n.id === res.ligne[0]);
      details.push({ texte: brut.trim(), nom: ing?.nom || lu.nom, nouveau: Boolean(res.nouveau) });
    }
    return { lignes, nouveaux, details };
  }

  // Options d'un article de la liste : déjà à la maison, rayon, retrait.
  function modaleArticle(cle) {
    const { recettes, habituels, extras } = articlesSemaine();
    const a = [...recettes, ...habituels, ...extras].find((x) => x.cle === cle);
    if (!a) return;
    const st = etatCourses();
    const corps = `
      <p class="aide"><b>${esc(a.nom)}</b>${a.texte ? ` · ${esc(a.texte)}` : ''}${a.sources.length && !a.habituel ? `<br>Pour : ${esc(a.sources.join(', '))}` : ''}</p>
      ${a.extra ? `<label class="champ">Quantité<small>Facultative, en texte libre.</small><input name="qte" maxlength="30" value="${esc(a.texte)}"></label>` : ''}
      <label class="champ">Rayon<small>${a.extra ? '' : 'Retenu pour les semaines suivantes.'}</small><select name="rayon">${E.ordreRayons.map((id) => `<option value="${id}" ${id === a.rayon ? 'selected' : ''}>${esc(nomRayon(id))}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="maison">${st.maison.includes(cle) ? 'À acheter' : 'Déjà à la maison'}</button>${a.extra ? '<button class="btn danger gauche" value="supprimer">Retirer</button>' : a.habituel ? '<button class="btn danger gauche" value="supprimer">Plus chaque semaine</button>' : ''}`;
    ouvrirModale('Article', corps, pied, (f, action) => {
      retenir();
      if (action === 'maison') {
        st.maison = st.maison.includes(cle) ? st.maison.filter((x) => x !== cle) : [...st.maison, cle];
        st.coches = st.coches.filter((x) => x !== cle);
        sauver(); rendre(); toast(st.maison.includes(cle) ? `${a.nom} : déjà à la maison.` : `${a.nom} remis dans la liste.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      if (action === 'supprimer') {
        if (a.extra) st.extras = st.extras.filter((x) => x.id !== a.id);
        if (a.habituel) E.habituels = E.habituels.filter((x) => x.id !== a.id);
        st.coches = st.coches.filter((x) => x !== cle);
        sauver(); rendre(); toast(`${a.nom} retiré.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const rayon = f.get('rayon');
      if (a.extra) { const x = st.extras.find((y) => y.id === a.id); x.rayon = rayon; x.qte = String(f.get('qte') || '').trim().slice(0, 30); }
      else if (a.habituel) { const h = E.habituels.find((y) => y.id === a.id); if (h) h.rayon = rayon; }
      else E.rayonsPerso[a.id] = rayon;
      sauver(); rendre(); toast('Article enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function ajouterArticle(texte) {
    const lu = R.lireLigne(texte);
    if (!lu) return;
    const ing = R.trouverIngredient(lu.nom, [...catalogue().values()]);
    const courant = B.courants.find(([n]) => R.cleNom(n) === R.cleNom(lu.nom));
    const rayon = ing ? (E.rayonsPerso[ing.id] || ing.rayon) : courant ? courant[1] : 'au';
    const nom = lu.nom.charAt(0).toUpperCase() + lu.nom.slice(1);
    const qte = texte.trim().slice(0, texte.trim().length - lu.nom.length).trim();
    retenir();
    const st = etatCourses();
    st.extras.push({ id: uid(), nom, qte, rayon });
    sauver(); rendre();
    toast(`${nom} ajouté (${nomRayon(rayon)}).`, { libelle: 'Annuler', faire: annuler });
    const champ = $('#nouvel-article'); if (champ) champ.focus();
  }

  function modaleOrdreRayons() {
    const lignes = () => E.ordreRayons.map((id, k) => `<li class="ligne-rayon"><span>${k + 1}. ${esc(nomRayon(id))}</span><span class="rang"><button type="button" class="btn-icone petit" data-action="rayon-monter" data-id="${id}" aria-label="Monter : ${esc(nomRayon(id))}" ${k === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn-icone petit" data-action="rayon-descendre" data-id="${id}" aria-label="Descendre : ${esc(nomRayon(id))}" ${k === E.ordreRayons.length - 1 ? 'disabled' : ''}>↓</button></span></li>`).join('');
    ouvrirModale('Ordre des rayons', `<p class="aide">Range les rayons dans l'ordre où tu les parcours dans ton magasin : la liste suit cet ordre, tu ne reviens pas sur tes pas.</p><ul class="liste-rayons" id="liste-rayons">${lignes()}</ul>`, '<button class="btn primaire" value="ok">Terminé</button>');
    modale()._lignesRayons = lignes;
  }
  function deplacerRayon(id, sens) {
    const k = E.ordreRayons.indexOf(id); const j = k + sens;
    if (k < 0 || j < 0 || j >= E.ordreRayons.length) return;
    const o = [...E.ordreRayons]; [o[k], o[j]] = [o[j], o[k]]; E.ordreRayons = o;
    sauver(); rendre();
    const ul = $('#liste-rayons'); if (ul) { ul.innerHTML = modale()._lignesRayons(); ul.querySelector(`[data-id="${id}"][data-action="${sens < 0 ? 'rayon-monter' : 'rayon-descendre'}"]`)?.focus(); }
  }

  async function partagerListe() {
    const { recettes, habituels, extras } = articlesSemaine();
    const st = E.courses[semaine] || { coches: [], maison: [], placard: [] };
    const aPrendre = [...recettes.filter((a) => !a.placard || (st.placard || []).includes(a.cle)), ...habituels, ...extras];
    const groupes = R.parRayon(aPrendre, E.ordreRayons);
    const texte = R.texteListe(groupes, Object.fromEntries(B.rayons.map((r) => [r.id, r.nom])), st, `Courses · ${titreSemaine(semaine).toLowerCase()}`);
    if (navigator.share && estTel()) { try { await navigator.share({ title: 'Liste de courses', text: texte }); return; } catch { /* partage annulé : on propose la copie */ } }
    try { await navigator.clipboard.writeText(texte); toast('Liste copiée : colle-la dans un message.'); } catch {
      ouvrirModale('Liste de courses', `<p class="aide">Sélectionne le texte et copie-le.</p><textarea class="texte-copie" rows="14" readonly>${esc(texte)}</textarea>`, '<button class="btn primaire" value="ok">Fermer</button>');
    }
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ" style="max-width:260px">Personnes à table d'habitude<small>Valeur par défaut des nouveaux repas.</small><input type="number" name="personnes" min="1" max="30" step="1" inputmode="numeric" value="${E.personnes}"></label>
      <fieldset class="champ cadre-champs"><legend>Régimes du foyer <small>Respectés par les propositions et le choix d'un repas.</small></legend><div class="choix-liste">${caseRegimes(E.regimes)}</div></fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Magasin</h3><p class="aide">L'ordre des rayons de ta liste de courses suit ton parcours en magasin.</p><div class="rang"><button class="btn petit" type="button" data-action="ordre-rayons">Ordre des rayons</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes repas et tes recettes sont enregistrés en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="imprimer">Imprimer le menu et la liste</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, pratique au magasin pour cocher la liste.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Base intégrée version ${B.version}, rédigée pour QME : ${B.recettes.length} recettes familiales simples (aucune copiée d'un site ou d'un livre), ${B.ingredients.length} ingrédients rangés en ${B.rayons.length} rayons. Poids moyens d'une pièce : ordres de grandeur. Régimes calculés depuis les ingrédients : en cas d'allergie, vérifie les étiquettes. Aucun prix, aucune enseigne, aucun drive ni magasin n'est connecté.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = Math.round(Number(f.get('personnes')));
      if (!(n >= 1 && n <= 30)) return 'Indique un nombre de personnes entre 1 et 30.';
      retenir();
      E.personnes = n;
      E.regimes = f.getAll('regime');
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.repas) || !Array.isArray(d.recettes)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.repas.length, 'repas', 'repas')}, ${pluriel(d.recettes.length, 'recette perso', 'recettes perso')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de tes repas.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `repas-${auj()}.json`);

  // ---------- Impression : menu de la semaine et liste ----------
  function imprimer() {
    const RP = recettesParId();
    const { recettes, habituels, extras } = articlesSemaine();
    const st = E.courses[semaine] || { coches: [], maison: [], placard: [] };
    const aPrendre = [...recettes.filter((a) => !a.placard || (st.placard || []).includes(a.cle)), ...habituels, ...extras].filter((a) => !(st.maison || []).includes(a.cle));
    const repas = R.repasSemaine(E.repas, semaine);
    const nom = (x) => (x.recette ? RP.get(x.recette)?.nom || x.texte : x.texte);
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    el.innerHTML = `
      <header><p>Repas de la semaine</p><h1>${esc(titreSemaine(semaine))}</h1></header>
      <table><thead><tr><th>Jour</th><th>Midi</th><th>Soir</th></tr></thead><tbody>${R.joursSemaine(semaine).map((d, k) => `<tr><td><b>${R.JOURS[k]}</b> ${versDate(d).getDate()}</td>${R.MOMENTS.map((m) => `<td>${R.repasDuJour(repas, d, m).map((x) => esc(nom(x))).join('<br>') || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <h2>Liste de courses</h2>
      <div class="impr-colonnes">${R.parRayon(aPrendre, E.ordreRayons).map((g) => `<section><h3>${esc(nomRayon(g.rayon))}</h3><ul>${g.articles.map((a) => `<li>☐ ${esc(a.nom)}${a.texte ? ` · ${esc(a.texte)}` : ''}</li>`).join('')}</ul></section>`).join('')}</div>`;
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche'); });

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
  function cocher(cle, coche) {
    const st = etatCourses();
    st.coches = coche ? [...new Set([...st.coches, cle])] : st.coches.filter((x) => x !== cle);
    sauver();
    // Rendu léger : on garde la position de défilement au magasin.
    const y = window.scrollY; rendre(); window.scrollTo({ top: y });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); semaine = R.lundi(auj()); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'imprimer': imprimer(); break;
      case 'fermer': modale().close(); break;
      case 'semaine-prec': semaine = ajout(semaine, -7); rendre(); break;
      case 'semaine-suiv': semaine = ajout(semaine, 7); rendre(); break;
      case 'semaine-actuelle': semaine = R.lundi(auj()); rendre(); break;
      case 'ajouter-repas': modaleChoix(el.dataset.date, el.dataset.moment); break;
      case 'repas': modaleRepas(id); break;
      case 'choisir-recette': choisir({ recette: id }); break;
      case 'choisir-libre': choisir({ texte: el.dataset.texte || modale().querySelector('[name=texte]')?.value || '' }); break;
      case 'choix-filtre': { const d = modale(); const k = el.dataset.k; d._etatChoix[k] = !d._etatChoix[k]; el.setAttribute('aria-pressed', d._etatChoix[k]); $('#liste-choix', d).innerHTML = d._listeChoix(); break; }
      case 'proposer': modaleProposer(); break;
      case 'copier-semaine': copierSemaine(); break;
      case 'pas': { const c = modale().querySelector(`[name="${el.dataset.cible}"]`); if (c) { c.value = Math.max(1, Math.min(30, (Number(c.value) || 1) + Number(el.dataset.pas))); c.dispatchEvent(new Event('input')); } break; }
      case 'recette': if (modale().open) { modale().dataset.garder = ''; modale().close(); } modaleRecette(id); break;
      case 'planifier': modalePlanifier(id); break;
      case 'favori': basculerFavori(id); break;
      case 'nouvelle-recette': modaleEditionRecette(null); break;
      case 'filtre-cat': filtreR.cat = el.dataset.cat; rendre(); break;
      case 'filtre-bascule': filtreR[el.dataset.filtre] = !filtreR[el.dataset.filtre]; rendre(); break;
      case 'cocher': cocher(el.dataset.cle, el.checked); break;
      case 'placard': { retenir(); const st = etatCourses(); const c = el.dataset.cle; st.placard = el.checked ? [...new Set([...st.placard, c])] : st.placard.filter((x) => x !== c); sauver(); rendre(); break; }
      case 'article': modaleArticle(el.dataset.cle); break;
      case 'remettre': { retenir(); const st = etatCourses(); st.maison = st.maison.filter((x) => x !== el.dataset.cle); sauver(); rendre(); break; }
      case 'masquer-pris': filtreC.masquerPris = el.checked; rendre(); break;
      case 'tout-decocher': if (confirm('Décocher tous les articles de cette liste ?')) { retenir(); etatCourses().coches = []; sauver(); rendre(); toast('Liste décochée.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'partager': partagerListe(); break;
      case 'ordre-rayons': if (modale().open) modale().close(); modaleOrdreRayons(); break;
      case 'rayon-monter': deplacerRayon(id, -1); break;
      case 'rayon-descendre': deplacerRayon(id, 1); break;
      case 'ajout-frigo': if (!E.frigo.includes(id)) { E.frigo.push(id); sauver(); rendre(); } break;
      case 'retirer-frigo': E.frigo = E.frigo.filter((x) => x !== id); sauver(); rendre(); break;
      case 'vider-frigo': retenir(); E.frigo = []; sauver(); rendre(); toast('Liste du frigo vidée.', { libelle: 'Annuler', faire: annuler }); break;
      case 'max-manque': maxManque = Number(el.dataset.n); rendre(); break;
      default: break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'form-article') {
      e.preventDefault();
      const v = $('#nouvel-article').value.trim();
      if (v) ajouterArticle(v);
    } else if (e.target.id === 'form-frigo') {
      e.preventDefault();
      const v = $('#nouvel-ingredient').value.trim();
      if (!v) return;
      const ing = R.trouverIngredient(v, [...catalogue().values()]);
      if (!ing) { toast(`« ${v} » n'est pas dans la base : choisis un ingrédient de la liste proposée.`); return; }
      if (!E.frigo.includes(ing.id)) E.frigo.push(ing.id);
      sauver(); rendre();
      const n = $('#nouvel-ingredient'); if (n) n.focus();
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
  window.__repas = { etat: () => E, regles: R };
  init();
})();
