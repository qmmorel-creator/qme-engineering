// Gestion de flotte QME : véhicules, réservations, kilométrage, entretiens, contrôles techniques,
// sinistres, amendes, location longue durée, coût total. Données synchronisées par clé de licence.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'VHC';
  const CLE_CODE = 'qme-vhc-code';
  const CLE_CACHE = 'qme-vhc-cache';
  const CLE_DEMO = 'qme-vhc-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-vhc-ecran-accueil';
  const TAILLE_MAX = 900000;

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

  const { ajout, ecart, versDate, ajoutMois, dateFr, nombre } = R;
  const auj = () => R.iso(new Date());
  const maintenant = () => { const d = new Date(); return `${R.iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const fmt = (s, o = { day: 'numeric', month: 'short' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? dateFr(s) : '–');
  const km = (n) => (n == null || !Number.isFinite(Number(n)) ? '–' : `${Math.round(Number(n)).toLocaleString('fr-FR')} km`);
  const eur = (n, d = 0) => `${Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n < 0) return `il y a ${pluriel(-n, 'jour')}`;
    if (n < 45) return `dans ${pluriel(n, 'jour')}`;
    return `le ${fmtCourt(s)}`;
  };
  const heure = (dt) => dt.slice(11, 16).replace(':', ' h ').replace(' h 00', ' h');

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'bord';
  let ficheId = null; // véhicule ouvert dans l'onglet Véhicules
  let semaine = null; // lundi affiché dans le planning
  let annulation = null;

  const reglagesDefaut = () => ({ alerteJours: B.alerteJours, alerteKm: B.alerteKm, releveAncienJours: B.releveAncienJours,
    ctPremierMois: B.ct.premierMois, ctPeriodiqueMois: B.ct.periodiqueMois, ctPollutionMois: B.ct.pollutionMois, designationJours: B.designation.jours });
  const COLLECTIONS = ['vehicules', 'conducteurs', 'releves', 'entretiens', 'controles', 'reservations', 'sinistres', 'amendes', 'depenses'];
  const etatVide = () => ({ version: 1, structure: '', reglages: reglagesDefaut(), ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])) });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const n = { ...v, ...d, reglages: { ...v.reglages, ...(d.reglages || {}) } };
    for (const c of COLLECTIONS) n[c] = Array.isArray(d[c]) ? d[c] : [];
    n.vehicules = n.vehicules.map((x) => ({ plan: [], actif: true, detention: 'achat', ...x }));
    return n;
  };
  const vehicule = (id) => E.vehicules.find((v) => v.id === id);
  const conducteur = (id) => E.conducteurs.find((c) => c.id === id);
  const trouver = (col, id) => E[col].find((x) => x.id === id);
  const actifs = () => E.vehicules.filter((v) => v.actif !== false).sort((a, b) => a.immat.localeCompare(b.immat));
  const nomV = (v) => (v ? `${v.immat}${v.libelle ? ` · ${v.libelle}` : ''}` : 'Véhicule supprimé');
  const nomC = (id) => conducteur(id)?.nom || 'Non désigné';
  const typeCourt = (c) => B.types.find((t) => t.code === c)?.court || c;
  const energie = (c) => B.energies.find((e) => e.code === c)?.nom || c;
  const alerteRg = () => ({ jours: E.reglages.alerteJours, km: E.reglages.alerteKm });

  // Synthèse d'un véhicule : km, rythme, échéances, coûts (calculée à la demande).
  function synthese(v) {
    const t = auj();
    const pts = R.pointsKm(E, v);
    const kmA = R.kmActuel(pts), ry = R.rythme(pts, t);
    const plan = (v.plan || []).map((op) => R.echeanceEntretien(op, v, E.entretiens, kmA, t, alerteRg(), ry));
    const ct = R.echeancesCT(v, E.controles, E.reglages, B).map((c) => ({ ...c, etat: R.etatDate(c.echeance, t, E.reglages.alerteJours) }));
    const lld = v.detention === 'lld' ? R.suiviLLD(v.lld, kmA, ry, t) : null;
    const etats = [...plan.map((p) => p.etat), ...ct.map((c) => c.etat)];
    const pire = etats.includes('retard') ? 'retard' : etats.includes('proche') ? 'proche' : 'ok';
    const prochaine = [...plan.filter((p) => p.prevue).map((p) => ({ nom: p.op.nom, date: p.prevue, etat: p.etat })), ...ct.map((c) => ({ nom: LIB_CT[c.nature], date: c.echeance, etat: c.etat }))]
      .sort((a, b) => ({ retard: 0, proche: 1, ok: 2 }[a.etat] - { retard: 0, proche: 1, ok: 2 }[b.etat]) || a.date.localeCompare(b.date))[0] || null;
    return { pts, kmA, ry, plan, ct, lld, pire, prochaine, dernier: R.dernierReleve(pts), cout: R.coutVehicule(E, v, t) };
  }
  const LIB_CT = { periodique: 'Contrôle technique', pollution: 'Contrôle complémentaire pollution', 'contre-visite': 'Contre-visite' };

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
        toast('Un autre appareil a modifié la flotte entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime les anciennes dépenses ou un véhicule sorti de la flotte.');
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
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    // Code interne d'un template QME (préfixe de 3 lettres, au moins une hors hexadécimal) ; sinon clé Gumroad.
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

  async function connecter(code, memoriser) {
    if (code.replace(/-/g, '') === CODE_DEMO) return ouvrirDemo();
    const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
    if (E && E.vehicules.length) { cache(false); demarrer(); } else ecranAccueil();
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

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    const D = etatVide();
    D.structure = 'Services techniques (exemple)';
    const t = auj();
    const m = (n) => ajoutMois(t, n);
    const id = () => uid();
    // [immat, libellé, type, énergie, mise en circulation, km/jour, détention, prix ou contrat]
    const defs = [
      ['FL-101-QA', 'Citadine du siège', 'M1', 'ES', m(-50), 42, { prixAchat: 16900, amortMois: 60 }],
      ['FL-202-QB', 'Fourgon atelier', 'N1', 'GO', m(-74), 55, { prixAchat: 28400, amortMois: 72 }],
      ['FL-303-QC', 'Berline commerciale', 'M1', 'HY', m(-20), 84, { lld: { dureeMois: 36, kmContrat: 90000, loyer: 489, prixKmSup: 0.07 } }],
      ['FL-404-QD', 'Électrique de service', 'M1', 'EL', m(-14), 38, { lld: { dureeMois: 48, kmContrat: 60000, loyer: 329, prixKmSup: 0.06 } }],
      ['FL-505-QE', 'Utilitaire électrique', 'N1', 'EL', m(-30), 30, { prixAchat: 31000, amortMois: 60 }],
      ['FL-606-QF', 'Citadine de remplacement', 'M1', 'GO', m(-110), 18, { prixAchat: 6500, amortMois: 36 }],
    ];
    const V = defs.map(([immat, libelle, type, en, mec, rythme, det]) => {
      // Occasions : citadine diesel entrée il y a 40 mois, utilitaire électrique (mis en circulation 20 mois avant son entrée).
      const occasion = { 'FL-606-QF': [m(-40), 98000], 'FL-505-QE': [mec, 21000] }[immat];
      if (immat === 'FL-505-QE') mec = m(-50);
      const entree = occasion ? occasion[0] : mec;
      const kmEntree = occasion ? occasion[1] : 10;
      const v = { id: id(), immat, libelle, type, energie: en, miseEnCirculation: mec, entree, kmEntree, actif: true, notes: '',
        detention: det.lld ? 'lld' : 'achat', prixAchat: det.prixAchat || '', amortMois: det.amortMois || '',
        lld: det.lld ? { debut: mec, kmDebut: 10, ...det.lld } : null, plan: R.planDefaut(B, en), _r: rythme };
      D.vehicules.push(v);
      return v;
    });
    const kmA = (v, date) => Math.round(v.kmEntree + v._r * Math.max(0, ecart(v.entree, date)));
    const [v1, v2, v3, v4, v5, v6] = V;
    // Relevés mensuels sur un an (le dernier il y a 41 jours pour l'utilitaire électrique).
    for (const v of V) {
      for (let k = 12; k >= 1; k--) {
        const d = ajout(t, -k * 30 + 2);
        if (d <= v.entree || (v === v5 && d > ajout(t, -41))) continue;
        D.releves.push({ id: id(), vehiculeId: v.id, date: d, km: kmA(v, d) });
      }
      if (v !== v5) D.releves.push({ id: id(), vehiculeId: v.id, date: ajout(t, -1), km: kmA(v, ajout(t, -1)) });
    }
    const ent = (v, j, ops, cout, prest, note = '') => D.entretiens.push({ id: id(), vehiculeId: v.id, date: ajout(t, j), km: kmA(v, ajout(t, j)), operations: ops, cout, prestataire: prest, note });
    ent(v1, -400, ['REV', 'VID', 'FAI', 'FHA', 'LDF', 'FRE', 'PNE', 'CLI', 'BAT'], 412, 'Garage du quartier (fictif)');
    ent(v1, -40, ['REV', 'VID', 'FHA', 'FRE', 'PNE', 'BAT'], 286.4, 'Garage du quartier (fictif)');
    ent(v2, -200, ['REV', 'VID', 'FAI', 'FHA', 'LDF', 'FRE', 'CLI', 'BAT', 'LDR', 'DIS'], 1340, 'Centre auto (fictif)', 'Distribution et plaquettes avant remplacées');
    ent(v2, -120, ['PNE'], 64, 'Centre auto (fictif)');
    ent(v3, -260, ['REV', 'VID', 'FHA', 'FRE', 'PNE', 'BAT'], 0, 'Réseau du loueur (prestation incluse)');
    ent(v3, -45, ['REV', 'VID', 'FAI', 'FHA', 'FRE', 'PNE'], 0, 'Réseau du loueur (prestation incluse)');
    ent(v4, -30, ['REV', 'FHA', 'FRE', 'PNE', 'BAT'], 0, 'Réseau du loueur (prestation incluse)');
    ent(v5, -330, ['REV', 'FHA', 'FRE', 'PNE', 'LDF', 'CLI', 'BAT'], 238, 'Atelier véhicules électriques (fictif)');
    ent(v5, -100, ['PNE'], 48, 'Centre auto (fictif)', 'Permutation');
    ent(v6, -300, ['REV', 'VID', 'FAI', 'FHA', 'LDF', 'FRE', 'PNE', 'LDR', 'CLI', 'BAT', 'DIS'], 1190, 'Garage du quartier (fictif)', 'Distribution faite');
    ent(v6, -90, ['PNE'], 52, 'Centre auto (fictif)');
    // Contrôles techniques.
    D.controles.push({ id: id(), vehiculeId: v1.id, date: ajout(t, -95), nature: 'periodique', resultat: 'favorable', centre: 'Centre de contrôle (fictif)', cout: 79 });
    D.controles.push({ id: id(), vehiculeId: v2.id, date: ajout(t, -345), nature: 'periodique', resultat: 'favorable', centre: 'Centre de contrôle (fictif)', cout: 85 });
    D.controles.push({ id: id(), vehiculeId: v5.id, date: ajout(t, -400), nature: 'periodique', resultat: 'favorable', centre: 'Centre de contrôle (fictif)', cout: 79 });
    D.controles.push({ id: id(), vehiculeId: v6.id, date: ajout(t, -12), nature: 'periodique', resultat: 'contre-visite', limite: ajout(t, 18), centre: 'Centre de contrôle (fictif)', cout: 79, note: 'Défaut d\'éclairage de plaque, pneu avant usé' });
    // Conducteurs (prénoms fictifs).
    const C = [['Camille R.', 'Services techniques'], ['Sami B.', 'Commercial'], ['Inès D.', 'Direction'], ['Hugo M.', 'Atelier'], ['Léa P.', 'Accueil et logistique']]
      .map(([nom, service], k) => { const c = { id: id(), nom, service, permis: ajout(t, -40 - k * 70) }; D.conducteurs.push(c); return c; });
    const [cam, sam, ine, hug, lea] = C;
    // Réservations : passées (clôturées), en cours, à venir, une à clôturer.
    const res = (v, c, j, h1, j2, h2, motif, clos = true) => {
      const r = { id: id(), vehiculeId: v.id, conducteurId: c.id, debut: `${ajout(t, j)}T${h1}`, fin: `${ajout(t, j2)}T${h2}`, motif };
      if (clos && ajout(t, j2) < t) r.kmRetour = kmA(v, ajout(t, j2));
      D.reservations.push(r);
      return r;
    };
    res(v1, cam, -9, '08:00', -9, '17:30', 'Tournée des bâtiments communaux');
    res(v6, lea, -6, '09:00', -6, '12:00', 'Courrier et fournitures');
    res(v4, ine, -3, '13:30', -2, '18:00', 'Rendez-vous partenaires');
    res(v1, hug, -2, '08:00', -2, '12:00', 'Achat de matériel', false); // retour à saisir
    res(v4, cam, 0, '08:00', 0, '17:00', 'Visites de chantiers');
    res(v6, lea, 0, '14:00', 0, '16:30', 'Livraison de documents');
    res(v1, sam, 1, '09:00', 1, '18:00', 'Rendez-vous clients');
    res(v2, hug, 1, '07:30', 3, '17:00', 'Intervention sur site');
    res(v4, ine, 2, '08:30', 2, '12:30', 'Réunion extérieure');
    res(v5, cam, 3, '08:00', 3, '17:00', 'Entretien des espaces verts');
    res(v1, lea, 6, '10:00', 6, '15:00', 'Navette salon professionnel');
    res(v6, sam, 8, '08:00', 9, '19:00', 'Déplacement de deux jours');
    // Sinistres.
    D.sinistres.push({ id: id(), vehiculeId: v2.id, conducteurId: hug.id, date: ajout(t, -12), description: 'Choc arrière en manœuvre, feu arrière cassé', responsabilite: 'totale', statut: 'ouvert', cout: '', note: 'Déclaration envoyée à l\'assureur' });
    D.sinistres.push({ id: id(), vehiculeId: v6.id, conducteurId: lea.id, date: ajout(t, -150), description: 'Pare-brise fissuré (projection de gravillon)', responsabilite: 'non', statut: 'clos', cout: 150, note: 'Franchise bris de glace' });
    // Amendes : à désigner (bientôt, puis en retard), désignée, payée.
    D.amendes.push({ id: id(), vehiculeId: v2.id, conducteurId: hug.id, dateInfraction: ajout(t, -36), dateAvis: ajout(t, -30), nature: 'Excès de vitesse (exemple)', montant: '', statut: 'a-designer' });
    D.amendes.push({ id: id(), vehiculeId: v3.id, conducteurId: sam.id, dateInfraction: ajout(t, -75), dateAvis: ajout(t, -68), nature: 'Stationnement (exemple)', montant: '', statut: 'designee' });
    D.amendes.push({ id: id(), vehiculeId: v1.id, conducteurId: cam.id, dateInfraction: ajout(t, -210), dateAvis: ajout(t, -201), nature: 'Stationnement (exemple)', montant: '', statut: 'payee' });
    // Dépenses : énergie mensuelle, assurance annuelle, péages.
    const conso = { ES: 0.11, GO: 0.1, HY: 0.08, EL: 0.045 };
    for (const v of V) {
      for (let k = 11; k >= 0; k--) {
        const d = ajout(t, -k * 30 - 5);
        if (d < v.entree) continue;
        D.depenses.push({ id: id(), vehiculeId: v.id, date: d, poste: 'ENE', montant: Math.round(v._r * 30 * conso[v.energie] * 100) / 100, libelle: v.energie === 'EL' ? 'Recharges du mois' : 'Carburant du mois' });
      }
      if (v.detention === 'achat') D.depenses.push({ id: id(), vehiculeId: v.id, date: ajout(t, -150), poste: 'ASS', montant: v.type === 'N1' ? 720 : 540, libelle: 'Assurance annuelle' });
    }
    D.depenses.push({ id: id(), vehiculeId: v3.id, date: ajout(t, -20), poste: 'PEA', montant: 46.8, libelle: 'Péages du mois' });
    D.depenses.push({ id: id(), vehiculeId: v2.id, date: ajout(t, -60), poste: 'REP', montant: 184, libelle: 'Remplacement d\'un rétroviseur' });
    D.depenses.push({ id: id(), vehiculeId: v1.id, date: ajout(t, -15), poste: 'LAV', montant: 18, libelle: 'Lavage' });
    V.forEach((v) => { delete v._r; });
    return D;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Gestion de flotte · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="10" y="60" width="330" height="140" fill="#F5B400"/>
          <path d="M60 60 L140 0 L300 0 L340 60 Z" fill="#1D4E89"/>
          <circle cx="95" cy="230" r="58" fill="#D9302A"/><circle cx="95" cy="230" r="20" fill="#141414"/>
          <circle cx="270" cy="230" r="58" fill="#D9302A"/><circle cx="270" cy="230" r="20" fill="#141414"/>
          <rect x="390" y="40" width="160" height="220" fill="#F0EDE6"/>
          <rect x="410" y="70" width="120" height="16" fill="#141414"/><rect x="410" y="110" width="80" height="16" fill="#1D4E89"/><rect x="410" y="150" width="100" height="16" fill="#141414"/><rect x="410" y="190" width="60" height="16" fill="#D9302A"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Gestion de flotte · PME et collectivités</p>
          <h1>Ta flotte, sans échéance oubliée.</h1>
          <p>Réservations sans conflit, kilométrage, entretiens et contrôles techniques calculés, sinistres, amendes, location longue durée et coût au kilomètre.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ta flotte</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes données sont enregistrées en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir ma flotte</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir ma flotte'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  const optionsTypes = (choisi) => B.types.map((x) => `<option value="${x.code}" ${x.code === choisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
  const optionsEnergies = (choisi) => B.energies.map((x) => `<option value="${x.code}" ${x.code === choisi ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');

  function ecranAccueil() {
    document.title = 'Bienvenue · Gestion de flotte';
    $('#racine').innerHTML = `
      <div class="accueil">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">Premier lancement</span></div>
        <p class="surtitre">Bienvenue</p>
        <h1>Ton premier véhicule.</h1>
        <p class="intro">Commence par un véhicule : le plan d'entretien et le contrôle technique se calculent tout de suite. Tu ajouteras les autres, les conducteurs et le contrat de location ensuite.</p>
        <form id="form-accueil" class="accueil-form" novalidate>
          <div class="grille-2">
            <label class="champ">Ta structure <small>Facultatif : en tête des exports.</small><input name="structure" maxlength="80" placeholder="Ex. : Services techniques"></label>
            <label class="champ">Immatriculation<input name="immat" required maxlength="20" placeholder="Ex. : AA-123-AA" autocapitalize="characters"></label>
            <label class="champ">Libellé <small>Pour le reconnaître d'un coup d'œil.</small><input name="libelle" maxlength="60" placeholder="Ex. : Fourgon atelier"></label>
            <label class="champ">Type<select name="type">${optionsTypes('M1')}</select></label>
            <label class="champ">Énergie<select name="energie">${optionsEnergies('ES')}</select></label>
            <label class="champ">1re mise en circulation <small>Case B de la carte grise.</small><input type="date" name="mec" required max="${auj()}"></label>
            <label class="champ">Kilométrage actuel<input type="number" name="km" required min="0" inputmode="numeric"></label>
            <label class="champ">Dernier contrôle technique <small>Facultatif.</small><input type="date" name="ct" max="${auj()}"></label>
          </div>
          <p class="aide">Le plan d'entretien proposé est <b>indicatif</b> : le carnet d'entretien du constructeur fait foi. Tu l'adapteras dans la fiche du véhicule.</p>
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied"><span></span><button class="btn primaire" type="submit">Créer le véhicule</button></div>
        </form>
      </div>`;
    $('#form-accueil').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const err = e.target.querySelector('.erreur');
      const immat = R.immat(f.get('immat'));
      if (!immat) { err.textContent = 'Indique l\'immatriculation.'; return; }
      if (!R.estDate(f.get('mec'))) { err.textContent = 'Indique la date de 1re mise en circulation.'; return; }
      const k = Number(f.get('km'));
      if (f.get('km') === '' || !Number.isFinite(k) || k < 0) { err.textContent = 'Indique le kilométrage actuel.'; return; }
      E = etatVide();
      E.structure = String(f.get('structure') || '').trim();
      const v = { id: uid(), immat, libelle: String(f.get('libelle') || '').trim(), type: f.get('type'), energie: f.get('energie'), miseEnCirculation: f.get('mec'),
        entree: auj(), kmEntree: k, ctDernier: f.get('ct') || '', detention: 'achat', prixAchat: '', amortMois: '', lld: null, actif: true, notes: '', plan: R.planDefaut(B, f.get('energie')) };
      E.vehicules.push(v);
      sauver();
      ficheId = v.id; vue = 'vehicules';
      demarrer();
      toast(`${immat} créé : vérifie son plan d'entretien avec le carnet.`);
    });
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    bord: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    vehicules: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="20" height="8" fill="currentColor"/><path d="M5 8 8 3h8l3 5Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="18" r="3" fill="currentColor"/></svg>',
    reservations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    incidents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    couts: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    guide: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 3h16v18H4z" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="7" width="8" height="2" fill="currentColor"/><rect x="8" y="11" width="8" height="2" fill="currentColor"/><circle cx="12" cy="17" r="1.6" fill="#D9302A"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['bord', 'Alertes'], ['vehicules', 'Véhicules'], ['reservations', 'Réservations'], ['incidents', 'Incidents'], ['couts', 'Coûts']];
  const COURTS = { reservations: 'Planning' };
  const VUES = [...ONGLETS.map(([id]) => id), 'guide'];

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (VUES.includes(depuisUrl)) vue = depuisUrl;
    if (ficheId && !vehicule(ficheId)) ficheId = null;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Gestion<br>de flotte</span>
        <nav class="onglets" aria-label="Sections">${ONGLETS.map(([id, nom]) => `<button class="onglet" data-action="vue" data-vue="${id}">${ICONES[id]}<span>${COURTS[id] ? `<span class="long">${nom}</span><span class="court">${COURTS[id]}</span>` : nom}</span></button>`).join('')}</nav>
        <span class="sync" data-etat="ok" role="status"><i></i><b>Enregistré</b></span>
        <button class="btn-icone" data-action="vue" data-vue="guide" aria-label="Guide et sources" title="Guide et sources">${ICONES.guide}</button>
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
    const titres = { ...Object.fromEntries(ONGLETS), guide: 'Guide' };
    document.title = `${vue === 'vehicules' && ficheId ? vehicule(ficheId)?.immat : titres[vue]} · Gestion de flotte`;
    $('#vue').innerHTML = { bord: vueBord, vehicules: () => (ficheId ? vueFiche(vehicule(ficheId)) : vueVehicules()), reservations: vueReservations, incidents: vueIncidents, couts: vueCouts, guide: vueGuide }[vue]();
    if (vue === 'couts') brancherGraphique();
  }

  function changerVue(v) {
    vue = v;
    if (v !== 'vehicules') ficheId = null;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }
  function ouvrirFiche(id) { ficheId = id; vue = 'vehicules'; history.replaceState(null, '', '#vehicules'); rendre(); window.scrollTo({ top: 0 }); $('#vue').focus({ preventScroll: true }); }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const vide = (titre, texte, actions = '', petit = false) => `<div class="vide-etat ${petit ? 'petit' : ''}">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const ETIQ = { retard: ['rouge', 'En retard'], proche: ['jaune', 'À prévoir'], ok: ['gris', 'À jour'], sans: ['gris', 'Sans échéance'] };
  const COUL = { retard: 'var(--rouge)', proche: 'var(--jaune)', ok: 'var(--bleu)' };

  // ---------- Vue Alertes (tableau de bord) ----------
  function vueBord() {
    const t = auj();
    const al = R.alertes(E, B, t);
    const retards = al.filter((a) => a.etat === 'retard').length;
    const jour = R.reservationsDuJour(E.reservations, t);
    const aClore = E.reservations.filter((r) => !r.annulee && r.fin < maintenant() && (r.kmRetour == null || r.kmRetour === '') && ecart(r.fin.slice(0, 10), t) <= 30);
    const titre = !al.length ? '<mark>Rien à signaler</mark> : toutes les échéances sont loin.'
      : retards ? `<mark>${pluriel(retards, 'échéance dépassée', 'échéances dépassées')}</mark>, ${pluriel(al.length - retards, 'autre alerte', 'autres alertes')}.` : `${pluriel(al.length, 'alerte')} à prévoir, <mark>aucun retard</mark>.`;
    const tuile = (lib, v, d, c, forme = '', act = '') => `<${act ? `button data-action="${act}"` : 'div'} class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></${act ? 'button' : 'div'}>`;
    return `
      <div class="vue-tete"><div><p class="surtitre">${esc(E.structure || 'Ta flotte')} · ${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${titre}</h1></div>
        <div class="actions"><button class="btn" data-action="releve">Relevé km</button><button class="btn primaire" data-action="reservation-nouvelle">${ICONES.plus}Réserver</button></div></div>
      <div class="tuiles">
        ${tuile('Véhicules actifs', actifs().length, `${pluriel(E.conducteurs.length, 'conducteur')}`, 'var(--encre)', 'rond', 'aller-vehicules')}
        ${tuile('En retard', retards, retards ? 'Entretien, contrôle, désignation…' : 'Aucune échéance dépassée', 'var(--rouge)')}
        ${tuile('À prévoir', al.length - retards, `Dans les ${E.reglages.alerteJours} jours ou ${km(E.reglages.alerteKm)}`, 'var(--jaune)')}
        ${tuile('Sorties du jour', jour.length, aClore.length ? `${pluriel(aClore.length, 'retour')} à saisir` : 'Planning à jour', 'var(--bleu)', 'rond', 'aller-planning')}
      </div>
      <h2 class="titre-section">Alertes <span>Retards d'abord, puis par date. Touche une ligne pour ouvrir le dossier.</span></h2>
      ${al.length ? `<div class="bloc-liste">${al.map((a) => ligneAlerte(a, t)).join('')}</div>` : vide('Tout est à jour', 'Aucun entretien, contrôle ou désignation à prévoir dans la fenêtre d\'alerte.', '', true)}
      ${aClore.length ? `<h2 class="titre-section">Retours à saisir <span>Le kilométrage de retour met à jour les échéances.</span></h2><div class="bloc-liste">${aClore.map((r) => `<button class="ligne-retard" data-action="retour" data-id="${r.id}"><span class="etiquette jaune">km</span><span><b>${esc(nomV(vehicule(r.vehiculeId)))}</b><small>${esc(nomC(r.conducteurId))} · rendu ${quand(r.fin.slice(0, 10))} à ${heure(r.fin)}</small></span></button>`).join('')}</div>` : ''}
      <h2 class="titre-section">Aujourd'hui <span>${fmt(t, { weekday: 'long', day: 'numeric', month: 'long' })}</span></h2>
      ${jour.length ? `<div class="bloc-liste">${jour.map((r) => ligneResa(r)).join('')}</div>` : vide('Aucune sortie aujourd\'hui', 'Tous les véhicules sont disponibles.', `<button class="btn primaire" data-action="reservation-nouvelle">${ICONES.plus}Réserver</button>`, true)}`;
  }

  function ligneAlerte(a, t) {
    const v = vehicule(a.vehiculeId);
    const n = a.date ? ecart(t, a.date) : null;
    const pastille = a.etat === 'retard' ? `<span class="etiquette rouge">${a.type === 'lld' ? 'km' : n !== null && n < 0 ? `${-n} j` : 'dû'}</span>` : `<span class="etiquette jaune">${n !== null && n >= 0 ? (n === 0 ? 'auj.' : `${n} j`) : '!'}</span>`;
    const act = a.type === 'amende' ? `data-action="amende-modifier" data-id="${a.refId}"` : a.type === 'sinistre' ? `data-action="sinistre-modifier" data-id="${a.refId}"` : `data-action="fiche" data-id="${a.vehiculeId}"`;
    return `<button class="ligne-retard" ${act}>${pastille}<span><b>${esc(a.titre)} · ${esc(v?.immat || '')}</b><small>${esc(a.detail)}${v?.libelle ? ` · ${esc(v.libelle)}` : ''}</small></span></button>`;
  }

  function ligneResa(r) {
    const v = vehicule(r.vehiculeId);
    const t = auj();
    const plage = r.debut.slice(0, 10) === r.fin.slice(0, 10) ? `${heure(r.debut)} – ${heure(r.fin)}` : `${fmt(r.debut.slice(0, 10))} ${heure(r.debut)} → ${fmt(r.fin.slice(0, 10))} ${heure(r.fin)}`;
    const enCours = r.debut <= maintenant() && r.fin > maintenant();
    return `<button class="ligne-retard" data-action="reservation-modifier" data-id="${r.id}"><span class="etiquette ${enCours ? 'bleu' : r.fin <= maintenant() ? 'gris' : 'contour'}">${enCours ? 'en cours' : r.fin.slice(0, 10) < t || r.fin <= maintenant() ? 'rendu' : r.debut.slice(0, 10) === t ? 'prévu' : fmt(r.debut.slice(0, 10))}</span><span><b>${esc(nomV(v))}</b><small>${plage} · ${esc(nomC(r.conducteurId))}${r.motif ? ` · ${esc(r.motif)}` : ''}</small></span></button>`;
  }

  // ---------- Vue Véhicules ----------
  function vueVehicules() {
    const liste = [...E.vehicules].sort((a, b) => (a.actif === false) - (b.actif === false) || a.immat.localeCompare(b.immat));
    return `
      <div class="vue-tete"><div><h1>Véhicules</h1><p>Kilométrage, prochaine échéance et état de chaque véhicule. Ouvre une fiche pour le plan d'entretien, les contrôles, le contrat et les coûts.</p></div>
        <div class="actions"><button class="btn" data-action="csv-vehicules">Export CSV</button><button class="btn primaire" data-action="vehicule-nouveau">${ICONES.plus}Véhicule</button></div></div>
      ${liste.length ? `<ul class="flotte">${liste.map(carteVehicule).join('')}</ul>` : vide('Aucun véhicule', 'Ajoute ton premier véhicule pour calculer ses échéances.', `<button class="btn primaire" data-action="vehicule-nouveau">${ICONES.plus}Véhicule</button>`)}`;
  }

  function carteVehicule(v) {
    const s = synthese(v);
    const inactif = v.actif === false;
    const p = s.prochaine;
    return `
      <li class="vh ${inactif ? 'inactif' : ''}" style="--c:${inactif ? 'var(--gris)' : COUL[s.pire]}">
        <button class="vh-tete" data-action="fiche" data-id="${v.id}" aria-label="Ouvrir la fiche ${esc(v.immat)}">
          <span class="plaque">${esc(v.immat)}</span>
          <span class="vh-nom"><b>${esc(v.libelle || 'Sans libellé')}</b><small>${esc(typeCourt(v.type))} · ${esc(energie(v.energie))}${v.detention === 'lld' ? ' · location' : ''}${inactif ? ' · sorti de la flotte' : ''}</small></span>
        </button>
        <div class="vh-chiffres">
          <div><b>${km(s.kmA)}</b><span>${s.dernier ? `relevé ${quand(s.dernier)}` : 'aucun relevé'}</span></div>
          <div><b>${s.ry ? `${Math.round(s.ry * 30).toLocaleString('fr-FR')}` : '–'}</b><span>km par mois</span></div>
        </div>
        <div class="vh-ech">${inactif ? '<span class="etiquette gris">Inactif</span>' : p ? `<span class="etiquette ${ETIQ[p.etat][0]}">${ETIQ[p.etat][1]}</span><span><b>${esc(p.nom)}</b> ${p.date < auj() ? `dépassé depuis le ${fmtCourt(p.date)}` : quand(p.date)}</span>` : '<span class="etiquette gris">Aucune échéance</span>'}
          ${s.lld && s.lld.depassement > 0 && !s.lld.termine ? `<span class="etiquette rouge">+${s.lld.depassement.toLocaleString('fr-FR')} km projetés</span>` : ''}</div>
        <div class="vh-actions"><button data-action="releve" data-id="${v.id}">Relevé km</button><button data-action="entretien-nouveau" data-id="${v.id}">Entretien fait</button><button data-action="fiche" data-id="${v.id}">Fiche</button></div>
      </li>`;
  }

  // ---------- Fiche véhicule ----------
  function vueFiche(v) {
    if (!v) { ficheId = null; return vueVehicules(); }
    const t = auj();
    const s = synthese(v);
    const c = s.cout;
    const planTri = [...s.plan].sort((a, b) => ({ retard: 0, proche: 1, ok: 2, sans: 3 }[a.etat] - { retard: 0, proche: 1, ok: 2, sans: 3 }[b.etat]) || (a.prevue || '9').localeCompare(b.prevue || '9'));
    const lignePlan = (e) => `<tr><td class="p-op"><b>${esc(e.op.nom)}</b><small>${[e.op.km > 0 && km(e.op.km), e.op.mois > 0 && `${e.op.mois} mois`].filter(Boolean).join(' ou ')}</small></td>
      <td class="p-der">${e.dernier ? `${fmtCourt(e.dernier.date)}<small>${km(e.dernier.km)}</small>` : '<small>pas encore suivi</small>'}</td>
      <td class="p-ech">${[e.echKm !== null && km(e.echKm), e.echDate && fmtCourt(e.echDate)].filter(Boolean).join('<br>')}${e.dateKm && e.echKm !== null && e.kmRestant > 0 ? `<small>km atteints vers le ${fmtCourt(e.dateKm)}</small>` : ''}</td>
      <td class="p-etat"><span class="etiquette ${ETIQ[e.etat][0]}">${ETIQ[e.etat][1]}</span></td></tr>`;
    const ctLignes = s.ct.length ? s.ct.map((x) => `<li><span class="etiquette ${ETIQ[x.etat][0]}">${ETIQ[x.etat][1]}</span><span><b>${LIB_CT[x.nature]}${x.premier ? ' (premier)' : ''}</b> au plus tard le ${fmtCourt(x.echeance)}</span></li>`).join('')
      : `<li><span class="etiquette gris">À saisir</span><span>${v.type === 'AUTRE' ? 'Type « autre » : indique la périodicité dans la fiche du véhicule.' : 'Indique la date de 1re mise en circulation.'}</span></li>`;
    const historique = [
      ...E.entretiens.filter((x) => x.vehiculeId === v.id).map((x) => ({ d: x.date, h: `<b>Entretien</b> · ${esc((x.operations || []).map((o) => (v.plan || []).find((p) => p.id === o)?.nom || o).join(', ') || 'opérations non précisées')}`, m: x.cout, a: 'entretien-modifier', id: x.id, k: x.km })),
      ...E.controles.filter((x) => x.vehiculeId === v.id).map((x) => ({ d: x.date, h: `<b>${{ periodique: 'Contrôle technique', pollution: 'Contrôle pollution', 'contre-visite': 'Contre-visite' }[x.nature]}</b> · ${x.resultat === 'favorable' ? 'favorable' : `contre-visite avant le ${fmtCourt(x.limite)}`}`, m: x.cout, a: 'controle-modifier', id: x.id })),
      ...E.sinistres.filter((x) => x.vehiculeId === v.id).map((x) => ({ d: x.date, h: `<b>Sinistre</b> · ${esc(x.description)}`, m: x.cout, a: 'sinistre-modifier', id: x.id })),
      ...E.amendes.filter((x) => x.vehiculeId === v.id).map((x) => ({ d: x.dateInfraction || x.dateAvis, h: `<b>Amende</b> · ${esc(x.nature || '')} · ${STATUTS_AMENDE[x.statut]}`, m: null, a: 'amende-modifier', id: x.id })),
      ...E.depenses.filter((x) => x.vehiculeId === v.id).map((x) => ({ d: x.date, h: `<b>${esc(B.postes.find((p) => p.code === x.poste)?.nom || x.poste)}</b>${x.libelle ? ` · ${esc(x.libelle)}` : ''}`, m: x.montant, a: 'depense-modifier', id: x.id })),
      ...E.releves.filter((x) => x.vehiculeId === v.id).map((x) => ({ d: x.date, h: `<b>Relevé</b> · ${km(x.km)}`, m: null, a: 'releve-modifier', id: x.id })),
    ].sort((a, b) => b.d.localeCompare(a.d));
    const lld = s.lld;
    return `
      <p class="fil"><button class="btn lien" data-action="vue" data-vue="vehicules">← Tous les véhicules</button></p>
      <div class="vue-tete fiche-tete"><div><p class="surtitre">${esc(typeCourt(v.type))} · ${esc(energie(v.energie))} · 1re mise en circulation ${fmtCourt(v.miseEnCirculation)}${v.actif === false ? ' · sorti de la flotte' : ''}</p>
        <h1><span class="plaque grande">${esc(v.immat)}</span> ${esc(v.libelle || '')}</h1></div>
        <div class="actions"><button class="btn" data-action="vehicule-modifier" data-id="${v.id}">Modifier</button><button class="btn primaire" data-action="releve" data-id="${v.id}">Relevé km</button></div></div>
      <div class="tuiles">
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Kilométrage</p><b>${Math.round(s.kmA).toLocaleString('fr-FR')}<small>km</small></b><span>${s.dernier ? `Relevé ${quand(s.dernier)}` : 'Aucun relevé'}</span></div>
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Rythme</p><b>${s.ry ? Math.round(s.ry * 30).toLocaleString('fr-FR') : '–'}<small>km/mois</small></b><span>Sur les 12 derniers mois</span></div>
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Coût total</p><b>${Math.round(c.total).toLocaleString('fr-FR')}<small>€</small></b><span>Depuis l'entrée le ${fmtCourt(v.entree)}</span></div>
        <div class="tuile rond" style="--c:var(--rouge)"><p class="surtitre">Coût au km</p><b>${c.coutKm === null ? '–' : c.coutKm.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<small>€</small></b><span>${km(c.km)} parcourus</span></div>
      </div>
      <h2 class="titre-section">Contrôle technique <span>Périodicités : voir le Guide (sources et dates).</span></h2>
      <div class="bloc-ech"><ul class="liste-ech">${ctLignes}</ul><button class="btn petit" data-action="controle-nouveau" data-id="${v.id}">${ICONES.plus}Contrôle passé</button></div>
      <h2 class="titre-section">Plan d'entretien <span>Indicatif : le carnet du constructeur fait foi. La première échéance atteinte (km ou date) compte.</span></h2>
      ${s.plan.length ? `<div class="defile"><table class="tableau plan"><thead><tr><th>Opération</th><th>Dernière fois</th><th>Échéance</th><th>État</th></tr></thead><tbody>${planTri.map(lignePlan).join('')}</tbody></table></div>` : '<p class="note">Aucune opération suivie.</p>'}
      <div class="rang-actions"><button class="btn primaire petit" data-action="entretien-nouveau" data-id="${v.id}">${ICONES.plus}Entretien fait</button><button class="btn petit" data-action="plan" data-id="${v.id}">Adapter le plan au carnet</button></div>
      ${v.detention === 'lld' ? `<h2 class="titre-section">Location longue durée <span>Projection d'après le rythme des 12 derniers mois.</span></h2>
        ${lld ? `<div class="lld">
          <div class="lld-barre" role="img" aria-label="${km(lld.kmParcourus)} parcourus sur ${km(lld.kmContrat)} au contrat, projection ${km(lld.kmProjete)}">
            <i class="fait" style="width:${Math.min(100, (lld.kmParcourus / Math.max(lld.kmContrat, lld.kmProjete, 1)) * 100)}%"></i>
            <i class="projete ${lld.depassement ? 'trop' : ''}" style="width:${Math.min(100, (Math.max(0, lld.kmProjete - lld.kmParcourus) / Math.max(lld.kmContrat, lld.kmProjete, 1)) * 100)}%"></i>
            <b class="repere" style="left:${(lld.kmContrat / Math.max(lld.kmContrat, lld.kmProjete, 1)) * 100}%"></b>
          </div>
          <dl class="lld-chiffres">
            <div><dt>Parcourus</dt><dd>${km(lld.kmParcourus)}</dd></div>
            <div><dt>Autorisés à ce jour</dt><dd>${km(lld.kmAutorises)} <small>${lld.ecartProrata > 0 ? `<em>+${lld.ecartProrata.toLocaleString('fr-FR')}</em>` : `${lld.ecartProrata.toLocaleString('fr-FR')}`}</small></dd></div>
            <div><dt>Projection fin de contrat</dt><dd>${km(lld.kmProjete)} <small>sur ${km(lld.kmContrat)}</small></dd></div>
            <div><dt>Dépassement projeté</dt><dd class="${lld.depassement ? 'alerte' : ''}">${lld.depassement ? `${km(lld.depassement)}${lld.coutDepassement ? ` · ≈ ${eur(lld.coutDepassement)}` : ''}` : 'aucun'}</dd></div>
            <div><dt>Fin du contrat</dt><dd>${fmtCourt(lld.fin)} <small>${lld.termine ? 'terminé' : ecart(auj(), lld.fin) <= 45 ? quand(lld.fin) : `dans ${pluriel(R.moisPleins(auj(), lld.fin), 'mois', 'mois')}`}</small></dd></div>
            <div><dt>Loyers échus</dt><dd>${lld.loyersEchus} / ${v.lld.dureeMois} · ${eur(lld.loyers)}</dd></div>
          </dl>
          <p class="note">Prix du km supplémentaire : celui de ton contrat (${v.lld.prixKmSup ? `${String(v.lld.prixKmSup).replace('.', ',')} € saisi` : 'non saisi'}). Le loueur peut aussi réviser le loyer ou le kilométrage en cours de contrat : vérifie tes conditions.</p>
        </div>` : '<p class="note">Contrat incomplet : indique le début et la durée dans « Modifier ».</p>'}` : ''}
      <h2 class="titre-section">Coûts <span>Montants tels que saisis ; amendes pour mémoire, hors coût total.</span></h2>
      <div class="defile"><table class="tableau"><tbody>
        <tr><td>${v.detention === 'lld' ? 'Loyers échus' : 'Amortissement linéaire du prix d\'achat'}</td><td class="nb">${eur(c.detention)}</td></tr>
        ${Object.entries(c.parPoste).map(([p, m]) => `<tr><td>${esc(B.postes.find((x) => x.code === p)?.nom || p)}</td><td class="nb">${eur(m)}</td></tr>`).join('')}
        <tr><td>Entretiens</td><td class="nb">${eur(c.entretienSeul)}</td></tr>
        <tr><td>Contrôles techniques</td><td class="nb">${eur(c.controles)}</td></tr>
        <tr><td>Sinistres (reste à charge)</td><td class="nb">${eur(c.sinistres)}</td></tr>
        <tr class="total"><td>Total</td><td class="nb">${eur(c.total)}</td></tr>
      </tbody></table></div>
      <div class="rang-actions"><button class="btn petit" data-action="depense-nouvelle" data-id="${v.id}">${ICONES.plus}Dépense</button><button class="btn petit" data-action="sinistre-nouveau" data-id="${v.id}">${ICONES.plus}Sinistre</button><button class="btn petit" data-action="amende-nouvelle" data-id="${v.id}">${ICONES.plus}Amende</button></div>
      <h2 class="titre-section">Historique <span>${pluriel(historique.length, 'événement')}, du plus récent au plus ancien.</span></h2>
      ${historique.length ? `<div class="bloc-liste">${historique.slice(0, 40).map((h) => `<button class="ligne-hist" data-action="${h.a}" data-id="${h.id}"><span class="date">${fmtCourt(h.d)}</span><span>${h.h}${h.k ? ` · ${km(h.k)}` : ''}</span><span class="nb">${h.m !== null && h.m !== '' && h.m !== undefined ? eur(nombre(h.m), 2) : ''}</span></button>`).join('')}</div>${historique.length > 40 ? '<p class="note">40 derniers événements affichés ; l\'export CSV contient tout.</p>' : ''}` : '<p class="note">Aucun événement.</p>'}
      ${v.notes ? `<h2 class="titre-section">Notes</h2><p class="aide">${esc(v.notes)}</p>` : ''}`;
  }

  // ---------- Vue Réservations ----------
  function vueReservations() {
    const t = auj();
    if (!semaine) semaine = R.lundi(t);
    const jours = Array.from({ length: 7 }, (_, k) => ajout(semaine, k));
    const vs = actifs();
    const resaSem = E.reservations.filter((r) => !r.annulee && r.debut.slice(0, 10) <= jours[6] && r.fin > `${jours[0]}T00:00`);
    const cellule = (v, j) => {
      const l = R.reservationsDuJour(resaSem.filter((r) => r.vehiculeId === v.id), j);
      return `<td class="${j === t ? 'auj' : ''}${j < t ? ' passe' : ''}">${l.map((r) => `<button class="resa" data-action="reservation-modifier" data-id="${r.id}" title="${esc(nomC(r.conducteurId))} · ${esc(r.motif || '')}"><b>${r.debut.slice(0, 10) < j && r.fin.slice(0, 10) > j ? 'Journée' : `${r.debut.slice(0, 10) < j ? '…' : heure(r.debut)}–${r.fin.slice(0, 10) > j ? '…' : heure(r.fin)}`}</b><span>${esc(nomC(r.conducteurId))}</span></button>`).join('')}${j >= t ? `<button class="libre" data-action="reservation-nouvelle" data-vehicule="${v.id}" data-jour="${j}" aria-label="Réserver ${esc(v.immat)} le ${fmtCourt(j)}">+</button>` : ''}</td>`;
    };
    const parJour = jours.map((j) => { const l = R.reservationsDuJour(resaSem, j); return `<div class="jour-mobile ${j === t ? 'auj' : ''}"><h3>${fmt(j, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>${l.length ? l.map((r) => ligneResa(r)).join('') : '<p class="note">Aucune réservation.</p>'}</div>`; }).join('');
    const avenir = E.reservations.filter((r) => !r.annulee && r.fin > maintenant()).sort((a, b) => a.debut.localeCompare(b.debut)).slice(0, 12);
    return `
      <div class="vue-tete"><div><h1>Réservations</h1><p>Une réservation qui chevauche une autre sur le même véhicule, ou pour le même conducteur, est refusée.</p></div>
        <div class="actions"><button class="btn primaire" data-action="reservation-nouvelle">${ICONES.plus}Réserver</button></div></div>
      <div class="semaine-nav"><button class="btn petit" data-action="semaine" data-pas="-7" aria-label="Semaine précédente">←</button><b>Semaine du ${fmt(jours[0], { day: 'numeric', month: 'long' })} au ${fmt(jours[6], { day: 'numeric', month: 'long', year: 'numeric' })}</b><button class="btn petit" data-action="semaine" data-pas="7" aria-label="Semaine suivante">→</button>${semaine !== R.lundi(t) ? '<button class="btn petit lien" data-action="semaine" data-pas="0">Cette semaine</button>' : ''}</div>
      ${vs.length ? `<div class="defile planning-grand"><table class="planning"><thead><tr><th>Véhicule</th>${jours.map((j) => `<th class="${j === t ? 'auj' : ''}">${fmt(j, { weekday: 'short', day: 'numeric' })}</th>`).join('')}</tr></thead>
        <tbody>${vs.map((v) => `<tr><th><button class="lien-v" data-action="fiche" data-id="${v.id}"><span class="plaque">${esc(v.immat)}</span><small>${esc(v.libelle || '')}</small></button></th>${jours.map((j) => cellule(v, j)).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="planning-petit">${parJour}</div>` : vide('Aucun véhicule actif', 'Ajoute un véhicule pour le réserver.')}
      <h2 class="titre-section">Prochaines sorties <span>En cours et à venir.</span></h2>
      ${avenir.length ? `<div class="bloc-liste">${avenir.map((r) => ligneResa(r)).join('')}</div>` : '<p class="note">Aucune réservation à venir.</p>'}
      <h2 class="titre-section">Conducteurs <span>${pluriel(E.conducteurs.length, 'conducteur')}. Données personnelles : le strict nécessaire.</span></h2>
      <div class="ents">${E.conducteurs.map((c) => { const n = E.reservations.filter((r) => r.conducteurId === c.id && !r.annulee && r.fin > maintenant()).length; return `<button class="ent" data-action="conducteur-modifier" data-id="${c.id}"><b>${esc(c.nom)}</b><span>${esc(c.service || 'Service non précisé')}</span><span>${c.permis ? `Permis vérifié le ${fmtCourt(c.permis)}` : 'Permis : vérification non notée'}${n ? ` · ${pluriel(n, 'réservation')} à venir` : ''}</span></button>`; }).join('')}
        <button class="ent ajout" data-action="conducteur-nouveau">${ICONES.plus}<b>Conducteur</b><span>Nom, service, vérification du permis</span></button></div>`;
  }

  // ---------- Vue Incidents ----------
  const STATUTS_AMENDE = { 'a-designer': 'À désigner', designee: 'Conducteur désigné', payee: 'Payée', contestee: 'Contestée', classee: 'Classée' };
  const RESP = { 'a-determiner': 'À déterminer', non: 'Non responsable', partielle: 'Partiellement responsable', totale: 'Responsable' };

  function vueIncidents() {
    const t = auj();
    const amendes = [...E.amendes].sort((a, b) => (a.statut === 'a-designer' ? 0 : 1) - (b.statut === 'a-designer' ? 0 : 1) || (b.dateAvis || '').localeCompare(a.dateAvis || ''));
    const sinistres = [...E.sinistres].sort((a, b) => (a.statut === 'clos') - (b.statut === 'clos') || b.date.localeCompare(a.date));
    const carteAmende = (a) => {
      const ech = R.echeanceDesignation(a, E.reglages.designationJours);
      const retard = a.statut === 'a-designer' && ech && ech < t;
      const et = a.statut === 'a-designer' ? (retard ? ['rouge', `Désignation en retard`] : ['jaune', `À désigner ${ech ? quand(ech) : ''}`]) : ['gris', STATUTS_AMENDE[a.statut]];
      return `<li class="carte inc" style="--c:${a.statut === 'a-designer' ? (retard ? 'var(--rouge)' : 'var(--jaune)') : 'var(--gris)'}"><div class="carte-bande"></div><div class="carte-corps">
        <p class="carte-matiere"><span class="etiquette ${et[0]}">${et[1]}</span><span>${esc(vehicule(a.vehiculeId)?.immat || '')}</span></p>
        <h3>${esc(a.nature || 'Avis de contravention')}</h3>
        <p class="carte-meta"><span>Infraction ${fmtCourt(a.dateInfraction)} · avis ${fmtCourt(a.dateAvis)}${ech && a.statut === 'a-designer' ? ` · désigner avant le <b>${fmtCourt(ech)}</b>` : ''}</span><span>Conducteur : <b>${esc(nomC(a.conducteurId))}</b></span>${a.montant ? `<span>${eur(nombre(a.montant), 2)}</span>` : ''}</p></div>
        <div class="carte-actions">${a.statut === 'a-designer' ? `<button class="act" data-action="amende-designee" data-id="${a.id}">Désignée<small>c'est fait</small></button>` : ''}<button class="act ${a.statut === 'a-designer' ? 'refuser' : ''}" data-action="amende-modifier" data-id="${a.id}">Modifier<small>statut, conducteur</small></button></div></li>`;
    };
    const carteSinistre = (s) => `<li class="carte inc ${s.statut === 'clos' ? 'soldee' : ''}" style="--c:${s.statut === 'clos' ? 'var(--gris)' : 'var(--bleu)'}"><div class="carte-bande"></div><div class="carte-corps">
        <p class="carte-matiere"><span class="etiquette ${s.statut === 'clos' ? 'gris' : 'bleu'}">${s.statut === 'clos' ? 'Clos' : 'En cours'}</span><span>${esc(vehicule(s.vehiculeId)?.immat || '')}</span><span>${fmtCourt(s.date)}</span></p>
        <h3>${esc(s.description)}</h3>
        <p class="carte-meta"><span>Conducteur : <b>${esc(nomC(s.conducteurId))}</b></span><span>${RESP[s.responsabilite] || ''}</span><span>Reste à charge : ${s.cout !== '' && s.cout != null ? eur(nombre(s.cout), 2) : 'à connaître'}</span></p>${s.note ? `<p class="motif bleu">${esc(s.note)}</p>` : ''}</div>
        <div class="carte-actions">${s.statut !== 'clos' ? `<button class="act" data-action="sinistre-clore" data-id="${s.id}">Clore<small>dossier réglé</small></button>` : ''}<button class="act ${s.statut !== 'clos' ? 'refuser' : ''}" data-action="sinistre-modifier" data-id="${s.id}">Modifier<small>suivi, coût</small></button></div></li>`;
    return `
      <div class="vue-tete"><div><h1>Incidents</h1><p>Amendes à désigner dans les délais et sinistres en cours. Le conducteur est proposé d'après la réservation qui couvre la date.</p></div>
        <div class="actions"><button class="btn" data-action="sinistre-nouveau">${ICONES.plus}Sinistre</button><button class="btn primaire" data-action="amende-nouvelle">${ICONES.plus}Amende</button></div></div>
      <p class="aide rgpd"><b>Données sensibles.</b> Les amendes sont des données relatives à des infractions (article 10 du RGPD) : accès limité, durée de conservation limitée, conducteurs informés. Voir le Guide.</p>
      <h2 class="titre-section">Amendes <span>Délai de désignation réglé : ${E.reglages.designationJours} jours après l'avis (${esc(B.designation.texte)}).</span></h2>
      ${amendes.length ? `<ul class="cartes">${amendes.map(carteAmende).join('')}</ul>` : vide('Aucune amende', 'Rien à désigner.', '', true)}
      <h2 class="titre-section">Sinistres <span>Reste à charge = franchise et frais non remboursés.</span></h2>
      ${sinistres.length ? `<ul class="cartes">${sinistres.map(carteSinistre).join('')}</ul>` : vide('Aucun sinistre', 'Aucun dossier ouvert.', '', true)}`;
  }

  // ---------- Vue Coûts ----------
  const SEG = [['detention', 'Loyers ou amortissement'], ['depenses', 'Énergie et autres dépenses'], ['entretien', 'Entretien et contrôles'], ['sinistres', 'Sinistres']];
  function lignesCouts() {
    return E.vehicules.map((v) => ({ v, c: R.coutVehicule(E, v, auj()) })).sort((a, b) => b.c.total - a.c.total);
  }
  function vueCouts() {
    const l = lignesCouts();
    const tot = l.reduce((s, x) => { SEG.forEach(([k]) => { s[k] = (s[k] || 0) + x.c[k]; }); s.total += x.c.total; s.km += x.c.km; s.amendes += x.c.amendes; return s; }, { total: 0, km: 0, amendes: 0 });
    const max = Math.max(1, ...l.map((x) => x.c.total));
    const recentes = [...E.depenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    const ck = (x) => (x === null ? '–' : `${x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    return `
      <div class="vue-tete"><div><h1>Coûts</h1><p>Coût total de chaque véhicule depuis son entrée dans la flotte et coût au kilomètre. Montants tels que saisis (HT ou TTC : reste cohérent).</p></div>
        <div class="actions"><button class="btn" data-action="csv-couts">Journal CSV</button><button class="btn" data-action="csv-vehicules">Synthèse CSV</button><button class="btn primaire" data-action="depense-nouvelle">${ICONES.plus}Dépense</button></div></div>
      <div class="tuiles">
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Coût total</p><b>${Math.round(tot.total).toLocaleString('fr-FR')}<small>€</small></b><span>${pluriel(E.vehicules.length, 'véhicule')}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Coût moyen au km</p><b>${tot.km >= 1 ? (tot.total / tot.km).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}<small>€</small></b><span>${km(tot.km)} parcourus</span></div>
        <div class="tuile" style="--c:var(--jaune)"><p class="surtitre">Énergie et dépenses</p><b>${Math.round(tot.depenses || 0).toLocaleString('fr-FR')}<small>€</small></b><span>Hors loyers et entretien</span></div>
        <div class="tuile rond" style="--c:var(--bleu)"><p class="surtitre">Amendes</p><b>${E.amendes.length}</b><span>${E.amendes.filter((a) => a.statut === 'a-designer').length} à désigner · ${tot.amendes ? `${eur(tot.amendes)} saisis, ` : ''}hors coût total</span></div>
      </div>
      <h2 class="titre-section">Par véhicule <span>Survole ou touche une barre pour le détail.</span></h2>
      <figure class="graphique" id="graphique">
        <div class="graphique-tete"><h2>Coût total par poste</h2><div class="legende">${SEG.map(([k, lib]) => `<span><i style="background:${B.couleurs[k]}"></i>${lib}</span>`).join('')}</div></div>
        ${l.length ? `<div class="piles">${l.map(({ v, c }, k) => `<div class="pile" data-i="${k}" tabindex="0" aria-label="${esc(v.immat)} : ${SEG.map(([s, lib]) => `${lib} ${eur(c[s])}`).join(', ')}, coût au km ${ck(c.coutKm)}">
          <div class="pile-tete"><b>${esc(v.immat)} · ${esc(v.libelle || '')}</b><span>${ck(c.coutKm)} / km · ${km(c.km)}</span></div>
          <div class="pile-barre"><div class="pile-segments" style="width:calc((100% - 110px) * ${(c.total / max).toFixed(4)})">${SEG.map(([s]) => (c[s] > 0 ? `<i style="flex:${c[s]};background:${B.couleurs[s]}"></i>` : '')).join('')}</div><span class="pile-total">${eur(c.total)}</span></div></div>`).join('')}</div>` : '<p class="vide-graph">Aucun véhicule.</p>'}
        <div class="infobulle" hidden></div>
        <div class="sr-only"><table><caption>Coût par véhicule et par poste</caption><thead><tr><th>Véhicule</th>${SEG.map(([, lib]) => `<th>${lib}</th>`).join('')}<th>Coût au km</th></tr></thead><tbody>${l.map(({ v, c }) => `<tr><td>${esc(v.immat)}</td>${SEG.map(([s]) => `<td>${eur(c[s])}</td>`).join('')}<td>${ck(c.coutKm)}</td></tr>`).join('')}</tbody></table></div>
      </figure>
      <h2 class="titre-section">Tableau des coûts</h2>
      <div class="defile"><table class="tableau couts"><thead><tr><th>Véhicule</th>${SEG.map(([, lib]) => `<th class="nb">${lib}</th>`).join('')}<th class="nb">Total</th><th class="nb">Km</th><th class="nb">€ / km</th></tr></thead>
        <tbody>${l.map(({ v, c }) => `<tr><td><button class="lien-v" data-action="fiche" data-id="${v.id}"><b>${esc(v.immat)}</b><small>${esc(v.libelle || '')}</small></button></td>${SEG.map(([s]) => `<td class="nb">${eur(c[s])}</td>`).join('')}<td class="nb"><b>${eur(c.total)}</b></td><td class="nb">${Math.round(c.km).toLocaleString('fr-FR')}</td><td class="nb">${ck(c.coutKm)}</td></tr>`).join('')}
        <tr class="total"><td>Flotte</td>${SEG.map(([s]) => `<td class="nb">${eur(tot[s] || 0)}</td>`).join('')}<td class="nb">${eur(tot.total)}</td><td class="nb">${Math.round(tot.km).toLocaleString('fr-FR')}</td><td class="nb">${tot.km >= 1 ? ck(tot.total / tot.km) : '–'}</td></tr></tbody></table></div>
      <p class="note">Achat : amortissement linéaire de gestion (prix ÷ durée prévue, par mois plein), pas un amortissement comptable. Location : loyers échus. Pour ta comptabilité, demande l'avis de ton expert-comptable.</p>
      <h2 class="titre-section">Dernières dépenses</h2>
      ${recentes.length ? `<div class="bloc-liste">${recentes.map((d) => `<button class="ligne-hist" data-action="depense-modifier" data-id="${d.id}"><span class="date">${fmtCourt(d.date)}</span><span><b>${esc(vehicule(d.vehiculeId)?.immat || '')}</b> · ${esc(B.postes.find((p) => p.code === d.poste)?.nom || d.poste)}${d.libelle ? ` · ${esc(d.libelle)}` : ''}</span><span class="nb">${eur(nombre(d.montant), 2)}</span></button>`).join('')}</div>` : '<p class="note">Aucune dépense saisie.</p>'}`;
  }

  function brancherGraphique() {
    const fig = $('#graphique');
    if (!fig) return;
    const bulle = fig.querySelector('.infobulle');
    const l = lignesCouts();
    const montrer = (el) => {
      const { v, c } = l[Number(el.dataset.i)];
      fig.querySelectorAll('.pile').forEach((p) => p.classList.toggle('active', p === el));
      bulle.innerHTML = `<b>${esc(v.immat)}</b>${SEG.map(([s, lib]) => `<div><i style="background:${B.couleurs[s]}"></i>${lib} : ${eur(c[s])}</div>`).join('')}<div>Total : ${eur(c.total)}</div>`;
      bulle.hidden = false;
      const rp = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
      bulle.style.left = `${Math.max(8, Math.min(rf.width - bulle.offsetWidth - 8, rp.left - rf.left + 40))}px`;
      bulle.style.top = `${rp.bottom - rf.top + 4}px`;
    };
    fig.querySelectorAll('.pile').forEach((p) => {
      p.addEventListener('pointerenter', () => montrer(p));
      p.addEventListener('click', () => montrer(p));
      p.addEventListener('focus', () => montrer(p));
    });
    const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.pile').forEach((p) => p.classList.remove('active')); };
    fig.addEventListener('pointerleave', cacher);
    fig.addEventListener('focusout', cacher);
  }

  // ---------- Vue Guide ----------
  function vueGuide() {
    const rg = E.reglages;
    const D = B.designation;
    const modifie = rg.ctPremierMois !== B.ct.premierMois || rg.ctPeriodiqueMois !== B.ct.periodiqueMois || rg.ctPollutionMois !== B.ct.pollutionMois;
    return `
      <div class="vue-tete"><div><h1>Guide et sources</h1><p>Les règles utilisées pour calculer les échéances, d'où elles viennent, et ce que l'outil ne fait pas.</p></div></div>
      <h2 class="titre-section">Contrôle technique <span>Sources officielles, consultées le ${esc(B.ct.consulte)}.</span></h2>
      <div class="legal">
        <p>Règles appliquées${modifie ? ' <b>(modifiées dans tes réglages)</b>' : ''} : premier contrôle au plus tard la veille du <b>${rg.ctPremierMois / 12 === Math.round(rg.ctPremierMois / 12) ? `${rg.ctPremierMois / 12}e anniversaire` : `${rg.ctPremierMois}e mois`}</b> de la 1re mise en circulation ; puis <b>tous les ${rg.ctPeriodiqueMois} mois</b> ; pour les camionnettes (N1) non exemptées par leur énergie, contrôle complémentaire pollution <b>${rg.ctPollutionMois} mois</b> après chaque contrôle périodique. Contre-visite : la date limite est celle indiquée sur ton procès-verbal.</p>
        <ul>${B.ct.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.titre)}</a> (service-public.gouv.fr, vérifié le ${esc(s.verifie)}) : ${esc(s.resume)}</li>`).join('')}</ul>
        <p>Ces règles changent parfois : vérifie la fiche officielle et, au besoin, corrige les périodicités dans les Réglages. Véhicules de collection, poids lourds et cas particuliers : choisis le type « Autre » et saisis la périodicité.</p>
      </div>
      <h2 class="titre-section">Désignation du conducteur <span>Repère, pas un conseil juridique.</span></h2>
      <div class="legal">
        <p><b>${esc(D.texte)}</b> (${esc(D.version)}, consulté sur Légifrance le ${esc(D.consulte)}), en substance : ${esc(D.resume)}</p>
        <p><a href="${D.url}" target="_blank" rel="noopener">Lire le texte sur Légifrance</a>. Délai utilisé par l'outil : ${rg.designationJours} jours après la date de l'avis (modifiable dans les Réglages). Les montants des amendes ne sont pas repris ici : reporte celui de l'avis.</p>
      </div>
      <h2 class="titre-section">Plan d'entretien indicatif <span>Ordres de grandeur courants. Le carnet d'entretien du constructeur fait foi.</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Opération</th><th class="nb">Tous les</th><th class="nb">ou tous les</th><th>Pour</th></tr></thead><tbody>${B.entretiens.map((o) => `<tr><td>${esc(o.nom)}</td><td class="nb">${o.km ? km(o.km) : '–'}</td><td class="nb">${o.mois ? `${o.mois} mois` : '–'}</td><td>${{ tous: 'Tous', thermique: 'Moteur thermique ou hybride', electrique: 'Électrique' }[o.pour]}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Ces intervalles servent de point de départ à la création d'un véhicule. Ils varient beaucoup selon le moteur, l'usage (trajets courts, charge, remorquage) et le constructeur : adapte le plan de chaque véhicule avec son carnet (« Adapter le plan au carnet » dans la fiche). Un véhicule sous garantie doit suivre le carnet pour la conserver.</p>
      <h2 class="titre-section">Données personnelles (RGPD)</h2>
      <ul class="limites">${B.rgpd.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <h2 class="titre-section">Comment l'outil calcule</h2>
      <ul class="limites">
        <li><b>Kilométrage actuel</b> : le plus grand relevé connu (relevés, entretiens, retours de réservation). <b>Rythme</b> : entre le plus ancien et le plus récent relevé des 12 derniers mois.</li>
        <li><b>Entretien</b> : dernière fois que l'opération a été faite (ou entrée du véhicule) + intervalle ; la première échéance atteinte, en km ou en date, compte. Alerte ${E.reglages.alerteJours} jours ou ${km(E.reglages.alerteKm)} avant.</li>
        <li><b>Location longue durée</b> : projection = km parcourus + rythme × jours restants ; dépassement × prix du km supplémentaire de ton contrat.</li>
        <li><b>Coût au km</b> : coût total depuis l'entrée ÷ km parcourus depuis l'entrée.</li>
      </ul>
      <h2 class="titre-section">Limites de la version actuelle</h2>
      <ul class="limites">
        <li><b>Pas de pièces jointes</b> : cartes grises, avis et procès-verbaux restent dans tes dossiers ; note leur référence dans les champs de texte.</li>
        <li><b>Un compte, une clé</b> : les conducteurs ne réservent pas eux-mêmes ; la personne chargée de la flotte saisit les réservations.</li>
        <li><b>Pas de géolocalisation</b> ni de lecture automatique du compteur.</li>
      </ul>`;
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
      if (err === false) return;
      d.close();
    });
    if (!d.open) d.showModal();
    d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED_NOUVEAU = (lib = 'Ajouter') => `<button class="btn primaire" value="ok">${lib}</button><button class="btn" value="annuler">Annuler</button>`;
  const PIED_MODIF = '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>';
  const choixVehicule = (choisi, nom = 'vehiculeId', tous = false) => `<label class="champ">Véhicule<select name="${nom}" required>${(tous ? E.vehicules : actifs()).map((v) => `<option value="${v.id}" ${v.id === choisi ? 'selected' : ''}>${esc(nomV(v))}</option>`).join('')}</select></label>`;
  const choixConducteur = (choisi, lib = 'Conducteur') => `<label class="champ">${lib}<select name="conducteurId"><option value="">Non désigné</option>${[...E.conducteurs].sort((a, b) => a.nom.localeCompare(b.nom)).map((c) => `<option value="${c.id}" ${c.id === choisi ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>`;
  const texte = (f, k) => String(f.get(k) || '').trim();
  const montant = (f, k) => { const s = texte(f, k); if (!s) return ''; const n = nombre(s); return n >= 0 ? R.arrondi(n) : null; };

  // Modifie l'état avec annulation possible depuis le toast.
  function modifier(fn, message, annulable = true) {
    const avant = structuredClone(E);
    const r = fn();
    if (typeof r === 'string') return r;
    annulation = annulable ? () => { E = avant; } : null;
    sauver(); rendre();
    if (message) toast(message, annulable ? { libelle: 'Annuler', faire: annuler } : null);
    return undefined;
  }
  function supprimer(col, id, message) {
    return modifier(() => { E[col] = E[col].filter((x) => x.id !== id); }, message);
  }

  function modaleVehicule(id) {
    const v = id ? vehicule(id) : null;
    const t = auj();
    const l = v?.lld || {};
    const corps = `
      <div class="grille-2">
        <label class="champ">Immatriculation<input name="immat" required maxlength="20" value="${esc(v?.immat || '')}" autocapitalize="characters" placeholder="AA-123-AA"></label>
        <label class="champ">Libellé<input name="libelle" maxlength="60" value="${esc(v?.libelle || '')}" placeholder="Ex. : Fourgon atelier"></label>
        <label class="champ">Type<select name="type" id="m-type">${optionsTypes(v?.type || 'M1')}</select></label>
        <label class="champ">Énergie<select name="energie">${optionsEnergies(v?.energie || 'ES')}</select></label>
        <label class="champ">1re mise en circulation<input type="date" name="mec" required max="${t}" value="${v?.miseEnCirculation || ''}"></label>
        <label class="champ">Dernier contrôle technique connu<small>Avant ton suivi ici, facultatif.</small><input type="date" name="ctDernier" max="${t}" value="${v?.ctDernier || ''}"></label>
      </div>
      <div class="grille-2" id="m-autre" ${v?.type === 'AUTRE' ? '' : 'hidden'}>
        <label class="champ">1er contrôle après (mois)<input type="number" name="ctPremierMois" min="0" max="240" value="${esc(v?.ctPremierMois ?? '')}"></label>
        <label class="champ">Puis tous les (mois)<input type="number" name="ctMois" min="0" max="120" value="${esc(v?.ctMois ?? '')}"></label>
      </div>
      <div class="grille-2">
        <label class="champ">Entrée dans la flotte<input type="date" name="entree" required max="${t}" value="${v?.entree || t}"></label>
        <label class="champ">Kilométrage à l'entrée<input type="number" name="kmEntree" required min="0" inputmode="numeric" value="${esc(v?.kmEntree ?? '')}"></label>
      </div>
      <fieldset class="champ bascule"><legend>Détention</legend><div>${[['achat', 'Achat'], ['lld', 'Location longue durée']].map(([k, lib]) => `<label><input type="radio" name="detention" value="${k}" ${(v?.detention || 'achat') === k ? 'checked' : ''}><span>${lib}</span></label>`).join('')}</div></fieldset>
      <div class="grille-2" id="m-achat">
        <label class="champ">Prix d'achat (€)<small>Facultatif.</small><input name="prixAchat" inputmode="decimal" value="${esc(v?.prixAchat ?? '')}"></label>
        <label class="champ">Durée d'amortissement (mois)<small>Durée de détention prévue.</small><input type="number" name="amortMois" min="1" max="240" value="${esc(v?.amortMois ?? '')}"></label>
      </div>
      <div class="groupe" id="m-lld">
        <h3>Contrat de location <small>Valeurs de ton contrat.</small></h3>
        <div class="grille-2">
          <label class="champ">Début<input type="date" name="lldDebut" value="${l.debut || ''}"></label>
          <label class="champ">Durée (mois)<input type="number" name="lldDuree" min="1" max="120" value="${esc(l.dureeMois ?? '')}"></label>
          <label class="champ">Kilométrage contractuel total<input type="number" name="lldKm" min="0" inputmode="numeric" value="${esc(l.kmContrat ?? '')}"></label>
          <label class="champ">Kilométrage au début<input type="number" name="lldKmDebut" min="0" inputmode="numeric" value="${esc(l.kmDebut ?? '')}"></label>
          <label class="champ">Loyer mensuel (€)<input name="lldLoyer" inputmode="decimal" value="${esc(l.loyer ?? '')}"></label>
          <label class="champ">Prix du km supplémentaire (€)<input name="lldKmSup" inputmode="decimal" value="${esc(l.prixKmSup ?? '')}"></label>
        </div>
      </div>
      <label class="champ">Notes<textarea name="notes" maxlength="500" placeholder="Ex. : clés au bureau 12, carte carburant n° 2">${esc(v?.notes || '')}</textarea></label>
      ${v ? `<label class="case"><input type="checkbox" name="inactif" ${v.actif === false ? 'checked' : ''}> Sorti de la flotte (vendu, restitué) : plus d'alertes ni de réservations</label>` : '<p class="aide">Un plan d\'entretien <b>indicatif</b> est créé selon l\'énergie : adapte-le ensuite au carnet du constructeur.</p>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(v ? `Modifier ${esc(v.immat)}` : 'Nouveau véhicule', corps, v ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        const n = ['releves', 'entretiens', 'controles', 'reservations', 'sinistres', 'amendes', 'depenses'].reduce((s, c) => s + E[c].filter((x) => x.vehiculeId === v.id).length, 0);
        if (!confirm(`Supprimer ${v.immat}${n ? ` et ses ${pluriel(n, 'enregistrement')} (relevés, entretiens, réservations…)` : ''} ? Pour garder l'historique, coche plutôt « Sorti de la flotte ».`)) return '';
        ficheId = null;
        modifier(() => { E.vehicules = E.vehicules.filter((x) => x.id !== v.id); ['releves', 'entretiens', 'controles', 'reservations', 'sinistres', 'amendes', 'depenses'].forEach((c) => { E[c] = E[c].filter((x) => x.vehiculeId !== v.id); }); }, `${v.immat} supprimé.`);
        return;
      }
      const immat = R.immat(f.get('immat'));
      if (!immat) return 'Indique l\'immatriculation.';
      if (E.vehicules.some((x) => x.immat === immat && x.id !== v?.id)) return 'Cette immatriculation existe déjà.';
      if (!R.estDate(f.get('mec'))) return 'Indique la date de 1re mise en circulation.';
      if (!R.estDate(f.get('entree'))) return 'Indique la date d\'entrée dans la flotte.';
      const kmEntree = Number(f.get('kmEntree'));
      if (f.get('kmEntree') === '' || !Number.isFinite(kmEntree) || kmEntree < 0) return 'Indique le kilométrage à l\'entrée.';
      const detention = f.get('detention');
      const prixAchat = montant(f, 'prixAchat'), loyer = montant(f, 'lldLoyer'), kmSup = texte(f, 'lldKmSup') ? nombre(texte(f, 'lldKmSup')) : '';
      if (prixAchat === null || loyer === null) return 'Montants : nombres positifs.';
      let lld = null;
      if (detention === 'lld') {
        if (!R.estDate(f.get('lldDebut')) || !(Number(f.get('lldDuree')) > 0)) return 'Location : indique le début et la durée du contrat.';
        lld = { debut: f.get('lldDebut'), dureeMois: Number(f.get('lldDuree')), kmContrat: Number(f.get('lldKm')) || 0, kmDebut: f.get('lldKmDebut') === '' ? kmEntree : Number(f.get('lldKmDebut')), loyer: loyer || 0, prixKmSup: kmSup };
      }
      const champs = { immat, libelle: texte(f, 'libelle'), type: f.get('type'), energie: f.get('energie'), miseEnCirculation: f.get('mec'), ctDernier: f.get('ctDernier') || '',
        ctPremierMois: f.get('ctPremierMois') === '' ? '' : Number(f.get('ctPremierMois')), ctMois: f.get('ctMois') === '' ? '' : Number(f.get('ctMois')),
        entree: f.get('entree'), kmEntree, detention, prixAchat, amortMois: f.get('amortMois') === '' ? '' : Number(f.get('amortMois')), lld, notes: texte(f, 'notes') };
      if (v) modifier(() => { Object.assign(v, champs, { actif: !f.get('inactif') }); }, `${immat} enregistré.`);
      else {
        const n = { id: uid(), ...champs, actif: true, plan: R.planDefaut(B, champs.energie) };
        modifier(() => { E.vehicules.push(n); }, `${immat} ajouté : adapte son plan d'entretien au carnet.`, false);
        ouvrirFiche(n.id);
      }
    });
    const d = modale();
    const majDet = () => { const lld = d.querySelector('[name=detention]:checked').value === 'lld'; $('#m-lld', d).hidden = !lld; $('#m-achat', d).hidden = lld; };
    d.querySelectorAll('[name=detention]').forEach((r) => r.addEventListener('change', majDet));
    majDet();
    $('#m-type', d).addEventListener('change', (e) => { $('#m-autre', d).hidden = e.target.value !== 'AUTRE'; });
  }

  function modalePlan(id) {
    const v = vehicule(id);
    const lignes = [...(v.plan || []), ...Array.from({ length: 2 }, () => ({ id: '', nom: '', km: '', mois: '' }))];
    const corps = `
      <p class="aide">Reprends les intervalles du <b>carnet d'entretien du constructeur</b> : il fait foi. Laisse un critère vide pour ne suivre que l'autre. Vide le nom pour retirer une opération.</p>
      <div class="plan-edit"><div class="plan-ligne entete"><span>Opération</span><span>km</span><span>mois</span></div>
      ${lignes.map((o, k) => `<div class="plan-ligne"><input name="nom-${k}" aria-label="Opération" maxlength="80" value="${esc(o.nom)}" placeholder="${o.id ? '' : 'Nouvelle opération'}"><input type="number" name="km-${k}" aria-label="Intervalle en km" min="0" value="${esc(o.km || '')}"><input type="number" name="mois-${k}" aria-label="Intervalle en mois" min="0" max="240" value="${esc(o.mois || '')}"><input type="hidden" name="id-${k}" value="${esc(o.id)}"></div>`).join('')}</div>
      <button class="btn petit lien" type="button" data-action="plan-base" data-id="${v.id}">Revenir au plan indicatif de la base</button>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(`Plan d'entretien · ${esc(v.immat)}`, corps, PIED_NOUVEAU('Enregistrer'), (f) => {
      const plan = [];
      for (let k = 0; k < lignes.length; k++) {
        const nom = texte(f, `nom-${k}`);
        if (!nom) continue;
        const kmI = Number(f.get(`km-${k}`)) || 0, mois = Number(f.get(`mois-${k}`)) || 0;
        if (kmI < 0 || mois < 0) return 'Intervalles : nombres positifs.';
        if (!kmI && !mois) return `« ${nom} » : indique un intervalle en km ou en mois.`;
        plan.push({ id: f.get(`id-${k}`) || uid(), code: '', nom, km: kmI, mois });
      }
      modifier(() => { v.plan = plan; }, 'Plan d\'entretien enregistré.');
    });
  }

  function modaleReleve(vehiculeId, idReleve) {
    const r = idReleve ? trouver('releves', idReleve) : null;
    if (!actifs().length && !r) { toast('Aucun véhicule actif.'); return; }
    const t = auj();
    const vId = r?.vehiculeId || vehiculeId || actifs()[0].id;
    const corps = `
      ${choixVehicule(vId, 'vehiculeId', !!r)}
      <div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${r?.date || t}" max="${t}" required></label>
      <label class="champ">Compteur (km)<small id="m-km-aide"></small><input type="number" name="km" min="0" inputmode="numeric" required value="${esc(r?.km ?? '')}"></label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(r ? 'Modifier le relevé' : 'Relevé kilométrique', corps, r ? PIED_MODIF : PIED_NOUVEAU('Enregistrer'), (f, action) => {
      if (action === 'supprimer') return supprimer('releves', r.id, 'Relevé supprimé.');
      const v = vehicule(f.get('vehiculeId'));
      const k = Number(f.get('km'));
      if (f.get('km') === '') return 'Indique le kilométrage.';
      if (f.get('date') > t) return 'La date ne peut pas être dans le futur.';
      const err = R.verifierReleve(R.pointsKm(E, v), f.get('date'), k, r?.id);
      if (err) return err;
      if (r) return modifier(() => { Object.assign(r, { vehiculeId: v.id, date: f.get('date'), km: k }); }, 'Relevé enregistré.');
      return modifier(() => { E.releves.push({ id: uid(), vehiculeId: v.id, date: f.get('date'), km: k }); }, `${v.immat} : ${km(k)} relevés.`);
    });
    const d = modale();
    const aide = () => { const v = vehicule(d.querySelector('[name=vehiculeId]').value); const s = synthese(v); $('#m-km-aide', d).textContent = `Dernier connu : ${km(s.kmA)}${s.dernier ? ` le ${fmtCourt(s.dernier)}` : ''}.`; };
    d.querySelector('[name=vehiculeId]').addEventListener('change', aide);
    aide();
  }

  function modaleEntretien(vehiculeId, idE) {
    const x = idE ? trouver('entretiens', idE) : null;
    const v = vehicule(x?.vehiculeId || vehiculeId);
    const t = auj();
    const s = synthese(v);
    const proposees = new Set(x ? x.operations : s.plan.filter((e) => e.etat === 'retard' || e.etat === 'proche').map((e) => e.op.id));
    const corps = `
      <p class="aide">${esc(nomV(v))} · ${km(s.kmA)} au dernier relevé</p>
      <div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${x?.date || t}" max="${t}" required></label>
      <label class="champ">Compteur (km)<input type="number" name="km" min="0" inputmode="numeric" value="${esc(x?.km ?? '')}" placeholder="${Math.round(s.kmA)}"></label></div>
      <fieldset class="champ sans-cadre"><legend>Opérations faites <small>Celles qui arrivent à échéance sont cochées.</small></legend><div class="choix-lots compact">${(v.plan || []).map((o) => `<label class="case"><input type="checkbox" name="op" value="${esc(o.id)}" ${proposees.has(o.id) ? 'checked' : ''}> ${esc(o.nom)}</label>`).join('')}</div></fieldset>
      <div class="grille-2"><label class="champ">Prestataire<input name="prestataire" maxlength="80" value="${esc(x?.prestataire || '')}"></label>
      <label class="champ">Coût (€)<input name="cout" inputmode="decimal" value="${esc(x?.cout ?? '')}"></label></div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(x?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier l\'entretien' : `Entretien fait · ${esc(v.immat)}`, corps, x ? PIED_MODIF : PIED_NOUVEAU('Enregistrer'), (f, action) => {
      if (action === 'supprimer') return supprimer('entretiens', x.id, 'Entretien supprimé.');
      if (!R.estDate(f.get('date')) || f.get('date') > t) return 'Date invalide (pas dans le futur).';
      const kmS = f.get('km') === '' ? '' : Number(f.get('km'));
      if (kmS !== '') { const err = R.verifierReleve(R.pointsKm(E, v), f.get('date'), kmS, x?.id); if (err) return err; }
      const ops = f.getAll('op');
      if (!ops.length) return 'Coche au moins une opération.';
      const cout = montant(f, 'cout');
      if (cout === null) return 'Coût : nombre positif.';
      const champs = { vehiculeId: v.id, date: f.get('date'), km: kmS, operations: ops, prestataire: texte(f, 'prestataire'), cout, note: texte(f, 'note') };
      if (x) return modifier(() => { Object.assign(x, champs); }, 'Entretien enregistré.');
      return modifier(() => { E.entretiens.push({ id: uid(), ...champs }); }, `Entretien enregistré : ${pluriel(ops.length, 'opération')} remise${ops.length > 1 ? 's' : ''} à zéro.`);
    });
  }

  function modaleControle(vehiculeId, idC) {
    const x = idC ? trouver('controles', idC) : null;
    const v = vehicule(x?.vehiculeId || vehiculeId);
    const t = auj();
    const s = synthese(v);
    const natureDefaut = x?.nature || (s.ct.find((c) => c.nature === 'contre-visite') ? 'contre-visite' : s.ct.find((c) => c.nature === 'pollution' && c.etat !== 'ok') ? 'pollution' : 'periodique');
    const corps = `
      <p class="aide">${esc(nomV(v))}</p>
      <div class="grille-2"><label class="champ">Date du contrôle<input type="date" name="date" value="${x?.date || t}" max="${t}" required></label>
      <label class="champ">Nature<select name="nature">${[['periodique', 'Contrôle périodique'], ['pollution', 'Complémentaire pollution'], ['contre-visite', 'Contre-visite']].map(([k, lib]) => `<option value="${k}" ${k === natureDefaut ? 'selected' : ''}>${lib}</option>`).join('')}</select></label></div>
      <fieldset class="champ bascule"><legend>Résultat</legend><div>${[['favorable', 'Favorable'], ['contre-visite', 'Contre-visite à faire']].map(([k, lib]) => `<label><input type="radio" name="resultat" value="${k}" ${(x?.resultat || 'favorable') === k ? 'checked' : ''}><span>${lib}</span></label>`).join('')}</div></fieldset>
      <label class="champ" id="m-limite">Contre-visite au plus tard le<small>Date indiquée sur le procès-verbal.</small><input type="date" name="limite" value="${x?.limite || ''}"></label>
      <div class="grille-2"><label class="champ">Centre<input name="centre" maxlength="80" value="${esc(x?.centre || '')}"></label>
      <label class="champ">Coût (€)<input name="cout" inputmode="decimal" value="${esc(x?.cout ?? '')}"></label></div>
      <label class="champ">Défauts relevés, note<input name="note" maxlength="200" value="${esc(x?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier le contrôle' : `Contrôle technique · ${esc(v.immat)}`, corps, x ? PIED_MODIF : PIED_NOUVEAU('Enregistrer'), (f, action) => {
      if (action === 'supprimer') return supprimer('controles', x.id, 'Contrôle supprimé.');
      if (!R.estDate(f.get('date')) || f.get('date') > t) return 'Date invalide (pas dans le futur).';
      const resultat = f.get('resultat');
      if (resultat === 'contre-visite' && (!R.estDate(f.get('limite')) || f.get('limite') < f.get('date'))) return 'Indique la date limite de la contre-visite (après le contrôle).';
      const cout = montant(f, 'cout');
      if (cout === null) return 'Coût : nombre positif.';
      const champs = { vehiculeId: v.id, date: f.get('date'), nature: f.get('nature'), resultat, limite: resultat === 'contre-visite' ? f.get('limite') : '', centre: texte(f, 'centre'), cout, note: texte(f, 'note') };
      if (x) return modifier(() => { Object.assign(x, champs); }, 'Contrôle enregistré.');
      return modifier(() => { E.controles.push({ id: uid(), ...champs }); }, resultat === 'favorable' ? 'Contrôle favorable enregistré : prochaine échéance recalculée.' : `Contre-visite à faire avant le ${fmtCourt(champs.limite)}.`);
    });
    const d = modale();
    const maj = () => { $('#m-limite', d).hidden = d.querySelector('[name=resultat]:checked').value !== 'contre-visite'; };
    d.querySelectorAll('[name=resultat]').forEach((r) => r.addEventListener('change', maj));
    maj();
  }

  function modaleReservation(idR, defauts = {}) {
    const r = idR ? trouver('reservations', idR) : null;
    if (!actifs().length && !r) { toast('Ajoute d\'abord un véhicule.'); return; }
    const t = auj();
    const jour = defauts.jour || t;
    const debut = r?.debut || `${jour}T08:00`, fin = r?.fin || `${jour}T18:00`;
    const corps = `
      ${choixVehicule(r?.vehiculeId || defauts.vehiculeId || actifs()[0].id, 'vehiculeId', !!r)}
      ${choixConducteur(r?.conducteurId || '')}
      <div class="grille-2"><label class="champ">Début<input type="datetime-local" name="debut" value="${debut}" required step="900"></label>
      <label class="champ">Fin<input type="datetime-local" name="fin" value="${fin}" required step="900"></label></div>
      <label class="champ">Motif<input name="motif" maxlength="120" value="${esc(r?.motif || '')}" placeholder="Ex. : visites de chantiers"></label>
      ${r && r.debut <= maintenant() ? `<label class="champ">Kilométrage au retour<small>Crée le relevé du véhicule.</small><input type="number" name="kmRetour" min="0" inputmode="numeric" value="${esc(r.kmRetour ?? '')}"></label>` : ''}
      <p class="erreur" role="alert"></p>`;
    const pied = r ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>' : PIED_NOUVEAU('Réserver');
    ouvrirModale(r ? 'Réservation' : 'Nouvelle réservation', corps, pied, (f, action) => {
      if (action === 'supprimer') return supprimer('reservations', r.id, 'Réservation supprimée.');
      const n = { id: r?.id || uid(), vehiculeId: f.get('vehiculeId'), conducteurId: f.get('conducteurId') || '', debut: String(f.get('debut') || '').slice(0, 16), fin: String(f.get('fin') || '').slice(0, 16), motif: texte(f, 'motif') };
      const err = R.validerReservation(E.reservations, n, { vehicule: (i) => vehicule(i)?.immat || 'Ce véhicule', conducteur: (i) => nomC(i) });
      if (err) return err;
      if (r && f.has('kmRetour') && f.get('kmRetour') !== '') {
        const k = Number(f.get('kmRetour'));
        const e2 = R.verifierReleve(R.pointsKm(E, vehicule(n.vehiculeId)), n.fin.slice(0, 10), k, r.id);
        if (e2) return e2;
        n.kmRetour = k;
      } else if (r) n.kmRetour = r.kmRetour ?? '';
      if (r) return modifier(() => { Object.assign(r, n); }, 'Réservation enregistrée.');
      return modifier(() => { E.reservations.push(n); }, `${vehicule(n.vehiculeId).immat} réservé ${quand(n.debut.slice(0, 10))} de ${heure(n.debut)} à ${heure(n.fin)}.`);
    });
  }

  function modaleRetour(idR) {
    const r = trouver('reservations', idR);
    const v = vehicule(r.vehiculeId);
    const s = synthese(v);
    ouvrirModale(`Retour · ${esc(v.immat)}`, `
      <p class="aide">${esc(nomC(r.conducteurId))} · ${fmtCourt(r.debut.slice(0, 10))} ${heure(r.debut)} → ${fmtCourt(r.fin.slice(0, 10))} ${heure(r.fin)}${r.motif ? ` · ${esc(r.motif)}` : ''}</p>
      <label class="champ">Kilométrage au retour<small>Dernier connu : ${km(s.kmA)}.</small><input type="number" name="km" min="0" inputmode="numeric" required></label>
      <p class="erreur" role="alert"></p>`, PIED_NOUVEAU('Enregistrer'), (f) => {
      const k = Number(f.get('km'));
      if (f.get('km') === '') return 'Indique le kilométrage.';
      const err = R.verifierReleve(R.pointsKm(E, v), r.fin.slice(0, 10), k, r.id);
      if (err) return err;
      return modifier(() => { r.kmRetour = k; }, `${v.immat} rendu à ${km(k)}.`);
    });
  }

  function modaleConducteur(id) {
    const c = id ? conducteur(id) : null;
    const nb = c ? E.reservations.filter((r) => r.conducteurId === c.id).length + E.sinistres.filter((s) => s.conducteurId === c.id).length + E.amendes.filter((a) => a.conducteurId === c.id).length : 0;
    const corps = `
      <label class="champ">Nom<small>Prénom et initiale suffisent souvent.</small><input name="nom" required maxlength="60" value="${esc(c?.nom || '')}"></label>
      <label class="champ">Service ou fonction<input name="service" maxlength="60" value="${esc(c?.service || '')}"></label>
      <label class="champ">Permis vérifié le<small>Date à laquelle tu as vu le permis. Ne note ni le numéro ni les points.</small><input type="date" name="permis" max="${auj()}" value="${c?.permis || ''}"></label>
      <p class="aide rgpd"><b>RGPD</b> : informe le conducteur que ses réservations, sinistres et amendes sont suivis ici. Supprime sa fiche quand il quitte la structure et que plus aucun dossier ne le concerne.</p>
      ${c && nb ? `<p class="aide">${pluriel(nb, 'enregistrement')} le concerne (réservations, sinistres, amendes).</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(c ? 'Modifier le conducteur' : 'Nouveau conducteur', corps, c ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer ${c.nom} ?${nb ? ' Ses réservations, sinistres et amendes resteront, sans conducteur désigné.' : ''}`)) return '';
        return modifier(() => {
          E.conducteurs = E.conducteurs.filter((x) => x.id !== c.id);
          ['reservations', 'sinistres', 'amendes'].forEach((col) => E[col].forEach((x) => { if (x.conducteurId === c.id) x.conducteurId = ''; }));
        }, `${c.nom} supprimé.`);
      }
      const nom = texte(f, 'nom');
      if (!nom) return 'Indique le nom.';
      const champs = { nom, service: texte(f, 'service'), permis: f.get('permis') || '' };
      if (c) return modifier(() => { Object.assign(c, champs); }, 'Conducteur enregistré.');
      return modifier(() => { E.conducteurs.push({ id: uid(), ...champs }); }, `${nom} ajouté.`);
    });
  }

  function modaleSinistre(id, vehiculeId) {
    const s = id ? trouver('sinistres', id) : null;
    if (!E.vehicules.length) { toast('Ajoute d\'abord un véhicule.'); return; }
    const t = auj();
    const corps = `
      ${choixVehicule(s?.vehiculeId || vehiculeId || actifs()[0]?.id, 'vehiculeId', true)}
      <div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${s?.date || t}" max="${t}" required></label>
      ${choixConducteur(s?.conducteurId || '')}</div>
      <label class="champ">Description<textarea name="description" required maxlength="300" placeholder="Ex. : choc arrière en manœuvre, feu cassé">${esc(s?.description || '')}</textarea></label>
      <div class="grille-2"><label class="champ">Responsabilité<select name="responsabilite">${Object.entries(RESP).map(([k, lib]) => `<option value="${k}" ${k === (s?.responsabilite || 'a-determiner') ? 'selected' : ''}>${lib}</option>`).join('')}</select></label>
      <label class="champ">Reste à charge (€)<small>Franchise et frais non remboursés.</small><input name="cout" inputmode="decimal" value="${esc(s?.cout ?? '')}"></label></div>
      <label class="champ">Suivi<input name="note" maxlength="200" value="${esc(s?.note || '')}" placeholder="Ex. : constat envoyé, expertise le…"></label>
      <label class="case"><input type="checkbox" name="clos" ${s?.statut === 'clos' ? 'checked' : ''}> Dossier clos</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(s ? 'Sinistre' : 'Nouveau sinistre', corps, s ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') return supprimer('sinistres', s.id, 'Sinistre supprimé.');
      const description = texte(f, 'description');
      if (!description) return 'Décris le sinistre.';
      const cout = montant(f, 'cout');
      if (cout === null) return 'Reste à charge : nombre positif.';
      const champs = { vehiculeId: f.get('vehiculeId'), conducteurId: f.get('conducteurId') || '', date: f.get('date'), description, responsabilite: f.get('responsabilite'), cout, note: texte(f, 'note'), statut: f.get('clos') ? 'clos' : 'ouvert' };
      if (!R.estDate(champs.date)) return 'Date invalide.';
      if (s) return modifier(() => { Object.assign(s, champs); }, 'Sinistre enregistré.');
      return modifier(() => { E.sinistres.push({ id: uid(), ...champs }); }, 'Sinistre ajouté.');
    });
  }

  function modaleAmende(id, vehiculeId) {
    const a = id ? trouver('amendes', id) : null;
    if (!E.vehicules.length) { toast('Ajoute d\'abord un véhicule.'); return; }
    const t = auj();
    const corps = `
      <p class="aide rgpd"><b>Donnée sensible</b> (infraction) : note le strict nécessaire, sans points de permis. Le montant est celui de l'avis.</p>
      ${choixVehicule(a?.vehiculeId || vehiculeId || actifs()[0]?.id, 'vehiculeId', true)}
      <div class="grille-2"><label class="champ">Date de l'infraction<input type="date" name="dateInfraction" id="m-dinf" value="${a?.dateInfraction || ''}" max="${t}" required></label>
      <label class="champ">Date de l'avis<small>En haut de l'avis reçu.</small><input type="date" name="dateAvis" value="${a?.dateAvis || t}" max="${t}" required></label></div>
      <label class="champ">Nature<input name="nature" maxlength="80" value="${esc(a?.nature || '')}" placeholder="Ex. : stationnement, vitesse"></label>
      <div class="grille-2">${choixConducteur(a?.conducteurId || '', 'Conducteur')}
      <label class="champ">Montant (€)<input name="montant" inputmode="decimal" value="${esc(a?.montant ?? '')}"></label></div>
      <p class="aide" id="m-propose" hidden></p>
      <label class="champ">Statut<select name="statut">${Object.entries(STATUTS_AMENDE).map(([k, lib]) => `<option value="${k}" ${k === (a?.statut || 'a-designer') ? 'selected' : ''}>${lib}</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(a ? 'Amende' : 'Nouvelle amende', corps, a ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') return supprimer('amendes', a.id, 'Amende supprimée.');
      if (!R.estDate(f.get('dateInfraction')) || !R.estDate(f.get('dateAvis'))) return 'Indique la date de l\'infraction et celle de l\'avis.';
      if (f.get('dateAvis') < f.get('dateInfraction')) return 'L\'avis ne peut pas précéder l\'infraction.';
      const m = montant(f, 'montant');
      if (m === null) return 'Montant : nombre positif.';
      const champs = { vehiculeId: f.get('vehiculeId'), dateInfraction: f.get('dateInfraction'), dateAvis: f.get('dateAvis'), nature: texte(f, 'nature'), conducteurId: f.get('conducteurId') || '', montant: m, statut: f.get('statut') };
      if (champs.statut === 'designee' && !champs.conducteurId) return 'Indique le conducteur désigné.';
      const ech = R.echeanceDesignation(champs, E.reglages.designationJours);
      if (a) return modifier(() => { Object.assign(a, champs); }, 'Amende enregistrée.');
      return modifier(() => { E.amendes.push({ id: uid(), ...champs }); }, champs.statut === 'a-designer' ? `Amende ajoutée : désigner le conducteur avant le ${fmtCourt(ech)}.` : 'Amende ajoutée.');
    });
    // Conducteur proposé d'après la réservation qui couvre la date de l'infraction.
    const d = modale();
    const proposer = () => {
      const c = R.conducteurA(E.reservations, d.querySelector('[name=vehiculeId]').value, $('#m-dinf', d).value);
      const p = $('#m-propose', d);
      p.hidden = !c;
      if (c) { p.textContent = `D'après le planning, ${nomC(c)} avait ce véhicule ce jour-là : vérifie avant de désigner.`; const sel = d.querySelector('[name=conducteurId]'); if (!sel.value) sel.value = c; }
    };
    $('#m-dinf', d).addEventListener('change', proposer);
    d.querySelector('[name=vehiculeId]').addEventListener('change', proposer);
    if (a) proposer();
  }

  function modaleDepense(id, vehiculeId) {
    const x = id ? trouver('depenses', id) : null;
    if (!E.vehicules.length) { toast('Ajoute d\'abord un véhicule.'); return; }
    const t = auj();
    const corps = `
      ${choixVehicule(x?.vehiculeId || vehiculeId || actifs()[0]?.id, 'vehiculeId', true)}
      <div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${x?.date || t}" required></label>
      <label class="champ">Poste<select name="poste">${B.postes.map((p) => `<option value="${p.code}" ${p.code === (x?.poste || 'ENE') ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}</select></label></div>
      <div class="grille-2"><label class="champ">Montant (€)<input name="montant" inputmode="decimal" required value="${esc(x?.montant ?? '')}"></label>
      <label class="champ">Libellé<input name="libelle" maxlength="80" value="${esc(x?.libelle || '')}" placeholder="Ex. : plein, recharge"></label></div>
      <p class="aide">Loyers de location, entretiens, contrôles et sinistres ont leur propre saisie : ne les ajoute pas ici.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Dépense' : 'Nouvelle dépense', corps, x ? PIED_MODIF : PIED_NOUVEAU(), (f, action) => {
      if (action === 'supprimer') return supprimer('depenses', x.id, 'Dépense supprimée.');
      const m = montant(f, 'montant');
      if (m === '' || m === null) return 'Indique un montant positif.';
      if (!R.estDate(f.get('date'))) return 'Date invalide.';
      const champs = { vehiculeId: f.get('vehiculeId'), date: f.get('date'), poste: f.get('poste'), montant: m, libelle: texte(f, 'libelle') };
      if (x) return modifier(() => { Object.assign(x, champs); }, 'Dépense enregistrée.');
      return modifier(() => { E.depenses.push({ id: uid(), ...champs }); }, `Dépense de ${eur(m, 2)} ajoutée.`);
    });
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <label class="champ">Ta structure<small>En tête des exports.</small><input name="structure" maxlength="80" value="${esc(E.structure)}"></label>
      <div class="grille-3">
        <label class="champ">Alerte (jours)<input type="number" name="alerteJours" min="0" max="180" value="${r.alerteJours}"></label>
        <label class="champ">Alerte (km)<input type="number" name="alerteKm" min="0" max="20000" value="${r.alerteKm}"></label>
        <label class="champ">Relevé ancien après (j)<input type="number" name="releveAncienJours" min="1" max="365" value="${r.releveAncienJours}"></label>
      </div>
      <div class="groupe"><h3>Contrôle technique et désignation</h3>
        <div class="grille-3">
          <label class="champ">1er contrôle (mois)<input type="number" name="ctPremierMois" min="1" max="240" value="${r.ctPremierMois}"></label>
          <label class="champ">Périodique (mois)<input type="number" name="ctPeriodiqueMois" min="1" max="120" value="${r.ctPeriodiqueMois}"></label>
          <label class="champ">Pollution N1 (mois)<input type="number" name="ctPollutionMois" min="0" max="60" value="${r.ctPollutionMois}"></label>
        </div>
        <label class="champ">Désignation du conducteur (jours après l'avis)<input type="number" name="designationJours" min="1" max="365" value="${r.designationJours}"></label>
        <p class="aide">Valeurs de départ : ${B.ct.premierMois}, ${B.ct.periodiqueMois} et ${B.ct.pollutionMois} mois (service-public.gouv.fr, vérifié le ${esc(B.ct.sources[0].verifie)}) ; ${B.designation.jours} jours (${esc(B.designation.texte)}). Sources dans le Guide. Change-les seulement si la règle officielle a changé.</p>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes données sont enregistrées en ligne avec ta clé.'} Place utilisée : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-vehicules">Synthèse véhicules (CSV)</button><button class="btn petit" type="button" data-action="csv-couts">Journal des coûts (CSV)</button><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, PIED_NOUVEAU('Enregistrer'), (f) => {
      const n = (k, min, max) => { const v = Number(f.get(k)); return Number.isInteger(v) && v >= min && v <= max ? v : null; };
      const vals = { alerteJours: n('alerteJours', 0, 180), alerteKm: n('alerteKm', 0, 20000), releveAncienJours: n('releveAncienJours', 1, 365), ctPremierMois: n('ctPremierMois', 1, 240), ctPeriodiqueMois: n('ctPeriodiqueMois', 1, 120), ctPollutionMois: n('ctPollutionMois', 0, 60), designationJours: n('designationJours', 1, 365) };
      if (Object.values(vals).some((x) => x === null)) return 'Réglages : nombres entiers dans les limites indiquées.';
      return modifier(() => { E.structure = texte(f, 'structure'); Object.assign(r, vals); }, 'Réglages enregistrés.');
    });
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.vehicules)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.vehicules.length, 'véhicule')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function telecharger(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
  function toast(texteT, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texteT)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    if (ficheId && !vehicule(ficheId)) ficheId = null;
    sauver(); rendre();
  }

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    const ferme = () => { if (modale().open) modale().close(); };
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); ficheId = null; rendre(); } break;
      case 'deconnexion': ferme(); deconnecter(); break;
      case 'vue': ferme(); if (el.dataset.vue === 'vehicules') ficheId = null; changerVue(el.dataset.vue); break;
      case 'aller-vehicules': changerVue('vehicules'); break;
      case 'aller-planning': changerVue('reservations'); break;
      case 'fiche': ferme(); ouvrirFiche(id); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': telecharger(JSON.stringify(E, null, 2), `gestion-flotte-${auj()}.json`, 'application/json'); break;
      case 'csv-vehicules': telecharger(R.csvVehicules(E, B, auj()), `flotte-vehicules-${auj()}.csv`, 'text/csv;charset=utf-8'); toast('Synthèse exportée (CSV, point-virgule).'); break;
      case 'csv-couts': telecharger(R.csvCouts(E, B, auj()), `flotte-couts-${auj()}.csv`, 'text/csv;charset=utf-8'); toast('Journal des coûts exporté (CSV, point-virgule).'); break;
      case 'fermer': modale().close(); break;
      case 'vehicule-nouveau': modaleVehicule(); break;
      case 'vehicule-modifier': modaleVehicule(id); break;
      case 'plan': modalePlan(id); break;
      case 'plan-base': if (confirm('Remplacer le plan de ce véhicule par le plan indicatif de la base ?')) { const v = vehicule(id); ferme(); modifier(() => { v.plan = R.planDefaut(B, v.energie); }, 'Plan indicatif rétabli : adapte-le au carnet.'); } break;
      case 'releve': modaleReleve(id || (vue === 'vehicules' ? ficheId : null)); break;
      case 'releve-modifier': modaleReleve(null, id); break;
      case 'entretien-nouveau': modaleEntretien(id); break;
      case 'entretien-modifier': modaleEntretien(null, id); break;
      case 'controle-nouveau': modaleControle(id); break;
      case 'controle-modifier': modaleControle(null, id); break;
      case 'reservation-nouvelle': modaleReservation(null, { vehiculeId: el.dataset.vehicule, jour: el.dataset.jour }); break;
      case 'reservation-modifier': modaleReservation(id); break;
      case 'retour': modaleRetour(id); break;
      case 'semaine': semaine = Number(el.dataset.pas) ? ajout(semaine || R.lundi(auj()), Number(el.dataset.pas)) : R.lundi(auj()); rendre(); break;
      case 'conducteur-nouveau': modaleConducteur(); break;
      case 'conducteur-modifier': modaleConducteur(id); break;
      case 'sinistre-nouveau': modaleSinistre(null, id); break;
      case 'sinistre-modifier': modaleSinistre(id); break;
      case 'sinistre-clore': { const s = trouver('sinistres', id); modifier(() => { s.statut = 'clos'; }, 'Sinistre clos.'); break; }
      case 'amende-nouvelle': modaleAmende(null, id); break;
      case 'amende-modifier': modaleAmende(id); break;
      case 'amende-designee': {
        const a = trouver('amendes', id);
        if (!a.conducteurId) { modaleAmende(id); toast('Choisis le conducteur désigné, puis le statut « Conducteur désigné ».'); break; }
        modifier(() => { a.statut = 'designee'; }, `Conducteur désigné : ${nomC(a.conducteurId)}.`);
        break;
      }
      case 'depense-nouvelle': modaleDepense(null, id); break;
      case 'depense-modifier': modaleDepense(id); break;
      default: break;
    }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open) rendre();
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
      const { statut, corps } = await appel('/connexion', { method: 'POST', body: JSON.stringify({ code }) });
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
  window.__flotte = { etat: () => E };
  init();
})();
