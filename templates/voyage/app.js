// Planificateur de voyage QME : itinéraire par étapes, nuits, transports, activités jour par jour,
// budget prévu et réel, dépenses partagées et qui doit quoi, bagages et documents à prévoir.
// Données synchronisées par clé de licence ou code d'accès. Aucune réservation ni plateforme connectée.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.VYG;
  const API = '/api/templates';
  const PRODUIT = 'VYG';
  const CLE_CODE = 'qme-vyg-code';
  const CLE_CACHE = 'qme-vyg-cache';
  const CLE_DEMO = 'qme-vyg-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-vyg-ecran-accueil';

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
  const { ajout, versDate, euros } = R;
  const eur0 = (c) => `${String(Math.round(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
  const auj = () => R.iso(new Date());
  const maintenant = () => new Date().toISOString();
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : 'sans date');
  const dateLongue = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const dateJour = (s) => fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const nuitsTxt = (n) => pluriel(n, 'nuit');
  const libMode = (id) => R.libMode(B.modes, id);
  const poste = (id) => B.postes.find((p) => p.id === id) || B.postes.at(-1);

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  let ongletBudget = 'postes';
  let filtrePoste = '';
  let annulation = null;

  const normaliser = (d) => R.normaliser(d, B.postes);
  const voyageur = (id) => E.voyageurs.find((v) => v.id === id);
  const nomVoyageur = (id) => voyageur(id)?.nom || 'Voyageur retiré';
  const COLL = { etape: 'etapes', nuit: 'nuits', transport: 'transports', activite: 'activites', depense: 'depenses', virement: 'virements', bagage: 'bagages', document: 'documents', voyageur: 'voyageurs' };
  const trouver = (type, id) => E[COLL[type]].find((x) => x.id === id);
  const toucher = (x) => { x.modifLe = maintenant(); return x; };
  function supprimer(type, id) {
    E[COLL[type]] = E[COLL[type]].filter((x) => x.id !== id);
    E.supprimes[id] = maintenant();
  }

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    const t = maintenant();
    const courant = E;
    E = annulation; annulation = null;
    // Ce qui revient ou redevient comme avant est re-daté, pour l'emporter à la fusion avec un autre
    // appareil ; ce qui avait été ajouté entre-temps est marqué supprimé.
    for (const c of R.COLLECTIONS) {
      for (const x of E[c]) { const y = courant[c].find((z) => z.id === x.id); if (!y || JSON.stringify(x) !== JSON.stringify(y)) x.modifLe = t; }
      for (const y of courant[c]) if (!E[c].some((x) => x.id === y.id)) E.supprimes[y.id] = t;
    }
    for (const o of ['voyage', 'budget']) if (JSON.stringify(E[o]) !== JSON.stringify(courant[o])) E[o].modifLe = t;
    sauver(); rendre();
    if (modale().open) modale().close();
    toast('Modification annulée.');
  }
  const annulable = (texte) => toast(texte, { libelle: 'Annuler', faire: annuler });

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
        // Un autre appareil (un autre voyageur) a écrit entre-temps : on fusionne, rien n'est perdu.
        const f = R.fusionner(E, corps.donnees);
        E = normaliser(f.etat);
        session.base = corps.donnees.majLe;
        cache(true);
        if (!modale().open) rendre();
        aRenvoyer = true;
        toast('Un autre appareil a modifié le voyage : les deux versions ont été réunies.');
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
  // Code interne (VYG-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Un voyage fictif de 10 jours entre amis, commencé il y a 3 jours : tous les états visibles
  // (nuit sans toit, hébergement et train à réserver, reste à payer sur place, poste dépassé, dépense
  // partagée à parts inégales, remboursement déjà fait, bagages en partie cochés, un voyage archivé).
  function donneesDemo() {
    const e = R.etatVide();
    const t = auj();
    const j = (n) => ajout(t, n);
    e.voyage = { nom: 'Lacs et villes d\'Italie du Nord', destination: 'Italie du Nord (exemple fictif)', debut: j(-3), fin: j(6), note: 'Voyage entre amis, données inventées pour la démonstration.', modifLe: '' };
    const [alex, sam, camille, noe] = ['Alex', 'Sam', 'Camille', 'Noé'].map((nom) => R.normaliserVoyageur({ id: uid(), nom }));
    e.voyageurs = [alex, sam, camille, noe];
    const et = (lieu, a, d, note = '') => R.normaliserEtape({ id: uid(), lieu, arrivee: j(a), depart: j(d), note });
    e.etapes = [et('Turin', -3, -1), et('Lac de Côme', -1, 2, 'Village au bord du lac, voiture conseillée.'), et('Vérone', 2, 4), et('Venise', 4, 6)];
    const h = (nom, adresse, a, d, statut, montant, acompte, solde = false, note = '') => R.normaliserNuit({ id: uid(), nom, adresse, arrivee: j(a), depart: j(d), statut, montant, acompte, solde, note });
    const hTurin = h('Appartement près du centre (fictif)', 'Rue des Arcades 12, Turin (adresse fictive)', -3, -1, 'reserve', 24000, 24000, true);
    const hLac = h('Maison au bord du lac (fictive)', 'Chemin du Port 3 (adresse fictive)', -1, 2, 'reserve', 54000, 16000, false, 'Solde à régler à l\'arrivée, clés chez la voisine.');
    const hVerone = h('Chambre d\'hôtes B (fictive)', 'Vieille ville de Vérone', 2, 3, 'reserve', 13000, 4000);
    const hVenise = h('Hôtel à choisir', 'Près d\'un arrêt de bateau-bus', 4, 6, 'aReserver', 38000, 0);
    e.nuits = [hTurin, hLac, hVerone, hVenise];
    const tr = (n, heure, mode, de, vers, statut, prix, ref = '') => R.normaliserTransport({ id: uid(), date: j(n), heure, mode, de, vers, statut, prix, ref });
    const trAller = tr(-3, '07:12', 'train', 'Lyon', 'Turin', 'reserve', 23200, 'AB12CD (fictive)');
    const trVoiture = tr(-1, '10:00', 'voiture', 'Turin', 'Lac de Côme', 'reserve', 18000, 'Location 5 jours');
    e.transports = [trAller, trVoiture, tr(2, '09:30', 'voiture', 'Lac de Côme', 'Vérone', 'reserve', 0, 'Rendre la voiture à Vérone'), tr(4, '11:05', 'train', 'Vérone', 'Venise', 'aReserver', 4800), tr(6, '16:45', 'train', 'Venise', 'Lyon', 'aReserver', 26000)];
    const ac = (n, heure, titre, lieu, statut, prix, note = '') => R.normaliserActivite({ id: uid(), date: n === null ? '' : j(n), heure, titre, lieu, statut, prix, note });
    const musee = ac(-2, '10:00', 'Musée d\'archéologie', 'Turin', 'reserve', 7200);
    const bateau = ac(0, '09:30', 'Tour du lac en bateau', 'Embarcadère du village', 'reserve', 6400);
    e.activites = [
      ac(-3, '18:00', 'Balade dans le centre historique', 'Turin', 'libre', 0), musee, ac(-2, '15:30', 'Montée au panorama', 'Colline', 'libre', 0),
      bateau, ac(0, '19:30', 'Dîner au village', '', 'libre', 0), ac(1, '09:00', 'Randonnée au-dessus du lac', 'Sentier balisé, 3 h', 'libre', 0),
      ac(1, '16:00', 'Villa et jardins', 'Rive ouest', 'aReserver', 4800, 'Créneaux limités, réserver la veille.'),
      ac(3, '20:30', 'Spectacle en plein air', 'Vérone', 'aReserver', 14000), ac(5, '09:00', 'Basilique et palais', 'Venise', 'aReserver', 12000),
      ac(5, '14:30', 'Les îles en bateau-bus', 'Venise', 'libre', 0), ac(null, '', 'Cours de cuisine', '', 'libre', 0, 'Idée à placer si un après-midi se libère.'),
    ];
    e.budget = { prevus: { repas: 60000, courses: 12000, surplace: 8000, assurance: 6000, achats: 2000, divers: 5000 }, modifLe: '' };
    const tous = e.voyageurs.map((v) => v.id);
    const dep = (n, libelle, montant, posteId, payeur, repartition = { mode: 'egale', participants: tous }, lien = '') => R.normaliserDepense({ id: uid(), date: j(n), libelle, montant, poste: posteId, payeur: payeur.id, repartition, lien }, e.voyageurs, B.postes);
    e.depenses = [
      dep(-40, 'Assurance annulation du groupe', 6000, 'assurance', alex),
      dep(-30, hTurin.nom, 24000, 'hebergement', alex, undefined, hTurin.id),
      dep(-30, 'Lyon → Turin', 23200, 'transport', sam, undefined, trAller.id),
      dep(-25, 'Acompte de la maison du lac', 16000, 'hebergement', alex),
      dep(-20, 'Location de voiture', 18000, 'transport', camille, undefined, trVoiture.id),
      dep(-3, 'Dîner en terrasse', 8600, 'repas', sam),
      dep(-2, musee.titre, 7200, 'activites', noe, undefined, musee.id),
      dep(-2, 'Déjeuner', 5400, 'repas', camille),
      dep(-2, 'Dîner', 11200, 'repas', alex),
      dep(-2, 'Souvenirs', 2500, 'achats', camille, { mode: 'egale', participants: [camille.id] }),
      dep(-1, 'Courses pour la maison', 6800, 'courses', noe),
      dep(-1, 'Essence et péage', 4500, 'surplace', camille),
      dep(0, bateau.titre, 6400, 'activites', sam, undefined, bateau.id),
      dep(0, 'Glaces', 1400, 'repas', noe, { mode: 'parts', participants: [noe.id, camille.id], parts: { [noe.id]: 1, [camille.id]: 1 } }),
      dep(-1, 'Pique-nique', 3900, 'repas', sam),
    ];
    e.virements = [R.normaliserVirement({ id: uid(), date: j(-1), de: noe.id, a: alex.id, montant: 5000 })];
    e.bagages = R.genererBagages(B.bagages, [], ['essentiels', 'ville', 'montagne', 'voiture']);
    e.bagages.forEach((b, i) => { b.fait = i % 9 !== 4; });
    e.bagages.find((b) => b.texte === 'Permis de conduire').qui = camille.id;
    e.documents = R.genererDocuments(B.documents);
    e.documents.forEach((d, i) => { d.fait = ![6, 8].includes(i); });
    e.documents[8].fait = false;
    e.archives = [{ id: uid(), nom: 'Week-end à la mer (exemple fictif)', debut: j(-120), fin: j(-118), voyageurs: 2, prevu: 42000, reel: 45500, modifLe: '' }];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Planificateur de voyage · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="440" cy="80" r="56" fill="#F5B400"/>
          <path d="M20 280 L150 90 L280 280 Z" fill="#1D4E89"/>
          <path d="M200 280 L300 150 L400 280 Z" fill="#D9302A"/>
          <path d="M60 60 C 160 20, 260 110, 380 60" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="60" cy="60" r="12" fill="#141414"/>
          <rect x="420" y="190" width="100" height="90" fill="#F0EDE6"/>
          <rect x="450" y="170" width="40" height="20" fill="none" stroke="#141414" stroke-width="4"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Planificateur de voyage</p>
          <h1>Le voyage tient dans ta poche.</h1>
          <p>Les étapes, chaque nuit, les activités jour par jour, le budget prévu et réel, et au retour, qui doit quoi à qui.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton voyage</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton voyage est enregistré en ligne et te suit sur tous tes appareils : partage la clé avec tes compagnons de route pour voir les mêmes données.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon voyage</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/voyage/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon voyage'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', destination: '', debut: '', fin: '', voyageurs: ['', ''], listes: ['essentiels'] });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Où part-on ?</h1>
        <p class="intro">Donne un nom au voyage, ses dates et les voyageurs. Tu ajouteras ensuite les étapes, les nuits, les transports et les activités : le programme jour par jour et le budget se construisent seuls. Rien n'est réservé à ta place.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Nom du voyage<input id="a-nom" value="${esc(a.nom)}" maxlength="80" placeholder="Ex. : Road trip d'été"></label>
          <label class="champ">Destination <small>Facultatif.</small><input id="a-destination" value="${esc(a.destination)}" maxlength="80"></label>
        </div>
        <div class="rang-champs" style="max-width:720px;margin-top:12px">
          <label class="champ">Départ<input type="date" id="a-debut" value="${esc(a.debut)}"></label>
          <label class="champ">Retour<input type="date" id="a-fin" value="${esc(a.fin)}"></label>
        </div>
        <h2 class="titre-section">Les voyageurs <span>Un prénom par personne : les dépenses se partagent entre eux. Seul(e) ? Un seul prénom suffit.</span></h2>
        <ol class="voyageurs-accueil">${a.voyageurs.map((v, i) => `<li><span class="palier-num">${i + 1}</span><label class="champ"><span class="sr-only">Voyageur ${i + 1}</span><input data-va="${i}" value="${esc(v)}" maxlength="40" placeholder="Prénom"></label></li>`).join('')}</ol>
        ${a.voyageurs.length < R.MAX_VOYAGEURS ? '<div class="rang" style="margin-top:10px"><button class="btn petit" data-action="accueil-voyageur">+ Ajouter un voyageur</button></div>' : ''}
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Quel genre de séjour ?</h1>
        <p class="intro">Coche ce qui ressemble à ton voyage : les listes de bagages correspondantes sont préparées (tu pourras ajouter, retirer et cocher chaque élément). Les documents à prévoir sont ajoutés aussi.</p>
        <div class="choix-types" style="margin-top:20px">${B.bagages.map((l) => `<label class="type-sejour"><input type="checkbox" data-liste="${l.id}" ${a.listes.includes(l.id) ? 'checked' : ''} ${l.id === 'essentiels' ? 'disabled' : ''}><span><b>${esc(l.nom)}</b><small>${pluriel(l.items.length, 'élément')} : ${esc(l.items.slice(0, 3).join(', '))}…</small></span></label>`).join('')}</div>
        <p class="aide" style="max-width:720px;margin-top:16px">Formalités (papiers, visa, santé) : rien n'est intégré, elles dépendent du pays et changent. Vérifie-les sur les sources officielles, rappelées dans l'onglet Préparer.</p>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon voyage</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['nom', 'destination', 'debut', 'fin']) $(`#a-${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
    document.querySelectorAll('[data-va]').forEach((el) => el.addEventListener('input', () => { accueil.voyageurs[Number(el.dataset.va)] = el.value; }));
    document.querySelectorAll('[data-liste]').forEach((el) => el.addEventListener('change', () => {
      accueil.listes = el.checked ? [...new Set([...accueil.listes, el.dataset.liste])] : accueil.listes.filter((x) => x !== el.dataset.liste);
    }));
  }

  function erreurAccueil(m) { const p = $('#erreur-accueil'); if (p) p.textContent = m; }
  function accueilSuivant() {
    if (!accueil.nom.trim() && !accueil.destination.trim()) return erreurAccueil('Donne un nom ou une destination au voyage.');
    if (!R.estDate(accueil.debut) || !R.estDate(accueil.fin)) return erreurAccueil('Indique les dates de départ et de retour.');
    if (accueil.fin < accueil.debut) return erreurAccueil('Le retour est avant le départ.');
    if (R.ecart(accueil.debut, accueil.fin) > 365) return erreurAccueil('Un voyage dure au plus un an.');
    if (!accueil.voyageurs.some((v) => v.trim())) return erreurAccueil('Indique au moins un voyageur.');
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    E = R.etatVide();
    const t = maintenant();
    E.voyage = { nom: accueil.nom.trim() || accueil.destination.trim(), destination: accueil.destination.trim(), debut: accueil.debut, fin: accueil.fin, note: '', modifLe: t };
    E.voyageurs = accueil.voyageurs.filter((v) => v.trim()).map((nom) => R.normaliserVoyageur({ nom: nom.trim(), modifLe: t }));
    E.bagages = R.genererBagages(B.bagages, [], [...new Set(['essentiels', ...accueil.listes])]);
    E.documents = R.genererDocuments(B.documents);
    accueil = accueilVide();
    vue = 'itineraire';
    sauver();
    demarrer();
    toast('Ton voyage est créé. Ajoute ta première étape.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    itineraire: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="18" r="3" fill="currentColor"/><circle cx="19" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 16 L17 8" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/></svg>',
    jours: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="8" height="4" fill="currentColor"/><rect x="13" y="10" width="8" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    preparer: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" fill="currentColor"/><rect x="9" y="3" width="6" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['itineraire', 'Itinéraire'], ['jours', 'Jour par jour'], ['budget', 'Budget'], ['preparer', 'Préparer']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation : ce n\'est ni une agence ni un conseil financier. Aucune réservation n\'est faite et aucune plateforme n\'est connectée ; les montants sont ceux de ta saisie, en euros (convertis toi-même les dépenses en devise). Les remboursements entre voyageurs sont une proposition de calcul : vérifiez-les ensemble. Formalités (papiers, visa, santé) : vérifie-les sur les sources officielles.</p>';
  const COULEUR_STATUT = { aReserver: 'jaune', reserve: 'vert', libre: 'sable', sans: 'rouge', double: 'rouge' };
  const etiquetteStatut = (s) => `<span class="etiquette ${COULEUR_STATUT[s]}">${s === 'sans' ? 'Sans toit' : s === 'double' ? 'En double' : R.LIB_STATUT[s]}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/voyage/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Planificateur<br>de voyage</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages, voyageurs et sauvegarde" title="Réglages">${ICONES.reglages}</button>
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
    document.title = `${titres[vue]} · ${E.voyage.nom || 'Voyage'}`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { apercu: vueApercu, itineraire: vueItineraire, jours: vueJours, budget: vueBudget, preparer: vuePreparer }[vue]();
    brancherInfobulles();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><path d="M0 96 L36 30 L72 96Z" fill="#1D4E89"/><path d="M40 96 L62 60 L90 96Z" fill="#D9302A"/><circle cx="76" cy="20" r="16" fill="#F5B400"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const bouton = (action, lib, cls = '', attrs = '') => `<button class="btn ${cls}" data-action="${action}" ${attrs}>${ICONES.plus}${lib}</button>`;
  const enTete = (titre, texte, actions = '') => `<div class="vue-tete"><div><h1>${titre}</h1>${texte ? `<p>${texte}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  const resumeVoyage = () => {
    const v = E.voyage;
    return [v.destination, v.debut ? `du ${fmt(v.debut, { day: 'numeric', month: 'long' })} au ${fmt(v.fin)}` : '', v.debut ? `${pluriel(R.nbJours(v), 'jour')}, ${nuitsTxt(R.nbNuits(v))}` : '', pluriel(E.voyageurs.length, 'voyageur')].filter(Boolean).map(esc).join(' · ');
  };

  // Lignes communes ----------------------------------------------------------
  function ligneNuit(h) {
    const reste = R.resteAPayer(h);
    return `<li class="ligne-fac st-${h.statut}"><button class="ligne-info" data-action="nuit" data-id="${h.id}">
        <b>${esc(h.nom)}</b>
        <span class="ligne-detail">${h.arrivee ? `${dateCourte(h.arrivee)} → ${dateCourte(h.depart)} · ${nuitsTxt(R.nuitsHebergement(h))}` : 'Dates à préciser'}${h.adresse ? ` · ${esc(h.adresse)}` : ''}</span>
        <span class="ligne-etiquettes">${etiquetteStatut(h.statut)}${h.solde ? '<span class="etiquette vert">Soldé</span>' : ''}${R.depenseLiee(E, h.id) ? '<span class="etiquette ciel">Dans les dépenses</span>' : ''}</span></button>
      <div class="ligne-droite"><span class="ligne-cout"><b>${h.montant ? euros(h.montant) : '–'}</b><small>${h.statut === 'reserve' ? (reste ? `reste ${euros(reste)} sur place` : 'rien à payer sur place') : 'prix estimé'}</small></span></div></li>`;
  }
  function ligneTransport(t) {
    return `<li class="ligne-fac st-${t.statut}"><button class="ligne-info" data-action="transport" data-id="${t.id}">
        <b>${esc(t.de || '?')} → ${esc(t.vers || '?')}</b>
        <span class="ligne-detail">${t.date ? dateJour(t.date) : 'Sans date'}${t.heure ? ` · ${t.heure}` : ''} · ${esc(libMode(t.mode))}${t.ref ? ` · réf. ${esc(t.ref)}` : ''}</span>
        <span class="ligne-etiquettes">${etiquetteStatut(t.statut)}${R.depenseLiee(E, t.id) ? '<span class="etiquette ciel">Dans les dépenses</span>' : ''}</span></button>
      <div class="ligne-droite"><span class="ligne-cout"><b>${t.prix ? euros(t.prix) : '–'}</b><small>${t.statut === 'reserve' ? 'réservé' : 'prix estimé'}</small></span></div></li>`;
  }
  function puceActivite(a) {
    return `<li class="activite st-${a.statut}"><span class="heure">${a.heure || '—'}</span>
      <button class="lien-ligne" data-action="activite" data-id="${a.id}"><b>${esc(a.titre)}</b><span>${[a.lieu, a.prix ? euros(a.prix) : '', a.note].filter(Boolean).map(esc).join(' · ')}</span></button>
      ${a.statut !== 'libre' ? etiquetteStatut(a.statut) : ''}</li>`;
  }
  function puceTransport(t) {
    return `<li class="activite transport-jour"><span class="heure">${t.heure || '—'}</span>
      <button class="lien-ligne" data-action="transport" data-id="${t.id}"><b>${esc(libMode(t.mode))} · ${esc(t.de || '?')} → ${esc(t.vers || '?')}</b><span>${[t.ref ? `réf. ${t.ref}` : '', t.prix ? euros(t.prix) : ''].filter(Boolean).map(esc).join(' · ')}</span></button>
      ${etiquetteStatut(t.statut)}</li>`;
  }
  function carteJour(j, t, compacte = false) {
    const h = j.nuit.hebergements;
    const titreEtapes = j.etapes.map((e) => esc(e.lieu)).join(' → ');
    const items = [...j.transports.map(puceTransport), ...j.activites.map(puceActivite)];
    const nuit = j.nuit.dernier ? '<p class="nuit-ligne retour">Dernier jour : retour.</p>'
      : `<p class="nuit-ligne ${h.length ? '' : 'sans'}"><span>Nuit</span>${h.length ? h.map((x) => `<button class="btn lien" data-action="nuit" data-id="${x.id}">${esc(x.nom)}</button> ${etiquetteStatut(x.statut)}`).join(' ') : `<b>Pas encore d'hébergement</b> <button class="btn lien" data-action="nouvelle-nuit" data-date="${j.date}">Ajouter</button>`}</p>`;
    return `<article class="jour ${j.date === t ? 'aujourdhui' : ''} ${j.date < t ? 'passe' : ''}" id="jour-${j.date}">
      <header class="jour-tete"><span class="date-pastille ${j.date === t ? 'jaune' : ''}"><b>${versDate(j.date).getDate()}</b>${fmt(j.date, { month: 'short' }).replace('.', '')}</span>
        <div><p class="surtitre">Jour ${j.numero}${j.date === t ? ' · aujourd\'hui' : ''}</p><h3>${dateLongue(j.date)}</h3>${titreEtapes ? `<p class="jour-etapes">${titreEtapes}</p>` : ''}</div></header>
      ${items.length ? `<ul class="activites">${items.join('')}</ul>` : '<p class="mention">Rien de prévu : journée libre.</p>'}
      ${nuit}
      ${compacte ? '' : `<div class="rang"><button class="btn petit" data-action="nouvelle-activite" data-date="${j.date}">${ICONES.plus}Activité</button><button class="btn petit" data-action="nouveau-transport" data-date="${j.date}">${ICONES.plus}Transport</button></div>`}
    </article>`;
  }

  // ---------- Aperçu ----------
  function alertes() {
    const res = [];
    const n = R.resumeNuits(E);
    const sans = n.detail.filter((x) => x.statut === 'sans');
    if (sans.length) res.push(`<li><b>${pluriel(sans.length, 'nuit')} sans hébergement</b> : ${sans.map((x) => `<button class="btn lien" data-action="nouvelle-nuit" data-date="${x.date}">${dateJour(x.date)}</button>`).join(', ')}</li>`);
    const dbl = n.detail.filter((x) => x.statut === 'double');
    if (dbl.length) res.push(`<li><b>Deux hébergements la même nuit</b> : ${dbl.map((x) => dateJour(x.date)).join(', ')}. Vérifie qu'il ne s'agit pas d'un doublon.</li>`);
    const hors = R.horsVoyage(E);
    if (hors.length) res.push(`<li><b>Hébergement hors des dates du voyage</b> : ${hors.map((h) => `<button class="btn lien" data-action="nuit" data-id="${h.id}">${esc(h.nom)}</button>`).join(', ')}</li>`);
    if (R.etapesChevauchantes(E).length) res.push('<li><b>Étapes qui se chevauchent</b> : deux étapes partagent une nuit. Vérifie leurs dates dans l\'itinéraire.</li>');
    return res.length ? `<div class="alerte-conflit" role="note"><b>À vérifier</b><ul>${res.join('')}</ul></div>` : '';
  }

  function vueApercu() {
    const t = auj();
    const v = E.voyage;
    const ph = R.phase(v, t);
    const n = R.resumeNuits(E);
    const ar = R.aReserver(E, t);
    const b = R.budget(E, B.postes);
    const pb = R.progression(E.bagages), pd = R.progression(E.documents);
    const rembours = R.quiDoitQuoi(E);
    const bandeau = {
      avant: `<p class="phase"><b>J−${ph.joursAvant}</b><span>avant le départ</span></p>`,
      pendant: `<p class="phase en-cours"><b>Jour ${ph.jour}</b><span>sur ${ph.total}</span></p>`,
      apres: '<p class="phase fini"><b>Terminé</b><span>place aux comptes</span></p>',
      sansDates: '',
    }[ph.etat];
    const jourMontre = ph.etat === 'pendant' ? t : ph.etat === 'avant' ? v.debut : null;
    const jours = jourMontre ? [R.programmeJour(E, jourMontre)] : [];
    if (ph.etat === 'pendant' && t < v.fin) jours.push(R.programmeJour(E, ajout(t, 1)));
    const tuiles = `<div class="tuiles">
      <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Nuits réservées</p><b>${n.reserve} / ${n.total}</b><span>${[n.aReserver ? `${n.aReserver} à réserver` : '', n.sans ? `${n.sans} sans toit` : ''].filter(Boolean).join(' · ') || 'toutes couvertes'}</span></div>
      <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">À réserver</p><b>${ar.length}</b><span>${ar.filter((x) => x.urgent).length ? `dont ${ar.filter((x) => x.urgent).length} sous ${R.URGENT_JOURS} jours` : 'rien d\'urgent'}</span></div>
      <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Dépensé</p><b>${eur0(b.reel)}</b><span>sur ${eur0(b.prevu)} prévus · ${eur0(b.parPersonneReel)} / pers.</span></div>
      <div class="tuile rond" style="--c:var(--vert)"><p class="surtitre">Préparation</p><b>${pb.pct} %</b><span>des bagages · documents ${pd.fait}/${pd.total}</span></div>
    </div>`;
    return `${enTete(esc(v.nom || 'Mon voyage'), resumeVoyage(), `<button class="btn petit" data-action="voyage">Modifier le voyage</button><button class="btn petit" data-action="copier-itineraire">Copier l'itinéraire</button>`)}
      ${bandeau}
      ${R.cheminTexte(E, B.modes) ? `<p class="chemin">${esc(R.cheminTexte(E, B.modes))}</p>` : ''}
      ${tuiles}
      ${alertes()}
      ${E.etapes.length || E.nuits.length ? '' : `<div style="margin-top:24px">${videEtat('Le voyage est vide', 'Commence par les étapes (où dors-tu, combien de nuits), puis les hébergements et les transports entre deux étapes.', bouton('nouvelle-etape', 'Ajouter une étape', 'primaire'))}</div>`}
      <div class="colonnes-apercu">
        <div>
          ${jours.length ? `<h2 class="titre-section">${ph.etat === 'pendant' ? 'Aujourd\'hui et demain' : 'Le premier jour'}</h2><div class="jours">${jours.map((j) => carteJour(j, t, true)).join('')}</div>` : ''}
          ${ph.etat === 'apres' ? `<h2 class="titre-section">Le voyage est fini</h2><p class="intro">Saisis les dernières dépenses, réglez les remboursements, puis archive le voyage dans les Réglages pour en préparer un autre (tes listes de bagages sont gardées).</p>` : ''}
        </div>
        <div>
          <h2 class="titre-section">À réserver <span>${ar.length ? 'du plus proche au plus lointain' : ''}</span></h2>
          ${ar.length ? `<ul class="prochains">${ar.slice(0, 7).map((x) => `<li><span class="date-pastille ${x.urgent ? 'retard' : ''}"><b>${x.date ? versDate(x.date).getDate() : '?'}</b>${x.date ? fmt(x.date, { month: 'short' }).replace('.', '') : ''}</span><button class="lien-ligne" data-action="${x.type}" data-id="${x.id}"><b>${esc(x.titre)}</b><span>${{ nuit: 'Hébergement', transport: 'Transport', activite: 'Activité' }[x.type]}${x.montant ? ` · ${euros(x.montant)}` : ''}${x.urgent && x.joursAvant !== null ? ` · ${x.joursAvant < 0 ? 'date passée' : x.joursAvant === 0 ? 'aujourd\'hui' : `dans ${pluriel(x.joursAvant, 'jour')}`}` : ''}</span></button><button class="btn petit" data-action="marquer-reserve" data-type="${x.type}" data-id="${x.id}">Réservé</button></li>`).join('')}</ul>${ar.length > 7 ? `<p class="mention" style="margin-top:8px">Et ${ar.length - 7} autre(s) dans l'itinéraire et le jour par jour.</p>` : ''}` : '<div class="vide-etat petit"><h3>Tout est réservé</h3><p>Rien n\'attend de réservation dans ton plan.</p></div>'}
          ${R.aPayer(E).length ? `<h2 class="titre-section">À payer sur place</h2><ul class="prochains">${R.aPayer(E).map((x) => `<li><span class="date-pastille"><b>${x.date ? versDate(x.date).getDate() : '?'}</b>${x.date ? fmt(x.date, { month: 'short' }).replace('.', '') : ''}</span><button class="lien-ligne" data-action="nuit" data-id="${x.id}"><b>${esc(x.nom)}</b><span>Reste après acompte</span></button><span class="nb">${euros(x.reste)}</span></li>`).join('')}</ul>` : ''}
          <h2 class="titre-section">Qui doit quoi</h2>
          ${E.voyageurs.length < 2 ? '<p class="mention">Un seul voyageur : rien à partager.</p>' : rembours.length ? `<ul class="prochains">${rembours.map((x) => `<li><span class="pastille-rond"></span><span><b>${esc(nomVoyageur(x.de))}</b> doit <b>${euros(x.montant)}</b> à <b>${esc(nomVoyageur(x.a))}</b></span><button class="btn petit" data-action="rembourse" data-de="${x.de}" data-a="${x.a}" data-montant="${x.montant}">Fait</button></li>`).join('')}</ul>` : '<p class="mention">Personne ne doit rien : les comptes sont à zéro.</p>'}
        </div>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Itinéraire ----------
  function vueItineraire() {
    const t = auj();
    const etapes = R.trierEtapes(E.etapes);
    const n = R.resumeNuits(E);
    const nuits = [...E.nuits].sort((a, b) => (a.arrivee || '9').localeCompare(b.arrivee || '9'));
    const transports = [...E.transports].sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || (a.heure || '').localeCompare(b.heure || ''));
    const it = R.itineraire(E, B.modes);
    const actions = `${bouton('nouvelle-etape', 'Étape', 'primaire petit')}${bouton('nouvelle-nuit', 'Hébergement', 'petit')}${bouton('nouveau-transport', 'Transport', 'petit')}`;
    const fil = it.length ? `<ol class="fil">${it.map((x) => x.type === 'etape'
      ? `<li class="fil-etape"><span class="fil-point"></span><button class="lien-ligne" data-action="etape" data-id="${x.id}"><b>${esc(x.lieu)}</b><span>${dateCourte(x.date)} → ${dateCourte(x.depart)} · ${x.nuits ? nuitsTxt(x.nuits) : 'de passage'}${x.hebergements.length ? ` · ${x.hebergements.map((h) => esc(h.nom)).join(', ')}` : ''}</span></button></li>`
      : `<li class="fil-transport"><span class="fil-trait"></span><button class="lien-ligne" data-action="transport" data-id="${x.id}"><span>${esc(x.mode)} · ${dateCourte(x.date)}${x.heure ? ` à ${x.heure}` : ''} · ${esc(x.de || '?')} → ${esc(x.vers || '?')}</span></button>${etiquetteStatut(x.statut)}</li>`).join('')}</ol>` : '';
    return `${enTete('Itinéraire', resumeVoyage(), actions)}
      ${R.cheminTexte(E, B.modes) ? `<p class="chemin">${esc(R.cheminTexte(E, B.modes))}</p>` : ''}
      ${alertes()}
      <div class="colonnes-apercu">
        <div>
          <h2 class="titre-section">Étapes et trajets <span>${pluriel(etapes.length, 'étape')}</span></h2>
          ${etapes.length ? fil : videEtat('Aucune étape', 'Une étape est un lieu où tu dors une ou plusieurs nuits : sa date d\'arrivée et de départ.', bouton('nouvelle-etape', 'Ajouter une étape', 'primaire'))}
        </div>
        <div>
          <h2 class="titre-section">Nuit par nuit <span>${n.reserve} réservée(s) sur ${n.total}</span></h2>
          ${n.total ? `<div class="defile"><table class="tableau petit nuits-table"><thead><tr><th>Nuit</th><th>Étape</th><th>Hébergement</th><th>État</th></tr></thead><tbody>${n.detail.map((x) => `<tr class="${x.date < t ? 'passe' : ''}"><td class="nb">${dateJour(x.date)}</td><td>${x.etape ? esc(x.etape.lieu) : '<span class="mention">–</span>'}</td><td>${x.hebergements.length ? x.hebergements.map((h) => `<button class="btn lien" data-action="nuit" data-id="${h.id}">${esc(h.nom)}</button>`).join(' + ') : `<button class="btn lien" data-action="nouvelle-nuit" data-date="${x.date}">Ajouter</button>`}</td><td>${etiquetteStatut(x.statut)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mention">Indique les dates du voyage pour voir chaque nuit.</p>'}
        </div>
      </div>
      <h2 class="titre-section">Hébergements <span>${pluriel(E.nuits.length, 'hébergement')} · ${euros(E.nuits.reduce((s, h) => s + h.montant, 0))}</span></h2>
      ${nuits.length ? `<ul class="lignes-fac">${nuits.map(ligneNuit).join('')}</ul>` : '<p class="mention">Aucun hébergement : ajoute le lieu de chaque nuit, réservé ou à réserver.</p>'}
      <h2 class="titre-section">Transports <span>${pluriel(E.transports.length, 'trajet')} · ${euros(E.transports.reduce((s, x) => s + x.prix, 0))}</span></h2>
      ${transports.length ? `<ul class="lignes-fac">${transports.map(ligneTransport).join('')}</ul>` : '<p class="mention">Aucun transport : ajoute l\'aller, le retour et les trajets entre deux étapes.</p>'}
      ${AVERTISSEMENT}`;
  }

  // ---------- Jour par jour ----------
  function vueJours() {
    const t = auj();
    const p = R.programme(E);
    const hors = R.horsProgramme(E);
    const reste = [...hors.transports.map(puceTransport), ...hors.activites.map(puceActivite)];
    return `${enTete('Jour par jour', resumeVoyage(), `${bouton('nouvelle-activite', 'Activité', 'primaire petit')}<button class="btn petit" data-action="imprimer">Imprimer le programme</button><button class="btn petit" data-action="copier-itineraire">Copier en texte</button>`)}
      ${p.length ? `<div class="jours">${p.map((j) => carteJour(j, t)).join('')}</div>` : videEtat('Pas de dates', 'Indique les dates du voyage pour obtenir le programme jour par jour.', '<button class="btn primaire" data-action="voyage">Modifier le voyage</button>')}
      ${reste.length ? `<h2 class="titre-section">Sans date ou hors du voyage <span>À placer dans un jour</span></h2><ul class="activites hors">${reste.join('')}</ul>` : ''}
      ${AVERTISSEMENT}`;
  }

  // ---------- Budget ----------
  function vueBudget() {
    const b = R.budget(E, B.postes);
    const sous = [['postes', 'Prévu et réel'], ['depenses', 'Dépenses'], ['comptes', 'Qui doit quoi']];
    const nav = `<div class="filtres" role="group" aria-label="Partie du budget">${sous.map(([id, nom]) => `<button class="filtre" data-action="sous-budget" data-o="${id}" aria-pressed="${ongletBudget === id}">${nom}</button>`).join('')}</div>`;
    const corps = { postes: budgetPostes, depenses: budgetDepenses, comptes: budgetComptes }[ongletBudget](b);
    return `${enTete('Budget', `${eur0(b.reel)} dépensés sur ${eur0(b.prevu)} prévus · ${pluriel(E.voyageurs.length, 'voyageur')}`, `${bouton('nouvelle-depense', 'Dépense', 'primaire petit')}`)}
      ${nav}${corps}${AVERTISSEMENT}`;
  }

  function budgetPostes(b) {
    const max = Math.max(1, ...b.lignes.map((l) => Math.max(l.prevu, l.reel)));
    const lignes = b.lignes.filter((l) => l.prevu || l.reel);
    const graph = lignes.length ? `<figure class="graphique" aria-label="Prévu et réel par poste"><div class="barres-cats">${lignes.map((l) => `
      <div class="barre-cat ${l.depasse ? 'depasse' : ''}" tabindex="0" data-info="<b>${esc(l.nom)}</b>Prévu ${euros(l.prevu)}${l.duPlan ? ` (dont ${euros(l.duPlan)} du plan)` : ''}<br>Réel ${euros(l.reel)}<br>${l.ecart > 0 ? `Dépassement ${euros(l.ecart)}` : `Reste ${euros(-l.ecart)}`}">
        <span class="bc-nom">${esc(l.nom)}${l.depasse ? ' <span class="etiquette rouge">Dépassé</span>' : ''}</span>
        <span class="bc-piste"><span class="bc-prevu" style="width:${(l.prevu / max) * 100}%"></span><span class="bc-barre" style="width:${(l.reel / max) * 100}%"></span></span>
        <span class="bc-val">${eur0(l.reel)}<small>sur ${eur0(l.prevu)}</small></span>
      </div>`).join('')}</div>
      <p class="legende-cal"><span><span class="pastille-l"></span> Réel (dépenses saisies)</span><span><span class="pastille-l prevu"></span> Prévu (plan et montants saisis)</span></p>
      <div class="infobulle" hidden></div></figure>` : videEtat('Pas encore de budget', 'Ajoute des hébergements, des transports et des activités avec leur prix, ou saisis des montants prévus par poste.', '<button class="btn primaire" data-action="prevus">Saisir le prévu</button>');
    return `<div class="tuiles" style="margin-top:16px">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Prévu</p><b>${eur0(b.prevu)}</b><span>${eur0(b.parPersonnePrevu)} par personne</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Réel</p><b>${eur0(b.reel)}</b><span>${eur0(b.parPersonneReel)} par personne</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Écart</p><b>${b.ecart > 0 ? '+' : b.ecart < 0 ? '−' : ''}${eur0(Math.abs(b.ecart))}</b><span>${b.ecart > 0 ? 'au-dessus du prévu' : 'sous le prévu'}</span></div>
        <div class="tuile rond" style="--c:var(--vert)"><p class="surtitre">Déjà réservé</p><b>${eur0(b.engage)}</b><span>engagé dans le plan</span></div>
      </div>
      <div class="vue-tete" style="margin:28px 0 12px"><h2 class="titre-section" style="margin:0">Par poste</h2><div class="actions"><button class="btn petit" data-action="prevus">Modifier le prévu</button></div></div>
      ${graph}
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Réel</th><th class="nb">Écart</th></tr></thead><tbody>${b.lignes.map((l) => `<tr><td>${esc(l.nom)}</td><td class="nb">${euros(l.prevu)}</td><td class="nb">${euros(l.reel)}</td><td class="nb">${euros(l.ecart)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${euros(b.prevu)}</td><td class="nb">${euros(b.reel)}</td><td class="nb">${euros(b.ecart)}</td></tr><tr><td>Par personne</td><td class="nb">${euros(b.parPersonnePrevu)}</td><td class="nb">${euros(b.parPersonneReel)}</td><td></td></tr></tfoot></table></div></details>
      <p class="aide" style="margin-top:16px">Le prévu des transports, hébergements et activités vient du plan (prix de chaque élément) ; ajoute les autres postes (repas, courses…) avec « Modifier le prévu ». Le réel, ce sont les dépenses saisies.</p>`;
  }

  function budgetDepenses() {
    const liste = [...E.depenses].filter((d) => !filtrePoste || d.poste === filtrePoste).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.modifLe || '').localeCompare(a.modifLe || ''));
    const postesUtilises = B.postes.filter((p) => E.depenses.some((d) => d.poste === p.id));
    const filtres = `<div class="filtres" style="margin-top:12px" role="group" aria-label="Filtrer par poste"><button class="filtre" data-action="filtre-poste" data-p="" aria-pressed="${!filtrePoste}">Tous <small>${E.depenses.length}</small></button>${postesUtilises.map((p) => `<button class="filtre" data-action="filtre-poste" data-p="${p.id}" aria-pressed="${filtrePoste === p.id}">${esc(p.nom)} <small>${E.depenses.filter((d) => d.poste === p.id).length}</small></button>`).join('')}</div>`;
    const ligne = (d) => {
      const q = R.quotesDepense(d, E.voyageurs);
      const pour = Object.keys(q).filter((id) => q[id] > 0);
      return `<li class="ligne-fac"><button class="ligne-info" data-action="depense" data-id="${d.id}"><b>${esc(d.libelle)}</b>
        <span class="ligne-detail">${d.date ? dateJour(d.date) : 'Sans date'} · ${esc(poste(d.poste).nom)} · payé par ${esc(nomVoyageur(d.payeur))}</span>
        <span class="ligne-detail">Pour ${pour.length === E.voyageurs.length ? 'tout le monde' : pour.map((id) => esc(nomVoyageur(id))).join(', ')}${d.repartition.mode !== 'egale' ? ' (parts inégales)' : ''}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b>${euros(d.montant)}</b></span></div></li>`;
    };
    return `${filtres}
      <p class="resume-liste">${pluriel(liste.length, 'dépense')} · ${euros(liste.reduce((s, d) => s + d.montant, 0))}</p>
      ${liste.length ? `<ul class="lignes-fac">${liste.map(ligne).join('')}</ul>` : videEtat('Aucune dépense', 'Saisis chaque dépense pendant le voyage : qui a payé, combien, pour qui. Les éléments du plan (hébergements, transports, activités) s\'ajoutent aussi depuis leur fiche.', bouton('nouvelle-depense', 'Ajouter une dépense', 'primaire'))}
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv">Exporter en CSV</button></div>`;
  }

  function budgetComptes() {
    if (E.voyageurs.length < 2) return `<div style="margin-top:16px">${videEtat('Un seul voyageur', 'Ajoute tes compagnons de route dans les Réglages pour partager les dépenses et savoir qui doit quoi.', '<button class="btn primaire" data-action="reglages">Ouvrir les réglages</button>')}</div>`;
    const pv = R.parVoyageur(E);
    const rembours = R.quiDoitQuoi(E);
    const virements = [...E.virements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return `<h2 class="titre-section">Remboursements à faire <span>${rembours.length ? `${pluriel(rembours.length, 'virement')}, le minimum possible` : ''}</span></h2>
      ${rembours.length ? `<ul class="prochains">${rembours.map((x) => `<li><span class="pastille-rond"></span><span><b>${esc(nomVoyageur(x.de))}</b> doit <b>${euros(x.montant)}</b> à <b>${esc(nomVoyageur(x.a))}</b></span><button class="btn petit" data-action="rembourse" data-de="${x.de}" data-a="${x.a}" data-montant="${x.montant}">Marquer remboursé</button></li>`).join('')}</ul>` : '<div class="vide-etat petit"><h3>Les comptes sont à zéro</h3><p>Personne ne doit rien à personne.</p></div>'}
      <h2 class="titre-section">Par voyageur</h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Voyageur</th><th class="nb">A payé</th><th class="nb">Sa part</th><th class="nb">Solde</th></tr></thead><tbody>${pv.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${euros(x.paye)}</td><td class="nb">${euros(x.part)}</td><td class="nb"><b>${x.solde > 0 ? `on lui doit ${euros(x.solde)}` : x.solde < 0 ? `doit ${euros(-x.solde)}` : 'à zéro'}</b></td></tr>`).join('')}</tbody></table></div>
      <p class="aide" style="margin-top:12px">Le solde tient compte des remboursements déjà faits. Calcul identique au template Budget commun : répartition au centime, nombre minimal de virements.</p>
      <h2 class="titre-section">Remboursements faits <span>${pluriel(virements.length, 'virement')}</span></h2>
      ${virements.length ? `<ul class="journal">${virements.map((x) => `<li><span class="date-pastille"><b>${x.date ? versDate(x.date).getDate() : '?'}</b>${x.date ? fmt(x.date, { month: 'short' }).replace('.', '') : ''}</span><span>${esc(nomVoyageur(x.de))} → ${esc(nomVoyageur(x.a))} · <b>${euros(x.montant)}</b></span><button class="btn-suppr" data-action="suppr-virement" data-id="${x.id}" aria-label="Supprimer ce remboursement">×</button></li>`).join('')}</ul>` : '<p class="mention">Aucun remboursement enregistré.</p>'}
      <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="nouveau-virement">${ICONES.plus}Remboursement</button></div>`;
  }

  // ---------- Préparer ----------
  function vuePreparer() {
    const pb = R.progression(E.bagages), pd = R.progression(E.documents);
    const groupes = [...B.bagages.map((l) => [l.id, l.nom]), ['', 'Mes ajouts']];
    const caseHtml = (type) => (x) => `<li class="${x.fait ? 'fait' : ''}"><label class="case"><input type="checkbox" data-action="cocher" data-type="${type}" data-id="${x.id}" ${x.fait ? 'checked' : ''}><span><span class="t">${esc(x.texte)}</span>${x.qui ? ` <small class="etiquette ciel">${esc(nomVoyageur(x.qui))}</small>` : ''}${x.detail ? `<small class="detail">${esc(x.detail)}</small>` : ''}</span></label><button class="btn-suppr" data-action="modifier-case" data-type="${type}" data-id="${x.id}" aria-label="Modifier « ${esc(x.texte)} »">…</button></li>`;
    const bagages = groupes.map(([id, nom]) => {
      const l = E.bagages.filter((b) => b.liste === id || (!id && !B.bagages.some((x) => x.id === b.liste)));
      if (!l.length) return '';
      const p = R.progression(l);
      return `<section class="liste-cases"><h3>${esc(nom)} <span>${p.fait}/${p.total}</span></h3><ul>${l.map(caseHtml('bagage')).join('')}</ul></section>`;
    }).join('');
    const barre = (p) => `<span class="progres" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.pct}%"></i></span>`;
    return `${enTete('Préparer', 'Documents à prévoir et bagages, à cocher au fur et à mesure.', `${bouton('nouveau-bagage', 'Bagage', 'petit')}<button class="btn petit" data-action="listes">Ajouter une liste</button><button class="btn petit" data-action="decocher">Tout décocher</button>`)}
      <div class="colonnes-apercu">
        <div>
          <h2 class="titre-section">Bagages <span>${pb.fait}/${pb.total} · ${pb.pct} %</span></h2>${barre(pb)}
          ${E.bagages.length ? `<div class="grille-listes">${bagages}</div>` : videEtat('Aucune liste', 'Choisis un ou plusieurs types de séjour : la liste de bagages se prépare.', '<button class="btn primaire" data-action="listes">Ajouter une liste</button>')}
        </div>
        <div>
          <h2 class="titre-section">Documents à prévoir <span>${pd.fait}/${pd.total}</span></h2>${barre(pd)}
          <section class="liste-cases"><ul>${E.documents.map(caseHtml('document')).join('')}</ul>
          <div class="rang" style="margin-top:8px"><button class="btn petit" data-action="nouveau-document">${ICONES.plus}Document</button></div></section>
          <div class="rgpd"><h2>Formalités : les sources officielles</h2><p>Papiers acceptés, durée de validité, visa, vaccins et précautions de santé dépendent du pays et de ta nationalité, et changent : rien n'est intégré ici. Vérifie-les avant de réserver, puis de nouveau avant de partir.</p><ul class="sources">${B.sources.map(([lb, u]) => `<li>${esc(lb)}<br><small>${esc(u)}</small></li>`).join('')}</ul><p><small>Adresses vérifiées le ${fmt(B.sourcesVerifieesLe)}.</small></p></div>
        </div>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Infobulles ----------
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
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 6)}px`;
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
  const piedEdition = (existe, type) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${existe ? `<button class="btn danger gauche" type="button" data-action="supprimer" data-type="${type}" data-id="${existe}">Supprimer</button>` : ''}`;
  const choixStatut = (nom, valeur, liste = R.STATUTS) => `<fieldset class="champ"><legend>Statut</legend><div class="choix-statut ${liste.length === 2 ? 'deux' : ''}">${liste.map((s) => `<label><input type="radio" name="${nom}" value="${s}" ${valeur === s ? 'checked' : ''}><span>${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>`;
  const lireDate = (fd, k) => { const v = String(fd.get(k) || ''); return R.estDate(v) ? v : ''; };
  const enregistrer = (type, el, existe, message) => {
    retenir();
    toucher(el);
    if (existe) Object.assign(trouver(type, existe), el);
    else E[COLL[type]].push(el);
    sauver(); rendre();
    annulable(message);
  };
  // Ajout d'une dépense depuis un élément du plan.
  const boutonDepense = (type, el) => {
    if (!el || E.voyageurs.length === 0) return '';
    const lie = R.depenseLiee(E, el.id);
    const m = type === 'nuit' ? el.montant : el.prix;
    if (lie) return `<p class="aide">Dans les dépenses : ${euros(lie.montant)} payés par ${esc(nomVoyageur(lie.payeur))}. <button type="button" class="btn lien" data-action="depense" data-id="${lie.id}">Ouvrir la dépense</button></p>`;
    if (!m) return '';
    return `<div class="groupe"><h3>Payé ?</h3><p class="aide">Ajoute ce montant aux dépenses partagées (réel du budget, qui doit quoi).</p><div class="rang"><label class="champ" style="flex:1 1 180px">Payé par<select id="payeur-plan">${E.voyageurs.map((v) => `<option value="${v.id}">${esc(v.nom)}</option>`).join('')}</select></label><button type="button" class="btn petit" style="align-self:flex-end" data-action="vers-depense" data-type="${type}" data-id="${el.id}">Ajouter aux dépenses</button></div></div>`;
  };

  function modaleVoyage() {
    const v = E.voyage;
    const corps = `
      <label class="champ">Nom du voyage<input name="nom" maxlength="80" value="${esc(v.nom)}"></label>
      <label class="champ">Destination<input name="destination" maxlength="80" value="${esc(v.destination)}"></label>
      <div class="rang-champs"><label class="champ">Départ<input type="date" name="debut" value="${esc(v.debut)}"></label><label class="champ">Retour<input type="date" name="fin" value="${esc(v.fin)}"></label></div>
      <label class="champ">Note<textarea name="note" maxlength="1000">${esc(v.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Le voyage', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const debut = lireDate(fd, 'debut'), fin = lireDate(fd, 'fin');
      if (!debut || !fin) return 'Indique les dates de départ et de retour.';
      if (fin < debut) return 'Le retour est avant le départ.';
      if (R.ecart(debut, fin) > 365) return 'Un voyage dure au plus un an.';
      retenir();
      E.voyage = toucher({ nom: String(fd.get('nom') || '').trim(), destination: String(fd.get('destination') || '').trim(), debut, fin, note: String(fd.get('note') || '').trim() });
      sauver(); rendre(); annulable('Voyage enregistré.');
    });
  }

  function modaleEtape(id) {
    const x = id ? trouver('etape', id) : null;
    const derniere = R.trierEtapes(E.etapes).at(-1);
    const arrivee = x?.arrivee || derniere?.depart || E.voyage.debut;
    const corps = `
      <label class="champ">Lieu<input name="lieu" maxlength="80" required value="${esc(x?.lieu || '')}" placeholder="Ville, région, parc…"></label>
      <div class="rang-champs"><label class="champ">Arrivée<input type="date" name="arrivee" value="${esc(arrivee)}"></label><label class="champ">Départ<small>Même jour : simple passage.</small><input type="date" name="depart" value="${esc(x?.depart || '')}"></label></div>
      <label class="champ">Note<textarea name="note" maxlength="500">${esc(x?.note || '')}</textarea></label>
      <p class="recap" id="recap"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Étape' : 'Nouvelle étape', corps, piedEdition(id, 'etape'), (fd) => {
      const lieu = String(fd.get('lieu') || '').trim();
      if (!lieu) return 'Donne le nom du lieu.';
      const a = lireDate(fd, 'arrivee'), d = lireDate(fd, 'depart') || a;
      if (!a) return 'Indique la date d\'arrivée.';
      if (d < a) return 'Le départ est avant l\'arrivée.';
      enregistrer('etape', R.normaliserEtape({ id: id || uid(), lieu, arrivee: a, depart: d, note: fd.get('note') }), id, `Étape « ${lieu} » enregistrée.`);
    });
    const recap = () => { const f = modale().querySelector('form'); const a = f.arrivee.value, d = f.depart.value; $('#recap').textContent = R.estDate(a) && R.estDate(d) && d >= a ? `${nuitsTxt(R.ecart(a, d))} sur place.` : ''; };
    modale().querySelector('form').addEventListener('input', recap); recap();
  }

  function modaleNuit(id, date = '') {
    const x = id ? trouver('nuit', id) : null;
    const etapeNuit = date ? R.etapeDeLaNuit(E, date) : null;
    const arrivee = x?.arrivee || date || E.voyage.debut;
    const depart = x?.depart || (etapeNuit ? etapeNuit.depart : arrivee ? ajout(arrivee, 1) : '');
    const corps = `
      <label class="champ">Hébergement<input name="nom" maxlength="80" required value="${esc(x?.nom || '')}" placeholder="Ex. : Chambre d'hôtes, camping, chez des amis"></label>
      <label class="champ">Adresse<small>Ou le quartier, en attendant de réserver.</small><input name="adresse" maxlength="200" value="${esc(x?.adresse || '')}"></label>
      <div class="rang-champs"><label class="champ">Arrivée<input type="date" name="arrivee" value="${esc(arrivee)}"></label><label class="champ">Départ<input type="date" name="depart" value="${esc(depart)}"></label></div>
      ${choixStatut('statut', x?.statut || 'aReserver')}
      <div class="rang-champs"><label class="champ">Montant total (€)<input name="montant" inputmode="decimal" value="${R.saisieMontant(x?.montant)}" placeholder="0,00"></label><label class="champ">Acompte versé (€)<input name="acompte" inputmode="decimal" value="${R.saisieMontant(x?.acompte)}" placeholder="0,00"></label></div>
      <label class="case"><input type="checkbox" name="solde" ${x?.solde ? 'checked' : ''}> Entièrement payé (soldé)</label>
      <label class="champ">Note<small>Code d'accès, heure d'arrivée, contact… Pas de lien vers une plateforme.</small><textarea name="note" maxlength="500">${esc(x?.note || '')}</textarea></label>
      <p class="recap" id="recap"></p>
      ${boutonDepense('nuit', x)}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Hébergement' : 'Nouvel hébergement', corps, piedEdition(id, 'nuit'), (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'hébergement.';
      const a = lireDate(fd, 'arrivee'), d = lireDate(fd, 'depart');
      if (!a || !d) return 'Indique les dates d\'arrivée et de départ.';
      if (d <= a) return 'Le départ doit suivre l\'arrivée d\'au moins une nuit.';
      const m = R.lireMontant(fd.get('montant')), ac = R.lireMontant(fd.get('acompte'));
      if (m === null || ac === null) return 'Montant illisible : écris par exemple 120,00.';
      if (ac > m) return 'L\'acompte dépasse le montant total.';
      enregistrer('nuit', R.normaliserNuit({ id: id || uid(), nom, adresse: fd.get('adresse'), arrivee: a, depart: d, statut: fd.get('statut'), montant: m, acompte: ac, solde: !!fd.get('solde'), note: fd.get('note') }), id, `Hébergement « ${nom} » enregistré.`);
    });
    const recap = () => {
      const f = modale().querySelector('form');
      const a = f.arrivee.value, d = f.depart.value, m = R.lireMontant(f.montant.value), ac = R.lireMontant(f.acompte.value);
      const n = R.estDate(a) && R.estDate(d) && d > a ? R.ecart(a, d) : 0;
      $('#recap').textContent = n ? `${nuitsTxt(n)}${m ? ` · ${euros(Math.round(m / n))} la nuit` : ''}${m && f.statut.value === 'reserve' && !f.solde.checked ? ` · reste ${euros(Math.max(0, m - (ac || 0)))} à payer` : ''}` : '';
    };
    modale().querySelector('form').addEventListener('input', recap); recap();
  }

  function modaleTransport(id, date = '') {
    const x = id ? trouver('transport', id) : null;
    const corps = `
      <div class="rang-champs"><label class="champ">De<input name="de" maxlength="80" value="${esc(x?.de || '')}"></label><label class="champ">Vers<input name="vers" maxlength="80" value="${esc(x?.vers || '')}"></label></div>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${esc(x?.date || date)}"></label><label class="champ">Heure de départ<input type="time" name="heure" value="${esc(x?.heure || '')}"></label>
        <label class="champ">Mode<select name="mode">${B.modes.map(([k, l]) => `<option value="${k}" ${(x?.mode || 'train') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${choixStatut('statut', x?.statut || 'aReserver')}
      <div class="rang-champs"><label class="champ">Prix total (€)<input name="prix" inputmode="decimal" value="${R.saisieMontant(x?.prix)}" placeholder="0,00"></label><label class="champ">Référence<small>Numéro de réservation, place…</small><input name="ref" maxlength="80" value="${esc(x?.ref || '')}"></label></div>
      <label class="champ">Note<textarea name="note" maxlength="500">${esc(x?.note || '')}</textarea></label>
      ${boutonDepense('transport', x)}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Transport' : 'Nouveau transport', corps, piedEdition(id, 'transport'), (fd) => {
      const de = String(fd.get('de') || '').trim(), vers = String(fd.get('vers') || '').trim();
      if (!de && !vers) return 'Indique au moins le départ ou l\'arrivée du trajet.';
      const p = R.lireMontant(fd.get('prix'));
      if (p === null) return 'Prix illisible : écris par exemple 45,00.';
      enregistrer('transport', R.normaliserTransport({ id: id || uid(), de, vers, date: lireDate(fd, 'date'), heure: fd.get('heure'), mode: fd.get('mode'), statut: fd.get('statut'), prix: p, ref: fd.get('ref'), note: fd.get('note') }), id, 'Transport enregistré.');
    });
  }

  function modaleActivite(id, date = '') {
    const x = id ? trouver('activite', id) : null;
    const corps = `
      <label class="champ">Activité<input name="titre" maxlength="100" required value="${esc(x?.titre || '')}" placeholder="Visite, randonnée, restaurant…"></label>
      <div class="rang-champs"><label class="champ">Jour<small>Vide : à placer plus tard.</small><input type="date" name="date" value="${esc(x?.date ?? date)}"></label><label class="champ">Heure<input type="time" name="heure" value="${esc(x?.heure || '')}"></label></div>
      <label class="champ">Lieu<input name="lieu" maxlength="100" value="${esc(x?.lieu || '')}"></label>
      ${choixStatut('statut', x?.statut || 'libre', R.STATUTS_ACTIVITE)}
      <label class="champ">Prix pour le groupe (€)<input name="prix" inputmode="decimal" value="${R.saisieMontant(x?.prix)}" placeholder="0,00"></label>
      <label class="champ">Note<textarea name="note" maxlength="500">${esc(x?.note || '')}</textarea></label>
      ${boutonDepense('activite', x)}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Activité' : 'Nouvelle activité', corps, piedEdition(id, 'activite'), (fd) => {
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Donne un nom à l\'activité.';
      const p = R.lireMontant(fd.get('prix'));
      if (p === null) return 'Prix illisible : écris par exemple 18,00.';
      enregistrer('activite', R.normaliserActivite({ id: id || uid(), titre, date: lireDate(fd, 'date'), heure: fd.get('heure'), lieu: fd.get('lieu'), statut: fd.get('statut'), prix: p, note: fd.get('note') }), id, `« ${titre} » enregistrée.`);
    });
  }

  function modaleDepense(id) {
    if (!E.voyageurs.length) { toast('Ajoute d\'abord un voyageur dans les Réglages.'); return; }
    const x = id ? trouver('depense', id) : null;
    const r = x?.repartition || { mode: 'egale', participants: E.voyageurs.map((v) => v.id) };
    const t = auj();
    const dateDefaut = E.voyage.debut && t >= E.voyage.debut && t <= E.voyage.fin ? t : t;
    const corps = `
      <label class="champ">Libellé<input name="libelle" maxlength="100" required value="${esc(x?.libelle || '')}" placeholder="Dîner, essence, musée…"></label>
      <div class="rang-champs"><label class="champ">Montant (€)<input name="montant" inputmode="decimal" required value="${R.saisieMontant(x?.montant)}" placeholder="0,00"></label><label class="champ">Date<input type="date" name="date" value="${esc(x?.date || dateDefaut)}"></label></div>
      <div class="rang-champs"><label class="champ">Poste<select name="poste">${B.postes.map((p) => `<option value="${p.id}" ${(x?.poste || 'repas') === p.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
        <label class="champ">Payé par<select name="payeur">${E.voyageurs.map((v) => `<option value="${v.id}" ${x?.payeur === v.id ? 'selected' : ''}>${esc(v.nom)}</option>`).join('')}</select></label></div>
      <fieldset class="champ cadre-champs"><legend>Pour qui <small>Coche les voyageurs concernés.</small></legend>
        <div class="choix-statut">${[['egale', 'Parts égales'], ['parts', 'En parts'], ['montants', 'Montants']].map(([k, l]) => `<label><input type="radio" name="mode" value="${k}" ${r.mode === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <ul class="repartition">${E.voyageurs.map((v) => `<li><label class="case"><input type="checkbox" name="pour" value="${v.id}" ${r.participants.includes(v.id) ? 'checked' : ''}> ${esc(v.nom)}</label>
          <input class="rep-parts" name="parts-${v.id}" inputmode="decimal" aria-label="Parts de ${esc(v.nom)}" value="${String(r.parts?.[v.id] ?? 1).replace('.', ',')}">
          <input class="rep-montants" name="montant-${v.id}" inputmode="decimal" aria-label="Montant de ${esc(v.nom)}" value="${R.saisieMontant(r.montants?.[v.id])}" placeholder="0,00"></li>`).join('')}</ul>
      </fieldset>
      <p class="recap" id="recap"></p>
      <label class="champ">Note<input name="note" maxlength="300" value="${esc(x?.note || '')}" placeholder="Ex. : payé 45 CHF"></label>
      <p class="erreur" role="alert"></p>`;
    const lire = (fd) => {
      const montant = R.versCentimes(fd.get('montant'));
      const mode = fd.get('mode');
      const participants = fd.getAll('pour');
      const parts = {}, montants = {};
      for (const v of E.voyageurs) {
        parts[v.id] = Number(String(fd.get(`parts-${v.id}`) || '0').replace(',', '.'));
        montants[v.id] = R.versCentimes(fd.get(`montant-${v.id}`) || '0') ?? -1;
      }
      return { montant, mode, participants, parts, montants };
    };
    ouvrirModale(x ? 'Dépense' : 'Nouvelle dépense', corps, piedEdition(id, 'depense'), (fd) => {
      const libelle = String(fd.get('libelle') || '').trim();
      if (!libelle) return 'Donne un libellé à la dépense.';
      const l = lire(fd);
      if (!(l.montant > 0)) return 'Montant illisible : écris par exemple 42,50.';
      if (!l.participants.length) return 'Coche au moins un voyageur concerné.';
      const res = R.repartir(l.montant, E.voyageurs.filter((v) => l.participants.includes(v.id)), l.mode, { parts: l.parts, montants: l.montants });
      if (res.erreur) return res.erreur;
      const dep = R.normaliserDepense({ id: id || uid(), libelle, montant: l.montant, date: lireDate(fd, 'date'), poste: fd.get('poste'), payeur: fd.get('payeur'), note: fd.get('note'), lien: x?.lien || '',
        repartition: { mode: l.mode, participants: l.participants, ...(l.mode === 'parts' ? { parts: Object.fromEntries(l.participants.map((p) => [p, l.parts[p]])) } : {}), ...(l.mode === 'montants' ? { montants: Object.fromEntries(l.participants.map((p) => [p, l.montants[p]])) } : {}) }, quotes: res.quotes }, E.voyageurs, B.postes);
      enregistrer('depense', dep, id, `Dépense « ${libelle} » enregistrée.`);
    });
    const form = modale().querySelector('form');
    const recap = () => {
      const fd = new FormData(form);
      const l = lire(fd);
      form.dataset.mode = l.mode;
      if (!(l.montant > 0) || !l.participants.length) { $('#recap').textContent = ''; return; }
      const res = R.repartir(l.montant, E.voyageurs.filter((v) => l.participants.includes(v.id)), l.mode, { parts: l.parts, montants: l.montants });
      $('#recap').textContent = res.erreur ? res.erreur : Object.entries(res.quotes).map(([k, c]) => `${nomVoyageur(k)} ${euros(c)}`).join(' · ');
    };
    form.addEventListener('input', recap); recap();
  }

  function modaleVirement(pre = {}) {
    if (E.voyageurs.length < 2) return;
    const opts = (sel) => E.voyageurs.map((v) => `<option value="${v.id}" ${sel === v.id ? 'selected' : ''}>${esc(v.nom)}</option>`).join('');
    const corps = `
      <div class="rang-champs"><label class="champ">De<select name="de">${opts(pre.de)}</select></label><label class="champ">À<select name="a">${opts(pre.a || E.voyageurs[1].id)}</select></label></div>
      <div class="rang-champs"><label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${R.saisieMontant(pre.montant)}" placeholder="0,00"></label><label class="champ">Date<input type="date" name="date" value="${auj()}"></label></div>
      <p class="aide">Un remboursement entre voyageurs n'est pas une dépense : il solde les comptes sans changer le budget.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Remboursement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const m = R.versCentimes(fd.get('montant'));
      if (!(m > 0)) return 'Montant illisible : écris par exemple 25,00.';
      if (fd.get('de') === fd.get('a')) return 'Choisis deux voyageurs différents.';
      enregistrer('virement', R.normaliserVirement({ id: uid(), de: fd.get('de'), a: fd.get('a'), montant: m, date: lireDate(fd, 'date') }), null, 'Remboursement enregistré.');
    });
  }

  function modalePrevus() {
    const b = R.budget(E, B.postes);
    const corps = `<p class="aide">Transports, hébergements et activités : le plan donne déjà un montant (prix de chaque élément) ; ajoute ici ce qui n'y figure pas. Pour les autres postes, saisis ce que tu prévois pour tout le groupe.</p>
      <ul class="prevus">${b.lignes.map((l) => `<li><label class="champ">${esc(l.nom)}${l.duPlan ? `<small>${euros(l.duPlan)} viennent du plan, en plus de ce montant.</small>` : ''}<input name="p-${l.id}" inputmode="decimal" value="${R.saisieMontant(l.saisi)}" placeholder="0,00"></label></li>`).join('')}</ul>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Budget prévu', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const prevus = {};
      for (const p of B.postes) {
        const c = R.lireMontant(fd.get(`p-${p.id}`));
        if (c === null) return `Montant illisible pour « ${p.nom} ».`;
        if (c) prevus[p.id] = c;
      }
      retenir();
      E.budget = toucher({ prevus });
      sauver(); rendre(); annulable('Budget prévu enregistré.');
    });
  }

  function modaleCase(type, id) {
    const x = id ? trouver(type, id) : null;
    const corps = `
      <label class="champ">${type === 'bagage' ? 'Élément' : 'Document'}<input name="texte" maxlength="120" required value="${esc(x?.texte || '')}"></label>
      ${type === 'document' ? `<label class="champ">Précision<input name="detail" maxlength="300" value="${esc(x?.detail || '')}"></label>` : ''}
      <label class="champ">Qui s'en charge<small>Facultatif.</small><select name="qui"><option value="">Personne en particulier</option>${E.voyageurs.map((v) => `<option value="${v.id}" ${x?.qui === v.id ? 'selected' : ''}>${esc(v.nom)}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier' : type === 'bagage' ? 'Nouveau bagage' : 'Nouveau document', corps, piedEdition(id, type), (fd) => {
      const t = String(fd.get('texte') || '').trim();
      if (!t) return 'Écris l\'élément.';
      enregistrer(type, R.normaliserCase({ id: id || uid(), texte: t, detail: fd.get('detail') ?? x?.detail, qui: fd.get('qui'), liste: x?.liste || '', fait: x?.fait }), id, `« ${t} » enregistré.`);
    });
  }

  function modaleListes() {
    const corps = `<p>Les éléments déjà présents ne sont pas ajoutés deux fois.</p><div class="choix-types">${B.bagages.map((l) => `<label class="type-sejour"><input type="checkbox" name="liste" value="${l.id}"><span><b>${esc(l.nom)}</b><small>${pluriel(l.items.length, 'élément')}</small></span></label>`).join('')}</div><p class="erreur" role="alert"></p>`;
    ouvrirModale('Ajouter une liste', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const choix = fd.getAll('liste');
      if (!choix.length) return 'Coche au moins une liste.';
      const n = R.genererBagages(B.bagages, E.bagages, choix);
      retenir();
      n.forEach(toucher);
      E.bagages.push(...n);
      sauver(); rendre(); annulable(n.length ? `${pluriel(n.length, 'élément ajouté', 'éléments ajoutés')}.` : 'Ces éléments sont déjà dans tes bagages.');
    });
  }

  function modaleVoyageur(id) {
    const x = id ? trouver('voyageur', id) : null;
    const utilise = x && R.voyageurUtilise(E, id);
    const corps = `<label class="champ">Prénom<input name="nom" maxlength="40" required value="${esc(x?.nom || '')}"></label>
      ${utilise ? '<p class="aide">Ce voyageur apparaît dans des dépenses ou des remboursements : il ne peut pas être retiré.</p>' : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Voyageur' : 'Nouveau voyageur', corps, piedEdition(utilise ? null : id, 'voyageur'), (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique un prénom.';
      if (!id && E.voyageurs.length >= R.MAX_VOYAGEURS) return `${R.MAX_VOYAGEURS} voyageurs au plus.`;
      enregistrer('voyageur', R.normaliserVoyageur({ id: id || uid(), nom }), id, `${nom} enregistré(e).`);
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe"><h3>Voyage</h3><p>${esc(E.voyage.nom || 'Sans nom')} · ${resumeVoyage()}</p><div class="rang"><button type="button" class="btn petit" data-action="voyage">Modifier le voyage</button></div></div>
      <div class="groupe"><h3>Voyageurs <span class="etiquette sable">${E.voyageurs.length} / ${R.MAX_VOYAGEURS}</span></h3>
        ${E.voyageurs.length ? `<ul class="mini-liste">${E.voyageurs.map((v) => `<li><span><b>${esc(v.nom)}</b></span><button type="button" class="btn petit" data-action="voyageur" data-id="${v.id}">Modifier</button></li>`).join('')}</ul>` : '<p class="mention">Aucun voyageur.</p>'}
        <div class="rang">${E.voyageurs.length < R.MAX_VOYAGEURS ? `<button type="button" class="btn petit" data-action="nouveau-voyageur">${ICONES.plus}Ajouter un voyageur</button>` : ''}</div>
        <p class="aide">Pour voir le même voyage sur plusieurs téléphones, chacun se connecte avec la même clé.</p></div>
      <div class="groupe"><h3>Voyage terminé</h3><p class="aide">Archive ce voyage pour en préparer un autre : un résumé est gardé (dates, prévu, réel), les voyageurs et les listes de bagages restent, décochées. Télécharge d'abord une copie si tu veux garder le détail.</p>
        <div class="rang"><button type="button" class="btn petit" data-action="archiver">Archiver et commencer un nouveau voyage</button></div>
        ${E.archives.length ? `<ul class="mini-liste">${E.archives.map((a) => `<li><span><b>${esc(a.nom)}</b> · ${a.debut ? `${fmt(a.debut)} → ${fmt(a.fin)}` : ''} · ${pluriel(a.voyageurs, 'voyageur')} · réel ${eur0(a.reel)} pour ${eur0(a.prevu)} prévus</span></li>`).join('')}</ul>` : ''}</div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : copie l'itinéraire en texte, imprime le programme ou exporte les dépenses en tableur (CSV).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="copier-itineraire">Copier l'itinéraire</button><button class="btn petit" type="button" data-action="csv">Dépenses en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton voyage est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, même sans réseau une fois chargé.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Ton voyage (lieux, adresses, prénoms, dépenses) est enregistré en ligne, lié à ta clé, et n'est ni lu ni partagé par QME. N'y mets ni numéro de passeport ni code de carte bancaire.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Aucune plateforme de réservation, aucune compagnie, aucune banque n'est connectée. Dépenses partagées : moteur de calcul commun avec le template Budget commun. Formalités : sources officielles dans l'onglet Préparer (vérifiées le ${fmt(B.sourcesVerifieesLe)}).</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Fermer</button>', () => {});
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!d.voyage || !Array.isArray(d.etapes) || !Array.isArray(d.depenses)) throw new Error();
        if (!confirm(`Remplacer ton voyage actuel par cette copie (« ${d.voyage.nom || 'sans nom'} », ${pluriel(d.etapes.length, 'étape')}, ${pluriel(d.depenses.length, 'dépense')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de ton voyage.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `voyage-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E, B.postes), 'text/csv;charset=utf-8', `depenses-voyage-${auj()}.csv`);
  async function copierItineraire() {
    const txt = R.itineraireTexte(E, B.modes, (d) => dateJour(d));
    try { await navigator.clipboard.writeText(txt); toast('Itinéraire copié : colle-le dans un message ou une note.'); } catch {
      ouvrirModale('Itinéraire en texte', `<p class="aide">Sélectionne le texte et copie-le.</p><label class="champ"><span class="sr-only">Itinéraire</span><textarea rows="14" readonly>${esc(txt)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>', () => {});
    }
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
  const NOMS = { etape: 'Étape', nuit: 'Hébergement', transport: 'Transport', activite: 'Activité', depense: 'Dépense', bagage: 'Élément', document: 'Document', voyageur: 'Voyageur' };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-voyageur': if (accueil.voyageurs.length < R.MAX_VOYAGEURS) { accueil.voyageurs.push(''); ecranAccueil(); } break;
      case 'accueil-suivant': accueilSuivant(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'copier-itineraire': copierItineraire(); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'voyage': modaleVoyage(); break;
      case 'etape': modaleEtape(id); break;
      case 'nouvelle-etape': modaleEtape(null); break;
      case 'nuit': modaleNuit(id); break;
      case 'nouvelle-nuit': modaleNuit(null, el.dataset.date || ''); break;
      case 'transport': modaleTransport(id); break;
      case 'nouveau-transport': modaleTransport(null, el.dataset.date || ''); break;
      case 'activite': modaleActivite(id); break;
      case 'nouvelle-activite': modaleActivite(null, el.dataset.date || ''); break;
      case 'depense': modaleDepense(id); break;
      case 'nouvelle-depense': modaleDepense(null); break;
      case 'nouveau-virement': modaleVirement(); break;
      case 'prevus': modalePrevus(); break;
      case 'listes': modaleListes(); break;
      case 'voyageur': modaleVoyageur(id); break;
      case 'nouveau-voyageur': modaleVoyageur(null); break;
      case 'nouveau-bagage': modaleCase('bagage', null); break;
      case 'nouveau-document': modaleCase('document', null); break;
      case 'modifier-case': modaleCase(el.dataset.type, id); break;
      case 'sous-budget': ongletBudget = el.dataset.o; rendre(); break;
      case 'filtre-poste': filtrePoste = el.dataset.p; rendre(); break;
      case 'supprimer': {
        const type = el.dataset.type, x = trouver(type, id);
        if (!x) break;
        if (type === 'voyageur' && R.voyageurUtilise(E, id)) { toast('Ce voyageur apparaît dans des dépenses : il ne peut pas être retiré.'); break; }
        retenir(); supprimer(type, id); modale().close(); sauver(); rendre();
        annulable(`${NOMS[type]} supprimé${['etape', 'activite', 'depense'].includes(type) ? 'e' : ''}.`);
        break;
      }
      case 'suppr-virement': retenir(); supprimer('virement', id); sauver(); rendre(); annulable('Remboursement supprimé.'); break;
      case 'marquer-reserve': {
        const x = trouver(el.dataset.type, id);
        if (!x) break;
        retenir(); x.statut = 'reserve'; toucher(x); sauver(); rendre();
        annulable('Marqué réservé. Complète le prix ou la référence dans sa fiche.');
        break;
      }
      case 'rembourse': {
        retenir();
        E.virements.push(toucher(R.normaliserVirement({ id: uid(), de: el.dataset.de, a: el.dataset.a, montant: Number(el.dataset.montant), date: auj() })));
        sauver(); rendre(); annulable(`Remboursement de ${nomVoyageur(el.dataset.de)} à ${nomVoyageur(el.dataset.a)} enregistré.`);
        break;
      }
      case 'vers-depense': {
        const type = el.dataset.type, x = trouver(type, id);
        if (!x) break;
        const payeur = $('#payeur-plan')?.value || E.voyageurs[0]?.id;
        retenir();
        E.depenses.push(toucher(R.normaliserDepense({ id: uid(), ...R.depenseDepuis(type, x, payeur, E.voyageurs) }, E.voyageurs, B.postes)));
        modale().close(); sauver(); rendre(); annulable(`Ajouté aux dépenses, payé par ${nomVoyageur(payeur)}.`);
        break;
      }
      case 'decocher': {
        if (!E.bagages.some((b) => b.fait) && !E.documents.some((b) => b.fait)) break;
        retenir();
        for (const l of [E.bagages, E.documents]) for (const b of l) if (b.fait) { b.fait = false; toucher(b); }
        sauver(); rendre(); annulable('Tout est décoché.');
        break;
      }
      case 'archiver': {
        if (!confirm('Archiver ce voyage ? Les étapes, nuits, activités et dépenses seront effacées (un résumé est gardé). Les comptes entre voyageurs doivent être réglés avant.')) break;
        retenir();
        const t = maintenant();
        const ancien = E;
        E = R.archiver(E, B.postes, t);
        E.supprimes = { ...ancien.supprimes };
        for (const c of ['etapes', 'nuits', 'transports', 'activites', 'depenses', 'virements']) for (const x of ancien[c]) E.supprimes[x.id] = t;
        E.voyage.modifLe = t; E.budget.modifLe = t;
        modale().close(); sauver(); vue = 'apercu'; rendre(); modaleVoyage();
        annulable('Voyage archivé. Indique les dates du prochain.');
        break;
      }
      default: break;
    }
  });
  // Cases à cocher (bagages, documents) : un geste, enregistré tout de suite.
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-action="cocher"]');
    if (!el) return;
    const x = trouver(el.dataset.type, el.dataset.id);
    if (!x) return;
    x.fait = el.checked; toucher(x);
    sauver(); rendre();
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
  window.__voyage = { etat: () => E, regles: R };
  init();
})();
