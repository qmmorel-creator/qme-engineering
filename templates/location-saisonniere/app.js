// Location saisonnière QME : calendrier d'occupation, réservations, ménage, taxe de séjour, revenus par canal.
// Données synchronisées par clé de licence ou code d'accès. Aucune plateforme connectée : tout se saisit.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.SJR;
  const API = '/api/templates';
  const PRODUIT = 'SJR';
  const CLE_CODE = 'qme-sjr-code';
  const CLE_CACHE = 'qme-sjr-cache';
  const CLE_DEMO = 'qme-sjr-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-sjr-ecran-accueil';
  const DEFAUTS = { reglages: B.reglages, canaux: B.canaux };

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
  const { ajout, versDate, euros, pct } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const nomMois = (m) => versDate(`${m.slice(0, 7)}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const moisCourt = (m) => versDate(`${m.slice(0, 7)}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const nuitsTxt = (n) => pluriel(n, 'nuit');
  const periode = (r) => `${dateCourte(r.arrivee)} → ${dateCourte(r.depart)}`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'jour';
  const filtre = { statut: 'aVenir', q: '' };
  let moisCal = R.debutMois(auj());
  let anneeRev = Number(auj().slice(0, 4));
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, auj(), DEFAUTS);
  const resa = (id) => E.reservations.find((r) => r.id === id);
  const logement = (id) => E.logements.find((l) => l.id === id);
  const canal = (id) => E.canaux.find((c) => c.id === id);
  const nomLogement = (id) => logement(id)?.nom || 'Logement supprimé';
  const nomCanal = (id) => canal(id)?.nom || 'Canal supprimé';
  const nomVoyageur = (r) => r.voyageur || 'Voyageur sans nom';

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
        toast('Un autre appareil a modifié tes réservations entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (SJR-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Trois logements fictifs, trois canaux (« Direct », « Plateforme A », « Plateforme B »), six mois
  // d'historique soldé, et autour d'aujourd'hui tous les états : séjour en cours, arrivée et départ du jour,
  // rotation le jour même, ménage en retard, solde non reçu, acompte attendu, option en conflit, annulation.
  // Les mois suivants restent vides. Tarifs de taxe de séjour inventés pour la démo.
  function donneesDemo() {
    const e = etatVide();
    e.activite = 'Les Tilleuls (exemple fictif)';
    e.reglages.taxeDefaut = 80;
    const t = auj();
    const j = (n) => ajout(t, n);
    const lg = (nom, capacite, menage, taxe) => { const l = R.normaliserLogement({ id: uid(), nom, capacite, menage, taxe }); e.logements.push(l); return l; };
    const studio = lg('Studio du Port', 2, 4000, 100);
    const gite = lg('Gîte des Tilleuls', 6, 7000, 88);
    const chambre = lg('Chambre d\'hôtes Bleue', 2, 2000, null);
    const A = R.normaliserCanal({ id: uid(), nom: 'Plateforme A', commission: 15, collecteTaxe: true });
    const Bc = R.normaliserCanal({ id: uid(), nom: 'Plateforme B', commission: 3 });
    e.canaux.push(A, Bc);
    const noms = ['Famille Exemple', 'Camille D.', 'Léo et Inès', 'M. Martin (fictif)', 'Groupe Randonnée', 'Sacha B.', 'Famille Durand (fictive)', 'Nora T.', 'Hugo et Lina', 'Jeanne P.', 'Thomas R.', 'Famille Petit (fictive)'];
    let k = 0;
    const ajouterResa = (l, arrivee, depart, extra = {}) => {
      const c = extra.canal || 'direct';
      const n = R.ecart(arrivee, depart);
      const prix = { [studio.id]: 7500, [gite.id]: 14000, [chambre.id]: 6500 }[l.id];
      const r = R.normaliserReservation({ id: uid(), logement: l.id, arrivee, depart, voyageur: noms[k++ % noms.length], adultes: 2, enfants: 0, canal: c, hebergement: prix * n, menage: l.menage, taxeParCanal: canal2(c)?.collecteTaxe, ...extra }, t);
      e.reservations.push(r);
      return r;
    };
    const canal2 = (id) => e.canaux.find((x) => x.id === id);
    const solder = (r, date) => { r.paiements = [{ id: uid(), date, montant: R.aRecevoir(r, e) }]; return r; };
    const acompte = (r, date) => { r.paiements = [{ id: uid(), date, montant: R.acompteAttendu(r, e), note: 'Acompte' }]; return r; };
    // Historique : séjours soldés et ménages faits, de -190 à -46 jours, plus remplis en été.
    const motif = [[3, 2, 'A'], [5, 4, 'direct'], [2, 1, 'B'], [6, 3, 'A'], [4, 5, 'direct'], [3, 2, 'A'], [7, 6, 'B']];
    [[studio, 0], [gite, 2], [chambre, 4]].forEach(([l, dec]) => {
      let d = -190 + dec * 3, i = dec;
      while (d < -50) {
        const [n, pause, cid] = motif[i % motif.length];
        if (d + n > -46) break;
        const r = ajouterResa(l, j(d), j(d + n), { canal: cid === 'A' ? A.id : cid === 'B' ? Bc.id : 'direct', adultes: l === gite ? 2 + (i % 3) : 2, enfants: l === gite ? i % 2 : 0, menageFait: j(d + n), taxeParCanal: cid === 'A' });
        solder(r, j(d + n));
        d += n + pause + (d > -120 && d < -80 ? 0 : 2);
        i++;
      }
    });
    // Autour d'aujourd'hui.
    solder(ajouterResa(studio, j(-40), j(-35), { canal: A.id, menageFait: j(-35) }), j(-35));
    solder(ajouterResa(studio, j(-12), j(-8), { canal: Bc.id, menageFait: j(-8) }), j(-12));
    solder(ajouterResa(studio, j(-3), j(2), { canal: A.id, voyageur: 'Camille D.' }), j(-3));
    acompte(ajouterResa(studio, j(2), j(6), { voyageur: 'Léo et Inès', note: 'Arrivée vers 18 h, rotation le jour même.' }), j(-20));
    solder(ajouterResa(studio, j(9), j(13), { canal: A.id, voyageur: 'Nora T.' }), j(-2));
    const g1 = ajouterResa(gite, j(-9), j(-2), { voyageur: 'Groupe Randonnée', adultes: 5, enfants: 0 });
    g1.paiements = [{ id: uid(), date: j(-30), montant: R.acompteAttendu(g1, e), note: 'Acompte' }, { id: uid(), date: j(-9), montant: 40000, note: 'Chèque, reste à percevoir' }];
    acompte(ajouterResa(gite, t, j(5), { voyageur: 'Famille Exemple', adultes: 2, enfants: 2, note: 'Lit bébé demandé.' }), j(-40));
    solder(ajouterResa(gite, j(8), j(15), { canal: A.id, voyageur: 'Famille Durand (fictive)', adultes: 4, enfants: 1 }), j(-15));
    ajouterResa(gite, j(11), j(14), { statut: 'option', voyageur: 'Hugo et Lina', note: 'Demande en attente de réponse.' });
    solder(ajouterResa(chambre, j(-1), t, { canal: Bc.id, voyageur: 'Sacha B.' }), j(-1));
    ajouterResa(chambre, j(3), j(5), { voyageur: 'Jeanne P.' });
    ajouterResa(chambre, j(-25), j(-22), { statut: 'annulee', voyageur: 'Thomas R.', note: 'Annulée par le voyageur.' });
    solder(ajouterResa(chambre, j(-6), j(-4), { canal: A.id, voyageur: 'Nora T.', menageFait: j(-4) }), j(-6));
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Location saisonnière · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <path d="M20 150 L120 50 L220 150 Z" fill="#D9302A"/>
          <rect x="40" y="150" width="160" height="130" fill="#1D4E89"/>
          <rect x="100" y="210" width="40" height="70" fill="#F5B400"/>
          <circle cx="330" cy="90" r="60" fill="#F5B400"/>
          <rect x="260" y="170" width="110" height="110" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="470" cy="190" r="90" fill="#F0EDE6"/>
          <path d="M470 190 L470 100 A90 90 0 0 1 560 190 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Location saisonnière</p>
          <h1>Tes logements, toujours prêts.</h1>
          <p>Le calendrier de tes meublés et chambres d'hôtes, chaque réservation avec son canal, le ménage entre deux séjours, la taxe de séjour et ce qui te reste, mois par mois.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton calendrier</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes réservations sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon calendrier</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/location-saisonniere/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon calendrier'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, activite: '', logements: [{ nom: '', capacite: 4, menage: '' }], canaux: [{ nom: '', commission: '', collecte: false }, { nom: '', commission: '', collecte: false }], taxe: '', acompte: B.reglages.acomptePct });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On range tes séjours.</h1>
        <p class="intro">Tu saisis tes réservations (dates, voyageurs, canal, montant) : le calendrier, le ménage entre deux séjours, la taxe de séjour et tes revenus nets se calculent. Aucune plateforme n'est connectée, rien n'est envoyé à ta place.</p>
        <label class="champ" style="max-width:420px;margin-top:20px">Nom de ton activité <small>Facultatif, par exemple le nom de ta maison.</small><input id="activite" value="${esc(a.activite)}" maxlength="80"></label>
        <h2 class="titre-section">Tes logements <span>De 1 à ${R.MAX_LOGEMENTS}. Tu pourras les modifier dans les Réglages.</span></h2>
        <ol class="logements-accueil">${a.logements.map((l, i) => `<li><span class="palier-num">${i + 1}</span>
          <label class="champ">Nom<input data-lg="${i}" data-k="nom" value="${esc(l.nom)}" maxlength="60" placeholder="Ex. : Studio du centre"></label>
          <label class="champ">Capacité<input type="number" min="1" max="30" data-lg="${i}" data-k="capacite" value="${esc(l.capacite)}"></label>
          <label class="champ">Ménage facturé (€)<input inputmode="decimal" data-lg="${i}" data-k="menage" value="${esc(l.menage)}" placeholder="0,00"></label></li>`).join('')}</ol>
        ${a.logements.length < R.MAX_LOGEMENTS ? '<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="accueil-logement">+ Ajouter un logement</button></div>' : ''}
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes canaux et ta taxe</h1>
        <p class="intro">« Direct » existe déjà. Nomme les autres canaux par lesquels tu reçois des réservations, avec leur commission : le net de chaque séjour se calcule. Tu peux en ajouter plus tard.</p>
        <ol class="logements-accueil canaux-accueil">${a.canaux.map((c, i) => `<li><span class="palier-num">${i + 1}</span>
          <label class="champ">Nom du canal<input data-cn="${i}" data-k="nom" value="${esc(c.nom)}" maxlength="40" placeholder="Ex. : Plateforme A"></label>
          <label class="champ">Commission (%)<input inputmode="decimal" data-cn="${i}" data-k="commission" value="${esc(c.commission)}" placeholder="0"></label>
          <label class="case"><input type="checkbox" data-cn="${i}" data-k="collecte" ${c.collecte ? 'checked' : ''}> Collecte la taxe de séjour</label></li>`).join('')}</ol>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Taxe de séjour par personne et par nuit (€) <small>Le tarif de ta commune ; vide si tu ne le connais pas encore. Aucun barème n'est intégré.</small><input id="taxe" inputmode="decimal" value="${esc(a.taxe)}" placeholder="À renseigner"></label>
          <label class="champ">Acompte à la réservation (%)<small>Le solde est attendu le jour de l'arrivée (réglable).</small><input id="acompte" inputmode="decimal" value="${esc(a.acompte)}"></label>
        </div>
        <p class="aide" style="max-width:720px;margin-top:16px">${esc(B.sourceTaxe)}</p>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon calendrier</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#activite')?.addEventListener('input', (e) => { accueil.activite = e.target.value; });
    $('#taxe')?.addEventListener('input', (e) => { accueil.taxe = e.target.value; });
    $('#acompte')?.addEventListener('input', (e) => { accueil.acompte = e.target.value; });
    document.querySelectorAll('[data-lg]').forEach((el) => el.addEventListener('input', () => { accueil.logements[Number(el.dataset.lg)][el.dataset.k] = el.value; }));
    document.querySelectorAll('[data-cn]').forEach((el) => el.addEventListener('input', () => { accueil.canaux[Number(el.dataset.cn)][el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; }));
  }

  function erreurAccueil(m) { const p = $('#erreur-accueil'); if (p) p.textContent = m; }
  function accueilSuivant() {
    const remplis = accueil.logements.filter((l) => l.nom.trim());
    if (!remplis.length) return erreurAccueil('Donne un nom à au moins un logement.');
    if (remplis.some((l) => String(l.menage).trim() && R.lireMontant(l.menage) === null)) return erreurAccueil('Frais de ménage illisibles : écris par exemple 45,00.');
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    const taxe = String(accueil.taxe).trim() ? R.lireMontant(accueil.taxe) : null;
    if (String(accueil.taxe).trim() && taxe === null) return erreurAccueil('Tarif de taxe illisible : écris par exemple 1,00.');
    const ac = R.lirePct(accueil.acompte);
    if (ac === null) return erreurAccueil('Acompte illisible : écris un pourcentage, par exemple 30.');
    const canaux = accueil.canaux.filter((c) => c.nom.trim());
    if (canaux.some((c) => String(c.commission).trim() && R.lirePct(c.commission) === null)) return erreurAccueil('Commission illisible : écris un pourcentage, par exemple 15.');
    E = etatVide();
    E.activite = accueil.activite.trim();
    E.reglages.taxeDefaut = taxe;
    E.reglages.acomptePct = ac;
    E.logements = accueil.logements.filter((l) => l.nom.trim()).map((l, i) => R.normaliserLogement({ id: uid(), nom: l.nom.trim(), capacite: l.capacite, menage: R.lireMontant(l.menage) ?? 0 }, i));
    canaux.forEach((c) => E.canaux.push(R.normaliserCanal({ id: uid(), nom: c.nom.trim(), commission: R.lirePct(c.commission) ?? 0, collecteTaxe: c.collecte })));
    accueil = accueilVide();
    vue = 'jour';
    sauver();
    demarrer();
    toast('Ton calendrier est prêt. Ajoute ta première réservation.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    jour: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="8" height="4" fill="currentColor"/><rect x="13" y="10" width="8" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reservations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    menage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    revenus: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['jour', 'Aujourd\'hui'], ['calendrier', 'Calendrier'], ['reservations', 'Réservations'], ['menage', 'Ménage'], ['revenus', 'Revenus']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à la gestion de tes locations : ce n\'est pas un conseil fiscal ni un logiciel de comptabilité. Aucun régime d\'imposition (micro-BIC, réel, loueur en meublé) n\'est calculé ; la taxe de séjour dépend du tarif que tu saisis, à vérifier auprès de ta commune. Les montants sont ceux de ta saisie.</p>';
  const COULEUR_SEJOUR = { aVenir: 'ciel', arrivee: 'jaune', enCours: 'vert', depart: 'rose', termine: 'sable', annule: 'sable' };
  const COULEUR_PAIEMENT = { solde: 'vert', soldeDu: 'rouge', acompteAttendu: 'jaune', acompteRecu: 'ciel', rien: 'sable', annulee: 'sable' };
  const etiquetteSejour = (r, t) => { const s = R.etatSejour(r, t); return `<span class="etiquette ${COULEUR_SEJOUR[s]}">${R.LIB_SEJOUR[s]}</span>`; };
  const etiquettePaiement = (r, t) => { const s = R.etatPaiement(r, E, t); return `<span class="etiquette ${COULEUR_PAIEMENT[s]}">${R.LIB_PAIEMENT[s]}</span>`; };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/location-saisonniere/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Location<br>saisonnière</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, logements et sauvegarde" title="Réglages">${ICONES.reglages}</button>
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
    document.title = `${titres[vue]} · Location saisonnière`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { jour: vueJour, calendrier: vueCalendrier, reservations: vueReservations, menage: vueMenage, revenus: vueRevenus }[vue]();
    brancherInfobulles();
    if (vue === 'calendrier') centrerAujourdhui();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M0 48 L36 12 L72 48Z" fill="#D9302A"/><rect x="8" y="48" width="56" height="48" fill="#1D4E89"/><circle cx="78" cy="24" r="18" fill="#F5B400"/></svg>';
  const sansLogement = () => `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun logement</h3><p>Ajoute d'abord un logement (nom, capacité, ménage facturé, tarif de taxe de séjour) : les réservations s'y rattachent.</p><div class="actions"><button class="btn primaire" data-action="nouveau-logement">${ICONES.plus}Ajouter un logement</button></div></div></div>`;
  const boutonNouvelle = (lib = 'Nouvelle réservation') => `<button class="btn primaire" data-action="nouvelle">${ICONES.plus}${lib}</button>`;

  // Ligne compacte d'un séjour (tableau du jour, listes).
  function ligneSejour(r, t, detail = '') {
    const l = logement(r.logement);
    return `<li><span class="date-pastille ${r.arrivee === t ? 'jaune' : ''}"><b>${versDate(r.arrivee).getDate()}</b>${fmt(r.arrivee, { month: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="ouvrir" data-id="${r.id}"><b>${esc(nomVoyageur(r))} · ${esc(l?.nom || 'Logement supprimé')}</b><span>${periode(r)} · ${nuitsTxt(R.nuits(r))} · ${pluriel(R.personnes(r), 'personne')} · ${esc(nomCanal(r.canal))}${detail ? ` · ${detail}` : ''}</span></button>
      <span class="ligne-tags">${etiquetteSejour(r, t)}</span></li>`;
  }

  function carteMenage(m, t) {
    const r = m.reservation;
    const fait = m.etat === 'fait';
    const lib = { enRetard: 'En retard', aujourdhui: 'Aujourd\'hui', aVenir: 'À venir', fait: 'Fait' }[m.etat];
    const coul = { enRetard: 'rouge', aujourdhui: 'jaune', aVenir: 'ciel', fait: 'vert' }[m.etat];
    return `<article class="menage-carte etat-${m.etat}">
      <div class="menage-tete"><span class="etiquette ${coul}">${lib}</span>${m.serre && !fait ? '<span class="etiquette rose">Rotation le jour même</span>' : ''}</div>
      <button class="decision-corps" data-action="ouvrir" data-id="${r.id}"><b>${esc(nomLogement(m.logement))}</b>
        <span class="decision-titre">Après le départ de ${esc(nomVoyageur(r))}, ${m.date === t ? 'aujourd\'hui' : `le ${dateLongue(m.date)}`}</span>
        <span>${m.suivante ? `Avant l'arrivée de ${esc(nomVoyageur(m.suivante))}, ${m.avant === t ? 'aujourd\'hui' : `le ${dateLongue(m.avant)}`}` : 'Aucune arrivée prévue ensuite'}${fait ? ` · fait le ${dateCourte(r.menageFait)}` : ''}</span></button>
      <div class="decision-pied"><span class="montant-mini">${r.menage ? `Ménage facturé ${euros(r.menage)}` : 'Ménage non facturé'}</span><button class="btn petit ${fait ? '' : 'primaire'}" data-action="menage-fait" data-id="${r.id}">${fait ? 'Remettre à faire' : 'Marquer fait'}</button></div>
    </article>`;
  }

  // ---------- Aujourd'hui ----------
  function vueJour() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Aujourd'hui</h1><p>${E.activite ? `${esc(E.activite)} · ` : ''}${dateLongue(t)} : qui arrive, qui part, le ménage à faire et l'argent à encaisser.</p></div>
        <div class="actions">${E.logements.length ? boutonNouvelle() : ''}</div></div>`;
    if (!E.logements.length) return `${titre}${sansLogement()}${AVERTISSEMENT}`;
    const j = R.jour(E, t);
    const m = R.stats(E, R.debutMois(t), R.moisSuivant(t));
    const tuiles = [
      ['Occupés ce soir', `${j.occupes.length} / ${E.logements.length}`, j.occupes.length ? j.occupes.map((r) => esc(nomLogement(r.logement))).join(', ') : 'tous les logements sont libres', 'var(--bleu)', ''],
      ['Arrivées · départs', `${j.arrivees.length} · ${j.departs.length}`, `${pluriel(j.prochainesArrivees.length, 'autre arrivée', 'autres arrivées')} dans les 7 jours`, 'var(--jaune)', 'rond'],
      ['Ménages à faire', String(j.menagesAFaire.length), j.menagesAFaire.filter((x) => x.etat === 'enRetard').length ? `dont ${j.menagesAFaire.filter((x) => x.etat === 'enRetard').length} en retard` : `${pluriel(j.menagesAVenir.length, 'autre')} dans les 14 jours`, 'var(--rouge)', ''],
      ['Ce mois-ci', euros(m.net, { centimes: false }), `net · occupation ${pct(m.occupation, 0)} · ${euros(m.prixMoyen ?? 0, { centimes: false })} la nuit en moyenne`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const conflits = j.conflits.length ? `<div class="alerte-conflit" role="alert"><b>${pluriel(j.conflits.length, 'chevauchement')} dans le calendrier</b><ul>${j.conflits.map((c) => `<li>${esc(nomLogement(c.a.logement))} : <button class="btn lien" data-action="ouvrir" data-id="${c.a.id}">${esc(nomVoyageur(c.a))}</button> (${R.LIB_STATUT[c.a.statut].toLowerCase()}, ${periode(c.a)}) et <button class="btn lien" data-action="ouvrir" data-id="${c.b.id}">${esc(nomVoyageur(c.b))}</button> (${R.LIB_STATUT[c.b.statut].toLowerCase()}, ${periode(c.b)})</li>`).join('')}</ul><p>${j.conflits.some((c) => c.bloquant) ? 'Deux réservations confirmées partagent une nuit : déplace ou annule l\'une d\'elles.' : 'Une option chevauche une autre réservation : confirme-la ailleurs ou annule-la.'}</p></div>` : '';
    const duJour = [...j.arrivees, ...j.departs, ...j.occupes.filter((r) => !j.arrivees.includes(r))];
    const uniques = [...new Map(duJour.map((r) => [r.id, r])).values()];
    const paiements = [...j.soldesDus, ...j.acomptesAttendus];
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${conflits}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">Séjours du jour <span>Arrivées, départs et séjours en cours</span></h2>
          ${uniques.length ? `<ul class="journal">${uniques.map((r) => ligneSejour(r, t)).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Personne aujourd\'hui</h3><p>Aucune arrivée, aucun départ, aucun séjour en cours.</p></div></div>'}
          <h2 class="titre-section">Les 7 prochains jours <span>Arrivées confirmées</span></h2>
          ${j.prochainesArrivees.length ? `<ul class="journal">${j.prochainesArrivees.map((r) => ligneSejour(r, t)).join('')}</ul>` : '<p class="aide">Aucune arrivée dans les 7 prochains jours.</p>'}
          ${j.options.length ? `<h2 class="titre-section">Options en attente <span>Elles ne bloquent pas le calendrier tant qu'elles ne sont pas confirmées</span></h2><ul class="journal">${j.options.map((r) => ligneSejour(r, t, R.enConflit(r, E.reservations) ? '<b class="texte-alerte">en conflit</b>' : 'option')).join('')}</ul>` : ''}
        </section>
        <section>
          <h2 class="titre-section">Ménage à faire <span>Entre deux séjours</span></h2>
          ${j.menagesAFaire.length ? `<div class="decisions">${j.menagesAFaire.map((x) => carteMenage(x, t)).join('')}</div>` : `<div class="vide-etat petit"><div><h3>Rien à nettoyer aujourd'hui</h3><p>${j.menagesAVenir.length ? `Prochain : ${esc(nomLogement(j.menagesAVenir[0].logement))}, le ${dateLongue(j.menagesAVenir[0].date)}.` : 'Chaque départ ajoutera un ménage ici.'}</p></div></div>`}
          <h2 class="titre-section">Paiements à suivre <span>${euros(paiements.reduce((s, p) => s + p.reste, 0))} restant</span></h2>
          ${paiements.length ? `<ul class="journal">${paiements.map((p) => `<li><span class="date-pastille ${p.etat === 'soldeDu' ? 'retard' : ''}"><b>${versDate(p.r.arrivee).getDate()}</b>${fmt(p.r.arrivee, { month: 'short' }).replace('.', '')}</span><button class="lien-ligne" data-action="ouvrir" data-id="${p.r.id}"><b>${esc(nomVoyageur(p.r))} · ${esc(nomLogement(p.r.logement))}</b><span>${p.etat === 'soldeDu' ? `Solde attendu depuis le ${dateCourte(R.dateSolde(p.r, E.reglages))}` : `Acompte de ${euros(R.acompteAttendu(p.r, E))} attendu`} · reste ${euros(p.reste)}</span></button><span class="ligne-tags">${etiquettePaiement(p.r, t)}</span></li>`).join('')}</ul>` : '<p class="aide">Tout est encaissé : aucun acompte ni solde en attente.</p>'}
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Calendrier ----------
  function vueCalendrier() {
    const t = auj();
    const debut = moisCal, fin = R.moisSuivant(moisCal);
    const nbJ = R.ecart(debut, fin);
    const titre = `<div class="vue-tete"><div><h1>Calendrier</h1><p>Une ligne par logement. Les séjours vont de l'après-midi d'arrivée au matin du départ : un départ et une arrivée le même jour se suivent sans se chevaucher.</p></div>
      <div class="actions">${E.logements.length ? boutonNouvelle() : ''}</div></div>`;
    if (!E.logements.length) return `${titre}${sansLogement()}`;
    const nav = `<div class="nav-mois"><button class="btn petit" data-action="mois" data-n="-1" aria-label="Mois précédent">‹</button><h2>${nomMois(debut)}</h2><button class="btn petit" data-action="mois" data-n="1" aria-label="Mois suivant">›</button>${debut !== R.debutMois(t) ? '<button class="btn petit" data-action="mois" data-n="0">Ce mois-ci</button>' : ''}</div>`;
    const jours = Array.from({ length: nbJ }, (_, i) => ajout(debut, i));
    const tete = `<div class="cal-ligne cal-tete"><div class="cal-nom"></div><div class="cal-piste">${jours.map((d) => { const w = versDate(d).getDay(); return `<span class="cal-jour ${w === 0 || w === 6 ? 'we' : ''} ${d === t ? 'auj' : ''}"><small>${'DLMMJVS'[w]}</small>${versDate(d).getDate()}</span>`; }).join('')}</div></div>`;
    const dansMois = E.reservations.filter((r) => R.estActive(r) && R.nuitsDansPeriode(r, debut, fin) > 0);
    const lignes = E.logements.map((l) => {
      const rs = dansMois.filter((r) => r.logement === l.id);
      const occ = rs.filter((r) => r.statut === 'confirmee').reduce((s, r) => s + R.nuitsDansPeriode(r, debut, fin), 0);
      const fonds = jours.map((d, i) => { const w = versDate(d).getDay(); return `<button class="cal-case ${w === 0 || w === 6 ? 'we' : ''} ${d === t ? 'auj' : ''}" style="left:calc(${i} * var(--w))" data-action="nouvelle-date" data-logement="${l.id}" data-date="${d}" aria-label="Nouvelle réservation, ${esc(l.nom)}, ${dateLongue(d)}" tabindex="-1"></button>`; }).join('');
      const barres = rs.map((r) => {
        const a = r.arrivee < debut ? 0 : R.ecart(debut, r.arrivee) + 0.5;
        const b = r.depart >= fin ? nbJ : R.ecart(debut, r.depart) + 0.5;
        const conflit = R.enConflit(r, E.reservations);
        const s = R.etatSejour(r, t);
        return `<button class="cal-barre st-${r.statut} ${s === 'termine' ? 'passe' : ''} ${conflit ? 'conflit' : ''} ${r.arrivee < debut ? 'coupe-g' : ''} ${r.depart >= fin ? 'coupe-d' : ''}" style="left:calc(${a} * var(--w));width:calc(${b - a} * var(--w) - 2px)" data-action="ouvrir" data-id="${r.id}" title="${esc(`${nomVoyageur(r)} · ${periode(r)} · ${nomCanal(r.canal)}${r.statut === 'option' ? ' · option' : ''}${conflit ? ' · chevauchement' : ''}`)}"><span>${r.statut === 'option' ? 'Option · ' : ''}${esc(nomVoyageur(r))}</span></button>`;
      }).join('');
      return `<div class="cal-ligne"><div class="cal-nom"><button class="lien-ligne" data-action="logement" data-id="${l.id}"><b>${esc(l.nom)}</b><span>${pct((occ / nbJ) * 100, 0)} occupé</span></button></div><div class="cal-piste">${fonds}${barres}</div></div>`;
    }).join('');
    const liste = [...dansMois].sort((a, b) => a.arrivee.localeCompare(b.arrivee));
    const s = R.stats(E, debut, fin);
    return `${titre}${nav}
      <div class="cal-cadre defile" id="cal-defile"><div class="cal" style="--j:${nbJ}">${tete}${lignes}</div></div>
      <p class="legende-cal"><span class="pastille-l conf"></span>Confirmée <span class="pastille-l opt"></span>Option <span class="pastille-l conf-x"></span>Chevauchement <span class="pastille-l passe"></span>Terminée · touche une case vide pour réserver</p>
      <h2 class="titre-section">Séjours de ${nomMois(debut)} <span>${pluriel(s.nuits, 'nuit vendue', 'nuits vendues')} · occupation ${pct(s.occupation, 0)} · net ${euros(s.net)}</span></h2>
      ${liste.length ? `<ul class="journal">${liste.map((r) => ligneSejour(r, t, r.statut === 'option' ? 'option' : '')).join('')}</ul>` : `<div class="vide-etat petit"><div><h3>Aucune réservation ce mois-ci</h3><p>Le mois est libre dans tous les logements. Touche une case du calendrier ou ajoute une réservation.</p><div class="actions">${boutonNouvelle('Ajouter une réservation')}</div></div></div>`}`;
  }
  // Largeur d'un jour : remplit le cadre sur ordinateur, 28 px au moins (défilement horizontal sur téléphone).
  function centrerAujourdhui() {
    const cadre = $('#cal-defile');
    const cal = cadre?.querySelector('.cal');
    if (cal) {
      const nom = parseFloat(getComputedStyle(cal).getPropertyValue('--nom')) || 170;
      const j = Number(cal.style.getPropertyValue('--j')) || 31;
      cal.style.setProperty('--w', `${Math.max(28, Math.floor((cadre.clientWidth - nom - 2) / j))}px`);
    }
    const c = cadre?.querySelector('.cal-tete .auj');
    if (cadre && c && cadre.scrollWidth > cadre.clientWidth) cadre.scrollLeft = Math.max(0, c.offsetLeft - cadre.clientWidth / 2);
  }

  // ---------- Réservations ----------
  const FILTRES = [['aVenir', 'À venir'], ['enCours', 'En cours'], ['aEncaisser', 'À encaisser'], ['options', 'Options'], ['termines', 'Terminés'], ['annulees', 'Annulées'], ['toutes', 'Toutes']];
  function garderFiltre(r, f, t) {
    const s = R.etatSejour(r, t);
    if (f === 'toutes') return true;
    if (f === 'annulees') return r.statut === 'annulee';
    if (r.statut === 'annulee') return false;
    if (f === 'options') return r.statut === 'option';
    if (f === 'aVenir') return s === 'aVenir';
    if (f === 'enCours') return s === 'arrivee' || s === 'enCours' || s === 'depart';
    if (f === 'termines') return s === 'termine';
    if (f === 'aEncaisser') return r.statut === 'confirmee' && ['soldeDu', 'acompteAttendu'].includes(R.etatPaiement(r, E, t));
    return true;
  }

  function ligneReservation(r, t) {
    const c = canal(r.canal);
    const ep = R.etatPaiement(r, E, t);
    const du = R.aRecevoir(r, E);
    const reste = Math.max(0, du - R.recu(r, t));
    const tags = [etiquetteSejour(r, t)];
    if (r.statut === 'option') tags.push('<span class="etiquette beurre-fort">Option</span>');
    if (R.enConflit(r, E.reservations)) tags.push('<span class="etiquette rouge">Chevauchement</span>');
    if (r.statut !== 'annulee') tags.push(etiquettePaiement(r, t));
    if (r.efface) tags.push('<span class="etiquette sable">Voyageur effacé</span>');
    return `<li class="ligne-fac ${r.statut === 'annulee' ? 'st-annulee' : ''} ${ep === 'soldeDu' ? 'alerte-due' : ''}">
      <button class="ligne-info" data-action="ouvrir" data-id="${r.id}">
        <b>${esc(nomVoyageur(r))} <span class="numero">${esc(nomLogement(r.logement))}</span></b>
        <span class="ligne-detail">${fmt(r.arrivee)} → ${fmt(r.depart)} · ${nuitsTxt(R.nuits(r))} · ${pluriel(r.adultes, 'adulte')}${r.enfants ? `, ${pluriel(r.enfants, 'enfant')}` : ''} · ${esc(c?.nom || 'Canal supprimé')}</span>
        <span class="ligne-etiquettes">${tags.join('')}</span>
      </button>
      <div class="ligne-droite">
        <span class="ligne-cout"><b>${euros(r.statut === 'annulee' ? 0 : R.net(r, c))}</b><small>net${r.statut !== 'annulee' && R.commission(r, c) ? ` (brut ${euros(R.brut(r))})` : ''}</small></span>
        <span class="ligne-proch">${r.statut !== 'annulee' && reste ? `Reste ${euros(reste)}` : ''}</span>
      </div>
    </li>`;
  }

  function vueReservations() {
    const t = auj();
    const q = filtre.q.trim().toLowerCase();
    const liste = E.reservations.filter((r) => garderFiltre(r, filtre.statut, t) && (!q || `${r.voyageur} ${nomLogement(r.logement)} ${nomCanal(r.canal)} ${r.note}`.toLowerCase().includes(q)))
      .sort((a, b) => (['termines', 'annulees', 'toutes'].includes(filtre.statut) ? b.arrivee.localeCompare(a.arrivee) : a.arrivee.localeCompare(b.arrivee)));
    const nb = (id) => E.reservations.filter((r) => garderFiltre(r, id, t)).length;
    const total = liste.filter((r) => R.estActive(r)).reduce((s, r) => s + R.net(r, canal(r.canal)), 0);
    return `
      <div class="vue-tete"><div><h1>Réservations</h1><p>Chaque séjour avec ses dates, ses voyageurs, son canal et ce qu'il te rapporte. Ouvre-le pour noter un paiement ou voir la taxe de séjour.</p></div>
        <div class="actions">${E.logements.length ? boutonNouvelle('Ajouter') : ''}</div></div>
      ${!E.logements.length ? sansLogement() : `
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer">${FILTRES.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-statut="${id}" aria-pressed="${filtre.statut === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Voyageur, logement, canal" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<p class="resume-liste">${pluriel(liste.length, 'réservation')} · ${euros(total)} net</p><ul class="lignes-fac">${liste.map((r) => ligneReservation(r, t)).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.reservations.length ? 'Aucune réservation ne correspond' : 'Aucune réservation'}</h3><p>${E.reservations.length ? 'Change le filtre ou la recherche.' : 'Ajoute ta première réservation : logement, dates, voyageurs, canal et montant.'}</p><div class="actions">${boutonNouvelle('Ajouter une réservation')}</div></div></div>`}`}
      <div class="rgpd"><h2>Données de tes voyageurs</h2><p>Garde le minimum utile : un nom pour reconnaître la réservation et le nombre de personnes (pour la taxe de séjour). Pas d'adresse, de téléphone ni de pièce d'identité ici. Ouvre une réservation pour <b>effacer le nom du voyageur</b> (dates et montants restent), ou efface d'un coup les séjours anciens dans les Réglages.</p></div>`;
  }

  // ---------- Ménage ----------
  function vueMenage() {
    const t = auj();
    const m = R.menages(E.reservations, t);
    const retard = m.filter((x) => x.etat === 'enRetard');
    const ajd = m.filter((x) => x.etat === 'aujourdhui');
    const avenir = m.filter((x) => x.etat === 'aVenir' && x.date <= ajout(t, 14));
    const faits = m.filter((x) => x.etat === 'fait').sort((a, b) => b.reservation.menageFait.localeCompare(a.reservation.menageFait)).slice(0, 6);
    const grille = (l) => `<div class="grille-relances">${l.map((x) => carteMenage(x, t)).join('')}</div>`;
    return `
      <div class="vue-tete"><div><h1>Ménage</h1><p>Un ménage par départ, à faire avant la prochaine arrivée dans le logement. Les options ne créent pas de ménage tant qu'elles ne sont pas confirmées.</p></div></div>
      ${!E.logements.length ? sansLogement() : `
      ${retard.length ? `<h2 class="titre-section">En retard <span>${pluriel(retard.length, 'ménage')} non marqué${retard.length > 1 ? 's' : ''} fait${retard.length > 1 ? 's' : ''}</span></h2>${grille(retard)}` : ''}
      <h2 class="titre-section">Aujourd'hui</h2>
      ${ajd.length ? grille(ajd) : '<div class="vide-etat petit"><div><h3>Aucun départ aujourd\'hui</h3><p>Les ménages du jour apparaissent ici le jour du départ.</p></div></div>'}
      <h2 class="titre-section">Dans les 14 jours</h2>
      ${avenir.length ? grille(avenir) : '<p class="aide">Aucun départ prévu dans les 14 prochains jours.</p>'}
      <h2 class="titre-section">Faits récemment</h2>
      ${faits.length ? grille(faits) : '<p class="aide">Aucun ménage marqué fait pour l\'instant.</p>'}
      <details class="plus-tard" style="margin-top:28px"><summary>Check-list de ménage entre deux séjours</summary><ol class="checklist">${B.checklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>`}`;
  }

  // ---------- Revenus ----------
  function vueRevenus() {
    const t = auj();
    const a = anneeRev;
    const debut = `${a}-01-01`, fin = `${a + 1}-01-01`;
    const s = R.stats(E, debut, fin);
    const mois = R.parMois(E, a);
    const titre = `<div class="vue-tete"><div><h1>Revenus ${a}</h1><p>Brut (hébergement et ménage facturés), commissions des canaux et net, mois par mois. Chaque nuit compte dans son mois. Taxe de séjour à part : elle n'est pas un revenu.</p></div>
      <div class="actions"><button class="btn petit" data-action="annee" data-n="-1" aria-label="Année précédente">‹ ${a - 1}</button><button class="btn petit" data-action="annee" data-n="1" aria-label="Année suivante">${a + 1} ›</button></div></div>`;
    if (!E.logements.length) return `${titre}${sansLogement()}`;
    const tuiles = [
      ['Net', euros(s.net, { centimes: false }), `brut ${euros(s.brut, { centimes: false })} − commissions ${euros(s.commission, { centimes: false })}`, 'var(--bleu)', ''],
      ['Occupation', pct(s.occupation, 0), `${pluriel(s.nuits, 'nuit vendue', 'nuits vendues')} sur ${s.dispo}`, 'var(--jaune)', 'rond'],
      ['Prix moyen par nuit', euros(s.prixMoyen ?? 0, { centimes: false }), `hébergement seul, ${pluriel(s.sejours, 'séjour')} arrivés en ${a}`, 'var(--rouge)', ''],
      ['Taxe de séjour', euros(s.taxe, { centimes: false }), `${euros(s.taxeToi, { centimes: false })} à reverser par toi · ${euros(s.taxeCanal, { centimes: false })} par les canaux`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const nonRens = E.logements.filter((l) => R.tarifTaxe(l, E.reglages) === null);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${nonRens.length ? `<p class="aide alerte-taux">Tarif de taxe de séjour non renseigné pour ${nonRens.map((l) => esc(l.nom)).join(', ')} : sa taxe n'est pas calculée. <button class="btn lien" data-action="reglages">Renseigner dans les Réglages</button></p>` : ''}
      <h2 class="titre-section">Net par mois <span>Réservations confirmées · mois en cours en noir</span></h2>
      ${graphiqueMois(mois, t)}
      <h2 class="titre-section">Par canal <span>${a}</span></h2>
      ${s.parCanal.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Canal</th><th class="nb">Séjours</th><th class="nb">Nuits</th><th class="nb">Brut</th><th class="nb">Commission</th><th class="nb">Net</th><th class="nb">Part du net</th></tr></thead><tbody>${s.parCanal.map((c) => `<tr><td>${esc(nomCanal(c.canal))}</td><td class="nb">${c.sejours}</td><td class="nb">${c.nuits}</td><td class="nb">${euros(c.brut)}</td><td class="nb">${euros(c.commission)}</td><td class="nb"><b>${euros(c.net)}</b></td><td class="nb">${s.net ? pct((c.net / s.net) * 100, 0) : '–'}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${s.sejours}</td><td class="nb">${s.nuits}</td><td class="nb">${euros(s.brut)}</td><td class="nb">${euros(s.commission)}</td><td class="nb">${euros(s.net)}</td><td class="nb">100 %</td></tr></tfoot></table></div>` : '<p class="aide">Aucune nuit confirmée cette année.</p>'}
      <h2 class="titre-section">Par logement <span>${a}</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Logement</th><th class="nb">Nuits</th><th class="nb">Occupation</th><th class="nb">Prix moyen</th><th class="nb">Net</th><th class="nb">Taxe</th></tr></thead><tbody>${s.parLogement.map((l) => `<tr><td>${esc(nomLogement(l.logement))}</td><td class="nb">${l.nuits}</td><td class="nb">${pct(l.occupation, 0)}</td><td class="nb">${l.prixMoyen ? euros(l.prixMoyen) : '–'}</td><td class="nb"><b>${euros(l.net)}</b></td><td class="nb">${euros(l.taxe)}</td></tr>`).join('')}</tbody></table></div>
      <h2 class="titre-section">Mois par mois <span>Nuits, occupation, argent et taxe</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Mois</th><th class="nb">Nuits</th><th class="nb">Occupation</th><th class="nb">Brut</th><th class="nb">Commissions</th><th class="nb">Net</th><th class="nb">Taxe à reverser</th></tr></thead><tbody>${mois.map((m) => `<tr class="${m.nuits ? '' : 'vide'}"><td>${nomMois(m.mois)}</td><td class="nb">${m.nuits}</td><td class="nb">${pct(m.occupation, 0)}</td><td class="nb">${euros(m.brut)}</td><td class="nb">${euros(m.commission)}</td><td class="nb"><b>${euros(m.net)}</b></td><td class="nb">${euros(m.taxeToi)}</td></tr>`).join('')}</tbody><tfoot><tr><td>${a}</td><td class="nb">${s.nuits}</td><td class="nb">${pct(s.occupation, 0)}</td><td class="nb">${euros(s.brut)}</td><td class="nb">${euros(s.commission)}</td><td class="nb">${euros(s.net)}</td><td class="nb">${euros(s.taxeToi)}</td></tr></tfoot></table></div>
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv">Exporter les réservations (CSV)</button></div>
      <div class="rgpd"><h2>Et les impôts ?</h2><p>Tes recettes de location meublée sont imposables. L'outil ne calcule aucun régime (micro-BIC, réel, statut de loueur en meublé) ni aucun abattement : il te donne le brut, les commissions et le net par mois et par an, à reporter ou à transmettre à ton comptable. Les règles changent : fais vérifier ta situation par un professionnel ou sur impots.gouv.fr.</p></div>
      ${AVERTISSEMENT}`;
  }

  // Net par mois : une seule série (bleu), sans légende, valeur au-dessus du plus haut mois, tableau à côté.
  function graphiqueMois(mois, t) {
    const max = Math.max(...mois.map((m) => m.net), 1);
    const iMax = mois.findIndex((m) => m.net === max);
    const cols = mois.map((m, i) => `<div class="col-proj ${i === iMax ? 'max' : ''} ${m.mois === t.slice(0, 7) ? 'actif' : ''}" tabindex="0" data-info="${esc(`<b>${nomMois(m.mois)}</b>Net ${euros(m.net)}<br>Brut ${euros(m.brut)} · commissions ${euros(m.commission)}<br>${pluriel(m.nuits, 'nuit')} · occupation ${pct(m.occupation, 0)}`)}">
        <span class="cp-val">${m.net ? euros(m.net, { centimes: false }) : ''}</span>
        <span class="cp-zone"><span class="cp-barre" style="height:${m.net > 0 ? Math.max(2, (m.net / max) * 100) : 0}%"></span></span>
        <span class="cp-mois">${moisCourt(m.mois)}</span>
      </div>`).join('');
    return `<figure class="graphique"><div class="projection">${cols}</div><div class="infobulle" hidden></div></figure>`;
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
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight + 24)}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
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

  // Nouvelle réservation (id absent) ou réservation existante.
  function modaleReservation(id, { logementId = '', date = '' } = {}) {
    const t = auj();
    const r = id ? resa(id) : null;
    if (id && !r) return;
    if (!E.logements.length) { modaleLogement(null); return; }
    const l0 = logement(logementId) || E.logements[0];
    const arr = date || t;
    const v = r || { logement: l0.id, arrivee: arr, depart: ajout(arr, 2), voyageur: '', adultes: 2, enfants: 0, canal: R.CANAL_DIRECT, statut: 'confirmee', hebergement: null, menage: l0.menage, commission: null, taxeParCanal: false, note: '' };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Logement<select name="logement" id="r-logement">${E.logements.map((l) => `<option value="${l.id}" ${l.id === v.logement ? 'selected' : ''}>${esc(l.nom)} (${l.capacite} pers.)</option>`).join('')}</select></label>
        <label class="champ">Canal<select name="canal" id="r-canal">${E.canaux.map((c) => `<option value="${c.id}" ${c.id === v.canal ? 'selected' : ''}>${esc(c.nom)}${c.commission ? ` (${pct(c.commission)})` : ''}</option>`).join('')}</select></label>
      </div>
      <fieldset class="champ"><legend>Statut <small>Une option ne bloque pas le calendrier et ne crée pas de ménage.</small></legend><div class="choix-statut">${R.STATUTS.map((s) => `<label><input type="radio" name="statut" value="${s}" ${v.statut === s ? 'checked' : ''}><span>${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Arrivée<input type="date" name="arrivee" required value="${v.arrivee}"></label>
        <label class="champ">Nuits<input type="number" name="nuits" min="1" max="365" value="${R.ecart(v.arrivee, v.depart)}"></label>
        <label class="champ">Départ<input type="date" name="depart" required value="${v.depart}"></label>
      </div>
      <label class="champ">Voyageur <small>Un nom pour reconnaître la réservation, rien de plus.</small><input name="voyageur" maxlength="80" value="${esc(v.voyageur)}" placeholder="Ex. : Famille Martin" autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ">Adultes<input type="number" name="adultes" min="0" max="30" value="${v.adultes}"></label>
        <label class="champ">Enfants (mineurs)<small>Exonérés de taxe si l'option est cochée.</small><input type="number" name="enfants" min="0" max="30" value="${v.enfants}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Hébergement (total du séjour)<input name="hebergement" inputmode="decimal" autocomplete="off" required value="${R.saisieMontant(v.hebergement)}" placeholder="0,00"></label>
        <label class="champ">Ménage facturé<input name="menage" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.menage)}" placeholder="0,00"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Commission du canal <small>Vide : pourcentage du canal.</small><input name="commission" inputmode="decimal" autocomplete="off" value="${R.saisieMontant(v.commission)}" id="r-commission" placeholder="Automatique"></label>
      </div>
      <label class="case"><input type="checkbox" name="taxeParCanal" id="r-taxe-canal" ${v.taxeParCanal ? 'checked' : ''}> Taxe de séjour collectée par le canal (tu n'as pas à la reverser)</label>
      <p class="recap" id="r-recap" aria-live="polite"></p>
      <label class="champ">Note <small>Facultative. Évite les informations personnelles inutiles.</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = r
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    const lire = (fd) => {
      const statut = fd.get('statut') || 'confirmee';
      const brutCom = String(fd.get('commission') || '').trim();
      return {
        logement: fd.get('logement'), canal: fd.get('canal'), statut, arrivee: fd.get('arrivee'), depart: fd.get('depart'),
        voyageur: String(fd.get('voyageur') || '').trim(), adultes: Math.round(Number(fd.get('adultes'))), enfants: Math.round(Number(fd.get('enfants'))),
        hebergement: R.lireMontant(fd.get('hebergement')), menage: String(fd.get('menage') || '').trim() ? R.lireMontant(fd.get('menage')) : 0,
        commission: brutCom ? R.lireMontant(brutCom) : null, commissionIllisible: !!brutCom && R.lireMontant(brutCom) === null,
        taxeParCanal: !!fd.get('taxeParCanal'), note: String(fd.get('note') || '').trim(),
      };
    };
    ouvrirModale(r ? 'Modifier la réservation' : 'Nouvelle réservation', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer la réservation de ${nomVoyageur(r)} (${periode(r)}) ? Pour garder la trace d'une annulation, choisis plutôt le statut « Annulée ».`)) { garderOuverte(); return; }
        retenir();
        E.reservations = E.reservations.filter((x) => x.id !== r.id);
        sauver(); rendre(); toast('Réservation supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const x = lire(fd);
      if (!R.estDate(x.arrivee) || !R.estDate(x.depart)) return 'Indique les dates d\'arrivée et de départ.';
      if (x.depart <= x.arrivee) return 'Le départ doit être au moins le lendemain de l\'arrivée.';
      if (R.ecart(x.arrivee, x.depart) > 365) return 'Un séjour ne peut pas dépasser 365 nuits.';
      if (!(x.adultes >= 0 && x.adultes <= 30 && x.enfants >= 0 && x.enfants <= 30) || x.adultes + x.enfants < 1) return 'Indique au moins une personne.';
      const lg = logement(x.logement);
      if (x.adultes + x.enfants > lg.capacite) return `${lg.nom} accueille ${pluriel(lg.capacite, 'personne')} au plus : ajuste le nombre de voyageurs ou la capacité du logement.`;
      if (x.hebergement === null) return 'Montant de l\'hébergement illisible : écris par exemple 450,00.';
      if (x.menage === null) return 'Frais de ménage illisibles : écris par exemple 45,00.';
      if (x.commissionIllisible) return 'Commission illisible : écris un montant, ou laisse vide pour le pourcentage du canal.';
      const candidat = R.normaliserReservation({ ...(r || {}), id: r?.id || 'nouvelle', ...x, paiements: r?.paiements || [] }, t);
      const ctl = R.controlerChevauchement(candidat, E.reservations);
      if (!ctl.ok) return `Chevauchement : ${lg.nom} est déjà réservé par ${nomVoyageur(ctl.bloquante)} du ${dateCourte(ctl.bloquante.arrivee)} au ${dateCourte(ctl.bloquante.depart)}. Change les dates ou enregistre-la en option.`;
      retenir();
      delete x.commissionIllisible;
      if (r) {
        const avant = r.depart;
        Object.assign(r, R.normaliserReservation({ ...r, ...x }, t));
        if (r.depart !== avant) r.menageFait = null;
      } else E.reservations.push(R.normaliserReservation({ id: uid(), ...x, paiements: [] }, t));
      sauver(); rendre();
      const signal = ctl.signales.length ? ` Attention : chevauche ${ctl.signales.map((s) => nomVoyageur(s)).join(', ')}.` : '';
      toast(`${r ? 'Réservation enregistrée' : `Réservation ajoutée : ${lg.nom}, ${nuitsTxt(R.ecart(x.arrivee, x.depart))}`}.${signal}`, { libelle: 'Annuler', faire: annuler });
    });
    // Champs liés : nuits ↔ départ, ménage du logement, collecte de la taxe du canal, récapitulatif.
    const d = modale();
    const f = d.querySelector('form');
    const ar = f.arrivee, nu = f.nuits, de = f.depart;
    const majDepart = () => { const n = Math.round(Number(nu.value)); if (R.estDate(ar.value) && n >= 1) de.value = ajout(ar.value, n); };
    nu.addEventListener('input', majDepart);
    ar.addEventListener('change', majDepart);
    de.addEventListener('change', () => { if (R.estDate(ar.value) && R.estDate(de.value)) nu.value = R.ecart(ar.value, de.value); });
    d.querySelector('#r-logement').addEventListener('change', (e) => { if (!r) f.menage.value = R.saisieMontant(logement(e.target.value)?.menage || 0); });
    d.querySelector('#r-canal').addEventListener('change', (e) => { d.querySelector('#r-taxe-canal').checked = !!canal(e.target.value)?.collecteTaxe; });
    const recap = () => {
      const x = lire(new FormData(f));
      const el = d.querySelector('#r-recap');
      if (!R.estDate(x.arrivee) || !R.estDate(x.depart) || x.depart <= x.arrivee || x.hebergement === null || x.menage === null) { el.textContent = ''; return; }
      const c = R.normaliserReservation({ ...x, id: 'apercu' }, t);
      const cn = canal(c.canal);
      const tx = R.taxeSejour(c, logement(c.logement), E.reglages);
      el.innerHTML = `${nuitsTxt(R.nuits(c))} · brut ${euros(R.brut(c))} · commission ${euros(R.commission(c, cn))} · <b>net ${euros(R.net(c, cn))}</b> · taxe de séjour ${tx.nonRenseigne ? 'tarif non renseigné' : `${euros(tx.montant)}${c.taxeParCanal ? ' (collectée par le canal)' : ''}`}${R.nuits(c) ? ` · ${euros(Math.round(c.hebergement / R.nuits(c)))} la nuit` : ''}`;
    };
    f.addEventListener('input', recap); f.addEventListener('change', recap); recap();
  }

  // Détail d'une réservation : argent, taxe, paiements, ménage, effacement.
  function modaleDetail(id) {
    const t = auj();
    const r = resa(id);
    if (!r) return;
    const l = logement(r.logement);
    const c = canal(r.canal);
    const tx = R.taxeSejour(r, l, E.reglages);
    const du = R.aRecevoir(r, E);
    const deja = R.recu(r, t);
    const reste = Math.max(0, du - deja);
    const actif = R.estActive(r);
    const conflits = E.reservations.filter((x) => R.chevauche(r, x));
    const m = R.menages(E.reservations, t).find((x) => x.reservation.id === r.id);
    const corps = `
      <div class="resume-facture">
        <div><span>Logement</span><b><button type="button" class="btn lien" data-action="logement" data-id="${r.logement}">${esc(l?.nom || 'Logement supprimé')}</button></b><small>${etiquetteSejour(r, t)} ${r.statut !== 'confirmee' ? `<span class="etiquette beurre-fort">${R.LIB_STATUT[r.statut]}</span>` : ''}</small></div>
        <div><span>Séjour</span><b>${nuitsTxt(R.nuits(r))}</b><small>${fmt(r.arrivee)} → ${fmt(r.depart)}</small></div>
        <div><span>Voyageurs</span><b>${esc(nomVoyageur(r))}</b><small>${pluriel(r.adultes, 'adulte')}${r.enfants ? `, ${pluriel(r.enfants, 'enfant')}` : ''}</small></div>
        <div><span>Canal</span><b>${esc(c?.nom || 'Canal supprimé')}</b><small>${c?.commission ? `commission ${pct(c.commission)}` : 'sans commission'}</small></div>
      </div>
      ${conflits.length ? `<p class="aide alerte-taux">Chevauche ${conflits.map((x) => `${esc(nomVoyageur(x))} (${R.LIB_STATUT[x.statut].toLowerCase()}, ${periode(x)})`).join(', ')}.</p>` : ''}
      ${r.note ? `<p class="aide">${esc(r.note)}</p>` : ''}
      <section class="bloc-detail"><h3>Ce que rapporte le séjour <span>${euros(actif ? R.net(r, c) : 0)} net</span></h3>
        ${actif ? `<p class="ligne-somme"><span>Hébergement${R.nuits(r) ? ` (${euros(Math.round(r.hebergement / R.nuits(r)))} la nuit)` : ''}</span><b>${euros(r.hebergement)}</b></p>
        <p class="ligne-somme"><span>Ménage facturé</span><b>${euros(r.menage)}</b></p>
        <p class="ligne-somme"><span>Brut</span><b>${euros(R.brut(r))}</b></p>
        <p class="ligne-somme"><span>Commission ${esc(c?.nom || '')}${r.commission === null ? ` (${pct(c?.commission || 0)} du brut)` : ' (montant saisi)'}</span><b>− ${euros(R.commission(r, c))}</b></p>
        <p class="ligne-somme total"><span>Net</span><b>${euros(R.net(r, c))}</b></p>` : '<p class="mention">Réservation annulée : rien n\'est compté dans les revenus.</p>'}
      </section>
      <section class="bloc-detail"><h3>Taxe de séjour <span>${tx.nonRenseigne ? 'à renseigner' : euros(tx.montant)}</span></h3>
        ${!actif ? '<p class="mention">Aucune taxe pour une réservation annulée.</p>' : tx.nonRenseigne ? `<p class="mention">Aucun tarif saisi pour ce logement ni dans les Réglages. Demande le tarif par personne et par nuit à ta commune, puis <button type="button" class="btn lien" data-action="logement" data-id="${r.logement}">renseigne-le</button>.</p>` : `<p class="mention">${pluriel(tx.imposables, 'personne imposable', 'personnes imposables')}${r.enfants && E.reglages.exonererMineurs ? ` (${pluriel(r.enfants, 'mineur')} exonéré${r.enfants > 1 ? 's' : ''})` : ''} × ${nuitsTxt(R.nuits(r))} × ${euros(tx.tarif)}. ${r.taxeParCanal ? `Collectée et reversée par ${esc(c?.nom || 'le canal')}, d'après ta saisie.` : 'À encaisser auprès du voyageur et à reverser à ta commune.'}</p>`}
      </section>
      <section class="bloc-detail"><h3>Paiements <span>${euros(deja)} reçus sur ${euros(du)}</span></h3>
        ${actif ? `<p class="mention">${etiquettePaiement(r, t)} Acompte attendu ${euros(R.acompteAttendu(r, E))} (${pct(E.reglages.acomptePct, 0)}), solde le ${fmt(R.dateSolde(r, E.reglages))}.${r.taxeParCanal || !tx.montant ? '' : ' Taxe de séjour comprise.'}</p>` : ''}
        ${r.paiements.length ? `<ul class="mini-liste">${[...r.paiements].sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<li><span>${fmt(p.date)}${p.note ? ` · ${esc(p.note)}` : ''}</span><b>${euros(p.montant)}</b><button type="button" class="btn-suppr" data-action="suppr-paiement" data-id="${r.id}" data-p="${p.id}" aria-label="Supprimer ce paiement">×</button></li>`).join('')}</ul>` : '<p class="mention">Aucun paiement noté.</p>'}
        <div class="rang">${actif && reste ? `<button type="button" class="btn petit" data-action="paiement" data-id="${r.id}">${ICONES.plus}Noter un paiement</button><button type="button" class="btn petit" data-action="solder" data-id="${r.id}">Solde reçu aujourd'hui (${euros(reste)})</button>` : ''}</div>
      </section>
      ${m ? `<section class="bloc-detail"><h3>Ménage après le départ <span>${m.etat === 'fait' ? 'fait' : m.etat === 'enRetard' ? 'en retard' : `le ${dateCourte(m.date)}`}</span></h3>
        <p class="mention">${m.suivante ? `Prochaine arrivée : ${esc(nomVoyageur(m.suivante))}, le ${dateLongue(m.avant)}${m.serre ? ' (rotation le jour même)' : ''}.` : 'Aucune arrivée prévue ensuite dans ce logement.'}${r.menageFait ? ` Fait le ${fmt(r.menageFait)}.` : ''}</p>
        <div class="rang"><button type="button" class="btn petit" data-action="menage-fait" data-id="${r.id}">${r.menageFait ? 'Remettre à faire' : 'Marquer le ménage fait'}</button></div></section>` : ''}
      <section class="bloc-detail"><h3>Données du voyageur</h3>
        <p class="mention">Effacer remplace le nom par « Voyageur effacé » et vide les notes. Dates, nombres de personnes et montants restent pour tes comptes.</p>
        <div class="rang"><button type="button" class="btn petit" data-action="effacer-voyageur" data-id="${r.id}" ${r.efface ? 'disabled' : ''}>Effacer le voyageur</button></div></section>`;
    ouvrirModale(`${esc(nomVoyageur(r))}`, corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier" data-id="${r.id}">Modifier</button>`);
  }

  function modalePaiement(id) {
    const t = auj();
    const r = resa(id);
    if (!r) return;
    const reste = Math.max(0, R.aRecevoir(r, E) - R.recu(r, t));
    const ac = Math.max(0, R.acompteAttendu(r, E) - R.recu(r, t));
    ouvrirModale(`Paiement · ${esc(nomVoyageur(r))}`, `
      <p>Reste à recevoir : <b>${euros(reste)}</b>${ac ? ` (acompte attendu : ${euros(ac)})` : ''}.</p>
      <div class="rang-champs">
        <label class="champ">Montant reçu<input name="montant" inputmode="decimal" required value="${R.saisieMontant(ac || reste)}"></label>
        <label class="champ">Date<input type="date" name="date" required value="${t}"></label>
      </div>
      <label class="champ">Note <small>Facultative (acompte, virement du canal, chèque…).</small><input name="note" maxlength="120" value="${ac ? 'Acompte' : ''}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const mt = R.lireMontant(fd.get('montant'));
      if (!mt) return 'Montant illisible : écris par exemple 150,00.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date du paiement.';
      retenir();
      r.paiements.push({ id: uid(), date: fd.get('date'), montant: mt, note: String(fd.get('note') || '').trim() });
      sauver(); rendre();
      garderOuverte(); modaleDetail(r.id);
      const rs = Math.max(0, R.aRecevoir(r, E) - R.recu(r, t));
      toast(rs ? `Paiement de ${euros(mt)} noté : reste ${euros(rs)}.` : 'Séjour soldé.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleLogement(id) {
    const l = id ? logement(id) : null;
    if (!l && E.logements.length >= R.MAX_LOGEMENTS) { toast(`${R.MAX_LOGEMENTS} logements au plus.`); return; }
    const v = l || { nom: '', capacite: 4, menage: 0, taxe: null, note: '' };
    const n = l ? E.reservations.filter((r) => r.logement === l.id).length : 0;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom du logement<input name="nom" maxlength="60" required value="${esc(v.nom)}" placeholder="Ex. : Studio du centre"></label>
        <label class="champ">Capacité (personnes)<input type="number" name="capacite" min="1" max="30" value="${v.capacite}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Ménage facturé par défaut<small>Proposé à chaque nouvelle réservation.</small><input name="menage" inputmode="decimal" value="${R.saisieMontant(v.menage)}" placeholder="0,00"></label>
        <label class="champ">Taxe de séjour par personne et par nuit<small>Le tarif de ta commune pour ce logement. Vide : tarif des Réglages${Number.isFinite(E.reglages.taxeDefaut) ? ` (${euros(E.reglages.taxeDefaut)})` : ', non renseigné'}.</small><input name="taxe" inputmode="decimal" value="${R.saisieMontant(v.taxe)}" placeholder="À renseigner"></label>
      </div>
      <p class="aide">Le tarif dépend de ta commune et du classement du logement ; pour un logement non classé, la commune applique un pourcentage du prix de la nuit, plafonné : calcule le montant par personne avec elle. Aucun barème n'est intégré.</p>
      <label class="champ">Note <small>Facultative (code de la boîte à clés à éviter ici).</small><input name="note" maxlength="300" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${l ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${l ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(l ? 'Logement' : 'Nouveau logement', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!R.peutSupprimerLogement(E, l.id)) return `${pluriel(n, 'réservation')} dans ce logement : supprime-les d'abord, ou garde le logement.`;
        if (!confirm(`Supprimer le logement « ${l.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        E.logements = E.logements.filter((x) => x.id !== l.id);
        sauver(); rendre(); toast(`« ${l.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au logement.';
      const cap = Math.round(Number(fd.get('capacite')));
      if (!(cap >= 1 && cap <= 30)) return 'La capacité va de 1 à 30 personnes.';
      const menage = String(fd.get('menage') || '').trim() ? R.lireMontant(fd.get('menage')) : 0;
      if (menage === null) return 'Frais de ménage illisibles : écris par exemple 45,00.';
      const taxe = String(fd.get('taxe') || '').trim() ? R.lireMontant(fd.get('taxe')) : null;
      if (String(fd.get('taxe') || '').trim() && taxe === null) return 'Tarif de taxe illisible : écris par exemple 1,00.';
      retenir();
      const d = R.normaliserLogement({ id: l?.id || uid(), nom, capacite: cap, menage, taxe, note: String(fd.get('note') || '').trim() });
      if (l) Object.assign(l, d); else E.logements.push(d);
      sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCanal(id) {
    const c = id ? canal(id) : null;
    const direct = c?.id === R.CANAL_DIRECT;
    const v = c || { nom: '', commission: 0, collecteTaxe: false };
    const n = c ? E.reservations.filter((r) => r.canal === c.id).length : 0;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom du canal <small>Celui que tu veux : aucune plateforme n'est connectée.</small><input name="nom" maxlength="40" required value="${esc(v.nom)}" ${direct ? 'readonly' : ''} placeholder="Ex. : Plateforme A"></label>
        <label class="champ">Commission (%)<small>Appliquée au brut (hébergement + ménage), modifiable par réservation.</small><input name="commission" inputmode="decimal" value="${R.saisiePct(v.commission)}"></label>
      </div>
      <label class="case"><input type="checkbox" name="collecteTaxe" ${v.collecteTaxe ? 'checked' : ''}> Ce canal collecte et reverse la taxe de séjour (à vérifier dans ton contrat)</label>
      <p class="mention">Les changements valent pour les nouvelles réservations ; une commission saisie à la main sur une réservation reste la sienne.</p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${c ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${c && !direct ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
    ouvrirModale(c ? 'Canal de réservation' : 'Nouveau canal', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (n) return `${pluriel(n, 'réservation')} passent par ce canal : garde-le pour tes statistiques.`;
        if (!confirm(`Supprimer le canal « ${c.nom} » ?`)) { garderOuverte(); return; }
        retenir();
        E.canaux = E.canaux.filter((x) => x.id !== c.id);
        sauver(); rendre(); toast(`Canal « ${c.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = direct ? c.nom : String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au canal.';
      if (E.canaux.some((x) => x.id !== c?.id && x.nom.toLowerCase() === nom.toLowerCase())) return 'Un canal porte déjà ce nom.';
      const p = String(fd.get('commission') || '').trim() ? R.lirePct(fd.get('commission')) : 0;
      if (p === null) return 'Commission illisible : écris un pourcentage, par exemple 15.';
      retenir();
      const d = R.normaliserCanal({ id: c?.id || uid(), nom, commission: p, collecteTaxe: !!fd.get('collecteTaxe') });
      if (c) Object.assign(c, d); else E.canaux.push(d);
      sauver(); rendre(); toast(`Canal « ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const g = E.reglages;
    const corps = `
      <label class="champ">Nom de ton activité<input name="activite" maxlength="80" value="${esc(E.activite)}"></label>
      <div class="groupe"><h3>Logements <span class="etiquette sable">${E.logements.length} / ${R.MAX_LOGEMENTS}</span></h3>
        ${E.logements.length ? `<ul class="mini-liste">${E.logements.map((l) => `<li><span><b>${esc(l.nom)}</b> · ${l.capacite} pers. · ménage ${euros(l.menage)} · taxe ${R.tarifTaxe(l, g) === null ? 'non renseignée' : `${euros(R.tarifTaxe(l, g))}${Number.isFinite(l.taxe) ? '' : ' (par défaut)'}`}</span><button type="button" class="btn petit" data-action="logement" data-id="${l.id}">Modifier</button></li>`).join('')}</ul>` : '<p class="mention">Aucun logement.</p>'}
        <div class="rang">${E.logements.length < R.MAX_LOGEMENTS ? `<button type="button" class="btn petit" data-action="nouveau-logement">${ICONES.plus}Ajouter un logement</button>` : ''}</div></div>
      <div class="groupe"><h3>Canaux de réservation</h3>
        <ul class="mini-liste">${E.canaux.map((c) => `<li><span><b>${esc(c.nom)}</b> · commission ${pct(c.commission)}${c.collecteTaxe ? ' · collecte la taxe' : ''}</span><button type="button" class="btn petit" data-action="canal" data-id="${c.id}">Modifier</button></li>`).join('')}</ul>
        <div class="rang"><button type="button" class="btn petit" data-action="nouveau-canal">${ICONES.plus}Ajouter un canal</button></div></div>
      <div class="groupe"><h3>Taxe de séjour <span class="etiquette jaune">Paramètre daté</span></h3>
        <p class="aide">${esc(B.sourceTaxe)}</p>
        <div class="rang-champs">
          <label class="champ">Tarif par défaut, par personne et par nuit (€)<small>Pour les logements sans tarif propre.</small><input name="taxeDefaut" inputmode="decimal" value="${R.saisieMontant(g.taxeDefaut)}" placeholder="À renseigner"></label>
          <label class="champ">Tarif vérifié le<input type="date" name="verifieLe" value="${g.verifieLe || ''}"></label>
        </div>
        <label class="case"><input type="checkbox" name="exonererMineurs" ${g.exonererMineurs ? 'checked' : ''}> Exonérer les mineurs (les enfants ne sont pas comptés)</label>
        <details class="champs-aide"><summary>Repères et sources</summary><ul>${B.reperes.map(([t2, d]) => `<li><b>${esc(t2)}</b> : ${esc(d)}</li>`).join('')}${B.sources.map(([lb, u]) => `<li>${esc(lb)}<br><small>${esc(u)}</small></li>`).join('')}</ul></details>
      </div>
      <div class="groupe"><h3>Acompte et solde</h3>
        <div class="rang-champs">
          <label class="champ">Acompte à la réservation (%)<input name="acomptePct" inputmode="decimal" value="${R.saisiePct(g.acomptePct)}"></label>
          <label class="champ">Solde attendu (jours avant l'arrivée)<small>0 : le jour de l'arrivée.</small><input type="number" name="soldeJours" min="0" max="120" value="${g.soldeJours}"></label>
        </div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Données des voyageurs</h3><p class="aide">Efface les noms et les notes des séjours terminés depuis longtemps : dates, nombres de personnes et montants restent pour tes statistiques et tes comptes. Les durées de conservation qui s'imposent à toi sont à vérifier.</p>
        <div class="rang"><label class="champ" style="flex:0 1 220px">Terminés depuis plus de (mois)<input type="number" id="anciens" min="1" max="120" value="12"></label><button type="button" class="btn petit" data-action="effacer-anciens" style="align-self:flex-end">Effacer ces voyageurs</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte tes réservations en tableur (CSV) pour ta comptabilité ou ta déclaration de taxe.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Tes réservations et les noms de tes voyageurs sont enregistrés en ligne, liés à ta clé, et ne sont ni lus ni partagés par QME. Tu es responsable des données de tes voyageurs : garde le minimum et efface ce qui ne sert plus.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucune plateforme de réservation, aucun calendrier externe ni aucune banque n'est connecté : tu saisis tes réservations toi-même. Outil d'aide à la gestion, pas un conseil fiscal ; aucun régime d'imposition n'est calculé.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const tx = String(fd.get('taxeDefaut') || '').trim() ? R.lireMontant(fd.get('taxeDefaut')) : null;
      if (String(fd.get('taxeDefaut') || '').trim() && tx === null) return 'Tarif de taxe illisible : écris par exemple 1,00.';
      const ac = R.lirePct(fd.get('acomptePct'));
      if (ac === null) return 'Acompte illisible : écris un pourcentage, par exemple 30.';
      const sj = Math.round(Number(fd.get('soldeJours')));
      if (!(sj >= 0 && sj <= 120)) return 'Le délai du solde va de 0 à 120 jours.';
      E.activite = String(fd.get('activite') || '').trim();
      Object.assign(E.reglages, { taxeDefaut: tx, exonererMineurs: !!fd.get('exonererMineurs'), acomptePct: ac, soldeJours: sj, verifieLe: R.estDate(fd.get('verifieLe')) ? fd.get('verifieLe') : E.reglages.verifieLe });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.reservations) || !Array.isArray(d.logements)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.logements.length, 'logement')}, ${pluriel(d.reservations.length, 'réservation')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de ton calendrier.'); }
    });
  }

  function effacerAnciens() {
    const mois = Math.round(Number($('#anciens')?.value));
    if (!(mois >= 1 && mois <= 120)) { toast('Indique un nombre de mois entre 1 et 120.'); return; }
    const d = new Date(); d.setMonth(d.getMonth() - mois);
    const avant = R.iso(d);
    const n = E.reservations.filter((r) => r.depart < avant && !r.efface).length;
    if (!n) { toast('Aucun séjour terminé avant cette date à effacer.'); return; }
    if (!confirm(`Effacer le nom et les notes de ${pluriel(n, 'séjour terminé', 'séjours terminés')} avant le ${fmt(avant)} ?`)) return;
    retenir();
    E = R.effacerAnciens(E, avant).etat;
    sauver(); rendre(); modale().close();
    toast(`${pluriel(n, 'voyageur effacé', 'voyageurs effacés')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `location-saisonniere-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E, auj()), 'text/csv;charset=utf-8', `reservations-${auj()}.csv`);

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
    const t = auj();
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-logement': if (accueil.logements.length < R.MAX_LOGEMENTS) { accueil.logements.push({ nom: '', capacite: 4, menage: '' }); ecranAccueil(); } break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouvelle': modaleReservation(null); break;
      case 'nouvelle-date': modaleReservation(null, { logementId: el.dataset.logement, date: el.dataset.date }); break;
      case 'ouvrir': modaleDetail(id); break;
      case 'modifier': modaleReservation(id); break;
      case 'paiement': modalePaiement(id); break;
      case 'solder': { const r = resa(id); if (!r) break; const reste = Math.max(0, R.aRecevoir(r, E) - R.recu(r, t)); if (!reste) break; retenir(); r.paiements.push({ id: uid(), date: t, montant: reste, note: 'Solde' }); sauver(); rendre(); modaleDetail(id); toast('Séjour soldé aujourd\'hui.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'suppr-paiement': { const r = resa(id); if (!r) break; retenir(); r.paiements = r.paiements.filter((p) => p.id !== el.dataset.p); sauver(); rendre(); modaleDetail(id); toast('Paiement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'menage-fait': { const r = resa(id); if (!r) break; retenir(); r.menageFait = r.menageFait ? null : t; sauver(); rendre(); if (modale().open) modaleDetail(id); toast(r.menageFait ? `Ménage fait : ${nomLogement(r.logement)}.` : 'Ménage remis à faire.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'effacer-voyageur': { const r = resa(id); if (!r || !confirm(`Effacer le nom « ${nomVoyageur(r)} » et les notes de cette réservation ? Dates et montants restent.`)) break; retenir(); E = R.effacerVoyageur(E, id); sauver(); rendre(); modaleDetail(id); toast('Voyageur effacé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'effacer-anciens': effacerAnciens(); break;
      case 'logement': modaleLogement(id); break;
      case 'nouveau-logement': modaleLogement(null); break;
      case 'canal': modaleCanal(id); break;
      case 'nouveau-canal': modaleCanal(null); break;
      case 'mois': moisCal = el.dataset.n === '0' ? R.debutMois(t) : R.moisSuivant(moisCal, Number(el.dataset.n)); rendre(); break;
      case 'annee': anneeRev += Number(el.dataset.n); rendre(); break;
      case 'filtre': filtre.statut = el.dataset.statut; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('resize', () => { if (vue === 'calendrier' && $('#cal-defile')) centrerAujourdhui(); });
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
  window.__location = { etat: () => E, regles: R };
  init();
})();
