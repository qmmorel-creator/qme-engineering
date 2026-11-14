// Assemblée générale et vie statutaire QME : membres votants (cotisation à jour), réunions des instances (AG
// ordinaire et extraordinaire, conseil, bureau), rétroplanning daté depuis le délai de convocation des statuts,
// convocation et ordre du jour à copier, feuille de présence et pouvoirs, quorum et majorités calculés selon les
// règles saisies, votes, procès-verbal imprimable, mandats et échéances de renouvellement, archive par année.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi d'e-mail par l'outil. Les statuts font foi.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.AGS;
  const API = '/api/templates';
  const PRODUIT = 'AGS';
  const CLE_CODE = 'qme-ags-code';
  const CLE_CACHE = 'qme-ags-cache';
  const CLE_DEMO = 'qme-ags-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-ags-ecran-accueil';

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
  const dateLongue = (s) => (s ? fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'date à fixer');
  const dateCourte = (s) => (s ? fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : 'sans date');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const quand = (n) => (n === 0 ? 'aujourd\'hui' : n === 1 ? 'demain' : n === -1 ? 'hier' : n > 0 ? (n > 60 ? `dans ${Math.round(n / 30)} mois` : `dans ${n} jours`) : (-n > 60 ? `il y a ${Math.round(-n / 30)} mois` : `il y a ${-n} jours`));
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const COULEUR_INSTANCE = { ago: 'ciel', age: 'rose', ca: 'jaune', bureau: 'sable' };
  const NOM_PRESENCE = { present: 'Présent', represente: 'Représenté', excuse: 'Excusé', absent: 'Absent' };
  const RAISONS = { 'non-admis': 'pouvoirs non admis par les statuts', 'sans-mandataire': 'mandataire à choisir', 'soi-meme': 'mandataire identique au membre', 'mandataire-absent': 'mandataire absent', plafond: 'plafond de pouvoirs atteint' };
  const ETAT_MANDAT = { 'en-cours': ['En cours', 'ciel'], 'a-renouveler': ['À renouveler', 'jaune'], echu: ['Échu', 'rouge'], clos: ['Terminé', 'sable'], 'a-venir': ['À venir', 'sable'] };
  const RESULTAT = { adoptee: ['Adoptée', 'vert'], rejetee: ['Rejetée', 'rouge'], 'sans-quorum': ['Sans quorum', 'rose'], 'non-vote': ['À voter', 'sable'], invalide: ['Décompte à vérifier', 'rouge'] };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'apercu';
  let fiche = null; // réunion ouverte
  let onglet = 'preparation'; // partie de la réunion ouverte
  const filtre = { reunions: 'a-venir', membres: 'tous', q: '', mandats: 'actifs' };
  let annulation = null;

  const normaliser = (d) => R.normaliser(d);
  const reunion = (id) => R.reunion(E, id);
  const membre = (id) => R.membre(E, id);
  const regle = (instance) => R.regle(E, instance);
  const nomInstance = (i) => regle(i).nom;
  const courtInstance = (i) => regle(i).court;
  const etiqInstance = (r) => `<span class="etiquette ${COULEUR_INSTANCE[r.instance]}">${esc(courtInstance(r.instance))}${r.convocationNo === 2 ? ' · 2<sup>e</sup> conv.' : ''}</span>`;

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
        toast('Un autre appareil a modifié les données entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
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
  // Un texte en cours de saisie a le focus : ne pas redessiner sous les doigts.
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
  // Code interne (AGS-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
    if (E && (E.association.nom || E.membres.length || E.reunions.length)) { cache(false); demarrer(); } else ecranAccueil();
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
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // Association fictive « Les Amis du Val Fleuri » (Valbrune, commune inventée) : 24 membres (3 membres d'honneur
  // non votants, 4 cotisations en retard), bureau et conseil avec une présidence à renouveler à l'AG et une
  // vice-présidence échue, AG ordinaire dans 26 jours (préparation en cours, une étape en retard, deux pouvoirs
  // déjà reçus), bureau dans 6 jours, conseil il y a 40 jours (PV à signer), AG de l'an dernier (archivée), AG
  // extraordinaire sans quorum puis tenue en seconde convocation (statuts modifiés aux deux tiers).
  function donneesDemo() {
    const t = auj();
    const e = R.etatVide();
    e.association = R.normaliserAssociation({ nom: 'Les Amis du Val Fleuri', ville: 'Valbrune', siege: 'Maison des associations, 1 rue de la Gare, 99100 Valbrune', signataire: 'Claire Martel', qualite: 'Présidente' });
    const rg = e.regles.instances;
    Object.assign(rg.ago, { delai: 15, reference: 'Statuts, article 11', verifiee: true });
    Object.assign(rg.age, { delai: 15, reference: 'Statuts, article 12', verifiee: true });
    Object.assign(rg.ca, { delai: 8, reference: 'Statuts, article 9', verifiee: true });
    Object.assign(rg.bureau, { delai: 7, reference: 'Statuts, article 10', verifiee: true });
    e.regles.majorites.find((m) => m.id === 'deux-tiers').reference = 'Statuts, article 12 (modification des statuts)';
    const noms = [
      ['Claire Martel', 'Membre fondateur', true, 'claire.martel'], ['Marc Delorme', 'Membre actif', true, 'marc.d'], ['Inès Benali', 'Membre actif', true, 'ines.b'],
      ['Paul Renaud', 'Membre actif', true, ''], ['Sophie Garnier', 'Membre actif', true, 'sophie.g'], ['Hugo Lefèvre', 'Membre actif', true, 'hugo.l'],
      ['Nadia Haddad', 'Membre actif', true, 'nadia.h'], ['Julien Morin', 'Membre actif', true, ''], ['Léa Fontaine', 'Membre actif', true, 'lea.f'],
      ['Thomas Picard', 'Membre actif', true, 'thomas.p'], ['Camille Roux', 'Membre actif', true, 'camille.r'], ['Yanis Mercier', 'Membre actif', true, ''],
      ['Élodie Chevalier', 'Membre bienfaiteur', true, 'elodie.c'], ['Bernard Colin', 'Membre actif', true, 'bernard.c'], ['Fatou Diallo', 'Membre actif', true, 'fatou.d'],
      ['Antoine Perrin', 'Membre actif', true, ''], ['Manon Girard', 'Membre actif', true, 'manon.g'], ['Rémi Gauthier', 'Membre actif', false, 'remi.g'],
      ['Chantal Robin', 'Membre actif', false, ''], ['Lucas Bonnet', 'Membre actif', false, 'lucas.b'], ['Sarah Lemaire', 'Membre actif', false, 'sarah.l'],
      ['Odette Marchand', 'Membre d\'honneur', true, ''], ['Gérard Vidal', 'Membre d\'honneur', true, ''], ['Jeanne Arnaud', 'Membre d\'honneur', true, ''],
    ];
    noms.forEach(([nom, categorie, cotisation, mail], i) => e.membres.push(R.normaliserMembre({ id: `m${i + 1}`, nom, categorie, cotisation, votant: categorie !== 'Membre d\'honneur', email: mail ? `${mail}@asso.example` : '', entree: ajout(t, -400 - i * 97) })));
    const M = (membre, instance, fonction, debut, duree = 3, extra = {}) => e.mandats.push(R.normaliserMandat({ membre, instance, fonction, debut, duree, ...extra }));
    const ilYa = (ans, jours = 0) => ajout(R.ajoutAnnees(t, -ans), jours);
    M('m1', 'bureau', 'Présidente', ilYa(3, 20));
    M('m2', 'bureau', 'Trésorier', ilYa(2, 20));
    M('m3', 'bureau', 'Secrétaire', ilYa(1, 12));
    M('m4', 'bureau', 'Vice-président', ilYa(3, -12));
    M('m5', 'ca', 'Administratrice', ilYa(2, 20));
    M('m6', 'ca', 'Administrateur', ilYa(1, 12));
    M('m7', 'ca', 'Administratrice', ilYa(3, 20));
    M('m8', 'ca', 'Administrateur', ilYa(1, 12));
    M('m9', 'ca', 'Administratrice', ilYa(2, 20));
    // Ancien mandat terminé (historique).
    M('m10', 'bureau', 'Trésorier', ilYa(5, 20), 3, { closLe: ilYa(2, 20) });

    const nouvelle = (o) => { const r = R.nouvelleReunion(B, e, o); e.reunions.push(r); return r; };
    const presences = (r, statuts) => {
      r.emargement = R.construireEmargement(e, r, t);
      for (const [id, statut, mandataire] of statuts) { const l = r.emargement.find((x) => x.membre === id); if (l) { l.statut = statut; l.mandataire = mandataire || ''; } }
    };
    const toutFait = (r) => r.etapes.forEach((x) => { x.fait = true; });
    const P = (r, i, o) => Object.assign(r.points[i], o);

    // AG ordinaire de l'an dernier : tenue, PV signé.
    const agp = nouvelle({ instance: 'ago', date: ilYa(1, 12), heure: '14:30', lieu: 'salle polyvalente, 2 place de la Mairie, Valbrune' });
    Object.assign(agp, { convoqueLe: ilYa(1, -6), president: 'Claire Martel', secretaire: 'Inès Benali', heureFin: '17:10', pvSigneLe: ilYa(1, 30) });
    toutFait(agp);
    presences(agp, [['m1', 'present'], ['m2', 'present'], ['m3', 'present'], ['m4', 'present'], ['m5', 'present'], ['m6', 'present'], ['m7', 'present'], ['m9', 'present'], ['m10', 'present'], ['m11', 'present'], ['m13', 'present'], ['m8', 'represente', 'm1'], ['m12', 'represente', 'm2'], ['m14', 'represente', 'm5'], ['m15', 'excuse'], ['m16', 'excuse']]);
    P(agp, 0, { notes: '11 membres présents et 3 représentés sur 17 membres votants.' });
    P(agp, 1, { pour: 14, contre: 0, abstention: 0, notes: 'La présidente retrace l\'année : quatre sorties, la fête du jardin partagé, l\'arrivée de six nouveaux membres.' });
    P(agp, 2, { pour: 14, contre: 0, abstention: 0 });
    P(agp, 3, { pour: 12, contre: 0, abstention: 2, notes: 'Le trésorier présente un exercice à l\'équilibre ; deux membres s\'abstiennent faute d\'avoir reçu les comptes à l\'avance.' });
    P(agp, 4, { pour: 10, contre: 3, abstention: 1, resolution: 'L\'assemblée adopte le budget prévisionnel et fixe la cotisation annuelle à 20 €.' });
    P(agp, 5, { pour: 14, contre: 0, abstention: 0, resolution: 'Sont élus : Inès Benali au conseil et au bureau (secrétaire), Hugo Lefèvre et Julien Morin au conseil.' });

    // AG extraordinaire : quorum non atteint en première convocation, puis seconde convocation sans quorum.
    const age1 = nouvelle({ instance: 'age', date: ilYa(1, 60), heure: '18:30', lieu: 'Maison des associations, salle 2' });
    Object.assign(age1, { convoqueLe: ilYa(1, 42), president: 'Claire Martel', secretaire: 'Inès Benali', heureFin: '18:45', pvSigneLe: ilYa(1, 62) });
    toutFait(age1);
    presences(age1, [['m1', 'present'], ['m2', 'present'], ['m3', 'present'], ['m5', 'present'], ['m9', 'present'], ['m4', 'represente', 'm1'], ['m6', 'represente', 'm3']]);
    age1.points.forEach((p) => { if (p.vote) Object.assign(p, { pour: null, contre: null, abstention: null }); });
    P(age1, 0, { notes: 'Le quorum n\'est pas atteint : une seconde assemblée est convoquée.' });
    const age2 = nouvelle({ instance: 'age', date: ilYa(1, 75), heure: '18:30', lieu: 'Maison des associations, salle 2', convocationNo: 2 });
    Object.assign(age2, { convoqueLe: ilYa(1, 61), president: 'Claire Martel', secretaire: 'Inès Benali', heureFin: '19:40', pvSigneLe: ilYa(1, 80) });
    toutFait(age2);
    presences(age2, [['m1', 'present'], ['m2', 'present'], ['m3', 'present'], ['m4', 'present'], ['m5', 'present'], ['m7', 'present'], ['m9', 'present'], ['m11', 'present'], ['m6', 'represente', 'm3'], ['m13', 'represente', 'm1']]);
    P(age2, 1, { notes: 'Nouvel objet (jardin partagé et ateliers), cotisation annuelle fixée par l\'AG, mandats portés à trois ans.' });
    P(age2, 2, { pour: 8, contre: 1, abstention: 1 });
    P(age2, 3, { pour: 10, contre: 0, abstention: 0 });

    // Conseil il y a 40 jours : tenu, procès-verbal à faire signer.
    const ca = nouvelle({ instance: 'ca', date: ajout(t, -40), heure: '19:00', lieu: 'au local, 4 rue des Jardins' });
    Object.assign(ca, { convoqueLe: ajout(t, -50), president: 'Claire Martel', secretaire: 'Inès Benali', heureFin: '21:00' });
    ca.etapes.forEach((x) => { x.fait = x.cle !== 'pv'; });
    presences(ca, [['m1', 'present'], ['m2', 'present'], ['m3', 'present'], ['m5', 'present'], ['m7', 'present'], ['m9', 'present'], ['m4', 'represente', 'm1'], ['m6', 'excuse']]);
    P(ca, 0, { pour: 6, contre: 0, abstention: 0 });
    P(ca, 1, { notes: 'Trésorerie : 2 140 € au compte courant. Inscriptions de rentrée : 31 adhérents.' });
    P(ca, 2, { titre: 'Date et ordre du jour de l\'assemblée générale', resolution: `L'assemblée générale ordinaire est fixée au ${R.dateTexte(ajout(t, 26))}.`, pour: 6, contre: 0, abstention: 0 });

    // Bureau dans 6 jours : convocation envoyée.
    const bu = nouvelle({ instance: 'bureau', date: ajout(t, 6), heure: '18:30', lieu: 'chez Claire, en visio pour Marc', titre: 'Bureau : préparation de l\'AG' });
    bu.convoqueLe = ajout(t, -3);
    bu.etapes.forEach((x) => { if (x.cle === 'odj' || x.cle === 'convocation') x.fait = true; });
    bu.points = [{ titre: 'Relecture des rapports moral et financier', vote: false }, { titre: 'Liste des candidatures au conseil', vote: false }, { titre: 'Organisation du pot de l\'AG', vote: false }].map(R.normaliserPoint);

    // AG ordinaire dans 26 jours : en préparation.
    const ag = nouvelle({ instance: 'ago', date: ajout(t, 26), heure: '14:30', lieu: 'salle polyvalente, 2 place de la Mairie, Valbrune' });
    ag.etapes.forEach((x) => { if (x.cle === 'date' || x.cle === 'comptes') x.fait = true; });
    P(ag, 5, { titre: 'Renouvellement de la présidence et du conseil', resolution: 'Sont élus : [noms et fonctions].' });
    presences(ag, [['m6', 'represente', 'm1'], ['m12', 'represente', 'm2']]);
    e.reunions.sort((a, b) => a.date.localeCompare(b.date));
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'aide à l\'organisation : les statuts de ton association font foi, et l\'outil ne remplace pas un conseil juridique. Quorums, pouvoirs et majorités sont calculés avec les règles que tu as saisies. Données des membres : garde le minimum (nom, e-mail facultatif) et supprime la fiche d\'un membre qui quitte l\'association.</p>';

  function ecranConnexion(message = '') {
    document.title = 'Assemblée générale et vie statutaire · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="150" width="200" height="130" fill="#1D4E89"/>
          <path d="M20 150 L120 70 L220 150 Z" fill="#D9302A"/>
          <rect x="60" y="190" width="24" height="90" fill="#F5B400"/><rect x="108" y="190" width="24" height="90" fill="#F5B400"/><rect x="156" y="190" width="24" height="90" fill="#F5B400"/>
          <rect x="270" y="60" width="120" height="150" fill="none" stroke="#141414" stroke-width="4"/>
          <path d="M292 100h76M292 130h76M292 160h46" stroke="#141414" stroke-width="4"/>
          <circle cx="470" cy="190" r="80" fill="#F0EDE6"/>
          <path d="M470 190 L470 110 A80 80 0 0 1 550 190 Z" fill="#141414"/>
          <circle cx="470" cy="190" r="26" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Assemblée générale et vie statutaire</p>
          <h1>Une AG en règle, sans stress.</h1>
          <p>Le rétroplanning daté depuis tes statuts, la convocation prête, la feuille de présence et les pouvoirs, le quorum et les votes calculés selon tes règles, le procès-verbal imprimé, et les mandats du bureau suivis jusqu'au renouvellement.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton espace</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes membres, réunions et mandats sont enregistrés en ligne et te suivent sur tous tes appareils : partage la clé avec les membres du bureau.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon espace</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'espace ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon espace'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, nom: '', ville: '', signataire: '', qualite: 'Président·e', regles: R.normaliserInstance({}, 'ago'), dureeConseil: 3, verifiee: false });
  let accueil = accueilVide();

  // Champs d'une règle de quorum (premier lancement et modale des statuts).
  function champsQuorum(q, prefixe, { types = R.TYPES_QUORUM, libelle = 'Quorum' } = {}) {
    const noms = { aucun: 'Pas de quorum', fraction: 'Une fraction des membres', nombre: 'Un nombre de membres', identique: 'Le même qu\'en première convocation' };
    return `<fieldset class="champ cadre-champs quorum-champs" data-quorum="${prefixe}"><legend>${libelle}</legend>
      <label class="champ">Règle<select name="${prefixe}-type" data-type-quorum="${prefixe}">${types.map((t) => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${noms[t]}</option>`).join('')}</select></label>
      <div class="rang-champs q-fraction" ${q.type === 'fraction' ? '' : 'hidden'}>
        <label class="champ">Comparaison<select name="${prefixe}-comparaison"><option value="atteint" ${q.comparaison === 'atteint' ? 'selected' : ''}>Au moins</option><option value="plus" ${q.comparaison === 'plus' ? 'selected' : ''}>Plus de</option></select></label>
        <label class="champ">Fraction<span class="fraction-champs"><input name="${prefixe}-num" type="number" min="1" max="1000" inputmode="numeric" value="${q.num}" aria-label="Numérateur"><span>/</span><input name="${prefixe}-den" type="number" min="1" max="1000" inputmode="numeric" value="${q.den}" aria-label="Dénominateur"></span></label>
      </div>
      <label class="champ q-nombre" ${q.type === 'nombre' ? '' : 'hidden'}>Nombre minimum de membres<input name="${prefixe}-nombre" type="number" min="0" max="100000" inputmode="numeric" value="${q.nombre}"></label>
    </fieldset>`;
  }
  const lireQuorum = (f, prefixe) => ({ type: f.get(`${prefixe}-type`), num: f.get(`${prefixe}-num`), den: f.get(`${prefixe}-den`), nombre: f.get(`${prefixe}-nombre`), comparaison: f.get(`${prefixe}-comparaison`) });
  function brancherQuorums(racine = document) {
    racine.querySelectorAll('[data-type-quorum]').forEach((s) => s.addEventListener('change', () => {
      const fs = s.closest('[data-quorum]');
      fs.querySelector('.q-fraction').hidden = s.value !== 'fraction';
      fs.querySelector('.q-nombre').hidden = s.value !== 'nombre';
    }));
  }
  const optionsMajorites = (choisie, { vide = '' } = {}) => `${vide ? `<option value="">${esc(vide)}</option>` : ''}${E.regles.majorites.map((m) => `<option value="${m.id}" ${m.id === choisie ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}`;

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>L'AG et la vie de l'association, au même endroit.</h1>
        <p class="intro">Membres votants, réunions du bureau, du conseil et des assemblées, quorum, votes, procès-verbaux et mandats. Pour commencer, ton association.</p>
        <div class="rang-champs" style="max-width:720px">
          <label class="champ">Nom de l'association<input id="a-nom" value="${esc(a.nom)}" maxlength="100" placeholder="Ex. : Les Amis du Val Fleuri"></label>
          <label class="champ">Ville<small>Pour « Fait à … »</small><input id="a-ville" value="${esc(a.ville)}" maxlength="60"></label>
        </div>
        <div class="rang-champs" style="max-width:720px;margin-top:14px">
          <label class="champ">Signataire des convocations<input id="a-signataire" value="${esc(a.signataire)}" maxlength="80" placeholder="Ex. : Claire Martel"></label>
          <label class="champ">Qualité<input id="a-qualite" value="${esc(a.qualite)}" maxlength="60" list="liste-qualites"><datalist id="liste-qualites">${B.fonctions.bureau.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist></label>
        </div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      const g = a.regles;
      const majs = R.MAJORITES_DEPART;
      corps = `
        <p class="surtitre">Étape 2 · Tes statuts</p>
        <h1>Les règles de ton assemblée générale</h1>
        <p class="intro">Recopie ce que disent tes statuts pour l'assemblée générale ordinaire. Les valeurs proposées ne sont qu'un point de départ, pas des règles légales : c'est ce qu'écrivent tes statuts qui compte. Les autres instances (AG extraordinaire, conseil, bureau) se règlent ensuite dans l'onglet Statuts.</p>
        <form id="form-regles" class="accueil-regles" novalidate>
          <div class="rang-champs">
            <label class="champ">Délai de convocation (jours avant la réunion)<input name="delai" type="number" min="0" max="365" inputmode="numeric" value="${g.delai}"></label>
            <label class="champ">Durée des mandats du conseil (années)<small>0 : sans durée fixée</small><input name="duree" type="number" min="0" max="20" inputmode="numeric" value="${a.dureeConseil}"></label>
          </div>
          ${champsQuorum(g.quorum, 'q', { libelle: 'Quorum de l\'AG ordinaire' })}
          <label class="case"><input type="checkbox" name="pouvoirsQuorum" ${g.pouvoirsQuorum ? 'checked' : ''}> Les membres représentés (pouvoirs) comptent dans le quorum</label>
          ${champsQuorum(g.quorum2, 'q2', { types: R.TYPES_QUORUM2, libelle: 'Si le quorum n\'est pas atteint : seconde convocation' })}
          <div class="rang-champs">
            <label class="champ">Pouvoirs<select name="pouvoirs"><option value="oui" ${g.pouvoirs.autorises ? 'selected' : ''}>Admis</option><option value="non" ${g.pouvoirs.autorises ? '' : 'selected'}>Non admis</option></select></label>
            <label class="champ">Pouvoirs par membre, au plus<small>0 : sans plafond</small><input name="plafond" type="number" min="0" max="100" inputmode="numeric" value="${g.pouvoirs.plafond}"></label>
          </div>
          <label class="champ">Majorité des décisions ordinaires<select name="majorite">${majs.map((m) => `<option value="${m.id}" ${m.id === g.majorite ? 'selected' : ''}>${esc(m.nom)} (${esc(R.texteMajorite(m))})</option>`).join('')}</select></label>
          <label class="champ">Référence dans les statuts<small>Facultatif : « article 11 »</small><input name="reference" maxlength="120" value="${esc(g.reference)}"></label>
          <label class="case case-forte"><input type="checkbox" name="verifiee" ${a.verifiee ? 'checked' : ''}> J'ai recopié ces règles depuis nos statuts</label>
        </form>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer mon espace</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    for (const k of ['nom', 'ville', 'signataire', 'qualite']) $(`#a-${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; });
    brancherQuorums();
  }

  function lireReglesAccueil() {
    const f = new FormData($('#form-regles'));
    accueil.regles = R.normaliserInstance({ ...accueil.regles, delai: f.get('delai'), quorum: lireQuorum(f, 'q'), quorum2: lireQuorum(f, 'q2'), pouvoirsQuorum: f.get('pouvoirsQuorum') === 'on', pouvoirs: { autorises: f.get('pouvoirs') === 'oui', plafond: f.get('plafond') }, majorite: f.get('majorite'), reference: f.get('reference') }, 'ago');
    accueil.dureeConseil = Math.max(0, Math.min(20, Math.round(Number(f.get('duree'))) || 0));
    accueil.verifiee = f.get('verifiee') === 'on';
  }

  function terminerAccueil() {
    lireReglesAccueil();
    const a = accueil;
    E = R.etatVide();
    E.association = R.normaliserAssociation({ nom: a.nom || 'Mon association', ville: a.ville, signataire: a.signataire, qualite: a.qualite });
    E.regles.instances.ago = R.normaliserInstance({ ...a.regles, verifiee: a.verifiee }, 'ago');
    E.regles.instances.ca.duree = a.dureeConseil;
    E.regles.instances.bureau.duree = a.dureeConseil;
    accueil = accueilVide();
    vue = 'membres'; fiche = null;
    sauver();
    demarrer();
    toast('Ton espace est prêt. Ajoute les membres, ou colle leur liste.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    apercu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    reunions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="5" width="18" height="5" fill="currentColor"/><rect x="7" y="2" width="2" height="5" fill="currentColor"/><rect x="15" y="2" width="2" height="5" fill="currentColor"/></svg>',
    membres: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    mandats: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="8" width="4" height="13" fill="currentColor"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    statuts: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    gauche: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    coche: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12 5 5 9-10" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    haut: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m5 15 7-7 7 7" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    bas: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m5 9 7 7 7-7" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  };
  const ONGLETS = [['apercu', 'Aperçu'], ['reunions', 'Réunions'], ['membres', 'Membres'], ['mandats', 'Mandats'], ['statuts', 'Statuts']];
  const PARTIES = [['preparation', 'Préparation'], ['convocation', 'Convocation'], ['presence', 'Présence'], ['votes', 'Votes'], ['pv', 'Procès-verbal']];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/assemblee-generale/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Association et membres fictifs, gardés sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Assemblée<br>générale</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span class="long">${nom}</span></button>`).join('')}</nav>
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
    if (fiche && !reunion(fiche)) fiche = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(ONGLETS);
    const titre = vue === 'reunions' && fiche ? R.titreReunion(E, reunion(fiche)) : titres[vue];
    document.title = `${titre} · Assemblée générale et vie statutaire`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = {
      apercu: vueApercu,
      reunions: () => (fiche ? vueReunion(reunion(fiche)) : vueReunions()),
      membres: vueMembres,
      mandats: vueMandats,
      statuts: vueStatuts,
    }[vue]();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { filtre.q = e.target.value; const pos = e.target.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
  }
  const rendreSurPlace = () => { const y = window.scrollY; rendre(); window.scrollTo({ top: y }); };

  function changerVue(v, { fiche: f = null, partie = null, ancre = null } = {}) {
    vue = v; fiche = f;
    if (partie) onglet = partie;
    history.replaceState(null, '', `#${v}`);
    rendre();
    const cible = ancre && document.getElementById(ancre);
    if (cible) cible.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" class="forme-vide"><rect x="10" y="44" width="76" height="46" fill="#1D4E89"/><path d="M10 44 48 12l38 32Z" fill="#D9302A"/><rect x="26" y="58" width="8" height="32" fill="#F5B400"/><rect x="44" y="58" width="8" height="32" fill="#F5B400"/><rect x="62" y="58" width="8" height="32" fill="#F5B400"/></svg>';

  // ---------- Petits composants ----------
  function barre(pct) { return `<span class="progres" role="img" aria-label="${pct} %"><span style="width:${pct}%"></span></span>`; }
  const etiqMandat = (m) => { const [lib, c] = ETAT_MANDAT[R.etatMandat(m, auj(), E.reglages.alerteMandatJours)]; return `<span class="etiquette ${c}">${lib}</span>`; };
  function etiqReunion(r, t) {
    const et = R.etatReunion(r, t);
    if (et === 'a-venir') {
      const c = R.etatConvocation(E, r, t);
      if (c.etat === 'envoyee') return `<span class="etiquette vert">Convoquée le ${dateCourte(r.convoqueLe)}</span>`;
      if (c.etat === 'tardive') return `<span class="etiquette rouge" title="Envoyée après la date limite des statuts">Convocation tardive</span>`;
      if (c.etat === 'retard') return `<span class="etiquette rouge">Convocation en retard</span>`;
      return `<span class="etiquette ${c.jours <= 7 ? 'jaune' : 'sable'}">À convoquer avant le ${dateCourte(c.limite)}</span>`;
    }
    if (et === 'aujourdhui') return '<span class="etiquette jaune">Aujourd\'hui</span>';
    if (et === 'pv-a-faire') return '<span class="etiquette rose">PV à signer</span>';
    if (et === 'archivee') return `<span class="etiquette sable">PV signé le ${dateCourte(r.pvSigneLe)}</span>`;
    return '<span class="etiquette sable">Date à fixer</span>';
  }
  function jaugeQuorum(qu, pr, avant = false) {
    if (qu.sansQuorum) return `<div class="jauge-quorum ok"><div><b>Pas de quorum requis</b><span>${pr.presents} présents, ${pluriel(pr.representes, 'représenté')} sur ${pr.inscrits}</span></div></div>`;
    const pct = qu.requis ? Math.min(100, Math.round((qu.compte / qu.requis) * 100)) : 100;
    return `<div class="jauge-quorum ${qu.atteint ? 'ok' : avant ? 'attente' : 'ko'}"><div><b>${qu.compte} / ${qu.requis}</b><span>${qu.atteint ? 'Quorum atteint' : avant ? `Quorum à réunir le jour de la réunion : ${pluriel(qu.requis, 'membre')}` : `Quorum non atteint : il manque ${pluriel(qu.manque, 'membre')}`}${qu.pouvoirsComptes ? ' (présents et représentés)' : ' (présents seulement)'}</span></div>${barre(pct)}</div>`;
  }

  // ---------- Aperçu ----------
  function vueApercu() {
    const t = auj();
    const ind = R.indicateurs(E, t);
    const a = E.association;
    const p = ind.prochaine;
    const pAG = R.prochaine(E, t, (r) => R.estAG(r.instance));
    const tuiles = [
      ['Prochaine réunion', p ? (p.date === t ? 'Auj.' : `J-${ecart(t, p.date)}`) : '—', p ? `${esc(courtInstance(p.instance))} · ${dateCourte(p.date)}` : 'aucune réunion prévue', 'var(--bleu)', 'rond', p ? `data-action="reunion" data-id="${p.id}"` : 'data-action="vue" data-vue="reunions"'],
      ['Votants à jour', `${ind.aJour}<small>/${ind.votants}</small>`, ind.enRetardCotisation ? `${pluriel(ind.enRetardCotisation, 'cotisation')} à régulariser` : 'toutes les cotisations sont à jour', 'var(--jaune)', '', 'data-action="filtre-membres" data-filtre="pas-a-jour"'],
      ['Mandats à renouveler', ind.aRenouveler + ind.echus, ind.echus ? `dont ${pluriel(ind.echus, 'échu')}` : `dans les ${E.reglages.alerteMandatJours} jours`, 'var(--rouge)', 'rond', 'data-action="vue" data-vue="mandats"'],
      ['Étapes en retard', ind.etapesRetard, ind.etapesBientot ? `${pluriel(ind.etapesBientot, 'étape')} dans les ${E.reglages.alerteEtapesJours} jours` : 'rien d\'urgent', 'var(--encre)', '', pAG ? `data-action="reunion" data-id="${pAG.id}"` : 'data-action="vue" data-vue="reunions"'],
    ].map(([lib, val, d, c, f, act]) => `<button class="tuile ${f}" style="--c:${c}" ${act}><p class="surtitre">${lib}</p><b>${val}</b><span>${d}</span></button>`).join('');
    // Étapes à faire (retard et prochains jours) de toutes les réunions à venir.
    const aFaire = [];
    for (const r of R.aVenir(E, t).filter((x) => x.date)) for (const e of R.etapesDatees(E, r, t)) if (e.etat === 'retard' || e.etat === 'bientot') aFaire.push({ r, e });
    aFaire.sort((x, y) => x.e.date.localeCompare(y.e.date));
    const alertesMandats = E.mandats.filter((m) => ['echu', 'a-renouveler'].includes(R.etatMandat(m, t, E.reglages.alerteMandatJours))).sort((x, y) => R.finMandat(x).localeCompare(R.finMandat(y)));
    const pvAFaire = E.reunions.filter((r) => R.etatReunion(r, t) === 'pv-a-faire');
    const conv = pAG ? R.etatConvocation(E, pAG, t) : null;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(a.nom || 'Ton association')}</p><h1>${p ? `${esc(R.titreReunion(E, p))} ${quand(ecart(t, p.date))}` : 'Aucune réunion prévue'}</h1><p>${p ? `${majuscule(dateLongue(p.date))}${p.heure ? ` à ${R.heureTexte(p.heure)}` : ''}${p.lieu ? `, ${esc(p.lieu)}` : ''}.` : 'Prépare la prochaine assemblée : le rétroplanning se date tout seul depuis le délai de convocation de tes statuts.'}</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-reunion">${ICONES.plus}Réunion</button><button class="btn" data-action="nouveau-membre">${ICONES.plus}Membre</button></div></div>
      <div class="tuiles">${tuiles}</div>
      ${ind.reglesAVerifier.length ? `<div class="alerte-rgpd alerte-retard"><div><b>Règles à vérifier dans tes statuts : ${ind.reglesAVerifier.map((i) => esc(courtInstance(i))).join(', ')}</b><span>Tant qu'elles ne sont pas confirmées, quorum et majorités sont calculés avec des valeurs d'exemple.</span></div><button class="btn petit" data-action="vue" data-vue="statuts">Vérifier</button></div>` : ''}
      ${conv && (conv.etat === 'a-envoyer' || conv.etat === 'retard') ? `<div class="alerte-rgpd ${conv.etat === 'retard' ? 'alerte-retard' : ''}"><div><b>${conv.etat === 'retard' ? 'Convocation en retard' : `Convocation à envoyer au plus tard le ${dateLongue(conv.limite)}`}</b><span>${esc(R.titreReunion(E, pAG))} du ${dateCourte(pAG.date)} : délai des statuts de ${pluriel(regle(pAG.instance).delai, 'jour')}${conv.etat === 'a-envoyer' ? ` (${quand(conv.jours)})` : ''}.</span></div><button class="btn petit" data-action="reunion" data-id="${pAG.id}" data-partie="convocation">Préparer</button></div>` : ''}
      ${pvAFaire.length ? `<div class="alerte-rgpd"><div><b>${pluriel(pvAFaire.length, 'procès-verbal à faire signer', 'procès-verbaux à faire signer')}</b><span>${pvAFaire.map((r) => `${esc(courtInstance(r.instance))} du ${dateCourte(r.date)}`).join(', ')}</span></div><button class="btn petit" data-action="reunion" data-id="${pvAFaire[0].id}" data-partie="pv">Ouvrir</button></div>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>Rétroplanning des réunions à venir</span></h2>
          ${aFaire.length ? `<ul class="liste-taches">${aFaire.slice(0, 8).map(({ r, e }) => ligneEtape(r, e, t, { avecReunion: true })).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Rien d\'urgent</h3><p>Les étapes en retard ou dues dans les prochains jours s\'afficheront ici.</p></div></div>'}
          <h2 class="titre-section">Prochaines réunions</h2>
          ${R.aVenir(E, t).length ? `<ul class="liste-taches">${R.aVenir(E, t).slice(0, 4).map((r) => ligneReunion(r, t)).join('')}</ul>` : `<div class="vide-etat petit"><div><p>Aucune réunion prévue.</p><div class="actions"><button class="btn petit primaire" data-action="nouvelle-reunion">${ICONES.plus}Réunion</button></div></div></div>`}
        </section>
        <section>
          <h2 class="titre-section">Mandats <span>Échéances de renouvellement</span></h2>
          ${alertesMandats.length ? `<ul class="liste-simple">${alertesMandats.map((m) => ligneMandat(m, t, { compacte: true })).join('')}</ul>` : `<div class="vide-etat petit"><div><p>${E.mandats.length ? `Aucun mandat n'arrive à échéance dans les ${E.reglages.alerteMandatJours} jours.` : 'Aucun mandat saisi : ajoute le bureau et le conseil pour suivre les échéances.'}</p></div></div>`}
          <h2 class="titre-section">Membres</h2>
          <ul class="liste-simple">
            <li class="ligne-total"><span><b>Membres</b><small>dont ${pluriel(ind.membres - ind.votants, 'non votant')}</small></span><b class="nb">${ind.membres}</b></li>
            <li class="ligne-total"><span><b>Votants à jour de cotisation</b><small>liste des votants de l'AG</small></span><b class="nb">${ind.aJour}</b></li>
            <li class="ligne-total"><span><b>Mandats en cours</b><small>bureau et conseil</small></span><b class="nb">${ind.mandatsEnCours}</b></li>
          </ul>
        </section>
      </div>
      ${AVERTISSEMENT}`;
  }

  function ligneEtape(r, e, t, { avecReunion = false } = {}) {
    const st = e.etat === 'fait' ? 'fait' : e.etat === 'retard' ? 'retard' : e.etat === 'bientot' ? 'semaine' : '';
    const quandTxt = e.date ? (e.etat === 'fait' ? dateCourte(e.date) : e.etat === 'retard' ? `En retard · ${dateCourte(e.date)}` : `${majuscule(quand(ecart(t, e.date)))} · ${dateCourte(e.date)}`) : 'date de réunion à fixer';
    return `<li class="ligne-tache st-${st}">
      <button class="case-fait ${e.fait ? 'coche' : ''}" data-action="etape" data-id="${r.id}" data-etape="${e.id}" aria-pressed="${e.fait}" aria-label="${e.fait ? 'Rouvrir' : 'Marquer fait'} : ${esc(e.titre)}">${ICONES.coche}</button>
      <div class="lt-corps"><button class="lien-ligne" data-action="${avecReunion ? 'reunion' : 'modifier-etape'}" data-id="${r.id}" data-etape="${e.id}"><b>${esc(e.titre)}</b><span>${avecReunion ? `${esc(courtInstance(r.instance))} du ${dateCourte(r.date)} · ` : ''}${quandTxt}</span></button></div>
      ${e.etat === 'retard' ? '<span class="etiquette rouge">Retard</span>' : e.etat === 'bientot' ? '<span class="etiquette jaune">Bientôt</span>' : ''}
    </li>`;
  }
  function ligneReunion(r, t) {
    return `<li class="ligne-transverse"><button class="lien-ligne" data-action="reunion" data-id="${r.id}"><b>${esc(R.titreReunion(E, r))}</b><span>${r.date ? `${majuscule(dateLongue(r.date))}${r.heure ? ` · ${R.heureTexte(r.heure)}` : ''}` : 'Date à fixer'}${r.lieu ? ` · ${esc(r.lieu)}` : ''}</span></button><span class="lt-droite">${etiqInstance(r)}${etiqReunion(r, t)}</span></li>`;
  }

  // ---------- Réunions ----------
  function vueReunions() {
    const t = auj();
    const annees = R.parAnnee(E);
    const choix = filtre.reunions;
    const futures = R.aVenir(E, t);
    const passees = E.reunions.filter((r) => r.date && r.date < t);
    let liste, titre;
    if (choix === 'a-venir') { liste = futures; titre = 'À venir'; }
    else if (choix === 'pv') { liste = E.reunions.filter((r) => R.etatReunion(r, t) === 'pv-a-faire'); titre = 'PV à signer'; }
    else { liste = (annees.find(([a]) => a === choix) || [null, []])[1]; titre = choix; }
    const filtres = [['a-venir', 'À venir', futures.length], ['pv', 'PV à signer', E.reunions.filter((r) => R.etatReunion(r, t) === 'pv-a-faire').length], ...annees.filter(([a]) => a !== 'Sans date').map(([a, l]) => [a, a, l.length])];
    return `
      <div class="vue-tete"><div><h1>Réunions</h1><p>Assemblées générales ordinaires et extraordinaires, conseil, bureau : chaque réunion a son rétroplanning, sa convocation, sa feuille de présence, ses votes et son procès-verbal. Les réunions passées forment l'archive, année par année.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-reunion">${ICONES.plus}Réunion</button></div></div>
      <div class="filtres" role="group" aria-label="Choisir les réunions">${filtres.map(([id, lib, n]) => `<button class="filtre" data-action="filtre" data-cle="reunions" data-filtre="${id}" aria-pressed="${choix === id}">${lib} <small>${n}</small></button>`).join('')}</div>
      ${liste.length ? `<ul class="cartes-personnes cartes-reunions">${liste.map((r) => carteReunion(r, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${choix === 'a-venir' ? 'Aucune réunion à venir' : 'Rien ici'}</h3><p>${choix === 'a-venir' ? 'Crée la prochaine assemblée générale : rétroplanning, ordre du jour type et trame de convocation sont prêts.' : 'Aucune réunion dans cette sélection.'}</p><div class="actions"><button class="btn primaire" data-action="nouvelle-reunion">${ICONES.plus}Réunion</button></div></div></div>`}
      ${passees.length && choix === 'a-venir' ? `<p class="mention" style="margin-top:16px">${pluriel(passees.length, 'réunion passée', 'réunions passées')} dans l'archive : choisis une année ci-dessus.</p>` : ''}
      <p class="mention" style="margin-top:8px">${esc(titre)} · export de l'archive (votes et quorum de chaque réunion) dans les réglages.</p>`;
  }
  function carteReunion(r, t) {
    const pr = R.presence(E, r, t);
    const qu = R.quorum(E, r, t, pr);
    const passee = r.date && r.date < t;
    const votes = r.points.filter((p) => p.vote);
    const adoptees = votes.filter((p) => R.resultat(E, r, p, pr, qu).statut === 'adoptee').length;
    const etapes = R.etapesDatees(E, r, t);
    const faites = etapes.filter((e) => e.fait).length;
    return `<li class="carte-personne carte-reunion inst-${r.instance}">
      <button class="cp-corps" data-action="reunion" data-id="${r.id}">
        <span class="cp-tete">${etiqInstance(r)}<span class="cp-date">${r.date ? dateCourte(r.date) : ''}</span></span>
        <b>${esc(R.titreReunion(E, r))}</b>
        <span class="cp-detail">${r.date ? majuscule(dateLongue(r.date)) : 'Date à fixer'}${r.heure ? ` · ${R.heureTexte(r.heure)}` : ''}${r.lieu ? `<br>${esc(r.lieu)}` : ''}</span>
        ${passee ? `<span class="cp-detail">${pr.presents} présents, ${pluriel(pr.representes, 'représenté')} · ${qu.sansQuorum ? 'sans quorum requis' : qu.atteint ? 'quorum atteint' : 'quorum non atteint'}${votes.length ? ` · ${adoptees}/${votes.length} ${adoptees > 1 ? 'adoptées' : 'adoptée'}` : ''}</span>` : `<span class="cp-progres">${barre(etapes.length ? Math.round((faites / etapes.length) * 100) : 0)}<span class="nb">${faites}/${etapes.length}</span></span>`}
        <span class="cp-etiquettes">${etiqReunion(r, t)}</span>
      </button>
    </li>`;
  }

  // Fiche d'une réunion : en-tête, parties (préparation, convocation, présence, votes, procès-verbal).
  function vueReunion(r) {
    const t = auj();
    const rg = regle(r.instance);
    const corps = { preparation: partiePreparation, convocation: partieConvocation, presence: partiePresence, votes: partieVotes, pv: partiePV }[onglet](r, t);
    return `
      <button class="btn lien retour" data-action="vue" data-vue="reunions">${ICONES.gauche}Toutes les réunions</button>
      <div class="vue-tete fiche-tete"><div>
          <p class="surtitre">${esc(rg.nom)}${r.convocationNo === 2 ? ' · seconde convocation' : ''}</p>
          <h1>${esc(R.titreReunion(E, r))}</h1>
          <p>${r.date ? majuscule(dateLongue(r.date)) : 'Date à fixer'}${r.heure ? ` à ${R.heureTexte(r.heure)}` : ''}${r.lieu ? `, ${esc(r.lieu)}` : ''}</p>
          <p class="etiquettes-tete">${etiqInstance(r)}${etiqReunion(r, t)}</p>
        </div>
        <div class="actions"><button class="btn" data-action="modifier-reunion" data-id="${r.id}">Modifier</button></div></div>
      <div class="parties" role="tablist" aria-label="Parties de la réunion">${PARTIES.map(([id, nom], i) => `<button role="tab" class="partie" data-action="partie" data-partie="${id}" aria-selected="${onglet === id}"><span class="num">${i + 1}</span>${id === 'pv' ? '<span class="nom-long">Procès-verbal</span><span class="nom-court">PV</span>' : nom}</button>`).join('')}</div>
      <div class="partie-corps" role="tabpanel">${corps}</div>
      <div class="pied-fiche"><button class="btn danger" data-action="supprimer-reunion" data-id="${r.id}">Supprimer cette réunion</button><p class="mention">Supprime la réunion, sa feuille de présence, ses votes et son procès-verbal (annulable quelques secondes).</p></div>`;
  }

  function partiePreparation(r, t) {
    const rg = regle(r.instance);
    const etapes = R.etapesDatees(E, r, t);
    const conv = R.etatConvocation(E, r, t);
    const aRenouveler = R.estAG(r.instance) ? R.mandatsARenouveler(E, r) : [];
    const pointElection = r.points.some((p) => /élection|renouvellement/i.test(p.titre));
    const faites = etapes.filter((e) => e.fait).length;
    return `
      <div class="colonnes-foyer">
        <section>
          <div class="encart-limite ${conv.etat}">
            <p class="surtitre">Date limite de convocation</p>
            <b>${conv.limite ? majuscule(dateLongue(conv.limite)) : 'Fixe d\'abord la date de la réunion'}</b>
            <span>${conv.limite ? `Délai des statuts : ${pluriel(rg.delai, 'jour')} avant la réunion${rg.reference ? ` (${esc(rg.reference)})` : ''}${rg.verifiee ? '' : ' · <b>règle à vérifier</b>'}.` : ''}
            ${conv.etat === 'envoyee' ? ` Convocation envoyée le ${dateLongue(r.convoqueLe)}, dans le délai.` : conv.etat === 'tardive' ? ` Convocation envoyée le ${dateLongue(r.convoqueLe)}, après la date limite : vérifie ce que prévoient tes statuts.` : conv.etat === 'retard' ? ' Date limite dépassée : convocation non envoyée.' : conv.etat === 'a-envoyer' ? ` ${majuscule(quand(conv.jours))}.` : ''}</span>
          </div>
          <div class="titre-section titre-avec-action"><h2>Rétroplanning <span>${faites}/${etapes.length} étapes faites</span></h2><button class="btn petit" data-action="nouvelle-etape" data-id="${r.id}">${ICONES.plus}Étape</button></div>
          <ul class="liste-taches">${etapes.map((e) => ligneEtape(r, e, t)).join('')}</ul>
          <p class="mention" style="margin-top:8px">Dates calculées depuis la date limite de convocation et la date de la réunion ; touche une étape pour changer son titre ou son décalage. Ce sont des suggestions d'organisation, pas des obligations.</p>
        </section>
        <section>
          ${R.estAG(r.instance) ? `<h2 class="titre-section">Mandats à renouveler <span>Échéance avant cette AG ou dans le mois qui suit</span></h2>
            ${aRenouveler.length ? `<ul class="liste-simple">${aRenouveler.map((m) => ligneMandat(m, t, { compacte: true })).join('')}</ul>${pointElection ? '<p class="aide" style="margin-top:10px">Un point d\'élection figure déjà à l\'ordre du jour.</p>' : `<button class="btn petit" style="margin-top:10px" data-action="ajouter-point-type" data-id="${r.id}" data-titre="Élection des membres du conseil">${ICONES.plus}Ajouter l'élection à l'ordre du jour</button>`}` : '<p class="aide">Aucun mandat n\'arrive à échéance d\'ici cette assemblée.</p>'}` : ''}
          <h2 class="titre-section">Votants</h2>
          <ul class="liste-simple">${(() => { const pr = R.presence(E, r, t); const qu = R.quorum(E, r, t, pr); return `<li class="ligne-total"><span><b>${R.estAG(r.instance) ? 'Membres votants à jour' : 'Membres de l\'instance'}</b><small>${R.estAG(r.instance) ? 'cotisation cochée dans Membres' : 'mandats en cours à la date de la réunion'}</small></span><b class="nb">${pr.inscrits}</b></li><li class="ligne-total"><span><b>Quorum</b><small>${esc(R.texteQuorum(E, r.instance, qu.regle))}</small></span><b class="nb">${qu.sansQuorum ? '—' : qu.requis}</b></li><li class="ligne-total"><span><b>Pouvoirs déjà reçus</b><small>${regle(r.instance).pouvoirs.autorises ? `au plus ${regle(r.instance).pouvoirs.plafond || 'sans plafond'} par membre` : 'non admis'}</small></span><b class="nb">${pr.liste.filter((l) => l.statut === 'represente').length}</b></li>`; })()}</ul>
          <div class="rang" style="margin-top:12px"><button class="btn petit" data-action="partie" data-partie="convocation">Préparer la convocation</button><button class="btn petit" data-action="partie" data-partie="presence">Feuille de présence</button></div>
        </section>
      </div>`;
  }

  function partieConvocation(r, t) {
    const trames = B.trames.convocation.filter((x) => x.instances.includes(r.instance));
    const trame = trames.find((x) => x.id === r.trame) || trames[0];
    const texte = r.convocation || R.texteConvocation(B, E, r, t, trame.id);
    const pr = R.presence(E, r, t);
    const mails = pr.liste.map((l) => membre(l.membre)?.email).filter(Boolean);
    const conv = R.etatConvocation(E, r, t);
    return `
      <div class="colonnes-foyer">
        <section>
          <div class="titre-section titre-avec-action"><h2>Ordre du jour <span>${pluriel(r.points.length, 'point')} · ${pluriel(r.points.filter((p) => p.vote).length, 'vote')}</span></h2><button class="btn petit primaire" data-action="nouveau-point" data-id="${r.id}">${ICONES.plus}Point</button></div>
          ${r.points.length ? `<ol class="liste-points">${r.points.map((p, i) => `<li class="ligne-point">
            <span class="lp-num">${i + 1}</span>
            <button class="lien-ligne" data-action="modifier-point" data-id="${r.id}" data-point="${p.id}"><b>${esc(p.titre)}</b><span>${p.vote ? `Vote · ${esc(R.majoritePoint(E, r, p).nom)}` : 'Sans vote'}${p.resolution ? ` · ${esc(p.resolution.slice(0, 70))}${p.resolution.length > 70 ? '…' : ''}` : ''}</span></button>
            <span class="lp-ordre"><button class="btn-icone petit" data-action="monter-point" data-id="${r.id}" data-point="${p.id}" aria-label="Monter ${esc(p.titre)}" ${i === 0 ? 'disabled' : ''}>${ICONES.haut}</button><button class="btn-icone petit" data-action="descendre-point" data-id="${r.id}" data-point="${p.id}" aria-label="Descendre ${esc(p.titre)}" ${i === r.points.length - 1 ? 'disabled' : ''}>${ICONES.bas}</button></span>
          </li>`).join('')}</ol>` : '<p class="aide">Aucun point : ajoute-les ou choisis un point type.</p>'}
          <div class="points-types">${B.pointsTypes.filter((x) => !r.points.some((p) => p.titre === x.titre)).slice(0, 5).map((x) => `<button class="btn petit" data-action="ajouter-point-type" data-id="${r.id}" data-titre="${esc(x.titre)}">${ICONES.plus}${esc(x.titre)}</button>`).join('')}</div>
          <h2 class="titre-section">Envoi</h2>
          <div class="rang-champs">
            <label class="champ">Convocation envoyée le<small>${conv.limite ? `Au plus tard le ${dateCourte(conv.limite)}` : 'Date de réunion à fixer'}</small><input type="date" data-champ-reunion="convoqueLe" data-id="${r.id}" value="${r.convoqueLe || ''}"></label>
            <div class="champ"><span>Adresses des convoqués</span><small>${pluriel(mails.length, 'e-mail')} sur ${pluriel(pr.inscrits, 'convoqué')}</small><button class="btn petit" data-action="copier-mails" data-id="${r.id}" ${mails.length ? '' : 'disabled'}>Copier les e-mails</button></div>
          </div>
          ${!r.convoqueLe ? `<button class="btn" style="margin-top:12px" data-action="convoque-aujourdhui" data-id="${r.id}">${ICONES.coche}Envoyée aujourd'hui</button>` : ''}
          <p class="mention" style="margin-top:10px">L'outil n'envoie rien : colle le texte dans ton e-mail (adresses en copie cachée) ou imprime-le avec le pouvoir.</p>
        </section>
        <section id="convocation">
          <div class="titre-section titre-avec-action"><h2>Texte de la convocation</h2>${trames.length > 1 ? `<label class="champ choix-trame"><span class="sr-only">Trame</span><select data-trame="${r.id}">${trames.map((x) => `<option value="${x.id}" ${x.id === trame.id ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>` : ''}</div>
          <label class="champ question"><span class="sr-only">Texte de la convocation</span><textarea data-convocation="${r.id}" rows="${Math.min(34, Math.max(14, texte.split('\n').length + 2))}">${esc(texte)}</textarea></label>
          <div class="rang">
            <button class="btn primaire" data-action="copier-convocation" data-id="${r.id}">Copier le texte</button>
            <button class="btn" data-action="imprimer" data-quoi="convocation" data-id="${r.id}">Imprimer avec le pouvoir</button>
            ${r.convocation ? `<button class="btn" data-action="regenerer-convocation" data-id="${r.id}">Repartir de la trame</button>` : ''}
          </div>
          <p class="mention" style="margin-top:8px">${r.convocation ? 'Texte modifié à la main : il ne suit plus l\'ordre du jour. « Repartir de la trame » le régénère.' : 'Le texte suit l\'ordre du jour, la date, le lieu et tes règles (quorum, pouvoirs). Tu peux le modifier directement.'}</p>
          <details class="plus-tard"><summary>Modèle de pouvoir (procuration)</summary><pre class="texte-pre">${esc(R.textePouvoir(B, E, r, t))}</pre><button class="btn petit" data-action="copier-pouvoir" data-id="${r.id}">Copier le pouvoir</button></details>
        </section>
      </div>`;
  }

  function partiePresence(r, t) {
    const rg = regle(r.instance);
    const pr = R.presence(E, r, t);
    const qu = R.quorum(E, r, t, pr);
    const presents = pr.liste.filter((l) => l.statut === 'present');
    const refuses = new Map(pr.refuses.map((x) => [x.membre, x.raison]));
    const fige = r.emargement.length > 0;
    const compte = (s) => pr.liste.filter((l) => l.statut === s).length;
    const avant = r.date && r.date > t;
    const enAttente = (m) => avant && refuses.get(m) === 'mandataire-absent';
    const nbAttente = pr.refuses.filter((x) => enAttente(x.membre)).length;
    const nbRefus = pr.refuses.length - nbAttente;
    return `
      <div class="bilan-presence">
        ${jaugeQuorum(qu, pr, avant)}
        <div class="bf-compteurs">
          <span class="etiquette ciel">${pluriel(compte('present'), 'présent')}</span>
          <span class="etiquette jaune">${pluriel(pr.representes, 'représenté')}${nbAttente ? ` · ${pluriel(nbAttente, 'pouvoir reçu', 'pouvoirs reçus')}` : ''}${nbRefus ? ` · ${pluriel(nbRefus, 'pouvoir refusé', 'pouvoirs refusés')}` : ''}</span>
          <span class="etiquette sable">${pluriel(compte('excuse'), 'excusé')}</span>
          <span class="etiquette sable">${pluriel(compte('absent'), 'absent')}</span>
          <span class="etiquette ciel">${pluriel(pr.voix, 'voix', 'voix')} au vote</span>
        </div>
      </div>
      <p class="aide" style="margin-top:12px">${R.estAG(r.instance) ? 'Membres votants à jour de cotisation' : 'Membres de l\'instance (mandats en cours)'} : ${pr.inscrits}. Quorum : ${esc(R.texteQuorum(E, r.instance, qu.regle))}${r.convocationNo === 2 ? ' (seconde convocation)' : ''}. Pouvoirs : ${rg.pouvoirs.autorises ? `admis, au plus ${rg.pouvoirs.plafond || 'sans plafond'} par membre présent` : 'non admis'}.${rg.verifiee ? '' : ' <b>Règles à vérifier dans l\'onglet Statuts.</b>'}</p>
      <div class="outils-liste" style="margin-top:12px">
        <div class="rang"><button class="btn petit" data-action="actualiser-emargement" data-id="${r.id}">Actualiser la liste</button><button class="btn petit" data-action="imprimer" data-quoi="presence" data-id="${r.id}">Imprimer la feuille de présence</button></div>
        <span class="mention">${fige ? 'Liste enregistrée pour cette réunion.' : 'Liste construite depuis les membres : elle s\'enregistre au premier pointage.'}</span>
      </div>
      ${pr.liste.length ? `<ul class="liste-presence">${pr.liste.map((l) => `<li class="ligne-presence pr-${l.statut} ${refuses.has(l.membre) && !enAttente(l.membre) ? 'pr-refuse' : ''}">
        <span class="lpr-nom"><b>${esc(l.nom)}</b><small>${esc(l.qualite)}${pr.pouvoirs.parMandataire.get(l.membre) ? ` · ${pluriel(pr.pouvoirs.parMandataire.get(l.membre), 'pouvoir')}` : ''}</small></span>
        <span class="lpr-choix" role="group" aria-label="Présence de ${esc(l.nom)}">${R.PRESENCES.map((s) => `<button type="button" data-action="presence" data-id="${r.id}" data-membre="${l.membre}" data-statut="${s}" aria-pressed="${l.statut === s}" title="${NOM_PRESENCE[s]}">${NOM_PRESENCE[s].charAt(0)}<span class="sr-only">${NOM_PRESENCE[s].slice(1)}</span></button>`).join('')}</span>
        ${l.statut === 'represente' ? `<label class="champ lpr-mandataire"><span class="sr-only">Mandataire de ${esc(l.nom)}</span><select data-mandataire="${l.membre}" data-id="${r.id}"><option value="">Représenté par…</option>${presents.filter((x) => x.membre !== l.membre).map((x) => `<option value="${x.membre}" ${x.membre === l.mandataire ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}${l.mandataire && !presents.some((x) => x.membre === l.mandataire) ? `<option value="${l.mandataire}" selected>${esc(pr.liste.find((x) => x.membre === l.mandataire)?.nom || 'Membre')} (absent)</option>` : ''}</select></label>${refuses.has(l.membre) ? (refuses.get(l.membre) === 'mandataire-absent' && r.date > t ? '<span class="etiquette jaune">Pouvoir reçu · mandataire à pointer présent</span>' : `<span class="etiquette rouge">${esc(majuscule(RAISONS[refuses.get(l.membre)]))}</span>`) : ''}` : ''}
      </li>`).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Personne à convoquer</h3><p>${R.estAG(r.instance) ? 'Coche « cotisation à jour » pour les membres votants, dans l\'onglet Membres.' : 'Saisis les mandats du conseil et du bureau, dans l\'onglet Mandats.'}</p><div class="actions"><button class="btn primaire" data-action="vue" data-vue="${R.estAG(r.instance) ? 'membres' : 'mandats'}">${R.estAG(r.instance) ? 'Membres' : 'Mandats'}</button></div></div></div>`}
      <p class="mention" style="margin-top:12px">P : présent · R : représenté (choisis le mandataire parmi les présents) · E : excusé · A : absent. Un pouvoir confié à un absent, sans mandataire ou au-delà du plafond n'est pas compté.</p>`;
  }

  function partieVotes(r, t) {
    const pr = R.presence(E, r, t);
    const qu = R.quorum(E, r, t, pr);
    const votes = r.points.filter((p) => p.vote);
    const avant = r.date && r.date > t;
    return `
      ${avant ? '<p class="aide">Réunion à venir : pointe les présences le jour J, puis saisis les décomptes ici. Le quorum et le résultat de chaque résolution se calculent au fur et à mesure.</p>' : ''}
      <div class="bilan-presence">${jaugeQuorum(qu, pr, avant)}<div class="bf-compteurs"><span class="etiquette ciel">${pluriel(pr.voix, 'voix', 'voix')} : ${pluriel(pr.presents, 'présent')} et ${pluriel(pr.representes, 'pouvoir')}</span></div></div>
      ${!qu.atteint && !avant ? (() => { const suite = E.reunions.find((x) => x.instance === r.instance && x.convocationNo === 2 && x.date && r.date && x.date > r.date); return `<div class="alerte-rgpd alerte-retard"><div><b>Quorum non atteint</b><span>${suite ? `Les votes ne valent pas décision. Seconde convocation le ${dateCourte(suite.date)}.` : 'Les votes ne valent pas décision. Selon tes statuts, une seconde réunion peut être convoquée : crée-la avec « Seconde convocation ».'}</span></div>${suite ? `<button class="btn petit" data-action="reunion" data-id="${suite.id}" data-partie="votes">Ouvrir</button>` : `<button class="btn petit" data-action="seconde-convocation" data-id="${r.id}">Seconde convocation</button>`}</div>`; })() : ''}
      ${votes.length ? `<ol class="liste-votes">${votes.map((p) => carteVote(r, p, pr, qu)).join('')}</ol>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun point soumis au vote</h3><p>Dans l'ordre du jour (partie Convocation), coche « Soumis au vote » pour les points à décider.</p><div class="actions"><button class="btn primaire" data-action="partie" data-partie="convocation">Ordre du jour</button></div></div></div>`}
      <p class="mention" style="margin-top:12px">Une voix par membre présent et une par pouvoir valable. La majorité de chaque point se choisit parmi celles de l'onglet Statuts ; le calcul se fait en nombres entiers, sans arrondi.</p>`;
  }
  function carteVote(r, p, pr, qu) {
    const x = R.resultat(E, r, p, pr, qu);
    const [lib, c] = (x.statut === 'non-vote' && !qu.atteint ? RESULTAT['sans-quorum'] : RESULTAT[x.statut]) || ['', 'sable'];
    const m = x.majorite;
    const expl = x.statut === 'adoptee' || x.statut === 'rejetee'
      ? `${esc(majuscule(R.texteMajorite(m)))} : base ${x.base}, il faut ${pluriel(Math.max(0, x.requis), 'voix pour', 'voix pour')} ; ${pluriel(x.pour, 'voix pour', 'voix pour')}.${x.nonVotants ? ` ${pluriel(x.nonVotants, 'voix non exprimée', 'voix non exprimées')}.` : ''}`
      : x.statut === 'invalide' ? `${x.total} voix saisies pour ${pr.voix} possibles.` : x.statut === 'sans-quorum' ? 'Quorum non atteint : pas de décision valable.' : `Saisis le décompte. ${esc(majuscule(R.texteMajorite(m)))}.`;
    const num = (champ, v) => `<label class="champ"><span>${{ pour: 'Pour', contre: 'Contre', abstention: 'Abstentions' }[champ]}</span><input type="number" min="0" max="${pr.voix}" inputmode="numeric" data-vote="${p.id}" data-id="${r.id}" data-champ="${champ}" value="${v ?? ''}"></label>`;
    return `<li class="carte-vote res-${x.statut}">
      <div class="cv-tete"><b>${esc(p.titre)}</b><span class="etiquette ${c}">${lib}</span></div>
      ${p.resolution ? `<p class="cv-resolution">${esc(p.resolution)}</p>` : ''}
      <div class="cv-saisie">${num('pour', p.pour)}${num('contre', p.contre)}${num('abstention', p.abstention)}
        <label class="champ"><span>Majorité</span><select data-majorite-point="${p.id}" data-id="${r.id}">${optionsMajorites(p.majorite, { vide: `Par défaut : ${R.majorite(E, regle(r.instance).majorite)?.nom || ''}` })}</select></label></div>
      <p class="cv-expl">${expl}</p>
      <div class="rang"><button class="btn petit" data-action="unanimite" data-id="${r.id}" data-point="${p.id}">Tous pour (${pr.voix})</button><button class="btn petit" data-action="modifier-point" data-id="${r.id}" data-point="${p.id}">Modifier la résolution</button>${p.pour !== null || p.contre !== null || p.abstention !== null ? `<button class="btn petit" data-action="effacer-vote" data-id="${r.id}" data-point="${p.id}">Effacer le décompte</button>` : ''}</div>
    </li>`;
  }

  function partiePV(r, t) {
    const texte = R.textePV(B, E, r, t);
    return `
      <div class="colonnes-foyer">
        <section>
          <h2 class="titre-section">Séance</h2>
          <div class="rang-champs">
            <label class="champ">Président·e de séance<input list="liste-membres" data-champ-reunion="president" data-id="${r.id}" maxlength="80" value="${esc(r.president)}" placeholder="${esc(E.association.signataire)}"></label>
            <label class="champ">Secrétaire de séance<input list="liste-membres" data-champ-reunion="secretaire" data-id="${r.id}" maxlength="80" value="${esc(r.secretaire)}"></label>
          </div>
          <datalist id="liste-membres">${E.membres.map((m) => `<option value="${esc(m.nom)}"></option>`).join('')}</datalist>
          <div class="rang-champs" style="margin-top:12px">
            <label class="champ">Fin de séance<input type="time" data-champ-reunion="heureFin" data-id="${r.id}" value="${r.heureFin}"></label>
            <label class="champ">PV signé le<small>La réunion passe dans l'archive</small><input type="date" data-champ-reunion="pvSigneLe" data-id="${r.id}" value="${r.pvSigneLe || ''}"></label>
          </div>
          <h2 class="titre-section">Notes par point <span>Reprises dans le procès-verbal</span></h2>
          ${r.points.map((p, i) => `<label class="champ question note-point"><span>${i + 1}. ${esc(p.titre)}</span><textarea data-notes="${p.id}" data-id="${r.id}" rows="3" maxlength="3000" placeholder="Ce qui a été présenté, dit ou décidé.">${esc(p.notes)}</textarea></label>`).join('')}
        </section>
        <section id="pv">
          <div class="titre-section titre-avec-action"><h2>Procès-verbal</h2><span class="etiquette ${r.pvSigneLe ? 'vert' : 'sable'}">${r.pvSigneLe ? `Signé le ${dateCourte(r.pvSigneLe)}` : 'Brouillon'}</span></div>
          <pre class="texte-pre pv-apercu">${esc(texte)}</pre>
          <div class="rang"><button class="btn primaire" data-action="imprimer" data-quoi="pv" data-id="${r.id}">Imprimer le PV</button><button class="btn" data-action="copier-pv" data-id="${r.id}">Copier le texte</button>${r.pvSigneLe ? '' : `<button class="btn" data-action="pv-signe" data-id="${r.id}">${ICONES.coche}Signé aujourd'hui</button>`}</div>
          <p class="mention" style="margin-top:8px">Le procès-verbal se construit avec la feuille de présence, le quorum, les votes et tes notes. Copie-le pour le mettre en forme ailleurs si besoin ; vérifie qu'il respecte ce que prévoient tes statuts (signataires, registre).</p>
        </section>
      </div>`;
  }

  // ---------- Membres ----------
  function vueMembres() {
    const t = auj();
    const q = R.cle(filtre.q);
    const garde = (m, f = filtre.membres) => f === 'tous' || (f === 'a-jour' && m.votant && m.cotisation) || (f === 'pas-a-jour' && m.votant && !m.cotisation) || (f === 'non-votants' && !m.votant) || (f === 'bureau' && E.mandats.some((x) => x.membre === m.id && R.mandatActif(x, t)));
    const liste = E.membres.filter((m) => garde(m) && (!q || R.cle(`${m.nom} ${m.categorie} ${m.email}`).includes(q))).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const filtres = [['tous', 'Tous'], ['a-jour', 'Votants à jour'], ['pas-a-jour', 'Cotisation à régulariser'], ['non-votants', 'Non votants'], ['bureau', 'Bureau et conseil']];
    const ind = R.indicateurs(E, t);
    return `
      <div class="vue-tete"><div><h1>Membres</h1><p>${pluriel(ind.membres, 'membre')}, ${pluriel(ind.aJour, 'votant')} à jour de cotisation sur ${ind.votants}. La case « cotisation » fait la liste des votants de l'AG ; un membre d'honneur peut être non votant si tes statuts le prévoient.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-membre">${ICONES.plus}Membre</button><button class="btn" data-action="importer">Coller une liste</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les membres">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-cle="membres" data-filtre="${id}" aria-pressed="${filtre.membres === id}">${lib} <small>${E.membres.filter((m) => garde(m, id)).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Rechercher un nom, une catégorie" value="${esc(filtre.q)}"></label>
      </div>
      ${liste.length ? `<ul class="liste-membres">${liste.map((m) => ligneMembre(m, t)).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.membres.length ? 'Aucun membre ne correspond' : 'Aucun membre'}</h3><p>${E.membres.length ? 'Change le filtre ou la recherche.' : 'Ajoute-les un par un, ou colle une liste depuis un tableur : un nom par ligne, puis la catégorie, l\'e-mail et la cotisation (oui ou non).'}</p><div class="actions"><button class="btn primaire" data-action="nouveau-membre">${ICONES.plus}Membre</button><button class="btn" data-action="importer">Coller une liste</button></div></div></div>`}
      <div class="pied-fiche"><button class="btn" data-action="cotisations-zero">Nouvel exercice : décocher toutes les cotisations</button><button class="btn" data-action="copier-mails-tous">Copier les e-mails des membres</button><p class="mention">En début de saison, décoche les cotisations, puis coche-les au fil des paiements.</p></div>
      ${AVERTISSEMENT}`;
  }
  function ligneMembre(m, t) {
    const mandats = E.mandats.filter((x) => x.membre === m.id && R.mandatActif(x, t));
    return `<li class="ligne-membre ${!m.votant ? 'non-votant' : m.cotisation ? 'a-jour' : 'pas-a-jour'}">
      ${m.votant ? `<button class="case-fait ${m.cotisation ? 'coche' : ''}" data-action="cotisation" data-id="${m.id}" aria-pressed="${m.cotisation}" aria-label="Cotisation à jour : ${esc(m.nom)}" title="Cotisation à jour">${ICONES.coche}</button>` : '<span class="case-vide-membre" title="Non votant" aria-hidden="true"></span>'}
      <button class="lien-ligne" data-action="modifier-membre" data-id="${m.id}"><b>${esc(m.nom)}</b><span>${esc(m.categorie)}${m.email ? ` · ${esc(m.email)}` : ''}</span></button>
      <span class="lt-droite">${mandats.map((x) => `<span class="etiquette ${x.instance === 'bureau' ? 'ciel' : 'beurre'}">${esc(x.fonction)}</span>`).join('')}${m.votant ? (m.cotisation ? '<span class="etiquette vert">À jour</span>' : '<span class="etiquette rose">À régulariser</span>') : '<span class="etiquette sable">Non votant</span>'}</span>
    </li>`;
  }

  // ---------- Mandats ----------
  function ligneMandat(m, t, { compacte = false } = {}) {
    const mb = membre(m.membre);
    const f = R.finMandat(m);
    const et = R.etatMandat(m, t, E.reglages.alerteMandatJours);
    return `<li class="ligne-mandat et-${et}">
      <button class="lien-ligne" data-action="modifier-mandat" data-id="${m.id}"><b>${esc(mb?.nom || 'Membre')}</b><span>${esc(m.fonction)} · ${m.instance === 'bureau' ? 'bureau' : 'conseil'}${m.debut ? ` · depuis le ${dateCourte(m.debut)}` : ''}${f ? ` · échéance ${dateCourte(f)}${et === 'a-renouveler' || et === 'echu' ? ` (${quand(ecart(t, f))})` : ''}` : ' · sans échéance'}${m.closLe ? ` · terminé le ${dateCourte(m.closLe)}` : ''}</span></button>
      <span class="lt-droite">${etiqMandat(m)}${!compacte && (et === 'a-renouveler' || et === 'echu') ? `<button class="btn petit" data-action="renouveler" data-id="${m.id}">Renouveler</button>` : ''}</span>
    </li>`;
  }
  function vueMandats() {
    const t = auj();
    const al = E.reglages.alerteMandatJours;
    const actifs = E.mandats.filter((m) => R.etatMandat(m, t, al) !== 'clos');
    const clos = E.mandats.filter((m) => R.etatMandat(m, t, al) === 'clos').sort((a, b) => (b.closLe || '').localeCompare(a.closLe || ''));
    const tri = (l) => l.sort((a, b) => (R.finMandat(a) || '9999').localeCompare(R.finMandat(b) || '9999'));
    const ordreBureau = (m) => { const i = B.fonctions.bureau.findIndex((f) => R.cle(f).slice(0, 6) === R.cle(m.fonction).slice(0, 6)); return i < 0 ? 99 : i; };
    const bureau = actifs.filter((m) => m.instance === 'bureau').sort((a, b) => ordreBureau(a) - ordreBureau(b));
    const conseil = tri(actifs.filter((m) => m.instance === 'ca'));
    const alerte = actifs.filter((m) => ['a-renouveler', 'echu'].includes(R.etatMandat(m, t, al)));
    const prochaineAG = R.prochaine(E, t, (r) => R.estAG(r.instance));
    return `
      <div class="vue-tete"><div><h1>Mandats</h1><p>Le bureau et le conseil, avec leur date de début et leur durée : l'échéance se calcule et une alerte s'affiche ${pluriel(al, 'jour')} avant (réglable). Les membres du conseil et du bureau forment la liste des présences de leurs réunions.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-mandat">${ICONES.plus}Mandat</button></div></div>
      ${alerte.length ? `<div class="alerte-rgpd ${alerte.some((m) => R.etatMandat(m, t, al) === 'echu') ? 'alerte-retard' : ''}"><div><b>${pluriel(alerte.length, 'mandat à renouveler', 'mandats à renouveler')}</b><span>${prochaineAG ? `Prochaine assemblée générale le ${dateCourte(prochaineAG.date)} : pense à l'élection dans l'ordre du jour.` : 'Aucune assemblée générale prévue : crée-la pour organiser le renouvellement.'}</span></div>${prochaineAG ? `<button class="btn petit" data-action="reunion" data-id="${prochaineAG.id}">Ouvrir l'AG</button>` : '<button class="btn petit" data-action="nouvelle-reunion">Créer l\'AG</button>'}</div>` : ''}
      <div class="colonnes-merci">
        <section><h2 class="titre-section">Bureau <span>${pluriel(bureau.length, 'mandat')} · durée prévue ${regle('bureau').duree ? pluriel(regle('bureau').duree, 'an') : 'non fixée'}</span></h2>
          ${bureau.length ? `<ul class="liste-taches">${bureau.map((m) => ligneMandat(m, t)).join('')}</ul>` : '<div class="vide-etat petit"><div><p>Aucun mandat de bureau.</p></div></div>'}</section>
        <section><h2 class="titre-section">Conseil <span>${pluriel(conseil.length, 'mandat')} · durée prévue ${regle('ca').duree ? pluriel(regle('ca').duree, 'an') : 'non fixée'}</span></h2>
          ${conseil.length ? `<ul class="liste-taches">${conseil.map((m) => ligneMandat(m, t)).join('')}</ul>` : '<div class="vide-etat petit"><div><p>Aucun mandat au conseil.</p></div></div>'}</section>
      </div>
      <details class="plus-tard"><summary>Mandats terminés · ${clos.length}</summary>${clos.length ? `<ul class="liste-taches">${clos.map((m) => ligneMandat(m, t)).join('')}</ul>` : '<p class="aide">Aucun.</p>'}</details>
      <p class="mention" style="margin-top:16px">Durées et conditions de renouvellement : celles de tes statuts. « Renouveler » termine le mandat à son échéance (ou à la date choisie) et en ouvre un nouveau pour la même fonction.</p>`;
  }

  // ---------- Statuts (règles) ----------
  function vueStatuts() {
    const cartes = R.INSTANCES.map((id) => {
      const g = regle(id);
      const maj = R.majorite(E, g.majorite);
      const q2 = g.quorum2.type === 'identique' ? 'même quorum qu\'en première convocation' : g.quorum2.type === 'aucun' ? 'pas de quorum' : R.texteQuorum(E, id, g.quorum2);
      return `<li class="carte-statut ${g.verifiee ? 'verifiee' : ''}">
        <div class="cs-tete"><div><h2>${esc(g.nom)}</h2>${g.reference ? `<p>${esc(g.reference)}</p>` : ''}</div><span class="etiquette ${g.verifiee ? 'vert' : 'rose'}">${g.verifiee ? 'Vérifiée' : 'À vérifier'}</span></div>
        <dl class="regles-liste">
          <div><dt>Convocation</dt><dd>${pluriel(g.delai, 'jour')} avant la réunion</dd></div>
          <div><dt>Quorum</dt><dd>${esc(majuscule(R.texteQuorum(E, id, g.quorum)))}</dd></div>
          <div><dt>Seconde convocation</dt><dd>${esc(majuscule(q2))}</dd></div>
          <div><dt>Pouvoirs</dt><dd>${g.pouvoirs.autorises ? `Admis, ${g.pouvoirs.plafond ? `au plus ${g.pouvoirs.plafond} par membre` : 'sans plafond'}` : 'Non admis'}</dd></div>
          <div><dt>Décisions</dt><dd>${esc(maj?.nom || '')} : ${esc(maj ? R.texteMajorite(maj) : '')}</dd></div>
          ${R.estAG(id) ? '' : `<div><dt>Durée des mandats</dt><dd>${g.duree ? pluriel(g.duree, 'an') : 'Non fixée'}</dd></div>`}
        </dl>
        <div class="rang"><button class="btn petit" data-action="modifier-regle" data-id="${id}">Modifier</button>${g.verifiee ? '' : `<button class="btn petit primaire" data-action="verifier-regle" data-id="${id}">${ICONES.coche}Conforme à nos statuts</button>`}</div>
      </li>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Statuts</h1><p>Les règles de tes instances, recopiées de tes statuts : l'outil ne contient aucune règle légale de quorum ou de majorité. Délai de convocation, quorum, pouvoirs et majorités servent au rétroplanning, à la feuille de présence et aux votes.</p></div></div>
      <ul class="cartes-statuts">${cartes}</ul>
      <div class="titre-section titre-avec-action" style="margin-top:28px"><h2>Majorités <span>Choisies point par point au moment du vote</span></h2><button class="btn petit" data-action="nouvelle-majorite">${ICONES.plus}Majorité</button></div>
      <ul class="liste-taches">${E.regles.majorites.map((m) => `<li class="ligne-transverse"><button class="lien-ligne" data-action="modifier-majorite" data-id="${m.id}"><b>${esc(m.nom)}</b><span>${esc(majuscule(R.texteMajorite(m)))}${m.reference ? ` · ${esc(m.reference)}` : ''}</span></button><span class="lt-droite">${R.INSTANCES.filter((i) => regle(i).majorite === m.id).map((i) => `<span class="etiquette ${COULEUR_INSTANCE[i]}">${esc(courtInstance(i))}</span>`).join('')}</span></li>`).join('')}</ul>
      ${AVERTISSEMENT}`;
  }

  // ---------- Impression ----------
  function preparerImpression() {
    let el = $('#impression');
    if (!el) { el = document.createElement('div'); el.id = 'impression'; document.body.appendChild(el); }
    return el;
  }
  function imprimer(quoi, r) {
    const t = auj();
    const el = preparerImpression();
    const a = E.association;
    const tete = `<header><p>${esc(a.nom)}${a.siege ? ` · ${esc(a.siege)}` : ''}</p></header>`;
    if (quoi === 'convocation') {
      const texte = r.convocation || R.texteConvocation(B, E, r, t);
      el.innerHTML = `<pre class="impr-texte">${esc(texte)}</pre>${regle(r.instance).pouvoirs.autorises ? `<div class="saut"></div><pre class="impr-texte">${esc(R.textePouvoir(B, E, r, t))}</pre>` : ''}`;
    } else if (quoi === 'pv') {
      el.innerHTML = `<pre class="impr-texte">${esc(R.textePV(B, E, r, t))}</pre><div class="signatures"><span>Le ou la président·e de séance<br>${esc(r.president)}</span><span>Le ou la secrétaire de séance<br>${esc(r.secretaire)}</span></div>`;
    } else {
      const pr = R.presence(E, r, t);
      const qu = R.quorum(E, r, t, pr);
      const nom = (id) => pr.liste.find((l) => l.membre === id)?.nom || '';
      el.innerHTML = `${tete}<h1>Feuille de présence</h1><p>${esc(R.titreReunion(E, r))} · ${esc(R.dateTexte(r.date, true))}${r.heure ? ` à ${R.heureTexte(r.heure)}` : ''}${r.lieu ? ` · ${esc(r.lieu)}` : ''}</p>
        <p>${R.estAG(r.instance) ? 'Membres votants à jour de cotisation' : 'Membres'} : ${pr.inscrits} · Quorum : ${esc(R.texteQuorum(E, r.instance, qu.regle))}${qu.sansQuorum ? '' : `, soit ${qu.requis}`}.</p>
        <table><thead><tr><th style="width:5%">N°</th><th style="width:30%">Nom</th><th style="width:18%">Qualité</th><th style="width:20%">Représenté par</th><th>Signature</th></tr></thead>
        <tbody>${pr.liste.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.nom)}</td><td>${esc(l.qualite)}</td><td>${l.statut === 'represente' ? esc(nom(l.mandataire)) : l.statut === 'excuse' ? 'Excusé·e' : ''}</td><td style="height:9mm"></td></tr>`).join('')}
        ${Array.from({ length: 3 }, () => '<tr><td></td><td></td><td></td><td></td><td style="height:9mm"></td></tr>').join('')}</tbody></table>
        <p class="mention">Présents : ……… · Représentés : ……… · Total : ……… · Quorum ${qu.sansQuorum ? 'non requis' : `requis : ${qu.requis}`}. Certifiée exacte par le ou la président·e et le ou la secrétaire de séance.</p>
        <div class="signatures"><span>Président·e de séance</span><span>Secrétaire de séance</span></div>`;
    }
    el.className = `impr-${quoi}`;
    document.body.classList.add('impr-fiche');
    setTimeout(() => window.print(), 50);
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

  function modaleReunion(id, { instance = 'ago', convocationNo = 1, depuis = null } = {}) {
    const r = id ? reunion(id) : null;
    const x = r || { instance, date: '', heure: '', lieu: depuis?.lieu || '', titre: '', convocationNo };
    const corps = `
      <label class="champ">Instance<select name="instance" ${r ? 'disabled' : ''}>${R.INSTANCES.map((i) => `<option value="${i}" ${i === x.instance ? 'selected' : ''}>${esc(nomInstance(i))}</option>`).join('')}</select>${r ? '<small>L\'instance ne change pas une fois la réunion créée.</small>' : ''}</label>
      <div class="rang-champs">
        <label class="champ">Date<input type="date" name="date" value="${x.date || ''}"></label>
        <label class="champ">Heure<input type="time" name="heure" value="${x.heure || ''}"></label>
      </div>
      <label class="champ">Lieu<small>Écrit comme dans une phrase : « salle polyvalente, 2 place de la Mairie », « en visioconférence »</small><input name="lieu" maxlength="160" value="${esc(x.lieu)}"></label>
      <label class="champ">Titre<small>Facultatif. Vide : « ${esc(nomInstance(x.instance))} »</small><input name="titre" maxlength="120" value="${esc(x.titre)}"></label>
      <label class="champ">Convocation<select name="convocationNo"><option value="1" ${x.convocationNo === 1 ? 'selected' : ''}>Première convocation</option><option value="2" ${x.convocationNo === 2 ? 'selected' : ''}>Seconde convocation (quorum non atteint la première fois)</option></select></label>
      ${r ? '' : '<p class="aide">Le rétroplanning, un ordre du jour type et la trame de convocation de l\'instance sont ajoutés : tout se modifie ensuite.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Modifier la réunion' : 'Nouvelle réunion', corps, r ? PIED_STD : '<button class="btn primaire" value="ok">Créer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const date = String(f.get('date') || '');
      const champs = { date: R.estDate(date) ? date : null, heure: String(f.get('heure') || ''), lieu: String(f.get('lieu') || ''), titre: String(f.get('titre') || ''), convocationNo: Number(f.get('convocationNo')) === 2 ? 2 : 1 };
      retenir();
      if (r) { Object.assign(r, R.normaliserReunion({ ...r, ...champs })); }
      else {
        const n = R.nouvelleReunion(B, E, { instance: String(f.get('instance')), ...champs });
        if (depuis) { n.points = R.clone(depuis.points).map((p) => R.normaliserPoint({ ...p, id: R.nouvelId(), pour: null, contre: null, abstention: null, notes: '' })); }
        E.reunions.push(n);
        fiche = n.id; vue = 'reunions'; onglet = 'preparation';
      }
      sauver(); rendre(); window.scrollTo({ top: 0 });
      toast(r ? 'Réunion enregistrée.' : 'Réunion créée : rétroplanning et ordre du jour prêts.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEtape(rid, eid) {
    const r = reunion(rid);
    const e = eid ? r.etapes.find((x) => x.id === eid) : null;
    const x = e || { titre: '', ancre: 'reunion', decalage: -7 };
    const corps = `
      <label class="champ">Étape<input name="titre" maxlength="140" value="${esc(x.titre)}" required></label>
      <div class="rang-champs">
        <label class="champ">Jours<small>Négatif : avant ; positif : après</small><input type="number" name="decalage" min="-400" max="400" inputmode="numeric" value="${x.decalage}"></label>
        <label class="champ">Par rapport à<select name="ancre"><option value="limite" ${x.ancre === 'limite' ? 'selected' : ''}>La date limite de convocation</option><option value="reunion" ${x.ancre === 'reunion' ? 'selected' : ''}>La date de la réunion</option></select></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'étape' : 'Nouvelle étape', corps, e ? `${PIED_STD}<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, choix) => {
      retenir();
      if (choix === 'supprimer') { r.etapes = r.etapes.filter((y) => y.id !== e.id); sauver(); rendreSurPlace(); toast('Étape supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Donne un titre à l\'étape.';
      const n = R.normaliserEtape({ ...(e || {}), titre, ancre: f.get('ancre'), decalage: f.get('decalage') });
      if (e) Object.assign(e, n); else r.etapes.push(n);
      sauver(); rendreSurPlace();
    });
  }

  function modalePoint(rid, pid) {
    const r = reunion(rid);
    const p = pid ? r.points.find((x) => x.id === pid) : null;
    const x = p || { titre: '', detail: '', vote: false, resolution: '', majorite: '' };
    const corps = `
      <label class="champ">Point de l'ordre du jour<input name="titre" maxlength="140" value="${esc(x.titre)}" list="liste-points-types"><datalist id="liste-points-types">${B.pointsTypes.map((y) => `<option value="${esc(y.titre)}"></option>`).join('')}</datalist></label>
      <label class="case"><input type="checkbox" name="vote" id="m-vote" ${x.vote ? 'checked' : ''}> Soumis au vote (résolution)</label>
      <div id="m-champs-vote" ${x.vote ? '' : 'hidden'}>
        <label class="champ">Texte de la résolution<small>Repris dans le procès-verbal : « L'assemblée approuve… »</small><textarea name="resolution" rows="3" maxlength="1500">${esc(x.resolution)}</textarea></label>
        <label class="champ" style="margin-top:12px">Majorité<select name="majorite">${optionsMajorites(x.majorite, { vide: `Par défaut de l'instance : ${R.majorite(E, regle(r.instance).majorite)?.nom || ''}` })}</select></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le point' : 'Nouveau point', corps, p ? `${PIED_STD}<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, choix) => {
      retenir();
      if (choix === 'supprimer') { r.points = r.points.filter((y) => y.id !== p.id); sauver(); rendreSurPlace(); toast('Point supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const titre = String(f.get('titre') || '').trim();
      if (!titre) return 'Indique le point de l\'ordre du jour.';
      const vote = f.get('vote') === 'on';
      const type = B.pointsTypes.find((y) => y.titre === titre);
      const resolution = String(f.get('resolution') || '') || (!p && vote && type ? type.resolution : '');
      const n = R.normaliserPoint({ ...(p || {}), titre, vote, resolution, majorite: f.get('majorite') || '' });
      if (p) Object.assign(p, n); else r.points.push(n);
      sauver(); rendreSurPlace();
    });
    $('#m-vote').addEventListener('change', (e) => { $('#m-champs-vote').hidden = !e.target.checked; });
  }

  function modaleMembre(id) {
    const m = id ? membre(id) : null;
    const x = m || { nom: '', categorie: 'Membre actif', votant: true, cotisation: true, email: '', entree: auj(), note: '' };
    const mandats = m ? E.mandats.filter((y) => y.membre === m.id) : [];
    const corps = `
      <label class="champ">Nom<small>Prénom et nom, ou nom d'usage</small><input name="nom" required maxlength="80" value="${esc(x.nom)}" autocomplete="off"></label>
      <div class="rang-champs">
        <label class="champ">Catégorie<small>Celles de tes statuts</small><input name="categorie" maxlength="40" value="${esc(x.categorie)}" list="liste-categories"><datalist id="liste-categories">${[...new Set([...B.categories, ...E.membres.map((y) => y.categorie)])].map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist></label>
        <label class="champ">Membre depuis<input type="date" name="entree" value="${x.entree || ''}"></label>
      </div>
      <label class="case"><input type="checkbox" name="votant" ${x.votant ? 'checked' : ''}> Voix délibérative en assemblée générale</label>
      <label class="case"><input type="checkbox" name="cotisation" ${x.cotisation ? 'checked' : ''}> Cotisation à jour</label>
      <label class="champ">E-mail<small>Facultatif : pour copier la liste des convoqués. Aucun envoi par l'outil.</small><input type="email" name="email" maxlength="120" value="${esc(x.email)}" autocomplete="off"></label>
      <label class="champ">Note<small>Facultative. Aucune donnée sensible.</small><input name="note" maxlength="200" value="${esc(x.note)}"></label>
      ${mandats.length ? `<p class="aide">Mandats : ${mandats.map((y) => `${esc(y.fonction)} (${y.instance === 'bureau' ? 'bureau' : 'conseil'}, ${esc(ETAT_MANDAT[R.etatMandat(y, auj(), E.reglages.alerteMandatJours)][0].toLowerCase())})`).join(', ')}.</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = m ? `${PIED_STD}<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="encore">Ajouter et continuer</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(m ? 'Modifier le membre' : 'Nouveau membre', corps, pied, (f, choix) => {
      if (choix === 'supprimer') { setTimeout(() => supprimerMembre(m.id), 0); return; }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du membre.';
      const autre = E.membres.find((y) => y.id !== m?.id && R.cle(y.nom) === R.cle(nom));
      if (autre) return `« ${autre.nom} » existe déjà.`;
      const email = String(f.get('email') || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Adresse e-mail illisible (ou laisse vide).';
      const champs = { nom, categorie: f.get('categorie'), entree: f.get('entree'), votant: f.get('votant') === 'on', cotisation: f.get('cotisation') === 'on', email, note: f.get('note') };
      retenir();
      if (m) Object.assign(m, R.normaliserMembre({ ...m, ...champs }));
      else E.membres.push(R.normaliserMembre(champs));
      sauver(); rendreSurPlace();
      if (choix === 'encore') { modaleMembre(null); modale().dataset.garder = '1'; toast('Membre ajouté. Le suivant ?'); return; }
      toast(m ? 'Membre enregistré.' : 'Membre ajouté.', { libelle: 'Annuler', faire: annuler });
    });
  }
  function supprimerMembre(id) {
    const m = membre(id);
    if (!m || !confirm(`Supprimer la fiche de ${m.nom}, ses mandats et ses lignes des réunions à venir ? Les procès-verbaux passés gardent son nom tel qu'il a été consigné.`)) return;
    retenir();
    E = R.supprimerMembre(E, id, auj());
    sauver(); rendreSurPlace();
    toast('Membre supprimé.', { libelle: 'Annuler', faire: annuler });
  }

  function modaleImport() {
    let analyse = null;
    const corps = `
      <p>Colle la liste depuis un tableur ou tes notes : <b>un membre par ligne</b>, colonnes séparées par une tabulation (copie d'un tableur) ou un point-virgule.</p>
      <p class="aide">nom ; catégorie ; e-mail ; cotisation (oui ou non)<br>Seul le nom est obligatoire. Une ligne d'en-tête est ignorée ; un nom déjà présent est complété, pas dupliqué.</p>
      <label class="champ"><span class="sr-only">Liste</span><textarea name="liste" rows="8" placeholder="Claire Martel ; Membre fondateur ; claire@exemple.org ; oui&#10;Marc Delorme ; ; ; non&#10;Odette Marchand ; Membre d'honneur"></textarea></label>
      <div id="apercu-import"></div>
      <p class="erreur" role="alert"></p>`;
    const pied = '<button class="btn primaire" value="importer" id="b-importer" disabled>Importer</button><button class="btn" value="analyser">Vérifier la liste</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale('Coller une liste de membres', corps, pied, (f, choix) => {
      if (choix === 'analyser' || !analyse) {
        analyse = R.analyserListe(f.get('liste'));
        const zone = $('#apercu-import');
        if (!analyse.membres.length) { zone.innerHTML = ''; $('#b-importer').disabled = true; return 'Aucune ligne lisible : un nom par ligne au minimum.'; }
        const existants = new Set(E.membres.map((m) => R.cle(m.nom)));
        const deja = analyse.membres.filter((x) => existants.has(R.cle(x.nom))).length;
        zone.innerHTML = `<div class="apercu-liste"><p><b>${pluriel(analyse.membres.length, 'membre')}</b>${deja ? ` · ${deja} déjà présents (complétés)` : ''} · ${analyse.membres.filter((x) => x.cotisation).length} à jour</p>
          <ul>${analyse.membres.slice(0, 8).map((x) => `<li><b>${esc(x.nom)}</b> ${x.categorie ? `<small>${esc(x.categorie)}</small>` : ''}${x.email ? ` <small>· ${esc(x.email)}</small>` : ''} ${x.cotisation ? '<span class="etiquette vert">À jour</span>' : ''}</li>`).join('')}${analyse.membres.length > 8 ? `<li>… et ${analyse.membres.length - 8} autres</li>` : ''}</ul>
          ${analyse.erreurs.length ? `<p class="erreur">${analyse.erreurs.map(esc).join('<br>')}</p>` : ''}</div>`;
        $('#b-importer').disabled = false;
        return '';
      }
      retenir();
      const r = R.importer(E, analyse.membres);
      E = r.E;
      filtre.membres = 'tous'; vue = 'membres';
      sauver(); rendre();
      toast(`${pluriel(r.crees, 'membre ajouté', 'membres ajoutés')}${r.completes ? `, ${pluriel(r.completes, 'complété', 'complétés')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    modale().querySelector('[name=liste]').addEventListener('input', () => { analyse = null; $('#b-importer').disabled = true; });
  }

  function modaleMandat(id) {
    const m = id ? E.mandats.find((x) => x.id === id) : null;
    if (!E.membres.length) { toast('Ajoute d\'abord les membres.'); changerVue('membres'); return; }
    const x = m || { membre: '', instance: 'bureau', fonction: '', debut: auj(), duree: regle('bureau').duree, fin: null, note: '' };
    const corps = `
      <label class="champ">Membre<select name="membre">${[...E.membres].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((y) => `<option value="${y.id}" ${y.id === x.membre ? 'selected' : ''}>${esc(y.nom)}</option>`).join('')}</select></label>
      <div class="rang-champs">
        <label class="champ">Instance<select name="instance" id="m-instance"><option value="bureau" ${x.instance === 'bureau' ? 'selected' : ''}>Bureau</option><option value="ca" ${x.instance === 'ca' ? 'selected' : ''}>Conseil</option></select></label>
        <label class="champ">Fonction<input name="fonction" maxlength="60" value="${esc(x.fonction)}" list="liste-fonctions" placeholder="Ex. : Trésorière"><datalist id="liste-fonctions">${[...B.fonctions.bureau, ...B.fonctions.ca].map((y) => `<option value="${esc(y)}"></option>`).join('')}</datalist></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Début du mandat<input type="date" name="debut" value="${x.debut || ''}"></label>
        <label class="champ">Durée (années)<small>Celle des statuts ; 0 : sans échéance</small><input type="number" name="duree" min="0" max="20" inputmode="numeric" value="${x.duree}"></label>
      </div>
      <label class="champ">Échéance précise<small>Facultative : remplace début + durée (ex. « jusqu'à l'AG de juin 2027 »)</small><input type="date" name="fin" value="${x.fin || ''}"></label>
      ${m ? `<label class="champ">Terminé le<small>Démission, remplacement : le mandat passe dans l'historique</small><input type="date" name="closLe" value="${m.closLe || ''}"></label>` : ''}
      <label class="champ">Note<small>Facultative</small><input name="note" maxlength="200" value="${esc(x.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? 'Modifier le mandat' : 'Nouveau mandat', corps, m ? `${PIED_STD}<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, choix) => {
      retenir();
      if (choix === 'supprimer') { E.mandats = E.mandats.filter((y) => y.id !== m.id); sauver(); rendreSurPlace(); toast('Mandat supprimé.', { libelle: 'Annuler', faire: annuler }); return; }
      const debut = String(f.get('debut') || '');
      if (!R.estDate(debut)) return 'Indique la date de début du mandat.';
      const fin = String(f.get('fin') || '');
      if (fin && fin <= debut) return 'L\'échéance doit suivre le début du mandat.';
      const n = R.normaliserMandat({ ...(m || {}), membre: f.get('membre'), instance: f.get('instance'), fonction: String(f.get('fonction') || '') || (f.get('instance') === 'bureau' ? 'Membre du bureau' : 'Administrateur·rice'), debut, duree: f.get('duree'), fin, closLe: m ? f.get('closLe') : null, note: f.get('note') });
      if (m) Object.assign(m, n); else E.mandats.push(n);
      sauver(); rendreSurPlace();
      toast(m ? 'Mandat enregistré.' : 'Mandat ajouté.', { libelle: 'Annuler', faire: annuler });
    });
    $('#m-instance').addEventListener('change', (e) => { if (!m) modale().querySelector('[name=duree]').value = regle(e.target.value).duree; });
  }
  function modaleRenouveler(id) {
    const m = E.mandats.find((x) => x.id === id);
    const mb = membre(m.membre);
    const ag = R.prochaine(E, auj(), (r) => R.estAG(r.instance));
    const date = ag && ag.date >= (R.finMandat(m) || '') ? ag.date : (R.finMandat(m) || auj());
    const corps = `
      <p>${esc(mb?.nom || '')}, ${esc(m.fonction)} : le mandat actuel se termine à la date choisie, et un nouveau mandat commence ce jour-là pour la même fonction.</p>
      <div class="rang-champs">
        <label class="champ">Date du renouvellement<small>${ag ? `Prochaine AG : ${dateCourte(ag.date)}` : 'Date de l\'élection'}</small><input type="date" name="date" value="${date}"></label>
        <label class="champ">Durée du nouveau mandat (années)<input type="number" name="duree" min="0" max="20" inputmode="numeric" value="${m.duree || regle(m.instance).duree}"></label>
      </div>
      <p class="aide">Autre personne élue ? Termine ce mandat (Modifier, « Terminé le ») et ajoute un nouveau mandat.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Renouveler le mandat', corps, '<button class="btn primaire" value="ok">Renouveler</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const d = String(f.get('date') || '');
      if (!R.estDate(d)) return 'Indique la date du renouvellement.';
      if (m.debut && d <= m.debut) return 'La date doit suivre le début du mandat actuel.';
      retenir();
      E = R.renouveler(E, id, d, Number(f.get('duree')) || 0).E;
      sauver(); rendreSurPlace();
      toast('Mandat renouvelé.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleRegle(id) {
    const g = regle(id);
    const ag = R.estAG(id);
    const corps = `
      <p class="aide">Recopie l'article de tes statuts. Aucune règle légale n'est appliquée par défaut.</p>
      <div class="rang-champs">
        <label class="champ">Délai de convocation (jours)<input type="number" name="delai" min="0" max="365" inputmode="numeric" value="${g.delai}"></label>
        ${ag ? '' : `<label class="champ">Durée des mandats (années)<small>0 : non fixée</small><input type="number" name="duree" min="0" max="20" inputmode="numeric" value="${g.duree}"></label>`}
      </div>
      ${champsQuorum(g.quorum, 'q', { libelle: 'Quorum' })}
      <label class="case"><input type="checkbox" name="pouvoirsQuorum" ${g.pouvoirsQuorum ? 'checked' : ''}> Les membres représentés comptent dans le quorum</label>
      ${champsQuorum(g.quorum2, 'q2', { types: R.TYPES_QUORUM2, libelle: 'Seconde convocation' })}
      <div class="rang-champs">
        <label class="champ">Pouvoirs<select name="pouvoirs"><option value="oui" ${g.pouvoirs.autorises ? 'selected' : ''}>Admis</option><option value="non" ${g.pouvoirs.autorises ? '' : 'selected'}>Non admis</option></select></label>
        <label class="champ">Au plus, par membre<small>0 : sans plafond</small><input type="number" name="plafond" min="0" max="100" inputmode="numeric" value="${g.pouvoirs.plafond}"></label>
      </div>
      <label class="champ">Majorité par défaut<select name="majorite">${optionsMajorites(g.majorite)}</select></label>
      <label class="champ">Référence<small>Ex. : « Statuts, article 11 »</small><input name="reference" maxlength="120" value="${esc(g.reference)}"></label>
      <label class="case case-forte"><input type="checkbox" name="verifiee" ${g.verifiee ? 'checked' : ''}> Conforme à nos statuts</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(esc(g.nom), corps, PIED_STD, (f) => {
      retenir();
      E.regles.instances[id] = R.normaliserInstance({ ...g, delai: f.get('delai'), duree: ag ? g.duree : f.get('duree'), quorum: lireQuorum(f, 'q'), quorum2: lireQuorum(f, 'q2'), pouvoirsQuorum: f.get('pouvoirsQuorum') === 'on', pouvoirs: { autorises: f.get('pouvoirs') === 'oui', plafond: f.get('plafond') }, majorite: f.get('majorite'), reference: f.get('reference'), verifiee: f.get('verifiee') === 'on' }, id);
      sauver(); rendreSurPlace();
      toast('Règles enregistrées : quorum, votes et rétroplanning recalculés.', { libelle: 'Annuler', faire: annuler });
    });
    brancherQuorums(modale());
  }
  function modaleMajorite(id) {
    const m = id ? R.majorite(E, id) : null;
    const x = m || { nom: '', base: 'exprimes', num: 2, den: 3, comparaison: 'atteint', reference: '' };
    const utilisee = m && (R.INSTANCES.some((i) => regle(i).majorite === m.id) || E.reunions.some((r) => r.points.some((p) => p.majorite === m.id)));
    const bases = { exprimes: 'Suffrages exprimés (pour + contre, abstentions exclues)', 'exprimes-abst': 'Votes, abstentions comprises', presents: 'Présents et représentés', inscrits: 'Tous les membres votants (inscrits)' };
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="80" value="${esc(x.nom)}" placeholder="Ex. : Majorité des trois quarts"></label>
      <div class="rang-champs">
        <label class="champ">Il faut<select name="comparaison"><option value="atteint" ${x.comparaison === 'atteint' ? 'selected' : ''}>Au moins</option><option value="plus" ${x.comparaison === 'plus' ? 'selected' : ''}>Plus de</option></select></label>
        <label class="champ">Fraction de voix pour<span class="fraction-champs"><input name="num" type="number" min="1" max="1000" inputmode="numeric" value="${x.num}" aria-label="Numérateur"><span>/</span><input name="den" type="number" min="1" max="1000" inputmode="numeric" value="${x.den}" aria-label="Dénominateur"></span></label>
      </div>
      <label class="champ">Calculée sur<select name="base">${R.BASES.map((b) => `<option value="${b}" ${x.base === b ? 'selected' : ''}>${bases[b]}</option>`).join('')}</select></label>
      <label class="champ">Référence<small>Facultative</small><input name="reference" maxlength="120" value="${esc(x.reference)}"></label>
      <p class="aide">Exemples : majorité simple = plus de 1/2 des suffrages exprimés ; deux tiers = au moins 2/3 ; unanimité = au moins 1/1 des présents et représentés.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(m ? 'Modifier la majorité' : 'Nouvelle majorité', corps, m ? `${PIED_STD}${utilisee ? '' : '<button class="btn danger gauche" value="supprimer" type="submit">Supprimer</button>'}` : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (f, choix) => {
      retenir();
      if (choix === 'supprimer') { E.regles.majorites = E.regles.majorites.filter((y) => y.id !== m.id); sauver(); rendreSurPlace(); return; }
      const nom = String(f.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à cette majorité.';
      const n = R.normaliserMajorite({ ...(m || {}), nom, base: f.get('base'), num: f.get('num'), den: f.get('den'), comparaison: f.get('comparaison'), reference: f.get('reference') });
      if (m) Object.assign(m, n); else E.regles.majorites.push(n);
      sauver(); rendreSurPlace();
    });
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const a = E.association;
    const r = E.reglages;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom de l'association<input name="nom" maxlength="100" value="${esc(a.nom)}"></label>
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(a.ville)}"></label>
      </div>
      <label class="champ">Siège<small>Facultatif, en tête des convocations et des PV</small><input name="siege" maxlength="140" value="${esc(a.siege)}"></label>
      <div class="rang-champs">
        <label class="champ">Signataire des convocations<input name="signataire" maxlength="80" value="${esc(a.signataire)}"></label>
        <label class="champ">Qualité<input name="qualite" maxlength="60" value="${esc(a.qualite)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Alerte avant l'échéance d'un mandat (jours)<input type="number" name="alerteMandatJours" min="0" max="365" value="${r.alerteMandatJours}"></label>
        <label class="champ">Étapes « bientôt » (jours)<input type="number" name="alerteEtapesJours" min="0" max="60" value="${r.alerteEtapesJours}"></label>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports</h3><p class="aide">En tableur (CSV, point-virgule) : liste des membres, mandats, archive des réunions avec quorum et votes.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv" data-quoi="membres">Membres</button><button class="btn petit" type="button" data-action="csv" data-quoi="mandats">Mandats</button><button class="btn petit" type="button" data-action="csv" data-quoi="archive">Archive des réunions</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="aide">Les membres du bureau qui ouvrent l'espace avec la même clé voient les mêmes données.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">L'association est responsable des données de ses membres. L'outil ne demande qu'un nom, une catégorie et, facultativement, un e-mail et une date d'entrée ; aucune donnée sensible. Supprime la fiche d'un membre qui quitte l'association (les procès-verbaux passés gardent son nom, comme le registre). Exporte et supprime ce dont tu n'as plus besoin.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Trames de convocation, de pouvoir et de procès-verbal originales, rédigées pour QME (base intégrée version ${B.version}). Aucune règle légale intégrée : délais, quorums, pouvoirs, majorités et durées de mandat sont ceux que tu saisis d'après tes statuts. Outil d'aide : les statuts font foi, et il ne remplace pas un conseil juridique.</p></div>`;
    ouvrirModale('Réglages', corps, PIED_STD, (f) => {
      E.association = R.normaliserAssociation({ ...E.association, nom: f.get('nom'), ville: f.get('ville'), siege: f.get('siege'), signataire: f.get('signataire'), qualite: f.get('qualite') });
      E.reglages = R.normaliserReglages({ alerteMandatJours: f.get('alerteMandatJours'), alerteEtapesJours: f.get('alerteEtapesJours') });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.membres) || !Array.isArray(d.reunions)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.membres.length, 'membre')}, ${pluriel(d.reunions.length, 'réunion')}) ?`)) return;
        E = normaliser(d); delete E.majLe; fiche = null;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `assemblee-generale-${auj()}.json`);
  const exporterCsv = (quoi) => telecharger({ membres: R.csvMembres, mandats: R.csvMandats, archive: R.csvArchive }[quoi](E, auj()), 'text/csv;charset=utf-8', `${quoi}-${auj()}.csv`);

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
  async function copierTexte(texte, ok) {
    try { await navigator.clipboard.writeText(texte); toast(ok); } catch {
      const z = document.createElement('textarea'); z.value = texte; document.body.appendChild(z); z.select();
      try { document.execCommand('copy'); toast(ok); } catch { toast('Copie impossible : sélectionne le texte à la main.'); }
      z.remove();
    }
  }

  // ---------- Actions sur une réunion ----------
  // La feuille de présence est enregistrée au premier pointage (liste figée ensuite, actualisable).
  function emargementModifiable(r) {
    if (!r.emargement.length) r.emargement = R.construireEmargement(E, r, auj());
    return r.emargement;
  }
  function basculerEtape(rid, eid) {
    const r = reunion(rid);
    const e = r?.etapes.find((x) => x.id === eid);
    if (!e) return;
    retenir();
    e.fait = !e.fait;
    if (e.cle === 'convocation' && e.fait && !r.convoqueLe) r.convoqueLe = auj();
    sauver(); rendreSurPlace();
    toast(e.fait ? `Fait : ${e.titre}.` : 'Étape rouverte.', { libelle: 'Annuler', faire: annuler });
  }
  function deplacerPoint(rid, pid, sens) {
    const r = reunion(rid);
    const i = r.points.findIndex((p) => p.id === pid);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= r.points.length) return;
    [r.points[i], r.points[j]] = [r.points[j], r.points[i]];
    sauver(); rendreSurPlace();
  }
  function secondeConvocation(rid) {
    const r = reunion(rid);
    modaleReunion(null, { instance: r.instance, convocationNo: 2, depuis: r });
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const r = id ? reunion(id) : null;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); fiche = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': lireReglesAccueil(); accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reunion': if (modale().open) modale().close(); changerVue('reunions', { fiche: id, partie: el.dataset.partie || 'preparation' }); break;
      case 'partie': onglet = el.dataset.partie; rendre(); document.querySelector('.parties')?.scrollIntoView({ block: 'nearest' }); break;
      case 'filtre-membres': filtre.membres = el.dataset.filtre; changerVue('membres'); break;
      case 'filtre': filtre[el.dataset.cle] = el.dataset.filtre; rendre(); break;
      case 'nouvelle-reunion': modaleReunion(null); break;
      case 'modifier-reunion': modaleReunion(id); break;
      case 'supprimer-reunion': if (r && confirm(`Supprimer « ${R.titreReunion(E, r)} » du ${dateCourte(r.date)}, sa feuille de présence, ses votes et son procès-verbal ?`)) { retenir(); E.reunions = E.reunions.filter((x) => x.id !== id); sauver(); changerVue('reunions'); toast('Réunion supprimée.', { libelle: 'Annuler', faire: annuler }); } break;
      case 'seconde-convocation': secondeConvocation(id); break;
      case 'etape': basculerEtape(id, el.dataset.etape); break;
      case 'nouvelle-etape': modaleEtape(id, null); break;
      case 'modifier-etape': modaleEtape(id, el.dataset.etape); break;
      case 'nouveau-point': modalePoint(id, null); break;
      case 'modifier-point': modalePoint(id, el.dataset.point); break;
      case 'ajouter-point-type': { const x = B.pointsTypes.find((y) => y.titre === el.dataset.titre) || { titre: el.dataset.titre, vote: true }; retenir(); const i = r.points.findIndex((p) => /questions diverses/i.test(p.titre)); const n = R.normaliserPoint({ ...x }); if (i >= 0) r.points.splice(i, 0, n); else r.points.push(n); sauver(); rendreSurPlace(); toast(`Ajouté à l'ordre du jour : ${x.titre}.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'monter-point': deplacerPoint(id, el.dataset.point, -1); break;
      case 'descendre-point': deplacerPoint(id, el.dataset.point, 1); break;
      case 'convoque-aujourdhui': retenir(); r.convoqueLe = auj(); r.etapes.filter((x) => x.cle === 'convocation').forEach((x) => { x.fait = true; }); sauver(); rendreSurPlace(); toast('Convocation notée comme envoyée aujourd\'hui.', { libelle: 'Annuler', faire: annuler }); break;
      case 'copier-convocation': { const z = document.querySelector(`[data-convocation="${id}"]`); copierTexte(z ? z.value : R.texteConvocation(B, E, r, auj()), 'Convocation copiée : colle-la dans ton e-mail.'); break; }
      case 'regenerer-convocation': if (confirm('Remplacer le texte modifié par la trame, remplie avec l\'ordre du jour actuel ?')) { retenir(); r.convocation = ''; sauver(); rendreSurPlace(); } break;
      case 'copier-pouvoir': copierTexte(R.textePouvoir(B, E, r, auj()), 'Modèle de pouvoir copié.'); break;
      case 'copier-mails': { const l = R.presence(E, r, auj()).liste.map((x) => membre(x.membre)?.email).filter(Boolean); copierTexte(l.join(', '), `${pluriel(l.length, 'adresse copiée', 'adresses copiées')} : colle-les en copie cachée.`); break; }
      case 'copier-mails-tous': { const l = E.membres.map((m) => m.email).filter(Boolean); if (l.length) copierTexte(l.join(', '), `${pluriel(l.length, 'adresse copiée', 'adresses copiées')} : colle-les en copie cachée.`); else toast('Aucun e-mail saisi.'); break; }
      case 'copier-pv': copierTexte(R.textePV(B, E, r, auj()), 'Procès-verbal copié.'); break;
      case 'pv-signe': retenir(); r.pvSigneLe = auj(); r.etapes.filter((x) => x.cle === 'pv').forEach((x) => { x.fait = true; }); sauver(); rendreSurPlace(); toast('Procès-verbal signé : la réunion passe dans l\'archive.', { libelle: 'Annuler', faire: annuler }); break;
      case 'imprimer': imprimer(el.dataset.quoi, r); break;
      case 'presence': {
        retenir();
        const l = emargementModifiable(r).find((x) => x.membre === el.dataset.membre);
        if (l) { l.statut = el.dataset.statut; if (l.statut !== 'represente') l.mandataire = ''; }
        // Un membre qui n'est plus présent ne porte plus de pouvoirs.
        if (l && l.statut !== 'present') r.emargement.forEach((x) => { if (x.mandataire === l.membre) x.mandataire = ''; });
        sauver(); rendreSurPlace();
        break;
      }
      case 'actualiser-emargement': retenir(); r.emargement = R.construireEmargement(E, r, auj()); sauver(); rendreSurPlace(); toast('Liste actualisée depuis les membres et les mandats.', { libelle: 'Annuler', faire: annuler }); break;
      case 'unanimite': { const p = r.points.find((x) => x.id === el.dataset.point); const pr = R.presence(E, r, auj()); retenir(); Object.assign(p, { pour: pr.voix, contre: 0, abstention: 0 }); sauver(); rendreSurPlace(); break; }
      case 'effacer-vote': { const p = r.points.find((x) => x.id === el.dataset.point); retenir(); Object.assign(p, { pour: null, contre: null, abstention: null }); sauver(); rendreSurPlace(); toast('Décompte effacé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'nouveau-membre': modaleMembre(null); break;
      case 'modifier-membre': modaleMembre(id); break;
      case 'cotisation': { const m = membre(id); if (m) { retenir(); m.cotisation = !m.cotisation; sauver(); rendreSurPlace(); toast(`${m.nom} : cotisation ${m.cotisation ? 'à jour' : 'à régulariser'}.`, { libelle: 'Annuler', faire: annuler }); } break; }
      case 'cotisations-zero': { const n = E.membres.filter((m) => m.cotisation).length; if (n && confirm(`Décocher la cotisation de ${pluriel(n, 'membre')} pour le nouvel exercice ?`)) { retenir(); E = R.cotisationsAZero(E).E; sauver(); rendreSurPlace(); toast('Cotisations décochées.', { libelle: 'Annuler', faire: annuler }); } break; }
      case 'importer': modaleImport(); break;
      case 'nouveau-mandat': modaleMandat(null); break;
      case 'modifier-mandat': modaleMandat(id); break;
      case 'renouveler': modaleRenouveler(id); break;
      case 'modifier-regle': modaleRegle(id); break;
      case 'verifier-regle': retenir(); E.regles.instances[id].verifiee = true; sauver(); rendreSurPlace(); toast(`${nomInstance(id)} : règles confirmées.`, { libelle: 'Annuler', faire: annuler }); break;
      case 'nouvelle-majorite': modaleMajorite(null); break;
      case 'modifier-majorite': modaleMajorite(id); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv': exporterCsv(el.dataset.quoi); break;
      case 'fermer': modale().close(); break;
      default: break;
    }
  });

  // Saisies au fil de la frappe (convocation, notes), enregistrées sans redessiner.
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.convocation) { const r = reunion(el.dataset.convocation); if (r) { r.convocation = el.value.slice(0, 8000); sauver(); } }
    else if (el.dataset.notes) { const r = reunion(el.dataset.id); const p = r?.points.find((x) => x.id === el.dataset.notes); if (p) { p.notes = el.value.slice(0, 3000); sauver(); } }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    const r = el.dataset.id ? reunion(el.dataset.id) : null;
    if (el.dataset.notes && r) { rendreSurPlace(); }
    else if (el.dataset.convocation) { /* déjà enregistré */ }
    else if (el.dataset.vote && r) {
      const p = r.points.find((x) => x.id === el.dataset.vote);
      if (!p) return;
      retenir();
      const v = String(el.value).trim();
      p[el.dataset.champ] = v === '' ? null : Math.max(0, Math.round(Number(v)) || 0);
      sauver(); rendreSurPlace();
      document.querySelector(`[data-vote="${p.id}"][data-champ="${el.dataset.champ}"]`)?.focus({ preventScroll: true });
    } else if (el.dataset.majoritePoint && r) {
      const p = r.points.find((x) => x.id === el.dataset.majoritePoint);
      if (p) { retenir(); p.majorite = el.value; sauver(); rendreSurPlace(); }
    } else if (el.dataset.mandataire && r) {
      retenir();
      const l = emargementModifiable(r).find((x) => x.membre === el.dataset.mandataire);
      if (l) l.mandataire = el.value;
      sauver(); rendreSurPlace();
    } else if (el.dataset.trame) {
      const x = reunion(el.dataset.trame);
      if (!x) return;
      if (x.convocation && !confirm('Remplacer le texte modifié par cette trame ?')) { el.value = x.trame; return; }
      retenir(); x.trame = el.value; x.convocation = ''; sauver(); rendreSurPlace();
    } else if (el.dataset.champReunion && r) {
      const k = el.dataset.champReunion;
      retenir();
      if (k === 'convoqueLe' || k === 'pvSigneLe') {
        r[k] = R.estDate(el.value) ? el.value : null;
        const cle = k === 'convoqueLe' ? 'convocation' : 'pv';
        if (r[k]) r.etapes.filter((x) => x.cle === cle).forEach((x) => { x.fait = true; });
      } else if (k === 'heureFin') r.heureFin = R.estHeure(el.value) ? el.value : '';
      else r[k] = String(el.value).slice(0, 80);
      sauver(); rendreSurPlace();
    }
  });

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
  window.__assemblee = { etat: () => E, regles: R };
  init();
})();
