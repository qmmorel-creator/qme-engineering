// Dossier sinistre habitation QME : déclaration guidée, inventaire chiffré, preuves, chronologie, rapport.
// Données synchronisées par clé de licence (socle commun des templates QME). Photos et documents :
// gardés sur l'appareil (IndexedDB), jamais envoyés au serveur.
(() => {
  'use strict';
  const B = window.BASE;
  const R = window.REGLES;
  const API = '/api/templates';
  const PRODUIT = 'SNH';
  const CLE_CODE = 'qme-snh-code';
  const CLE_CACHE = 'qme-snh-cache';
  const CLE_DEMO = 'qme-snh-demo';
  const CODE_DEMO = 'DEMO';
  const CLE_ACCUEIL = 'qme-snh-ecran-accueil';
  const TAILLE_MAX = 900000;
  const NOM = 'Dossier sinistre habitation';

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
  const { ajout, ecart, versDate, nombre } = R;
  const auj = () => R.iso(new Date());
  const fmt = (s, o = { day: 'numeric', month: 'short', year: 'numeric' }) => (s ? versDate(s).toLocaleDateString('fr-FR', o) : '–');
  const fmtCourt = (s) => (s ? R.dateFr(s) : '–');
  const eur = (v) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 }));
  const quand = (s) => {
    const n = ecart(auj(), s);
    if (n === 0) return 'aujourd\'hui';
    if (n === 1) return 'demain';
    if (n === -1) return 'hier';
    if (n > 1 && n < 7) return `dans ${n} jours`;
    if (n < -1 && n > -7) return `il y a ${-n} jours`;
    return `le ${fmt(s, s.slice(0, 4) === auj().slice(0, 4) ? { day: 'numeric', month: 'short' } : undefined)}`;
  };
  const nomCat = (c) => B.categories.find((x) => x.code === c)?.nom || 'Autre';
  const nomStatut = (c) => (B.statuts.find(([k]) => k === c) || [c, c])[1];
  const couleurStatut = (c) => (B.statuts.find(([k]) => k === c) || [c, c, 'gris'])[2];
  const nomStatutPreuve = (c) => (B.statutsPreuve.find(([k]) => k === c) || [c, c])[1];
  const nomTypePreuve = (c) => (B.typesPreuve.find(([k]) => k === c) || [c, c])[1];
  const COULEUR_PREUVE = { 'a-fournir': 'jaune', recu: 'bleu', verifie: 'vert', manquant: 'rouge', refuse: 'rouge' };

  // ---------- État ----------
  let E = null;
  const session = { code: null, jeton: null, demo: false, base: null, memoriser: true };
  let vue = 'dossier';
  let annulation = null;
  const filtre = { texte: '', piece: '', categorie: '', preuve: '' };
  let docChoix = 'rapport';
  let courrierChoix = 'declaration';

  const dossier = () => E.dossiers.find((d) => d.id === E.actif) || E.dossiers[0] || null;
  const dommage = (id) => dossier()?.dommages.find((x) => x.id === id);
  const preuve = (id) => dossier()?.preuves.find((x) => x.id === id);
  const evenement = (id) => dossier()?.evenements.find((x) => x.id === id);
  const titreDossier = (d) => d.titre || `${R.typeDe(d.type).nom}${d.survenu ? ` du ${fmtCourt(d.survenu)}` : ''}`;

  // ---------- Photos et documents sur l'appareil (IndexedDB, jamais synchronisés) ----------
  const Photos = (() => {
    let base = null;
    const ouvrir = () => base || (base = new Promise((ok, ko) => {
      if (!('indexedDB' in window)) { ko(new Error('indisponible')); return; }
      const r = indexedDB.open('qme-snh-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    }));
    const espace = () => (session.demo ? 'demo' : String(session.jeton || 'local'));
    const tx = async (mode, f) => { const db = await ouvrir(); return new Promise((ok, ko) => { const t = db.transaction('photos', mode); const st = t.objectStore('photos'); const r = f(st); t.oncomplete = () => ok(r?.result); t.onerror = () => ko(t.error); }); };
    const urls = new Map();
    return {
      async ajouter(blob, nom, id = uid()) { await tx('readwrite', (st) => st.put({ blob, nom, type: blob.type, taille: blob.size, cree: new Date().toISOString() }, `${espace()}/${id}`)); return id; },
      async lire(id) { try { return await tx('readonly', (st) => st.get(`${espace()}/${id}`)) || null; } catch { return null; } },
      async supprimer(id) { urls.delete(id); try { await tx('readwrite', (st) => st.delete(`${espace()}/${id}`)); } catch { /* rien */ } },
      async lister() { try { const cles = await tx('readonly', (st) => st.getAllKeys()); return (cles || []).filter((k) => k.startsWith(`${espace()}/`)).map((k) => k.slice(espace().length + 1)); } catch { return []; } },
      async poids() { let t = 0; for (const id of await this.lister()) t += (await this.lire(id))?.taille || 0; return t; },
      async vider() { for (const id of await this.lister()) await this.supprimer(id); },
      async url(id) {
        if (urls.has(id)) return urls.get(id);
        const p = await this.lire(id);
        if (!p) return null;
        const u = URL.createObjectURL(p.blob);
        urls.set(id, u);
        return u;
      },
      oublierUrls() { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); },
    };
  })();

  // Réduit une image (côté 1600 px, JPEG 80 %) ; un PDF est gardé tel quel.
  async function preparerFichier(fichier) {
    if (fichier.type === 'application/pdf') {
      if (fichier.size > 10e6) throw new Error('PDF trop lourd (10 Mo au plus).');
      return fichier;
    }
    if (!fichier.type.startsWith('image/')) throw new Error('Format non pris en charge : photo ou PDF.');
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Image illisible.')); i.src = URL.createObjectURL(fichier); });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    return new Promise((ok) => c.toBlob((b) => ok(b || fichier), 'image/jpeg', 0.8));
  }

  // Remplit les vignettes [data-photo] d'un conteneur ; renvoie quand toutes les images sont prêtes.
  async function hydrater(racine = document) {
    const attentes = [];
    for (const el of racine.querySelectorAll('[data-photo]')) {
      const id = el.dataset.photo;
      const p = await Photos.lire(id);
      if (!p) { el.classList.add('absente'); el.innerHTML = '<span>Sur un autre appareil</span>'; continue; }
      const u = await Photos.url(id);
      if (p.type === 'application/pdf') { el.classList.add('pdf'); el.innerHTML = `<a href="${u}" target="_blank" rel="noopener"><b>PDF</b><span>${esc(p.nom || 'Document')}</span></a>`; continue; }
      const img = document.createElement('img');
      img.alt = el.dataset.alt || 'Photo du dossier';
      img.src = u;
      attentes.push(img.decode().catch(() => {}));
      el.replaceChildren(img);
    }
    await Promise.all(attentes);
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
        const actif = E.actif;
        E = R.normaliser(corps.donnees);
        if (E.dossiers.some((d) => d.id === actif)) E.actif = actif;
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open) rendre();
        toast('Un autre appareil a modifié ton dossier entre-temps : sa version est affichée. Refais ta dernière action si elle manque.');
      } else if (statut === 401) {
        deconnecter('Ce code d\'accès n\'est plus valide.');
        return;
      } else if (statut === 413) {
        majSync('attente');
        toast('Trop de données pour l\'enregistrement en ligne : exporte une copie, puis supprime un dossier clos.');
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
        const actif = E.actif;
        E = R.normaliser(corps.donnees);
        if (E.dossiers.some((d) => d.id === actif)) E.actif = actif;
        session.base = corps.donnees.majLe;
        cache(false);
        if (!modale().open && E.dossiers.length) rendre();
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
    if (estCode(n)) { const r = n.slice(0, 19); return [r.slice(0, 3), r.slice(3, 7), r.slice(7, 11), r.slice(11, 15), r.slice(15, 19)].filter(Boolean).join('-'); }
    const l = n.slice(0, 32);
    return [l.slice(0, 8), l.slice(8, 16), l.slice(16, 24), l.slice(24, 32)].filter(Boolean).join('-');
  }
  const estCode = (n) => n.startsWith(PRODUIT) || (/^[A-Z]{3}/.test(n) && /[G-Z]/.test(n.slice(0, 3)));
  const codeComplet = (c) => { const n = c.replace(/-/g, ''); return (estCode(n) && n.length === 19) || (/^[0-9A-F]{32}$/.test(n)); };

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
      E = R.normaliser(c.etat); session.base = donnees?.majLe ?? null;
      if (E.dossiers.length) { demarrer(); envoyer(); } else assistant();
      return;
    }
    E = R.normaliser(donnees);
    session.base = donnees?.majLe ?? null;
    if (E.dossiers.length) { cache(false); demarrer(); } else assistant(true);
  }

  function ouvrirDemo(memoriser = true) {
    session.demo = true; session.code = null; session.jeton = null;
    if (memoriser) stock.ecrire(CLE_CODE, CODE_DEMO);
    E = stock.lire(CLE_DEMO) ? R.normaliser(stock.lire(CLE_DEMO)) : donneesDemo();
    cache();
    demarrer();
    photosDemo();
  }

  async function deconnecter(message, demander = false) {
    if (demander && !session.demo) {
      const n = (await Photos.lister()).length;
      if (n && confirm(`Effacer aussi ${pluriel(n, 'photo ou document', 'photos ou documents')} gardés sur cet appareil ?\n\nOK : les effacer (conseillé sur un appareil partagé).\nAnnuler : les garder pour ta prochaine connexion.`)) await Photos.vider();
    }
    Photos.oublierUrls();
    stock.suppr(CLE_CODE);
    if (!session.demo) stock.suppr(CLE_CACHE);
    session.code = null; session.jeton = null; session.demo = false; session.base = null; E = null;
    document.body.classList.remove('app');
    ecranConnexion(message);
  }

  // ---------- Données de démonstration (fictives, relatives à aujourd'hui) ----------
  function donneesDemo() {
    E = R.etatVide();
    const t = auj();
    E.reglages.vetuste = { mobilier: 10, electromenager: 12, informatique: 20, electronique: 15, revetements: 8 };
    E.reglages.plafondVetuste = 70;
    const dom = (piece, categorie, designation, o = {}) => ({ id: uid(), piece, categorie, designation, marque: '', achatLe: null, prixAchat: null, valeurEstimee: null, coutReparation: null, coutRemplacement: null, vetuste: null, methode: '', montantDeclare: null, etatAvant: 'Bon', etatApres: 'Abîmé', reparable: 'inconnu', commentaire: '', ...o });
    const ev = (type, j, description) => ({ id: uid(), type, date: ajout(t, j), description });
    const pr = (code, statut, o = {}) => { const j = B.justificatifs[code]; return { id: uid(), code, type: j.type, libelle: j.nom, statut, dommageId: null, evenementId: null, reference: '', note: '', photos: [], date: null, ...o }; };

    // 1. Dégât des eaux en cours d'expertise.
    const d1 = R.normaliserDossier({ id: uid(), type: 'eau', titre: 'Fuite de l\'appartement du dessus', lieu: 'Appartement, 3e étage (exemple)', survenu: ajout(t, -19), decouvert: ajout(t, -18),
      pieces: ['Séjour', 'Couloir', 'Chambre'], tiers: ['Voisin', 'Syndic ou copropriété'], tiersNote: 'Joint de la douche du voisin du 4e défectueux (selon le plombier du syndic).',
      circonstances: 'En rentrant le soir, auréole au plafond du séjour et eau qui goutte sur le parquet. Le voisin du dessus a coupé l\'eau ; le plombier du syndic a trouvé un joint de douche défectueux le lendemain.',
      assureur: 'Mutuelle Habitat Exemple', contrat: 'MRH-000123 (fictif)', numero: 'SIN-2026-0456 (fictif)', declareLe: ajout(t, -17), creeLe: ajout(t, -18),
      mesures: { 'couper-eau': 'fait', 'couper-electricite': 'fait', 'prevenir-voisin': 'fait', 'prevenir-syndic': 'fait', aerer: 'fait', 'photos-avant': 'fait', 'garder-biens': 'fait', 'mettre-abri': 'fait' },
      observations: 'Le parquet du séjour a gondolé sur environ 12 m². L\'expert demande le devis du parqueteur avant sa visite.' });
    const parquet = dom('Séjour', 'revetements', 'Parquet chêne massif (12 m²)', { achatLe: ajout(t, -365 * 6), prixAchat: 1450, coutRemplacement: 2280, reparable: 'non', etatApres: 'Gondolé', commentaire: 'Devis parqueteur : dépose, repose et vitrification.' });
    const plafond = dom('Séjour', 'revetements', 'Peinture du plafond', { coutReparation: 640, reparable: 'oui', etatApres: 'Auréole et cloques', methode: 'reparation' });
    const canape = dom('Séjour', 'mobilier', 'Canapé 3 places tissu', { achatLe: ajout(t, -365 * 4 - 40), prixAchat: 899, coutRemplacement: 990, reparable: 'non', etatApres: 'Taché, mousse imbibée' });
    const tapis = dom('Séjour', 'decoration', 'Tapis laine 200 × 290', { valeurEstimee: 180, reparable: 'non', etatApres: 'Moisi', vetuste: null });
    const tv = dom('Séjour', 'electronique', 'Téléviseur 55 pouces', { marque: 'Marque d\'exemple', achatLe: ajout(t, -365 * 2 - 100), prixAchat: 649, coutReparation: 180, reparable: 'oui', etatApres: 'Ne s\'allume plus', commentaire: 'Diagnostic du réparateur : carte d\'alimentation.' });
    const peinture = dom('Couloir', 'revetements', 'Peinture murale du couloir', { coutReparation: 420, reparable: 'oui', etatApres: 'Traces d\'humidité' });
    const livres = dom('Chambre', 'decoration', 'Livres de la bibliothèque basse', { valeurEstimee: 120, reparable: 'non', etatApres: 'Gondolés', montantDeclare: 150, commentaire: 'Montant déclaré arrondi : une partie est difficile à estimer.' });
    const box = dom('Couloir', 'informatique', 'Box internet', { reparable: 'inconnu', etatApres: 'À tester', etatAvant: 'Bon' });
    d1.dommages.push(parquet, plafond, canape, tapis, tv, peinture, livres, box);
    const e1 = [ev('decouverte', -18, 'Auréole au plafond du séjour, eau sur le parquet.'), ev('mesures', -18, 'Eau coupée chez le voisin, électricité du séjour coupée, meubles déplacés.'),
      ev('declaration', -17, 'Déclaration en ligne sur l\'espace client.'), ev('accuse', -15, 'Accusé de réception : numéro de dossier attribué.'), ev('devis', -6, 'Devis du parqueteur et du peintre reçus.')];
    d1.evenements.push(...e1);
    d1.preuves.push(
      pr('photos', 'verifie', { dommageId: plafond.id, reference: 'IMG_2041 à IMG_2048', date: ajout(t, -18), note: 'Plafond et parquet, avant nettoyage.' }),
      pr('constat-eau', 'recu', { evenementId: e1[2].id, date: ajout(t, -16), note: 'Signé avec le voisin du dessus.' }),
      pr('devis', 'recu', { dommageId: parquet.id, reference: 'devis-parquet.pdf', date: ajout(t, -6) }),
      { id: uid(), code: null, type: 'devis', libelle: 'Devis du peintre', statut: 'recu', dommageId: peinture.id, evenementId: null, reference: 'devis-peinture.pdf', note: '', photos: [], date: ajout(t, -6) },
      pr('factures', 'manquant', { dommageId: canape.id, note: 'Facture introuvable : chercher le relevé bancaire de l\'achat.' }),
      { id: uid(), code: null, type: 'facture', libelle: 'Facture du téléviseur', statut: 'verifie', dommageId: tv.id, evenementId: null, reference: 'facture-tv.pdf', note: '', photos: [], date: null },
      pr('recherche-fuite', 'recu', { reference: 'rapport-plombier-syndic.pdf', date: ajout(t, -17) }),
      pr('courrier-syndic', 'a-fournir'),
      pr('liste-biens', 'a-fournir', { note: 'Imprimer l\'inventaire depuis l\'onglet Documents.' }),
      pr('rib', 'a-fournir'),
    );
    d1.echeances.push({ id: uid(), libelle: 'Visite de l\'expert (rendez-vous)', date: ajout(t, 3), fait: false, note: 'Créneau du matin, préparer les devis.' });
    d1.echeances.push({ id: uid(), libelle: 'Envoyer l\'état des pertes', date: ajout(t, -1), fait: false, note: '' });

    // 2. Cambriolage découvert hier, à déclarer (délai court).
    const d2 = R.normaliserDossier({ id: uid(), type: 'vol', titre: 'Cambriolage de la maison', lieu: 'Maison (exemple)', survenu: ajout(t, -1), decouvert: ajout(t, -1),
      pieces: ['Entrée', 'Séjour', 'Bureau'], tiers: ['Auteur inconnu'], creeLe: ajout(t, -1),
      circonstances: 'Retour de week-end : porte d\'entrée forcée, bureau et séjour fouillés.',
      assureur: 'Assurance Exemple', contrat: 'HAB-778899 (fictif)',
      mesures: { 'ne-pas-toucher': 'fait', plainte: 'fait', 'opposition-moyens': 'na', 'securiser-acces': 'fait', 'photos-avant': 'fait' } });
    const porte = dom('Entrée', 'menuiseries', 'Porte d\'entrée et serrure', { coutReparation: 980, reparable: 'oui', etatApres: 'Forcée', commentaire: 'Devis du serrurier : changement de cylindre et reprise du dormant.' });
    const portable = dom('Bureau', 'informatique', 'Ordinateur portable', { achatLe: ajout(t, -400), prixAchat: 1199, coutRemplacement: 1249, reparable: 'disparu', etatApres: 'Disparu' });
    const console = dom('Séjour', 'electronique', 'Console de jeux et manettes', { achatLe: ajout(t, -800), prixAchat: 549, reparable: 'disparu', etatApres: 'Disparu' });
    const bijoux = dom('Bureau', 'decoration', 'Montre et bijoux', { valeurEstimee: 600, reparable: 'disparu', etatApres: 'Disparu', commentaire: 'Vérifier le plafond « objets de valeur » du contrat.' });
    d2.dommages.push(porte, portable, console, bijoux);
    const e2 = [ev('decouverte', -1, 'Porte forcée constatée au retour.'), ev('mesures', -1, 'Plainte déposée, serrurier pour sécuriser la porte.')];
    d2.evenements.push(...e2);
    d2.preuves.push(...R.preuvesInitiales('vol', uid).map((p) => (p.code === 'plainte' ? { ...p, statut: 'recu', date: ajout(t, -1), evenementId: e2[1].id, reference: 'recepisse-plainte.pdf' } : p.code === 'photos' ? { ...p, statut: 'recu', date: ajout(t, -1) } : p.code === 'opposition' ? { ...p, statut: 'refuse', note: 'Sans objet : aucun moyen de paiement volé.' } : p)));

    // 3. Bris de glace clos.
    const d3 = R.normaliserDossier({ id: uid(), type: 'glace', titre: 'Baie vitrée fêlée', lieu: 'Maison (exemple)', survenu: ajout(t, -95), decouvert: ajout(t, -95), pieces: ['Séjour'],
      assureur: 'Assurance Exemple', contrat: 'HAB-778899 (fictif)', numero: 'BG-5521 (fictif)', declareLe: ajout(t, -94), creeLe: ajout(t, -95),
      mesures: { securite: 'fait', 'securiser-acces': 'fait', 'photos-avant': 'fait', 'garder-biens': 'na' },
      indemnisation: { proposition: 760, franchise: 150, franchiseIncluse: false, versements: [{ id: uid(), date: ajout(t, -60), montant: 610 }] } });
    d3.dommages.push(dom('Séjour', 'menuiseries', 'Vitrage de la baie vitrée (2,4 m × 2,1 m)', { coutReparation: 760, reparable: 'oui', etatApres: 'Fêlé sur toute la hauteur' }));
    d3.evenements.push(ev('decouverte', -95, 'Ballon dans la baie vitrée.'), ev('declaration', -94, 'Déclaration par téléphone.'), ev('devis', -92, 'Devis du vitrier.'), ev('proposition', -75, 'Prise en charge du devis, franchise de 150 € déduite.'),
      ev('acceptation', -74, 'Accord par e-mail.'), ev('reparation', -66, 'Vitrage remplacé.'), ev('versement', -60, 'Virement reçu.'), ev('cloture', -60, 'Dossier soldé.'));
    d3.preuves.push(...R.preuvesInitiales('glace', uid).map((p) => ({ ...p, statut: p.code === 'factures' ? 'refuse' : 'verifie', note: p.code === 'factures' ? 'Non demandé par l\'assureur.' : '' })));

    E.dossiers.push(d1, d2, d3);
    E.actif = d1.id;
    return E;
  }

  // Photos d'exemple dessinées pour la démo (aucune vraie photo).
  async function photosDemo() {
    const d = E?.dossiers[0];
    if (!session.demo || !d) return;
    const p = d.preuves.find((x) => x.code === 'photos');
    if (!p || p.photos.length) return;
    const dessins = [['Plafond du séjour', '#D8E4F0', '#2E5A88'], ['Parquet gondolé', '#FBEBC2', '#B07A2E'], ['Canapé taché', '#F8DCD3', '#B84A34']];
    try {
      for (const [legende, fond, forme] of dessins) {
        const c = document.createElement('canvas'); c.width = 800; c.height = 600;
        const x = c.getContext('2d');
        x.fillStyle = fond; x.fillRect(0, 0, 800, 600);
        x.fillStyle = forme; x.globalAlpha = 0.85; x.beginPath(); x.arc(560, 260, 170, 0, Math.PI * 2); x.fill();
        x.globalAlpha = 0.6; x.fillRect(90, 160, 280, 280);
        x.globalAlpha = 1; x.fillStyle = '#24221F'; x.font = '700 40px Outfit, sans-serif'; x.fillText(legende, 48, 540);
        x.font = '400 26px Outfit, sans-serif'; x.fillText('Photo d\'exemple (démo)', 48, 80);
        const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
        p.photos.push(await Photos.ajouter(blob, `${legende}.jpg`));
      }
      cache();
      if (!modale().open) rendre();
    } catch { /* IndexedDB indisponible : la démo reste sans photo */ }
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
          <path d="M10 280 L140 20 L270 280 Z" fill="#1D4E89"/>
          <rect x="150" y="150" width="130" height="130" fill="#F5B400"/>
          <circle cx="420" cy="150" r="130" fill="#D9302A"/>
          <rect x="370" y="105" width="100" height="90" fill="none" stroke="#F0EDE6" stroke-width="20"/>
          <path d="M370 150 h100 M420 105 v90" stroke="#F0EDE6" stroke-width="14"/>
        </svg>
        <div class="accroche">
          <p class="surtitre">Dossier sinistre · habitation</p>
          <h1>Ton dossier d'assurance, complet et suivi.</h1>
          <p>Déclaration guidée, inventaire chiffré des dommages, preuves classées, chronologie et dossier imprimable pour ton assureur.</p>
        </div>
      </section>
      <section class="formulaire-acces">
        <div>
          <p class="surtitre">Accès acheteur</p>
          <h2>Ouvre ton dossier</h2>
        </div>
        <p>Saisis la clé de licence reçue par e-mail après ton achat. Ton dossier est enregistré en ligne et te suit sur tous tes appareils ; tes photos restent sur l'appareil qui les a prises.</p>
        <form id="form-code" class="formulaire-acces-form" novalidate>
          <label class="champ code-saisie">Clé de licence ou code d'accès
            <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" inputmode="text" required>
          </label>
          <label class="case"><input type="checkbox" id="memoriser" checked> Rester connecté sur cet appareil</label>
          <p class="erreur" id="erreur-code" role="alert">${esc(message)}</p>
          <button class="btn primaire" type="submit" style="width:100%">Ouvrir mon dossier</button>
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
        bouton.disabled = false; bouton.textContent = 'Ouvrir mon dossier'; champ.focus();
      }
    });
  }

  // ---------- Assistant de création d'un dossier ----------
  // Étapes adaptées au type : la question des tiers et la liste des biens changent selon le sinistre.
  let A = null; // réponses de l'assistant en cours
  const ETAPES_A = ['type', 'quand', 'pieces', 'biens', 'tiers', 'declaration'];

  function assistant(premier = false) {
    A = { etape: 0, premier, type: '', sousType: '', survenu: auj(), decouvert: auj(), lieu: '', titre: '', circonstances: '', catnat: false, arreteLe: '', pieces: [], biens: [], tiers: [], tiersNote: '', aTiers: '', declare: '', declareLe: auj(), assureur: '', contrat: '', numero: '' };
    document.body.classList.remove('app');
    rendreAssistant();
  }

  function rendreAssistant() {
    const etape = ETAPES_A[A.etape];
    const t = A.type ? R.typeDe(A.type) : null;
    document.title = `Nouveau dossier · ${NOM}`;
    const suivi = `<ol class="etapes-assistant" aria-label="Étapes">${['Sinistre', 'Dates', 'Pièces', 'Biens', 'Tiers', 'Déclaration'].map((n, k) => `<li class="${k < A.etape ? 'fait' : k === A.etape ? 'actif' : ''}"${k === A.etape ? ' aria-current="step"' : ''}><span>${k + 1}</span>${n}</li>`).join('')}</ol>`;
    let corps = '';
    if (etape === 'type') {
      corps = `<h1>Quel type de sinistre ?</h1><p class="intro">Le choix adapte la suite : délais indicatifs, justificatifs à réunir, mesures conservatoires et courriers.</p>
        <div class="filieres">${B.types.map((x) => `<button type="button" class="filiere" style="--c:${x.couleur}" data-action="a-type" data-code="${x.code}" aria-pressed="${A.type === x.code}"><b>${esc(x.nom)}</b><span>${esc(x.description)}</span></button>`).join('')}</div>`;
    } else if (etape === 'quand') {
      corps = `<h1>Quand s'est-il produit ?</h1><p class="intro">La date de découverte compte pour le délai de déclaration : c'est le jour où tu as constaté le sinistre.</p>
        <div class="grille-2">
          <label class="champ">Date du sinistre<small>Si tu ne la connais pas, mets ta meilleure estimation.</small><input type="date" name="survenu" value="${A.survenu}" max="${auj()}"></label>
          <label class="champ">Date de découverte<input type="date" name="decouvert" value="${A.decouvert}" max="${auj()}"></label>
          ${t.catnat ? `<label class="champ">Événement<select name="sousType">${B.sousTypesClimat.map((s) => `<option ${A.sousType === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
          <div class="champ"><span>Catastrophe naturelle</span><label class="case"><input type="checkbox" name="catnat" ${A.catnat ? 'checked' : ''}> Un arrêté de catastrophe naturelle concerne (ou devrait concerner) ma commune</label></div>
          <label class="champ">Publication de l'arrêté au Journal officiel<small>Facultatif : à saisir quand il paraît. Le délai de déclaration se calcule depuis cette date.</small><input type="date" name="arreteLe" value="${A.arreteLe}"></label>` : ''}
          <label class="champ">Logement concerné<small>Un libellé suffit, sans adresse : « Appartement », « Maison de vacances ».</small><input name="lieu" maxlength="80" value="${esc(A.lieu)}" placeholder="Ex. : Résidence principale"></label>
          <label class="champ">Nom du dossier<small>Facultatif.</small><input name="titre" maxlength="80" value="${esc(A.titre)}" placeholder="${esc(t.nom)} du ${fmtCourt(A.survenu)}"></label>
        </div>
        <label class="champ">Ce qui s'est passé<small>Quelques phrases, reprises dans le rapport et la déclaration.</small><textarea name="circonstances" rows="3" maxlength="1500">${esc(A.circonstances)}</textarea></label>`;
    } else if (etape === 'pieces') {
      corps = `<h1>Quelles pièces sont touchées ?</h1><p class="intro">Coche toutes les pièces concernées ; tu pourras préciser la pièce de chaque bien ensuite.</p>
        <div class="choix-lots">${B.pieces.map((p) => `<label class="case"><input type="checkbox" name="piece" value="${esc(p)}" ${A.pieces.includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')}</div>`;
    } else if (etape === 'biens') {
      const liste = A.type === 'glace'
        ? `<div class="choix-lots">${B.biensGlace.map(([n, c]) => `<label class="case"><input type="checkbox" name="bien" value="${c}|${esc(n)}" ${A.biens.includes(`${c}|${n}`) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div>`
        : B.categories.map((c) => `<details class="cat-biens" ${c.biens.some((n) => A.biens.includes(`${c.code}|${n}`)) ? 'open' : ''}><summary>${esc(c.nom)}<span>${c.biens.filter((n) => A.biens.includes(`${c.code}|${n}`)).length || ''}</span></summary><div class="choix-lots compact">${c.biens.map((n) => `<label class="case"><input type="checkbox" name="bien" value="${c.code}|${esc(n)}" ${A.biens.includes(`${c.code}|${n}`) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div></details>`).join('');
      corps = `<h1>Quels biens sont endommagés${A.type === 'vol' ? ' ou volés' : ''} ?</h1><p class="intro">Coche ce que tu sais déjà : chaque bien devient une ligne de l'inventaire, à chiffrer ensuite. Tu pourras en ajouter à tout moment.</p>${liste}`;
    } else if (etape === 'tiers') {
      const q = { eau: 'La fuite vient-elle d\'un autre logement, des parties communes ou d\'un tiers ?', vol: 'Connais-tu l\'auteur ou un témoin ?', incendie: 'Le feu est-il parti chez un voisin ou d\'un tiers ?' }[A.type] || 'Un tiers est-il concerné (voisin, syndic, bailleur, entreprise) ?';
      corps = `<h1>Y a-t-il des tiers concernés ?</h1><p class="intro">${esc(q)}</p>
        <fieldset class="champ bascule"><legend class="sr-only">Tiers concernés</legend><div>${[['non', 'Non'], ['oui', 'Oui'], ['inconnu', 'Je ne sais pas']].map(([v, l]) => `<label><input type="radio" name="aTiers" value="${v}" ${A.aTiers === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <div class="tiers-detail" ${A.aTiers === 'oui' ? '' : 'hidden'}>
          <div class="choix-lots">${B.tiers.map((x) => `<label class="case"><input type="checkbox" name="tiers" value="${esc(x)}" ${A.tiers.includes(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</div>
          <label class="champ">Précisions<small>Sans coordonnées : « voisin du 4e », « syndic de l'immeuble ».</small><input name="tiersNote" maxlength="200" value="${esc(A.tiersNote)}"></label>
        </div>`;
    } else {
      const reg = B.delais?.[t.delai];
      corps = `<h1>As-tu déjà déclaré le sinistre ?</h1><p class="intro">${reg ? esc(reg.resume) : 'Déclare-le à ton assureur dès que possible.'}</p>
        <fieldset class="champ bascule"><legend class="sr-only">Déclaration</legend><div>${[['non', 'Pas encore'], ['oui', 'Oui, c\'est fait']].map(([v, l]) => `<label><input type="radio" name="declare" value="${v}" ${A.declare === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
        <div class="grille-2">
          <label class="champ">Assureur<small>Nom de la compagnie, facultatif.</small><input name="assureur" maxlength="80" value="${esc(A.assureur)}"></label>
          <label class="champ">Numéro de contrat<small>Facultatif.</small><input name="contrat" maxlength="60" value="${esc(A.contrat)}"></label>
          <label class="champ decl-oui" ${A.declare === 'oui' ? '' : 'hidden'}>Date de déclaration<input type="date" name="declareLe" value="${A.declareLe}" max="${auj()}"></label>
          <label class="champ decl-oui" ${A.declare === 'oui' ? '' : 'hidden'}>Numéro de dossier ou de sinistre<small>Facultatif.</small><input name="numero" maxlength="60" value="${esc(A.numero)}"></label>
        </div>`;
    }
    const dernier = A.etape === ETAPES_A.length - 1;
    $('#racine').innerHTML = `
      <div class="accueil assistant">
        <div class="accueil-tete"><span class="marque">${MARQUE}</span><span class="surtitre" style="margin:0">${A.premier ? 'Premier dossier' : 'Nouveau dossier'}</span></div>
        ${suivi}
        <form id="form-assistant" class="accueil-form" novalidate>
          ${corps}
          <p class="erreur" role="alert"></p>
          <div class="accueil-pied">
            ${A.etape > 0 ? '<button class="btn" type="button" data-action="a-retour">Retour</button>' : (!A.premier && E?.dossiers.length ? '<button class="btn" type="button" data-action="a-quitter">Annuler</button>' : '<span></span>')}
            <button class="btn primaire" type="submit">${dernier ? 'Créer le dossier' : 'Continuer'}</button>
          </div>
        </form>
      </div>`;
    const f = $('#form-assistant');
    f.addEventListener('submit', (e) => { e.preventDefault(); avancerAssistant(); });
    f.addEventListener('change', (e) => {
      if (e.target.name === 'aTiers') f.querySelector('.tiers-detail').hidden = e.target.value !== 'oui';
      if (e.target.name === 'declare') f.querySelectorAll('.decl-oui').forEach((x) => { x.hidden = e.target.value !== 'oui'; });
    });
    window.scrollTo({ top: 0 });
    f.querySelector('h1').setAttribute('tabindex', '-1');
    f.querySelector('h1').focus({ preventScroll: true });
  }

  function lireAssistant() {
    const f = $('#form-assistant');
    if (!f) return;
    const fd = new FormData(f);
    const champ = (k) => (fd.has(k) ? String(fd.get(k) || '').trim() : undefined);
    for (const k of ['survenu', 'decouvert', 'lieu', 'titre', 'circonstances', 'arreteLe', 'sousType', 'tiersNote', 'aTiers', 'declare', 'declareLe', 'assureur', 'contrat', 'numero']) { const v = champ(k); if (v !== undefined) A[k] = v; }
    if (f.querySelector('[name=catnat]')) A.catnat = fd.has('catnat');
    if (f.querySelector('[name=piece]')) A.pieces = fd.getAll('piece');
    if (f.querySelector('[name=bien]')) A.biens = fd.getAll('bien');
    if (f.querySelector('[name=tiers]')) A.tiers = fd.getAll('tiers');
  }

  function avancerAssistant() {
    lireAssistant();
    const err = (m) => { $('#form-assistant .erreur').textContent = m; };
    const etape = ETAPES_A[A.etape];
    if (etape === 'type' && !A.type) return err('Choisis le type de sinistre.');
    if (etape === 'quand') {
      if (!R.estDate(A.survenu)) return err('Indique la date du sinistre (même approximative).');
      if (!R.estDate(A.decouvert)) A.decouvert = A.survenu;
      if (A.decouvert < A.survenu) return err('La découverte ne peut pas précéder le sinistre.');
    }
    if (etape === 'declaration' && A.declare === 'oui' && !R.estDate(A.declareLe)) return err('Indique la date de ta déclaration.');
    if (A.etape < ETAPES_A.length - 1) { A.etape += 1; rendreAssistant(); return; }
    creerDossier();
  }

  function creerDossier() {
    if (!E) E = R.etatVide();
    const t = R.typeDe(A.type);
    const piece = A.pieces.length === 1 ? A.pieces[0] : '';
    const d = R.normaliserDossier({
      id: uid(), type: A.type, sousType: t.catnat ? A.sousType || B.sousTypesClimat[0] : '', titre: A.titre, lieu: A.lieu, survenu: A.survenu, decouvert: A.decouvert, circonstances: A.circonstances,
      pieces: A.pieces, tiers: A.aTiers === 'oui' ? A.tiers : [], tiersNote: A.aTiers === 'oui' ? A.tiersNote : (A.aTiers === 'inconnu' ? 'Tiers éventuel à vérifier.' : ''),
      catnat: t.catnat && A.catnat, arreteLe: A.arreteLe || null, assureur: A.assureur, contrat: A.contrat,
      numero: A.declare === 'oui' ? A.numero : '', declareLe: A.declare === 'oui' ? A.declareLe : null, creeLe: auj(),
    });
    d.dommages = A.biens.map((v) => { const [categorie, designation] = v.split('|'); return R.normaliserDossier({ dommages: [{ id: uid(), piece, categorie, designation, reparable: A.type === 'vol' ? 'disparu' : 'inconnu', etatAvant: '', etatApres: A.type === 'vol' ? 'Disparu' : '' }] }).dommages[0]; });
    d.preuves = R.preuvesInitiales(A.type, uid);
    d.evenements.push({ id: uid(), type: 'decouverte', date: A.decouvert, description: A.circonstances.slice(0, 200) });
    if (A.declare === 'oui') d.evenements.push({ id: uid(), type: 'declaration', date: A.declareLe, description: A.numero ? `Numéro de dossier : ${A.numero}` : '' });
    E.dossiers.push(d);
    E.actif = d.id;
    A = null;
    sauver();
    vue = 'dossier';
    demarrer();
    toast(`Dossier créé : ${pluriel(d.preuves.length, 'justificatif')} à réunir, ${pluriel(d.dommages.length, 'bien')} à chiffrer.`);
  }

  // ---------- Rendu : application ----------
  const ICONES = {
    dossier: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>',
    dommages: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" fill="currentColor"/><rect x="13" y="3" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="13" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13" y="13" width="8" height="8" fill="currentColor"/></svg>',
    preuves: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="4" fill="currentColor"/><rect x="8" y="3" width="8" height="3" fill="currentColor"/></svg>',
    suivi: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="9" fill="currentColor"/><rect x="10" y="6" width="4" height="15" fill="currentColor"/><rect x="17" y="2" width="4" height="19" fill="currentColor"/></svg>',
    documents: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill="currentColor"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="5" width="18" height="2.5" fill="currentColor"/><rect x="3" y="11" width="18" height="2.5" fill="currentColor"/><rect x="3" y="17" width="18" height="2.5" fill="currentColor"/><rect x="6" y="3" width="4" height="6.5" fill="#F5B400" stroke="currentColor" stroke-width="2"/><rect x="14" y="9" width="4" height="6.5" fill="#D9302A" stroke="currentColor" stroke-width="2"/><rect x="8" y="15" width="4" height="6.5" fill="#1D4E89" stroke="currentColor" stroke-width="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 4h2v16h-2zM4 11h16v2H4z" fill="currentColor"/></svg>',
  };
  const ONGLETS = [['dossier', 'Dossier'], ['dommages', 'Dommages'], ['preuves', 'Preuves'], ['suivi', 'Suivi'], ['documents', 'Documents']];
  const FORME_VIDE = '<svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="0" y="40" width="56" height="56" fill="#1D4E89"/><circle cx="62" cy="34" r="34" fill="#F5B400"/><path d="M56 96 96 96 96 56Z" fill="#D9302A"/></svg>';
  const videEtat = (titre, texte, actions = '', petit = false) => `<div class="vide-etat${petit ? ' petit' : ''}">${FORME_VIDE}<div><h3>${titre}</h3><p>${texte}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div></div>`;

  function demarrer() {
    if (!E.dossiers.length) { assistant(true); return; }
    document.body.classList.add('app');
    const depuisUrl = location.hash.slice(1);
    if (ONGLETS.some(([id]) => id === depuisUrl)) vue = depuisUrl;
    $('#racine').innerHTML = `
      ${session.demo ? '<div class="bandeau-demo"><div><b>Mode démo</b><span>Données fictives, gardées sur cet appareil uniquement.</span><button data-action="demo-reinit">Recommencer la démo</button><button data-action="deconnexion">J\'ai une clé d\'accès</button></div></div>' : ''}
      <header class="barre"><div class="barre-int">
        <span class="marque">${MARQUE}</span>
        <span class="titre-produit">Dossier<br>sinistre</span>
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
    if (!dossier()) { assistant(true); return; }
    if (E.actif !== dossier().id) E.actif = dossier().id;
    document.querySelectorAll('.onglet').forEach((b) => { if (b.dataset.vue === vue) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.title = `${Object.fromEntries(ONGLETS)[vue]} · ${NOM}`;
    $('#vue').innerHTML = { dossier: vueDossier, dommages: vueDommages, preuves: vuePreuves, suivi: vueSuivi, documents: vueDocuments }[vue]();
    hydrater($('#vue'));
  }

  function changerVue(v) {
    vue = v;
    history.replaceState(null, '', `#${v}`);
    rendre();
    window.scrollTo({ top: 0 });
    $('#vue').focus({ preventScroll: true });
  }

  // Sélecteur du dossier actif (plusieurs sinistres par acheteur).
  function choixDossier() {
    const d = dossier();
    return `<div class="choix-dossier">
      <label class="champ"><span class="sr-only">Dossier affiché</span><select data-choix="dossier">${E.dossiers.map((x) => `<option value="${x.id}" ${x.id === d.id ? 'selected' : ''}>${esc(titreDossier(x))} · ${esc(nomStatut(R.statut(x)))}</option>`).join('')}</select></label>
      <button class="btn petit" data-action="dossier-nouveau">${ICONES.plus}Nouveau dossier</button>
    </div>`;
  }

  // ---------- Vue Dossier (tableau de bord) ----------
  function vueDossier() {
    const d = dossier(), t = auj(), ty = R.typeDe(d.type);
    const st = R.statut(d);
    const tot = R.totaux(d, E.reglages);
    const bp = R.bilanPreuves(d.preuves);
    const ech = R.echeancesActives(d, t, E.reglages.alerte);
    const prochaine = ech.find((e) => e.date);
    const etape = R.etapeAtteinte(d);
    const mesures = ty.mesures.map((c) => [c, B.mesures[c]]);
    const faites = mesures.filter(([c]) => d.mesures[c] === 'fait' || d.mesures[c] === 'na').length;
    const alerteDecl = !d.declareLe ? ech.find((e) => e.code === 'declaration' || e.code === 'catnat') : null;
    return `
      ${choixDossier()}
      <section class="resume-dossier" style="--c:${ty.couleur}">
        <div class="resume-tete">
          <div><p class="surtitre"><span class="etiquette ${couleurStatut(st)}">${esc(nomStatut(st))}</span> ${esc(ty.nom)}${d.sousType ? ` · ${esc(d.sousType)}` : ''}${d.catnat ? ' · catastrophe naturelle' : ''}</p>
            <h1>${esc(titreDossier(d))}</h1>
            <p class="resume-meta">${[d.survenu && `Survenu le ${fmt(d.survenu)}`, d.decouvert && d.decouvert !== d.survenu && `découvert le ${fmt(d.decouvert)}`, d.lieu, d.pieces.length && pluriel(d.pieces.length, 'pièce')].filter(Boolean).map(esc).join(' · ')}</p></div>
          <button class="btn petit" data-action="dossier-modifier">Modifier</button>
        </div>
        <ol class="frise" aria-label="Progression du dossier : étape ${etape} sur ${B.etapes.length}">${B.etapes.map((n, k) => `<li class="${k < etape ? 'fait' : ''}${k === etape ? ' prochaine' : ''}"><i></i><span>${n}</span></li>`).join('')}</ol>
        <p class="frise-texte">${etape >= B.etapes.length ? 'Dossier clos' : `Étape ${etape + 1} sur ${B.etapes.length} : ${B.etapes[etape]}`}</p>
      </section>
      ${alerteDecl ? `<div class="alerte ${alerteDecl.etat === 'depassee' ? 'rouge' : ''}"><b>${alerteDecl.date ? `À déclarer au plus tard ${quand(alerteDecl.date)} (${fmtCourt(alerteDecl.date)})` : 'Déclaration à faire'}</b><span>${esc(alerteDecl.regle.resume)} <a href="#" data-action="voir-source" data-source="${alerteDecl.regle.source}">Source</a></span><button class="btn petit primaire" data-action="declarer">J'ai déclaré</button></div>` : ''}
      <div class="tuiles">
        <div class="tuile" style="--c:var(--bleu)"><p class="surtitre">Montant déclaré</p><b>${tot.declare ? eur(tot.declare) : '–'}</b><span>${tot.aChiffrer ? `${pluriel(tot.aChiffrer, 'bien')} à chiffrer` : `estimé ${eur(tot.estime)}`}</span></div>
        <div class="tuile rond" style="--c:var(--jaune)"><p class="surtitre">Justificatifs</p><b>${bp.collectees}<small>/ ${bp.total}</small></b><span>${bp.aTraiter ? `${bp.aTraiter} à obtenir` : 'tous réunis'}</span></div>
        <div class="tuile" style="--c:var(--rouge)"><p class="surtitre">Prochaine échéance</p><b class="tuile-texte">${prochaine ? esc(quand(prochaine.date)) : '–'}</b><span>${prochaine ? esc(prochaine.libelle) : 'aucune échéance datée'}</span></div>
        <div class="tuile rond" style="--c:var(--encre)"><p class="surtitre">Dommages</p><b>${tot.nombre}</b><span>${tot.reconnu !== null ? `proposition ${eur(tot.reconnu)}` : 'biens inventoriés'}</span></div>
      </div>
      <div class="bord-grille">
        <section class="bloc">
          <div class="bloc-tete"><h2>Assurance</h2><button class="btn lien" data-action="dossier-modifier">Modifier</button></div>
          <dl class="fiche">
            <div><dt>Assureur</dt><dd>${esc(d.assureur) || '<em>à compléter</em>'}</dd></div>
            <div><dt>Contrat</dt><dd>${esc(d.contrat) || '–'}</dd></div>
            <div><dt>Déclaré le</dt><dd>${d.declareLe ? fmt(d.declareLe) : '<em>pas encore</em>'}</dd></div>
            <div><dt>N° de sinistre</dt><dd>${esc(d.numero) || '–'}</dd></div>
            ${d.tiers.length || d.tiersNote ? `<div class="large"><dt>Tiers</dt><dd>${esc([d.tiers.join(', '), d.tiersNote].filter(Boolean).join(' · '))}</dd></div>` : ''}
          </dl>
        </section>
        <section class="bloc">
          <div class="bloc-tete"><h2>Échéances à surveiller</h2><button class="btn lien" data-action="echeance-nouvelle">Ajouter</button></div>
          ${ech.length ? `<ul class="echeances">${ech.map(ligneEcheance).join('')}</ul>` : '<p class="bloc-vide">Aucune échéance en cours.</p>'}
        </section>
        <section class="bloc large">
          <div class="bloc-tete"><h2>Mesures conservatoires</h2><span class="compte">${faites} / ${mesures.length} traitées</span></div>
          <p class="bloc-aide">À examiner selon ta situation ; ton contrat peut en prévoir d'autres. Garde les factures des interventions d'urgence.</p>
          <ul class="mesures">${mesures.map(([c, texte]) => { const v = d.mesures[c] || ''; return `<li class="${v}"><span>${esc(texte)}</span><div class="mini-bascule" role="group" aria-label="État"><button data-action="mesure" data-code="${c}" data-val="fait" aria-pressed="${v === 'fait'}">Fait</button><button data-action="mesure" data-code="${c}" data-val="na" aria-pressed="${v === 'na'}">Sans objet</button></div></li>`; }).join('')}</ul>
        </section>
      </div>
      <p class="avertissement">Outil d'organisation et d'estimation : ni conseil juridique, ni expertise d'assurance, ni garantie d'indemnisation. Ton contrat et ton assureur font foi.</p>`;
  }

  function ligneEcheance(e) {
    const classe = { depassee: 'rouge', proche: 'jaune', 'a-venir': '', faite: 'faite' }[e.etat];
    const date = e.date ? `<b>${fmtCourt(e.date)}</b><small>${e.etat === 'faite' ? 'faite' : e.etat === 'depassee' ? `dépassée (${quand(e.date)})` : quand(e.date)}</small>` : '<b>À dater</b>';
    const source = e.regle ? ` <a href="#" data-action="voir-source" data-source="${e.regle.source}">Source</a>` : '';
    const action = e.code === 'perso' ? `<button class="btn lien" data-action="echeance-modifier" data-id="${e.id}">Modifier</button>` : '';
    return `<li class="${classe}"><div class="ech-date">${date}</div><div class="ech-texte"><span>${esc(e.libelle)}</span><small>${esc(e.attente || (e.regle ? e.regle.resume : e.note))}${source}</small></div>${action}</li>`;
  }

  // ---------- Vue Dommages (inventaire et calcul) ----------
  function vueDommages() {
    const d = dossier();
    const tot = R.totaux(d, E.reglages);
    const liste = R.filtrerDommages(d.dommages, filtre);
    const pieces = [...new Set([...d.pieces, ...d.dommages.map((x) => x.piece).filter(Boolean)])];
    const cats = [...new Set(d.dommages.map((x) => x.categorie).filter(Boolean))];
    const filtresActifs = filtre.texte || filtre.piece || filtre.categorie;
    return `
      ${choixDossier()}
      <div class="vue-tete"><div><h1>Dommages</h1><p>L'inventaire chiffré : chaque bien, son état, son calcul. Les montants estimés, déclarés et reconnus par l'assureur restent séparés.</p></div>
        <div class="actions"><button class="btn" data-action="bibliotheque">${ICONES.plus}Depuis la bibliothèque</button><button class="btn primaire" data-action="dommage-nouveau">${ICONES.plus}Bien</button></div></div>
      <div class="totaux">
        <div><span>Estimé</span><b>${eur(tot.estime)}</b></div>
        <div><span>dont vétusté déduite</span><b>${eur(tot.vetuste)}</b></div>
        <div class="fort"><span>Déclaré</span><b>${eur(tot.declare)}</b></div>
        <div><span>Reconnu par l'assureur</span><b>${tot.reconnu === null ? '–' : eur(tot.reconnu)}</b></div>
      </div>
      ${d.dommages.length ? `<div class="filtres filtres-dommages">
        <label class="champ recherche">Rechercher<input type="search" data-filtre="texte" value="${esc(filtre.texte)}" placeholder="Désignation, marque, commentaire"></label>
        <label class="champ">Pièce<select data-filtre="piece"><option value="">Toutes</option>${pieces.map((p) => `<option ${filtre.piece === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
        <label class="champ">Catégorie<select data-filtre="categorie"><option value="">Toutes</option>${cats.map((c) => `<option value="${c}" ${filtre.categorie === c ? 'selected' : ''}>${esc(nomCat(c))}</option>`).join('')}</select></label>
      </div>
      <p class="compteur">${pluriel(liste.length, 'bien')}${filtresActifs ? ` sur ${d.dommages.length} · <button class="btn lien" data-action="filtres-effacer">Tout afficher</button>` : ''}${tot.aChiffrer ? ` · <b>${pluriel(tot.aChiffrer, 'à chiffrer', 'à chiffrer')}</b>` : ''}</p>
      <div class="cartes">${liste.map(carteDommage).join('') || videEtat('Aucun bien ne correspond', 'Change les filtres pour voir tout l\'inventaire.', '<button class="btn" data-action="filtres-effacer">Tout afficher</button>', true)}</div>`
      : videEtat('Inventaire vide', 'Ajoute les biens endommagés un par un ou choisis-les dans la bibliothèque (mobilier, électroménager, revêtements…).', `<button class="btn primaire" data-action="bibliotheque">${ICONES.plus}Depuis la bibliothèque</button><button class="btn" data-action="dommage-nouveau">${ICONES.plus}Bien</button>`)}
      ${d.dommages.length ? '<p class="note">Vétusté : taux saisi sur le bien, sinon taux annuel de la catégorie (Réglages) × âge du bien, plafonné. Aucun taux n\'est imposé : celui de ton contrat ou de l\'expert fait foi.</p>' : ''}`;
  }

  function carteDommage(x) {
    const d = dossier();
    const m = R.montants(x, E.reglages, d.survenu);
    const nb = d.preuves.filter((p) => p.dommageId === x.id).length;
    const rep = (B.reparabilite.find(([k]) => k === x.reparable) || ['', ''])[1];
    const calcul = m.estime === null ? `<span class="a-chiffrer">${esc(m.detail)}</span>`
      : m.methode === 'remplacement' ? `${eur(m.base)} − ${m.vetuste.taux} %${m.vetuste.source === 'categorie' ? ` (${m.vetuste.annuel} %/an × ${m.vetuste.ans} an${m.vetuste.ans >= 2 ? 's' : ''})` : ''} = <b>${eur(m.estime)}</b>`
      : `${esc(m.detail.split(' (')[0].split(',')[0])} : <b>${eur(m.estime)}</b>`;
    return `
      <article class="carte dommage" data-carte="${x.id}">
        <div class="carte-bande" style="--c:${R.typeDe(d.type).couleur}"></div>
        <div class="carte-corps">
          <p class="carte-meta"><span class="etiquette contour">${esc(nomCat(x.categorie))}</span><span>${esc(x.piece || 'Pièce à préciser')}</span>${rep ? `<span>${esc(rep)}</span>` : ''}${nb ? `<span>${pluriel(nb, 'justificatif')}</span>` : ''}</p>
          <h3>${esc(x.designation || 'Bien sans nom')}${x.marque ? ` <small>${esc(x.marque)}</small>` : ''}</h3>
          ${x.etatAvant || x.etatApres ? `<p class="etat-bien">${x.etatAvant ? `Avant : ${esc(x.etatAvant)}` : ''}${x.etatAvant && x.etatApres ? ' → ' : ''}${x.etatApres ? `Après : ${esc(x.etatApres)}` : ''}</p>` : ''}
          <p class="calcul">${calcul}</p>
          ${m.declare !== null && m.declare !== m.estime ? `<p class="calcul">Montant déclaré : <b>${eur(m.declare)}</b></p>` : ''}
          ${x.commentaire ? `<p class="commentaire">${esc(x.commentaire)}</p>` : ''}
        </div>
        <div class="carte-plus"><button data-action="dommage-modifier" data-id="${x.id}">Modifier</button></div>
      </article>`;
  }

  // ---------- Vue Preuves ----------
  function vuePreuves() {
    const d = dossier();
    const bp = R.bilanPreuves(d.preuves);
    const liste = d.preuves.filter((p) => !filtre.preuve || p.statut === filtre.preuve || (filtre.preuve === 'a-traiter' && ['a-fournir', 'manquant', 'refuse'].includes(p.statut)));
    const ordre = { 'a-fournir': 0, manquant: 1, refuse: 2, recu: 3, verifie: 4 };
    liste.sort((a, b) => ordre[a.statut] - ordre[b.statut]);
    return `
      ${choixDossier()}
      <div class="vue-tete"><div><h1>Preuves</h1><p>Photos, factures, devis, rapports et courriers, rattachés à un dommage ou à une étape. L'outil ne vérifie pas la valeur juridique des documents : « Vérifié » veut dire que tu l'as contrôlé toi-même.</p></div>
        <div class="actions"><button class="btn primaire" data-action="preuve-nouvelle">${ICONES.plus}Justificatif</button></div></div>
      <div class="puces-filtre" role="group" aria-label="Filtrer par statut">
        <button data-action="filtre-preuve" data-statut="" aria-pressed="${!filtre.preuve}">Tous <b>${bp.total}</b></button>
        <button data-action="filtre-preuve" data-statut="a-traiter" aria-pressed="${filtre.preuve === 'a-traiter'}">À obtenir <b>${bp.aTraiter}</b></button>
        ${B.statutsPreuve.map(([c, n]) => `<button data-action="filtre-preuve" data-statut="${c}" aria-pressed="${filtre.preuve === c}"><i class="pastille ${COULEUR_PREUVE[c]}"></i>${n} <b>${bp[c] || 0}</b></button>`).join('')}
      </div>
      ${liste.length ? `<div class="cartes preuves">${liste.map(cartePreuve).join('')}</div>` : videEtat(d.preuves.length ? 'Aucun justificatif dans ce filtre' : 'Aucun justificatif', d.preuves.length ? 'Change le filtre pour voir les autres.' : 'Ajoute tes photos, factures et devis.', `<button class="btn primaire" data-action="preuve-nouvelle">${ICONES.plus}Justificatif</button>`)}
      <p class="note">Les photos et PDF ajoutés ici restent <b>sur cet appareil</b> (stockage du navigateur), réduits pour gagner de la place ; ils ne sont pas envoyés en ligne. Garde aussi tes originaux. Pour les retrouver sur un autre appareil : Réglages, « Télécharger une copie avec les photos ».</p>`;
  }

  function cartePreuve(p) {
    const d = dossier();
    const dom = d.dommages.find((x) => x.id === p.dommageId);
    const ev = d.evenements.find((x) => x.id === p.evenementId);
    const aide = p.code ? B.justificatifs[p.code]?.aide : '';
    return `
      <article class="carte preuve" data-carte="${p.id}">
        <div class="carte-bande" style="--c:var(--${{ 'a-fournir': 'jaune', recu: 'bleu', verifie: 'vert', manquant: 'rouge', refuse: 'gris' }[p.statut]})"></div>
        <div class="carte-corps">
          <p class="carte-meta"><span class="etiquette ${COULEUR_PREUVE[p.statut]}">${esc(nomStatutPreuve(p.statut))}</span><span>${esc(nomTypePreuve(p.type))}</span>${p.date ? `<span>${fmtCourt(p.date)}</span>` : ''}${dom ? `<span>Bien : ${esc(dom.designation)}</span>` : ''}${ev ? `<span>Étape : ${esc(R.evenementDe(ev.type).nom)}</span>` : ''}</p>
          <h3>${esc(p.libelle)}</h3>
          ${p.reference ? `<p class="commentaire">Fichier : ${esc(p.reference)}</p>` : ''}
          ${p.note ? `<p class="commentaire">${esc(p.note)}</p>` : (p.statut === 'a-fournir' && aide ? `<p class="commentaire aide-preuve">${esc(aide)}</p>` : '')}
          ${p.photos.length ? `<div class="vignettes">${p.photos.map((id) => `<button class="vignette" data-action="photo-voir" data-preuve="${p.id}" data-photo="${id}" data-alt="${esc(p.libelle)}" aria-label="Agrandir"></button>`).join('')}</div>` : ''}
          <div class="preuve-actions">
            <label class="champ statut-rapide"><span class="sr-only">Statut</span><select data-statut-preuve="${p.id}">${B.statutsPreuve.map(([c, n]) => `<option value="${c}" ${p.statut === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="btn petit fichier">${ICONES.plus}Photo ou PDF<input type="file" accept="image/*,application/pdf" multiple data-fichiers="${p.id}" hidden></label>
          </div>
        </div>
        <div class="carte-plus"><button data-action="preuve-modifier" data-id="${p.id}">Modifier</button></div>
      </article>`;
  }

  // ---------- Vue Suivi (chronologie, échéances, indemnisation) ----------
  function vueSuivi() {
    const d = dossier();
    const evs = R.evenementsTries(d).reverse();
    const tot = R.totaux(d, E.reglages);
    const ind = d.indemnisation;
    const ech = R.echeances(d, auj(), E.reglages.alerte);
    return `
      ${choixDossier()}
      <div class="vue-tete"><div><h1>Suivi</h1><p>La chronologie du dossier, de la découverte à la clôture : chaque étape avec sa date, sa description et ses justificatifs. Le statut du dossier en découle.</p></div>
        <div class="actions"><button class="btn primaire" data-action="evenement-nouveau">${ICONES.plus}Étape</button></div></div>
      <div class="suivi-grille">
        <section>
          <h2 class="titre-section">Chronologie <span>${pluriel(evs.length, 'événement')}</span></h2>
          ${evs.length ? `<ol class="chrono">${evs.map((e) => { const n = d.preuves.filter((p) => p.evenementId === e.id).length; return `<li><i></i><div><p class="chrono-date">${fmt(e.date)}</p><h3>${esc(R.evenementDe(e.type).nom)}</h3>${e.description ? `<p>${esc(e.description)}</p>` : ''}${n ? `<p class="chrono-preuves">${pluriel(n, 'justificatif')}</p>` : ''}<button class="btn lien" data-action="evenement-modifier" data-id="${e.id}">Modifier</button></div></li>`; }).join('')}</ol>`
            : videEtat('Aucune étape', 'Ajoute la découverte, la déclaration, l\'expertise…', `<button class="btn primaire" data-action="evenement-nouveau">${ICONES.plus}Étape</button>`, true)}
          <div class="suggestions">${suggestionEtapes(d)}</div>
        </section>
        <section>
          <h2 class="titre-section">Indemnisation</h2>
          <div class="bloc">
            <dl class="fiche">
              <div><dt>Déclaré par toi</dt><dd>${eur(tot.declare)}</dd></div>
              <div><dt>Proposition de l'assureur</dt><dd>${ind.proposition === null || ind.proposition === '' ? '<em>pas encore</em>' : eur(Number(ind.proposition))}</dd></div>
              <div><dt>Franchise</dt><dd>${ind.franchise === null || ind.franchise === '' ? '–' : `${eur(Number(ind.franchise))}${ind.franchiseIncluse ? ' (déjà déduite)' : ''}`}</dd></div>
              <div><dt>Net attendu</dt><dd>${tot.net === null ? '–' : eur(tot.net)}</dd></div>
              <div><dt>Versé</dt><dd>${eur(tot.verse)}</dd></div>
              <div><dt>Reste à recevoir</dt><dd><b>${tot.resteAVerser === null ? '–' : eur(tot.resteAVerser)}</b></dd></div>
              ${tot.ecart !== null && tot.ecart > 0 ? `<div class="large"><dt>Écart avec ta déclaration</dt><dd>${eur(tot.ecart)} : compare poste par poste avec l'expertise avant d'accepter.</dd></div>` : ''}
            </dl>
            <div class="rang"><button class="btn petit" data-action="indemnisation">Saisir la proposition</button><button class="btn petit" data-action="versement-nouveau">${ICONES.plus}Versement</button></div>
            ${ind.versements.length ? `<ul class="versements">${ind.versements.map((v) => `<li><span>${fmtCourt(v.date)}</span><b>${eur(Number(v.montant))}</b><button class="btn lien" data-action="versement-suppr" data-id="${v.id}" aria-label="Supprimer le versement du ${fmtCourt(v.date)}">Supprimer</button></li>`).join('')}</ul>` : ''}
          </div>
          <h2 class="titre-section">Échéances <span>${pluriel(ech.filter((e) => e.etat !== 'faite').length, 'en cours', 'en cours')}</span></h2>
          <div class="bloc">${ech.length ? `<ul class="echeances">${ech.map(ligneEcheance).join('')}</ul>` : '<p class="bloc-vide">Aucune échéance.</p>'}<div class="rang"><button class="btn petit" data-action="echeance-nouvelle">${ICONES.plus}Échéance</button></div></div>
        </section>
      </div>`;
  }

  // Propose l'étape suivante logique (un clic pour l'ajouter avec la date du jour).
  function suggestionEtapes(d) {
    const faits = new Set(d.evenements.map((e) => e.type));
    const suite = ['declaration', 'accuse', 'expertise', 'devis', 'proposition', 'acceptation', 'versement', 'reparation', 'cloture'].filter((c) => !faits.has(c));
    if (faits.has('cloture') || !suite.length) return '';
    const proposees = suite.slice(0, 2);
    return `<p class="aide">Étape suivante : ${proposees.map((c) => `<button class="btn petit" data-action="evenement-nouveau" data-type="${c}">${ICONES.plus}${esc(R.evenementDe(c).nom)}</button>`).join(' ')}</p>`;
  }

  // ---------- Vue Documents (rapport, courriers, repères) ----------
  function vueDocuments() {
    const types = [['rapport', 'Rapport'], ['courriers', 'Courriers'], ['reperes', 'Repères et sources']];
    let contenu = '';
    if (docChoix === 'rapport') {
      contenu = `<div class="doc-actions"><button class="btn primaire" data-action="imprimer">Imprimer ou PDF</button><button class="btn petit" data-action="csv" data-quoi="dommages">Inventaire (CSV)</button><button class="btn petit" data-action="csv" data-quoi="preuves">Justificatifs (CSV)</button><button class="btn petit" data-action="csv" data-quoi="chronologie">Chronologie (CSV)</button><button class="btn petit" data-action="exporter">Copie complète (JSON)</button></div>
        <div class="pv-cadre"><article class="pv-doc rapport" id="doc-imprimable">${documentRapport()}</article></div>`;
    } else if (docChoix === 'courriers') {
      const d = dossier();
      const modeles = B.courriers.filter((c) => !c.pour || c.pour === d.type);
      if (!modeles.some((c) => c.code === courrierChoix)) courrierChoix = modeles[0].code;
      const c = modeles.find((x) => x.code === courrierChoix);
      const v = valeursCourrier(d);
      contenu = `<div class="filtres pv-choix courrier-choix"><label class="champ">Modèle<select data-choix="courrier">${modeles.map((x) => `<option value="${x.code}" ${x.code === c.code ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label></div>
        <div class="courrier">
          <label class="champ">Objet<input id="courrier-objet" value="${esc(R.remplir(c.objet, v))}"></label>
          <label class="champ">Texte<small>Remplace chaque « [à compléter] » et relis avant l'envoi. Aucun envoi automatique : copie le texte dans ton e-mail ou ton espace client, ou imprime-le.</small><textarea id="courrier-texte" rows="18">${esc(R.remplir(c.texte, v))}</textarea></label>
          ${c.pieces.length ? `<div class="bloc"><h3>Pièces à joindre</h3><ul class="liste-puces">${c.pieces.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
          <div class="rang"><button class="btn primaire" data-action="copier-courrier">Copier le texte</button><button class="btn" data-action="imprimer-courrier">Imprimer</button></div>
          <p class="note">Pour une contestation ou une mise en demeure, un envoi recommandé avec accusé de réception garde une date certaine. Ces modèles ne sont pas des conseils juridiques.</p>
        </div>`;
    } else contenu = vueReperes();
    return `
      ${choixDossier()}
      <div class="vue-tete"><div><h1>Documents</h1><p>Le dossier complet à imprimer pour ton assureur ou ton expert, des courriers prêts à adapter, et les repères juridiques avec leurs sources.</p></div></div>
      <fieldset class="champ bascule doc-bascule"><legend class="sr-only">Document</legend><div>${types.map(([v, l]) => `<label><input type="radio" name="doc" data-choix="doc" value="${v}" ${docChoix === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      ${contenu}`;
  }

  function valeursCourrier(d) {
    const tot = R.totaux(d, E.reglages);
    const ty = R.typeDe(d.type);
    const faites = R.typeDe(d.type).mesures.filter((c) => d.mesures[c] === 'fait').map((c) => B.mesures[c].replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase()));
    return { circonstances: d.circonstances, contrat: d.contrat, survenu: R.dateFr(d.survenu), decouvert: R.dateFr(d.decouvert || d.survenu), lieu: d.lieu, type: `${ty.nom.toLowerCase()}${d.sousType ? ` (${d.sousType.toLowerCase()})` : ''}`,
      pieces: d.pieces.join(', ').toLowerCase(), mesures: faites.join(' ; '), estime: tot.declare ? eur(tot.declare) : '', numero: d.numero, declareLe: R.dateFr(d.declareLe),
      nbDommages: pluriel(d.dommages.length, 'bien'), reconnu: tot.reconnu === null ? '' : eur(tot.reconnu) };
  }

  function documentRapport() {
    const d = dossier(), t = auj(), ty = R.typeDe(d.type);
    const tot = R.totaux(d, E.reglages);
    const evs = R.evenementsTries(d);
    const mesures = ty.mesures.filter((c) => d.mesures[c] === 'fait').map((c) => B.mesures[c]);
    const lignes = d.dommages.map((x) => { const m = R.montants(x, E.reglages, d.survenu); return `<tr><td>${esc(x.piece || '–')}</td><td>${esc(x.designation)}${x.marque ? `<br><small>${esc(x.marque)}</small>` : ''}</td><td>${esc(nomCat(x.categorie))}</td><td class="date">${fmtCourt(x.achatLe)}</td><td class="num">${eur(nombre(x.prixAchat))}</td><td>${esc(x.etatApres || '–')}</td><td>${{ reparation: 'Réparation', remplacement: 'Remplacement', valeur: 'Valeur actuelle' }[m.methode]}${m.methode === 'remplacement' && m.base !== null ? `<br><small>${eur(m.base)} − ${m.vetuste.taux} %</small>` : ''}</td><td class="num">${eur(m.estime)}</td><td class="num"><b>${eur(m.declare)}</b></td></tr>`; }).join('');
    const parCat = Object.entries(tot.parCategorie).sort((a, b) => b[1] - a[1]);
    const photos = d.preuves.flatMap((p) => p.photos.map((id) => [id, p.libelle]));
    return `
      <header class="garde">
        <p class="pv-structure">Dossier de sinistre habitation</p>
        <h2>${esc(titreDossier(d))}</h2>
        <dl>
          <div><dt>Nature</dt><dd>${esc(ty.nom)}${d.sousType ? ` · ${esc(d.sousType)}` : ''}${d.catnat ? ' · catastrophe naturelle' : ''}</dd></div>
          <div><dt>Date du sinistre</dt><dd>${fmtCourt(d.survenu)}${d.decouvert && d.decouvert !== d.survenu ? ` (découvert le ${fmtCourt(d.decouvert)})` : ''}</dd></div>
          <div><dt>Logement</dt><dd>${esc(d.lieu) || '–'}</dd></div>
          <div><dt>Assureur</dt><dd>${esc(d.assureur) || '–'}${d.contrat ? `<br>Contrat ${esc(d.contrat)}` : ''}</dd></div>
          <div><dt>Déclaration</dt><dd>${d.declareLe ? `Le ${fmtCourt(d.declareLe)}` : 'Non déclarée'}${d.numero ? `<br>N° ${esc(d.numero)}` : ''}</dd></div>
          <div><dt>Établi le</dt><dd>${fmtCourt(t)} · statut : ${esc(nomStatut(R.statut(d)))}</dd></div>
        </dl>
      </header>
      <h3>1. Résumé du sinistre</h3>
      ${d.circonstances ? `<p class="pv-texte">${esc(d.circonstances)}</p>` : ''}
      <ul class="liste-puces">
        <li>Pièces touchées : ${esc(d.pieces.join(', ') || 'non précisées')}.</li>
        ${d.tiers.length || d.tiersNote ? `<li>Tiers concernés : ${esc([d.tiers.join(', '), d.tiersNote].filter(Boolean).join(' · ').replace(/\.+$/, ''))}.</li>` : ''}
        <li>Mesures conservatoires prises : ${mesures.length ? esc(mesures.join(' ')) : 'aucune renseignée.'}</li>
      </ul>
      <h3>2. Chronologie</h3>
      ${evs.length ? `<table><thead><tr><th>Date</th><th>Étape</th><th>Description</th></tr></thead><tbody>${evs.map((e) => `<tr><td class="date">${fmtCourt(e.date)}</td><td>${esc(R.evenementDe(e.type).nom)}</td><td>${esc(e.description)}</td></tr>`).join('')}</tbody></table>` : '<p class="pv-vide">Aucune étape renseignée.</p>'}
      <h3>3. Inventaire des dommages (${d.dommages.length})</h3>
      ${d.dommages.length ? `<table class="inventaire"><thead><tr><th>Pièce</th><th>Bien</th><th>Catégorie</th><th>Achat</th><th>Prix d'achat</th><th>État après</th><th>Méthode</th><th>Estimé</th><th>Déclaré</th></tr></thead><tbody>${lignes}</tbody><tfoot><tr><td colspan="7">Total</td><td class="num">${eur(tot.estime)}</td><td class="num"><b>${eur(tot.declare)}</b></td></tr></tfoot></table>` : '<p class="pv-vide">Aucun bien inventorié.</p>'}
      <h3>4. Synthèse financière</h3>
      <table class="synthese"><tbody>
        <tr><td>Montant estimé (calcul de l'outil)</td><td class="num">${eur(tot.estime)}</td></tr>
        <tr><td>dont vétusté déduite</td><td class="num">${eur(tot.vetuste)}</td></tr>
        <tr><td><b>Montant déclaré</b></td><td class="num"><b>${eur(tot.declare)}</b></td></tr>
        <tr><td>Proposition de l'assureur</td><td class="num">${tot.reconnu === null ? 'en attente' : eur(tot.reconnu)}</td></tr>
        <tr><td>Franchise</td><td class="num">${tot.franchise === null ? '–' : eur(tot.franchise)}</td></tr>
        <tr><td>Versé à ce jour</td><td class="num">${eur(tot.verse)}</td></tr>
      </tbody></table>
      ${parCat.length > 1 ? `<p class="pv-texte">Par catégorie (déclaré) : ${parCat.map(([c, v]) => `${esc(nomCat(c))} ${eur(v)}`).join(' · ')}.</p>` : ''}
      <h3>5. Justificatifs (${d.preuves.length})</h3>
      ${d.preuves.length ? `<table><thead><tr><th>Justificatif</th><th>Type</th><th>Statut</th><th>Rattaché à</th></tr></thead><tbody>${d.preuves.map((p) => { const dom = d.dommages.find((x) => x.id === p.dommageId); const ev = d.evenements.find((x) => x.id === p.evenementId); return `<tr><td>${esc(p.libelle)}${p.reference ? `<br><small>${esc(p.reference)}</small>` : ''}</td><td>${esc(nomTypePreuve(p.type))}</td><td>${esc(nomStatutPreuve(p.statut))}</td><td>${esc(dom?.designation || (ev ? R.evenementDe(ev.type).nom : '–'))}</td></tr>`; }).join('')}</tbody></table>` : '<p class="pv-vide">Aucun justificatif.</p>'}
      ${photos.length ? `<div class="planche">${photos.map(([id, l]) => `<figure><div class="vignette" data-photo="${id}" data-alt="${esc(l)}"></div><figcaption>${esc(l)}</figcaption></figure>`).join('')}</div>` : ''}
      <h3>6. Observations</h3>
      ${d.observations ? `<p class="pv-texte">${esc(d.observations)}</p>` : '<p class="pv-vide">Aucune observation.</p>'}
      <div class="signatures"><div><p>Fait par l'assuré</p><p class="sig-lignes">Nom, date<br>Signature</p></div></div>
      <footer>Document établi par l'assuré à partir d'un modèle. Les montants sont des estimations de l'assuré ; ils ne préjugent pas de l'indemnisation, qui dépend du contrat et de l'expertise. Ni conseil juridique, ni expertise d'assurance.</footer>`;
  }

  function vueReperes() {
    const S = B.sources || [];
    const D = B.delais || {};
    const regles = Object.values(D);
    return `
      <div class="reperes">
        <section class="legal"><h2>Délais indicatifs</h2>
          <p>Ces délais viennent de la loi ; <b>ton contrat peut prévoir plus long</b>, jamais plus court pour la déclaration. Vérifie les conditions de ton contrat et, en cas de doute, demande à ton assureur ou à un professionnel du droit.</p>
          <ul>${regles.map((r) => `<li><b>${esc(r.libelle)}</b> : ${esc(r.resume)} <a href="#" data-action="voir-source" data-source="${r.source}">Source</a></li>`).join('')}</ul>
        </section>
        <section class="legal"><h2>Repères</h2><ul>${(B.reperes || []).map((r) => `<li>${esc(r.texte)}${r.source ? ` <a href="#" data-action="voir-source" data-source="${r.source}">Source</a>` : ''}</li>`).join('')}</ul></section>
        <h2 class="titre-section">Sources <span>Vérifiées à la date indiquée ; la loi peut changer.</span></h2>
        <ol class="sources">${S.map((s) => `<li id="source-${s.id}"><b>${esc(s.titre)}</b><span>${esc(s.nature)} · fiabilité : ${esc(s.fiabilite)} · vérifié le ${esc(s.verifie)}</span><a href="${s.url}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\/(www\.)?/, '').slice(0, 70))}</a></li>`).join('')}</ol>
        <h2 class="titre-section">Limites</h2>
        <ul class="limites">
          <li><b>Pas un conseil</b> : l'outil organise ton dossier et calcule des estimations. Il ne remplace ni ton assureur, ni un expert, ni un avocat, et ne garantit aucune indemnisation.</li>
          <li><b>Vétusté</b> : aucun barème n'est imposé ; les taux sont ceux que tu saisis (contrat, expert).</li>
          <li><b>Photos et documents</b> : gardés sur l'appareil qui les a ajoutés, dans le stockage du navigateur. Ils ne sont pas sauvegardés en ligne : télécharge une copie avec les photos et garde tes originaux.</li>
          <li><b>Données</b> : n'y mets ni coordonnées bancaires, ni mot de passe, ni données de santé.</li>
        </ul>
      </div>`;
  }

  function imprimer(html) {
    const zone = $('#impression');
    zone.innerHTML = html;
    hydrater(zone).then(() => window.print());
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
  const piedModale = (suppr) => `<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>${suppr ? '<button class="btn danger gauche" value="supprimer">Supprimer</button>' : ''}`;
  const montantChamp = (nom, libelle, v, aide = '') => `<label class="champ">${libelle}${aide ? `<small>${aide}</small>` : ''}<input type="number" name="${nom}" min="0" step="0.01" inputmode="decimal" value="${v === null || v === undefined ? '' : esc(v)}"></label>`;
  const lireMontant = (f, k) => { const v = String(f.get(k) ?? '').replace(',', '.').trim(); if (v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN; };
  const texte = (f, k) => String(f.get(k) || '').trim();

  // Garde une copie du dossier pour « Annuler » après une suppression.
  function avecAnnulation(message) {
    const id = E.actif;
    const avant = structuredClone(dossier());
    annulation = () => { const i = E.dossiers.findIndex((x) => x.id === id); if (i >= 0) E.dossiers[i] = avant; else E.dossiers.push(avant); E.actif = id; };
    return () => { sauver(); rendre(); toast(message, { libelle: 'Annuler', faire: annuler }); };
  }

  function modaleDossier() {
    const d = dossier();
    const ty = R.typeDe(d.type);
    const corps = `
      <div class="grille-2">
        <label class="champ">Nom du dossier<input name="titre" maxlength="80" value="${esc(d.titre)}" placeholder="${esc(titreDossier({ ...d, titre: '' }))}"></label>
        <label class="champ">Type<select name="type">${B.types.map((x) => `<option value="${x.code}" ${x.code === d.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Date du sinistre<input type="date" name="survenu" value="${d.survenu || ''}" max="${auj()}" required></label>
        <label class="champ">Date de découverte<input type="date" name="decouvert" value="${d.decouvert || ''}" max="${auj()}"></label>
        <label class="champ">Logement<input name="lieu" maxlength="80" value="${esc(d.lieu)}"></label>
        ${ty.catnat ? `<label class="champ">Événement<select name="sousType">${B.sousTypesClimat.map((s) => `<option ${d.sousType === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <div class="champ"><span>Catastrophe naturelle</span><label class="case"><input type="checkbox" name="catnat" ${d.catnat ? 'checked' : ''}> Arrêté concernant ma commune</label></div>
        <label class="champ">Publication de l'arrêté (JO)<input type="date" name="arreteLe" value="${d.arreteLe || ''}"></label>` : ''}
        <label class="champ">Assureur<input name="assureur" maxlength="80" value="${esc(d.assureur)}"></label>
        <label class="champ">Numéro de contrat<small>Facultatif.</small><input name="contrat" maxlength="60" value="${esc(d.contrat)}"></label>
        <label class="champ">Date de déclaration<input type="date" name="declareLe" value="${d.declareLe || ''}" max="${auj()}"></label>
        <label class="champ">Numéro de sinistre<input name="numero" maxlength="60" value="${esc(d.numero)}"></label>
      </div>
      <fieldset class="champ"><legend>Pièces touchées</legend><div class="choix-lots compact">${[...new Set([...B.pieces, ...d.pieces])].map((p) => `<label class="case"><input type="checkbox" name="piece" value="${esc(p)}" ${d.pieces.includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')}</div></fieldset>
      <fieldset class="champ"><legend>Tiers concernés</legend><div class="choix-lots compact">${B.tiers.map((x) => `<label class="case"><input type="checkbox" name="tiers" value="${esc(x)}" ${d.tiers.includes(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</div></fieldset>
      <label class="champ">Précisions sur les tiers<small>Sans coordonnées.</small><input name="tiersNote" maxlength="200" value="${esc(d.tiersNote)}"></label>
      <label class="champ">Circonstances<textarea name="circonstances" rows="3" maxlength="1500">${esc(d.circonstances)}</textarea></label>
      <label class="champ">Observations<small>Reprises en fin de rapport.</small><textarea name="observations" rows="3" maxlength="3000">${esc(d.observations)}</textarea></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Dossier', corps, piedModale(true), (f, v) => {
      if (v === 'supprimer') {
        if (!confirm(`Supprimer le dossier « ${titreDossier(d)} » et tout son contenu ?`)) return false;
        const fin = avecAnnulation('Dossier supprimé.');
        E.dossiers = E.dossiers.filter((x) => x.id !== d.id);
        E.actif = E.dossiers[0]?.id || null;
        if (!E.dossiers.length) { sauver(); assistant(true); return; }
        fin(); return;
      }
      const survenu = f.get('survenu'), decouvert = f.get('decouvert') || survenu;
      if (!R.estDate(survenu)) return 'Indique la date du sinistre.';
      if (decouvert < survenu) return 'La découverte ne peut pas précéder le sinistre.';
      const nouveauType = f.get('type');
      Object.assign(d, { titre: texte(f, 'titre'), type: nouveauType, survenu, decouvert, lieu: texte(f, 'lieu'), assureur: texte(f, 'assureur'), contrat: texte(f, 'contrat'),
        declareLe: f.get('declareLe') || null, numero: texte(f, 'numero'), pieces: f.getAll('piece'), tiers: f.getAll('tiers'), tiersNote: texte(f, 'tiersNote'),
        circonstances: texte(f, 'circonstances'), observations: texte(f, 'observations') });
      if (R.typeDe(nouveauType).catnat) Object.assign(d, { sousType: f.get('sousType') || d.sousType || B.sousTypesClimat[0], catnat: f.has('catnat'), arreteLe: f.get('arreteLe') || null });
      else Object.assign(d, { sousType: '', catnat: false, arreteLe: null });
      if (d.declareLe && !d.evenements.some((e) => e.type === 'declaration')) d.evenements.push({ id: uid(), type: 'declaration', date: d.declareLe, description: d.numero ? `Numéro de dossier : ${d.numero}` : '' });
      sauver(); rendre(); toast('Dossier enregistré.');
    });
  }

  function modaleDeclarer() {
    const d = dossier();
    const corps = `<div class="grille-2">
        <label class="champ">Date de déclaration<input type="date" name="declareLe" value="${auj()}" max="${auj()}" required></label>
        <label class="champ">Numéro de sinistre<small>Facultatif.</small><input name="numero" maxlength="60" value="${esc(d.numero)}"></label>
        <label class="champ">Assureur<input name="assureur" maxlength="80" value="${esc(d.assureur)}"></label>
        <label class="champ">Moyen<select name="moyen"><option>Espace client en ligne</option><option>Téléphone</option><option>Lettre recommandée</option><option>E-mail</option><option>Agence</option></select></label>
      </div><p class="aide">Garde une preuve de la date : accusé de réception, capture de l'espace client, e-mail de confirmation.</p><p class="erreur" role="alert"></p>`;
    ouvrirModale('Déclaration faite', corps, piedModale(false), (f) => {
      const date = f.get('declareLe');
      if (!R.estDate(date)) return 'Indique la date.';
      Object.assign(d, { declareLe: date, numero: texte(f, 'numero') || d.numero, assureur: texte(f, 'assureur') || d.assureur });
      d.evenements.push({ id: uid(), type: 'declaration', date, description: `${f.get('moyen')}${d.numero ? ` · n° ${d.numero}` : ''}` });
      sauver(); rendre(); toast('Déclaration enregistrée dans la chronologie.');
    });
  }

  function modaleDommage(id) {
    const d = dossier();
    const x = id ? dommage(id) : null;
    const pieces = [...new Set([...d.pieces, ...B.pieces])];
    const cat = x?.categorie || '';
    const m = x ? R.montants(x, E.reglages, d.survenu) : null;
    const corps = `
      <div class="grille-2">
        <label class="champ">Désignation<input name="designation" required maxlength="120" value="${esc(x?.designation || '')}" placeholder="Ex. : Canapé 3 places" list="liste-biens"></label>
        <label class="champ">Catégorie<select name="categorie"><option value="">Autre</option>${B.categories.map((c) => `<option value="${c.code}" ${c.code === cat ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
        <label class="champ">Pièce<select name="piece"><option value="">À préciser</option>${pieces.map((p) => `<option ${x?.piece === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
        <label class="champ">Marque<small>Facultatif.</small><input name="marque" maxlength="60" value="${esc(x?.marque || '')}"></label>
        <label class="champ">Date d'achat<small>Même approximative.</small><input type="date" name="achatLe" value="${x?.achatLe || ''}" max="${auj()}"></label>
        ${montantChamp('prixAchat', 'Prix d\'achat (€)', x?.prixAchat)}
        <label class="champ">État avant<input name="etatAvant" maxlength="60" value="${esc(x?.etatAvant || '')}" list="liste-etats"></label>
        <label class="champ">État après<input name="etatApres" maxlength="80" value="${esc(x?.etatApres || '')}" list="liste-etats"></label>
        <label class="champ">Réparabilité<select name="reparable">${B.reparabilite.map(([c, n]) => `<option value="${c}" ${(x?.reparable || 'inconnu') === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="champ">Méthode de calcul<select name="methode"><option value="">Automatique</option><option value="reparation" ${x?.methode === 'reparation' ? 'selected' : ''}>Coût de réparation</option><option value="remplacement" ${x?.methode === 'remplacement' ? 'selected' : ''}>Remplacement moins vétusté</option><option value="valeur" ${x?.methode === 'valeur' ? 'selected' : ''}>Valeur actuelle estimée</option></select></label>
      </div>
      <fieldset class="champ montants"><legend>Montants</legend><div class="grille-2">
        ${montantChamp('coutReparation', 'Coût de réparation (€)', x?.coutReparation, 'Devis ou estimation.')}
        ${montantChamp('coutRemplacement', 'Coût de remplacement (€)', x?.coutRemplacement, 'Prix d\'un bien équivalent neuf.')}
        ${montantChamp('valeurEstimee', 'Valeur actuelle estimée (€)', x?.valeurEstimee, 'Ce que vaut le bien aujourd\'hui, usure comprise.')}
        <label class="champ">Vétusté (%)<small>Vide : taux de la catégorie × âge (Réglages).</small><input type="number" name="vetuste" min="0" max="100" step="0.1" inputmode="decimal" value="${x?.vetuste ?? ''}"></label>
        ${montantChamp('montantDeclare', 'Montant déclaré (€)', x?.montantDeclare, 'Vide : le montant estimé.')}
      </div></fieldset>
      ${m ? `<p class="aide calcul-aide">Calcul actuel : ${esc(m.detail)}${m.estime !== null ? ` → ${eur(m.estime)}` : ''}.</p>` : ''}
      <label class="champ">Commentaires<textarea name="commentaire" rows="2" maxlength="600">${esc(x?.commentaire || '')}</textarea></label>
      <datalist id="liste-biens">${B.categories.flatMap((c) => c.biens).map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <datalist id="liste-etats">${B.etats.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(x ? 'Modifier le bien' : 'Nouveau bien', corps, piedModale(!!x) + (x ? '' : '<button class="btn gauche" value="encore">Enregistrer et ajouter</button>'), (f, v) => {
      if (v === 'supprimer') {
        if (!confirm(`Supprimer « ${x.designation} » de l'inventaire ?`)) return false;
        const fin = avecAnnulation('Bien supprimé.');
        d.dommages = d.dommages.filter((y) => y.id !== x.id);
        d.preuves.forEach((p) => { if (p.dommageId === x.id) p.dommageId = null; });
        fin(); return;
      }
      const designation = texte(f, 'designation');
      if (!designation) return 'Indique la désignation du bien.';
      const montantsLus = Object.fromEntries(['prixAchat', 'coutReparation', 'coutRemplacement', 'valeurEstimee', 'montantDeclare'].map((k) => [k, lireMontant(f, k)]));
      if (Object.values(montantsLus).some(Number.isNaN)) return 'Montants : des nombres positifs (ex. : 249,90).';
      const vet = String(f.get('vetuste') || '').replace(',', '.').trim();
      const vetuste = vet === '' ? null : Number(vet);
      if (vetuste !== null && !(vetuste >= 0 && vetuste <= 100)) return 'Vétusté : entre 0 et 100 %.';
      const champs = { designation, categorie: f.get('categorie'), piece: f.get('piece'), marque: texte(f, 'marque'), achatLe: f.get('achatLe') || null, ...montantsLus, vetuste,
        etatAvant: texte(f, 'etatAvant'), etatApres: texte(f, 'etatApres'), reparable: f.get('reparable'), methode: f.get('methode'), commentaire: texte(f, 'commentaire') };
      if (x) Object.assign(x, champs); else d.dommages.push(R.normaliserDossier({ dommages: [{ id: uid(), ...champs }] }).dommages[0]);
      sauver(); rendre(); toast(x ? 'Bien modifié.' : `« ${designation} » ajouté à l'inventaire.`);
      if (v === 'encore') { setTimeout(() => modaleDommage(), 50); }
    });
  }

  // Ajout groupé depuis la bibliothèque de biens courants.
  function modaleBibliotheque() {
    const d = dossier();
    const pieces = [...new Set([...d.pieces, ...B.pieces])];
    const corps = `
      <label class="champ">Pièce des biens ajoutés<select name="piece"><option value="">À préciser</option>${pieces.map((p) => `<option ${d.pieces.length === 1 && d.pieces[0] === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      ${B.categories.map((c) => `<details class="cat-biens"><summary>${esc(c.nom)}</summary><div class="choix-lots compact">${c.biens.map((n) => `<label class="case"><input type="checkbox" name="bien" value="${c.code}|${esc(n)}"> ${esc(n)}</label>`).join('')}</div></details>`).join('')}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Bibliothèque de biens', corps, '<button class="btn primaire" value="ok">Ajouter à l\'inventaire</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const biens = f.getAll('bien');
      if (!biens.length) return 'Coche au moins un bien.';
      for (const b of biens) { const [categorie, designation] = b.split('|'); d.dommages.push(R.normaliserDossier({ dommages: [{ id: uid(), categorie, designation, piece: f.get('piece'), reparable: d.type === 'vol' ? 'disparu' : 'inconnu', etatApres: d.type === 'vol' ? 'Disparu' : '' }] }).dommages[0]); }
      sauver(); rendre(); toast(`${pluriel(biens.length, 'bien ajouté', 'biens ajoutés')} : complète leurs montants.`);
    });
  }

  function modalePreuve(id) {
    const d = dossier();
    const p = id ? preuve(id) : null;
    const corps = `
      <div class="grille-2">
        <label class="champ">Intitulé<input name="libelle" required maxlength="120" value="${esc(p?.libelle || '')}" placeholder="Ex. : Facture du canapé"></label>
        <label class="champ">Type<select name="type">${B.typesPreuve.map(([c, n]) => `<option value="${c}" ${(p?.type || 'photo') === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="champ">Statut<select name="statut">${B.statutsPreuve.map(([c, n]) => `<option value="${c}" ${(p?.statut || 'recu') === c ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="champ">Date du document<input type="date" name="date" value="${p?.date || ''}"></label>
        <label class="champ">Bien concerné<select name="dommageId"><option value="">Aucun</option>${d.dommages.map((x) => `<option value="${x.id}" ${p?.dommageId === x.id ? 'selected' : ''}>${esc(x.designation)}</option>`).join('')}</select></label>
        <label class="champ">Étape concernée<select name="evenementId"><option value="">Aucune</option>${R.evenementsTries(d).map((e) => `<option value="${e.id}" ${p?.evenementId === e.id ? 'selected' : ''}>${esc(R.evenementDe(e.type).nom)} · ${fmtCourt(e.date)}</option>`).join('')}</select></label>
      </div>
      <label class="champ">Référence du fichier<small>Nom ou emplacement de l'original : « IMG_2041 », « Drive / Sinistre ».</small><input name="reference" maxlength="120" value="${esc(p?.reference || '')}"></label>
      <label class="champ">Note<textarea name="note" rows="2" maxlength="600">${esc(p?.note || '')}</textarea></label>
      ${p?.photos.length ? `<fieldset class="champ"><legend>Photos et documents sur cet appareil</legend><div class="vignettes">${p.photos.map((ph) => `<div class="vignette-suppr"><div class="vignette" data-photo="${ph}"></div><label class="case"><input type="checkbox" name="retirer" value="${ph}"> Retirer</label></div>`).join('')}</div></fieldset>` : ''}
      ${p ? '' : '<label class="champ">Photos ou PDF<small>Facultatif : gardés sur cet appareil uniquement.</small><input type="file" name="fichiers" accept="image/*,application/pdf" multiple></label>'}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(p ? 'Modifier le justificatif' : 'Nouveau justificatif', corps, piedModale(!!p), (f, v) => {
      if (v === 'supprimer') {
        if (!confirm(`Supprimer « ${p.libelle} » ?`)) return false;
        const fin = avecAnnulation('Justificatif supprimé.');
        d.preuves = d.preuves.filter((y) => y.id !== p.id);
        fin(); return;
      }
      const libelle = texte(f, 'libelle');
      if (!libelle) return 'Indique l\'intitulé.';
      const champs = { libelle, type: f.get('type'), statut: f.get('statut'), date: f.get('date') || null, dommageId: f.get('dommageId') || null, evenementId: f.get('evenementId') || null, reference: texte(f, 'reference'), note: texte(f, 'note') };
      const retirer = f.getAll('retirer');
      let cible = p;
      if (p) { Object.assign(p, champs); p.photos = p.photos.filter((x) => !retirer.includes(x)); retirer.forEach((x) => Photos.supprimer(x)); } else { cible = { id: uid(), code: null, photos: [], ...champs }; d.preuves.push(cible); }
      const fichiers = f.getAll('fichiers').filter((x) => x && x.size);
      sauver(); rendre();
      if (fichiers.length) ajouterFichiers(cible.id, fichiers); else toast(p ? 'Justificatif modifié.' : 'Justificatif ajouté.');
    });
    hydrater(modale());
  }

  async function ajouterFichiers(preuveId, fichiers) {
    const p = preuve(preuveId);
    if (!p) return;
    let ok = 0;
    const erreurs = [];
    for (const fichier of fichiers) {
      try {
        const blob = await preparerFichier(fichier);
        p.photos.push(await Photos.ajouter(blob, fichier.name));
        ok += 1;
      } catch (x) { erreurs.push(x.message === 'indisponible' ? 'Stockage du navigateur indisponible (navigation privée ?).' : x.message); }
    }
    if (ok && p.statut === 'a-fournir') p.statut = 'recu';
    if (ok && !p.date) p.date = auj();
    sauver(); rendre();
    toast(erreurs.length ? erreurs[0] : `${pluriel(ok, 'fichier ajouté', 'fichiers ajoutés')} sur cet appareil.`);
  }

  async function voirPhoto(preuveId, photoId) {
    const p = preuve(preuveId);
    const ph = await Photos.lire(photoId);
    if (!p || !ph) { toast('Ce fichier est sur un autre appareil.'); return; }
    const u = await Photos.url(photoId);
    const corps = ph.type === 'application/pdf' ? `<p><a class="btn" href="${u}" target="_blank" rel="noopener">Ouvrir le PDF</a></p>` : `<img class="photo-grande" src="${u}" alt="${esc(p.libelle)}">`;
    ouvrirModale(esc(p.libelle), `${corps}<p class="aide">${esc(ph.nom || '')} · ${Math.max(1, Math.round(ph.taille / 1000))} Ko · gardé sur cet appareil.</p>`, '<button class="btn primaire" value="annuler">Fermer</button><button class="btn danger gauche" value="supprimer">Retirer la photo</button>', (_, v) => {
      if (v !== 'supprimer') return;
      if (!confirm('Retirer ce fichier du dossier et de cet appareil ?')) return false;
      p.photos = p.photos.filter((x) => x !== photoId);
      Photos.supprimer(photoId);
      sauver(); rendre(); toast('Fichier retiré.');
    });
  }

  function modaleEvenement(id, typeDefaut) {
    const d = dossier();
    const e = id ? evenement(id) : null;
    const corps = `
      <div class="grille-2">
        <label class="champ">Étape<select name="type">${B.evenements.map((x) => `<option value="${x.code}" ${(e?.type || typeDefaut || 'expertise') === x.code ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
        <label class="champ">Date<input type="date" name="date" value="${e?.date || auj()}" required></label>
      </div>
      <label class="champ">Description<textarea name="description" rows="3" maxlength="800" placeholder="Ex. : visite de l'expert, montant proposé, interlocuteur (fonction)…">${esc(e?.description || '')}</textarea></label>
      ${e ? `<p class="aide">${pluriel(d.preuves.filter((p) => p.evenementId === e.id).length, 'justificatif rattaché', 'justificatifs rattachés')} à cette étape (onglet Preuves).</p>` : ''}
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'étape' : 'Nouvelle étape', corps, piedModale(!!e), (f, v) => {
      if (v === 'supprimer') {
        const fin = avecAnnulation('Étape supprimée.');
        d.evenements = d.evenements.filter((x) => x.id !== e.id);
        d.preuves.forEach((p) => { if (p.evenementId === e.id) p.evenementId = null; });
        fin(); return;
      }
      const date = f.get('date');
      if (!R.estDate(date)) return 'Indique la date.';
      const champs = { type: f.get('type'), date, description: texte(f, 'description') };
      if (e) Object.assign(e, champs); else d.evenements.push({ id: uid(), ...champs });
      if (champs.type === 'declaration' && !d.declareLe) d.declareLe = date;
      sauver(); rendre(); toast(`${R.evenementDe(champs.type).nom} : ${fmtCourt(date)}. Statut : ${nomStatut(R.statut(d))}.`);
    });
  }

  function modaleEcheance(id) {
    const d = dossier();
    const e = id ? d.echeances.find((x) => x.id === id) : null;
    const corps = `
      <label class="champ">Intitulé<input name="libelle" required maxlength="100" value="${esc(e?.libelle || '')}" placeholder="Ex. : délai prévu par mon contrat, rendez-vous de l'expert"></label>
      <div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${e?.date || ajout(auj(), 7)}" required></label>
      <div class="champ"><span>État</span><label class="case"><input type="checkbox" name="fait" ${e?.fait ? 'checked' : ''}> Fait</label></div></div>
      <label class="champ">Note<input name="note" maxlength="200" value="${esc(e?.note || '')}"></label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale(e ? 'Modifier l\'échéance' : 'Nouvelle échéance', corps, piedModale(!!e), (f, v) => {
      if (v === 'supprimer') { const fin = avecAnnulation('Échéance supprimée.'); d.echeances = d.echeances.filter((x) => x.id !== e.id); fin(); return; }
      const libelle = texte(f, 'libelle'), date = f.get('date');
      if (!libelle) return 'Indique l\'intitulé.';
      if (!R.estDate(date)) return 'Indique la date.';
      const champs = { libelle, date, fait: f.has('fait'), note: texte(f, 'note') };
      if (e) Object.assign(e, champs); else d.echeances.push({ id: uid(), ...champs });
      sauver(); rendre(); toast('Échéance enregistrée.');
    });
  }

  function modaleIndemnisation() {
    const d = dossier();
    const i = d.indemnisation;
    const corps = `
      <div class="grille-2">
        ${montantChamp('proposition', 'Proposition de l\'assureur (€)', i.proposition, 'Montant total proposé.')}
        ${montantChamp('franchise', 'Franchise (€)', i.franchise, 'Selon ton contrat ou le courrier de l\'assureur.')}
      </div>
      <label class="case"><input type="checkbox" name="franchiseIncluse" ${i.franchiseIncluse ? 'checked' : ''}> La proposition est déjà nette de franchise</label>
      <label class="case"><input type="checkbox" name="etape" checked> Ajouter « Proposition d'indemnisation » à la chronologie</label>
      <p class="erreur" role="alert"></p>`;
    ouvrirModale('Indemnisation', corps, piedModale(false), (f) => {
      const proposition = lireMontant(f, 'proposition'), franchise = lireMontant(f, 'franchise');
      if (Number.isNaN(proposition) || Number.isNaN(franchise)) return 'Montants : des nombres positifs.';
      Object.assign(i, { proposition, franchise, franchiseIncluse: f.has('franchiseIncluse') });
      if (f.has('etape') && proposition !== null && !d.evenements.some((e) => e.type === 'proposition')) d.evenements.push({ id: uid(), type: 'proposition', date: auj(), description: `Proposition : ${eur(proposition)}.` });
      sauver(); rendre(); toast('Indemnisation enregistrée.');
    });
  }

  function modaleVersement() {
    const d = dossier();
    const corps = `<div class="grille-2"><label class="champ">Date<input type="date" name="date" value="${auj()}" required></label>${montantChamp('montant', 'Montant reçu (€)', null)}</div><label class="case"><input type="checkbox" name="etape" checked> Ajouter à la chronologie</label><p class="erreur" role="alert"></p>`;
    ouvrirModale('Versement reçu', corps, piedModale(false), (f) => {
      const montant = lireMontant(f, 'montant'), date = f.get('date');
      if (!montant || Number.isNaN(montant)) return 'Indique le montant reçu.';
      if (!R.estDate(date)) return 'Indique la date.';
      d.indemnisation.versements.push({ id: uid(), date, montant });
      if (f.has('etape')) d.evenements.push({ id: uid(), type: 'versement', date, description: `Versement de ${eur(montant)}.` });
      sauver(); rendre(); toast('Versement enregistré.');
    });
  }

  function voirSource(id) {
    const s = (B.sources || []).find((x) => x.id === id);
    if (!s) return;
    const regles = Object.values(B.delais || {}).filter((r) => r.source === id);
    const corps = `<p><b>${esc(s.titre)}</b></p><p class="aide">${esc(s.nature)} · fiabilité : ${esc(s.fiabilite)} · vérifié le ${esc(s.verifie)}</p>
      ${s.points?.length ? `<ul class="liste-puces">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${regles.length ? `<p>Utilisé pour : ${regles.map((r) => esc(r.libelle)).join(', ')}.</p>` : ''}
      <p><a class="btn" href="${s.url}" target="_blank" rel="noopener">Lire la source officielle</a></p>
      <p class="aide">Repère général : ton contrat peut prévoir des conditions plus favorables. Ce n'est pas un conseil juridique.</p>`;
    ouvrirModale('Source', corps, '<button class="btn primaire" value="annuler">Fermer</button>');
  }

  function modaleReglages() {
    const r = E.reglages;
    const code = session.code ? `${session.code.slice(0, 9)}…${session.code.slice(-4)}` : '';
    const poids = R.taille(E);
    const corps = `
      <div class="groupe"><h3>Vétusté par catégorie</h3>
        <p class="aide">Taux annuel en %, appliqué à l'âge du bien quand aucun taux n'est saisi sur le bien. Vide : aucune vétusté. Reprends les taux de ton contrat ou de l'expert : aucun barème n'est imposé.</p>
        <div class="grille-vetuste">${B.categories.map((c) => `<label class="champ">${esc(c.nom)}<input type="number" name="v-${c.code}" min="0" max="100" step="0.1" inputmode="decimal" value="${r.vetuste[c.code] ?? ''}"></label>`).join('')}</div>
        <div class="grille-2"><label class="champ">Plafond de vétusté (%)<small>Vide : pas de plafond.</small><input type="number" name="plafond" min="0" max="100" step="1" value="${r.plafondVetuste ?? ''}"></label>
        <label class="champ">Alerte avant une échéance (jours)<input type="number" name="alerte" min="0" max="60" value="${r.alerte}"></label></div>
      </div>
      <p class="erreur" role="alert"></p>
      <div class="groupe"><h3>Exports et sauvegarde</h3><p class="aide">${session.demo ? 'En démo, les données restent dans ce navigateur.' : 'Ton dossier est enregistré en ligne avec ta clé.'} Place utilisée en ligne : ${Math.max(1, Math.round(poids / 1000))} Ko sur ${TAILLE_MAX / 1000} Ko (${pluriel(E.dossiers.length, 'dossier')}).</p>
        <div class="rang"><button class="btn petit" type="button" data-action="exporter">Télécharger une copie</button><button class="btn petit" type="button" data-action="exporter-photos">Copie avec les photos</button><label class="btn petit" style="cursor:pointer">Restaurer une copie<input type="file" accept="application/json,.json" id="import" hidden></label></div></div>
      <div class="groupe"><h3>Photos sur cet appareil</h3><p class="aide" id="info-photos">Calcul…</p>
        <div class="rang"><button class="btn petit" type="button" data-action="photos-orphelines">Libérer la place (fichiers non rattachés)</button></div></div>
      <div class="groupe"><h3>Compte</h3>${session.demo ? '<p>Mode démo.</p>' : `<p>Clé ou code d'accès : <span class="code-affiche">${esc(code)}</span></p>`}
        <div class="rang"><button class="btn petit" type="button" data-action="deconnexion">${session.demo ? 'Quitter la démo' : 'Se déconnecter de cet appareil'}</button></div></div>
      <div class="groupe"><h3>Sur téléphone</h3><p class="aide">Ajoute cet outil à ton écran d'accueil pour l'ouvrir comme une application.</p>
        <div class="rang"><button class="btn petit" type="button" data-action="ecran-accueil">Voir comment faire</button></div></div>`;
    ouvrirModale('Réglages', corps, '<button class="btn primaire" value="ok">Enregistrer</button><button class="btn" value="annuler">Annuler</button>', (f) => {
      const vetuste = {};
      for (const c of B.categories) {
        const v = String(f.get(`v-${c.code}`) || '').replace(',', '.').trim();
        if (v === '') continue;
        const n = Number(v);
        if (!(n >= 0 && n <= 100)) return `Vétusté « ${c.nom} » : entre 0 et 100 %.`;
        vetuste[c.code] = n;
      }
      const pl = String(f.get('plafond') || '').trim();
      const plafond = pl === '' ? null : Number(pl);
      if (plafond !== null && !(plafond >= 0 && plafond <= 100)) return 'Plafond : entre 0 et 100 %.';
      const al = Number(f.get('alerte'));
      if (!(Number.isInteger(al) && al >= 0 && al <= 60)) return 'Alerte : entre 0 et 60 jours.';
      Object.assign(r, { vetuste, plafondVetuste: plafond, alerte: al });
      sauver(); rendre(); toast('Réglages enregistrés.');
    });
    (async () => {
      const ids = await Photos.lister();
      const rattaches = new Set(E.dossiers.flatMap((d) => d.preuves.flatMap((p) => p.photos)));
      const el = $('#info-photos');
      if (el) el.textContent = `${pluriel(ids.length, 'fichier')} (${Math.round((await Photos.poids()) / 100000) / 10} Mo), dont ${ids.filter((i) => !rattaches.has(i)).length} non rattaché(s). Ils ne sont pas sauvegardés en ligne.`;
    })();
    $('#import').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        const d = JSON.parse(await fichier.text());
        if (!Array.isArray(d.dossiers)) throw new Error();
        const nbPhotos = Object.keys(d.photos || {}).length;
        if (!confirm(`Remplacer tes données actuelles par cette copie (${pluriel(d.dossiers.length, 'dossier')}${nbPhotos ? `, ${pluriel(nbPhotos, 'photo')}` : ''}) ?`)) return;
        for (const [id, p] of Object.entries(d.photos || {})) {
          const blob = await (await fetch(p.donnees)).blob();
          await Photos.ajouter(blob, p.nom, id);
        }
        delete d.photos;
        E = R.normaliser(d); delete E.majLe;
        modale().close(); sauver(); demarrer(); toast('Copie restaurée.');
      } catch { toast('Ce fichier n\'est pas une copie valide.'); }
    });
  }

  function telecharger(contenu, nom, type) {
    const blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function exporter(avecPhotos) {
    const copie = structuredClone(E);
    delete copie.majLe;
    if (avecPhotos) {
      copie.photos = {};
      const lu = (b) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
      for (const id of new Set(E.dossiers.flatMap((d) => d.preuves.flatMap((p) => p.photos)))) {
        const p = await Photos.lire(id);
        if (p) copie.photos[id] = { nom: p.nom, donnees: await lu(p.blob) };
      }
    }
    telecharger(new Blob([JSON.stringify(copie, null, 2)], { type: 'application/json' }), `dossier-sinistre-${auj()}${avecPhotos ? '-photos' : ''}.json`);
    toast(avecPhotos ? `Copie téléchargée avec ${pluriel(Object.keys(copie.photos).length, 'photo')}.` : 'Copie téléchargée (sans les photos).');
  }

  async function nettoyerPhotos() {
    const rattaches = new Set(E.dossiers.flatMap((d) => d.preuves.flatMap((p) => p.photos)));
    const orphelines = (await Photos.lister()).filter((i) => !rattaches.has(i));
    if (!orphelines.length) { toast('Aucun fichier à libérer.'); return; }
    if (!confirm(`Effacer ${pluriel(orphelines.length, 'fichier non rattaché', 'fichiers non rattachés')} à un justificatif ?`)) return;
    for (const i of orphelines) await Photos.supprimer(i);
    modale().close();
    toast('Place libérée.');
  }

  function exporterCsv(quoi) {
    const d = dossier();
    const f = { dommages: R.csvDommages, preuves: R.csvPreuves, chronologie: R.csvChronologie }[quoi];
    telecharger(f(d, E.reglages), `sinistre-${quoi}-${auj()}.csv`, 'text/csv;charset=utf-8');
    toast('Export CSV téléchargé (séparateur point-virgule).');
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
    const blocs = a === 'ios' ? ETAPES_IOS
      : a === 'android' ? ETAPES_ANDROID
      : `<h3 class="titre-etapes">Sur iPhone ou iPad</h3>${ETAPES_IOS}<h3 class="titre-etapes">Sur Android</h3>${ETAPES_ANDROID}`;
    const corps = `
      <p>Enregistre cet outil sur ton écran d'accueil : il s'ouvre ensuite d'un geste, en plein écran, comme une application, sans rien télécharger dans un magasin d'applications. Pratique pour photographier les dommages et classer les preuves sur place.</p>
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
  function toast(texteToast, action) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(texteToast)}</span>${action ? `<button type="button">${esc(action.libelle)}</button>` : ''}`;
    el.hidden = false;
    if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.faire(); };
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4000);
  }

  // ---------- Actions ----------
  function annuler() {
    if (!annulation) return;
    annulation();
    annulation = null;
    sauver(); rendre();
  }

  function basculerMesure(code, val) {
    const d = dossier();
    d.mesures[code] = d.mesures[code] === val ? '' : val;
    if (!d.mesures[code]) delete d.mesures[code];
    sauver(); rendre();
  }

  async function copierCourrier() {
    const t = `Objet : ${$('#courrier-objet').value}\n\n${$('#courrier-texte').value}`;
    try { await navigator.clipboard.writeText(t); toast('Courrier copié : colle-le dans ton e-mail ou ton espace client.'); } catch { $('#courrier-texte').select(); toast('Sélectionne le texte et copie-le (Ctrl+C ou appui long).'); }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;
    switch (action) {
      case 'demo': ouvrirDemo(); break;
      case 'demo-reinit': if (confirm('Effacer les données de démo et repartir de l\'exemple ?')) { stock.suppr(CLE_DEMO); Photos.vider().then(() => { E = donneesDemo(); cache(); rendre(); photosDemo(); }); } break;
      case 'deconnexion': if (modale().open) modale().close(); deconnecter(undefined, true); break;
      case 'vue': if (modale().open) modale().close(); changerVue(el.dataset.vue); break;
      case 'reglages': modaleReglages(); break;
      case 'ecran-accueil': modaleEcranAccueil(); break;
      case 'installer': installer(); break;
      case 'exporter': exporter(false); break;
      case 'exporter-photos': exporter(true); break;
      case 'photos-orphelines': nettoyerPhotos(); break;
      case 'fermer': modale().close(); break;
      case 'a-type': A.type = el.dataset.code; if (!R.typeDe(A.type).catnat) A.catnat = false; A.etape = 1; rendreAssistant(); break;
      case 'a-retour': lireAssistant(); A.etape -= 1; rendreAssistant(); break;
      case 'a-quitter': A = null; demarrer(); break;
      case 'dossier-nouveau': assistant(false); break;
      case 'dossier-modifier': modaleDossier(); break;
      case 'declarer': modaleDeclarer(); break;
      case 'mesure': basculerMesure(el.dataset.code, el.dataset.val); break;
      case 'voir-source': e.preventDefault(); voirSource(el.dataset.source); break;
      case 'dommage-nouveau': modaleDommage(); break;
      case 'dommage-modifier': modaleDommage(id); break;
      case 'bibliotheque': modaleBibliotheque(); break;
      case 'filtres-effacer': Object.assign(filtre, { texte: '', piece: '', categorie: '' }); rendre(); break;
      case 'filtre-preuve': filtre.preuve = el.dataset.statut; rendre(); break;
      case 'preuve-nouvelle': modalePreuve(); break;
      case 'preuve-modifier': modalePreuve(id); break;
      case 'photo-voir': voirPhoto(el.dataset.preuve, el.dataset.photo); break;
      case 'evenement-nouveau': modaleEvenement(null, el.dataset.type); break;
      case 'evenement-modifier': modaleEvenement(id); break;
      case 'echeance-nouvelle': modaleEcheance(); break;
      case 'echeance-modifier': modaleEcheance(id); break;
      case 'indemnisation': modaleIndemnisation(); break;
      case 'versement-nouveau': modaleVersement(); break;
      case 'versement-suppr': { const fin = avecAnnulation('Versement supprimé.'); const i = dossier().indemnisation; i.versements = i.versements.filter((v) => v.id !== id); fin(); break; }
      case 'imprimer': imprimer($('#doc-imprimable').innerHTML); break;
      case 'imprimer-courrier': imprimer(`<header><p class="pv-structure">Courrier</p><h2>${esc($('#courrier-objet').value)}</h2></header><p class="courrier-imprime">${esc($('#courrier-texte').value).replace(/\n/g, '<br>')}</p>`); break;
      case 'copier-courrier': copierCourrier(); break;
      case 'csv': exporterCsv(el.dataset.quoi); break;
      default: break;
    }
  });

  let minuterieFiltre = null;
  document.addEventListener('input', (e) => {
    if (e.target.dataset?.filtre !== 'texte') return;
    filtre.texte = e.target.value;
    clearTimeout(minuterieFiltre);
    minuterieFiltre = setTimeout(() => { const pos = e.target.selectionStart; rendre(); const c = $('[data-filtre="texte"]'); if (c) { c.focus(); c.setSelectionRange(pos, pos); } }, 250);
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset?.filtre && t.dataset.filtre !== 'texte') { filtre[t.dataset.filtre] = t.value; rendre(); return; }
    if (t.dataset?.choix === 'dossier') { E.actif = t.value; Object.assign(filtre, { texte: '', piece: '', categorie: '' }); cache(!session.demo && etatSync !== 'ok'); rendre(); return; }
    if (t.dataset?.choix === 'doc') { docChoix = t.value; rendre(); return; }
    if (t.dataset?.choix === 'courrier') { courrierChoix = t.value; rendre(); return; }
    if (t.dataset?.statutPreuve) { const p = preuve(t.dataset.statutPreuve); if (p) { p.statut = t.value; sauver(); rendre(); toast(`« ${p.libelle} » : ${nomStatutPreuve(p.statut)}.`); } return; }
    if (t.dataset?.fichiers && t.files?.length) { ajouterFichiers(t.dataset.fichiers, [...t.files]); }
  });

  document.addEventListener('click', (e) => { if (e.target === modale()) modale().close(); });

  window.addEventListener('online', () => { if (etatSync === 'horsligne' || etatSync === 'attente') envoyer(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !E) return;
    rafraichir();
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
        E = R.normaliser(c.etat); session.base = c.base; session.jeton = c.jeton;
        demarrer(); majSync('horsligne');
      } else ecranConnexion('Pas de connexion internet. Réessaie une fois en ligne.');
    }
  }

  // Exposé pour les tests automatisés uniquement (aucune donnée sensible).
  window.__sinistre = { etat: () => E, photos: () => Photos.lister() };
  init();
})();
