// Demandes d'achat et fournitures QME : demandes, validation (seuil automatique), commandes groupées par fournisseur,
// réception partielle, budget annuel par service, catalogue sans prix, statistiques. Une clé partagée par l'équipe ;
// chacun saisit son nom. Rien n'est connecté : aucun fournisseur, aucune messagerie, aucun paiement.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.ACH;
  const API = '/api/templates';
  const PRODUIT = 'ACH';
  const CLE_CODE = 'qme-ach-code';
  const CLE_CACHE = 'qme-ach-cache';
  const CLE_DEMO = 'qme-ach-demo';
  const CLE_NOM = 'qme-ach-nom';
  const CLE_NOM_DEMO = 'qme-ach-nom-demo';
  const CLE_ACCUEIL = 'qme-ach-ecran-accueil';
  const CODE_DEMO = 'DEMO';
  const DEFAUTS = { reglages: B.reglages };

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
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' }).replace(/\./g, '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const qte = (n) => String(n).replace('.', ',');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let ops = [];             // actions pas encore enregistrées en ligne (rejouées en cas de conflit)
  let autresModifs = false; // annulation ou restauration : l'état complet doit partir tel quel
  let vue = 'demandes';
  const filtre = { liste: 'aValider', q: '', service: '' };
  let exerciceVu = null;
  let periodeStats = 'exercice';
  let ongletCatalogue = 'articles';
  let categorieVue = '';
  let rechercheCatalogue = '';
  let annulation = null;

  const etatVide = () => R.etatVide(DEFAUTS);
  const normaliser = (d) => R.normaliser(d, auj(), DEFAUTS);
  const dem = (id) => E.demandes.find((d) => d.id === id);
  const trouver = (coll, id) => E[coll].find((x) => x.id === id);
  const nomDe = (coll, id, defaut = '') => trouver(coll, id)?.nom || defaut;
  const nomService = (id) => nomDe('services', id, 'Service supprimé');
  const nomFournisseur = (id) => (id ? nomDe('fournisseurs', id, 'Fournisseur supprimé') : 'Fournisseur à choisir');
  const servicesActifs = () => E.services.filter((s) => !s.archive);
  const fournisseursActifs = () => E.fournisseurs.filter((f) => !f.archive);
  const couleurCat = (id) => B.couleurs[(B.categories.find((c) => c.id === id)?.couleur ?? 6) % B.couleurs.length];
  const nomCat = (id) => B.categories.find((c) => c.id === id)?.nom || 'Autre';
  const couleurService = (s) => B.couleurs[(s?.couleur ?? 0) % B.couleurs.length];
  const monNom = () => stock.lire(session.demo ? CLE_NOM_DEMO : CLE_NOM) || '';
  const ecrireNom = (n) => stock.ecrire(session.demo ? CLE_NOM_DEMO : CLE_NOM, n.trim().slice(0, 60));
  const exerciceCourant = () => R.exercice(auj(), E.reglages.debutExercice);
  const libExercice = (a) => R.libelleExercice(a, E.reglages.debutExercice);
  const taxe = () => E.reglages.taxe;
  const eur = (n) => (n === null || n === undefined ? '–' : `${euros(n)}${taxe() === 'TTC' ? ' TTC' : ' HT'}`);

  function retenir() { annulation = { E: structuredClone(E), ops: structuredClone(ops), autresModifs }; }
  function annuler() {
    if (!annulation) return;
    E = annulation.E; ops = annulation.ops; annulation = null;
    // Ce qui est déjà parti en ligne est remplacé par l'état complet : on force un envoi.
    autresModifs = true;
    sauver(); rendre();
    if (modale().open) modale().close();
    toast('Modification annulée.');
  }
  // Toute modification passe par ici : règle pure, journal des actions (rejouées en cas de conflit), enregistrement.
  function agir(action, { annulable = true } = {}) {
    const r = R.appliquer(E, action);
    if (!r.ok) return r;
    if (annulable) retenir();
    E = r.etat;
    if (!session.demo) ops.push(structuredClone(action));
    sauver();
    rendre();
    return r;
  }

  // ---------- Stockage et synchronisation ----------
  let minuterie = null, envoiEnCours = false, aRenvoyer = false, etatSync = 'ok';

  function cache(nonEnvoye = false) {
    if (session.demo) { stock.ecrire(CLE_DEMO, E); return; }
    stock.ecrire(CLE_CACHE, { code: session.code, jeton: session.jeton, etat: E, base: session.base, nonEnvoye, ops, autresModifs }, !session.memoriser);
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

  // Un autre appareil a écrit entre-temps : on part de sa version et on y rejoue nos actions.
  function fusionnerAvecServeur(donnees) {
    const { etat, refusees, acceptees } = R.rejouer(normaliser(donnees), ops);
    const perdues = autresModifs;
    E = etat;
    session.base = donnees.majLe;
    return { refusees, acceptees, perdues };
  }
  function signalerFusion({ refusees, perdues }) {
    if (refusees.length) toast(`Un autre appareil est passé avant toi : ${refusees.map((x) => x.erreur.replace(/\.$/, '')).slice(0, 3).join(' ; ')}${refusees.length > 3 ? ' ; …' : ''}.`, null, 12000);
    else if (perdues) toast('Un autre appareil a modifié les données entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.', null, 9000);
  }

  async function envoyer() {
    if (session.demo) return;
    if (envoiEnCours) { aRenvoyer = true; return; }
    envoiEnCours = true;
    majSync('envoi');
    try {
      const envoyees = ops.length;
      const { statut, corps } = await appel('/donnees', { method: 'PUT', body: JSON.stringify({ donnees: E, base: session.base }) });
      if (statut === 409) {
        const f = fusionnerAvecServeur(corps.donnees);
        // Les actions acceptées restent dans le journal : rejouées si un autre appareil écrit encore entre-temps.
        ops = f.acceptees; autresModifs = false;
        cache(true);
        if (!modale().open) rendre();
        signalerFusion(f);
        aRenvoyer = true;
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut !== 200) {
        throw new Error(String(statut));
      } else {
        session.base = corps.majLe;
        ops = ops.slice(envoyees); autresModifs = false;
        cache(ops.length > 0);
      }
      majSync(ops.length ? 'attente' : 'ok');
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
    el.title = etat === 'horsligne' ? 'Pas de connexion : tes saisies sont gardées sur cet appareil et seront vérifiées et envoyées au retour du réseau.' : libelles[etat];
  }

  // ---------- Connexion ----------
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
    if (statut === 401) throw new Error('Clé ou code inconnu. Copie-le depuis l\'e-mail reçu après l\'achat.');
    if (statut !== 200) throw new Error(corps?.erreur || 'Le service ne répond pas. Réessaie dans un instant.');
    if (corps.produit !== PRODUIT) throw new Error('Cette clé ouvre un autre template QME : utilise la page qm-engineering.fr/connexion/.');
    session.code = code; session.jeton = corps.jeton; session.demo = false; session.memoriser = memoriser;
    stock.suppr(CLE_CODE);
    stock.ecrire(CLE_CODE, code, !memoriser);
    chargerDepuisServeur(corps.donnees);
  }

  function chargerDepuisServeur(donnees) {
    const c = stock.lire(CLE_CACHE);
    ops = []; autresModifs = false;
    if (c && c.code === session.code && c.nonEnvoye) {
      ops = c.ops || []; autresModifs = !!c.autresModifs;
      if (!donnees || c.base === donnees.majLe) {
        E = normaliser(c.etat); session.base = donnees?.majLe ?? null;
        demarrer(); envoyer();
        return;
      }
      // Le serveur a changé pendant que cet appareil était hors ligne : on rejoue ses actions dessus.
      const f = fusionnerAvecServeur(donnees);
      ops = []; autresModifs = true;
      demarrer(); signalerFusion(f); sauver();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    ops = []; autresModifs = false;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    if (!stock.lire(CLE_NOM_DEMO)) stock.ecrire(CLE_NOM_DEMO, 'Camille');
    cache();
    demarrer();
  }

  function deconnecter(message) {
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null; ops = [];
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration ----------
  // « Atelier Exemple » (fictif) : 5 services avec budget, 4 fournisseurs fictifs, prix fictifs. Cinq mois d'historique
  // simulés avec les vraies règles (demandes, validations, commandes groupées, réceptions), puis des demandes récentes
  // dans chaque état : à valider (dont une en attente depuis plusieurs jours et une bloquante), validée
  // automatiquement, à commander chez deux fournisseurs et sans fournisseur, commandée en retard, reçue en partie,
  // refusée, annulée ; un service au-delà de son budget.
  function donneesDemo() {
    let e = etatVide();
    const t = auj();
    e.organisation = 'Atelier Exemple (fictif)';
    e.adresse = 'Atelier Exemple, 1 rue de l\'Exemple, 00000 Ville fictive';
    e.reglages = R.reglagesDe({ seuil: 80, debutExercice: 1, relance: 3, taxe: 'HT' });
    const annee = R.exercice(t, 1);
    const serv = (nom, budget, responsable, i) => { const s = R.normaliserService({ id: uid(), nom, responsable, couleur: i, budgets: { [annee]: budget, [annee - 1]: Math.round(budget * 0.9) } }, i); e.services.push(s); return s; };
    const direction = serv('Direction', 900, 'Alex', 0);
    const admin = serv('Administration', 2400, 'Camille', 1);
    const atelier = serv('Atelier', 3200, 'Hugo', 2);
    const commercial = serv('Commercial', 700, 'Inès', 3);
    const accueil = serv('Accueil et services généraux', 3600, 'Camille', 4);
    const four = (nom, contact, delai, minimum) => { const f = R.normaliserFournisseur({ id: uid(), nom, contact, delai, minimum }); e.fournisseurs.push(f); return f; };
    const papeterie = four('Papeterie du Centre (fictif)', 'Commande par le site du fournisseur', 3, 60);
    const hygiene = four('Hygiène Pro Exemple', 'Commercial attitré, par e-mail', 5, null);
    const info = four('Info Express (fictif)', 'Commande en ligne', 2, null);
    const cafe = four('Café Service Exemple', 'Livraison le jeudi', 4, 40);
    const parCat = { bureau: papeterie, papier: papeterie, entretien: hygiene, cuisine: cafe, informatique: info, equipement: papeterie };
    // Prix habituels fictifs (saisis par l'utilisateur dans la vraie vie) pour les articles courants.
    const prix = { 'Stylos à bille bleus': 6.9, 'Stylos à bille noirs': 6.9, 'Surligneurs (assortiment)': 4.5, 'Blocs-notes A4': 8.4, 'Notes repositionnables': 5.2, 'Agrafes': 1.9, 'Chemises cartonnées': 7.5, 'Classeurs à levier': 3.2, 'Enveloppes C5': 9.8, 'Marqueurs pour tableau blanc': 6.4, 'Ramette de papier A4 80 g': 5.6, 'Ramette de papier A3 80 g': 12.9, 'Toner noir (selon modèle)': 64, 'Cartouches d\'encre couleur (selon modèle)': 48, 'Essuie-mains en papier': 32, 'Papier toilette': 28, 'Savon pour les mains (recharge)': 6.5, 'Sacs-poubelle 100 L': 9.9, 'Nettoyant multi-usage': 4.2, 'Tablettes pour lave-vaisselle': 14.5, 'Café en grains': 18, 'Thé (assortiment)': 6.8, 'Sucre en morceaux': 2.6, 'Lait demi-écrémé (briques)': 7.2, 'Gobelets en carton': 4.9, 'Eau en bouteille': 3.9, 'Souris sans fil': 19, 'Câble HDMI': 9.5, 'Adaptateur USB-C vers HDMI': 24, 'Piles AA': 7.9, 'Casque avec micro': 39, 'Clé USB': 11, 'Boîtes d\'archives': 16, 'Ampoules LED': 12 };
    e.articles = R.catalogueDeBase(B).map((a) => ({ ...a, prix: prix[a.nom] ?? null, fournisseur: parCat[a.categorie]?.id || null, reference: prix[a.nom] ? `REF-${String(a.nom.length * 37 + 100).slice(0, 4)}` : '' }));
    const art = (nom) => e.articles.find((a) => a.nom === nom);
    const noms = ['Alex', 'Camille', 'Sam', 'Nour', 'Léa', 'Hugo', 'Inès', 'Malo'];
    let graine = 11;
    const hasard = (n) => { graine = (graine * 9301 + 49297) % 233280; return Math.floor((graine / 233280) * n); };
    const faire = (action) => { const r = R.appliquer(e, action); if (r.ok) e = r.etat; return r; };
    const creer = (nomArt, quantite, service, jour, extra = {}) => {
      const a = art(nomArt);
      const d = R.normaliserDemande({ id: uid(), creeLe: jour, par: extra.par || noms[hasard(noms.length)], service: service.id, article: a.id, libelle: a.nom, categorie: a.categorie, unite: a.unite, quantite, prix: a.prix, fournisseur: null, urgence: 'normale', motif: B.motifs[hasard(3)], ...extra }, jour);
      const v = R.validationAuto(e, d);
      if (v.auto) Object.assign(d, { statut: 'validee', auto: true, valideLe: jour });
      faire({ type: 'creer', demandes: [d] });
      return dem2(d.id);
    };
    const dem2 = (id) => e.demandes.find((d) => d.id === id);
    const courants = Object.keys(prix);
    const serviceDe = (a) => (a.categorie === 'entretien' || a.categorie === 'cuisine' ? accueil : a.categorie === 'informatique' ? [admin, commercial, direction][hasard(3)] : [admin, atelier, commercial, accueil, direction][hasard(5)]);
    // Historique simulé : demandes de J-150 à J-14, réceptions jusqu'à la veille.
    for (let k = -150; k <= -1; k++) {
      const jour = ajout(t, k);
      const w = versDate(jour).getDay();
      if (w === 0 || w === 6) continue;
      if (k <= -14 && hasard(3) === 0) { const a = art(courants[hasard(courants.length)]); creer(a.nom, 1 + hasard(a.prix > 30 ? 2 : 6), serviceDe(a), jour); }
      // Validation le lendemain ou le surlendemain ; un refus de temps en temps.
      for (const d of e.demandes.filter((x) => k <= -13 && x.statut === 'demandee' && R.ecart(x.creeLe, jour) >= 1 + (x.id.length % 2))) {
        if (hasard(9) === 0) faire({ type: 'refuser', id: d.id, par: 'Camille', le: jour, motif: B.motifsRefus[hasard(B.motifsRefus.length)] });
        else faire({ type: 'valider', id: d.id, par: d.par === 'Camille' ? 'Alex' : 'Camille', le: jour });
      }
      // Commandes groupées le mardi ; réceptions au délai du fournisseur, parfois en deux fois.
      if (w === 2 && k <= -13) for (const g of R.aCommander(e)) if (g.fournisseur) faire({ type: 'commander', commande: { id: uid(), numero: '', fournisseur: g.fournisseur, date: jour, par: 'Camille', reference: '', note: '', demandes: g.demandes } });
      for (const c of e.commandes) {
        const f = e.fournisseurs.find((x) => x.id === c.fournisseur);
        if (R.ecart(c.date, jour) < (f.delai || 3)) continue;
        for (const id of c.demandes) {
          const d = dem2(id);
          if (!['commandee', 'partielle'].includes(R.etatDemande(d))) continue;
          const q = d.quantite > 2 && k <= -6 && hasard(6) === 0 ? Math.ceil(d.quantite / 2) : d.quantite;
          faire({ type: 'recevoir', id, reception: { id: uid(), date: jour, qte: q, par: 'Nour' }, prixReel: hasard(5) === 0 && d.prix ? R.arrondi(d.prix * 1.08) : undefined });
          if (q < d.quantite) faire({ type: 'recevoir', id, reception: { id: uid(), date: ajout(jour, 4), qte: d.quantite - q, par: 'Nour' } });
        }
      }
    }
    // Commercial au-delà de son budget : un casque et des adaptateurs pour les salons.
    for (const [n, q, j] of [['Casque avec micro', 3, -40], ['Adaptateur USB-C vers HDMI', 8, -38], ['Souris sans fil', 4, -36]]) {
      const d = creer(n, q, commercial, ajout(t, j), { par: 'Inès', motif: 'Projet client' });
      if (d.statut === 'demandee') faire({ type: 'valider', id: d.id, par: 'Alex', le: ajout(t, j + 1) });
      faire({ type: 'commander', commande: { id: uid(), fournisseur: info.id, date: ajout(t, j + 2), par: 'Camille', demandes: [d.id] } });
      faire({ type: 'recevoir', id: d.id, reception: { id: uid(), date: ajout(t, j + 5), qte: d.quantite, par: 'Inès' } });
    }
    // Bon de commande en retard (livraison attendue depuis plusieurs jours) et réception partielle.
    const r1 = creer('Toner noir (selon modèle)', 2, admin, ajout(t, -12), { par: 'Sam', motif: 'Stock épuisé', urgence: 'urgente' });
    if (r1.statut === 'demandee') faire({ type: 'valider', id: r1.id, par: 'Camille', le: ajout(t, -11) });
    const r2 = creer('Ramette de papier A4 80 g', 15, admin, ajout(t, -12), { par: 'Sam', motif: 'Réassort habituel' });
    if (r2.statut === 'demandee') faire({ type: 'valider', id: r2.id, par: 'Camille', le: ajout(t, -11) });
    faire({ type: 'commander', commande: { id: uid(), fournisseur: papeterie.id, date: ajout(t, -10), par: 'Camille', reference: 'Commande n° 4521 (fictif)', demandes: [r1.id, r2.id] } });
    faire({ type: 'recevoir', id: r2.id, reception: { id: uid(), date: ajout(t, -6), qte: 10, par: 'Nour' } });
    const r3 = creer('Essuie-mains en papier', 4, accueil, ajout(t, -9), { par: 'Malo', motif: 'Réassort habituel' });
    if (r3.statut === 'demandee') faire({ type: 'valider', id: r3.id, par: 'Camille', le: ajout(t, -8) });
    faire({ type: 'commander', commande: { id: uid(), fournisseur: hygiene.id, date: ajout(t, -3), par: 'Camille', demandes: [r3.id] } });
    // À commander : validées chez deux fournisseurs, et un article hors catalogue sans fournisseur.
    creer('Café en grains', 3, accueil, ajout(t, -4), { par: 'Malo' });
    creer('Sucre en morceaux', 4, accueil, ajout(t, -4), { par: 'Malo' });
    const v1 = creer('Stylos à bille bleus', 2, atelier, ajout(t, -3), { par: 'Hugo' });
    const v2 = creer('Notes repositionnables', 3, commercial, ajout(t, -2), { par: 'Léa', urgence: 'urgente', motif: 'Réunion ou événement' });
    if (v2.statut === 'demandee') faire({ type: 'valider', id: v2.id, par: 'Alex', le: ajout(t, -1) });
    const hors = R.normaliserDemande({ id: uid(), creeLe: ajout(t, -2), par: 'Hugo', service: atelier.id, libelle: 'Tapis anti-fatigue pour poste debout', categorie: 'equipement', unite: 'pièce', quantite: 1, prix: 45, urgence: 'normale', motif: 'Remplacement d\'un matériel défectueux' }, t);
    faire({ type: 'creer', demandes: [hors] });
    faire({ type: 'valider', id: hors.id, par: 'Alex', le: ajout(t, -1) });
    void v1;
    // À valider : au-dessus du seuil, en attente depuis 5 jours ; une bloquante d'aujourd'hui ; une sans prix.
    creer('Casque avec micro', 3, direction, ajout(t, -5), { par: 'Alex', motif: 'Nouvel arrivant' });
    creer('Câble HDMI', 12, atelier, t, { par: 'Hugo', urgence: 'bloquante', motif: 'Remplacement d\'un matériel défectueux' });
    const sansPrix = creer('Lampe de bureau', 2, admin, ajout(t, -1), { par: 'Sam', motif: 'Nouvel arrivant' });
    void sansPrix;
    // Refusée et annulée récentes.
    const rf = creer('Disque dur externe', 1, commercial, ajout(t, -6), { par: 'Léa', prix: 89, motif: 'Projet client' });
    faire({ type: 'refuser', id: rf.id, par: 'Alex', le: ajout(t, -5), motif: 'Budget du service épuisé' });
    const an = creer('Biscuits pour les réunions', 4, direction, ajout(t, -7), { par: 'Alex', prix: 3.5 });
    if (an.statut === 'validee') faire({ type: 'annuler', id: an.id, le: ajout(t, -6) });
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Demandes d\'achat · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="150" width="120" height="130" fill="#1D4E89"/>
          <rect x="150" y="90" width="120" height="190" fill="#F5B400"/>
          <rect x="280" y="190" width="120" height="90" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="470" cy="110" r="70" fill="#D9302A"/>
          <path d="M470 110 L470 40 A70 70 0 0 1 540 110 Z" fill="#F0EDE6"/>
          <rect x="420" y="220" width="120" height="22" fill="#141414"/>
          <rect x="420" y="256" width="80" height="22" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Demandes d'achat et fournitures</p>
          <h1>Qui a demandé quoi, et où en est le budget.</h1>
          <p>Demandes, validation, commandes groupées par fournisseur, réception et budget annuel par service. Une clé pour toute l'équipe.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès</p>
          <h2>Ouvre les demandes d'achat</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après l'achat, ou celle que ton équipe t'a transmise. Les demandes sont enregistrées en ligne et partagées par tous ceux qui ont la clé.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir les demandes</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/achats/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans l'e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir les demandes'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const accueilVide = () => ({ etape: 1, organisation: '', services: B.services.slice(0, 3).map((nom) => ({ nom, budget: '' })), seuil: String(B.reglages.seuil), debutExercice: B.reglages.debutExercice, categories: B.categories.filter((c) => c.id !== 'autre').map((c) => c.id), nom: '' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Les services qui demandent</h1>
        <p class="intro">Chaque demande d'achat est rattachée à un service, qui a son budget annuel (facultatif). Tu pourras tout modifier ensuite, dans l'onglet Budget.</p>
        <label class="champ" style="max-width:420px;margin-top:20px">Nom de l'organisation <small>Facultatif, imprimé sur les bons de commande.</small><input id="organisation" value="${esc(a.organisation)}" maxlength="80"></label>
        <h2 class="titre-section">Services <span>Jusqu'à ${R.MAX.services}. Budget de l'exercice en euros, facultatif.</span></h2>
        <ol class="services-accueil">${a.services.map((x, i) => `<li><span class="palier-num">${i + 1}</span>
          <label class="champ">Nom<input data-sv="${i}" data-k="nom" value="${esc(x.nom)}" maxlength="60" placeholder="Ex. : Administration"></label>
          <label class="champ">Budget annuel<input data-sv="${i}" data-k="budget" value="${esc(x.budget)}" inputmode="decimal" placeholder="Facultatif"></label></li>`).join('')}</ol>
        <div class="rang" style="margin-top:10px">${a.services.length < R.MAX.services ? '<button class="btn petit" data-action="accueil-service">+ Service</button>' : ''}</div>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Validation et catalogue</h1>
        <p class="intro">Sous le seuil, une demande dont le prix est estimé et qui tient dans le budget du service est validée tout de suite. Laisse vide pour que chaque demande soit validée par une personne.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Seuil de validation (€) <small>Vide : toujours valider.</small><input id="seuil" value="${esc(a.seuil)}" inputmode="decimal"></label>
          <label class="champ">Début de l'exercice<select id="debutExercice">${R.MOIS.map((m, i) => `<option value="${i + 1}" ${i + 1 === Number(a.debutExercice) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        </div>
        <fieldset class="champ cadre-champs" style="margin-top:16px;max-width:720px"><legend>Catalogue de départ <small>${B.articles.length} fournitures types, sans prix ni marque. Tu ajoutes tes prix habituels et tes fournisseurs ensuite.</small></legend><div class="cases">${B.categories.filter((c) => c.id !== 'autre').map((c) => `<label class="case"><input type="checkbox" data-cat="${c.id}" ${a.categories.includes(c.id) ? 'checked' : ''}> ${esc(c.nom)} <small>(${B.articles.filter(([x]) => x === c.id).length})</small></label>`).join('')}</div></fieldset>
        <label class="champ" style="max-width:420px;margin-top:20px">Ton nom <small>Pré-rempli quand tu demandes ou valides depuis cet appareil. Un prénom suffit.</small><input id="nom" value="${esc(a.nom)}" maxlength="60" autocomplete="given-name"></label>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Commencer</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#organisation')?.addEventListener('input', (e) => { accueil.organisation = e.target.value; });
    ['seuil', 'debutExercice', 'nom'].forEach((k) => $(`#${k}`)?.addEventListener('input', (e) => { accueil[k] = e.target.value; }));
    document.querySelectorAll('[data-cat]').forEach((el) => el.addEventListener('change', () => { const c = el.dataset.cat; accueil.categories = el.checked ? [...accueil.categories, c] : accueil.categories.filter((x) => x !== c); }));
    document.querySelectorAll('[data-sv]').forEach((el) => el.addEventListener('input', () => { accueil.services[Number(el.dataset.sv)][el.dataset.k] = el.value; }));
  }

  function erreurAccueil(m) { const p = $('#erreur-accueil'); if (p) p.textContent = m; }
  function accueilSuivant() {
    if (!accueil.services.some((x) => x.nom.trim())) return erreurAccueil('Donne un nom à au moins un service.');
    if (accueil.services.some((x) => x.budget.trim() && !(R.lireNombre(x.budget) >= 0))) return erreurAccueil('Budget : un montant en euros, ou laisse vide.');
    accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 });
  }
  function terminerAccueil() {
    const a = accueil;
    const seuil = R.lireNombre(a.seuil);
    if (Number.isNaN(seuil) || seuil < 0) return erreurAccueil('Seuil : un montant en euros, ou laisse vide.');
    E = etatVide();
    E.organisation = a.organisation.trim();
    E.reglages = R.reglagesDe({ ...E.reglages, seuil, debutExercice: Number(a.debutExercice) }, E.reglages);
    const annee = R.exercice(auj(), E.reglages.debutExercice);
    E.services = a.services.filter((x) => x.nom.trim()).map((x, i) => R.normaliserService({ id: uid(), nom: x.nom.trim(), couleur: i % 8, budgets: x.budget.trim() ? { [annee]: R.lireNombre(x.budget) } : {} }, i));
    E.articles = R.catalogueDeBase(B, a.categories).map((x) => ({ ...x, id: uid() }));
    if (a.nom.trim()) ecrireNom(a.nom);
    accueil = accueilVide();
    vue = 'demandes';
    autresModifs = true;
    sauver();
    demarrer();
    toast('C\'est prêt. Partage la clé avec les personnes qui demandent et celles qui valident.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    demandes: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    commandes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    budget: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="9" width="4" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    catalogue: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="8" height="4" fill="currentColor"/><rect x="13" y="10" width="8" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 20H3Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['demandes', 'Demandes'], ['commandes', 'Commandes'], ['budget', 'Budget'], ['catalogue', 'Catalogue'], ['stats', 'Historique']];
  const MENTION = '<p class="mention avertissement">Une clé partagée, pas de comptes : toute personne qui a la clé peut demander, valider, commander et réceptionner. Chaque étape garde le nom saisi et sa date. Les montants sont des estimations saisies par l\'équipe : ce n\'est ni une comptabilité ni un logiciel de facturation.</p>';
  const ETIQ = { demandee: 'jaune', validee: 'ciel', commandee: 'sable', partielle: 'beurre-fort', recue: 'vert', refusee: 'rose', annulee: 'sable' };
  const etiquetteEtat = (e) => `<span class="etiquette ${ETIQ[e]}">${R.LIB_ETAT[e]}</span>`;
  const etiquetteUrgence = (u) => (u === 'bloquante' ? '<span class="etiquette rouge">Bloquante</span>' : u === 'urgente' ? '<span class="etiquette rose">Urgente</span>' : '');

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    exerciceVu = exerciceCourant();
    if (!R.aValider(E, auj()).length && filtre.liste === 'aValider') filtre.liste = 'enCours';
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/achats/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Demandes<br>d'achat</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="reglages" aria-label="Réglages et sauvegarde" title="Réglages">${ICONES.reglages}</button>
      </div></header>
      <main class="vue" id="vue" tabindex="-1"></main>`;
    majSync(session.demo ? 'demo' : (ops.length || autresModifs ? 'attente' : 'ok'));
    rendre();
    proposerEcranAccueil();
  }

  function rendre() {
    if (!E || !$('#vue')) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · Demandes d'achat`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { demandes: vueDemandes, commandes: vueCommandes, budget: vueBudget, catalogue: vueCatalogue, stats: vueStats }[vue]();
    brancherInfobulles();
    const q = $('#recherche');
    if (q) q.addEventListener('input', (e) => { const pos = e.target.selectionStart; if (vue === 'catalogue') rechercheCatalogue = e.target.value; else filtre.q = e.target.value; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); });
    const sv = $('#filtre-service');
    if (sv) sv.addEventListener('change', (e) => { filtre.service = e.target.value; rendre(); });
    document.querySelectorAll('[data-choix-fournisseur]').forEach((s) => s.addEventListener('change', () => {
      if (!s.value) return;
      const ids = s.dataset.choixFournisseur.split(',');
      retenir();
      for (const id of ids) { const r = R.appliquer(E, { type: 'modifier', id, champs: { fournisseur: s.value } }); if (r.ok) { E = r.etat; if (!session.demo) ops.push({ type: 'modifier', id, champs: { fournisseur: s.value } }); } }
      sauver(); rendre(); toast(`${pluriel(ids.length, 'ligne rattachée', 'lignes rattachées')} à ${nomFournisseur(s.value)}.`, { libelle: 'Annuler', faire: annuler });
    }));
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="26" height="56" fill="#1D4E89"/><rect x="34" y="20" width="26" height="76" fill="#F5B400"/><circle cx="80" cy="74" r="16" fill="#D9302A"/></svg>';
  const boutonNouvelle = (lib = 'Nouvelle demande') => `<button class="btn primaire" data-action="nouvelle">${ICONES.plus}${lib}</button>`;
  const tuile = ([lib, v, d, c, f]) => `<div class="tuile ${f || ''}" style="--c:${c}"><p class="surtitre">${lib}</p><b class="${String(v).length > 11 ? 'long' : ''}">${v}</b><span>${d}</span></div>`;

  // ---------- Demandes ----------
  const FILTRES = [['aValider', 'À valider'], ['aCommander', 'À commander'], ['livraison', 'En livraison'], ['miennes', 'Les miennes'], ['enCours', 'En cours'], ['recues', 'Reçues'], ['closes', 'Refusées, annulées'], ['toutes', 'Toutes']];
  function garder(d, f, nom) {
    const e = R.etatDemande(d);
    switch (f) {
      case 'aValider': return e === 'demandee';
      case 'aCommander': return e === 'validee';
      case 'livraison': return e === 'commandee' || e === 'partielle';
      case 'miennes': return R.memeNom(d.par, nom);
      case 'enCours': return ['demandee', 'validee', 'commandee', 'partielle'].includes(e);
      case 'recues': return e === 'recue';
      case 'closes': return e === 'refusee' || e === 'annulee';
      default: return true;
    }
  }
  function ligneDemande(d, { actions = true } = {}) {
    const e = R.etatDemande(d);
    const m = R.montants(d);
    const mt = R.montantEstime(d);
    const attente = R.enAttenteDepuis(d, auj());
    const relance = e === 'demandee' && attente >= E.reglages.relance;
    const classe = e === 'demandee' ? (d.urgence !== 'normale' || relance ? 'alerte-depasse' : 'alerte-due') : ['refusee', 'annulee'].includes(e) ? 'st-abandonnee' : e === 'recue' ? 'st-payee' : '';
    const recuTxt = ['partielle'].includes(e) ? ` · reçu ${qte(R.recu(d))} sur ${qte(d.quantite)}` : '';
    const detail = [d.numero, nomService(d.service), d.par || 'sans nom', dateCourte(d.creeLe), e === 'demandee' ? (attente ? `en attente depuis ${pluriel(attente, 'jour')}` : 'aujourd\'hui') : '', e === 'refusee' && d.motifRefus ? `refusée : ${d.motifRefus}` : ''].filter(Boolean).join(' · ');
    const bouton = !actions ? '' : e === 'demandee' ? `<button class="btn petit" data-action="valider-vite" data-id="${d.id}">Valider</button>` : e === 'commandee' || e === 'partielle' ? `<button class="btn petit" data-action="recevoir" data-id="${d.id}">Réceptionner</button>` : '';
    return `<li class="ligne-fac ${classe}" style="--rc:${couleurCat(d.categorie)}">
      <button class="ligne-info" data-action="ouvrir" data-id="${d.id}"><b><i class="pastille-cat" aria-hidden="true"></i>${esc(d.libelle)} <span class="qte">× ${qte(d.quantite)} ${esc(d.unite)}</span></b><span class="ligne-detail">${esc(detail)}${recuTxt}</span><span class="ligne-etiquettes">${etiquetteEtat(e)}${etiquetteUrgence(e === 'recue' || e === 'refusee' || e === 'annulee' ? 'normale' : d.urgence)}${d.auto ? '<span class="etiquette vert">Sous le seuil</span>' : ''}${relance ? '<span class="etiquette rouge">À relancer</span>' : ''}${m.sansPrix ? '<span class="etiquette sable">Prix à estimer</span>' : ''}</span></button>
      <div class="ligne-droite"><span class="ligne-cout"><b>${mt === null ? '–' : euros(mt)}</b><small>${mt === null ? 'prix non estimé' : `${qte(d.quantite)} × ${euros(d.prix)}`}</small></span>${bouton}</div></li>`;
  }

  function vueDemandes() {
    const t = auj(), nom = monNom();
    const titre = `<div class="vue-tete"><div><h1>Demandes</h1><p>${E.organisation ? `${esc(E.organisation)} · ` : ''}Qui a demandé quoi, pour quel service, et où en est chaque demande.</p></div>
      <div class="actions">${boutonNouvelle()}</div></div>`;
    if (!servicesActifs().length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun service</h3><p>Ajoute d'abord un service (Administration, Atelier…) : chaque demande s'y rattache, avec son budget.</p><div class="actions"><button class="btn primaire" data-action="nouveau-service">${ICONES.plus}Ajouter un service</button></div></div></div>`;
    const av = R.aValider(E, t);
    const ac = R.aCommander(E);
    const enLiv = E.commandes.map((c) => R.etatCommande(E, c, t)).filter((c) => c.statut !== 'recue');
    const ann = exerciceCourant();
    const bs = R.budgets(E, ann);
    const tot = bs.reduce((s, b) => ({ budget: s.budget + (b.budget || 0), conso: s.conso + b.consomme + b.engage }), { budget: 0, conso: 0 });
    const tuiles = [
      ['À valider', String(av.length), av.length ? `${av.filter((x) => x.relance).length ? `${pluriel(av.filter((x) => x.relance).length, 'à relancer', 'à relancer')} · ` : ''}${eur(av.reduce((s, x) => s + (R.montantEstime(x.d) || 0), 0))}` : 'rien en attente', 'var(--jaune)', 'rond'],
      ['À commander', String(ac.reduce((s, g) => s + g.demandes.length, 0)), ac.length ? `chez ${pluriel(ac.filter((g) => g.fournisseur).length, 'fournisseur')}${ac.some((g) => !g.fournisseur) ? ' + à choisir' : ''}` : 'rien à commander', 'var(--bleu)', ''],
      ['En livraison', String(enLiv.length), enLiv.length ? (enLiv.some((c) => c.retard) ? `${pluriel(enLiv.filter((c) => c.retard).length, 'bon en retard', 'bons en retard')}` : 'aucun retard') : 'aucun bon en cours', 'var(--rouge)', 'rond'],
      [`Budget ${libExercice(ann)}`, tot.budget ? R.pct((tot.conso / tot.budget) * 100) : '–', tot.budget ? `${euros(tot.conso, { centimes: false })} consommés ou engagés sur ${euros(tot.budget, { centimes: false })}` : 'aucun budget fixé', 'var(--encre)', ''],
    ].map(tuile).join('');
    const depasses = bs.filter((b) => b.niveau === 'depasse');
    const alertes = depasses.length ? `<div class="alerte-conflit" role="alert"><b>${depasses.length > 1 ? 'Budgets dépassés' : 'Budget dépassé'}</b><ul>${depasses.map((b) => `<li>${esc(nomService(b.service))} : ${eur(b.consomme + b.engage)} consommés ou engagés pour ${eur(b.budget)} (${euros(-b.disponible)} au-delà). <button class="btn lien" data-action="vue" data-vue="budget">Voir le budget</button></li>`).join('')}</ul></div>` : '';
    const services = servicesActifs();
    const q = filtre.q.trim().toLocaleLowerCase('fr');
    const l = E.demandes.filter((d) => garder(d, filtre.liste, nom) && (!filtre.service || d.service === filtre.service) && (!q || `${d.numero} ${d.libelle} ${d.par} ${d.motif} ${nomService(d.service)}`.toLocaleLowerCase('fr').includes(q)))
      .sort((a, b) => (filtre.liste === 'aValider' ? R.URGENCES.indexOf(b.urgence) - R.URGENCES.indexOf(a.urgence) || a.creeLe.localeCompare(b.creeLe) : b.creeLe.localeCompare(a.creeLe) || b.numero.localeCompare(a.numero)));
    const nb = (id) => E.demandes.filter((d) => garder(d, id, nom) && (!filtre.service || d.service === filtre.service)).length;
    const total = l.reduce((s, d) => s + (R.montantEstime(d) || 0), 0);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${alertes}
      <div class="outils-liste" style="margin-top:24px">
        <div class="filtres" role="group" aria-label="Filtrer les demandes">${FILTRES.map(([id, lib]) => `<button class="filtre" data-action="filtre" data-f="${id}" aria-pressed="${filtre.liste === id}">${lib} <small>${nb(id)}</small></button>`).join('')}</div>
      </div>
      <div class="outils-liste">
        <label class="champ choix-service"><span class="sr-only">Service</span><select id="filtre-service"><option value="">Tous les services</option>${E.services.map((s) => `<option value="${s.id}" ${filtre.service === s.id ? 'selected' : ''}>${esc(s.nom)}</option>`).join('')}</select></label>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche" type="search" placeholder="Article, nom, numéro, motif" value="${esc(filtre.q)}"></label>
      </div>
      ${filtre.liste === 'miennes' && !nom ? '<p class="aide">Indique ton nom pour retrouver tes demandes. <button class="btn lien" data-action="mon-nom">Indiquer mon nom</button></p>' : ''}
      ${filtre.liste === 'aValider' && l.length ? `<p class="aide">Seuil de validation automatique : ${E.reglages.seuil === null ? 'aucun, chaque demande est validée par une personne' : eur(E.reglages.seuil)}. Valider ou refuser : ouvre la demande pour voir l'effet sur le budget du service.</p>` : ''}
      ${l.length ? `<p class="resume-liste">${pluriel(l.length, 'demande')} · ${eur(total)} estimés${l.length > 200 ? ' · 200 premières affichées' : ''}</p><ul class="lignes-fac">${l.slice(0, 200).map((d) => ligneDemande(d)).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.demandes.length ? 'Aucune demande ici' : 'Aucune demande pour l\'instant'}</h3><p>${E.demandes.length ? (filtre.liste === 'aValider' ? 'Rien n\'attend de validation : tout est à jour.' : 'Change le filtre, le service ou la recherche.') : 'Une demande : qui, quoi, combien, pour quel service, et pourquoi. Le catalogue propose les fournitures courantes.'}</p><div class="actions">${boutonNouvelle('Faire une demande')}</div></div></div>`}
      ${services.length && E.demandes.length ? '<div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv">Exporter en CSV</button></div>' : ''}
      ${MENTION}`;
  }

  // ---------- Commandes ----------
  function tableLignes(lignes, { services = true } = {}) {
    return `<div class="defile"><table class="tableau petit lignes-bon"><thead><tr><th>Désignation</th><th class="nb">Qté</th><th>Unité</th>${services ? '<th>Pour</th>' : ''}<th class="nb">Prix unit.</th><th class="nb">Montant</th></tr></thead><tbody>${lignes.map((l) => `<tr><td>${esc(l.libelle)}${l.reference ? ` <small>· réf. ${esc(l.reference)}</small>` : ''}${l.urgence !== 'normale' ? ` ${etiquetteUrgence(l.urgence)}` : ''}</td><td class="nb">${qte(l.quantite)}<span class="u-tel"> ${esc(l.unite)}</span></td><td>${esc(l.unite)}</td>${services ? `<td>${l.services.map((s) => esc(nomService(s))).join(', ')}</td>` : ''}<td class="nb">${l.prix === null ? '–' : euros(l.prix)}</td><td class="nb">${l.sansPrix ? 'à chiffrer' : euros(l.montant)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function carteACommander(g) {
    const f = g.fournisseur ? trouver('fournisseurs', g.fournisseur) : null;
    const tete = `<div class="bc-tete"><div><h3>${esc(nomFournisseur(g.fournisseur))}</h3><p class="ligne-detail">${pluriel(g.demandes.length, 'demande')} · ${pluriel(g.lignes.length, 'ligne')} · validée${g.demandes.length > 1 ? 's' : ''} depuis le ${dateCourte(g.plusAncienne)}${f?.delai !== null && f?.delai !== undefined ? ` · livraison en ${pluriel(f.delai, 'jour')} environ` : ''}</p></div><b class="bc-total">${g.total ? eur(g.total) : '–'}</b></div>`;
    const avert = [g.urgentes ? `<span class="etiquette rose">${pluriel(g.urgentes, 'urgente')}</span>` : '', g.sansPrix ? `<span class="etiquette sable">${pluriel(g.sansPrix, 'ligne', 'lignes')} à chiffrer</span>` : '', g.sousMinimum ? `<span class="etiquette jaune">${euros(g.sousMinimum)} sous le minimum de commande</span>` : ''].join('');
    if (!g.fournisseur) {
      const opts = fournisseursActifs().map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('');
      return `<article class="carte-bc sans-fournisseur">${tete}<p class="aide">Ces demandes n'ont pas de fournisseur : choisis-en un pour chacune (ou ajoute-le dans le Catalogue), elles rejoindront son bon.</p>
        <ul class="mini-liste">${g.lignes.map((l) => `<li><span><b>${esc(l.libelle)}</b> × ${qte(l.quantite)} ${esc(l.unite)} <small>· ${l.services.map((s) => esc(nomService(s))).join(', ')}</small></span><label class="champ"><span class="sr-only">Fournisseur pour ${esc(l.libelle)}</span><select data-choix-fournisseur="${l.demandes.join(',')}"><option value="">Choisir…</option>${opts}</select></label></li>`).join('')}</ul>
        <div class="rang"><button class="btn petit" data-action="nouveau-fournisseur">${ICONES.plus}Nouveau fournisseur</button></div></article>`;
    }
    return `<article class="carte-bc">${tete}${avert ? `<p class="ligne-etiquettes">${avert}</p>` : ''}${tableLignes(g.lignes)}
      <div class="rang bc-actions"><button class="btn primaire petit" data-action="passer-commande" data-f="${g.fournisseur}">Passer la commande</button><button class="btn petit" data-action="apercu-bon" data-f="${g.fournisseur}">Aperçu du bon</button></div></article>`;
  }
  function ligneBon(c, t) {
    const s = R.etatCommande(E, c, t);
    const st = s.statut === 'recue' ? '<span class="etiquette vert">Reçue</span>' : s.statut === 'partielle' ? '<span class="etiquette beurre-fort">Reçue en partie</span>' : '<span class="etiquette sable">Commandée</span>';
    const detail = [`${dateCourte(c.date)}`, c.par, pluriel(s.demandes.length, 'ligne'), c.reference, s.statut !== 'recue' && s.attendue ? `attendue le ${dateCourte(s.attendue)}` : '', s.statut === 'recue' && s.derniere ? `reçue le ${dateCourte(s.derniere)}` : ''].filter(Boolean).join(' · ');
    return `<li class="ligne-fac ${s.retard ? 'alerte-depasse' : s.statut === 'recue' ? 'st-payee' : ''}"><button class="ligne-info" data-action="ouvrir-bon" data-id="${c.id}"><b>${esc(c.numero)} · ${esc(nomFournisseur(c.fournisseur))}</b><span class="ligne-detail">${esc(detail)}</span><span class="ligne-etiquettes">${st}${s.retard ? `<span class="etiquette rouge">En retard de ${pluriel(s.retard, 'jour')}</span>` : ''}</span></button>
      <div class="ligne-droite"><span class="ligne-cout"><b>${s.total ? euros(s.total) : '–'}</b><small>${taxe()} estimé</small></span>${s.statut !== 'recue' ? `<button class="btn petit" data-action="recevoir-bon" data-id="${c.id}">Réceptionner</button>` : ''}</div></li>`;
  }
  function vueCommandes() {
    const t = auj();
    const ac = R.aCommander(E);
    const enCours = E.commandes.filter((c) => R.etatCommande(E, c, t).statut !== 'recue').sort((a, b) => a.date.localeCompare(b.date));
    const recus = E.commandes.filter((c) => R.etatCommande(E, c, t).statut === 'recue').sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="vue-tete"><div><h1>Commandes</h1><p>Les demandes validées regroupées par fournisseur, un bon de commande à imprimer ou à recopier, puis la réception, même en plusieurs fois.</p></div>
        <div class="actions">${boutonNouvelle()}</div></div>
      <h2 class="titre-section">À commander <span>${ac.length ? `${pluriel(ac.reduce((s, g) => s + g.demandes.length, 0), 'demande validée', 'demandes validées')}` : 'rien pour l\'instant'}</span></h2>
      ${ac.length ? `<div class="grille-bc">${ac.map(carteACommander).join('')}</div>` : `<div class="vide-etat petit"><div><h3>Rien à commander</h3><p>Les demandes validées apparaissent ici, regroupées par fournisseur. ${E.demandes.some((d) => d.statut === 'demandee') ? '<button class="btn lien" data-action="voir-a-valider">Des demandes attendent une validation.</button>' : ''}</p></div></div>`}
      <h2 class="titre-section">En cours de livraison <span>${pluriel(enCours.length, 'bon')}</span></h2>
      ${enCours.length ? `<ul class="lignes-fac">${enCours.map((c) => ligneBon(c, t)).join('')}</ul>` : '<p class="aide">Aucun bon en attente de livraison.</p>'}
      <h2 class="titre-section">Reçues <span>${pluriel(recus.length, 'bon')}</span></h2>
      ${recus.length ? `<ul class="lignes-fac">${recus.slice(0, 15).map((c) => ligneBon(c, t)).join('')}</ul>${recus.length > 15 ? `<p class="aide">Et ${pluriel(recus.length - 15, 'bon plus ancien', 'bons plus anciens')} (export CSV dans l'onglet Demandes).</p>` : ''}` : '<p class="aide">Aucun bon reçu pour l\'instant.</p>'}
      <div class="rgpd"><h2>Le bon de commande</h2><p>C'est un document interne, à imprimer ou à recopier sur le site ou le bon du fournisseur : rien n'est envoyé d'ici. Ses prix sont ceux estimés par l'équipe ; le prix réel se saisit à la réception et met le budget à jour.</p></div>`;
  }

  // ---------- Budget ----------
  function vueBudget() {
    const ann = exerciceVu;
    const bs = R.budgets(E, ann);
    const nav = `<div class="nav-mois"><button class="btn petit" data-action="exercice" data-n="-1" aria-label="Exercice précédent">‹</button><h2>Exercice ${libExercice(ann)}</h2><button class="btn petit" data-action="exercice" data-n="1" aria-label="Exercice suivant">›</button>${ann !== exerciceCourant() ? '<button class="btn petit" data-action="exercice" data-n="0">En cours</button>' : ''}</div>`;
    const titre = `<div class="vue-tete"><div><h1>Budget</h1><p>Budget annuel de chaque service face au consommé (reçu) et à l'engagé (validé ou commandé, pas encore reçu).</p></div>
      <div class="actions"><button class="btn" data-action="nouveau-service">${ICONES.plus}Service</button></div></div>`;
    if (!E.services.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun service</h3><p>Ajoute les services qui passent des demandes, avec leur budget annuel.</p><div class="actions"><button class="btn primaire" data-action="nouveau-service">${ICONES.plus}Ajouter un service</button></div></div></div>`;
    const tot = bs.reduce((s, b) => ({ budget: s.budget + (b.budget || 0), consomme: s.consomme + b.consomme, engage: s.engage + b.engage, attente: s.attente + b.attente }), { budget: 0, consomme: 0, engage: 0, attente: 0 });
    const avecBudget = bs.filter((b) => b.budget !== null);
    const dispo = avecBudget.reduce((s, b) => s + b.disponible, 0);
    const tuiles = [
      ['Budget', tot.budget ? euros(tot.budget, { centimes: false }) : '–', `${pluriel(avecBudget.length, 'service')} sur ${bs.length}`, 'var(--encre)', ''],
      ['Consommé', euros(tot.consomme, { centimes: false }), tot.budget ? `${R.pct((tot.consomme / tot.budget) * 100)} du budget` : 'reçu', 'var(--bleu)', 'rond'],
      ['Engagé', euros(tot.engage, { centimes: false }), 'validé ou commandé, à recevoir', 'var(--jaune)', ''],
      ['Disponible', avecBudget.length ? euros(dispo, { centimes: false }) : '–', tot.attente ? `${euros(tot.attente, { centimes: false })} en attente de validation` : 'aucune demande en attente', dispo < 0 ? 'var(--rouge)' : 'var(--vert)', 'rond'],
    ].map(tuile).join('');
    const echelle = Math.max(1, ...bs.map((b) => Math.max(b.budget || 0, b.consomme + b.engage + b.attente)));
    const lignes = bs.map((b) => {
      const s = trouver('services', b.service);
      const w = (v) => `${(v / echelle) * 100}%`;
      const info = `<b>${esc(nomService(b.service))}</b>Budget : ${b.budget === null ? 'non fixé' : eur(b.budget)}<br>Consommé : ${eur(b.consomme)}<br>Engagé : ${eur(b.engage)}<br>En attente : ${eur(b.attente)}${b.disponible !== null ? `<br>Disponible : ${eur(b.disponible)}` : ''}`;
      const etiq = b.niveau === 'depasse' ? '<span class="etiquette rouge">Dépassé</span>' : b.niveau === 'proche' ? '<span class="etiquette jaune">Plus de 90 %</span>' : b.niveau === 'sans' ? '<span class="etiquette sable">Budget à fixer</span>' : '';
      return `<div class="ligne-budget" tabindex="0" data-info="${esc(info)}">
        <div class="lb-nom"><button class="lien-ligne" data-action="service" data-id="${b.service}"><b><i class="pastille-res" style="--rc:${couleurService(s)}" aria-hidden="true"></i>${esc(nomService(b.service))}</b><span>${s?.responsable ? `${esc(s.responsable)} · ` : ''}${pluriel(b.nb, 'demande')}${b.sansPrix ? ` · ${b.sansPrix} sans prix` : ''}</span></button>${etiq}</div>
        <div class="lb-piste" aria-hidden="true"><span class="lb-conso" style="width:${w(b.consomme)}"></span><span class="lb-engage" style="left:${w(b.consomme)};width:${w(b.engage)}"></span><span class="lb-attente" style="left:${w(b.consomme + b.engage)};width:${w(b.attente)}"></span>${b.budget !== null ? `<span class="lb-budget" style="left:${w(b.budget)}"></span>` : ''}</div>
        <div class="lb-val"><b>${b.budget === null ? eur(b.consomme + b.engage) : R.pct(b.taux)}</b><small>${b.budget === null ? 'consommé et engagé' : b.disponible < 0 ? `${euros(-b.disponible, { centimes: false })} au-delà` : `${euros(b.disponible, { centimes: false })} disponibles`}</small></div></div>`;
    }).join('');
    return `${titre}${nav}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Par service <span>Budget de l'exercice ${libExercice(ann)}</span></h2>
      <figure class="graphique"><div class="lignes-budget">${lignes}</div><p class="legende-cal legende-budget"><i class="lg-conso"></i>Consommé <i class="lg-engage"></i>Engagé <i class="lg-attente"></i>En attente de validation <i class="lg-budget"></i>Budget</p><div class="infobulle" hidden></div></figure>
      <details class="tableau-details"><summary>Voir le tableau par service</summary><div class="defile"><table class="tableau"><thead><tr><th>Service</th><th class="nb">Budget</th><th class="nb">Consommé</th><th class="nb">Engagé</th><th class="nb">En attente</th><th class="nb">Disponible</th></tr></thead><tbody>${bs.map((b) => `<tr><td>${esc(nomService(b.service))}</td><td class="nb">${b.budget === null ? '–' : euros(b.budget)}</td><td class="nb">${euros(b.consomme)}</td><td class="nb">${euros(b.engage)}</td><td class="nb">${euros(b.attente)}</td><td class="nb">${b.disponible === null ? '–' : euros(b.disponible)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="nb">${euros(tot.budget)}</td><td class="nb">${euros(tot.consomme)}</td><td class="nb">${euros(tot.engage)}</td><td class="nb">${euros(tot.attente)}</td><td class="nb">${avecBudget.length ? euros(dispo) : '–'}</td></tr></tfoot></table></div></details>
      <div class="rgpd"><h2>Comment c'est compté</h2><p>Une demande compte sur l'exercice de sa date de création. Consommé : les quantités reçues, au prix réel s'il a été saisi à la réception, sinon au prix estimé. Engagé : ce qui est validé ou commandé et pas encore reçu (un reliquat abandonné n'est plus compté). En attente : les demandes à valider, affichées à part. Montants ${taxe() === 'TTC' ? 'TTC' : 'HT'} tels que saisis ; aucun calcul de TVA. Les demandes sans prix ne sont pas comptées : estime leur prix pour un budget juste.</p></div>`;
  }

  // ---------- Catalogue ----------
  function vueCatalogue() {
    const sous = `<div class="filtres" role="group" aria-label="Partie du catalogue">${[['articles', 'Articles', E.articles.filter((a) => !a.archive).length], ['fournisseurs', 'Fournisseurs', fournisseursActifs().length], ['services', 'Services', servicesActifs().length]].map(([id, lib, n]) => `<button class="filtre" data-action="onglet-catalogue" data-o="${id}" aria-pressed="${ongletCatalogue === id}">${lib} <small>${n}</small></button>`).join('')}</div>`;
    const titre = (p, bouton) => `<div class="vue-tete"><div><h1>Catalogue</h1><p>${p}</p></div><div class="actions">${bouton}</div></div>${sous}`;
    if (ongletCatalogue === 'fournisseurs') {
      return `${titre('Les fournisseurs à qui l\'on commande : délai de livraison habituel et minimum de commande, pour les bons et les retards.', `<button class="btn primaire" data-action="nouveau-fournisseur">${ICONES.plus}Fournisseur</button>`)}
        ${E.fournisseurs.length ? `<ul class="lignes-fac" style="margin-top:16px">${E.fournisseurs.map((f) => { const n = E.articles.filter((a) => a.fournisseur === f.id && !a.archive).length; const c = E.commandes.filter((x) => x.fournisseur === f.id).length; return `<li class="ligne-fac ${f.archive ? 'st-abandonnee' : ''}"><button class="ligne-info" data-action="fournisseur" data-id="${f.id}"><b>${esc(f.nom)}</b><span class="ligne-detail">${[f.contact, f.delai !== null ? `livraison en ${pluriel(f.delai, 'jour')}` : '', f.minimum !== null ? `minimum ${euros(f.minimum)}` : '', pluriel(n, 'article'), pluriel(c, 'bon')].filter(Boolean).map(esc).join(' · ')}</span>${f.archive ? '<span class="ligne-etiquettes"><span class="etiquette sable">Archivé</span></span>' : ''}</button></li>`; }).join('')}</ul>`
          : `<div class="vide-etat" style="margin-top:16px">${FORME_VIDE}<div><h3>Aucun fournisseur</h3><p>Ajoute la papeterie, le fournisseur d'entretien, le prestataire du café… Rien n'est envoyé : les bons se recopient sur leur site ou leur bon de commande.</p><div class="actions"><button class="btn primaire" data-action="nouveau-fournisseur">${ICONES.plus}Ajouter un fournisseur</button></div></div></div>`}`;
    }
    if (ongletCatalogue === 'services') {
      const ann = exerciceCourant();
      return `${titre('Les services qui passent des demandes, leur responsable et leur budget de l\'exercice.', `<button class="btn primaire" data-action="nouveau-service">${ICONES.plus}Service</button>`)}
        <ul class="lignes-fac" style="margin-top:16px">${E.services.map((s) => { const b = R.budgetService(E, s.id, ann); return `<li class="ligne-fac ${s.archive ? 'st-abandonnee' : ''}"><button class="ligne-info" data-action="service" data-id="${s.id}"><b><i class="pastille-res" style="--rc:${couleurService(s)}" aria-hidden="true"></i>${esc(s.nom)}</b><span class="ligne-detail">${[s.responsable ? `responsable : ${s.responsable}` : '', `budget ${libExercice(ann)} : ${b.budget === null ? 'non fixé' : euros(b.budget)}`, pluriel(b.nb, 'demande')].filter(Boolean).map(esc).join(' · ')}</span>${s.archive ? '<span class="ligne-etiquettes"><span class="etiquette sable">Archivé</span></span>' : ''}</button></li>`; }).join('')}</ul>`;
    }
    const q = rechercheCatalogue.trim().toLocaleLowerCase('fr');
    const l = E.articles.filter((a) => !a.archive && (!categorieVue || a.categorie === categorieVue) && (!q || `${a.nom} ${a.reference} ${nomFournisseur(a.fournisseur)}`.toLocaleLowerCase('fr').includes(q)));
    const groupes = B.categories.map((c) => ({ c, l: l.filter((a) => a.categorie === c.id).sort((x, y) => x.nom.localeCompare(y.nom, 'fr')) })).filter((g) => g.l.length);
    const archives = E.articles.filter((a) => a.archive).length;
    return `${titre(`${pluriel(E.articles.filter((a) => !a.archive).length, 'article')} sans prix imposé : ajoute ton prix habituel et ton fournisseur, ils pré-remplissent les demandes.`, `<button class="btn primaire" data-action="nouvel-article">${ICONES.plus}Article</button>`)}
      <div class="outils-liste" style="margin-top:12px">
        <label class="champ choix-service"><span class="sr-only">Catégorie</span><select id="filtre-categorie">${[['', 'Toutes les catégories'], ...B.categories.map((c) => [c.id, c.nom])].map(([id, n]) => `<option value="${id}" ${categorieVue === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="champ recherche"><span class="sr-only">Rechercher un article</span><input id="recherche" type="search" placeholder="Article, référence, fournisseur" value="${esc(rechercheCatalogue)}"></label>
      </div>
      ${groupes.length ? groupes.map((g) => `<section class="groupe-cat"><h2 class="titre-cat"><i class="pastille-res" style="--rc:${couleurCat(g.c.id)}" aria-hidden="true"></i>${esc(g.c.nom)} <span>${pluriel(g.l.length, 'article')}</span></h2><ul class="articles">${g.l.map((a) => `<li><button class="lien-ligne" data-action="article" data-id="${a.id}"><b>${esc(a.nom)}</b><span>${[a.unite, a.fournisseur ? nomFournisseur(a.fournisseur) : '', a.reference ? `réf. ${a.reference}` : ''].filter(Boolean).map(esc).join(' · ')}</span></button><span class="prix-art">${a.prix === null ? '<small>prix à saisir</small>' : euros(a.prix)}</span><button class="btn petit" data-action="demander" data-id="${a.id}">Demander</button></li>`).join('')}</ul></section>`).join('')
        : `<div class="vide-etat" style="margin-top:16px">${FORME_VIDE}<div><h3>${E.articles.length ? 'Aucun article ne correspond' : 'Catalogue vide'}</h3><p>${E.articles.length ? 'Change la catégorie ou la recherche.' : 'Ajoute les fournitures que l\'équipe demande souvent, ou reprends le catalogue de départ.'}</p><div class="actions"><button class="btn primaire" data-action="nouvel-article">${ICONES.plus}Ajouter un article</button>${!E.articles.length ? '<button class="btn" data-action="catalogue-base">Reprendre le catalogue de départ</button>' : ''}</div></div></div>`}
      ${archives ? `<p class="aide" style="margin-top:16px">${pluriel(archives, 'article archivé', 'articles archivés')} (plus proposés dans les demandes). <button class="btn lien" data-action="voir-archives">Les voir</button></p>` : ''}`;
  }

  // ---------- Historique et statistiques ----------
  function bornesStats() {
    const t = auj();
    if (periodeStats === '12mois') return [R.ajoutMois(`${t.slice(0, 7)}-01`, -11), ajout(t, 1), 'les 12 derniers mois'];
    if (periodeStats === 'precedent') { const [a, b] = R.bornesExercice(exerciceCourant() - 1, E.reglages.debutExercice); return [a, b, `l'exercice ${libExercice(exerciceCourant() - 1)}`]; }
    const [a, b] = R.bornesExercice(exerciceCourant(), E.reglages.debutExercice);
    return [a, b, `l'exercice ${libExercice(exerciceCourant())}`];
  }
  const MOIS_COURT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const jours = (n) => (n === null ? '–' : `${String(Math.round(n * 10) / 10).replace('.', ',')} j`);
  function vueStats() {
    const [debut, fin, lib] = bornesStats();
    const s = R.statistiques(E, debut, fin);
    const titre = `<div class="vue-tete"><div><h1>Historique</h1><p>Demandes créées sur ${lib} : délais, refus, dépenses par mois, par catégorie et par service.</p></div>
      <div class="actions"><div class="filtres" role="group" aria-label="Période">${[['exercice', 'Exercice en cours'], ['12mois', '12 mois'], ['precedent', 'Exercice précédent']].map(([id, l]) => `<button class="filtre" data-action="periode" data-p="${id}" aria-pressed="${periodeStats === id}">${l}</button>`).join('')}</div></div></div>`;
    if (!s.nb) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune demande sur la période</h3><p>Les statistiques se remplissent au fil des demandes.</p></div></div>`;
    const tuiles = [
      ['Demandes', String(s.nb), `${s.auto} sous le seuil · ${s.urgentes} urgentes`, 'var(--bleu)', ''],
      ['Taux de refus', R.pct(s.tauxRefus), `${pluriel(s.parEtat.refusee, 'refusée')} · ${pluriel(s.parEtat.annulee, 'annulée')}`, 'var(--rouge)', 'rond'],
      ['Délai de validation', jours(s.delaiValidation), 'en moyenne, hors validation automatique', 'var(--jaune)', ''],
      ['Délai de livraison', jours(s.delaiReception), `commande en ${jours(s.delaiCommande)} après validation`, 'var(--encre)', 'rond'],
    ].map(tuile).join('');
    const maxM = Math.max(1, ...s.mois.map((m) => m.consomme));
    const colsM = s.mois.map((m) => `<div class="col-proj ${m.mois === auj().slice(0, 7) ? 'actif' : ''}" tabindex="0" data-info="${esc(`<b>${R.MOIS[Number(m.mois.slice(5)) - 1]} ${m.mois.slice(0, 4)}</b>${eur(m.consomme)} reçus`)}"><span class="cp-val">${m.consomme ? euros(m.consomme, { centimes: false }) : ''}</span><span class="cp-zone"><span class="cp-barre" style="height:${m.consomme ? Math.max(2, (m.consomme / maxM) * 100) : 0}%"></span></span><span class="cp-mois">${MOIS_COURT[Number(m.mois.slice(5)) - 1]}</span></div>`).join('');
    const barres = (obj, nom, couleur) => {
      const l = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      if (!l.length) return '<p class="aide">Aucun montant sur la période (prix à estimer).</p>';
      const max = Math.max(...l.map(([, v]) => v));
      return `<div class="barres-cats">${l.map(([k, v]) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(nom(k))}</b>${eur(v)} consommés ou engagés`)}"><span class="bc-nom"><i class="pastille-res" style="--rc:${couleur(k)}" aria-hidden="true"></i>${esc(nom(k))}</span><span class="bc-piste"><span class="bc-barre" style="width:${Math.max(1, (v / max) * 100)}%;background:${couleur(k)}"></span></span><span class="bc-val">${euros(v, { centimes: false })}</span></div>`).join('')}</div>`;
    };
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Reçu par mois <span>au prix réel ou estimé</span></h2>
      <figure class="graphique"><div class="projection" style="grid-template-columns:repeat(${s.mois.length},minmax(0,1fr))">${colsM}</div><div class="infobulle" hidden></div></figure>
      <div class="colonnes-occ">
        <section><h2 class="titre-section">Par catégorie</h2><figure class="graphique">${barres(s.parCategorie, nomCat, couleurCat)}<div class="infobulle" hidden></div></figure></section>
        <section><h2 class="titre-section">Par service</h2><figure class="graphique">${barres(s.parService, nomService, (id) => couleurService(trouver('services', id)))}<div class="infobulle" hidden></div></figure></section>
      </div>
      <h2 class="titre-section">Articles les plus demandés</h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Article</th><th class="nb">Demandes</th><th class="nb">Quantité</th></tr></thead><tbody>${s.topArticles.map((a) => `<tr><td>${esc(a.libelle)}</td><td class="nb">${a.nb}</td><td class="nb">${qte(a.quantite)} ${esc(a.unite)}</td></tr>`).join('')}</tbody></table></div>
      <h2 class="titre-section">Par état</h2>
      <div class="etats-resume">${R.ETATS.map((e) => `<span>${etiquetteEtat(e)} <b>${s.parEtat[e]}</b></span>`).join('')}</div>
      <div class="rang" style="margin-top:16px"><button class="btn petit" data-action="csv">Exporter toutes les demandes en CSV</button></div>
      <div class="rgpd"><h2>Lire ces délais</h2><p>Validation : de la demande à la décision (les demandes validées automatiquement ne comptent pas). Commande : de la validation au bon de commande. Livraison : du bon à la dernière réception. Des délais qui s'allongent signalent souvent des commandes groupées trop espacées.</p></div>`;
  }

  function brancherInfobulles() {
    const cat = $('#filtre-categorie');
    if (cat) cat.addEventListener('change', (e) => { categorieVue = e.target.value; rendre(); });
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
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) { p.textContent = err; p.scrollIntoView({ block: 'nearest' }); } return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const optionsServices = (sel) => E.services.filter((s) => !s.archive || s.id === sel).map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.nom)}</option>`).join('');
  const optionsFournisseurs = (sel, vide = 'Aucun (à choisir à la commande)') => `<option value="">${vide}</option>${E.fournisseurs.filter((f) => !f.archive || f.id === sel).map((f) => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}`;
  const datalistArticles = () => `<datalist id="liste-articles">${E.articles.filter((a) => !a.archive).map((a) => `<option value="${esc(a.nom)}"></option>`).join('')}</datalist>`;
  const articleNomme = (nom) => E.articles.find((a) => !a.archive && a.nom.toLocaleLowerCase('fr') === String(nom || '').trim().toLocaleLowerCase('fr')) || null;

  // Nouvelle demande : plusieurs articles possibles, chacun devient une demande (même groupe).
  let lignesForm = [];
  const ligneVide = (a = null) => ({ nom: a?.nom || '', quantite: '1', unite: a?.unite || 'pièce', prix: a?.prix !== null && a?.prix !== undefined ? String(a.prix).replace('.', ',') : '', fournisseur: a?.fournisseur || '' });
  function modaleNouvelle({ article = null } = {}) {
    if (!servicesActifs().length) { modaleService(null); return; }
    lignesForm = [ligneVide(article ? trouver('articles', article) : null)];
    const nom = monNom();
    const serviceDefaut = stock.lire(session.demo ? 'qme-ach-service-demo' : 'qme-ach-service');
    const corps = `
      <div class="rang-champs">
        <label class="champ">Demandé par <small>Ton nom, retenu sur cet appareil.</small><input name="par" maxlength="60" required value="${esc(nom)}" autocomplete="given-name"></label>
        <label class="champ">Service<select name="service">${optionsServices(servicesActifs().some((s) => s.id === serviceDefaut) ? serviceDefaut : servicesActifs()[0].id)}</select></label>
      </div>
      <fieldset class="champ"><legend>Articles <small>Choisis dans le catalogue ou écris librement. Le prix est une estimation, facultative.</small></legend><div id="lignes-dem"></div>
        <div class="rang"><button type="button" class="btn petit" data-action="ligne-plus">${ICONES.plus}Autre article</button></div></fieldset>
      <fieldset class="champ"><legend>Urgence</legend><div class="choix-statut trois">${B.urgences.map((u, i) => `<label title="${esc(u.aide)}"><input type="radio" name="urgence" value="${u.id}" ${i === 0 ? 'checked' : ''}><span>${u.nom}</span></label>`).join('')}</div></fieldset>
      <label class="champ">Motif <small>Pourquoi cet achat : il aide la personne qui valide.</small><input name="motif" maxlength="200" list="liste-motifs" autocomplete="off"><datalist id="liste-motifs">${B.motifs.map((m) => `<option value="${esc(m)}"></option>`).join('')}</datalist></label>
      ${datalistArticles()}
      <p class="recap" id="d-recap" aria-live="polite"></p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouvelle demande', corps, '<button class="btn primaire" value="ok">Envoyer la demande</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const par = String(fd.get('par') || '').trim();
      if (!par) return 'Indique ton nom (un prénom suffit) : la personne qui valide saura qui demande.';
      const res = construireDemandes(fd);
      if (typeof res === 'string') return res;
      retenir();
      const r = R.appliquer(E, { type: 'creer', demandes: res });
      if (!r.ok) return r.erreur;
      E = r.etat;
      if (!session.demo) ops.push({ type: 'creer', demandes: res });
      ecrireNom(par);
      stock.ecrire(session.demo ? 'qme-ach-service-demo' : 'qme-ach-service', fd.get('service'));
      sauver(); rendre();
      const auto = res.filter((d) => d.auto).length;
      toast(`${pluriel(res.length, 'demande envoyée', 'demandes envoyées')}${auto ? ` · ${auto === res.length ? 'validée' + (auto > 1 ? 's' : '') : `${auto} validée${auto > 1 ? 's' : ''}`} automatiquement (sous le seuil)` : ' · en attente de validation'}.`, { libelle: 'Annuler', faire: annuler }, 8000);
    });
    dessinerLignes();
    const f2 = modale().querySelector('form');
    const maj = () => { modale().querySelector('.erreur').textContent = ''; recapNouvelle(); };
    f2.addEventListener('input', maj); f2.addEventListener('change', maj);
    recapNouvelle();
  }
  function dessinerLignes() {
    const zone = $('#lignes-dem');
    if (!zone) return;
    zone.innerHTML = `<ol class="lignes-dem">${lignesForm.map((l, i) => `<li>
      <label class="champ l-nom">Article<input data-l="${i}" data-k="nom" list="liste-articles" value="${esc(l.nom)}" maxlength="120" placeholder="Ex. : Ramette de papier A4 80 g" autocomplete="off"></label>
      <label class="champ l-qte">Quantité<input data-l="${i}" data-k="quantite" value="${esc(l.quantite)}" inputmode="decimal"></label>
      <label class="champ l-unite">Unité<input data-l="${i}" data-k="unite" value="${esc(l.unite)}" list="liste-unites" maxlength="20"></label>
      <label class="champ l-prix">Prix unitaire <span class="sr-only">estimé</span><input data-l="${i}" data-k="prix" value="${esc(l.prix)}" inputmode="decimal" placeholder="€"></label>
      ${lignesForm.length > 1 ? `<button type="button" class="btn-suppr" data-action="ligne-moins" data-i="${i}" aria-label="Retirer cet article">×</button>` : ''}</li>`).join('')}</ol>
      <datalist id="liste-unites">${B.unites.map((u) => `<option value="${u}"></option>`).join('')}</datalist>`;
    zone.querySelectorAll('[data-l]').forEach((el) => el.addEventListener('input', () => {
      const l = lignesForm[Number(el.dataset.l)];
      l[el.dataset.k] = el.value;
      if (el.dataset.k === 'nom') {
        const a = articleNomme(el.value);
        if (a) {
          l.unite = a.unite; l.fournisseur = a.fournisseur || '';
          if (a.prix !== null) l.prix = String(a.prix).replace('.', ',');
          const li = el.closest('li');
          li.querySelector('[data-k=unite]').value = l.unite;
          li.querySelector('[data-k=prix]').value = l.prix;
        }
      }
    }));
  }
  function construireDemandes(fd, { apercu = false } = {}) {
    const t = auj();
    const groupe = uid();
    const lignes = lignesForm.filter((l) => l.nom.trim());
    if (!lignes.length) return 'Indique au moins un article.';
    const res = [];
    let essai = E;
    for (const l of lignes) {
      const q = R.lireNombre(l.quantite);
      if (!(q > 0)) return `Quantité de « ${l.nom.trim()} » : un nombre supérieur à zéro.`;
      const p = R.lireNombre(l.prix);
      if (Number.isNaN(p) || p < 0) return `Prix de « ${l.nom.trim()} » : un montant en euros, ou laisse vide.`;
      const a = articleNomme(l.nom);
      const d = R.normaliserDemande({ id: uid(), numero: '', groupe: lignes.length > 1 ? groupe : null, creeLe: t, par: String(fd.get('par') || '').trim() || '—', service: fd.get('service'), article: a?.id || null, libelle: l.nom.trim(), categorie: a?.categorie || 'autre', unite: l.unite.trim() || a?.unite || 'pièce', quantite: q, prix: p, fournisseur: a ? null : (l.fournisseur || null), urgence: fd.get('urgence') || 'normale', motif: String(fd.get('motif') || '').trim() }, t);
      const v = R.validationAuto(essai, d);
      if (v.auto) Object.assign(d, { statut: 'validee', auto: true, valideLe: t });
      d._raison = v.raison;
      res.push(d);
      // Les demandes suivantes du même envoi tiennent compte des précédentes dans le budget.
      essai = R.appliquer(essai, { type: 'creer', demandes: [d] }).etat;
    }
    if (!apercu) res.forEach((d) => { delete d._raison; });
    return res;
  }
  function recapNouvelle() {
    const el = $('#d-recap');
    const f2 = modale().querySelector('form');
    if (!el || !f2) return;
    const res = construireDemandes(new FormData(f2), { apercu: true });
    if (typeof res === 'string') { el.textContent = ''; return; }
    const total = res.reduce((s, d) => s + (R.montantEstime(d) || 0), 0);
    const b = R.budgetService(E, res[0].service, exerciceCourant());
    const auto = res.filter((d) => d.auto).length;
    el.innerHTML = `<b>${pluriel(res.length, 'article')} · ${res.some((d) => d.prix === null) ? 'au moins ' : ''}${eur(total)}</b> pour ${esc(nomService(res[0].service))}${b.budget !== null ? ` (disponible : ${eur(b.disponible)})` : ''}.<br>${auto === res.length ? 'Validée automatiquement : sous le seuil et dans le budget.' : auto ? `${auto} sur ${res.length} validée${auto > 1 ? 's' : ''} automatiquement, les autres attendent une validation.` : esc(res[0]._raison)}`;
  }

  // Détail d'une demande, avec les actions possibles selon son état.
  function modaleDemande(id) {
    const d = dem(id);
    if (!d) return;
    const t = auj();
    const e = R.etatDemande(d);
    const m = R.montants(d);
    const c = d.commande ? E.commandes.find((x) => x.id === d.commande) : null;
    const eff = R.effetBudget(E, d);
    const nom = monNom();
    const histo = [
      `<li><b>${fmt(d.creeLe)}</b> Demandée par ${esc(d.par || 'sans nom')}${d.motif ? ` : « ${esc(d.motif)} »` : ''}</li>`,
      d.auto ? `<li><b>${fmt(d.valideLe || d.creeLe)}</b> Validée automatiquement (sous le seuil, dans le budget)</li>` : '',
      d.valideLe && !d.auto ? `<li><b>${fmt(d.valideLe)}</b> ${d.statut === 'refusee' ? `Refusée par ${esc(d.validePar || '—')} : ${esc(d.motifRefus)}` : `Validée par ${esc(d.validePar || '—')}`}</li>` : '',
      c ? `<li><b>${fmt(c.date)}</b> Commandée : ${esc(c.numero)} chez ${esc(nomFournisseur(c.fournisseur))}${c.par ? ` (${esc(c.par)})` : ''}</li>` : '',
      ...d.receptions.map((r) => `<li><b>${fmt(r.date)}</b> Reçu ${qte(r.qte)} ${esc(d.unite)}${r.par ? ` (${esc(r.par)})` : ''}</li>`),
      d.solde && R.recu(d) < d.quantite ? `<li><b>${d.annuleLe ? fmt(d.annuleLe) : ''}</b> Reliquat de ${qte(d.quantite - R.recu(d))} ${esc(d.unite)} abandonné</li>` : '',
      d.statut === 'annulee' && d.annuleLe ? `<li><b>${fmt(d.annuleLe)}</b> Annulée</li>` : '',
    ].join('');
    const editable = e === 'demandee';
    const prixModif = e === 'demandee' || e === 'validee';
    const corps = `
      <p class="ligne-etiquettes">${etiquetteEtat(e)}${etiquetteUrgence(d.urgence)}${d.auto ? '<span class="etiquette vert">Sous le seuil</span>' : ''}</p>
      <div class="resume-facture">
        <div><span>Article</span><b>${esc(d.libelle)}</b><small>${esc(nomCat(d.categorie))}</small></div>
        <div><span>Quantité</span><b>${qte(d.quantite)} ${esc(d.unite)}</b><small>${['partielle', 'recue'].includes(e) ? `reçu : ${qte(R.recu(d))}` : ''}</small></div>
        <div><span>Service</span><b>${esc(nomService(d.service))}</b><small>${esc(d.par || 'sans nom')} · ${esc(d.numero)}</small></div>
        <div><span>Montant estimé</span><b>${R.montantEstime(d) === null ? 'Prix à estimer' : eur(R.montantEstime(d))}</b><small>${d.prixReel !== null ? `prix réel : ${euros(d.prixReel)} l'unité` : d.prix !== null ? `${euros(d.prix)} l'unité` : ''}</small></div>
      </div>
      ${e === 'demandee' && eff.budget !== null ? `<p class="recap ${eff.depasse ? 'alerte' : ''}">Budget ${libExercice(R.exercice(d.creeLe, E.reglages.debutExercice))} de ${esc(nomService(d.service))} : ${eur(eff.disponible)} disponibles${eff.disponibleApres !== null ? `, ${eur(eff.disponibleApres)} après validation${eff.depasse ? ' : <b>le budget serait dépassé</b>' : ''}` : ''}.</p>` : ''}
      ${e === 'demandee' && R.memeNom(nom, d.par) ? '<p class="aide">C\'est ta propre demande : si possible, fais-la valider par quelqu\'un d\'autre.</p>' : ''}
      ${editable ? `<details class="champs-aide"><summary>Modifier la demande</summary><div class="rang-champs"><label class="champ">Quantité<input name="quantite" value="${qte(d.quantite)}" inputmode="decimal"></label><label class="champ">Service<select name="service">${optionsServices(d.service)}</select></label></div>
        <label class="champ">Motif<input name="motif" maxlength="200" value="${esc(d.motif)}"></label></details>` : ''}
      ${prixModif ? `<div class="rang-champs"><label class="champ">Prix unitaire estimé <small>Facultatif.</small><input name="prix" value="${d.prix === null ? '' : String(d.prix).replace('.', ',')}" inputmode="decimal" placeholder="€"></label><label class="champ">Fournisseur<select name="fournisseur">${optionsFournisseurs(R.fournisseurDe(E, d) || '')}</select></label></div>` : ''}
      ${e === 'demandee' ? `<label class="champ">Motif du refus <small>Seulement pour refuser : la personne qui a demandé le verra.</small><input name="motifRefus" maxlength="200" list="liste-refus" autocomplete="off"><datalist id="liste-refus">${B.motifsRefus.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist></label>
        <label class="champ">Ton nom <small>Retenu comme valideur.</small><input name="valideur" maxlength="60" value="${esc(nom)}" autocomplete="given-name"></label>` : ''}
      <div class="bloc-detail"><h3>Historique</h3><ul class="historique">${histo}</ul></div>
      <p class="erreur" role="alert"></p>`;
    const boutons = {
      demandee: '<button class="btn primaire" value="valider">Valider</button><button class="btn" value="refuser">Refuser</button><button class="btn" value="enregistrer">Enregistrer</button><button class="btn danger gauche" value="annuler-dem">Annuler la demande</button>',
      validee: '<button class="btn primaire" value="enregistrer">Enregistrer</button><button class="btn" value="annuler">Fermer</button><button class="btn danger gauche" value="annuler-dem">Annuler la demande</button>',
      commandee: '<button class="btn primaire" value="recevoir">Réceptionner</button><button class="btn" value="annuler">Fermer</button><button class="btn danger gauche" value="solder">Ne plus attendre</button>',
      partielle: '<button class="btn primaire" value="recevoir">Réceptionner le reste</button><button class="btn" value="annuler">Fermer</button><button class="btn danger gauche" value="solder">Abandonner le reliquat</button>',
      recue: '<button class="btn primaire" value="annuler">Fermer</button>',
      refusee: '<button class="btn primaire" value="reouvrir">Redemander</button><button class="btn" value="annuler">Fermer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>',
      annulee: `<button class="btn primaire" value="annuler">Fermer</button>${d.commande ? '' : '<button class="btn" value="reouvrir">Redemander</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'}`,
    }[e];
    ouvrirModale(`${esc(d.numero)} · ${esc(d.libelle)}`, corps, boutons, (fd, action) => {
      const libres = () => {
        const champs = {};
        if (prixModif) {
          const p = R.lireNombre(fd.get('prix'));
          if (Number.isNaN(p) || p < 0) return 'Prix : un montant en euros, ou laisse vide.';
          if (p !== d.prix) champs.prix = p;
          const f = fd.get('fournisseur') || null;
          if (f !== (R.fournisseurDe(E, d) || null)) champs.fournisseur = f;
        }
        if (editable) {
          const q = R.lireNombre(fd.get('quantite'));
          if (!(q > 0)) return 'Quantité : un nombre supérieur à zéro.';
          if (q !== d.quantite) champs.quantite = q;
          if (fd.get('service') !== d.service) champs.service = fd.get('service');
          const mo = String(fd.get('motif') || '').trim();
          if (mo !== d.motif) champs.motif = mo;
        }
        return champs;
      };
      const executer = (actions, message) => {
        retenir();
        let etat = E;
        for (const a of actions) { const r = R.appliquer(etat, a); if (!r.ok) { annulation = null; return r.erreur; } etat = r.etat; }
        E = etat;
        if (!session.demo) actions.forEach((a) => ops.push(structuredClone(a)));
        sauver(); rendre(); toast(message, { libelle: 'Annuler', faire: annuler });
        return null;
      };
      if (action === 'recevoir') { setTimeout(() => modaleReception([d.id]), 0); return; }
      const champs = libres();
      if (typeof champs === 'string') return champs;
      const modif = Object.keys(champs).length ? [{ type: 'modifier', id: d.id, champs }] : [];
      if (action === 'enregistrer') { if (!modif.length) return; return executer(modif, 'Demande enregistrée.') || undefined; }
      if (action === 'valider' || action === 'refuser') {
        const par = String(fd.get('valideur') || '').trim();
        if (!par) return 'Indique ton nom : il est gardé comme valideur.';
        const motif = String(fd.get('motifRefus') || '').trim();
        if (action === 'valider' && motif) return 'Tu as saisi un motif de refus : choisis « Refuser », ou efface le motif pour valider.';
        if (action === 'refuser' && !motif) return 'Indique le motif du refus : la personne qui a demandé le verra.';
        if (action === 'valider' && R.effetBudget({ ...E, demandes: E.demandes.map((x) => (x.id === d.id ? { ...x, ...champs } : x)) }, { ...d, ...champs }).depasse && !confirm(`Le budget de ${nomService(d.service)} sera dépassé. Valider quand même ?`)) { garderOuverte(); return; }
        if (!nom) ecrireNom(par);
        return executer([...modif, { type: action, id: d.id, par, le: t, motif }], action === 'valider' ? `${d.numero} validée : elle passe dans « À commander ».` : `${d.numero} refusée.`) || undefined;
      }
      if (action === 'annuler-dem') { if (!confirm(`Annuler la demande ${d.numero} (${d.libelle}) ?`)) { garderOuverte(); return; } return executer([{ type: 'annuler', id: d.id, le: t }], `${d.numero} annulée.`) || undefined; }
      if (action === 'solder') { if (!confirm(e === 'partielle' ? `Ne plus attendre les ${qte(R.reste(d))} ${d.unite} restants ? Le reliquat sort de l'engagé.` : `Ne plus attendre cette livraison ? La demande sera annulée et sortira de l'engagé.`)) { garderOuverte(); return; } return executer([{ type: 'solder', id: d.id, le: t }], e === 'partielle' ? 'Reliquat abandonné : la demande est close.' : 'Livraison abandonnée.') || undefined; }
      if (action === 'reouvrir') return executer([{ type: 'reouvrir', id: d.id }], `${d.numero} remise à valider.`) || undefined;
      if (action === 'supprimer') { if (!confirm(`Supprimer définitivement ${d.numero} ?`)) { garderOuverte(); return; } return executer([{ type: 'supprimer', id: d.id }], `${d.numero} supprimée.`) || undefined; }
      return undefined;
    });
    void m;
  }

  function validerVite(id) {
    const d = dem(id);
    if (!d) return;
    if (!monNom() || R.memeNom(monNom(), d.par) || R.effetBudget(E, d).depasse) { modaleDemande(id); return; }
    const r = agir({ type: 'valider', id, par: monNom(), le: auj() });
    if (!r.ok) { toast(r.erreur); return; }
    toast(`${d.numero} validée par ${monNom()}.`, { libelle: 'Annuler', faire: annuler });
  }

  // Passer une commande : un bon par fournisseur, avec les demandes validées de ce fournisseur.
  function modaleCommande(fournisseur) {
    const g = R.aCommander(E).find((x) => x.fournisseur === fournisseur);
    if (!g) return;
    const f = trouver('fournisseurs', fournisseur);
    const corps = `
      <p>${pluriel(g.demandes.length, 'demande validée', 'demandes validées')} chez <b>${esc(f?.nom || '')}</b>${f?.contact ? ` (${esc(f.contact)})` : ''}. Passe la commande comme d'habitude (site, téléphone, bon du fournisseur), puis enregistre-la ici : les demandes passent « Commandée ».</p>
      ${tableLignes(g.lignes)}
      <p class="ligne-somme total"><span>Total estimé</span><b>${eur(g.total)}${g.sansPrix ? ` + ${pluriel(g.sansPrix, 'ligne')} à chiffrer` : ''}</b></p>
      ${g.sousMinimum ? `<p class="recap alerte">Il manque ${eur(g.sousMinimum)} pour atteindre le minimum de commande de ce fournisseur (${eur(f.minimum)}).</p>` : ''}
      <div class="rang-champs">
        <label class="champ">Date de la commande<input type="date" name="date" value="${auj()}" required></label>
        <label class="champ">Passée par<input name="par" maxlength="60" value="${esc(monNom())}"></label>
      </div>
      <label class="champ">Référence chez le fournisseur <small>Facultatif : numéro de commande ou de devis.</small><input name="reference" maxlength="60"></label>
      <label class="champ">Note <small>Facultative, imprimée sur le bon.</small><input name="note" maxlength="300"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Passer la commande', corps, '<button class="btn primaire" value="ok">Enregistrer la commande</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" value="imprimer">Aperçu du bon</button>', (fd, action) => {
      if (action === 'imprimer') { imprimerBon({ fournisseur, lignes: g.lignes, date: fd.get('date') || auj(), numero: 'à attribuer', reference: fd.get('reference'), note: fd.get('note'), par: fd.get('par') }); garderOuverte(); return; }
      if (!R.estDate(fd.get('date'))) return 'Indique la date de la commande.';
      const commande = { id: uid(), numero: '', fournisseur, date: fd.get('date'), par: String(fd.get('par') || '').trim(), reference: String(fd.get('reference') || '').trim(), note: String(fd.get('note') || '').trim(), demandes: g.demandes };
      const r = agir({ type: 'commander', commande });
      if (!r.ok) return r.erreur;
      if (commande.par && !monNom()) ecrireNom(commande.par);
      toast(`${r.info.numero} enregistré chez ${f?.nom || ''}.`, { libelle: 'Imprimer le bon', faire: () => ouvrirBon(r.etat.commandes.at(-1).id, true) }, 9000);
      return undefined;
    });
  }

  // Bon de commande enregistré : détail et impression.
  function ouvrirBon(id, imprimer = false) {
    const c = E.commandes.find((x) => x.id === id);
    if (!c) return;
    const s = R.etatCommande(E, c, auj());
    const lignes = R.lignesBon(E, s.demandes);
    if (imprimer) { imprimerBon({ ...c, lignes }); return; }
    const corps = `
      <div class="resume-facture">
        <div><span>Fournisseur</span><b>${esc(nomFournisseur(c.fournisseur))}</b><small>${esc(trouver('fournisseurs', c.fournisseur)?.contact || '')}</small></div>
        <div><span>Commandé le</span><b>${fmt(c.date)}</b><small>${esc(c.par)}${c.reference ? ` · ${esc(c.reference)}` : ''}</small></div>
        <div><span>Livraison</span><b>${s.statut === 'recue' ? 'Reçue' : s.attendue ? `Attendue le ${fmt(s.attendue)}` : 'Délai non renseigné'}</b><small>${s.retard ? `en retard de ${pluriel(s.retard, 'jour')}` : ''}</small></div>
        <div><span>Total estimé</span><b>${eur(s.total)}</b><small>${pluriel(s.demandes.length, 'demande')}</small></div>
      </div>
      <div class="bloc-detail"><h3>Lignes</h3><ul class="mini-liste">${s.demandes.map((d) => { const e = R.etatDemande(d); return `<li><span><b>${esc(d.libelle)}</b> × ${qte(d.quantite)} ${esc(d.unite)} <small>· ${esc(nomService(d.service))} · ${esc(d.numero)}</small></span>${etiquetteEtat(e)}<button type="button" class="btn petit" data-action="ouvrir" data-id="${d.id}">Voir</button></li>`; }).join('')}</ul></div>
      ${c.note ? `<p class="aide">Note : ${esc(c.note)}</p>` : ''}`;
    ouvrirModale(`${esc(c.numero)}`, corps, `${s.statut !== 'recue' ? '<button class="btn primaire" value="recevoir">Réceptionner</button>' : ''}<button class="btn ${s.statut === 'recue' ? 'primaire' : ''}" value="imprimer">Imprimer le bon</button><button class="btn" value="annuler">Fermer</button>`, (fd, action) => {
      if (action === 'imprimer') { imprimerBon({ ...c, lignes }); garderOuverte(); return; }
      if (action === 'recevoir') setTimeout(() => modaleReception(s.demandes.filter((d) => ['commandee', 'partielle'].includes(R.etatDemande(d))).map((d) => d.id)), 0);
      return undefined;
    });
  }

  // Réception : une ligne par demande attendue, quantité reçue (reste par défaut), prix réel facultatif.
  function modaleReception(ids) {
    const ds = ids.map(dem).filter((d) => d && ['commandee', 'partielle'].includes(R.etatDemande(d)));
    if (!ds.length) { toast('Rien à réceptionner.'); return; }
    const corps = `
      <p>Indique ce qui est arrivé. Une quantité plus petite que prévu laisse la demande « reçue en partie » : le reste reste attendu.</p>
      <ol class="lignes-recep">${ds.map((d) => `<li><div><b>${esc(d.libelle)}</b><small>${esc(d.numero)} · ${esc(nomService(d.service))} · attendu : ${qte(R.reste(d))} ${esc(d.unite)}${R.recu(d) ? ` (déjà reçu ${qte(R.recu(d))})` : ''}</small></div>
        <label class="champ">Reçu<input name="q-${d.id}" value="${qte(R.reste(d))}" inputmode="decimal"></label>
        <label class="champ">Prix réel unit. <small>Facultatif</small><input name="p-${d.id}" value="${d.prixReel !== null ? String(d.prixReel).replace('.', ',') : ''}" inputmode="decimal" placeholder="${d.prix !== null ? euros(d.prix) : '€'}"></label></li>`).join('')}</ol>
      <div class="rang-champs">
        <label class="champ">Date de réception<input type="date" name="date" value="${auj()}"></label>
        <label class="champ">Réceptionné par<input name="par" maxlength="60" value="${esc(monNom())}"></label>
      </div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Réception', corps, '<button class="btn primaire" value="ok">Enregistrer la réception</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Indique la date de réception.';
      const par = String(fd.get('par') || '').trim();
      const actions = [];
      for (const d of ds) {
        const q = R.lireNombre(fd.get(`q-${d.id}`));
        if (q === null || q === 0) continue;
        if (!(q > 0)) return `Quantité reçue de « ${d.libelle} » : un nombre positif, ou 0.`;
        const p = R.lireNombre(fd.get(`p-${d.id}`));
        if (Number.isNaN(p) || p < 0) return `Prix réel de « ${d.libelle} » : un montant en euros, ou laisse vide.`;
        actions.push({ type: 'recevoir', id: d.id, reception: { id: uid(), date, qte: q, par }, ...(p !== null ? { prixReel: p } : {}) });
      }
      if (!actions.length) return 'Aucune quantité reçue : indique au moins une ligne.';
      retenir();
      let etat = E, completes = 0;
      for (const a of actions) { const r = R.appliquer(etat, a); if (!r.ok) { annulation = null; return r.erreur; } etat = r.etat; if (r.info?.complete) completes++; }
      E = etat;
      if (!session.demo) actions.forEach((a) => ops.push(a));
      if (par && !monNom()) ecrireNom(par);
      sauver(); rendre();
      toast(`${pluriel(actions.length, 'ligne reçue', 'lignes reçues')}${completes < actions.length ? ` · ${pluriel(actions.length - completes, 'reliquat attendu', 'reliquats attendus')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
  }

  // Impression d'un bon de commande (A4) : zone #impression, imprimée seule.
  function imprimerBon(b) {
    const f = trouver('fournisseurs', b.fournisseur);
    const total = b.lignes.reduce((s, l) => s + l.montant, 0);
    const sansPrix = b.lignes.some((l) => l.sansPrix);
    $('#impression').innerHTML = `<article class="bon">
      <header class="bon-tete"><div><p class="bon-org">${esc(E.organisation || 'Organisation')}</p>${E.adresse ? `<p class="bon-adr">${esc(E.adresse).replace(/\n/g, '<br>')}</p>` : ''}</div><div class="bon-num"><h1>Bon de commande</h1><p><b>${esc(b.numero)}</b> · ${fmt(b.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p></div></header>
      <section class="bon-four"><p class="bon-lib">Fournisseur</p><p><b>${esc(f?.nom || 'À choisir')}</b>${f?.contact ? `<br>${esc(f.contact)}` : ''}</p>${b.reference ? `<p class="bon-lib">Référence fournisseur</p><p>${esc(b.reference)}</p>` : ''}</section>
      <table class="bon-table"><thead><tr><th>Réf.</th><th>Désignation</th><th class="nb">Qté</th><th>Unité</th><th class="nb">Prix unit. ${taxe()}</th><th class="nb">Montant ${taxe()}</th></tr></thead>
        <tbody>${b.lignes.map((l) => `<tr><td>${esc(l.reference)}</td><td>${esc(l.libelle)}</td><td class="nb">${qte(l.quantite)}</td><td>${esc(l.unite)}</td><td class="nb">${l.prix === null ? '' : euros(l.prix)}</td><td class="nb">${l.sansPrix ? '' : euros(l.montant)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5">Total estimé ${taxe()}${sansPrix ? ' (lignes sans prix non comptées)' : ''}</td><td class="nb">${euros(total)}</td></tr></tfoot></table>
      ${b.note ? `<p class="bon-note">${esc(b.note)}</p>` : ''}
      ${E.adresse ? `<section class="bon-livr"><p class="bon-lib">Adresse de livraison</p><p>${esc(E.adresse).replace(/\n/g, '<br>')}</p></section>` : ''}
      <footer class="bon-pied"><p>Commandé par : ${esc(b.par || '')}</p><p>Prix estimés en interne, à confirmer par le fournisseur. Document interne, sans valeur de facture.</p></footer>
    </article>`;
    document.body.classList.add('impression');
    const fin = () => { document.body.classList.remove('impression'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { window.print(); setTimeout(fin, 500); }, 50);
  }

  function modaleNom() {
    ouvrirModale('Ton nom', `<p>Ton nom est pré-rempli à chaque demande, validation ou réception, et retrouve tes demandes. Il reste sur cet appareil : chaque personne indique le sien.</p>
      <label class="champ">Nom ou prénom<input name="nom" maxlength="60" value="${esc(monNom())}" autocomplete="given-name"></label><p class="erreur" role="alert"></p>`,
    '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const n = String(fd.get('nom') || '').trim();
      if (!n) return 'Indique un nom (un prénom suffit).';
      ecrireNom(n); rendre(); toast(`Bonjour ${n}.`);
      return undefined;
    });
  }

  // Catalogue : article, fournisseur, service (même gabarit : upsert, archive, suppression si rien n'y est rattaché).
  function enregistrerObjet(coll, obj, existant, message) {
    const r = agir({ type: 'maj', coll, obj });
    if (!r.ok) return r.erreur;
    toast(message || `« ${obj.nom} » ${existant ? 'enregistré' : 'ajouté'}.`, { libelle: 'Annuler', faire: annuler });
    return undefined;
  }
  function retirerObjet(coll, x) {
    if (!confirm(`Supprimer « ${x.nom} » ?`)) { garderOuverte(); return undefined; }
    const r = agir({ type: 'retirer', coll, id: x.id });
    if (!r.ok) return r.erreur;
    toast(`« ${x.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
    return undefined;
  }
  function modaleArticle(id) {
    const x = id ? trouver('articles', id) : null;
    const v = x || { nom: '', categorie: categorieVue || 'bureau', unite: 'pièce', fournisseur: null, reference: '', prix: null, archive: false };
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="90" required value="${esc(v.nom)}" placeholder="Ex. : Ramette de papier A4 80 g"></label>
      <div class="rang-champs">
        <label class="champ">Catégorie<select name="categorie">${B.categories.map((c) => `<option value="${c.id}" ${c.id === v.categorie ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Unité<input name="unite" maxlength="20" value="${esc(v.unite)}" list="liste-unites2"><datalist id="liste-unites2">${B.unites.map((u) => `<option value="${u}"></option>`).join('')}</datalist></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Prix habituel (€) <small>Facultatif, ton prix : il pré-remplit les demandes.</small><input name="prix" value="${v.prix === null ? '' : String(v.prix).replace('.', ',')}" inputmode="decimal"></label>
        <label class="champ">Référence fournisseur <small>Facultative.</small><input name="reference" maxlength="40" value="${esc(v.reference)}"></label>
      </div>
      <label class="champ">Fournisseur habituel<select name="fournisseur">${optionsFournisseurs(v.fournisseur || '', 'Aucun')}</select></label>
      ${x ? `<label class="case"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''}> Archivé (plus proposé dans les demandes)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Article' : 'Nouvel article', corps, `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') return retirerObjet('articles', x);
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'article.';
      if (E.articles.some((y) => y.id !== x?.id && !y.archive && y.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr'))) return 'Un article porte déjà ce nom.';
      const p = R.lireNombre(fd.get('prix'));
      if (Number.isNaN(p) || p < 0) return 'Prix : un montant en euros, ou laisse vide.';
      return enregistrerObjet('articles', R.normaliserArticle({ id: x?.id || uid(), nom, categorie: fd.get('categorie'), unite: String(fd.get('unite') || '').trim(), fournisseur: fd.get('fournisseur') || null, reference: String(fd.get('reference') || '').trim(), prix: p, archive: !!fd.get('archive') }), !!x);
    });
  }
  function modaleFournisseur(id) {
    const x = id ? trouver('fournisseurs', id) : null;
    const v = x || { nom: '', contact: '', delai: null, minimum: null, note: '', archive: false };
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="80" required value="${esc(v.nom)}"></label>
      <label class="champ">Comment commander <small>Site, téléphone professionnel, commercial attitré… Facultatif.</small><input name="contact" maxlength="160" value="${esc(v.contact)}"></label>
      <div class="rang-champs">
        <label class="champ">Délai de livraison (jours) <small>Pour signaler les retards.</small><input type="number" name="delai" min="0" max="365" value="${v.delai ?? ''}"></label>
        <label class="champ">Minimum de commande (€) <small>Facultatif.</small><input name="minimum" value="${v.minimum === null ? '' : String(v.minimum).replace('.', ',')}" inputmode="decimal"></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="300" value="${esc(v.note)}"></label>
      ${x ? `<label class="case"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''}> Archivé (l'historique reste)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Fournisseur' : 'Nouveau fournisseur', corps, `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') return retirerObjet('fournisseurs', x);
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au fournisseur.';
      const mi = R.lireNombre(fd.get('minimum'));
      if (Number.isNaN(mi) || mi < 0) return 'Minimum : un montant en euros, ou laisse vide.';
      return enregistrerObjet('fournisseurs', R.normaliserFournisseur({ id: x?.id || uid(), nom, contact: String(fd.get('contact') || '').trim(), delai: fd.get('delai'), minimum: mi, note: String(fd.get('note') || '').trim(), archive: !!fd.get('archive') }), !!x);
    });
  }
  function modaleService(id) {
    const x = id ? trouver('services', id) : null;
    const ann = vue === 'budget' ? exerciceVu : exerciceCourant();
    const v = x || { nom: '', responsable: '', couleur: E.services.length % 8, budgets: {}, archive: false };
    const corps = `
      <label class="champ">Nom<input name="nom" maxlength="60" required value="${esc(v.nom)}" placeholder="Ex. : Administration"></label>
      <div class="rang-champs">
        <label class="champ">Responsable <small>Facultatif : prénom de la personne qui valide.</small><input name="responsable" maxlength="60" value="${esc(v.responsable)}"></label>
        <label class="champ">Budget ${libExercice(ann)} (€) <small>Vide : pas de budget fixé.</small><input name="budget" value="${v.budgets[ann] ?? ''}" inputmode="decimal"></label>
      </div>
      <fieldset class="champ"><legend>Couleur</legend><div class="pastilles">${B.couleurs.map((c, i) => `<label><input type="radio" name="couleur" value="${i}" ${i === v.couleur ? 'checked' : ''} aria-label="Couleur ${i + 1}"><span style="--c:${c}"></span></label>`).join('')}</div></fieldset>
      ${x ? `<label class="case"><input type="checkbox" name="archive" ${v.archive ? 'checked' : ''}> Archivé (ne demande plus, l'historique reste)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Service' : 'Nouveau service', corps, `<button class="btn primaire" value="ok">${x ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" value="annuler">Annuler</button>${x ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`, (fd, action) => {
      if (action === 'supprimer') return retirerObjet('services', x);
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom au service.';
      if (E.services.some((y) => y.id !== x?.id && y.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr'))) return 'Un service porte déjà ce nom.';
      const b = R.lireNombre(fd.get('budget'));
      if (Number.isNaN(b) || b < 0) return 'Budget : un montant en euros, ou laisse vide.';
      const budgets = { ...v.budgets };
      if (b === null) delete budgets[ann]; else budgets[ann] = b;
      return enregistrerObjet('services', R.normaliserService({ id: x?.id || uid(), nom, responsable: String(fd.get('responsable') || '').trim(), couleur: Number(fd.get('couleur')), budgets, archive: !!fd.get('archive') }), !!x);
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const g = E.reglages;
    const corps = `
      <label class="champ">Nom de l'organisation <small>Imprimé sur les bons de commande.</small><input name="organisation" maxlength="80" value="${esc(E.organisation)}"></label>
      <label class="champ">Adresse de livraison <small>Imprimée sur les bons. Adresse de l'organisation, jamais celle d'une personne.</small><textarea name="adresse" maxlength="300" rows="3">${esc(E.adresse)}</textarea></label>
      <div class="groupe"><h3>Validation</h3>
        <div class="rang-champs">
          <label class="champ">Seuil de validation automatique (€) <small>Vide : chaque demande est validée par une personne.</small><input name="seuil" value="${g.seuil === null ? '' : String(g.seuil).replace('.', ',')}" inputmode="decimal"></label>
          <label class="champ">Signaler une demande en attente après (jours)<input type="number" name="relance" min="1" max="60" value="${g.relance}"></label>
        </div>
        <p class="mention">Sous le seuil, une demande dont le prix est estimé et qui tient dans le budget de son service est validée dès son envoi. Les demandes déjà envoyées ne changent pas.</p></div>
      <div class="groupe"><h3>Budget</h3>
        <div class="rang-champs">
          <label class="champ">Début de l'exercice<select name="debutExercice">${R.MOIS.map((m, i) => `<option value="${i + 1}" ${i + 1 === g.debutExercice ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="champ">Montants saisis<select name="taxe"><option value="HT" ${g.taxe === 'HT' ? 'selected' : ''}>Hors taxes (HT)</option><option value="TTC" ${g.taxe === 'TTC' ? 'selected' : ''}>Toutes taxes comprises (TTC)</option></select></label>
        </div>
        <p class="mention">Simple libellé : aucun calcul de TVA. Choisis la convention de ta comptabilité et garde-la toute l'année.</p></div>
      <div class="groupe"><h3>Sur cet appareil</h3><p class="aide">Ton nom : <b>${esc(monNom() || 'non indiqué')}</b>. Il pré-remplit tes demandes et validations et n'est pas partagé.</p>
        <div class="rang"><button type="button" class="btn petit" data-action="mon-nom">${monNom() ? 'Changer de nom' : 'Indiquer mon nom'}</button></div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Noms des personnes</h3><p class="aide">Efface les noms (demandeur, valideur, réception) des demandes terminées créées il y a plus de N mois : montants et articles restent pour le budget et l'historique.</p>
        <div class="rang"><label class="champ" style="flex:0 1 220px">Plus de (mois)<input type="number" id="anciens" min="1" max="120" value="24"></label><button type="button" class="btn petit" data-action="anonymiser" style="align-self:flex-end">Effacer ces noms</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Toutes les demandes en tableur (CSV, point-virgule), pour la comptabilité ou une archive.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv">Exporter en CSV</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Les données sont enregistrées en ligne avec la clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Partager avec l'équipe</h3><p class="aide">Transmets la clé aux personnes qui demandent et à celles qui valident (de vive voix ou par ta messagerie habituelle) : chacune la saisit une fois sur <b>qm-engineering.fr/templates/achats/</b>. Pas de compte, pas de droits différents : tout le monde peut demander, valider, commander et réceptionner ; chaque étape garde le nom saisi.</p></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Données personnelles</h3><p class="mention">Les demandes et les noms saisis sont enregistrés en ligne, liés à la clé, et ne sont ni lus ni partagés par QME. L'organisation qui utilise l'outil est responsable des noms saisis : un prénom suffit, et efface ce qui ne sert plus.</p></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Catalogue de départ de ${B.articles.length} fournitures types rédigé pour QME, sans prix ni marque. Aucun fournisseur, aucune messagerie ni aucun moyen de paiement n'est connecté : les bons se recopient ou s'impriment. Aucune règle fiscale ni comptable intégrée.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const seuil = R.lireNombre(fd.get('seuil'));
      if (Number.isNaN(seuil) || seuil < 0) return 'Seuil : un montant en euros, ou laisse vide.';
      const reglages = R.reglagesDe({ seuil, relance: fd.get('relance'), debutExercice: fd.get('debutExercice'), taxe: fd.get('taxe') }, E.reglages);
      const r = agir({ type: 'reglages', valeur: { organisation: String(fd.get('organisation') || '').trim(), adresse: String(fd.get('adresse') || '').trim(), reglages } });
      if (!r.ok) return r.erreur;
      exerciceVu = exerciceCourant();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
      return undefined;
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.demandes) || !Array.isArray(d.services)) throw new Error();
        if (!confirm(`Remplacer toutes les données (pour toute l'équipe) par cette copie (${pluriel(d.services.length, 'service')}, ${pluriel(d.demandes.length, 'demande')}) ?`)) return;
        const n = normaliser(d); delete n.majLe;
        modale().close();
        agir({ type: 'remplacer', etat: n });
        autresModifs = true;
        toast('Copie restaurée.', { libelle: 'Annuler', faire: annuler });
      } catch { toast('Ce fichier n\'est pas une copie valide des demandes d\'achat.'); }
    });
  }

  function anonymiser() {
    const mois = Math.round(Number($('#anciens')?.value));
    if (!(mois >= 1 && mois <= 120)) { toast('Indique un nombre de mois entre 1 et 120.'); return; }
    const avant = R.ajoutMois(auj(), -mois);
    const { etat, n } = R.anonymiser(E, avant);
    if (!n) { toast('Aucune demande terminée à effacer avant cette date.'); return; }
    if (!confirm(`Effacer les noms de ${pluriel(n, 'demande')} terminée${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''} avant le ${fmt(avant)} ?`)) return;
    modale().close();
    agir({ type: 'remplacer', etat });
    autresModifs = true;
    toast(`${pluriel(n, 'demande anonymisée', 'demandes anonymisées')} (montants conservés).`, { libelle: 'Annuler', faire: annuler });
  }

  function telecharger(contenu, type, nom) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `demandes-achat-${auj()}.json`);
  const exporterCsv = () => telecharger(R.versCsv(E), 'text/csv;charset=utf-8', `demandes-achat-${auj()}.csv`);

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
    const blocs = a === 'ios' ? ETAPES_IOS
      : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications.</p>
      ${installable ? '<div class="rang"><button class="btn primaire" type="button" data-action="installer">Ajouter à l\'écran d\'accueil</button></div><p class="aide">Ou à la main :</p>' : ''}
      ${blocs}
      <p class="aide">Les données restent les mêmes : l'icône ouvre cette page avec la clé déjà enregistrée sur cet appareil.${a === 'autre' ? ' Sur ordinateur, la page fonctionne aussi directement dans le navigateur.' : ''}</p>`;
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
  function toast(texte, action, duree) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texte)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, duree || (action ? 7000 : 4000));
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
      case 'accueil-service': if (accueil.services.length < R.MAX.services) { accueil.services.push({ nom: '', budget: '' }); ecranAccueil(); } break;
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
      case 'nouvelle': modaleNouvelle(); break;
      case 'demander': modaleNouvelle({ article: id }); break;
      case 'ligne-plus': if (lignesForm.length < R.MAX.lignes) { lignesForm.push(ligneVide()); dessinerLignes(); recapNouvelle(); modale().querySelector(`[data-l="${lignesForm.length - 1}"][data-k=nom]`)?.focus(); } break;
      case 'ligne-moins': lignesForm.splice(Number(el.dataset.i), 1); dessinerLignes(); recapNouvelle(); break;
      case 'ouvrir': modaleDemande(id); break;
      case 'valider-vite': validerVite(id); break;
      case 'recevoir': modaleReception([id]); break;
      case 'recevoir-bon': { const c = E.commandes.find((x) => x.id === id); if (c) modaleReception(c.demandes); break; }
      case 'ouvrir-bon': ouvrirBon(id); break;
      case 'passer-commande': modaleCommande(el.dataset.f); break;
      case 'apercu-bon': { const g = R.aCommander(E).find((x) => x.fournisseur === el.dataset.f); if (g) imprimerBon({ fournisseur: g.fournisseur, lignes: g.lignes, date: auj(), numero: 'à attribuer', par: monNom() }); break; }
      case 'voir-a-valider': filtre.liste = 'aValider'; changerVue('demandes'); break;
      case 'mon-nom': modaleNom(); break;
      case 'article': modaleArticle(id); break;
      case 'nouvel-article': modaleArticle(null); break;
      case 'fournisseur': modaleFournisseur(id); break;
      case 'nouveau-fournisseur': modaleFournisseur(null); break;
      case 'service': modaleService(id); break;
      case 'nouveau-service': modaleService(null); break;
      case 'onglet-catalogue': ongletCatalogue = el.dataset.o; rendre(); break;
      case 'catalogue-base': { retenir(); let etat = E; const n = []; for (const a of R.catalogueDeBase(B)) { const obj = { ...a, id: uid() }; const r = R.appliquer(etat, { type: 'maj', coll: 'articles', obj }); if (r.ok) { etat = r.etat; n.push({ type: 'maj', coll: 'articles', obj }); } } E = etat; if (!session.demo) ops.push(...n); sauver(); rendre(); toast(`${pluriel(n.length, 'article ajouté', 'articles ajoutés')}.`, { libelle: 'Annuler', faire: annuler }); break; }
      case 'voir-archives': { const l = E.articles.filter((a) => a.archive); ouvrirModale('Articles archivés', `<ul class="mini-liste">${l.map((a) => `<li><span><b>${esc(a.nom)}</b> <small>${esc(nomCat(a.categorie))}</small></span><button type="button" class="btn petit" data-action="article" data-id="${a.id}">Modifier</button></li>`).join('')}</ul>`, '<button class="btn primaire" value="annuler">Fermer</button>'); break; }
      case 'anonymiser': anonymiser(); break;
      case 'exercice': exerciceVu = el.dataset.n === '0' ? exerciceCourant() : exerciceVu + Number(el.dataset.n); rendre(); break;
      case 'filtre': filtre.liste = el.dataset.f; rendre(); break;
      case 'periode': periodeStats = el.dataset.p; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  // Toutes les deux minutes : relecture des demandes de l'équipe.
  setInterval(() => { if (E && document.visibilityState === 'visible' && !modale().open) rafraichir(); }, 120000);
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
        E = normaliser(c.etat); session.base = c.base; session.jeton = c.jeton; ops = c.ops || []; autresModifs = !!c.autresModifs;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__achats = { etat: () => E, regles: R, ops: () => ops };
  init();
})();
