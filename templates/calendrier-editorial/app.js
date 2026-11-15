// Calendrier éditorial QME : piliers, banque d'idées, calendrier, brouillons avec compteur, statistiques
// saisies à la main, régularité et recyclage. Données synchronisées par clé de licence.
// Aucune connexion à un réseau social : rien n'est publié ni lu automatiquement.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CED;
  const API = '/api/templates';
  const PRODUIT = 'CED';
  const CLE_CODE = 'qme-ced-code';
  const CLE_CACHE = 'qme-ced-cache';
  const CLE_DEMO = 'qme-ced-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ced-ecran-accueil';

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pluriel = (n, s, p) => `${n} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, jourIndex } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const COULEURS = B.couleurs.map((c) => c.id);

  const teinte = (id) => B.couleurs.find((c) => c.id === id) || B.couleurs[0];
  const pilier = (id) => E.piliers.find((p) => p.id === id);
  const format = (id) => E.formats.find((f) => f.id === id);
  const canal = (id) => E.canaux.find((c) => c.id === id);
  const contenu = (id) => E.contenus.find((c) => c.id === id);
  const stylePilier = (id) => { const c = teinte(pilier(id)?.couleur || 'ciel'); return `--c:${c.hex};--t:${c.texte};--p:${c.teinte}`; };
  const joursTexte = (j) => (!j.length ? 'aucun jour choisi' : j.length === 7 ? 'tous les jours' : j.map((x) => JOURS_LONGS[x]).join(', '));
  const dateCourte = (d) => (d ? fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }) : 'sans date');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  let moisVu = R.premierDuMois(auj());
  let semaineVue = R.lundiDe(auj());
  let modeCal = null; // 'mois' | 'semaine' (par défaut : semaine sur téléphone, mois sur ordinateur)
  let filtre = { statut: 'actifs', pilier: '', q: '' };
  let periodeStats = 90;
  let annulation = null;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  const normaliser = (d) => ({ ...R.normaliserEtat(d, auj(), B), tutorielVu: Boolean(d?.tutorielVu) });

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
        toast('Un autre appareil a modifié ton calendrier entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Code interne (CED-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
  // 3 lettres dont au moins une hors de A–F, ce qu'une clé Gumroad hexadécimale ne peut pas être.
  // Exception : le préfixe CED n'a que des lettres hexadécimales. Il est reconnu tant que la saisie ne
  // dépasse pas les 19 caractères d'un code ; au-delà, c'est une clé Gumroad qui commence par « CED ».
  const estCodeInterne = (n) => (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3))) || (n.startsWith(PRODUIT) && n.length <= 19);
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
  // Consultante fictive, 16 semaines d'historique relatives à aujourd'hui : objectif de 2 contenus par semaine
  // (mardi et jeudi), une semaine de pause, une semaine manquée, statistiques saisies, un contenu programmé
  // oublié, des statistiques à saisir, un trou la semaine prochaine, brouillons et idées.
  const TEXTES_DEMO = [
    'Une réunion d\'une heure à huit personnes, c\'est une journée de travail.\n\nPourtant, on la prépare rarement plus de cinq minutes.\n\nCe que je demande à mes clients avant chaque réunion récurrente :\n\n1. Quelle décision doit sortir de cette réunion ?\n2. Qui doit vraiment être là pour la prendre ?\n3. Qu\'est-ce qui peut se régler par écrit avant ?\n\nDans une PME accompagnée cette année, ces trois questions ont supprimé une réunion hebdomadaire sur trois.\n\nEt chez vous, quelle réunion pourrait devenir un message ?',
    'Le diagnostic que je mène au début de chaque mission tient en quatre étapes.\n\n▪ J\'écoute la direction : ce qu\'elle croit être le problème.\n▪ J\'écoute le terrain : ce qu\'il vit vraiment.\n▪ Je mesure : délais, files d\'attente, ressaisies.\n▪ Je restitue : un écart, trois causes, une priorité.\n\nL\'étape que l\'on saute le plus souvent ? La deuxième.\n\nEnregistrez ce post si vous préparez un audit interne.',
    'J\'ai longtemps rendu des recommandations de 40 pages.\n\nCe que ça m\'a coûté : des rapports lus en diagonale et des plans d\'action jamais lancés.\n\nLe déclic : un dirigeant m\'a demandé « et lundi matin, je fais quoi ? ».\n\nAujourd\'hui, chaque mission se termine par une page : trois actions, un responsable, une date.\n\nVous aussi, vous avez déjà rendu un rapport trop long ?',
    'Ma semaine type d\'indépendante, telle qu\'elle est vraiment :\n\n▪ 3 jours chez les clients ou en production\n▪ une demi-journée de prospection, bloquée le lundi\n▪ une demi-journée d\'administratif, le vendredi\n▪ le reste : préparation, lecture, imprévus\n\nCe qui a tout changé : bloquer la prospection avant que l\'agenda se remplisse.\n\nComment répartissez-vous votre temps ?',
  ];

  function donneesDemo() {
    const t = auj();
    const l0 = R.lundiDe(t);
    const debut = ajout(l0, -15 * 7);
    const e = R.etatInitial(B, debut, { prenom: 'Camille', metier: 'consultant', objectifSemaine: 2, jours: [1, 3], canal: 'Réseau professionnel' });
    e.canaux[0].limite = 3000;
    e.canaux.push({ id: 'lettre', nom: 'Lettre d\'information', limite: null });
    const reseau = e.canaux[0].id;
    e.pauses = [ajout(l0, -8 * 7)];
    const alea = (k) => { let x = 0; for (const ch of k) x = (x * 31 + ch.charCodeAt(0)) % 100003; return ((x * 9301 + 49297) % 233280) / 233280; };
    // Ligne éditoriale de la démo : cinq piliers, dont les points de vue.
    const opinion = B.piliers.find((x) => x.id === 'opinion');
    e.piliers.push({ ...opinion, part: 10 });
    Object.assign(e.piliers.find((x) => x.id === 'expertise'), { part: 30 });
    Object.assign(e.piliers.find((x) => x.id === 'coulisses'), { part: 15 });
    const sujets = R.sujetsPour(B, 'consultant');
    // Sujets gardés pour les contenus programmés, les brouillons et le cas client recyclable.
    const reserves = ['Trois indicateurs qu\'une PME devrait suivre chaque mois', 'Comment préparer une réunion de direction en 30 minutes', 'La recommandation que j\'ai faite trop tôt', 'Avant / après : une organisation réunions remise à plat', 'Le schéma que je dessine dans presque toutes mes missions', 'Pourquoi un audit sans plan d\'action ne sert à rien', 'Sondage : qui décide vraiment des priorités dans votre entreprise ?', 'Comment un client a réduit ses délais de traitement, étape par étape'];
    const libres = sujets.filter((x) => !reserves.includes(x.sujet));
    // Contenus déjà publiés : sujets propres à la démo, puis six sujets de la banque (les autres restent des idées).
    const publies = [
      ['Les trois questions qui débloquent un comité de direction', 'expertise', 'texte'],
      ['Ce qu\'une cartographie des processus révèle en une matinée', 'expertise', 'carrousel'],
      ['Un client, deux sites, un seul planning : le cas d\'une PME industrielle', 'preuves', 'texte'],
      ['Pourquoi je refuse les missions sans soutien de la direction', 'opinion', 'texte'],
      ['Mon modèle de compte rendu en cinq lignes', 'conseils', 'image'],
      ['Comment je découpe une mission en livrables', 'coulisses', 'carrousel'],
      ['Le tableau de bord qu\'un dirigeant consulte vraiment', 'expertise', 'image'],
      ['Moins de ressaisies : retour d\'expérience d\'un cabinet de services', 'preuves', 'texte'],
      ['Quatre signes qu\'une réunion hebdomadaire ne sert plus à rien', 'conseils', 'texte'],
      ['Ce que je fais le premier jour d\'une mission', 'coulisses', 'texte'],
      ['Les priorités, ça se décide, ça ne se subit pas', 'opinion', 'texte'],
      ['Avant / après : un circuit de validation des achats simplifié', 'preuves', 'carrousel'],
      ['Le piège des indicateurs trop nombreux', 'expertise', 'texte'],
      ['Sondage : combien de réunions avez-vous cette semaine ?', 'expertise', 'sondage'],
      ['Trois modèles de document que je réutilise à chaque mission', 'conseils', 'carrousel'],
      ['Ce qu\'un nouveau responsable attend de ses trente premiers jours', 'expertise', 'texte'],
      ['Une équipe de neuf personnes, onze réunions par semaine', 'preuves', 'texte'],
      ['Pourquoi j\'écris mes recommandations sur une page', 'opinion', 'texte'],
      ['Mon outil le plus simple : la liste des décisions', 'conseils', 'texte'],
      ['Ce que les entretiens individuels m\'apprennent avant un audit', 'coulisses', 'texte'],
      ['Délais clients : trois causes que je retrouve partout', 'expertise', 'carrousel'],
      ['Le bilan de mes six premiers mois d\'indépendante', 'coulisses', 'texte'],
      ['Réunion de lancement : ma check-list', 'conseils', 'image'],
      ...libres.slice(0, 6).map((x) => [x.sujet, x.pilier === 'parcours' ? 'coulisses' : x.pilier, x.format]),
    ];
    let k = 0;
    const ajouter = (o) => { const c = R.normaliserContenu({ canal: reseau, creeLe: o.date ? ajout(o.date, -6) : t, ...o }, t); e.contenus.push(c); return c; };
    for (let w = -15; w <= 0; w++) {
      const l = ajout(l0, 7 * w);
      if (e.pauses.includes(l)) continue;
      const jours = w === -11 ? [1] : [1, 3];
      for (const j of jours) {
        const d = ajout(l, j);
        const [titre, p, f] = publies[k % publies.length];
        const s = { sujet: titre };
        k++;
        if (d > t) continue;
        const r = alea(s.sujet + d);
        const vues = Math.round((900 + r * 3600 + (p === 'preuves' ? 1600 : 0) + (f === 'carrousel' ? 1300 : 0)) / 10) * 10;
        const reactions = Math.round(vues * (0.012 + r * 0.025));
        const stats = { vues, reactions, commentaires: Math.round(reactions * (0.12 + r * 0.25)), partages: Math.round(reactions * 0.06), contacts: p === 'preuves' ? 1 + Math.round(r * 2) : r > 0.72 ? 1 : 0 };
        const recent = R.ecart(d, t);
        ajouter({ titre, pilier: p, format: f, statut: 'publie', date: d, heure: '08:30', texte: TEXTES_DEMO[k % TEXTES_DEMO.length], stats: recent >= 9 ? stats : null, statsLe: recent >= 9 ? ajout(d, 7) : null });
      }
    }
    // Le meilleur contenu ancien : un cas client qui a généré des demandes (à recycler).
    const vieux = e.contenus.filter((c) => c.statut === 'publie' && R.ecart(c.date, t) > 95);
    if (vieux[1]) Object.assign(vieux[1], { titre: 'Comment un client a réduit ses délais de traitement, étape par étape', pilier: 'preuves', format: 'texte', texte: TEXTES_DEMO[1], stats: { vues: 7840, reactions: 212, commentaires: 46, partages: 19, contacts: 6 } });
    // Un contenu programmé la semaine dernière, jamais marqué publié.
    ajouter({ titre: 'Trois indicateurs qu\'une PME devrait suivre chaque mois', pilier: 'expertise', format: 'carrousel', statut: 'programme', date: ajout(l0, -5), heure: '12:15', texte: 'Trois indicateurs qu\'une PME devrait suivre chaque mois.\n\n1. Le délai moyen entre la commande et la facture.\n2. La part du chiffre d\'affaires réalisée avec les trois premiers clients.\n3. Le nombre d\'heures de ressaisie par semaine.\n\nLequel suivez-vous déjà ?' });
    // Lettre d'information mensuelle.
    ajouter({ titre: 'Lettre de novembre : trois lectures et un cas client', pilier: 'conseils', format: 'lettre', canal: 'lettre', statut: 'publie', date: ajout(l0, -10), heure: '07:00', texte: 'Bonjour,\n\nCe mois-ci : trois lectures sur l\'organisation des réunions, un cas client et mes disponibilités de décembre.', stats: { vues: 412, reactions: null, commentaires: null, partages: null, contacts: 2 }, statsLe: ajout(l0, -3) });
    // À venir : semaine prochaine incomplète, un contenu dans deux jours sans texte final.
    const prochain = ajout(t, jourIndex(t) < 1 ? 1 - jourIndex(t) : jourIndex(t) < 3 ? 3 - jourIndex(t) : 8 - jourIndex(t));
    if (prochain < ajout(l0, 7)) ajouter({ titre: 'Comment préparer une réunion de direction en 30 minutes', pilier: 'conseils', format: 'texte', statut: 'programme', date: prochain, heure: '08:30', texte: B.trames.find((x) => x.id === 'liste').texte, trame: 'liste' });
    ajouter({ titre: 'La recommandation que j\'ai faite trop tôt', pilier: 'coulisses', format: 'texte', statut: 'programme', date: ajout(l0, 8), heure: '08:30', texte: TEXTES_DEMO[2] });
    ajouter({ titre: 'Avant / après : une organisation réunions remise à plat', pilier: 'preuves', format: 'carrousel', statut: 'programme', date: ajout(l0, 15), heure: '08:30', texte: 'Avant : 11 réunions récurrentes par semaine pour une équipe de neuf personnes.\nAprès : 5, et un point écrit le lundi.\n\nCe qui a fait la différence :\n1. Une décision attendue par réunion.\n2. Des participants choisis, pas invités par défaut.\n3. Un compte rendu en cinq lignes, envoyé le jour même.' });
    ajouter({ titre: 'Le schéma que je dessine dans presque toutes mes missions', pilier: 'expertise', format: 'image', statut: 'programme', date: ajout(l0, 17), heure: '12:15', texte: '' });
    // Brouillons et idées.
    ajouter({ titre: 'Pourquoi un audit sans plan d\'action ne sert à rien', pilier: 'opinion', format: 'texte', statut: 'brouillon', texte: B.trames.find((x) => x.id === 'opinion').texte.replace('[Accroche : l\'idée reçue que je ne partage pas]', 'Un audit sans plan d\'action, c\'est un bilan de santé qu\'on range dans un tiroir.'), trame: 'opinion' });
    ajouter({ titre: 'Sondage : qui décide vraiment des priorités dans votre entreprise ?', pilier: 'expertise', format: 'sondage', statut: 'brouillon', texte: 'Dans votre entreprise, qui fixe vraiment les priorités de la semaine ?\n\n▪ La direction\n▪ Le client le plus pressé\n▪ La personne qui crie le plus fort\n▪ Personne, et c\'est bien le problème' });
    R.ajouterSujets(e, libres.slice(6), t);
    e.contenus.filter((c) => c.statut === 'idee').forEach((c, i) => { c.creeLe = ajout(t, -i * 3); });
    e.reglages.depuis = debut;
    return { ...R.normaliserEtat(e, t, B), tutorielVu: false };
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Calendrier éditorial · QME';
    const cases = Array.from({ length: 21 }, (_, i) => {
      const x = 10 + (i % 7) * 38, y = 40 + Math.floor(i / 7) * 46;
      const plein = { 1: '#1D4E89', 3: '#D9302A', 8: '#F5B400', 10: '#1D4E89', 15: '#D9302A', 17: '#F5B400' }[i];
      return `<rect x="${x}" y="${y}" width="30" height="38" rx="8" ${plein ? `fill="${plein}"` : 'fill="none" stroke="#2E5A88" stroke-width="3" stroke-dasharray="6 5"'}/>`;
    }).join('');
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 200" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          ${cases}
          <circle cx="440" cy="100" r="90" fill="#F5B400"/>
          <path d="M440 100 L440 10 A90 90 0 0 1 530 100 Z" fill="#141414"/>
          <rect x="396" y="76" width="88" height="12" rx="6" fill="#141414"/><rect x="396" y="100" width="64" height="12" rx="6" fill="#141414"/><rect x="396" y="124" width="76" height="12" rx="6" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Calendrier éditorial · réseaux professionnels</p>
          <h1>Publier chaque semaine, sans chercher quoi dire.</h1>
          <p>Tes piliers et ton rythme, une banque de sujets par métier, le calendrier du mois, tes brouillons avec compteur de caractères, et ce qui a vraiment rapporté des contacts.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton calendrier</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton calendrier est enregistré en ligne et te suit sur tous tes appareils.</p>
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
        <p class="mention">Pas encore de calendrier ? <a href="/catalogue/calendrier-editorial/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
  const accueilVide = () => ({ etape: 1, prenom: '', metier: '', objectif: 2, jours: [1, 3], piliers: new Set(B.piliers.filter((p) => p.part > 0).map((p) => p.id)), canal: 'Réseau professionnel', sujets: true });
  let accueil = accueilVide();
  const choixJours = (sel, nom = 'jours') => `<div class="choix-jours">${JOURS_COURTS.map((j, i) => `<label><input type="checkbox" name="${nom}" value="${i}" ${sel.includes(i) ? 'checked' : ''}><span>${j}</span></label>`).join('')}</div>`;

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-points" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On pose ton rythme.</h1>
        <p class="intro">Ton métier choisit les sujets proposés dans la banque d'idées. Ton objectif de publications par semaine sert à suivre ta régularité. Tout reste modifiable.</p>
        <label class="champ" style="max-width:360px">Ton prénom <small>Facultatif, pour personnaliser l'accueil.</small>
          <input id="prenom" value="${esc(a.prenom)}" autocomplete="given-name" maxlength="40">
        </label>
        <h2 class="titre-section">Ton métier</h2>
        <div class="types" role="group" aria-label="Métier">
          ${B.metiers.map((m) => `<button type="button" class="type" data-action="metier" data-id="${m.id}" aria-pressed="${a.metier === m.id}"><b>${esc(m.nom)}</b><small>${pluriel(R.sujetsPour(B, m.id).length, 'sujet')}</small></button>`).join('')}
          <button type="button" class="type" data-action="metier" data-id="" aria-pressed="${a.metier === ''}"><b>Autre métier</b><small>${pluriel(R.sujetsPour(B, '').length, 'sujet général', 'sujets généraux')}</small></button>
        </div>
        <h2 class="titre-section">Ton rythme</h2>
        <div class="rang-champs" style="max-width:640px">
          <label class="champ">Publications par semaine<select id="objectif">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${a.objectif === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <fieldset class="champ"><legend>Jours de publication préférés</legend>${choixJours(a.jours, 'jours-accueil')}</fieldset>
        </div>
        <p class="aide">Mieux vaut un rythme tenu qu'un rythme ambitieux : une ou deux publications par semaine suffisent pour commencer.</p>
        <div class="accueil-pied"><span class="aide-pied">Étape suivante : tes piliers éditoriaux.</span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const n = R.sujetsPour(B, a.metier).length;
      corps = `
        <p class="surtitre">Ligne éditoriale</p>
        <h1>Tes piliers</h1>
        <p class="intro">Un pilier est une grande famille de sujets. Trois à cinq piliers suffisent ; la part visée sert à vérifier que tu ne parles pas toujours de la même chose. Tu pourras les renommer et ajuster les parts.</p>
        <div class="choix-piliers">${B.piliers.map((p) => `
          <label class="carte-choix" style="--c:${teinte(p.couleur).hex}"><input type="checkbox" data-action="pilier-accueil" value="${p.id}" ${a.piliers.has(p.id) ? 'checked' : ''}>
            <span><b><i></i>${esc(p.nom)}</b><small>${esc(p.description)}</small></span></label>`).join('')}</div>
        <label class="champ" style="max-width:420px">Ton réseau principal <small>Le nom que tu veux : il sert à classer tes contenus.</small><input id="canal" value="${esc(a.canal)}" maxlength="40"></label>
        <label class="case"><input type="checkbox" id="sujets" ${a.sujets ? 'checked' : ''}> Ajouter les ${n} sujets proposés pour mon métier à ma banque d'idées</label>
        <p class="erreur" role="alert" id="erreur-accueil"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon calendrier</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#prenom')?.addEventListener('input', (e) => { accueil.prenom = e.target.value; });
    $('#objectif')?.addEventListener('change', (e) => { accueil.objectif = Number(e.target.value); });
    document.querySelectorAll('input[name=jours-accueil]').forEach((x) => x.addEventListener('change', () => { accueil.jours = [...document.querySelectorAll('input[name=jours-accueil]:checked')].map((y) => Number(y.value)); }));
    $('#canal')?.addEventListener('input', (e) => { accueil.canal = e.target.value; });
    $('#sujets')?.addEventListener('change', (e) => { accueil.sujets = e.target.checked; });
  }

  function terminerAccueil() {
    const a = accueil;
    if (!a.piliers.size) { $('#erreur-accueil').textContent = 'Choisis au moins un pilier.'; return; }
    const t = auj();
    E = R.etatInitial(B, t, { prenom: a.prenom.trim(), metier: a.metier, objectifSemaine: a.objectif, jours: a.jours, piliers: [...a.piliers], canal: a.canal.trim() || 'Réseau professionnel' });
    E.tutorielVu = false;
    // Piliers sans part type (points de vue, parcours) choisis : 10 % chacun.
    E.piliers.forEach((p) => { if (!p.part) p.part = 10; });
    const n = a.sujets ? R.ajouterSujets(E, R.sujetsPour(B, a.metier), t) : 0;
    accueil = accueilVide();
    vue = 'tableau';
    sauver();
    demarrer();
    toast(n ? `Ton calendrier est prêt, avec ${n} idées de sujets. Programme ta première publication.` : 'Ton calendrier est prêt. Ajoute ta première idée.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="5" height="5" fill="currentColor"/><rect x="10" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="5" fill="currentColor"/><rect x="3" y="10" width="5" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="10" width="5" height="5" fill="currentColor"/><rect x="17" y="10" width="4" height="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="17" width="5" height="4" fill="currentColor"/><rect x="10" y="17" width="5" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="17" width="4" height="4" fill="currentColor"/></svg>',
    contenus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="7" width="4" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    ligne: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V3a18 18 0 0 1 18 18Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    droite: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 4 8 8-8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  // Formes de statut (jamais la couleur seule) : idée = cercle vide, brouillon = demi-cercle, programmé = carré vide, publié = carré plein.
  const FORME_STATUT = {
    idee: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    brouillon: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 1.5a4.5 4.5 0 0 1 0 9Z" fill="currentColor"/></svg>',
    programme: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    publie: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"/></svg>',
  };
  const etiquetteStatut = (s) => `<span class="statut st-${s}">${FORME_STATUT[s]}${R.LIB_STATUT[s]}</span>`;
  const ONGLETS = [['tableau', 'Tableau'], ['calendrier', 'Calendrier'], ['contenus', 'Idées'], ['stats', 'Statistiques'], ['ligne', 'Ligne']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/calendrier-editorial/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Calendrier<br>éditorial</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
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
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { tableau: 'Tableau', calendrier: 'Calendrier', contenus: 'Idées et contenus', stats: 'Statistiques', ligne: 'Ligne éditoriale' };
    document.title = `${titres[vue]} · Calendrier éditorial`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, calendrier: vueCalendrier, contenus: vueContenus, stats: vueStats, ligne: vueLigne }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', () => { filtre.q = q.value; const pos = q.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';

  // Carte compacte d'un contenu (listes, tableau).
  function ligneContenu(c, { date = true, avancer = true } = {}) {
    const p = pilier(c.pilier);
    const sous = [date && c.date ? `${dateCourte(c.date)}${c.heure ? ` · ${c.heure.replace(':', ' h ')}` : ''}` : '', format(c.format)?.nom, E.canaux.length > 1 ? canal(c.canal)?.nom : ''].filter(Boolean).join(' · ');
    const suivant = R.statutSuivant(c.statut);
    const libAvancer = { brouillon: 'Rédiger', programme: 'Programmer', publie: 'Marquer publié' }[suivant];
    return `<li class="contenu" style="${stylePilier(c.pilier)}">
      <button class="contenu-corps" data-action="ouvrir" data-id="${c.id}">
        <span class="contenu-tete">${etiquetteStatut(c.statut)}<span class="pilier-nom"><i></i>${esc(p?.nom || 'Sans pilier')}</span></span>
        <b>${esc(c.titre)}</b>
        ${sous ? `<span class="contenu-sous">${esc(sous)}</span>` : ''}
        ${c.recycleDe ? '<span class="contenu-sous">reprise d\'un contenu publié</span>' : ''}
      </button>
      ${avancer && c.statut !== 'publie' ? `<button class="btn petit avancer" data-action="avancer" data-id="${c.id}">${libAvancer}</button>` : ''}
      ${c.statut === 'publie' && !c.stats ? `<button class="btn petit avancer" data-action="stats" data-id="${c.id}">Statistiques</button>` : ''}
    </li>`;
  }

  // ---------- Tableau ----------
  function vueTableau() {
    const t = auj();
    const s = R.semaine(E, R.lundiDe(t), t);
    const serie = R.serie(E, t);
    const record = R.meilleureSerie(E, t);
    const tot = R.totaux(E, ajout(t, -29), t);
    const alertes = R.alertes(E, t);
    const aVenir = E.contenus.filter((c) => c.date && c.date >= t && c.date <= ajout(t, 13) && c.statut !== 'publie').sort((x, y) => (x.date + x.heure).localeCompare(y.date + y.heure));
    const libres = R.joursLibres(E, t, 3);
    const aPrivilegier = R.pilierAPrivilegier(E, t);
    const idees = E.contenus.filter((c) => c.statut === 'idee' && (!aPrivilegier || c.pilier === aPrivilegier.pilier)).slice(0, 3);
    const salut = E.prenom ? `Bonjour ${esc(E.prenom)}. ` : '';
    const tuiles = [
      ['Cette semaine', `${s.publies}<small>/${s.objectif}</small>`, s.tenue ? 'objectif tenu' : `${pluriel(s.prevus, 'contenu prévu', 'contenus prévus')} au total`, 'var(--bleu)', ''],
      ['Série en cours', `${serie}<small>sem.</small>`, `record : ${pluriel(record, 'semaine')}`, 'var(--rouge)', 'rond'],
      ['Contacts générés', tot.contacts, `30 derniers jours, ${pluriel(tot.publies, 'contenu publié', 'contenus publiés')}`, 'var(--jaune)', ''],
      ['Banque d\'idées', E.contenus.filter((c) => c.statut === 'idee').length, `${pluriel(E.contenus.filter((c) => c.statut === 'brouillon').length, 'brouillon')} en cours`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');
    const listeAlertes = alertes.map((a) => `<li class="alerte-ligne niveau-${a.niveau}"><span class="pastille-alerte" aria-hidden="true"></span><span>${esc(a.texte.replace(/\d{4}-\d{2}-\d{2}/g, (d) => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })))}</span>${a.id ? `<button class="btn petit" data-action="${a.type === 'stats' ? 'stats' : 'ouvrir'}" data-id="${a.id}">${a.type === 'stats' ? 'Saisir' : a.type === 'oubli' ? 'Régler' : 'Ouvrir'}</button>` : `<button class="btn petit" data-action="nouveau" data-date="${R.joursLibres(E, a.lundi < t ? t : a.lundi, 1)[0] || a.lundi}">Programmer</button>`}</li>`).join('');
    return `
      <div class="vue-tete"><div><h1>${salut}${s.tenue ? '<mark>Semaine tenue.</mark>' : `<mark>${s.publies} sur ${s.objectif}</mark> cette semaine.`}</h1><p>Objectif : ${pluriel(s.objectif, 'publication')} par semaine, de préférence le ${joursTexte(E.reglages.jours)}.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Contenu</button><button class="btn" data-action="banque">Banque de sujets</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <div class="deux-colonnes">
        <section class="bloc">
          <h2 class="titre-section">À faire <span>${alertes.length ? pluriel(alertes.length, 'point') : 'rien en retard'}</span></h2>
          ${alertes.length ? `<ul class="alertes">${listeAlertes}</ul>` : '<p class="aide">Rien à rattraper : ton calendrier est à jour.</p>'}
          <h2 class="titre-section">Deux prochaines semaines</h2>
          ${aVenir.length ? `<ul class="contenus">${aVenir.map((c) => ligneContenu(c)).join('')}</ul>` : '<p class="aide">Aucun contenu programmé.</p>'}
        </section>
        <section class="bloc">
          <h2 class="titre-section">Prochains créneaux libres</h2>
          ${libres.length ? `<div class="creneaux">${libres.map((d) => `<button class="creneau" data-action="nouveau" data-date="${d}"><b>${esc(majuscule(fmt(d, { weekday: 'long' })))}</b><span>${esc(fmt(d, { day: 'numeric', month: 'long' }))}</span><small>Programmer</small></button>`).join('')}</div>` : '<p class="aide">Tes jours préférés des six prochaines semaines sont tous pris.</p>'}
          ${aPrivilegier ? `<div class="conseil" style="${stylePilier(aPrivilegier.pilier)}"><p><b>Pilier à privilégier : ${esc(aPrivilegier.nom)}</b>. ${aPrivilegier.part} % de tes contenus récents et prévus, pour ${aPrivilegier.cible} % visés.</p>${idees.length ? `<ul class="contenus">${idees.map((c) => ligneContenu(c)).join('')}</ul>` : '<p class="aide">Aucune idée de ce pilier dans ta banque : <button class="btn lien" data-action="banque">pioche dans la banque de sujets</button>.</p>'}</div>` : '<p class="aide">Tes piliers sont équilibrés sur les dix dernières et prochaines semaines.</p>'}
          ${graphiqueRegularite(8)}
        </section>
      </div>`;
  }

  // Régularité : contenus publiés par semaine, objectif en filet (une seule série, le titre la nomme).
  function graphiqueRegularite(n) {
    const t = auj();
    const sem = R.regularite(E, t, n);
    const max = Math.max(R.objectif(E) + 1, ...sem.map((s) => s.publies));
    const ligne = (R.objectif(E) / max) * 100;
    const col = sem.map((s) => {
      const etat = s.avant ? 'avant le début du suivi' : s.pause ? 'pause' : s.tenue ? 'objectif tenu' : s.enCours ? 'en cours' : 'objectif manqué';
      const info = `<b>Semaine du ${fmt(s.lundi, { day: 'numeric', month: 'long' })}</b>${pluriel(s.publies, 'contenu publié', 'contenus publiés')} sur ${s.objectif} visés<br>${etat}`;
      return `<div class="col-reg ${s.tenue ? 'tenue' : ''} ${s.pause ? 'pause' : ''} ${s.enCours ? 'en-cours' : ''}" tabindex="0" data-info="${esc(info)}"><div class="cr-zone"><span class="cr-barre" style="height:${(s.publies / max) * 100}%"></span></div><b>${s.pause ? 'pause' : s.publies}</b><span>${esc(fmt(s.lundi, { day: 'numeric', month: 'short' }))}</span></div>`;
    }).join('');
    return `<div class="graphique">
      <div class="graphique-tete"><h2>Contenus publiés par semaine</h2><span class="discret">${n} dernières semaines · filet : objectif de ${R.objectif(E)}</span></div>
      <div class="regularite" style="--obj:${ligne}%">${col}</div>
      <p class="aide">Barre pleine : semaine tenue. Une semaine en pause (congés) ne casse pas la série.</p>
    </div>`;
  }

  // ---------- Calendrier ----------
  function vueCalendrier() {
    const mode = modeCal || (estTel() ? 'semaine' : 'mois');
    const t = auj();
    const bascule = `<div class="segment" role="group" aria-label="Affichage"><button class="btn petit" data-action="mode-cal" data-val="mois" aria-pressed="${mode === 'mois'}">Mois</button><button class="btn petit" data-action="mode-cal" data-val="semaine" aria-pressed="${mode === 'semaine'}">Semaine</button></div>`;
    const legende = `<div class="legende-piliers">${E.piliers.map((p) => `<span style="${stylePilier(p.id)}"><i></i>${esc(p.nom)}</span>`).join('')}<span class="sep"></span>${R.STATUTS.map((s) => etiquetteStatut(s)).join('')}</div>`;
    if (mode === 'semaine') {
      const l = semaineVue;
      const s = R.semaine(E, l, t);
      const jours = Array.from({ length: 7 }, (_, k) => ajout(l, k)).map((d) => {
        const liste = R.contenusDuJour(E, d);
        const pref = E.reglages.jours.includes(jourIndex(d));
        return `<section class="jour-sem ${d === t ? 'auj' : ''} ${pref ? 'pref' : ''}">
          <h3><span>${esc(majuscule(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })))}</span>${pref ? '<small>jour préféré</small>' : ''}</h3>
          ${liste.length ? `<ul class="contenus">${liste.map((c) => ligneContenu(c, { date: false })).join('')}</ul>` : ''}
          <button class="btn lien" data-action="nouveau" data-date="${d}">${ICONES.plus}Programmer ce jour-là</button>
        </section>`;
      }).join('');
      return `
        <div class="vue-tete"><div><h1>Semaine du ${esc(fmt(l, { day: 'numeric', month: 'long' }))}</h1><p>${s.pause ? 'Semaine de pause : elle ne compte pas dans ta régularité.' : `${s.publies} publié${s.publies > 1 ? 's' : ''}, ${s.prevus} prévu${s.prevus > 1 ? 's' : ''} au total, objectif ${s.objectif}.`}</p></div>
          <div class="actions">${bascule}<div class="nav-mois"><button class="btn-icone" data-action="sem-prec" aria-label="Semaine précédente">${ICONES.gauche}</button><button class="btn petit" data-action="sem-auj">Cette semaine</button><button class="btn-icone" data-action="sem-suiv" aria-label="Semaine suivante">${ICONES.droite}</button></div>
          <button class="btn" data-action="pause" data-lundi="${l}">${s.pause ? 'Annuler la pause' : 'Semaine de pause'}</button></div></div>
        ${legende}
        <div class="semaine-liste">${jours}</div>`;
    }
    const semaines = R.grilleMois(moisVu);
    const titre = majuscule(versDate(moisVu).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    const lignes = semaines.map((sem) => {
      const s = R.semaine(E, sem[0], t);
      const marque = s.pause ? '<span class="sem-etat pause">pause</span>' : s.future && !s.enCours ? `<span class="sem-etat ${s.prevus >= s.objectif ? 'ok' : 'manque'}">${s.prevus}/${s.objectif}</span>` : `<span class="sem-etat ${s.tenue ? 'ok' : s.enCours ? '' : 'manque'}">${s.publies}/${s.objectif}</span>`;
      return `<tr><th scope="row" class="col-sem">${marque}</th>${sem.map((d) => {
        const liste = R.contenusDuJour(E, d);
        const hors = d.slice(0, 7) !== moisVu.slice(0, 7);
        const pref = E.reglages.jours.includes(jourIndex(d));
        return `<td class="${hors ? 'hors' : ''} ${d === t ? 'auj' : ''} ${pref ? 'pref' : ''}"><div class="case-jour"><button class="num-jour" data-action="nouveau" data-date="${d}" aria-label="Programmer un contenu le ${esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }))}">${versDate(d).getDate()}</button>${liste.map((c) => `<button class="puce-cal st-${c.statut}" style="${stylePilier(c.pilier)}" data-action="ouvrir" data-id="${c.id}" title="${esc(`${R.LIB_STATUT[c.statut]} · ${pilier(c.pilier)?.nom || ''} · ${c.titre}`)}">${FORME_STATUT[c.statut]}<span>${esc(c.titre)}</span></button>`).join('')}</div></td>`;
      }).join('')}</tr>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>${esc(titre)}</h1><p>Touche un jour pour y programmer un contenu, une étiquette pour l'ouvrir. La colonne de gauche compare chaque semaine à ton objectif.</p></div>
        <div class="actions">${bascule}<div class="nav-mois"><button class="btn-icone" data-action="mois-prec" aria-label="Mois précédent">${ICONES.gauche}</button><button class="btn petit" data-action="mois-auj">Ce mois-ci</button><button class="btn-icone" data-action="mois-suiv" aria-label="Mois suivant">${ICONES.droite}</button></div><button class="btn" data-action="imprimer">Imprimer</button></div></div>
      ${legende}
      <div class="grille-cal"><table class="cal"><thead><tr><th scope="col" class="col-sem"><span class="sr-only">Semaine</span></th>${JOURS_COURTS.map((j, i) => `<th scope="col" class="${E.reglages.jours.includes(i) ? 'pref' : ''}">${j}</th>`).join('')}</tr></thead><tbody>${lignes}</tbody></table></div>`;
  }

  // ---------- Idées et contenus ----------
  function vueContenus() {
    const q = filtre.q.trim().toLowerCase();
    const garde = (c) => (filtre.statut === 'actifs' ? c.statut !== 'publie' : filtre.statut === 'tous' || c.statut === filtre.statut) && (!filtre.pilier || c.pilier === filtre.pilier) && (!q || `${c.titre} ${c.texte} ${c.notes}`.toLowerCase().includes(q));
    const liste = E.contenus.filter(garde);
    const compte = (s) => E.contenus.filter((c) => (s === 'actifs' ? c.statut !== 'publie' : s === 'tous' || c.statut === s)).length;
    const filtres = [['actifs', 'À traiter'], ['idee', 'Idées'], ['brouillon', 'Brouillons'], ['programme', 'Programmés'], ['publie', 'Publiés'], ['tous', 'Tous']];
    const colonnes = (filtre.statut === 'actifs' ? ['idee', 'brouillon', 'programme'] : filtre.statut === 'tous' ? R.STATUTS : [filtre.statut]).map((s) => {
      const items = liste.filter((c) => c.statut === s).sort((x, y) => s === 'idee' || s === 'brouillon' ? String(y.creeLe).localeCompare(String(x.creeLe)) : s === 'publie' ? String(y.date).localeCompare(String(x.date)) : String(x.date).localeCompare(String(y.date)));
      return `<section class="colonne"><h2 class="titre-colonne">${etiquetteStatut(s)}<span>${items.length}</span></h2>${items.length ? `<ul class="contenus">${items.map((c) => ligneContenu(c)).join('')}</ul>` : `<p class="aide">${{ idee: 'Aucune idée : pioche dans la banque de sujets.', brouillon: 'Aucun brouillon en cours.', programme: 'Rien de programmé.', publie: 'Rien de publié pour l\'instant.' }[s]}</p>`}</section>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Idées et contenus</h1><p>Chaque contenu avance d'idée à brouillon, puis programmé et publié. Le bouton de droite le fait avancer d'un cran.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau">${ICONES.plus}Contenu</button><button class="btn" data-action="banque">Banque de sujets</button></div></div>
      <div class="filtres">
        <div class="puces" role="group" aria-label="Statut">${filtres.map(([id, nom]) => `<button class="puce" data-action="filtre-statut" data-val="${id}" aria-pressed="${filtre.statut === id}">${nom} <small>${compte(id)}</small></button>`).join('')}</div>
        <div class="rang-filtres">
          <label class="champ compact"><span class="sr-only">Pilier</span><select data-action="filtre-pilier"><option value="">Tous les piliers</option>${E.piliers.map((p) => `<option value="${p.id}" ${filtre.pilier === p.id ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label>
          <label class="champ compact recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un sujet, un mot du texte" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      <div class="colonnes n${(filtre.statut === 'actifs' ? 3 : filtre.statut === 'tous' ? 4 : 1)}">${colonnes}</div>`;
  }

  // ---------- Statistiques ----------
  function vueStats() {
    const t = auj();
    const de = periodeStats ? ajout(t, -(periodeStats - 1)) : null;
    const tot = R.totaux(E, de || '0000-01-01', t);
    const critere = E.reglages.critere;
    const meilleurs = R.classer(E, critere, de, t).slice(0, 5);
    const recycler = R.aRecycler(E, t);
    const taux = R.tauxSemaines(E, t, 12);
    const sansStats = E.contenus.filter((c) => c.statut === 'publie' && !c.stats).sort((x, y) => x.date.localeCompare(y.date));
    const publies = E.contenus.filter((c) => c.statut === 'publie' && (!de || c.date >= de)).sort((x, y) => y.date.localeCompare(x.date));
    const periodes = [[30, '30 jours'], [90, '90 jours'], [365, '12 mois'], [0, 'Tout']];
    const tuiles = [
      ['Contenus publiés', tot.publies, `${tot.avecStats} avec statistiques`, 'var(--bleu)', ''],
      ['Vues', R.nombreTexte(tot.vues), 'total saisi', 'var(--encre)', 'rond'],
      ['Taux d\'interaction', tot.taux === null ? '–' : `${String(tot.taux).replace('.', ',')}<small>%</small>`, 'réactions, commentaires, partages ÷ vues', 'var(--rouge)', ''],
      ['Contacts générés', tot.contacts, 'messages, rendez-vous, devis', 'var(--jaune)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${esc(d)}</span></div>`).join('');
    const ligneStat = (c, rang) => {
      const e = R.engagement(c.stats);
      return `<tr style="${stylePilier(c.pilier)}">
        ${rang ? `<td class="nb discret rang-stat">${rang}</td>` : ''}
        <td class="td-contenu"><button class="lien-contenu" data-action="ouvrir" data-id="${c.id}"><span class="nom-theme"><i></i><span>${esc(c.titre)}<small>${esc([fmt(c.date, { day: 'numeric', month: 'short', year: 'numeric' }), pilier(c.pilier)?.nom, format(c.format)?.nom].filter(Boolean).join(' · '))}</small></span></span></button></td>
        <td class="nb" data-l="Vues">${c.stats ? R.nombreTexte(c.stats.vues) : '–'}</td>
        <td class="nb" data-l="Interactions">${e.interactions === null ? '–' : R.nombreTexte(e.interactions)}</td>
        <td class="nb" data-l="Taux">${e.taux === null ? '–' : `${String(e.taux).replace('.', ',')} %`}</td>
        <td class="nb" data-l="Contacts"><b>${c.stats ? (c.stats.contacts ?? '–') : '–'}</b></td>
        <td class="nb action"><button class="btn petit" data-action="stats" data-id="${c.id}">${c.stats ? 'Modifier' : 'Saisir'}</button></td>
      </tr>`;
    };
    const entete = (rang) => `<thead><tr>${rang ? '<th class="nb">#</th>' : ''}<th>Contenu</th><th class="nb">Vues</th><th class="nb">Interactions</th><th class="nb">Taux</th><th class="nb">Contacts</th><th class="nb"><span class="sr-only">Action</span></th></tr></thead>`;
    const moyennes = (cle, liste, titre) => {
      const m = R.moyennesPar(E, cle, de, t);
      if (!m.length) return '';
      return `<div class="moyennes"><h3>${titre}</h3><div class="defile"><table class="tableau"><thead><tr><th>${titre.replace('Par ', '')}</th><th class="nb">Publiés</th><th class="nb">Vues moy.</th><th class="nb">Taux moy.</th><th class="nb">Contacts</th></tr></thead><tbody>${m.map((g) => `<tr ${cle === 'pilier' ? `style="${stylePilier(g.id)}"` : ''}><td>${cle === 'pilier' ? `<span class="nom-theme"><i></i><span>${esc(liste(g.id)?.nom || 'Sans pilier')}</span></span>` : esc(liste(g.id)?.nom || '–')}</td><td class="nb">${g.n}</td><td class="nb">${R.nombreTexte(g.vuesMoy)}</td><td class="nb">${g.tauxMoy === null ? '–' : `${String(g.tauxMoy).replace('.', ',')} %`}</td><td class="nb"><b>${g.contacts}</b></td></tr>`).join('')}</tbody></table></div></div>`;
    };
    return `
      <div class="vue-tete"><div><h1>Statistiques</h1><p>Chiffres saisis à la main depuis chaque réseau : rien n'est lu automatiquement. Le taux d'interaction est calculé ici (chaque réseau calcule le sien à sa façon).</p></div>
        <div class="actions"><div class="segment" role="group" aria-label="Période">${periodes.map(([n, lib]) => `<button class="btn petit" data-action="periode" data-val="${n}" aria-pressed="${periodeStats === n}">${lib}</button>`).join('')}</div><button class="btn" data-action="csv">Export CSV</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${sansStats.length ? `<div class="conseil"><p><b>${pluriel(sansStats.length, 'contenu publié attend ses statistiques', 'contenus publiés attendent leurs statistiques')}.</b> Reporte-les une semaine environ après la publication, quand les chiffres se stabilisent.</p><div class="rang">${sansStats.slice(0, 4).map((c) => `<button class="btn petit" data-action="stats" data-id="${c.id}">${esc(c.titre.length > 40 ? `${c.titre.slice(0, 38)}…` : c.titre)}</button>`).join('')}</div></div>` : ''}
      <h2 class="titre-section">Meilleurs contenus <span>selon <label class="sr-only" for="critere">Critère</label><select id="critere" data-action="critere" class="select-texte">${Object.entries(R.CRITERES).map(([id, nom]) => `<option value="${id}" ${critere === id ? 'selected' : ''}>${nom.toLowerCase()}</option>`).join('')}</select></span></h2>
      ${meilleurs.length ? `<div class="defile"><table class="tableau tableau-stats classement">${entete(true)}<tbody>${meilleurs.map((c, i) => ligneStat(c, i + 1)).join('')}</tbody></table></div>` : '<p class="aide">Aucune statistique saisie sur la période.</p>'}
      <h2 class="titre-section">À recycler <span>meilleurs contenus publiés il y a plus de ${E.reglages.delaiRecyclage} jours</span></h2>
      ${recycler.length ? `<ul class="contenus recyclage">${recycler.map((c) => `<li class="contenu" style="${stylePilier(c.pilier)}"><button class="contenu-corps" data-action="ouvrir" data-id="${c.id}"><span class="contenu-tete">${etiquetteStatut('publie')}<span class="pilier-nom"><i></i>${esc(pilier(c.pilier)?.nom || '')}</span></span><b>${esc(c.titre)}</b><span class="contenu-sous">Publié le ${esc(fmt(c.date, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(R.CRITERES[critere].toLowerCase())} : ${critere === 'taux' ? `${String(R.engagement(c.stats).taux).replace('.', ',')} %` : R.nombreTexte(R.valeurCritere(c, critere))} · à reprendre en ${esc(format(B.recyclage[c.format])?.nom?.toLowerCase() || 'autre format')}</span></button><button class="btn petit avancer" data-action="recycler" data-id="${c.id}">Recycler</button></li>`).join('')}</ul>` : '<p class="aide">Rien à recycler pour l\'instant : il faut des contenus publiés depuis assez longtemps, avec des statistiques.</p>'}
      <div class="deux-colonnes">${moyennes('pilier', pilier, 'Par pilier')}${moyennes('format', format, 'Par format')}</div>
      <h2 class="titre-section">Régularité <span>${taux.taux === null ? 'pas encore de semaine terminée' : `${taux.tenues} semaines tenues sur ${taux.comptees} (${taux.taux} %), série en cours ${pluriel(R.serie(E, t), 'semaine')}, record ${pluriel(R.meilleureSerie(E, t), 'semaine')}`}</span></h2>
      ${graphiqueRegularite(estTel() ? 8 : 12)}
      <h2 class="titre-section">Tous les contenus publiés <span>${periodeStats ? `sur ${periodes.find((p) => p[0] === periodeStats)[1]}` : 'depuis le début'}</span></h2>
      ${publies.length ? `<div class="defile"><table class="tableau tableau-stats">${entete(false)}<tbody>${publies.map((c) => ligneStat(c, 0)).join('')}</tbody></table></div>` : '<p class="aide">Aucun contenu publié sur la période.</p>'}`;
  }

  // ---------- Ligne éditoriale ----------
  function vueLigne() {
    const t = auj();
    const rep = R.repartitionPiliers(E, ajout(R.lundiDe(t), -49), ajout(R.lundiDe(t), 13));
    const somme = E.piliers.reduce((s, p) => s + p.part, 0);
    const barres = rep.lignes.map((l) => `<div class="barre-pilier" style="${stylePilier(l.pilier)}">
        <div class="bp-tete"><span class="nom-theme"><i></i><span>${esc(l.nom)}</span></span><span class="discret">${l.part} % · visé ${l.cible} %</span></div>
        <div class="bp-piste" role="img" aria-label="${esc(`${l.nom} : ${l.part} % des contenus, ${l.cible} % visés`)}"><span class="bp-reel" style="width:${l.part}%"></span><span class="bp-cible" style="left:${l.cible}%"></span></div>
      </div>`).join('');
    return `
      <div class="vue-tete"><div><h1>Ligne éditoriale</h1><p>Tes piliers, ton rythme, tes réseaux et tes formats. La répartition compte les contenus programmés et publiés des 8 dernières semaines et des 2 prochaines.</p></div>
        <div class="actions"><button class="btn" data-action="rythme">Rythme et repères</button></div></div>
      <div class="deux-colonnes">
        <section class="bloc">
          <h2 class="titre-section">Répartition par pilier <span>${pluriel(rep.total, 'contenu')}</span></h2>
          <div class="graphique">${barres || '<p class="aide">Aucun pilier.</p>'}<p class="aide">Barre : part réelle. Trait vertical : part visée.</p></div>
        </section>
        <section class="bloc">
          <h2 class="titre-section">Rythme</h2>
          <div class="fiche-rythme">
            <p><b>${pluriel(R.objectif(E), 'publication')} par semaine</b>, de préférence le ${esc(joursTexte(E.reglages.jours))}.</p>
            <p class="discret">Statistiques à saisir ${pluriel(E.reglages.delaiStats, 'jour')} après publication · recyclage après ${E.reglages.delaiRecyclage} jours · accroche repère : ${E.reglages.longueurAccroche} caractères.</p>
            <button class="btn petit" data-action="rythme">Modifier</button>
          </div>
        </section>
      </div>
      <h2 class="titre-section">Piliers <span>${somme === 100 ? 'parts visées : 100 %' : `parts visées : ${somme} %, ramenées à 100 % dans les calculs`}</span></h2>
      <div class="cartes-themes">${E.piliers.map((p) => `<section class="carte-theme" style="${stylePilier(p.id)}">
        <div class="carte-theme-tete"><i></i><div><h2>${esc(p.nom)}</h2><span>part visée ${p.part} % · ${pluriel(E.contenus.filter((c) => c.pilier === p.id).length, 'contenu')}</span></div>
          <button class="btn petit" data-action="pilier" data-id="${p.id}">Modifier</button></div>
        <p class="aide">${esc(p.description || 'Aucune description.')}</p>
      </section>`).join('')}</div>
      <div class="rang" style="margin-top:12px"><button class="btn" data-action="pilier">${ICONES.plus}Pilier</button></div>
      <div class="deux-colonnes" style="margin-top:8px">
        <section class="bloc"><h2 class="titre-section">Réseaux et canaux <span>limite de caractères saisie par toi</span></h2>
          <ul class="archives">${E.canaux.map((c) => `<li><span><b>${esc(c.nom)}</b> ${c.limite ? `· limite ${R.nombreTexte(c.limite)} caractères` : '· sans limite saisie'}</span><button class="btn petit" data-action="canal" data-id="${c.id}">Modifier</button></li>`).join('')}</ul>
          <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="canal">${ICONES.plus}Canal</button></div>
          <p class="aide">Les limites changent d'un réseau à l'autre et dans le temps : reporte celle qu'affiche ton réseau aujourd'hui. Aucune n'est intégrée à l'outil.</p></section>
        <section class="bloc"><h2 class="titre-section">Formats <span>temps de préparation indicatif</span></h2>
          <ul class="archives">${E.formats.map((f) => `<li><span><b>${esc(f.nom)}</b> · ${f.minutes ? `${f.minutes} min` : 'durée non renseignée'}</span><button class="btn petit" data-action="format" data-id="${f.id}">Modifier</button></li>`).join('')}</ul>
          <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="format">${ICONES.plus}Format</button></div></section>
      </div>`;
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
      if (d.open) d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }

  const options = (liste, sel, vide) => `${vide ? `<option value="">${vide}</option>` : ''}${liste.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}`;

  // Compteur affiché sous le texte (mis à jour à chaque frappe).
  function compteurHtml(texte, idCanal) {
    const k = R.compter(texte, { limite: canal(idCanal)?.limite, accroche: E.reglages.longueurAccroche });
    const jauge = k.limite ? `<div class="jauge-texte ${k.depasse ? 'depasse' : ''}" aria-hidden="true"><i style="width:${Math.min(100, (k.caracteres / k.limite) * 100)}%"></i></div>` : '';
    return `${jauge}<p class="compteur-texte"><b class="${k.depasse ? 'rouge' : ''}">${R.nombreTexte(k.caracteres)}${k.limite ? ` / ${R.nombreTexte(k.limite)}` : ''} caractères</b>${k.limite ? `<span>${k.depasse ? `${R.nombreTexte(-k.reste)} de trop` : `reste ${R.nombreTexte(k.reste)}`}</span>` : '<span>aucune limite saisie pour ce canal</span>'}<span>${pluriel(k.mots, 'mot')}</span><span>${pluriel(k.hashtags, 'hashtag')}</span></p>
      <p class="compteur-texte"><span class="${k.accroche.depasse ? 'rouge' : ''}">Accroche : ${k.accroche.caracteres} caractères${k.accroche.depasse ? ` (repère ${E.reglages.longueurAccroche}, à raccourcir)` : ''}</span>${k.aRemplacer ? `<span class="rouge">${pluriel(k.aRemplacer, 'passage')} [entre crochets] à remplacer</span>` : ''}</p>`;
  }

  function modaleContenu(id, defaut = {}) {
    const c = id ? contenu(id) : null;
    const t = auj();
    const x = c || { titre: '', pilier: defaut.pilier || E.piliers[0]?.id || '', format: E.formats[0]?.id || '', canal: E.canaux[0]?.id || '', statut: defaut.date ? 'programme' : 'idee', date: defaut.date || '', heure: '', texte: '', notes: '', trame: '' };
    const origine = c?.recycleDe ? contenu(c.recycleDe) : null;
    const corps = `
      <label class="champ">Sujet <small>titre interne, il n'est pas publié</small><input name="titre" maxlength="140" value="${esc(x.titre)}" required placeholder="Ex. : trois questions avant d'accepter une mission"></label>
      <fieldset class="champ"><legend>Statut</legend><div class="choix-statut">${R.STATUTS.map((s) => `<label><input type="radio" name="statut" value="${s}" ${x.statut === s ? 'checked' : ''}><span>${FORME_STATUT[s]}${R.LIB_STATUT[s]}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Date <small>obligatoire si programmé ou publié</small><input type="date" name="date" value="${esc(x.date || '')}"></label>
        <label class="champ">Heure <small>facultative</small><input type="time" name="heure" value="${esc(x.heure || '')}"></label>
      </div>
      <div class="rang-champs trois">
        <label class="champ">Pilier<select name="pilier">${options(E.piliers, x.pilier, 'Sans pilier')}</select></label>
        <label class="champ">Format<select name="format">${options(E.formats, x.format)}</select></label>
        <label class="champ">Canal<select name="canal" id="champ-canal">${options(E.canaux, x.canal)}</select></label>
      </div>
      <div class="champ">
        <div class="texte-tete"><label for="texte">Texte</label>
          <span class="outils-texte"><select id="trame" aria-label="Trame à insérer"><option value="">Insérer une trame…</option>${B.trames.map((tr) => `<option value="${tr.id}" ${x.trame === tr.id ? 'selected' : ''}>${esc(tr.nom)}</option>`).join('')}</select><button type="button" class="btn petit" data-action="copier-texte">Copier le texte</button></span></div>
        <textarea id="texte" name="texte" rows="${estTel() ? 9 : 12}" placeholder="Écris ici. La première ligne est ton accroche.">${esc(x.texte)}</textarea>
        <div id="compteur">${compteurHtml(x.texte, x.canal)}</div>
      </div>
      <label class="champ">Notes <small>visuel, lien à mettre en commentaire, idées de relance…</small><textarea name="notes" rows="2">${esc(x.notes)}</textarea></label>
      ${origine ? `<p class="aide">Reprise de « ${esc(origine.titre)} », publié le ${esc(fmt(origine.date, { day: 'numeric', month: 'long', year: 'numeric' }))}.</p>` : ''}
      <p class="aide">Rien n'est publié par l'outil : copie le texte, publie-le sur ton réseau, puis passe le contenu en « Publié ».</p>
      <p class="erreur" role="alert"></p>`;
    const pied = `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${c && c.statut === 'publie' ? '<button class="btn gauche" value="stats">Statistiques</button><button class="btn" value="recycler">Recycler</button>' : ''}${c ? `<button class="btn danger${c.statut === 'publie' ? '' : ' gauche'}" value="supprimer">Supprimer</button>` : ''}`;
    ouvrirModale(c ? 'Contenu' : 'Nouveau contenu', corps, pied, (f, bouton) => {
      if (bouton === 'supprimer') {
        if (!confirm(`Supprimer « ${c.titre} »${c.stats ? ' et ses statistiques' : ''} ?`)) return '';
        retenir(); E.contenus = E.contenus.filter((y) => y.id !== c.id);
        E.contenus.forEach((y) => { if (y.recycleDe === c.id) y.recycleDe = null; });
        sauver(); rendre(); toast(`« ${c.titre} » supprimé.`, { libelle: 'Annuler', faire: annuler }); return;
      }
      const brut = { titre: String(f.get('titre') || '').trim(), statut: f.get('statut'), date: f.get('date') || null, heure: f.get('heure') || '', pilier: f.get('pilier') || '', format: f.get('format') || '', canal: f.get('canal') || '', texte: String(f.get('texte') || ''), notes: String(f.get('notes') || ''), trame: $('#trame')?.value || x.trame || '' };
      if (brut.statut === 'publie' && (!brut.date || brut.date > t)) brut.date = brut.date && brut.date > t ? t : (brut.date || t);
      const err = R.verifierContenu(brut);
      if (err) return err;
      retenir();
      let cible = c;
      if (c) {
        const statsAvant = c.stats, statsLeAvant = c.statsLe;
        Object.assign(c, R.normaliserContenu({ ...c, ...brut, stats: brut.statut === 'publie' ? statsAvant : null, statsLe: brut.statut === 'publie' ? statsLeAvant : null }, t));
      } else { cible = R.normaliserContenu(brut, t); E.contenus.push(cible); }
      sauver(); rendre();
      if (bouton === 'stats') return modaleStats(cible.id);
      if (bouton === 'recycler') return faireRecycler(cible);
      toast(c ? 'Contenu enregistré.' : `Contenu ajouté : ${R.LIB_STATUT[cible.statut].toLowerCase()}${cible.date ? ` le ${fmt(cible.date, { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.`, c ? null : { libelle: 'Annuler', faire: annuler });
    }, true);
    const zone = $('#texte');
    const maj = () => { $('#compteur').innerHTML = compteurHtml(zone.value, $('#champ-canal').value); };
    zone.addEventListener('input', maj);
    $('#champ-canal').addEventListener('change', maj);
    $('#trame').addEventListener('change', (e) => {
      const tr = B.trames.find((y) => y.id === e.target.value);
      if (!tr) return;
      if (zone.value.trim() && !confirm('Ajouter la trame à la fin du texte actuel ?')) { e.target.value = ''; return; }
      zone.value = zone.value.trim() ? `${zone.value.trimEnd()}\n\n${tr.texte}` : tr.texte;
      maj(); zone.focus();
    });
  }

  function modaleStats(id) {
    const c = contenu(id);
    if (!c) return;
    const s = c.stats || {};
    const corps = `
      <p><b>${esc(c.titre)}</b><br><span class="discret">Publié le ${esc(fmt(c.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${canal(c.canal) ? ` sur ${esc(canal(c.canal).nom)}` : ''}</span></p>
      <div class="grille-stats">${B.statistiques.map((x) => `<label class="champ">${esc(x.nom)} <small>${esc(x.aide)}</small><input name="${x.id}" inputmode="numeric" value="${s[x.id] ?? ''}" autocomplete="off" placeholder="non renseigné"></label>`).join('')}</div>
      <p class="aide">Reporte les chiffres affichés par ton réseau ; laisse vide ce qu'il n'indique pas. Les contacts générés se comptent à la main : messages, demandes de rendez-vous ou de devis venus de ce contenu.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Statistiques', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${c.stats ? '<button class="btn danger gauche" value="effacer">Effacer</button>' : ''}`, (f, bouton) => {
      if (bouton === 'effacer') { retenir(); c.stats = null; c.statsLe = null; sauver(); rendre(); toast('Statistiques effacées.', { libelle: 'Annuler', faire: annuler }); return; }
      const v = {};
      for (const x of B.statistiques) {
        const n = R.lireEntier(f.get(x.id));
        if (Number.isNaN(n)) return `${x.nom} : saisis un nombre entier positif (ou laisse vide).`;
        v[x.id] = n;
      }
      retenir();
      c.stats = R.normaliserStats(v);
      c.statsLe = c.stats ? auj() : null;
      sauver(); rendre();
      const e = R.engagement(c.stats);
      toast(c.stats ? `Statistiques enregistrées${e.taux !== null ? ` : taux d'interaction ${String(e.taux).replace('.', ',')} %` : ''}.` : 'Aucun chiffre saisi.');
    });
  }

  function faireRecycler(c) {
    retenir();
    const n = R.recycler(E, c, auj(), B);
    sauver(); rendre();
    toast(`Reprise créée en ${n.statut === 'brouillon' ? 'brouillon' : 'idée'} : change l'accroche et la forme.`, { libelle: 'Ouvrir', faire: () => modaleContenu(n.id) });
  }

  function avancer(c) {
    const t = auj();
    const suivant = R.statutSuivant(c.statut);
    if (suivant === 'programme' && !c.date) {
      const libre = R.joursLibres(E, t, 1)[0] || t;
      return ouvrirModale('Programmer', `<p><b>${esc(c.titre)}</b></p><label class="champ">Date de publication<input type="date" name="date" value="${libre}" required></label><label class="champ">Heure <small>facultative</small><input type="time" name="heure" value="${esc(c.heure)}"></label><p class="aide">Proposé : ton prochain jour préféré encore libre.</p><p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Programmer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
        const d = f.get('date');
        if (!d) return 'Choisis une date.';
        retenir(); R.changerStatut(c, 'programme', t, d); c.heure = f.get('heure') || c.heure;
        sauver(); rendre(); toast(`Programmé le ${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}.`, { libelle: 'Annuler', faire: annuler });
      });
    }
    retenir();
    const err = R.changerStatut(c, suivant, t);
    if (err) return toast(err);
    sauver(); rendre();
    if (suivant === 'brouillon') { modaleContenu(c.id); return; }
    toast(suivant === 'publie' ? `« ${c.titre} » publié. Pense à saisir ses statistiques dans une semaine.` : `« ${c.titre} » : ${R.LIB_STATUT[suivant].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleBanque() {
    let metier = E.metier;
    const rendreBanque = () => {
      const sujets = R.sujetsPour(B, metier);
      const presents = new Set(E.contenus.map((c) => c.titre));
      return `
        <label class="champ">Métier<select id="banque-metier"><option value="">Sujets généraux seulement</option>${options(B.metiers, metier)}</select></label>
        <p class="aide">${sujets.length} sujets, avec le pilier, le format et la trame proposés. Coche ceux à ajouter à tes idées : tu les adapteras à ta façon.</p>
        <div class="choix-base">${E.piliers.concat([{ id: '', nom: 'Autres piliers', couleur: 'ciel' }]).map((p) => {
          const liste = sujets.filter((s) => (p.id ? s.pilier === p.id : !E.piliers.some((x) => x.id === s.pilier)));
          if (!liste.length) return '';
          return `<fieldset class="choix-theme" style="--c:${teinte(p.couleur).hex}"><legend><i></i>${esc(p.nom)}</legend>${liste.map((s) => `<label class="case"><input type="checkbox" name="sujet" value="${esc(s.sujet)}" ${presents.has(s.sujet) ? 'checked disabled' : ''}><span>${esc(s.sujet)} <small>${esc(B.formats.find((f) => f.id === s.format)?.nom || '')}${presents.has(s.sujet) ? ' · déjà dans tes idées' : ''}</small></span></label>`).join('')}</fieldset>`;
        }).join('')}</div>
        <p class="erreur" role="alert"></p>`;
    };
    ouvrirModale('Banque de sujets', rendreBanque(), '<button class="btn primaire" value="ok">Ajouter aux idées</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const choisis = f.getAll('sujet');
      if (!choisis.length) return 'Coche au moins un sujet.';
      retenir();
      const n = R.ajouterSujets(E, B.idees.filter((s) => choisis.includes(s.sujet)), auj());
      sauver(); rendre();
      toast(`${pluriel(n, 'idée ajoutée', 'idées ajoutées')}.`, { libelle: 'Annuler', faire: annuler });
    }, true);
    const brancher = () => $('#banque-metier').addEventListener('change', (e) => { metier = e.target.value; modale().querySelector('.modale-corps').innerHTML = rendreBanque(); brancher(); });
    brancher();
  }

  function modalePilier(id) {
    const p = id ? pilier(id) : null;
    const prises = new Set(E.piliers.filter((x) => x.id !== id).map((x) => x.couleur));
    const libre = COULEURS.find((c) => !prises.has(c));
    if (!p && !libre) { toast(`${COULEURS.length} piliers au plus, une couleur chacun : regroupe tes sujets dans un pilier existant.`); return; }
    const x = p || { nom: '', couleur: libre, part: 10, description: '' };
    const nb = p ? E.contenus.filter((c) => c.pilier === p.id).length : 0;
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="40" value="${esc(x.nom)}" required placeholder="Ex. : Cas clients"></label>
      <label class="champ">Part visée (%) <small>part des contenus que tu veux consacrer à ce pilier</small><input name="part" inputmode="numeric" value="${x.part}"></label>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c) => `<label title="${esc(c.nom)}"><input type="radio" name="couleur" value="${c.id}" ${c.id === x.couleur ? 'checked' : ''} ${prises.has(c.id) ? 'disabled' : ''}><span class="${prises.has(c.id) ? 'prise' : ''}" style="--c:${c.hex}"></span><span class="sr-only">${esc(c.nom)}${prises.has(c.id) ? ' (déjà prise)' : ''}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Description <small>ce que tu ranges dans ce pilier</small><textarea name="description" rows="2" maxlength="240">${esc(x.description)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le pilier' : 'Nouveau pilier', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${p ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, bouton) => {
      if (bouton === 'supprimer') {
        if (E.piliers.length < 2) return 'Garde au moins un pilier.';
        if (nb && !confirm(`${pluriel(nb, 'contenu')} de ce pilier passeront « sans pilier ». Supprimer ?`)) return '';
        retenir(); E.piliers = E.piliers.filter((y) => y.id !== p.id); E.contenus.forEach((c) => { if (c.pilier === p.id) c.pilier = ''; });
        sauver(); rendre(); toast('Pilier supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au pilier.';
      const part = R.lireEntier(f.get('part'));
      if (part === null || Number.isNaN(part) || part > 100) return 'Part visée : un nombre entre 0 et 100.';
      retenir();
      const val = { nom, part, couleur: f.get('couleur') || x.couleur, description: String(f.get('description') || '').trim() };
      if (p) Object.assign(p, val); else E.piliers.push({ id: R.nouvelId(), ...val });
      sauver(); rendre(); toast('Pilier enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleCanal(id) {
    const c = id ? canal(id) : null;
    const x = c || { nom: '', limite: null };
    const nb = c ? E.contenus.filter((y) => y.canal === c.id).length : 0;
    ouvrirModale(c ? 'Modifier le canal' : 'Nouveau canal', `
      <label class="champ">Nom <small>comme tu veux l'appeler</small><input name="nom" maxlength="40" value="${esc(x.nom)}" required placeholder="Ex. : Réseau professionnel, lettre d'information"></label>
      <label class="champ">Limite de caractères <small>facultative, celle qu'affiche ton réseau aujourd'hui</small><input name="limite" inputmode="numeric" value="${x.limite ?? ''}" placeholder="aucune"></label>
      <p class="aide">Aucune limite n'est intégrée à l'outil : elles changent selon les réseaux et dans le temps. Vérifie-la sur ton réseau avant de la saisir.</p>
      <p class="erreur" role="alert"></p>`, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${c ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, bouton) => {
      if (bouton === 'supprimer') {
        if (E.canaux.length < 2) return 'Garde au moins un canal.';
        if (nb) return `${pluriel(nb, 'contenu utilise', 'contenus utilisent')} ce canal : change-leur de canal d'abord.`;
        retenir(); E.canaux = E.canaux.filter((y) => y.id !== c.id); sauver(); rendre(); toast('Canal supprimé.', { libelle: 'Annuler', faire: annuler }); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au canal.';
      const limite = R.lireEntier(f.get('limite'));
      if (Number.isNaN(limite)) return 'Limite : un nombre entier, ou vide.';
      retenir();
      if (c) Object.assign(c, { nom, limite: limite || null }); else E.canaux.push({ id: R.nouvelId(), nom, limite: limite || null });
      sauver(); rendre(); toast('Canal enregistré.');
    });
  }

  function modaleFormat(id) {
    const fo = id ? format(id) : null;
    const x = fo || { nom: '', minutes: 30 };
    const nb = fo ? E.contenus.filter((y) => y.format === fo.id).length : 0;
    ouvrirModale(fo ? 'Modifier le format' : 'Nouveau format', `
      <label class="champ">Nom<input name="nom" maxlength="40" value="${esc(x.nom)}" required></label>
      <label class="champ">Temps de préparation (minutes) <small>repère pour planifier ta semaine</small><input name="minutes" inputmode="numeric" value="${x.minutes || ''}"></label>
      <p class="erreur" role="alert"></p>`, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${fo ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (f, bouton) => {
      if (bouton === 'supprimer') {
        if (nb) return `${pluriel(nb, 'contenu utilise', 'contenus utilisent')} ce format.`;
        retenir(); E.formats = E.formats.filter((y) => y.id !== fo.id); sauver(); rendre(); return;
      }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au format.';
      const minutes = R.lireEntier(f.get('minutes'));
      if (Number.isNaN(minutes)) return 'Minutes : un nombre entier.';
      retenir();
      if (fo) Object.assign(fo, { nom, minutes: minutes || 0 }); else E.formats.push({ id: R.nouvelId(), nom, minutes: minutes || 0 });
      sauver(); rendre(); toast('Format enregistré.');
    });
  }

  function modaleRythme() {
    const r = E.reglages;
    ouvrirModale('Rythme et repères', `
      <label class="champ">Publications par semaine<input name="objectif" inputmode="numeric" value="${r.objectifSemaine}"></label>
      <fieldset class="champ"><legend>Jours de publication préférés</legend>${choixJours(r.jours)}</fieldset>
      <div class="rang-champs">
        <label class="champ">Statistiques à saisir après (jours)<input name="delaiStats" inputmode="numeric" value="${r.delaiStats}"></label>
        <label class="champ">Recycler après (jours)<input name="delaiRecyclage" inputmode="numeric" value="${r.delaiRecyclage}"></label>
      </div>
      <label class="champ">Longueur repère de l'accroche (caractères) <small>repère d'écriture QME, pas une règle de réseau</small><input name="accroche" inputmode="numeric" value="${r.longueurAccroche}"></label>
      <label class="champ">Suivi de la régularité depuis <small>les semaines antérieures ne comptent pas</small><input type="date" name="depuis" value="${r.depuis}"></label>
      <p class="erreur" role="alert"></p>`, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const n = (k) => R.lireEntier(f.get(k));
      const obj = n('objectif');
      if (!obj || Number.isNaN(obj) || obj > 14) return 'Publications par semaine : entre 1 et 14.';
      for (const [k, lib] of [['delaiStats', 'Délai des statistiques'], ['delaiRecyclage', 'Délai de recyclage'], ['accroche', 'Longueur de l\'accroche']]) if (!n(k) || Number.isNaN(n(k))) return `${lib} : un nombre entier positif.`;
      retenir();
      E.reglages = { ...r, objectifSemaine: obj, jours: f.getAll('jours').map(Number), delaiStats: n('delaiStats'), delaiRecyclage: n('delaiRecyclage'), longueurAccroche: n('accroche'), depuis: f.get('depuis') || r.depuis };
      E = normaliser(E);
      sauver(); rendre(); toast('Rythme enregistré.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <label class="champ">Prénom<input name="prenom" maxlength="40" value="${esc(E.prenom)}"></label>
      <label class="champ">Métier <small>pour les sujets proposés</small><select name="metier"><option value="">Autre métier</option>${options(B.metiers, E.metier)}</select></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Sauvegarde et export</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie (JSON)</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label><button class="btn petit" type="button" data-action="csv">Contenus en CSV</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes du calendrier, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À savoir</h3><p class="aide">Aucune connexion à un réseau social : l'outil ne publie rien, ne lit aucune statistique et n'envoie aucun message. Les limites de caractères sont celles que tu saisis. Les sujets, trames, durées de préparation et la longueur d'accroche sont des repères QME, à adapter.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      E.prenom = String(f.get('prenom') || '').trim();
      E.metier = String(f.get('metier') || '');
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.piliers) || !Array.isArray(d.contenus)) throw new Error();
        if (!confirm(`Remplacer ton calendrier actuel par cette copie (${pluriel(d.contenus.length, 'contenu')}) ?`)) return;
        const vu = E.tutorielVu; E = normaliser(d); delete E.majLe; E.tutorielVu = Boolean(E.tutorielVu || vu);
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du calendrier éditorial.'); }
    });
  }

  function telecharger(contenuFichier, type, nom) {
    const blob = new Blob([contenuFichier], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `calendrier-editorial-${auj()}.json`);
  const exporterCsv = () => telecharger('﻿' + R.versCsv(E), 'text/csv;charset=utf-8', `contenus-${auj()}.csv`);

  let infobulle = null;
  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((zone) => {
      const montrer = (el) => {
        document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol'));
        el.classList.add('survol');
        if (!infobulle) { infobulle = document.createElement('div'); infobulle.className = 'infobulle'; infobulle.setAttribute('role', 'tooltip'); }
        zone.appendChild(infobulle);
        infobulle.innerHTML = el.dataset.info;
        const rz = zone.getBoundingClientRect(), re = el.getBoundingClientRect();
        const x = Math.min(rz.width - infobulle.offsetWidth - 8, Math.max(8, re.left - rz.left + re.width / 2 - infobulle.offsetWidth / 2));
        infobulle.style.left = `${x}px`;
        infobulle.style.top = `${Math.max(8, re.top - rz.top - infobulle.offsetHeight + 30)}px`;
      };
      const cacher = () => { infobulle?.remove(); document.querySelectorAll('.survol').forEach((x) => x.classList.remove('survol')); };
      zone.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('pointerleave', cacher);
        el.addEventListener('blur', cacher);
      });
    });
  }

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const g = E.reglages;
    const blocs = [
      ['rose', 'D\'une idée à la publication', `Chaque contenu avance d'un statut à l'autre&nbsp;: idée, brouillon, programmé, publié. Le bouton de chaque ligne fait passer à l'étape suivante (<b>Rédiger</b>, <b>Programmer</b>, <b>Marquer publié</b>). Rien n'est publié à ta place&nbsp;: tu publies toi-même, puis tu le marques.`],
      ['beurre', 'Un rythme par semaine', `Ton objectif&nbsp;: ${pluriel(R.objectif(E), 'publication')} par semaine. Une semaine est tenue quand ce nombre de contenus est publié&nbsp;; les semaines tenues d'affilée forment ta série. Une semaine de pause ne compte pas et ne casse pas la série.`],
      ['ciel', 'Des piliers équilibrés', `Chaque contenu appartient à un pilier, une grande famille de sujets avec une part visée. Le <b>Tableau</b> signale le pilier le plus en retard sur sa part, propose des idées de ce pilier et les prochains jours libres parmi tes jours préférés.`],
      ['sable', 'Mesure, puis recycle', `${pluriel(g.delaiStats, 'jour')} après la publication, l'outil te demande les statistiques (vues, réactions, contacts…). Les meilleurs contenus publiés depuis au moins ${pluriel(g.delaiRecyclage, 'jour')} sont proposés à recycler&nbsp;: une reprise, avec une nouvelle forme.`],
    ];
    const corps = `
      <p>Le calendrier te dit quoi publier et quand, suit ta régularité et repère ce qui marche. Ton rôle&nbsp;: noter tes idées, programmer, publier, puis saisir les résultats.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Calendrier</b> montre le mois ou la semaine, <b>Idées</b> tous tes contenus, <b>Statistiques</b> les résultats et <b>Ligne</b> tes piliers, canaux et formats. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton&nbsp;<b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.contenus.length;
    const pied = premier
      ? '<button class="btn primaire" value="contenu">Ajouter ma première idée</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'contenu') setTimeout(() => modaleContenu(null, {}), 0); });
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
      <p>Enregistre ton calendrier sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
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
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 5000);
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const { action, id } = el.dataset;
    const c = id && E ? contenu(id) : null;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(); E.tutorielVu = vu; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'metier': accueil.metier = id; ecranAccueil(); break;
      case 'pilier-accueil': if (el.checked) accueil.piliers.add(el.value); else accueil.piliers.delete(el.value); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau': modaleContenu(null, { date: el.dataset.date }); break;
      case 'ouvrir': if (c) modaleContenu(c.id); break;
      case 'avancer': if (c) avancer(c); break;
      case 'stats': if (c) modaleStats(c.id); break;
      case 'recycler': if (c) faireRecycler(c); break;
      case 'banque': modaleBanque(); break;
      case 'pilier': modalePilier(id); break;
      case 'canal': modaleCanal(id); break;
      case 'format': modaleFormat(id); break;
      case 'rythme': modaleRythme(); break;
      case 'mode-cal': modeCal = el.dataset.val; rendre(); break;
      case 'mois-prec': moisVu = R.moisSuivant(moisVu, -1); rendre(); break;
      case 'mois-suiv': moisVu = R.moisSuivant(moisVu, 1); rendre(); break;
      case 'mois-auj': moisVu = R.premierDuMois(auj()); rendre(); break;
      case 'sem-prec': semaineVue = ajout(semaineVue, -7); rendre(); break;
      case 'sem-suiv': semaineVue = ajout(semaineVue, 7); rendre(); break;
      case 'sem-auj': semaineVue = R.lundiDe(auj()); rendre(); break;
      case 'pause': { retenir(); const p = R.basculerPause(E, el.dataset.lundi); sauver(); rendre(); toast(p ? 'Semaine de pause : elle ne compte pas et ne casse pas ta série.' : 'Pause annulée.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'filtre-statut': filtre.statut = el.dataset.val; rendre(); break;
      case 'periode': periodeStats = Number(el.dataset.val); rendre(); break;
      case 'copier-texte': {
        const texte = $('#texte')?.value || '';
        (navigator.clipboard?.writeText(texte) || Promise.reject()).then(() => toast('Texte copié : colle-le sur ton réseau.'), () => { $('#texte').select(); toast('Sélectionne le texte et copie-le (Ctrl+C ou appui long).'); });
        break;
      }
      default: break;
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset?.action === 'filtre-pilier') { filtre.pilier = el.value; rendre(); }
    if (el.dataset?.action === 'critere') { retenir(); E.reglages.critere = el.value; sauver(); rendre(); }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  MQ_TEL.addEventListener('change', () => { if (E && $('#vue')) rendre(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // le jour a pu changer
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
  window.__calendrier = { etat: () => E, regles: R };
  init();
})();
