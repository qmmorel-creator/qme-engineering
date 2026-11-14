// Propositions commerciales QME : contexte, objectifs, livrables, options comparées, planning, suivi.
// Données synchronisées par clé de licence ou code d'accès (socle commun des templates QME).
(() => {
  'use strict';
  const B = globalThis.BASE;
  const R = globalThis.PCM_REGLES;
  const API = '/api/templates';
  const PRODUIT = 'PCM';
  const CLE_CODE = 'qme-pcm-code';
  const CLE_CACHE = 'qme-pcm-cache';
  const CLE_DEMO = 'qme-pcm-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-pcm-ecran-accueil';
  const NOM = 'Propositions commerciales';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const multiligne = (s) => esc(s).replace(/\n/g, '<br>');
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const deux = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  const versDate = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(a, m - 1, j); };
  const auj = () => iso(new Date());
  const ajout = (s, n) => R.ajouterJours(s, n);
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '');
  const fmtLong = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtCourt = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const euros = R.eurosCourt;
  const lignesDe = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);
  // Une ligne commençant par « - » ou « 1. » devient une liste à l'impression.
  function texteRiche(t) {
    const blocs = [];
    let liste = null;
    for (const brut of String(t || '').split('\n')) {
      const l = brut.trim();
      const m = l.match(/^(?:[-•]|\d+[.)])\s+(.*)$/);
      if (m) { if (!liste) { liste = { ordonnee: /^\d/.test(l), items: [] }; blocs.push(liste); } liste.items.push(m[1]); continue; }
      liste = null;
      if (l) blocs.push(l);
    }
    return blocs.map((b) => (typeof b === 'string' ? `<p>${esc(b)}</p>` : `<${b.ordonnee ? 'ol' : 'ul'} class="f-liste">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${b.ordonnee ? 'ol' : 'ul'}>`)).join('');
  }

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'propositions';
  let ouverte = null;
  let filtre = 'tous';
  let recherche = '';
  let annulation = null;

  const profilVide = () => ({ nom: '', enseigne: '', activite: '', email: '', telephone: '', site: '', signature: '', prefixe: 'P', validiteJours: 30, relanceJours: 7, tauxTva: null, conditions: '' });
  const etatVide = () => ({ version: 1, trame: null, profil: profilVide(), blocs: [], propositions: [], compteurs: {} });
  const tableau = (x) => (Array.isArray(x) ? x : []);
  const normaliserProposition = (p) => ({
    titre: '', trame: 'autre', client: {}, validiteJours: 30, debut: '', contexte: '', notes: '', conditions: '', statut: 'brouillon',
    envoyeeLe: null, decideeLe: null, optionRetenue: null, motifRefus: '', ...p,
    client: { organisation: '', interlocuteur: '', email: '', ...(p.client || {}) },
    objectifs: tableau(p.objectifs), livrables: tableau(p.livrables), blocs: tableau(p.blocs), relances: tableau(p.relances),
    options: tableau(p.options).map((o) => ({ nom: '', accroche: '', prixHT: 0, inclus: [], delai: '', recommandee: false, ...o, inclus: tableau(o.inclus) })),
    etapes: tableau(p.etapes),
  });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    return {
      ...v, ...d, profil: { ...v.profil, ...(d.profil || {}) }, blocs: tableau(d.blocs),
      propositions: tableau(d.propositions).map(normaliserProposition),
      compteurs: d.compteurs && typeof d.compteurs === 'object' ? d.compteurs : {},
    };
  };
  const uneProp = (id) => E.propositions.find((p) => p.id === id);
  const trameDe = (id) => B.trames.find((t) => t.id === id);
  const relanceJours = () => E.profil.relanceJours || 7;
  const statutDe = (p) => R.statutAffiche(p, auj(), relanceJours());
  const taux = () => (E.profil.tauxTva === null || E.profil.tauxTva === undefined || E.profil.tauxTva === '' ? null : E.profil.tauxTva);

  const STATUTS = {
    brouillon: ['Brouillon', 'contour'], envoyee: ['Envoyée', 'jaune'], 'a-relancer': ['À relancer', 'rouge'], expiree: ['Validité dépassée', 'rouge'],
    acceptee: ['Acceptée', 'bleu'], refusee: ['Refusée', ''], 'sans-suite': ['Sans suite', ''],
  };
  const etiquette = (p) => { const s = statutDe(p); return `<span class="etiquette ${STATUTS[s][1]}">${STATUTS[s][0]}</span>`; };
  const NOMS_OPTIONS = ['Essentiel', 'Confort', 'Premium'];

  // Contenu d'une proposition à partir d'une trame (sans prix : chaque option est chiffrée par l'utilisateur).
  function contenuTrame(id, prix = []) {
    const t = trameDe(id);
    if (!t) {
      return {
        objectifs: [], livrables: [], etapes: [{ id: uid(), titre: 'Lancement', semaines: 1, parallele: false }],
        options: NOMS_OPTIONS.map((nom, i) => ({ id: uid(), nom, accroche: '', prixHT: prix[i] || 0, inclus: [], delai: '', recommandee: i === 1 })),
      };
    }
    return {
      objectifs: t.objectifs.slice(0, 3),
      livrables: t.livrables.map(([titre, description]) => ({ id: uid(), titre, description })),
      etapes: t.etapes.map(([titre, semaines]) => ({ id: uid(), titre, semaines, parallele: false })),
      options: t.options.map((o, i) => ({ id: uid(), nom: o.nom, accroche: o.accroche, prixHT: prix[i] || 0, inclus: [...o.inclus], delai: o.delai, recommandee: !!o.recommandee })),
    };
  }

  function creerProposition({ organisation = '', titre = '', trame = E.trame || 'autre', avecBlocs = true }) {
    const t = auj();
    const an = Number(t.slice(0, 4));
    const { numero, rang } = R.prochainNumero(E.propositions, E.profil.prefixe, an, E.compteurs[an]);
    E.compteurs[an] = rang;
    const tr = trameDe(trame);
    const p = normaliserProposition({
      id: uid(), numero, date: t, titre, trame, client: { organisation }, validiteJours: E.profil.validiteJours || 30,
      conditions: E.profil.conditions || (tr ? tr.conditions.join('\n') : ''),
      blocs: avecBlocs ? E.blocs.filter((b) => ['presentation', 'methode', 'references'].includes(b.type)).map((b) => ({ id: uid(), type: b.type, titre: b.titre, texte: b.texte })) : [],
      ...contenuTrame(trame),
    });
    E.propositions.unshift(p);
    return p;
  }

  function dupliquerProposition(id) {
    const t = auj();
    const an = Number(t.slice(0, 4));
    const { numero, rang } = R.prochainNumero(E.propositions, E.profil.prefixe, an, E.compteurs[an]);
    E.compteurs[an] = rang;
    const copie = R.dupliquer(uneProp(id), { id: uid(), numero, date: t, nouvelId: uid });
    copie.validiteJours = E.profil.validiteJours || 30;
    copie.debut = '';
    E.propositions.unshift(copie);
    return copie;
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
        cache(false); rendre();
        toast('Un autre appareil a modifié tes propositions entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.');
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
        if (document.activeElement && document.activeElement.matches('input,textarea,select')) return;
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false); rendre();
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
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith(PRODUIT) || n.startsWith('ADM')) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return ((n.startsWith(PRODUIT) || n.startsWith('ADM')) && n.length === 19) || /^[0-9A-F]{32}$/.test(n); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code, produit: PRODUIT }) });
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après ton achat.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
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

  // ---------- Démo (100 % fictive, dates relatives à aujourd'hui) ----------
  function donneesDemo() {
    E = etatVide();
    E.trame = 'conseil';
    Object.assign(E.profil, {
      nom: 'Camille Exemple', enseigne: 'Atelier Exemple Conseil', activite: 'Conseil en organisation et outils numériques',
      email: 'contact@example.com', telephone: '06 00 00 00 00', site: 'example.com', signature: 'Camille Exemple\nAtelier Exemple Conseil',
      prefixe: 'P', validiteJours: 30, relanceJours: 7,
    });
    E.blocs = B.blocsTypes.slice(0, 8).map((b) => ({ id: uid(), ...b }));
    const pres = E.blocs.find((b) => b.titre === 'Qui je suis');
    pres.texte = 'J\'accompagne depuis douze ans des PME et des associations dans l\'organisation de leur travail et le choix de leurs outils.\nCe que mes clients retiennent : des décisions prises vite, et des équipes qui gardent la main ensuite.';
    E.blocs.find((b) => b.titre === 'Références').texte = 'Missions comparables (données fictives de démonstration) :\n- PME industrielle de 80 personnes : refonte du suivi des commandes, délai de traitement divisé par deux.\n- Réseau associatif régional : choix et déploiement d\'un outil de gestion des adhérents.';
    E.blocs.find((b) => b.titre === 'Points d\'avancement').texte = 'Un point de trente minutes chaque semaine, et un compte rendu écrit sous 48 heures : décisions prises, actions, prochaines étapes.';
    E.blocs.find((b) => b.titre === 'Ce que disent mes clients').texte = '« Nous avons enfin un outil que toute l\'équipe utilise. » (témoignage fictif de démonstration)\nResponsable administrative, PME de services.';
    const t = auj();
    const avecBlocs =(types) => E.blocs.filter((b) => types.includes(b.type)).map((b) => ({ id: uid(), type: b.type, titre: b.titre, texte: b.texte }));
    const modele = [
      { j: -210, trame: 'formation', org: 'Coopérative Exemple (fictive)', inter: 'Mme Lefèvre', titre: 'Former l\'équipe d\'accueil à l\'outil de réservation', prix: [180000, 320000, 410000], statut: 'acceptee', choix: 0, decide: -196 },
      { j: -160, trame: 'conseil', org: 'Mairie de Villefictive', inter: 'M. Garnier', titre: 'Diagnostic de l\'organisation du service technique', prix: [650000, 920000, 1380000], statut: 'sans-suite', decide: -110 },
      { j: -128, trame: 'developpement', org: 'Studio Exemple (fictif)', inter: 'Mme Roux', titre: 'Outil de suivi des tournages', prix: [480000, 790000, 1150000], statut: 'acceptee', choix: 2, decide: -115 },
      { j: -96, trame: 'formation', org: 'Cabinet Exemple Santé (fictif)', inter: 'Dr Petit', titre: 'Atelier « organiser son agenda partagé »', prix: [90000, 160000, 210000], statut: 'refusee', motif: 'Prix', decide: -82 },
      { j: -70, trame: 'conseil', org: 'Transports Exemple (fictifs)', inter: 'M. Faure', titre: 'Réorganisation du planning des chauffeurs', prix: [540000, 780000, 1120000], statut: 'acceptee', choix: 1, decide: -58 },
      { j: -52, trame: 'travaux', org: 'Association Exemple Jeunesse', inter: 'Mme Blanc', titre: 'Réaménagement de l\'espace d\'accueil', prix: [420000, 610000, 0], statut: 'refusee', motif: 'Calendrier', decide: -38 },
      { j: -41, trame: 'conseil', org: 'Imprimerie Exemple (fictive)', inter: 'M. Henry', titre: 'Choix d\'un outil de gestion de production', prix: [380000, 560000, 840000], statut: 'envoyee', envoi: -40 },
      { j: -12, trame: 'formation', org: 'Agence Exemple Voyages (fictive)', inter: 'Mme Caron', titre: 'Parcours « tableurs pour les chefs de projet »', prix: [140000, 240000, 320000], statut: 'envoyee', envoi: -11 },
      { j: -9, trame: 'conseil', org: 'Fédération Exemple Sport', inter: 'M. Robin', titre: 'Cadrage du projet d\'outil des licenciés', prix: [290000, 450000, 690000], statut: 'envoyee', envoi: -8, relances: [-1] },
      { j: -3, trame: 'developpement', org: 'Brasserie Exemple (fictive)', inter: 'Mme Morel', titre: 'Application de commande pour les revendeurs', prix: [620000, 980000, 1450000], statut: 'envoyee', envoi: -2, debut: 21 },
      { j: 0, trame: 'developpement', org: 'Librairie Exemple (fictive)', inter: 'M. Lambert', titre: 'Site de réservation des ateliers', prix: [350000, 0, 0], statut: 'brouillon', brouillon: true },
    ];
    const contextes = {
      conseil: 'Le service a doublé ses effectifs en trois ans sans revoir son organisation. Les demandes arrivent par plusieurs canaux, les priorités changent chaque semaine et l\'équipe ne sait plus qui fait quoi. La direction souhaite un regard extérieur avant de décider.',
      developpement: 'Les commandes arrivent aujourd\'hui par e-mail et par téléphone, puis sont ressaisies dans un tableur. Les erreurs de quantités et les oublis coûtent des livraisons refaites. L\'objectif est un outil simple, utilisable sur téléphone, sans changer le logiciel de facturation.',
      formation: 'L\'équipe utilise l\'outil depuis six mois, chacun à sa manière. Les nouveaux arrivants apprennent « sur le tas » et les mêmes questions reviennent. Le responsable souhaite une base commune et des réflexes partagés.',
      travaux: 'L\'espace d\'accueil n\'a pas été rafraîchi depuis longtemps : peintures abîmées, éclairage insuffisant, rangements à revoir. Le lieu reste ouvert au public pendant les travaux, qui doivent se faire par zones.',
    };
    for (const m of modele) {
      const date = ajout(t, m.j);
      const an = Number(date.slice(0, 4));
      const { numero, rang } = R.prochainNumero(E.propositions, 'P', an, E.compteurs[an]);
      E.compteurs[an] = rang;
      const contenu = contenuTrame(m.trame, m.prix);
      if (m.prix[2] === 0 && !m.brouillon) contenu.options.pop();
      const p = normaliserProposition({
        id: uid(), numero, date, titre: m.titre, trame: m.trame, client: { organisation: m.org, interlocuteur: m.inter, email: '' },
        validiteJours: 30, debut: ajout(t, m.debut ?? m.j + 30), contexte: m.brouillon ? 'Les inscriptions aux ateliers se font par téléphone.' : contextes[m.trame],
        conditions: trameDe(m.trame).conditions.join('\n'), notes: m.brouillon ? 'Rappeler M. Lambert pour le nombre d\'ateliers par mois.' : '',
        blocs: avecBlocs(m.brouillon ? ['presentation'] : ['presentation', 'methode', 'references']), ...contenu,
      });
      if (m.brouillon) { p.etapes = p.etapes.slice(0, 2); p.debut = ''; p.livrables = p.livrables.slice(0, 2); }
      if (m.trame === 'developpement' && !m.brouillon) p.etapes[3].parallele = false;
      if (m.j === -3) { p.etapes.splice(3, 0, { id: uid(), titre: 'Rédaction de la documentation', semaines: 2, parallele: true }); }
      p.statut = m.statut;
      if (m.statut !== 'brouillon') p.envoyeeLe = ajout(t, m.envoi ?? m.j + 1);
      p.relances = (m.relances || []).map((x) => ajout(t, x));
      if (m.decide) {
        p.decideeLe = ajout(t, m.decide);
        if (m.statut === 'acceptee') p.optionRetenue = p.options[m.choix]?.id || null;
        p.motifRefus = m.motif || '';
        if (m.statut !== 'sans-suite') p.relances = [ajout(p.envoyeeLe, 7)];
      }
      E.propositions.unshift(p);
    }
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
          <rect x="10" y="20" width="150" height="260" fill="#F0EDE6"/>
          <rect x="34" y="56" width="100" height="12" fill="#141414"/>
          <rect x="34" y="88" width="80" height="8" fill="#5E5A52"/>
          <rect x="34" y="106" width="92" height="8" fill="#5E5A52"/>
          <rect x="180" y="150" width="100" height="130" fill="#F0EDE6"/>
          <rect x="296" y="110" width="110" height="170" fill="#F5B400"/>
          <rect x="422" y="150" width="100" height="130" fill="#F0EDE6"/>
          <circle cx="351" cy="66" r="44" fill="#D9302A"/>
          <path d="M422 20 A100 100 0 0 1 522 120 H422 Z" fill="#1D4E89"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Propositions commerciales · freelances et consultants</p>
          <h1>Une proposition claire, trois options, une réponse.</h1>
          <p>Contexte, objectifs, livrables, options comparées et planning dans un document propre, puis le suivi jusqu'à la signature.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div><p class="surtitre">Accès acheteur</p><h2>Ouvre tes propositions</h2></div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes propositions sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes propositions</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore l'outil ? <a href="/catalogue/propositions/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes propositions'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, trame: null, nom: '', enseigne: '', activite: '', importer: true };
  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-points" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Que proposes-tu à tes clients ?</h1>
        <p class="intro">Chaque nouvelle proposition démarre avec la trame de ton métier : questions de contexte, livrables, étapes du planning et trois options types, <b>sans prix</b>. Tout reste modifiable, et tu peux changer de trame à chaque proposition.</p>
        <div class="filieres" role="group" aria-label="Trame">
          ${B.trames.map((x, i) => `<button type="button" class="filiere" style="--c:${['var(--bleu)', 'var(--jaune)', 'var(--rouge)', 'var(--encre)'][i % 4]}" data-action="trame-accueil" data-id="${x.id}" aria-pressed="${a.trame === x.id}"><b>${esc(x.nom)}</b><span>${esc(x.description)}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="trame-accueil" data-id="autre" aria-pressed="${a.trame === 'autre'}"><b>Autre activité</b><span>Je pars d'une proposition vierge</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.trame ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">${esc(trameDe(a.trame)?.nom || 'Autre activité')}</p>
        <h1>Qui signe tes propositions ?</h1>
        <p class="intro">Ces informations apparaissent en tête de chaque proposition. Tu compléteras le reste dans l'onglet Profil.</p>
        <form id="form-accueil" class="grille-form" novalidate>
          <label class="champ">Ton prénom et ton nom<input name="nom" maxlength="80" value="${esc(a.nom)}" autocomplete="name"></label>
          <label class="champ">Nom commercial <small>Facultatif.</small><input name="enseigne" maxlength="80" value="${esc(a.enseigne)}" autocomplete="organization"></label>
          <label class="champ">Activité en une ligne <small>Ex. : Conseil en organisation.</small><input name="activite" maxlength="120" value="${esc(a.activite)}"></label>
          <label class="case"><input type="checkbox" name="importer" ${a.importer ? 'checked' : ''}> Ajouter à ma bibliothèque les ${B.blocsTypes.length} blocs types (présentation, méthode, références…) à personnaliser</label>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon espace</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const f = $('#form-accueil');
    f?.addEventListener('input', () => {
      const d = new FormData(f);
      Object.assign(accueil, { nom: d.get('nom') || '', enseigne: d.get('enseigne') || '', activite: d.get('activite') || '', importer: d.has('importer') });
    });
  }
  function terminerAccueil() {
    E = etatVide();
    const a = accueil;
    E.trame = a.trame;
    Object.assign(E.profil, { nom: a.nom.trim(), enseigne: a.enseigne.trim(), activite: a.activite.trim(), signature: a.nom.trim() });
    if (a.importer) importerBlocs();
    accueil = { etape: 1, trame: null, nom: '', enseigne: '', activite: '', importer: true };
    sauver();
    demarrer();
    toast('Ton espace est prêt. Personnalise tes blocs dans la Bibliothèque, puis crée ta première proposition.');
  }
  function importerBlocs() {
    const deja = new Set(E.blocs.map((b) => b.titre));
    let n = 0;
    for (const b of B.blocsTypes) { if (deja.has(b.titre)) continue; E.blocs.push({ id: uid(), ...b }); n++; }
    return n;
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    propositions: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    suivi: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="8" width="4" height="13" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    bibliotheque: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    profil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['propositions', 'Propositions'], ['suivi', 'Suivi'], ['bibliotheque', 'Bibliothèque'], ['profil', 'Profil']];
  const ONGLET_DE = { edition: 'propositions', apercu: 'propositions' };

  function lireHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [v, id] = h.split('=');
    if ((v === 'edition' || v === 'apercu') && id && uneProp(id)) { vue = v; ouverte = id; return; }
    if (ONGLETS.some(([x]) => x === v)) vue = v;
  }

  function demarrer() {
    document.body.classList.add('app');
    lireHash();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/propositions/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Propositions<br>commerciales</span>
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
    if ((vue === 'edition' || vue === 'apercu') && !uneProp(ouverte)) vue = 'propositions';
    const onglet = ONGLET_DE[vue] || vue;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === onglet) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const p = uneProp(ouverte);
    const titres = { propositions: 'Propositions', edition: `Proposition ${p?.numero || ''}`, apercu: `Aperçu ${p?.numero || ''}`, suivi: 'Suivi', bibliotheque: 'Bibliothèque', profil: 'Profil' };
    document.title = `${titres[vue]} · ${NOM}`;
    document.body.dataset.vue = vue;
    $('#vue').innerHTML = { propositions: vueListe, edition: vueEdition, apercu: vueApercu, suivi: vueSuivi, bibliotheque: vueBibliotheque, profil: vueProfil }[vue]();
    if (vue === 'edition') document.querySelectorAll('textarea[data-auto]').forEach(ajusterHauteur);
  }

  function changerVue(v, id = null) {
    vue = v;
    if (id) ouverte = id;
    history.replaceState(null, '', id ? `#${v}=${id}` : `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  // ---------- Vue : liste ----------
  const FILTRES = [['tous', 'Toutes'], ['brouillon', 'Brouillons'], ['envoyee', 'Envoyées'], ['a-relancer', 'À relancer'], ['expiree', 'Validité dépassée'], ['acceptee', 'Acceptées'], ['refusee', 'Refusées'], ['sans-suite', 'Sans suite']];

  function tuilesResume(s) {
    return [
      ['En attente', s.enAttente, s.enAttente ? `${euros(s.montantAttente)} HT` : '', 'Envoyées, dans leur durée de validité.', 'var(--jaune)', ''],
      ['À relancer', s.aRelancer, s.expirees ? `+ ${pluriel(s.expirees, 'validité dépassée', 'validités dépassées')}` : '', `Sans nouvelles depuis ${pluriel(relanceJours(), 'jour')} ou plus.`, 'var(--rouge)', 'rond'],
      ['Taux de transformation', s.taux === null ? '–' : `${s.taux}<small>%</small>`, s.tauxValeur === null ? '' : `${s.tauxValeur} % en valeur`, 'Acceptées sur les propositions tranchées (12 mois).', 'var(--encre)', ''],
      ['Signé sur 12 mois', s.acceptees, s.acceptees ? `${euros(s.montantAccepte)} HT` : '', 'Montant de l\'option retenue.', 'var(--bleu)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b>${u ? `<em>${u}</em>` : ''}<span>${d}</span></div>`).join('');
  }

  function vueListe() {
    const t = auj();
    const s = R.statistiques(E.propositions, t, relanceJours());
    const q = recherche.trim().toLowerCase();
    const liste = E.propositions
      .filter((p) => filtre === 'tous' || statutDe(p) === filtre)
      .filter((p) => !q || `${p.numero} ${p.client.organisation} ${p.client.interlocuteur} ${p.titre}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
    const compte = (f) => (f === 'tous' ? E.propositions.length : E.propositions.filter((p) => statutDe(p) === f).length);
    const lignes = liste.map((p) => {
      const st = statutDe(p);
      const opt = R.optionRetenue(p);
      const info = st === 'a-relancer' ? `relance prévue le ${fmtCourt(R.prochaineRelance(p, relanceJours()))}`
        : st === 'envoyee' ? `valable jusqu'au ${fmtCourt(R.finValidite(p))}`
          : st === 'expiree' ? `validité dépassée le ${fmtCourt(R.finValidite(p))}`
            : st === 'acceptee' ? `option « ${opt?.nom || '?'} », le ${fmtCourt(p.decideeLe)}`
              : st === 'brouillon' ? `${R.completude(p).pct} % rempli` : (p.motifRefus || '');
      return `<li class="ligne-devis">
        <button class="ld-ouvrir" data-action="ouvrir" data-id="${p.id}" aria-label="Ouvrir la proposition ${esc(p.numero)}">
          <span class="ld-num"><b>${esc(p.numero)}</b><small>${fmt(p.date)}</small></span>
          <span class="ld-client"><b>${esc(p.client.organisation || 'Client à préciser')}</b><small>${esc(p.titre || 'Sans titre')}</small></span>
          <span class="ld-montant"><b>${R.montantProposition(p) ? `${euros(R.montantProposition(p))} HT` : '–'}</b><small>${esc(info)}</small></span>
          <span class="ld-statut">${etiquette(p)}</span>
        </button>
        <button class="btn petit ld-dup" data-action="dupliquer" data-id="${p.id}" aria-label="Dupliquer la proposition ${esc(p.numero)}">Dupliquer</button>
      </li>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Propositions</h1><p>De la note de cadrage à la réponse du client. Une proposition envoyée sans nouvelles est signalée à relancer ; sa validité dépassée aussi.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle">${ICONES.plus}Nouvelle proposition</button></div></div>
      <div class="tuiles">${tuilesResume(s)}</div>
      <h2 class="titre-section">Liste</h2>
      <div class="barre-filtres">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${FILTRES.map(([id, nom]) => `<button class="filtre" data-action="filtre" data-id="${id}" aria-pressed="${filtre === id}">${nom}<span>${compte(id)}</span></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher une proposition</span><input type="search" id="recherche" placeholder="Rechercher : numéro, client, titre" value="${esc(recherche)}"></label>
      </div>
      ${!E.propositions.length ? videEtat('Aucune proposition pour l\'instant', 'Crée ta première proposition : elle démarre avec la trame de ton métier (livrables, étapes, trois options), à compléter et à chiffrer.', `<button class="btn primaire" data-action="nouvelle">${ICONES.plus}Nouvelle proposition</button>`)
        : liste.length ? `<ul class="liste-devis">${lignes}</ul>` : '<p class="vide-ligne">Aucune proposition ne correspond à ce filtre.</p>'}`;
  }

  // ---------- Vue : édition ----------
  const outilsLigne = (genre, id, i, n) => `<div class="l-outils">
      <button type="button" class="mini" data-action="monter" data-genre="${genre}" data-id="${id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
      <button type="button" class="mini" data-action="descendre" data-genre="${genre}" data-id="${id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
      <button type="button" class="mini danger" data-action="retirer" data-genre="${genre}" data-id="${id}" aria-label="Retirer">×</button></div>`;

  function blocComparatif(p) {
    const c = R.comparerOptions(p.options, taux());
    if (!c.colonnes.length) return '<p class="vide-ligne">Ajoute au moins une option pour la comparer.</p>';
    return `<div class="defile"><table class="tableau comparatif">
      <thead><tr><th scope="col"><span class="sr-only">Contenu</span></th>${c.colonnes.map((o) => `<th scope="col" class="${o.recommandee ? 'reco' : ''}">${esc(o.nom)}${o.recommandee ? '<small>Recommandée</small>' : ''}</th>`).join('')}</tr></thead>
      <tbody>
        <tr class="prix"><th scope="row">Prix HT</th>${c.colonnes.map((o) => `<td>${o.prixHT ? euros(o.prixHT) : '<span class="discret">à chiffrer</span>'}${o.ttc !== null && o.prixHT ? `<small>${euros(o.ttc)} TTC</small>` : ''}</td>`).join('')}</tr>
        ${c.colonnes.length > 1 ? `<tr><th scope="row">Écart</th>${c.colonnes.map((o, i) => `<td>${i === 0 ? '<span class="discret">base</span>' : (o.prixHT ? `${o.ecart >= 0 ? '+' : ''}${euros(o.ecart)}` : '')}</td>`).join('')}</tr>` : ''}
        ${c.lignes.map((l) => `<tr class="${l.commun ? 'commun' : ''}"><th scope="row">${esc(l.libelle)}</th>${l.presences.map((x) => `<td>${x ? '<span class="oui" aria-label="Inclus">✓</span>' : '<span class="non" aria-label="Non inclus">–</span>'}</td>`).join('')}</tr>`).join('')}
        <tr><th scope="row">Délai</th>${c.colonnes.map((o) => `<td>${esc(o.delai) || '–'}</td>`).join('')}</tr>
      </tbody></table></div>`;
  }

  function blocPlanning(p, impression = false) {
    const pl = R.calculerPlanning(p.debut, p.etapes);
    if (!pl.etapes.length) return '<p class="vide-ligne">Aucune étape.</p>';
    const total = Math.max(1, pl.semaines);
    return `<div class="gantt${impression ? ' f-gantt' : ''}" role="table" aria-label="Planning">
      ${pl.etapes.map((e, i) => `<div class="g-ligne" role="row">
        <span class="g-nom" role="cell"><b>${i + 1}. ${esc(e.titre || 'Étape')}</b><small>${e.debut ? `${fmtCourt(e.debut)} → ${fmtCourt(e.fin)}` : `semaine ${e.depart + 1}${e.semaines > 1 ? ` à ${e.arrivee}` : ''}`} · ${pluriel(e.semaines, 'semaine')}</small></span>
        <span class="g-piste" role="cell" aria-hidden="true"><i style="left:${(e.depart / total) * 100}%;width:${(e.semaines / total) * 100}%;--c:${['var(--bleu)', 'var(--jaune)', 'var(--rouge)'][i % 3]}"></i></span>
      </div>`).join('')}
      <p class="g-total">Durée totale : <b>${pluriel(pl.semaines, 'semaine')}</b>${pl.fin ? `, du ${fmtLong(p.debut)} au ${fmtLong(pl.fin)}` : ' (indique le début prévu pour obtenir les dates)'}.</p>
    </div>`;
  }

  function blocCompletude(p) {
    const c = R.completude(p);
    return `<div class="completude"><div class="jauge" role="img" aria-label="Proposition remplie à ${c.pct} %"><i style="width:${c.pct}%"></i></div>
      <p><b>${c.pct} %</b> · ${c.faits} sur ${c.total}</p>
      ${c.manque.length ? `<ul>${c.manque.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '<p class="mentions-ok">Proposition complète.</p>'}</div>`;
  }

  function blocSuiviProposition(p) {
    const st = statutDe(p);
    const rel = R.prochaineRelance(p, relanceJours());
    const opt = R.optionRetenue(p);
    const lignes = [
      `Créée le ${fmt(p.date)}`,
      p.envoyeeLe ? `Envoyée le ${fmt(p.envoyeeLe)}` : '',
      ...p.relances.map((d, i) => `Relance ${i + 1} le ${fmt(d)}`),
      p.decideeLe ? `${STATUTS[p.statut][0]} le ${fmt(p.decideeLe)}${opt ? ` · option « ${esc(opt.nom)} »` : ''}${p.motifRefus ? ` · ${esc(p.motifRefus)}` : ''}` : '',
    ].filter(Boolean);
    return `<ol class="frise">${lignes.map((l) => `<li>${l}</li>`).join('')}</ol>
      ${['envoyee', 'a-relancer', 'expiree'].includes(st) ? `<p class="aide-champ">Valable jusqu'au <b>${fmt(R.finValidite(p))}</b>${st !== 'expiree' ? ` · prochaine relance le <b>${fmt(rel)}</b>` : ''}.</p>` : ''}
      <div class="rang">
        ${p.statut === 'brouillon' ? `<button class="btn petit primaire" data-action="envoyer" data-id="${p.id}">Marquer comme envoyée</button>` : ''}
        ${p.statut === 'envoyee' ? `<button class="btn petit ${st === 'a-relancer' ? 'primaire' : ''}" data-action="relance" data-id="${p.id}">Relancer</button>
          <button class="btn petit" data-action="decision" data-id="${p.id}">Réponse du client</button>
          ${st === 'expiree' ? `<button class="btn petit" data-action="prolonger" data-id="${p.id}">Prolonger de ${pluriel(E.profil.validiteJours || 30, 'jour')}</button>` : ''}` : ''}
        ${R.DECIDES.includes(p.statut) ? `<button class="btn petit" data-action="decision" data-id="${p.id}">Modifier la réponse</button><button class="btn petit lien" data-action="rouvrir" data-id="${p.id}">Remettre en attente</button>` : ''}
      </div>`;
  }

  function vueEdition() {
    const p = uneProp(ouverte);
    const champP = (cle, lib, valeur, extra = '') => `<label class="champ">${lib}<input data-p="${cle}" value="${esc(valeur)}" ${extra}></label>`;
    const tr = trameDe(p.trame);
    const nl = p.livrables.length, no = p.options.length, ne = p.etapes.length, nb = p.blocs.length;
    return `
      <div class="edition-tete">
        <button class="btn lien" data-action="vue" data-vue="propositions">← Toutes les propositions</button>
        <div class="edition-titre"><h1>${esc(p.numero)}</h1>${etiquette(p)}</div>
        <div class="actions">
          <button class="btn primaire" data-action="apercu" data-id="${p.id}">Aperçu et PDF</button>
          <button class="btn" data-action="dupliquer" data-id="${p.id}">Dupliquer</button>
          <button class="btn danger" data-action="supprimer" data-id="${p.id}">Supprimer</button>
        </div>
      </div>
      ${p.statut !== 'brouillon' ? '<p class="aide">Cette proposition a été envoyée : si tu la modifies, préviens ton client, ou crée plutôt une copie (Dupliquer).</p>' : ''}
      <div class="editeur">
        <div class="editeur-principal">
          <section class="bloc">
            <h2>Client et en-tête</h2>
            <div class="grille-2">
              ${champP('client.organisation', 'Organisation cliente', p.client.organisation, 'maxlength="120"')}
              ${champP('client.interlocuteur', 'Interlocuteur', p.client.interlocuteur, 'maxlength="120" placeholder="Ex. : Mme Martin, directrice"')}
            </div>
            ${champP('titre', 'Titre de la proposition', p.titre, 'maxlength="160" placeholder="Ex. : Refonte du suivi des commandes"')}
            <div class="grille-3">
              ${champP('date', 'Date', p.date, 'type="date" required')}
              ${champP('validiteJours', 'Validité (jours)', p.validiteJours, 'type="number" min="1" max="365" data-type="entier"')}
              ${champP('debut', 'Début prévu', p.debut, 'type="date"')}
            </div>
            <label class="champ">Trame<select data-p="trame">${[...B.trames.map((t) => [t.id, t.nom]), ['autre', 'Autre activité']].map(([v, l]) => `<option value="${v}" ${p.trame === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><small>Change les questions et les suggestions proposées ; ce qui est déjà écrit reste.</small></label>
            <p class="aide-champ">Valable jusqu'au <b data-fin>${fmtLong(R.finValidite(p))}</b>.</p>
          </section>
          <section class="bloc">
            <h2><span class="num">1</span>Contexte</h2>
            <label class="champ"><span class="sr-only">Contexte</span><textarea data-p="contexte" data-auto rows="4" maxlength="3000" placeholder="La situation du client, avec ses mots : ce qui déclenche la demande, ce qui a été essayé, ce qui se passe si rien ne change.">${esc(p.contexte)}</textarea></label>
            ${tr ? `<div class="questions"><p class="surtitre">Questions pour t'aider</p><ul>${tr.contexte.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
          </section>
          <section class="bloc">
            <h2><span class="num">2</span>Objectifs <span>un par ligne</span></h2>
            <label class="champ"><span class="sr-only">Objectifs, un par ligne</span><textarea data-p="objectifs" data-type="lignes" data-auto rows="3" maxlength="2000">${esc(p.objectifs.join('\n'))}</textarea></label>
            ${tr ? `<div class="puces-conditions">${tr.objectifs.filter((o) => !p.objectifs.includes(o)).map((o) => `<button type="button" class="puce" data-action="ajout-objectif" data-texte="${esc(o)}">+ ${esc(o)}</button>`).join('')}</div>` : ''}
          </section>
          <section class="bloc">
            <h2><span class="num">3</span>Livrables <span>${pluriel(nl, 'livrable')}</span></h2>
            ${nl ? `<ul class="items">${p.livrables.map((l, i) => `<li class="item">
              <label class="champ"><span class="l-lib">Livrable</span><input data-liv="titre" data-id="${l.id}" value="${esc(l.titre)}" maxlength="120"></label>
              <label class="champ"><span class="l-lib">Description</span><textarea data-liv="description" data-id="${l.id}" data-auto rows="1" maxlength="600">${esc(l.description)}</textarea></label>
              ${outilsLigne('livrables', l.id, i, nl)}</li>`).join('')}</ul>` : '<p class="vide-ligne">Aucun livrable.</p>'}
            <div class="ajouts"><button class="btn petit" data-action="ajout-livrable">${ICONES.plus}Livrable</button>
              ${tr ? tr.livrables.filter(([t]) => !p.livrables.some((l) => l.titre === t)).map(([t]) => `<button type="button" class="puce" data-action="ajout-livrable-type" data-texte="${esc(t)}">+ ${esc(t)}</button>`).join('') : ''}</div>
          </section>
          <section class="bloc">
            <h2>Blocs de la bibliothèque <span>${pluriel(nb, 'bloc')} · imprimés après les livrables</span></h2>
            ${nb ? `<ul class="items">${p.blocs.map((b, i) => `<li class="item">
              <label class="champ"><span class="l-lib">${esc(B.typesBlocs.find((t) => t.id === b.type)?.nom || 'Bloc')}</span><input data-bloc="titre" data-id="${b.id}" value="${esc(b.titre)}" maxlength="120"></label>
              <label class="champ"><span class="sr-only">Texte</span><textarea data-bloc="texte" data-id="${b.id}" data-auto rows="3" maxlength="3000">${esc(b.texte)}</textarea></label>
              ${outilsLigne('blocs', b.id, i, nb)}</li>`).join('')}</ul>` : '<p class="vide-ligne">Aucun bloc : présentation, méthode ou références se gèrent dans la Bibliothèque et s\'insèrent ici par copie.</p>'}
            <div class="ajouts"><button class="btn petit" data-action="inserer-bloc">${ICONES.plus}Insérer depuis la bibliothèque</button></div>
            ${p.blocs.some((b) => /\[[^\]]+\]/.test(b.texte)) ? '<p class="aide">Un bloc contient encore des [crochets] à remplacer par ton texte.</p>' : ''}
          </section>
          <section class="bloc">
            <h2><span class="num">4</span>Options <span>bon, mieux, premium</span></h2>
            ${no ? `<div class="options-edit">${p.options.map((o, i) => `<div class="option-edit ${o.recommandee ? 'reco' : ''}">
              <div class="option-haut"><label class="champ"><span class="l-lib">Nom</span><input data-opt="nom" data-id="${o.id}" value="${esc(o.nom)}" maxlength="40"></label>
                <label class="case reco-case"><input type="radio" name="reco" data-opt="recommandee" data-id="${o.id}" ${o.recommandee ? 'checked' : ''}> Recommandée</label></div>
              <label class="champ"><span class="l-lib">En une phrase</span><input data-opt="accroche" data-id="${o.id}" value="${esc(o.accroche)}" maxlength="140"></label>
              <div class="grille-2"><label class="champ"><span class="l-lib">Prix HT (€)</span><input data-opt="prixHT" data-type="montant" data-id="${o.id}" value="${o.prixHT ? R.saisieMontant(o.prixHT) : ''}" inputmode="decimal" placeholder="à chiffrer"></label>
                <label class="champ"><span class="l-lib">Délai</span><input data-opt="delai" data-id="${o.id}" value="${esc(o.delai)}" maxlength="60"></label></div>
              <label class="champ"><span class="l-lib">Ce qui est inclus (un élément par ligne)</span><textarea data-opt="inclus" data-type="lignes" data-id="${o.id}" data-auto rows="3" maxlength="2000">${esc(o.inclus.join('\n'))}</textarea></label>
              ${outilsLigne('options', o.id, i, no)}</div>`).join('')}</div>` : ''}
            <div class="ajouts">${no < 4 ? `<button class="btn petit" data-action="ajout-option">${ICONES.plus}Option</button>` : ''}${no > 1 ? `<button class="btn petit" data-action="cumuler" title="Recopie le contenu de chaque option dans la suivante">Reprendre le contenu de l'option précédente</button>` : ''}</div>
            <h3 class="sous-titre">Comparaison</h3>
            <div id="comparatif">${blocComparatif(p)}</div>
            <p class="aide-champ">Prix hors taxes. Le devis détaillé (TVA applicable, mentions obligatoires) se fait à l'acceptation, par exemple avec le Générateur de devis QME.${taux() === null ? ' Pour afficher aussi le TTC, saisis ton taux dans Profil.' : ''}</p>
          </section>
          <section class="bloc">
            <h2><span class="num">5</span>Planning <span>en semaines</span></h2>
            ${ne ? `<ul class="items">${p.etapes.map((e, i) => `<li class="item etape">
              <label class="champ"><span class="l-lib">Étape</span><input data-et="titre" data-id="${e.id}" value="${esc(e.titre)}" maxlength="120"></label>
              <label class="champ court"><span class="l-lib">Semaines</span><input data-et="semaines" data-type="entier" data-id="${e.id}" type="number" min="1" max="104" value="${e.semaines}"></label>
              ${i ? `<label class="case"><input type="checkbox" data-et="parallele" data-id="${e.id}" ${e.parallele ? 'checked' : ''}> En même temps que la précédente</label>` : '<span></span>'}
              ${outilsLigne('etapes', e.id, i, ne)}</li>`).join('')}</ul>` : ''}
            <div class="ajouts"><button class="btn petit" data-action="ajout-etape">${ICONES.plus}Étape</button></div>
            <div id="planning">${blocPlanning(p)}</div>
          </section>
          <section class="bloc">
            <h2><span class="num">6</span>Conditions</h2>
            <label class="champ"><span class="sr-only">Conditions</span><textarea data-p="conditions" data-auto rows="3" maxlength="2000">${esc(p.conditions)}</textarea></label>
            ${tr ? `<div class="puces-conditions">${tr.conditions.filter((c) => !p.conditions.includes(c)).map((c) => `<button type="button" class="puce" data-action="ajout-condition" data-texte="${esc(c)}">+ ${esc(c)}</button>`).join('')}</div>` : ''}
            <p class="aide-champ">Conditions commerciales de la proposition. Les mentions légales obligatoires (identification, TVA, pénalités…) relèvent du devis ou de la facture, pas de cette proposition.</p>
          </section>
          <section class="bloc">
            <h2>Notes internes <span>jamais imprimées</span></h2>
            <label class="champ"><span class="sr-only">Notes internes</span><textarea data-p="notes" data-auto rows="2" maxlength="2000" placeholder="Budget évoqué, concurrents, prochaine étape…">${esc(p.notes)}</textarea></label>
          </section>
        </div>
        <aside class="editeur-cote">
          <div class="carte-totaux">
            <h2>Suivi</h2>
            <div id="suivi-prop">${blocSuiviProposition(p)}</div>
            <h2>Complétude</h2>
            <div id="completude">${blocCompletude(p)}</div>
            <button class="btn primaire" data-action="apercu" data-id="${p.id}" style="width:100%">Aperçu et PDF</button>
          </div>
        </aside>
      </div>`;
  }

  function majEdition() {
    const p = uneProp(ouverte);
    if (!p) return;
    const maj = (sel, html) => { const z = $(sel); if (z) z.innerHTML = html; };
    maj('#comparatif', blocComparatif(p));
    maj('#planning', blocPlanning(p));
    maj('#completude', blocCompletude(p));
    const fin = $('[data-fin]');
    if (fin) fin.textContent = fmtLong(R.finValidite(p));
  }

  // ---------- Vue : aperçu A4 ----------
  function feuille(p) {
    const e = E.profil;
    const c = R.comparerOptions(p.options, taux());
    let n = 0;
    const section = (titre, corps) => (corps ? `<section class="f-section"><h2><span>${++n}</span>${esc(titre)}</h2>${corps}</section>` : '');
    const options = c.colonnes.length ? `
      <div class="f-options">${c.colonnes.map((o) => { const src = p.options.find((x) => x.id === o.id); return `<div class="f-option ${o.recommandee ? 'reco' : ''}">${o.recommandee ? '<p class="f-reco">Recommandée</p>' : ''}<p class="f-opt-nom">${esc(o.nom)}</p>${src?.accroche ? `<p class="f-opt-acc">${esc(src.accroche)}</p>` : ''}<p class="f-opt-prix">${o.prixHT ? euros(o.prixHT) : 'Sur demande'}<small>${o.prixHT ? ' HT' : ''}</small></p>${o.ttc !== null && o.prixHT ? `<p class="f-opt-ttc">${euros(o.ttc)} TTC</p>` : ''}${o.delai ? `<p class="f-opt-delai">${esc(o.delai)}</p>` : ''}</div>`; }).join('')}</div>
      ${c.colonnes.length > 1 && c.lignes.length ? `<table class="f-table f-comp"><thead><tr><th>Ce qui est inclus</th>${c.colonnes.map((o) => `<th class="c">${esc(o.nom)}</th>`).join('')}</tr></thead><tbody>${c.lignes.map((l) => `<tr><td>${esc(l.libelle)}</td>${l.presences.map((x) => `<td class="c">${x ? '✓' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : (c.lignes.length ? `<ul class="f-liste">${c.lignes.map((l) => `<li>${esc(l.libelle)}</li>`).join('')}</ul>` : '')}
      <p class="f-note">Prix hors taxes. Le devis détaillé, avec la TVA applicable et les mentions obligatoires, est établi à l'acceptation de l'option choisie.</p>` : '';
    const objectifs = p.objectifs.length ? `<ul class="f-liste">${p.objectifs.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : '';
    const livrables = p.livrables.filter((l) => l.titre).length ? `<dl class="f-livrables">${p.livrables.filter((l) => l.titre).map((l) => `<div><dt>${esc(l.titre)}</dt>${l.description ? `<dd>${esc(l.description)}</dd>` : ''}</div>`).join('')}</dl>` : '';
    return `<article class="feuille" aria-label="Proposition ${esc(p.numero)}">
      <header class="f-garde">
        <div class="f-emetteur">
          <p class="f-nom">${esc(e.enseigne || e.nom || 'Ton nom')}</p>
          ${e.enseigne && e.nom ? `<p>${esc(e.nom)}</p>` : ''}
          ${e.activite ? `<p>${esc(e.activite)}</p>` : ''}
          <p>${[e.telephone, e.email, e.site].filter(Boolean).map(esc).join(' · ')}</p>
        </div>
        <div class="f-doc"><p class="f-type">Proposition</p><p><b>N° ${esc(p.numero)}</b></p><p>${fmtLong(p.date)}</p><p>Valable jusqu'au ${fmtLong(R.finValidite(p))}</p></div>
      </header>
      <div class="f-titre-bloc">
        <p class="f-lib">Pour ${esc(p.client.organisation || 'votre organisation')}${p.client.interlocuteur ? `, à l'attention de ${esc(p.client.interlocuteur)}` : ''}</p>
        <h1>${esc(p.titre || 'Proposition commerciale')}</h1>
      </div>
      ${section('Contexte', texteRiche(p.contexte))}
      ${section('Objectifs', objectifs)}
      ${section('Livrables', livrables)}
      ${p.blocs.map((b) => section(b.titre || 'Complément', texteRiche(b.texte))).join('')}
      ${section(c.colonnes.length > 1 ? 'Options proposées' : 'Prix', options)}
      ${section('Planning', p.etapes.length ? blocPlanning(p, true) : '')}
      ${section('Conditions', texteRiche(p.conditions))}
      <section class="f-section f-accord"><h2><span>${++n}</span>Bon pour accord</h2>
        ${c.colonnes.length > 1 ? `<p>Option retenue : ${c.colonnes.map((o) => `<span class="f-case">☐ ${esc(o.nom)}</span>`).join(' ')}</p>` : ''}
        <div class="f-signatures"><div><p class="f-lib">${esc(e.enseigne || e.nom || 'Le prestataire')}</p></div><div><p class="f-lib">${esc(p.client.organisation || 'Le client')}</p><p>Date, nom, fonction et signature</p></div></div>
      </section>
    </article>`;
  }
  function vueApercu() {
    const p = uneProp(ouverte);
    const c = R.completude(p);
    return `
      <div class="apercu-barre">
        <button class="btn" data-action="ouvrir" data-id="${p.id}">← Modifier</button>
        <button class="btn primaire" data-action="imprimer">Imprimer ou enregistrer en PDF</button>
        <p>Dans la fenêtre d'impression, choisis « Enregistrer au format PDF », format A4, sans en-têtes ni pieds de page du navigateur.</p>
      </div>
      ${c.manque.length ? `<div class="mentions-ko apercu-alerte"><b>Avant d'envoyer, complète :</b><ul>${c.manque.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${feuille(p)}`;
  }

  // ---------- Vue : suivi ----------
  function graphiqueMois(s) {
    const max = Math.max(1, ...s.parMois.map((m) => Math.max(m.envoyees, m.acceptees)));
    const etroit = matchMedia('(max-width:720px)').matches;
    const L = etroit ? 340 : 760, H = 200, g = 28, b = 22, larg = (L - g) / 12;
    const y = (v) => H - b - (v / max) * (H - b - 16);
    const barres = s.parMois.map((m, i) => {
      const x = g + i * larg;
      const w = Math.max(4, (larg - 8) / 2);
      const lib = versDate(`${m.mois}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
      return `<g><title>${lib} : ${pluriel(m.envoyees, 'envoyée')}, ${pluriel(m.acceptees, 'acceptée')}</title>
        ${m.envoyees ? `<rect x="${x + 2}" y="${y(m.envoyees)}" width="${w}" height="${H - b - y(m.envoyees)}" rx="3" fill="#2E5A88"/>` : ''}
        ${m.acceptees ? `<rect x="${x + 4 + w}" y="${y(m.acceptees)}" width="${w}" height="${H - b - y(m.acceptees)}" rx="3" fill="#E8B93A" stroke="#24221F" stroke-width="1"/>` : ''}
        ${(etroit ? i % 2 === 1 : true) ? `<text x="${x + larg / 2}" y="${H - 6}" text-anchor="middle" class="axe">${lib}</text>` : ''}</g>`;
    }).join('');
    const graduations = [0, Math.ceil(max / 2), max].map((v) => `<line x1="${g}" x2="${L}" y1="${y(v)}" y2="${y(v)}" class="grille"/><text x="${g - 6}" y="${y(v) + 4}" text-anchor="end" class="axe">${v}</text>`).join('');
    return `<figure class="graphique">
      <div class="legende"><span><i style="background:#2E5A88"></i>Envoyées</span><span><i style="background:#E8B93A;outline:1px solid #24221F"></i>Acceptées</span></div>
      <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Propositions envoyées et acceptées par mois, sur 12 mois">${graduations}${barres}</svg>
      <details><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><thead><tr><th>Mois</th><th class="nb">Envoyées</th><th class="nb">Acceptées</th></tr></thead><tbody>${s.parMois.map((m) => `<tr><td>${versDate(`${m.mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td><td class="nb">${m.envoyees}</td><td class="nb">${m.acceptees}</td></tr>`).join('')}</tbody></table></div></details>
    </figure>`;
  }
  const barresSimples = (paires, couleur) => {
    const max = Math.max(1, ...paires.map(([, v]) => v));
    return `<ul class="barres">${paires.map(([lib, v]) => `<li><span class="b-lib">${esc(lib)}</span><span class="b-piste"><i style="width:${(v / max) * 100}%;background:${couleur}"></i></span><b>${v}</b></li>`).join('')}</ul>`;
  };
  function vueSuivi() {
    const t = auj();
    const s = R.statistiques(E.propositions, t, relanceJours());
    const aRelancer = E.propositions.filter((p) => ['a-relancer', 'expiree'].includes(statutDe(p))).sort((a, b) => (R.prochaineRelance(a, relanceJours()) || '').localeCompare(R.prochaineRelance(b, relanceJours()) || ''));
    const choix = ['1re option (bon)', '2e option (mieux)', '3e option (premium)', '4e option'].map((l, i) => [l, s.choix[i]]).filter(([, v], i) => i < 3 || v);
    const motifs = Object.entries(s.motifs).sort((a, b) => b[1] - a[1]);
    const trames = Object.entries(s.parTrame).sort((a, b) => b[1].decidees - a[1].decidees);
    const tuiles = [
      ['Taux de transformation', s.taux === null ? '–' : `${s.taux}<small>%</small>`, `${s.acceptees} sur ${s.acceptees + s.refusees + s.sansSuite} tranchées`, 'var(--encre)', ''],
      ['En valeur', s.tauxValeur === null ? '–' : `${s.tauxValeur}<small>%</small>`, s.montantDecide ? `${euros(s.montantAccepte)} sur ${euros(s.montantDecide)}` : '', 'var(--bleu)', 'rond'],
      ['Délai de réponse', s.delaiMoyen === null ? '–' : `${s.delaiMoyen}<small> j</small>`, 'entre l\'envoi et la réponse', 'var(--jaune)', ''],
      ['Panier moyen', s.panierMoyen === null ? '–' : euros(s.panierMoyen), 'par proposition acceptée', 'var(--rouge)', 'rond'],
    ].map(([lib, v, u, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><em>${u}</em></div>`).join('');
    return `
      <div class="vue-tete"><div><h1>Suivi</h1><p>Relances du jour et résultats des 12 derniers mois (propositions tranchées : acceptées, refusées ou classées sans suite). Rien n'est envoyé à ta place : les messages se copient.</p></div></div>
      <h2 class="titre-section">À relancer <span>${pluriel(aRelancer.length, 'proposition')}</span></h2>
      ${aRelancer.length ? `<ul class="relances">${aRelancer.map((p) => { const st = statutDe(p); return `<li class="relance">
        <div><b>${esc(p.client.organisation)}</b><span>${esc(p.titre)} · ${esc(p.numero)}</span><small>${st === 'expiree' ? `Validité dépassée le ${fmt(R.finValidite(p))}` : `Envoyée le ${fmt(p.envoyeeLe)}${p.relances.length ? `, ${pluriel(p.relances.length, 'relance')}` : ', jamais relancée'}`}</small></div>
        <div class="rang">${st === 'expiree' ? `<button class="btn petit" data-action="prolonger" data-id="${p.id}">Prolonger</button>` : ''}<button class="btn petit primaire" data-action="relance" data-id="${p.id}">Relancer</button><button class="btn petit" data-action="decision" data-id="${p.id}">Réponse</button></div></li>`; }).join('')}</ul>`
        : '<p class="vide-ligne">Aucune relance due aujourd\'hui.</p>'}
      <h2 class="titre-section">Résultats <span>12 derniers mois</span></h2>
      <div class="tuiles">${tuiles}</div>
      <div class="suivi-grille">
        <section class="bloc large"><h2>Envoyées et acceptées par mois</h2>${graphiqueMois(s)}</section>
        <section class="bloc"><h2>Option choisie</h2>${s.acceptees ? barresSimples(choix, 'var(--bleu)') : '<p class="vide-ligne">Pas encore de proposition acceptée.</p>'}<p class="aide-champ">Position de l'option retenue dans la proposition : si la deuxième domine, ta gamme est bien construite.</p></section>
        <section class="bloc"><h2>Motifs de refus</h2>${motifs.length ? barresSimples(motifs, 'var(--rouge)') : '<p class="vide-ligne">Aucun refus sur la période.</p>'}</section>
        <section class="bloc large"><h2>Par trame</h2>${trames.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Trame</th><th class="nb">Tranchées</th><th class="nb">Acceptées</th><th class="nb">Taux</th><th class="nb">Signé HT</th></tr></thead><tbody>${trames.map(([id, x]) => `<tr><td>${esc(trameDe(id)?.nom || 'Autre')}</td><td class="nb">${x.decidees}</td><td class="nb">${x.acceptees}</td><td class="nb">${x.taux} %</td><td class="nb">${euros(x.montant)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vide-ligne">Aucune proposition tranchée sur la période.</p>'}</section>
      </div>`;
  }

  // ---------- Vue : bibliothèque ----------
  function vueBibliotheque() {
    const groupes = B.typesBlocs.map((t) => [t, E.blocs.filter((b) => b.type === t.id)]).filter(([, l]) => l.length);
    return `
      <div class="vue-tete"><div><h1>Bibliothèque</h1><p>Tes textes réutilisables : présentation, méthode, références, engagements. Insérés dans une proposition, ils y sont copiés : tu peux les adapter sans changer la bibliothèque.</p></div>
        <div class="actions"><button class="btn" data-action="importer-blocs">Ajouter les blocs types</button><button class="btn primaire" data-action="bloc-nouveau">${ICONES.plus}Bloc</button></div></div>
      ${E.blocs.length ? groupes.map(([t, liste]) => `
        <section class="groupe-cat"><h2>${esc(t.nom)} <span>${pluriel(liste.length, 'bloc')}</span></h2>
          <div class="blocs">${liste.map((b) => `<button class="carte-bloc" style="--c:${t.couleur}" data-action="bloc-modifier" data-id="${b.id}"><b>${esc(b.titre)}</b><span>${esc(b.texte.slice(0, 180))}${b.texte.length > 180 ? '…' : ''}</span>${/\[[^\]]+\]/.test(b.texte) ? '<em>À personnaliser</em>' : ''}</button>`).join('')}</div>
        </section>`).join('')
        : videEtat('Bibliothèque vide', 'Ajoute tes blocs un par un, ou pars des blocs types à personnaliser.', `<button class="btn primaire" data-action="importer-blocs">Ajouter les blocs types</button>`)}
      <p class="aide">Références clients : cite une organisation ou une citation seulement avec l'accord du client concerné.</p>`;
  }

  // ---------- Vue : profil ----------
  function vueProfil() {
    const e = E.profil;
    const champ = (cle, lib, aide = '', extra = '') => `<label class="champ">${lib}${aide ? `<small>${aide}</small>` : ''}<input data-e="${cle}" value="${esc(e[cle] ?? '')}" ${extra}></label>`;
    const an = Number(auj().slice(0, 4));
    return `
      <div class="vue-tete"><div><h1>Profil</h1><p>Ce qui apparaît en tête de tes propositions, et tes réglages par défaut. Enregistré à chaque modification.</p></div></div>
      <div class="sections-ent">
        <section class="bloc"><h2>Identité</h2>
          <div class="grille-2">${champ('nom', 'Prénom et nom', '', 'maxlength="80"')}${champ('enseigne', 'Nom commercial', 'Facultatif.', 'maxlength="80"')}</div>
          ${champ('activite', 'Activité en une ligne', '', 'maxlength="120"')}
          <div class="grille-2">${champ('telephone', 'Téléphone', '', 'type="tel" maxlength="30"')}${champ('email', 'E-mail', '', 'type="email" maxlength="120"')}</div>
          ${champ('site', 'Site', '', 'maxlength="120"')}
          <label class="champ">Signature des messages de relance<textarea data-e="signature" rows="2" maxlength="300">${esc(e.signature)}</textarea></label>
        </section>
        <section class="bloc"><h2>Par défaut</h2>
          <div class="grille-2">
            ${champ('prefixe', 'Préfixe des numéros', `Prochaine : <b data-suivant>${esc(R.prochainNumero(E.propositions, e.prefixe, an, E.compteurs[an]).numero)}</b>`, 'maxlength="6" autocapitalize="characters"')}
            <label class="champ">Trame par défaut<select data-e="trame-defaut">${[...B.trames.map((t) => [t.id, t.nom]), ['autre', 'Autre activité']].map(([v, l]) => `<option value="${v}" ${E.trame === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <label class="champ">Validité des propositions (jours)<input data-e="validiteJours" data-type="entier" type="number" min="1" max="365" value="${e.validiteJours}"></label>
            <label class="champ">Relancer après (jours sans nouvelles)<input data-e="relanceJours" data-type="entier" type="number" min="1" max="90" value="${e.relanceJours}"></label>
          </div>
          <label class="champ">Conditions par défaut<small>Vide : celles de la trame.</small><textarea data-e="conditions" rows="3" maxlength="2000">${esc(e.conditions)}</textarea></label>
          <label class="champ" style="max-width:320px">Taux pour afficher aussi le TTC (%)<small>Facultatif, à saisir toi-même selon ta situation (franchise, taux applicable). Vide : prix hors taxes seulement.</small><input data-e="tauxTva" data-type="taux-libre" value="${taux() === null ? '' : R.saisiePourcent(taux())}" inputmode="decimal" placeholder="Ex. : 20"></label>
        </section>
        <section class="bloc"><h2>À savoir</h2>
          <div class="avertissements">
            <p><b>Une proposition, pas un devis.</b> Elle présente le projet, les options et le calendrier. Le devis détaillé (lignes chiffrées, TVA, mentions obligatoires) se fait à l'acceptation, par exemple avec le Générateur de devis QME.</p>
            <p><b>Outil d'aide, pas un conseil juridique.</b> Tu restes responsable du contenu de tes propositions et de ce qui engage ton activité.</p>
            <p><b>Données de tes clients.</b> Elles sont hébergées en ligne pour te suivre sur tes appareils. Ne garde que le nécessaire et supprime ce qui ne sert plus.</p>
          </div>
        </section>
      </div>`;
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
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  function modaleNouvelle() {
    const an = Number(auj().slice(0, 4));
    const corps = `
      <label class="champ">Organisation cliente<input name="organisation" maxlength="120" placeholder="Ex. : Société Exemple"></label>
      <label class="champ">Titre<small>Le projet, du point de vue du client.</small><input name="titre" maxlength="160" placeholder="Ex. : Refonte du suivi des commandes"></label>
      <label class="champ">Trame<select name="trame">${[...B.trames.map((t) => [t.id, `${t.nom} · ${t.description}`]), ['autre', 'Autre activité (vierge)']].map(([v, l]) => `<option value="${v}" ${(E.trame || 'autre') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      ${E.blocs.length ? '<label class="case"><input type="checkbox" name="blocs" checked> Insérer mes blocs de présentation, de méthode et de références</label>' : ''}
      <p class="aide">Numéro attribué : <b>${esc(R.prochainNumero(E.propositions, E.profil.prefixe, an, E.compteurs[an]).numero)}</b>. Pour repartir d'une proposition existante, ouvre-la et choisis « Dupliquer ».</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle proposition', corps, '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const p = creerProposition({ organisation: String(f.get('organisation') || '').trim(), titre: String(f.get('titre') || '').trim(), trame: f.get('trame'), avecBlocs: f.has('blocs') });
      sauver();
      changerVue('edition', p.id);
      toast(`Proposition ${p.numero} créée : complète le contexte et chiffre les options.`);
    });
  }

  function modaleBloc(id) {
    const b = id ? E.blocs.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Type<select name="type">${B.typesBlocs.map((t) => `<option value="${t.id}" ${(b?.type || 'presentation') === t.id ? 'selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
      <label class="champ">Titre<input name="titre" required maxlength="120" value="${esc(b?.titre || '')}"></label>
      <label class="champ">Texte<small>Une ligne commençant par « - » ou « 1. » devient une liste à l'impression.</small><textarea name="texte" rows="8" maxlength="3000">${esc(b?.texte || '')}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    const pied = b ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(b ? 'Modifier le bloc' : 'Nouveau bloc', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        memoriserAnnulation();
        E.blocs = E.blocs.filter((x) => x.id !== b.id);
        sauver(); rendre(); toast(`Bloc « ${b.titre} » supprimé (les propositions qui l'utilisent gardent leur copie).`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const v = { type: f.get('type'), titre: String(f.get('titre') || '').trim(), texte: String(f.get('texte') || '').trim() };
      if (!v.titre) return 'Indique un titre.';
      if (b) Object.assign(b, v); else E.blocs.push({ id: uid(), ...v });
      sauver(); rendre(); toast(b ? 'Bloc enregistré.' : `Bloc « ${v.titre} » ajouté.`);
    });
  }

  function modaleInsererBloc() {
    if (!E.blocs.length) { toast('Ta bibliothèque est vide : ajoute des blocs dans l\'onglet Bibliothèque.'); return; }
    const p = uneProp(ouverte);
    ouvrirModale('Insérer un bloc', `<ul class="choix-liste">${E.blocs.map((b) => `<li><button type="button" class="choix-cat ${p.blocs.some((x) => x.titre === b.titre) ? 'ajoute' : ''}" data-action="inserer" data-id="${b.id}"><span><b>${esc(b.titre)}</b><small>${esc(B.typesBlocs.find((t) => t.id === b.type)?.nom || '')}</small></span><span>${esc(b.texte.slice(0, 60))}…</span></button></li>`).join('')}</ul>
      <p class="aide-champ">Chaque clic insère une copie du bloc à la fin, modifiable dans cette proposition seulement.</p>`, '<button class="btn primaire" value="annuler">Terminé</button>');
  }

  function modaleRelance(id) {
    const p = uneProp(id);
    const rang = p.relances.length + 1;
    const msg = R.messageRelance(p, E.profil, rang, fmtLong);
    const corps = `
      <p>${esc(p.client.organisation)} · ${esc(p.titre)}. ${p.relances.length ? `Déjà ${pluriel(p.relances.length, 'relance')}, la dernière le ${fmt(p.relances[p.relances.length - 1])}.` : 'Première relance.'}</p>
      <label class="champ">Message à copier<small>Rien n'est envoyé : colle-le dans ton e-mail ou ta messagerie.</small><textarea id="message-relance" rows="9">${esc(msg)}</textarea></label>
      <div class="rang"><button class="btn petit" type="button" data-action="copier">Copier le message</button></div>
      <p class="aide-champ">« Relance faite » note la date d'aujourd'hui : la suivante est proposée ${pluriel(relanceJours(), 'jour')} plus tard.</p>`;
    ouvrirModale(`Relancer ${esc(p.numero)}`, corps, '<button class="btn primaire" value="faite">Relance faite aujourd\'hui</button><button class="btn" value="annuler">Fermer</button>', () => {
      const i = E.propositions.findIndex((x) => x.id === id);
      memoriserAnnulation();
      E.propositions[i] = R.enregistrerRelance(E.propositions[i], auj());
      sauver(); rendre();
      toast(`Relance notée. Prochaine le ${fmt(R.prochaineRelance(E.propositions[i], relanceJours()))}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleDecision(id) {
    const p = uneProp(id);
    const rec = p.optionRetenue || R.optionRecommandee(p)?.id || p.options[0]?.id;
    const corps = `
      <fieldset class="champ choix-forme"><legend>Réponse</legend>
        <label class="case"><input type="radio" name="statut" value="acceptee" ${p.statut !== 'refusee' && p.statut !== 'sans-suite' ? 'checked' : ''}> Acceptée</label>
        <label class="case"><input type="radio" name="statut" value="refusee" ${p.statut === 'refusee' ? 'checked' : ''}> Refusée</label>
        <label class="case"><input type="radio" name="statut" value="sans-suite" ${p.statut === 'sans-suite' ? 'checked' : ''}> Sans suite (pas de réponse, projet abandonné)</label>
      </fieldset>
      ${p.options.length ? `<label class="champ">Option retenue (si acceptée)<select name="option">${p.options.map((o) => `<option value="${o.id}" ${o.id === rec ? 'selected' : ''}>${esc(o.nom)}${o.prixHT ? ` · ${euros(o.prixHT)} HT` : ''}</option>`).join('')}</select></label>` : ''}
      <label class="champ">Motif (si refusée ou sans suite)<select name="motif"><option value="">Non précisé</option>${B.motifsRefus.map((m) => `<option ${p.motifRefus === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="champ" style="max-width:220px">Date de la réponse<input type="date" name="le" value="${p.decideeLe || auj()}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Réponse pour ${esc(p.numero)}`, corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const le = String(f.get('le') || '');
      if (!R.dateValide(le)) return 'Indique la date de la réponse.';
      const i = E.propositions.findIndex((x) => x.id === id);
      memoriserAnnulation();
      E.propositions[i] = R.changerStatut(E.propositions[i], f.get('statut'), auj(), { optionId: f.get('option'), motif: f.get('motif'), le });
      sauver(); rendre();
      toast(`${p.numero} : ${STATUTS[f.get('statut')][0].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe" style="border-top:0;padding-top:0"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes propositions sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="aide-champ">Propositions commerciales QME. Trames et blocs types rédigés pour QME, sans donnée datée ni règle légale : prix hors taxes, mentions obligatoires dans le devis.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.propositions) || !d.profil) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.propositions.length, 'proposition')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide des propositions commerciales.'); }
    });
  }
  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `propositions-${auj()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Ajout à l'écran d'accueil ----------
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
    const blocs = a === 'ios' ? ETAPES_IOS : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Tes données restent les mêmes : l'icône ouvre cette page avec ta clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
    const pied = auto ? '<button class="btn primaire" value="plus-tard">Plus tard</button><button class="btn" value="jamais">Ne plus afficher</button>' : '<button class="btn primaire" value="ok">Fermer</button>';
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

  // ---------- Toast et annulation ----------
  let minuterieToast = null;
  function toast(texte, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }
  const memoriserAnnulation = () => { annulation = structuredClone(E); };
  function annuler() {
    if (!annulation) return;
    const majLe = E.majLe;
    E = annulation; if (majLe) E.majLe = majLe;
    annulation = null;
    sauver(); rendre();
  }

  // ---------- Saisie (délégation) ----------
  function lireValeur(el) {
    const type = el.dataset.type;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    if (type === 'montant') return el.value.trim() ? R.lireMontant(el.value) : 0;
    if (type === 'lignes') return lignesDe(el.value);
    if (type === 'entier') { const n = Number(el.value); return Number.isInteger(n) && n > 0 && n <= 365 ? n : null; }
    if (type === 'taux-libre') { if (!el.value.trim()) return ''; const v = R.lirePourcent(el.value); return v === null || v < 0 || v > 10000 ? null : v; }
    return el.value;
  }
  const affecter = (objet, chemin, v) => { const k = chemin.split('.'); const fin = k.pop(); let o = objet; for (const x of k) o = (o[x] ||= {}); o[fin] = v; };
  const COLLECTIONS = { liv: 'livrables', opt: 'options', et: 'etapes', bloc: 'blocs' };

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'recherche') { recherche = el.value; const pos = el.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (!E) return;
    if (el.tagName === 'TEXTAREA' && el.hasAttribute('data-auto')) ajusterHauteur(el);
    const p = uneProp(ouverte);
    const genre = Object.keys(COLLECTIONS).find((k) => el.dataset[k] !== undefined);
    if (genre && p) {
      if (el.type === 'checkbox' || el.type === 'radio') return; // au « change »
      const item = p[COLLECTIONS[genre]].find((x) => x.id === el.dataset.id);
      if (!item) return;
      const v = lireValeur(el);
      const invalide = v === null || (el.dataset.type === 'montant' && v < 0);
      el.classList.toggle('invalide', invalide);
      if (invalide) return;
      item[el.dataset[genre]] = v;
      sauver(); majEdition();
      return;
    }
    if (el.dataset.p && p) {
      const cle = el.dataset.p;
      if (el.tagName === 'SELECT') return;
      const v = lireValeur(el);
      const invalide = v === null || (cle === 'date' && !v);
      el.classList.toggle('invalide', invalide);
      if (invalide) return;
      affecter(p, cle, v);
      sauver(); majEdition();
      return;
    }
    if (el.dataset.e) {
      const cle = el.dataset.e;
      if (el.tagName === 'SELECT') return;
      const v = lireValeur(el);
      const invalide = v === null || (cle === 'relanceJours' && v > 90);
      el.classList.toggle('invalide', invalide);
      if (invalide) return;
      E.profil[cle] = cle === 'prefixe' ? R.nettoyerPrefixe(v) : (cle === 'tauxTva' && v === '' ? null : v);
      if (cle === 'prefixe') { const an = Number(auj().slice(0, 4)); const s = $('[data-suivant]'); if (s) s.textContent = R.prochainNumero(E.propositions, E.profil.prefixe, an, E.compteurs[an]).numero; }
      sauver();
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!E) return;
    const p = uneProp(ouverte);
    if (el.dataset.opt === 'recommandee' && p) { p.options.forEach((o) => { o.recommandee = o.id === el.dataset.id; }); sauver(); rendre(); return; }
    if (el.dataset.et === 'parallele' && p) { const x = p.etapes.find((y) => y.id === el.dataset.id); if (x) x.parallele = el.checked; sauver(); majEdition(); return; }
    if (el.dataset.p === 'trame' && p) { p.trame = el.value; sauver(); rendre(); return; }
    if (el.dataset.e === 'trame-defaut') { E.trame = el.value; sauver(); return; }
    if (el.dataset.opt === 'prixHT' && p) { const o = p.options.find((x) => x.id === el.dataset.id); if (o && !el.classList.contains('invalide')) el.value = o.prixHT ? R.saisieMontant(o.prixHT) : ''; }
    if (el.classList.contains('invalide')) toast('Valeur non reconnue : la précédente est gardée.');
  });

  function ajusterHauteur(el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 4}px`; }

  // ---------- Actions ----------
  function deplacer(genre, id, sens) {
    const liste = uneProp(ouverte)[genre];
    const i = liste.findIndex((x) => x.id === id);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= liste.length) return;
    [liste[i], liste[j]] = [liste[j], liste[i]];
    sauver(); rendre();
    document.querySelector(`[data-action="${sens < 0 ? 'monter' : 'descendre'}"][data-id="${id}"]`)?.focus();
  }
  function retirer(genre, id) {
    const p = uneProp(ouverte);
    const x = p[genre].find((y) => y.id === id);
    memoriserAnnulation();
    p[genre] = p[genre].filter((y) => y.id !== id);
    if (genre === 'options' && x?.recommandee && p.options[0]) p.options[Math.min(1, p.options.length - 1)].recommandee = true;
    sauver(); rendre();
    toast(`« ${(x?.titre || x?.nom || 'Élément').slice(0, 40)} » retiré.`, { libelle: 'Annuler', faire: annuler });
  }
  const ajouterAuTexte = (cle, t) => { const p = uneProp(ouverte); p[cle] = p[cle] ? `${p[cle].trim()}\n${t}` : t; sauver(); rendre(); };

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const p = E ? uneProp(ouverte) : null;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); changerVue('propositions'); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'trame-accueil': accueil.trame = id; ecranAccueil(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': {
        const f = $('#form-accueil');
        if (f) { const d = new FormData(f); Object.assign(accueil, { nom: d.get('nom') || '', enseigne: d.get('enseigne') || '', activite: d.get('activite') || '', importer: d.has('importer') }); }
        terminerAccueil(); break;
      }
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'filtre': filtre = id; rendre(); break;
      case 'nouvelle': modaleNouvelle(); break;
      case 'ouvrir': changerVue('edition', id); break;
      case 'apercu': changerVue('apercu', id); break;
      case 'imprimer': window.print(); break;
      case 'dupliquer': { const c = dupliquerProposition(id); sauver(); changerVue('edition', c.id); toast(`Copie créée : ${c.numero} (brouillon, suivi remis à zéro).`); break; }
      case 'supprimer': {
        const x = uneProp(id);
        if (!confirm(`Supprimer la proposition ${x.numero} ? Son numéro ne sera pas réattribué.`)) break;
        memoriserAnnulation();
        E.propositions = E.propositions.filter((y) => y.id !== id);
        sauver(); changerVue('propositions');
        toast(`Proposition ${x.numero} supprimée.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'envoyer': {
        const i = E.propositions.findIndex((x) => x.id === id);
        memoriserAnnulation();
        E.propositions[i] = R.changerStatut(E.propositions[i], 'envoyee', auj());
        sauver(); rendre();
        toast(`Envoyée aujourd'hui. Relance prévue le ${fmt(R.prochaineRelance(E.propositions[i], relanceJours()))}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'rouvrir': {
        const i = E.propositions.findIndex((x) => x.id === id);
        memoriserAnnulation();
        E.propositions[i] = R.changerStatut(E.propositions[i], 'envoyee', auj());
        sauver(); rendre(); toast('Proposition remise en attente de réponse.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'relance': modaleRelance(id); break;
      case 'decision': modaleDecision(id); break;
      case 'prolonger': {
        const i = E.propositions.findIndex((x) => x.id === id);
        memoriserAnnulation();
        E.propositions[i] = R.prolonger(E.propositions[i], E.profil.validiteJours || 30, auj());
        sauver(); rendre();
        toast(`Validité prolongée jusqu'au ${fmt(R.finValidite(E.propositions[i]))}. Pense à prévenir le client.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'copier': {
        const t = $('#message-relance');
        try { await navigator.clipboard.writeText(t.value); toast('Message copié.'); } catch { t.select(); toast('Sélectionne le texte et copie-le.'); }
        break;
      }
      case 'monter': deplacer(el.dataset.genre, id, -1); break;
      case 'descendre': deplacer(el.dataset.genre, id, 1); break;
      case 'retirer': retirer(el.dataset.genre, id); break;
      case 'ajout-objectif': p.objectifs.push(el.dataset.texte); sauver(); rendre(); break;
      case 'ajout-condition': ajouterAuTexte('conditions', el.dataset.texte); break;
      case 'ajout-livrable': { const l = { id: uid(), titre: '', description: '' }; p.livrables.push(l); sauver(); rendre(); $(`[data-liv="titre"][data-id="${l.id}"]`)?.focus(); break; }
      case 'ajout-livrable-type': { const t = trameDe(p.trame)?.livrables.find(([x]) => x === el.dataset.texte); p.livrables.push({ id: uid(), titre: el.dataset.texte, description: t?.[1] || '' }); sauver(); rendre(); break; }
      case 'ajout-option': { const o = { id: uid(), nom: NOMS_OPTIONS[p.options.length] || `Option ${p.options.length + 1}`, accroche: '', prixHT: 0, inclus: [], delai: '', recommandee: !p.options.length }; p.options.push(o); sauver(); rendre(); $(`[data-opt="nom"][data-id="${o.id}"]`)?.focus(); break; }
      case 'cumuler': {
        memoriserAnnulation();
        for (let i = 1; i < p.options.length; i++) {
          const avant = p.options[i - 1].inclus;
          const deja = new Set(p.options[i].inclus.map((x) => x.toLowerCase()));
          p.options[i].inclus = [...avant.filter((x) => !deja.has(x.toLowerCase())), ...p.options[i].inclus];
        }
        sauver(); rendre(); toast('Chaque option reprend le contenu de la précédente.', { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'ajout-etape': { const x = { id: uid(), titre: '', semaines: 1, parallele: false }; p.etapes.push(x); sauver(); rendre(); $(`[data-et="titre"][data-id="${x.id}"]`)?.focus(); break; }
      case 'inserer-bloc': modaleInsererBloc(); break;
      case 'inserer': {
        const b = E.blocs.find((x) => x.id === id);
        p.blocs.push({ id: uid(), type: b.type, titre: b.titre, texte: b.texte });
        sauver();
        const y = window.scrollY; rendre(); window.scrollTo({ top: y });
        el.classList.add('ajoute');
        toast(`Bloc « ${b.titre} » inséré.`);
        break;
      }
      case 'bloc-nouveau': modaleBloc(); break;
      case 'bloc-modifier': modaleBloc(id); break;
      case 'importer-blocs': { memoriserAnnulation(); const n = importerBlocs(); sauver(); rendre(); toast(n ? `${pluriel(n, 'bloc type ajouté', 'blocs types ajoutés')} : remplace les [crochets] par ton texte.` : 'Les blocs types sont déjà dans ta bibliothèque.', n ? { libelle: 'Annuler', faire: annuler } : null); break; }
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && E) rafraichir(); });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  window.addEventListener('hashchange', () => { if (!E) return; lireHash(); rendre(); });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    if (new URLSearchParams(location.search).has('demo') && !code) { history.replaceState(null, '', location.pathname + location.hash); return ouvrirDemo(false); }
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

  window.__propositions = { etat: () => E };
  init();
})();
