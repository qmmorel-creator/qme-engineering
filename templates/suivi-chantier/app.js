// Suivi de chantier par lot QME : marchés par lot, avenants, situations de travaux et échéancier, jalons
// contractuels recalés, journal et intempéries, sous-traitants, non-conformités (registre simplifié),
// risques, courriers et ordres de service, synthèse financière et revue de projet.
// Données synchronisées par clé de licence ou code d'accès. Aucun envoi, aucun lien avec une autre application.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.CHT;
  const API = '/api/templates';
  const PRODUIT = 'CHT';
  const CLE_CODE = 'qme-cht-code';
  const CLE_CACHE = 'qme-cht-cache';
  const CLE_DEMO = 'qme-cht-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-cht-ecran-accueil';
  const DEFAUTS = { reglages: B.reglages, pieces: B.pieces };

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => R.nouvelId();
  const pluriel = (n, s, p) => `${String(n).replace('.', ',')} ${n > 1 ? (p || s + 's') : s}`;
  const stock = {
    lire(cle) { try { const v = localStorage.getItem(cle) ?? sessionStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch { return null; } },
    ecrire(cle, v, session = false) { try { (session ? sessionStorage : localStorage).setItem(cle, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
    suppr(cle) { try { localStorage.removeItem(cle); sessionStorage.removeItem(cle); } catch { /* idem */ } },
  };
  const { ajout, versDate, euros, pct } = R;
  const eur = (c) => euros(c, { centimes: false });
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const dateLongue = (s) => fmt(s, { day: 'numeric', month: 'long', year: 'numeric' });
  const dateCourte = (s) => fmt(s, { day: 'numeric', month: 'short' });
  const nomMois = (m) => versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const moisCourt = (m) => versDate(`${m}-01`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  const MQ_TEL = matchMedia('(max-width: 720px)');
  const estTel = () => MQ_TEL.matches;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'tableau';
  const sous = { planning: 'jalons', registres: 'nc' };
  const filtre = { nc: 'ouvertes', lot: '' };
  let annulation = null;

  const etatVide = () => R.etatVide();
  const normaliser = (d) => R.normaliser(d, DEFAUTS);
  const op = () => E.operations.find((o) => o.id === E.actif) || E.operations[0];
  const lot = (id) => R.lotDe(op(), id);
  const nomLot = (id) => { const l = lot(id); return l ? `${l.code} · ${l.nom}` : 'Toute l\'opération'; };
  const codeLot = (id) => lot(id)?.code || 'Opération';

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
        toast('Un autre appareil a modifié le suivi entre-temps : sa version est affichée. Refais ta dernière saisie si elle manque.');
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
  // Code interne (CHT-…, ou celui d'un autre template, refusé ensuite avec un message clair) :
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
      if (E.operations.length) { demarrer(); envoyer(); } else ecranAccueil();
      return;
    }
    E = donnees ? normaliser(donnees) : null;
    session.base = donnees?.majLe ?? null;
    if (E && E.operations.length) { cache(false); demarrer(); } else ecranAccueil();
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    const d = stock.lire(CLE_DEMO);
    E = d && d.operations?.length ? normaliser(d) : donneesDemo();
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
  // Opération fictive de 32 logements, 8 lots, environ 8 mois de chantier simulés avec les vraies règles, à des
  // dates relatives à aujourd'hui. États forcés : avenants signé, en projet et refusé ; lot au-delà de son
  // marché ; situation à valider, validée en retard de paiement, payées ; lot pas commencé ; jalons atteint,
  // atteint en retard, en retard avec pénalités, proche, à venir ; intempéries retenues ou non ; NC en retard,
  // critique, à vérifier, closes ; risque critique ; courrier en retard, OS en attente ; sous-traitant à relancer.
  function donneesDemo() {
    const t = auj();
    const j = (n) => ajout(t, n);
    let graine = 20261114;
    const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let x = Math.imul(graine ^ (graine >>> 15), 1 | graine); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const moisCourant = R.moisDe(t);
    const o = {
      id: uid(), nom: 'Résidence Les Tilleuls · 32 logements', reference: 'OP-EX-24', maitreOuvrage: 'Habitat Exemple (fictif)', maitreOeuvre: 'Atelier d\'architecture Exemple',
      lieu: 'Commune Exemple', dateOS: j(-240), dateFin: j(120), notes: 'Opération fictive de démonstration : noms, montants et dates inventés.',
      reglages: { ...B.reglages, delaisNC: { ...B.reglages.delaisNC } },
      lots: [], avenants: [], situations: [], echeancier: [], jalons: [], journal: [], nc: [], risques: [], courriers: [], sousTraitants: [], intervenants: [],
      pieces: B.pieces.map((n, i) => ({ id: uid(), nom: n, present: i !== B.pieces.length - 1, version: i < 4 ? 'Version marché' : '' })),
    };
    // code, intitulé, entreprise, montant HT (€), début et fin (jours relatifs), retard d'avancement, plafond pénalités
    const specs = [
      ['GO', 'Gros œuvre', 'Bâti Exemple', 1480000, -215, -40, 0.04, 5],
      ['CE', 'Couverture et étanchéité', 'Toitures Exemple', 212000, -125, -20, -0.06, 5],
      ['ME', 'Menuiseries extérieures', 'Menuiseries Exemple', 265000, -95, 5, 0.12, 5],
      ['PLA', 'Plâtrerie, cloisons et faux plafonds', 'Plâtrerie Exemple', 192000, -65, 70, 0.03, 0],
      ['PLB', 'Plomberie et sanitaires', 'Sanitaires Exemple', 176000, -110, 90, 0.02, 0],
      ['CVC', 'Chauffage, ventilation et climatisation', 'Thermique Exemple', 318000, -105, 100, 0.05, 0],
      ['ELE', 'Électricité courants forts et faibles', 'Électricité Exemple', 246000, -95, 100, 0, 0],
      ['PEI', 'Peinture et revêtements muraux', 'Finitions Exemple', 121000, 20, 110, 0, 0],
    ];
    const L = {};
    for (const [code, nom, entreprise, m, d, f, , plafond] of specs) {
      const l = { id: uid(), code, nom, entreprise, montant: m * 100, debut: j(d), fin: j(f), plafond };
      o.lots.push(l); L[code] = l;
      for (const e of R.echeancierLineaire(l.montant, l.debut, l.fin)) o.echeancier.push({ id: uid(), lot: l.id, ...e });
    }
    // Avenants
    const av = (code, numero, objet, montant, delai, statut, d) => o.avenants.push({ id: uid(), lot: L[code].id, numero, objet, montant: montant * 100, delai, statut, date: d === null ? '' : j(d) });
    av('GO', 1, 'Renforcement des fondations (sol de moindre portance que prévu)', 38500, 10, 'signe', -170);
    av('GO', 2, 'Suppression du local de stockage extérieur', -12000, 0, 'signe', -120);
    av('CE', 1, 'Zinguerie complémentaire des acrotères', 14800, 0, 'projet', null);
    av('CVC', 1, 'Ventilation hygroréglable dans 4 logements supplémentaires', 18400, 5, 'projet', null);
    av('ME', 1, 'Changement de teinte des menuiseries', 9600, 15, 'refuse', -60);
    av('PLB', 1, 'Douches accessibles dans 2 logements', 6200, 0, 'signe', -40);
    // Situations mensuelles : cumul = marché actualisé × avancement à la fin du mois (courbe en S légère, retard).
    const k = (i) => (i < 3 ? 1 : Math.round((1 + 0.004 * (i - 2)) * 10000) / 10000);
    const sit = [];
    for (const [code, , , , , , retard] of specs) {
      const l = L[code];
      const act = R.marcheLot(o, l.id).actualise;
      const fin = code === 'CE' ? 1.04 : 1;
      let i = 0, num = 0;
      for (const m of R.listeMois(R.moisDe(l.debut), R.moisDe(l.fin))) {
        if (m >= moisCourant) break;
        const fm = R.finDeMois(m) < l.fin ? R.finDeMois(m) : l.fin;
        const lin = Math.min(1, (R.ecart(l.debut, fm) + 1) / (R.ecart(l.debut, l.fin) + 1));
        const s = lin * lin * (3 - 2 * lin); // courbe en S
        const av2 = Math.max(0, Math.min(fin, s * fin - retard * Math.sin(Math.PI * lin)));
        if (av2 < 0.01) continue; // pas de situation pour un mois sans travaux significatifs
        num++;
        const reception = ajout(R.finDeMois(m), 3 + Math.floor(alea() * 4));
        sit.push({ id: uid(), lot: l.id, numero: num, mois: m, cumul: Math.round(act * av2 / 100) * 100, k: k(i), penalites: 0, dateReception: reception, statut: 'payee', dateValidation: ajout(reception, 8), datePaiement: ajout(reception, 24 + Math.floor(alea() * 10)), note: '' });
        i++;
      }
    }
    o.situations = sit;
    // Dernier mois : à valider (reçues), sauf GO et CE validées ; ME : une situation validée en retard de paiement.
    const dernieres = {};
    for (const s of o.situations) if (!dernieres[s.lot] || s.mois > dernieres[s.lot].mois) dernieres[s.lot] = s;
    for (const s of Object.values(dernieres)) {
      if (s.dateReception > j(-20)) { s.statut = 'recue'; s.dateValidation = ''; s.datePaiement = ''; }
    }
    const sitME = o.situations.filter((s) => s.lot === L.ME.id).sort((a, b) => (a.mois < b.mois ? -1 : 1));
    if (sitME.length >= 2) { const s = sitME[sitME.length - 2]; s.statut = 'validee'; s.datePaiement = ''; s.dateReception = j(-44); s.dateValidation = j(-36); }
    const sitGO = o.situations.filter((s) => s.lot === L.GO.id).sort((a, b) => (a.mois < b.mois ? -1 : 1));
    if (sitGO.length) { const s = sitGO[sitGO.length - 1]; s.statut = 'validee'; s.datePaiement = ''; s.penalites = 160000; s.note = 'Pénalités de retard sur la fin du gros œuvre, appliquées par le maître d\'œuvre.'; }
    if (sitGO.length > 3) sitGO[2].datePaiement = ajout(sitGO[2].dateReception, 41);
    // Jalons
    const jal = (lotCode, nom, type, d, reel, penaliteJour = 0) => o.jalons.push({ id: uid(), lot: lotCode ? L[lotCode].id : '', nom, type, date: j(d), dateReelle: reel === null ? '' : j(reel), prolonger: true, penaliteJour: penaliteJour * 100, note: '' });
    jal('', 'Ordre de service de démarrage', 'contractuel', -240, -240);
    jal('', 'Fin de la période de préparation', 'contractuel', -210, -212);
    jal('GO', 'Fin du gros œuvre', 'contractuel', -62, -36, 400);
    jal('CE', 'Hors d\'eau', 'interne', -30, -24);
    jal('ME', 'Hors d\'air', 'contractuel', -9, null, 300);
    jal('PLA', 'Cloisonnement achevé', 'interne', 3, null);
    jal('CVC', 'Mise en service du chauffage', 'interne', 62, null);
    jal('', 'Opérations préalables à la réception (OPR)', 'interne', 105, null);
    jal('', 'Réception', 'contractuel', 120, null);
    jal('', 'Levée des réserves', 'contractuel', 180, null);
    jal('ELE', 'Remise du dossier des ouvrages exécutés (DOE)', 'contractuel', 135, null);
    // Journal : jours ouvrés des 4 dernières semaines, et intempéries plus anciennes.
    const faits = [
      'Coulage du dallage du hall B.', 'Pose des menuiseries du R+2, cage A.', 'Réunion de chantier hebdomadaire : planning cloisons validé.',
      'Réception des supports de peinture du R+1 reportée.', 'Livraison des radiateurs, stockés au rez-de-chaussée.', 'Passage du contrôleur technique : réservations CVC.',
      'Essais de mise en pression du réseau d\'eau, cage A.', 'Visite du maître d\'ouvrage, logements témoins.', 'Tirage des câbles courants faibles au R+3.',
      'Pose des faux plafonds des circulations, cage B.', 'Nettoyage et évacuation des déchets de plâtre.', 'Repérage des réserves de façade avec l\'architecte.',
    ];
    const meteoNormale = ['Ensoleillé', 'Nuageux', 'Nuageux', 'Pluie'];
    for (let d = -28; d <= 0; d++) {
      const jour = versDate(j(d)).getDay();
      if (jour === 0 || jour === 6) continue;
      const pluie = d === -11 || d === -12;
      o.journal.push({ id: uid(), date: j(d), meteo: pluie ? 'Forte pluie' : meteoNormale[Math.floor(alea() * meteoNormale.length)], effectif: 34 + Math.floor(alea() * 18), faits: faits[Math.floor(alea() * faits.length)], intemperie: pluie ? { jours: d === -11 ? 1 : 0.5, retenue: d === -11, lot: d === -11 ? L.CE.id : '', nature: 'Pluie' } : null });
    }
    const intemp = [[-190, 'Gel', 'GO', 1, true], [-189, 'Gel', 'GO', 1, true], [-188, 'Gel', 'GO', 1, true], [-160, 'Neige', '', 1, true], [-96, 'Vent fort', 'GO', 0.5, false], [-75, 'Pluie', '', 1, false]];
    for (const [d, nature, code, jours, retenue] of intemp) o.journal.push({ id: uid(), date: j(d), meteo: nature, effectif: 6 + Math.floor(alea() * 10), faits: `Arrêt des travaux exposés (${nature.toLowerCase()}).`, intemperie: { jours, retenue, lot: code ? L[code].id : '', nature } });
    // Non-conformités
    const nc = (code, d, titre, type, gravite, statut, ech, action, cloture = null) => o.nc.push({ id: uid(), lot: L[code].id, date: j(d), titre, type, gravite, statut, echeance: ech === null ? '' : j(ech), action, dateCloture: cloture === null ? '' : j(cloture) });
    nc('PLA', -26, 'Plaques non hydrofuges en salles de bains, logements B11 et B12', 'Matériau ou produit non conforme', 'majeure', 'ouverte', -11, 'Dépose et remplacement par des plaques hydrofuges avant carrelage.');
    nc('CE', -8, 'Relevé d\'étanchéité insuffisant en acrotère, toiture-terrasse B', 'Exécution non conforme au CCTP', 'critique', 'traitement', 1, 'Reprise du relevé et essai d\'arrosage contradictoire.');
    nc('ME', -19, 'Joint de calfeutrement discontinu, séjour A21', 'Défaut d\'aspect', 'mineure', 'levee', -2, 'Reprise du joint sur toute la périphérie.');
    nc('GO', -70, 'Planéité du dallage hors tolérance, local vélos', 'Tolérance dimensionnelle dépassée', 'majeure', 'close', -55, 'Ragréage sur 12 m², contrôle à la règle.', -52);
    nc('GO', -120, 'Fiche de contrôle du ferraillage non transmise, voile R+1', 'Documentaire', 'mineure', 'close', -105, 'Fiche transmise et visée.', -110);
    nc('ELE', -4, 'Réservation manquante pour le tableau, logement A03', 'Interface entre lots', 'mineure', 'ouverte', 26, 'Carottage coordonné avec le lot GO.');
    // Risques
    const risque = (titre, categorie, p, i, reponse, action, porteur, ech, montant, statut = 'ouvert', code = '') => o.risques.push({ id: uid(), lot: code ? L[code].id : '', titre, categorie, probabilite: p, impact: i, reponse, action, porteur, echeance: ech === null ? '' : j(ech), statut, montant: montant * 100 });
    risque('Date de raccordement électrique du poste non confirmée', 'Administratif et concessionnaires', 3, 4, 'reduire', 'Relance écrite du concessionnaire, point hebdomadaire.', 'Maître d\'œuvre', 10, 25000);
    risque('Effectif réduit de l\'entreprise de peinture au démarrage', 'Défaillance d\'entreprise', 3, 3, 'reduire', 'Demande de planning d\'effectif signé avant le démarrage.', 'OPC', 14, 18000, 'ouvert', 'PEI');
    risque('Coactivité plomberie, chauffage et électricité au R+2', 'Sécurité et coactivité', 3, 2, 'eviter', 'Phasage par cage validé en réunion de chantier.', 'Coordonnateur SPS', -2, 0);
    risque('Dérive des quantités de cloisons après modification de plans', 'Financier', 2, 2, 'accepter', 'Suivi des quantités à chaque situation.', 'Économiste', null, 8000, 'ouvert', 'PLA');
    risque('Gel au coulage des dallages extérieurs', 'Météo', 2, 3, 'reduire', 'Coulage avant fin novembre ou adjuvant antigel.', 'Bâti Exemple', 12, 6000, 'ouvert', 'GO');
    risque('Sol de moindre portance sous le bâtiment B', 'Technique', 4, 4, 'reduire', 'Traité par l\'avenant n° 1 du lot GO.', 'Maître d\'œuvre', null, 38500, 'clos', 'GO');
    // Courriers et ordres de service
    const courrier = (type, numero, d, code, sens, objet, rep = null, repondu = null, delai = 0, montant = 0) => o.courriers.push({ id: uid(), type, numero, date: j(d), lot: code ? L[code].id : '', sens, objet, reponseAttendue: rep === null ? '' : j(rep), dateReponse: repondu === null ? '' : j(repondu), incidenceDelai: delai, incidenceMontant: montant * 100, note: '' });
    courrier('os', 1, -240, '', 'emis', 'Démarrage de la période de préparation');
    courrier('os', 2, -210, '', 'emis', 'Démarrage des travaux');
    courrier('os', 3, -172, 'GO', 'emis', 'Travaux modificatifs des fondations', -165, -166, 10, 38500);
    courrier('courrier', 0, -48, 'ME', 'recu', 'Demande de prolongation de délai pour retard d\'approvisionnement', -34, -36);
    courrier('courrier', 0, -20, 'CE', 'emis', 'Demande de reprise du relevé d\'étanchéité et d\'essai d\'arrosage', -6, null);
    courrier('miseEnDemeure', 1, -3, 'ME', 'emis', 'Retard sur le hors d\'air, cage B', 5, null);
    courrier('os', 4, -2, 'CVC', 'emis', 'Ajournement partiel du lot CVC au R+3 en attente de l\'avenant', 12, null);
    courrier('pv', 0, -24, 'CE', 'emis', 'Constat du hors d\'eau, bâtiments A et B');
    // Sous-traitants
    const st = (code, entreprise, objet, montant, d, statut, acc = null, direct = false) => o.sousTraitants.push({ id: uid(), lot: L[code].id, entreprise, objet, montant: montant * 100, dateDemande: j(d), statut, dateAcceptation: acc === null ? '' : j(acc), paiementDirect: direct });
    st('GO', 'Ferraillage Exemple', 'Façonnage et pose des armatures', 142000, -205, 'accepte', -196, true);
    st('CVC', 'Calorifugeage Exemple', 'Calorifugeage des réseaux', 21500, -24, 'demande');
    st('ELE', 'Courants faibles Exemple', 'Interphonie et contrôle d\'accès', 31800, -80, 'accepte', -70, true);
    st('PLA', 'Faux plafonds Exemple', 'Faux plafonds des circulations', 26400, -6, 'demande');
    st('CE', 'Levage Exemple', 'Grutage des bacs acier', 7200, -118, 'refuse');
    // Intervenants (fictifs, coordonnées professionnelles d'exemple)
    const pers = (nom, societe, role, email) => o.intervenants.push({ id: uid(), nom, societe, role, email, telephone: '' });
    pers('Responsable de programme', 'Habitat Exemple (fictif)', 'Maître d\'ouvrage', 'programmes@example.com');
    pers('Chef de projet', 'Atelier d\'architecture Exemple', 'Maître d\'œuvre', 'chantiers@example.com');
    pers('Conducteur de travaux', 'Bâti Exemple', 'Entreprise titulaire', 'travaux@example.com');
    pers('Coordonnateur', 'Prévention Exemple', 'Coordonnateur SPS', 'sps@example.com');
    pers('Chargé d\'affaires', 'Contrôle Exemple', 'Contrôleur technique', 'controle@example.com');
    const e = etatVide();
    e.operations = [R.normaliserOperation(o, DEFAUTS)];
    e.actif = e.operations[0].id;
    return e;
  }

  // ---------- Rendu : connexion ----------
  const SYMBOLE = '<svg viewBox="0 0 80 80" width="32" height="32" aria-hidden="true"><path d="M40,0 A40,40 0 0 1 80,40 V80 H40 A40,40 0 0 1 0,40 A40,40 0 0 1 40,0 Z" fill="currentColor"/><rect x="40" y="40" width="40" height="40" fill="#D9302A"/><circle cx="40" cy="40" r="15" fill="#F0EDE6"/></svg>';
  const MARQUE = `${SYMBOLE}<span><span class="q">Q</span><span class="m">M</span><span class="e">E</span></span>`;

  function ecranConnexion(message = '') {
    document.title = 'Suivi de chantier par lot · QME';
    $('#racine').innerHTML = `
    <div class="connexion">
      <section class="composition" aria-label="Présentation">
        <a class="marque" href="/" aria-label="QME, Quentin Morel Engineering">${MARQUE}<small>Templates</small></a>
        <svg class="formes" viewBox="0 0 560 300" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
          <rect x="20" y="180" width="100" height="100" fill="#1D4E89"/>
          <rect x="130" y="130" width="100" height="150" fill="#F5B400"/>
          <rect x="240" y="70" width="100" height="210" fill="#D9302A"/>
          <rect x="20" y="40" width="210" height="70" fill="none" stroke="#141414" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="450" cy="170" r="110" fill="#F0EDE6"/>
          <path d="M450 170 L450 60 A110 110 0 0 1 560 170 Z" fill="#141414"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Suivi de chantier par lot</p>
          <h1>Chaque lot tenu, du marché au solde.</h1>
          <p>Marchés et avenants, situations de travaux, jalons recalés, non-conformités, risques, ordres de service : la revue de projet se prépare toute seule.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton suivi de chantier</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes opérations sont enregistrées en ligne et te suivent sur tous tes appareils, du bureau au chantier.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon suivi</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec une opération d'exemple</button>
        <p class="mention">Pas encore d'accès ? <a href="/catalogue/suivi-chantier/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon suivi'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement (et nouvelle opération) ----------
  const accueilVide = () => ({ etape: 1, nom: '', reference: '', maitreOuvrage: '', dateOS: '', dateFin: '', lots: B.lots.filter((l) => l.courant).map((l) => l.code), rg: '5', delaiPaiement: '30' });
  let accueil = accueilVide();

  function ecranAccueil() {
    const a = accueil;
    const premier = !E || !E.operations.length;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">${premier ? 'Bienvenue' : 'Nouvelle opération'}</p>
        <h1>${premier ? 'On ouvre le suivi de ton chantier.' : 'Une opération de plus.'}</h1>
        <p class="intro">Une opération, des lots, un marché par lot. Ensuite, chaque avenant, situation, jalon, courrier ou non-conformité se rattache à son lot : la synthèse financière, les délais recalés et la revue de projet se calculent.</p>
        <div class="grille-accueil">
          <label class="champ">Nom de l'opération<input id="a-nom" value="${esc(a.nom)}" maxlength="120" placeholder="Ex. : Résidence, groupe scolaire, extension…" required></label>
          <label class="champ">Référence <small>Facultatif</small><input id="a-reference" value="${esc(a.reference)}" maxlength="60"></label>
          <label class="champ">Maître d'ouvrage <small>Facultatif</small><input id="a-moa" value="${esc(a.maitreOuvrage)}" maxlength="120"></label>
          <label class="champ">Ordre de service de démarrage <small>Facultatif, crée le jalon</small><input id="a-os" type="date" value="${esc(a.dateOS)}"></label>
          <label class="champ">Fin contractuelle des travaux <small>Facultatif, crée le jalon de réception</small><input id="a-fin" type="date" value="${esc(a.dateFin)}"></label>
        </div>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <ol class="conseils" style="margin-top:28px">${B.conseils.map(([t2, d]) => `<li><b>${esc(t2)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="accueil-pied">${premier ? '<span></span>' : '<button class="btn" data-action="accueil-quitter">Annuler</button>'}<button class="btn primaire" data-action="accueil-suivant">Continuer</button></div>`;
    } else {
      corps = `
        <p class="surtitre">Étape 2</p>
        <h1>Le découpage en lots</h1>
        <p class="intro">Coche les lots de ton marché (découpage type, modifiable). Tu saisiras ensuite l'entreprise, le montant et les dates de chacun.</p>
        <div class="choix-lots">${B.lots.map((l) => `<label class="case"><input type="checkbox" name="lots" value="${l.code}" ${a.lots.includes(l.code) ? 'checked' : ''}><span><b>${l.code}</b> ${esc(l.nom)}</span></label>`).join('')}</div>
        <div class="grille-accueil" style="margin-top:20px">
          <label class="champ">Retenue de garantie (%) <small>D'après ton marché ; 0 si remplacée par une caution.</small><input id="a-rg" inputmode="decimal" value="${esc(a.rg)}"></label>
          <label class="champ">Délai de paiement (jours) <small>À compter de la réception d'une situation, d'après ton marché.</small><input id="a-delai" type="number" min="0" max="365" value="${esc(a.delaiPaiement)}"></label>
        </div>
        <p class="erreur" id="erreur-accueil" role="alert"></p>
        <div class="accueil-pied">
          <button class="btn" data-action="accueil-retour">Retour</button>
          <button class="btn primaire" data-action="accueil-fin">Créer l'opération</button>
        </div>`;
    }
    document.body.classList.remove('app');
    $('#racine').innerHTML = `<div class="accueil">${tete}${corps}</div>`;
    const lier = (sel, cle) => $(sel)?.addEventListener('input', (e) => { accueil[cle] = e.target.value; });
    lier('#a-nom', 'nom'); lier('#a-reference', 'reference'); lier('#a-moa', 'maitreOuvrage'); lier('#a-os', 'dateOS'); lier('#a-fin', 'dateFin'); lier('#a-rg', 'rg'); lier('#a-delai', 'delaiPaiement');
    document.querySelectorAll('[name=lots]').forEach((el) => el.addEventListener('change', () => { accueil.lots = [...document.querySelectorAll('[name=lots]:checked')].map((x) => x.value); }));
  }

  function terminerAccueil() {
    const a = accueil;
    const rg = Number(String(a.rg).replace(',', '.'));
    const delai = Math.round(Number(a.delaiPaiement));
    if (!(rg >= 0 && rg <= 100)) { $('#erreur-accueil').textContent = 'Taux de retenue entre 0 et 100 %.'; return; }
    if (!(delai >= 0 && delai <= 365)) { $('#erreur-accueil').textContent = 'Délai de paiement entre 0 et 365 jours.'; return; }
    const o = {
      id: uid(), nom: a.nom.trim(), reference: a.reference.trim(), maitreOuvrage: a.maitreOuvrage.trim(), dateOS: a.dateOS, dateFin: a.dateFin,
      reglages: { ...B.reglages, rg, delaiPaiement: delai },
      lots: B.lots.filter((l) => a.lots.includes(l.code)).map((l) => ({ id: uid(), code: l.code, nom: l.nom, entreprise: '', montant: 0, debut: '', fin: '', plafond: 0 })),
      jalons: [],
    };
    if (a.dateOS) o.jalons.push({ id: uid(), lot: '', nom: 'Ordre de service de démarrage', type: 'contractuel', date: a.dateOS });
    if (a.dateFin) o.jalons.push({ id: uid(), lot: '', nom: 'Réception', type: 'contractuel', date: a.dateFin });
    if (!E) E = etatVide();
    E.operations.push(R.normaliserOperation(o, DEFAUTS));
    E.actif = o.id;
    accueil = accueilVide();
    vue = 'lots';
    sauver();
    demarrer();
    toast(`Opération créée avec ${pluriel(o.lots.length, 'lot')}. Complète chaque lot : entreprise, montant du marché, dates.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    tableau: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    lots: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    finances: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="13" width="4" height="8" fill="currentColor"/><rect x="10" y="8" width="4" height="13" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="3" width="4" height="18" fill="currentColor"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 2 4h20Z" fill="currentColor"/></svg>',
    registres: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V11A10 10 0 0 1 13 21Z" fill="currentColor"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['tableau', 'Tableau de bord'], ['lots', 'Lots'], ['finances', 'Finances'], ['planning', 'Planning'], ['registres', 'Registres']];
  const AVERTISSEMENT = '<p class="mention avertissement">Outil de suivi : il ne remplace ni les pièces du marché ni un conseil juridique. Montants hors taxes calculés à partir de ta saisie ; taux de retenue, délai de paiement, coefficient de révision et pénalités viennent de ton marché. Les pénalités affichées sont une estimation.</p>';
  const COUL_AVENANT = { projet: 'jaune', signe: 'vert', refuse: 'sable' };
  const COUL_SITUATION = { recue: 'jaune', validee: 'ciel', payee: 'vert' };
  const COUL_JALON = { atteint: 'vert', atteintRetard: 'rose', retard: 'rouge', proche: 'jaune', aVenir: 'ciel' };
  const COUL_GRAVITE = { mineure: 'ciel', majeure: 'jaune', critique: 'rouge' };
  const COUL_NC = { ouverte: 'rose', traitement: 'jaune', levee: 'ciel', close: 'vert' };
  const COUL_NIVEAU = { faible: 'vert', modere: 'ciel', eleve: 'jaune', critique: 'rouge' };
  const COUL_ST = { demande: 'jaune', accepte: 'vert', refuse: 'sable' };
  const tag = (coul, texte) => `<span class="etiquette ${coul}">${esc(texte)}</span>`;

  function demarrer() {
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl) || depuisUrl === 'revue') vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><a class="bientot-demo" href="/catalogue/suivi-chantier/"><strong>Bientôt en vente</strong><span>Être prévenu de la sortie</span></a><span>Opération fictive, gardée sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Suivi de<br>chantier</span>
        <button class="op-courante" data-action="operations" aria-label="Changer d'opération"><span></span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg></button>
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
    if (!E || !$('#vue') || !op()) return;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { ...Object.fromEntries(ONGLETS), revue: 'Revue de projet' };
    document.title = `${titres[vue]} · Suivi de chantier`;
    const bouton = $('.op-courante span');
    if (bouton) bouton.textContent = op().nom;
    $('#vue').className = `vue vue-${vue}`;
    $('#vue').innerHTML = { tableau: vueTableau, lots: vueLots, finances: vueFinances, planning: vuePlanning, registres: vueRegistres, revue: vueRevue }[vue]();
    brancherInfobulles();
    $('#filtre-lot')?.addEventListener('change', (e) => { filtre.lot = e.target.value; rendre(); });
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="56" width="26" height="40" fill="#1D4E89"/><rect x="34" y="36" width="26" height="60" fill="#F5B400"/><rect x="68" y="12" width="26" height="84" fill="#D9302A"/></svg>';
  const vide = (titre, texte, actions = '') => `<div class="vide-etat petit"><div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;
  const selectLots = (nom, valeur, { operation = true, requis = false } = {}) => `<select name="${nom}" ${requis ? 'required' : ''}>${operation ? `<option value="">Toute l'opération</option>` : ''}${op().lots.map((l) => `<option value="${l.id}" ${l.id === valeur ? 'selected' : ''}>${esc(l.code)} · ${esc(l.nom)}</option>`).join('')}</select>`;
  const filtreLot = () => (op().lots.length > 1 ? `<label class="champ filtre-lot"><span class="sr-only">Filtrer par lot</span><select id="filtre-lot"><option value="">Tous les lots</option>${op().lots.map((l) => `<option value="${l.id}" ${l.id === filtre.lot ? 'selected' : ''}>${esc(l.code)} · ${esc(l.nom)}</option>`).join('')}</select></label>` : '');
  const garderLot = (x) => !filtre.lot || x.lot === filtre.lot;

  // ---------- Tableau de bord ----------
  function vueTableau() {
    const o = op(), t = auj();
    const f = R.syntheseFinanciere(o, t).total;
    const al = R.alertes(o, t);
    const jal = R.jalonsTries(o, t);
    const prochain = jal.find((x) => !x.jalon.dateReelle && x.jalon.type === 'contractuel');
    const retards = jal.filter((x) => x.etat === 'retard');
    const nc = R.bilanNC(o, t), rq = R.bilanRisques(o, t);
    const ep = R.ecartPrevisionnel(o, t);
    const sousTitre = [o.maitreOuvrage, o.dateOS && `OS de démarrage le ${dateLongue(o.dateOS)}`, o.dateFin && `fin contractuelle le ${dateLongue(o.dateFin)}`].filter(Boolean).map(esc).join(' · ');
    const titre = `<div class="vue-tete"><div><p class="surtitre">${esc(o.reference || 'Opération')}</p><h1>${esc(o.nom)}</h1><p>${sousTitre || 'Complète la fiche de l\'opération : maître d\'ouvrage, dates, retenue de garantie.'}</p></div>
        <div class="actions"><button class="btn" data-action="fiche-operation">Fiche de l'opération</button><button class="btn primaire" data-action="vue" data-vue="revue">Revue de projet</button></div></div>`;
    if (!o.lots.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun lot pour l'instant</h3><p>Ajoute les lots de ton marché depuis le découpage type, puis saisis pour chacun l'entreprise, le montant et les dates.</p><div class="actions"><button class="btn primaire" data-action="lots-types">${ICONES.plus}Ajouter des lots</button></div></div></div>${AVERTISSEMENT}`;
    const tuiles = [
      ['Marché actualisé', eur(f.actualise), `${eur(f.initial)} initial · avenants ${euros(f.avenantsSignes, { centimes: false, signe: true })} (${pct(f.ecartPct)})`, 'var(--bleu)', ''],
      ['Travaux facturés', pct(f.avancement, 0), `${eur(f.cumul)} cumulés${ep ? ` · ${euros(ep.ecart, { centimes: false, signe: true })} vs prévu` : ''}`, 'var(--jaune)', 'rond'],
      ['Délais', retards.length ? `${retards.length} en retard` : 'À l\'heure', prochain ? `${esc(prochain.jalon.nom)} : ${dateCourte(prochain.dateRecalee)}${prochain.prolongation ? ` (+${prochain.prolongation} j)` : ''}` : 'Aucun jalon contractuel à venir', 'var(--rouge)', ''],
      ['Qualité et risques', `${nc.ouvertes} NC`, `${nc.enRetard} en retard · ${pluriel(rq.parNiveau.critique, 'risque critique', 'risques critiques')}`, 'var(--encre)', 'rond'],
    ].map(([lib, v, d, c, forme]) => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const derniers = [...o.journal].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      <div class="colonnes-apercu">
        <section>
          <h2 class="titre-section">À traiter <span>${pluriel(al.filter((x) => x.niveau === 'rouge').length, 'point bloquant', 'points bloquants')} · ${pluriel(al.filter((x) => x.niveau === 'jaune').length, 'vigilance', 'vigilances')}</span></h2>
          ${al.length ? `<ul class="alertes">${al.slice(0, 8).map(ligneAlerte).join('')}</ul>${al.length > 8 ? `<details class="plus-tard"><summary>Voir les ${al.length - 8} autres</summary><ul class="alertes">${al.slice(8).map(ligneAlerte).join('')}</ul></details>` : ''}` : vide('Rien à signaler', 'Aucun jalon en retard, aucun paiement en souffrance, aucune non-conformité hors délai.')}
        </section>
        <section>
          <h2 class="titre-section">Avancement financier <span>cumul HT, prévu et réalisé</span></h2>
          ${graphiqueCourbe(o, t)}
        </section>
      </div>
      <h2 class="titre-section">Avancement par lot <span>travaux facturés / marché actualisé</span></h2>
      ${barresLots(o, t)}
      <h2 class="titre-section">Journal de chantier <span><button class="btn lien" data-action="sous" data-vue="planning" data-sous="journal">Tout le journal</button></span></h2>
      ${derniers.length ? `<ul class="journal">${derniers.map(ligneJournal).join('')}</ul>` : vide('Journal vide', 'Note chaque jour la météo, l\'effectif et les faits marquants.')}
      ${AVERTISSEMENT}`;
  }

  function ligneAlerte(a) {
    const action = a.vue === 'reglages-op' ? 'data-action="fiche-operation"' : `data-action="aller" data-vue="${a.vue}" data-domaine="${esc(a.domaine)}" data-id="${esc(a.id)}"`;
    return `<li class="alerte-${a.niveau}"><span class="point" aria-hidden="true"></span><button class="lien-ligne" ${action}><b>${esc(a.texte)}</b><span>${a.niveau === 'rouge' ? 'Bloquant' : 'Vigilance'} · ${esc(a.domaine)}</span></button></li>`;
  }

  // Courbe en S : cumul prévu (échéancier, tirets bleus) et réalisé (situations, trait rouge avec points).
  function graphiqueCourbe(o, t) {
    const c = R.courbe(o, t);
    if (!c.mois.length || (!c.prevu[c.prevu.length - 1] && c.dernierReel < 0)) return vide('Pas encore de courbe', 'Elle apparaît avec l\'échéancier prévisionnel des lots (Finances) et les premières situations.');
    const tel = estTel();
    const W = tel ? 340 : 460, H = tel ? 230 : 260, g = 44, d = 14, h = 22, bas = 26;
    const max = Math.max(...c.prevu, ...c.reel.filter((v) => v !== null), 1);
    const n = c.mois.length;
    const x = (i) => g + (n === 1 ? (W - g - d) / 2 : i * (W - g - d) / (n - 1));
    const y = (v) => h + (H - h - bas) * (1 - v / max);
    const pas = Math.max(1, Math.ceil(n / (tel ? 5 : 7)));
    const grilles = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${g}" x2="${W - d}" y1="${y(max * f)}" y2="${y(max * f)}" class="grille"/><text x="${g - 6}" y="${y(max * f) + 4}" text-anchor="end" class="axe">${f === 0 ? '0' : max >= 100000000 ? `${String(Math.round(max * f / 100000000 * 10) / 10).replace('.', ',')} M€` : `${Math.round(max * f / 100000)} k€`}</text>`).join('');
    const etiquettes = c.mois.map((m, i) => ((n - 1 - i) % pas === 0 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="axe">${moisCourt(m)}</text>` : '')).join('');
    const chemin = (vals) => vals.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
    const reels = c.reel.map((v, i) => (v === null ? '' : `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" class="pt-reel"/>`)).join('');
    const iAuj = c.mois.indexOf(R.moisDe(t));
    const zones = c.mois.map((m, i) => `<rect x="${x(i) - (W - g - d) / Math.max(1, n - 1) / 2}" y="${h}" width="${(W - g - d) / Math.max(1, n - 1)}" height="${H - h - bas}" fill="transparent" tabindex="0" data-info="${esc(`<b>${esc(nomMois(m))}</b>Prévu : ${eur(c.prevu[i])}${c.reel[i] !== null ? `<br>Réalisé : ${eur(c.reel[i])}<br>Écart : ${euros(c.reel[i] - c.prevu[i], { centimes: false, signe: true })}` : ''}`)}"/>`).join('');
    const der = c.dernierReel;
    // Étiquette directe du dernier réalisé, sous le point (la courbe prévue passe au-dessus quand on est en retard).
    const labelReel = der >= 0 ? `<text x="${x(der) + 6}" y="${Math.min(H - bas - 6, y(c.reel[der]) + 20)}" class="val" text-anchor="start">${eur(c.reel[der])}</text>` : '';
    return `<figure class="graphique">
      <div class="legende"><span><i class="l-prevu"></i>Prévu (échéancier)</span><span><i class="l-reel"></i>Réalisé (situations)</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="courbe" role="img" aria-label="Cumul prévu et réalisé des travaux par mois">
        ${grilles}${etiquettes}
        ${iAuj >= 0 ? `<line x1="${x(iAuj)}" x2="${x(iAuj)}" y1="${h}" y2="${H - bas}" class="auj"/>` : ''}
        <polyline points="${chemin(c.prevu)}" class="ligne-prevu"/>
        <polyline points="${chemin(c.reel)}" class="ligne-reel"/>
        ${reels}${labelReel}${zones}
      </svg>
      <div class="infobulle" hidden></div>
    </figure>
    <details class="tableau-details"><summary>Voir le tableau</summary><div class="defile"><table class="tableau petit"><caption class="sr-only">Cumul prévu et réalisé par mois</caption><thead><tr><th>Mois</th><th class="nb">Prévu</th><th class="nb">Réalisé</th><th class="nb">Écart</th></tr></thead>
      <tbody>${c.mois.map((m, i) => `<tr><td>${esc(nomMois(m))}</td><td class="nb">${eur(c.prevu[i])}</td><td class="nb">${c.reel[i] === null ? '–' : eur(c.reel[i])}</td><td class="nb">${c.reel[i] === null ? '–' : euros(c.reel[i] - c.prevu[i], { centimes: false, signe: true })}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  function barresLots(o, t) {
    const f = R.syntheseFinanciere(o, t);
    return `<figure class="graphique"><div class="barres-cats">${f.lots.map((x) => {
      const p = Math.min(100, x.avancement);
      return `<div class="barre-cat" tabindex="0" data-info="${esc(`<b>${esc(x.lot.code)} · ${esc(x.lot.nom)}</b>${eur(x.cumul)} facturés sur ${eur(x.actualise)}<br>Reste à facturer : ${eur(x.resteAFacturer)}${x.depassement ? `<br>Dépassement : ${eur(x.depassement)}` : ''}`)}">
        <span class="bc-nom"><b>${esc(x.lot.code)}</b> ${esc(x.lot.entreprise || x.lot.nom)}</span>
        <span class="bc-piste"><span class="bc-barre ${x.depassement ? 'depasse' : ''}" style="width:${x.avancement ? Math.max(0.5, p) : 0}%"></span></span>
        <span class="bc-val"><b>${pct(x.avancement, 0)}</b><small>${eur(x.cumul)}</small></span>
      </div>`;
    }).join('')}</div><div class="infobulle" hidden></div></figure>`;
  }

  function brancherInfobulles() {
    document.querySelectorAll('.graphique').forEach((fig) => {
      const bulle = fig.querySelector('.infobulle');
      if (!bulle) return;
      const montrer = (el) => {
        fig.querySelectorAll('[data-info]').forEach((z) => z.classList.toggle('survol', z === el));
        bulle.innerHTML = el.dataset.info;
        bulle.hidden = false;
        const re = el.getBoundingClientRect(), rf = fig.getBoundingClientRect();
        let x = re.left - rf.left + Math.min(re.width / 2, 220) + 12;
        if (x + bulle.offsetWidth > rf.width - 8) x = Math.max(8, rf.width - bulle.offsetWidth - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${Math.max(8, re.top - rf.top - bulle.offsetHeight - 8)}px`;
      };
      const cacher = () => { bulle.hidden = true; fig.querySelectorAll('.survol').forEach((z) => z.classList.remove('survol')); };
      fig.querySelectorAll('[data-info]').forEach((el) => {
        el.addEventListener('pointerenter', () => montrer(el));
        el.addEventListener('click', () => montrer(el));
        el.addEventListener('focus', () => montrer(el));
        el.addEventListener('blur', cacher);
      });
      fig.addEventListener('pointerleave', cacher);
    });
  }

  // ---------- Lots ----------
  function vueLots() {
    const o = op(), t = auj();
    const f = R.syntheseFinanciere(o, t);
    const titre = `<div class="vue-tete"><div><h1>Lots</h1><p>Un marché par lot : entreprise, montant initial, avenants, sous-traitants et situations.</p></div>
      <div class="actions"><button class="btn" data-action="lots-types">Lots du découpage type</button><button class="btn primaire" data-action="nouveau-lot">${ICONES.plus}Nouveau lot</button></div></div>`;
    if (!o.lots.length) return `${titre}<div class="vide-etat">${FORME_VIDE}<div><h3>Aucun lot</h3><p>Ajoute les lots de ton marché depuis le découpage type (gros œuvre, couverture, menuiseries…) ou crée-les un par un.</p></div></div>`;
    const lignes = f.lots.map((x) => {
      const l = x.lot;
      const nbNc = o.nc.filter((n) => n.lot === l.id && R.ncOuverte(n)).length;
      const stAtt = o.sousTraitants.filter((s) => s.lot === l.id && s.statut === 'demande').length;
      const tags = [
        !l.montant ? tag('jaune', 'Montant à saisir') : '',
        x.depassement ? tag('rouge', 'Au-delà du marché') : '',
        x.nbProjets ? tag('jaune', `${x.nbProjets} avenant${x.nbProjets > 1 ? 's' : ''} en projet`) : '',
        x.nbAValider ? tag('ciel', 'Situation à valider') : '',
        x.paiementsEnRetard.length ? tag('rouge', 'Paiement en retard') : '',
        stAtt ? tag('jaune', `${stAtt} sous-traitant${stAtt > 1 ? 's' : ''} en attente`) : '',
        nbNc ? tag('rose', `${nbNc} NC ouverte${nbNc > 1 ? 's' : ''}`) : '',
        x.prolongation ? tag('sable', `+${x.prolongation} j`) : '',
      ].join('');
      return `<li class="ligne-fac ${x.depassement || x.paiementsEnRetard.length ? 'alerte-depasse' : x.nbProjets || stAtt ? 'alerte-proche' : ''}">
        <button class="ligne-info" data-action="ouvrir-lot" data-id="${l.id}"><span class="ligne-detail"><b class="code-lot">${esc(l.code)}</b> ${esc(l.entreprise || 'Entreprise à saisir')}</span><b>${esc(l.nom)}</b>
          <span class="ligne-detail">${l.debut && l.fin ? `Du ${dateCourte(l.debut)} au ${dateCourte(l.fin)}` : 'Dates à saisir'} · ${eur(x.cumul)} facturés</span><span class="ligne-etiquettes">${tags}</span></button>
        <div class="ligne-droite"><span class="ligne-cout"><b>${eur(x.actualise)}</b><small>${x.avenantsSignes ? `dont ${euros(x.avenantsSignes, { centimes: false, signe: true })} d'avenants` : 'marché actualisé'}</small></span><span class="ligne-proch">${pct(x.avancement, 0)} facturé</span></div>
      </li>`;
    }).join('');
    const avs = o.avenants.filter(garderLot).sort((a, b) => (codeLot(a.lot) < codeLot(b.lot) ? -1 : codeLot(a.lot) > codeLot(b.lot) ? 1 : a.numero - b.numero));
    const sts = o.sousTraitants.filter(garderLot).map((s) => R.etatSousTraitant(s, o, t));
    return `${titre}
      <ul class="lignes-fac">${lignes}</ul>
      <p class="resume-liste">Total : marché initial ${eur(f.total.initial)} · avenants signés ${euros(f.total.avenantsSignes, { centimes: false, signe: true })} · <b>marché actualisé ${eur(f.total.actualise)}</b> · avenants en projet ${euros(f.total.avenantsProjet, { centimes: false, signe: true })}</p>
      <div class="outils-liste"><h2 class="titre-section" style="margin:24px 0 0">Avenants <span>${pluriel(avs.length, 'avenant')}</span></h2><div class="rang">${filtreLot()}<button class="btn petit" data-action="nouvel-avenant">${ICONES.plus}Avenant</button></div></div>
      ${avs.length ? `<div class="defile"><table class="tableau"><thead><tr><th>Lot</th><th>N°</th><th>Objet</th><th>Statut</th><th class="nb">Montant HT</th><th class="nb">Délai</th></tr></thead><tbody>${avs.map((a) => `<tr class="cliquable" data-action="avenant" data-id="${a.id}" tabindex="0"><td>${esc(codeLot(a.lot))}</td><td>${a.numero}</td><td>${esc(a.objet)}${a.date ? `<small class="sous-cellule">${a.statut === 'signe' ? 'Signé' : 'Daté'} le ${dateCourte(a.date)}</small>` : ''}</td><td>${tag(COUL_AVENANT[a.statut], R.STATUTS_AVENANT[a.statut])}</td><td class="nb">${euros(a.montant, { signe: true })}</td><td class="nb">${a.delai ? `${a.delai > 0 ? '+' : ''}${a.delai} j` : '–'}</td></tr>`).join('')}</tbody></table></div>` : vide('Aucun avenant', 'Les avenants signés modifient le marché actualisé et, s\'ils portent un délai, les dates du lot.')}
      <div class="outils-liste"><h2 class="titre-section" style="margin:24px 0 0">Sous-traitance <span>${pluriel(sts.length, 'déclaration')}</span></h2><div class="rang"><button class="btn petit" data-action="nouveau-st">${ICONES.plus}Sous-traitant</button></div></div>
      ${sts.length ? `<ul class="prochains">${sts.map((x) => `<li><span class="date-pastille ${x.aRelancer ? 'alerte' : ''}"><b>${esc(codeLot(x.st.lot))}</b></span><button class="lien-ligne" data-action="st" data-id="${x.st.id}"><b>${esc(x.st.entreprise)}</b><span>${esc(x.st.objet || 'Objet à préciser')} · demande du ${dateCourte(x.st.dateDemande)}${x.st.statut === 'demande' ? ` · en attente depuis ${x.attente} j` : ''}${x.st.paiementDirect ? ' · paiement direct' : ''}</span></button><span class="nb">${tag(COUL_ST[x.st.statut], R.STATUTS_ST[x.st.statut])} ${eur(x.st.montant)}</span></li>`).join('')}</ul>` : vide('Aucun sous-traitant déclaré', 'Note chaque demande d\'acceptation : montant, objet, date et réponse du maître d\'ouvrage.')}`;
  }

  // ---------- Finances ----------
  function vueFinances() {
    const o = op(), t = auj();
    const f = R.syntheseFinanciere(o, t);
    const T = f.total;
    const titre = `<div class="vue-tete"><div><h1>Finances</h1><p>Situations de travaux, échéancier prévisionnel et synthèse financière, lot par lot. Montants HT.</p></div>
      <div class="actions"><button class="btn" data-action="echeancier">Échéancier</button><button class="btn primaire" data-action="nouvelle-situation">${ICONES.plus}Situation</button></div></div>`;
    if (!o.lots.length) return `${titre}${vide('Aucun lot', 'Crée d\'abord les lots et leur marché (onglet Lots).')}`;
    const tuiles = [
      ['Marché actualisé', eur(T.actualise), `avenants en projet ${euros(T.avenantsProjet, { centimes: false, signe: true })}`, 'var(--bleu)', ''],
      ['Travaux cumulés', eur(T.cumul), `${pct(T.avancement)} · reste ${eur(T.resteAFacturer)}`, 'var(--jaune)', 'rond'],
      ['Payé (net)', eur(T.paye), `à payer ${eur(T.aPayer)} · à valider ${eur(T.aValider)}`, 'var(--encre)', ''],
      ['Retenue de garantie', eur(T.rg), `${pct(o.reglages.rg)} · révision ${euros(T.revision, { centimes: false, signe: true })}`, 'var(--rouge)', 'rond'],
    ].map(([lib, v, d, c, forme]) => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b><span>${d}</span></div>`).join('');
    const sit = o.lots.flatMap((l) => R.situationsLot(o, l.id, t)).filter((x) => garderLot(x.situation)).sort((a, b) => (a.situation.mois < b.situation.mois ? 1 : a.situation.mois > b.situation.mois ? -1 : (codeLot(a.situation.lot) < codeLot(b.situation.lot) ? -1 : 1)));
    const ligneSit = (x) => {
      const s = x.situation;
      return `<li class="${x.enRetard ? 'alerte-depasse' : s.statut === 'recue' ? 'alerte-proche' : ''}"><span class="date-pastille ${x.enRetard ? 'retard' : s.statut === 'recue' ? 'alerte' : ''}"><b>${esc(codeLot(s.lot))}</b>n° ${s.numero}</span>
        <button class="lien-ligne" data-action="situation" data-id="${s.id}"><b>${esc(nomMois(s.mois))} · cumul ${eur(s.cumul)}</b><span>Travaux du mois ${euros(x.travaux, { centimes: false, signe: x.travaux < 0 })}${x.revision ? ` · révision ${euros(x.revision, { centimes: false, signe: true })} (K = ${String(s.k).replace('.', ',')})` : ''} · retenue ${eur(x.rg)}${s.penalites ? ` · pénalités ${eur(s.penalites)}` : ''}${x.echeance && s.statut !== 'payee' ? ` · paiement attendu le ${dateCourte(x.echeance)}` : ''}${x.enRetard ? ` (${x.retardPaiement} j de retard)` : ''}</span></button>
        <span class="nb">${tag(COUL_SITUATION[s.statut], R.STATUTS_SITUATION[s.statut])} ${euros(x.net)}</span></li>`;
    };
    return `${titre}
      <div class="tuiles">${tuiles}</div>
      ${T.paiementsEnRetard.length ? `<p class="aide alerte-taux">${pluriel(T.paiementsEnRetard.length, 'situation')} au-delà du délai de paiement de ${o.reglages.delaiPaiement} jours : ${T.paiementsEnRetard.map((p) => `${esc(codeLot(p.situation.lot))} n° ${p.situation.numero}`).join(', ')}.</p>` : ''}
      <div class="colonnes-apercu">
        <section><h2 class="titre-section">Courbe d'avancement <span>cumul HT prévu et réalisé</span></h2>${graphiqueCourbe(o, t)}</section>
        <section><h2 class="titre-section">Par lot <span>travaux facturés</span></h2>${barresLots(o, t)}</section>
      </div>
      <h2 class="titre-section">Synthèse financière <span><button class="btn lien" data-action="csv-synthese">Exporter (CSV)</button></span></h2>
      <div class="defile"><table class="tableau synthese"><caption class="sr-only">Synthèse financière par lot, montants HT</caption>
        <thead><tr><th>Lot</th><th class="nb">Initial</th><th class="nb">Avenants</th><th class="nb">Actualisé</th><th class="nb">Cumulé</th><th class="nb">%</th><th class="nb">Retenue</th><th class="nb">Payé net</th><th class="nb">À payer</th><th class="nb">Reste à facturer</th></tr></thead>
        <tbody>${f.lots.map((x) => `<tr class="cliquable" data-action="ouvrir-lot" data-id="${x.lot.id}" tabindex="0"><td><b>${esc(x.lot.code)}</b> <small class="sous-cellule">${esc(x.lot.entreprise || x.lot.nom)}</small></td><td class="nb">${eur(x.initial)}</td><td class="nb">${x.avenantsSignes ? euros(x.avenantsSignes, { centimes: false, signe: true }) : '–'}</td><td class="nb">${eur(x.actualise)}</td><td class="nb ${x.depassement ? 'neg' : ''}">${eur(x.cumul)}</td><td class="nb">${pct(x.avancement, 0)}</td><td class="nb">${eur(x.rg)}</td><td class="nb">${eur(x.paye)}</td><td class="nb">${eur(x.aPayer + x.aValider)}</td><td class="nb">${eur(x.resteAFacturer)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="nb">${eur(T.initial)}</td><td class="nb">${euros(T.avenantsSignes, { centimes: false, signe: true })}</td><td class="nb">${eur(T.actualise)}</td><td class="nb">${eur(T.cumul)}</td><td class="nb">${pct(T.avancement, 0)}</td><td class="nb">${eur(T.rg)}</td><td class="nb">${eur(T.paye)}</td><td class="nb">${eur(T.aPayer + T.aValider)}</td><td class="nb">${eur(T.resteAFacturer)}</td></tr></tfoot></table></div>
      ${T.penalitesEncourues ? `<p class="aide" style="margin-top:12px">Pénalités de retard encourues d'après les jalons (estimation, plafonds compris) : <b>${eur(T.penalitesEncourues)}</b>. Elles ne sont déduites que si tu les saisis dans une situation.</p>` : ''}
      <div class="outils-liste"><h2 class="titre-section" style="margin:28px 0 0">Situations de travaux <span>${pluriel(sit.length, 'situation')}</span></h2><div class="rang">${filtreLot()}<button class="btn petit" data-action="csv-situations">Exporter (CSV)</button></div></div>
      ${sit.length ? `<ul class="journal journal-sit">${sit.slice(0, 60).map(ligneSit).join('')}</ul>${sit.length > 60 ? `<p class="aide">Les ${sit.length - 60} plus anciennes sont dans l'export CSV.</p>` : ''}` : vide('Aucune situation', 'Chaque mois, saisis le montant cumulé des travaux exécutés : le mois, la révision, la retenue et le net se calculent.')}
      ${AVERTISSEMENT}`;
  }

  // ---------- Planning ----------
  const SEG_PLANNING = [['jalons', 'Jalons'], ['journal', 'Journal'], ['intemperies', 'Intempéries']];
  const segment = (liste, cle) => `<div class="segment" role="group" aria-label="Rubrique">${liste.map(([id, nom]) => `<button class="filtre" data-action="sous" data-vue="${vue}" data-sous="${id}" aria-pressed="${sous[cle] === id}">${nom}</button>`).join('')}</div>`;

  function vuePlanning() {
    const o = op(), t = auj();
    const s = sous.planning;
    const actions = { jalons: `<button class="btn" data-action="jalons-types">Jalons types</button><button class="btn primaire" data-action="nouveau-jalon">${ICONES.plus}Jalon</button>`, journal: `<button class="btn primaire" data-action="nouvelle-entree">${ICONES.plus}Entrée du jour</button>`, intemperies: `<button class="btn primaire" data-action="nouvelle-entree" data-intemperie="1">${ICONES.plus}Intempérie</button>` }[s];
    const titre = `<div class="vue-tete"><div><h1>Planning</h1><p>Jalons contractuels recalés par les avenants et les intempéries retenues, journal de chantier.</p></div><div class="actions">${actions}</div></div>`;
    return `${titre}${segment(SEG_PLANNING, 'planning')}${{ jalons: sousJalons, journal: sousJournal, intemperies: sousIntemperies }[s](o, t)}`;
  }

  function sousJalons(o, t) {
    const l = R.jalonsTries(o, t).filter((x) => garderLot(x.jalon));
    const prol = R.prolongationOperation(o);
    if (!o.jalons.length) return vide('Aucun jalon', 'Ajoute les jalons contractuels (démarrage, achèvement des lots, réception, levée des réserves) et tes jalons internes.', '<button class="btn primaire" data-action="jalons-types">Partir des jalons types</button>');
    return `<div class="outils-liste" style="margin-top:16px"><p class="resume-liste" style="margin:0">Prolongation la plus longue : ${prol.total ? `<b>+${prol.total} j</b> (${esc(nomLot(prol.lot))})` : 'aucune'}</p>${filtreLot()}</div>
      <ul class="prochains jalons">${l.map((x) => {
        const j = x.jalon;
        const info = j.dateReelle ? `Atteint le ${dateLongue(j.dateReelle)}${x.retard ? `, ${x.retard} j après la date recalée` : ''}` : x.etat === 'retard' ? `${x.retard} j de retard` : `dans ${x.joursRestants} j`;
        return `<li class="${x.etat === 'retard' ? 'alerte-depasse' : x.etat === 'proche' ? 'alerte-proche' : ''}"><span class="date-pastille ${x.etat === 'retard' || x.etat === 'atteintRetard' ? 'retard' : x.etat === 'proche' ? 'alerte' : x.etat === 'atteint' ? 'fait' : ''}"><b>${versDate(x.dateRecalee).getDate()}</b>${esc(fmt(x.dateRecalee, { month: 'short' }).replace('.', ''))}</span>
          <button class="lien-ligne" data-action="jalon" data-id="${j.id}"><b>${esc(j.nom)}</b><span>${esc(nomLot(j.lot))} · ${j.type === 'contractuel' ? 'contractuel' : 'interne'} · prévu le ${dateCourte(j.date)}${x.prolongation ? `, recalé +${x.prolongation} j` : ''} · ${info}${x.penalites ? ` · pénalités estimées ${eur(x.penalites)}` : ''}</span></button>
          <span class="nb">${tag(COUL_JALON[x.etat], R.ETATS_JALON[x.etat])}</span></li>`;
      }).join('')}</ul>
      <p class="aide" style="margin-top:14px">Date recalée = date contractuelle + délais des avenants signés du lot + intempéries retenues (celles du lot, et celles de toute l'opération tombées pendant la période du lot), datés au plus tard à la date du jalon. Pour un jalon d'opération, la plus longue prolongation des lots. Tu peux désactiver le recalage d'un jalon dans sa fiche.</p>`;
  }

  const ligneJournal = (e) => `<li><span class="date-pastille ${e.intemperie ? (e.intemperie.retenue ? 'retard' : 'alerte') : ''}"><b>${versDate(e.date).getDate()}</b>${esc(fmt(e.date, { month: 'short' }).replace('.', ''))}</span>
    <button class="lien-ligne" data-action="entree" data-id="${e.id}"><b>${esc(e.faits || 'Sans fait marquant')}</b><span>${esc(e.meteo || 'Météo non notée')}${e.effectif ? ` · ${e.effectif} personnes sur site` : ''}${e.intemperie ? ` · intempérie ${esc(e.intemperie.nature.toLowerCase())} ${String(e.intemperie.jours).replace('.', ',')} j${e.intemperie.retenue ? ', retenue' : ', non retenue'}` : ''}</span></button>
    <span class="nb">${e.intemperie ? tag(e.intemperie.retenue ? 'rose' : 'sable', e.intemperie.retenue ? 'Retenue' : 'Constatée') : ''}</span></li>`;

  function sousJournal(o) {
    const l = [...o.journal].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!l.length) return vide('Journal vide', 'Une entrée par jour : météo, effectif sur site, faits marquants, et l\'intempérie s\'il y en a une.');
    return `<p class="resume-liste">${pluriel(l.length, 'entrée')} · ${pluriel(Math.round(l.slice(0, 20).reduce((s, e) => s + e.effectif, 0) / Math.min(20, l.length)), 'personne')} sur site en moyenne sur les 20 dernières</p><ul class="journal">${l.slice(0, 120).map(ligneJournal).join('')}</ul>`;
  }

  function sousIntemperies(o) {
    const b = R.bilanIntemperies(o);
    const tuiles = [
      ['Jours constatés', String(b.constates).replace('.', ','), `${pluriel(b.liste.length, 'journée')} notée${b.liste.length > 1 ? 's' : ''}`, 'var(--bleu)', ''],
      ['Jours retenus', String(b.retenus).replace('.', ','), 'prolongent les dates', 'var(--rouge)', 'rond'],
      ['Nature principale', Object.keys(b.parNature).length ? Object.entries(b.parNature).sort((x, y) => y[1] - x[1])[0][0] : '–', Object.entries(b.parNature).map(([n, j]) => `${n} ${String(j).replace('.', ',')} j`).join(' · ') || 'aucune', 'var(--jaune)', ''],
    ].map(([lib, v, d, c, forme]) => `<div class="tuile ${forme}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${esc(v)}</b><span>${esc(d)}</span></div>`).join('');
    return `<div class="tuiles tuiles-3" style="margin-top:16px">${tuiles}</div>
      <h2 class="titre-section">Prolongation par lot <span>avenants signés + intempéries retenues</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Lot</th><th class="nb">Avenants</th><th class="nb">Intempéries</th><th class="nb">Total</th></tr></thead><tbody>${o.lots.map((l) => { const p = R.prolongationLot(o, l.id); return `<tr><td><b>${esc(l.code)}</b> ${esc(l.nom)}</td><td class="nb">${p.avenants ? `${p.avenants > 0 ? '+' : ''}${p.avenants} j` : '–'}</td><td class="nb">${p.intemperies ? `+${String(p.intemperies).replace('.', ',')} j` : '–'}</td><td class="nb"><b>${p.total ? `${p.total > 0 ? '+' : ''}${p.total} j` : '–'}</b></td></tr>`; }).join('')}</tbody></table></div>
      <h2 class="titre-section">Journées d'intempérie</h2>
      ${b.liste.length ? `<ul class="journal">${b.liste.map((i) => ligneJournal(o.journal.find((e) => e.id === i.id))).join('')}</ul>` : vide('Aucune intempérie', 'Note-les depuis le journal : nature, durée, lot concerné, et si elle est retenue pour prolonger les délais.')}
      <p class="aide" style="margin-top:14px">Ce qui ouvre droit à prolongation dépend de ton marché. Seules les journées « retenues » décalent les dates ; les demi-journées s'additionnent, le total est arrondi au jour supérieur.</p>`;
  }

  // ---------- Registres ----------
  const SEG_REGISTRES = [['nc', 'Non-conformités'], ['risques', 'Risques'], ['courriers', 'Courriers et OS'], ['intervenants', 'Intervenants']];
  function vueRegistres() {
    const o = op(), t = auj();
    const s = sous.registres;
    const actions = { nc: `<button class="btn primaire" data-action="nouvelle-nc">${ICONES.plus}Non-conformité</button>`, risques: `<button class="btn primaire" data-action="nouveau-risque">${ICONES.plus}Risque</button>`, courriers: `<button class="btn" data-action="nouveau-courrier" data-type="courrier">Courrier</button><button class="btn primaire" data-action="nouveau-courrier" data-type="os">${ICONES.plus}Ordre de service</button>`, intervenants: `<button class="btn primaire" data-action="nouvel-intervenant">${ICONES.plus}Intervenant</button>` }[s];
    const titre = `<div class="vue-tete"><div><h1>Registres</h1><p>Non-conformités, risques, courriers et ordres de service, intervenants de l'opération.</p></div><div class="actions">${actions}</div></div>`;
    return `${titre}${segment(SEG_REGISTRES, 'registres')}${{ nc: sousNC, risques: sousRisques, courriers: sousCourriers, intervenants: sousIntervenants }[s](o, t)}`;
  }

  const FILTRES_NC = [['ouvertes', 'Ouvertes'], ['retard', 'En retard'], ['levee', 'À vérifier'], ['close', 'Closes'], ['toutes', 'Toutes']];
  function sousNC(o, t) {
    const b = R.bilanNC(o, t);
    const garder = (x) => ({ ouvertes: x.ouverte, retard: x.enRetard, levee: x.nc.statut === 'levee', close: x.nc.statut === 'close', toutes: true }[filtre.nc]);
    const l = b.liste.filter(garder).filter((x) => garderLot(x.nc)).sort((x, y) => (y.retard - x.retard) || (x.nc.date < y.nc.date ? 1 : -1));
    const compte = { ouvertes: b.ouvertes, retard: b.enRetard, levee: b.aVerifier, close: b.closes, toutes: b.total };
    return `<div class="outils-liste" style="margin-top:16px"><div class="filtres">${FILTRES_NC.map(([id, nom]) => `<button class="filtre" data-action="filtre-nc" data-f="${id}" aria-pressed="${filtre.nc === id}">${nom} <small>${compte[id]}</small></button>`).join('')}</div>${filtreLot()}</div>
      <p class="resume-liste">Ouvertes par gravité : ${Object.entries(R.GRAVITES).map(([g, n]) => `${n.toLowerCase()} ${b.parGravite[g]}`).join(' · ')}</p>
      ${l.length ? `<ul class="lignes-fac">${l.map((x) => {
        const n = x.nc;
        return `<li class="ligne-fac ${x.enRetard ? 'alerte-depasse' : n.gravite === 'critique' && x.ouverte ? 'alerte-depasse' : ''}"><button class="ligne-info" data-action="nc" data-id="${n.id}"><span class="ligne-detail"><b class="code-lot">${esc(codeLot(n.lot))}</b> ${esc(n.type || 'Type à préciser')} · constatée le ${dateCourte(n.date)}</span><b>${esc(n.titre)}</b><span class="ligne-detail">${esc(n.action || 'Action à définir')}</span><span class="ligne-etiquettes">${tag(COUL_GRAVITE[n.gravite], R.GRAVITES[n.gravite])}${tag(COUL_NC[n.statut], R.STATUTS_NC[n.statut])}</span></button>
          <div class="ligne-droite"><span class="ligne-cout"><b>${n.statut === 'close' ? dateCourte(n.dateCloture || n.echeance) : n.echeance ? dateCourte(n.echeance) : '–'}</b><small>${n.statut === 'close' ? 'close' : 'échéance'}</small></span><span class="ligne-proch">${x.enRetard ? `${x.retard} j de retard` : `${x.age} j`}</span></div></li>`;
      }).join('')}</ul>` : vide('Rien dans ce filtre', 'Une non-conformité : un constat, un lot, une gravité, une action et une échéance.')}
      <p class="aide" style="margin-top:14px">Registre simplifié pour le pilotage du lot. Pour l'analyse des causes, les actions correctives et leur vérification d'efficacité, le Registre des non-conformités QME va plus loin ; pour les réserves de réception, la Levée de réserves QME.</p>`;
  }

  function sousRisques(o, t) {
    const b = R.bilanRisques(o, t);
    const cellules = b.matrice.map((c) => `<div class="cellule niv-${c.niveau}" title="Probabilité ${c.p}, impact ${c.i} : ${R.NIVEAUX[c.niveau].toLowerCase()}">${c.n || ''}</div>`).join('');
    return `<div class="risques-tete">
        <figure class="matrice-fig"><div class="matrice-axe-y">Probabilité</div><div class="matrice">${cellules}</div><div class="matrice-axe-x">Impact</div><figcaption class="sr-only">Matrice des risques ouverts, probabilité de 4 à 1 en lignes, impact de 1 à 4 en colonnes</figcaption></figure>
        <div class="legende-niveaux">${Object.entries(R.NIVEAUX).map(([k, n]) => `<span>${tag(COUL_NIVEAU[k], n)} ${b.parNiveau[k]}</span>`).join('')}<p class="aide">Criticité = probabilité × impact (1 à 4 chacun). Exposition pondérée des risques chiffrés : <b>${eur(b.exposition)}</b>. ${b.clos} clos.</p></div>
      </div>
      ${b.ouverts.length ? `<ul class="lignes-fac" style="margin-top:16px">${b.ouverts.map((x) => {
        const r = x.risque;
        return `<li class="ligne-fac ${x.niveau === 'critique' ? 'alerte-depasse' : x.niveau === 'eleve' ? 'alerte-proche' : ''}"><button class="ligne-info" data-action="risque" data-id="${r.id}"><span class="ligne-detail"><b class="code-lot">${esc(codeLot(r.lot))}</b> ${esc(r.categorie || 'Catégorie à préciser')}</span><b>${esc(r.titre)}</b><span class="ligne-detail">${esc(R.REPONSES_RISQUE[r.reponse])} : ${esc(r.action || 'action à définir')}${r.porteur ? ` · ${esc(r.porteur)}` : ''}</span><span class="ligne-etiquettes">${tag(COUL_NIVEAU[x.niveau], `${R.NIVEAUX[x.niveau]} ${x.criticite}/16`)}${x.actionEnRetard ? tag('rose', 'Action en retard') : ''}</span></button>
          <div class="ligne-droite"><span class="ligne-cout"><b>${r.montant ? eur(r.montant) : '–'}</b><small>impact estimé</small></span><span class="ligne-proch">${r.echeance ? `action le ${dateCourte(r.echeance)}` : ''}</span></div></li>`;
      }).join('')}</ul>` : vide('Aucun risque ouvert', 'Recense ce qui peut dériver : délais, technique, interfaces, finances, concessionnaires, coactivité.')}`;
  }

  function sousCourriers(o, t) {
    const l = R.courriersTries(o, t).filter((x) => garderLot(x.courrier));
    const att = l.filter((x) => x.attente);
    return `<div class="outils-liste" style="margin-top:16px"><p class="resume-liste" style="margin:0">${pluriel(l.filter((x) => x.courrier.type === 'os').length, 'ordre de service', 'ordres de service')} · ${pluriel(att.length, 'réponse attendue', 'réponses attendues')}${att.filter((x) => x.enRetard).length ? `, dont ${att.filter((x) => x.enRetard).length} en retard` : ''}</p>${filtreLot()}</div>
      ${l.length ? `<ul class="prochains courriers">${l.map((x) => {
        const c = x.courrier;
        return `<li class="${x.enRetard ? 'alerte-depasse' : x.proche ? 'alerte-proche' : ''}"><span class="date-pastille ${x.enRetard ? 'retard' : x.proche ? 'alerte' : ''}"><b>${versDate(c.date).getDate()}</b>${esc(fmt(c.date, { month: 'short' }).replace('.', ''))}</span>
          <button class="lien-ligne" data-action="courrier" data-id="${c.id}"><b>${esc(R.libCourrier(c))} · ${esc(c.objet)}</b><span>${c.sens === 'emis' ? 'Émis' : 'Reçu'} · ${esc(nomLot(c.lot))}${c.incidenceDelai ? ` · ${c.incidenceDelai > 0 ? '+' : ''}${c.incidenceDelai} j` : ''}${c.incidenceMontant ? ` · ${euros(c.incidenceMontant, { centimes: false, signe: true })}` : ''}${x.attente ? ` · réponse attendue le ${dateCourte(c.reponseAttendue)}${x.enRetard ? ` (${x.retard} j de retard)` : ''}` : c.dateReponse ? ` · répondu le ${dateCourte(c.dateReponse)}` : ''}</span></button>
          <span class="nb">${tag(c.type === 'os' ? 'ciel' : c.type === 'miseEnDemeure' ? 'rose' : 'sable', c.type === 'os' ? 'OS' : R.TYPES_COURRIER[c.type])}</span></li>`;
      }).join('')}</ul>` : vide('Aucun courrier', 'Note chaque ordre de service, courrier, mise en demeure ou procès-verbal, avec la réponse attendue.')}
      <p class="aide" style="margin-top:14px">L'incidence en délai ou en montant d'un OS est notée pour mémoire : elle ne modifie le marché et les dates qu'une fois l'avenant correspondant signé.</p>`;
  }

  function sousIntervenants(o) {
    return `${o.intervenants.length ? `<ul class="prochains" style="margin-top:16px">${o.intervenants.map((p) => `<li><span class="date-pastille"><b>${esc((p.role || '?').slice(0, 1))}</b></span><button class="lien-ligne" data-action="intervenant" data-id="${p.id}"><b>${esc(p.nom || p.societe)}</b><span>${esc([p.role, p.nom ? p.societe : ''].filter(Boolean).join(' · '))}</span></button><span class="nb petit-texte">${esc([p.email, p.telephone].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : vide('Aucun intervenant', 'Maître d\'ouvrage, maîtrise d\'œuvre, entreprises, contrôleur technique, coordonnateur SPS…')}
      <p class="aide" style="margin-top:14px">Données personnelles : ne note que des coordonnées professionnelles utiles au chantier (fonction plutôt que nom quand c'est possible), et supprime-les à la fin de l'opération. Rien n'est envoyé à ces personnes.</p>`;
  }

  // ---------- Revue de projet ----------
  function vueRevue() {
    const o = op(), t = auj();
    const f = R.syntheseFinanciere(o, t).total;
    const jal = R.jalonsTries(o, t);
    const nc = R.bilanNC(o, t), rq = R.bilanRisques(o, t), int = R.bilanIntemperies(o);
    const att = R.courriersTries(o, t).filter((x) => x.attente);
    const arb = R.alertes(o, t).filter((x) => x.niveau === 'rouge');
    const ep = R.ecartPrevisionnel(o, t);
    const q = Object.fromEntries(B.revue);
    const sect = (titre, corps) => `<section class="revue-section"><h2>${titre}</h2><p class="revue-question">${esc(q[titre] || '')}</p>${corps}</section>`;
    return `<div class="vue-tete"><div><p class="surtitre">Revue de projet · ${dateLongue(t)}</p><h1>${esc(o.nom)}</h1><p>${esc([o.maitreOuvrage, o.maitreOeuvre].filter(Boolean).join(' · '))}</p></div>
      <div class="actions"><button class="btn" data-action="vue" data-vue="tableau">Retour</button><button class="btn" data-action="copier-revue">Copier le texte</button><button class="btn primaire" data-action="imprimer">Imprimer</button></div></div>
      <div class="revue">
      ${sect('Délais', `<div class="defile"><table class="tableau petit"><thead><tr><th>Jalon</th><th>Lot</th><th class="nb">Contractuel</th><th class="nb">Recalé</th><th>État</th></tr></thead><tbody>${jal.map((x) => `<tr><td>${esc(x.jalon.nom)}</td><td>${esc(codeLot(x.jalon.lot))}</td><td class="nb">${dateCourte(x.jalon.date)}</td><td class="nb">${dateCourte(x.dateRecalee)}${x.prolongation ? ` <small>+${x.prolongation} j</small>` : ''}</td><td>${tag(COUL_JALON[x.etat], R.ETATS_JALON[x.etat])}${x.retard ? ` <small>${x.retard} j</small>` : ''}</td></tr>`).join('')}</tbody></table></div><p class="revue-note">Intempéries : ${String(int.constates).replace('.', ',')} j constatés, ${String(int.retenus).replace('.', ',')} j retenus.</p>`)}
      ${sect('Finances', `<div class="resume-facture">${[
        ['Marché actualisé', eur(f.actualise), `initial ${eur(f.initial)}, avenants ${euros(f.avenantsSignes, { centimes: false, signe: true })}`],
        ['Avenants en projet', euros(f.avenantsProjet, { centimes: false, signe: true }), 'à arbitrer'],
        ['Travaux cumulés', eur(f.cumul), `${pct(f.avancement)}${ep ? ` · ${euros(ep.ecart, { centimes: false, signe: true })} vs prévu` : ''}`],
        ['Payé net', eur(f.paye), `à payer ${eur(f.aPayer)} · à valider ${eur(f.aValider)}`],
        ['Retenue de garantie', eur(f.rg), `taux ${pct(o.reglages.rg)}`],
        ['Pénalités encourues', eur(f.penalitesEncourues), 'estimation'],
      ].map(([a, b2, c]) => `<div><span>${a}</span><b>${b2}</b><small>${c}</small></div>`).join('')}</div>`)}
      ${sect('Qualité', `<p class="revue-note">${nc.ouvertes} ouvertes (${Object.entries(R.GRAVITES).map(([g, n]) => `${n.toLowerCase()} ${nc.parGravite[g]}`).join(', ')}) · ${nc.enRetard} en retard · ${nc.aVerifier} à vérifier · ${nc.closes} closes.</p><ul class="revue-liste">${nc.liste.filter((x) => x.ouverte || x.nc.statut === 'levee').map((x) => `<li>${tag(COUL_GRAVITE[x.nc.gravite], R.GRAVITES[x.nc.gravite])} <b>${esc(codeLot(x.nc.lot))}</b> ${esc(x.nc.titre)}${x.nc.echeance ? ` · échéance ${dateCourte(x.nc.echeance)}` : ''}${x.enRetard ? ` · <b class="neg">${x.retard} j de retard</b>` : ''}</li>`).join('') || '<li>Aucune non-conformité ouverte.</li>'}</ul>`)}
      ${sect('Risques', `<ul class="revue-liste">${rq.ouverts.slice(0, 8).map((x) => `<li>${tag(COUL_NIVEAU[x.niveau], `${x.criticite}/16`)} ${esc(x.risque.titre)}${x.risque.action ? ` · ${esc(x.risque.action)}` : ''}${x.risque.porteur ? ` <small>(${esc(x.risque.porteur)})</small>` : ''}</li>`).join('') || '<li>Aucun risque ouvert.</li>'}</ul>`)}
      ${sect('Courriers et OS', `<ul class="revue-liste">${att.map((x) => `<li><b>${esc(R.libCourrier(x.courrier))}</b> du ${dateCourte(x.courrier.date)} · ${esc(x.courrier.objet)} · réponse attendue le ${dateCourte(x.courrier.reponseAttendue)}${x.enRetard ? ` · <b class="neg">${x.retard} j de retard</b>` : ''}</li>`).join('') || '<li>Aucune réponse attendue.</li>'}</ul>`)}
      ${sect('Points à arbitrer', `<ul class="revue-liste">${arb.map((x) => `<li><b>${esc(x.domaine)}</b> · ${esc(x.texte)}</li>`).join('') || '<li>Aucun point bloquant.</li>'}</ul><div class="revue-libre" aria-hidden="true"><span>Décisions</span><span>Actions et porteurs</span></div>`)}
      </div>
      <p class="mention avertissement">Revue générée à partir de la saisie du ${dateLongue(t)}. Montants HT ; pénalités estimées, non appliquées.</p>`;
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
      if (d.dataset.garder) { delete d.dataset.garder; return; }
      d.close();
    });
    if (!d.open) d.showModal();
    if (!estTel()) d.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea')?.focus();
  }
  const PIED = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const listeDonnees = (id, valeurs) => `<datalist id="${id}">${[...new Set(valeurs.filter(Boolean))].map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`;
  const radios = (nom, liste, valeur, classe = '') => `<div class="choix-statut ${classe}">${Object.entries(liste).map(([k, l]) => `<label><input type="radio" name="${nom}" value="${k}" ${valeur === k ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  const champDate = (nom, lib, v, aide = '') => `<label class="champ">${lib}${aide ? ` <small>${aide}</small>` : ''}<input type="date" name="${nom}" value="${esc(v || '')}"></label>`;
  const lireDate = (fd, nom) => { const v = String(fd.get(nom) || ''); return R.estDate(v) ? v : ''; };
  // Enregistre un élément d'une liste de l'opération (création ou modification), avec « Annuler ».
  function enregistrer(liste, objet, message) {
    retenir();
    const o = op();
    const brut = { ...o, [liste]: [...o[liste].filter((x) => x.id !== objet.id), objet] };
    const norm = R.normaliserOperation(brut, DEFAUTS);
    E.operations = E.operations.map((x) => (x.id === o.id ? norm : x));
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }
  function supprimer(liste, id, message) {
    retenir();
    const o = op();
    o[liste] = o[liste].filter((x) => x.id !== id);
    sauver(); rendre();
    toast(message, { libelle: 'Annuler', faire: annuler });
  }

  // Fiche de l'opération : identité, réglages, pièces du marché.
  function modaleOperation() {
    const o = op(), r = o.reglages;
    const corps = `
      <label class="champ">Nom de l'opération<input name="nom" maxlength="120" value="${esc(o.nom)}" required></label>
      <div class="rang-champs"><label class="champ">Référence<input name="reference" maxlength="60" value="${esc(o.reference)}"></label><label class="champ">Lieu<input name="lieu" maxlength="120" value="${esc(o.lieu)}"></label></div>
      <div class="rang-champs"><label class="champ">Maître d'ouvrage<input name="maitreOuvrage" maxlength="120" value="${esc(o.maitreOuvrage)}"></label><label class="champ">Maître d'œuvre<input name="maitreOeuvre" maxlength="120" value="${esc(o.maitreOeuvre)}"></label></div>
      <div class="rang-champs">${champDate('dateOS', 'OS de démarrage', o.dateOS)}${champDate('dateFin', 'Fin contractuelle', o.dateFin)}</div>
      <fieldset class="champ cadre-champs"><legend>Règles du marché <small>Valeurs de départ, à remplacer par celles de ton CCAP.</small></legend>
        <div class="rang-champs">
          <label class="champ">Retenue de garantie (%)<input name="rg" inputmode="decimal" value="${String(r.rg).replace('.', ',')}"></label>
          <label class="champ">Délai de paiement (jours)<input name="delaiPaiement" type="number" min="0" max="365" value="${r.delaiPaiement}"></label>
          <label class="champ">Alerte avant échéance (jours)<input name="alerteJours" type="number" min="0" max="120" value="${r.alerteJours}"></label>
          <label class="champ">Relancer une sous-traitance après (jours)<input name="relanceSousTraitance" type="number" min="1" max="365" value="${r.relanceSousTraitance}"></label>
        </div>
        <div class="rang-champs">${Object.entries(R.GRAVITES).map(([g, n]) => `<label class="champ">Délai NC ${n.toLowerCase()} (j)<input name="nc-${g}" type="number" min="1" max="365" value="${r.delaisNC[g]}"></label>`).join('')}</div>
      </fieldset>
      <fieldset class="champ cadre-champs"><legend>Pièces du marché <small>Coche celles que tu as réunies ; une ligne par pièce pour en ajouter.</small></legend>
        <div class="liste-pieces">${o.pieces.map((p) => `<label class="case"><input type="checkbox" name="piece" value="${p.id}" ${p.present ? 'checked' : ''}><span>${esc(p.nom)}${p.version ? ` <small>${esc(p.version)}</small>` : ''}</span></label>`).join('')}</div>
        <label class="champ">Ajouter des pièces<textarea name="nouvellesPieces" rows="2" placeholder="Une pièce par ligne"></textarea></label>
      </fieldset>
      <label class="champ">Notes<textarea name="notes" rows="3" maxlength="2000">${esc(o.notes)}</textarea></label>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Supprimer l'opération</h3><p class="aide">Efface l'opération et tout son suivi${E.operations.length === 1 ? ' ; tu repars sur une opération vierge' : ''}. « Annuler » reste possible quelques secondes.</p><div class="rang"><button class="btn petit danger" type="submit" value="supprimer-op">Supprimer l'opération</button></div></div>`;
    ouvrirModale('Fiche de l\'opération', corps, PIED(false), (fd, choix) => {
      if (choix === 'supprimer-op') {
        if (!confirm(`Supprimer « ${o.nom} » et tout son suivi ?`)) return '';
        retenir();
        E.operations = E.operations.filter((x) => x.id !== o.id);
        if (!E.operations.length) { modale().close(); sauver(); accueil = accueilVide(); ecranAccueil(); return; }
        E.actif = E.operations[0].id; sauver(); rendre();
        toast('Opération supprimée.', { libelle: 'Annuler', faire: () => { annuler(); demarrer(); } });
        return;
      }
      const rg = Number(String(fd.get('rg')).replace(',', '.'));
      const n = (k, min, max) => { const v = Math.round(Number(fd.get(k))); return v >= min && v <= max ? v : null; };
      const delai = n('delaiPaiement', 0, 365), alerte = n('alerteJours', 0, 120), relance = n('relanceSousTraitance', 1, 365);
      const dnc = Object.fromEntries(Object.keys(R.GRAVITES).map((g) => [g, n(`nc-${g}`, 1, 365)]));
      if (!String(fd.get('nom')).trim()) return 'Donne un nom à l\'opération.';
      if (!(rg >= 0 && rg <= 100) || delai === null || alerte === null || relance === null || Object.values(dnc).includes(null)) return 'Vérifie les règles du marché (pourcentage et nombres de jours).';
      const coches = new Set(fd.getAll('piece'));
      const nouvelles = String(fd.get('nouvellesPieces') || '').split('\n').map((x) => x.trim()).filter(Boolean).map((nom) => ({ nom, present: false }));
      retenir();
      Object.assign(o, { nom: String(fd.get('nom')).trim(), reference: String(fd.get('reference')).trim(), lieu: String(fd.get('lieu')).trim(), maitreOuvrage: String(fd.get('maitreOuvrage')).trim(), maitreOeuvre: String(fd.get('maitreOeuvre')).trim(), dateOS: lireDate(fd, 'dateOS'), dateFin: lireDate(fd, 'dateFin'), notes: String(fd.get('notes') || '') });
      o.reglages = { ...o.reglages, rg, delaiPaiement: delai, alerteJours: alerte, relanceSousTraitance: relance, delaisNC: dnc };
      o.pieces = [...o.pieces.map((p) => ({ ...p, present: coches.has(p.id) })), ...nouvelles.map((p) => ({ id: uid(), ...p, version: '' }))];
      sauver(); rendre();
      toast('Fiche de l\'opération enregistrée.', { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleOperations() {
    const corps = `<ul class="mini-liste">${E.operations.map((o) => `<li><button class="btn lien" type="button" data-action="choisir-op" data-id="${o.id}">${esc(o.nom)}</button><small>${pluriel(o.lots.length, 'lot')}${o.id === E.actif ? ' · ouverte' : ''}</small></li>`).join('')}</ul>
      <p class="aide">Chaque opération a ses lots, son marché, ses registres et ses réglages. Toutes restent synchronisées avec ta clé.</p>`;
    ouvrirModale('Opérations', corps, '<button class="btn primaire" value="nouvelle">Nouvelle opération</button><button class="btn" value="annuler">Fermer</button>', (_, choix) => {
      if (choix === 'nouvelle') { accueil = accueilVide(); ecranAccueil(); }
    });
  }

  // Lot : création et modification
  function modaleLot(id) {
    const l = id ? lot(id) : { code: '', nom: '', entreprise: '', montant: 0, debut: '', fin: '', plafond: 0 };
    if (!l) return;
    const corps = `
      <div class="rang-champs"><label class="champ" style="flex:0 1 110px">Code<input name="code" maxlength="12" value="${esc(l.code)}" required autocapitalize="characters" list="codes-lots"></label><label class="champ">Intitulé<input name="nom" maxlength="120" value="${esc(l.nom)}" required list="noms-lots"></label></div>
      ${listeDonnees('codes-lots', B.lots.map((x) => x.code))}${listeDonnees('noms-lots', B.lots.map((x) => x.nom))}
      <label class="champ">Entreprise titulaire<input name="entreprise" maxlength="120" value="${esc(l.entreprise)}" autocomplete="organization"></label>
      <label class="champ">Montant initial du marché (HT)<input name="montant" inputmode="decimal" value="${R.saisieMontant(l.montant)}" placeholder="0,00"></label>
      <div class="rang-champs">${champDate('debut', 'Début des travaux', l.debut)}${champDate('fin', 'Fin des travaux', l.fin)}</div>
      <label class="champ">Plafond des pénalités (% du marché actualisé) <small>D'après le CCAP ; 0 : sans plafond.</small><input name="plafond" inputmode="decimal" value="${String(l.plafond).replace('.', ',')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? `Lot ${esc(l.code)}` : 'Nouveau lot', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') {
        if (!confirm(`Supprimer le lot ${l.code} avec ses avenants, situations, échéancier et sous-traitants ?`)) return '';
        retenir();
        const n = R.normaliserOperation(R.supprimerLot(op(), id), DEFAUTS);
        E.operations = E.operations.map((x) => (x.id === n.id ? n : x));
        sauver(); rendre();
        toast(`Lot ${l.code} supprimé.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const montant = R.lireMontant(fd.get('montant') || '0');
      const plafond = Number(String(fd.get('plafond') || '0').replace(',', '.'));
      if (!String(fd.get('code')).trim() || !String(fd.get('nom')).trim()) return 'Code et intitulé du lot obligatoires.';
      if (montant === null) return 'Montant illisible : chiffres, virgule pour les centimes.';
      if (!(plafond >= 0 && plafond <= 100)) return 'Plafond entre 0 et 100 %.';
      const debut = lireDate(fd, 'debut'), fin = lireDate(fd, 'fin');
      if (debut && fin && fin < debut) return 'La fin des travaux précède le début.';
      enregistrer('lots', { ...l, id: id || uid(), code: String(fd.get('code')).trim().toUpperCase(), nom: String(fd.get('nom')).trim(), entreprise: String(fd.get('entreprise')).trim(), montant, debut, fin, plafond }, id ? `Lot ${l.code} enregistré.` : 'Lot créé.');
    });
  }

  function modaleLotsTypes() {
    const pris = new Set(op().lots.map((l) => l.code));
    const corps = `<p class="aide">Découpage type d'un bâtiment. Les lots déjà présents sont grisés.</p><div class="choix-lots">${B.lots.map((l) => `<label class="case"><input type="checkbox" name="lot" value="${l.code}" ${pris.has(l.code) ? 'disabled checked' : ''}><span><b>${l.code}</b> ${esc(l.nom)}</span></label>`).join('')}</div><p class="erreur" role="alert"></p>`;
    ouvrirModale('Lots du découpage type', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const codes = fd.getAll('lot').filter((c) => !pris.has(c));
      if (!codes.length) return 'Coche au moins un lot.';
      retenir();
      for (const c of codes) { const b2 = B.lots.find((x) => x.code === c); op().lots.push({ id: uid(), code: b2.code, nom: b2.nom, entreprise: '', montant: 0, debut: '', fin: '', plafond: 0 }); }
      sauver(); rendre();
      toast(`${pluriel(codes.length, 'lot ajouté', 'lots ajoutés')}.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  // Détail d'un lot : marché, avenants, sous-traitants, situations, échéancier.
  function modaleDetailLot(id) {
    const o = op(), t = auj();
    const l = lot(id);
    if (!l) return;
    const x = R.syntheseLot(o, id, t);
    const sit = R.situationsLot(o, id, t);
    const avs = o.avenants.filter((a) => a.lot === id).sort((a, b) => a.numero - b.numero);
    const sts = o.sousTraitants.filter((s) => s.lot === id);
    const ech = o.echeancier.filter((e) => e.lot === id);
    const corps = `
      <p class="ligne-detail">${esc(l.entreprise || 'Entreprise à saisir')} · ${l.debut && l.fin ? `du ${dateLongue(l.debut)} au ${dateLongue(l.fin)}` : 'dates à saisir'}${x.prolongation ? ` · prolongation +${x.prolongation} j` : ''}</p>
      <div class="resume-facture">${[
        ['Marché actualisé', eur(x.actualise), `initial ${eur(x.initial)} · avenants ${euros(x.avenantsSignes, { centimes: false, signe: true })}`],
        ['Travaux cumulés', eur(x.cumul), `${pct(x.avancement)} · reste ${eur(x.resteAFacturer)}`],
        ['Payé net', eur(x.paye), `à payer ${eur(x.aPayer)} · à valider ${eur(x.aValider)}`],
        ['Retenue de garantie', eur(x.rg), `révision ${euros(x.revision, { centimes: false, signe: true })}`],
        ['Sous-traité', eur(x.sousTraite), `${pct(x.partSousTraitee)} du marché`],
        ['Pénalités encourues', eur(x.penalitesEncourues.retenu), x.penalitesEncourues.plafonne ? 'plafond atteint' : 'estimation'],
      ].map(([a, b2, c]) => `<div><span>${a}</span><b>${b2}</b><small>${c}</small></div>`).join('')}</div>
      ${x.depassement ? `<p class="aide alerte-taux">Les situations dépassent le marché actualisé de ${eur(x.depassement)} : un avenant est sans doute à formaliser.</p>` : ''}
      <div class="bloc-detail"><h3>Avenants <span>${avs.length}</span></h3>${avs.length ? `<ul class="mini-liste">${avs.map((a) => `<li><button class="btn lien" type="button" data-action="avenant" data-id="${a.id}">N° ${a.numero} · ${esc(a.objet)}</button><small>${euros(a.montant, { signe: true })}${a.delai ? ` · ${a.delai > 0 ? '+' : ''}${a.delai} j` : ''}</small>${tag(COUL_AVENANT[a.statut], R.STATUTS_AVENANT[a.statut])}</li>`).join('')}</ul>` : ''}<div class="rang"><button class="btn petit" type="button" data-action="nouvel-avenant" data-lot="${id}">${ICONES.plus}Avenant</button></div></div>
      <div class="bloc-detail"><h3>Sous-traitants <span>${sts.length}</span></h3>${sts.length ? `<ul class="mini-liste">${sts.map((s) => `<li><button class="btn lien" type="button" data-action="st" data-id="${s.id}">${esc(s.entreprise)}</button><small>${eur(s.montant)}</small>${tag(COUL_ST[s.statut], R.STATUTS_ST[s.statut])}</li>`).join('')}</ul>` : ''}<div class="rang"><button class="btn petit" type="button" data-action="nouveau-st" data-lot="${id}">${ICONES.plus}Sous-traitant</button></div></div>
      <div class="bloc-detail"><h3>Situations <span>${sit.length}</span></h3>${sit.length ? `<div class="defile"><table class="tableau petit"><thead><tr><th>N°</th><th>Mois</th><th class="nb">Cumul</th><th class="nb">Mois</th><th class="nb">Net</th><th>Statut</th></tr></thead><tbody>${[...sit].reverse().map((s) => `<tr class="cliquable" data-action="situation" data-id="${s.situation.id}" tabindex="0"><td>${s.situation.numero}</td><td>${esc(moisCourt(s.situation.mois))} ${s.situation.mois.slice(0, 4)}</td><td class="nb">${eur(s.situation.cumul)}</td><td class="nb">${eur(s.travaux)}</td><td class="nb">${eur(s.net)}</td><td>${tag(s.enRetard ? 'rouge' : COUL_SITUATION[s.situation.statut], s.enRetard ? 'En retard' : R.STATUTS_SITUATION[s.situation.statut])}</td></tr>`).join('')}</tbody></table></div>` : ''}<div class="rang"><button class="btn petit" type="button" data-action="nouvelle-situation" data-lot="${id}">${ICONES.plus}Situation</button></div></div>
      <div class="bloc-detail"><h3>Échéancier prévisionnel <span>${ech.length ? `${ech.length} mois · ${eur(ech.reduce((s, e) => s + e.montant, 0))}` : 'vide'}</span></h3>
        <p class="aide">${l.debut && l.fin && x.actualise ? 'Répartit le marché actualisé au prorata des jours entre le début et la fin du lot. Les montants se retouchent ensuite mois par mois.' : 'Saisis le montant et les dates du lot pour générer son échéancier.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="repartir" data-lot="${id}" ${l.debut && l.fin && x.actualise ? '' : 'disabled'}>Répartir linéairement</button><button class="btn petit" type="button" data-action="echeancier" data-lot="${id}">Modifier mois par mois</button></div></div>`;
    ouvrirModale(`${esc(l.code)} · ${esc(l.nom)}`, corps, `<button class="btn primaire" value="annuler">Fermer</button><button class="btn" type="button" data-action="modifier-lot" data-id="${id}">Modifier le lot</button>`, () => {});
  }

  function modaleAvenant(id, lotId = '') {
    const o = op();
    const a = id ? o.avenants.find((x) => x.id === id) : { lot: lotId || filtre.lot || o.lots[0]?.id, numero: 0, objet: '', montant: 0, delai: 0, date: '', statut: 'projet' };
    if (!a || !o.lots.length) return toast('Crée d\'abord un lot.');
    const corps = `
      <div class="rang-champs"><label class="champ">Lot${selectLots('lot', a.lot, { operation: false, requis: true })}</label><label class="champ" style="flex:0 1 110px">N°<input name="numero" type="number" min="1" value="${a.numero || R.prochainAvenant(o, a.lot)}"></label></div>
      <label class="champ">Objet<input name="objet" maxlength="300" value="${esc(a.objet)}" required placeholder="Ex. : travaux supplémentaires de…"></label>
      <div class="rang-champs"><label class="champ">Montant HT <small>Négatif pour une moins-value</small><input name="montant" inputmode="decimal" value="${R.saisieMontant(a.montant)}"></label><label class="champ">Incidence sur le délai (jours)<input name="delai" type="number" min="-365" max="365" value="${a.delai}"></label></div>
      <fieldset class="champ"><legend>Statut <small>Seuls les avenants signés modifient le marché et les dates.</small></legend>${radios('statut', R.STATUTS_AVENANT, a.statut)}</fieldset>
      ${champDate('date', 'Date (signature ou envoi)', a.date)}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? `Avenant n° ${a.numero}` : 'Nouvel avenant', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('avenants', id, 'Avenant supprimé.');
      const montant = R.lireMontant(fd.get('montant') || '0', { signe: true });
      if (montant === null) return 'Montant illisible.';
      if (!String(fd.get('objet')).trim()) return 'Précise l\'objet de l\'avenant.';
      enregistrer('avenants', { ...a, id: id || uid(), lot: String(fd.get('lot')), numero: Number(fd.get('numero')) || 1, objet: String(fd.get('objet')).trim(), montant, delai: Math.round(Number(fd.get('delai')) || 0), statut: String(fd.get('statut')), date: lireDate(fd, 'date') }, id ? 'Avenant enregistré.' : 'Avenant ajouté.');
    });
  }

  function modaleSousTraitant(id, lotId = '') {
    const o = op();
    const s = id ? o.sousTraitants.find((x) => x.id === id) : { lot: lotId || filtre.lot || o.lots[0]?.id, entreprise: '', objet: '', montant: 0, dateDemande: auj(), statut: 'demande', dateAcceptation: '', paiementDirect: false };
    if (!s || !o.lots.length) return toast('Crée d\'abord un lot.');
    const corps = `
      <label class="champ">Lot<select name="lot">${o.lots.map((l) => `<option value="${l.id}" ${l.id === s.lot ? 'selected' : ''}>${esc(l.code)} · ${esc(l.nom)}</option>`).join('')}</select></label>
      <label class="champ">Entreprise sous-traitante<input name="entreprise" maxlength="120" value="${esc(s.entreprise)}" required autocomplete="organization"></label>
      <label class="champ">Objet<input name="objet" maxlength="300" value="${esc(s.objet)}"></label>
      <div class="rang-champs"><label class="champ">Montant HT<input name="montant" inputmode="decimal" value="${R.saisieMontant(s.montant)}"></label>${champDate('dateDemande', 'Demande déposée le', s.dateDemande)}</div>
      <fieldset class="champ"><legend>Acceptation et agrément</legend>${radios('statut', R.STATUTS_ST, s.statut)}</fieldset>
      <div class="rang-champs">${champDate('dateAcceptation', 'Réponse le', s.dateAcceptation)}<label class="case" style="align-self:flex-end"><input type="checkbox" name="paiementDirect" ${s.paiementDirect ? 'checked' : ''}> Paiement direct</label></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? esc(s.entreprise) : 'Déclarer un sous-traitant', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('sousTraitants', id, 'Sous-traitant supprimé.');
      const montant = R.lireMontant(fd.get('montant') || '0');
      if (montant === null) return 'Montant illisible.';
      if (!String(fd.get('entreprise')).trim()) return 'Nom de l\'entreprise obligatoire.';
      if (!lireDate(fd, 'dateDemande')) return 'Date de la demande obligatoire.';
      enregistrer('sousTraitants', { ...s, id: id || uid(), lot: String(fd.get('lot')), entreprise: String(fd.get('entreprise')).trim(), objet: String(fd.get('objet')).trim(), montant, dateDemande: lireDate(fd, 'dateDemande'), statut: String(fd.get('statut')), dateAcceptation: lireDate(fd, 'dateAcceptation'), paiementDirect: fd.get('paiementDirect') === 'on' }, 'Sous-traitant enregistré.');
    });
  }

  function modaleSituation(id, lotId = '') {
    const o = op(), t = auj();
    const s = id ? o.situations.find((x) => x.id === id) : null;
    const lotInit = s?.lot || lotId || filtre.lot || o.lots[0]?.id;
    if (!o.lots.length) return toast('Crée d\'abord un lot.');
    const prec = (lid, mois) => { const l = o.situations.filter((x) => x.lot === lid && x.mois < mois && x.id !== id).sort((a, b) => (a.mois < b.mois ? 1 : -1)); return l[0]?.cumul || 0; };
    const v = s || { lot: lotInit, numero: R.prochaineSituation(o, lotInit), mois: R.moisDe(ajout(t, -20)), cumul: 0, k: 1, penalites: 0, dateReception: t, statut: 'recue', dateValidation: '', datePaiement: '', note: '' };
    const corps = `
      <div class="rang-champs"><label class="champ">Lot<select name="lot" id="s-lot">${o.lots.map((l) => `<option value="${l.id}" ${l.id === v.lot ? 'selected' : ''}>${esc(l.code)} · ${esc(l.nom)}</option>`).join('')}</select></label><label class="champ" style="flex:0 1 100px">N°<input name="numero" type="number" min="1" value="${v.numero}"></label><label class="champ" style="flex:0 1 170px">Mois des travaux<input name="mois" type="month" value="${esc(v.mois)}" id="s-mois" required></label></div>
      <label class="champ">Cumul des travaux exécutés à fin de mois (HT, hors révision) <small id="s-aide"></small><input name="cumul" id="s-cumul" inputmode="decimal" value="${R.saisieMontant(v.cumul)}"></label>
      <div class="rang-champs"><label class="champ">Coefficient de révision K <small>De ta formule de révision ; 1 sans révision.</small><input name="k" id="s-k" inputmode="decimal" value="${String(v.k).replace('.', ',')}"></label><label class="champ">Pénalités déduites (HT)<input name="penalites" id="s-pen" inputmode="decimal" value="${R.saisieMontant(v.penalites)}"></label></div>
      <pre class="recap" id="recap"></pre>
      <fieldset class="champ"><legend>Statut</legend>${radios('statut', R.STATUTS_SITUATION, v.statut)}</fieldset>
      <div class="rang-champs">${champDate('dateReception', 'Reçue le', v.dateReception, 'départ du délai de paiement')}${champDate('dateValidation', 'Validée le', v.dateValidation)}${champDate('datePaiement', 'Payée le', v.datePaiement)}</div>
      <label class="champ">Note<input name="note" maxlength="500" value="${esc(v.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? `Situation n° ${v.numero} · ${esc(codeLot(v.lot))}` : 'Nouvelle situation', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('situations', id, 'Situation supprimée.');
      const cumul = R.lireMontant(fd.get('cumul') || '0');
      const k = R.lireCoefficient(fd.get('k'));
      const pen = R.lireMontant(fd.get('penalites') || '0');
      const mois = String(fd.get('mois'));
      if (!R.estMois(mois)) return 'Choisis le mois des travaux.';
      if (cumul === null || pen === null) return 'Montant illisible.';
      if (k === null) return 'Coefficient K entre 0,5 et 2 (ex. : 1,0123).';
      const statut = String(fd.get('statut'));
      const lid = String(fd.get('lot'));
      if (o.situations.some((x) => x.lot === lid && x.mois === mois && x.id !== id)) return 'Ce lot a déjà une situation pour ce mois : modifie-la plutôt.';
      const dp = lireDate(fd, 'datePaiement');
      enregistrer('situations', { ...v, id: id || uid(), lot: lid, numero: Number(fd.get('numero')) || 1, mois, cumul, k, penalites: pen, statut, dateReception: lireDate(fd, 'dateReception'), dateValidation: lireDate(fd, 'dateValidation') || (statut !== 'recue' ? auj() : ''), datePaiement: dp || (statut === 'payee' ? auj() : ''), note: String(fd.get('note') || '') }, id ? 'Situation enregistrée.' : 'Situation ajoutée.');
    });
    // Aperçu du calcul à la frappe.
    const recalc = () => {
      const lid = $('#s-lot').value, m = $('#s-mois').value;
      const c = R.lireMontant($('#s-cumul').value || '0'), k = R.lireCoefficient($('#s-k').value), p = R.lireMontant($('#s-pen').value || '0');
      const p0 = prec(lid, m), act = R.marcheLot(o, lid).actualise;
      $('#s-aide').textContent = `Situation précédente : ${euros(p0)} · marché actualisé : ${euros(act)}`;
      if (c === null || k === null || p === null) { $('#recap').textContent = 'Saisie incomplète.'; return; }
      const tr = c - p0, rev = Math.round(tr * (k - 1)), mt = tr + rev, rg = Math.round(mt * o.reglages.rg / 100);
      $('#recap').textContent = `Travaux du mois   ${euros(tr)}\nRévision (K − 1)  ${euros(rev, { signe: true })}\nRetenue ${String(o.reglages.rg).replace('.', ',')} %     −${euros(rg)}\nPénalités         −${euros(p)}\nNet HT            ${euros(mt - rg - p)}${c > act ? `\n⚠ Cumul au-delà du marché actualisé (${pct(act ? c / act * 100 : 0)})` : ''}`;
    };
    ['#s-lot', '#s-mois', '#s-cumul', '#s-k', '#s-pen'].forEach((sel) => $(sel).addEventListener('input', recalc));
    recalc();
  }

  function modaleEcheancier(lotId = '') {
    const o = op();
    if (!o.lots.length) return toast('Crée d\'abord un lot.');
    const lid = lotId || filtre.lot || o.lots[0].id;
    const l = lot(lid);
    const ech = o.echeancier.filter((e) => e.lot === lid).sort((a, b) => (a.mois < b.mois ? -1 : 1));
    const mois = l.debut && l.fin ? R.listeMois(R.moisDe(l.debut), R.moisDe(l.fin)) : ech.map((e) => e.mois);
    const tous = [...new Set([...mois, ...ech.map((e) => e.mois)])].sort();
    const corps = `
      <label class="champ">Lot<select id="e-lot">${o.lots.map((x) => `<option value="${x.id}" ${x.id === lid ? 'selected' : ''}>${esc(x.code)} · ${esc(x.nom)}</option>`).join('')}</select></label>
      ${tous.length ? `<div class="grille-mois">${tous.map((m) => `<label class="champ">${esc(nomMois(m))}<input name="m-${m}" inputmode="decimal" value="${R.saisieMontant(ech.find((e) => e.mois === m)?.montant || 0)}"></label>`).join('')}</div>` : '<p class="aide">Saisis les dates du lot pour obtenir ses mois.</p>'}
      <p class="aide">Total prévu : <b id="e-total"></b> pour un marché actualisé de ${euros(R.marcheLot(o, lid).actualise)}.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Échéancier prévisionnel', corps, `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button><button class="btn gauche" value="repartir" ${l.debut && l.fin ? '' : 'disabled'}>Répartir linéairement</button>`, (fd, choix) => {
      if (choix === 'repartir') { repartir(lid); return; }
      const lignes = [];
      for (const m of tous) { const v = R.lireMontant(fd.get(`m-${m}`) || '0'); if (v === null) return `Montant illisible en ${nomMois(m)}.`; if (v) lignes.push({ id: uid(), lot: lid, mois: m, montant: v }); }
      retenir();
      o.echeancier = [...o.echeancier.filter((e) => e.lot !== lid), ...lignes];
      sauver(); rendre();
      toast(`Échéancier du lot ${l.code} enregistré.`, { libelle: 'Annuler', faire: annuler });
    });
    const total = () => { let s = 0; modale().querySelectorAll('.grille-mois input').forEach((i) => { s += R.lireMontant(i.value || '0') || 0; }); $('#e-total').textContent = euros(s); };
    modale().querySelectorAll('.grille-mois input').forEach((i) => i.addEventListener('input', total));
    total();
    $('#e-lot').addEventListener('change', (e) => modaleEcheancier(e.target.value));
  }

  function repartir(lid) {
    const o = op(), l = lot(lid);
    const act = R.marcheLot(o, lid).actualise;
    if (o.echeancier.some((e) => e.lot === lid) && !confirm(`Remplacer l'échéancier du lot ${l.code} par une répartition linéaire ?`)) return;
    retenir();
    o.echeancier = [...o.echeancier.filter((e) => e.lot !== lid), ...R.echeancierLineaire(act, l.debut, l.fin).map((e) => ({ id: uid(), lot: lid, ...e }))];
    sauver();
    if (modale().open) modale().close();
    rendre();
    toast(`Échéancier du lot ${l.code} réparti sur ${pluriel(R.listeMois(R.moisDe(l.debut), R.moisDe(l.fin)).length, 'mois', 'mois')}.`, { libelle: 'Annuler', faire: annuler });
  }

  function modaleJalon(id) {
    const o = op();
    const j = id ? o.jalons.find((x) => x.id === id) : { lot: filtre.lot || '', nom: '', type: 'contractuel', date: '', dateReelle: '', prolonger: true, penaliteJour: 0, note: '' };
    if (!j) return;
    const etat = id ? R.etatJalon(j, o, auj()) : null;
    const corps = `
      <label class="champ">Jalon<input name="nom" maxlength="120" value="${esc(j.nom)}" required list="jalons-types"></label>${listeDonnees('jalons-types', B.jalons.map((x) => x.nom))}
      <div class="rang-champs"><label class="champ">Portée${selectLots('lot', j.lot)}</label></div>
      <fieldset class="champ"><legend>Type</legend>${radios('type', { contractuel: 'Contractuel', interne: 'Interne' }, j.type, 'deux')}</fieldset>
      <div class="rang-champs">${champDate('date', 'Date contractuelle ou prévue', j.date)}${champDate('dateReelle', 'Date réelle', j.dateReelle, 'une fois atteint')}</div>
      <label class="case"><input type="checkbox" name="prolonger" ${j.prolonger ? 'checked' : ''}> Recaler avec les avenants et intempéries retenues</label>
      <label class="champ">Pénalité par jour de retard (HT) <small>D'après le CCAP, jalon contractuel seulement ; 0 si aucune.</small><input name="penaliteJour" inputmode="decimal" value="${R.saisieMontant(j.penaliteJour)}"></label>
      ${etat ? `<p class="aide">Date recalée : <b>${dateLongue(etat.dateRecalee)}</b>${etat.prolongation ? ` (+${etat.prolongation} j)` : ''} · ${R.ETATS_JALON[etat.etat]}${etat.retard ? `, ${etat.retard} j` : ''}${etat.penalites ? ` · pénalités estimées ${euros(etat.penalites)}` : ''}</p>` : ''}
      <label class="champ">Note<input name="note" maxlength="500" value="${esc(j.note)}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? esc(j.nom) : 'Nouveau jalon', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('jalons', id, 'Jalon supprimé.');
      if (!String(fd.get('nom')).trim()) return 'Nomme le jalon.';
      if (!lireDate(fd, 'date')) return 'Date contractuelle ou prévue obligatoire.';
      const pj = R.lireMontant(fd.get('penaliteJour') || '0');
      if (pj === null) return 'Pénalité illisible.';
      enregistrer('jalons', { ...j, id: id || uid(), nom: String(fd.get('nom')).trim(), lot: String(fd.get('lot')), type: String(fd.get('type')), date: lireDate(fd, 'date'), dateReelle: lireDate(fd, 'dateReelle'), prolonger: fd.get('prolonger') === 'on', penaliteJour: pj, note: String(fd.get('note') || '') }, 'Jalon enregistré.');
    });
  }

  function modaleJalonsTypes() {
    const o = op();
    const pris = new Set(o.jalons.map((j) => j.nom));
    const corps = `<p class="aide">Les jalons d'opération s'ajoutent une fois ; ceux d'un lot, pour chaque lot coché. Les dates se saisissent ensuite (date de fin contractuelle proposée par défaut).</p>
      <div class="choix-lots">${B.jalons.map((j, i) => `<label class="case"><input type="checkbox" name="j" value="${i}" ${j.portee === 'operation' && pris.has(j.nom) ? 'disabled' : ''}><span>${esc(j.nom)} <small>${j.portee === 'lot' ? 'par lot' : 'opération'} · ${j.type}</small></span></label>`).join('')}</div>
      <fieldset class="champ cadre-champs"><legend>Lots concernés par les jalons « par lot »</legend><div class="choix-lots">${o.lots.map((l) => `<label class="case"><input type="checkbox" name="l" value="${l.id}"><span><b>${esc(l.code)}</b> ${esc(l.nom)}</span></label>`).join('')}</div></fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Jalons types', corps, '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>', (fd) => {
      const choisis = fd.getAll('j').map((i) => B.jalons[Number(i)]);
      const lots = fd.getAll('l');
      if (!choisis.length) return 'Coche au moins un jalon.';
      const nouveaux = [];
      for (const j of choisis) {
        if (j.portee === 'operation') nouveaux.push({ id: uid(), lot: '', nom: j.nom, type: j.type, date: o.dateFin || ajout(auj(), 30) });
        else for (const lid of lots) { const l = lot(lid); nouveaux.push({ id: uid(), lot: lid, nom: j.nom, type: j.type, date: (j.nom.startsWith('Démarrage') ? l.debut : l.fin) || o.dateFin || ajout(auj(), 30) }); }
      }
      if (!nouveaux.length) return 'Coche les lots concernés par les jalons « par lot ».';
      retenir();
      o.jalons.push(...nouveaux.map((n) => ({ dateReelle: '', prolonger: true, penaliteJour: 0, note: '', ...n })));
      sauver(); rendre();
      toast(`${pluriel(nouveaux.length, 'jalon ajouté', 'jalons ajoutés')} : vérifie leurs dates.`, { libelle: 'Annuler', faire: annuler });
    });
  }

  function modaleEntree(id, intemperie = false) {
    const o = op();
    const e = id ? o.journal.find((x) => x.id === id) : { date: auj(), meteo: intemperie ? 'Pluie' : '', effectif: 0, faits: '', intemperie: intemperie ? { jours: 1, retenue: false, lot: '', nature: 'Pluie' } : null };
    if (!e) return;
    const i = e.intemperie || { jours: 1, retenue: false, lot: '', nature: 'Pluie' };
    const corps = `
      <div class="rang-champs">${champDate('date', 'Date', e.date)}<label class="champ">Météo<select name="meteo"><option value="">–</option>${B.meteo.map((m) => `<option ${m === e.meteo ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label><label class="champ" style="flex:0 1 120px">Effectif<input name="effectif" type="number" min="0" max="9999" value="${e.effectif || ''}"></label></div>
      <label class="champ">Faits marquants<textarea name="faits" rows="4" maxlength="3000" placeholder="Travaux réalisés, livraisons, visites, incidents, décisions…">${esc(e.faits)}</textarea></label>
      <label class="case"><input type="checkbox" name="intemperie" id="j-int" ${e.intemperie ? 'checked' : ''}> Journée d'intempérie</label>
      <fieldset class="champ cadre-champs" id="j-bloc" ${e.intemperie ? '' : 'hidden'}><legend>Intempérie</legend>
        <div class="rang-champs"><label class="champ">Nature<select name="nature">${B.naturesIntemperie.map((n) => `<option ${n === i.nature ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><label class="champ">Durée<select name="jours">${[0.5, 1].map((n) => `<option value="${n}" ${n === i.jours ? 'selected' : ''}>${n === 1 ? '1 jour' : 'Une demi-journée'}</option>`).join('')}</select></label><label class="champ">Lot${selectLots('lotInt', i.lot)}</label></div>
        <label class="case"><input type="checkbox" name="retenue" ${i.retenue ? 'checked' : ''}> Retenue pour prolongation des délais</label>
      </fieldset>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? `Journal du ${dateCourte(e.date)}` : 'Journal de chantier', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('journal', id, 'Entrée supprimée.');
      const d = lireDate(fd, 'date');
      if (!d) return 'Date obligatoire.';
      const int = fd.get('intemperie') === 'on' ? { jours: Number(fd.get('jours')), retenue: fd.get('retenue') === 'on', lot: String(fd.get('lotInt')), nature: String(fd.get('nature')) } : null;
      enregistrer('journal', { ...e, id: id || uid(), date: d, meteo: String(fd.get('meteo')), effectif: Math.round(Number(fd.get('effectif')) || 0), faits: String(fd.get('faits') || '').trim(), intemperie: int }, int?.retenue ? 'Entrée enregistrée : l\'intempérie décale les dates.' : 'Entrée enregistrée.');
    });
    $('#j-int').addEventListener('change', (x) => { $('#j-bloc').hidden = !x.target.checked; });
  }

  function modaleNC(id) {
    const o = op(), t = auj();
    const n = id ? o.nc.find((x) => x.id === id) : { lot: filtre.lot || o.lots[0]?.id || '', date: t, titre: '', type: '', gravite: 'mineure', statut: 'ouverte', echeance: R.echeanceNC(t, 'mineure', o.reglages.delaisNC), action: '', dateCloture: '' };
    if (!n) return;
    const corps = `
      <label class="champ">Constat<input name="titre" maxlength="200" value="${esc(n.titre)}" required placeholder="Ce qui est constaté, où"></label>
      <div class="rang-champs"><label class="champ">Lot${selectLots('lot', n.lot)}</label><label class="champ">Type<input name="type" maxlength="60" value="${esc(n.type)}" list="types-nc"></label></div>${listeDonnees('types-nc', B.typesNC.map((x) => x.nom))}
      <fieldset class="champ"><legend>Gravité <small>Propose l'échéance : ${Object.entries(o.reglages.delaisNC).map(([g, d]) => `${R.GRAVITES[g].toLowerCase()} ${d} j`).join(', ')}.</small></legend>${radios('gravite', R.GRAVITES, n.gravite, 'trois')}</fieldset>
      <label class="champ">Action demandée<textarea name="action" rows="2" maxlength="1000">${esc(n.action)}</textarea></label>
      <fieldset class="champ"><legend>Statut</legend>${radios('statut', R.STATUTS_NC, n.statut, 'deux')}</fieldset>
      <div class="rang-champs">${champDate('date', 'Constatée le', n.date)}<label class="champ">Échéance<input type="date" name="echeance" id="nc-ech" value="${esc(n.echeance)}"></label>${champDate('dateCloture', 'Close le', n.dateCloture)}</div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? 'Non-conformité' : 'Nouvelle non-conformité', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('nc', id, 'Non-conformité supprimée.');
      if (!String(fd.get('titre')).trim()) return 'Décris le constat.';
      if (!lireDate(fd, 'date')) return 'Date du constat obligatoire.';
      const statut = String(fd.get('statut'));
      enregistrer('nc', { ...n, id: id || uid(), titre: String(fd.get('titre')).trim(), lot: String(fd.get('lot')), type: String(fd.get('type')).trim(), gravite: String(fd.get('gravite')), statut, action: String(fd.get('action') || '').trim(), date: lireDate(fd, 'date'), echeance: lireDate(fd, 'echeance'), dateCloture: lireDate(fd, 'dateCloture') || (statut === 'close' ? auj() : '') }, 'Non-conformité enregistrée.');
    });
    if (!id) modale().querySelectorAll('[name=gravite]').forEach((r) => r.addEventListener('change', () => { $('#nc-ech').value = R.echeanceNC(modale().querySelector('[name=date]').value || t, r.value, o.reglages.delaisNC); }));
  }

  function modaleRisque(id) {
    const o = op();
    const r = id ? o.risques.find((x) => x.id === id) : { lot: filtre.lot || '', titre: '', categorie: '', probabilite: 2, impact: 2, reponse: 'reduire', action: '', porteur: '', echeance: '', statut: 'ouvert', montant: 0 };
    if (!r) return;
    const echelle = (nom, liste, v) => `<div class="choix-statut quatre">${liste.map((l, i) => `<label><input type="radio" name="${nom}" value="${i + 1}" ${v === i + 1 ? 'checked' : ''}><span>${i + 1} · ${esc(l)}</span></label>`).join('')}</div>`;
    const corps = `
      <label class="champ">Risque<input name="titre" maxlength="200" value="${esc(r.titre)}" required placeholder="Ce qui pourrait arriver"></label>
      <div class="rang-champs"><label class="champ">Catégorie<input name="categorie" maxlength="60" value="${esc(r.categorie)}" list="cat-risques"></label><label class="champ">Lot${selectLots('lot', r.lot)}</label></div>${listeDonnees('cat-risques', B.categoriesRisques.map((x) => x.nom))}
      <fieldset class="champ"><legend>Probabilité</legend>${echelle('probabilite', B.echelle.probabilite, r.probabilite)}</fieldset>
      <fieldset class="champ"><legend>Impact</legend>${echelle('impact', B.echelle.impact, r.impact)}</fieldset>
      <p class="aide" id="r-crit"></p>
      <fieldset class="champ"><legend>Réponse</legend>${radios('reponse', R.REPONSES_RISQUE, r.reponse, 'quatre')}</fieldset>
      <label class="champ">Action<textarea name="action" rows="2" maxlength="1000">${esc(r.action)}</textarea></label>
      <div class="rang-champs"><label class="champ">Porteur <small>Fonction ou entreprise</small><input name="porteur" maxlength="120" value="${esc(r.porteur)}"></label>${champDate('echeance', 'Échéance de l\'action', r.echeance)}</div>
      <div class="rang-champs"><label class="champ">Impact financier estimé (HT)<input name="montant" inputmode="decimal" value="${R.saisieMontant(r.montant)}"></label><fieldset class="champ"><legend>Statut</legend>${radios('statut', R.STATUTS_RISQUE, r.statut, 'deux')}</fieldset></div>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? 'Risque' : 'Nouveau risque', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('risques', id, 'Risque supprimé.');
      if (!String(fd.get('titre')).trim()) return 'Décris le risque.';
      const montant = R.lireMontant(fd.get('montant') || '0');
      if (montant === null) return 'Montant illisible.';
      enregistrer('risques', { ...r, id: id || uid(), titre: String(fd.get('titre')).trim(), categorie: String(fd.get('categorie')).trim(), lot: String(fd.get('lot')), probabilite: Number(fd.get('probabilite')), impact: Number(fd.get('impact')), reponse: String(fd.get('reponse')), action: String(fd.get('action') || '').trim(), porteur: String(fd.get('porteur')).trim(), echeance: lireDate(fd, 'echeance'), montant, statut: String(fd.get('statut')) }, 'Risque enregistré.');
    });
    const crit = () => { const p = Number(modale().querySelector('[name=probabilite]:checked')?.value || 1), i = Number(modale().querySelector('[name=impact]:checked')?.value || 1); $('#r-crit').innerHTML = `Criticité <b>${p * i}/16</b> : ${R.NIVEAUX[R.niveau(p * i)].toLowerCase()}.`; };
    modale().querySelectorAll('[name=probabilite],[name=impact]').forEach((x) => x.addEventListener('change', crit));
    crit();
  }

  function modaleCourrier(id, type = 'courrier') {
    const o = op();
    const c = id ? o.courriers.find((x) => x.id === id) : { type, numero: ['os', 'miseEnDemeure'].includes(type) ? R.prochainNumero(o, type) : 0, date: auj(), lot: filtre.lot || '', sens: 'emis', objet: '', reponseAttendue: '', dateReponse: '', incidenceDelai: 0, incidenceMontant: 0, note: '' };
    if (!c) return;
    const corps = `
      <div class="rang-champs"><label class="champ">Type<select name="type" id="c-type">${Object.entries(R.TYPES_COURRIER).map(([k, l]) => `<option value="${k}" ${k === c.type ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label><label class="champ" style="flex:0 1 110px">N° <small>0 : sans</small><input name="numero" id="c-num" type="number" min="0" value="${c.numero}"></label>${champDate('date', 'Date', c.date)}</div>
      <label class="champ">Objet<input name="objet" maxlength="300" value="${esc(c.objet)}" required></label>
      <div class="rang-champs"><label class="champ">Lot${selectLots('lot', c.lot)}</label><fieldset class="champ"><legend>Sens</legend>${radios('sens', { emis: 'Émis', recu: 'Reçu' }, c.sens, 'deux')}</fieldset></div>
      <div class="rang-champs">${champDate('reponseAttendue', 'Réponse attendue le', c.reponseAttendue, 'facultatif')}${champDate('dateReponse', 'Répondu le', c.dateReponse)}</div>
      <div class="rang-champs"><label class="champ">Incidence sur le délai (jours)<input name="incidenceDelai" type="number" min="-365" max="365" value="${c.incidenceDelai}"></label><label class="champ">Incidence financière (HT)<input name="incidenceMontant" inputmode="decimal" value="${R.saisieMontant(c.incidenceMontant)}"></label></div>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="1000">${esc(c.note)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? esc(R.libCourrier(c)) : 'Nouveau courrier', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('courriers', id, 'Courrier supprimé.');
      if (!String(fd.get('objet')).trim()) return 'Précise l\'objet.';
      if (!lireDate(fd, 'date')) return 'Date obligatoire.';
      const m = R.lireMontant(fd.get('incidenceMontant') || '0', { signe: true });
      if (m === null) return 'Incidence financière illisible.';
      enregistrer('courriers', { ...c, id: id || uid(), type: String(fd.get('type')), numero: Math.max(0, Math.round(Number(fd.get('numero')) || 0)), date: lireDate(fd, 'date'), objet: String(fd.get('objet')).trim(), lot: String(fd.get('lot')), sens: String(fd.get('sens')), reponseAttendue: lireDate(fd, 'reponseAttendue'), dateReponse: lireDate(fd, 'dateReponse'), incidenceDelai: Math.round(Number(fd.get('incidenceDelai')) || 0), incidenceMontant: m, note: String(fd.get('note') || '') }, 'Courrier enregistré.');
    });
    if (!id) $('#c-type').addEventListener('change', (e) => { $('#c-num').value = ['os', 'miseEnDemeure'].includes(e.target.value) ? R.prochainNumero(o, e.target.value) : 0; });
  }

  function modaleIntervenant(id) {
    const o = op();
    const p = id ? o.intervenants.find((x) => x.id === id) : { nom: '', societe: '', role: '', email: '', telephone: '' };
    if (!p) return;
    const corps = `
      <label class="champ">Nom ou fonction<input name="nom" maxlength="120" value="${esc(p.nom)}" placeholder="Ex. : conducteur de travaux"></label>
      <div class="rang-champs"><label class="champ">Société<input name="societe" maxlength="120" value="${esc(p.societe)}" autocomplete="organization"></label><label class="champ">Rôle<input name="role" maxlength="80" value="${esc(p.role)}" list="roles"></label></div>${listeDonnees('roles', B.roles)}
      <div class="rang-champs"><label class="champ">E-mail professionnel<input name="email" type="email" maxlength="160" value="${esc(p.email)}"></label><label class="champ">Téléphone professionnel<input name="telephone" type="tel" maxlength="40" value="${esc(p.telephone)}"></label></div>
      <p class="aide">Coordonnées professionnelles seulement, utiles au chantier. Rien n'est envoyé à cette personne.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(id ? 'Intervenant' : 'Nouvel intervenant', corps, PIED(!!id), (fd, choix) => {
      if (choix === 'supprimer') return supprimer('intervenants', id, 'Intervenant supprimé.');
      if (!String(fd.get('nom')).trim() && !String(fd.get('societe')).trim()) return 'Nom, fonction ou société obligatoire.';
      enregistrer('intervenants', { ...p, id: id || uid(), nom: String(fd.get('nom')).trim(), societe: String(fd.get('societe')).trim(), role: String(fd.get('role')).trim(), email: String(fd.get('email')).trim(), telephone: String(fd.get('telephone')).trim() }, 'Intervenant enregistré.');
    });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe" style="border:0;padding:0"><h3>Opération ouverte</h3><p class="aide">${esc(op().nom)} : identité, retenue de garantie, délai de paiement, délais des non-conformités et pièces du marché.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="fiche-operation">Fiche de l'opération</button><button class="btn petit" type="button" data-action="operations">Changer d'opération</button></div></div>
      <div class="groupe"><h3>Exporter</h3><p class="aide">Aucun envoi automatique : exporte en tableur (CSV, point-virgule) la synthèse financière par lot ou toutes les situations de l'opération.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="csv-synthese">Synthèse financière (CSV)</button><button class="btn petit" type="button" data-action="csv-situations">Situations (CSV)</button></div></div>
      <div class="groupe"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes opérations sont enregistrées en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application, sur le chantier.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>
      <div class="groupe"><h3>Repères</h3><dl class="reperes">${B.reperes.map(([t2, d]) => `<dt>${esc(t2)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></div>
      <div class="groupe"><h3>À propos</h3><p class="mention">Version ${B.version}. Base intégrée : découpage type en ${B.lots.length} lots, ${B.jalons.length} jalons types, ${B.pieces.length} pièces de marché, ${B.typesNC.length} types de non-conformités, ${B.categoriesRisques.length} catégories de risques, modèle de revue de projet. Aucun indice de révision ni taux réglementaire intégré. Aucun envoi d'e-mail, aucun lien avec un autre logiciel. Outil de suivi, pas un conseil juridique.</p></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>', () => {});
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.operations)) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.operations.length, 'opération')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        if (!E.operations.length) throw new Error();
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du suivi de chantier.'); }
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
  const exporter = () => telecharger(JSON.stringify(E, null, 2), 'application/json', `suivi-chantier-${auj()}.json`);
  const slugOp = () => (op().reference || op().nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'operation';
  async function copier(texte, message) {
    try { await navigator.clipboard.writeText(texte); toast(message); } catch { toast('Copie impossible : sélectionne le texte et copie-le à la main.'); }
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
  // Ouvre l'élément visé par une alerte du tableau de bord.
  function allerA(v, domaine, id) {
    if (v === 'registres') sous.registres = { 'Non-conformités': 'nc', Risques: 'risques', Courriers: 'courriers' }[domaine] || 'nc';
    if (v === 'planning') sous.planning = 'jalons';
    if (domaine === 'Non-conformités') filtre.nc = 'toutes';
    filtre.lot = '';
    changerVue(v);
    if (!id) return;
    if (domaine === 'Délais') modaleJalon(id);
    else if (domaine === 'Non-conformités') modaleNC(id);
    else if (domaine === 'Risques') modaleRisque(id);
    else if (domaine === 'Courriers') modaleCourrier(id);
    else if (domaine === 'Paiements' && op().situations.some((s) => s.id === id)) modaleSituation(id);
    else if (lot(id)) modaleDetailLot(id);
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    // Les boutons d'une modale qui en ouvrent une autre la ferment d'abord.
    const dansModale = el.closest('#modale') && !['fermer', 'installer'].includes(action) && el.type !== 'submit';
    if (dansModale && modale().open && !['choisir-op'].includes(action)) modale().close();
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); rendre(); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'accueil-suivant': if (!accueil.nom.trim()) { $('#erreur-accueil').textContent = 'Donne un nom à l\'opération.'; $('#a-nom').focus(); break; } accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-quitter': accueil = accueilVide(); demarrer(); break;
      case 'accueil-fin': terminerAccueil(); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'sous': sous[el.dataset.vue] = el.dataset.sous; if (vue !== el.dataset.vue) changerVue(el.dataset.vue); else rendre(); break;
      case 'aller': allerA(el.dataset.vue, el.dataset.domaine, id); break;
      case 'reglages': modaleReglages(); break;
      case 'operations': modaleOperations(); break;
      case 'choisir-op': E.actif = id; modale().close(); sauver(); filtre.lot = ''; rendre(); toast(`Opération ouverte : ${op().nom}.`); break;
      case 'fiche-operation': modaleOperation(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'csv-synthese': telecharger(R.versCsvSynthese(op(), auj()), 'text/csv;charset=utf-8', `synthese-financiere-${slugOp()}-${auj()}.csv`); break;
      case 'csv-situations': telecharger(R.versCsvSituations(op(), auj()), 'text/csv;charset=utf-8', `situations-${slugOp()}-${auj()}.csv`); break;
      case 'copier-revue': copier(R.texteRevue(op(), auj()), 'Revue de projet copiée : colle-la dans ton compte rendu.'); break;
      case 'imprimer': window.print(); break;
      case 'fermer': modale().close(); break;
      case 'nouveau-lot': modaleLot(null); break;
      case 'lots-types': modaleLotsTypes(); break;
      case 'ouvrir-lot': modaleDetailLot(id); break;
      case 'modifier-lot': modaleLot(id); break;
      case 'nouvel-avenant': modaleAvenant(null, el.dataset.lot); break;
      case 'avenant': modaleAvenant(id); break;
      case 'nouveau-st': modaleSousTraitant(null, el.dataset.lot); break;
      case 'st': modaleSousTraitant(id); break;
      case 'nouvelle-situation': modaleSituation(null, el.dataset.lot); break;
      case 'situation': modaleSituation(id); break;
      case 'echeancier': modaleEcheancier(el.dataset.lot); break;
      case 'repartir': repartir(el.dataset.lot); break;
      case 'nouveau-jalon': modaleJalon(null); break;
      case 'jalons-types': modaleJalonsTypes(); break;
      case 'jalon': modaleJalon(id); break;
      case 'nouvelle-entree': modaleEntree(null, !!el.dataset.intemperie); break;
      case 'entree': modaleEntree(id); break;
      case 'nouvelle-nc': modaleNC(null); break;
      case 'nc': modaleNC(id); break;
      case 'filtre-nc': filtre.nc = el.dataset.f; rendre(); break;
      case 'nouveau-risque': modaleRisque(null); break;
      case 'risque': modaleRisque(id); break;
      case 'nouveau-courrier': modaleCourrier(null, el.dataset.type); break;
      case 'courrier': modaleCourrier(id); break;
      case 'nouvel-intervenant': modaleIntervenant(null); break;
      case 'intervenant': modaleIntervenant(id); break;
      default: break;
    }
  });
  // Lignes de tableau cliquables au clavier.
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('tr.cliquable')) { e.preventDefault(); e.target.click(); } });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });
  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
    if (!modale().open && op()) rendre(); // la date du jour a pu changer
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  MQ_TEL.addEventListener?.('change', () => { if (E && op() && !modale().open) rendre(); });

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
        if (E.operations.length) { demarrer(); majSync('horsligne'); } else ecranAccueil();
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__chantier = { etat: () => E, regles: R };
  init();
})();
