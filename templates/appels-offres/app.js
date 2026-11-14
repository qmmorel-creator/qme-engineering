// Suivi des appels d'offres et candidatures QME : veille et go/no-go, dossiers pièce par pièce, dates limites,
// relances, résultats et statistiques. Données synchronisées par clé de licence ; aucune connexion à une
// plateforme ou à un profil d'acheteur : l'utilisateur dépose lui-même ses dossiers.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CND_REGLES;
  const API = '/api/templates';
  const PRODUIT = 'CND';
  const CLE_CODE = 'qme-cnd-code';
  const CLE_CACHE = 'qme-cnd-cache';
  const CLE_DEMO = 'qme-cnd-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cnd-ecran-accueil';
  const NOM = 'Appels d\'offres et candidatures';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}\u00a0%`);
  const euros = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '–' : `${Math.round(Number(n)).toLocaleString('fr-FR')} €`);
  const heures = (h) => (h === null || h === undefined ? '–' : `${String(h).replace('.', ',')} h`);
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };

  // Dates locales AAAA-MM-JJ ; l'arithmétique passe par les règles (UTC).
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const ajout = R.plusJours;
  const ecart = R.ecartJours;
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const date = (s) => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  const quand = (s) => {
    if (!s) return '–';
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return fmt(s, { weekday: 'long' });
    return fmt(s, { day: 'numeric', month: 'short', ...(s.slice(0, 4) !== auj().slice(0, 4) ? { year: 'numeric' } : {}) });
  };
  const dans = (s) => { const n = ecart(auj(), s); return n < 0 ? `il y a ${pluriel(-n, 'jour')}` : n === 0 ? 'aujourd\'hui' : `dans ${pluriel(n, 'jour')}`; };

  const couleur = (id) => (B.couleurs.find((c) => c.id === id) || B.couleurs[3]).hex;
  const statut = (id) => B.statuts.find((s) => s.id === id) || B.statuts[0];
  const type = (id) => B.types.find((t) => t.id === id) || B.types[B.types.length - 1];
  const motif = (id) => B.motifsPerte.find((m) => m.id === id)?.nom || '';
  const typePiece = (id) => B.typesPieces.find((t) => t.id === id) || B.typesPieces[B.typesPieces.length - 1];
  const TEINTE = { reperee: 'sable', preparation: 'beurre', deposee: 'ciel', gagnee: 'vert', perdue: 'rose', sanssuite: 'sable', nogo: 'sable', abandon: 'sable' };
  const pastille = (id) => `<span class="etiquette t-${TEINTE[id]}">${esc(statut(id).nom)}</span>`;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'echeances';
  let annulation = null;
  let filtre = 'encours', recherche = '';
  let periode = '365';
  let mois = null;
  let jourChoisi = null;

  const reglagesDefaut = () => ({ monNom: '', marge: 1, horizon: 7, delaiDecision: 7, intervalleRelance: 15, seuilBiblio: 30, seuilGo: B.seuils.go, seuilDiscuter: B.seuils.discuter });
  const etatVide = () => ({ version: 1, reglages: reglagesDefaut(), criteres: copie(B.criteres), modeles: copie(B.modeles), biblio: [], consultations: [] });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) },
      criteres: Array.isArray(d.criteres) && d.criteres.length ? d.criteres : v.criteres,
      modeles: Array.isArray(d.modeles) && d.modeles.length ? d.modeles : v.modeles,
      biblio: Array.isArray(d.biblio) ? d.biblio : [],
      consultations: Array.isArray(d.consultations) ? d.consultations.map((c) => ({ notes: {}, pieces: [], relances: [], temps: 0, ...c })) : [] };
  };
  const consultation = (id) => E.consultations.find((c) => c.id === id);
  const piece = (id) => E.biblio.find((b) => b.id === id);
  const seuils = () => ({ go: E.reglages.seuilGo, discuter: E.reglages.seuilDiscuter });
  const score = (c) => R.scoreGrille(E.criteres, c.notes || {}, seuils());
  const optionsAFaire = () => ({ horizon: E.reglages.horizon, marge: E.reglages.marge, delaiDecision: E.reglages.delaiDecision, seuilBiblio: E.reglages.seuilBiblio });
  const modeleDe = (typeId) => E.modeles.find((m) => m.id === type(typeId).modele) || E.modeles[0];
  function remplacer(c) { const i = E.consultations.findIndex((x) => x.id === c.id); if (i >= 0) E.consultations[i] = c; return c; }

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

  async function appel(chemin, opts = {}) {
    const r = await fetch(API + chemin, { ...opts, headers: { 'content-type': 'application/json', ...(session.jeton ? { 'x-code': session.jeton } : {}), ...(opts.headers || {}) } });
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
      const { statut: st, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (st === 409) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié ton suivi entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (st === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (st !== 200) {
        throw new Error(String(st));
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
      const { statut: st, corps } = await appel('/donnees');
      if (st === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
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
  // Code CND-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne d'un template QME (préfixe de 3 lettres, au moins une hors hexadécimal) ; sinon clé Gumroad.
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || /^[0-9A-F]{32}$/.test(n); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut: st, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (st === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (st !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
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

  // ---------- Démo : consultations fictives, dates relatives à aujourd'hui, transitions par les vraies règles ----------
  function donneesDemo() {
    E = etatVide();
    E.reglages.monNom = 'Alex';
    const t = auj();
    const j = (n) => ajout(t, n);
    // Bibliothèque : références, CV, attestations (dates de validité saisies par l'utilisateur).
    const bib = [
      ['reference', 'Accompagnement au changement · Ville de Marbelle (2025)', 'Dossier Références > 2025-marbelle.pdf', -300, null],
      ['reference', 'Formation des managers · Groupe Exemple Distribution (2024)', 'Dossier Références > 2024-exemple-distribution.pdf', -420, null],
      ['reference', 'Facilitation de séminaire · Association Horizon Formation (2026)', 'Dossier Références > 2026-horizon.pdf', -60, null],
      ['cv', 'CV Alex · consultant principal', 'Dossier CV > cv-alex-2026.pdf', -40, null],
      ['cv', 'CV Sam · formatrice associée', 'Dossier CV > cv-sam-2026.pdf', -90, null],
      ['assurance', 'Attestation d\'assurance responsabilité civile professionnelle', 'Dossier Administratif > assurance-rc-pro.pdf', -363, 2],
      ['attestation', 'Attestation de situation fiscale', 'Dossier Administratif > attestation-fiscale.pdf', -180, -3],
      ['attestation', 'Attestation de situation sociale', 'Dossier Administratif > attestation-sociale.pdf', -140, 40],
      ['immatriculation', 'Extrait d\'immatriculation', 'Dossier Administratif > extrait-immatriculation.pdf', -65, 25],
      ['certification', 'Certification qualité de l\'activité de formation', 'Dossier Administratif > certificat-qualite.pdf', -400, 330],
      ['presentation', 'Présentation du cabinet (2 pages)', 'Dossier Modèles > presentation-cabinet.docx', -30, null],
      ['methode', 'Note méthodologique type · conduite du changement', 'Dossier Modèles > methode-changement.docx', -75, null],
    ];
    E.biblio = bib.map(([ty, titre, reference, emis, valide], i) => ({ id: `b${i + 1}`, type: ty, titre, reference, emisLe: j(emis), valideJusquau: valide === null ? '' : j(valide), note: '' }));

    const note = (vals) => Object.fromEntries(E.criteres.map((c, i) => [c.id, vals[i]]));
    const base = (o) => ({ id: uid(), titre: '', acheteur: '', type: 'public', source: B.sources[0], reference: '', lien: '', reperee: t, dateLimite: '', heureLimite: '12:00',
      dateQuestions: '', montantEstime: '', notes: {}, commentaire: '', statut: 'reperee', decision: null, pieces: [], depot: '', relancerLe: null, relances: [],
      offreValable: '', montantOffre: '', resultat: null, temps: 0, ...o });
    const go = (c, jour) => R.decider(c, 'go', { date: j(jour), modele: modeleDe(c.type) });
    const liste = [];

    // Veille.
    liste.push(base({ titre: 'Formation des encadrants à la conduite d\'entretiens', acheteur: 'Agglomération de Brevenne', reference: '2026-FOR-118', reperee: j(-2), dateLimite: j(16), dateQuestions: j(8), montantEstime: 18000, notes: note([3, 2, 3, 3, 2, 2, 1, 2]), commentaire: 'Trois sessions par an, deux ans reconductibles. Critères : 60 % valeur technique, 40 % prix.' }));
    liste.push(base({ titre: 'Diagnostic organisationnel du service courrier', acheteur: 'Syndicat des eaux du Lornec', reference: 'DIAG-26-04', reperee: j(-1), dateLimite: j(9), montantEstime: 9000, notes: note([2, 2, 1, 1, 2, 1, 1, 1]), commentaire: 'Cahier des charges court, délai serré.' }));
    liste.push(base({ titre: 'Accompagnement d\'une réorganisation commerciale (3 mois)', acheteur: 'PME industrielle (via plateforme)', type: 'plateforme', source: 'Plateforme de freelances', reperee: t, dateLimite: j(3), heureLimite: '18:00', montantEstime: 21000 }));
    liste.push(base({ titre: 'Refonte des processus achats', acheteur: 'Coopérative Agricole du Val Doré', type: 'prive', source: 'Réseau ou recommandation', reperee: t, dateLimite: j(30), montantEstime: 14000 }));
    liste.push(R.decider(base({ titre: 'Assistance à maîtrise d\'ouvrage pour un logiciel RH', acheteur: 'Centre hospitalier de Saint-Aubrac', reference: 'AMO-SIRH-2026', reperee: j(-24), dateLimite: j(-6), montantEstime: 45000, notes: note([0, 1, 2, 0, 2, 1, 0, 1]) }), 'nogo', { date: j(-21), motif: 'Hors cœur de métier, aucune référence comparable.' }));

    // En préparation.
    let c = go(base({ titre: 'Accompagnement au changement des services techniques', acheteur: 'Ville de Valmorin', reference: '26-STC-07', reperee: j(-15), dateLimite: j(4), dateQuestions: j(-3), montantEstime: 32000, notes: note([3, 3, 2, 3, 2, 2, 2, 2]), temps: 9.5, commentaire: 'Visite facultative faite. Insister sur la co-construction avec les agents.' }), -12);
    const lier = { 'Attestations demandées (situation fiscale, sociale, assurance…)': 'b7', 'Extrait d\'immatriculation': 'b9', 'Références de prestations comparables': 'b1', 'CV des intervenants': 'b4', 'Mémoire technique (compréhension, méthode, planning, moyens)': 'b12' };
    const resp = ['Alex', 'Alex', 'Alex', 'Sam', 'Sam', 'Alex', 'Sam', 'Alex', 'Alex', 'Alex', 'Alex'];
    c.pieces.forEach((p, i) => { p.responsable = resp[i] || ''; p.biblio = lier[p.libelle] || null; p.statut = i < 3 ? 'pret' : i === 3 ? 'encours' : i === 7 ? 'encours' : i === 4 || i === 6 ? 'pret' : 'afaire'; });
    c.pieces.push({ id: 'pc-plus', libelle: 'Attestation d\'assurance responsabilité civile', delai: 4, type: 'assurance', statut: 'pret', responsable: 'Alex', biblio: 'b6', echeance: null });
    liste.push(c);
    c = go(base({ titre: 'Formation au management de proximité (3 sessions)', acheteur: 'Groupe Hôtelier Exemple', type: 'prive', source: 'Alerte par e-mail', reperee: j(-6), dateLimite: j(12), montantEstime: 12500, notes: note([3, 2, 3, 2, 2, 2, 1, 1]), temps: 3 }), -4);
    c.pieces.forEach((p, i) => { p.statut = i < 2 ? 'pret' : 'afaire'; p.responsable = i % 3 === 2 ? 'Sam' : 'Alex'; if (p.type === 'reference') p.biblio = 'b2'; if (p.type === 'cv') p.biblio = 'b5'; if (p.type === 'presentation') p.biblio = 'b11'; });
    liste.push(c);
    c = go(base({ titre: 'Audit des rituels d\'équipe d\'une start-up (10 jours)', acheteur: 'Client via plateforme', type: 'plateforme', source: 'Plateforme de freelances', reperee: t, dateLimite: j(1), heureLimite: '20:00', montantEstime: 6500, temps: 1 }), 0);
    c.pieces.forEach((p, i) => { p.statut = i === 0 ? 'pret' : 'afaire'; p.responsable = 'Alex'; });
    liste.push(c);

    // Déposées.
    const deposee = (o, decision, depot, delai, extra = {}) => {
      let x = go(base(o), decision);
      x.pieces.forEach((p) => { p.statut = 'pret'; });
      x = R.deposer(x, { date: j(depot), delaiRelance: delai, montantOffre: extra.offre });
      return { ...x, ...(extra.valable ? { offreValable: j(extra.valable) } : {}) };
    };
    liste.push(deposee({ titre: 'Animation d\'ateliers participatifs sur le projet de territoire', acheteur: 'Communauté de communes du Haut-Lizan', reference: 'PT-2026-02', reperee: j(-62), dateLimite: j(-35), montantEstime: 26000, temps: 14 }, -55, -36, 30, { offre: 24500, valable: 55 }));
    liste.push(deposee({ titre: 'Facilitation d\'un séminaire de direction', acheteur: 'Client via plateforme', type: 'plateforme', source: 'Plateforme de freelances', reperee: j(-6), dateLimite: j(-5), montantEstime: 3500, temps: 1.5 }, -6, -5, 5, { offre: 3200 }));
    liste.push(deposee({ titre: 'Cartographie des compétences d\'une équipe support', acheteur: 'Mutuelle Exemple Santé', type: 'prive', source: 'Client existant', reperee: j(-20), dateLimite: j(-10), montantEstime: 10000, temps: 6 }, -18, -10, 21, { offre: 9800 }));

    // Résultats connus (historique sur un an).
    const hist = [
      ['Formation à la prévention des risques psychosociaux pour l\'encadrement', 'Département fictif de Valrive', 'public', -150, -120, -80, 'gagnee', { montant: 21000 }, 16, 23000],
      ['Mission de facilitation agile (20 jours)', 'Client via plateforme', 'plateforme', -75, -70, -60, 'gagnee', { montant: 6400 }, 2, 6400],
      ['Atelier de cohésion d\'équipe', 'Cabinet d\'architectes Exemple', 'directe', -215, -205, -195, 'gagnee', { montant: 4800 }, 4, 4800],
      ['Accompagnement d\'une fusion de services', 'Ville de Brecourt-sur-Lane', 'public', -190, -160, -110, 'perdue', { motif: 'prix', rang: 2 }, 12, 28000],
      ['Plan de formation des managers', 'Groupe Exemple Logistique', 'prive', -125, -100, -88, 'perdue', { motif: 'references' }, 8, 15000],
      ['Coaching d\'équipe de direction', 'Client via plateforme', 'plateforme', -50, -45, -30, 'perdue', { motif: 'inconnu' }, 1, 5200],
      ['Étude d\'organisation des accueils', 'Syndicat intercommunal de la Vèze', 'public', -230, -200, -150, 'sanssuite', {}, 10, 19000],
      ['Conduite du changement d\'un projet numérique', 'Office public de l\'habitat Exemple', 'public', -330, -290, -250, 'perdue', { motif: 'technique', rang: 3 }, 15, 31000],
      ['Parcours de formation des nouveaux managers', 'Clinique des Tilleuls', 'prive', -345, -320, -300, 'gagnee', { montant: 15600 }, 9, 16200],
    ];
    for (const [titre, acheteur, ty, rep, dep, res, st, r, temps, offre] of hist) {
      let x = go(base({ titre, acheteur, type: ty, source: ty === 'plateforme' ? 'Plateforme de freelances' : B.sources[0], reperee: j(rep), dateLimite: j(dep), montantEstime: offre, temps }), rep + 2);
      x.pieces.forEach((p) => { p.statut = 'pret'; });
      x = R.deposer(x, { date: j(dep), delaiRelance: type(ty).relance, montantOffre: offre });
      if (res - dep > 25) x = R.noterRelance(x, { date: j(dep + type(ty).relance), note: 'Relance par e-mail : résultat attendu sous trois semaines.' });
      liste.push(R.cloturer(x, st, { date: j(res), ...r }));
    }
    // Autres no-go de l'année (grille notée).
    liste.push(R.decider(base({ titre: 'Développement d\'une application mobile de réservation', acheteur: 'Client via plateforme', type: 'plateforme', source: 'Plateforme de freelances', reperee: j(-100), dateLimite: j(-95), montantEstime: 15000, notes: note([0, 2, 2, 0, 2, 1, 0, 0]) }), 'nogo', { date: j(-99), motif: 'Hors cœur de métier.' }));
    liste.push(R.decider(base({ titre: 'Schéma directeur de la formation (accord-cadre 4 ans)', acheteur: 'Région fictive d\'Ostrevie', reperee: j(-140), dateLimite: j(-118), montantEstime: 90000, notes: note([2, 0, 1, 1, 2, 1, 0, 2]) }), 'nogo', { date: j(-136), motif: 'Volume trop important pour une structure seule ; à revoir en groupement.' }));
    let ab = go(base({ titre: 'Diagnostic qualité de vie au travail', acheteur: 'Association Exemple Insertion', type: 'prive', reperee: j(-80), dateLimite: j(-66), montantEstime: 8000, temps: 2 }), -78);
    ab = R.cloturer(ab, 'abandon', { date: j(-70), note: 'Charge trop forte sur la période.' });
    liste.push(ab);

    // Relance déjà faite sur le dossier en attente le plus ancien (la suivante est en retard).
    liste[8] = R.noterRelance(liste[8], { date: j(-6), note: 'Appel au service commande publique : analyse en cours.' });
    liste[8].relancerLe = j(-2);
    E.consultations = liste;
    return E;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = `${NOM} · QME`;
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="40" width="150" height="240" fill="#F0EDE6"/>
          <rect x="30" y="80" width="110" height="14" fill="#1D4E89"/><rect x="30" y="112" width="80" height="14" fill="#1D4E89"/><rect x="30" y="144" width="96" height="14" fill="#1D4E89"/>
          <circle cx="290" cy="170" r="90" fill="#F5B400"/>
          <path d="M290 170 L290 100 A70 70 0 0 1 360 170 Z" fill="#D9302A"/>
          <rect x="420" y="160" width="120" height="120" fill="#1D4E89"/>
          <path d="M420 160 A120 120 0 0 1 540 40 V160 Z" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Appels d'offres et candidatures</p>
          <h1>Répondre aux bonnes consultations, à temps.</h1>
          <p>La veille et la décision go/no-go, chaque dossier pièce par pièce avec son rétroplanning, les dates limites au calendrier, les relances après dépôt et ton taux de réussite.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes consultations sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
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
        <p class="mention">Pas encore de suivi ? <a href="/catalogue/appels-offres/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { monNom: '', marge: 1 };

  function ecranAccueil() {
    const a = accueil;
    $('#racine').innerHTML = `<div class="accueil">
      <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
      <p class="surtitre">Bienvenue</p>
      <h1>On prépare ton suivi des candidatures.</h1>
      <p class="intro">Ton prénom sert de responsable par défaut des pièces. La marge de dépôt place ton dépôt visé avant la date limite : un dépôt de dernière minute peut échouer (connexion, signature, fichier trop lourd).</p>
      <div class="accueil-champs">
        <label class="champ">Ton prénom<small>Responsable par défaut des pièces.</small><input id="acc-nom" value="${esc(a.monNom)}" autocomplete="given-name" maxlength="40"></label>
      </div>
      <h2 class="titre-section">Marge de dépôt <span>Jours entre ton dépôt visé et la date limite.</span></h2>
      <div class="filieres" role="group" aria-label="Marge de dépôt">
        ${[[0, 'Le jour même', 'Dépôt visé le jour de la date limite.'], [1, 'La veille', 'Conseillé : une journée pour parer un incident.'], [2, 'Deux jours avant', 'Pour les dossiers lourds ou à signer à plusieurs.']].map(([v, n, d], i) => `<button type="button" class="filiere" style="--c:${couleur(['jaune', 'bleu', 'rouge'][i])}" data-action="acc-marge" data-id="${v}" aria-pressed="${a.marge === v}"><b>${n}</b><span>${d}</span></button>`).join('')}
      </div>
      <p class="aide" style="margin-top:20px">L'application ne se connecte à aucune plateforme ni à aucun profil d'acheteur : tu y notes les consultations repérées, tu décides, tu montes le dossier et tu le déposes toi-même. Les pièces exigées sont celles du règlement de chaque consultation : les modèles de dossiers fournis sont des points de départ, sans valeur réglementaire.</p>
      <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-fin">Créer mon suivi</button></div>
    </div>`;
    $('#acc-nom').addEventListener('input', (e) => { accueil.monNom = e.target.value; });
  }

  function terminerAccueil() {
    E = etatVide();
    E.reglages.monNom = accueil.monNom.trim();
    E.reglages.marge = accueil.marge;
    accueil = { monNom: '', marge: 1 };
    sauver();
    demarrer();
    setTimeout(() => modaleConsultation(), 250);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    echeances: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    veille: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    dossiers: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    bibliotheque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="18" fill="currentColor"/><rect x="10" y="3" width="5" height="18" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 4.5 21 3.5 23 20.5 19 21.5Z" fill="currentColor"/></svg>',
    bilan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="13" height="4" fill="currentColor"/><rect x="3" y="16" width="7" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['echeances', 'Échéances'], ['veille', 'Veille'], ['dossiers', 'Dossiers'], ['bibliotheque', 'Pièces'], ['bilan', 'Bilan']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/appels-offres/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Appels d'offres<br>et candidatures</span>
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
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · ${NOM}`;
    $('#vue').innerHTML = { echeances: vueEcheances, veille: vueVeille, dossiers: vueDossiers, bibliotheque: vueBibliotheque, bilan: vueBilan }[vue]();
    if (vue === 'dossiers') brancherRecherche();
    if (vue === 'bilan') brancherGraphique();
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
  const boutonNouveau = (libelle = 'Consultation', cls = 'primaire') => `<button class="btn ${cls}" data-action="consultation-nouvelle">${ICONES.plus}${libelle}</button>`;
  const limiteTexte = (c) => (c.dateLimite ? `${date(c.dateLimite)}${c.heureLimite ? ` à ${c.heureLimite.replace(':', ' h ')}` : ''}` : 'date limite à saisir');

  // ---------- Échéances ----------
  const GENRES = {
    piece: ['Pièce', 'beurre'], pieces: ['Pièces', 'beurre'], depot: ['Dépôt', 'rose'], questions: ['Questions', 'ciel'], decision: ['Go/no-go', 'sable'],
    relance: ['Relance', 'ciel'], validite: ['Validité de l\'offre', 'sable'], biblio: ['À renouveler', 'rose'],
  };

  function ligneAFaire(x) {
    const [lib, teinte] = GENRES[x.genre];
    const c = x.c;
    let titre = '', detail = '', actions = '';
    if (x.genre === 'pieces') {
      const noms = x.pieces.map((p) => p.libelle);
      titre = `${pluriel(noms.length, 'pièce')} à préparer : ${esc(c.titre)}`;
      detail = `${x.retards ? `${x.retards} en retard · ` : ''}${esc(noms.slice(0, 3).join(' · '))}${noms.length > 3 ? ` · et ${noms.length - 3} autre${noms.length > 4 ? 's' : ''}` : ''}`;
      actions = x.pieces.length === 1 ? `<button class="btn petit" data-action="piece-prete" data-id="${c.id}" data-piece="${x.pieces[0].id}">Prête</button><button class="btn petit" data-action="dossier" data-id="${c.id}">Dossier</button>` : `<button class="btn petit" data-action="dossier" data-id="${c.id}">Ouvrir le dossier</button>`;
    } else if (x.genre === 'piece') {
      titre = esc(x.piece.libelle);
      detail = `${esc(c.titre)}${x.piece.responsable ? ` · ${esc(x.piece.responsable)}` : ''}`;
      actions = `<button class="btn petit" data-action="piece-prete" data-id="${c.id}" data-piece="${x.piece.id}">Prête</button><button class="btn petit" data-action="dossier" data-id="${c.id}">Dossier</button>`;
    } else if (x.genre === 'depot') {
      const a = R.avancement(c);
      titre = `Déposer : ${esc(c.titre)}`;
      detail = `${esc(c.acheteur)} · date limite ${limiteTexte(c)} · ${a.prets}/${a.utiles} pièces prêtes`;
      actions = `<button class="btn petit" data-action="deposer" data-id="${c.id}">Déposée</button><button class="btn petit" data-action="dossier" data-id="${c.id}">Dossier</button>`;
    } else if (x.genre === 'questions') {
      titre = `Dernier jour pour les questions : ${esc(c.titre)}`;
      detail = esc(c.acheteur);
      actions = `<button class="btn petit" data-action="dossier" data-id="${c.id}">Dossier</button>`;
    } else if (x.genre === 'decision') {
      const s = score(c);
      titre = `Décider : ${esc(c.titre)}`;
      detail = `${esc(c.acheteur)} · date limite ${quand(c.dateLimite)}${s.pct !== null ? ` · score ${s.pct}\u00a0%` : ' · grille à remplir'}`;
      actions = `<button class="btn petit" data-action="grille" data-id="${c.id}">Grille go/no-go</button>`;
    } else if (x.genre === 'relance') {
      titre = `Relancer : ${esc(c.titre)}`;
      detail = `${esc(c.acheteur)} · déposée ${quand(c.depot)}${c.relances?.length ? ` · ${pluriel(c.relances.length, 'relance')} déjà` : ''}`;
      actions = `<button class="btn petit" data-action="relance" data-id="${c.id}">Relance faite</button><button class="btn petit" data-action="resultat" data-id="${c.id}">Résultat</button>`;
    } else if (x.genre === 'validite') {
      titre = `Fin de validité de l'offre : ${esc(c.titre)}`;
      detail = `${esc(c.acheteur)} · sans réponse, l'acheteur ne peut plus s'en prévaloir après cette date`;
      actions = `<button class="btn petit" data-action="resultat" data-id="${c.id}">Résultat</button>`;
    } else if (x.genre === 'biblio') {
      titre = esc(x.b.titre);
      detail = `${esc(typePiece(x.b.type).nom)} · ${x.retard > 0 ? 'expirée' : 'expire'} ${quand(x.b.valideJusquau)}`;
      actions = `<button class="btn petit" data-action="biblio-modifier" data-id="${x.b.id}">Mettre à jour</button>`;
    }
    const d = x.retard > 0 ? `<span class="date retard">${x.genre === 'biblio' ? 'expirée' : `${x.retard} j de retard`}</span>` : `<span class="date">${quand(x.date)}</span>`;
    return `<div class="ligne ligne-afaire"><span class="etiquette t-${teinte}">${lib}</span><div><b>${titre}</b><span>${detail}</span></div><div class="ligne-droite">${d}<div class="ligne-actions">${actions}</div></div></div>`;
  }

  function vueEcheances() {
    const t = auj();
    const items = R.regrouperPieces(R.aFaire(E.consultations, E.biblio, t, optionsAFaire()));
    const retards = items.filter((x) => x.retard > 0 && x.genre !== 'biblio').length;
    const enCours = E.consultations.filter((c) => ['preparation', 'deposee'].includes(c.statut));
    const prochaines = E.consultations.filter((c) => ['reperee', 'preparation'].includes(c.statut) && c.dateLimite && c.dateLimite >= t).sort((a, b) => a.dateLimite.localeCompare(b.dateLimite));
    const quinze = prochaines.filter((c) => ecart(t, c.dateLimite) <= 14);
    const salut = E.reglages.monNom ? `Bonjour ${esc(E.reglages.monNom)}. ` : '';
    const titre = !E.consultations.length ? `${salut}Note ta première consultation.`
      : quinze.length ? `${salut}<mark>${pluriel(quinze.length, 'date limite', 'dates limites')}</mark> dans les 15 jours.`
        : `${salut}Aucune date limite dans les 15 jours.`;
    const prochaine = prochaines[0];
    return `
      <section class="jour">
        <div class="jour-titre">
          <p class="surtitre">${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>${titre}</h1>
          ${items.length ? `<p class="sous">${pluriel(items.length, 'point', 'points')} à traiter d'ici ${E.reglages.horizon} jours${retards ? ` · <b style="color:var(--rouge)">${retards} en retard</b>` : ''}</p>` : ''}
          <div class="actions">${boutonNouveau()}<button class="btn" data-action="vue" data-vue="veille">Voir la veille</button></div>
        </div>
        <aside class="resume-carte ${prochaine ? '' : 'vide'}"><p class="surtitre">Prochaine date limite</p>
          ${prochaine ? `<div class="compte">${ecart(t, prochaine.dateLimite)}<small>${ecart(t, prochaine.dateLimite) > 1 ? 'jours' : 'jour'}</small></div><p>${esc(prochaine.titre)}<br><small>${esc(prochaine.acheteur)} · ${limiteTexte(prochaine)}</small></p>` : '<p>Aucune consultation datée en cours.</p>'}
          <button class="btn petit" data-action="vue" data-vue="dossiers">${pluriel(enCours.length, 'dossier en cours', 'dossiers en cours')}</button></aside>
      </section>
      <h2 class="titre-section">À faire <span>Pièces à rendre selon le rétroplanning, dépôts, questions, décisions, relances et pièces à renouveler, jusqu'à ${E.reglages.horizon} jours.</span></h2>
      ${items.length ? `<div class="liste-bloc">${items.map(ligneAFaire).join('')}</div>`
        : E.consultations.length ? vide('Rien à faire dans les prochains jours.', prochaine ? `Prochaine date limite ${quand(prochaine.dateLimite)} : ${esc(prochaine.titre)}.` : 'C\'est le moment de faire ta veille.', boutonNouveau('Consultation repérée', ''))
          : vide('Ton suivi est vide', 'Note une consultation repérée (marché public, appel d\'offres privé, mission sur plateforme) : la grille go/no-go t\'aide à décider, puis le dossier se monte pièce par pièce.', boutonNouveau('Ajouter une consultation'))}
      ${calendrier()}`;
  }

  // Calendrier mensuel des dates limites, dépôts visés, questions, relances.
  const COULEURS_EV = { limite: 'rouge', depot: 'jaune', questions: 'bleu', relance: 'encre', validite: 'orange' };
  const NOMS_EV = { limite: 'Date limite', depot: 'Dépôt visé', questions: 'Questions', relance: 'Relance', validite: 'Validité de l\'offre' };

  function calendrier() {
    const t = auj();
    if (!mois) mois = t.slice(0, 7);
    const semaines = R.grilleMois(mois);
    const debut = semaines[0][0], fin = semaines.at(-1)[6];
    const ev = R.evenements(E.consultations, debut, fin, E.reglages.marge);
    const duMois = ev.filter((x) => x.date.startsWith(mois));
    const titreMois = versDate(`${mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const jours = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
    const courant = mois === t.slice(0, 7);
    const liste = jourChoisi ? duMois.filter((x) => x.date === jourChoisi) : courant ? duMois.filter((x) => x.date >= t) : duMois;
    return `
      <h2 class="titre-section" id="calendrier">Calendrier <span>Dates limites, dépôts visés, questions et relances des consultations en cours.</span></h2>
      <div class="cal">
        <div class="cal-tete"><button class="btn petit" data-action="mois" data-id="-1" aria-label="Mois précédent">‹</button><h3>${titreMois}</h3><button class="btn petit" data-action="mois" data-id="1" aria-label="Mois suivant">›</button>${mois !== t.slice(0, 7) ? '<button class="btn petit lien" data-action="mois" data-id="0">Aujourd\'hui</button>' : ''}</div>
        <div class="cal-legende">${Object.keys(NOMS_EV).map((g) => `<span><i style="background:${couleur(COULEURS_EV[g])}"></i>${NOMS_EV[g]}</span>`).join('')}</div>
        <div class="cal-grille" role="grid" aria-label="Calendrier de ${titreMois}">
          <div class="cal-ligne" role="row">${jours.map((x) => `<span class="cal-jour-nom" role="columnheader">${x}</span>`).join('')}</div>
          ${semaines.map((s) => `<div class="cal-ligne" role="row">${s.map((d) => {
            const du = ev.filter((x) => x.date === d);
            const hors = !d.startsWith(mois);
            return `<button type="button" role="gridcell" class="cal-case${hors ? ' hors' : ''}${d === t ? ' auj' : ''}${d === jourChoisi ? ' choisi' : ''}" data-action="jour" data-id="${d}" aria-label="${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}${du.length ? `, ${pluriel(du.length, 'échéance')}` : ''}">
              <span class="cal-num">${Number(d.slice(8))}</span>
              ${du.slice(0, 3).map((x) => `<span class="cal-ev" style="--c:${couleur(COULEURS_EV[x.genre])}"><i></i><em>${esc(x.c.titre)}</em></span>`).join('')}${du.length > 3 ? `<span class="cal-plus">+${du.length - 3}</span>` : ''}
            </button>`;
          }).join('')}</div>`).join('')}
        </div>
        <div class="cal-liste">
          <h4>${jourChoisi ? `${fmt(jourChoisi, { weekday: 'long', day: 'numeric', month: 'long' })} <button class="btn petit lien" data-action="jour" data-id="">Tout le mois</button>` : courant ? 'À venir ce mois-ci' : 'Ce mois-ci'}</h4>
          ${liste.length ? liste.map((x) => `<button class="ligne ligne-bouton" style="--c:${couleur(COULEURS_EV[x.genre])}" data-action="dossier" data-id="${x.c.id}"><i></i><div><b>${esc(x.c.titre)}</b><span>${NOMS_EV[x.genre]}${x.genre === 'limite' && x.c.heureLimite ? ` à ${x.c.heureLimite.replace(':', ' h ')}` : ''} · ${esc(x.c.acheteur)}</span></div><span class="date">${fmt(x.date)}</span></button>`).join('') : '<p class="liste-vide">Aucune échéance.</p>'}
        </div>
      </div>`;
  }

  // ---------- Veille ----------
  const RECO = { go: ['Go conseillé', 'vert'], discuter: ['À discuter', 'beurre'], nogo: ['No-go conseillé', 'rose'] };
  const jauge = (s) => `<span class="jauge" aria-hidden="true"><i style="width:${s.pct ?? 0}%"></i><b style="left:${E.reglages.seuilDiscuter}%"></b><b style="left:${E.reglages.seuilGo}%"></b></span>`;

  function vueVeille() {
    const t = auj();
    const reperees = E.consultations.filter((c) => c.statut === 'reperee').sort((a, b) => (a.dateLimite || '9999').localeCompare(b.dateLimite || '9999'));
    const ecartees = E.consultations.filter((c) => c.statut === 'nogo').sort((a, b) => (b.decision?.date || '').localeCompare(a.decision?.date || ''));
    const st = R.statistiques(E.consultations, { depuis: ajout(t, -364) }).global;
    return `
      <div class="vue-tete"><div><h1>Veille</h1><p>Les consultations repérées, à décider avant de passer du temps dessus. La grille note ${E.criteres.length} critères de 0 à 3, pondérés : au-dessus de ${E.reglages.seuilGo}\u00a0%, go conseillé ; sous ${E.reglages.seuilDiscuter}\u00a0% ou un critère éliminatoire à 0, no-go conseillé. C'est toi qui décides.</p></div>
        <div class="actions">${boutonNouveau('Consultation repérée')}</div></div>
      ${st.decidees ? `<p class="note-veille">Sur 12 mois : ${pluriel(st.decidees, 'décision')}, ${pct(st.tauxGo)} de go${st.tauxReussite !== null ? `, ${pct(st.tauxReussite)} de réussite sur les résultats connus` : ''}.</p>` : ''}
      ${reperees.length ? `<ul class="veille">${reperees.map((c) => {
        const s = score(c);
        const reco = s.recommandation ? RECO[s.recommandation] : null;
        const n = c.dateLimite ? ecart(t, c.dateLimite) : null;
        return `<li class="veille-carte" style="--c:${couleur(n !== null && n < 0 ? 'rouge' : 'encre')}">
          <div class="veille-corps">
            <p class="carte-matiere"><span class="etiquette t-sable">${esc(type(c.type).nom)}</span>${reco ? `<span class="etiquette t-${reco[1]}">${reco[0]}</span>` : ''}${n !== null && n <= 7 ? `<span class="etiquette t-rose">${n < 0 ? 'Date passée' : `J-${n}`}</span>` : ''}</p>
            <h3><button class="lien-fiche" data-action="dossier" data-id="${c.id}">${esc(c.titre)}</button></h3>
            <p class="carte-meta"><span>${esc(c.acheteur || '–')}</span><span>Date limite : ${limiteTexte(c)}</span>${c.montantEstime ? `<span>Estimé ${euros(c.montantEstime)}</span>` : ''}</p>
            <div class="score">${jauge(s)}<span>${s.pct !== null ? `<b>${s.pct}\u00a0%</b> · ${s.notes}/${s.total} critères notés` : 'Grille non remplie'}${s.eliminatoires.length ? ` · <b class="retard">éliminatoire : ${s.eliminatoires.map((id) => esc(E.criteres.find((x) => x.id === id)?.nom)).join(', ')}</b>` : ''}</span></div>
          </div>
          <div class="veille-actions">
            <button class="btn petit primaire" data-action="grille" data-id="${c.id}">${s.notes ? 'Revoir la grille' : 'Remplir la grille'}</button>
            <button class="btn petit" data-action="go" data-id="${c.id}">Go</button>
            <button class="btn petit" data-action="nogo" data-id="${c.id}">No-go</button>
          </div>
        </li>`;
      }).join('')}</ul>` : vide('Aucune consultation à décider.', 'Note ici ce que tu repères : profils d\'acheteurs, alertes, plateformes, réseau. Une ligne suffit pour commencer.', boutonNouveau('Consultation repérée'))}
      ${ecartees.length ? `<h2 class="titre-section">Écartées <span>No-go décidés, avec leur motif : utile pour affiner ta veille.</span></h2>
        <div class="liste-bloc">${ecartees.map((c) => `<button class="ligne ligne-bouton" style="--c:${couleur('encre')}" data-action="dossier" data-id="${c.id}"><i></i><div><b>${esc(c.titre)}</b><span>${esc(c.acheteur)}${c.decision?.motif ? ` · ${esc(c.decision.motif)}` : ''}</span></div><span class="date">${date(c.decision?.date)}</span></button>`).join('')}</div>` : ''}`;
  }

  // ---------- Dossiers ----------
  const FILTRES = [
    ['encours', 'En cours', (c) => ['preparation', 'deposee'].includes(c.statut)],
    ['preparation', 'En préparation', (c) => c.statut === 'preparation'],
    ['deposee', 'Déposées', (c) => c.statut === 'deposee'],
    ['resultats', 'Résultats', (c) => ['gagnee', 'perdue', 'sanssuite', 'abandon'].includes(c.statut)],
    ['tous', 'Toutes', () => true],
  ];

  function vueDossiers() {
    return `
      <div class="vue-tete"><div><h1>Dossiers</h1><p>Chaque candidature décidée, avec ses pièces, leur responsable et leur échéance à rebours depuis la date limite. Après le dépôt : relances, puis résultat.</p></div>
        <div class="actions"><button class="btn" data-action="exporter-csv">Exporter (CSV)</button>${boutonNouveau()}</div></div>
      <div class="outils-liste">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un intitulé, un acheteur, une référence…" value="${esc(recherche)}"></label>
        <div class="filtres" role="group" aria-label="Filtre">${FILTRES.map(([id, nom, f]) => `<button type="button" data-action="filtre" data-id="${id}" aria-pressed="${filtre === id}">${nom} <b>${E.consultations.filter(f).length}</b></button>`).join('')}</div>
      </div>
      <div id="liste-dossiers">${listeDossiers()}</div>`;
  }

  function listeDossiers() {
    const t = auj();
    const f = FILTRES.find((x) => x[0] === filtre)[2];
    const q = recherche.trim().toLowerCase();
    const cle = (c) => (c.statut === 'preparation' ? `0${c.dateLimite || '9999'}` : c.statut === 'deposee' ? `1${c.relancerLe || '9999'}` : `2${String(99999999 - Number((c.resultat?.date || c.decision?.date || c.reperee || '0').replace(/-/g, '')))}`);
    const liste = E.consultations.filter(f).filter((c) => !q || [c.titre, c.acheteur, c.reference, c.source].join(' ').toLowerCase().includes(q)).sort((a, b) => cle(a).localeCompare(cle(b)));
    if (!E.consultations.length) return vide('Aucun dossier', 'Ajoute une consultation : en la passant en go, son dossier se crée avec les pièces du modèle de son type.', boutonNouveau('Ajouter une consultation'));
    if (!liste.length) return '<p class="liste-vide">Aucun dossier pour ce filtre.</p>';
    return `<ul class="dossiers">${liste.map((c) => {
      const a = R.avancement(c);
      const etats = (c.pieces || []).map((p) => R.etatPiece(p, c, t, E.biblio));
      const enRetard = c.statut === 'preparation' ? etats.filter((e) => e.etat === 'retard').length : 0;
      const alertes = c.statut === 'preparation' ? etats.filter((e) => e.alerte).length : 0;
      let info = '';
      if (c.statut === 'preparation') { const n = c.dateLimite ? ecart(t, c.dateLimite) : null; info = n === null ? 'Date limite à saisir' : n < 0 ? `<span class="retard">Date limite dépassée (${date(c.dateLimite)})</span>` : `Date limite ${dans(c.dateLimite)} · ${limiteTexte(c)}`; }
      else if (c.statut === 'deposee') info = `Déposée ${quand(c.depot)} · ${c.relancerLe && c.relancerLe <= t ? `<span class="retard">relance due ${quand(c.relancerLe)}</span>` : `relance ${quand(c.relancerLe)}`}`;
      else if (c.statut === 'gagnee') info = `Gagnée le ${date(c.resultat?.date)} · ${euros(c.resultat?.montant ?? c.montantOffre)}`;
      else if (c.statut === 'perdue') info = `Perdue le ${date(c.resultat?.date)} · ${esc(motif(c.resultat?.motif))}`;
      else if (c.statut === 'reperee') info = `Repérée · date limite ${quand(c.dateLimite)}`;
      else info = `${statut(c.statut).nom} le ${date(c.resultat?.date || c.decision?.date)}`;
      return `<li><button class="dossier-carte" data-action="dossier" data-id="${c.id}" style="--c:${couleur(statut(c.statut).couleur)}">
        <span class="carte-matiere">${pastille(c.statut)}<span class="etiquette t-sable">${esc(type(c.type).court)}</span>${enRetard ? `<span class="etiquette rouge">${pluriel(enRetard, 'pièce')} en retard</span>` : ''}${alertes ? '<span class="etiquette t-rose">Pièce à renouveler</span>' : ''}</span>
        <b class="dossier-titre">${esc(c.titre)}</b>
        <span class="dossier-meta">${esc(c.acheteur || '–')}${c.reference ? ` · ${esc(c.reference)}` : ''}</span>
        <span class="dossier-info">${info}</span>
        ${a.utiles && ['preparation', 'deposee'].includes(c.statut) ? `<span class="avance"><span class="avance-barre"><i style="width:${a.pct}%"></i></span><small>${a.prets}/${a.utiles} pièces prêtes</small></span>` : ''}
        ${c.temps ? `<span class="dossier-temps">${heures(c.temps)} passées</span>` : ''}
      </button></li>`;
    }).join('')}</ul>`;
  }

  function brancherRecherche() {
    $('#recherche')?.addEventListener('input', (e) => { recherche = e.target.value; $('#liste-dossiers').innerHTML = listeDossiers(); });
  }

  // ---------- Bibliothèque ----------
  const ETATS_BIB = { valide: ['Valide', 'vert'], bientot: ['Expire bientôt', 'beurre'], expiree: ['Expirée', 'rose'], sansdate: ['Sans date', 'sable'] };

  function vueBibliotheque() {
    const t = auj();
    const etats = E.biblio.map((b) => ({ b, e: R.etatBiblio(b, t, E.reglages.seuilBiblio) }));
    const aRenouveler = etats.filter((x) => ['bientot', 'expiree'].includes(x.e.etat)).length;
    const usages = (id) => E.consultations.filter((c) => ['preparation', 'deposee'].includes(c.statut) && (c.pieces || []).some((p) => p.biblio === id)).length;
    const groupes = B.typesPieces.map((ty) => ({ ty, liste: etats.filter((x) => x.b.type === ty.id) })).filter((g) => g.liste.length);
    return `
      <div class="vue-tete"><div><h1>Pièces réutilisables</h1><p>Références, CV, attestations, présentations : où les trouver et jusqu'à quand elles sont valables. L'application garde la référence (dossier, nom de fichier), pas le fichier. Les dates de validité sont celles que tu lis sur chaque pièce.</p></div>
        <div class="actions"><button class="btn primaire" data-action="biblio-nouvelle">${ICONES.plus}Pièce</button></div></div>
      ${aRenouveler ? `<p class="alerte">${pluriel(aRenouveler, 'pièce')} à renouveler (expirée${aRenouveler > 1 ? 's' : ''} ou valable moins de ${E.reglages.seuilBiblio} jours).</p>` : ''}
      ${E.biblio.length ? groupes.map(({ ty, liste }) => `
        <h2 class="titre-section">${esc(ty.nom)} <span>${pluriel(liste.length, 'pièce')}</span></h2>
        <div class="liste-bloc">${liste.map(({ b, e }) => { const [n, te] = ETATS_BIB[e.etat]; const u = usages(b.id); return `<button class="ligne ligne-bouton ligne-biblio" style="--c:${couleur(e.etat === 'expiree' ? 'rouge' : e.etat === 'bientot' ? 'jaune' : 'bleu')}" data-action="biblio-modifier" data-id="${b.id}"><i></i>
          <div><b>${esc(b.titre)}</b><span>${esc(b.reference || 'Emplacement non précisé')}${u ? ` · utilisée dans ${pluriel(u, 'dossier')} en cours` : ''}</span></div>
          <div class="ligne-droite">${e.etat === 'sansdate' && !typePiece(b.type).validite ? '' : `<span class="etiquette t-${te}">${e.etat === 'sansdate' ? 'Validité à saisir' : n}</span>`}<span class="${e.etat === 'expiree' ? 'retard' : ''}">${b.valideJusquau ? `jusqu'au ${date(b.valideJusquau)}` : b.emisLe ? `du ${date(b.emisLe)}` : ''}</span></div></button>`; }).join('')}</div>`).join('')
        : vide('Aucune pièce enregistrée', 'Commence par ce que tu fournis à chaque fois : tes attestations (avec leur date de validité), tes CV, tes 3 meilleures références.', `<button class="btn primaire" data-action="biblio-nouvelle">${ICONES.plus}Ajouter une pièce</button>`)}
      <h2 class="titre-section">Modèles de dossiers <span>Pièces types copiées dans chaque nouveau dossier, avec leur délai avant la date limite.</span></h2>
      <p class="aide">Ces listes sont des points de départ, sans référence réglementaire : la liste exacte des pièces exigées est celle du règlement de chaque consultation (marchés publics compris). Adapte-les à tes habitudes ; un dossier déjà créé garde ses pièces.</p>
      <div class="modeles">${E.modeles.map((m) => `<article class="modele">
        <div class="modele-tete"><div><h3>${esc(m.nom)}</h3><p>${esc(m.description || '')}</p></div><button class="btn petit" data-action="modele-modifier" data-id="${m.id}">Modifier</button></div>
        <ol>${m.pieces.map((p) => `<li><b>J-${p.delai}</b><span>${esc(p.libelle)}</span></li>`).join('')}</ol>
      </article>`).join('')}</div>`;
  }

  // ---------- Bilan ----------
  const PERIODES = [['90', '90 jours'], ['365', '12 mois'], ['tout', 'Tout']];
  const SERIES = [['deposees', 'Déposées', '#2E5A88'], ['gagnees', 'Gagnées', '#E8B93A']];

  function vueBilan() {
    const t = auj();
    const depuis = periode === 'tout' ? null : ajout(t, -Number(periode) + 1);
    const s = R.statistiques(E.consultations, { depuis, types: B.types, motifs: B.motifsPerte, aujourdhui: t, mois: 12 });
    const g = s.global;
    const tuiles = [
      ['Taux de réussite', g.tauxReussite === null ? '–' : Math.round(g.tauxReussite * 100), g.tauxReussite === null ? '' : '%', `${pluriel(g.gagnees, 'gagnée')} sur ${pluriel(g.gagnees + g.perdues, 'résultat connu', 'résultats connus')}.`, 'var(--rouge)', 'rond'],
      ['Montant gagné', g.montantGagne ? Math.round(g.montantGagne).toLocaleString('fr-FR') : '0', '€', g.montantMoyen ? `${euros(g.montantMoyen)} en moyenne par marché ou mission.` : 'Aucun gain sur la période.', 'var(--jaune)', ''],
      ['Taux de go', g.tauxGo === null ? '–' : Math.round(g.tauxGo * 100), g.tauxGo === null ? '' : '%', `${pluriel(g.go, 'go', 'go')} sur ${pluriel(g.decidees, 'décision')}.`, 'var(--bleu)', ''],
      ['Temps passé', String(g.temps).replace('.', ','), 'h', g.euroParHeure ? `${euros(g.euroParHeure)} gagnés par heure de réponse.` : g.tempsMoyen ? `${heures(g.tempsMoyen)} par dossier en moyenne.` : 'Note le temps dans chaque dossier.', 'var(--encre)', 'rond'],
    ].map(([lib, v, u, d, c, fo]) => `<div class="tuile ${fo}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}<small>${u}</small></b><span>${d}</span></div>`).join('');
    const etapes = [['Repérées', g.total, 'encre'], ['Go', g.go, 'jaune'], ['Déposées', g.deposees, 'bleu'], ['Gagnées', g.gagnees, 'vert']];
    const max = Math.max(1, g.total);
    return `
      <div class="vue-tete"><div><h1>Bilan</h1><p>Sur les consultations repérées dans la période. Taux de réussite = gagnées ÷ (gagnées + perdues) : les dossiers sans suite et ceux en attente de réponse n'y entrent pas.</p></div>
        <div class="periodes" role="group" aria-label="Période">${PERIODES.map(([id, nom]) => `<button type="button" data-action="periode" data-id="${id}" aria-pressed="${periode === id}">${nom}</button>`).join('')}</div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">De la veille au gain <span>${g.enAttente ? `${pluriel(g.enAttente, 'dossier')} en attente de réponse, ` : ''}${pluriel(g.sansSuite, 'sans suite', 'sans suite')}, ${pluriel(g.abandons, 'abandon')}.</span></h2>
      ${g.total ? `<figure class="entonnoir" aria-label="De la veille au gain, détail dans le tableau par type">
        ${etapes.map(([n, v, c], k) => `<div class="barre-ent" style="--c:${couleur(c)}"><span class="ent-nom">${n}</span><span class="ent-piste"><i style="width:${Math.max(v ? 1.5 : 0, (v / max) * 100)}%"></i><b>${v}</b></span><span class="ent-taux">${k ? `${pct(etapes[k - 1][1] ? v / etapes[k - 1][1] : null)} <small>de l'étape précédente</small>` : ''}</span></div>`).join('')}
      </figure>` : '<p class="liste-vide">Aucune consultation repérée dans cette période.</p>'}
      <h2 class="titre-section">Par type de consultation</h2>
      ${s.parType.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Type</th><th class="nb">Repérées</th><th class="nb">Go</th><th class="nb">Déposées</th><th class="nb">Gagnées</th><th class="nb">Réussite</th><th class="nb">Montant gagné</th><th class="nb">Temps moyen</th></tr></thead><tbody>${s.parType.map((x) => `<tr><td>${esc(x.nom)}</td><td class="nb">${x.total}</td><td class="nb">${x.go}</td><td class="nb">${x.deposees}</td><td class="nb">${x.gagnees}</td><td class="nb">${pct(x.tauxReussite)} <small>(${x.gagnees}/${x.gagnees + x.perdues})</small></td><td class="nb">${euros(x.montantGagne)}</td><td class="nb">${heures(x.tempsMoyen)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Sur quelques dossiers, un taux varie beaucoup : regarde aussi les effectifs entre parenthèses.</p>` : '<p class="liste-vide">Aucune donnée dans cette période.</p>'}
      <h2 class="titre-section">Dépôts et gains des 12 derniers mois</h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Dossiers déposés et gagnés par mois</h2><div class="legende">${SERIES.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></div>
        ${graphique(s.parMois)}
        <div class="infobulle" hidden></div>
        <table class="sr-only"><caption>Dépôts et gains par mois</caption><thead><tr><th>Mois</th><th>Déposées</th><th>Gagnées</th><th>Perdues</th></tr></thead><tbody>${s.parMois.map((m) => `<tr><td>${nomMois(m.mois, true)}</td><td>${m.deposees}</td><td>${m.gagnees}</td><td>${m.perdues}</td></tr>`).join('')}</tbody></table>
      </figure>
      ${s.parMotif.length ? `<h2 class="titre-section">Motifs de perte <span>${pluriel(g.perdues, 'dossier perdu', 'dossiers perdus')} dans la période.</span></h2><div class="motifs">${s.parMotif.map((m) => `<div><b>${m.n}</b><span>${esc(m.nom)}</span></div>`).join('')}</div>` : ''}`;
  }

  const nomMois = (m, long = false) => versDate(`${m}-01`).toLocaleDateString('fr-FR', long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '');

  function graphique(liste) {
    const L = Math.round(Math.min(760, Math.max(300, window.innerWidth - 64))), H = L < 500 ? 200 : 230, g = 28, b = 26, hz = H - b - 10;
    const max = Math.max(4, ...liste.map((m) => Math.max(m.deposees, m.gagnees)));
    const pas = Math.ceil(max / 4), haut = pas * 4;
    const larg = (L - g) / liste.length;
    const y = (v) => 10 + hz - (v / haut) * hz;
    const grilles = [0, 1, 2, 3, 4].map((i) => `<line class="${i ? 'grille' : 'base'}" x1="${g}" x2="${L}" y1="${y(i * pas)}" y2="${y(i * pas)}"/><text class="axe" x="${g - 8}" y="${y(i * pas) + 4}" text-anchor="end">${i * pas}</text>`).join('');
    const w = Math.max(5, Math.min(22, (larg - 10) / 2));
    const cols = liste.map((m, i) => {
      const x0 = g + i * larg + (larg - (w * 2 + 2)) / 2;
      const rects = SERIES.map(([k, , c], j) => (m[k] ? `<rect x="${x0 + j * (w + 2)}" y="${y(m[k])}" width="${w}" height="${Math.max(1, y(0) - y(m[k]))}" rx="3" fill="${c}" stroke="#24221F" stroke-width="1"/>` : '')).join('');
      const lab = (liste.length - 1 - i) % (L < 500 ? 3 : 1) === 0 ? `<text class="axe" x="${g + i * larg + larg / 2}" y="${H - 6}" text-anchor="middle">${nomMois(m.mois)}</text>` : '';
      return `<rect class="zone" data-i="${i}" x="${g + i * larg}" y="0" width="${larg}" height="${H - b}"/><g class="colonne-g" data-i="${i}">${rects}</g>${lab}`;
    }).join('');
    return `<svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Dossiers déposés et gagnés par mois sur 12 mois, détail dans le tableau">${grilles}${cols}</svg>`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const liste = R.statistiques(E.consultations, { aujourdhui: auj(), mois: 12 }).parMois;
    const montrer = (zone) => {
      const i = Number(zone.dataset.i), m = liste[i];
      fig.querySelectorAll('.colonne-g').forEach((x) => x.classList.toggle('active', x.dataset.i === String(i)));
      bulle.innerHTML = `<b>${nomMois(m.mois, true)}</b>${SERIES.map(([k, l, c]) => `<div><i style="background:${c}"></i>${l} : ${m[k]}</div>`).join('')}<div>Perdues : ${m.perdues}</div>`;
      bulle.hidden = false;
      const rz = zone.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      let x = rz.left - rf.left + rz.width / 2 + 12;
      if (x + bulle.offsetWidth > rf.width - 8) x = rz.left - rf.left - bulle.offsetWidth - 8;
      bulle.style.left = `${Math.max(8, x)}px`;
      bulle.style.top = '48px';
    };
    fig.querySelectorAll('.zone').forEach((z) => { z.addEventListener('pointerenter', () => montrer(z)); z.addEventListener('click', () => montrer(z)); });
    fig.addEventListener('pointerleave', () => { bulle.hidden = true; fig.querySelectorAll('.colonne-g').forEach((x) => x.classList.remove('active')); });
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, large = false) {
    const d = modale();
    d.classList.toggle('large', large);
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(e.target), e.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (err !== false) d.close();
    });
    if (!d.open) d.showModal();
    if (!large) d.querySelector('.modale-corps input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.modale-corps select,.modale-corps textarea')?.focus();
    else d.querySelector('.modale-tete button')?.focus();
  }

  const options = (liste, sel) => liste.map((x) => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const nombre = (v) => { const s = String(v ?? '').replace(/\s/g, '').replace(',', '.'); return s === '' ? '' : Number(s); };

  function modaleConsultation(id) {
    const c = id ? consultation(id) : null;
    const t = auj();
    const corps = `
      <label class="champ">Intitulé<input name="titre" required maxlength="160" value="${esc(c?.titre || '')}" autocomplete="off" placeholder="Objet de la consultation ou de la mission"></label>
      <div class="deux"><label class="champ">Acheteur ou client<input name="acheteur" maxlength="120" value="${esc(c?.acheteur || '')}" autocomplete="off"></label>
      <label class="champ">Type<select name="type">${options(B.types, c?.type || 'public')}</select></label></div>
      <div class="deux"><label class="champ">Référence<small>Numéro de la consultation, si l'acheteur en donne un.</small><input name="reference" maxlength="80" value="${esc(c?.reference || '')}"></label>
      <label class="champ">Source<select name="source">${B.sources.map((s) => `<option ${s === (c?.source || B.sources[0]) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
      <label class="champ">Où trouver le dossier<small>Adresse de la page, profil d'acheteur, dossier sur ton ordinateur… (texte libre).</small><input name="lien" maxlength="300" value="${esc(c?.lien || '')}"></label>
      <div class="trois"><label class="champ">Date limite<input type="date" name="dateLimite" value="${c?.dateLimite || ''}"></label>
      <label class="champ">Heure limite<input type="time" name="heureLimite" value="${c?.heureLimite ?? '12:00'}"></label>
      <label class="champ">Questions jusqu'au<input type="date" name="dateQuestions" value="${c?.dateQuestions || ''}"></label></div>
      <div class="deux"><label class="champ">Repérée le<input type="date" name="reperee" value="${c?.reperee || t}" max="${t}"></label>
      <label class="champ">Montant estimé (€ HT)<input name="montantEstime" inputmode="decimal" value="${c?.montantEstime ?? ''}"></label></div>
      ${c && R.estDepose(c) ? `<div class="deux"><label class="champ">Montant de l'offre (€ HT)<input name="montantOffre" inputmode="decimal" value="${c.montantOffre ?? ''}"></label><label class="champ">Offre valable jusqu'au<small>Délai indiqué par l'acheteur.</small><input type="date" name="offreValable" value="${c.offreValable || ''}"></label></div>` : ''}
      <label class="champ">Notes<textarea name="commentaire" maxlength="2000" placeholder="Critères de choix, visite, allotissement, contacts…">${esc(c?.commentaire || '')}</textarea></label>
      ${c ? '' : `<label class="champ">Étape de départ<select name="depart"><option value="reperee">Repérée : à décider avec la grille go/no-go</option><option value="go">Go déjà décidé : créer le dossier et ses pièces</option></select></label>`}
      <p class="erreur" role="alert"></p>`;
    const pied = c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier la consultation' : 'Nouvelle consultation', corps, pied, (f, action) => {
      if (action === 'supprimer') { supprimer(c.id); return; }
      const v = { titre: String(f.get('titre') || '').trim(), acheteur: String(f.get('acheteur') || '').trim(), type: f.get('type'), reference: String(f.get('reference') || '').trim(),
        source: f.get('source'), lien: String(f.get('lien') || '').trim(), dateLimite: f.get('dateLimite') || '', heureLimite: f.get('heureLimite') || '', dateQuestions: f.get('dateQuestions') || '',
        reperee: f.get('reperee') || t, montantEstime: nombre(f.get('montantEstime')), commentaire: String(f.get('commentaire') || '').trim() };
      if (!v.titre) return 'Indique l\'intitulé de la consultation.';
      if (Number.isNaN(v.montantEstime)) return 'Montant estimé : un nombre, en euros.';
      if (v.dateQuestions && v.dateLimite && v.dateQuestions > v.dateLimite) return 'La date des questions doit précéder la date limite.';
      if (c && R.estDepose(c)) { v.montantOffre = nombre(f.get('montantOffre')); v.offreValable = f.get('offreValable') || ''; if (Number.isNaN(v.montantOffre)) return 'Montant de l\'offre : un nombre, en euros.'; }
      if (c) { Object.assign(c, v); sauver(); rendre(); toast('Consultation enregistrée.'); return; }
      let n = { id: uid(), ...v, notes: {}, statut: 'reperee', decision: null, pieces: [], depot: '', relancerLe: null, relances: [], offreValable: '', montantOffre: '', resultat: null, temps: 0 };
      if (f.get('depart') === 'go') n = R.decider(n, 'go', { date: t, modele: modeleDe(n.type) });
      n.pieces.forEach((p) => { if (!p.responsable) p.responsable = E.reglages.monNom; });
      E.consultations.push(n);
      annulation = { id: n.id, avant: null };
      sauver(); rendre();
      toast(n.statut === 'reperee' ? `${n.titre} : ajoutée à la veille.` : `${n.titre} : dossier créé avec ${pluriel(n.pieces.length, 'pièce')}.`, { libelle: 'Annuler', faire: annuler });
      if (n.statut === 'reperee') setTimeout(() => modaleGrille(n.id), 0);
    });
  }

  // Grille go/no-go : score recalculé à chaque choix, décision en un bouton.
  function modaleGrille(id) {
    const c = consultation(id);
    if (!c) return;
    const notes = { ...(c.notes || {}) };
    const corps = `
      <p class="aide">Note chaque critère de 0 (non) à 3 (fort). Les critères marqués « éliminatoire » notés 0 conduisent à un no-go conseillé. Poids et seuils dans les réglages.</p>
      <div class="grille">${E.criteres.map((k) => `<fieldset class="critere"><legend><b>${esc(k.nom)}</b>${k.eliminatoire ? ' <span class="etiquette t-rose">Éliminatoire</span>' : ''} <small>poids ${k.poids}</small><span>${esc(k.question)}</span></legend>
        <div class="segment-notes">${B.notes.map((n, i) => `<label><input type="radio" name="n-${k.id}" value="${i}" ${notes[k.id] === i ? 'checked' : ''}><span>${i} · ${n}</span></label>`).join('')}</div></fieldset>`).join('')}</div>
      <div class="resultat-grille" id="resultat-grille"></div>
      <label class="champ">Motif de la décision<small>Facultatif ; gardé avec un no-go pour affiner ta veille.</small><input name="motif" maxlength="200" value="${esc(c.decision?.motif || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const pied = c.statut === 'reperee'
      ? '<button class="btn primaire" value="go">Go : créer le dossier</button><button class="btn" value="ok">Enregistrer sans décider</button><button class="btn danger gauche" value="nogo">No-go</button>'
      : '<button class="btn primaire" value="ok">Enregistrer la grille</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(`Go/no-go · ${esc(c.titre)}`, corps, pied, (f, action) => {
      c.notes = notes;
      if (action === 'go' || action === 'nogo') { setTimeout(() => decider(c.id, action, String(f.get('motif') || '').trim()), 0); return; }
      sauver(); rendre(); toast('Grille enregistrée.');
    }, true);
    const maj = () => {
      const s = R.scoreGrille(E.criteres, notes, seuils());
      const reco = s.recommandation ? RECO[s.recommandation] : null;
      $('#resultat-grille').innerHTML = `<div class="score">${jauge(s)}<span><b>${s.pct ?? 0}\u00a0%</b> · ${s.notes}/${s.total} critères notés</span></div>
        <p>${reco ? `<span class="etiquette t-${reco[1]}">${reco[0]}</span> ` : ''}${s.eliminatoires.length ? `Critère éliminatoire à 0 : ${s.eliminatoires.map((x) => esc(E.criteres.find((k) => k.id === x)?.nom)).join(', ')}.` : s.complet ? `Seuils : go à partir de ${E.reglages.seuilGo}\u00a0%, à discuter à partir de ${E.reglages.seuilDiscuter}\u00a0%.` : 'Note tous les critères pour obtenir une recommandation.'}</p>`;
    };
    modale().querySelectorAll('.segment-notes input').forEach((r) => r.addEventListener('change', () => { notes[r.name.slice(2)] = Number(r.value); maj(); }));
    maj();
  }

  function decider(id, choix, motifTexte = '') {
    const c = consultation(id);
    if (!c || c.statut !== 'reperee') return;
    annulation = { id, avant: copie(c) };
    const n = remplacer(R.decider(c, choix, { date: auj(), motif: motifTexte, modele: modeleDe(c.type) }));
    n.pieces.forEach((p) => { if (!p.responsable) p.responsable = E.reglages.monNom; });
    sauver(); rendre();
    toast(choix === 'go' ? `Go : dossier créé avec ${pluriel(n.pieces.length, 'pièce')}.` : 'No-go enregistré : consultation écartée.', { libelle: 'Annuler', faire: annuler });
    if (choix === 'go' && !n.dateLimite) setTimeout(() => toast('Saisis la date limite pour calculer les échéances des pièces.'), 100);
  }

  // Dossier : informations, pièces avec échéance à rebours, actions selon le statut, historique.
  function modaleDossier(id) {
    const c = consultation(id);
    if (!c) return;
    const t = auj();
    const s = score(c);
    const a = R.avancement(c);
    const lignePiece = (p) => {
      const e = R.etatPiece(p, c, t, E.biblio);
      const delai = c.dateLimite && e.echeance ? ecart(e.echeance, c.dateLimite) : null;
      const candidates = E.biblio.filter((b) => !p.type || b.type === p.type);
      const autres = E.biblio.filter((b) => p.type && b.type !== p.type);
      const optBib = `<option value="">Aucune pièce liée</option>${candidates.map((b) => `<option value="${b.id}" ${b.id === p.biblio ? 'selected' : ''}>${esc(b.titre)}</option>`).join('')}${autres.length ? `<optgroup label="Autres pièces">${autres.map((b) => `<option value="${b.id}" ${b.id === p.biblio ? 'selected' : ''}>${esc(b.titre)}</option>`).join('')}</optgroup>` : ''}`;
      return `<li class="piece etat-${e.etat}" data-piece="${p.id}">
        <div class="piece-tete">
          <label class="piece-statut"><span class="sr-only">Statut de ${esc(p.libelle)}</span><select data-champ="statut">${B.statutsPiece.map((x) => `<option value="${x.id}" ${x.id === p.statut ? 'selected' : ''}>${x.nom}</option>`).join('')}</select></label>
          <b class="piece-nom">${esc(p.libelle)}</b>
          <span class="piece-ech ${e.etat === 'retard' ? 'retard' : ''}">${e.etat === 'sansobjet' ? '' : e.echeance ? `${delai !== null && !p.echeance ? `J-${delai} · ` : ''}${fmt(e.echeance)}${e.etat === 'retard' ? ` · ${e.retard} j de retard` : ''}` : 'date limite à saisir'}</span>
          <button type="button" class="piece-suppr" data-action="piece-suppr" data-id="${c.id}" data-piece="${p.id}" aria-label="Retirer ${esc(p.libelle)}">×</button>
        </div>
        <div class="piece-champs">
          <label class="champ"><span>Responsable</span><input data-champ="responsable" maxlength="40" value="${esc(p.responsable || '')}"></label>
          <label class="champ"><span>Prête le</span><input type="date" data-champ="echeance" value="${e.echeance || ''}"></label>
          <label class="champ piece-bib"><span>Pièce de la bibliothèque</span><select data-champ="biblio">${optBib}</select></label>
        </div>
        ${e.alerte ? `<p class="piece-alerte">${e.alerte === 'expiree' ? `Pièce liée expirée le ${date(e.b.valideJusquau)} : à renouveler.` : `Pièce liée valable jusqu'au ${date(e.b.valideJusquau)}, avant la date limite : à renouveler.`}</p>` : ''}
      </li>`;
    };
    let actions = '';
    if (c.statut === 'reperee') actions = `<button type="button" class="btn petit primaire" data-action="grille" data-id="${c.id}">Grille go/no-go</button><button type="button" class="btn petit" data-action="go" data-id="${c.id}">Go</button><button type="button" class="btn petit" data-action="nogo" data-id="${c.id}">No-go</button>`;
    else if (c.statut === 'preparation') actions = `<button type="button" class="btn petit primaire" data-action="deposer" data-id="${c.id}">Marquer déposée</button><button type="button" class="btn petit" data-action="abandon" data-id="${c.id}">Abandonner</button>`;
    else if (c.statut === 'deposee') actions = `<button type="button" class="btn petit primaire" data-action="resultat" data-id="${c.id}">Noter le résultat</button><button type="button" class="btn petit" data-action="relance" data-id="${c.id}">Relance faite</button><button type="button" class="btn petit" data-action="relance-date" data-id="${c.id}">Changer la date de relance</button>`;
    else actions = `<button type="button" class="btn petit" data-action="rouvrir" data-id="${c.id}">Rouvrir</button>`;
    let etat = '';
    if (c.statut === 'reperee') etat = `<div><span class="surtitre">Grille go/no-go</span><b>${s.pct !== null ? `${s.pct}\u00a0%` : '–'}</b><small>${s.recommandation ? RECO[s.recommandation][0] : `${s.notes}/${s.total} critères notés`}</small></div>`;
    else if (c.statut === 'preparation') etat = `<div><span class="surtitre">Dépôt visé</span><b class="${R.depotVise(c, E.reglages.marge) < t ? 'retard' : ''}">${c.dateLimite ? quand(R.depotVise(c, E.reglages.marge)) : '–'}</b><small>${a.prets}/${a.utiles} pièces prêtes</small></div>`;
    else if (c.statut === 'deposee') etat = `<div><span class="surtitre">Prochaine relance</span><b class="${c.relancerLe && c.relancerLe <= t ? 'retard' : ''}">${quand(c.relancerLe)}</b><small>Déposée le ${date(c.depot)}${c.montantOffre ? ` · offre ${euros(c.montantOffre)}` : ''}</small></div>`;
    else if (c.statut === 'gagnee') etat = `<div><span class="surtitre">Gagnée</span><b>${euros(c.resultat?.montant ?? c.montantOffre)}</b><small>le ${date(c.resultat?.date)}</small></div>`;
    else if (c.statut === 'perdue') etat = `<div><span class="surtitre">Perdue</span><b>${esc(motif(c.resultat?.motif))}</b><small>le ${date(c.resultat?.date)}${c.resultat?.rang ? ` · classé ${c.resultat.rang}e` : ''}</small></div>`;
    else etat = `<div><span class="surtitre">${esc(statut(c.statut).nom)}</span><b>${date(c.resultat?.date || c.decision?.date)}</b><small>${esc(c.decision?.motif || c.resultat?.note || '')}</small></div>`;
    const histo = [
      c.reperee && [c.reperee, 'Repérée', c.source || ''],
      c.decision && [c.decision.date, c.decision.choix === 'go' ? 'Go' : 'No-go', c.decision.motif || (s.pct !== null ? `score ${s.pct}\u00a0%` : '')],
      c.depot && [c.depot, 'Déposée', c.montantOffre ? `offre ${euros(c.montantOffre)}` : ''],
      ...(c.relances || []).map((r) => [r.date, 'Relance', r.note || '']),
      c.resultat && [c.resultat.date, statut(c.statut).nom, [c.resultat.montant ? euros(c.resultat.montant) : '', c.resultat.motif ? motif(c.resultat.motif) : '', c.resultat.note || ''].filter(Boolean).join(' · ')],
    ].filter(Boolean).sort((x, y) => x[0].localeCompare(y[0])).reverse();
    const corps = `
      <div class="fiche-entete"><p>${pastille(c.statut)} <span class="etiquette t-sable">${esc(type(c.type).nom)}</span></p>
        <p class="fiche-org">${esc(c.acheteur || '–')}${c.reference ? ` · ${esc(c.reference)}` : ''}</p>
        <p class="fiche-meta">Date limite : <b>${limiteTexte(c)}</b>${c.dateQuestions ? ` · questions jusqu'au ${date(c.dateQuestions)}` : ''}${c.montantEstime ? ` · estimé ${euros(c.montantEstime)}` : ''}</p>
        ${c.lien ? `<p class="fiche-meta">${/^https?:\/\//.test(c.lien) ? `<a href="${esc(c.lien)}" target="_blank" rel="noopener">${esc(c.lien)}</a>` : esc(c.lien)}</p>` : ''}
        ${c.commentaire ? `<p class="fiche-notes">${esc(c.commentaire)}</p>` : ''}</div>
      <div class="fiche-statut">${etat}
        <div class="temps"><span class="surtitre">Temps passé</span><b>${heures(c.temps || 0)}</b><span class="rang"><button type="button" class="btn petit" data-action="temps" data-id="${c.id}" data-delta="-0.5" aria-label="Retirer une demi-heure">−½ h</button><button type="button" class="btn petit" data-action="temps" data-id="${c.id}" data-delta="0.5">+½ h</button><button type="button" class="btn petit" data-action="temps" data-id="${c.id}" data-delta="1">+1 h</button></span></div>
      </div>
      <div class="fiche-actions">${actions}</div>
      ${c.pieces?.length || c.statut !== 'reperee' ? `<h3 class="sous-titre">Pièces <small>${a.prets}/${a.utiles} prêtes · échéances à rebours depuis la date limite, avancées au vendredi si elles tombent un week-end</small></h3>
      <ol class="pieces" data-dossier="${c.id}">${(c.pieces || []).map(lignePiece).join('')}</ol>
      <div class="ajout-piece"><label class="champ"><span class="sr-only">Nouvelle pièce</span><input id="nouvelle-piece" maxlength="160" placeholder="Ajouter une pièce demandée par le règlement"></label><label class="champ"><span class="sr-only">Jours avant la date limite</span><input id="nouvelle-delai" type="number" min="0" max="90" value="3" inputmode="numeric" title="Jours avant la date limite"></label><button type="button" class="btn petit" data-action="piece-ajout" data-id="${c.id}">Ajouter</button></div>` : ''}
      <h3 class="sous-titre">Historique</h3>
      <ol class="historique">${histo.map(([d, ty, x]) => `<li><span class="h-date">${date(d)}</span><span class="h-type">${esc(ty)}</span><span>${esc(x)}</span></li>`).join('')}</ol>`;
    ouvrirModale(esc(c.titre), corps, '<button class="btn primaire" value="ok">Fermer</button><button class="btn" value="modifier">Modifier</button><button class="btn danger gauche" value="supprimer">Supprimer</button>', (f, action) => {
      if (action === 'modifier') { setTimeout(() => modaleConsultation(c.id), 0); return; }
      if (action === 'supprimer') { supprimer(c.id); }
    }, true);
    // Modifications en ligne des pièces : enregistrées aussitôt.
    modale().querySelectorAll('.piece [data-champ]').forEach((el) => el.addEventListener('change', () => {
      const p = c.pieces.find((x) => x.id === el.closest('.piece').dataset.piece);
      if (!p) return;
      const champ = el.dataset.champ;
      if (champ === 'echeance') { const calc = R.echeancePiece({ ...p, echeance: null }, c.dateLimite); p.echeance = el.value && el.value !== calc ? el.value : null; }
      else if (champ === 'biblio') { p.biblio = el.value || null; if (p.biblio && R.etatBiblio(piece(p.biblio), auj(), 0)?.etat !== 'expiree' && p.statut === 'afaire') p.statut = 'pret'; }
      else p[champ] = el.value.trim ? el.value.trim() : el.value;
      sauver();
      if (champ !== 'responsable') rouvrirDossier(c.id);
    }));
  }

  // Réaffiche le dossier ouvert en gardant la position de défilement.
  function rouvrirDossier(id) {
    const haut = modale().scrollTop;
    rendre();
    modaleDossier(id);
    modale().scrollTop = haut;
  }

  function modaleDepot(id) {
    const c = consultation(id);
    const a = R.avancement(c);
    const t = auj();
    ouvrirModale('Dossier déposé', `
      ${a.prets < a.utiles ? `<p class="alerte">${pluriel(a.utiles - a.prets, 'pièce')} pas encore marquée${a.utiles - a.prets > 1 ? 's' : ''} prête${a.utiles - a.prets > 1 ? 's' : ''}. Elles le seront au dépôt.</p>` : ''}
      <div class="deux"><label class="champ">Déposée le<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ">Montant de l'offre (€ HT)<input name="montant" inputmode="decimal" value="${c.montantOffre || c.montantEstime || ''}"></label></div>
      <div class="deux"><label class="champ">Relancer après (jours)<small>Valeur de départ du type « ${esc(type(c.type).nom)} ».</small><input type="number" name="delai" min="1" max="180" value="${type(c.type).relance}"></label>
      <label class="champ">Offre valable jusqu'au<small>Facultatif, selon l'acheteur.</small><input type="date" name="valable" value="${c.offreValable || ''}"></label></div>
      <p class="aide">Garde l'accusé de réception du dépôt avec le dossier.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer le dépôt</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const delai = Number(f.get('delai')), montant = nombre(f.get('montant'));
      if (!Number.isInteger(delai) || delai < 1 || delai > 180) return 'Relance : entre 1 et 180 jours.';
      if (Number.isNaN(montant)) return 'Montant : un nombre, en euros.';
      annulation = { id, avant: copie(c) };
      const n = remplacer(R.deposer(c, { date: f.get('date') || t, delaiRelance: delai, montantOffre: montant }));
      n.pieces.forEach((p) => { if (p.statut !== 'sansobjet') p.statut = 'pret'; });
      n.offreValable = f.get('valable') || '';
      sauver(); rendre();
      toast(`Déposée. Relance prévue ${quand(n.relancerLe)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleRelance(id) {
    const c = consultation(id);
    const t = auj();
    ouvrirModale('Relance faite', `
      <label class="champ">Le<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ">Note<small>Réponse obtenue, interlocuteur (fonction), date annoncée…</small><input name="note" maxlength="200"></label>
      <label class="champ">Relancer à nouveau dans (jours)<input type="number" name="intervalle" min="1" max="120" value="${E.reglages.intervalleRelance}"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const k = Number(f.get('intervalle'));
      if (!Number.isInteger(k) || k < 1 || k > 120) return 'Entre 1 et 120 jours.';
      annulation = { id, avant: copie(c) };
      const n = remplacer(R.noterRelance(c, { date: f.get('date') || t, note: String(f.get('note') || '').trim(), intervalle: k }));
      sauver(); rendre();
      toast(`Relance notée. Prochaine ${quand(n.relancerLe)}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleResultat(id, defaut = 'gagnee') {
    const c = consultation(id);
    const t = auj();
    ouvrirModale(`Résultat · ${esc(c.titre)}`, `
      <fieldset class="choix-resultat"><legend class="sr-only">Résultat</legend>${[['gagnee', 'Gagnée'], ['perdue', 'Perdue'], ['sanssuite', 'Sans suite']].map(([v, n]) => `<label><input type="radio" name="statut" value="${v}" ${v === defaut ? 'checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>
      <div class="deux"><label class="champ">Date du résultat<input type="date" name="date" value="${t}" max="${t}"></label>
      <label class="champ" data-si="gagnee">Montant attribué (€ HT)<input name="montant" inputmode="decimal" value="${c.montantOffre || ''}"></label></div>
      <div class="deux" data-si="perdue"><label class="champ">Motif<select name="motif">${options(B.motifsPerte, 'inconnu')}</select></label>
      <label class="champ">Classement<small>Si l'acheteur le communique.</small><input type="number" name="rang" min="1" max="99"></label></div>
      <label class="champ">Note<small>Retour de l'acheteur, points à améliorer.</small><input name="note" maxlength="300"></label>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const st = f.get('statut');
      const montant = st === 'gagnee' ? nombre(f.get('montant')) : null;
      if (Number.isNaN(montant)) return 'Montant : un nombre, en euros.';
      annulation = { id, avant: copie(c) };
      remplacer(R.cloturer(c, st, { date: f.get('date') || t, montant, motif: st === 'perdue' ? f.get('motif') : null, note: String(f.get('note') || '').trim(), rang: st === 'perdue' ? f.get('rang') : null }));
      sauver(); rendre();
      toast(st === 'gagnee' ? 'Bravo : marché gagné, compté dans le bilan.' : `${statut(st).nom} : noté dans le bilan.`, { libelle: 'Annuler', faire: annuler });
    });
    const maj = () => { const st = modale().querySelector('[name=statut]:checked').value; modale().querySelectorAll('[data-si]').forEach((el) => { el.hidden = el.dataset.si !== st; }); };
    modale().querySelectorAll('[name=statut]').forEach((r) => r.addEventListener('change', maj));
    maj();
  }

  function modaleBiblio(id) {
    const b = id ? piece(id) : null;
    const corps = `
      <label class="champ">Intitulé<input name="titre" required maxlength="160" value="${esc(b?.titre || '')}" placeholder="Ex. : Référence · client, mission, année"></label>
      <label class="champ">Type<select name="type">${options(B.typesPieces, b?.type || 'reference')}</select></label>
      <label class="champ">Où la trouver<small>Dossier et nom du fichier, ou emplacement papier. Le fichier lui-même n'est pas enregistré ici.</small><input name="reference" maxlength="200" value="${esc(b?.reference || '')}"></label>
      <div class="deux"><label class="champ">Émise ou mise à jour le<input type="date" name="emisLe" value="${b?.emisLe || ''}"></label>
      <label class="champ">Valable jusqu'au<small>Date indiquée sur la pièce, si elle en a une.</small><input type="date" name="valideJusquau" value="${b?.valideJusquau || ''}"></label></div>
      <label class="champ">Note<textarea name="note" maxlength="600">${esc(b?.note || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const pied = b ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(b ? 'Modifier la pièce' : 'Nouvelle pièce réutilisable', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        const n = E.consultations.filter((c) => (c.pieces || []).some((p) => p.biblio === b.id)).length;
        if (!confirm(`Supprimer « ${b.titre} »${n ? ` ? Elle est liée à ${pluriel(n, 'dossier')} : le lien sera retiré` : ''} ?`)) return false;
        const avant = copie(E);
        E.biblio = E.biblio.filter((x) => x.id !== b.id);
        E.consultations.forEach((c) => (c.pieces || []).forEach((p) => { if (p.biblio === b.id) p.biblio = null; }));
        sauver(); rendre(); toast('Pièce supprimée.', { libelle: 'Annuler', faire: () => { E = avant; sauver(); rendre(); } });
        return;
      }
      const v = { titre: String(f.get('titre') || '').trim(), type: f.get('type'), reference: String(f.get('reference') || '').trim(), emisLe: f.get('emisLe') || '', valideJusquau: f.get('valideJusquau') || '', note: String(f.get('note') || '').trim() };
      if (!v.titre) return 'Indique l\'intitulé de la pièce.';
      if (v.emisLe && v.valideJusquau && v.valideJusquau < v.emisLe) return 'La fin de validité doit suivre la date d\'émission.';
      if (b) Object.assign(b, v); else E.biblio.push({ id: uid(), ...v });
      sauver(); rendre(); toast(b ? 'Pièce enregistrée.' : 'Pièce ajoutée à la bibliothèque.');
    });
  }

  function modaleModele(id) {
    const m = E.modeles.find((x) => x.id === id);
    const texte = m.pieces.map((p) => `${p.delai} ; ${p.libelle}`).join('\n');
    ouvrirModale(`Modèle · ${esc(m.nom)}`, `
      <label class="champ">Description<input name="description" maxlength="200" value="${esc(m.description || '')}"></label>
      <label class="champ">Pièces, une par ligne<small>« jours avant la date limite ; libellé ». Ex. : « 4 ; Attestation d'assurance ».</small><textarea name="pieces" rows="12">${esc(texte)}</textarea></label>
      <p class="aide">Les dossiers déjà créés gardent leurs pièces ; le modèle sert aux prochains go.</p>
      <p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" value="origine">Modèle d\'origine</button>', (f, action) => {
      if (action === 'origine') { const o = B.modeles.find((x) => x.id === m.id); if (o) Object.assign(m, copie(o)); sauver(); rendre(); toast('Modèle d\'origine remis.'); return; }
      const lignes = String(f.get('pieces') || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const pieces = [];
      for (const l of lignes) {
        const [a, ...reste] = l.split(';');
        const delai = Number(a.trim());
        const libelle = reste.join(';').trim();
        if (!Number.isInteger(delai) || delai < 0 || delai > 90 || !libelle) return `Ligne à corriger : « ${l} » (attendu : nombre de jours ; libellé).`;
        const avant = m.pieces.find((p) => p.libelle === libelle);
        pieces.push({ libelle, delai, ...(avant?.type ? { type: avant.type } : {}) });
      }
      if (!pieces.length) return 'Garde au moins une pièce.';
      m.pieces = pieces; m.description = String(f.get('description') || '').trim();
      sauver(); rendre(); toast('Modèle enregistré.');
    });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="deux"><label class="champ">Ton prénom<small>Responsable par défaut des pièces.</small><input name="monNom" maxlength="40" value="${esc(r.monNom)}"></label>
      <label class="champ">Marge de dépôt (jours)<small>Dépôt visé avant la date limite.</small><input type="number" name="marge" min="0" max="10" value="${r.marge}"></label></div>
      <div class="deux"><label class="champ">Horizon « À faire » (jours)<input type="number" name="horizon" min="1" max="60" value="${r.horizon}"></label>
      <label class="champ">Décider au plus tard (jours)<small>Avant la date limite.</small><input type="number" name="delaiDecision" min="0" max="60" value="${r.delaiDecision}"></label></div>
      <div class="deux"><label class="champ">Relancer à nouveau après (jours)<input type="number" name="intervalleRelance" min="1" max="120" value="${r.intervalleRelance}"></label>
      <label class="champ">Pièce à renouveler (jours)<small>Alerte avant la fin de validité.</small><input type="number" name="seuilBiblio" min="1" max="180" value="${r.seuilBiblio}"></label></div>
      <div class="groupe"><h3>Grille go/no-go</h3>
        <div class="deux"><label class="champ">Go conseillé à partir de (%)<input type="number" name="seuilGo" min="1" max="100" value="${r.seuilGo}"></label>
        <label class="champ">À discuter à partir de (%)<input type="number" name="seuilDiscuter" min="0" max="100" value="${r.seuilDiscuter}"></label></div>
        <div class="poids">${E.criteres.map((k) => `<label class="champ"><span>${esc(k.nom)}${k.eliminatoire ? ' (élim.)' : ''}</span><input type="number" name="poids-${k.id}" min="0" max="5" value="${k.poids}" aria-label="Poids du critère ${esc(k.nom)}"></label>`).join('')}</div>
        <p class="aide">Poids de 0 (critère ignoré) à 5. Les critères éliminatoires notés 0 donnent un no-go conseillé.</p></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde et export</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="exporter-csv">Exporter les consultations (CSV)</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <p class="mention">Aucune connexion à une plateforme, à un profil d'acheteur ou à une messagerie : tu déposes et tu relances toi-même. Les modèles de pièces ne remplacent pas le règlement de la consultation, qui seul fait foi.</p>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const v = { marge: n('marge', 0, 10), horizon: n('horizon', 1, 60), delaiDecision: n('delaiDecision', 0, 60), intervalleRelance: n('intervalleRelance', 1, 120), seuilBiblio: n('seuilBiblio', 1, 180), seuilGo: n('seuilGo', 1, 100), seuilDiscuter: n('seuilDiscuter', 0, 100) };
      if (Object.values(v).some((x) => x === null)) return 'Vérifie les nombres : entiers, dans les bornes indiquées.';
      if (v.seuilDiscuter >= v.seuilGo) return 'Le seuil « à discuter » doit être inférieur au seuil « go ».';
      const poids = E.criteres.map((k) => n(`poids-${k.id}`, 0, 5));
      if (poids.some((x) => x === null)) return 'Poids : entiers de 0 à 5.';
      if (!poids.some(Boolean)) return 'Garde au moins un critère avec un poids.';
      Object.assign(r, v, { monNom: String(f.get('monNom') || '').trim() });
      E.criteres.forEach((k, i) => { k.poids = poids[i]; });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.consultations)) throw new Error();
        if (!confirm(`Remplacer ton suivi actuel par cette copie (${pluriel(d.consultations.length, 'consultation')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi.'); }
    });
  }

  function telecharger(contenu, nom, typeMime) {
    const blob = new Blob([contenu], { type: typeMime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
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
  function supprimer(id) {
    const c = consultation(id);
    if (!c || !confirm(`Supprimer définitivement « ${c.titre} » et son dossier ?`)) return;
    const i = E.consultations.indexOf(c);
    annulation = { id, avant: copie(c), index: i, supprime: true };
    E.consultations.splice(i, 1);
    sauver(); rendre();
    toast('Consultation supprimée.', { libelle: 'Annuler', faire: annuler });
  }

  function annuler() {
    if (!annulation) return;
    const a = annulation;
    annulation = null;
    if (a.supprime) E.consultations.splice(Math.min(a.index, E.consultations.length), 0, a.avant);
    else if (a.avant === null) E.consultations = E.consultations.filter((c) => c.id !== a.id);
    else remplacer(a.avant);
    sauver(); rendre();
  }

  function piecePrete(id, pieceId) {
    const c = consultation(id);
    const p = c?.pieces.find((x) => x.id === pieceId);
    if (!p) return;
    annulation = { id, avant: copie(c) };
    p.statut = 'pret';
    sauver(); rendre();
    const a = R.avancement(c);
    toast(`${p.libelle} : prête (${a.prets}/${a.utiles}).`, { libelle: 'Annuler', faire: annuler });
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const fermer = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': fermer(); deconnecter(); break;
      case 'acc-marge': accueil.marge = Number(id); document.querySelectorAll('[data-action="acc-marge"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id))); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': fermer(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `appels-offres-${auj()}.json`, 'application/json'); break;
      case 'exporter-csv': telecharger(`﻿${R.csv(E.consultations, B, E.criteres)}`, `consultations-${auj()}.csv`, 'text/csv;charset=utf-8'); toast('Export CSV téléchargé (point-virgule, UTF-8).'); break;
      case 'fermer': modale().close(); break;
      case 'consultation-nouvelle': modaleConsultation(); break;
      case 'dossier': modaleDossier(id); break;
      case 'grille': modaleGrille(id); break;
      case 'go': fermer(); decider(id, 'go'); break;
      case 'nogo': modaleGrille(id); break;
      case 'deposer': modaleDepot(id); break;
      case 'relance': modaleRelance(id); break;
      case 'relance-date': { const c = consultation(id); ouvrirModale('Date de relance', `<label class="champ">Relancer le<input type="date" name="date" value="${c.relancerLe || auj()}" min="${auj()}"></label><p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => { if (!f.get('date')) return 'Choisis une date.'; c.relancerLe = f.get('date'); sauver(); rendre(); toast(`Relance prévue ${quand(c.relancerLe)}.`); }); break; }
      case 'resultat': modaleResultat(id); break;
      case 'abandon': {
        const c = consultation(id);
        if (!confirm(`Abandonner « ${c.titre} » sans déposer ?`)) break;
        fermer(); annulation = { id, avant: copie(c) };
        remplacer(R.cloturer(c, 'abandon', { date: auj() })); sauver(); rendre(); toast('Dossier abandonné.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'rouvrir': {
        const c = consultation(id);
        fermer(); annulation = { id, avant: copie(c) };
        c.statut = c.depot ? 'deposee' : c.decision?.choix === 'go' ? 'preparation' : 'reperee';
        if (c.statut === 'reperee') c.decision = null;
        if (c.statut === 'deposee') c.relancerLe = auj();
        c.resultat = null;
        sauver(); rendre(); toast(`Rouverte : ${statut(c.statut).nom}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'temps': {
        const c = consultation(id);
        c.temps = R.ajouterTemps(c.temps, Number(el.dataset.delta));
        sauver(); rouvrirDossier(id);
        break;
      }
      case 'piece-prete': piecePrete(id, el.dataset.piece); break;
      case 'piece-suppr': {
        const c = consultation(id);
        const p = c.pieces.find((x) => x.id === el.dataset.piece);
        if (!p || !confirm(`Retirer « ${p.libelle} » de ce dossier ?`)) break;
        c.pieces = c.pieces.filter((x) => x !== p);
        sauver(); rouvrirDossier(id);
        break;
      }
      case 'piece-ajout': {
        const c = consultation(id);
        const libelle = $('#nouvelle-piece').value.trim();
        const delai = Number($('#nouvelle-delai').value);
        if (!libelle) { $('#nouvelle-piece').focus(); break; }
        c.pieces.push({ id: uid(), libelle, delai: Number.isInteger(delai) && delai >= 0 ? delai : 3, type: null, statut: 'afaire', responsable: E.reglages.monNom, biblio: null, echeance: null });
        sauver(); rouvrirDossier(id);
        $('#nouvelle-piece')?.focus();
        break;
      }
      case 'biblio-nouvelle': modaleBiblio(); break;
      case 'biblio-modifier': modaleBiblio(id); break;
      case 'modele-modifier': modaleModele(id); break;
      case 'filtre': filtre = id; rendre(); break;
      case 'periode': periode = id; rendre(); break;
      case 'mois': mois = id === '0' ? auj().slice(0, 7) : R.moisSuivant(mois, Number(id)); jourChoisi = null; rendre(); $('#calendrier')?.scrollIntoView({ block: 'start' }); break;
      case 'jour': jourChoisi = id && id !== jourChoisi ? id : null; if (id && !id.startsWith(mois)) mois = id.slice(0, 7); rendre(); $('.cal-liste')?.scrollIntoView({ block: 'nearest' }); break;
      default: break;
    }
  });

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (vue === 'echeances' && !modale().open) rendre();
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
      const { statut: st, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
      if (st === 401 || st === 403) return deconnecter(corps?.erreur || 'Ce code d\'accès n\'est plus valide.');
      if (st !== 200) throw new Error();
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
  window.__appelsOffres = { etat: () => E, regles: R };
  init();
})();
