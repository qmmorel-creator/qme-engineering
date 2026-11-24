// Cadeaux reçus et remerciements QME : qui a offert quoi (objets, argent, cagnottes, attentions), un message de
// remerciement prêt par foyer (modèles par événement et par ton), suivi « reste à remercier », étiquettes
// d'adresses A4, import d'une liste collée, export CSV, effacement par événement.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi d'e-mail ni de message par l'outil.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CDX;
  const API = '/api/templates';
  const PRODUIT = 'CDX';
  const CLE_CODE = 'qme-cdx-code';
  const CLE_CACHE = 'qme-cdx-cache';
  const CLE_DEMO = 'qme-cdx-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cdx-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const quand = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? (n > 60 ? `dans ${Math.round(n / 30)} mois` : `dans ${n} jours`) : (-n > 60 ? `il y a ${Math.round(-n / 30)} mois` : `il y a ${-n} jours`));

  const typeEv = (id) => R.typeEvenement(B, id);
  const typeC = (id) => R.typeCadeau(B, id);
  const nomCourtC = (id) => typeC(id).court || typeC(id).nom;
  const nomStatut = (id) => (B.statuts.find((s) => s.id === id) || { nom: id }).nom;
  const canal = (id) => B.canaux.find((c) => c.id === id) || B.canaux[0];
  const nomTon = (id) => (B.tons.find((t) => t.id === id) || { nom: id }).nom;
  const COULEUR_STATUT = { 'a-ecrire': 'rose', ecrit: 'jaune', envoye: 'vert' };
  const COULEUR_TYPE = { objet: 'ciel', argent: 'jaune', cagnotte: 'jaune', bon: 'ciel', fleurs: 'rose', message: 'sable', presence: 'sable', aide: 'sable', don: 'rose' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  let fiche = null; // foyer ouvert
  const filtre = { cadeaux: 'tous', q: '', ton: null, modeleType: null, modeleTon: 'tous', selection: 'poste', depart: 1, envoyes: false };
  let annulation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const etatVide = () => ({ ...R.etatVide(), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d), tutorielVu: Boolean(d?.tutorielVu) });
  const ev = () => R.evenement(E, E.courant);
  const personne = (id) => E.personnes.find((p) => p.id === id);
  const cadeau = (id) => E.cadeaux.find((c) => c.id === id);
  const montant = (c) => (E.reglages.masquerMontants ? '•••' : R.formatMontant(c));
  const sobre = () => ev() && !typeEv(ev().type).festif;
  const mot = (un = false) => (ev() ? (un ? typeEv(ev().type).motUn : typeEv(ev().type).mot) : (un ? 'cadeau' : 'cadeaux'));
  const Mot = (un = false) => { const m = mot(un); return m.charAt(0).toUpperCase() + m.slice(1); };

  function retenir() { annulation = JSON.parse(JSON.stringify(E)); }
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
        if (!modale().open && !saisieEnCours()) rendre();
      }
    } catch { majSync('horsligne'); }
  }
  // Le message en cours de rédaction a le focus : ne pas redessiner sous les doigts.
  const saisieEnCours = () => document.activeElement && document.activeElement.matches?.('#vue textarea, #vue input');

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
  // Code interne (CDX-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && E.evenements.length) { cache(false); demarrer(); } else ecranAccueil();
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
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; fiche = null;
    document.body.classList.remove('app', 'ton-sobre');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Foyer fictif (Camille et Hugo) : un mariage il y a 45 jours (16 foyers, cagnotte, chèques, cadeaux de la
  // liste, remerciements envoyés, écrits, à écrire, en retard sur l'objectif, adresse manquante), la naissance
  // de Léo il y a 7 mois (presque terminée), des obsèques il y a un mois (ton sobre). Villes et adresses inventées.
  function donneesDemo() {
    const t = auj();
    const e = etatVide();
    const EV = (x) => { const v = R.normaliserEvenement(x); e.evenements.push(v); return v.id; };
    const mar = EV({ id: 'mariage', type: 'mariage', nom: 'Mariage de Camille et Hugo', date: ajout(t, -45), signature: 'Camille et Hugo', projet: 'notre voyage de noces en Écosse', ton: 'chaleureux' });
    const nai = EV({ id: 'naissance', type: 'naissance', nom: 'Naissance de Léo', date: ajout(t, -212), concerne: 'Léo', signature: 'Camille, Hugo et Léo', projet: 'son premier livret d\'épargne', ton: 'chaleureux' });
    const obs = EV({ id: 'obseques', type: 'obseques', nom: 'Obsèques de Jeanne', date: ajout(t, -30), concerne: 'Jeanne', signature: 'Hugo et toute la famille', ton: 'sobre' });
    e.courant = mar;
    const A = (ligne1, cp, ville, destinataire = '') => ({ destinataire, ligne1, cp, ville });
    let n = 0;
    const F = (evId, nom, extra, cadeaux) => {
      const p = R.normaliserPersonne({ id: `p${++n}`, evenement: evId, nom, ...extra });
      e.personnes.push(p);
      for (const c of cadeaux) e.cadeaux.push(R.normaliserCadeau({ personne: p.id, recuLe: R.evenement(e, evId).date, ...c }));
      return p;
    };
    const apres = (j) => ajout(ajout(t, -45), j); // cadeaux arrivés après le mariage
    const envoye = (j, canal = 'poste') => ({ statut: 'envoye', envoyeLe: ajout(t, -j), canal });
    // Mariage
    F(mar, 'Tante Agnès et Paul', { appel: 'Chère Agnès, cher Paul,', adresse: A('3 rue des Lilas', '99100', 'Valbrune', 'Agnès et Paul Exemple'), ...envoye(12) }, [{ type: 'objet', description: 'la machine à pain' }, { type: 'presence' }]);
    F(mar, 'Famille Roux', { appel: 'Chers tous,', adresse: A('14 avenue des Tilleuls', '99210', 'Montclaret', 'Famille Roux'), statut: 'ecrit' }, [{ type: 'cagnotte', montant: 15000, cagnotte: 'Voyage de noces', recuLe: apres(5) }]);
    F(mar, 'Mamie Odette', { appel: 'Chère Mamie,', ...envoye(20, 'main') }, [{ type: 'argent', description: 'ton chèque si généreux', montant: 20000 }]);
    F(mar, 'Léa et Tom', { appel: 'Chère Léa, cher Tom,', adresse: A('8 impasse du Moulin', '99320', 'Lorvaux') }, [{ type: 'cagnotte', montant: 8000, cagnotte: 'Voyage de noces', recuLe: apres(8) }, { type: 'objet', description: 'le jeu de société', recuLe: apres(8) }]);
    F(mar, 'Julien B.', { appel: 'Cher Julien,' }, [{ type: 'cagnotte', montant: 5000, cagnotte: 'Voyage de noces' }]);
    F(mar, 'Collègues de Camille', { appel: 'Chers collègues,', canal: 'main' }, [{ type: 'bon', description: 'le coffret week-end' }]);
    F(mar, 'Parrain Michel', { appel: 'Cher Michel,', adresse: A('27 chemin des Vignes', '99430', 'Sainte-Aube-des-Prés', 'Michel Exemple') }, [{ type: 'objet', description: 'le service de verres en cristal', recuLe: apres(10) }]);
    F(mar, 'Sophie et Nicolas', { appel: 'Chère Sophie, cher Nicolas,', adresse: A('5 place de la Fontaine', '99100', 'Valbrune'), ...envoye(9, 'message') }, [{ type: 'objet', description: 'la nappe brodée' }]);
    F(mar, 'Famille Lambert', { appel: 'Chers amis,', adresse: A('2 rue du Four', '99540', 'Brémontier'), ...envoye(6) }, [{ type: 'cagnotte', montant: 10000, cagnotte: 'Voyage de noces' }]);
    F(mar, 'Inès', { appel: 'Chère Inès,', canal: 'main', statut: 'ecrit' }, [{ type: 'aide', description: 'ton aide pour la décoration' }, { type: 'presence', description: 'ta présence' }]);
    F(mar, 'Oncle Bernard', { appel: 'Cher Bernard,', adresse: A('41 boulevard du Lac', '99650', 'Aiguebrune') }, [{ type: 'argent', description: 'votre chèque', montant: 10000 }]);
    F(mar, 'Chloé', { appel: 'Chère Chloé,', adresse: A('9 rue Haute', '99210', 'Montclaret') }, [{ type: 'objet', description: 'l\'album photo de la journée', recuLe: ajout(t, -12) }]);
    F(mar, 'Les voisins du 3e', { appel: 'Chers voisins,', ...envoye(30, 'main') }, [{ type: 'fleurs', description: 'le magnifique bouquet' }]);
    F(mar, 'Club de randonnée', { appel: 'Chers amis randonneurs,', adresse: A('Maison des associations, 1 rue de la Gare', '99100', 'Valbrune', 'Club de randonnée de Valbrune'), statut: 'ecrit' }, [{ type: 'cagnotte', montant: 24000, cagnotte: 'Voyage de noces', recuLe: apres(14) }]);
    F(mar, 'Cousine Margaux', { appel: 'Chère Margaux,', adresse: A('16 rue des Écoles', '99760', 'Port-Vadel') }, [{ type: 'objet', description: 'la cafetière italienne', recuLe: ajout(t, -5) }]);
    F(mar, 'Famille Moreau', { appel: 'Chère famille Moreau,', adresse: A('6 allée des Peupliers', '99320', 'Lorvaux') }, [{ type: 'cagnotte', montant: 6000, cagnotte: 'Voyage de noces', recuLe: apres(20) }, { type: 'message', description: 'votre si jolie carte', recuLe: apres(20) }]);
    // Naissance
    F(nai, 'Mamie Odette', { appel: 'Chère Mamie,', ...envoye(190, 'main') }, [{ type: 'objet', description: 'le doudou tricoté main' }]);
    F(nai, 'Tata Inès', { appel: 'Chère Inès,', ...envoye(185, 'message') }, [{ type: 'objet', description: 'la gigoteuse' }]);
    F(nai, 'Parrain Julien', { appel: 'Cher Julien,', ...envoye(180) }, [{ type: 'argent', montant: 5000 }]);
    F(nai, 'Collègues de Hugo', { appel: 'Chers collègues,', canal: 'main', statut: 'ecrit' }, [{ type: 'cagnotte', montant: 12000, cagnotte: 'Naissance de Léo' }]);
    F(nai, 'Famille Roux', { appel: 'Chers tous,', ...envoye(175) }, [{ type: 'objet', description: 'le body brodé à son prénom' }]);
    F(nai, 'Les voisins du 3e', { appel: 'Chers voisins,', ...envoye(170, 'vive-voix') }, [{ type: 'fleurs' }]);
    // Obsèques
    F(obs, 'Famille Roux', { appel: 'Chers amis,', adresse: A('14 avenue des Tilleuls', '99210', 'Montclaret', 'Famille Roux'), ...envoye(8) }, [{ type: 'fleurs', description: 'la composition florale' }, { type: 'message', description: 'votre message' }]);
    F(obs, 'Club de randonnée', { appel: 'Chers amis,', adresse: A('Maison des associations, 1 rue de la Gare', '99100', 'Valbrune', 'Club de randonnée de Valbrune') }, [{ type: 'don', description: 'votre don à l\'association de recherche', montant: 8000 }]);
    F(obs, 'Madame Petit', { appel: 'Chère Madame,', canal: 'main' }, [{ type: 'presence' }, { type: 'message', description: 'votre lettre' }]);
    F(obs, 'Collègues de Hugo', { appel: 'Chers collègues,', canal: 'message', statut: 'ecrit' }, [{ type: 'fleurs', description: 'la gerbe' }]);
    F(obs, 'Agnès et Paul', { appel: 'Chère Agnès, cher Paul,', adresse: A('3 rue des Lilas', '99100', 'Valbrune', 'Agnès et Paul Exemple') }, [{ type: 'aide', description: 'votre aide si précieuse ces jours-là' }]);
    // Messages déjà rédigés pour les foyers écrits ou envoyés (modèle du ton de l'événement, variante 1).
    for (const p of e.personnes.filter((x) => x.statut !== 'a-ecrire')) {
      const v = R.evenement(e, p.evenement);
      const m = R.modelesPour(B, e, v.type, v.ton)[0];
      p.modele = m.id;
      p.message = R.genererMessage(B, e, p.id, m.id);
    }
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Cadeaux reçus et remerciements · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="120" width="180" height="160" fill="#1D4E89"/>
          <rect x="100" y="120" width="20" height="160" fill="#F5B400"/>
          <path d="M110 120 C80 120 50 100 50 76 C50 56 80 50 110 120 Z" fill="#D9302A"/>
          <path d="M110 120 C140 120 170 100 170 76 C170 56 140 50 110 120 Z" fill="#D9302A"/>
          <rect x="240" y="40" width="150" height="100" fill="none" stroke="#141414" stroke-width="4"/>
          <path d="M240 40 L315 98 L390 40" fill="none" stroke="#141414" stroke-width="4"/>
          <circle cx="470" cy="190" r="80" fill="#F0EDE6"/>
          <path d="M470 190 L470 110 A80 80 0 0 1 550 190 Z" fill="#141414"/>
          <circle cx="470" cy="190" r="26" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Cadeaux reçus et remerciements</p>
          <h1>Personne n'est oublié.</h1>
          <p>Qui a offert quoi, un message prêt pour chaque foyer, les étiquettes d'adresses imprimées, et le compteur « reste à remercier » qui descend jusqu'à zéro. Mariage, naissance, anniversaire, retraite, obsèques.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes cadeaux et tes remerciements sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
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
  let accueil = { etape: 1, type: 'mariage', nom: '', date: '', signature: '', concerne: '', projet: '' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Qui a offert quoi, et à qui dire merci.</h1>
        <p class="intro">Tu notes chaque cadeau en deux secondes, l'outil prépare un message de remerciement par foyer (${Object.values(B.modeles).flat().length} modèles, par événement et par ton) et compte ce qu'il reste à envoyer. Pour commencer, quel événement ?</p>
        <div class="choix-evenement" role="radiogroup" aria-label="Type d'événement">${B.evenements.map((t) => `<label><input type="radio" name="type-accueil" value="${t.id}" ${t.id === a.type ? 'checked' : ''}><span>${esc(t.nom)}</span></label>`).join('')}</div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const t = typeEv(a.type);
      corps = `
        <p class="surtitre">Étape 2 · ${esc(t.nom)}</p>
        <h1>Ton événement</h1>
        <p class="intro">Ces informations remplissent les messages de remerciement. Tout se modifie ensuite.</p>
        <div class="rang-champs" style="max-width:720px">
          <label class="champ">Nom de l'événement<input id="a-nom" value="${esc(a.nom)}" maxlength="80" placeholder="${esc(exempleNom(a.type))}"></label>
          <label class="champ">Date<input id="a-date" type="date" value="${esc(a.date)}"></label>
        </div>
        <div class="rang-champs" style="max-width:720px;margin-top:14px">
          <label class="champ">Signature des messages<small>${t.nous ? 'Ex. : Camille et Hugo' : 'Ex. : ton prénom'}</small><input id="a-signature" value="${esc(a.signature)}" maxlength="80"></label>
          ${t.concerne ? `<label class="champ">${esc(t.concerne)}<small>Facultatif</small><input id="a-concerne" value="${esc(a.concerne)}" maxlength="60"></label>` : ''}
        </div>
        ${t.festif ? `<label class="champ" style="max-width:720px;margin-top:14px">Ce que l'argent reçu permettra <small>Facultatif, écrit comme dans une phrase : « notre voyage de noces », « un vélo électrique ». Ajouté aux messages des foyers qui ont donné de l'argent.</small><input id="a-projet" value="${esc(a.projet)}" maxlength="100"></label>` : ''}
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    document.querySelectorAll('[name=type-accueil]').forEach((r) => r.addEventListener('change', (e) => { accueil.type = e.target.value; }));
    for (const k of ['nom', 'date', 'signature', 'concerne', 'projet']) $(`#a-${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
  }
  const exempleNom = (type) => ({ mariage: 'Notre mariage', naissance: 'Naissance de Léo', anniversaire: 'Mes 40 ans', retraite: 'Mon départ à la retraite', obseques: 'Obsèques de Jeanne', autre: 'Pendaison de crémaillère' }[type]);

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    const v = R.normaliserEvenement({ type: a.type, nom: a.nom.trim() || exempleNom(a.type), date: a.date, signature: a.signature, concerne: a.concerne, projet: typeEv(a.type).festif ? a.projet : '', ton: typeEv(a.type).tons[0] });
    E.evenements.push(v); E.courant = v.id;
    accueil = { etape: 1, type: 'mariage', nom: '', date: '', signature: '', concerne: '', projet: '' };
    vue = 'cadeaux'; fiche = null;
    sauver();
    demarrer();
    toast(`Ton suivi est prêt. Note ton premier ${mot(true)}.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    cadeaux: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="12" fill="currentColor"/><rect x="11" y="9" width="2" height="12" fill="var(--papier)"/><path d="M12 9C9 9 6 8 6 5.5 6 4 8 3.5 12 9ZM12 9c3 0 6-1 6-3.5C18 4 16 3.5 12 9Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    merci: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 5l10 8 10-8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    modeles: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    etiquettes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['cadeaux', 'Cadeaux'], ['merci', 'Merci'], ['modeles', 'Modèles'], ['etiquettes', 'Étiquettes']];
  const AVERTISSEMENT = '<p class="mention avertissement">Données de tiers : garde le minimum (un nom d\'usage, une adresse seulement pour la poste), et efface les adresses ou l\'événement une fois les remerciements faits (Réglages). Aucun message n\'est envoyé par l\'outil : tu copies le texte, tu l\'écris ou tu l\'imprimes.</p>';

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d\'exemple fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Cadeaux et<br>remerciements</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span></button>`).join('')}</nav>
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
    if (!ev()) { vue = 'apercu'; fiche = null; }
    if (fiche && !personne(fiche)) fiche = null;
    if (fiche && personne(fiche).evenement !== E.courant) fiche = null;
    document.body.classList.toggle('ton-sobre', Boolean(sobre()));
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    const titre = vue === 'cadeaux' && fiche ? personne(fiche).nom : titres[vue];
    document.title = `${titre} · Cadeaux reçus et remerciements`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = !ev() ? vueSansEvenement() : {
      apercu: vueApercu,
      cadeaux: () => (fiche ? vueFoyer(personne(fiche)) : vueCadeaux()),
      merci: vueMerci,
      modeles: vueModeles,
      etiquettes: vueEtiquettes,
    }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v, { fiche: f = null, ancre = null } = {}) {
    vue = v; fiche = f;
    history.replaceState(null, '', `#${v}`);
    rendre();
    const cible = ancre && document.getElementById(ancre);
    if (cible) cible.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" class="forme-vide"><rect x="8" y="40" width="80" height="52" fill="#1D4E89"/><rect x="44" y="40" width="8" height="52" fill="#F5B400"/><path d="M48 40C34 40 22 34 22 26c0-7 10-9 26 14ZM48 40c14 0 26-6 26-14 0-7-10-9-26 14Z" fill="#D9302A"/></svg>';

  // Bandeau de l'événement courant : sélecteur, modification, nouvel événement.
  function bandeEvenement() {
    const v = ev();
    return `<div class="bande-evenement">
      <label class="champ choix-ev"><span class="sr-only">Événement</span><select data-select="courant">${E.evenements.map((x) => `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
      <span class="be-info">${esc(typeEv(v.type).nom)}${v.date ? ` · ${dateLongue(v.date)}` : ''}</span>
      <span class="be-actions"><button class="btn petit" data-action="modifier-evenement">Modifier</button><button class="btn petit" data-action="nouvel-evenement">${ICONES.plus}Événement</button></span>
    </div>`;
  }

  function vueSansEvenement() {
    return `<div class="vue-tete"><div><h1>Aucun événement</h1><p>Crée un événement (mariage, naissance, anniversaire, retraite, obsèques…) pour y noter les cadeaux reçus.</p></div></div>
      <div class="vide-etat">${FORME_VIDE}<div><h3>Commence par un événement</h3><p>Chaque événement a ses foyers, ses cadeaux et ses messages.</p><div class="actions"><button class="btn primaire" data-action="nouvel-evenement">${ICONES.plus}Un événement</button></div></div></div>`;
  }

  // ---------- Petits composants ----------
  const etiqStatut = (p) => `<span class="etiquette ${COULEUR_STATUT[p.statut]}">${esc(nomStatut(p.statut))}</span>`;
  function etiqObjectif(p, t) {
    if (p.statut === 'envoye') return p.envoyeLe ? `<span class="etiquette vert">Envoyé le ${dateCourte(p.envoyeLe)}</span>` : etiqStatut(p);
    const o = R.dateObjectif(E, p);
    if (!o) return '';
    const n = ecart(t, o);
    return n < 0 ? `<span class="etiquette rouge" title="Objectif d'envoi dépassé">En retard de ${pluriel(-n, 'jour')}</span>` : n <= 7 ? `<span class="etiquette jaune">Objectif ${quand(n)}</span>` : `<span class="etiquette sable">Avant le ${dateCourte(o)}</span>`;
  }
  const pastilleCadeau = (c) => `<span class="etiquette ${COULEUR_TYPE[c.type]}">${esc(nomCourtC(c.type))}</span>`;
  function barre(pct) { return `<span class="progres" role="img" aria-label="${pct} %"><span style="width:${pct}%"></span></span>`; }
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const resumeCadeaux = (p) => { const l = R.cadeauxDe(E, p.id); return l.length ? esc(R.phraseCadeaux(B, l)) : `<i>Aucun ${esc(mot(true))} noté</i>`; };

  // Ligne d'un foyer (aperçu, merci) : nom, cadeaux, objectif, actions rapides.
  function ligneFoyer(p, t, { actions = true } = {}) {
    const st = p.statut === 'envoye' ? 'fait' : R.enRetard(E, p, t) ? 'retard' : p.statut === 'ecrit' ? 'bientot' : '';
    const suivant = p.statut === 'a-ecrire' ? `<button class="btn petit primaire" data-action="ecrire" data-id="${p.id}">Écrire</button>` : p.statut === 'ecrit' ? `<button class="btn petit primaire" data-action="statut" data-id="${p.id}" data-statut="envoye">${ICONES.coche}Envoyé</button>` : '';
    return `<li class="ligne-transverse st-${st}">
      <button class="lien-ligne" data-action="foyer" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${resumeCadeaux(p)}${p.statut !== 'envoye' ? ` · ${esc(canal(p.canal).court)}${p.canal === 'poste' && !R.adresseComplete(p) ? ' (adresse manquante)' : ''}` : ''}</span></button>
      <span class="lt-droite">${etiqObjectif(p, t)}${actions ? suivant : ''}</span>
    </li>`;
  }

  // ---------- Aperçu ----------
  function vueApercu() {
    const t = auj();
    const v = ev();
    const ind = R.indicateurs(E, v.id, t);
    if (!ind.foyers) {
      return `${bandeEvenement()}<div class="vue-tete"><div><h1>${esc(v.nom)}</h1><p>Rien de noté pour l'instant.</p></div></div>
        <div class="vide-etat">${FORME_VIDE}<div><h3>Note le premier ${esc(mot(true))}</h3><p>Un nom, ce qui a été offert, et c'est tout. Ou colle une liste depuis un tableur ou tes notes : un nom par ligne, suivi du cadeau.</p><div class="actions"><button class="btn primaire" data-action="nouveau-cadeau">${ICONES.plus}${esc(Mot(true))}</button><button class="btn" data-action="importer">Coller une liste</button></div></div></div>${AVERTISSEMENT}`;
    }
    const file = R.aRemercier(E, v.id);
    const totalVisible = ind.avecMontant > 0;
    const tuiles = [
      ['Reste à remercier', ind.reste, ind.reste ? `${pluriel(ind.aEcrire, 'à écrire', 'à écrire')} · ${pluriel(ind.ecrits, 'à envoyer', 'à envoyer')}` : 'tout le monde a été remercié', 'var(--rouge)', 'rond', 'merci'],
      ['Écrits, à envoyer', ind.ecrits, ind.ecrits ? 'cartes prêtes à poster ou à remettre' : 'aucune carte en attente', 'var(--jaune)', '', 'merci'],
      ['Envoyés', ind.envoyes, `${ind.progression} % des foyers remerciés`, 'var(--bleu)', '', 'merci'],
      totalVisible ? ['Total reçu', montant(ind.total), `${pluriel(ind.avecMontant, 'montant noté', 'montants notés')} · ${pluriel(ind.cadeaux, mot(true), mot())}`, 'var(--encre)', 'rond', 'cadeaux'] : [Mot(), ind.cadeaux, `de ${pluriel(ind.avecCadeau, 'foyer')}`, 'var(--encre)', 'rond', 'cadeaux'],
    ].map(([lib, val, d, c, f, cible]) => `<button class="tuile ${f}" style="--c:${c}" data-action="vue" data-vue="${cible}"><p class="surtitre">${lib}</p><b>${val}</b><span>${d}</span></button>`).join('');
    const types = Object.entries(ind.parType).sort((a, b) => b[1].n - a[1].n);
    return `
      ${bandeEvenement()}
      <div class="vue-tete"><div><h1>${esc(v.nom)}</h1><p>${pluriel(ind.foyers, 'foyer')}, ${pluriel(ind.cadeaux, mot(true), mot())}. Note au fil de l'eau, écris quand tu as un moment, et regarde le compteur descendre.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-cadeau">${ICONES.plus}${esc(Mot(true))}</button><button class="btn" data-action="importer">Coller une liste</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="progression-merci"><div><b>${ind.progression} %</b><span>${ind.reste ? `des foyers remerciés · encore ${pluriel(ind.reste, 'foyer')}` : 'des foyers remerciés : bravo, c\'est terminé'}</span></div>${barre(ind.progression)}</div>
      ${ind.retard ? `<div class="alerte-rgpd alerte-retard"><div><b>${pluriel(ind.retard, 'remerciement dépasse', 'remerciements dépassent')} ton objectif de ${pluriel(E.reglages.delaiSemaines, 'semaine')}</b><span>C'est ton objectif, pas une règle : ajuste-le dans les réglages si besoin.</span></div><button class="btn petit" data-action="vue" data-vue="merci">Voir la liste</button></div>` : ''}
      ${ind.sansAdresse ? `<div class="alerte-rgpd"><div><b>${pluriel(ind.sansAdresse, 'foyer', 'foyers')} à remercier par la poste sans adresse</b><span>Complète l'adresse ou change le canal (en main propre, message, de vive voix).</span></div><button class="btn petit" data-action="filtre-cadeaux" data-filtre="sans-adresse">Compléter</button></div>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À remercier en priorité <span>${file.length ? 'L\'objectif le plus proche d\'abord' : ''}</span></h2>
          ${file.length ? `<ul class="liste-taches">${file.slice(0, 8).map((p) => ligneFoyer(p, t)).join('')}</ul>${file.length > 8 ? `<button class="btn lien" data-action="vue" data-vue="merci">Les ${file.length} foyers à remercier</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Tout le monde est remercié</h3><p>Un nouveau cadeau ajouté à un foyer le fait revenir ici.</p></div></div>'}
        </section>
        <section>
          ${ind.cagnottes.length ? `<h2 class="titre-section">Cagnottes</h2><ul class="liste-simple">${ind.cagnottes.map((g) => `<li class="ligne-total"><span><b>${esc(g.nom)}</b><small>${pluriel(g.n, 'participation')}</small></span><b class="nb">${montant(g.total)}</b></li>`).join('')}</ul>` : ''}
          <h2 class="titre-section">Par type</h2>
          <ul class="liste-simple">${types.map(([id, x]) => `<li class="ligne-total"><span>${pastilleCadeau({ type: id })}<small>${pluriel(x.n, mot(true), mot())}</small></span><b class="nb">${x.total ? montant(x.total) : ''}</b></li>`).join('')}</ul>
          <h2 class="titre-section">Tes événements</h2>
          <ul class="liste-simple">${E.evenements.map((x) => { const i = R.indicateurs(E, x.id, t); return `<li><button class="ligne-ev ${x.id === v.id ? 'actif' : ''}" data-action="choisir-evenement" data-id="${x.id}"><span><b>${esc(x.nom)}</b><small>${esc(typeEv(x.type).nom)}${x.date ? ` · ${dateCourte(x.date)}` : ''} · ${i.reste ? `${i.reste} à remercier` : i.avecCadeau ? 'terminé' : 'vide'}</small></span>${barre(i.progression)}</button></li>`; }).join('')}</ul>
          <button class="btn petit" style="margin-top:10px" data-action="nouvel-evenement">${ICONES.plus}Nouvel événement</button>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  // ---------- Cadeaux (foyers) ----------
  function carteFoyer(p, t) {
    const l = R.cadeauxDe(E, p.id);
    const total = l.reduce((s, c) => s + (c.montant || 0), 0);
    return `<li class="carte-personne carte-foyer st-${p.statut}">
      <button class="cp-corps" data-action="foyer" data-id="${p.id}">
        <span class="cp-tete">${etiqStatut(p)}<span class="cp-pos">${total ? montant(total) : ''}</span></span>
        <b>${esc(p.nom)}</b>
        <span class="cp-cadeaux">${l.length ? l.map((c) => `<span class="cp-cadeau">${pastilleCadeau(c)}<span>${esc(c.description || (c.type === 'cagnotte' && c.cagnotte ? c.cagnotte : typeC(c.type).defaut))}</span>${c.montant !== null ? `<small class="nb">${montant(c.montant)}</small>` : ''}</span>`).join('') : `<span class="cp-detail"><i>Aucun ${esc(mot(true))} noté</i></span>`}</span>
        <span class="cp-detail">${esc(canal(p.canal).nom)}${p.canal === 'poste' ? (R.adresseComplete(p) ? ` · ${esc(p.adresse.ville || p.adresse.cp)}` : ' · <span class="manque">adresse manquante</span>') : ''}</span>
      </button>
      ${p.statut !== 'envoye' ? `<div class="cp-pied">${etiqObjectif(p, t)}<button class="btn petit" data-action="ajout-cadeau" data-id="${p.id}">${ICONES.plus}${esc(Mot(true))}</button></div>` : ''}
    </li>`;
  }

  function vueCadeaux() {
    const t = auj();
    const v = ev();
    const q = R.cle(filtre.q);
    const tous = R.personnesDe(E, v.id);
    const garde = (p, f = filtre.cadeaux) => f === 'tous' || p.statut === f || (f === 'sans-adresse' && p.canal === 'poste' && p.statut !== 'envoye' && !R.adresseComplete(p));
    const texteFoyer = (p) => R.cle(`${p.nom} ${p.adresse.ville} ${R.cadeauxDe(E, p.id).map((c) => `${c.description} ${c.cagnotte}`).join(' ')}`);
    const liste = tous.filter((p) => garde(p) && (!q || texteFoyer(p).includes(q))).sort((a, b) => R.STATUTS.indexOf(a.statut) - R.STATUTS.indexOf(b.statut) || a.nom.localeCompare(b.nom, 'fr'));
    const filtres = [['tous', 'Tous'], ['a-ecrire', 'À écrire'], ['ecrit', 'Écrits'], ['envoye', 'Envoyés'], ['sans-adresse', 'Sans adresse']];
    return `
      ${bandeEvenement()}
      <div class="vue-tete"><div><h1>${esc(Mot())}</h1><p>Un foyer par personne ou par famille, avec tout ce qu'il a offert : on lui envoie une seule carte. Le montant et l'adresse sont facultatifs.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-cadeau">${ICONES.plus}${esc(Mot(true))}</button><button class="btn" data-action="importer">Coller une liste</button><button class="btn" data-action="nouveau-foyer">${ICONES.plus}Foyer</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les foyers">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-cle="cadeaux" data-filtre="${id}" aria-pressed="${filtre.cadeaux === id}">${lib} <small>${tous.filter((p) => garde(p, id)).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un nom, un cadeau, une ville" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<ul class="cartes-personnes">${liste.map((p) => carteFoyer(p, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${tous.length ? 'Aucun foyer ne correspond' : `Aucun ${esc(mot(true))} noté`}</h3><p>${tous.length ? 'Change le filtre ou la recherche.' : 'Note-les un par un, ou colle une liste : un nom par ligne, suivi du cadeau et du montant.'}</p><div class="actions"><button class="btn primaire" data-action="nouveau-cadeau">${ICONES.plus}${esc(Mot(true))}</button><button class="btn" data-action="importer">Coller une liste</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // Fiche d'un foyer : cadeaux, adresse, remerciement et message.
  function vueFoyer(p) {
    const t = auj();
    const v = ev();
    const l = R.cadeauxDe(E, p.id);
    const te = typeEv(v.type);
    const tonCourant = filtre.ton && te.tons.includes(filtre.ton) ? filtre.ton : (te.tons.includes(v.ton) ? v.ton : te.tons[0]);
    const modeles = R.modelesPour(B, E, v.type, tonCourant);
    const a = p.adresse;
    return `
      <button class="btn lien retour" data-action="vue" data-vue="cadeaux">${ICONES.gauche}Tous les foyers</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${esc(v.nom)}</p>
          <h1>${esc(p.nom)}</h1>
          <p class="etiquettes-tete">${etiqStatut(p)}${etiqObjectif(p, t)}</p>
          ${p.note ? `<p class="note-fiche">${esc(p.note)}</p>` : ''}
        </div>
        <div class="actions"><button class="btn" data-action="modifier-foyer" data-id="${p.id}">Modifier</button></div></div>
      <div class="colonnes-foyer">
        <section>
          <div class="titre-section titre-avec-action"><h2>${esc(Mot())} <span>${pluriel(l.length, mot(true), mot())}</span></h2><button class="btn petit primaire" data-action="ajout-cadeau" data-id="${p.id}">${ICONES.plus}${esc(Mot(true))}</button></div>
          ${l.length ? `<ul class="liste-taches">${l.map((c) => `<li class="ligne-transverse"><button class="lien-ligne" data-action="cadeau" data-id="${c.id}"><b>${esc(majuscule(R.groupeCadeau(B, c)))}</b><span>${esc(typeC(c.type).nom)}${c.cagnotte ? ` · ${esc(c.cagnotte)}` : ''}${c.recuLe ? ` · reçu le ${dateCourte(c.recuLe)}` : ''}</span></button><span class="lt-droite">${c.montant !== null ? `<b class="nb">${montant(c.montant)}</b>` : ''}${pastilleCadeau(c)}</span></li>`).join('')}</ul>` : `<p class="aide">Aucun ${esc(mot(true))} noté pour ce foyer.</p>`}
          <div class="titre-section titre-avec-action"><h2>Adresse <span>Facultative, pour la poste</span></h2><button class="btn petit" data-action="modifier-foyer" data-id="${p.id}">${R.adresseComplete(p) ? 'Modifier' : 'Ajouter'}</button></div>
          ${Object.values(a).some(Boolean) ? `<address class="adresse-bloc">${R.lignesAdresse(p).map(esc).join('<br>')}</address>` : `<p class="aide">${p.canal === 'poste' ? 'Adresse à compléter pour envoyer la carte par la poste et imprimer l\'étiquette.' : `Pas besoin d'adresse : remerciement ${esc(canal(p.canal).nom.toLowerCase())}.`}</p>`}
        </section>
        <section id="remerciement">
          <h2 class="titre-section">Remerciement</h2>
          <fieldset class="champ"><legend class="sr-only">Statut</legend><div class="choix-statut">${B.statuts.map((s) => `<label><input type="radio" name="statut-foyer" data-statut-foyer="${p.id}" value="${s.id}" ${p.statut === s.id ? 'checked' : ''}><span>${esc(s.nom)}</span></label>`).join('')}</div></fieldset>
          <div class="rang-champs" style="margin-top:12px">
            <label class="champ">Canal<select data-champ-foyer="canal" data-id="${p.id}">${B.canaux.map((c) => `<option value="${c.id}" ${p.canal === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
            ${p.statut === 'envoye' ? `<label class="champ">Envoyé le<input type="date" data-champ-foyer="envoyeLe" data-id="${p.id}" value="${p.envoyeLe || ''}"></label>` : ''}
          </div>
          <h3 class="titre-phase" style="margin-top:20px">Message <span>Choisis un ton, le texte se remplit avec les ${esc(mot())} du foyer</span></h3>
          <div class="choix-statut choix-sens choix-tons" role="group" aria-label="Ton">${te.tons.map((id) => `<button type="button" data-action="ton" data-ton="${id}" aria-pressed="${id === tonCourant}"><span>${esc(nomTon(id))}</span></button>`).join('')}</div>
          <div class="variantes">${modeles.map((m, i) => `<button type="button" class="btn petit ${p.modele === m.id ? 'choisi' : ''}" data-action="generer" data-id="${p.id}" data-modele="${m.id}">${m.perso ? esc(m.nom) : `Modèle ${i + 1}`}</button>`).join('')}</div>
          <label class="champ question"><span>Texte de la carte ou du message</span><textarea data-message="${p.id}" rows="${Math.max(10, p.message.split('\n').length + 2)}" placeholder="Choisis un modèle ci-dessus, ou écris ton propre texte.">${esc(p.message)}</textarea></label>
          <div class="rang">
            <button class="btn primaire" data-action="copier" data-id="${p.id}">Copier le texte</button>
            ${p.statut === 'a-ecrire' ? `<button class="btn" data-action="statut" data-id="${p.id}" data-statut="ecrit">${ICONES.coche}Marquer écrit</button>` : ''}
            ${p.statut !== 'envoye' ? `<button class="btn" data-action="statut" data-id="${p.id}" data-statut="envoye">${ICONES.coche}Marquer envoyé</button>` : ''}
          </div>
          <p class="mention" style="margin-top:8px">Formule d'appel : « ${esc(p.appel || `${p.nom},`)} » (modifiable dans la fiche). Signature : « ${esc(v.signature || 'à renseigner dans l\'événement')} ».</p>
        </section>
      </div>
      <div class="pied-fiche"><button class="btn danger" data-action="supprimer-foyer" data-id="${p.id}">Supprimer ce foyer</button><p class="mention">Supprime le foyer, ses ${esc(mot())} et son message (annulable quelques secondes).</p></div>`;
  }

  // ---------- Merci (file des remerciements) ----------
  function vueMerci() {
    const t = auj();
    const v = ev();
    const ind = R.indicateurs(E, v.id, t);
    const ps = R.personnesDe(E, v.id).filter((p) => R.aDesCadeaux(E, p));
    const tri = (l) => l.sort((a, b) => (R.dateObjectif(E, a) || '9999').localeCompare(R.dateObjectif(E, b) || '9999') || a.nom.localeCompare(b.nom, 'fr'));
    const aEcrire = tri(ps.filter((p) => p.statut === 'a-ecrire'));
    const ecrits = tri(ps.filter((p) => p.statut === 'ecrit'));
    const envoyes = ps.filter((p) => p.statut === 'envoye').sort((a, b) => (b.envoyeLe || '').localeCompare(a.envoyeLe || ''));
    const sansCadeau = R.personnesDe(E, v.id).filter((p) => !R.aDesCadeaux(E, p));
    const colonne = (titre, sous, l, vide) => `<section class="colonne-merci"><h2 class="titre-section">${titre} <span>${sous}</span></h2>${l.length ? `<ul class="liste-taches">${l.map((p) => ligneFoyer(p, t)).join('')}</ul>` : `<div class="vide-etat petit"><div><p>${vide}</p></div></div>`}</section>`;
    return `
      ${bandeEvenement()}
      <div class="vue-tete"><div><h1>Remerciements</h1><p>« Écrire » ouvre le message du foyer, déjà rempli avec ce qu'il a offert. Une fois la carte écrite, puis postée ou remise, coche-la : le compteur descend.</p></div>
        <div class="actions"><button class="btn" data-action="vue" data-vue="etiquettes">Étiquettes d'adresses</button></div></div>
      <div class="progression-merci"><div><b>${ind.envoyes} / ${ind.avecCadeau}</b><span>${ind.reste ? `foyers remerciés · ${pluriel(ind.reste, 'reste', 'restent')} à remercier` : 'foyers remerciés : c\'est terminé'}</span></div>${barre(ind.progression)}</div>
      <div class="colonnes-merci">
        ${colonne('À écrire', pluriel(aEcrire.length, 'foyer'), aEcrire, 'Aucune carte à écrire.')}
        ${colonne('Écrits, à envoyer', pluriel(ecrits.length, 'foyer'), ecrits, 'Aucune carte en attente d\'envoi.')}
      </div>
      <details class="plus-tard" ${filtre.envoyes ? 'open' : ''} data-details="envoyes"><summary>Déjà remerciés · ${envoyes.length}</summary>${envoyes.length ? `<ul class="liste-taches">${envoyes.map((p) => ligneFoyer(p, t, { actions: false })).join('')}</ul>` : '<p class="aide">Personne pour l\'instant.</p>'}</details>
      ${sansCadeau.length ? `<p class="mention" style="margin-top:16px">${pluriel(sansCadeau.length, 'foyer')} sans ${esc(mot(true))} noté (${sansCadeau.slice(0, 5).map((p) => esc(p.nom)).join(', ')}${sansCadeau.length > 5 ? '…' : ''}) : ${sansCadeau.length > 1 ? 'ils n\'apparaissent' : 'il n\'apparaît'} pas dans la liste à remercier.</p>` : ''}`;
  }

  // ---------- Modèles ----------
  function vueModeles() {
    const v = ev();
    const type = filtre.modeleType && B.modeles[filtre.modeleType] ? filtre.modeleType : v.type;
    const te = typeEv(type);
    const ton = filtre.modeleTon !== 'tous' && te.tons.includes(filtre.modeleTon) ? filtre.modeleTon : 'tous';
    const l = R.modelesPour(B, E, type, ton === 'tous' ? null : ton);
    // Aperçu rempli avec un foyer de l'événement courant (même type), sinon un foyer d'exemple.
    const fp = type === v.type ? R.personnesDe(E, v.id) : [];
    const exemple = fp.find((p) => R.cadeauxDe(E, p.id).length > 1 && R.contexteMessage(B, E, p).argent) || fp.find((p) => R.cadeauxDe(E, p.id).length > 1) || fp.find((p) => R.aDesCadeaux(E, p)) || null;
    let ctxE = E, pid = exemple?.id;
    if (!exemple) {
      ctxE = R.normaliser({ evenements: [{ id: 'x', type, signature: v.type === type ? v.signature : 'Ta signature', concerne: te.concerne ? 'Léo' : '', projet: te.festif ? 'un vélo' : '' }], personnes: [{ id: 'p', evenement: 'x', nom: 'Léa', appel: 'Chère Léa,' }], cadeaux: [{ personne: 'p', type: te.cadeaux[0], description: type === 'obseques' ? 'les fleurs' : 'la lampe de bureau' }, { personne: 'p', type: 'presence' }] });
      pid = 'p';
    }
    const apercu = (m) => R.remplir(m.texte, R.contexteMessage(B, ctxE, ctxE.personnes.find((x) => x.id === pid)));
    return `
      ${bandeEvenement()}
      <div class="vue-tete"><div><h1>Modèles de messages</h1><p>${Object.values(B.modeles).flat().length} modèles originaux, par événement et par ton, remplis avec les ${esc(mot())} de chaque foyer. Aperçu avec ${exemple ? `<b>${esc(exemple.nom)}</b>` : 'un foyer d\'exemple'}.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-modele">${ICONES.plus}Mon modèle</button></div></div>
      <div class="filtres" role="group" aria-label="Événement">${B.evenements.map((x) => `<button class="filtre" data-action="filtre" data-cle="modeleType" data-filtre="${x.id}" aria-pressed="${x.id === type}">${esc(x.nom)}</button>`).join('')}</div>
      <div class="filtres" role="group" aria-label="Ton" style="margin-top:4px">${[['tous', 'Tous les tons'], ...te.tons.map((x) => [x, nomTon(x)])].map(([id, lib]) => `<button class="filtre" data-action="filtre" data-cle="modeleTon" data-filtre="${id}" aria-pressed="${id === ton}">${esc(lib)}</button>`).join('')}</div>
      <ul class="cartes-modeles">${l.map((m) => `<li class="carte-modele-msg ${m.perso ? 'perso' : ''}">
        <div class="cmm-tete"><span class="etiquette ${m.perso ? 'ciel' : 'sable'}">${m.perso ? esc(m.nom) : esc(nomTon(m.ton))}</span>${m.perso ? `<span class="etiquette sable">${esc(nomTon(m.ton))}</span>` : ''}</div>
        <p class="cmm-texte">${esc(apercu(m)).replace(/\n/g, '<br>')}</p>
        <div class="rang"><button class="btn petit" data-action="copier-modele" data-modele="${m.id}" data-type="${type}">Copier le modèle</button>${m.perso ? `<button class="btn petit" data-action="modifier-modele" data-id="${m.id}">Modifier</button>` : ''}</div>
      </li>`).join('')}</ul>
      <p class="mention" style="margin-top:16px">Champs remplis automatiquement dans un modèle : {appel} formule d'appel, {cadeaux} ce que le foyer a offert, {occasion}, {concerne} prénom de l'enfant ou de la personne disparue, {projet} ce que l'argent reçu permettra, {signature}. Le texte reste modifiable foyer par foyer.</p>`;
  }

  // ---------- Étiquettes ----------
  function selectionEtiquettes() {
    const v = ev();
    const ps = R.personnesDe(E, v.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const candidats = filtre.selection === 'tous' ? ps : ps.filter((p) => p.canal === 'poste' && p.statut !== 'envoye' && R.aDesCadeaux(E, p));
    return { avec: candidats.filter(R.adresseComplete), sans: candidats.filter((p) => !R.adresseComplete(p)) };
  }
  function vueEtiquettes() {
    const r = E.reglages;
    const { avec, sans } = selectionEtiquettes();
    const res = R.etiquettes(B, avec, r.format, filtre.depart, { x: r.decalageX, y: r.decalageY });
    const f = res.format;
    const apercu = (res.planches[0] || []);
    const pct = (x, tot) => `${(x / tot) * 100}%`;
    return `
      ${bandeEvenement()}
      <div class="vue-tete"><div><h1>Étiquettes d'adresses</h1><p>Sur une planche A4 d'étiquettes autocollantes. Choisis le format de ta planche, vérifie l'aperçu, imprime à taille réelle (100 %, sans ajustement à la page).</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer-etiquettes" ${avec.length ? '' : 'disabled'}>Imprimer ${pluriel(avec.length, 'étiquette')}</button></div></div>
      <div class="colonnes-etiquettes">
        <section class="reglages-etiquettes">
          <label class="champ">Format de la planche<select data-reglage="format">${B.etiquettes.map((x) => `<option value="${x.id}" ${x.id === f.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
          <fieldset class="champ"><legend>Foyers</legend><div class="choix-statut choix-2">${[['poste', 'À remercier par la poste'], ['tous', 'Tous ceux qui ont une adresse']].map(([id, lib]) => `<label><input type="radio" name="selection" data-filtre-radio="selection" value="${id}" ${filtre.selection === id ? 'checked' : ''}><span>${lib}</span></label>`).join('')}</div></fieldset>
          <label class="champ">Commencer à l'étiquette n°<small>Planche déjà entamée : 1 = en haut à gauche, de gauche à droite.</small><input type="number" min="1" max="${res.parPlanche}" value="${Math.min(filtre.depart, res.parPlanche)}" data-filtre-nombre="depart" inputmode="numeric"></label>
          <div class="rang-champs">
            <label class="champ">Décalage horizontal (mm)<input type="number" step="0.5" min="-10" max="10" value="${r.decalageX}" data-reglage="decalageX" inputmode="decimal"></label>
            <label class="champ">Décalage vertical (mm)<input type="number" step="0.5" min="-10" max="10" value="${r.decalageY}" data-reglage="decalageY" inputmode="decimal"></label>
          </div>
          <p class="aide">Conseil : imprime d'abord sur une feuille ordinaire et pose-la sur la planche à contre-jour. Si le texte est décalé, corrige avec les décalages (positif : vers la droite ou vers le bas).</p>
          ${sans.length ? `<div class="alerte-rgpd"><div><b>${pluriel(sans.length, 'foyer')} sans adresse complète</b><span>${sans.slice(0, 6).map((p) => esc(p.nom)).join(', ')}${sans.length > 6 ? '…' : ''}</span></div><button class="btn petit" data-action="filtre-cadeaux" data-filtre="sans-adresse">Compléter</button></div>` : ''}
        </section>
        <section>
          <p class="surtitre">Aperçu · planche 1${res.planches.length > 1 ? ` sur ${res.planches.length}` : ''}</p>
          <div class="planche-apercu" role="img" aria-label="Aperçu de la planche : ${pluriel(apercu.length, 'étiquette')} sur ${res.parPlanche}">
            ${Array.from({ length: res.parPlanche }, (_, k) => { const col = k % f.colonnes, lig = Math.floor(k / f.colonnes); return `<span class="case-vide" style="left:${pct(f.gauche + col * f.pasX, 210)};top:${pct(f.haut + lig * f.pasY, 297)};width:${pct(f.largeur, 210)};height:${pct(f.hauteur, 297)}"></span>`; }).join('')}
            ${apercu.map((x) => `<span class="etiq" style="left:${pct(x.x, 210)};top:${pct(x.y, 297)};width:${pct(x.largeur, 210)};height:${pct(x.hauteur, 297)}">${x.lignes.map(esc).join('<br>')}</span>`).join('')}
          </div>
          <p class="mention" style="margin-top:8px">${avec.length ? `${pluriel(avec.length, 'étiquette')} sur ${pluriel(res.planches.length, 'planche')} de ${res.parPlanche}.` : 'Aucun foyer avec une adresse complète dans cette sélection.'}</p>
        </section>
      </div>`;
  }

  function imprimerEtiquettes() {
    const r = E.reglages;
    const { avec } = selectionEtiquettes();
    if (!avec.length) return;
    const res = R.etiquettes(B, avec, r.format, filtre.depart, { x: r.decalageX, y: r.decalageY });
    const el = preparerImpression();
    el.className = 'impr-etiquettes';
    el.innerHTML = res.planches.map((pl) => `<div class="planche">${pl.map((x) => `<div class="etiq-impr" style="left:${x.x}mm;top:${x.y}mm;width:${x.largeur}mm;height:${x.hauteur}mm"><div>${x.lignes.map(esc).join('<br>')}</div></div>`).join('')}</div>`).join('');
    document.body.classList.add('impr-fiche');
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  function preparerImpression() {
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    return el;
  }
  window.addEventListener('afterprint', () => { document.body.classList.remove('impr-fiche'); });

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
  const PIED_STD = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>';

  function modaleEvenement(id) {
    const v = id ? R.evenement(E, id) : null;
    const x = v || { type: 'mariage', nom: '', date: '', occasion: '', concerne: '', projet: '', signature: ev()?.signature || '', ton: 'chaleureux' };
    const corps = `
      <label class="champ">Type d'événement<select name="type" id="m-type">${B.evenements.map((t) => `<option value="${t.id}" ${t.id === x.type ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Nom<input name="nom" maxlength="80" value="${esc(x.nom)}" placeholder="${esc(exempleNom(x.type))}"></label>
        <label class="champ">Date<input type="date" name="date" value="${x.date || ''}"></label>
      </div>
      <label class="champ">Signature des messages<small>Ex. : « Camille et Hugo », « Hugo et toute la famille »</small><input name="signature" maxlength="80" value="${esc(x.signature)}"></label>
      <label class="champ" id="m-concerne" ${typeEv(x.type).concerne ? '' : 'hidden'}><span id="m-concerne-lib">${esc(typeEv(x.type).concerne || 'Prénom')}</span><small>Facultatif, repris dans certains messages.</small><input name="concerne" maxlength="60" value="${esc(x.concerne)}"></label>
      <label class="champ">L'occasion, dans une phrase<small>Après « votre attention pour… ». Vide : « ${esc(R.occasionDe(B, { ...x, occasion: '' }))} ». Ex. : « le baptême de Léo », « mes 40 ans ».</small><input name="occasion" maxlength="80" value="${esc(x.occasion)}"></label>
      <label class="champ" id="m-projet" ${typeEv(x.type).festif ? '' : 'hidden'}>Ce que l'argent reçu permettra<small>Facultatif : « notre voyage de noces », « un vélo électrique ». Ajouté aux messages des foyers qui ont donné de l'argent.</small><input name="projet" maxlength="100" value="${esc(x.projet)}"></label>
      <label class="champ">Ton proposé par défaut<select name="ton" id="m-ton">${typeEv(x.type).tons.map((t) => `<option value="${t}" ${t === x.ton ? 'selected' : ''}>${esc(nomTon(t))}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">${v ? 'Enregistrer' : 'Créer'}</button><button class="btn" value="annuler">Annuler</button>${v ? '<button class="btn danger gauche" value="effacer" type="submit">Effacer l\'événement</button>' : ''}`;
    ouvrirModale(v ? 'Modifier l\'événement' : 'Nouvel événement', corps, pied, (f, choix) => {
      if (choix === 'effacer') { setTimeout(() => effacerEvenement(v.id), 0); return; }
      const type = String(f.get('type'));
      const n = R.normaliserEvenement({ ...(v || {}), type, nom: String(f.get('nom') || '').trim() || exempleNom(type), date: f.get('date'), signature: f.get('signature'), concerne: f.get('concerne'), occasion: f.get('occasion'), projet: typeEv(type).festif ? f.get('projet') : '', ton: f.get('ton') });
      retenir();
      if (v) Object.assign(v, n);
      else { E.evenements.push(n); E.courant = n.id; fiche = null; filtre.modeleType = null; }
      sauver(); rendre();
      toast(v ? 'Événement enregistré.' : `Événement créé. Note le premier ${typeEv(type).motUn}.`);
    });
    $('#m-type').addEventListener('change', (e) => {
      const t = typeEv(e.target.value);
      $('#m-concerne').hidden = !t.concerne; $('#m-concerne-lib').textContent = t.concerne || 'Prénom';
      $('#m-projet').hidden = !t.festif;
      $('#m-ton').innerHTML = t.tons.map((x) => `<option value="${x}">${esc(nomTon(x))}</option>`).join('');
      const nom = modale().querySelector('[name=nom]'); nom.placeholder = exempleNom(t.id);
    });
  }

  function effacerEvenement(id) {
    const v = R.evenement(E, id);
    if (!v) return;
    const ind = R.indicateurs(E, id, auj());
    if (!confirm(`Effacer « ${v.nom} » et tout ce qu'il contient (${pluriel(ind.foyers, 'foyer')}, ${pluriel(ind.cadeaux, typeEv(v.type).motUn, typeEv(v.type).mot)}, adresses et messages) ? Pense à exporter le CSV avant si tu veux en garder une trace.`)) return;
    retenir();
    E = R.sansEvenement(E, id);
    fiche = null;
    sauver(); changerVue('apercu');
    toast('Événement effacé.', { libelle: 'Annuler', faire: annuler });
  }

  // Champs d'un cadeau (modale cadeau et nouveau foyer).
  function champsCadeau(c, typeEvId) {
    const ordre = typeEv(typeEvId).cadeaux;
    const cagnottes = [...new Set(R.cadeauxEvenement(E, E.courant).filter((x) => x.cagnotte).map((x) => x.cagnotte))];
    const t = c.type || ordre[0];
    return `
      <div class="rang-champs">
        <label class="champ">Type<select name="type" id="m-type-cadeau">${ordre.map((id) => `<option value="${id}" ${id === t ? 'selected' : ''}>${esc(typeC(id).nom)}</option>`).join('')}</select></label>
        <label class="champ">Montant (€)<small>Facultatif</small><input name="montant" inputmode="decimal" value="${c.montant !== null && c.montant !== undefined ? String(c.montant / 100).replace('.', ',') : ''}" placeholder="Ex. : 50"></label>
      </div>
      <label class="champ" id="m-cagnotte" ${t === 'cagnotte' ? '' : 'hidden'}>Nom de la cagnotte<small>Facultatif, pour les totaux par cagnotte</small><input name="cagnotte" list="liste-cagnottes" maxlength="60" value="${esc(c.cagnotte || '')}" placeholder="Ex. : Voyage de noces"><datalist id="liste-cagnottes">${cagnottes.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist></label>
      <label class="champ">Ce qui a été offert<small id="m-aide-desc">Écrit comme dans une phrase de remerciement, après « merci pour… ». Vide : « ${esc(typeC(t).defaut)} ».</small><input name="description" maxlength="120" value="${esc(c.description || '')}" placeholder="${esc(typeC(t).exemple || typeC(t).defaut)}"></label>
      <label class="champ">Reçu le<input type="date" name="recuLe" value="${c.recuLe || auj()}"></label>`;
  }
  function brancherChampsCadeau() {
    $('#m-type-cadeau')?.addEventListener('change', (e) => {
      const t = typeC(e.target.value);
      $('#m-cagnotte').hidden = t.id !== 'cagnotte';
      $('#m-aide-desc').textContent = `Écrit comme dans une phrase de remerciement, après « merci pour… ». Vide : « ${t.defaut} ».`;
      modale().querySelector('[name=description]').placeholder = t.exemple || t.defaut;
    });
  }
  function lireCadeau(f) {
    const brut = String(f.get('montant') || '').trim();
    const m = R.lireMontant(brut);
    if (brut && m === null) return 'Montant illisible : écris par exemple 50 ou 50,50, ou laisse vide.';
    return { type: String(f.get('type')), montant: m, cagnotte: String(f.get('cagnotte') || ''), description: String(f.get('description') || ''), recuLe: String(f.get('recuLe') || '') || auj() };
  }

  // Nouveau cadeau : pour un foyer existant ou un nouveau foyer.
  function modaleCadeau(id, { pid = null } = {}) {
    const c = id ? cadeau(id) : null;
    const v = ev();
    const foyers = R.personnesDe(E, v.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const choixPid = c ? c.personne : pid;
    const corps = `
      ${c || pid ? `<p class="aide">De la part de <b>${esc(personne(choixPid).nom)}</b>.</p><input type="hidden" name="foyer" value="${choixPid}">` : `
      <label class="champ">De la part de<select name="foyer" id="m-foyer"><option value="">Nouveau foyer…</option>${foyers.map((p) => `<option value="${p.id}">${esc(p.nom)}</option>`).join('')}</select></label>
      <label class="champ" id="m-nouveau-nom">Nom du nouveau foyer<small>Nom d'usage : « Tante Agnès et Paul », « Famille Roux », « Collègues de Camille »</small><input name="nom" maxlength="80" autocomplete="off"></label>`}
      ${champsCadeau(c || {}, v.type)}
      <p class="erreur" role="alert"></p>`;
    const pied = c ? `${PIED_STD}<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? `Modifier le ${esc(mot(true))}` : `Nouveau ${esc(mot(true))}`, corps, pied, (f, choix) => {
      if (choix === 'supprimer') {
        retenir(); E.cadeaux = E.cadeaux.filter((x) => x.id !== c.id); sauver(); rendre();
        toast(`${Mot(true)} supprimé.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      let foyerId = String(f.get('foyer') || '');
      const nom = String(f.get('nom') || '').trim();
      if (!foyerId && !nom) return 'Choisis un foyer ou indique le nom du nouveau foyer.';
      const lu = lireCadeau(f);
      if (typeof lu === 'string') return lu;
      retenir();
      if (!foyerId) {
        const existant = foyers.find((p) => R.cle(p.nom) === R.cle(nom));
        if (existant) foyerId = existant.id;
        else { const p = R.normaliserPersonne({ evenement: v.id, nom }); E.personnes.push(p); foyerId = p.id; }
      }
      if (c) Object.assign(c, R.normaliserCadeau({ ...c, ...lu }));
      else {
        E.cadeaux.push(R.normaliserCadeau({ ...lu, personne: foyerId }));
        const p = personne(foyerId);
        if (p.statut === 'envoye') { p.statut = 'a-ecrire'; p.envoyeLe = null; toast(`${p.nom} avait déjà été remercié : repassé « à écrire » pour ce nouveau ${mot(true)}.`); }
      }
      sauver(); rendre();
      if (choix === 'encore') { modaleCadeau(null); modale().dataset.garder = '1'; toast(`${Mot(true)} ajouté. Le suivant ?`); return; }
      if (!c && !document.querySelector('#toast:not([hidden])')) toast(`${Mot(true)} ajouté.`, { libelle: 'Annuler', faire: annuler });
    });
    brancherChampsCadeau();
    $('#m-foyer')?.addEventListener('change', (e) => { $('#m-nouveau-nom').hidden = Boolean(e.target.value); });
  }

  function modaleFoyer(id) {
    const p = id ? personne(id) : null;
    const v = ev();
    const x = p || { nom: '', appel: '', adresse: R.normaliserAdresse({}), canal: 'poste', note: '' };
    const a = x.adresse;
    const corps = `
      <label class="champ">Nom du foyer<small>Une personne ou une famille, comme tu la nommes : « Tante Agnès et Paul ». Pas d'information sensible.</small><input name="nom" required maxlength="80" value="${esc(x.nom)}" autocomplete="off"></label>
      <label class="champ">Formule d'appel<small>Début du message. Vide : « ${esc(x.nom || 'Nom du foyer')}, »</small><input name="appel" maxlength="80" value="${esc(x.appel)}" placeholder="Ex. : Chère Agnès, cher Paul,"></label>
      <label class="champ">Remerciement<select name="canal">${B.canaux.map((c) => `<option value="${c.id}" ${x.canal === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      <fieldset class="champ cadre-champs"><legend>Adresse postale <small>Facultative : seulement pour une carte par la poste et l'étiquette.</small></legend>
        <label class="champ">Nom sur l'enveloppe<small>Vide : le nom du foyer</small><input name="destinataire" maxlength="80" value="${esc(a.destinataire)}" autocomplete="off"></label>
        <label class="champ">Adresse<input name="ligne1" maxlength="80" value="${esc(a.ligne1)}" autocomplete="off"></label>
        <label class="champ">Complément<input name="ligne2" maxlength="80" value="${esc(a.ligne2)}" autocomplete="off"></label>
        <div class="rang-champs"><label class="champ">Code postal<input name="cp" maxlength="12" value="${esc(a.cp)}" inputmode="numeric" autocomplete="off"></label><label class="champ">Ville<input name="ville" maxlength="60" value="${esc(a.ville)}" autocomplete="off"></label></div>
        <label class="champ">Pays<small>Seulement à l'étranger</small><input name="pays" maxlength="40" value="${esc(a.pays)}" autocomplete="off"></label>
      </fieldset>
      ${p ? '' : champsCadeau({}, v.type).replace('Ce qui a été offert', `Premier ${esc(mot(true))} (facultatif)`)}
      <label class="champ">Note<small>Facultative, pour toi. Aucune donnée sensible.</small><input name="note" maxlength="200" value="${esc(x.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le foyer' : 'Nouveau foyer', corps, p ? PIED_STD : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du foyer.';
      const autre = R.personnesDe(E, v.id).find((y) => y.id !== p?.id && R.cle(y.nom) === R.cle(nom));
      if (autre) return `« ${autre.nom} » existe déjà dans cet événement : ajoute-lui plutôt un ${mot(true)}.`;
      const champs = { nom, appel: f.get('appel'), canal: f.get('canal'), note: f.get('note'), adresse: R.normaliserAdresse(Object.fromEntries(['destinataire', 'ligne1', 'ligne2', 'cp', 'ville', 'pays'].map((k) => [k, f.get(k)]))) };
      let lu = null;
      if (!p && (String(f.get('description') || '').trim() || String(f.get('montant') || '').trim() || f.get('type') === 'presence')) { lu = lireCadeau(f); if (typeof lu === 'string') return lu; }
      retenir();
      if (p) Object.assign(p, R.normaliserPersonne({ ...p, ...champs }));
      else {
        const n = R.normaliserPersonne({ ...champs, evenement: v.id });
        E.personnes.push(n);
        if (lu) E.cadeaux.push(R.normaliserCadeau({ ...lu, personne: n.id }));
        fiche = n.id; vue = 'cadeaux';
      }
      sauver(); rendre();
      toast(p ? 'Foyer enregistré.' : 'Foyer ajouté.', { libelle: 'Annuler', faire: annuler });
    });
    if (!p) brancherChampsCadeau();
  }

  // Import d'une liste collée : analyse, aperçu, puis import.
  function modaleImport() {
    const v = ev();
    let analyse = null;
    const corps = `
      <p>Colle ta liste depuis un tableur ou tes notes : <b>une ligne par ${esc(mot(true))}</b>, colonnes séparées par une tabulation (copie d'un tableur) ou un point-virgule.</p>
      <p class="aide">nom ; ce qui a été offert ; montant ; adresse ; code postal ; ville<br>Seul le nom est obligatoire. Une ligne d'en-tête est ignorée ; deux lignes au même nom vont au même foyer. Un nom par ligne suffit pour créer les foyers.</p>
      <label class="champ"><span class="sr-only">Liste</span><textarea name="liste" rows="8" placeholder="Tante Agnès et Paul ; la machine à pain&#10;Famille Roux ; cagnotte ; 150&#10;Julien B. ; chèque ; 50"></textarea></label>
      <div id="apercu-import"></div>
      <p class="erreur" role="alert"></p>`;
    const pied = '<button class="btn primaire" value="importer" id="b-importer" disabled>Importer</button><button class="btn" value="analyser">Vérifier la liste</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale('Coller une liste', corps, pied, (f, choix) => {
      if (choix === 'analyser' || !analyse) {
        analyse = R.analyserListe(f.get('liste'));
        const zone = $('#apercu-import');
        if (!analyse.foyers.length) { zone.innerHTML = ''; $('#b-importer').disabled = true; return 'Aucune ligne lisible : un nom par ligne au minimum.'; }
        const existants = new Set(R.personnesDe(E, v.id).map((p) => R.cle(p.nom)));
        zone.innerHTML = `<div class="apercu-liste"><p><b>${pluriel(analyse.foyers.length, 'foyer')}</b> · ${pluriel(analyse.nbCadeaux, mot(true), mot())}${analyse.foyers.filter((x) => existants.has(R.cle(x.nom))).length ? ` · ${analyse.foyers.filter((x) => existants.has(R.cle(x.nom))).length} déjà présents (complétés, pas dupliqués)` : ''}</p>
          <ul>${analyse.foyers.slice(0, 8).map((x) => `<li><b>${esc(x.nom)}</b> ${x.cadeaux.map((c) => `${pastilleCadeau(c)} ${esc(c.description || (c.type === 'cagnotte' ? 'cagnotte' : ''))}${c.montant !== null ? ` ${R.formatMontant(c.montant)}` : ''}`).join(' · ')}${x.adresse.ville ? ` <small>· ${esc(x.adresse.ville)}</small>` : ''}</li>`).join('')}${analyse.foyers.length > 8 ? `<li>… et ${analyse.foyers.length - 8} autres</li>` : ''}</ul>
          ${analyse.erreurs.length ? `<p class="erreur">${analyse.erreurs.map(esc).join('<br>')}</p>` : ''}</div>`;
        $('#b-importer').disabled = false;
        return '';
      }
      retenir();
      const r = R.importer(E, v.id, analyse.foyers, auj());
      E = r.E;
      filtre.cadeaux = 'tous'; fiche = null; vue = 'cadeaux';
      sauver(); rendre();
      toast(`${pluriel(r.crees, 'foyer créé', 'foyers créés')}${r.completes ? `, ${pluriel(r.completes, 'complété', 'complétés')}` : ''}, ${pluriel(r.cadeaux, mot(true), mot())}.`, { libelle: 'Annuler', faire: annuler });
    });
    modale().querySelector('[name=liste]').addEventListener('input', () => { analyse = null; $('#b-importer').disabled = true; });
  }

  function modaleModele(id) {
    const m = id ? E.modelesPerso.find((x) => x.id === id) : null;
    const x = m || { nom: '', evenement: ev().type, ton: 'chaleureux', texte: '{appel}\n\nMerci pour {cadeaux}.\n\n{signature}' };
    const corps = `
      <label class="champ">Nom du modèle<input name="nom" maxlength="60" value="${esc(x.nom)}" placeholder="Ex. : Pour les collègues"></label>
      <div class="rang-champs">
        <label class="champ">Événement<select name="evenement"><option value="tous">Tous les événements</option>${B.evenements.map((t) => `<option value="${t.id}" ${t.id === x.evenement ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
        <label class="champ">Ton<select name="ton">${B.tons.map((t) => `<option value="${t.id}" ${t.id === x.ton ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Texte<small>Champs remplis : {appel} {cadeaux} {occasion} {concerne} {projet} {signature}</small><textarea name="texte" rows="8" maxlength="2000">${esc(x.texte)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? 'Modifier mon modèle' : 'Mon modèle', corps, m ? `${PIED_STD}<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, choix) => {
      if (choix === 'supprimer') { retenir(); E.modelesPerso = E.modelesPerso.filter((y) => y.id !== m.id); sauver(); rendre(); toast('Modèle supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const n = R.normaliserModele({ ...(m || {}), nom: f.get('nom'), evenement: f.get('evenement'), ton: f.get('ton'), texte: f.get('texte') });
      if (!n.texte) return 'Le texte est vide.';
      retenir();
      if (m) Object.assign(m, n); else E.modelesPerso.push(n);
      filtre.modeleType = n.evenement === 'tous' ? filtre.modeleType : n.evenement;
      filtre.modeleTon = 'tous';
      sauver(); rendre(); toast(m ? 'Modèle enregistré.' : 'Modèle ajouté : il est proposé dans la fiche des foyers.');
    });
  }

  // ---------- Actions sur un foyer ----------
  function changerStatut(pid, statut) {
    const p = personne(pid);
    if (!p || p.statut === statut) return;
    retenir();
    p.statut = statut;
    p.envoyeLe = statut === 'envoye' ? auj() : null;
    sauver();
    const y = window.scrollY; rendre(); window.scrollTo({ top: y });
    const reste = R.indicateurs(E, p.evenement, auj()).reste;
    toast(statut === 'envoye' ? (reste ? `${p.nom} remercié. Encore ${pluriel(reste, 'foyer')}.` : 'Tout le monde est remercié. Bravo !') : `${p.nom} : ${nomStatut(statut).toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
  }
  function generer(pid, modeleId) {
    const p = personne(pid);
    if (!p) return;
    if (p.message && p.modele !== modeleId && !confirm('Remplacer le texte actuel par ce modèle ?')) return;
    retenir();
    p.modele = modeleId;
    p.message = R.genererMessage(B, E, pid, modeleId);
    sauver();
    const y = window.scrollY; rendre(); window.scrollTo({ top: y });
  }
  async function copierTexte(texte, ok) {
    try { await navigator.clipboard.writeText(texte); toast(ok); } catch {
      const z = document.createElement('textarea'); z.value = texte; document.body.appendChild(z); z.select();
      try { document.execCommand('copy'); toast(ok); } catch { toast('Copie impossible : sélectionne le texte à la main.'); }
      z.remove();
    }
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const v = ev();
    const corps = `
      <label class="champ">Objectif d'envoi des remerciements (semaines)<small>Ton objectif personnel, compté depuis la date de l'événement (ou du cadeau s'il arrive après). Ce n'est pas une règle.</small><input type="number" name="delaiSemaines" min="1" max="26" value="${r.delaiSemaines}"></label>
      <label class="case"><input type="checkbox" name="masquerMontants" ${r.masquerMontants ? 'checked' : ''}> Masquer les montants à l'écran (si d'autres personnes regardent)</label>
      <p class="erreur" role="alert"></p>
      ${v ? `<div class="groupe"><h3>${esc(v.nom)}</h3><p class="aide">Exporte en tableur (une ligne par ${esc(typeEv(v.type).motUn)}, avec les adresses et le statut des remerciements).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button><button class="btn petit" type="button" data-action="modifier-evenement">Modifier l'événement</button></div></div>
      <div class="groupe"><h3>Données des foyers</h3><p class="aide">Une fois les cartes parties, les adresses ne servent plus : efface-les. Tu peux aussi effacer tout l'événement.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="effacer-adresses">Effacer les adresses des foyers remerciés</button><button class="btn petit danger" type="button" data-action="effacer-evenement">Effacer l'événement</button></div></div>` : ''}
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du suivi, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Les foyers sont des tiers : tu es responsable de ce que tu saisis. L'outil ne demande qu'un nom d'usage et, si tu envoies par la poste, une adresse ; ni téléphone, ni e-mail, ni information sensible. Les montants sont facultatifs. Efface les adresses une fois les cartes parties, et l'événement quand tu n'en as plus besoin.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">${Object.values(B.modeles).flat().length} modèles de messages originaux, rédigés pour QME (base intégrée version ${B.version}). Formats d'étiquettes : dimensions de planches A4 courantes, à vérifier sur ta planche. Aucun message n'est envoyé par l'outil.</p></div>`;
    ouvrirModale('Réglages', corps, PIED_STD, (f) => {
      E.reglages = R.normaliserReglages({ ...E.reglages, delaiSemaines: Number(f.get('delaiSemaines')), masquerMontants: f.get('masquerMontants') === 'on' });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.evenements) || !Array.isArray(d.personnes)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.evenements.length, 'événement')}, ${pluriel(d.personnes.length, 'foyer')}) ?`)) return;
        const vu = E.tutorielVu; E = normaliser(d); delete E.majLe; E.tutorielVu = Boolean(E.tutorielVu || vu); fiche = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
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
  const slug = (s) => R.cle(s).replace(/ /g, '-').slice(0, 40) || 'evenement';
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `remerciements-${auj()}.json`);
  const exporterCsv = () => { const v = ev(); if (v) telecharger(R.csvEvenement(B, E, v.id), 'text/csv;charset=utf-8', `remerciements-${slug(v.nom)}-${auj()}.csv`); };
  function effacerAdresses() {
    const v = ev();
    const r = R.effacerAdresses(E, v.id);
    if (!r.n) { toast('Aucune adresse à effacer : aucun foyer remercié n\'a d\'adresse enregistrée.'); return; }
    if (!confirm(`Effacer les adresses de ${pluriel(r.n, 'foyer remercié', 'foyers remerciés')} de « ${v.nom} » ?`)) return;
    retenir(); E = r.E;
    if (modale().open) modale().close();
    sauver(); rendre();
    toast(`${pluriel(r.n, 'adresse effacée', 'adresses effacées')}.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const d = E.reglages.delaiSemaines;
    const blocs = [
      ['rose', 'Note qui a offert quoi', `Chaque ${esc(mot(true))} est rattaché à un foyer&nbsp;: une personne, un couple, une famille. Objet, argent, cagnotte, attention&nbsp;: note-le dès qu'il arrive. Une liste déjà tapée ailleurs se colle d'un coup avec <b>Coller une liste</b>.`],
      ['beurre', 'Un message prêt par foyer', `Choisis un ton et un modèle&nbsp;: le texte se remplit avec les ${esc(mot())} du foyer, sa formule d'appel et ta signature. Retouche-le à ta guise, puis copie-le. L'outil n'envoie rien&nbsp;: c'est toi qui écris ou envoies la carte.`],
      ['ciel', 'À écrire, écrit, envoyé', `Chaque foyer avance d'un statut à l'autre. Le remerciement devrait partir ${pluriel(d, 'semaine')} après l'événement (ou après le premier ${esc(mot(true))}, s'il arrive plus tard)&nbsp;: au-delà, le foyer est signalé en retard. Ce délai se règle dans les réglages.`],
      ['sable', 'Les cartes par la poste', `Pour une carte envoyée par la poste, ajoute l'adresse du foyer&nbsp;: l'onglet <b>Étiquettes</b> imprime les étiquettes sur planches A4. Une fois les remerciements envoyés, efface les adresses qui ne servent plus.`],
    ];
    const corps = `
      <p>L'outil prépare un message de remerciement pour chaque foyer et compte ce qu'il reste à envoyer. Ton rôle&nbsp;: noter chaque ${esc(mot(true))} reçu, puis marquer chaque remerciement écrit et envoyé.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide">L'<b>Aperçu</b> montre l'avancement et le reste à remercier, <b>Merci</b> la file des foyers à remercier, <b>Modèles</b> tous les modèles et les tiens. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && ev() && !E.cadeaux.length;
    const pied = premier
      ? `<button class="btn primaire" value="cadeau">Noter mon premier ${esc(mot(true))}</button><button class="btn" value="ok">Fermer</button>`
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'cadeau') setTimeout(() => modaleCadeau(null), 0); });
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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; fiche = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'filtre-cadeaux': if (modale().open) modale().close(); filtre.cadeaux = el.dataset.filtre; changerVue('cadeaux'); break;
      case 'foyer': if (modale().open) modale().close(); changerVue('cadeaux', { fiche: id }); break;
      case 'ecrire': changerVue('cadeaux', { fiche: id, ancre: 'remerciement' }); break;
      case 'choisir-evenement': E.courant = id; fiche = null; filtre.modeleType = null; sauver(); rendre(); window.scrollTo({ top: 0 }); break;
      case 'nouvel-evenement': modaleEvenement(null); break;
      case 'modifier-evenement': if (modale().open) modale().close(); modaleEvenement(E.courant); break;
      case 'effacer-evenement': if (modale().open) modale().close(); effacerEvenement(E.courant); break;
      case 'effacer-adresses': effacerAdresses(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-cadeau': modaleCadeau(null); break;
      case 'ajout-cadeau': modaleCadeau(null, { pid: id }); break;
      case 'cadeau': modaleCadeau(id); break;
      case 'nouveau-foyer': modaleFoyer(null); break;
      case 'modifier-foyer': modaleFoyer(id); break;
      case 'supprimer-foyer': { const p = personne(id); if (p && confirm(`Supprimer ${p.nom}, ses ${mot()} et son message ?`)) { retenir(); E.personnes = E.personnes.filter((x) => x.id !== id); E.cadeaux = E.cadeaux.filter((c) => c.personne !== id); sauver(); changerVue('cadeaux'); toast('Foyer supprimé.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'importer': modaleImport(); break;
      case 'statut': changerStatut(id, el.dataset.statut); break;
      case 'ton': filtre.ton = el.dataset.ton; { const y = window.scrollY; rendre(); window.scrollTo({ top: y }); } break;
      case 'generer': generer(id, el.dataset.modele); break;
      case 'copier': { const p = personne(id); const z = document.querySelector(`[data-message="${id}"]`); const txt = z ? z.value : p?.message; if (txt) copierTexte(txt, 'Texte copié : colle-le dans ton message ou recopie-le sur la carte.'); else toast('Choisis d\'abord un modèle ou écris le texte.'); break; }
      case 'copier-modele': { const m = R.modelesPour(B, E, el.dataset.type).find((x) => x.id === el.dataset.modele); if (m) copierTexte(m.texte, 'Modèle copié, avec ses champs entre accolades.'); break; }
      case 'nouveau-modele': modaleModele(null); break;
      case 'modifier-modele': modaleModele(id); break;
      case 'imprimer-etiquettes': imprimerEtiquettes(); break;
      case 'filtre': filtre[el.dataset.cle] = el.dataset.filtre; if (el.dataset.cle === 'modeleType') filtre.modeleTon = 'tous'; rendre(); break;
      default: break;
    }
  });

  // Saisie du message : enregistrée au fil de la frappe, sans redessiner.
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.message) {
      const p = personne(el.dataset.message);
      if (p) { p.message = el.value.slice(0, 3000); sauver(); }
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.select === 'courant') { E.courant = el.value; fiche = null; filtre.modeleType = null; filtre.ton = null; sauver(); rendre(); }
    else if (el.dataset.statutFoyer) changerStatut(el.dataset.statutFoyer, el.value);
    else if (el.dataset.champFoyer) {
      const p = personne(el.dataset.id);
      if (!p) return;
      retenir();
      if (el.dataset.champFoyer === 'canal') p.canal = el.value;
      if (el.dataset.champFoyer === 'envoyeLe') p.envoyeLe = R.estDate(el.value) ? el.value : null;
      sauver(); const y = window.scrollY; rendre(); window.scrollTo({ top: y });
    } else if (el.dataset.reglage) {
      E.reglages = R.normaliserReglages({ ...E.reglages, [el.dataset.reglage]: el.type === 'number' ? Number(String(el.value).replace(',', '.')) : el.value });
      sauver(); rendre();
    } else if (el.dataset.filtreRadio) { filtre[el.dataset.filtreRadio] = el.value; rendre(); }
    else if (el.dataset.filtreNombre) { filtre[el.dataset.filtreNombre] = Math.max(1, Math.round(Number(el.value)) || 1); rendre(); }
  });
  document.addEventListener('toggle', (e) => { if (e.target.dataset?.details === 'envoyes') filtre.envoyes = e.target.open; }, true);

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && !saisieEnCours()) rendre(); // la date du jour a pu changer
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
  window.__remerciements = { etat: () => E, regles: R };
  init();
})();
