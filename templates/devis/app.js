// Générateur de devis QME : catalogue, devis par lignes, totaux au centime, impression A4.
// Données synchronisées par clé de licence ou code d'accès (socle commun des templates QME).
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.DVS_REGLES;
  const API = '/api/templates';
  const PRODUIT = 'DVS';
  const CLE_CODE = 'qme-dvs-code';
  const CLE_CACHE = 'qme-dvs-cache';
  const CLE_DEMO = 'qme-dvs-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-dvs-ecran-accueil';
  const NOM = 'Générateur de devis';

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
  const euros = R.euros;

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'devis';
  let devisOuvert = null;
  let filtre = 'tous';
  let recherche = '';
  let rechercheCatalogue = '';
  let annulation = null;

  const entrepriseVide = () => ({
    enseigne: '', nom: '', forme: 'ei', formeJuridique: '', capital: '', adresse: '', telephone: '', email: '', siren: '',
    immatriculation: '', tvaIntra: '', franchise: false, assuranceObligatoire: false, assureur: '', assureurCoordonnees: '',
    couverture: '', decennale: false, prefixe: 'D', validiteJours: 30, acompteDefaut: 3000, tauxHoraire: 0, decompte: '',
    conditions: '', piedDePage: '',
  });
  const etatVide = () => ({ version: 1, metier: null, entreprise: entrepriseVide(), tva: B.tva.map((t) => ({ ...t })), catalogue: [], clients: [], devis: [], compteurs: {} });
  const normaliser = (d) => {
    const v = etatVide();
    if (!d || typeof d !== 'object') return v;
    const tableau = (x) => (Array.isArray(x) ? x : []);
    return {
      ...v, ...d,
      entreprise: { ...v.entreprise, ...(d.entreprise || {}) },
      tva: tableau(d.tva).length ? d.tva : v.tva,
      catalogue: tableau(d.catalogue), clients: tableau(d.clients),
      devis: tableau(d.devis).map((x) => ({ lignes: [], remise: { mode: 'aucune', valeur: 0 }, acompte: { mode: 'aucun', valeur: 0 }, client: {}, ...x, lignes: tableau(x.lignes) })),
      compteurs: d.compteurs && typeof d.compteurs === 'object' ? d.compteurs : {},
    };
  };
  const unDevis = (id) => E.devis.find((d) => d.id === id);
  const unClient = (id) => E.clients.find((c) => c.id === id);
  const optionsCalcul = () => ({ franchise: !!E.entreprise.franchise });
  const totaux = (d) => R.calculerTotaux(d, optionsCalcul());
  const tvaDefaut = () => (E.entreprise.franchise ? 0 : (E.tva[0]?.taux ?? 2000));
  const libelleTaux = (t) => R.pourcent(t);
  const copieClient = (c) => ({ nom: c?.nom || '', adresse: c?.adresse || '', email: c?.email || '', telephone: c?.telephone || '', siren: c?.siren || '' });

  const STATUTS = {
    brouillon: ['Brouillon', 'contour'], envoye: ['Envoyé', 'jaune'], expire: ['Validité dépassée', 'rouge'],
    accepte: ['Accepté', 'bleu'], refuse: ['Refusé', ''],
  };
  const etiquetteStatut = (d) => { const s = R.statutAffiche(d, auj()); return `<span class="etiquette ${STATUTS[s][1]}">${STATUTS[s][0]}</span>`; };

  function creerDevis(clientId, objet = '') {
    const t = auj();
    const an = Number(t.slice(0, 4));
    const { numero, rang } = R.prochainNumero(E.devis, E.entreprise.prefixe, an, E.compteurs[an]);
    E.compteurs[an] = rang;
    const c = unClient(clientId);
    const e = E.entreprise;
    const d = {
      id: uid(), numero, date: t, validiteJours: e.validiteJours || 30, clientId: c?.id || null, client: copieClient(c),
      objet, lieu: '', debut: '', duree: '', lignes: [], remise: { mode: 'aucune', valeur: 0 },
      acompte: e.acompteDefaut ? { mode: 'pourcent', valeur: e.acompteDefaut } : { mode: 'aucun', valeur: 0 },
      payant: false, cout: 0, tauxHoraire: e.tauxHoraire || 0, decompte: e.decompte || '', conditions: e.conditions || '',
      notes: '', attestationLogement: false, statut: 'brouillon', envoyeLe: null, decideLe: null,
    };
    E.devis.unshift(d);
    return d;
  }

  function dupliquerDevis(id) {
    const source = unDevis(id);
    const t = auj();
    const an = Number(t.slice(0, 4));
    const { numero, rang } = R.prochainNumero(E.devis, E.entreprise.prefixe, an, E.compteurs[an]);
    E.compteurs[an] = rang;
    const copie = R.dupliquer(source, { id: uid(), numero, date: t, nouvelId: uid });
    E.devis.unshift(copie);
    return copie;
  }

  const nouvelleLigne = (type = 'ligne', depuis = null) => ({
    id: uid(), type, designation: depuis?.designation || '', unite: depuis?.unite || (type === 'ligne' ? 'u' : ''),
    quantite: type === 'ligne' ? 1000 : 0, prixHT: depuis?.prixHT || 0, remise: 0, tva: depuis ? (E.entreprise.franchise ? 0 : depuis.tva ?? tvaDefaut()) : tvaDefaut(),
  });

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
        toast('Un autre appareil a modifié tes devis entre-temps : sa version est affichée. Refais ta dernière modification si elle manque.');
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
        // Ne pas remplacer la page sous les doigts de quelqu'un qui saisit.
        if (document.activeElement && document.activeElement.matches('input,textarea,select')) return;
        E = normaliser(corps.donnees);
        session.base = corps.donnees.majLe;
        cache(false);
        rendre();
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
  // Code DVS-XXXX-XXXX-XXXX-XXXX ou clé de licence Gumroad XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX.
  function formaterCode(v) {
    const n = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (n === 'DEMO' || 'DEMO'.startsWith(n)) return n;
    if (n.startsWith(PRODUIT)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (n.startsWith(PRODUIT) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
    E.metier = 'peinture';
    Object.assign(E.entreprise, {
      enseigne: 'Atelier Exemple Rénovation', nom: 'Paul Exemple', forme: 'ei', adresse: '8 rue de l\'Exemple\n69000 Lyon',
      telephone: '04 00 00 00 00', email: 'contact@example.com', siren: '000 000 000', immatriculation: 'RNE',
      assuranceObligatoire: true, assureur: 'Assureur Exemple (fictif)', assureurCoordonnees: '1 place de l\'Exemple, 75000 Paris',
      couverture: 'France métropolitaine', decennale: true, tauxHoraire: 5400, decompte: 'Temps passé sur place, par demi-heure entamée.',
      conditions: 'Acompte à la signature, solde à la fin des travaux. Paiement par virement bancaire.',
      piedDePage: 'Données fictives de démonstration.',
    });
    const cat = [
      ['Peinture, revêtements', 'Protection des sols et des meubles', 'forfait', 9000, 1000],
      ['Peinture, revêtements', 'Rebouchage et ponçage', 'm²', 650, 1000],
      ['Peinture, revêtements', 'Impression (sous-couche)', 'm²', 550, 1000],
      ['Peinture, revêtements', 'Peinture des murs, deux couches', 'm²', 1450, 1000],
      ['Peinture, revêtements', 'Peinture des plafonds, deux couches', 'm²', 1650, 1000],
      ['Peinture, revêtements', 'Peinture des boiseries', 'm', 1200, 1000],
      ['Peinture, revêtements', 'Pose de papier peint', 'm²', 2200, 1000],
      ['Plomberie, chauffage', 'Déplacement', 'forfait', 3500, 1000],
      ['Plomberie, chauffage', 'Main-d\'œuvre', 'h', 4500, 1000],
      ['Plomberie, chauffage', 'Remplacement d\'un mitigeur', 'u', 18500, 1000],
      ['Plomberie, chauffage', 'Remplacement d\'un chauffe-eau', 'u', 89000, 1000],
      ['Plomberie, chauffage', 'Calorifugeage des tuyaux', 'm', 1800, 550],
      ['Locaux professionnels', 'Peinture de bureaux, deux couches', 'm²', 1550, 2000],
      ['Locaux professionnels', 'Nettoyage de fin de chantier', 'forfait', 15000, 2000],
      ['Peinture, revêtements', 'Dépose de revêtement mural', 'm²', 0, 1000],
    ];
    E.catalogue = cat.map(([categorie, designation, unite, prixHT, tva]) => ({ id: uid(), categorie, designation, unite, prixHT, tva }));
    E.clients = [
      { nom: 'Claire Dubois', adresse: '14 allée des Exemples\n69100 Villeurbanne', email: 'claire.dubois@example.com', telephone: '06 00 00 00 01', type: 'particulier' },
      { nom: 'Julien Moreau', adresse: '3 impasse Fictive\n69003 Lyon', email: 'julien.moreau@example.com', telephone: '06 00 00 00 02', type: 'particulier' },
      { nom: 'SCI Les Tilleuls (fictive)', adresse: '22 avenue de l\'Exemple\n69006 Lyon', email: 'gestion@example.com', telephone: '04 00 00 00 03', type: 'pro', siren: '000 000 000' },
      { nom: 'Cabinet Arpège (fictif)', adresse: '5 quai de l\'Exemple\n69002 Lyon', email: 'accueil@example.com', telephone: '04 00 00 00 04', type: 'pro', siren: '' },
      { nom: 'Sophie Martin', adresse: '9 chemin des Essais\n69500 Bron', email: 'sophie.martin@example.com', telephone: '06 00 00 00 05', type: 'particulier' },
    ].map((c) => ({ id: uid(), ...c }));
    const L = (designation, q, unite, pu, tva, remise = 0) => ({ id: uid(), type: 'ligne', designation, quantite: Math.round(q * 1000), unite, prixHT: pu, tva, remise });
    const T = (designation) => ({ id: uid(), type: 'titre', designation, unite: '', quantite: 0, prixHT: 0, tva: 0, remise: 0 });
    const X = (designation) => ({ id: uid(), type: 'texte', designation, unite: '', quantite: 0, prixHT: 0, tva: 0, remise: 0 });
    const t = auj();
    const modele = [
      { j: -150, c: 4, objet: 'Peinture d\'une chambre', statut: 'accepte', decide: -140, lignes: [L('Protection des sols et des meubles', 1, 'forfait', 9000, 1000), L('Peinture des murs, deux couches', 38.5, 'm²', 1450, 1000), L('Peinture des plafonds, deux couches', 12, 'm²', 1650, 1000)] },
      { j: -75, c: 3, objet: 'Peinture des bureaux du 2e étage', statut: 'accepte', decide: -68, lieu: '5 quai de l\'Exemple, 69002 Lyon', remise: { mode: 'montant', valeur: 25000 }, acompte: { mode: 'pourcent', valeur: 3000 },
        lignes: [L('Peinture de bureaux, deux couches', 212, 'm²', 1550, 2000), L('Peinture des boiseries', 46, 'm', 1200, 2000), L('Nettoyage de fin de chantier', 1, 'forfait', 15000, 2000)] },
      { j: -40, c: 2, objet: 'Remise en peinture de la cage d\'escalier', statut: 'envoye', validite: 30, lieu: '22 avenue de l\'Exemple, 69006 Lyon',
        lignes: [L('Rebouchage et ponçage', 64, 'm²', 650, 2000), L('Peinture des murs, deux couches', 64, 'm²', 1450, 2000), L('Peinture des boiseries', 18, 'm', 1200, 2000, 1000)] },
      { j: -30, c: 1, objet: 'Pose de papier peint dans le salon', statut: 'refuse', decide: -21, lignes: [L('Dépose de revêtement mural', 24, 'm²', 600, 1000), L('Pose de papier peint', 24, 'm²', 2200, 1000)] },
      { j: -20, c: 0, objet: 'Remplacement du chauffe-eau', statut: 'accepte', decide: -16, attestation: true, lignes: [L('Déplacement', 1, 'forfait', 3500, 1000), L('Remplacement d\'un chauffe-eau', 1, 'u', 89000, 1000), L('Calorifugeage des tuyaux', 6, 'm', 1800, 550)] },
      { j: -6, c: 1, objet: 'Peinture du séjour et de l\'entrée', statut: 'envoye', attestation: true, debut: 21, duree: '4 jours',
        lignes: [L('Protection des sols et des meubles', 1, 'forfait', 9000, 1000), L('Impression (sous-couche)', 46, 'm²', 550, 1000), L('Peinture des murs, deux couches', 46, 'm²', 1450, 1000), L('Peinture des plafonds, deux couches', 22.5, 'm²', 1650, 1000)] },
      { j: -2, c: 3, objet: 'Rafraîchissement de la salle d\'attente', statut: 'envoye', lignes: [L('Peinture de bureaux, deux couches', 42, 'm²', 1550, 2000)] },
      { j: 0, c: 0, objet: 'Rénovation de la salle de bains', statut: 'brouillon', attestation: true, debut: 30, duree: '6 jours', lieu: '14 allée des Exemples, 69100 Villeurbanne',
        remise: { mode: 'pourcent', valeur: 500 }, acompte: { mode: 'pourcent', valeur: 3000 }, notes: 'Teinte des murs à choisir dans le nuancier (deux échantillons offerts).',
        lignes: [T('Préparation'), L('Protection des sols et des meubles', 1, 'forfait', 9000, 1000), L('Dépose de revêtement mural', 14.5, 'm²', 600, 1000),
          T('Plomberie'), L('Remplacement d\'un mitigeur', 2, 'u', 18500, 1000), L('Main-d\'œuvre', 3.5, 'h', 4500, 1000, 1000), L('Calorifugeage des tuyaux', 4, 'm', 1800, 550),
          T('Peinture'), L('Impression (sous-couche)', 14.5, 'm²', 550, 1000), L('Peinture des murs, deux couches', 14.5, 'm²', 1650, 1000), X('Peinture spéciale pièces humides, finition satinée.')] },
    ];
    for (const m of modele.sort((a, b) => a.j - b.j)) {
      const date = ajout(t, m.j);
      const an = Number(date.slice(0, 4));
      const { numero, rang } = R.prochainNumero(E.devis, 'D', an, E.compteurs[an]);
      E.compteurs[an] = rang;
      const c = E.clients[m.c];
      E.devis.unshift({
        id: uid(), numero, date, validiteJours: m.validite || 30, clientId: c.id, client: copieClient(c), objet: m.objet, lieu: m.lieu || '',
        debut: m.debut ? ajout(t, m.debut) : '', duree: m.duree || '', lignes: m.lignes, remise: m.remise || { mode: 'aucune', valeur: 0 },
        acompte: m.acompte || { mode: 'pourcent', valeur: 3000 }, payant: false, cout: 0, tauxHoraire: 5400, decompte: E.entreprise.decompte,
        conditions: E.entreprise.conditions, notes: m.notes || '', attestationLogement: !!m.attestation, statut: m.statut,
        envoyeLe: m.statut === 'brouillon' ? null : ajout(date, 1), decideLe: m.decide ? ajout(t, m.decide) : null,
      });
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
          <rect x="10" y="20" width="200" height="260" fill="#F0EDE6"/>
          <rect x="40" y="60" width="140" height="14" fill="#141414"/>
          <rect x="40" y="96" width="100" height="10" fill="#5E5A52"/>
          <rect x="40" y="120" width="120" height="10" fill="#5E5A52"/>
          <rect x="40" y="144" width="80" height="10" fill="#5E5A52"/>
          <rect x="110" y="214" width="70" height="36" fill="#F5B400"/>
          <circle cx="330" cy="150" r="110" fill="#D9302A"/>
          <rect x="420" y="40" width="130" height="130" fill="#1D4E89"/>
          <path d="M420 280 A130 130 0 0 1 550 150 V280 Z" fill="#F5B400"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Générateur de devis · artisans et freelances</p>
          <h1>Des devis justes au centime.</h1>
          <p>Ton catalogue de prestations, des lignes avec remise et TVA, les mentions vérifiées, et une impression A4 propre en PDF.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre tes devis</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Tes devis sont enregistrés en ligne et te suivent sur tous tes appareils.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mes devis</button>
        </form>
        <div class="separateur">ou</div>
        <button class="btn" type="button" data-action="demo">Essayer avec des données d'exemple</button>
        <p class="mention">Pas encore le générateur ? <a href="/templates/">Voir l'offre</a>. La démo reste sur cet appareil et n'envoie rien. Clé perdue : retrouve-la dans ton e-mail Gumroad ou écris à <b>quentin.morel@qm-engineering.fr</b>.</p>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mes devis'; champ.focus();
      }
    });
  }

  // ---------- Rendu : premier lancement ----------
  let accueil = { etape: 1, metier: null, nom: '', enseigne: '', forme: 'ei', franchise: false, importer: true };

  function ecranAccueil() {
    const a = accueil;
    const etapes = `<div class="etapes-accueil" aria-label="Étape ${a.etape} sur 2"><span class="actif"></span><span class="${a.etape === 2 ? 'actif' : ''}"></span></div>`;
    const tete = `<div class="accueil-tete"><span class="marque">${MARQUE}</span>${etapes}</div>`;
    let corps;
    if (a.etape === 1) {
      corps = `
        <p class="surtitre">Bienvenue</p>
        <h1>Quel est ton métier ?</h1>
        <p class="intro">Ton catalogue démarre avec les prestations types de ton métier, <b>sans prix</b> : tu y mets les tiens. Tout reste modifiable.</p>
        <div class="filieres" role="group" aria-label="Métier">
          ${B.metiers.map((x, i) => `<button type="button" class="filiere" style="--c:${['var(--rouge)', 'var(--bleu)', 'var(--jaune)', 'var(--encre)'][i % 4]}" data-action="metier" data-id="${x.id}" aria-pressed="${a.metier === x.id}"><b>${esc(x.nom)}</b><span>${pluriel(x.lignes.length, 'prestation type', 'prestations types')}</span></button>`).join('')}
          <button type="button" class="filiere" style="--c:var(--trait)" data-action="metier" data-id="autre" aria-pressed="${a.metier === 'autre'}"><b>Autre métier</b><span>Je crée mon catalogue moi-même</span></button>
        </div>
        <div class="accueil-pied"><span></span><button class="btn primaire" data-action="accueil-suivant" ${a.metier ? '' : 'disabled'}>Continuer</button></div>`;
    } else {
      const m = B.metiers.find((x) => x.id === a.metier);
      corps = `
        <p class="surtitre">${esc(m ? m.nom : 'Autre métier')}</p>
        <h1>Ton entreprise</h1>
        <p class="intro">Ces informations apparaissent en tête de chaque devis. Tu compléteras le reste (SIREN, adresse, assurance) dans l'onglet Entreprise.</p>
        <form id="form-accueil" class="grille-form" novalidate>
          <fieldset class="champ choix-forme"><legend>Forme</legend>
            <label class="case"><input type="radio" name="forme" value="ei" ${a.forme === 'ei' ? 'checked' : ''}> Entreprise individuelle (dont micro-entreprise)</label>
            <label class="case"><input type="radio" name="forme" value="societe" ${a.forme === 'societe' ? 'checked' : ''}> Société (SARL, SAS, EURL…)</label>
          </fieldset>
          <label class="champ">${a.forme === 'societe' ? 'Dénomination sociale' : 'Ton prénom et ton nom'}<input name="nom" maxlength="80" value="${esc(a.nom)}" autocomplete="${a.forme === 'societe' ? 'organization' : 'name'}"></label>
          <label class="champ">Nom commercial <small>Facultatif.</small><input name="enseigne" maxlength="80" value="${esc(a.enseigne)}"></label>
          <label class="case"><input type="checkbox" name="franchise" ${a.franchise ? 'checked' : ''}> Je suis en franchise en base de TVA (je ne facture pas de TVA)</label>
          ${m ? `<label class="case"><input type="checkbox" name="importer" ${a.importer ? 'checked' : ''}> Ajouter les ${m.lignes.length} prestations types « ${esc(m.nom)} » à mon catalogue</label>` : ''}
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
      const forme = d.get('forme');
      Object.assign(accueil, { nom: d.get('nom') || '', enseigne: d.get('enseigne') || '', franchise: d.has('franchise'), importer: d.has('importer') });
      if (forme !== accueil.forme) { accueil.forme = forme; ecranAccueil(); }
    });
  }

  function terminerAccueil() {
    E = etatVide();
    const a = accueil;
    const m = B.metiers.find((x) => x.id === a.metier);
    E.metier = a.metier;
    Object.assign(E.entreprise, { nom: a.nom.trim(), enseigne: a.enseigne.trim(), forme: a.forme, franchise: a.franchise });
    if (m && a.importer) importerMetier(m);
    accueil = { etape: 1, metier: null, nom: '', enseigne: '', forme: 'ei', franchise: false, importer: true };
    sauver();
    demarrer();
    toast('Ton espace est prêt. Complète tes mentions dans l\'onglet Entreprise.');
  }

  function importerMetier(m) {
    const deja = new Set(E.catalogue.map((x) => `${x.categorie}|${x.designation}`));
    let n = 0;
    for (const [designation, unite] of m.lignes) {
      if (deja.has(`${m.nom}|${designation}`)) continue;
      E.catalogue.push({ id: uid(), categorie: m.nom, designation, unite, prixHT: 0, tva: tvaDefaut() });
      n++;
    }
    return n;
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    devis: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    catalogue: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    clients: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5" fill="currentColor"/><path d="M3 21a9 7 0 0 1 18 0Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    entreprise: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    mentions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="4" fill="currentColor"/><rect x="3" y="10" width="18" height="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="16" width="12" height="4" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['devis', 'Devis'], ['catalogue', 'Catalogue'], ['clients', 'Clients'], ['entreprise', 'Entreprise'], ['mentions', 'Mentions']];
  const ONGLET_DE = { edition: 'devis', apercu: 'devis' };

  function lireHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [v, id] = h.split('=');
    if ((v === 'edition' || v === 'apercu') && id && unDevis(id)) { vue = v; devisOuvert = id; return; }
    if (ONGLETS.some(([x]) => x === v)) vue = v;
  }

  function demarrer() {
    document.body.classList.add('app');
    lireHash();
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai un code d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Générateur<br>de devis</span>
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
    if ((vue === 'edition' || vue === 'apercu') && !unDevis(devisOuvert)) vue = 'devis';
    const onglet = ONGLET_DE[vue] || vue;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === onglet) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const titres = { devis: 'Devis', edition: `Devis ${unDevis(devisOuvert)?.numero || ''}`, apercu: `Aperçu ${unDevis(devisOuvert)?.numero || ''}`, catalogue: 'Catalogue', clients: 'Clients', entreprise: 'Entreprise', mentions: 'Mentions et sources' };
    document.title = `${titres[vue]} · ${NOM}`;
    document.body.dataset.vue = vue;
    $('#vue').innerHTML = { devis: vueDevis, edition: vueEdition, apercu: vueApercu, catalogue: vueCatalogue, clients: vueClients, entreprise: vueEntreprise, mentions: vueMentions }[vue]();
  }

  function changerVue(v, id = null) {
    vue = v;
    if (id) devisOuvert = id;
    history.replaceState(null, '', id ? `#${v}=${id}` : `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '') => `<div class="vide-etat">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  // ---------- Vue : liste des devis ----------
  const FILTRES = [['tous', 'Tous'], ['brouillon', 'Brouillons'], ['envoye', 'Envoyés'], ['expire', 'Validité dépassée'], ['accepte', 'Acceptés'], ['refuse', 'Refusés']];

  function vueDevis() {
    const t = auj();
    const s = R.statistiques(E.devis, t, optionsCalcul());
    const tuiles = [
      ['En attente', s.attente, euros(s.attenteHT) + ' HT', 'Devis envoyés, dans leur durée de validité.', 'var(--jaune)', ''],
      ['Acceptés sur 12 mois', s.acceptes12, euros(s.accepteHT12) + ' HT', 'Montant hors taxes des devis acceptés.', 'var(--bleu)', 'rond'],
      ['Taux d\'acceptation', s.taux === null ? '–' : `${s.taux}<small>%</small>`, '', 'Acceptés sur les devis tranchés (12 mois).', 'var(--encre)', ''],
      ['Validité dépassée', s.expires, s.expires ? 'à relancer ou classer' : '', 'Envoyés sans réponse après la validité.', 'var(--rouge)', 'rond'],
    ].map(([lib, v, u, d, c, f]) => `<div class="tuile ${f}" style="--c:${c}"><p class="surtitre">${lib}</p><b>${v}</b>${u ? `<em>${u}</em>` : ''}<span>${d}</span></div>`).join('');
    const q = recherche.trim().toLowerCase();
    const liste = E.devis
      .filter((d) => filtre === 'tous' || R.statutAffiche(d, t) === filtre)
      .filter((d) => !q || `${d.numero} ${d.client?.nom} ${d.objet}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
    const compte = (f) => (f === 'tous' ? E.devis.length : E.devis.filter((d) => R.statutAffiche(d, t) === f).length);
    const lignes = liste.map((d) => {
      const tt = totaux(d);
      return `<li class="ligne-devis">
        <button class="ld-ouvrir" data-action="ouvrir" data-id="${d.id}" aria-label="Ouvrir le devis ${esc(d.numero)}">
          <span class="ld-num"><b>${esc(d.numero)}</b><small>${fmt(d.date)}</small></span>
          <span class="ld-client"><b>${esc(d.client?.nom || 'Client à choisir')}</b><small>${esc(d.objet || 'Sans objet')}</small></span>
          <span class="ld-montant"><b>${euros(tt.totalHT)} HT</b><small>${euros(tt.totalTTC)} ${E.entreprise.franchise ? '' : 'TTC'}</small></span>
          <span class="ld-statut">${etiquetteStatut(d)}</span>
        </button>
        <button class="btn petit ld-dup" data-action="dupliquer" data-id="${d.id}" aria-label="Dupliquer le devis ${esc(d.numero)}">Dupliquer</button>
      </li>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Devis</h1><p>Tous tes devis, du brouillon à la réponse du client. Un devis envoyé dont la durée de validité est passée est signalé.</p></div>
        <div class="actions"><button class="btn primaire" data-action="devis-nouveau">${ICONES.plus}Nouveau devis</button></div></div>
      <div class="tuiles">${tuiles}</div>
      <h2 class="titre-section">Liste</h2>
      <div class="barre-filtres">
        <div class="filtres" role="group" aria-label="Filtrer par statut">${FILTRES.map(([id, nom]) => `<button class="filtre" data-action="filtre" data-id="${id}" aria-pressed="${filtre === id}">${nom}<span>${compte(id)}</span></button>`).join('')}</div>
        <label class="champ recherche"><span class="sr-only">Rechercher un devis</span><input type="search" id="recherche" placeholder="Rechercher : numéro, client, objet" value="${esc(recherche)}"></label>
      </div>
      ${!E.devis.length ? videEtat('Aucun devis pour l\'instant', 'Crée ton premier devis : choisis le client, ajoute des lignes depuis ton catalogue, puis imprime-le ou enregistre-le en PDF.', `<button class="btn primaire" data-action="devis-nouveau">${ICONES.plus}Nouveau devis</button>`)
        : liste.length ? `<ul class="liste-devis">${lignes}</ul>` : '<p class="vide-ligne">Aucun devis ne correspond à ce filtre.</p>'}`;
  }

  // ---------- Vue : édition d'un devis ----------
  const optionsTva = (choisi) => {
    const liste = E.tva.some((t) => t.taux === choisi) ? E.tva : [...E.tva, { taux: choisi, libelle: 'Taux retiré de la liste' }];
    return liste.map((t) => `<option value="${t.taux}" ${t.taux === choisi ? 'selected' : ''}>${libelleTaux(t.taux)}</option>`).join('');
  };

  function ligneEdition(l, i, n, tt) {
    const fleches = `<div class="l-outils">
      <button type="button" class="mini" data-action="ligne-haut" data-id="${l.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter la ligne">↑</button>
      <button type="button" class="mini" data-action="ligne-bas" data-id="${l.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descendre la ligne">↓</button>
      <button type="button" class="mini" data-action="ligne-dup" data-id="${l.id}" aria-label="Dupliquer la ligne">⧉</button>
      <button type="button" class="mini danger" data-action="ligne-suppr" data-id="${l.id}" aria-label="Supprimer la ligne">×</button></div>`;
    if (l.type === 'titre') {
      return `<li class="l l-titre" data-ligne="${l.id}"><label class="l-des"><span class="sr-only">Titre de section</span><input data-l="designation" data-id="${l.id}" value="${esc(l.designation)}" placeholder="Titre de section (ex. : Salle de bains)" maxlength="120"></label><span class="l-st" data-st="${l.id}">${euros(tt.sections[l.id] || 0)} HT</span>${fleches}</li>`;
    }
    if (l.type === 'texte') {
      return `<li class="l l-texte" data-ligne="${l.id}"><label class="l-des"><span class="sr-only">Texte libre</span><textarea data-l="designation" data-id="${l.id}" rows="2" placeholder="Texte libre (précision, exclusion, variante…)" maxlength="1000">${esc(l.designation)}</textarea></label>${fleches}</li>`;
    }
    const c = tt.detail[l.id] || { net: 0 };
    return `<li class="l" data-ligne="${l.id}">
      <label class="l-des"><span class="l-lib">Désignation</span><textarea data-l="designation" data-id="${l.id}" rows="1" maxlength="500" placeholder="Prestation ou fourniture">${esc(l.designation)}</textarea></label>
      <label class="l-qte"><span class="l-lib">Qté</span><input data-l="quantite" data-type="quantite" data-id="${l.id}" value="${R.saisieQuantite(l.quantite)}" inputmode="decimal"></label>
      <label class="l-unite"><span class="l-lib">Unité</span><input data-l="unite" data-id="${l.id}" value="${esc(l.unite)}" list="unites" maxlength="12"></label>
      <label class="l-pu"><span class="l-lib">PU HT (€)</span><input data-l="prixHT" data-type="montant" data-id="${l.id}" value="${R.saisieMontant(l.prixHT)}" inputmode="decimal"></label>
      <label class="l-rem"><span class="l-lib">Remise %</span><input data-l="remise" data-type="pourcent" data-id="${l.id}" value="${l.remise ? R.saisiePourcent(l.remise) : ''}" inputmode="decimal" placeholder="0"></label>
      ${E.entreprise.franchise ? '' : `<label class="l-tva"><span class="l-lib">TVA</span><select data-l="tva" data-type="taux" data-id="${l.id}">${optionsTva(l.tva)}</select></label>`}
      <output class="l-montant" data-montant="${l.id}"><span class="l-lib">Total HT</span><b>${euros(c.net)}</b></output>
      ${fleches}
    </li>`;
  }

  function blocTotaux(d) {
    const tt = totaux(d);
    const f = tt.franchise;
    const lignes = [
      tt.remisesLignes ? ['Total brut HT', euros(tt.brutTotal)] : null,
      tt.remisesLignes ? ['Remises sur lignes', `− ${euros(tt.remisesLignes)}`] : null,
      tt.remiseGlobale ? ['Sous-total HT', euros(tt.sousTotal)] : null,
      tt.remiseGlobale ? [`Remise globale${d.remise.mode === 'pourcent' ? ` (${R.pourcent(d.remise.valeur)})` : ''}`, `− ${euros(tt.remiseGlobale)}`] : null,
      ['Total HT', euros(tt.totalHT), 'fort'],
      ...(f ? [] : tt.tva.map((x) => [`TVA ${libelleTaux(x.taux)} sur ${euros(x.base)}`, euros(x.montant)])),
      [f ? 'Net à payer' : 'Total TTC', euros(tt.totalTTC), 'total'],
      tt.acompte ? [`Acompte${d.acompte.mode === 'pourcent' ? ` (${R.pourcent(d.acompte.valeur)})` : ''}`, euros(tt.acompte)] : null,
      tt.acompte ? ['Reste à payer', euros(tt.reste)] : null,
    ].filter(Boolean);
    return `<dl class="totaux">${lignes.map(([a, b, c]) => `<div class="${c || ''}"><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>
      ${f ? '<p class="note-totaux">TVA non applicable - article 293 B du CGI</p>' : ''}`;
  }

  function blocMentions(d) {
    const m = R.mentionsManquantes(E.entreprise, d);
    if (!m.length) return '<p class="mentions-ok">Mentions de base présentes.</p>';
    return `<div class="mentions-ko"><b>À compléter</b><ul>${m.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }

  function vueEdition() {
    const d = unDevis(devisOuvert);
    const tt = totaux(d);
    const st = R.statutAffiche(d, auj());
    const n = d.lignes.length;
    const champD = (cle, lib, valeur, extra = '') => `<label class="champ">${lib}<input data-d="${cle}" value="${esc(valeur)}" ${extra}></label>`;
    const modeValeur = (cle, objet, modes) => `
      <div class="champ-double">
        <label class="champ">${modes.titre}<select data-d="${cle}.mode">${modes.options.map(([v, l]) => `<option value="${v}" ${objet.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${objet.mode === 'pourcent' || objet.mode === 'montant' ? `<label class="champ">${objet.mode === 'pourcent' ? 'Taux (%)' : 'Montant (€)'}<input data-d="${cle}.valeur" data-type="${objet.mode === 'pourcent' ? 'pourcent' : 'montant'}" value="${objet.valeur ? (objet.mode === 'pourcent' ? R.saisiePourcent(objet.valeur) : R.saisieMontant(objet.valeur)) : ''}" inputmode="decimal"></label>` : '<span></span>'}
      </div>`;
    return `
      <div class="edition-tete">
        <button class="btn lien" data-action="vue" data-vue="devis">← Tous les devis</button>
        <div class="edition-titre"><h1>Devis ${esc(d.numero)}</h1>${etiquetteStatut(d)}</div>
        <div class="actions">
          <button class="btn primaire" data-action="apercu" data-id="${d.id}">Aperçu et impression</button>
          <button class="btn" data-action="dupliquer" data-id="${d.id}">Dupliquer</button>
          <button class="btn danger" data-action="devis-suppr" data-id="${d.id}">Supprimer</button>
        </div>
      </div>
      <div class="statuts" role="group" aria-label="Statut du devis">
        ${R.STATUTS.map((s) => `<button class="statut" data-action="statut" data-id="${d.id}" data-statut="${s}" aria-pressed="${d.statut === s}">${STATUTS[s][0]}</button>`).join('')}
        <span class="statut-info">${d.envoyeLe ? `Envoyé le ${fmt(d.envoyeLe)}` : ''}${d.decideLe ? ` · ${d.statut === 'accepte' ? 'accepté' : 'refusé'} le ${fmt(d.decideLe)}` : ''}${st === 'expire' ? ` · validité dépassée depuis le ${fmt(R.finValidite(d))}` : ''}</span>
      </div>
      ${d.statut !== 'brouillon' ? '<p class="aide">Ce devis n\'est plus un brouillon : si tu le modifies, préviens ton client ou crée plutôt une copie (Dupliquer).</p>' : ''}
      <div class="editeur">
        <div class="editeur-principal">
          <section class="bloc">
            <h2>Client</h2>
            <div class="grille-2">
              <label class="champ">Choisir dans mes clients<select data-action-change="choisir-client">${['<option value="">Saisie libre</option>', ...E.clients.map((c) => `<option value="${c.id}" ${c.id === d.clientId ? 'selected' : ''}>${esc(c.nom)}</option>`)].join('')}</select></label>
              <div class="champ-bouton"><button class="btn petit" type="button" data-action="client-nouveau" data-pour="${d.id}">${ICONES.plus}Nouveau client</button></div>
              ${champD('client.nom', 'Nom du client', d.client?.nom || '', 'maxlength="120"')}
              ${champD('client.email', 'E-mail', d.client?.email || '', 'type="email" maxlength="120"')}
              <label class="champ">Adresse<textarea data-d="client.adresse" rows="2" maxlength="300">${esc(d.client?.adresse || '')}</textarea></label>
              ${champD('client.siren', 'SIREN (client professionnel)', d.client?.siren || '', 'maxlength="20" inputmode="numeric"')}
            </div>
          </section>
          <section class="bloc">
            <h2>Devis</h2>
            <div class="grille-2">
              ${champD('objet', 'Objet (nature des travaux ou de la prestation)', d.objet, 'maxlength="160"')}
              ${champD('lieu', 'Lieu d\'exécution', d.lieu, 'maxlength="200"')}
              ${champD('date', 'Date du devis', d.date, 'type="date" required')}
              ${champD('validiteJours', 'Validité (jours)', d.validiteJours, 'type="number" min="1" max="365" data-type="entier"')}
              ${champD('debut', 'Début prévu', d.debut, 'type="date"')}
              ${champD('duree', 'Durée estimée', d.duree, 'maxlength="60" placeholder="Ex. : 3 jours"')}
            </div>
            <p class="aide-champ">Valable jusqu'au <b data-fin>${fmtLong(R.finValidite(d))}</b>.</p>
          </section>
          <section class="bloc">
            <h2>Lignes <span>${pluriel(d.lignes.filter((l) => l.type === 'ligne').length, 'ligne chiffrée', 'lignes chiffrées')}</span></h2>
            ${n ? `<ul class="lignes ${E.entreprise.franchise ? 'sans-tva' : ''}">${d.lignes.map((l, i) => ligneEdition(l, i, n, tt)).join('')}</ul>` : '<p class="vide-ligne">Aucune ligne. Ajoute une prestation depuis ton catalogue ou une ligne vide.</p>'}
            <datalist id="unites">${B.unites.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
            <div class="ajouts">
              <button class="btn primaire petit" data-action="ligne-catalogue">${ICONES.plus}Depuis le catalogue</button>
              <button class="btn petit" data-action="ligne-ajout" data-type="ligne">${ICONES.plus}Ligne vide</button>
              <button class="btn petit" data-action="ligne-ajout" data-type="titre">${ICONES.plus}Titre de section</button>
              <button class="btn petit" data-action="ligne-ajout" data-type="texte">${ICONES.plus}Texte libre</button>
            </div>
          </section>
          <section class="bloc">
            <h2>Remise, acompte et conditions</h2>
            ${modeValeur('remise', d.remise, { titre: 'Remise globale', options: [['aucune', 'Aucune'], ['pourcent', 'En pourcentage'], ['montant', 'En euros HT']] })}
            ${modeValeur('acompte', d.acompte, { titre: 'Acompte à la signature', options: [['aucun', 'Aucun'], ['pourcent', 'En % du total'], ['montant', 'Montant fixe']] })}
            <div class="grille-2">
              <label class="champ">Taux horaire de main-d'œuvre TTC (€)<small>Mention obligatoire des devis de travaux et de dépannage. Laisse vide si sans objet.</small><input data-d="tauxHoraire" data-type="montant" value="${d.tauxHoraire ? R.saisieMontant(d.tauxHoraire) : ''}" inputmode="decimal"></label>
              <label class="champ">Modalités de décompte du temps<small>Ex. : par demi-heure entamée.</small><input data-d="decompte" value="${esc(d.decompte)}" maxlength="200"></label>
            </div>
            <label class="case"><input type="checkbox" data-d="payant" ${d.payant ? 'checked' : ''}> Devis payant</label>
            ${d.payant ? `<label class="champ" style="max-width:260px">Coût du devis TTC (€)<input data-d="cout" data-type="montant" value="${d.cout ? R.saisieMontant(d.cout) : ''}" inputmode="decimal"></label>` : ''}
            ${E.entreprise.franchise ? '' : `<label class="case"><input type="checkbox" data-d="attestationLogement" ${d.attestationLogement ? 'checked' : ''}> Ajouter l'attestation du client pour le taux réduit (logement achevé depuis plus de 2 ans)</label>`}
            <label class="champ">Conditions de paiement<textarea data-d="conditions" rows="2" maxlength="600">${esc(d.conditions)}</textarea></label>
            <div class="puces-conditions">${B.conditionsTypes.map((c, i) => `<button type="button" class="puce" data-action="condition" data-i="${i}">+ ${esc(c)}</button>`).join('')}</div>
            <label class="champ">Notes pour le client<textarea data-d="notes" rows="2" maxlength="1000">${esc(d.notes)}</textarea></label>
          </section>
        </div>
        <aside class="editeur-cote">
          <div class="carte-totaux">
            <h2>Totaux</h2>
            <div id="totaux">${blocTotaux(d)}</div>
            <div id="mentions-devis">${blocMentions(d)}</div>
            <button class="btn primaire" data-action="apercu" data-id="${d.id}" style="width:100%">Aperçu et impression</button>
          </div>
        </aside>
      </div>`;
  }

  // Mise à jour ciblée pendant la saisie (pas de nouveau rendu : le curseur reste en place).
  function majEdition() {
    const d = unDevis(devisOuvert);
    if (!d) return;
    const tt = totaux(d);
    const zone = $('#totaux');
    if (zone) zone.innerHTML = blocTotaux(d);
    const m = $('#mentions-devis');
    if (m) m.innerHTML = blocMentions(d);
    for (const [id, c] of Object.entries(tt.detail)) { const o = document.querySelector(`[data-montant="${id}"] b`); if (o) o.textContent = euros(c.net); }
    for (const [id, v] of Object.entries(tt.sections)) { const o = document.querySelector(`[data-st="${id}"]`); if (o) o.textContent = `${euros(v)} HT`; }
    const fin = document.querySelector('[data-fin]');
    if (fin) fin.textContent = fmtLong(R.finValidite(d));
  }

  // ---------- Vue : aperçu A4 ----------
  function feuille(d) {
    const e = E.entreprise;
    const tt = totaux(d);
    const franchise = tt.franchise;
    const avecRemise = d.lignes.some((l) => l.type === 'ligne' && l.remise);
    const nbCol = 5 + (avecRemise ? 1 : 0) + (franchise ? 0 : 1);
    const identite = e.forme === 'societe'
      ? `${esc(e.nom)}${e.formeJuridique ? `, ${esc(e.formeJuridique)}` : ''}${e.capital ? ` au capital de ${esc(e.capital)}` : ''}`
      : `${esc(e.nom)}${e.nom ? ' EI' : ''}`;
    const lignes = d.lignes.map((l) => {
      if (l.type === 'titre') return `<tr class="f-titre"><td colspan="${nbCol - 1}">${esc(l.designation)}</td><td class="n">${euros(tt.sections[l.id] || 0)}</td></tr>`;
      if (l.type === 'texte') return `<tr class="f-texte"><td colspan="${nbCol}">${multiligne(l.designation)}</td></tr>`;
      const c = tt.detail[l.id];
      return `<tr><td>${multiligne(l.designation)}</td><td class="n">${R.quantite(l.quantite)}</td><td>${esc(l.unite)}</td><td class="n">${euros(l.prixHT)}</td>${avecRemise ? `<td class="n">${l.remise ? R.pourcent(l.remise) : ''}</td>` : ''}${franchise ? '' : `<td class="n">${R.pourcent(l.tva)}</td>`}<td class="n">${euros(c.net)}</td></tr>`;
    }).join('');
    const mentions = [
      tt.acompte ? `<p><b>Acompte à la signature :</b> ${euros(tt.acompte)}${d.acompte.mode === 'pourcent' ? ` (${R.pourcent(d.acompte.valeur)} du total)` : ''}. Reste à payer : ${euros(tt.reste)}.</p>` : '',
      d.conditions ? `<p><b>Conditions de paiement :</b> ${multiligne(d.conditions)}</p>` : '',
      d.tauxHoraire ? `<p><b>Taux horaire de main-d'œuvre :</b> ${euros(d.tauxHoraire)} TTC${d.decompte ? `. Décompte du temps : ${esc(d.decompte)}` : ''}</p>` : (d.decompte ? `<p><b>Décompte du temps :</b> ${esc(d.decompte)}</p>` : ''),
      `<p><b>Devis ${d.payant ? 'payant' : 'gratuit'}</b>${d.payant && d.cout ? ` : ${euros(d.cout)} TTC` : ''}. Offre valable ${pluriel(d.validiteJours || 30, 'jour')}, jusqu'au ${fmtLong(R.finValidite(d))}.</p>`,
      franchise ? '<p><b>TVA non applicable - article 293 B du CGI</b></p>' : '',
      e.assuranceObligatoire ? `<p><b>Assurance professionnelle :</b> ${esc(e.assureur)}${e.assureurCoordonnees ? `, ${esc(e.assureurCoordonnees)}` : ''}${e.couverture ? `. Couverture géographique : ${esc(e.couverture)}` : ''}.</p>` : '',
      e.decennale ? '<p>Attestation d\'assurance de responsabilité décennale jointe au devis.</p>' : '',
      d.notes ? `<p>${multiligne(d.notes)}</p>` : '',
    ].join('');
    return `<article class="feuille" aria-label="Devis ${esc(d.numero)}">
      <header class="f-tete">
        <div class="f-emetteur">
          ${e.enseigne ? `<p class="f-nom">${esc(e.enseigne)}</p><p>${identite}</p>` : `<p class="f-nom">${identite || 'Ton entreprise'}</p>`}
          ${e.adresse ? `<p>${multiligne(e.adresse)}</p>` : ''}
          <p>${[e.telephone && `Tél. ${esc(e.telephone)}`, e.email && esc(e.email)].filter(Boolean).join(' · ')}</p>
          <p>${[e.siren && `SIREN ${esc(e.siren)}`, e.immatriculation && esc(e.immatriculation)].filter(Boolean).join(' · ')}</p>
          ${e.tvaIntra && !franchise ? `<p>TVA intracommunautaire ${esc(e.tvaIntra)}</p>` : ''}
        </div>
        <div class="f-doc">
          <p class="f-type">Devis</p>
          <p><b>N° ${esc(d.numero)}</b></p>
          <p>Date : ${fmtLong(d.date)}</p>
          <p>Valable jusqu'au : ${fmtLong(R.finValidite(d))}</p>
        </div>
      </header>
      <div class="f-parties">
        <div class="f-client"><p class="f-lib">Client</p><p><b>${esc(d.client?.nom || '')}</b></p>${d.client?.adresse ? `<p>${multiligne(d.client.adresse)}</p>` : ''}${d.client?.email ? `<p>${esc(d.client.email)}</p>` : ''}${d.client?.siren ? `<p>SIREN ${esc(d.client.siren)}</p>` : ''}</div>
        <div class="f-infos">
          ${d.objet ? `<p><span class="f-lib">Objet</span>${esc(d.objet)}</p>` : ''}
          ${d.lieu ? `<p><span class="f-lib">Lieu d'exécution</span>${esc(d.lieu)}</p>` : ''}
          ${d.debut || d.duree ? `<p><span class="f-lib">Calendrier</span>${d.debut ? `début prévu le ${fmtLong(d.debut)}` : ''}${d.debut && d.duree ? ', ' : ''}${d.duree ? `durée estimée ${esc(d.duree)}` : ''}</p>` : ''}
        </div>
      </div>
      <div class="f-defile"><table class="f-table">
        <thead><tr><th>Désignation</th><th class="n">Qté</th><th>Unité</th><th class="n">PU HT</th>${avecRemise ? '<th class="n">Remise</th>' : ''}${franchise ? '' : '<th class="n">TVA</th>'}<th class="n">Total HT</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="${nbCol}">Aucune ligne.</td></tr>`}</tbody>
      </table></div>
      <div class="f-bas">
        <div class="f-mentions">${mentions}</div>
        <div class="f-totaux">${blocTotaux(d)}</div>
      </div>
      ${d.attestationLogement && !franchise ? '<p class="f-attestation">Attestation du client (taux réduit de TVA) : je certifie que les travaux portent sur un local à usage d\'habitation achevé depuis plus de deux ans et que les conditions du taux réduit sont remplies. Document à conserver par le client.</p>' : ''}
      <div class="f-signatures">
        <div><p class="f-lib">L'entreprise</p></div>
        <div><p class="f-lib">Le client</p><p>Date et signature, précédées de la mention manuscrite « Bon pour accord »</p></div>
      </div>
      ${e.piedDePage ? `<footer class="f-pied">${multiligne(e.piedDePage)}</footer>` : ''}
    </article>`;
  }

  function vueApercu() {
    const d = unDevis(devisOuvert);
    const m = R.mentionsManquantes(E.entreprise, d);
    return `
      <div class="apercu-barre">
        <button class="btn" data-action="ouvrir" data-id="${d.id}">← Modifier</button>
        <button class="btn primaire" data-action="imprimer">Imprimer ou enregistrer en PDF</button>
        <p>Dans la fenêtre d'impression, choisis « Enregistrer au format PDF », format A4, sans en-têtes ni pieds de page du navigateur.</p>
      </div>
      ${m.length ? `<div class="mentions-ko apercu-alerte"><b>Avant d'envoyer, complète :</b><ul>${m.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${feuille(d)}`;
  }

  // ---------- Vue : catalogue ----------
  function vueCatalogue() {
    const q = rechercheCatalogue.trim().toLowerCase();
    const items = E.catalogue.filter((x) => !q || `${x.designation} ${x.categorie}`.toLowerCase().includes(q));
    const groupes = {};
    for (const x of items) (groupes[x.categorie || 'Sans catégorie'] ||= []).push(x);
    const sansPrix = E.catalogue.filter((x) => !x.prixHT).length;
    const blocs = Object.entries(groupes).sort(([a], [b]) => a.localeCompare(b)).map(([cat, liste]) => `
      <section class="groupe-cat">
        <h2>${esc(cat)} <span>${pluriel(liste.length, 'élément')}</span></h2>
        <ul class="liste-cat">${liste.sort((a, b) => a.designation.localeCompare(b.designation)).map((x) => `
          <li><button class="ligne-cat" data-action="catalogue-modifier" data-id="${x.id}">
            <span class="lc-des">${esc(x.designation)}</span>
            <span class="lc-unite">${esc(x.unite)}</span>
            <span class="lc-prix ${x.prixHT ? '' : 'sans'}">${x.prixHT ? `${euros(x.prixHT)} HT` : 'Prix à fixer'}</span>
            ${E.entreprise.franchise ? '' : `<span class="lc-tva">TVA ${R.pourcent(x.tva)}</span>`}
          </button></li>`).join('')}</ul>
      </section>`).join('');
    return `
      <div class="vue-tete"><div><h1>Catalogue</h1><p>Tes prestations et fournitures, avec leur unité et ton prix unitaire hors taxes. Dans un devis, « Depuis le catalogue » les ajoute en un clic.</p></div>
        <div class="actions"><button class="btn" data-action="catalogue-importer">Importer une liste type</button><button class="btn primaire" data-action="catalogue-nouveau">${ICONES.plus}Prestation</button></div></div>
      ${sansPrix ? `<p class="aide">${pluriel(sansPrix, 'prestation', 'prestations')} sans prix : les listes types n'en ont pas, chaque prix dépend de toi.</p>` : ''}
      ${E.catalogue.length ? `<label class="champ recherche" style="margin:16px 0"><span class="sr-only">Rechercher dans le catalogue</span><input type="search" id="recherche-catalogue" placeholder="Rechercher une prestation" value="${esc(rechercheCatalogue)}"></label>
        ${blocs || '<p class="vide-ligne">Aucune prestation ne correspond.</p>'}`
        : videEtat('Catalogue vide', 'Ajoute tes prestations une par une, ou importe la liste type de ton métier (sans prix).', `<button class="btn primaire" data-action="catalogue-importer">Importer une liste type</button><button class="btn" data-action="catalogue-nouveau">${ICONES.plus}Prestation</button>`)}`;
  }

  // ---------- Vue : clients ----------
  function vueClients() {
    const t = auj();
    const cartes = [...E.clients].sort((a, b) => a.nom.localeCompare(b.nom)).map((c) => {
      const ds = E.devis.filter((d) => d.clientId === c.id);
      const acceptes = ds.filter((d) => R.statutAffiche(d, t) === 'accepte');
      return `<article class="client">
        <div class="client-tete"><h2>${esc(c.nom)}</h2><span class="etiquette ${c.type === 'pro' ? 'bleu' : 'contour'}">${c.type === 'pro' ? 'Professionnel' : 'Particulier'}</span></div>
        <p class="client-adr">${multiligne(c.adresse) || '<span class="discret">Adresse non renseignée</span>'}</p>
        <p class="client-contact">${[c.email && esc(c.email), c.telephone && esc(c.telephone)].filter(Boolean).join(' · ') || '<span class="discret">Pas de contact</span>'}</p>
        <div class="client-chiffres"><div><b>${ds.length}</b><span>devis</span></div><div><b>${acceptes.length}</b><span>acceptés</span></div><div><b>${euros(acceptes.reduce((s, d) => s + totaux(d).totalHT, 0))}</b><span>accepté HT</span></div></div>
        <div class="client-pied"><button class="btn petit primaire" data-action="devis-pour" data-id="${c.id}">${ICONES.plus}Devis</button><button class="btn petit" data-action="client-modifier" data-id="${c.id}">Modifier</button></div>
      </article>`;
    }).join('');
    return `
      <div class="vue-tete"><div><h1>Clients</h1><p>Les coordonnées sont recopiées dans chaque devis à sa création : un devis déjà envoyé ne change pas si tu modifies la fiche.</p></div>
        <div class="actions"><button class="btn primaire" data-action="client-nouveau">${ICONES.plus}Client</button></div></div>
      <p class="aide">Données personnelles de tes clients : ne garde que ce qui sert à tes devis, et supprime la fiche d'un client sur sa demande ou quand elle n'est plus utile.</p>
      ${E.clients.length ? `<div class="clients">${cartes}</div>` : videEtat('Aucun client', 'Ajoute un client ici ou directement depuis un devis.', `<button class="btn primaire" data-action="client-nouveau">${ICONES.plus}Client</button>`)}`;
  }

  // ---------- Vue : entreprise ----------
  function vueEntreprise() {
    const e = E.entreprise;
    const champ = (cle, lib, aide = '', extra = '') => `<label class="champ">${lib}${aide ? `<small>${aide}</small>` : ''}<input data-e="${cle}" value="${esc(e[cle] ?? '')}" ${extra}></label>`;
    const zone = (cle, lib, aide = '') => `<label class="champ">${lib}${aide ? `<small>${aide}</small>` : ''}<textarea data-e="${cle}" rows="2" maxlength="600">${esc(e[cle] ?? '')}</textarea></label>`;
    const an = Number(auj().slice(0, 4));
    const suivant = R.prochainNumero(E.devis, e.prefixe, an, E.compteurs[an]).numero;
    const metier = B.metiers.find((m) => m.id === E.metier);
    return `
      <div class="vue-tete"><div><h1>Entreprise</h1><p>Ce qui apparaît en tête et en pied de chacun de tes devis. Enregistré à chaque modification.</p></div></div>
      <div class="sections-ent">
        <section class="bloc">
          <h2>Identité</h2>
          <fieldset class="champ choix-forme"><legend>Forme</legend>
            <label class="case"><input type="radio" name="forme" data-e="forme" value="ei" ${e.forme !== 'societe' ? 'checked' : ''}> Entreprise individuelle (dont micro-entreprise)</label>
            <label class="case"><input type="radio" name="forme" data-e="forme" value="societe" ${e.forme === 'societe' ? 'checked' : ''}> Société</label>
          </fieldset>
          <div class="grille-2">
            ${champ('nom', e.forme === 'societe' ? 'Dénomination sociale' : 'Prénom et nom', e.forme === 'societe' ? '' : 'Suivis de la mention « EI » sur le devis.', 'maxlength="80"')}
            ${champ('enseigne', 'Nom commercial', 'Facultatif.', 'maxlength="80"')}
            ${e.forme === 'societe' ? `${champ('formeJuridique', 'Forme juridique', 'SARL, SAS, EURL…', 'maxlength="40"')}${champ('capital', 'Capital social', 'Ex. : 5 000 €', 'maxlength="40"')}` : ''}
            ${champ('siren', 'SIREN', '9 chiffres.', 'maxlength="14" inputmode="numeric"')}
            ${champ('immatriculation', 'Immatriculation', 'Activité commerciale : « RCS » et ville du greffe ; artisanale, libérale ou agricole : numéro RNE.', 'maxlength="80"')}
          </div>
          ${zone('adresse', 'Adresse')}
          <div class="grille-2">
            ${champ('telephone', 'Téléphone', '', 'type="tel" maxlength="30"')}
            ${champ('email', 'E-mail', '', 'type="email" maxlength="120"')}
          </div>
        </section>
        <section class="bloc">
          <h2>TVA</h2>
          <label class="case"><input type="checkbox" data-e="franchise" ${e.franchise ? 'checked' : ''}> Franchise en base de TVA : aucune TVA sur mes devis</label>
          ${e.franchise ? '<p class="aide">Tes devis porteront la mention « TVA non applicable - article 293 B du CGI ». Les montants sont nets.</p>' : `
            ${champ('tvaIntra', 'N° de TVA intracommunautaire', 'Facultatif sur un devis.', 'maxlength="20"')}
            <h3 class="sous-titre">Taux proposés dans les lignes</h3>
            <p class="aide-champ">Taux en vigueur relevés le ${fmtLong(B.consulteLe)} (impots.gouv.fr, economie.gouv.fr ; outre-mer : taux différents). Modifie-les si la loi change ou selon ta situation : le premier est le taux par défaut.</p>
            <ul class="taux-liste">${E.tva.map((t, i) => `<li>
              <label class="champ"><span class="sr-only">Taux ${i + 1} (%)</span><input data-tva="taux" data-i="${i}" value="${R.saisiePourcent(t.taux)}" inputmode="decimal" aria-label="Taux en %"></label><span class="pct">%</span>
              <label class="champ"><span class="sr-only">Libellé du taux ${i + 1}</span><input data-tva="libelle" data-i="${i}" value="${esc(t.libelle)}" maxlength="80" aria-label="Libellé"></label>
              <button class="mini danger" data-action="tva-suppr" data-i="${i}" aria-label="Retirer ce taux" ${E.tva.length < 2 ? 'disabled' : ''}>×</button></li>`).join('')}</ul>
            <div class="rang"><button class="btn petit" data-action="tva-ajout">${ICONES.plus}Taux</button><button class="btn petit lien" data-action="tva-reinit">Revenir aux taux de la base</button></div>
            <p class="aide">Travaux dans un logement : 10 % ou 5,5 % seulement si le logement est achevé depuis plus de 2 ans et que le client l'atteste (voir Mentions). En cas de doute, renseigne-toi auprès de ton service des impôts ou de ton expert-comptable.</p>`}
        </section>
        <section class="bloc">
          <h2>Assurance professionnelle</h2>
          <label class="case"><input type="checkbox" data-e="assuranceObligatoire" ${e.assuranceObligatoire ? 'checked' : ''}> Mon métier impose une assurance professionnelle : je l'indique sur mes devis</label>
          ${e.assuranceObligatoire ? `<div class="grille-2">${champ('assureur', 'Assureur ou garant', '', 'maxlength="120"')}${champ('couverture', 'Couverture géographique', 'Ex. : France métropolitaine.', 'maxlength="120"')}</div>${zone('assureurCoordonnees', 'Coordonnées de l\'assureur ou du garant')}` : ''}
          <label class="case"><input type="checkbox" data-e="decennale" ${e.decennale ? 'checked' : ''}> Je joins l'attestation d'assurance décennale à mes devis</label>
          <p class="aide-champ">Entreprises du secteur des métiers et de l'artisanat : mention obligatoire quand l'assurance est obligatoire pour le métier (code de l'artisanat, art. L132-1). Travaux soumis à l'assurance décennale : l'attestation est jointe aux devis et factures (code des assurances, art. L243-2).${metier?.batiment ? ` Ton métier (${esc(metier.nom)}) relève du bâtiment : vérifie ce qui s'applique à tes travaux.` : ''}</p>
        </section>
        <section class="bloc">
          <h2>Numérotation et valeurs par défaut</h2>
          <div class="grille-2">
            ${champ('prefixe', 'Préfixe des numéros', `Prochain numéro : <b data-suivant>${esc(suivant)}</b>`, 'maxlength="6" autocapitalize="characters"')}
            <label class="champ">Validité des devis (jours)<input data-e="validiteJours" data-type="entier" type="number" min="1" max="365" value="${e.validiteJours}"></label>
            <label class="champ">Acompte par défaut (% du total)<small>0 pour aucun.</small><input data-e="acompteDefaut" data-type="pourcent" value="${R.saisiePourcent(e.acompteDefaut || 0)}" inputmode="decimal"></label>
            <label class="champ">Taux horaire de main-d'œuvre TTC (€)<small>Repris dans chaque nouveau devis.</small><input data-e="tauxHoraire" data-type="montant" value="${e.tauxHoraire ? R.saisieMontant(e.tauxHoraire) : ''}" inputmode="decimal"></label>
          </div>
          ${champ('decompte', 'Modalités de décompte du temps', '', 'maxlength="200"')}
          ${zone('conditions', 'Conditions de paiement', 'Reprises dans chaque nouveau devis.')}
          ${zone('piedDePage', 'Pied de page', 'Coordonnées bancaires, site, mentions propres à ton activité…')}
        </section>
      </div>`;
  }

  // ---------- Vue : mentions et sources ----------
  function vueMentions() {
    const src = (code) => code.split(' · ').map((c) => { const s = B.sources.find((x) => x.code === c); return s ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.code)}</a>` : esc(c); }).join(' · ');
    return `
      <div class="vue-tete"><div><h1>Mentions et sources</h1><p>Ce que prévoient les textes pour un devis, relevé sur les sites officiels le ${fmtLong(B.consulteLe)}. Liste d'aide, pas un conseil juridique : selon ton secteur, d'autres mentions peuvent s'imposer.</p></div></div>
      <div class="avertissements">
        <p><b>Outil d'aide, pas un conseil.</b> Tu restes responsable du contenu de tes devis, des taux de TVA appliqués et des mentions propres à ton activité. En cas de doute, demande à ton expert-comptable, ta chambre de métiers ou ton organisation professionnelle.</p>
        <p><b>Des devis, pas des factures.</b> Le générateur ne produit aucune facture : la facturation électronique devient obligatoire pour les entreprises (déploiement progressif, calendrier sur impots.gouv.fr). Facture avec un outil prévu pour cela.</p>
        <p><b>Données de tes clients.</b> Elles sont hébergées en ligne pour te suivre sur tes appareils. Ne garde que le nécessaire et supprime ce qui ne sert plus.</p>
      </div>
      <div class="mentions">${B.mentions.map((m, i) => `
        <article class="mention-carte" style="--c:${['var(--rouge)', 'var(--bleu)', 'var(--jaune)', 'var(--encre)', 'var(--rouge)'][i % 5]};--t:${i % 5 === 2 ? 'var(--encre)' : '#fff'}">
          <div class="mention-tete"><h2>${esc(m.titre)}</h2></div>
          <ul>${m.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          <p class="mention-source">Source : ${src(m.source)}</p>
        </article>`).join('')}</div>
      <h2 class="titre-section">Taux de TVA <span>France métropolitaine</span></h2>
      <div class="defile"><table class="tableau"><thead><tr><th>Taux</th><th>Usage (exemples)</th></tr></thead><tbody>
        <tr><td class="nb">20 %</td><td>Taux normal : la majorité des biens et des services</td></tr>
        <tr><td class="nb">10 %</td><td>Notamment travaux d'amélioration, de transformation, d'aménagement ou d'entretien d'un logement achevé depuis plus de 2 ans</td></tr>
        <tr><td class="nb">5,5 %</td><td>Notamment travaux de rénovation énergétique d'un logement achevé depuis plus de 2 ans</td></tr>
        <tr><td class="nb">2,1 %</td><td>Taux particulier (notamment médicaments remboursables, publications de presse)</td></tr>
      </tbody></table></div>
      <p class="aide-champ" style="margin-top:10px">Guadeloupe, Martinique et La Réunion : taux normal 8,5 %, taux réduit 2,1 % ; Guyane et Mayotte : TVA provisoirement non applicable (impots.gouv.fr, page modifiée le 13/10/2026). Adapte les taux dans l'onglet Entreprise.</p>
      <h2 class="titre-section">Sources officielles <span>consultées le ${fmtLong(B.consulteLe)}</span></h2>
      <ul class="sources">${B.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.nom)}</a><span>${esc(s.site)}${s.verifie ? ` · ${esc(s.verifie)}` : ''}</span></li>`).join('')}</ul>`;
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

  function modaleNouveauDevis(clientId = null) {
    const corps = `
      <label class="champ">Client<select name="client"><option value="">Choisir plus tard</option>${E.clients.map((c) => `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}<option value="__nouveau">+ Nouveau client…</option></select></label>
      <label class="champ">Objet<small>Nature des travaux ou de la prestation.</small><input name="objet" maxlength="160" placeholder="Ex. : Peinture du séjour"></label>
      <p class="aide">Numéro attribué : <b>${esc(R.prochainNumero(E.devis, E.entreprise.prefixe, Number(auj().slice(0, 4)), E.compteurs[auj().slice(0, 4)]).numero)}</b>. Validité ${pluriel(E.entreprise.validiteJours || 30, 'jour')}, modifiable.</p>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Nouveau devis', corps, '<button class="btn primaire" value="ok">Créer le devis</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const c = f.get('client');
      if (c === '__nouveau') { setTimeout(() => modaleClient(null, { objet: String(f.get('objet') || '').trim() }), 0); return; }
      const d = creerDevis(c || null, String(f.get('objet') || '').trim());
      sauver();
      changerVue('edition', d.id);
      toast(`Devis ${d.numero} créé.`);
    });
  }

  function modaleClient(id, suite = null) {
    const c = id ? unClient(id) : null;
    const corps = `
      <label class="champ">Nom ou raison sociale<input name="nom" required maxlength="120" value="${esc(c?.nom || '')}"></label>
      <fieldset class="champ choix-forme"><legend>Type</legend>
        <label class="case"><input type="radio" name="type" value="particulier" ${c?.type !== 'pro' ? 'checked' : ''}> Particulier</label>
        <label class="case"><input type="radio" name="type" value="pro" ${c?.type === 'pro' ? 'checked' : ''}> Professionnel</label>
      </fieldset>
      <label class="champ">Adresse<textarea name="adresse" rows="2" maxlength="300">${esc(c?.adresse || '')}</textarea></label>
      <div class="grille-2">
        <label class="champ">E-mail<input name="email" type="email" maxlength="120" value="${esc(c?.email || '')}"></label>
        <label class="champ">Téléphone<input name="telephone" type="tel" maxlength="30" value="${esc(c?.telephone || '')}"></label>
      </div>
      <label class="champ">SIREN<small>Client professionnel, facultatif.</small><input name="siren" maxlength="20" inputmode="numeric" value="${esc(c?.siren || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    const nb = c ? E.devis.filter((d) => d.clientId === c.id).length : 0;
    const pied = c ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(c ? 'Modifier le client' : 'Nouveau client', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        if (!confirm(`Supprimer la fiche « ${c.nom} » ?${nb ? ` Ses ${pluriel(nb, 'devis')} gardent les coordonnées recopiées.` : ''}`)) return '';
        memoriserAnnulation();
        E.clients = E.clients.filter((x) => x.id !== c.id);
        E.devis.forEach((d) => { if (d.clientId === c.id) d.clientId = null; });
        sauver(); rendre(); toast(`Fiche « ${c.nom} » supprimée.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const v = Object.fromEntries(['nom', 'type', 'adresse', 'email', 'telephone', 'siren'].map((k) => [k, String(f.get(k) || '').trim()]));
      if (!v.nom) return 'Indique le nom du client.';
      if (c) { Object.assign(c, v); sauver(); rendre(); toast('Client enregistré.'); return; }
      const nouveau = { id: uid(), ...v };
      E.clients.push(nouveau);
      // Depuis un devis ouvert : le client lui est attribué ; depuis « Nouveau devis » : le devis est créé.
      if (suite?.pour) { const d = unDevis(suite.pour); if (d) { d.clientId = nouveau.id; d.client = copieClient(nouveau); } sauver(); rendre(); toast(`« ${v.nom} » ajouté au devis.`); return; }
      if (suite) { const d = creerDevis(nouveau.id, suite.objet || ''); sauver(); changerVue('edition', d.id); toast(`Devis ${d.numero} créé pour « ${v.nom} ».`); return; }
      sauver(); rendre(); toast(`« ${v.nom} » ajouté.`);
    });
  }

  function modaleCatalogue(id) {
    const x = id ? E.catalogue.find((c) => c.id === id) : null;
    const categories = [...new Set([...E.catalogue.map((c) => c.categorie).filter(Boolean), ...B.metiers.map((m) => m.nom)])];
    const corps = `
      <label class="champ">Désignation<input name="designation" required maxlength="200" value="${esc(x?.designation || '')}"></label>
      <div class="grille-2">
        <label class="champ">Unité<input name="unite" list="unites-cat" maxlength="12" value="${esc(x?.unite || 'u')}"></label>
        <label class="champ">Prix unitaire HT (€)<input name="prix" inputmode="decimal" value="${x?.prixHT ? R.saisieMontant(x.prixHT) : ''}" placeholder="0,00"></label>
      </div>
      <datalist id="unites-cat">${B.unites.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
      ${E.entreprise.franchise ? '' : `<label class="champ">TVA par défaut<select name="tva">${optionsTva(x?.tva ?? tvaDefaut())}</select></label>`}
      <label class="champ">Catégorie<input name="categorie" list="categories" maxlength="60" value="${esc(x?.categorie || '')}"></label>
      <datalist id="categories">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      <p class="erreur" role="alert"></p>`;
    const pied = x ? '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn danger gauche" value="supprimer">Supprimer</button>'
      : '<button class="btn primaire" value="ok">Ajouter</button><button class="btn" value="annuler">Annuler</button>';
    ouvrirModale(x ? 'Modifier la prestation' : 'Nouvelle prestation', corps, pied, (f, action) => {
      if (action === 'supprimer') {
        memoriserAnnulation();
        E.catalogue = E.catalogue.filter((c) => c.id !== x.id);
        sauver(); rendre(); toast(`« ${x.designation} » retiré du catalogue.`, { libelle: 'Annuler', faire: annuler });
        return;
      }
      const designation = String(f.get('designation') || '').trim();
      if (!designation) return 'Indique la désignation.';
      const prix = String(f.get('prix') || '').trim() ? R.lireMontant(f.get('prix')) : 0;
      if (prix === null || prix < 0) return 'Prix : un montant positif, par exemple 45,50.';
      const v = { designation, unite: String(f.get('unite') || '').trim(), prixHT: prix, tva: f.has('tva') ? Number(f.get('tva')) : (x?.tva ?? tvaDefaut()), categorie: String(f.get('categorie') || '').trim() };
      if (x) Object.assign(x, v); else E.catalogue.push({ id: uid(), ...v });
      sauver(); rendre(); toast(x ? 'Prestation enregistrée.' : `« ${designation} » ajouté.`);
    });
  }

  function modaleImport() {
    const corps = `
      <p>Ajoute à ton catalogue les prestations types d'un métier, <b>sans prix</b>. Celles déjà présentes ne sont pas dupliquées.</p>
      <label class="champ">Métier<select name="metier">${B.metiers.map((m) => `<option value="${m.id}" ${m.id === E.metier ? 'selected' : ''}>${esc(m.nom)} (${m.lignes.length})</option>`).join('')}</select></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Importer une liste type', corps, '<button class="btn primaire" value="ok">Importer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const m = B.metiers.find((x) => x.id === f.get('metier'));
      memoriserAnnulation();
      const n = importerMetier(m);
      sauver(); rendre();
      toast(n ? `${pluriel(n, 'prestation ajoutée', 'prestations ajoutées')} (${m.nom}).` : 'Ces prestations sont déjà dans ton catalogue.', n ? { libelle: 'Annuler', faire: annuler } : null);
    });
  }

  function modaleAjoutCatalogue() {
    if (!E.catalogue.length) { toast('Ton catalogue est vide : ajoute une ligne vide ou remplis le catalogue.'); return; }
    const liste = (q) => {
      const items = E.catalogue.filter((x) => !q || `${x.designation} ${x.categorie}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => (a.categorie || '').localeCompare(b.categorie || '') || a.designation.localeCompare(b.designation));
      return items.length ? items.map((x) => `<li><button type="button" class="choix-cat" data-action="ajout-depuis" data-id="${x.id}"><span><b>${esc(x.designation)}</b><small>${esc(x.categorie || '')}</small></span><span>${x.prixHT ? euros(x.prixHT) : 'sans prix'} / ${esc(x.unite)}</span></button></li>`).join('') : '<li class="vide-ligne">Aucun résultat.</li>';
    };
    ouvrirModale('Ajouter depuis le catalogue', `
      <label class="champ"><span class="sr-only">Rechercher</span><input type="search" id="cherche-cat" placeholder="Rechercher une prestation" autocomplete="off"></label>
      <ul class="choix-liste" id="choix-liste">${liste('')}</ul>
      <p class="aide-champ">Chaque clic ajoute une ligne au devis. Quantité 1, à ajuster ensuite.</p>`,
    '<button class="btn primaire" value="annuler">Terminé</button>');
    $('#cherche-cat').addEventListener('input', (e) => { $('#choix-liste').innerHTML = liste(e.target.value.trim()); });
    $('#cherche-cat').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  }

  function modaleReglages() {
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const corps = `
      <div class="groupe" style="border-top:0;padding-top:0"><h3>Sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Tes devis sont enregistrés en ligne avec ta clé. Tu peux aussi garder une copie sur ton ordinateur.'}</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>À propos</h3><p class="aide-champ">Générateur de devis QME. Taux et mentions relevés le ${fmtLong(B.consulteLe)} : voir l'onglet Mentions.</p></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.devis) || !d.entreprise) throw new Error();
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.devis.length, 'devis')}, ${pluriel((d.clients || []).length, 'client')}) ?`)) return;
        E = normaliser(d); delete E.majLe;
        modale().close(); sauver(); rendre(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide du générateur de devis.'); }
    });
  }

  function exporter() {
    const blob = new Blob([JSON.stringify(E, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devis-${auj()}.json`;
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
    if (el.type === 'checkbox') return el.checked;
    if (type === 'montant') return el.value.trim() ? R.lireMontant(el.value) : 0;
    if (type === 'pourcent') return el.value.trim() ? R.lirePourcent(el.value) : 0;
    if (type === 'quantite') return el.value.trim() ? R.lireQuantite(el.value) : 0;
    if (type === 'taux') return Number(el.value);
    if (type === 'entier') { const n = Number(el.value); return Number.isInteger(n) && n > 0 && n <= 365 ? n : null; }
    return el.value;
  }
  const affecter = (objet, chemin, v) => { const k = chemin.split('.'); const fin = k.pop(); let o = objet; for (const x of k) o = (o[x] ||= {}); o[fin] = v; };

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'recherche') { recherche = el.value; const pos = el.selectionStart; rendre(); const n = $('#recherche'); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (el.id === 'recherche-catalogue') { rechercheCatalogue = el.value; const pos = el.selectionStart; rendre(); const n = $('#recherche-catalogue'); n.focus(); n.setSelectionRange(pos, pos); return; }
    if (!E) return;
    if (el.dataset.l) {
      const d = unDevis(devisOuvert);
      const l = d?.lignes.find((x) => x.id === el.dataset.id);
      if (!l) return;
      const v = lireValeur(el);
      const invalide = v === null || (el.dataset.l === 'remise' && (v < 0 || v > 10000));
      el.classList.toggle('invalide', invalide);
      if (invalide) return;
      l[el.dataset.l] = v;
      if (el.tagName === 'TEXTAREA' && el.rows === 1) ajusterHauteur(el);
      sauver(); majEdition();
      return;
    }
    if (el.dataset.d) {
      const d = unDevis(devisOuvert);
      if (!d) return;
      const cle = el.dataset.d;
      if (cle === 'remise.mode' || cle === 'acompte.mode' || cle === 'payant' || el.tagName === 'SELECT') return; // traités au « change »
      const v = lireValeur(el);
      const invalide = v === null || (cle === 'date' && !v) || (el.dataset.type === 'montant' && v < 0) || (el.dataset.type === 'pourcent' && (v < 0 || v > 10000));
      el.classList.toggle('invalide', invalide);
      if (invalide) return;
      affecter(d, cle, v);
      sauver(); majEdition();
      return;
    }
    if (el.dataset.e) {
      const cle = el.dataset.e;
      if (el.type === 'checkbox' || el.type === 'radio') return; // au « change »
      const v = lireValeur(el);
      const invalide = v === null || (el.dataset.type === 'pourcent' && (v < 0 || v > 10000)) || (el.dataset.type === 'montant' && v < 0);
      el.classList.toggle('invalide', invalide);
      if (invalide) return;
      E.entreprise[cle] = cle === 'prefixe' ? R.nettoyerPrefixe(v) : v;
      if (cle === 'prefixe') { const an = Number(auj().slice(0, 4)); const s = $('[data-suivant]'); if (s) s.textContent = R.prochainNumero(E.devis, E.entreprise.prefixe, an, E.compteurs[an]).numero; }
      sauver();
      return;
    }
    if (el.dataset.tva) {
      const t = E.tva[Number(el.dataset.i)];
      if (!t) return;
      if (el.dataset.tva === 'taux') {
        const v = R.lirePourcent(el.value);
        const invalide = v === null || v < 0 || v > 10000;
        el.classList.toggle('invalide', invalide);
        if (invalide) return;
        t.taux = v;
      } else t.libelle = el.value;
      sauver();
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!E) return;
    if (el.dataset.actionChange === 'choisir-client') {
      const d = unDevis(devisOuvert);
      const c = unClient(el.value);
      d.clientId = c?.id || null;
      if (c) d.client = copieClient(c);
      sauver(); rendre();
      return;
    }
    if (el.dataset.l) {
      const d = unDevis(devisOuvert);
      const l = d?.lignes.find((x) => x.id === el.dataset.id);
      if (!l) return;
      if (el.tagName === 'SELECT') { l[el.dataset.l] = lireValeur(el); sauver(); majEdition(); return; }
      // Remet la valeur au propre en quittant le champ.
      if (el.dataset.type === 'quantite') el.value = R.saisieQuantite(l.quantite);
      if (el.dataset.type === 'montant') el.value = R.saisieMontant(l.prixHT);
      if (el.dataset.type === 'pourcent') el.value = l.remise ? R.saisiePourcent(l.remise) : '';
      el.classList.remove('invalide');
      return;
    }
    if (el.dataset.d) {
      const d = unDevis(devisOuvert);
      const cle = el.dataset.d;
      if (cle === 'remise.mode' || cle === 'acompte.mode') { affecter(d, cle, el.value); affecter(d, cle.replace('mode', 'valeur'), 0); sauver(); rendre(); return; }
      if (el.type === 'checkbox') { d[cle] = el.checked; sauver(); if (cle === 'payant') rendre(); else majEdition(); return; }
      if (el.classList.contains('invalide')) { toast('Valeur non reconnue : la précédente est gardée.'); }
      return;
    }
    if (el.dataset.e) {
      const cle = el.dataset.e;
      if (el.type === 'radio') { E.entreprise[cle] = el.value; sauver(); rendre(); return; }
      if (el.type === 'checkbox') {
        E.entreprise[cle] = el.checked;
        if (cle === 'franchise') toast(el.checked ? 'Franchise en base : tes devis n\'affichent plus de TVA.' : 'TVA réactivée sur tes devis.');
        sauver(); rendre(); return;
      }
      if (cle === 'prefixe') el.value = E.entreprise.prefixe;
    }
  });

  function ajusterHauteur(el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 4}px`; }

  // ---------- Actions ----------
  function actionLigne(action, id) {
    const d = unDevis(devisOuvert);
    const i = d.lignes.findIndex((l) => l.id === id);
    if (i < 0) return;
    if (action === 'ligne-haut' && i > 0) [d.lignes[i - 1], d.lignes[i]] = [d.lignes[i], d.lignes[i - 1]];
    if (action === 'ligne-bas' && i < d.lignes.length - 1) [d.lignes[i + 1], d.lignes[i]] = [d.lignes[i], d.lignes[i + 1]];
    if (action === 'ligne-dup') d.lignes.splice(i + 1, 0, { ...d.lignes[i], id: uid() });
    if (action === 'ligne-suppr') {
      memoriserAnnulation();
      const l = d.lignes[i];
      d.lignes.splice(i, 1);
      sauver(); rendre();
      toast(`Ligne « ${(l.designation || 'sans titre').slice(0, 40)} » supprimée.`, { libelle: 'Annuler', faire: annuler });
      return;
    }
    sauver(); rendre();
    const cible = document.querySelector(`[data-action="${action}"][data-id="${action === 'ligne-dup' ? d.lignes[i + 1].id : id}"]`);
    cible?.focus({ preventScroll: false });
  }

  function ajouterLigne(type, depuis = null) {
    const d = unDevis(devisOuvert);
    const l = nouvelleLigne(type, depuis);
    d.lignes.push(l);
    sauver(); rendre();
    return l;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); E = donneesDemo(); cache(); vue = 'devis'; changerVue('devis'); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(); break;
      case 'metier': accueil.metier = id; ecranAccueil(); break;
      case 'accueil-suivant': accueil.etape = 2; ecranAccueil(); window.scrollTo({ top: 0 }); break;
      case 'accueil-retour': accueil.etape = 1; ecranAccueil(); break;
      case 'accueil-fin': {
        const f = $('#form-accueil');
        if (f) { const d = new FormData(f); Object.assign(accueil, { nom: d.get('nom') || '', enseigne: d.get('enseigne') || '', forme: d.get('forme') || 'ei', franchise: d.has('franchise'), importer: d.has('importer') }); }
        terminerAccueil(); break;
      }
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(); break;
      case 'fermer': modale().close(); break;
      case 'filtre': filtre = id; rendre(); break;
      case 'devis-nouveau': modaleNouveauDevis(); break;
      case 'devis-pour': modaleNouveauDevis(id); break;
      case 'ouvrir': changerVue('edition', id); break;
      case 'apercu': changerVue('apercu', id); break;
      case 'imprimer': window.print(); break;
      case 'dupliquer': { const c = dupliquerDevis(id); sauver(); changerVue('edition', c.id); toast(`Copie créée : devis ${c.numero} (brouillon).`); break; }
      case 'devis-suppr': {
        const d = unDevis(id);
        if (!confirm(`Supprimer le devis ${d.numero} ? Son numéro ne sera pas réattribué.`)) break;
        memoriserAnnulation();
        E.devis = E.devis.filter((x) => x.id !== id);
        sauver(); changerVue('devis');
        toast(`Devis ${d.numero} supprimé.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'statut': {
        const i = E.devis.findIndex((x) => x.id === id);
        const avant = E.devis[i].statut;
        if (avant === el.dataset.statut) break;
        memoriserAnnulation();
        E.devis[i] = R.changerStatut(E.devis[i], el.dataset.statut, auj());
        sauver(); rendre();
        toast(`Devis ${E.devis[i].numero} : ${STATUTS[el.dataset.statut][0].toLowerCase()}.`, { libelle: 'Annuler', faire: annuler });
        break;
      }
      case 'ligne-haut': case 'ligne-bas': case 'ligne-dup': case 'ligne-suppr': actionLigne(action, id); break;
      case 'ligne-ajout': { const l = ajouterLigne(el.dataset.type); document.querySelector(`[data-l="designation"][data-id="${l.id}"]`)?.focus(); break; }
      case 'ligne-catalogue': modaleAjoutCatalogue(); break;
      case 'ajout-depuis': {
        const x = E.catalogue.find((c) => c.id === id);
        if (!x) break;
        const l = nouvelleLigne('ligne', x);
        unDevis(devisOuvert).lignes.push(l);
        sauver(); majApresAjout();
        el.classList.add('ajoute');
        toast(`« ${x.designation} » ajouté au devis.`);
        break;
      }
      case 'condition': {
        const d = unDevis(devisOuvert);
        const c = B.conditionsTypes[Number(el.dataset.i)];
        d.conditions = d.conditions ? `${d.conditions.trim()} ${c}` : c;
        sauver();
        const z = document.querySelector('[data-d="conditions"]'); if (z) z.value = d.conditions;
        break;
      }
      case 'client-nouveau': modaleClient(null, el.dataset.pour ? { pour: el.dataset.pour } : null); break;
      case 'client-modifier': modaleClient(id); break;
      case 'catalogue-nouveau': modaleCatalogue(); break;
      case 'catalogue-modifier': modaleCatalogue(id); break;
      case 'catalogue-importer': modaleImport(); break;
      case 'tva-ajout': E.tva.push({ taux: 0, libelle: 'Nouveau taux' }); sauver(); rendre(); break;
      case 'tva-suppr': if (E.tva.length > 1) { memoriserAnnulation(); E.tva.splice(Number(el.dataset.i), 1); sauver(); rendre(); toast('Taux retiré de la liste (les lignes existantes le gardent).', { libelle: 'Annuler', faire: annuler }); } break;
      case 'tva-reinit': if (confirm('Remplacer ta liste de taux par celle de la base ?')) { E.tva = B.tva.map((t) => ({ ...t })); sauver(); rendre(); } break;
      default: break;
    }
  });

  // Après un ajout depuis la modale du catalogue : la page derrière est mise à jour, la modale reste ouverte.
  function majApresAjout() {
    const y = window.scrollY;
    rendre();
    window.scrollTo({ top: y });
  }

  // Fermer la modale en cliquant sur le fond.
  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
  });
  window.addEventListener('beforeunload', (e) => { if (etatSync === 'attente' || etatSync === 'envoi') { envoyer(); e.preventDefault(); } });
  window.addEventListener('hashchange', () => { if (!E) return; lireHash(); rendre(); });

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
  window.__devis = { etat: () => E, totaux: (id) => totaux(unDevis(id)) };
  init();
})();
