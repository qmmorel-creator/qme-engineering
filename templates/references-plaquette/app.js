// Kit références et plaquette QME : fiches projets (contexte, mission, résultats chiffrés, témoignage,
// mots-clés, visuel), filtres, sélections par prospect avec suggestions, plaquette imprimable ou en PDF.
// Données synchronisées par clé de licence ou code d'accès. Rien n'est envoyé à personne : la plaquette
// s'imprime ou s'enregistre en PDF depuis le navigateur, et les textes se copient.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.KRF;
  const API = '/api/templates';
  const PRODUIT = 'KRF';
  const CLE_CODE = 'qme-krf-code';
  const CLE_CACHE = 'qme-krf-cache';
  const CLE_DEMO = 'qme-krf-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-krf-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const isoJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const aujIso = () => isoJour(new Date());
  const moisCourant = () => R.moisDeDate(new Date());
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const metier = () => B.metiers.find((m) => m.id === E?.profil?.metier) || B.metiers[B.metiers.length - 1];
  const accent = (id) => B.accents.find((a) => a.id === id) || B.accents[0];
  const nomSecteur = (id) => B.secteurs.find((s) => s.id === id)?.nom || '';
  const projet = (id) => E.projets.find((p) => p.id === id);
  const selection = (id) => E.selections.find((s) => s.id === id);
  // Texte raccourci au mot près pour tenir dans une page A4 de la plaquette.
  const court = (s, n) => { const t = String(s || '').trim(); if (t.length <= n) return t; const c = t.slice(0, n); return `${c.slice(0, Math.max(c.lastIndexOf(' '), n - 20))}…`; };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'references';
  let detail = null;          // référence ouverte dans l'onglet Références
  let selOuverte = null;      // sélection ouverte dans l'onglet Sélections
  let selPlaquette = '';      // sélection affichée dans l'onglet Plaquette ('' = mises en avant)
  let modeleParDefaut = 'plaquette'; // mise en page des « références mises en avant », le temps de la session
  const filtre = { q: '', secteur: '', type: '', annee: '', motCle: '', chiffre: false, temoignage: false, aCompleter: false };
  let annulation = null;
  let filtresOuverts = false;   // filtres dépliés sur téléphone

  // R.normaliser ne garde que les champs connus : on y réinjecte tutorielVu (guide « Comment ça marche » déjà vu).
  const normaliser = (d) => ({ ...R.normaliser(d), tutorielVu: d?.tutorielVu === true });
  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
    if (detail && !projet(detail)) detail = null;
    if (selOuverte && !selection(selOuverte)) selOuverte = null;
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
        toast('Un autre appareil a modifié tes références entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        toast('Espace de stockage plein : retire un visuel ou raccourcis des textes, puis réessaie.');
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
      const { statut, corps } = await appel('/donnees');
      if (statut === 200 && corps.donnees && corps.donnees.majLe !== session.base) {
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open && !saisieEnCours()) rendre();
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
  // Code interne (KRF-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && (E.projets.length || E.profil.nom)) { cache(false); demarrer(); } else { E = null; ecranAccueil(); }
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
    detail = null; selOuverte = null; selPlaquette = '';
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Indépendante fictive (« Atelier Exemple », conseil en organisation et outils numériques pour petites
  // structures). Clients fictifs ou anonymisés, dates relatives à aujourd'hui. États forcés : références
  // complètes et mises en avant, une à compléter (sans résultat), un client nommé sans accord, un témoignage
  // sans accord de citation, une mission en cours, deux visuels, deux sélections (plaquette et fiches).
  const VISUEL_DEMO_1 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300"><rect width="480" height="300" fill="#D8E4F0"/><rect x="28" y="28" width="424" height="244" rx="14" fill="#FFFFFF"/><rect x="52" y="54" width="120" height="14" rx="7" fill="#2E5A88"/><rect x="52" y="86" width="116" height="70" rx="10" fill="#FBEBC2"/><rect x="182" y="86" width="116" height="70" rx="10" fill="#F8DCD3"/><rect x="312" y="86" width="116" height="70" rx="10" fill="#D8E4F0"/><rect x="66" y="104" width="50" height="16" rx="4" fill="#6E5310"/><rect x="196" y="104" width="50" height="16" rx="4" fill="#8A3322"/><rect x="326" y="104" width="50" height="16" rx="4" fill="#22476E"/><rect x="62" y="236" width="26" height="20" fill="#2E5A88"/><rect x="100" y="210" width="26" height="46" fill="#2E5A88"/><rect x="138" y="196" width="26" height="60" fill="#E8B93A"/><rect x="176" y="182" width="26" height="74" fill="#2E5A88"/><rect x="214" y="172" width="26" height="84" fill="#B84A34"/><path d="M270 240 C310 200 350 230 420 176" fill="none" stroke="#24221F" stroke-width="4" stroke-linecap="round"/><circle cx="420" cy="176" r="7" fill="#B84A34"/></svg>');
  const VISUEL_DEMO_2 = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300"><rect width="480" height="300" fill="#FBEBC2"/><circle cx="120" cy="150" r="86" fill="#E8B93A"/><path d="M120 150 L120 64 A86 86 0 0 1 206 150 Z" fill="#24221F"/><rect x="250" y="70" width="190" height="34" rx="17" fill="#FFFFFF"/><rect x="250" y="122" width="150" height="34" rx="17" fill="#FFFFFF"/><rect x="250" y="174" width="170" height="34" rx="17" fill="#FFFFFF"/><circle cx="270" cy="87" r="9" fill="#2E5A88"/><circle cx="270" cy="139" r="9" fill="#B84A34"/><circle cx="270" cy="191" r="9" fill="#2E5A88"/><rect x="250" y="226" width="110" height="18" rx="9" fill="#6E5310"/></svg>');

  function donneesDemo() {
    const m = moisCourant();
    const il = (n) => R.ajoutMois(m, -n);
    const e = R.etatVide();
    e.profil = R.normaliserProfil({
      nom: 'Atelier Exemple',
      metier: 'conseil',
      accroche: 'Organisation et outils numériques pour les petites structures',
      presentation: 'Consultante indépendante depuis huit ans, j\'aide les PME, les associations et les collectivités à remettre de l\'ordre dans leurs processus : un diagnostic court, des outils simples que les équipes adoptent, et un suivi jusqu\'à ce que ça tienne sans moi.',
      zone: 'Grand Ouest, à distance partout en France',
      coordonnees: 'contact@atelier-exemple.fr · atelier-exemple.fr (coordonnées fictives)',
      chiffres: [{ valeur: '8 ans', libelle: 'd\'expérience' }, { valeur: '45', libelle: 'missions menées' }, { valeur: '92 %', libelle: 'de clients qui reviennent ou recommandent' }],
      accent: 'bleu',
    });
    const P = (o) => R.normaliserProjet({ creeLe: aujIso(), ...o });
    const p = [
      P({ id: 'demo-devis', avant: true, titre: 'Délai de devis divisé par trois', type: 'Organisation et processus', debut: il(7), fin: il(4), duree: '3 mois', visuel: VISUEL_DEMO_1, legende: 'Tableau de suivi des devis (illustration)',
        client: { nom: 'Exemple Menuiseries', accord: true, secteur: 'btp', taille: 'pe', region: 'Pays de la Loire' },
        contexte: 'Une entreprise de menuiserie de 28 salariés perdait des chantiers faute de répondre vite : les demandes arrivaient par téléphone, e-mail et salon, et chaque devis passait par trois personnes.',
        mission: 'Cartographie du circuit de la demande au devis signé, puis mise en place d\'une boîte de réception unique, de modèles de devis par famille de produits et d\'un point hebdomadaire de quinze minutes. Formation des deux assistantes et du conducteur de travaux.',
        resultats: [{ valeur: '÷3', libelle: 'délai moyen de remise d\'un devis' }, { valeur: '+18 %', libelle: 'de devis signés sur six mois' }, { valeur: '0', libelle: 'demande perdue depuis la mise en place' }],
        temoignage: { texte: 'Nous répondons en deux jours au lieu d\'une semaine, et plus aucune demande ne se perd. L\'équipe a gardé les outils sans qu\'on ait besoin de la relancer.', auteur: 'Gérant, Exemple Menuiseries', accord: true },
        motsCles: ['processus', 'devis', 'réduction des délais', 'outils numériques', 'formation'] }),
      P({ id: 'demo-asso', avant: true, titre: 'Planning des bénévoles enfin partagé', type: 'Outils numériques', debut: il(13), fin: il(11), duree: '10 semaines', visuel: VISUEL_DEMO_2, legende: 'Planning des créneaux (illustration)',
        client: { nom: '', accord: false, secteur: 'associations', taille: 'association', region: 'Bretagne' },
        contexte: 'Une association d\'aide alimentaire de 120 bénévoles organisait ses créneaux de distribution par SMS et sur un tableau papier dans le local : trous de planning, doublons et coordinatrice épuisée.',
        mission: 'Choix d\'un outil de planning gratuit adapté aux bénévoles peu à l\'aise avec le numérique, paramétrage des créneaux et des rôles, deux ateliers de prise en main et un guide d\'une page affiché au local.',
        resultats: [{ valeur: '−70 %', libelle: 'de créneaux non pourvus' }, { valeur: '6 h', libelle: 'gagnées chaque semaine par la coordinatrice' }, { valeur: '120', libelle: 'bénévoles inscrits sur l\'outil' }],
        temoignage: { texte: 'Je ne passe plus mes dimanches soir à envoyer des SMS. Les bénévoles voient les trous et se positionnent seuls.', auteur: 'Coordinatrice bénévole', accord: true },
        motsCles: ['outils numériques', 'planning', 'bénévoles', 'conduite du changement'] }),
      P({ id: 'demo-collectivite', avant: true, titre: 'Accueil du public réorganisé en mairie', type: 'Diagnostic', debut: il(22), fin: il(19), duree: '4 mois',
        client: { nom: '', accord: false, secteur: 'public', taille: 'collectivite', region: 'Normandie' },
        contexte: 'Une commune de 15 000 habitants voyait les files d\'attente s\'allonger à l\'accueil de la mairie, avec des agents qui passaient d\'un dossier à l\'autre sans visibilité sur les rendez-vous.',
        mission: 'Diagnostic sur site pendant deux semaines (comptages, entretiens avec les agents), puis organisation par rendez-vous pour les démarches longues, fiche réflexe par démarche et tableau d\'affichage des temps d\'attente.',
        resultats: [{ valeur: '−40 %', libelle: 'de temps d\'attente moyen' }, { valeur: '14', libelle: 'fiches réflexe rédigées avec les agents' }],
        motsCles: ['diagnostic', 'accueil', 'organisation', 'secteur public', 'qualité'] }),
      P({ id: 'demo-negoce', titre: 'Tableau de bord commercial pour un négociant', type: 'Pilotage de projet', debut: il(30), fin: il(27), duree: '3 mois',
        client: { nom: '', accord: false, secteur: 'commerce', taille: 'me', region: 'Centre-Val de Loire' },
        contexte: 'Un négociant en matériaux de 60 salariés suivait ses ventes dans six fichiers différents, mis à jour à la main par chaque agence, sans vision commune des marges.',
        mission: 'Définition de huit indicateurs communs avec la direction et les chefs d\'agence, fichier unique alimenté chaque lundi, revue mensuelle de trente minutes animée les trois premiers mois.',
        resultats: [{ valeur: '6 → 1', libelle: 'fichiers de suivi des ventes' }, { valeur: '2 h', libelle: 'de reporting en moins par agence et par semaine' }],
        temoignage: { texte: 'Pour la première fois, les agences parlent des mêmes chiffres en réunion.', auteur: 'Directeur commercial', accord: false },
        motsCles: ['tableau de bord', 'pilotage', 'commerce', 'indicateurs'] }),
      P({ id: 'demo-cabinet', titre: 'Formation au travail collaboratif', type: 'Formation des équipes', debut: il(9), fin: il(8), duree: '4 demi-journées',
        client: { nom: 'Cabinet Exemple Avocats', accord: false, secteur: 'services', taille: 'tpe', region: 'Île-de-France' },
        contexte: 'Un cabinet de huit personnes venait de passer à une suite collaborative en ligne, mais chacun continuait à s\'envoyer des pièces jointes par e-mail.',
        mission: 'Quatre ateliers pratiques sur les dossiers réels du cabinet : arborescence commune, règles de nommage, partage et suivi des versions, agenda partagé.',
        resultats: [{ valeur: '8', libelle: 'personnes formées' }, { valeur: '100 %', libelle: 'des dossiers clients dans l\'arborescence commune' }],
        motsCles: ['formation', 'outils numériques', 'travail collaboratif'] }),
      P({ id: 'demo-sante', titre: 'Circuit des commandes d\'un cabinet de kinésithérapie', type: 'Organisation et processus', debut: il(16), fin: il(15), duree: '6 semaines',
        client: { nom: '', accord: false, secteur: 'sante', taille: 'tpe', region: 'Bretagne' },
        contexte: 'Un cabinet de cinq praticiens tombait régulièrement à court de consommables, faute de savoir qui commandait quoi et quand.',
        mission: 'Inventaire, seuils de réapprovisionnement par article, une seule personne référente par semaine et une liste de commande pré-remplie.',
        resultats: [{ valeur: '0', libelle: 'rupture de consommables en six mois' }, { valeur: '−15 %', libelle: 'sur le budget annuel de consommables' }],
        motsCles: ['processus', 'achats', 'santé'] }),
      P({ id: 'demo-industrie', titre: 'Réunions de production raccourcies', type: 'Accompagnement du changement', debut: il(40), fin: il(37), duree: '3 mois',
        client: { nom: '', accord: false, secteur: 'industrie', taille: 'pe', region: 'Pays de la Loire' },
        contexte: 'Dans un atelier de mécanique de 35 salariés, la réunion quotidienne de production durait plus d\'une heure et se terminait sans décision claire.',
        mission: 'Observation de dix réunions, nouveau format debout de quinze minutes autour d\'un tableau visuel, rôle d\'animateur tournant et suivi des actions d\'un jour sur l\'autre.',
        resultats: [{ valeur: '−75 %', libelle: 'de durée de la réunion quotidienne' }, { valeur: '35', libelle: 'personnes concernées' }],
        temoignage: { texte: 'On sort de la réunion en sachant qui fait quoi. Le format a tenu depuis.', auteur: 'Responsable de production', accord: true },
        motsCles: ['management', 'réunions', 'industrie', 'conduite du changement'] }),
      P({ id: 'demo-encours', titre: 'Mise en place d\'un outil de gestion des interventions', type: 'Pilotage de projet', debut: il(2), duree: 'en cours',
        client: { nom: '', accord: false, secteur: 'services', taille: 'pe', region: 'Grand Ouest' },
        contexte: 'Une entreprise de maintenance de 22 techniciens planifie ses interventions sur un tableau blanc.',
        mission: 'Cahier des besoins rédigé avec l\'équipe, comparaison de trois solutions, déploiement prévu en deux vagues.',
        motsCles: ['outils numériques', 'planning'] }),
      P({ id: 'demo-brouillon', titre: 'Atelier stratégie pour une start-up', type: 'Stratégie', debut: il(5), fin: il(5),
        client: { nom: '', accord: false, secteur: 'numerique', taille: 'tpe', region: '' },
        contexte: 'Atelier d\'une journée avec les fondateurs.',
        motsCles: ['stratégie'] }),
    ];
    e.projets = p;
    e.selections = [
      R.normaliserSelection({ id: 'demo-sel-1', nom: 'Exemple Matériaux · proposition d\'accompagnement', secteur: 'commerce', type: 'Organisation et processus', motsCles: ['processus', 'outils numériques', 'réduction des délais'], modele: 'plaquette', creeLe: aujIso(),
        intro: 'Comme convenu lors de notre échange, voici trois réalisations proches de votre projet : des équipes commerciales et administratives qui gagnent du temps avec des outils simples, adoptés durablement.',
        projets: ['demo-devis', 'demo-negoce', 'demo-asso'], options: { nomsClients: true, temoignages: true, montants: false, visuels: true } }),
      R.normaliserSelection({ id: 'demo-sel-2', nom: 'Communauté de communes Exemple · appel à candidatures', secteur: 'public', type: 'Diagnostic', motsCles: ['diagnostic', 'accueil', 'qualité'], modele: 'fiches', creeLe: aujIso(),
        intro: 'Références de missions conduites auprès de collectivités et de structures d\'intérêt général.',
        projets: ['demo-collectivite', 'demo-asso'], options: { nomsClients: false, temoignages: true, montants: false, visuels: true } }),
    ];
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Kit références et plaquette · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="40" width="150" height="210" fill="#F0EDE6" stroke="#141414" stroke-width="4"/>
          <rect x="40" y="62" width="110" height="70" fill="#1D4E89"/>
          <rect x="40" y="150" width="80" height="10" fill="#141414"/>
          <rect x="40" y="172" width="100" height="10" fill="#141414"/>
          <rect x="40" y="194" width="60" height="10" fill="#141414"/>
          <rect x="196" y="70" width="150" height="210" fill="#F5B400"/>
          <circle cx="271" cy="150" r="46" fill="#D9302A"/>
          <circle cx="450" cy="150" r="110" fill="#F0EDE6"/>
          <path d="M450 150 L450 40 A110 110 0 0 1 560 150 Z" fill="#141414"/>
          <rect x="420" y="160" width="60" height="60" fill="#1D4E89"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Kit références et plaquette</p>
          <h1>Tes réalisations, prêtes à convaincre.</h1>
          <p>Une fiche par projet (contexte, mission, résultat chiffré, témoignage), des filtres, et pour chaque prospect la bonne sélection de références, mise en page, prête à imprimer ou à enregistrer en PDF.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton kit de références</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes références sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon kit</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/references-plaquette/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon kit'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', accroche: '', metier: 'conseil', titre: '', type: '', secteur: '', taille: '', valeur: '', libelle: '' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    const m = B.metiers.find((x) => x.id === a.metier) || B.metiers[0];
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On prépare ton kit de références.</h1>
        <p class="intro">Tu ranges chaque réalisation dans une fiche (contexte, mission, résultat chiffré, témoignage), puis tu composes pour chaque prospect une sélection mise en page, prête à imprimer ou à enregistrer en PDF. Rien n'est envoyé à personne.</p>
        <div class="rang-champs" style="max-width:760px;margin-top:20px">
          <label class="champ">Nom affiché <small>Ton nom ou celui de ton activité, en tête de la plaquette.</small><input id="a-nom" value="${esc(a.nom)}" autocomplete="organization" maxlength="80"></label>
          <label class="champ">Accroche <small>Ce que tu fais, en une ligne.</small><input id="a-accroche" value="${esc(a.accroche)}" maxlength="160" placeholder="Ex. : Rénovation de salles de bains en Gironde"></label>
        </div>
        <fieldset class="champ" style="margin-top:20px;border:0;padding:0"><legend>Ton métier <small>Pour proposer les types de mission, les mots-clés et les résultats à mesurer. Modifiable dans Profil.</small></legend>
          <div class="choix-activite">${B.metiers.map((x) => `<label><input type="radio" name="metier" value="${x.id}" ${x.id === a.metier ? 'checked' : ''}><span><b>${esc(x.nom)}</b><small>${esc(x.detail)}</small></span></label>`).join('')}</div>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Ta première référence</h1>
        <p class="intro">L'essentiel en quatre champs : tu compléteras le contexte, la mission et le témoignage ensuite. Pas de nom de client : il sera décrit par son secteur et sa taille tant que tu n'as pas noté son accord.</p>
        <div class="cadre-accueil">
          <label class="champ">Titre <small>Le résultat obtenu, plutôt que le nom de la prestation.</small><input id="a-titre" maxlength="120" value="${esc(a.titre)}" placeholder="Ex. : Délai de devis divisé par trois"></label>
          <div class="rang-champs">
            <label class="champ">Type de mission<select id="a-type">${m.types.map((t) => `<option ${t === a.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
            <label class="champ">Secteur du client<select id="a-secteur"><option value="">—</option>${B.secteurs.map((s) => `<option value="${s.id}" ${s.id === a.secteur ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
            <label class="champ">Taille<select id="a-taille"><option value="">—</option>${B.tailles.map((s) => `<option value="${s.id}" ${s.id === a.taille ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
          </div>
          <div class="rang-champs">
            <label class="champ" style="flex:0 1 160px">Résultat chiffré<input id="a-valeur" maxlength="24" value="${esc(a.valeur)}" placeholder="Ex. : −30 %"></label>
            <label class="champ">Ce que mesure ce chiffre<input id="a-libelle" maxlength="80" value="${esc(a.libelle)}" list="a-resultats" placeholder="Ex. : ${esc(m.resultats[0])}"><datalist id="a-resultats">${m.resultats.map((r) => `<option value="${esc(r)}">`).join('')}</datalist></label>
          </div>
        </div>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <span class="rang"><button class="btn" data-action="accueil-fin" data-vide="1">Passer cette étape</button><button class="btn primaire" data-action="accueil-fin">Créer mon kit</button></span>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lie = (id, cle) => $(id)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lie('#a-nom', 'nom'); lie('#a-accroche', 'accroche'); lie('#a-titre', 'titre'); lie('#a-valeur', 'valeur'); lie('#a-libelle', 'libelle');
    ['type', 'secteur', 'taille'].forEach((c) => $(`#a-${c}`)?.addEventListener('change', (e) => { accueil[c] = e.target.value; }));
    document.querySelectorAll('[name=metier]').forEach((el) => el.addEventListener('change', () => { accueil.metier = el.value; accueil.type = ''; }));
  }

  function terminerAccueil(vide) {
    const a = accueil;
    E = { ...R.etatVide(), tutorielVu: false };
    E.profil = R.normaliserProfil({ nom: a.nom.trim(), accroche: a.accroche.trim(), metier: a.metier });
    const m = B.metiers.find((x) => x.id === a.metier) || B.metiers[0];
    if (!vide && a.titre.trim()) {
      const p = R.normaliserProjet({ titre: a.titre, type: a.type || m.types[0], client: { secteur: a.secteur, taille: a.taille }, resultats: [{ valeur: a.valeur, libelle: a.libelle }], debut: moisCourant(), creeLe: aujIso() });
      E.projets.push(p);
      detail = p.id;
    }
    accueil = accueilVide();
    vue = 'references';
    sauver();
    demarrer();
    toast(E.projets.length ? 'Ton kit est prêt. Complète cette première référence : contexte, mission, témoignage.' : 'Ton kit est prêt. Ajoute ta première référence.');
  }

  // ---------- Icônes et formes ----------
  const ICONES = {
    references: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    selections: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>',
    plaquette: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="2" width="14" height="20" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="5" width="8" height="6" fill="currentColor"/><rect x="8" y="14" width="8" height="2" fill="currentColor"/><rect x="8" y="18" width="5" height="2" fill="currentColor"/></svg>',
    profil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    imprimer: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="3" width="12" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="9" width="18" height="8" fill="currentColor"/><rect x="7" y="14" width="10" height="7" fill="#fff" stroke="currentColor" stroke-width="2"/></svg>',
    copier: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    etoile: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.3l6.6-.8Z" fill="currentColor"/></svg>',
    etoileVide: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6L2.5 9.3l6.6-.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  };
  const ONGLETS = [['references', 'Références'], ['selections', 'Sélections'], ['plaquette', 'Plaquette'], ['profil', 'Profil']];

  // Couverture géométrique d'une référence sans visuel (formes Bauhaus, couleur tirée du type de mission).
  function couvertureSvg(p, classe = 'couv') {
    const c = R.couverture(p, B);
    const a = accent(c.accent);
    const forme = {
      rond: `<circle cx="200" cy="125" r="78" fill="${a.couleur}"/><rect x="200" y="125" width="78" height="78" fill="#24221F" opacity=".9"/>`,
      carre: `<rect x="120" y="45" width="160" height="160" fill="${a.couleur}"/><circle cx="280" cy="205" r="40" fill="#24221F" opacity=".9"/>`,
      quart: `<path d="M120 205 V45 A160 160 0 0 1 280 205 Z" fill="${a.couleur}"/><rect x="250" y="60" width="50" height="50" fill="#24221F" opacity=".9"/>`,
      triangle: `<path d="M200 35 290 205H110Z" fill="${a.couleur}"/><circle cx="130" cy="70" r="28" fill="#24221F" opacity=".9"/>`,
    }[c.forme];
    return `<svg class="${classe}" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration géométrique"><rect width="400" height="250" fill="${a.teinte}"/>${forme}</svg>`;
  }
  const visuel = (p, classe = 'couv') => (p.visuel ? `<img class="${classe}" src="${esc(p.visuel)}" alt="${esc(p.legende || p.titre)}">` : couvertureSvg(p, classe));
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="8" width="56" height="80" fill="#F0EDE6" stroke="#141414" stroke-width="3"/><rect x="10" y="18" width="36" height="22" fill="#1D4E89"/><rect x="10" y="50" width="30" height="5" fill="#141414"/><rect x="10" y="62" width="22" height="5" fill="#141414"/><circle cx="74" cy="64" r="22" fill="#F5B400"/></svg>';
  const etiquetteNiveau = (c) => `<span class="niveau niv-${c.niveau}"><b>${c.score}</b><span>${esc(R.NIVEAUX[c.niveau])}</span></span>`;

  // ---------- Application ----------
  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/references-plaquette/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Références<br>et plaquette</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span><span class="court">${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="tutoriel" aria-label="Comment ça marche" title="Comment ça marche">${ICONES.aide}</button>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (stock.lire(CLE_CACHE)?.nonEnvoye ? 'attente' : 'ok'));
    rendre();
    premiersPas();
  }

  const saisieEnCours = () => document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]),textarea');

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Références et plaquette`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { references: vueReferences, selections: vueSelections, plaquette: vuePlaquette, profil: vueProfil }[vue]();
    brancherVue();
    ajusterApercu();
  }

  function changerVue(v, { haut = true } = {}) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    if (haut) window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // ---------- Références : liste ----------
  function vueReferences() {
    if (detail && projet(detail)) return vueFicheRef(projet(detail));
    detail = null;
    const tous = E.projets;
    const st = R.statistiques(E);
    const tete = `<div class="vue-tete"><div><h1>Références</h1><p>${tous.length ? `${pluriel(st.total, 'référence')} · ${pluriel(st.chiffres, 'avec résultat chiffré', 'avec résultat chiffré')} · ${pluriel(st.temoignages, 'témoignage citable', 'témoignages citables')}${st.alertes ? ` · <b class="txt-alerte">${pluriel(st.alertes, 'fiche à vérifier', 'fiches à vérifier')}</b>` : ''}` : 'Une fiche par réalisation : contexte, mission, résultat chiffré, témoignage, mots-clés.'}</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvelle-ref">${ICONES.plus}Nouvelle référence</button></div></div>`;
    if (!tous.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune référence pour l'instant</h3><p>Commence par ta réalisation la plus parlante, celle dont tu peux chiffrer le résultat. Le modèle « ${esc(metier().nom)} » te propose types de mission, mots-clés et résultats à mesurer.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-ref">${ICONES.plus}Créer ma première référence</button></div></div></div>`;
    const liste = R.filtrer(tous, filtre, B);
    const types = [...new Set(tous.map((p) => p.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const secteurs = B.secteurs.filter((s) => tous.some((p) => p.client.secteur === s.id));
    const mots = R.motsCles(tous).slice(0, 14);
    const actif = Object.entries(filtre).some(([, v]) => v);
    const sel = (id, lib, options, val) => `<label class="champ petit-champ"><span>${lib}</span><select data-filtre="${id}"><option value="">Tous</option>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    const outils = `<div class="outils-refs">
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher : client, mission, résultat…" value="${esc(filtre.q)}"></label>
        <details class="bloc-filtres" ${estTel() && !actif && !filtresOuverts ? '' : 'open'}><summary>Filtres${actif ? ' actifs' : ''}</summary>
        <div class="rang-filtres">
          ${sel('secteur', 'Secteur', secteurs.map((s) => [s.id, s.nom]), filtre.secteur)}
          ${sel('type', 'Type de mission', types.map((t) => [t, t]), filtre.type)}
          ${sel('annee', 'Année', R.annees(tous).map((a) => [a, a]), filtre.annee)}
        </div>
        <div class="filtres" role="group" aria-label="Filtres rapides">
          <button class="filtre" data-action="filtre-bool" data-f="chiffre" aria-pressed="${filtre.chiffre}">Résultat chiffré</button>
          <button class="filtre" data-action="filtre-bool" data-f="temoignage" aria-pressed="${filtre.temoignage}">Avec témoignage</button>
          <button class="filtre" data-action="filtre-bool" data-f="aCompleter" aria-pressed="${filtre.aCompleter}">À compléter</button>
          ${actif ? '<button class="btn lien" data-action="filtres-raz">Effacer les filtres</button>' : ''}
        </div>
        ${mots.length ? `<div class="mots" role="group" aria-label="Mots-clés">${mots.map((m) => `<button class="mot" data-action="filtre-mot" data-mot="${esc(m.mot)}" aria-pressed="${R.cleTexte(filtre.motCle) === R.cleTexte(m.mot)}">${esc(m.mot)} <small>${m.n}</small></button>`).join('')}</div>` : ''}
        </details>
      </div>`;
    const carte = (p) => {
      const c = R.completude(p);
      const al = R.alertes(p).filter((a) => a.niveau === 'attention');
      const r = R.resultatsChiffres(p)[0] || p.resultats[0];
      return `<li class="carte-ref${p.avant ? ' avant' : ''}">
        <button class="cr-corps" data-action="ouvrir-ref" data-id="${p.id}" aria-label="${esc(p.titre || 'Référence sans titre')} : ouvrir la fiche">
          <span class="cr-visuel">${visuel(p, 'couv')}</span>
          <span class="cr-texte">
            <span class="cr-meta">${esc([p.type, R.periode(p)].filter(Boolean).join(' · '))}</span>
            <b>${esc(p.titre || 'Référence sans titre')}</b>
            <span class="cr-client">${esc(R.clientAffiche(p, B))}</span>
            ${r ? `<span class="cr-resultat"><strong>${esc(r.valeur)}</strong> ${esc(r.libelle)}</span>` : '<span class="cr-resultat vide">Pas encore de résultat chiffré</span>'}
            <span class="cr-pied">${etiquetteNiveau(c)}${al.length ? `<span class="etiquette rose">${pluriel(al.length, 'point à vérifier', 'points à vérifier')}</span>` : ''}${p.temoignage.texte.trim() && p.temoignage.accord ? '<span class="etiquette ciel">Témoignage</span>' : ''}</span>
          </span>
        </button>
        <button class="cr-etoile" data-action="avant" data-id="${p.id}" aria-pressed="${p.avant}" aria-label="${p.avant ? 'Retirer de la mise en avant' : 'Mettre en avant'}" title="${p.avant ? 'Mise en avant (plaquette par défaut)' : 'Mettre en avant'}">${p.avant ? ICONES.etoile : ICONES.etoileVide}</button>
      </li>`;
    };
    return `${tete}${outils}
      <p class="resume-liste">${liste.length === tous.length ? pluriel(tous.length, 'référence') : `${pluriel(liste.length, 'référence')} sur ${tous.length}`} · mises en avant d'abord, puis les plus récentes</p>
      ${liste.length ? `<ul class="grille-refs">${liste.map(carte).join('')}</ul>` : '<p class="aide">Aucune référence ne correspond à ces filtres.</p>'}`;
  }

  // Bloc de référence, commun à la fiche et à la plaquette. mode : 'ecran', 'double' (2 par page), 'pleine'.
  function blocReference(p, options = R.OPTIONS_DEFAUT, mode = 'ecran') {
    const lim = mode === 'double' ? { ctx: 330, mis: 480, tem: 260 } : { ctx: 1500, mis: 2000, tem: 800 };
    const meta = [R.periode(p), p.duree, R.montantVisible(p, options) ? p.montant : ''].filter(Boolean);
    const montrerVisuel = options.visuels !== false;
    const res = p.resultats.filter((r) => r.valeur || r.libelle);
    return `<article class="bloc-ref bloc-${mode}${montrerVisuel ? '' : ' sans-visuel'}">
      ${montrerVisuel ? `<figure class="br-visuel">${visuel(p, 'couv')}${p.visuel && p.legende ? `<figcaption>${esc(p.legende)}</figcaption>` : ''}</figure>` : ''}
      <div class="br-texte">
        <p class="br-type">${esc(p.type || 'Réalisation')}</p>
        <h3>${esc(p.titre || 'Référence sans titre')}</h3>
        <p class="br-client"><b>${esc(R.clientAffiche(p, B, options))}</b>${meta.length ? ` · ${esc(meta.join(' · '))}` : ''}</p>
        ${res.length ? `<ul class="br-resultats">${res.map((r) => `<li><strong>${esc(r.valeur)}</strong><span>${esc(r.libelle)}</span></li>`).join('')}</ul>` : ''}
        ${p.contexte.trim() ? `<h4>Contexte</h4><p>${esc(court(p.contexte, lim.ctx))}</p>` : ''}
        ${p.mission.trim() ? `<h4>Mission</h4><p>${esc(court(p.mission, lim.mis))}</p>` : ''}
        ${R.temoignageVisible(p, options) ? `<blockquote class="br-temoignage"><p>« ${esc(court(p.temoignage.texte, lim.tem))} »</p>${p.temoignage.auteur ? `<cite>${esc(p.temoignage.auteur)}</cite>` : ''}</blockquote>` : ''}
        ${p.motsCles.length ? `<p class="br-mots">${p.motsCles.map((m) => `<span>${esc(m)}</span>`).join('')}</p>` : ''}
      </div>
    </article>`;
  }

  // ---------- Références : fiche ----------
  function vueFicheRef(p) {
    const c = R.completude(p);
    const al = R.alertes(p);
    const dans = E.selections.filter((s) => s.projets.includes(p.id));
    const long = p.contexte.length > 330 || p.mission.length > 480;
    return `<div class="fil-fiche"><button class="btn lien" data-action="fermer-ref">‹ Toutes les références</button></div>
      <div class="vue-tete"><div><h1>${esc(p.titre || 'Référence sans titre')}</h1><p>${esc(R.clientAffiche(p, B))}${R.periode(p) ? ` · ${esc(R.periode(p))}` : ''}</p></div>
        <div class="actions"><button class="btn primaire" data-action="modifier-ref" data-id="${p.id}">Modifier</button><button class="btn" data-action="copier-ref" data-id="${p.id}">${ICONES.copier}Copier le texte</button><button class="btn" data-action="avant" data-id="${p.id}" aria-pressed="${p.avant}">${p.avant ? ICONES.etoile : ICONES.etoileVide}${p.avant ? 'Mise en avant' : 'Mettre en avant'}</button></div></div>
      <div class="colonnes-fiche">
        <div>${blocReference(p, R.OPTIONS_DEFAUT, 'ecran')}
          <p class="mention">Aperçu tel qu'il sera imprimé avec les options par défaut : nom du client seulement avec son accord, témoignage seulement avec l'accord de citation, montant masqué.${long ? ' Dans la plaquette (deux références par page), le contexte et la mission sont raccourcis ; le modèle « Fiches » les imprime en entier.' : ''}</p></div>
        <aside class="panneau">
          <section class="bloc-detail"><h3>Complétude</h3>
            <div class="jauge" role="img" aria-label="Complétude ${c.score} sur 100"><span style="width:${c.score}%" class="niv-${c.niveau}"></span></div>
            <p class="jauge-lib">${etiquetteNiveau(c)}</p>
            ${c.manques.length ? `<ul class="manques">${c.manques.map((m) => `<li><span>${esc(m.libelle)}</span><small>+${m.poids}</small></li>`).join('')}</ul>` : '<p class="aide">Rien ne manque : cette référence est prête à montrer.</p>'}
          </section>
          ${al.length ? `<section class="bloc-detail"><h3>À vérifier</h3><ul class="alertes-ref">${al.map((a) => `<li class="al-${a.niveau}">${esc(a.texte)}</li>`).join('')}</ul></section>` : ''}
          <section class="bloc-detail"><h3>Témoignage</h3>
            <p class="aide">${p.temoignage.texte.trim() ? (p.temoignage.accord ? 'Témoignage citable (accord noté).' : 'Témoignage saisi, accord de citation pas encore noté.') : 'Pas encore de témoignage. Le message ci-dessous pose cinq questions courtes au client.'}</p>
            <button class="btn petit" data-action="demande-temoignage" data-id="${p.id}">${ICONES.copier}Copier la demande de témoignage</button>
          </section>
          <section class="bloc-detail"><h3>Sélections</h3>${dans.length ? `<ul class="liste-simple">${dans.map((s) => `<li><button class="btn lien" data-action="ouvrir-sel" data-id="${s.id}">${esc(s.nom || 'Sélection sans nom')}</button></li>`).join('')}</ul>` : '<p class="aide">Dans aucune sélection pour l\'instant.</p>'}</section>
          <div class="rang"><button class="btn petit" data-action="dupliquer-ref" data-id="${p.id}">Dupliquer</button><button class="btn petit danger" data-action="suppr-ref" data-id="${p.id}">Supprimer</button></div>
        </aside>
      </div>`;
  }

  // ---------- Sélections ----------
  function vueSelections() {
    if (selOuverte && selection(selOuverte)) return vueSelection(selection(selOuverte));
    selOuverte = null;
    const tete = `<div class="vue-tete"><div><h1>Sélections</h1><p>Une sélection par prospect : ses critères, les références les plus proches de son projet, un mot d'introduction et la mise en page.</p></div>
      <div class="actions"><button class="btn primaire" data-action="nouvelle-sel">${ICONES.plus}Nouvelle sélection</button></div></div>`;
    if (!E.selections.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune sélection</h3><p>Crée une sélection pour ton prochain prospect : indique son secteur et ses mots-clés, les références les plus proches te sont proposées.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-sel">${ICONES.plus}Nouvelle sélection</button></div></div></div>`;
    const modele = (id) => B.modeles.find((m) => m.id === id)?.nom || '';
    return `${tete}<ul class="lignes-sel">${E.selections.map((s) => {
      const ps = R.projetsSelection(E, s);
      return `<li class="ligne-sel"><button class="lien-ligne" data-action="ouvrir-sel" data-id="${s.id}"><b>${esc(s.nom || 'Sélection sans nom')}</b><span>${esc([nomSecteur(s.secteur), s.type, s.motsCles.join(', ')].filter(Boolean).join(' · ') || 'Sans critère')}</span></button>
        <span class="ls-nb"><b>${ps.length}</b><small>${ps.length > 1 ? 'références' : 'référence'}</small></span>
        <span class="etiquette sable">${esc(modele(s.modele))}</span>
        <button class="btn petit" data-action="voir-plaquette" data-id="${s.id}">${ICONES.plaquette}Plaquette</button></li>`;
    }).join('')}</ul>`;
  }

  function vueSelection(s) {
    const ps = R.projetsSelection(E, s);
    const sugg = R.suggerer(E.projets, s, moisCourant(), s.projets);
    const m = metier();
    const types = [...new Set([...m.types, ...E.projets.map((p) => p.type).filter(Boolean)])];
    const opt = (k, lib, aide) => `<label class="case"><input type="checkbox" data-sel-opt="${k}" ${s.options[k] ? 'checked' : ''}><span>${lib}<small>${aide}</small></span></label>`;
    const ligneChoisie = (p, i) => `<li class="choisie"><span class="ch-num">${i + 1}</span><span class="ch-texte"><b>${esc(p.titre || 'Sans titre')}</b><small>${esc(R.clientAffiche(p, B, s.options))}</small></span>
      <span class="ch-actions"><button class="btn-icone" data-action="sel-monter" data-id="${p.id}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn-icone" data-action="sel-descendre" data-id="${p.id}" aria-label="Descendre" ${i === ps.length - 1 ? 'disabled' : ''}>↓</button><button class="btn-icone" data-action="sel-retirer" data-id="${p.id}" aria-label="Retirer de la sélection">×</button></span></li>`;
    const ligneSugg = ({ p, score, raisons }) => `<li class="suggestion"><span class="sg-score" aria-label="Pertinence ${score} sur 100"><span style="width:${score}%"></span></span>
      <span class="sg-texte"><b>${esc(p.titre || 'Sans titre')}</b><small>${esc(R.clientAffiche(p, B, s.options))}${raisons.length ? ` · ${esc(raisons.join(' · '))}` : ''}</small></span>
      <button class="btn petit" data-action="sel-ajouter" data-id="${p.id}">${ICONES.plus}Ajouter</button></li>`;
    return `<div class="fil-fiche"><button class="btn lien" data-action="fermer-sel">‹ Toutes les sélections</button></div>
      <div class="vue-tete"><div><h1>${esc(s.nom || 'Sélection sans nom')}</h1><p>${pluriel(ps.length, 'référence choisie', 'références choisies')} · mise en page « ${esc(B.modeles.find((x) => x.id === s.modele)?.nom)} »</p></div>
        <div class="actions"><button class="btn primaire" data-action="voir-plaquette" data-id="${s.id}">${ICONES.plaquette}Voir la plaquette</button><button class="btn" data-action="copier-sel" data-id="${s.id}">${ICONES.copier}Texte pour un e-mail</button></div></div>
      <div class="colonnes-sel">
        <section class="bloc-detail">
          <h3>Le prospect</h3>
          <label class="champ">Prospect ou projet <small>Visible en tête de la plaquette.</small><input data-sel="nom" maxlength="80" value="${esc(s.nom)}" placeholder="Ex. : Exemple Industrie · refonte des processus"></label>
          <div class="rang-champs">
            <label class="champ">Son secteur<select data-sel="secteur"><option value="">—</option>${B.secteurs.map((x) => `<option value="${x.id}" ${x.id === s.secteur ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
            <label class="champ">Type de mission<select data-sel="type"><option value="">—</option>${types.map((t) => `<option ${t === s.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          </div>
          <label class="champ">Mots-clés de son projet <small>Séparés par des virgules : ils orientent les suggestions.</small><input data-sel="motsCles" maxlength="300" value="${esc(s.motsCles.join(', '))}" placeholder="Ex. : processus, outils numériques"></label>
          <label class="champ">Mot d'introduction <small>En tête de la plaquette et du texte pour un e-mail.</small><textarea data-sel="intro" rows="4" maxlength="1200" placeholder="Comme convenu, voici trois réalisations proches de votre projet…">${esc(s.intro)}</textarea></label>
          <fieldset class="champ"><legend>Mise en page</legend><div class="choix-statut trois">${B.modeles.map((x) => `<label title="${esc(x.detail)}"><input type="radio" name="modele" data-sel-modele value="${x.id}" ${x.id === s.modele ? 'checked' : ''}><span>${esc(x.nom)}</span></label>`).join('')}</div><small class="aide">${esc(B.modeles.find((x) => x.id === s.modele)?.detail)}</small></fieldset>
          <fieldset class="champ options-sel"><legend>Afficher</legend>
            ${opt('nomsClients', 'Noms des clients', 'Seulement ceux dont l\'accord est noté ; les autres restent décrits.')}
            ${opt('temoignages', 'Témoignages', 'Seulement ceux dont l\'accord de citation est noté.')}
            ${opt('montants', 'Montants', 'Seulement ceux marqués « afficher » dans la fiche.')}
            ${opt('visuels', 'Visuels', 'Photo ou illustration géométrique de chaque référence.')}
          </fieldset>
          <button class="btn petit danger" data-action="suppr-sel" data-id="${s.id}">Supprimer la sélection</button>
        </section>
        <div>
          <section class="bloc-detail"><h3>Références choisies <span>${ps.length}</span></h3>
            ${ps.length ? `<ol class="choisies">${ps.map(ligneChoisie).join('')}</ol>` : '<p class="aide">Ajoute des références depuis les suggestions : trois à cinq suffisent souvent.</p>'}
          </section>
          <section class="bloc-detail"><h3>Suggestions <span>par pertinence</span></h3>
            <p class="aide">Secteur identique, mots-clés communs, même type de mission, résultat chiffré, témoignage et récence comptent.</p>
            ${sugg.length ? `<ul class="suggestions">${sugg.map(ligneSugg).join('')}</ul>` : '<p class="aide">Toutes tes références sont déjà dans la sélection.</p>'}
          </section>
        </div>
      </div>`;
  }

  // ---------- Plaquette ----------
  function selectionAffichee() {
    const s = selPlaquette && selection(selPlaquette);
    if (s) return s;
    selPlaquette = '';
    return { ...R.selectionParDefaut(E), modele: modeleParDefaut };
  }

  function vuePlaquette() {
    const s = selectionAffichee();
    const ps = R.projetsSelection(E, s);
    const tete = `<div class="vue-tete ecran-seul"><div><h1>Plaquette</h1><p>Aperçu A4. « Imprimer » ouvre la fenêtre d'impression du navigateur : choisis « Enregistrer au format PDF » pour l'envoyer.</p></div>
      <div class="actions"><button class="btn primaire" data-action="imprimer" ${E.projets.length ? '' : 'disabled'}>${ICONES.imprimer}Imprimer ou PDF</button><button class="btn" data-action="copier-sel-plaquette">${ICONES.copier}Texte</button></div></div>`;
    const choix = `<div class="outils-plaquette ecran-seul">
        <label class="champ petit-champ"><span>Sélection</span><select id="choix-sel"><option value="">Mes références mises en avant</option>${E.selections.map((x) => `<option value="${x.id}" ${x.id === selPlaquette ? 'selected' : ''}>${esc(x.nom || 'Sélection sans nom')}</option>`).join('')}</select></label>
        <div class="filtres" role="group" aria-label="Mise en page">${B.modeles.map((x) => `<button class="filtre" data-action="modele" data-modele="${x.id}" aria-pressed="${s.modele === x.id}">${esc(x.nom)}</button>`).join('')}</div>
        ${selPlaquette ? `<button class="btn lien" data-action="ouvrir-sel" data-id="${s.id}">Modifier la sélection</button>` : `<span class="mention">${E.projets.some((p) => p.avant) ? 'Références marquées d\'une étoile.' : 'Aucune référence mise en avant : les six plus récentes.'}</span>`}
      </div>`;
    if (!E.projets.length) return `${tete}<div class="vide-etat">${FORME_VIDE}<div><h3>Rien à mettre en page</h3><p>Ajoute d'abord tes références : la plaquette se compose ensuite toute seule.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-ref">${ICONES.plus}Nouvelle référence</button></div></div></div>`;
    const pages = R.pagesPlaquette(ps.map((p) => p.id), s.modele);
    const a = accent(E.profil.accent);
    const total = pages.length;
    const pied = (i) => `<footer class="pg-pied"><span>${esc(E.profil.nom || 'Références')}${s.nom ? ` · ${esc(s.nom)}` : ''}</span><span>${i + 1} / ${total}</span></footer>`;
    const html = pages.map((pg, i) => {
      if (pg.type === 'couverture') return pageCouverture(s, ps, pied(i));
      if (pg.type === 'refs') return `<section class="page page-refs">${pg.refs.map((id) => blocReference(projet(id), s.options, 'double')).join('<hr class="pg-sep">')}${pied(i)}</section>`;
      if (pg.type === 'fiche') return `<section class="page page-fiche">${pg.premiere ? enteteSelection(s) : ''}${pg.refs.length ? blocReference(projet(pg.refs[0]), s.options, 'pleine') : '<p class="pg-vide">Aucune référence dans cette sélection.</p>'}${pied(i)}</section>`;
      return `<section class="page page-liste">${pg.premiere ? enteteSelection(s) : ''}${tableauListe(pg.refs.map(projet), s.options)}${pied(i)}</section>`;
    }).join('');
    return `${tete}${choix}
      <p class="resume-liste ecran-seul">${pluriel(ps.length, 'référence')} · ${pluriel(total, 'page')} A4${ps.length ? '' : ' · ajoute des références à la sélection'}</p>
      <div class="apercu-cadre"><div class="apercu" style="--acc:${a.couleur};--acc-teinte:${a.teinte};--acc-texte:${a.texte}">${html}</div></div>`;
  }

  function enteteSelection(s) {
    const pr = E.profil;
    return `<header class="pg-entete"><div><p class="pg-surtitre">${esc(pr.nom || 'Références')}${pr.accroche ? ` · ${esc(pr.accroche)}` : ''}</p>
      <h2>${s.nom ? `Références pour ${esc(s.nom)}` : 'Références'}</h2>${s.intro.trim() ? `<p class="pg-intro">${esc(court(s.intro, 700))}</p>` : ''}</div><span class="pg-forme" aria-hidden="true"></span></header>`;
  }

  function pageCouverture(s, ps, pied) {
    const pr = E.profil;
    const chiffres = pr.chiffres.filter((c) => c.valeur);
    return `<section class="page page-couverture">
      <div class="pc-formes" aria-hidden="true"><span class="f1"></span><span class="f2"></span><span class="f3"></span></div>
      <div class="pc-titre"><p class="pg-surtitre">${s.nom ? 'Références sélectionnées' : 'Références et réalisations'}</p>
        <h1>${esc(pr.nom || 'Mes références')}</h1>${pr.accroche ? `<p class="pc-accroche">${esc(pr.accroche)}</p>` : ''}</div>
      ${s.nom ? `<div class="pc-pour"><span>Préparée pour</span><b>${esc(s.nom)}</b>${s.intro.trim() ? `<p>${esc(court(s.intro, 520))}</p>` : ''}</div>` : ''}
      ${pr.presentation.trim() ? `<p class="pc-presentation">${esc(court(pr.presentation, s.intro.trim() && s.nom ? 380 : 700))}</p>` : ''}
      ${chiffres.length ? `<ul class="pc-chiffres">${chiffres.map((c) => `<li><strong>${esc(c.valeur)}</strong><span>${esc(c.libelle)}</span></li>`).join('')}</ul>` : ''}
      ${ps.length ? `<div class="pc-sommaire"><h2>Dans ce document</h2><ol>${ps.slice(0, 8).map((p) => `<li><b>${esc(p.titre || 'Sans titre')}</b><span>${esc(R.clientAffiche(p, B, s.options))}</span></li>`).join('')}${ps.length > 8 ? `<li><span>et ${ps.length - 8} autres références</span></li>` : ''}</ol></div>` : ''}
      ${pr.coordonnees.trim() || pr.zone.trim() ? `<div class="pc-contact">${pr.zone.trim() ? `<p><b>Intervention</b> ${esc(pr.zone)}</p>` : ''}${pr.coordonnees.trim() ? `<p><b>Contact</b> ${esc(pr.coordonnees)}</p>` : ''}</div>` : ''}
      ${pied}
    </section>`;
  }

  function tableauListe(ps, options) {
    if (!ps.length) return '<p class="pg-vide">Aucune référence dans cette sélection.</p>';
    return `<table class="pg-tableau"><thead><tr><th>Réalisation</th><th>Client</th><th>Résultat</th><th>Année</th></tr></thead><tbody>${ps.map((p) => {
      const r = R.resultatsChiffres(p)[0] || p.resultats[0];
      return `<tr><td><b>${esc(p.titre || 'Sans titre')}</b><small>${esc(p.type)}</small></td><td>${esc(R.clientAffiche(p, B, options))}</td><td>${r ? `<strong>${esc(r.valeur)}</strong> ${esc(r.libelle)}` : '–'}</td><td>${esc(R.annee(p) || '–')}</td></tr>`;
    }).join('')}</tbody></table>`;
  }

  // Échelle de l'aperçu A4 à l'écran (la page fait 210 mm ; sur téléphone elle est réduite pour tenir).
  function ajusterApercu() {
    const cadre = $('.apercu-cadre'), ap = $('.apercu');
    if (!cadre || !ap) return;
    const largeur = cadre.clientWidth;
    const z = Math.min(1, (largeur - 2) / 800);
    ap.style.zoom = z < 1 ? String(Math.floor(z * 1000) / 1000) : '';
  }

  // ---------- Profil ----------
  function vueProfil() {
    const pr = E.profil;
    const ch = [...pr.chiffres, ...Array(4).fill({ valeur: '', libelle: '' })].slice(0, 4);
    return `<div class="vue-tete"><div><h1>Profil</h1><p>Ce qui figure sur la couverture de la plaquette. Chaque champ s'enregistre dès que tu le quittes.</p></div>
        <div class="actions"><button class="btn" data-action="voir-plaquette" data-id="">${ICONES.plaquette}Voir la plaquette</button></div></div>
      <div class="colonnes-profil">
        <section class="bloc-detail">
          <h3>Ton activité</h3>
          <div class="rang-champs">
            <label class="champ">Nom affiché<input data-profil="nom" maxlength="80" value="${esc(pr.nom)}"></label>
            <label class="champ">Métier <small>Modèle de fiches proposé.</small><select data-profil="metier">${B.metiers.map((x) => `<option value="${x.id}" ${x.id === pr.metier ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
          </div>
          <label class="champ">Accroche<input data-profil="accroche" maxlength="160" value="${esc(pr.accroche)}" placeholder="Ce que tu fais, pour qui, en une ligne"></label>
          <label class="champ">Présentation <small>Trois à cinq lignes : ton parcours, ta façon de travailler.</small><textarea data-profil="presentation" rows="5" maxlength="900">${esc(pr.presentation)}</textarea></label>
          <label class="champ">Zone d'intervention<input data-profil="zone" maxlength="120" value="${esc(pr.zone)}" placeholder="Ex. : Lyon et 50 km autour, à distance partout"></label>
          <label class="champ">Coordonnées <small>Imprimées en bas de la couverture : e-mail professionnel, site, téléphone de l'activité.</small><textarea data-profil="coordonnees" rows="2" maxlength="400">${esc(pr.coordonnees)}</textarea></label>
        </section>
        <div>
          <section class="bloc-detail"><h3>Chiffres clés <span>4 au plus</span></h3>
            <p class="aide">Tes propres chiffres, vérifiables : années d'expérience, missions menées, clients accompagnés, note moyenne… Laisse vide pour ne rien afficher.</p>
            <div class="lignes-chiffres">${ch.map((c, i) => `<div class="rang-champs"><label class="champ" style="flex:0 1 120px">Valeur<input data-chiffre="${i}" data-c="valeur" maxlength="16" value="${esc(c.valeur)}" placeholder="Ex. : 45"></label><label class="champ">Libellé<input data-chiffre="${i}" data-c="libelle" maxlength="60" value="${esc(c.libelle)}" placeholder="Ex. : missions menées"></label></div>`).join('')}</div>
          </section>
          <section class="bloc-detail"><h3>Couleur de la plaquette</h3>
            <div class="choix-accent">${B.accents.map((x) => `<label><input type="radio" name="accent" data-accent value="${x.id}" ${x.id === pr.accent ? 'checked' : ''}><span style="--a:${x.couleur};--t:${x.teinte}"><i></i>${esc(x.nom)}</span></label>`).join('')}</div>
          </section>
          <section class="bloc-detail"><h3>Modèle « ${esc(metier().nom)} »</h3>
            <p class="aide">Types de mission proposés : ${esc(metier().types.join(', '))}.</p>
            <p class="aide">Résultats à mesurer : ${esc(metier().resultats.join(', '))}.</p>
          </section>
        </div>
      </div>`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, classe = '') {
    const d = modale();
    d.className = `modale ${classe}`.trim();
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
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea')?.focus();
  }

  // Réduit une image dans le navigateur (JPEG, 960 px de large au plus) jusqu'à passer sous la limite.
  async function reduireImage(fichier) {
    const url = URL.createObjectURL(fichier);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
      let l = Math.min(960, img.naturalWidth || 960), q = 0.8, d = '';
      for (let essai = 0; essai < 6; essai++) {
        const h = Math.max(1, Math.round((img.naturalHeight || l) * l / (img.naturalWidth || l)));
        const c = document.createElement('canvas'); c.width = l; c.height = h;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, l, h); x.drawImage(img, 0, 0, l, h);
        d = c.toDataURL('image/jpeg', q);
        if (R.octetsDataUrl(d) <= R.MAX_VISUEL) return d;
        l = Math.round(l * 0.8); q = Math.max(0.6, q - 0.05);
      }
      return d;
    } finally { URL.revokeObjectURL(url); }
  }

  // Création (id absent) ou modification d'une référence.
  function modaleReference(id) {
    const ancien = id ? projet(id) : null;
    if (id && !ancien) return;
    const m = metier();
    const p = ancien ? structuredClone(ancien) : R.normaliserProjet({ type: m.types[0], debut: moisCourant() });
    let visuelTemp = p.visuel;
    const res = [...p.resultats, ...Array(R.MAX_RESULTATS).fill({ valeur: '', libelle: '' })].slice(0, R.MAX_RESULTATS);
    const types = [...new Set([...m.types, ...E.projets.map((x) => x.type).filter(Boolean)])];
    const motsSugg = [...new Set([...R.motsCles(E.projets).map((x) => x.mot), ...m.motsCles])].slice(0, 18);
    const q = m.questions;
    const corps = `
      <label class="champ">Titre <small>Le résultat obtenu, plutôt que le nom de la prestation.</small><input name="titre" maxlength="120" required value="${esc(p.titre)}" placeholder="Ex. : Délai de devis divisé par trois"></label>
      <div class="rang-champs">
        <label class="champ">Type de mission<input name="type" maxlength="60" list="types-mission" value="${esc(p.type)}"><datalist id="types-mission">${types.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
        <label class="champ" style="flex:0 1 150px">Début<input name="debut" type="month" value="${esc(p.debut)}"></label>
        <label class="champ" style="flex:0 1 150px">Fin <small>Vide si en cours</small><input name="fin" type="month" value="${esc(p.fin)}"></label>
        <label class="champ" style="flex:0 1 150px">Durée<input name="duree" maxlength="40" value="${esc(p.duree)}" placeholder="Ex. : 3 mois"></label>
      </div>
      <fieldset class="cadre-champs"><legend>Client</legend>
        <div class="rang-champs">
          <label class="champ">Secteur<select name="secteur"><option value="">—</option>${B.secteurs.map((s) => `<option value="${s.id}" ${s.id === p.client.secteur ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
          <label class="champ">Taille<select name="taille"><option value="">—</option>${B.tailles.map((s) => `<option value="${s.id}" ${s.id === p.client.taille ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
          <label class="champ">Région ou ville<input name="region" maxlength="60" value="${esc(p.client.region)}"></label>
        </div>
        <div class="rang-champs">
          <label class="champ">Nom du client <small>Facultatif. Imprimé seulement si son accord est noté.</small><input name="clientNom" maxlength="80" value="${esc(p.client.nom)}"></label>
          <label class="case case-accord"><input type="checkbox" name="clientAccord" ${p.client.accord ? 'checked' : ''}><span>Le client a donné son accord écrit pour être cité</span></label>
        </div>
        <p class="aide">Sans accord, la plaquette le décrit ainsi : <b id="apercu-client">${esc(R.descriptionClient(p.client, B))}</b>. Exemples de formulations : ${esc(B.anonymisation.slice(0, 3).join(' ; '))}.</p>
      </fieldset>
      <label class="champ">Contexte <small>${esc(q.contexte)}</small><textarea name="contexte" rows="3" maxlength="1500">${esc(p.contexte)}</textarea></label>
      <label class="champ">Mission <small>${esc(q.mission)} Verbes utiles : ${esc(B.verbes.slice(0, 8).join(', '))}…</small><textarea name="mission" rows="4" maxlength="2000">${esc(p.mission)}</textarea></label>
      <fieldset class="cadre-champs"><legend>Résultats chiffrés <small>${esc(q.resultat)}</small></legend>
        <datalist id="libelles-resultats">${m.resultats.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>
        ${res.map((r, i) => `<div class="rang-champs ligne-resultat"><label class="champ" style="flex:0 1 130px">Valeur ${i + 1}<input name="rv${i}" maxlength="24" value="${esc(r.valeur)}" placeholder="${i === 0 ? 'Ex. : −30 %' : ''}"></label><label class="champ">Ce que mesure ce chiffre<input name="rl${i}" maxlength="80" list="libelles-resultats" value="${esc(r.libelle)}" placeholder="${i === 0 ? `Ex. : ${esc(m.resultats[0])}` : ''}"></label></div>`).join('')}
        <p class="aide">Uniquement des chiffres mesurés et vérifiables, ceux que le client pourrait confirmer.</p>
      </fieldset>
      <fieldset class="cadre-champs"><legend>Témoignage</legend>
        <label class="champ">Texte<textarea name="temTexte" rows="3" maxlength="800">${esc(p.temoignage.texte)}</textarea></label>
        <div class="rang-champs">
          <label class="champ">Auteur <small>Fonction, et nom seulement avec son accord.</small><input name="temAuteur" maxlength="100" value="${esc(p.temoignage.auteur)}" placeholder="Ex. : Gérante, entreprise de 12 salariés"></label>
          <label class="case case-accord"><input type="checkbox" name="temAccord" ${p.temoignage.accord ? 'checked' : ''}><span>Accord de citation obtenu</span></label>
        </div>
      </fieldset>
      <label class="champ">Mots-clés <small>Séparés par des virgules : ils servent aux filtres et aux suggestions.</small><input name="motsCles" id="champ-mots" maxlength="400" value="${esc(p.motsCles.join(', '))}"></label>
      <div class="mots mots-sugg" role="group" aria-label="Mots-clés proposés">${motsSugg.map((x) => `<button type="button" class="mot" data-ajout-mot="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>
      <fieldset class="cadre-champs"><legend>Visuel <small>Facultatif : photo ou capture dont tu détiens les droits, réduite automatiquement. ${R.MAX_VISUELS} visuels au plus.</small></legend>
        <div class="zone-visuel"><div id="apercu-visuel" class="apercu-visuel">${visuel(p, 'couv')}</div>
          <div class="zv-actions"><label class="btn petit" style="cursor:pointer">Choisir une image<input type="file" accept="image/jpeg,image/png,image/webp" id="fichier-visuel" hidden></label><button type="button" class="btn petit" id="retirer-visuel" ${p.visuel ? '' : 'hidden'}>Retirer</button>
          <label class="champ">Légende<input name="legende" maxlength="120" value="${esc(p.legende)}"></label>
          <p class="aide" id="info-visuel">${p.visuel ? `${Math.round(R.octetsDataUrl(p.visuel) / 1000)} Ko` : 'Sans visuel : illustration géométrique générée.'}</p></div></div>
      </fieldset>
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 200px">Montant <small>Facultatif</small><input name="montant" maxlength="40" value="${esc(p.montant)}" placeholder="Ex. : 12 000 € HT"></label>
        <label class="case case-accord"><input type="checkbox" name="afficherMontant" ${p.afficherMontant ? 'checked' : ''}><span>Afficher le montant (si la sélection l'autorise)</span></label>
        <label class="case case-accord"><input type="checkbox" name="avant" ${p.avant ? 'checked' : ''}><span>Mettre en avant</span></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    const pied = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(ancien ? 'Modifier la référence' : 'Nouvelle référence', corps, pied, (fd) => {
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Donne un titre à la référence.';
      const debut = String(fd.get('debut') || ''), fin = String(fd.get('fin') || '');
      if (debut && fin && fin < debut) return 'La fin est avant le début.';
      const brut = {
        ...p,
        titre, type: fd.get('type'), debut, fin, duree: fd.get('duree'),
        client: { nom: fd.get('clientNom'), accord: fd.get('clientAccord') === 'on', secteur: fd.get('secteur'), taille: fd.get('taille'), region: fd.get('region') },
        contexte: fd.get('contexte'), mission: fd.get('mission'),
        resultats: Array.from({ length: R.MAX_RESULTATS }, (_, i) => ({ valeur: fd.get(`rv${i}`), libelle: fd.get(`rl${i}`) })),
        temoignage: { texte: fd.get('temTexte'), auteur: fd.get('temAuteur'), accord: fd.get('temAccord') === 'on' },
        motsCles: fd.get('motsCles'), montant: fd.get('montant'), afficherMontant: fd.get('afficherMontant') === 'on', avant: fd.get('avant') === 'on',
        visuel: visuelTemp, legende: fd.get('legende'), creeLe: p.creeLe || aujIso(),
      };
      if (visuelTemp && visuelTemp !== (ancien?.visuel || '')) {
        const refus = R.refusVisuel(E, p.id, visuelTemp);
        if (refus) return refus;
      }
      const n = R.normaliserProjet(brut);
      retenir();
      if (ancien) E.projets[E.projets.findIndex((x) => x.id === p.id)] = n; else E.projets.push(n);
      detail = n.id;
      sauver(); rendre();
      const al = R.alertes(n).filter((a) => a.niveau === 'attention');
      toast(al.length ? `Référence enregistrée. À vérifier : ${al[0].texte}` : 'Référence enregistrée.', { libelle: 'Annuler', faire: annuler });
    }, 'modale-large');
    const d = modale();
    const majClient = () => { const el = $('#apercu-client'); if (el) el.textContent = R.descriptionClient({ secteur: d.querySelector('[name=secteur]').value, taille: d.querySelector('[name=taille]').value, region: d.querySelector('[name=region]').value }, B); };
    ['secteur', 'taille', 'region'].forEach((n) => d.querySelector(`[name=${n}]`).addEventListener('input', majClient));
    d.querySelectorAll('[data-ajout-mot]').forEach((b) => b.addEventListener('click', () => {
      const champ = $('#champ-mots');
      champ.value = R.lireMotsCles(`${champ.value},${b.dataset.ajoutMot}`).join(', ');
      b.disabled = true;
    }));
    const apercuVisuel = () => {
      $('#apercu-visuel').innerHTML = visuel({ ...p, visuel: visuelTemp }, 'couv');
      $('#retirer-visuel').hidden = !visuelTemp;
      $('#info-visuel').textContent = visuelTemp ? `${Math.round(R.octetsDataUrl(visuelTemp) / 1000)} Ko après réduction` : 'Sans visuel : illustration géométrique générée.';
    };
    $('#fichier-visuel').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      $('#info-visuel').textContent = 'Réduction de l\'image…';
      try {
        const data = await reduireImage(f);
        const refus = R.refusVisuel(E, p.id, data);
        if (refus) { $('#info-visuel').textContent = refus; return; }
        visuelTemp = data; apercuVisuel();
      } catch { $('#info-visuel').textContent = 'Image illisible : essaie un fichier JPEG ou PNG.'; }
    });
    $('#retirer-visuel').addEventListener('click', () => { visuelTemp = ''; apercuVisuel(); });
  }

  function supprimerReference(id) {
    const p = projet(id);
    if (!p) return;
    retenir();
    E.projets = E.projets.filter((x) => x.id !== id);
    for (const s of E.selections) s.projets = s.projets.filter((x) => x !== id);
    detail = null;
    sauver(); rendre();
    toast(`Référence supprimée : ${p.titre || 'sans titre'}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleNouvelleSelection() {
    const corps = `<label class="champ">Prospect ou projet<input name="nom" maxlength="80" required placeholder="Ex. : Exemple Industrie · refonte des processus"></label>
      <div class="rang-champs">
        <label class="champ">Son secteur<select name="secteur"><option value="">—</option>${B.secteurs.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Mise en page<select name="modele">${B.modeles.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Mots-clés de son projet<input name="motsCles" maxlength="300" placeholder="Séparés par des virgules"></label>
      <label class="case"><input type="checkbox" name="auto" checked><span>Ajouter tout de suite les 3 références les plus pertinentes</span></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle sélection', corps, '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la sélection (le prospect ou son projet).';
      const s = R.normaliserSelection({ nom, secteur: fd.get('secteur'), modele: fd.get('modele'), motsCles: fd.get('motsCles'), creeLe: aujIso() });
      if (fd.get('auto') === 'on') s.projets = R.suggerer(E.projets, s, moisCourant()).filter((x) => x.score > 0).slice(0, 3).map((x) => x.p.id);
      retenir();
      E.selections.unshift(s);
      selOuverte = s.id;
      sauver();
      changerVue('selections');
      toast(s.projets.length ? `Sélection créée avec ${pluriel(s.projets.length, 'référence suggérée', 'références suggérées')}.` : 'Sélection créée : ajoute des références depuis les suggestions.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const taille = R.tailleEtat(E);
    const corps = `
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte tes références en tableur (CSV, point-virgule). La plaquette s'imprime ou s'enregistre en PDF depuis l'onglet Plaquette.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Références (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes références sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur (visuels compris).'} Espace utilisé : ${Math.round(taille / 1000)} Ko sur ${Math.round(R.MAX_ETAT / 1000)} Ko · ${R.nbVisuels(E)} visuel${R.nbVisuels(E) > 1 ? 's' : ''} sur ${R.MAX_VISUELS}.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du kit, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application et montrer une référence en rendez-vous.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Modèles de fiches de ${B.metiers.length} métiers, trame et mises en page rédigées pour QME. Aucune connexion à un réseau social, une messagerie ou un autre logiciel : rien n'est envoyé, la plaquette s'imprime et les textes se copient. Bonne pratique : demande l'accord écrit du client avant de citer son nom, son logo ou ses propos, et n'utilise que des visuels dont tu détiens les droits.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Fermer</button>', () => {});
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.projets)) throw new Error();
        if (!confirm(`Remplacer tes références actuelles par cette copie (${pluriel(d.projets.length, 'référence')}, ${pluriel((d.selections || []).length, 'sélection')}) ?`)) return;
        const vu = E.tutorielVu;
        E = normaliser(d); delete E.majLe; E.tutorielVu = vu || E.tutorielVu;
        detail = null; selOuverte = null; selPlaquette = '';
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du kit de références.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `references-${aujIso()}.json`);

  async function copier(texte, message) {
    try { await navigator.clipboard.writeText(texte); toast(message); return; } catch { /* repli ci-dessous */ }
    const t = document.createElement('textarea');
    t.value = texte; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    if (ok) toast(message);
    else ouvrirModale('Texte à copier', `<label class="champ"><span class="sr-only">Texte</span><textarea rows="12" readonly>${esc(texte)}</textarea></label>`, '<button class="btn primaire" value="ok">Fermer</button>', () => {});
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const N = R.NIVEAUX;
    const modeles = B.modeles.map((m) => m.nom.toLowerCase());
    const blocs = [
      ['rose', 'Une fiche par réalisation', `Dans <b>Références</b>, chaque fiche décrit le client, le contexte, ta mission, un résultat chiffré et, si tu l'as, un témoignage. Un score sur 100 la classe <b>${esc(N.pret)}</b> (80 et plus), <b>${esc(N.correct)}</b> (50 et plus) ou <b>${esc(N.brouillon)}</b>, avec la liste de ce qui manque. La mission et le résultat chiffré pèsent le plus.`],
      ['beurre', 'L\'accord du client d\'abord', `Le nom d'un client n'est imprimé que si son accord est noté&nbsp;; sinon, il est décrit par son secteur et sa taille. Un témoignage sans accord de citation n'est pas imprimé. Une adresse e-mail ou un numéro de téléphone dans une fiche est signalé.`],
      ['ciel', 'Une sélection par prospect', `Dans <b>Sélections</b>, indique le secteur du prospect, le type de mission et les mots-clés de son projet&nbsp;: tes références sont proposées par pertinence (même secteur, mots-clés communs, résultat chiffré, témoignage, récence). Choisis-en trois à cinq et ajoute un mot d'introduction.`],
      ['sable', 'La plaquette', `<b>Plaquette</b> met la sélection en page au format A4&nbsp;: ${modeles.slice(0, -1).join(', ')} ou ${modeles.at(-1)}. <b>Imprimer ou PDF</b> ouvre l'impression du navigateur&nbsp;: choisis «&nbsp;Enregistrer au format PDF&nbsp;» pour l'envoyer. Sans sélection, elle reprend tes références marquées d'une étoile.`],
    ];
    const corps = `
      <p>Le kit range tes réalisations en fiches et les met en page pour chaque prospect. Ton rôle&nbsp;: remplir une fiche par projet, puis composer une sélection quand un prospect se présente.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Profil</b> règle ce qui figure sur la couverture (nom, accroche, chiffres clés, couleur) et ton métier, qui propose types de mission et résultats à mesurer. Rien n'est envoyé à personne. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes références sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.projets.length;
    const pied = premier
      ? '<button class="btn primaire" value="ref">Ajouter ma première référence</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'ref') setTimeout(() => modaleReference(null), 0); });
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

  // ---------- Écouteurs propres à chaque vue ----------
  function brancherVue() {
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    $('.bloc-filtres')?.addEventListener('toggle', (e) => { if (estTel()) filtresOuverts = e.target.open; });
    document.querySelectorAll('[data-filtre]').forEach((el) => el.addEventListener('change', () => { filtre[el.dataset.filtre] = el.value; rendre(); }));
    // Sélection ouverte : champs enregistrés à la sortie du champ, suggestions recalculées.
    const s = selOuverte && selection(selOuverte);
    if (s && vue === 'selections') {
      document.querySelectorAll('[data-sel]').forEach((el) => el.addEventListener('change', () => {
        const k = el.dataset.sel;
        retenir();
        s[k] = k === 'motsCles' ? R.lireMotsCles(el.value) : el.value.slice(0, k === 'intro' ? 1200 : 80);
        sauver();
        if (['secteur', 'type', 'motsCles', 'nom'].includes(k)) rendre();
      }));
      document.querySelectorAll('[data-sel-modele]').forEach((el) => el.addEventListener('change', () => { retenir(); s.modele = el.value; sauver(); rendre(); }));
      document.querySelectorAll('[data-sel-opt]').forEach((el) => el.addEventListener('change', () => { retenir(); s.options[el.dataset.selOpt] = el.checked; sauver(); rendre(); }));
    }
    $('#choix-sel')?.addEventListener('change', (e) => { selPlaquette = e.target.value; rendre(); });
    if (vue === 'profil') {
      const pr = E.profil;
      document.querySelectorAll('[data-profil]').forEach((el) => el.addEventListener('change', () => {
        retenir();
        pr[el.dataset.profil] = el.value;
        E.profil = R.normaliserProfil(pr);
        sauver();
        if (el.dataset.profil === 'metier') rendre();
      }));
      document.querySelectorAll('[data-chiffre]').forEach((el) => el.addEventListener('change', () => {
        const ch = [...document.querySelectorAll('[data-chiffre][data-c=valeur]')].map((v) => ({ valeur: v.value, libelle: document.querySelector(`[data-chiffre="${v.dataset.chiffre}"][data-c=libelle]`).value }));
        retenir();
        E.profil = R.normaliserProfil({ ...E.profil, chiffres: ch });
        sauver();
      }));
      document.querySelectorAll('[data-accent]').forEach((el) => el.addEventListener('change', () => { retenir(); E.profil.accent = el.value; sauver(); toast(`Couleur de la plaquette : ${accent(el.value).nom.toLowerCase()}.`); }));
    }
  }

  // ---------- Actions ----------
  function selDe(el) { return selection(el.dataset.selId || selOuverte); }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; detail = null; selOuverte = null; selPlaquette = ''; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(el.dataset.vide === '1'); break;
      case 'vue': if (modale().open) modale().close(); if (el.dataset.vue === vue) { detail = null; selOuverte = null; } changerVue(el.dataset.vue); break;
      case 'nouvelle-ref': modaleReference(null); break;
      case 'ouvrir-ref': detail = id; changerVue('references'); break;
      case 'fermer-ref': detail = null; rendre(); window.scrollTo({ top: 0 }); break;
      case 'modifier-ref': modaleReference(id); break;
      case 'dupliquer-ref': { const p = projet(id); if (!p) break; retenir(); const c = R.dupliquer(p); E.projets.push(c); detail = c.id; sauver(); rendre(); window.scrollTo({ top: 0 }); toast('Référence dupliquée : modifie la copie.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'suppr-ref': if (confirm('Supprimer cette référence ? Elle sera aussi retirée des sélections.')) supprimerReference(id); break;
      case 'avant': { const p = projet(id); if (!p) break; retenir(); p.avant = !p.avant; sauver(); rendre(); toast(p.avant ? 'Mise en avant : elle figure dans la plaquette par défaut.' : 'Retirée de la mise en avant.'); break; }
      case 'copier-ref': { const p = projet(id); if (p) copier(R.texteReference(p, B), 'Texte de la référence copié.'); break; }
      case 'demande-temoignage': { const p = projet(id); if (p) copier(R.texteDemandeTemoignage(p, B), 'Demande de témoignage copiée : colle-la dans ton e-mail.'); break; }
      case 'filtre-bool': filtre[el.dataset.f] = !filtre[el.dataset.f]; rendre(); break;
      case 'filtre-mot': filtre.motCle = R.cleTexte(filtre.motCle) === R.cleTexte(el.dataset.mot) ? '' : el.dataset.mot; rendre(); break;
      case 'filtres-raz': Object.assign(filtre, { q: '', secteur: '', type: '', annee: '', motCle: '', chiffre: false, temoignage: false, aCompleter: false }); rendre(); break;
      case 'nouvelle-sel': modaleNouvelleSelection(); break;
      case 'ouvrir-sel': selOuverte = id; changerVue('selections'); break;
      case 'fermer-sel': selOuverte = null; rendre(); window.scrollTo({ top: 0 }); break;
      case 'sel-ajouter': case 'sel-retirer': case 'sel-monter': case 'sel-descendre': {
        const s = selDe(el);
        if (!s) break;
        retenir();
        if (action === 'sel-ajouter' && !s.projets.includes(id)) s.projets.push(id);
        if (action === 'sel-retirer') s.projets = s.projets.filter((x) => x !== id);
        if (action === 'sel-monter') s.projets = R.deplacer(s.projets, id, -1);
        if (action === 'sel-descendre') s.projets = R.deplacer(s.projets, id, 1);
        sauver(); rendre();
        break;
      }
      case 'suppr-sel': { const s = selection(id); if (!s || !confirm('Supprimer cette sélection ? Les références restent.')) break; retenir(); E.selections = E.selections.filter((x) => x.id !== id); selOuverte = null; if (selPlaquette === id) selPlaquette = ''; sauver(); rendre(); toast('Sélection supprimée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'copier-sel': { const s = selection(id); if (s) copier(R.texteSelection(E, s, B), 'Texte de la sélection copié : colle-le dans ton e-mail.'); break; }
      case 'copier-sel-plaquette': copier(R.texteSelection(E, selectionAffichee(), B), 'Texte copié : colle-le dans ton e-mail.'); break;
      case 'voir-plaquette': selPlaquette = id || ''; changerVue('plaquette'); break;
      case 'modele': { const s = selPlaquette && selection(selPlaquette); if (s) { retenir(); s.modele = el.dataset.modele; sauver(); } else modeleParDefaut = el.dataset.modele; rendre(); break; }
      case 'imprimer': window.print(); break;
      case 'csv': telecharger(R.versCsv(E, B), 'text/csv;charset=utf-8', `references-${aujIso()}.csv`); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
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
  window.addEventListener('resize', ajusterApercu);
  // Impression : l'aperçu reprend sa taille réelle (A4).
  window.addEventListener('beforeprint', () => { const ap = $('.apercu'); if (ap) ap.style.zoom = ''; });
  window.addEventListener('afterprint', ajusterApercu);

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
  window.__references = { etat: () => E, regles: R };
  init();
})();
