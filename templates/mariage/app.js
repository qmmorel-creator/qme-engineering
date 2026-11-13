// Organisateur de mariage QME : rétroplanning, budget et prestataires, invités, plan de table, jour J.
// Données synchronisées par clé d'accès (même socle que le planning de révision).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.MRG;
  const API = '/api/templates';
  const PRODUIT = 'MRG';
  const CLE_CODE = 'qme-mrg-code';
  const CLE_CACHE = 'qme-mrg-cache';
  const CLE_DEMO = 'qme-mrg-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-mrg-ecran-accueil';

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
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '');
  const fmtLong = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const eur = R.euros, eurR = R.eurosRonds;
  const saisieMontant = (c) => (Number.isInteger(c) && c > 0 ? (c % 100 ? `${Math.floor(c / 100)},${deux(c % 100)}` : String(c / 100)) : '');
  const relatif = (j) => (j === 0 ? 'aujourd\'hui' : j === 1 ? 'demain' : j === -1 ? 'hier' : j > 0 ? `dans ${pluriel(j, 'jour')}` : `il y a ${pluriel(-j, 'jour')}`);
  const cat = (id) => B.categories.find((c) => c.id === id) || B.categories[0];
  const AVERTISSEMENT = 'Outil d\'organisation : les montants sont ceux que tu saisis, les contrats et factures de tes prestataires font foi. Les délais du rétroplanning sont des suggestions, pas des obligations.';
  const RGPD = 'Ta liste d\'invités contient des données personnelles de tes proches. Les allergies et certains régimes sont des données de santé, protégées par le RGPD : ne note que ce qui sert au repas, avec l\'accord de la personne, partage ta clé seulement avec les organisateurs et efface ces informations après le mariage (Réglages).';

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  let sousPlanning = 'retro';
  let filtreTaches = 'afaire';
  let filtreInv = { groupe: '', reponse: '', texte: '' };
  let annulation = null;

  const etatVide = () => ({ version: 1, noms: ['', ''], date: '', lieu: '', budgetGlobal: 0, taches: [], postes: [], prestataires: [], groupes: [], invites: [], tables: [], jourJ: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    return { ...v, ...d,
      noms: Array.isArray(d.noms) ? [String(d.noms[0] || ''), String(d.noms[1] || '')] : ['', ''],
      taches: tab(d.taches).map((t) => ({ categorie: 'lieu', avant: 0, date: null, fait: null, note: '', ...t })),
      postes: tab(d.postes).map((p) => ({ prevu: 0, ...p })),
      prestataires: tab(d.prestataires).map((p) => ({ statut: 'contacter', devis: 0, contact: '', note: '', ...p, paiements: tab(p.paiements) })),
      groupes: tab(d.groupes), tables: tab(d.tables), jourJ: tab(d.jourJ),
      invites: tab(d.invites).map((i) => ({ enfant: false, reponse: 'attente', regime: 'Sans restriction', allergies: '', tableId: null, groupeId: null, ...i })) };
  };
  const instantane = () => { annulation = structuredClone(E); };
  const couple = () => (E.noms.filter(Boolean).length ? E.noms.filter(Boolean).join(' et ') : 'Notre mariage');
  const nomsGroupes = (n1, n2) => B.groupes.map((g) => g.replace('{1}', n1 || 'Mariée ou marié 1').replace('{2}', n2 || 'Mariée ou marié 2'));
  const tachesBase = () => B.taches.map((t) => ({ id: uid(), titre: t.titre, categorie: t.categorie, avant: t.avant, date: null, fait: null, note: t.note || '' }));
  const jourJBase = () => B.jourJ.map((x) => ({ id: uid(), titre: x.titre, heure: x.heure, qui: '', fait: false }));

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
        toast('Un autre appareil a modifié l\'organisation entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code MRG-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3))) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
  // Un couple fictif dont le mariage a lieu dans 140 jours : tâches faites, en retard, cette semaine, à venir ;
  // budget avec dépassement, paiement en retard, prestataires dans tous les statuts ; réponses variées ;
  // table en surcapacité, invités confirmés sans table, invité ayant décliné encore placé.
  function donneesDemo() {
    const D = etatVide();
    const t = auj();
    D.noms = ['Léa', 'Malik'];
    D.date = R.ajoutJours(t, 140);
    D.lieu = 'Salle des fêtes et domaine (exemple)';
    D.budgetGlobal = 3500000;
    D.taches = tachesBase();
    const retard = ['Contacter la mairie : rendez-vous, liste des pièces et délais du dossier de mariage', 'Choisir et commander les faire-part'];
    D.taches.forEach((x, i) => {
      const e = R.echeance(x, D.date);
      if (e < t && !retard.includes(x.titre)) x.fait = R.ajoutJours(e, -(i % 4)) < t ? R.ajoutJours(e, -(i % 4)) : t;
    });
    // Fait aujourd'hui (en avance) et une tâche ajoutée à date fixe.
    const coiffure = D.taches.find((x) => x.titre.startsWith('Réserver coiffure'));
    coiffure.fait = t;
    D.taches.push({ id: uid(), titre: 'Dégustation chez le traiteur', categorie: 'reception', avant: 0, date: R.ajoutJours(t, 4), fait: null, note: 'Apporter la liste des régimes.' });

    const montants = { 'Lieu de réception': 650000, 'Traiteur et boissons': 900000, 'Pâtisserie et gâteau': 90000, 'Tenues et accessoires': 250000, 'Alliances': 120000,
      'Coiffure et maquillage': 60000, 'Photo et vidéo': 220000, 'Musique et animation': 140000, 'Fleurs et décoration': 130000, 'Faire-part et papeterie': 50000,
      'Cérémonie': 30000, 'Transport': 60000, 'Hébergement': 0, 'Cadeaux des invités': 40000, 'Voyage de noces': 400000, 'Imprévus': 150000 };
    D.postes = B.postes.map((nom) => ({ id: uid(), nom, prevu: montants[nom] || 0 }));
    const poste = (nom) => D.postes.find((p) => p.nom === nom).id;
    const pai = (libelle, montant, j, payeJ) => ({ id: uid(), libelle, montant, echeance: j === null ? '' : R.ajoutJours(t, j), paye: payeJ === undefined ? null : R.ajoutJours(t, payeJ) });
    const presta = (nom, posteNom, statut, devis, contact, paiements = [], note = '') => ({ id: uid(), nom, posteId: poste(posteNom), statut, devis, contact, note, paiements });
    D.prestataires = [
      presta('Le domaine (réception)', 'Lieu de réception', 'reserve', 620000, 'Visite faite, contrat signé', [pai('Acompte', 186000, -200, -200), pai('Deuxième acompte', 186000, 20), pai('Solde', 248000, 126)], 'Salle, jardin et parking. Fin de soirée à 4 h.'),
      presta('Traiteur n° 1', 'Traiteur et boissons', 'reserve', 980000, 'Dégustation prévue', [pai('Acompte', 294000, -60, -58), pai('Deuxième acompte', 294000, -5), pai('Solde', 392000, 133)], 'Devis pour 100 couverts, vin compris.'),
      presta('Traiteur n° 2', 'Traiteur et boissons', 'devis', 870000, 'Devis par e-mail', [], 'Gardé en option.'),
      presta('Photographe', 'Photo et vidéo', 'reserve', 210000, 'Rendez-vous fait', [pai('Acompte', 63000, -150, -150), pai('Solde', 147000, 140)]),
      presta('DJ', 'Musique et animation', 'devis', 145000, 'À rappeler'),
      presta('Fleuriste', 'Fleurs et décoration', 'contacter', 0, ''),
      presta('Boutique de robes', 'Tenues et accessoires', 'reserve', 165000, '', [pai('Acompte', 50000, -90, -90), pai('Solde', 115000, 30)]),
      presta('Costume sur mesure', 'Tenues et accessoires', 'reserve', 98000, '', [pai('Commande', 98000, -40, -40)]),
      presta('Bijoutier', 'Alliances', 'reserve', 112000, '', [pai('Paiement', 112000, -20, -20)]),
      presta('Coiffeuse à domicile', 'Coiffure et maquillage', 'reserve', 52000, '', [pai('Acompte', 15000, 0, 0), pai('Solde', 37000, 140)]),
      presta('Location de voiture ancienne', 'Transport', 'ecarte', 75000, ''),
    ];

    const g = nomsGroupes('Léa', 'Malik');
    D.groupes = g.map((nom) => ({ id: uid(), nom }));
    const prenoms = [
      ['Hélène', 'Bernard', 'Sophie', 'Jean', 'Camille', 'Théo', 'Inès', 'Paul', 'Margaux', 'Lucien', 'Rose*', 'Arthur*', 'Odile', 'Gérard'],
      ['Nadia', 'Karim', 'Samia', 'Yanis', 'Leïla', 'Mehdi', 'Sarah', 'Adam*', 'Lina*', 'Rachid', 'Fatima', 'Omar'],
      ['Julie', 'Thomas', 'Emma', 'Hugo', 'Chloé', 'Louis', 'Manon', 'Nathan', 'Clara', 'Antoine', 'Zoé*'],
      ['Pauline', 'Marion', 'Anaïs', 'Laura', 'Élodie', 'Justine', 'Mathilde', 'Céline'],
      ['Sofiane', 'Bilal', 'Kevin', 'Romain', 'Maxime', 'Julien', 'Nicolas'],
      ['Valérie', 'Stéphane', 'Aurélie', 'Damien', 'Isabelle', 'Fabrice', 'Sandrine'],
    ];
    const initiales = 'BDFGHKLMNPRSTV';
    let k = 0;
    prenoms.forEach((liste, gi) => liste.forEach((p) => {
      const enfant = p.endsWith('*');
      const nom = `${p.replace('*', '')} ${initiales[(k * 5 + gi) % initiales.length]}.`;
      const r = k % 9;
      const reponse = gi === 5 && k % 2 ? 'attente' : r === 4 ? 'non' : r === 2 || r === 7 ? 'attente' : 'oui';
      D.invites.push({ id: uid(), nom, groupeId: D.groupes[gi].id, enfant, reponse, regime: enfant ? 'Menu enfant' : k % 11 === 3 ? 'Végétarien' : k % 17 === 6 ? 'Sans porc' : k === 20 ? 'Végétalien' : 'Sans restriction', allergies: k === 15 ? 'Fruits à coque' : k === 33 ? 'Crustacés' : '', tableId: null });
      k += 1;
    }));
    D.tables = [{ id: uid(), nom: 'Table d\'honneur', places: 8 }, ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: uid(), nom: `Table ${n}`, places: 10 }))];
    // Placement : par groupe, en remplissant les tables dans l'ordre ; quelques confirmés laissés à placer.
    let ti = 1, n = 0;
    const venus = D.invites.filter((i) => i.reponse !== 'non');
    venus.forEach((i, idx) => {
      if (idx >= venus.length - 3) return; // derniers : à placer
      if (n >= D.tables[ti].places) { ti = Math.min(ti + 1, D.tables.length - 1); n = 0; }
      i.tableId = D.tables[ti].id; n += 1;
    });
    // Table d'honneur : proches des mariés ; deux confirmés sans table ; Table 2 remplie au-delà de sa capacité.
    [0, 1, 14, 15, 26, 27].forEach((x) => { if (D.invites[x].reponse !== 'non') D.invites[x].tableId = D.tables[0].id; });
    D.invites.filter((i) => i.reponse === 'oui').slice(-2).forEach((i) => { i.tableId = null; });
    const t2 = D.tables[2];
    let n2 = D.invites.filter((i) => i.tableId === t2.id && i.reponse !== 'non').length;
    for (const i of D.invites.filter((x) => x.reponse !== 'non' && x.tableId && x.tableId !== t2.id && x.tableId !== D.tables[0].id)) {
      if (n2 > t2.places) break;
      i.tableId = t2.id; n2 += 1;
    }
    const declin = D.invites.find((i) => i.reponse === 'non');
    declin.tableId = D.tables[4].id;

    D.jourJ = jourJBase();
    const heures = { 'Coiffure et maquillage': '09:00', 'Photos des préparatifs': '11:30', 'Départ vers la cérémonie': '14:15', 'Cérémonie': '15:00', 'Photos de groupe (liste des groupes prête)': '16:00', 'Vin d\'honneur': '17:00', 'Dîner': '20:00', 'Ouverture du bal': '23:00' };
    const qui = { 'Alliances confiées à un témoin': 'Nadia', 'Enveloppes des paiements du jour remises': 'Thomas', 'Plan de table affiché à l\'entrée': 'Julie', 'Discours et musiques transmis à l\'animateur': 'Hugo' };
    D.jourJ.forEach((x) => { x.heure = heures[x.titre] || ''; x.qui = qui[x.titre] || ''; });
    D.jourJ[0].fait = true;
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Organisateur de mariage · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="150" cy="150" r="110" fill="none" stroke="#F5B400" stroke-width="28"/>
          <circle cx="260" cy="150" r="110" fill="none" stroke="#F0EDE6" stroke-width="28"/>
          <rect x="400" y="40" width="120" height="120" fill="#1D4E89"/>
          <path d="M400 280 A120 120 0 0 1 520 160 V280 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Organisateur de mariage</p>
          <h1>Le grand jour, sans le grand désordre.</h1>
          <p>Rétroplanning calé sur ta date, budget et prestataires, invités et plan de table : tout au même endroit, partagé à deux.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton organisateur</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et vous suivent, toi et ta moitié, sur tous vos appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon organisateur</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec un mariage d'exemple</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon organisateur'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  function ecranAccueil() {
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>Félicitations ! On prépare votre mariage.</h1>
      <p class="intro">Quelques informations pour caler le rétroplanning. Tout reste modifiable dans les réglages.</p>
      <form id="form-accueil" class="form-accueil" novalidate>
        <div class="rang-2">
          <label class="champ">Premier prénom<input name="n1" maxlength="30" placeholder="Ex. : Léa" autocomplete="off"></label>
          <label class="champ">Second prénom<input name="n2" maxlength="30" placeholder="Ex. : Malik" autocomplete="off"></label>
        </div>
        <div class="rang-2">
          <label class="champ">Date du mariage<small>Facultative : sans date, le rétroplanning attend.</small><input type="date" name="date"></label>
          <label class="champ">Budget global<small>Facultatif, en euros.</small><input name="budget" inputmode="decimal" placeholder="0 €" autocomplete="off"></label>
        </div>
        <label class="champ">Lieu<small>Facultatif.</small><input name="lieu" maxlength="80" autocomplete="off"></label>
        <fieldset class="choix-depart"><legend>Pour commencer</legend>
          <label class="case"><input type="checkbox" name="taches" checked> Rétroplanning type (${B.taches.length} tâches sur 12 mois)</label>
          <label class="case"><input type="checkbox" name="postes" checked> Postes de budget types (${B.postes.length}, sans montant)</label>
          <label class="case"><input type="checkbox" name="groupes" checked> Groupes d'invités (familles, amis, collègues)</label>
          <label class="case"><input type="checkbox" name="jourj" checked> Checklist du jour J (${B.jourJ.length} points)</label>
        </fieldset>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer notre organisateur</button></div>
      </form></div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const budget = String(f.get('budget') || '').trim();
      if (budget && R.versCentimes(budget) === null) { $('#erreur-accueil').textContent = 'Budget illisible : écris par exemple 15 000.'; return; }
      E = etatVide();
      E.noms = [String(f.get('n1') || '').trim(), String(f.get('n2') || '').trim()];
      E.date = R.valideIso(String(f.get('date') || '')) ? String(f.get('date')) : '';
      E.lieu = String(f.get('lieu') || '').trim();
      E.budgetGlobal = budget ? R.versCentimes(budget) : 0;
      if (f.get('taches')) E.taches = tachesBase();
      if (f.get('postes')) E.postes = B.postes.map((nom) => ({ id: uid(), nom, prevu: 0 }));
      if (f.get('groupes')) E.groupes = nomsGroupes(E.noms[0], E.noms[1]).map((nom) => ({ id: uid(), nom }));
      if (f.get('jourj')) E.jourJ = jourJBase();
      sauver();
      vue = 'planning';
      history.replaceState(null, '', '#planning');
      demarrer();
      toast(E.date ? 'Organisateur créé : le rétroplanning est calé sur votre date.' : 'Organisateur créé. Ajoute la date du mariage dans les réglages pour caler le rétroplanning.');
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="15" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="7" height="4" fill="currentColor"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    invites: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="17" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M1 21a7 7 0 0 1 14 0Z" fill="currentColor"/><path d="M14 21a5 5 0 0 1 9 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    tables: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><circle cx="12" cy="3" r="2" fill="currentColor"/><circle cx="12" cy="21" r="2" fill="currentColor"/><circle cx="3" cy="12" r="2" fill="currentColor"/><circle cx="21" cy="12" r="2" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['planning', 'Planning'], ['budget', 'Budget'], ['invites', 'Invités'], ['tables', 'Tables']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/mariage/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Mariage fictif, données gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Organisateur<br>de mariage</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · ${couple()}`;
    $('#vue').innerHTML = { apercu: vueApercu, planning: vuePlanning, budget: vueBudget, invites: vueInvites, tables: vueTables }[vue]();
    brancherInfobulles();
    if (vue === 'invites') brancherFiltres();
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="34" cy="48" r="26" fill="none" stroke="#F5B400" stroke-width="10"/><circle cx="62" cy="48" r="26" fill="none" stroke="#1D4E89" stroke-width="10"/></svg>';
  const vide = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const etiquette = (classe, texte) => `<span class="etiquette ${classe}">${esc(texte)}</span>`;
  const ETAT_TACHE = { retard: ['rouge', 'En retard'], semaine: ['jaune', 'Cette semaine'], fait: ['bleu', 'Fait'], avenir: ['', ''] };
  const planningCourant = () => R.planning(E.taches, E.date, auj(), B.periodes);

  // ----- Aperçu -----
  function compteRebours() {
    if (!E.date) return `<div class="compte-carte vide"><p class="surtitre">Date du mariage</p><p class="compte">?</p><p>Ajoute la date dans les réglages pour caler le rétroplanning.</p><button class="btn petit" data-action="reglages">Ajouter la date</button></div>`;
    const j = R.joursAvant(E.date, auj());
    if (j < 0) return `<div class="compte-carte calme"><p class="surtitre">Mariés depuis</p><p class="compte">${-j}<small>${-j > 1 ? 'jours' : 'jour'}</small></p><p>${esc(fmtLong(E.date))}</p></div>`;
    if (j === 0) return `<div class="compte-carte"><p class="surtitre">C'est aujourd'hui</p><p class="compte">J</p><p>Belle journée à vous deux.</p></div>`;
    return `<div class="compte-carte"><p class="surtitre">Jour J dans</p><p class="compte">${j}<small>${j > 1 ? 'jours' : 'jour'}</small></p><p>${esc(fmtLong(E.date))}${E.lieu ? ` · ${esc(E.lieu)}` : ''}</p></div>`;
  }

  function ligneTache(t, avecPeriode = false) {
    const c = cat(t.categorie);
    const [cl, lib] = ETAT_TACHE[t.statut];
    const quand = t.statut === 'fait' ? `fait le ${fmt(t.fait, { day: 'numeric', month: 'short' })}` : t.echeance ? `${fmt(t.echeance)} · ${relatif(t.joursRestants)}` : 'sans date';
    return `<li class="tache ${t.statut}" style="--c:${c.couleur}">
      <button class="coche" data-action="cocher" data-id="${t.id}" aria-pressed="${t.statut === 'fait'}" aria-label="${t.statut === 'fait' ? 'Marquer à faire' : 'Marquer fait'} : ${esc(t.titre)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="3"/></svg></button>
      <button class="tache-corps" data-action="tache" data-id="${t.id}">
        <b>${esc(t.titre)}</b>
        <span class="tache-meta"><i></i>${esc(c.nom)} · ${esc(quand)}${t.date ? ' · date fixe' : ''}${avecPeriode ? ` · ${esc(B.periodes[t.periode].nom.toLowerCase())}` : ''}${t.note ? ' · note' : ''}</span>
      </button>
      ${lib ? etiquette(cl, lib) : ''}
    </li>`;
  }

  function vueApercu() {
    const l = planningCourant();
    const b = R.bilanTaches(l);
    const urgent = l.filter((t) => t.statut === 'retard' || t.statut === 'semaine');
    const prochaines = urgent.length ? urgent : l.filter((t) => t.statut === 'avenir').slice(0, 3);
    const titre = !E.taches.length ? 'Votre rétroplanning est vide.'
      : b.retard ? `${pluriel(b.retard, 'tâche')} en retard${b.semaine ? `, ${b.semaine} cette semaine` : ''}.`
        : b.semaine ? `${pluriel(b.semaine, 'tâche')} à faire cette semaine.` : 'Tout est à jour.';
    const bud = R.budgetParPoste(E.postes, E.prestataires);
    const ech = R.echeancesAVenir(E.prestataires, auj());
    const s = R.statsInvites(E.invites);
    const plan = R.planDeTable(E.tables, E.invites);
    const tuiles = tuilesBudget(bud.total);
    const progression = b.total ? `<div class="progression" role="img" aria-label="${b.fait} tâches faites sur ${b.total}">${l.map((t) => `<span class="${t.statut === 'fait' ? 'fait' : t.statut === 'retard' ? 'retard' : ''}"></span>`).join('')}</div><p class="sous">${b.fait} sur ${b.total} tâches faites (${b.taux} %).</p>` : '';
    return `
      <div class="jour">
        <section class="jour-titre">
          <p class="surtitre">${esc(couple())}</p>
          <h1>${titre}</h1>
          ${progression}
          <div class="actions"><button class="btn primaire" data-action="vue" data-vue="planning">Voir le rétroplanning</button><button class="btn" data-action="tache">${ICONES.plus}Tâche</button></div>
        </section>
        ${compteRebours()}
      </div>
      <h2 class="titre-section">${urgent.length ? 'À faire maintenant' : 'Prochaines tâches'} <span>${urgent.length ? 'En retard et dans les 7 jours.' : ''}</span></h2>
      ${prochaines.length ? `<ul class="taches">${prochaines.slice(0, 8).map((t) => ligneTache(t, true)).join('')}</ul>${urgent.length > 8 ? `<p class="aide">Et ${urgent.length - 8} autres dans le Planning.</p>` : ''}` : vide('Rien à faire pour l\'instant', E.taches.length ? 'Toutes les tâches sont faites. Profitez-en.' : 'Ajoute le rétroplanning type depuis l\'onglet Planning.', '<button class="btn primaire" data-action="vue" data-vue="planning">Planning</button>')}
      <h2 class="titre-section">Budget <span>${E.budgetGlobal ? `Budget global ${eurR(E.budgetGlobal)}` : ''}</span></h2>
      <div class="tuiles">${tuiles}</div>
      <div class="deux-colonnes">
        <section>
          <h2 class="titre-section">Prochains paiements <span>${ech.length ? pluriel(ech.length, 'échéance') : ''}</span></h2>
          ${ech.length ? `<ul class="liste-simple">${ech.slice(0, 5).map(ligneEcheance).join('')}</ul>` : '<p class="carte-calme">Aucun paiement en attente.</p>'}
        </section>
        <section>
          <h2 class="titre-section">Réponses des invités <span>${pluriel(s.total, 'invité')}</span></h2>
          ${blocReponses(s)}
        </section>
      </div>
      <h2 class="titre-section">Plan de table <span>${plan.occupees} placés sur ${plan.places} places</span></h2>
      ${plan.alertes.length ? `<ul class="liste-alertes">${plan.alertes.map((a) => `<li><button data-action="vue" data-vue="tables"><i></i><span><b>${esc(a.texte)}</b></span>${etiquette(a.type === 'nonPlaces' ? 'jaune' : 'rouge', a.type === 'surcapacite' ? 'Capacité' : a.type === 'nonPlaces' ? 'À placer' : 'À retirer')}</button></li>`).join('')}</ul>` : `<p class="carte-calme">${E.tables.length ? 'Aucune alerte : chaque invité confirmé a sa place.' : 'Aucune table pour l\'instant.'}</p>`}
      <p class="avertissement">${esc(AVERTISSEMENT)}</p>`;
  }

  function tuilesBudget(t) {
    return [
      ['Prévu', eurR(t.prevu), E.budgetGlobal ? (E.budgetGlobal - t.prevu >= 0 ? `${eurR(E.budgetGlobal - t.prevu)} non affectés` : `${eurR(t.prevu - E.budgetGlobal)} au-delà du budget global`) : 'somme des postes', 'var(--encre)', 'rond'],
      ['Engagé', eurR(t.engage), 'devis des prestataires réservés', 'var(--bleu)', '', t.prevu && t.engage > t.prevu],
      ['Payé', eurR(t.paye), t.engage ? `${Math.round((t.paye / t.engage) * 100)} % de l'engagé` : 'paiements réglés', 'var(--vert)', 'rond'],
      ['Reste à payer', eurR(t.reste), 'acomptes et soldes à venir', 'var(--jaune)', ''],
    ].map(([lib, v, d, col, f, alerte]) => `<div class="tuile ${f}" style="--c:${col}"><p class="surtitre">${lib}</p><b${alerte ? ' class="moins"' : ''}>${v}</b><span>${esc(d)}</span></div>`).join('');
  }

  function ligneEcheance(x) {
    return `<li><button data-action="paiement" data-presta="${x.prestataireId}" data-id="${x.id}" class="${x.retard ? 'retard' : ''}">
      <span><b>${esc(x.prestataire)}</b><small>${esc(x.libelle || 'Paiement')} · ${x.echeance ? `${fmt(x.echeance)} · ${relatif(x.jours)}` : 'sans date'}</small></span>
      <strong>${eur(x.montant)}</strong>${x.retard ? etiquette('rouge', 'En retard') : ''}</button></li>`;
  }

  function blocReponses(s) {
    if (!s.total) return vide('Aucun invité', 'Ajoute tes invités, un par un ou plusieurs d\'un coup.', '<button class="btn primaire" data-action="vue" data-vue="invites">Invités</button>');
    const parts = [['oui', 'Oui', 'var(--bleu)'], ['attente', 'En attente', 'var(--jaune)'], ['non', 'Non', 'var(--rouge)']];
    const n = (k) => s[k].adultes + s[k].enfants;
    const regimes = Object.entries(s.regimes);
    return `<div class="reponses">
      <div class="pile" role="img" aria-label="${parts.map(([k, l]) => `${l} : ${n(k)}`).join(', ')}">${parts.map(([k, l, c]) => (n(k) ? `<i style="flex:${n(k)};background:${c}" data-info="${esc(`${l}|${n(k)} invités`)}"></i>` : '')).join('')}</div>
      <ul class="legende-rep">${parts.map(([k, l, c]) => `<li><i style="background:${c}"></i><b>${n(k)}</b> ${l}<small>${s[k].adultes} adulte${s[k].adultes > 1 ? 's' : ''}, ${s[k].enfants} enfant${s[k].enfants > 1 ? 's' : ''}</small></li>`).join('')}</ul>
      <p class="sous">Couverts à prévoir : <b>${s.couverts}</b> (oui et en attente), dont ${s.confirmes} confirmés.</p>
      ${regimes.length || s.allergies.length ? `<p class="sous">Pour le traiteur : ${regimes.map(([r, k]) => `${k} ${esc(r.toLowerCase())}`).join(', ')}${s.allergies.length ? `${regimes.length ? ', ' : ''}${pluriel(s.allergies.length, 'allergie')} signalée${s.allergies.length > 1 ? 's' : ''}` : ''}.</p>` : ''}
    </div>`;
  }

  // Infobulles : tout élément [data-info="titre|valeur"] dans un .graphique ou .reponses.
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el, e) => {
        const [t, ...v] = el.dataset.info.split('|');
        bulle.innerHTML = `<b>${esc(t)}</b>${v.map((x) => `<div>${esc(x)}</div>`).join('')}`;
        bulle.hidden = false;
        const rf = fig.getBoundingClientRect();
        let x = e.clientX - rf.left + 14, y = e.clientY - rf.top + 14;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, e.clientX - rf.left - bulle.offsetWidth - 14);
        if (y + bulle.offsetHeight > rf.height - 8) y = Math.max(8, e.clientY - rf.top - bulle.offsetHeight - 14);
        bulle.style.left = `${x}px`; bulle.style.top = `${y}px`;
      };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointermove', (e) => montrer(el, e));
        el.addEventListener('click', (e) => montrer(el, e));
      });
      fig.addEventListener('pointerleave', () => { bulle.hidden = true; });
    });
  }

  // ----- Planning -----
  function vuePlanning() {
    const bascule = `<div class="bascule-vue" role="tablist" aria-label="Partie du planning">
      <button role="tab" data-action="sous-planning" data-v="retro" aria-selected="${sousPlanning === 'retro'}">Rétroplanning</button>
      <button role="tab" data-action="sous-planning" data-v="jourj" aria-selected="${sousPlanning === 'jourj'}">Jour J</button></div>`;
    return sousPlanning === 'jourj' ? vueJourJ(bascule) : vueRetro(bascule);
  }

  function vueRetro(bascule) {
    const l = planningCourant();
    const b = R.bilanTaches(l);
    const visibles = filtreTaches === 'afaire' ? l.filter((t) => t.statut !== 'fait') : l;
    const tete = `<div class="vue-tete"><div><p class="surtitre">${E.date ? `Calé sur le ${esc(fmtLong(E.date))}` : 'Date du mariage à fixer'}</p><h1>Rétroplanning</h1>
      <p>${b.total ? `${b.fait} sur ${b.total} faites${b.retard ? `, <b class="rouge-texte">${b.retard} en retard</b>` : ''}.` : ''} Les échéances suivent la date du mariage : si elle change, tout se recale.</p></div>
      <div class="actions"><button class="btn primaire" data-action="tache">${ICONES.plus}Tâche</button></div></div>`;
    if (!E.taches.length) return `${bascule}${tete}${vide('Aucune tâche', `Pars du rétroplanning type (${B.taches.length} tâches sur 12 mois) ou ajoute tes propres tâches.`, '<button class="btn primaire" data-action="ajout-base-taches">Ajouter le rétroplanning type</button>')}${encartDemarches()}`;
    const groupes = B.periodes.map((p, i) => ({ p, taches: visibles.filter((t) => t.periode === i) })).filter((g) => g.taches.length);
    return `${bascule}${tete}
      ${E.date ? '' : '<p class="aide">Sans date de mariage, les tâches n\'ont pas d\'échéance. <button class="btn lien" data-action="reglages">Ajouter la date</button></p>'}
      <div class="filtre-taches" role="group" aria-label="Filtre"><button class="btn petit ${filtreTaches === 'afaire' ? 'actif' : ''}" data-action="filtre-taches" data-v="afaire" aria-pressed="${filtreTaches === 'afaire'}">À faire (${b.total - b.fait})</button><button class="btn petit ${filtreTaches === 'tout' ? 'actif' : ''}" data-action="filtre-taches" data-v="tout" aria-pressed="${filtreTaches === 'tout'}">Tout (${b.total})</button></div>
      ${groupes.length ? groupes.map((g) => {
        const debut = g.taches[0].echeance, fin = g.taches[g.taches.length - 1].echeance;
        return `<section class="periode"><h2 class="titre-section">${esc(g.p.nom)} <span>${debut ? (debut === fin ? fmt(debut, { day: 'numeric', month: 'long' }) : `${fmt(debut, { day: 'numeric', month: 'short' })} → ${fmt(fin, { day: 'numeric', month: 'short', year: 'numeric' })}`) : ''}</span></h2>
          <ul class="taches">${g.taches.map((t) => ligneTache(t)).join('')}</ul></section>`;
      }).join('') : vide('Tout est fait', 'Chaque tâche du rétroplanning est cochée.', '<button class="btn" data-action="filtre-taches" data-v="tout">Tout afficher</button>')}
      ${encartDemarches()}`;
  }

  function encartDemarches() {
    const s = B.sourceDemarches;
    return `<aside class="encart"><h3>${esc(s.titre)}</h3><p>${esc(s.texte)}</p><p class="source">Source : <a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.source)}</a></p></aside>`;
  }

  function vueJourJ(bascule) {
    const faits = E.jourJ.filter((x) => x.fait).length;
    const tete = `<div class="vue-tete"><div><p class="surtitre">${E.date ? esc(fmtLong(E.date)) : 'Le grand jour'}</p><h1>Checklist du jour J</h1>
      <p>${E.jourJ.length ? `${faits} sur ${E.jourJ.length} cochés. ` : ''}Indique l'heure et qui s'en charge, puis confie la liste à un témoin.</p></div>
      <div class="actions"><button class="btn primaire" data-action="point">${ICONES.plus}Point</button></div></div>`;
    if (!E.jourJ.length) return `${bascule}${tete}${vide('Checklist vide', `Pars de la checklist type (${B.jourJ.length} points) ou écris la tienne.`, '<button class="btn primaire" data-action="ajout-base-jourj">Ajouter la checklist type</button>')}`;
    return `${bascule}${tete}<ul class="jourj">${E.jourJ.map((x) => `<li class="${x.fait ? 'fait' : ''}">
      <button class="coche" data-action="cocher-point" data-id="${x.id}" aria-pressed="${!!x.fait}" aria-label="${x.fait ? 'Décocher' : 'Cocher'} : ${esc(x.titre)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" stroke-width="3"/></svg></button>
      <span class="heure">${esc(x.heure || '—')}</span>
      <button class="tache-corps" data-action="point" data-id="${x.id}"><b>${esc(x.titre)}</b>${x.qui ? `<span class="tache-meta">${esc(x.qui)}</span>` : ''}</button>
    </li>`).join('')}</ul>`;
  }

  // ----- Budget -----
  function vueBudget() {
    const bud = R.budgetParPoste(E.postes, E.prestataires);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${E.budgetGlobal ? `Budget global ${eurR(E.budgetGlobal)}` : 'Budget'}</p><h1>Budget et prestataires</h1>
      <p>L'engagé compte les devis des prestataires réservés ; le payé, les paiements cochés.</p></div>
      <div class="actions"><button class="btn" data-action="poste">${ICONES.plus}Poste</button><button class="btn primaire" data-action="prestataire">${ICONES.plus}Prestataire</button></div></div>`;
    if (!E.postes.length && !E.prestataires.length) return `${tete}${vide('Aucun poste de budget', `Pars des ${B.postes.length} postes types (sans montant) ou crée les tiens.`, '<button class="btn primaire" data-action="ajout-base-postes">Ajouter les postes types</button>')}`;
    return `${tete}
      <div class="tuiles">${tuilesBudget(bud.total)}</div>
      <h2 class="titre-section">Par poste <span>Payé, engagé et prévu.</span></h2>
      ${graphiqueBudget(bud.lignes)}
      <div class="postes">${bud.lignes.map((l) => cartePoste(l)).join('')}</div>
      <p class="avertissement">${esc(AVERTISSEMENT)}</p>`;
  }

  function graphiqueBudget(lignes) {
    const actives = lignes.filter((l) => l.prevu || l.engage || l.paye);
    if (!actives.length) return '<p class="carte-calme">Donne un montant prévu à tes postes ou réserve un prestataire : le graphique apparaîtra ici.</p>';
    const max = Math.max(...actives.map((l) => Math.max(l.prevu, l.engage, l.paye)));
    const pc = (v) => `${((v / max) * 100).toFixed(2)}%`;
    return `<figure class="graphique budget-graph">
      <div class="graphique-tete"><figcaption class="sr-only">Budget par poste</figcaption>
        <div class="legende"><span><i style="background:var(--encre)"></i>Payé</span><span><i style="background:var(--bleu)"></i>Engagé non payé</span><span><i class="repere-leg"></i>Prévu</span></div></div>
      <ul class="barres">${actives.map((l) => {
        const engage = Math.max(l.engage, l.paye);
        return `<li data-info="${esc(`${l.nom}|Prévu ${eur(l.prevu)}|Engagé ${eur(l.engage)}|Payé ${eur(l.paye)}`)}">
          <span class="barre-nom">${esc(l.nom)}${l.depasse ? ' <em>dépassé</em>' : ''}</span>
          <span class="barre-piste">${engage ? `<i class="eng" style="width:${pc(engage)}"></i>` : ''}${l.paye ? `<i class="paye" style="width:${pc(l.paye)}"></i>` : ''}${l.prevu ? `<s style="left:${pc(l.prevu)}"></s>` : ''}</span>
          <span class="barre-val">${eurR(l.engage)}<small>/ ${eurR(l.prevu)}</small></span></li>`;
      }).join('')}</ul>
      <div class="infobulle" hidden></div>
      <details class="table-acc"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Poste</th><th class="nb">Prévu</th><th class="nb">Engagé</th><th class="nb">Payé</th><th class="nb">Reste à payer</th></tr></thead>
        <tbody>${lignes.map((l) => `<tr><td>${esc(l.nom)}</td><td class="nb">${eur(l.prevu)}</td><td class="nb">${eur(l.engage)}</td><td class="nb">${eur(l.paye)}</td><td class="nb">${eur(l.reste)}</td></tr>`).join('')}</tbody></table></div></details>
    </figure>`;
  }

  function cartePoste(l) {
    const ps = E.prestataires.filter((p) => (l.id ? p.posteId === l.id : !E.postes.some((x) => x.id === p.posteId)));
    const ordre = { reserve: 0, devis: 1, contacter: 2, ecarte: 3 };
    ps.sort((a, b) => ordre[a.statut] - ordre[b.statut]);
    return `<section class="poste${l.depasse ? ' depasse' : ''}">
      <div class="poste-tete">
        <button class="poste-nom" ${l.id ? `data-action="poste" data-id="${l.id}"` : 'disabled'}><b>${esc(l.nom)}</b><span>Prévu ${eur(l.prevu)} · engagé ${eur(l.engage)} · payé ${eur(l.paye)}</span></button>
        ${l.depasse ? etiquette('rouge', `+${eurR(l.ecart)}`) : ''}
      </div>
      ${ps.length ? `<ul class="prestas">${ps.map(lignePresta).join('')}</ul>` : ''}
      ${l.id ? `<div class="poste-pied"><button class="btn lien" data-action="prestataire" data-poste="${l.id}">+ Prestataire</button></div>` : ''}
    </section>`;
  }

  function lignePresta(p) {
    const st = B.statuts.find((s) => s.id === p.statut) || B.statuts[0];
    const t = auj();
    return `<li class="presta ${p.statut}">
      <div class="presta-tete"><button class="presta-nom" data-action="prestataire" data-id="${p.id}"><b>${esc(p.nom)}</b><span>${p.devis ? `Devis ${eur(p.devis)}` : 'Pas de devis'}${p.contact ? ` · ${esc(p.contact)}` : ''}</span></button>${etiquette(st.classe, st.nom)}</div>
      ${p.paiements.length ? `<ul class="paiements">${p.paiements.map((x) => {
        const retard = !x.paye && x.echeance && x.echeance < t;
        return `<li class="${x.paye ? 'paye' : retard ? 'retard' : ''}"><button data-action="paiement" data-presta="${p.id}" data-id="${x.id}"><span>${esc(x.libelle || 'Paiement')}</span><small>${x.paye ? `payé le ${fmt(x.paye, { day: 'numeric', month: 'short' })}` : x.echeance ? `${retard ? 'en retard · ' : 'à payer · '}${fmt(x.echeance, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'à payer'}</small><b>${eur(x.montant)}</b></button></li>`;
      }).join('')}</ul>` : ''}
      ${p.statut !== 'ecarte' ? `<button class="btn lien petit-lien" data-action="paiement" data-presta="${p.id}">+ Paiement</button>` : ''}
    </li>`;
  }

  // ----- Invités -----
  const groupe = (id) => E.groupes.find((g) => g.id === id);
  const table = (id) => E.tables.find((t) => t.id === id);

  function invitesFiltres() {
    const q = filtreInv.texte.trim().toLowerCase();
    return E.invites.filter((i) => (!filtreInv.groupe || (filtreInv.groupe === 'aucun' ? !groupe(i.groupeId) : i.groupeId === filtreInv.groupe))
      && (!filtreInv.reponse || i.reponse === filtreInv.reponse) && (!q || i.nom.toLowerCase().includes(q)));
  }

  function listeInvites() {
    const l = invitesFiltres();
    if (!l.length) return E.invites.length ? '<p class="carte-calme">Aucun invité ne correspond.</p>' : vide('Aucun invité', 'Ajoute-les un par un ou colle une liste de noms, un par ligne.', '<button class="btn primaire" data-action="invites-lot">Ajouter plusieurs invités</button>');
    const sections = [...E.groupes.map((g) => ({ id: g.id, nom: g.nom })), { id: null, nom: 'Sans groupe' }]
      .map((g) => ({ ...g, inv: l.filter((i) => (g.id ? i.groupeId === g.id : !groupe(i.groupeId))) })).filter((g) => g.inv.length);
    return sections.map((g) => `<section class="groupe-inv"><h2 class="titre-section">${esc(g.nom)} <span>${pluriel(g.inv.length, 'invité')}</span></h2>
      <ul class="invites">${g.inv.map(ligneInvite).join('')}</ul></section>`).join('');
  }

  function ligneInvite(i) {
    const tb = table(i.tableId);
    const details = [i.enfant ? 'Enfant' : '', i.regime && i.regime !== 'Sans restriction' ? i.regime : '', i.allergies ? 'Allergie' : '', tb ? tb.nom : ''].filter(Boolean);
    return `<li class="invite">
      <button class="invite-nom" data-action="invite" data-id="${i.id}"><b>${esc(i.nom)}</b><span>${esc(details.join(' · ') || 'Adulte')}</span></button>
      <div class="rep" role="group" aria-label="Réponse de ${esc(i.nom)}">${B.reponses.map((r) => `<button data-action="reponse" data-id="${i.id}" data-r="${r.id}" class="${r.classe}" aria-pressed="${i.reponse === r.id}">${esc(r.nom)}</button>`).join('')}</div>
    </li>`;
  }

  function vueInvites() {
    const s = R.statsInvites(E.invites);
    return `<div class="vue-tete"><div><p class="surtitre">${pluriel(s.adultes, 'adulte')}, ${pluriel(s.enfants, 'enfant')}</p><h1>Invités</h1>
      <p>${s.confirmes} oui, ${s.attente.adultes + s.attente.enfants} en attente, ${s.non.adultes + s.non.enfants} non. Les réponses se saisissent ici : les invités ne reçoivent pas de lien.</p></div>
      <div class="actions"><button class="btn" data-action="groupes">Groupes</button><button class="btn" data-action="invites-lot">${ICONES.plus}Plusieurs</button><button class="btn primaire" data-action="invite">${ICONES.plus}Invité</button></div></div>
      ${E.invites.length ? `<div class="filtres">
        <label class="champ">Rechercher<input id="f-texte" type="search" value="${esc(filtreInv.texte)}" placeholder="Nom" autocomplete="off"></label>
        <label class="champ">Groupe<select id="f-groupe"><option value="">Tous</option>${E.groupes.map((g) => `<option value="${g.id}" ${filtreInv.groupe === g.id ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}<option value="aucun" ${filtreInv.groupe === 'aucun' ? 'selected' : ''}>Sans groupe</option></select></label>
        <label class="champ">Réponse<select id="f-reponse"><option value="">Toutes</option>${B.reponses.map((r) => `<option value="${r.id}" ${filtreInv.reponse === r.id ? 'selected' : ''}>${esc(r.nom)}</option>`).join('')}</select></label>
      </div>` : ''}
      <div id="liste-inv">${listeInvites()}</div>
      ${s.allergies.length ? `<h2 class="titre-section">Allergies signalées <span>À transmettre au traiteur</span></h2><ul class="liste-simple">${s.allergies.map((a) => `<li><button data-action="invite" data-id="${a.id}"><span><b>${esc(a.nom)}</b><small>${esc(a.allergies)}</small></span></button></li>`).join('')}</ul>` : ''}
      <p class="aide rgpd"><b>Données personnelles.</b> ${esc(RGPD)}</p>`;
  }

  function brancherFiltres() {
    const maj = () => { $('#liste-inv').innerHTML = listeInvites(); };
    $('#f-texte')?.addEventListener('input', (e) => { filtreInv.texte = e.target.value; maj(); });
    $('#f-groupe')?.addEventListener('change', (e) => { filtreInv.groupe = e.target.value; maj(); });
    $('#f-reponse')?.addEventListener('change', (e) => { filtreInv.reponse = e.target.value; maj(); });
  }

  // ----- Plan de table -----
  const optionsTables = (choix) => `<option value="">— Pas de table</option>${E.tables.map((t) => `<option value="${t.id}" ${t.id === choix ? 'selected' : ''}>${esc(t.nom)} (${t.places} pl.)</option>`).join('')}`;

  function vueTables() {
    const p = R.planDeTable(E.tables, E.invites);
    const tete = `<div class="vue-tete"><div><p class="surtitre">${p.occupees} placés sur ${p.places} places</p><h1>Plan de table</h1>
      <p>Glisse un invité sur une table, ou choisis sa table dans la liste. Seuls les invités qui ont répondu oui ou n'ont pas encore répondu sont à placer.</p></div>
      <div class="actions"><button class="btn primaire" data-action="table">${ICONES.plus}Table</button></div></div>`;
    if (!E.tables.length) return `${tete}${vide('Aucune table', 'Crée tes tables avec leur nombre de places, puis place tes invités.', '<button class="btn primaire" data-action="table">Créer une table</button>')}`;
    const alertes = p.alertes.length ? `<ul class="liste-alertes">${p.alertes.map((a) => `<li><div><i></i><span><b>${esc(a.texte)}</b>${a.type === 'declines' ? `<small>${p.declinesPlaces.map((i) => esc(i.nom)).join(', ')}</small>` : ''}</span>${a.type === 'declines' ? '<button class="btn petit" data-action="retirer-declines">Les retirer</button>' : ''}</div></li>`).join('')}</ul>` : '<p class="carte-calme">Aucune alerte : chaque invité confirmé a sa place.</p>';
    const aPlacer = `<section class="a-placer zone-depot" data-table="" aria-label="Invités à placer"><h2>À placer <span>${p.aPlacer.length}</span></h2>
      ${p.aPlacer.length ? `<ul>${p.aPlacer.map((i) => `<li class="jeton ${i.reponse}" draggable="true" data-invite="${i.id}"><span><b>${esc(i.nom)}</b><small>${i.reponse === 'oui' ? 'Confirmé' : 'En attente'}${i.enfant ? ' · enfant' : ''}${groupe(i.groupeId) ? ` · ${esc(groupe(i.groupeId).nom)}` : ''}</small></span>
        <label class="sr-only" for="t-${i.id}">Table de ${esc(i.nom)}</label><select id="t-${i.id}" data-choix-table="${i.id}">${optionsTables(null)}</select></li>`).join('')}</ul>` : '<p class="carte-calme">Tout le monde est placé.</p>'}</section>`;
    const tables = p.tables.map((t) => {
      const assis = E.invites.filter((i) => i.tableId === t.id);
      const taux = Math.min(100, Math.round((t.occupees / Math.max(1, t.places)) * 100));
      return `<section class="table-carte zone-depot${t.surcapacite ? ' plein' : ''}" data-table="${t.id}">
        <div class="table-tete"><button data-action="table" data-id="${t.id}"><b>${esc(t.nom)}</b><span>${t.occupees} / ${t.places} places</span></button>${t.surcapacite ? etiquette('rouge', `+${t.occupees - t.places}`) : t.libres === 0 ? etiquette('bleu', 'Complète') : ''}</div>
        <div class="jauge" role="img" aria-label="${t.occupees} sur ${t.places} places"><i style="width:${taux}%"></i></div>
        ${assis.length ? `<ul>${assis.map((i) => `<li class="jeton ${i.reponse}" draggable="true" data-invite="${i.id}"><span><b>${esc(i.nom)}</b>${i.reponse === 'non' ? '<small>A décliné</small>' : i.reponse === 'attente' ? '<small>En attente</small>' : i.enfant ? '<small>Enfant</small>' : ''}</span>
          <label class="sr-only" for="t-${i.id}">Table de ${esc(i.nom)}</label><select id="t-${i.id}" data-choix-table="${i.id}">${optionsTables(t.id)}</select></li>`).join('')}</ul>` : '<p class="table-vide">Dépose un invité ici.</p>'}
      </section>`;
    }).join('');
    return `${tete}${alertes}<div class="plan">${aPlacer}<div class="tables-grille">${tables}</div></div>`;
  }

  function placerInvite(inviteId, tableId) {
    const i = E.invites.find((x) => x.id === inviteId);
    if (!i || (i.tableId || null) === (tableId || null)) return;
    instantane();
    E.invites = R.placer(E.invites, inviteId, tableId);
    sauver(); rendre();
    const t = table(tableId);
    if (t) {
      const occ = R.planDeTable(E.tables, E.invites).tables.find((x) => x.id === tableId);
      toast(occ.surcapacite ? `${i.nom} placé à ${t.nom} : ${occ.occupees} pour ${occ.places} places.` : `${i.nom} placé à ${t.nom}.`, { libelle: 'Annuler', faire: annuler });
    } else toast(`${i.nom} retiré de sa table.`, { libelle: 'Annuler', faire: annuler });
  }

  // Glisser-déposer (souris) ; les listes déroulantes servent au téléphone et au clavier.
  document.addEventListener('dragstart', (e) => {
    const j = e.target.closest?.('[data-invite]');
    if (!j) return;
    e.dataTransfer.setData('text/plain', j.dataset.invite);
    e.dataTransfer.effectAllowed = 'move';
    j.classList.add('glisse');
  });
  document.addEventListener('dragend', (e) => { e.target.closest?.('[data-invite]')?.classList.remove('glisse'); document.querySelectorAll('.survol').forEach((z) => z.classList.remove('survol')); });
  document.addEventListener('dragover', (e) => {
    const z = e.target.closest?.('.zone-depot');
    if (!z) return;
    e.preventDefault();
    document.querySelectorAll('.survol').forEach((x) => { if (x !== z) x.classList.remove('survol'); });
    z.classList.add('survol');
  });
  document.addEventListener('drop', (e) => {
    const z = e.target.closest?.('.zone-depot');
    if (!z) return;
    e.preventDefault();
    z.classList.remove('survol');
    placerInvite(e.dataTransfer.getData('text/plain'), z.dataset.table || null);
  });
  document.addEventListener('change', (e) => {
    const s = e.target.closest?.('[data-choix-table]');
    if (s) placerInvite(s.dataset.choixTable, s.value || null);
  });

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
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const piedEdition = (existe, libelle = 'Ajouter') => (existe ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : `<button class="btn primaire" value="ok">${libelle}</button><button class="btn" value="annuler">Annuler</button>`);
  const texte = (f, n, max = 80) => String(f.get(n) || '').trim().slice(0, max);
  function supprimer(liste, id, message) {
    instantane();
    E[liste] = E[liste].filter((x) => x.id !== id);
    sauver(); rendre(); toast(message, { libelle: 'Annuler', faire: annuler });
  }

  function modaleTache(id) {
    const t = id ? E.taches.find((x) => x.id === id) : null;
    const avant = t ? t.avant : 30;
    const mode = t?.date ? 'date' : 'relatif';
    const corps = `
      <label class="champ">Tâche<input name="titre" maxlength="120" required value="${esc(t?.titre || '')}" placeholder="Ex. : Réserver le traiteur"></label>
      <label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === (t?.categorie || 'prestataires') ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
      <fieldset class="bascule" role="radiogroup"><legend class="sr-only">Type d'échéance</legend>
        <label><input type="radio" name="mode" value="relatif" ${mode === 'relatif' ? 'checked' : ''}><span>Avant le mariage</span></label>
        <label><input type="radio" name="mode" value="date" ${mode === 'date' ? 'checked' : ''}><span>Date fixe</span></label>
      </fieldset>
      <div class="si-relatif rang-2">
        <label class="champ">Combien de jours avant<small>${esc(R.libelleAvant(avant))}. Négatif = après.</small><input name="avant" type="number" inputmode="numeric" min="-365" max="730" step="1" value="${avant}"></label>
        <div class="raccourcis" role="group" aria-label="Raccourcis">${[[360, '12 mois'], [180, '6 mois'], [90, '3 mois'], [30, '1 mois'], [14, '2 sem.'], [7, '1 sem.']].map(([j, l]) => `<button type="button" class="btn petit" data-action="raccourci" data-j="${j}">${l}</button>`).join('')}</div>
      </div>
      <div class="si-date"><label class="champ">Date<input type="date" name="date" value="${esc(t?.date || (E.date ? R.echeance({ avant }, E.date) : auj()))}"></label></div>
      <label class="champ">Note<small>Facultative.</small><textarea name="note" maxlength="500">${esc(t?.note || '')}</textarea></label>
      ${t ? `<label class="case"><input type="checkbox" name="fait" ${t.fait ? 'checked' : ''}> Fait${t.fait ? ` le ${esc(fmt(t.fait, { day: 'numeric', month: 'long' }))}` : ''}</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(t ? 'Modifier la tâche' : 'Nouvelle tâche', corps, piedEdition(!!t), (f, action) => {
      if (action === 'supprimer') return supprimer('taches', t.id, 'Tâche supprimée.');
      const titre = texte(f, 'titre', 120);
      if (!titre) return 'Donne un titre à la tâche.';
      const relatifChoisi = f.get('mode') !== 'date';
      const n = Math.round(Number(f.get('avant')));
      if (relatifChoisi && !Number.isFinite(n)) return 'Indique un nombre de jours.';
      const date = String(f.get('date') || '');
      if (!relatifChoisi && !R.valideIso(date)) return 'Choisis une date.';
      instantane();
      const val = { titre, categorie: f.get('categorie'), avant: relatifChoisi ? n : (E.date ? R.ecartJours(date, E.date) : 0), date: relatifChoisi ? null : date, note: texte(f, 'note', 500) };
      if (t) { Object.assign(t, val); t.fait = f.get('fait') ? (t.fait || auj()) : null; } else E.taches.push({ id: uid(), ...val, fait: null });
      sauver(); rendre(); toast(t ? 'Tâche enregistrée.' : 'Tâche ajoutée.', { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const maj = () => { const rel = d.querySelector('input[name=mode]:checked').value === 'relatif'; d.querySelector('.si-relatif').hidden = !rel; d.querySelector('.si-date').hidden = rel; };
    d.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', maj));
    const champ = d.querySelector('input[name=avant]');
    champ.addEventListener('input', () => { champ.previousElementSibling.textContent = `${R.libelleAvant(Math.round(Number(champ.value) || 0))}. Négatif = après.`; });
    maj();
  }

  function modalePoint(id) {
    const x = id ? E.jourJ.find((p) => p.id === id) : null;
    const corps = `
      <label class="champ">Point<input name="titre" maxlength="120" required value="${esc(x?.titre || '')}"></label>
      <div class="rang-2"><label class="champ">Heure<small>Facultative.</small><input type="time" name="heure" value="${esc(x?.heure || '')}"></label>
      <label class="champ">Qui s'en charge<small>Facultatif.</small><input name="qui" maxlength="40" value="${esc(x?.qui || '')}"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier le point' : 'Nouveau point', corps, piedEdition(!!x), (f, action) => {
      if (action === 'supprimer') return supprimer('jourJ', x.id, 'Point supprimé.');
      const titre = texte(f, 'titre', 120);
      if (!titre) return 'Écris le point à vérifier.';
      instantane();
      const val = { titre, heure: String(f.get('heure') || ''), qui: texte(f, 'qui', 40) };
      if (x) Object.assign(x, val); else E.jourJ.push({ id: uid(), ...val, fait: false });
      sauver(); rendre(); toast('Checklist enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  const optionsPostes = (choix) => E.postes.map((p) => `<option value="${p.id}" ${p.id === choix ? 'selected' : ''}>${esc(p.nom)}</option>`).join('');

  function modalePoste(id) {
    const p = id ? E.postes.find((x) => x.id === id) : null;
    const n = p ? E.prestataires.filter((x) => x.posteId === p.id).length : 0;
    const corps = `
      <label class="champ">Poste<input name="nom" maxlength="60" required value="${esc(p?.nom || '')}" list="liste-postes"></label>
      <datalist id="liste-postes">${B.postes.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="champ">Montant prévu<small>Ce que vous comptez y consacrer.</small><input name="prevu" inputmode="decimal" value="${esc(saisieMontant(p?.prevu))}" placeholder="0 €" autocomplete="off"></label>
      ${n ? `<p class="aide">${pluriel(n, 'prestataire')} rattaché${n > 1 ? 's' : ''} : en cas de suppression, ${n > 1 ? 'ils restent' : 'il reste'} visible${n > 1 ? 's' : ''} sous « Sans poste ».</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le poste' : 'Nouveau poste', corps, piedEdition(!!p), (f, action) => {
      if (action === 'supprimer') return supprimer('postes', p.id, 'Poste supprimé.');
      const nom = texte(f, 'nom', 60);
      if (!nom) return 'Donne un nom au poste.';
      const brut = String(f.get('prevu') || '').trim();
      const prevu = brut ? R.versCentimes(brut) : 0;
      if (prevu === null) return 'Montant illisible : écris par exemple 1 500.';
      instantane();
      if (p) Object.assign(p, { nom, prevu }); else E.postes.push({ id: uid(), nom, prevu });
      sauver(); rendre(); toast('Poste enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePrestataire(id, posteDefaut) {
    if (!E.postes.length) { toast('Crée d\'abord un poste de budget.'); modalePoste(); return; }
    const p = id ? E.prestataires.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Prestataire<input name="nom" maxlength="60" required value="${esc(p?.nom || '')}" placeholder="Ex. : Traiteur, photographe…"></label>
      <div class="rang-2"><label class="champ">Poste<select name="poste">${optionsPostes(p?.posteId || posteDefaut)}</select></label>
      <label class="champ">Statut<select name="statut">${B.statuts.map((s) => `<option value="${s.id}" ${s.id === (p?.statut || 'contacter') ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label></div>
      <label class="champ">Montant du devis<small>Compté dans l'engagé une fois le prestataire réservé.</small><input name="devis" inputmode="decimal" value="${esc(saisieMontant(p?.devis))}" placeholder="0 €" autocomplete="off"></label>
      <label class="champ">Contact<small>Facultatif : coordonnées professionnelles du prestataire.</small><input name="contact" maxlength="80" value="${esc(p?.contact || '')}"></label>
      <label class="champ">Note<small>Facultative : ce que comprend le devis, options…</small><textarea name="note" maxlength="500">${esc(p?.note || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le prestataire' : 'Nouveau prestataire', corps, piedEdition(!!p), (f, action) => {
      if (action === 'supprimer') return supprimer('prestataires', p.id, 'Prestataire supprimé avec ses paiements.');
      const nom = texte(f, 'nom', 60);
      if (!nom) return 'Donne un nom au prestataire.';
      const brut = String(f.get('devis') || '').trim();
      const devis = brut ? R.versCentimes(brut) : 0;
      if (devis === null) return 'Montant illisible : écris par exemple 2 400.';
      instantane();
      const val = { nom, posteId: f.get('poste'), statut: f.get('statut'), devis, contact: texte(f, 'contact'), note: texte(f, 'note', 500) };
      if (p) Object.assign(p, val); else E.prestataires.push({ id: uid(), ...val, paiements: [] });
      sauver(); rendre(); toast('Prestataire enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modalePaiement(prestaId, id) {
    const p = E.prestataires.find((x) => x.id === prestaId);
    if (!p) return;
    const x = id ? p.paiements.find((y) => y.id === id) : null;
    const corps = `
      <p class="aide">${esc(p.nom)}${p.devis ? ` · devis ${eur(p.devis)}` : ''}</p>
      <div class="rang-2"><label class="champ">Libellé<input name="libelle" maxlength="40" value="${esc(x?.libelle || (p.paiements.length ? 'Solde' : 'Acompte'))}" list="liste-pai"></label>
      <label class="champ">Montant<input name="montant" inputmode="decimal" required value="${esc(saisieMontant(x?.montant))}" placeholder="0 €" autocomplete="off"></label></div>
      <datalist id="liste-pai"><option value="Acompte"><option value="Deuxième acompte"><option value="Solde"><option value="Caution"></datalist>
      <label class="champ">Échéance<small>Date prévue au contrat, facultative.</small><input type="date" name="echeance" value="${esc(x?.echeance || '')}"></label>
      <label class="case"><input type="checkbox" name="paye" ${x?.paye ? 'checked' : ''}> Payé${x?.paye ? ` le ${esc(fmt(x.paye, { day: 'numeric', month: 'long' }))}` : ''}</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier le paiement' : 'Nouveau paiement', corps, piedEdition(!!x), (f, action) => {
      if (action === 'supprimer') {
        instantane(); p.paiements = p.paiements.filter((y) => y.id !== x.id);
        sauver(); rendre(); toast('Paiement supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const montant = R.versCentimes(f.get('montant'));
      if (!montant) return 'Montant illisible : écris par exemple 1 200.';
      const echeance = String(f.get('echeance') || '');
      instantane();
      const val = { libelle: texte(f, 'libelle', 40), montant, echeance: R.valideIso(echeance) ? echeance : '', paye: f.get('paye') ? (x?.paye || auj()) : null };
      if (x) Object.assign(x, val); else p.paiements.push({ id: uid(), ...val });
      sauver(); rendre(); toast('Paiement enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  const optionsGroupes = (choix) => `<option value="">Sans groupe</option>${E.groupes.map((g) => `<option value="${g.id}" ${g.id === choix ? 'selected' : ''}>${esc(g.nom)}</option>`).join('')}`;

  function modaleInvite(id) {
    const i = id ? E.invites.find((x) => x.id === id) : null;
    const regime = i?.regime || 'Sans restriction';
    const corps = `
      <label class="champ">Nom<small>Un prénom ou un surnom suffit.</small><input name="nom" maxlength="60" required value="${esc(i?.nom || '')}" autocomplete="off"></label>
      <div class="rang-2"><label class="champ">Groupe<select name="groupe">${optionsGroupes(i ? i.groupeId : filtreInv.groupe)}</select></label>
      <label class="champ">Âge<select name="enfant"><option value="">Adulte</option><option value="1" ${i?.enfant ? 'selected' : ''}>Enfant</option></select></label></div>
      <fieldset class="bascule trois" role="radiogroup"><legend class="sr-only">Réponse</legend>${B.reponses.map((r) => `<label><input type="radio" name="reponse" value="${r.id}" ${(i?.reponse || 'attente') === r.id ? 'checked' : ''}><span>${esc(r.nom)}</span></label>`).join('')}</fieldset>
      <div class="rang-2"><label class="champ">Régime<select name="regime">${B.regimes.map((r) => `<option ${r === regime ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="champ">Table<select name="table">${optionsTables(i?.tableId)}</select></label></div>
      <label class="champ">Allergies<small>Donnée de santé : seulement si l'invité te l'a demandé, pour le repas.</small><input name="allergies" maxlength="120" value="${esc(i?.allergies || '')}" autocomplete="off"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(i ? 'Modifier l\'invité' : 'Nouvel invité', corps, i ? piedEdition(true) : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button>', (f, action) => {
      if (action === 'supprimer') return supprimer('invites', i.id, 'Invité supprimé.');
      const nom = texte(f, 'nom', 60);
      if (!nom) return 'Indique le nom de l\'invité.';
      instantane();
      const val = { nom, groupeId: f.get('groupe') || null, enfant: !!f.get('enfant'), reponse: f.get('reponse') || 'attente', regime: f.get('regime') || 'Sans restriction', allergies: texte(f, 'allergies', 120), tableId: f.get('table') || null };
      if (i) Object.assign(i, val); else E.invites.push({ id: uid(), ...val });
      sauver(); rendre();
      if (action === 'encore') { toast(`${nom} ajouté.`); setTimeout(() => modaleInvite(), 0); return; }
      toast(i ? 'Invité enregistré.' : `${nom} ajouté.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleInvitesLot() {
    const corps = `
      <label class="champ">Noms<small>Un invité par ligne. Les doublons sont ignorés.</small><textarea name="noms" rows="8" placeholder="Hélène\nBernard\nLes enfants : Rose"></textarea></label>
      <div class="rang-2"><label class="champ">Groupe<select name="groupe">${optionsGroupes(filtreInv.groupe)}</select></label>
      <label class="champ">Âge<select name="enfant"><option value="">Adultes</option><option value="1">Enfants</option></select></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Ajouter plusieurs invités', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const noms = R.nomsDepuisTexte(f.get('noms'));
      if (!noms.length) return 'Écris au moins un nom.';
      instantane();
      noms.forEach((nom) => E.invites.push({ id: uid(), nom, groupeId: f.get('groupe') || null, enfant: !!f.get('enfant'), reponse: 'attente', regime: 'Sans restriction', allergies: '', tableId: null }));
      sauver(); rendre(); toast(`${pluriel(noms.length, 'invité ajouté', 'invités ajoutés')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleGroupes() {
    const corps = `<p class="aide">Renomme, ajoute ou supprime des groupes. Les invités d'un groupe supprimé passent « Sans groupe ».</p>
      ${E.groupes.map((g) => `<div class="rang-groupe"><label class="champ"><span class="sr-only">Nom du groupe</span><input name="g-${g.id}" maxlength="40" value="${esc(g.nom)}"></label><label class="case"><input type="checkbox" name="suppr-${g.id}"> Supprimer</label></div>`).join('')}
      <label class="champ">Nouveau groupe<small>Facultatif.</small><input name="nouveau" maxlength="40"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Groupes d\'invités', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      instantane();
      const supprimes = new Set(E.groupes.filter((g) => f.get(`suppr-${g.id}`)).map((g) => g.id));
      E.groupes = E.groupes.filter((g) => !supprimes.has(g.id)).map((g) => ({ ...g, nom: texte(f, `g-${g.id}`, 40) || g.nom }));
      E.invites.forEach((i) => { if (supprimes.has(i.groupeId)) i.groupeId = null; });
      const nouveau = texte(f, 'nouveau', 40);
      if (nouveau) E.groupes.push({ id: uid(), nom: nouveau });
      if (supprimes.has(filtreInv.groupe)) filtreInv.groupe = '';
      sauver(); rendre(); toast('Groupes enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleTable(id) {
    const t = id ? E.tables.find((x) => x.id === id) : null;
    const n = t ? E.invites.filter((i) => i.tableId === t.id).length : 0;
    const corps = `
      <div class="rang-2"><label class="champ">Nom<input name="nom" maxlength="40" required value="${esc(t?.nom || `Table ${E.tables.length + 1}`)}"></label>
      <label class="champ">Places<input name="places" type="number" inputmode="numeric" min="1" max="60" required value="${t?.places || 8}"></label></div>
      ${n ? `<p class="aide">${pluriel(n, 'invité')} à cette table : en cas de suppression, ${n > 1 ? 'ils reviennent' : 'il revient'} dans « À placer ».</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(t ? 'Modifier la table' : 'Nouvelle table', corps, piedEdition(!!t), (f, action) => {
      if (action === 'supprimer') {
        instantane();
        E.tables = E.tables.filter((x) => x.id !== t.id);
        E.invites.forEach((i) => { if (i.tableId === t.id) i.tableId = null; });
        sauver(); rendre(); toast('Table supprimée.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = texte(f, 'nom', 40);
      const places = Math.round(Number(f.get('places')));
      if (!nom) return 'Donne un nom à la table.';
      if (!(places >= 1 && places <= 60)) return 'Indique un nombre de places entre 1 et 60.';
      instantane();
      if (t) Object.assign(t, { nom, places }); else E.tables.push({ id: uid(), nom, places });
      sauver(); rendre(); toast('Table enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const sante = E.invites.filter((i) => i.allergies || (i.regime && i.regime !== 'Sans restriction')).length;
    const corps = `
      <div class="rang-2"><label class="champ">Premier prénom<input name="n1" maxlength="30" value="${esc(E.noms[0])}"></label>
      <label class="champ">Second prénom<input name="n2" maxlength="30" value="${esc(E.noms[1])}"></label></div>
      <div class="rang-2"><label class="champ">Date du mariage<small>Le rétroplanning se recale.</small><input type="date" name="date" value="${esc(E.date)}"></label>
      <label class="champ">Budget global<small>Facultatif.</small><input name="budget" inputmode="decimal" value="${esc(saisieMontant(E.budgetGlobal))}" placeholder="0 €" autocomplete="off"></label></div>
      <label class="champ">Lieu<input name="lieu" maxlength="80" value="${esc(E.lieu)}"></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tout est enregistré en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Données des invités</h3><p class="aide">${esc(RGPD)}</p>
        <div class="rang"><button class="btn petit danger" type="button" data-action="effacer-sante" ${sante ? '' : 'disabled'}>Effacer les régimes et allergies (${sante})</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="aide">Toute personne qui a ta clé voit et modifie l'organisation, liste d'invités comprise.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">${esc(AVERTISSEMENT)}</p><p class="aide">${esc(B.sourceDemarches.titre)} : ${esc(B.sourceDemarches.source)} Les invités ne reçoivent pas de lien de réponse : vous saisissez leurs réponses.</p></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = String(f.get('date') || '');
      if (date && !R.valideIso(date)) return 'Date illisible.';
      const brut = String(f.get('budget') || '').trim();
      const budget = brut ? R.versCentimes(brut) : 0;
      if (budget === null) return 'Budget illisible : écris par exemple 15 000.';
      const change = date !== E.date;
      instantane();
      E.noms = [texte(f, 'n1', 30), texte(f, 'n2', 30)];
      E.date = date; E.lieu = texte(f, 'lieu'); E.budgetGlobal = budget;
      sauver(); demarrer();
      toast(change && date ? 'Réglages enregistrés : le rétroplanning est recalé sur la nouvelle date.' : 'Réglages enregistrés.', { libelle: 'Annuler', faire: () => { annuler(); demarrer(); } });
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.taches) || !Array.isArray(d.invites)) throw new Error();
        if (!confirm(`Remplacer l'organisation actuelle par cette copie (${pluriel(d.taches.length, 'tâche')}, ${pluriel(d.invites.length, 'invité')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide de l\'organisateur.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `organisateur-mariage-${auj()}.json`;
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
  function toast(texteToast, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texteToast)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  function annuler() {
    if (!annulation) return;
    E = annulation;
    annulation = null;
    sauver(); rendre();
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
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'sous-planning': sousPlanning = el.dataset.v; rendre(); break;
      case 'filtre-taches': filtreTaches = el.dataset.v; rendre(); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'tache': modaleTache(id); break;
      case 'raccourci': { const c = modale().querySelector('input[name=avant]'); c.value = el.dataset.j; c.dispatchEvent(new Event('input')); break; }
      case 'cocher': {
        const t = E.taches.find((x) => x.id === id);
        instantane();
        t.fait = t.fait ? null : auj();
        sauver(); rendre();
        toast(t.fait ? 'Tâche faite. Bravo.' : 'Tâche remise à faire.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'point': modalePoint(id); break;
      case 'cocher-point': { const x = E.jourJ.find((p) => p.id === id); x.fait = !x.fait; sauver(); rendre(); break; }
      case 'ajout-base-taches': instantane(); E.taches.push(...tachesBase()); sauver(); rendre(); toast('Rétroplanning type ajouté.', { libelle: 'Annuler', faire: annuler }); break;
      case 'ajout-base-jourj': instantane(); E.jourJ.push(...jourJBase()); sauver(); rendre(); break;
      case 'ajout-base-postes': instantane(); E.postes.push(...B.postes.map((nom) => ({ id: uid(), nom, prevu: 0 }))); sauver(); rendre(); break;
      case 'poste': modalePoste(id); break;
      case 'prestataire': modalePrestataire(id, el.dataset.poste); break;
      case 'paiement': modalePaiement(el.dataset.presta, id); break;
      case 'invite': modaleInvite(id); break;
      case 'invites-lot': modaleInvitesLot(); break;
      case 'groupes': modaleGroupes(); break;
      case 'reponse': {
        const i = E.invites.find((x) => x.id === id);
        if (i.reponse === el.dataset.r) break;
        instantane();
        i.reponse = el.dataset.r;
        sauver(); rendre();
        if (i.reponse === 'non' && i.tableId) toast(`${i.nom} a décliné mais reste placé à ${table(i.tableId)?.nom || 'une table'}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'table': modaleTable(id); break;
      case 'retirer-declines': {
        instantane();
        E.invites.forEach((i) => { if (i.reponse === 'non') i.tableId = null; });
        sauver(); rendre(); toast('Invités ayant décliné retirés des tables.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'effacer-sante':
        if (!confirm('Effacer les régimes et allergies de tous les invités ? (Annulable juste après.)')) break;
        instantane(); E.invites = R.effacerSante(E.invites); modale().close(); sauver(); rendre();
        toast('Régimes et allergies effacés.', { libelle: 'Annuler', faire: annuler });
        break;
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
  window.__mariage = { etat: () => E, demo: () => donneesDemo() };
  init();
})();
