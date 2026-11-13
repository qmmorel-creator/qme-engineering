// Inscriptions associatives QME : activités, familles, liste d'attente, quotient familial, paiements,
// listes d'appel. Données synchronisées par clé de licence ou code d'accès.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'ASC';
  const CLE_CODE = 'qme-asc-code';
  const CLE_CACHE = 'qme-asc-cache';
  const CLE_DEMO = 'qme-asc-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-asc-ecran-accueil';
  const NOM_PRODUIT = 'Inscriptions associatives';

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
  const { iso, ajout, ajoutMois, estDate, age, estMineur, dateFr } = R;
  const auj = () => iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? R.versDate(s).toLocaleDateString('fr-FR', o) : '');
  const euros = (n) => `${(Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(n) || 0) ? 0 : 2, maximumFractionDigits: 2 })} €`;
  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const texteSur = (id) => (id === 'jaune' ? 'var(--encre)' : '#fff');
  const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  const horaire = (c, court = false) => `${court ? JOURS_COURTS[c.jour] : B.jours[c.jour]} ${c.debut}–${c.fin}`;
  const nomMembre = (m) => (m ? `${m.prenom} ${m.nom}`.trim() : 'Membre supprimé');
  const nombre = (v) => { const s = String(v ?? '').trim().replace(',', '.').replace(/\s/g, ''); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let annulation = null;
  let filtreFamilles = '';
  let filtrePaiements = 'retard';
  let appel = { creneau: null, mois: null, urgence: false };
  let ajoutModale = null; // « Ajouter un créneau / une tranche » de la modale ouverte

  const etatVide = () => ({
    version: 1,
    association: { nom: '', contact: '', adhesion: { montant: 0, par: 'famille' }, conservation: B.rgpd.conservationDefaut },
    saison: { ...R.saisonProposee(auj()), fermetures: [] },
    tranches: [], tranchesExemple: false, activites: [], familles: [], membres: [], inscriptions: [], paiements: [], compteur: 0,
  });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tab = (x) => (Array.isArray(x) ? x : []);
    const n = { ...v, ...d,
      association: { ...v.association, ...(d.association || {}), adhesion: { ...v.association.adhesion, ...(d.association?.adhesion || {}) } },
      saison: { ...v.saison, ...(d.saison || {}), fermetures: tab(d.saison?.fermetures) },
      tranches: tab(d.tranches), activites: tab(d.activites).map((a) => ({ tarifs: {}, ...a, creneaux: tab(a.creneaux) })),
      familles: tab(d.familles).map((f) => ({ responsables: [], urgences: [], nbEcheances: 1, ...f })),
      membres: tab(d.membres), inscriptions: tab(d.inscriptions), paiements: tab(d.paiements) };
    if (!n.tranches.length) n.tranches = [{ id: uid(), nom: 'Tarif unique', max: null }];
    return n;
  };
  const membre = (id) => E.membres.find((m) => m.id === id);
  const famille = (id) => E.familles.find((f) => f.id === id);
  const activite = (id) => E.activites.find((a) => a.id === id);
  const creneauDe = (id) => R.creneau(E, id);
  const instantane = () => structuredClone(E);
  const memoriserAnnulation = () => { annulation = instantane(); };
  const annuler = () => { if (!annulation) return; E = annulation; annulation = null; sauver(); rendre(); toast('Action annulée.'); };

  // Passe en « inscrit » les premiers de la liste d'attente qui tiennent dans les places libres.
  function promouvoir(creneauIds) {
    const promus = [];
    for (const id of new Set(creneauIds)) for (const i of R.aPromouvoir(E, id)) { i.statut = 'inscrit'; promus.push(i); }
    return promus;
  }
  const texteProm = (p) => (p.length ? ` ${p.map((i) => nomMembre(membre(i.membreId))).join(', ')} ${p.length > 1 ? 'passent' : 'passe'} de la liste d'attente à inscrit.` : '');

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
  async function appelApi(chemin, options = {}) {
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
      const { statut, corps } = await appelApi('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié les inscriptions entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime les familles anciennes.');
        throw new Error('413');
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
      const { statut, corps } = await appelApi('/donnees');
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
  // Code interne PRE-XXXX-… (ASC ou le préfixe d'un autre template, refusé ensuite avec un message clair) :
  // préfixe de 3 lettres dont au moins une hors hexadécimal, ce qui le distingue d'une clé Gumroad.
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
    const { statut, corps } = await appelApi('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
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

  // ---------- Démo : maison de quartier fictive, saison commencée il y a deux mois ----------
  function donneesDemo() {
    const t = auj();
    const debut = ajoutMois(`${t.slice(0, 7)}-01`, -2);
    const fin = ajout(ajoutMois(debut, 10), -1);
    E = etatVide();
    E.association = { nom: 'Maison de quartier des Tilleuls', contact: 'accueil@exemple.org', adhesion: { montant: 12, par: 'famille' }, conservation: 3 };
    E.saison = { nom: debut.slice(0, 4) === fin.slice(0, 4) ? debut.slice(0, 4) : `${debut.slice(0, 4)}-${fin.slice(0, 4)}`, debut, fin,
      fermetures: [{ debut: ajout(debut, 52), fin: ajout(debut, 65), nom: 'Vacances (exemple)' }, { debut: ajout(debut, 100), fin: ajout(debut, 100), nom: 'Assemblée générale' }] };
    E.tranches = B.modelesTranches.exemple.map((x) => ({ id: uid(), ...x }));
    E.tranchesExemple = true;
    const T = (...p) => Object.fromEntries(E.tranches.map((x, i) => [x.id, p[i]]));
    const act = (nom, categorie, c, animateur, lieu, tarifs, creneaux) => {
      const a = { id: uid(), nom, categorie, couleur: c, animateur, lieu, tarifs, creneaux: creneaux.map(([jour, d, f, capacite]) => ({ id: uid(), jour, debut: d, fin: f, capacite })) };
      E.activites.push(a); return a;
    };
    const A = {
      judo: act('Judo enfants', 'Sport', 'rouge', 'Karim, éducateur sportif', 'Gymnase', T(90, 120, 150, 180), [[2, '14:00', '15:00', 12], [5, '10:00', '11:00', 12]]),
      danse: act('Danse enfants', 'Sport', 'jaune', 'Élodie', 'Salle polyvalente', T(80, 105, 130, 160), [[5, '11:00', '12:00', 6]]),
      theatre: act('Théâtre ados', 'Culture et arts', 'bleu', 'Marc', 'Salle polyvalente', T(100, 130, 160, 190), [[2, '16:00', '17:30', 8]]),
      aide: act('Aide aux devoirs', 'Accompagnement', 'vert', 'Équipe bénévole', 'Salle 2', T(20, 30, 40, 50), [[1, '16:30', '18:00', 10], [3, '16:30', '18:00', 10]]),
      gym: act('Gym douce', 'Bien-être', 'prune', 'Sophie', 'Salle polyvalente', T(60, 80, 100, 120), [[1, '10:00', '11:00', 15]]),
      guitare: act('Guitare', 'Culture et arts', 'orange', 'Julien', 'Salle de musique', T(150, 190, 230, 270), [[0, '17:30', '18:30', 4]]),
      francais: act('Atelier de français', 'Accompagnement', 'ciel', 'Équipe bénévole', 'Salle 2', T(10, 10, 10, 10), [[3, '14:00', '16:00', 10]]),
    };
    const an = Number(t.slice(0, 4));
    const ne = (ans, mmjj) => `${an - ans}-${mmjj}`;
    // [nom, qf, échéances, paiement, jour d'inscription, responsables, urgence, mentions, membres[[prénom, âge, mmjj, inscriptions[[activité, créneau]]]]]
    const F = [
      ['Bernard', 450, 3, 'ajour', 2, ['Claire|Mère'], 'Paul Bernard|Grand-parent', true, [['Inès', 9, '04-12', [['judo', 0], ['danse', 0]]], ['Noah', 12, '10-30', [['theatre', 0], ['guitare', 0]]]]],
      ['Lefèvre', 820, 1, 'solde', 3, ['Sandrine|Mère', 'David|Père'], 'Nicole Roche|Autre', true, [['Jade', 8, '01-19', [['danse', 0]]], ['Hugo', 10, '06-07', [['judo', 1]]]]],
      ['Moreau', 1100, 3, 'retard', 4, ['Karine|Mère'], 'Jean Moreau|Grand-parent', true, [['Lina', 7, '09-03', [['danse', 0], ['aide', 0]]], ['Tom', 14, '02-21', [['theatre', 0]]]]],
      ['Petit', null, 1, 'rien', 5, ['Nadia|Mère'], 'Samia Petit|Autre', true, [['Nadia', 41, '05-14', [['gym', 0]]], ['Ethan', 11, '12-02', [['guitare', 0]]]]],
      ['Roux', 300, 10, 'ajour', 6, ['Fatou|Mère'], 'Moussa Roux|Père', true, [['Adam', 9, '03-27', [['aide', 0], ['judo', 0]]], ['Maya', 8, '07-15', [['danse', 0]]]]],
      ['Fournier', 950, 3, 'partiel', 7, ['Laure|Mère', 'Thomas|Père'], 'Agnès Fournier|Grand-parent', true, [['Chloé', 11, '08-08', [['theatre', 0], ['guitare', 0]]], ['Louis', 9, '11-25', [['judo', 0]]]]],
      ['Girard', 1500, 1, 'solde', 8, [], '', true, [['Anne', 68, '02-02', [['gym', 0]]], ['Michel', 70, '06-19', [['gym', 0]]]]],
      ['Bonnet', 700, 3, 'ajour', 9, ['Hélène|Mère'], 'Marc Bonnet|Père', true, [['Sarah', 10, '04-01', [['danse', 0]]], ['Yanis', 13, '09-18', [['guitare', 0]]]]],
      ['Henry', 600, 1, 'solde', 10, [], 'Lucie Henry|Mère', true, [['Mila', 7, '10-10', [['judo', 0], ['danse', 0]]]]],
      ['Lambert', 1250, 3, 'ajour', 14, ['Julie|Mère'], 'Pierre Lambert|Père', true, [['Julie', 39, '03-03', [['gym', 0], ['francais', 0]]], ['Emma', 9, '05-29', [['danse', 0], ['judo', 1]]]]],
      ['Fontaine', 680, 1, 'solde', 16, ['Aurélie|Mère'], 'Bruno Fontaine|Père', true, [['Lucas', 10, '12-12', [['danse', 0], ['aide', 1]]]]],
      ['Chevalier', 400, 3, 'ajour', 18, ['Samira|Mère'], 'Yasmine Chevalier|Autre', true, [['Samira', 34, '01-08', [['francais', 0]]], ['Ali', 12, '08-23', [['guitare', 0]]]]],
      ['Robin', 980, 3, 'retard', 20, ['Valérie|Mère'], '', false, [['Léon', 15, '07-07', [['theatre', 0]]]]],
      ['Dupont', 550, 1, 'rien', null, ['Céline|Mère'], 'Gérard Dupont|Grand-parent', true, [['Rayan', 8, '02-14', [['judo', 1], ['aide', 1]]]]],
    ];
    const modes = B.modesPaiement;
    F.forEach(([nom, qf, nbEcheances, paie, j, resp, urg, mentions, membres], k) => {
      const date = j === null ? t : (ajout(debut, j) < t ? ajout(debut, j) : t);
      const f = { id: uid(), nom, adresse: `${3 + k * 4} rue des Lilas, 00000 Ville-Exemple`, qf, nbEcheances, depart: null,
        responsables: resp.map((r) => { const [p, lien] = r.split('|'); return { nom: `${p} ${nom}`, lien, tel: `06 00 00 ${String(10 + k).padStart(2, '0')} 0${resp.indexOf(r)}`, email: `${p.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@exemple.org` }; }),
        urgences: urg ? [{ nom: urg.split('|')[0], lien: urg.split('|')[1], tel: `07 00 00 ${String(10 + k).padStart(2, '0')} 00` }] : [],
        mentionsLe: mentions ? date : null, cree: date };
      E.familles.push(f);
      membres.forEach(([prenom, ans, mmjj, ins]) => {
        const m = { id: uid(), familleId: f.id, prenom, nom, naissance: ne(ans, mmjj), remarque: '' };
        E.membres.push(m);
        ins.forEach(([cle, c]) => {
          const cr = A[cle].creneaux[c];
          E.inscriptions.push({ id: uid(), membreId: m.id, activiteId: A[cle].id, creneauId: cr.id, date, statut: R.statutNouvelle(E, cr.id), ordre: ++E.compteur, tarif: null });
        });
      });
      const s = R.situation(E, f.id, t);
      const payer = (d, montant, i) => { if (d <= t && montant > 0) E.paiements.push({ id: uid(), familleId: f.id, date: d, montant, mode: modes[(k + i) % 5], reference: (k + i) % 5 === 1 ? `n° ${4100 + k * 7 + i}` : '' }); };
      if (paie === 'solde') payer(s.echeances[0]?.date || date, s.total, 0);
      if (paie === 'ajour') s.echeances.forEach((e, i) => { if (e.date < t) payer(e.date, e.montant, i); });
      if (paie === 'retard') payer(s.echeances[0]?.date, s.echeances[0]?.montant, 0);
      if (paie === 'partiel') { payer(s.echeances[0]?.date, s.echeances[0]?.montant, 0); payer(s.echeances[1]?.date, Math.round(s.echeances[1]?.montant / 2), 1); }
    });
    // Une famille ancienne, sans inscription cette saison : arrivée au terme de la durée de conservation.
    const ancienne = { id: uid(), nom: 'Garnier', adresse: '', qf: 900, nbEcheances: 1, responsables: [], urgences: [], mentionsLe: ajoutMois(debut, -48), derniereFin: ajout(ajoutMois(debut, -36), -63), cree: ajoutMois(debut, -48) };
    E.familles.push(ancienne);
    E.membres.push({ id: uid(), familleId: ancienne.id, prenom: 'Paul', nom: 'Garnier', naissance: ne(52, '09-09'), remarque: '' });
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = `${NOM_PRODUIT} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="20" width="120" height="120" fill="#F5B400"/>
          <rect x="140" y="20" width="120" height="120" fill="#1D4E89"/>
          <rect x="10" y="150" width="120" height="120" fill="#1D4E89"/>
          <rect x="140" y="150" width="120" height="120" fill="none" stroke="#F0EDE6" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <path d="M420 20 A130 130 0 0 1 550 150 H420 Z" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Inscriptions associatives · saison</p>
          <h1>Chaque place, chaque famille, chaque euro.</h1>
          <p>Activités et créneaux, liste d'attente automatique, tarif selon tes tranches de quotient familial, paiements en plusieurs fois et listes d'appel prêtes à imprimer.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes inscriptions</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Les inscriptions sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes inscriptions</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore l'outil ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes inscriptions'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = null;
  const accueilVide = () => { const p = R.saisonProposee(auj()); return { etape: 1, nom: '', nomSaison: p.nom, debut: p.debut, fin: p.fin, adhesion: '', par: 'famille', modele: 'unique', choisies: new Set() }; };

  function ecranAccueil() {
    accueil ||= accueilVide();
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ta saison.</h1>
        <p class="intro">Deux étapes : l'association et sa saison, puis les tarifs et les activités. Tout reste modifiable ensuite.</p>
        <form id="form-accueil" class="grille-champs" novalidate>
          <label class="champ large">Nom de l'association<input name="nom" value="${esc(a.nom)}" maxlength="80" required placeholder="Ex. : Maison de quartier"></label>
          <label class="champ">Saison<input name="saison" value="${esc(a.nomSaison)}" maxlength="30"></label>
          <label class="champ">Début<input type="date" name="debut" value="${a.debut}" required></label>
          <label class="champ">Fin<input type="date" name="fin" value="${a.fin}" required></label>
          <label class="champ">Adhésion annuelle (€)<small>0 si aucune.</small><input name="adhesion" inputmode="decimal" value="${esc(a.adhesion)}" placeholder="0"></label>
          <label class="champ">Adhésion due<select name="par"><option value="famille" ${a.par === 'famille' ? 'selected' : ''}>une fois par famille</option><option value="personne" ${a.par === 'personne' ? 'selected' : ''}>par personne inscrite</option></select></label>
          <p class="erreur large" role="alert"></p>
          <div class="accueil-pied large"><span></span><button class="btn primaire" type="submit">Continuer</button></div>
        </form>`;
    } else {
      const ex = B.modelesTranches.exemple;
      corps = `
        <p class="surtitre">${esc(a.nom)}</p>
        <h1>Tarifs et activités</h1>
        <h2 class="titre-section">Tarifs <span>Tu pourras saisir la grille de ton association à tout moment (Activités → Tranches de quotient familial).</span></h2>
        <div class="filieres" role="radiogroup" aria-label="Modèle de tarifs">
          <button type="button" class="filiere" style="--c:var(--bleu)" data-action="modele" data-id="unique" aria-pressed="${a.modele === 'unique'}"><b>Tarif unique</b><span>Un seul prix par activité, sans quotient familial.</span></button>
          <button type="button" class="filiere" style="--c:var(--jaune)" data-action="modele" data-id="exemple" aria-pressed="${a.modele === 'exemple'}"><b>Exemple fictif à 4 tranches</b><span>${ex.map((t) => (t.max === null ? `${t.nom} au-delà` : `${t.nom} ≤ ${t.max}`)).join(' · ')}. À remplacer par la grille votée par ton association.</span></button>
        </div>
        <h2 class="titre-section">Activités à créer <span>Chacune avec un créneau suggéré (jour, horaires, places), à ajuster.</span></h2>
        <div class="choix-activites">${B.categories.map((c) => `<fieldset><legend>${esc(c)}</legend>${B.activites.filter((x) => x.categorie === c).map((x) => `<label class="case"><input type="checkbox" data-action="choix-activite" value="${esc(x.nom)}" ${a.choisies.has(x.nom) ? 'checked' : ''}> <span>${esc(x.nom)} <small>${esc(x.public)}</small></span></label>`).join('')}</fieldset>`).join('')}</div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma saison (${pluriel(a.choisies.size, 'activité')})</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#form-accueil')?.addEventListener('submit', (e) => { e.preventDefault(); accueilEtape1(); });
  }

  function accueilEtape1() {
    const f = new FormData($('#form-accueil'));
    const nom = String(f.get('nom') || '').trim();
    const debut = f.get('debut'), fin = f.get('fin');
    const adh = nombre(f.get('adhesion'));
    const err = $('#form-accueil .erreur');
    Object.assign(accueil, { nom, nomSaison: String(f.get('saison') || '').trim(), debut, fin, adhesion: f.get('adhesion'), par: f.get('par') });
    if (!nom) { err.textContent = 'Indique le nom de l\'association.'; return; }
    if (!estDate(debut) || !estDate(fin) || fin <= debut) { err.textContent = 'La fin de saison doit suivre son début.'; return; }
    if (Number.isNaN(adh) || (adh !== null && adh < 0)) { err.textContent = 'Adhésion : un montant positif en euros.'; return; }
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }

  function terminerAccueil() {
    const a = accueil;
    E = etatVide();
    E.association.nom = a.nom;
    E.association.adhesion = { montant: nombre(a.adhesion) || 0, par: a.par };
    E.saison = { nom: a.nomSaison || `${a.debut.slice(0, 4)}-${a.fin.slice(0, 4)}`, debut: a.debut, fin: a.fin, fermetures: [] };
    E.tranches = B.modelesTranches[a.modele].map((x) => ({ id: uid(), ...x }));
    E.tranchesExemple = a.modele === 'exemple';
    [...a.choisies].forEach((nom, i) => {
      const x = B.activites.find((y) => y.nom === nom);
      E.activites.push({ id: uid(), nom, categorie: x.categorie, couleur: B.couleurs[i % B.couleurs.length].id, animateur: '', lieu: '', tarifs: {}, creneaux: [{ id: uid(), jour: x.jour, debut: x.debut, fin: x.fin, capacite: x.capacite }] });
    });
    accueil = null;
    sauver();
    vue = E.activites.length ? 'activites' : 'bord';
    demarrer();
    toast(E.activites.length ? 'Saison créée. Renseigne maintenant les tarifs de chaque activité.' : 'Saison créée. Ajoute ta première activité.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    activites: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    familles: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor"/><circle cx="17" cy="10" r="3" fill="currentColor"/><path d="M1 21a7 7 0 0 1 14 0Z" fill="currentColor"/><path d="M12 21a5 5 0 0 1 10 0Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    paiements: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    appel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1D4E89"/><path d="M9.2 9.2a2.9 2.9 0 1 1 4.2 2.6c-.9.5-1.4 1.1-1.4 2.2" fill="none" stroke="#fff" stroke-width="2.4"/><rect x="10.8" y="16.4" width="2.4" height="2.4" fill="#fff"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Bord'], ['activites', 'Activités'], ['familles', 'Familles'], ['paiements', 'Paiements'], ['appel', 'Appel']];
  const TITRES = { bord: 'Tableau de bord', activites: 'Activités', familles: 'Familles', paiements: 'Paiements', appel: 'Listes d\'appel', guide: 'Guide' };

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (TITRES[depuisUrl]) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/inscriptions/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Association et familles fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Inscriptions<br>associatives</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide et RGPD" title="Guide et RGPD">${ICONES.guide}</button>
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
    document.querySelector('[data-vue="guide"].btn-icone')?.setAttribute('aria-pressed', String(vue === 'guide'));
    document.title = `${TITRES[vue]} · ${NOM_PRODUIT}`;
    $('#vue').innerHTML = { bord: vueBord, activites: vueActivites, familles: vueFamilles, paiements: vuePaiements, appel: vueAppel, guide: vueGuide }[vue]();
    if (vue === 'familles') brancherRecherche();
  }
  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const avertExemple = () => (E.tranchesExemple ? `<p class="alerte"><span>Les tranches de quotient familial sont l'<b>exemple fictif</b> fourni avec l'outil. Remplace-les par la grille votée par ton association.</span><button class="btn petit" data-action="tranches">Modifier les tranches</button></p>` : '');
  const libTranche = (t) => (t.max === null ? (E.tranches.length > 1 ? `${t.nom} : au-delà` : t.nom) : `${t.nom} : jusqu'à ${t.max}`);

  // Tableau de bord
  function vueBord() {
    const t = auj();
    const k = R.indicateurs(E, t);
    const imp = R.impayes(E, t);
    const compl = R.aCompleter(E, t);
    const enCours = t >= E.saison.debut && t <= E.saison.fin;
    const titre = !E.activites.length ? 'Commence par tes activités.'
      : k.inscriptions ? `<mark>${pluriel(k.adherents, 'adhérent')}</mark> inscrit${k.adherents > 1 ? 's' : ''}.` : 'Aucune inscription pour l\'instant.';
    const tuiles = [
      ['Remplissage', Math.round(k.remplissage * 100), '%', `${k.inscrits} places prises sur ${k.capacite}${k.complets ? ` · ${pluriel(k.complets, 'créneau complet', 'créneaux complets')}` : ''}.`, 'var(--bleu)', ''],
      ['Liste d\'attente', k.attente, '', k.attente ? 'Inscriptions en attente d\'une place.' : 'Personne n\'attend une place.', 'var(--jaune)', 'rond'],
      ['Impayés en retard', euros(k.retard), '', k.famillesRetard ? `${pluriel(k.famillesRetard, 'famille')} avec une échéance passée non réglée.` : 'Aucune échéance passée impayée.', 'var(--rouge)', ''],
      ['Reste à encaisser', euros(k.reste), '', `${euros(k.encaisse)} encaissés sur ${euros(k.du)} dus.`, 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.association.nom || 'Association')} · ${enCours ? 'saison en cours' : t < E.saison.debut ? 'saison à venir' : 'saison terminée'}</p><h1>Saison ${esc(E.saison.nom)}</h1><p class="titre-bord">${titre} ${k.inscriptions ? `${pluriel(k.inscriptions, 'inscription')} du ${fmt(E.saison.debut, { day: 'numeric', month: 'long', year: 'numeric' })} au ${fmt(E.saison.fin, { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}</p></div>
        <div class="actions"><button class="btn" data-action="famille-nouvelle">${ICONES.plus}Famille</button><button class="btn primaire" data-action="inscription-nouvelle">${ICONES.plus}Inscription</button></div></div>
      ${avertExemple()}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Remplissage par créneau <span>Places prises sur la capacité ; la liste d'attente est hachurée au-delà.</span></h2>
      ${k.creneaux.length ? graphiqueRemplissage(k.creneaux) : vide('Aucun créneau', 'Crée une activité et ses créneaux pour suivre le remplissage.', '<button class="btn primaire" data-action="activite-nouvelle">Créer une activité</button>')}
      <div class="deux-colonnes">
        <section><h2 class="titre-section">Impayés en retard <span>${imp.length ? 'Du plus ancien au plus récent.' : ''}</span></h2>
          ${imp.length ? `<ul class="liste-cadre">${imp.map(({ famille: f, s }) => `<li class="ligne-action"><div><b>${esc(f.nom)}</b><span>Échéance du ${fmt(s.depuis, { day: 'numeric', month: 'long' })} · reste ${euros(s.reste)}</span></div><span class="montant rouge">${euros(s.retard)}</span><button class="btn petit" data-action="paiement-nouveau" data-id="${f.id}">Encaisser</button></li>`).join('')}</ul>` : '<p class="ok-ligne">Aucune échéance passée impayée.</p>'}
        </section>
        <section><h2 class="titre-section">Fiches à compléter <span>${compl.length ? 'Familles avec au moins une inscription.' : ''}</span></h2>
          ${compl.length ? `<ul class="liste-cadre">${compl.slice(0, 12).map((x) => `<li class="ligne-action"><div><b>${esc(x.famille.nom)}</b><span>${esc(x.motif)}</span></div><span></span><button class="btn petit" data-action="famille-modifier" data-id="${x.famille.id}">Compléter</button></li>`).join('')}${compl.length > 12 ? `<li class="ligne-action"><span>Et ${compl.length - 12} autres.</span></li>` : ''}</ul>` : '<p class="ok-ligne">Toutes les fiches sont complètes.</p>'}
        </section>
      </div>`;
  }

  // Barres horizontales HTML : inscrits (bleu) dans le cadre de la capacité, attente hachurée au-delà.
  function graphiqueRemplissage(creneaux) {
    const max = Math.max(1, ...creneaux.map((c) => Math.max(c.capacite, c.inscrits + c.attente)));
    const lignes = creneaux.map((c) => {
      const pc = (n) => `${(n / max) * 100}%`;
      const complet = c.capacite && c.libres === 0;
      return `<button class="barre-ligne" data-action="creneau" data-id="${c.creneau.id}" aria-label="${esc(`${c.activite.nom}, ${horaire(c.creneau)} : ${c.inscrits} inscrits sur ${c.capacite} places, ${c.attente} en attente`)}">
        <span class="barre-nom"><i style="background:${couleur(c.activite.couleur)}"></i><b>${esc(c.activite.nom)}</b> <span class="h">${horaire(c.creneau, true)}</span></span>
        <span class="barre-piste"><span class="cap" style="width:${pc(c.capacite)}"></span><span class="plein" style="width:${pc(Math.min(c.inscrits, c.capacite))}"></span>${c.attente ? `<span class="att" style="left:${pc(Math.min(c.inscrits, c.capacite))};width:${pc(c.attente + Math.max(0, c.inscrits - c.capacite))}"></span>` : ''}</span>
        <span class="barre-val">${c.inscrits}/${c.capacite}${c.attente ? ` <em>+${c.attente}</em>` : ''}${complet ? ' <small>complet</small>' : ''}</span>
      </button>`;
    }).join('');
    return `<figure class="graphique remplissage">
      <div class="legende"><span><i style="background:var(--bleu)"></i>Inscrits</span><span><i class="hachure"></i>Liste d'attente</span><span><i style="background:var(--surface)"></i>Places libres (cadre = capacité)</span></div>
      ${lignes}
      <div class="sr-only"><table><caption>Remplissage par créneau</caption><thead><tr><th>Créneau</th><th>Inscrits</th><th>Capacité</th><th>En attente</th></tr></thead><tbody>${creneaux.map((c) => `<tr><td>${esc(c.activite.nom)} ${horaire(c.creneau)}</td><td>${c.inscrits}</td><td>${c.capacite}</td><td>${c.attente}</td></tr>`).join('')}</tbody></table></div>
    </figure>`;
  }

  // Activités
  function vueActivites() {
    const tr = R.trierTranches(E.tranches);
    const cartes = E.activites.map((a) => {
      const cr = a.creneaux.map((c) => {
        const o = R.occupation(E, c.id);
        return `<button class="creneau-ligne" data-action="creneau" data-id="${c.id}">
          <span><b>${horaire(c)}</b><small>${o.libres ? pluriel(o.libres, 'place libre', 'places libres') : 'Complet'}${o.attente ? ` · ${o.attente} en attente` : ''}</small></span>
          <span class="jauge" aria-hidden="true"><i style="width:${o.capacite ? Math.min(100, o.taux * 100) : 0}%"></i></span>
          <span class="nb ${o.libres ? '' : 'rouge'}">${o.inscrits}/${o.capacite}</span>
        </button>`;
      }).join('');
      return `<article class="activite" style="--c:${couleur(a.couleur)};--t:${texteSur(a.couleur)}">
        <div class="activite-tete"><div><h2>${esc(a.nom)}</h2><p>${esc([a.categorie, a.animateur, a.lieu].filter(Boolean).join(' · '))}</p></div><button data-action="activite-modifier" data-id="${a.id}">Modifier</button></div>
        <div class="tarifs">${tr.map((x) => `<span><small>${esc(x.nom)}</small><b>${a.tarifs?.[x.id] === undefined || a.tarifs?.[x.id] === null || a.tarifs?.[x.id] === '' ? '–' : euros(a.tarifs[x.id])}</b></span>`).join('')}</div>
        <div class="creneaux">${cr || '<p class="matiere-vide">Aucun créneau : ajoute-en un pour pouvoir inscrire.</p>'}</div>
        <div class="activite-pied"><button class="btn petit" data-action="inscription-nouvelle" data-activite="${a.id}">${ICONES.plus}Inscrire</button></div>
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Activités</h1><p>Tarif annuel par tranche de quotient familial, créneaux et places. Touche un créneau pour voir ses inscrits et sa liste d'attente.</p></div>
        <div class="actions"><button class="btn" data-action="tranches">Tranches de quotient familial</button><button class="btn primaire" data-action="activite-nouvelle">${ICONES.plus}Activité</button></div></div>
      ${avertExemple()}
      <p class="bande-tranches"><b>Tranches</b>${tr.map((x) => `<span>${esc(libTranche(x))}</span>`).join('')}</p>
      ${E.activites.length ? `<div class="activites">${cartes}</div>` : vide('Aucune activité', 'Crée tes activités une par une, ou pars des activités types (judo, théâtre, aide aux devoirs…).', '<button class="btn primaire" data-action="activite-nouvelle">Créer une activité</button>')}`;
  }

  // Familles
  function familleCorrespond(f, q) {
    if (!q) return true;
    const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const texte = n([f.nom, ...E.membres.filter((m) => m.familleId === f.id).map((m) => m.prenom), ...(f.responsables || []).map((r) => r.nom)].join(' '));
    return texte.includes(n(q));
  }
  function carteFamille(f) {
    const t = auj();
    const s = R.situation(E, f.id, t);
    const tr = R.trancheDe(f.qf, E.tranches);
    const membres = E.membres.filter((m) => m.familleId === f.id);
    const etiquette = s.retard > 0 ? `<span class="etiquette rouge">Retard ${euros(s.retard)}</span>` : s.reste > 0 ? `<span class="etiquette jaune">Reste ${euros(s.reste)}</span>` : s.reste < 0 ? `<span class="etiquette bleu">Trop-perçu ${euros(-s.reste)}</span>` : s.total ? '<span class="etiquette">Soldé</span>' : '';
    const lignesMembres = membres.map((m) => {
      const ins = E.inscriptions.filter((i) => i.membreId === m.id && i.statut !== 'annule');
      const n = age(m.naissance, t);
      return `<li class="membre"><div class="membre-tete"><button class="lien-membre" data-action="membre-modifier" data-id="${m.id}"><b>${esc(nomMembre(m))}</b></button><span>${n === null ? 'âge inconnu' : `${n} ans`}${estMineur(m.naissance, t) ? ' <span class="etiquette petite">Mineur</span>' : ''}</span></div>
        <div class="puces">${ins.map((i) => { const x = creneauDe(i.creneauId); return x ? `<button class="puce ${i.statut}" style="--c:${couleur(x.activite.couleur)}" data-action="creneau" data-id="${x.creneau.id}"><i></i>${esc(x.activite.nom)} · ${horaire(x.creneau, true)}${i.statut === 'attente' ? ` · attente n° ${R.rangAttente(E, i)}` : ''}</button>` : ''; }).join('')}<button class="puce ajout" data-action="inscription-nouvelle" data-membre="${m.id}">${ICONES.plus}Inscrire</button></div></li>`;
    }).join('');
    const contacts = [...(f.responsables || []).filter((r) => r.nom).map((r) => `<span><b>${esc(r.nom)}</b>${r.lien ? ` (${esc(r.lien.toLowerCase())})` : ''}${r.tel ? ` · <span>${esc(r.tel)}</span>` : ''}</span>`),
      ...(f.urgences || []).filter((r) => r.nom || r.tel).map((r) => `<span class="urgence"><b>Urgence</b> ${esc(r.nom)}${r.tel ? ` · <span>${esc(r.tel)}</span>` : ''}</span>`)];
    return `<article class="famille">
      <div class="famille-tete"><div><h2>${esc(f.nom)}</h2><p>${E.tranches.length > 1 ? `QF ${f.qf ?? 'non renseigné'} · tranche ${esc(tr?.nom || '')}` : 'Tarif unique'} · ${f.nbEcheances > 1 ? `${f.nbEcheances} échéances` : 'paiement en une fois'}</p></div>${etiquette}</div>
      ${contacts.length ? `<div class="contacts">${contacts.join('')}</div>` : ''}
      <ul class="membres">${lignesMembres || '<li class="matiere-vide">Aucun membre.</li>'}</ul>
      <div class="famille-pied"><button class="btn petit" data-action="membre-nouveau" data-id="${f.id}">${ICONES.plus}Membre</button><button class="btn petit" data-action="famille-modifier" data-id="${f.id}">Fiche</button><button class="btn petit" data-action="famille-paiements" data-id="${f.id}">Paiements</button></div>
    </article>`;
  }
  function listeFamilles() {
    const liste = [...E.familles].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).filter((f) => familleCorrespond(f, filtreFamilles));
    return liste.length ? `<div class="familles">${liste.map(carteFamille).join('')}</div>` : filtreFamilles ? '<p class="ok-ligne">Aucune famille ne correspond.</p>' : '';
  }
  function vueFamilles() {
    return `
      <div class="vue-tete"><div><h1>Familles</h1><p>${pluriel(E.familles.length, 'famille')}, ${pluriel(E.membres.length, 'membre')}. Une famille regroupe les adhérents d'un même foyer : responsables légaux, contacts d'urgence, quotient familial et paiements.</p></div>
        <div class="actions"><button class="btn primaire" data-action="famille-nouvelle">${ICONES.plus}Famille</button></div></div>
      <p class="aide rgpd">Données personnelles, dont des mineurs : ne demande que l'indispensable, remets les mentions d'information à chaque famille et ne saisis <b>aucune donnée de santé</b> ici. <button class="btn lien" data-action="vue" data-vue="guide">Rappel RGPD</button></p>
      ${E.familles.length ? `<label class="champ recherche">Rechercher<input id="recherche" type="search" value="${esc(filtreFamilles)}" placeholder="Nom, prénom, responsable" autocomplete="off"></label><div id="liste-familles">${listeFamilles()}</div>`
        : vide('Aucune famille', 'Crée une famille, ajoute ses membres, puis inscris-les aux créneaux.', '<button class="btn primaire" data-action="famille-nouvelle">Créer une famille</button>')}`;
  }
  function brancherRecherche() {
    $('#recherche')?.addEventListener('input', (e) => { filtreFamilles = e.target.value; $('#liste-familles').innerHTML = listeFamilles(); });
  }

  // Paiements
  function vuePaiements() {
    const t = auj();
    const lignes = [...E.familles].map((f) => ({ f, s: R.situation(E, f.id, t) })).filter((x) => x.s.total || x.s.paye);
    const filtres = { retard: (x) => x.s.retard > 0, reste: (x) => x.s.reste > 0, soldees: (x) => x.s.reste <= 0, toutes: () => true };
    const nb = Object.fromEntries(Object.entries(filtres).map(([k, fn]) => [k, lignes.filter(fn).length]));
    const choisies = lignes.filter(filtres[filtrePaiements]).sort((a, b) => b.s.retard - a.s.retard || b.s.reste - a.s.reste || a.f.nom.localeCompare(b.f.nom, 'fr'));
    const journal = [...E.paiements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
    return `
      <div class="vue-tete"><div><h1>Paiements</h1><p>Le dû de chaque famille (adhésion et activités au tarif de sa tranche) est réparti en échéances mensuelles. Une échéance passée non couverte par les paiements est en retard.</p></div>
        <div class="actions"><button class="btn" data-action="csv-soldes">Soldes (CSV)</button><button class="btn primaire" data-action="paiement-nouveau">${ICONES.plus}Encaisser</button></div></div>
      <div class="filtres" role="group" aria-label="Filtrer les familles">${[['retard', 'En retard'], ['reste', 'Reste dû'], ['soldees', 'Soldées'], ['toutes', 'Toutes']].map(([k, l]) => `<button class="filtre" data-action="filtre-paiements" data-id="${k}" aria-pressed="${filtrePaiements === k}">${l} <span>${nb[k]}</span></button>`).join('')}</div>
      ${choisies.length ? `<div class="defile"><table class="tableau cartes-tel"><thead><tr><th>Famille</th><th class="nb">Dû</th><th class="nb">Payé</th><th class="nb">Reste</th><th class="nb">En retard</th><th>Prochaine échéance</th><th></th></tr></thead><tbody>${choisies.map(({ f, s }) => `<tr>
          <td><button class="btn lien" data-action="famille-paiements" data-id="${f.id}">${esc(f.nom)}</button></td><td class="nb" data-lib="Dû">${euros(s.total)}</td><td class="nb" data-lib="Payé">${euros(s.paye)}</td><td class="nb" data-lib="Reste">${s.reste < 0 ? `<span class="bleu-texte">trop-perçu ${euros(-s.reste)}</span>` : euros(s.reste)}</td>
          <td class="nb" data-lib="En retard">${s.retard ? `<b class="rouge-texte">${euros(s.retard)}</b>` : '–'}</td><td data-lib="Prochaine échéance">${s.prochaine ? `${fmt(s.prochaine.date)} · ${euros(s.prochaine.montant)}` : '–'}</td>
          <td><button class="btn petit" data-action="paiement-nouveau" data-id="${f.id}">Encaisser</button></td></tr>`).join('')}</tbody></table></div>`
        : `<p class="ok-ligne">${filtrePaiements === 'retard' ? 'Aucune famille en retard.' : 'Aucune famille dans ce filtre.'}</p>`}
      <h2 class="titre-section">Derniers paiements <span>${pluriel(E.paiements.length, 'paiement')} sur la saison.</span></h2>
      ${journal.length ? `<ul class="liste-cadre">${journal.map((p) => `<li class="ligne-action"><div><b>${esc(famille(p.familleId)?.nom || 'Famille supprimée')}</b><span>${fmt(p.date, { day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(p.mode)}${p.reference ? ` · ${esc(p.reference)}` : ''}</span></div><span class="montant">${euros(p.montant)}</span><button class="btn petit lien" data-action="paiement-supprimer" data-id="${p.id}">Supprimer</button></li>`).join('')}</ul>` : '<p class="ok-ligne">Aucun paiement enregistré.</p>'}`;
  }

  // Listes d'appel
  function vueAppel() {
    const tous = E.activites.flatMap((a) => a.creneaux.map((c) => ({ a, c })));
    if (!tous.length) return `<div class="vue-tete"><div><h1>Listes d'appel</h1></div></div>${vide('Aucun créneau', 'Crée une activité et ses créneaux : la liste d\'appel se remplit avec les inscrits.', '<button class="btn primaire" data-action="activite-nouvelle">Créer une activité</button>')}`;
    if (!tous.some((x) => x.c.id === appel.creneau)) appel.creneau = tous[0].c.id;
    const mois = R.moisSaison(E.saison);
    const t = auj().slice(0, 7);
    if (!mois.includes(appel.mois)) appel.mois = mois.includes(t) ? t : mois[0];
    const { activite: a, creneau: c } = creneauDe(appel.creneau);
    const dates = R.seances(c.jour, E.saison).filter((d) => d.startsWith(appel.mois || ''));
    const inscrits = E.inscriptions.filter((i) => i.creneauId === c.id && i.statut === 'inscrit').map((i) => membre(i.membreId)).filter(Boolean)
      .sort((x, y) => x.nom.localeCompare(y.nom, 'fr') || x.prenom.localeCompare(y.prenom, 'fr'));
    const vides = Math.max(2, Math.min(4, c.capacite - inscrits.length));
    const nomMois = appel.mois ? fmt(`${appel.mois}-01`, { month: 'long', year: 'numeric' }) : '';
    const fermes = (E.saison.fermetures || []).filter((f) => f.debut.slice(0, 7) <= appel.mois && f.fin.slice(0, 7) >= appel.mois);
    return `
      <div class="vue-tete sans-impression"><div><h1>Listes d'appel</h1><p>Une feuille par créneau et par mois, avec une colonne par séance (jours de fermeture exclus). Imprime-la ou enregistre-la en PDF depuis l'impression du navigateur.</p></div>
        <div class="actions"><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <form class="choix-appel sans-impression" id="form-appel">
        <label class="champ">Créneau<select name="creneau">${E.activites.map((x) => `<optgroup label="${esc(x.nom)}">${x.creneaux.map((y) => `<option value="${y.id}" ${y.id === c.id ? 'selected' : ''}>${esc(x.nom)} · ${horaire(y)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="champ">Mois<select name="mois">${mois.map((m) => `<option value="${m}" ${m === appel.mois ? 'selected' : ''}>${fmt(`${m}-01`, { month: 'long', year: 'numeric' })}</option>`).join('')}</select></label>
        <label class="case"><input type="checkbox" name="urgence" ${appel.urgence ? 'checked' : ''}> Ajouter le contact d'urgence</label>
      </form>
      <div class="defile"><section class="feuille-appel" aria-label="Liste d'appel">
        <header><div><p>${esc(E.association.nom)} · saison ${esc(E.saison.nom)}</p><h2>${esc(a.nom)} · ${horaire(c)}</h2><p>${esc([a.animateur && `Animation : ${a.animateur}`, a.lieu].filter(Boolean).join(' · '))}</p></div><div class="mois-appel">${esc(nomMois)}</div></header>
        <table><thead><tr><th class="n">N°</th><th>Nom</th><th>Prénom</th><th class="age">Âge</th>${appel.urgence ? '<th>Contact d\'urgence</th>' : ''}${dates.map((d) => `<th class="date">${fmt(d, { day: '2-digit', month: '2-digit' })}</th>`).join('')}</tr></thead>
        <tbody>${inscrits.map((m, i) => { const f = famille(m.familleId); const u = (f?.urgences || []).find((x) => x.tel) || (f?.responsables || []).find((x) => x.tel); return `<tr><td class="n">${i + 1}</td><td><b>${esc(m.nom)}</b></td><td>${esc(m.prenom)}</td><td class="age">${age(m.naissance, dates[0] || auj()) ?? ''}</td>${appel.urgence ? `<td class="urg">${u ? `${esc(u.nom)} ${esc(u.tel)}` : ''}</td>` : ''}${dates.map(() => '<td class="coche"></td>').join('')}</tr>`; }).join('')}
        ${Array.from({ length: vides }, (_, i) => `<tr class="libre"><td class="n">${inscrits.length + i + 1}</td><td></td><td></td><td class="age"></td>${appel.urgence ? '<td></td>' : ''}${dates.map(() => '<td class="coche"></td>').join('')}</tr>`).join('')}</tbody></table>
        <footer><span>${pluriel(inscrits.length, 'inscrit')} · capacité ${c.capacite}${dates.length ? '' : ' · aucune séance ce mois-ci'}${fermes.length ? ` · fermeture : ${fermes.map((f) => esc(f.nom || 'sans nom')).join(', ')}` : ''}</span><span>Document contenant des données personnelles : à garder par l'animateur, à détruire en fin de saison.</span></footer>
      </section></div>`;
  }

  // Guide
  function vueGuide() {
    const t = auj();
    const purge = R.aPurger(E, t, E.association.conservation);
    const g = B.rgpd;
    return `
      <div class="vue-tete"><div><h1>Guide</h1><p>Comment l'outil calcule, et ce que l'association doit faire avec les données des adhérents.</p></div></div>
      <div class="guide">
        <article class="bloc"><h2>Le parcours d'une inscription</h2><ol>
          <li>Crée la <b>famille</b> (responsables légaux, contacts d'urgence, quotient familial), puis ses <b>membres</b>.</li>
          <li><b>Inscris</b> un membre à un créneau : s'il reste une place, il est inscrit ; sinon il rejoint la <b>liste d'attente</b>, dans l'ordre des dates d'inscription.</li>
          <li>Quand une place se libère (annulation, capacité augmentée), les premiers de la file passent inscrits automatiquement ; le message propose « Annuler ».</li>
          <li>Le <b>dû</b> de la famille (adhésion et activités au tarif de sa tranche) est réparti en échéances mensuelles à partir de la première inscription. <b>Encaisse</b> les paiements au fil de l'eau.</li>
          <li>Imprime les <b>listes d'appel</b> chaque mois pour les animateurs.</li></ol></article>
        <article class="bloc"><h2>Quotient familial et tranches</h2>
          <p>L'outil ne contient <b>aucun barème officiel</b> : les tranches et les tarifs sont ceux que ton association décide. Saisis le quotient familial indiqué sur l'attestation fournie par la famille ; sans quotient, la dernière tranche (tarif plein) s'applique. Un tarif ajusté peut remplacer le tarif de la tranche pour une inscription (aide, gratuité, arrivée en cours d'année).</p>
          <p><b>Tranches actuelles :</b> ${R.trierTranches(E.tranches).map((x) => esc(libTranche(x))).join(' · ')}${E.tranchesExemple ? ' <span class="etiquette jaune">exemple fictif</span>' : ''}.</p>
          <button class="btn petit" data-action="tranches">Modifier les tranches</button></article>
        <article class="bloc rgpd-bloc"><h2>Données personnelles (RGPD)</h2>
          <p>L'association est responsable des données qu'elle collecte. Rappel des recommandations de la CNIL (sources ci-dessous, consultées le ${g.consulte}) ; ce n'est pas un conseil juridique.</p>
          <h3>Informer à la collecte</h3><p>Sur la fiche d'inscription ou dans un document remis, indique :</p><ul class="puces-texte">${g.mentions.map((m) => `<li>${esc(m)}.</li>`).join('')}</ul>
          <p>Pour un enfant, l'information est donnée à lui et à son représentant légal, sous une forme adaptée ; c'est le responsable légal qui exerce le droit d'opposition. Note la date de remise dans chaque fiche famille.</p>
          <h3>Ne demander que l'indispensable</h3><p>Par exemple ni nationalité, ni numéro de sécurité sociale. Les données de santé (allergie, traitement) sont des données sensibles : ne les saisis pas dans cet outil ; si une activité l'exige, recueille-les à part, avec l'accord du représentant légal, et limite qui y a accès. Les informations de paiement ne sont visibles que par les personnes chargées de leur suivi : partage ton accès avec prudence.</p>
          <h3>Durée de conservation</h3><p>La CNIL recommande de conserver les données d'un adhérent <b>trois ans après la fin de son adhésion</b>. Durée réglée ici : <b>${pluriel(E.association.conservation, 'an')}</b> (modifiable dans les réglages). Les listes d'appel imprimées sont à détruire en fin de saison.</p>
          <h3>Exercice des droits</h3><p>${E.association.contact ? `Contact indiqué aux familles : <b>${esc(E.association.contact)}</b>.` : 'Indique dans les réglages le contact (adresse ou e-mail) auquel les familles exercent leurs droits.'} Une famille qui demande l'effacement se supprime depuis sa fiche.</p>
          <h3>Où sont les données ?</h3><p>Sur le service en ligne des templates QME (hébergement Netlify) et en cache sur tes appareils. La démo reste dans ce navigateur.</p>
          <p class="sources">Sources : ${g.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.titre)}</a>`).join(' · ')}.</p></article>
        <article class="bloc"><h2>Familles à supprimer <span class="etiquette ${purge.length ? 'rouge' : ''}">${purge.length}</span></h2>
          <p>Familles sans inscription cette saison dont la dernière saison s'est terminée il y a plus de ${pluriel(E.association.conservation, 'an')}.</p>
          ${purge.length ? `<ul class="liste-cadre">${purge.map((f) => `<li class="ligne-action"><div><b>${esc(f.nom)}</b><span>Dernière saison terminée le ${dateFr(f.derniereFin || f.cree?.slice(0, 10))}</span></div><span></span><button class="btn petit danger" data-action="famille-purger" data-id="${f.id}">Supprimer</button></li>`).join('')}</ul>` : '<p class="ok-ligne">Aucune famille à supprimer.</p>'}</article>
        <article class="bloc"><h2>Limites</h2><ul class="puces-texte">
          <li>Une saison à la fois : « Nouvelle saison » (réglages) vide inscriptions et paiements et garde activités, tranches et familles. Exporte avant.</li>
          <li>Pas de reçu fiscal, de comptabilité ni de paiement en ligne : l'outil suit ce qui est dû et encaissé.</li>
          <li>Environ 900 Ko de données par compte : plusieurs centaines de familles. La place utilisée est indiquée dans les réglages.</li></ul></article>
      </div>`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, large = false) {
    const d = modale();
    const el = $('#toast');
    if (el && el.parentNode !== document.body) document.body.appendChild(el); // sinon effacé avec le contenu
    d.classList.toggle('large', large);
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value, e.submitter);
      if (typeof err === 'string') { const p = d.querySelector('.modale-corps > .erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (err === false) return; // la modale a été remplacée
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('.modale-corps').scrollTop = 0;
    if (matchMedia('(min-width: 721px)').matches) d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
  }
  const pastilles = (choix) => `<fieldset class="champ sans-cadre"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${c.nom}"><input type="radio" name="couleur" value="${c.id}" ${c.id === choix ? 'checked' : ''} aria-label="${c.nom}"><span style="--c:${c.hex}"></span></label>`).join('')}</div></fieldset>`;
  const optionsJours = (j) => B.jours.map((x, i) => `<option value="${i}" ${i === Number(j) ? 'selected' : ''}>${x}</option>`).join('');

  // Activité (créneaux en lignes ; « Ajouter un créneau » relit le formulaire puis réaffiche).
  function lireActivite(f, a) {
    const ids = f.getAll('c-id');
    return {
      id: a?.id, nom: String(f.get('nom') || '').trim(), categorie: f.get('categorie'), couleur: f.get('couleur') || 'bleu', animateur: String(f.get('animateur') || '').trim(), lieu: String(f.get('lieu') || '').trim(),
      tarifs: Object.fromEntries(E.tranches.map((x) => [x.id, String(f.get(`tarif-${x.id}`) ?? '')])),
      creneaux: ids.map((id, i) => ({ id, jour: Number(f.getAll('c-jour')[i]), debut: f.getAll('c-debut')[i], fin: f.getAll('c-fin')[i], capacite: f.getAll('c-cap')[i], suppr: f.getAll('c-suppr').includes(id) })),
    };
  }
  function modaleActivite(id, brouillon) {
    const a = id ? activite(id) : null;
    const b = brouillon || (a ? { ...structuredClone(a), tarifs: Object.fromEntries(Object.entries(a.tarifs || {}).map(([k, v]) => [k, v ?? ''])) }
      : { nom: '', categorie: B.categories[0], couleur: B.couleurs[E.activites.length % B.couleurs.length].id, animateur: '', lieu: '', tarifs: {}, creneaux: [] });
    const tr = R.trierTranches(E.tranches);
    const corps = `
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(b.nom)}" list="activites-types" placeholder="Ex. : Judo enfants"></label>
      <datalist id="activites-types">${B.activites.map((x) => `<option value="${esc(x.nom)}">${esc(x.public)}</option>`).join('')}</datalist>
      <div class="rang-champs"><label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option ${c === b.categorie ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="champ">Animateur<input name="animateur" maxlength="60" value="${esc(b.animateur)}"></label></div>
      <label class="champ">Lieu<input name="lieu" maxlength="60" value="${esc(b.lieu)}"></label>
      ${pastilles(b.couleur)}
      <fieldset class="champ sans-cadre"><legend>Tarif annuel par tranche (€)</legend><div class="grille-tarifs">${tr.map((x) => `<label class="champ"><small>${esc(libTranche(x))}</small><input name="tarif-${x.id}" inputmode="decimal" value="${esc(b.tarifs?.[x.id] ?? '')}" placeholder="0"></label>`).join('')}</div></fieldset>
      <fieldset class="champ sans-cadre"><legend>Créneaux</legend>
        ${b.creneaux.map((c) => { const o = c.id && !String(c.id).startsWith('n') ? R.occupation(E, c.id) : null; return `<div class="ligne-creneau"><input type="hidden" name="c-id" value="${esc(c.id)}">
          <label class="champ"><small>Jour</small><select name="c-jour">${optionsJours(c.jour)}</select></label>
          <label class="champ"><small>Début</small><input type="time" name="c-debut" value="${esc(c.debut)}" required></label>
          <label class="champ"><small>Fin</small><input type="time" name="c-fin" value="${esc(c.fin)}" required></label>
          <label class="champ"><small>Places</small><input type="number" name="c-cap" min="0" max="999" value="${esc(c.capacite)}" required></label>
          <label class="case petite-case" title="${o && (o.inscrits || o.attente) ? 'Ce créneau a des inscriptions' : 'Supprimer ce créneau'}"><input type="checkbox" name="c-suppr" value="${esc(c.id)}" ${c.suppr ? 'checked' : ''}> Retirer</label></div>`; }).join('') || '<p class="aide">Aucun créneau pour l\'instant.</p>'}
        <button class="btn petit" type="button" data-action="ajout-ligne">${ICONES.plus}Ajouter un créneau</button></fieldset>
      <p class="erreur" role="alert"></p>`;
    const pied = a ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>';
    ajoutModale = () => {
      const d = lireActivite(new FormData($('#modale form')), a);
      const modele = B.activites.find((x) => x.nom === d.nom);
      const dernier = d.creneaux.at(-1);
      d.creneaux.push({ id: `n${uid()}`, jour: dernier ? (dernier.jour + 2) % 7 : modele?.jour ?? 2, debut: dernier?.debut || modele?.debut || '14:00', fin: dernier?.fin || modele?.fin || '15:00', capacite: dernier?.capacite || modele?.capacite || 12 });
      modaleActivite(id, d);
      $('#modale .ligne-creneau:last-of-type select')?.focus();
    };
    ouvrirModale(a ? 'Modifier l\'activité' : 'Nouvelle activité', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const n = E.inscriptions.filter((i) => i.activiteId === a.id && i.statut !== 'annule').length;
        if (!confirm(`Supprimer « ${a.nom} »${n ? ` et ses ${pluriel(n, 'inscription')}` : ''} ?`)) return '';
        memoriserAnnulation();
        E.activites = E.activites.filter((x) => x.id !== a.id);
        E.inscriptions = E.inscriptions.filter((i) => i.activiteId !== a.id);
        sauver(); rendre(); toast(`« ${a.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const d = lireActivite(f, a);
      if (!d.nom) return 'Indique le nom de l\'activité.';
      const tarifs = {};
      for (const [k, v] of Object.entries(d.tarifs)) { const n = nombre(v); if (Number.isNaN(n) || (n !== null && n < 0)) return 'Tarifs : des montants positifs en euros.'; tarifs[k] = n; }
      const gardes = [];
      for (const c of d.creneaux) {
        const o = !String(c.id).startsWith('n') ? R.occupation(E, c.id) : { inscrits: 0, attente: 0 };
        if (c.suppr) { if (o.inscrits || o.attente) return `Le créneau du ${B.jours[c.jour].toLowerCase()} a des inscriptions : annule-les avant de le retirer.`; continue; }
        if (!c.debut || !c.fin || c.fin <= c.debut) return 'Chaque créneau finit après son début.';
        const cap = Number(c.capacite);
        if (!Number.isInteger(cap) || cap < 0 || cap > 999) return 'Places : un nombre entier entre 0 et 999.';
        gardes.push({ id: String(c.id).startsWith('n') ? uid() : c.id, jour: c.jour, debut: c.debut, fin: c.fin, capacite: cap });
      }
      memoriserAnnulation();
      const val = { nom: d.nom, categorie: d.categorie, couleur: d.couleur, animateur: d.animateur, lieu: d.lieu, tarifs, creneaux: gardes };
      if (a) Object.assign(a, val); else E.activites.push({ id: uid(), ...val });
      const promus = promouvoir(gardes.map((c) => c.id));
      sauver(); rendre();
      toast(`${a ? 'Activité enregistrée.' : `« ${d.nom} » créée.`}${texteProm(promus)}`, promus.length ? { libelle: 'Annuler', faire: annuler } : null);
    });
  }

  // Tranches de quotient familial
  function modaleTranches(brouillon) {
    const b = brouillon || R.trierTranches(E.tranches).map((x) => ({ ...x, max: x.max ?? '' }));
    const corps = `
      <p class="aide">Indique la grille décidée par ton association (aucun barème officiel n'est fourni). Plafond = quotient familial maximum de la tranche, borne incluse ; la dernière tranche n'a pas de plafond.${E.tranchesExemple ? ' <b>Les tranches actuelles sont un exemple fictif.</b>' : ''}</p>
      ${b.map((x, i) => `<div class="ligne-tranche"><input type="hidden" name="t-id" value="${esc(x.id)}">
        <label class="champ"><small>Nom</small><input name="t-nom" maxlength="30" value="${esc(x.nom)}" required></label>
        <label class="champ"><small>Plafond du QF</small><input name="t-max" inputmode="numeric" value="${esc(x.max ?? '')}" placeholder="${i === b.length - 1 ? 'sans plafond' : ''}"></label>
        ${b.length > 1 ? `<label class="case petite-case"><input type="checkbox" name="t-suppr" value="${esc(x.id)}"> Retirer</label>` : '<span></span>'}</div>`).join('')}
      <button class="btn petit" type="button" data-action="ajout-ligne">${ICONES.plus}Ajouter une tranche</button>
      <p class="aide">Une tranche retirée perd ses tarifs ; une nouvelle tranche démarre sans tarif (à saisir dans chaque activité).</p>
      <p class="erreur" role="alert"></p>`;
    ajoutModale = () => {
      const f = new FormData($('#modale form'));
      const l = f.getAll('t-id').map((id, i) => ({ id, nom: f.getAll('t-nom')[i], max: f.getAll('t-max')[i] }));
      l.push({ id: `n${uid()}`, nom: String.fromCharCode(65 + l.length), max: '' });
      modaleTranches(l);
    };
    ouvrirModale('Tranches de quotient familial', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const ids = f.getAll('t-id'), noms = f.getAll('t-nom'), maxs = f.getAll('t-max'), suppr = f.getAll('t-suppr');
      let lignes = ids.map((id, i) => ({ id, nom: String(noms[i]).trim(), max: String(maxs[i]).trim() === '' ? null : Number(String(maxs[i]).replace(/\s/g, '')) }));
      lignes = lignes.filter((x) => !suppr.includes(x.id));
      const err = R.validerTranches(lignes);
      if (err) return err;
      memoriserAnnulation();
      E.tranches = R.trierTranches(lignes.map((x) => ({ ...x, id: x.id.startsWith('n') ? uid() : x.id })));
      E.tranchesExemple = false;
      const gardes = new Set(E.tranches.map((x) => x.id));
      E.activites.forEach((a) => { a.tarifs = Object.fromEntries(Object.entries(a.tarifs || {}).filter(([k]) => gardes.has(k))); });
      sauver(); rendre(); toast('Tranches enregistrées. Vérifie les tarifs de chaque activité.', { libelle: 'Annuler', faire: annuler });
    });
  }

  // Créneau : inscrits et liste d'attente
  function modaleCreneau(id) {
    const x = creneauDe(id);
    if (!x) return;
    const { activite: a, creneau: c } = x;
    const o = R.occupation(E, id);
    const t = auj();
    const ins = E.inscriptions.filter((i) => i.creneauId === id && i.statut === 'inscrit').sort((p, q) => nomMembre(membre(p.membreId)).localeCompare(nomMembre(membre(q.membreId)), 'fr'));
    const file = R.fileAttente(E, id);
    const ligne = (i, rang) => { const m = membre(i.membreId); const n = age(m?.naissance, t); return `<li class="ligne-action"><div><b>${rang ? `${rang}. ` : ''}${esc(nomMembre(m))}</b><span>${n === null ? '' : `${n} ans · `}inscrit${rang ? ' en attente' : ''} le ${fmt(i.date)} · ${euros(R.tarifInscription(E, i))}</span></div>
      ${rang ? `<button class="btn petit" type="button" data-action="promouvoir" data-id="${i.id}">Inscrire</button>` : '<span></span>'}<button class="btn petit lien" type="button" data-action="inscription-annuler" data-id="${i.id}">${rang ? 'Retirer' : 'Annuler'}</button></li>`; };
    const corps = `
      <p class="surtitre" style="margin:0">${esc(a.nom)}${a.lieu ? ` · ${esc(a.lieu)}` : ''}</p>
      <div class="occupation"><b>${o.inscrits}<small>/ ${o.capacite}</small></b><span>${o.libres ? pluriel(o.libres, 'place libre', 'places libres') : 'Complet'}${o.attente ? ` · ${o.attente} en attente` : ''}</span></div>
      <h3>Inscrits</h3>${ins.length ? `<ul class="liste-cadre">${ins.map((i) => ligne(i, 0)).join('')}</ul>` : '<p class="aide">Personne pour l\'instant.</p>'}
      <h3>Liste d'attente</h3>${file.length ? `<ul class="liste-cadre">${file.map((i, k) => ligne(i, k + 1)).join('')}</ul>` : '<p class="aide">Personne n\'attend.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(horaire(c), corps, `<button class="btn primaire" value="ok">Fermer</button><button class="btn" type="button" data-action="inscription-nouvelle" data-creneau="${c.id}">${ICONES.plus}Inscrire</button><button class="btn gauche" type="button" data-action="appel-creneau" data-id="${c.id}">Liste d'appel</button>`);
  }

  // Famille
  function modaleFamille(id) {
    const f = id ? famille(id) : null;
    const b = f || { nom: '', adresse: '', qf: null, nbEcheances: 1, depart: null, responsables: [], urgences: [], mentionsLe: null };
    const resp = [0, 1].map((i) => b.responsables[i] || {});
    const urg = [0, 1].map((i) => b.urgences[i] || {});
    const plusieurs = E.tranches.length > 1;
    const corps = `
      <label class="champ">Nom de la famille<input name="nom" required maxlength="60" value="${esc(b.nom)}"></label>
      <label class="champ">Adresse<input name="adresse" maxlength="120" value="${esc(b.adresse)}" autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ">Quotient familial<small>${plusieurs ? 'Sur l\'attestation fournie par la famille. Vide : dernière tranche.' : 'Facultatif (tarif unique).'}</small><input name="qf" inputmode="numeric" value="${esc(b.qf ?? '')}"></label>
        <label class="champ">Échéances<small>Paiement en combien de fois.</small><select name="nb">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${i + 1 === Number(b.nbEcheances) ? 'selected' : ''}>${i === 0 ? 'En une fois' : `${i + 1} fois`}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Première échéance<small>Vide : date de la première inscription. Les suivantes tombent chaque mois.</small><input type="date" name="depart" value="${esc(b.depart || '')}"></label>
      ${resp.map((r, i) => `<fieldset class="groupe"><h3>Responsable légal ${i + 1}${i ? ' (facultatif)' : ''}</h3>
        <div class="rang-champs"><label class="champ">Nom et prénom<input name="r-nom" maxlength="60" value="${esc(r.nom || '')}"></label><label class="champ">Lien<select name="r-lien">${B.liens.map((l) => `<option ${l === r.lien ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <div class="rang-champs"><label class="champ">Téléphone<input name="r-tel" type="tel" maxlength="30" value="${esc(r.tel || '')}"></label><label class="champ">E-mail<input name="r-email" type="email" maxlength="80" value="${esc(r.email || '')}"></label></div></fieldset>`).join('')}
      ${urg.map((r, i) => `<fieldset class="groupe"><h3>Contact d'urgence ${i + 1}${i ? ' (facultatif)' : ''}</h3>
        <div class="rang-champs"><label class="champ">Nom et prénom<input name="u-nom" maxlength="60" value="${esc(r.nom || '')}"></label><label class="champ">Lien<input name="u-lien" maxlength="30" value="${esc(r.lien || '')}"></label></div>
        <label class="champ">Téléphone<input name="u-tel" type="tel" maxlength="30" value="${esc(r.tel || '')}"></label></fieldset>`).join('')}
      <fieldset class="groupe"><h3>Information RGPD</h3><p class="aide">Remets à la famille les mentions d'information (finalité, destinataires, durée de conservation, droits) : voir le Guide.</p>
        <label class="champ">Mentions remises le<input type="date" name="mentions" value="${esc(b.mentionsLe || '')}"></label></fieldset>
      <p class="erreur" role="alert"></p>`;
    const pied = f ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer et ajouter un membre</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(f ? `Famille ${esc(f.nom)}` : 'Nouvelle famille', corps, pied, (d, action) => {
      if (action === 'supprimer') return supprimerFamille(f) ? undefined : '';
      const nom = String(d.get('nom') || '').trim();
      if (!nom) return 'Indique le nom de la famille.';
      const qf = nombre(d.get('qf'));
      if (Number.isNaN(qf) || (qf !== null && (qf < 0 || !Number.isInteger(qf)))) return 'Quotient familial : un nombre entier positif.';
      const liste = (pfx, champs) => [0, 1].map((i) => Object.fromEntries(champs.map((c) => [c, String(d.getAll(`${pfx}-${c}`)[i] || '').trim()]))).filter((x) => x.nom || x.tel);
      const responsables = liste('r', ['nom', 'lien', 'tel', 'email']);
      const urgences = liste('u', ['nom', 'lien', 'tel']);
      const val = { nom, adresse: String(d.get('adresse') || '').trim(), qf, nbEcheances: Number(d.get('nb')) || 1, depart: d.get('depart') || null, responsables, urgences, mentionsLe: d.get('mentions') || null };
      memoriserAnnulation();
      if (f) { Object.assign(f, val); sauver(); rendre(); toast('Fiche enregistrée.', { libelle: 'Annuler', faire: annuler }); return; }
      const nf = { id: uid(), ...val, cree: auj() };
      E.familles.push(nf);
      sauver(); rendre();
      modaleMembre(null, nf.id);
      return false;
    }, true);
  }
  function supprimerFamille(f, sansConfirmer = false) {
    const ids = new Set(E.membres.filter((m) => m.familleId === f.id).map((m) => m.id));
    if (!sansConfirmer && !confirm(`Supprimer la famille ${f.nom}, ses ${pluriel(ids.size, 'membre')}, leurs inscriptions et ses paiements ?`)) return false;
    memoriserAnnulation();
    const creneaux = E.inscriptions.filter((i) => ids.has(i.membreId)).map((i) => i.creneauId);
    E.familles = E.familles.filter((x) => x.id !== f.id);
    E.membres = E.membres.filter((m) => !ids.has(m.id));
    E.inscriptions = E.inscriptions.filter((i) => !ids.has(i.membreId));
    E.paiements = E.paiements.filter((p) => p.familleId !== f.id);
    const promus = promouvoir(creneaux);
    if (modale().open) modale().close();
    sauver(); rendre(); toast(`Famille ${f.nom} supprimée.${texteProm(promus)}`, { libelle: 'Annuler', faire: annuler });
    return true;
  }

  // Membre
  function modaleMembre(id, familleId) {
    const m = id ? membre(id) : null;
    const f = famille(m?.familleId || familleId);
    const corps = `
      <p class="surtitre" style="margin:0">Famille ${esc(f?.nom)}</p>
      <div class="rang-champs"><label class="champ">Prénom<input name="prenom" required maxlength="40" value="${esc(m?.prenom || '')}"></label>
      <label class="champ">Nom<input name="nom" required maxlength="60" value="${esc(m?.nom || f?.nom || '')}"></label></div>
      <label class="champ">Date de naissance<small>Sert à l'âge sur les listes et au repérage des mineurs.</small><input type="date" name="naissance" value="${esc(m?.naissance || '')}" max="${auj()}"></label>
      <label class="champ">Remarque<small>Organisation uniquement (ex. : récupéré par sa grand-mère le mercredi). Aucune donnée de santé.</small><textarea name="remarque" maxlength="300">${esc(m?.remarque || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const pied = m ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter et inscrire</button><button class="btn" value="seul">Ajouter seulement</button>';
    ouvrirModale(m ? 'Modifier le membre' : 'Nouveau membre', corps, pied, (d, action) => {
      if (action === 'supprimer') {
        const n = E.inscriptions.filter((i) => i.membreId === m.id && i.statut !== 'annule').length;
        if (!confirm(`Supprimer ${nomMembre(m)}${n ? ` et ses ${pluriel(n, 'inscription')}` : ''} ?`)) return '';
        memoriserAnnulation();
        const creneaux = E.inscriptions.filter((i) => i.membreId === m.id).map((i) => i.creneauId);
        E.membres = E.membres.filter((x) => x.id !== m.id);
        E.inscriptions = E.inscriptions.filter((i) => i.membreId !== m.id);
        const promus = promouvoir(creneaux);
        sauver(); rendre(); toast(`${nomMembre(m)} supprimé.${texteProm(promus)}`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const prenom = String(d.get('prenom') || '').trim(), nom = String(d.get('nom') || '').trim();
      const naissance = d.get('naissance') || '';
      if (!prenom || !nom) return 'Indique le prénom et le nom.';
      if (naissance && (!estDate(naissance) || naissance > auj())) return 'Date de naissance invalide.';
      const val = { prenom, nom, naissance, remarque: String(d.get('remarque') || '').trim() };
      memoriserAnnulation();
      if (m) { Object.assign(m, val); sauver(); rendre(); toast('Membre enregistré.'); return; }
      const nm = { id: uid(), familleId: f.id, ...val };
      E.membres.push(nm);
      sauver(); rendre();
      if (action === 'seul') { toast(`${prenom} ajouté à la famille ${f.nom}.`); return; }
      modaleInscription({ membre: nm.id });
      return false;
    });
  }

  // Inscription
  function modaleInscription(pre = {}) {
    if (!E.familles.length || !E.membres.length) { modaleFamille(); toast('Crée d\'abord une famille et ses membres.'); return; }
    const tous = E.activites.flatMap((a) => a.creneaux.map((c) => ({ a, c })));
    if (!tous.length) { modaleActivite(); toast('Crée d\'abord une activité avec un créneau.'); return; }
    const membreChoisi = pre.membre || E.membres[0].id;
    const creneauChoisi = pre.creneau || (pre.activite ? activite(pre.activite)?.creneaux[0]?.id : null) || tous[0].c.id;
    const familles = [...E.familles].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const corps = `
      <label class="champ">Membre<select name="membre">${familles.map((f) => { const ms = E.membres.filter((m) => m.familleId === f.id); return ms.length ? `<optgroup label="Famille ${esc(f.nom)}">${ms.map((m) => `<option value="${m.id}" ${m.id === membreChoisi ? 'selected' : ''}>${esc(nomMembre(m))}${age(m.naissance, auj()) !== null ? ` (${age(m.naissance, auj())} ans)` : ''}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
      <label class="champ">Créneau<select name="creneau">${E.activites.map((a) => `<optgroup label="${esc(a.nom)}">${a.creneaux.map((c) => { const o = R.occupation(E, c.id); return `<option value="${c.id}" ${c.id === creneauChoisi ? 'selected' : ''}>${esc(a.nom)} · ${horaire(c)} · ${o.libres ? pluriel(o.libres, 'place') : `complet, attente : ${o.attente}`}</option>`; }).join('')}</optgroup>`).join('')}</select></label>
      <div class="rang-champs"><label class="champ">Date d'inscription<input type="date" name="date" value="${auj()}" required></label>
      <label class="champ">Tarif ajusté (€)<small>Vide : tarif de la tranche.</small><input name="tarif" inputmode="decimal" placeholder="tarif de la tranche"></label></div>
      <p class="aide" id="apercu-inscription"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Inscription', corps, '<button class="btn primaire" value="ok">Inscrire</button><button class="btn" value="annuler">Annuler</button>', (d) => {
      const membreId = d.get('membre'), creneauId = d.get('creneau'), date = d.get('date');
      const tarif = nombre(d.get('tarif'));
      if (!estDate(date)) return 'Indique la date d\'inscription.';
      if (Number.isNaN(tarif) || (tarif !== null && tarif < 0)) return 'Tarif ajusté : un montant positif en euros.';
      if (R.dejaInscrit(E, membreId, creneauId)) return 'Ce membre est déjà inscrit (ou en attente) sur ce créneau.';
      memoriserAnnulation();
      const x = creneauDe(creneauId);
      const i = { id: uid(), membreId, activiteId: x.activite.id, creneauId, date, statut: R.statutNouvelle(E, creneauId), ordre: ++E.compteur, tarif };
      E.inscriptions.push(i);
      sauver(); rendre();
      const m = membre(membreId);
      toast(i.statut === 'inscrit' ? `${m.prenom} inscrit en ${x.activite.nom} (${euros(R.tarifInscription(E, i))}).` : `Créneau complet : ${m.prenom} est n° ${R.rangAttente(E, i)} sur la liste d'attente.`, { libelle: 'Annuler', faire: annuler });
    });
    const apercu = () => {
      const f = $('#modale form');
      if (!f) return;
      const m = membre(f.membre.value), x = creneauDe(f.creneau.value);
      if (!m || !x) return;
      const fam = famille(m.familleId), tr = R.trancheDe(fam?.qf, E.tranches);
      const o = R.occupation(E, x.creneau.id);
      const prix = R.tarifInscription(E, { membreId: m.id, activiteId: x.activite.id, tarif: nombre(f.tarif.value) });
      $('#apercu-inscription').innerHTML = `${o.libres ? `<b>Place disponible</b> (${o.inscrits}/${o.capacite}).` : `<b>Complet</b> : ${m.prenom} sera n° ${o.attente + 1} sur la liste d'attente (rien n'est dû tant qu'il attend).`} Tarif : <b>${euros(prix || 0)}</b>${E.tranches.length > 1 ? ` · tranche ${esc(tr?.nom || '')} (QF ${fam?.qf ?? 'non renseigné'})` : ''}.${R.dejaInscrit(E, m.id, x.creneau.id) ? ' <b class="rouge-texte">Déjà inscrit sur ce créneau.</b>' : ''}`;
    };
    $('#modale form').addEventListener('input', apercu);
    $('#modale form').addEventListener('change', apercu);
    apercu();
  }

  // Paiement
  function modalePaiement(familleId) {
    const t = auj();
    const avecDu = [...E.familles].filter((f) => R.situation(E, f.id, t).total > 0 || f.id === familleId).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    if (!avecDu.length) { toast('Aucune famille n\'a de somme due : inscris d\'abord des membres.'); return; }
    const choix = familleId || avecDu[0].id;
    const proposer = (id) => { const s = R.situation(E, id, t); return s.retard > 0 ? s.retard : s.prochaine ? Math.min(s.prochaine.montant, Math.max(0, s.reste)) : Math.max(0, s.reste); };
    const corps = `
      <label class="champ">Famille<select name="famille">${avecDu.map((f) => `<option value="${f.id}" ${f.id === choix ? 'selected' : ''}>${esc(f.nom)} · reste ${euros(R.situation(E, f.id, t).reste)}</option>`).join('')}</select></label>
      <div class="rang-champs"><label class="champ">Date<input type="date" name="date" value="${t}" required></label>
      <label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${String(proposer(choix)).replace('.', ',')}" required></label></div>
      <div class="rang-champs"><label class="champ">Mode<select name="mode">${B.modesPaiement.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
      <label class="champ">Référence<small>N° de chèque, libellé du virement…</small><input name="reference" maxlength="60"></label></div>
      <p class="aide" id="apercu-paiement"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Encaisser un paiement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (d) => {
      const montant = nombre(d.get('montant'));
      if (!montant || Number.isNaN(montant) || montant <= 0) return 'Montant : un nombre positif en euros.';
      if (!estDate(d.get('date'))) return 'Indique la date du paiement.';
      memoriserAnnulation();
      const f = famille(d.get('famille'));
      E.paiements.push({ id: uid(), familleId: f.id, date: d.get('date'), montant: R.eur(R.cts(montant)), mode: d.get('mode'), reference: String(d.get('reference') || '').trim() });
      sauver(); rendre();
      const s = R.situation(E, f.id, t);
      toast(`${euros(montant)} encaissés pour la famille ${f.nom}. ${s.reste > 0 ? `Reste ${euros(s.reste)}.` : s.reste < 0 ? `Trop-perçu de ${euros(-s.reste)}.` : 'Soldé.'}`, { libelle: 'Annuler', faire: annuler });
    });
    const f = $('#modale form');
    const maj = () => { const s = R.situation(E, f.famille.value, t); $('#apercu-paiement').innerHTML = `Dû ${euros(s.total)} · payé ${euros(s.paye)} · ${s.retard ? `<b class="rouge-texte">en retard ${euros(s.retard)}</b>` : 'aucun retard'}${s.prochaine ? ` · prochaine échéance ${fmt(s.prochaine.date)} (${euros(s.prochaine.montant)})` : ''}.`; };
    f.famille.addEventListener('change', () => { f.montant.value = String(proposer(f.famille.value)).replace('.', ','); maj(); });
    maj();
  }

  function modaleFamillePaiements(id) {
    const f = famille(id);
    const t = auj();
    const s = R.situation(E, id, t);
    const ps = E.paiements.filter((p) => p.familleId === id).sort((a, b) => a.date.localeCompare(b.date));
    const corps = `
      <div class="resume-paiement"><span><small>Dû</small><b>${euros(s.total)}</b></span><span><small>Payé</small><b>${euros(s.paye)}</b></span><span><small>Reste</small><b>${euros(s.reste)}</b></span><span class="${s.retard ? 'rouge' : ''}"><small>En retard</small><b>${euros(s.retard)}</b></span></div>
      <h3>Détail du dû</h3><ul class="liste-cadre">${s.du.adhesion ? `<li class="ligne-action"><div><b>Adhésion</b></div><span class="montant">${euros(s.du.adhesion)}</span></li>` : ''}${s.du.lignes.map((l) => { const x = creneauDe(l.inscription.creneauId); return `<li class="ligne-action"><div><b>${esc(nomMembre(membre(l.inscription.membreId)))}</b><span>${esc(x?.activite.nom || '')} · ${x ? horaire(x.creneau, true) : ''}${l.inscription.tarif !== null && l.inscription.tarif !== undefined ? ' · tarif ajusté' : ''}</span></div><span class="montant">${euros(l.montant)}</span></li>`; }).join('') || '<li class="ligne-action"><span>Aucune inscription retenue.</span></li>'}</ul>
      <h3>Échéancier</h3>${s.echeances.length ? `<ul class="liste-cadre">${s.echeances.map((e, i) => `<li class="ligne-action"><div><b>Échéance ${i + 1}</b><span>${fmt(e.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div><span class="montant">${euros(e.montant)}</span><span class="etiquette ${e.couverte ? 'bleu' : e.retard ? 'rouge' : 'jaune'}">${e.couverte ? 'Couverte' : e.retard ? 'En retard' : 'À venir'}</span></li>`).join('')}</ul>` : '<p class="aide">Rien à payer.</p>'}
      <h3>Paiements reçus</h3>${ps.length ? `<ul class="liste-cadre">${ps.map((p) => `<li class="ligne-action"><div><b>${fmt(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</b><span>${esc(p.mode)}${p.reference ? ` · ${esc(p.reference)}` : ''}</span></div><span class="montant">${euros(p.montant)}</span></li>`).join('')}</ul>` : '<p class="aide">Aucun paiement.</p>'}`;
    ouvrirModale(`Paiements · ${esc(f.nom)}`, corps, `<button class="btn primaire" type="button" data-action="paiement-nouveau" data-id="${f.id}">Encaisser</button><button class="btn" type="button" data-action="famille-modifier" data-id="${f.id}">Modifier les échéances</button>`);
  }

  // Réglages
  function modaleReglages() {
    const a = E.association, s = E.saison;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const ko = (R.taille(E) / 1024).toFixed(0);
    const corps = `
      <label class="champ">Nom de l'association<input name="nom" maxlength="80" value="${esc(a.nom)}"></label>
      <label class="champ">Contact pour les données personnelles<small>Adresse ou e-mail où les familles exercent leurs droits (repris dans le Guide).</small><input name="contact" maxlength="120" value="${esc(a.contact)}"></label>
      <div class="rang-champs"><label class="champ">Adhésion annuelle (€)<input name="adhesion" inputmode="decimal" value="${String(a.adhesion.montant || 0).replace('.', ',')}"></label>
      <label class="champ">Adhésion due<select name="par"><option value="famille" ${a.adhesion.par === 'famille' ? 'selected' : ''}>par famille</option><option value="personne" ${a.adhesion.par === 'personne' ? 'selected' : ''}>par personne inscrite</option></select></label></div>
      <label class="champ">Durée de conservation après la dernière saison (ans)<small>Recommandation CNIL : 3 ans après la fin de l'adhésion (voir le Guide).</small><input type="number" name="conservation" min="1" max="10" value="${a.conservation}"></label>
      <fieldset class="groupe"><h3>Saison</h3>
        <div class="rang-champs"><label class="champ">Nom<input name="saison" maxlength="30" value="${esc(s.nom)}"></label><label class="champ">Début<input type="date" name="debut" value="${s.debut}"></label><label class="champ">Fin<input type="date" name="fin" value="${s.fin}"></label></div>
        <label class="champ">Périodes de fermeture<small>Une par ligne : « 19/12/2026 - 03/01/2027 Vacances » ou « 11/11/2026 Férié ». Exclues des listes d'appel.</small><textarea name="fermetures" rows="4">${esc(R.ecrireFermetures(s.fermetures))}</textarea></label></fieldset>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Les données sont enregistrées en ligne avec ta clé. Place utilisée : environ ' + ko + ' Ko sur 900.'} Les fichiers CSV s'ouvrent dans un tableur (séparateur point-virgule).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-inscriptions">Inscriptions (CSV)</button><button class="btn petit" type="button" data-action="csv-soldes">Soldes (CSV)</button><button class="btn petit" type="button" data-action="exporter">Copie complète (JSON)</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Nouvelle saison</h3><p class="aide">Garde activités, tranches et familles ; vide les inscriptions et les paiements. Exporte avant.</p><div class="rang"><button class="btn petit" type="button" data-action="nouvelle-saison">Commencer une nouvelle saison</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const adh = nombre(f.get('adhesion'));
      if (Number.isNaN(adh) || (adh !== null && adh < 0)) return 'Adhésion : un montant positif en euros.';
      const cons = Number(f.get('conservation'));
      if (!Number.isInteger(cons) || cons < 1 || cons > 10) return 'Durée de conservation : entre 1 et 10 ans.';
      const debut = f.get('debut'), fin = f.get('fin');
      if (!estDate(debut) || !estDate(fin) || fin <= debut) return 'La fin de saison doit suivre son début.';
      const { fermetures, erreurs } = R.lireFermetures(f.get('fermetures'));
      if (erreurs.length) return `Périodes de fermeture : ligne ${erreurs.join(', ')} illisible (format JJ/MM/AAAA - JJ/MM/AAAA Libellé).`;
      memoriserAnnulation();
      Object.assign(E.association, { nom: String(f.get('nom') || '').trim(), contact: String(f.get('contact') || '').trim(), adhesion: { montant: adh || 0, par: f.get('par') }, conservation: cons });
      E.saison = { ...E.saison, nom: String(f.get('saison') || '').trim() || E.saison.nom, debut, fin, fermetures };
      sauver(); rendre(); toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    }, true);
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.familles) || !Array.isArray(d.activites) || !Array.isArray(d.inscriptions)) throw new Error();
        if (!confirm(`Remplacer les données actuelles par cette copie (${pluriel(d.familles.length, 'famille')}, ${pluriel(d.inscriptions.length, 'inscription')}) ?`)) return;
        memoriserAnnulation();
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide des inscriptions.'); }
    });
  }

  function modaleNouvelleSaison() {
    const proposee = { nom: '', debut: ajoutMois(E.saison.debut, 12), fin: ajoutMois(E.saison.fin, 12) };
    proposee.nom = `${proposee.debut.slice(0, 4)}-${proposee.fin.slice(0, 4)}`;
    const corps = `
      <p class="aide">La saison ${esc(E.saison.nom)} sera close : ${pluriel(E.inscriptions.length, 'inscription')} et ${pluriel(E.paiements.length, 'paiement')} seront effacés. Activités, tranches et familles sont gardées ; chaque famille inscrite garde la date de fin de saison (durée de conservation). <b>Télécharge d'abord les exports.</b></p>
      <div class="rang"><button class="btn petit" type="button" data-action="csv-inscriptions">Inscriptions (CSV)</button><button class="btn petit" type="button" data-action="csv-soldes">Soldes (CSV)</button><button class="btn petit" type="button" data-action="exporter">Copie complète (JSON)</button></div>
      <div class="rang-champs"><label class="champ">Nouvelle saison<input name="nom" maxlength="30" value="${esc(proposee.nom)}"></label><label class="champ">Début<input type="date" name="debut" value="${proposee.debut}"></label><label class="champ">Fin<input type="date" name="fin" value="${proposee.fin}"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle saison', corps, '<button class="btn primaire danger-plein" value="ok">Clore et commencer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const debut = f.get('debut'), fin = f.get('fin');
      if (!estDate(debut) || !estDate(fin) || fin <= debut) return 'La fin de saison doit suivre son début.';
      if (!confirm('Effacer les inscriptions et paiements de la saison close ?')) return '';
      memoriserAnnulation();
      E = R.nouvelleSaison(E, { nom: String(f.get('nom') || '').trim() || `${debut.slice(0, 4)}-${fin.slice(0, 4)}`, debut, fin });
      sauver(); rendre(); toast(`Saison ${E.saison.nom} commencée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Fichiers ----------
  function telecharger(contenu, nom, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenu], { type }));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const nomFichier = (x) => `${x}-${(E.saison.nom || '').replace(/[^0-9a-z-]/gi, '')}-${auj()}`;

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
    // Une modale ouverte est au premier plan : le toast y entre pour rester cliquable (« Annuler »).
    const parent = modale().open ? modale() : document.body;
    if (el.parentNode !== parent) parent.appendChild(el);
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
    const { action, id } = el.dataset;
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'modele': accueil.modele = id; ecranAccueil(); break;
      case 'choix-activite': {
        el.checked ? accueil.choisies.add(el.value) : accueil.choisies.delete(el.value);
        $('[data-action="accueil-fin"]').textContent = `Créer ma saison (${pluriel(accueil.choisies.size, 'activité')})`;
        break;
      }
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `${nomFichier('inscriptions-copie')}.json`, 'application/json'); break;
      case 'csv-inscriptions': telecharger(R.csvInscriptions(E, auj()), `${nomFichier('inscriptions')}.csv`, 'text/csv;charset=utf-8'); toast(`${pluriel(E.inscriptions.length, 'inscription')} exportée${E.inscriptions.length > 1 ? 's' : ''} (CSV).`); break;
      case 'csv-soldes': telecharger(R.csvSoldes(E, auj()), `${nomFichier('soldes-familles')}.csv`, 'text/csv;charset=utf-8'); toast(`Soldes de ${pluriel(E.familles.length, 'famille')} exportés (CSV).`); break;
      case 'nouvelle-saison': modaleNouvelleSaison(); break;
      case 'fermer': fermer(); break;
      case 'tranches': modaleTranches(); break;
      case 'ajout-ligne': ajoutModale?.(); break;
      case 'activite-nouvelle': modaleActivite(); break;
      case 'activite-modifier': modaleActivite(id); break;
      case 'creneau': modaleCreneau(id); break;
      case 'famille-nouvelle': modaleFamille(); break;
      case 'famille-modifier': modaleFamille(id); break;
      case 'famille-paiements': modaleFamillePaiements(id); break;
      case 'famille-purger': { const f = famille(id); if (f && confirm(`Supprimer définitivement la famille ${f.nom} (durée de conservation dépassée) ?`)) supprimerFamille(f, true); break; }
      case 'membre-nouveau': modaleMembre(null, id); break;
      case 'membre-modifier': modaleMembre(id); break;
      case 'inscription-nouvelle': modaleInscription({ membre: el.dataset.membre, creneau: el.dataset.creneau, activite: el.dataset.activite }); break;
      case 'inscription-annuler': {
        const i = E.inscriptions.find((x) => x.id === id);
        if (!i) break;
        memoriserAnnulation();
        const etaitAttente = i.statut === 'attente';
        i.statut = 'annule';
        const promus = promouvoir([i.creneauId]);
        sauver(); rendre(); modaleCreneau(i.creneauId);
        toast(`${nomMembre(membre(i.membreId))} ${etaitAttente ? 'retiré de la liste d\'attente' : 'désinscrit'}.${texteProm(promus)}`, { libelle: 'Annuler', faire: () => { annuler(); if (modale().open) modaleCreneau(i.creneauId); } });
        break;
      }
      case 'promouvoir': {
        const i = E.inscriptions.find((x) => x.id === id);
        if (!i) break;
        const o = R.occupation(E, i.creneauId);
        if (!o.libres && !confirm(`Le créneau est complet (${o.inscrits}/${o.capacite}). Inscrire quand même en surnombre ?`)) break;
        memoriserAnnulation();
        i.statut = 'inscrit';
        sauver(); rendre(); modaleCreneau(i.creneauId);
        toast(`${nomMembre(membre(i.membreId))} passe de la liste d'attente à inscrit.`, { libelle: 'Annuler', faire: () => { annuler(); if (modale().open) modaleCreneau(i.creneauId); } });
        break;
      }
      case 'paiement-nouveau': modalePaiement(id); break;
      case 'paiement-supprimer': {
        const p = E.paiements.find((x) => x.id === id);
        if (!p) break;
        memoriserAnnulation();
        E.paiements = E.paiements.filter((x) => x.id !== id);
        sauver(); rendre(); toast(`Paiement de ${euros(p.montant)} supprimé.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'filtre-paiements': filtrePaiements = id; rendre(); break;
      case 'appel-creneau': appel.creneau = id; fermer(); changerVue('appel'); break;
      case 'imprimer': window.print(); break;
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const f = e.target.closest('#form-appel');
    if (!f) return;
    appel = { creneau: f.creneau.value, mois: f.mois.value, urgence: f.urgence.checked };
    rendre();
  });
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  modale().addEventListener('close', () => { const el = $('#toast'); if (el && el.parentNode !== document.body) document.body.appendChild(el); });

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
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname); return ouvrirDemo(false); }
    if (new URLSearchParams(location.search).has('demo')) history.replaceState(null, '', location.pathname);
    if (!code) return ecranConnexion();
    if (code === CODE_DEMO) return ouvrirDemo();
    session.code = code;
    try { session.memoriser = localStorage.getItem(CLE_CODE) !== null; } catch { session.memoriser = false; }
    try {
      const { statut, corps } = await appelApi('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
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
  window.__inscriptions = { etat: () => E, demo: () => donneesDemo() };
  init();
})();
