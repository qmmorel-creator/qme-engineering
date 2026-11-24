// Maintenance préventive QME (GMAO légère) : équipements, plans de maintenance, échéances à la date, au
// compteur ou au premier atteint, bons d'intervention imprimables, historique, pièces de rechange, coûts et
// indicateurs. Option « plusieurs sites » (fusion du Pilotage de parcs multi-sites, 22/11/2026) : équipements
// rangés par site, vue d'ensemble, alertes d'arrêt et de visite, disponibilité, coût par site, liste triable,
// carte schématique, import et export CSV. Données synchronisées par clé de licence ou code d'accès. Aucun
// capteur, fond de carte ni logiciel connecté.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.GMA;
  const API = '/api/templates';
  const PRODUIT = 'GMA';
  const CLE_CODE = 'qme-gma-code';
  const CLE_CACHE = 'qme-gma-cache';
  const CLE_DEMO = 'qme-gma-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-gma-ecran-accueil';
  const CLE_AFFICHAGE = 'qme-gma-affichage'; // liste ou carte des sites (préférence de cet appareil)

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
  const { ajout, versDate, euros, nombre, pct, ecart } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => versDate(s).toLocaleDateString('fr-FR', o);
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;
  const uniteCourte = (u) => B.unitesCompteur.find((x) => x.code === u)?.court || '';
  const cpt = (v, u) => (v === null || v === undefined ? '–' : `${nombre(v, 1)} ${uniteCourte(u)}`.trim());
  const heures = (h) => `${nombre(h || 0, 2)} h`;
  const quand = (s) => {
    if (!s) return '';
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    return n > 0 ? `dans ${pluriel(n, 'jour')}` : `il y a ${pluriel(-n, 'jour')}`;
  };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const filtre = { ech: 'urgent', famille: '', q: '', eq: 'actifs', qe: '', bon: 'afaire', qb: '', piece: 'tous', site: '' };
  let annulation = null;
  // Plusieurs sites : site ouvert dans l'onglet Sites, sous-vue (sites ou équipements), liste ou carte, tri, filtres.
  let siteOuvert = null;
  let sousVue = 'sites';
  const pref = stock.lire(CLE_AFFICHAGE) || {};
  const affichage = { mode: pref.mode === 'carte' ? 'carte' : 'liste', tri: { cle: 'etat', sens: 1 }, f: { texte: '', region: '', type: '', etat: '' } };
  const multi = () => !!E?.multiSites;

  // tutorielVu : le guide « Comment ça marche » s'est déjà ouvert seul pour ce compte (synchronisé).
  // Les règles reconstruisent l'état champ par champ : le champ est réinjecté ici.
  const etatVide = () => ({ ...R.etatVide(B.reglages), tutorielVu: false });
  const normaliser = (d) => ({ ...R.normaliser(d, B.reglages), tutorielVu: Boolean(d?.tutorielVu) });
  const equipement = (id) => E.equipements.find((e) => e.id === id);
  const operation = (id) => E.operations.find((o) => o.id === id);
  const bon = (id) => E.interventions.find((i) => i.id === id);
  const piece = (id) => E.pieces.find((p) => p.id === id);
  const nomEq = (id) => { const e = equipement(id); return e ? `${e.repere ? `${e.repere} · ` : ''}${e.nom}` : 'Équipement supprimé'; };
  const famille = (id) => B.familles.find((f) => f.id === id);
  const site = (id) => E.sites.find((x) => x.id === id);
  const nomSite = (id) => site(id)?.nom || 'Sans site';
  const sitesTries = () => [...E.sites].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const typeCourt = (c) => B.typesSites.find((t) => t.code === c)?.court || c || '';
  // Site d'un équipement, préfixé (plusieurs sites seulement).
  const auSite = (eqId) => (multi() ? `${esc(nomSite(equipement(eqId)?.site))} · ` : '');
  // Équipements visibles dans les listes : tous, ou ceux du site filtré (plusieurs sites).
  const dansFiltreSite = (eq) => !multi() || !filtre.site || eq?.site === filtre.site;

  function retenir() { annulation = structuredClone(E); }
  function annuler() {
    if (!annulation) return;
    E = annulation; annulation = null;
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
        const vu = E.tutorielVu;
        E = normaliser(corps.donnees);
        if (vu) E.tutorielVu = true;
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
        toast('Un autre appareil a modifié ta maintenance entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (GMA-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
  // Démo : celle gardée sur cet appareil, sinon l'exemple d'un site ; multiSites (true ou false) impose le modèle.
  function ouvrirDemo(memoriser = true, multiSites = null) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const garde = stock.lire(CLE_DEMO) ? normaliser(stock.lire(CLE_DEMO)) : null;
    E = garde && (multiSites === null || garde.multiSites === multiSites) ? garde : donneesDemo(!!multiSites);
    if (garde && E !== garde && garde.tutorielVu) E.tutorielVu = true;
    siteOuvert = null; filtre.site = '';
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
  // Atelier de mécanique fictif : 11 équipements, 12 mois d'historique simulés avec les vraies règles
  // (relevés hebdomadaires, bons clôturés à l'échéance, parfois en retard), à des dates relatives à
  // aujourd'hui. États forcés : retard à la date (pont roulant), retard au compteur (séparateur du
  // compresseur), bientôt au compteur (graissage du centre d'usinage), bon planifié (révision du chariot),
  // bon en cours (groupe électrogène), fait aujourd'hui (contrôle hebdomadaire), réglementaires à
  // paramétrer, équipement archivé, pannes avec arrêt, pièce sous le seuil, pièce en rupture.
  // Plusieurs sites (multiSites) : le même atelier devient l'un des six sites d'un exploitant fictif (villes servant
  // seulement de repère, coordonnées approximatives d'un centre-ville), avec un arrêt au-delà du seuil, un arrêt
  // récent, un équipement dégradé, un site sans visite depuis plus de 6 mois, un site jamais visité et deux sites
  // sans coordonnées.
  function donneesDemo(multiSites = false) {
    const e = etatVide();
    e.entreprise = multiSites ? 'Exploitation Exemple' : 'Atelier Exemple';
    e.reglages.tauxHoraire = 4500;
    e.familles = ['compresseur', 'usinage', 'chariot', 'levage', 'groupe', 'chaudiere', 'clim', 'porte', 'pompe', 'incendie', ...(multiSites ? ['ascenseur', 'energie', 'electrique'] : [])];
    const S = {};
    if (multiSites) {
      e.multiSites = true;
      // [clé, nom, type, ville, région, responsable, lat, lon]
      for (const [k, nom, type, ville, region, responsable, lat, lon, notes] of [
        ['atelier', 'Atelier de Lyon', 'IND', 'Lyon', 'Auvergne-Rhône-Alpes', 'Responsable A', 45.76, 4.84, ''],
        ['siege', 'Siège et bureaux', 'BUR', 'Grenoble', 'Auvergne-Rhône-Alpes', 'Responsable B', 45.19, 5.72, 'Accueil au rez-de-chaussée, badge visiteur.'],
        ['entrepot', 'Entrepôt Nord', 'ENT', 'Lille', 'Hauts-de-France', 'Responsable C', 50.63, 3.06, ''],
        ['agence', 'Agence Sud', 'COM', 'Marseille', 'Provence-Alpes-Côte d\'Azur', 'Responsable D', 43.3, 5.37, ''],
        ['local', 'Local technique Est', 'TEC', '', 'Grand Est', 'Responsable B', null, null, 'Accès avec badge, prévenir 48 h avant.'],
        ['depot', 'Dépôt Ouest', 'ENT', '', 'Bretagne', 'Responsable C', null, null, ''],
      ]) { S[k] = R.normaliserSite({ id: uid(), nom, type, ville, region, responsable, lat, lon, notes }); e.sites.push(S[k]); }
    }
    const t = auj();
    const j = (n) => ajout(t, n);
    let graine = 61;
    const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let x = Math.imul(graine ^ (graine >>> 15), 1 | graine); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const DEBUT = -365;
    const P = (o) => { const p = R.normaliserPiece({ id: uid(), ...o }); e.pieces.push(p); return p; };
    const fAir = P({ ref: 'CMP-FA', nom: 'Cartouche filtre à air compresseur', unite: 'pièce', emplacement: 'Magasin, étagère 2', fournisseur: 'Fournisseur Exemple', prix: 4850, seuil: 1 });
    const fHuile = P({ ref: 'CMP-FH', nom: 'Filtre à huile compresseur', unite: 'pièce', emplacement: 'Magasin, étagère 2', fournisseur: 'Fournisseur Exemple', prix: 3200, seuil: 1 });
    const huile = P({ ref: 'HUI-CMP', nom: 'Huile compresseur, bidon de 5 L', unite: 'bidon', emplacement: 'Magasin, armoire huiles', fournisseur: 'Fournisseur Exemple', prix: 7400, seuil: 1 });
    const sep = P({ ref: 'CMP-SEP', nom: 'Séparateur air-huile', unite: 'pièce', emplacement: 'Magasin, étagère 2', fournisseur: 'Fournisseur Exemple', prix: 16500, seuil: 0 });
    const graisse = P({ ref: 'GRA-EP2', nom: 'Graisse multi-usages, cartouche', unite: 'cartouche', emplacement: 'Magasin, armoire huiles', fournisseur: 'Distributeur Exemple', prix: 950, seuil: 4 });
    const filtreCli = P({ ref: 'CLI-FIL', nom: 'Filtre unité intérieure clim', unite: 'pièce', emplacement: 'Local technique', fournisseur: 'Distributeur Exemple', prix: 1800, seuil: 2 });
    const cellule = P({ ref: 'POR-CEL', nom: 'Cellule photoélectrique de porte', unite: 'pièce', emplacement: 'Magasin, étagère 4', fournisseur: 'Distributeur Exemple', prix: 6900, seuil: 1 });
    const reception = (p, d, q, note = 'Réception commande') => e.mouvementsPieces.push(R.normaliserMouvement({ id: uid(), piece: p.id, date: j(d), type: 'reception', quantite: q, prix: p.prix, note }));
    reception(fAir, DEBUT, 3); reception(fHuile, DEBUT, 2); reception(huile, DEBUT, 4); reception(sep, DEBUT, 0, 'Stock de départ'); reception(graisse, DEBUT, 10); reception(filtreCli, DEBUT, 6); reception(cellule, DEBUT, 1);
    reception(huile, -120, 2); reception(graisse, -90, 8);

    const specs = [
      { site: 'atelier', repere: 'CMP-01', nom: 'Compresseur à vis 15 kW', famille: 'compresseur', emplacement: 'Local compresseur', criticite: 'A', unite: 'h', initial: 8200, parJour: 9, fabricant: 'Fabricant Exemple', codes: ['cmp-hebdo', 'cmp-filtre', 'cmp-vidange', 'cmp-separateur', 'cmp-reservoir'] },
      { site: 'atelier', repere: 'USI-01', nom: 'Centre d\'usinage vertical', famille: 'usinage', emplacement: 'Atelier, travée 1', criticite: 'A', unite: 'h', initial: 11400, parJour: 7.5, codes: ['usi-graissage', 'usi-coupe', 'usi-geometrie'] },
      { site: 'atelier', repere: 'TOU-02', nom: 'Tour conventionnel', famille: 'usinage', emplacement: 'Atelier, travée 2', criticite: 'C', unite: 'h', initial: 21000, parJour: 2, codes: ['usi-graissage', 'usi-coupe'] },
      { site: 'entrepot', repere: 'CHA-01', nom: 'Chariot élévateur électrique 2,5 t', famille: 'chariot', emplacement: 'Quai d\'expédition', criticite: 'B', unite: 'h', initial: 3100, parJour: 3.2, codes: ['cha-batterie', 'cha-revision', 'cha-vgp'] },
      { site: 'atelier', repere: 'PON-01', nom: 'Pont roulant 5 t', famille: 'levage', emplacement: 'Atelier, travée 1', criticite: 'A', unite: '', codes: ['lev-visuel', 'lev-graissage', 'lev-vgp'] },
      { site: 'atelier', repere: 'GE-01', nom: 'Groupe électrogène de secours', famille: 'groupe', emplacement: 'Extérieur, abri', criticite: 'B', unite: 'h', initial: 410, parJour: 0, codes: ['gro-essai', 'gro-vidange', 'gro-charge'] },
      { site: 'siege', repere: 'CHD-01', nom: 'Chaudière gaz des bureaux', famille: 'chaudiere', emplacement: 'Bureaux, chaufferie', criticite: 'B', unite: '', codes: ['chd-annuel', 'chd-pression'] },
      { site: 'siege', repere: 'CLI-01', nom: 'Climatisation de la salle serveur', famille: 'clim', emplacement: 'Bureaux, salle serveur', criticite: 'A', unite: '', codes: ['cli-filtres', 'cli-exterieur', 'cli-legal'] },
      { site: 'entrepot', repere: 'POR-01', nom: 'Porte sectionnelle du quai', famille: 'porte', emplacement: 'Quai d\'expédition', criticite: 'B', unite: 'cycles', initial: 30500, parJour: 26, codes: ['por-securites', 'por-entretien', 'por-ressorts'] },
      { site: 'atelier', repere: 'POM-01', nom: 'Pompe de relevage', famille: 'pompe', emplacement: 'Extérieur, regard sud', criticite: 'C', unite: 'h', initial: 5200, parJour: 1.1, codes: ['pom-controle', 'pom-nettoyage'] },
      { site: 'siege', repere: 'INC-01', nom: 'Extincteurs du site (12 appareils)', famille: 'incendie', emplacement: 'Tout le site', criticite: 'A', unite: '', codes: ['inc-extincteurs', 'inc-baes'] },
      { site: 'atelier', repere: 'TOU-01', nom: 'Ancien tour (réformé)', famille: 'usinage', emplacement: 'Réserve', criticite: 'C', unite: 'h', initial: 30000, parJour: 0, codes: ['usi-graissage'], archive: true, note: 'Réformé, en attente de revente.' },
      ...(multiSites ? [
        { site: 'siege', repere: 'ASC-01', nom: 'Ascenseur du siège', famille: 'ascenseur', emplacement: 'Hall', criticite: 'A', unite: '', codes: ['asc-essai', 'asc-entretien'] },
        { site: 'entrepot', repere: 'POR-02', nom: 'Porte sectionnelle quai 2', famille: 'porte', emplacement: 'Quai de réception', criticite: 'B', unite: 'cycles', initial: 18200, parJour: 19, codes: ['por-securites', 'por-ressorts'] },
        { site: 'agence', repere: 'CLI-02', nom: 'Climatisation de la surface de vente', famille: 'clim', emplacement: 'Toiture', criticite: 'A', unite: '', codes: ['cli-filtres', 'cli-exterieur', 'cli-legal'] },
        { site: 'agence', repere: 'BOR-01', nom: 'Bornes de recharge du parking', famille: 'energie', emplacement: 'Parking clients', criticite: 'C', unite: '', codes: ['ene-visuel', 'ene-entretien'] },
        { site: 'local', repere: 'ELE-01', nom: 'Tableau général basse tension', famille: 'electrique', emplacement: 'Local TGBT', criticite: 'A', unite: '', codes: ['ele-verif'] },
        { site: 'depot', repere: 'POR-03', nom: 'Portail coulissant', famille: 'porte', emplacement: 'Entrée du dépôt', criticite: 'C', unite: '', codes: ['por-entretien'] },
      ] : []),
    ];
    const eqs = {};
    for (const s of specs) {
      const eq = R.normaliserEquipement({ id: uid(), site: multiSites ? S[s.site].id : '', repere: s.repere, nom: s.nom, famille: s.famille, emplacement: s.emplacement, criticite: s.criticite, unite: s.unite, compteurInitial: s.initial ?? 0, miseEnService: j(DEBUT - 30), fabricant: s.fabricant || 'Fabricant Exemple', archive: !!s.archive, note: s.note || '' });
      e.equipements.push(eq);
      eqs[s.repere] = { eq, s, cpt: s.initial ?? 0 };
      const ops = R.planDepuisFamille(B, s.famille, { equipement: eq.id, depuis: j(DEBUT - 30), depuisCompteur: s.initial ?? 0, codes: s.codes, id: uid });
      e.operations.push(...ops);
    }
    const op = (rep, code) => e.operations.find((o) => o.equipement === eqs[rep].eq.id && o.code === code);
    // Pièces prévues dans les plans.
    op('CMP-01', 'cmp-filtre').pieces = [{ piece: fAir.id, quantite: 1 }];
    op('CMP-01', 'cmp-vidange').pieces = [{ piece: fHuile.id, quantite: 1 }, { piece: huile.id, quantite: 2 }];
    op('CMP-01', 'cmp-separateur').pieces = [{ piece: sep.id, quantite: 1 }];
    op('USI-01', 'usi-graissage').pieces = [{ piece: graisse.id, quantite: 1 }];
    op('PON-01', 'lev-graissage').pieces = [{ piece: graisse.id, quantite: 2 }];
    op('CLI-01', 'cli-filtres').pieces = [{ piece: filtreCli.id, quantite: 2 }];
    op('CMP-01', 'cmp-separateur').depuisCompteur = 6000;
    // Sous-traitance par opération (montants fictifs HT, en centimes).
    const ST = { 'usi-geometrie': 68000, 'cha-revision': 42000, 'gro-vidange': 39000, 'gro-charge': 52000, 'chd-annuel': 21000, 'cli-legal': 34000, 'por-entretien': 26000, 'por-ressorts': 18000 };
    // Opérations oubliées à partir d'un jour donné (états forcés).
    const OUBLI = { [op('PON-01', 'lev-visuel').id]: -50, [op('CMP-01', 'cmp-separateur').id]: -400 };
    const SAUTE = new Set([op('CHA-01', 'cha-revision').id, op('GE-01', 'gro-vidange').id].filter(Boolean));
    const cloturerSim = (o, d, retard = 0) => {
      const eqx = Object.values(eqs).find((x) => x.eq.id === o.equipement);
      const jour = Math.min(-1, d + retard);
      const b = R.preparerBon(e, o, j(jour), { id: uid(), datePrevue: j(d) });
      b.statut = 'fait'; b.dateRealisee = j(jour);
      b.compteur = eqx.eq.unite ? Math.round(eqx.cpt) : null;
      b.intervenant = o.qui === 'prestataire' ? 'Prestataire Exemple' : (alea() < 0.5 ? 'Technicien A' : 'Technicien B');
      b.points.forEach((p) => { p.fait = true; });
      b.sousTraitance = ST[o.code] || 0;
      if (b.sousTraitance) b.mainOeuvre = 0;
      e.interventions.push(b);
    };
    for (let d = DEBUT; d <= -1; d++) {
      const js = versDate(j(d)).getDay();
      for (const x of Object.values(eqs)) {
        if (x.eq.unite && js !== 0 && js !== 6) x.cpt += x.s.parJour * (0.7 + alea() * 0.6);
        if (x.eq.unite && js === 1 && !x.eq.archive && x.s.parJour > 0) e.releves.push(R.normaliserReleve({ id: uid(), equipement: x.eq.id, date: j(d), valeur: Math.round(x.cpt) }));
      }
      if (js === 0 || js === 6) continue;
      for (const o of e.operations) {
        if (o.p && o.p[1] === 'j') continue;
        if (OUBLI[o.id] !== undefined && d >= OUBLI[o.id]) continue;
        const eqx = Object.values(eqs).find((x) => x.eq.id === o.equipement);
        if (eqx.eq.archive && d > -200) continue;
        const ech = R.echeance(e, o, j(d), eqx.eq);
        if (ech.etat === 'parametrer' || ech.etat === 'suspendu') continue;
        const du = (ech.echDate && ech.echDate <= j(d)) || (ech.reste !== null && ech.reste <= 0);
        if (!du) continue;
        if (SAUTE.has(o.id) && d > -40) continue;
        if (o.code === 'cmp-hebdo' && d > -3) continue;
        const retard = alea() < 0.2 ? Math.round(2 + alea() * 12) : 0;
        cloturerSim(o, d, retard);
      }
    }
    // Groupe électrogène : quelques heures d'essai par mois.
    eqs['GE-01'].cpt = 410 + 14;
    e.releves.push(R.normaliserReleve({ id: uid(), equipement: eqs['GE-01'].eq.id, date: j(-3), valeur: 424 }));
    // Fait aujourd'hui : contrôle hebdomadaire du compresseur.
    const hebdo = op('CMP-01', 'cmp-hebdo');
    const bh = R.preparerBon(e, hebdo, t, { id: uid() });
    Object.assign(bh, { statut: 'fait', dateRealisee: t, compteur: Math.round(eqs['CMP-01'].cpt), intervenant: 'Technicien A', duree: 0.25, constat: 'RAS, purge faite.' });
    bh.points.forEach((p) => { p.fait = true; });
    e.interventions.push(bh);
    e.releves.push(R.normaliserReleve({ id: uid(), equipement: eqs['CMP-01'].eq.id, date: t, valeur: Math.round(eqs['CMP-01'].cpt) }));
    // Bon planifié : révision du chariot dans 5 jours.
    const br = R.preparerBon(e, op('CHA-01', 'cha-revision'), t, { id: uid(), datePrevue: j(5) });
    br.intervenant = 'Prestataire Exemple';
    e.interventions.push(br);
    // Bon en cours : vidange du groupe électrogène.
    const bg = R.preparerBon(e, op('GE-01', 'gro-vidange'), t, { id: uid(), datePrevue: j(-2) });
    Object.assign(bg, { statut: 'encours', intervenant: 'Prestataire Exemple' });
    bg.points[0].fait = true;
    e.interventions.push(bg);
    // Pannes (correctifs) avec arrêt.
    // Panne résolue (fin : jours de résolution après le signalement ; arrêt en heures, équipement arrêté si > 0).
    const panne = (rep, d, titre, motif, duree, arret, piecesU = [], st = 0, constat = '', fin = 0) => {
      const x = eqs[rep];
      const b = R.normaliserIntervention({ id: uid(), numero: R.numeroBon(e, j(d + fin)), equipement: x.eq.id, type: 'correctif', statut: 'fait', titre, motif, dateSignalee: j(d), datePrevue: j(d), dateRealisee: j(d + fin), duree, arret, arretEq: arret > 0, intervenant: st ? 'Prestataire Exemple' : 'Technicien B', sousTraitance: st, symptome: titre, constat, pieces: piecesU.map(([p, q]) => ({ piece: p.id, quantite: q, prix: p.prix })) });
      if (x.eq.unite) b.compteur = R.compteurActuel(R.pointsCompteur(e, x.eq), j(d));
      e.interventions.push(b);
    };
    panne('CMP-01', -142, 'Fuite d\'air au raccord du sécheur', 'Fuite', 1.5, 2, [], 0, 'Raccord remplacé, réseau remis en pression.');
    panne('POR-01', -64, 'La porte se rouvre seule en fermeture', 'Défaut électrique', 1, 3, [[cellule, 1]], 0, 'Cellule photoélectrique remplacée, sécurités essayées.');
    panne('USI-01', -23, 'Alarme de lubrification centralisée', 'Encrassement', 2.5, 6, [[graisse, 1]], 0, 'Doseur bouché nettoyé, circuit purgé.');
    panne('CLI-01', -200, 'Température haute en salle serveur', 'Usure', 3, 0, [], 46000, 'Ventilateur de l\'unité extérieure remplacé par le prestataire.', 1);
    // Panne ouverte qui ne l'arrête pas (pompe dégradée) et panne ouverte qui arrête le tour depuis 2 jours.
    const ouverte = (rep, d, titre, motif, arretEq, prevue, symptome, intervenant) => e.interventions.push(R.normaliserIntervention({ id: uid(), numero: R.numeroBon(e, j(d)), equipement: eqs[rep].eq.id, type: 'correctif', statut: prevue > 0 ? 'planifie' : 'encours', titre, motif, dateSignalee: j(d), datePrevue: j(prevue), arretEq, symptome, intervenant }));
    ouverte('POM-01', -1, 'Bruit anormal au démarrage', 'Cause inconnue', false, 2, 'Bruit métallique au démarrage, signalé par l\'équipe du matin.', 'Technicien A');
    ouverte('TOU-02', -2, 'Broche bloquée en rotation lente', 'Défaut électrique', true, -2, 'Variateur en défaut au démarrage de la broche.', 'Technicien B');
    if (multiSites) {
      // Arrêt au-delà du seuil (quai 2 depuis 12 jours), arrêt récent (ascenseur), pannes résolues sur d'autres sites.
      ouverte('POR-02', -12, 'Moteur bloqué, porte fermée', 'Casse', true, -12, 'Le moteur ne répond plus, porte bloquée en position fermée.', 'Prestataire Exemple');
      ouverte('ASC-01', -3, 'Arrêt en défaut de porte palière', 'Défaut électrique', true, -3, 'Cabine bloquée au 2e étage, personne à bord.', 'Prestataire Exemple');
      panne('ASC-01', -48, 'Bouton d\'appel hors service', 'Usure', 1, 48, [], 14000, 'Bouton remplacé par l\'ascensoriste.', 2);
      panne('CLI-02', -130, 'Compresseur en panne', 'Usure', 6, 216, [], 235000, 'Compresseur remplacé, charge de fluide refaite.', 9);
      panne('BOR-01', -25, 'Borne n° 2 hors service', 'Défaut électrique', 1, 0, [], 26000, 'Carte de charge remplacée.', 3);
      // Visites de site (tournées) : le local technique n'a plus été visité depuis plus de 6 mois, le dépôt jamais.
      for (const [k, d, cout, note] of [['atelier', -6, 0, 'Tournée du responsable'], ['siege', -20, 0, 'Tournée du responsable'], ['entrepot', -40, 0, 'Tournée du responsable'], ['agence', -95, 0, 'Tournée du responsable'], ['local', -230, 12000, 'Visite du prestataire électricité']]) {
        e.visites.push(R.normaliserVisite({ id: uid(), site: S[k].id, date: j(d), intervenant: cout ? 'Prestataire Exemple' : 'Responsable', note, cout }));
      }
    }
    // Pièce en rupture : la cellule a été consommée ; filtre à air sous le seuil après la dernière réception.
    reception(fAir, -30, 1);
    reception(filtreCli, -100, 4);
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Maintenance préventive · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <circle cx="110" cy="160" r="90" fill="#1D4E89"/>
          <circle cx="110" cy="160" r="34" fill="#F0EDE6"/>
          <rect x="230" y="40" width="110" height="110" fill="#F5B400"/>
          <rect x="230" y="170" width="110" height="110" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="460" cy="150" r="100" fill="#F0EDE6"/>
          <path d="M460 150 L460 50 A100 100 0 0 1 560 150 Z" fill="#D9302A"/>
          <rect x="430" y="160" width="60" height="60" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Maintenance préventive</p>
          <h1>Chaque machine entretenue à temps.</h1>
          <p>Tes équipements, leurs plans de maintenance, les échéances à la date ou au compteur, les bons d'intervention et le coût de chaque machine, sans tableur. Sur un site ou sur plusieurs.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta maintenance</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma maintenance</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <button class="btn lien" type="button" data-action="demo-multi">ou l'exemple à plusieurs sites</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/maintenance/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
      </section>
    </div>`;
    const champ = $('#code');
    champ.addEventListener('input', () => {
      const pos = champ.selectionStart === champ.value.length;
      champ.value = formaterCode(champ.value);
      if (pos) champ.setSelectionRange(champ.value.length, champ.value.length);
    });
    $('#form-code').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = formaterCode(champ.value);
      const err = $('#erreur-code');
      const bouton = ev.target.querySelector('button[type=submit]');
      if (!codeComplet(code) && code !== CODE_DEMO) { err.textContent = 'Clé incomplète : elle compte 4 blocs de 8 caractères (copie-la depuis l\'e-mail de Gumroad).'; champ.focus(); return; }
      bouton.disabled = true; bouton.textContent = 'Vérification…'; err.textContent = '';
      try { await connecter(code, $('#memoriser').checked); } catch (x) {
        err.textContent = x.message === 'Failed to fetch' ? 'Pas de connexion internet. Réessaie une fois en ligne.' : x.message;
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma maintenance'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, entreprise: '', taux: '', familles: [], multi: false, site: '' };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>On organise ta maintenance.</h1>
        <p class="intro">Tu crées tes équipements avec leur plan de maintenance ; les échéances se calculent à la date, au compteur ou au premier atteint. Chaque intervention se note sur un bon, qui recale l'échéance suivante et chiffre le coût. Rien n'est relié à un capteur ni à un autre logiciel.</p>
        <div class="rang-champs" style="max-width:720px;margin-top:20px">
          <label class="champ">Atelier, site ou service <small>Repris sur les bons imprimés.</small><input id="entreprise" value="${esc(a.entreprise)}" autocomplete="organization" maxlength="80"></label>
          <label class="champ">Taux horaire interne HT <small>Facultatif : chiffre la main-d'œuvre.</small><input id="taux" value="${esc(a.taux)}" inputmode="decimal" placeholder="Ex. : 45"></label>
        </div>
        <fieldset class="champ modele-parc" style="max-width:720px;margin-top:20px"><legend>Ton parc <small>Modifiable ensuite dans les réglages.</small></legend>
          <div class="choix-statut deux"><label><input type="radio" name="modele" value="un" ${a.multi ? '' : 'checked'}><span>Un site</span></label><label><input type="radio" name="modele" value="plusieurs" ${a.multi ? 'checked' : ''}><span>Plusieurs sites</span></label></div>
          <p class="aide" id="aide-modele">${a.multi ? 'Tes équipements seront rangés par site : vue d\'ensemble, alertes, disponibilité et coût par site, carte schématique.' : 'Tous tes équipements au même endroit. Tu pourras passer à plusieurs sites plus tard, sans rien perdre.'}</p>
          <label class="champ" id="champ-site" ${a.multi ? '' : 'hidden'}>Nom du premier site<input id="site-1" value="${esc(a.site)}" maxlength="80" placeholder="Ex. : Atelier de Lyon"></label>
        </fieldset>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Tes familles d'équipements</h1>
        <p class="intro">Coche celles que tu as : à la création d'un équipement, leur plan de maintenance type te sera proposé, à ajuster selon la notice du fabricant. Tu pourras en ajouter d'autres plus tard.</p>
        <div class="choix-familles">${B.familles.map((f) => `<label><input type="checkbox" name="famille" value="${f.id}" ${a.familles.includes(f.id) ? 'checked' : ''}><span><b>${esc(f.nom)}</b><small>${pluriel(f.plan.length, 'opération')} type${f.plan.length > 1 ? 's' : ''}${f.compteur ? ` · compteur en ${esc(uniteCourte(f.compteur))}` : ''}</small></span></label>`).join('')}</div>
        <p class="aide" style="max-width:720px;margin-top:16px">Les périodicités proposées sont des repères indicatifs. Les vérifications réglementaires (levage, pression, électricité, incendie…) arrivent sans périodicité : tu la saisis avec la référence de ton texte. Seules deux obligations sourcées sont préremplies (chaudières, climatisations et pompes à chaleur).</p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer ma maintenance</button>
        </div>`;
    }
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    $('#entreprise')?.addEventListener('input', (ev) => { accueil.entreprise = ev.target.value; });
    $('#taux')?.addEventListener('input', (ev) => { accueil.taux = ev.target.value; });
    $('#site-1')?.addEventListener('input', (ev) => { accueil.site = ev.target.value; });
    document.querySelectorAll('[name=modele]').forEach((el) => el.addEventListener('change', () => {
      accueil.multi = $('[name=modele]:checked').value === 'plusieurs';
      $('#champ-site').hidden = !accueil.multi;
      $('#aide-modele').textContent = accueil.multi ? 'Tes équipements seront rangés par site : vue d\'ensemble, alertes, disponibilité et coût par site, carte schématique.' : 'Tous tes équipements au même endroit. Tu pourras passer à plusieurs sites plus tard, sans rien perdre.';
    }));
    document.querySelectorAll('[name=famille]').forEach((el) => el.addEventListener('change', () => { accueil.familles = [...document.querySelectorAll('[name=famille]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    const t = R.lireMontant(accueil.taux);
    E.reglages.tauxHoraire = Number.isFinite(t) ? t : 0;
    E.familles = accueil.familles;
    if (accueil.multi) { E = R.activerMultiSites(E, accueil.site.trim() || E.entreprise || 'Site principal'); siteOuvert = E.sites[0].id; }
    const plusieurs = accueil.multi;
    accueil = { etape: 1, entreprise: '', taux: '', familles: [], multi: false, site: '' };
    vue = plusieurs ? 'sites' : 'equipements';
    sauver();
    demarrer();
    toast(plusieurs ? `Ta maintenance est prête. Crée le premier équipement de « ${E.sites[0].nom} ».` : 'Ta maintenance est prête. Crée ton premier équipement.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    echeancier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    equipements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    interventions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    pieces: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    aide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.7v.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.4" r="1.4" fill="currentColor"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
    sites: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Z" fill="currentColor"/><circle cx="12" cy="9" r="2.6" fill="var(--papier)"/></svg>',
  };
  // Avec plusieurs sites, l'onglet Sites remplace Équipements (cinq onglets au plus sur téléphone) : il montre les
  // sites (liste ou carte) et, au choix, tous les équipements rangés par site.
  const ONGLETS_UN = [['tableau', 'Tableau de bord'], ['echeancier', 'Échéancier'], ['equipements', 'Équipements'], ['interventions', 'Interventions'], ['pieces', 'Pièces']];
  const ONGLETS_MULTI = [['tableau', 'Vue d\'ensemble'], ['echeancier', 'Échéancier'], ['sites', 'Sites'], ['interventions', 'Interventions'], ['pieces', 'Pièces']];
  const onglets = () => (multi() ? ONGLETS_MULTI : ONGLETS_UN);
  const COURTS = { tableau: 'Tableau', interventions: 'Bons' };
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'organisation de la maintenance : les périodicités des plans types sont des repères indicatifs (la notice du fabricant prime) et la liste des vérifications réglementaires n\'est pas exhaustive. Leur périodicité se saisit d\'après le texte applicable ; la conformité de ton site reste de ta responsabilité.</p>';
  const COULEUR_ETAT = { retard: 'rouge', bientot: 'jaune', bon: 'ciel', avenir: 'sable', plustard: 'sable', parametrer: 'rose', suspendu: 'sable' };
  const etiquetteEtat = (s) => `<span class="etiquette ${COULEUR_ETAT[s]}">${R.LIB_ETAT[s]}</span>`;
  const COULEUR_BON = { planifie: 'ciel', encours: 'jaune', fait: 'vert', annule: 'sable' };
  const etiquetteBon = (s) => `<span class="etiquette ${COULEUR_BON[s]}">${R.STATUTS_BON[s]}</span>`;
  const etiquetteNature = (n) => (n === 'reglementaire' ? '<span class="etiquette rose">Réglementaire</span>' : n === 'controle' ? '<span class="etiquette sable">Contrôle</span>' : '');
  const etiquetteCrit = (c) => `<span class="crit crit-${c}" title="Criticité ${c} : ${esc(B.criticites.find((x) => x.code === c)?.nom || '')}">${c}</span>`;

  // Vue cohérente avec le modèle : « equipements » devient l'onglet Sites (sous-vue Équipements) avec plusieurs sites.
  function vueValide(v) {
    if (multi() && v === 'equipements') { sousVue = 'equipements'; return 'sites'; }
    if (!multi() && v === 'sites') return 'equipements';
    return v;
  }
  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if ([...ONGLETS_UN, ...ONGLETS_MULTI].some(([id]) => id === depuisUrl)) vue = depuisUrl;
    vue = vueValide(vue);
    if (siteOuvert && !multi()) siteOuvert = null;
    if (siteOuvert && !site(siteOuvert)) siteOuvert = null;
    if (filtre.site && (!multi() || !site(filtre.site))) filtre.site = '';
    $('#racine').innerHTML = `
      ${session.demo ? `<div class="bandeau-demo"><div><b>Mode démo</b><span>Données d'exemple${multi() ? ' à plusieurs sites' : ''}, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="demo-bascule">${multi() ? 'Exemple à un site' : 'Exemple à plusieurs sites'}</button><button data-action="deconnexion">J'ai un code d'accès</button></div></div>` : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Maintenance<br>préventive</span>
        <nav class="onglets" aria-label="Sections">${onglets().map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
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
    vue = vueValide(vue);
    if (siteOuvert && !site(siteOuvert)) siteOuvert = null;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = Object.fromEntries(onglets());
    document.title = `${vue === 'sites' && siteOuvert ? nomSite(siteOuvert) : vue === 'sites' && sousVue === 'equipements' ? 'Équipements' : titres[vue]} · Maintenance préventive`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, echeancier: vueEcheancier, equipements: vueEquipements, interventions: vueInterventions, pieces: vuePieces,
      sites: () => (siteOuvert ? vueSite(site(siteOuvert)) : sousVue === 'equipements' ? vueEquipements() : vueSites()) }[vue]();
    brancherInfobulles();
    brancherSites();
    for (const [sel, cle] of [['#recherche-ech', 'q'], ['#recherche-eq', 'qe'], ['#recherche-bon', 'qb'], ['#f-texte', null]]) {
      const q = $(sel);
      if (q) q.addEventListener('input', (ev) => { if (cle) filtre[cle] = ev.target.value; else affichage.f.texte = ev.target.value; const pos = ev.target.selectionStart; rendre(); const n = $(sel); n.focus(); n.setSelectionRange(pos, pos); });
    }
    $('#filtre-famille')?.addEventListener('change', (ev) => { filtre.famille = ev.target.value; rendre(); });
    document.querySelectorAll('.filtre-site-choix').forEach((el) => el.addEventListener('change', (ev) => { filtre.site = ev.target.value; rendre(); }));
  }

  function changerVue(v) {
    if (v !== 'sites') siteOuvert = null;
    vue = vueValide(v);
    history.replaceState(null, '', `#${vue}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="30" cy="66" r="30" fill="#1D4E89"/><circle cx="30" cy="66" r="11" fill="#F0EDE6"/><rect x="56" y="10" width="40" height="40" fill="#F5B400"/><rect x="62" y="58" width="32" height="32" fill="#D9302A"/></svg>';

  // ---------- Lignes d'échéance (communes) ----------
  function ligneEcheance(x, { avecEq = true } = {}) {
    const u = x.eq?.unite;
    const pastille = x.urgence === 'retard' ? 'retard' : x.urgence === 'bientot' ? 'alerte' : '';
    const dateP = x.prevue;
    const detail = [];
    if (x.mode === 'aucun') detail.push(x.op.nature === 'reglementaire' ? 'Périodicité réglementaire à saisir' : 'Périodicité à saisir');
    else {
      detail.push(R.libelleEcheance(x, uniteCourte(u)));
      if (x.reste !== null) detail.push(x.reste <= 0 ? `dépassé de ${cpt(-x.reste, u)}` : `reste ${cpt(x.reste, u)}${x.dateEstimee ? ` (≈ ${dateCourte(x.dateEstimee)})` : ''}`);
    }
    if (x.bon) detail.push(`bon ${esc(x.bon.numero)} ${x.bon.statut === 'encours' ? 'en cours' : `prévu le ${dateCourte(x.bon.datePrevue)}`}`);
    const actions = x.etat === 'suspendu' ? '' : x.bon
      ? `<button class="btn petit" data-action="voir-bon" data-id="${x.bon.id}">Voir le bon</button>`
      : x.mode === 'aucun' ? `<button class="btn petit" data-action="modifier-op" data-id="${x.op.id}">Paramétrer</button>`
      : `<button class="btn petit" data-action="ouvrir-bon" data-id="${x.op.id}">Ouvrir un bon</button><button class="btn petit" data-action="fait-op" data-id="${x.op.id}">Fait</button>`;
    return `<li class="ligne-ech ${x.urgence === 'retard' && x.etat !== 'suspendu' ? 'alerte-depasse' : x.urgence === 'bientot' ? 'alerte-proche' : ''}">
      <span class="date-pastille ${pastille}">${dateP ? `<b>${versDate(dateP).getDate()}</b>${fmt(dateP, { month: 'short' }).replace('.', '')}` : '<b>?</b>date'}</span>
      <button class="lien-ligne" data-action="voir-eq" data-id="${x.eq?.id || ''}"><b>${esc(x.op.nom)}</b><span>${avecEq ? `${auSite(x.op.equipement)}${esc(nomEq(x.op.equipement))} · ` : ''}${detail.join(' · ')}</span>
        <span class="ligne-etiquettes">${etiquetteEtat(x.etat)}${x.etat === 'bon' && x.urgence === 'retard' ? etiquetteEtat('retard') : ''}${etiquetteNature(x.op.nature)}${dateP && x.etat !== 'parametrer' && !(x.reste !== null && x.reste <= 0 && !x.echDate) ? `<span class="quand">${quand(dateP)}</span>` : ''}</span></button>
      <span class="actions-ligne">${actions}</span></li>`;
  }

  // ---------- Tableau de bord (vue d'ensemble avec plusieurs sites) ----------
  const ETAT_EQ = { service: ['ciel', 'En service'], degrade: ['jaune', 'Dégradé'], arret: ['rouge', 'À l\'arrêt'], reforme: ['sable', 'Réformé'] };
  const etiquetteEq = (code) => `<span class="etiquette ${ETAT_EQ[code][0]}">${ETAT_EQ[code][1]}</span>`;
  const ETAT_SITE = { retard: ['rouge', 'En retard'], proche: ['jaune', 'À surveiller'], ok: ['ciel', 'À jour'] };
  const etiquetteSite = (et) => `<span class="etiquette ${ETAT_SITE[et][0]}">${ETAT_SITE[et][1]}</span>`;
  const pctDispo = (x, d = 1) => (x === null || x === undefined ? '–' : `${nombre(x * 100, d)} %`);
  const nbJ = (x) => (x === null || x === undefined ? '–' : `${nombre(x, 1)} j`);

  // Alerte de pilotage : équipement à l'arrêt (ouvre la panne) ou site sans visite (ouvre le site).
  function ligneAlerte(a) {
    const eq = a.equipement ? equipement(a.equipement) : null;
    const pastille = a.type === 'visite'
      ? `<span class="date-pastille ${a.etat === 'retard' ? 'retard' : 'alerte'}"><b>${a.derniere ? `${Math.max(E.reglages.visiteMois, Math.floor(ecart(a.derniere, auj()) / 30.4))}` : '0'}</b>${a.derniere ? 'mois' : 'visite'}</span>`
      : `<span class="date-pastille ${a.etat === 'retard' ? 'retard' : 'alerte'}"><b>${a.jours}</b>${a.jours > 1 ? 'jours' : 'jour'}</span>`;
    const act = a.type === 'arret' ? `data-action="voir-bon" data-id="${a.bon}"` : `data-action="voir-site" data-id="${a.site}"`;
    const quoi = eq ? `${esc(nomEq(eq.id))}${multi() ? ` · ${esc(nomSite(a.site))}` : ''}` : esc(nomSite(a.site));
    return `<li>${pastille}<button class="lien-ligne" ${act}><b>${esc(a.titre)} · ${quoi}</b><span>${esc(a.detail)}</span>
      <span class="ligne-etiquettes">${a.type === 'arret' ? etiquetteEq('arret') : '<span class="etiquette sable">Visite</span>'}${a.etat === 'retard' ? etiquetteEtat('retard') : ''}</span></button>
      <span class="actions-ligne">${a.type === 'visite' ? `<button class="btn petit" data-action="nouvelle-visite" data-id="${a.site}">Noter une visite</button>` : `<button class="btn petit" data-action="cloturer" data-id="${a.bon}">Résoudre</button>`}</span></li>`;
  }

  function vueTableau() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>${multi() ? 'Vue d\'ensemble' : 'Tableau de bord'}</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}${multi() ? `${pluriel(E.sites.filter((x) => !x.inactif).length, 'site')} : ce qui est en retard, ce qui est arrêté, et ce que coûte chaque site.` : 'Ce qui est en retard, ce qui arrive, et ce que coûte ta maintenance.'}</p></div>
        <div class="actions">${multi() ? `<button class="btn" data-action="nouvelle-visite">Noter une visite</button>` : ''}<button class="btn" data-action="nouveau-correctif">${ICONES.plus}Signaler une panne</button><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Nouvel équipement</button></div></div>`;
    if (!E.equipements.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun équipement pour l'instant</h3><p>Crée tes équipements (repère, nom, emplacement, compteur) : le plan de maintenance type de leur famille t'est proposé, puis les échéances se calculent.${multi() ? ' Avec plusieurs sites, chaque équipement est rangé dans son site.' : ''}</p><div class="actions"><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Créer un équipement</button>${multi() ? '<button class="btn" data-action="import">Importer (CSV)</button>' : ''}</div></div></div>${AVERTISSEMENT}`;
    }
    const ind = R.indicateurs(E, t);
    const bil = R.bilan(E, t);
    const ech = R.echeances(E, t).filter((x) => x.etat !== 'suspendu');
    const al = R.alertes(E, t);
    const urgents = ech.filter((x) => x.urgence === 'retard' || x.urgence === 'bientot');
    const couts = R.coutsParEquipement(E, t);
    const total12 = couts.reduce((s2, x) => s2 + x.total, 0), corr12 = couts.reduce((s2, x) => s2 + x.correctif, 0);
    const ouverts = E.interventions.filter((i) => i.statut === 'planifie' || i.statut === 'encours').sort((a, b) => (a.datePrevue || '').localeCompare(b.datePrevue || ''));
    const pieces = E.pieces.map((p) => R.situationPiece(E, p, t)).filter((s2) => s2.statut !== 'ok' && (s2.equipements.length || s2.piece.seuil > 0));
    const aParam = ech.filter((x) => x.etat === 'parametrer').length;
    const tuile = ([lib, v, d, c, f, act]) => `<${act ? `button type="button" data-action="${act}"` : 'div'} class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></${act ? 'button' : 'div'}>`;
    const tuiles = multi() ? [
      ['Sites', String(E.sites.filter((x) => !x.inactif).length), `${pluriel(bil.equipements, 'équipement')} suivi${bil.equipements > 1 ? 's' : ''}`, 'var(--encre)', 'rond', 'aller-sites'],
      ['En retard', String(ind.retards), `${pluriel(ind.bientot, 'autre')} bientôt`, 'var(--rouge)', '', 'aller-retards'],
      ['À l\'arrêt', String(bil.arret), bil.degrade ? `${pluriel(bil.degrade, 'autre')} dégradé${bil.degrade > 1 ? 's' : ''}` : 'Aucun équipement dégradé', 'var(--jaune)', '', 'aller-arrets'],
      ['Disponibilité', pctDispo(bil.disponibilite), `Moyenne du parc, ${bil.jours} derniers jours`, 'var(--bleu)', 'rond', ''],
      ['Coût sur 12 mois', euros(bil.cout, { centimes: false }), bil.cout ? `dont ${pct(bil.parType.correctif / bil.cout * 100)} en correctif` : 'Clôture des bons pour le chiffrer', 'var(--encre)', '', ''],
    ].map(tuile).join('') : [
      ['En retard', String(ind.retards), ind.retards ? `${pluriel(ind.retards, 'opération')} dont l'échéance est passée` : 'Aucune échéance dépassée', 'var(--rouge)', 'rond'],
      ['Bientôt', String(ind.bientot), `sous ${pluriel(E.reglages.alerteJours, 'jour')} au plus, à la date ou au compteur estimé`, 'var(--jaune)', ''],
      ['Réalisation du préventif', pct(ind.taux), `${ind.jours} derniers jours · ${pluriel(ind.faits, 'bon')} fait${ind.faits > 1 ? 's' : ''}${ind.ponctualite !== null ? ` · ${pct(ind.ponctualite)} à l'heure` : ''}`, 'var(--bleu)', ''],
      ['Coût sur 12 mois', euros(total12, { centimes: false }), total12 ? `dont ${pct(corr12 / total12 * 100)} en correctif` : 'Clôture des bons pour le chiffrer', 'var(--encre)', 'rond'],
    ].map(tuile).join('');
    const parSite = multi() ? R.lignesSites(E, t) : [];
    return `${titre}
      <div class="tuiles ${multi() ? 'tuiles-5' : ''}">${tuiles}</div>
      ${aParam ? `<button class="bandeau-info" data-action="filtre-ech" data-ech="parametrer"><span class="etiquette rose">À paramétrer</span><b>${pluriel(aParam, 'opération')} sans périodicité</b><span>Vérifications réglementaires : saisis la périodicité de ton texte pour les suivre.</span></button>` : ''}
      ${al.length ? `<h2 class="titre-section">Alertes <span>${multi() ? 'Équipements à l\'arrêt et sites sans visite, retards d\'abord' : 'Équipements à l\'arrêt, retards d\'abord'}</span></h2><ul class="journal alertes">${al.map(ligneAlerte).join('')}</ul>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>En retard, puis bientôt</span></h2>
          ${urgents.length ? `<ul class="lignes-ech">${urgents.slice(0, 8).map((x) => ligneEcheance(x)).join('')}</ul>${urgents.length > 8 ? `<button class="btn lien" data-action="filtre-ech" data-ech="urgent">Voir les ${urgents.length} échéances</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien d\'urgent</h3><p>Aucune échéance en retard ni sous le délai d\'alerte.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Bons ouverts <span>${pluriel(ouverts.length, 'bon')}</span></h2>
          ${ouverts.length ? `<ul class="journal">${ouverts.slice(0, 6).map(ligneBon).join('')}</ul>${ouverts.length > 6 ? `<button class="btn lien" data-action="filtre-bon" data-bon="afaire">Voir les ${ouverts.length} bons ouverts</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Aucun bon ouvert</h3><p>Ouvre un bon depuis une échéance, ou signale une panne.</p></div></div>'}
          ${pieces.length ? `<h2 class="titre-section">Pièces à commander <span>Sous le seuil ou en rupture</span></h2><ul class="journal">${pieces.map(lignePieceCourte).join('')}</ul>` : ''}
        </section>
      </div>
      ${multi() ? `<h2 class="titre-section">Par site <span>État, disponibilité et pannes sur ${bil.jours} jours, coût sur 12 mois. Touche un site pour l'ouvrir.</span></h2>
      ${tableauSites(parSite, true)}
      <h2 class="titre-section">Coût de maintenance par site <span>12 derniers mois : préventif, correctif et visites</span></h2>
      ${graphiqueCouts([...parSite].sort((a, b) => b.ind.cout - a.ind.cout).filter((x) => x.ind.cout > 0).map((x) => ({ nom: x.site.nom, sous: typeCourt(x.site.type), preventif: x.ind.parType.preventif + x.ind.parType.visite, correctif: x.ind.parType.correctif, total: x.ind.cout,
        info: `<b>${esc(x.site.nom)}</b>Préventif ${euros(x.ind.parType.preventif)}<br>Correctif ${euros(x.ind.parType.correctif)}${x.ind.parType.visite ? `<br>Visites ${euros(x.ind.parType.visite)}` : ''}<br>${pluriel(x.ind.equipements, 'équipement')} · ${x.ind.resolus ? `${pluriel(x.ind.resolus, 'panne résolue', 'pannes résolues')}` : 'aucune panne résolue'}` })), 'Coût de maintenance par site sur 12 mois', 'Site', true)}
      <h2 class="titre-section">Disponibilité par site <span>Du moins disponible au plus disponible · arrêts : pannes notées « à l'arrêt »</span></h2>
      ${barresDispo(parSite.filter((x) => x.ind.disponibilite !== null).sort((a, b) => a.ind.disponibilite - b.ind.disponibilite))}` : ''}
      <h2 class="titre-section">Coût de maintenance par équipement <span>12 derniers mois, préventif et correctif${multi() ? ', les 10 plus chers' : ''}</span></h2>
      ${graphiqueCouts(couts.filter((x) => x.total > 0).slice(0, 10).map((x) => ({ nom: x.eq.repere || x.eq.nom, sous: x.eq.repere ? x.eq.nom : '', preventif: x.preventif, correctif: x.correctif, total: x.total, tableau: nomEq(x.eq.id) + (multi() ? ` (${nomSite(x.eq.site)})` : ''), arret: x.arret,
        info: `<b>${esc(x.eq.nom)}</b>${multi() ? `${esc(nomSite(x.eq.site))}<br>` : ''}Préventif ${euros(x.preventif)}<br>Correctif ${euros(x.correctif)}<br>${pluriel(x.bons, 'bon')} · ${x.pannes ? `${pluriel(x.pannes, 'panne')}, ${heures(x.arret)} d'arrêt` : 'aucune panne'}` })), 'Coût de maintenance par équipement sur 12 mois', 'Équipement')}
      <h2 class="titre-section">Indicateurs <span>${ind.jours} derniers jours${multi() ? ', tout le parc' : ''}</span></h2>
      <div class="indicateurs six">
        <div><span>Taux de réalisation</span><b>${pct(ind.taux)}</b><small>${ind.faits} faits · ${ind.dusNonFaits} bons dus non faits · ${ind.sansBon} en retard sans bon</small></div>
        <div><span>Ponctualité</span><b>${pct(ind.ponctualite)}</b><small>Faits au plus tard à l'échéance + ${pluriel(E.reglages.toleranceJours, 'jour')}</small></div>
        <div><span>Retard moyen</span><b>${ind.retardMoyen ? `${nombre(ind.retardMoyen, 1)} j` : '0 j'}</b><small>Parmi les bons faits après l'échéance</small></div>
        <div><span>Pannes</span><b>${ind.pannes}</b><small>${heures(ind.arret)} d'arrêt · préventif ${pct(ind.partPreventif)} du coût</small></div>
        <div><span>Disponibilité</span><b>${pctDispo(bil.disponibilite)}</b><small>${bil.arret ? `${pluriel(bil.arret, 'équipement')} à l'arrêt aujourd'hui` : 'Aucun équipement à l\'arrêt'}${bil.degrade ? ` · ${bil.degrade} dégradé${bil.degrade > 1 ? 's' : ''}` : ''}</small></div>
        <div><span>Délai de résolution</span><b>${nbJ(bil.delaiMoyen)}</b><small>${bil.resolus ? `Moyenne sur ${pluriel(bil.resolus, 'panne résolue', 'pannes résolues')}` : 'Aucune panne résolue'} · ${pluriel(bil.correctifsOuverts, 'ouverte')}</small></div>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Barres empilées préventif (bleu) / correctif (rouge), légende, infobulle, tableau accessible.
  // lignes : [{ nom, sous, preventif, correctif, total, info, tableau?, arret? }].
  function graphiqueCouts(lignes, legende = 'Coût de maintenance sur 12 mois', colonne = 'Équipement', visites = false) {
    if (!lignes.length) return '<div class="vide-etat petit"><div><h3>Aucun coût sur 12 mois</h3><p>Le coût apparaît dès qu\'un bon est clôturé avec une durée, des pièces ou de la sous-traitance.</p></div></div>';
    const max = Math.max(...lignes.map((x) => x.total), 1);
    const barres = lignes.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(x.info)}">
        <span class="bc-nom">${esc(x.nom)}<small>${esc(x.sous || '')}</small></span>
        <span class="bc-piste"><span class="bc-barre" style="width:${(x.preventif / max) * 100}%"></span><span class="bc-barre corr" style="left:${(x.preventif / max) * 100}%;width:${(x.correctif / max) * 100}%"></span></span>
        <span class="bc-val"><b>${euros(x.total, { centimes: false })}</b><small>${x.correctif ? `${euros(x.correctif, { centimes: false })} correctif` : 'préventif'}</small></span>
      </div>`).join('');
    return `<figure class="graphique">
        <div class="legende"><span><i class="pt-prev"></i>Préventif${visites ? ' et visites' : ''}</span><span><i class="pt-corr"></i>Correctif</span></div>
        <div class="barres-cats">${barres}</div>
        <div class="infobulle" hidden></div>
      </figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">${esc(legende)}</caption><thead><tr><th>${colonne}</th><th class="nb">Préventif${visites ? ' et visites' : ''}</th><th class="nb">Correctif</th><th class="nb">Total</th>${lignes[0].arret !== undefined ? '<th class="nb">Arrêt</th>' : ''}</tr></thead>
        <tbody>${lignes.map((x) => `<tr><td>${esc(x.tableau || x.nom)}</td><td class="nb">${euros(x.preventif)}</td><td class="nb">${euros(x.correctif)}</td><td class="nb">${euros(x.total)}</td>${x.arret !== undefined ? `<td class="nb">${heures(x.arret)}</td>` : ''}</tr>`).join('')}</tbody></table></div></details>`;
  }

  // Disponibilité par site : barres horizontales (une série), valeur au bout, tableau accessible.
  function barresDispo(lignes) {
    if (!lignes.length) return '<p class="mention">Aucun équipement actif.</p>';
    return `<figure class="graphique">
      <div class="barres-cats">${lignes.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(x.site.nom)}</b>Disponibilité ${pctDispo(x.ind.disponibilite)}<br>${pluriel(x.ind.equipements, 'équipement')} · ${pluriel(x.ind.arret, 'à l\'arrêt', 'à l\'arrêt')}`)}">
        <span class="bc-nom">${esc(x.site.nom)}<small>${esc(typeCourt(x.site.type))}</small></span>
        <span class="bc-piste"><span class="bc-barre dispo ${x.ind.disponibilite < 0.95 ? 'basse' : ''}" style="width:${x.ind.disponibilite * 100}%"></span></span>
        <span class="bc-val"><b>${pctDispo(x.ind.disponibilite)}</b><small>${x.ind.arret ? `${x.ind.arret} à l'arrêt` : 'aucun arrêt'}</small></span></div>`).join('')}</div>
      <div class="infobulle" hidden></div></figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">Disponibilité par site</caption><thead><tr><th>Site</th><th class="nb">Disponibilité</th><th class="nb">À l'arrêt</th></tr></thead>
      <tbody>${lignes.map((x) => `<tr><td>${esc(x.site.nom)}</td><td class="nb">${pctDispo(x.ind.disponibilite)}</td><td class="nb">${x.ind.arret}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique, .graphique-carte').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((x) => x.classList.toggle('survol', x === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
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

  // Choix du site dans les listes (plusieurs sites).
  const choixSiteFiltre = () => (multi() ? `<label class="champ"><span class="sr-only">Site</span><select class="filtre-site-choix"><option value="">Tous les sites</option>${sitesTries().map((x) => `<option value="${x.id}" ${x.id === filtre.site ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>` : '');

  // ---------- Échéancier ----------
  const FILTRES_ECH = [['urgent', 'À faire'], ['bon', 'Bon ouvert'], ['avenir', 'À venir'], ['plustard', 'Plus tard'], ['parametrer', 'À paramétrer'], ['tous', 'Toutes']];
  const garderEch = (x, f) => (f === 'tous' ? x.etat !== 'suspendu' : f === 'urgent' ? x.etat === 'retard' || x.etat === 'bientot' : x.etat === f);
  function vueEcheancier() {
    const t = auj();
    const q = R.plat(filtre.q.trim());
    const toutes = R.echeances(E, t).filter((x) => (!filtre.famille || x.eq?.famille === filtre.famille) && dansFiltreSite(x.eq))
      .filter((x) => !q || R.plat(`${x.op.nom} ${x.eq?.nom} ${x.eq?.repere} ${x.eq?.emplacement}${multi() ? ` ${nomSite(x.eq?.site)}` : ''}`).includes(q));
    const liste = toutes.filter((x) => garderEch(x, filtre.ech));
    const fams = [...new Set(E.equipements.map((e) => e.famille).filter(Boolean))];
    // Regroupement par mois de la date prévue (les échéances sans date à la fin).
    const groupes = new Map();
    for (const x of liste) {
      const cle = x.etat === 'retard' ? 'En retard' : x.prevue ? fmt(x.prevue, { month: 'long', year: 'numeric' }) : 'Sans date';
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(x);
    }
    return `
      <div class="vue-tete"><div><h1>Échéancier</h1><p>Toutes les opérations des plans de maintenance, à la date, au compteur ou au premier atteint. La date d'une échéance au compteur est estimée d'après le rythme d'utilisation relevé.</p></div>
        <div class="actions"><button class="btn" data-action="imprimer-echeancier">Imprimer</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer par état">${FILTRES_ECH.map(([id, lib]) => `<button class="filtre" data-action="filtre-ech" data-ech="${id}" aria-pressed="${filtre.ech === id}">${lib} <small>${toutes.filter((x) => garderEch(x, id)).length}</small></button>`).join('')}</div>
        <div class="rang-recherche">
          ${choixSiteFiltre()}
          <label class="champ"><span class="sr-only">Famille</span><select id="filtre-famille"><option value="">Toutes les familles</option>${fams.map((f) => `<option value="${esc(f)}" ${f === filtre.famille ? 'selected' : ''}>${esc(famille(f)?.nom || f)}</option>`).join('')}</select></label>
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-ech" type="search" placeholder="Opération, équipement" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      ${liste.length ? [...groupes].map(([g, l]) => `<h2 class="titre-cat">${esc(g.charAt(0).toUpperCase() + g.slice(1))} <span>${pluriel(l.length, 'opération')}</span></h2><ul class="lignes-ech">${l.map((x) => ligneEcheance(x)).join('')}</ul>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.operations.length ? 'Aucune échéance dans ce filtre' : 'Aucun plan de maintenance'}</h3><p>${E.operations.length ? 'Change le filtre ou la recherche.' : 'Crée un équipement : le plan type de sa famille te sera proposé.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Équipements ----------
  const FILTRES_EQ = [['actifs', 'Tous'], ['retard', 'En retard'], ['arret', 'Arrêtés'], ['A', 'Critiques'], ['archives', 'Archivés']];
  function infosEquipements(t) {
    const ech = R.echeances(E, t);
    return E.equipements.map((eq) => {
      const l = ech.filter((x) => x.eq?.id === eq.id && x.etat !== 'suspendu' && x.etat !== 'parametrer');
      const prochaine = l.filter((x) => x.prevue).sort((a, b) => a.prevue.localeCompare(b.prevue))[0];
      return { eq, prochaine, retard: l.some((x) => x.urgence === 'retard'), bientot: l.some((x) => x.urgence === 'bientot'), etat: R.etatEquipement(E, eq), compteur: R.compteurActuel(R.pointsCompteur(E, eq), t), cout: R.coutsEquipement(E, eq.id, ajout(t, -365), t).total, nbOps: E.operations.filter((o) => o.equipement === eq.id).length };
    });
  }
  function ligneEquipement(x, { avecSite = false } = {}) {
    return `<li class="ligne-fac ${x.eq.archive ? 'st-resilie' : x.retard || x.etat.code === 'arret' ? 'alerte-depasse' : x.bientot || x.etat.code === 'degrade' ? 'alerte-proche' : ''}">
        <button class="ligne-info" data-action="voir-eq" data-id="${x.eq.id}">
          <b>${etiquetteCrit(x.eq.criticite)} ${esc(x.eq.nom)}${x.eq.repere ? ` <span class="numero">${esc(x.eq.repere)}</span>` : ''}</b>
          <span class="ligne-detail">${[avecSite ? nomSite(x.eq.site) : '', famille(x.eq.famille)?.nom, x.eq.emplacement].filter(Boolean).map(esc).join(' · ') || 'Sans famille'} · ${pluriel(x.nbOps, 'opération')}</span>
          <span class="ligne-etiquettes">${x.eq.archive ? '<span class="etiquette sable">Archivé</span>' : ''}${x.etat.code === 'arret' || x.etat.code === 'degrade' ? `${etiquetteEq(x.etat.code)}<span class="ligne-proch">depuis le ${dateCourte(x.etat.depuis)}</span>` : ''}${x.retard ? etiquetteEtat('retard') : x.bientot ? etiquetteEtat('bientot') : ''}${x.prochaine && !x.eq.archive ? `<span class="ligne-proch">Prochaine : ${esc(x.prochaine.op.nom)}, ${dateCourte(x.prochaine.prevue)}</span>` : ''}</span>
        </button>
        <div class="ligne-droite">
          <span class="ligne-cout"><b>${x.eq.unite ? cpt(x.compteur, x.eq.unite) : '—'}</b><small>${x.cout ? `${euros(x.cout, { centimes: false })} sur 12 mois` : 'aucun coût sur 12 mois'}</small></span>
          ${x.eq.unite && !x.eq.archive ? `<button class="btn petit" data-action="releve" data-id="${x.eq.id}">Relevé</button>` : ''}
        </div></li>`;
  }
  // Bascule de l'onglet Sites : sites (liste ou carte) ou tous les équipements rangés par site.
  const basculeSites = () => `<div class="bascule-vue" role="group" aria-label="Afficher"><button class="btn petit" data-action="sous-vue" data-sous="sites" aria-pressed="${sousVue === 'sites'}">Sites</button><button class="btn petit" data-action="sous-vue" data-sous="equipements" aria-pressed="${sousVue === 'equipements'}">Équipements</button></div>`;
  function vueEquipements() {
    const t = auj();
    const q = R.plat(filtre.qe.trim());
    const infos = infosEquipements(t).filter((x) => dansFiltreSite(x.eq));
    const garder = (x, f) => (f === 'archives' ? x.eq.archive : !x.eq.archive && (f === 'actifs' || (f === 'retard' && x.retard) || (f === 'arret' && (x.etat.code === 'arret' || x.etat.code === 'degrade')) || (f === 'A' && x.eq.criticite === 'A')));
    const liste = infos.filter((x) => garder(x, filtre.eq) && (!q || R.plat(`${x.eq.repere} ${x.eq.nom} ${x.eq.emplacement} ${x.eq.fabricant} ${famille(x.eq.famille)?.nom || ''}${multi() ? ` ${nomSite(x.eq.site)}` : ''}`).includes(q)))
      .sort((a, b) => (multi() ? nomSite(a.eq.site).localeCompare(nomSite(b.eq.site), 'fr') : 0) || (a.eq.emplacement || '').localeCompare(b.eq.emplacement || '') || (a.eq.repere || a.eq.nom).localeCompare(b.eq.repere || b.eq.nom));
    // Plusieurs sites : un groupe par site, dans l'ordre alphabétique.
    const groupes = new Map();
    for (const x of liste) { const k = multi() ? x.eq.site : ''; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(x); }
    const contenu = liste.length
      ? [...groupes].map(([k, l]) => `${multi() ? `<h2 class="titre-cat"><button class="lien-titre" data-action="voir-site" data-id="${k}">${esc(nomSite(k))}</button> <span>${pluriel(l.length, 'équipement')}</span></h2>` : ''}<ul class="lignes-fac">${l.map((x) => ligneEquipement(x)).join('')}</ul>`).join('')
      : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.equipements.length ? 'Aucun équipement ne correspond' : 'Aucun équipement'}</h3><p>${E.equipements.length ? 'Change le filtre ou la recherche.' : 'Crée ton premier équipement : le plan type de sa famille t\'est proposé.'}</p><div class="actions"><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Nouvel équipement</button></div></div></div>`;
    return `
      <div class="vue-tete"><div><h1>Équipements</h1><p>Chaque équipement porte son plan de maintenance, ses relevés de compteur, son historique et son coût${multi() ? ', rangés par site' : ''}. Ouvre une fiche pour tout voir.</p></div>
        <div class="actions"><button class="btn" data-action="import" data-quoi="equipements">Importer (CSV)</button><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Nouvel équipement</button></div></div>
      ${multi() ? basculeSites() : ''}
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les équipements">${FILTRES_EQ.map(([id, lib]) => `<button class="filtre" data-action="filtre-eq" data-eq="${id}" aria-pressed="${filtre.eq === id}">${lib} <small>${infos.filter((x) => garder(x, id)).length}</small></button>`).join('')}</div>
        <div class="rang-recherche">${choixSiteFiltre()}<label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-eq" type="search" placeholder="Repère, nom, emplacement" value="${esc(filtre.qe)}"></label></div>
      </div>
      ${contenu}
      ${AVERTISSEMENT}`;
  }

  // ---------- Interventions ----------
  function ligneBon(i) {
    const c = R.coutBon(i, E.reglages);
    const d = i.statut === 'fait' ? i.dateRealisee : i.datePrevue;
    const enRetard = (i.statut === 'planifie' || i.statut === 'encours') && d && d < auj();
    return `<li><span class="date-pastille ${enRetard ? 'retard' : ''}">${d ? `<b>${versDate(d).getDate()}</b>${fmt(d, { month: 'short' }).replace('.', '')}` : '<b>–</b>'}</span>
      <button class="lien-ligne" data-action="voir-bon" data-id="${i.id}"><b>${esc(i.titre || 'Intervention')}</b><span>${esc(i.numero)} · ${auSite(i.equipement)}${esc(nomEq(i.equipement))}${i.intervenant ? ` · ${esc(i.intervenant)}` : ''}</span>
        <span class="ligne-etiquettes">${etiquetteBon(i.statut)}${i.type === 'correctif' ? '<span class="etiquette rose">Correctif</span>' : ''}${i.type === 'correctif' && i.arretEq && (i.statut === 'planifie' || i.statut === 'encours') ? etiquetteEq('arret') : ''}${enRetard ? etiquetteEtat('retard') : ''}</span></button>
      <span class="nb">${i.statut === 'fait' && c.total ? euros(c.total) : ''}</span></li>`;
  }
  // Visite de site (plusieurs sites) : tournée sans bon, qui compte pour l'alerte « sans visite ».
  const ligneVisite = (v) => `<li><span class="date-pastille"><b>${versDate(v.date).getDate()}</b>${fmt(v.date, { month: 'short' }).replace('.', '')}</span>
      <button class="lien-ligne" data-action="modifier-visite" data-id="${v.id}"><b>${esc(v.note || 'Visite de site')}</b><span>${esc(nomSite(v.site))}${v.intervenant ? ` · ${esc(v.intervenant)}` : ''}</span>
        <span class="ligne-etiquettes"><span class="etiquette sable">Visite</span></span></button>
      <span class="nb">${v.cout ? euros(v.cout) : ''}</span></li>`;
  const FILTRES_BON = [['afaire', 'À faire'], ['encours', 'En cours'], ['fait', 'Faits'], ['correctif', 'Correctifs'], ['annule', 'Annulés'], ['tous', 'Tous']];
  const garderBon = (i, f) => (f === 'tous' ? true : f === 'afaire' ? i.statut === 'planifie' || i.statut === 'encours' : f === 'correctif' ? i.type === 'correctif' : i.statut === f);
  function vueInterventions() {
    const q = R.plat(filtre.qb.trim());
    const filtres = multi() ? [...FILTRES_BON.slice(0, -1), ['visite', 'Visites'], FILTRES_BON.at(-1)] : FILTRES_BON;
    const tous = E.interventions.filter((i) => dansFiltreSite(equipement(i.equipement)) && (!q || R.plat(`${i.numero} ${i.titre} ${nomEq(i.equipement)} ${i.intervenant} ${i.constat}${multi() ? ` ${nomSite(equipement(i.equipement)?.site)}` : ''}`).includes(q)));
    const visites = multi() ? E.visites.filter((v) => (!filtre.site || v.site === filtre.site) && (!q || R.plat(`${v.note} ${v.intervenant} ${nomSite(v.site)}`).includes(q))).sort((a, b) => b.date.localeCompare(a.date)) : [];
    const liste = filtre.bon === 'visite' ? [] : tous.filter((i) => garderBon(i, filtre.bon))
      .sort((a, b) => (filtre.bon === 'afaire' ? 1 : -1) * ((a.dateRealisee || a.datePrevue || '').localeCompare(b.dateRealisee || b.datePrevue || '')));
    const montres = liste.slice(0, 150);
    const compte = (id) => (id === 'visite' ? visites.length : tous.filter((i) => garderBon(i, id)).length);
    return `
      <div class="vue-tete"><div><h1>Interventions</h1><p>Les bons d'intervention : préventifs ouverts depuis l'échéancier, correctifs pour les pannes${multi() ? ', et les visites de site' : ''}. Clôturer un bon recale l'échéance suivante, sort les pièces du stock et chiffre le coût.</p></div>
        <div class="actions">${multi() ? '<button class="btn" data-action="nouvelle-visite">Noter une visite</button>' : ''}<button class="btn primaire" data-action="nouveau-correctif">${ICONES.plus}Signaler une panne</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les bons">${filtres.map(([id, lib]) => `<button class="filtre" data-action="filtre-bon" data-bon="${id}" aria-pressed="${filtre.bon === id}">${lib} <small>${compte(id)}</small></button>`).join('')}</div>
        <div class="rang-recherche">${choixSiteFiltre()}<label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-bon" type="search" placeholder="Numéro, équipement, intervenant" value="${esc(filtre.qb)}"></label></div>
      </div>
      ${filtre.bon === 'visite' ? (visites.length ? `<p class="resume-liste">${pluriel(visites.length, 'visite')}</p><ul class="journal">${visites.map(ligneVisite).join('')}</ul>` : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucune visite</h3><p>Note les tournées sur tes sites : un site sans visite depuis ${pluriel(E.reglages.visiteMois, 'mois', 'mois')} passe en alerte.</p><div class="actions"><button class="btn primaire" data-action="nouvelle-visite">Noter une visite</button></div></div></div>`)
        : montres.length ? `<p class="resume-liste">${pluriel(liste.length, 'bon')}${liste.length > 150 ? ' · 150 affichés (export CSV complet dans les Réglages)' : ''}</p><ul class="journal">${montres.map(ligneBon).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun bon dans ce filtre</h3><p>Ouvre un bon depuis l'échéancier, ou signale une panne.</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Sites (plusieurs sites) : liste triable ou carte schématique, fiche de site ----------
  const COLS_SITES = [['etat', 'État'], ['nom', 'Site'], ['ville', 'Ville'], ['region', 'Région'], ['equipements', 'Équip.'], ['disponibilite', 'Dispo.'], ['retards', 'Retards'], ['delai', 'Délai moyen'], ['cout', 'Coût 12 mois']];
  const NB_SITES = new Set(['equipements', 'disponibilite', 'retards', 'delai', 'cout']);
  const COUL_SITE = { retard: 'var(--rouge)', proche: 'var(--jaune)', ok: 'var(--bleu)' };
  // Tableau des sites (écran large) et cartes de site (téléphone). tri : en-têtes triables.
  function tableauSites(lignes, compact = false) {
    if (!lignes.length) return `<div class="vide-etat petit">${FORME_VIDE}<div><h3>Aucun site ne correspond</h3><p>Change ou efface les filtres.</p><div class="actions"><button class="btn" data-action="filtres-effacer">Tout afficher</button></div></div></div>`;
    const l = compact ? R.trierSites(lignes, { cle: 'etat', sens: 1 }) : lignes;
    const th = ([k, lib]) => {
      const cls = NB_SITES.has(k) ? 'nb' : '';
      if (compact) return `<th class="${cls}">${lib}</th>`;
      const actif = affichage.tri.cle === k;
      return `<th class="${cls}" aria-sort="${actif ? (affichage.tri.sens > 0 ? 'ascending' : 'descending') : 'none'}"><button class="tri" data-action="filtre-tri" data-cle="${k}">${lib}<i aria-hidden="true">${actif ? (affichage.tri.sens > 0 ? '▲' : '▼') : ''}</i></button></th>`;
    };
    return `<div class="defile seulement-grand"><table class="tableau sites"><caption class="sr-only">Sites : état, équipements, disponibilité, retards, délai de résolution et coût</caption><thead><tr>${COLS_SITES.map(th).join('')}</tr></thead><tbody>
        ${l.map(({ site: x, ind, etat }) => `<tr>
          <td>${etiquetteSite(etat)}</td>
          <td><button class="lien-v" data-action="voir-site" data-id="${x.id}"><b>${esc(x.nom)}</b><small>${esc(typeCourt(x.type))}${x.responsable ? ` · ${esc(x.responsable)}` : ''}${x.inactif ? ' · inactif' : ''}</small></button></td>
          <td>${esc(x.ville || '–')}</td><td>${esc(x.region || '–')}</td>
          <td class="nb">${ind.equipements}${ind.arret ? ` <small class="txt-rouge">${ind.arret} à l'arrêt</small>` : ''}</td>
          <td class="nb">${pctDispo(ind.disponibilite)}</td>
          <td class="nb">${ind.retards ? `<b class="txt-rouge">${ind.retards}</b>` : '0'}</td>
          <td class="nb">${nbJ(ind.delaiMoyen)}</td>
          <td class="nb">${euros(ind.cout, { centimes: false })}</td></tr>`).join('')}
      </tbody></table></div>
      <ul class="cartes-sites seulement-petit">${l.map(carteSite).join('')}</ul>`;
  }
  function carteSite({ site: x, ind, etat, alertes: al }) {
    return `<li><button class="carte-site" data-action="voir-site" data-id="${x.id}" style="--c:${COUL_SITE[etat]}">
      <span class="cs-tete">${etiquetteSite(etat)}<small>${esc([typeCourt(x.type), x.ville, x.region].filter(Boolean).join(' · '))}</small></span>
      <b>${esc(x.nom)}</b>
      <span class="cs-chiffres"><span><b>${ind.equipements}</b> équip.</span><span><b>${pctDispo(ind.disponibilite)}</b> dispo.</span>${ind.retards ? `<span><b class="txt-rouge">${ind.retards}</b> en retard</span>` : ''}<span><b>${euros(ind.cout, { centimes: false })}</b> sur 12 mois</span></span>
      ${al.length ? `<small class="cs-alerte">${esc(al[0].titre)}${al[0].equipement ? ` · ${esc(equipement(al[0].equipement)?.nom || '')}` : ''}${al.length > 1 ? ` (+${al.length - 1})` : ''}</small>` : ''}
    </button></li>`;
  }

  function vueSites() {
    const t = auj();
    const toutes = R.lignesSites(E, t);
    const f = affichage.f;
    const lignes = R.trierSites(R.filtrerSites(toutes, f), affichage.tri);
    const regions = [...new Set(E.sites.map((x) => x.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const types = B.typesSites.filter((ty) => E.sites.some((x) => x.type === ty.code));
    const filtres = `
      <div class="filtres-grille" role="search">
        <label class="champ recherche">Rechercher<input type="search" id="f-texte" value="${esc(f.texte)}" placeholder="Nom, ville, responsable…"></label>
        <label class="champ">Région<select id="f-region"><option value="">Toutes</option>${regions.map((r) => `<option ${r === f.region ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <label class="champ">Type<select id="f-type"><option value="">Tous</option>${types.map((ty) => `<option value="${ty.code}" ${ty.code === f.type ? 'selected' : ''}>${esc(ty.court)}</option>`).join('')}</select></label>
        <label class="champ">État<select id="f-etat"><option value="">Tous</option>${[['alerte', 'Avec alerte'], ['retard', 'En retard'], ['ok', 'À jour']].map(([k, lib]) => `<option value="${k}" ${f.etat === k ? 'selected' : ''}>${lib}</option>`).join('')}</select></label>
        <label class="champ tri-petit">Trier par<select id="f-tri">${COLS_SITES.map(([k, lib]) => `<option value="${k}" ${k === affichage.tri.cle ? 'selected' : ''}>${lib}</option>`).join('')}</select></label>
      </div>`;
    const mode = `<div class="bascule-vue" role="group" aria-label="Affichage des sites"><button class="btn petit" data-action="filtre-mode" data-mode="liste" aria-pressed="${affichage.mode === 'liste'}">Liste</button><button class="btn petit" data-action="filtre-mode" data-mode="carte" aria-pressed="${affichage.mode === 'carte'}">Carte</button></div>`;
    return `
      <div class="vue-tete"><div><h1>Sites</h1><p>${pluriel(E.sites.length, 'site')} · état, disponibilité et pannes sur ${E.reglages.periodeIndicateurs} jours, coût sur 12 mois. Ouvre un site pour ses équipements, ses échéances et son historique.</p></div>
        <div class="actions"><button class="btn" data-action="import" data-quoi="sites">Importer (CSV)</button><button class="btn" data-action="csv-sites">Exporter</button><button class="btn primaire" data-action="nouveau-site">${ICONES.plus}Nouveau site</button></div></div>
      <div class="rang-bascules">${basculeSites()}${mode}</div>
      ${filtres}
      <p class="resume-liste compte-filtre">${lignes.length === toutes.length ? pluriel(lignes.length, 'site affiché', 'sites affichés') : `${lignes.length} sur ${toutes.length} sites (filtres actifs) · <button class="btn lien" data-action="filtres-effacer">Tout afficher</button>`}</p>
      ${affichage.mode === 'carte' ? vueCarte(lignes) : tableauSites(lignes)}
      ${AVERTISSEMENT}`;
  }

  // Carte schématique : points placés d'après la latitude et la longitude saisies (aucun fond de carte, rien
  // n'est envoyé), forme et couleur selon l'état ; sites sans coordonnées en grille par région.
  const FORME_ETAT = {
    ok: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2E5A88" stroke="#FFFFFF" stroke-width="2"/>`,
    proche: (x, y, r) => `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" fill="#E8B93A" stroke="#24221F" stroke-width="1.5"/>`,
    retard: (x, y, r) => `<path d="M${x} ${y - r * 1.15} L${x + r * 1.1} ${y + r * 0.8} L${x - r * 1.1} ${y + r * 0.8} Z" fill="#B84A34" stroke="#FFFFFF" stroke-width="2"/>`,
  };
  const pictoEtat = (et) => `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${FORME_ETAT[et](10, 10.5, 7)}</svg>`;
  function vueCarte(lignes) {
    if (!lignes.length) return tableauSites(lignes);
    const etroit = matchMedia('(max-width:640px)').matches;
    const L = Math.round(Math.max(300, Math.min(1140, ($('#vue')?.clientWidth || innerWidth) - (etroit ? 34 : 50)))), H = Math.round(etroit ? L * 1.15 : Math.min(560, L * 0.56));
    const p = R.projeter(lignes.map((x) => x.site), L, H, etroit ? 36 : 56);
    const sans = lignes.filter((x) => !R.aCoordonnees(x.site));
    let svg = '';
    if (p) {
      const par = Object.fromEntries(lignes.map((x) => [x.site.id, x]));
      const k = Math.cos(((p.bornes.latMin + p.bornes.latMax) / 2) * Math.PI / 180);
      const pts = p.points.map((q) => ({ ...q, l: par[q.id] }));
      const ref = pts[0];
      const lon2x = (lon) => ref.x + (lon - ref.l.site.lon) * k * p.echelle;
      const lat2y = (lat) => ref.y - (lat - ref.l.site.lat) * p.echelle;
      // Quadrillage discret tous les degrés (repère, pas un fond de carte).
      const grille = [];
      for (let lon = Math.floor(p.bornes.lonMin) - 12; lon <= Math.ceil(p.bornes.lonMax) + 12; lon++) { const x = lon2x(lon); if (x > 0 && x < L) grille.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}"/>`); }
      for (let lat = Math.floor(p.bornes.latMin) - 8; lat <= Math.ceil(p.bornes.latMax) + 8; lat++) { const y = lat2y(lat); if (y > 0 && y < H) grille.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${L}" y2="${y.toFixed(1)}"/>`); }
      // Étiquettes : à droite du point, sinon à gauche, dessous ou dessus ; masquées si rien n'est libre (visibles au survol).
      const pris = [];
      const libre = (b) => b.x0 >= 2 && b.x1 <= L - 2 && b.y0 >= 2 && b.y1 <= H - 2 && !pris.some((q) => b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1);
      const tt = etroit ? 11.5 : 13;
      pts.sort((a, b) => ({ retard: 0, proche: 1, ok: 2 }[a.l.etat] - { retard: 0, proche: 1, ok: 2 }[b.l.etat]));
      for (const q of pts) pris.push({ x0: q.x - 10, x1: q.x + 10, y0: q.y - 10, y1: q.y + 10 });
      const marques = pts.map((q) => {
        const nom = q.l.site.nom;
        const w = nom.length * tt * 0.55 + 4, h = tt + 4;
        const droite = { x0: q.x + 12, x1: q.x + 12 + w, y0: q.y - h / 2, y1: q.y + h / 2 };
        const gauche = { x0: q.x - 12 - w, x1: q.x - 12, y0: q.y - h / 2, y1: q.y + h / 2 };
        const dessous = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y + 12, y1: q.y + 12 + h };
        const dessus = { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - 12 - h, y1: q.y - 12 };
        const place = [droite, gauche, dessous, dessus].find(libre);
        if (place) pris.push(place);
        const txt = place ? `<text x="${place === droite ? place.x0 + 2 : place === gauche ? place.x1 - 2 : q.x}" y="${(place.y0 + place.y1) / 2 + tt * 0.35}" text-anchor="${place === droite ? 'start' : place === gauche ? 'end' : 'middle'}" font-size="${tt}">${esc(nom)}</text>` : '';
        return `<g class="point" data-action="voir-site" data-id="${q.id}" data-info="${esc(bulleSite(q.l))}" tabindex="0" role="button" aria-label="${esc(nom)}, ${ETAT_SITE[q.l.etat][1]}">
          <circle cx="${q.x}" cy="${q.y}" r="20" fill="transparent"/>${FORME_ETAT[q.l.etat](q.x, q.y, etroit ? 9 : 11)}${txt}</g>`;
      }).join('');
      svg = `<figure class="carte-svg graphique-carte">
        <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Carte schématique de ${pluriel(pts.length, 'site')} placés par leurs coordonnées">
          <rect width="${L}" height="${H}" fill="var(--surface)"/>
          <g class="quadrillage">${grille.join('')}</g>
          <g class="boussole" transform="translate(${L - 30} 34)"><path d="M0 -16 L6 4 L0 0 L-6 4 Z" fill="#24221F"/><text y="16" text-anchor="middle" font-size="11">N</text></g>
          ${marques}
        </svg>
        <div class="infobulle" hidden></div>
        <figcaption>Carte schématique : chaque site est placé selon la latitude et la longitude saisies, sans fond de carte. Touche un point pour ouvrir le site.</figcaption>
      </figure>`;
    }
    const regions = sans.length ? `<h2 class="titre-section">${p ? 'Sites sans coordonnées' : 'Sites par région'} <span>${p ? 'Ajoute latitude et longitude dans la fiche du site pour le placer sur la carte.' : 'Aucun site n\'a de coordonnées : ils sont regroupés par région. Ajoute latitude et longitude pour la carte.'}</span></h2>
      <div class="grille-regions">${R.grilleRegions(sans.map((x) => x.site)).map((g) => `<section class="region"><h3>${esc(g.region)}</h3><ul>${g.sites.map((x) => { const l = sans.find((y) => y.site.id === x.id); return `<li><button class="pastille-site" data-action="voir-site" data-id="${x.id}">${pictoEtat(l.etat)}<span><b>${esc(x.nom)}</b><small>${ETAT_SITE[l.etat][1]}${x.ville ? ` · ${esc(x.ville)}` : ''}</small></span></button></li>`; }).join('')}</ul></section>`).join('')}</div>` : '';
    return `<div class="legende carte-legende">${[['ok', 'À jour'], ['proche', 'À surveiller'], ['retard', 'En retard']].map(([k, lib]) => `<span>${pictoEtat(k)}${lib}</span>`).join('')}</div>${svg}${regions}`;
  }
  const bulleSite = (l) => [`<b>${esc(l.site.nom)}</b>`, `${ETAT_SITE[l.etat][1]}${l.alertes.length ? ` · ${pluriel(l.alertes.length, 'alerte')}` : ''}`, `${pluriel(l.ind.equipements, 'équipement')} · disponibilité ${pctDispo(l.ind.disponibilite)}`, `Coût sur 12 mois : ${euros(l.ind.cout, { centimes: false })}`].join('<br>');

  // Barres horizontales à une série (coût par famille d'un site) : lignes [{ nom, valeur, texte }].
  function barresSimples(lignes, legende) {
    const max = Math.max(1, ...lignes.map((x) => x.valeur));
    return `<figure class="graphique">
      <div class="barres-cats">${lignes.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(x.nom)}</b>${esc(x.texte)}`)}"><span class="bc-nom">${esc(x.nom)}</span><span class="bc-piste"><span class="bc-barre dispo" style="width:${(x.valeur / max) * 100}%"></span></span><span class="bc-val"><b>${esc(x.texte)}</b></span></div>`).join('')}</div>
      <div class="infobulle" hidden></div></figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">${esc(legende)}</caption><tbody>${lignes.map((x) => `<tr><th>${esc(x.nom)}</th><td class="nb">${esc(x.texte)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  function vueSite(x) {
    if (!x) { siteOuvert = null; return vueSites(); }
    const t = auj();
    const ind = R.bilan(E, t, [x.id]);
    const al = R.alertes(E, t).filter((a) => a.site === x.id);
    const ech = R.echeances(E, t).filter((e) => e.eq?.site === x.id && e.etat !== 'suspendu' && (e.urgence === 'retard' || e.urgence === 'bientot'));
    const infos = infosEquipements(t).filter((y) => y.eq.site === x.id).sort((a, b) => !!a.eq.archive - !!b.eq.archive || (a.eq.repere || a.eq.nom).localeCompare(b.eq.repere || b.eq.nom));
    const ids = new Set(infos.map((y) => y.eq.id));
    const histo = [...E.interventions.filter((i) => ids.has(i.equipement)).map((i) => ({ d: i.dateRealisee || i.datePrevue || '', html: ligneBon(i) })),
      ...E.visites.filter((v) => v.site === x.id).map((v) => ({ d: v.date, html: ligneVisite(v) }))].sort((a, b) => b.d.localeCompare(a.d));
    const visite = R.derniereVisite(E, x.id, t);
    const fams = Object.entries(ind.parFamille).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (ind.parType.visite) fams.push(['__visites', ind.parType.visite]);
    const tuile = ([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`;
    return `
      <p class="fil"><button class="btn lien" data-action="voir-sites">← Tous les sites</button></p>
      <div class="vue-tete"><div><p class="surtitre">${esc([typeCourt(x.type), x.ville, x.region].filter(Boolean).join(' · '))}${x.inactif ? ' · inactif' : ''}</p>
        <h1>${esc(x.nom)}</h1>
        <p>${[x.adresse && esc(x.adresse), x.responsable && `Responsable : <b>${esc(x.responsable)}</b>`, `Dernière visite : <b>${visite ? dateLongue(visite) : 'aucune'}</b>`, R.aCoordonnees(x) ? `GPS ${nombre(x.lat, 4)} ; ${nombre(x.lon, 4)}` : ''].filter(Boolean).join(' · ')}</p></div>
        <div class="actions"><button class="btn" data-action="modifier-site" data-id="${x.id}">Modifier le site</button><button class="btn" data-action="nouvelle-visite" data-id="${x.id}">Noter une visite</button><button class="btn" data-action="nouveau-correctif" data-site="${x.id}">${ICONES.plus}Panne</button><button class="btn primaire" data-action="nouvel-eq" data-site="${x.id}">${ICONES.plus}Équipement</button></div></div>
      <div class="tuiles">${[
        ['Disponibilité', pctDispo(ind.disponibilite), `${pluriel(ind.equipements, 'équipement')} · ${ind.arret ? `${ind.arret} à l'arrêt` : 'aucun arrêt'}${ind.degrade ? `, ${ind.degrade} dégradé${ind.degrade > 1 ? 's' : ''}` : ''}`, 'var(--bleu)', 'rond'],
        ['En retard', String(ind.retards), `${pluriel(ind.bientot, 'autre')} bientôt · réalisation ${pct(ind.taux)}`, 'var(--rouge)', ''],
        ['Délai de résolution', nbJ(ind.delaiMoyen), `${pluriel(ind.resolus, 'panne résolue', 'pannes résolues')} · ${pluriel(ind.correctifsOuverts, 'ouverte')}`, 'var(--jaune)', ''],
        ['Coût sur 12 mois', euros(ind.cout, { centimes: false }), `Préventif ${euros(ind.parType.preventif, { centimes: false })} · correctif ${euros(ind.parType.correctif, { centimes: false })}`, 'var(--encre)', 'rond'],
      ].map(tuile).join('')}</div>
      ${al.length ? `<h2 class="titre-section">Alertes du site</h2><ul class="journal alertes">${al.map(ligneAlerte).join('')}</ul>` : ''}
      ${ech.length ? `<h2 class="titre-section">À faire <span>En retard, puis bientôt</span></h2><ul class="lignes-ech">${ech.slice(0, 8).map((e) => ligneEcheance(e)).join('')}</ul>${ech.length > 8 ? `<button class="btn lien" data-action="filtre-ech-site" data-id="${x.id}">Voir les ${ech.length} échéances du site</button>` : ''}` : ''}
      <h2 class="titre-section">Équipements <span>${pluriel(infos.filter((y) => !y.eq.archive).length, 'actif')}${infos.some((y) => y.eq.archive) ? `, ${pluriel(infos.filter((y) => y.eq.archive).length, 'archivé')}` : ''}</span></h2>
      ${infos.length ? `<ul class="lignes-fac">${infos.map((y) => ligneEquipement(y)).join('')}</ul>` : `<div class="vide-etat petit">${FORME_VIDE}<div><h3>Aucun équipement</h3><p>Ajoute les équipements de ce site : le plan type de leur famille t'est proposé.</p><div class="actions"><button class="btn primaire" data-action="nouvel-eq" data-site="${x.id}">${ICONES.plus}Nouvel équipement</button></div></div></div>`}
      ${fams.length ? `<h2 class="titre-section">Coût par famille <span>12 derniers mois</span></h2>${barresSimples(fams.map(([f, v]) => ({ nom: f === '__visites' ? 'Visites de site' : famille(f)?.nom || 'Sans famille', valeur: v, texte: euros(v, { centimes: false }) })), 'Coût par famille du site sur 12 mois')}` : ''}
      <h2 class="titre-section">Historique <span>${pluriel(histo.length, 'intervention')}, de la plus récente à la plus ancienne</span></h2>
      ${histo.length ? `<ul class="journal">${histo.slice(0, 30).map((h) => h.html).join('')}</ul>${histo.length > 30 ? '<p class="mention">30 dernières affichées ; l\'onglet Interventions et l\'export CSV contiennent tout.</p>' : ''}` : '<p class="mention">Aucune intervention enregistrée.</p>'}
      ${x.notes ? `<h2 class="titre-section">Notes</h2><p class="aide">${esc(x.notes)}</p>` : ''}
      ${AVERTISSEMENT}`;
  }

  // Filtres des sites (listes déroulantes) et ouverture d'un point de la carte au clavier.
  function brancherSites() {
    const lier = (sel, fn) => $(sel)?.addEventListener('change', fn);
    const f = affichage.f;
    lier('#f-region', (ev) => { f.region = ev.target.value; rendre(); });
    lier('#f-type', (ev) => { f.type = ev.target.value; rendre(); });
    lier('#f-etat', (ev) => { f.etat = ev.target.value; rendre(); });
    lier('#f-tri', (ev) => { affichage.tri = { cle: ev.target.value, sens: ['equipements', 'retards', 'cout', 'delai'].includes(ev.target.value) ? -1 : 1 }; rendre(); });
    document.querySelectorAll('#vue .point').forEach((g) => g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ouvrirSite(g.dataset.id); } }));
  }
  function ouvrirSite(id) {
    if (!site(id)) return;
    if (modale().open) modale().close();
    siteOuvert = id; vue = 'sites';
    history.replaceState(null, '', '#sites');
    rendre(); window.scrollTo({ top: 0 }); $('#vue').focus({ preventScroll: true });
  }

  // ---------- Pièces ----------
  const lignePieceCourte = (s) => `<li><span class="date-pastille ${s.statut === 'rupture' ? 'retard' : 'alerte'}"><b>${nombre(Math.max(0, s.stock), 1)}</b>${(s.piece.unite.length <= 7 ? esc(s.piece.unite) : 'unités')}</span>
      <button class="lien-ligne" data-action="modifier-piece" data-id="${s.piece.id}"><b>${esc(s.piece.nom)}</b><span>${s.statut === 'rupture' ? 'Rupture' : `Seuil ${nombre(s.piece.seuil)}`}${s.piece.fournisseur ? ` · ${esc(s.piece.fournisseur)}` : ''}</span></button>
      <button class="btn petit" data-action="mvt-piece" data-id="${s.piece.id}">Réception</button></li>`;
  function vuePieces() {
    const t = auj();
    const toutes = E.pieces.map((p) => R.situationPiece(E, p, t)).sort((a, b) => a.piece.nom.localeCompare(b.piece.nom));
    const liste = toutes.filter((s) => filtre.piece === 'tous' || (filtre.piece === 'alerte' && s.statut !== 'ok'));
    const valeur = toutes.reduce((s, x) => s + x.valeur, 0);
    return `
      <div class="vue-tete"><div><h1>Pièces de rechange</h1><p>Le stock de chaque pièce se calcule : réceptions et ajustements, moins les pièces consommées par les bons clôturés. Prix unitaires HT.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvelle-piece">${ICONES.plus}Nouvelle pièce</button></div></div>
      <div class="outils-liste"><div class="filtres" role="group" aria-label="Filtrer les pièces">${[['tous', 'Toutes'], ['alerte', 'À commander']].map(([id, lib]) => `<button class="filtre" data-action="filtre-piece" data-piece="${id}" aria-pressed="${filtre.piece === id}">${lib} <small>${toutes.filter((s) => id === 'tous' || s.statut !== 'ok').length}</small></button>`).join('')}</div></div>
      ${liste.length ? `<p class="resume-liste">${pluriel(liste.length, 'pièce')} · stock valorisé ${euros(valeur)}</p><ul class="lignes-fac">${liste.map((s) => `<li class="ligne-fac ${s.statut === 'rupture' ? 'alerte-depasse' : s.statut === 'seuil' ? 'alerte-proche' : ''}">
        <button class="ligne-info" data-action="modifier-piece" data-id="${s.piece.id}"><b>${esc(s.piece.nom)}${s.piece.ref ? ` <span class="numero">${esc(s.piece.ref)}</span>` : ''}</b>
          <span class="ligne-detail">${[s.piece.emplacement, s.piece.fournisseur, s.piece.prix ? `${euros(s.piece.prix)} l'unité` : ''].filter(Boolean).map(esc).join(' · ')}</span>
          <span class="ligne-etiquettes">${s.statut === 'rupture' ? '<span class="etiquette rouge">Rupture</span>' : s.statut === 'seuil' ? '<span class="etiquette jaune">Sous le seuil</span>' : ''}${s.equipements.length ? `<span class="ligne-proch">Pour ${s.equipements.map((id) => esc(equipement(id)?.repere || equipement(id)?.nom || '')).join(', ')}</span>` : ''}${s.conso12 ? `<span class="ligne-proch">${nombre(s.conso12)} consommé${s.conso12 > 1 ? 's' : ''} sur 12 mois</span>` : ''}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b>${nombre(s.stock)} ${esc(s.piece.unite)}</b><small>seuil ${nombre(s.piece.seuil)}</small></span><button class="btn petit" data-action="mvt-piece" data-id="${s.piece.id}">Réception</button></div></li>`).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.pieces.length ? 'Rien à commander' : 'Aucune pièce'}</h3><p>${E.pieces.length ? 'Toutes les pièces sont au-dessus de leur seuil.' : 'Crée les pièces que tu gardes en réserve (filtres, courroies, huiles…), puis rattache-les aux opérations des plans.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Modales ----------
  const modale = () => $('#modale');
  function ouvrirModale(titre, corps, pied, auValider, { large = false } = {}) {
    const d = modale();
    d.classList.toggle('large', large);
    d.innerHTML = `<form method="dialog" novalidate><div class="modale-tete"><h2 id="modale-titre">${titre}</h2><button type="button" data-action="fermer" aria-label="Fermer">×</button></div><div class="modale-corps">${corps}</div><div class="modale-pied">${pied}</div></form>`;
    d.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (ev.submitter?.value === 'annuler') return d.close();
      const err = auValider?.(new FormData(ev.target), ev.submitter?.value);
      if (typeof err === 'string') { const p = d.querySelector('.erreur'); if (p) p.textContent = err; return; }
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const garderOuverte = () => { modale().dataset.garder = '1'; };
  const listeDonnees = (id, valeurs) => `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const optionsUnites = (sel) => `<option value="" ${!sel ? 'selected' : ''}>Pas de compteur</option>${B.unitesCompteur.map((u) => `<option value="${u.code}" ${u.code === sel ? 'selected' : ''}>${esc(u.nom)}</option>`).join('')}`;

  // Nouvel équipement (avec son plan type) ou modification.
  function modaleEquipement(id, siteId = '') {
    const eq = id ? equipement(id) : null;
    if (id && !eq) return;
    const fam0 = E.familles[0] || B.familles[0].id;
    const site0 = siteId || siteOuvert || filtre.site || sitesTries()[0]?.id || '';
    const v = eq || { repere: '', nom: '', famille: fam0, emplacement: '', criticite: 'B', unite: famille(fam0)?.compteur || '', compteurInitial: 0, miseEnService: auj(), fabricant: '', modele: '', numeroSerie: '', note: '', archive: false, site: site0 };
    const fams = [...B.familles].sort((a, b) => (E.familles.includes(b.id) - E.familles.includes(a.id)) || a.nom.localeCompare(b.nom));
    const corps = `
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 140px">Repère<input name="repere" maxlength="30" value="${esc(v.repere)}" placeholder="Ex. : CMP-01" autocapitalize="characters"></label>
        <label class="champ">Nom<input name="nom" maxlength="100" required value="${esc(v.nom)}" placeholder="Ex. : Compresseur à vis"></label>
      </div>
      ${multi() ? `<label class="champ">Site<select name="site">${sitesTries().map((x) => `<option value="${x.id}" ${x.id === v.site ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>` : ''}
      <div class="rang-champs">
        <label class="champ">Famille<select name="famille" id="eq-famille">${fams.map((f) => `<option value="${f.id}" ${f.id === v.famille ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}<option value="" ${!v.famille ? 'selected' : ''}>Autre (sans plan type)</option></select></label>
        <label class="champ">Emplacement<input name="emplacement" list="l-emps" maxlength="60" value="${esc(v.emplacement)}" placeholder="Atelier, local technique…"></label>
      </div>
      <fieldset class="champ"><legend>Criticité <small>Ce qu'entraîne son arrêt.</small></legend><div class="choix-statut trois">${B.criticites.map((c) => `<label title="${esc(c.detail)}"><input type="radio" name="criticite" value="${c.code}" ${c.code === v.criticite ? 'checked' : ''}><span>${c.code} · ${esc(c.nom)}</span></label>`).join('')}</div></fieldset>
      <div class="rang-champs">
        <label class="champ">Compteur<select name="unite" id="eq-unite">${optionsUnites(v.unite)}</select></label>
        <label class="champ" id="champ-cpt0">Compteur ${eq ? 'à la mise en service' : 'actuel'}<input name="compteurInitial" inputmode="decimal" value="${R.saisieNombre(v.compteurInitial)}"></label>
        <label class="champ">${eq ? 'Mise en service' : 'Suivi à partir du'}<input type="date" name="miseEnService" value="${esc(v.miseEnService || '')}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Fabricant<input name="fabricant" maxlength="80" value="${esc(v.fabricant)}"></label>
        <label class="champ">Modèle<input name="modele" maxlength="80" value="${esc(v.modele)}"></label>
        <label class="champ">N° de série<input name="numeroSerie" maxlength="60" value="${esc(v.numeroSerie)}"></label>
      </div>
      ${eq ? '' : '<fieldset class="champ cadre-champs" id="plan-type"><legend>Plan de maintenance type <small>Repères indicatifs, à ajuster selon la notice du fabricant. Les échéances partent de la date ci-dessus.</small></legend><div id="plan-type-liste"></div></fieldset>'}
      <label class="champ">Note <small>Facultative.</small><input name="note" maxlength="500" value="${esc(v.note)}"></label>
      ${eq ? `<label class="case"><input type="checkbox" name="archive" ${eq.archive ? 'checked' : ''}> Archivé (réformé, vendu : hors échéances, historique gardé)</label>` : ''}
      ${listeDonnees('l-emps', E.equipements.map((x) => x.emplacement))}
      <p class="erreur" role="alert"></p>`;
    const pied = eq
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer l\'équipement</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(eq ? `Modifier ${esc(eq.nom)}` : 'Nouvel équipement', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        const n = E.interventions.filter((i) => i.equipement === eq.id).length;
        if (!confirm(`Supprimer « ${eq.nom} », son plan${n ? ` et ses ${pluriel(n, 'bon')}` : ''} ? Pour un équipement réformé, archive-le plutôt : l'historique reste.`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerEquipement(E, eq.id);
        sauver(); rendre(); toast(`« ${eq.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'équipement.';
      const repere = String(fd.get('repere') || '').trim();
      const siteEq = multi() ? String(fd.get('site') || '') : (eq?.site || '');
      if (repere && E.equipements.some((x) => x.repere.toLowerCase() === repere.toLowerCase() && x.id !== eq?.id && (!multi() || x.site === siteEq))) return `Le repère ${repere} est déjà utilisé${multi() ? ' sur ce site' : ''}.`;
      const c0 = R.lireNombre(fd.get('compteurInitial'));
      if (Number.isNaN(c0)) return 'Compteur illisible : écris par exemple 1250 ou 1250,5.';
      const mes = fd.get('miseEnService');
      if (!eq && !R.estDate(mes)) return 'Indique la date de départ du suivi.';
      retenir();
      const donnees = R.normaliserEquipement({ id: eq?.id || uid(), site: siteEq, repere, nom, famille: fd.get('famille'), emplacement: fd.get('emplacement'), criticite: fd.get('criticite'), unite: fd.get('unite'), compteurInitial: c0 ?? 0, miseEnService: mes, fabricant: fd.get('fabricant'), modele: fd.get('modele'), numeroSerie: fd.get('numeroSerie'), note: fd.get('note'), archive: !!fd.get('archive') });
      if (eq) { Object.assign(eq, donnees); sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler }); return; }
      E.equipements.push(donnees);
      if (donnees.famille && !E.familles.includes(donnees.famille)) E.familles.push(donnees.famille);
      const codes = fd.getAll('op');
      const ops = R.planDepuisFamille(B, donnees.famille, { equipement: donnees.id, depuis: mes, depuisCompteur: donnees.compteurInitial, codes, id: uid });
      E.operations.push(...ops);
      sauver(); rendre();
      toast(`« ${nom} » créé avec ${pluriel(ops.length, 'opération')} au plan.`, { libelle: 'Annuler', faire: annuler });
      setTimeout(() => modaleFiche(donnees.id), 0);
    });
    const d = modale();
    const majPlan = (changeUnite) => {
      const f = famille(d.querySelector('#eq-famille').value);
      if (changeUnite) d.querySelector('#eq-unite').value = f?.compteur || '';
      d.querySelector('#champ-cpt0').hidden = !d.querySelector('#eq-unite').value;
      const zone = d.querySelector('#plan-type-liste');
      if (!zone) return;
      zone.innerHTML = f ? f.plan.map((o) => `<label class="case op-type"><input type="checkbox" name="op" value="${o.code}" ${o.p && o.p[1] === 'j' ? '' : 'checked'}><span><b>${esc(o.nom)}</b><small>${[R.libellePeriode(o.p), f.compteur && o.c ? `tous les ${nombre(o.c, 0)} ${uniteCourte(f.compteur)}` : '', o.nature === 'reglementaire' && !o.p ? 'périodicité réglementaire à saisir' : '', o.regle ? 'obligation sourcée' : '', o.qui === 'prestataire' ? 'prestataire' : ''].filter(Boolean).join(' · ')}</small></span></label>`).join('') : '<p class="mention">Sans plan type : ajoute tes opérations depuis la fiche de l\'équipement.</p>';
    };
    d.querySelector('#eq-famille').addEventListener('change', () => majPlan(true));
    d.querySelector('#eq-unite').addEventListener('change', () => majPlan(false));
    majPlan(false);
  }

  // Fiche d'un équipement : compteur, plan et échéances, historique, coûts.
  function modaleFiche(id) {
    const t = auj();
    const eq = equipement(id);
    if (!eq) return;
    const pts = R.pointsCompteur(E, eq);
    const c = R.compteurActuel(pts, t), ry = R.rythme(pts, t);
    const ech = R.echeances(E, t).filter((x) => x.op.equipement === id);
    const c12 = R.coutsEquipement(E, id, ajout(t, -365), t), tout = R.coutsEquipement(E, id, null, t);
    const bons = E.interventions.filter((i) => i.equipement === id).sort((a, b) => (b.dateRealisee || b.datePrevue || '').localeCompare(a.dateRealisee || a.datePrevue || ''));
    const releves = E.releves.filter((r) => r.equipement === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const st = R.etatEquipement(E, eq);
    const dispo = R.disponibilite(E, eq, t, E.reglages.periodeIndicateurs);
    const corps = `
      <p class="etat-eq">${etiquetteEq(st.code)}${st.depuis ? ` <span>${st.code === 'arret' ? 'À l\'arrêt' : 'Dégradé'} depuis le ${dateLongue(st.depuis)} · <button type="button" class="btn lien" data-action="voir-bon" data-id="${st.bon.id}">voir la panne</button></span>` : ''}${dispo !== null ? ` <span>Disponibilité ${pctDispo(dispo)} sur ${E.reglages.periodeIndicateurs} jours</span>` : ''}</p>
      <div class="resume-facture">
        <div><span>Compteur</span><b>${eq.unite ? cpt(c, eq.unite) : 'Sans compteur'}</b><small>${eq.unite ? `${ry ? `≈ ${nombre(ry * 7, 1)} ${uniteCourte(eq.unite)} par semaine` : 'Rythme inconnu : relève le compteur'}${R.dernierReleve(pts) ? ` · relevé le ${dateCourte(R.dernierReleve(pts))}` : ''}` : 'Échéances à la date uniquement'}</small></div>
        <div><span>Criticité</span><b>${eq.criticite} · ${esc(B.criticites.find((x) => x.code === eq.criticite)?.nom)}</b><small>${esc(famille(eq.famille)?.nom || 'Sans famille')}</small></div>
        <div><span>Coût sur 12 mois</span><b>${euros(c12.total)}</b><small>Préventif ${euros(c12.preventif)} · correctif ${euros(c12.correctif)}</small></div>
        <div><span>Pannes sur 12 mois</span><b>${c12.pannes}</b><small>${heures(c12.arret)} d'arrêt · ${euros(tout.total)} depuis le début</small></div>
      </div>
      <p class="mention">${[multi() && `Site <button type="button" class="btn lien" data-action="voir-site" data-id="${eq.site}">${esc(nomSite(eq.site))}</button>`, eq.repere && `Repère ${esc(eq.repere)}`, esc(eq.emplacement), eq.fabricant && esc(eq.fabricant), eq.modele && esc(eq.modele), eq.numeroSerie && `N° ${esc(eq.numeroSerie)}`, eq.miseEnService && `suivi depuis le ${dateLongue(eq.miseEnService)}`].filter(Boolean).join(' · ')}</p>
      ${eq.note ? `<p class="aide">${esc(eq.note)}</p>` : ''}
      <div class="rang">${eq.unite && !eq.archive ? `<button type="button" class="btn petit primaire" data-action="releve" data-id="${eq.id}">Relever le compteur</button>` : ''}<button type="button" class="btn petit" data-action="nouvelle-op" data-id="${eq.id}">Ajouter une opération</button><button type="button" class="btn petit" data-action="nouveau-correctif" data-id="${eq.id}">Signaler une panne</button></div>
      <section class="bloc-detail"><h3>Plan de maintenance <span>${pluriel(ech.length, 'opération')}</span></h3>
        ${ech.length ? `<ul class="lignes-ech compact">${ech.map((x) => ligneEcheance(x, { avecEq: false }).replace('data-action="voir-eq"', `data-action="modifier-op" data-id-op="${x.op.id}"`)).join('')}</ul>` : '<p class="mention">Aucune opération : ajoute celles de la notice du fabricant.</p>'}
      </section>
      <section class="bloc-detail"><h3>Historique <span>${pluriel(bons.length, 'bon')}</span></h3>
        ${bons.length ? `<ul class="journal">${bons.slice(0, 30).map(ligneBon).join('')}</ul>${bons.length > 30 ? '<p class="mention">30 derniers bons affichés.</p>' : ''}` : '<p class="mention">Aucune intervention pour l\'instant.</p>'}
      </section>
      ${eq.unite ? `<section class="bloc-detail"><h3>Derniers relevés <span>${pluriel(E.releves.filter((r) => r.equipement === id).length, 'relevé')}</span></h3>
        ${releves.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th class="nb">Compteur</th><th></th></tr></thead><tbody>${releves.map((r) => `<tr><td>${dateCourte(r.date)}</td><td class="nb">${cpt(r.valeur, eq.unite)}</td><td><button type="button" class="btn-suppr" data-action="suppr-releve" data-id="${r.id}" data-retour="${eq.id}" aria-label="Supprimer ce relevé">×</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="mention">Aucun relevé : les échéances au compteur partent du compteur de départ.</p>'}</section>` : ''}`;
    ouvrirModale(`${eq.repere ? `${esc(eq.repere)} · ` : ''}${esc(eq.nom)}`, corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier-eq" data-id="${eq.id}">Modifier la fiche</button>`, null, { large: true });
  }

  function modaleReleve(id) {
    const eq = equipement(id);
    if (!eq || !eq.unite) return;
    const pts = R.pointsCompteur(E, eq);
    const corps = `
      <p class="mention">${esc(nomEq(id))} · dernier compteur connu : <b>${cpt(R.compteurActuel(pts, auj()), eq.unite)}</b>${R.dernierReleve(pts) ? ` (${dateLongue(R.dernierReleve(pts))})` : ''}.</p>
      <div class="rang-champs">
        <label class="champ">Compteur (${esc(uniteCourte(eq.unite))})<input name="valeur" inputmode="decimal" required autocomplete="off"></label>
        <label class="champ">Date<input type="date" name="date" value="${auj()}" required></label>
      </div>
      <p class="aide">Un relevé par semaine suffit : il donne le rythme d'utilisation, qui transforme les échéances au compteur en dates estimées.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Relevé de compteur', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const v = R.lireNombre(fd.get('valeur'));
      if (v === null || Number.isNaN(v)) return 'Compteur illisible : écris par exemple 12450.';
      const date = fd.get('date');
      if (date > auj()) return 'La date ne peut pas être dans le futur.';
      const err = R.verifierReleve(pts, date, v);
      if (err) return err;
      retenir();
      E.releves.push(R.normaliserReleve({ id: uid(), equipement: id, date, valeur: v }));
      sauver(); rendre();
      const urg = R.echeances(E, auj()).filter((x) => x.op.equipement === id && x.urgence === 'retard' && x.etat !== 'suspendu').length;
      toast(`Relevé enregistré : ${cpt(v, eq.unite)}.${urg ? ` ${pluriel(urg, 'opération')} en retard.` : ''}`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Opération du plan : nouvelle (eqId) ou existante (opId).
  function modaleOperation(opId, eqId) {
    const op = opId ? operation(opId) : null;
    const eq = equipement(op ? op.equipement : eqId);
    if (!eq) return;
    const v = op || { nom: '', nature: 'entretien', p: [12, 'm'], c: null, d: 30, qui: 'interne', regle: '', reference: '', points: [], pieces: [], depuis: auj(), depuisCompteur: R.compteurActuel(R.pointsCompteur(E, eq), auj()), recalage: 'glissant', actif: true };
    const regle = v.regle ? B.regles[v.regle] : null;
    const lignesPieces = [...v.pieces, { piece: '', quantite: 1 }, { piece: '', quantite: 1 }];
    const corps = `
      <label class="champ">Opération<input name="nom" maxlength="120" required value="${esc(v.nom)}" placeholder="Ex. : Vidange et filtre à huile"></label>
      <fieldset class="champ"><legend>Nature</legend><div class="choix-statut trois">${Object.entries(B.natures).map(([k, n]) => `<label title="${esc(n.detail)}"><input type="radio" name="nature" value="${k}" ${k === v.nature ? 'checked' : ''}><span>${esc(n.nom)}</span></label>`).join('')}</div></fieldset>
      ${regle ? `<p class="aide"><b>${esc(regle.titre)}.</b> ${esc(regle.texte)} <br><small>Source : ${esc(regle.source)} Vérifié le ${R.dateFr(B.verifieLe)} ; à revoir chaque année.</small></p>` : ''}
      <fieldset class="champ cadre-champs"><legend>Périodicité <small>Laisse vide ce qui ne s'applique pas. Avec les deux, l'échéance est la première atteinte.</small></legend>
        <div class="rang-champs">
          <label class="champ">Tous les<input name="pn" inputmode="numeric" value="${v.p ? v.p[0] : ''}" placeholder="—"></label>
          <label class="champ">Unité<select name="pu">${Object.entries(R.UNITES_P).map(([k, l]) => `<option value="${k}" ${(v.p ? v.p[1] : 'm') === k ? 'selected' : ''}>${l[1]}</option>`).join('')}</select></label>
          ${eq.unite ? `<label class="champ">Ou tous les (${esc(uniteCourte(eq.unite))})<input name="c" inputmode="decimal" value="${R.saisieNombre(v.c)}" placeholder="—"></label>` : ''}
        </div>
        <fieldset class="champ"><legend>Échéance suivante calculée depuis</legend><div class="choix-statut deux"><label><input type="radio" name="recalage" value="glissant" ${v.recalage !== 'fixe' ? 'checked' : ''}><span>La réalisation</span></label><label><input type="radio" name="recalage" value="fixe" ${v.recalage === 'fixe' ? 'checked' : ''}><span>L'échéance prévue</span></label></div></fieldset>
      </fieldset>
      <label class="champ" id="champ-ref">Référence du texte ou de l'organisme <small>Réglementaire : d'où vient la périodicité saisie.</small><input name="reference" maxlength="200" value="${esc(v.reference)}" placeholder="Texte applicable, rapport précédent…"></label>
      <div class="rang-champs">
        <label class="champ">Durée estimée (min)<input name="d" inputmode="numeric" value="${v.d || ''}"></label>
        <label class="champ">Par<select name="qui"><option value="interne" ${v.qui === 'interne' ? 'selected' : ''}>Équipe interne</option><option value="prestataire" ${v.qui === 'prestataire' ? 'selected' : ''}>Prestataire</option></select></label>
      </div>
      <label class="champ">Points de contrôle <small>Un par ligne : repris sur le bon, à cocher.</small><textarea name="points" rows="4">${esc(v.points.join('\n'))}</textarea></label>
      ${E.pieces.length ? `<fieldset class="champ cadre-champs"><legend>Pièces prévues <small>Reprises sur le bon ; sorties du stock à la clôture.</small></legend>${lignesPieces.map((x, k) => `<div class="ligne-piece"><select name="piece-${k}" aria-label="Pièce"><option value="">—</option>${E.pieces.map((p) => `<option value="${p.id}" ${p.id === x.piece ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select><input name="qte-${k}" inputmode="decimal" value="${R.saisieNombre(x.quantite)}" aria-label="Quantité"></div>`).join('')}</fieldset>` : ''}
      <fieldset class="champ cadre-champs"><legend>Point de départ <small>Utilisé tant qu'aucun bon n'a été clôturé pour cette opération.</small></legend>
        <div class="rang-champs"><label class="champ">Dernière réalisation connue<input type="date" name="depuis" value="${esc(v.depuis || '')}"></label>${eq.unite ? `<label class="champ">Au compteur<input name="depuisCompteur" inputmode="decimal" value="${R.saisieNombre(v.depuisCompteur)}"></label>` : ''}</div></fieldset>
      ${op ? `<label class="case"><input type="checkbox" name="actif" ${op.actif ? 'checked' : ''}> Opération active (décocher pour la suspendre)</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = op
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(op ? 'Opération du plan' : `Nouvelle opération · ${esc(eq.nom)}`, corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${op.nom} » du plan ? Les bons déjà faits restent dans l'historique.`)) { garderOuverte(); return; }
        retenir();
        E.operations = E.operations.filter((o) => o.id !== op.id);
        E.interventions.forEach((i) => { if (i.operation === op.id && i.statut !== 'fait') i.statut = 'annule'; });
        sauver(); rendre(); toast('Opération supprimée.', { libelle: 'Annuler', faire: annuler });
        setTimeout(() => modaleFiche(eq.id), 0);
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à l\'opération.';
      const pnB = String(fd.get('pn') || '').trim();
      const pn = pnB ? Number(pnB) : null;
      if (pnB && !(Number.isInteger(pn) && pn > 0 && pn <= 1000)) return 'Périodicité illisible : un nombre entier, par exemple 6.';
      const c = R.lireNombre(fd.get('c'));
      if (Number.isNaN(c)) return 'Intervalle au compteur illisible.';
      const dc = R.lireNombre(fd.get('depuisCompteur'));
      if (Number.isNaN(dc)) return 'Compteur de départ illisible.';
      const pieces = [];
      for (let k = 0; k < lignesPieces.length; k++) {
        const p = fd.get(`piece-${k}`); if (!p) continue;
        const q = R.lireNombre(fd.get(`qte-${k}`));
        if (!q || Number.isNaN(q)) return 'Quantité de pièce illisible.';
        pieces.push({ piece: p, quantite: q });
      }
      retenir();
      const donnees = R.normaliserOperation({ ...(op || {}), id: op?.id || uid(), equipement: eq.id, nom, nature: fd.get('nature'), p: pn ? [pn, fd.get('pu')] : null, c, d: Number(fd.get('d')) || 0, qui: fd.get('qui'), regle: v.regle, reference: fd.get('reference'),
        points: String(fd.get('points') || '').split('\n'), pieces, depuis: fd.get('depuis'), depuisCompteur: dc, recalage: fd.get('recalage'), actif: op ? !!fd.get('actif') : true });
      if (op) Object.assign(op, donnees); else E.operations.push(donnees);
      sauver(); rendre();
      toast(op ? 'Opération enregistrée.' : `« ${nom} » ajoutée au plan.`, { libelle: 'Annuler', faire: annuler });
      setTimeout(() => modaleFiche(eq.id), 0);
    });
    const d = modale();
    const maj = () => { d.querySelector('#champ-ref').hidden = d.querySelector('[name=nature]:checked').value !== 'reglementaire'; };
    d.querySelectorAll('[name=nature]').forEach((x) => x.addEventListener('change', maj));
    maj();
  }

  // Ouvre un bon préventif depuis une échéance.
  function ouvrirBon(opId) {
    const op = operation(opId);
    if (!op) return;
    const b = R.preparerBon(E, op, auj(), { id: uid() });
    const corps = `
      <p class="mention">${esc(nomEq(op.equipement))} · ${esc(op.nom)}. Échéance : ${esc(R.libelleEcheance(R.echeance(E, op, auj()), uniteCourte(equipement(op.equipement)?.unite)))}.</p>
      <div class="rang-champs">
        <label class="champ">Date prévue<input type="date" name="datePrevue" value="${b.datePrevue}" required></label>
        <label class="champ">Intervenant<input name="intervenant" maxlength="80" value="${esc(b.intervenant)}" list="l-interv"></label>
      </div>
      ${listeDonnees('l-interv', E.interventions.map((i) => i.intervenant))}
      <p class="aide">Le bon reprend les ${pluriel(b.points.length, 'point')} de contrôle${b.pieces.length ? ` et ${pluriel(b.pieces.length, 'pièce')} prévue${b.pieces.length > 1 ? 's' : ''}` : ''}. Imprime-le pour le terrain, puis clôture-le ici.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Nouveau bon ${esc(b.numero)}`, corps, '<button class="btn primaire" value="ok">Créer le bon</button><button class="btn" value="imprimer">Créer et imprimer</button><button class="btn" value="annuler">Annuler</button>', (fd, action) => {
      if (!R.estDate(fd.get('datePrevue'))) return 'Indique la date prévue.';
      retenir();
      b.datePrevue = fd.get('datePrevue'); b.intervenant = String(fd.get('intervenant') || '').trim();
      b.numero = R.numeroBon(E, b.datePrevue);
      E.interventions.push(b);
      sauver(); rendre();
      toast(`Bon ${b.numero} créé.`, { libelle: 'Annuler', faire: annuler });
      if (action === 'imprimer') setTimeout(() => imprimerBon(b.id), 0);
    });
  }

  // Bon correctif (panne) ; eqId facultatif.
  // Bon correctif (panne) ; eqId ou siteId facultatifs. Avec plusieurs sites, les équipements sont groupés par site.
  function modaleCorrectif(eqId, siteId = '') {
    const actifs = E.equipements.filter((x) => !x.archive && (!siteId || x.site === siteId)).sort((a, b) => (a.repere || a.nom).localeCompare(b.repere || b.nom));
    if (!actifs.length) { toast(siteId ? 'Ce site n\'a pas encore d\'équipement actif.' : 'Crée d\'abord un équipement.'); modaleEquipement(null, siteId); return; }
    const opt = (x) => `<option value="${x.id}" ${x.id === eqId ? 'selected' : ''}>${esc(nomEq(x.id))}</option>`;
    const options = multi() ? sitesTries().filter((x) => actifs.some((y) => y.site === x.id)).map((x) => `<optgroup label="${esc(x.nom)}">${actifs.filter((y) => y.site === x.id).map(opt).join('')}</optgroup>`).join('') : actifs.map(opt).join('');
    const corps = `
      <label class="champ">Équipement<select name="equipement">${options}</select></label>
      <label class="champ">Panne constatée<input name="titre" maxlength="160" required placeholder="Ex. : Fuite d'huile sous le carter"></label>
      <div class="rang-champs">
        <label class="champ">Motif<select name="motif">${B.motifsPanne.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
        <label class="champ">Signalée le<input type="date" name="date" value="${auj()}" max="${auj()}" required></label>
      </div>
      <label class="case"><input type="checkbox" name="arretEq" checked> Équipement à l'arrêt tant que la panne est ouverte (compte dans la disponibilité)</label>
      <label class="champ">Description <small>Symptômes, conditions, qui a signalé.</small><textarea name="symptome" rows="3"></textarea></label>
      <label class="champ">Intervenant<input name="intervenant" maxlength="80" list="l-interv"></label>
      ${listeDonnees('l-interv', E.interventions.map((i) => i.intervenant))}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Signaler une panne', corps, '<button class="btn primaire" value="ok">Créer le bon</button><button class="btn" value="cloturer">Déjà réparée</button><button class="btn" value="annuler">Annuler</button>', (fd, action) => {
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Décris la panne en quelques mots.';
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Indique la date.';
      if (date > auj()) return 'La date de signalement ne peut pas être dans le futur.';
      retenir();
      const b = R.normaliserIntervention({ id: uid(), numero: R.numeroBon(E, date), equipement: fd.get('equipement'), type: 'correctif', statut: 'encours', titre, motif: fd.get('motif'), dateSignalee: date, datePrevue: date, arretEq: !!fd.get('arretEq'), symptome: fd.get('symptome'), intervenant: fd.get('intervenant') });
      E.interventions.push(b);
      sauver(); rendre();
      if (action === 'cloturer') { garderOuverte(); modaleCloture(b.id); return; }
      toast(`Bon ${b.numero} créé (correctif)${b.arretEq ? ' : équipement à l\'arrêt' : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Détail d'un bon.
  function modaleBon(id) {
    const i = bon(id);
    if (!i) return;
    const eq = equipement(i.equipement);
    const c = R.coutBon(i, E.reglages);
    const op = i.operation ? operation(i.operation) : null;
    const ouvert = i.statut === 'planifie' || i.statut === 'encours';
    const corps = `
      <div class="resume-facture">
        <div><span>Équipement</span><b>${esc(nomEq(i.equipement))}</b><small>${multi() ? `${esc(nomSite(eq?.site))}${eq?.emplacement ? ' · ' : ''}` : ''}${esc(eq?.emplacement || '')}</small></div>
        <div><span>Statut</span><b>${etiquetteBon(i.statut)} ${i.type === 'correctif' ? '<span class="etiquette rose">Correctif</span>' : '<span class="etiquette sable">Préventif</span>'}</b><small>${i.statut === 'fait' ? `Fait le ${dateLongue(i.dateRealisee)}` : i.datePrevue ? `Prévu le ${dateLongue(i.datePrevue)}` : ''}</small></div>
        ${i.type === 'preventif' ? `<div><span>Échéance visée</span><b>${i.echeanceDate ? dateCourte(i.echeanceDate) : '–'}</b><small>${i.echeanceCompteur !== null ? `ou ${cpt(i.echeanceCompteur, eq?.unite)}` : ''}</small></div>`
          : ouvert ? `<div><span>Panne</span><b>${i.arretEq ? 'À l\'arrêt' : 'Dégradé'}</b><small>Signalée le ${i.dateSignalee ? dateLongue(i.dateSignalee) : '–'}${i.dateSignalee ? `, ouverte depuis ${pluriel(Math.max(0, ecart(i.dateSignalee, auj())), 'jour')}` : ''}</small></div>`
          : `<div><span>Arrêt</span><b>${heures(i.arret)}</b><small>${[esc(i.motif), i.dateSignalee && i.dateRealisee ? `résolue en ${pluriel(Math.max(0, ecart(i.dateSignalee, i.dateRealisee)), 'jour')}` : ''].filter(Boolean).join(' · ')}</small></div>`}
        <div><span>Coût</span><b>${i.statut === 'fait' ? euros(c.total) : '–'}</b><small>${i.statut === 'fait' ? `MO ${euros(c.mainOeuvre)} · pièces ${euros(c.pieces)} · sous-traitance ${euros(c.sousTraitance)}` : 'Chiffré à la clôture'}</small></div>
      </div>
      ${i.intervenant || i.duree || i.compteur !== null ? `<p class="mention">${[i.intervenant && `Par ${esc(i.intervenant)}`, i.duree && `durée ${heures(i.duree)}`, i.compteur !== null && `compteur ${cpt(i.compteur, eq?.unite)}`, i.reference && `rapport ${esc(i.reference)}`].filter(Boolean).join(' · ')}</p>` : ''}
      ${i.symptome ? `<p class="aide"><b>Symptôme :</b> ${esc(i.symptome)}</p>` : ''}
      ${i.points.length ? `<section class="bloc-detail"><h3>Points de contrôle <span>${i.points.filter((p) => p.fait).length} / ${i.points.length}</span></h3><ul class="points">${i.points.map((p) => `<li class="${p.fait ? 'fait' : ''}">${p.fait ? '✓' : '○'} ${esc(p.texte)}</li>`).join('')}</ul></section>` : ''}
      ${i.pieces.length ? `<section class="bloc-detail"><h3>Pièces</h3><ul class="points">${i.pieces.map((x) => `<li>${nombre(x.quantite)} × ${esc(piece(x.piece)?.nom || 'Pièce supprimée')}${x.prix ? ` · ${euros(x.prix)}` : ''}</li>`).join('')}</ul></section>` : ''}
      ${i.constat ? `<p class="aide"><b>Constat :</b> ${esc(i.constat)}</p>` : ''}
      ${op?.reference ? `<p class="mention">Référence : ${esc(op.reference)}</p>` : ''}`;
    const pied = [
      ouvert ? `<button class="btn primaire" type="button" data-action="cloturer" data-id="${i.id}">Clôturer</button>` : '<button class="btn primaire" value="annuler">Fermer</button>',
      `<button class="btn" type="button" data-action="imprimer-bon" data-id="${i.id}">Imprimer</button>`,
      i.statut === 'planifie' ? `<button class="btn" type="button" data-action="demarrer-bon" data-id="${i.id}">Démarrer</button>` : '',
      i.statut === 'fait' ? `<button class="btn" type="button" data-action="cloturer" data-id="${i.id}">Modifier</button>` : '',
      ouvert ? `<button class="btn" type="button" data-action="annuler-bon" data-id="${i.id}">Annuler le bon</button>` : '',
      `<button class="btn danger gauche" type="button" data-action="suppr-bon" data-id="${i.id}">Supprimer</button>`,
    ].join('');
    ouvrirModale(`${esc(i.numero)} · ${esc(i.titre || 'Intervention')}`, corps, pied);
  }

  // Clôture (ou correction) d'un bon. Un bon brouillon (non encore enregistré) peut être passé directement.
  function modaleCloture(id, brouillon = null) {
    const i = brouillon || bon(id);
    if (!i) return;
    const eq = equipement(i.equipement);
    const lignes = [...i.pieces, { piece: '', quantite: '', prix: null }, { piece: '', quantite: '', prix: null }];
    const cAct = eq ? R.compteurActuel(R.pointsCompteur(E, eq).filter((p) => p.id !== i.id), auj()) : null;
    const taux = E.reglages.tauxHoraire;
    const corps = `
      <p class="mention">${esc(nomEq(i.equipement))} · ${esc(i.titre)}${i.numero ? ` · ${esc(i.numero)}` : ''}</p>
      <div class="rang-champs">
        <label class="champ">Fait le<input type="date" name="dateRealisee" value="${i.dateRealisee || auj()}" required></label>
        ${eq?.unite ? `<label class="champ">Compteur (${esc(uniteCourte(eq.unite))}) <small>Dernier connu : ${cpt(cAct, eq.unite)}</small><input name="compteur" inputmode="decimal" value="${R.saisieNombre(i.compteur ?? cAct)}"></label>` : ''}
        <label class="champ">Durée (h)<input name="duree" inputmode="decimal" value="${R.saisieNombre(i.duree)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Intervenant<input name="intervenant" maxlength="80" value="${esc(i.intervenant)}" list="l-interv"></label>
        <label class="champ">Main-d'œuvre HT <small>${taux ? `Vide : durée × ${euros(taux)}/h` : 'Taux horaire non saisi (Réglages)'}</small><input name="mainOeuvre" inputmode="decimal" value="${R.saisieMontant(i.mainOeuvre)}" placeholder="Calculée"></label>
        <label class="champ">Sous-traitance HT<input name="sousTraitance" inputmode="decimal" value="${R.saisieMontant(i.sousTraitance || null)}" placeholder="0,00"></label>
      </div>
      ${i.type === 'correctif' ? `<div class="rang-champs"><label class="champ">Arrêt de l'équipement (h) <small>${i.arretEq ? 'Vide : jours entre signalement et résolution × 24 h.' : 'Vide : aucun arrêt.'}</small><input name="arret" inputmode="decimal" value="${R.saisieNombre(i.arret || null)}" placeholder="${i.arretEq ? 'Calculé' : '0'}"></label>
        <label class="case"><input type="checkbox" name="arretEq" ${i.arretEq ? 'checked' : ''}> L'équipement était à l'arrêt</label></div>` : ''}
      ${i.points.length ? `<fieldset class="champ cadre-champs"><legend>Points de contrôle</legend>${i.points.map((p, k) => `<label class="case"><input type="checkbox" name="point-${k}" ${p.fait || !brouillon && i.statut !== 'fait' ? 'checked' : ''}> ${esc(p.texte)}</label>`).join('')}</fieldset>` : ''}
      ${E.pieces.length ? `<fieldset class="champ cadre-champs"><legend>Pièces consommées <small>Sorties du stock ; prix unitaire HT du jour.</small></legend>${lignes.map((x, k) => `<div class="ligne-piece trois"><select name="piece-${k}" aria-label="Pièce"><option value="">—</option>${E.pieces.map((p) => `<option value="${p.id}" ${p.id === x.piece ? 'selected' : ''}>${esc(p.nom)} (stock ${nombre(R.stockPiece(E, p.id))})</option>`).join('')}</select><input name="qte-${k}" inputmode="decimal" value="${R.saisieNombre(x.quantite)}" placeholder="Qté" aria-label="Quantité"><input name="prix-${k}" inputmode="decimal" value="${R.saisieMontant(x.prix)}" placeholder="Prix" aria-label="Prix unitaire"></div>`).join('')}</fieldset>` : ''}
      <label class="champ">Constat et travaux faits<textarea name="constat" rows="3">${esc(i.constat)}</textarea></label>
      <label class="champ">Référence du rapport ou de l'attestation <small>Facultatif (aucun fichier n'est stocké).</small><input name="reference" maxlength="120" value="${esc(i.reference)}"></label>
      ${listeDonnees('l-interv', E.interventions.map((x) => x.intervenant))}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(i.statut === 'fait' ? 'Modifier le bon clôturé' : 'Clôturer l\'intervention', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const compteur = eq?.unite ? R.lireNombre(fd.get('compteur')) : null;
      const duree = R.lireNombre(fd.get('duree'));
      if (Number.isNaN(compteur) || Number.isNaN(duree)) return 'Compteur ou durée illisible.';
      const mo = R.lireMontant(fd.get('mainOeuvre')), st = R.lireMontant(fd.get('sousTraitance'));
      if (Number.isNaN(mo) || Number.isNaN(st)) return 'Montant illisible : écris par exemple 120 ou 120,50.';
      const arret = R.lireNombre(fd.get('arret'));
      if (Number.isNaN(arret)) return 'Durée d\'arrêt illisible.';
      const pieces = [];
      for (let k = 0; k < lignes.length; k++) {
        const p = fd.get(`piece-${k}`); if (!p) continue;
        const q = R.lireNombre(fd.get(`qte-${k}`)), px = R.lireMontant(fd.get(`prix-${k}`));
        if (!q || Number.isNaN(q)) return 'Quantité de pièce illisible.';
        if (Number.isNaN(px)) return 'Prix de pièce illisible.';
        pieces.push({ piece: p, quantite: q, prix: px ?? piece(p)?.prix ?? 0 });
      }
      retenir();
      const cible = brouillon ? i : bon(id);
      const copie = structuredClone(cible);
      const err = R.cloturer(E, copie, { dateRealisee: fd.get('dateRealisee'), compteur, duree, auj: auj() });
      if (err) { annulation = null; return err; }
      if (cible.type === 'correctif' && cible.dateSignalee && copie.dateRealisee < cible.dateSignalee) { annulation = null; return 'La résolution ne peut pas précéder le signalement.'; }
      const arretEq = cible.type === 'correctif' && !!fd.get('arretEq');
      // Arrêt non saisi d'une panne qui arrêtait l'équipement : jours entre signalement et résolution × 24 h.
      const arretH = arret ?? (arretEq && cible.dateSignalee ? Math.max(0, ecart(cible.dateSignalee, copie.dateRealisee)) * 24 : 0);
      Object.assign(cible, copie, {
        intervenant: String(fd.get('intervenant') || '').trim(), mainOeuvre: mo, sousTraitance: st ?? 0, arret: arretH, arretEq, pieces,
        constat: String(fd.get('constat') || '').trim(), reference: String(fd.get('reference') || '').trim(),
        points: cible.points.map((p, k) => ({ ...p, fait: !!fd.get(`point-${k}`) })),
      });
      if (brouillon) { cible.numero = R.numeroBon(E, cible.dateRealisee); E.interventions.push(cible); }
      sauver(); rendre();
      const suite = cible.operation ? R.echeance(E, operation(cible.operation), auj()) : null;
      toast(`${cible.numero} clôturé${suite && suite.prevue ? ` · prochaine échéance ${dateCourte(suite.prevue)}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // « Fait » direct depuis une échéance : bon préventif créé et clôturé en une fois.
  function faitDirect(opId) {
    const op = operation(opId);
    if (!op) return;
    const b = R.preparerBon(E, op, auj(), { id: uid(), datePrevue: auj() });
    b.points.forEach((p) => { p.fait = true; });
    modaleCloture(null, b);
  }

  function changerStatutBon(id, statut) {
    const i = bon(id);
    if (!i) return;
    if (statut === 'annule' && !confirm(`Annuler le bon ${i.numero} ? Il reste dans l'historique, l'échéance redevient à faire.`)) return;
    retenir();
    i.statut = statut;
    sauver(); rendre();
    if (modale().open) modale().close();
    toast(`${i.numero} : ${R.STATUTS_BON[statut].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
  }
  function supprimerBon(id) {
    const i = bon(id);
    if (!i || !confirm(`Supprimer définitivement le bon ${i.numero} ? ${i.statut === 'fait' ? 'L\'échéance et les coûts seront recalculés sans lui.' : ''}`)) return;
    retenir();
    E.interventions = E.interventions.filter((x) => x.id !== id);
    sauver(); rendre();
    if (modale().open) modale().close();
    toast(`Bon ${i.numero} supprimé.`, { libelle: 'Annuler', faire: annuler });
  }

  // ---------- Sites, visites et import (plusieurs sites) ----------
  const optionsTypes = (sel) => B.typesSites.map((x) => `<option value="${x.code}" ${x.code === sel ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const listeRegions = () => listeDonnees('l-regions', [...B.regions, ...E.sites.map((x) => x.region)].sort((a, b) => a.localeCompare(b, 'fr')));
  const lireCoord = (v, max) => { const t = String(v ?? '').trim().replace(',', '.').replace('−', '-'); if (!t) return null; const n = Number(t); return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined; };
  const saisieCoord = (n) => (Number.isFinite(n) ? String(n).replace('.', ',') : '');
  function modaleSite(id) {
    const x = id ? site(id) : null;
    if (id && !x) return;
    const v = x || { nom: '', type: 'BUR', adresse: '', ville: '', region: '', responsable: '', lat: null, lon: null, notes: '', inactif: false };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Nom du site<input name="nom" required maxlength="80" value="${esc(v.nom)}" placeholder="Ex. : Entrepôt Nord"></label>
        <label class="champ">Type<select name="type">${optionsTypes(v.type)}</select></label>
      </div>
      <label class="champ">Adresse <small>Texte libre, facultatif.</small><input name="adresse" maxlength="140" value="${esc(v.adresse)}"></label>
      <div class="rang-champs">
        <label class="champ">Ville<input name="ville" maxlength="60" value="${esc(v.ville)}"></label>
        <label class="champ">Région <small>Ou secteur, agence.</small><input name="region" maxlength="60" list="l-regions" value="${esc(v.region)}"></label>
        <label class="champ">Responsable<input name="responsable" maxlength="60" value="${esc(v.responsable)}"></label>
      </div>
      ${listeRegions()}
      <div class="rang-champs">
        <label class="champ">Latitude <small>Facultatif, décimal (ex. 45,76).</small><input name="lat" inputmode="decimal" value="${esc(saisieCoord(v.lat))}"></label>
        <label class="champ">Longitude <small>Ouest : négatif (ex. −1,68).</small><input name="lon" inputmode="decimal" value="${esc(saisieCoord(v.lon))}"></label>
      </div>
      <p class="aide">Les coordonnées placent le site sur la carte schématique, sans fond de carte ni service en ligne : lis-les dans n'importe quelle application de cartes (appui long sur le lieu).</p>
      <label class="champ">Notes<textarea name="notes" rows="2" maxlength="500" placeholder="Accès, horaires, gardien…">${esc(v.notes)}</textarea></label>
      ${x ? `<label class="case"><input type="checkbox" name="inactif" ${x.inactif ? 'checked' : ''}> Site inactif (vendu, fermé) : plus d'alerte, historique gardé</label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = x
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Créer le site</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(x ? `Modifier ${esc(x.nom)}` : 'Nouveau site', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (E.sites.length <= 1) return 'C\'est le dernier site : pour revenir à un seul site, décoche « Plusieurs sites » dans les réglages.';
        const ne = E.equipements.filter((e) => e.site === x.id).length;
        if (!confirm(`Supprimer « ${x.nom} »${ne ? ` avec ses ${pluriel(ne, 'équipement')}, leurs plans et leurs bons` : ''} ? Pour garder l'historique, coche plutôt « Site inactif ».`)) { garderOuverte(); return; }
        retenir();
        E = R.supprimerSite(E, x.id);
        siteOuvert = null; if (filtre.site === x.id) filtre.site = '';
        sauver(); rendre(); toast(`« ${x.nom} » supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Indique le nom du site.';
      if (E.sites.some((y) => R.plat(y.nom) === R.plat(nom) && y.id !== x?.id)) return 'Un site porte déjà ce nom (les imports s\'appuient sur le nom).';
      const lat = lireCoord(fd.get('lat'), 90), lon = lireCoord(fd.get('lon'), 180);
      if (lat === undefined || lon === undefined) return 'Coordonnées : nombres décimaux (latitude −90 à 90, longitude −180 à 180).';
      if ((lat === null) !== (lon === null)) return 'Indique la latitude et la longitude, ou aucune des deux.';
      retenir();
      const donnees = R.normaliserSite({ id: x?.id || uid(), nom, type: fd.get('type'), adresse: fd.get('adresse'), ville: fd.get('ville'), region: fd.get('region'), responsable: fd.get('responsable'), lat, lon, notes: fd.get('notes'), inactif: x ? !!fd.get('inactif') : false });
      if (x) { Object.assign(x, donnees); sauver(); rendre(); toast(`« ${nom} » enregistré.`, { libelle: 'Annuler', faire: annuler }); return; }
      E.sites.push(donnees);
      sauver();
      ouvrirSite(donnees.id);
      toast(`« ${nom} » créé : ajoute ses équipements.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Visite de site : tournée, contrôle sans bon ; remet à zéro l'alerte « sans visite ».
  function modaleVisite(id, siteId = '') {
    const v = id ? E.visites.find((x) => x.id === id) : null;
    if (id && !v) return;
    const val = v || { site: siteId || siteOuvert || filtre.site || sitesTries()[0]?.id, date: auj(), intervenant: '', note: '', cout: 0 };
    const corps = `
      <div class="rang-champs">
        <label class="champ">Site<select name="site">${sitesTries().map((x) => `<option value="${x.id}" ${x.id === val.site ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Date<input type="date" name="date" value="${val.date}" max="${auj()}" required></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Par<input name="intervenant" maxlength="80" value="${esc(val.intervenant)}" list="l-interv"></label>
        <label class="champ">Coût HT <small>Facultatif (déplacement, prestataire).</small><input name="cout" inputmode="decimal" value="${R.saisieMontant(val.cout || null)}" placeholder="0,00"></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="300" value="${esc(val.note)}" placeholder="Ex. : tournée trimestrielle, état des locaux"></label>
      ${listeDonnees('l-interv', [...E.interventions.map((i) => i.intervenant), ...E.visites.map((x) => x.intervenant)])}
      <p class="aide">Un site sans visite ni bon clôturé depuis plus de ${pluriel(E.reglages.visiteMois, 'mois', 'mois')} passe en alerte (réglable dans les réglages).</p>
      <p class="erreur" role="alert"></p>`;
    const pied = v
      ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Enregistrer la visite</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(v ? 'Visite de site' : 'Noter une visite', corps, pied, (fd, action) => {
      if (action === 'supprimer') { retenir(); E.visites = E.visites.filter((x) => x.id !== v.id); sauver(); rendre(); toast('Visite supprimée.', { libelle: 'Annuler', faire: annuler }); return; }
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Indique la date.';
      if (date > auj()) return 'La date ne peut pas être dans le futur.';
      const cout = R.lireMontant(fd.get('cout'));
      if (Number.isNaN(cout)) return 'Coût illisible : écris par exemple 80 ou 80,50.';
      retenir();
      const donnees = R.normaliserVisite({ id: v?.id || uid(), site: fd.get('site'), date, intervenant: fd.get('intervenant'), note: fd.get('note'), cout: cout ?? 0 });
      if (v) Object.assign(v, donnees); else E.visites.push(donnees);
      sauver(); rendre();
      toast(`Visite ${v ? 'enregistrée' : `notée : ${nomSite(donnees.site)}, le ${dateLongue(date)}`}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Import depuis un tableur (CSV) : sites (plusieurs sites) ou équipements ; aperçu avant tout changement.
  function modaleImport(quoi = 'equipements') {
    if (!multi()) quoi = 'equipements';
    let resultat = null;
    const corps = `
      <p>Importe ta liste depuis un tableur : enregistre-la en <b>CSV</b> (point-virgule ou virgule), en partant du modèle. Un aperçu s'affiche avant tout changement.</p>
      ${multi() ? `<fieldset class="champ"><legend>Contenu du fichier</legend><div class="choix-statut deux">${[['sites', 'Sites'], ['equipements', 'Équipements']].map(([k, lib]) => `<label><input type="radio" name="quoi" value="${k}" ${k === quoi ? 'checked' : ''}><span>${lib}</span></label>`).join('')}</div></fieldset>` : '<input type="hidden" name="quoi" value="equipements">'}
      <div class="rang">${multi() ? '<button class="btn petit" type="button" data-action="csv-modele-sites">Modèle des sites</button>' : ''}<button class="btn petit" type="button" data-action="csv-modele-equipements">Modèle des équipements</button></div>
      <label class="champ">Fichier CSV<input type="file" id="m-fichier" accept=".csv,text/csv,text/plain"></label>
      <div id="m-apercu" class="apercu" hidden></div>
      <p class="aide">${multi() ? 'Sites : un site de même nom est mis à jour. Équipements : la colonne « Site » nomme un site existant (importe d\'abord les sites) ; ' : 'Équipements : '}même repère (ou, sans repère, même nom) = mise à jour. Un nouvel équipement reçoit une opération « Préventif périodique » si la colonne « Périodicité préventive (mois) » est remplie, sinon le plan type de sa famille. Les bons et les relevés ne s'importent pas.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Importer depuis un tableur', corps, '<button class="btn primaire" value="ok">Importer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      if (!resultat) return 'Choisis d\'abord un fichier CSV.';
      if (resultat.quoi !== fd.get('quoi')) return 'Le contenu a changé : choisis à nouveau le fichier.';
      const r = resultat;
      if (!r.ajouts && !r.majs) return 'Aucune ligne à importer.';
      retenir();
      if (r.quoi === 'sites') E.sites = r.sites;
      else { E.equipements = r.equipements; E.operations.push(...r.operations); E.familles = r.familles; }
      sauver(); rendre();
      toast(`Import : ${pluriel(r.ajouts, 'ajout')}, ${pluriel(r.majs, 'mise à jour', 'mises à jour')}${r.erreurs.length ? `, ${pluriel(r.erreurs.length, 'remarque')}` : ''}.`, { libelle: 'Annuler', faire: annuler });
    });
    const d = modale();
    const analyser = async () => {
      const fichier = d.querySelector('#m-fichier').files[0];
      const ap = d.querySelector('#m-apercu');
      if (!fichier) { resultat = null; ap.hidden = true; return; }
      const q = d.querySelector('[name=quoi]:checked, [name=quoi][type=hidden]').value;
      const txt = await fichier.text();
      const r = q === 'sites' ? R.importerSites(E, B, txt, uid) : R.importerEquipements(E, B, txt, uid, auj());
      resultat = { ...r, quoi: q };
      ap.hidden = false;
      ap.innerHTML = `<p><b>${pluriel(r.ajouts, 'ajout')}</b>, <b>${pluriel(r.majs, 'mise à jour', 'mises à jour')}</b>${q === 'equipements' && r.operations?.length ? `, ${pluriel(r.operations.length, 'opération')} au plan` : ''}${r.erreurs.length ? `, ${pluriel(r.erreurs.length, 'remarque')}` : ''}.</p>${r.erreurs.length ? `<ul>${r.erreurs.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}${r.erreurs.length > 8 ? `<li>… et ${r.erreurs.length - 8} autres.</li>` : ''}</ul>` : ''}`;
      d.querySelector('.erreur').textContent = '';
    };
    d.querySelector('#m-fichier').addEventListener('change', analyser);
    d.querySelectorAll('[name=quoi]').forEach((x) => x.addEventListener('change', analyser));
  }

  // ---------- Pièces : fiche et mouvements ----------
  function modalePiece(id) {
    const p = id ? piece(id) : null;
    const v = p || { ref: '', nom: '', unite: 'pièce', emplacement: '', fournisseur: '', prix: null, seuil: 0, note: '' };
    const hist = p ? E.mouvementsPieces.filter((m) => m.piece === id).map((m) => ({ date: m.date, q: m.quantite, lib: m.type === 'reception' ? 'Réception' : 'Ajustement', note: m.note, id: m.id }))
      .concat(E.interventions.filter((i) => i.statut === 'fait').flatMap((i) => i.pieces.filter((x) => x.piece === id).map((x) => ({ date: i.dateRealisee, q: -x.quantite, lib: `Bon ${i.numero}`, note: nomEq(i.equipement) }))))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20) : [];
    const corps = `
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 140px">Référence<input name="ref" maxlength="30" value="${esc(v.ref)}"></label>
        <label class="champ">Nom<input name="nom" maxlength="100" required value="${esc(v.nom)}" placeholder="Ex. : Courroie trapézoïdale"></label>
      </div>
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 140px">Unité<input name="unite" maxlength="20" list="l-unites" value="${esc(v.unite)}"></label>
        <label class="champ">Prix unitaire HT<input name="prix" inputmode="decimal" value="${R.saisieMontant(v.prix)}" placeholder="0,00"></label>
        <label class="champ">Seuil d'alerte<input name="seuil" inputmode="decimal" value="${R.saisieNombre(v.seuil)}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Emplacement<input name="emplacement" maxlength="60" value="${esc(v.emplacement)}"></label>
        <label class="champ">Fournisseur <small>Texte libre.</small><input name="fournisseur" maxlength="80" value="${esc(v.fournisseur)}"></label>
      </div>
      ${p ? '' : '<label class="champ">Stock actuel <small>Enregistré comme une réception datée d\'aujourd\'hui.</small><input name="initial" inputmode="decimal" placeholder="0"></label>'}
      ${listeDonnees('l-unites', [...B.unitesPieces, ...E.pieces.map((x) => x.unite)])}
      ${p ? `<p class="mention">Stock : <b>${nombre(R.stockPiece(E, p.id))} ${esc(p.unite)}</b></p>${hist.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>Date</th><th>Mouvement</th><th class="nb">Qté</th><th></th></tr></thead><tbody>${hist.map((h) => `<tr><td>${dateCourte(h.date)}</td><td>${esc(h.lib)}${h.note ? `<br><small>${esc(h.note)}</small>` : ''}</td><td class="nb">${h.q > 0 ? '+' : ''}${nombre(h.q)}</td><td>${h.id ? `<button type="button" class="btn-suppr" data-action="suppr-mvt-piece" data-id="${h.id}" data-retour="${p.id}" aria-label="Supprimer ce mouvement">×</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = p
      ? `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" type="button" data-action="mvt-piece" data-id="${p.id}">Réception ou ajustement</button><button class="btn danger gauche" value="supprimer">Supprimer</button>`
      : '<button class="btn primaire" value="ok">Créer la pièce</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(p ? esc(p.nom) : 'Nouvelle pièce', corps, pied, (fd, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer « ${p.nom} » et ses réceptions ? Les bons gardent leurs montants.`)) { garderOuverte(); return; }
        retenir();
        E.pieces = E.pieces.filter((x) => x.id !== p.id);
        E.mouvementsPieces = E.mouvementsPieces.filter((m) => m.piece !== p.id);
        E.operations.forEach((o) => { o.pieces = o.pieces.filter((x) => x.piece !== p.id); });
        sauver(); rendre(); toast('Pièce supprimée.', { libelle: 'Annuler', faire: annuler });
        return;
      }
      const nom = String(fd.get('nom') || '').trim();
      if (!nom) return 'Donne un nom à la pièce.';
      const prix = R.lireMontant(fd.get('prix')), seuil = R.lireNombre(fd.get('seuil')), initial = R.lireNombre(fd.get('initial'));
      if (Number.isNaN(prix) || Number.isNaN(seuil) || Number.isNaN(initial)) return 'Prix, seuil ou stock illisible.';
      retenir();
      const donnees = R.normaliserPiece({ id: p?.id || uid(), ref: fd.get('ref'), nom, unite: fd.get('unite'), prix: prix ?? 0, seuil: seuil ?? 0, emplacement: fd.get('emplacement'), fournisseur: fd.get('fournisseur'), note: v.note });
      if (p) Object.assign(p, donnees);
      else {
        E.pieces.push(donnees);
        if (initial > 0) E.mouvementsPieces.push(R.normaliserMouvement({ id: uid(), piece: donnees.id, date: auj(), type: 'reception', quantite: initial, prix: donnees.prix, note: 'Stock de départ' }));
      }
      sauver(); rendre();
      toast(p ? `« ${nom} » enregistrée.` : `« ${nom} » créée.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleMvtPiece(id) {
    const p = piece(id);
    if (!p) return;
    const corps = `
      <p class="mention">${esc(p.nom)} · stock actuel <b>${nombre(R.stockPiece(E, p.id))} ${esc(p.unite)}</b></p>
      <fieldset class="champ"><legend>Mouvement</legend><div class="choix-statut deux"><label><input type="radio" name="type" value="reception" checked><span>Réception</span></label><label><input type="radio" name="type" value="ajustement"><span>Ajustement (+ ou −)</span></label></div></fieldset>
      <div class="rang-champs">
        <label class="champ">Quantité<input name="quantite" inputmode="decimal" required autocomplete="off"></label>
        <label class="champ">Date<input type="date" name="date" value="${auj()}"></label>
      </div>
      <label class="champ">Note<input name="note" maxlength="200" placeholder="N° de bon de livraison, inventaire…"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Réception ou ajustement', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const type = fd.get('type');
      const q = R.lireNombre(fd.get('quantite'), { signe: type === 'ajustement' });
      if (!q || Number.isNaN(q)) return 'Quantité illisible : écris par exemple 2, ou -1 pour un ajustement.';
      if (!R.estDate(fd.get('date'))) return 'Indique la date.';
      retenir();
      E.mouvementsPieces.push(R.normaliserMouvement({ id: uid(), piece: p.id, date: fd.get('date'), type, quantite: q, prix: p.prix, note: fd.get('note') }));
      sauver(); rendre();
      toast(`${p.nom} : stock à ${nombre(R.stockPiece(E, p.id))} ${p.unite}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // ---------- Impression ----------
  function imprimer(html) {
    $('#impression').innerHTML = html;
    if (modale().open) modale().close();
    setTimeout(() => window.print(), 50);
  }
  function imprimerBon(id) {
    const i = bon(id);
    if (!i) return;
    const eq = equipement(i.equipement);
    const op = i.operation ? operation(i.operation) : null;
    const fait = i.statut === 'fait';
    const champ = (lib, val) => `<tr><th>${lib}</th><td>${val || '&nbsp;'}</td></tr>`;
    imprimer(`
      <header class="imp-tete"><p>${esc(E.entreprise || 'Maintenance')} · Bon d'intervention</p><h1>${esc(i.numero)} · ${esc(i.titre)}</h1>
        <p>${i.type === 'correctif' ? 'Correctif' : 'Préventif'}${op ? ` · ${esc(B.natures[op.nature].nom)}` : ''} · ${R.STATUTS_BON[i.statut]}${i.datePrevue ? ` · prévu le ${R.dateFr(i.datePrevue)}` : ''}</p></header>
      <table>${multi() ? champ('Site', esc(nomSite(eq?.site))) : ''}${champ('Équipement', esc(nomEq(i.equipement)))}${champ('Emplacement', esc(eq?.emplacement))}${champ('Fabricant, modèle, n° de série', esc([eq?.fabricant, eq?.modele, eq?.numeroSerie].filter(Boolean).join(' · ')))}
        ${i.type === 'preventif' ? champ('Échéance visée', [i.echeanceDate && R.dateFr(i.echeanceDate), i.echeanceCompteur !== null && cpt(i.echeanceCompteur, eq?.unite)].filter(Boolean).join(' ou ')) : champ('Panne', esc([i.motif, i.symptome].filter(Boolean).join(' : ')))}
        ${op?.reference ? champ('Référence', esc(op.reference)) : ''}${champ('Intervenant', esc(i.intervenant))}</table>
      ${i.points.length ? `<h2>Points de contrôle</h2><ul class="imp-cases">${i.points.map((p) => `<li><span class="case-imp">${fait && p.fait ? '✓' : ''}</span>${esc(p.texte)}</li>`).join('')}</ul>` : ''}
      <h2>Pièces</h2><table><tr><th>Pièce</th><th>Quantité</th></tr>${i.pieces.map((x) => `<tr><td>${esc(piece(x.piece)?.nom || '')}</td><td>${nombre(x.quantite)}</td></tr>`).join('')}<tr><td>&nbsp;</td><td></td></tr><tr><td>&nbsp;</td><td></td></tr></table>
      <h2>Réalisation</h2>
      <table>${champ('Date', fait ? R.dateFr(i.dateRealisee) : '')}${eq?.unite ? champ(`Compteur (${esc(uniteCourte(eq.unite))})`, fait && i.compteur !== null ? nombre(i.compteur) : '') : ''}${champ('Durée', fait && i.duree ? heures(i.duree) : '')}${i.type === 'correctif' ? champ('Arrêt', fait && i.arret ? heures(i.arret) : '') : ''}</table>
      <h2>Constat et travaux faits</h2><div class="imp-zone">${fait ? esc(i.constat) : ''}</div>
      <div class="imp-signatures"><div>Intervenant<br><br>Signature</div><div>Responsable<br><br>Visa</div></div>
      <p class="imp-pied">Imprimé le ${R.dateFr(auj())} · Maintenance préventive · QME</p>`);
  }
  function imprimerEcheancier() {
    const l = R.echeances(E, auj()).filter((x) => ['retard', 'bientot', 'bon', 'avenir'].includes(x.etat) && dansFiltreSite(x.eq));
    imprimer(`<header class="imp-tete"><p>${esc(E.entreprise || 'Maintenance')} · Échéancier</p><h1>Échéances des 90 prochains jours${multi() && filtre.site ? ` · ${esc(nomSite(filtre.site))}` : ''}</h1><p>Au ${R.dateFr(auj())} · ${pluriel(l.length, 'opération')}</p></header>
      <table><tr>${multi() ? '<th>Site</th>' : ''}<th>Équipement</th><th>Opération</th><th>Échéance</th><th>État</th></tr>${l.map((x) => `<tr>${multi() ? `<td>${esc(nomSite(x.eq?.site))}</td>` : ''}<td>${esc(nomEq(x.op.equipement))}</td><td>${esc(x.op.nom)}</td><td>${esc(R.libelleEcheance(x, uniteCourte(x.eq?.unite)))}${x.dateEstimee && x.mode !== 'date' ? ` (≈ ${R.dateFr(x.dateEstimee)})` : ''}</td><td>${R.LIB_ETAT[x.etat]}${x.bon ? ` ${esc(x.bon.numero)}` : ''}</td></tr>`).join('')}</table>
      <p class="imp-pied">Imprimé le ${R.dateFr(auj())} · Maintenance préventive · QME</p>`);
  }

  // ---------- Réglages ----------
  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const r = E.reglages;
    const corps = `
      <div class="rang-champs">
        <label class="champ">Atelier, site ou service<input name="entreprise" maxlength="80" value="${esc(E.entreprise)}"></label>
        <label class="champ">Taux horaire interne HT<input name="tauxHoraire" inputmode="decimal" value="${R.saisieMontant(r.tauxHoraire || null)}" placeholder="Non chiffré"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Alerte « bientôt » (jours)<input type="number" name="alerteJours" min="0" max="365" value="${r.alerteJours}"></label>
        <label class="champ">Alerte au compteur (% de l'intervalle)<input type="number" name="alerteCompteurPct" min="0" max="100" value="${r.alerteCompteurPct}"></label>
      </div>
      <div class="rang-champs">
        <label class="champ">Tolérance de ponctualité (jours)<input type="number" name="toleranceJours" min="0" max="90" value="${r.toleranceJours}"></label>
        <label class="champ">Période des indicateurs (jours)<input type="number" name="periodeIndicateurs" min="7" max="730" value="${r.periodeIndicateurs}"></label>
        <label class="champ">Préfixe des bons<input name="prefixeBon" maxlength="6" value="${esc(r.prefixeBon)}"></label>
      </div>
      <div class="groupe"><h3>Sites</h3>
        <label class="case"><input type="checkbox" name="multiSites" id="choix-multi" ${multi() ? 'checked' : ''}> Plusieurs sites : équipements rangés par site, vue d'ensemble, alertes de visite, disponibilité et coût par site, carte schématique</label>
        <p class="aide" id="aide-multi">${multi() ? `${pluriel(E.sites.length, 'site')}. Décocher garde les sites et le rangement de chaque équipement : ils reviennent si tu recoches.` : 'Tes équipements actuels iront dans un premier site (au nom de l\'atelier, modifiable), sans rien perdre.'}</p>
        <div class="rang-champs">
          <label class="champ">Alerte d'arrêt après (jours) <small>Équipement à l'arrêt depuis ce délai.</small><input type="number" name="arretJours" min="1" max="365" value="${r.arretJours}"></label>
          <label class="champ" id="champ-visite" ${multi() ? '' : 'hidden'}>Site sans visite après (mois)<input type="number" name="visiteMois" min="1" max="36" value="${r.visiteMois}"></label>
        </div></div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Tableur (CSV)</h3><p class="aide">Point-virgule, encodé en UTF-8 : s'ouvre dans Excel, LibreOffice ou Numbers. L'échéancier, tous les bons avec leurs coûts, les coûts par équipement, la liste des équipements${multi() ? ', les sites avec leurs indicateurs' : ''}. L'import part du modèle.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-echeancier">Échéancier (CSV)</button><button class="btn petit" type="button" data-action="csv-bons">Interventions (CSV)</button><button class="btn petit" type="button" data-action="csv-couts">Coûts par équipement (CSV)</button><button class="btn petit" type="button" data-action="csv-equipements">Équipements (CSV)</button>${multi() ? '<button class="btn petit" type="button" data-action="csv-sites">Sites (CSV)</button>' : ''}</div>
        <div class="rang"><button class="btn petit" type="button" data-action="import">Importer (CSV)</button>${multi() ? '<button class="btn petit" type="button" data-action="csv-modele-sites">Modèle des sites</button>' : ''}<button class="btn petit" type="button" data-action="csv-modele-equipements">Modèle des équipements</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'} Une copie de l'ancien Pilotage de parcs multi-sites se restaure aussi : elle passe en plusieurs sites.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="aide">Toute personne qui a la clé voit et modifie les mêmes données : partage-la seulement avec ton équipe de maintenance.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Comment ça marche</h3><p class="aide">Les grands principes de la maintenance, en une page.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="tutoriel">Revoir le guide</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour relever un compteur ou clôturer un bon depuis l'atelier.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Plans types : ${B.familles.length} familles, ${B.familles.reduce((s, f) => s + f.plan.length, 0)} opérations ; périodicités indicatives, la notice du fabricant prime. Obligations sourcées (vérifiées le ${R.dateFr(B.verifieLe)}, à revoir chaque année) : ${Object.values(B.regles).map((x) => `${esc(x.titre)} (${esc(x.source)})`).join(' ; ')} Les autres vérifications réglementaires n'ont pas de périodicité en base : saisis celle de ton texte. Option plusieurs sites : la carte place les sites d'après les coordonnées saisies, sans fond de carte ni service en ligne. Aucun capteur, logiciel ou prestataire connecté.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Math.round(Number(fd.get(nom))); return String(fd.get(nom)).trim() !== '' && n >= min && n <= max ? n : null; };
      const vals = { alerteJours: ent('alerteJours', 0, 365), alerteCompteurPct: ent('alerteCompteurPct', 0, 100), toleranceJours: ent('toleranceJours', 0, 90), periodeIndicateurs: ent('periodeIndicateurs', 7, 730), arretJours: ent('arretJours', 1, 365), visiteMois: ent('visiteMois', 1, 36) };
      if (Object.values(vals).some((x) => x === null)) return 'Vérifie les nombres de jours, de mois et le pourcentage.';
      const taux = R.lireMontant(fd.get('tauxHoraire'));
      if (Number.isNaN(taux)) return 'Taux horaire illisible : écris par exemple 45.';
      const veutMulti = !!fd.get('multiSites');
      if (!veutMulti && multi() && E.sites.length > 1 && !confirm(`Revenir à un seul site ? Les ${pluriel(E.sites.length, 'site')} restent enregistrés, avec le rangement de chaque équipement : ils reviennent si tu réactives l'option.`)) { garderOuverte(); return; }
      retenir();
      E.entreprise = String(fd.get('entreprise') || '').trim();
      Object.assign(E.reglages, vals, { tauxHoraire: taux ?? 0, prefixeBon: String(fd.get('prefixeBon') || 'BI').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BI' });
      const change = veutMulti !== multi();
      if (change) {
        const tutorielVu = E.tutorielVu;
        if (veutMulti) E = { ...R.activerMultiSites(E, E.entreprise || 'Site principal'), tutorielVu };
        else E.multiSites = false;
        siteOuvert = null; filtre.site = '';
      }
      sauver();
      if (change) { demarrer(); changerVue(veutMulti ? 'sites' : 'equipements'); } else rendre();
      toast(change ? (veutMulti ? `Plusieurs sites : tes équipements sont dans « ${E.sites[0].nom} ». Renomme-le ou crée tes autres sites.` : 'Un seul site : tous tes équipements sont réunis.') : 'Réglages enregistrés.', { libelle: 'Annuler', faire: () => { annuler(); demarrer(); } });
    });
    const choix = $('#choix-multi');
    choix.addEventListener('change', () => { $('#champ-visite').hidden = !choix.checked; });
    $('#import').addEventListener('change', async (ev) => {
      const fichier = ev.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        // Copie de l'ancien Pilotage de parcs multi-sites : convertie en maintenance à plusieurs sites.
        const parcs = R.estCopieParcs(d);
        if (!parcs && (!Array.isArray(d.equipements) || !Array.isArray(d.operations))) throw new Error();
        const message = parcs
          ? `Remplacer tes données actuelles par cette copie du Pilotage de parcs multi-sites (${pluriel(d.sites.length, 'site')}, ${pluriel(d.equipements.length, 'équipement')}, ${pluriel((d.interventions || []).length, 'intervention')}) ? Elle passe en plusieurs sites : la périodicité de chaque équipement devient une opération « Préventif périodique ».`
          : `Remplacer tes données actuelles par cette copie (${pluriel(d.equipements.length, 'équipement')}, ${pluriel((d.interventions || []).length, 'bon')}) ?`;
        if (!confirm(message)) return;
        const vu = E.tutorielVu;
        E = parcs ? normaliser(R.depuisParcs(d, B)) : normaliser(d);
        delete E.majLe; if (vu) E.tutorielVu = true;
        siteOuvert = null; filtre.site = '';
        modale().close(); sauver(); demarrer();
        toast(parcs ? `Copie convertie : ${pluriel(E.sites.length, 'site')}, ${pluriel(E.equipements.length, 'équipement')}, ${pluriel(E.interventions.length, 'bon')}${E.visites.length ? `, ${pluriel(E.visites.length, 'visite')}` : ''}.` : 'Copie restaurée.');
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `maintenance-${auj()}.json`);

  // ---------- Comment ça marche ----------
  // Guide des grands principes : s'ouvre seul une fois par compte (E.tutorielVu, synchronisé avec les
  // données), puis reste accessible par le bouton « ? » de l'en-tête et par les réglages.
  function modaleTutoriel(auto = false) {
    const g = E.reglages;
    const jours = (n) => `${n}&nbsp;jour${n > 1 ? 's' : ''}`;
    const blocs = [
      ['rose', 'Un équipement, un plan', `Crée chaque équipement avec sa famille&nbsp;: le plan de maintenance type de cette famille t'est proposé, à ajuster selon la notice du fabricant. La plupart des vérifications réglementaires arrivent sans périodicité&nbsp;: saisis celle de ton texte, avec sa référence.`],
      ['beurre', 'À la date, au compteur, ou au premier atteint', `Chaque opération a une échéance calendaire, au compteur, ou les deux&nbsp;: la première atteinte compte. Relève les compteurs&nbsp;: la date d'une échéance au compteur est estimée d'après le rythme d'utilisation. Une échéance passe <b>Bientôt</b> jusqu'à ${jours(g.alerteJours)} avant, ou quand il reste moins de ${g.alerteCompteurPct}&nbsp;% de l'intervalle au compteur.`],
      ['ciel', 'Un bon pour chaque intervention', `Depuis une échéance, <b>Ouvrir un bon</b> le prépare avec ses consignes et ses pièces&nbsp;; une panne se signale par un bon correctif. Une panne notée <b>à l'arrêt</b> arrête l'équipement jusqu'à sa clôture&nbsp;: elle compte dans la disponibilité et passe en alerte au bout de ${jours(g.arretJours)}. À la clôture, l'échéance suivante se recale, les pièces sortent du stock et le coût se chiffre&nbsp;: main-d'œuvre${g.tauxHoraire ? ` (${R.euros(g.tauxHoraire).replace(/ /g, '&nbsp;')} de l'heure)` : ''}, pièces et sous-traitance.`],
      ['sable', 'Suis tes indicateurs', `${multi() ? 'La <b>Vue d\'ensemble</b> montre, pour tout le parc puis site par site,' : 'Le <b>Tableau de bord</b> montre'} ce qui est en retard, ce qui est arrêté, le taux de réalisation du préventif et la disponibilité sur ${jours(g.periodeIndicateurs)}, et le coût par ${multi() ? 'site et par ' : ''}équipement sur 12&nbsp;mois, préventif et correctif. Une pièce sous son seuil ou en rupture y apparaît dans les pièces à commander.`],
    ];
    if (multi()) blocs.splice(1, 0, ['ciel', 'Tes sites', `Chaque équipement appartient à un site. L'onglet <b>Sites</b> les montre en liste triable ou sur une carte schématique (d'après la latitude et la longitude saisies, sans fond de carte), avec leur état, leur disponibilité et leur coût&nbsp;; ouvre un site pour ses équipements, ses échéances et son historique. Un site sans visite ni bon clôturé depuis plus de ${g.visiteMois}&nbsp;mois passe en alerte&nbsp;: note tes tournées avec <b>Noter une visite</b>.`]);
    const corps = `
      <p>L'application calcule pour toi quand faire chaque opération de maintenance, et ce qu'elle coûte. Ton rôle&nbsp;: créer tes équipements, relever leurs compteurs et clôturer les bons d'intervention.</p>
      <ol class="tuto">${blocs.map(([t, titre, texte]) => `<li style="--f:var(--${t});--t:var(--${t === 'sable' ? 'encre' : `${t}-texte`})"><b>${titre}</b><span>${texte}</span></li>`).join('')}</ol>
      <p class="aide"><b>Échéancier</b> liste toutes les opérations mois par mois, <b>Pièces</b> calcule le stock de tes pièces de rechange. ${multi() ? 'Tes sites et tes équipements s\'importent depuis un tableur (CSV, modèles dans les réglages). ' : 'Plusieurs sites&nbsp;? Active l\'option dans les réglages. '}Rien n'est relié à un capteur&nbsp;: tout se saisit. ${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé&nbsp;: tu les retrouves sur tous tes appareils.'} Ce guide reste accessible avec le bouton <b>?</b> en haut de l'écran et dans les réglages.</p>`;
    const premier = auto && !E.equipements.length;
    const pied = premier
      ? '<button class="btn primaire" value="equipement">Ajouter mon premier équipement</button><button class="btn" value="ok">Fermer</button>'
      : `<button class="btn primaire" value="ok">${auto ? 'C\'est parti' : 'Compris'}</button>`;
    ouvrirModale('Comment ça marche', corps, pied, (_, choix) => { if (choix === 'equipement') setTimeout(() => modaleEquipement(null), 0); });
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
  const appareil = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'autre';
  };
  const dejaInstalle = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let inviteInstallation = null;
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); inviteInstallation = ev; });
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
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-multi': ouvrirDemo(true, true); break;
      case 'demo-bascule': if (modale().open) modale().close(); ouvrirDemo(true, !multi()); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); const vu = E.tutorielVu; E = donneesDemo(multi()); E.tutorielVu = vu; siteOuvert = null; cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': {
        const t = R.lireMontant(accueil.taux);
        if (Number.isNaN(t)) { $('#erreur-accueil').textContent = 'Taux horaire illisible : écris par exemple 45, ou laisse vide.'; break; }
        accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      }
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); if (el.dataset.vue === 'sites') sousVue = 'sites'; changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'tutoriel': modaleTutoriel(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-echeancier': telecharger(R.csvEcheancier(E, auj()), 'text/csv;charset=utf-8', `echeancier-maintenance-${auj()}.csv`); break;
      case 'csv-bons': telecharger(R.csvInterventions(E), 'text/csv;charset=utf-8', `interventions-${auj()}.csv`); break;
      case 'csv-couts': telecharger(R.csvCouts(E, auj()), 'text/csv;charset=utf-8', `couts-maintenance-${auj()}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'nouvel-eq': modaleEquipement(null, el.dataset.site); break;
      case 'voir-eq': if (id) modaleFiche(id); break;
      case 'modifier-eq': modaleEquipement(id); break;
      case 'releve': modaleReleve(id); break;
      case 'suppr-releve': { retenir(); E.releves = E.releves.filter((r) => r.id !== id); sauver(); rendre(); modaleFiche(el.dataset.retour); toast('Relevé supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'nouvelle-op': modaleOperation(null, id); break;
      case 'modifier-op': modaleOperation(el.dataset.idOp || id); break;
      case 'ouvrir-bon': ouvrirBon(id); break;
      case 'fait-op': faitDirect(id); break;
      case 'voir-bon': modaleBon(id); break;
      case 'cloturer': modaleCloture(id); break;
      case 'demarrer-bon': changerStatutBon(id, 'encours'); break;
      case 'annuler-bon': changerStatutBon(id, 'annule'); break;
      case 'suppr-bon': supprimerBon(id); break;
      case 'imprimer-bon': imprimerBon(id); break;
      case 'imprimer-echeancier': imprimerEcheancier(); break;
      case 'nouveau-correctif': modaleCorrectif(id, el.dataset.site); break;
      // Plusieurs sites.
      case 'voir-site': ouvrirSite(id); break;
      case 'voir-sites': siteOuvert = null; sousVue = 'sites'; changerVue('sites'); break;
      case 'sous-vue': siteOuvert = null; sousVue = el.dataset.sous; rendre(); break;
      case 'filtre-mode': affichage.mode = el.dataset.mode; stock.ecrire(CLE_AFFICHAGE, { mode: affichage.mode }); rendre(); break;
      case 'filtre-tri': { const k = el.dataset.cle; affichage.tri = affichage.tri.cle === k ? { cle: k, sens: -affichage.tri.sens } : { cle: k, sens: ['equipements', 'retards', 'cout', 'delai'].includes(k) ? -1 : 1 }; rendre(); break; }
      case 'filtres-effacer': affichage.f = { texte: '', region: '', type: '', etat: '' }; rendre(); break;
      case 'filtre-ech-site': filtre.site = id; filtre.ech = 'urgent'; changerVue('echeancier'); break;
      case 'aller-sites': sousVue = 'sites'; changerVue('sites'); break;
      case 'aller-retards': filtre.ech = 'urgent'; changerVue('echeancier'); break;
      case 'aller-arrets': filtre.eq = 'arret'; sousVue = 'equipements'; changerVue('sites'); break;
      case 'nouveau-site': modaleSite(null); break;
      case 'modifier-site': modaleSite(id); break;
      case 'nouvelle-visite': modaleVisite(null, id); break;
      case 'modifier-visite': modaleVisite(id); break;
      case 'import': modaleImport(el.dataset.quoi); break;
      case 'csv-sites': telecharger(R.csvSites(E, B, auj()), 'text/csv;charset=utf-8', `sites-maintenance-${auj()}.csv`); break;
      case 'csv-equipements': telecharger(R.csvEquipements(E, B, auj()), 'text/csv;charset=utf-8', `equipements-maintenance-${auj()}.csv`); break;
      case 'csv-modele-sites': telecharger(R.csvModele('sites'), 'text/csv;charset=utf-8', 'modele-sites.csv'); toast('Modèle des sites téléchargé : remplis-le dans ton tableur, enregistre en CSV, puis importe-le.'); break;
      case 'csv-modele-equipements': telecharger(R.csvModele('equipements'), 'text/csv;charset=utf-8', 'modele-equipements.csv'); toast(multi() ? 'Modèle des équipements téléchargé : la colonne « Site » reprend le nom exact du site.' : 'Modèle des équipements téléchargé : laisse la colonne « Site » vide.'); break;
      case 'nouvelle-piece': modalePiece(null); break;
      case 'modifier-piece': modalePiece(id); break;
      case 'mvt-piece': modaleMvtPiece(id); break;
      case 'suppr-mvt-piece': { retenir(); E.mouvementsPieces = E.mouvementsPieces.filter((m) => m.id !== id); sauver(); rendre(); modalePiece(el.dataset.retour); toast('Mouvement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'filtre-ech': if (modale().open) modale().close(); filtre.ech = el.dataset.ech; if (vue !== 'echeancier') changerVue('echeancier'); else rendre(); break;
      case 'filtre-eq': filtre.eq = el.dataset.eq; rendre(); break;
      case 'filtre-bon': filtre.bon = el.dataset.bon; if (vue !== 'interventions') changerVue('interventions'); else rendre(); break;
      case 'filtre-piece': filtre.piece = el.dataset.piece; rendre(); break;
      default: break;
    }
  });

  document.addEventListener('click', (ev) => { if (ev.target === modale()) modale().close(); });
  window.addEventListener('afterprint', () => { $('#impression').innerHTML = ''; });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (ev) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); ev.preventDefault(); } });

  // ---------- Démarrage ----------
  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const code = stock.lire(CLE_CODE);
    // ?demo : l'exemple d'un site ; ?demo=sites : l'exemple à plusieurs sites.
    const demoUrl = new URLSearchParams(location.search).get('demo');
    if (demoUrl !== null && code !== CODE_DEMO && !code) { history.replaceState(null, '', location.pathname + location.hash); return ouvrirDemo(false, demoUrl === 'sites'); }
    if (demoUrl === 'sites' && code === CODE_DEMO) { history.replaceState(null, '', location.pathname + location.hash); return ouvrirDemo(true, true); }
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
  window.__maintenance = { etat: () => E, regles: R, demo: (multiSites = false) => donneesDemo(multiSites) };
  init();
})();
