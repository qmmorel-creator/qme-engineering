// Maintenance préventive QME (GMAO légère) : équipements, plans de maintenance, échéances à la date, au
// compteur ou au premier atteint, bons d'intervention imprimables, historique, pièces de rechange, coûts et
// indicateurs. Données synchronisées par clé de licence ou code d'accès. Aucun capteur ni logiciel connecté.
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
  const filtre = { ech: 'urgent', famille: '', q: '', eq: 'actifs', qe: '', bon: 'afaire', qb: '', piece: 'tous' };
  let annulation = null;

  const etatVide = () => R.etatVide(B.reglages);
  const normaliser = (d) => R.normaliser(d, B.reglages);
  const equipement = (id) => E.equipements.find((e) => e.id === id);
  const operation = (id) => E.operations.find((o) => o.id === id);
  const bon = (id) => E.interventions.find((i) => i.id === id);
  const piece = (id) => E.pieces.find((p) => p.id === id);
  const nomEq = (id) => { const e = equipement(id); return e ? `${e.repere ? `${e.repere} · ` : ''}${e.nom}` : 'Équipement supprimé'; };
  const famille = (id) => B.familles.find((f) => f.id === id);

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
        E = normaliser(corps.donnees);
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
  // Atelier de mécanique fictif : 11 équipements, 12 mois d'historique simulés avec les vraies règles
  // (relevés hebdomadaires, bons clôturés à l'échéance, parfois en retard), à des dates relatives à
  // aujourd'hui. États forcés : retard à la date (pont roulant), retard au compteur (séparateur du
  // compresseur), bientôt au compteur (graissage du centre d'usinage), bon planifié (révision du chariot),
  // bon en cours (groupe électrogène), fait aujourd'hui (contrôle hebdomadaire), réglementaires à
  // paramétrer, équipement archivé, pannes avec arrêt, pièce sous le seuil, pièce en rupture.
  function donneesDemo() {
    const e = etatVide();
    e.entreprise = 'Atelier Exemple';
    e.reglages.tauxHoraire = 4500;
    e.familles = ['compresseur', 'usinage', 'chariot', 'levage', 'groupe', 'chaudiere', 'clim', 'porte', 'pompe', 'incendie'];
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
      { repere: 'CMP-01', nom: 'Compresseur à vis 15 kW', famille: 'compresseur', emplacement: 'Local compresseur', criticite: 'A', unite: 'h', initial: 8200, parJour: 9, fabricant: 'Fabricant Exemple', codes: ['cmp-hebdo', 'cmp-filtre', 'cmp-vidange', 'cmp-separateur', 'cmp-reservoir'] },
      { repere: 'USI-01', nom: 'Centre d\'usinage vertical', famille: 'usinage', emplacement: 'Atelier, travée 1', criticite: 'A', unite: 'h', initial: 11400, parJour: 7.5, codes: ['usi-graissage', 'usi-coupe', 'usi-geometrie'] },
      { repere: 'TOU-02', nom: 'Tour conventionnel', famille: 'usinage', emplacement: 'Atelier, travée 2', criticite: 'C', unite: 'h', initial: 21000, parJour: 2, codes: ['usi-graissage', 'usi-coupe'] },
      { repere: 'CHA-01', nom: 'Chariot élévateur électrique 2,5 t', famille: 'chariot', emplacement: 'Quai d\'expédition', criticite: 'B', unite: 'h', initial: 3100, parJour: 3.2, codes: ['cha-batterie', 'cha-revision', 'cha-vgp'] },
      { repere: 'PON-01', nom: 'Pont roulant 5 t', famille: 'levage', emplacement: 'Atelier, travée 1', criticite: 'A', unite: '', codes: ['lev-visuel', 'lev-graissage', 'lev-vgp'] },
      { repere: 'GE-01', nom: 'Groupe électrogène de secours', famille: 'groupe', emplacement: 'Extérieur, abri', criticite: 'B', unite: 'h', initial: 410, parJour: 0, codes: ['gro-essai', 'gro-vidange', 'gro-charge'] },
      { repere: 'CHD-01', nom: 'Chaudière gaz des bureaux', famille: 'chaudiere', emplacement: 'Bureaux, chaufferie', criticite: 'B', unite: '', codes: ['chd-annuel', 'chd-pression'] },
      { repere: 'CLI-01', nom: 'Climatisation de la salle serveur', famille: 'clim', emplacement: 'Bureaux, salle serveur', criticite: 'A', unite: '', codes: ['cli-filtres', 'cli-exterieur', 'cli-legal'] },
      { repere: 'POR-01', nom: 'Porte sectionnelle du quai', famille: 'porte', emplacement: 'Quai d\'expédition', criticite: 'B', unite: 'cycles', initial: 30500, parJour: 26, codes: ['por-securites', 'por-entretien', 'por-ressorts'] },
      { repere: 'POM-01', nom: 'Pompe de relevage', famille: 'pompe', emplacement: 'Extérieur, regard sud', criticite: 'C', unite: 'h', initial: 5200, parJour: 1.1, codes: ['pom-controle', 'pom-nettoyage'] },
      { repere: 'INC-01', nom: 'Extincteurs du site (12 appareils)', famille: 'incendie', emplacement: 'Tout le site', criticite: 'A', unite: '', codes: ['inc-extincteurs', 'inc-baes'] },
      { repere: 'TOU-01', nom: 'Ancien tour (réformé)', famille: 'usinage', emplacement: 'Réserve', criticite: 'C', unite: 'h', initial: 30000, parJour: 0, codes: ['usi-graissage'], archive: true, note: 'Réformé, en attente de revente.' },
    ];
    const eqs = {};
    for (const s of specs) {
      const eq = R.normaliserEquipement({ id: uid(), repere: s.repere, nom: s.nom, famille: s.famille, emplacement: s.emplacement, criticite: s.criticite, unite: s.unite, compteurInitial: s.initial ?? 0, miseEnService: j(DEBUT - 30), fabricant: s.fabricant || 'Fabricant Exemple', archive: !!s.archive, note: s.note || '' });
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
    const panne = (rep, d, titre, motif, duree, arret, piecesU = [], st = 0, constat = '') => {
      const x = eqs[rep];
      const b = R.normaliserIntervention({ id: uid(), numero: R.numeroBon(e, j(d)), equipement: x.eq.id, type: 'correctif', statut: 'fait', titre, motif, datePrevue: j(d), dateRealisee: j(d), duree, arret, intervenant: st ? 'Prestataire Exemple' : 'Technicien B', sousTraitance: st, symptome: titre, constat, pieces: piecesU.map(([p, q]) => ({ piece: p.id, quantite: q, prix: p.prix })) });
      if (x.eq.unite) b.compteur = R.compteurActuel(R.pointsCompteur(e, x.eq), j(d));
      e.interventions.push(b);
    };
    panne('CMP-01', -142, 'Fuite d\'air au raccord du sécheur', 'Fuite', 1.5, 2, [], 0, 'Raccord remplacé, réseau remis en pression.');
    panne('POR-01', -64, 'La porte se rouvre seule en fermeture', 'Défaut électrique', 1, 3, [[cellule, 1]], 0, 'Cellule photoélectrique remplacée, sécurités essayées.');
    panne('USI-01', -23, 'Alarme de lubrification centralisée', 'Encrassement', 2.5, 6, [[graisse, 1]], 0, 'Doseur bouché nettoyé, circuit purgé.');
    panne('CLI-01', -200, 'Température haute en salle serveur', 'Usure', 3, 0, [], 46000, 'Ventilateur de l\'unité extérieure remplacé par le prestataire.');
    // Bon correctif ouvert : bruit sur la pompe de relevage.
    e.interventions.push(R.normaliserIntervention({ id: uid(), numero: R.numeroBon(e, j(-1)), equipement: eqs['POM-01'].eq.id, type: 'correctif', statut: 'planifie', titre: 'Bruit anormal au démarrage', motif: 'Cause inconnue', datePrevue: j(2), symptome: 'Bruit métallique au démarrage, signalé par l\'équipe du matin.', intervenant: 'Technicien A' }));
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
          <p>Tes équipements, leurs plans de maintenance, les échéances à la date ou au compteur, les bons d'intervention et le coût de chaque machine, sans tableur.</p>
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
  let accueil = { etape: 1, entreprise: '', taux: '', familles: [] };

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
    document.querySelectorAll('[name=famille]').forEach((el) => el.addEventListener('change', () => { accueil.familles = [...document.querySelectorAll('[name=famille]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    E = etatVide();
    E.entreprise = accueil.entreprise.trim();
    const t = R.lireMontant(accueil.taux);
    E.reglages.tauxHoraire = Number.isFinite(t) ? t : 0;
    E.familles = accueil.familles;
    accueil = { etape: 1, entreprise: '', taux: '', familles: [] };
    vue = 'equipements';
    sauver();
    demarrer();
    toast('Ta maintenance est prête. Crée ton premier équipement.');
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    echeancier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="18" height="4" fill="currentColor"/></svg>',
    equipements: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    interventions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    pieces: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['echeancier', 'Échéancier'], ['equipements', 'Équipements'], ['interventions', 'Interventions'], ['pieces', 'Pièces']];
  const COURTS = { tableau: 'Tableau', interventions: 'Bons' };
  const AVERTISSEMENT = '<p class="mention avertissement">Outil d\'organisation de la maintenance : les périodicités des plans types sont des repères indicatifs (la notice du fabricant prime) et la liste des vérifications réglementaires n\'est pas exhaustive. Leur périodicité se saisit d\'après le texte applicable ; la conformité de ton site reste de ta responsabilité.</p>';
  const COULEUR_ETAT = { retard: 'rouge', bientot: 'jaune', bon: 'ciel', avenir: 'sable', plustard: 'sable', parametrer: 'rose', suspendu: 'sable' };
  const etiquetteEtat = (s) => `<span class="etiquette ${COULEUR_ETAT[s]}">${R.LIB_ETAT[s]}</span>`;
  const COULEUR_BON = { planifie: 'ciel', encours: 'jaune', fait: 'vert', annule: 'sable' };
  const etiquetteBon = (s) => `<span class="etiquette ${COULEUR_BON[s]}">${R.STATUTS_BON[s]}</span>`;
  const etiquetteNature = (n) => (n === 'reglementaire' ? '<span class="etiquette rose">Réglementaire</span>' : n === 'controle' ? '<span class="etiquette sable">Contrôle</span>' : '');
  const etiquetteCrit = (c) => `<span class="crit crit-${c}" title="Criticité ${c} : ${esc(B.criticites.find((x) => x.code === c)?.nom || '')}">${c}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/maintenance/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Données d\'exemple, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Maintenance<br>préventive</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
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
    const titres = Object.fromEntries(ONGLETS);
    document.title = `${titres[vue]} · Maintenance préventive`;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, echeancier: vueEcheancier, equipements: vueEquipements, interventions: vueInterventions, pieces: vuePieces }[vue]();
    brancherInfobulles();
    for (const [sel, cle] of [['#recherche-ech', 'q'], ['#recherche-eq', 'qe'], ['#recherche-bon', 'qb']]) {
      const q = $(sel);
      if (q) q.addEventListener('input', (ev) => { filtre[cle] = ev.target.value; const pos = ev.target.selectionStart; rendre(); const n = $(sel); n.focus(); n.setSelectionRange(pos, pos); });
    }
    $('#filtre-famille')?.addEventListener('change', (ev) => { filtre.famille = ev.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
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
      <button class="lien-ligne" data-action="ouvrir-eq" data-id="${x.eq?.id || ''}"><b>${esc(x.op.nom)}</b><span>${avecEq ? `${esc(nomEq(x.op.equipement))} · ` : ''}${detail.join(' · ')}</span>
        <span class="ligne-etiquettes">${etiquetteEtat(x.etat)}${x.etat === 'bon' && x.urgence === 'retard' ? etiquetteEtat('retard') : ''}${etiquetteNature(x.op.nature)}${dateP && x.etat !== 'parametrer' && !(x.reste !== null && x.reste <= 0 && !x.echDate) ? `<span class="quand">${quand(dateP)}</span>` : ''}</span></button>
      <span class="actions-ligne">${actions}</span></li>`;
  }

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const t = auj();
    const titre = `<div class="vue-tete"><div><h1>Tableau de bord</h1><p>${E.entreprise ? `${esc(E.entreprise)} · ` : ''}Ce qui est en retard, ce qui arrive, et ce que coûte ta maintenance.</p></div>
        <div class="actions"><button class="btn" data-action="nouveau-correctif">${ICONES.plus}Signaler une panne</button><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Nouvel équipement</button></div></div>`;
    if (!E.equipements.length) {
      return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun équipement pour l'instant</h3><p>Crée tes équipements (repère, nom, emplacement, compteur) : le plan de maintenance type de leur famille t'est proposé, puis les échéances se calculent.</p><div class="actions"><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Créer un équipement</button></div></div></div>${AVERTISSEMENT}`;
    }
    const ind = R.indicateurs(E, t);
    const ech = R.echeances(E, t).filter((x) => x.etat !== 'suspendu');
    const urgents = ech.filter((x) => x.urgence === 'retard' || x.urgence === 'bientot');
    const couts = R.coutsParEquipement(E, t);
    const total12 = couts.reduce((s, x) => s + x.total, 0), corr12 = couts.reduce((s, x) => s + x.correctif, 0);
    const ouverts = E.interventions.filter((i) => i.statut === 'planifie' || i.statut === 'encours').sort((a, b) => (a.datePrevue || '').localeCompare(b.datePrevue || ''));
    const pieces = E.pieces.map((p) => R.situationPiece(E, p, t)).filter((s) => s.statut !== 'ok' && (s.equipements.length || s.piece.seuil > 0));
    const aParam = ech.filter((x) => x.etat === 'parametrer').length;
    const tuiles = [
      ['En retard', String(ind.retards), ind.retards ? `${pluriel(ind.retards, 'opération')} dont l'échéance est passée` : 'Aucune échéance dépassée', 'var(--rouge)', 'rond'],
      ['Bientôt', String(ind.bientot), `sous ${pluriel(E.reglages.alerteJours, 'jour')} au plus, à la date ou au compteur estimé`, 'var(--jaune)', ''],
      ['Réalisation du préventif', pct(ind.taux), `${ind.jours} derniers jours · ${pluriel(ind.faits, 'bon')} fait${ind.faits > 1 ? 's' : ''}${ind.ponctualite !== null ? ` · ${pct(ind.ponctualite)} à l'heure` : ''}`, 'var(--bleu)', ''],
      ['Coût sur 12 mois', euros(total12, { centimes: false }), total12 ? `dont ${pct(corr12 / total12 * 100)} en correctif` : 'Clôture des bons pour le chiffrer', 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${aParam ? `<button class="bandeau-info" data-action="filtre-ech" data-ech="parametrer"><span class="etiquette rose">À paramétrer</span><b>${pluriel(aParam, 'opération')} sans périodicité</b><span>Vérifications réglementaires : saisis la périodicité de ton texte pour les suivre.</span></button>` : ''}
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À faire <span>En retard, puis bientôt</span></h2>
          ${urgents.length ? `<ul class="lignes-ech">${urgents.slice(0, 8).map((x) => ligneEcheance(x)).join('')}</ul>${urgents.length > 8 ? `<button class="btn lien" data-action="filtre-ech" data-ech="urgent">Voir les ${urgents.length} échéances</button>` : ''}` : '<div class="vide-etat petit"><div><h3>Rien d\'urgent</h3><p>Aucune échéance en retard ni sous le délai d\'alerte.</p></div></div>'}
        </section>
        <section>
          <h2 class="titre-section">Bons ouverts <span>${pluriel(ouverts.length, 'bon')}</span></h2>
          ${ouverts.length ? `<ul class="journal">${ouverts.slice(0, 6).map(ligneBon).join('')}</ul>` : '<div class="vide-etat petit"><div><h3>Aucun bon ouvert</h3><p>Ouvre un bon depuis une échéance, ou signale une panne.</p></div></div>'}
          ${pieces.length ? `<h2 class="titre-section">Pièces à commander <span>Sous le seuil ou en rupture</span></h2><ul class="journal">${pieces.map(lignePieceCourte).join('')}</ul>` : ''}
        </section>
      </div>
      <h2 class="titre-section">Coût de maintenance par équipement <span>12 derniers mois, préventif et correctif</span></h2>
      ${graphiqueCouts(couts.filter((x) => x.total > 0).slice(0, 10))}
      <h2 class="titre-section">Indicateurs <span>${ind.jours} derniers jours</span></h2>
      <div class="indicateurs">
        <div><span>Taux de réalisation</span><b>${pct(ind.taux)}</b><small>${ind.faits} faits · ${ind.dusNonFaits} bons dus non faits · ${ind.sansBon} en retard sans bon</small></div>
        <div><span>Ponctualité</span><b>${pct(ind.ponctualite)}</b><small>Faits au plus tard à l'échéance + ${pluriel(E.reglages.toleranceJours, 'jour')}</small></div>
        <div><span>Retard moyen</span><b>${ind.retardMoyen ? `${nombre(ind.retardMoyen, 1)} j` : '0 j'}</b><small>Parmi les bons faits après l'échéance</small></div>
        <div><span>Pannes</span><b>${ind.pannes}</b><small>${heures(ind.arret)} d'arrêt · préventif ${pct(ind.partPreventif)} du coût</small></div>
      </div>
      ${AVERTISSEMENT}`;
  }

  // Coût par équipement : barres empilées préventif (bleu) / correctif (rouge), légende, tableau accessible.
  function graphiqueCouts(lignes) {
    if (!lignes.length) return '<div class="vide-etat petit"><div><h3>Aucun coût sur 12 mois</h3><p>Le coût apparaît dès qu\'un bon est clôturé avec une durée, des pièces ou de la sous-traitance.</p></div></div>';
    const max = Math.max(...lignes.map((x) => x.total), 1);
    const barres = lignes.map((x) => `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(x.eq.nom)}</b>Préventif ${euros(x.preventif)}<br>Correctif ${euros(x.correctif)}<br>${pluriel(x.bons, 'bon')} · ${x.pannes ? `${pluriel(x.pannes, 'panne')}, ${heures(x.arret)} d'arrêt` : 'aucune panne'}`)}">
        <span class="bc-nom">${esc(x.eq.repere || x.eq.nom)}<small>${esc(x.eq.repere ? x.eq.nom : '')}</small></span>
        <span class="bc-piste"><span class="bc-barre" style="width:${(x.preventif / max) * 100}%"></span><span class="bc-barre corr" style="left:${(x.preventif / max) * 100}%;width:${(x.correctif / max) * 100}%"></span></span>
        <span class="bc-val"><b>${euros(x.total, { centimes: false })}</b><small>${x.correctif ? `${euros(x.correctif, { centimes: false })} correctif` : 'préventif'}</small></span>
      </div>`).join('');
    return `<figure class="graphique">
        <div class="legende"><span><i class="pt-prev"></i>Préventif</span><span><i class="pt-corr"></i>Correctif</span></div>
        <div class="barres-cats">${barres}</div>
        <div class="infobulle" hidden></div>
      </figure>
      <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau"><caption class="sr-only">Coût de maintenance par équipement sur 12 mois</caption><thead><tr><th>Équipement</th><th class="nb">Préventif</th><th class="nb">Correctif</th><th class="nb">Total</th><th class="nb">Arrêt</th></tr></thead>
        <tbody>${lignes.map((x) => `<tr><td>${esc(nomEq(x.eq.id))}</td><td class="nb">${euros(x.preventif)}</td><td class="nb">${euros(x.correctif)}</td><td class="nb">${euros(x.total)}</td><td class="nb">${heures(x.arret)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
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

  // ---------- Échéancier ----------
  const FILTRES_ECH = [['urgent', 'À faire'], ['bon', 'Bon ouvert'], ['avenir', 'À venir'], ['plustard', 'Plus tard'], ['parametrer', 'À paramétrer'], ['tous', 'Toutes']];
  const garderEch = (x, f) => (f === 'tous' ? x.etat !== 'suspendu' : f === 'urgent' ? x.etat === 'retard' || x.etat === 'bientot' : x.etat === f);
  function vueEcheancier() {
    const t = auj();
    const q = R.plat(filtre.q.trim());
    const toutes = R.echeances(E, t).filter((x) => !filtre.famille || x.eq?.famille === filtre.famille)
      .filter((x) => !q || R.plat(`${x.op.nom} ${x.eq?.nom} ${x.eq?.repere} ${x.eq?.emplacement}`).includes(q));
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
          <label class="champ"><span class="sr-only">Famille</span><select id="filtre-famille"><option value="">Toutes les familles</option>${fams.map((f) => `<option value="${esc(f)}" ${f === filtre.famille ? 'selected' : ''}>${esc(famille(f)?.nom || f)}</option>`).join('')}</select></label>
          <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-ech" type="search" placeholder="Opération, équipement" value="${esc(filtre.q)}"></label>
        </div>
      </div>
      ${liste.length ? [...groupes].map(([g, l]) => `<h2 class="titre-cat">${esc(g.charAt(0).toUpperCase() + g.slice(1))} <span>${pluriel(l.length, 'opération')}</span></h2><ul class="lignes-ech">${l.map((x) => ligneEcheance(x)).join('')}</ul>`).join('')
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.operations.length ? 'Aucune échéance dans ce filtre' : 'Aucun plan de maintenance'}</h3><p>${E.operations.length ? 'Change le filtre ou la recherche.' : 'Crée un équipement : le plan type de sa famille te sera proposé.'}</p></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Équipements ----------
  const FILTRES_EQ = [['actifs', 'Tous'], ['retard', 'En retard'], ['A', 'Critiques'], ['archives', 'Archivés']];
  function vueEquipements() {
    const t = auj();
    const q = R.plat(filtre.qe.trim());
    const ech = R.echeances(E, t);
    const infos = E.equipements.map((eq) => {
      const l = ech.filter((x) => x.eq?.id === eq.id && x.etat !== 'suspendu' && x.etat !== 'parametrer');
      const prochaine = l.filter((x) => x.prevue).sort((a, b) => a.prevue.localeCompare(b.prevue))[0];
      return { eq, prochaine, retard: l.some((x) => x.urgence === 'retard'), bientot: l.some((x) => x.urgence === 'bientot'), compteur: R.compteurActuel(R.pointsCompteur(E, eq), t), cout: R.coutsEquipement(E, eq.id, ajout(t, -365), t).total, nbOps: E.operations.filter((o) => o.equipement === eq.id).length };
    });
    const garder = (x, f) => (f === 'archives' ? x.eq.archive : !x.eq.archive && (f === 'actifs' || (f === 'retard' && x.retard) || (f === 'A' && x.eq.criticite === 'A')));
    const liste = infos.filter((x) => garder(x, filtre.eq) && (!q || R.plat(`${x.eq.repere} ${x.eq.nom} ${x.eq.emplacement} ${x.eq.fabricant} ${famille(x.eq.famille)?.nom || ''}`).includes(q)))
      .sort((a, b) => (a.eq.emplacement || '').localeCompare(b.eq.emplacement || '') || (a.eq.repere || a.eq.nom).localeCompare(b.eq.repere || b.eq.nom));
    return `
      <div class="vue-tete"><div><h1>Équipements</h1><p>Chaque équipement porte son plan de maintenance, ses relevés de compteur, son historique et son coût. Ouvre une fiche pour tout voir.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Nouvel équipement</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les équipements">${FILTRES_EQ.map(([id, lib]) => `<button class="filtre" data-action="filtre-eq" data-eq="${id}" aria-pressed="${filtre.eq === id}">${lib} <small>${infos.filter((x) => garder(x, id)).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-eq" type="search" placeholder="Repère, nom, emplacement" value="${esc(filtre.qe)}"></label>
      </div>
      ${liste.length ? `<ul class="lignes-fac">${liste.map((x) => `<li class="ligne-fac ${x.eq.archive ? 'st-resilie' : x.retard ? 'alerte-depasse' : x.bientot ? 'alerte-proche' : ''}">
        <button class="ligne-info" data-action="ouvrir-eq" data-id="${x.eq.id}">
          <b>${etiquetteCrit(x.eq.criticite)} ${esc(x.eq.nom)}${x.eq.repere ? ` <span class="numero">${esc(x.eq.repere)}</span>` : ''}</b>
          <span class="ligne-detail">${[famille(x.eq.famille)?.nom, x.eq.emplacement].filter(Boolean).map(esc).join(' · ') || 'Sans famille'} · ${pluriel(x.nbOps, 'opération')}</span>
          <span class="ligne-etiquettes">${x.eq.archive ? '<span class="etiquette sable">Archivé</span>' : ''}${x.retard ? etiquetteEtat('retard') : x.bientot ? etiquetteEtat('bientot') : ''}${x.prochaine && !x.eq.archive ? `<span class="ligne-proch">Prochaine : ${esc(x.prochaine.op.nom)}, ${dateCourte(x.prochaine.prevue)}</span>` : ''}</span>
        </button>
        <div class="ligne-droite">
          <span class="ligne-cout"><b>${x.eq.unite ? cpt(x.compteur, x.eq.unite) : '—'}</b><small>${x.cout ? `${euros(x.cout, { centimes: false })} sur 12 mois` : 'aucun coût sur 12 mois'}</small></span>
          ${x.eq.unite && !x.eq.archive ? `<button class="btn petit" data-action="releve" data-id="${x.eq.id}">Relevé</button>` : ''}
        </div></li>`).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>${E.equipements.length ? 'Aucun équipement ne correspond' : 'Aucun équipement'}</h3><p>${E.equipements.length ? 'Change le filtre ou la recherche.' : 'Crée ton premier équipement : le plan type de sa famille t\'est proposé.'}</p><div class="actions"><button class="btn primaire" data-action="nouvel-eq">${ICONES.plus}Nouvel équipement</button></div></div></div>`}
      ${AVERTISSEMENT}`;
  }

  // ---------- Interventions ----------
  function ligneBon(i) {
    const c = R.coutBon(i, E.reglages);
    const d = i.statut === 'fait' ? i.dateRealisee : i.datePrevue;
    const enRetard = (i.statut === 'planifie' || i.statut === 'encours') && d && d < auj();
    return `<li><span class="date-pastille ${enRetard ? 'retard' : ''}">${d ? `<b>${versDate(d).getDate()}</b>${fmt(d, { month: 'short' }).replace('.', '')}` : '<b>–</b>'}</span>
      <button class="lien-ligne" data-action="voir-bon" data-id="${i.id}"><b>${esc(i.titre || 'Intervention')}</b><span>${esc(i.numero)} · ${esc(nomEq(i.equipement))}${i.intervenant ? ` · ${esc(i.intervenant)}` : ''}</span>
        <span class="ligne-etiquettes">${etiquetteBon(i.statut)}${i.type === 'correctif' ? '<span class="etiquette rose">Correctif</span>' : ''}${enRetard ? etiquetteEtat('retard') : ''}</span></button>
      <span class="nb">${i.statut === 'fait' && c.total ? euros(c.total) : ''}</span></li>`;
  }
  const FILTRES_BON = [['afaire', 'À faire'], ['encours', 'En cours'], ['fait', 'Faits'], ['correctif', 'Correctifs'], ['annule', 'Annulés'], ['tous', 'Tous']];
  const garderBon = (i, f) => (f === 'tous' ? true : f === 'afaire' ? i.statut === 'planifie' || i.statut === 'encours' : f === 'correctif' ? i.type === 'correctif' : i.statut === f);
  function vueInterventions() {
    const q = R.plat(filtre.qb.trim());
    const tous = E.interventions.filter((i) => !q || R.plat(`${i.numero} ${i.titre} ${nomEq(i.equipement)} ${i.intervenant} ${i.constat}`).includes(q));
    const liste = tous.filter((i) => garderBon(i, filtre.bon))
      .sort((a, b) => (filtre.bon === 'afaire' ? 1 : -1) * ((a.dateRealisee || a.datePrevue || '').localeCompare(b.dateRealisee || b.datePrevue || '')));
    const montres = liste.slice(0, 150);
    return `
      <div class="vue-tete"><div><h1>Interventions</h1><p>Les bons d'intervention : préventifs ouverts depuis l'échéancier, correctifs pour les pannes. Clôturer un bon recale l'échéance suivante, sort les pièces du stock et chiffre le coût.</p></div>
        <div class="actions"><button class="btn primaire" data-action="nouveau-correctif">${ICONES.plus}Signaler une panne</button></div></div>
      <div class="outils-liste">
        <div class="filtres" role="group" aria-label="Filtrer les bons">${FILTRES_BON.map(([id, lib]) => `<button class="filtre" data-action="filtre-bon" data-bon="${id}" aria-pressed="${filtre.bon === id}">${lib} <small>${tous.filter((i) => garderBon(i, id)).length}</small></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher</span><input id="recherche-bon" type="search" placeholder="Numéro, équipement, intervenant" value="${esc(filtre.qb)}"></label>
      </div>
      ${montres.length ? `<p class="resume-liste">${pluriel(liste.length, 'bon')}${liste.length > 150 ? ' · 150 affichés (export CSV complet dans les Réglages)' : ''}</p><ul class="journal">${montres.map(ligneBon).join('')}</ul>`
        : `<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun bon dans ce filtre</h3><p>Ouvre un bon depuis l'échéancier, ou signale une panne.</p></div></div>`}
      ${AVERTISSEMENT}`;
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
  function modaleEquipement(id) {
    const eq = id ? equipement(id) : null;
    if (id && !eq) return;
    const fam0 = E.familles[0] || B.familles[0].id;
    const v = eq || { repere: '', nom: '', famille: fam0, emplacement: '', criticite: 'B', unite: famille(fam0)?.compteur || '', compteurInitial: 0, miseEnService: auj(), fabricant: '', modele: '', numeroSerie: '', note: '', archive: false };
    const fams = [...B.familles].sort((a, b) => (E.familles.includes(b.id) - E.familles.includes(a.id)) || a.nom.localeCompare(b.nom));
    const corps = `
      <div class="rang-champs">
        <label class="champ" style="flex:0 1 140px">Repère<input name="repere" maxlength="30" value="${esc(v.repere)}" placeholder="Ex. : CMP-01" autocapitalize="characters"></label>
        <label class="champ">Nom<input name="nom" maxlength="100" required value="${esc(v.nom)}" placeholder="Ex. : Compresseur à vis"></label>
      </div>
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
      if (repere && E.equipements.some((x) => x.repere.toLowerCase() === repere.toLowerCase() && x.id !== eq?.id)) return `Le repère ${repere} est déjà utilisé.`;
      const c0 = R.lireNombre(fd.get('compteurInitial'));
      if (Number.isNaN(c0)) return 'Compteur illisible : écris par exemple 1250 ou 1250,5.';
      const mes = fd.get('miseEnService');
      if (!eq && !R.estDate(mes)) return 'Indique la date de départ du suivi.';
      retenir();
      const donnees = R.normaliserEquipement({ id: eq?.id || uid(), repere, nom, famille: fd.get('famille'), emplacement: fd.get('emplacement'), criticite: fd.get('criticite'), unite: fd.get('unite'), compteurInitial: c0 ?? 0, miseEnService: mes, fabricant: fd.get('fabricant'), modele: fd.get('modele'), numeroSerie: fd.get('numeroSerie'), note: fd.get('note'), archive: !!fd.get('archive') });
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
    const corps = `
      <div class="resume-facture">
        <div><span>Compteur</span><b>${eq.unite ? cpt(c, eq.unite) : 'Sans compteur'}</b><small>${eq.unite ? `${ry ? `≈ ${nombre(ry * 7, 1)} ${uniteCourte(eq.unite)} par semaine` : 'Rythme inconnu : relève le compteur'}${R.dernierReleve(pts) ? ` · relevé le ${dateCourte(R.dernierReleve(pts))}` : ''}` : 'Échéances à la date uniquement'}</small></div>
        <div><span>Criticité</span><b>${eq.criticite} · ${esc(B.criticites.find((x) => x.code === eq.criticite)?.nom)}</b><small>${esc(famille(eq.famille)?.nom || 'Sans famille')}</small></div>
        <div><span>Coût sur 12 mois</span><b>${euros(c12.total)}</b><small>Préventif ${euros(c12.preventif)} · correctif ${euros(c12.correctif)}</small></div>
        <div><span>Pannes sur 12 mois</span><b>${c12.pannes}</b><small>${heures(c12.arret)} d'arrêt · ${euros(tout.total)} depuis le début</small></div>
      </div>
      <p class="mention">${[eq.repere && `Repère ${esc(eq.repere)}`, esc(eq.emplacement), eq.fabricant && esc(eq.fabricant), eq.modele && esc(eq.modele), eq.numeroSerie && `N° ${esc(eq.numeroSerie)}`, eq.miseEnService && `suivi depuis le ${dateLongue(eq.miseEnService)}`].filter(Boolean).join(' · ')}</p>
      ${eq.note ? `<p class="aide">${esc(eq.note)}</p>` : ''}
      <div class="rang">${eq.unite && !eq.archive ? `<button type="button" class="btn petit primaire" data-action="releve" data-id="${eq.id}">Relever le compteur</button>` : ''}<button type="button" class="btn petit" data-action="nouvelle-op" data-id="${eq.id}">Ajouter une opération</button><button type="button" class="btn petit" data-action="nouveau-correctif" data-id="${eq.id}">Signaler une panne</button></div>
      <section class="bloc-detail"><h3>Plan de maintenance <span>${pluriel(ech.length, 'opération')}</span></h3>
        ${ech.length ? `<ul class="lignes-ech compact">${ech.map((x) => ligneEcheance(x, { avecEq: false }).replace('data-action="ouvrir-eq"', `data-action="modifier-op" data-id-op="${x.op.id}"`)).join('')}</ul>` : '<p class="mention">Aucune opération : ajoute celles de la notice du fabricant.</p>'}
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
  function modaleCorrectif(eqId) {
    const actifs = E.equipements.filter((x) => !x.archive).sort((a, b) => (a.repere || a.nom).localeCompare(b.repere || b.nom));
    if (!actifs.length) { toast('Crée d\'abord un équipement.'); modaleEquipement(null); return; }
    const corps = `
      <label class="champ">Équipement<select name="equipement">${actifs.map((x) => `<option value="${x.id}" ${x.id === eqId ? 'selected' : ''}>${esc(nomEq(x.id))}</option>`).join('')}</select></label>
      <label class="champ">Panne constatée<input name="titre" maxlength="160" required placeholder="Ex. : Fuite d'huile sous le carter"></label>
      <div class="rang-champs">
        <label class="champ">Motif<select name="motif">${B.motifsPanne.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
        <label class="champ">Date<input type="date" name="date" value="${auj()}" required></label>
      </div>
      <label class="champ">Description <small>Symptômes, conditions, qui a signalé.</small><textarea name="symptome" rows="3"></textarea></label>
      <label class="champ">Intervenant<input name="intervenant" maxlength="80" list="l-interv"></label>
      ${listeDonnees('l-interv', E.interventions.map((i) => i.intervenant))}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Signaler une panne', corps, '<button class="btn primaire" value="ok">Créer le bon</button><button class="btn" value="cloturer">Déjà réparée</button><button class="btn" value="annuler">Annuler</button>', (fd, action) => {
      const titre = String(fd.get('titre') || '').trim();
      if (!titre) return 'Décris la panne en quelques mots.';
      const date = fd.get('date');
      if (!R.estDate(date)) return 'Indique la date.';
      retenir();
      const b = R.normaliserIntervention({ id: uid(), numero: R.numeroBon(E, date), equipement: fd.get('equipement'), type: 'correctif', statut: 'encours', titre, motif: fd.get('motif'), datePrevue: date, symptome: fd.get('symptome'), intervenant: fd.get('intervenant') });
      E.interventions.push(b);
      sauver(); rendre();
      if (action === 'cloturer') { garderOuverte(); modaleCloture(b.id); return; }
      toast(`Bon ${b.numero} créé (correctif).`, { libelle: 'Annuler', faire: annuler });
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
        <div><span>Équipement</span><b>${esc(nomEq(i.equipement))}</b><small>${esc(eq?.emplacement || '')}</small></div>
        <div><span>Statut</span><b>${etiquetteBon(i.statut)} ${i.type === 'correctif' ? '<span class="etiquette rose">Correctif</span>' : '<span class="etiquette sable">Préventif</span>'}</b><small>${i.statut === 'fait' ? `Fait le ${dateLongue(i.dateRealisee)}` : i.datePrevue ? `Prévu le ${dateLongue(i.datePrevue)}` : ''}</small></div>
        ${i.type === 'preventif' ? `<div><span>Échéance visée</span><b>${i.echeanceDate ? dateCourte(i.echeanceDate) : '–'}</b><small>${i.echeanceCompteur !== null ? `ou ${cpt(i.echeanceCompteur, eq?.unite)}` : ''}</small></div>` : `<div><span>Arrêt</span><b>${heures(i.arret)}</b><small>${esc(i.motif)}</small></div>`}
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
      ${i.type === 'correctif' ? `<label class="champ">Arrêt de l'équipement (h)<input name="arret" inputmode="decimal" value="${R.saisieNombre(i.arret || null)}" placeholder="0"></label>` : ''}
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
      Object.assign(cible, copie, {
        intervenant: String(fd.get('intervenant') || '').trim(), mainOeuvre: mo, sousTraitance: st ?? 0, arret: arret ?? 0, pieces,
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
      <table>${champ('Équipement', esc(nomEq(i.equipement)))}${champ('Emplacement', esc(eq?.emplacement))}${champ('Fabricant, modèle, n° de série', esc([eq?.fabricant, eq?.modele, eq?.numeroSerie].filter(Boolean).join(' · ')))}
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
    const l = R.echeances(E, auj()).filter((x) => ['retard', 'bientot', 'bon', 'avenir'].includes(x.etat));
    imprimer(`<header class="imp-tete"><p>${esc(E.entreprise || 'Maintenance')} · Échéancier</p><h1>Échéances des 90 prochains jours</h1><p>Au ${R.dateFr(auj())} · ${pluriel(l.length, 'opération')}</p></header>
      <table><tr><th>Équipement</th><th>Opération</th><th>Échéance</th><th>État</th></tr>${l.map((x) => `<tr><td>${esc(nomEq(x.op.equipement))}</td><td>${esc(x.op.nom)}</td><td>${esc(R.libelleEcheance(x, uniteCourte(x.eq?.unite)))}${x.dateEstimee && x.mode !== 'date' ? ` (≈ ${R.dateFr(x.dateEstimee)})` : ''}</td><td>${R.LIB_ETAT[x.etat]}${x.bon ? ` ${esc(x.bon.numero)}` : ''}</td></tr>`).join('')}</table>
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
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Tableur (CSV, point-virgule) : l'échéancier, tous les bons avec leurs coûts, ou les coûts par équipement.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-echeancier">Échéancier (CSV)</button><button class="btn petit" type="button" data-action="csv-bons">Interventions (CSV)</button><button class="btn petit" type="button" data-action="csv-couts">Coûts par équipement (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p><p class="aide">Toute personne qui a la clé voit et modifie les mêmes données : partage-la seulement avec ton équipe de maintenance.</p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour relever un compteur ou clôturer un bon depuis l'atelier.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Plans types : ${B.familles.length} familles, ${B.familles.reduce((s, f) => s + f.plan.length, 0)} opérations ; périodicités indicatives, la notice du fabricant prime. Obligations sourcées (vérifiées le ${R.dateFr(B.verifieLe)}, à revoir chaque année) : ${Object.values(B.regles).map((x) => `${esc(x.titre)} (${esc(x.source)})`).join(' ; ')} Les autres vérifications réglementaires n'ont pas de périodicité en base : saisis celle de ton texte. Aucun capteur, logiciel ou prestataire connecté.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const ent = (nom, min, max) => { const n = Math.round(Number(fd.get(nom))); return String(fd.get(nom)).trim() !== '' && n >= min && n <= max ? n : null; };
      const vals = { alerteJours: ent('alerteJours', 0, 365), alerteCompteurPct: ent('alerteCompteurPct', 0, 100), toleranceJours: ent('toleranceJours', 0, 90), periodeIndicateurs: ent('periodeIndicateurs', 7, 730) };
      if (Object.values(vals).some((x) => x === null)) return 'Vérifie les nombres de jours et le pourcentage.';
      const taux = R.lireMontant(fd.get('tauxHoraire'));
      if (Number.isNaN(taux)) return 'Taux horaire illisible : écris par exemple 45.';
      retenir();
      E.entreprise = String(fd.get('entreprise') || '').trim();
      Object.assign(E.reglages, vals, { tauxHoraire: taux ?? 0, prefixeBon: String(fd.get('prefixeBon') || 'BI').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BI' });
      sauver(); rendre();
      toast('Réglages enregistrés.', { libelle: 'Annuler', faire: annuler });
    });
    $('#import').addEventListener('change', async (ev) => {
      const fichier = ev.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.equipements) || !Array.isArray(d.operations)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.equipements.length, 'équipement')}, ${pluriel((d.interventions || []).length, 'bon')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `maintenance-${auj()}.json`);

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
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': {
        const t = R.lireMontant(accueil.taux);
        if (Number.isNaN(t)) { $('#erreur-accueil').textContent = 'Taux horaire illisible : écris par exemple 45, ou laisse vide.'; break; }
        accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      }
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-echeancier': telecharger(R.csvEcheancier(E, auj()), 'text/csv;charset=utf-8', `echeancier-maintenance-${auj()}.csv`); break;
      case 'csv-bons': telecharger(R.csvInterventions(E), 'text/csv;charset=utf-8', `interventions-${auj()}.csv`); break;
      case 'csv-couts': telecharger(R.csvCouts(E, auj()), 'text/csv;charset=utf-8', `couts-maintenance-${auj()}.csv`); break;
      case 'fermer': modale().close(); break;
      case 'nouvel-eq': modaleEquipement(null); break;
      case 'ouvrir-eq': if (id) modaleFiche(id); break;
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
      case 'nouveau-correctif': modaleCorrectif(id); break;
      case 'nouvelle-piece': modalePiece(null); break;
      case 'modifier-piece': modalePiece(id); break;
      case 'mvt-piece': modaleMvtPiece(id); break;
      case 'suppr-mvt-piece': { retenir(); E.mouvementsPieces = E.mouvementsPieces.filter((m) => m.id !== id); sauver(); rendre(); modalePiece(el.dataset.retour); toast('Mouvement supprimé.', { libelle: 'Annuler', faire: annuler }); break; }
      case 'filtre-ech': if (modale().open) modale().close(); filtre.ech = el.dataset.ech; if (vue !== 'echeancier') changerVue('echeancier'); else rendre(); break;
      case 'filtre-eq': filtre.eq = el.dataset.eq; rendre(); break;
      case 'filtre-bon': filtre.bon = el.dataset.bon; rendre(); break;
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
  window.__maintenance = { etat: () => E, regles: R, demo: () => donneesDemo() };
  init();
})();
